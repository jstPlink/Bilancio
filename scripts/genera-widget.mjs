// Genera il layout del widget «Questo mese 2» (widget_month3.xml, 5×2) e la sua anteprima statica per la lista dei widget (widget_month3_preview.xml).
// Uso: node scripts/genera-widget.mjs  (dalla cartella del progetto). Qui si cambiano anche il numero di fotogrammi dell'onda
// (devono coincidere con FRAMES in MonthWidget.java) e il tempo di cambio fotogramma.
import fs from 'node:fs';

const FRAMES = 16;
const FLIP_MS = 285;

// Misure (sp e dp). Tutte le etichette (Da pagare, Spese, Svago, Carburante, mancano x g, banca) hanno la stessa dimensione e lo stesso stile; le cifre
// pure. gap: spazio fra riquadri e fra le tre parti della colonna di sinistra; i margini esterni (padRoot) sono uguali su tutti i lati.
// barMin/bankMin: altezze minime delle parti barra e banca; amountTop/pillTop: aria sopra la cifra e sopra stima/reale.
const Z = { title: 12, amount: 16.5, padCell: 4, padRoot: 8, day: 11.5, dueLabelS: 12, dueS: 16.5, small: 12, gap: 6, barMin: 14, bankMin: 14, amountTop: 4, pillTop: 8, pillPadX: 8, pillPadY: 3 };

// Palette: teal dell'app (sfondo), riquadri bianchi trasparenti e un solo colore d'allarme, l'ambra (#FBBF24).
const PREVIEW = {
  toPay: '245,00 €', label: 'Da pagare (3)', spese: '187,60 €', carburante: '14,00 €', svago: '58,80 €',
  est: 'stima €13,30', act: 'reale €15,10', left: 'mancano 14 g', bank: 'banca 12:05',
  // ottobre 2026 (il 1 è giovedì; domeniche 4, 11, 18, 25), oggi il 17: [giorni del blocco, giorni già passati]
  bar: [[4, 4], [7, 7], [7, 6], [7, 0], [6, 0]],
};
// anteprima: altezza fissa del liquido (dp) invece delle immagini a onde (il widget è alto due righe)
const PREVIEW_FILL = { spese: ['a', 62], carburante: ['b', 96], svago: ['c', 30] };
// la «reale» è bianca se è pari o migliore della stima, ambra se è peggiore
const PREVIEW_DAY_COLOR = { spese: '#FFFFFFFF', carburante: '#FFFBBF24', svago: '#FFFFFFFF' };

const text = (id, extra) => `            <TextView${id ? `\n                android:id="@+id/${id}"` : ''}
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
${extra}
                android:singleLine="true" />`;

const cell = (key, title, preview) => {
  const fill = preview
    ? `        <ImageView
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:src="@drawable/preview_fill_tall_${PREVIEW_FILL[key][0]}"
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
    <!-- ${title}: contenitore con il residuo del budget, che scende dall'alto; la superficie è un'onda sinusoidale che scorre verso destra (fotogrammi in un ViewFlipper) -->
    <FrameLayout
        ${preview ? '' : `android:id="@+id/widget_month_${key}_cell"
        `}android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_marginLeft="${Z.gap}dp"
        android:background="@drawable/widget_cell"
        android:clipToOutline="true">
${fill}
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical"
            android:gravity="center"
            android:paddingLeft="${Z.padCell}dp"
            android:paddingRight="${Z.padCell}dp">
${text(preview ? null : `widget_month_${key}_title`, `                android:text="${title}"
                android:textColor="#E6FFFFFF"
                android:textSize="${Z.title}sp"`)}
${text(preview ? null : `widget_month_${key}`, `${preview ? `                android:text="${PREVIEW[key]}"\n` : ''}                android:layout_marginTop="${Z.amountTop}dp"
                android:textColor="#FFFFFF"
                android:textSize="${Z.amount}sp"
                android:textStyle="bold"`)}
            <!-- stima e reale in un solo sfondo tondo, una riga sotto l'altra -->
            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="${Z.pillTop}dp"
                android:orientation="vertical"
                android:gravity="center_horizontal"
                android:paddingLeft="${Z.pillPadX}dp"
                android:paddingRight="${Z.pillPadX}dp"
                android:paddingTop="${Z.pillPadY}dp"
                android:paddingBottom="${Z.pillPadY}dp"
                android:background="@drawable/widget_pill">
${text(preview ? null : `widget_month_${key}_est`, `${preview ? `                android:text="${PREVIEW.est}"
` : ''}                android:textColor="#FFFFFFFF"
                android:textSize="${Z.day}sp"
                android:textStyle="bold"`)}
${text(preview ? null : `widget_month_${key}_act`, `${preview ? `                android:text="${PREVIEW.act}"
` : ''}                android:textColor="${preview ? PREVIEW_DAY_COLOR[key] : '#FFFFFFFF'}"
                android:textSize="${Z.day}sp"
                android:textStyle="bold"`)}
            </LinearLayout>
        </LinearLayout>
    </FrameLayout>`;
};

