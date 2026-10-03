import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../src/store.js';
import { freePort } from './free-port.js';

// Le banche si leggono solo quando l'utente preme un pulsante apposta: l'aggiornamento (anche quello all'apertura dell'app)
// non deve mai chiamare la banca.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASSWORD = 'password-di-prova-1';
let port;
let base;
const auth = { Authorization: `Basic ${Buffer.from(`x:${PASSWORD}`).toString('base64')}`, 'Content-Type': 'application/json' };

let hits = 0;
let bank;
let server;
let dataDir;

before(async () => {
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  bank = http.createServer((req, res) => {
    hits++;
    res.setHeader('Content-Type', 'application/json');
    res.end(/transactions/.test(req.url) ? '{"transactions":[]}' : /balances/.test(req.url) ? '{"balances":[]}' : '{}');
  });
  await new Promise((r) => bank.listen(0, '127.0.0.1', r));
  const bankUrl = `http://127.0.0.1:${bank.address().port}`;

  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bilancio-banks-'));
  const store = createStore(path.join(dataDir, 'bilancino.db'));
  store.load();
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  store.data.banking = {
    app: { appId: 'app-di-prova', privateKey },
    pending: {},
    connections: [{ id: 'C1', bank: 'revolut', accounts: [{ uid: 'a1', iban: '', name: 'Conto', currency: 'EUR', type: 'CACC' }], validUntil: new Date(Date.now() + 90 * 86400000).toISOString(), lastSync: null, calls: [] }],
  };
  store.save();

  server = spawn(process.execPath, ['--no-warnings', path.join(root, 'src', 'server.js')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), BILANCIO_DATA: dataDir, BILANCIO_PASSWORD: PASSWORD, BILANCIO_SERVER: '', ENABLE_BANKING_API: bankUrl },
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
  bank?.close();
  await new Promise((r) => setTimeout(r, 300));
  await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

const post = (route, body = {}) => fetch(`${base}${route}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });

test('Aggiorna (e l\'apertura dell\'app) non leggono mai dalla banca', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await post('/api/refresh')).status, 200);
  assert.equal((await post('/api/refresh', { force: true })).status, 200);
  assert.equal(hits, 0, 'nessuna richiesta deve arrivare alla banca');
});

test('i pulsanti apposta leggono dalla banca', async () => {
  const r = await post('/api/banking/explore/read', { id: 'C1' });
  assert.equal(r.status, 200);
  assert.ok(hits > 0, 'il pulsante «Leggi dalla banca» deve chiamare la banca');
  const after = hits;
  assert.equal((await post('/api/banking/sync', { id: 'C1' })).status, 200);
  assert.ok(hits > after, 'anche «Aggiorna ora» nelle Impostazioni deve chiamare la banca');
  // e un nuovo aggiornamento torna a non toccarla
  const frozen = hits;
  assert.equal((await post('/api/refresh')).status, 200);
  assert.equal(hits, frozen);
});
