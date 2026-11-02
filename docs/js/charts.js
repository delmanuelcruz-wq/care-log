'use strict';
/* Charts: a single-series line chart for lab trends and a day-by-day heat strip for symptoms.
   Colors come from CSS tokens so light and dark mode both work. */

// Inner width of a card on this screen (main padding 16+16, card padding 16+16, border 1+1).
function cardInnerWidth() { return Math.min(window.innerWidth, 560) - 32 - 34; }

function niceStep(x) {
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nf * Math.pow(10, exp);
}
function niceTicks(lo, hi, count) {
  const step = niceStep((hi - lo) / count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return ticks;
}

/* Line chart. points: [{date, value}] sorted by date. opts: { baseline, unit, name } */
function lineChart(points, opts = {}) {
  const W = Math.max(260, cardInnerWidth());
  const H = 200;
  const m = { l: 40, r: 46, t: 18, b: 28 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const vals = points.map(p => p.value);
  if (opts.baseline != null) vals.push(opts.baseline);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) { const padv = Math.abs(lo) * 0.15 || 1; lo -= padv; hi += padv; }
  else { const padv = (hi - lo) * 0.08; lo -= padv; hi += padv; }
  const ticks = niceTicks(lo, hi, 4);
  lo = ticks[0];
  hi = ticks[ticks.length - 1];
  const t0 = utcOf(points[0].date);
  const t1 = utcOf(points[points.length - 1].date);
  const x = d => (t1 === t0 ? m.l + iw / 2 : m.l + ((utcOf(d) - t0) / (t1 - t0)) * iw);
  const y = v => m.t + (1 - (v - lo) / (hi - lo)) * ih;

  const last = points[points.length - 1];
  const svg = svgEl('svg', {
    width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `${opts.name || 'Lab'} over time: ${points.length} result${points.length === 1 ? '' : 's'}. Latest ${fmtNum(last.value)} ${opts.unit || ''} on ${fmtDate(last.date, 'full')}.`,
  });
  // gridlines + y ticks
  for (const t of ticks) {
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), style: `stroke: var(--chart-grid); stroke-width: 1` }));
    svg.append(svgEl('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, fmtNum(t)));
  }
  // x axis line + date labels
  svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih, style: 'stroke: var(--chart-axis); stroke-width: 1' }));
  if (points.length === 1 || t0 === t1) {
    svg.append(svgEl('text', { x: m.l + iw / 2, y: H - 8, 'text-anchor': 'middle' }, fmtDate(points[0].date, 'short')));
  } else {
    svg.append(svgEl('text', { x: m.l, y: H - 8, 'text-anchor': 'start' }, fmtDate(points[0].date, 'short')));
    svg.append(svgEl('text', { x: W - m.r, y: H - 8, 'text-anchor': 'end' }, fmtDate(last.date, 'short')));
  }
  // baseline reference
  if (opts.baseline != null) {
    const by = y(opts.baseline);
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: by, y2: by, style: 'stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3' }));
    // Put the label where no data point sits: try left, middle, right, above then below the line.
    const label = `Baseline ${fmtNum(opts.baseline)}`;
    const lw = label.length * 6.6;
    const spots = [];
    for (const dy of [-6, 15]) {
      spots.push({ x: m.l + 4, anchor: 'start', x0: m.l + 4, dy });
      spots.push({ x: m.l + iw / 2, anchor: 'middle', x0: m.l + iw / 2 - lw / 2, dy });
      spots.push({ x: W - m.r - 4, anchor: 'end', x0: W - m.r - 4 - lw, dy });
    }
    const clear = s => points.every(p => {
      const px = x(p.date);
      const py = y(p.value);
      const top = by + s.dy - 12;
      return px < s.x0 - 8 || px > s.x0 + lw + 8 || py < top - 6 || py > top + 18;
    });
    const spot = spots.find(clear) || spots[0];
    svg.append(svgEl('text', { x: spot.x, y: by + spot.dy, 'text-anchor': spot.anchor }, label));
  }
  // line + markers
  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    svg.append(svgEl('path', { d, style: 'fill: none; stroke: var(--chart); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round' }));
  }
  for (const p of points) {
    svg.append(svgEl('circle', { cx: x(p.date), cy: y(p.value), r: 4, style: 'fill: var(--chart); stroke: var(--card); stroke-width: 2' }));
  }
  // latest value label at the end of the line
  svg.append(svgEl('text', { x: x(last.date) + 9, y: y(last.value) + 4, class: 'v-label', 'text-anchor': 'start' }, fmtNum(last.value)));

  // hover / tap layer
  const cross = svgEl('line', { y1: m.t, y2: m.t + ih, style: 'stroke: var(--chart-axis); stroke-width: 1; display: none' });
  const dot = svgEl('circle', { r: 6, style: 'fill: var(--chart); stroke: var(--card); stroke-width: 2; display: none' });
  const hit = svgEl('rect', { x: m.l - 12, y: 0, width: iw + 24, height: H, style: 'fill: transparent' });
  svg.append(cross, dot, hit);

  const tip = h('div', { class: 'tip', style: 'display:none' });
  const wrap = h('div', { class: 'chart', tabindex: '0', 'aria-label': 'Chart. Use left and right arrow keys to read each result.' }, svg, tip);
  let sel = -1;
  function show(i) {
    sel = clamp(i, 0, points.length - 1);
    const p = points[sel];
    const px = x(p.date);
    const py = y(p.value);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.display = '';
    dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.style.display = '';
    tip.replaceChildren(
      h('b', null, `${fmtNum(p.value)} ${opts.unit || ''}`.trim()),
      h('span', null, h('span', { class: 'key' }), fmtDate(p.date, 'full'), p.baseline ? ' · baseline' : ''));
    tip.style.display = '';
    tip.style.left = `${clamp(px, 60, W - 60)}px`;
    tip.style.top = `${Math.max(-6, py - 62)}px`;
  }
  function hide() { cross.style.display = 'none'; dot.style.display = 'none'; tip.style.display = 'none'; sel = -1; }
  function nearest(evt) {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => { const dd = Math.abs(x(p.date) - px); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  hit.addEventListener('pointermove', e => show(nearest(e)));
  hit.addEventListener('pointerdown', e => show(nearest(e)));
  hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  wrap.addEventListener('focus', () => { if (sel < 0) show(points.length - 1); }); // keyboard users start at the latest result
  wrap.addEventListener('blur', hide);
  wrap.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { show((sel < 0 ? points.length : sel) - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(sel + 1); e.preventDefault(); }
    if (e.key === 'Escape') hide();
  });
  return wrap;
}

