// Demo della scheda «Banche» con dati inventati, senza server vero e senza banche vere.
//
//   npm run demo:banche            (poi apri http://localhost:4871)
//
// Avvia la banca finta (porta 4890) e un'app di prova (porta 4871) con un database a parte in data/demo-banche
// (la cartella data/ non va in Git). Serve per provare la scheda anche quando il server vero non ha ancora la
// versione nuova. UniCredit parte già letto; Revolut no, così si prova il pulsante «Leggi dalla banca».
// Non tocca il localhost collegato al tuo server né i tuoi dati. Ctrl+C ferma tutto.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPort = Number(process.argv[2] ?? 4871);
const bankPort = 4890;
const PASSWORD = 'demo-banche';
const dataDir = path.join(root, 'data', 'demo-banche');
const bankUrl = `http://127.0.0.1:${bankPort}`;

// L'indirizzo dell'API si legge all'importazione del modulo: va impostato prima.
process.env.ENABLE_BANKING_API = bankUrl;
process.env.BILANCIO_SERVER = '';

const children = [];
const stop = () => { for (const c of children) c.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const start = (script, args, env = {}) => {
  const child = spawn(process.execPath, ['--no-warnings', path.join(root, script), ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit'] });
  child.on('exit', (code) => { if (code) { console.error(`${script} si è fermato (codice ${code}).`); stop(); } });
  children.push(child);
  return child;
};
const waitFor = async (url) => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error(`Nessuna risposta da ${url}`);
};

// 1) banca finta
start('scripts/banca-finta.mjs', [String(bankPort)]);
await waitFor(`${bankUrl}/accounts/x/details`);

// 2) database di prova con due banche collegate
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
const { createStore } = await import('../src/store.js');
const { createClient, readBankData } = await import('../src/banking.js');
const store = createStore(path.join(dataDir, 'bilancino.db'));
store.load();
const db = store.data;
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const validUntil = new Date(Date.now() + 150 * 86400000).toISOString();
db.banking = {
  app: { appId: 'app-di-prova', privateKey },
  pending: {},
  connections: [
    { id: 'DEMO-UC', bank: 'unicredit', accounts: [{ uid: 'unicredit-1', iban: 'IT60X0542811101000000123456', name: 'Conto Corrente', currency: 'EUR', type: 'CACC' }], validUntil, lastSync: null, calls: [] },
    { id: 'DEMO-RV', bank: 'revolut', accounts: [{ uid: 'revolut-1', iban: 'LT123456789012345678', name: 'Principale', currency: 'EUR', type: 'CACC' }, { uid: 'revolut-2', iban: '', name: 'Mario Rossi', currency: 'EUR', type: 'SVGS' }, { uid: 'revolut-3', iban: '', name: 'Mario Rossi', currency: 'EUR', type: 'SVGS' }], validUntil, lastSync: null, calls: [] },
  ],
};
await readBankData({ client: createClient(db.banking.app), db, conn: db.banking.connections[0] });
store.save();

// 3) l'app di prova
start('src/server.js', [], { PORT: String(appPort), BILANCIO_DATA: dataDir, BILANCIO_PASSWORD: PASSWORD, ENABLE_BANKING_API: bankUrl });
await waitFor(`http://127.0.0.1:${appPort}/api/version`);
console.log(`\nDemo pronta: http://localhost:${appPort}  (password: ${PASSWORD})`);
console.log('Apri la scheda «Banche». I dati sono inventati e stanno in data/demo-banche. Ctrl+C per fermare.\n');
