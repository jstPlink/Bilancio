// MyBank: interfaccia web (e dell'app Android, che la carica dal server). Nessuna dipendenza.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => (n == null ? '–' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(n));
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'mai');
const THIS_YEAR = new Date().getFullYear();
let TAGS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', altro: 'Altro', non_definito: 'Non definito', entrata: 'Entrata', giroconto: 'Giroconto' };

const state = { tab: 'storico', year: THIS_YEAR, open: new Set(), mv: { year: THIS_YEAR, month: 0, tag: '', q: '' } };

// ------------------------------------------------------------------ rete

class Unauthorized extends Error {}
async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
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

function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#password').focus(); }

async function enter(session) {
  // l'app Android tiene il gettone per il widget
  try { if (window.Native?.saveToken && session.token) window.Native.saveToken(session.token); } catch { /* fuori dall'app non c'è */ }
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#version').textContent = `v${session.version}`;
  state.session = session;
  const fromBank = new URLSearchParams(location.search).get('banca');
  if (fromBank) {
    const [kind, ...rest] = fromBank.split(':');
    toast(kind === 'ok' ? rest.join(':') : `Collegamento non riuscito: ${rest.join(':')}`);
    history.replaceState(null, '', location.pathname + location.hash);
  }
  show((location.hash || '#storico').slice(1));
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    const r = await api('POST', '/api/login', { password: $('#password').value });
    $('#password').value = '';
    await enter({ ...(await api('GET', '/api/session')), token: r.token });
  } catch (err) { $('#loginError').textContent = err instanceof Unauthorized ? 'Password errata.' : err.message; }
});
$('#logoutBtn').addEventListener('click', async () => { await api('POST', '/api/logout').catch(() => {}); showLogin(); });

// ------------------------------------------------------------------ opzioni

async function loadOptions() {
  const [session, banks] = await Promise.all([api('GET', '/api/session'), api('GET', '/api/banks')]);
  const s = session;
  $('#logoutBtn').hidden = Boolean(s.open);
  $('#pwCurrent').required = !s.open; // con l'accesso libero non c'è una password attuale
  $('#sessionNote').textContent = s.open ? 'Accesso libero: nessuna password richiesta (solo in locale).' : 'Il login resta valido 180 giorni su questo dispositivo.';
  $('#aboutText').textContent = `MyBank v${s.version} · aggiornamenti automatici alle ${banks.auto.hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ')} (ora italiana).`;
  $('#serverBox').hidden = !window.Native?.changeServer;
}
$('#changeServerBtn').addEventListener('click', () => window.Native?.changeServer?.());
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#pwError');
  err.textContent = '';
  if ($('#pwNew').value !== $('#pwRepeat').value) { err.textContent = 'Le due password nuove non coincidono.'; return; }
  try {
    const r = await api('POST', '/api/password', { current: $('#pwCurrent').value, next: $('#pwNew').value });
    try { if (window.Native?.saveToken && r.token) window.Native.saveToken(r.token); } catch { /* fuori dall'app non c'è */ }
    e.target.reset();
    toast('Password cambiata.');
  } catch (ex) { if (ex instanceof Unauthorized) return fail(ex); err.textContent = ex.message; }
});

// ------------------------------------------------------------------ schede

