import { parsePdfStatement } from './pdfstatements.js';
import { isLoanRate } from './statements.js';

// Dagli estratti conto si legge UNA cosa sola: la rata del prestito di UniCredit (spesa fissa). Il resto dell'estratto, e gli estratti delle altre banche, si ignorano.

export async function readLoanRates(buffer) {
  const parsed = await parsePdfStatement(buffer, {});
  if (!/^UniCredit/i.test(parsed.bank ?? '')) return { bank: parsed.bank ?? '', items: [], check: null };
  const items = parsed.items.filter(isLoanRate).map((t) => ({ ...t, category: 'prestito', source: 'estratto' }));
  return { bank: parsed.bank, items, check: null };
}

/** Salva le rate nuove (le già note non si duplicano). Restituisce quante ne ha aggiunte. */
export function saveLoanRates(db, items, file) {
  const all = (db.transactions ??= {});
  let added = 0;
  for (const t of items) {
    if (all[t.id]) continue;
    all[t.id] = { ...t, file };
    added++;
  }
  return added;
}
