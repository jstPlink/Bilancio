import { monthChart, hBars, monthLong } from './charts.js';

const KINDS = [
  { id: 'stipendio', label: 'Stipendio' },
  { id: 'acqua', label: 'Acqua' },
  { id: 'luce', label: 'Luce' },
  { id: 'gas', label: 'Gas' },
  { id: 'wifi', label: 'Wifi' },
  { id: 'affitto', label: 'Affitto' },
  { id: 'prestito', label: 'Prestito' },
  { id: 'spese', label: 'Spese' },
  { id: 'svago', label: 'Svago' },
  { id: 'carburante', label: 'Carburante' },
  { id: 'entrate', label: 'Altre entrate' },
  { id: 'donazioni', label: 'Donazioni' },
  { id: 'tasse', label: 'Tasse' },
];
// Tipi che si assegnano a un documento (le altre voci vengono dalla banca).
const DOC_KINDS = KINDS.filter((k) => !['entrate', 'donazioni', 'tasse'].includes(k.id));
const INCOME = new Set(['stipendio', 'entrate']);
const EXPENSES = KINDS.filter((k) => !INCOME.has(k.id));
// Voci senza stato "pagato": lo stipendio (entrata) e le spese correnti, che arrivano dall'estratto conto.
const SPENDING = new Set(['spese', 'svago', 'carburante']);
const NO_PAYMENT = new Set([...INCOME, ...SPENDING, 'donazioni', 'tasse', 'prestito']);
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => (n == null ? '' : eur.format(n));
// "1.234,56" e "1234.56" sono entrambi validi; vuoto o illeggibile → null.
const parseInput = (text) => {
  const t = String(text).trim().replace(/[€\s]/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};
const inputValue = (n) => (n == null ? '' : String(n).replace('.', ','));

const PLACE_LABELS = { tutte: 'Tutte', budrio: 'Budrio', crispiano: 'Crispiano' };
const state = { year: new Date().getFullYear(), grid: null, docs: [], settings: null };

async function api(path, options) {
  const res = await fetch(path, options && {
    ...options,
    headers: options.headers ?? { 'Content-Type': 'application/json' },
    body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
  return data;
}

let toastTimer;
function toast(message, ms = 4500) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------------------------------------------------------------- panoramica

async function loadGrid() {
  state.grid = await api(`/api/grid?year=${state.year}`);
  if (!state.grid.years.includes(state.year)) state.year = state.grid.years[0];
  renderYears();
  renderCards();
  renderGrid();
  $('#lastRefresh').textContent = state.grid.lastRefresh
    ? `Aggiornato ${new Date(state.grid.lastRefresh).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Mai aggiornato';
}

function renderYears() {
  $('#years').innerHTML = state.grid.years
    .map((y) => `<button data-year="${y}" aria-pressed="${y === state.year}">${y}</button>`).join('');
}

function renderCards() {
  const s = state.grid.summary;
  const card = (k, v, sub = '', cls = '') => `<div class="card ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="sub">${sub}</div></div>`;
  const dueParts = EXPENSES.filter((k) => s.toPayAll[k.id] > 0).map((k) => k.label).join(', ');
  $('#cards').innerHTML = [
    s.totalToPay > 0
      ? `<button class="card due payall-all" data-payall-everything="1" title="Segna tutto come pagato"><div class="k">Da pagare</div><div class="v">${money(s.totalToPay)}</div><div class="sub">${dueParts} · clic per saldare tutto</div></button>`
      : card('Da pagare', money(0), 'Tutto pagato', 'due'),
    card(`Entrate medie ${state.year}`, money(s.avgIncome) || '—'),
    card('Spese medie al mese', money(s.avgSpent) || '—'),
    card('Risparmio medio al mese', money(s.avgBalance) || '—'),
  ].join('');
}

// I valori delle celle vengono solo dai documenti e dai movimenti bancari (e dalle rate fisse nelle impostazioni):
// qui non si modificano. Fanno eccezione Spesa, Svago e Carburante, che si possono correggere a mano.

// Uscite raggruppate: ogni gruppo è una colonna; "Bollette" si può aprire nelle sue voci (e per casa).
const GROUPS = [
  { id: 'bollette', label: 'Bollette', leaves: ['acqua', 'luce:budrio', 'luce:crispiano', 'gas:budrio', 'gas:crispiano', 'wifi'] },
  { id: 'affitto', label: 'Affitto', leaves: ['affitto'] },
  { id: 'prestito', label: 'Prestito', leaves: ['prestito'] },
  { id: 'spese', label: 'Spesa', leaves: ['spese'] },
  { id: 'svago', label: 'Svago', leaves: ['svago'] },
  { id: 'carburante', label: 'Carburante', leaves: ['carburante'] },
  { id: 'donazioni', label: 'Donazioni', leaves: ['donazioni'] },
  { id: 'tasse', label: 'Tasse', leaves: ['tasse'] },
];
let savedOpen = {};
try { savedOpen = JSON.parse(localStorage.getItem('gridOpen') ?? '{}'); } catch { /* storage non disponibile */ }
state.open = { bollette: false, ...savedOpen };
const saveOpen = () => { try { localStorage.setItem('gridOpen', JSON.stringify(state.open)); } catch { /* storage non disponibile */ } };

const colLabel = (col) => col.label ?? KINDS.find((k) => k.id === col.kind).label;
const colName = (col) => (col.place ? `${colLabel(col)} ${PLACE_LABELS[col.place]}` : colLabel(col));

// Somma di più celle della stessa riga (un gruppo): importo totale, parti pagabili e "pagato" solo se lo sono tutte.
function sumCells(cells) {
  const withAmount = cells.filter((c) => c.amount != null);
  const parts = cells.flatMap((c) => c.parts);
  return {
    amount: withAmount.length ? Math.round(withAmount.reduce((a, c) => a + c.amount, 0) * 100) / 100 : null,
    paid: parts.length > 0 && parts.every((p) => p.paid),
    files: [], parts, manual: null, auto: null,
  };
}

// Le colonne visibili, in base ai gruppi aperti. Ogni colonna sa dare la cella di un mese.
function buildColumns() {
  const { rows, columns: leaves, summary: s } = state.grid;
  const leaf = Object.fromEntries(leaves.map((c) => [c.id, c]));
  const cellOf = (id, month) => rows[month - 1].cells[id];
  const out = [];
  const add = (col) => { out.push(col); return col; };

  add({
    id: 'entrate', kind: 'entrate', label: 'Entrate', top: 'entrate', start: true, plain: true,
    cell: (m) => ({ amount: rows[m - 1].income }),
    tip: (m) => {
      const st = cellOf('stipendio', m).amount;
      const other = cellOf('entrate', m).amount;
      return [st != null ? `Stipendio ${money(st)}` : '', other != null ? `Altre entrate ${money(other)}` : ''].filter(Boolean).join(' · ');
    },
    avg: () => s.avgIncome,
  });

  GROUPS.forEach((g, gi) => {
    const members = g.leaves.map((id) => leaf[id]);
    const isMulti = g.leaves.length > 1;
    const first = members[0];
    const col = isMulti
      ? { id: `g:${g.id}`, kind: g.id, label: g.label, place: null, cell: (m) => sumCells(g.leaves.map((id) => cellOf(id, m))), leafIds: g.leaves, toggle: g.id, isOpen: state.open[g.id] }
      : { ...first, label: first.kind === 'spese' ? 'Spesa' : undefined, cell: (m) => cellOf(first.id, m), leafIds: [first.id] };
    add({ ...col, top: 'uscite', start: gi === 0, colorKey: g.id });
    if (isMulti && state.open[g.id]) {
      for (const l of members) add({ ...l, cell: (m) => cellOf(l.id, m), leafIds: [l.id], top: 'uscite', sub: true });
    }
  });
  add({ id: 'spent', kind: 'spent', label: 'Totale spese', top: 'riepilogo', start: true, plain: true, total: true, cell: (m) => ({ amount: rows[m - 1].spent }), avg: () => s.avgSpent });
  add({ id: 'balance', kind: 'balance', label: 'Saldo', top: 'riepilogo', plain: true, total: true, balance: true, cell: (m) => ({ amount: rows[m - 1].balance }), avg: () => s.avgBalance });

  // Medie e importi da pagare (somma delle voci del gruppo).
  for (const col of out) {
    if (!col.avg) {
      const vals = Array.from({ length: 12 }, (_, i) => col.cell(i + 1).amount).filter((a) => a != null);
      col.average = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : null;
    } else col.average = col.avg();
    col.due = col.leafIds && !NO_PAYMENT.has(col.kind) ? Math.round(col.leafIds.reduce((a, id) => a + (s.toPay[id] ?? 0), 0) * 100) / 100 : 0;
  }
  return out;
}

function cellHtml(col, month, c) {
  const kind = col.kind;
  const label = `${colName(col)} ${MONTHS[month - 1]}`;
  if (col.plain) {
    if (c.amount == null) return '<div class="static blank"><span class="num">–</span></div>';
    const tone = col.balance ? (c.amount >= 0 ? 'pos' : 'neg') : '';
    return `<div class="static ${tone}" ${col.tip ? `title="${esc(col.tip(month))}"` : ''}><span class="num">${money(c.amount)}</span></div>`;
  }
  if (SPENDING.has(kind)) {
    return `<input class="expense-input" inputmode="decimal" data-kind="${kind}" data-month="${month}" value="${inputValue(c.amount)}" placeholder="–" aria-label="${label}">`;
  }
  if (c.amount == null) return '<div class="static blank"><span class="num">–</span></div>';
  if (NO_PAYMENT.has(kind)) return `<div class="static"><span class="num">${money(c.amount)}</span></div>`;
  // L'intera cella è colorata: verde se pagata, rossa se da pagare. Al passaggio del mouse si divide in due:
  // a sinistra si apre il documento, a destra si segna pagato o da pagare.
  const multi = c.files.length > 1;
  const open = c.files.map((f, i) => {
    const tag = PLACE_LABELS[f.name.split('/')[0].toLowerCase()]?.[0] ?? String(i + 1);
    return `<a class="filelink" href="/api/file?key=${encodeURIComponent(f.key)}" target="_blank" rel="noopener" title="Apri ${esc(f.name)}" aria-label="Apri il documento: ${esc(f.name)}">${multi ? tag : 'Apri'}</a>`;
  }).join('');
  // Più voci nella stessa cella (gruppo o più case): il totale e, sotto, il dettaglio.
  const showDetail = c.parts.length > 1 && col.leafIds?.length === 1;
  const detail = showDetail ? c.parts.map((p) => `${PLACE_LABELS[p.place][0]} ${money(p.amount)}`).join(' · ') : '';
  const tip = c.parts.length > 1
    ? c.parts.map((p) => `${KINDS.find((k) => k.id === p.kind)?.label ?? p.kind} ${PLACE_LABELS[p.place]}: ${money(p.amount)} (${p.paid ? 'pagato' : 'da pagare'})`).join(' · ')
    : (c.paid ? 'Pagato' : 'Da pagare');
  return `<div class="pcell ${c.paid ? 'paid' : 'due'}${showDetail ? ' split' : ''}" role="checkbox" aria-checked="${c.paid}" tabindex="0" data-col="${col.id}" data-month="${month}" aria-label="${label}: ${c.paid ? 'pagato' : 'da pagare'}" title="${money(c.amount)} · ${esc(tip)}"><span class="amount"><span class="num">${money(c.amount)}</span>${showDetail ? `<small class="parts">${detail}</small>` : ''}</span>${open ? `<span class="zone zone-open">${open}</span>` : ''}<span class="zone zone-pay${open ? '' : ' wide'}" data-pay="1" title="${c.paid ? 'Segna come da pagare' : 'Segna come pagato'}">${c.paid ? '↺' : '✓'}</span></div>`;
}

async function togglePaid(colId, month) {
  const col = state.colMap[colId];
  const cell = col.cell(month);
  const items = cell.parts.map((p) => ({ kind: p.kind, year: state.year, month, place: p.place, paid: !cell.paid }));
  if (!items.length) return;
  await api('/api/paid', { method: 'POST', body: items });
  await loadGrid();
}

async function saveExpense(input) {
  const amount = parseInput(input.value);
  if (Number.isNaN(amount)) { toast('Importo non valido.'); return loadGrid(); }
  await api('/api/manual', { method: 'POST', body: { kind: input.dataset.kind, year: state.year, month: Number(input.dataset.month), amount } });
  await loadGrid();
}

// Quattro gruppi: mese, entrate, uscite (comprimibili) e riepilogo. Uno spazio ben visibile li separa.
function renderGrid() {
  const { rows } = state.grid;
  const cols = buildColumns();
  state.colMap = Object.fromEntries(cols.map((c) => [c.id, c]));
  const dot = (c) => (c.plain && c.kind !== 'entrate' && c.kind !== 'uscite' ? '' : `<span class="dot" style="background:var(--${c.colorKey ?? c.kind})"></span>`);
  const head = cols.map((c) => {
    const sub = c.place ? `<small class="place">${PLACE_LABELS[c.place]}</small>` : '';
    const name = `${dot(c)}${esc(c.place ? colLabel(c) : c.label ?? colLabel(c))}${sub}`;
    if (c.toggle) {
      return `<th class="toggle-th ${c.start ? 'gstart' : ''}"><button class="gtoggle" data-toggle="${c.toggle}" aria-expanded="${Boolean(c.isOpen)}" title="${c.isOpen ? 'Clic per chiudere' : 'Clic per aprire'} le voci di ${esc(c.label)}"><span class="chev">${c.isOpen ? "▾" : "▸"}</span><span class="tname">${name}</span><small class="toggle-hint">${c.isOpen ? 'chiudi' : 'apri'}</small></button></th>`;
    }
    return `<th class="${c.start ? 'gstart' : ''}${c.sub ? ' subcol' : ''}">${name}</th>`;
  }).join('');
  const body = rows.map((r) => `<tr><th scope="row">${MONTHS[r.month - 1]}</th>${cols.map((c) => `<td class="num ${c.start ? 'gstart' : ''}${c.sub ? ' subcol' : ''}${c.total ? ' total' : ''}">${cellHtml(c, r.month, c.cell(r.month))}</td>`).join('')}</tr>`).join('');
  const foot = `
    <tr><th>Media ${state.year}</th>${cols.map((c) => `<td class="num ${c.start ? 'gstart' : ''}${c.sub ? ' subcol' : ''}${c.total ? ' total' : ''}">${money(c.average) || '–'}</td>`).join('')}</tr>
    <tr><th>Da pagare</th>${cols.map((c) => `<td class="num ${c.start ? 'gstart' : ''}${c.sub ? ' subcol' : ''}${c.total ? ' total' : ''}">${c.due ? `<button class="link" data-payall="${c.id}" title="Segna come pagato tutto ${esc(colName(c))} fino a oggi">${money(c.due)}</button>` : ''}</td>`).join('')}</tr>`;
  const usciteCols = cols.filter((c) => c.top === 'uscite').length;
  const groups = `<tr class="groups"><th class="g-month">Mese</th><th class="gstart g-income">Entrate</th><th class="gstart g-spend" colspan="${usciteCols}">Uscite</th><th class="gstart g-sum" colspan="2">Riepilogo</th></tr>`;
  $('#grid').innerHTML = `<thead>${groups}<tr><th class="g-month"></th>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
}

// Il riquadro "Da pagare": salda in un colpo tutto ciò che è ancora da pagare, di tutti gli anni e di tutte le case.
async function payEverything() {
  const due = state.grid.summary.totalToPay;
  if (!(due > 0)) return;
  if (!confirm(`Segnare come pagato tutto il dovuto (${money(due)}, di tutti gli anni e di tutte le case)?`)) return;
  const r = await api('/api/pay-all', { method: 'POST', body: {} });
  await loadGrid();
  toast(`Saldati ${r.count} importi, ${money(r.total)} in tutto.`);
}

async function payAll(colId) {
  const col = state.colMap[colId];
  const now = new Date();
  const items = [];
  // Solo l'anno mostrato, e solo fino al mese corrente.
  for (let month = 1; month <= 12; month++) {
    if (state.year < now.getFullYear() || month <= now.getMonth() + 1) {
      for (const p of col.cell(month).parts) if (!p.paid) items.push({ kind: p.kind, year: state.year, month, place: p.place, paid: true });
    }
  }
  const name = colName(col);
  if (!items.length) return toast(`Nel ${state.year} non c'è nulla da segnare per ${name}.`);
  if (!confirm(`Segnare come pagati ${items.length} importi di ${name} del ${state.year}?`)) return;
  await api('/api/paid', { method: 'POST', body: items });
  await loadGrid();
}

// ------------------------------------------------------------------ movimenti

const CATEGORY_LABELS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', prestito: 'Prestito (rata mutuo)', donazioni: 'Donazioni', tasse: 'Tasse', bollette: 'Bolletta già contata (non contare)', giroconti: 'Giroconto (non contare)', sospesi: 'Da suddividere (non contare)', altro: 'Altro (non conta)' };
const CATEGORY_NAME = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', prestito: 'Prestito', donazioni: 'Donazioni', tasse: 'Tasse', bollette: 'Bollette pagate', giroconti: 'Giroconti', sospesi: 'Da suddividere', altro: 'Altro' };
const CATEGORY_COLOR = { spesa: 'var(--viz-spesa)', svago: 'var(--viz-svago)', carburante: 'var(--viz-carburante)', prestito: 'var(--viz-bollette)', donazioni: 'var(--viz-donazioni)', tasse: 'var(--viz-tasse)', bollette: 'var(--viz-altro)', giroconti: 'var(--viz-altro)', sospesi: 'var(--viz-altro)', altro: 'var(--viz-altro)' };
const fmtDate = (d) => d.split('-').reverse().join('/');

// Ordinamento delle colonne: clic sull'intestazione, di nuovo per invertire.
const sorting = { moves: { key: 'date', dir: 'desc' }, bank: { key: 'total', dir: 'desc' } };
const TEXT_KEYS = new Set(['description', 'name', 'category']);
function sortList(list, scope, getters) {
  const { key, dir } = sorting[scope];
  const get = getters[key];
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    return sign * (typeof x === 'string' ? x.localeCompare(y, 'it') : x - y);
  });
}
function sortHead(scope, key, label, cls = '') {
  const s = sorting[scope];
  const on = s.key === key;
  return `<th class="${cls}" aria-sort="${on ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button class="sortbtn" data-sort="${scope}:${key}" title="Ordina per ${label.toLowerCase()}">${label}<span class="arrow">${on ? (s.dir === 'asc' ? '▲' : '▼') : ''}</span></button></th>`;
}
function setSort(spec) {
  const [scope, key] = spec.split(':');
  const s = sorting[scope];
  if (s.key === key) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
  else { s.key = key; s.dir = TEXT_KEYS.has(key) ? 'asc' : 'desc'; }
  if (scope === 'moves') renderMoves(); else renderAnalysis();
}

const categorySelect = (attr, id, current, label, positive = false) => {
  const options = positive ? ['entrate', 'giroconti', 'altro'] : ['spesa', 'svago', 'carburante', 'prestito', 'donazioni', 'tasse', 'bollette', 'giroconti', 'sospesi', 'altro'];
  const names = positive ? { entrate: 'Entrate', giroconti: 'Giroconto (non contare)', altro: 'Altro (non conta)' } : CATEGORY_LABELS;
  return `<select ${attr}="${id}" aria-label="Categoria di ${esc(label)}">${options.map((c) => `<option value="${c}" ${c === current ? 'selected' : ''}>${names[c]}</option>`).join('')}</select>`;
};

async function loadMoves() {
  state.moves = (await api(`/api/transactions?year=${state.year}`)).transactions;
  renderMoves();
}

function renderMoves() {
  const list = state.moves ?? [];
  $('#movesEmpty').hidden = list.length > 0;
  $('#moveTable').hidden = list.length === 0;
  const rows = sortList(list, 'moves', { date: (t) => t.date, description: (t) => t.description, amount: (t) => t.amount, category: (t) => t.category });
  $('#moveTable').innerHTML = list.length ? `<thead><tr>${sortHead('moves', 'date', 'Data')}${sortHead('moves', 'description', 'Descrizione')}${sortHead('moves', 'amount', 'Importo', 'num')}${sortHead('moves', 'category', 'Categoria')}</tr></thead><tbody>${
    rows.map((t) => `<tr><td>${fmtDate(t.date)}</td><td class="fname" title="${esc(t.description)}">${esc(t.description)}</td><td class="num ${t.amount > 0 ? 'pos-in' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</td><td>${categorySelect('data-move', t.id, t.category, t.description, t.amount > 0)}</td></tr>`).join('')}</tbody>` : '';
}

// ------------------------------------------------------------------ banca

const CURRENT_YEAR = new Date().getFullYear();
state.bank = { year: CURRENT_YEAR, month: 0, data: null };

async function loadAnalysis() {
  const { year, month } = state.bank;
  state.bank.data = await api(`/api/analysis?year=${year}&month=${month}`);
  renderAnalysis();
}

function renderFilters() {
  const { data, year, month } = state.bank;
  const years = [...new Set([...(data?.years ?? []), ...(year ? [year] : [])])].sort((a, b) => b - a);
  $('#bankYear').innerHTML = `<option value="0">Tutti gli anni</option>${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}`;
  $('#bankMonth').innerHTML = `<option value="0">Tutti i mesi</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}`;
  $('#bankReset').hidden = year === CURRENT_YEAR && !month;
}

function periodLabel() {
  const { year, month } = state.bank;
  if (year && month) return `${MONTHS[month - 1]} ${year}`;
  if (year) return String(year);
  if (month) return `${MONTHS[month - 1]} di ogni anno`;
  return 'tutto il periodo';
}

// Nomi lunghi degli estratti UniCredit, accorciati solo a video.
function shortName(name) {
  const transfer = /\bA:\s*(.+?)\s+PER:/.exec(name);
  if (/^(DISPOSIZIONE DI )?BONIFICO/.test(name) && transfer) return `Bonifico a ${transfer[1]}`;
  if (/^PAGAMENTO PER UTILIZZO CARTE DI CREDITO/.test(name)) return 'Carta di credito (addebito mensile)';
  if (/^ADDEBITO PER DONAZIONE/.test(name)) return 'Donazione (addebito)';
  return name.length > 54 ? `${name.slice(0, 52)}…` : name;
}

function renderAnalysis() {
  const a = state.bank.data;
  if (!a) return;
  renderFilters();
  $('#analysisEmpty').hidden = a.count > 0 || a.months.length > 0;
  if (a.count === 0 && a.months.length === 0) { $('#analysisBody').innerHTML = ''; return; }

  const cats = a.categories;
  const top = cats.flatMap((c) => c.merchants.map((m) => ({ ...m, cat: c.category }))).sort((x, y) => y.total - x.total).slice(0, 10);
  const table = (c, positive = false) => {
    const rows = sortList(c.merchants, 'bank', { name: (m) => m.name, count: (m) => m.count, total: (m) => m.total, last: (m) => m.last });
    return `<details class="acat" data-cat="${positive ? 'in-' : ''}${c.category}" ${(!positive && c.category === 'altro') || (positive && c.category === 'entrate') || document.querySelector(`#analysisBody details[data-cat="${positive ? 'in-' : ''}${c.category}"][open]`) ? 'open' : ''}>
      <summary><i class="key" style="--c:${positive ? (c.category === 'entrate' ? 'var(--viz-entrate)' : 'var(--viz-altro)') : CATEGORY_COLOR[c.category]}"></i> ${positive ? (c.category === 'entrate' ? 'Altre entrate' : 'Entrate non riconosciute (non contate)') : (c.category === 'giroconti' ? 'Giroconti (soldi tra i miei conti, non contati in nessun dato)' : c.category === 'bollette' ? 'Bollette già contate nei documenti (addebiti abbinati, non contati due volte)' : c.category === 'sospesi' ? 'Da suddividere (es. addebiti PayPal: non contati finché non li dividi)' : CATEGORY_NAME[c.category])} <span class="muted">· ${c.merchants.length} descrizioni · ${money(c.total)}</span></summary>
      <div class="tablewrap"><table class="atable"><thead><tr>${sortHead('bank', 'name', 'Descrizione')}${sortHead('bank', 'count', 'Quantità', 'num')}${sortHead('bank', 'total', 'Importo', 'num')}${sortHead('bank', 'last', 'Data')}<th>Categoria</th></tr></thead><tbody>${
        rows.map((m) => `<tr><td class="fname" title="${esc(m.name)}">${esc(m.name)}${m.doc ? `<small class="doc">→ ${esc(m.doc)}</small>` : ''}</td><td class="num">${m.count}</td><td class="num">${money(m.total)}</td><td title="Primo: ${fmtDate(m.from)}">${fmtDate(m.last)}</td><td>${categorySelect('data-amove', m.id, c.category, m.name, m.positive ?? positive)}</td></tr>`).join('')}</tbody></table></div>
    </details>`;
  };
  const numbers = a.months.map((m) => {
    const out = m.bills + m.spesa + m.svago + m.carburante;
    return `<tr><td>${monthLong(m.ym)}</td><td class="num">${money(m.income) || '–'}</td><td class="num">${money(m.otherIncome) || '–'}</td><td class="num">${money(m.bills) || '–'}</td><td class="num">${money(m.spesa) || '–'}</td><td class="num">${money(m.svago) || '–'}</td><td class="num">${money(m.carburante) || '–'}</td><td class="num">${money(m.bank.donazioni) || '–'}</td><td class="num">${money(m.bank.tasse) || '–'}</td><td class="num">${money(m.bank.altro) || '–'}</td><td class="num"><b>${money(out) || '–'}</b></td><td class="num ${m.income ? (m.income - out >= 0 ? 'pos' : 'neg') : ''}">${m.income ? money(m.income - out) : '–'}</td></tr>`;
  }).join('');

  $('#analysisBody').innerHTML = `
    <p class="muted">${a.count} uscite bancarie, ${money(a.total)} in tutto (${periodLabel()}). Cambia la categoria di una descrizione dal menu: vale per tutte quelle uguali.</p>
    <div class="cards">${cats.map((c) => `<div class="card"><div class="k"><i class="key" style="--c:${CATEGORY_COLOR[c.category]}"></i> ${CATEGORY_NAME[c.category]}${c.column ? '' : ' · fuori dalla tabella'}</div><div class="v">${money(c.total)}</div><div class="sub">${c.count} movimenti · ${(c.share * 100).toFixed(1).replace('.', ',')}%</div></div>`).join('')}</div>
    ${(() => { const e = a.inflows.find((c) => c.category === 'entrate'); return e && e.count ? `<div class="cards"><div class="card"><div class="k"><i class="key line" style="--c:var(--viz-entrate)"></i> Altre entrate</div><div class="v">${money(e.total)}</div><div class="sub">${e.count} movimenti in entrata (oltre allo stipendio)</div></div></div>` : ''; })()}
    <section class="chartcard">
      <h3>Stipendio contro uscite</h3>
      <p class="muted">Bollette e affitto dai documenti, rata del prestito dagli estratti conto; spesa, svago e carburante dall'estratto conto. La linea verde sono le altre entrate in banca (bonifici ricevuti, non contati nello stipendio). Se la linea sta sopra le colonne, il mese chiude in positivo. Clic su un mese per filtrarlo.</p>
      <div id="chIncome" class="chart"></div>
    </section>
    <div class="chartrow">
      <section class="chartcard">
        <h3>Dove va il denaro della banca</h3>
        <p class="muted">Tutte le uscite bancarie per categoria, compresa la parte ancora in "Altro" (le entrate sono nel grafico sopra).</p>
        <div id="chBank" class="chart"></div>
      </section>
      <section class="chartcard">
        <h3>Le 10 voci più pesanti</h3>
        <p class="muted">Per importo totale nel periodo, colorate per categoria.</p>
        <div id="chTop" class="chart"></div>
      </section>
    </div>
    <details class="acat"><summary>Numeri mese per mese <span class="muted">· tabella dei grafici</span></summary>
      <div class="tablewrap"><table class="atable"><thead><tr><th>Mese</th><th class="num">Stipendio</th><th class="num">Altre entrate</th><th class="num">Bollette e affitto</th><th class="num">Spesa</th><th class="num">Svago</th><th class="num">Carburante</th><th class="num">Donazioni</th><th class="num">Tasse</th><th class="num">Altro (banca)</th><th class="num">Uscite totali</th><th class="num">Saldo</th></tr></thead><tbody>${numbers}</tbody></table></div>
    </details>
    ${cats.map((c) => table(c)).join('')}
    ${a.inflows.filter((c) => c.count).map((c) => table(c, true)).join('')}
    ${a.excluded.filter((c) => c.count).map((c) => table(c)).join('')}`;

  const pick = (ym) => {
    state.bank.year = Number(ym.slice(0, 4));
    state.bank.month = Number(ym.slice(5));
    loadAnalysis().catch((err) => toast(err.message));
  };
  monthChart($('#chIncome'), a.months, {
    series: [
      { label: 'Spesa', color: 'var(--viz-spesa)', get: (m) => m.spesa },
      { label: 'Svago', color: 'var(--viz-svago)', get: (m) => m.svago },
      { label: 'Carburante', color: 'var(--viz-carburante)', get: (m) => m.carburante },
      { label: 'Bollette e affitto', color: 'var(--viz-bollette)', get: (m) => m.bills },
    ],
    lines: [
      { label: 'Stipendio', color: 'var(--ink)', get: (m) => m.income },
      { label: 'Altre entrate', color: 'var(--viz-entrate)', get: (m) => m.otherIncome },
    ],
    onPick: state.bank.year && state.bank.month ? undefined : pick,
  });
  monthChart($('#chBank'), a.months, {
    series: ['spesa', 'svago', 'carburante', 'prestito', 'donazioni', 'tasse', 'altro'].map((k) => ({ label: CATEGORY_NAME[k], color: CATEGORY_COLOR[k], get: (m) => m.bank[k] })),
    onPick: state.bank.year && state.bank.month ? undefined : pick,
  });
  hBars($('#chTop'), top.map((m) => ({ label: shortName(m.name), value: m.total, color: CATEGORY_COLOR[m.cat], cat: CATEGORY_NAME[m.cat], sub: `${m.count} volte` })));
}

async function setCategory(select) {
  await api('/api/transactions', { method: 'PUT', body: { id: select.dataset.move ?? select.dataset.amove, category: select.value } });
  await Promise.all([loadMoves(), loadGrid(), loadAnalysis()]);
  toast('Categoria salvata: la ricorderò per i movimenti con la stessa descrizione.');
}

async function uploadStatements(files) {
  let added = 0;
  let duplicates = 0;
  for (const file of files) {
    const r = await api('/api/statements', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, raw: await file.text() });
    added += r.added;
    duplicates += r.duplicates;
  }
  toast(`Movimenti aggiunti: ${added}${duplicates ? ` (${duplicates} già presenti)` : ''}.`);
  await Promise.all([loadMoves(), loadGrid(), loadAnalysis()]);
}

// ------------------------------------------------------------------ documenti

async function loadDocs() {
  state.docs = await api('/api/docs');
  const bad = state.docs.filter((d) => d.status === 'incompleto').length;
  const badge = $('#docBadge');
  badge.hidden = !bad;
  badge.textContent = bad;
  $('#docsEmpty').hidden = state.docs.length > 0;
  $('#docTable').hidden = state.docs.length === 0;
  const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label ?? '—';
  $('#docTable').innerHTML = state.docs.length ? `<thead><tr><th>File</th><th>Tipo</th><th>Periodo</th><th class="num">Importo</th><th>Stato</th><th></th></tr></thead><tbody>${
    state.docs.map((d, i) => `<tr>
      <td class="fname" title="${esc(d.name)}">${esc(d.name)}</td>
      <td>${kindLabel(d.kind)}</td>
      <td>${d.year && d.month ? `${MONTHS[d.month - 1]} ${d.year}` : '—'}</td>
      <td class="num">${money(d.amount) || '—'}</td>
      <td>${d.status === 'ok' ? '<span class="pill ok">Letto</span>' : d.status === 'ignorato' ? '<span class="pill edit">Ignorato</span>' : `<span class="pill warn" title="Manca: ${esc(d.missing.join(', '))}">Da controllare</span>`}${d.edited ? ' <span class="pill edit">Corretto</span>' : ''}</td>
      <td><button class="link" data-doc="${i}">Modifica</button></td></tr>`).join('')}</tbody>` : '';
}

function openDoc(index) {
  const d = state.docs[index];
  const dlg = $('#docDlg');
  const opt = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`;
  const year = d.year ?? new Date().getFullYear();
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <h2>Correggi documento</h2>
    <p class="fname" title="${esc(d.name)}"><a href="/api/file?key=${encodeURIComponent(d.key)}" target="_blank" rel="noopener">📄 ${esc(d.name)}</a></p>
    ${d.status === 'incompleto' ? `<p class="pill warn" style="justify-self:start">Non sono riuscito a leggere: ${esc(d.missing.join(', '))}</p>` : ''}
    <label>Tipo<select name="kind"><option value="">—</option>${DOC_KINDS.map((k) => opt(k.id, k.label, d.kind)).join('')}</select></label>
    <div class="row">
      <label>Mese<select name="month"><option value="">—</option>${MONTHS.map((m, i) => opt(i + 1, m, d.month)).join('')}</select></label>
      <label>Anno<input name="year" type="number" min="2000" max="2100" value="${d.year ?? ''}" placeholder="${year}"></label>
    </div>
    <label>Importo (€)<input name="amount" inputmode="decimal" value="${inputValue(d.amount)}"></label>
    <label class="check"><input type="checkbox" name="ignore" ${d.status === 'ignorato' ? 'checked' : ''}> Ignora questo documento (non conta nei totali)</label>
    <details><summary class="muted">Testo letto dal PDF</summary><pre id="rawText">Caricamento…</pre></details>
    <p class="error" id="docErr" role="alert"></p>
    <div class="foot">
      ${d.edited ? '<button type="button" class="link danger" data-act="reset">Ripristina lettura automatica</button>' : ''}
      <button type="button" class="ghost" data-act="close">Annulla</button>
      <button class="primary">Salva</button>
    </div></form>`;
  const form = dlg.querySelector('form');
  api(`/api/docs/text?key=${encodeURIComponent(d.key)}`).then((t) => { $('#rawText').textContent = t.text || '(nessun testo: forse il PDF è una scansione)'; }).catch(() => {});
  const send = async (override) => {
    try {
      await api('/api/docs', { method: 'PUT', body: { key: d.key, override } });
      dlg.close();
      await Promise.all([loadDocs(), loadGrid()]);
    } catch (err) { $('#docErr').textContent = err.message; }
  };
  form.addEventListener('click', (e) => {
    if (e.target.dataset.act === 'close') dlg.close();
    if (e.target.dataset.act === 'reset') send({});
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const num = parseInput(form.amount.value);
    if (Number.isNaN(num)) { $('#docErr').textContent = 'Importo non valido.'; return; }
    send({
      kind: form.kind.value || undefined,
      month: form.month.value ? Number(form.month.value) : undefined,
      year: form.year.value ? Number(form.year.value) : undefined,
      amount: num ?? undefined,
      ignore: form.ignore.checked || undefined,
    });
  });
  dlg.showModal();
}

// ---------------------------------------------------------------- impostazioni

async function openSettings() {
  state.settings = await api('/api/settings');
  const s = state.settings;
  const dlg = $('#settingsDlg');
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <h2>Impostazioni</h2>
    <fieldset><legend>Dove si trovano i documenti</legend>
      <label>Buste paga<input name="payslipsSource" value="${esc(s.payslipsSource)}" placeholder="Link Seafile (…/d/xxxx/) o percorso locale" autocomplete="off"></label>
      <label>Bollette<input name="billsSource" value="${esc(s.billsSource)}" placeholder="Link Seafile (…/d/xxxx/) o percorso locale" autocomplete="off"></label>
      <label>Estratti conto (CSV)<input name="statementsSource" value="${esc(s.statementsSource)}" placeholder="Link Seafile (…/d/xxxx/) o percorso locale con i CSV" autocomplete="off"></label>
      <small>Le sottocartelle vengono lette in automatico. I link Seafile devono essere pubblici, senza password. Gli estratti conto si leggono dai file CSV della banca.</small>
    </fieldset>
    <fieldset><legend>Affitto</legend>
      <div class="row">
        <label>Importo mensile (€)<input name="rentAmount" inputmode="decimal" value="${inputValue(s.rentAmount || null)}" placeholder="0"></label>
        <label>Dal mese<input name="rentFrom" type="month" value="${esc(s.rentFrom)}"></label>
      </div>
      <small>Viene aggiunto automaticamente ogni mese, senza PDF. Nella tabella si segna pagato con un clic.</small>
    </fieldset>
    <fieldset><legend>Riconoscere i miei movimenti</legend>
      <label>Il mio nome (più nomi separati da virgola)<input name="ownNames" value="${esc(s.ownNames)}" placeholder="Es. Mario Rossi" autocomplete="off"></label>
      <label>Chi mi paga lo stipendio (separati da virgola)<input name="incomePayers" value="${esc(s.incomePayers)}" placeholder="Es. Azienda Esempio" autocomplete="off"></label>
      <small>Servono a non contare i giroconti tra i miei conti e lo stipendio, già presente nelle buste paga. Restano sul tuo database: non vengono mai pubblicati.</small>
    </fieldset>
    <p class="error" id="setErr" role="alert"></p>
    <div class="foot"><button type="button" class="ghost" data-act="close">Annulla</button><button class="primary">Salva</button></div>
  </form>`;
  const form = dlg.querySelector('form');
  form.addEventListener('click', (e) => { if (e.target.dataset.act === 'close') dlg.close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: {
          payslipsSource: form.payslipsSource.value,
          billsSource: form.billsSource.value,
          statementsSource: form.statementsSource.value,
          ownNames: form.ownNames.value,
          incomePayers: form.incomePayers.value,
          rentAmount: parseInput(form.rentAmount.value) ?? 0,
          rentFrom: form.rentFrom.value,
        },
      });
      dlg.close();
      toast('Impostazioni salvate. Premi Aggiorna per leggere i documenti.');
      await loadGrid();
    } catch (err) { $('#setErr').textContent = err.message; }
  });
  dlg.showModal();
}

