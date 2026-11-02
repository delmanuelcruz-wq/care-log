'use strict';
/* Treatment: medicine details, cycle starts, dose changes, pauses and injections. */

const KIND_TEXT = { cycle: 'Pill on a cycle', daily: 'Daily pill', injection: 'Injection' };

function eventText(e, m) {
  switch (e.type) {
    case 'cycle': return `Cycle ${e.cycle || 1} started`;
    case 'injection': return 'Injection given';
    case 'dose': return `Dose changed to ${e.dose}`;
    case 'pause': return 'Paused';
    case 'resume': return 'Resumed';
    default: return e.type;
  }
}

function viewTreatment() {
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Treatment', 'Medicines, cycles, doses and injections'));
  for (const m of S.meds.filter(x => x.active !== false)) v.append(medCard(m));
  v.append(addMedCard());
  const stopped = S.meds.filter(x => x.active === false);
  if (stopped.length) {
    v.append(h('div', { class: 'section-label' }, 'Not tracking'));
    v.append(h('section', { class: 'card' }, h('ul', { class: 'list' }, stopped.map(m => h('li', { class: 'row between' },
      h('span', null, m.name),
      h('button', { class: 'btn small', type: 'button', onclick: () => { m.active = true; save(); rerender(); } }, 'Track again'))))));
  }
  return v;
}

function medCard(m) {
  const t = today();
  const c = h('section', { class: 'card' });
  c.append(h('div', { class: 'row between', style: 'margin-bottom:6px' },
    h('div', { class: 'grow' }, h('div', { class: 'big' }, m.name), h('div', { class: 'small muted' },
      m.kind === 'cycle' ? `${m.onDays} days on, ${m.offDays} days off` : m.kind === 'injection' ? `Injection ${intervalText(m.intervalDays)}` : 'Daily pill')),
    h('span', { class: 'pill-tag gray' }, KIND_TEXT[m.kind])));
  c.append(medStatus(m, t, false));

  // Actions
  const act = (type, label) => h('button', { class: 'btn small soft', type: 'button', onclick: () => { UI.treatForm = { med: m.id, type }; rerender(); } }, label);
  const actions = [];
  if (m.kind === 'cycle') actions.push(act('cycle', cycleInfo(m, t) ? 'Start next cycle' : 'Set cycle 1, day 1'));
  if (m.kind === 'injection') actions.push(act('injection', 'Log injection'));
  if (m.kind !== 'injection') {
    actions.push(act('dose', 'Change dose'));
    actions.push(isPaused(m, t) ? act('resume', 'Resume') : act('pause', 'Pause'));
  }
  if (m.kind === 'daily' && !isDate(m.start)) {
    c.append(h('div', { style: 'margin-top:12px' }, field('Start date', h('input', { type: 'date', onchange: e => { if (isDate(e.target.value)) { m.start = e.target.value; save(); rerender(); } } }))));
  }
  c.append(h('div', { class: 'btn-row', style: 'margin-top:12px' }, actions));
  if (UI.treatForm && UI.treatForm.med === m.id) c.append(eventForm(m, UI.treatForm.type));

  // History
  const evs = medEvents(m.id).reverse();
  if (evs.length) {
    const list = h('ul', { class: 'list' });
    for (const e of evs) {
      list.append(h('li', { class: 'row' },
        h('div', { class: 'grow' }, h('div', null, eventText(e, m)), h('div', { class: 'small muted' }, fmtDate(e.date, 'full'), e.note ? ` · ${e.note}` : '')),
        h('button', { class: 'linkbtn danger', type: 'button', 'aria-label': `Delete ${eventText(e, m)} on ${fmtDate(e.date, 'full')}`, onclick: () => {
          if (!confirm(`Delete "${eventText(e, m)}" on ${fmtDate(e.date, 'full')}?`)) return;
          S.events = S.events.filter(x => x.id !== e.id);
          save();
          rerender();
        } }, 'Delete')));
    }
    c.append(h('div', { class: 'section-label', style: 'margin:16px 0 4px' }, 'History'), list);
  }

  // Details (rarely changed)
  const nameIn = h('input', { type: 'text', value: m.name, onchange: e => { if (e.target.value.trim()) { m.name = e.target.value.trim(); save(); rerender(); } } });
  const doseIn = h('input', { type: 'text', value: m.dose || '', placeholder: 'e.g. 2.5 mg', onchange: e => { m.dose = e.target.value.trim(); save(); rerender(); } });
  const details = h('div', { style: 'margin-top:12px' },
    field('Name (for example, the exact aromatase inhibitor)', nameIn),
    field(m.kind === 'injection' ? 'Dose (optional)' : 'Starting dose', doseIn));
  if (m.kind === 'cycle') {
    details.append(h('div', { class: 'two' },
      field('Days on', h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '60', value: String(m.onDays), onchange: e => { m.onDays = clamp(Number(e.target.value) || 21, 1, 60); save(); rerender(); } })),
      field('Days off', h('input', { type: 'number', inputmode: 'numeric', min: '0', max: '60', value: String(m.offDays), onchange: e => { m.offDays = clamp(Number(e.target.value) || 0, 0, 60); save(); rerender(); } }))));
  }
  if (m.kind === 'injection') {
    const sel = h('select', { onchange: e => { m.intervalDays = Number(e.target.value); save(); rerender(); } },
      [[28, 'Every 4 weeks (monthly)'], [84, 'Every 12 weeks (3-month)']].map(([val, text]) => h('option', { value: String(val), selected: Number(m.intervalDays) === val }, text)));
    details.append(field('How often', sel));
  }
  if (m.kind === 'daily' && isDate(m.start)) {
    details.append(field('Start date', h('input', { type: 'date', value: m.start, onchange: e => { m.start = isDate(e.target.value) ? e.target.value : ''; save(); rerender(); } })));
  }
  details.append(h('button', { class: 'btn small danger', type: 'button', onclick: () => {
    if (!confirm(`Stop tracking ${m.name}? Its history stays saved.`)) return;
    m.active = false;
    save();
    rerender();
  } }, 'Stop tracking'));
  c.append(h('details', { style: 'margin-top:14px' }, h('summary', null, 'Edit details'), details));
  return c;
}

