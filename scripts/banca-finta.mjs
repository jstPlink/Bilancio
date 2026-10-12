// Banca finta per provare l'app senza toccare le banche vere. Imita le parti di Enable Banking che l'app usa
// (elenco banche, autorizzazione, sessione, movimenti registrati e in sospeso, con le pagine) con dati inventati.
//
//   node scripts/banca-finta.mjs [porta]                  (di norma 4890)
//   ENABLE_BANKING_API=http://127.0.0.1:4890 npm start    (l'app parla con la banca finta)
//
// UniCredit: un conto corrente. Revolut: il conto principale e cinque pocket (01 Spesa, 02 Svago, 03 Carburante, 04 Altro, Risparmi) senza
// IBAN, con il nome dell'intestatario e il nome vero del pocket solo nel testo dei movimenti («Accredita EUR 01 Spesa da EUR»).
// Le date sono relative a oggi. Niente è reale.
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
const IBAN = { unicredit: 'IT60X0542811101000000123456', revolut: 'LT123456789012345678' };

export const ACCOUNTS = {
  'unicredit-1': { bank: 'unicredit', name: 'Conto Corrente', iban: IBAN.unicredit, type: 'CACC' },
  'revolut-1': { bank: 'revolut', name: 'Mario Rossi', iban: IBAN.revolut, type: 'CACC' },
  'revolut-2': { bank: 'revolut', name: 'Mario Rossi', iban: '', type: 'SVGS', pocket: '01 Spesa' },
  'revolut-3': { bank: 'revolut', name: 'Mario Rossi', iban: '', type: 'SVGS', pocket: '02 Svago' },
  'revolut-4': { bank: 'revolut', name: 'Mario Rossi', iban: '', type: 'SVGS', pocket: '03 Carburante' },
  'revolut-5': { bank: 'revolut', name: 'Mario Rossi', iban: '', type: 'SVGS', pocket: '04 Altro' },
  'revolut-6': { bank: 'revolut', name: 'Mario Rossi', iban: '', type: 'SVGS', pocket: 'Risparmi' },
};

const SPEND = {
  '01 Spesa': ['Esselunga Milano', 'Conad City', 'Lidl', 'Coop'],
  '02 Svago': ['Netflix.com', 'Cinema Odeon', 'Pizzeria Da Gigi', 'Spotify'],
  '03 Carburante': ['Q8 Via Emilia', 'Eni Station', 'Tamoil'],
  '04 Altro': ['Farmacia Centrale', 'AMZN Mktp IT', 'Ferramenta Rossi'],
  Risparmi: ['Giulia Bianchi'],
};

