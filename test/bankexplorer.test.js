import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceTrend, balanceView, buildExplore, flatten, inferPocketName, totalBalance } from '../src/bankexplorer.js';
import { bankingState, readBankData } from '../src/banking.js';

const NOW = Date.parse('2026-10-02T10:00:00Z');
const tx = (id, date, amount, name, extra = {}) => ({
  transaction_id: id, booking_date: date, credit_debit_indicator: amount < 0 ? 'DBIT' : 'CRDT',
  transaction_amount: { amount: String(Math.abs(amount)), currency: 'EUR' },
  ...(amount < 0 ? { creditor: { name } } : { debtor: { name } }), ...extra,
});

test('flatten: campi annidati, elenchi e valori vuoti', () => {
  const f = flatten({ a: { b: 'x', vuoto: '' }, lista: ['uno', 'due'], oggetti: [{ iban: 'IT1' }, { iban: 'IT2' }], nullo: null });
  assert.deepEqual([...f], [['a.b', 'x'], ['lista[]', 'uno · due'], ['oggetti[].iban', 'IT1']]);
});

test('balanceTrend: usa il saldo scritto dalla banca; altrimenti ricostruisce all\'indietro dal saldo attuale', () => {
  const withBalance = [
    tx('1', '2026-09-01', -10, 'A', { balance_after_transaction: { amount: '90' } }),
    tx('2', '2026-09-02', -20, 'B', { balance_after_transaction: { amount: '70' } }),
    tx('3', '2026-09-03', 30, 'C', { balance_after_transaction: { amount: '100' } }),
  ];
  const declared = balanceTrend(withBalance, []);
  assert.equal(declared.source, 'banca');
  assert.deepEqual(declared.points.map((p) => p.balance), [90, 70, 100]);

  // Elencati dal più recente, senza saldo nei movimenti: dal saldo attuale (100) si risale.
  const plain = [tx('3', '2026-09-03', 30, 'C'), tx('2', '2026-09-02', -20, 'B'), tx('1', '2026-09-01', -10, 'A')];
  const rebuilt = balanceTrend(plain, [{ balance_type: 'CLBD', balance_amount: { amount: '100', currency: 'EUR' } }]);
  assert.equal(rebuilt.source, 'ricostruito');
  assert.deepEqual(rebuilt.points.map((p) => [p.date, p.balance]), [['2026-09-01', 90], ['2026-09-02', 70], ['2026-09-03', 100]]);

  const none = balanceTrend(plain, []);
  assert.deepEqual(none.points, []);
  assert.match(none.note, /non fornisce/);
});

test('balanceView: etichette leggibili e valori non numerici scartati', () => {
  const v = balanceView([{ balance_type: 'ITAV', balance_amount: { amount: '12.5', currency: 'EUR' } }, { balance_type: 'XPCD', balance_amount: { amount: 'x' } }]);
  assert.deepEqual(v.map((b) => [b.label, b.amount]), [['Disponibile', 12.5]]);
});

// ------------------------------------------------------------------ lettura dalla banca

const makeDb = () => ({ transactions: { gia: { id: 'gia', date: '2026-01-01', amount: -1, description: 'Esistente', category: 'spesa' } }, rules: { bar: 'svago' }, banking: { app: { appId: 'a', privateKey: 'x' }, connections: [], pending: {} } });
const makeConn = (over = {}) => ({ id: 'S1', bank: 'unicredit', accounts: [{ uid: 'u1', iban: 'IT60X0542811101000000123456', name: 'Conto', currency: 'EUR' }], validUntil: '2027-01-01T00:00:00Z', lastSync: null, calls: [], ...over });

