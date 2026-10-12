# Changelog

Ogni push aggiorna la versione (`package.json`) e aggiunge una voce qui, con il tag Git `vX.Y.Z`.

## 0.55.5
- **Panoramica**: tolte le colonne per casa (Luce e Gas sommano le case, il dettaglio resta nella cella); tolto il bordino colorato a sinistra delle celle. Il numero in fondo a **Da pagare** apre i Movimenti con solo le voci da pagare (pastiglia «Da pagare» e linea arancione; da lì si può anche segnare tutto pagato). Un clic sulle celle **Entrate** mostra solo i movimenti in entrata.

## 0.55.4
- **Filtro per tag** di Movimenti: solo Spesa, Svago, Carburante, Prestito e Altro (niente più le vecchie categorie: tasse, bollette, donazioni…). Col filtro **Prestito** si vedono anche le rate dagli estratti conto UniCredit (di tutti gli anni, prima di ottobre compreso).

## 0.55.3
- **Tolta la categoria «Giroconto»**: un movimento che parte da un pocket ha il tag di quel pocket anche se finisce in Risparmi. Al primo avvio i tag cambiati a mano sui movimenti senza controparte (i giri tra pocket) tornano quelli automatici del pocket di partenza.

## 0.55.2
- **Schede su una riga** anche sul telefono: tutte e cinque, con il testo che entra senza tagli.

## 0.55.1
- **Documenti rimesso nelle Impostazioni** (non Ã¨ piÃ¹ una scheda), con le tre sezioni e i loro indirizzi.

## 0.55.0
- **Documenti** (in Impostazioni): tre sezioni â€” **Bollette**, **Buste paga**, **Estratti conto** â€” ognuna con il proprio indirizzo in cima. Gli indirizzi non sono piÃ¹ in Â«Dove si trovano i documentiÂ». Su telefono la tabella Ã¨ a riquadri, senza scorrimento laterale.
- **Estratti conto UniCredit**: tornano, ma si legge **solo la rata del prestito** (spesa fissa, colonna *Prestito*); Ã¨ anche un tipo di Â«Carica documentoÂ». Prima di ottobre la rata viene da lÃ¬, da ottobre dalla banca.
- **Giroconto**: i movimenti senza controparte da o verso 01 Spesa, 02 Svago, 03 Carburante o Risparmi sono passaggi interni e **non compaiono in nessun elenco, statistica o totale**.
- **Affitto**: importo totale, la tua quota (%) e risultato. Tolti dalle Impostazioni i nomi delle case.
- **Panoramica**: Â«Da pagareÂ» si ricalcola dalle voci (non dipende piÃ¹ dal totale del server). **Uscite/Statistiche/Budget**: spese fisse = bollette, affitto e rata, **media degli ultimi 3 mesi chiusi**.
- **Movimenti e Banche**: niente prima del 1 ottobre; il tag Â«AltroÂ» non ha piÃ¹ Â«(non conta)Â». Il contorno colorato di ogni banca abbraccia anche conti e movimenti quando si apre. I titoli delle schede non restano colorati dopo il tocco.

## 0.54.0
- **Sistema dei movimenti rifatto da capo** (le due sezioni Storico/Bilancio della 0.53.0 non ci sono piÃ¹). **Gli estratti conto non si leggono piÃ¹**: niente CSV/PDF di banca, niente indirizzo degli estratti, niente riconoscimento di nome e datore di lavoro, giroconti, abbinamento delle bollette, parole chiave e regole imparate (tolti `pdfstatements`, `identity`, `reconcile`, `billmatch`, lo script `importa-su-server`).
- **I movimenti sono solo quelli delle banche, dal 1 ottobre 2026**: si leggono e si salvano solo da quella data (`cutoff` nelle impostazioni, primo del mese). Quelli vecchi restano nel database ma l'app li ignora; non Ã¨ stato cancellato nulla.
- **Nuovi tag**: il tag viene dal **pocket**: 01 Spesa â†’ *spesa*, Svago â†’ *svago*, Carburante â†’ *carburante*; **tutto il resto Ã¨ Â«altroÂ»**, da smistare a mano, e **non conta in nessuna statistica, media o totale**. Una scelta a mano vale per quel solo movimento. Nomi dei pocket cambiabili con `pockets`.
- **Panoramica**: bollette, affitto e buste paga dai documenti (di sempre) e spesa, svago e carburante dai movimenti dal 1 ottobre 2026. Tolte le colonne Prestito, Donazioni, Tasse e le Altre entrate. **Statistiche** e **Budget** seguono le stesse regole: nel Budget le entrate medie sono gli ultimi 3 mesi chiusi, le uscite contano dai mesi chiusi dal 1 ottobre 2026.
- **Scheda Banche**: la riga aperta e il suo dettaglio hanno un solo contorno colorato (anche sul telefono).

## 0.52.0
- **Pronta per Google Play, senza dati personali nel codice**: i nomi delle case non sono piÃ¹ nel codice (erano due nomi di localitÃ ). Le case ora sono **Â«Casa 1Â» e Â«Casa 2Â»** e il loro nome si sceglie in **Impostazioni â†’ Bollette**: Ã¨ anche il nome della cartella dei documenti (es. `Casa 1/2026/Luce 2026.03.pdf`; vale anche `casa1`/`casa2`).
  Il caricamento dei documenti, la tabella e il widget usano i nomi scelti. **Chi aveva le vecchie cartelle**: con l'app ferma, `node scripts/rinomina-casa.mjs casa2 <nome-della-vecchia-cartella>` (e lo stesso per `casa1`) dÃ  il nome alla casa e rinomina le spunte Â«pagatoÂ» giÃ  salvate.
- **App Android con indirizzo del server a scelta**: `npm run apk -- --generico` costruisce un APK senza il tuo indirizzo incorporato; alla prima apertura l'app chiede l'indirizzo https del server e controlla che risponda. In Impostazioni compare Â«Server â†’ Cambia serverÂ». L'APK normale (`npm run apk:installa`) resta com'era.
- **Build dell'APK**: su Windows lo script trova l'SDK anche in `%LOCALAPPDATA%\Android\Sdk` (Android Studio); documentazione corretta.
- Test e commenti con nomi neutri (tolto anche un riferimento personale nei commenti).

## 0.51.1
- **Documentazione**: corrette le istruzioni per costruire e installare l'APK (su Windows l'SDK si trova da solo in `~/Android/Sdk`, cioÃ¨ `C:\Users\<nome>\Android\Sdk`: `ANDROID_HOME` serve solo se Ã¨ altrove; nel README il percorso era scritto male), spiegato come ritrovare il telefono in debug wireless con `adb mdns services`, e rimesso in ordine il changelog (0.44.0 era sopra la 0.46.0).