export function createFakeBank({ today = new Date() } = {}) {
  const t0 = new Date(today);
  t0.setUTCHours(12, 0, 0, 0);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

  // Numeri «casuali» ma sempre uguali per lo stesso conto, così le pagine successive sono coerenti fra loro.
  function build(uid) {
    const acc = ACCOUNTS[uid];
    let seed = 20261012 + uid.length * 7 + uid.charCodeAt(uid.length - 1);
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    const rows = [];
    const add = (daysAgo, amount, party, extra = {}) => rows.push({ daysAgo, amount, party, extra });
    for (let m = 0; m < 14; m++) {
      const base = m * 30 + 1; // ogni «mese» sta in 11 giorni: il mese in corso è fatto di movimenti recenti
      if (uid === 'unicredit-1') {
        add(base + 2, 1800, 'Azienda Esempio Srl', { remittance: ['STIPENDIO MESE'] });
        add(base + 3, -600, 'Locatore Casa Srl', { remittance: ['AFFITTO MENSILE'], iban: 'IT28W8000000292100645211208' });
        add(base + 4, -(45 + Math.round(rnd() * 40)), 'Energia Luce Spa', { remittance: ['FATTURA ' + (1000 + m)], iban: 'IT60X0542811101000000123457' });
        add(base + 5, -300, 'Mario Rossi', { remittance: ['Ricarica Revolut'], iban: IBAN.revolut }); // giro verso il mio conto Revolut
      } else if (uid === 'revolut-1') {
        add(base + 5, 300, 'Mario Rossi', { remittance: ['Ricarica da UniCredit'], iban: IBAN.unicredit });
        for (const p of ['01 Spesa', '02 Svago', '03 Carburante', '04 Altro']) add(base + 6, -(50 + Math.round(rnd() * 50)), p, { remittance: [`A EUR ${p}`] });
      } else {
        const pocket = acc.pocket;
        add(base + 6, 150, 'Mario Rossi', { remittance: [`Accredita EUR ${pocket} da EUR`] });
        for (let k = 0; k < (pocket === 'Risparmi' ? 1 : 4); k++) add(base + 7 + k, -(5 + Math.round(rnd() * 4500) / 100), pick(SPEND[pocket]), { mcc: '5411' });
      }
    }
    if (uid === 'revolut-1') add(1, -3.2, 'Bar Centrale', { mcc: '5814' });
    rows.sort((a, b) => a.daysAgo - b.daysAgo); // dal più recente
    return rows.map((r, i) => {
      const date = iso(t0.getTime() - r.daysAgo * DAY);
      const credit = r.amount > 0;
      const tx = {
        transaction_id: `${uid}-${i}`, booking_date: date, value_date: date,
        credit_debit_indicator: credit ? 'CRDT' : 'DBIT', status: 'BOOK',
        transaction_amount: { amount: Math.abs(r.amount).toFixed(2), currency: 'EUR' },
        [credit ? 'debtor' : 'creditor']: { name: r.party },
      };
      if (r.extra.remittance) tx.remittance_information = r.extra.remittance;
      if (r.extra.iban) tx[credit ? 'debtor_account' : 'creditor_account'] = { iban: r.extra.iban };
      if (r.extra.mcc) tx.merchant_category_code = r.extra.mcc;
      return tx;
    });
  }

  const pending = (uid) => (uid === 'revolut-2'
    ? [{ transaction_id: `${uid}-p1`, value_date: iso(t0.getTime()), credit_debit_indicator: 'DBIT', status: 'PDNG', transaction_amount: { amount: '4.50', currency: 'EUR' }, creditor: { name: 'Bar Centrale' } }]
    : []);

  const authorizations = new Map(); // state → { bank, redirect }
  const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
  const calls = { transactions: 0 };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    // pagina di «autorizzazione» della banca: rimanda subito all'app col codice
    if (url.pathname === '/authorize') {
      const a = authorizations.get(url.searchParams.get('state'));
      if (!a) return send(res, 404, { message: 'richiesta sconosciuta' });
      res.statusCode = 302;
      res.setHeader('Location', `${a.redirect}${a.redirect.includes('?') ? '&' : '?'}code=${a.bank}&state=${encodeURIComponent(url.searchParams.get('state'))}`);
      return res.end();
    }
    if (!String(req.headers.authorization ?? '').startsWith('Bearer ey')) return send(res, 401, { message: 'token mancante o non valido' });
    const origin = `http://${req.headers.host}`;
    if (url.pathname === '/aspsps') return send(res, 200, { aspsps: [{ name: 'UniCredit', country: 'IT', maximum_consent_validity: 15552000 }, { name: 'Revolut', country: 'LT', maximum_consent_validity: 15552000 }] });
    if (url.pathname === '/auth' && req.method === 'POST') {
      const body = await readBody(req);
      authorizations.set(body.state, { bank: /revolut/i.test(body.aspsp?.name) ? 'revolut' : 'unicredit', redirect: body.redirect_url });
      return send(res, 200, { url: `${origin}/authorize?state=${encodeURIComponent(body.state)}`, authorization_id: body.state });
    }
    if (url.pathname === '/sessions' && req.method === 'POST') {
      const { code } = await readBody(req);
      if (code !== 'unicredit' && code !== 'revolut') return send(res, 400, { message: 'codice non valido' });
      return send(res, 200, {
        session_id: `sess-${code}`, aspsp: { name: code === 'revolut' ? 'Revolut' : 'UniCredit', country: code === 'revolut' ? 'LT' : 'IT' },
        access: { valid_until: new Date(t0.getTime() + 170 * DAY).toISOString() },
        accounts: Object.entries(ACCOUNTS).filter(([, a]) => a.bank === code).map(([uid, a]) => ({ uid, name: a.name, currency: 'EUR', cash_account_type: a.type, ...(a.iban ? { account_id: { iban: a.iban } } : {}) })),
      });
    }
    if (url.pathname.startsWith('/sessions/') && req.method === 'DELETE') return send(res, 200, {});
    const m = /^\/accounts\/([^/]+)\/transactions$/.exec(url.pathname);
    if (!m || !ACCOUNTS[m[1]]) return send(res, 404, { message: 'conto sconosciuto' });
    calls.transactions++;
    const uid = m[1];
    if (url.searchParams.get('transaction_status') === 'PDNG') return send(res, 200, { transactions: pending(uid) });
    const from = url.searchParams.get('date_from') ?? '0000-00-00';
    const all = build(uid).filter((t) => t.booking_date >= from);
    const start = Number(url.searchParams.get('continuation_key') ?? 0);
    return send(res, 200, { transactions: all.slice(start, start + 50), ...(start + 50 < all.length ? { continuation_key: String(start + 50) } : {}) });
  });
  return { server, calls, listen: (port) => new Promise((r) => server.listen(port, '127.0.0.1', () => r(server.address().port))), close: () => new Promise((r) => server.close(r)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 4890);
  createFakeBank().listen(port).then((p) => console.log(`Banca finta su http://127.0.0.1:${p} (conti: ${Object.keys(ACCOUNTS).join(', ')})`));
}
