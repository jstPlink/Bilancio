# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `vX.Y.Z`.

## 0.40.0
- **Aggiornamento automatico delle banche ogni giorno alle 5** (ora italiana), da tutte le banche collegate; l'esito è in cima alla scheda Banche. Gli altri aggiornamenti si fanno a mano con **Aggiorna**.
- **Pagamenti in sospeso senza data** (come li dà a volte la banca) venivano scartati: ora contano dal giorno in cui si leggono, e nella scheda Banche stanno in cima all'elenco.
- **Movimenti**: «×n» a sinistra del nome, importo allineato a destra in colonna, categoria più compatta; i movimenti ancora in sospeso hanno una linea arancione sul bordo sinistro del riquadro.
- **Banche**: «Leggi dalla banca» diventa **Aggiorna** e va a destra; la riga della banca ha un bordo che mostra dove si clicca.
- **Panoramica**: entrate medie verdi, uscite medie rosse, bilancio medio verde o rosso; più distanza tra le schede e la riga dell'anno anche sul telefono (una regola la azzerava).
- **Budget**: entrate verdi, spese fisse rosse, risparmio verde; i due blocchi in alto hanno una linea tra i valori e una sotto i valori, prima della descrizione.
- **Impostazioni**: tolta la sezione «Riconoscimento automatico» (il riconoscimento continua a lavorare); la sezione Documenti è colorata.

## 0.39.0
- **I dati della banca sono i dati dell'app**: «Leggi dalla banca» e «Aggiorna ora» fanno la stessa cosa, una sola lettura nel limite giornaliero: aggiornano saldi e movimenti della scheda Banche e portano gli stessi movimenti (registrati e in sospeso) in Panoramica, Movimenti e Statistiche. Nuova `readAndMerge`.
- **Niente doppioni tra estratto conto e banca**: un movimento visto da entrambi (stesso importo, stessa data o un giorno di scarto, abbinati uno a uno) si conta una volta, vince la banca; la categoria scelta a mano passa al movimento della banca; un estratto riletto non fa ricomparire il doppione. Nuovo `src/reconcile.js`.
- **Estratti conto**: tolto l'indirizzo dalle Impostazioni; con una banca collegata, all'avvio il server lo toglie una volta sola (resta in `settings.statementsSourceOld`). I più vecchi si caricano a mano da Documenti.
- **Movimenti**: ogni movimento è un riquadro — in alto data, importo e categoria a destra; sotto la descrizione — e il dettaglio aperto sta dentro lo stesso riquadro con la stessa estetica. Anno, mese, categoria, ricerca e «Ordina per» sono dietro un solo pulsante **Filtra**, col numero dei filtri attivi.
- **Banche**: tutto il blocco di ogni banca è collassabile; la sezione dei movimenti non lo è più e ha il suo pulsante **Filtra**; tolti i grafici dei conti (nei conti aperti restano IBAN, numero di movimenti nel periodo e Rinomina); tolta la frase sulla copia separata.
- **Panoramica**: più spazio tra la riga dell'anno, le schede e i blocchi sotto.

## 0.38.1
- Documentazione e changelog della 0.38.0 (erano rimasti fuori dal rilascio).

## 0.38.0
- **Pagamenti in sospeso**: «Aggiorna ora» porta in Movimenti anche i movimenti in sospeso (etichetta «in sospeso»), che contano subito nelle somme di Panoramica. A ogni lettura i sospesi di prima si tolgono e si rimettono quelli di adesso: un pagamento rifiutato sparisce da solo, uno registrato dalla banca ricompare come registrato, senza doppioni. Se la banca non dà i sospesi si tengono quelli di prima.
- **Saldo con i sospesi**: nella scheda Banche e nel widget «Saldo» il totale è il saldo contabile più i pagamenti in sospeso («di cui in sospeso»); se la banca dà solo saldi «disponibili» si usa quello com'è.
- **Scheda Banche semplificata**: ogni conto e pocket è una finestra chiusa (nome e saldo) che aperta mostra IBAN, numero di movimenti nel periodo e grafico, più Rinomina. Tolti: descrizioni sotto il grafico, saldi e dati aggiuntivi, tipo e prodotto, note sulla fonte del nome. Tolte le sezioni «Quali campi fornisce la banca», «Principali interlocutori» in uscita e in entrata e «Pagamenti ricorrenti» (anche dal server). Nuovi test (92 in tutto).

