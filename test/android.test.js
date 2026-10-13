import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Un widget è fatto di RemoteViews: il launcher gradisce solo poche classi di view (View, ad esempio, no) e, se ne trova una vietata,
// mostra «Problema nel caricamento del widget». Questo controllo evita di scoprirlo solo sul telefono.
const ALLOWED = new Set(['FrameLayout', 'LinearLayout', 'RelativeLayout', 'GridLayout', 'AnalogClock', 'Button', 'Chronometer', 'ImageButton', 'ImageView', 'ProgressBar', 'TextClock', 'TextView', 'ViewFlipper', 'AdapterViewFlipper', 'GridView', 'ListView', 'StackView']);
const tags = (file) => [...fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([A-Za-z][\w.]*)[\s>/]/g)].map((m) => m[1]).filter((t) => t !== 'layer-list');

for (const file of ['android/res/layout/widget_mybank.xml', 'android/res/layout/widget_mybank_preview.xml']) {
  test(`${file}: solo view ammesse nei widget`, () => {
    const bad = tags(file).filter((t) => !ALLOWED.has(t));
    assert.deepEqual(bad, []);
  });
}

test('il widget usa solo identificativi che esistono nel layout', () => {
  const java = fs.readFileSync('android/src/app/mybank/mobile/MyBankWidget.java', 'utf8');
  const used = new Set([...java.matchAll(/R\.id\.(\w+)/g)].map((m) => m[1]));
  const layout = fs.readFileSync('android/res/layout/widget_mybank.xml', 'utf8');
  const defined = new Set([...layout.matchAll(/@\+id\/(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((id) => !defined.has(id)), []);
  assert.ok(used.size >= 10);
});

test("il file dell'icona e il manifest puntano a risorse che esistono", () => {
  const manifest = fs.readFileSync('android/AndroidManifest.xml', 'utf8');
  for (const ref of manifest.matchAll(/@(xml|mipmap|style)\/(\w+)/g)) {
    const [, kind, name] = ref;
    const dirs = { xml: ['android/res/xml'], mipmap: ['android/res/mipmap-anydpi-v26', 'android/res/mipmap-anydpi'], style: ['android/res/values'] }[kind];
    const found = dirs.some((d) => fs.existsSync(d) && fs.readdirSync(d).some((f) => (kind === 'style' ? fs.readFileSync(`${d}/${f}`, 'utf8').includes(`name="${name}"`) : f.startsWith(`${name}.`))));
    assert.ok(found, `${kind}/${name}`);
  }
});

test("ogni cella di categoria ha il suo nome scritto nel layout (non lo imposta il codice); le quattro celle hanno la stessa larghezza", () => {
  for (const file of ['android/res/layout/widget_mybank.xml', 'android/res/layout/widget_mybank_preview.xml']) {
    const xml = fs.readFileSync(file, 'utf8');
    for (const [key, name] of [['spesa', 'SPESA'], ['svago', 'SVAGO'], ['carburante', 'AUTO']]) {
      const m = new RegExp(`@\\+id/widget_${key}_label"[\\s\\S]*?android:text="([^"]*)"`).exec(xml);
      assert.equal(m?.[1], name, `${file}: nome di ${key}`);
    }
    const weights = [...xml.matchAll(/android:layout_weight="([\d.]+)"/g)].map((m) => m[1]);
    assert.deepEqual(weights, ['1', '1', '1', '1'], `${file}: pesi ${weights}`); // le quattro celle occupano lo stesso spazio
  }
});

test("il widget apre i Movimenti filtrati per la categoria della cella", () => {
  const java = fs.readFileSync('android/src/app/mybank/mobile/MyBankWidget.java', 'utf8');
  assert.match(java, /"movimenti:" \+ KEYS\[i\]/);
  assert.match(java, /widget_month_cell, tap\(c, 2, "budget"\)/); // la prima cella apre il Budget
  const activity = fs.readFileSync('android/src/app/mybank/mobile/MainActivity.java', 'utf8');
  assert.match(activity, /onNewIntent/);
});

test("l'APK contiene il frontend e la webview lo serve al posto di quello del server", () => {
  const build = fs.readFileSync('scripts/build-apk.mjs', 'utf8');
  assert.match(build, /cpSync\(path\.join\(root, 'public'\), path\.join\(build, 'assets', 'www'\)/);
  const activity = fs.readFileSync('android/src/app/mybank/mobile/MainActivity.java', 'utf8');
  assert.match(activity, /shouldInterceptRequest/);
  for (const f of ['index.html', 'app.js', 'style.css', 'icon.svg']) assert.ok(fs.existsSync(`public/${f}`), f);
});

test('notifiche: permessi, ricevitore nel manifest, icona e ponte per la pagina', () => {
  const manifest = fs.readFileSync('android/AndroidManifest.xml', 'utf8');
  for (const perm of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'USE_EXACT_ALARM']) assert.match(manifest, new RegExp(`android.permission.${perm}`));
  assert.match(manifest, /android:name="\.NotifyReceiver"/);
  for (const f of ['Notifier', 'NotifyReceiver']) assert.ok(fs.existsSync(`android/src/app/mybank/mobile/${f}.java`), f);
  assert.ok(fs.existsSync('android/res/drawable/ic_notify.xml'));
  assert.match(fs.readFileSync('android/src/app/mybank/mobile/MainActivity.java', 'utf8'), /void syncNotifications\(\)/);
  assert.match(fs.readFileSync('public/app.js', 'utf8'), /Native\?\.syncNotifications/);
  assert.match(fs.readFileSync('android/src/app/mybank/mobile/Notifier.java', 'utf8'), /\/api\/notifications/);
});

test('widget: le barre sono larghe 34,27 dp (il 20% in più di 28,56) in tutte e quattro le celle', () => {
  for (const file of ['android/res/layout/widget_mybank.xml', 'android/res/layout/widget_mybank_preview.xml']) {
    const widths = [...fs.readFileSync(file, 'utf8').matchAll(/android:layout_width="([\d.]+)dp"/g)].map((m) => m[1]).filter((w) => w !== '1');
    assert.equal(widths.filter((w) => w === '34.27').length, 4, file);
    assert.equal(widths.includes('28.56'), false, file);
  }
});

test("login: un pulsante sceglie http o https e nel campo basta l'indirizzo (app e localhost)", () => {
  const activity = fs.readFileSync('android/src/app/mybank/mobile/MainActivity.java', 'utf8');
  assert.match(activity, /"https:\/\/"/);
  assert.match(activity, /"http:\/\/"/);
  assert.match(fs.readFileSync('public/index.html', 'utf8'), /id="schemeBtn"/);
  assert.match(fs.readFileSync('public/app.js', 'utf8'), /setScheme/);
});
