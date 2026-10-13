// Estratti conto UniCredit in PDF: il conto corrente (trimestrale) e la carta di credito Flexia (mensile). Si leggono dalle COORDINATE delle parole
// (`pdftotext -bbox`): la colonna in cui sta un importo dice se è un'uscita o un'entrata; la data e gli importi stanno sulla stessa riga, la
// descrizione intorno. Si controlla sempre con i totali del PDF: se non tornano si ferma con un errore.
// Una parola è { p: pagina (0…), x0, y0, x1, y1, t: testo }.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Si alza quando il lettore migliora: gli estratti falliti prima vengono ritentati. */
export const UNICREDIT_PARSER = 1;

const MONEY = /^(\d{1,3}(?:\.\d{3})*|\d+),\d{2}-?$/;
const DATE2 = /^\d{2}\.\d{2}\.\d{2}$/;
const cents = (s) => { const neg = s.endsWith('-'); const v = Math.round(Number(s.replace(/-$/, '').replace(/\./g, '').replace(',', '.')) * 100); return neg ? -v : v; };
const iso = (d) => `20${d.slice(6, 8)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

// ------------------------------------------------------------------ parole dal PDF

/** Il testo di `pdftotext -bbox` (XHTML con una riga per parola) → elenco di parole con le coordinate. */
export function wordsFromBbox(html) {
  const words = [];
  let p = -1;
  const re = /<page\b|<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '<page') { p++; continue; }
    words.push({ p, x0: Number(m[1]), y0: Number(m[2]), x1: Number(m[3]), y1: Number(m[4]), t: m[5].replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (e) => entities[e]) });
  }
  return words;
}

/** Le parole di un PDF (`pdftotext -bbox`, del pacchetto poppler: c'è nell'immagine Docker). */
export async function pdfWords(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mybank-words-'));
  try {
    const file = path.join(dir, 'in.pdf');
    fs.writeFileSync(file, buffer);
    const out = await new Promise((resolve, reject) => {
      execFile('pdftotext', ['-bbox', file, '-'], { maxBuffer: 1 << 28 }, (err, stdout) => (
        err ? reject(new Error(err.code === 'ENOENT' ? 'Sul server manca pdftotext (poppler-utils): aggiorna l\'immagine Docker.' : 'Non riesco a leggere il PDF.')) : resolve(stdout)
      ));
    });
    return wordsFromBbox(out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Le righe di una pagina: parole con la stessa y (±2), da sinistra a destra. */
function linesOf(words) {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines = [];
  for (const w of sorted) {
    const l = lines.find((x) => near(x.y, w.y0, 2));
    if (l) l.ws.push(w); else lines.push({ y: w.y0, ws: [w] });
  }
  for (const l of lines) l.ws.sort((a, b) => a.x0 - b.x0);
  return lines.sort((a, b) => a.y - b.y);
}
const text = (ws) => ws.map((w) => w.t).join(' ');

// ------------------------------------------------------------------ conto corrente

/** Il conto corrente UniCredit (estratto trimestrale): movimenti e controllo con il riepilogo (saldo iniziale, uscite, entrate, saldo finale). */
export function parseUnicreditAccount(words, { bank = 'unicredit' } = {}) {
  const pages = [...new Set(words.map((w) => w.p))].sort((a, b) => a - b);
  let summary = null;
  const rows = [];
  for (const p of pages) {
    const ws = words.filter((w) => w.p === p);
    const lines = linesOf(ws);
    // il riepilogo: «Saldo iniziale al … Uscite Entrate Saldo finale al …» e sotto i quattro importi
    if (!summary) {
      const i = lines.findIndex((l) => l.ws.some((w) => w.t === 'iniziale') && l.ws.some((w) => w.t === 'Uscite') && l.ws.some((w) => w.t === 'Entrate'));
      if (i >= 0) {
        const nums = lines.slice(i + 1, i + 3).flatMap((l) => l.ws.filter((w) => MONEY.test(w.t))).sort((a, b) => a.x0 - b.x0).slice(0, 4);
        if (nums.length === 4) summary = nums.map((w) => cents(w.t));
      }
    }
    // la tabella dei movimenti: intestazione «Data Valuta Descrizione Uscite Entrate»
    const h = lines.find((l) => ['Data', 'Valuta', 'Descrizione', 'Uscite', 'Entrate'].every((k) => l.ws.some((w) => w.t === k)));
    if (!h) continue;
    const col = (k) => h.ws.find((w) => w.t === k);
    const dataX = col('Data').x0, descX = col('Descrizione').x0, outCol = col('Uscite'), inCol = col('Entrate');
    // la tabella finisce prima del piè di pagina o, nell'ultima pagina, prima di «GIACENZA MEDIA» e delle avvertenze
    const foot = lines.find((l) => l.y > h.y + 20 && /^(Per il blocco|UniCredit SpA|GIACENZA MEDIA|Anno di riferimento|Per sua tutela|L.importo della giacenza)/.test(text(l.ws)));
    const bottom = foot ? foot.y - 2 : Infinity;
    const body = ws.filter((w) => w.y0 > h.y + 6 && w.y0 < bottom);
    // le righe-data: la data contabile sta sotto «Data»
    const anchors = body.filter((w) => DATE2.test(w.t) && w.x0 >= dataX - 8 && w.x0 <= dataX + 25).sort((a, b) => a.y0 - b.y0);
    const parts = anchors.map((a) => ({ a, amount: null, side: null, lines: [] }));
    for (const w of body) {
      if (!MONEY.test(w.t)) continue;
      const side = near(w.x1, outCol.x1, 9) ? 'out' : near(w.x1, inCol.x1, 9) ? 'in' : null;
      if (!side) continue;
      const part = parts.filter((x) => near(x.a.y0, w.y0, 3.5)).sort((a, b) => Math.abs(a.a.y0 - w.y0) - Math.abs(b.a.y0 - w.y0))[0];
      if (!part) throw new Error(`Importo ${w.t} senza data (pagina ${p + 1}).`);
      if (part.amount != null) throw new Error(`Due importi sulla stessa riga (pagina ${p + 1}, ${part.a.t}).`);
      part.amount = cents(w.t); part.side = side;
    }
    // la descrizione: le parole nella colonna centrale. Le righe di un movimento sono a distanza regolare; tra un movimento e il successivo il
    // salto è più grande. Ogni blocco di righe va alla riga-data che cade al suo interno (titolo sopra la data, dettagli sotto); se non ce n'è
    // una, alla più vicina.
    const desc = body.filter((w) => w.x0 >= descX - 4 && w.x1 <= outCol.x0 - 2 && !(DATE2.test(w.t) && w.x0 < descX));
    const dl = linesOf(desc);
    const gaps = dl.slice(1).map((l, i) => l.y - dl[i].y);
    const normal = gaps.length ? Math.min(...gaps.filter((g) => g > 3)) : 9;
    const blocks = [];
    dl.forEach((l, i) => { if (i === 0 || l.y - dl[i - 1].y > normal + 1.6) blocks.push([]); blocks.at(-1).push(l); });
    for (const blk of blocks) {
      const top = blk[0].y - 1.5, bot = blk.at(-1).y + 3;
      const inside = parts.filter((x) => x.a.y0 >= top && x.a.y0 <= bot);
      const mid = (blk[0].y + blk.at(-1).y) / 2;
      const part = inside.length === 1 ? inside[0] : parts.reduce((best, x) => (!best || Math.abs(x.a.y0 - mid) < Math.abs(best.a.y0 - mid) ? x : best), null);
      if (part) for (const l of blk) part.lines.push(...l.ws);
    }
    for (const part of parts) {
      const lns = linesOf(part.lines).map((l) => text(l.ws));
      rows.push({ date: part.a.t, amount: part.amount, side: part.side, lines: lns, page: p });
    }
  }
  if (!summary) throw new Error('Non trovo il riepilogo dell\'estratto (saldo iniziale, uscite, entrate, saldo finale).');
  const [start, spent, earned, end] = summary;
  const transactions = [];
  let out = 0, inn = 0, startRow = false, n = 0;
  for (const r of rows) {
    const title = (r.lines[0] ?? '').trim();
    if (/^SALDO (INIZIALE|FINALE)/i.test(title) || /SALDO (INIZIALE|FINALE)/i.test(r.lines.join(' '))) { startRow = true; continue; }
    if (r.amount == null || !r.side) throw new Error(`Movimento senza importo (${r.date}, ${title}).`);
    if (r.side === 'out') out += r.amount; else inn += r.amount;
    if (r.amount === 0) continue; // competenze a zero e simili: non sono movimenti
    n++;
    const body = r.lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    const full = r.lines.join(' ').replace(/\s+/g, ' ');
    const t = { bank, account: `estratto:${bank}:conto`, accountLabel: 'Conto UniCredit (estratto)', key: `conto|${iso(r.date)}|${n}|${r.amount}`, date: iso(r.date), amount: (r.side === 'out' ? -r.amount : r.amount) / 100, description: title || 'Movimento bancario' };
    const party = partyOf(full);
    if (party) t.party = party;
    if (body) t.remittance = body.slice(0, 300);
    transactions.push(t);
  }
  // controllo: le uscite e le entrate sommate coincidono con il riepilogo, e il saldo finale torna
  if (out !== spent || inn !== earned) throw new Error(`I totali non coincidono con il riepilogo (uscite ${out / 100} su ${spent / 100}, entrate ${inn / 100} su ${earned / 100}).`);
  if (start - spent + earned !== end) throw new Error(`Il saldo finale non torna (${(start - spent + earned) / 100} su ${end / 100}).`);
  return { transactions, summary: { start: start / 100, spent: spent / 100, earned: earned / 100, end: end / 100 }, startRow };
}

/** Chi paga o chi riceve, dal testo di un movimento («DA: ITALIAN GAMES … PER:», «A: STEFANIA … PER:», «CARTA *1535 DI EUR 5,99 ILIAD ITALIA Roma»). */
function partyOf(s) {
  let m = /\b(?:DA|A):\s*(.+?)\s+(?:PER|COMM|CAUSALE|RIF)\b/.exec(s);
  if (m) return m[1].trim().slice(0, 120);
  m = /CARTA\s+\*?\d+\s+DI\s+[A-Z]{3}\s+[\d.,]+\s+(.+)$/.exec(s);
  if (m) return m[1].replace(/\s+\d{6,}\b.*$/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return '';
}

// ------------------------------------------------------------------ carta di credito Flexia

/** L'estratto mensile della carta Flexia: gli acquisti (uscite) e i rimborsi (entrate) con il totale per controllo. */
export function parseFlexia(words, { bank = 'unicredit' } = {}) {
  const pages = [...new Set(words.map((w) => w.p))].sort((a, b) => a - b);
  const rows = [];
  let total = null;
  for (const p of pages) {
    const ws = words.filter((w) => w.p === p);
    const lines = linesOf(ws);
    const h = lines.find((l) => l.ws.some((w) => w.t === 'Data') && l.ws.some((w) => w.t === 'Riferimento' || w.t === 'Registrazione'));
    const head = lines.find((l) => text(l.ws).startsWith('Data Riferimento') || (l.ws.some((w) => w.t === 'Data') && l.ws.some((w) => w.t === 'Descrizione')));
    if (!head) continue;
    const dataX = head.ws.find((w) => w.t === 'Data').x0;
    const stop = lines.find((l) => l.y > head.y && /^Totale movimenti/i.test(text(l.ws)));
    const body = ws.filter((w) => w.y0 > head.y + 18 && (!stop || w.y0 < stop.y - 1));
    const anchors = body.filter((w) => DATE2.test(w.t) && w.x0 >= dataX - 8 && w.x0 <= dataX + 25).sort((a, b) => a.y0 - b.y0);
    // l'importo in euro: l'ultimo importo a destra (la colonna più a destra)
    const right = Math.max(0, ...body.filter((w) => MONEY.test(w.t)).map((w) => w.x1));
    for (const a of anchors) {
      const line = body.filter((w) => near(w.y0, a.y0, 3));
      const amount = line.filter((w) => MONEY.test(w.t) && near(w.x1, right, 12)).sort((x, y) => y.x1 - x.x1)[0];
      if (!amount) throw new Error(`Movimento carta senza importo (${a.t}).`);
      const refW = line.find((w) => /^[A-Z]\d{4,}$/.test(w.t) && w.x0 > a.x1);
      const ref = refW ? refW.t : '';
      const colX = refW ? refW.x1 : a.x1;
      // la descrizione sta sulla riga sopra (o sulla stessa), il riferimento e la data dell'operazione sulla riga sotto
      const label = linesOf(body.filter((w) => w.y0 >= a.y0 - 9 && w.y0 <= a.y0 + 1.5 && w.x0 > colX && w !== amount && !MONEY.test(w.t) && !(near(w.y0, a.y0, 3) && w.x0 > colX && /^[A-Z]\d{4,}$/.test(w.t))))
        .filter((l) => !anchors.some((x) => near(x.y0, l.y, 3) && l.ws.length === 0)).map((l) => text(l.ws)).join(' ');
      const extra = linesOf(body.filter((w) => w.y0 > a.y0 + 3 && w.y0 < a.y0 + 12 && w.x0 > colX - 5 && !anchors.some((x) => near(x.y0, w.y0, 3)))).map((l) => text(l.ws)).join(' ');
      rows.push({ date: a.t, amount: cents(amount.t), label: label.replace(/\s+/g, ' ').trim(), ref, extra: extra.trim() });
    }
    // «Totale movimenti effettuati nel mese»
    const tot = lines.find((l) => /^Totale movimenti effettuati nel mese/i.test(text(l.ws)));
    if (tot) { const v = tot.ws.filter((w) => MONEY.test(w.t)).sort((a, b) => b.x1 - a.x1)[0]; if (v) total = cents(v.t); }
  }
  if (total == null) throw new Error('Non trovo il totale dei movimenti dell\'estratto della carta.');
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  if (sum !== total) throw new Error(`I movimenti della carta non tornano con il totale (${sum / 100} su ${total / 100}).`);
  const transactions = rows.filter((r) => r.amount !== 0).map((r, i) => {
    const t = { bank, account: `estratto:${bank}:carta`, accountLabel: 'Carta Flexia (estratto)', key: `carta|${iso(r.date)}|${i + 1}|${r.ref}|${r.amount}`, date: iso(r.date), amount: -r.amount / 100, description: r.label || 'Movimento carta' };
    if (r.extra) t.remittance = r.extra.slice(0, 300);
    return t;
  });
  return { transactions, summary: { total: total / 100 } };
}
