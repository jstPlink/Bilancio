import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid } from '../src/grid.js';
import { cutoffOf, movementsView, pocketCategory } from '../src/movements.js';

const tx = (id, date, amount, extra = {}) => [id, { id, date, description: id, amount, category: 'altro', source: 'banca', ...extra }];
const db = () => ({
  settings: { rentAmount: 500, rentFrom: '2026-01' },
  docs: { a: { kind: 'luce', year: 2026, month: 9, amount: 80, name: 'Luce 2026.09.pdf', named: true } },
  paid: {}, manual: {},
  transactions: Object.fromEntries([
    tx('vecchio', '2026-09-30', -10, { product: '01 Spesa' }),
    tx('csv', '2026-10-02', -10, { product: '01 Spesa', source: undefined }),
    tx('spesa', '2026-10-01', -20, { product: '01 Spesa' }),
    tx('svago', '2026-10-02', -30, { product: 'Svago' }),
    tx('benza', '2026-10-03', -40, { product: 'Carburante' }),
    tx('altro', '2026-10-03', -45, { product: 'Conto principale' }),
    tx('manuale', '2026-10-04', -50, { product: 'Conto principale', manual: true, category: 'svago' }),
    tx('ricarica', '2026-10-05', 100, { product: '01 Spesa' }),
  ]),
});

test('i movimenti partono dal 1 ottobre 2026 e sono solo quelli della banca', () => {
  assert.equal(cutoffOf({}), '2026-10-01');
  const v = movementsView(db());
  assert.deepEqual(Object.keys(v.transactions).sort(), ['altro', 'benza', 'manuale', 'ricarica', 'spesa', 'svago']);
  assert.equal(Object.keys(v.docs).length, 1); // le bollette restano tutte
});

test('il tag lo dà il pocket: 01 Spesa, Svago, Carburante; il resto è altro; la scelta a mano vale', () => {
  const t = movementsView(db()).transactions;
  assert.equal(t.spesa.category, 'spesa');
  assert.equal(t.svago.category, 'svago');
  assert.equal(t.benza.category, 'carburante');
  assert.equal(t.altro.category, 'altro');
  assert.equal(t.manuale.category, 'svago');
  assert.equal(t.ricarica.category, 'altro'); // un'entrata non è una spesa
});

test('i nomi dei pocket si possono cambiare, il numero davanti non conta', () => {
  assert.equal(pocketCategory({ amount: -5, product: 'Cibo' }, { pockets: { spesa: 'Cibo' } }), 'spesa');
  assert.equal(pocketCategory({ amount: -5, product: 'Spesa' }, {}), 'spesa');
  assert.equal(pocketCategory({ amount: -5, product: '' }, {}), 'altro');
});

test('«altro» non conta in Panoramica: solo spesa, svago e carburante', () => {
  const g = buildGrid(movementsView(db()), 2026);
  const oct = g.rows[9].cells;
  assert.equal(oct.spese.amount, 20);
  assert.equal(oct.svago.amount, 80); // 30 + 50 scelto a mano
  assert.equal(oct.carburante.amount, 40);
  assert.equal(g.rows[8].cells.spese.amount, null); // settembre: nessun movimento
});

test('la rata del prestito si legge dagli estratti UniCredit anche prima di ottobre, ma solo nei totali: mai nell elenco', () => {
  const d = db();
  Object.assign(d.transactions, Object.fromEntries([
    tx('rata-set', '2026-09-05', -620, { source: 'estratto', description: 'Finanziaria Spa', detail: 'RATA MUTUO 12' }),
    tx('rata-banca-set', '2026-09-06', -620, { description: 'Finanziaria Spa', detail: 'RATA MUTUO 12' }), // dalla banca ma prima di ottobre: non conta
    tx('rata-ott', '2026-10-05', -620, { description: 'Finanziaria Spa', detail: 'RATA MUTUO 13' }),
    tx('rata-ott-estratto', '2026-10-05', -620, { source: 'estratto', description: 'Finanziaria Spa', detail: 'RATA MUTUO 13' }), // doppione: da ottobre vale la banca
  ]));
  assert.equal(movementsView(d).transactions['rata-set'], undefined); // elenco: niente prima di ottobre
  const h = movementsView(d, { history: true });
  assert.equal(h.transactions['rata-set'].category, 'prestito');
  assert.equal(h.transactions['rata-banca-set'], undefined);
  assert.equal(h.transactions['rata-ott'].category, 'prestito');
  assert.equal(h.transactions['rata-ott-estratto'], undefined);
  const g = buildGrid(h, 2026);
  assert.equal(g.rows[8].cells.prestito.amount, 620);
  assert.equal(g.rows[9].cells.prestito.amount, 620);
});

test('un movimento senza controparte che parte da un pocket ha il tag di quel pocket, anche se finisce in Risparmi', () => {
  const d = db();
  Object.assign(d.transactions, Object.fromEntries([
    tx('p1', '2026-10-06', -50, { product: '01 Spesa', noParty: true, description: 'A EUR Risparmi' }),
    tx('p2', '2026-10-07', -30, { product: 'Svago', noParty: true, description: 'Movimento bancario' }),
  ]));
  const t = movementsView(d).transactions;
  assert.equal(t.p1.category, 'spesa');
  assert.equal(t.p2.category, 'svago');
});
