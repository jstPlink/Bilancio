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
import android.graphics.RectF;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * Widget «Questo mese» (5×1): a sinistra «dal 1° ottobre» (apre la scheda Budget), poi quattro riquadri affiancati, tutti dal primo del mese.
 * «Da pagare» ha un colore tutto suo (rosso pieno se resta qualcosa, verde se è tutto pagato); spese, carburante e svago sono già pagati
 * e, se c'è un budget, il loro riquadro è un contenitore che si riempie dal basso in proporzione alla spesa. Ogni riquadro apre l'app:
 * «Da pagare» sulla Panoramica, gli altri sui Movimenti del mese filtrati per la loro categoria; il resto del widget apre l'app dall'inizio.
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

    private static final float RADIUS_DP = 14; // gli angoli del riquadro «Da pagare» (widget_cell_due)

    /**
     * Il riquadro come un contenitore: sfondo chiaro e, dal basso verso l'alto, il «liquido» alto quanto la spesa rispetto al budget.
     * Senza budget (budget 0) resta il solo sfondo. Il liquido è bianco, arancione da 80% e rosso a budget superato.
     */
    static Bitmap cell(double spent, double budget, int w, int h, float r) {
        final int CELL_W = w;
        final int CELL_H = h;
        Bitmap b = Bitmap.createBitmap(CELL_W, CELL_H, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Path shape = new Path();
        shape.addRoundRect(new RectF(0, 0, CELL_W, CELL_H), r, r, Path.Direction.CW);
        g.clipPath(shape);
        p.setColor(0x2EFFFFFF);
        g.drawRect(0, 0, CELL_W, CELL_H, p);
        double ratio = budget > 0 ? spent / budget : 0;
        if (ratio > 0) {
            p.setColor(ratio >= 1 ? 0xCCE5484D : ratio >= 0.8 ? 0xCCF59E0B : 0x66FFFFFF);
            float level = (float) Math.max(6, Math.min(1, ratio) * CELL_H); // anche una spesa minima si vede
            g.drawRect(0, CELL_H - level, CELL_W, CELL_H, p);
        }
        return b;
    }

    private static void fill(RemoteViews v, int id, boolean show, double spent, double budget, int[] px) {
        v.setImageViewBitmap(id, cell(show ? spent : 0, show ? budget : 0, px[0], px[1], px[2]));
    }

    private static PendingIntent tap(Context c, int code, String open, String cat) {
        Intent i = new Intent(c, MainActivity.class).putExtra("open", open);
        if (cat != null) i.putExtra("cat", cat);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /**
     * Misure in pixel di un riquadro (larghezza, altezza, raggio degli angoli), dalle dimensioni del widget: il disegno ha così
     * le stesse proporzioni del riquadro e gli angoli restano tondi come quelli di «Da pagare».
     */
    private static int[] cellPx(Context c, AppWidgetManager m, int id) {
        float density = c.getResources().getDisplayMetrics().density;
        Bundle o = m.getAppWidgetOptions(id);
        float widgetW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320);
        float widgetH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 56);
        // meno i margini del widget (8+8 dp) e dei riquadri (4 dp ciascuno, 4 riquadri), diviso i pesi (0,6 + 1,15 + 3×1)
        float w = Math.max(40, (widgetW - 16 - 16) / 4.75f);
        float h = Math.max(30, widgetH - 12);
        return new int[] { Math.round(w * density), Math.round(h * density), Math.round(RADIUS_DP * density) };
    }

    private static void paint(Context c, AppWidgetManager m, int[] ids, Month d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_month);
        Month shown = d.ok || d.needLogin ? d : Month.cached(c); // server non raggiungibile: ultimo dato noto del mese
        v.setTextViewText(R.id.widget_month_since, Month.NAMES[Month.currentMonth() - 1]);

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

        int[] px = cellPx(c, m, ids[0]);
        // Contenitori del budget (si riempiono solo se la lettura c'è e il budget è impostato).
        fill(v, R.id.widget_month_spese_fill, shown.ok, shown.spese, shown.budgetSpese, px);
        fill(v, R.id.widget_month_carburante_fill, shown.ok, shown.carburante, shown.budgetCarburante, px);
        fill(v, R.id.widget_month_svago_fill, shown.ok, shown.svago, shown.budgetSvago, px);

        // «Da pagare» si distingue dagli altri: rosso pieno con scritte bianche finché resta qualcosa, verde chiaro quando è tutto pagato.
        // Senza lettura (server irraggiungibile, accesso da rifare) non si sa se è tutto pagato: resta rosso.
        v.setInt(R.id.widget_month_due_cell, "setBackgroundResource", good ? R.drawable.widget_cell_ok : R.drawable.widget_cell_due);
        v.setTextColor(R.id.widget_month_topay_label, good ? 0xFF14663A : 0xE6FFFFFF);
        v.setTextColor(R.id.widget_month_topay, good ? 0xFF14663A : 0xFFFFFFFF);

        v.setOnClickPendingIntent(R.id.widget_month_root, tap(c, 1, "overview", null));
        v.setOnClickPendingIntent(R.id.widget_month_since_cell, tap(c, 6, "budget", null));
        v.setOnClickPendingIntent(R.id.widget_month_due_cell, tap(c, 2, "overview", null));
        v.setOnClickPendingIntent(R.id.widget_month_spese_cell, tap(c, 3, "moves", "spesa"));
        v.setOnClickPendingIntent(R.id.widget_month_carburante_cell, tap(c, 4, "moves", "carburante"));
        v.setOnClickPendingIntent(R.id.widget_month_svago_cell, tap(c, 5, "moves", "svago"));
        m.updateAppWidget(ids, v);
    }
}
