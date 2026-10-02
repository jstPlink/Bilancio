import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { checkKey, createClient, finishLink, makeJwt, mapTransaction, publicState, startLink, syncAll, syncConnection, bankingState } from '../src/banking.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const NOW = Date.parse('2026-10-02T10:00:00Z');
const dec = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());

test('il token JWT ha intestazione, dati e firma RS256 validi', () => {
  const jwt = makeJwt({ appId: 'app-1', privateKey }, NOW);
  const [h, b, sig] = jwt.split('.');
  assert.deepEqual(dec(h), { typ: 'JWT', alg: 'RS256', kid: 'app-1' });
  assert.deepEqual(dec(b), { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: NOW / 1000, exp: NOW / 1000 + 3600 });
  assert.equal(crypto.createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(sig, 'base64url')), true);
});

test('la chiave con gli «a capo» scritti come \\n funziona; una chiave sbagliata è rifiutata', () => {
  assert.doesNotThrow(() => checkKey(privateKey.trim().replace(/\n/g, '\\n')));
  assert.throws(() => checkKey('non è una chiave'), /chiave privata non è valida/);
});

test('il client manda il token e i parametri, e traduce gli errori', async () => {
  const calls = [];
  const fake = async (url, init) => {
    calls.push({ url: String(url), init });
    return url.pathname === '/aspsps' ? { ok: true, text: async () => '{"aspsps":[]}' } : { ok: false, status: 401, text: async () => '{"message":"credenziali errate"}' };
  };
  const client = createClient({ appId: 'a', privateKey }, fake);
  await client.aspsps({ psu_type: 'personal', service: 'AIS', vuoto: '' });
  assert.match(calls[0].url, /^https:\/\/api\.enablebanking\.com\/aspsps\?psu_type=personal&service=AIS$/);
  assert.match(calls[0].init.headers.Authorization, /^Bearer ey/);
  await assert.rejects(client.createSession('x'), /Enable Banking: credenziali errate/);
});

const conn = { bank: 'unicredit' };
const account = { uid: 'acc-1', name: 'Conto', iban: 'IT60X0542811101000000123456' };

test('uscita: importo negativo, controparte come descrizione, IBAN nel dettaglio', () => {
  const t = mapTransaction({
    transaction_id: 'T1', booking_date: '2026-09-30', credit_debit_indicator: 'DBIT', transaction_amount: { amount: '45.90', currency: 'EUR' },
    creditor: { name: 'Conad Spa' }, creditor_account: { iban: 'IT00A' }, remittance_information: ['Pagamento POS 123'], balance_after_transaction: { amount: '1000.10' },
  }, conn, account, {});
  assert.equal(t.amount, -45.9);
  assert.equal(t.description, 'Conad Spa');
  assert.equal(t.date, '2026-09-30');
  assert.equal(t.detail, 'Pagamento POS 123 · IBAN IT00A');
  assert.equal(t.balance, 1000.1);
  assert.equal(t.source, 'banca');
  assert.match(t.id, /^bk:[0-9a-f]{24}$/);
});

test('entrata: importo positivo e mittente; senza controparte vale la causale; senza data si scarta', () => {
  const credit = mapTransaction({ transaction_id: 'T2', booking_date: '2026-09-27', credit_debit_indicator: 'CRDT', transaction_amount: { amount: '1500' }, debtor: { name: 'Azienda Srl' } }, conn, account, {});
  assert.equal(credit.amount, 1500);
  assert.equal(credit.description, 'Azienda Srl');
  const noParty = mapTransaction({ transaction_id: 'T3', booking_date: '2026-09-27', credit_debit_indicator: 'DBIT', transaction_amount: { amount: '10' }, remittance_information: ['Canone mensile'] }, conn, account, {});
  assert.equal(noParty.description, 'Canone mensile');
  assert.equal(mapTransaction({ transaction_id: 'T4', credit_debit_indicator: 'DBIT', transaction_amount: { amount: '10' } }, conn, account, {}), null);
});

