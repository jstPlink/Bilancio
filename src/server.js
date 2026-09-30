import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { buildCells, buildGrid, cellKey, DEFAULT_PLACE, effectiveDoc, KINDS, NO_PAYMENT, PLACES, PLACE_KINDS, SPENDING_KINDS } from './grid.js';
import { CATEGORIES, CATEGORY_KIND, ruleKey, parseStatement } from './statements.js';
import { refresh, progress } from './scanner.js';
import { classifySource, openTarget } from './sources.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.BILANCIO_DATA ?? process.env.BILANCINO_DATA ?? path.join(root, 'data');
const dbFile = process.env.BILANCIO_DB ?? process.env.BILANCINO_DB ?? path.join(dataDir, 'bilancino.db');
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

// Scheda Banca: come sono smistati i movimenti e come si incrociano con stipendio e bollette.
// Filtri opzionali: ?year=2025&month=3 (anno e/o mese; i grafici mostrano i mesi che corrispondono).
const BILL_KINDS = new Set(['acqua', 'luce', 'gas', 'wifi', 'affitto', 'prestito']);
const pad2 = (n) => String(n).padStart(2, '0');
app.get('/api/analysis', (req, res) => {
  const year = Number(req.query.year) || 0;
  const month = Number(req.query.month) || 0;
  const match = (ym) => (!year || ym.startsWith(`${year}-`)) && (!month || ym.endsWith(`-${pad2(month)}`));
  const round = (n) => Math.round(n * 100) / 100;
  const everything = Object.values(db().transactions ?? {});
  const list = everything.filter((t) => match(t.date.slice(0, 7)));
  // I giroconti (soldi spostati tra i miei conti) non entrano in nessun totale: si vedono solo nella loro tabella.
  const counted = list.filter((t) => t.category !== 'giroconti');
  const transfers = list.filter((t) => t.category === 'giroconti');
  const outflows = counted.filter((t) => t.amount < 0);
  const inflows = counted.filter((t) => t.amount > 0);

  // Raggruppa i movimenti per descrizione (uguali a meno di cifre e punteggiatura).
  const group = (txs) => {
    const map = new Map();
    for (const t of txs) {
      const key = ruleKey(t.description, t.amount) || t.description;
      const m = map.get(key) ?? { id: t.id, name: t.description, positive: t.amount > 0, count: 0, total: 0, from: t.date, last: t.date };
      m.count++;
      m.total += Math.abs(t.amount);
      if (t.date < m.from) m.from = t.date;
      if (t.date > m.last) m.last = t.date;
      map.set(key, m);
    }
    return [...map.values()].map((m) => ({ ...m, total: round(m.total) })).sort((a, b) => b.total - a.total);
  };
  const sum = (txs) => round(txs.reduce((a, t) => a + Math.abs(t.amount), 0));

  // Uscite: totali per categoria e, dentro ogni categoria, per descrizione.
  const spendCategories = CATEGORIES.filter((c) => c !== 'entrate' && c !== 'giroconti');
  const total = outflows.reduce((a, t) => a + Math.abs(t.amount), 0);
  const inCategory = (c) => outflows.filter((t) => (spendCategories.includes(t.category) ? t.category : 'altro') === c);

  // Mese per mese: stipendio e bollette dai documenti, spese correnti come nella tabella, uscite bancarie per categoria e altre entrate.
  const byMonth = new Map();
  const slot = (ym) => {
    if (!byMonth.has(ym)) byMonth.set(ym, { ym, income: 0, otherIncome: 0, bills: 0, spesa: 0, svago: 0, carburante: 0, bank: { spesa: 0, svago: 0, carburante: 0, prestito: 0, donazioni: 0, tasse: 0, altro: 0 } });
    return byMonth.get(ym);
  };
  for (const c of buildCells(db()).values()) {
    if (c.amount == null) continue;
    const m = slot(`${c.year}-${pad2(c.month)}`);
    if (c.kind === 'stipendio') m.income += c.amount;
    else if (BILL_KINDS.has(c.kind)) m.bills += c.amount;
    else if (c.kind === 'spese') m.spesa += c.amount;
    else if (c.kind === 'svago' || c.kind === 'carburante') m[c.kind] += c.amount;
  }
  for (const t of everything) {
    if (t.category === 'giroconti') continue;
    const m = slot(t.date.slice(0, 7));
    if (t.amount < 0) m.bank[spendCategories.includes(t.category) ? t.category : 'altro'] += Math.abs(t.amount);
    else if (t.category === 'entrate') m.otherIncome += t.amount;
  }
  const years = [...new Set([...byMonth.keys()].map((ym) => Number(ym.slice(0, 4))))].sort((a, b) => b - a);
  // Con un anno scelto si mostrano sempre tutti e 12 i mesi, anche quelli ancora senza dati.
  if (year && !month) for (let mo = 1; mo <= 12; mo++) slot(`${year}-${pad2(mo)}`);
  const months = [...byMonth.values()].filter((m) => match(m.ym)).sort((a, b) => a.ym.localeCompare(b.ym)).map((m) => ({
    ...m,
    income: round(m.income), otherIncome: round(m.otherIncome), bills: round(m.bills), spesa: round(m.spesa), svago: round(m.svago), carburante: round(m.carburante),
    bank: Object.fromEntries(Object.entries(m.bank).map(([k, v]) => [k, round(v)])),
  }));

  res.json({
    years, months, total: round(total), count: outflows.length,
    categories: spendCategories.map((k) => {
      const txs = inCategory(k);
      const t = txs.reduce((a, x) => a + Math.abs(x.amount), 0);
      return { category: k, count: txs.length, total: round(t), share: total ? t / total : 0, column: CATEGORY_KIND[k] ?? null, merchants: group(txs) };
    }),
    // Entrate: "entrate" conta come altro denaro ricevuto, "altro" sono giri interni ignorati.
    transfers: { category: 'giroconti', count: transfers.length, total: sum(transfers), merchants: group(transfers) },
    inflows: ['entrate', 'altro'].map((k) => {
      const txs = inflows.filter((t) => (t.category === 'entrate' ? 'entrate' : 'altro') === k);
      return { category: k, count: txs.length, total: sum(txs), merchants: group(txs) };
    }),
  });
});

// Cambia categoria a un movimento e la ricorda per tutti quelli con la stessa descrizione.
app.put('/api/transactions', async (req, res) => {
  const { id, category } = req.body ?? {};
  const t = db().transactions?.[id];
  if (!t) return res.status(404).json({ error: 'Movimento non trovato.' });
  if (!CATEGORIES.includes(category)) return bad(res, 'Categoria non valida.');
  // La scelta vale per tutti i movimenti con la stessa descrizione e lo stesso verso (entrata o uscita).
  const key = ruleKey(t.description, t.amount);
  if (key && key !== 'in:') {
    db().rules[key] = category;
    for (const o of Object.values(db().transactions)) if (ruleKey(o.description, o.amount) === key) o.category = category;
  } else t.category = category;
  await store.save();
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4870);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => console.log(`Bilancio su http://${host}:${port}`));
