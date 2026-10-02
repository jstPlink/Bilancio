package app.bilancio.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Riceve lo scatto di un promemoria (o il riavvio del telefono, per riprogrammarli tutti). */
public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (Reminders.ACTION.equals(intent.getAction())) Reminders.fire(context, String.valueOf(intent.getStringExtra("id")));
        else Reminders.scheduleAll(context);
    }
}
