import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { createFakeBank } from '../scripts/banca-finta.mjs';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

async function setup(t, { password = 'segreta' } = {}) {
  const bank = createFakeBank();
  const bankPort = await bank.listen(0);
  process.env.ENABLE_BANKING_API = `http://127.0.0.1:${bankPort}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mybank-'));
  const made = createApp({ dir, password });
  const server = await new Promise((r) => { const s = made.app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.close(); await bank.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  let cookie = '';
  const api = async (method, url, body) => {
    const res = await fetch(base + url, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, headers: res.headers, json: text.startsWith('{') ? JSON.parse(text) : null, text };
  };
  return { api, made, db: made.db, bank, base };
}

// collega una banca col giro completo: autorizzazione nella banca finta → ritorno all'app
async function link(ctx, bankKey) {
  const { json } = await ctx.api('POST', '/api/banks/link', { bank: bankKey });
  const auth = await fetch(json.url, { redirect: 'manual' }); // la banca finta rimanda all'app con il codice
  const cb = await fetch(auth.headers.get('location'), { redirect: 'manual' });
  return decodeURIComponent(cb.headers.get('location'));
}

test('senza accesso le API rifiutano; con la password si entra', async (t) => {
  const { api } = await setup(t);
  assert.equal((await api('GET', '/api/summary')).status, 401);
  assert.equal((await api('POST', '/api/login', { password: 'sbagliata' })).status, 401);
  const ok = await api('POST', '/api/login', { password: 'segreta' });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);
  assert.equal((await api('GET', '/api/summary')).status, 200);
  assert.equal((await api('GET', '/api/session')).json.ok, true);
});

test('il gettone dell\'app Android vale come il cookie', async (t) => {
  const { base, api } = await setup(t);
  const { json } = await api('POST', '/api/login', { password: 'segreta' });
  const res = await fetch(`${base}/api/widget`, { headers: { Authorization: `Bearer ${json.token}` } });
  assert.equal(res.status, 200);
  assert.equal((await fetch(`${base}/api/widget`, { headers: { Authorization: 'Bearer falso.falso' } })).status, 401);
});

test('collegamento di UniCredit e Revolut, tag dei pocket, storico, budget e widget', async (t) => {
  const ctx = await setup(t);
  const { api } = ctx;
  await api('POST', '/api/login', { password: 'segreta' });
  assert.equal((await api('POST', '/api/banks/link', { bank: 'revolut' })).status, 400); // mancano le credenziali

  const saved = await api('PUT', '/api/banks/app', { appId: 'app-di-prova', privateKey });
  assert.equal(saved.json.configured, true);
  assert.equal(JSON.stringify(saved.json).includes('PRIVATE KEY'), false); // la chiave non torna mai all'interfaccia

  assert.match(await link(ctx, 'unicredit'), /ok:UniCredit/);
  assert.match(await link(ctx, 'revolut'), /ok:Revolut/);

  const banks = (await api('GET', '/api/banks')).json;
  assert.equal(banks.connections.length, 2);
  const revolut = banks.connections.find((c) => c.bank === 'revolut');
  assert.deepEqual(revolut.accounts.map((a) => a.name).sort(), ['01 Spesa', '02 Svago', '03 Carburante', '04 Altro', 'Mario Rossi', 'Risparmi']);
  assert.deepEqual(banks.auto.hours, [5, 11, 14, 19]);
  assert.ok(banks.lastSync);

  // i tag arrivano dal pocket di provenienza
  const all = (await api('GET', '/api/transactions')).json;
  const byTag = (tag) => all.transactions.filter((x) => x.tag === tag);
  assert.ok(byTag('spesa').length > 0 && byTag('spesa').every((x) => x.amount < 0));
  assert.ok(byTag('svago').length > 0);
  assert.ok(byTag('carburante').length > 0);
  assert.ok(byTag('altro').length > 0);
  assert.ok(byTag('non_definito').length > 0); // Risparmi, conto principale, UniCredit
  assert.ok(byTag('giroconto').length > 0); // ricariche dei pocket e giro UniCredit → Revolut
  assert.deepEqual([...new Set(byTag('spesa').map((x) => x.account))], ['revolut-2']);
  assert.ok(byTag('entrata').every((x) => x.amount > 0));
  // lo stipendio di UniCredit è l'unica vera entrata; i giri tra i miei conti non lo sono
  assert.ok(byTag('entrata').some((x) => x.description === 'Azienda Esempio Srl'));
  assert.ok(!byTag('entrata').some((x) => x.description === 'Mario Rossi'));
  assert.ok(all.transactions.some((x) => x.pending)); // il pagamento in sospeso

  // storico dell'anno: entrate, uscite e bilancio per mese, senza i giroconti
  const year = new Date().getFullYear();
  const sum = (await api('GET', `/api/summary?year=${year}`)).json;
  assert.equal(sum.months.length, 12);
  assert.ok(sum.total.entrate > 0 && sum.total.uscite > 0);
  for (const m of sum.months) assert.ok(Math.abs(m.entrate - m.uscite - m.bilancio) < 0.01);
  assert.ok(Math.abs(sum.months.reduce((a, m) => a + m.bilancio, 0) - sum.total.bilancio) < 0.05);

  // tag a mano: una uscita «non definita» passa a Svago; poi si torna all'automatico
  const nd = byTag('non_definito').find((x) => x.amount < 0);
  assert.equal((await api('PUT', `/api/transactions/${nd.id}/tag`, { tag: 'svago' })).status, 200);
  assert.equal((await api('GET', '/api/transactions')).json.transactions.find((x) => x.id === nd.id).tag, 'svago');
  assert.equal((await api('PUT', `/api/transactions/${nd.id}/tag`, { tag: 'inesistente' })).status, 400);
  await api('PUT', `/api/transactions/${nd.id}/tag`, { tag: null });
  assert.equal((await api('GET', '/api/transactions')).json.transactions.find((x) => x.id === nd.id).tag, 'non_definito');

  // budget e widget
  assert.equal((await api('PUT', '/api/budgets', { spesa: '300,50', svago: '100', carburante: 80 })).status, 200);
  assert.equal((await api('PUT', '/api/budgets', { spesa: 'abc' })).status, 400);
  const w = (await api('GET', '/api/widget')).json;
  for (const k of ['spesa', 'svago', 'carburante']) {
    const c = w.cats[k];
    assert.equal(c.left, Math.round((c.budget - c.spent) * 100) / 100);
    assert.equal(c.estDaily, Math.round((c.budget / w.daysInMonth) * 100) / 100);
  }
  assert.equal(w.cats.spesa.budget, 300.5);
  assert.equal(w.daysLeft, w.daysInMonth - w.day);
  assert.ok(w.sundays.length >= 4 && w.sundays.length <= 5);
  assert.ok(w.lastSync);
});

test('l\'aggiornamento automatico conta a parte e si ferma a 4 al giorno; a mano si può ancora leggere', async (t) => {
  const ctx = await setup(t, { password: '' });
  const { api, made } = ctx;
  await api('PUT', '/api/banks/app', { appId: 'app-di-prova', privateKey });
  await link(ctx, 'unicredit');
  for (let i = 0; i < 4; i++) assert.deepEqual((await made.autoRead()).errors, []);
  assert.match((await made.autoRead()).errors[0], /limite di 4/);
  const manual = await api('POST', '/api/banks/sync', {});
  assert.equal(manual.status, 200);
  assert.deepEqual(manual.json.errors, []);
  assert.equal(manual.json.connections[0].left.auto, 0);
});

test('scollegare una banca toglie i suoi movimenti', async (t) => {
  const ctx = await setup(t);
  const { api } = ctx;
  await api('POST', '/api/login', { password: 'segreta' });
  await api('PUT', '/api/banks/app', { appId: 'app-di-prova', privateKey });
  await link(ctx, 'unicredit');
  await link(ctx, 'revolut');
  const id = (await api('GET', '/api/banks')).json.connections.find((c) => c.bank === 'unicredit').id;
  const after = await api('DELETE', `/api/banks/${id}`);
  assert.equal(after.json.connections.length, 1);
  assert.ok((await api('GET', '/api/transactions')).json.transactions.every((x) => x.bank === 'revolut'));
});

test("cambio password: serve quella attuale, la nuova vale subito, i vecchi accessi decadono", async (t) => {
  const { base, api } = await setup(t);
  const first = await api("POST", "/api/login", { password: "segreta" });
  const oldToken = first.json.token;

  assert.equal((await api("POST", "/api/password", { current: "sbagliata", next: "nuova-password" })).status, 400);
  assert.equal((await api("POST", "/api/password", { current: "segreta", next: "abcd" })).status, 400);

  const changed = await api("POST", "/api/password", { current: "segreta", next: "nuova-password" });
  assert.equal(changed.status, 200);
  // chi ha cambiato la password resta dentro; il gettone di prima non vale più
  assert.equal((await api("GET", "/api/summary")).status, 200);
  assert.equal((await fetch(`${base}/api/summary`, { headers: { Authorization: `Bearer ${oldToken}` } })).status, 401);
  assert.equal((await fetch(`${base}/api/summary`, { headers: { Authorization: `Bearer ${changed.json.token}` } })).status, 200);
  // la vecchia password (anche quella dell'ambiente) non entra più, la nuova sì
  assert.equal((await api("POST", "/api/login", { password: "segreta" })).status, 401);
  assert.equal((await api("POST", "/api/login", { password: "nuova-password" })).status, 200);
});

test("la password cambiata resta anche dopo il riavvio del server", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const first = createApp({ dir, password: "segreta" });
  const s1 = await new Promise((r) => { const s = first.app.listen(0, "127.0.0.1", () => r(s)); });
  const post = (port, url, body) => fetch(`http://127.0.0.1:${port}${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const login = await (await post(s1.address().port, "/api/login", { password: "segreta" })).json();
  const res = await fetch(`http://127.0.0.1:${s1.address().port}/api/password`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify({ current: "segreta", next: "dopo-il-riavvio" }) });
  assert.equal(res.status, 200);
  s1.close();
  const second = createApp({ dir, password: "segreta" });
  const s2 = await new Promise((r) => { const s = second.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => s2.close());
  assert.equal((await post(s2.address().port, "/api/login", { password: "segreta" })).status, 401);
  assert.equal((await post(s2.address().port, "/api/login", { password: "dopo-il-riavvio" })).status, 200);
});

