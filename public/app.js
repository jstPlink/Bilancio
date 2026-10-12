// MyBank: interfaccia web (e dell'app Android, che la carica dal server). Nessuna dipendenza.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => (n == null ? '–' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n));
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'mai');
const THIS_YEAR = new Date().getFullYear();
let TAGS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', altro: 'Altro', non_definito: 'Non definito', entrata: 'Entrata', giroconto: 'Giroconto' };

const state = { tab: 'storico', year: THIS_YEAR, open: new Set(), bankOpen: {}, st: { year: THIS_YEAR, month: 0 }, mv: { year: THIS_YEAR, month: 0, tag: '', q: '', account: '' } };

// ------------------------------------------------------------------ rete

// Frontend locale (`npm start`): la pagina non ha dati né logica, ogni chiamata va al server scelto nella pagina di accesso.
// Sul server vero (e nell'app Android) questa modalità è spenta e le chiamate vanno allo stesso indirizzo della pagina.
const local = { on: false, server: '' };
const SERVER_KEY = 'mybank.server';
const normServer = (raw) => {
  const s = String(raw ?? '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
  // senza «https://»: https, tranne per gli indirizzi di casa (localhost, 192.168…, 10…, .local), che di norma sono http
  return /^(localhost([:/]|$)|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/:]+\.local([:/]|$))/i.test(s) ? `http://${s}` : `https://${s}`;
};

class Unauthorized extends Error {}
async function api(method, url, body) {
  const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(local.on && local.server ? { 'X-MyBank-Server': local.server } : {}) };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) throw new Unauthorized();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}
const fail = (e) => { if (e instanceof Unauthorized) return showLogin(); toast(e.message); };

// ------------------------------------------------------------------ accesso

function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#serverRow').hidden = !local.on;
  if (local.on) $('#serverUrl').value = local.server;
  (local.on && !local.server ? $('#serverUrl') : $('#password')).focus();
}

async function enter(session) {
  // l'app Android tiene il gettone per il widget
  try { if (window.Native?.saveToken && session.token) window.Native.saveToken(session.token); } catch { /* fuori dall'app non c'è */ }
  $('#login').hidden = true;
  $('#app').hidden = false;
  let appVersion = session.version;
  try { appVersion = window.Native?.version?.() || appVersion; } catch { /* fuori dall'app vale quella della pagina */ }
  $('#version').textContent = `v${appVersion}`;
  $('#demoBar').hidden = !session.demo;
  state.session = session;
  const fromBank = new URLSearchParams(location.search).get('banca');
  if (fromBank) {
    const [kind, ...rest] = fromBank.split(':');
    toast(kind === 'ok' ? rest.join(':') : `Collegamento non riuscito: ${rest.join(':')}`);
    history.replaceState(null, '', location.pathname + location.hash);
  }
  applyHash();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    if (local.on) {
      local.server = normServer($('#serverUrl').value);
      if (!local.server) { $('#loginError').textContent = 'Scrivi l\'indirizzo del server.'; return; }
    }
    const r = await api('POST', '/api/login', { password: $('#password').value });
    if (local.on) { try { localStorage.setItem(SERVER_KEY, local.server); } catch { /* senza archivio del browser vale per questa sessione */ } }
    $('#password').value = '';
    await enter({ ...(await api('GET', '/api/session')), token: r.token });
  } catch (err) { $('#loginError').textContent = err instanceof Unauthorized ? 'Password errata.' : err.message; }
});
$('#logoutBtn').addEventListener('click', async () => { await api('POST', '/api/logout').catch(() => {}); showLogin(); });

// ------------------------------------------------------------------ opzioni

