import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement, categorize } from '../src/statements.js';
import { buildGrid } from '../src/grid.js';

const revolut = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-03-02 10:00:00,2026-03-03 08:00:00,Esselunga Milano,-54.20,0.00,EUR,COMPLETED,100
CARD_PAYMENT,Current,2026-03-05 10:00:00,2026-03-05 10:00:00,Q8 Via Roma,-60.00,0.00,EUR,COMPLETED,40
CARD_PAYMENT,Current,2026-03-08 10:00:00,2026-03-08 10:00:00,Cinema UCI,-18.50,0.00,EUR,COMPLETED,20
CARD_PAYMENT,Current,2026-03-09 10:00:00,2026-03-09 10:00:00,Ikea,-30.00,0.00,EUR,COMPLETED,0
CARD_PAYMENT,Current,2026-03-09 10:00:00,2026-03-09 10:00:00,Negozio annullato,-99.00,0.00,EUR,REVERTED,0
TOPUP,Current,2026-03-10 10:00:00,2026-03-10 10:00:00,Ricarica,200.00,0.00,EUR,COMPLETED,200
TRANSFER,Current,2026-03-11 10:00:00,2026-03-11 10:00:00,Bonifico a Mario,-50.00,0.00,EUR,COMPLETED,150
`;

test('legge un CSV Revolut: solo uscite completate, con categoria', () => {
  const items = parseStatement(revolut);
  assert.deepEqual(items.map((i) => i.category), ['cibo', 'carburante', 'svago', 'casa']);
  assert.equal(items[0].date, '2026-03-03');
  assert.equal(items[0].amount, -54.2);
});

test('legge un CSV italiano con punto e virgola e date GG/MM/AAAA', () => {
  const items = parseStatement('Data;Descrizione;Importo\n05/04/2026;PAGAMENTO POS CONAD;-1.234,50\n06/04/2026;Stipendio;1500,00\n');
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, -1234.5);
  assert.equal(items[0].date, '2026-04-05');
});

test('le righe identiche non si duplicano reimportando', () => {
  const a = parseStatement(revolut).map((i) => i.id);
  assert.deepEqual(a, parseStatement(revolut).map((i) => i.id));
  assert.equal(new Set(a).size, a.length);
});

test('una regola imparata vince su quelle automatiche', () => {
  assert.equal(categorize('Bar Sport'), 'cibo');
  assert.equal(categorize('Bar Sport', { 'bar sport': 'svago' }), 'svago');
});

test('la griglia somma i movimenti nelle colonne giuste', () => {
  const transactions = Object.fromEntries(parseStatement(revolut).map((t) => [t.id, t]));
  const db = { settings: {}, docs: {}, paid: {}, manual: {}, transactions, rules: {} };
  const { rows } = buildGrid(db, 2026, new Date(2026, 5, 1));
  const mar = rows[2].cells;
  assert.equal(mar.spese.amount, 84.2);
  assert.equal(mar.carburante.amount, 60);
  assert.equal(mar.svago.amount, 18.5);
  assert.equal(rows[2].spent, 162.7);
});
