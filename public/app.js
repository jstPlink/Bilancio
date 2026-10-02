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
  if (res.status === 401) { location.href = '/login'; throw new Error(data.error ?? 'Accesso richiesto.'); }
  if (res.status === 404 && !data.error && String(path).startsWith('/api/')) throw new Error('Il server non ha ancora questa funzione: va aggiornato all\'ultima versione (docker compose pull && docker compose up -d).');
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
  $('#yearSelect').innerHTML = state.grid.years
    .map((y) => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('');
}

function renderCards() {
  const s = state.grid.summary;
  const card = (k, v, sub = '', cls = '') => `<div class="card ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="sub">${sub}</div></div>`;
  const dueParts = EXPENSES.filter((k) => s.toPayAll[k.id] > 0).map((k) => k.label).join(', ');
  $('#cards').innerHTML = [
    s.totalToPay > 0
      ? `<button class="card due payall-all" data-payall-everything="1" title="Segna tutto come pagato"><div class="k">Da pagare</div><div class="v">${money(s.totalToPay)}</div><div class="sub">${dueParts} · clic per saldare tutto</div></button>`
      : card('Da pagare', money(0), 'Tutto pagato', 'due'),
    card('Entrate medie', money(s.avgIncome) || '—'),
    card('Uscite medie', money(s.avgSpent) || '—'),
    card('Bilancio medio', money(s.avgBalance) || '—'),
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
// Telefono: solo le colonne compatte (Mese, Entrate, Uscite, Bilancio). Schermo largo: tutte le voci sempre aperte.
const phone = window.matchMedia('(max-width: 720px)');

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

// Le colonne visibili. Vista compatta: mese, entrate, uscite, bilancio. "Uscite" si apre nelle sue voci
// e, dentro, "Bollette" si apre in quelle di ogni casa. Ogni colonna sa dare la cella di un mese.
function buildColumns() {
  const { rows, columns: leaves, summary: s } = state.grid;
  const leaf = Object.fromEntries(leaves.map((c) => [c.id, c]));
  const cellOf = (id, month) => rows[month - 1].cells[id];
  const payable = leaves.filter((l) => !NO_PAYMENT.has(l.kind)).map((l) => l.id);
  const out = [];
  const add = (col) => { out.push(col); return col; };

  add({
    id: 'entrate', kind: 'entrate', label: 'Entrate', start: true, plain: true, total: true,
    cell: (m) => ({ amount: rows[m - 1].income }),
    tip: (m) => {
      const st = cellOf('stipendio', m).amount;
      const other = cellOf('entrate', m).amount;
      return [st != null ? `Stipendio ${money(st)}` : '', other != null ? `Altre entrate ${money(other)}` : ''].filter(Boolean).join(' · ');
    },
    avg: () => s.avgIncome,
  });

  // Il totale delle uscite del mese, con il numero di voci ancora da pagare.
  add({
    id: 'uscite', kind: 'uscite', label: 'Uscite', start: true, plain: true, total: true,
    leafIds: payable,
    cell: (m) => {
      const parts = payable.flatMap((id) => cellOf(id, m).parts);
      return { amount: rows[m - 1].spent, parts, due: parts.filter((p) => !p.paid).length };
    },
    avg: () => s.avgSpent,
  });

  if (!phone.matches) {
    GROUPS.forEach((g) => {
      const members = g.leaves.map((id) => leaf[id]);
      const isMulti = g.leaves.length > 1;
      const first = members[0];
      const col = isMulti
        ? { id: `g:${g.id}`, kind: g.id, label: g.label, place: null, cell: (m) => sumCells(g.leaves.map((id) => cellOf(id, m))), leafIds: g.leaves }
        : { ...first, label: first.kind === 'spese' ? 'Spesa' : undefined, cell: (m) => cellOf(first.id, m), leafIds: [first.id] };
      add({ ...col, sub: true, depth: 1, colorKey: g.id });
      if (isMulti) {
        const addLeaf = (l, depth = 2) => add({ ...l, cell: (m) => cellOf(l.id, m), leafIds: [l.id], sub: true, depth });
        const crispiano = members.filter((l) => l.place === 'crispiano');
        members.filter((l) => l.place !== 'crispiano').forEach((l) => addLeaf(l));
        // Le voci di Crispiano si possono comprimere in una sola colonna (utile quando non ci sono più bollette da pagare).
        if (g.id === 'bollette' && crispiano.length) {
          const ids = crispiano.map((l) => l.id);
          add({
            id: 'g:crispiano', kind: 'bollette', label: 'Crispiano', place: null, colorKey: 'bollette', sub: true, depth: 2,
            cell: (m) => sumCells(ids.map((id) => cellOf(id, m))), leafIds: ids,
          });
          crispiano.forEach((l) => addLeaf(l, 3));
        }
      }
    });
  }

  add({ id: 'balance', kind: 'balance', label: 'Bilancio', start: true, plain: true, total: true, balance: true, cell: (m) => ({ amount: rows[m - 1].balance }), avg: () => s.avgBalance });

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
    const dueHint = c.due ? `<small class="duehint">${c.due} da pagare</small>` : '';
    const tip = col.tip ? col.tip(month) : (c.due ? `${c.due} da pagare` : '');
    const go = ['entrate', 'uscite', 'balance'].includes(kind) ? ` data-go="${kind}" data-month="${month}" role="button" tabindex="0" aria-label="Movimenti di ${esc(label)}"` : '';
    return `<div class="static ${tone}${dueHint ? ' has-sub' : ''}${go ? ' go' : ''}" ${tip ? `title="${esc(tip)}"` : ''}${go}><span class="num">${money(c.amount)}</span>${dueHint}</div>`;
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

// Su schermo largo tutte le voci (Uscite → Bollette → Crispiano…) sono sempre aperte; sul telefono restano Mese, Entrate, Uscite, Bilancio.
function renderGrid() {
  const { rows } = state.grid;
  const cols = buildColumns();
  state.colMap = Object.fromEntries(cols.map((c) => [c.id, c]));
  const dot = (c) => (c.plain ? '' : `<span class="dot" style="background:var(--${c.colorKey ?? c.kind})"></span>`);
  const cls = (c) => [c.start && 'gstart', c.sub && `subcol d${c.depth}`, c.total && 'total'].filter(Boolean).join(' ');
  const head = cols.map((c) => {
    const sub = c.place ? `<small class="place">${PLACE_LABELS[c.place]}</small>` : '';
    const name = `${dot(c)}${esc(c.place ? colLabel(c) : c.label ?? colLabel(c))}${sub}`;
    return `<th class="${cls(c)}">${name}</th>`;
  }).join('');
  const body = rows.map((r) => `<tr><th scope="row" class="go" data-go="balance" data-month="${r.month}" role="button" tabindex="0" title="Movimenti di ${MONTHS[r.month - 1]}">${MONTHS[r.month - 1]}</th>${cols.map((c) => `<td class="num ${cls(c)}"> ${cellHtml(c, r.month, c.cell(r.month))}</td>`).join('')}</tr>`).join('');
  const foot = `
    <tr><th>Media ${state.year}</th>${cols.map((c) => `<td class="num ${cls(c)}"> ${money(c.average) || '–'}</td>`).join('')}</tr>
    <tr><th>Da pagare</th>${cols.map((c) => `<td class="num ${cls(c)}"> ${c.due ? `<button class="link" data-payall="${c.id}" title="Segna come pagato tutto ${esc(colName(c))} fino a oggi">${money(c.due)}</button>` : ''}</td>`).join('')}</tr>`;
  $('#grid').innerHTML = `<thead><tr><th class="g-month">Mese</th>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
}

// Il riquadro "Da pagare": salda in un colpo tutto ciò che è ancora da pagare, di tutti gli anni e di tutte le case.
phone.addEventListener('change', () => { if (state.grid) renderGrid(); });
// Il grafico si ridisegna quando cambia la larghezza (rotazione del telefono, finestra ridimensionata).
let chartWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === chartWidth) return;
  chartWidth = window.innerWidth;
  if (!$('#analysis')?.hidden) renderAnalysis();
});

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
const sorting = { moves: { key: 'date', dir: 'desc' } };
// Scelte del menu «Ordina per» (le intestazioni della tabella, su schermo largo, fanno lo stesso).
const SORT_CHOICES = [
  ['date:desc', 'Più recenti'], ['date:asc', 'Più vecchi'],
  ['amount:desc', 'Prezzo decrescente'], ['amount:asc', 'Prezzo crescente'],
  ['count:desc', 'Più transazioni'], ['count:asc', 'Meno transazioni'],
  ['description:asc', 'Nome A–Z'], ['description:desc', 'Nome Z–A'],
  ['category:asc', 'Categoria'],
];
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
  renderBank();
}

const categorySelect = (attr, id, current, label, positive = false) => {
  const options = positive ? ['entrate', 'giroconti', 'altro'] : ['spesa', 'svago', 'carburante', 'prestito', 'donazioni', 'tasse', 'bollette', 'giroconti', 'sospesi', 'altro'];
  const names = positive ? { entrate: 'Entrate', giroconti: 'Giroconto (non contare)', altro: 'Altro (non conta)' } : CATEGORY_LABELS;
  return `<select ${attr}="${id}" aria-label="Categoria di ${esc(label)}">${options.map((c) => `<option value="${c}" ${c === current ? 'selected' : ''}>${names[c]}</option>`).join('')}</select>`;
};

const CURRENT_YEAR = new Date().getFullYear();
// Periodo e filtri condivisi da Movimenti e Statistiche.
state.bank = { year: CURRENT_YEAR, month: 0, data: null, cat: '', q: '', flow: '', open: new Set() };
state.moves = [];

// Carica movimenti e analisi del periodo scelto e ridisegna la scheda visibile.
async function loadBank() {
  const { year, month } = state.bank;
  const [tx, analysis, settings] = await Promise.all([
    api(`/api/transactions?year=${year}`),
    api(`/api/analysis?year=${year}&month=${month}`),
    api('/api/settings').catch(() => null),
  ]);
  state.payers = String(settings?.incomePayers ?? '').split(/[,;]/).map((p) => p.trim()).filter((p) => normText(p));
  state.moves = tx.transactions;
  state.bank.data = analysis;
  renderBank();
}
const loadMoves = loadBank;
const loadAnalysis = loadBank;

function renderBank() {
  renderFilters();
  if (!$('#moves').hidden) renderMoves();
  if (!$('#analysis').hidden) renderAnalysis();
}

function renderFilters() {
  const { data, year, month, cat, q } = state.bank;
  const years = [...new Set([...(data?.years ?? []), ...(year ? [year] : [])])].sort((a, b) => b - a);
  const yearOptions = `<option value="0">Tutti gli anni</option>${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}`;
  const monthOptions = `<option value="0">Tutti i mesi</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}`;
  document.querySelectorAll('.f-year').forEach((el) => { el.innerHTML = yearOptions; });
  document.querySelectorAll('.f-month').forEach((el) => { el.innerHTML = monthOptions; });
  const sortNow = `${sorting.moves.key}:${sorting.moves.dir}`;
  const sortSelect = $('#moveSort');
  if (sortSelect) {
    const known = SORT_CHOICES.some(([v]) => v === sortNow);
    sortSelect.innerHTML = (known ? '' : `<option value="${sortNow}" selected>Personalizzato</option>`) + SORT_CHOICES.map(([v, l]) => `<option value="${v}" ${v === sortNow ? 'selected' : ''}>${l}</option>`).join('');
  }
  const catSelect = $('#catSelect');
  if (catSelect) {
    const names = data ? [...data.categories, ...data.inflows.filter((c) => c.count), ...data.excluded.filter((c) => c.count)].map((c) => c.category) : [];
    const list = [...new Set([...names, ...(cat ? [cat] : [])])];
    catSelect.innerHTML = `<option value="">Tutte</option>${list.map((c) => `<option value="${c}" ${c === cat ? 'selected' : ''}>${esc(catName(c))}</option>`).join('')}`;
  }
  document.querySelectorAll('.f-reset').forEach((el) => { el.hidden = year === CURRENT_YEAR && !month && !cat && !q && !state.bank.flow; });
}

function resetBank() {
  Object.assign(state.bank, { year: CURRENT_YEAR, month: 0, cat: '', q: '', flow: '' });
  $('#moveSearch').value = '';
  loadBank().catch((err) => toast(err.message));
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

// ------------------------------------------------------- informazioni su un movimento

const TYPE_LABELS = { CARD_PAYMENT: 'Carta', TRANSFER: 'Bonifico', ATM: 'Prelievo', DIRECT_DEBIT: 'Addebito diretto', TOPUP: 'Ricarica', FEE: 'Commissione', EXCHANGE: 'Cambio valuta', CARD_REFUND: 'Rimborso carta', REFUND: 'Rimborso' };

// Come è stato pagato: dal tipo dell'estratto (Revolut) oppure, se manca, dalle parole della descrizione.
function methodOf(t) {
  if (t.type) return TYPE_LABELS[t.type] ?? t.type.toLowerCase().replace(/_/g, ' ');
  const text = `${t.description} ${t.detail ?? ''}`;
  if (/bonifico/i.test(text)) return 'Bonifico';
  if (/sepa dd|\bsdd\b|addebito/i.test(text)) return 'Addebito diretto';
  if (/prelievo|bancomat|\batm\b/i.test(text)) return 'Prelievo';
  if (/pagamento (pos|carta)|\bpos\b|carta/i.test(text)) return 'Carta';
  return '';
}

const dayOf = (date) => new Date(`${date}T12:00:00`);
const weekday = (date) => dayOf(date).toLocaleDateString('it-IT', { weekday: 'long' });
const longDate = (date) => dayOf(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const normText = (s) => String(s ?? '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();
const sameKey = (t) => (t.amount > 0 ? 'in:' : '') + (normText(t.description) || t.description);
// Chi paga lo stipendio (Impostazioni → «Chi mi paga lo stipendio»): i suoi bonifici hanno descrizioni sempre un po' diverse, ma sono la stessa cosa.
const payerOf = (t) => (t.amount > 0 ? (state.payers ?? []).find((p) => normText(t.description).includes(normText(p))) : undefined);
const groupKey = (t) => { const p = payerOf(t); return p ? `in:@${normText(p)}` : sameKey(t); };
const searchUrl = (t) => `https://www.google.com/search?q=${encodeURIComponent(t.description)}`;
const mapsUrl = (t) => `https://www.google.com/maps/search/${encodeURIComponent(t.description)}`;
const catName = (c) => CATEGORY_NAME[c] ?? c;

// Riga di dati sotto la descrizione: tutto ciò che aiuta a capire di che pagamento si tratta.
function metaLine(t) {
  const bits = [methodOf(t), t.fee ? `commissione ${money(t.fee)}` : '', t.currency ? `in ${t.currency}` : '', t.detail ? t.detail.replace(/\s+/g, ' ').slice(0, 90) + (t.detail.length > 90 ? '…' : '') : ''].filter(Boolean);
  return bits.length ? `<small class="meta">${bits.map(esc).join(' · ')}</small>` : '';
}

function detailRow(t, similarByKey) {
  const same = similarByKey.get(groupKey(t)) ?? [t];
  const total = same.reduce((a, x) => a + Math.abs(x.amount), 0);
  const dates = same.map((x) => x.date).sort();
  const others = [...same].filter((x) => x.id !== t.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const fact = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
  const when = `${esc(longDate(t.date))}${t.time ? `, ore ${t.time}` : ''}${t.started ? ` <small class="muted">(iniziato il ${fmtDate(t.started)})</small>` : ''}`;
  const origin = t.category === 'bollette' && t.matchedDoc ? `Bolletta già contata: ${esc(t.matchedDoc)}` : '';
  return `<tr class="mvdetail"><td colspan="4"><div class="detailgrid">
    <dl class="facts">
      ${fact('Quando', when)}
      ${fact('Come', esc(methodOf(t)) + (t.type && TYPE_LABELS[t.type] ? ` <small class="muted">(${esc(t.type)})</small>` : ''))}
      ${fact('Importo', money(t.amount))}
      ${fact('Commissione', t.fee ? money(t.fee) : '')}
      ${fact('Valuta', esc(t.currency))}
      ${fact('Saldo dopo', t.balance != null ? money(t.balance) : '')}
      ${fact('Conto', esc(t.product))}
      ${fact('Categoria', `${esc(catName(t.category))} <small class="muted">· ${t.manual ? 'scelta da te' : 'assegnata in automatico'}</small>`)}
      ${fact('Documento', origin)}
      ${fact('Dettaglio', t.detail ? `<span class="rawdetail">${esc(t.detail)}</span>` : '')}
      ${fact('File', esc(t.file))}
    </dl>
    <div class="similar">
      <h4>Stessa descrizione</h4>
      <p>${same.length === 1 ? 'È l’unico movimento con questo nome.' : `${same.length} movimenti, ${money(total)} in tutto, ${money(total / same.length)} in media.<br>Dal ${fmtDate(dates[0])} al ${fmtDate(dates.at(-1))}.`}</p>
      ${others.length ? `<ul>${others.map((x) => `<li>${fmtDate(x.date)}${x.time ? ` ${x.time}` : ''} <span class="num">${x.amount > 0 ? '+' : ''}${money(x.amount)}</span></li>`).join('')}</ul>` : ''}
      <p class="links"><a href="${searchUrl(t)}" target="_blank" rel="noopener noreferrer" title="Apre una ricerca web con questa descrizione">Cerca su Google</a> · <a href="${mapsUrl(t)}" target="_blank" rel="noopener noreferrer" title="Apre Google Maps con questa descrizione">Su Maps</a></p>
    </div>
  </div></td></tr>`;
}

// ------------------------------------------------------------------ scheda Movimenti

function filteredMoves() {
  const { month, cat, q, flow } = state.bank;
  const needle = q.trim().toLowerCase();
  return state.moves.filter((t) => {
    if (month && Number(t.date.slice(5, 7)) !== month) return false;
    if (flow === 'in' && !(t.amount > 0)) return false;
    if (flow === 'out' && !(t.amount < 0)) return false;
    if (cat && t.category !== cat) return false;
    if (!needle) return true;
    return `${t.description} ${t.detail ?? ''} ${methodOf(t)} ${t.amount} ${money(t.amount)} ${fmtDate(t.date)} ${catName(t.category)}`.toLowerCase().includes(needle);
  });
}

function toggleExpand(id) {
  const open = state.bank.open;
  if (open.has(id)) open.delete(id); else open.add(id);
  renderMoves();
}

// Riquadri delle categorie: la suddivisione delle spese. Un clic filtra i movimenti di quella categoria.
function categoryCards(a) {
  const card = (c, { muted = false, name = catName(c.category), color = CATEGORY_COLOR[c.category], note = '' } = {}) => {
    const on = state.bank.cat === c.category;
    const share = c.share != null ? ` · ${(c.share * 100).toFixed(1).replace('.', ',')}%` : '';
    return `<button class="card catcard${on ? ' on' : ''}${muted ? ' muted-card' : ''}" data-cat="${c.category}" aria-pressed="${on}" title="${on ? 'Clic per togliere il filtro' : 'Clic per vedere solo questi movimenti'}"><div class="k"><i class="key" style="--c:${color}"></i> ${esc(name)}${note}</div><div class="v">${money(c.total)}</div><div class="sub">${c.count} movimenti${share}</div></button>`;
  };
  const inflow = a.inflows.find((c) => c.category === 'entrate');
  const hidden = a.excluded.filter((c) => c.count);
  return [
    ...a.categories.filter((c) => c.count || state.bank.cat === c.category).map((c) => card(c, { note: c.column ? '' : ' <small>· fuori dalla tabella</small>' })),
    inflow?.count ? card(inflow, { name: 'Altre entrate', color: 'var(--viz-entrate)' }) : '',
    ...hidden.map((c) => card(c, { muted: true, note: ' <small>· non conta</small>' })),
  ].join('');
}

function renderMoves() {
  const a = state.bank.data;
  const empty = !state.moves.length && !(a && (a.count || a.months?.some((m) => m.bank && Object.values(m.bank).some(Boolean))));
  $('#movesEmpty').hidden = !empty;
  if (empty) { $('#movesBody').innerHTML = ''; return; }

  const list = filteredMoves();
  const out = list.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const inn = list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const summary = `<p class="muted resultline">${list.length} movimenti · uscite ${money(out)} · entrate ${money(inn)} <span title="Compresi i giroconti e le bollette già contate nei documenti, che non entrano nei totali dell'app">(${periodLabel()})</span>. I pagamenti allo stesso ente sono in una riga sola: toccala per vederli. Cambia la categoria dal menu: vale per tutte le descrizioni uguali.</p>`;
  const flowName = { in: 'solo entrate', out: 'solo uscite' }[state.bank.flow];
  const filter = (state.bank.cat ? `<p class="catfilter">Categoria: <b>${esc(catName(state.bank.cat))}</b> <button class="link" data-clearcat="1">Togli il filtro</button></p>` : '')
    + (flowName ? `<p class="catfilter">Mostro <b>${flowName}</b> <button class="link" data-clearflow="1">Mostra tutto</button></p>` : '');
  $('#movesBody').innerHTML = filter + summary + movesTable(list);
}

// Un solo elenco: i pagamenti con la stessa descrizione (lo stesso ente) sono accorpati in una riga che si apre sui singoli movimenti.
function moveEntries(list) {
  const groups = new Map();
  for (const t of list) {
    const k = groupKey(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  return [...groups.entries()].map(([k, items]) => {
    items.sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`));
    const first = items[0];
    return {
      id: items.length > 1 ? `g:${k}` : first.id, items, group: items.length > 1, first, last: items.at(-1),
      date: `${first.date} ${first.time ?? ''}`, description: first.description, category: first.category,
      title: payerOf(first) ? `Stipendio · ${payerOf(first)}` : shortName(first.description),
      // un menu per più descrizioni: la categoria si cambia per ognuna (una per descrizione diversa)
      ids: [...new Map(items.map((t) => [t.description, t.id])).values()],
      amount: items.reduce((s, t) => s + t.amount, 0),
    };
  });
}

function movesTable(list) {
  if (!list.length) return '<div class="empty"><p>Nessun movimento con questi filtri.</p></div>';
  const rows = sortList(moveEntries(list), 'moves', { date: (e) => e.date, description: (e) => e.title, amount: (e) => Math.abs(e.amount), count: (e) => e.items.length, category: (e) => e.category });
  const similar = new Map();
  for (const t of state.moves) {
    const k = groupKey(t);
    if (!similar.has(k)) similar.set(k, []);
    similar.get(k).push(t);
  }
  const expander = (id, open, label) => `<button class="expander" data-expand="${id}" aria-expanded="${open}" title="${open ? 'Nascondi' : 'Mostra'} i dettagli" aria-label="Dettagli di ${esc(label)}">${open ? '▾' : '▸'}</button>`;
  const single = (t, cls = '') => {
    const open = state.bank.open.has(t.id);
    return `<tr class="mv${cls}${open ? ' open' : ''}" data-mv="${t.id}">
      <td class="dcol">${expander(t.id, open, t.description)}<span>${fmtDate(t.date)}<small>${weekday(t.date)}${t.time ? ` · ${t.time}` : ''}</small></span></td>
      <td class="desc"><span class="dtext" title="${esc(t.description)}">${esc(payerOf(t) ? `Stipendio · ${payerOf(t)}` : shortName(t.description))}</span>${metaLine(t)}${t.matchedDoc ? `<small class="doc">→ ${esc(t.matchedDoc)}</small>` : ''}</td>
      <td class="num ${t.amount > 0 ? 'pos-in' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</td>
      <td>${categorySelect('data-move', t.id, t.category, t.description, t.amount > 0)}</td></tr>${open ? detailRow(t, similar) : ''}`;
  };
  // Riga di un singolo pagamento dentro un gruppo aperto: senza menu della categoria (vale per tutto il gruppo).
  const part = (t) => {
    const open = state.bank.open.has(t.id);
    return `<tr class="mv sub${open ? ' open' : ''}" data-mv="${t.id}">
      <td class="dcol">${expander(t.id, open, t.description)}<span>${fmtDate(t.date)}<small>${weekday(t.date)}${t.time ? ` · ${t.time}` : ''}</small></span></td>
      <td class="desc">${metaLine(t) || '<small class="meta">&nbsp;</small>'}</td>
      <td class="num ${t.amount > 0 ? 'pos-in' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</td>
      <td class="nocat"></td></tr>${open ? detailRow(t, similar) : ''}`;
  };
  const body = rows.map((e) => {
    if (!e.group) return single(e.first);
    const open = state.bank.open.has(e.id);
    const n = e.items.length;
    const t = e.first;
    return `<tr class="mv group${open ? ' open' : ''}" data-mv="${e.id}">
      <td class="dcol">${expander(e.id, open, t.description)}<span>${fmtDate(t.date)}<small>ultimo · ${weekday(t.date)}</small></span></td>
      <td class="desc"><span class="dtext" title="${esc(t.description)}">${esc(e.title)}</span><small class="meta">${n} pagamenti dal ${fmtDate(e.last.date)} · media ${money(Math.abs(e.amount) / n)}</small></td>
      <td class="num ${e.amount > 0 ? 'pos-in' : ''}">${e.amount > 0 ? '+' : ''}${money(e.amount)}</td>
      <td>${categorySelect('data-moves', e.ids.join(','), t.category, e.title, t.amount > 0)}</td></tr>${open ? e.items.map(part).join('') : ''}`;
  }).join('');
  return `<div class="tablewrap"><table id="moveTable"><thead><tr>${sortHead('moves', 'date', 'Data')}${sortHead('moves', 'description', 'Descrizione')}${sortHead('moves', 'amount', 'Importo', 'num')}${sortHead('moves', 'category', 'Categoria')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ---------------------------------------------------------------- scheda Statistiche

function renderAnalysis() {
  const a = state.bank.data;
  if (!a) return;
  $('#analysisEmpty').hidden = a.count > 0 || a.months.length > 0;
  if (a.count === 0 && a.months.length === 0) { $('#analysisBody').innerHTML = ''; return; }

  const cats = a.categories;
  const top = cats.flatMap((c) => c.merchants.map((m) => ({ ...m, cat: c.category }))).sort((x, y) => y.total - x.total).slice(0, 10);
  const numbers = a.months.map((m) => {
    const out = m.bills + m.spesa + m.svago + m.carburante;
    return `<tr><td>${monthLong(m.ym)}</td><td class="num">${money(m.income) || '–'}</td><td class="num">${money(m.otherIncome) || '–'}</td><td class="num">${money(m.bills) || '–'}</td><td class="num">${money(m.spesa) || '–'}</td><td class="num">${money(m.svago) || '–'}</td><td class="num">${money(m.carburante) || '–'}</td><td class="num">${money(m.bank.donazioni) || '–'}</td><td class="num">${money(m.bank.tasse) || '–'}</td><td class="num">${money(m.bank.altro) || '–'}</td><td class="num"><b>${money(out) || '–'}</b></td><td class="num ${m.income ? (m.income - out >= 0 ? 'pos' : 'neg') : ''}">${m.income ? money(m.income - out) : '–'}</td></tr>`;
  }).join('');

  $('#analysisBody').innerHTML = `
    <p class="muted">${a.count} uscite bancarie, ${money(a.total)} in tutto (${periodLabel()}). Tocca una categoria per vederne i movimenti.</p>
    <div class="cards catcards">${categoryCards(a)}</div>
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
    </details>`;

  const pick = (ym) => {
    state.bank.year = Number(ym.slice(0, 4));
    state.bank.month = Number(ym.slice(5));
    loadBank().catch((err) => toast(err.message));
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
  const ids = (select.dataset.moves ?? select.dataset.move ?? select.dataset.amove).split(',');
  for (const id of ids) await api('/api/transactions', { method: 'PUT', body: { id, category: select.value } });
  await Promise.all([loadBank(), loadGrid()]);
  toast('Categoria salvata: la ricorderò per i movimenti con la stessa descrizione.');
}

// Carica documento: si sceglie il file, il nome e che cosa è (estratto conto, bolletta o busta paga).
const UPLOAD_TYPES = { estratto: 'Estratto conto', bolletta: 'Bolletta', busta: 'Busta paga' };
const UPLOAD_HINTS = {
  estratto: 'CSV (Revolut: Conti → Estratti → Excel/CSV) o PDF (UniCredit, Revolut): i movimenti si aggiungono a Movimenti, senza duplicati.',
  bolletta: 'PDF della bolletta: ne leggo importo e mese. Se il mese non è nel PDF, scrivilo nel nome (es. «Luce 2026.09»).',
  busta: 'PDF della busta paga: ne leggo il netto in busta e il mese.',
};

// Prima ipotesi sul tipo di documento, dal nome e dall'estensione del file.
function guessUpload(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  if (/\.csv$/i.test(fileName) || /estratt|movimenti|statement/i.test(fileName)) return { base, type: 'estratto' };
  if (/busta|cedolino|stipendi|payslip/i.test(fileName)) return { base, type: 'busta' };
  const kind = /acqua|idric/i.test(fileName) ? 'acqua' : /luce|elettric|energia/i.test(fileName) ? 'luce' : /\bgas\b/i.test(fileName) ? 'gas' : /wifi|wi-fi|internet|fibra|telefon/i.test(fileName) ? 'wifi' : '';
  const place = /crispiano/i.test(fileName) ? 'crispiano' : /budrio/i.test(fileName) ? 'budrio' : '';
  return { base, type: 'bolletta', kind, place };
}

function openUpload() {
  const dlg = $('#uploadDlg');
  const opt = (v, l) => `<option value="${v}">${l}</option>`;
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <h2>Carica documento</h2>
    <label>File<input type="file" name="file" accept=".pdf,.csv,application/pdf,text/csv" required></label>
    <label>Nome<input name="name" placeholder="Es. Luce 2026.09" autocomplete="off" required></label>
    <label>Che documento è?<select name="type">${Object.entries(UPLOAD_TYPES).map(([v, l]) => opt(v, l)).join('')}</select></label>
    <div class="row" id="upBill" hidden>
      <label>Utenza<select name="kind">${['acqua', 'luce', 'gas', 'wifi'].map((k) => opt(k, KINDS.find((x) => x.id === k).label)).join('')}</select></label>
      <label>Casa<select name="place">${Object.entries({ budrio: 'Budrio', crispiano: 'Crispiano' }).map(([v, l]) => opt(v, l)).join('')}</select></label>
    </div>
    <p class="muted" id="upHint"></p>
    <p class="error" id="upErr" role="alert"></p>
    <div class="foot"><button type="button" class="ghost" data-act="close">Annulla</button><button class="primary" id="upGo">Carica</button></div></form>`;
  const form = dlg.querySelector('form');
  const sync = () => {
    $('#upBill').hidden = form.type.value !== 'bolletta';
    $('#upHint').textContent = UPLOAD_HINTS[form.type.value];
    form.file.accept = form.type.value === 'estratto' ? '.pdf,.csv,application/pdf,text/csv' : '.pdf,application/pdf';
  };
  sync();
  form.type.addEventListener('change', sync);
  form.file.addEventListener('change', () => {
    const f = form.file.files[0];
    if (!f) return;
    const g = guessUpload(f.name);
    if (!form.name.value.trim()) form.name.value = g.base;
    form.type.value = g.type;
    if (g.kind) form.kind.value = g.kind;
    if (g.place) form.place.value = g.place;
    sync();
  });
  form.addEventListener('click', (e) => { if (e.target.dataset.act === 'close') dlg.close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = form.file.files[0];
    const type = form.type.value;
    const fail = (msg) => { $('#upErr').textContent = msg; };
    if (!file) return fail('Scegli un file.');
    if (type !== 'estratto' && !/\.pdf$/i.test(file.name)) return fail('Le bollette e le buste paga devono essere file PDF.');
    const params = new URLSearchParams({ type, name: form.name.value });
    if (type === 'bolletta') { params.set('kind', form.kind.value); params.set('place', form.place.value); }
    const go = $('#upGo');
    go.disabled = true;
    go.textContent = 'Caricamento…';
    fail('');
    try {
      const r = await api(`/api/upload?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, raw: file });
      dlg.close();
      if (r.type === 'estratto') toast(`Movimenti aggiunti: ${r.added}${r.duplicates ? ` (${r.duplicates} già presenti)` : ''}.${r.warning ? ` Attenzione: ${r.warning}.` : ''}`, r.warning ? 9000 : 4500);
      else if (r.doc.status === 'ok') toast(`Caricato: ${KINDS.find((k) => k.id === r.doc.kind)?.label ?? ''} ${MONTHS[r.doc.month - 1]} ${r.doc.year}, ${money(r.doc.amount)}.`);
      else toast(`Caricato, ma da controllare: non ho letto ${r.doc.missing.join(', ')}. Apri Modifica nell'elenco.`, 9000);
      await Promise.all([loadDocs(), loadGrid(), loadBank()]);
    } catch (err) {
      fail(err.message);
      go.disabled = false;
      go.textContent = 'Carica';
    }
  });
  dlg.showModal();
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
    <div class="dlghead"><button type="button" class="back" data-act="close" aria-label="Indietro" title="Indietro">←</button><h2>Impostazioni</h2></div>
    <details class="fs"><summary>Dove si trovano i documenti</summary><div class="fsbody">
      <label>Buste paga<input name="payslipsSource" value="${esc(s.payslipsSource)}" placeholder="Link Seafile (…/d/xxxx/) o percorso locale" autocomplete="off"></label>
      <label>Bollette<input name="billsSource" value="${esc(s.billsSource)}" placeholder="Link Seafile (…/d/xxxx/) o percorso locale" autocomplete="off"></label>
      <label>Estratti conto (CSV)<input name="statementsSource" value="${esc(s.statementsSource)}" placeholder="Link Seafile (…/d/xxxx/) o percorso locale con i CSV" autocomplete="off"></label>
      <small>Le sottocartelle vengono lette in automatico. I link Seafile devono essere pubblici, senza password. Gli estratti conto si leggono dai file CSV della banca.</small>
    </div></details>
    <details class="fs"><summary>Affitto</summary><div class="fsbody">
      <div class="row">
        <label>Importo mensile (€)<input name="rentAmount" inputmode="decimal" value="${inputValue(s.rentAmount || null)}" placeholder="0"></label>
        <label>Dal mese<input name="rentFrom" type="month" value="${esc(s.rentFrom)}"></label>
      </div>
      <small>Viene aggiunto automaticamente ogni mese, senza PDF. Nella tabella si segna pagato con un clic.</small>
    </div></details>
    <details class="fs"><summary>Riconoscimento automatico</summary><div class="fsbody">
      <small>Lo stipendio (già nelle buste paga) e i giri tra i tuoi conti non si contano due volte. Nome e datore di lavoro si ricavano da soli dalle buste paga e dai movimenti: non serve scriverli.</small>
      <small><b>Stipendio da:</b> ${esc(s.incomePayers) || '— (si impara dopo due buste paga abbinate ai bonifici)'}<br><b>I miei conti (nome):</b> ${esc(s.ownNames) || '— (si impara dai giri tra i tuoi conti)'}</small>
      <small>Se un movimento è classificato male, cambia la categoria in Movimenti: la scelta vale per tutte le descrizioni uguali.</small>
    </div></details>
    <details class="fs" id="bkBox"><summary>Collega le banche</summary><div class="fsbody" id="bkBody"><p class="muted">Caricamento…</p></div></details>
    ${state.protected ? '<details class="fs"><summary>Account</summary><div class="fsbody"><button type="button" class="ghost" data-act="logout">Esci dall&rsquo;app</button></div></details>' : ''}
    <p class="error" id="setErr" role="alert"></p>
    <div class="foot sticky" id="setFoot" hidden><button class="primary">Salva le modifiche</button></div>
  </form>`;
  const form = dlg.querySelector('form');
  // «Salva» compare solo se un campo è diverso da com'era all'apertura; tornare indietro con modifiche chiede conferma.
  const watched = ['payslipsSource', 'billsSource', 'statementsSource', 'rentAmount', 'rentFrom'];
  const snapshot = () => watched.map((k) => form[k].value).join('\u0001');
  const initial = snapshot();
  const dirty = () => snapshot() !== initial;
  const refreshFoot = () => { $('#setFoot').hidden = !dirty(); };
  form.addEventListener('input', refreshFoot);
  form.addEventListener('change', refreshFoot);
  const leave = () => { if (!dirty() || confirm('Hai modifiche non salvate. Uscire senza salvare?')) dlg.close(); };
  dlg.oncancel = (e) => { if (dirty() && !confirm('Hai modifiche non salvate. Uscire senza salvare?')) e.preventDefault(); };
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=close]')) leave();
    if (e.target.dataset.act === 'logout') logout();
    if (e.target.dataset.act?.startsWith('bk-')) bankAction(e.target).catch((err) => toast(err.message, 8000));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: {
          payslipsSource: form.payslipsSource.value,
          billsSource: form.billsSource.value,
          statementsSource: form.statementsSource.value,
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
  loadBanking().catch((err) => { $('#bkBody').innerHTML = `<p class="error">${esc(err.message)}</p>`; });
}

// ------------------------------------------------------------------- banche collegate

const BANK_HELP = `
  <details><summary class="muted">Che dati leggo?</summary>
    <p><small><b>Conti</b>: nome, IBAN (mascherato qui) e valuta. <b>Movimenti registrati</b>: data, importo, entrata o uscita, controparte (negozio o mittente), causale e, se la banca lo fornisce, il saldo dopo il movimento; finiscono in Movimenti, con le categorie di sempre. L'accesso è <b>in sola lettura</b>: l'app non può spostare denaro. <b>Non</b> sono disponibili le carte di credito UniCredit, gli investimenti né i pagamenti ricorrenti. Quanto storico arriva dipende dalla banca (al primo collegamento si chiede un anno, poi ci si ferma a ciò che concede). Le banche permettono 4 letture al giorno e il consenso va rinnovato ogni pochi mesi.</small></p>
  </details>`;

async function loadBanking() {
  renderBanking(await api('/api/banking'));
}

function renderBanking(b) {
  const box = $('#bkBody');
  if (!box) return;
  const when = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'mai');
  const conns = b.connections.map((c) => `<div class="bkconn">
    <b>${esc(c.label)}</b> <small class="muted">· ${c.accounts.map((a) => esc(a.name || a.iban)).join(', ')}</small>
    <small class="${c.expired || (c.daysLeft != null && c.daysLeft < 14) ? 'warnline' : 'muted'}">${c.expired ? 'Collegamento scaduto: ricollega la banca' : `Valido ancora ${c.daysLeft} giorni`} · ultimo aggiornamento: ${when(c.lastSync)} · letture oggi ${c.syncsToday}/${c.syncsPerDay}</small>
    <div class="foot"><button type="button" class="link" data-act="bk-sync" data-id="${esc(c.id)}">Aggiorna ora</button><button type="button" class="link danger" data-act="bk-remove" data-id="${esc(c.id)}">Scollega</button></div></div>`).join('');
  const connect = b.banks.map((k) => `<button type="button" class="ghost" data-act="bk-connect" data-bank="${k.key}" ${b.configured ? '' : 'disabled'}>${b.connections.some((c) => c.bank === k.key) ? 'Ricollega' : 'Collega'} ${esc(k.label)}</button>`).join('');
  box.innerHTML = `<small>Leggo i movimenti di UniCredit e Revolut direttamente dalla banca, senza scaricare estratti. Usa Enable Banking, gratuito per uso personale: serve una tua applicazione (qui sotto).</small>
    ${conns}
    <div class="row">${connect}</div>
    ${BANK_HELP}
    <details ${b.configured ? '' : 'open'}><summary class="muted">Credenziali Enable Banking</summary>
      <p><small>1) Crea un account su enablebanking.com. 2) Nel Control Panel registra un'applicazione <b>di produzione</b>, con questo indirizzo di ritorno: <code>${esc(b.redirectUrl)}</code>. 3) Usa «Activate by linking accounts» per collegare i tuoi conti. Il browser scarica un file <b>.pem</b> (la chiave privata): il suo nome è l'ID dell'applicazione. Chiave e ID restano solo su questo server.</small></p>
      <label>ID applicazione<input name="bkAppId" value="${esc(b.appId)}" autocomplete="off" spellcheck="false"></label>
      <label>Chiave privata (.pem)<textarea name="bkKey" rows="4" spellcheck="false" autocomplete="off" placeholder="${b.hasKey ? 'Chiave già salvata: lascia vuoto per non cambiarla' : '-----BEGIN PRIVATE KEY-----'}"></textarea></label>
      <div class="foot"><button type="button" class="ghost" data-act="bk-save">Salva credenziali</button></div>
    </details>`;
}

async function bankAction(btn) {
  const act = btn.dataset.act;
  const form = btn.closest('form');
  if (act === 'bk-save') {
    renderBanking(await api('/api/banking/app', { method: 'PUT', body: { appId: form.bkAppId.value, privateKey: form.bkKey.value } }));
    toast('Credenziali salvate. Ora puoi collegare le banche.');
  } else if (act === 'bk-connect') {
    const r = await api('/api/banking/connect', { method: 'POST', body: { bank: btn.dataset.bank } });
    toast('Ti porto sul sito della banca per autorizzare l\'accesso in sola lettura…', 6000);
    location.href = r.url;
  } else if (act === 'bk-sync') {
    btn.disabled = true;
    try {
      const r = await api('/api/banking/sync', { method: 'POST', body: { id: btn.dataset.id } });
      toast(`Letti ${r.found} movimenti dalla banca: ${r.added} nuovi.`);
      renderBanking(r);
      await Promise.all([loadGrid(), loadBank()]);
    } finally { btn.disabled = false; }
  } else if (act === 'bk-remove') {
    if (!confirm('Scollegare questa banca? I movimenti già letti restano.')) return;
    renderBanking(await api(`/api/banking/connections/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' }));
  }
}

// ------------------------------------------------------------------- refresh

function refreshSummary(r) {
  const parts = [];
  if (r.added) parts.push(`${r.added} nuovi`);
  if (r.updated) parts.push(`${r.updated} aggiornati`);
  if (r.removed) parts.push(`${r.removed} rimossi`);
  if (r.transactions) parts.push(`${r.transactions} movimenti bancari`);
  if (r.bankTransactions) parts.push(`${r.bankTransactions} movimenti dalle banche collegate`);
  if (r.ocr) parts.push(`${r.ocr} scansioni lette con OCR`);
  if (r.incomplete) parts.push(`${r.incomplete} da controllare`);
  let msg = parts.length ? `Documenti: ${parts.join(', ')}.` : 'Tutto aggiornato, nessun documento nuovo.';
  if (r.errors.length) msg += ` Errori: ${r.errors.map((e) => `${e.source}: ${e.message}`).join(' · ')}`;
  return msg;
}

// All'apertura: cerca documenti nuovi o modificati. La targhetta in alto dice cosa sta succedendo;
// se non cambia nulla, nessun messaggio.
// Lettura dei documenti avviata da qualcun altro (un altro browser, lo script di importazione…): la pagina se ne accorge,
// avvisa che i dati sono parziali e si aggiorna da sola finché non ha finito.
let watching = false;
let localRefresh = false;
async function watchRefresh() {
  if (watching) return;
  watching = true;
  const badge = $('#scanBadge');
  const btn = $('#refreshBtn');
  const banner = $('#partialBanner');
  badge.hidden = false;
  btn.disabled = true;
  let lastReload = 0;
  try {
    for (;;) {
      const p = await api('/api/refresh/status').catch(() => null);
      if (p && !p.running) break;
      const text = p?.total ? `Lettura dei documenti in corso: ${p.done} su ${p.total}. I dati sono parziali e si aggiornano da soli.` : 'Lettura dei documenti in corso. I dati sono parziali e si aggiornano da soli.';
      badge.querySelector('.txt').textContent = p?.total ? `Lettura ${p.done}/${p.total}…` : 'Lettura in corso…';
      banner.hidden = false;
      banner.innerHTML = `<span class="spin"></span><span>${esc(text)}</span>${p?.total ? `<span class="bar"><i style="width:${Math.round((p.done / p.total) * 100)}%"></i></span>` : ''}`;
      const typing = document.activeElement?.classList?.contains('expense-input');
      if (Date.now() - lastReload > 20000 && !typing) {
        lastReload = Date.now();
        await Promise.all([loadGrid(), loadDocs()]).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  } finally {
    badge.hidden = true;
    banner.hidden = true;
    btn.disabled = false;
    watching = false;
  }
  await Promise.all([loadGrid(), loadDocs(), loadMoves()]).catch(() => {});
  if (!$('#analysis').hidden) loadAnalysis().catch(() => {});
  toast('Lettura dei documenti completata: i dati sono aggiornati.');
}
setInterval(() => {
  if (watching || localRefresh) return;
  api('/api/refresh/status').then((p) => { if (p.running) watchRefresh(); }).catch(() => {});
}, 15000);

async function autoScan() {
  const status = await api('/api/refresh/status').catch(() => null);
  if (status?.running) return watchRefresh();
  localRefresh = true;
  const badge = $('#scanBadge');
  const btn = $('#refreshBtn');
  badge.hidden = false;
  badge.querySelector('.txt').textContent = 'Controllo nuovi documenti…';
  btn.disabled = true;
  let retryWatch = false;
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
    if (/già in corso/.test(err.message)) retryWatch = true;
    else toast(err.message, 8000);
  } finally {
    clearInterval(poll);
    badge.hidden = true;
    btn.disabled = false;
    localRefresh = false;
  }
  if (retryWatch) watchRefresh();
}

async function doRefresh(force = false) {
  if (watching) return toast('Una lettura è già in corso: attendi che finisca.');
  localRefresh = true;
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
    localRefresh = false;
    await Promise.all([loadGrid(), loadDocs(), loadMoves()]);
  }
}

// ------------------------------------------------------------------ eventi

// Tasto «indietro» del telefono (app Android): se c'è un pannello aperto lo chiude, altrimenti lascia fare all'app.
window.__back = () => {
  const d = document.querySelector('dialog[open]');
  if (!d) return false;
  d.dispatchEvent(new Event('cancel', { cancelable: true })) && d.close();
  return true;
};

// Dalla Panoramica ai Movimenti: stesso anno e mese della cella; Entrate e Uscite mostrano solo quel verso.
function openMovesOf(kind, month) {
  Object.assign(state.bank, { year: state.year, month, cat: '', q: '', flow: kind === 'entrate' ? 'in' : kind === 'uscite' ? 'out' : '' });
  $('#moveSearch').value = '';
  showTab('moves');
}

function showTab(name) {
  document.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  for (const id of ['overview', 'docs', 'moves', 'analysis']) $(`#${id}`).hidden = id !== name;
  $('#years').hidden = name !== 'overview';
  if (name === 'moves' || name === 'analysis') loadBank().catch((err) => toast(err.message));
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.sort) { setSort(t.dataset.sort); return; }
  if (t.classList.contains('f-reset')) { resetBank(); return; }
  if (t.classList.contains('catcard')) { state.bank.cat = t.dataset.cat; showTab('moves'); return; }
  if (t.dataset.clearcat) { state.bank.cat = ''; renderBank(); return; }
  if (t.dataset.clearflow) { state.bank.flow = ''; renderBank(); return; }
  if (t.dataset.expand) { toggleExpand(t.dataset.expand); return; }
  if (t.dataset.payallEverything) payEverything().catch((err) => toast(err.message));
  else if (t.dataset.payall) payAll(t.dataset.payall).catch((err) => toast(err.message));
  else if (t.dataset.doc !== undefined) openDoc(Number(t.dataset.doc));
  else if (t.dataset.tab) showTab(t.dataset.tab);
});
// Clic (o Spazio/Invio) su una cella: pagato / da pagare. A sinistra, il link apre invece il documento.
const onPaidCell = (e) => {
  const cell = e.target.closest('.pcell');
  if (!cell || e.target.closest('.zone-open')) return false;
  togglePaid(cell.dataset.col, Number(cell.dataset.month)).catch((err) => toast(err.message));
  return true;
};
document.addEventListener('click', onPaidCell);
document.addEventListener('click', (e) => {
  const cell = e.target.closest('[data-go]');
  if (cell && !e.target.closest('button, a, input, select')) openMovesOf(cell.dataset.go, Number(cell.dataset.month));
});
document.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && e.target.classList?.contains('pcell') && onPaidCell(e)) e.preventDefault();
  if ((e.key === ' ' || e.key === 'Enter') && e.target.dataset?.go) { e.preventDefault(); openMovesOf(e.target.dataset.go, Number(e.target.dataset.month)); }
  if (e.key === 'Enter' && e.target.classList?.contains('expense-input')) e.target.blur();
});
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('f-year') || e.target.classList.contains('f-month')) {
    const bar = e.target.closest('.bankbar');
    state.bank.year = Number(bar.querySelector('.f-year').value);
    state.bank.month = Number(bar.querySelector('.f-month').value);
    loadBank().catch((err) => toast(err.message));
    return;
  }
  if (e.target.id === 'moveSort') {
    const [key, dir] = e.target.value.split(':');
    Object.assign(sorting.moves, { key, dir });
    renderMoves();
    return;
  }
  if (e.target.id === 'catSelect') { state.bank.cat = e.target.value; renderBank(); return; }
  if (e.target.id === 'yearSelect') { state.year = Number(e.target.value); loadGrid().catch((err) => toast(err.message)); return; }
  if (e.target.dataset.move || e.target.dataset.amove || e.target.dataset.moves) setCategory(e.target).catch((err) => toast(err.message));
  if (e.target.classList.contains('expense-input')) saveExpense(e.target).catch((err) => toast(err.message));
});
$('#uploadBtn').addEventListener('click', openUpload);
let searchTimer;
$('#moveSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.bank.q = e.target.value; renderBank(); }, 150);
});
// Clic su una riga dei movimenti: mostra o nasconde i dettagli (non quando si usa il menu o un link).
$('#movesBody').addEventListener('click', (e) => {
  const row = e.target.closest('tr.mv');
  if (!row || e.target.closest('select, a, button')) return;
  toggleExpand(row.dataset.mv);
});
$('#refreshBtn').addEventListener('click', (e) => doRefresh(e.shiftKey));
$('#refreshBtn').title = 'Rilegge i documenti nuovi o modificati (Maiusc+clic: rilegge tutto)';
$('#settingsBtn').addEventListener('click', () => openSettings().catch((err) => toast(err.message)));

api('/api/version').then(({ version, serverVersion, protected: hasPassword }) => {
  // In localhost collegato al server: pagine locali, dati del server.
  const local = serverVersion !== undefined;
  $('#version').textContent = `v${version}${local ? ' · locale' : ''}`;
  if (local) $('#version').title = `Pagine di questa cartella (v${version}) con i dati del server${serverVersion ? ` (v${serverVersion})` : ''}`;
  state.protected = hasPassword;
  $('#logoutBtn').hidden = !hasPassword;
}).catch(() => {});
async function logout() {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  location.href = '/login';
}
$('#logoutBtn').addEventListener('click', logout);
Promise.all([loadGrid(), loadDocs()]).then(autoScan).catch((err) => toast(err.message));