test("la pagina non si tiene in cache e punta a script e stile con la versione", async (t) => {
  const { base } = await setup(t);
  const page = await fetch(`${base}/`);
  assert.equal(page.headers.get("cache-control"), "no-store");
  const html = await page.text();
  assert.match(html, /app\.js\?v=\d+\.\d+\.\d+/);
  assert.match(html, /style\.css\?v=\d+\.\d+\.\d+/);
  assert.ok(!html.includes("__V__"));
  assert.equal((await fetch(`${base}/app.js`)).headers.get("cache-control"), "no-cache");
});

test("gli orari dell'aggiornamento automatico si cambiano (da 1 a 4) e restano salvati", async (t) => {
  const { api, db } = await setup(t);
  await api("POST", "/api/login", { password: "segreta" });
  assert.deepEqual((await api("GET", "/api/banks")).json.auto.hours, [5, 11, 14, 19]);

  const ok = await api("PUT", "/api/banks/schedule", { hours: [19, 7, 7, 12] });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.auto.hours, [7, 12, 19]); // ordinati e senza doppioni
  assert.deepEqual(db.settings.autoHours, [7, 12, 19]);
  assert.equal(ok.json.auto.max, 4);
  const next = new Date(ok.json.auto.next);
  assert.ok(next.getTime() > Date.now());

  assert.equal((await api("PUT", "/api/banks/schedule", { hours: [] })).status, 400);
  assert.equal((await api("PUT", "/api/banks/schedule", { hours: [1, 2, 3, 4, 5] })).status, 400); // le banche concedono 4 accessi automatici
  assert.equal((await api("PUT", "/api/banks/schedule", { hours: [24] })).status, 400);
  assert.equal((await api("PUT", "/api/banks/schedule", { hours: ["a"] })).status, 400);
  assert.deepEqual((await api("GET", "/api/banks")).json.auto.hours, [7, 12, 19]); // i rifiuti non cambiano nulla
});

test("la password può avere 5 caratteri", async (t) => {
  const { api } = await setup(t);
  await api("POST", "/api/login", { password: "segreta" });
  assert.equal((await api("POST", "/api/password", { current: "segreta", next: "abcd" })).status, 400);
  assert.equal((await api("POST", "/api/password", { current: "segreta", next: "abcde" })).status, 200);
  assert.equal((await api("POST", "/api/login", { password: "abcde" })).status, 200);
});