test('l\'id è stabile: lo stesso movimento due volte ha lo stesso id', () => {
  const tx = { transaction_id: 'T9', booking_date: '2026-09-01', credit_debit_indicator: 'DBIT', transaction_amount: { amount: '3' }, creditor: { name: 'Bar' } };
  assert.equal(mapTransaction(tx, conn, account, {}).id, mapTransaction(tx, conn, account, {}).id);
});

// ------------------------------------------------------------------ collegamento

const freshDb = () => ({ transactions: {}, rules: {}, banking: { app: { appId: 'a', privateKey }, connections: [], pending: {} } });

test('collegamento: si sceglie la banca, poi il codice diventa una sessione con i conti', async () => {
  const db = freshDb();
  const sent = [];
  const client = {
    aspsps: async () => [{ name: 'Revolut', country: 'LT', maximum_consent_validity: 90 * 86400 }, { name: 'UniCredit', country: 'IT' }],
    auth: async (body) => { sent.push(body); return { url: 'https://banca.example/autorizza' }; },
    createSession: async (code) => ({ session_id: 'S1', aspsp: { name: 'Revolut', country: 'LT' }, accounts: [{ uid: 'u1', account_id: { iban: 'LT123456789012345678' }, name: 'Principale', currency: 'EUR' }], access: { valid_until: '2027-01-01T00:00:00Z' } }),
  };
  const url = await startLink({ client, db, bank: 'revolut', redirectUrl: 'https://casa.example/api/banking/callback', now: NOW });
  assert.equal(url, 'https://banca.example/autorizza');
  assert.equal(sent[0].aspsp.name, 'Revolut');
  assert.equal(sent[0].psu_type, 'personal');
  assert.equal(sent[0].redirect_url, 'https://casa.example/api/banking/callback');
  // consenso: al massimo quello concesso dalla banca (90 giorni), non i 180 richiesti
  assert.ok(Date.parse(sent[0].access.valid_until) <= NOW + 90 * 86400000);
  const state = sent[0].state;
  assert.ok(db.banking.pending[state]);

  const c = await finishLink({ client, db, code: 'codice', state, now: NOW });
  assert.equal(c.id, 'S1');
  assert.equal(db.banking.connections.length, 1);
  assert.equal(db.banking.pending[state], undefined);
  await assert.rejects(finishLink({ client, db, code: 'x', state, now: NOW }), /scaduta o sconosciuta/);
});

test('l\'interfaccia non riceve mai la chiave privata e vede solo l\'IBAN mascherato', () => {
  const db = freshDb();
  db.banking.connections.push({ id: 'S1', bank: 'unicredit', accounts: [{ uid: 'u', iban: 'IT60X0542811101000000123456', name: 'Conto', currency: 'EUR' }], validUntil: '2026-12-01T00:00:00Z', lastSync: null, calls: [NOW - 1000] });
  const pub = publicState(db, NOW);
  assert.equal(JSON.stringify(pub).includes('BEGIN'), false);
  assert.equal(pub.configured, true);
  assert.equal(pub.connections[0].accounts[0].iban, 'IT60…3456');
  assert.equal(pub.connections[0].syncsToday, 1);
  assert.equal(pub.connections[0].expired, false);
});

// ------------------------------------------------------------------ sincronizzazione

const bookedTx = (id, amount, date = '2026-09-20', name = 'Negozio') => ({ transaction_id: id, booking_date: date, credit_debit_indicator: 'DBIT', transaction_amount: { amount: String(amount), currency: 'EUR' }, creditor: { name } });
const makeConn = (over = {}) => ({ id: 'S1', bank: 'unicredit', accounts: [{ uid: 'u1', iban: '', name: 'Conto', currency: 'EUR' }], validUntil: '2027-01-01T00:00:00Z', lastSync: null, calls: [], ...over });

