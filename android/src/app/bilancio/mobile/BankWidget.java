package app.bilancio.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.util.Locale;

/**
 * Widget «Revolut» (4×1): saldo totale in euro (conti e pocket) e ultimo movimento, dall'ULTIMA lettura fatta dalla banca. Non è in tempo reale:
 * il widget non chiama mai la banca (le banche concedono poche letture al giorno) e scrive da quando sono i dati. Si aggiorna quando premi
 * «Leggi dalla banca» o «Aggiorna ora» nell'app, e ogni mezz'ora rilegge dal server quello che c'è. Un tocco apre la scheda Banche.
 */
public class BankWidget extends AppWidgetProvider {
    private static final String BANK = "revolut";

    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        paint(c, m, ids, BankData.cached(c, BANK));
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override public void run() {
                try { paint(c, m, ids, load(c)); } finally { pending.finish(); }
            }
        }).start();
    }

    /** Rilegge dal server e aggiorna tutti i widget Revolut presenti sulla Home. */
    static void refreshAll(final Context context) {
        final Context c = context.getApplicationContext();
        final AppWidgetManager m = AppWidgetManager.getInstance(c);
        final int[] ids = m.getAppWidgetIds(new ComponentName(c, BankWidget.class));
        if (ids.length == 0) return;
        new Thread(new Runnable() {
            @Override public void run() { paint(c, m, ids, load(c)); }
        }).start();
    }

    private static BankData load(Context c) {
        BankData d = BankData.fetch(c, BANK);
        if (d.ok) d.save(c, BANK);
        return d;
    }

    private static String money(double v) { return Due.money(v); }

    private static void paint(Context c, AppWidgetManager m, int[] ids, BankData d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_bank);
        BankData shown = d.ok || d.needLogin ? d : BankData.cached(c, BANK); // server non raggiungibile: ultima copia nota

        String since = "mai", balance = "—", lastLabel = "Ultimo", last = "—", lastName = "";
        int lastColor = 0xFFFFFFFF;
        if (shown.needLogin) {
            balance = "Accedi";
            lastName = "nell'app";
        } else if (!shown.connected) {
            balance = "Collega";
            lastName = "Revolut nell'app";
        } else if (shown.empty) {
            balance = "Da leggere";
            lastName = "«Leggi dalla banca»";
        } else {
            since = shown.when();
            if (shown.hasTotal) balance = money(shown.total);
            if (shown.hasLast) {
                last = (shown.lastAmount > 0 ? "+" : "") + money(shown.lastAmount);
                lastName = shown.lastName;
                lastColor = shown.lastAmount > 0 ? 0xFF4ADE80 : 0xFFFFFFFF;
                if (shown.lastPending) lastLabel = "In sospeso";
            }
        }
        v.setTextViewText(R.id.widget_bank_since, since);
        v.setTextViewText(R.id.widget_bank_balance, balance);
        v.setTextViewText(R.id.widget_bank_last_label, lastLabel);
        v.setTextViewText(R.id.widget_bank_last, last);
        v.setTextColor(R.id.widget_bank_last, lastColor);
        v.setTextViewText(R.id.widget_bank_last_name, lastName);

        Intent open = new Intent(c, MainActivity.class).putExtra("open", "banks");
        PendingIntent tap = PendingIntent.getActivity(c, 21, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.widget_bank_root, tap);
        m.updateAppWidget(ids, v);
    }
}
