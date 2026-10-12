# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `mybank-vX.Y.Z` (i tag `vX.Y.Z` appartengono alla vecchia app Bilancio).

## 0.15.1
- **Storico (web)**: i valori di entrate, uscite e bilancio sono più piccoli del 15%; sul telefono restano come prima.
- **Documentazione**: README riscritto per intero (architettura server/frontend/app, schede, widget, API, avvio, rilascio) e `CLAUDE.md` aggiornato con le regole di lavoro.
- **Documentazione** (ritocco finale, senza cambiare l'app): aggiunte le sezioni «Sicurezza e dati» (password, chiavi, gettone, backup) e «Problemi frequenti» (404 dopo un aggiornamento, «Redirect URI not allowed», password, cache della pagina, widget, installazione sul telefono).

## 0.15.0
- **Statistiche**: anche le **entrate**. In alto Entrate, Uscite e Bilancio (con il numero di movimenti); poi uscite per categoria, mese per mese (una barra verde sottile per le entrate sopra quella delle uscite, e a destra entrate e uscite del mese), dove vanno i soldi e, nuovo, **da dove arrivano le entrate** (le otto controparti che pesano di più). I giroconti non contano. Il totale coincide con lo Storico (test). Serve il server alla 0.15.0.
- **Widget**: «19 giorni rimanenti» e «aggiornamento 22.45» hanno la stessa dimensione del titolo dei pocket delle celle accanto (9,5).

## 0.14.1
- **Widget**: nella prima cella il testo è in parole: «19 giorni rimanenti» e «aggiornamento 22.45» (con la data se non è di oggi), per occupare più spazio.
- **Errore 404**: se il server è più vecchio dell'app e non ha una funzione (per esempio le Statistiche prima dell'aggiornamento a 0.13.0), compare «Il server non ha ancora questa funzione: aggiornalo» invece di «Errore 404».

## 0.14.0
- **Banche → Movimenti**: un tocco su una riga di conto o pocket (anche di Revolut) apre la scheda Movimenti filtrata per quel conto o pocket; sopra l'elenco compare «Conto o pocket: …» con «Togli il filtro». Il filtro si somma agli altri (tag, mese, ricerca) e sparisce toccando la scheda Movimenti. API: `GET /api/transactions?account=<uid>` (serve il server alla 0.14.0).

## 0.13.1
- **Widget**: ripristinata la stessa larghezza per le quattro celle (la prima non è più stretta); restano le barre larghe 14 dp, i testi su due righe nella prima cella e il tocco che apre il Budget.

## 0.13.0
- **Nuova scheda Statistiche** (tra Movimenti e Budget): le **uscite** dell'anno (o di un mese) divise per **categoria** con quota e importo, **mese per mese** con le barre divise per categoria (un tocco su un mese lo filtra, un secondo tocco torna a tutto l'anno) e **dove vanno i soldi** (le otto controparti che pesano di più). Contano solo le uscite: giroconti ed entrate no. API: `GET /api/stats?year=&month=` (serve il server alla 0.13.0).
- **Widget**: barre più larghe del 25% (14 dp); la prima cella (mese) è più stretta del 35% e mostra «AGG.» e l'ora su due righe; **un tocco sulla prima cella apre il Budget**.
- **Banche → orari**: sul telefono occupano tutta la larghezza dello schermo (quattro in una riga).
- **Storico**: testi di entrate, uscite e bilancio più grandi del 20% (etichette e numeri); **versione** dell'app più grande del 20%.

## 0.12.0
- **Widget**: le barre sono più larghe del 50% (11,25 dp); le barre dei pocket (Spesa, Svago, Carburante) hanno tre tacche, al 25%, 50% e 75% dell'altezza, per leggere meglio lo stato; la spesa giornaliera **reale** migliore della stima è **bianca** (non più verde), peggiore resta rossa.

## 0.11.0
- **Versione**: nell'app Android in alto compare sempre la versione dell'app (e del suo frontend), non più quella del server; si alza a ogni modifica.
- **Storico**: i numeri di entrate, uscite e bilancio sono più grandi del 30%.
- **Budget sul telefono**: i tre campi del budget stanno nelle stesse tre colonne dei riquadri sotto, senza uscire dallo schermo.
- **Banche**: gli orari stanno su una sola riga (menu senza freccia, più stretti; anche con quattro orari sul telefono).
- **Opzioni**: tolti i testi «la password con cui entri…», «MyBank vX · aggiornamenti automatici alle…», «solo nell'app Android» e «il login resta valido 180 giorni…»; il pannello del server compare solo nell'app e nel localhost.
- **Widget**: barre più spesse del 50%; la barra del mese ora sale dal basso: i giorni già trascorsi sono in basso, in bianco, e il vuoto delle domeniche segue lo stesso verso.

