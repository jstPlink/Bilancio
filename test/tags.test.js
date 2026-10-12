import test from 'node:test';
import assert from 'node:assert/strict';
import { pocketTag, inferPocketName, isPocketTransfer, classify } from '../src/tags.js';

test('il pocket decide il tag: numero iniziale e maiuscole non contano', () => {
  assert.equal(pocketTag('01 Spesa'), 'spesa');
  assert.equal(pocketTag('02 svago'), 'svago');
  assert.equal(pocketTag('3. Carburante'), 'carburante');
  assert.equal(pocketTag('04 ALTRO'), 'altro');
  assert.equal(pocketTag('Risparmi'), null);
  assert.equal(pocketTag(''), null);
});

test('il nome del pocket si deduce dal testo dei movimenti', () => {
  const txs = [{ remittance: 'Accredita EUR 01 Spesa da EUR' }, { remittance: 'Accredita EUR 01 Spesa da EUR' }, { description: 'Esselunga' }];
  assert.equal(inferPocketName(txs), '01 Spesa');
  assert.equal(inferPocketName([{ description: 'Conad' }]), null);
});

test('i giri tra pocket si riconoscono dal testo', () => {
  assert.ok(isPocketTransfer({ description: 'Mario', remittance: 'Accredita EUR 02 Svago da EUR' }));
  assert.ok(isPocketTransfer({ description: 'A EUR 03 Carburante' }));
  assert.ok(!isPocketTransfer({ description: 'Esselunga Milano' }));
});

function dbWith(transactions, { names = {}, overrides = {} } = {}) {
  return {
    transactions: Object.fromEntries(transactions.map((t) => [t.id, { bank: 'revolut', currency: 'EUR', ...t }])),
    overrides,
    banking: {
      names,
      connections: [
        { id: 'c1', bank: 'revolut', accounts: [{ uid: 'main', iban: 'LT12', name: 'Mario' }, { uid: 'p1', iban: '', name: 'Mario' }, { uid: 'p2', iban: '', name: 'Mario' }, { uid: 'p3', iban: '', name: 'Mario' }] },
        { id: 'c2', bank: 'unicredit', accounts: [{ uid: 'uni', iban: 'IT60X0542811101000000123456', name: 'Conto' }] },
      ],
    },
  };
}

test('uscite dal pocket Spesa → Spesa; altri pocket, principale e UniCredit → Non definito; entrate → Entrata', () => {
  const db = dbWith([
    { id: 'a', account: 'p1', date: '2026-10-02', amount: -12, description: 'Esselunga' },
    { id: 'b', account: 'p2', date: '2026-10-02', amount: -5, description: 'Bar' },
    { id: 'c', account: 'main', date: '2026-10-02', amount: -7, description: 'Taxi' },
    { id: 'd', account: 'uni', bank: 'unicredit', date: '2026-10-02', amount: -9, description: 'Coop' },
    { id: 'e', account: 'uni', bank: 'unicredit', date: '2026-10-02', amount: 1800, description: 'Stipendio' },
    { id: 'f', account: 'p3', date: '2026-10-02', amount: -4, description: 'Spotify' },
  ], { names: { p1: '01 Spesa', p3: '04 Altro' } });
  const tags = classify(db);
  assert.equal(tags.get('a'), 'spesa');
  assert.equal(tags.get('b'), 'non_definito');
  assert.equal(tags.get('c'), 'non_definito');
  assert.equal(tags.get('d'), 'non_definito');
  assert.equal(tags.get('e'), 'entrata');
  assert.equal(tags.get('f'), 'altro');
});

test('giroconti: testo del pocket, IBAN di un mio conto, coppia uscita/entrata nella stessa banca; la scelta a mano vince', () => {
  const db = dbWith([
    { id: 't1', account: 'p1', date: '2026-10-02', amount: 150, description: 'Mario', remittance: 'Accredita EUR 01 Spesa da EUR' },
    { id: 't2', account: 'uni', bank: 'unicredit', date: '2026-10-03', amount: -300, description: 'Mario', counterIban: 'LT12' },
    { id: 't3', account: 'main', date: '2026-10-03', amount: 300, description: 'Mario', counterIban: 'IT60X0542811101000000123456' },
    { id: 't4', account: 'main', date: '2026-10-05', amount: -80, description: 'Mario' },
    { id: 't5', account: 'p2', date: '2026-10-06', amount: 80, description: 'Mario' },
    { id: 't6', account: 'main', date: '2026-10-07', amount: -20, description: 'Cena' },
  ], { overrides: { t6: 'giroconto', t3: 'entrata' } });
  const tags = classify(db);
  assert.equal(tags.get('t1'), 'giroconto');
  assert.equal(tags.get('t2'), 'giroconto'); // IBAN della controparte = il mio conto Revolut
  assert.equal(tags.get('t3'), 'entrata'); // scelto a mano
  assert.equal(tags.get('t4'), 'giroconto'); // uscita dal principale ed entrata sul pocket, stesso importo, stessa banca
  assert.equal(tags.get('t5'), 'giroconto');
  assert.equal(tags.get('t6'), 'giroconto'); // a mano
});
