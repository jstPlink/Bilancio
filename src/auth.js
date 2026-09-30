import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Accesso con password. L'app è sempre protetta:
// - la prima volta non c'è nessuna password e la pagina /login chiede di crearne una (minimo 10 caratteri). La password si
//   salva cifrata (scrypt) nel database. Da localhost basta aprire la pagina; da qualsiasi altro indirizzo serve anche il
//   "codice di configurazione" che il server scrive nel suo log all'avvio, così nessun estraneo può prendere il tuo posto.
// - in alternativa BILANCIO_PASSWORD (variabile d'ambiente) fissa la password e ha la precedenza.
// - la sessione è un cookie firmato (HttpOnly, 30 giorni) che decade se si cambia la password.
// - gli script possono usare l'autenticazione HTTP Basic (qualsiasi utente + la password).
// - dopo 5 tentativi sbagliati lo stesso indirizzo resta bloccato 15 minuti.
const DAY = 24 * 60 * 60 * 1000;
const COOKIE = 'bilancio_sessione';
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
export const MIN_PASSWORD = 10;
const loginPage = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'login.html');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scrypt = (password, salt) => crypto.scryptSync(String(password), salt, 32);
const PROXY_HEADERS = ['x-forwarded-for', 'cf-connecting-ip', 'forwarded', 'x-real-ip'];

function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// envPassword: password fissata dall'ambiente (facoltativa). getRecord/saveRecord: dove si conserva la password creata nell'app.
export function createAuth({ envPassword = '', getRecord = () => null, saveRecord = () => {}, sessionDays = 30 } = {}) {
  const fails = new Map(); // "chiave:indirizzo" -> { count, lockedUntil }
  const setupCode = crypto.randomBytes(5).toString('hex').toUpperCase().replace(/^(.{5})(.{5})$/, '$1-$2');

  const hasPassword = () => Boolean(envPassword) || Boolean(getRecord());
  // Chiave per firmare i cookie: dipende dalla password, quindi cambiandola le sessioni decadono.
  const signingKey = () => sha(`bilancio-sessione:${envPassword ? `env:${envPassword}` : getRecord()?.hash ?? 'nessuna'}`);
  const sign = (exp) => crypto.createHmac('sha256', signingKey()).update(String(exp)).digest('base64url');
  const newToken = () => { const exp = Date.now() + sessionDays * DAY; return `${exp}.${sign(exp)}`; };
  const validToken = (token) => {
    if (!hasPassword()) return false;
    const [exp, mac] = String(token ?? '').split('.');
    if (!exp || !mac || !(Number(exp) > Date.now())) return false;
    const good = sign(exp);
    return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
  };

  function checkPassword(attempt) {
    if (attempt == null || attempt === '') return false;
    if (envPassword) return same(attempt, envPassword);
    const rec = getRecord();
    if (!rec) return false;
    const got = scrypt(attempt, Buffer.from(rec.salt, 'hex'));
    const want = Buffer.from(rec.hash, 'hex');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  }
  function setPassword(password) {
    const salt = crypto.randomBytes(16);
    saveRecord({ salt: salt.toString('hex'), hash: scrypt(password, salt).toString('hex'), createdAt: new Date().toISOString() });
  }

  const who = (req) => String(req.headers['cf-connecting-ip'] ?? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || 'sconosciuto';
  const isHttps = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieHeader = (req, value, maxAgeMs) => `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${isHttps(req) ? '; Secure' : ''}`;
  // "Da questo computer": connessione diretta da localhost, non passata da un proxy o da Cloudflare.
  const isLocalDirect = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !PROXY_HEADERS.some((h) => req.headers[h]);

  function basicOk(req) {
    const m = /^Basic (.+)$/i.exec(req.headers.authorization ?? '');
    if (!m) return false;
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    return checkPassword(decoded.slice(decoded.indexOf(':') + 1));
  }
  const authorized = (req) => validToken(readCookie(req, COOKIE)) || basicOk(req);

  // Limite ai tentativi: restituisce un errore da mostrare se l'indirizzo è bloccato.
  const lockedFor = (id) => {
    const f = fails.get(id);
    return f && f.lockedUntil > Date.now() ? Math.ceil((f.lockedUntil - Date.now()) / 60000) : 0;
  };
  const registerFail = (id) => {
    const f = fails.get(id) ?? { count: 0, lockedUntil: 0 };
    f.count++;
    if (f.count >= MAX_FAILS) { f.lockedUntil = Date.now() + LOCK_MS; f.count = 0; }
    fails.set(id, f);
  };

  // Percorsi raggiungibili senza sessione: la pagina di accesso, le sue chiamate e il controllo di salute del container.
  const open = new Set(['/login', '/login.html', '/api/login', '/api/logout', '/api/version', '/api/auth-state', '/api/setup']);

  function mount(app) {
    app.use((req, res, next) => {
      res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      if (open.has(req.path) || authorized(req)) {
        if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
        return next();
      }
      if (req.method === 'GET' && !req.path.startsWith('/api/') && String(req.headers.accept ?? '').includes('text/html')) return res.redirect('/login');
      return res.status(401).json({ error: hasPassword() ? 'Accesso richiesto: effettua il login.' : 'Crea prima la password dalla pagina di accesso.' });
    });

    app.get(['/login', '/login.html'], (req, res) => res.sendFile(loginPage));

    app.get('/api/auth-state', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json({ mode: hasPassword() ? 'login' : 'setup', codeRequired: !hasPassword() && !isLocalDirect(req), minLength: MIN_PASSWORD });
    });

    // Creazione della prima password (solo finché non ne esiste una).
    app.post('/api/setup', async (req, res) => {
      if (hasPassword()) return res.status(409).json({ error: 'La password esiste già: usa la pagina di accesso.' });
      const id = `setup:${who(req)}`;
      const wait = lockedFor(id);
      if (wait) return res.status(429).json({ error: `Troppi tentativi sbagliati. Riprova tra ${wait} minuti.` });
      if (!isLocalDirect(req)) {
        const given = String(req.body?.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!given || !same(given, setupCode.replace('-', ''))) {
          await sleep(500);
          registerFail(id);
          return res.status(403).json({ error: 'Codice di configurazione errato. Lo trovi nel log del server all\'avvio.' });
        }
      }
      const password = String(req.body?.password ?? '');
      if (password.length < MIN_PASSWORD) return res.status(400).json({ error: `La password deve avere almeno ${MIN_PASSWORD} caratteri.` });
      setPassword(password);
      res.set('Set-Cookie', cookieHeader(req, newToken(), sessionDays * DAY));
      return res.json({ ok: true });
    });

    app.post('/api/login', async (req, res) => {
      if (!hasPassword()) return res.status(409).json({ error: 'Nessuna password: creala dalla pagina di accesso.' });
      const id = `login:${who(req)}`;
      const wait = lockedFor(id);
      if (wait) return res.status(429).json({ error: `Troppi tentativi sbagliati. Riprova tra ${wait} minuti.` });
      if (checkPassword(req.body?.password)) {
        fails.delete(id);
        res.set('Set-Cookie', cookieHeader(req, newToken(), sessionDays * DAY));
        return res.json({ ok: true });
      }
      await sleep(500); // rallenta chi prova a indovinare
      registerFail(id);
      return res.status(401).json({ error: 'Password errata.' });
    });

    app.post('/api/logout', (req, res) => {
      res.set('Set-Cookie', cookieHeader(req, '', 0));
      res.json({ ok: true });
    });
  }

  return { mount, hasPassword, setupCode, usesEnv: Boolean(envPassword), newToken, validToken, checkPassword, setPassword };
}
