'use strict';
/* Visits: appointments, the before-treatment checklist, and reminders for the iPhone Calendar. */

const apptKey = a => `${a.date} ${a.time || '99:99'}`;
function upcomingAppts(from) {
  return S.appts.filter(a => a.date >= from).sort((a, b) => (apptKey(a) < apptKey(b) ? -1 : 1));
}
function pastAppts(before) {
  return S.appts.filter(a => a.date < before).sort((a, b) => (apptKey(a) < apptKey(b) ? 1 : -1));
}
function apptLine(a, from) {
  const d = parseDate(a.date);
  const rel = diffDays(from || today(), a.date);
  return h('div', { class: 'appt' },
    h('div', { class: 'datebox' }, h('small', null, fmtDate(a.date, 'month')), h('b', null, String(d.getDate()))),
    h('div', { class: 'grow' },
      h('div', { style: 'font-weight:650' }, a.title),
      h('div', { class: 'small muted' }, [fmtDate(a.date, 'med'), fmtTime(a.time), a.place].filter(Boolean).join(' · ')),
      rel >= 0 && rel <= 30 ? h('div', { class: 'small', style: 'color:var(--accent-text);font-weight:600' }, relDays(rel).replace(/^./, c => c.toUpperCase())) : null,
      a.note ? h('div', { class: 'small note-text', style: 'margin-top:4px' }, a.note) : null));
}

function viewVisits(sub) {
  if (sub[0] === 'new') return apptForm(null);
  if (sub[0] === 'edit') return apptForm(sub[1]);
  const t = today();
  const v = h('div', { class: 'view' });
  v.append(pageHead('Visits', 'Appointments and getting ready', h('a', { class: 'btn small primary', href: '#visits/new' }, '+ Add')));

  const up = upcomingAppts(t);
  const upList = h('ul', { class: 'list' });
  for (const a of up) {
    upList.append(h('li', null, apptLine(a, t),
      h('div', { class: 'btn-row', style: 'margin:10px 0 0 64px' },
        h('button', { class: 'btn small soft', type: 'button', onclick: () => sendToCalendar(`appointment-${a.date}.ics`, icsFile([icsEvent({ uid: a.id, date: a.date, time: a.time, minutes: 60, title: a.title, place: a.place, note: a.note, alarms: a.time ? ['-PT1H', '-P1D'] : ['-PT15H'] })])) }, 'Add to Calendar'),
        h('a', { class: 'btn small', href: `#visits/edit/${encodeURIComponent(a.id)}` }, 'Edit'))));
  }
  v.append(card('Coming up', up.length ? upList : h('p', { class: 'empty' }, 'No upcoming appointments.')));
  v.append(prepCard());
  v.append(reminderCard());

  const past = pastAppts(t);
  if (past.length) {
    const list = h('ul', { class: 'list', style: 'margin-top:10px' });
    for (const a of past) list.append(h('li', null, h('a', { href: `#visits/edit/${encodeURIComponent(a.id)}`, style: 'color:inherit;text-decoration:none;display:block' }, apptLine(a, t))));
    v.append(h('section', { class: 'card' }, h('details', null, h('summary', null, `Past appointments (${past.length})`), list)));
  }
  return v;
}