## 0.37.0
- **Bollette divise in due**: acqua, luce, gas e wifi contano per la **tua quota** (Impostazioni → Bollette, di norma 50%) nelle uscite, nel «Da pagare», nel widget, nella notifica del primo del mese e nel budget. I PDF restano interi; l'affitto non è diviso. Nuovo `billShare` nelle impostazioni.
- **Letture a mano fino a 10 al giorno** per banca (prima 4). Le letture a mano inviano alla banca le intestazioni «PSU» (l'utente è presente) e, se la banca le rifiuta, riprovano senza; non è garantito che ogni banca accetti più di 4 letture: se rifiuta, l'errore si vede nell'app.
- **Widget**: tolti «Da pagare» e «Questo mese» semplice. Resta «Questo mese» (quello completo, 5×1) e il widget Revolut si chiama «Saldo».

## 0.36.0
- **Widget «Questo mese (stime al giorno)»** ora 5×1, con testi più grandi e una riga sola `stima→reale/g` per voce (la reale verde o rossa).
- **Nuovo widget «Revolut»** (4×1): saldo totale in euro e ultimo movimento dall'ultima lettura, con l'ora; non in tempo reale e non chiama mai la banca. Nuovo `GET /api/banking/widget`.
- **Anteprime dei widget** nella lista: anteprima statica con dati di esempio per tutti (`previewLayout`) e, da Android 15, anteprima con i dati veri.
- **Revolut, movimenti persi**: due pagamenti identici nello stesso giorno, quando la banca non dà un identificativo, diventavano un solo movimento; ora restano due (gli identificativi già salvati non cambiano).
- Documentazione: perché si può non vedere un movimento Revolut e che il limite di 4 letture vale per gli accessi senza l'utente presente (PSD2).

## 0.35.4
- **Documentazione**: struttura del progetto aggiornata (`budget.js`, `genera-widget.mjs`, widget Android) e come regolare velocità, ampiezza e numero di onde del widget.

## 0.35.3
- **Widget**: l'ampiezza dell'onda è dimezzata (superficie più piatta, ondina appena accennata).

## 0.35.2
- **Widget**: l'onda scorre ancora a metà velocità (un giro in 4,6 s). I fotogrammi salgono a 16 e diventano più piccoli (56×40 px) per tenere leggero l'aggiornamento del widget.

## 0.35.1
- **Widget**: l'onda del liquido scorre a metà velocità (un giro in 2,3 s invece di 1,1 s); i fotogrammi salgono da 8 a 12 per non farla andare a scatti.

## 0.35.0
- **Widget «Questo mese»**: la superficie del liquido è ora un'**onda sinusoidale che scorre verso destra** (8 fotogrammi alternati da un ViewFlipper). Le onde sono solo nel widget: tolte dalla scheda Budget.
- **Nuovo widget «Questo mese (stime al giorno)»** (5×2), copia del precedente: in spesa, carburante e svago aggiunge la spesa stimata al giorno (budget ÷ giorni del mese) e quella reale (speso ÷ giorni passati), verde se migliore della stima e rossa se peggiore. Il layout dei due widget si genera con `scripts/genera-widget.mjs`.
- **Budget**: «Speso questo mese» torna a una barra che si riempie **da destra verso sinistra**. Medie, spese fisse, entrate e spese del mese si calcolano ora **nell'app dai dati della Panoramica** (`/api/grid`), non più dalla stima del server: coincidono con le cifre che vedi altrove e funzionano con qualunque versione del server (con un server non aggiornato le barre restavano vuote e la nota usava ancora 6 mesi).

## 0.34.3
- **Budget**: tolta la frase «Rientri nelle entrate medie…»; numeri della tabella più grandi del 15%; più spazio tra «Media» e «Speso questo mese»; tolto il bordo evidenziato dal riquadro del budget. «Speso questo mese» è ora un contenitore che si riempie dal basso, come i riquadri del widget (con la superficie che ondeggia appena).
- **Budget, nota sotto la tabella**: corretta quando le spese abituali superano le entrate. Mostrava «risparmi 1.360 €» senza il segno meno; ora dice «sfori di 1.360 € al mese» e riporta entrate, spese fisse e spese abituali da cui parte il calcolo. Le medie sono sugli ultimi 3 mesi chiusi: se la nota parla ancora di 6 mesi, il server non è stato aggiornato (la media si calcola sul server).

## 0.34.2
- **Budget**: la colonna «Di solito» diventa «Media» e si calcola sugli **ultimi 3 mesi chiusi** (prima 6). In alto due riquadri soli: entrate e spese fisse medie in una riga, budget e risparmio nell'altra. La tabella dei budget torna in colonne anche sul telefono (niente blocchetti), sempre nella larghezza dello schermo e senza scorrimento. Sul telefono le cinque schede ora entrano senza tagliare il testo.
- **Widget**: corretta la logica di riempimento. Le tre celle risultavano piene allo stesso modo; ora ogni cella ha la propria altezza, calcolata sulla sua spesa rispetto al suo budget (immagine con il liquido sopra uno sfondo tondo che ne ritaglia i bordi, senza più livelli del disegno).

## 0.34.1
- **Budget, barre a liquido**: la barra di ogni voce (speso nel mese su budget) ha onde che scorrono dentro il liquido e un bordo che ondeggia appena (si ferma con «riduci animazioni»). Solo nell'app: il widget Android non può animarsi.
- **Budget, tabella compatta**: più bassa e senza «al mese» nel titolo; sta sempre nella larghezza dello schermo, senza scorrimento. Sul telefono ogni voce diventa un blocchetto (nome e budget, «Di solito», barra).

## 0.34.0
- **Budget: il risparmio è un risultato**, non si imposta più: entrate medie (ultimi 3 mesi) − spese fisse medie − totale dei budget. Una barra a colori divide l'entrata media tra spese fisse, Spesa, Svago, Carburante e risparmio (con un segno se si superano le entrate); per ogni voce una barra si riempie con quanto speso nel mese rispetto al budget. «Usa i consigli» diventa «Parti dalle medie». `/api/budget` restituisce anche le spese del mese (`spent`).
- **Widget «Questo mese»**: i riquadri Spese, Carburante e Svago hanno ora gli stessi angoli tondi di «Da pagare» (sono disegni con angoli da 14dp che si riempiono dal basso, non più immagini stirate); «dal 1° OTT» ha un leggero sfondo che dice che si tocca e il mese è a tre lettere.
- **Regola di progetto**: a ogni modifica dell'app si installa anche l'APK sul telefono (`npm run apk:installa`); scritto in `CLAUDE.md` e nel README.

## 0.33.1
- **Widget «Questo mese»**: il riquadro «dal 1° ottobre» è largo la metà, il rosso di «Da pagare» è un po' meno intenso (#E3574D) e i riquadri Spese, Carburante e Svago hanno gli stessi angoli tondi di «Da pagare» (il disegno ora segue le proporzioni reali del riquadro, prima veniva stirato).

## 0.33.0
- **Scheda Budget** (quinta scheda, non più nelle Impostazioni): budget di Spesa, Svago e Carburante e risparmio voluto, con le **entrate medie mensili** sempre in vista e il **totale dei budget** che si aggiorna a ogni cifra scritta, con l'esito «rientri / non rientri nelle entrate medie». Il budget si salva da solo.
- **Entrate medie sugli ultimi 3 mesi** chiusi con entrate (prima seguivano i mesi usati per le spese). Le spese correnti restano sulla media degli ultimi 6 mesi chiusi.
- **Widget «Questo mese»**: «dal 1° ottobre» più grande, a sinistra di «Da pagare», e un tocco apre la scheda Budget. Spese, Carburante e Svago sono **contenitori che si riempiono dal basso** su tutta la cella (bianco, arancione da 80%, rosso oltre il budget).

## 0.32.0
- **Budget di spesa** (Impostazioni → Budget di spesa): budget mensile per Spesa, Svago e Carburante e risparmio mensile voluto. L'app stima le tre voci dalla media degli ultimi mesi chiusi e consiglia i budget per arrivare al risparmio (entrate medie − spese fisse − risparmio, tagli in proporzione). `GET`/`PUT /api/budget`; i budget viaggiano anche in `/api/grid`.
- **Widget «Questo mese»**: titolo in alto, testo più grande del 10%, barra del budget in Spese, Carburante e Svago (bianca, gialla da 80%, rossa oltre), «Da pagare» rosso pieno quando resta qualcosa. Ogni riquadro apre l'app: Spese, Carburante e Svago i Movimenti del mese già filtrati per categoria, «Da pagare» la Panoramica.
- **Giroconti fuori dai conti**: non compaiono più nell'elenco Movimenti né in Statistiche; stanno in una sezione apposta in fondo a Movimenti e non entrano in nessun totale. Le coppie uscita/entrata che sono lo stesso giro tra conti o pocket (stesso importo, entro 3 giorni, conti diversi, una sola abbinabile, almeno un lato che sembra un trasferimento) diventano giroconti tutte e due; le scelte a mano non si toccano. I movimenti dalle banche ora ricordano il conto (`account`).
- **Movimenti più semplici**: ogni riga mostra nome, data (senza giorno della settimana), importo e categoria; i pagamenti ripetuti hanno «×n»; il resto dei dati si vede aprendo la riga.
- **Documenti nelle Impostazioni**: la scheda Documenti non c'è più, la sezione sta in Impostazioni → Documenti (un numero sull'ingranaggio segnala i file da controllare). Le quattro schede rimaste hanno tutte la stessa larghezza.
- Android: `launchMode` singleTask e apertura sulla pagina giusta dai tocchi sul widget. Nuovi test (84 in tutto).

