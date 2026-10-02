# Bilancio

Buste paga, bollette e spese di casa, in ordine.

Bilancio legge i PDF di buste paga e bollette e gli estratti conto della banca da una cartella (o da un link Seafile),
ne ricava tipo, mese e importo e li mostra in una panoramica per anno: entrate, uscite, bilancio mensile e quanto resta
da pagare. Si usa dal browser, anche dal telefono, e i dati restano sul tuo computer o sul tuo server.

## Avvio

```bash
npm install
npm start        # http://localhost:4870
npm test
```

Di norma il localhost va collegato al tuo server: vedi «Localhost che punta al server» più sotto.

## Le schede

- **Panoramica.** Una tabella per anno (si sceglie dalla tendina *Anno*) con quattro colonne: **Mese**, **Entrate** (stipendio più altre
  entrate in banca), **Uscite** e **Bilancio**. Sotto le uscite del mese compare quante voci restano da pagare. Su schermo largo le **Uscite** sono sempre aperte
  nelle loro voci: *Bollette* (acqua, luce, gas e wifi; le voci di *Crispiano* in una sola
  colonna), *Affitto*, *Prestito*, *Spesa*, *Svago*, *Carburante*, *Donazioni*, *Tasse*. In fondo ci sono la media e l'importo ancora
  da pagare di ogni colonna; il riquadro **Da pagare** in alto salda tutto con un clic.
  - Le celle che vengono da un documento (bollette, affitto) sono **verdi se pagate e rosse se da pagare**. Un clic cambia lo stato;
    passandoci sopra con il mouse la cella si divide: a sinistra **Apri** il PDF originale, a destra segni pagato o da pagare.
  - Gli importi non si modificano a mano: arrivano dai documenti, dall'affitto fisso nelle impostazioni e dalla banca. Fanno eccezione
    *Spesa*, *Svago* e *Carburante*, dove si può correggere il totale del mese.
- **Movimenti.** I movimenti dell'estratto conto con la loro suddivisione: riquadri per categoria (un clic filtra), filtri per anno e mese,
  ricerca e due viste, *Movimenti* (uno per riga) e *Per descrizione* (raggruppati per categoria e descrizione uguale). Sotto ogni descrizione
  si vedono giorno e ora, metodo (carta, bonifico, prelievo…), commissione e valuta; cliccando la riga si apre il dettaglio con il saldo dopo
  il pagamento, il testo completo della banca, gli altri pagamenti con la stessa descrizione e i link per cercarla su Google e su Maps. Dal
  menu si cambia la categoria: l'app la ricorda per tutte le descrizioni uguali. Da qui si può anche caricare un CSV a mano.
- **Statistiche.** I grafici: stipendio contro uscite mese per mese, dove va il denaro della banca per categoria, le 10 voci più pesanti,
  e la tabella dei numeri. Un clic su un mese lo imposta come filtro.
- **Documenti.** L'elenco dei PDF letti. Quelli letti male sono segnati *Da controllare*: con **Modifica** correggi tipo, periodo e importo
  (la correzione sopravvive agli aggiornamenti) oppure scegli **Ignora** per i file che non c'entrano.

Sul telefono la tabella diventa un elenco di schede, una per mese, con le sole voci compatte (Entrate, Uscite, Bilancio); il dettaglio delle
uscite resta per lo schermo largo. Anche Movimenti mostra un riquadro per ogni pagamento e i grafici stanno nella larghezza dello schermo.

**App sul telefono.** Bilancio è installabile come app (PWA): apri il sito con Chrome (Android: menu → *Installa app*) o Safari (iPhone:
Condividi → *Aggiungi a Home*) e si apre a schermo intero con la sua icona. Serve un indirizzo https. I dati restano sempre sul server,
nulla viene salvato sul telefono. Le icone si rigenerano con `node scripts/genera-icone.mjs`.

## Uso

1. Apri **Impostazioni** (ingranaggio) e indica dove si trovano i documenti:
   - **Buste paga**, **Bollette** ed **Estratti conto**: un link di condivisione Seafile pubblico (`https://…/d/xxxx/`, senza password)
     oppure un percorso locale. Le sottocartelle vengono lette in automatico.
   - **Affitto**: importo mensile e mese di inizio, aggiunto in automatico ogni mese.
   - **Riconoscere i miei movimenti**: il tuo nome e chi ti paga lo stipendio, per non contare i giroconti tra i tuoi conti né lo stipendio
     due volte. Restano sul tuo database.
2. Premi **Aggiorna**: vengono letti solo i file nuovi o modificati (Maiusc + clic per rileggere tutto). La stessa ricerca parte da sola
   **ogni volta che apri l'app**: una targhetta in alto mostra l'avanzamento, e se la lettura la sta facendo qualcun altro (un altro browser,
   lo script di importazione) compare una fascia gialla con i dati parziali che si aggiornano da soli.
