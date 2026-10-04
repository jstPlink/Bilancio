import { CATEGORY_KIND } from './statements.js';

// Costruisce la vista aggregata a partire da documenti, movimenti bancari, spunte e importi manuali.

export const KINDS = ['stipendio', 'entrate', 'acqua', 'luce', 'gas', 'wifi', 'affitto', 'prestito', 'spese', 'svago', 'carburante', 'donazioni', 'tasse'];
// Entrate: lo stipendio dalle buste paga e le altre entrate dai movimenti bancari.
export const INCOME_KINDS = new Set(['stipendio', 'entrate']);
export const EXPENSE_KINDS = KINDS.filter((k) => !INCOME_KINDS.has(k));
// Voci che si compilano dai movimenti dell'estratto conto (o a mano, per correggere il totale).
export const SPENDING_KINDS = new Set(['spese', 'svago', 'carburante']);
// Voci senza stato "pagato": le entrate e le spese che vengono dalla banca (comprese tasse e rata del prestito, già addebitate).
export const NO_PAYMENT = new Set([...INCOME_KINDS, ...SPENDING_KINDS, 'donazioni', 'tasse', 'prestito']);

// Le bollette di utenze possono riguardare più case: si distinguono dalla prima cartella del percorso.
// Tutto il resto (stipendio, affitto, spese…) appartiene alla casa di base.
export const PLACES = ['budrio', 'crispiano'];
export const DEFAULT_PLACE = 'budrio';
export const PLACE_KINDS = new Set(['acqua', 'luce', 'gas', 'wifi']);
export const placeOf = (name) => {
  const first = String(name ?? '').split('/')[0].toLowerCase();
  return PLACES.includes(first) ? first : DEFAULT_PLACE;
};

const round = (n) => Math.round(n * 100) / 100;
// La chiave delle spunte "pagato" della casa di base resta quella storica, senza suffisso.
export const cellKey = (kind, year, month, place = DEFAULT_PLACE) => `${kind}|${year}|${month}${place === DEFAULT_PLACE ? '' : `|${place}`}`;

// Un documento vale con i suoi dati automatici, salvo correzioni manuali (`override`).
export function effectiveDoc(doc) {
  const o = doc.override ?? {};
  const set = Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));
  const merged = { ...doc, ...set };
  const complete = merged.kind && merged.year && merged.month && merged.amount != null;
  const status = o.ignore ? 'ignorato' : complete ? 'ok' : 'incompleto';
  return { ...merged, status, edited: Object.keys(set).length > 0 };
}

export function buildCells(db, now = new Date()) {
  const cells = new Map();
  const get = (kind, year, month, place = DEFAULT_PLACE) => {
    const k = cellKey(kind, year, month, place);
    if (!cells.has(k)) cells.set(k, { kind, year, month, place, auto: null, manual: null, files: [] });
    return cells.get(k);
  };
  const billShare = Math.min(100, Math.max(1, Number(db.settings?.billShare ?? 50))) / 100;
  const docPlace = (d) => (PLACE_KINDS.has(d.kind) ? placeOf(d.name) : DEFAULT_PLACE);

  // Una cella = un documento: se esiste un file col mese nel nome (es. "Acqua 2025.10.pdf"),
  // le copie senza quel nome (es. scaricate dal fornitore) non vengono sommate.
  const docs = Object.entries(db.docs).map(([key, raw]) => [key, effectiveDoc(raw)]).filter(([, d]) => d.status === 'ok' && KINDS.includes(d.kind));
  const namedCells = new Set(docs.filter(([, d]) => d.named).map(([, d]) => cellKey(d.kind, d.year, d.month, docPlace(d))));
  for (const [key, d] of docs) {
    const place = docPlace(d);
    if (!d.named && namedCells.has(cellKey(d.kind, d.year, d.month, place))) continue;
    const c = get(d.kind, d.year, d.month, place);
    // Acqua, luce, gas e wifi si dividono con chi convive: conta la quota dell'utente (Impostazioni → Bollette, di norma 50%).
    c.auto = round((c.auto ?? 0) + d.amount * (PLACE_KINDS.has(d.kind) ? billShare : 1));
    c.files.push({ key, name: d.name });
  }

  // Affitto: importo fisso mensile dalla data di inizio fino al mese corrente. (La rata del prestito invece si legge dagli estratti conto.)
  const fixed = [
    ['affitto', db.settings.rentAmount, db.settings.rentFrom],
  ];
  for (const [kind, amount, from] of fixed) {
    const start = /^(\d{4})-(\d{2})$/.exec(from ?? '');
    if (!(amount > 0) || !start) continue;
    let y = +start[1];
    let mo = +start[2];
    while (y < now.getFullYear() || (y === now.getFullYear() && mo <= now.getMonth() + 1)) {
      const c = get(kind, y, mo);
      c.auto ??= Number(amount);
      if (++mo > 12) { mo = 1; y++; }
    }
  }

  // Movimenti dell'estratto conto: sommati per mese nella colonna della loro categoria.
  for (const t of Object.values(db.transactions ?? {})) {
    const kind = CATEGORY_KIND[t.category];
    const m = /^(\d{4})-(\d{2})/.exec(t.date);
    if (!kind || !m) continue;
    const c = get(kind, +m[1], +m[2]);
    // Le uscite hanno importo negativo; un rimborso (positivo) riduce la spesa. Le entrate si sommano.
    c.auto = round((c.auto ?? 0) + (kind === 'entrate' ? t.amount : -t.amount));
  }

  for (const [k, amount] of Object.entries(db.manual)) {
    const [kind, y, mo] = k.split('|');
    if (SPENDING_KINDS.has(kind)) get(kind, +y, +mo).manual = amount;
  }

  for (const c of cells.values()) {
    c.amount = c.manual ?? c.auto;
    c.paid = NO_PAYMENT.has(c.kind) ? null : Boolean(db.paid[cellKey(c.kind, c.year, c.month, c.place)]);
  }
  return cells;
}

