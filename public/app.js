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
];
const EXPENSES = KINDS.filter((k) => k.id !== 'stipendio');
// Voci senza stato "pagato": lo stipendio (entrata) e le spese correnti, che arrivano dall'estratto conto.
const SPENDING = new Set(['spese', 'svago', 'carburante']);
const NO_PAYMENT = new Set(['stipendio', ...SPENDING]);
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
    card(`Stipendio medio ${state.year}`, money(s.avgIncome) || '—'),
    card('Spese medie al mese', money(s.avgSpent) || '—'),
    card('Risparmio medio al mese', money(s.avgBalance) || '—'),
  ].join('');
}

// I valori delle celle vengono solo dai documenti (e dalle rate fisse nelle impostazioni):
// qui non si modificano. Spese, Svago e Carburante vengono dall'estratto conto e si possono correggere a mano.
const colLabel = (col) => KINDS.find((k) => k.id === col.kind).label;
const colName = (col) => (col.place ? `${colLabel(col)} ${PLACE_LABELS[col.place]}` : colLabel(col));

function cellHtml(col, month, c) {
  const kind = col.kind;
  const label = `${colName(col)} ${MONTHS[month - 1]}`;
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
  // Più case nella stessa cella (acqua, wifi): il totale e, sotto, il dettaglio per casa.
  const split = c.parts.length > 1;
  const detail = split ? c.parts.map((p) => `${PLACE_LABELS[p.place][0]} ${money(p.amount)}`).join(' · ') : '';
  const tip = split ? c.parts.map((p) => `${PLACE_LABELS[p.place]}: ${money(p.amount)} (${p.paid ? 'pagato' : 'da pagare'})`).join(' · ') : (c.paid ? 'Pagato' : 'Da pagare');
  return `<div class="pcell ${c.paid ? 'paid' : 'due'}${split ? ' split' : ''}" role="checkbox" aria-checked="${c.paid}" tabindex="0" data-col="${col.id}" data-month="${month}" aria-label="${label}: ${c.paid ? 'pagato' : 'da pagare'}" title="${money(c.amount)} · ${tip}"><span class="amount"><span class="num">${money(c.amount)}</span>${split ? `<small class="parts">${detail}</small>` : ''}</span>${open ? `<span class="zone zone-open">${open}</span>` : ''}<span class="zone zone-pay${open ? '' : ' wide'}" data-pay="1" title="${c.paid ? 'Segna come da pagare' : 'Segna come pagato'}">${c.paid ? '↺' : '✓'}</span></div>`;
}

