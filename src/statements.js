import crypto from 'node:crypto';

// Estratti conto in CSV (Revolut o altre banche): ogni uscita diventa un movimento con una categoria.
// Le categorie cibo e casa confluiscono nella colonna "Spese"; svago e carburante hanno la loro colonna.

export const CATEGORIES = ['spesa', 'svago', 'carburante', 'prestito', 'donazioni', 'tasse', 'entrate', 'bollette', 'giroconti', 'sospesi', 'altro'];
// Categorie che non contano in nessun dato: soldi tra i miei conti, addebiti di bollette già contate nei documenti,
// e gli addebiti "da suddividere" (es. i prelievi PayPal, che coprono acquisti diversi).
export const NOT_COUNTED = new Set(['giroconti', 'bollette', 'sospesi']);
export const CATEGORY_KIND = { spesa: 'spese', svago: 'svago', carburante: 'carburante', prestito: 'prestito', donazioni: 'donazioni', tasse: 'tasse', entrate: 'entrate' };
export const CATEGORY_LABELS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', prestito: 'Prestito', donazioni: 'Donazioni', tasse: 'Tasse', entrate: 'Entrate', bollette: 'Bollette pagate', giroconti: 'Giroconti', sospesi: 'Da suddividere', altro: 'Altro' };
// Nomi usati nelle versioni precedenti.
export const LEGACY_CATEGORY = { cibo: 'spesa', casa: 'spesa' };

// Spesa = cibo, bevande e prodotti per la casa. Svago = abbonamenti TV, Amazon, parchi, televisori, giocattoli.
// Giroconti: soldi spostati tra i miei conti. Non contano in nessun dato, né come entrata né come uscita.
// Per riconoscerli servono il mio nome e chi mi paga lo stipendio: stanno nelle Impostazioni (non nel codice).
let identity = { ownAsBeneficiary: null, internalIn: null };

