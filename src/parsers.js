// Estrazione euristica di tipo, periodo e importo dal testo di un PDF.
// Le regole sono volutamente semplici e concentrate qui: quando un fornitore
// usa un layout diverso basta aggiungere un'etichetta alle liste sotto.

export const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const AMOUNT = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/;
const MONTH_RE = MONTHS.join('|');

export function parseAmount(s) {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function monthFromName(name) {
  const n = name.toLowerCase();
  const i = MONTHS.findIndex((m) => m === n || m.slice(0, 3) === n.slice(0, 3));
  return i < 0 ? null : i + 1;
}

// Primo importo che compare entro `span` caratteri dopo una delle etichette.
function amountAfter(text, labels, span = 140) {
  for (const label of labels) {
    const re = new RegExp(label, 'gi');
    let m;
    while ((m = re.exec(text))) {
      const tail = text.slice(m.index + m[0].length, m.index + m[0].length + span);
      const a = AMOUNT.exec(tail);
      if (a) {
        const v = parseAmount(a[1]);
        if (v > 0) return v;
      }
    }
  }
  return null;
}

// `last`: con un intervallo ("Gas 2022.01 - 2022.02") vale l'ultimo mese.
function periodFromFilename(name, { last = false } = {}) {
  const all = [...name.matchAll(/(20\d{2})[-_. ]?(0[1-9]|1[0-2])(?!\d)/g)];
  let m = last ? all.at(-1) : all[0];
  if (m) return { year: +m[1], month: +m[2] };
  m = /(?<!\d)(0[1-9]|1[0-2])[-_. ]?(20\d{2})/.exec(name);
  if (m) return { year: +m[2], month: +m[1] };
  m = new RegExp(`(${MONTH_RE})[-_. ]*(20\\d{2})`, 'i').exec(name);
  if (m) return { year: +m[2], month: monthFromName(m[1]) };
  m = new RegExp(`(20\\d{2})[-_. ]*(${MONTH_RE})`, 'i').exec(name);
  if (m) return { year: +m[1], month: monthFromName(m[2]) };
  return null;
}

// Data (gg/mm/aaaa, gg.mm.aaaa, "gg mese aaaa") che segue una delle etichette.
function dateAfter(text, labels, span = 90) {
  for (const label of labels) {
    const re = new RegExp(label, 'gi');
    let m;
    while ((m = re.exec(text))) {
      const tail = text.slice(m.index + m[0].length, m.index + m[0].length + span);
      const n = /(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})/.exec(tail);
      if (n) return { year: +n[3], month: +n[2] };
      const w = new RegExp(`(\\d{1,2})\\s+(${MONTH_RE})\\s+(20\\d{2})`, 'i').exec(tail);
      if (w) return { year: +w[3], month: monthFromName(w[2]) };
    }
  }
  return null;
}

// ---------------------------------------------------------------- busta paga

const PAYSLIP_HINT = /busta paga|cedolino|libro unico|prospetto paga|retribuzione|netto (?:in busta|del mese|a pagare)/i;
const NET_LABELS = [
  'netto in busta', 'netto del mese', 'netto a pagare', 'netto busta',
  'totale netto', 'netto da corrispondere',
];
// Nei libri unici l'etichetta "NETTO" spesso non è vicina al valore (né sopravvive all'OCR):
// l'importo da accreditare sta accanto a "Denominazione banca".
// Tredicesima e quattordicesima non hanno il mese nel nome del file.
function extraMonthlyPeriod(filename) {
  const kind = /tredic/i.test(filename) ? 12 : /quattordic|quatt\./i.test(filename) ? 6 : null;
  const year = /(20\d{2})/.exec(filename);
  return kind && year ? { year: +year[1], month: kind } : null;
}

// Netto ricostruito dalla riga dei totali che precede "Accredito sul C/C":
//   ... arrotondamento precedente | arrotondamento attuale | ritenute | competenze
// netto = competenze - ritenute - arrotondamento precedente + arrotondamento attuale.
// Funziona anche quando l'OCR perde le etichette, perché conta solo l'ordine dei numeri.
function derivedNet(text) {
  let end = text.search(/accredito sul/i);
  if (end < 0) end = text.toLowerCase().lastIndexOf('competenze');
  if (end < 0) return null;
  const amounts = [...text.slice(Math.max(0, end - 400), end + 60).matchAll(new RegExp(AMOUNT, 'g'))]
    .map((m) => parseAmount(m[1]));
  if (amounts.length < 2) return null;
  const [withheld, earned] = amounts.slice(-2);
  if (!(earned > withheld && withheld > 0)) return null;
  const [before, after] = amounts.slice(-4, -2);
  const rounding = amounts.length >= 4 && before < 1.5 && after < 1.5 ? after - before : 0;
  return Math.round((earned - withheld + rounding) * 100) / 100;
}

