// Avvio del server: node src/start.js (variabili: PORT, HOST, MYBANK_DATA, MYBANK_PASSWORD, MYBANK_PUBLIC_URL, MYBANK_NO_AUTO).
// Con MYBANK_SERVER (file .env) il localhost non ha dati suoi: pagine di questa cartella, dati e login inoltrati a quel server (vedi proxy.js).
if (process.env.MYBANK_SERVER) {
  await import('./proxy.js');
} else {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { createApp, VERSION } = await import('./server.js');

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const port = Number(process.env.PORT ?? 4870);
  const host = process.env.HOST ?? '127.0.0.1';
  const password = process.env.MYBANK_PASSWORD ?? '';
  if (!password && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    console.error('MYBANK_PASSWORD manca: senza password il server può girare solo su 127.0.0.1 (HOST). Imposta la password nel file .env o nell\'ambiente.');
    process.exit(1);
  }

  const { app, scheduleAutoRead } = createApp({ dir: process.env.MYBANK_DATA ?? path.join(root, 'data'), password, publicUrl: process.env.MYBANK_PUBLIC_URL ?? '' });
  if (!process.env.MYBANK_NO_AUTO) scheduleAutoRead();
  app.listen(port, host, () => console.log(`MyBank ${VERSION} su http://${host}:${port}${password ? '' : ' (accesso libero: solo in locale)'}`));
}
