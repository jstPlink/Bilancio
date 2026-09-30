#!/usr/bin/env node
// Cancella la password creata nell'app: al prossimo avvio la pagina di accesso chiede di sceglierne una nuova.
// FERMA prima l'app (altrimenti riscrive la vecchia password al primo salvataggio).
//
//   In locale:  node scripts/reimposta-password.mjs [--db file]
//   In Docker:  docker compose stop && docker compose run --rm --no-deps bilancio node scripts/reimposta-password.mjs && docker compose up -d
//               (poi leggi il codice di configurazione con  docker logs bilancio)
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const i = process.argv.indexOf('--db');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = (i >= 0 ? process.argv[i + 1] : undefined) ?? process.env.BILANCIO_DB ?? path.join(process.env.BILANCIO_DATA ?? path.join(root, 'data'), 'bilancino.db');

const sql = new DatabaseSync(dbFile);
const before = sql.prepare("SELECT COUNT(*) AS n FROM kv WHERE k = 'auth' AND v <> 'null'").get().n;
sql.prepare("DELETE FROM kv WHERE k = 'auth'").run();
sql.close();
console.log(before ? `Password cancellata (${dbFile}). Riavvia l'app: la pagina di accesso chiederà di crearne una nuova.` : `Nel database (${dbFile}) non c'era nessuna password creata nell'app.`);
if (process.env.BILANCIO_PASSWORD) console.log('Nota: BILANCIO_PASSWORD è impostata nell\'ambiente e continuerà a valere: toglila per creare la password dall\'app.');
