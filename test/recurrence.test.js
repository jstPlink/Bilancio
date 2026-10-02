import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Il calcolo delle ricorrenze dei promemoria è in Java (app Android): qui si compila la classe pura e si controllano date difficili.
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const javac = (() => { try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

test('ricorrenze dei promemoria (giorni 31, bisestili, cambio d\'anno)', { skip: !javac && 'javac non disponibile' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bilancio-rec-'));
  try {
    execFileSync('javac', ['-encoding', 'UTF-8', '-d', out, path.join(root, 'android/src/app/bilancio/mobile/Recurrence.java'), path.join(root, 'test/java/RecurrenceCheck.java')]);
    const lines = execFileSync('java', ['-cp', out, 'RecurrenceCheck'], { encoding: 'utf8' }).trim().split(/\r?\n/);
    const got = Object.fromEntries(lines.map((l) => l.split(' => ')));
    assert.deepEqual(got, {
      'giornaliero ore 9 (gia passate)': '2026-10-03T09:00',
      'giornaliero ore 11': '2026-10-02T11:00',
      'lunedi ore 9': '2026-10-05T09:00',
      'venerdi ore 9 (oggi e passato)': '2026-10-09T09:00',
      'venerdi ore 11 (oggi)': '2026-10-02T11:00',
      'domenica ore 8': '2026-10-04T08:00',
      'mensile il 5': '2026-10-05T09:00',
      'mensile il 2 ore 9 (passato)': '2026-11-02T09:00',
      'mensile il 31': '2026-10-31T09:00',
      'mensile il 31 da novembre': '2026-11-30T09:00',
      'mensile il 31 da gennaio 31 sera': '2027-02-28T09:00',
      'mensile il 31 da febbraio 2028': '2028-02-29T09:00',
      'annuale 15 marzo': '2027-03-15T09:00',
      'annuale 29 febbraio': '2027-02-28T09:00',
      'annuale 2 ottobre ore 9 (passato)': '2027-10-02T09:00',
      'ricorrenza sconosciuta': '0',
    });
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
