// Legge l'estratto conto mensile di Revolut (PDF) e scrive i movimenti in un file JSON, pronto da importare dalla scheda Documenti.
//
//   node scripts/estratto-revolut.mjs "Estratto conto 2026.06.pdf" [file-di-uscita.json]
//
// Serve `pdftotext` (poppler) nel PATH. Di norma non serve: dalla scheda Documenti basta toccare «Importa» accanto all'estratto.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parseStatement } from '../src/estratto.js';

const [pdf, outFile] = process.argv.slice(2);
if (!pdf) { console.error('Uso: node scripts/estratto-revolut.mjs "Estratto conto 2026.06.pdf" [uscita.json]'); process.exit(1); }
const text = execFileSync('pdftotext', ['-raw', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const { transactions, totals, warnings } = parseStatement(text);
const target = outFile ?? pdf.replace(/\.pdf$/i, '.json');
fs.writeFileSync(target, JSON.stringify({ transactions }, null, 1));
console.log(`${transactions.length} movimenti → ${target}`);
for (const w of warnings) console.log(`  attenzione: ${w}`);
for (const [k, v] of Object.entries(totals)) console.log(`  ${k}: saldo iniziale ${v[0]} · uscite ${v[1]} · entrate ${v[2]} · saldo finale ${v[3]}  (saldo finale = riepilogo)`);
