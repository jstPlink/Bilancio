import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from '../src/auth.js';
import { freePort } from './free-port.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------ parte unitaria
function memoryAuth(extra = {}) {
  let record = null;
  const auth = createAuth({ getRecord: () => record, saveRecord: (r) => { record = r; }, ...extra });
  return { auth, get record() { return record; } };
}

test('la password creata si conserva cifrata e si controlla', () => {
  const m = memoryAuth();
  assert.equal(m.auth.hasPassword(), false);
  assert.equal(m.auth.checkPassword('qualsiasi'), false);
  m.auth.setPassword('una-password-lunga');
  assert.equal(m.auth.hasPassword(), true);
  assert.equal(m.auth.checkPassword('una-password-lunga'), true);
  assert.equal(m.auth.checkPassword('una-password-lungA'), false);
  assert.equal(m.auth.checkPassword(''), false);
  assert.equal(m.auth.checkPassword(undefined), false);
  assert.ok(!JSON.stringify(m.record).includes('una-password-lunga'), 'la password non deve comparire in chiaro');
  assert.match(m.record.hash, /^[0-9a-f]{64}$/);
});

test('il cookie di sessione si valida, e si rifiuta se alterato, scaduto o dopo un cambio di password', () => {
  const m = memoryAuth();
  assert.equal(m.auth.validToken(m.auth.newToken()), false); // senza password non vale nulla
  m.auth.setPassword('password-lunga-1');
  const token = m.auth.newToken();
  assert.equal(m.auth.validToken(token), true);
  const [exp, mac] = token.split('.');
  assert.equal(m.auth.validToken(`${Number(exp) + 1000}.${mac}`), false);
  assert.equal(m.auth.validToken(`${exp}.${mac.slice(0, -2)}xx`), false);
  assert.equal(m.auth.validToken(''), false);
  assert.equal(m.auth.validToken(null), false);
  m.auth.setPassword('altra-password-2');
  assert.equal(m.auth.validToken(token), false); // cambiando password le sessioni decadono
  const expired = memoryAuth({ sessionDays: -1 });
  expired.auth.setPassword('password-lunga-1');
  assert.equal(expired.auth.validToken(expired.auth.newToken()), false);
});

test('con BILANCIO_PASSWORD la password è quella dell\'ambiente', () => {
  const a = createAuth({ envPassword: 'dal-compose-1234' });
  assert.equal(a.hasPassword(), true);
  assert.equal(a.usesEnv, true);
  assert.equal(a.checkPassword('dal-compose-1234'), true);
  assert.equal(a.checkPassword('dal-compose-12345'), false);
});

// ------------------------------------------------------------------ prova vera: si avvia il server
const children = [];
const dirs = [];