const layout = (preview) => `<?xml version="1.0" encoding="utf-8"?>
<!-- ${preview ? 'Anteprima statica (dati di esempio) per la lista dei widget' : 'Widget «Questo mese 2» (5×2): colonna di sinistra in tre parti (cose da pagare, barra del mese, banca) e tre riquadri di spesa con stima e reale al giorno'}. File generato da scripts/genera-widget.mjs -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    ${preview ? '' : 'android:id="@+id/widget_month_root"\n    '}android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:paddingLeft="8dp"
    android:paddingRight="8dp"
    android:paddingTop="${Z.padRoot}dp"
    android:paddingBottom="${Z.padRoot}dp"
    android:background="@drawable/widget_bg">

    <!-- Colonna di sinistra: tre parti, una sopra l'altra -->
    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:orientation="vertical">

        <!-- 1) Cose da pagare: ambra se resta qualcosa, riquadro neutro come gli altri se è tutto pagato. Due terzi della colonna; barra e banca un sesto ciascuna -->
        <LinearLayout
            ${preview ? '' : 'android:id="@+id/widget_month_due_cell"\n            '}android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="4"
            android:orientation="vertical"
            android:gravity="center"
            android:paddingLeft="4dp"
            android:paddingRight="4dp"
            android:background="@drawable/w2_cell_alert">
            <TextView${preview ? '' : '\n                android:id="@+id/widget_month_topay_label"'}
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="${preview ? PREVIEW.label : 'Da pagare'}"
                android:textColor="#FF0B4F4A"
                android:textSize="${Z.dueLabelS}sp"
                android:includeFontPadding="false"
                android:singleLine="true" />
            <TextView${preview ? '' : '\n                android:id="@+id/widget_month_topay"'}
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"${preview ? `\n                android:text="${PREVIEW.toPay}"` : ''}
                android:textColor="#FF0B4F4A"
                android:textSize="${Z.dueS}sp"
                android:textStyle="bold"
                android:includeFontPadding="false"
                android:singleLine="true" />
        </LinearLayout>

        <!-- 2) Barra del mese: una barra proporzionale ai giorni, con un divisore alla fine di ogni domenica (i blocchi sono le settimane lunedì–domenica), e scritto dentro quanto manca alla fine del mese -->
        <FrameLayout
            ${preview ? '' : 'android:id="@+id/widget_month_bar_cell"\n            '}android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:minHeight="${Z.barMin}dp"
            android:layout_marginTop="${Z.gap}dp">
${preview ? `            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:orientation="horizontal">
${PREVIEW.bar.map(([len, done], i, all) => `                <ProgressBar
                    style="?android:attr/progressBarStyleHorizontal"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="${len}"
                    android:layout_marginLeft="${i === 0 ? 0 : 1}dp"
                    android:layout_marginRight="${i === all.length - 1 ? 0 : 1}dp"
                    android:max="${len}"
                    android:progress="${done}"
                    android:progressDrawable="@drawable/widget_week" />`).join('\n')}
            </LinearLayout>` : `            <ImageView
                android:id="@+id/widget_month_bar"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:scaleType="fitXY" />`}
            <TextView${preview ? '' : '\n                android:id="@+id/widget_month_left"'}
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="center"${preview ? `\n                android:text="${PREVIEW.left}"` : ''}
                android:textColor="#E6FFFFFF"
                android:textSize="${Z.small}sp"
                android:shadowColor="#66000000"
                android:shadowRadius="2"
                android:includeFontPadding="false"
                android:singleLine="true" />
        </FrameLayout>

        <!-- 3) Ultimo aggiornamento dalle banche collegate (sparisce se non c'è nessuna banca) -->
        <FrameLayout
            ${preview ? '' : 'android:id="@+id/widget_month_bank_cell"\n            '}android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:minHeight="${Z.bankMin}dp"
            android:layout_marginTop="${Z.gap}dp"
            android:background="@drawable/widget_cell">
            <TextView${preview ? '' : '\n                android:id="@+id/widget_month_bank"'}
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="center"${preview ? `\n                android:text="${PREVIEW.bank}"` : ''}
                android:textColor="#E6FFFFFF"
                android:textSize="${Z.small}sp"
                android:ellipsize="end"
                android:includeFontPadding="false"
                android:singleLine="true" />
        </FrameLayout>
    </LinearLayout>

${cell('spese', 'Spese', preview)}
${cell('svago', 'Svago', preview)}
${cell('carburante', 'Carburante', preview)}
</LinearLayout>
`;

const fill = (color, dp) => `<?xml version="1.0" encoding="utf-8"?>
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

fs.writeFileSync('android/res/layout/widget_month3.xml', layout(false));
fs.writeFileSync('android/res/layout/widget_month3_preview.xml', layout(true));
fs.writeFileSync('android/res/drawable/preview_fill_tall_a.xml', fill('#66FFFFFF', PREVIEW_FILL.spese[1]));
fs.writeFileSync('android/res/drawable/preview_fill_tall_b.xml', fill('#CCFBBF24', PREVIEW_FILL.carburante[1])); // ambra: l'unico colore d'allarme
fs.writeFileSync('android/res/drawable/preview_fill_tall_c.xml', fill('#66FFFFFF', PREVIEW_FILL.svago[1]));