const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "Mario D'Rossi" → anche "D'Rossi Mario"; l'apostrofo e gli spazi possono mancare.
function nameVariants(entry) {
  const words = entry.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const piece = (ws) => ws.map((w) => w.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(escapeRe).join('.?')).join('\\s+');
  return [piece(words), ...(words.length > 1 ? [piece([...words].reverse())] : [])].map((p) => `\\b${p}\\b`);
}
const list = (text) => String(text ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export function setIdentity({ ownNames = '', incomePayers = '' } = {}) {
  const own = list(ownNames).flatMap(nameVariants);
  const payers = list(incomePayers).flatMap(nameVariants);
  identity = {
    ownAsBeneficiary: own.length ? new RegExp(`\\bA:\\s*(${own.join('|')})`, 'iu') : null,
    internalIn: own.length + payers.length ? new RegExp([...own, ...payers].join('|'), 'iu') : null,
  };
}

const RULES = [
  // La rata del mutuo/prestito addebitata dalla banca alimenta da sola la colonna Prestito.
  ['prestito', /rata mutuo|pagamento rata|rata num|prestito rata/i],
  // Gli addebiti SEPA di PayPal coprono acquisti diversi: finché non sono suddivisi, non si contano.
  ['sospesi', /addebito sepa dd.*paypal|paypal.*addebito sepa dd/i],
  ['donazioni', /donazion\w*|\bonlus\b|telethon|amnesty|green ?peace|save the children|\bwwf\b|unicef|emergency\b|medici senza frontiere|terre des hommes|\bairc\b|actionaid|oxfam|caritas|croce rossa|lega del filo d.oro|fondazione veronesi|\blipu\b|\blav\b|\benpa\b|\bwikimedia|\bavsi\b|intersos|medici con l.africa|cuamm|sos villaggi|\bfai\b fondo ambiente|dynamo camp|banco alimentare|\bemergency ong/i],
  ['tasse', /agenzia (delle )?entrate|riscossione|equitalia|\bf24\b|\bimu\b|\btari\b|\btasi\b|\birpef\b|\binps\b|\binail\b|\bbollo\b|\bimposta\b|\btass[ae]\b|\btribut\w*|canone rai|\brai\b.*canone|pagopa|\baci\b|contravvenzion\w*|\bmult[ae]\b|comune di .*(tari|imu|tributi)/i],
  ['carburante', /\b(eni|agip|q8|tamoil|esso|shell|ip|api|repsol|erg|carburant\w*|benzin\w*|diesel|gpl|distributore|fuel|petrol)\b/i],
  ['svago', /autostrad\w*|amazon|amzn|prime video|netflix|spotify|disney|dazn|sky\b|now ?tv|infinity|apple\.com|google play|balocchi|playstation|steam|nintendo|televisor\w*|\btv\b|mediaworld|unieuro|euronics|trony|giocattol\w*|toys|lego|giocheria|cinema|\buci\b|the space|multisala|teatro|museo|parco|park|gardaland|mirabilandia|zoomarine|acquapark|aqua ?park|cinecitt|leolandia|movieland|fiabilandia|adventure|avventura|ticketone|eventbrite|bowling|luna ?park|escape room|concert\w*|discoteca|stadio/i],
  ['spesa', /supermerc\w*|\bcoop\b|conad|esselunga|carrefour|lidl|eurospin|\bmd\b|\bpam\b|despar|aldi|penny|iper\w*|bennet|famila|panificio|macelleria|ortofrutta|alimentar\w*|ristoran\w*|restaurant|\bspar\b|\becu\b|pizzeria|trattoria|osteria|\bbar\b|mcdonald|burger|kebab|glovo|just ?eat|deliveroo|gelateria|pasticceria|sushi|autogrill|naturasi|tigros|birr\w*|vino|enoteca|bevande|ikea|leroy|brico\w*|\bobi\b|tigot|acqua ?e ?sapone|\baction\b|detersiv\w*|casalinghi|farmacia|parafarmacia|\bdm\b|maisons du monde|zara home|flying tiger/i],
];

// Le entrate hanno regole a parte: "entrate" conta come altro denaro ricevuto, "altro" le esclude.
// Sono escluse in automatico i giri tra conti miei (il mio nome, chi mi paga lo stipendio, PayPal istantaneo…).
const GENERIC_INTERNAL_IN = /instant transfer|da:\s*paypal|prelievo|ricaric\w*/i;

export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();

// Le regole imparate per le entrate hanno il prefisso "in:", così non si confondono con le uscite della stessa descrizione.
export const ruleKey = (description, amount) => (amount > 0 ? 'in:' : '') + normalize(description);

export function categorize(description, rules = {}, detail = '', amount = -1) {
  const learned = rules[ruleKey(description, amount)];
  if (learned) return LEGACY_CATEGORY[learned] ?? learned;
  const text = `${description} ${detail}`;
  if (amount > 0) return GENERIC_INTERNAL_IN.test(text) || identity.internalIn?.test(text) ? 'giroconti' : 'entrate';
  if (identity.ownAsBeneficiary?.test(text)) return 'giroconti';
  for (const [category, re] of RULES) if (re.test(text)) return category;
  return 'altro';
}

// --- CSV ---------------------------------------------------------------------------------

function parseRows(text) {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0];
  const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function parseAmount(text) {
  const t = String(text ?? '').trim().replace(/[€\s]|EUR/gi, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(text) {
  const t = String(text ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const find = (headers, ...patterns) => {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
};

// Restituisce i movimenti (uscite ed entrate) già categorizzati, oppure lancia un errore leggibile.
export function parseStatement(text, rules = {}) {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error('Il file è vuoto o non è un CSV.');
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const iDate = find(headers, /completed date/, /data (contabile|operazione|valuta)/, /^date$/, /^data$/, /started date/, /date/);
  const iDesc = find(headers, /^description$/, /descrizione/, /causale/, /dettagli/, /description/);
  const iAmount = find(headers, /^amount$/, /^importo$/, /importo/);
  const iDebit = find(headers, /addebit/, /uscite/, /debit/);
  const iType = find(headers, /^type$/, /^tipo$/);
  const iState = find(headers, /^state$/, /^stato$/);
  // Dati utili a riconoscere un pagamento: orario di inizio, conto, commissione, valuta e saldo dopo l'operazione.
  const iStarted = find(headers, /started date/);
  const iProduct = find(headers, /^product$/);
  const iFee = find(headers, /^fee$/, /commission/);
  const iCurrency = find(headers, /^currency$/);
  const iBalance = find(headers, /^balance$/);
  if (iDate < 0 || iDesc < 0 || (iAmount < 0 && iDebit < 0)) {
    throw new Error('Colonne non riconosciute: servono data, descrizione e importo.');
  }
  const skipType = /^(transfer|topup|top-up|exchange|card_refund|refund)$/i;
  const seen = new Map();
  const out = [];
  for (const r of rows.slice(1)) {
    const date = parseDate(r[iDate]);
    const description = (r[iDesc] ?? '').trim();
    let amount = iAmount >= 0 ? parseAmount(r[iAmount]) : null;
    if (amount == null && iDebit >= 0) { const d = parseAmount(r[iDebit]); amount = d == null ? null : -Math.abs(d); }
    if (!date || !description || amount == null || amount === 0) continue;
    if (iType >= 0 && skipType.test((r[iType] ?? '').trim())) continue;
    if (iState >= 0 && r[iState]?.trim() && !/^(completed|eseguit\w*|completat\w*)$/i.test(r[iState].trim())) continue;
    const started = iStarted >= 0 ? /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec((r[iStarted] ?? '').trim()) : null;
    const fee = iFee >= 0 ? parseAmount(r[iFee]) : null;
    const currency = iCurrency >= 0 ? (r[iCurrency] ?? '').trim().toUpperCase() : '';
    const extra = {
      type: iType >= 0 ? (r[iType] ?? '').trim().toUpperCase() : '',
      product: iProduct >= 0 ? (r[iProduct] ?? '').trim() : '',
      time: started?.[2] ?? '',
      started: started && started[1] !== date ? started[1] : '',
      fee: fee ? Math.abs(fee) : null,
      currency: currency && currency !== 'EUR' ? currency : '',
      balance: iBalance >= 0 ? parseAmount(r[iBalance]) : null,
    };
    out.push(makeTransaction({ date, description, amount, extra }, rules, seen));
  }
  return out;
}

// Movimento completo con categoria. Senza `id` se ne ricava uno stabile da data, descrizione e importo
// (le righe identiche nello stesso file si distinguono con un contatore).
export function makeTransaction({ id, date, description, detail = '', amount, extra = {} }, rules, seen) {
  const rounded = Math.round(amount * 100) / 100;
  if (!id) {
    const base = `${date}|${description}|${rounded}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    id = crypto.createHash('sha1').update(`${base}|${n}`).digest('hex').slice(0, 16);
  }
  const t = { id, date, description, amount: rounded, category: categorize(description, rules, detail, rounded) };
  if (detail) t.detail = detail.slice(0, 400);
  for (const f of ENRICH_FIELDS) if (f !== 'detail' && extra[f] != null && extra[f] !== '') t[f] = extra[f];
  return t;
}

// Informazioni che si possono aggiungere a un movimento già salvato (categoria e scelte a mano non si toccano).
export const ENRICH_FIELDS = ['type', 'product', 'time', 'started', 'fee', 'currency', 'balance', 'detail'];

// Aggiunge il movimento se è nuovo; se c'è già, completa solo i dati che mancavano.
// Restituisce 'added', 'enriched' oppure 'same'.
export function addOrEnrich(all, t, file) {
  const old = all[t.id];
  if (!old) { all[t.id] = file ? { ...t, file } : t; return 'added'; }
  let changed = false;
  for (const f of ENRICH_FIELDS) if (t[f] != null && t[f] !== '' && old[f] == null) { old[f] = t[f]; changed = true; }
  return changed ? 'enriched' : 'same';
}
