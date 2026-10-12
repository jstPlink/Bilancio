// Accesso con una sola password (MYBANK_PASSWORD). Il login dà un gettone firmato (HMAC), valido 180 giorni, che il browser tiene
// in un cookie e l'app Android (e il widget) mandano come «Authorization: Bearer». La chiave di firma sta in data/secret.key.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DAYS = 180;
const COOKIE = 'mybank';

export function createAuth({ dir, password }) {
  let secret;
  const keyFile = path.join(dir, 'secret.key');
  try { secret = fs.readFileSync(keyFile); } catch {
    secret = crypto.randomBytes(32);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(keyFile, secret, { mode: 0o600 });
  }
  const sign = (body) => crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const issue = (now = Date.now()) => {
    const body = Buffer.from(JSON.stringify({ exp: now + DAYS * 86400000 })).toString('base64url');
    return `${body}.${sign(body)}`;
  };
  const valid = (token, now = Date.now()) => {
    const [body, sig] = String(token ?? '').split('.');
    if (!body || !sig) return false;
    const expect = Buffer.from(sign(body));
    const got = Buffer.from(sig);
    if (expect.length !== got.length || !crypto.timingSafeEqual(expect, got)) return false;
    try { return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > now; } catch { return false; }
  };
  const same = (a, b) => {
    const x = crypto.createHash('sha256').update(String(a)).digest();
    const y = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(x, y);
  };

  const tokenOf = (req) => {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    if (bearer) return bearer;
    const cookie = String(req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
    return cookie ? decodeURIComponent(cookie.slice(COOKIE.length + 1)) : '';
  };
  const open = !password; // senza password (solo in locale) l'accesso è libero
  const isAuthed = (req) => open || valid(tokenOf(req));

  // al massimo 8 tentativi sbagliati ogni 10 minuti per indirizzo
  const fails = new Map();
  const tooMany = (ip, now = Date.now()) => (fails.get(ip) ?? []).filter((t) => t > now - 600000).length >= 8;
  const fail = (ip, now = Date.now()) => fails.set(ip, [...(fails.get(ip) ?? []).filter((t) => t > now - 600000), now]);

  return {
    open, isAuthed, tokenOf,
    /** Gettone da dare a chi ha già una sessione valida (serve all'app Android per il widget). */
    refresh: () => issue(),
    login(req, res) {
      const ip = req.ip ?? '';
      if (tooMany(ip)) return res.status(429).json({ error: 'Troppi tentativi: riprova tra qualche minuto.' });
      if (!open && !same(req.body?.password ?? '', password)) { fail(ip); return res.status(401).json({ error: 'Password errata.' }); }
      const token = issue();
      res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DAYS * 86400}${req.secure ? '; Secure' : ''}`);
      res.json({ ok: true, token });
    },
    logout(req, res) {
      res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      res.json({ ok: true });
    },
    middleware(req, res, next) { if (isAuthed(req)) return next(); res.status(401).json({ error: 'Accesso richiesto.' }); },
  };
}