## 0.51.0
- **Tolto il widget Â«Questo meseÂ» (5Ã—1)**: resta Â«Questo mese 2Â» (5Ã—2) come unico widget del mese. Chi aveva il vecchio lo vede sparire dalla Home e puÃ² aggiungere Â«Questo mese 2Â» dall'elenco dei widget. Con il widget sono state tolte le sue risorse (layout, scheda, anteprima, sfondi rossi e verdi, liquido arancione) e il codice che serviva solo a lui; il generatore dei layout (`scripts/genera-widget.mjs`) ora produce solo Â«Questo mese 2Â» e il suo layout Ã¨ rimasto identico.
- **Widget Â«SaldoÂ» ristretto da 4Ã—1 a 3Ã—1 e nello stile di Â«Questo mese 2Â»**: due riquadri affiancati, **Â«Saldo RevolutÂ»** (saldo e da quando sono i dati) e **Â«UltimoÂ»** (importo e nome dell'ultimo movimento), con teal, riquadri bianchi trasparenti, etichette da 12 sp e cifre da 16,5 sp in grassetto. Niente piÃ¹ verde per le entrate: l'unico colore d'allarme resta l'ambra, e qui non serve. Un Â«SaldoÂ» giÃ  sulla Home resta largo quattro colonne finchÃ© non lo restringi.

## 0.50.0
- **Â«Questo mese 2Â», titoli senza Â«restaÂ»**: i riquadri si chiamano Â«SpeseÂ», Â«SvagoÂ» e Â«CarburanteÂ». La cifra Ã¨ sempre il residuo del budget. Gli altri widget non cambiano.
- **Stessa dimensione e stile per tutte le etichette**: Â«Da pagareÂ», Â«SpeseÂ», Â«SvagoÂ», Â«CarburanteÂ», Â«mancano 25 gÂ» e Â«banca 12:05Â» sono tutte da 12 sp, non in grassetto; anche le quattro cifre hanno la stessa misura (16,5 sp, grassetto).
- **Palette coerente**: prima i riquadri avevano rosso, verde chiaro, arancione, rosso e verde per la stima e vari teal. Ora c'Ã¨ il teal dell'app come sfondo, riquadri bianchi trasparenti tutti uguali (compresa la barra del mese e la riga della banca) e **un solo colore d'allarme, l'ambra**: Â«Da pagareÂ» quando resta qualcosa, il liquido oltre l'80% del budget, la Â«realeÂ» peggiore della stima (la migliore Ã¨ bianca). Tutto pagato: Â«Da pagareÂ» Ã¨ neutro come gli altri.
- **Barra del mese e riga della banca alte la metÃ **: la colonna di sinistra si divide ora 4 : 1 : 1 (prima 1 : 1 : 1).

## 0.49.0
- **Barra del mese di Â«Questo mese 2Â» con i divisori sulle domeniche**: i blocchi sono le settimane vere (da lunedÃ¬ a domenica) e il divisore cade alla fine di ogni domenica, tranne a fine mese. La barra Ã¨ larga in proporzione ai giorni, quindi i blocchi sono da quattro a sei e il primo e l'ultimo possono essere piÃ¹ corti (ottobre 2026: divisori dopo il 4, l'11, il 18 e il 25). Il calcolo Ã¨ provato da un test sui mesi difficili (che cominciano di domenica, che finiscono di domenica, bisestile).
- **Colonna di sinistra in tre parti uguali**: cose da pagare, barra del mese e riga della banca hanno ora la stessa altezza (prima 3 : 1,2 : 1). La riga della banca resta in basso.

## 0.48.0
- **Â«Questo mese 2Â» ripensato per una griglia 5Ã—2** (alto il doppio): il widget si propone ora con cinque colonne e due righe. Gli **spazi** sono sistemati: bordo esterno di 8 dp **uguale su tutti i lati** (prima a destra era piÃ¹ largo) e **6 dp fra tutti i riquadri** e fra le tre parti della colonna di sinistra; piÃ¹ aria sopra la cifra e sopra Â«stima/realeÂ», e nella pastiglia.
- Le tre parti della colonna di sinistra si **dividono l'altezza in proporzione** (cose da pagare 3, barra del mese 1,2, banca 1) con un minimo per barra e banca, cosÃ¬ reggono anche a una riga sola. Il **liquido del budget** ha ora una forma alta come il riquadro, e l'anteprima nella lista dei widget Ã¨ piÃ¹ alta.
- Un Â«Questo mese 2Â» giÃ  sulla Home resta alto una riga: va allungato (o tolto e rimesso). Â«Questo meseÂ» e il suo layout restano invariati.

## 0.47.0
- **Â«Questo mese 2Â», colonna Â«Da pagareÂ» divisa in tre parti**, una sopra l'altra: le **cose da pagare** (rosso, o verde chiaro se Ã¨ tutto pagato), la **barra del mese** e **l'ultimo aggiornamento della banca** (sparisce se non c'Ã¨ nessuna banca collegata).
- **Barra del mese a quattro blocchi**, uno per settimana (giorni 1â€“7, 8â€“14, 15â€“21 e il resto del mese), che si riempiono con i giorni passati; il testo **Â«mancano 25 gÂ»** (o Â«ultimo giornoÂ») ora Ã¨ scritto **dentro la barra**. La barra ha un fondo suo (teal scuro e teal) e non cambia piÃ¹ colore con lo stato del Â«Da pagareÂ».
- Il calcolo dei blocchi Ã¨ in una classe a parte (`MonthWeeks`) provata da un test; il layout si rigenera con `node scripts/genera-widget.mjs`. Â«Questo meseÂ» resta invariato.

## 0.46.0
- **Â«Questo mese 2Â», blocco Â«Da pagareÂ»**: sotto la cifra c'Ã¨ ora una **barra del mese** (i giorni passati, oggi compreso, sul totale) con scritto **Â«mancano 25 gÂ»** (o Â«ultimo giornoÂ»), per sapere a colpo d'occhio quanto manca alla fine del mese; e, sotto, **l'ultimo aggiornamento dalle banche collegate** (Â«banca 12:05Â» se Ã¨ di oggi, Â«banca 4 ott 17:00Â» altrimenti; nulla se non c'Ã¨ nessuna banca collegata). Tutto bianco sul rosso, verde scuro quando Ã¨ tutto pagato.
- Il widget Â«Questo meseÂ» originale resta com'Ã¨.

## 0.45.0
- **Widget Â«Questo meseÂ» e Â«Questo mese 2Â»**: Spese, Carburante e Svago mostrano il **residuo del budget** (budget meno speso, negativo se superato) e il titolo diventa Â«Spese restaÂ»; senza budget impostato restano la spesa del mese e il titolo di prima.
- **Widget, onda dei budget**: il liquido ora Ã¨ il **residuo** e **scende** man mano che spendi (prima saliva con la spesa): pieno a spesa zero, vuoto a budget finito o superato; arancione quando resta il 20% o meno.

## 0.44.0
- **Nuovo widget Â«Questo mese 2Â»** (Android, 5Ã—1), copia di Â«Questo meseÂ»: senza Â«dal 1Â° OTTÂ», con Â«Da pagareÂ» e i tre riquadri di spesa **della stessa larghezza**, in ordine **Spese, Svago, Carburante**. In ogni riquadro la **stima** e, sotto, la **spesa reale** al giorno, in formato `stima â‚¬9,40` / `reale â‚¬12,35` (valuta davanti, centesimi sempre per intero), insieme in un solo sfondo tondo in teal scuro della palette; il reale Ã¨ verde se Ã¨ pari o migliore della stima, rosso (piÃ¹ chiaro, per leggersi) se peggiore.
- Â«Questo meseÂ» resta invariato. Il layout si genera con `node scripts/genera-widget.mjs` (modalitÃ  `stacked`).

## 0.43.0
- **Panoramica**: linee di separazione della griglia piÃ¹ leggere (1px, colore tenue).
- **Estetica omologata**: un solo sistema di regole per tutta l'app (testi 12/13/14/16/20/24, colori `--ink`/`--muted`/accento, angoli 8/10/14, pulsanti e campi della stessa altezza, primario/secondario/selezionato/link uguali in ogni scheda, Impostazioni e login). Descritto in README, Â«Regole di stileÂ».
- **Widget**: invariato, resta lo stile turchese di prima.

## 0.42.0
- **Movimenti**: ogni transazione Ã¨ ora una riga a sÃ©, anche per gli enti ripetuti. Nel filtro c'Ã¨ il checkbox **Unisci le transazioni ripetute** per accorparle di nuovo in una riga Â«Ã—nÂ» (la scelta si ricorda).

