import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { server as frontend } from '../src/proxy.js';

// Il frontend locale non ha dati né logica: inoltra tutto al server scelto nella pagina di accesso.
async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mybank-'));
  const { app } = createApp({ dir, password: 'segreta' });
  const real = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const local = await new Promise((r) => { frontend.listen(0, '127.0.0.1', () => r(frontend)); });
  t.after(() => { real.close(); frontend.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { realUrl: `127.0.0.1:${real.address().port}`, localUrl: `http://127.0.0.1:${local.address().port}` };
}

test('il frontend locale si riconosce da /local-config.json e serve le pagine di questa cartella', async (t) => {
  const { localUrl } = await setup(t);
  const cfg = await (await fetch(`${localUrl}/local-config.json`)).json();
  assert.equal(cfg.local, true);
  const page = await fetch(`${localUrl}/`);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /app\.js\?v=\d+\.\d+\.\d+/);
});

test('senza server scelto o con un indirizzo sbagliato le chiamate rispondono con un errore chiaro', async (t) => {
  const { localUrl } = await setup(t);
  assert.equal((await fetch(`${localUrl}/api/session`)).status, 400);
  assert.equal((await fetch(`${localUrl}/api/session`, { headers: { 'x-mybank-server': 'ftp://x' } })).status, 400);
  const down = await fetch(`${localUrl}/api/session`, { headers: { 'x-mybank-server': 'http://127.0.0.1:1' } });
  assert.equal(down.status, 502);
  assert.match((await down.json()).error, /non risponde/);
});

test('login, dati e versione arrivano dal server scelto (indirizzo di casa senza https)', async (t) => {
  const { localUrl, realUrl } = await setup(t);
  const h = { 'x-mybank-server': realUrl, 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${localUrl}/api/summary`, { headers: h })).status, 401);
  const login = await fetch(`${localUrl}/api/login`, { method: 'POST', headers: h, body: JSON.stringify({ password: 'segreta' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const session = await (await fetch(`${localUrl}/api/session`, { headers: { ...h, cookie } })).json();
  assert.equal(session.ok, true);
  assert.ok(session.version); // quella del codice locale
  assert.equal((await fetch(`${localUrl}/api/summary?year=2026`, { headers: { ...h, cookie } })).status, 200);
});
