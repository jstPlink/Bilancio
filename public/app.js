// MyBank: interfaccia web (e dell'app Android, che la carica dal server). Nessuna dipendenza.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => (n == null ? '–' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n));
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'mai');
const THIS_YEAR = new Date().getFullYear();
let TAGS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', altro: 'Altro', utenze: 'Utenze', non_definito: 'Non definito', entrata: 'Entrata', giroconto: 'Giroconto' };

// Un'icona per categoria (tratto sottile, nel colore del testo).
const ICON_PATHS = {
  spesa: '<path d="M3 4h2.5l2 11h10.5l2-8H6.3"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  svago: '<path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.7l6.2-.8z"/>',
  carburante: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h5"/>',
  altro: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  utenze: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  non_definito: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  entrata: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  giroconto: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
};
const icon = (k) => `<svg class="ticon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[k] ?? ICON_PATHS.altro}</svg>`;

const state = { tab: 'storico', year: THIS_YEAR, open: new Set(), bankOpen: {}, mv: { year: THIS_YEAR, month: 0, tag: '', q: '', account: '', sort: 'date', dir: 'desc', items: [], total: 0, shown: Infinity, base: '', paged: false } };

// ------------------------------------------------------------------ rete

// Frontend locale (`npm start`): la pagina non ha dati né logica, ogni chiamata va al server scelto nella pagina di accesso.
// Sul server vero (e nell'app Android) questa modalità è spenta e le chiamate vanno allo stesso indirizzo della pagina.
const local = { on: false, server: '' };
const SERVER_KEY = 'mybank.server';
// Il pulsante davanti al campo del server sceglie http o https; nel campo si scrive solo l'indirizzo (mybank.miodominio.it).
let scheme = 'https';
const setScheme = (v) => { scheme = v === 'http' ? 'http' : 'https'; $('#schemeBtn').textContent = `${scheme}://`; };
$('#schemeBtn').addEventListener('click', () => setScheme(scheme === 'https' ? 'http' : 'https'));
// Se nel campo si incolla un indirizzo con http:// o https://, il pulsante si adegua e il prefisso si toglie dal campo.
const splitServer = (raw) => {
  const m = /^(https?):\/\/(.*)$/i.exec(String(raw ?? '').trim());
  if (m) setScheme(m[1].toLowerCase());
  return m ? m[2] : String(raw ?? '').trim();
};
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
  // un 404 su /api/… vuol dire che il server è più vecchio dell'app e non ha ancora questa funzione
  if (res.status === 404 && !data.error) throw new Error('Il server non ha ancora questa funzione: aggiornalo (docker compose pull && docker compose up -d).');
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
  if (local.on) $('#serverUrl').value = splitServer(local.server);
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
  try { window.Native?.syncNotifications?.(); } catch { /* fuori dall'app non ci sono notifiche */ }
  applyHash();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    if (local.on) {
      const host = splitServer($('#serverUrl').value);
      $('#serverUrl').value = host;
      local.server = host ? `${scheme}://${host.replace(/\/+$/, '')}` : '';
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
  loadNotifications().catch(fail);
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

const TABS = ['storico', 'movimenti', 'budget', 'banche', 'documenti', 'opzioni'];
const SWIPE_TABS = ['storico', 'movimenti', 'budget', 'banche']; // le schede tra cui si scorre col dito (Documenti e Opzioni stanno a parte)
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
  if (tab === 'statistiche') tab = 'storico'; // la scheda Statistiche non c'è più: il suo lavoro lo fa lo Storico
  if (!TABS.includes(tab)) tab = 'storico';
  state.tab = tab;
  history.replaceState(null, '', `#${tab}`);
  for (const t of TABS) $(`#${t}`).hidden = t !== tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#optionsBtn').setAttribute('aria-pressed', String(tab === 'opzioni'));
  ({ storico: loadYear, movimenti: loadMoves, budget: loadBudget, banche: loadBanks, documenti: loadDocuments, opzioni: loadOptions })[tab]().catch(fail);
}
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; if (b.dataset.tab === 'movimenti') state.mv.account = ''; show(b.dataset.tab); });
$('#optionsBtn').addEventListener('click', () => show('opzioni'));

