import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDailyRun, nextRun } from '../src/schedule.js';

const at = (iso) => nextDailyRun(new Date(iso), 5, 'Europe/Rome').toISOString();

test('aggiornamento delle 5: ora italiana, d\'estate (UTC+2) e d\'inverno (UTC+1)', () => {
  assert.equal(at('2026-10-03T10:00:00Z'), '2026-10-04T03:00:00.000Z'); // 5:00 CEST = 03:00 UTC, il giorno dopo
  assert.equal(at('2026-10-04T01:00:00Z'), '2026-10-04T03:00:00.000Z'); // sono le 3 in Italia: oggi alle 5
  assert.equal(at('2026-10-04T03:00:00Z'), '2026-10-05T03:00:00.000Z'); // alle 5 in punto: il prossimo è domani
  assert.equal(at('2026-12-10T12:00:00Z'), '2026-12-11T04:00:00.000Z'); // 5:00 CET = 04:00 UTC
});

test('aggiornamento delle 5: attraversa il cambio dell\'ora legale', () => {
  // il 25 ottobre 2026 alle 3:00 l'ora torna indietro: le 5:00 di quel giorno sono in ora solare (04:00 UTC)
  assert.equal(at('2026-10-24T10:00:00Z'), '2026-10-25T04:00:00.000Z');
  // il 29 marzo 2026 alle 2:00 l'ora va avanti: le 5:00 di quel giorno sono in ora legale (03:00 UTC)
  assert.equal(at('2026-03-28T10:00:00Z'), '2026-03-29T03:00:00.000Z');
});

test('aggiornamento automatico: 5, 12 e 17 ogni giorno', () => {
  const n = (iso) => nextRun(new Date(iso), [5, 12, 17], 'Europe/Rome').toISOString();
  assert.equal(n('2026-10-04T01:00:00Z'), '2026-10-04T03:00:00.000Z'); // le 3: prossimo alle 5
  assert.equal(n('2026-10-04T03:00:00Z'), '2026-10-04T10:00:00.000Z'); // dopo le 5: alle 12
  assert.equal(n('2026-10-04T10:00:00Z'), '2026-10-04T15:00:00.000Z'); // dopo le 12: alle 17
  assert.equal(n('2026-10-04T15:00:00Z'), '2026-10-05T03:00:00.000Z'); // dopo le 17: domani alle 5
});
