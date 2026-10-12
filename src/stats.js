// Cifre dell'app: storico dell'anno (entrate, uscite, bilancio per mese), budget del mese e dati del widget.
import { accountNames, classify, BUDGET_TAGS, TAGS } from './tags.js';
import { localParts } from './schedule.js';

const round = (n) => Math.round(n * 100) / 100;

/** Entrate, uscite e bilancio di ogni mese dell'anno. I giroconti non contano; le uscite sono cifre positive. */
export function yearSummary(db, year) {
  const tags = classify(db);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, entrate: 0, uscite: 0, bilancio: 0, tags: {} }));
  for (const t of Object.values(db.transactions)) {
    if (Number(t.date.slice(0, 4)) !== year) continue;
    const tag = tags.get(t.id);
    if (tag === 'giroconto') continue;
    const m = months[Number(t.date.slice(5, 7)) - 1];
    if (t.amount > 0) m.entrate += t.amount;
    else { m.uscite -= t.amount; m.tags[tag] = (m.tags[tag] ?? 0) + -t.amount; }
  }
  const total = { entrate: 0, uscite: 0, bilancio: 0 };
  for (const m of months) {
    m.entrate = round(m.entrate); m.uscite = round(m.uscite); m.bilancio = round(m.entrate - m.uscite);
    for (const k of Object.keys(m.tags)) m.tags[k] = round(m.tags[k]);
    total.entrate += m.entrate; total.uscite += m.uscite;
  }
  total.entrate = round(total.entrate); total.uscite = round(total.uscite); total.bilancio = round(total.entrate - total.uscite);
  const years = [...new Set(Object.values(db.transactions).map((t) => Number(t.date.slice(0, 4))))].sort((a, b) => b - a);
  return { year, months, total, years };
}

/** I movimenti con il loro tag, dal più recente, con i filtri della scheda Movimenti. */
export function listTransactions(db, { year, month, tag, q, account } = {}) {
  const tags = classify(db);
  const needle = String(q ?? '').trim().toLowerCase();
  const names = accountNames(db);
  const out = [];
  for (const t of Object.values(db.transactions)) {
    if (year && Number(t.date.slice(0, 4)) !== year) continue;
    if (month && Number(t.date.slice(5, 7)) !== month) continue;
    if (account && t.account !== account) continue;
    const tg = tags.get(t.id);
    if (tag && tg !== tag) continue;
    if (needle && !`${t.description} ${t.remittance ?? ''} ${t.amount}`.toLowerCase().includes(needle)) continue;
    out.push({ ...t, tag: tg, manual: Boolean(db.overrides[t.id]), accountName: names.get(t.account)?.name ?? '' });
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return out;
}

/**
 * Il mese in corso per le tre categorie con budget: speso, residuo (budget − speso), spesa giornaliera stimata (budget diviso i giorni
 * del mese) e reale (speso diviso i giorni passati, oggi compreso).
 */
export function monthBudget(db, now = new Date()) {
  const p = localParts(now);
  const tags = classify(db);
  const prefix = p.iso.slice(0, 7);
  const spent = Object.fromEntries(BUDGET_TAGS.map((k) => [k, 0]));
  for (const t of Object.values(db.transactions)) {
    if (t.amount >= 0 || !t.date.startsWith(prefix)) continue;
    const tag = tags.get(t.id);
    if (tag in spent) spent[tag] += -t.amount;
  }
  const cats = {};
  for (const k of BUDGET_TAGS) {
    const budget = Number(db.settings.budgets?.[k]) || 0;
    cats[k] = {
      label: TAGS[k], budget, spent: round(spent[k]), left: round(budget - spent[k]),
      estDaily: budget > 0 ? round(budget / p.daysInMonth) : null, realDaily: round(spent[k] / p.day),
    };
  }
  return { year: p.year, month: p.month, day: p.day, daysInMonth: p.daysInMonth, cats };
}

/** Dati per il widget: il mese (con le domeniche), l'ultimo aggiornamento della banca e le tre categorie. */
export function widgetData(db, now = new Date()) {
  const b = monthBudget(db, now);
  const sundays = [];
  for (let d = 1; d <= b.daysInMonth; d++) if (new Date(Date.UTC(b.year, b.month - 1, d)).getUTCDay() === 0) sundays.push(d);
  const lastSync = db.banking.connections.map((c) => c.lastSync).filter(Boolean).sort().at(-1) ?? null;
  return { ...b, daysLeft: b.daysInMonth - b.day, sundays, lastSync, now: now.toISOString() };
}

/**
 * Statistiche di spesa di un anno (e, se si sceglie, di un mese): quanto va in ogni categoria con la sua quota, mese per mese per categoria
 * (sempre tutto l'anno, per il grafico) e dove vanno i soldi (le controparti che pesano di più). Contano solo le uscite; giroconti e
 * entrate no.
 */
export function spendStats(db, { year, month = 0 } = {}) {
  const tags = classify(db);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, tags: {} }));
  const byTag = new Map();
  const parties = new Map();
  let total = 0;
  let count = 0;
  const years = new Set();
  for (const t of Object.values(db.transactions)) {
    const tag = tags.get(t.id);
    if (t.amount >= 0 || tag === 'giroconto' || tag === 'entrata') continue;
    const y = Number(t.date.slice(0, 4));
    years.add(y);
    if (year && y !== year) continue;
    const m = Number(t.date.slice(5, 7));
    const v = -t.amount;
    months[m - 1].total += v;
    months[m - 1].tags[tag] = (months[m - 1].tags[tag] ?? 0) + v;
    if (month && m !== month) continue;
    total += v;
    count++;
    const e = byTag.get(tag) ?? { tag, label: TAGS[tag], total: 0, count: 0 };
    e.total += v; e.count++;
    byTag.set(tag, e);
    const name = (t.party || t.description || 'Senza nome').trim();
    const key = name.toLowerCase();
    const p = parties.get(key) ?? { name, total: 0, count: 0 };
    p.total += v; p.count++;
    parties.set(key, p);
  }
  const rank = (a, b) => b.total - a.total;
  return {
    year, month,
    total: round(total), count, average: count ? round(total / count) : 0,
    byTag: [...byTag.values()].sort(rank).map((e) => ({ ...e, total: round(e.total), share: total ? Math.round((e.total / total) * 1000) / 10 : 0 })),
    months: months.map((m) => ({ month: m.month, total: round(m.total), tags: Object.fromEntries(Object.entries(m.tags).map(([k, v]) => [k, round(v)])) })),
    top: [...parties.values()].sort(rank).slice(0, 8).map((p) => ({ ...p, total: round(p.total), share: total ? Math.round((p.total / total) * 1000) / 10 : 0 })),
    years: [...years].sort((a, b) => b - a),
  };
}
