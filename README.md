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
- **Movimenti.** I movimenti dell'estratto conto in un solo elenco, con filtri per anno e mese e ricerca. Ogni riga mostra solo **nome, data, importo e categoria**; i pagamenti
  allo stesso ente (stessa descrizione) sono accorpati in una riga con «×n» e la somma: un tocco la apre sui singoli pagamenti. Toccando un pagamento si apre il **dettaglio completo**:
  giorno della settimana e ora, metodo (carta, bonifico, prelievo…), commissione e valuta, saldo dopo il pagamento, testo completo della banca, gli altri pagamenti con la stessa
  descrizione e i link per cercarla su Google e su Maps. Dal menu si cambia la categoria: l'app la ricorda per tutte le descrizioni uguali.
  **Giroconti:** i giri di denaro tra i tuoi conti e pocket non sono nell'elenco: stanno nella sezione «Giroconti tra i tuoi conti» in fondo alla scheda, e non entrano in nessun
  totale né in Panoramica e Statistiche (vedi «Riconoscimento automatico»).
- **Statistiche.** I riquadri per categoria (spesa, svago, carburante, prestito, donazioni, tasse…; i giroconti non ci sono): un tocco apre i movimenti di quella categoria. Poi i grafici: stipendio contro uscite mese per mese, dove va il denaro della banca per categoria, le 10 voci più pesanti,
  e la tabella dei numeri. Un clic su un mese lo imposta come filtro.
