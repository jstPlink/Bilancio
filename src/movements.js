import { buildExplore } from './bankexplorer.js';
import { CATEGORIES, cutoffOf, isLoanRate } from './statements.js';

// I movimenti dell'app sono solo quelli della banca dal 1 ottobre 2026. Il tag lo dà il pocket di provenienza:
// 01 Spesa → spesa, Svago → svago, Carburante → carburante, tutto il resto → altro (non conta, si smista a mano).
// Eccezione: la rata del prestito, che si legge dagli estratti conto UniCredit (prima di ottobre) perché è una spesa fissa
// (serve alla Panoramica, alle Statistiche e alla media delle spese fisse del Budget); nell'elenco dei movimenti non compare mai.

export const DEFAULT_POCKETS = { spesa: '01 Spesa', svago: 'Svago', carburante: 'Carburante' };
export { cutoffOf };
const pocketNames = (settings) => ({ ...DEFAULT_POCKETS, ...Object.fromEntries(Object.entries(settings?.pockets ?? {}).filter(([, v]) => String(v ?? '').trim())) });
// «01 Spesa» e «Spesa» sono lo stesso pocket: maiuscole, spazi e numero iniziale non contano.
const norm = (s) => String(s ?? '').toLowerCase().replace(/^\s*\d+[\s.)-]*/, '').replace(/\s+/g, ' ').trim();

let namesCache = { at: 0, db: null, map: null };
// Nome di ogni conto/pocket come nella scheda Banche (nome dato a mano o letto dai movimenti).
function accountNames(db) {
  const now = Date.now();
  if (namesCache.db === db && now - namesCache.at < 15000) return namesCache.map;
  const map = new Map();
  try {
    for (const c of buildExplore(db).connections) for (const a of c.accounts) map.set(a.uid, a.name);
  } catch { /* senza banche resta il nome scritto nel movimento */ }
  namesCache = { at: now, db, map };
  return map;
}

/** Tag di un movimento: la scelta a mano vince; la rata del prestito è «prestito»; altrimenti solo le uscite dai tre pocket contano, il resto è «altro». */
export function pocketCategory(t, settings, names = new Map()) {
  if (t.manual && CATEGORIES.includes(t.category)) return t.category;
  if (!(t.amount < 0)) return 'altro';
  if (isLoanRate(t)) return 'prestito'; // la rata del prestito, dalla banca, dal 1 ottobre
  const pocket = norm(names.get(t.account) ?? t.product);
  if (!pocket) return 'altro';
  const p = pocketNames(settings);
  return Object.keys(DEFAULT_POCKETS).find((k) => pocket === norm(p[k])) ?? 'altro';
}

/**
 * I dati come li vede l'app: movimenti della banca dalla data di inizio, col tag del pocket. Tutto il resto (documenti, spunte…) resta com'è.
 * Con `history` ci sono anche le rate del prestito degli estratti UniCredit di prima della data (per i totali, mai per gli elenchi).
 */
export function movementsView(db, { history = false } = {}) {
  const cutoff = cutoffOf(db.settings);
  const names = accountNames(db);
  const transactions = {};
  for (const [id, t] of Object.entries(db.transactions ?? {})) {
    if (t.source !== 'banca') {
      // Dagli estratti conto (anche quelli già nei dati) conta solo la rata del prestito, e solo prima della data di inizio:
      // da lì in poi la rata arriva dalla banca. Mai nell'elenco dei movimenti.
      if (history && t.date < cutoff && isLoanRate(t)) transactions[id] = { ...t, category: 'prestito' };
      continue;
    }
    if (t.date < cutoff) continue;
    transactions[id] = { ...t, category: pocketCategory(t, db.settings, names) };
  }
  return { ...db, transactions };
}
