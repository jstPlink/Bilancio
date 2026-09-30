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
  const dueParts = EXPENSES.filter((k) => s.toPay[k.id] > 0).map((k) => k.label).join(', ');
  $('#cards').innerHTML = [
    card('Da pagare', money(s.totalToPay) || money(0), dueParts || 'Tutto pagato', 'due'),
    card(`Stipendio medio ${state.year}`, money(s.avgIncome) || '—'),
    card('Spese medie al mese', money(s.avgSpent) || '—'),
    card('Risparmio medio al mese', money(s.avgBalance) || '—'),
  ].join('');
}

// I valori delle celle vengono solo dai documenti (e dalle rate fisse nelle impostazioni):
// qui non si modificano. Spese, Svago e Carburante vengono dall'estratto conto e si possono correggere a mano.
function cellHtml(kind, month, c) {
  const empty = c.amount == null;
  const name = KINDS.find((k) => k.id === kind).label;
  const label = `${name} ${MONTHS[month - 1]}`;
  if (SPENDING.has(kind)) {
    return `<input class="expense-input" inputmode="decimal" data-kind="${kind}" data-month="${month}" value="${inputValue(c.amount)}" placeholder="–" aria-label="${label}">`;
  }
  if (empty) return '<div class="static blank"><span class="num">–</span></div>';
  if (NO_PAYMENT.has(kind)) return `<div class="static"><span class="num">${money(c.amount)}</span></div>`;
  // L'intera cella è la casella: verde se pagata, rossa se da pagare. Il link apre il PDF.
  const pdf = c.files.map((f) => `<a class="filelink" href="/api/file?key=${encodeURIComponent(f.key)}" target="_blank" rel="noopener" title="Apri ${esc(f.name)}" aria-label="Apri il PDF: ${esc(f.name)}">PDF</a>`).join('');
  return `<div class="pcell ${c.paid ? 'paid' : 'due'}" role="checkbox" aria-checked="${c.paid}" tabindex="0" data-kind="${kind}" data-month="${month}" aria-label="${label}: ${c.paid ? 'pagato' : 'da pagare'}" title="${c.paid ? 'Pagato' : 'Da pagare'} · clic per cambiare"><span class="num">${money(c.amount)}</span>${pdf}</div>`;
}

async function togglePaid(kind, month) {
  const paid = state.grid.rows.find((r) => r.month === month).cells[kind].paid;
  await setPaid(kind, month, !paid);
}

async function saveExpense(input) {
  const amount = parseInput(input.value);
  if (Number.isNaN(amount)) { toast('Importo non valido.'); return loadGrid(); }
  await api('/api/manual', { method: 'POST', body: { kind: input.dataset.kind, year: state.year, month: Number(input.dataset.month), amount } });
  await loadGrid();
}

// Gruppi di colonne: uno spazio ben visibile separa guadagno, spese e riepilogo.
function renderGrid() {
  const { rows, summary: s } = state.grid;
  const groupStart = new Set(['stipendio', 'acqua']);
  const cls = (id) => (groupStart.has(id) ? 'gstart' : '');
  const head = KINDS.map((k) => `<th class="${cls(k.id)}"><span class="dot" style="background:var(--${k.id})"></span>${k.label}</th>`).join('');
  const body = rows.map((r) => {
    const tone = r.balance == null ? '' : r.balance >= 0 ? 'pos' : 'neg';
    return `<tr><th scope="row">${MONTHS[r.month - 1]}</th>${KINDS.map((k) => `<td class="num ${cls(k.id)}">${cellHtml(k.id, r.month, r.cells[k.id])}</td>`).join('')}
      <td class="num gstart total">${money(r.spent)}</td><td class="num total ${tone}">${money(r.balance)}</td></tr>`;
  }).join('');
  const foot = `
    <tr><th>Media ${state.year}</th>${KINDS.map((k) => `<td class="num ${cls(k.id)}">${money(s.average[k.id]) || '–'}</td>`).join('')}<td class="num gstart total">${money(s.avgSpent) || '–'}</td><td class="num total">${money(s.avgBalance) || '–'}</td></tr>
    <tr><th>Da pagare</th>${KINDS.map((k) => `<td class="num ${cls(k.id)}">${NO_PAYMENT.has(k.id) ? '' : (s.toPay[k.id] ? `<button class="link" data-payall="${k.id}" title="Segna come pagato tutto ${k.label} fino a oggi">${money(s.toPay[k.id])}</button>` : '–')}</td>`).join('')}<td class="gstart total"></td><td class="total"></td></tr>`;
  const groups = `<tr class="groups"><th class="g-month">Mese</th><th class="gstart g-income">Guadagno</th><th class="gstart g-spend" colspan="${EXPENSES.length}">Spese</th><th class="gstart g-sum" colspan="2">Riepilogo</th></tr>`;
  $('#grid').innerHTML = `<thead>${groups}<tr><th class="g-month"></th>${head}<th class="gstart">Totale spese</th><th>Saldo</th></tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
}

async function setPaid(kind, month, paid) {
  await api('/api/paid', { method: 'POST', body: { kind, year: state.year, month, paid } });
  await loadGrid();
}

async function payAll(kind) {
  const now = new Date();
  const items = [];
  // Solo l'anno mostrato, e solo fino al mese corrente.
  for (const r of state.grid.rows) {
    const c = r.cells[kind];
    if (c.amount != null && !c.paid && (state.year < now.getFullYear() || r.month <= now.getMonth() + 1)) {
      items.push({ kind, year: state.year, month: r.month, paid: true });
    }
  }
  const name = KINDS.find((k) => k.id === kind).label;
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
  if (t.dataset.year) { state.year = Number(t.dataset.year); loadGrid(); if (!$('#moves').hidden) loadMoves().catch((err) => toast(err.message)); }
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
// Clic (o Spazio/Invio) su una cella: pagato / da pagare. Il link PDF apre invece il documento.
const onPaidCell = (e) => {
  const cell = e.target.closest('.pcell');
  if (!cell || e.target.closest('.filelink')) return false;
  togglePaid(cell.dataset.kind, Number(cell.dataset.month)).catch((err) => toast(err.message));
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
