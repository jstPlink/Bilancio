package app.bilancio.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Promemoria personalizzati («controlla l'addebito del mutuo»): si impostano nelle Impostazioni dell'app, con una ricorrenza
 * (ogni giorno, settimana, mese o anno) e un orario. Restano sul telefono e sono programmati con la sveglia di sistema.
 *
 * Ogni promemoria: { id, title, repeat: daily|weekly|monthly|yearly, day, month, hour, minute, enabled }
 * day: 1–7 (lunedì–domenica) per «ogni settimana», 1–31 per «ogni mese» e «ogni anno»; month: 1–12 per «ogni anno».
 */
final class Reminders {
    static final String ACTION = "app.bilancio.mobile.REMINDER";
    private static final String CHANNEL = "promemoria";

    private Reminders() {}

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("promemoria", Context.MODE_PRIVATE); }

    private static JSONArray stored(Context c) {
        try { return new JSONArray(prefs(c).getString("lista", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** L'elenco per l'interfaccia, ognuno con il prossimo scatto (millisecondi, 0 se disattivato). */
    static String listJson(Context c) {
        JSONArray out = new JSONArray();
        long now = System.currentTimeMillis();
        JSONArray list = stored(c);
        for (int i = 0; i < list.length(); i++) {
            try {
                JSONObject r = new JSONObject(list.getJSONObject(i).toString());
                r.put("next", r.optBoolean("enabled", true) ? next(r, now) : 0);
                out.put(r);
            } catch (Exception e) { /* voce illeggibile: saltata */ }
        }
        return out.toString();
    }

    /** Salva l'elenco ricevuto dall'interfaccia, annulla le vecchie sveglie e programma le nuove. */
    static void save(Context c, String json) throws Exception {
        JSONArray list = new JSONArray(json);
        for (int i = 0; i < list.length(); i++) validate(list.getJSONObject(i));
        cancelAll(c);
        prefs(c).edit().putString("lista", list.toString()).apply();
        scheduleAll(c);
    }

    private static void validate(JSONObject r) throws Exception {
        if (r.optString("id").isEmpty()) throw new Exception("promemoria senza id");
        if (r.optString("title").trim().isEmpty()) throw new Exception("scrivi cosa controllare");
        String rep = r.optString("repeat");
        if (!(rep.equals("daily") || rep.equals("weekly") || rep.equals("monthly") || rep.equals("yearly"))) throw new Exception("ricorrenza non valida");
        int h = r.optInt("hour", -1);
        int m = r.optInt("minute", -1);
        if (h < 0 || h > 23 || m < 0 || m > 59) throw new Exception("ora non valida");
        int d = r.optInt("day", 0);
        if (rep.equals("weekly") && (d < 1 || d > 7)) throw new Exception("giorno della settimana non valido");
        if ((rep.equals("monthly") || rep.equals("yearly")) && (d < 1 || d > 31)) throw new Exception("giorno non valido");
        if (rep.equals("yearly") && (r.optInt("month", 0) < 1 || r.optInt("month", 0) > 12)) throw new Exception("mese non valido");
    }

    // ------------------------------------------------------------------ sveglie

    private static PendingIntent pending(Context c, String id) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION).setData(Uri.parse("promemoria://" + id)).putExtra("id", id);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void cancelAll(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        JSONArray list = stored(c);
        for (int i = 0; i < list.length(); i++) am.cancel(pending(c, list.optJSONObject(i).optString("id")));
    }

    /** Programma tutti i promemoria attivi (all'avvio dell'app e dopo un riavvio del telefono). */
    static void scheduleAll(Context c) {
        JSONArray list = stored(c);
        for (int i = 0; i < list.length(); i++) schedule(c, list.optJSONObject(i));
    }

    static void schedule(Context c, JSONObject r) {
        if (r == null || !r.optBoolean("enabled", true)) return;
        long at = next(r, System.currentTimeMillis());
        if (at <= 0) return;
        c.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, r.optString("id")));
    }

    // ------------------------------------------------------------------ calcolo del prossimo scatto

    /** Prossimo scatto dopo `now` (millisecondi), oppure 0 se la ricorrenza non è valida. */
    static long next(JSONObject r, long now) {
        return Recurrence.next(r.optString("repeat"), r.optInt("day", 1), r.optInt("month", 1), r.optInt("hour", 9), r.optInt("minute", 0), now);
    }

    // ------------------------------------------------------------------ notifica

    /** Scatta un promemoria: notifica con quello che c'è da controllare, poi programma il successivo. */
    static void fire(Context c, String id) {
        JSONArray list = stored(c);
        for (int i = 0; i < list.length(); i++) {
            JSONObject r = list.optJSONObject(i);
            if (r == null || !id.equals(r.optString("id"))) continue;
            if (r.optBoolean("enabled", true)) notify(c, r);
            schedule(c, r);
            return;
        }
    }

    private static void notify(Context c, JSONObject r) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (!nm.areNotificationsEnabled()) return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Promemoria", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(0xFF0F766E)
            .setContentTitle(r.optString("title"))
            .setContentText("Promemoria: controlla questo pagamento")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build();
        nm.notify(1000 + Math.abs(r.optString("id").hashCode() % 100000), n);
    }
}
