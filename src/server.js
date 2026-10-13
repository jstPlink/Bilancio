// Server di MyBank: API, pagine web e aggiornamento automatico delle banche.
import express from 'express';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.js';
import { AUTO_PER_DAY, BANKS, applyCutoff, cutoffOf, startLink, finishLink, syncConnection, publicState } from './banks.js';
import { checkKey, createClient, psuHeaders } from './eb.js';
import { AUTO_HOURS, TZ, nextRun } from './schedule.js';
import { monthBudget, listTransactions, spendStats, widgetData, yearSummary } from './stats.js';
import { DOCUMENTS, cleanFileName, downloadFile, listDocuments, listFolder, normalizeDocuments, uploadFile } from './documents.js';
import { PARSER_VERSION, parseStatement } from './estratto.js';
import { PAYSLIP_PARSER, payslipInfo, readPayslipNet } from './busta.js';
import { importTransactions, importedVisible } from './import.js';
import { normalizeNotification } from './notifications.js';
import { openStore } from './store.js';
import { accountNames, BUDGET_TAGS, TAGS } from './tags.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Il testo di un PDF (`pdftotext -raw`, del pacchetto poppler: c'è nell'immagine Docker). */
async function pdfText(buffer) {
  const tmp = path.join(os.tmpdir(), `mybank-${process.pid}-${Date.now()}.pdf`);
  fs.writeFileSync(tmp, buffer);
  try {
    return await new Promise((resolve, reject) => {
      execFile('pdftotext', ['-raw', tmp, '-'], { maxBuffer: 64 * 1024 * 1024 }, (err, out) => (err ? reject(new Error(err.code === 'ENOENT' ? 'Sul server manca pdftotext (poppler-utils): aggiorna l\'immagine Docker.' : 'Non riesco a leggere il PDF.')) : resolve(out)));
    });
  } finally { fs.rmSync(tmp, { force: true }); }
}
export const VERSION = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

