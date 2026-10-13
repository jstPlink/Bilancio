// Parole con le coordinate di due estratti UniCredit inventati (stesso formato di `pdftotext -bbox`), per i test: un conto corrente e una carta Flexia.
let seq = 0;
const w = (p, t, x0, x1, y) => ({ p, t, x0, x1, y0: y, y1: y + 7, id: seq++ });
const row = (p, y, items) => items.map(([t, x0, x1]) => w(p, t, x0, x1, y));

/** Conto: saldo iniziale -100,00 · uscite 70,00 (addebito carta 50,00 + bar 20,00) · entrate 1.500,00 (stipendio) · saldo finale 1.330,00. */
export const contoWords = () => [
  ...row(0, 40, [['Saldo', 69, 91], ['iniziale', 93, 119], ['al', 121, 127], ['31.12.2024', 129, 171], ['Uscite', 192, 216], ['Entrate', 315, 342], ['Saldo', 438, 460], ['finale', 462, 482]]),
  ...row(0, 57, [['100,00-', 69, 98], ['70,00', 192, 215], ['1.500,00', 315, 348], ['1.330,00', 438, 471]]),
  ...row(0, 90, [['Data', 45, 63], ['Valuta', 86, 112], ['Descrizione', 127, 175], ['Uscite', 469, 495], ['Entrate', 529, 559]]),
  ...row(0, 120, [['31.12.24', 47, 80], ['SALDO', 127, 156], ['INIZIALE', 158, 192], ['A', 194, 200], ['VS.', 202, 216], ['DEBITO', 217, 249], ['100,00', 470, 496]]),
  // stipendio: titolo sopra la data, dettagli sotto
  ...row(0, 131, [['BONIFICO', 127, 168], ['A', 170, 176], ['VOSTRO', 178, 214], ['FAVORE', 216, 251]]),
  ...row(0, 140, [['BONIFICO', 127, 168], ['SEPA', 170, 190], ['DA:', 192, 205], ['DITTA', 207, 230], ['ESEMPIO', 232, 262], ['SRL', 264, 280], ['PER:', 282, 300], ['STIPENDIO', 302, 340]]),
  ...row(0, 144, [['02.01.25', 47, 80], ['02.01.25', 88, 121], ['1.500,00', 526, 559]]),
  ...row(0, 149, [['COMM:', 127, 160], ['SERV:', 162, 190]]),
  // addebito mensile della carta di credito (estratto di dicembre 2024)
  ...row(0, 162, [['PAGAMENTO', 127, 182], ['PER', 183, 201], ['UTILIZZO', 203, 241], ['CARTE', 243, 271], ['DI', 273, 282], ['CREDITO', 283, 321]]),
  ...row(0, 166, [['06.01.25', 47, 80], ['05.01.25', 88, 121], ['50,00', 474, 495]]),
  ...row(0, 171, [['ESTRATTO', 127, 173], ['12/2024', 174, 205], ['CARTA', 207, 236], ['5XXXXXXXXXXX1502', 238, 324]]),
  // bar con la carta di debito
  ...row(0, 184, [['PAGAMENTO', 127, 182], ['MASTERCARD', 183, 243], ['E-Commerce', 245, 295], ['del', 296, 308], ['07/01/2025', 309, 352]]),
  ...row(0, 188, [['07.01.25', 47, 80], ['05.01.25', 88, 121], ['20,00', 474, 495]]),
  ...row(0, 193, [['CARTA', 127, 156], ['*1535', 158, 180], ['DI', 182, 191], ['EUR', 192, 210], ['20,00', 213, 234], ['BAR', 236, 253], ['ROMA', 255, 280]]),
  ...row(0, 300, [['Per', 67, 80], ['il', 83, 87], ['blocco', 88, 113], ['della', 115, 133], ['sua', 135, 148], ['carta', 150, 169]]),
];

/** Carta: un acquisto di 20,00 del dicembre 2024; totale del mese 20,00. */
export const cartaWords = () => [
  ...row(0, 208, [['Data', 62, 81], ['Riferimento', 103, 150], ['Descrizione', 156, 202], ['Importo', 362, 395], ['in', 397, 405], ['Divisa', 415, 439], ['Importo', 516, 549]]),
  ...row(0, 237, [['Pagamento', 156, 200], ['E-Commerce', 202, 253], ['BAR', 255, 275], ['ROMA', 277, 305]]),
  ...row(0, 241.8, [['05.12.24', 55, 89], ['H44224', 112, 142], ['20,00', 536, 558]]),
  ...row(0, 246.5, [['4029357733', 156, 204], ['03.12.24', 206, 240]]),
  ...row(0, 300, [['Totale', 45, 71], ['movimenti', 73, 117], ['effettuati', 119, 150], ['nel', 152, 163], ['mese', 165, 188], ['20,00', 536, 558]]),
];
