import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { buildCells, buildGrid, cellKey, DEFAULT_PLACE, effectiveDoc, KINDS, NO_PAYMENT, PLACES, PLACE_KINDS, SPENDING_KINDS } from './grid.js';
import { CATEGORIES, CATEGORY_KIND, normalize, parseStatement } from './statements.js';
import { refresh, progress } from './scanner.js';
import { classifySource, openTarget } from './sources.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.BILANCINO_DATA ?? path.join(root, 'data');
const dbFile = process.env.BILANCINO_DB ?? path.join(dataDir, 'bilancino.db');
const store = createStore(dbFile, { legacyJson: path.join(dataDir, 'db.json') });
store.load();

const app = express();
app.use(express.json());
app.use('/api/statements', express.text({ type: '*/*', limit: '20mb' }));
app.use(express.static(path.join(root, 'public')));

const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

const db = () => store.data;
const bad = (res, message) => res.status(400).json({ error: message });
const validCell = ({ kind, year, month }) => KINDS.includes(kind) && Number.isInteger(year) && month >= 1 && month <= 12;

app.get('/api/version', (req, res) => res.json({ version }));

app.get('/api/settings', (req, res) => res.json(db().settings));

app.put('/api/settings', async (req, res) => {
  const b = req.body ?? {};
  const s = db().settings;
  for (const key of ['payslipsSource', 'billsSource', 'statementsSource']) {
    if (typeof b[key] === 'string') {
      const src = classifySource(b[key]);
      if (src?.type === 'invalid') return bad(res, src.reason);
      s[key] = b[key].trim();
    }
  }
  if (b.rentAmount !== undefined) {
    const n = Number(b.rentAmount);
    if (!(n >= 0)) return bad(res, 'Importo affitto non valido.');
    s.rentAmount = n;
  }
  if (typeof b.rentFrom === 'string') {
    if (b.rentFrom && !/^\d{4}-\d{2}$/.test(b.rentFrom)) return bad(res, 'Data inizio affitto non valida.');
    s.rentFrom = b.rentFrom;
  }
  if (b.loanAmount !== undefined) {
    const n = Number(b.loanAmount);
    if (!(n >= 0)) return bad(res, 'Rata del prestito non valida.');
    s.loanAmount = n;
  }
  if (typeof b.loanFrom === 'string') {
    if (b.loanFrom && !/^\d{4}-\d{2}$/.test(b.loanFrom)) return bad(res, 'Data inizio prestito non valida.');
    s.loanFrom = b.loanFrom;
  }
  await store.save();
  res.json(s);
});

app.get('/api/refresh/status', (req, res) => res.json(progress));

let refreshing = false;
app.post('/api/refresh', async (req, res) => {
  if (refreshing) return res.status(409).json({ error: 'Aggiornamento già in corso.' });
  refreshing = true;
  try {
    const report = await refresh(db(), { force: Boolean(req.body?.force), cacheDir: path.join(path.dirname(dbFile), 'tessdata') });
    await store.save();
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    refreshing = false;
  }
});

app.get('/api/grid', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  res.json({ ...buildGrid(db(), year), lastRefresh: db().lastRefresh });
});

app.post('/api/paid', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const place = (i) => i.place ?? DEFAULT_PLACE;
  if (!items.every((i) => validCell(i) && !NO_PAYMENT.has(i.kind) && PLACES.includes(place(i)) && (place(i) === DEFAULT_PLACE || PLACE_KINDS.has(i.kind)))) {
    return bad(res, 'Cella non valida.');
  }
  for (const i of items) {
    const k = cellKey(i.kind, i.year, i.month, place(i));
    if (i.paid) db().paid[k] = true; else delete db().paid[k];
  }
  await store.save();
  res.json({ ok: true });
});

// Salda tutto: segna come pagata ogni cella con un importo ancora da pagare, di tutti gli anni e di tutte le case.
app.post('/api/pay-all', async (req, res) => {
  let count = 0;
  let total = 0;
  for (const c of buildCells(db()).values()) {
    if (NO_PAYMENT.has(c.kind) || c.amount == null || c.paid) continue;
    db().paid[cellKey(c.kind, c.year, c.month, c.place)] = true;
    count++;
    total += c.amount;
  }
  await store.save();
  res.json({ count, total: Math.round(total * 100) / 100 });
});

// Importi inseribili a mano: Spese, Svago e Carburante (correggono il totale dei movimenti). Gli altri vengono dai documenti.
// `amount: null` cancella il valore.
app.post('/api/manual', async (req, res) => {
  const { amount } = req.body ?? {};
  if (!validCell(req.body ?? {}) || !SPENDING_KINDS.has(req.body.kind)) return bad(res, 'Solo spese, svago e carburante si inseriscono a mano.');
  if (amount != null && !(Number(amount) >= 0)) return bad(res, 'Importo non valido.');
  const k = cellKey(req.body.kind, req.body.year, req.body.month);
  if (amount == null) delete db().manual[k]; else db().manual[k] = Number(amount);
  await store.save();
  res.json({ ok: true });
});