/** Crea l'app: `dir` è la cartella dei dati, `password` la password di accesso (vuota = accesso libero, solo in locale). */
export function createApp({ dir, password = '', publicUrl = '', fetchImpl = fetch, cutoff = '', pdfToText = pdfText, payslipNet = readPayslipNet } = {}) {
  const store = openStore(dir);
  const { db } = store;
  if (cutoff) db.settings.cutoff = cutoff; // di norma i movimenti partono dal 1 agosto 2026 (vedi banks.js)
  if (applyCutoff(db)) store.save(); // quelli di prima si tolgono dai dati
  const auth = createAuth({ dir, password });
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '6mb' }));

  const bad = (res, message, status = 400) => res.status(status).json({ error: message });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { bad(res, e.message); } };
  const bankApp = () => {
    const a = db.banking.app;
    if (!a?.appId || !a?.privateKey) throw new Error('Prima inserisci ID e chiave di Enable Banking (scheda Banche → Enable Banking).');
    return a;
  };
  const baseUrl = (req) => (publicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

  // ---------------------------------------------------------------- accesso e versione
  app.get('/api/version', (req, res) => res.json({ version: VERSION }));
  app.post('/api/login', (req, res) => auth.login(req, res));
  app.post('/api/logout', (req, res) => auth.logout(req, res));
  app.post('/api/password', auth.middleware, (req, res) => auth.changePassword(req, res));
  app.get('/api/session', (req, res) => {
    if (!auth.isAuthed(req)) return res.status(401).json({ ok: false, open: auth.open });
    res.json({ ok: true, open: auth.open, token: auth.refresh(), version: VERSION, demo: Boolean(process.env.MYBANK_DEMO) });
  });

  // Ritorno dalla banca dopo l'autorizzazione: si conclude il collegamento e si torna alla scheda Banche (non serve il login: vale lo «state»).
  app.get('/api/banks/callback', async (req, res) => {
    const back = (msg) => res.redirect(`/?banca=${encodeURIComponent(msg)}#banche`);
    try {
      if (req.query.error) throw new Error(`La banca ha risposto: ${req.query.error_description ?? req.query.error}`);
      const client = createClient(bankApp(), fetchImpl);
      const conn = await finishLink({ client, db, code: String(req.query.code ?? ''), state: String(req.query.state ?? '') });
      await store.save();
      try { await syncConnection({ client, db, conn }); } catch { /* si leggerà con «Aggiorna» */ }
      await store.save();
      back(`ok:${BANKS[conn.bank]?.label ?? conn.bank} collegata.`);
    } catch (e) { await store.save(); back(`errore:${e.message}`); }
  });

  app.use('/api', auth.middleware);

  // ---------------------------------------------------------------- storico, movimenti, budget
  app.get('/api/summary', (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(yearSummary(db, year));
  });

  // Statistiche di spesa: per categoria, mese per mese, dove vanno i soldi.
  app.get('/api/stats', (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json(spendStats(db, { year, month: Number(req.query.month) || 0 }));
  });

  app.get('/api/transactions', (req, res) => {
    const account = String(req.query.account ?? '');
    const list = listTransactions(db, { year: Number(req.query.year) || 0, month: Number(req.query.month) || 0, tag: String(req.query.tag ?? ''), q: req.query.q, account });
    // con un conto o pocket scelto (Banche → tocco su una riga) si dice anche come si chiama
    const name = account ? accountNames(db).get(account)?.name : '';
    res.json({ transactions: list.slice(0, 1000), total: list.length, tags: TAGS, account: account ? { uid: account, name: name || 'Conto' } : null });
  });

  // Tag scelto a mano per un movimento (`null` torna a quello automatico).
  app.put('/api/transactions/:id/tag', wrap(async (req, res) => {
    const t = db.transactions[req.params.id];
    if (!t) return bad(res, 'Movimento sconosciuto.', 404);
    const tag = req.body?.tag;
    if (tag == null || tag === '') delete db.overrides[t.id];
    else if (TAGS[tag]) db.overrides[t.id] = tag;
    else return bad(res, 'Tag non valido.');
    await store.save();
    res.json({ ok: true });
  }));

  app.get('/api/budgets', (req, res) => res.json({ budgets: db.settings.budgets, month: monthBudget(db) }));
  app.put('/api/budgets', wrap(async (req, res) => {
    for (const k of BUDGET_TAGS) {
      const v = req.body?.[k];
      if (v == null || v === '') continue;
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) return bad(res, `Importo non valido per ${TAGS[k]}.`);
      db.settings.budgets[k] = Math.round(n * 100) / 100;
    }
    await store.save();
    res.json({ budgets: db.settings.budgets, month: monthBudget(db) });
  }));

  app.get('/api/widget', (req, res) => res.json(widgetData(db)));

  // ---------------------------------------------------------------- importazione da estratto conto
  app.post('/api/import', wrap(async (req, res) => {
    const result = importTransactions(db, req.body?.transactions);
    await store.save();
    res.json(result);
  }));

  // ---------------------------------------------------------------- estratti conto: lettura automatica
  // Ogni estratto mensile («Estratto conto AAAA.MM.pdf») nuovo o cambiato, dei mesi PRIMA della data di inizio, si scarica, si legge e i suoi
  // movimenti si salvano. Quelli da quella data in poi non si leggono: li legge la banca. L'esito di ogni file sta in settings.statementsRead.
  const STATEMENT = /^Estratto conto (\d{4})\.(\d{2})\.pdf$/i;
  const statementUrl = () => db.settings.documents?.statements?.url ?? '';
  async function readStatement(name, sig) {
    const rec = (db.settings.statementsRead ??= {});
    const at = new Date().toISOString();
    try {
      const { transactions } = parseStatement(await pdfToText(await downloadFile(statementUrl(), name, fetchImpl)));
      const r = importTransactions(db, transactions);
      rec[name] = { sig, at, found: transactions.length, added: r.added, updated: r.updated };
    } catch (e) { rec[name] = { sig, at, error: e.message, parser: PARSER_VERSION }; }
    return rec[name];
  }
  let statementsBusy = null;
  /** Legge gli estratti nuovi della cartella. Restituisce l'elenco di quelli letti adesso. */
  function syncStatements(files) {
    if (!statementUrl()) return Promise.resolve([]);
    if (statementsBusy) return statementsBusy;
    statementsBusy = (async () => {
      const list = files ?? (await listFolder(statementUrl(), fetchImpl)).files;
      const rec = (db.settings.statementsRead ??= {});
      const firstMonth = cutoffOf(db).slice(0, 7);
      const read = [];
      for (const f of list) {
        const m = f.folder ? null : STATEMENT.exec(f.name); // solo gli estratti della radice (le sottocartelle si mostrano soltanto)
        if (!m) continue;
        const sig = `${f.size}|${f.modified}`;
        const was = rec[f.name];
        if (was?.sig === sig && !(was.error && was.parser !== PARSER_VERSION)) continue; // già letto (o già fallito): si riprova se il file cambia o se il lettore è migliorato
        if (`${m[1]}-${m[2]}` >= firstMonth) { rec[f.name] = { sig, skipped: true }; continue; } // da qui in poi i movimenti li legge la banca
        read.push({ name: f.name, ...(await readStatement(f.name, sig)) });
      }
      if (read.length || list.some((f) => rec[f.name]?.skipped)) await store.save();
      return read;
    })().finally(() => { statementsBusy = null; });
    return statementsBusy;
  }

  // ---------------------------------------------------------------- buste paga: lettura automatica
  // Ogni busta paga nuova nella cartella (e nelle sue sottocartelle) si scarica e se ne legge il «netto a pagare» (sono scansioni: OCR, vedi
  // busta.js); diventa un movimento di entrata. Come per gli estratti, i mesi da agosto 2026 in poi non si leggono (il conto è letto dalla banca).
  // La lettura va in sottofondo: l'elenco dei file risponde subito e dice quali buste sono ancora in attesa. L'esito sta in settings.payslipsRead.
  const payslipUrl = () => db.settings.documents?.payslips?.url ?? '';
  let payslipsBusy = null;
  /** Una busta paga da leggere: nuova, cambiata o fallita con un lettore più vecchio. */
  const payslipTodo = (f) => {
    const was = db.settings.payslipsRead?.[f.path];
    return !(was?.sig === `${f.size}|${f.modified}` && !(was.error && was.parser !== PAYSLIP_PARSER));
  };
  function syncPayslips(files) {
    if (!payslipUrl()) return Promise.resolve([]);
    if (payslipsBusy) return payslipsBusy;
    payslipsBusy = (async () => {
      const list = files ?? (await listFolder(payslipUrl(), fetchImpl)).files;
      const rec = (db.settings.payslipsRead ??= {});
      const from = cutoffOf(db);
      const read = [];
      let sinceSave = 0;
      for (const f of list) {
        const info = payslipInfo(f.name);
        if (!info || !payslipTodo(f)) continue;
        const sig = `${f.size}|${f.modified}`;
        const at = new Date().toISOString();
        if (info.date >= from) { rec[f.path] = { sig, at, skipped: true }; continue; }
        try {
          const amount = await payslipNet(await downloadFile(payslipUrl(), f.path, fetchImpl));
          importTransactions(db, [{ bank: 'busta', account: 'busta:paga', accountLabel: 'Busta paga', key: info.key, date: info.date, amount, description: info.description }]);
          rec[f.path] = { sig, at, amount, parser: PAYSLIP_PARSER };
          read.push({ path: f.path, amount });
        } catch (e) { rec[f.path] = { sig, at, error: e.message, parser: PAYSLIP_PARSER }; read.push({ path: f.path, error: e.message }); }
        if (++sinceSave >= 5) { sinceSave = 0; await store.save(); }
      }
      await store.save();
      return read;
    })().finally(() => { payslipsBusy = null; });
    return payslipsBusy;
  }

  // ---------------------------------------------------------------- documenti (tre cartelle online)
  const docKey = (req) => { if (!DOCUMENTS[req.params.key]) throw new Error('Categoria di documenti sconosciuta.'); return req.params.key; };
  app.get('/api/documents', (req, res) => res.json({ links: listDocuments(db) }));
  app.put('/api/documents', wrap(async (req, res) => {
    db.settings.documents = normalizeDocuments(req.body, db.settings.documents);
    await store.save();
    res.json({ links: listDocuments(db) });
  }));
  // L'elenco dei file della cartella (letto da Seafile) con l'indirizzo per aprire ognuno.
  app.get('/api/documents/:key/files', wrap(async (req, res) => {
    const url = db.settings.documents?.[docKey(req)]?.url;
    if (!url) return bad(res, 'Prima inserisci il link della cartella.');
    const folder = await listFolder(url, fetchImpl);
    if (req.params.key === 'statements') {
      // gli estratti nuovi si leggono qui (e a ogni aggiornamento automatico); di ogni estratto mensile si dice com'è andata
      const read = await syncStatements(folder.files).catch(() => []);
      const visible = importedVisible(db);
      const rec = db.settings.statementsRead ?? {};
      for (const f of folder.files) {
        const m = f.folder ? null : STATEMENT.exec(f.name);
        if (!m) continue;
        const r = rec[f.name];
        f.statement = r?.error ? { state: 'errore', error: r.error } : r?.skipped ? { state: 'banca' } : r ? { state: 'letto', count: r.found ?? 0, visible: visible === null || visible.includes(`${m[1]}-${m[2]}`) } : { state: 'attesa' };
      }
      folder.read = read.map((r) => ({ name: r.name, count: r.found ?? 0, error: r.error ?? '' }));
    }
    if (req.params.key === 'payslips') {
      if (folder.files.some((f) => payslipInfo(f.name) && payslipTodo(f))) syncPayslips(folder.files).catch((e) => console.error('Lettura delle buste paga non riuscita:', e.message)); // in sottofondo
      const rec = db.settings.payslipsRead ?? {};
      for (const f of folder.files) {
        if (!payslipInfo(f.name)) continue;
        const r = rec[f.path];
        f.payslip = r?.error ? { state: 'errore', error: r.error } : r?.skipped ? { state: 'banca' } : r ? { state: 'letto', amount: r.amount } : { state: 'attesa' };
      }
      folder.busy = Boolean(payslipsBusy);
    }
    res.json(folder);
  }));
  // Carica un file (il corpo della richiesta è il file) nella cartella, con il nome scelto dall'utente.
  app.post('/api/documents/:key/files', express.raw({ type: () => true, limit: '40mb' }), wrap(async (req, res) => {
    const url = db.settings.documents?.[docKey(req)]?.url;
    if (!url) return bad(res, 'Prima inserisci il link della cartella.');
    if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, 'Il file è vuoto.');
    await uploadFile(url, cleanFileName(req.query.name), req.body, fetchImpl);
    res.json({ ok: true });
  }));
  // Rilegge a mano un estratto conto (per riprovare dopo un errore).
  app.post('/api/documents/statements/import', wrap(async (req, res) => {
    if (!statementUrl()) return bad(res, 'Prima inserisci il link della cartella degli estratti conto.');
    const name = cleanFileName(req.query.name);
    if (!STATEMENT.test(name)) return bad(res, 'Si leggono solo gli estratti conto mensili «Estratto conto AAAA.MM.pdf».');
    const r = await readStatement(name, db.settings.statementsRead?.[name]?.sig ?? '');
    await store.save();
    if (r.error) return bad(res, r.error);
    res.json({ name, found: r.found, added: r.added, updated: r.updated });
  }));

  // ---------------------------------------------------------------- notifiche
  // Promemoria con testo, giorno del mese e orario: li salva il server, l'app Android li legge e li programma sul telefono.
  const listNotifications = () => ({ notifications: db.notifications });
  app.get('/api/notifications', (req, res) => res.json(listNotifications()));
  app.post('/api/notifications', wrap(async (req, res) => {
    if (db.notifications.length >= 50) return bad(res, 'Troppe notifiche: toglierne qualcuna.');
    db.notifications.push(normalizeNotification(req.body));
    await store.save();
    res.json(listNotifications());
  }));
  app.put('/api/notifications/:id', wrap(async (req, res) => {
    const i = db.notifications.findIndex((n) => n.id === req.params.id);
    if (i < 0) return bad(res, 'Notifica sconosciuta.', 404);
    db.notifications[i] = normalizeNotification(req.body, req.params.id);
    await store.save();
    res.json(listNotifications());
  }));
  app.delete('/api/notifications/:id', wrap(async (req, res) => {
    const i = db.notifications.findIndex((n) => n.id === req.params.id);
    if (i < 0) return bad(res, 'Notifica sconosciuta.', 404);
    db.notifications.splice(i, 1);
    await store.save();
    res.json(listNotifications());
  }));

  // ---------------------------------------------------------------- banche
  // Orari dell'aggiornamento automatico: quelli scelti dall'utente (Banche → Aggiornamento) oppure quelli di base.
  const hoursNow = () => (Array.isArray(db.settings.autoHours) && db.settings.autoHours.length ? db.settings.autoHours : AUTO_HOURS);
  const bankInfo = (req) => ({
    ...publicState(db),
    redirectUrl: `${baseUrl(req)}/api/banks/callback`,
    auto: { hours: hoursNow(), tz: TZ, next: nextRun(new Date(), hoursNow()).toISOString(), max: AUTO_PER_DAY },
  });
  app.get('/api/banks', (req, res) => res.json(bankInfo(req)));

  app.put('/api/banks/app', wrap(async (req, res) => {
    const appId = String(req.body?.appId ?? '').trim();
    const privateKey = String(req.body?.privateKey ?? '').trim();
    if (!appId) return bad(res, 'Manca l\'ID dell\'applicazione.');
    // senza una nuova chiave si tiene quella già salvata
    if (privateKey) checkKey(privateKey);
    else if (!db.banking.app?.privateKey) return bad(res, 'Manca la chiave privata.');
    db.banking.app = { appId, privateKey: privateKey || db.banking.app.privateKey };
    await store.save();
    res.json(bankInfo(req));
  }));

  app.put('/api/banks/schedule', wrap(async (req, res) => {
    const raw = Array.isArray(req.body?.hours) ? req.body.hours : [];
    const hours = [...new Set(raw.map(Number))].sort((a, b) => a - b);
    if (!hours.length || hours.some((h) => !Number.isInteger(h) || h < 0 || h > 23)) return bad(res, 'Scegli almeno un orario, tra le 0 e le 23.');
    if (hours.length > AUTO_PER_DAY) return bad(res, `Le banche concedono ${AUTO_PER_DAY} accessi automatici al giorno: gli orari possono essere al massimo ${AUTO_PER_DAY}.`);
    db.settings.autoHours = hours;
    await store.save();
    if (active) scheduleAutoRead(); // il prossimo aggiornamento si ricalcola subito
    res.json(bankInfo(req));
  }));

  app.post('/api/banks/link', wrap(async (req, res) => {
    const client = createClient(bankApp(), fetchImpl);
    const url = await startLink({ client, db, bank: String(req.body?.bank ?? ''), redirectUrl: `${baseUrl(req)}/api/banks/callback` });
    await store.save();
    res.json({ url });
  }));

  app.delete('/api/banks/:id', wrap(async (req, res) => {
    const conn = db.banking.connections.find((c) => c.id === req.params.id);
    if (!conn) return bad(res, 'Collegamento sconosciuto.', 404);
    try { await createClient(bankApp(), fetchImpl).deleteSession(conn.id); } catch { /* la sessione può essere già scaduta */ }
    db.banking.connections = db.banking.connections.filter((c) => c !== conn);
    for (const [id, t] of Object.entries(db.transactions)) if (t.bank === conn.bank && !t.imported) delete db.transactions[id]; // quelli importati da un estratto restano
    await store.save();
    res.json(bankInfo(req));
  }));

  app.put('/api/banks/accounts/:uid/name', wrap(async (req, res) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (name) db.banking.names[req.params.uid] = name; else delete db.banking.names[req.params.uid];
    await store.save();
    res.json(bankInfo(req));
  }));

  // Aggiornamento a mano: una lettura per banca, dichiarata alla banca come richiesta da una persona presente.
  app.post('/api/banks/sync', wrap(async (req, res) => {
    const client = createClient(bankApp(), fetchImpl, psuHeaders(req));
    const targets = db.banking.connections.filter((c) => !req.body?.id || c.id === req.body.id);
    if (!targets.length) return bad(res, 'Nessuna banca collegata.');
    const errors = [];
    let added = 0;
    for (const conn of targets) {
      try { added += (await syncConnection({ client, db, conn })).added; } catch (e) { errors.push(`${BANKS[conn.bank]?.label ?? conn.bank}: ${e.message}`); }
    }
    await store.save();
    res.json({ added, errors, ...bankInfo(req) });
  }));

  // ---------------------------------------------------------------- aggiornamento automatico
  async function autoRead() {
    await syncStatements().catch((e) => console.error('Lettura degli estratti conto non riuscita:', e.message));
    await syncPayslips().catch((e) => console.error('Lettura delle buste paga non riuscita:', e.message));
    const b = db.banking;
    if (!b.app?.appId || !b.app?.privateKey || !b.connections.length) return null;
    const client = createClient(b.app, fetchImpl);
    const errors = [];
    let added = 0;
    for (const conn of b.connections) {
      try { added += (await syncConnection({ client, db, conn, auto: true })).added; } catch (e) { errors.push(`${BANKS[conn.bank]?.label ?? conn.bank}: ${e.message}`); }
    }
    b.lastAuto = { at: new Date().toISOString(), added, errors };
    await store.save();
    console.log(`Aggiornamento automatico delle banche: ${added} nuovi movimenti${errors.length ? `, errori: ${errors.join(' · ')}` : ''}`);
    return b.lastAuto;
  }
  let timer = null;
  let active = false;
  function scheduleAutoRead() {
    active = true;
    clearTimeout(timer);
    const when = nextRun(new Date(), hoursNow());
    timer = setTimeout(async () => {
      try { await autoRead(); } catch (e) { console.error('Aggiornamento automatico non riuscito:', e.message); }
      scheduleAutoRead();
    }, Math.max(1000, when.getTime() - Date.now()));
    timer.unref?.();
    return timer;
  }

  // La pagina non si tiene mai in cache e punta a script e stile con la versione nell'indirizzo: dopo un aggiornamento nessun browser,
  // app o proxy può mostrare un'app.js vecchia con una pagina nuova.
  const pub = path.join(root, 'public');
  app.get(['/', '/index.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(fs.readFileSync(path.join(pub, 'index.html'), 'utf8').replaceAll('__V__', VERSION));
  });
  app.use(express.static(pub, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  return { app, store, db, autoRead, scheduleAutoRead };
}
