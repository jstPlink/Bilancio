import { openPdf } from './pdf.js';
import { makeTransaction, parseAmount } from './statements.js';

// Estratti conto in PDF. Le colonne hanno posizioni fisse, quindi uscite ed entrate si distinguono dalla
// posizione orizzontale dell'importo. Formati: UniCredit (estratto trimestrale) e Revolut.

const AMOUNT = /^[\d.]+,\d{2}-?€?$/;
const round = (n) => Math.round(n * 100) / 100;

async function pageRows(page) {
  const { items } = await page.getTextContent();
  const rows = [];
  for (const it of items) {
    const str = it.str.trim();
    if (!str) continue;
    const tok = { str, x0: it.transform[4], x1: it.transform[4] + it.width, y: it.transform[5] };
    const row = rows.find((r) => Math.abs(r.y - tok.y) <= 1.5);
    if (row) row.tokens.push(tok); else rows.push({ y: tok.y, tokens: [tok] });
  }
  rows.sort((a, b) => b.y - a.y);
  for (const r of rows) r.tokens.sort((a, b) => a.x0 - b.x0);
  return rows;
}

const text = (tokens) => tokens.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ UniCredit

const UC_DATE = /^\d{2}\.\d{2}\.\d{2}$/;
const ucDate = (s) => { const [d, m, y] = s.split('.'); return `20${y}-${m}-${d}`; };

async function parseUniCredit(pdf) {
  const out = [];
  let stated = null;
  let sumOut = 0;
  let sumIn = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const rows = await pageRows(await pdf.getPage(p));
    // Riepilogo generale: saldo iniziale, uscite, entrate, saldo finale.
    for (const r of rows) {
      const nums = r.tokens.filter((t) => AMOUNT.test(t.str));
      if (!stated && nums.length === 4 && r.tokens.length === 4) stated = { out: parseAmount(nums[1].str), in: parseAmount(nums[2].str) };
    }
    const header = rows.findIndex((r) => r.tokens.some((t) => t.str === 'Uscite') && r.tokens.some((t) => t.str === 'Entrate') && r.tokens.some((t) => t.str === 'Data'));
    if (header < 0) continue;
    const outX = rows[header].tokens.find((t) => t.str === 'Uscite').x1;
    const inX = rows[header].tokens.find((t) => t.str === 'Entrate').x1;

    const body = rows.slice(header + 1).filter((r) => {
      const first = r.tokens[0];
      return (first.x0 < 90 && UC_DATE.test(first.str)) || (first.x0 >= 110 && first.x0 < 150);
    });
    const isDate = (r) => r.tokens[0].x0 < 90 && UC_DATE.test(r.tokens[0].str);

    // Il blocco di ogni movimento è centrato sulla riga con le date: tante righe sopra quante sotto.
    const dateIdx = body.map((r, i) => (isDate(r) ? i : -1)).filter((i) => i >= 0);
    let carry = 0;
    let prev = -1;
    const entries = [];
    dateIdx.forEach((di, n) => {
      const gap = body.slice(prev + 1, di);
      const tailLen = n === 0 ? 0 : Math.min(carry, gap.length);
      if (n > 0) entries[n - 1].tail = gap.slice(0, tailLen);
      const head = gap.slice(tailLen);
      entries.push({ row: body[di], head, tail: [] });
      carry = head.length;
      prev = di;
    });
    if (entries.length) entries.at(-1).tail = body.slice(prev + 1, prev + 1 + carry);

    for (const e of entries) {
      const dates = e.row.tokens.filter((t) => UC_DATE.test(t.str));
      const amountTok = e.row.tokens.find((t) => t.x0 >= 440 && AMOUNT.test(t.str));
      const own = e.row.tokens.filter((t) => t.x0 >= 110 && t.x0 < 440);
      const description = [...e.head.map((r) => text(r.tokens)), text(own), ...e.tail.map((r) => text(r.tokens))].filter(Boolean).join(' ');
      if (!amountTok || !dates.length || /^SALDO (INIZIALE|FINALE)/.test(description)) continue;
      const isOut = Math.abs(amountTok.x1 - outX) < Math.abs(amountTok.x1 - inX);
      const amount = parseAmount(amountTok.str);
      if (isOut) sumOut += amount; else sumIn += amount;
      if (isOut && amount > 0) out.push({ date: ucDate(dates[0].str), amount: -amount, description });
    }
  }

  const items = out.map((t) => {
    const card = /CARTA \*\d+ DI [A-Z]{3} [\d.,]+\s+(.+)$/.exec(t.description);
    const fee = /COMMISSIONI - PROVVIGIONI/.test(t.description);
    const description = card ? `${fee ? 'Commissione cambio · ' : ''}${card[1].replace(/ COMMISSIONE PER OPERAZIONE.*$/, '')}` : t.description.slice(0, 200);
    return { ...t, description, detail: t.description };
  });
  const check = stated ? { statedOut: stated.out, parsedOut: round(sumOut), statedIn: stated.in, parsedIn: round(sumIn) } : null;
  return { bank: 'UniCredit', items, check };
}

