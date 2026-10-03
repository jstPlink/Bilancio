# Bilancio

App web (Node, Express) che legge buste paga, bollette in PDF e estratti conto della banca e li mostra in una panoramica per anno.
Vedi README.md per le schede, le impostazioni e il funzionamento.

## Regole di rilascio

- **Ad ogni push aggiorna la versione**: incrementa `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`),
  aggiungi la voce in `CHANGELOG.md`, committa, crea il tag `vX.Y.Z` e pusha anche i tag.
- **Ad ogni modifica dell'app aggiorna anche il telefono**, senza aspettare che l'utente lo chieda: dopo test e rilascio (versione, changelog, commit, tag, push)
  costruisci e installa l'APK con `npm run apk:installa`. Su Windows serve `ANDROID_HOME` che punta a `%LOCALAPPDATA%\Android\Sdk`
  (da Git Bash: `ANDROID_HOME="$LOCALAPPDATA/Android/Sdk" npm run apk:installa`). Se il telefono non risponde a adb, dillo all'utente.
  Ricorda sempre che il server (NAS) si aggiorna a parte: `docker compose pull && docker compose up -d` dopo che GitHub ha costruito l'immagine.
- Semver: patch per correzioni, minor per nuove funzioni, major per cambi incompatibili.
- Non committare mai `data/`, PDF, chiavi o link privati (sono in `.gitignore`).
- Dopo modifiche a `src/` esegui `npm test`.

## Avvio in localhost

- **Il localhost deve puntare al server dell'utente**, non a un database locale: `BILANCIO_SERVER=<indirizzo>` nel file `.env`
  (vedi README, «Localhost che punta al server»): pagine di questa cartella, dati e login dal server. Quando lanci l'app in localhost per l'utente usa `npm start` con quel `.env`.
- `.env` è escluso da Git: l'indirizzo e le password non vanno mai in codice, documentazione, commit o messaggi di commit.
- Se `.env` manca o non ha `BILANCIO_SERVER`, chiedi l'indirizzo all'utente una volta sola, scrivilo in `.env` e non lo riscrivere altrove.
- Se il server non ha ancora una funzione nuova (le pagine sono locali ma i dati vengono dal server, quindi la chiamata dà «va aggiornato»), per farla provare
  all'utente usa `npm run demo:banche` (scheda Banche) o una demo analoga con dati finti, su una porta a parte; non toccare il localhost collegato al server. Un processo di sfondo si interrompe da solo dopo un po': se la demo serve di nuovo, rilanciarla;
  all'utente ricordare che può lanciarla da sé in un terminale con `npm run demo:banche`.
- Per provare la grafica con dati finti usa un database a parte (cartella temporanea, `BILANCIO_DATA`, porta diversa) e fermalo a fine prova:
  mai riempire di dati di prova il database locale o il server dell'utente.

## Prima di fare domande

Controlla sempre README.md e questo file: avvio, configurazione, rilascio e regole del progetto sono già scritti lì.
Fai domande all'utente solo per ciò che la documentazione non dice.