test('la lettura per la scheda Banche tiene una copia a parte e non tocca i dati dell\'app', async () => {
  const db = makeDb();
  const conn = makeConn();
  db.banking.connections.push(conn);
  const asked = [];
  const client = {
    transactions: async (uid, q) => { asked.push(q.transaction_status); return { transactions: q.transaction_status === 'PDNG' ? [tx('p1', '2026-10-01', -5, 'In attesa')] : [tx('a', '2026-09-20', -10, 'Negozio'), tx('b', '2026-09-21', 50, 'Azienda')] }; },
    balances: async () => ({ balances: [{ balance_type: 'CLBD', balance_amount: { amount: '500', currency: 'EUR' } }] }),
    details: async () => ({ name: 'Conto', cash_account_type: 'CACC', product: 'Conto corrente' }),
  };
  const before = JSON.stringify([db.transactions, db.rules]);
  const r = await readBankData({ client, db, conn, now: NOW });
  assert.deepEqual(r, { accounts: 1, booked: 2, pending: 1 });
  assert.equal(JSON.stringify([db.transactions, db.rules]), before); // movimenti e categorie dell'app: identici
  assert.equal(conn.lastSync, null); // e non conta come importazione
  assert.equal(conn.calls.length, 1); // ma consuma una delle letture giornaliere
  assert.deepEqual(asked, ['BOOK', 'PDNG']);

  const view = buildExplore(db, NOW);
  const c = view.connections[0];
  assert.equal(c.accounts[0].booked, 2);
  assert.equal(c.accounts[0].pending, 1);
  assert.equal(c.accounts[0].type, 'CACC');
  assert.equal(c.accounts[0].balances[0].label, 'Saldo contabile');
  assert.equal(c.transactions.length, 3);
  assert.equal(c.transactions.find((t) => t.status === 'PDNG').party, 'In attesa');
});

test('se la banca non fornisce saldi o movimenti in sospeso, la lettura prosegue e lo segnala', async () => {
  const db = makeDb();
  const conn = makeConn();
  db.banking.connections.push(conn);
  const client = {
    transactions: async (uid, q) => { if (q.transaction_status === 'PDNG') throw new Error('non supportato'); return { transactions: [tx('a', '2026-09-20', -10, 'Negozio')] }; },
    balances: async () => { throw new Error('saldi non disponibili'); },
    details: async () => ({}),
  };
  await readBankData({ client, db, conn, now: NOW });
  const a = buildExplore(db, NOW).connections[0].accounts[0];
  assert.deepEqual(a.unavailable.map((u) => u.what), ['movimenti in sospeso', 'saldi']);
  assert.equal(a.booked, 1);
});

test('stessi limiti delle altre letture: massimo 10 al giorno e consenso scaduto', async () => {
  const client = { transactions: async () => ({ transactions: [] }), balances: async () => ({}), details: async () => ({}) };
  const busy = makeConn({ calls: Array.from({ length: 10 }, (_, i) => NOW - 1000 * (i + 1)) });
  await assert.rejects(readBankData({ client, db: makeDb(), conn: busy, now: NOW }), /massimo 10 letture al giorno/);
  await assert.rejects(readBankData({ client, db: makeDb(), conn: makeConn({ validUntil: '2026-09-01T00:00:00Z' }), now: NOW }), /scaduto/);
});

test('senza lettura la scheda mostra il collegamento vuoto, e la copia sparisce con il collegamento', async () => {
  const db = makeDb();
  db.banking.connections.push(makeConn());
  assert.equal(buildExplore(db, NOW).connections[0].empty, true);
  const client = { transactions: async () => ({ transactions: [] }), balances: async () => ({}), details: async () => ({}) };
  await readBankData({ client, db, conn: db.banking.connections[0], now: NOW });
  assert.ok(bankingState(db).snapshots.S1);
});

// ------------------------------------------------------------------ nomi dei pocket, storico, motivo dei 90 giorni

const bankDb = (accounts) => {
  const db = makeDb();
  db.banking.connections.push(makeConn({ id: 'R1', bank: 'revolut', accounts }));
  return db;
};
const reader = (perAccount) => ({
  transactions: async (uid, q) => ({ transactions: q.transaction_status === 'PDNG' ? [] : (perAccount[uid] ?? []) }),
  balances: async () => ({ balances: [{ balance_type: 'ITAV', balance_amount: { amount: '47.18', currency: 'EUR' }, last_change_date_time: '2026-10-01T10:00:00Z' }] }),
  details: async (uid) => ({ name: 'Mario Rossi', cash_account_type: uid === 'pocket' ? 'SVGS' : 'CACC' }),
});