async function loadOptions() {
  const s = await api('GET', '/api/session');
  $('#logoutBtn').hidden = Boolean(s.open);
  $('#pwCurrent').required = !s.open; // con l'accesso libero non c'è una password attuale
  $('#serverPanel').hidden = !(window.Native?.changeServer || local.on);
}
$('#changeServerBtn').addEventListener('click', async () => {
  if (window.Native?.changeServer) return window.Native.changeServer();
  await api('POST', '/api/logout').catch(() => {});
  local.server = '';
  try { localStorage.removeItem(SERVER_KEY); } catch { /* niente da togliere */ }
  showLogin();
});
$('#pwOpen').addEventListener('click', () => { $('#pwForm').reset(); $('#pwError').textContent = ''; $('#pwDialog').showModal(); $('#pwCurrent').focus(); });
$('#pwCancel').addEventListener('click', () => $('#pwDialog').close());
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#pwError');
  err.textContent = '';
  if ($('#pwNew').value !== $('#pwRepeat').value) { err.textContent = 'Le due password nuove non coincidono.'; return; }
  try {
    const r = await api('POST', '/api/password', { current: $('#pwCurrent').value, next: $('#pwNew').value });
    try { if (window.Native?.saveToken && r.token) window.Native.saveToken(r.token); } catch { /* fuori dall'app non c'è */ }
    e.target.reset();
    $('#pwDialog').close();
    toast('Password cambiata.');
  } catch (ex) { if (ex instanceof Unauthorized) return fail(ex); err.textContent = ex.message; }
});

// ------------------------------------------------------------------ schede

const TABS = ['storico', 'movimenti', 'statistiche', 'budget', 'banche', 'opzioni'];
// Indirizzi come «#movimenti:spesa» (li usa il widget): la scheda, e per i Movimenti il tag da filtrare, sul mese in corso.
function applyHash() {
  const [tab, arg] = (location.hash || '#storico').slice(1).split(':');
  if (tab === 'movimenti' && arg && TAGS[arg]) {
    const now = new Date();
    Object.assign(state.mv, { year: now.getFullYear(), month: now.getMonth() + 1, tag: arg, q: '', account: '' });
    $('#mvSearch').value = '';
  }
  show(tab);
}

function show(tab) {
  if (!TABS.includes(tab)) tab = 'storico';
  state.tab = tab;
  history.replaceState(null, '', `#${tab}`);
  for (const t of TABS) $(`#${t}`).hidden = t !== tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#optionsBtn').setAttribute('aria-pressed', String(tab === 'opzioni'));
  ({ storico: loadYear, movimenti: loadMoves, statistiche: loadStats, budget: loadBudget, banche: loadBanks, opzioni: loadOptions })[tab]().catch(fail);
}
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; if (b.dataset.tab === 'movimenti') state.mv.account = ''; show(b.dataset.tab); });
$('#optionsBtn').addEventListener('click', () => show('opzioni'));
window.addEventListener('hashchange', () => { if (!$('#app').hidden) applyHash(); });

const yearOptions = (years, current) => {
  const list = [...new Set([...years, THIS_YEAR, current])].sort((a, b) => b - a);
  return list.map((y) => `<option value="${y}" ${y === current ? 'selected' : ''}>${y}</option>`).join('');
};

// ------------------------------------------------------------------ storico

async function loadYear() {
  const d = await api('GET', `/api/summary?year=${state.year}`);
  $('#yearSelect').innerHTML = yearOptions(d.years, state.year);
  const t = d.total;
  const tone = (n) => (n >= 0 ? 'pos' : 'neg');
  $('#yearCards').innerHTML = `
    <div class="card"><div class="k">Entrate ${d.year}</div><div class="v pos">${money(t.entrate)}</div></div>
    <div class="card"><div class="k">Uscite ${d.year}</div><div class="v neg">${money(t.uscite)}</div></div>
    <div class="card"><div class="k">Bilancio ${d.year}</div><div class="v ${tone(t.bilancio)}">${money(t.bilancio)}</div></div>`;
  const cell = (n, cls = '') => `<td class="num ${n ? cls : 'zero'}">${n ? money(n) : '–'}</td>`;
  const rows = d.months.map((m) => {
    const open = state.open.has(m.month);
    const empty = !m.entrate && !m.uscite;
    const tags = Object.entries(m.tags).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill" style="--c:var(--t-${k})" data-t="${k}">${esc(TAGS[k] ?? k)} ${money(v)}</span>`).join(' ');
    return `<tr class="m" data-month="${m.month}"><th scope="row">${MONTHS[m.month - 1]}</th>${cell(m.entrate, 'pos')}${cell(m.uscite, 'neg')}${empty ? '<td class="num zero">–</td>' : `<td class="num ${tone(m.bilancio)}"><b>${money(m.bilancio)}</b></td>`}</tr>`
      + (open ? `<tr class="detail"><td colspan="4">${tags || 'Nessuna uscita.'}</td></tr>` : '');
  }).join('');
  $('#yearTable').innerHTML = `<thead><tr><th>Mese</th><th>Entrate</th><th>Uscite</th><th>Bilancio</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><th>Totale</th><td class="num pos">${money(t.entrate)}</td><td class="num neg">${money(t.uscite)}</td><td class="num ${tone(t.bilancio)}">${money(t.bilancio)}</td></tr></tfoot>`;
}
$('#yearSelect').addEventListener('change', (e) => { state.year = Number(e.target.value); loadYear().catch(fail); });
$('#yearTable').addEventListener('click', (e) => {
  const tr = e.target.closest('tr.m');
  if (!tr) return;
  const m = Number(tr.dataset.month);
  if (state.open.has(m)) state.open.delete(m); else state.open.add(m);
  loadYear().catch(fail);
});

