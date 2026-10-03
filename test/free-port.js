import net from 'node:net';

// Una porta libera scelta dal sistema: i test che avviano un server vero girano insieme e non devono scegliere la stessa porta.
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}
