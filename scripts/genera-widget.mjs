// Genera i layout dei due widget «Questo mese» (e le loro anteprime statiche per la lista dei widget).
// Uso: node scripts/genera-widget.mjs  (dalla cartella del progetto). Qui si cambiano anche il numero di fotogrammi dell'onda
// (devono coincidere con FRAMES in MonthWidget.java) e il tempo di cambio fotogramma.
import fs from 'node:fs';

const FRAMES = 16;
const FLIP_MS = 285;

// misure del testo: base (widget semplice) e dettagliato (5×1 con la riga «stima → reale» al giorno, testi più grandi)
const SIZE = {
  plain: { since: 14.3, sinceLabel: 11, dueLabel: 11, due: 16.5, title: 11, amount: 15.4, padCell: 6, padRoot: 6 },
  detail: { since: 15, sinceLabel: 12, dueLabel: 12.5, due: 17.5, title: 12.5, amount: 16.5, padCell: 2, padRoot: 4, day: 11 },
};

const PREVIEW = { since: 'OTT', toPay: '245,00 €', label: 'Da pagare (3)', spese: '312,40 €', carburante: '86,00 €', svago: '41,20 €', day: '13,3→15,1/g' };
// anteprima: altezza fissa del liquido (dp) invece delle immagini a onde, e il colore del «reale» al giorno
const PREVIEW_FILL = { spese: ['a', 30], carburante: ['b', 45], svago: ['c', 15] };
const PREVIEW_DAY_COLOR = { spese: '#FF4ADE80', carburante: '#FFFF6B6B', svago: '#FF4ADE80' };

const text = (id, extra) => `            <TextView${id ? `\n                android:id="@+id/${id}"` : ''}
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
${extra}
                android:singleLine="true" />`;

