package app.mybank.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Suona una notifica: la mostra e programma la successiva. Dopo il riavvio del telefono o un aggiornamento dell'app riprogramma tutto. */
public class NotifyReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("app.mybank.mobile.NOTIFICA".equals(action)) {
            String id = intent.getStringExtra("id"), text = intent.getStringExtra("text");
            if (id != null && text != null) Notifier.show(context, id, text);
        }
        // in ogni caso (notifica suonata, avvio del telefono, aggiornamento dell'app) si programma la prossima volta di ognuna
        Notifier.schedule(context);
    }
}