// ------------------------------------------------------------------ movimenti

async function loadMoves() {
  const { year, month, tag, q } = state.mv;
  const [d, sum] = await Promise.all([
    api('GET', `/api/transactions?year=${year}&month=${month}&tag=${tag}&q=${encodeURIComponent(q)}&account=${encodeURIComponent(state.mv.account)}`),
    api('GET', `/api/summary?year=${year}`),
  ]);
  TAGS = d.tags;
  // filtro per conto o pocket (si arriva dalla scheda Banche): si vede e si toglie con un tocco
  const bar = $('#mvAccount');
  bar.hidden = !d.account;
  if (d.account) bar.innerHTML = `Conto o pocket: <b>${esc(d.account.name)}</b> <button class="link" data-clearaccount="1">Togli il filtro</button>`;
  $('#mvYear').innerHTML = `<option value="0">Tutti</option>${yearOptions(sum.years, year)}`;
  $('#mvMonth').innerHTML = `<option value="0">Tutti</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}`;
  $('#mvTag').innerHTML = `<option value="">Tutti</option>${Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${k === tag ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;
  const out = d.transactions.filter((t) => t.amount < 0 && t.tag !== 'giroconto').reduce((s, t) => s + -t.amount, 0);
  $('#mvSummary').textContent = d.total
    ? `${d.total} movimenti${d.total > d.transactions.length ? ` (mostro i primi ${d.transactions.length})` : ''} · uscite ${money(out)} · i giroconti non contano.`
    : 'Nessun movimento. Collega una banca dalla scheda Banche.';
  const options = (sel) => Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  $('#mvList').innerHTML = d.transactions.map((t) => {
    const bankName = t.bank === 'revolut' ? 'Revolut' : 'UniCredit';
    const where = `${bankName} · ${t.accountName}`;
    const title = t.remittance || t.description; // la causale se c'è, altrimenti il nome
    const dest = t.party && t.party !== title ? t.party : ''; // il destinatario (o chi paga)
    const pill = t.pending ? '<span class="pill warn">in sospeso</span>' : '';
    const amt = `<span class="amt ${t.amount > 0 ? 'in' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</span>`;
    const select = `<select data-tag="${t.id}" aria-label="Tag di ${esc(t.description)}" style="color:var(--t-${t.tag})">${options(t.tag)}</select>`;
    return `<div class="mv${t.pending ? ' pending' : ''}">
      <div class="d-date"><b>${shortDate(t.date)}</b><small>${t.date.slice(0, 4)}</small></div>
      <div class="d-main"><div class="d-title">${esc(title)}${pill}</div><div class="d-sub">${esc([dest, where].filter(Boolean).join(' · '))}</div></div>
      <div class="d-amt">${amt}</div>
      <div class="d-tag">${select}</div>
    </div>`;
  }).join('');
}
$('#movimenti').addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'mvYear') state.mv.year = Number(el.value);
  else if (el.id === 'mvMonth') state.mv.month = Number(el.value);
  else if (el.id === 'mvTag') state.mv.tag = el.value;
  else if (el.dataset.tag) {
    try { await api('PUT', `/api/transactions/${el.dataset.tag}/tag`, { tag: el.value }); el.style.color = `var(--t-${el.value})`; toast(`Tag: ${TAGS[el.value]}`); } catch (err) { fail(err); }
    return;
  } else return;
  loadMoves().catch(fail);
});
let searchTimer;
$('#movimenti').addEventListener('click', (e) => { if (e.target.closest('[data-clearaccount]')) { state.mv.account = ''; loadMoves().catch(fail); } });
$('#mvSearch').addEventListener('input', (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.mv.q = e.target.value; loadMoves().catch(fail); }, 250); });

// ------------------------------------------------------------------ statistiche di spesa

