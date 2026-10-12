# Bilancio

Buste paga, bollette e spese di casa, in ordine.

Bilancio legge i PDF di buste paga e bollette da una cartella (o da un link Seafile) e i movimenti dalle banche collegate (dal 1 ottobre 2026),
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

- **Panoramica.** Una tabella per anno (tendina *Anno*) con le colonne **Mese**, **Entrate**, **Uscite** e **Bilancio**. Le **entrate** sono lo stipendio, letto dalle **buste paga**. Le **uscite** si aprono (su schermo largo sono sempre aperte) nelle loro voci:
  *Bollette* (acqua, luce, gas e wifi, ognuna una colonna che somma le case: il dettaglio per casa sta nella cella) e *Affitto* dai documenti, e *Spesa*, *Svago* e *Carburante* dai **movimenti della banca**, **solo dal 1 ottobre 2026**. **Dagli estratti conto si legge una cosa sola: la rata del prestito** (estratti PDF di UniCredit, Impostazioni → Documenti), che è una spesa fissa e compare nella colonna *Prestito*; nessun altro movimento viene da lì.
  In alto le medie (entrate in verde, uscite in rosso, bilancio verde o rosso); in fondo la media e l'importo ancora da pagare di ogni colonna. Il riquadro **Da pagare** in alto salda tutto con un clic; la **cifra in fondo a una colonna** apre invece i Movimenti con **solo le voci da pagare** (pastiglia «Da pagare» e linea arancione; da lì si può segnare tutto pagato). Un clic su una cella **Entrate** mostra solo i movimenti in entrata, su **Uscite** solo quelli in uscita. Le celle non hanno bordo colorato a sinistra.
  - Le celle che vengono da un documento (bollette, affitto) sono **verdi se pagate e rosse se da pagare**. Un clic cambia lo stato; passandoci sopra la cella si divide: a sinistra **Apri** il PDF, a destra segni pagato o da pagare.
  - Gli importi non si modificano a mano, tranne *Spesa*, *Svago* e *Carburante*, dove si può correggere il totale del mese.
- **Movimenti.** Tutti i movimenti delle banche **dal 1 ottobre 2026** (registrati e in sospeso), che l'app **legge e salva** a ogni lettura dalle banche; quelli prima di quella data non si leggono né si salvano. Un solo pulsante **Filtra** apre anno, mese, tag (Spesa, Svago, Carburante, Prestito, Altro), ricerca e «Ordina per», più **Unisci le transazioni ripetute**. Il filtro **Prestito** mostra anche le rate degli estratti UniCredit (di tutti gli anni, prima di ottobre compreso).
  Ogni movimento è un riquadro: **data, importo e, a destra, il tag**; sotto la **descrizione**; toccandolo si apre il dettaglio completo (ora, metodo, commissione, saldo dopo, testo della banca, link a Google e Maps). I pagamenti in sospeso hanno l'etichetta «in sospeso» e una linea arancione sul bordo.
  **Tag:** lo decide il **pocket di provenienza**: **01 Spesa → spesa**, **Svago → svago**, **Carburante → carburante**; **tutto ciò che non viene da questi pocket è «altro»**, da smistare a mano dal menu, e **non conta in nessuna statistica, media o totale**. Una scelta a mano vale per quel solo movimento.