async function togglePaid(colId, month) {
  const col = state.grid.columns.find((c) => c.id === colId);
  const cell = state.grid.rows.find((r) => r.month === month).cells[colId];
  const items = cell.parts.map((p) => ({ kind: col.kind, year: state.year, month, place: p.place, paid: !cell.paid }));
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

// Gruppi di colonne: uno spazio ben visibile separa guadagno, spese e riepilogo.
// Luce e gas hanno una colonna per casa.
function renderGrid() {
  const { rows, columns, summary: s } = state.grid;
  const groupStart = new Set(['stipendio', 'acqua']);
  const cls = (col) => (groupStart.has(col.id) ? 'gstart' : '');
  const head = columns.map((c) => `<th class="${cls(c)}"><span class="dot" style="background:var(--${c.kind})"></span>${colLabel(c)}${c.place ? `<small class="place">${PLACE_LABELS[c.place]}</small>` : ''}</th>`).join('');
  const body = rows.map((r) => {
    const tone = r.balance == null ? '' : r.balance >= 0 ? 'pos' : 'neg';
    return `<tr><th scope="row">${MONTHS[r.month - 1]}</th>${columns.map((c) => `<td class="num ${cls(c)}">${cellHtml(c, r.month, r.cells[c.id])}</td>`).join('')}
      <td class="num gstart total">${money(r.spent)}</td><td class="num total ${tone}">${money(r.balance)}</td></tr>`;
  }).join('');
  const foot = `
    <tr><th>Media ${state.year}</th>${columns.map((c) => `<td class="num ${cls(c)}">${money(s.average[c.id]) || '–'}</td>`).join('')}<td class="num gstart total">${money(s.avgSpent) || '–'}</td><td class="num total">${money(s.avgBalance) || '–'}</td></tr>
    <tr><th>Da pagare</th>${columns.map((c) => `<td class="num ${cls(c)}">${NO_PAYMENT.has(c.kind) ? '' : (s.toPay[c.id] ? `<button class="link" data-payall="${c.id}" title="Segna come pagato tutto ${colName(c)} fino a oggi">${money(s.toPay[c.id])}</button>` : '–')}</td>`).join('')}<td class="gstart total"></td><td class="total"></td></tr>`;
  const spendCols = columns.filter((c) => c.kind !== 'stipendio').length;
  const groups = `<tr class="groups"><th class="g-month">Mese</th><th class="gstart g-income">Guadagno</th><th class="gstart g-spend" colspan="${spendCols}">Spese</th><th class="gstart g-sum" colspan="2">Riepilogo</th></tr>`;
  $('#grid').innerHTML = `<thead>${groups}<tr><th class="g-month"></th>${head}<th class="gstart" title="Comprende tutte le case">Totale spese</th><th title="Comprende tutte le case">Saldo</th></tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
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
  const col = state.grid.columns.find((c) => c.id === colId);
  const now = new Date();
  const items = [];
  // Solo l'anno mostrato, e solo fino al mese corrente.
  for (const r of state.grid.rows) {
    if (state.year < now.getFullYear() || r.month <= now.getMonth() + 1) {
      for (const p of r.cells[colId].parts) if (!p.paid) items.push({ kind: col.kind, year: state.year, month: r.month, place: p.place, paid: true });
    }
  }
  const name = colName(col);
  if (!items.length) return toast(`Nel ${state.year} non c'è nulla da segnare per ${name}.`);
  if (!confirm(`Segnare come pagati ${items.length} mesi di ${name} del ${state.year}?`)) return;
  await api('/api/paid', { method: 'POST', body: items });
  await loadGrid();
}

// ------------------------------------------------------------------ movimenti

const CATEGORY_LABELS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', altro: 'Altro (non conta)' };

async function loadMoves() {
  const { categories, transactions } = await api(`/api/transactions?year=${state.year}`);
  $('#movesEmpty').hidden = transactions.length > 0;
  $('#moveTable').hidden = transactions.length === 0;
  $('#moveTable').innerHTML = transactions.length ? `<thead><tr><th>Data</th><th>Descrizione</th><th class="num">Importo</th><th>Categoria</th></tr></thead><tbody>${
    transactions.map((t) => `<tr><td>${t.date.split('-').reverse().join('/')}</td><td class="fname" title="${esc(t.description)}">${esc(t.description)}</td><td class="num">${money(Math.abs(t.amount))}</td>
      <td><select data-move="${t.id}" aria-label="Categoria di ${esc(t.description)}">${categories.map((c) => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`).join('')}</select></td></tr>`).join('')}</tbody>` : '';
}

// Scheda temporanea: come sono smistati tutti i movimenti (di tutti gli anni), per voce e per descrizione.
const fmtDate = (d) => d.split('-').reverse().join('/');
async function loadAnalysis() {
  const a = await api('/api/analysis');
  const open = new Set([...document.querySelectorAll('#analysis details[open]')].map((d) => d.dataset.cat));
  $('#analysisEmpty').hidden = a.count > 0;
  $('#analysisBody').innerHTML = a.count ? `
    <p class="muted">${a.count} movimenti in uscita, ${money(a.total)} in tutto. Cambia la categoria di una descrizione dal menu: vale per tutti i movimenti uguali.</p>
    <div class="cards">${a.categories.map((c) => `<div class="card"><div class="k">${CATEGORY_LABELS[c.category].replace(' (non conta)', '')}${c.column ? '' : ' · fuori dalla tabella'}</div><div class="v">${money(c.total)}</div><div class="sub">${c.count} movimenti · ${(c.share * 100).toFixed(1).replace('.', ',')}%</div></div>`).join('')}</div>
    ${a.categories.map((c) => `<details class="acat" data-cat="${c.category}" ${open.has(c.category) || c.category === 'altro' ? 'open' : ''}>
      <summary>${CATEGORY_LABELS[c.category].replace(' (non conta)', '')} <span class="muted">· ${c.merchants.length} descrizioni · ${money(c.total)}</span></summary>
      <div class="tablewrap"><table class="atable"><thead><tr><th>Descrizione</th><th class="num">Volte</th><th class="num">Totale</th><th>Periodo</th><th>Categoria</th></tr></thead><tbody>${
        c.merchants.map((m) => `<tr><td class="fname" title="${esc(m.name)}">${esc(m.name)}</td><td class="num">${m.count}</td><td class="num">${money(m.total)}</td><td>${fmtDate(m.from)}${m.to !== m.from ? ` – ${fmtDate(m.to)}` : ''}</td>
        <td><select data-amove="${m.id}" aria-label="Categoria di ${esc(m.name)}">${a.categories.map((o) => `<option value="${o.category}" ${o.category === c.category ? 'selected' : ''}>${CATEGORY_LABELS[o.category]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    </details>`).join('')}` : '';
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
  await Promise.all([loadMoves(), loadGrid()]);
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
    <label>Tipo<select name="kind"><option value="">—</option>${KINDS.map((k) => opt(k.id, k.label, d.kind)).join('')}</select></label>
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
    <fieldset><legend>Prestito</legend>
      <div class="row">
        <label>Rata mensile (€)<input name="loanAmount" inputmode="decimal" value="${inputValue(s.loanAmount || null)}" placeholder="0"></label>
        <label>Dal mese<input name="loanFrom" type="month" value="${esc(s.loanFrom)}"></label>
      </div>
      <small>Lascia vuoto se non hai rate fisse: potrai comunque inserire gli importi a mano nella tabella.</small>
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
          rentAmount: parseInput(form.rentAmount.value) ?? 0,
          rentFrom: form.rentFrom.value,
          loanAmount: parseInput(form.loanAmount.value) ?? 0,
          loanFrom: form.loanFrom.value,
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
