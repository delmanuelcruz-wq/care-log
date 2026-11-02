'use strict';
/* Labs: typed-in results, baseline values, and a trend chart per test. */

const visibleLabTests = () => S.labTests.filter(t => !t.hidden);
function labGroups(tests) {
  const groups = [];
  for (const t of tests) {
    let g = groups.find(x => x.name === t.group);
    if (!g) { g = { name: t.group || 'Other', tests: [] }; groups.push(g); }
    g.tests.push(t);
  }
  return groups;
}

function viewLabs(sub) {
  if (sub[0] === 'add') return labAddForm(sub[1]);
  if (sub[0]) return labDetail(sub[0]);
  const v = h('div', { class: 'view' });
  v.append(pageHead('Labs', 'Results typed in from your patient portal', h('a', { class: 'btn small primary', href: '#labs/add' }, '+ Add')));
  if (!S.labs.length) {
    v.append(card(null,
      h('p', null, 'No results yet. Start with your baseline numbers from before treatment, then add each new set of labs. Every test gets its own trend chart.'),
      h('a', { class: 'btn block primary', href: '#labs/add/baseline' }, 'Add baseline results')));
  }
  for (const g of labGroups(visibleLabTests())) {
    v.append(h('div', { class: 'section-label' }, g.name));
    const list = h('ul', { class: 'list' });
    for (const t of g.tests) {
      const series = labSeries(t.id);
      const latest = series[series.length - 1];
      const base = labBaseline(t.id);
      let sub2 = 'No results yet';
      if (latest) {
        sub2 = base && base.entry !== latest
          ? `${base.flagged ? 'Baseline' : 'First'} ${fmtNum(base.entry.value)} · ${changeText(base.entry.value, latest.value)}`
          : `${series.length} result${series.length === 1 ? '' : 's'}`;
      }
      list.append(h('li', null, h('a', { class: 'lab-row', href: `#labs/${encodeURIComponent(t.id)}` },
        h('div', { class: 'grow' }, h('div', { style: 'font-weight:600' }, t.name), h('div', { class: 'small muted' }, sub2)),
        h('div', { class: 'val' }, latest ? [h('b', null, fmtNum(latest.value)), ' ', h('span', { class: 'small muted' }, t.unit), h('small', null, fmtDate(latest.date, 'short'))] : h('span', { class: 'muted' }, '–')),
        h('span', { class: 'chev' }, icon('right')))));
    }
    v.append(h('section', { class: 'card' }, list));
  }
  return v;
}

