package app.bilancio.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * Widget «Questo mese» (5×1): quattro riquadri affiancati, tutti dal primo del mese. «Da pagare» ha un colore tutto suo
 * (rosso se resta qualcosa, verde se è tutto pagato); spese, carburante e svago sono già pagati. Un tocco apre l'app.
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

    private static void paint(Context c, AppWidgetManager m, int[] ids, Month d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_month);
        Month shown = d.ok || d.needLogin ? d : Month.cached(c); // server non raggiungibile: ultimo dato noto del mese
        v.setTextViewText(R.id.widget_month_abbr, Month.NAMES[Month.currentMonth() - 1].substring(0, 3).toUpperCase(java.util.Locale.ITALY));

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

        // «Da pagare» si distingue dagli altri: rosso chiaro finché resta qualcosa, verde chiaro quando è tutto pagato.
        v.setInt(R.id.widget_month_due_cell, "setBackgroundResource", good ? R.drawable.widget_cell_ok : R.drawable.widget_cell_due);
        int ink = good ? 0xFF14663A : 0xFF9A2A1F;
        v.setTextColor(R.id.widget_month_topay_label, ink);
        v.setTextColor(R.id.widget_month_topay, ink);

        Intent open = new Intent(c, MainActivity.class);
        v.setOnClickPendingIntent(R.id.widget_month_root, PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        m.updateAppWidget(ids, v);
    }
}
