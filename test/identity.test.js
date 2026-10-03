import test from 'node:test';
import assert from 'node:assert/strict';
import { inferOwnNames, inferPayers, learnIdentity, mergeNames, nameKey, recipientName, senderName } from '../src/identity.js';
import { categorize, setIdentity } from '../src/statements.js';

test('nome del mittente dalle descrizioni delle banche', () => {
  assert.equal(senderName('BONIFICO A VOSTRO FAVORE BONIFICO ISTANTANEO DA AZIENDA ESEMPIO S R L'), 'AZIENDA ESEMPIO');
  assert.equal(senderName('Pagamento da Mario Rossi'), 'Mario Rossi');
  assert.equal(senderName('Bonifico DA ACME SPA PER: stipendio 09/2026'), 'ACME');
  assert.equal(senderName('Acquisto Conad'), '');
});

test('nome del destinatario', () => {
  assert.equal(recipientName('BONIFICO A: ROSSI MARIO PER: giroconto'), 'ROSSI MARIO');
  assert.equal(recipientName('Pagamento a Mario Rossi'), 'Mario Rossi');
  assert.equal(recipientName('Conad'), '');
});

test('«Mario Rossi» e «ROSSI MARIO» sono lo stesso nome', () => {
  assert.equal(nameKey('Mario Rossi'), nameKey('ROSSI MARIO'));
  assert.equal(mergeNames('Mario Rossi', ['ROSSI MARIO', 'Acme']), 'Mario Rossi, Acme');
});

const slip = (year, month, amount) => ({ kind: 'stipendio', year, month, amount, name: `busta ${month}.pdf` });
const tx = (id, date, amount, description, extra = {}) => ({ id, date, amount, description, category: amount > 0 ? 'entrate' : 'altro', ...extra });

test('datore di lavoro: bonifico col netto della busta paga in almeno due mesi', () => {
  const db = {
    docs: { a: slip(2026, 7, 1500), b: slip(2026, 8, 1500) },
    transactions: {
      s1: tx('s1', '2026-07-27', 1500, 'BONIFICO ISTANTANEO DA ACME SPA'),
      s2: tx('s2', '2026-08-27', 1500, 'BONIFICO ISTANTANEO DA ACME SPA'),
      x1: tx('x1', '2026-08-10', 1500, 'Pagamento da Giuseppe Bianchi'), // stesso importo ma fuori dalla finestra di luglio… e di agosto no: serve il 10
    },
  };
  assert.deepEqual(inferPayers(db), ['Acme']);
});

test('con una sola busta paga non si deduce nulla (poca prova)', () => {
  const db = { docs: { a: slip(2026, 7, 1500) }, transactions: { s1: tx('s1', '2026-07-27', 1500, 'BONIFICO DA ACME SPA') } };
  assert.deepEqual(inferPayers(db), []);
});

test('nome del titolare: uscita e entrata identiche tra due conti, con lo stesso nome, almeno due volte', () => {
  const db = { transactions: {
    o1: tx('o1', '2026-06-02', -300, 'BONIFICO A: ROSSI MARIO PER: ricarica'),
    i1: tx('i1', '2026-06-02', 300, 'Pagamento da Mario Rossi'),
    o2: tx('o2', '2026-07-05', -200, 'BONIFICO A: ROSSI MARIO PER: ricarica'),
    i2: tx('i2', '2026-07-06', 200, 'Pagamento da Mario Rossi'),
    o3: tx('o3', '2026-07-09', -50, 'BONIFICO A: LUIGI VERDI PER: cena'), // nessuna entrata corrispondente: altra persona
  } };
  assert.deepEqual(inferOwnNames(db), ['Rossi Mario']);
});

test('learnIdentity: aggiorna le impostazioni e ricategorizza i giri interni, senza toccare le scelte a mano', () => {
  const db = {
    settings: { ownNames: '', incomePayers: '' },
    docs: { a: slip(2026, 7, 1500), b: slip(2026, 8, 1500) },
    transactions: {
      s1: tx('s1', '2026-07-27', 1500, 'BONIFICO ISTANTANEO DA ACME SPA'),
      s2: tx('s2', '2026-08-27', 1500, 'BONIFICO ISTANTANEO DA ACME SPA'),
      s3: tx('s3', '2026-09-27', 1500, 'BONIFICO ISTANTANEO DA ACME SPA PER: stipendio'),
      m1: tx('m1', '2026-09-28', 1500, 'BONIFICO ISTANTANEO DA ACME SPA', { manual: true }),
      altra: tx('altra', '2026-09-01', 80, 'Pagamento da Giuseppe Bianchi'),
    },
  };
  setIdentity({});
  const r = learnIdentity(db);
  assert.equal(db.settings.incomePayers, 'Acme');
  assert.equal(db.transactions.s1.category, 'giroconti');
  assert.equal(db.transactions.s3.category, 'giroconti');
  assert.equal(db.transactions.m1.category, 'entrate');   // scelta a mano: invariata
  assert.equal(db.transactions.altra.category, 'entrate'); // persona diversa: resta un'entrata
  assert.equal(r.changed, true);
  // un secondo giro non cambia più nulla
  assert.equal(learnIdentity(db).changed, false);
  setIdentity({});
});

test('i nuovi movimenti vengono categorizzati col nome ricavato', () => {
  setIdentity({ incomePayers: 'Acme' });
  assert.equal(categorize('BONIFICO ISTANTANEO DA ACME SPA', {}, '', 1500), 'giroconti');
  setIdentity({});
});

test('giri tra conti visti dai due lati: coppia uscita/entrata su conti diversi diventa giroconto', async () => {
  const { findMirrorTransfers, learnIdentity } = await import('../src/identity.js');
  const tx = (id, date, amount, description, product, extra = {}) => ({ id, date, amount, description, product, category: amount > 0 ? 'entrate' : 'altro', ...extra });
  const db = { settings: {}, docs: {}, transactions: {} };
  for (const t of [
    tx('a', '2026-09-10', -300, 'Bonifico a Revolut', 'UniCredit'), tx('b', '2026-09-11', 300, 'Top-up da UniCredit', 'Current'),
    tx('c', '2026-09-12', -50, 'Pizzeria', 'Current'), tx('d', '2026-09-12', 50, 'Rimborso amico', 'UniCredit'),   // nessun lato sembra un trasferimento
    tx('e', '2026-09-15', -80, 'Bonifico a Mario', 'UniCredit'), tx('f', '2026-09-15', 80, 'Bonifico da Anna', 'Current'), tx('g', '2026-09-16', 80, 'Bonifico da Luca', 'Current'), // ambiguo
    tx('h', '2026-09-20', -20, 'Transfer to pocket', 'Mario', { account: 'p1' }), tx('i', '2026-09-20', 20, 'Transfer from Current', 'Mario', { account: 'p2' }),
    tx('m', '2026-09-22', -40, 'Bonifico', 'UniCredit', { manual: true }), tx('n', '2026-09-22', 40, 'Bonifico', 'Current'),
  ]) db.transactions[t.id] = t;
  assert.deepEqual(findMirrorTransfers(db).map(([o, i]) => `${o.id}${i.id}`).sort(), ['ab', 'hi']);
  learnIdentity(db);
  const cat = (id) => db.transactions[id].category;
  assert.deepEqual(['a', 'b', 'h', 'i'].map(cat), ['giroconti', 'giroconti', 'giroconti', 'giroconti']);
  assert.deepEqual(['c', 'd', 'e', 'f', 'g', 'm', 'n'].map(cat), ['altro', 'entrate', 'altro', 'entrate', 'entrate', 'altro', 'entrate']);
});
