import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express from 'express';

// Modalità "localhost che punta al server": con BILANCIO_SERVER impostato, questa app locale non ha dati suoi.
// Le pagine (HTML, JavaScript, stile) sono quelle di questa cartella, quindi le modifiche al codice si vedono subito;
// ogni richiesta ai dati e al login (/api/…) viene inoltrata al server, così dati e password sono sempre quelli del
// server e non ci sono due copie.
let target;
try {
  target = new URL(process.env.BILANCIO_SERVER);
  if (!/^https?:$/.test(target.protocol)) throw new Error('protocollo');
} catch {
  console.error(`BILANCIO_SERVER non è un indirizzo valido: "${process.env.BILANCIO_SERVER}" (es. https://bilancio.example.it)`);
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const { version: localVersion } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
const port = Number(process.env.PORT ?? 4870);
const host = process.env.HOST ?? '127.0.0.1';

const pages = express();
pages.get(['/login', '/login.html'], (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
pages.use(express.static(publicDir));

const unreachable = (req, res, e) => {
  if (res.headersSent) return res.destroy();
  const message = `Il server ${target.host} non risponde (${e.cause?.code ?? e.message}). Controlla la connessione o che il server sia acceso.`;
  res.statusCode = 502;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
};

async function forward(req, res) {
  const url = new URL(req.url, target);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && !['accept-encoding', 'origin', 'referer'].includes(k)) headers[k] = v;
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const upstream = await fetch(url, { method: req.method, headers, body: hasBody ? req : undefined, duplex: 'half', redirect: 'manual' });

  // La versione mostrata è quella del codice locale; quella del server si legge a parte.
  if (url.pathname === '/api/version' && upstream.ok) {
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
  // Il cookie di sessione del server è "Secure" (https): sul localhost http va reso utilizzabile.
  const cookies = upstream.headers.getSetCookie().map((c) => c.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, ''));
  if (cookies.length) res.setHeader('set-cookie', cookies);
  res.setHeader('x-bilancio-inoltro', target.host);
  if (upstream.body && req.method !== 'HEAD') await pipeline(Readable.fromWeb(upstream.body), res);
  else res.end();
}

const server = http.createServer((req, res) => {
  if (!String(req.url).startsWith('/api/')) return pages(req, res);
  forward(req, res).catch((e) => unreachable(req, res, e));
});

server.listen(port, host, () => {
  console.log(`Bilancio locale su http://${host}:${port}: pagine di questa cartella, dati e login inoltrati a ${target.origin}`);
  console.log('Dati e password sono quelli del server: in locale non viene letto né scritto nessun dato.');
});
