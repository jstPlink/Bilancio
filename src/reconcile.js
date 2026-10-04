// Un movimento visto due volte, dalla banca collegata e da un estratto conto (CSV/PDF), si conta una volta sola: vince quello della banca.
// Due movimenti si considerano lo stesso se hanno lo stesso importo e la stessa data (o, se non ce ne sono, date a un giorno di distanza:
// la banca scrive la data di registrazione, l'estratto quella dell'operazione) e si abbinano uno a uno. Quelli in sospeso non si abbinano.
// Il movimento della banca ricorda quale del file ha sostituito (`twinOf`): se l'estratto viene riletto e lo rimette, lo si toglie di nuovo,
// e un altro movimento dello stesso importo non viene mai scambiato per il suo doppione.
const DAY = 86400000;
const day = (d) => Date.parse(`${d}T12:00:00Z`) / DAY;
const cents = (n) => Math.round(Number(n) * 100);

/** Toglie dai movimenti i doppioni dei file che la banca ha già. Restituisce quanti ne ha tolti. */
export function reconcileBankAndFiles(db) {
  const all = db.transactions ?? {};
  const bank = Object.values(all).filter((t) => String(t.id).startsWith('bk:') && !t.pending);
  let removed = 0;
  // doppioni già abbinati e rimessi da una nuova lettura dell'estratto
  for (const b of bank) if (b.twinOf && all[b.twinOf]) { delete all[b.twinOf]; removed++; }
  const open = bank.filter((b) => !b.twinOf);
  const files = Object.values(all).filter((t) => !String(t.id).startsWith('bk:'));
  if (!open.length || !files.length) return removed;
  const byAmount = new Map();
  for (const f of files) {
    const k = cents(f.amount);
    if (!byAmount.has(k)) byAmount.set(k, []);
    byAmount.get(k).push(f);
  }
  const matched = new Set();
  for (const tolerance of [0, 1]) {
    for (const b of open) {
      if (matched.has(b.id)) continue;
      const candidates = byAmount.get(cents(b.amount));
      const i = candidates ? candidates.findIndex((f) => Math.abs(day(f.date) - day(b.date)) <= tolerance) : -1;
      if (i < 0) continue;
      const [f] = candidates.splice(i, 1);
      matched.add(b.id);
      // la categoria scelta a mano sul movimento del file passa a quello della banca
      if (f.manual && !b.manual) { b.category = f.category; b.manual = true; }
      b.twinOf = f.id;
      delete all[f.id];
      removed++;
    }
  }
  return removed;
}
