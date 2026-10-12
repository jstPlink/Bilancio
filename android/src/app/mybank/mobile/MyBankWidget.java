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
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
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
 * Widget 5×1 in quattro celle di uguale larghezza, ognuna con una barra verticale a sinistra. La prima:
 * i giorni che restano alla fine del mese e l'ora dell'ultimo aggiornamento delle banche (la barra del mese sale dal basso con i giorni trascorsi,
 * in bianco, e ha un vuoto a fine di ogni domenica). Le barre delle categorie si svuotano dall'alto verso il basso.
 * Le altre tre, Spesa, Svago e Carburante: il nome, il residuo del budget (budget meno speso nel mese; la barra è il residuo), la spesa
 * giornaliera stimata (budget diviso i giorni del mese) e quella reale (speso diviso i giorni passati, oggi compreso), verde se è pari o migliore della stima, rossa se
 * peggiore. Un tocco sulla prima cella apre il Budget; su Spesa, Svago o Carburante apre i Movimenti del mese già filtrati per quella categoria; sul resto apre l'app.
 * Un solo carattere (sans-serif) e gli stessi colori dell'app: carta e inchiostro con il rosso come accento.
 */
public class MyBankWidget extends AppWidgetProvider {
    private static final int INK = 0xFF131211, PAPER = 0xFFF3F0EA, MUTE = 0xFFA8A298, TRACK = 0xFF3A3733, LATE = 0xFFFF5A2E;
    private static final String[] KEYS = WidgetData.KEYS;
    private static final int[] CELLS = { R.id.widget_spesa_cell, R.id.widget_svago_cell, R.id.widget_carburante_cell };
    private static final int[] BARS = { R.id.widget_spesa_bar, R.id.widget_svago_bar, R.id.widget_carburante_bar };
    // per ogni categoria: valore, stima, reale
    private static final int[][] IDS = {
        { R.id.widget_spesa_left, R.id.widget_spesa_est, R.id.widget_spesa_real },
        { R.id.widget_svago_left, R.id.widget_svago_est, R.id.widget_svago_real },
        { R.id.widget_carburante_left, R.id.widget_carburante_est, R.id.widget_carburante_real },
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

    /** «aggiornamento» e sotto «22.45» se è di oggi, «11 ott 22.45» altrimenti (su due righe: la cella è stretta). */
    static String updated(String iso) {
        if (iso == null || iso.isEmpty()) return "nessun\naggiornamento";
        try {
            ZonedDateTime t = ZonedDateTime.ofInstant(Instant.parse(iso), ZoneId.systemDefault());
            boolean today = t.toLocalDate().equals(LocalDate.now());
            String hour = t.format(DateTimeFormatter.ofPattern("HH.mm"));
            return "aggiornamento\n" + (today ? hour : t.format(DateTimeFormatter.ofPattern("d MMM", Locale.ITALY)).replace(".", "") + " " + hour);
        } catch (Exception e) { return "nessun\naggiornamento"; }
    }

    /** «19 giorni» e sotto «rimanenti»; «1 giorno» e «rimanente»; l'ultimo giorno del mese «ultimo» e «giorno». */
    static String daysLeftText(int n) {
        if (n <= 0) return "ultimo\ngiorno";
        return n == 1 ? "1 giorno\nrimanente" : n + " giorni\nrimanenti";
    }

    // ------------------------------------------------------------------ barre

    private static Paint clearPaint() {
        Paint p = new Paint();
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        return p;
    }

    /**
     * La barra del mese, verticale: il tempo che passa. I giorni già trascorsi stanno in basso, in bianco, e salgono man mano che il mese
     * avanza; quelli che restano sono in alto, scuri. A fine di ogni domenica un vuoto, senza righe colorate.
     */
    static Bitmap monthBar() {
        final int w = 16, h = 360;
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
        g.drawRect(0, (float) (h * (1 - progress)), w, h, p); // il già trascorso, dal basso
        Paint gap = clearPaint();
        Calendar d = (Calendar) now.clone();
        for (int i = 1; i < days; i++) { // l'ultimo giorno è il bordo della barra
            d.set(Calendar.DAY_OF_MONTH, i);
            if (d.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
                float y = (float) (h * (1 - (double) i / days)); // il primo giorno del mese è in basso
                g.drawRect(0, y - 3, w, y + 3, gap); // un vuoto: si vede lo sfondo del widget
            }
        }
        return b;
    }

    /**
     * La barra di una categoria, verticale: quanto resta del budget. Si svuota dall'alto verso il basso man mano che si spende; rossa quando
     * resta il 20% o meno. Tre tacche (vuoti sottili) al 25%, 50% e 75% dell'altezza per leggere meglio lo stato.
     */
    static Bitmap leftBar(double ratio, boolean low) {
        final int w = 16, h = 240;
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas g = new Canvas(b);
        Paint p = new Paint();
        p.setColor(TRACK);
        g.drawRect(0, 0, w, h, p);
        p.setColor(low ? LATE : PAPER);
        float fill = (float) (h * Math.max(0, Math.min(1, ratio)));
        g.drawRect(0, h - fill, w, h, p);
        Paint tick = clearPaint();
        for (int quarter = 1; quarter <= 3; quarter++) {
            float y = h * quarter / 4f;
            g.drawRect(0, y - 1.5f, w, y + 1.5f, tick);
        }
        return b;
    }

    // ------------------------------------------------------------------ disegno

    private static PendingIntent tap(Context c, int code, String open) {
        Intent i = new Intent(c, MainActivity.class).putExtra("open", open);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void paint(Context c, AppWidgetManager m, int[] ids, WidgetData d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_mybank);
        Calendar now = Calendar.getInstance();
        int daysLeft = now.getActualMaximum(Calendar.DAY_OF_MONTH) - now.get(Calendar.DAY_OF_MONTH);
        v.setImageViewBitmap(R.id.widget_bar, monthBar());
        v.setTextViewText(R.id.widget_days, daysLeftText(daysLeft));
        v.setTextViewText(R.id.widget_updated, d.needLogin ? "accedi\nin app" : updated(d.lastSync));

        for (int i = 0; i < KEYS.length; i++) {
            int[] id = IDS[i];
            boolean has = d.ok && d.budget[i] > 0;
            double ratio = has ? d.left[i] / d.budget[i] : 0;
            v.setImageViewBitmap(BARS[i], leftBar(ratio, has && ratio <= 0.2));
            if (!d.ok) {
                v.setTextViewText(id[0], "—");
                v.setTextViewText(id[1], "stima —");
                v.setTextViewText(id[2], "reale —");
                v.setTextColor(id[0], PAPER);
                v.setTextColor(id[2], MUTE);
            } else {
                v.setTextViewText(id[0], has ? money(d.left[i]) : "—");
                v.setTextColor(id[0], has && d.left[i] < 0 ? LATE : PAPER);
                v.setTextViewText(id[1], has ? "stima " + perDay(d.est[i]) + "/g" : "nessun budget");
                v.setTextViewText(id[2], "reale " + perDay(d.real[i]) + "/g");
                v.setTextColor(id[2], !has ? MUTE : d.real[i] <= d.est[i] ? PAPER : LATE); // migliore della stima: bianco; peggiore: rosso
            }
            // un tocco apre i Movimenti del mese filtrati per questa categoria
            v.setOnClickPendingIntent(CELLS[i], tap(c, 10 + i, "movimenti:" + KEYS[i]));
        }

        v.setOnClickPendingIntent(R.id.widget_root, tap(c, 1, "storico"));
        v.setOnClickPendingIntent(R.id.widget_month_cell, tap(c, 2, "budget")); // la prima cella apre il Budget
        m.updateAppWidget(ids, v);
        if (d.ok) updatePreview(c, m, v);
    }

    /**
     * Anteprima «vera» nella lista dei widget (Android 15 e successivi): l'ultimo aspetto con i dati reali. Prima di Android 15 vale
     * l'anteprima statica con dati di esempio (previewLayout). Il sistema limita le richieste: al massimo una l'ora e senza errori.
     */
    private static void updatePreview(Context c, AppWidgetManager m, RemoteViews v) {
        if (android.os.Build.VERSION.SDK_INT < 35) return;
        android.content.SharedPreferences p = c.getSharedPreferences("anteprima", Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (now - p.getLong("quando", 0) < 3600000L) return;
        try {
            m.setWidgetPreview(new ComponentName(c, MyBankWidget.class), android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN, v);
            p.edit().putLong("quando", now).apply();
        } catch (Throwable e) { /* limite di richieste o non supportato: resta l'anteprima statica */ }
    }
}