## 0.10.0
- **Il frontend sta nell'APK**: pagina, script, stile e icona dell'app Android sono quelli dell'APK (`assets/www`, copiati da `public/` a ogni build) e la WebView li serve al posto di quelli del server; le chiamate ai dati (`/api/…`) e il resto vanno al server, che ha tutta la logica. Così l'app sul telefono mostra sempre la grafica della sua versione (prima mostrava quella del server, anche vecchia: icona e righe non aggiornate), e basta `npm run apk:installa` per aggiornarla. Il sito nel browser continua a usare le pagine del server; in alto l'app mostra la propria versione.
- **Widget**: le barre sono verticali, a sinistra di ogni cella, e si svuotano dall'alto verso il basso (mese: i giorni che restano, con un vuoto a fine di ogni domenica; categorie: il residuo del budget).
- **Banche → orari**: uno accanto all'altro in orizzontale (si va a capo se non c'è spazio), con la × più vicina all'orario; vale per web e telefono.

## 0.9.0
- **Widget** (telefono): le quattro celle hanno la stessa larghezza; un solo carattere (sans-serif) in tutto il widget; **nessuna riga rossa sulle domeniche**: la barra del mese lascia un vuoto a fine di ogni domenica; i **giorni che restano stanno sopra la barra**; ogni cella di categoria ha una **barra del residuo** (si accorcia man mano che si spende, rossa quando resta il 20% o meno) e **il nome della categoria** (prima il nome non compariva: il codice non lo scriveva); un tocco su **Spesa, Svago o Carburante apre i Movimenti del mese filtrati per quella categoria**, sulla cella del mese apre Banche, altrove l'app.
- **Web**: l'icona dell'app sta all'estrema sinistra, prima del nome; gli indirizzi come `#movimenti:spesa` aprono i Movimenti del mese filtrati per quel tag (li usa il widget) e la pagina segue i cambi di indirizzo.

## 0.8.0
- **Icona**: di nuovo le tre barre di dimensioni diverse con quella in basso rossa (senza cerchio e quadrato), sul sito, in alto a destra nell'app web e nell'APK.
- **Banche → Aggiornamento**: tolti i testi «si memorizzano i movimenti dal…», «massimo 4, tocca un orario per cambiarlo», «le banche non concedono più accessi…», «prossimo…» e «per gli aggiornamenti in più…». Restano l'ultimo aggiornamento, gli orari e «Aggiorna ora»; gli errori dell'ultimo aggiornamento automatico compaiono solo se ci sono.
- **Movimenti**: la barra rossa dei pagamenti in sospeso non cambia più la spaziatura (le altre righe hanno lo stesso margine, trasparente). Sul telefono i dati stanno su tre colonne: data, titolo con sotto il destinatario, importo con sotto la categoria.

## 0.7.0
- **Logo** (proposta B): un quadrato e un cerchio in contorno attorno a tre barre che si accorciano, l'ultima rossa, su fondo inchiostro. È l'icona dell'app Android, l'icona del sito e compare in alto a destra nell'app web (i quattro mockup e la scelta sono in `design/`).
- **Widget**: corretto il «Problema nel caricamento del widget». I separatori erano `<View>`, che il launcher non accetta nei widget (solo FrameLayout, LinearLayout, ImageView, TextView…): ora sono LinearLayout. Un test controlla che i layout dei widget usino solo view ammesse.
- **Storico e Budget su tre colonne**: entrate, uscite e bilancio dell'anno, i tre campi del budget e i tre riquadri del mese stanno sempre affiancati, anche sul telefono.
- **Movimenti sul web** (non sul telefono): a sinistra la data (giorno e mese, sotto l'anno), poi il titolo (la causale se c'è) e sotto il destinatario e il conto, poi l'importo e infine la categoria.

