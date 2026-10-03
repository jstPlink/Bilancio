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
import android.graphics.RectF;
import android.widget.RemoteViews;

/**
 * Widget «Questo mese» (5×1): in alto il titolo («dal 1° OTT»), sotto quattro riquadri affiancati, tutti dal primo del mese.
 * «Da pagare» ha un colore tutto suo (rosso pieno se resta qualcosa, verde se è tutto pagato); spese, carburante e svago sono già pagati
 * e, se c'è un budget, hanno una barra che si riempie con la spesa. Ogni riquadro apre l'app: «Da pagare» sulla Panoramica,
 * gli altri sui Movimenti del mese filtrati per la loro categoria; il resto del widget apre l'app dall'inizio.
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

    /** Rilegge i dati dal server e aggiorna tutti i widget di questo tipo presenti sulla Home. */
    static void refreshAll(final Context context) {
        final Context c = context.getApplicationContext();
        final AppWidgetManager m = AppWidgetManager.getInstance(c);
        final int[] ids = m.getAppWidgetIds(new ComponentName(c, MonthWidget.class));
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

    /** Importo corto, per far stare quattro cifre in una riga: 1.234 € da mille in su, con i centesimi sotto. */
    static String short_(double v) {
        if (Math.abs(v) >= 1000) return java.text.NumberFormat.getIntegerInstance(java.util.Locale.ITALY).format(Math.round(v)) + " €";
        return Due.money(v);
    }

    private static final int BAR_W = 240;
    private static final int BAR_H = 12;

    /** Barra del budget: traccia chiara e riempimento in proporzione; bianca, gialla da 80% e rossa a budget superato. */
    static Bitmap bar(double spent, double budget) {
        Bitmap b = Bitmap.createBitmap(BAR_W, BAR_H, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float r = BAR_H / 2f;
        p.setColor(0x59FFFFFF);
        g.drawRoundRect(new RectF(0, 0, BAR_W, BAR_H), r, r, p);
        double ratio = budget > 0 ? spent / budget : 0;
        if (ratio > 0) {
            p.setColor(ratio >= 1 ? 0xFFFF6B5E : ratio >= 0.8 ? 0xFFFFD54F : 0xFFFFFFFF);
            float w = (float) Math.max(BAR_H, Math.min(1, ratio) * BAR_W); // anche una spesa minima si vede
            g.drawRoundRect(new RectF(0, 0, w, BAR_H), r, r, p);
        }
        return b;
    }

    private static void budgetBar(RemoteViews v, int id, boolean show, double spent, double budget) {
        boolean on = show && budget > 0;
        v.setViewVisibility(id, on ? android.view.View.VISIBLE : android.view.View.GONE);
        if (on) v.setImageViewBitmap(id, bar(spent, budget));
    }

    private static PendingIntent tap(Context c, int code, String open, String cat) {
        Intent i = new Intent(c, MainActivity.class).putExtra("open", open);
        if (cat != null) i.putExtra("cat", cat);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void paint(Context c, AppWidgetManager m, int[] ids, Month d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_month);
        Month shown = d.ok || d.needLogin ? d : Month.cached(c); // server non raggiungibile: ultimo dato noto del mese
        v.setTextViewText(R.id.widget_month_abbr, "Questo mese · dal 1° " + Month.NAMES[Month.currentMonth() - 1].substring(0, 3).toUpperCase(java.util.Locale.ITALY));

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

        // Barre del budget (solo se la lettura c'è e il budget è impostato).
        budgetBar(v, R.id.widget_month_spese_bar, shown.ok, shown.spese, shown.budgetSpese);
        budgetBar(v, R.id.widget_month_carburante_bar, shown.ok, shown.carburante, shown.budgetCarburante);
        budgetBar(v, R.id.widget_month_svago_bar, shown.ok, shown.svago, shown.budgetSvago);

        // «Da pagare» si distingue dagli altri: rosso pieno con scritte bianche finché resta qualcosa, verde chiaro quando è tutto pagato.
        // Senza lettura (server irraggiungibile, accesso da rifare) non si sa se è tutto pagato: resta rosso.
        v.setInt(R.id.widget_month_due_cell, "setBackgroundResource", good ? R.drawable.widget_cell_ok : R.drawable.widget_cell_due);
        v.setTextColor(R.id.widget_month_topay_label, good ? 0xFF14663A : 0xE6FFFFFF);
        v.setTextColor(R.id.widget_month_topay, good ? 0xFF14663A : 0xFFFFFFFF);

        v.setOnClickPendingIntent(R.id.widget_month_root, tap(c, 1, "overview", null));
        v.setOnClickPendingIntent(R.id.widget_month_due_cell, tap(c, 2, "overview", null));
        v.setOnClickPendingIntent(R.id.widget_month_spese_cell, tap(c, 3, "moves", "spesa"));
        v.setOnClickPendingIntent(R.id.widget_month_carburante_cell, tap(c, 4, "moves", "carburante"));
        v.setOnClickPendingIntent(R.id.widget_month_svago_cell, tap(c, 5, "moves", "svago"));
        m.updateAppWidget(ids, v);
    }
}
