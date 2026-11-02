'use strict';
/* Today: where treatment stands, the daily checklist, a symptom snapshot, activity and a note. */

function viewToday() {
  const date = UI.date;
  const t = today();
  const isToday = date === t;
  const v = h('div', { class: 'view' });
  v.append(pageHead(isToday ? 'Today' : fmtDate(date, 'long'),
    isToday ? fmtDate(date, 'long') : (date < t ? 'Looking back' : 'Looking ahead'),
    isToday ? null : h('button', { class: 'btn small soft', type: 'button', onclick: () => { UI.date = t; rerender(); } }, 'Today')));
  v.append(dateNav(rerender));
  if (!storageOK) v.append(h('div', { class: 'banner warn' }, 'This browser is not letting Care Log save. Turn off Private Browsing, then open the app again.'));
  if (!isStandalone() && !S.meta.hideInstallTip) v.append(installTip());
  v.append(treatmentCard(date));
  v.append(checklistCard(date));
  v.append(symptomSnapshot(date));
  v.append(activityCard(date));
  v.append(noteCard(date));
  const next = upcomingAppts(date)[0];
  if (next) v.append(card('Next appointment', apptLine(next, date)));
  return v;
}

function installTip() {
  return h('div', { class: 'banner' },
    h('b', null, 'Put Care Log on your Home Screen. '),
    'In Safari, tap the Share button, then ', h('b', null, 'Add to Home Screen'),
    '. It then opens like an app and works without internet.',
    h('div', { style: 'margin-top:8px' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => { S.meta.hideInstallTip = true; save(); rerender(); } }, 'Got it')));
}

function treatmentCard(date) {
  const list = h('ul', { class: 'list' });
  const meds = activeMeds();
  let started = 0;
  for (const m of meds) {
    if (medStarted(m, date)) started++;
    list.append(h('li', null, medStatus(m, date)));
  }
  const c = card('Treatment', list);
  if (!started) {
    const prepDone = S.prep.filter(p => p.done).length;
    c.append(h('div', { class: 'btn-row', style: 'margin-top:12px' },
      h('a', { class: 'btn small soft', href: '#more/treatment' }, 'Set start dates'),
      S.prep.length ? h('a', { class: 'btn small', href: '#visits' }, `Before you start: ${prepDone} of ${S.prep.length} done`) : null));
  }
  return c;
}

// Plain-text status for one medicine on a date: { title, sub, status, canLogInjection }
function medStatusParts(m, date) {
  const title = medLabel(m, date);
  let sub = '';
  let status = '';
  let canLogInjection = false;
  if (m.kind === 'cycle') {
    const ci = cycleInfo(m, date);
    if (!ci) {
      sub = `${m.onDays || 21} days on, ${m.offDays || 7} off`;
      const future = medEvents(m.id, ['cycle']).find(e => e.date > date);
      status = future ? `Starts ${fmtDate(future.date, 'short')} (${relDays(diffDays(date, future.date))})` : 'Not started yet';
    } else {
      sub = `Cycle ${ci.cycle}, day ${ci.day} of ${ci.len}`;
      const p = pausedSince(m, date);
      if (p) status = `Paused since ${fmtDate(p, 'short')}`;
      else if (ci.on) status = `Pill day ${ci.day} of ${ci.onDays}`;
      else status = `Break week. Next pill ${fmtDate(ci.nextOn, 'short')} (${relDays(diffDays(date, ci.nextOn))})`;
    }
  } else if (m.kind === 'injection') {
    const inf = injectionInfo(m, date);
    sub = intervalText(m.intervalDays);
    if (!inf) {
      status = 'No injection logged yet';
      canLogInjection = true;
    } else {
      sub = `Last given ${fmtDate(inf.last, 'short')} · ${intervalText(m.intervalDays)}`;
      if (inf.dueIn > 0) status = `Next due ${fmtDate(inf.next, 'short')} (${relDays(inf.dueIn)})`;
      else if (inf.dueIn === 0) status = 'Due today';
      else status = `Was due ${fmtDate(inf.next, 'short')} (${relDays(inf.dueIn)})`;
      if (inf.last !== date && inf.dueIn <= 3) canLogInjection = true;
      if (inf.last === date) status = 'Given today';
    }
  } else {
    sub = 'Daily pill';
    if (!medStarted(m, date)) status = isDate(m.start) ? `Starts ${fmtDate(m.start, 'short')}` : 'Start date not set';
    else {
      const p = pausedSince(m, date);
      status = p ? `Paused since ${fmtDate(p, 'short')}` : `Since ${fmtDate(m.start, 'short')}`;
    }
  }
  return { title, sub, status, canLogInjection };
}