test('inferPocketName: il nome vero del pocket si ricava dal testo dei movimenti', () => {
  const txs = [
    tx('1', '2026-09-01', 150, 'Mario Rossi', { remittance_information: ['Accredita EUR 01 Spesa da EUR'] }),
    tx('2', '2026-09-08', -12, 'Lidl'),
    tx('3', '2026-09-15', 150, 'Mario Rossi', { remittance_information: ['Accredita EUR 01 Spesa da EUR'] }),
    tx('4', '2026-09-20', -5, 'Spotify', { note: 'Da EUR 02 Svago' }),
  ];
  const r = inferPocketName(txs);
  assert.equal(r.name, '01 Spesa'); // il più frequente
  assert.equal(r.count, 2);
  assert.equal(inferPocketName([tx('x', '2026-09-01', -3, 'Bar')]), null);
  assert.equal(inferPocketName([]), null);
});

test('un pocket prende il nome dai movimenti, a meno che tu non gliene dia uno; il conto principale resta com\'è', async () => {
  const db = bankDb([
    { uid: 'main', iban: 'LT123456789012345678', name: 'Mario Rossi', currency: 'EUR', type: 'CACC' },
    { uid: 'pocket', iban: '', name: 'Mario Rossi', currency: 'EUR', type: 'SVGS' },
    { uid: 'muto', iban: '', name: 'Mario Rossi', currency: 'EUR', type: 'SVGS' },
  ]);
  const client = reader({
    main: [tx('m1', '2026-09-01', -50, 'A EUR 01 Spesa', { remittance_information: ['A EUR 01 Spesa'] })],
    pocket: [tx('p1', '2026-09-01', 50, 'Mario Rossi', { remittance_information: ['Accredita EUR 01 Spesa da EUR'] })],
    muto: [tx('q1', '2026-09-02', -4, 'Bar Roma')],
  });
  await readBankData({ client, db, conn: db.banking.connections[0], now: NOW });
  const names = () => Object.fromEntries(buildExplore(db, NOW).connections[0].accounts.map((a) => [a.uid, [a.name, a.nameSource, a.main]]));
  assert.deepEqual(names(), {
    main: ['Mario Rossi', 'intestatario', true], // niente nome ricavato: ha l'IBAN, il «A EUR 01 Spesa» è un altro pocket
    pocket: ['01 Spesa', 'movimenti', false],
    muto: ['Mario Rossi', 'intestatario', false],
  });
  bankingState(db).names.pocket = 'Spesa settimanale';
  bankingState(db).names.muto = 'Imprevisti';
  assert.deepEqual(names().pocket, ['Spesa settimanale', 'manuale', false]);
  assert.deepEqual(names().muto, ['Imprevisti', 'manuale', false]);
  const rows = buildExplore(db, NOW).connections[0];
  assert.equal(rows.accounts.find((a) => a.uid === 'pocket').holder, 'Mario Rossi'); // l'intestatario resta visibile
});

test('lo storico non si perde: ad ogni lettura i movimenti vecchi restano e quelli nuovi si aggiungono, senza doppioni', async () => {
  const db = bankDb([{ uid: 'a', iban: 'LT1', name: 'Conto', currency: 'EUR', type: 'CACC' }]);
  const conn = db.banking.connections[0];
  const first = [tx('t3', '2026-10-01', -3, 'C'), tx('t2', '2026-09-01', -2, 'B'), tx('t1', '2026-07-05', -1, 'A')];
  await readBankData({ client: reader({ a: first }), db, conn, now: NOW });
  // la lettura successiva vede solo gli ultimi 90 giorni: t1 non c'è più, ma c'è un movimento nuovo
  const second = [tx('t4', '2026-10-02', -4, 'D'), tx('t3', '2026-10-01', -3, 'C'), tx('t2', '2026-09-01', -2, 'B')];
  await readBankData({ client: reader({ a: second }), db, conn, now: NOW + 3600000 });
  const a = buildExplore(db, NOW).connections[0].accounts[0];
  assert.equal(a.booked, 4);
  assert.equal(a.from, '2026-07-05');
  assert.equal(a.to, '2026-10-02');
});

