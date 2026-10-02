// Collegamento diretto alle banche (UniCredit, Revolut) tramite Enable Banking, un aggregatore PSD2 (open banking).
// Il servizio è gratuito per uso personale se si collegano i propri conti. Le credenziali dell'applicazione
// (ID e chiave privata) le crei tu su enablebanking.com e le inserisci nelle Impostazioni: restano solo sul server.
import crypto from 'node:crypto';
import { makeTransaction } from './statements.js';

export const API = 'https://api.enablebanking.com';

// Le banche proposte. `countries`: ordine di preferenza se l'aggregatore ne elenca più di uno.
export const BANKS = {
  unicredit: { label: 'UniCredit', match: /unicredit/i, countries: ['IT'] },
  revolut: { label: 'Revolut', match: /revolut/i, countries: ['IT', 'LT'] },
};

const DAY = 86400000;
export const CONSENT_DAYS = 180;      // durata del consenso richiesto (la banca può ridurla)
export const SYNCS_PER_DAY = 4;       // limite PSD2 per gli accessi non assistiti
const FIRST_SYNC_DAYS = 365;          // storico richiesto al primo collegamento (si ripiega su 90 giorni se la banca non lo consente)
const FALLBACK_SYNC_DAYS = 90;
const OVERLAP_DAYS = 7;               // ogni aggiornamento riparte qualche giorno prima, per non perdere i movimenti registrati in ritardo
const PENDING_MS = 60 * 60 * 1000;

// ------------------------------------------------------------------ credenziali e firma

const b64url = (value) => Buffer.from(value).toString('base64url');

// La chiave incollata può avere gli «a capo» scritti come \n: si ripristinano.
export function normalizeKey(pem) {
  return String(pem ?? '').trim().replace(/\\n/g, '\n');
}

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

export function createClient(app, fetchImpl = fetch) {
  async function call(method, path, { query, body } = {}) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null && v !== '') url.searchParams.set(k, String(v));
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${makeJwt(app)}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 200) }; }
    if (!res.ok) throw new Error(`Enable Banking: ${data.message ?? data.error ?? `risposta ${res.status}`}`);
    return data;
  }
  return {
    aspsps: (query) => call('GET', '/aspsps', { query }),
    auth: (body) => call('POST', '/auth', { body }),
    createSession: (code) => call('POST', '/sessions', { body: { code } }),
    deleteSession: (id) => call('DELETE', `/sessions/${encodeURIComponent(id)}`),
    transactions: (uid, query) => call('GET', `/accounts/${encodeURIComponent(uid)}/transactions`, { query }),
  };
}

// ------------------------------------------------------------------ stato salvato (db.banking)

export function bankingState(db) {
  db.banking ??= {};
  db.banking.app ??= null;
  db.banking.connections ??= [];
  db.banking.pending ??= {};
  return db.banking;
}

const maskIban = (iban) => (iban ? `${iban.slice(0, 4)}…${iban.slice(-4)}` : '');

// Quello che si mostra nell'interfaccia: mai la chiave privata.
export function publicState(db, now = Date.now()) {
  const b = bankingState(db);
  return {
    configured: Boolean(b.app?.appId && b.app?.privateKey),
    appId: b.app?.appId ?? '',
    hasKey: Boolean(b.app?.privateKey),
    banks: Object.entries(BANKS).map(([key, v]) => ({ key, label: v.label })),
    connections: b.connections.map((c) => {
      const until = Date.parse(c.validUntil);
      return {
        id: c.id, bank: c.bank, label: BANKS[c.bank]?.label ?? c.bank,
        accounts: c.accounts.map((a) => ({ name: a.name, iban: maskIban(a.iban), currency: a.currency })),
        validUntil: c.validUntil, daysLeft: Number.isFinite(until) ? Math.floor((until - now) / DAY) : null,
        expired: Number.isFinite(until) && until <= now, lastSync: c.lastSync,
        syncsToday: (c.calls ?? []).filter((t) => t > now - DAY).length, syncsPerDay: SYNCS_PER_DAY,
      };
    }),
  };
}

// ------------------------------------------------------------------ collegamento

