// Analisi dei dati originali letti dalle banche (copia in db.banking.snapshots) per la scheda «Banche».
// Solo lettura: niente qui crea o cambia movimenti, categorie o totali dell'app.
import { BANKS, SYNCS_PER_DAY, bankingState } from './banking.js';

const DAY = 86400000;
const round = (n) => Math.round(n * 100) / 100;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// ------------------------------------------------------------------ lettura dei campi di un movimento

const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

// Elenco piatto dei campi valorizzati: { "creditor.name" → "Conad", "remittance_information[]" → "…" }.
export function flatten(value, prefix = '', out = new Map()) {
  if (isEmpty(value)) return out;
  if (Array.isArray(value)) {
    const path = `${prefix}[]`;
    if (value.every((v) => v === null || typeof v !== 'object')) { if (!out.has(path)) out.set(path, value.join(' · ')); return out; }
    for (const v of value) flatten(v, path, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  if (!out.has(prefix)) out.set(prefix, String(value));
  return out;
}

const dateOf = (tx) => String(tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? '').slice(0, 10);
const isCredit = (tx) => tx.credit_debit_indicator === 'CRDT';
const amountOf = (tx) => Math.abs(Number(tx.transaction_amount?.amount));
const signedOf = (tx) => (isCredit(tx) ? amountOf(tx) : -amountOf(tx));
const remittanceOf = (tx) => (Array.isArray(tx.remittance_information) ? tx.remittance_information.join(' ') : String(tx.remittance_information ?? '')).replace(/\s+/g, ' ').trim();
const partyOf = (tx) => String((isCredit(tx) ? tx.debtor?.name : tx.creditor?.name) ?? '').trim();
const usable = (tx) => Number.isFinite(amountOf(tx)) && /^\d{4}-\d{2}-\d{2}$/.test(dateOf(tx));
const nameKey = (s) => String(s).toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();

// Un movimento senza identificativo si riconosce da data, importo e controparte.
const rawKey = (tx) => tx.transaction_id ?? tx.entry_reference ?? tx.reference_number ?? `${dateOf(tx)}|${signedOf(tx)}|${partyOf(tx)}|${remittanceOf(tx).slice(0, 40)}`;

// ------------------------------------------------------------------ nome dei pocket

// Revolut dà a ogni pocket il nome dell'intestatario, ma il nome vero (es. «01 Spesa») compare nel testo dei suoi movimenti:
// «Accredita EUR 01 Spesa da EUR» quando entra denaro, «Da EUR Spotify» / «A EUR Spotify» quando ne esce. Si cerca il nome
// più frequente fra i testi dei movimenti del conto. Vale solo per i conti che non sono quello principale (senza IBAN o di risparmio).
const POCKET_TEXTS = [/^Accredita\s+EUR\s+(.+?)\s+da\s+EUR$/i, /^(?:Da|A|From|To)\s+EUR\s+(.+)$/i];

export function inferPocketName(txs) {
  const found = new Map();
  for (const tx of txs) {
    for (const value of flatten(tx).values()) {
      for (const re of POCKET_TEXTS) {
        const m = re.exec(String(value).trim());
        if (!m) continue;
        const name = m[1].replace(/\s+/g, ' ').trim();
        if (name.length < 2 || name.length > 40) continue;
        const f = found.get(name.toLowerCase()) ?? { name, count: 0, example: value };
        f.count++;
        found.set(name.toLowerCase(), f);
      }
    }
  }
  const best = [...found.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0];
  return best ? { name: best.name, count: best.count, example: String(best.example) } : null;
}

// ------------------------------------------------------------------ saldi

export const BALANCE_LABELS = {
  CLBD: 'Saldo contabile', ITBD: 'Saldo contabile provvisorio', XPCD: 'Saldo previsto', CLAV: 'Disponibile a fine giornata',
  ITAV: 'Disponibile', OPBD: 'Saldo iniziale', OPAV: 'Disponibile iniziale', PRCD: 'Saldo precedente', FWAV: 'Disponibile futuro',
  VALU: 'Saldo a valuta', INFO: 'Informativo', OTHR: 'Altro',
};
const BALANCE_PREFERENCE = ['CLBD', 'ITBD', 'XPCD', 'CLAV', 'ITAV', 'OTHR'];

export function balanceView(balances) {
  return (balances ?? []).map((b) => ({
    type: b.balance_type ?? '', label: BALANCE_LABELS[b.balance_type] ?? b.name ?? b.balance_type ?? 'Saldo',
    amount: Number(b.balance_amount?.amount), currency: b.balance_amount?.currency ?? '',
    date: String(b.last_change_date_time ?? b.reference_date ?? '').slice(0, 10),
  })).filter((b) => Number.isFinite(b.amount));
}

// Il saldo «totale» di un conto: il saldo contabile (che non conta i pagamenti in sospeso) più i pagamenti in sospeso, in uscita o in entrata.
// Se la banca dà solo saldi «disponibili» (già al netto dei sospesi) si usa quello com'è. Un pagamento rifiutato sparisce dai sospesi alla lettura successiva.
const BOOKED_TYPES = ['CLBD', 'ITBD', 'XPCD'];
const AVAILABLE_TYPES = ['ITAV', 'CLAV', 'OTHR'];
export function totalBalance(view, pending = []) {
  const find = (types) => types.map((t) => view.find((b) => b.type === t)).find(Boolean);
  const booked = find(BOOKED_TYPES);
  if (booked) {
    const sum = round(pending.filter((tx) => Number.isFinite(amountOf(tx))).reduce((s, tx) => s + signedOf(tx), 0));
    return { amount: round(booked.amount + sum), pending: sum, pendingCount: pending.length, currency: booked.currency, date: booked.date, basis: 'booked' };
  }
  const avail = find(AVAILABLE_TYPES) ?? view[0];
  return avail ? { amount: avail.amount, pending: 0, pendingCount: pending.length, currency: avail.currency, date: avail.date, basis: 'available' } : null;
}

const currentBalance = (balances) => {
  const view = balanceView(balances);
  for (const type of BALANCE_PREFERENCE) { const hit = view.find((b) => b.type === type); if (hit) return hit.amount; }
  return view[0]?.amount ?? null;
};

// Andamento del saldo: dai saldi che la banca scrive in ogni movimento, altrimenti ricostruito all'indietro dal saldo attuale.
export function balanceTrend(booked, balances) {
  const list = booked.filter(usable);
  if (!list.length) return { points: [], source: null, note: 'Nessun movimento registrato: niente da mostrare.' };
  // L'ordine in cui la banca li elenca non è garantito: si ordina per data e, a parità, si tiene l'ordine di arrivo invertito se arrivano dal più recente.
  const newestFirst = dateOf(list[0]) >= dateOf(list.at(-1));
  const ordered = (newestFirst ? [...list].reverse() : [...list]).sort((a, b) => dateOf(a).localeCompare(dateOf(b)));

  const declared = ordered.filter((tx) => tx.balance_after_transaction?.amount != null);
  if (declared.length >= Math.max(3, ordered.length * 0.5)) {
    const byDay = new Map();
    for (const tx of declared) byDay.set(dateOf(tx), Number(tx.balance_after_transaction.amount));
    return { points: [...byDay].map(([date, balance]) => ({ date, balance: round(balance) })), source: 'banca', note: 'Saldo scritto dalla banca in ogni movimento.' };
  }

  const now = currentBalance(balances);
  if (now == null) return { points: [], source: null, note: 'La banca non fornisce né i saldi né il saldo nei movimenti: l’andamento non si può calcolare.' };
  const perDay = new Map();
  for (const tx of ordered) perDay.set(dateOf(tx), (perDay.get(dateOf(tx)) ?? 0) + signedOf(tx));
  const days = [...perDay.keys()].sort().reverse();
  let running = now;
  const points = [];
  for (const d of days) { points.push({ date: d, balance: round(running) }); running -= perDay.get(d); }
  return { points: points.reverse(), source: 'ricostruito', note: 'Ricostruito all’indietro dal saldo attuale e dai movimenti registrati (i movimenti in sospeso non sono contati).' };
}

// ------------------------------------------------------------------ vista per l'interfaccia

const MAX_ROWS = 1500;

export function buildExplore(db, now = Date.now()) {
  const b = bankingState(db);
  const connections = b.connections.map((conn) => {
    const snap = b.snapshots[conn.id];
    const until = Date.parse(conn.validUntil);
    const base = {
      id: conn.id, bank: conn.bank, label: BANKS[conn.bank]?.label ?? conn.bank,
      validUntil: conn.validUntil, daysLeft: Number.isFinite(until) ? Math.floor((until - now) / DAY) : null, expired: Number.isFinite(until) && until <= now,
      readsToday: (conn.calls ?? []).filter((t) => t > now - DAY).length, readsPerDay: SYNCS_PER_DAY,
      fetchedAt: snap?.fetchedAt ?? null,
    };
    if (!snap) return { ...base, empty: true };

    const rows = [];
    const accounts = conn.accounts.map((acc) => {
      const a = snap.accounts[acc.uid] ?? { booked: [], pending: [], balances: [], details: null, unavailable: [] };
      const dates = a.booked.map(dateOf).filter(Boolean).sort();
      for (const [status, list] of [['BOOK', a.booked], ['PDNG', a.pending]]) {
        for (const tx of list) {
          rows.push({ key: `${acc.uid}|${status}|${rawKey(tx)}`, account: acc.uid, status, date: dateOf(tx), amount: Number.isFinite(amountOf(tx)) ? round(signedOf(tx)) : null, currency: tx.transaction_amount?.currency ?? '', party: partyOf(tx), remittance: remittanceOf(tx), raw: tx });
        }
      }
      const holder = acc.name || a.details?.name || 'Conto';
      const iban = acc.iban || a.details?.account_id?.iban || '';
      const type = a.details?.cash_account_type ?? acc.type ?? '';
      const isMain = Boolean(iban) && type !== 'SVGS';
      const custom = String(b.names?.[acc.uid] ?? '').trim();
      const guess = !isMain && !custom ? inferPocketName([...a.booked, ...a.pending]) : null;
      return {
        uid: acc.uid, holder, name: custom || guess?.name || holder, nameSource: custom ? 'manuale' : guess ? 'movimenti' : 'intestatario',
        nameHint: guess ? `Dai movimenti: «${guess.example}» (${guess.count} volte)` : '', main: isMain,
        iban, currency: acc.currency || a.details?.currency || '',
        type, product: a.details?.product ?? '', historyNote: a.historyNote ?? '',
        balances: balanceView(a.balances),
        total: totalBalance(balanceView(a.balances), a.pending),
        booked: a.booked.length, pending: a.pending.length, from: dates[0] ?? null, to: dates.at(-1) ?? null,
        trend: balanceTrend(a.booked, a.balances), unavailable: a.unavailable ?? [],
      };
    });
    rows.sort((x, y) => y.date.localeCompare(x.date) || (x.status === 'PDNG' ? -1 : 1));
    return {
      ...base, accounts,
      transactions: rows.slice(0, MAX_ROWS), transactionsTotal: rows.length,
    };
  });
  return { configured: Boolean(b.app?.appId && b.app?.privateKey), connections };
}

// Widget Android di una banca (oggi Revolut): saldo totale e ultimi movimenti dall'ULTIMA copia letta. Non chiama mai la banca:
// i dati si aggiornano solo quando si preme «Leggi dalla banca» o «Aggiorna ora», quindi il widget dice anche da quando sono.
export function buildBankWidget(db, bank = 'revolut', now = Date.now()) {
  const label = BANKS[bank]?.label ?? bank;
  const conn = buildExplore(db, now).connections.find((c) => c.bank === bank);
  if (!conn) return { connected: false, label };
  const base = { connected: true, label, readsToday: conn.readsToday, readsPerDay: conn.readsPerDay, expired: conn.expired, daysLeft: conn.daysLeft };
  if (conn.empty) return { ...base, empty: true };
  // Solo conti e pocket in euro: sommare valute diverse non avrebbe senso. Il totale comprende i pagamenti in sospeso.
  const euro = conn.accounts.map((a) => a.total).filter((b) => b && (!b.currency || b.currency === 'EUR'));
  return {
    ...base, fetchedAt: conn.fetchedAt, accounts: conn.accounts.length,
    total: euro.length ? round(euro.reduce((s, b) => s + b.amount, 0)) : null,
    pendingTotal: round(euro.reduce((s, b) => s + b.pending, 0)),
    pending: conn.transactions.filter((t) => t.status === 'PDNG').length,
    recent: conn.transactions.slice(0, 3).map((t) => ({ date: t.date, status: t.status, amount: t.amount, name: (t.party || t.remittance || 'Movimento').slice(0, 40) })),
  };
}
