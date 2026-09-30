#!/usr/bin/env node
// Sposta i dati già compilati da un database Bilancio locale a un server Bilancio (per esempio sul NAS), usando le sue API.
// Rilegge documenti ed estratti conto dal server e poi riporta quello che hai sistemato a mano: impostazioni,
// correzioni ai documenti, categorie scelte, spunte "pagato" e importi manuali.
//
// Uso:   node scripts/importa-su-server.mjs <indirizzo-server> [utente:password] [--db file] [--force] [--senza-refresh]
// Esempio: node scripts/importa-su-server.mjs https://bilancio.example.it
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, ruleKey } from '../src/statements.js';

const args = process.argv.slice(2);
const valueOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--db');
const [serverUrl, creds] = positional;
if (!serverUrl) {
  console.error('Uso: node scripts/importa-su-server.mjs <indirizzo-server> [utente:password] [--db file] [--force] [--senza-refresh]');
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = valueOf('--db') ?? process.env.BILANCIO_DB ?? path.join(process.env.BILANCIO_DATA ?? path.join(root, 'data'), 'bilancino.db');
const base = serverUrl.replace(/\/$/, '');
const headers = { 'Content-Type': 'application/json', ...(creds ? { Authorization: `Basic ${Buffer.from(creds).toString('base64')}` } : {}) };
const log = (msg) => console.log(msg);

// ------------------------------------------------------------------ database locale (sola lettura)
const sql = new DatabaseSync(dbFile, { readOnly: true });
const kv = Object.fromEntries(sql.prepare('SELECT k, v FROM kv').all().map((r) => [r.k, JSON.parse(r.v)]));
const docs = Object.fromEntries(sql.prepare('SELECT key, json FROM docs').all().map((r) => [r.key, JSON.parse(r.json)]));
const local = {
  settings: kv.settings ?? {}, paid: kv.paid ?? {}, manual: kv.manual ?? {}, rules: kv.rules ?? {},
  transactions: Object.values(kv.transactions ?? {}), docs,
};
log(`Database locale: ${dbFile}\n  ${Object.keys(docs).length} documenti, ${local.transactions.length} movimenti, ${Object.keys(local.rules).length} regole, ${Object.keys(local.paid).length} spunte, ${Object.keys(local.manual).length} importi manuali`);

// ------------------------------------------------------------------ server
async function api(route, method = 'GET', body, timeoutMs = 60000) {
  const res = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status });
  return data;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const version = await api('/api/version').catch((e) => { console.error(`Server non raggiungibile (${base}): ${e.message}`); process.exit(1); });
log(`Server: ${base} (versione ${version.version})`);
const existingDocs = await api('/api/docs');
const existingTx = (await api('/api/transactions?year=0')).transactions;
if ((existingDocs.length || existingTx.length) && !args.includes('--force')) {
  console.error(`Il server ha già dei dati (${existingDocs.length} documenti, ${existingTx.length} movimenti). Per sovrascrivere aggiungi --force.`);
  process.exit(1);
}

// 1) impostazioni
const wanted = ['payslipsSource', 'billsSource', 'statementsSource', 'ownNames', 'incomePayers', 'rentAmount', 'rentFrom'];
await api('/api/settings', 'PUT', Object.fromEntries(wanted.filter((k) => local.settings[k] !== undefined).map((k) => [k, local.settings[k]])));
log('1/6 Impostazioni copiate.');

// 2) rilettura di documenti ed estratti conto sul server (può richiedere qualche minuto)
async function waitIdle() {
  let last = '';
  for (let i = 0; i < 720; i++) {
    const p = await api('/api/refresh/status').catch(() => null);
    if (p && !p.running) return;
    const line = p ? `${p.done}/${p.total}` : 'in attesa…';
    if (line !== last) { log(`      lettura in corso ${line}`); last = line; }
    await sleep(5000);
  }
}
if (args.includes('--senza-refresh')) log('2/6 Rilettura saltata (--senza-refresh).');
else {
  log('2/6 Il server rilegge documenti ed estratti conto (può richiedere qualche minuto)…');
  let report;
  for (let attempt = 0; attempt < 40 && !report; attempt++) {
    try { report = await api('/api/refresh', 'POST', {}, 180000); } catch (e) {
      const transient = e.status === 409 || [502, 503, 504, 524].includes(e.status) || e.name === 'TimeoutError' || e.cause;
      if (!transient) throw e;
      await waitIdle();
    }
  }
  if (!report) { console.error('La rilettura non è terminata.'); process.exit(1); }
  log(`      ${report.added} documenti letti, ${report.transactions} movimenti nuovi${report.errors.length ? `, errori: ${report.errors.map((x) => `${x.source}: ${x.message}`).join(' · ')}` : ''}`);
}

