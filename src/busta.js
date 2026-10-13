// Buste paga: sono scansioni (immagini, senza testo). Il nome del file dice mese e anno; il «netto a pagare» si legge con il riconoscimento dei
// caratteri (tesseract.js, nel server) sul riquadro in basso a destra di ogni pagina: poche cifre stampate, quindi molto affidabile.
// Ogni busta diventa un movimento di entrata (origine «busta»). Le buste nuove di una cartella si leggono da sole (vedi server.js).
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Si alza quando il lettore migliora: le buste che prima non si erano lette vengono ritentate. */
export const PAYSLIP_PARSER = 1;

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

/**
 * Cosa dice il nome di un file di buste paga: { key, date, description } oppure null se non è una busta paga.
 * «Busta Paga IGF 2026.06.pdf» → stipendio di giugno 2026 (data: ultimo giorno del mese);
 * «Quatt.ma IGF 2024.pdf» e «Tredic.ma IGF 2024.pdf» → quattordicesima (30 giugno) e tredicesima (20 dicembre) dell'anno.
 */
export function payslipInfo(name) {
  let m = /^Busta Paga(?: \S+)? (\d{4})\.(\d{2})\.pdf$/i.exec(name);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    return { key: `${y}-${m[2]}`, date: lastDay(y, mo), description: `Stipendio ${MESI[mo - 1]} ${y}` };
  }
  m = /^Quatt\.ma(?: \S+)? (\d{4})\.pdf$/i.exec(name);
  if (m) return { key: `${m[1]}-quattordicesima`, date: `${m[1]}-06-30`, description: `Quattordicesima ${m[1]}` };
  m = /^Tredic\.ma(?: \S+)? (\d{4})\.pdf$/i.exec(name);
  if (m) return { key: `${m[1]}-tredicesima`, date: `${m[1]}-12-20`, description: `Tredicesima ${m[1]}` };
  return null;
}

/** Da un testo letto con l'OCR («1.429,00») all'importo; null se non è un importo credibile. */
export function parseNet(text) {
  const m = /(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})(?!\d)/.exec(String(text ?? '').replace(/\s+/g, ''));
  if (!m) return null;
  const v = Number(`${m[1].replace(/\./g, '')}.${m[2]}`);
  return v >= 50 && v <= 20000 ? v : null;
}

// ------------------------------------------------------------------ immagini e OCR

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

/** Le pagine del PDF come immagini PNG in grigi (`pdftoppm`, del pacchetto poppler: c'è nell'immagine Docker). Al massimo 6 pagine. */
export async function renderPages(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mybank-busta-'));
  try {
    fs.writeFileSync(path.join(dir, 'in.pdf'), buffer);
    await new Promise((resolve, reject) => {
      execFile('pdftoppm', ['-r', '170', '-gray', '-png', '-l', '6', path.join(dir, 'in.pdf'), path.join(dir, 'p')], { maxBuffer: 1 << 26 }, (err) => (
        err ? reject(new Error(err.code === 'ENOENT' ? 'Sul server manca pdftoppm (poppler-utils): aggiorna l\'immagine Docker.' : 'Non riesco a leggere il PDF.')) : resolve()
      ));
    });
    return fs.readdirSync(dir).filter((f) => /^p-\d+\.png$/.test(f)).sort().map((f) => fs.readFileSync(path.join(dir, f)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

let workerPromise = null;
async function worker() {
  workerPromise ??= (async () => {
    const require = createRequire(import.meta.url);
    const { createWorker } = require('tesseract.js');
    const eng = require('@tesseract.js-data/eng'); // i dati della lingua stanno nel pacchetto: niente scaricamenti a runtime
    const w = await createWorker('eng', 1, { langPath: eng.langPath, gzip: eng.gzip, cachePath: path.join(os.tmpdir(), 'mybank-tesseract') });
    await w.setParameters({ tessedit_char_whitelist: '0123456789.,', tessedit_pageseg_mode: '7' }); // una sola riga di cifre
    return w;
  })();
  return workerPromise;
}

/** Ferma il lettore (serve ai test e alla chiusura). */
export async function closeOcr() {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate();
}

// Le scansioni non sono tutte identiche (il riquadro si sposta in verticale da un anno all'altro e di qualche pixel da una busta all'altra): si
// legge una riga di cifre in tante finestre sovrapposte, dall'alto in basso; l'importo giusto esce uguale da più finestre di seguito, quelli
// letti a metà (o le cifre della riga sopra) no. Vale l'importo letto più volte e, a parità, quello più in basso.
const WINDOWS = [];
for (let top = 0.920; top <= 0.9621; top += 0.003) for (const [left, width] of [[0.78, 0.12], [0.76, 0.16]]) WINDOWS.push({ top, left, width, height: 0.020 });

/** L'importo scritto nel riquadro «netto a pagare» di una pagina (PNG), o null. */
export async function netOfPage(png) {
  const { w, h } = pngSize(png);
  const w1 = await worker();
  const votes = new Map();
  for (const r of WINDOWS) {
    const rectangle = { left: Math.round(w * r.left), top: Math.round(h * r.top), width: Math.round(w * r.width), height: Math.round(h * r.height) };
    const { data } = await w1.recognize(png, { rectangle });
    const v = parseNet(data.text);
    if (v == null) continue;
    const e = votes.get(v) ?? { n: 0, top: 0 };
    e.n++; e.top = Math.max(e.top, r.top);
    votes.set(v, e);
  }
  const best = [...votes.entries()].sort((a, b) => b[1].n - a[1].n || b[1].top - a[1].top)[0];
  return best && best[1].n >= 3 ? best[0] : null; // meno di 3 letture uguali non bastano
}

/** Il netto a pagare di una busta paga (PDF). Se la busta continua su più pagine («SEGUE»), vale quello dell'ultima che lo riporta. */
export async function readPayslipNet(buffer, { pages = renderPages, page = netOfPage } = {}) {
  const pngs = await pages(buffer);
  if (!pngs.length) throw new Error('Il PDF non ha pagine.');
  let net = null;
  for (const png of pngs) { const v = await page(png); if (v != null) net = v; }
  if (net == null) throw new Error('Non trovo il netto a pagare nella busta paga.');
  return net;
}
