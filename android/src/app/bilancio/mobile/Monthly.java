package app.bilancio.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.Calendar;

/** Ogni primo del mese alle 9 ricorda di pagare i conti in sospeso (se ce ne sono). Si riprogramma da solo. */
public class Monthly extends BroadcastReceiver {
    static final String ACTION = "app.bilancio.mobile.MONTHLY";
    private static final String CHANNEL = "scadenze";
    private static final int HOUR = 9;

    /** Programma il prossimo promemoria: il primo del mese alle 9, oppure oggi se è il primo e non sono ancora le 9. */
    static void schedule(Context context) {
        Context c = context.getApplicationContext();
        Calendar t = Calendar.getInstance();
        t.set(Calendar.DAY_OF_MONTH, 1);
        t.set(Calendar.HOUR_OF_DAY, HOUR);
        t.set(Calendar.MINUTE, 0);
        t.set(Calendar.SECOND, 0);
        t.set(Calendar.MILLISECOND, 0);
        if (t.getTimeInMillis() <= System.currentTimeMillis()) t.add(Calendar.MONTH, 1);
        Intent i = new Intent(c, Monthly.class).setAction(ACTION);
        PendingIntent pi = PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        c.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pi);
    }

    @Override public void onReceive(final Context context, Intent intent) {
        if (!ACTION.equals(intent.getAction())) { schedule(context); return; } // dopo un riavvio o un aggiornamento dell'app
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override public void run() {
                try { notifyDue(context); } finally { schedule(context); pending.finish(); }
            }
        }).start();
    }

    private static void notifyDue(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (!nm.areNotificationsEnabled()) return;
        Due d = Due.fetch(c);
        String title = "Conti da pagare";
        String text;
        if (d.ok) {
            if (d.count == 0) return; // niente in sospeso: nessuna notifica
            d.save(c);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < Math.min(6, d.lines.size()); i++) sb.append(i > 0 ? "\n" : "").append(d.lines.get(i));
            if (d.lines.size() > 6) sb.append("\n… e altre ").append(d.lines.size() - 6);
            title = (d.count == 1 ? "1 conto da pagare" : d.count + " conti da pagare") + " · " + Due.money(d.total);
            text = sb.toString();
        } else if (d.needLogin) {
            text = "Apri Bilancio e accedi per vedere cosa c'è da pagare.";
        } else {
            text = "È il primo del mese: controlla in Bilancio i conti ancora da pagare.";
        }
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Scadenze", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle(title)
            .setContentText(text.split("\n")[0])
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build();
        nm.notify(1, n);
    }
}
