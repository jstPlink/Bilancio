# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `vX.Y.Z`.

## 0.30.0
- **Scheda «Banche»** (solo schermo largo; prima fase del piano «Interfaccia sui dati delle banche collegate»): i dati originali di UniCredit e Revolut — conti con IBAN, tipo e saldi, andamento del saldo, quali campi la banca fornisce e in quanti movimenti, principali interlocutori, pagamenti ricorrenti, movimenti registrati e in sospeso con il record originale. **Copia separata**: si aggiorna solo con «Leggi dalla banca» (conta come una delle 4 letture giornaliere) e non entra in Panoramica, Movimenti né Statistiche.
- `ENABLE_BANKING_API` cambia l'indirizzo dell'API, e `scripts/banca-finta.mjs` simula due banche per provare l'app senza toccare quelle vere. **`npm run demo:banche`** avvia banca finta e app di prova (porta 4871, password `demo-banche`, dati inventati) per provare la scheda Banche anche quando il server non è aggiornato.
- **Widget «Da pagare»** ridotto a un blocchetto: scritta e totale ancora da pagare.
- **Promemoria personalizzati** (Impostazioni → Promemoria, solo app Android): cosa controllare e ricorrenza (ogni giorno, settimana, mese o anno) con l'ora; si possono attivare, modificare ed eliminare. Calcolo delle ricorrenze collaudato (giorno 31 nei mesi corti, anni bisestili).
- **Icona di notifica** con il logo dell'app in una tinta sola e il turchese dell'app.
- Documentazione: aggiunta la sezione «Prossimi passi» con il piano per l'interfaccia sui dati delle banche collegate.

## 0.29.1
- **Impostazioni a pagina**: freccia «indietro» in alto al posto di «Annulla» (chiede conferma se ci sono modifiche non salvate); **«Salva le modifiche» compare solo se qualcosa è cambiato**. Il tasto indietro di Android chiude il pannello aperto invece di uscire dall'app.
- **Aggiorna** si sposta nella scheda **Documenti**, accanto a «Carica documento».
- L'identificativo dell'app Android diventa `app.bilancio.mobile` (neutro): chi ha già installato la versione precedente trova due app, può rimuovere la vecchia.

## 0.29.0
- **App Android** (cartella `android/`, `npm run apk`): una vera app che contiene le pagine di `public/` e inoltra dati e login al server; installabile con `npm run apk:installa`. Include il **widget «Da pagare»** (2×1 di base, totale e prime voci), la **notifica del primo del mese** per i conti in sospeso, il **feedback aptico** sui tocchi e l'apertura dei PDF.
- **Carica documento** (scheda Documenti): scegli file, nome e tipo (estratto conto CSV/PDF, bolletta con utenza e casa, busta paga). I PDF si leggono con importo e mese e restano sul server (`data/uploads`).
- **Movimenti**: un solo elenco, con i pagamenti allo stesso ente accorpati in una riga che si apre sui singoli; ricerca, filtro per categoria e ordinamento (prezzo, quantità di transazioni, nome, categoria, data). Lo stipendio è una voce sola.
- **Statistiche**: in cima i riquadri per categoria (spesa, svago, carburante…); un tocco apre i movimenti di quella categoria.
- **Panoramica**: un tocco su Entrate, Uscite, Bilancio o sul mese apre Movimenti filtrati su quel mese; colonna Mese ben distinta, Entrate e Uscite con lo stesso colore, linee tra le colonne, tab più evidenti, tre targhette affiancate; su telefono tabella compatta (Mese, Entrate, Uscite, Bilancio).
- **Banche collegate** (Impostazioni): UniCredit e Revolut direttamente dalla banca, in sola lettura, con Enable Banking (gratuito per uso personale). Limite di 4 letture al giorno, consenso fino a 180 giorni, movimenti già importati da file non duplicati.
- **Riconoscimento automatico** di chi ti paga lo stipendio e del tuo nome (da buste paga e movimenti): la sezione manuale delle Impostazioni non serve più. Impostazioni a sezioni richiudibili.
- Messaggio chiaro quando il server è più vecchio dell'app («va aggiornato»).

## 0.28.0
- **Telefono: tabella a colonne** (Mese, Entrate, Uscite, Bilancio), una riga per mese, al posto delle schede.
- **Intestazione più stretta sul telefono**: senza logo e nome, con la versione sulla stessa riga di Aggiorna e Impostazioni.
- **«Esci» nelle impostazioni** (sezione Account); sul telefono non compare più in alto.
- **Finestre sopra a tutto**: Impostazioni e le altre finestre occupano lo schermo del telefono, scorrono da sole e la pagina sotto resta ferma.
- **Panoramica**: Entrate medie, Uscite medie e Bilancio medio affiancate su una riga; tolti l'anno e «al mese» dalle etichette.

## 0.27.0
- **Telefono: solo la vista compatta** (Mese, Entrate, Uscite, Bilancio). Su schermo largo tutte le voci (bollette, Crispiano, affitto, prestito…) sono sempre aperte; tolti i pulsanti per aprire e chiudere.
- **Grafici adattati al telefono**: il grafico rientra nello schermo, senza scorrimento a destra, e si ridisegna se ruoti il telefono.
- **App installabile (PWA)**: manifest, icone e meta per aggiungere Bilancio alla schermata Home di Android e iPhone, a schermo intero. Le icone si rigenerano con `scripts/genera-icone.mjs`.

