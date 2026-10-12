import crypto from 'node:crypto';

// Movimenti della banca: ogni movimento ha un tag (spesa, svago, carburante, prestito oppure altro).
// Un movimento parte da un pocket: anche se finisce in Risparmi o in un altro pocket, il tag è quello del pocket da cui è partito.
// Il tag lo decide il pocket di provenienza (vedi movements.js): 01 Spesa → spesa, Svago → svago, Carburante → carburante, tutto il resto → altro.
// «Altro» non conta in nessuna statistica, media o totale: si smista a mano. Fa eccezione la rata del prestito di UniCredit (tag prestito), che è una spesa fissa.

export const CATEGORIES = ['spesa', 'svago', 'carburante', 'prestito', 'altro'];
export const NOT_COUNTED = new Set(['altro']);
export const CATEGORY_KIND = { spesa: 'spese', svago: 'svago', carburante: 'carburante', prestito: 'prestito' };
export const CATEGORY_LABELS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', prestito: 'Prestito', altro: 'Altro' };
// I movimenti si leggono e si salvano dal 1 ottobre 2026 (i dati prima non fanno parte dell'app).
export const MOVEMENTS_FROM = '2026-10-01';
export const cutoffOf = (settings) => (/^\d{4}-\d{2}-\d{2}$/.test(settings?.cutoff ?? '') ? settings.cutoff : MOVEMENTS_FROM);

// La rata del prestito viene dall'estratto conto UniCredit: è l'unica cosa che si legge dagli estratti (è una spesa fissa). Mai nell'elenco dei movimenti.
export const isLoanRate = (t) => t.amount < 0 && /rata mutuo|pagamento rata|rata num|prestito rata|rata prestito|rata finanziamento/i.test(`${t.description ?? ''} ${t.detail ?? ''}`);

export function parseAmount(text) {
  const t = String(text ?? '').trim().replace(/[€\s]|EUR/gi, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();
// Chiave per raggruppare i movimenti uguali (stessa descrizione, stesso verso).
export const ruleKey = (description, amount) => (amount > 0 ? 'in:' : '') + normalize(description);

// Informazioni che si possono aggiungere a un movimento già salvato (le scelte a mano non si toccano).
export const ENRICH_FIELDS = ['noParty', 'type', 'account', 'product', 'time', 'started', 'fee', 'currency', 'balance', 'detail'];

// Movimento completo. Senza `id` se ne ricava uno stabile da data, descrizione e importo (le righe identiche si distinguono con un contatore).
// Il tag parte da «altro»: quello vero lo dà il pocket, al momento di leggere i dati.
export function makeTransaction({ id, date, description, detail = '', amount, extra = {} }, _rules, seen = new Map()) {
  const rounded = Math.round(amount * 100) / 100;
  if (!id) {
    const base = `${date}|${description}|${rounded}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    id = crypto.createHash('sha1').update(`${base}|${n}`).digest('hex').slice(0, 16);
  }
  const t = { id, date, description, amount: rounded, category: 'altro' };
  if (detail) t.detail = detail.slice(0, 400);
  for (const f of ENRICH_FIELDS) if (f !== 'detail' && extra[f] != null && extra[f] !== '') t[f] = extra[f];
  return t;
}
