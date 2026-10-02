# Bilancio

App web locale (Node, Express) che legge buste paga e bollette in PDF. Vedi README.md.

## Regole di rilascio

- **Ad ogni push aggiorna la versione**: incrementa `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`),
  aggiungi la voce in `CHANGELOG.md`, committa, crea il tag `vX.Y.Z` e pusha anche i tag.
- Semver: patch per correzioni, minor per nuove funzioni, major per cambi incompatibili.
- Non committare mai `data/`, PDF, chiavi o link privati (sono in `.gitignore`).
- Dopo modifiche a `src/` esegui `npm test`.

## Avvio in localhost

- **Il localhost deve puntare al server dell'utente**, non a un database locale: `BILANCIO_SERVER=<indirizzo>` nel file `.env`
  (vedi README, «Localhost che punta al server»): pagine di questa cartella, dati e login dal server. Quando lanci l'app in localhost per l'utente usa `npm start` con quel `.env`.
- `.env` è escluso da Git: l'indirizzo e le password non vanno mai in codice, documentazione, commit o messaggi di commit.
- Se `.env` manca o non ha `BILANCIO_SERVER`, chiedi l'indirizzo all'utente una volta sola, scrivilo in `.env` e non lo riscrivere altrove.
- Per provare la grafica con dati finti usa un database a parte (cartella temporanea, `BILANCIO_DATA`, porta diversa) e fermalo a fine prova:
  mai riempire di dati di prova il database locale o il server dell'utente.

## Prima di fare domande

Controlla sempre README.md e questo file: avvio, configurazione, rilascio e regole del progetto sono già scritti lì.
Fai domande all'utente solo per ciò che la documentazione non dice.