function medStatus(m, date, withAction = true) {
  const p = medStatusParts(m, date);
  return h('div', null,
    h('div', { class: 'row between' },
      h('div', { class: 'grow' }, h('div', { style: 'font-weight:650' }, p.title), h('div', { class: 'small muted' }, p.sub)),
      withAction && p.canLogInjection ? logInjectionButton(m, date) : null),
    p.status ? h('div', { class: 'small', style: 'margin-top:3px;color:var(--accent-text);font-weight:600' }, p.status) : null);
}

function logInjectionButton(m, date) {
  return h('button', { class: 'btn small soft', type: 'button', onclick: () => {
    S.events.push({ id: uid(), date, med: m.id, type: 'injection', note: '' });
    save();
    toast(`${m.name} injection logged for ${fmtDate(date, 'short')}`);
    rerender();
  } }, 'Log injection');
}

function checklistCard(date) {
  const d = getDay(date);
  const pills = pillsFor(date).filter(p => p.due);
  const rows = [];
  let done = 0;
  for (const p of pills) {
    const on = !!(d && d.meds && d.meds[p.med.id]);
    if (on) done++;
    rows.push(checkRow({
      label: medLabel(p.med, date),
      sub: p.cycle ? `Cycle ${p.cycle.cycle}, pill day ${p.cycle.day} of ${p.cycle.onDays}` : 'Daily',
      on,
      onToggle: () => togglePath(date, 'meds', p.med.id),
    }));
  }
  for (const s of S.supplements.filter(x => !x.hidden)) {
    const on = !!(d && d.supps && d.supps[s.id]);
    if (on) done++;
    rows.push(checkRow({ label: s.name, sub: 'Supplement', on, onToggle: () => togglePath(date, 'supps', s.id) }));
  }
  const total = rows.length;
  const c = h('section', { class: 'card' },
    h('h2', null, 'Pills & supplements', h('span', { class: 'count' }, total ? `${done} of ${total}` : '')));
  if (!total) c.append(h('p', { class: 'empty' }, 'Nothing scheduled for this day.'));
  else c.append(h('div', null, rows));
  const breakMeds = pillsFor(date).filter(p => !p.due);
  for (const p of breakMeds) {
    c.append(h('p', { class: 'small muted', style: 'margin:8px 0 0' },
      p.paused ? `${p.med.name} is paused.` : `No ${p.med.name} today (break week).`));
  }
  return c;
}

function togglePath(date, key, id) {
  const d = ensureDay(date);
  if (d[key][id]) delete d[key][id];
  else d[key][id] = true;
  save();
  rerender();
}

