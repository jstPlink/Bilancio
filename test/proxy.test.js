import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort } from './free-port.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASSWORD = 'password-del-server-1';
let server;
let local;
const procs = [];
const dirs = [];

const launch = async (script, env, readyUrl) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bilancio-proxy-'));
  dirs.push(dataDir);
  const proc = spawn(process.execPath, ['--no-warnings', path.join(root, 'src', script)], {
    env: { ...process.env, HOST: '127.0.0.1', BILANCIO_DATA: dataDir, BILANCIO_PASSWORD: '', BILANCIO_SERVER: '', ...env },
    stdio: 'ignore',
  });
  procs.push(proc);
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(readyUrl)).ok) return { proc, dataDir }; } catch { /* non è ancora pronto */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${script} non è partito`);
};

let upstream;
let front;
before(async () => {
  const serverPort = await freePort();
  const localPort = await freePort();
  server = `http://127.0.0.1:${serverPort}`;
  local = `http://127.0.0.1:${localPort}`;
  upstream = await launch('server.js', { PORT: String(serverPort), BILANCIO_PASSWORD: PASSWORD }, `${server}/api/version`);
  front = await launch('start.js', { PORT: String(localPort), BILANCIO_SERVER: server }, `${local}/api/version`);
});
after(async () => {
  for (const p of procs) p.kill();
  await new Promise((r) => setTimeout(r, 300));
  for (const d of dirs) await fs.rm(d, { recursive: true, force: true }).catch(() => {});
});

test('il localhost serve le pagine di questa cartella e inoltra al server dati e login', async () => {
  const a = await (await fetch(`${server}/api/version`)).json();
  const b = await (await fetch(`${local}/api/version`)).json();
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(b.version, pkg.version); // la versione mostrata è quella del codice locale…
  assert.equal(b.serverVersion, a.version); // …e quella del server si legge a parte
  assert.equal(b.protected, true);

  // le pagine sono quelle locali (si vedono subito le modifiche), i dati restano chiusi finché non si fa il login sul server
  assert.equal((await fetch(`${local}/api/grid?year=2026`)).status, 401);
  assert.equal(await (await fetch(`${local}/app.js`)).text(), await fs.readFile(path.join(root, 'public', 'app.js'), 'utf8'));
  assert.match(await (await fetch(`${local}/`)).text(), /<title>Bilancio<\/title>/);
  assert.match(await (await fetch(`${local}/login`)).text(), /Password/);

  // il login passa dal localhost con il corpo JSON e restituisce un cookie utilizzabile
  assert.equal((await fetch(`${local}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'no' }) })).status, 401);
  const ok = await fetch(`${local}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /bilancio_sessione=/);
  assert.doesNotMatch(cookie, /Secure/i);
  const session = cookie.split(';')[0];
  assert.equal((await fetch(`${local}/api/grid?year=2026`, { headers: { Cookie: session } })).status, 200);
  assert.equal((await fetch(`${local}/app.js`, { headers: { Cookie: session } })).status, 200);
  // lo stesso cookie vale anche sul server: è davvero la stessa sessione
  assert.equal((await fetch(`${server}/api/grid?year=2026`, { headers: { Cookie: session } })).status, 200);
});

test('in locale non viene creato nessun database, e se il server è spento si capisce perché', async () => {
  assert.deepEqual(await fs.readdir(front.dataDir), []);
  upstream.proc.kill();
  await new Promise((r) => setTimeout(r, 500));
  const res = await fetch(`${local}/api/grid?year=2026`);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /non risponde/);
  // la pagina si apre comunque (è locale) e mostrerà il messaggio d'errore dei dati
  assert.equal((await fetch(`${local}/`, { headers: { Accept: 'text/html' } })).status, 200);
});
