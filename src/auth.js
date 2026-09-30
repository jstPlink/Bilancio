import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Accesso con password (facoltativo). Si attiva impostando BILANCIO_PASSWORD.
// - Pagina /login con un campo password; la sessione è un cookie firmato (HttpOnly, 30 giorni) che non richiede di
//   salvare nulla sul server e diventa invalido se si cambia la password.
// - Gli script possono usare l'autenticazione HTTP Basic (qualsiasi utente + la password).
// - Dopo 5 tentativi sbagliati lo stesso indirizzo resta bloccato 15 minuti.
const DAY = 24 * 60 * 60 * 1000;
const COOKIE = 'bilancio_sessione';
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const loginPage = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'login.html');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function createAuth(password, { sessionDays = 30 } = {}) {
  const enabled = Boolean(password);
  const key = sha(`bilancio-sessione:${password ?? ''}`);
  const sign = (exp) => crypto.createHmac('sha256', key).update(String(exp)).digest('base64url');
  const fails = new Map(); // indirizzo -> { count, lockedUntil }

  const newToken = () => { const exp = Date.now() + sessionDays * DAY; return `${exp}.${sign(exp)}`; };
  const validToken = (token) => {
    const [exp, mac] = String(token ?? '').split('.');
    if (!exp || !mac || !(Number(exp) > Date.now())) return false;
    const good = sign(exp);
    return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
  };
  const checkPassword = (attempt) => enabled && same(attempt ?? '', password);

  const who = (req) => String(req.headers['cf-connecting-ip'] ?? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() ?? '') || req.socket.remoteAddress || 'sconosciuto';
  const isHttps = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieHeader = (req, value, maxAgeMs) => `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${isHttps(req) ? '; Secure' : ''}`;

  function basicOk(req) {
    const m = /^Basic (.+)$/i.exec(req.headers.authorization ?? '');
    if (!m) return false;
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    return checkPassword(decoded.slice(decoded.indexOf(':') + 1));
  }
  const authorized = (req) => validToken(readCookie(req, COOKIE)) || basicOk(req);

  // Percorsi raggiungibili senza password: la pagina di accesso, il login e il controllo di salute del container.
  const open = new Set(['/login', '/login.html', '/api/login', '/api/logout', '/api/version']);

  function mount(app) {
    if (!enabled) return;
    app.use((req, res, next) => {
      res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      if (open.has(req.path) || authorized(req)) {
        if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
        return next();
      }
      if (req.method === 'GET' && !req.path.startsWith('/api/') && String(req.headers.accept ?? '').includes('text/html')) return res.redirect('/login');
      return res.status(401).json({ error: 'Accesso richiesto: effettua il login.' });
    });
    app.get(['/login', '/login.html'], (req, res) => res.sendFile(loginPage));
    app.post('/api/login', async (req, res) => {
      const ip = who(req);
      const f = fails.get(ip) ?? { count: 0, lockedUntil: 0 };
      if (f.lockedUntil > Date.now()) {
        const min = Math.ceil((f.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({ error: `Troppi tentativi sbagliati. Riprova tra ${min} minuti.` });
      }
      if (checkPassword(req.body?.password)) {
        fails.delete(ip);
        res.set('Set-Cookie', cookieHeader(req, newToken(), sessionDays * DAY));
        return res.json({ ok: true });
      }
      await sleep(500); // rallenta chi prova a indovinare
      f.count++;
      if (f.count >= MAX_FAILS) { f.lockedUntil = Date.now() + LOCK_MS; f.count = 0; }
      fails.set(ip, f);
      return res.status(401).json({ error: 'Password errata.' });
    });
    app.post('/api/logout', (req, res) => {
      res.set('Set-Cookie', cookieHeader(req, '', 0));
      res.json({ ok: true });
    });
  }

  return { enabled, mount, newToken, validToken, checkPassword };
}
