import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUploadRequest, uploadedDocName, isPdf } from '../src/uploads.js';

test('bolletta: servono tipo di utenza e casa valida', () => {
  assert.deepEqual(parseUploadRequest({ type: 'bolletta', name: 'Luce 2026.09', kind: 'luce', place: 'casa2' }), { type: 'bolletta', name: 'Luce 2026.09', kind: 'luce', place: 'casa2' });
  assert.throws(() => parseUploadRequest({ type: 'bolletta', name: 'x', kind: 'affitto' }), /acqua, luce, gas o wifi/);
  assert.throws(() => parseUploadRequest({ type: 'bolletta', name: 'x', kind: 'gas', place: 'roma' }), /Casa non valida/);
});

test('busta paga ed estratto conto: bastano tipo e nome', () => {
  assert.deepEqual(parseUploadRequest({ type: 'busta', name: 'Settembre' }), { type: 'busta', name: 'Settembre' });
  assert.deepEqual(parseUploadRequest({ type: 'estratto', name: 'Revolut' }), { type: 'estratto', name: 'Revolut' });
});

test('tipo o nome mancanti', () => {
  assert.throws(() => parseUploadRequest({ name: 'x' }), /Scegli che tipo/);
  assert.throws(() => parseUploadRequest({ type: 'busta', name: '  ' }), /nome/);
});

test('il nome è ripulito dai caratteri vietati', () => {
  assert.equal(parseUploadRequest({ type: 'busta', name: 'a/b\\c:d' }).name, 'a b c d');
});

test('nome mostrato: casa come cartella solo per le bollette, estensione aggiunta', () => {
  assert.equal(uploadedDocName({ type: 'bolletta', name: 'Luce 2026.09', place: 'casa2' }), 'Casa 2/Luce 2026.09.pdf');
  assert.equal(uploadedDocName({ type: 'busta', name: 'Settembre.pdf' }), 'Settembre.pdf');
  assert.equal(uploadedDocName({ type: 'estratto', name: 'Revolut' }), 'Revolut.csv');
});

test('riconosce un PDF dai primi byte', () => {
  assert.equal(isPdf(Buffer.from('%PDF-1.7 ...')), true);
  assert.equal(isPdf(Buffer.from('Data,Importo')), false);
});
