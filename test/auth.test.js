import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from '../src/auth.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('il cookie di sessione si valida, e si rifiuta se alterato, scaduto o con un\'altra password', () => {
  const a = createAuth('password-lunga-1');
  const token = a.newToken();
  assert.equal(a.validToken(token), true);
  const [exp, mac] = token.split('.');
  assert.equal(a.validToken(`${Number(exp) + 1000}.${mac}`), false); // data spostata
  assert.equal(a.validToken(`${exp}.${mac.slice(0, -2)}xx`), false); // firma alterata
  assert.equal(a.validToken(''), false);
  assert.equal(a.validToken(null), false);
  assert.equal(createAuth('altra-password-2').validToken(token), false); // cambiando password le sessioni decadono
  assert.equal(createAuth('password-lunga-1', { sessionDays: -1 }).validToken(createAuth('password-lunga-1', { sessionDays: -1 }).newToken()), false); // scaduto
});

test('la password si confronta senza tentativi casuali e senza password l\'accesso è aperto', () => {
  const a = createAuth('segreta-1234');
  assert.equal(a.checkPassword('segreta-1234'), true);
  assert.equal(a.checkPassword('segreta-12345'), false);
  assert.equal(a.checkPassword(''), false);
  assert.equal(a.checkPassword(undefined), false);
  assert.equal(createAuth('').enabled, false);
  assert.equal(createAuth(undefined).enabled, false);
});

// --- prova vera: si avvia il server con una password
const PASSWORD = 'password-di-prova-123';
const port = 4900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
let server;
let dataDir;

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bilancio-auth-'));
  server = spawn(process.execPath, ['--no-warnings', path.join(root, 'src', 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BILANCIO_DATA: dataDir, BILANCIO_PASSWORD: PASSWORD },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/version`)).ok) return; } catch { /* non è ancora pronto */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Il server di prova non è partito.');
});

after(async () => {
  server?.kill();
  await new Promise((r) => setTimeout(r, 200));
  await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

const login = (password, ip) => fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) },
  body: JSON.stringify({ password }),
});

test('senza password i dati non si leggono, la pagina di accesso sì', async () => {
  const v = await (await fetch(`${base}/api/version`)).json();
  assert.equal(v.protected, true);
  assert.equal((await fetch(`${base}/api/grid?year=2026`)).status, 401);
  assert.equal((await fetch(`${base}/api/transactions?year=0`)).status, 401);
  assert.equal((await fetch(`${base}/app.js`)).status, 401);
  const home = await fetch(`${base}/`, { redirect: 'manual', headers: { Accept: 'text/html' } });
  assert.equal(home.status, 302);
  assert.equal(home.headers.get('location'), '/login');
  const page = await fetch(`${base}/login`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Password/);
});

test('con la password giusta si entra, con quella sbagliata no, e si esce', async () => {
  assert.equal((await login('sbagliata')).status, 401);
  const ok = await login(PASSWORD);
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const session = cookie.split(';')[0];
  assert.equal((await fetch(`${base}/api/grid?year=2026`, { headers: { Cookie: session } })).status, 200);
  assert.equal((await fetch(`${base}/app.js`, { headers: { Cookie: session } })).status, 200);
  assert.equal((await fetch(`${base}/api/grid?year=2026`, { headers: { Cookie: `${session}x` } })).status, 401);

  const out = await fetch(`${base}/api/logout`, { method: 'POST', headers: { Cookie: session } });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

test('gli script possono usare HTTP Basic con la password', async () => {
  const basic = (pw) => ({ Authorization: `Basic ${Buffer.from(`qualsiasi:${pw}`).toString('base64')}` });
  assert.equal((await fetch(`${base}/api/grid?year=2026`, { headers: basic(PASSWORD) })).status, 200);
  assert.equal((await fetch(`${base}/api/grid?year=2026`, { headers: basic('no') })).status, 401);
});

test('dopo 5 tentativi sbagliati l\'indirizzo resta bloccato, anche con la password giusta', async () => {
  const ip = '203.0.113.9';
  for (let i = 0; i < 5; i++) assert.equal((await login('no', ip)).status, 401);
  const locked = await login(PASSWORD, ip);
  assert.equal(locked.status, 429);
  assert.match((await locked.json()).error, /Troppi tentativi/);
  assert.equal((await login(PASSWORD, '203.0.113.10')).status, 200); // un altro indirizzo non è toccato
});
