package app.mybank.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Collegamento al server di MyBank: indirizzo (da assets/config.json, scritto in fase di build dal file .env; se manca, quello scelto
 * dall'utente alla prima apertura) e gettone di accesso (che la pagina web consegna dopo il login). Lo usano la schermata dell'app e il widget.
 */
final class Server {
    private static String embedded;
    private static String appVersion;

    private Server() {}

    private static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences("mybank", Context.MODE_PRIVATE); }

    private static synchronized void config(Context c) throws Exception {
        if (appVersion != null) return;
        JSONObject cfg = new JSONObject(new String(readAll(c.getAssets().open("config.json")), StandardCharsets.UTF_8));
        embedded = cfg.optString("server", "").replaceAll("/+$", "");
        appVersion = cfg.getString("version");
    }

    /** Indirizzo del server: quello della build (se c'è) oppure quello scelto dall'utente; vuoto se non è ancora stato scelto. */
    static String baseUrl(Context c) {
        try { config(c); } catch (Exception e) { return ""; }
        return embedded.isEmpty() ? prefs(c).getString("server", "") : embedded;
    }

    static boolean hasEmbedded(Context c) { baseUrl(c); return embedded != null && !embedded.isEmpty(); }

    static String version(Context c) { try { config(c); return appVersion; } catch (Exception e) { return ""; } }

    /** Ripulisce l'indirizzo scritto dall'utente: https, oppure http solo per la rete di casa; null se non è valido. */
    static String cleanAddress(String raw) {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty()) return null;
        if (!s.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) s = (looksLocal(s) ? "http://" : "https://") + s;
        s = s.replaceAll("/+$", "");
        try {
            URL u = new URL(s);
            if (u.getHost().isEmpty()) return null;
            boolean https = "https".equalsIgnoreCase(u.getProtocol());
            if (!https && !("http".equalsIgnoreCase(u.getProtocol()) && looksLocal(u.getHost()))) return null;
            return s;
        } catch (Exception e) { return null; }
    }

    private static boolean looksLocal(String host) {
        String h = host.replaceAll("^(?i)https?://", "").replaceAll("[:/].*$", "");
        return h.equals("localhost") || h.endsWith(".local") || h.matches("10\\..*|192\\.168\\..*|172\\.(1[6-9]|2[0-9]|3[01])\\..*");
    }

    static void saveServer(Context c, String address) { prefs(c).edit().putString("server", address).putString("token", "").apply(); }

    static void saveToken(Context c, String token) { prefs(c).edit().putString("token", token == null ? "" : token).apply(); }

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

    /** Risposta del server: stato HTTP (0 se non raggiungibile) e corpo. */
    static final class Reply {
        int status = 0;
        String body = "";
    }

    static Reply get(Context c, String path) {
        Reply r = new Reply();
        try {
            String base = baseUrl(c);
            if (base.isEmpty()) return r;
            HttpURLConnection conn = (HttpURLConnection) new URL(base + path).openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(20000);
            conn.setRequestProperty("Accept", "application/json");
            String token = prefs(c).getString("token", "");
            if (!token.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + token);
            r.status = conn.getResponseCode();
            r.body = new String(readAll(r.status >= 400 ? conn.getErrorStream() : conn.getInputStream()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            r.status = 0;
        }
        return r;
    }
}