3. Controlla la scheda **Documenti** per i file *Da controllare*.

## Estratti conto (spese)

Indica il link (Seafile pubblico o cartella locale) degli estratti conto nelle impostazioni, campo **Estratti conto**, e premi **Aggiorna**;
oppure carica un CSV a mano dalla scheda **Movimenti** (Revolut: Conti → Estratti → Excel/CSV). Gli estratti in PDF (UniCredit e Revolut) si
leggono dallo stesso link: per UniCredit l'app confronta le uscite lette con il riepilogo della banca. Per un'altra banca serve un nuovo
lettore in `src/pdfstatements.js`. Ricaricare lo stesso file non duplica nulla.

Del CSV Revolut l'app conserva anche orario, tipo di operazione, conto, commissione, valuta e saldo dopo il pagamento: servono a capire
di che pagamento si tratta. I movimenti già salvati si completano da soli alla lettura successiva, senza toccare le categorie.

Le uscite si categorizzano con parole chiave in `src/statements.js`:

- **spesa** (cibo, bevande, casa) va nella colonna *Spesa*; **svago** e **carburante** nelle loro colonne;
- **prestito** (la rata del mutuo) alimenta la colonna *Prestito*; **donazioni** e **tasse** hanno le loro;
- **giroconti** (soldi tra i propri conti), **bollette pagate** (addebiti già contati nei documenti) e **da suddividere** (es. addebiti PayPal)
  non contano in nessun dato; **altro** resta fuori dalla tabella e si vede nella scheda Movimenti.

Le entrate ricevute (bonifici da terzi) compaiono come **Altre entrate**; i giri tra i propri conti, le ricariche e le entrate dal datore di
lavoro (già nelle buste paga) sono ignorati.

## Più case

Le bollette in sottocartelle chiamate `Budrio` o `Crispiano` sono tenute separate: luce e gas hanno una colonna per casa; acqua e wifi
sommano le case e mostrano il dettaglio nella cella.

## Come legge i PDF

`src/parsers.js` cerca etichette tipiche ("Netto in busta", "Totale da pagare", "Data emissione", parole chiave come *kWh*, *Smc*,
*servizio idrico*, *fibra*…). Se un fornitore usa un layout diverso basta aggiungere l'etichetta alle liste in quel file. Il mese di una
bolletta è quello scritto nel nome del file (es. `Acqua 2025.10.pdf`); per un intervallo vale l'ultimo mese. Se esistono più file per la
stessa cella, contano solo quelli con il mese nel nome. Il testo estratto da ogni PDF è visibile nella finestra di modifica del documento,
utile per capire cosa non torna.

**Scansioni.** I PDF che sono solo immagini si leggono con l'**OCR** (Tesseract, in italiano; il dizionario si scarica la prima volta e resta in
`data/tessdata`). Se la prima lettura è incompleta si riprova a risoluzione più alta; se anche così manca un dato, il documento resta *Da
controllare*.

## Dati e privacy

Tutto sta in un database SQLite, `data/bilancino.db` (ignorato da git, come i PDF). Un eventuale `data/db.json` della
versione precedente viene importato al primo avvio. In locale il server ascolta solo su `127.0.0.1`.

## Docker / NAS

Serve solo Docker con Compose, non Node. Ci sono due modi per avviarlo da GitHub.

**1. Immagine già pronta (consigliato).** A ogni versione GitHub costruisce l'immagine (per PC/NAS Intel e ARM) e la
pubblica su `ghcr.io/jstplink/bilancio`. Sul server:

```bash
mkdir bilancio && cd bilancio
curl -O https://raw.githubusercontent.com/jstPlink/Bilancio/main/docker-compose.yml
docker compose up -d                        # http://<ip-server>:4870
```

Per aggiornare: `docker compose pull && docker compose up -d`.
Se il download dell'immagine risponde "denied" o "unauthorized", il pacchetto è ancora privato: su GitHub apri
*Packages → bilancio → Package settings → Change visibility → Public* (si fa una volta sola dopo il primo build).

**2. Costruzione dal codice, senza registro.** Scarica il codice da GitHub e costruisce l'immagine sul server:

```bash
curl -O https://raw.githubusercontent.com/jstPlink/Bilancio/main/docker-compose.build.yml
docker compose -f docker-compose.build.yml up -d --build
```

**Portare sul server i dati già compilati in locale.** Con il server avviato e vuoto, dalla cartella del progetto (serve Node 24):

```bash
node scripts/importa-su-server.mjs https://indirizzo-del-server
```

Lo script copia le impostazioni, fa rileggere al server documenti ed estratti conto, riporta correzioni, categorie scelte a mano e spunte "pagato", poi confronta i totali. Se il server ha login, aggiungi `utente:password`. In alternativa copia a mano `data/bilancino.db` (vedi sotto).

