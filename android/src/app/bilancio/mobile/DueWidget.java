package app.bilancio.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget «Da pagare»: totale e prime voci ancora da pagare. Un tocco apre l'app. */
public class DueWidget extends AppWidgetProvider {
    private static final int MAX_LINES = 5;

    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        paint(c, m, ids, Due.cached(c), false); // subito l'ultimo dato noto, poi si aggiorna
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override public void run() {
                try { paint(c, m, ids, load(c), false); } finally { pending.finish(); }
            }
        }).start();
    }

    /** Rilegge i dati dal server e aggiorna tutti i widget presenti sulla Home. */
    static void refreshAll(final Context context) {
        final Context c = context.getApplicationContext();
        final AppWidgetManager m = AppWidgetManager.getInstance(c);
        final int[] ids = m.getAppWidgetIds(new ComponentName(c, DueWidget.class));
        if (ids.length == 0) return;
        new Thread(new Runnable() {
            @Override public void run() { paint(c, m, ids, load(c), false); }
        }).start();
    }

    private static Due load(Context c) {
        Due d = Due.fetch(c);
        if (d.ok) d.save(c);
        return d;
    }

    private static void paint(Context c, AppWidgetManager m, int[] ids, Due d, boolean unused) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_due);
        String total;
        String title = "Da pagare";
        StringBuilder lines = new StringBuilder();
        Due shown = d;
        if (d.needLogin) {
            total = "Accedi";
            title = "Bilancio · apri l'app";
        } else {
            if (!d.ok) shown = Due.cached(c); // server non raggiungibile: ultimo dato noto
            if (!shown.ok) {
                total = "—";
                title = "Dati non disponibili";
            } else if (shown.count == 0) {
                total = "Tutto pagato";
                title = d.ok ? "Da pagare" : "Da pagare · non aggiornato";
            } else {
                total = Due.money(shown.total);
                title = "Da pagare · " + (shown.count == 1 ? "1 voce" : shown.count + " voci") + (d.ok ? "" : " · non aggiornato");
                for (int i = 0; i < Math.min(MAX_LINES, shown.lines.size()); i++) {
                    if (i > 0) lines.append('\n');
                    lines.append(shown.lines.get(i));
                }
                if (shown.lines.size() > MAX_LINES) lines.append("\n… e altre ").append(shown.lines.size() - MAX_LINES);
            }
        }
        v.setTextViewText(R.id.widget_total, total);
        v.setTextViewText(R.id.widget_title, title);
        v.setTextViewText(R.id.widget_lines, lines.toString());
        Intent open = new Intent(c, MainActivity.class);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        m.updateAppWidget(ids, v);
    }
}