async function findAspsp(client, bankKey) {
  const bank = BANKS[bankKey];
  if (!bank) throw new Error('Banca non prevista.');
  const res = await client.aspsps({ psu_type: 'personal', service: 'AIS' });
  const list = (Array.isArray(res) ? res : res.aspsps ?? []).filter((a) => bank.match.test(a.name));
  if (!list.length) throw new Error(`${bank.label} non risulta tra le banche collegabili con Enable Banking.`);
  const rank = (a) => { const i = bank.countries.indexOf(a.country); return i < 0 ? 99 : i; };
  return [...list].sort((a, b) => rank(a) - rank(b))[0];
}

// Avvia il collegamento: restituisce l'indirizzo della banca dove autorizzare l'accesso in sola lettura.
export async function startLink({ client, db, bank, redirectUrl, now = Date.now() }) {
  const aspsp = await findAspsp(client, bank);
  const maxDays = aspsp.maximum_consent_validity ? Math.floor(aspsp.maximum_consent_validity / 86400) : CONSENT_DAYS;
  const validUntil = new Date(now + Math.min(CONSENT_DAYS, Math.max(1, maxDays)) * DAY - 60000).toISOString();
  const state = crypto.randomUUID();
  const res = await client.auth({
    access: { valid_until: validUntil, balances: true, transactions: true },
    aspsp: { name: aspsp.name, country: aspsp.country },
    state, redirect_url: redirectUrl, psu_type: 'personal', language: 'it',
  });
  const b = bankingState(db);
  for (const [k, p] of Object.entries(b.pending)) if (now - p.createdAt > PENDING_MS) delete b.pending[k];
  b.pending[state] = { bank, aspsp: { name: aspsp.name, country: aspsp.country }, validUntil, createdAt: now };
  return res.url;
}

// Al ritorno dalla banca: il codice si scambia con la sessione e si salvano i conti collegati.
export async function finishLink({ client, db, code, state, now = Date.now() }) {
  const b = bankingState(db);
  const pending = b.pending[state];
  if (!pending || now - pending.createdAt > PENDING_MS) throw new Error('Richiesta di collegamento scaduta o sconosciuta: riparti dalle Impostazioni.');
  const session = await client.createSession(code);
  delete b.pending[state];
  const conn = {
    id: session.session_id, bank: pending.bank, aspsp: session.aspsp ?? pending.aspsp,
    accounts: (session.accounts ?? []).map((a) => ({ uid: a.uid, iban: a.account_id?.iban ?? '', name: a.name ?? '', currency: a.currency ?? 'EUR', type: a.cash_account_type ?? '' })),
    validUntil: session.access?.valid_until ?? pending.validUntil, createdAt: new Date(now).toISOString(), lastSync: null, calls: [],
  };
  if (!conn.accounts.length) throw new Error('La banca non ha reso disponibile nessun conto.');
  b.connections = [...b.connections.filter((c) => c.bank !== pending.bank), conn]; // un nuovo consenso sostituisce il vecchio
  return conn;
}

// ------------------------------------------------------------------ movimenti