function prepCard() {
  const done = S.prep.filter(p => p.done).length;
  const c = h('section', { class: 'card' }, h('h2', null, 'Before starting treatment', h('span', { class: 'count' }, `${done} of ${S.prep.length} done`)));
  for (const p of S.prep) {
    c.append(h('div', { class: 'row' },
      h('div', { class: 'grow' }, checkRow({
        label: p.title,
        sub: p.done ? (p.date ? `Done ${fmtDate(p.date, 'short')}` : 'Done') : null,
        on: p.done,
        onToggle: () => { p.done = !p.done; p.date = p.done ? today() : ''; save(); rerender(); },
      })),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${p.title}`, style: 'color:var(--muted);font-size:22px', onclick: () => {
        if (!confirm(`Remove "${p.title}" from the list?`)) return;
        S.prep = S.prep.filter(x => x.id !== p.id);
        save();
        rerender();
      } }, '×')));
  }
  const input = h('input', { type: 'text', placeholder: 'Add a step, e.g. Eye exam', 'aria-label': 'New checklist step' });
  const add = () => {
    const title = input.value.trim();
    if (!title) return;
    S.prep.push({ id: uid(), title, done: false, date: '' });
    save();
    rerender();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  c.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('div', { class: 'grow' }, input), h('button', { class: 'btn', type: 'button', onclick: add }, 'Add')));
  return c;
}

const APPT_SUGGESTIONS = ['Oncology visit', 'Lab work', 'Zoladex injection', 'Bone density scan', 'Cardiology / EKG', 'Dental', 'Imaging'];

function apptForm(id) {
  const a = id ? S.appts.find(x => x.id === id) : null;
  const v = h('div', { class: 'view' }, backLink('#visits', 'Visits'));
  if (id && !a) { v.append(card(null, h('p', null, 'That appointment was not found.'))); return v; }
  v.append(pageHead(a ? 'Edit appointment' : 'New appointment'));
  const title = h('input', { type: 'text', list: 'appt-suggest', value: a ? a.title : '', placeholder: 'e.g. Oncology visit' });
  const date = h('input', { type: 'date', value: a ? a.date : today() });
  const time = h('input', { type: 'time', value: a ? a.time || '' : '' });
  const place = h('input', { type: 'text', value: a ? a.place || '' : '', placeholder: 'Clinic or address' });
  const note = h('textarea', { value: a ? a.note || '' : '', placeholder: 'Questions to ask, what to bring…' });
  v.append(h('section', { class: 'card' },
    h('datalist', { id: 'appt-suggest' }, APPT_SUGGESTIONS.map(s => h('option', { value: s }))),
    field('What', title),
    h('div', { class: 'two' }, field('Date', date), field('Time (optional)', time)),
    field('Where (optional)', place),
    field('Notes (optional)', note),
    h('button', { class: 'btn block primary', type: 'button', onclick: () => {
      if (!title.value.trim()) { toast('Add a name for the appointment.'); return; }
      if (!isDate(date.value)) { toast('Pick a date.'); return; }
      const rec = a || { id: uid() };
      Object.assign(rec, { title: title.value.trim(), date: date.value, time: time.value || '', place: place.value.trim(), note: note.value.trim() });
      if (!a) S.appts.push(rec);
      save();
      toast('Appointment saved');
      location.hash = '#visits';
    } }, 'Save'),
    a ? h('button', { class: 'btn block danger', style: 'margin-top:10px', type: 'button', onclick: () => {
      if (!confirm('Delete this appointment?')) return;
      S.appts = S.appts.filter(x => x.id !== a.id);
      save();
      location.hash = '#visits';
    } }, 'Delete appointment') : null));
  return v;
}

/* ---------------- calendar (.ics) ---------------- */
function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
const icsDay = d => d.replace(/-/g, '');
function icsLocal(dt) { return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`; }
// One calendar event. Times are "floating", so the phone reads them as local time.
function icsEvent({ uid: id, date, time, minutes = 30, title, place, note, rrule, alarms = [] }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VEVENT', `UID:${id}@carelog`, `DTSTAMP:${stamp}`];
  if (time) {
    const [H, M] = time.split(':').map(Number);
    const start = parseDate(date);
    start.setHours(H, M, 0, 0);
    const end = new Date(start.getTime() + minutes * 60000);
    lines.push(`DTSTART:${icsLocal(start)}`, `DTEND:${icsLocal(end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDay(date)}`, `DTEND;VALUE=DATE:${icsDay(addDays(date, 1))}`);
  }
  lines.push(`SUMMARY:${icsEscape(title)}`);
  if (place) lines.push(`LOCATION:${icsEscape(place)}`);
  if (note) lines.push(`DESCRIPTION:${icsEscape(note)}`);
  if (rrule) lines.push(`RRULE:${rrule}`);
  for (const trig of alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, `TRIGGER:${trig}`, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines;
}
function icsFile(events) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Care Log//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events.flat(), 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
// On iPhone, opening calendar data shows the "Add to Calendar" sheet. Elsewhere it downloads a .ics file.
function sendToCalendar(filename, text) {
  if (isIOS()) {
    const url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text);
    const w = window.open(url, '_blank');
    if (!w) location.href = url;
  } else {
    download(filename, 'text/calendar', text);
    toast('Calendar file downloaded. Open it to add the events.');
  }
}

function reminderCard() {
  const timeIn = h('input', { type: 'time', value: S.meta.reminderTime || '09:00', 'aria-label': 'Reminder time',
    onchange: e => { S.meta.reminderTime = e.target.value || '09:00'; save(); } });
  const rt = () => timeIn.value || '09:00';
  const daily = activeMeds().filter(m => m.kind === 'daily').map(m => m.name).concat(S.supplements.filter(s => !s.hidden).map(s => s.name));
  const cycleMeds = activeMeds().filter(m => m.kind === 'cycle');
  const injMeds = activeMeds().filter(m => m.kind === 'injection');
  const buttons = [];
  if (daily.length) {
    buttons.push(h('button', { class: 'btn small soft', type: 'button', onclick: () => {
      sendToCalendar('daily-reminder.ics', icsFile([icsEvent({ uid: 'daily-' + uid(), date: today(), time: rt(), minutes: 10, title: `Take: ${daily.join(', ')}`, rrule: 'FREQ=DAILY', alarms: ['PT0M'] })]));
    } }, 'Daily pills & supplements'));
  }
  for (const m of cycleMeds) {
    buttons.push(h('button', { class: 'btn small soft', type: 'button', onclick: () => {
      const evs = cycleReminderEvents(m, rt());
      if (!evs) { toast(`Set the first cycle date for ${m.name} in More → Treatment.`); return; }
      sendToCalendar(`${m.name.toLowerCase()}-pill-days.ics`, icsFile(evs));
    } }, `${m.name} pill days (next 6 cycles)`));
  }
  for (const m of injMeds) {
    buttons.push(h('button', { class: 'btn small soft', type: 'button', onclick: () => {
      const inf = injectionInfo(m, today());
      if (!inf) { toast(`Log the first ${m.name} injection first.`); return; }
      sendToCalendar(`${m.name.toLowerCase()}-next.ics`, icsFile([icsEvent({ uid: `${m.id}-${inf.next}`, date: inf.next, title: `${m.name} injection due`, alarms: ['-PT15H', 'PT9H'] })]));
    } }, `Next ${m.name} date`));
  }
  return card('Reminders on your iPhone Calendar',
    h('p', { class: 'small muted' }, 'These buttons add events with alerts to the Calendar app. They do not update by themselves, so tap again after a schedule change.'),
    h('label', { class: 'row', style: 'margin-bottom:12px' }, h('span', { class: 'grow' }, 'Pill reminder time'), h('span', { style: 'width:140px' }, timeIn)),
    h('div', { class: 'btn-row' }, buttons));
}

function cycleReminderEvents(m, time) {
  const t = today();
  const ci = cycleInfo(m, t);
  if (!ci) {
    // Treatment may start in the future.
    const first = medEvents(m.id, ['cycle']).find(e => e.date > t);
    if (!first) return null;
    return [0, 1, 2, 3, 4, 5].map(k => icsEvent({ uid: `${m.id}-c${k}-${first.date}`, date: addDays(first.date, k * cycleLen(m)), time, minutes: 10,
      title: `${m.name} (cycle ${(Number(first.cycle) || 1) + k})`, rrule: `FREQ=DAILY;COUNT=${ci ? ci.onDays : Number(m.onDays) || 21}`, alarms: ['PT0M'] }));
  }
  const cycleStart = addDays(t, -(ci.day - 1));
  const evs = [];
  for (let k = 0; k < 6; k++) {
    const start = addDays(cycleStart, k * ci.len);
    let first = start;
    let count = ci.onDays;
    if (k === 0) {
      if (!ci.on) continue;
      first = t;
      count = ci.onDays - ci.day + 1;
    }
    evs.push(icsEvent({ uid: `${m.id}-c${ci.cycle + k}-${start}`, date: first, time, minutes: 10, title: `${m.name} (cycle ${ci.cycle + k})`, rrule: `FREQ=DAILY;COUNT=${count}`, alarms: ['PT0M'] }));
  }
  return evs;
}