// ------------------------------------------------------------------- refresh

function refreshSummary(r) {
  const parts = [];
  if (r.added) parts.push(`${r.added} nuovi`);
  if (r.updated) parts.push(`${r.updated} aggiornati`);
  if (r.removed) parts.push(`${r.removed} rimossi`);
  if (r.transactions) parts.push(`${r.transactions} movimenti bancari`);
  if (r.ocr) parts.push(`${r.ocr} scansioni lette con OCR`);
  if (r.incomplete) parts.push(`${r.incomplete} da controllare`);
  let msg = parts.length ? `Documenti: ${parts.join(', ')}.` : 'Tutto aggiornato, nessun documento nuovo.';
  if (r.errors.length) msg += ` Errori: ${r.errors.map((e) => `${e.source}: ${e.message}`).join(' · ')}`;
  return msg;
}

// All'apertura: cerca documenti nuovi o modificati. La targhetta in alto dice cosa sta succedendo;
// se non cambia nulla, nessun messaggio.
async function autoScan() {
  const badge = $('#scanBadge');
  const btn = $('#refreshBtn');
  badge.hidden = false;
  badge.querySelector('.txt').textContent = 'Controllo nuovi documenti…';
  btn.disabled = true;
  const poll = setInterval(async () => {
    try {
      const p = await api('/api/refresh/status');
      if (p.running && p.total) badge.querySelector('.txt').textContent = `Analisi dei dati ${p.done}/${p.total}…`;
    } catch { /* riprova al prossimo giro */ }
  }, 700);
  try {
    const r = await api('/api/refresh', { method: 'POST', body: {} });
    const changed = r.added || r.updated || r.removed || r.transactions;
    if (changed || r.errors.length) {
      await Promise.all([loadGrid(), loadDocs(), loadMoves()]);
      toast(refreshSummary(r), r.errors.length ? 9000 : 4500);
    }
  } catch (err) {
    if (!/già in corso/.test(err.message)) toast(err.message, 8000);
  } finally {
    clearInterval(poll);
    badge.hidden = true;
    btn.disabled = false;
  }
}