## 0.26.1
- **Documentazione aggiornata**: il README descrive ora le schede (Panoramica, Movimenti, Statistiche, Documenti), la tabella compatta, la vista per telefono, le impostazioni, la lettura delle scansioni con OCR, la scansione automatica all'apertura e la struttura del codice per chi sviluppa.

## 0.26.0
- **Tabella principale compatta**: solo Mese, Entrate, Uscite e Bilancio (prima "Saldo"). Le Uscite si aprono con un clic nelle loro voci (bollette, affitto, prestito, spesa, svago, carburante, donazioni, tasse) e le Bollette, a loro volta, in quelle di ogni casa. Nella vista chiusa, sotto le uscite del mese compare quante voci restano da pagare.
- **Celle pagato / da pagare ridisegnate**: riquadro arrotondato con sfondo tenue, bordo morbido e barretta laterale (verde o rossa), senza icone.
- **Anno a tendina** al posto dei pulsanti.
- **Movimenti accorpa la suddivisione delle spese**: riquadri per categoria cliccabili (filtrano i movimenti), filtri anno e mese, ricerca, e due viste: "Movimenti" e "Per descrizione" (le tabelle raggruppate della vecchia scheda Banca, ora con la media e un link "cerca").
- **Più informazioni su ogni pagamento**: sotto la descrizione compaiono giorno e ora, metodo (carta, bonifico, prelievo…), commissione, valuta e testo della banca. Cliccando la riga si aprono i dettagli completi: saldo dopo il pagamento, conto, categoria (automatica o scelta), file di origine, gli altri pagamenti con la stessa descrizione (quante volte, totale, media, date) e i link per cercarla su Google e su Maps. L'app ora conserva anche questi dati dall'estratto conto Revolut (orario, tipo, commissione, valuta, saldo); i movimenti già salvati si completano da soli alla prossima lettura degli estratti, senza toccare le categorie.
- **"Banca" diventa "Statistiche"** e contiene solo i grafici e la tabella mese per mese.
- Tolti la descrizione sotto il nome dell'app e il testo sotto la tabella della panoramica.
- **Crispiano comprimibile** anche nella nuova tabella compatta: dentro Bollette, la colonna "Crispiano" si apre e si chiude (chiusa mostra un solo totale con lo stato pagato di tutte le sue voci).
- **Vista per telefono**: la tabella principale diventa un elenco di schede mensili, i filtri e le tabelle dei movimenti si adattano allo schermo stretto e i pulsanti sono più grandi.
- **Localhost collegato al server**: con `BILANCIO_SERVER` le pagine sono quelle di questa cartella (si vedono subito le modifiche) e solo dati e login passano dal server, che prima rispondeva anche con le pagine della sua versione. La versione mostrata è quella locale. La documentazione dice che il localhost deve sempre puntare al server.

## 0.25.0
- **Crispiano comprimibile** dentro Bollette: con Bollette aperta compare una colonna "Crispiano" con il suo pulsante apri/chiudi. Chiusa, mostra un solo totale (luce + gas di Crispiano, con lo stato pagato di tutte le voci insieme); aperta, mostra Luce e Gas di Crispiano separati, ognuno con il suo documento. Le voci di Crispiano sono ora raggruppate dopo quelle di Budrio. Lo stato viene ricordato.

## 0.24.0
- **Tolto il "codice di configurazione"**: la prima password si crea dalla pagina di accesso con la sola password, da qualsiasi indirizzo. Va creata subito dopo l'avvio: finché non esiste, chiunque apra il sito può sceglierla.
- **Localhost che punta al server**: con `BILANCIO_SERVER` nel file `.env`, `npm start` non usa un database locale ma inoltra ogni richiesta (pagine, dati, login) al server indicato. Dati e password sono un'unica copia, quella del server. Il cookie di sessione viene adattato a http://localhost, e se il server non risponde compare un messaggio chiaro.

## 0.23.1
- La password può essere lunga anche solo **4 caratteri** (prima 10). Meglio più lunga se il sito è raggiungibile da internet: il blocco dopo 5 errori rallenta i tentativi ma non sostituisce una password robusta.

## 0.23.0
- **La password si crea dall'app**: al primo accesso la pagina di accesso chiede di scegliere la password (minimo 10 caratteri, da ripetere). Viene salvata cifrata (scrypt) nel database. Da localhost basta aprire la pagina; da qualsiasi altro indirizzo serve il **codice di configurazione** scritto nel log del server all'avvio (`docker logs bilancio`), così nessun estraneo può crearla al posto del proprietario. Finché la password non esiste, pagine e dati restano chiusi.
- L'app è quindi sempre protetta. `BILANCIO_PASSWORD` resta come alternativa facoltativa (ha la precedenza). Tolto l'avviso rosso "nessuna password".
- Nuovo script `scripts/reimposta-password.mjs` per cancellare la password dimenticata (da eseguire con l'app ferma).

## 0.22.1
- `npm start` e `npm run dev` leggono un file `.env` (se c'è) e quindi la password si può impostare anche in locale: copia `.env.example` in `.env` e scrivi la password. Il file è escluso da git.

## 0.22.0
- **Login con password**: impostando `BILANCIO_PASSWORD` tutto il sito (pagine, dati e API) richiede la password. Pagina di accesso con un solo campo, sessione di 30 giorni (cookie firmato, HttpOnly), pulsante **Esci**, blocco di 15 minuti dopo 5 tentativi sbagliati. Gli script usano HTTP Basic. Senza password l'app resta aperta, come prima, ma da un indirizzo diverso da localhost compare un avviso rosso.

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