## 0.41.1
- **Banche**: correzione dell'errore Â«Cannot read properties of undefined (reading join)Â» con un server non ancora aggiornato.

## 0.41.0
- **Aggiornamento automatico delle banche tre volte al giorno**: alle 5, alle 12 e alle 17 (ora italiana). Restano sotto il tetto di 4 accessi automatici al giorno; `BILANCIO_AUTO_READ_HOUR` accetta un elenco di ore (es. `5,12,17`). La scheda Banche mostra tutti gli orari (e funziona anche con un server non ancora aggiornato).

## 0.40.4
- **Banche, pagamenti in sospeso**: accanto a ogni pagamento in sospeso un'etichetta dice se Ã¨ giÃ  nei dati dell'app e se conta nelle somme: Â«contato Â· SpesaÂ», Â«non contato Â· AltroÂ» (Ã¨ in Movimenti ma la categoria non conta: cambiala lÃ¬), Â«non ancora nell'appÂ» (premi Aggiorna) o Â«non leggibileÂ». Serve a capire subito perchÃ© un sospeso non compare nelle spese o nel widget.
- **Versione in alto**: tolto Â«localeÂ».
- **Regole di progetto**: commit e push solo quando l'utente li chiede; a ogni modifica restano versione, changelog, test e installazione dell'APK (CLAUDE.md, README).

## 0.40.3
- **Panoramica**: la colonna dei mesi (titolo, nomi dei mesi e righe di media e da pagare) ha lo stesso colore leggero dei titoli Entrate, Uscite e Bilancio.

## 0.40.2
- **Panoramica**: tutte le celle della tabella sono scure come lo sfondo; solo i titoli Entrate, Uscite e Bilancio sono leggermente colorati.

## 0.40.1
- **Movimenti in sospeso, date e verso**: la data Ã¨ la prima valida fra registrazione, valuta e operazione (una data vuota non nasconde piÃ¹ le altre); senza indicatore entrata/uscita si guarda il segno dell'importo. In Movimenti la riga sopra l'elenco dice quanti sono in sospeso e giÃ  contati.
- **Panoramica**: celle normali nel colore base dell'app; Entrate, Uscite e Bilancio colorate.
- **Impostazioni**: stessa estetica del resto dell'app (fondo base, sezioni come riquadri, campi e intestazione come altrove).

## 0.40.0
- **Aggiornamento automatico delle banche ogni giorno alle 5** (ora italiana), da tutte le banche collegate; l'esito Ã¨ in cima alla scheda Banche. Gli altri aggiornamenti si fanno a mano con **Aggiorna**.
- **Pagamenti in sospeso senza data** (come li dÃ  a volte la banca) venivano scartati: ora contano dal giorno in cui si leggono, e nella scheda Banche stanno in cima all'elenco.
- **Movimenti**: Â«Ã—nÂ» a sinistra del nome, importo allineato a destra in colonna, categoria piÃ¹ compatta; i movimenti ancora in sospeso hanno una linea arancione sul bordo sinistro del riquadro.
- **Banche**: Â«Leggi dalla bancaÂ» diventa **Aggiorna** e va a destra; la riga della banca ha un bordo che mostra dove si clicca.
- **Panoramica**: entrate medie verdi, uscite medie rosse, bilancio medio verde o rosso; piÃ¹ distanza tra le schede e la riga dell'anno anche sul telefono (una regola la azzerava).
- **Budget**: entrate verdi, spese fisse rosse, risparmio verde; i due blocchi in alto hanno una linea tra i valori e una sotto i valori, prima della descrizione.
- **Impostazioni**: tolta la sezione Â«Riconoscimento automaticoÂ» (il riconoscimento continua a lavorare); la sezione Documenti Ã¨ colorata.

## 0.39.0
- **I dati della banca sono i dati dell'app**: Â«Leggi dalla bancaÂ» e Â«Aggiorna oraÂ» fanno la stessa cosa, una sola lettura nel limite giornaliero: aggiornano saldi e movimenti della scheda Banche e portano gli stessi movimenti (registrati e in sospeso) in Panoramica, Movimenti e Statistiche. Nuova `readAndMerge`.
- **Niente doppioni tra estratto conto e banca**: un movimento visto da entrambi (stesso importo, stessa data o un giorno di scarto, abbinati uno a uno) si conta una volta, vince la banca; la categoria scelta a mano passa al movimento della banca; un estratto riletto non fa ricomparire il doppione. Nuovo `src/reconcile.js`.
- **Estratti conto**: tolto l'indirizzo dalle Impostazioni; con una banca collegata, all'avvio il server lo toglie una volta sola (resta in `settings.statementsSourceOld`). I piÃ¹ vecchi si caricano a mano da Documenti.
- **Movimenti**: ogni movimento Ã¨ un riquadro â€” in alto data, importo e categoria a destra; sotto la descrizione â€” e il dettaglio aperto sta dentro lo stesso riquadro con la stessa estetica. Anno, mese, categoria, ricerca e Â«Ordina perÂ» sono dietro un solo pulsante **Filtra**, col numero dei filtri attivi.
- **Banche**: tutto il blocco di ogni banca Ã¨ collassabile; la sezione dei movimenti non lo Ã¨ piÃ¹ e ha il suo pulsante **Filtra**; tolti i grafici dei conti (nei conti aperti restano IBAN, numero di movimenti nel periodo e Rinomina); tolta la frase sulla copia separata.
- **Panoramica**: piÃ¹ spazio tra la riga dell'anno, le schede e i blocchi sotto.

## 0.38.1
- Documentazione e changelog della 0.38.0 (erano rimasti fuori dal rilascio).

## 0.38.0
- **Pagamenti in sospeso**: Â«Aggiorna oraÂ» porta in Movimenti anche i movimenti in sospeso (etichetta Â«in sospesoÂ»), che contano subito nelle somme di Panoramica. A ogni lettura i sospesi di prima si tolgono e si rimettono quelli di adesso: un pagamento rifiutato sparisce da solo, uno registrato dalla banca ricompare come registrato, senza doppioni. Se la banca non dÃ  i sospesi si tengono quelli di prima.
- **Saldo con i sospesi**: nella scheda Banche e nel widget Â«SaldoÂ» il totale Ã¨ il saldo contabile piÃ¹ i pagamenti in sospeso (Â«di cui in sospesoÂ»); se la banca dÃ  solo saldi Â«disponibiliÂ» si usa quello com'Ã¨.
- **Scheda Banche semplificata**: ogni conto e pocket Ã¨ una finestra chiusa (nome e saldo) che aperta mostra IBAN, numero di movimenti nel periodo e grafico, piÃ¹ Rinomina. Tolti: descrizioni sotto il grafico, saldi e dati aggiuntivi, tipo e prodotto, note sulla fonte del nome. Tolte le sezioni Â«Quali campi fornisce la bancaÂ», Â«Principali interlocutoriÂ» in uscita e in entrata e Â«Pagamenti ricorrentiÂ» (anche dal server). Nuovi test (92 in tutto).