const TABS = ['storico', 'movimenti', 'budget', 'banche', 'opzioni'];
function show(tab) {
  if (!TABS.includes(tab)) tab = 'storico';
  state.tab = tab;
  history.replaceState(null, '', `#${tab}`);
  for (const t of TABS) $(`#${t}`).hidden = t !== tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ({ storico: loadYear, movimenti: loadMoves, budget: loadBudget, banche: loadBanks, opzioni: loadOptions })[tab]().catch(fail);
}
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });

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
    api('GET', `/api/transactions?year=${year}&month=${month}&tag=${tag}&q=${encodeURIComponent(q)}`),
    api('GET', `/api/summary?year=${year}`),
  ]);
  TAGS = d.tags;
  $('#mvYear').innerHTML = `<option value="0">Tutti</option>${yearOptions(sum.years, year)}`;
  $('#mvMonth').innerHTML = `<option value="0">Tutti</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}`;
  $('#mvTag').innerHTML = `<option value="">Tutti</option>${Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${k === tag ? 'selected' : ''}>${esc(v)}</option>`).join('')}`;
  const out = d.transactions.filter((t) => t.amount < 0 && t.tag !== 'giroconto').reduce((s, t) => s + -t.amount, 0);
  $('#mvSummary').textContent = d.total
    ? `${d.total} movimenti${d.total > d.transactions.length ? ` (mostro i primi ${d.transactions.length})` : ''} · uscite ${money(out)} · i giroconti non contano.`
    : 'Nessun movimento. Collega una banca dalla scheda Banche.';
  const options = (sel) => Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  $('#mvList').innerHTML = d.transactions.map((t) => `
    <div class="mv${t.pending ? ' pending' : ''}">
      <div class="l1"><span class="date">${fmtDate(t.date)}</span>${t.pending ? '<span class="pill warn">in sospeso</span>' : ''}<span class="amt ${t.amount > 0 ? 'in' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</span></div>
      <div class="l2"><div><div class="desc">${esc(t.description)}</div><div class="where">${esc(t.bank === 'revolut' ? 'Revolut' : 'UniCredit')} · ${esc(t.accountName)}</div></div>
        <select data-tag="${t.id}" aria-label="Tag di ${esc(t.description)}" style="color:var(--t-${t.tag})">${options(t.tag)}</select></div>
    </div>`).join('');
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
$('#mvSearch').addEventListener('input', (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.mv.q = e.target.value; loadMoves().catch(fail); }, 250); });

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
  $('#lastSync').textContent = d.lastSync ? `Aggiornato ${fmtDateTime(d.lastSync)}` : '';
  const auto = d.lastAuto;
  const hours = d.auto.hours.map((h) => `<span class="pill">${String(h).padStart(2, '0')}:00</span>`).join('');
  $('#syncPanel').innerHTML = `
    <h2>Aggiornamento</h2>
    <p>Ultimo aggiornamento dalle banche: <b>${fmtDateTime(d.lastSync)}</b>.</p>
    <div><p class="muted">Aggiornamento automatico ogni giorno alle (ora italiana):</p><div class="hours">${hours}</div>
      <p class="muted">Prossimo: ${fmtDateTime(d.auto.next)}${auto ? ` · ultimo automatico: ${fmtDateTime(auto.at)}, ${auto.added} nuovi movimenti${auto.errors.length ? ` (errori: ${esc(auto.errors.join(' · '))})` : ''}` : ''}</p></div>
    <div class="foot"><button class="primary" id="syncBtn" ${d.connections.length ? '' : 'disabled'}><span class="spin" hidden></span><span>Aggiorna ora</span></button>
      <span class="muted">Per gli aggiornamenti in più durante la giornata.</span></div>`;
  $('#ebStatus').textContent = d.configured ? '· configurato' : '· da configurare';
  $('#ebRedirect').value = d.redirectUrl;
  $('#ebAppId').value = d.appId;
  $('#ebKey').placeholder = d.hasKey ? 'Chiave già salvata: lascia vuoto per tenerla' : '-----BEGIN PRIVATE KEY-----';
  if (!d.configured) $('#ebPanel').open = true;
  $('#bankList').innerHTML = d.banks.map((b) => {
    const c = d.connections.find((x) => x.bank === b.key);
    if (!c) return `<div class="bank"><header><h2>${esc(b.label)}</h2><span class="status no">Non collegata</span></header>
      <div class="foot"><button class="primary" data-link="${b.key}" ${d.configured ? '' : 'disabled'}>Collega ${esc(b.label)}</button>${d.configured ? '' : '<span class="muted">Prima configura Enable Banking qui sotto.</span>'}</div></div>`;
    const status = c.expired ? '<span class="status late">Consenso scaduto</span>' : `<span class="status ok">Collegata · ${c.daysLeft} giorni</span>`;
    return `<div class="bank"><header><h2>${esc(b.label)}</h2>${status}</header>
      <p class="muted">Ultima lettura ${fmtDateTime(c.lastSync)} · oggi restano ${c.left.auto} accessi automatici e ${c.left.manual} letture a mano.</p>
      ${c.accounts.map((a) => `<div class="acct"><div class="n">${esc(a.name)}<div class="s">${a.main ? `Conto${a.iban ? ` · ${esc(a.iban)}` : ''}` : `Pocket · nome ${esc(a.nameSource)}`} · ${a.movements} movimenti</div></div>
        <button class="link" data-rename="${esc(a.uid)}" data-name="${esc(a.name)}">Rinomina</button></div>`).join('')}
      <div class="foot"><button class="ghost" data-link="${b.key}">${c.expired ? 'Ricollega' : 'Rinnova il consenso'}</button><button class="link danger" data-unlink="${c.id}">Scollega</button></div></div>`;
  }).join('');
}

$('#banche').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.id === 'syncBtn') {
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
  try { await enter(await api('GET', '/api/session')); } catch (e) { if (e instanceof Unauthorized) showLogin(); else toast(e.message); }
})();
