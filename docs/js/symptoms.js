'use strict';
/* Symptoms: rate each one 0-5 with an optional note, and see them over time. */

function segmented(options, current, onPick, label) {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label || 'View' },
    options.map(([val, text]) => h('button', { type: 'button', 'aria-pressed': String(val === current), onclick: () => onPick(val) }, text)));
}
const visibleSymptoms = () => S.symptoms.filter(s => !s.hidden);
function sxEntry(date, id) {
  const d = S.days[date];
  const e = d && d.sx && d.sx[id];
  return e && Number.isFinite(e.s) ? e : null;
}

function viewSymptoms() {
  const v = h('div', { class: 'view' });
  v.append(pageHead('Symptoms', UI.sxMode === 'log' ? 'Rate each one from 0 (none) to 5 (very severe)' : 'How each one has changed'));
  v.append(segmented([['log', 'Log a day'], ['trends', 'Over time']], UI.sxMode, val => { UI.sxMode = val; rerender(); }));
  if (UI.sxMode === 'log') symptomLog(v);
  else symptomTrends(v);
  return v;
}

function symptomLog(v) {
  const date = UI.date;
  v.append(dateNav(rerender));
  const syms = visibleSymptoms();
  const rated = syms.filter(s => sxEntry(date, s.id)).length;
  const c = h('section', { class: 'card' }, h('h2', null, fmtDate(date, 'med'), h('span', { class: 'count' }, `${rated} of ${syms.length} rated`)));
  for (const sym of syms) c.append(symptomRow(sym, date));
  v.append(h('p', { class: 'scale-key' }, '0 none · 1 very mild · 2 mild · 3 moderate · 4 severe · 5 very severe. Tap a number again to clear it.'));
  v.append(c);

  const input = h('input', { type: 'text', placeholder: 'e.g. Headache', 'aria-label': 'New symptom name' });
  const add = () => {
    const name = input.value.trim();
    if (!name) return;
    S.symptoms.push({ id: uid(), name });
    save();
    toast(`Added "${name}"`);
    rerender();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  v.append(card('Add a symptom to the list',
    h('div', { class: 'row' }, h('div', { class: 'grow' }, input), h('button', { class: 'btn', type: 'button', onclick: add }, 'Add')),
    h('p', { class: 'small muted', style: 'margin:10px 0 0' }, 'To rename or hide symptoms, go to More → Customize lists.')));
}

function symptomRow(sym, date) {
  const e = sxEntry(date, sym.id);
  const score = e ? e.s : null;
  const row = h('div', { class: 'sx' },
    h('div', { class: 'sx-name' },
      h('span', null, sym.name, sym.hint ? h('small', null, ` · ${sym.hint}`) : null),
      h('small', null, score == null ? '' : SCORE_LABELS[score])));
  const btns = h('div', { class: 'scores', role: 'group', 'aria-label': `${sym.name} score` });
  for (let i = 0; i <= 5; i++) {
    btns.append(h('button', { type: 'button', 'aria-pressed': String(score === i), 'aria-label': `${i}, ${SCORE_LABELS[i]}`,
      onclick: () => setScore(date, sym.id, score === i ? null : i) }, String(i)));
  }
  row.append(btns);
  if (score != null) {
    row.append(h('input', { type: 'text', placeholder: 'Short note (optional)', value: e.n || '', 'aria-label': `${sym.name} note`,
      oninput: ev => { const dd = ensureDay(date); if (dd.sx[sym.id]) { dd.sx[sym.id].n = ev.target.value; saveSoon(); } } }));
  }
  return row;
}

function setScore(date, id, val) {
  const d = ensureDay(date);
  if (val == null) delete d.sx[id];
  else d.sx[id] = { s: val, n: (d.sx[id] && d.sx[id].n) || '' };
  save();
  rerender();
}

function symptomTrends(v) {
  const end = today();
  const n = UI.sxRange;
  const dates = dateRange(addDays(end, -(n - 1)), end);
  v.append(segmented([[14, '2 weeks'], [30, '30 days'], [90, '90 days']], n, val => { UI.sxRange = val; UI.sxSel = null; rerender(); }, 'Time range'));

  const c = h('section', { class: 'card' }, h('h2', null, 'Day by day'));
  c.append(h('div', { class: 'axis-row' }, h('span', null, fmtDate(dates[0], 'short')), h('span', null, 'Today')));
  for (const sym of visibleSymptoms()) {
    const vals = dates.map(d => sxEntry(d, sym.id)).filter(Boolean).map(e => e.s);
    let summary = 'Not logged';
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      summary = `avg ${avg.toFixed(1)} · worst ${Math.max(...vals)} · ${vals.length} day${vals.length === 1 ? '' : 's'}`;
    }
    c.append(h('div', { class: 'strip-head' }, h('span', null, sym.name), h('small', null, summary)));
    const sel = UI.sxSel && UI.sxSel.sym === sym.id ? UI.sxSel.date : null;
    c.append(symptomStrip(sym, dates, sel, d => { UI.sxSel = { sym: sym.id, date: d }; rerender(); }));
    if (sel) c.append(stripDetail(sym, sel));
  }
  c.append(h('div', { style: 'margin-top:14px' }, scaleLegend()));
  c.append(h('p', { class: 'small muted', style: 'margin:8px 0 0' }, 'Tap a day to see its rating and note.'));
  v.append(c);
  v.append(symptomHistory(dates));
}

function stripDetail(sym, date) {
  const e = sxEntry(date, sym.id);
  return h('div', { class: 'strip-detail' },
    h('b', null, fmtDate(date, 'med')), ' · ',
    e ? `${e.s} (${SCORE_LABELS[e.s]})` : 'Not logged',
    e && e.n ? h('div', { class: 'note-text' }, e.n) : null,
    h('div', null, h('button', { class: 'linkbtn', type: 'button', onclick: () => { UI.date = date; UI.sxMode = 'log'; UI.sxSel = null; rerender(); window.scrollTo(0, 0); } }, 'Edit this day')));
}

// The same data as a list, newest first: the readable "table view" of the strips.
function symptomHistory(dates) {
  const c = h('section', { class: 'card' }, h('h2', null, 'History'));
  const list = h('ul', { class: 'list' });
  for (const d of [...dates].reverse()) {
    const items = S.symptoms.map(s => ({ s, e: sxEntry(d, s.id) })).filter(x => x.e);
    if (!items.length) continue;
    const present = items.filter(x => x.e.s > 0);
    const zeros = items.length - present.length;
    list.append(h('li', null,
      h('div', { style: 'font-weight:650' }, fmtDate(d, 'med')),
      present.map(x => h('div', { class: 'small' }, `${x.s.name}: ${x.e.s} (${SCORE_LABELS[x.e.s].toLowerCase()})`, x.e.n ? h('span', { class: 'muted' }, ` · ${x.e.n}`) : null)),
      zeros ? h('div', { class: 'small muted' }, `${zeros} rated 0`) : null));
  }
  if (!list.children.length) c.append(h('p', { class: 'empty' }, 'No symptoms logged in this time range.'));
  else c.append(list);
  return c;
}