## 0.37.0
- **Bollette divise in due**: acqua, luce, gas e wifi contano per la **tua quota** (Impostazioni â†’ Bollette, di norma 50%) nelle uscite, nel Â«Da pagareÂ», nel widget, nella notifica del primo del mese e nel budget. I PDF restano interi; l'affitto non Ã¨ diviso. Nuovo `billShare` nelle impostazioni.
- **Letture a mano fino a 10 al giorno** per banca (prima 4). Le letture a mano inviano alla banca le intestazioni Â«PSUÂ» (l'utente Ã¨ presente) e, se la banca le rifiuta, riprovano senza; non Ã¨ garantito che ogni banca accetti piÃ¹ di 4 letture: se rifiuta, l'errore si vede nell'app.
- **Widget**: tolti Â«Da pagareÂ» e Â«Questo meseÂ» semplice. Resta Â«Questo meseÂ» (quello completo, 5Ã—1) e il widget Revolut si chiama Â«SaldoÂ».

## 0.36.0
- **Widget Â«Questo mese (stime al giorno)Â»** ora 5Ã—1, con testi piÃ¹ grandi e una riga sola `stimaâ†’reale/g` per voce (la reale verde o rossa).
- **Nuovo widget Â«RevolutÂ»** (4Ã—1): saldo totale in euro e ultimo movimento dall'ultima lettura, con l'ora; non in tempo reale e non chiama mai la banca. Nuovo `GET /api/banking/widget`.
- **Anteprime dei widget** nella lista: anteprima statica con dati di esempio per tutti (`previewLayout`) e, da Android 15, anteprima con i dati veri.
- **Revolut, movimenti persi**: due pagamenti identici nello stesso giorno, quando la banca non dÃ  un identificativo, diventavano un solo movimento; ora restano due (gli identificativi giÃ  salvati non cambiano).
- Documentazione: perchÃ© si puÃ² non vedere un movimento Revolut e che il limite di 4 letture vale per gli accessi senza l'utente presente (PSD2).

## 0.35.4
- **Documentazione**: struttura del progetto aggiornata (`budget.js`, `genera-widget.mjs`, widget Android) e come regolare velocitÃ , ampiezza e numero di onde del widget.

## 0.35.3
- **Widget**: l'ampiezza dell'onda Ã¨ dimezzata (superficie piÃ¹ piatta, ondina appena accennata).

## 0.35.2
- **Widget**: l'onda scorre ancora a metÃ  velocitÃ  (un giro in 4,6 s). I fotogrammi salgono a 16 e diventano piÃ¹ piccoli (56Ã—40 px) per tenere leggero l'aggiornamento del widget.

## 0.35.1
- **Widget**: l'onda del liquido scorre a metÃ  velocitÃ  (un giro in 2,3 s invece di 1,1 s); i fotogrammi salgono da 8 a 12 per non farla andare a scatti.

## 0.35.0
- **Widget Â«Questo meseÂ»**: la superficie del liquido Ã¨ ora un'**onda sinusoidale che scorre verso destra** (8 fotogrammi alternati da un ViewFlipper). Le onde sono solo nel widget: tolte dalla scheda Budget.
- **Nuovo widget Â«Questo mese (stime al giorno)Â»** (5Ã—2), copia del precedente: in spesa, carburante e svago aggiunge la spesa stimata al giorno (budget Ã· giorni del mese) e quella reale (speso Ã· giorni passati), verde se migliore della stima e rossa se peggiore. Il layout dei due widget si genera con `scripts/genera-widget.mjs`.
- **Budget**: Â«Speso questo meseÂ» torna a una barra che si riempie **da destra verso sinistra**. Medie, spese fisse, entrate e spese del mese si calcolano ora **nell'app dai dati della Panoramica** (`/api/grid`), non piÃ¹ dalla stima del server: coincidono con le cifre che vedi altrove e funzionano con qualunque versione del server (con un server non aggiornato le barre restavano vuote e la nota usava ancora 6 mesi).

## 0.34.3
- **Budget**: tolta la frase Â«Rientri nelle entrate medieâ€¦Â»; numeri della tabella piÃ¹ grandi del 15%; piÃ¹ spazio tra Â«MediaÂ» e Â«Speso questo meseÂ»; tolto il bordo evidenziato dal riquadro del budget. Â«Speso questo meseÂ» Ã¨ ora un contenitore che si riempie dal basso, come i riquadri del widget (con la superficie che ondeggia appena).
- **Budget, nota sotto la tabella**: corretta quando le spese abituali superano le entrate. Mostrava Â«risparmi 1.360 â‚¬Â» senza il segno meno; ora dice Â«sfori di 1.360 â‚¬ al meseÂ» e riporta entrate, spese fisse e spese abituali da cui parte il calcolo. Le medie sono sugli ultimi 3 mesi chiusi: se la nota parla ancora di 6 mesi, il server non Ã¨ stato aggiornato (la media si calcola sul server).

## 0.34.2
- **Budget**: la colonna Â«Di solitoÂ» diventa Â«MediaÂ» e si calcola sugli **ultimi 3 mesi chiusi** (prima 6). In alto due riquadri soli: entrate e spese fisse medie in una riga, budget e risparmio nell'altra. La tabella dei budget torna in colonne anche sul telefono (niente blocchetti), sempre nella larghezza dello schermo e senza scorrimento. Sul telefono le cinque schede ora entrano senza tagliare il testo.
- **Widget**: corretta la logica di riempimento. Le tre celle risultavano piene allo stesso modo; ora ogni cella ha la propria altezza, calcolata sulla sua spesa rispetto al suo budget (immagine con il liquido sopra uno sfondo tondo che ne ritaglia i bordi, senza piÃ¹ livelli del disegno).

## 0.34.1
- **Budget, barre a liquido**: la barra di ogni voce (speso nel mese su budget) ha onde che scorrono dentro il liquido e un bordo che ondeggia appena (si ferma con Â«riduci animazioniÂ»). Solo nell'app: il widget Android non puÃ² animarsi.
- **Budget, tabella compatta**: piÃ¹ bassa e senza Â«al meseÂ» nel titolo; sta sempre nella larghezza dello schermo, senza scorrimento. Sul telefono ogni voce diventa un blocchetto (nome e budget, Â«Di solitoÂ», barra).

## 0.34.0
- **Budget: il risparmio Ã¨ un risultato**, non si imposta piÃ¹: entrate medie (ultimi 3 mesi) âˆ’ spese fisse medie âˆ’ totale dei budget. Una barra a colori divide l'entrata media tra spese fisse, Spesa, Svago, Carburante e risparmio (con un segno se si superano le entrate); per ogni voce una barra si riempie con quanto speso nel mese rispetto al budget. Â«Usa i consigliÂ» diventa Â«Parti dalle medieÂ». `/api/budget` restituisce anche le spese del mese (`spent`).
- **Widget Â«Questo meseÂ»**: i riquadri Spese, Carburante e Svago hanno ora gli stessi angoli tondi di Â«Da pagareÂ» (sono disegni con angoli da 14dp che si riempiono dal basso, non piÃ¹ immagini stirate); Â«dal 1Â° OTTÂ» ha un leggero sfondo che dice che si tocca e il mese Ã¨ a tre lettere.
- **Regola di progetto**: a ogni modifica dell'app si installa anche l'APK sul telefono (`npm run apk:installa`); scritto in `CLAUDE.md` e nel README.

## 0.33.1
- **Widget Â«Questo meseÂ»**: il riquadro Â«dal 1Â° ottobreÂ» Ã¨ largo la metÃ , il rosso di Â«Da pagareÂ» Ã¨ un po' meno intenso (#E3574D) e i riquadri Spese, Carburante e Svago hanno gli stessi angoli tondi di Â«Da pagareÂ» (il disegno ora segue le proporzioni reali del riquadro, prima veniva stirato).

## 0.33.0
- **Scheda Budget** (quinta scheda, non piÃ¹ nelle Impostazioni): budget di Spesa, Svago e Carburante e risparmio voluto, con le **entrate medie mensili** sempre in vista e il **totale dei budget** che si aggiorna a ogni cifra scritta, con l'esito Â«rientri / non rientri nelle entrate medieÂ». Il budget si salva da solo.
- **Entrate medie sugli ultimi 3 mesi** chiusi con entrate (prima seguivano i mesi usati per le spese). Le spese correnti restano sulla media degli ultimi 6 mesi chiusi.
- **Widget Â«Questo meseÂ»**: Â«dal 1Â° ottobreÂ» piÃ¹ grande, a sinistra di Â«Da pagareÂ», e un tocco apre la scheda Budget. Spese, Carburante e Svago sono **contenitori che si riempiono dal basso** su tutta la cella (bianco, arancione da 80%, rosso oltre il budget).

## 0.32.0
- **Budget di spesa** (Impostazioni â†’ Budget di spesa): budget mensile per Spesa, Svago e Carburante e risparmio mensile voluto. L'app stima le tre voci dalla media degli ultimi mesi chiusi e consiglia i budget per arrivare al risparmio (entrate medie âˆ’ spese fisse âˆ’ risparmio, tagli in proporzione). `GET`/`PUT /api/budget`; i budget viaggiano anche in `/api/grid`.
- **Widget Â«Questo meseÂ»**: titolo in alto, testo piÃ¹ grande del 10%, barra del budget in Spese, Carburante e Svago (bianca, gialla da 80%, rossa oltre), Â«Da pagareÂ» rosso pieno quando resta qualcosa. Ogni riquadro apre l'app: Spese, Carburante e Svago i Movimenti del mese giÃ  filtrati per categoria, Â«Da pagareÂ» la Panoramica.
- **Giroconti fuori dai conti**: non compaiono piÃ¹ nell'elenco Movimenti nÃ© in Statistiche; stanno in una sezione apposta in fondo a Movimenti e non entrano in nessun totale. Le coppie uscita/entrata che sono lo stesso giro tra conti o pocket (stesso importo, entro 3 giorni, conti diversi, una sola abbinabile, almeno un lato che sembra un trasferimento) diventano giroconti tutte e due; le scelte a mano non si toccano. I movimenti dalle banche ora ricordano il conto (`account`).
- **Movimenti piÃ¹ semplici**: ogni riga mostra nome, data (senza giorno della settimana), importo e categoria; i pagamenti ripetuti hanno Â«Ã—nÂ»; il resto dei dati si vede aprendo la riga.
- **Documenti nelle Impostazioni**: la scheda Documenti non c'Ã¨ piÃ¹, la sezione sta in Impostazioni â†’ Documenti (un numero sull'ingranaggio segnala i file da controllare). Le quattro schede rimaste hanno tutte la stessa larghezza.
- Android: `launchMode` singleTask e apertura sulla pagina giusta dai tocchi sul widget. Nuovi test (84 in tutto).