// Sul telefono si scorre da una scheda all'altra con un colpo di dito orizzontale (non parte da campi, tabelle larghe o finestre aperte).
(() => {
  let start = null;
  const main = document.querySelector('main');
  main.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = e.touches.length === 1 && !e.target.closest('input, select, textarea, .tablewrap, dialog') ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true });
  main.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y, quick = Date.now() - start.at < 700;
    start = null;
    const i = SWIPE_TABS.indexOf(state.tab);
    if (i < 0 || !quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    const next = SWIPE_TABS[i + (dx < 0 ? 1 : -1)]; // verso sinistra = scheda seguente
    if (!next) return;
    if (next === 'movimenti') state.mv.account = '';
    show(next);
    window.scrollTo(0, 0);
  }, { passive: true });
  main.addEventListener('touchcancel', () => { start = null; }, { passive: true });
})();
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
    <div class="card"><div class="k">Entrate</div><div class="v pos">${money(t.entrate)}</div></div>
    <div class="card"><div class="k">Uscite</div><div class="v neg">${money(t.uscite)}</div></div>
    <div class="card"><div class="k">Bilancio</div><div class="v ${tone(t.bilancio)}">${money(t.bilancio)}</div></div>`;
  const cell = (n, cls = '') => `<td class="num ${n ? cls : 'zero'}">${n ? money(n) : '–'}</td>`;
  const rows = d.months.map((m) => {
    const open = state.open.has(m.month);
    const empty = !m.entrate && !m.uscite;
    // le uscite del mese, una categoria per riga dalla più grande: nome, barra bianca larga quanto pesa sulle uscite (importi veri) e importo; un tocco apre i movimenti
    const cats = Object.entries(m.uscite ? { utenze: 0, ...m.tags } : m.tags).sort((a, b) => b[1] - a[1]); // «Utenze» c'è sempre, anche a zero
    const tags = cats.length ? `<div class="legend">${cats.map(([k, v]) => `<button class="chip" data-see="${k}" data-see-month="${m.month}" title="Vedi i movimenti">
      <span class="cname">${icon(k)}${esc(TAGS[k] ?? k)}</span><span class="cbar"><i style="width:${(v / m.uscite) * 100}%"></i></span><span class="camt">${money(v)}</span></button>`).join('')}</div>` : '';
    const undef = (m.tags.non_definito ?? 0) > 0 ? ' undef' : ''; // il mese ha movimenti «Non definito»: la riga si colora di giallo
    return `<tr class="m${undef}" data-month="${m.month}"><th scope="row">${MONTHS[m.month - 1]}</th>${cell(m.entrate, 'pos')}${cell(m.uscite, 'neg')}${empty ? '<td class="num zero">–</td>' : `<td class="num ${tone(m.bilancio)}"><b>${money(m.bilancio)}</b></td>`}</tr>`
      + (open ? `<tr class="detail"><td colspan="4">${tags || 'Nessuna uscita.'}</td></tr>` : '');
  }).join('');
  $('#yearTable').innerHTML = `<thead><tr><th>Mese</th><th>Entrate</th><th>Uscite</th><th>Bilancio</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><th>Totale</th><td class="num pos">${money(t.entrate)}</td><td class="num neg">${money(t.uscite)}</td><td class="num ${tone(t.bilancio)}">${money(t.bilancio)}</td></tr></tfoot>`;
}
$('#yearSelect').addEventListener('change', (e) => { state.year = Number(e.target.value); loadYear().catch(fail); });
$('#yearTable').addEventListener('click', (e) => {
  const see = e.target.closest('[data-see]');
  if (see) { // «Vedi movimenti»: la scheda Movimenti già filtrata per quell'anno, mese e categoria
    Object.assign(state.mv, { year: state.year, month: Number(see.dataset.seeMonth), tag: see.dataset.see, q: '', account: '' });
    $('#mvSearch').value = '';
    return show('movimenti');
  }
  const tr = e.target.closest('tr.m');
  if (!tr) return;
  const m = Number(tr.dataset.month);
  if (state.open.has(m)) state.open.delete(m); else state.open.add(m);
  loadYear().catch(fail);
});

// ------------------------------------------------------------------ movimenti

// Fino a 1000 movimenti si mostrano tutti; se sono di più si mostrano i primi 200 e in fondo c'è «Mostra altro» (altri 200 ogni volta).
const MORE = 200;
async function loadMoves(keep = false) {
  const { year, month, tag, q } = state.mv;
  const base = `/api/transactions?year=${year}&month=${month}&tag=${tag}&q=${encodeURIComponent(q)}&account=${encodeURIComponent(state.mv.account)}&sort=${state.mv.sort}&dir=${state.mv.dir}`;
  const [d, sum] = await Promise.all([
    api('GET', `${base}&limit=1000&offset=0`),
    api('GET', `/api/summary?year=${year}`),
  ]);
  TAGS = d.tags;
  // Con un server più vecchio (senza ordinamento e totali) la pagina si arrangia da sola sui movimenti che ha ricevuto.
  if (!d.totals) {
    d.totals = { entrate: 0, uscite: 0 };
    for (const t of d.transactions) if (t.tag !== 'giroconto') { if (t.amount > 0) d.totals.entrate += t.amount; else d.totals.uscite -= t.amount; }
  }
  if (!d.sort) {
    const key = { date: (t) => t.date, amount: (t) => t.amount }[state.mv.sort];
    const mul = state.mv.dir === 'asc' ? 1 : -1;
    d.transactions.sort((a, b) => (typeof key(a) === 'number' ? key(a) - key(b) : String(key(a)).localeCompare(String(key(b)))) * mul || b.date.localeCompare(a.date));
  }
  // filtro per conto o pocket (si arriva dalla scheda Banche): si vede e si toglie con un tocco
  const bar = $('#mvAccount');
  bar.hidden = !d.account;
  if (d.account) bar.innerHTML = `Conto o pocket: <b>${esc(d.account.name)}</b> <button class="link" data-clearaccount="1">Togli il filtro</button>`;
  $('#mvYear').innerHTML = `<option value="0">Tutti</option>${yearOptions(sum.years, year)}`;
  $('#mvMonth').innerHTML = `<option value="0">Tutti</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}`;
  $('#mvTag').innerHTML = `<option value="">Tutti</option>${Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${k === tag ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;
  // la riga informativa: quanti movimenti e il totale; con il filtro «Entrata» le entrate, con gli altri filtri le uscite, senza filtro entrambe
  // le cifre (numero dei movimenti, entrate, uscite) in bianco, il resto del testo in grigio
  const sums = tag === 'entrata' ? `entrate <b>${money(d.totals.entrate)}</b>` : tag ? `uscite <b>${money(d.totals.uscite)}</b>` : `entrate <b>${money(d.totals.entrate)}</b> · uscite <b>${money(d.totals.uscite)}</b>`;
  $('#mvSummary').innerHTML = d.total
    ? `<b>${d.total}</b> movimenti · ${sums} · i giroconti non contano.`
    : 'Nessun movimento. Collega una banca dalla scheda Banche.';
  // sotto la riga, ognuno sopra la sua colonna: «Data» e «Importo», da toccare per ordinare (un secondo tocco inverte il verso)
  const head = (k, label, cls) => {
    const on = state.mv.sort === k;
    const arrow = on ? (state.mv.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<button class="sortbtn ${cls}${on ? ' on' : ''}" data-sort="${k}" aria-pressed="${on}" title="Ordina per ${label.toLowerCase()}">${label}${arrow}</button>`;
  };
  $('#mvSort').innerHTML = `${head('date', 'Data', 's-date')}${head('amount', 'Importo', 's-amt')}`;
  state.mv.items = d.transactions;
  state.mv.total = d.total;
  state.mv.base = base;
  state.mv.paged = 'offset' in d; // un server più vecchio non sa dare altre pagine
  state.mv.shown = d.total <= 1000 ? Infinity : (keep && state.mv.shown !== Infinity ? Math.max(MORE, state.mv.shown) : MORE);
  await ensureMoves();
  renderMovesList();
}

/** Carica dal server altre pagine di movimenti se ne servono per mostrare quanti se ne chiedono. */
async function ensureMoves() {
  const m = state.mv;
  const want = Math.min(m.shown, m.total);
  while (m.paged && m.items.length < want) {
    const more = await api('GET', `${m.base}&limit=1000&offset=${m.items.length}`);
    if (!more.transactions.length) break;
    m.items = m.items.concat(more.transactions);
  }
}

function renderMovesList() {
  const options = (sel) => Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const rows = state.mv.items.slice(0, state.mv.shown);
  $('#mvList').innerHTML = rows.map((t) => {
    const bankName = { revolut: 'Revolut', unicredit: 'UniCredit', busta: 'Busta paga' }[t.bank] ?? t.bank;
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
      <div class="d-tag"><div class="tagbox" style="color:var(--t-${t.tag})">${icon(t.tag)}${select}</div></div>
    </div>`;
  }).join('');
  // «Mostra altro» in fondo, solo se ci sono più di 1000 movimenti e non sono già tutti mostrati
  const left = state.mv.total - rows.length;
  const more = $('#mvMore');
  more.hidden = !(state.mv.total > 1000 && left > 0);
  more.innerHTML = more.hidden ? '' : '<button class="ghost" data-more="1">Mostra altro</button>';
}
$('#movimenti').addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'mvYear') state.mv.year = Number(el.value);
  else if (el.id === 'mvMonth') state.mv.month = Number(el.value);
  else if (el.id === 'mvTag') state.mv.tag = el.value;
  else if (el.dataset.tag) {
    try { await api('PUT', `/api/transactions/${el.dataset.tag}/tag`, { tag: el.value }); if (state.mv.tag) { toast(`Tag: ${TAGS[el.value]}`); await loadMoves(true); return; } el.style.color = `var(--t-${el.value})`; if (el.parentElement?.classList.contains('tagbox')) { el.parentElement.style.color = `var(--t-${el.value})`; el.previousElementSibling.outerHTML = icon(el.value); } toast(`Tag: ${TAGS[el.value]}`); } catch (err) { fail(err); }
    return;
  } else return;
  loadMoves().catch(fail);
});
let searchTimer;
$('#movimenti').addEventListener('click', (e) => {
  if (e.target.closest('[data-clearaccount]')) { state.mv.account = ''; loadMoves().catch(fail); return; }
  if (e.target.closest('[data-more]')) { // altri 200 movimenti
    state.mv.shown = (state.mv.shown === Infinity ? 0 : state.mv.shown) + MORE;
    ensureMoves().then(renderMovesList).catch(fail);
    return;
  }
  const s = e.target.closest('[data-sort]');
  if (!s) return;
  const k = s.dataset.sort;
  const first = { date: 'desc', amount: 'desc' }; // verso di partenza di ogni colonna
  state.mv.dir = state.mv.sort === k ? (state.mv.dir === 'asc' ? 'desc' : 'asc') : first[k];
  state.mv.sort = k;
  loadMoves().catch(fail);
});
$('#mvSearch').addEventListener('input', (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.mv.q = e.target.value; loadMoves().catch(fail); }, 250); });

