import test from 'node:test';
import assert from 'node:assert/strict';
import { matchBillPayments } from '../src/billmatch.js';

const doc = (name, kind, year, month, amount) => ({ name, kind, year, month, amount, status: 'ok' });
const tx = (id, date, amount, description, extra = {}) => ({ id, date, amount, description, category: 'altro', ...extra });

test('un addebito con lo stesso importo di una bolletta vicina viene abbinato e non conta due volte', () => {
  const db = {
    docs: { a: doc('Crispiano/2026/Elettricità Reset 2026.02.pdf', 'luce', 2026, 2, 69.8) },
    transactions: {
      t1: tx('t1', '2026-02-27', -69.8, 'ADDEBITO SEPA DD PER FATTURA A VOSTRO CARICO Incasso 1 SDD da IT04 Reset S.r.l.'),
      t2: tx('t2', '2026-02-27', -0.5, 'COMMISSIONI - PROVVIGIONI - SPESE Incasso 1 Reset S.r.l.'),
    },
  };
  assert.equal(matchBillPayments(db), 1);
  assert.equal(db.transactions.t1.category, 'bollette');
  assert.equal(db.transactions.t1.matchedDoc, 'Crispiano/2026/Elettricità Reset 2026.02.pdf');
  assert.equal(db.transactions.t2.category, 'altro'); // la commissione è un costo vero
});

test('niente abbinamento se la data è lontana, se la scelta è manuale o se la bolletta è già usata', () => {
  const db = {
    docs: { a: doc('Budrio/2022/Acqua 2022.04.pdf', 'acqua', 2022, 4, 5.19) },
    transactions: {
      far: tx('far', '2023-11-03', -5.19, 'ADDEBITO SEPA DD PER FATTURA PayPal'),
      manual: tx('manual', '2022-05-10', -5.19, 'ADDEBITO SEPA DD PER FATTURA PayPal', { manual: true }),
    },
  };
  assert.equal(matchBillPayments(db), 0);
  db.transactions.ok = tx('ok', '2022-05-12', -5.19, 'ADDEBITO SEPA DD PER FATTURA PayPal');
  db.transactions.dup = tx('dup', '2022-05-13', -5.19, 'ADDEBITO SEPA DD PER FATTURA PayPal');
  assert.equal(matchBillPayments(db), 1); // una bolletta assorbe un solo pagamento
  assert.equal(db.transactions.ok.category, 'bollette');
  assert.equal(db.transactions.dup.category, 'altro');
});
