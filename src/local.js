// Avvio del frontend locale (`npm start`): solo le pagine, nessun dato e nessuna logica; tutto il resto lo fa il server scelto al login.
// Per avviare il server vero (anche in locale, per sviluppo) usa `npm run server`.
process.env.MYBANK_LOCAL_START = '1';
await import('./proxy.js');
