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

// ------------------------------------------------------------------ modulo

export function mountBanks(host, api, toast, onMerged = () => {}) {
  let data = null;
  const ui = new Map(); // per collegamento: filtri e righe aperte della tabella dei movimenti
  const stateOf = (id) => { if (!ui.has(id)) ui.set(id, { status: '', account: '', q: '', shown: PAGE, open: new Set() }); return ui.get(id); };

  let renaming = null; // conto/pocket di cui si sta scrivendo il nome
  const openAccts = new Set(); // conti e pocket aperti (di norma sono tutti chiusi)
  const closedConns = new Set(); // banche chiuse (di norma sono aperte)
  const openFilters = new Set(); // banche con il pannello «Filtra» aperto

  // Il saldo da mostrare in grande: quello «disponibile» se c'è, altrimenti il contabile.
  const mainBalance = (a) => ['ITAV', 'CLAV', 'CLBD', 'ITBD', 'XPCD'].map((t) => a.balances.find((b) => b.type === t)).find(Boolean) ?? a.balances[0] ?? null;

  // Ogni conto o pocket è una finestra che si apre e si chiude: chiusa mostra nome e saldo (con i pagamenti in sospeso già dentro),
  // aperta aggiunge IBAN, quanti movimenti ci sono e in che periodo, e Rinomina.
  const accountBlock = (a) => {
    const big = a.total ?? (() => { const b = mainBalance(a); return b ? { amount: b.amount, currency: b.currency, pending: 0 } : null; })();
    const bigHtml = big
      ? `<b>${money(big.amount, big.currency)}</b>${big.pending ? `<small class="muted" title="Pagamenti non ancora registrati dalla banca: se vengono rifiutati spariscono alla lettura successiva">di cui in sospeso ${signed(big.pending, big.currency)}</small>` : ''}`
      : '<small class="muted">Saldo non fornito</small>';
    const rename = renaming === a.uid
      ? `<form class="bk-rename" data-renameform="${esc(a.uid)}"><input name="n" value="${esc(a.nameSource === 'manuale' ? a.name : '')}" placeholder="${esc(a.nameSource === 'movimenti' ? a.name : 'Es. 01 Spesa')}" maxlength="60" autocomplete="off" aria-label="Nome del conto"><button class="primary">Salva</button><button type="button" class="ghost" data-cancel>Annulla</button></form>`
      : `<button class="link bk-edit" data-rename="${esc(a.uid)}" title="Dai un nome a questo conto (vuoto = toglie il nome)">✎ Rinomina</button>`;
    const count = a.booked ? `<b>${a.booked}</b> movimenti${a.from ? ` dal ${fmtDate(a.from)} al ${fmtDate(a.to)}` : ''}` : 'Nessun movimento registrato';
    return `<details class="bk-acct" data-acct="${esc(a.uid)}" ${openAccts.has(a.uid) ? 'open' : ''}>
      <summary class="bk-top"><h3>${esc(a.name)}</h3><div class="bk-big">${bigHtml}</div></summary>
      <div class="bk-body">
        <p class="bk-iban${a.iban ? '' : ' muted'}">${a.iban ? esc(a.iban) : 'IBAN non fornito'}</p>
        <p class="bk-counts">${count}${a.pending ? ` · <b>${a.pending}</b> in sospeso` : ''}</p>
        <div class="bk-rn">${rename}</div>
      </div>
    </details>`;
  };

  const accountsHtml = (c) => {
    const isMain = (a) => a.main ?? Boolean(a.iban); // il server vecchio non dice «principale»: si deduce dall'IBAN
    const mains = c.accounts.filter(isMain);
    const pockets = c.accounts.filter((a) => !isMain(a));
    const group = (title, list) => (list.length ? `<h3 class="bk-section">${title} <span class="muted">· ${list.length}</span></h3><div class="bk-accts">${list.map(accountBlock).join('')}</div>` : '');
    return group('Conti', mains) + group('Pocket e risparmi', pockets);
  };

  const connectionHtml = (c) => {
    const reads = `Letture oggi ${c.readsToday}/${c.readsPerDay}`;
    const consent = c.expired ? '<span class="pill warn">Consenso scaduto</span>' : `<span class="pill ok">Consenso valido ancora ${c.daysLeft} giorni</span>`;
    const blocked = c.expired || c.readsToday >= c.readsPerDay;
    const head = `<summary class="bk-head"><h2>${esc(c.label)}</h2>${consent}
      <span class="muted">${c.fetchedAt ? `Copia letta il ${fmtDateTime(c.fetchedAt)}` : 'Nessuna lettura ancora'} · ${reads}</span>
      <button class="primary" data-read="${esc(c.id)}" ${blocked ? 'disabled' : ''} title="Legge saldi e movimenti dalla banca e li porta in tutta l'app (conta come una delle ${c.readsPerDay} letture giornaliere)">Aggiorna</button></summary>`;
    const wrap = (inner) => `<details class="bankconn" data-conn="${esc(c.id)}" ${closedConns.has(c.id) ? '' : 'open'}>${head}${inner}</details>`;
    if (c.empty) return wrap(`<div class="empty"><p>Premi <b>Aggiorna</b> per scaricare conti, saldi e movimenti.</p></div>`);

    const s = stateOf(c.id);
    const active = [s.account, s.status, s.q.trim()].filter(Boolean).length;
    // tutti i filtri in un solo pulsante «Filtra»
    const filters = `<details class="filterbox" data-conn="${esc(c.id)}" ${openFilters.has(c.id) ? 'open' : ''}><summary class="btn">Filtra${active ? ` <span class="badge">${active}</span>` : ''}</summary><div class="bankbar bk-filters">
      ${c.accounts.length > 1 ? `<label>Conto <select data-f="account" data-conn="${esc(c.id)}"><option value="">Tutti</option>${c.accounts.map((a) => `<option value="${esc(a.uid)}" ${s.account === a.uid ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>` : ''}
      <label>Stato <select data-f="status" data-conn="${esc(c.id)}"><option value="">Tutti</option><option value="BOOK" ${s.status === 'BOOK' ? 'selected' : ''}>Registrati</option><option value="PDNG" ${s.status === 'PDNG' ? 'selected' : ''}>In sospeso</option></select></label>
      <label class="grow">Cerca <input type="search" data-f="q" data-conn="${esc(c.id)}" value="${esc(s.q)}" placeholder="Interlocutore, causale, importo…" autocomplete="off"></label>
    </div></details>`;

    return wrap(`
      ${accountsHtml(c)}
      <div class="bk-moves"><div class="bk-movehead"><h3 class="bk-section">Movimenti <span class="muted">· ${c.transactionsTotal} in tutto${c.transactionsTotal > c.transactions.length ? `, i ${c.transactions.length} più recenti` : ''}</span></h3>${filters}</div><div data-rows="${esc(c.id)}"></div></div>`);
  };

  // Un pagamento in sospeso è nell'app (Panoramica, Movimenti, widget)? Conta nelle somme? Dipende dalla categoria.
  const CAT_NAMES = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', prestito: 'Prestito', donazioni: 'Donazioni', tasse: 'Tasse', bollette: 'Bollette', giroconti: 'Giroconto', sospesi: 'Da suddividere', altro: 'Altro', entrate: 'Entrate' };
  const inAppPill = (a) => {
    if (!a) return '';
    if (a.state === 'assente') return ' <span class="pill err" title="Non è ancora nei dati dell\'app: premi Aggiorna">non ancora nell\'app</span>';
    if (a.state === 'illeggibile') return ' <span class="pill err" title="La banca non ha dato un importo leggibile: l\'app non può contarlo">non leggibile</span>';
    const name = CAT_NAMES[a.category] ?? a.category;
    return a.counted ? ` <span class="pill ok" title="Nell'app dal ${fmtDate(a.date)} e contato nelle somme">contato · ${esc(name)}</span>`
      : ` <span class="pill edit" title="È nell'app (Movimenti) ma la categoria «${esc(name)}» non conta nelle somme: cambiala in Movimenti">non contato · ${esc(name)}</span>`;
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
        <td class="st">${t.status === 'PDNG' ? `<span class="pill warn">In sospeso</span>${inAppPill(t.inApp)}` : '<span class="pill ok">Registrato</span>'}</td>
        <td class="ac muted">${esc(names[t.account] ?? '')}</td>
        <td class="fname party" title="${esc(t.party)}">${esc(t.party) || '<span class="muted">–</span>'}</td>
        <td class="fname rem" title="${esc(t.remittance)}">${esc(t.remittance) || '<span class="muted">–</span>'}</td>
        <td class="num ${t.amount > 0 ? 'pos-in' : ''}">${t.amount == null ? '–' : signed(t.amount, t.currency)}</td></tr>${open ? `<tr class="mvdetail"><td colspan="6"><pre class="bk-raw">${esc(JSON.stringify(t.raw, null, 2))}</pre></td></tr>` : ''}`;
    }).join('');
    return `<p class="muted">${list.length} movimenti. Clicca una riga per vedere il record originale della banca.</p><div class="tablewrap"><table class="atable bk-tx"><thead><tr><th>Data</th><th>Stato</th><th>Conto</th><th>Interlocutore</th><th>Causale</th><th class="num">Importo</th></tr></thead><tbody>${body}</tbody></table></div>${list.length > s.shown ? `<p><button class="link" data-more="${esc(c.id)}">Mostra altri ${Math.min(PAGE, list.length - s.shown)}</button></p>` : ''}`;
  }

  function filterBadge(id) {
    const s = stateOf(id);
    const n = [s.account, s.status, s.q.trim()].filter(Boolean).length;
    const sum = host.querySelector(`details.filterbox[data-conn="${CSS.escape(id)}"] > summary`);
    if (sum) sum.innerHTML = `Filtra${n ? ` <span class="badge">${n}</span>` : ''}`;
  }

  function renderRows(id) {
    const c = data.connections.find((x) => x.id === id);
    const box = host.querySelector(`[data-rows="${CSS.escape(id)}"]`);
    if (c && box) box.innerHTML = rowsHtml(c);
  }

  function render() {
    if (!data) return;
    const auto = data.auto
      ? `<p class="bk-auto muted">Aggiornamento automatico ogni giorno alle ${(data.auto.hours ?? [data.auto.hour]).join(', ')}${data.auto.last ? ` · ultimo: ${fmtDateTime(data.auto.last.at)}${data.auto.last.errors?.length ? ` (errori: ${esc(data.auto.last.errors.join(' · '))})` : `, ${data.auto.last.added} nuovi movimenti`}` : ''}. Gli altri li fai tu con «Aggiorna».</p>`
      : '';
    const note = '';
    if (!data.configured || !data.connections.length) {
      host.innerHTML = `${note}<div class="empty"><h2>Nessuna banca collegata</h2><p>Inserisci le credenziali di Enable Banking e collega UniCredit o Revolut da <b>Impostazioni → Collega le banche</b>.</p></div>`;
      return;
    }
    host.innerHTML = note + auto + data.connections.map(connectionHtml).join('');
    for (const c of data.connections) {
      if (c.empty) continue;
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
      if (r.errors?.length) toast(r.errors.join(' · '), 9000);
      else toast(`Dati aggiornati: ${r.merged?.added ?? 0} nuovi movimenti${r.merged?.pending ? `, ${r.merged.pending} in sospeso` : ''}.`);
      onMerged(); // i movimenti sono entrati anche in Panoramica, Movimenti e Statistiche
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

  // Ricorda cosa è aperto: ogni banca (di norma sì), ogni conto (di norma no) e il pannello dei filtri (di norma no).
  host.addEventListener('toggle', (e) => {
    const box = e.target;
    if (box.matches?.('details.bk-acct')) { if (box.open) openAccts.add(box.dataset.acct); else openAccts.delete(box.dataset.acct); }
    else if (box.matches?.('details.bankconn')) { if (box.open) closedConns.delete(box.dataset.conn); else closedConns.add(box.dataset.conn); }
    else if (box.matches?.('details.filterbox')) { if (box.open) openFilters.add(box.dataset.conn); else openFilters.delete(box.dataset.conn); }
  }, true);

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
      e.preventDefault();
      renaming = rename.dataset.rename;
      render();
      host.querySelector(`[data-renameform="${CSS.escape(renaming)}"] input`)?.focus();
      return;
    }
    if (e.target.closest('[data-cancel]')) { renaming = null; render(); return; }
    const readBtn = e.target.closest('[data-read]');
    if (readBtn) { e.preventDefault(); return read(readBtn.dataset.read, readBtn); }
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
    timer = setTimeout(() => { const s = stateOf(f.dataset.conn); s.q = f.value; s.shown = PAGE; renderRows(f.dataset.conn); filterBadge(f.dataset.conn); }, 150);
  });
  host.addEventListener('change', (e) => {
    const f = e.target.closest('select[data-f]');
    if (!f) return;
    const s = stateOf(f.dataset.conn);
    s[f.dataset.f] = f.value;
    s.shown = PAGE;
    renderRows(f.dataset.conn);
    filterBadge(f.dataset.conn);
  });

  return { load, render };
}
