package app.bilancio.mobile;

/**
 * Widget «Questo mese 2» (5×1): copia di «Questo mese» con «Da pagare» a metà larghezza (più spazio ai tre riquadri di spesa) e, in ogni
 * riquadro di spesa, la stima al giorno e sotto la spesa reale, una per riga. Tutto il resto lo fa {@link MonthWidget}.
 */
public class MonthWidgetStacked extends MonthWidget {
    @Override boolean detailed() { return true; }
    @Override boolean stacked() { return true; }
}
