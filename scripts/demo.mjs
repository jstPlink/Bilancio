// Demo con dati inventati: banca finta (porta 4890) e app (porta 4871) con un database a parte in data/demo.
//
//   npm run demo            (poi apri http://localhost:4871)
//
// UniCredit e Revolut sono già collegati e letti; il budget è già impostato. Non tocca i tuoi dati veri. Ctrl+C ferma tutto.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeBank } from './banca-finta.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPort = Number(process.argv[2] ?? 4871);
const bankPort = 4890;
const dir = path.join(root, 'data', 'demo');
fs.rmSync(dir, { recursive: true, force: true });

const bank = createFakeBank();
await bank.listen(bankPort);
process.env.ENABLE_BANKING_API = `http://127.0.0.1:${bankPort}`;
process.env.MYBANK_NO_AUTO = '1';
process.env.MYBANK_DEMO = '1'; // le pagine mostrano che i dati sono inventati

const { createApp } = await import('../src/server.js');
const { app, db, store } = createApp({ dir, password: '' });
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
db.banking.app = { appId: 'demo', privateKey };
db.settings.budgets = { spesa: 400, svago: 120, carburante: 100 };
await store.save();

const server = app.listen(appPort, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${appPort}`;
  for (const bankKey of ['unicredit', 'revolut']) {
    const { url } = await (await fetch(`${base}/api/banks/link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bank: bankKey }) })).json();
    const back = (await fetch(url, { redirect: 'manual' })).headers.get('location');
    await fetch(back, { redirect: 'manual' });
  }
  console.log(`Demo pronta: ${base}  (dati inventati in data/demo, nessuna password)`);
});
process.on('SIGINT', () => { server.close(); bank.close(); process.exit(0); });
