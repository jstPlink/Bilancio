#!/usr/bin/env node
// Passaggio ai nomi neutri delle case (casa1, casa2): dà il nome a una casa e rinomina le spunte "pagato" salvate col vecchio nome.
// FERMA prima l'app. Uso:  node scripts/rinomina-casa.mjs <casa1|casa2> <nome> [--db file]
//   in Docker: docker compose stop && docker compose run --rm --no-deps bilancio node scripts/rinomina-casa.mjs casa2 <nome> && docker compose up -d
// <nome> è il nome della cartella dei documenti (e quello usato prima nelle spunte): diventa il nome della casa in Impostazioni → Bollette.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((a, i, all) => a !== '--db' && all[i - 1] !== '--db');
const [id, name] = args;
if (!['casa1', 'casa2'].includes(id) || !name) { console.error('Uso: node scripts/rinomina-casa.mjs <casa1|casa2> <nome> [--db file]'); process.exit(1); }
const i = process.argv.indexOf('--db');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = (i >= 0 ? process.argv[i + 1] : undefined) ?? process.env.BILANCIO_DB ?? path.join(process.env.BILANCIO_DATA ?? path.join(root, 'data'), 'bilancino.db');

const sql = new DatabaseSync(dbFile);
const read = (k) => { const r = sql.prepare('SELECT v FROM kv WHERE k = ?').get(k); return r ? JSON.parse(r.v) : null; };
const write = (k, v) => sql.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v));

const settings = read('settings') ?? {};
settings.placeNames = { ...settings.placeNames, [id]: name.trim() };
write('settings', settings);

let moved = 0;
const paid = read('paid') ?? {};
const old = name.trim().toLowerCase();
for (const key of Object.keys(paid)) {
  const parts = key.split('|');
  if (parts.length === 4 && parts[3].toLowerCase() === old) {
    paid[[...parts.slice(0, 3), id].join('|')] = paid[key];
    delete paid[key];
    moved++;
  }
}
write('paid', paid);
sql.close();
console.log(`${id} ora si chiama «${name.trim()}»; spunte «pagato» rinominate: ${moved} (${dbFile}).`);
