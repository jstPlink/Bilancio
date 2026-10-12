import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Persistenza su SQLite (data/bilancino.db): impostazioni, documenti letti,
// spunte "pagato", importi manuali. Il server tiene una copia in memoria (`data`)
// e `save()` la scrive nel database in un'unica transazione.
// Al primo avvio importa il vecchio data/db.json, se presente.

const defaults = () => ({
  settings: {
    payslipsSource: '',
    billsSource: '',
    statementsSource: '',
    rentAmount: 0, // importo totale mensile dell'affitto
    rentShare: 100, // % a carico dell'utente: l'affitto contato è rentAmount × rentShare / 100
    rentFrom: '',
    billShare: 50, // % di acqua, luce, gas e wifi a carico dell'utente (di norma 50: bollette divise in due)
    budgets: {},
    savingsGoal: 0,
  },
  docs: {},
  paid: {},
  manual: {},
  transactions: {},
  statementFiles: {},
  auth: null,
  banking: { app: null, connections: [], pending: {} },
  categoryVersion: 0,
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
    return db;
  }

  function save() {
    sql.exec('BEGIN');
    try {
      const put = sql.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
      for (const k of ['settings', 'paid', 'manual', 'transactions', 'statementFiles', 'categoryVersion', 'auth', 'banking', 'lastRefresh']) put.run(k, JSON.stringify(db[k] ?? null));
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