## 0.31.0
- **Scheda Banche, un blocco per conto e per pocket**: saldo attuale in grande, nome, IBAN, valuta, tipo, prodotto, numero di movimenti, grafico dell'andamento e, a scomparsa, tutti i saldi e i dati del conto. Niente piÃ¹ schede separate per i grafici. I blocchi sono divisi in Â«ContiÂ» e Â«Pocket e risparmiÂ».
- **Nomi dei pocket**: la banca dÃ  a ogni pocket solo il nome dell'intestatario. L'app ricava il nome vero dal testo dei movimenti (Â«Accredita EUR 01 Spesa da EURÂ») e con **Rinomina** lo scrivi tu (`PUT /api/banking/account-name`, resta sul server). Il nome compare nel blocco, nel filtro per conto e in ogni riga di movimento.
- **Storico che si accumula**: ogni lettura tiene i movimenti giÃ  letti e aggiunge i nuovi (prima la copia veniva sostituita e i giorni piÃ¹ vecchi sparivano). Se la banca non concede 12 mesi, sotto il conto compare il motivo del rifiuto e che si ripiega sugli ultimi 90 giorni.
- **Scheda Banche anche sul telefono e nell'app Android**: ogni movimento Ã¨ un riquadro (data, stato, conto, interlocutore, causale, importo), le tabelle tecniche partono chiuse e si mostrano 50 movimenti alla volta.
- **Le banche si leggono solo col pulsante**: **Aggiorna** e l'apertura dell'app non chiamano piÃ¹ UniCredit nÃ© Revolut. Restano **Aggiorna ora** (Impostazioni â†’ Collega le banche), **Leggi dalla banca** (scheda Banche) e la lettura subito dopo aver collegato una banca. Rimossa `syncAll`; un test con una banca finta verifica che l'aggiornamento non la tocchi.
- **Android: widget Â«Questo meseÂ»** (5Ã—1): quattro riquadri affiancati con le cifre dal primo del mese â€” Da pagare (rosso finchÃ© resta qualcosa, verde quando Ã¨ tutto pagato, con il numero di voci), Spese, Carburante e Svago. Si aggiorna ogni mezz'ora, all'apertura dell'app e quando cambiano categorie, importi, spunte o letture.
- Demo e banca finta: due pocket Revolut senza IBAN, con il nome dell'intestatario e il nome vero solo nei movimenti. Nuovi test (73 in tutto).
- Test piÃ¹ stabili: i test che avviano un server vero scelgono una porta libera dal sistema invece di una a caso (due test potevano scegliere la stessa porta e fallire ogni tanto).
- Un esempio nel codice e in un test usava il nome di un'azienda vera: sostituito con un nome inventato.
- Documentazione: aggiornate le sezioni Banche e App Android e i Â«Prossimi passiÂ» (fasi 1 e 3 fatte).

## 0.30.1
- **Documentazione**: la scheda Banche richiede che anche il server sia aggiornato (dalla 0.30.0); la demo va tenuta in un terminale aperto; dopo un push bisogna attendere la costruzione dell'immagine Docker prima di aggiornare il NAS; come provare la scheda con i dati veri.

## 0.30.0
- **Scheda Â«BancheÂ»** (solo schermo largo; prima fase del piano Â«Interfaccia sui dati delle banche collegateÂ»): i dati originali di UniCredit e Revolut â€” conti con IBAN, tipo e saldi, andamento del saldo, quali campi la banca fornisce e in quanti movimenti, principali interlocutori, pagamenti ricorrenti, movimenti registrati e in sospeso con il record originale. **Copia separata**: si aggiorna solo con Â«Leggi dalla bancaÂ» (conta come una delle 4 letture giornaliere) e non entra in Panoramica, Movimenti nÃ© Statistiche.
- `ENABLE_BANKING_API` cambia l'indirizzo dell'API, e `scripts/banca-finta.mjs` simula due banche per provare l'app senza toccare quelle vere. **`npm run demo:banche`** avvia banca finta e app di prova (porta 4871, password `demo-banche`, dati inventati) per provare la scheda Banche anche quando il server non Ã¨ aggiornato.
- **Widget Â«Da pagareÂ»** ridotto a un blocchetto: scritta e totale ancora da pagare.
- **Promemoria personalizzati** (Impostazioni â†’ Promemoria, solo app Android): cosa controllare e ricorrenza (ogni giorno, settimana, mese o anno) con l'ora; si possono attivare, modificare ed eliminare. Calcolo delle ricorrenze collaudato (giorno 31 nei mesi corti, anni bisestili).
- **Icona di notifica** con il logo dell'app in una tinta sola e il turchese dell'app.
- Documentazione: aggiunta la sezione Â«Prossimi passiÂ» con il piano per l'interfaccia sui dati delle banche collegate.

## 0.29.1
- **Impostazioni a pagina**: freccia Â«indietroÂ» in alto al posto di Â«AnnullaÂ» (chiede conferma se ci sono modifiche non salvate); **Â«Salva le modificheÂ» compare solo se qualcosa Ã¨ cambiato**. Il tasto indietro di Android chiude il pannello aperto invece di uscire dall'app.
- **Aggiorna** si sposta nella scheda **Documenti**, accanto a Â«Carica documentoÂ».
- L'identificativo dell'app Android diventa `app.bilancio.mobile` (neutro): chi ha giÃ  installato la versione precedente trova due app, puÃ² rimuovere la vecchia.

