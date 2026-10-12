# MyBank

Monitora i movimenti delle tue banche (**UniCredit** e **Revolut**, collegate con [Enable Banking](https://enablebanking.com), in sola lettura) dal **web** e dal **telefono** (app Android con widget).

> MyBank è la riscrittura da zero di Bilancio. La vecchia app è archiviata: ramo `archivio/bilancio` e tag `archivio-bilancio-v0.45.0` (in realtà punta all'ultimo stato, la 0.55.5).

## Cosa fa

**Tag dei movimenti.** Revolut è la banca principale ed è divisa in pocket. Ogni movimento in uscita prende il tag del **pocket da cui parte**:

| Pocket Revolut | Tag |
|---|---|
| 01 Spesa | **Spesa** |
| 02 Svago | **Svago** |
| 03 Carburante | **Carburante** |
| 04 Altro | **Altro** |
| qualsiasi altro pocket, conto principale, UniCredit | **Non definito** (lo smisti tu) |

Gli altri due tag sono automatici: **Entrata** (denaro che arriva da fuori) e **Giroconto** (denaro che sposti tra i tuoi conti e pocket: non conta in nessun totale). Il tag si cambia a mano dal menu di ogni movimento (scheda Movimenti): vale per quel movimento e vince sull'automatico.
Il nome vero di un pocket la banca non lo dà (dà il nome dell'intestatario): MyBank lo ricava dal testo dei movimenti («Accredita EUR 01 Spesa da EUR») e, se serve, lo imposti a mano con **Rinomina** (scheda Banche).
Un giroconto si riconosce da: testo del giro tra pocket, IBAN della controparte che è un tuo conto, oppure lo stesso importo che esce da un conto e rientra in un altro della stessa banca entro un giorno.

**Le schede**
- **Storico** (principale): l'anno scelto, mese per mese, **entrate**, **uscite** e **bilancio**, con il totale. Un tocco su un mese mostra le uscite per tag.
- **Movimenti**: l'elenco con filtri (anno, mese, tag, ricerca) e il tag modificabile. I pagamenti ancora in sospeso contano subito e hanno una barra rossa a sinistra.
- **Budget**: il budget mensile di Spesa, Svago e Carburante e, per il mese in corso, residuo, spesa giornaliera stimata e reale.
- **Opzioni**: **cambio della password dell'account** (serve quella attuale; da lì in poi vale la nuova, salvata come impronta in `data/auth.json`, e gli altri accessi devono rifare il login), uscita dall'account e informazioni; nell'app Android anche «Cambia server».
- **Banche**: collegamento di UniCredit e Revolut, **aggiornamento** (4 automatici al giorno alle **5, 11, 14 e 19**, ora italiana, più il pulsante **Aggiorna ora** per quelli in più), rinomina dei pocket e credenziali di Enable Banking.

**Widget Android 5×1**, quattro celle: a sinistra la **barra del mese** (tacca rossa a fine di ogni domenica, giorni che restano) e sotto l'**ora dell'ultimo aggiornamento** delle banche; poi **Spesa**, **Svago** e **Carburante** con il **residuo del budget** (budget meno speso nel mese), sotto la **spesa giornaliera stimata** (budget diviso i giorni del mese) e sotto la **reale** (speso diviso i giorni passati, oggi compreso; verde se è pari o migliore della stima, rossa se peggiore). Si aggiorna ogni mezz'ora e quando apri l'app o premi «Aggiorna ora».

**Limiti delle banche.** Le banche concedono 4 accessi al giorno senza l'utente presente (PSD2): sono esattamente i 4 automatici. Le letture a mano (fino a 10 al giorno per banca) dichiarano alla banca che c'è una persona presente (intestazioni «PSU») e contano a parte. Il consenso dura al massimo 180 giorni: alla scadenza si ricollega con un tocco.

## Come si avvia

Serve Node 24.

```bash
npm install
cp .env.example .env     # poi imposta MYBANK_PASSWORD
npm start                # http://127.0.0.1:4870
```

`MYBANK_PASSWORD` è la password **iniziale**: la cambi dalla scheda Opzioni e da quel momento il valore nel file non conta più. Senza `MYBANK_PASSWORD` il server parte solo su `127.0.0.1` (accesso libero, per provare in locale); su altri indirizzi (`HOST=0.0.0.0`) la password è obbligatoria.
I dati stanno in `data/` (`mybank.json` e la chiave di firma `secret.key`; non finiscono mai su GitHub).

**Provare senza banche vere:** `npm run demo` avvia una banca finta e un'app con dati inventati su `http://localhost:4871` (database a parte in `data/demo`).

### Collegare le banche
1. Su [enablebanking.com](https://enablebanking.com) crea un'applicazione (gratis per uso personale) e registra come **indirizzo di ritorno** quello mostrato in *Banche → Enable Banking* (`https://<il tuo server>/api/banks/callback`; per Enable Banking serve https, tranne in prova).
2. In *Banche → Enable Banking* incolla l'**ID** e la **chiave privata** (file `.pem`): restano solo sul server. La chiave si scarica **una sola volta**, quando crei l'applicazione sul sito di Enable Banking, e non si può rivedere; se la perdi crea una nuova applicazione (o una nuova chiave) e aggiorna ID e chiave qui.
3. Premi **Collega UniCredit** / **Collega Revolut**: si apre il sito della banca per autorizzare la sola lettura; al ritorno MyBank legge lo storico (un anno, o 90 giorni se la banca non lo concede).

### Sul server (NAS, Docker)
```bash
docker compose up -d                      # imposta prima MYBANK_PASSWORD in docker-compose.yml
docker compose pull && docker compose up -d   # aggiornamento
```
GitHub costruisce l'immagine `ghcr.io/jstplink/mybank` a ogni push su `main` e a ogni tag `mybank-vX.Y.Z`. Serve un indirizzo https raggiungibile dal telefono (reverse proxy del NAS o simile).

### App Android
```bash
npm run apk              # costruisce android/build/MyBank-<versione>.apk
npm run apk:installa     # costruisce e installa sul telefono (debug wireless attivo)
```
Serve l'SDK Android (si trova da solo in `~/Android/Sdk` o `%LOCALAPPDATA%\Android\Sdk`) e Java 17. Se in `.env` c'è `MYBANK_SERVER` l'indirizzo finisce nell'APK; altrimenti l'app lo chiede alla prima apertura (https, oppure un indirizzo di casa come `192.168.1.20:4870`). L'app mostra le pagine del server e, dopo il login, consegna al widget il gettone di accesso. Il widget si aggiunge dal menu dei widget → MyBank.

## Estetica

Stile tipografico da giornale svizzero: **carta e inchiostro** (chiaro e scuro come il sistema), un solo **rosso vermiglio** come accento, **angoli vivi** e filetti (1px sottili, 2px a inizio sezione), numeri grandi in **serif**, etichette in **monospazio maiuscolo**, testo in sans. Scala del testo: 11 etichette · 13 secondario · 15 testo, campi e pulsanti · 22 titoli · 34 numeri (28 sul telefono). Pulsanti: primario = inchiostro pieno (rosso al passaggio), secondario = solo filetto, link = sottolineato rosso; schede = sottolineatura rossa spessa. Il widget è la stessa pagina in piccolo: fondo inchiostro, testo carta, numeri serif, etichette monospazio, tacche rosse.

## Come è fatta

```
src/       server.js (API), start.js (avvio), eb.js (client Enable Banking), banks.js (collegamento, letture, limiti),
           tags.js (tag e giroconti), stats.js (storico, budget, widget), auth.js (password e gettone), schedule.js (orari), store.js (dati)
public/    pagine web: index.html, style.css, app.js (nessuna dipendenza)
android/   app e widget (Java, senza Gradle): MainActivity, MyBankWidget, WidgetData, Server
scripts/   banca-finta.mjs, demo.mjs, build-apk.mjs
test/      schedule, tags, flow (giro completo con la banca finta)
```

API principali (tutte dietro password, tranne login e ritorno dalla banca): `GET /api/summary?year=`, `GET /api/transactions`, `PUT /api/transactions/:id/tag`, `GET|PUT /api/budgets`, `GET /api/widget`, `GET /api/banks`, `PUT /api/banks/app`, `POST /api/banks/link`, `GET /api/banks/callback`, `POST /api/banks/sync`, `DELETE /api/banks/:id`, `PUT /api/banks/accounts/:uid/name`.

## Archivio di Bilancio

Per consultare la vecchia app senza toccare `main`: `git worktree add ../Bilancio-archivio archivio/bilancio`.
