import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRun, localParts } from '../src/schedule.js';

const n = (iso) => nextRun(new Date(iso), [5, 11, 14, 19], 'Europe/Rome').toISOString();

test('aggiornamenti automatici: 5, 11, 14 e 19, ora italiana (estate, UTC+2)', () => {
  assert.equal(n('2026-10-04T01:00:00Z'), '2026-10-04T03:00:00.000Z'); // le 3: prossimo alle 5
  assert.equal(n('2026-10-04T03:00:00Z'), '2026-10-04T09:00:00.000Z'); // dopo le 5: alle 11
  assert.equal(n('2026-10-04T09:00:00Z'), '2026-10-04T12:00:00.000Z'); // dopo le 11: alle 14
  assert.equal(n('2026-10-04T12:00:00Z'), '2026-10-04T17:00:00.000Z'); // dopo le 14: alle 19
  assert.equal(n('2026-10-04T17:00:00Z'), '2026-10-05T03:00:00.000Z'); // dopo le 19: domani alle 5
});

test('aggiornamenti automatici: attraversano il cambio dell\'ora legale', () => {
  // il 25 ottobre 2026 alle 3:00 l'ora torna indietro: le 5:00 di quel giorno sono in ora solare (04:00 UTC)
  assert.equal(n('2026-10-24T20:00:00Z'), '2026-10-25T04:00:00.000Z');
  // il 29 marzo 2026 alle 2:00 l'ora va avanti: le 5:00 di quel giorno sono in ora legale (03:00 UTC)
  assert.equal(n('2026-03-28T20:00:00Z'), '2026-03-29T03:00:00.000Z');
});

test('data italiana: a mezzanotte e mezza italiane è già il giorno dopo', () => {
  const p = localParts(new Date('2026-10-31T22:30:00Z'), 'Europe/Rome'); // 23:30 italiane (CET dal 25 ottobre)
  assert.equal(p.iso, '2026-10-31');
  const q = localParts(new Date('2026-10-31T23:30:00Z'), 'Europe/Rome'); // 00:30 del 1 novembre
  assert.equal(q.iso, '2026-11-01');
  assert.equal(q.daysInMonth, 30);
});
