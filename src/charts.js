// Small SVG chart kit. Every chart reads CSS variables, so it follows the theme on screen and in the PDF.
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ring(pct, size = 64, stroke = 7, label) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = pct ?? 0;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct == null ? 'No tasks' : v + ' percent complete'}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#gAcc)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="--c:${c}"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="${size * 0.24}" font-weight="800" fill="currentColor">${label ?? (pct == null ? '–' : v + '%')}</text></svg>`;
}

export const defs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="gAcc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--acc)"/><stop offset="1" stop-color="var(--acc2)"/></linearGradient>
  <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".35"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs></svg>`;

// Vertical bars with labels; values 0-100 or null.
export function bars(items, { h = 140, fmt = v => v + '%', max = 100, color } = {}) {
  const w = 100 / Math.max(1, items.length);
  const top = Math.max(max, ...items.map(i => i.v || 0));
  return `<div class="vbars" style="--h:${h}px">${items.map(i => `<div class="vb" style="width:${w}%" data-tip="${esc(i.tip || `${i.label}: ${i.v == null ? 'no data' : fmt(i.v)}`)}"><div class="vb-col"><b style="height:${i.v == null ? 0 : Math.max(3, (i.v / top) * 100)}%;${color || i.color ? `background:${i.color || color}` : ''}"></b></div><span>${esc(i.label)}</span></div>`).join('')}</div>`;
}

// Horizontal labelled bars.
export function hbars(rows, { fmt = r => (r.pct == null ? '–' : r.pct + '%') } = {}) {
  return rows.map(r => `<div class="bar-row" data-tip="${esc(r.name)}: ${esc(fmt(r))}"><span class="bl">${esc(r.name)}</span><div class="bar"><b style="width:${r.pct ?? 0}%;background:${r.color || 'var(--acc)'}"></b></div><span class="bv">${esc(fmt(r))}</span></div>`).join('');
}

// Donut from [{label, value, color}].
export function donut(parts, size = 160, center = '') {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = size / 2 - 14, c = 2 * Math.PI * r;
  let off = 0;
  const segs = total ? parts.filter(p => p.value > 0).map(p => {
    const len = (p.value / total) * c;
    const s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="22" stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(p.label)}: ${Math.round(100 * p.value / total)}%</title></circle>`;
    off += len;
    return s;
  }).join('') : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="22"/>`;
  return `<div class="donut"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Breakdown">${segs}<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-weight="800" font-size="20" fill="currentColor">${esc(center)}</text></svg>
    <ul class="legend">${parts.map(p => `<li><i style="background:${p.color}"></i><span>${esc(p.label)}</span><b>${total ? Math.round(100 * p.value / total) : 0}%</b></li>`).join('')}</ul></div>`;
}

// Smooth line for a series of numbers (nulls are gaps), scaled to [min,max].
export function line(series, { h = 120, min = 0, max = 100, labels = [], dots = true, color = 'var(--acc)', fill = true } = {}) {
  const W = 600, pad = 10, n = series.length;
  const x = i => pad + (i * (W - 2 * pad)) / Math.max(1, n - 1);
  const y = v => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  const pts = series.map((v, i) => (v == null ? null : [x(i), y(v)]));
  let d = '', seg = [];
  const flush = () => { if (seg.length) { d += 'M' + seg.map(p => p.map(n => n.toFixed(1)).join(',')).join('L'); seg = []; } };
  pts.forEach(p => (p ? seg.push(p) : flush())); flush();
  const valid = pts.filter(Boolean);
  const area = fill && valid.length > 1 ? `<path d="M${valid[0][0]},${h - pad}L${valid.map(p => p.join(',')).join('L')}L${valid[valid.length - 1][0]},${h - pad}Z" fill="url(#gArea)"/>` : '';
  return `<svg class="line" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px" role="img" aria-label="Trend">
    ${[0.25, 0.5, 0.75].map(f => `<line x1="0" x2="${W}" y1="${pad + f * (h - 2 * pad)}" y2="${pad + f * (h - 2 * pad)}" stroke="var(--line)" stroke-dasharray="4 6"/>`).join('')}
    ${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    ${dots ? pts.map((p, i) => (p ? `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}" vector-effect="non-scaling-stroke"><title>${esc(labels[i] || '')}: ${series[i]}</title></circle>` : '')).join('') : ''}</svg>`;
}

// GitHub-style heatmap. cells: [{k, v (0-100|null), tip}], weeks run left to right.
export function heatmap(cells, startDow = 1) {
  if (!cells.length) return '';
  const first = new Date(cells[0].k + 'T12:00').getDay();
  const lead = (first - startDow + 7) % 7;
  const all = [...Array(lead).fill(null), ...cells];
  return `<div class="heatmap" style="--rows:7">${all.map(c => (c ? `<i data-tip="${esc(c.tip)}" style="--a:${c.v == null ? 0 : Math.max(0.18, c.v / 100)}" class="${c.v == null ? 'empty' : ''}${c.today ? ' today' : ''}"></i>` : '<i class="pad"></i>')).join('')}</div>`;
}

export function spark(series, w = 90, h = 28) {
  const vals = series.map(v => v ?? 0), max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => `${(i * w) / Math.max(1, vals.length - 1)},${h - 2 - (v / max) * (h - 4)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