// Vale il riquadro "NETTO A PAGARE" (grande e leggibile anche via OCR). Il calcolo dai totali,
// che sta in una tabella piccola e si rovina più facilmente, serve solo quando il riquadro manca.
function payslipNet(text) {
  const candidate = amountAfter(text, NET_LABELS)
    ?? amountAfter(text, ['denominazione banca'], 80)
    ?? amountAfter(text, ['netto']);
  if (candidate != null) return candidate;
  const derived = derivedNet(text);
  return derived != null && derived >= 300 ? derived : null;
}

function payslipPeriod(text, filename) {
  const extra = extraMonthlyPeriod(filename);
  if (extra) return extra;
  const labelled = new RegExp(
    `(?:mese di retribuzione|periodo di paga|periodo di retribuzione|competenza|mensilit[àa])[\\s\\S]{0,80}?(${MONTH_RE})\\s+(20\\d{2})`,
    'i',
  ).exec(text);
  if (labelled) return { year: +labelled[2], month: monthFromName(labelled[1]) };
  const numeric = /(?:mese di retribuzione|periodo di paga|competenza)[\s\S]{0,60}?(0?[1-9]|1[0-2])[/.\-](20\d{2})/i.exec(text);
  if (numeric) return { year: +numeric[2], month: +numeric[1] };
  const fromName = periodFromFilename(filename);
  if (fromName) return fromName;
  const any = new RegExp(`(${MONTH_RE})\\s+(20\\d{2})`, 'i').exec(text);
  if (any) return { year: +any[2], month: monthFromName(any[1]) };
  return null;
}

export function parsePayslip(text, filename) {
  const period = payslipPeriod(text, filename);
  const amount = payslipNet(text);
  return { kind: 'stipendio', ...(period ?? {}), amount };
}

// -------------------------------------------------------------------- bollette

export const BILL_KINDS = {
  acqua: /servizio idrico|acquedotto|\bacqua\b|\bmc\b|hera|acea|smat|acquedotto pugliese/gi,
  luce: /energia elettrica|fornitura (?:di )?luce|\bkwh\b|\bpod\b|potenza impegnata|enel energia|servizio elettrico/gi,
  gas: /gas naturale|fornitura (?:di )?gas|\bsmc\b|\bpdr\b|metano/gi,
  wifi: /fibra|internet|adsl|ftth|wi-?fi|linea fissa|connessione|fastweb|vodafone|iliad|\btim\b|windtre|tiscali|eolo/gi,
};

const BILL_TOTAL_LABELS = [
  'totale da pagare', 'importo da pagare', 'totale bolletta', 'totale fattura',
  'totale documento', 'importo totale', 'totale importo', 'totale complessivo',
  'da pagare', 'importo fattura', 'totale',
];
const BILL_DATE_LABELS = [
  'data emissione', 'data di emissione', 'emessa il', 'emissione', 'data fattura',
  'data documento', 'fattura del', 'bolletta del',
];

export function detectBillKind(text, filename) {
  const hay = `${filename}\n${text}`;
  const fromName = /acqua|idric/i.test(filename) ? 'acqua'
    : /luce|elettric|energia/i.test(filename) ? 'luce'
    : /\bgas\b/i.test(filename) ? 'gas'
    : /wifi|wi-fi|internet|fibra|telefon/i.test(filename) ? 'wifi'
    : null;
  if (fromName) return fromName;
  let best = null;
  let bestScore = 0;
  for (const [kind, re] of Object.entries(BILL_KINDS)) {
    const score = (hay.match(re) ?? []).length;
    if (score > bestScore) { best = kind; bestScore = score; }
  }
  return best;
}

export function parseBill(text, filename, fallbackDate) {
  const kind = detectBillKind(text, filename);
  // Il mese nel nome del file è quello scelto da chi archivia: ha la precedenza sulla data di emissione.
  const named = periodFromFilename(filename, { last: true });
  const period = named
    ?? dateAfter(text, BILL_DATE_LABELS)
    ?? (fallbackDate ? { year: fallbackDate.getFullYear(), month: fallbackDate.getMonth() + 1 } : null);
  const amount = amountAfter(text, BILL_TOTAL_LABELS);
  return { kind, ...(period ?? {}), amount, named: Boolean(named) };
}

// Punto d'ingresso: `hint` è 'busta' o 'bolletta' in base alla sorgente configurata.
export function parseDocument({ text, filename, hint, modified }) {
  const clean = text.replace(/ /g, ' ').replace(/(\d),\s(\d{2})(?!\d)/g, '$1,$2');
  const wantsPayslip = hint === 'busta' || (hint !== 'bolletta' && PAYSLIP_HINT.test(clean));
  const parsed = wantsPayslip
    ? parsePayslip(clean, filename)
    : parseBill(clean, filename, modified);
  const missing = [];
  if (!parsed.kind) missing.push('tipo');
  if (!parsed.year || !parsed.month) missing.push('periodo');
  if (parsed.amount == null) missing.push('importo');
  return { ...parsed, status: missing.length ? 'incompleto' : 'ok', missing };
}
