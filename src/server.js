import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { buildCells, buildGrid, cellKey, DEFAULT_PLACE, effectiveDoc, KINDS, NO_PAYMENT, PLACES, PLACE_KINDS, SPENDING_KINDS } from './grid.js';
import { CATEGORIES, CATEGORY_KIND, NOT_COUNTED, ruleKey, parseStatement, setIdentity, addOrEnrich } from './statements.js';
import { matchBillPayments } from './billmatch.js';
import { createAuth } from './auth.js';
import { refresh, progress, readPdfDocument, isUploadKey } from './scanner.js';
import { createOcr } from './ocr.js';
import { parsePdfStatement } from './pdfstatements.js';
import { parseUploadRequest, uploadedDocName, isPdf } from './uploads.js';
import { randomUUID } from 'node:crypto';
import { learnIdentity } from './identity.js';
import { BANKS, bankingState, checkKey, createClient as bankClient, finishLink, normalizeKey, publicState as bankingPublic, readBankData, startLink, syncAll, syncConnection } from './banking.js';
import { buildExplore } from './bankexplorer.js';
import { classifySource, openTarget } from './sources.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.BILANCIO_DATA ?? process.env.BILANCINO_DATA ?? path.join(root, 'data');
const dbFile = process.env.BILANCIO_DB ?? process.env.BILANCINO_DB ?? path.join(dataDir, 'bilancino.db');
const store = createStore(dbFile, { legacyJson: path.join(dataDir, 'db.json') });
store.load();
setIdentity(store.data.settings);
// Abbina gli addebiti delle utenze alle bollette già lette (una tantum all'avvio, poi a ogni aggiornamento).
if (matchBillPayments(store.data)) store.save();
// Nome del titolare e datore di lavoro si ricavano dai dati (buste paga e movimenti): non vanno scritti a mano.
const learn = () => { try { return learnIdentity(store.data); } catch { return null; } };
if (learn()?.changed) store.save();

const app = express();
const auth = createAuth({
  envPassword: process.env.BILANCIO_PASSWORD,
  getRecord: () => store.data.auth,
  saveRecord: (record) => { store.data.auth = record; store.save(); },
});
app.use(express.json());
auth.mount(app); // l'app è sempre protetta: tutto, tranne la pagina /login, richiede la password
app.use('/api/statements', express.text({ type: '*/*', limit: '20mb' }));
app.use('/api/upload', express.raw({ type: '*/*', limit: '40mb' }));
app.use(express.static(path.join(root, 'public')));

const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

const uploadsDir = path.join(path.dirname(dbFile), 'uploads');
const db = () => store.data;
const bad = (res, message) => res.status(400).json({ error: message });
const validCell = ({ kind, year, month }) => KINDS.includes(kind) && Number.isInteger(year) && month >= 1 && month <= 12;

app.get('/api/version', (req, res) => res.json({ version, protected: auth.hasPassword() }));

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
  for (const key of ['ownNames', 'incomePayers']) if (typeof b[key] === 'string') s[key] = b[key].trim().slice(0, 300);
  setIdentity(s);
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
    report.matched = matchBillPayments(db());
    learn();
    // Banche collegate: l'aggiornamento automatico non ripete la lettura se è recente (le banche concedono 4 accessi al giorno).
    const bank = bankingState(db());
    if (bank.app && bank.connections.length) {
      const r = await syncAll({ client: bankClient(bank.app), db: db(), minAgeMs: 3 * 3600 * 1000 });
      report.bankTransactions = r.added;
      report.errors.push(...r.errors);
      learn();
    }
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
  if (isUploadKey(key)) {
    const file = key.slice('upload:'.length);
    if (!/^[\w-]+\.pdf$/.test(file)) return res.status(404).send('File non trovato.');
    return res.sendFile(path.join(uploadsDir, file), (err) => err && !res.headersSent && res.status(404).send('File non trovato.'));
  }
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
  for (const t of items) if (addOrEnrich(all, t) === 'added') added++;
  await store.save();
  res.json({ found: items.length, added, duplicates: items.length - added });
});

