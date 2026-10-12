package app.mybank.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Calendar;
import java.util.Locale;

/**
 * Widget 5×1 in quattro celle. A sinistra la barra del mese fino a fine mese, con una tacca a fine di ogni domenica e i giorni che
 * restano, e sotto l'ora dell'ultimo aggiornamento delle banche. Poi Spesa, Svago e Carburante: il residuo del budget (budget meno speso nel
 * mese), sotto la spesa giornaliera stimata (budget diviso i giorni del mese) e sotto quella reale (speso diviso i giorni passati, oggi
 * compreso), verde se è pari o migliore della stima, rossa se peggiore. Un tocco apre l'app.
 */
public class MyBankWidget extends AppWidgetProvider {
    private static final int INK = 0xFF131211, PAPER = 0xFFF3F0EA, MUTE = 0xFFA8A298, TRACK = 0xFF3A3733, RED = 0xFFE8431A, OK = 0xFF5CCB8A, LATE = 0xFFFF5A2E;
    private static final int[][] IDS = {
        { R.id.widget_spesa_label, R.id.widget_spesa_left, R.id.widget_spesa_est, R.id.widget_spesa_real },
        { R.id.widget_svago_label, R.id.widget_svago_left, R.id.widget_svago_est, R.id.widget_svago_real },
        { R.id.widget_carburante_label, R.id.widget_carburante_left, R.id.widget_carburante_est, R.id.widget_carburante_real },
    };

    @Override public void onUpdate(final Context c, final AppWidgetManager m, final int[] ids) {
        paint(c, m, ids, WidgetData.cached(c)); // subito l'ultimo dato noto, poi si aggiorna
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override public void run() {
                try { paint(c, m, ids, WidgetData.fetch(c)); } finally { pending.finish(); }
            }
        }).start();
    }

    /** Rilegge i dati dal server e ridisegna tutti i widget presenti sulla Home. */
    static void refreshAll(final Context context) {
        final Context c = context.getApplicationContext();
        final AppWidgetManager m = AppWidgetManager.getInstance(c);
        final int[] ids = m.getAppWidgetIds(new ComponentName(c, MyBankWidget.class));
        if (ids.length == 0) return;
        new Thread(new Runnable() {
            @Override public void run() { paint(c, m, ids, WidgetData.fetch(c)); }
        }).start();
    }

    // ------------------------------------------------------------------ testi

    private static String money(double v) {
        if (Math.abs(v) >= 1000) return NumberFormat.getIntegerInstance(Locale.ITALY).format(Math.round(v)) + " €";
        return NumberFormat.getCurrencyInstance(Locale.ITALY).format(v);
    }

    private static String perDay(double v) { return String.format(Locale.ITALY, "%.1f", v); }

    /** «AGG. 14:02» se è di oggi, «AGG. 11 OTT 14:02» altrimenti. */
    static String updated(String iso) {
        if (iso == null || iso.isEmpty()) return "NESSUN AGG.";
        try {
            ZonedDateTime t = ZonedDateTime.ofInstant(Instant.parse(iso), ZoneId.systemDefault());
            boolean today = t.toLocalDate().equals(LocalDate.now());
            String when = today ? t.format(DateTimeFormatter.ofPattern("HH:mm")) : t.format(DateTimeFormatter.ofPattern("d MMM HH:mm", Locale.ITALY)).replace(".", "");
            return ("AGG. " + when).toUpperCase(Locale.ITALY);
        } catch (Exception e) { return "NESSUN AGG."; }
    }

    // ------------------------------------------------------------------ barra del mese

    /** La barra: sfondo scuro, riempita fino a oggi (con l'ora), una tacca rossa a fine di ogni domenica. */
    static Bitmap monthBar() {
        final int w = 360, h = 24;
        Calendar now = Calendar.getInstance();
        int day = now.get(Calendar.DAY_OF_MONTH);
        int days = now.getActualMaximum(Calendar.DAY_OF_MONTH);
        double progress = (day - 1 + (now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)) / 1440.0) / days;
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint();
        p.setColor(TRACK);
        g.drawRect(0, 0, w, h, p);
        p.setColor(PAPER);
        g.drawRect(0, 0, (float) (w * progress), h, p);
        p.setColor(RED);
        Calendar d = (Calendar) now.clone();
        for (int i = 1; i < days; i++) { // l'ultimo giorno è il bordo della barra
            d.set(Calendar.DAY_OF_MONTH, i);
            if (d.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
                float x = (float) w * i / days;
                g.drawRect(x - 2, 0, x + 1, h, p);
            }
        }
        return b;
    }

    // ------------------------------------------------------------------ disegno

    static void paint(Context c, AppWidgetManager m, int[] ids, WidgetData d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_mybank);
        Calendar now = Calendar.getInstance();
        int daysLeft = now.getActualMaximum(Calendar.DAY_OF_MONTH) - now.get(Calendar.DAY_OF_MONTH);
        v.setImageViewBitmap(R.id.widget_bar, monthBar());
        v.setTextViewText(R.id.widget_days, daysLeft + " gg");
        v.setTextViewText(R.id.widget_updated, d.needLogin ? "ACCEDI NELL'APP" : updated(d.lastSync));

        for (int i = 0; i < WidgetData.KEYS.length; i++) {
            int[] id = IDS[i];
            boolean has = d.ok && d.budget[i] > 0;
            if (!d.ok) {
                v.setTextViewText(id[1], "—");
                v.setTextViewText(id[2], "stima —");
                v.setTextViewText(id[3], "reale —");
                v.setTextColor(id[1], PAPER);
                v.setTextColor(id[3], MUTE);
                continue;
            }
            v.setTextViewText(id[1], has ? money(d.left[i]) : "—");
            v.setTextColor(id[1], has && d.left[i] < 0 ? LATE : PAPER);
            v.setTextViewText(id[2], has ? "stima " + perDay(d.est[i]) + "/g" : "nessun budget");
            v.setTextViewText(id[3], "reale " + perDay(d.real[i]) + "/g");
            v.setTextColor(id[3], !has ? MUTE : d.real[i] <= d.est[i] ? OK : LATE);
        }

        Intent open = new Intent(c, MainActivity.class);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        m.updateAppWidget(ids, v);
    }
}
