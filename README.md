# Bilancio

Buste paga e bollette di casa, in ordine.

Bilancio legge i PDF di buste paga e bollette da una cartella, ne estrae tipo, mese e importo
e li mostra in una panoramica per anno: stipendi, acqua, luce, gas, wifi, affitto, con medie,
saldo mensile e quanto resta da pagare.

## Avvio

```bash
npm install
npm start        # http://localhost:4870
npm test
```

## Uso

1. Apri **Impostazioni** (ingranaggio) e indica dove si trovano i documenti:
   - **Buste paga** e **Bollette**: un link di condivisione Seafile pubblico (`https://…/d/xxxx/`,
     senza password) oppure un percorso locale. Le sottocartelle vengono lette in automatico.
   - **Affitto**: importo mensile e mese di inizio, aggiunto in automatico ogni mese.
2. Premi **Aggiorna**: vengono letti solo i PDF nuovi o modificati
   (Maiusc + clic per rileggere tutto).
3. La tabella ha quattro gruppi: Mese, Entrate, Uscite (per gruppo; la cella Bollette si apre e si chiude con un clic e mostra le voci) e Riepilogo. Passa il mouse su una cella delle bollette: a sinistra apri il PDF, a destra la segni pagata o da pagare.
4. Nella scheda **Documenti** trovi i file letti male (*Da controllare*): con **Modifica**
   correggi tipo, periodo e importo; la correzione sopravvive ai successivi aggiornamenti.

## Estratti conto (spese)

Indica il link (Seafile pubblico o cartella locale) dei CSV nelle impostazioni, campo **Estratti conto**, e premi **Aggiorna**;
oppure carica un CSV a mano dalla scheda **Movimenti** (Revolut: Conti → Estratti → Excel/CSV). Le uscite si categorizzano (vedi sotto); le entrate ricevute (bonifici da terzi) compaiono come **Altre entrate** nei grafici, mentre i giri tra i propri conti, le ricariche e le entrate dal datore di lavoro (già nelle buste paga) sono ignorati. Le categorie vengono assegnate da parole chiave in `src/statements.js`:
**spesa** (cibo, bevande, casa) va nella colonna Spese, **svago** e **carburante** nelle loro colonne; **giroconti** (soldi tra i propri conti), **bollette pagate** (addebiti già contati nei documenti) e **da suddividere** (es. addebiti PayPal) non contano in nessun dato; **donazioni**, **tasse** e **altro** restano fuori dalla tabella e si vedono nella scheda Banca.
La scheda **Banca** mostra come sono smistati i movimenti (filtri per anno e mese, colonne ordinabili, grafici che incrociano stipendio, bollette e spese) e permette di correggere la categoria: l'app la
ricorda per le descrizioni uguali. Ricaricare lo stesso file non duplica nulla. Gli estratti conto in PDF (UniCredit e Revolut) si leggono dallo stesso link: per UniCredit l'app confronta le uscite lette con il riepilogo
della banca. Per un'altra banca serve un nuovo lettore in `src/pdfstatements.js`.

## Più case

Le bollette in sottocartelle chiamate `Budrio` o `Crispiano` sono tenute separate: luce e gas hanno una colonna per casa; acqua e wifi sommano le case e mostrano il dettaglio nella cella.

## Come legge i PDF

`src/parsers.js` cerca etichette tipiche ("Netto in busta", "Totale da pagare", "Data emissione",
parole chiave come *kWh*, *Smc*, *servizio idrico*, *fibra*…). Se un fornitore usa un layout
diverso basta aggiungere l'etichetta alle liste in quel file. Il testo estratto da ogni PDF è
visibile nella finestra di modifica del documento, utile per capire cosa non torna.
I PDF scansionati (solo immagine) non contengono testo e vanno inseriti a mano.

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

**Sicurezza.** Il sito è protetto da una password che crei al primo accesso (sezione successiva): per farlo da internet serve il codice che il
server scrive nel log all'avvio (`docker logs bilancio`). Per usare un percorso locale come sorgente PDF, monta la cartella nel container
(vedi il file compose) e indica il percorso interno (es. `/documenti`).

## Password di accesso

L'app è sempre protetta da una password.

- **Prima volta:** apri il sito e la pagina di accesso ti chiede di **creare la password** (almeno 10 caratteri, da ripetere).
  Da `http://localhost:4870` sul tuo computer basta questo. Da qualsiasi altro indirizzo (il sito sul server, il NAS, internet)
  serve anche il **codice di configurazione**, che il server scrive nel suo log all'avvio: in Docker `docker logs bilancio`.
  Così nessun estraneo può crearla al tuo posto.
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
