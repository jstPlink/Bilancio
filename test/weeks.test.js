import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// I divisori della barra del mese del widget cadono sulle domeniche: il calcolo è in Java, qui si compila la classe pura e si controllano i casi.
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const javac = (() => { try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

test('barra del mese: i divisori cadono alla fine di ogni domenica, non a fine mese', { skip: !javac && 'javac non disponibile' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bilancio-weeks-'));
  try {
    execFileSync('javac', ['-encoding', 'UTF-8', '-d', out, path.join(root, 'android/src/app/bilancio/mobile/MonthWeeks.java'), path.join(root, 'test/java/WeeksCheck.java')]);
    const lines = execFileSync('java', ['-cp', out, 'app.bilancio.mobile.WeeksCheck'], { encoding: 'utf8' }).trim().split(/\r?\n/);
    const got = Object.fromEntries(lines.map((l) => l.split(' => ')));
    assert.deepEqual(got, {
      // il 1 ottobre 2026 è giovedì: le domeniche sono il 4, 11, 18 e 25 (e il 31 è sabato)
      'ottobre 2026 (31 giorni, il 1 e giovedi)': '[4, 11, 18, 25]',
      // il mese comincia di domenica: la prima domenica è il 1
      'novembre 2026 (30 giorni, il 1 e domenica)': '[1, 8, 15, 22, 29]',
      // finisce di domenica (il 28): niente divisore a fine barra
      'febbraio 2027 (28 giorni, il 1 e lunedi, finisce di domenica)': '[7, 14, 21]',
      'febbraio 2028 (29 giorni, il 1 e martedi)': '[6, 13, 20, 27]',
      // il 31 gennaio 2027 è domenica ed è anche l'ultimo giorno: niente divisore
      'gennaio 2027 (31 giorni, il 1 e venerdi)': '[3, 10, 17, 24]',
      'agosto 2027 (31 giorni, il 1 e domenica)': '[1, 8, 15, 22, 29]',
      'indice lunedi/sabato/domenica': '0 5 6',
    });
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
