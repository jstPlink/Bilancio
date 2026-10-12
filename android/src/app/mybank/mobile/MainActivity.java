package app.mybank.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * L'app MyBank: una finestra sulle pagine del server (stesse schede del web) più il widget. Alla prima apertura chiede l'indirizzo del
 * server (a meno che la build non lo contenga già). La pagina, dopo il login, consegna il gettone di accesso che serve al widget.
 */
public class MainActivity extends Activity {
    private WebView web;
    private boolean night;
    private int paper, ink;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        paper = night ? Color.parseColor("#121211") : Color.parseColor("#F3F0EA");
        ink = night ? Color.parseColor("#EDEAE3") : Color.parseColor("#131211");
        getWindow().setStatusBarColor(paper);
        getWindow().setNavigationBarColor(paper);
        if (!night) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if (Server.baseUrl(this).isEmpty()) askServer(""); else openWeb();
    }

    // ------------------------------------------------------------------ indirizzo del server

    private void askServer(String error) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(paper);
        int pad = dp(24);
        box.setPadding(pad, dp(72), pad, pad);

        TextView title = new TextView(this);
        title.setText("MyBank");
        title.setTextColor(ink);
        title.setTextSize(34);
        title.setTypeface(Typeface.SERIF, Typeface.BOLD);
        box.addView(title);

        TextView hint = new TextView(this);
        hint.setText("Indirizzo del tuo server MyBank (es. mybank.miodominio.it, oppure 192.168.1.20:4870 in casa).");
        hint.setTextColor(ink);
        hint.setTextSize(14);
        hint.setPadding(0, dp(8), 0, dp(20));
        box.addView(hint);

        final EditText input = new EditText(this);
        input.setHint("indirizzo del server");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setTextColor(ink);
        input.setHintTextColor(Color.GRAY);
        box.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        final TextView err = new TextView(this);
        err.setText(error);
        err.setTextColor(Color.parseColor("#E8431A"));
        err.setTextSize(13);
        err.setPadding(0, dp(8), 0, dp(8));
        box.addView(err);

        Button go = new Button(this);
        go.setText("Collega");
        go.setAllCaps(false);
        go.setTextColor(paper);
        go.setBackgroundColor(ink);
        go.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                String address = Server.cleanAddress(input.getText().toString());
                if (address == null) { err.setText("Indirizzo non valido: serve https, oppure un indirizzo di casa (192.168…, 10…, .local)."); return; }
                Server.saveServer(MainActivity.this, address);
                openWeb();
            }
        });
        box.addView(go, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        setContentView(box);
    }

    // ------------------------------------------------------------------ pagine del server

    /** Ponte JavaScript: la pagina consegna il gettone per il widget e può chiedere di aggiornarlo o di cambiare server. */
    private final class Bridge {
        @JavascriptInterface public void saveToken(String token) { Server.saveToken(MainActivity.this, token); MyBankWidget.refreshAll(MainActivity.this); }
        @JavascriptInterface public void refreshWidget() { MyBankWidget.refreshAll(MainActivity.this); }
        @JavascriptInterface public void changeServer() {
            runOnUiThread(new Runnable() { @Override public void run() { Server.saveServer(MainActivity.this, ""); askServer(""); } });
        }
        @JavascriptInterface public void retry() {
            runOnUiThread(new Runnable() { @Override public void run() { web.loadUrl(Server.baseUrl(MainActivity.this) + "/"); } });
        }
    }

    private void openWeb() {
        final String base = Server.baseUrl(this);
        web = new WebView(this);
        web.setBackgroundColor(paper);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                String scheme = req.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false; // anche i siti delle banche si aprono qui
                try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); } catch (Exception e) { /* nessuna app per questo indirizzo */ }
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError e) {
                if (!req.isForMainFrame()) return;
                String html = "<body style='font-family:sans-serif;padding:32px;background:" + (night ? "#121211" : "#F3F0EA") + ";color:" + (night ? "#EDEAE3" : "#131211") + "'>"
                    + "<h2>Server non raggiungibile</h2><p>" + base + "</p>"
                    + "<p><button style='font-size:16px;padding:12px 20px' onclick='Native.retry()'>Riprova</button> "
                    + "<button style='font-size:16px;padding:12px 20px' onclick='Native.changeServer()'>Cambia server</button></p></body>";
                v.loadDataWithBaseURL(base + "/", html, "text/html", "utf-8", null);
            }
        });
        Uri open = getIntent() != null ? getIntent().getData() : null;
        web.loadUrl(open != null ? open.toString() : base + "/");
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) MyBankWidget.refreshAll(this);
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
