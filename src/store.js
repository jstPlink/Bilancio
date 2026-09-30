import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LEGACY_CATEGORY } from './statements.js';

// Persistenza su SQLite (data/bilancino.db): impostazioni, documenti letti,
// spunte "pagato", importi manuali. Il server tiene una copia in memoria (`data`)
// e `save()` la scrive nel database in un'unica transazione.
// Al primo avvio importa il vecchio data/db.json, se presente.

const defaults = () => ({
  settings: {
    payslipsSource: '',
    billsSource: '',
    statementsSource: '',
    rentAmount: 0,
    rentFrom: '',
    loanAmount: 0,
    loanFrom: '',
  },
  docs: {},
  paid: {},
  manual: {},
  transactions: {},
  statementFiles: {},
  rules: {},
  lastRefresh: null,
});

export function createStore(file, { legacyJson } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sql = new DatabaseSync(file);
  sql.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, json TEXT NOT NULL);
  `);
  let db = null;

  function load() {
    const d = defaults();
    const kv = Object.fromEntries(sql.prepare('SELECT k, v FROM kv').all().map((r) => [r.k, JSON.parse(r.v)]));
    const docs = Object.fromEntries(sql.prepare('SELECT key, json FROM docs').all().map((r) => [r.key, JSON.parse(r.json)]));
    const empty = !Object.keys(kv).length && !Object.keys(docs).length;
    if (empty && legacyJson && fs.existsSync(legacyJson)) {
      db = { ...d, ...JSON.parse(fs.readFileSync(legacyJson, 'utf8')) };
      db.settings = { ...d.settings, ...db.settings };
      save();
      return db;
    }
    db = { ...d, ...kv, docs };
    db.settings = { ...d.settings, ...db.settings };
    migrateCategories();
    return db;
  }

  // Le categorie cibo e casa sono diventate "spesa".
  function migrateCategories() {
    const fix = (c) => LEGACY_CATEGORY[c] ?? c;
    for (const t of Object.values(db.transactions)) t.category = fix(t.category);
    for (const k of Object.keys(db.rules)) db.rules[k] = fix(db.rules[k]);
  }

  function save() {
    sql.exec('BEGIN');
    try {
      const put = sql.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
      for (const k of ['settings', 'paid', 'manual', 'transactions', 'statementFiles', 'rules', 'lastRefresh']) put.run(k, JSON.stringify(db[k] ?? null));
      sql.exec('DELETE FROM docs');
      const ins = sql.prepare('INSERT INTO docs (key, json) VALUES (?, ?)');
      for (const [key, doc] of Object.entries(db.docs)) ins.run(key, JSON.stringify(doc));
      sql.exec('COMMIT');
    } catch (e) {
      sql.exec('ROLLBACK');
      throw e;
    }
  }

  return { load, save, get data() { return db; } };
}
