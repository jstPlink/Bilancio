// Legge l'estratto conto mensile di Revolut (PDF) e ne ricava i movimenti, pronti da importare nell'app (scheda Documenti → Importa).
//
//   node scripts/estratto-revolut.mjs "Estratto conto 2026.06.pdf" [file-di-uscita.json]
//
// Serve `pdftotext` (poppler) nel PATH. L'estratto ha tre sezioni (conto, pocket, deposito); ogni riga ha importo e saldo e il segno si ricava
// dalla variazione del saldo. Il risultato si controlla con il riepilogo del PDF: saldo iniziale, entrate, uscite e saldo finale di ogni sezione
// devono coincidere, altrimenti lo script si ferma. Il PDF non dice da quale pocket parte una spesa: i movimenti dei pocket stanno tutti in
// un unico «conto» dei pocket (il tag si sceglierà a mano).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MONTHS = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
const SECTIONS = [
  { key: 'conto', heading: /^Transazioni del conto\b/, summary: /^Conto \(conto corrente\)/, label: 'Conto (estratto)' },
  { key: 'pocket', heading: /^Transazioni dei Pocket\b/, summary: /^Pocket personali e di gruppo/, label: 'Pocket (estratto)' },
  { key: 'deposito', heading: /^Transazioni deposito\b/, summary: /^Deposito\b/, label: 'Deposito (estratto)' },
];
const NUM = '-?\\d{1,3}(?:\\.\\d{3})*,\\d{2}|-?\\d+,\\d{2}';
const ROW = new RegExp(`^(\\d{1,2}) (${Object.keys(MONTHS).join('|')}) (\\d{4}) (.*?)((?:\\s+(?:${NUM})){1,2})$`);
const ROW_NO_AMOUNT = new RegExp(`^(\\d{1,2}) (${Object.keys(MONTHS).join('|')}) (\\d{4}) `);
const num = (s) => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
const cents = (n) => n / 100;