**Dati.** Il database e la cache OCR stanno in `./data` (montato su `/data`): fanne il backup. Per portare sul server i dati
che hai in locale, chiudi l'app e copia `data/bilancino.db` nella cartella `./data` accanto al file compose: dentro ci sono
anche le Impostazioni (link dei documenti, nome, datore di lavoro) e le categorie corrette a mano. Senza database, al primo
avvio apri le Impostazioni e inserisci i link.

**Sicurezza.** Il sito è protetto da una password che crei al primo accesso (sezione successiva): **creala subito dopo l'avvio**, perché finché non
esiste chiunque apra il sito può sceglierla. Per usare un percorso locale come sorgente PDF, monta la cartella nel container
(vedi il file compose) e indica il percorso interno (es. `/documenti`).

## Password di accesso

L'app è sempre protetta da una password.

- **Prima volta:** apri il sito e la pagina di accesso ti chiede di **creare la password** (almeno 4 caratteri, da ripetere; meglio di più se il sito è su internet).
  Fallo appena avvii l'app, soprattutto se è su internet: finché la password non esiste, chiunque apra il sito può crearla.
- **Dopo:** ogni browser nuovo chiede la password, poi la sessione dura 30 giorni. Il pulsante **Esci** in alto la chiude.
- La password è salvata **cifrata** (scrypt) nel database, non in chiaro, e non viene mai pubblicata. Cambiandola, le sessioni
  aperte decadono.
- Dopo 5 password sbagliate lo stesso indirizzo è bloccato per 15 minuti.
- Usa sempre **https** (con Cloudflare o un reverse proxy): la password viaggia nella richiesta di accesso.

**Password dimenticata.** Ferma l'app e cancella la password: alla riapertura potrai crearne una nuova.

```bash
node scripts/reimposta-password.mjs                 # in locale
docker compose stop && docker compose run --rm --no-deps bilancio node scripts/reimposta-password.mjs && docker compose up -d
```

**Password fissata dall'ambiente (facoltativo).** Se preferisci non crearla dall'app, imposta `BILANCIO_PASSWORD`: nel file compose,
sotto `environment`, oppure in locale in un file `.env` (copia `.env.example`). Ha la precedenza su quella creata nell'app.

**Script.** `scripts/importa-su-server.mjs` e simili usano l'autenticazione HTTP Basic: `utente:password`, dove l'utente può essere
qualsiasi nome e conta solo la password.

## Localhost che punta al server

**Regola: l'app lanciata in localhost deve puntare al server di casa**, non usare un database proprio. Così dati, password e documenti letti
sono un'unica copia, quella del server, e in locale vedi esattamente i dati che hai online. Con `BILANCIO_SERVER` il localhost serve **le pagine
di questa cartella** (HTML, JavaScript, stile: le modifiche al codice si vedono subito) e **inoltra al server i dati e il login** (tutto ciò che
passa da `/api/`). Nel file `.env` (copia `.env.example`) scrivi:

```
BILANCIO_SERVER=https://indirizzo-del-tuo-server
```

Con `npm start` (o `npm run dev`) `http://localhost:4870` mostra allora le pagine locali con i dati, il login e la password del server; in locale non si
legge né si scrive nessun dato. Accanto al nome compare la versione locale e «locale» (passando il mouse, anche quella del server).
Il file `.env` resta sul tuo computer (è escluso da Git): l'indirizzo del server non va scritto nel codice né in questa documentazione.
Per tornare a un'app locale con database proprio (solo per provare), togli la riga.

Le pagine nuove lavorano sui dati del server: quelle che dipendono da codice del server (per esempio nuovi campi dei movimenti, che l'estratto
conto salva) hanno effetto completo solo dopo aver aggiornato anche il server.

## Sviluppo e rilascio

```
public/        pagine (index.html, app.js, charts.js, style.css, login.html)
src/           server Express: server.js, grid.js (tabella), scanner.js (lettura dei file), parsers.js (PDF),
               statements.js e pdfstatements.js (banca), billmatch.js, ocr.js, sources.js (cartelle e Seafile), auth.js, store.js
scripts/       importa-su-server.mjs, reimposta-password.mjs
test/          node --test
```

- `npm test` dopo ogni modifica a `src/`; `npm run dev` riavvia da solo il server quando cambia il codice.
- **A ogni push la versione sale**: `npm version <x.y.z> --no-git-tag-version`, una voce in `CHANGELOG.md`, commit e tag `vX.Y.Z` (push anche dei tag).
  La versione compare accanto al nome nell'app.
- I file `.env` e `data/` non vanno mai in Git; l'indirizzo del server e le password stanno solo lì.
