package app.bilancio.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Le cose da pagare, lette dal server (/api/grid): le stesse voci rosse della Panoramica. Le usano il widget e la notifica. */
final class Due {
    private static final String[] MONTHS = { "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic" };

    boolean ok;          // dati letti dal server
    boolean needLogin;   // sessione scaduta o mai fatta
    double total;
    int count;
    List<String> lines = new ArrayList<>();
    long at;

    static String money(double v) { return NumberFormat.getCurrencyInstance(Locale.ITALY).format(v); }

    private static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1); }

    static Due fetch(Context c) {
        Due d = new Due();
        try {
            int year = Calendar.getInstance().get(Calendar.YEAR);
            Server.Reply first = Server.get(c, "/api/grid?year=" + year);
            if (first.status == 401) { d.needLogin = true; return d; }
            if (first.status != 200) return d;
            JSONObject now = new JSONObject(new String(first.body, StandardCharsets.UTF_8));
            d.total = now.getJSONObject("summary").optDouble("totalToPay", 0);

            // Le voci da pagare possono stare in più anni: si leggono tutti quelli con dati.
            List<Integer> years = new ArrayList<>();
            JSONArray ys = now.optJSONArray("years");
            if (ys != null) for (int i = 0; i < ys.length(); i++) years.add(ys.getInt(i));
            if (!years.contains(year)) years.add(year);
            java.util.Collections.sort(years);

            for (int y : years) {
                JSONObject grid = y == year ? now : null;
                if (grid == null) {
                    Server.Reply r = Server.get(c, "/api/grid?year=" + y);
                    if (r.status != 200) return d;
                    grid = new JSONObject(new String(r.body, StandardCharsets.UTF_8));
                }
                JSONArray rows = grid.getJSONArray("rows");
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject row = rows.getJSONObject(i);
                    JSONObject cells = row.getJSONObject("cells");
                    for (java.util.Iterator<String> it = cells.keys(); it.hasNext(); ) {
                        JSONArray parts = cells.getJSONObject(it.next()).optJSONArray("parts");
                        if (parts == null) continue;
                        for (int k = 0; k < parts.length(); k++) {
                            JSONObject p = parts.getJSONObject(k);
                            // paid è null per le voci che non si pagano (spesa, svago…): contano solo quelle esplicitamente da pagare.
                            if (p.isNull("paid") || p.getBoolean("paid")) continue;
                            String place = p.optString("place", "");
                            String kind = cap(p.optString("kind"));
                            boolean withPlace = kind.equals("Luce") || kind.equals("Gas") || kind.equals("Acqua") || kind.equals("Wifi");
                            d.lines.add(kind + (withPlace && !place.isEmpty() ? " " + cap(place) : "") + " · " + MONTHS[row.getInt("month") - 1] + " " + y + " · " + money(p.getDouble("amount")));
                            d.count++;
                        }
                    }
                }
            }
            d.ok = true;
            d.at = System.currentTimeMillis();
        } catch (Exception e) {
            d.ok = false;
        }
        return d;
    }

    // ------------------------------------------------------------------ ultima lettura (per mostrare subito qualcosa)

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("scadenze", Context.MODE_PRIVATE); }

    void save(Context c) {
        try {
            JSONObject o = new JSONObject();
            o.put("total", total);
            o.put("count", count);
            o.put("at", at);
            o.put("lines", new JSONArray(lines));
            prefs(c).edit().putString("ultima", o.toString()).apply();
        } catch (Exception e) { /* senza cache */ }
    }

    static Due cached(Context c) {
        Due d = new Due();
        try {
            JSONObject o = new JSONObject(prefs(c).getString("ultima", "{}"));
            if (!o.has("lines")) return d;
            d.total = o.getDouble("total");
            d.count = o.getInt("count");
            d.at = o.getLong("at");
            JSONArray l = o.getJSONArray("lines");
            for (int i = 0; i < l.length(); i++) d.lines.add(l.getString(i));
            d.ok = true;
        } catch (Exception e) { /* nessuna lettura precedente */ }
        return d;
    }
}
