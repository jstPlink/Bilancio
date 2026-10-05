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
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;

/**
 * Widget «Questo mese» (5×1, testi grandi; è l'unico widget del mese, registrato come {@link MonthWidgetDetail}): a sinistra «dal 1° OTT» (apre la scheda Budget), poi quattro riquadri affiancati, tutti dal primo del mese.
 * «Da pagare» ha un colore tutto suo (rosso se resta qualcosa, verde se è tutto pagato); spese, carburante e svago sono già pagati
 * e, se c'è un budget, il loro riquadro è un contenitore che si riempie dal basso in proporzione alla spesa, con la superficie ad
 * onda sinusoidale che scorre verso destra. Ogni riquadro apre l'app: «Da pagare» sulla Panoramica, gli altri sui Movimenti del mese
 * filtrati per la loro categoria; il resto del widget apre l'app dall'inizio.
 * In ogni riquadro di spesa c'è anche la spesa stimata al giorno e quella reale.
 */
public class MonthWidget extends AppWidgetProvider {
    boolean detailed() { return true; }

    /** «Questo mese 2»: «Da pagare» più stretto e, in ogni riquadro di spesa, stima e reale una sotto l'altra. */
    boolean stacked() { return false; }

    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        final boolean detailed = detailed();
        final boolean stacked = stacked();
        paint(c, m, ids, Month.cached(c), detailed, stacked); // subito l'ultimo dato noto, poi si aggiorna
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override public void run() {
                try { paint(c, m, ids, load(c), detailed, stacked); } finally { pending.finish(); }
            }
        }).start();
    }

    /** Rilegge i dati dal server e aggiorna tutti i widget «Questo mese» (e la sua copia) presenti sulla Home. */
    static void refreshAll(final Context context) {
        final Context c = context.getApplicationContext();
        final AppWidgetManager m = AppWidgetManager.getInstance(c);
        final int[] ids = m.getAppWidgetIds(new ComponentName(c, MonthWidgetDetail.class));
        final int[] ids2 = m.getAppWidgetIds(new ComponentName(c, MonthWidgetStacked.class));
        if (ids.length == 0 && ids2.length == 0) return;
        new Thread(new Runnable() {
            @Override public void run() {
                Month d = load(c);
                if (ids.length > 0) paint(c, m, ids, d, true, false);
                if (ids2.length > 0) paint(c, m, ids2, d, true, true);
            }
        }).start();
    }

    private static Month load(Context c) {
        Month d = Month.fetch(c);
        if (d.ok) d.save(c);
        return d;
    }

    /** Importo corto, per far stare quattro cifre in una riga: 1.234 € da mille in su, con i centesimi sotto. */
    static String short_(double v) {
        if (Math.abs(v) >= 1000) return java.text.NumberFormat.getIntegerInstance(Locale.ITALY).format(Math.round(v)) + " €";
        return Due.money(v);
    }

    // ------------------------------------------------------------------ il contenitore con l'onda

    private static final int FRAMES = 16;    // fotogrammi dell'onda: lo scorrimento di un giro intero (16 × 285 ms = 4,6 s)
    private static final int WAVE_W = 56;
    private static final int WAVE_H = 40;
    private static final double AMPLITUDE = 0.9;
    private static final double CRESTS = 2;   // quante onde in tutta la larghezza del riquadro

    private static int colorFor(double ratio) {
        return ratio >= 1 ? 0xCCE5484D : ratio >= 0.8 ? 0xCCF59E0B : 0x66FFFFFF; // rosso oltre il budget, arancione da 80%, bianco
    }

    /** Un fotogramma: il liquido alto quanto il rapporto spesa/budget, con la superficie a onda sinusoidale in fase {@code phase}. */
    private static Bitmap frame(double ratio, double phase) {
        Bitmap b = Bitmap.createBitmap(WAVE_W, WAVE_H, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(colorFor(ratio));
        double level = Math.max(0.06, Math.min(1, ratio));
        if (ratio >= 1) { g.drawRect(0, 0, WAVE_W, WAVE_H, p); return b; } // pieno: nessuna superficie
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
     * Riempie il riquadro: i fotogrammi dell'onda vanno nel ViewFlipper che li alterna da solo. Senza budget o senza spesa c'è un solo
     * fotogramma vuoto (ripetuto); a budget superato, uno solo pieno. Lo sfondo tondo (14dp, come «Da pagare») ritaglia i bordi.
     */
    private static void fill(Context c, RemoteViews v, String key, boolean show, double spent, double budget) {
        double ratio = show && budget > 0 ? spent / budget : 0;
        Bitmap still = ratio <= 0 ? Bitmap.createBitmap(WAVE_W, WAVE_H, Bitmap.Config.ARGB_8888) : ratio >= 1 ? frame(ratio, 0) : null;
        for (int i = 0; i < FRAMES; i++) {
            int id = c.getResources().getIdentifier("fl_" + key + "_" + i, "id", c.getPackageName());
            v.setImageViewBitmap(id, still != null ? still : frame(ratio, 2 * Math.PI * i / FRAMES));
        }
    }

    // ------------------------------------------------------------------ spesa al giorno (solo nella copia)

    private static String perDay(double v) { return String.format(Locale.ITALY, "%.1f", v); }

    /**
     * Una riga sola, «stima→reale/g»: la stima è il budget diviso i giorni del mese, la reale quanto speso finora diviso i giorni passati
     * (oggi compreso). La reale è verde se è pari o migliore della stima, rossa se peggiore; senza budget non c'è confronto e resta bianca.
     */
    private static void daily(RemoteViews v, boolean ok, double spent, double budget, int dayId) {
        Calendar now = Calendar.getInstance();
        int day = now.get(Calendar.DAY_OF_MONTH);
        int days = now.getActualMaximum(Calendar.DAY_OF_MONTH);
        SpannableStringBuilder s = new SpannableStringBuilder();
        if (!ok) {
            s.append("—");
        } else {
            double r = spent / day;
            boolean hasBudget = budget > 0;
            s.append(hasBudget ? perDay(budget / days) : "—").append("→");
            int from = s.length();
            s.append(perDay(r));
            if (hasBudget) s.setSpan(new ForegroundColorSpan(r <= budget / days ? 0xFF4ADE80 : 0xFFFF6B6B), from, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            s.append("/g");
        }
        v.setTextViewText(dayId, s);
    }

    /** Stima e reale una sotto l'altra (solo «Questo mese 2»): «stima 13,3/g» e sotto «reale 15,1/g», questa verde se è pari o migliore, rossa se peggiore. */
    /** «€9,40»: valuta davanti e due decimali sempre. */
    private static String euro(double v) { return "€" + String.format(Locale.ITALY, "%.2f", v); }

    private static void dailyStacked(RemoteViews v, boolean ok, double spent, double budget, int estId, int actId) {
        Calendar now = Calendar.getInstance();
        int day = now.get(Calendar.DAY_OF_MONTH);
        int days = now.getActualMaximum(Calendar.DAY_OF_MONTH);
        boolean hasBudget = ok && budget > 0;
        double r = spent / day;
        // con la valuta davanti e i centesimi per intero: «stima €9,40», «reale €12,35»
        v.setTextViewText(estId, "stima " + (hasBudget ? euro(budget / days) : "—"));
        v.setTextViewText(actId, "reale " + (ok ? euro(r) : "—"));
        v.setTextColor(actId, !hasBudget ? 0xFFFFFFFF : r <= budget / days ? 0xFF4ADE80 : 0xFFFF8585); // su sfondo scuro (widget_pill): il rosso si legge
    }

    private static PendingIntent tap(Context c, int code, String open, String cat, boolean detailed, boolean stacked) {
        Intent i = new Intent(c, MainActivity.class).putExtra("open", open);
        if (cat != null) i.putExtra("cat", cat);
        // la copia usa altri codici: i due widget non devono scambiarsi le azioni
        return PendingIntent.getActivity(c, code + (stacked ? 20 : detailed ? 10 : 0), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void paint(Context c, AppWidgetManager m, int[] ids, Month d, boolean detailed, boolean stacked) {
        RemoteViews v = new RemoteViews(c.getPackageName(), stacked ? R.layout.widget_month3 : R.layout.widget_month2);
        Month shown = d.ok || d.needLogin ? d : Month.cached(c); // server non raggiungibile: ultimo dato noto del mese
        if (!stacked) v.setTextViewText(R.id.widget_month_since, Month.NAMES[Month.currentMonth() - 1].substring(0, 3).toUpperCase(Locale.ITALY)); // «Questo mese 2» non ha «dal 1° OTT»

        String label = "Da pagare";
        String toPay = "—";
        String spese = "—", carburante = "—", svago = "—";
        boolean good = false; // «Da pagare» verde solo se la lettura c'è e non resta nulla
        if (shown.needLogin) {
            label = "Accedi";
            toPay = "nell'app";
        } else if (shown.ok) {
            good = shown.toPayCount == 0;
            toPay = short_(shown.toPay);
            if (shown.toPayCount > 0) label = "Da pagare (" + shown.toPayCount + ")";
            spese = short_(shown.spese);
            carburante = short_(shown.carburante);
            svago = short_(shown.svago);
        }
        v.setTextViewText(R.id.widget_month_topay_label, label);
        v.setTextViewText(R.id.widget_month_topay, toPay);
        v.setTextViewText(R.id.widget_month_spese, spese);
        v.setTextViewText(R.id.widget_month_carburante, carburante);
        v.setTextViewText(R.id.widget_month_svago, svago);

        // Contenitori del budget (si riempiono solo se la lettura c'è e il budget è impostato).
        fill(c, v, "spese", shown.ok, shown.spese, shown.budgetSpese);
        fill(c, v, "carburante", shown.ok, shown.carburante, shown.budgetCarburante);
        fill(c, v, "svago", shown.ok, shown.svago, shown.budgetSvago);

        if (stacked) {
            dailyStacked(v, shown.ok, shown.spese, shown.budgetSpese, R.id.widget_month_spese_est, R.id.widget_month_spese_act);
            dailyStacked(v, shown.ok, shown.carburante, shown.budgetCarburante, R.id.widget_month_carburante_est, R.id.widget_month_carburante_act);
            dailyStacked(v, shown.ok, shown.svago, shown.budgetSvago, R.id.widget_month_svago_est, R.id.widget_month_svago_act);
        } else if (detailed) {
            daily(v, shown.ok, shown.spese, shown.budgetSpese, R.id.widget_month_spese_day);
            daily(v, shown.ok, shown.carburante, shown.budgetCarburante, R.id.widget_month_carburante_day);
            daily(v, shown.ok, shown.svago, shown.budgetSvago, R.id.widget_month_svago_day);
        }

        // «Da pagare» si distingue dagli altri: rosso con scritte bianche finché resta qualcosa, verde chiaro quando è tutto pagato.
        // Senza lettura (server irraggiungibile, accesso da rifare) non si sa se è tutto pagato: resta rosso.
        v.setInt(R.id.widget_month_due_cell, "setBackgroundResource", good ? R.drawable.widget_cell_ok : R.drawable.widget_cell_due);
        v.setTextColor(R.id.widget_month_topay_label, good ? 0xFF14663A : 0xE6FFFFFF);
        v.setTextColor(R.id.widget_month_topay, good ? 0xFF14663A : 0xFFFFFFFF);

        v.setOnClickPendingIntent(R.id.widget_month_root, tap(c, 1, "overview", null, detailed, stacked));
        if (!stacked) v.setOnClickPendingIntent(R.id.widget_month_since_cell, tap(c, 6, "budget", null, detailed, stacked));
        v.setOnClickPendingIntent(R.id.widget_month_due_cell, tap(c, 2, "overview", null, detailed, stacked));
        v.setOnClickPendingIntent(R.id.widget_month_spese_cell, tap(c, 3, "moves", "spesa", detailed, stacked));
        v.setOnClickPendingIntent(R.id.widget_month_carburante_cell, tap(c, 4, "moves", "carburante", detailed, stacked));
        v.setOnClickPendingIntent(R.id.widget_month_svago_cell, tap(c, 5, "moves", "svago", detailed, stacked));
        m.updateAppWidget(ids, v);
        if (shown.ok) updatePreview(c, m, detailed, stacked, v);
    }

    /**
     * Anteprima «vera» nella lista dei widget (Android 15 e successivi): l'ultimo aspetto con i dati reali. Prima di Android 15 vale
     * l'anteprima statica con dati di esempio (previewLayout). Il sistema limita le richieste: al massimo una l'ora e senza errori.
     */
    private static void updatePreview(Context c, AppWidgetManager m, boolean detailed, boolean stacked, RemoteViews v) {
        if (android.os.Build.VERSION.SDK_INT < 35) return;
        android.content.SharedPreferences p = c.getSharedPreferences("anteprima", Context.MODE_PRIVATE);
        String key = stacked ? "mese3" : detailed ? "mese2" : "mese";
        long now = System.currentTimeMillis();
        if (now - p.getLong(key, 0) < 3600000L) return;
        try {
            m.setWidgetPreview(new ComponentName(c, stacked ? MonthWidgetStacked.class : detailed ? MonthWidgetDetail.class : MonthWidget.class), android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN, v);
            p.edit().putLong(key, now).apply();
        } catch (Throwable e) { /* limite di richieste o non supportato: resta l'anteprima statica */ }
    }
}