## 0.31.0
- **Scheda Banche, un blocco per conto e per pocket**: saldo attuale in grande, nome, IBAN, valuta, tipo, prodotto, numero di movimenti, grafico dell'andamento e, a scomparsa, tutti i saldi e i dati del conto. Niente più schede separate per i grafici. I blocchi sono divisi in «Conti» e «Pocket e risparmi».
- **Nomi dei pocket**: la banca dà a ogni pocket solo il nome dell'intestatario. L'app ricava il nome vero dal testo dei movimenti («Accredita EUR 01 Spesa da EUR») e con **Rinomina** lo scrivi tu (`PUT /api/banking/account-name`, resta sul server). Il nome compare nel blocco, nel filtro per conto e in ogni riga di movimento.
- **Storico che si accumula**: ogni lettura tiene i movimenti già letti e aggiunge i nuovi (prima la copia veniva sostituita e i giorni più vecchi sparivano). Se la banca non concede 12 mesi, sotto il conto compare il motivo del rifiuto e che si ripiega sugli ultimi 90 giorni.
- **Scheda Banche anche sul telefono e nell'app Android**: ogni movimento è un riquadro (data, stato, conto, interlocutore, causale, importo), le tabelle tecniche partono chiuse e si mostrano 50 movimenti alla volta.
- **Le banche si leggono solo col pulsante**: **Aggiorna** e l'apertura dell'app non chiamano più UniCredit né Revolut. Restano **Aggiorna ora** (Impostazioni → Collega le banche), **Leggi dalla banca** (scheda Banche) e la lettura subito dopo aver collegato una banca. Rimossa `syncAll`; un test con una banca finta verifica che l'aggiornamento non la tocchi.
- **Android: widget «Questo mese»** (5×1): quattro riquadri affiancati con le cifre dal primo del mese — Da pagare (rosso finché resta qualcosa, verde quando è tutto pagato, con il numero di voci), Spese, Carburante e Svago. Si aggiorna ogni mezz'ora, all'apertura dell'app e quando cambiano categorie, importi, spunte o letture.
- Demo e banca finta: due pocket Revolut senza IBAN, con il nome dell'intestatario e il nome vero solo nei movimenti. Nuovi test (73 in tutto).
- Test più stabili: i test che avviano un server vero scelgono una porta libera dal sistema invece di una a caso (due test potevano scegliere la stessa porta e fallire ogni tanto).
- Un esempio nel codice e in un test usava il nome di un'azienda vera: sostituito con un nome inventato.
- Documentazione: aggiornate le sezioni Banche e App Android e i «Prossimi passi» (fasi 1 e 3 fatte).

## 0.30.1
- **Documentazione**: la scheda Banche richiede che anche il server sia aggiornato (dalla 0.30.0); la demo va tenuta in un terminale aperto; dopo un push bisogna attendere la costruzione dell'immagine Docker prima di aggiornare il NAS; come provare la scheda con i dati veri.

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
