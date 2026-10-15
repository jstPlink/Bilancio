// Notifiche (promemoria) per il telefono: un testo, un giorno del mese (1-31) e un orario (ora del telefono).
// Nei mesi più corti il giorno 29, 30 o 31 cade nell'ultimo giorno del mese: lo fa l'app Android quando le programma.
import crypto from 'node:crypto';

/** Controlla i dati scritti dall'utente e li porta nella forma salvata; lancia un errore in italiano se non vanno bene. */
export function normalizeNotification(input, id = crypto.randomUUID().slice(0, 12), recurringKey = '') {
  const text = String(input?.text ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Scrivi il testo della notifica.');
  if (text.length > 200) throw new Error('Il testo della notifica può avere al massimo 200 caratteri.');
  const day = Number(input?.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Il giorno del mese deve essere tra 1 e 31.');
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(input?.time ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error('Orario non valido (ore:minuti, per esempio 09:30).');
  // `month` (1-12) è facoltativo: con il mese la notifica suona una volta l'anno (i ricorrenti annuali), senza ogni mese
  const month = input?.month == null || input.month === '' ? 0 : Number(input.month);
  if (!Number.isInteger(month) || month < 0 || month > 12) throw new Error('Il mese deve essere tra 1 e 12.');
  return { id, text, day, ...(month ? { month } : {}), time: `${m[1].padStart(2, '0')}:${m[2]}`, ...(recurringKey ? { recurringKey } : {}) };
}
