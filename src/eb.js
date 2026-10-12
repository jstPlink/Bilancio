// Client di Enable Banking (https://enablebanking.com), l'aggregatore PSD2 che collega UniCredit e Revolut in sola lettura.
// Le credenziali dell'applicazione (ID e chiave privata) si creano sul loro sito e restano solo sul server.
import crypto from 'node:crypto';

// ENABLE_BANKING_API permette di provare l'app con una banca finta (vedi scripts/banca-finta.mjs).
export const apiUrl = () => (process.env.ENABLE_BANKING_API || 'https://api.enablebanking.com').replace(/\/+$/, '');

const b64url = (value) => Buffer.from(value).toString('base64url');

// La chiave incollata può avere gli «a capo» scritti come \n: si ripristinano.
export const normalizeKey = (pem) => String(pem ?? '').trim().replace(/\\n/g, '\n');

export function checkKey(pem) {
  try { crypto.createPrivateKey(normalizeKey(pem)); } catch { throw new Error('La chiave privata non è valida: incolla tutto il contenuto del file .pem, comprese le righe BEGIN e END.'); }
}

// Token JWT firmato RS256 che Enable Banking richiede in ogni richiesta (valido un'ora).
export function makeJwt({ appId, privateKey }, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = { typ: 'JWT', alg: 'RS256', kid: appId };
  const body = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp: iat + 3600 };
  const input = `${b64url(JSON.stringify(head))}.${b64url(JSON.stringify(body))}`;
  const signature = crypto.createSign('RSA-SHA256').update(input).sign(normalizeKey(privateKey));
  return `${input}.${signature.toString('base64url')}`;
}

// Intestazioni «PSU» (l'utente è presente): dicono alla banca che la lettura l'ha chiesta una persona in quel momento, non un accesso
// automatico. Sono tutte insieme o nessuna; si ricavano dalla richiesta del browser o dell'app.
export function psuHeaders(req) {
  const h = req?.headers ?? {};
  const ip = (String(h['x-forwarded-for'] ?? '').split(',')[0].trim() || req?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const agent = h['user-agent'];
  if (!ip || !agent) return null;
  const out = {
    'Psu-Ip-Address': ip, 'Psu-User-Agent': agent, 'Psu-Referer': h.referer, 'Psu-Accept': h.accept,
    'Psu-Accept-Charset': 'utf-8', 'Psu-Accept-Encoding': h['accept-encoding'], 'Psu-Accept-Language': h['accept-language'],
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

export function createClient(app, fetchImpl = fetch, psu = null) {
  async function call(method, path, { query, body, headers } = {}) {
    const url = new URL(apiUrl() + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null && v !== '') url.searchParams.set(k, String(v));
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${makeJwt(app)}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 200) }; }
    if (!res.ok) throw new Error(`Enable Banking: ${data.message ?? data.error ?? `risposta ${res.status}`}`);
    return data;
  }
  // Letture dei conti: con le intestazioni PSU se ci sono; se la banca le rifiuta («PSU_HEADER…») si riprova senza.
  async function account(path, query) {
    if (!psu) return call('GET', path, { query });
    try { return await call('GET', path, { query, headers: psu }); }
    catch (e) { if (/psu/i.test(e.message)) return call('GET', path, { query }); throw e; }
  }
  return {
    aspsps: (query) => call('GET', '/aspsps', { query }),
    auth: (body) => call('POST', '/auth', { body }),
    createSession: (code) => call('POST', '/sessions', { body: { code } }),
    deleteSession: (id) => call('DELETE', `/sessions/${encodeURIComponent(id)}`),
    transactions: (uid, query) => account(`/accounts/${encodeURIComponent(uid)}/transactions`, query),
  };
}