/** Dal testo `pdftotext -raw` dell'estratto ai movimenti. Lancia un errore se i conti non tornano con il riepilogo. */
export function parseStatement(text, { bank = 'revolut' } = {}) {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  // riepilogo: saldo iniziale, uscite, entrate, saldo finale di ogni sezione
  const summary = {};
  for (const l of lines) {
    for (const s of SECTIONS) {
      if (summary[s.key] || !s.summary.test(l)) continue;
      const nums = l.match(new RegExp(NUM, 'g'));
      if (nums?.length === 4) summary[s.key] = nums.map(num);
    }
  }
  const rows = [];
  let section = null, current = null, inRef = false;
  const counters = {};
  for (const l of lines) {
    const head = SECTIONS.find((s) => s.heading.test(l));
    if (head) { section = head; current = null; inRef = false; continue; }
    if (!section) continue;
    const m = ROW.exec(l);
    if (m) {
      const [, d, mon, y, desc, amounts] = m;
      const nums = amounts.trim().split(/\s+/).map(num);
      counters[section.key] = (counters[section.key] ?? 0) + 1;
      current = {
        section, n: counters[section.key], date: `${y}-${String(MONTHS[mon]).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        description: desc.trim(), printed: nums[0], saldo: nums.length === 2 ? nums[1] : null, extra: {},
      };
      rows.push(current);
      inRef = false;
      continue;
    }
    const start = ROW_NO_AMOUNT.exec(l);
    if (start) { // descrizione su più righe: gli importi arrivano in una riga successiva
      const [, d, mon, y] = start;
      counters[section.key] = (counters[section.key] ?? 0) + 1;
      current = { section, n: counters[section.key], date: `${y}-${String(MONTHS[mon]).padStart(2, '0')}-${String(d).padStart(2, '0')}`, description: l.slice(start[0].length).trim(), printed: null, saldo: null, extra: {}, waiting: true };
      rows.push(current);
      inRef = false;
      continue;
    }
    if (current?.waiting) {
      const tail = new RegExp(`^(.*?)((?:\\s*(?:${NUM})){1,2})$`).exec(l);
      if (tail && /^(?:\d|-)/.test(tail[2].trim())) {
        const nums = tail[2].trim().split(/\s+/).map(num);
        if (tail[1].trim()) current.description += ` ${tail[1].trim()}`;
        current.printed = nums[0];
        current.saldo = nums.length === 2 ? nums[1] : null;
        current.waiting = false;
      } else current.description += ` ${l}`;
      continue;
    }
    if (!current) continue;
    if (/^Estratto conto in EUR|^Segnala carta|^Data Descrizione|^Pagina di\b|^Saldo di$/.test(l)) { inRef = false; continue; }
    let k;
    if ((k = /^ID transazione:\s*(.+)$/.exec(l))) { current.extra.id = k[1].trim(); inRef = false; }
    else if ((k = /^A:\s*(.+)$/.exec(l))) { current.extra.to = k[1].trim(); inRef = false; }
    else if ((k = /^Da:\s*(.+)$/.exec(l))) { current.extra.from = k[1].trim(); inRef = false; }
    else if ((k = /^Carta:\s*(.+)$/.exec(l))) { current.extra.card = k[1].trim(); inRef = false; }
    else if ((k = /^Riferimento:\s*(.+)$/.exec(l))) { current.extra.ref = k[1].trim(); inRef = true; }
    else if (inRef && !/^\d+\s+\d+$/.test(l) && (current.extra.ref ?? '').length < 300 && !/^(Numero di conto|IBAN|BIC)\b/.test(l)) current.extra.ref += ` ${l}`;
  }

  // il segno di ogni riga dalla variazione del saldo, partendo dal saldo iniziale della sezione
  const out = [];
  const totals = {};
  const warnings = [];
  for (const s of SECTIONS) {
    const list = rows.filter((r) => r.section === s);
    if (!list.length) continue;
    if (!summary[s.key]) throw new Error(`Manca il riepilogo della sezione «${s.label}».`);
    let saldo = summary[s.key][0];
    let spent = 0, earned = 0;
    for (const r of list) {
      let signed;
      if (r.saldo != null) {
        signed = r.saldo - saldo;
        if (Math.abs(signed) !== r.printed) throw new Error(`${s.label}, riga ${r.n} (${r.date} ${r.description}): il saldo non torna (${cents(saldo)} → ${cents(r.saldo)}, importo ${cents(r.printed)}).`);
        saldo = r.saldo;
      } else {
        throw new Error(`${s.label}, riga ${r.n} (${r.date} ${r.description}): manca il saldo, non so se è un'entrata o un'uscita.`);
      }
      if (signed < 0) spent -= signed; else earned += signed;
      if (signed !== 0) out.push({ r, signed }); // gli interessi arrotondati a zero non sono movimenti
    }
    totals[s.key] = [summary[s.key][0], spent, earned, saldo];
    const want = summary[s.key];
    // il saldo finale deve coincidere sempre; uscite ed entrate possono differire dal riepilogo solo di una stessa cifra (importi che si compensano)
    if (saldo !== want[3] || spent - want[1] !== earned - want[2]) {
      throw new Error(`${s.label}: i totali non coincidono con il riepilogo (uscite ${cents(spent)} su ${cents(want[1])}, entrate ${cents(earned)} su ${cents(want[2])}, saldo finale ${cents(saldo)} su ${cents(want[3])}).`);
    }
    if (spent !== want[1]) warnings.push(`${s.label}: uscite ed entrate differiscono dal riepilogo di ${cents(spent - want[1])} (si compensano, il saldo torna)`);
  }

  const transactions = out.map(({ r, signed }) => {
    const x = r.extra;
    const credit = signed > 0;
    const party = (credit ? x.from : x.to) ?? (/^(?:To|From|Pagamento da)\s+(.+)$/i.exec(r.description)?.[1]) ?? '';
    const t = {
      bank, account: `estratto:${bank}:${r.section.key}`, accountLabel: r.section.label, key: `${r.section.key}|${r.n}|${x.id ?? ''}`,
      date: r.date, amount: cents(signed), description: r.description.replace(/^(?:To|From)\s+/i, '') || 'Movimento bancario',
    };
    const who = String(party).split(',')[0].trim();
    if (who && who !== t.description) t.party = who;
    if (x.ref) t.remittance = x.ref.replace(/\s+/g, ' ').slice(0, 300);
    return t;
  });
  return { warnings, transactions, totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v.map(cents)])) };
}

// ------------------------------------------------------------------ riga di comando

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [pdf, outFile] = process.argv.slice(2);
  if (!pdf) { console.error('Uso: node scripts/estratto-revolut.mjs "Estratto conto 2026.06.pdf" [uscita.json]'); process.exit(1); }
  const text = execFileSync('pdftotext', ['-raw', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const { transactions, totals, warnings } = parseStatement(text);
  const target = outFile ?? pdf.replace(/\.pdf$/i, '.json');
  fs.writeFileSync(target, JSON.stringify({ transactions }, null, 1));
  console.log(`${transactions.length} movimenti → ${target}`);
  for (const w of warnings) console.log(`  attenzione: ${w}`);
  for (const [k, v] of Object.entries(totals)) console.log(`  ${k}: saldo iniziale ${v[0]} · uscite ${v[1]} · entrate ${v[2]} · saldo finale ${v[3]}  (saldo finale = riepilogo)`);
}
