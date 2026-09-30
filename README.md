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
3. Clicca una cella per correggere l'importo, segnarla come pagata o aprire il PDF.
4. Nella scheda **Documenti** trovi i file letti male (*Da controllare*): con **Modifica**
   correggi tipo, periodo e importo; la correzione sopravvive ai successivi aggiornamenti.

## Come legge i PDF

`src/parsers.js` cerca etichette tipiche ("Netto in busta", "Totale da pagare", "Data emissione",
parole chiave come *kWh*, *Smc*, *servizio idrico*, *fibra*…). Se un fornitore usa un layout
diverso basta aggiungere l'etichetta alle liste in quel file. Il testo estratto da ogni PDF è
visibile nella finestra di modifica del documento, utile per capire cosa non torna.
I PDF scansionati (solo immagine) non contengono testo e vanno inseriti a mano.

## Dati e privacy

Tutto resta sul tuo computer, in `data/db.json` (ignorato da git, come i PDF).
Il server ascolta solo su `127.0.0.1`.