// Un movimento dell'aggregatore diventa un movimento dell'app. Negativo = uscita.
export function mapTransaction(tx, conn, account, rules, seen = new Map()) {
  const amount = Math.abs(Number(tx.transaction_amount?.amount));
  if (!Number.isFinite(amount)) return null;
  const credit = tx.credit_debit_indicator === 'CRDT';
  const date = String(tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const signed = credit ? amount : -amount;
  const party = String((credit ? tx.debtor?.name : tx.creditor?.name) ?? '').trim();
  const remittance = (tx.remittance_information ?? []).join(' ').replace(/\s+/g, ' ').trim();
  const description = party || remittance.slice(0, 120) || 'Movimento bancario';
  const iban = (credit ? tx.debtor_account?.iban : tx.creditor_account?.iban) ?? '';
  const detail = [remittance && remittance !== description ? remittance : '', iban ? `IBAN ${iban}` : ''].filter(Boolean).join(' · ');
  const key = tx.transaction_id ?? tx.entry_reference ?? tx.reference_number ?? `${date}|${signed}|${description}`;
  const id = `bk:${crypto.createHash('sha1').update(`${conn.bank}|${account.uid}|${key}`).digest('hex').slice(0, 24)}`;
  const after = tx.balance_after_transaction?.amount;
  const t = makeTransaction({
    id, date, description, detail, amount: signed,
    extra: { currency: tx.transaction_amount?.currency, balance: after != null ? Number(after) : undefined, product: account.name || BANKS[conn.bank]?.label },
  }, rules, seen);
  t.source = 'banca';
  return t;
}

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

async function fetchAccount(client, uid, dateFrom) {
  const out = [];
  let key;
  for (let page = 0; page < 30; page++) {
    const res = await client.transactions(uid, { date_from: dateFrom, transaction_status: 'BOOK', continuation_key: key });
    out.push(...(res.transactions ?? []));
    key = res.continuation_key;
    if (!key) break;
  }
  return out;
}

// Scarica i movimenti registrati dal collegamento e aggiunge quelli nuovi.
// I movimenti già importati da CSV o PDF (stessa data e stesso importo) non si duplicano.
export async function syncConnection({ client, db, conn, now = Date.now() }) {
  const label = BANKS[conn.bank]?.label ?? conn.bank;
  if (Date.parse(conn.validUntil) <= now) throw new Error(`Il collegamento con ${label} è scaduto: ricollega la banca dalle Impostazioni.`);
  conn.calls = (conn.calls ?? []).filter((t) => t > now - DAY);
  if (conn.calls.length >= SYNCS_PER_DAY) throw new Error(`${label}: massimo ${SYNCS_PER_DAY} aggiornamenti al giorno (limite delle banche). Riprova più tardi.`);
  conn.calls.push(now);

  const all = (db.transactions ??= {});
  const fromFiles = new Map();
  for (const t of Object.values(all)) {
    if (String(t.id).startsWith('bk:')) continue;
    const k = `${t.date}|${t.amount}`;
    fromFiles.set(k, (fromFiles.get(k) ?? 0) + 1);
  }

  const since = conn.lastSync ? Date.parse(conn.lastSync) - OVERLAP_DAYS * DAY : now - FIRST_SYNC_DAYS * DAY;
  const report = { found: 0, added: 0, duplicates: 0 };
  const seen = new Map();
  for (const account of conn.accounts) {
    let list;
    try { list = await fetchAccount(client, account.uid, isoDay(since)); }
    catch (e) {
      if (conn.lastSync) throw e;
      list = await fetchAccount(client, account.uid, isoDay(now - FALLBACK_SYNC_DAYS * DAY)); // la banca non concede uno storico così lungo
    }
    const items = list.map((tx) => mapTransaction(tx, conn, account, db.rules ?? {}, seen)).filter(Boolean);
    items.sort((a, b) => a.date.localeCompare(b.date));
    for (const t of items) {
      report.found++;
      if (all[t.id]) { report.duplicates++; continue; }
      const k = `${t.date}|${t.amount}`;
      if ((fromFiles.get(k) ?? 0) > 0) { fromFiles.set(k, fromFiles.get(k) - 1); report.duplicates++; continue; }
      all[t.id] = { ...t, file: `Collegamento ${label}` };
      report.added++;
    }
  }
  conn.lastSync = new Date(now).toISOString();
  return report;
}

// Tutti i collegamenti attivi. Gli errori non fermano gli altri: si raccolgono per mostrarli.
// `minAgeMs`: salta i collegamenti letti da meno di così (l'aggiornamento automatico all'apertura dell'app non deve esaurire i 4 accessi al giorno).
export async function syncAll({ client, db, now = Date.now(), minAgeMs = 0 }) {
  const total = { found: 0, added: 0, duplicates: 0, skipped: 0, errors: [] };
  for (const conn of bankingState(db).connections) {
    if (minAgeMs && conn.lastSync && now - Date.parse(conn.lastSync) < minAgeMs) { total.skipped++; continue; }
    try {
      const r = await syncConnection({ client, db, conn, now });
      total.found += r.found; total.added += r.added; total.duplicates += r.duplicates;
    } catch (e) {
      total.errors.push({ source: BANKS[conn.bank]?.label ?? conn.bank, message: e.message });
    }
  }
  return total;
}
