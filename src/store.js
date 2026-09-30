import fs from 'node:fs/promises';
import path from 'node:path';

// Persistenza su un unico file JSON (data/db.json), scritto in modo atomico.
// Contiene: impostazioni, documenti letti, spunte "pagato", importi manuali.

const defaults = () => ({
  settings: {
    payslipsSource: '',
    billsSource: '',
    rentAmount: 0,
    rentFrom: '',
    loanAmount: 0,
    loanFrom: '',
  },
  docs: {},
  paid: {},
  manual: {},
  lastRefresh: null,
});

export function createStore(file) {
  let db = null;
  let saving = Promise.resolve();

  async function load() {
    try {
      db = { ...defaults(), ...JSON.parse(await fs.readFile(file, 'utf8')) };
      db.settings = { ...defaults().settings, ...db.settings };
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      db = defaults();
    }
    return db;
  }

  function save() {
    saving = saving.then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, file);
    });
    return saving;
  }

  return { load, save, get data() { return db; } };
}
