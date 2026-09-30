import crypto from 'node:crypto';

// Estratti conto in CSV (Revolut o altre banche): ogni uscita diventa un movimento con una categoria.
// Le categorie cibo e casa confluiscono nella colonna "Spese"; svago e carburante hanno la loro colonna.

export const CATEGORIES = ['spesa', 'svago', 'carburante', 'altro'];
export const CATEGORY_KIND = { spesa: 'spese', svago: 'svago', carburante: 'carburante' };
export const CATEGORY_LABELS = { spesa: 'Spesa', svago: 'Svago', carburante: 'Carburante', altro: 'Altro' };
// Nomi usati nelle versioni precedenti.
export const LEGACY_CATEGORY = { cibo: 'spesa', casa: 'spesa' };

// Spesa = cibo, bevande e prodotti per la casa. Svago = abbonamenti TV, Amazon, parchi, televisori, giocattoli.
const RULES = [
  ['carburante', /\b(eni|agip|q8|tamoil|esso|shell|ip|api|repsol|erg|carburant\w*|benzin\w*|diesel|gpl|distributore|fuel|petrol)\b/i],
  ['svago', /autostrad\w*|amazon|amzn|prime video|netflix|spotify|disney|dazn|sky\b|now ?tv|infinity|apple\.com|google play|balocchi|playstation|steam|nintendo|televisor\w*|\btv\b|mediaworld|unieuro|euronics|trony|giocattol\w*|toys|lego|giocheria|cinema|\buci\b|the space|multisala|teatro|museo|parco|park|gardaland|mirabilandia|zoomarine|acquapark|aqua ?park|cinecitt|leolandia|movieland|fiabilandia|adventure|avventura|ticketone|eventbrite|bowling|luna ?park|escape room|concert\w*|discoteca|stadio/i],
  ['spesa', /supermerc\w*|\bcoop\b|conad|esselunga|carrefour|lidl|eurospin|\bmd\b|\bpam\b|despar|aldi|penny|iper\w*|bennet|famila|panificio|macelleria|ortofrutta|alimentar\w*|ristoran\w*|restaurant|\bspar\b|\becu\b|pizzeria|trattoria|osteria|\bbar\b|mcdonald|burger|kebab|glovo|just ?eat|deliveroo|gelateria|pasticceria|sushi|autogrill|naturasi|tigros|birr\w*|vino|enoteca|bevande|ikea|leroy|brico\w*|\bobi\b|tigot|acqua ?e ?sapone|\baction\b|detersiv\w*|casalinghi|farmacia|parafarmacia|\bdm\b|maisons du monde|zara home|flying tiger/i],
];

export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();

export function categorize(description, rules = {}, detail = '') {
  const learned = rules[normalize(description)];
  if (learned) return LEGACY_CATEGORY[learned] ?? learned;
  const text = `${description} ${detail}`;
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

// Restituisce le uscite già categorizzate, oppure lancia un errore leggibile.
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
    if (!date || !description || amount == null || amount >= 0) continue;
    if (iType >= 0 && skipType.test((r[iType] ?? '').trim())) continue;
    if (iState >= 0 && r[iState]?.trim() && !/^(completed|eseguit\w*|completat\w*)$/i.test(r[iState].trim())) continue;
    out.push(makeTransaction({ date, description, amount }, rules, seen));
  }
  return out;
}

// Movimento completo con categoria. Senza `id` se ne ricava uno stabile da data, descrizione e importo
// (le righe identiche nello stesso file si distinguono con un contatore).
export function makeTransaction({ id, date, description, detail = '', amount }, rules, seen) {
  const rounded = Math.round(amount * 100) / 100;
  if (!id) {
    const base = `${date}|${description}|${rounded}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    id = crypto.createHash('sha1').update(`${base}|${n}`).digest('hex').slice(0, 16);
  }
  const t = { id, date, description, amount: rounded, category: categorize(description, rules, detail) };
  if (detail) t.detail = detail.slice(0, 400);
  return t;
}
