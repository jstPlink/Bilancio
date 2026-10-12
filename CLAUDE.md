# MyBank

App per monitorare i movimenti di UniCredit e Revolut (via Enable Banking) dal web e da Android, con budget, tag per pocket e widget.
Vedi README.md per le schede, i tag, l'avvio e la struttura. Riscrittura da zero di Bilancio (archiviata nel ramo `archivio/bilancio`: non riusarne il codice per abitudine).

## Tecnologia

Node 24 + Express 5, dati in un file JSON (`data/mybank.json`), pagine web in HTML/CSS/JS senza dipendenze (`public/`), app Android in Java costruita senza Gradle (`scripts/build-apk.mjs`). Lingua dell'interfaccia, dei commenti e della documentazione: italiano.

## Regole di rilascio

- **Commit e push solo quando l'utente li chiede.**
- **Ad ogni modifica dell'app**: incrementa `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`), aggiungi la voce in `CHANGELOG.md`, esegui `npm test` e, se il telefono è collegato col debug wireless, aggiorna l'app con `npm run apk:installa`
  (l'SDK si trova da solo in `~/Android/Sdk` o `%LOCALAPPDATA%\Android\Sdk`; `adb` sta in `platform-tools` dell'SDK, non nel PATH; se il telefono non risponde prova `adb mdns services` e `adb devices -l`, e se resta muto dillo all'utente).
- **Quando l'utente chiede commit e push**: committa tutto, crea il tag `mybank-vX.Y.Z` della versione corrente e pusha anche i tag (i tag `vX.Y.Z` sono tutti della vecchia app Bilancio: non vanno riusati). Il server (NAS) si aggiorna a parte: `docker compose pull && docker compose up -d` dopo che GitHub ha costruito l'immagine.
- Semver: patch per correzioni, minor per nuove funzioni, major per cambi incompatibili.
- Non committare mai `data/`, `.env`, chiavi, password o indirizzi privati (sono in `.gitignore`): l'indirizzo del server e le password non vanno in codice, documentazione, commit o messaggi di commit.
- Dopo modifiche a `src/` esegui `npm test`.

## Provare l'app

- `npm run demo` (banca finta + dati inventati su `http://localhost:4871`, database a parte in `data/demo`): per vedere la grafica e provare i flussi senza banche vere. Fermalo a fine prova; mai riempire di dati di prova il database vero (`data/mybank.json`) o il server dell'utente.
- **Il localhost deve poter puntare al server dell'utente**: con `MYBANK_SERVER=<indirizzo>` nel file `.env`, `npm start` serve le pagine di questa cartella e inoltra dati e login al server (`src/proxy.js`). Quando lanci l'app in localhost per l'utente usa `npm start`; se `.env` manca o non ha `MYBANK_SERVER`, chiedi l'indirizzo una volta sola, scrivilo in `.env` e non riscriverlo altrove (mai in codice, documentazione, commit o messaggi di commit).
- Se il server non ha ancora una funzione nuova (la chiamata dà errore), per far provare la grafica usa `npm run demo` su una porta a parte; non toccare il localhost collegato al server. Un processo di sfondo si ferma da solo dopo un po': se serve di nuovo, rilancialo.
- Senza `MYBANK_SERVER`, `npm start` avvia il server completo con i dati locali in `data/` (solo per sviluppo).

## Estetica (regole uniche, vedi README «Estetica»)

Carta e inchiostro, un solo rosso vermiglio, angoli vivi, filetti da 1px (2px a inizio sezione), serif per numeri e titoli, monospazio maiuscolo per le etichette. Scala del testo 11/13/15/22/34. Pulsanti e campi alti `--h`. Nuove schermate e il widget seguono le stesse regole: niente colori o forme nuove senza aggiornare queste righe e il README.

## Prima di fare domande

Controlla README.md e questo file: avvio, configurazione e regole sono scritti lì. Fai domande solo per ciò che la documentazione non dice.