test('sincronizzazione: scorre le pagine, chiede solo i movimenti registrati e non duplica', async () => {
  const db = freshDb();
  const queries = [];
  const client = {
    transactions: async (uid, q) => {
      queries.push(q);
      return q.continuation_key ? { transactions: [bookedTx('B', 20)] } : { transactions: [bookedTx('A', 10)], continuation_key: 'p2' };
    },
  };
  const c = makeConn();
  const r = await syncConnection({ client, db, conn: c, now: NOW });
  assert.deepEqual(r, { found: 2, added: 2, duplicates: 0 });
  assert.ok(queries.every((q) => q.transaction_status === 'BOOK'));
  assert.equal(queries[0].date_from, '2025-10-02'); // primo collegamento: un anno di storico
  assert.equal(c.lastSync, new Date(NOW).toISOString());
  // seconda lettura: riparte da qualche giorno prima e non ripete i movimenti
  const again = await syncConnection({ client, db, conn: c, now: NOW + 3600000 });
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 2);
  assert.equal(queries.at(-1).date_from, '2026-09-25');
});

test('i movimenti già importati da CSV o PDF (stessa data e importo) non si duplicano', async () => {
  const db = freshDb();
  db.transactions.csv1 = { id: 'csv1', date: '2026-09-20', amount: -10, description: 'NEGOZIO ROMA 123', category: 'spesa' };
  const client = { transactions: async () => ({ transactions: [bookedTx('A', 10), bookedTx('B', 10), bookedTx('C', 7)] }) };
  const r = await syncConnection({ client, db, conn: makeConn(), now: NOW });
  assert.equal(r.duplicates, 1); // uno dei due da 10 € c'è già nel file
  assert.equal(r.added, 2);
});

test('se la banca non concede un anno di storico si ripiega su 90 giorni', async () => {
  const db = freshDb();
  const from = [];
  const client = { transactions: async (uid, q) => { from.push(q.date_from); if (from.length === 1) throw new Error('periodo troppo lungo'); return { transactions: [bookedTx('A', 5)] }; } };
  const r = await syncConnection({ client, db, conn: makeConn(), now: NOW });
  assert.equal(r.added, 1);
  assert.deepEqual(from, ['2025-10-02', '2026-07-04']);
});

test('limite di 4 letture al giorno e consenso scaduto', async () => {
  const client = { transactions: async () => ({ transactions: [] }) };
  const busy = makeConn({ calls: [NOW - 1000, NOW - 2000, NOW - 3000, NOW - 4000] });
  await assert.rejects(syncConnection({ client, db: freshDb(), conn: busy, now: NOW }), /massimo 4 aggiornamenti al giorno/);
  await assert.rejects(syncConnection({ client, db: freshDb(), conn: makeConn({ validUntil: '2026-09-01T00:00:00Z' }), now: NOW }), /scaduto/);
  // le letture di ieri non contano più
  const old = makeConn({ calls: [NOW - 90000000, NOW - 91000000, NOW - 92000000, NOW - 93000000] });
  await syncConnection({ client, db: freshDb(), conn: old, now: NOW });
});

test('syncAll: salta le letture recenti e raccoglie gli errori senza fermarsi', async () => {
  const db = freshDb();
  db.banking.connections.push(makeConn({ id: 'recente', lastSync: new Date(NOW - 3600000).toISOString() }));
  db.banking.connections.push(makeConn({ id: 'scaduta', bank: 'revolut', validUntil: '2020-01-01T00:00:00Z' }));
  db.banking.connections.push(makeConn({ id: 'buona', bank: 'revolut', lastSync: new Date(NOW - 10 * 3600000).toISOString() }));
  const client = { transactions: async () => ({ transactions: [bookedTx('A', 4)] }) };
  const r = await syncAll({ client, db, now: NOW, minAgeMs: 3 * 3600000 });
  assert.equal(r.skipped, 1);
  assert.equal(r.added, 1);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /scaduto/);
  assert.equal(bankingState(db).connections.length, 3);
});
