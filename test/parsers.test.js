import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument, parseAmount } from '../src/parsers.js';
import { buildGrid } from '../src/grid.js';

const doc = (text, filename, hint) => parseDocument({ text, filename, hint, modified: new Date(2026, 8, 3) });

test('parseAmount legge il formato italiano', () => {
  assert.equal(parseAmount('2.577,00'), 2577);
  assert.equal(parseAmount('57,57'), 57.57);
});

test('busta paga: netto e mese di retribuzione', () => {
  const r = doc('Libro Unico\nMESE DI RETRIBUZIONE Giugno 2026\nTotale competenze 3.200,00\nNETTO IN BUSTA 2.577,00', 'x.pdf', 'busta');
  assert.deepEqual([r.kind, r.year, r.month, r.amount, r.status], ['stipendio', 2026, 6, 2577, 'ok']);
});

test('busta paga: periodo dal nome file se manca nel testo', () => {
  const r = doc('NETTO A PAGARE EUR 1.418,00', '2026-05 busta.pdf', 'busta');
  assert.deepEqual([r.year, r.month, r.amount], [2026, 5, 1418]);
});

test('bolletta luce: tipo, data emissione e totale', () => {
  const r = doc('Fattura energia elettrica\nData emissione 12/07/2026\nConsumo 180 kWh\nTotale da pagare 57,57 euro', 'f.pdf', 'bolletta');
  assert.deepEqual([r.kind, r.year, r.month, r.amount], ['luce', 2026, 7, 57.57]);
});

test('bolletta: tipo dal nome file ha la precedenza', () => {
  const r = doc('Totale da pagare 10,00', 'bolletta gas 2026-03.pdf', 'bolletta');
  assert.deepEqual([r.kind, r.year, r.month], ['gas', 2026, 3]);
});

test('bolletta senza dati utili: incompleta, con i campi mancanti', () => {
  const r = doc('Documento generico', 'x.pdf', 'bolletta');
  assert.equal(r.status, 'incompleto');
  assert.deepEqual(r.missing, ['tipo', 'importo']);
});

test('griglia: da pagare, medie; solo le spese si inseriscono a mano', () => {
  const db = {
    settings: { rentAmount: 500, rentFrom: '2026-01', billShare: 100 },
    docs: {
      a: { name: 'a', kind: 'luce', year: 2026, month: 1, amount: 40, status: 'ok' },
      b: { name: 'b', kind: 'luce', year: 2026, month: 2, amount: 60, status: 'ok' },
      c: { name: 'c', kind: 'stipendio', year: 2026, month: 1, amount: 1500, status: 'ok' },
      d: { name: 'd', kind: null, year: 2026, month: 1, amount: null, status: 'incompleto', override: { kind: 'gas', amount: 20 } },
    },
    paid: { 'luce|2026|1': true },
    manual: { 'luce|2026|2': 70, 'spese|2026|1': 30 },
  };
  const g = buildGrid(db, 2026, new Date(2026, 1, 15));
  assert.equal(g.summary.toPay['luce:budrio'], 60);        // gennaio pagato; febbraio 60: l'importo manuale sulla luce è ignorato
  assert.equal(g.summary.toPay['gas:budrio'], 20);         // documento corretto a mano
  assert.equal(g.summary.toPay.affitto, 1000);   // gen + feb, mesi futuri esclusi
  assert.equal(g.summary.average['luce:budrio'], 50);
  assert.equal(g.rows[0].cells.spese.amount, 30);  // spese manuali: contano nel totale ma non sono da pagare
  assert.equal(g.summary.toPay.spese, null);
  assert.equal(g.summary.avgIncome, 1500);
  assert.equal(g.rows.find((r) => r.month === 3).cells.affitto.amount, null);
});
