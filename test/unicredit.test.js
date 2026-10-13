import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnicreditAccount, parseFlexia, wordsFromBbox } from '../src/unicredit.js';
import { contoWords, cartaWords } from './fixture-unicredit.js';

test('conto UniCredit: uscite ed entrate dalla colonna, titolo e dettagli di ogni movimento, controllo con il riepilogo', () => {
  const r = parseUnicreditAccount(contoWords());
  assert.deepEqual(r.summary, { start: -100, spent: 70, earned: 1500, end: 1330 });
  assert.deepEqual(r.transactions.map((t) => [t.date, t.amount, t.description]), [
    ['2025-01-02', 1500, 'BONIFICO A VOSTRO FAVORE'],
    ['2025-01-06', -50, 'PAGAMENTO PER UTILIZZO CARTE DI CREDITO'],
    ['2025-01-07', -20, 'PAGAMENTO MASTERCARD E-Commerce del 07/01/2025'],
  ]);
  assert.equal(r.transactions[0].party, 'DITTA ESEMPIO SRL'); // chi paga
  assert.match(r.transactions[1].remittance, /ESTRATTO 12\/2024/);
  assert.equal(r.transactions[2].party, 'BAR ROMA');
  assert.ok(r.transactions.every((t) => t.bank === 'unicredit' && t.account === 'estratto:unicredit:conto'));
  assert.equal(new Set(r.transactions.map((t) => t.key)).size, 3);
});

test('conto UniCredit: se i totali non tornano con il riepilogo, si ferma', () => {
  const words = contoWords().map((x) => (x.t === '70,00' ? { ...x, t: '71,00' } : x));
  assert.throws(() => parseUnicreditAccount(words), /totali non coincidono/);
  const noEnd = contoWords().map((x) => (x.t === '1.330,00' ? { ...x, t: '1.331,00' } : x));
  assert.throws(() => parseUnicreditAccount(noEnd), /saldo finale non torna/);
});

test('carta Flexia: acquisti con la descrizione sopra la data e controllo con il totale del mese', () => {
  const r = parseFlexia(cartaWords());
  assert.deepEqual(r.transactions.map((t) => [t.date, t.amount, t.description, t.account]), [['2024-12-05', -20, 'Pagamento E-Commerce BAR ROMA', 'estratto:unicredit:carta']]);
  assert.match(r.transactions[0].remittance, /4029357733 03\.12\.24/);
  assert.throws(() => parseFlexia(cartaWords().map((x) => (x.t === '20,00' && x.y0 > 290 ? { ...x, t: '25,00' } : x))), /non tornano con il totale/);
});

test('pdftotext -bbox: dalle parole in XHTML alle parole con le coordinate', () => {
  const html = `<doc><page width="595" height="841"><word xMin="10.5" yMin="20" xMax="40.25" yMax="30">Rossi&amp;Bianchi</word><word xMin="45" yMin="20" xMax="60" yMax="30">12,00</word></page>
    <page width="595" height="841"><word xMin="1" yMin="2" xMax="3" yMax="4">Pag2</word></page></doc>`;
  assert.deepEqual(wordsFromBbox(html), [
    { p: 0, x0: 10.5, y0: 20, x1: 40.25, y1: 30, t: 'Rossi&Bianchi' },
    { p: 0, x0: 45, y0: 20, x1: 60, y1: 30, t: '12,00' },
    { p: 1, x0: 1, y0: 2, x1: 3, y1: 4, t: 'Pag2' },
  ]);
});
