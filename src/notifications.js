// Notifiche (promemoria) per il telefono: un testo, un giorno del mese (1-31) e un orario (ora del telefono).
// Nei mesi più corti il giorno 29, 30 o 31 cade nell'ultimo giorno del mese: lo fa l'app Android quando le programma.
import crypto from 'node:crypto';

/** Controlla i dati scritti dall'utente e li porta nella forma salvata; lancia un errore in italiano se non vanno bene. */
export function normalizeNotification(input, id = crypto.randomUUID().slice(0, 12)) {
  const text = String(input?.text ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Scrivi il testo della notifica.');
  if (text.length > 200) throw new Error('Il testo della notifica può avere al massimo 200 caratteri.');
  const day = Number(input?.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Il giorno del mese deve essere tra 1 e 31.');
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(input?.time ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error('Orario non valido (ore:minuti, per esempio 09:30).');
  return { id, text, day, time: `${m[1].padStart(2, '0')}:${m[2]}` };
}
