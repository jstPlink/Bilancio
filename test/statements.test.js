import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement, categorize, setIdentity } from '../src/statements.js';

setIdentity({ ownNames: "Mario D'Rossi", incomePayers: 'Azienda Esempio' });
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
  assert.deepEqual(items.map((i) => i.category), ['spesa', 'carburante', 'svago', 'spesa']);
  assert.equal(items[0].date, '2026-03-03');
  assert.equal(items[0].amount, -54.2);
});

test('legge un CSV italiano con punto e virgola e date GG/MM/AAAA', () => {
  const items = parseStatement('Data;Descrizione;Importo\n05/04/2026;PAGAMENTO POS CONAD;-1.234,50\n06/04/2026;Stipendio;1500,00\n');
  assert.equal(items.length, 2);
  assert.equal(items[1].category, 'entrate');
  assert.equal(items[0].amount, -1234.5);
  assert.equal(items[0].date, '2026-04-05');
});

test('le righe identiche non si duplicano reimportando', () => {
  const a = parseStatement(revolut).map((i) => i.id);
  assert.deepEqual(a, parseStatement(revolut).map((i) => i.id));
  assert.equal(new Set(a).size, a.length);
});

test('una regola imparata vince su quelle automatiche', () => {
  assert.equal(categorize('Bar Sport'), 'spesa');
  assert.equal(categorize('AMAZON EU SARL'), 'svago');
  assert.equal(categorize('Enoteca Rossi'), 'spesa');
  assert.equal(categorize('Mediaworld Televisori'), 'svago');
  assert.equal(categorize("Autostrade per l'Italia"), 'svago');
  assert.equal(categorize('IP Italiana Petroli'), 'carburante');
  assert.equal(categorize('Bar Sport', { 'bar sport': 'svago' }), 'svago');
  for (const name of ['AGENZIA DELLE ENTRATE F24', 'Pagamento IMU Comune', 'Bollo auto ACI']) assert.equal(categorize(name), 'tasse', name);
  for (const name of ['Telethon', 'AMNESTY ROMA', 'Greenpeace Italia', 'Save the Children', 'ADDEBITO PER DONAZIONE ONLUS Incasso 1 WWF ITALIA']) {
    assert.equal(categorize(name), 'donazioni', name);
  }
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

test('luce e gas hanno una colonna per casa, con la propria spunta', () => {
  const doc = (name, amount) => ({ name, kind: 'luce', year: 2026, month: 2, amount, named: true });
  const db = {
    settings: {}, paid: { 'luce|2026|2': true }, manual: {}, transactions: {}, rules: {},
    docs: { a: doc('Budrio/2026/Luce 2026.02.pdf', 40), b: doc('Crispiano/2026/Luce 2026.02.pdf', 25) },
  };
  const g = buildGrid(db, 2026, new Date(2026, 5, 1));
  const cells = g.rows[1].cells;
  assert.ok(g.columns.some((c) => c.id === 'luce:crispiano'));
  assert.ok(!g.columns.some((c) => c.id === 'luce'));
  assert.equal(cells['luce:budrio'].amount, 40);
  assert.equal(cells['luce:crispiano'].amount, 25);
  assert.equal(cells['luce:budrio'].paid, true);
  assert.equal(cells['luce:crispiano'].paid, false);
  assert.equal(cells['luce:crispiano'].files.length, 1);
  assert.equal(g.rows[1].spent, 65); // il totale comprende entrambe le case
  assert.equal(g.summary.totalToPay, 25);
  assert.equal(g.summary.toPay['luce:crispiano'], 25);
});

test('tasse: nessun falso positivo sui distributori di carburante', () => {
  assert.equal(categorize('Distributore Area Bianca'), 'carburante');
  assert.equal(categorize('Distributore Self IP'), 'carburante');
});

test('giroconti: solo se il beneficiario sono io, non se il mio nome è nella causale', () => {
  assert.equal(categorize("DISPOSIZIONE DI BONIFICO BONIFICO SEPA A: Mario D'Rossi PER: Ricarica"), 'giroconti');
  assert.equal(categorize("BONIFICO SEPA A: Autoscuola Esempio PER: MARIO D'ROSSI: PACCHETTO GUIDE"), 'altro');
  assert.equal(categorize("Pagamento da D'ROSSI MARIO", {}, '', 500), 'giroconti');
  assert.equal(categorize('Bonifico da AZIENDA ESEMPIO SRL', {}, '', 1500), 'giroconti');
  assert.equal(categorize('Pagamento da ANNA VERDI', {}, '', 500), 'entrate');
  setIdentity({});
  assert.equal(categorize("A: Mario D'Rossi PER: Ricarica"), 'altro'); // senza nome impostato, non riconosce nulla
  setIdentity({ ownNames: "Mario D'Rossi", incomePayers: 'Azienda Esempio' });
});

test('la rata del prestito si legge dagli estratti conto e non ha stato "pagato"', () => {
  assert.equal(categorize('PAGAMENTO RATA MUTUO/PRESTITO RATA NUM.: 002 FINANZIAM. NUMERO: 000123'), 'prestito');
  const tx = { id: 'a', date: '2026-02-28', amount: -209.38, description: 'PAGAMENTO RATA MUTUO/PRESTITO RATA NUM.: 002', category: 'prestito' };
  const db = { settings: { loanAmount: 999, loanFrom: '2020-01' }, docs: {}, paid: {}, manual: {}, rules: {}, transactions: { a: tx } };
  const g = buildGrid(db, 2026, new Date(2026, 5, 1));
  assert.equal(g.rows[1].cells.prestito.amount, 209.38);
  assert.equal(g.rows[0].cells.prestito.amount, null); // il vecchio importo manuale nelle impostazioni è ignorato
  assert.equal(g.rows[1].cells.prestito.paid, null);
  assert.equal(g.summary.totalToPay, 0);
});

test('gli addebiti SEPA di PayPal vanno in "da suddividere", non contano', () => {
  assert.equal(categorize('ADDEBITO SEPA DD PER FATTURA A VOSTRO CARICO Incasso 1047821517915 SDD da LU96ZZZ0000000000000000058 PayPal Europe S.a.r.l. et Cie S.C.A mandato nr. 52R22257CJF5L'), 'sospesi');
  assert.equal(categorize('PAYPAL *NINTENDO 4029357733'), 'svago'); // un acquisto PayPal con il suo negozio si categorizza normalmente
  assert.equal(categorize('ADDEBITO SEPA DD PER FATTURA A VOSTRO CARICO Incasso 1 SDD da IT71 ENEL ENERGIA'), 'altro');
});

test('il CSV Revolut conserva orario, tipo, conto, commissione e saldo', async () => {
  const { parseStatement: parse, addOrEnrich } = await import('../src/statements.js');
  const csv = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-03-14 21:40:12,2026-03-15 08:00:00,Maracaibo,-23.50,0.50,USD,COMPLETED,120.30
`;
  const [t] = parse(csv);
  assert.equal(t.description, 'Maracaibo');
  assert.equal(t.type, 'CARD_PAYMENT');
  assert.equal(t.time, '21:40');
  assert.equal(t.started, '2026-03-14'); // iniziato il giorno prima di quello contabilizzato
  assert.equal(t.fee, 0.5);
  assert.equal(t.currency, 'USD');
  assert.equal(t.balance, 120.3);
  assert.equal(t.product, 'Current');

  // Un movimento già salvato senza questi dati viene completato, senza toccare la categoria scelta a mano.
  const old = { id: t.id, date: t.date, description: t.description, amount: t.amount, category: 'svago', manual: true };
  const all = { [t.id]: old };
  assert.equal(addOrEnrich(all, t, 'a.csv'), 'enriched');
  assert.equal(old.time, '21:40');
  assert.equal(old.category, 'svago');
  assert.equal(addOrEnrich(all, t, 'a.csv'), 'same');
  assert.equal(addOrEnrich({}, t, 'a.csv'), 'added');
});

test('senza le colonne extra i movimenti restano com\'erano', () => {
  const [t] = parseStatement('Data;Descrizione;Importo\n05/04/2026;PAGAMENTO POS CONAD;-12,00\n');
  assert.equal(t.time, undefined);
  assert.equal(t.type, undefined);
});
