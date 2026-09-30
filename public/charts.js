// Grafici in SVG/HTML puro (nessuna libreria, funzionano anche offline sul NAS).
// Colori dai token CSS --viz-*; testi sempre con i token di testo, mai col colore della serie.

const NS = 'http://www.w3.org/2000/svg';
const eur0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
export const fmtMoney = (n) => eur2.format(n);

const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
};
const html = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

const SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const monthLong = (ym) => `${LONG[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;

// Estremo dell'asse e tacche "tonde" (1, 2, 5 × 10^n).
function niceScale(max) {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

function legend(items) {
  const box = html('div', 'legend');
  for (const it of items) {
    const item = html('span', 'legend-item');
    const key = html('i', it.line ? 'key line' : 'key');
    key.style.setProperty('--c', it.color);
    item.append(key, html('span', '', it.label));
    box.append(item);
  }
  return box;
}

// Colonne impilate per mese, con una linea facoltativa sopra (stesso asse, stessi euro).
// series: [{ label, color, get(m) }]  line: { label, color, get(m) }  onPick(ym): clic su un mese.
export function monthChart(host, months, { series, line, onPick }) {
  host.replaceChildren();
  if (!months.length) { host.append(html('p', 'muted', 'Nessun dato nel periodo scelto.')); return; }
  host.append(legend([...series.map((s) => ({ label: s.label, color: s.color })), ...(line ? [{ label: line.label, color: line.color, line: true }] : [])]));

  const W = Math.max(320, host.clientWidth || 640);
  const H = 290;
  const m = { l: 62, r: 12, t: 12, b: 28 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const stacks = months.map((mo) => series.reduce((a, s) => a + (s.get(mo) || 0), 0));
  const lineVals = line ? months.map((mo) => line.get(mo) || 0) : [];
  const { top, ticks } = niceScale(Math.max(...stacks, ...lineVals));
  const y = (v) => m.t + ph - (v / top) * ph;
  const band = pw / months.length;
  const barW = Math.min(24, band * 0.7);

  const wrap = html('div', 'chart-wrap');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Grafico mese per mese' }, wrap);
  for (const t of ticks) {
    el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'grid' }, svg);
    const label = el('text', { x: m.l - 8, y: y(t) + 4, class: 'axis', 'text-anchor': 'end' }, svg);
    label.textContent = eur0.format(t);
  }
  const manyYears = new Set(months.map((mo) => mo.ym.slice(0, 4))).size > 1;
  const step = Math.max(1, Math.ceil(months.length / Math.max(2, Math.floor(pw / (manyYears ? 52 : 30)))));
  const tip = html('div', 'tip');
  tip.hidden = true;

  const showTip = (i) => {
    const mo = months[i];
    tip.replaceChildren(html('div', 'tip-h', monthLong(mo.ym)));
    const add = (label, color, value, isLine) => {
      const row = html('div', 'tip-r');
      const key = html('i', isLine ? 'key line' : 'key');
      key.style.setProperty('--c', color);
      row.append(key, html('span', 'tip-l', label), html('b', 'tip-v', fmtMoney(value)));
      tip.append(row);
    };
    if (line) add(line.label, line.color, line.get(mo) || 0, true);
    [...series].reverse().forEach((s) => add(s.label, s.color, s.get(mo) || 0));
    if (series.length > 1) {
      const row = html('div', 'tip-r tip-t');
      row.append(html('span', 'tip-l', 'Uscite totali'), html('b', 'tip-v', fmtMoney(stacks[i])));
      tip.append(row);
    }
    tip.hidden = false;
    const cx = m.l + band * (i + 0.5);
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(4, Math.min(W - w - 4, cx + 14 > W - w ? cx - w - 14 : cx + 14))}px`;
    tip.style.top = `${m.t}px`;
  };

  months.forEach((mo, i) => {
    const cx = m.l + band * (i + 0.5);
    const x = cx - barW / 2;
    const hover = el('rect', { x: m.l + band * i, y: m.t, width: band, height: ph, class: 'hover-band' }, svg);
    let cum = 0;
    const live = series.map((s) => ({ s, v: s.get(mo) || 0 })).filter((p) => p.v > 0);
    live.forEach(({ s, v }, k) => {
      const yTop = y(cum + v);
      const yBottom = y(cum);
      const isTop = k === live.length - 1;
      const t = isTop ? yTop : yTop + 1; // 2px di superficie tra i segmenti
      const b = k === 0 ? yBottom : yBottom - 1;
      const h = Math.max(1, b - t);
      const r = isTop && h > 6 ? 4 : 0;
      el('path', {
        d: `M${x},${t + h} L${x},${t + r} ${r ? `Q${x},${t} ${x + r},${t}` : ''} L${x + barW - r},${t} ${r ? `Q${x + barW},${t} ${x + barW},${t + r}` : ''} L${x + barW},${t + h} Z`,
        fill: s.color,
      }, svg);
      cum += v;
    });
    if (i % step === 0) {
      const label = el('text', { x: cx, y: H - 8, class: 'axis', 'text-anchor': 'middle' }, svg);
      label.textContent = manyYears ? `${SHORT[Number(mo.ym.slice(5)) - 1]} ${mo.ym.slice(2, 4)}` : SHORT[Number(mo.ym.slice(5)) - 1];
    }
    const hit = el('rect', {
      x: m.l + band * i, y: m.t, width: band, height: ph, class: 'hit', tabindex: 0, role: 'img',
      'aria-label': `${monthLong(mo.ym)}: ${series.map((s) => `${s.label} ${fmtMoney(s.get(mo) || 0)}`).join(', ')}${line ? `, ${line.label} ${fmtMoney(line.get(mo) || 0)}` : ''}`,
    }, svg);
    const on = () => { hover.classList.add('on'); showTip(i); };
    const off = () => { hover.classList.remove('on'); tip.hidden = true; };
    hit.addEventListener('pointerenter', on);
    hit.addEventListener('pointerleave', off);
    hit.addEventListener('focus', on);
    hit.addEventListener('blur', off);
    if (onPick) {
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', () => onPick(mo.ym));
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(mo.ym); } });
    }
  });

  if (line) {
    let d = '';
    let pen = false;
    months.forEach((mo, i) => {
      const v = line.get(mo);
      if (!v) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${m.l + band * (i + 0.5)},${y(v)} `;
      pen = true;
    });
    el('path', { d, fill: 'none', stroke: line.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none' }, svg);
    months.forEach((mo, i) => {
      const v = line.get(mo);
      if (v) el('circle', { cx: m.l + band * (i + 0.5), cy: y(v), r: 4, fill: line.color, stroke: 'var(--surface)', 'stroke-width': 2, 'pointer-events': 'none' }, svg);
    });
  }
  wrap.append(tip);
  host.append(wrap);
}

// Barre orizzontali: una riga per voce, colore = categoria, valore in punta.
// items: [{ label, value, color, sub }]
export function hBars(host, items) {
  host.replaceChildren();
  if (!items.length) { host.append(html('p', 'muted', 'Nessun movimento nel periodo scelto.')); return; }
  const max = Math.max(...items.map((i) => i.value), 1);
  const list = html('div', 'hbars');
  for (const it of items) {
    const row = html('div', 'hb-row');
    row.title = `${it.label}${it.sub ? ` · ${it.sub}` : ''}: ${fmtMoney(it.value)}`;
    const label = html('span', 'hb-label', it.label);
    const track = html('span', 'hb-track');
    const bar = html('i', 'hb-bar');
    bar.style.width = `${Math.max(1, (it.value / max) * 100)}%`;
    bar.style.background = it.color;
    track.append(bar);
    row.append(label, track, html('b', 'hb-val', fmtMoney(it.value)));
    list.append(row);
  }
  host.append(legend(items.reduce((acc, it) => (acc.some((a) => a.label === it.cat) ? acc : [...acc, { label: it.cat, color: it.color }]), [])), list);
}