- **Banche** (anche sul telefono e nell'app Android: i movimenti diventano riquadri, le tabelle tecniche partono chiuse). I dati originali che UniCredit e Revolut mettono a disposizione, in una **copia separata**: non entra in
  Panoramica, Movimenti né Statistiche, serve a capire cosa si può ottenere. Per ogni banca collegata: consenso e letture di oggi, poi **un solo blocco per ogni conto e per ogni pocket**
  con il saldo attuale in grande, nome, IBAN, valuta, tipo, prodotto, numero di movimenti, l'andamento del saldo (quello scritto dalla banca nei movimenti,
  oppure ricostruito dal saldo attuale) e, a scomparsa, tutti i saldi e i dati del conto. **Nome dei pocket:** la banca dà a ogni pocket il nome dell'intestatario;
  l'app prova a ricavare il nome vero dai movimenti (Revolut scrive «Accredita EUR 01 Spesa da EUR») e con **Rinomina** lo scrivi tu, una volta (resta sul server).
  Il nome compare anche nel filtro per conto e nelle righe dei movimenti. Poi **quali campi la banca fornisce davvero e in quanti movimenti**, i principali interlocutori, i pagamenti
  ricorrenti riconosciuti e tutti i movimenti, registrati e in sospeso, con il record originale della banca (clic sulla riga). **Leggi dalla banca**
  aggiorna la copia; conta come una delle 10 letture giornaliere (vedi «Limiti»).
  **Storico:** le banche concedono pochi mesi (Revolut, di norma, solo 90 giorni; l'app ne chiede 12 e, se la banca rifiuta, lo scrive sotto al conto con il motivo).
  Ad ogni lettura i movimenti già letti restano nella copia e si aggiungono i nuovi, quindi lo storico cresce nel tempo; quello precedente alla prima lettura
  non si può recuperare dalla banca (per i mesi più vecchi servono gli estratti PDF o CSV).
  I collegamenti con le banche stanno sul server, quindi la scheda funziona solo se anche il **server** è alla versione che la include (dalla 0.30.0):
  altrimenti compare «Il server non ha ancora questa funzione». Per vederla prima dell'aggiornamento c'è la demo (vedi «Banche collegate»).
- **Budget** (quinta scheda). Quanto vuoi spendere al mese in *Spesa*, *Svago* e *Carburante* (vuoto = nessun budget); si salva da solo. **Il risparmio non si imposta: è un risultato**,
  calcolato come entrate medie − spese fisse medie − totale dei budget. In alto, sempre visibili: le **entrate medie mensili** (media degli **ultimi 3 mesi chiusi** con entrate), le spese fisse medie
  (bollette, affitto, prestito, donazioni, tasse), il **totale dei tre budget** e il **risparmio al mese** (o, se superi le entrate, di quanto sfori; lo stesso vale per «se spendi come al solito» nella nota sotto la tabella): **a ogni cifra che scrivi tutto si aggiorna**.
  Una **barra a colori** divide l'entrata media tra spese fisse, Spesa, Svago, Carburante e ciò che avanza (verde: il risparmio); se il totale supera le entrate, un segno nero mostra dove finiscono le entrate.
  Per ogni voce una **barra che si riempie da destra verso sinistra** mostra **quanto hai già speso questo mese** rispetto al budget (arancione da 80%, rosso oltre), con le stesse cifre del widget.
  Medie e spese del mese si calcolano nell'app dagli stessi dati della Panoramica, quindi coincidono con le sue cifre qualunque sia la versione del server. Accanto a ogni voce c'è la «Media» delle spese degli **ultimi 3 mesi chiusi**
  (il mese in corso non conta), e «Parti dalle medie» copia le medie nei budget. In alto due riquadri: entrate e spese fisse medie in una riga, budget e risparmio nell'altra.
  La tabella dei budget sta sempre nella larghezza dello schermo, senza scorrimento, anche sul telefono.
- **Documenti** (in **Impostazioni → Documenti**, non è più una scheda; un numero sull'ingranaggio dice quanti sono da controllare). **Carica documento** (in alto): scegli il file, il nome e che cosa è: *estratto conto* (CSV o PDF: i movimenti vanno in Movimenti),
  *bolletta* (PDF: scegli utenza e casa, si legge l'importo; se il mese non è nel PDF scrivilo nel nome, es. «Luce 2026.09») o *busta paga* (PDF).
  I file caricati restano sul server (`data/uploads`) e non vengono tolti dall'aggiornamento. Sotto, l'elenco dei PDF letti. Quelli letti male sono segnati *Da controllare*: con **Modifica** correggi tipo, periodo e importo
  (la correzione sopravvive agli aggiornamenti) oppure scegli **Ignora** per i file che non c'entrano.

Sul telefono la tabella resta una tabella a colonne con le sole voci compatte (Mese, Entrate, Uscite, Bilancio); il dettaglio delle
uscite resta per lo schermo largo. L'intestazione mostra solo la versione, e *Esci* sta nelle Impostazioni. Anche Movimenti mostra un riquadro per ogni pagamento e i grafici stanno nella larghezza dello schermo.

**App sul telefono.** Bilancio è installabile come app (PWA): apri il sito con Chrome (Android: menu → *Installa app*) o Safari (iPhone:
Condividi → *Aggiungi a Home*) e si apre a schermo intero con la sua icona. Serve un indirizzo https. I dati restano sempre sul server,
nulla viene salvato sul telefono. Le icone si rigenerano con `node scripts/genera-icone.mjs`.

## App Android (APK)

Oltre alla PWA c'è un'app Android vera, in `android/`: una WebView che contiene le pagine di `public/` e inoltra al server dati e login (`/api/`),
come il localhost collegato al server. Perciò le modifiche alla grafica si vedono nell'app senza aggiornare il server.

```bash
npm run apk              # costruisce android/build/Bilancio-<versione>.apk
npm run apk:installa     # lo costruisce e lo installa sul telefono (debug wireless attivo)
```

L'app Android ha in più:
- **Widget «Questo mese»** (Widget → Bilancio → Questo mese, 5×1, testi grandi; è l'unico widget del mese: «Da pagare» e la versione semplice sono stati tolti): a sinistra «dal 1° OTT» (mese a tre lettere, su un leggero sfondo che dice che si tocca: apre la scheda **Budget**),
  poi quattro riquadri affiancati con le cifre dal primo del mese in corso: **Da pagare** (le voci non ancora pagate, con quante sono, **nella tua quota**: vedi «Bollette»), **Spese**, **Carburante** e **Svago**. «Da pagare» ha un colore tutto suo: **rosso**
  finché resta qualcosa, verde quando è tutto pagato. Se hai impostato un **budget** (scheda Budget), i riquadri di Spese, Carburante e Svago sono **contenitori che si riempiono dal basso verso l'alto** con la spesa, su tutta la cella: bianchi,
  arancioni da 80% del budget, rossi quando lo superi; la superficie del liquido è un'**onda sinusoidale che scorre verso destra** (fotogrammi alternati da un ViewFlipper: consuma un po' di batteria finché la Home è visibile); senza budget il riquadro resta vuoto.
  In ogni riquadro di spesa c'è anche una riga `stima→reale/g`: la **spesa stimata al giorno** (il budget diviso i giorni del mese) e la **spesa reale al giorno** (quanto speso finora diviso i giorni passati, oggi compreso), questa **verde se è pari o migliore
  della stima, rossa se è peggiore**; senza budget non c'è confronto. Stesse cifre delle colonne della Panoramica; si aggiorna ogni mezz'ora, quando apri l'app e quando cambi categorie, importi, spunte o budget. **Ogni riquadro è un tasto**: Spese, Carburante e Svago
  aprono Movimenti sul mese in corso già filtrati per quella categoria, «Da pagare» apre la Panoramica; il bordo del widget apre l'app. (I budget arrivano dal server: serve la versione che li include.)
  Il codice del layout si rigenera con `node scripts/genera-widget.mjs` (lì si cambia anche il tempo di cambio fotogramma).
  **Regolare l'onda** (in `MonthWidget.java`): `FRAMES` (fotogrammi di un giro; oggi 16, ognuno mostrato 285 ms: un giro dura 4,6 s), `AMPLITUDE` (altezza dell'onda in pixel del disegno 56×40; oggi 0,9) e `CRESTS` (quante onde nella larghezza del riquadro; oggi 2).
  Per rallentare basta alzare l'intervallo in `genera-widget.mjs`, per mantenerla fluida servono più fotogrammi (pesano poco, ma il widget va aggiornato con meno di 1 MB).
- **Widget «Saldo»** (Widget → Bilancio, 4×1; mostra Revolut): **saldo totale in euro** (conti e pocket) e **ultimo movimento** (in sospeso se non ancora registrato), con scritto da quando sono i dati. **Non è in tempo reale**: legge dal server l'ultima copia
  della scheda Banche e non chiama mai la banca. Si aggiorna quando premi «Leggi dalla banca» o «Aggiorna ora» nell'app e ogni mezz'ora rilegge dal server; un tocco apre la scheda Banche. Serve il server alla versione che ha `/api/banking/widget` (0.36.0).
- **Anteprima nella lista dei widget**: ogni widget ha un'anteprima statica con dati di esempio (`previewLayout`, Android 12 e successivi, generata da `scripts/genera-widget.mjs`) e, da Android 15, l'anteprima **con i tuoi dati veri**,
  aggiornata dal widget stesso (al massimo una volta l'ora). Se ne hai già uno sulla Home e l'anteprima non cambia, il launcher la tiene in cache: riavvialo o aspetta.
- **Notifica del primo del mese** (alle 9): quanti conti restano da pagare e quali, se ce ne sono. Alla prima apertura l'app chiede il permesso
  per le notifiche. Per provarla subito: `adb shell am broadcast -n app.bilancio.mobile/.Monthly -a app.bilancio.mobile.MONTHLY`.
- **Promemoria personalizzati** (Impostazioni → Promemoria): scrivi cosa controllare (es. «Addebito del mutuo») e scegli la ricorrenza: ogni giorno,
  ogni settimana (giorno della settimana), ogni mese (giorno del mese; il 31 in un mese corto vale l'ultimo giorno) o ogni anno (giorno e mese), con l'ora.
  Si possono disattivare, modificare o eliminare. Restano sul telefono e usano la sveglia di sistema (può ritardare di qualche minuto).
- L'icona nella barra delle notifiche è il logo dell'app in una tinta sola (quadrato arrotondato con il segno ±), con il colore turchese dell'app.

Servono l'SDK Android (build-tools e una piattaforma, di norma in `~/Android/Sdk`, su Windows in `%LOCALAPPDATA%AndroidSdk`, oppure `ANDROID_HOME`) e Java 17; non serve Gradle.
L'indirizzo del server viene da `BILANCIO_SERVER` nel file `.env` e finisce solo nell'APK (`android/build/` è escluso da Git). L'APK è firmato
con la chiave di debug dell'SDK: per aggiornare l'app installata serve sempre la stessa chiave: con un'altra l'installazione si rifiuta e bisogna disinstallare prima l'app (si perdono promemoria e accesso).

## Uso

1. Apri **Impostazioni** (ingranaggio) e indica dove si trovano i documenti:
   - **Buste paga**, **Bollette** ed **Estratti conto**: un link di condivisione Seafile pubblico (`https://…/d/xxxx/`, senza password)
     oppure un percorso locale. Le sottocartelle vengono lette in automatico.
   - **Affitto**: importo mensile e mese di inizio, aggiunto in automatico ogni mese.
   - **Riconoscimento automatico** (sola lettura): il tuo nome e chi ti paga lo stipendio si ricavano da soli (vedi sotto), per non contare due volte lo
     stipendio né i giri tra i tuoi conti.
   - **Bollette**: la **tua quota di acqua, luce, gas e wifi** (di norma 50%: convivi e le dividi). L'app conta solo la tua parte (nelle uscite, nel «Da pagare», nel widget, nella notifica e nel budget); i PDF e l'importo dei documenti restano interi. Cambia la percentuale per cambiare la quota; l'affitto non è diviso.
2. In **Impostazioni → Documenti** premi **Aggiorna**: vengono letti solo i file nuovi o modificati (Maiusc + clic per rileggere tutto). La stessa ricerca parte da sola
   **ogni volta che apri l'app**: una targhetta in alto mostra l'avanzamento, e se la lettura la sta facendo qualcun altro (un altro browser,
   lo script di importazione) compare una fascia gialla con i dati parziali che si aggiornano da soli.
3. Controlla **Impostazioni → Documenti** per i file *Da controllare*.

## Riconoscimento automatico di nome e datore di lavoro

Non va scritto nulla: a ogni aggiornamento (e dopo un caricamento o la lettura delle banche) `src/identity.js` lo ricava dai dati.
- **Chi ti paga lo stipendio**: il bonifico in entrata con lo stesso importo del netto di una busta paga, per almeno due mesi, entro il 20 del mese dopo.
- **Il tuo nome**: un'uscita che ricompare identica come entrata su un altro conto (entro 3 giorni), con lo stesso nome come destinatario e come mittente, almeno due volte.
Con questi nomi i bonifici dello stipendio e i giri tra i tuoi conti diventano *Giroconti* (non contati) e lo stipendio compare come una sola voce in Movimenti.
- **Giri visti dai due lati**: le banche registrano un trasferimento tra conti o pocket due volte, in uscita su un conto e in entrata sull'altro. Se un'uscita e un'entrata hanno lo
  stesso importo, cadono entro 3 giorni, stanno su conti diversi (o hanno parole da pocket nella descrizione), almeno una delle due sembra un trasferimento (bonifico, top-up, transfer…)
  e c'è una sola abbinabile, **entrambe diventano Giroconti**. Le coppie dubbie restano com'erano; se ne sbaglia una, cambia la categoria in Movimenti (la scelta a mano non si tocca più).
I nomi si aggiungono a quelli già salvati e le categorie scelte a mano non si toccano. Se qualcosa è classificato male, cambia la categoria in Movimenti.

## Estratti conto (spese)

Indica il link (Seafile pubblico o cartella locale) degli estratti conto nelle impostazioni, campo **Estratti conto**, e premi **Aggiorna**;
oppure caricalo a mano da **Impostazioni → Documenti → Carica documento** (Revolut: Conti → Estratti → Excel/CSV). Gli estratti in PDF (UniCredit e Revolut) si
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

## Banche collegate (UniCredit, Revolut)

In **Impostazioni → Collega le banche** l'app legge i movimenti direttamente dalla banca (open banking PSD2, accesso **in sola lettura**), senza scaricare
estratti. Usa [Enable Banking](https://enablebanking.com), gratuito per uso personale se si collegano i propri conti.

1. Crea un account su enablebanking.com e, nel Control Panel, registra un'applicazione **di produzione** con l'indirizzo di ritorno che le Impostazioni
   mostrano (`https://<il-tuo-server>/api/banking/callback`; deve essere https). Poi «Activate by linking accounts» per i tuoi conti.
2. Il browser scarica un file `.pem` (chiave privata): il suo nome è l'**ID applicazione**. Incollali in Impostazioni → *Credenziali Enable Banking*.
   Restano solo sul server (database) e non tornano mai all'interfaccia.
3. Premi **Collega UniCredit** / **Collega Revolut**: si apre il sito della banca per autorizzare; al ritorno i conti sono collegati e i movimenti letti.

**Dati disponibili:** conti (nome, IBAN, valuta) e movimenti *registrati* (data, importo, entrata/uscita, controparte, causale, IBAN della controparte e,
se la banca lo dà, il saldo dopo il movimento). Non le carte di credito UniCredit, né investimenti o pagamenti ricorrenti. Lo storico dipende dalla
banca: al primo collegamento si chiede un anno, se non è concesso ripiega su 90 giorni.

**Quando si legge dalle banche:** solo quando premi un pulsante apposta: **Aggiorna ora** in Impostazioni → Collega le banche (porta i movimenti in Panoramica e
Movimenti) o **Leggi dalla banca** nella scheda Banche (aggiorna la copia). **Aggiorna** e l'apertura dell'app non toccano mai le banche. L'unica altra lettura è quella
subito dopo aver collegato una banca, perché è il solo momento in cui alcune banche concedono più storico.

**Limiti:** da **Aggiorna ora** e **Leggi dalla banca** (e dalla lettura dopo il collegamento) puoi leggere a mano **fino a 10 volte al giorno per banca** (finestra mobile di 24 ore; il contatore è unico per tutte queste letture).
Alla undicesima l'app rifiuta con «massimo 10 letture al giorno» senza chiamare la banca. Il tetto normale delle banche è 4 al giorno (PSD2, art. 36 delle norme tecniche RTS) e vale per gli accessi **senza l'utente presente**; per le letture fatte a mano l'app invia
le intestazioni «PSU» (`Psu-Ip-Address`, `Psu-User-Agent`, `Psu-Accept-Language`… ricavate dalla richiesta del browser o dell'app) che dichiarano alla banca che la lettura l'ha chiesta una persona in quel momento. Se la banca le rifiuta, l'app riprova subito senza.
**Non è garantito che ogni banca accetti più di 4 letture**: se Revolut o UniCredit rispondono con un errore di limite, il messaggio compare nell'app e vale il tetto della banca. Il consenso dura al massimo 180 giorni (meno se la banca lo riduce): a scadenza si ricollega con un tocco.
I movimenti già importati da CSV/PDF (stessa data e importo) non si duplicano; se importi un CSV *dopo* aver collegato la banca, gli stessi pagamenti possono comparire due volte.

**Movimenti Revolut che «mancano» dopo la lettura.** Cause possibili, in ordine di probabilità: (1) **«Leggi dalla banca»** aggiorna solo la scheda Banche; per portarli in Panoramica e Movimenti serve **Aggiorna ora** (Impostazioni → Collega le banche);
(2) i pagamenti con la carta restano **in sospeso** per uno o due giorni: in Banche si vedono come «in sospeso» ma entrano in Movimenti solo quando la banca li registra; (3) sono stati riconosciuti come **giroconti** (soldi tra i tuoi conti o pocket) e stanno nella sezione
«Giroconti» in fondo a Movimenti; (4) lo stesso importo nella stessa data era già stato importato da un CSV o PDF e non si duplica; (5) due pagamenti identici nello stesso giorno senza identificativo della banca venivano contati come uno (corretto dalla 0.36.0).

**Demo della scheda Banche.** `npm run demo:banche` avvia la banca finta e un'app di prova su `http://localhost:4871` (password `demo-banche`) con dati inventati,
in un database a parte (`data/demo-banche`): serve a provare la scheda anche quando il server vero non ha ancora la versione nuova. UniCredit parte già
letto, Revolut no, per provare «Leggi dalla banca». Non tocca il localhost collegato al server né i tuoi dati. Va lanciata **in un terminale che resta aperto**: finché il comando gira la demo risponde,
Ctrl+C (o chiudere il terminale) la ferma; lanciata come processo di sfondo di uno strumento si interrompe da sola dopo un po'.

**Prove senza banca vera, a mano.** `node scripts/banca-finta.mjs` avvia una banca finta (due conti con campi diversi, come nelle banche vere: uno in stile
UniCredit, uno in stile Revolut). Poi avvia l'app con `ENABLE_BANKING_API=http://127.0.0.1:4890` (variabile d'ambiente, non nel `.env` del server vero)
e collega nel database di prova conti con `uid` `unicredit-1` e `revolut-1`. Il collegamento vero richiede invece le credenziali di Enable Banking.

## Prossimi passi

**Interfaccia sui dati delle banche collegate** (in corso: resta da decidere la fase 2). Serve a capire il potenziale di ciò che UniCredit e Revolut rendono disponibile
tramite Enable Banking, in quattro fasi, ognuna da confermare prima della successiva:
1. **Browser** — *fatto (0.30.0, rifinito nella 0.31.0 con un blocco per ogni conto e pocket)*: la scheda **Banche** (vedi «Le schede»). I dati originali si tengono in una copia separata
   sul server (`db.banking.snapshots`), che nessun'altra parte dell'app legge, e si aggiornano solo premendo **Leggi dalla banca**.
   Per provarla con i dati veri: aggiorna il server, poi **Banche → Leggi dalla banca** per ogni banca. Per provarla senza toccare le banche vere
   c'è `npm run demo:banche` (vedi sopra).
2. **Decidere** insieme come gestire le informazioni (quali tenere, come abbinarle ai movimenti e alla Panoramica). Finché non si decide, i dati
   letti dalle banche per questa scheda **non si mescolano** a quelli dell'app.
3. **Telefono** — *fatto (0.31.0)*: la scheda Banche c'è anche nel browser del telefono e nell'app Android, con i movimenti in riquadri.
4. **Rilascio** — *fatto con la 0.31.0*; ogni fase successiva avrà il suo.

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

Per aggiornare: `docker compose pull && docker compose up -d`. Dopo un push o un nuovo tag GitHub costruisce l'immagine: attendi qualche minuto (la scheda
*Actions* del repository mostra quando ha finito) prima di fare il `pull`, altrimenti scarichi ancora la versione precedente. I dati in `./data` non cambiano.
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
src/           server Express: server.js, banking.js (banche collegate), uploads.js (documenti caricati), grid.js (tabella), scanner.js (lettura dei file), parsers.js (PDF),
               statements.js e pdfstatements.js (banca), bankexplorer.js (scheda Banche: saldi, andamento, nomi dei pocket), billmatch.js, identity.js (nome e datore di lavoro, giroconti visti dai due lati),
               budget.js (budget di spesa e stime sul server), ocr.js, sources.js (cartelle e Seafile), auth.js, store.js, proxy-server.js (localhost collegato al server)
scripts/       importa-su-server.mjs, reimposta-password.mjs, build-apk.mjs, genera-icone.mjs, genera-widget.mjs (layout dei due widget «Questo mese»), banca-finta.mjs e demo-banche.mjs (banca e demo con dati finti)
android/       app Android (manifest, codice Java: MainActivity, widget MonthWidget e MonthWidgetDetail, Due, Month…; script che inietta le chiamate al server)
test/          node --test; free-port.js sceglie porte libere per i test che avviano un server vero
```

- `npm test` dopo ogni modifica a `src/`; `npm run dev` riavvia da solo il server quando cambia il codice.
- **A ogni modifica dell'app si aggiorna anche il telefono**: oltre a versione, `CHANGELOG.md`, commit, tag e push, si installa l'APK nuovo con `npm run apk:installa` (su Windows con `ANDROID_HOME` che punta a `%LOCALAPPDATA%\Android\Sdk`).
- **A ogni push la versione sale**: `npm version <x.y.z> --no-git-tag-version`, una voce in `CHANGELOG.md`, commit e tag `vX.Y.Z` (push anche dei tag).
  La versione compare accanto al nome nell'app.
- I file `.env` e `data/` non vanno mai in Git; l'indirizzo del server e le password stanno solo lì.
