// Riconoscimento automatico di «chi sono io» e «chi mi paga lo stipendio», senza che l'utente debba scriverlo.
// Serve a non contare due volte lo stipendio (già nelle buste paga) e i giri di denaro tra i conti dello stesso titolare.
//  - datore di lavoro: il bonifico in entrata con lo stesso importo del netto di una busta paga, in almeno due mesi diversi;
//  - nome del titolare: un'uscita che ricompare identica come entrata su un altro conto (stessi giorni), con lo stesso nome
//    come destinatario e come mittente, in almeno due casi.
import { effectiveDoc } from './grid.js';
import { categorize, setIdentity } from './statements.js';

const DAY = 86400000;
const CENT = 0.011;
const MIN_EVIDENCE = 2;

const words = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
// Chiave del nome senza importare l'ordine: «Mario Rossi» e «ROSSI MARIO» sono la stessa persona.
export const nameKey = (name) => words(name).sort().join(' ');
const title = (s) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// Toglie dalla coda del nome causali, riferimenti, numeri e forma societaria.
function cleanName(raw) {
  let s = String(raw ?? '');
  s = s.split(/\b(?:per|causale|rif|ref|cro|trn|iban|cod|codice|id|bic)\b[:.]?|[0-9]/i)[0];
  s = s.replace(/\b(?:s\s*r\s*l|srl|s\s*p\s*a|spa|s\s*n\s*c|snc|s\s*a\s*s|sas|ltd|gmbh|inc)\b\.?/gi, ' ');
  const w = s.replace(/[^\p{L}' .&-]/gu, ' ').split(/\s+/).filter((x) => x.replace(/[^\p{L}]/gu, '').length > 0);
  if (!w.length || w.join('').replace(/[^\p{L}]/gu, '').length < 4 || w.length > 6) return '';
  return w.join(' ').trim();
}

// «… BONIFICO ISTANTANEO DA AZIENDA ESEMPIO S R L» → «AZIENDA ESEMPIO»; «Pagamento da Mario Rossi» → «Mario Rossi».
export function senderName(description) {
  const m = /\b(?:da|from)\s+(?!.*\b(?:da|from)\b)(.+)$/i.exec(String(description ?? ''));
  return m ? cleanName(m[1]) : '';
}

// «BONIFICO A: ROSSI MARIO PER: …» → «ROSSI MARIO»; «Pagamento a Mario Rossi» → «Mario Rossi».
export function recipientName(description) {
  const text = String(description ?? '');
  const a = /\bA:\s*(.+?)(?:\s+PER:|$)/i.exec(text);
  if (a) return cleanName(a[1]);
  const b = /^(?:pagamento a|trasferimento a|payment to|transfer to|bonifico a)\s+(.+)$/i.exec(text.trim());
  return b ? cleanName(b[1]) : '';
}

const dayNumber = (date) => Date.parse(`${date}T12:00:00Z`) / DAY;

// Datori di lavoro: nomi dei bonifici in entrata che coincidono col netto di almeno due buste paga diverse.
export function inferPayers(db) {
  const found = new Map(); // chiave → { name, docs:Set }
  const slips = Object.entries(db.docs ?? {}).map(([key, raw]) => [key, effectiveDoc(raw)]).filter(([, d]) => d.status === 'ok' && d.kind === 'stipendio' && d.amount > 0);
  for (const t of Object.values(db.transactions ?? {})) {
    if (!(t.amount > 0)) continue;
    const d = dayNumber(t.date);
    // Un bonifico vale per una sola busta paga: la più vicina a fine mese tra quelle con lo stesso netto e lo stipendio atteso entro il 20 del mese dopo.
    const candidates = slips.filter(([, slip]) => Math.abs(t.amount - slip.amount) <= CENT
      && d >= Date.UTC(slip.year, slip.month - 1, 10) / DAY && d <= Date.UTC(slip.year, slip.month, 20) / DAY);
    if (!candidates.length) continue;
    const [key] = candidates.sort((x, y) => Math.abs(d - Date.UTC(x[1].year, x[1].month, 0) / DAY) - Math.abs(d - Date.UTC(y[1].year, y[1].month, 0) / DAY))[0];
    const name = senderName(t.description);
    if (!name) continue;
    const k = nameKey(name);
    if (!found.has(k)) found.set(k, { name, docs: new Set() });
    found.get(k).docs.add(key);
  }
  return [...found.values()].filter((f) => f.docs.size >= MIN_EVIDENCE).map((f) => title(f.name));
}

// Nome del titolare: lo stesso nome come destinatario di un'uscita e come mittente della corrispondente entrata.
export function inferOwnNames(db) {
  const all = Object.values(db.transactions ?? {});
  const incoming = all.filter((t) => t.amount > 0);
  const found = new Map();
  for (const out of all.filter((t) => t.amount < 0)) {
    const recipient = recipientName(`${out.description}`) || recipientName(out.detail);
    if (!recipient) continue;
    const day = dayNumber(out.date);
    const match = incoming.find((i) => Math.abs(i.amount + out.amount) <= CENT && Math.abs(dayNumber(i.date) - day) <= 3 && nameKey(senderName(i.description)) === nameKey(recipient));
    if (!match) continue;
    const k = nameKey(recipient);
    if (!found.has(k)) found.set(k, { name: recipient, n: 0 });
    found.get(k).n++;
  }
  return [...found.values()].filter((f) => f.n >= MIN_EVIDENCE).map((f) => title(f.name));
}

const split = (csv) => String(csv ?? '').split(',').map((x) => x.trim()).filter(Boolean);

// Aggiunge ai nomi già salvati quelli nuovi (senza duplicati, a prescindere dall'ordine delle parole).
export function mergeNames(current, extra) {
  const list = split(current);
  const known = new Set(list.map(nameKey));
  for (const name of extra) if (!known.has(nameKey(name))) { list.push(name); known.add(nameKey(name)); }
  return list.join(', ');
}

// Aggiorna le impostazioni con ciò che si è ricavato e ricategorizza i movimenti che ora risultano giri interni.
// Le scelte fatte a mano e le bollette abbinate non si toccano. Restituisce quanto è cambiato.
export function learnIdentity(db) {
  const s = db.settings;
  const payers = inferPayers(db);
  const own = inferOwnNames(db);
  const nextPayers = mergeNames(s.incomePayers, payers);
  const nextOwn = mergeNames(s.ownNames, own);
  const added = { payers: split(nextPayers).length - split(s.incomePayers).length, own: split(nextOwn).length - split(s.ownNames).length };
  s.incomePayers = nextPayers;
  s.ownNames = nextOwn;
  setIdentity(s);
  let recategorized = 0;
  for (const t of Object.values(db.transactions ?? {})) {
    if (t.manual || t.category === 'giroconti' || t.category === 'bollette') continue;
    if (!['entrate', 'altro'].includes(t.category)) continue;
    if (categorize(t.description, {}, t.detail ?? '', t.amount) === 'giroconti') { t.category = 'giroconti'; recategorized++; }
  }
  return { ...added, recategorized, changed: added.payers > 0 || added.own > 0 || recategorized > 0 };
}
