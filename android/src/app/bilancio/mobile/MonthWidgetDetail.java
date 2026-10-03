package app.bilancio.mobile;

/**
 * Copia del widget «Questo mese» (5×2) con, in ogni riquadro di spesa, la spesa stimata al giorno (budget ÷ giorni del mese) e quella
 * reale (speso ÷ giorni passati), questa in verde se è migliore della stima e in rosso se è peggiore. Tutto il resto lo fa {@link MonthWidget}.
 */
public class MonthWidgetDetail extends MonthWidget {
    @Override boolean detailed() { return true; }
}