## 0.6.0
- **Movimenti solo dal 1 ottobre 2026** (per ora): quelli precedenti non si leggono dalla banca, non si salvano e non si mostrano; all'avvio il server toglie dai dati quelli già presenti. La data di inizio è `settings.cutoff` (di base `2026-10-01`).
- **Orari di aggiornamento in verticale**, uno sotto l'altro; si tocca un orario per cambiarlo direttamente (menu) e si toglie con «Togli».
- Elenco a discesa leggibile nel tema scuro (testo chiaro su fondo scuro).
- Freccia dei blocchi collassabili uguale per Enable Banking, UniCredit e Revolut.
- Testo della versione dimezzato; tolte le note in fondo allo Storico.
- Demo: avviso rosso «Dati di prova inventati» in alto, per non scambiarli per movimenti veri; la banca finta ora ha dati recenti.
- **Widget**: anteprima con i dati reali nella lista dei widget (Android 15+); prima resta quella con dati di esempio.
- **Localhost solo frontend**: `npm start` serve soltanto le pagine e non ha dati né logica; nella pagina di accesso si sceglie il server a cui collegarsi (ricordato nel browser, «Opzioni → Cambia server» lo cambia) e ogni chiamata va a quel server. Il server vero si avvia con `npm run server` (e da Docker, invariato).
- Frecce dei blocchi collassabili grandi il doppio; testo della versione +35% e poi +20% (13px); orari di aggiornamento tolti con un quadratino con la × rossa.

## 0.5.0
- **Orari di aggiornamento modificabili** (scheda Banche → Aggiornamento): si tolgono con la × e se ne aggiungono con il menu, da 1 a 4 (le banche concedono 4 accessi automatici al giorno); salvati sul server, il prossimo aggiornamento si ricalcola subito. Quelli di base restano 5, 11, 14 e 19.
- **Password da almeno 5 caratteri** (prima 8).
- **Localhost che punta al server**: con `MYBANK_SERVER` nel file `.env`, `npm start` serve le pagine di questa cartella e inoltra dati e login al server (nessun dato locale).

## 0.4.0
- **Opzioni** non è più una scheda: è un pulsante in alto a destra, al posto di «Esci». In cima alle Opzioni c'è **Cambia password**, che apre una finestra (password attuale e due volte la nuova); **Esci** sta in fondo alle Opzioni.
- **Banche collassabili**: UniCredit e Revolut si chiudono e si aprono; Revolut parte chiusa.
- **Versione** in alto a destra al posto della data dell'ultimo aggiornamento (che resta nella scheda Banche), ingrandita del 50%.

## 0.3.1
- **Correzione**: dopo un aggiornamento un browser, l'app o un proxy poteva tenere un `app.js` vecchio con la pagina nuova, e la scheda Opzioni riportava alla pagina iniziale. Ora la pagina non si tiene mai in cache e punta a script e stile con la versione nell'indirizzo (`app.js?v=0.3.1`).

## 0.3.0
- **Scheda Opzioni**: cambio della password dell'account (serve la password attuale, almeno 8 caratteri; salvata come impronta scrypt in `data/auth.json`; gli altri accessi decadono e quello che cambia resta attivo), uscita dall'account, informazioni e, nell'app Android, «Cambia server». `MYBANK_PASSWORD` resta la password iniziale.
- Documentato come ritrovare la chiave di Enable Banking (si scarica una sola volta: se è persa, se ne crea una nuova).

## 0.2.0
- **Prima versione di MyBank**, scritta da zero (server Node, web e app Android con widget).
- **Collegamento di UniCredit e Revolut** con Enable Banking, in sola lettura; storico di un anno (90 giorni se la banca non lo concede).
- **Tag per pocket**: 01 Spesa → Spesa, 02 Svago → Svago, 03 Carburante → Carburante, 04 Altro → Altro; ogni altro pocket, il conto principale e UniCredit → Non definito. Entrate e giroconti riconosciuti in automatico; tag modificabile a mano.
- **Storico** dell'anno con entrate, uscite e bilancio per mese; **Movimenti** con filtri; **Budget** mensile per Spesa, Svago e Carburante.
- **Aggiornamento automatico 4 volte al giorno** (5, 11, 14, 19, ora italiana) e pulsante «Aggiorna ora»; limiti delle banche contati a parte per gli accessi automatici e per quelli a mano.
- **Widget 5×1**: barra del mese con tacche sulle domeniche e giorni che restano, ora dell'ultimo aggiornamento, residuo del budget di Spesa, Svago e Carburante con spesa giornaliera stimata e reale.
- **Estetica nuova** (carta e inchiostro, rosso vermiglio, angoli vivi, serif e monospazio) su web, app, icona e widget.
- Docker (immagine `ghcr.io/jstplink/mybank`), banca finta e demo per provare senza banche vere.

## 0.1.0
- Progetto vuoto: l'app Bilancio è stata archiviata (ramo `archivio/bilancio`, tag `archivio-bilancio-v0.45.0`, che in realtà punta all'ultimo stato, la 0.55.5) e MyBank riparte da zero.