function labDetail(testId) {
  const t = labTestById(testId);
  const v = h('div', { class: 'view' }, backLink('#labs', 'Labs'));
  if (!t) { v.append(card(null, h('p', null, 'That lab test was not found.'))); return v; }
  v.append(pageHead(t.name, [t.group, t.unit].filter(Boolean).join(' · '), h('a', { class: 'btn small primary', href: `#labs/add/${encodeURIComponent(t.id)}` }, '+ Add')));
  const series = labSeries(t.id);
  if (!series.length) {
    v.append(card(null, h('p', { class: 'empty' }, 'No results for this test yet.')));
    return v;
  }
  const base = labBaseline(t.id);
  const latest = series[series.length - 1];
  v.append(h('section', { class: 'card' }, h('div', { class: 'stat3' },
    h('div', null, h('small', null, base && base.flagged ? 'Baseline' : 'First'), h('b', null, fmtNum(base.entry.value)), h('span', null, fmtDate(base.entry.date, 'short'))),
    h('div', null, h('small', null, 'Latest'), h('b', null, fmtNum(latest.value)), h('span', null, fmtDate(latest.date, 'short'))),
    h('div', null, h('small', null, 'Change'), h('b', { style: 'font-size:16px' }, base.entry === latest ? '–' : changeText(base.entry.value, latest.value).split(' ')[0]),
      h('span', null, base.entry === latest ? 'Need 2 results' : (changeText(base.entry.value, latest.value).split(' ')[1] || ''))))));
  v.append(card('Trend', lineChart(series.map(l => ({ date: l.date, value: l.value, baseline: l.baseline })),
    { baseline: series.length > 1 && base ? base.entry.value : null, unit: t.unit, name: t.name })));

  const tbody = h('tbody');
  for (const l of [...series].reverse()) {
    tbody.append(h('tr', null,
      h('td', null, fmtDate(l.date, 'full'),
        l.baseline ? h('div', null, h('span', { class: 'pill-tag' }, 'Baseline')) : h('div', null, h('button', { class: 'linkbtn', style: 'font-size:13px;padding:2px 0', type: 'button', onclick: () => { for (const x of labSeries(t.id)) x.baseline = false; l.baseline = true; save(); rerender(); } }, 'Use as baseline'))),
      h('td', { class: 'num' }, h('b', null, fmtNum(l.value))),
      h('td', null, h('span', { class: 'small note-text' }, l.note || '')),
      h('td', { class: 'num' }, h('button', { class: 'linkbtn danger', type: 'button', 'aria-label': `Delete result from ${fmtDate(l.date, 'full')}`, onclick: () => {
        if (!confirm(`Delete the ${t.name} result from ${fmtDate(l.date, 'full')}?`)) return;
        S.labs = S.labs.filter(x => x.id !== l.id);
        save();
        rerender();
      } }, 'Delete'))));
  }
  v.append(card('All results', h('table', { class: 'data' },
    h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', { class: 'num' }, 'Value'), h('th', null, 'Note'), h('th', null, ''))), tbody)));
  return v;
}

function labAddForm(mode) {
  const single = mode && mode !== 'baseline' ? labTestById(mode) : null;
  const back = single ? `#labs/${encodeURIComponent(single.id)}` : '#labs';
  const v = h('div', { class: 'view' }, backLink(back, single ? single.name : 'Labs'));
  v.append(pageHead(single ? `Add ${single.name}` : 'Add results', 'Fill in only the ones you have'));
  const dateIn = h('input', { type: 'date', value: today(), max: today() });
  const baseIn = h('input', { type: 'checkbox', checked: mode === 'baseline' || (!S.labs.length && !single) });
  const noteIn = h('input', { type: 'text', placeholder: 'e.g. fasting, drawn at clinic' });
  const inputs = [];
  const form = h('section', { class: 'card' },
    field('Date of the blood draw or test', dateIn),
    h('label', { class: 'inline-check' }, baseIn, h('span', null, 'These are baseline results (before treatment)')));
  const tests = single ? [single] : visibleLabTests();
  for (const g of labGroups(tests)) {
    if (!single) form.append(h('div', { class: 'field-label', style: 'margin-top:16px;text-transform:uppercase;letter-spacing:.05em;font-size:12px;color:var(--muted)' }, g.name));
    for (const t of g.tests) {
      const inp = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: t.unit || 'value', 'aria-label': `${t.name}${t.unit ? ` in ${t.unit}` : ''}` });
      inputs.push({ t, inp });
      form.append(h('label', { class: 'row', style: 'margin-bottom:8px' },
        h('span', { class: 'grow' }, t.name, t.unit ? h('span', { class: 'small muted' }, ` (${t.unit})`) : null),
        h('span', { style: 'width:120px;flex-shrink:0' }, inp)));
    }
  }
  form.append(h('div', { style: 'margin-top:12px' }, field('Note (optional)', noteIn)));
  form.append(h('button', { class: 'btn block primary', type: 'button', onclick: () => {
    const date = dateIn.value;
    if (!isDate(date)) { toast('Pick a date first.'); return; }
    const good = [];
    const bad = [];
    for (const { t, inp } of inputs) {
      const raw = inp.value.trim().replace(',', '.');
      if (!raw) continue;
      const val = Number(raw);
      if (Number.isFinite(val)) good.push({ t, val });
      else bad.push(t.name);
    }
    if (bad.length) { toast(`Check the number for ${bad.join(', ')}.`); return; }
    if (!good.length) { toast('Type at least one value.'); return; }
    for (const { t, val } of good) {
      if (baseIn.checked) for (const x of labSeries(t.id)) x.baseline = false;
      S.labs.push({ id: uid(), date, test: t.id, value: val, baseline: baseIn.checked, note: noteIn.value.trim() });
    }
    const count = good.length;
    save();
    toast(`Saved ${count} result${count === 1 ? '' : 's'}`);
    location.hash = back;
  } }, 'Save results'));
  v.append(form);
  return v;
}
