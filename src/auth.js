// Accesso con una sola password. Il login dà un gettone firmato (HMAC), valido 180 giorni, che il browser tiene in un cookie e l'app
// Android (e il widget) mandano come «Authorization: Bearer». La chiave di firma sta in data/secret.key.
// La password iniziale è MYBANK_PASSWORD; quando la cambi dalle Opzioni se ne salva l'impronta (scrypt) in data/auth.json e da lì in poi
// vale quella (il valore di MYBANK_PASSWORD non conta più). Cambiarla fa decadere tutti i gettoni emessi prima.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DAYS = 180;
const COOKIE = 'mybank';
export const MIN_PASSWORD = 5;

export function createAuth({ dir, password }) {
  fs.mkdirSync(dir, { recursive: true });
  let secret;
  const keyFile = path.join(dir, 'secret.key');
  try { secret = fs.readFileSync(keyFile); } catch {
    secret = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, secret, { mode: 0o600 });
  }
  const authFile = path.join(dir, 'auth.json');
  let stored = null; // { salt, hash, changedAt }
  try { stored = JSON.parse(fs.readFileSync(authFile, 'utf8')); } catch { /* nessuna password cambiata: vale quella dell'ambiente */ }

  const scrypt = (pw, salt) => crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), 32).toString('base64');
  const sign = (body) => crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const issue = (now = Date.now()) => {
    const body = Buffer.from(JSON.stringify({ iat: now, exp: now + DAYS * 86400000 })).toString('base64url');
    return `${body}.${sign(body)}`;
  };
  const valid = (token, now = Date.now()) => {
    const [body, sig] = String(token ?? '').split('.');
    if (!body || !sig) return false;
    const expect = Buffer.from(sign(body));
    const got = Buffer.from(sig);
    if (expect.length !== got.length || !crypto.timingSafeEqual(expect, got)) return false;
    try {
      const t = JSON.parse(Buffer.from(body, 'base64url').toString());
      return t.exp > now && (t.iat ?? 0) >= (stored?.changedAt ?? 0);
    } catch { return false; }
  };
  const same = (a, b) => {
    const x = crypto.createHash('sha256').update(String(a)).digest();
    const y = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(x, y);
  };
  const passwordOk = (input) => (stored
    ? crypto.timingSafeEqual(Buffer.from(scrypt(input, stored.salt)), Buffer.from(stored.hash))
    : same(input, password));

  const tokenOf = (req) => {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    if (bearer) return bearer;
    const cookie = String(req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
    return cookie ? decodeURIComponent(cookie.slice(COOKIE.length + 1)) : '';
  };
  const isOpen = () => !stored && !password; // senza password (solo in locale) l'accesso è libero
  const isAuthed = (req) => isOpen() || valid(tokenOf(req));
  const cookieFor = (req, token) => `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DAYS * 86400}${req.secure ? '; Secure' : ''}`;

  // al massimo 8 tentativi sbagliati ogni 10 minuti per indirizzo
  const fails = new Map();
  const tooMany = (ip, now = Date.now()) => (fails.get(ip) ?? []).filter((t) => t > now - 600000).length >= 8;
  const fail = (ip, now = Date.now()) => fails.set(ip, [...(fails.get(ip) ?? []).filter((t) => t > now - 600000), now]);

  return {
    get open() { return isOpen(); },
    isAuthed, tokenOf,
    /** Gettone da dare a chi ha già una sessione valida (serve all'app Android per il widget). */
    refresh: () => issue(),
    login(req, res) {
      const ip = req.ip ?? '';
      if (tooMany(ip)) return res.status(429).json({ error: 'Troppi tentativi: riprova tra qualche minuto.' });
      if (!isOpen() && !passwordOk(req.body?.password ?? '')) { fail(ip); return res.status(401).json({ error: 'Password errata.' }); }
      const token = issue();
      res.setHeader('Set-Cookie', cookieFor(req, token));
      res.json({ ok: true, token });
    },
    logout(req, res) {
      res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      res.json({ ok: true });
    },
    /** Cambia la password: serve quella attuale (non se l'accesso è libero). Tutti gli altri accessi decadono; chi cambia riceve un gettone nuovo. */
    changePassword(req, res) {
      const ip = req.ip ?? '';
      if (tooMany(ip)) return res.status(429).json({ error: 'Troppi tentativi: riprova tra qualche minuto.' });
      const { current = '', next = '' } = req.body ?? {};
      if (!isOpen() && !passwordOk(current)) { fail(ip); return res.status(400).json({ error: 'La password attuale non è corretta.' }); }
      if (String(next).length < MIN_PASSWORD) return res.status(400).json({ error: `La nuova password deve avere almeno ${MIN_PASSWORD} caratteri.` });
      const salt = crypto.randomBytes(16).toString('base64');
      stored = { salt, hash: scrypt(next, salt), changedAt: Date.now() };
      const tmp = `${authFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(stored), { mode: 0o600 });
      fs.renameSync(tmp, authFile);
      const token = issue();
      res.setHeader('Set-Cookie', cookieFor(req, token));
      res.json({ ok: true, token });
    },
    middleware(req, res, next) { if (isAuthed(req)) return next(); res.status(401).json({ error: 'Accesso richiesto.' }); },
  };
}