function symptomSnapshot(date) {
  const d = getDay(date);
  const sx = (d && d.sx) || {};
  const rated = S.symptoms.filter(s => sx[s.id] && Number.isFinite(sx[s.id].s));
  const present = rated.filter(s => sx[s.id].s > 0).sort((a, b) => sx[b.id].s - sx[a.id].s);
  const c = h('section', { class: 'card' }, h('h2', null, 'Symptoms', h('span', { class: 'count' }, rated.length ? `${rated.length} rated` : '')));
  if (!rated.length) {
    c.append(h('p', { class: 'empty' }, 'Nothing logged for this day yet.'));
  } else if (!present.length) {
    c.append(h('p', null, 'All rated 0 (none).'));
  } else {
    c.append(h('div', { class: 'chips', style: 'margin-bottom:4px' },
      present.map(s => h('span', { class: 'pill-tag' }, `${s.name} ${sx[s.id].s}`))));
  }
  c.append(h('div', { style: 'margin-top:12px' },
    h('a', { class: 'btn block soft', href: '#symptoms', onclick: () => { UI.sxMode = 'log'; } }, rated.length ? 'Update symptoms' : 'Log symptoms')));
  return c;
}

function weekStats(date) {
  const start = weekStart(date);
  let strength = 0;
  let cardio = 0;
  let fish = 0;
  for (const d of dateRange(start, addDays(start, 6))) {
    const r = S.days[d];
    if (!r) continue;
    if (r.strength) strength++;
    cardio += Number(r.cardio) || 0;
    if (r.fish) fish++;
  }
  return { start, strength, cardio, fish };
}

function activityCard(date) {
  const d = getDay(date) || {};
  const minutes = Number(d.cardio) || 0;
  const setCardio = val => {
    const dd = ensureDay(date);
    dd.cardio = clamp(Math.round(Number(val) || 0), 0, 600);
    save();
    rerender();
  };
  const input = h('input', { type: 'number', inputmode: 'numeric', min: '0', max: '600', value: String(minutes), 'aria-label': 'Cardio minutes', onchange: e => setCardio(e.target.value) });
  const w = weekStats(date);
  const g = S.goals;
  const strengthPct = g.strengthPerWeek ? clamp(w.strength / g.strengthPerWeek, 0, 1) : 0;
  const cardioPct = g.cardioMinPerWeek ? clamp(w.cardio / g.cardioMinPerWeek, 0, 1) : 0;
  return card('Movement & food',
    checkRow({ label: 'Strength training', sub: 'Did a session this day', on: !!d.strength, onToggle: () => { const dd = ensureDay(date); dd.strength = !dd.strength; save(); rerender(); } }),
    h('div', { class: 'row between', style: 'padding:10px 0;border-top:1px solid var(--line)' },
      h('div', null, h('div', null, 'Cardio'), h('div', { class: 'small muted' }, 'Minutes this day')),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': 'Less cardio', onclick: () => setCardio(minutes - 10) }, '−'),
        input,
        h('button', { type: 'button', 'aria-label': 'More cardio', onclick: () => setCardio(minutes + 10) }, '+'))),
    checkRow({ label: 'Fish meal', sub: 'Optional', on: !!d.fish, onToggle: () => { const dd = ensureDay(date); dd.fish = !dd.fish; save(); rerender(); } }),
    h('div', { style: 'border-top:1px solid var(--line);padding-top:10px;margin-top:2px' },
      h('div', { class: 'small' }, `Week of ${fmtDate(w.start, 'short')}: ${w.strength} of ${g.strengthPerWeek} strength sessions`),
      h('div', { class: 'meter', role: 'img', 'aria-label': `${w.strength} of ${g.strengthPerWeek} strength sessions` }, h('div', { style: `width:${strengthPct * 100}%` })),
      h('div', { class: 'small', style: 'margin-top:8px' }, `${w.cardio} of ${g.cardioMinPerWeek} cardio minutes · ${w.fish} fish meal${w.fish === 1 ? '' : 's'}`),
      h('div', { class: 'meter', role: 'img', 'aria-label': `${w.cardio} of ${g.cardioMinPerWeek} cardio minutes` }, h('div', { style: `width:${cardioPct * 100}%` }))));
}

function noteCard(date) {
  const d = getDay(date);
  return card('Note',
    h('textarea', { placeholder: 'Anything else about this day…', 'aria-label': 'Note for this day', value: (d && d.note) || '',
      oninput: e => { ensureDay(date).note = e.target.value; saveSoon(); } }));
}
