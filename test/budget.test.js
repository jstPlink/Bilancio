import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetOverview, cleanBudgets, estimateBudget } from '../src/budget.js';

const NOW = new Date(2026, 9, 3); // 3 ottobre 2026: i mesi chiusi sono fino a settembre

// Tre mesi (lug-set): stipendio 2000, affitto 600, e ogni mese spesa 400, svago 100, carburante 100.
function sample() {
  const db = { settings: { rentAmount: 600, rentFrom: '2026-07', budgets: {}, savingsGoal: 0 }, docs: {}, paid: {}, manual: {}, transactions: {} };
  for (const month of [7, 8, 9, 10]) {
    db.docs[`busta-${month}`] = { name: `Busta ${month}`, kind: 'stipendio', year: 2026, month, amount: 2000 };
    const day = `2026-${String(month).padStart(2, '0')}-10`;
    db.transactions[`s${month}`] = { id: `s${month}`, date: day, amount: -400, category: 'spesa', description: 'Supermercato' };
    db.transactions[`v${month}`] = { id: `v${month}`, date: day, amount: -100, category: 'svago', description: 'Cinema' };
    db.transactions[`c${month}`] = { id: `c${month}`, date: day, amount: -100, category: 'carburante', description: 'Benzina' };
  }
  return db;
}

test('cleanBudgets: tiene solo spesa, svago e carburante con un importo maggiore di zero', () => {
  assert.deepEqual(cleanBudgets({ spese: '350', svago: 0, carburante: '', tasse: 99, extra: 1 }), { spese: 350 });
  assert.deepEqual(cleanBudgets({ svago: 80.456, carburante: -5 }), { svago: 80.46 });
  assert.deepEqual(cleanBudgets(undefined), {});
});

test('stima: media dei mesi chiusi, senza contare il mese in corso', () => {
  const e = estimateBudget(sample(), { now: NOW });
  assert.equal(e.months, 3);
  assert.equal(e.from, '2026-07');
  assert.equal(e.to, '2026-09');
  assert.deepEqual(e.average, { spese: 400, svago: 100, carburante: 100 });
  assert.equal(e.income, 2000);
  assert.equal(e.fixed, 600);
  assert.equal(e.savingsNoCuts, 800); // 2000 − 600 − 600
});

test('senza risparmio voluto il consiglio è la media', () => {
  const e = estimateBudget(sample(), { now: NOW });
  assert.deepEqual(e.suggested, { spese: 400, svago: 100, carburante: 100 });
  assert.equal(e.expectedSavings, 800);
  assert.equal(e.reachable, true);
});

test('risparmio che sta già nel margine: nessun taglio', () => {
  const e = estimateBudget(sample(), { now: NOW, savings: 700 });
  assert.deepEqual(e.suggested, { spese: 400, svago: 100, carburante: 100 });
  assert.equal(e.available, 700);
});

test('risparmio più alto: le tre voci si tagliano nella stessa proporzione', () => {
  const e = estimateBudget(sample(), { now: NOW, savings: 1100 });
  assert.equal(e.available, 300);
  assert.deepEqual(e.suggested, { spese: 200, svago: 50, carburante: 50 }); // 300 su 600 abituali: metà
  assert.equal(e.expectedSavings, 1100);
  assert.equal(e.reachable, true);
});

test('risparmio irraggiungibile: budget a zero e reachable falso', () => {
  const e = estimateBudget(sample(), { now: NOW, savings: 1500 });
  assert.equal(e.available, -100);
  assert.deepEqual(e.suggested, { spese: 0, svago: 0, carburante: 0 });
  assert.equal(e.reachable, false);
});

test('senza mesi chiusi con spese non c\'è nessuna stima', () => {
  const db = sample();
  for (const k of Object.keys(db.transactions)) if (!k.endsWith('10')) delete db.transactions[k];
  const e = estimateBudget(db, { now: NOW });
  assert.equal(e.months, 0);
  assert.equal(e.average, null);
  assert.equal(e.suggested, null);
});

test('un tetto ai mesi usati: contano gli ultimi', () => {
  const db = sample();
  const e = estimateBudget(db, { now: NOW, window: 2 });
  assert.equal(e.months, 2);
  assert.equal(e.from, '2026-08');
});

test('correzione a mano del totale del mese: la stima usa quella', () => {
  const db = sample();
  db.manual['spese|2026|9'] = 700;
  const e = estimateBudget(db, { now: NOW });
  assert.equal(e.average.spese, 500); // (400 + 400 + 700) / 3
});

test('budgetOverview: budget salvati e stima col risparmio impostato o provato', () => {
  const db = sample();
  db.settings.budgets = { spese: 380, svago: 0 };
  db.settings.savingsGoal = 1100;
  const o = budgetOverview(db, { now: NOW });
  assert.deepEqual(o.budgets, { spese: 380 });
  assert.equal(o.savingsGoal, 1100);
  assert.equal(o.estimate.savings, 1100);
  assert.equal(budgetOverview(db, { now: NOW, savings: 0 }).estimate.savings, 0);
});

test('entrate medie: solo gli ultimi 3 mesi chiusi con entrate', () => {
  const db = sample();
  db.docs['busta-4'] = { name: 'Busta 4', kind: 'stipendio', year: 2026, month: 4, amount: 1000 };
  db.docs['busta-6'] = { name: 'Busta 6', kind: 'stipendio', year: 2026, month: 6, amount: 1000 };
  const e = estimateBudget(db, { now: NOW });
  assert.equal(e.incomeMonths, 3);
  assert.equal(e.income, 2000); // lug, ago, set: 2000 ciascuno; aprile e giugno restano fuori
  db.docs['busta-9'].amount = 3100;
  assert.equal(estimateBudget(db, { now: NOW }).income, 2366.67); // (2000 + 2000 + 3100) / 3
});