## 0.29.0
- **App Android** (cartella `android/`, `npm run apk`): una vera app che contiene le pagine di `public/` e inoltra dati e login al server; installabile con `npm run apk:installa`. Include il **widget Â«Da pagareÂ»** (2Ã—1 di base, totale e prime voci), la **notifica del primo del mese** per i conti in sospeso, il **feedback aptico** sui tocchi e l'apertura dei PDF.
- **Carica documento** (scheda Documenti): scegli file, nome e tipo (estratto conto CSV/PDF, bolletta con utenza e casa, busta paga). I PDF si leggono con importo e mese e restano sul server (`data/uploads`).
- **Movimenti**: un solo elenco, con i pagamenti allo stesso ente accorpati in una riga che si apre sui singoli; ricerca, filtro per categoria e ordinamento (prezzo, quantitÃ  di transazioni, nome, categoria, data). Lo stipendio Ã¨ una voce sola.
- **Statistiche**: in cima i riquadri per categoria (spesa, svago, carburanteâ€¦); un tocco apre i movimenti di quella categoria.
- **Panoramica**: un tocco su Entrate, Uscite, Bilancio o sul mese apre Movimenti filtrati su quel mese; colonna Mese ben distinta, Entrate e Uscite con lo stesso colore, linee tra le colonne, tab piÃ¹ evidenti, tre targhette affiancate; su telefono tabella compatta (Mese, Entrate, Uscite, Bilancio).
- **Banche collegate** (Impostazioni): UniCredit e Revolut direttamente dalla banca, in sola lettura, con Enable Banking (gratuito per uso personale). Limite di 4 letture al giorno, consenso fino a 180 giorni, movimenti giÃ  importati da file non duplicati.
- **Riconoscimento automatico** di chi ti paga lo stipendio e del tuo nome (da buste paga e movimenti): la sezione manuale delle Impostazioni non serve piÃ¹. Impostazioni a sezioni richiudibili.
- Messaggio chiaro quando il server Ã¨ piÃ¹ vecchio dell'app (Â«va aggiornatoÂ»).

## 0.28.0
- **Telefono: tabella a colonne** (Mese, Entrate, Uscite, Bilancio), una riga per mese, al posto delle schede.
- **Intestazione piÃ¹ stretta sul telefono**: senza logo e nome, con la versione sulla stessa riga di Aggiorna e Impostazioni.
- **Â«EsciÂ» nelle impostazioni** (sezione Account); sul telefono non compare piÃ¹ in alto.
- **Finestre sopra a tutto**: Impostazioni e le altre finestre occupano lo schermo del telefono, scorrono da sole e la pagina sotto resta ferma.
- **Panoramica**: Entrate medie, Uscite medie e Bilancio medio affiancate su una riga; tolti l'anno e Â«al meseÂ» dalle etichette.

## 0.27.0
- **Telefono: solo la vista compatta** (Mese, Entrate, Uscite, Bilancio). Su schermo largo tutte le voci (bollette, Casa 2, affitto, prestitoâ€¦) sono sempre aperte; tolti i pulsanti per aprire e chiudere.
- **Grafici adattati al telefono**: il grafico rientra nello schermo, senza scorrimento a destra, e si ridisegna se ruoti il telefono.
- **App installabile (PWA)**: manifest, icone e meta per aggiungere Bilancio alla schermata Home di Android e iPhone, a schermo intero. Le icone si rigenerano con `scripts/genera-icone.mjs`.

## 0.26.1
- **Documentazione aggiornata**: il README descrive ora le schede (Panoramica, Movimenti, Statistiche, Documenti), la tabella compatta, la vista per telefono, le impostazioni, la lettura delle scansioni con OCR, la scansione automatica all'apertura e la struttura del codice per chi sviluppa.

## 0.26.0
- **Tabella principale compatta**: solo Mese, Entrate, Uscite e Bilancio (prima "Saldo"). Le Uscite si aprono con un clic nelle loro voci (bollette, affitto, prestito, spesa, svago, carburante, donazioni, tasse) e le Bollette, a loro volta, in quelle di ogni casa. Nella vista chiusa, sotto le uscite del mese compare quante voci restano da pagare.
- **Celle pagato / da pagare ridisegnate**: riquadro arrotondato con sfondo tenue, bordo morbido e barretta laterale (verde o rossa), senza icone.
- **Anno a tendina** al posto dei pulsanti.
- **Movimenti accorpa la suddivisione delle spese**: riquadri per categoria cliccabili (filtrano i movimenti), filtri anno e mese, ricerca, e due viste: "Movimenti" e "Per descrizione" (le tabelle raggruppate della vecchia scheda Banca, ora con la media e un link "cerca").
- **PiÃ¹ informazioni su ogni pagamento**: sotto la descrizione compaiono giorno e ora, metodo (carta, bonifico, prelievoâ€¦), commissione, valuta e testo della banca. Cliccando la riga si aprono i dettagli completi: saldo dopo il pagamento, conto, categoria (automatica o scelta), file di origine, gli altri pagamenti con la stessa descrizione (quante volte, totale, media, date) e i link per cercarla su Google e su Maps. L'app ora conserva anche questi dati dall'estratto conto Revolut (orario, tipo, commissione, valuta, saldo); i movimenti giÃ  salvati si completano da soli alla prossima lettura degli estratti, senza toccare le categorie.
- **"Banca" diventa "Statistiche"** e contiene solo i grafici e la tabella mese per mese.
- Tolti la descrizione sotto il nome dell'app e il testo sotto la tabella della panoramica.
- **Casa 2 comprimibile** anche nella nuova tabella compatta: dentro Bollette, la colonna "Casa 2" si apre e si chiude (chiusa mostra un solo totale con lo stato pagato di tutte le sue voci).
- **Vista per telefono**: la tabella principale diventa un elenco di schede mensili, i filtri e le tabelle dei movimenti si adattano allo schermo stretto e i pulsanti sono piÃ¹ grandi.
- **Localhost collegato al server**: con `BILANCIO_SERVER` le pagine sono quelle di questa cartella (si vedono subito le modifiche) e solo dati e login passano dal server, che prima rispondeva anche con le pagine della sua versione. La versione mostrata Ã¨ quella locale. La documentazione dice che il localhost deve sempre puntare al server.

## 0.25.0
- **Casa 2 comprimibile** dentro Bollette: con Bollette aperta compare una colonna "Casa 2" con il suo pulsante apri/chiudi. Chiusa, mostra un solo totale (luce + gas di Casa 2, con lo stato pagato di tutte le voci insieme); aperta, mostra Luce e Gas di Casa 2 separati, ognuno con il suo documento. Le voci di Casa 2 sono ora raggruppate dopo quelle di Casa 1. Lo stato viene ricordato.

## 0.24.0
- **Tolto il "codice di configurazione"**: la prima password si crea dalla pagina di accesso con la sola password, da qualsiasi indirizzo. Va creata subito dopo l'avvio: finchÃ© non esiste, chiunque apra il sito puÃ² sceglierla.
- **Localhost che punta al server**: con `BILANCIO_SERVER` nel file `.env`, `npm start` non usa un database locale ma inoltra ogni richiesta (pagine, dati, login) al server indicato. Dati e password sono un'unica copia, quella del server. Il cookie di sessione viene adattato a http://localhost, e se il server non risponde compare un messaggio chiaro.

