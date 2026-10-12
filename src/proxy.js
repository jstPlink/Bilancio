// Frontend locale: `npm start` serve solo le pagine di questa cartella (HTML, JavaScript, stile: le modifiche al codice si vedono subito).
// Non ha dati né logica: ogni richiesta ai dati e al login (/api/…) viene inoltrata al server che l'utente sceglie nella pagina di accesso
// (intestazione X-MyBank-Server) oppure, se manca, a MYBANK_SERVER del file .env. Dati, password, banche e aggiornamenti sono sempre quelli del server.
// Se il server non ha ancora una funzione nuova, la chiamata risponde con un errore.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const { version: localVersion } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
const port = Number(process.env.PORT ?? 4870);
const host = process.env.HOST ?? '127.0.0.1';
const defaultServer = (process.env.MYBANK_SERVER ?? '').trim();

/** Il server a cui inoltrare: quello scelto nella pagina di accesso, altrimenti quello del file .env. Solo http/https. */
function targetOf(req) {
  const raw = String(req.headers['x-mybank-server'] ?? defaultServer).trim();
  if (!raw) return null;
  try {
    const homeAddress = /^(localhost([:/]|$)|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/:]+\.local([:/]|$))/i.test(raw);
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `${homeAddress ? 'http' : 'https'}://${raw}`);
    return /^https?:$/.test(u.protocol) && u.hostname ? u : null;
  } catch { return null; }
}

const pages = express();
pages.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8').replaceAll('__V__', localVersion));
});
// La pagina scopre da qui di essere il frontend locale (sul server vero questo indirizzo non esiste) e mostra la scelta del server.
pages.get('/local-config.json', (req, res) => res.json({ local: true, server: defaultServer, version: localVersion }));
pages.use(express.static(publicDir, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

const fail = (res, status, error) => {
  if (res.headersSent) return res.destroy();
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error }));
};

async function forward(req, res, target) {
  const url = new URL(req.url, target);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && !['accept-encoding', 'origin', 'referer', 'x-mybank-server'].includes(k)) headers[k] = v;
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const upstream = await fetch(url, { method: req.method, headers, body: hasBody ? req : undefined, duplex: 'half', redirect: 'manual' });

  // La versione mostrata è quella del codice locale; quella del server si legge a parte.
  if ((url.pathname === '/api/version' || url.pathname === '/api/session') && upstream.ok) {
    const info = await upstream.json();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ...info, version: localVersion, serverVersion: info.version }));
    return;
  }

  res.statusCode = upstream.status;
  for (const [k, v] of upstream.headers) {
    // fetch ha già decompresso il contenuto: lunghezza e codifica originali non valgono più
    if (HOP.has(k) || ['content-encoding', 'content-length', 'set-cookie'].includes(k)) continue;
    res.setHeader(k, k === 'location' ? v.replace(target.origin, '') : v);
  }
  // Il cookie di sessione del server può essere «Secure» (https): sul localhost http va reso utilizzabile.
  const cookies = upstream.headers.getSetCookie().map((c) => c.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, ''));
  if (cookies.length) res.setHeader('set-cookie', cookies);
  res.setHeader('x-mybank-inoltro', target.host);
  if (upstream.body && req.method !== 'HEAD') await pipeline(Readable.fromWeb(upstream.body), res);
  else res.end();
}

export const server = http.createServer((req, res) => {
  if (!String(req.url).startsWith('/api/')) return pages(req, res);
  const target = targetOf(req);
  if (!target) return fail(res, 400, 'Scegli il server a cui collegarti (indirizzo https, es. mybank.miodominio.it).');
  forward(req, res, target).catch((e) => fail(res, 502, `Il server ${target.host} non risponde (${e.cause?.code ?? e.message}). Controlla l'indirizzo, la connessione o che il server sia acceso.`));
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) || process.env.MYBANK_LOCAL_START) {
  server.listen(port, host, () => {
    console.log(`MyBank ${localVersion} (solo frontend) su http://${host}:${port}: le pagine sono di questa cartella, dati e login vanno al server scelto nella pagina di accesso${defaultServer ? ` (di base ${new URL(targetOf({ headers: {} })?.href ?? 'http://x').origin})` : ''}`);
  });
}
