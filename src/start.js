// Punto di avvio di "npm start": se BILANCIO_SERVER è impostato (file .env) il localhost inoltra tutto a quel server,
// altrimenti parte l'app completa con il suo database locale. Il container Docker avvia direttamente server.js.
if (process.env.BILANCIO_SERVER) await import('./proxy-server.js');
else await import('./server.js');
