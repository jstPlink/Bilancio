# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `mybank-vX.Y.Z` (i tag `vX.Y.Z` appartengono alla vecchia app Bilancio).

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
