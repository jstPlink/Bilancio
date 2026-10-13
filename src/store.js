// Archivio dei dati: un solo file JSON (data/mybank.json), scritto in modo atomico. Per un uso personale basta e avanza.
import fs from 'node:fs';
import path from 'node:path';

export function openStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'mybank.json');
  let db = {};
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* primo avvio o file illeggibile: si riparte vuoti */ }
  db.settings ??= {};
  db.settings.budgets ??= { spesa: 0, svago: 0, carburante: 0 };
  db.banking ??= {};
  db.banking.app ??= null;          // { appId, privateKey } di Enable Banking: restano solo sul server
  db.banking.connections ??= [];
  db.banking.pending ??= {};        // collegamenti avviati e non ancora conclusi
  db.banking.names ??= {};          // nomi dati a mano ai conti/pocket (uid → nome)
  db.banking.lastAuto ??= null;     // esito dell'ultimo aggiornamento automatico
  db.transactions ??= {};           // id → movimento
  db.overrides ??= {};              // id → tag scelto a mano
  db.notifications ??= [];          // promemoria per il telefono: { id, text, day (1-31), time ('HH:MM') }

  let chain = Promise.resolve();
  const save = () => {
    chain = chain.then(() => {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, file);
    }).catch((e) => console.error('Salvataggio non riuscito:', e.message));
    return chain;
  };
  return { db, save, dir };
}
