package app.mybank.mobile;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Le notifiche (promemoria) scelte nelle Opzioni: testo, giorno del mese e orario stanno sul server (/api/notifications). Qui si leggono,
 * si ricordano sul telefono e si programmano con l'AlarmManager (la prossima volta di ognuna); quando suona una, il ricevitore la mostra e
 * programma la successiva. Nei mesi più corti il giorno 29, 30 o 31 vale l'ultimo giorno del mese.
 */
final class Notifier {
    static final String CHANNEL = "promemoria";
    private static final String PREFS = "notifiche";

    private Notifier() {}

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Rilegge l'elenco dal server (se risponde) e riprogramma tutto. Da chiamare fuori dal thread principale. */
    static void sync(Context context) {
        Context c = context.getApplicationContext();
        Server.Reply r = Server.get(c, "/api/notifications");
        if (r.status == 200) {
            try {
                new JSONObject(r.body).getJSONArray("notifications"); // solo se la risposta è valida si sostituisce l'elenco
                prefs(c).edit().putString("json", r.body).apply();
            } catch (Exception e) { /* si tiene l'ultimo elenco noto */ }
        }
        schedule(c);
    }

    static void syncAsync(final Context context) {
        new Thread(new Runnable() { @Override public void run() { try { sync(context); } catch (Exception e) { /* riproverà alla prossima apertura */ } } }).start();
    }

    /** La prossima volta in cui suona una notifica col giorno e l'orario dati (ora del telefono), dopo `from`. */
    static ZonedDateTime next(int day, int hour, int minute, ZonedDateTime from) {
        LocalDate month = from.toLocalDate().withDayOfMonth(1);
        for (int i = 0; i < 3; i++) {
            int d = Math.min(day, month.lengthOfMonth());
            ZonedDateTime at = month.withDayOfMonth(d).atTime(hour, minute).atZone(from.getZone());
            if (at.isAfter(from)) return at;
            month = month.plusMonths(1);
        }
        return from.plusMonths(1);
    }

    private static PendingIntent intent(Context c, String id, String text) {
        Intent i = new Intent(c, NotifyReceiver.class).setAction("app.mybank.mobile.NOTIFICA").setData(android.net.Uri.parse("mybank://notifica/" + id));
        i.putExtra("id", id).putExtra("text", text);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Programma la prossima volta di ogni notifica dell'elenco e toglie quelle che non ci sono più. */
    static synchronized void schedule(Context context) {
        Context c = context.getApplicationContext();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = prefs(c);
        Set<String> old = new HashSet<>(p.getStringSet("ids", new HashSet<String>()));
        Set<String> now = new HashSet<>();
        try {
            JSONArray list = new JSONObject(p.getString("json", "{\"notifications\":[]}")).getJSONArray("notifications");
            ZonedDateTime from = ZonedDateTime.now(ZoneId.systemDefault());
            for (int i = 0; i < list.length(); i++) {
                JSONObject n = list.getJSONObject(i);
                String id = n.getString("id");
                String[] t = n.getString("time").split(":");
                ZonedDateTime at = next(n.getInt("day"), Integer.parseInt(t[0]), Integer.parseInt(t[1]), from);
                PendingIntent pi = intent(c, id, n.getString("text"));
                long ms = at.toInstant().toEpochMilli();
                if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi); // senza il permesso per le sveglie precise: qualche minuto di tolleranza
                now.add(id);
            }
        } catch (Exception e) { /* elenco illeggibile: non si programma nulla di nuovo */ return; }
        for (String id : old) if (!now.contains(id)) am.cancel(intent(c, id, ""));
        p.edit().putStringSet("ids", now).apply();
    }

    /** Mostra la notifica (il canale si crea la prima volta). */
    static void show(Context c, String id, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Promemoria", NotificationManager.IMPORTANCE_HIGH));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        android.app.Notification n = new android.app.Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify).setContentTitle("MyBank").setContentText(text)
            .setStyle(new android.app.Notification.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true).build();
        nm.notify(id.hashCode(), n);
    }
}