## 0.23.1
- La password puÃ² essere lunga anche solo **4 caratteri** (prima 10). Meglio piÃ¹ lunga se il sito Ã¨ raggiungibile da internet: il blocco dopo 5 errori rallenta i tentativi ma non sostituisce una password robusta.

## 0.23.0
- **La password si crea dall'app**: al primo accesso la pagina di accesso chiede di scegliere la password (minimo 10 caratteri, da ripetere). Viene salvata cifrata (scrypt) nel database. Da localhost basta aprire la pagina; da qualsiasi altro indirizzo serve il **codice di configurazione** scritto nel log del server all'avvio (`docker logs bilancio`), cosÃ¬ nessun estraneo puÃ² crearla al posto del proprietario. FinchÃ© la password non esiste, pagine e dati restano chiusi.
- L'app Ã¨ quindi sempre protetta. `BILANCIO_PASSWORD` resta come alternativa facoltativa (ha la precedenza). Tolto l'avviso rosso "nessuna password".
- Nuovo script `scripts/reimposta-password.mjs` per cancellare la password dimenticata (da eseguire con l'app ferma).

## 0.22.1
- `npm start` e `npm run dev` leggono un file `.env` (se c'Ã¨) e quindi la password si puÃ² impostare anche in locale: copia `.env.example` in `.env` e scrivi la password. Il file Ã¨ escluso da git.

## 0.22.0
- **Login con password**: impostando `BILANCIO_PASSWORD` tutto il sito (pagine, dati e API) richiede la password. Pagina di accesso con un solo campo, sessione di 30 giorni (cookie firmato, HttpOnly), pulsante **Esci**, blocco di 15 minuti dopo 5 tentativi sbagliati. Gli script usano HTTP Basic. Senza password l'app resta aperta, come prima, ma da un indirizzo diverso da localhost compare un avviso rosso.

## 0.21.0
- **Avviso "lettura in corso"**: se i documenti vengono letti da qualcun altro (un altro browser, lo script di importazione, un altro dispositivo), la pagina se ne accorge da sola, mostra una fascia gialla con avanzamento ("Lettura dei documenti in corso: 50 su 275. I dati sono parziali e si aggiornano da soli"), si ricarica ogni 20 secondi e avvisa quando ha finito. Il pulsante Aggiorna resta bloccato finchÃ© la lettura non termina.
- Nuovo script `scripts/importa-su-server.mjs`: sposta i dati giÃ  compilati da un database locale a un server Bilancio (es. sul NAS) usando le sue API. Copia le impostazioni, fa rileggere documenti ed estratti conto al server e riporta correzioni ai documenti, categorie scelte a mano e spunte "pagato"; alla fine confronta i totali. Rifiuta di scrivere su un server che ha giÃ  dati, salvo `--force`.

## 0.20.0
- **Installazione da GitHub con Docker Compose**: un workflow GitHub Actions prova i test, costruisce l'immagine (amd64 e arm64) e la pubblica su `ghcr.io/jstplink/bilancio` a ogni push su main e a ogni tag. `docker-compose.yml` ora scarica quell'immagine; `docker-compose.build.yml` costruisce invece dal codice su GitHub, senza registro.
- README: istruzioni per avviare, aggiornare e portare i dati sul server.

## 0.19.0
- **Niente dati personali nel codice**: il mio nome e chi mi paga lo stipendio (usati per riconoscere i giroconti e non contare due volte lo stipendio) non sono piÃ¹ scritti nel codice ma nelle **Impostazioni** ("Riconoscere i miei movimenti"), cioÃ¨ nel database, che non viene pubblicato. I test usano nomi inventati.
- Dockerfile: variabili di produzione, niente avvisi di Node sul modulo SQLite e controllo di salute del container. README: come portare sul server il database locale.

## 0.18.0
- Nuova categoria **Da suddividere**: non conta in nessun dato e ha la sua tabella nella scheda Banca. Ci finiscono in automatico gli addebiti SEPA di **PayPal** (coprono acquisti diversi) finchÃ© non vengono divisi in sotto-categorie. Spostati i 16 esistenti (1.157,06 â‚¬).

## 0.17.0
- **Abbinamento automatico addebitiâ€“bollette**: un addebito bancario di un'utenza (Enel, Edison, Reset, addebiti SEPAâ€¦) con lo stesso importo di una bolletta giÃ  letta, e data da 1 mese prima a 3 mesi dopo, passa alla nuova categoria **Bollette pagate** e non conta due volte. Nella scheda Banca la tabella mostra a quale documento Ã¨ stato abbinato. Una bolletta assorbe un solo pagamento, e le scelte fatte a mano non vengono toccate.
- Le categorie escluse dai dati (Giroconti e Bollette pagate) hanno ciascuna la propria tabella nella scheda Banca.

## 0.16.0
- **Rata del prestito dagli estratti conto**: le righe "PAGAMENTO RATA MUTUO/PRESTITOâ€¦" di UniCredit vengono riconosciute in automatico (nuova categoria **Prestito**) e alimentano la colonna Prestito della pagina principale. Niente piÃ¹ importo manuale nelle Impostazioni, e la colonna non ha piÃ¹ lo stato pagato / da pagare (Ã¨ giÃ  addebitata).
- Nel grafico bancario "Dove va il denaro" compare la voce Prestito.

## 0.15.0
- L'app si chiama **Bilancio** (titolo, intestazione, README, Docker, pacchetto). Le variabili d'ambiente diventano `BILANCIO_DATA` e `BILANCIO_DB` (le vecchie `BILANCINO_*` funzionano ancora); il file del database resta `data/bilancino.db`.
- La scheda **Banca** si apre sull'**anno corrente** invece che su tutti gli anni ("Azzera filtri" torna a questo stato).
- Nuova categoria **Giroconti**: i soldi spostati tra i miei conti non contano in nessun dato (nÃ© entrate nÃ© uscite, nÃ© tabella, nÃ© grafici, nÃ© riquadri) e stanno in una tabella a parte nella scheda Banca. Riconosciuti in automatico quando il beneficiario o l'ordinante sono io; le entrate che prima erano "Altro" (ignorate) diventano Giroconti.

## 0.14.1
- Il gruppo **Uscite** non si comprime piÃ¹: le colonne per gruppo sono sempre visibili.
- **Bollette** si apre e si chiude cliccando su tutta la cella dell'intestazione (prima c'era solo una freccina): pulsante grande, con freccia e promemoria "apri/chiudi".

## 0.14.0
- **Tabella principale riorganizzata** in quattro gruppi: Mese, **Entrate** (stipendio + altre entrate dalla banca, sommati), **Uscite** e **Riepilogo** (Totale spese e Saldo).
- **Uscite comprimibili**: â–¾ / â–¸ su "Uscite" le riduce a un solo totale; i gruppi sono Bollette, Affitto, Prestito, Spesa, Svago, Carburante, Donazioni e Tasse, e "Bollette" si apre nelle sue voci (acqua, luce e gas per casa, wifi). Da chiusa, la cella Bollette segna pagate tutte le voci insieme. Lo stato aperto/chiuso viene ricordato.
- I dati della scheda Banca (spesa, svago, carburante, donazioni, tasse, altre entrate) ora sono nella tabella principale e contano in Totale spese e Saldo. I movimenti categorizzati come "Altro" restano fuori.
- I riquadri mostrano "Entrate medie" (stipendio + altre entrate).

## 0.13.0
- **Entrate bancarie**: gli estratti conto (PDF UniCredit e Revolut, CSV) ora importano anche i soldi ricevuti, non solo le uscite. Nel grafico "Stipendio contro uscite" c'Ã¨ una seconda linea, **Altre entrate**, piÃ¹ una colonna nella tabella dei numeri e un riquadro.
- Le entrate si dividono in **Entrate** (contano) e **Altro** (ignorate): i giri tra i miei conti, PayPal istantaneo e i bonifici dal datore di lavoro (giÃ  nelle buste paga) finiscono in automatico tra le ignorate. Dalla scheda Banca si puÃ² cambiare la scelta, e l'app la ricorda.
- Revolut: corretta la lettura dei nomi su due righe, con l'importo sulla riga sotto.
- Movimenti: importi con il segno (+ entrate, âˆ’ uscite).
- Al primo avvio gli estratti conto giÃ  letti vengono riletti una volta per prendere le entrate.

## 0.12.1
- Scheda Banca: scegliendo un anno non ancora concluso i grafici mostrano comunque tutti e 12 i mesi, quelli futuri vuoti (anche nella tabella dei numeri). Con un solo anno le etichette dei mesi si vedono tutte.

## 0.12.0
- Nuova categoria **Tasse** (Agenzia delle Entrate, F24, IMU, TARI, bollo, INPS, multe, canone Rai, causali "tassa"â€¦): come Donazioni, compare nella scheda Banca e nei grafici ma non ha una colonna nella tabella principale.

## 0.11.0
- Nuova categoria **Donazioni** (Telethon, Amnesty, Greenpeace, Save the Children, WWF, Terre des Hommes, addebiti "donazione onlus"â€¦): compare nella scheda Banca, nei grafici e nel menu delle categorie, ma non ha una colonna nella tabella principale.
- I movimenti giÃ  salvati che corrispondono (50, per 908 â‚¬) sono stati spostati in Donazioni.

## 0.10.1
- I pedaggi ("autostrada", "Autostrade per l'Italia") vanno in **Svago** invece che in Carburante.

## 0.10.0
- La scheda **Analisi** diventa **Banca**, non piÃ¹ temporanea.
- Filtri per **anno** e **mese** (anche "marzo di ogni anno"); clic su una colonna dei grafici per filtrare quel mese.
- **Ordinamento** delle colonne per data, quantitÃ  e importo (clic sull'intestazione, di nuovo per invertire), nella scheda Banca e in Movimenti.
- **Grafici** (SVG, senza librerie esterne): stipendio contro uscite (bollette e affitto dai documenti, spesa/svago/carburante dalla banca), uscite bancarie per categoria mese per mese, le 10 voci piÃ¹ pesanti; tooltip al passaggio e tabella dei numeri sotto i grafici.

## 0.9.0
- **Luce e gas in due colonne** (Casa 1 e Casa 2): ognuna con il proprio documento, la propria spunta "pagato", media e totale da pagare. Acqua e wifi restano una colonna sola, con il dettaglio per casa sotto l'importo. Tolto il selettore "Bollette di", ormai superfluo.
- **Celle divise in due al passaggio del mouse**: a sinistra "Apri" il documento (con piÃ¹ documenti, una sezione per ciascuno, B/C per casa), a destra âœ“ / â†º per segnare pagato o da pagare. Da tastiera: Tab sulla cella e poi sui link.

## 0.8.1
- Bollette: l'aggiornamento salta le cartelle chiamate "documenti" (a qualsiasi livello, maiuscole indifferenti). I file giÃ  letti da lÃ¬ vengono tolti al prossimo "Aggiorna".

## 0.8.0
- **Estratti conto in PDF**: lettura dei PDF UniCredit (trimestrali) e Revolut dal link/cartella degli estratti conto. Uscite ed entrate si distinguono dalla posizione delle colonne; per UniCredit le uscite e le entrate lette vengono confrontate col riepilogo della banca e, se non tornano, l'aggiornamento lo segnala. Revolut: contano solo i pagamenti con carta (trasferimenti tra pocket, ricariche e bonifici sono esclusi).
- **Bollette per casa**: Casa 1 e Casa 2 si distinguono dalla cartella. Selettore "Bollette di: Tutte / Casa 1 / Casa 2" sopra la tabella; in "Tutte" ogni cella mostra il totale e, sotto, il dettaglio per casa. La spunta "pagato" Ã¨ per casa. Totale spese, saldo e riquadri restano sempre complessivi.
- Il riquadro **Da pagare** Ã¨ ora un pulsante: un clic (con conferma) salda tutto, di tutti gli anni e di tutte le case.
- Nuove parole chiave per le categorie (Spar, Ecu, ristoranti, giocattoli).

## 0.7.0
- Nuovo campo **Estratti conto** nelle impostazioni: link Seafile pubblico o cartella locale con i CSV della banca. "Aggiorna" legge solo i file nuovi o modificati e non duplica i movimenti.
- Nuova scheda temporanea **Analisi**: tutti i movimenti di tutti gli anni, smistati per voce con totale, numero e percentuale, e raggruppati per descrizione. Da qui si corregge la categoria di una descrizione (vale per tutte quelle uguali).
- Categorie semplificate: **Spesa** (cibo, bevande, prodotti per la casa, nella colonna Spese), **Svago** (abbonamenti TV, Amazon, parchi, televisori, giocattoli), **Carburante**, **Altro** (non conta). I movimenti giÃ  salvati come cibo/casa diventano Spesa.

## 0.6.0
- Nuove colonne **Svago** e **Carburante**, accanto a Spese; entrano nel totale spese e nel saldo.
- Nuova scheda **Movimenti**: carica l'estratto conto in CSV (Revolut o altre banche). Le uscite vengono categorizzate (cibo, casa, svago, carburante) e sommate per mese nelle colonne. Cambiando la categoria di un movimento, l'app la ricorda per quelli con la stessa descrizione.
- Tabella: "Mese" alla stessa altezza di Guadagno e Riepilogo, colonna dei mesi dello stesso colore del Riepilogo, Totale spese e Saldo allineati dentro la griglia.

## 0.5.0
- Dati in un database SQLite (`data/bilancino.db`) al posto del file JSON: chi apre il link vede sempre gli stessi dati. Il vecchio `db.json` viene importato in automatico al primo avvio.
- Aggiunti `Dockerfile` e `docker-compose.yml` per lanciare l'app sul NAS (variabili `HOST`, `PORT`, `BILANCINO_DATA`).

## 0.4.0
- Pagina piÃ¹ larga, per far stare tutte le colonne.
- Le celle sono solo lo sfondo colorato (verde pagato, rosso da pagare): tolta l'icona della spunta.
- Gli importi non si modificano piÃ¹ dalla tabella: arrivano solo dai documenti (e dalle rate fisse di affitto e prestito). Unica eccezione, provvisoria: la colonna "Spese".
- Passando il mouse su una cella compare il link al PDF originale.

## 0.3.0
- Ogni cella con un importo Ã¨ ora una casella colorata: clic = pagato (verde) / da pagare (rosso). La matita in cella apre la modifica dell'importo.
- Colonna "Spese": valore mensile inserito a mano direttamente nella cella (temporaneo, non ha stato "pagato").
- All'apertura l'app cerca documenti nuovi o modificati e, se ci sono, li analizza mostrando una targhetta con l'avanzamento.

## 0.2.0
- La versione dell'app compare accanto al nome e in `/api/version`.
- Aggiunto questo changelog.

## 0.1.0
- Prima versione: lettura di buste paga e bollette in PDF da cartella locale o link Seafile pubblico, con OCR per le scansioni.
- Panoramica annuale con spunte "pagato", medie, totale da pagare e saldo mensile.
- Colonne Stipendio, Acqua, Luce, Gas, Wifi, Affitto, Prestito, Spese; mesi da gennaio a dicembre.
- Scheda Documenti per correggere o ignorare i file letti male.
