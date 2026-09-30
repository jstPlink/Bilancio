import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureUnPDF, getDocumentProxy } from 'unpdf';

// Usa il pdf.js completo (pdfjs-dist) invece di quello incorporato in unpdf:
// serve per decodificare le scansioni JBIG2, che richiedono il file jbig2.wasm.
// pdf.js vuole un percorso con slash normali e uno slash finale, anche su Windows.
const wasmUrl = `${path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'pdfjs-dist', 'wasm')
  .split(path.sep).join('/')}/`;

let configured;

export async function openPdf(buffer) {
  configured ??= configureUnPDF({ pdfjs: () => import('pdfjs-dist/legacy/build/pdf.mjs') });
  await configured;
  return getDocumentProxy(new Uint8Array(buffer), { wasmUrl });
}
