import fs from 'node:fs';

const FRAMES = 16;
const cell = (key, title, detailed) => `
    <!-- ${title}: contenitore che si riempie dal basso; la superficie è un'onda sinusoidale che scorre verso destra (fotogrammi in un ViewFlipper) -->
    <FrameLayout
        android:id="@+id/widget_month_${key}_cell"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_marginLeft="2dp"
        android:layout_marginRight="2dp"
        android:background="@drawable/widget_cell"
        android:clipToOutline="true">
        <ViewFlipper
            android:id="@+id/widget_month_${key}_fill"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:autoStart="true"
            android:flipInterval="285">
${Array.from({ length: FRAMES }, (_, i) => `            <ImageView android:id="@+id/fl_${key}_${i}" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" />`).join('\n')}
        </ViewFlipper>
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical"
            android:gravity="center"
            android:paddingLeft="${detailed ? 2 : 6}dp"
            android:paddingRight="${detailed ? 2 : 6}dp">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="${title}"
                android:textColor="#E6FFFFFF"
                android:textSize="11sp"
                android:singleLine="true" />
            <TextView
                android:id="@+id/widget_month_${key}"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textColor="#FFFFFF"
                android:textSize="15.4sp"
                android:textStyle="bold"
                android:singleLine="true" />${detailed ? `
            <TextView
                android:id="@+id/widget_month_${key}_est"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="3dp"
                android:textColor="#E6FFFFFF"
                android:textSize="9sp"
                android:shadowColor="#99000000"
                android:shadowRadius="2"
                android:singleLine="true" />
            <TextView
                android:id="@+id/widget_month_${key}_real"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textColor="#FFFFFF"
                android:textSize="9sp"
                android:textStyle="bold"
                android:shadowColor="#99000000"
                android:shadowRadius="2"
                android:singleLine="true" />` : ''}
        </LinearLayout>
    </FrameLayout>`;

const layout = (detailed) => `<?xml version="1.0" encoding="utf-8"?>
<!-- ${detailed ? 'Copia di «Questo mese» con, in ogni riquadro di spesa, la spesa stimata al giorno e quella reale (verde se migliore della stima, rossa se peggiore).' : 'Widget «Questo mese».'} File generato da scripts/genera-widget.mjs -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_month_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:paddingLeft="8dp"
    android:paddingRight="8dp"
    android:paddingTop="6dp"
    android:paddingBottom="6dp"
    android:background="@drawable/widget_bg">

    <!-- «dal 1° OTT»: da quando partono le cifre; un tocco apre la scheda Budget -->
    <LinearLayout
        android:id="@+id/widget_month_since_cell"
        android:layout_width="0dp"
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
            android:textSize="11sp"
            android:singleLine="true" />
        <TextView
            android:id="@+id/widget_month_since"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textColor="#FFFFFF"
            android:textSize="14.3sp"
            android:textStyle="bold"
            android:singleLine="true" />
    </LinearLayout>

    <!-- Da pagare: rosso se resta qualcosa, verde chiaro se è tutto pagato -->
    <LinearLayout
        android:id="@+id/widget_month_due_cell"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1.15"
        android:layout_marginLeft="2dp"
        android:layout_marginRight="2dp"
        android:orientation="vertical"
        android:gravity="center"
        android:paddingLeft="6dp"
        android:paddingRight="6dp"
        android:background="@drawable/widget_cell_due">
        <TextView
            android:id="@+id/widget_month_topay_label"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Da pagare"
            android:textColor="#E6FFFFFF"
            android:textSize="11sp"
            android:singleLine="true" />
        <TextView
            android:id="@+id/widget_month_topay"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textColor="#FFFFFF"
            android:textSize="16.5sp"
            android:textStyle="bold"
            android:singleLine="true" />
    </LinearLayout>
${cell('spese', 'Spese', detailed)}
${cell('carburante', 'Carburante', detailed)}
${cell('svago', 'Svago', detailed)}
</LinearLayout>
`;

fs.writeFileSync('android/res/layout/widget_month.xml', layout(false));
fs.writeFileSync('android/res/layout/widget_month2.xml', layout(true));
