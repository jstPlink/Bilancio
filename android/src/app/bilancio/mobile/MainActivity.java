package app.bilancio.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Bilancio per Android: una WebView che mostra le pagine incluse nell'APK (cartella assets/www, cioè public/)
 * e inoltra al server di casa dati e login (tutto ciò che passa da /api/), come fa il localhost collegato al server.
 * L'indirizzo del server viene da assets/config.json, scritto in fase di build dal file .env (mai nel codice).
 */
public class MainActivity extends Activity {
    // Origine fittizia https: le richieste a questo host non escono mai, le gestisce l'app.
    private static final String HOST = "app.bilancio.local";
    private static final int PICK_FILE = 41;
    private static final int ASK_NOTIFICATIONS = 42;

    private WebView web;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private ValueCallback<Uri[]> chooser;
    private String shim;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            Server.version(this); // controlla che la configurazione ci sia
            shim = new String(Server.readAll(getAssets().open("shim.js")), StandardCharsets.UTF_8);
        } catch (Exception e) {
            Toast.makeText(this, "Configurazione mancante: " + e.getMessage(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        if (Server.needsServer(this)) { askServer(null); return; }
        start();
    }

    /** Alla prima apertura (build senza indirizzo incorporato) chiede l'indirizzo del server e controlla che risponda. */
    private void askServer(String problem) {
        final android.widget.EditText input = new android.widget.EditText(this);
        input.setHint("https://indirizzo-del-tuo-server");
        input.setSingleLine(true);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        android.widget.FrameLayout box = new android.widget.FrameLayout(this);
        box.setPadding(pad, pad / 2, pad, 0);
        box.addView(input);
        new android.app.AlertDialog.Builder(this)
            .setTitle("Indirizzo del server")
            .setMessage((problem == null ? "" : problem + "\n\n") + "Scrivi l'indirizzo https del tuo server Bilancio.")
            .setView(box)
            .setCancelable(false)
            .setPositiveButton("Collega", new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int w) { tryServer(input.getText().toString()); }
            })
            .setNegativeButton("Esci", new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int w) { finish(); }
            })
            .show();
    }

    private void tryServer(final String raw) {
        final String address = Server.cleanAddress(raw);
        if (address == null) { askServer("Indirizzo non valido: serve un indirizzo https."); return; }
        Server.saveServer(this, address);
        pool.execute(new Runnable() {
            @Override public void run() {
                final Server.Reply r = Server.get(MainActivity.this, "/api/version");
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (r.status == 200) { start(); return; }
                        Server.forgetServer(MainActivity.this);
                        askServer("Il server non risponde (" + (r.status == 0 ? r.reason : "errore " + r.status) + ").");
                    }
                });
            }
        });
    }

    private void start() {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int bg = night ? Color.parseColor("#0E1513") : Color.parseColor("#F4F6F5");
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        if (!night) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        web = new WebView(this);
        web.setBackgroundColor(bg);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(Intent.createChooser(i, "Scegli un file"), PICK_FILE); }
                catch (Exception e) { chooser = null; return false; }
                return true;
            }
        });
        web.loadUrl("https://" + HOST + "/" + hashOf(getIntent()));

        // Notifica del primo del mese: serve il permesso (Android 13+) e un promemoria programmato.
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, ASK_NOTIFICATIONS);
        }
        Monthly.schedule(this);
        Reminders.scheduleAll(this);
    }

    /** Dove aprire l'app quando arriva da un widget: «#moves/spesa» (Movimenti con quella categoria), «#overview», «#budget» o «#banks»; vuoto se è un avvio normale. */
    private static String hashOf(Intent i) {
        String open = i == null ? null : i.getStringExtra("open");
        if (open == null) return "";
        if ("overview".equals(open)) return "#overview";
        if ("budget".equals(open)) return "#budget";
        if ("banks".equals(open)) return "#banks";
        String cat = i.getStringExtra("cat");
        if ("moves".equals(open) && cat != null && cat.matches("[a-z]{1,20}")) return "#moves/" + cat;
        return "";
    }

    // L'app è già aperta (launchMode singleTask): un tocco sul widget arriva qui e porta la pagina dove serve.
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String hash = hashOf(intent);
        if (web == null || hash.isEmpty()) return;
        // Il numero in coda fa cambiare l'indirizzo anche se tocchi due volte lo stesso riquadro.
        web.evaluateJavascript("location.hash=" + JSONObject.quote(hash + "/" + System.currentTimeMillis()), null);
    }

    @Override protected void onResume() {
        super.onResume();
        // i widget si aggiornano ogni volta che apri l'app
        MonthWidget.refreshAll(this);
        BankWidget.refreshAll(this);
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == PICK_FILE && chooser != null) {
            chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            chooser = null;
        }
    }

    // Indietro: prima chiude un pannello aperto nella pagina (Impostazioni…), poi torna alla pagina precedente, infine esce.
    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(function(){return typeof window.__back==='function' && window.__back()===true;})()", new ValueCallback<String>() {
            @Override public void onReceiveValue(String handled) {
                if ("true".equals(handled)) return;
                if (web.canGoBack()) web.goBack(); else finish();
            }
        });
    }

    // ------------------------------------------------------------------ pagine incluse nell'app

    private WebResourceResponse toWebResponse(Server.Reply r) {
        if (r.status == 0 || (r.status >= 300 && r.status < 400)) {
            String msg = "{\"error\":\"Il server non risponde. Controlla la connessione.\"}";
            return new WebResourceResponse("application/json", "utf-8", 502, "Bad Gateway", new HashMap<String, String>(), new ByteArrayInputStream(msg.getBytes(StandardCharsets.UTF_8)));
        }
        String mime = r.mime.split(";")[0].trim();
        return new WebResourceResponse(mime, "utf-8", r.status, r.reason, r.headers, new ByteArrayInputStream(r.body));
    }

    private WebResourceResponse asset(String path) {
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        else if (path.equals("/login")) path = "/login.html";
        String name = path.substring(1);
        try {
            byte[] data = Server.readAll(getAssets().open("www/" + name));
            String mime = mimeOf(name);
            if (name.endsWith(".html")) {
                // Le richieste non-GET a /api/ passano dal codice nativo: lo script che le devia va in testa alla pagina.
                String html = new String(data, StandardCharsets.UTF_8).replaceFirst("<head>", "<head><script>" + java.util.regex.Matcher.quoteReplacement(shim) + "</script>");
                data = html.getBytes(StandardCharsets.UTF_8);
            }
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mime, "utf-8", 200, "OK", h, new ByteArrayInputStream(data));
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream("Non trovato".getBytes(StandardCharsets.UTF_8)));
        }
    }

    private static String mimeOf(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js")) return "text/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webmanifest") || name.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------------ apertura dei documenti

    private void openDocument(final String pathAndQuery) {
        pool.execute(new Runnable() {
            @Override public void run() {
                Server.Reply r = Server.get(MainActivity.this, pathAndQuery);
                if (r.status != 200) { toast("Impossibile aprire il documento."); return; }
                try {
                    String name = "documento.pdf";
                    String cd = r.headers.get("Content-Disposition");
                    if (cd != null) {
                        java.util.regex.Matcher m = java.util.regex.Pattern.compile("filename\\*?=(?:UTF-8'')?\"?([^\";]+)").matcher(cd);
                        if (m.find()) name = Uri.decode(m.group(1));
                    }
                    name = name.replaceAll("[^A-Za-z0-9._-]", "_");
                    File dir = new File(getCacheDir(), "files");
                    dir.mkdirs();
                    File f = new File(dir, name);
                    try (FileOutputStream o = new FileOutputStream(f)) { o.write(r.body); }
                    final Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(Uri.parse("content://app.bilancio.mobile.files/" + Uri.encode(name)), r.mime.split(";")[0].trim());
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            try { startActivity(i); } catch (Exception e) { toast("Nessuna app per aprire questo documento."); }
                        }
                    });
                } catch (Exception e) { toast("Impossibile aprire il documento."); }
            }
        });
    }

    private void toast(final String text) {
        runOnUiThread(new Runnable() { @Override public void run() { Toast.makeText(MainActivity.this, text, Toast.LENGTH_LONG).show(); } });
    }

    // ------------------------------------------------------------------ WebView

    private class Client extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath() == null ? "/" : u.getPath();
            if (!path.startsWith("/api/")) return asset(path);
            String q = u.getEncodedQuery();
            return toWebResponse(Server.forward(MainActivity.this, req.getMethod(), path + (q == null ? "" : "?" + q), req.getRequestHeaders(), null));
        }

        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) {
                if ("/api/file".equals(u.getPath())) {
                    String q = u.getEncodedQuery();
                    openDocument("/api/file" + (q == null ? "" : "?" + q));
                    return true;
                }
                return false;
            }
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nessuna app disponibile */ }
            return true;
        }
    }

    /** Feedback aptico: un lieve «tick» a ogni tocco su pulsanti, tab, celle e menu (lo chiama lo script iniettato nelle pagine). */
    private void tick() {
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null && v.hasVibrator()) v.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
    }

    /** Le richieste con corpo (POST, PUT, caricamento file…) non arrivano a shouldInterceptRequest: le invia lo script, noi le inoltriamo. */
    private class Bridge {
        @JavascriptInterface public void haptic() { tick(); }

        /** Indirizzo del server scelto dall'utente; vuoto se è incorporato nella build. */
        @JavascriptInterface public String serverAddress() {
            return Server.userAddress(MainActivity.this);
        }

        /** Dimentica il server e il login: alla prossima apertura l'app chiede di nuovo l'indirizzo. */
        @JavascriptInterface public void serverReset() {
            Server.forgetServer(MainActivity.this);
            runOnUiThread(new Runnable() { @Override public void run() { recreate(); } });
        }

        /** Promemoria personalizzati (Impostazioni): elenco con il prossimo scatto di ciascuno, in JSON. */
        @JavascriptInterface public String remindersGet() { return Reminders.listJson(MainActivity.this); }

        /** Salva l'elenco dei promemoria; risponde «ok» oppure il motivo dell'errore. */
        @JavascriptInterface public String remindersSave(String json) {
            try { Reminders.save(MainActivity.this, json); return "ok"; } catch (Exception e) { return "Errore: " + e.getMessage(); }
        }

        @JavascriptInterface public void send(final int id, final String method, final String path, final String headersJson, final String body, final boolean base64) {
            pool.execute(new Runnable() {
                @Override public void run() {
                    Map<String, String> headers = new HashMap<>();
                    try {
                        JSONObject h = new JSONObject(headersJson);
                        for (Iterator<String> it = h.keys(); it.hasNext(); ) { String k = it.next(); headers.put(k, h.getString(k)); }
                    } catch (Exception e) { /* senza intestazioni */ }
                    byte[] payload = null;
                    if (!body.isEmpty()) payload = base64 ? Base64.decode(body, Base64.DEFAULT) : body.getBytes(StandardCharsets.UTF_8);
                    final Server.Reply r = Server.forward(MainActivity.this, method, path, headers, payload);
                    final String b64 = Base64.encodeToString(r.body, Base64.NO_WRAP);
                    final JSONObject rh = new JSONObject();
                    try { rh.put("Content-Type", r.mime); } catch (Exception e) { /* ignora */ }
                    // Segnare pagato, leggere i documenti o caricarne uno cambia le cose da pagare: il widget si aggiorna.
                    // Anche categorie, importi manuali, estratti e letture della banca cambiano le cifre del mese.
                    if (r.status >= 200 && r.status < 300 && (path.startsWith("/api/paid") || path.startsWith("/api/pay-all") || path.startsWith("/api/refresh") || path.startsWith("/api/upload")
                        || path.startsWith("/api/transactions") || path.startsWith("/api/manual") || path.startsWith("/api/statements") || path.startsWith("/api/banking/sync") || path.startsWith("/api/budget"))) {
                        MonthWidget.refreshAll(MainActivity.this);
                    }
                    // Una lettura dalla banca cambia saldo e ultimo movimento del widget Revolut.
                    if (r.status >= 200 && r.status < 300 && (path.startsWith("/api/banking/sync") || path.startsWith("/api/banking/explore/read"))) {
                        BankWidget.refreshAll(MainActivity.this);
                    }
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            web.evaluateJavascript("window.__bilancioResult(" + id + "," + r.status + "," + rh + "," + JSONObject.quote(b64) + ")", null);
                        }
                    });
                }
            });
        }
    }
}
