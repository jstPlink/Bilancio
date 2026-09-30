import { renderPageAsImage } from 'unpdf';
import { createWorker } from 'tesseract.js';

// OCR per i PDF che sono solo immagini (scansioni). Un piccolo pool di worker
// Tesseract viene creato alla prima richiesta e chiuso a fine aggiornamento.
// La lingua ("ita") viene scaricata una volta sola e tenuta in `cacheDir`.

const MAX_PAGES = 2;
const SCALE = 2.5;

export function createOcr({ cacheDir, size = 3 } = {}) {
  let workers = null;
  const idle = [];
  const waiting = [];

  async function init() {
    if (workers) return;
    workers = await Promise.all(Array.from({ length: size }, () => createWorker('ita', 1, {
      cachePath: cacheDir,
      logger: () => {},
      errorHandler: () => {},
    })));
    idle.push(...workers);
  }

  async function acquire() {
    await init();
    return idle.pop() ?? new Promise((resolve) => waiting.push(resolve));
  }

  function release(worker) {
    const next = waiting.shift();
    if (next) next(worker); else idle.push(worker);
  }

  // `pdf` è un documento già aperto con getDocumentProxy.
  async function recognize(pdf, scale = SCALE) {
    const parts = [];
    for (let page = 1; page <= Math.min(pdf.numPages, MAX_PAGES); page++) {
      const image = await renderPageAsImage(pdf, page, { canvasImport: () => import('@napi-rs/canvas'), scale });
      const worker = await acquire();
      try {
        const { data } = await worker.recognize(Buffer.from(image));
        parts.push(data.text);
      } finally {
        release(worker);
      }
    }
    return parts.join('\n');
  }

  async function close() {
    if (!workers) return;
    await Promise.all(workers.map((w) => w.terminate()));
    workers = null;
    idle.length = 0;
  }

  return { recognize, close };
}