function eventForm(m, type) {
  const t = today();
  const dateIn = h('input', { type: 'date', value: t });
  const noteIn = h('input', { type: 'text', placeholder: type === 'pause' ? 'Reason, e.g. low white count' : 'Optional' });
  const extra = [];
  let cycleIn = null;
  let doseIn = null;
  if (type === 'cycle') {
    const prev = cycleInfo(m, addDays(t, -1));
    cycleIn = h('input', { type: 'number', inputmode: 'numeric', min: '1', value: String(prev ? prev.cycle + 1 : 1) });
    extra.push(field('Cycle number', cycleIn));
  }
  if (type === 'dose') {
    doseIn = h('input', { type: 'text', placeholder: 'e.g. 400 mg', value: '' });
    extra.push(field('New dose', doseIn));
  }
  const title = { cycle: 'Start a cycle (day 1 = first pill)', injection: 'Log an injection', dose: 'Change dose', pause: 'Pause this medicine', resume: 'Resume this medicine' }[type];
  return h('div', { class: 'card', style: 'background:var(--bg);margin:12px 0 0' },
    h('div', { style: 'font-weight:650;margin-bottom:10px' }, title),
    field('Date', dateIn), extra, field('Note', noteIn),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => {
        if (!isDate(dateIn.value)) { toast('Pick a date.'); return; }
        const e = { id: uid(), date: dateIn.value, med: m.id, type, note: noteIn.value.trim() };
        if (type === 'cycle') e.cycle = Math.max(1, Math.round(Number(cycleIn.value) || 1));
        if (type === 'dose') {
          if (!doseIn.value.trim()) { toast('Type the new dose.'); return; }
          e.dose = doseIn.value.trim();
        }
        S.events.push(e);
        UI.treatForm = null;
        save();
        toast('Saved');
        rerender();
      } }, 'Save'),
      h('button', { class: 'btn', type: 'button', onclick: () => { UI.treatForm = null; rerender(); } }, 'Cancel')));
}

function addMedCard() {
  const nameIn = h('input', { type: 'text', placeholder: 'Medicine name' });
  const kindSel = h('select', null, Object.entries(KIND_TEXT).map(([k, text]) => h('option', { value: k, selected: k === 'daily' }, text)));
  return h('section', { class: 'card' },
    h('details', null, h('summary', null, 'Add another medicine'),
      h('div', { style: 'margin-top:12px' },
        field('Name', nameIn), field('Type', kindSel),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          const name = nameIn.value.trim();
          if (!name) { toast('Type a name.'); return; }
          S.meds.push({ id: uid(), name, kind: kindSel.value, dose: '', onDays: 21, offDays: 7, intervalDays: 28, start: '', active: true });
          save();
          toast(`Added ${name}`);
          rerender();
        } }, 'Add medicine'))));
}
