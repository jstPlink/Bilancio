# Bilancino

App web locale (Node, Express) che legge buste paga e bollette in PDF. Vedi README.md.

## Regole di rilascio

- **Ad ogni push aggiorna la versione**: incrementa `version` in `package.json` (`npm version <x.y.z> --no-git-tag-version`),
  aggiungi la voce in `CHANGELOG.md`, committa, crea il tag `vX.Y.Z` e pusha anche i tag.
- Semver: patch per correzioni, minor per nuove funzioni, major per cambi incompatibili.
- Non committare mai `data/`, PDF, chiavi o link privati (sono in `.gitignore`).
- Dopo modifiche a `src/` esegui `npm test`.
