package app.bilancio.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.Iterator;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Il mese in corso, dal primo del mese, letto dal server (/api/grid): quanto resta da pagare e le uscite di spesa, carburante e svago.
 * Le stesse cifre delle colonne della Panoramica; le usa il widget «Questo mese».
 */
final class Month {
    static final String[] NAMES = { "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre" };

    boolean ok;          // dati letti dal server
    boolean needLogin;   // sessione scaduta o mai fatta
    int year;
    int month;           // 1-12
    double toPay;        // voci non ancora pagate dal primo del mese in poi
    int toPayCount;
    double spese;
    double carburante;
    double svago;
    double budgetSpese;       // budget mensile (Impostazioni → Budget di spesa); 0 = nessun budget
    double budgetCarburante;
    double budgetSvago;
    long at;

    static int currentYear() { return Calendar.getInstance().get(Calendar.YEAR); }
    static int currentMonth() { return Calendar.getInstance().get(Calendar.MONTH) + 1; }

    private static double amount(JSONObject cells, String id) {
        JSONObject cell = cells.optJSONObject(id);
        return cell == null || cell.isNull("amount") ? 0 : cell.optDouble("amount", 0);
    }

    static Month fetch(Context c) {
        Month m = new Month();
        m.year = currentYear();
        m.month = currentMonth();
        try {
            Server.Reply r = Server.get(c, "/api/grid?year=" + m.year);
            if (r.status == 401) { m.needLogin = true; return m; }
            if (r.status != 200) return m;
            JSONObject grid = new JSONObject(new String(r.body, StandardCharsets.UTF_8));
            JSONArray rows = grid.getJSONArray("rows");
            JSONObject budgets = grid.optJSONObject("budgets"); // assente se il server non ha ancora i budget
            if (budgets != null) {
                m.budgetSpese = budgets.optDouble("spese", 0);
                m.budgetCarburante = budgets.optDouble("carburante", 0);
                m.budgetSvago = budgets.optDouble("svago", 0);
            }

            // Da pagare: le voci non pagate dal primo del mese in poi (paid è null per ciò che non si paga: spesa, svago…).
            for (int i = m.month - 1; i < rows.length(); i++) {
                JSONObject cells = rows.getJSONObject(i).getJSONObject("cells");
                for (Iterator<String> it = cells.keys(); it.hasNext(); ) {
                    JSONArray parts = cells.getJSONObject(it.next()).optJSONArray("parts");
                    if (parts == null) continue;
                    for (int k = 0; k < parts.length(); k++) {
                        JSONObject p = parts.getJSONObject(k);
                        if (p.isNull("paid") || p.getBoolean("paid")) continue;
                        m.toPay += p.getDouble("amount");
                        m.toPayCount++;
                    }
                }
            }

            JSONObject now = rows.getJSONObject(m.month - 1).getJSONObject("cells");
            m.spese = amount(now, "spese");
            m.carburante = amount(now, "carburante");
            m.svago = amount(now, "svago");
            m.ok = true;
            m.at = System.currentTimeMillis();
        } catch (Exception e) {
            m.ok = false;
        }
        return m;
    }

    // ------------------------------------------------------------------ ultima lettura (per mostrare subito qualcosa)

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("mese", Context.MODE_PRIVATE); }

    void save(Context c) {
        try {
            JSONObject o = new JSONObject();
            o.put("year", year);
            o.put("month", month);
            o.put("toPay", toPay);
            o.put("toPayCount", toPayCount);
            o.put("spese", spese);
            o.put("carburante", carburante);
            o.put("svago", svago);
            o.put("budgetSpese", budgetSpese);
            o.put("budgetCarburante", budgetCarburante);
            o.put("budgetSvago", budgetSvago);
            o.put("at", at);
            prefs(c).edit().putString("ultima", o.toString()).apply();
        } catch (Exception e) { /* senza cache */ }
    }

    /** L'ultima lettura, ma solo se è dello stesso mese: i numeri di un mese passato non vanno mostrati come quelli di questo. */
    static Month cached(Context c) {
        Month m = new Month();
        m.year = currentYear();
        m.month = currentMonth();
        try {
            JSONObject o = new JSONObject(prefs(c).getString("ultima", "{}"));
            if (o.optInt("year") != m.year || o.optInt("month") != m.month) return m;
            m.toPay = o.getDouble("toPay");
            m.toPayCount = o.getInt("toPayCount");
            m.spese = o.getDouble("spese");
            m.carburante = o.getDouble("carburante");
            m.svago = o.getDouble("svago");
            m.budgetSpese = o.optDouble("budgetSpese", 0);
            m.budgetCarburante = o.optDouble("budgetCarburante", 0);
            m.budgetSvago = o.optDouble("budgetSvago", 0);
            m.at = o.getLong("at");
            m.ok = true;
        } catch (Exception e) { /* nessuna lettura precedente */ }
        return m;
    }
}
