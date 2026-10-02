package app.bilancio.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/**
 * Collegamento al server di casa: indirizzo (da assets/config.json, scritto in fase di build dal file .env) e sessione
 * (cookie del login). Lo usano la schermata dell'app, il widget e la notifica mensile, così condividono lo stesso accesso.
 */
final class Server {
    static class Reply {
        int status = 0;
        String reason = "OK";
        String mime = "application/octet-stream";
        Map<String, String> headers = new HashMap<>();
        byte[] body = new byte[0];
    }

    private static final Map<String, String> JAR = new LinkedHashMap<>();
    private static boolean jarLoaded = false;
    private static String base;
    private static String appVersion;

    private Server() {}

    private static synchronized void config(Context c) throws Exception {
        if (base != null) return;
        JSONObject cfg = new JSONObject(new String(readAll(c.getAssets().open("config.json")), StandardCharsets.UTF_8));
        base = cfg.getString("server").replaceAll("/+$", "");
        appVersion = cfg.getString("version");
    }

    static String version(Context c) throws Exception { config(c); return appVersion; }

    static byte[] readAll(InputStream in) throws Exception {
        if (in == null) return new byte[0];
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = i.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    // ------------------------------------------------------------------ sessione

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("sessione", Context.MODE_PRIVATE); }

    private static synchronized void loadJar(Context c) {
        if (jarLoaded) return;
        for (String part : prefs(c).getString("cookie", "").split("; ")) {
            int eq = part.indexOf('=');
            if (eq > 0) JAR.put(part.substring(0, eq), part.substring(eq + 1));
        }
        jarLoaded = true;
    }

    private static synchronized String cookieHeader(Context c) {
        loadJar(c);
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : JAR.entrySet()) {
            if (sb.length() > 0) sb.append("; ");
            sb.append(e.getKey()).append('=').append(e.getValue());
        }
        return sb.toString();
    }

    private static synchronized void storeCookies(Context c, List<String> setCookies) {
        if (setCookies == null) return;
        loadJar(c);
        for (String cookie : setCookies) {
            String[] attrs = cookie.split(";\\s*");
            int eq = attrs[0].indexOf('=');
            if (eq <= 0) continue;
            String name = attrs[0].substring(0, eq);
            String value = attrs[0].substring(eq + 1);
            boolean gone = value.isEmpty();
            for (String a : attrs) if (a.equalsIgnoreCase("Max-Age=0")) gone = true;
            if (gone) JAR.remove(name); else JAR.put(name, value);
        }
        prefs(c).edit().putString("cookie", cookieHeader(c)).apply();
    }

    // ------------------------------------------------------------------ richieste

    static Reply forward(Context c, String method, String pathAndQuery, Map<String, String> headers, byte[] body) {
        Reply r = new Reply();
        try {
            config(c);
            HttpURLConnection conn = (HttpURLConnection) new URL(base + pathAndQuery).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(600000); // la lettura dei documenti può durare minuti
            conn.setRequestMethod(method);
            for (Map.Entry<String, String> h : headers.entrySet()) {
                String k = h.getKey().toLowerCase();
                if (k.equals("content-type") || k.equals("accept")) conn.setRequestProperty(h.getKey(), h.getValue());
            }
            String cookie = cookieHeader(c);
            if (!cookie.isEmpty()) conn.setRequestProperty("Cookie", cookie);
            if (body != null && body.length > 0) {
                conn.setDoOutput(true);
                try (java.io.OutputStream o = conn.getOutputStream()) { o.write(body); }
            }
            r.status = conn.getResponseCode();
            String msg = conn.getResponseMessage();
            r.reason = msg == null || msg.isEmpty() ? "OK" : msg;
            r.body = readAll(r.status >= 400 ? conn.getErrorStream() : conn.getInputStream());
            Map<String, List<String>> fields = conn.getHeaderFields();
            storeCookies(c, fields.get("Set-Cookie"));
            for (Map.Entry<String, List<String>> e : fields.entrySet()) {
                if (e.getKey() == null || e.getValue().isEmpty()) continue;
                String k = e.getKey().toLowerCase();
                if (k.equals("content-type")) r.mime = e.getValue().get(0);
                else if (k.equals("content-disposition")) r.headers.put("Content-Disposition", e.getValue().get(0));
            }
            // Come il localhost collegato al server: la versione mostrata è quella dell'app, quella del server si legge a parte.
            if (pathAndQuery.startsWith("/api/version") && r.status == 200) {
                JSONObject info = new JSONObject(new String(r.body, StandardCharsets.UTF_8));
                info.put("serverVersion", info.optString("version"));
                info.put("version", appVersion);
                r.body = info.toString().getBytes(StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            r.status = 0;
            r.reason = String.valueOf(e.getMessage());
        }
        return r;
    }

    static Reply get(Context c, String pathAndQuery) {
        return forward(c, "GET", pathAndQuery, new HashMap<String, String>(), null);
    }
}
