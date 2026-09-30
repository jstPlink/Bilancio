# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `vX.Y.Z`.

## 0.21.0
- **Avviso "lettura in corso"**: se i documenti vengono letti da qualcun altro (un altro browser, lo script di importazione, un altro dispositivo), la pagina se ne accorge da sola, mostra una fascia gialla con avanzamento ("Lettura dei documenti in corso: 50 su 275. I dati sono parziali e si aggiornano da soli"), si ricarica ogni 20 secondi e avvisa quando ha finito. Il pulsante Aggiorna resta bloccato finché la lettura non termina.
- Nuovo script `scripts/importa-su-server.mjs`: sposta i dati già compilati da un database locale a un server Bilancio (es. sul NAS) usando le sue API. Copia le impostazioni, fa rileggere documenti ed estratti conto al server e riporta correzioni ai documenti, categorie scelte a mano e spunte "pagato"; alla fine confronta i totali. Rifiuta di scrivere su un server che ha già dati, salvo `--force`.

## 0.20.0
- **Installazione da GitHub con Docker Compose**: un workflow GitHub Actions prova i test, costruisce l'immagine (amd64 e arm64) e la pubblica su `ghcr.io/jstplink/bilancio` a ogni push su main e a ogni tag. `docker-compose.yml` ora scarica quell'immagine; `docker-compose.build.yml` costruisce invece dal codice su GitHub, senza registro.
- README: istruzioni per avviare, aggiornare e portare i dati sul server.

## 0.19.0
- **Niente dati personali nel codice**: il mio nome e chi mi paga lo stipendio (usati per riconoscere i giroconti e non contare due volte lo stipendio) non sono più scritti nel codice ma nelle **Impostazioni** ("Riconoscere i miei movimenti"), cioè nel database, che non viene pubblicato. I test usano nomi inventati.
- Dockerfile: variabili di produzione, niente avvisi di Node sul modulo SQLite e controllo di salute del container. README: come portare sul server il database locale.

## 0.18.0
- Nuova categoria **Da suddividere**: non conta in nessun dato e ha la sua tabella nella scheda Banca. Ci finiscono in automatico gli addebiti SEPA di **PayPal** (coprono acquisti diversi) finché non vengono divisi in sotto-categorie. Spostati i 16 esistenti (1.157,06 €).

## 0.17.0
- **Abbinamento automatico addebiti–bollette**: un addebito bancario di un'utenza (Enel, Edison, Reset, addebiti SEPA…) con lo stesso importo di una bolletta già letta, e data da 1 mese prima a 3 mesi dopo, passa alla nuova categoria **Bollette pagate** e non conta due volte. Nella scheda Banca la tabella mostra a quale documento è stato abbinato. Una bolletta assorbe un solo pagamento, e le scelte fatte a mano non vengono toccate.
- Le categorie escluse dai dati (Giroconti e Bollette pagate) hanno ciascuna la propria tabella nella scheda Banca.

## 0.16.0
- **Rata del prestito dagli estratti conto**: le righe "PAGAMENTO RATA MUTUO/PRESTITO…" di UniCredit vengono riconosciute in automatico (nuova categoria **Prestito**) e alimentano la colonna Prestito della pagina principale. Niente più importo manuale nelle Impostazioni, e la colonna non ha più lo stato pagato / da pagare (è già addebitata).
- Nel grafico bancario "Dove va il denaro" compare la voce Prestito.

## 0.15.0
- L'app si chiama **Bilancio** (titolo, intestazione, README, Docker, pacchetto). Le variabili d'ambiente diventano `BILANCIO_DATA` e `BILANCIO_DB` (le vecchie `BILANCINO_*` funzionano ancora); il file del database resta `data/bilancino.db`.
- La scheda **Banca** si apre sull'**anno corrente** invece che su tutti gli anni ("Azzera filtri" torna a questo stato).
- Nuova categoria **Giroconti**: i soldi spostati tra i miei conti non contano in nessun dato (né entrate né uscite, né tabella, né grafici, né riquadri) e stanno in una tabella a parte nella scheda Banca. Riconosciuti in automatico quando il beneficiario o l'ordinante sono io; le entrate che prima erano "Altro" (ignorate) diventano Giroconti.

## 0.14.1
- Il gruppo **Uscite** non si comprime più: le colonne per gruppo sono sempre visibili.
- **Bollette** si apre e si chiude cliccando su tutta la cella dell'intestazione (prima c'era solo una freccina): pulsante grande, con freccia e promemoria "apri/chiudi".

## 0.14.0
- **Tabella principale riorganizzata** in quattro gruppi: Mese, **Entrate** (stipendio + altre entrate dalla banca, sommati), **Uscite** e **Riepilogo** (Totale spese e Saldo).
- **Uscite comprimibili**: ▾ / ▸ su "Uscite" le riduce a un solo totale; i gruppi sono Bollette, Affitto, Prestito, Spesa, Svago, Carburante, Donazioni e Tasse, e "Bollette" si apre nelle sue voci (acqua, luce e gas per casa, wifi). Da chiusa, la cella Bollette segna pagate tutte le voci insieme. Lo stato aperto/chiuso viene ricordato.
- I dati della scheda Banca (spesa, svago, carburante, donazioni, tasse, altre entrate) ora sono nella tabella principale e contano in Totale spese e Saldo. I movimenti categorizzati come "Altro" restano fuori.
- I riquadri mostrano "Entrate medie" (stipendio + altre entrate).

## 0.13.0
- **Entrate bancarie**: gli estratti conto (PDF UniCredit e Revolut, CSV) ora importano anche i soldi ricevuti, non solo le uscite. Nel grafico "Stipendio contro uscite" c'è una seconda linea, **Altre entrate**, più una colonna nella tabella dei numeri e un riquadro.
- Le entrate si dividono in **Entrate** (contano) e **Altro** (ignorate): i giri tra i miei conti, PayPal istantaneo e i bonifici dal datore di lavoro (già nelle buste paga) finiscono in automatico tra le ignorate. Dalla scheda Banca si può cambiare la scelta, e l'app la ricorda.
- Revolut: corretta la lettura dei nomi su due righe, con l'importo sulla riga sotto.
- Movimenti: importi con il segno (+ entrate, − uscite).
- Al primo avvio gli estratti conto già letti vengono riletti una volta per prendere le entrate.

## 0.12.1
- Scheda Banca: scegliendo un anno non ancora concluso i grafici mostrano comunque tutti e 12 i mesi, quelli futuri vuoti (anche nella tabella dei numeri). Con un solo anno le etichette dei mesi si vedono tutte.

## 0.12.0
- Nuova categoria **Tasse** (Agenzia delle Entrate, F24, IMU, TARI, bollo, INPS, multe, canone Rai, causali "tassa"…): come Donazioni, compare nella scheda Banca e nei grafici ma non ha una colonna nella tabella principale.

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