const avg = (xs) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const sum = (xs) => round(xs.reduce((a, b) => a + b, 0));

// Luce e gas hanno una colonna per casa (ognuna col suo documento e la sua spunta "pagato");
// le altre voci, acqua e wifi compresi, sommano le case e mostrano il dettaglio nella cella.
export const SPLIT_KINDS = new Set(['luce', 'gas']);
export const COLUMNS = KINDS.flatMap((kind) => (SPLIT_KINDS.has(kind)
  ? PLACES.map((place) => ({ id: `${kind}:${place}`, kind, place }))
  : [{ id: kind, kind, place: null }]));

export function buildGrid(db, year, now = new Date()) {
  const cells = buildCells(db, now);
  const all = [...cells.values()].filter((c) => c.amount != null);
  const belongs = (col) => (c) => c.kind === col.kind && (col.place === null || c.place === col.place);

  const years = [...new Set(all.map((c) => c.year))];
  if (!years.includes(now.getFullYear())) years.push(now.getFullYear());
  years.sort((a, b) => b - a);

  const rows = [];
  for (let month = 1; month <= 12; month++) {
    const row = { month, cells: {} };
    const ofMonth = PLACES.flatMap((p) => KINDS.map((k) => cells.get(cellKey(k, year, month, p)))).filter(Boolean);
    for (const col of COLUMNS) {
      const mine = ofMonth.filter(belongs(col));
      const withAmount = mine.filter((c) => c.amount != null);
      row.cells[col.id] = {
        amount: withAmount.length ? sum(withAmount.map((c) => c.amount)) : null,
        auto: mine.length === 1 ? mine[0].auto : null,
        manual: mine.length === 1 ? mine[0].manual : null,
        paid: NO_PAYMENT.has(col.kind) ? null : withAmount.length > 0 && withAmount.every((c) => c.paid),
        files: mine.flatMap((c) => c.files),
        // Le parti pagabili (una per casa con un importo): servono a segnare pagato e a mostrare il dettaglio.
        parts: withAmount.map((c) => ({ kind: c.kind, place: c.place, amount: c.amount, paid: c.paid })),
      };
    }
    const spent = sum(ofMonth.filter((c) => !INCOME_KINDS.has(c.kind) && c.amount != null).map((c) => c.amount));
    // Entrate del mese: stipendio più altre entrate dalla banca.
    const incomes = ofMonth.filter((c) => INCOME_KINDS.has(c.kind) && c.amount != null);
    const earned = incomes.length ? sum(incomes.map((c) => c.amount)) : null;
    row.income = earned;
    row.spent = spent || null;
    row.balance = earned != null ? round(earned - spent) : null;
    rows.push(row);
  }

  const inYear = all.filter((c) => c.year === year);
  const summary = { average: {}, toPay: {}, yearTotal: {}, toPayAll: {} };
  for (const col of COLUMNS) {
    const monthly = rows.map((r) => r.cells[col.id].amount).filter((a) => a != null);
    summary.average[col.id] = avg(monthly);
    summary.yearTotal[col.id] = sum(monthly);
    summary.toPay[col.id] = NO_PAYMENT.has(col.kind) ? null : sum(all.filter(belongs(col)).filter((c) => !c.paid).map((c) => c.amount));
  }
  for (const kind of KINDS) {
    summary.toPayAll[kind] = NO_PAYMENT.has(kind) ? null : sum(all.filter((c) => c.kind === kind && !c.paid).map((c) => c.amount));
  }
  summary.totalToPay = sum(EXPENSE_KINDS.map((k) => summary.toPayAll[k] ?? 0));

  const expenses = inYear.filter((c) => !INCOME_KINDS.has(c.kind));
  const spendMonths = new Set(expenses.map((c) => c.month));
  summary.avgIncome = avg(rows.map((r) => r.income).filter((a) => a != null));
  summary.avgSpent = spendMonths.size ? round(sum(expenses.map((c) => c.amount)) / spendMonths.size) : null;
  summary.avgBalance = summary.avgIncome != null && summary.avgSpent != null
    ? round(summary.avgIncome - summary.avgSpent) : null;

  return { year, years, columns: COLUMNS, rows, summary };
}