// ------------------------------------------------------------------ budget

async function loadBudget() {
  const d = await api('GET', '/api/budgets');
  // per ogni categoria: titolo con icona, la riga sotto, il campo del budget mensile, l'importo residuo e la barra dello stato
  $('#budgetCards').innerHTML = Object.entries(d.month.cats).map(([k, c]) => {
    const ratio = c.budget > 0 ? c.spent / c.budget : 0;
    const cls = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
    return `<div class="card"><div class="k">${icon(k)}${esc(c.label)}</div>
      <div class="avg"><span class="dim">spesa media ultimi 3 mesi</span><b>${c.avg3 == null ? '–' : money(c.avg3)}</b></div>
      <input name="${k}" inputmode="decimal" placeholder="0" aria-label="Budget mensile di ${esc(c.label)} (€ al mese)" value="${d.budgets[k] || ''}">
      <div class="resid"><span class="v ${c.budget && c.left < 0 ? 'neg' : 'pos'}">${c.budget ? money(c.left) : money(c.spent)}</span><span class="dim">${c.budget ? 'residuo' : 'speso'}</span></div>
      <div class="meter ${cls}"><i style="width:${Math.min(100, Math.round(ratio * 100))}%"></i></div></div>`;
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
  // richieste fatte alle banche nelle ultime 24 ore (le banche ne concedono 4 automatiche e 10 a mano al giorno) e quante ne restano
  const reqs = d.connections.length ? `<div class="reqs">${d.connections.map((c) => {
    const ua = c.limits.auto - c.left.auto, um = c.limits.manual - c.left.manual;
    return `<p>${esc(c.label)} <span class="dim">· Richieste automatiche</span> ${ua}/${c.limits.auto} <span class="dim">· Manuali</span> ${um}/${c.limits.manual}</p>`;
  }).join('')}</div>` : '';
  $('#syncPanel').innerHTML = `
    <h2>Aggiornamento</h2>
    <p><span class="dim">Ultimo aggiornamento</span> <b>${fmtDateTime(d.lastSync)}</b></p>
    ${reqs}
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

// ------------------------------------------------------------------ documenti (tre cartelle online)

const DOC_LABELS = { payslips: 'Buste paga', statements: 'Estratti conto', bills: 'Bollette' };
const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const openExternal = (url) => {
  try { if (window.Native?.openUrl) return window.Native.openUrl(url); } catch { /* si apre come in un browser */ }
  window.open(url, '_blank', 'noopener');
};
state.docOpen = {};
state.staged = {};

async function loadDocuments() {
  const d = await api('GET', '/api/documents');
  state.docs = Object.fromEntries(d.links.map((l) => [l.key, l]));
  $('#docGroups').innerHTML = d.links.map((l) => `<details class="group doc" data-doc="${esc(l.key)}" ${state.docOpen[l.key] ? 'open' : ''}>
    <summary><h2 class="section">${esc(l.label)}</h2></summary>
    <div class="docbody">
      <div class="doclist" data-list="${esc(l.key)}"><p class="muted">${l.url ? 'Leggo la cartella…' : 'Inserisci qui sotto il link della cartella per vedere i documenti.'}</p></div>
      ${l.url ? `<div class="docupload"><label class="ghost filebtn">Carica documenti<input type="file" multiple hidden data-pick="${esc(l.key)}"></label><div class="staged" data-staged="${esc(l.key)}"></div></div>` : ''}
      <details class="docset" ${l.url ? '' : 'open'}><summary>LINK</summary>
        <form data-links="${esc(l.key)}">
          <label>LINK della cartella (Seafile)<input name="url" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://…" value="${esc(l.url)}"></label>
          <div class="foot"><button class="primary" type="submit">Salva LINK</button></div>
        </form>
      </details>
    </div></details>`).join('');
  for (const l of d.links) { renderStaged(l.key); if (state.docOpen[l.key]) loadFolder(l.key).catch(() => {}); }
}

/** Sotto un estratto mensile: com'è andata la lettura automatica dei suoi movimenti. */
function statementNote(f, i) {
  const s = f.statement;
  if (!s) return '';
  if (s.state === 'errore') return `<p class="docnote bad">Non letto: ${esc(s.error)} <button class="link" data-retry="${i}">Riprova</button></p>`;
  if (s.state === 'banca') return '<p class="docnote">Da agosto i movimenti li legge la banca: nessuna lettura.</p>';
  if (s.state === 'letto') return `<p class="docnote">${s.count} movimenti letti${s.visible ? '' : ' · per ora non mostrati'}</p>`;
  return '<p class="docnote">In attesa di lettura…</p>';
}

/** Sotto una busta paga: com'è andata la lettura automatica del netto. */
function payslipNote(f) {
  const s = f.payslip;
  if (!s) return '';
  if (s.state === 'errore') return `<p class="docnote bad">Non letta: ${esc(s.error)}</p>`;
  if (s.state === 'banca') return '<p class="docnote">Da agosto lo stipendio lo legge la banca: nessuna lettura.</p>';
  if (s.state === 'letto') return `<p class="docnote">Netto ${money(s.amount)} · aggiunto ai movimenti</p>`;
  return '<p class="docnote">In lettura…</p>';
}

async function loadFolder(key) {
  const box = document.querySelector(`[data-list="${key}"]`);
  if (!box || !state.docs?.[key]?.url) return;
  try {
    const d = await api('GET', `/api/documents/${key}/files`);
    state.docFiles = { ...(state.docFiles ?? {}), [key]: d };
    // il server sta leggendo le buste paga in sottofondo: si ricarica l'elenco finché ha finito (si ferma se si cambia scheda o si chiude la categoria)
    clearTimeout(state.docTimer);
    if (d.busy && state.tab === 'documenti' && state.docOpen[key]) state.docTimer = setTimeout(() => loadFolder(key).catch(() => {}), 6000);
    // gli estratti nuovi li ha appena letti il server: si dice quanti
    if (d.read?.length) toast(`Letti ${d.read.length} estratti conto nuovi${d.read.some((r) => r.error) ? ' (alcuni con errori)' : ''}.`);
    box.innerHTML = d.files.length
      ? `${d.files.map((f, i, all) => `${f.folder !== (all[i - 1]?.folder ?? '') && f.folder ? `<p class="docgroup">${esc(f.folder)}</p>` : ''}<div class="docitem"><button class="docfile" data-file="${key}:${i}"><span class="n">${esc(f.name)}</span><span class="s">${fmtSize(f.size)}${f.modified ? ` · ${esc(new Date(f.modified).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</span></button>${statementNote(f, i)}${payslipNote(f)}</div>`).join('')}
        ${d.total > d.files.length ? `<p class="muted">Mostro i primi ${d.files.length} di ${d.total}.</p>` : ''}
        <p class="muted"><button class="link" data-folder="${esc(d.folderUrl)}">Apri la cartella su Seafile</button></p>`
      : '<p class="muted">La cartella è vuota.</p>';
  } catch (err) {
    if (err instanceof Unauthorized) throw err;
    box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

function renderStaged(key) {
  const box = document.querySelector(`[data-staged="${key}"]`);
  if (!box) return;
  const list = state.staged[key] ?? [];
  box.innerHTML = list.length
    ? `${list.map((s, i) => `<div class="stagedrow"><input data-rename="${key}:${i}" value="${esc(s.name)}" aria-label="Nome del file ${i + 1}" maxlength="150"><button class="x" data-unstage="${key}:${i}" title="Togli">×</button></div>`).join('')}
       <div class="foot"><button class="primary" data-upload="${key}">Carica ${list.length === 1 ? 'il file' : `${list.length} file`}</button><span class="muted">Puoi cambiare il nome prima di caricare.</span></div>`
    : '';
}

$('#docGroups').addEventListener('toggle', (e) => {
  const key = e.target.dataset?.doc;
  if (!key) return;
  state.docOpen[key] = e.target.open;
  if (e.target.open) loadFolder(key).catch(fail);
}, true);

$('#docGroups').addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.pick) {
    const key = el.dataset.pick;
    state.staged[key] = [...(state.staged[key] ?? []), ...[...el.files].map((file) => ({ file, name: file.name }))];
    el.value = '';
    renderStaged(key);
  } else if (el.dataset.rename) {
    const [key, i] = el.dataset.rename.split(':');
    if (state.staged[key]?.[i]) state.staged[key][i].name = el.value;
  }
});

$('#docGroups').addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset?.rename) return;
  const [key, i] = el.dataset.rename.split(':');
  if (state.staged[key]?.[i]) state.staged[key][i].name = el.value;
});

$('#docGroups').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.file) { // un documento rilevato: si apre su Seafile
      const [key, i] = b.dataset.file.split(':');
      const f = state.docFiles?.[key]?.files?.[Number(i)];
      if (f) openExternal(f.url);
    } else if (b.dataset.retry !== undefined) { // rilegge a mano un estratto che non si era letto
      const f = state.docFiles?.statements?.files?.[Number(b.dataset.retry)];
      if (!f) return;
      b.disabled = true;
      try {
        const r = await api('POST', `/api/documents/statements/import?path=${encodeURIComponent(f.path ?? f.name)}`);
        toast(`${f.name}: ${r.found} movimenti letti.`);
      } finally { await loadFolder('statements'); }
    } else if (b.dataset.folder) openExternal(b.dataset.folder);
    else if (b.dataset.unstage) {
      const [key, i] = b.dataset.unstage.split(':');
      state.staged[key].splice(Number(i), 1);
      renderStaged(key);
    } else if (b.dataset.upload) {
      const key = b.dataset.upload;
      const list = state.staged[key] ?? [];
      b.disabled = true;
      let done = 0;
      try {
        for (const s of list) {
          const res = await fetch(`/api/documents/${key}/files?name=${encodeURIComponent(s.name)}`, {
            method: 'POST', body: s.file,
            headers: { 'Content-Type': s.file.type || 'application/octet-stream', ...(local.on && local.server ? { 'X-MyBank-Server': local.server } : {}) },
          });
          if (res.status === 401) throw new Unauthorized();
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(`${s.name}: ${out.error ?? `errore ${res.status}`}`);
          done++;
        }
      } finally {
        state.staged[key] = list.slice(done); // quelli già caricati si tolgono
        renderStaged(key);
      }
      toast(done === 1 ? 'File caricato.' : `${done} file caricati.`);
      await loadFolder(key);
    }
  } catch (err) { fail(err); }
});

