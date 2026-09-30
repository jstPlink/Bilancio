import { CATEGORY_KIND } from './statements.js';

// Costruisce la vista aggregata a partire da documenti, movimenti bancari, spunte e importi manuali.

export const KINDS = ['stipendio', 'acqua', 'luce', 'gas', 'wifi', 'affitto', 'prestito', 'spese', 'svago', 'carburante'];
export const EXPENSE_KINDS = KINDS.filter((k) => k !== 'stipendio');
// Voci che si compilano dai movimenti dell'estratto conto (o a mano, per correggere il totale).
export const SPENDING_KINDS = new Set(['spese', 'svago', 'carburante']);
// Voci senza stato "pagato": l'entrata e le spese correnti.
export const NO_PAYMENT = new Set(['stipendio', ...SPENDING_KINDS]);
const round = (n) => Math.round(n * 100) / 100;
export const cellKey = (kind, year, month) => `${kind}|${year}|${month}`;

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
  const get = (kind, year, month) => {
    const k = cellKey(kind, year, month);
    if (!cells.has(k)) cells.set(k, { kind, year, month, auto: null, manual: null, files: [] });
    return cells.get(k);
  };

  // Una cella = un documento: se esiste un file col mese nel nome (es. "Acqua 2025.10.pdf"),
  // le copie senza quel nome (es. scaricate dal fornitore) non vengono sommate.
  const docs = Object.entries(db.docs).map(([key, raw]) => [key, effectiveDoc(raw)]).filter(([, d]) => d.status === 'ok' && KINDS.includes(d.kind));
  const namedCells = new Set(docs.filter(([, d]) => d.named).map(([, d]) => cellKey(d.kind, d.year, d.month)));
  for (const [key, d] of docs) {
    if (!d.named && namedCells.has(cellKey(d.kind, d.year, d.month))) continue;
    const c = get(d.kind, d.year, d.month);
    c.auto = round((c.auto ?? 0) + d.amount);
    c.files.push({ key, name: d.name });
  }

  // Affitto e prestito: importo fisso mensile dalla data di inizio fino al mese corrente.
  const fixed = [
    ['affitto', db.settings.rentAmount, db.settings.rentFrom],
    ['prestito', db.settings.loanAmount, db.settings.loanFrom],
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
    c.auto = round((c.auto ?? 0) + Math.abs(t.amount));
  }

  for (const [k, amount] of Object.entries(db.manual)) {
    const [kind, y, mo] = k.split('|');
    if (SPENDING_KINDS.has(kind)) get(kind, +y, +mo).manual = amount;
  }

  for (const c of cells.values()) {
    c.amount = c.manual ?? c.auto;
    c.paid = NO_PAYMENT.has(c.kind) ? null : Boolean(db.paid[cellKey(c.kind, c.year, c.month)]);
  }
  return cells;
}

const avg = (xs) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const sum = (xs) => round(xs.reduce((a, b) => a + b, 0));

export function buildGrid(db, year, now = new Date()) {
  const cells = buildCells(db, now);
  const all = [...cells.values()].filter((c) => c.amount != null);

  const years = [...new Set(all.map((c) => c.year))];
  if (!years.includes(now.getFullYear())) years.push(now.getFullYear());
  years.sort((a, b) => b - a);

  const rows = [];
  for (let month = 1; month <= 12; month++) {
    const row = { month, cells: {} };
    for (const kind of KINDS) {
      const c = cells.get(cellKey(kind, year, month));
      row.cells[kind] = c
        ? { amount: c.amount ?? null, auto: c.auto, manual: c.manual, paid: c.paid, files: c.files }
        : { amount: null, auto: null, manual: null, paid: NO_PAYMENT.has(kind) ? null : false, files: [] };
    }
    const spent = sum(EXPENSE_KINDS.map((k) => row.cells[k].amount ?? 0));
    const earned = row.cells.stipendio.amount;
    row.spent = spent || null;
    row.balance = earned != null ? round(earned - spent) : null;
    rows.push(row);
  }

  const inYear = all.filter((c) => c.year === year);
  const summary = { average: {}, toPay: {}, yearTotal: {} };
  for (const kind of KINDS) {
    const mine = inYear.filter((c) => c.kind === kind);
    summary.average[kind] = avg(mine.map((c) => c.amount));
    summary.yearTotal[kind] = sum(mine.map((c) => c.amount));
    summary.toPay[kind] = NO_PAYMENT.has(kind)
      ? null
      : sum(all.filter((c) => c.kind === kind && !c.paid).map((c) => c.amount));
  }
  summary.totalToPay = sum(EXPENSE_KINDS.map((k) => summary.toPay[k] ?? 0));

  const expenses = inYear.filter((c) => c.kind !== 'stipendio');
  const spendMonths = new Set(expenses.map((c) => c.month));
  summary.avgIncome = avg(inYear.filter((c) => c.kind === 'stipendio').map((c) => c.amount));
  summary.avgSpent = spendMonths.size ? round(sum(expenses.map((c) => c.amount)) / spendMonths.size) : null;
  summary.avgBalance = summary.avgIncome != null && summary.avgSpent != null
    ? round(summary.avgIncome - summary.avgSpent) : null;

  return { year, years, rows, summary };
}
