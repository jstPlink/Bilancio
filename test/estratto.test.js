import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement } from '../scripts/estratto-revolut.mjs';

// Un estratto inventato, con lo stesso formato di quello di Revolut (testo di `pdftotext -raw`).
const TEXT = `
Riepilogo del saldo
Prodotto Saldo iniziale Denaro in uscita Denaro in entrata
Saldo di
chiusura
Conto (conto corrente) 0,00 1.020,50 1.100,00 79,50
Pocket personali e di gruppo 100,00 12,00 20,00 108,00
Deposito 500,00 0,00 0,03 500,03
Totale 600,00 1.032,50 1.120,03
Transazioni del conto dal giorno 1 giugno 2026 al giorno 30 giugno 2026
Data Descrizione Denaro in uscita Denaro in entrata Saldo
2 giu 2026 Pagamento da MARIO ROSSI 1.100,00 1.100,00
ID transazione: aaaa-1
3 giu 2026 To Comune di Bologna 1.020,50 79,50
Riferimento: Verbale nr.123
456/2026
ID transazione: aaaa-2
Estratto conto in EUR
Generato in data 30 set 2026
Pagina di
1 3
Transazioni dei Pocket personali e di gruppo dal giorno 1 giugno 2026 al giorno 30 giugno
2026
Data Descrizione Denaro in uscita Denaro in entrata Saldo
4 giu 2026 Prelievo da Pocket 20,00 120,00
ID transazione: bbbb-1
5 giu 2026 Bar Centrale 12,00 108,00
ID transazione: bbbb-2
A: Bar Centrale, Cervia
Carta: 416598******7753
Transazioni deposito da 1 giugno 2026 a 30 giugno 2026
Data Descrizione Denaro in uscita Denaro in entrata Saldo
1 giu 2026 Interessi netti pagati nel conto "Risparmi" in
data 1 giu 2026
0,03 500,03
ID transazione: cccc-1
`;

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
