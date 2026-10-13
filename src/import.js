// Importazione di movimenti letti da un estratto conto (PDF) invece che dalla banca: servono per i mesi che la banca non rende più disponibili.
// I movimenti importati restano anche sotto la data di inizio, ma non si importano mai quelli da quella data in poi (li legge la banca: si
// duplicherebbero). Importare due volte lo stesso file non duplica nulla.
import crypto from 'node:crypto';
import { BANKS, cutoffOf } from './banks.js';

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Porta i movimenti nei dati; restituisce { added, updated, skipped }. Lancia un errore in italiano se qualcosa non va. */
export function importTransactions(db, items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Nessun movimento da importare.');
  if (items.length > 5000) throw new Error('Troppi movimenti in un colpo solo (al massimo 5000).');
  const from = cutoffOf(db);
  const result = { added: 0, updated: 0, skipped: 0 };
  const ready = [];
  items.forEach((x, i) => {
    const where = `Movimento ${i + 1}`;
    if (!BANKS[x?.bank]) throw new Error(`${where}: banca non prevista.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date ?? ''))) throw new Error(`${where}: data non valida.`);
    const amount = Math.round(Number(x.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount === 0) throw new Error(`${where}: importo non valido.`);
    const account = text(x.account, 80), key = text(x.key, 200);
    if (!account || !key) throw new Error(`${where}: mancano conto o identificativo.`);
    ready.push({ x, amount, account, key });
  });
  for (const { x, amount, account, key } of ready) {
    if (x.date >= from) { result.skipped++; continue; } // da questa data in poi i movimenti li legge la banca
    const id = crypto.createHash('sha1').update(`import|${x.bank}|${account}|${key}`).digest('hex').slice(0, 24);
    const t = { id, bank: x.bank, account, date: x.date, amount, description: text(x.description, 200) || 'Movimento bancario', currency: 'EUR', imported: true };
    const label = text(x.accountLabel, 60), party = text(x.party, 120), remittance = text(x.remittance, 300);
    if (label) t.accountLabel = label;
    if (party) t.party = party;
    if (remittance) t.remittance = remittance;
    if (db.transactions[id]) result.updated++; else result.added++;
    db.transactions[id] = t;
  }
  return result;
}
