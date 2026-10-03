// Scheda «Banche»: i dati originali che UniCredit e Revolut mettono a disposizione tramite Enable Banking.
// È una copia separata, in sola lettura: non entra in Panoramica, Movimenti né Statistiche.
import { fmtMoney } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '–');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '–');
const money = (n, currency = 'EUR') => {
  if (!Number.isFinite(n)) return '–';
  return !currency || currency === 'EUR' ? fmtMoney(n) : `${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};
const signed = (n, currency) => `${n > 0 ? '+' : ''}${money(n, currency)}`;

const ACCOUNT_TYPES = { CACC: 'Conto corrente', SVGS: 'Risparmio', CARD: 'Carta', LOAN: 'Prestito', CASH: 'Contanti', SLRY: 'Conto stipendio', TRAN: 'Conto di transito', OTHR: 'Altro' };
const phone = window.matchMedia('(max-width: 720px)').matches;
const PAGE = phone ? 50 : 200; // sul telefono ogni movimento è un riquadro: se ne mostrano meno alla volta

// ------------------------------------------------------------------ grafico del saldo

function drawTrend(host, trend) {
  host.replaceChildren();
  const pts = trend.points;
  if (pts.length < 2) { host.textContent = trend.note; host.classList.add('muted'); return; }
  const W = Math.max(280, Math.floor(host.clientWidth || 640));
  const H = 190;
  const m = { l: 70, r: 12, t: 12, b: 24 };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent?.appendChild(n); return n; };

  const values = pts.map((p) => p.balance);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const t0 = Date.parse(pts[0].date);
  const t1 = Date.parse(pts.at(-1).date);
  const x = (d) => m.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Andamento del saldo' });
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }, svg);
    const label = el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, svg);
    label.textContent = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(v);
  }
  for (const p of [pts[0], pts[Math.floor(pts.length / 2)], pts.at(-1)]) {
    const label = el('text', { x: x(p.date), y: H - 6, 'text-anchor': p === pts[0] ? 'start' : p === pts.at(-1) ? 'end' : 'middle', class: 'axis' }, svg);
    label.textContent = fmtDate(p.date);
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  el('path', { d: `${line} L${x(pts.at(-1).date).toFixed(1)},${H - m.b} L${x(pts[0].date).toFixed(1)},${H - m.b} Z`, class: 'bk-area' }, svg);
  el('path', { d: line, class: 'bk-line', fill: 'none' }, svg);
  const dot = el('circle', { r: 4, class: 'bk-dot', cx: -10, cy: -10 }, svg);
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  svg.addEventListener('mousemove', (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const near = pts.reduce((best, p) => (Math.abs(x(p.date) - px) < Math.abs(x(best.date) - px) ? p : best));
    dot.setAttribute('cx', x(near.date)); dot.setAttribute('cy', y(near.balance));
    tip.hidden = false;
    tip.innerHTML = `<div class="tip-h">${fmtDate(near.date)}</div><div class="tip-r"><span class="tip-l">Saldo</span><span class="tip-v">${money(near.balance)}</span></div>`;
    tip.style.left = `${Math.min(Math.max(8, (x(near.date) / W) * box.width - 80), box.width - 190)}px`;
    tip.style.top = '4px';
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; dot.setAttribute('cx', -10); });
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  wrap.append(svg, tip);
  host.append(wrap);
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = trend.note;
  host.append(note);
}

// ------------------------------------------------------------------ modulo

export function mountBanks(host, api, toast) {
  let data = null;
  const ui = new Map(); // per collegamento: filtri e righe aperte della tabella dei movimenti
  const stateOf = (id) => { if (!ui.has(id)) ui.set(id, { status: '', account: '', q: '', shown: PAGE, open: new Set() }); return ui.get(id); };

  let renaming = null; // conto/pocket di cui si sta scrivendo il nome

  // Il saldo da mostrare in grande: quello «disponibile» se c'è, altrimenti il contabile.
  const mainBalance = (a) => ['ITAV', 'CLAV', 'CLBD', 'ITBD', 'XPCD'].map((t) => a.balances.find((b) => b.type === t)).find(Boolean) ?? a.balances[0] ?? null;

  const nameSource = (a) => {
    if (a.nameSource === 'manuale') return `Nome dato da te · intestatario: ${esc(a.holder)}`;
    if (a.nameSource === 'movimenti') return `<span title="${esc(a.nameHint)}">Nome ricavato dai movimenti</span> · intestatario: ${esc(a.holder)}`;
    return a.main ? 'Conto principale' : 'La banca dà solo il nome dell\'intestatario: usa «Rinomina» per dare il nome a questo pocket';
  };

  const accountBlock = (a) => {
    const big = mainBalance(a);
    const others = a.balances.length
      ? `<dl class="bk-bal">${a.balances.map((b) => `<div><dt>${esc(b.label)}</dt><dd>${money(b.amount, b.currency)}${b.date ? ` <small class="muted">${fmtDate(b.date)}</small>` : ''}</dd></div>`).join('')}</dl>`
      : '<p class="muted">La banca non ha dato saldi.</p>';
    const extra = Object.entries(a.details);
    const gaps = a.unavailable.length
      ? `<p class="bk-warn">Non disponibile: ${a.unavailable.map((u) => `<b>${esc(u.what)}</b> <span class="muted" title="${esc(u.why)}">(${esc(u.why.slice(0, 60))})</span>`).join(' · ')}</p>` : '';
    const title = renaming === a.uid
      ? `<form class="bk-rename" data-renameform="${esc(a.uid)}"><input name="n" value="${esc(a.nameSource === 'manuale' ? a.name : '')}" placeholder="${esc(a.nameSource === 'movimenti' ? a.name : 'Es. 01 Spesa')}" maxlength="60" autocomplete="off" aria-label="Nome del conto"><button class="primary">Salva</button><button type="button" class="ghost" data-cancel>Annulla</button></form>`
      : `<h3>${esc(a.name)}</h3><button class="link bk-edit" data-rename="${esc(a.uid)}" title="Dai un nome a questo conto (vuoto = toglie il nome)">✎ Rinomina</button>`;
    return `<article class="bk-acct" data-acct="${esc(a.uid)}">
      <header class="bk-top">
        <div class="bk-titlebox"><div class="bk-titleline">${title}</div><p class="muted bk-src">${nameSource(a)}</p></div>
        <div class="bk-big">${big ? `<b>${money(big.amount, big.currency)}</b><small class="muted">${esc(big.label)}${big.date ? ` · ${fmtDate(big.date)}` : ''}</small>` : '<small class="muted">Saldo non fornito</small>'}</div>
      </header>
      ${a.iban ? `<p class="bk-iban">${esc(a.iban)}</p>` : '<p class="bk-iban muted">IBAN non fornito</p>'}
      <p class="muted">${esc(a.currency)} · ${esc(ACCOUNT_TYPES[a.type] ?? (a.type || 'tipo non indicato'))}${a.product ? ` <span class="pill edit">${esc(a.product)}</span>` : ''}</p>
      <p class="bk-counts"><b>${a.booked}</b> movimenti registrati · <b>${a.pending}</b> in sospeso${a.from ? ` · dal ${fmtDate(a.from)} al ${fmtDate(a.to)}` : ''}</p>
      ${a.historyNote ? `<p class="bk-hist muted">${esc(a.historyNote)}</p>` : ''}
      ${gaps}
      <div class="chart bk-chart" data-trend="${esc(a.uid)}"></div>
      <details class="bk-more"><summary class="muted">Saldi e tutti i dati del conto (${extra.length})</summary>${others}${extra.length ? `<dl class="bk-kv">${extra.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}</details>
    </article>`;
  };

  const accountsHtml = (c) => {
    const isMain = (a) => a.main ?? Boolean(a.iban); // il server vecchio non dice «principale»: si deduce dall'IBAN
    const mains = c.accounts.filter(isMain);
    const pockets = c.accounts.filter((a) => !isMain(a));
    const group = (title, list) => (list.length ? `<h3 class="bk-section">${title} <span class="muted">· ${list.length}</span></h3><div class="bk-accts">${list.map(accountBlock).join('')}</div>` : '');
    return group('Conti', mains) + group('Pocket e risparmi', pockets);
  };

  const partyTable = (title, list) => `<div><h4>${title}</h4>${list.length
    ? `<table class="atable"><thead><tr><th>Interlocutore</th><th class="num">Volte</th><th class="num">Totale</th><th>Ultimo</th></tr></thead><tbody>${list.map((c) => `<tr><td class="fname" title="${esc(c.name)}">${esc(c.name)}</td><td class="num">${c.count}</td><td class="num">${money(c.total)}</td><td>${fmtDate(c.last)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">Nessuno.</p>'}</div>`;

  const connectionHtml = (c) => {
    const reads = `Letture oggi ${c.readsToday}/${c.readsPerDay}`;
    const consent = c.expired ? '<span class="pill warn">Consenso scaduto</span>' : `<span class="pill ok">Consenso valido ancora ${c.daysLeft} giorni</span>`;
    const blocked = c.expired || c.readsToday >= c.readsPerDay;
    const head = `<header class="bk-head"><h2>${esc(c.label)}</h2>${consent}
      <span class="muted">${c.fetchedAt ? `Copia letta il ${fmtDateTime(c.fetchedAt)}` : 'Nessuna lettura ancora'} · ${reads}</span>
      <button class="primary" data-read="${esc(c.id)}" ${blocked ? 'disabled' : ''} title="Legge dalla banca e aggiorna la copia (conta come una delle ${c.readsPerDay} letture giornaliere)">Leggi dalla banca</button></header>`;
    if (c.empty) return `<section class="bankconn" data-conn="${esc(c.id)}">${head}<div class="empty"><p>Premi <b>Leggi dalla banca</b> per scaricare conti, saldi e movimenti con tutti i campi originali.</p></div></section>`;

    const fields = `<details class="acat" ${phone ? '' : 'open'}><summary>Quali campi fornisce la banca <span class="muted">· ${c.fields.length} campi diversi nei ${c.fields[0]?.total ?? 0} movimenti letti</span></summary>
      <div class="tablewrap"><table class="atable"><thead><tr><th>Campo</th><th class="num">Movimenti che lo hanno</th><th>Quota</th><th>Esempio</th></tr></thead><tbody>${c.fields.map((f) => {
        const pct = Math.round((f.count / f.total) * 100);
        return `<tr><td><code>${esc(f.path)}</code></td><td class="num">${f.count} su ${f.total}</td><td><span class="bk-bar" title="${pct}%"><i style="width:${pct}%"></i></span> <small class="muted">${pct}%</small></td><td class="fname" title="${esc(f.example)}">${esc(f.example)}</td></tr>`;
      }).join('')}</tbody></table></div></details>`;

    const recurring = `<details class="acat" ${phone ? '' : 'open'}><summary>Pagamenti ricorrenti <span class="muted">· ${c.recurring.length} trovati (stesso interlocutore, a intervalli regolari, almeno 3 volte)</span></summary>${c.recurring.length
      ? `<div class="tablewrap"><table class="atable"><thead><tr><th>Interlocutore</th><th>Verso</th><th>Frequenza</th><th class="num">Importo</th><th class="num">Volte</th><th>Ultimo</th><th>Prossimo</th></tr></thead><tbody>${c.recurring.map((r) => `<tr><td class="fname" title="${esc(r.name)}">${esc(r.name)}</td><td>${r.direction === 'in' ? 'Entrata' : 'Uscita'}</td><td>${esc(r.every)}</td><td class="num">${r.variable ? '~ ' : ''}${money(r.amount)}</td><td class="num">${r.count}</td><td>${fmtDate(r.last)}</td><td>${fmtDate(r.next)}</td></tr>`).join('')}</tbody></table></div><p class="muted">«~» = l'importo cambia da un pagamento all'altro (tipico delle bollette): è il valore mediano.</p>`
      : '<p class="muted">Nessun pagamento ricorrente riconosciuto.</p>'}</details>`;

    const s = stateOf(c.id);
    const filters = `<div class="bankbar bk-filters">
      ${c.accounts.length > 1 ? `<label>Conto <select data-f="account" data-conn="${esc(c.id)}"><option value="">Tutti</option>${c.accounts.map((a) => `<option value="${esc(a.uid)}" ${s.account === a.uid ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>` : ''}
      <label>Stato <select data-f="status" data-conn="${esc(c.id)}"><option value="">Tutti</option><option value="BOOK" ${s.status === 'BOOK' ? 'selected' : ''}>Registrati</option><option value="PDNG" ${s.status === 'PDNG' ? 'selected' : ''}>In sospeso</option></select></label>
      <label class="grow">Cerca <input type="search" data-f="q" data-conn="${esc(c.id)}" value="${esc(s.q)}" placeholder="Interlocutore, causale, importo…" autocomplete="off"></label>
    </div>`;

    return `<section class="bankconn" data-conn="${esc(c.id)}">${head}
      ${accountsHtml(c)}
      ${fields}
      <div class="bk-two">${partyTable('Principali interlocutori in uscita', c.counterparties.out)}${partyTable('Principali interlocutori in entrata', c.counterparties.in)}</div>
      ${recurring}
      <details class="acat" open><summary>Movimenti con tutti i campi originali <span class="muted">· ${c.transactionsTotal} in tutto${c.transactionsTotal > c.transactions.length ? `, i ${c.transactions.length} più recenti` : ''}</span></summary>${filters}<div data-rows="${esc(c.id)}"></div></details>
    </section>`;
  };

  function rowsHtml(c) {
    const s = stateOf(c.id);
    const needle = s.q.trim().toLowerCase();
    const names = Object.fromEntries(c.accounts.map((a) => [a.uid, a.name]));
    const list = c.transactions.filter((t) => (!s.status || t.status === s.status) && (!s.account || t.account === s.account)
      && (!needle || `${t.party} ${t.remittance} ${t.amount} ${money(t.amount, t.currency)} ${fmtDate(t.date)} ${JSON.stringify(t.raw)}`.toLowerCase().includes(needle)));
    if (!list.length) return '<div class="empty"><p>Nessun movimento con questi filtri.</p></div>';
    const body = list.slice(0, s.shown).map((t) => {
      const open = s.open.has(t.key);
      return `<tr class="mv${open ? ' open' : ''}" data-bkrow="${esc(t.key)}">
        <td class="dcol">${fmtDate(t.date)}</td>
        <td class="st">${t.status === 'PDNG' ? '<span class="pill warn">In sospeso</span>' : '<span class="pill ok">Registrato</span>'}</td>
        <td class="ac muted">${esc(names[t.account] ?? '')}</td>
        <td class="fname party" title="${esc(t.party)}">${esc(t.party) || '<span class="muted">–</span>'}</td>
        <td class="fname rem" title="${esc(t.remittance)}">${esc(t.remittance) || '<span class="muted">–</span>'}</td>
        <td class="num ${t.amount > 0 ? 'pos-in' : ''}">${t.amount == null ? '–' : signed(t.amount, t.currency)}</td></tr>${open ? `<tr class="mvdetail"><td colspan="6"><pre class="bk-raw">${esc(JSON.stringify(t.raw, null, 2))}</pre></td></tr>` : ''}`;
    }).join('');
    return `<p class="muted">${list.length} movimenti. Clicca una riga per vedere il record originale della banca.</p><div class="tablewrap"><table class="atable bk-tx"><thead><tr><th>Data</th><th>Stato</th><th>Conto</th><th>Interlocutore</th><th>Causale</th><th class="num">Importo</th></tr></thead><tbody>${body}</tbody></table></div>${list.length > s.shown ? `<p><button class="link" data-more="${esc(c.id)}">Mostra altri ${Math.min(PAGE, list.length - s.shown)}</button></p>` : ''}`;
  }

  function renderRows(id) {
    const c = data.connections.find((x) => x.id === id);
    const box = host.querySelector(`[data-rows="${CSS.escape(id)}"]`);
    if (c && box) box.innerHTML = rowsHtml(c);
  }

  function render() {
    if (!data) return;
    const note = '<p class="bk-note">Questa scheda mostra una <b>copia separata</b> dei dati che le banche rendono disponibili (tramite Enable Banking, in sola lettura). Non entra in Panoramica, Movimenti né Statistiche: serve a capire cosa si può ottenere.</p>';
    if (!data.configured || !data.connections.length) {
      host.innerHTML = `${note}<div class="empty"><h2>Nessuna banca collegata</h2><p>Inserisci le credenziali di Enable Banking e collega UniCredit o Revolut da <b>Impostazioni → Collega le banche</b>.</p></div>`;
      return;
    }
    host.innerHTML = note + data.connections.map(connectionHtml).join('');
    for (const c of data.connections) {
      if (c.empty) continue;
      c.accounts.forEach((a) => drawTrend(host.querySelector(`[data-conn="${CSS.escape(c.id)}"] [data-trend="${CSS.escape(a.uid)}"]`), a.trend));
      renderRows(c.id);
    }
  }

  async function load() {
    data = await api('/api/banking/explore');
    render();
  }

  async function read(id, button) {
    button.disabled = true;
    button.textContent = 'Lettura in corso…';
    try {
      const r = await api('/api/banking/explore/read', { method: 'POST', body: { id } });
      data = r;
      if (r.errors?.length) toast(r.errors.join(' · '), 9000); else toast('Copia dei dati aggiornata.');
    } catch (err) { toast(err.message, 8000); }
    render();
  }

  async function saveName(uid, name) {
    try {
      data = await api('/api/banking/account-name', { method: 'PUT', body: { uid, name } });
      renaming = null;
      toast(name.trim() ? 'Nome salvato.' : 'Nome tolto: torna quello della banca.');
    } catch (err) { toast(err.message, 8000); }
    render();
  }

  host.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-renameform]');
    if (!form) return;
    e.preventDefault();
    saveName(form.dataset.renameform, form.elements.n.value);
  });
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && renaming) { renaming = null; render(); }
  });

  host.addEventListener('click', (e) => {
    const rename = e.target.closest('[data-rename]');
    if (rename) {
      renaming = rename.dataset.rename;
      render();
      host.querySelector(`[data-renameform="${CSS.escape(renaming)}"] input`)?.focus();
      return;
    }
    if (e.target.closest('[data-cancel]')) { renaming = null; render(); return; }
    const readBtn = e.target.closest('[data-read]');
    if (readBtn) return read(readBtn.dataset.read, readBtn);
    const more = e.target.closest('[data-more]');
    if (more) { stateOf(more.dataset.more).shown += PAGE; return renderRows(more.dataset.more); }
    const row = e.target.closest('tr[data-bkrow]');
    if (row && !e.target.closest('a, button, select, input')) {
      const id = row.closest('[data-conn]').dataset.conn;
      const open = stateOf(id).open;
      if (open.has(row.dataset.bkrow)) open.delete(row.dataset.bkrow); else open.add(row.dataset.bkrow);
      renderRows(id);
    }
  });
  let timer;
  host.addEventListener('input', (e) => {
    const f = e.target.closest('[data-f="q"]');
    if (!f) return;
    clearTimeout(timer);
    timer = setTimeout(() => { const s = stateOf(f.dataset.conn); s.q = f.value; s.shown = PAGE; renderRows(f.dataset.conn); }, 150);
  });
  host.addEventListener('change', (e) => {
    const f = e.target.closest('select[data-f]');
    if (!f) return;
    const s = stateOf(f.dataset.conn);
    s[f.dataset.f] = f.value;
    s.shown = PAGE;
    renderRows(f.dataset.conn);
  });

  return { load, render };
}