async function loadStats() {
  const { year, month } = state.st;
  const d = await api('GET', `/api/stats?year=${year}&month=${month}`);
  $('#stYear').innerHTML = yearOptions(d.years, year);
  $('#stMonth').innerHTML = `<option value="0">Tutto l'anno</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}`;
  if (!d.count) {
    $('#stCards').innerHTML = '';
    $('#stTags').innerHTML = $('#stTop').innerHTML = '<p class="muted">Nessuna uscita nel periodo.</p>';
  } else {
    $('#stCards').innerHTML = `
      <div class="card"><div class="k">Uscite</div><div class="v neg">${money(d.total)}</div></div>
      <div class="card"><div class="k">Movimenti</div><div class="v">${d.count}</div></div>
      <div class="card"><div class="k">Media</div><div class="v">${money(d.average)}</div></div>`;
    const row = (label, share, amount, extra = '') => `<div class="srow"${extra}><div class="slabel">${label}</div><div class="sbar"><i style="width:${Math.max(share, 1)}%;background:var(--bar, var(--ink))"></i></div><div class="snum">${money(amount)}<small>${String(share).replace('.', ',')}%</small></div></div>`;
    $('#stTags').innerHTML = d.byTag.map((e) => row(`<span class="pill" style="--c:var(--t-${e.tag})">${esc(e.label)}</span>`, e.share, e.total).replace('<div class="sbar">', `<div class="sbar" style="--bar:var(--t-${e.tag})">`)).join('');
    $('#stTop').innerHTML = d.top.map((p) => row(esc(p.name), p.share, p.total).replace('<div class="slabel">', `<div class="slabel" title="${p.count} movimenti">`)).join('');
  }
  const max = Math.max(1, ...d.months.map((m) => m.total));
  $('#stMonths').innerHTML = d.months.map((m) => {
    const segs = Object.entries(m.tags).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<i title="${esc(TAGS[k] ?? k)} ${money(v)}" style="width:${(v / max) * 100}%;background:var(--t-${k})"></i>`).join('');
    return `<div class="mrow${m.month === month ? ' on' : ''}" data-month="${m.month}" title="Tocca per vedere solo questo mese"><div class="slabel">${MONTHS[m.month - 1].slice(0, 3)}</div><div class="sbar">${segs}</div><div class="snum">${m.total ? money(m.total) : '–'}</div></div>`;
  }).join('');
}
$('#stYear').addEventListener('change', (e) => { state.st.year = Number(e.target.value); loadStats().catch(fail); });
$('#stMonth').addEventListener('change', (e) => { state.st.month = Number(e.target.value); loadStats().catch(fail); });
$('#stMonths').addEventListener('click', (e) => {
  const r = e.target.closest('.mrow');
  if (!r) return;
  const m = Number(r.dataset.month);
  state.st.month = state.st.month === m ? 0 : m; // un secondo tocco torna a tutto l'anno
  loadStats().catch(fail);
});

// ------------------------------------------------------------------ budget

async function loadBudget() {
  const d = await api('GET', '/api/budgets');
  const form = $('#budgetFields');
  if (!form.children.length) {
    form.innerHTML = ['spesa', 'svago', 'carburante'].map((k) => `<label>${TAGS[k]} (€ al mese)<input name="${k}" inputmode="decimal" placeholder="0"></label>`).join('');
  }
  for (const k of ['spesa', 'svago', 'carburante']) { const i = form.querySelector(`[name=${k}]`); if (document.activeElement !== i) i.value = d.budgets[k] || ''; }
  const m = d.month;
  $('#budgetCards').innerHTML = Object.entries(m.cats).map(([k, c]) => {
    const ratio = c.budget > 0 ? c.spent / c.budget : 0;
    const cls = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
    return `<div class="card"><div class="k">${esc(c.label)}${c.budget ? ` · budget ${money(c.budget)}` : ''}</div>
      <div class="v ${c.budget ? (c.left >= 0 ? 'pos' : 'neg') : ''}">${c.budget ? money(c.left) : money(c.spent)}</div>
      <div class="meter ${cls}"><i style="width:${Math.min(100, Math.round(ratio * 100))}%"></i></div>
      <div class="sub">${c.budget ? `residuo · speso ${money(c.spent)}` : 'nessun budget: speso nel mese'}</div>
      <div class="sub">stima ${c.estDaily == null ? '–' : money(c.estDaily)}/g · reale ${money(c.realDaily)}/g</div></div>`;
  }).join('');
}
$('#budgetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  try { await api('PUT', '/api/budgets', body); $('#budgetMsg').textContent = 'Salvato.'; setTimeout(() => { $('#budgetMsg').textContent = ''; }, 2500); await loadBudget(); } catch (err) { fail(err); }
});

// ------------------------------------------------------------------ banche

async function loadBanks() {
  const d = await api('GET', '/api/banks');
  TAGS = d.tags ?? TAGS;
  const auto = d.lastAuto;
  const hrs = d.auto.hours;
  const pad = (h) => `${String(h).padStart(2, '0')}:00`;
  const options = (list, sel) => list.map((h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${pad(h)}</option>`).join('');
  const all = Array.from({ length: 24 }, (_, h) => h);
  const rows = hrs.map((h) => `<div class="hour"><select data-hour-edit="${h}" aria-label="Orario ${pad(h)}: cambia">${options(all.filter((x) => x === h || !hrs.includes(x)), h)}</select>
    <button class="x" data-hour-del="${h}" aria-label="Togli l'orario ${pad(h)}" title="Togli" ${hrs.length <= 1 ? 'disabled' : ''}>×</button></div>`).join('');
  const adder = hrs.length < d.auto.max
    ? `<div class="hour add"><select id="hourAdd" aria-label="Aggiungi un orario">${options(all.filter((x) => !hrs.includes(x)), -1)}</select><button class="ghost" id="hourAddBtn">Aggiungi</button></div>`
    : '';
  const autoErrors = d.lastAuto?.errors?.length ? `<p class="error">Ultimo aggiornamento automatico (${fmtDateTime(d.lastAuto.at)}): ${esc(d.lastAuto.errors.join(' · '))}</p>` : '';
  $('#syncPanel').innerHTML = `
    <h2>Aggiornamento</h2>
    <p>Ultimo aggiornamento dalle banche: <b>${fmtDateTime(d.lastSync)}</b></p>
    <div class="hours">${rows}${adder}</div>
    ${autoErrors}
    <div class="foot"><button class="primary" id="syncBtn" ${d.connections.length ? '' : 'disabled'}><span class="spin" hidden></span><span>Aggiorna ora</span></button></div>`;
  $('#ebStatus').textContent = d.configured ? '· configurato' : '· da configurare';
  $('#ebRedirect').value = d.redirectUrl;
  $('#ebAppId').value = d.appId;
  $('#ebKey').placeholder = d.hasKey ? 'Chiave già salvata: lascia vuoto per tenerla' : '-----BEGIN PRIVATE KEY-----';
  if (!d.configured) $('#ebPanel').open = true;
  $('#bankList').innerHTML = d.banks.map((b) => {
    const c = d.connections.find((x) => x.bank === b.key);
    const open = state.bankOpen[b.key] ?? b.key !== 'revolut'; // Revolut ha molti pocket: di base è chiusa
    const wrap = (status, body) => `<details class="bank" data-bank="${b.key}" ${open ? 'open' : ''}><summary><h2>${esc(b.label)}</h2>${status}</summary>${body}</details>`;
    if (!c) return wrap('<span class="status no">Non collegata</span>', `<div class="foot"><button class="primary" data-link="${b.key}" ${d.configured ? '' : 'disabled'}>Collega ${esc(b.label)}</button>${d.configured ? '' : '<span class="muted">Prima configura Enable Banking qui sotto.</span>'}</div>`);
    const status = c.expired ? '<span class="status late">Consenso scaduto</span>' : `<span class="status ok">Collegata · ${c.daysLeft} giorni</span>`;
    return wrap(status, `
      <p class="muted">Ultima lettura ${fmtDateTime(c.lastSync)} · oggi restano ${c.left.auto} accessi automatici e ${c.left.manual} letture a mano.</p>
      ${c.accounts.map((a) => `<div class="acct" data-account="${esc(a.uid)}" role="button" tabindex="0" title="Tocca per vedere i movimenti di ${esc(a.name)}"><div class="n">${esc(a.name)}<div class="s">${a.main ? `Conto${a.iban ? ` · ${esc(a.iban)}` : ''}` : `Pocket · nome ${esc(a.nameSource)}`} · ${a.movements} movimenti</div></div>
        <button class="link" data-rename="${esc(a.uid)}" data-name="${esc(a.name)}">Rinomina</button></div>`).join('')}
      <div class="foot"><button class="ghost" data-link="${b.key}">${c.expired ? 'Ricollega' : 'Rinnova il consenso'}</button><button class="link danger" data-unlink="${c.id}">Scollega</button></div>`);
  }).join('');
}

$('#syncPanel').addEventListener('change', async (e) => {
  const el = e.target;
  if (!el.dataset?.hourEdit) return;
  const current = [...document.querySelectorAll('[data-hour-edit]')].map((x) => Number(x.dataset.hourEdit));
  const hours = current.map((h) => (h === Number(el.dataset.hourEdit) ? Number(el.value) : h));
  try { await api('PUT', '/api/banks/schedule', { hours }); toast('Orario cambiato.'); } catch (err) { fail(err); }
  loadBanks().catch(fail);
});
$('#bankList').addEventListener('toggle', (e) => { const k = e.target.dataset?.bank; if (k) state.bankOpen[k] = e.target.open; }, true);
$('#banche').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) {
    // un tocco su una riga di conto o pocket apre i Movimenti filtrati per quel conto
    const row = e.target.closest('[data-account]');
    if (row) { Object.assign(state.mv, { year: THIS_YEAR, month: 0, tag: '', q: '', account: row.dataset.account }); $('#mvSearch').value = ''; show('movimenti'); }
    return;
  }
  try {
    if (t.dataset.hourDel || t.id === 'hourAddBtn') {
      const current = [...document.querySelectorAll('[data-hour-edit]')].map((x) => Number(x.dataset.hourEdit));
      const hours = t.id === 'hourAddBtn' ? [...current, Number($('#hourAdd').value)] : current.filter((h) => h !== Number(t.dataset.hourDel));
      await api('PUT', '/api/banks/schedule', { hours });
      await loadBanks();
      toast('Orari aggiornati.');
    } else if (t.id === 'syncBtn') {
      t.disabled = true; t.querySelector('.spin').hidden = false;
      try {
        const r = await api('POST', '/api/banks/sync', {});
        toast(r.errors.length ? r.errors.join(' · ') : `Aggiornato: ${r.added} nuovi movimenti.`);
      } finally { await loadBanks(); }
      window.Native?.refreshWidget?.();
    } else if (t.dataset.link) {
      t.disabled = true;
      const { url } = await api('POST', '/api/banks/link', { bank: t.dataset.link });
      location.href = url; // si va a autorizzare nel sito della banca; al ritorno l'app conclude il collegamento
    } else if (t.dataset.unlink) {
      if (!confirm('Scollegare la banca? I suoi movimenti vengono tolti da MyBank (si rileggono ricollegandola).')) return;
      await api('DELETE', `/api/banks/${t.dataset.unlink}`);
      await loadBanks();
    } else if (t.dataset.rename) {
      const name = prompt('Nome del conto o pocket (es. «01 Spesa»). Vuoto = nome automatico:', t.dataset.name);
      if (name === null) return;
      await api('PUT', `/api/banks/accounts/${encodeURIComponent(t.dataset.rename)}/name`, { name });
      await loadBanks();
    }
  } catch (err) { fail(err); loadBanks().catch(() => {}); }
});

$('#ebForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#ebError').textContent = '';
  try {
    await api('PUT', '/api/banks/app', { appId: $('#ebAppId').value, privateKey: $('#ebKey').value });
    $('#ebKey').value = '';
    toast('Enable Banking salvato.');
    await loadBanks();
  } catch (err) { if (err instanceof Unauthorized) return fail(err); $('#ebError').textContent = err.message; }
});

// ------------------------------------------------------------------ avvio

(async () => {
  try {
    const c = await fetch('/local-config.json');
    if (c.ok && (c.headers.get('content-type') ?? '').includes('json')) {
      const cfg = await c.json();
      local.on = Boolean(cfg.local);
      let saved = '';
      try { saved = localStorage.getItem(SERVER_KEY) ?? ''; } catch { /* nessun valore salvato */ }
      local.server = normServer(saved || cfg.server);
    }
  } catch { /* sul server vero non c'è: modalità normale */ }
  if (local.on && !local.server) return showLogin(); // prima si sceglie il server
  try { await enter(await api('GET', '/api/session')); } catch (e) { if (e instanceof Unauthorized || local.on) showLogin(); else toast(e.message); }
})();
