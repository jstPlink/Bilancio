import { effectiveDoc } from './grid.js';

// Abbina gli addebiti bancari delle utenze (Enel, Edison, Reset… o addebiti SEPA) alle bollette già lette dai
// documenti: stesso importo e data di pagamento vicina al mese della bolletta. Un pagamento abbinato diventa
// "bollette" (già contata nei documenti) e non conta una seconda volta nei dati.
const UTILITIES = /enel|edison|reset\b|acea|hera\b|a2a|iren\b|acquedott\w*|fastweb|\btim\b|vodafone|wind ?tre|iliad|sorgenia|plenitude|engie|illumia|e\.on|addebito sepa dd|domiciliaz\w*/i;
const BILL_KINDS = ['luce', 'gas', 'acqua', 'wifi'];
const monthIndex = (y, m) => y * 12 + m;

// Il pagamento arriva da 1 mese prima a 3 mesi dopo il mese della bolletta.
const EARLY = -1;
const LATE = 3;

export function matchBillPayments(db) {
  const docs = Object.entries(db.docs ?? {})
    .map(([key, raw]) => [key, effectiveDoc(raw)])
    .filter(([, d]) => d.status === 'ok' && BILL_KINDS.includes(d.kind));
  const all = Object.values(db.transactions ?? {});
  const used = new Set(all.map((t) => t.matchedDoc).filter(Boolean));
  const candidates = all
    .filter((t) => t.amount < 0 && (t.category === 'altro' || t.category === 'sospesi') && !t.manual && !t.matchedDoc && UTILITIES.test(`${t.description} ${t.detail ?? ''}`))
    .sort((a, b) => a.date.localeCompare(b.date));
  let matched = 0;
  for (const t of candidates) {
    const pay = monthIndex(Number(t.date.slice(0, 4)), Number(t.date.slice(5, 7)));
    const hits = docs
      .filter(([key, d]) => !used.has(d.name) && Math.abs(d.amount + t.amount) < 0.011)
      .map(([, d]) => ({ d, gap: pay - monthIndex(d.year, d.month) }))
      .filter(({ gap }) => gap >= EARLY && gap <= LATE)
      .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
    if (!hits.length) continue;
    t.category = 'bollette';
    t.matchedDoc = hits[0].d.name;
    used.add(hits[0].d.name);
    matched++;
  }
  return matched;
}