/* Symptom heat strip: one cell per day, darker = worse. Blank cells = nothing logged. */
function symptomStrip(sym, dates, selDate, onSelect) {
  const W = Math.max(240, cardInnerWidth());
  const H = 22;
  const n = dates.length;
  const gap = n > 45 ? 1 : 2;
  const cw = (W - gap * (n - 1)) / n;
  const rx = Math.min(3, cw / 3);
  let logged = 0;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img' });
  dates.forEach((d, i) => {
    const e = S.days[d] && S.days[d].sx && S.days[d].sx[sym.id];
    const score = e && Number.isFinite(e.s) ? e.s : null;
    if (score != null) logged++;
    const fill = score == null ? 'var(--empty)' : `var(--s${score})`;
    const rect = svgEl('rect', { x: i * (cw + gap), y: 1, width: cw, height: H - 2, rx, style: `fill: ${fill}` });
    if (d === selDate) rect.setAttribute('style', `fill: ${fill}; stroke: var(--ink); stroke-width: 2`);
    rect.append(svgEl('title', null, `${fmtDate(d, 'med')}: ${score == null ? 'not logged' : `${score} (${SCORE_LABELS[score]})`}`));
    svg.append(rect);
  });
  svg.setAttribute('aria-label', `${sym.name}: logged on ${logged} of ${n} days.`);
  svg.addEventListener('click', evt => {
    const r = svg.getBoundingClientRect();
    const i = clamp(Math.floor(((evt.clientX - r.left) / r.width) * n), 0, n - 1);
    onSelect(dates[i]);
  });
  return h('div', { class: 'strip' }, svg);
}

function scaleLegend() {
  return h('div', { class: 'legend', 'aria-label': 'Color scale' },
    h('span', null, h('span', { class: 'sw', style: 'background: var(--empty); outline: 1px solid var(--line-2)' }), 'Not logged'),
    [0, 1, 2, 3, 4, 5].map(i => h('span', null, h('span', { class: 'sw', style: `background: var(--s${i})` }), String(i))),
    h('span', null, '(0 none → 5 very severe)'));
}