// Carica un documento dall'app: il file arriva nel corpo, il resto (tipo, nome, utenza, casa) nella query.
// Estratto conto (CSV o PDF): aggiunge i movimenti. Bolletta o busta paga (PDF): si conserva il file e se ne legge importo e periodo.
app.post('/api/upload', async (req, res) => {
  let info;
  try { info = parseUploadRequest(req.query); } catch (e) { return bad(res, e.message); }
  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || !buffer.length) return bad(res, 'Nessun file ricevuto.');
  try {
    if (info.type === 'estratto') {
      let items;
      let check;
      if (isPdf(buffer)) ({ items, check } = await parsePdfStatement(buffer, db().rules));
      else items = parseStatement(buffer.toString('utf8'), db().rules);
      const all = (db().transactions ??= {});
      let added = 0;
      for (const t of items) if (addOrEnrich(all, t, info.name) === 'added') added++;
      learn();
      await store.save();
      const warning = check && (Math.abs(check.parsedOut - check.statedOut) > 0.005 || Math.abs(check.parsedIn - check.statedIn) > 0.005)
        ? `le uscite lette (${check.parsedOut}) non tornano col riepilogo della banca (${check.statedOut})` : undefined;
      return res.json({ type: 'estratto', found: items.length, added, duplicates: items.length - added, warning });
    }
    if (!isPdf(buffer)) return bad(res, 'Le bollette e le buste paga devono essere file PDF.');
    const tag = info.type === 'busta' ? 'busta' : 'bolletta';
    const name = uploadedDocName(info);
    const ocr = createOcr({ cacheDir: path.join(path.dirname(dbFile), 'tessdata'), size: 1 });
    let read;
    try { read = await readPdfDocument(buffer, { name, tag, modified: new Date(), ocr }); } finally { await ocr.close(); }
    const id = `${randomUUID()}.pdf`;
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, id), buffer);
    const { parsed } = read;
    // Il tipo di bolletta lo ha scelto chi carica: vale più di quello che il lettore deduce dal testo.
    const kind = info.type === 'bolletta' ? info.kind : parsed.kind;
    const missing = parsed.missing.filter((m) => m !== 'tipo' || !kind);
    const key = `upload:${id}`;
    db().docs[key] = {
      name, version: `upload-${Date.now()}`, source: tag, kind: kind ?? null, year: parsed.year ?? null, month: parsed.month ?? null,
      amount: parsed.amount ?? null, status: missing.length ? 'incompleto' : 'ok', missing, ocr: read.ocr, named: parsed.named ?? false,
      text: read.text.slice(0, 12000), readAt: new Date().toISOString(), uploaded: true,
    };
    learn();
    await store.save();
    const d = effectiveDoc(db().docs[key]);
    res.json({ type: info.type, doc: { key, name, kind: d.kind, year: d.year, month: d.month, amount: d.amount, status: d.status, missing } });
  } catch (e) {
    bad(res, e.message);
  }
});

// ------------------------------------------------------------------ banche collegate (Enable Banking)

const originOf = (req) => `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
const bankUi = (req) => ({ ...bankingPublic(db()), redirectUrl: `${originOf(req)}/api/banking/callback` });
const bankApp = () => {
  const a = bankingState(db()).app;
  if (!a?.appId || !a?.privateKey) throw new Error('Inserisci prima ID e chiave privata dell\'applicazione Enable Banking.');
  return a;
};

app.get('/api/banking', (req, res) => res.json(bankUi(req)));

// Credenziali dell'applicazione Enable Banking: la chiave resta sul server e non viene mai rimandata all'interfaccia.
app.put('/api/banking/app', async (req, res) => {
  const { appId, privateKey, clear } = req.body ?? {};
  const b = bankingState(db());
  if (clear) { b.app = null; await store.save(); return res.json(bankUi(req)); }
  const id = String(appId ?? '').trim();
  if (!id) return bad(res, 'Scrivi l\'ID dell\'applicazione.');
  const key = privateKey ? normalizeKey(privateKey) : b.app?.privateKey;
  if (!key) return bad(res, 'Incolla la chiave privata (file .pem).');
  try { checkKey(key); } catch (e) { return bad(res, e.message); }
  b.app = { appId: id, privateKey: key };
  await store.save();
  res.json(bankUi(req));
});

// 1) l'utente sceglie la banca: si restituisce l'indirizzo dove autorizzare l'accesso in sola lettura.
app.post('/api/banking/connect', async (req, res) => {
  try {
    if (!BANKS[req.body?.bank]) return bad(res, 'Banca non prevista.');
    const url = await startLink({ client: bankClient(bankApp()), db: db(), bank: req.body.bank, redirectUrl: `${originOf(req)}/api/banking/callback` });
    await store.save();
    res.json({ url });
  } catch (e) { bad(res, e.message); }
});

// 2) la banca rimanda qui (senza sessione dell'app: la richiesta è riconosciuta dal codice «state» creato al punto 1).
const page = (title, text) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bilancio</title><style>body{font:16px system-ui,sans-serif;max-width:30rem;margin:15vh auto;padding:0 1.2rem;color:#14201d}h1{font-size:1.3rem}</style></head><body><h1>${title}</h1><p>${text}</p></body></html>`;
const html = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
app.get('/api/banking/callback', async (req, res) => {
  const { code, state, error } = req.query;
  res.set('Content-Type', 'text/html; charset=utf-8');
  if (error || !code || !state) return res.status(400).send(page('Collegamento non riuscito', `La banca ha risposto: ${html(req.query.error_description ?? error ?? 'richiesta incompleta')}. Torna a Bilancio e riprova dalle Impostazioni.`));
  try {
    const client = bankClient(bankApp());
    const conn = await finishLink({ client, db: db(), code: String(code), state: String(state) });
    let note = '';
    try {
      const r = await syncConnection({ client, db: db(), conn });
      note = ` Ho letto ${r.found} movimenti (${r.added} nuovi).`;
      learn();
    } catch (e) { note = ` I movimenti si leggeranno al prossimo aggiornamento (${html(e.message)}).`; }
    await store.save();
    res.send(page('Banca collegata ✓', `${html(BANKS[conn.bank].label)} è collegata in sola lettura.${note} Puoi chiudere questa pagina e tornare a Bilancio.`));
  } catch (e) {
    res.status(400).send(page('Collegamento non riuscito', `${html(e.message)} Torna a Bilancio e riprova dalle Impostazioni.`));
  }
});