$('#docGroups').addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-links]');
  if (!form) return;
  e.preventDefault();
  const key = form.dataset.links;
  const fd = Object.fromEntries(new FormData(form).entries());
  try {
    await api('PUT', '/api/documents', { [key]: { url: fd.url } });
    toast('LINK salvato.');
    state.docOpen[key] = true;
    await loadDocuments();
  } catch (err) { fail(err); }
});

// ------------------------------------------------------------------ notifiche (Opzioni)

const notify = { edit: '' };
const resetNotifyForm = () => {
  notify.edit = '';
  $('#notifyForm').reset();
  $('#nfSave').textContent = 'Aggiungi notifica';
  $('#nfCancel').hidden = true;
};
async function loadNotifications() {
  const d = await api('GET', '/api/notifications');
  $('#notifyList').innerHTML = d.notifications.length
    ? d.notifications.map((n) => `<div class="acct"><div class="n">${esc(n.text)}<div class="s">Il ${n.day} di ogni mese · ${esc(n.time)}</div></div>
        <button class="link" data-nf-edit="${esc(n.id)}">Modifica</button><button class="link danger" data-nf-del="${esc(n.id)}">Elimina</button></div>`).join('')
    : '<p class="muted">Nessuna notifica impostata.</p>';
  notify.list = d.notifications;
  $('#notifyHint').hidden = false;
  try { window.Native?.syncNotifications?.(); } catch { /* fuori dall'app non ci sono notifiche */ }
}
$('#notifyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { text: $('#nfText').value, day: Number($('#nfDay').value), time: $('#nfTime').value };
  try {
    await (notify.edit ? api('PUT', `/api/notifications/${encodeURIComponent(notify.edit)}`, body) : api('POST', '/api/notifications', body));
    toast(notify.edit ? 'Notifica salvata.' : 'Notifica aggiunta.');
    resetNotifyForm();
    await loadNotifications();
  } catch (err) { fail(err); }
});
$('#nfCancel').addEventListener('click', resetNotifyForm);
$('#notifyList').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.nfDel) {
      if (!confirm('Eliminare la notifica?')) return;
      await api('DELETE', `/api/notifications/${encodeURIComponent(b.dataset.nfDel)}`);
      if (notify.edit === b.dataset.nfDel) resetNotifyForm();
      await loadNotifications();
    } else if (b.dataset.nfEdit) {
      const n = (notify.list ?? []).find((x) => x.id === b.dataset.nfEdit);
      if (!n) return;
      notify.edit = n.id;
      $('#nfText').value = n.text; $('#nfDay').value = n.day; $('#nfTime').value = n.time;
      $('#nfSave').textContent = 'Salva modifiche';
      $('#nfCancel').hidden = false;
      $('#nfText').focus();
    }
  } catch (err) { fail(err); }
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
