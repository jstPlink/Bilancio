# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `vX.Y.Z`.

## 0.6.0
- Nuove colonne **Svago** e **Carburante**, accanto a Spese; entrano nel totale spese e nel saldo.
- Nuova scheda **Movimenti**: carica l'estratto conto in CSV (Revolut o altre banche). Le uscite vengono categorizzate (cibo, casa, svago, carburante) e sommate per mese nelle colonne. Cambiando la categoria di un movimento, l'app la ricorda per quelli con la stessa descrizione.
- Tabella: "Mese" alla stessa altezza di Guadagno e Riepilogo, colonna dei mesi dello stesso colore del Riepilogo, Totale spese e Saldo allineati dentro la griglia.

## 0.5.0
- Dati in un database SQLite (`data/bilancino.db`) al posto del file JSON: chi apre il link vede sempre gli stessi dati. Il vecchio `db.json` viene importato in automatico al primo avvio.
- Aggiunti `Dockerfile` e `docker-compose.yml` per lanciare l'app sul NAS (variabili `HOST`, `PORT`, `BILANCINO_DATA`).

## 0.4.0
- Pagina più larga, per far stare tutte le colonne.
- Le celle sono solo lo sfondo colorato (verde pagato, rosso da pagare): tolta l'icona della spunta.
- Gli importi non si modificano più dalla tabella: arrivano solo dai documenti (e dalle rate fisse di affitto e prestito). Unica eccezione, provvisoria: la colonna "Spese".
- Passando il mouse su una cella compare il link al PDF originale.

## 0.3.0
- Ogni cella con un importo è ora una casella colorata: clic = pagato (verde) / da pagare (rosso). La matita in cella apre la modifica dell'importo.
- Colonna "Spese": valore mensile inserito a mano direttamente nella cella (temporaneo, non ha stato "pagato").
- All'apertura l'app cerca documenti nuovi o modificati e, se ci sono, li analizza mostrando una targhetta con l'avanzamento.

## 0.2.0
- La versione dell'app compare accanto al nome e in `/api/version`.
- Aggiunto questo changelog.

## 0.1.0
- Prima versione: lettura di buste paga e bollette in PDF da cartella locale o link Seafile pubblico, con OCR per le scansioni.
- Panoramica annuale con spunte "pagato", medie, totale da pagare e saldo mensile.
- Colonne Stipendio, Acqua, Luce, Gas, Wifi, Affitto, Prestito, Spese; mesi da gennaio a dicembre.
- Scheda Documenti per correggere o ignorare i file letti male.
