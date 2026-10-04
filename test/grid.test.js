import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCells, buildGrid } from '../src/grid.js';

const NOW = new Date(2026, 9, 3);
const db = (billShare) => ({
  settings: { rentAmount: 600, rentFrom: '2026-09', ...(billShare === undefined ? {} : { billShare }) },
  docs: {
    luce: { name: 'Luce 2026.09', kind: 'luce', year: 2026, month: 9, amount: 80, named: true },
    acqua: { name: 'Acqua 2026.09', kind: 'acqua', year: 2026, month: 9, amount: 40, named: true },
    wifi: { name: 'Wifi 2026.09', kind: 'wifi', year: 2026, month: 9, amount: 30, named: true },
  },
  paid: {}, manual: {}, transactions: {},
});
const amount = (cells, kind) => cells.get(`${kind}|2026|9`)?.amount;

test('bollette di casa condivisa: acqua, luce, gas e wifi contano per metà (50% di norma), l\'affitto no', () => {
  const cells = buildCells(db(), NOW);
  assert.equal(amount(cells, 'luce'), 40);
  assert.equal(amount(cells, 'acqua'), 20);
  assert.equal(amount(cells, 'wifi'), 15);
  assert.equal(amount(cells, 'affitto'), 600);
});

test('la quota si può cambiare, e al 100% la bolletta conta per intero', () => {
  assert.equal(amount(buildCells(db(100), NOW), 'luce'), 80);
  assert.equal(amount(buildCells(db(25), NOW), 'luce'), 20);
});

test('il «da pagare» delle bollette è la quota dell\'utente', () => {
  const g = buildGrid(db(), 2026, NOW);
  // 40 + 20 + 15 di bollette + 1200 di affitto (settembre e ottobre), tutto da pagare
  assert.equal(g.summary.totalToPay, 1275);
  assert.equal(g.summary.toPayAll.luce, 40);
});