app.get('/api/docs', (req, res) => {
  const docs = Object.entries(db().docs).map(([key, raw]) => {
    const d = effectiveDoc(raw);
    return {
      key, name: d.name, source: d.source, kind: d.kind, year: d.year, month: d.month, amount: d.amount,
      status: d.status, missing: raw.missing, edited: d.edited, auto: { kind: raw.kind, year: raw.year, month: raw.month, amount: raw.amount },
    };
  });
  docs.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'ok' ? 1 : -1));
  res.json(docs);
});

app.get('/api/docs/text', (req, res) => {
  const doc = db().docs[req.query.key];
  if (!doc) return res.status(404).json({ error: 'Documento non trovato.' });
  res.json({ name: doc.name, text: doc.text });
});

// Correzione manuale di un documento (tipo, periodo o importo letti male).
app.put('/api/docs', async (req, res) => {
  const { key, override } = req.body ?? {};
  const doc = db().docs[key];
  if (!doc) return res.status(404).json({ error: 'Documento non trovato.' });
  const o = override ?? {};
  const next = {};
  if (o.kind) { if (!KINDS.includes(o.kind)) return bad(res, 'Tipo non valido.'); next.kind = o.kind; }
  if (o.year) { if (!(o.year >= 2000 && o.year <= 2100)) return bad(res, 'Anno non valido.'); next.year = Number(o.year); }
  if (o.month) { if (!(o.month >= 1 && o.month <= 12)) return bad(res, 'Mese non valido.'); next.month = Number(o.month); }
  if (o.amount !== undefined && o.amount !== null && o.amount !== '') {
    if (!(Number(o.amount) >= 0)) return bad(res, 'Importo non valido.');
    next.amount = Number(o.amount);
  }
  if (o.ignore === true) next.ignore = true;
  doc.override = Object.keys(next).length ? next : undefined;
  await store.save();
  res.json({ ok: true });
});

// Apre il PDF originale: file locale servito da qui, Seafile con redirect.
app.get('/api/file', (req, res) => {
  const key = String(req.query.key ?? '');
  if (!db().docs[key]) return res.status(404).send('Documento non trovato.');
  const target = openTarget(key);
  if (target?.type === 'url') return res.redirect(target.url);
  if (target?.type === 'local') return res.sendFile(target.path, (err) => err && !res.headersSent && res.status(404).send('File non trovato.'));
  res.status(404).send('Sorgente sconosciuta.');
});

// Estratto conto CSV: aggiunge i movimenti nuovi (quelli già presenti non si duplicano).
app.post('/api/statements', async (req, res) => {
  if (typeof req.body !== 'string' || !req.body.trim()) return bad(res, 'Nessun file ricevuto.');
  let items;
  try { items = parseStatement(req.body, db().rules); } catch (e) { return bad(res, e.message); }
  const all = (db().transactions ??= {});
  let added = 0;
  for (const t of items) if (!all[t.id]) { all[t.id] = t; added++; }
  await store.save();
  res.json({ found: items.length, added, duplicates: items.length - added });
});

app.get('/api/transactions', (req, res) => {
  const year = Number(req.query.year);
  const list = Object.values(db().transactions ?? {}).filter((t) => !year || t.date.startsWith(`${year}-`));
  list.sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
  res.json({ categories: CATEGORIES, transactions: list });
});

// Analisi temporanea: come vengono smistati tutti i movimenti, raggruppati per descrizione.
app.get('/api/analysis', (req, res) => {
  const list = Object.values(db().transactions ?? {});
  const total = list.reduce((a, t) => a + Math.abs(t.amount), 0);
  const cats = Object.fromEntries(CATEGORIES.map((c) => [c, { category: c, count: 0, total: 0, merchants: new Map() }]));
  for (const t of list) {
    const c = cats[t.category] ?? cats.altro;
    const amount = Math.abs(t.amount);
    c.count++;
    c.total += amount;
    const key = normalize(t.description) || t.description;
    const m = c.merchants.get(key) ?? { id: t.id, name: t.description, count: 0, total: 0, from: t.date, to: t.date };
    m.count++;
    m.total += amount;
    if (t.date < m.from) m.from = t.date;
    if (t.date > m.to) m.to = t.date;
    c.merchants.set(key, m);
  }
  const round = (n) => Math.round(n * 100) / 100;
  res.json({
    total: round(total),
    count: list.length,
    categories: CATEGORIES.map((k) => {
      const c = cats[k];
      return {
        category: k, count: c.count, total: round(c.total), share: total ? c.total / total : 0, column: CATEGORY_KIND[k] ?? null,
        merchants: [...c.merchants.values()].map((m) => ({ ...m, total: round(m.total) })).sort((a, b) => b.total - a.total),
      };
    }),
  });
});

// Cambia categoria a un movimento e la ricorda per tutti quelli con la stessa descrizione.
app.put('/api/transactions', async (req, res) => {
  const { id, category } = req.body ?? {};
  const t = db().transactions?.[id];
  if (!t) return res.status(404).json({ error: 'Movimento non trovato.' });
  if (!CATEGORIES.includes(category)) return bad(res, 'Categoria non valida.');
  const key = normalize(t.description);
  if (key) {
    db().rules[key] = category;
    for (const o of Object.values(db().transactions)) if (normalize(o.description) === key) o.category = category;
  } else t.category = category;
  await store.save();
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4870);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => console.log(`Bilancino su http://${host}:${port}`));
