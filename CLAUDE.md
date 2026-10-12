# MyBank

Nuova app, ripartita da zero. Il codice della precedente (Bilancio) non va riusato per abitudine: sta nel ramo `archivio/bilancio` e si consulta solo se serve.

## Punto di partenza

- **Cosa fa l'app non è ancora scritto.** Quando l'utente descrive i requisiti, scrivili in `README.md` (cosa fa, come si avvia, come si configura) prima o insieme al codice, e tieni questo file e il README allineati.
- Scegli lo stack più semplice che soddisfa i requisiti e dichiaralo qui sotto in «Tecnologia» appena deciso. Non ereditare scelte da Bilancio (Node/Express, Android, Docker/NAS) senza che i requisiti le richiedano.
- Lingua dell'interfaccia, dei commenti e della documentazione: italiano.

## Tecnologia

_Da decidere con i requisiti._

## Regole di rilascio

- **Commit e push solo quando l'utente li chiede.**
- **Ad ogni modifica**: incrementa `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`), aggiungi la voce in `CHANGELOG.md`, esegui i test se esistono.
- **Quando l'utente chiede commit e push**: committa tutto, crea il tag `mybank-vX.Y.Z` della versione corrente e pusha anche i tag (i tag `vX.Y.Z` sono tutti della vecchia app Bilancio: non vanno riusati).
- Semver: patch per correzioni, minor per nuove funzioni, major per cambi incompatibili.
- Non committare mai dati personali (`data/`), file `.env`, chiavi, password o link privati.

## Prima di fare domande

Controlla README.md e questo file: avvio, configurazione e regole sono scritti lì. Fai domande solo per ciò che la documentazione non dice.
