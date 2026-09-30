import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listSource } from '../src/sources.js';

test('le cartelle chiamate "documenti" si possono escludere, a ogni livello', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bilancino-'));
  try {
    for (const f of ['a.pdf', 'A/Documenti/no1.pdf', 'A/ok1.pdf', 'B/x/ok2.pdf', 'documenti/no2.pdf']) {
      await fs.mkdir(path.dirname(path.join(root, f)), { recursive: true });
      await fs.writeFile(path.join(root, f), 'x');
    }
    const names = (await listSource(root, undefined, /^documenti$/i)).map((f) => f.name.split(path.sep).join('/')).sort();
    assert.deepEqual(names, ['A/ok1.pdf', 'B/x/ok2.pdf', 'a.pdf']);
    assert.equal((await listSource(root)).length, 5);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
