# MyBank

Monitora i movimenti delle tue banche (**UniCredit** e **Revolut**, collegate con [Enable Banking](https://enablebanking.com), in sola lettura) dal **web** e dal **telefono** (app Android con widget).

> MyBank è la riscrittura da zero di Bilancio. La vecchia app è archiviata: ramo `archivio/bilancio` e tag `archivio-bilancio-v0.45.0` (in realtà punta all'ultimo stato, la 0.55.5). Per consultarla senza toccare `main`: `git worktree add ../Bilancio-archivio archivio/bilancio`.

## Come è fatta

Tre parti, con i compiti ben separati:

- **Il server** (Node + Express, `src/server.js`) ha **tutta la logica e tutti i dati**: collega le banche, legge i movimenti, assegna i tag, calcola storico, statistiche e budget, fa gli aggiornamenti automatici. Gira su un NAS (Docker) o dove vuoi.
- **Il frontend** (`public/`: HTML, CSS e JavaScript senza dipendenze) è solo grafica: chiede tutto al server (`/api/…`) e non calcola niente di importante. Lo usano il sito, il localhost e l'app Android.
- **L'app Android** (`android/`, Java, costruita senza Gradle) è una WebView che mostra il frontend (che sta **dentro l'APK**) e parla col server; in più c'è il **widget** della Home.

```
src/       server.js (API) · start.js (avvio del server) · local.js e proxy.js (localhost solo frontend)
           eb.js (client Enable Banking) · banks.js (collegamento, letture, limiti) · tags.js (tag e giroconti)
           stats.js (storico, statistiche, budget, widget) · auth.js (password e gettone) · schedule.js (orari) · store.js (dati)
public/    index.html, style.css, app.js, icon.svg
android/   MainActivity, MyBankWidget, WidgetData, Server; layout e risorse del widget; manifest
scripts/   banca-finta.mjs, demo.mjs, build-apk.mjs
design/    proposte di logo (SVG) e logo scelto
test/      schedule, tags, flow (giro completo con la banca finta), proxy, android (layout del widget e dell'app)
```

## Cosa fa

**Da quando.** Per ora MyBank memorizza e mostra solo i movimenti **dal 1 ottobre 2026**: quelli di prima non si leggono né si salvano (all'avvio il server toglie dai dati quelli già presenti).

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

### Le schede

- **Storico** (principale): l'anno scelto, mese per mese, **entrate**, **uscite** e **bilancio**, con il totale; in alto i tre totali dell'anno, sempre affiancati su tre colonne. Un tocco su un mese mostra le uscite per tag.
- **Movimenti**: l'elenco con filtri (anno, mese, tag, ricerca) e il tag modificabile. Ogni riga è: **data** (giorno e mese, sotto l'anno), **titolo** (la causale se c'è) con sotto il **destinatario** e il conto, **importo**, **categoria**: sul web in quattro colonne, sul telefono in tre (data, titolo e destinatario, importo con sotto la categoria). I pagamenti in sospeso contano subito e hanno una targhetta e una barra rossa a sinistra; le altre righe hanno lo stesso margine, quindi la spaziatura non cambia. Toccando una riga di conto o pocket nella scheda Banche si arriva ai Movimenti filtrati per quel conto o pocket (con «Togli il filtro»).
- **Statistiche**: entrate, uscite e bilancio dell'anno o di un mese; le uscite **per categoria** (importo e quota), **mese per mese** (entrate in una barra verde sottile, uscite in barre divise per categoria; un tocco su un mese lo filtra), **dove vanno i soldi** e **da dove arrivano le entrate** (le otto controparti che pesano di più). I giroconti non contano.
- **Budget**: il budget mensile di Spesa, Svago e Carburante (tre campi affiancati) e, per il mese in corso, residuo, spesa giornaliera stimata e reale (tre riquadri).
- **Banche**: collegamento di UniCredit e Revolut (ogni banca si chiude e si apre; Revolut, con i suoi pocket, parte chiusa); **aggiornamento**: fino a **4 automatici al giorno**, di base alle **5, 11, 14 e 19** (ora italiana), in una riga che sul telefono occupa tutta la larghezza: si tocca un orario per cambiarlo, la × lo toglie, un menu ne aggiunge; più il pulsante **Aggiorna ora** per le letture in più; rinomina dei pocket; credenziali di Enable Banking.
- **Opzioni** (pulsante in alto a destra): in cima **Cambia password** (finestra con la password attuale e due volte la nuova, almeno 5 caratteri; da lì in poi vale la nuova, salvata come impronta in `data/auth.json`, e gli altri accessi devono rifare il login), **Server** con «Cambia server» (solo nell'app e nel localhost) e in fondo **Esci**.

In alto, a sinistra, il logo e il nome; a destra la **versione** (nell'app è quella dell'app, sul web quella del server) e il pulsante Opzioni.

### Widget Android 5×1

Quattro celle **di uguale larghezza** (un solo carattere, sans-serif; fondo inchiostro, testo carta, rosso come accento), ognuna con a sinistra una **barra verticale** larga 14 dp:

- **Mese**: «**19 giorni rimanenti**» e «**aggiornamento 22.45**» (l'ora dell'ultimo aggiornamento delle banche, con la data se non è di oggi). La barra è il tempo che passa: i giorni già trascorsi sono **in basso, in bianco**, e salgono col mese, con un vuoto a fine di ogni domenica. Un tocco apre il **Budget**.
- **Spesa, Svago, Carburante**: il **nome** della categoria, il **residuo del budget** (budget meno speso nel mese), sotto la **spesa giornaliera stimata** (budget diviso i giorni del mese) e la **reale** (speso diviso i giorni passati, oggi compreso; bianca se è pari o migliore della stima, rossa se peggiore). La barra è il residuo: si svuota dall'alto verso il basso, ha tre tacche (25%, 50%, 75%) e diventa rossa quando resta il 20% o meno. Un tocco apre i **Movimenti del mese filtrati per quella categoria**.
- Si aggiorna ogni mezz'ora, quando apri l'app e quando premi «Aggiorna ora»; un tocco fuori dalle celle apre l'app. Se la sessione è scaduta dice «accedi in app». Nella lista dei widget l'anteprima è con dati di esempio (da Android 15 con i dati reali).
- Un widget è fatto di *RemoteViews*: il launcher ammette solo poche classi di view (`FrameLayout`, `LinearLayout`, `ImageView`, `TextView`…; `View` no, dà «Problema nel caricamento del widget»). I layout si modificano a mano e `npm test` controlla che restino validi.

**Limiti delle banche.** Le banche concedono 4 accessi al giorno senza l'utente presente (PSD2): sono esattamente i 4 automatici, per questo gli orari sono al massimo 4. Le letture a mano (fino a 10 al giorno per banca) dichiarano alla banca che c'è una persona presente (intestazioni «PSU») e contano a parte. Il consenso dura al massimo 180 giorni: alla scadenza si ricollega con un tocco.

## Come si avvia

Serve Node 24.

```bash
npm install
cp .env.example .env     # poi imposta MYBANK_PASSWORD (per il server)
npm run server           # il server, su http://127.0.0.1:4870
npm start                # il localhost: solo frontend, sceglie il server al login
npm test                 # i test
```

`MYBANK_PASSWORD` è la password **iniziale**: la cambi dalle Opzioni e da quel momento il valore nel file non conta più. Senza `MYBANK_PASSWORD` il server parte solo su `127.0.0.1` (accesso libero, per provare in locale); su altri indirizzi (`HOST=0.0.0.0`) la password è obbligatoria. Altre variabili: `PORT`, `HOST`, `MYBANK_DATA` (cartella dei dati), `MYBANK_PUBLIC_URL`, `MYBANK_AUTO_HOURS` (orari di base), `MYBANK_NO_AUTO` (spegne gli aggiornamenti automatici), `MYBANK_SERVER` (vedi sotto). I dati del server stanno in `data/` (`mybank.json`, la chiave di firma `secret.key`, `auth.json`); non finiscono mai su GitHub.

**Localhost = solo frontend.** `npm start` non avvia un server: serve soltanto le pagine di questa cartella (le modifiche al codice si vedono subito) e **non ha dati né logica**. Nella pagina di accesso scegli **a quale server collegarti** (indirizzo https, oppure di casa come `192.168.1.20:4870`) e inserisci la password; ogni chiamata (`/api/…`) viene inoltrata a quel server, quindi dati, banche, aggiornamenti e password sono sempre quelli del server e in locale non si legge né si scrive nulla. Il server scelto si ricorda nel browser; **Opzioni → Cambia server** lo cambia. Con `MYBANK_SERVER` nel file `.env` l'indirizzo è già compilato. Se il server è più vecchio del frontend e non ha una funzione nuova, compare «Il server non ha ancora questa funzione: aggiornalo».

**Provare senza banche vere:** `npm run demo` avvia una banca finta e un'app con dati inventati su `http://localhost:4871` (database a parte in `data/demo`, avviso rosso «Dati di prova inventati»).

### Collegare le banche
1. Su [enablebanking.com](https://enablebanking.com) crea un'applicazione (gratis per uso personale) e registra come **indirizzo di ritorno** quello mostrato in *Banche → Enable Banking* (`https://<il tuo server>/api/banks/callback`; per Enable Banking serve https, tranne in prova).
2. In *Banche → Enable Banking* incolla l'**ID** e la **chiave privata** (file `.pem`): restano solo sul server. La chiave si scarica **una sola volta**, quando crei l'applicazione sul sito di Enable Banking, e non si può rivedere; se la perdi crea una nuova applicazione (o una nuova chiave) e aggiorna ID e chiave qui.
3. Premi **Collega UniCredit** / **Collega Revolut**: si apre il sito della banca per autorizzare la sola lettura; al ritorno MyBank legge lo storico dal 1 ottobre 2026.

### Sul server (NAS, Docker)
```bash
docker compose up -d                          # imposta prima MYBANK_PASSWORD in docker-compose.yml
docker compose pull && docker compose up -d   # aggiornamento
```
GitHub costruisce l'immagine `ghcr.io/jstplink/mybank` a ogni push su `main` e a ogni tag `mybank-vX.Y.Z`. Serve un indirizzo https raggiungibile dal telefono (reverse proxy del NAS o simile). L'aggiornamento non richiede altri file: i dati restano in `data/`.

### App Android
```bash
npm run apk              # costruisce android/build/MyBank-<versione>.apk
npm run apk:installa     # costruisce e installa sul telefono (debug wireless attivo)
```
Serve l'SDK Android (si trova da solo in `~/Android/Sdk` o `%LOCALAPPDATA%\Android\Sdk`) e Java 17. Se in `.env` c'è `MYBANK_SERVER` l'indirizzo finisce nell'APK; altrimenti l'app lo chiede alla prima apertura (https, oppure un indirizzo di casa come `192.168.1.20:4870`).
**Il frontend (pagine, script, stile, icona) sta dentro l'APK** (`assets/www`, copiato da `public/` a ogni build) e la WebView lo serve al posto di quello del server; dati e logica sono sul server. Per vedere una modifica alla grafica sul telefono basta ricostruire e installare l'APK; le funzioni nuove che chiedono dati al server richiedono anche il server aggiornato. Dopo il login l'app consegna al widget il gettone di accesso. Il widget si aggiunge dal menu dei widget → MyBank.

## API

Tutte dietro password (cookie o `Authorization: Bearer`), tranne login, versione e il ritorno dalla banca.

| | |
|---|---|
| `POST /api/login`, `POST /api/logout`, `GET /api/session`, `POST /api/password` | accesso e cambio password |
| `GET /api/version` | versione del server |
| `GET /api/summary?year=` | storico: entrate, uscite, bilancio per mese |
| `GET /api/stats?year=&month=` | statistiche: categorie, mesi, controparti, entrate |
| `GET /api/transactions?year=&month=&tag=&q=&account=` | movimenti con tag; `account` = un conto o pocket |
| `PUT /api/transactions/:id/tag` | tag a mano (`null` = automatico) |
| `GET /api/budgets`, `PUT /api/budgets` | budget mensile e stato del mese |
| `GET /api/widget` | dati del widget |
| `GET /api/banks`, `PUT /api/banks/app`, `POST /api/banks/link`, `GET /api/banks/callback`, `DELETE /api/banks/:id` | banche ed Enable Banking |
| `POST /api/banks/sync`, `PUT /api/banks/schedule`, `PUT /api/banks/accounts/:uid/name` | aggiornamenti, orari, nome dei pocket |

## Logo

Tre barre che si accorciano (il budget che si consuma, l'ultima rossa) su fondo inchiostro: `design/logo-scelto.svg`, usato come icona del sito `public/icon.svg`, a sinistra del nome nell'app web e come icona adattiva di Android `android/res/drawable/ic_foreground.xml`. Le altre proposte (compresa quella con cerchio e quadrato in contorno) sono in `design/`.

## Estetica

Stile tipografico da giornale svizzero: **carta e inchiostro** (chiaro e scuro come il sistema), un solo **rosso vermiglio** come accento, **angoli vivi** e filetti (1px sottili, 2px a inizio sezione), numeri grandi in **serif**, etichette in **monospazio maiuscolo**, testo in sans. Scala del testo: 11 etichette · 13 secondario · 15 testo, campi e pulsanti · 22 titoli · 34 numeri (28 sul telefono; i tre totali dello Storico sono più grandi). Pulsanti: primario = inchiostro pieno (rosso al passaggio), secondario = solo filetto, link = sottolineato rosso; schede = sottolineatura rossa spessa. Il widget è la stessa pagina in piccolo: fondo inchiostro, testo carta, un solo carattere sans-serif.

## Sicurezza e dati

- Il server è protetto da una sola **password**; la prima è quella di `MYBANK_PASSWORD` (nel `docker-compose.yml` c'è un segnaposto: **cambiala subito** da Opzioni → Cambia password). Dopo 8 tentativi sbagliati in 10 minuti l'accesso da quell'indirizzo si blocca per un po'.
- L'**ID e la chiave privata di Enable Banking** stanno solo nel server (`data/mybank.json`) e non tornano mai all'interfaccia. Le banche si leggono **solo in lettura**: MyBank non può spostare denaro.
- Il **widget** e l'app usano un gettone firmato, valido 180 giorni, che decade quando cambi la password.
- **Backup**: basta copiare la cartella `data/` del server (movimenti, tag scelti a mano, budget, collegamenti, password). Non va mai su GitHub (è in `.gitignore`, come `.env`).

## Problemi frequenti

| Sintomo | Causa e rimedio |
|---|---|
| «Il server non ha ancora questa funzione» | Il server è più vecchio dell'app: `docker compose pull && docker compose up -d`. |
| «Redirect URI not allowed» collegando la banca | L'indirizzo di ritorno non è registrato su Enable Banking: apri MyBank dall'indirizzo https pubblico e registra esattamente quello mostrato in *Banche → Enable Banking* (finisce con `/api/banks/callback`); si può fissare con `MYBANK_PUBLIC_URL`. |
| La password è ancora quella del file | La password cambiata dalle Opzioni sostituisce quella di `MYBANK_PASSWORD`; se non l'hai cambiata vale ancora il segnaposto del `docker-compose.yml`. Per tornare a quella del file, cancella `data/auth.json` e riavvia. |
| Dopo un aggiornamento la pagina del browser sembra vecchia | La pagina non si tiene in cache ma il browser può avere il vecchio script: ricarica con Ctrl+F5. |
| Il widget dice «Problema nel caricamento» | Nel layout c'è una view non ammessa nei RemoteViews: lancia `npm test`. |
| Il widget dice «accedi in app» | La sessione è scaduta: apri l'app e fai il login. |
| Il widget o l'app non si aggiornano sul telefono | `npm run apk:installa` con il debug wireless attivo; se `adb` non vede il telefono, ripeti l'abbinamento (Opzioni sviluppatore → Debug wireless). L'app Android firmata con una chiave diversa non si aggiorna: va disinstallata e reinstallata (la chiave di debug sta in `~/.android/debug.keystore`). |
| Un movimento è «Non definito» | Viene da un pocket senza nome riconosciuto o da UniCredit: dai un nome al pocket con **Rinomina** (es. «01 Spesa») o scegli il tag a mano. |

## Versioni e rilascio

Ogni modifica alza la versione (`package.json`) e aggiunge una voce a `CHANGELOG.md`; il tag Git è `mybank-vX.Y.Z` (i tag `vX.Y.Z` sono della vecchia app Bilancio). Dopo un push GitHub costruisce l'immagine Docker; il NAS si aggiorna con `docker compose pull && docker compose up -d`; il telefono con `npm run apk:installa`.