// Lettura manuale dei movimenti di una banca (o di tutte).
app.post('/api/banking/sync', async (req, res) => {
  try {
    const client = bankClient(bankApp());
    const total = { found: 0, added: 0, duplicates: 0 };
    const targets = bankingState(db()).connections.filter((c) => !req.body?.id || c.id === req.body.id);
    if (!targets.length) return bad(res, 'Nessuna banca collegata.');
    for (const conn of targets) {
      const r = await syncConnection({ client, db: db(), conn });
      total.found += r.found; total.added += r.added; total.duplicates += r.duplicates;
    }
    learn();
    await store.save();
    res.json({ ...total, ...bankUi(req) });
  } catch (e) { await store.save(); bad(res, e.message); }
});

// Scheda «Banche»: i dati originali delle banche, in una copia separata che non entra in Panoramica, Movimenti né Statistiche.
app.get('/api/banking/explore', (req, res) => res.json(buildExplore(db())));

// Legge dalla banca (una o tutte) e aggiorna la copia. Conta come una lettura del limite giornaliero.
app.post('/api/banking/explore/read', async (req, res) => {
  try {
    const client = bankClient(bankApp());
    const targets = bankingState(db()).connections.filter((c) => !req.body?.id || c.id === req.body.id);
    if (!targets.length) return bad(res, 'Nessuna banca collegata.');
    const errors = [];
    for (const conn of targets) {
      try { await readBankData({ client, db: db(), conn }); } catch (e) { errors.push(`${BANKS[conn.bank]?.label ?? conn.bank}: ${e.message}`); }
    }
    await store.save();
    res.json({ ...buildExplore(db()), errors });
  } catch (e) { bad(res, e.message); }
});

app.delete('/api/banking/connections/:id', async (req, res) => {
  const b = bankingState(db());
  const conn = b.connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: 'Collegamento non trovato.' });
  try { if (b.app) await bankClient(b.app).deleteSession(conn.id); } catch { /* il consenso scade comunque da solo */ }
  b.connections = b.connections.filter((c) => c !== conn);
  delete b.snapshots?.[conn.id];
  await store.save();
  res.json(bankUi(req));
});


app.get('/api/transactions', (req, res) => {
  const year = Number(req.query.year);
  const list = Object.values(db().transactions ?? {}).filter((t) => !year || t.date.startsWith(`${year}-`));
  list.sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
  res.json({ categories: CATEGORIES, transactions: list });
});

// Schede Movimenti e Statistiche: come sono smistati i movimenti e come si incrociano con stipendio e bollette.
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
  // I giroconti (soldi tra i miei conti) e le bollette già contate nei documenti non entrano in nessun totale: si vedono solo nelle loro tabelle.
  const counted = list.filter((t) => !NOT_COUNTED.has(t.category));
  const outflows = counted.filter((t) => t.amount < 0);
  const inflows = counted.filter((t) => t.amount > 0);

  // Raggruppa i movimenti per descrizione (uguali a meno di cifre e punteggiatura).
  const group = (txs) => {
    const map = new Map();
    for (const t of txs) {
      const key = ruleKey(t.description, t.amount) || t.description;
      const m = map.get(key) ?? { id: t.id, name: t.description, positive: t.amount > 0, doc: t.matchedDoc, count: 0, total: 0, from: t.date, last: t.date };
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
  const spendCategories = CATEGORIES.filter((c) => c !== 'entrate' && !NOT_COUNTED.has(c));
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
    if (NOT_COUNTED.has(t.category)) continue;
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
    excluded: [...NOT_COUNTED].map((k) => {
      const txs = list.filter((t) => t.category === k);
      return { category: k, count: txs.length, total: sum(txs), merchants: group(txs) };
    }),
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
    for (const o of Object.values(db().transactions)) if (ruleKey(o.description, o.amount) === key) { o.category = category; o.manual = true; }
  } else { t.category = category; t.manual = true; }
  await store.save();
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4870);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => {
  console.log(`Bilancio su http://${host}:${port}`);
  if (auth.usesEnv) {
    console.log('Accesso protetto da password (BILANCIO_PASSWORD).');
    if (process.env.BILANCIO_PASSWORD.length < 8) console.warn('ATTENZIONE: la password è molto corta, usane una più lunga.');
  } else if (auth.hasPassword()) console.log('Accesso protetto da password.');
  else {
    console.log('PRIMA CONFIGURAZIONE: apri il sito e crea subito la password (finché non esiste, chiunque apra il sito può sceglierla).');
  }
});