test('se la banca non concede un anno di storico, il motivo si vede', async () => {
  const db = bankDb([{ uid: 'a', iban: 'LT1', name: 'Conto', currency: 'EUR', type: 'CACC' }]);
  const dates = [];
  const client = {
    transactions: async (uid, q) => {
      dates.push(q.date_from);
      if (q.date_from < '2026-06-01') throw new Error('Enable Banking: date_from is older than 90 days');
      return { transactions: [tx('t1', '2026-09-01', -2, 'B')] };
    },
    balances: async () => ({}), details: async () => ({}),
  };
  await readBankData({ client, db, conn: db.banking.connections[0], now: NOW });
  const a = buildExplore(db, NOW).connections[0].accounts[0];
  assert.match(a.historyNote, /non ha concesso 12 mesi di storico/);
  assert.match(a.historyNote, /older than 90 days/);
  assert.match(a.historyNote, /90 giorni/);
  assert.equal(a.booked, 1);
});

test('buildBankWidget: saldo dei conti in euro e ultimi movimenti dalla copia, senza chiamare la banca', async () => {
  const { buildBankWidget } = await import('../src/bankexplorer.js');
  const db = { banking: { app: null, connections: [], pending: {} } };
  const b = bankingState(db);
  assert.deepEqual(buildBankWidget(db, 'revolut', NOW), { connected: false, label: 'Revolut' });
  const bal = (amount, currency = 'EUR') => [{ balance_type: 'CLBD', balance_amount: { amount, currency } }];
  b.connections.push({ id: 'c1', bank: 'revolut', validUntil: '2027-01-01T00:00:00Z', calls: [], accounts: [{ uid: 'a1', name: 'Mario', iban: 'IT1' }, { uid: 'a2', name: 'Mario' }, { uid: 'a3', name: 'Mario' }] });
  assert.equal(buildBankWidget(db, 'revolut', NOW).empty, true);
  const t = (id, date, amount, name) => ({ transaction_id: id, booking_date: date, credit_debit_indicator: amount < 0 ? 'DBIT' : 'CRDT', transaction_amount: { amount: String(Math.abs(amount)), currency: 'EUR' }, ...(amount < 0 ? { creditor: { name } } : { debtor: { name } }) });
  b.snapshots.c1 = { fetchedAt: '2026-10-03T10:00:00.000Z', accounts: {
    a1: { booked: [t('1', '2026-10-01', -10, 'Bar'), t('2', '2026-10-02', -3, 'Edicola')], pending: [{ ...t('p', '2026-10-03', -4.5, 'Caffè'), status: 'PDNG' }], balances: bal('100.50'), details: null, unavailable: [] },
    a2: { booked: [], pending: [], balances: bal('20'), details: null, unavailable: [] },
    a3: { booked: [], pending: [], balances: bal('999', 'USD'), details: null, unavailable: [] },
  } };
  const w = buildBankWidget(db, 'revolut', NOW);
  assert.equal(w.total, 116); // 100,50 − 4,50 in sospeso + 20: il pocket in dollari non si somma
  assert.equal(w.pendingTotal, -4.5);
  assert.equal(w.pending, 1);
  assert.deepEqual(w.recent.map((r) => [r.status, r.amount, r.name]), [['PDNG', -4.5, 'Caffè'], ['BOOK', -3, 'Edicola'], ['BOOK', -10, 'Bar']]);
  assert.equal(w.fetchedAt, '2026-10-03T10:00:00.000Z');
});

test('totalBalance: saldo contabile più i sospesi; se la banca dà solo il disponibile si usa quello', () => {
  const view = balanceView([{ balance_type: 'CLBD', balance_amount: { amount: '100', currency: 'EUR' } }, { balance_type: 'ITAV', balance_amount: { amount: '90', currency: 'EUR' } }]);
  const pending = [tx('p1', '2026-10-01', -4.5, 'Bar'), tx('p2', '2026-10-01', 12, 'Rimborso')];
  const t = totalBalance(view, pending);
  assert.deepEqual([t.amount, t.pending, t.pendingCount, t.basis], [107.5, 7.5, 2, 'booked']);
  const only = totalBalance(balanceView([{ balance_type: 'ITAV', balance_amount: { amount: '90', currency: 'EUR' } }]), pending);
  assert.deepEqual([only.amount, only.pending, only.basis], [90, 0, 'available']);
  assert.equal(totalBalance([], pending), null);
});
