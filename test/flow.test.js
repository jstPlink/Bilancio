import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { applyCutoff } from '../src/banks.js';
import { TEXT } from './fixture-estratto.js';
import { importedVisible } from '../src/import.js';
import { contoWords, cartaWords } from './fixture-unicredit.js';
import { createFakeBank } from '../scripts/banca-finta.mjs';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

async function setup(t, { password = 'segreta' } = {}) {
  const bank = createFakeBank();
  const bankPort = await bank.listen(0);
  process.env.ENABLE_BANKING_API = `http://127.0.0.1:${bankPort}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mybank-'));
  const made = createApp({ dir, password, cutoff: '2000-01-01' }); // i test usano tutto lo storico della banca finta
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
  // «Utenze»: nessun movimento ci finisce da solo, ma si può scegliere a mano; non ha un budget
  const moves = (await api('GET', '/api/transactions')).json;
  assert.equal(moves.tags.utenze, 'Utenze');
  assert.ok(!moves.transactions.some((x) => x.tag === 'utenze'));
  assert.equal((await api('PUT', `/api/transactions/${nd.id}/tag`, { tag: 'utenze' })).status, 200);
  assert.equal((await api('GET', `/api/transactions?tag=utenze`)).json.transactions.length, 1);
  assert.ok(!('utenze' in (await api('GET', '/api/budgets')).json.month.cats));
  // «Ricorrente»: come «Utenze», solo a mano e senza budget
  assert.equal(moves.tags.ricorrente, 'Ricorrente');
  assert.ok(!moves.transactions.some((x) => x.tag === 'ricorrente'));
  assert.equal((await api('PUT', `/api/transactions/${nd.id}/tag`, { tag: 'ricorrente' })).status, 200);
  assert.equal((await api('GET', `/api/transactions?tag=ricorrente`)).json.transactions.length, 1);
  assert.ok(!('ricorrente' in (await api('GET', '/api/budgets')).json.month.cats));
  await api('PUT', `/api/transactions/${nd.id}/tag`, { tag: null });
  assert.equal((await api('GET', '/api/transactions')).json.transactions.find((x) => x.id === nd.id).tag, 'non_definito');

  // budget e widget
  assert.equal((await api('PUT', '/api/budgets', { spesa: '300,50', svago: '100', carburante: 80, altro: '60' })).status, 200);
  assert.equal((await api('PUT', '/api/budgets', { spesa: 'abc' })).status, 400);
  const w = (await api('GET', '/api/widget')).json;
  for (const k of ['spesa', 'svago', 'carburante', 'altro']) {
    const c = w.cats[k];
    assert.equal(c.left, Math.round((c.budget - c.spent) * 100) / 100);
    assert.equal(c.estDaily, Math.round((c.budget / w.daysInMonth) * 100) / 100);
  }
  assert.equal(w.cats.spesa.budget, 300.5);
  assert.equal(w.cats.altro.budget, 60);
  assert.equal(w.cats.altro.label, 'Altro');
  assert.equal(w.cats.altro.budget, 60);
  assert.equal(w.cats.altro.label, 'Altro');
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

test("si memorizzano solo i movimenti dal 1 agosto 2026: quelli di prima non si leggono e non si mostrano", async (t) => {
  const bank = createFakeBank();
  process.env.ENABLE_BANKING_API = `http://127.0.0.1:${await bank.listen(0)}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(async () => { await bank.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const made = createApp({ dir, password: "" }); // nessun cutoff: vale quello di base
  made.db.banking.app = { appId: "x", privateKey };
  const server = await new Promise((r) => { const s = made.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const { url } = await (await fetch(`${base}/api/banks/link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank: "unicredit" }) })).json();
  await fetch((await fetch(url, { redirect: "manual" })).headers.get("location"), { redirect: "manual" });
  const all = (await (await fetch(`${base}/api/transactions`)).json()).transactions;
  assert.ok(all.length > 0);
  assert.ok(all.every((x) => x.date >= "2026-08-01"));
  assert.equal((await (await fetch(`${base}/api/banks`)).json()).since, "2026-08-01");
  const sum = await (await fetch(`${base}/api/summary?year=2026`)).json();
  assert.ok(sum.months.slice(0, 7).every((m) => m.entrate === 0 && m.uscite === 0)); // gennaio-luglio vuoti
});

test("all'avvio i movimenti precedenti alla data di inizio si tolgono dai dati", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  fs.writeFileSync(path.join(dir, "mybank.json"), JSON.stringify({
    transactions: { a: { id: "a", date: "2026-07-31", amount: -5, account: "x", bank: "revolut", description: "Prima" }, b: { id: "b", date: "2026-08-01", amount: -7, account: "x", bank: "revolut", description: "Dopo" } },
    overrides: { a: "svago", b: "spesa" },
  }));
  const { db } = createApp({ dir, password: "" });
  assert.deepEqual(Object.keys(db.transactions), ["b"]);
  assert.deepEqual(Object.keys(db.overrides), ["b"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("statistiche di spesa: per categoria, mese per mese e dove vanno i soldi (senza giroconti ed entrate)", async (t) => {
  const ctx = await setup(t);
  const { api } = ctx;
  await api("POST", "/api/login", { password: "segreta" });
  await api("PUT", "/api/banks/app", { appId: "app-di-prova", privateKey });
  await link(ctx, "unicredit");
  await link(ctx, "revolut");

  const year = new Date().getFullYear();
  const st = (await api("GET", `/api/stats?year=${year}`)).json;
  assert.ok(st.total > 0 && st.count > 0);
  // la somma delle categorie è il totale; le quote fanno cento
  assert.ok(Math.abs(st.byTag.reduce((a, e) => a + e.total, 0) - st.total) < 0.05);
  assert.ok(Math.abs(st.byTag.reduce((a, e) => a + e.share, 0) - 100) < 0.5);
  assert.ok(st.byTag.every((e, i, all) => i === 0 || all[i - 1].total >= e.total)); // dalla più pesante
  assert.ok(st.byTag.every((e) => e.tag !== "giroconto" && e.tag !== "entrata"));
  // coincide con le uscite dello Storico
  const sum = (await api("GET", `/api/summary?year=${year}`)).json;
  assert.ok(Math.abs(sum.total.uscite - st.total) < 0.05);
  // mese per mese: dodici mesi, la somma è il totale dell'anno
  assert.equal(st.months.length, 12);
  assert.ok(Math.abs(st.months.reduce((a, m) => a + m.total, 0) - st.total) < 0.05);
  // dove vanno i soldi: fino a 8 voci, dalla più pesante
  assert.ok(st.top.length > 0 && st.top.length <= 8);
  assert.ok(st.top.every((p, i, all) => i === 0 || all[i - 1].total >= p.total));
  // un mese solo: il totale è quello di quel mese, il grafico resta di tutto l'anno
  const busy = st.months.filter((m) => m.total > 0).at(-1);
  const one = (await api("GET", `/api/stats?year=${year}&month=${busy.month}`)).json;
  assert.equal(one.total, busy.total);
  assert.equal(one.months.length, 12);
});

test("movimenti di un solo conto o pocket (tocco su una riga di Banche)", async (t) => {
  const ctx = await setup(t);
  const { api } = ctx;
  await api("POST", "/api/login", { password: "segreta" });
  await api("PUT", "/api/banks/app", { appId: "app-di-prova", privateKey });
  await link(ctx, "revolut");
  const all = (await api("GET", "/api/transactions")).json;
  assert.equal(all.account, null);
  const spesa = (await api("GET", "/api/transactions?account=revolut-2")).json;
  assert.deepEqual(spesa.account, { uid: "revolut-2", name: "01 Spesa" });
  assert.ok(spesa.transactions.length > 0 && spesa.transactions.length < all.transactions.length);
  assert.ok(spesa.transactions.every((x) => x.account === "revolut-2"));
  // i filtri si sommano: stesso pocket, solo le uscite taggate Spesa
  const only = (await api("GET", "/api/transactions?account=revolut-2&tag=spesa")).json;
  assert.ok(only.transactions.length > 0 && only.transactions.every((x) => x.tag === "spesa" && x.account === "revolut-2"));
  assert.equal((await api("GET", "/api/transactions?account=non-esiste")).json.transactions.length, 0);
});

test("statistiche: anche le entrate, il bilancio e da chi arrivano", async (t) => {
  const ctx = await setup(t);
  const { api } = ctx;
  await api("POST", "/api/login", { password: "segreta" });
  await api("PUT", "/api/banks/app", { appId: "app-di-prova", privateKey });
  await link(ctx, "unicredit");
  await link(ctx, "revolut");
  const year = new Date().getFullYear();
  const st = (await api("GET", `/api/stats?year=${year}`)).json;
  const sum = (await api("GET", `/api/summary?year=${year}`)).json;
  assert.ok(st.income.total > 0 && st.income.count > 0);
  assert.ok(Math.abs(st.income.total - sum.total.entrate) < 0.05); // come lo Storico
  assert.ok(Math.abs(st.balance - sum.total.bilancio) < 0.05);
  assert.ok(Math.abs(st.balance - (st.income.total - st.total)) < 0.02);
  assert.ok(Math.abs(st.months.reduce((a, m) => a + m.entrate, 0) - st.income.total) < 0.05);
  assert.ok(st.income.top.length > 0 && st.income.top.length <= 8);
  assert.ok(st.income.top.every((p, i, all) => i === 0 || all[i - 1].total >= p.total));
  assert.equal(st.income.top[0].name, "Azienda Esempio Srl"); // lo stipendio; i giri tra i miei conti non sono entrate
  assert.ok(!st.income.top.some((p) => p.name === "Mario Rossi")); // i giri tra i miei conti (giroconti) non sono entrate
});

test("anticipando la data di inizio, la prima lettura successiva rilegge tutto dalla nuova data", async (t) => {
  const ctx = await setup(t);
  const { api, db } = ctx;
  await api("POST", "/api/login", { password: "segreta" });
  await api("PUT", "/api/banks/app", { appId: "app-di-prova", privateKey });
  await link(ctx, "unicredit");
  const conn = db.banking.connections[0];
  assert.equal(conn.from, "2000-01-01"); // la lettura ricorda da quando ha letto
  // un collegamento letto prima dell'anticipo (senza «from») o con una data di inizio più tarda
  const before = Object.keys(db.transactions).length;
  for (const [id, x] of Object.entries(db.transactions)) if (x.date < "2026-01-01") delete db.transactions[id];
  const trimmed = Object.keys(db.transactions).length;
  assert.ok(trimmed < before);
  conn.from = "2026-10-01";
  assert.ok((await api("POST", "/api/banks/sync", {})).json.added > 0); // i movimenti tolti si rileggono (anche se lastSync è recente)
  assert.equal(conn.from, "2000-01-01");
  assert.equal(Object.keys(db.transactions).length, before);
});

test("ricorrenti: gruppi dal più vicino, annuali divisi per 12, promemoria nel server legati al gruppo, movimenti filtrati", async (t) => {
  const { api, db } = await setup(t);
  await api('POST', '/api/login', { password: 'segreta' });
  const { addMonths } = await import('../src/recurring.js');
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  const add = (date, amount, party) => { const id = `r${++n}`; db.transactions[id] = { id, bank: 'revolut', account: 'a1', date, amount: -amount, description: party, party, currency: 'EUR' }; return id; };
  for (let i = 0; i < 4; i++) add(addMonths(today, -i - 1), 12.99, 'Netflix');          // mensile
  add(addMonths(today, -14), 420, 'Assicurazione Auto'); add(addMonths(today, -2), 420, 'Assicurazione Auto'); // annuale
  for (let i = 0; i < 3; i++) add(addMonths(today, -i - 1), 17.99, 'Spotify');
  const once = add(addMonths(today, -1), 9.5, 'Rivista'); // un solo pagamento: non è ricorrente da solo
  add(addMonths(today, -3), 30, 'Cena'); add(addMonths(today, -1), 55, 'Cena');                    // importi diversi, irregolare
  const r = (await api('GET', '/api/recurring')).json;
  assert.deepEqual(r.groups.map((g) => g.name), ['Netflix', 'Spotify', 'Assicurazione Auto']); // dal prossimo pagamento più vicino
  const net = r.groups[0];
  assert.equal(net.amount, 12.99); assert.equal(net.annual, false); assert.equal(net.count, 4); assert.equal(net.active, true);
  assert.ok(net.next >= today);
  const ass = r.groups.find((g) => g.name === 'Assicurazione Auto');
  assert.equal(ass.annual, true); assert.equal(ass.monthly, 35); // 420 / 12
  assert.equal(r.totals.monthly, 65.98); assert.equal(r.totals.active, 3); assert.equal(r.totals.annual, 1); // 12,99 + 17,99 + 35
  // il tag «Ricorrente» a mano non crea un gruppo: il movimento resta «da assegnare»
  assert.equal((await api('PUT', `/api/transactions/${once}/tag`, { tag: 'ricorrente' })).status, 200);
  const after = (await api('GET', '/api/recurring')).json;
  assert.ok(!after.groups.some((g) => g.name === 'Rivista'));
  assert.deepEqual(after.unassigned.map((u) => [u.id, u.title, u.amount, u.suggest]), [[once, 'Rivista', 9.5, []]]);
  // promemoria: una notifica nel server legata al gruppo
  assert.equal((await api('PUT', `/api/recurring/${net.key}/reminder`, { text: 'Netflix: lo vuoi ancora?', day: 12, time: '9:00' })).status, 200);
  const notes = (await api('GET', '/api/notifications')).json.notifications;
  assert.deepEqual(notes.map((x) => [x.text, x.day, x.time, x.recurringKey]), [['Netflix: lo vuoi ancora?', 12, '09:00', net.key]]);
  assert.equal(db.notifications.length, 1);
  assert.deepEqual((await api('GET', '/api/recurring')).json.groups.find((g) => g.key === net.key).reminder, { id: notes[0].id, text: 'Netflix: lo vuoi ancora?', day: 12, time: '09:00' });
  await api('PUT', `/api/recurring/${net.key}/reminder`, { text: 'Netflix', day: 13, time: '10:30' }); // modifica: resta una sola notifica
  assert.equal(db.notifications.length, 1);
  await api('PUT', `/api/notifications/${notes[0].id}`, { text: 'Dalle Opzioni', day: 14, time: '11:00' });
  assert.equal(db.notifications[0].recurringKey, net.key); // modificarla dalle Opzioni non rompe il legame
  assert.equal((await api('PUT', '/api/recurring/zzz/reminder', { text: 'x', day: 1, time: '10:00' })).status, 404);
  // disattivare: il gruppo passa tra i non attivi e il promemoria sparisce
  const off = (await api('PUT', `/api/recurring/${net.key}/active`, { active: false })).json;
  assert.equal(off.groups.at(-1).key, net.key); assert.equal(off.groups.at(-1).active, false); assert.equal(off.groups.at(-1).reminder, null);
  assert.equal(db.notifications.length, 0);
  assert.equal(off.totals.active, 2); // Spotify e Assicurazione
  assert.equal((await api('PUT', `/api/recurring/${net.key}/reminder`, { text: 'x', day: 1, time: '10:00' })).status, 400); // non attivo
  assert.equal((await api('DELETE', `/api/recurring/${net.key}/reminder`)).status, 404);
  // a mano: si aggiunge e si toglie; gli altri si possono solo disattivare
  const man = await api('POST', '/api/recurring', { name: 'Dominio sito', amount: '14,99', annual: true, next: addMonths(today, 3) });
  assert.equal(man.status, 200);
  const mg = man.json.groups.find((g) => g.key === man.json.key);
  assert.deepEqual([mg.name, mg.amount, mg.annual, mg.manual, mg.monthly], ['Dominio sito', 14.99, true, true, 1.25]);
  for (const bad of [{ name: '', amount: 1, next: today }, { name: 'x', amount: 0, next: today }, { name: 'x', amount: 1, next: 'ieri' }]) assert.equal((await api('POST', '/api/recurring', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await api('DELETE', `/api/recurring/${net.key}`)).status, 404);
  assert.equal((await api('DELETE', `/api/recurring/${man.json.key}`)).status, 200);
  // Movimenti filtrati su un gruppo
  const moves = (await api('GET', `/api/transactions?recurring=${net.key}`)).json;
  assert.equal(moves.total, 4); assert.ok(moves.transactions.every((x) => x.description === 'Netflix'));
  // assegnare un movimento a un ricorrente: lo stesso importo con un altro nome viene suggerito, il movimento prende il tag e conta nello storico
  const apple = add(addMonths(today, -1), 12.99, 'Apple Bill');
  await api('PUT', `/api/transactions/${apple}/tag`, { tag: 'ricorrente' });
  const sug = (await api('GET', `/api/recurring?tx=${apple}`)).json;
  assert.deepEqual(sug.unassigned.find((u) => u.id === apple).suggest, [{ key: net.key, why: 'importo' }]);
  assert.deepEqual(sug.suggest, [{ key: net.key, why: 'importo' }]);
  const ass2 = await api('PUT', '/api/recurring/assign', { ids: [apple, once], key: net.key });
  assert.equal(ass2.status, 200);
  assert.equal(db.recurringLinks[apple], net.key);
  assert.equal(ass2.json.groups.find((g) => g.key === net.key).count, 6);
  assert.deepEqual(ass2.json.unassigned, []);
  assert.ok(ass2.json.groups.find((g) => g.key === net.key).payments.some((p) => p.id === apple && p.explicit));
  const tagged = (await api('GET', '/api/transactions?tag=ricorrente')).json;
  assert.deepEqual(tagged.transactions.map((x) => [x.id, x.recurring?.key]).sort(), [[apple, net.key], [once, net.key]].sort());
  assert.equal(tagged.totals.unassigned, 0);
  assert.equal((await api('GET', `/api/transactions?recurring=${net.key}`)).json.total, 6);
  // scollegare: tornano «da assegnare», il tag resta
  const un = await api('PUT', '/api/recurring/assign', { ids: [apple], key: null });
  assert.deepEqual(un.json.unassigned.map((u) => u.id), [apple]);
  assert.equal((await api('GET', '/api/transactions?tag=ricorrente')).json.totals.unassigned, 1);
  assert.equal((await api('PUT', '/api/recurring/assign', { ids: [apple], key: 'zzz' })).status, 404);
  assert.equal((await api('PUT', '/api/recurring/assign', { ids: [], key: net.key })).status, 400);
  assert.equal((await api('PUT', '/api/recurring/assign', { ids: ['inesistente'], key: net.key })).status, 400);
  // nuovo ricorrente da un movimento: nasce già con quel pagamento
  const fresh = await api('POST', '/api/recurring', { name: 'Apple Bill', amount: '12,99', annual: false, next: addMonths(today, 1), assign: [apple] });
  assert.equal(fresh.status, 200);
  const fg = fresh.json.groups.find((g) => g.key === fresh.json.key);
  assert.deepEqual([fg.name, fg.count, fg.manual, fg.payments[0].id], ['Apple Bill', 1, true, apple]);
  assert.deepEqual(fresh.json.unassigned, []);
  // eliminare il ricorrente a mano scollega i suoi movimenti
  assert.equal((await api('DELETE', `/api/recurring/${fresh.json.key}`)).status, 200);
  assert.equal(db.recurringLinks[apple], undefined);
});

test("notifiche: testo, giorno del mese e orario si salvano nel server", async (t) => {
  const { api, db } = await setup(t);
  assert.equal((await api("GET", "/api/notifications")).status, 401);
  await api("POST", "/api/login", { password: "segreta" });
  assert.deepEqual((await api("GET", "/api/notifications")).json.notifications, []);

  const made = await api("POST", "/api/notifications", { text: "  Paga   l'affitto ", day: 5, time: "9:30" });
  assert.equal(made.status, 200);
  const [n] = made.json.notifications;
  assert.deepEqual({ text: n.text, day: n.day, time: n.time }, { text: "Paga l'affitto", day: 5, time: "09:30" });
  assert.ok(n.id);
  assert.equal(db.notifications.length, 1); // sta nei dati del server

  for (const bad of [{ text: "", day: 5, time: "09:00" }, { text: "x", day: 0, time: "09:00" }, { text: "x", day: 32, time: "09:00" }, { text: "x", day: 1.5, time: "09:00" }, { text: "x", day: 5, time: "24:00" }, { text: "x", day: 5, time: "9" }, { text: "x".repeat(201), day: 5, time: "09:00" }]) {
    assert.equal((await api("POST", "/api/notifications", bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await api("GET", "/api/notifications")).json.notifications.length, 1);

  const edited = await api("PUT", `/api/notifications/${n.id}`, { text: "Bolletta", day: 31, time: "18:05" });
  assert.deepEqual(edited.json.notifications.map((x) => [x.id, x.text, x.day, x.time]), [[n.id, "Bolletta", 31, "18:05"]]);
  assert.equal((await api("PUT", "/api/notifications/zzz", { text: "x", day: 1, time: "10:00" })).status, 404);

  assert.equal((await api("DELETE", `/api/notifications/${n.id}`)).json.notifications.length, 0);
  assert.equal((await api("DELETE", `/api/notifications/${n.id}`)).status, 404);
});

// Un Seafile finto: elenco di una cartella condivisa e caricamento con un link di caricamento.
async function fakeSeafile() {
  const http = await import("node:http");
  const uploads = [];
  const downloads = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const json = (o, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (url.pathname === "/api/v2.1/share-links/UNI1/dirents/") {
      const at = "2026-09-30T10:00:00+00:00";
      if (url.searchParams.get("path") === "/2024/") return json({ dirent_list: [
        { is_dir: false, file_name: "Estratto conto 2024.10 - 2024.12.pdf", file_path: "/2024/Estratto conto 2024.10 - 2024.12.pdf", size: 900, last_modified: at },
        { is_dir: false, file_name: "Estratto Conto Carte Flexia 2024.12.pdf", file_path: "/2024/Estratto Conto Carte Flexia 2024.12.pdf", size: 800, last_modified: at },
      ] });
      return json({ dirent_list: [{ is_dir: true, folder_name: "2024", folder_path: "/2024/", size: 0, last_modified: at }] });
    }
    if (url.pathname === "/d/UNI1/files/" && url.searchParams.get("dl") === "1") { downloads.push(url.searchParams.get("p")); res.writeHead(200, { "Content-Type": "application/pdf" }); return res.end(Buffer.from(url.searchParams.get("p").includes("Flexia") ? "CARTA" : "CONTO")); }
    if (url.pathname === "/api/v2.1/share-links/PAY1/dirents/") {
      const at = "2026-09-30T10:00:00+00:00";
      if (url.searchParams.get("path") === "/2025/") return json({ dirent_list: [{ is_dir: false, file_name: "Busta Paga IGF 2025.12.pdf", file_path: "/2025/Busta Paga IGF 2025.12.pdf", size: 900, last_modified: at }, { is_dir: false, file_name: "Tredic.ma IGF 2025.pdf", file_path: "/2025/Tredic.ma IGF 2025.pdf", size: 800, last_modified: at }] });
      return json({ dirent_list: [
        { is_dir: true, folder_name: "2025", folder_path: "/2025/", size: 0, last_modified: at },
        { is_dir: false, file_name: "Busta Paga IGF 2026.06.pdf", file_path: "/Busta Paga IGF 2026.06.pdf", size: 1000, last_modified: at },
        { is_dir: false, file_name: "Busta Paga IGF 2026.09.pdf", file_path: "/Busta Paga IGF 2026.09.pdf", size: 1000, last_modified: at },
        { is_dir: false, file_name: "Note.txt", file_path: "/Note.txt", size: 10, last_modified: at },
      ] });
    }
    if (url.pathname === "/d/PAY1/files/" && url.searchParams.get("dl") === "1") { downloads.push(url.searchParams.get("p")); res.writeHead(200, { "Content-Type": "application/pdf" }); return res.end(Buffer.from(`NETTO=${url.searchParams.get("p").includes("Tredic") ? 1116 : url.searchParams.get("p").includes("2025") ? 2899 : 2577}`)); }
    if (url.pathname === "/api/v2.1/share-links/ABC123/dirents/" && url.searchParams.get("path") === "/2025/") {
      return json({ dirent_list: [{ is_dir: false, file_name: "Estratto conto 2025.12.pdf", file_path: "/2025/Estratto conto 2025.12.pdf", size: 700, last_modified: "2026-01-02T10:00:00+00:00" }] });
    }
    if (url.pathname === "/api/v2.1/share-links/ABC123/dirents/" && url.searchParams.get("path") !== "/") return json({ dirent_list: [] });
    if (url.pathname === "/api/v2.1/share-links/ABC123/dirents/") {
      return json({ dirent_list: [
        { is_dir: true, folder_name: "2025", folder_path: "/2025/", size: 0, last_modified: "2026-01-02T10:00:00+00:00" },
        { is_dir: false, file_name: "Estratto conto 2026.09.pdf", file_path: "/Estratto conto 2026.09.pdf", size: 3000, last_modified: "2026-09-30T18:49:03+00:00" },
        { is_dir: false, file_name: "Estratto Conto Carte Flexia 2026.06.pdf", file_path: "/Estratto Conto Carte Flexia 2026.06.pdf", size: 500, last_modified: "2026-09-30T18:49:03+00:00" },
        { is_dir: false, file_name: "Estratto conto 2026.05.pdf", file_path: "/Estratto conto 2026.05.pdf", size: 1000, last_modified: "2026-09-30T18:47:03+00:00" },
        { is_dir: false, file_name: "Estratto conto 2026.06.pdf", file_path: "/Estratto conto 2026.06.pdf", size: 2000, last_modified: "2026-09-30T18:48:03+00:00" },
        { is_dir: true, folder_name: "Vecchi", folder_path: "/Vecchi/", size: 0, last_modified: "2026-01-02T10:00:00+00:00" },
      ] });
    }
    if (url.pathname === "/api/v2.1/share-links/ABC123/upload/") return json({ upload_link: `http://${req.headers.host}/seafhttp/upload-api/xyz` });
    if (url.pathname === "/api/v2.1/share-links/NOUP/upload/") return json({ error_msg: "Permission denied." }, 403);
    if (url.pathname === "/d/ABC123/files/" && url.searchParams.get("dl") === "1") { downloads.push(url.searchParams.get("p")); res.writeHead(200, { "Content-Type": "application/pdf" }); return res.end(Buffer.from("%PDF-finto " + url.searchParams.get("p"))); }
    if (url.pathname === "/seafhttp/upload-api/xyz" && req.method === "POST") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => { uploads.push(Buffer.concat(chunks).toString("latin1")); json([{ name: "ok" }]); });
      return;
    }
    json({ error: "no" }, 404);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, uploads, downloads, close: () => new Promise((r) => server.close(r)) };
}

test("documenti: tre cartelle online (elenco dei file, apertura su Seafile, caricamento con il nome scelto)", async (t) => {
  const { api, db, base } = await setup(t);
  const sf = await fakeSeafile();
  t.after(() => sf.close());
  assert.equal((await api("GET", "/api/documents")).status, 401);
  const token = (await api("POST", "/api/login", { password: "segreta" })).json.token;
  const first = (await api("GET", "/api/documents")).json.links;
  assert.deepEqual(first.map((l) => [l.key, l.label, l.url]), [["payslips", "Buste paga", ""], ["statements", "Estratti conto", ""], ["bills", "Bollette", ""]]);

  const saved = await api("PUT", "/api/documents", { statements: { url: `${sf.base}/d/ABC123/` }, payslips: " esempio.test/d/PAY1/ ", bills: { url: `${sf.base}/d/NOUP/` } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.json.links.map((l) => l.url), ["https://esempio.test/d/PAY1/", `${sf.base}/d/ABC123/`, `${sf.base}/d/NOUP/`]); // senza schema si aggiunge https
  assert.equal(db.settings.documents.statements.url, `${sf.base}/d/ABC123/`); // sta nei dati del server
  assert.equal((await api("PUT", "/api/documents", { bills: { url: "javascript:alert(1)" } })).status, 400);
  assert.equal((await api("PUT", "/api/documents", { bills: { url: "ftp://esempio.test/x" } })).status, 400);
  // un campo non inviato resta com'è; uno vuoto si cancella
  assert.equal((await api("PUT", "/api/documents", { payslips: { url: "" } })).json.links[0].url, "");
  assert.deepEqual(Object.keys((await api("GET", "/api/documents")).json.links[1]), ["key", "label", "url"]); // un solo LINK per categoria

  // elenco: solo i file, i più recenti per nome in alto, ognuno con l'indirizzo per aprirlo su Seafile
  const list = await api("GET", "/api/documents/statements/files");
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.files.map((f) => f.name), ["Estratto Conto Carte Flexia 2026.06.pdf", "Estratto conto 2026.09.pdf", "Estratto conto 2026.06.pdf", "Estratto conto 2026.05.pdf", "Estratto conto 2025.12.pdf"]); // anche la sottocartella, dopo la radice
  assert.deepEqual(list.json.files.map((f) => f.folder), ["", "", "", "", "2025"]);
  assert.equal(list.json.files[4].url, `${sf.base}/d/ABC123/files/?p=${encodeURIComponent("/2025/Estratto conto 2025.12.pdf")}`);
  assert.equal(list.json.files[2].url, `${sf.base}/d/ABC123/files/?p=${encodeURIComponent("/Estratto conto 2026.06.pdf")}`);
  assert.deepEqual(list.json.files.map((f) => f.statement?.state), ["banca", "banca", "banca", "banca", "banca"]); // qui la data di inizio è il 2000: tutti li legge la banca; l'estratto della carta non è mensile
  assert.equal((await api("GET", "/api/documents/payslips/files")).status, 400); // la cartella non risponde
  assert.equal((await api("GET", "/api/documents/boh/files")).status, 400);

  // caricamento con un nome scelto dall'utente (il corpo è il file)
  const up = (name, body, key = "statements") => fetch(`${base}/api/documents/${key}/files?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "application/pdf", Authorization: `Bearer ${token}` }, body });
  const ok = await up("Estratto conto 2026.07.pdf", Buffer.from("%PDF-finto-contenuto"));
  assert.equal(ok.status, 200);
  assert.equal(sf.uploads.length, 1);
  assert.match(sf.uploads[0], /name="parent_dir"\r\n\r\n\/\r\n/);
  assert.match(sf.uploads[0], /filename="Estratto conto 2026\.07\.pdf"/);
  assert.match(sf.uploads[0], /%PDF-finto-contenuto/);
  assert.equal((await up("../fuori.pdf", Buffer.from("x"))).status, 400); // niente cartelle nel nome
  assert.equal((await up("   ", Buffer.from("x"))).status, 400);
  assert.equal((await up("a.pdf", Buffer.alloc(0))).status, 400);
  const denied = await up("a.pdf", Buffer.from("x"), "bills"); // il link non ha il permesso di caricamento
  assert.equal(denied.status, 400);
  assert.match((await denied.json()).error, /non permette di caricare/);
  await api("PUT", "/api/documents", { bills: { url: "" } });
  assert.equal((await up("a.pdf", Buffer.from("x"), "bills")).status, 400); // nessun link
  assert.equal(sf.uploads.length, 1);
});

test("importazione da estratto conto: restano anche prima della data di inizio, non si duplicano, non toccano i mesi letti dalla banca", async (t) => {
  const bank = createFakeBank();
  process.env.ENABLE_BANKING_API = `http://127.0.0.1:${await bank.listen(0)}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(async () => { await bank.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const made = createApp({ dir, password: "segreta" }); // data di inizio di base: 1 agosto 2026
  const server = await new Promise((r) => { const s = made.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (body) => fetch(`${base}/api/import`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${made.token ?? ""}`, Cookie: cookie }, body: JSON.stringify(body) });
  let cookie = "";
  const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "segreta" }) });
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(`${base}/api/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);

  const item = (key, date, amount, extra = {}) => ({ bank: "revolut", account: "estratto:revolut:conto", accountLabel: "Conto (estratto)", key, date, amount, description: "Esselunga", ...extra });
  const busta = { bank: "busta", account: "busta:paga", accountLabel: "Busta paga", key: "2026-06", date: "2026-06-30", amount: 2577, description: "Stipendio giugno 2026" };
  const batch = { transactions: [item("a", "2026-06-10", -25.5), item("b", "2026-06-11", 100, { description: "Pagamento da Mario", party: "Mario" }), item("c", "2026-08-02", -9), busta] };
  const first = await (await post(batch)).json();
  assert.deepEqual(first, { added: 3, updated: 0, skipped: 1 }); // quello di agosto lo legge la banca
  assert.deepEqual(await (await post(batch)).json(), { added: 0, updated: 3, skipped: 1 }); // di nuovo: nessun duplicato

  const june = (await (await fetch(`${base}/api/transactions?year=2026&month=6`, { headers: { Cookie: cookie } })).json()).transactions;
  assert.equal(june.length, 3);
  const pay = june.find((x) => x.bank === "busta"); // la busta paga è un'entrata con il netto del mese
  assert.deepEqual([pay.amount, pay.tag, pay.accountName, pay.date], [2577, "entrata", "Busta paga", "2026-06-30"]);
  assert.equal(june.find((x) => x.amount === -25.5).accountName, "Conto (estratto)");
  assert.equal(june.find((x) => x.amount === 100).tag, "entrata");
  assert.equal((await (await fetch(`${base}/api/summary?year=2026`, { headers: { Cookie: cookie } })).json()).months[5].uscite, 25.5);

  // la data di inizio non li cancella, né all'avvio né dopo una lettura
  assert.equal(applyCutoff(made.db), 0);
  assert.equal(Object.keys(made.db.transactions).length, 3);
  // dati non validi
  for (const bad of [{ transactions: [] }, { transactions: [item("x", "10/06/2026", 5)] }, { transactions: [item("x", "2026-06-10", 0)] }, { transactions: [{ ...item("x", "2026-06-10", 5), bank: "boh" }] }, { transactions: [item("", "2026-06-10", 5)] }]) {
    assert.equal((await post(bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
});

test("estratti conto: i nuovi si leggono da soli fino a luglio, da agosto no; si possono mostrare solo alcuni mesi (qui solo giugno)", async (t) => {
  const sf = await fakeSeafile();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(async () => { await sf.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  let reads = 0;
  // il testo di ogni estratto: lo stesso fatto in giugno per il file di giugno e spostato a maggio per quello di maggio
  const pdfToText = async (buffer) => { reads++; return /2026\.05/.test(buffer.toString()) ? TEXT.replaceAll(" giu 2026", " mag 2026").replace(/giugno 2026/g, "maggio 2026").replaceAll("ID transazione: ", "ID transazione: maggio-") : TEXT; };
  const wordsOf = async () => { throw new Error("PDF non leggibile"); }; // la carta Flexia qui non si legge (si prova a parte)
  const made = createApp({ dir, password: "", pdfToText, wordsOf }); // data di inizio di base: 1 agosto 2026
  made.db.settings.documents = { statements: { url: `${sf.base}/d/ABC123/` } };
  assert.equal(importedVisible(made.db), null); // di base si mostrano tutti i mesi
  made.db.settings.importedVisible = ["2026-06"]; // qui si prova il nascondere: solo giugno
  const server = await new Promise((r) => { const s = made.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => (await fetch(`${base}${p}`)).json();

  const list = await get("/api/documents/statements/files");
  // giugno e maggio si leggono; settembre no (lo legge la banca) e non si scarica nemmeno; l'estratto della carta non è mensile
  assert.deepEqual(list.files.map((f) => [f.name, f.statement?.state]), [["Estratto Conto Carte Flexia 2026.06.pdf", "errore"], ["Estratto conto 2026.09.pdf", "banca"], ["Estratto conto 2026.06.pdf", "letto"], ["Estratto conto 2026.05.pdf", "letto"], ["Estratto conto 2025.12.pdf", "letto"]]); // anche la sottocartella e la carta (qui non leggibile)
  assert.deepEqual(sf.downloads.sort(), ["/2025/Estratto conto 2025.12.pdf", "/Estratto Conto Carte Flexia 2026.06.pdf", "/Estratto conto 2026.05.pdf", "/Estratto conto 2026.06.pdf"]);
  assert.deepEqual(list.read.map((r) => r.name).sort(), ["2025/Estratto conto 2025.12.pdf", "Estratto Conto Carte Flexia 2026.06.pdf", "Estratto conto 2026.05.pdf", "Estratto conto 2026.06.pdf"]);
  assert.equal(Object.keys(made.db.transactions).length, 10); // 5 di giugno + 5 di maggio, tutti salvati
  assert.equal(list.files[2].statement.visible, true); // giugno si mostra
  assert.equal(list.files[3].statement.visible, false); // maggio è letto ma nascosto per ora

  // un'altra apertura dell'elenco non rilegge nulla
  const again = await get("/api/documents/statements/files");
  assert.equal(again.read.length, 0);
  assert.equal(reads, 3); // giugno, maggio e quello della sottocartella, una volta sola

  // si mostrano solo i movimenti di giugno, in ogni schermata
  const all = await get("/api/transactions");
  assert.equal(all.total, 5);
  assert.ok(all.transactions.every((x) => x.date.startsWith("2026-06")));
  const sum = await get("/api/summary?year=2026");
  assert.equal(sum.months[4].entrate + sum.months[4].uscite, 0); // maggio vuoto
  assert.ok(sum.months[5].uscite > 0); // giugno pieno
  assert.equal((await get("/api/transactions?year=2026&month=5")).total, 0);

  // quando si deciderà di mostrare maggio, ci sono già tutti i suoi movimenti
  made.db.settings.importedVisible = ["2026-05", "2026-06"];
  assert.equal((await get("/api/transactions")).total, 10);

  // lettura a mano per riprovare
  const retry = await fetch(`${base}/api/documents/statements/import?name=${encodeURIComponent("Estratto conto 2026.06.pdf")}`, { method: "POST" });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).updated, 5);
  assert.equal((await fetch(`${base}/api/documents/statements/import?name=${encodeURIComponent("Estratto Conto Carte Flexia 2026.06.pdf")}`, { method: "POST" })).status, 400); // la carta qui non si legge
  assert.equal((await fetch(`${base}/api/documents/statements/import?path=${encodeURIComponent("2025/Estratto conto 2025.12.pdf")}`, { method: "POST" })).status, 200); // il percorso con la sottocartella
  assert.equal((await fetch(`${base}/api/documents/statements/import?name=${encodeURIComponent("Note.txt")}`, { method: "POST" })).status, 400); // non è un estratto
});

test("estratti conto: se un estratto non si legge, l'errore resta registrato e non si riprova finché il file non cambia", async (t) => {
  const sf = await fakeSeafile();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(async () => { await sf.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  let reads = 0;
  const made = createApp({ dir, password: "", pdfToText: async () => { reads++; throw new Error("PDF illeggibile"); }, wordsOf: async () => { throw new Error("PDF illeggibile"); } });
  made.db.settings.documents = { statements: { url: `${sf.base}/d/ABC123/` } };
  const server = await new Promise((r) => { const s = made.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const first = await (await fetch(`${base}/api/documents/statements/files`)).json();
  assert.deepEqual(first.files[2].statement, { state: "errore", error: "PDF illeggibile" });
  await fetch(`${base}/api/documents/statements/files`);
  assert.equal(reads, 3); // giugno, maggio e quello della sottocartella, una volta sola
  assert.equal(Object.keys(made.db.transactions).length, 0);
  // con un lettore migliorato (versione diversa) gli estratti falliti si ritentano
  for (const r of Object.values(made.db.settings.statementsRead)) if (r.error) r.parser = 0;
  await fetch(`${base}/api/documents/statements/files`);
  assert.equal(reads, 6);
});

test("buste paga: le nuove si leggono da sole (anche nelle sottocartelle) e diventano entrate; da agosto no", async (t) => {
  const sf = await fakeSeafile();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(async () => { await sf.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  let reads = 0;
  const payslipNet = async (buffer) => { reads++; return Number(/NETTO=(\d+)/.exec(buffer.toString())[1]); }; // al posto dell'OCR
  const made = createApp({ dir, password: "", payslipNet });
  made.db.settings.documents = { payslips: { url: `${sf.base}/d/PAY1/` } };
  const server = await new Promise((r) => { const s = made.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => (await fetch(`${base}${p}`)).json();

  const first = await get("/api/documents/payslips/files"); // risponde subito; la lettura va in sottofondo
  assert.deepEqual(first.files.map((f) => [f.folder, f.name]), [["", "Note.txt"], ["", "Busta Paga IGF 2026.09.pdf"], ["", "Busta Paga IGF 2026.06.pdf"], ["2025", "Tredic.ma IGF 2025.pdf"], ["2025", "Busta Paga IGF 2025.12.pdf"]]);
  for (let i = 0; i < 100 && (await get("/api/documents/payslips/files")).busy; i++) await new Promise((r) => setTimeout(r, 20));
  const list = await get("/api/documents/payslips/files");
  assert.equal(list.busy, false);
  assert.deepEqual(list.files.map((f) => f.payslip?.state), [undefined, "banca", "letto", "letto", "letto"]);
  assert.deepEqual(list.files.filter((f) => f.payslip?.state === "letto").map((f) => f.payslip.amount), [2577, 1116, 2899]);
  assert.equal(reads, 3); // la busta di settembre non si scarica nemmeno
  assert.ok(!sf.downloads.some((p) => p.includes("2026.09")));

  // sono entrate nei movimenti: conto «Busta paga», data nel mese, senza duplicati
  const all = await get("/api/transactions");
  assert.equal(all.total, 3);
  const june = all.transactions.find((x) => x.description === "Stipendio Giugno 2026");
  assert.deepEqual([june.amount, june.date, june.tag, june.accountName, june.bank], [2577, "2026-06-30", "entrata", "Busta paga", "busta"]);
  assert.deepEqual(all.transactions.map((x) => x.description).sort(), ["Stipendio Dicembre 2025", "Stipendio Giugno 2026", "Tredicesima 2025"]);
  assert.deepEqual((await get("/api/summary?year=2025")).years, [2026, 2025]); // l'anno 2025 compare nello Storico
  await get("/api/documents/payslips/files");
  assert.equal(reads, 3); // già lette: non si rileggono
  assert.equal(Object.keys(made.db.transactions).length, 3);
});

test("movimenti: ordinati per data o importo (nei due versi) e con i totali di entrate e uscite", async (t) => {
  const { api, db } = await setup(t);
  await api("POST", "/api/login", { password: "segreta" });
  const add = (id, date, amount, description, account = "x") => { db.transactions[id] = { id, bank: "revolut", account, date, amount, description, currency: "EUR" }; };
  add("a", "2026-05-10", -30, "Bar");
  add("b", "2026-05-12", 1500, "Stipendio");
  add("c", "2026-05-11", -5.5, "Zucchero");
  add("d", "2026-05-12", -200, "Affitto");
  db.overrides.a = "svago"; db.overrides.c = "spesa"; db.overrides.d = "utenze";
  const order = async (q) => (await api("GET", `/api/transactions${q}`)).json.transactions.map((x) => x.id).join("");
  assert.equal(await order(""), "bdca"); // di base: per data, dal più recente (a parità, per id)
  assert.equal(await order("?sort=date&dir=asc"), "acbd");
  assert.equal(await order("?sort=amount"), "bcad"); // importo: dal più alto (di base)
  assert.equal(await order("?sort=amount&dir=asc"), "dacb");
  assert.equal(await order("?sort=boh&dir=su"), "bdca"); // valori sconosciuti (anche titolo e categoria, non più ordinabili): si torna all'ordine di base
  assert.equal(await order("?sort=tag"), "bdca");
  // totali di tutti i movimenti filtrati
  const all = (await api("GET", "/api/transactions")).json;
  assert.deepEqual(all.totals, { entrate: 1500, uscite: 235.5 });
  assert.deepEqual((await api("GET", "/api/transactions?tag=entrata")).json.totals, { entrate: 1500, uscite: 0 });
  assert.deepEqual((await api("GET", "/api/transactions?tag=svago")).json.totals, { entrate: 0, uscite: 30 });
});

test("movimenti: a pagine (limit e offset), per mostrarne 200 alla volta quando sono più di 1000", async (t) => {
  const { api, db } = await setup(t);
  await api("POST", "/api/login", { password: "segreta" });
  for (let i = 1; i <= 7; i++) db.transactions[`t${i}`] = { id: `t${i}`, bank: "revolut", account: "x", date: `2026-05-${String(i).padStart(2, "0")}`, amount: -i, description: `Mov ${i}`, currency: "EUR" };
  const ids = async (q) => { const r = (await api("GET", `/api/transactions${q}`)).json; return [r.transactions.map((x) => x.id).join(","), r.total, r.offset]; };
  assert.deepEqual(await ids(""), ["t7,t6,t5,t4,t3,t2,t1", 7, 0]); // di base: tutti (fino a 1000)
  assert.deepEqual(await ids("?limit=3"), ["t7,t6,t5", 7, 0]);
  assert.deepEqual(await ids("?limit=3&offset=3"), ["t4,t3,t2", 7, 3]);
  assert.deepEqual(await ids("?limit=3&offset=6"), ["t1", 7, 6]);
  assert.deepEqual(await ids("?limit=3&offset=9"), ["", 7, 9]);
  assert.deepEqual(await ids("?limit=5000&offset=-4"), ["t7,t6,t5,t4,t3,t2,t1", 7, 0]); // limiti sensati
  assert.equal((await api("GET", "/api/transactions?limit=2&sort=amount&dir=asc")).json.transactions.map((x) => x.id).join(), "t7,t6"); // l'ordine vale anche a pagine
});

test("estratti UniCredit (conto trimestrale e carta Flexia) nelle sottocartelle: si leggono da soli e l'addebito della carta non si conta due volte", async (t) => {
  const sf = await fakeSeafile();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mybank-"));
  t.after(async () => { await sf.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const wordsOf = async (buffer) => (buffer.toString() === "CARTA" ? cartaWords() : contoWords());
  const made = createApp({ dir, password: "", wordsOf });
  made.db.settings.documents = { statements: { url: `${sf.base}/d/UNI1/` } };
  const server = await new Promise((r) => { const s = made.app.listen(0, "127.0.0.1", () => r(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => (await fetch(`${base}${p}`)).json();

  const list = await get("/api/documents/statements/files");
  assert.deepEqual(list.files.map((f) => [f.path, f.statement?.state, f.statement?.count]), [["2024/Estratto Conto Carte Flexia 2024.12.pdf", "letto", 1], ["2024/Estratto conto 2024.10 - 2024.12.pdf", "letto", 3]]);
  assert.equal(Object.keys(made.db.transactions).length, 4); // 3 del conto + 1 della carta

  const all = await get("/api/transactions");
  const byDesc = Object.fromEntries(all.transactions.map((x) => [x.description, x]));
  assert.equal(byDesc["BONIFICO A VOSTRO FAVORE"].tag, "entrata");
  assert.equal(byDesc["PAGAMENTO PER UTILIZZO CARTE DI CREDITO"].tag, "giroconto"); // di dicembre 2024 c'è l'estratto della carta
  assert.equal(byDesc["Pagamento E-Commerce BAR ROMA"].accountName, "Carta Flexia (estratto)");
  assert.equal(byDesc["Pagamento E-Commerce BAR ROMA"].tag, "non_definito");
  assert.deepEqual(all.totals, { entrate: 1500, uscite: 40 }); // 20 con la carta di debito + 20 con la carta di credito; l'addebito di 50 non conta
  // di nuovo: nessun duplicato
  await get("/api/documents/statements/files");
  assert.equal(Object.keys(made.db.transactions).length, 4);
});

test("il tag dei giri tra i propri conti si chiama «Non contabile» (la chiave interna resta «giroconto»)", async (t) => {
  const { api, db } = await setup(t);
  await api("POST", "/api/login", { password: "segreta" });
  const tags = (await api("GET", "/api/transactions")).json.tags;
  assert.equal(tags.giroconto, "Non contabile");
  assert.ok(!Object.values(tags).includes("Giroconto"));
  db.transactions.x = { id: "x", bank: "revolut", account: "a", date: "2026-05-01", amount: -9, description: "Prova", currency: "EUR" };
  assert.equal((await api("PUT", "/api/transactions/x/tag", { tag: "giroconto" })).status, 200); // le scelte già salvate e l'API continuano a funzionare
  const row = (await api("GET", "/api/transactions")).json.transactions[0];
  assert.deepEqual([row.tag, row.manual], ["giroconto", true]);
  assert.deepEqual((await api("GET", "/api/transactions")).json.totals, { entrate: 0, uscite: 0 }); // non conta nei totali
});

test("rinominare un movimento: vale per quel movimento, si cerca per nome, resta dopo una nuova lettura e si ripristina", async (t) => {
  const ctx = await setup(t);
  const { api } = ctx;
  await api("POST", "/api/login", { password: "segreta" });
  await api("PUT", "/api/banks/app", { appId: "app-di-prova", privateKey });
  await link(ctx, "revolut");
  const list = () => api("GET", "/api/transactions").then((r) => r.json.transactions);
  const first = (await list()).find((x) => x.amount < 0);
  assert.equal(first.customName, "");

  const r = await api("PUT", `/api/transactions/${first.id}/name`, { name: "  Spesa   al mercato  " });
  assert.equal(r.status, 200);
  assert.equal(r.json.name, "Spesa al mercato"); // spazi ripuliti
  const after = (await list()).find((x) => x.id === first.id);
  assert.equal(after.customName, "Spesa al mercato");
  assert.equal(after.description, first.description); // il dato della banca non cambia
  assert.equal((await list()).filter((x) => x.customName).length, 1); // solo quel movimento

  // si trova cercando il nuovo nome
  const found = (await api("GET", "/api/transactions?q=mercato")).json.transactions;
  assert.ok(found.some((x) => x.id === first.id));

  // una nuova lettura dalla banca non lo cancella
  assert.equal((await api("POST", "/api/banks/sync", {})).status, 200);
  assert.equal((await list()).find((x) => x.id === first.id).customName, "Spesa al mercato");

  // troppo lungo: si taglia a 120 caratteri; vuoto: torna il nome della banca
  const long = await api("PUT", `/api/transactions/${first.id}/name`, { name: "x".repeat(300) });
  assert.equal(long.json.name.length, 120);
  assert.equal((await api("PUT", `/api/transactions/${first.id}/name`, { name: "   " })).json.name, "");
  assert.equal((await list()).find((x) => x.id === first.id).customName, "");
  assert.equal((await api("PUT", "/api/transactions/inesistente/name", { name: "x" })).status, 404);
});

test("togliere i movimenti vecchi toglie anche i loro nomi", () => {
  const db = { settings: { cutoff: "2026-08-01" }, overrides: {}, renames: { a: "Vecchio", b: "Nuovo" }, transactions: { a: { id: "a", date: "2026-07-01" }, b: { id: "b", date: "2026-08-02" } } };
  applyCutoff(db);
  assert.deepEqual(Object.keys(db.renames), ["b"]);
});

test("il tag carburante si chiama «Auto» (la chiave interna resta carburante)", async (t) => {
  const { api } = await setup(t);
  await api("POST", "/api/login", { password: "segreta" });
  const tags = (await api("GET", "/api/transactions")).json.tags;
  assert.equal(tags.carburante, "Auto");
  assert.ok(!Object.values(tags).includes("Carburante"));
  const budget = (await api("GET", "/api/budgets")).json.month.cats;
  assert.equal(budget.carburante.label, "Auto");
});
