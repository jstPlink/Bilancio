# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `vX.Y.Z`.

## 0.11.0
- Nuova categoria **Donazioni** (Telethon, Amnesty, Greenpeace, Save the Children, WWF, Terre des Hommes, addebiti "donazione onlus"…): compare nella scheda Banca, nei grafici e nel menu delle categorie, ma non ha una colonna nella tabella principale.
- I movimenti già salvati che corrispondono (50, per 908 €) sono stati spostati in Donazioni.

## 0.10.1
- I pedaggi ("autostrada", "Autostrade per l'Italia") vanno in **Svago** invece che in Carburante.

## 0.10.0
- La scheda **Analisi** diventa **Banca**, non più temporanea.
- Filtri per **anno** e **mese** (anche "marzo di ogni anno"); clic su una colonna dei grafici per filtrare quel mese.
- **Ordinamento** delle colonne per data, quantità e importo (clic sull'intestazione, di nuovo per invertire), nella scheda Banca e in Movimenti.
- **Grafici** (SVG, senza librerie esterne): stipendio contro uscite (bollette e affitto dai documenti, spesa/svago/carburante dalla banca), uscite bancarie per categoria mese per mese, le 10 voci più pesanti; tooltip al passaggio e tabella dei numeri sotto i grafici.

## 0.9.0
- **Luce e gas in due colonne** (Budrio e Crispiano): ognuna con il proprio documento, la propria spunta "pagato", media e totale da pagare. Acqua e wifi restano una colonna sola, con il dettaglio per casa sotto l'importo. Tolto il selettore "Bollette di", ormai superfluo.
- **Celle divise in due al passaggio del mouse**: a sinistra "Apri" il documento (con più documenti, una sezione per ciascuno, B/C per casa), a destra ✓ / ↺ per segnare pagato o da pagare. Da tastiera: Tab sulla cella e poi sui link.

## 0.8.1
- Bollette: l'aggiornamento salta le cartelle chiamate "documenti" (a qualsiasi livello, maiuscole indifferenti). I file già letti da lì vengono tolti al prossimo "Aggiorna".

## 0.8.0
- **Estratti conto in PDF**: lettura dei PDF UniCredit (trimestrali) e Revolut dal link/cartella degli estratti conto. Uscite ed entrate si distinguono dalla posizione delle colonne; per UniCredit le uscite e le entrate lette vengono confrontate col riepilogo della banca e, se non tornano, l'aggiornamento lo segnala. Revolut: contano solo i pagamenti con carta (trasferimenti tra pocket, ricariche e bonifici sono esclusi).
- **Bollette per casa**: Budrio e Crispiano si distinguono dalla cartella. Selettore "Bollette di: Tutte / Budrio / Crispiano" sopra la tabella; in "Tutte" ogni cella mostra il totale e, sotto, il dettaglio per casa. La spunta "pagato" è per casa. Totale spese, saldo e riquadri restano sempre complessivi.
- Il riquadro **Da pagare** è ora un pulsante: un clic (con conferma) salda tutto, di tutti gli anni e di tutte le case.
- Nuove parole chiave per le categorie (Spar, Ecu, ristoranti, giocattoli).

## 0.7.0
- Nuovo campo **Estratti conto** nelle impostazioni: link Seafile pubblico o cartella locale con i CSV della banca. "Aggiorna" legge solo i file nuovi o modificati e non duplica i movimenti.
- Nuova scheda temporanea **Analisi**: tutti i movimenti di tutti gli anni, smistati per voce con totale, numero e percentuale, e raggruppati per descrizione. Da qui si corregge la categoria di una descrizione (vale per tutte quelle uguali).
- Categorie semplificate: **Spesa** (cibo, bevande, prodotti per la casa, nella colonna Spese), **Svago** (abbonamenti TV, Amazon, parchi, televisori, giocattoli), **Carburante**, **Altro** (non conta). I movimenti già salvati come cibo/casa diventano Spesa.

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
