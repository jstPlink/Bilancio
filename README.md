# Bilancino

Buste paga e bollette di casa, in ordine.

Bilancino legge i PDF di buste paga e bollette da una cartella, ne estrae tipo, mese e importo
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
3. Passa il mouse su una cella: a sinistra apri il PDF, a destra la segni pagata o da pagare.
4. Nella scheda **Documenti** trovi i file letti male (*Da controllare*): con **Modifica**
   correggi tipo, periodo e importo; la correzione sopravvive ai successivi aggiornamenti.

## Estratti conto (spese)

Indica il link (Seafile pubblico o cartella locale) dei CSV nelle impostazioni, campo **Estratti conto**, e premi **Aggiorna**;
oppure carica un CSV a mano dalla scheda **Movimenti** (Revolut: Conti → Estratti → Excel/CSV). Contano solo le uscite
completate; bonifici, ricariche e rimborsi sono esclusi. Le categorie vengono assegnate da parole chiave in `src/statements.js`:
**spesa** (cibo, bevande, casa) va nella colonna Spese, **svago** e **carburante** nelle loro colonne, **altro** non conta.
La scheda temporanea **Analisi** mostra come sono smistati tutti i movimenti e permette di correggere la categoria: l'app la
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

```bash
docker compose up -d --build   # http://<ip-nas>:4870
```

I dati stanno in `./data` (montato su `/data`): fanne il backup. Con `HOST=0.0.0.0` il server è raggiungibile in rete
senza autenticazione: tienilo dietro la LAN o una VPN. Per usare un percorso locale come sorgente PDF, monta la cartella
nel container (vedi `docker-compose.yml`) e indica il percorso interno (es. `/documenti`).
