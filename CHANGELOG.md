# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `mybank-vX.Y.Z` (i tag `vX.Y.Z` appartengono alla vecchia app Bilancio).

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
