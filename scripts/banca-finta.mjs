// Banca finta per provare l'app senza toccare le banche vere. Imita le parti di Enable Banking che l'app usa
// (dettagli del conto, saldi, movimenti registrati e in sospeso, con le pagine) con dati inventati.
//
//   node scripts/banca-finta.mjs [porta]                  (di norma 4890)
//   ENABLE_BANKING_API=http://127.0.0.1:4890 npm start    (l'app parla con la banca finta)
//
// I conti sono due, con campi diversi come nelle banche vere: "unicredit-1" (causale, IBAN della controparte, nessun saldo
// nei movimenti) e "revolut-1" (saldo dopo ogni movimento, categoria merceologica, riferimento). Niente è reale.
import http from 'node:http';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4890);
const DAY = 86400000;
const today = new Date();
today.setUTCHours(12, 0, 0, 0);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Numeri «casuali» ma sempre uguali per lo stesso conto, così le pagine successive sono coerenti fra loro.
function build(uid) {
  let seed = 20260930 + uid.length;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const revolut = uid.startsWith('revolut');
  const rows = [];
  const add = (daysAgo, amount, name, extra = {}) => {
    const credit = amount > 0;
    rows.push({ daysAgo, amount, name, credit, extra });
  };
  for (let m = 0; m < 12; m++) {
    const base = m * 30 + 3;
    if (!revolut) {
      add(base + 4, 1450, 'Azienda Esempio Srl', { remittance: ['STIPENDIO MESE'] });
      add(base + 6, -568, 'Locatore Casa Srl', { remittance: ['AFFITTO MENSILE'], iban: 'IT28W8000000292100645211208' });
      add(base + 9, -(45 + Math.round(rnd() * 40)), 'Energia Luce Spa', { remittance: ['FATTURA N. ' + (1000 + m)], iban: 'IT60X0542811101000000123456' });
      add(base + 12, -202, 'Finanziaria Prestiti Spa', { remittance: ['RATA MUTUO'] });
    } else {
      add(base + 1, -13.99, 'Netflix.com', { mcc: '4899' });
      add(base + 5, -9.99, 'Spotify', { mcc: '5815' });
      add(base + 8, -(55 + Math.round(rnd() * 10)), 'Q8 Via Emilia', { mcc: '5541' });
    }
    for (let k = 0; k < 6; k++) {
      const name = pick(revolut ? ['Esselunga Milano', 'Conad City', 'Lidl', 'Maracaibo', 'Farmacia Centrale', 'Pizzeria Da Gigi', 'AMZN Mktp IT'] : ['Supermercato Coop', 'Bar Sport', 'Ferramenta Rossi']);
      add(base + 13 + k * 2, -(8 + Math.round(rnd() * 5000) / 100), name, revolut ? { mcc: '5411' } : { remittance: ['PAGAMENTO POS ' + name.toUpperCase()] });
    }
  }
  add(40, 120, 'Giulia Bianchi', { remittance: ['Rimborso cena'] });
  rows.sort((a, b) => a.daysAgo - b.daysAgo); // dal più recente
  let balance = revolut ? 842.37 : 3120.5;
  return rows.map((r, i) => {
    const date = iso(today.getTime() - r.daysAgo * DAY);
    const tx = {
      transaction_id: `${uid}-${i}`, booking_date: date, value_date: date,
      credit_debit_indicator: r.credit ? 'CRDT' : 'DBIT', status: 'BOOK',
      transaction_amount: { amount: Math.abs(r.amount).toFixed(2), currency: 'EUR' },
      [r.credit ? 'debtor' : 'creditor']: { name: r.name },
    };
    if (r.extra.remittance) tx.remittance_information = r.extra.remittance;
    if (r.extra.iban) tx.creditor_account = { iban: r.extra.iban };
    if (revolut) {
      tx.reference_number = `REF${100000 + i}`;
      if (r.extra.mcc) tx.merchant_category_code = r.extra.mcc;
      tx.balance_after_transaction = { amount: balance.toFixed(2), currency: 'EUR' };
      balance -= r.amount; // si risale: il più recente ha il saldo attuale
    } else {
      tx.entry_reference = `E${900000 + i}`;
      tx.bank_transaction_code = { description: r.credit ? 'Accredito' : 'Addebito' };
    }
    return tx;
  });
}

const ACCOUNTS = {
  'unicredit-1': { name: 'Conto Corrente', iban: 'IT60X0542811101000000123456', product: 'Conto Genius', balance: 3120.5, available: 3120.5 },
  'revolut-1': { name: 'Principale', iban: 'LT123456789012345678', product: 'Current', balance: 842.37, available: 842.37 },
};
const pending = (uid) => (uid.startsWith('revolut')
  ? [{ transaction_id: `${uid}-p1`, value_date: iso(today.getTime()), credit_debit_indicator: 'DBIT', status: 'PDNG', transaction_amount: { amount: '4.50', currency: 'EUR' }, creditor: { name: 'Bar Centrale' }, merchant_category_code: '5814' }]
  : [{ transaction_id: `${uid}-p1`, value_date: iso(today.getTime()), credit_debit_indicator: 'DBIT', status: 'PDNG', transaction_amount: { amount: '30.00', currency: 'EUR' }, creditor: { name: 'Supermercato Coop' }, remittance_information: ['PAGAMENTO POS IN ELABORAZIONE'] }]);

const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!String(req.headers.authorization ?? '').startsWith('Bearer ey')) return send(res, 401, { message: 'token mancante o non valido' });
  const m = /^\/accounts\/([^/]+)\/(transactions|balances|details)$/.exec(url.pathname);
  if (!m || !ACCOUNTS[m[1]]) return send(res, 404, { message: 'conto sconosciuto' });
  const [, uid, what] = m;
  const acc = ACCOUNTS[uid];
  if (what === 'details') {
    return send(res, 200, { uid, account_id: { iban: acc.iban }, name: acc.name, currency: 'EUR', cash_account_type: 'CACC', product: acc.product, usage: 'PRIV', details: 'Conto di prova' });
  }
  if (what === 'balances') {
    return send(res, 200, { balances: [
      { name: 'Saldo contabile', balance_type: 'CLBD', balance_amount: { amount: acc.balance.toFixed(2), currency: 'EUR' }, last_change_date_time: today.toISOString() },
      { name: 'Disponibile', balance_type: 'ITAV', balance_amount: { amount: acc.available.toFixed(2), currency: 'EUR' }, last_change_date_time: today.toISOString() },
    ] });
  }
  if (url.searchParams.get('transaction_status') === 'PDNG') return send(res, 200, { transactions: pending(uid) });
  const from = url.searchParams.get('date_from') ?? '0000-00-00';
  const all = build(uid).filter((t) => t.booking_date >= from);
  const start = Number(url.searchParams.get('continuation_key') ?? 0);
  const page = all.slice(start, start + 50);
  return send(res, 200, { transactions: page, ...(start + 50 < all.length ? { continuation_key: String(start + 50) } : {}) });
}).listen(port, '127.0.0.1', () => console.log(`Banca finta su http://127.0.0.1:${port} (conti: ${Object.keys(ACCOUNTS).join(', ')})`));