// -------------------------------------------------------------------- Revolut

const MONTHS = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
const RV_DATE = /^(\d{1,2}) ([a-z]{3}) (\d{4})$/i;

async function parseRevolut(pdf) {
  const items = [];
  let skipSection = false;
  let current = null;
  const flush = () => {
    if (current?.out && current.card) {
      items.push({
        id: `rv-${current.txId ?? `${current.date}-${current.description}-${current.out}`}`,
        date: current.date, amount: -current.out, description: current.description, detail: current.detail.join(' '),
      });
    }
    current = null;
  };

  for (let p = 1; p <= pdf.numPages; p++) {
    const rows = await pageRows(await pdf.getPage(p));
    const header = rows.find((r) => r.tokens.some((t) => /^Denaro in uscita/.test(t.str)));
    const outX = header?.tokens.find((t) => /^Denaro in uscita/.test(t.str)).x0 ?? 335;
    const inX = header?.tokens.find((t) => /^Denaro in entrata/.test(t.str)).x0 ?? 417;
    for (const r of rows) {
      const first = r.tokens[0];
      const line = text(r.tokens);
      if (/^Transazioni (deposito|del deposito)/i.test(line)) { flush(); skipSection = true; continue; }
      if (/^Transazioni (del conto|dei Pocket)/i.test(line)) { flush(); skipSection = false; continue; }
      if (skipSection) continue;
      const m = first.x0 < 60 ? RV_DATE.exec(first.str) : null;
      if (m && MONTHS[m[2].toLowerCase()]) {
        flush();
        const amountTok = r.tokens.find((t) => t.x0 >= 320 && t.x0 < 490 && AMOUNT.test(t.str));
        const isOut = amountTok && Math.abs(amountTok.x0 - outX) < Math.abs(amountTok.x0 - inX);
        current = {
          date: `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`,
          description: text(r.tokens.filter((t) => t.x0 >= 110 && t.x0 < 330)),
          out: isOut ? parseAmount(amountTok.str.replace('€', '')) : 0,
          card: false, detail: [], txId: null,
        };
      } else if (current && first.x0 >= 110 && first.x0 < 150) {
        if (/^Carta:/.test(line)) current.card = true;
        else if (/^ID transazione:/.test(line)) current.txId = line.replace('ID transazione:', '').trim();
        else if (/^A:/.test(line)) current.detail.push(line);
      }
    }
  }
  flush();
  return { bank: 'Revolut', items, check: null };
}

// ----------------------------------------------------------------------- API

// Riconosce la banca dal contenuto e restituisce i movimenti in uscita, pronti da categorizzare.
export async function parsePdfStatement(buffer, rules = {}) {
  const pdf = await openPdf(buffer);
  const first = (await pageRows(await pdf.getPage(1))).map((r) => text(r.tokens)).join('\n');
  let parsed;
  if (/Revolut/i.test(first)) parsed = await parseRevolut(pdf);
  else if (/ELENCO MOVIMENTI|UniCredit|Estratto conto al/i.test(first)) parsed = await parseUniCredit(pdf);
  else if (/ESTRATTO CONTO SCALARE/i.test(first)) return { bank: 'UniCredit (scalare)', items: [], check: null };
  else throw new Error('Formato di estratto conto non riconosciuto.');
  const seen = new Map();
  const items = parsed.items.map((t) => makeTransaction(t, rules, seen));
  return { bank: parsed.bank, items, check: parsed.check };
}