async function doRefresh(force = false) {
  const btn = $('#refreshBtn');
  btn.disabled = true;
  btn.querySelector('.spin').hidden = false;
  const label = btn.querySelector('.label');
  label.textContent = 'Lettura in corso…';
  const poll = setInterval(async () => {
    try {
      const p = await api('/api/refresh/status');
      if (p.running && p.total) label.textContent = `Lettura ${p.done}/${p.total}…`;
    } catch { /* il prossimo giro riprova */ }
  }, 1000);
  try {
    const r = await api('/api/refresh', { method: 'POST', body: { force } });
    if (r.sources.every((s) => s.skipped)) toast('Nessuna cartella configurata: apri le impostazioni.');
    else toast(refreshSummary(r), r.errors.length ? 9000 : 4500);
  } catch (err) {
    toast(err.message, 8000);
  } finally {
    clearInterval(poll);
    btn.disabled = false;
    btn.querySelector('.spin').hidden = true;
    btn.querySelector('.label').textContent = 'Aggiorna';
    await Promise.all([loadGrid(), loadDocs(), loadMoves()]);
  }
}

// ------------------------------------------------------------------ eventi

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.sort) { setSort(t.dataset.sort); return; }
  if (t.dataset.toggle) { state.open[t.dataset.toggle] = !state.open[t.dataset.toggle]; saveOpen(); renderGrid(); return; }
  if (t.id === 'bankReset') { state.bank.year = CURRENT_YEAR; state.bank.month = 0; loadAnalysis().catch((err) => toast(err.message)); return; }
  if (t.dataset.payallEverything) payEverything().catch((err) => toast(err.message));
  else if (t.dataset.year) { state.year = Number(t.dataset.year); loadGrid(); if (!$('#moves').hidden) loadMoves().catch((err) => toast(err.message)); }
  else if (t.dataset.payall) payAll(t.dataset.payall).catch((err) => toast(err.message));
  else if (t.dataset.doc !== undefined) openDoc(Number(t.dataset.doc));
  else if (t.dataset.tab) {
    document.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', b === t));
    $('#overview').hidden = t.dataset.tab !== 'overview';
    $('#docs').hidden = t.dataset.tab !== 'docs';
    $('#moves').hidden = t.dataset.tab !== 'moves';
    $('#analysis').hidden = t.dataset.tab !== 'analysis';
    $('#years').hidden = t.dataset.tab === 'docs' || t.dataset.tab === 'analysis';
    if (t.dataset.tab === 'moves') loadMoves().catch((err) => toast(err.message));
    if (t.dataset.tab === 'analysis') loadAnalysis().catch((err) => toast(err.message));
  }
});
// Clic (o Spazio/Invio) su una cella: pagato / da pagare. A sinistra, il link apre invece il documento.
const onPaidCell = (e) => {
  const cell = e.target.closest('.pcell');
  if (!cell || e.target.closest('.zone-open')) return false;
  togglePaid(cell.dataset.col, Number(cell.dataset.month)).catch((err) => toast(err.message));
  return true;
};
document.addEventListener('click', onPaidCell);
document.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && e.target.classList?.contains('pcell') && onPaidCell(e)) e.preventDefault();
  if (e.key === 'Enter' && e.target.classList?.contains('expense-input')) e.target.blur();
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'bankYear' || e.target.id === 'bankMonth') {
    state.bank.year = Number($('#bankYear').value);
    state.bank.month = Number($('#bankMonth').value);
    loadAnalysis().catch((err) => toast(err.message));
    return;
  }
  if (e.target.dataset.move || e.target.dataset.amove) setCategory(e.target).catch((err) => toast(err.message));
  if (e.target.classList.contains('expense-input')) saveExpense(e.target).catch((err) => toast(err.message));
});
$('#statementFile').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (files.length) uploadStatements(files).catch((err) => toast(err.message, 8000));
});
$('#refreshBtn').addEventListener('click', (e) => doRefresh(e.shiftKey));
$('#refreshBtn').title = 'Rilegge i documenti nuovi o modificati (Maiusc+clic: rilegge tutto)';
$('#settingsBtn').addEventListener('click', () => openSettings().catch((err) => toast(err.message)));

api('/api/version').then(({ version }) => { $('#version').textContent = `v${version}`; }).catch(() => {});
Promise.all([loadGrid(), loadDocs()]).then(autoScan).catch((err) => toast(err.message));
