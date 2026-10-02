import { extractText as pdfText } from 'unpdf';
import { openPdf } from './pdf.js';
import { parseDocument } from './parsers.js';
import { listSource } from './sources.js';
import { createOcr } from './ocr.js';
import { parseStatement, addOrEnrich } from './statements.js';
import { parsePdfStatement } from './pdfstatements.js';

const SOURCES = [
  { setting: 'payslipsSource', tag: 'busta', label: 'Buste paga' },
  { setting: 'billsSource', tag: 'bolletta', label: 'Bollette', skipDir: /^documenti$/i },
];
const CONCURRENCY = 3;
const RETRY_SCALE = 4; // secondo tentativo OCR, più lento ma più nitido
const MIN_TEXT = 40; // sotto questa soglia il PDF è considerato una scansione

// Avanzamento dell'aggiornamento in corso, letto dall'interfaccia.
export const progress = { running: false, done: 0, total: 0 };

// Testo del PDF; se non c'è (scansione) si passa all'OCR.
async function readText(buffer, ocr) {
  const pdf = await openPdf(buffer);
  const { text } = await pdfText(pdf, { mergePages: true });
  if (text.trim().length >= MIN_TEXT) return { text, ocr: false };
  return { text: await ocr.recognize(pdf), ocr: true, retry: () => ocr.recognize(pdf, RETRY_SCALE) };
}

// I documenti caricati a mano dall'app non appartengono a nessuna cartella: l'aggiornamento non li toglie.
export const isUploadKey = (key) => String(key).startsWith('upload:');

// Legge un PDF (con OCR se è una scansione) e ne ricava tipo, periodo e importo. `tag` è 'busta' o 'bolletta'.
export async function readPdfDocument(buffer, { name, tag, modified, ocr }) {
  const read = await readText(buffer, ocr);
  let { text } = read;
  let parsed = parseDocument({ text, filename: name, hint: tag, modified });
  if (read.ocr && parsed.status !== 'ok') {
    const retryText = await read.retry();
    const retried = parseDocument({ text: retryText, filename: name, hint: tag, modified });
    if (retried.status === 'ok') { parsed = retried; text = retryText; }
  }
  return { parsed, text, ocr: read.ocr };
}

async function inParallel(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

// Rilegge le sorgenti configurate e aggiorna `db.docs`.
// Un PDF già letto e non modificato viene saltato, a meno di `force`.
// Estratti conto (PDF UniCredit e Revolut, oppure CSV) dalla cartella/link configurato: solo file nuovi o modificati, movimenti senza duplicati.
// Versione del lettore: quando cambia (es. ora legge anche le entrate) gli estratti conto si rileggono una volta.
const STATEMENT_PARSER = 3;

async function readStatements(db, report, force) {
  const value = db.settings.statementsSource;
  if (!value?.trim()) { report.sources.push({ label: 'Estratti conto', skipped: true }); return; }
  try {
    const files = await listSource(value, /\.(pdf|csv)$/i);
    report.sources.push({ label: 'Estratti conto', files: files.length });
    db.statementFiles ??= {};
    db.transactions ??= {};
    if (db.statementParser !== STATEMENT_PARSER) { db.statementFiles = {}; db.statementParser = STATEMENT_PARSER; }
    for (const file of files) {
      if (!force && db.statementFiles[file.key] === file.version) continue;
      try {
        let items;
        if (/\.pdf$/i.test(file.name)) {
          const parsed = await parsePdfStatement(await file.read(), db.rules);
          items = parsed.items;
          const c = parsed.check;
          // Controllo con il riepilogo della banca: se non torna, meglio dirlo.
          if (c && (Math.abs(c.parsedOut - c.statedOut) > 0.005 || Math.abs(c.parsedIn - c.statedIn) > 0.005)) {
            report.errors.push({ source: file.name, message: `le uscite lette (${c.parsedOut}) non tornano col riepilogo della banca (${c.statedOut})` });
          }
        } else {
          items = parseStatement((await file.read()).toString('utf8'), db.rules);
        }
        for (const t of items) if (addOrEnrich(db.transactions, t, file.name) === 'added') report.transactions++;
        db.statementFiles[file.key] = file.version;
      } catch (e) {
        report.errors.push({ source: file.name, message: e.message });
      }
    }
  } catch (e) {
    report.errors.push({ source: 'Estratti conto', message: e.message });
    report.sources.push({ label: 'Estratti conto', failed: true });
  }
}

export async function refresh(db, { force = false, cacheDir } = {}) {
  const report = { added: 0, updated: 0, unchanged: 0, removed: 0, incomplete: 0, ocr: 0, transactions: 0, errors: [], sources: [] };
  const ocr = createOcr({ cacheDir, size: CONCURRENCY });
  Object.assign(progress, { running: true, done: 0, total: 0 });

  try {
    // 1) elenco dei file di ogni sorgente
    const listings = [];
    for (const { setting, tag, label, skipDir } of SOURCES) {
      const value = db.settings[setting];
      if (!value?.trim()) {
        report.sources.push({ label, skipped: true });
        continue;
      }
      try {
        const files = await listSource(value, undefined, skipDir);
        listings.push({ tag, files });
        report.sources.push({ label, files: files.length });
      } catch (e) {
        report.errors.push({ source: label, message: e.message });
        report.sources.push({ label, failed: true });
      }
    }

    await readStatements(db, report, force);

    // 2) lettura dei soli file nuovi o modificati
    const queue = [];
    for (const { tag, files } of listings) {
      for (const file of files) {
        const previous = db.docs[file.key];
        if (!force && previous && previous.version === file.version && previous.source === tag) report.unchanged++;
        else queue.push({ tag, file, previous });
      }
    }
    progress.total = queue.length;

    await inParallel(queue, CONCURRENCY, async ({ tag, file, previous }) => {
      try {
        const { parsed, text, ocr: usedOcr } = await readPdfDocument(await file.read(), { name: file.name, tag, modified: file.modified, ocr });
        db.docs[file.key] = {
          name: file.name,
          version: file.version,
          source: tag,
          kind: parsed.kind ?? null,
          year: parsed.year ?? null,
          month: parsed.month ?? null,
          amount: parsed.amount ?? null,
          status: parsed.status,
          missing: parsed.missing,
          ocr: usedOcr,
          named: parsed.named ?? false,
          text: text.slice(0, 12000),
          override: previous?.override,
          readAt: new Date().toISOString(),
        };
        if (usedOcr) report.ocr++;
        if (parsed.status !== 'ok') report.incomplete++;
        if (previous) report.updated++; else report.added++;
      } catch (e) {
        report.errors.push({ source: file.name, message: e.message });
      } finally {
        progress.done++;
      }
    });

    // 3) documenti spariti dalla sorgente
    for (const { tag, files } of listings) {
      const seen = new Set(files.map((f) => f.key));
      for (const [key, doc] of Object.entries(db.docs)) {
        if (doc.source === tag && !seen.has(key) && !isUploadKey(key)) {
          delete db.docs[key];
          report.removed++;
        }
      }
    }

    db.lastRefresh = new Date().toISOString();
    return report;
  } finally {
    progress.running = false;
    await ocr.close();
  }
}