async function startServer(env, dataDir) {
  dataDir ??= await fs.mkdtemp(path.join(os.tmpdir(), 'bilancio-auth-'));
  dirs.push(dataDir);
  const port = await freePort();
  const proc = spawn(process.execPath, ['--no-warnings', path.join(root, 'src', 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BILANCIO_DATA: dataDir, BILANCIO_PASSWORD: '', ...env },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let output = '';
  proc.stdout.on('data', (d) => { output += d; });
  children.push(proc);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/version`)).ok) return { base, proc, dataDir, output: () => output }; } catch { /* non è ancora pronto */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Il server di prova non è partito.');
}
const stop = async (proc) => { proc.kill(); await new Promise((r) => setTimeout(r, 300)); };

after(async () => {
  for (const p of children) p.kill();
  await new Promise((r) => setTimeout(r, 300));
  for (const d of dirs) await fs.rm(d, { recursive: true, force: true }).catch(() => {});
});

const post = (base, route, body, headers = {}) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const PROXIED = { 'cf-connecting-ip': '198.51.100.7' }; // come se la richiesta arrivasse da internet via Cloudflare

test('prima configurazione: la password si crea dalla pagina di accesso e resta dopo un riavvio', async () => {
  const s = await startServer({});
  assert.match(s.output(), /PRIMA CONFIGURAZIONE/);
  assert.doesNotMatch(s.output(), /codice/i);

  // prima della password non si leggono i dati e il login non è ancora possibile
  assert.equal((await fetch(`${s.base}/api/grid?year=2026`)).status, 401);
  assert.equal((await post(s.base, '/api/login', { password: 'x' })).status, 409);
  const state = await (await fetch(`${s.base}/api/auth-state`)).json();
  assert.deepEqual([state.mode, state.minLength], ['setup', 4]);
  assert.equal(state.codeRequired, undefined);

  // anche da internet (via proxy) basta la password: niente codice
  assert.equal((await post(s.base, '/api/setup', { password: 'abc' }, PROXIED)).status, 400);
  const created = await post(s.base, '/api/setup', { password: 'una-password-lunga' }, PROXIED);
  assert.equal(created.status, 200);
  const session = created.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${s.base}/api/grid?year=2026`, { headers: { Cookie: session } })).status, 200);

  // una volta creata, non si può rifare
  assert.equal((await post(s.base, '/api/setup', { password: 'un-altra-password' }, PROXIED)).status, 409);
  assert.equal((await (await fetch(`${s.base}/api/auth-state`)).json()).mode, 'login');
  assert.equal((await post(s.base, '/api/login', { password: 'sbagliata' })).status, 401);
  assert.equal((await post(s.base, '/api/login', { password: 'una-password-lunga' })).status, 200);

  // dopo un riavvio la password e le sessioni valgono ancora
  await stop(s.proc);
  const again = await startServer({}, s.dataDir);
  assert.equal((await (await fetch(`${again.base}/api/auth-state`)).json()).mode, 'login');
  assert.doesNotMatch(again.output(), /PRIMA CONFIGURAZIONE/);
  assert.equal((await fetch(`${again.base}/api/grid?year=2026`, { headers: { Cookie: session } })).status, 200);
  assert.equal((await post(again.base, '/api/login', { password: 'una-password-lunga' })).status, 200);
  const db = await fs.readFile(path.join(again.dataDir, 'bilancino.db'));
  assert.ok(!db.includes(Buffer.from('una-password-lunga')), 'la password non deve stare in chiaro nel database');
});

test('HTTP Basic per gli script, uscita con logout', async () => {
  const s = await startServer({});
  assert.equal((await post(s.base, '/api/setup', { password: '123' })).status, 400);
  assert.equal((await post(s.base, '/api/setup', { password: 'password-da-localhost' })).status, 200);
  const basic = (pw) => ({ Authorization: `Basic ${Buffer.from(`qualsiasi:${pw}`).toString('base64')}` });
  assert.equal((await fetch(`${s.base}/api/grid?year=2026`, { headers: basic('password-da-localhost') })).status, 200);
  assert.equal((await fetch(`${s.base}/api/grid?year=2026`, { headers: basic('no') })).status, 401);
  const out = await fetch(`${s.base}/api/logout`, { method: 'POST' });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

test('pagine e dati restano chiusi senza sessione, dopo 5 errori l\'indirizzo è bloccato', async () => {
  const s = await startServer({ BILANCIO_PASSWORD: 'password-di-prova-123' });
  assert.equal((await (await fetch(`${s.base}/api/auth-state`)).json()).mode, 'login');
  assert.equal((await fetch(`${s.base}/app.js`)).status, 401);
  assert.equal((await fetch(`${s.base}/api/transactions?year=0`)).status, 401);
  const home = await fetch(`${s.base}/`, { redirect: 'manual', headers: { Accept: 'text/html' } });
  assert.equal(home.status, 302);
  assert.equal(home.headers.get('location'), '/login');
  assert.match(await (await fetch(`${s.base}/login`)).text(), /Password/);
  const ok = await post(s.base, '/api/login', { password: 'password-di-prova-123' });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const session = cookie.split(';')[0];
  assert.equal((await fetch(`${s.base}/app.js`, { headers: { Cookie: session } })).status, 200);
  assert.equal((await fetch(`${s.base}/api/grid?year=2026`, { headers: { Cookie: `${session}x` } })).status, 401);

  const ip = { 'cf-connecting-ip': '203.0.113.9' };
  for (let i = 0; i < 5; i++) assert.equal((await post(s.base, '/api/login', { password: 'no' }, ip)).status, 401);
  const locked = await post(s.base, '/api/login', { password: 'password-di-prova-123' }, ip);
  assert.equal(locked.status, 429);
  assert.match((await locked.json()).error, /Troppi tentativi/);
  assert.equal((await post(s.base, '/api/login', { password: 'password-di-prova-123' }, { 'cf-connecting-ip': '203.0.113.10' })).status, 200);
});