const cell = (key, title, mode, preview) => {
  const z = SIZE[mode];
  const detailed = mode === 'detail';
  const fill = preview
    ? `        <ImageView
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:src="@drawable/preview_fill_${PREVIEW_FILL[key][0]}"
            android:scaleType="fitXY" />`
    : `        <ViewFlipper
            android:id="@+id/widget_month_${key}_fill"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:autoStart="true"
            android:flipInterval="${FLIP_MS}">
${Array.from({ length: FRAMES }, (_, i) => `            <ImageView android:id="@+id/fl_${key}_${i}" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" />`).join('\n')}
        </ViewFlipper>`;
  return `
    <!-- ${title}: contenitore che si riempie dal basso; la superficie è un'onda sinusoidale che scorre verso destra (fotogrammi in un ViewFlipper) -->
    <FrameLayout
        ${preview ? '' : `android:id="@+id/widget_month_${key}_cell"
        `}android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_marginLeft="2dp"
        android:layout_marginRight="2dp"
        android:background="@drawable/widget_cell"
        android:clipToOutline="true">
${fill}
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical"
            android:gravity="center"
            android:paddingLeft="${z.padCell}dp"
            android:paddingRight="${z.padCell}dp">
${text(null, `                android:text="${title}"
                android:textColor="#E6FFFFFF"
                android:textSize="${z.title}sp"`)}
${text(preview ? null : `widget_month_${key}`, `${preview ? `                android:text="${PREVIEW[key]}"\n` : ''}                android:textColor="#FFFFFF"
                android:textSize="${z.amount}sp"
                android:textStyle="bold"`)}${detailed ? `
${text(preview ? null : `widget_month_${key}_day`, `${preview ? `                android:text="${PREVIEW.day}"\n` : ''}                android:layout_marginTop="1dp"
                android:textColor="${preview ? PREVIEW_DAY_COLOR[key] : '#FFFFFFFF'}"
                android:textSize="${z.day}sp"
                android:textStyle="bold"
                android:shadowColor="#99000000"
                android:shadowRadius="2"`)}` : ''}
        </LinearLayout>
    </FrameLayout>`;
};

const layout = (mode, preview) => {
  const z = SIZE[mode];
  const detailed = mode === 'detail';
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- ${preview ? 'Anteprima statica (dati di esempio) per la lista dei widget' : detailed ? 'Copia di «Questo mese» (5×1) con, in ogni riquadro di spesa, «stima → reale» al giorno: verde se la reale è migliore, rossa se peggiore' : 'Widget «Questo mese»'}. File generato da scripts/genera-widget.mjs -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    ${preview ? '' : 'android:id="@+id/widget_month_root"\n    '}android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:paddingLeft="8dp"
    android:paddingRight="8dp"
    android:paddingTop="${z.padRoot}dp"
    android:paddingBottom="${z.padRoot}dp"
    android:background="@drawable/widget_bg">

    <!-- «dal 1° OTT»: da quando partono le cifre; un tocco apre la scheda Budget -->
    <LinearLayout
        ${preview ? '' : 'android:id="@+id/widget_month_since_cell"\n        '}android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="0.6"
        android:orientation="vertical"
        android:gravity="center"
        android:layout_marginRight="2dp"
        android:paddingLeft="2dp"
        android:paddingRight="2dp"
        android:background="@drawable/widget_since_bg">
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="dal 1°"
            android:textColor="#CCFFFFFF"
            android:textSize="${z.sinceLabel}sp"
            android:singleLine="true" />
        <TextView${preview ? '' : '\n            android:id="@+id/widget_month_since"'}
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"${preview ? `\n            android:text="${PREVIEW.since}"` : ''}
            android:textColor="#FFFFFF"
            android:textSize="${z.since}sp"
            android:textStyle="bold"
            android:singleLine="true" />
    </LinearLayout>

    <!-- Da pagare: rosso se resta qualcosa, verde chiaro se è tutto pagato -->
    <LinearLayout
        ${preview ? '' : 'android:id="@+id/widget_month_due_cell"\n        '}android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1.15"
        android:layout_marginLeft="2dp"
        android:layout_marginRight="2dp"
        android:orientation="vertical"
        android:gravity="center"
        android:paddingLeft="6dp"
        android:paddingRight="6dp"
        android:background="@drawable/widget_cell_due">
        <TextView${preview ? '' : '\n            android:id="@+id/widget_month_topay_label"'}
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="${preview ? PREVIEW.label : 'Da pagare'}"
            android:textColor="#E6FFFFFF"
            android:textSize="${z.dueLabel}sp"
            android:singleLine="true" />
        <TextView${preview ? '' : '\n            android:id="@+id/widget_month_topay"'}
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"${preview ? `\n            android:text="${PREVIEW.toPay}"` : ''}
            android:textColor="#FFFFFF"
            android:textSize="${z.due}sp"
            android:textStyle="bold"
            android:singleLine="true" />
    </LinearLayout>
${cell('spese', 'Spese', mode, preview)}
${cell('carburante', 'Carburante', mode, preview)}
${cell('svago', 'Svago', mode, preview)}
</LinearLayout>
`;
};

const fill = (name, color, dp) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Liquido dell'anteprima dei widget: altezza fissa, angoli tondi come i riquadri -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:gravity="bottom" android:height="${dp}dp">
        <shape android:shape="rectangle">
            <solid android:color="${color}" />
            <corners android:radius="14dp" />
        </shape>
    </item>
</layer-list>
`;

fs.writeFileSync('android/res/layout/widget_month.xml', layout('plain', false));
fs.writeFileSync('android/res/layout/widget_month2.xml', layout('detail', false));
fs.writeFileSync('android/res/layout/widget_month_preview.xml', layout('plain', true));
fs.writeFileSync('android/res/layout/widget_month2_preview.xml', layout('detail', true));
fs.writeFileSync('android/res/drawable/preview_fill_a.xml', fill('a', '#66FFFFFF', PREVIEW_FILL.spese[1]));
fs.writeFileSync('android/res/drawable/preview_fill_b.xml', fill('b', '#CCF59E0B', PREVIEW_FILL.carburante[1]));
fs.writeFileSync('android/res/drawable/preview_fill_c.xml', fill('c', '#66FFFFFF', PREVIEW_FILL.svago[1]));
