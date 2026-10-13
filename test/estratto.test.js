import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement } from '../src/estratto.js';

// Un estratto inventato, con lo stesso formato di quello di Revolut (testo di `pdftotext -raw`).
import { TEXT } from './fixture-estratto.js';

test('estratto conto Revolut: movimenti con il segno dal saldo, descrizioni su più righe e controllo con il riepilogo', () => {
  const { transactions: t, warnings } = parseStatement(TEXT);
  assert.deepEqual(warnings, []);
  assert.equal(t.length, 5);
  const [pay, fine, withdraw, bar, interest] = t;
  assert.deepEqual([pay.date, pay.amount, pay.account, pay.party], ['2026-06-02', 1100, 'estratto:revolut:conto', 'MARIO ROSSI']);
  assert.deepEqual([fine.amount, fine.description, fine.remittance], [-1020.5, 'Comune di Bologna', 'Verbale nr.123 456/2026']);
  assert.deepEqual([withdraw.amount, withdraw.account, withdraw.description], [20, 'estratto:revolut:pocket', 'Prelievo da Pocket']);
  assert.deepEqual([bar.amount, bar.description, bar.party], [-12, 'Bar Centrale', undefined]);
  assert.deepEqual([interest.amount, interest.account], [0.03, 'estratto:revolut:deposito']);
  assert.match(interest.description, /Interessi netti pagati nel conto "Risparmi" in data 1 giu 2026/);
  assert.equal(new Set(t.map((x) => x.key)).size, 5); // identificativi tutti diversi
});

test('estratto conto Revolut: se i conti non tornano con il riepilogo, si ferma', () => {
  assert.throws(() => parseStatement(TEXT.replace('108,00\nID transazione: bbbb-2', '109,00\nID transazione: bbbb-2')), /saldo non torna/);
  assert.throws(() => parseStatement(TEXT.replace('Conto (conto corrente) 0,00 1.020,50 1.100,00 79,50', 'Conto (conto corrente) 0,00 1.020,50 1.100,00 80,50')), /totali non coincidono/);
});
