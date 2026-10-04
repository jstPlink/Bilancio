import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBankAndFiles } from '../src/reconcile.js';

const tx = (id, date, amount, extra = {}) => ({ id, date, amount, description: id, category: 'spesa', ...extra });
const db = (...list) => ({ transactions: Object.fromEntries(list.map((t) => [t.id, t])) });

test('estratto e banca: lo stesso movimento si conta una volta, vince la banca', () => {
  const d = db(tx('csv1', '2026-09-20', -10), tx('csv2', '2026-09-21', -7), tx('bk:a', '2026-09-20', -10), tx('bk:b', '2026-09-22', -7));
  assert.equal(reconcileBankAndFiles(d), 2); // il secondo con un giorno di scarto
  assert.deepEqual(Object.keys(d.transactions).sort(), ['bk:a', 'bk:b']);
  assert.equal(reconcileBankAndFiles(d), 0); // rilanciarlo non cambia nulla
});

test('abbinamento uno a uno: due pagamenti uguali nel file e uno solo in banca ne lasciano due in tutto', () => {
  const d = db(tx('csv1', '2026-09-20', -2.5), tx('csv2', '2026-09-20', -2.5), tx('bk:a', '2026-09-20', -2.5));
  assert.equal(reconcileBankAndFiles(d), 1);
  assert.equal(Object.keys(d.transactions).length, 2);
  // il rimasto non viene mai scambiato per il doppione del movimento della banca, anche rilanciando
  assert.equal(reconcileBankAndFiles(d), 0);
  assert.equal(Object.keys(d.transactions).length, 2);
});

test('estratto riletto: il doppione rimesso si toglie di nuovo', () => {
  const d = db(tx('csv1', '2026-09-20', -10), tx('bk:a', '2026-09-20', -10));
  reconcileBankAndFiles(d);
  d.transactions.csv1 = tx('csv1', '2026-09-20', -10); // l'estratto lo rimette
  assert.equal(reconcileBankAndFiles(d), 1);
  assert.deepEqual(Object.keys(d.transactions), ['bk:a']);
});

test('importi diversi, segni opposti, date lontane e in sospeso non si abbinano; la categoria scelta a mano passa alla banca', () => {
  const d = db(tx('f1', '2026-09-20', -10), tx('f2', '2026-09-20', 10), tx('f3', '2026-09-10', -10), tx('bk:p', '2026-09-20', -10, { pending: true }), tx('bk:a', '2026-09-20', -11));
  assert.equal(reconcileBankAndFiles(d), 0);
  const e = db(tx('f1', '2026-09-20', -10, { category: 'svago', manual: true }), tx('bk:a', '2026-09-20', -10));
  reconcileBankAndFiles(e);
  assert.equal(e.transactions['bk:a'].category, 'svago');
  assert.equal(e.transactions['bk:a'].manual, true);
});