// 3) correzioni ai documenti
const serverDocs = new Set((await api('/api/docs')).map((d) => d.key));
let overrides = 0;
for (const [key, doc] of Object.entries(local.docs)) {
  const o = doc.override;
  if (!o || !serverDocs.has(key)) continue;
  const clean = Object.fromEntries(Object.entries(o).filter(([k, v]) => ['kind', 'year', 'month', 'amount', 'ignore'].includes(k) && v != null && v !== ''));
  if (!Object.keys(clean).length) continue;
  await api('/api/docs', 'PUT', { key, override: clean }).then(() => { overrides++; }).catch((e) => log(`      correzione saltata (${doc.name}): ${e.message}`));
}
log(`3/6 Correzioni ai documenti: ${overrides}.`);

// 4) categorie scelte a mano (regole per descrizione)
let serverTx = (await api('/api/transactions?year=0')).transactions;
let applied = 0;
for (const [key, category] of Object.entries(local.rules)) {
  if (!CATEGORIES.includes(category)) continue;
  const hit = serverTx.find((t) => ruleKey(t.description, t.amount) === key);
  if (!hit) continue;
  await api('/api/transactions', 'PUT', { id: hit.id, category }).then(() => { applied++; }).catch((e) => log(`      regola saltata (${key.slice(0, 40)}): ${e.message}`));
}
log(`4/6 Categorie scelte a mano riportate: ${applied} gruppi di descrizioni.`);

// 4b) allineamento: dove la categoria sul server è ancora diversa da quella locale (es. abbinamenti automatici
// che qui sono già stati fatti, o regole vecchie), applica quella locale una sola volta per descrizione.
{
  const localCat = new Map(local.transactions.map((t) => [t.id, t.category]));
  serverTx = (await api('/api/transactions?year=0')).transactions;
  const done = new Set();
  let fixed = 0;
  for (const t of serverTx) {
    const want = localCat.get(t.id);
    const key = ruleKey(t.description, t.amount);
    if (!want || want === t.category || done.has(key) || !CATEGORIES.includes(want)) continue;
    done.add(key);
    await api('/api/transactions', 'PUT', { id: t.id, category: want }).then(() => { fixed++; }).catch(() => {});
  }
  if (fixed) log(`      allineate ${fixed} descrizioni rimaste diverse.`);
}

// 5) spunte "pagato" e importi manuali
const payable = new Set(['acqua', 'luce', 'gas', 'wifi', 'affitto']);
const paidItems = Object.keys(local.paid).map((k) => { const [kind, y, m, place] = k.split('|'); return { kind, year: Number(y), month: Number(m), place: place || undefined, paid: true }; })
  .filter((i) => payable.has(i.kind));
for (let i = 0; i < paidItems.length; i += 100) await api('/api/paid', 'POST', paidItems.slice(i, i + 100));
let manual = 0;
for (const [k, amount] of Object.entries(local.manual)) {
  const [kind, y, m] = k.split('|');
  await api('/api/manual', 'POST', { kind, year: Number(y), month: Number(m), amount }).then(() => { manual++; }).catch((e) => log(`      importo manuale saltato (${k}): ${e.message}`));
}
log(`5/6 Spunte "pagato": ${paidItems.length}. Importi manuali: ${manual}.`);

// 6) controllo finale: stesse categorie e stessi totali?
serverTx = (await api('/api/transactions?year=0')).transactions;
const totals = (list) => {
  const t = {};
  for (const x of list) t[x.category] = (t[x.category] ?? 0) + x.amount;
  return t;
};
const a = totals(local.transactions);
const b = totals(serverTx);
let diff = 0;
log(`6/6 Controllo: ${local.transactions.length} movimenti in locale, ${serverTx.length} sul server.`);
for (const c of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const x = Math.round((a[c] ?? 0) * 100) / 100;
  const y = Math.round((b[c] ?? 0) * 100) / 100;
  if (Math.abs(x - y) > 0.005) { diff++; log(`   DIFFERENZA ${c.padEnd(11)} locale ${x.toFixed(2)}  server ${y.toFixed(2)}`); }
}
const localCat = new Map(local.transactions.map((t) => [t.id, t.category]));
const mismatched = serverTx.filter((t) => localCat.has(t.id) && localCat.get(t.id) !== t.category);
const onlyLocal = local.transactions.filter((t) => !serverTx.some((s) => s.id === t.id)).length;
log(`   ${mismatched.length} movimenti con categoria diversa, ${onlyLocal} presenti solo in locale.`);
for (const t of mismatched.slice(0, 8)) log(`     ${t.date} ${t.amount.toFixed(2).padStart(9)}  locale ${localCat.get(t.id)} → server ${t.category}  ${t.description.slice(0, 50)}`);
log(diff === 0 && !mismatched.length && !onlyLocal ? '\nTutto coincide: i dati sono sul server.' : '\nFinito, con le differenze qui sopra.');
