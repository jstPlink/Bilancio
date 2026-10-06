package app.bilancio.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;

/**
 * Widget «Questo mese» (5×2, registrato come {@link MonthWidgetStacked}): a sinistra una colonna di tre parti (cose da pagare, barra del mese con
 * i divisori sulle domeniche, ultimo aggiornamento della banca), poi tre riquadri affiancati (Spese, Svago, Carburante), tutti dal primo del mese.
 * «Da pagare» è ambra se resta qualcosa e neutro quando è tutto pagato; spese, carburante e svago sono già pagati e, se c'è un budget, il loro
 * riquadro è un contenitore col residuo del budget, che scende in proporzione alla spesa, con la superficie ad onda sinusoidale che scorre verso
 * destra. Ogni riquadro apre l'app: «Da pagare», barra e banca sulla Panoramica, gli altri sui Movimenti del mese filtrati per la loro categoria.
 * In ogni riquadro di spesa c'è anche la spesa stimata al giorno e quella reale, una sotto l'altra.
 * Palette: teal dell'app, riquadri bianchi trasparenti e un solo colore d'allarme (ambra). Il layout si genera con scripts/genera-widget.mjs.
 */
public class MonthWidget extends AppWidgetProvider {
    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        paint(c, m, ids, Month.cached(c)); // subito l'ultimo dato noto, poi si aggiorna
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override public void run() {
                try { paint(c, m, ids, load(c)); } finally { pending.finish(); }
            }
        }).start();
    }

    /** Rilegge i dati dal server e aggiorna tutti i widget «Questo mese» presenti sulla Home. */
    static void refreshAll(final Context context) {
        final Context c = context.getApplicationContext();
        final AppWidgetManager m = AppWidgetManager.getInstance(c);
        final int[] ids = m.getAppWidgetIds(new ComponentName(c, MonthWidgetStacked.class));
        if (ids.length == 0) return;
        new Thread(new Runnable() {
            @Override public void run() { paint(c, m, ids, load(c)); }
        }).start();
    }

    private static Month load(Context c) {
        Month d = Month.fetch(c);
        if (d.ok) d.save(c);
        return d;
    }

    /** Il valore del riquadro: il residuo del budget se c'è, altrimenti la spesa del mese. */
    private static String left(double spent, double budget) { return short_(budget > 0 ? budget - spent : spent); }

    /** Importo corto, per far stare quattro cifre in una riga: 1.234 € da mille in su, con i centesimi sotto. */
    static String short_(double v) {
        if (Math.abs(v) >= 1000) return java.text.NumberFormat.getIntegerInstance(Locale.ITALY).format(Math.round(v)) + " €";
        return Due.money(v);
    }

    // ------------------------------------------------------------------ il contenitore con l'onda

    private static final int FRAMES = 16;    // fotogrammi dell'onda: lo scorrimento di un giro intero (16 × 285 ms = 4,6 s)
    // I riquadri sono molto più alti che larghi (il widget è alto due righe) e le immagini seguono la stessa proporzione, altrimenti l'onda si stirerebbe in verticale
    private static final int WAVE_W = 48;
    private static final int WAVE_H = 112;
    private static final double AMPLITUDE = 1.3;
    private static final double CRESTS = 2;   // quante onde in tutta la larghezza del riquadro

    /** Un solo colore d'allarme (ambra), da 80% di budget speso; prima il liquido è bianco trasparente come gli altri riquadri. */
    private static int colorFor(double ratio) {
        return ratio >= 0.8 ? 0xCCFBBF24 : 0x66FFFFFF;
    }

    /** Un fotogramma: il liquido alto quanto il residuo del budget (1 − spesa/budget), con la superficie a onda sinusoidale in fase {@code phase}. */
    private static Bitmap frame(double ratio, double phase) {
        Bitmap b = Bitmap.createBitmap(WAVE_W, WAVE_H, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(colorFor(ratio));
        double level = Math.max(0.06, Math.min(1, 1 - ratio));
        if (ratio <= 0) { g.drawRect(0, 0, WAVE_W, WAVE_H, p); return b; } // nulla speso: pieno, nessuna superficie
        double base = Math.max(AMPLITUDE + 1, WAVE_H * (1 - level));
        Path wave = new Path();
        wave.moveTo(0, WAVE_H);
        for (int x = 0; x <= WAVE_W; x++) {
            // y = base + A·sin(k·x − fase): con la fase che cresce a ogni fotogramma la cresta si sposta verso destra
            double y = base + AMPLITUDE * Math.sin(2 * Math.PI * CRESTS * x / WAVE_W - phase);
            wave.lineTo(x, (float) y);
        }
        wave.lineTo(WAVE_W, WAVE_H);
        wave.close();
        g.drawPath(wave, p);
        return b;
    }

    /**
     * Riempie il riquadro: i fotogrammi dell'onda vanno nel ViewFlipper che li alterna da solo. Il liquido è il residuo del budget e
     * scende man mano che si spende: pieno a spesa zero (un solo fotogramma), vuoto a budget finito o superato e senza budget.
     * Lo sfondo tondo (14dp, come «Da pagare») ritaglia i bordi.
     */
    private static void fill(Context c, RemoteViews v, String key, boolean show, double spent, double budget) {
        boolean has = show && budget > 0;
        double ratio = has ? Math.max(0, spent / budget) : 1;
        Bitmap still = !has || ratio >= 1 ? Bitmap.createBitmap(WAVE_W, WAVE_H, Bitmap.Config.ARGB_8888) : ratio <= 0 ? frame(0, 0) : null;
        for (int i = 0; i < FRAMES; i++) {
            int id = c.getResources().getIdentifier("fl_" + key + "_" + i, "id", c.getPackageName());
            v.setImageViewBitmap(id, still != null ? still : frame(ratio, 2 * Math.PI * i / FRAMES));
        }
    }

    // ------------------------------------------------------------------ spesa al giorno

    /** «€9,40»: valuta davanti e due decimali sempre. */
    private static String euro(double v) { return "€" + String.format(Locale.ITALY, "%.2f", v); }

    /**
     * Stima e reale una sotto l'altra: «stima €13,30» e sotto «reale €15,10». La stima è il budget diviso i giorni del mese, la reale quanto speso
     * finora diviso i giorni passati (oggi compreso). La reale è bianca se è pari o migliore della stima, ambra se è peggiore; senza budget non c'è confronto.
     */
    private static void dailyStacked(RemoteViews v, boolean ok, double spent, double budget, int estId, int actId) {
        Calendar now = Calendar.getInstance();
        int day = now.get(Calendar.DAY_OF_MONTH);
        int days = now.getActualMaximum(Calendar.DAY_OF_MONTH);
        boolean hasBudget = ok && budget > 0;
        double r = spent / day;
        v.setTextViewText(estId, "stima " + (hasBudget ? euro(budget / days) : "—"));
        v.setTextViewText(actId, "reale " + (ok ? euro(r) : "—"));
        v.setTextColor(actId, !hasBudget || r <= budget / days ? 0xFFFFFFFF : 0xFFFBBF24); // su sfondo scuro (widget_pill): bianco se pari o meglio della stima, ambra se peggio
    }

    /** «banca 12:05» se è di oggi, «banca 4 ott 17:00» altrimenti (ora del telefono); vuoto se non c'è nessuna banca collegata. */
    private static String bankText(String iso) {
        if (iso == null || iso.isEmpty()) return "";
        try {
            java.time.ZonedDateTime t = java.time.Instant.parse(iso).atZone(java.time.ZoneId.systemDefault());
            boolean today = t.toLocalDate().equals(java.time.LocalDate.now());
            return "banca " + t.format(java.time.format.DateTimeFormatter.ofPattern(today ? "HH:mm" : "d MMM HH:mm", Locale.ITALY));
        } catch (Exception e) {
            return "";
        }
    }

    // La barra del mese è un'immagine, larga in proporzione ai giorni: i blocchi sono le settimane vere (lunedì–domenica), con un divisore alla fine di
    // ogni domenica; il primo e l'ultimo blocco possono quindi essere più corti. Le misure seguono la forma della parte del widget (circa 4,4 : 1).
    private static final int BAR_W = 240;
    private static final int BAR_H = 54;
    private static final float BAR_R = 18f;   // angoli tondi (circa 6 dp)
    private static final float BAR_GAP = 6f;  // spessore del divisore (circa 2 dp)

    private static Bitmap monthBar(int day, int days, int[] dividers) {
        Bitmap b = Bitmap.createBitmap(BAR_W, BAR_H, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        android.graphics.RectF all = new android.graphics.RectF(0, 0, BAR_W, BAR_H);
        p.setColor(0x2EFFFFFF); // fondo: tutto il mese, lo stesso bianco trasparente degli altri riquadri
        g.drawRect(all, p);
        p.setColor(0x66FFFFFF); // i giorni passati (oggi compreso): un bianco più marcato, sopra il fondo
        g.drawRect(0, 0, BAR_W * (float) day / days, BAR_H, p);
        // angoli tondi: si cancella tutto ciò che sta fuori da un rettangolo arrotondato (vale con qualsiasi trasparenza e ha il bordo sfumato)
        p.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR));
        Path outside = new Path();
        outside.addRoundRect(all, BAR_R, BAR_R, Path.Direction.CW);
        outside.setFillType(Path.FillType.INVERSE_WINDING);
        g.drawPath(outside, p);
        // i divisori sono fessure vuote, alla fine di ogni domenica
        for (int d : dividers) {
            float x = BAR_W * (float) d / days;
            g.drawRect(x - BAR_GAP / 2, 0, x + BAR_GAP / 2, BAR_H, p);
        }
        return b;
    }

    /**
     * Quanto manca alla fine del mese: la barra delle settimane, riempita dai giorni passati (oggi compreso) e con i divisori sulle domeniche,
     * con scritto dentro «mancano 25 g»; e, nella parte sotto, l'ultimo aggiornamento delle banche collegate. Barra e banca stanno su fondo proprio,
     * non nella parte «Da pagare»: non cambiano colore quando è tutto pagato.
     */
    private static void monthProgress(RemoteViews v, String bankAt) {
        Calendar now = Calendar.getInstance();
        int day = now.get(Calendar.DAY_OF_MONTH);
        int days = now.getActualMaximum(Calendar.DAY_OF_MONTH);
        Calendar first = (Calendar) now.clone();
        first.set(Calendar.DAY_OF_MONTH, 1);
        int[] dividers = MonthWeeks.dividers(days, MonthWeeks.mondayIndex(first.get(Calendar.DAY_OF_WEEK)));
        v.setImageViewBitmap(R.id.widget_month_bar, monthBar(day, days, dividers));
        v.setTextViewText(R.id.widget_month_left, day >= days ? "ultimo giorno" : "mancano " + (days - day) + " g");
        String bank = bankText(bankAt);
        v.setTextViewText(R.id.widget_month_bank, bank);
        v.setViewVisibility(R.id.widget_month_bank_cell, bank.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE); // senza banche collegate la parte sparisce
    }

    private static PendingIntent tap(Context c, int code, String open, String cat) {
        Intent i = new Intent(c, MainActivity.class).putExtra("open", open);
        if (cat != null) i.putExtra("cat", cat);
        return PendingIntent.getActivity(c, code + 20, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void paint(Context c, AppWidgetManager m, int[] ids, Month d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_month3);
        Month shown = d.ok || d.needLogin ? d : Month.cached(c); // server non raggiungibile: ultimo dato noto del mese

        String label = "Da pagare";
        String toPay = "—";
        String spese = "—", carburante = "—", svago = "—";
        boolean good = false; // «Da pagare» neutro solo se la lettura c'è e non resta nulla
        if (shown.needLogin) {
            label = "Accedi";
            toPay = "nell'app";
        } else if (shown.ok) {
            good = shown.toPayCount == 0;
            toPay = short_(shown.toPay);
            if (shown.toPayCount > 0) label = "Da pagare (" + shown.toPayCount + ")";
            // con il budget impostato si vede il residuo (budget − speso, negativo se superato); senza budget, quanto speso
            spese = left(shown.spese, shown.budgetSpese);
            carburante = left(shown.carburante, shown.budgetCarburante);
            svago = left(shown.svago, shown.budgetSvago);
        }
        v.setTextViewText(R.id.widget_month_topay_label, label);
        v.setTextViewText(R.id.widget_month_topay, toPay);
        v.setTextViewText(R.id.widget_month_spese_title, "Spese");
        v.setTextViewText(R.id.widget_month_carburante_title, "Carburante");
        v.setTextViewText(R.id.widget_month_svago_title, "Svago");
        v.setTextViewText(R.id.widget_month_spese, spese);
        v.setTextViewText(R.id.widget_month_carburante, carburante);
        v.setTextViewText(R.id.widget_month_svago, svago);

        // Contenitori del budget (mostrano il residuo solo se la lettura c'è e il budget è impostato).
        fill(c, v, "spese", shown.ok, shown.spese, shown.budgetSpese);
        fill(c, v, "carburante", shown.ok, shown.carburante, shown.budgetCarburante);
        fill(c, v, "svago", shown.ok, shown.svago, shown.budgetSvago);

        dailyStacked(v, shown.ok, shown.spese, shown.budgetSpese, R.id.widget_month_spese_est, R.id.widget_month_spese_act);
        dailyStacked(v, shown.ok, shown.carburante, shown.budgetCarburante, R.id.widget_month_carburante_est, R.id.widget_month_carburante_act);
        dailyStacked(v, shown.ok, shown.svago, shown.budgetSvago, R.id.widget_month_svago_est, R.id.widget_month_svago_act);

        // «Da pagare»: tutto pagato = riquadro neutro con scritte bianche, come gli altri; qualcosa da pagare = ambra (l'unico colore d'allarme) con scritte in teal scuro.
        // Senza lettura (server irraggiungibile, accesso da rifare) non si sa se è tutto pagato: resta ambra.
        v.setInt(R.id.widget_month_due_cell, "setBackgroundResource", good ? R.drawable.widget_cell : R.drawable.w2_cell_alert);
        v.setTextColor(R.id.widget_month_topay_label, good ? 0xE6FFFFFF : 0xFF0B4F4A);
        v.setTextColor(R.id.widget_month_topay, good ? 0xFFFFFFFF : 0xFF0B4F4A);
        monthProgress(v, shown.bankAt);

        v.setOnClickPendingIntent(R.id.widget_month_root, tap(c, 1, "overview", null));
        v.setOnClickPendingIntent(R.id.widget_month_due_cell, tap(c, 2, "overview", null));
        v.setOnClickPendingIntent(R.id.widget_month_spese_cell, tap(c, 3, "moves", "spesa"));
        v.setOnClickPendingIntent(R.id.widget_month_carburante_cell, tap(c, 4, "moves", "carburante"));
        v.setOnClickPendingIntent(R.id.widget_month_svago_cell, tap(c, 5, "moves", "svago"));
        m.updateAppWidget(ids, v);
        if (shown.ok) updatePreview(c, m, v);
    }

    /**
     * Anteprima «vera» nella lista dei widget (Android 15 e successivi): l'ultimo aspetto con i dati reali. Prima di Android 15 vale
     * l'anteprima statica con dati di esempio (previewLayout). Il sistema limita le richieste: al massimo una l'ora e senza errori.
     */
    private static void updatePreview(Context c, AppWidgetManager m, RemoteViews v) {
        if (android.os.Build.VERSION.SDK_INT < 35) return;
        android.content.SharedPreferences p = c.getSharedPreferences("anteprima", Context.MODE_PRIVATE);
        String key = "mese3";
        long now = System.currentTimeMillis();
        if (now - p.getLong(key, 0) < 3600000L) return;
        try {
            m.setWidgetPreview(new ComponentName(c, MonthWidgetStacked.class), android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN, v);
            p.edit().putLong(key, now).apply();
        } catch (Throwable e) { /* limite di richieste o non supportato: resta l'anteprima statica */ }
    }
}