- **Statistiche.** I riquadri per tag (spesa, svago, carburante; «altro» c'è ma è grigio e non conta): un tocco apre i movimenti. Poi i grafici: stipendio contro uscite mese per mese (bollette e affitto dai documenti, spesa, svago e carburante dai movimenti dal 1 ottobre 2026), le uscite dei tre pocket, le 10 voci più pesanti e la tabella dei numeri. Un clic su un mese lo imposta come filtro.
- **Banche** (anche sul telefono e nell'app Android). Serve ad **aggiornare lo stato con le banche**. Ogni banca è collassabile: consenso, letture di oggi e **Aggiorna** (una sola lettura che porta saldi e movimenti in tutta l'app), poi **una finestra per ogni conto e pocket**, chiusa di norma (nome e saldo; aperta aggiunge IBAN, quanti movimenti e **Rinomina**).
  Il saldo comprende i pagamenti in sospeso. **Nome dei pocket:** la banca dà a ogni pocket il nome dell'intestatario; l'app prova a ricavare il nome vero dai movimenti (Revolut scrive «Accredita EUR 01 Spesa da EUR») e con **Rinomina** lo scrivi tu, una volta: **è quel nome a decidere il tag** (01 Spesa, Svago, Carburante).
  In fondo l'elenco dei movimenti registrati e in sospeso con il record originale della banca (clic sulla riga: la riga e il suo dettaglio hanno **un solo contorno colorato**) e il pulsante **Filtra**. Un sospeso conta subito; a ogni lettura i sospesi di prima si tolgono e si rimettono quelli di adesso (se la banca li rifiuta spariscono da soli, se li registra ricompaiono come registrati).
  Accanto a ogni sospeso: **«contato · Spesa»** (conta nelle somme), **«non contato · Altro»** (non viene da un pocket Spesa, Svago o Carburante: smistalo in Movimenti), **«non ancora nell'app»** (premi **Aggiorna**) o **«non leggibile»**.
  Le banche concedono pochi mesi di storico (Revolut, di norma, 90 giorni) e ad ogni lettura i movimenti già letti restano: solo quelli dal 1 ottobre 2026 entrano nei dati dell'app. La scheda funziona solo se anche il **server** è aggiornato; per vederla prima c'è la demo (vedi «Banche collegate»).
- **Budget.** Quanto vuoi spendere al mese in *Spesa*, *Svago* e *Carburante* (vuoto = nessun budget); si salva da solo. **Il risparmio non si imposta: è un risultato**, cioè entrate medie − spese fisse medie − totale dei budget. Le **entrate medie** sono la media degli **ultimi 3 mesi chiusi** con entrate (buste paga);
  le **uscite** (spese fisse: bollette e affitto, e le medie di spesa, svago e carburante) si calcolano **solo dai mesi chiusi dal 1 ottobre 2026**, quindi la prima stima compare a novembre. Una barra divide l'entrata media tra spese fisse, le tre voci e il risparmio; per ogni voce una barra mostra quanto hai già speso questo mese rispetto al budget
  (arancione da 80%, rosso oltre; il widget mostra invece il residuo). «Parti dalle medie» copia le medie nei budget. A ogni cifra scritta tutto si aggiorna.
- **Documenti** (in **Impostazioni → Documenti**; un numero sull'ingranaggio dice quanti sono da controllare). Tre sezioni: **Bollette**, **Buste paga** ed **Estratti conto**, ognuna con **il proprio indirizzo in cima** (link Seafile pubblico o percorso locale) e il pulsante *Salva*. In alto **Carica documento** e **Aggiorna** (legge solo i file nuovi o modificati; Maiusc + clic rilegge tutto).
  Carica documento: scegli il file, il nome e che cosa è: *bolletta* (PDF: utenza e casa, se il mese non è nel PDF scrivilo nel nome, es. «Luce 2026.09»), *busta paga* (PDF) o *estratto conto UniCredit* (PDF: se ne legge solo la rata del prestito).
  I file caricati restano sul server (`data/uploads`). Quelli letti male sono segnati *Da controllare*: con **Modifica** correggi tipo, periodo e importo (la correzione sopravvive agli aggiornamenti) oppure scegli **Ignora**. Sul telefono ogni documento è un riquadro: nessuno scorrimento laterale.
- **Impostazioni → Affitto**: **importo totale**, **la tua quota (%)** e **dal mese**; il **risultato** (totale × quota) è quello che conta ogni mese. Non ci sono più i nomi delle case: le case sono «Casa 1» e «Casa 2» (le cartelle delle bollette si chiamano così).

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
npm run apk -- --generico  # senza l'indirizzo del server incorporato: l'app lo chiede alla prima apertura (per distribuirla)
```

L'app Android ha in più:
- **Widget «Questo mese 2»** (Widget → Bilancio → Questo mese 2, **5×2**: cinque colonne, due righe; è l'unico widget del mese: il «Questo mese» a una riga è stato tolto): a sinistra una colonna di **tre parti**, poi **tre riquadri di spesa** affiancati, **Spese, Svago, Carburante**, con le cifre dal primo del mese in corso.
  - **Colonna di sinistra**, una parte sopra l'altra: (1) **«Da pagare»** (le voci non ancora pagate, con quante sono, **nella tua quota**: vedi «Bollette») con la cifra, **ambra** finché resta qualcosa (scritte in teal scuro) e **neutra come gli altri riquadri** quando è tutto pagato;
    (2) la **barra del mese**, divisa in **settimane vere (da lunedì a domenica) con i divisori che cadono sulle domeniche**: è larga in proporzione ai giorni, si riempie con quelli passati (oggi compreso) e i blocchi sono da quattro a sei, col primo e l'ultimo più corti se il mese comincia o finisce a metà settimana
    (un mese che finisce di domenica non ha il divisore a fine barra); con scritto **dentro** «mancano 25 g» (o «ultimo giorno»); (3) **l'ultimo aggiornamento delle banche collegate** («banca 12:05» se è di oggi, «banca 4 ott 17:00» altrimenti; la più recente tra le banche; se non ce n'è nessuna questa parte sparisce e le altre due si allargano).
    Le tre parti si dividono la colonna in proporzione **4 : 1 : 1**: «Da pagare» due terzi, barra del mese e riga della banca un sesto ciascuna, con un minimo se il widget è basso.
  - **Riquadri di spesa**: con il budget impostato mostrano il **residuo** (budget meno speso, negativo se superato; senza budget, la spesa del mese). Se hai impostato un **budget** (scheda Budget) ogni riquadro è un **contenitore con il liquido del residuo, che scende man mano che spendi**
    (pieno a spesa zero, vuoto a budget finito o superato), su tutta la cella: bianco trasparente, **ambra da 80% del budget speso** (cioè quando resta il 20%); la superficie del liquido è un'**onda sinusoidale che scorre verso destra** (fotogrammi alternati da un ViewFlipper: consuma un po' di batteria
    finché la Home è visibile; la forma dell'immagine è alta come il riquadro); senza budget il riquadro resta vuoto. In ogni riquadro **stima e reale stanno una sotto l'altra** («stima €9,40» e sotto «reale €12,35», al giorno: la stima è il budget diviso i giorni del mese, la reale quanto speso finora diviso i giorni passati,
    oggi compreso; valuta davanti e centesimi sempre per intero; la reale è **bianca se è pari o migliore della stima, ambra se peggiore**; senza budget non c'è confronto); le due righe stanno insieme in un solo sfondo tondo in teal scuro, così l'ambra si legge su qualunque colore del riquadro.
  - **Palette**: un solo sistema di colori per tutte le celle: il teal dell'app come sfondo, riquadri bianchi trasparenti tutti uguali (anche la barra del mese e la riga della banca; la parte già trascorsa della barra è un bianco più marcato) e **un solo colore d'allarme, l'ambra**:
    «Da pagare» quando resta qualcosa, il liquido oltre l'80% speso, la «reale» peggiore della stima.
  - **Testi**: «Da pagare», «Spese», «Svago», «Carburante», «mancano 25 g» e «banca 12:05» hanno la stessa dimensione (12 sp) e lo stesso stile, senza «resta»; le cifre sono tutte da 16,5 sp in grassetto.
  - **Spazi**: bordo esterno di 8 dp uguale su tutti i lati e 6 dp fra i riquadri e fra le tre parti della colonna di sinistra; la cifra, la stima e la reale hanno più aria.
  - **Tasti**: **ogni riquadro è un tasto**: Spese, Carburante e Svago aprono Movimenti sul mese in corso già filtrati per quella categoria, «Da pagare» (e il resto della colonna) apre la Panoramica; il bordo del widget apre l'app. Stesse cifre delle colonne della Panoramica; si aggiorna ogni mezz'ora, quando apri l'app e quando cambi categorie, importi, spunte o budget.
    (I budget arrivano dal server: serve la versione che li include.)
  - **Dopo un aggiornamento** un widget già messo sulla Home mantiene la sua dimensione: se resta alto una riga, allungalo (tieni premuto, trascina il bordo in basso, serve spazio libero sotto) oppure toglilo e aggiungilo di nuovo dall'elenco dei widget. Chi aveva il vecchio «Questo mese» (5×1) lo vede sparire dalla Home e può aggiungere «Questo mese 2».
  - Il codice è in `MonthWidgetStacked.java` (il nome è quello registrato nel manifest, che non si cambia per non far sparire il widget; la logica è in `MonthWidget.java`) e il layout si genera con `node scripts/genera-widget.mjs` (lì si cambiano anche le misure e il tempo di cambio fotogramma).
- **Widget «Saldo»** (Widget → Bilancio, **3×1**; mostra Revolut): due riquadri affiancati nello stesso stile di «Questo mese 2» (teal, riquadri bianchi trasparenti, etichette da 12 sp e cifre da 16,5 sp in grassetto, nessun altro colore): a sinistra **«Saldo Revolut»**, con il **saldo totale in euro** (conti e pocket, **compresi i pagamenti in sospeso**)
  e sotto da quando sono i dati; a destra **«Ultimo»**, con l'**ultimo movimento** (importo e nome; «In sospeso» se non ancora registrato). **Non è in tempo reale**: legge dal server l'ultima copia della scheda Banche e non chiama mai la banca. Si aggiorna quando premi «Leggi dalla banca» o «Aggiorna ora» nell'app e ogni mezz'ora rilegge dal server;
  un tocco apre la scheda Banche. Serve il server alla versione che ha `/api/banking/widget` (0.36.0). Un «Saldo» già sulla Home (4×1) resta largo quattro colonne finché non lo restringi: i due riquadri si adattano.
- **Anteprima nella lista dei widget**: ogni widget ha un'anteprima statica con dati di esempio (`previewLayout`, Android 12 e successivi; quella di «Questo mese 2» è generata da `scripts/genera-widget.mjs`, quella del Saldo è scritta a mano) e, da Android 15, l'anteprima **con i tuoi dati veri**,
  aggiornata dal widget stesso (al massimo una volta l'ora). Se ne hai già uno sulla Home e l'anteprima non cambia, il launcher la tiene in cache: riavvialo o aspetta.
- **Notifica del primo del mese** (alle 9): quanti conti restano da pagare e quali, se ce ne sono. Alla prima apertura l'app chiede il permesso
  per le notifiche. Per provarla subito: `adb shell am broadcast -n app.bilancio.mobile/.Monthly -a app.bilancio.mobile.MONTHLY`.
- **Promemoria personalizzati** (Impostazioni → Promemoria): scrivi cosa controllare (es. «Addebito del mutuo») e scegli la ricorrenza: ogni giorno,
  ogni settimana (giorno della settimana), ogni mese (giorno del mese; il 31 in un mese corto vale l'ultimo giorno) o ogni anno (giorno e mese), con l'ora.
  Si possono disattivare, modificare o eliminare. Restano sul telefono e usano la sveglia di sistema (può ritardare di qualche minuto).
- L'icona nella barra delle notifiche è il logo dell'app in una tinta sola (quadrato arrotondato con il segno ±), con il colore turchese dell'app.

Servono l'SDK Android (build-tools e una piattaforma) e Java 17; non serve Gradle. Lo script cerca l'SDK da solo in `~/Android/Sdk` e, su Windows, in `%LOCALAPPDATA%\Android\Sdk` (`C:\Users\<nome>\AppData\Local\Android\Sdk`, il percorso di Android Studio):
`ANDROID_HOME` serve solo se l'SDK è altrove. `adb` è nella cartella `platform-tools` dello stesso SDK (di norma non nel PATH) e lo script lo usa da solo con `--install`. Il telefono deve essere collegato: con il
debug wireless, se `adb devices` non lo mostra, `adb mdns services` lo fa ricomparire; se resta muto riattiva il debug wireless dal telefono.
L'indirizzo del server viene da `BILANCIO_SERVER` nel file `.env` e finisce solo nell'APK (`android/build/` è escluso da Git). L'APK è firmato
con la chiave di debug dell'SDK: per aggiornare l'app installata serve sempre la stessa chiave: con un'altra l'installazione si rifiuta e bisogna disinstallare prima l'app (si perdono promemoria e accesso).

## Uso

1. Apri **Impostazioni** (ingranaggio) e indica dove si trovano i documenti:
   - **Buste paga** e **Bollette**: un link di condivisione Seafile pubblico (`https://…/d/xxxx/`, senza password)
     oppure un percorso locale. Le sottocartelle vengono lette in automatico.
   - **Affitto**: importo mensile e mese di inizio, aggiunto in automatico ogni mese.
   - **Bollette**: la **tua quota di acqua, luce, gas e wifi** (di norma 50%: convivi e le dividi). L'app conta solo la tua parte (nelle uscite, nel «Da pagare», nel widget, nella notifica e nel budget); i PDF e l'importo dei documenti restano interi. Cambia la percentuale per cambiare la quota; l'affitto non è diviso.
2. In **Impostazioni → Documenti** premi **Aggiorna**: vengono letti solo i file nuovi o modificati (Maiusc + clic per rileggere tutto). La stessa ricerca parte da sola
   **ogni volta che apri l'app**: una targhetta in alto mostra l'avanzamento, e se la lettura la sta facendo qualcun altro (un altro browser,
   lo script di importazione) compare una fascia gialla con i dati parziali che si aggiornano da soli.
3. Controlla **Impostazioni → Documenti** per i file *Da controllare*.

## Come si smistano i movimenti

Non ci sono parole chiave né regole imparate: il tag di un movimento dipende solo dal **pocket da cui arriva** (il nome che vedi nella scheda Banche, anche se dato a mano con *Rinomina*):

- pocket **01 Spesa** → **spesa**; pocket **Svago** → **svago**; pocket **Carburante** → **carburante** (il numero davanti e le maiuscole non contano);
- la **rata del prestito** (UniCredit) è il tag **prestito**: una spesa fissa;
- **tutto il resto → altro**: si smista a mano, e **non conta in nessuna statistica, media o totale**. Anche le entrate sono «altro»: l'unica entrata dell'app è lo stipendio, dalle buste paga;
- una scelta a mano vale per quel solo movimento e non cambia gli altri. Solo le **uscite** dei tre pocket prendono il tag in automatico (le ricariche in entrata sul pocket restano «altro»).

I nomi dei pocket si cambiano con `pockets: { spesa, svago, carburante }` nelle impostazioni (`PUT /api/settings`); la data di inizio dei movimenti (di base `2026-10-01`) con `cutoff` (sempre il primo di un mese).
I movimenti vecchi (estratti conto, date prima di ottobre 2026) restano nel database ma l'app **li ignora**; nulla è stato cancellato.

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

**Quando si legge dalle banche:** (1) **ogni giorno alle 5, alle 12 e alle 17, in automatico, da tutte le banche collegate** (ora italiana, anche se il server gira in UTC; lo fa il server, non serve aprire l'app; l'esito dell'ultima lettura automatica è scritto in cima alla scheda Banche;
`BILANCIO_AUTO_READ_HOUR` cambia le ore (un elenco, es. `5,12,17`), `BILANCIO_NO_AUTO_READ=1` la spegne); (2) quando premi **Aggiorna** nella scheda Banche o **Aggiorna ora** in Impostazioni → Collega le banche (fanno la stessa cosa: una lettura che aggiorna tutto), quante volte vuoi fino al tetto giornaliero (vedi «Limiti»).
Le letture automatiche sono accessi senza utente presente e contano come tre delle 4 letture giornaliere concesse dalle banche a questi accessi. **Aggiorna** e l'apertura dell'app non toccano mai le banche. L'unica altra lettura è quella
subito dopo aver collegato una banca, perché è il solo momento in cui alcune banche concedono più storico.

**Limiti:** da **Aggiorna ora** e **Leggi dalla banca** (e dalla lettura dopo il collegamento) puoi leggere a mano **fino a 10 volte al giorno per banca** (finestra mobile di 24 ore; il contatore è unico per tutte queste letture).
Alla undicesima l'app rifiuta con «massimo 10 letture al giorno» senza chiamare la banca. Il tetto normale delle banche è 4 al giorno (PSD2, art. 36 delle norme tecniche RTS) e vale per gli accessi **senza l'utente presente**; per le letture fatte a mano l'app invia
le intestazioni «PSU» (`Psu-Ip-Address`, `Psu-User-Agent`, `Psu-Accept-Language`… ricavate dalla richiesta del browser o dell'app) che dichiarano alla banca che la lettura l'ha chiesta una persona in quel momento. Se la banca le rifiuta, l'app riprova subito senza.
**Non è garantito che ogni banca accetti più di 4 letture**: se Revolut o UniCredit rispondono con un errore di limite, il messaggio compare nell'app e vale il tetto della banca. Il consenso dura al massimo 180 giorni (meno se la banca lo riduce): a scadenza si ricollega con un tocco.

**Movimenti Revolut che «mancano» dopo la lettura.** Cause possibili, in ordine di probabilità: (1) fino alla 0.38 «Leggi dalla banca» aggiornava solo la scheda Banche; dalla 0.39.0 aggiorna tutta l'app;
(2) i pagamenti con la carta restano **in sospeso** per uno o due giorni: dalla 0.38.0 contano subito (in Movimenti con l'etichetta «in sospeso», nel saldo di Banche e nel widget Saldo) e spariscono se la banca li rifiuta; (3) sono di prima del **1 ottobre 2026** (non si leggono); (4) non vengono da un pocket Spesa, Svago o Carburante: sono «altro» e non contano, ma stanno in Movimenti; (5) due pagamenti identici nello stesso giorno senza identificativo della banca venivano contati come uno (corretto dalla 0.36.0).

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
2. **Decidere** — *fatto (0.39.0)*: i dati letti dalle banche **sono** i dati dell'app (Panoramica, Movimenti, Statistiche); la scheda Banche resta per saldi, conti e movimenti con il record originale.
3. **Telefono** — *fatto (0.31.0)*: la scheda Banche c'è anche nel browser del telefono e nell'app Android, con i movimenti in riquadri.
4. **Rilascio** — *fatto con la 0.31.0*; ogni fase successiva avrà il suo.

## Più case

Le bollette in sottocartelle con il nome di una casa sono tenute separate (le case si chiamano «Casa 1» e «Casa 2»; chi usava i vecchi nomi di cartella lancia `node scripts/rinomina-casa.mjs casa2 <nome>` con l'app ferma, vedi CHANGELOG 0.52.0). Nella tabella nessuna voce ha una colonna per casa: ogni voce somma le case e mostra il dettaglio nella cella.

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

**Script.** Gli script che parlano col server usano l'autenticazione HTTP Basic: `utente:password`, dove l'utente può essere
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
legge né si scrive nessun dato. Accanto al nome compare la versione delle pagine locali; passando il mouse si vede anche quella del server (non c'è più la scritta «locale»).
Il file `.env` resta sul tuo computer (è escluso da Git): l'indirizzo del server non va scritto nel codice né in questa documentazione.
Per tornare a un'app locale con database proprio (solo per provare), togli la riga.

Le pagine nuove lavorano sui dati del server: quelle che dipendono da codice del server (per esempio nuovi campi dei movimenti, che l'estratto
conto salva) hanno effetto completo solo dopo aver aggiornato anche il server.

## Sviluppo e rilascio

```
public/        pagine (index.html, app.js, charts.js, style.css, login.html)
src/           server Express: server.js, banking.js (banche collegate), uploads.js (documenti caricati), grid.js (tabella), scanner.js (lettura dei file), parsers.js (PDF),
               statements.js (movimento e tag) e movements.js (movimenti dal 1 ottobre 2026 col tag del pocket), bankexplorer.js (scheda Banche: saldi, andamento, nomi dei pocket),
               budget.js (budget di spesa e stime sul server), ocr.js, sources.js (cartelle e Seafile), auth.js, store.js, proxy-server.js (localhost collegato al server)
scripts/       reimposta-password.mjs, build-apk.mjs, genera-icone.mjs, genera-widget.mjs (layout del widget «Questo mese 2» e della sua anteprima), banca-finta.mjs e demo-banche.mjs (banca e demo con dati finti)
android/       app Android (manifest, codice Java: MainActivity, widget MonthWidget (Questo mese 2), BankWidget (Saldo), Due, Month…; script che inietta le chiamate al server)
test/          node --test; free-port.js sceglie porte libere per i test che avviano un server vero
```

- `npm test` dopo ogni modifica a `src/`; `npm run dev` riavvia da solo il server quando cambia il codice.
- **A ogni modifica dell'app** la versione sale (`npm version <x.y.z> --no-git-tag-version`), si aggiunge una voce in `CHANGELOG.md`, si eseguono i test e si installa l'APK sul telefono con `npm run apk:installa`
  (l'SDK si trova da solo in `~/Android/Sdk` o, su Windows, in `%LOCALAPPDATA%\Android\Sdk`; `ANDROID_HOME` solo se è altrove). **Commit, tag `vX.Y.Z` e push solo quando vengono chiesti**, tutti insieme (anche dei tag). La versione compare accanto al nome nell'app.
- I file `.env` e `data/` non vanno mai in Git; l'indirizzo del server e le password stanno solo lì.

## Regole di stile

L'aspetto è definito una volta sola nell'ultimo blocco di `public/style.css` («Sistema di stile»), con gli stessi valori nelle schede, nelle Impostazioni e nel login:
- **Testo:** 12 (note, pillole), 13 (etichette, intestazioni di tabella, testo secondario), 14 (testo, campi, pulsanti), 16 (titoli di sezione), 20 (titoli di pagina), 24 (numeri grandi; 22 sul telefono). Colori: `--ink` testo, `--muted` secondario.
- **Pulsanti:** stessa altezza (`--ctl-h`: 38, sul telefono 42) e angoli a 10. **Primario** = accento pieno; **secondario** (ghost, schede, Filtra, case) = superficie con bordo; **selezionato** = accento pieno; **link** = solo testo in accento.
- **Campi:** stessa altezza, angoli a 10, bordo `--line-strong`; quelli dentro le righe (categoria, importi del budget) sono più piccoli (30, angoli a 8).
- **Schede e riquadri:** angoli a 14, bordo `--line`, ombra leggera. **Linee:** solo da 1px e leggere (`--line`, nella Panoramica ancora più tenui).
