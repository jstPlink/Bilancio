package app.bilancio.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Saldo e ultimo movimento di una banca (Revolut), letti dal server (/api/banking/widget). Il server risponde con l'ULTIMA copia letta dalla
 * banca: non chiama mai la banca, quindi il dato non è in tempo reale e porta con sé l'ora dell'ultima lettura.
 */
final class BankData {
    boolean ok;           // risposta del server letta
    boolean needLogin;
    boolean connected;    // banca collegata
    boolean empty;        // collegata ma mai letta
    boolean hasTotal;
    double total;
    String fetchedAt = "";
    int pending;
    boolean hasLast;
    double lastAmount;
    String lastName = "";
    boolean lastPending;

    static BankData fetch(Context c, String bank) {
        BankData d = new BankData();
        try {
            Server.Reply r = Server.get(c, "/api/banking/widget?bank=" + bank);
            if (r.status == 401) { d.needLogin = true; return d; }
            if (r.status != 200) return d;
            d.parse(new JSONObject(new String(r.body, StandardCharsets.UTF_8)));
            d.ok = true;
        } catch (Exception e) {
            d.ok = false;
        }
        return d;
    }

    private void parse(JSONObject o) {
        connected = o.optBoolean("connected");
        empty = o.optBoolean("empty");
        if (!o.isNull("total") && o.has("total")) { hasTotal = true; total = o.optDouble("total"); }
        fetchedAt = o.optString("fetchedAt", "");
        pending = o.optInt("pending");
        JSONArray recent = o.optJSONArray("recent");
        if (recent != null && recent.length() > 0) {
            JSONObject t = recent.optJSONObject(0);
            if (t != null && !t.isNull("amount")) {
                hasLast = true;
                lastAmount = t.optDouble("amount");
                lastName = t.optString("name", "");
                lastPending = "PDNG".equals(t.optString("status"));
            }
        }
    }

    /** «3 ott 10:32» (ora del telefono) dell'ultima lettura dalla banca, o «mai». */
    String when() {
        try {
            java.time.ZonedDateTime t = java.time.Instant.parse(fetchedAt).atZone(java.time.ZoneId.systemDefault());
            return t.format(java.time.format.DateTimeFormatter.ofPattern("d MMM HH:mm", java.util.Locale.ITALY));
        } catch (Exception e) {
            return "mai";
        }
    }

    // ------------------------------------------------------------------ ultima lettura (per mostrare subito qualcosa)

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("banca", Context.MODE_PRIVATE); }

    void save(Context c, String bank) {
        try {
            JSONObject o = new JSONObject();
            o.put("connected", connected);
            o.put("empty", empty);
            if (hasTotal) o.put("total", total);
            o.put("fetchedAt", fetchedAt);
            o.put("pending", pending);
            if (hasLast) {
                JSONObject t = new JSONObject();
                t.put("amount", lastAmount);
                t.put("name", lastName);
                t.put("status", lastPending ? "PDNG" : "BOOK");
                o.put("recent", new JSONArray().put(t));
            }
            prefs(c).edit().putString(bank, o.toString()).apply();
        } catch (Exception e) { /* senza cache */ }
    }

    static BankData cached(Context c, String bank) {
        BankData d = new BankData();
        try {
            d.parse(new JSONObject(prefs(c).getString(bank, "{}")));
            d.ok = d.connected;
        } catch (Exception e) { /* nessuna lettura precedente */ }
        return d;
    }
}
