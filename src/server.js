// Server di MyBank: API, pagine web e aggiornamento automatico delle banche.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.js';
import { AUTO_PER_DAY, BANKS, applyCutoff, startLink, finishLink, syncConnection, publicState } from './banks.js';
import { checkKey, createClient, psuHeaders } from './eb.js';
import { AUTO_HOURS, TZ, nextRun } from './schedule.js';
import { monthBudget, listTransactions, spendStats, widgetData, yearSummary } from './stats.js';
import { normalizeNotification } from './notifications.js';
import { openStore } from './store.js';
import { accountNames, BUDGET_TAGS, TAGS } from './tags.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

/** Crea l'app: `dir` è la cartella dei dati, `password` la password di accesso (vuota = accesso libero, solo in locale). */
export function createApp({ dir, password = '', publicUrl = '', fetchImpl = fetch, cutoff = '' } = {}) {
  const store = openStore(dir);
  const { db } = store;
  if (cutoff) db.settings.cutoff = cutoff; // di norma i movimenti partono dal 1 settembre 2026 (vedi banks.js)
  if (applyCutoff(db)) store.save(); // quelli di prima si tolgono dai dati
  const auth = createAuth({ dir, password });
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  const bad = (res, message, status = 400) => res.status(status).json({ error: message });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { bad(res, e.message); } };
  const bankApp = () => {
    const a = db.banking.app;
    if (!a?.appId || !a?.privateKey) throw new Error('Prima inserisci ID e chiave di Enable Banking (Opzioni → Banche → Enable Banking).');
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

  // Ritorno dalla banca dopo l'autorizzazione: si conclude il collegamento e si torna alle Opzioni (non serve il login: vale lo «state»).
  app.get('/api/banks/callback', async (req, res) => {
    const back = (msg) => res.redirect(`/?banca=${encodeURIComponent(msg)}#opzioni`);
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
    for (const [id, t] of Object.entries(db.transactions)) if (t.bank === conn.bank) delete db.transactions[id];
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
