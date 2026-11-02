'use strict';
/* Care Log core: DOM helpers, dates, storage, and treatment schedule logic.
   All data lives in this browser's localStorage on the phone. */

const STORE_KEY = 'carelog.v1';
const APP_VERSION = '1.0.0';

/* ---------------- DOM helpers ---------------- */
// h('div', {class: 'x', onclick: fn}, 'text', childNode) - user text always goes in as text nodes.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  appendKids(el, kids);
  return el;
}
function appendKids(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  appendKids(el, kids);
  return el;
}
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.7 2.7L16.2 9.6"/></svg>',
  symptoms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 4.5 12 2.5-6H21"/></svg>',
  labs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 15h9"/></svg>',
  visits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="2.8" y="8.2" width="18.4" height="7.6" rx="3.8" transform="rotate(-35 12 12)"/><path d="M9.6 8.6l4.8 6.8" /></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
};
function icon(name) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.innerHTML = ICONS[name] || ''; // static, trusted markup only
  return span;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- dates (stored as YYYY-MM-DD, local time) ---------------- */
const pad = n => String(n).padStart(2, '0');
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toStr(new Date());
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toStr(d); };
const utcOf = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diffDays = (a, b) => Math.round((utcOf(b) - utcOf(a)) / 864e5); // b minus a, in days
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
function fmtDate(s, style = 'med') {
  if (!isDate(s)) return '';
  const opts = {
    short: { month: 'short', day: 'numeric' },
    med: { weekday: 'short', month: 'short', day: 'numeric' },
    long: { weekday: 'long', month: 'long', day: 'numeric' },
    full: { month: 'short', day: 'numeric', year: 'numeric' },
    month: { month: 'short' },
  }[style];
  return parseDate(s).toLocaleDateString('en-US', opts);
}
function fmtTime(t) {
  if (!t) return '';
  const [H, M] = t.split(':').map(Number);
  return new Date(2000, 0, 1, H, M).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function relDays(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
function weekStart(s) { const dow = (parseDate(s).getDay() + 6) % 7; return addDays(s, -dow); } // Monday
function dateRange(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/* ---------------- default data ---------------- */
const SCORE_LABELS = ['None', 'Very mild', 'Mild', 'Moderate', 'Severe', 'Very severe'];

function defaults() {
  return {
    v: 1,
    meta: { created: today(), lastBackup: null, hideInstallTip: false },
    meds: [
      { id: 'kisqali', name: 'Kisqali', kind: 'cycle', dose: '600 mg', onDays: 21, offDays: 7, active: true },
      { id: 'ai', name: 'Aromatase inhibitor', kind: 'daily', dose: '', start: '', active: true },
      { id: 'zoladex', name: 'Zoladex', kind: 'injection', dose: '', intervalDays: 28, active: true },
    ],
    supplements: [
      { id: 'vitd', name: 'Vitamin D' },
      { id: 'calcium', name: 'Calcium' },
    ],
    symptoms: [
      { id: 'joint', name: 'Joint pain' },
      { id: 'hot', name: 'Hot flashes' },
      { id: 'insomnia', name: 'Insomnia' },
      { id: 'vatrophy', name: 'Vaginal atrophy' },
      { id: 'vdry', name: 'Vaginal dryness' },
      { id: 'vburn', name: 'Burning' },
      { id: 'libido', name: 'Libido changes' },
      { id: 'fatigue', name: 'Fatigue' },
      { id: 'gi', name: 'GI symptoms', hint: 'nausea, diarrhea, stomach upset' },
      { id: 'hair', name: 'Hair thinning' },
    ],
    labTests: [
      { id: 'alt', name: 'ALT', group: 'Liver enzymes', unit: 'U/L' },
      { id: 'ast', name: 'AST', group: 'Liver enzymes', unit: 'U/L' },
      { id: 'wbc', name: 'White blood cells (WBC)', group: 'White count', unit: 'K/µL' },
      { id: 'anc', name: 'Neutrophils (ANC)', group: 'White count', unit: 'K/µL' },
      { id: 'k', name: 'Potassium', group: 'Electrolytes', unit: 'mmol/L' },
      { id: 'mg', name: 'Magnesium', group: 'Electrolytes', unit: 'mg/dL' },
      { id: 'vitd', name: 'Vitamin D (25-OH)', group: 'Vitamin D', unit: 'ng/mL' },
      { id: 'qtc', name: 'QTc from EKG', group: 'Heart', unit: 'ms' },
      { id: 'tscore', name: 'Bone density T-score', group: 'Bone density scan', unit: '' },
    ],
    goals: { strengthPerWeek: 2, cardioMinPerWeek: 150 },
    days: {},    // 'YYYY-MM-DD' -> { meds:{id:true}, supps:{id:true}, sx:{id:{s,n}}, strength, cardio, fish, note }
    labs: [],    // { id, date, test, value, baseline, note }
    events: [],  // { id, date, med, type: 'cycle'|'injection'|'dose'|'pause'|'resume', cycle?, dose?, note }
    appts: [],   // { id, date, time, title, place, note }
    prep: [
      { id: 'p1', title: 'Bone density scan', done: false, date: '' },
      { id: 'p2', title: 'Dental appointment', done: true, date: '' },
      { id: 'p3', title: 'Cardiology visit and baseline EKG', done: false, date: '' },
      { id: 'p4', title: 'Baseline labs: vitamin D and liver enzymes', done: false, date: '' },
    ],
  };
}

/* ---------------- storage ---------------- */
let S;
let storageOK = true;
function migrate(d) {
  const base = defaults();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  d.meta = Object.assign(base.meta, d.meta || {});
  d.goals = Object.assign(base.goals, d.goals || {});
  return d;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    storageOK = false;
  }
  return defaults();
}
function save() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    storageOK = true;
  } catch (e) {
    storageOK = false;
    toast('Could not save on this device. Check that Private Browsing is off.');
  }
}
let saveTimer;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
function validData(d) {
  return d && typeof d === 'object' && Array.isArray(d.meds) && Array.isArray(d.symptoms) && d.days && typeof d.days === 'object';
}

/* ---------------- day records ---------------- */
function getDay(date) { return S.days[date] || null; }
function ensureDay(date) {
  if (!S.days[date]) S.days[date] = { meds: {}, supps: {}, sx: {}, strength: false, cardio: 0, fish: false, note: '' };
  const d = S.days[date];
  d.meds ||= {}; d.supps ||= {}; d.sx ||= {};
  return d;
}

/* ---------------- treatment logic ---------------- */
const medById = id => S.meds.find(m => m.id === id);
const activeMeds = () => S.meds.filter(m => m.active !== false);
function medEvents(medId, types) {
  return S.events.filter(e => e.med === medId && (!types || types.includes(e.type))).sort(byDate);
}
function lastOnOrBefore(list, date) { let r = null; for (const e of list) if (e.date <= date) r = e; return r; }

function cycleLen(med) { return (Number(med.onDays) || 21) + (Number(med.offDays) || 7); }
// Cycle number and day for a cycle-based pill (e.g. 21 days on, 7 off).
function cycleInfo(med, date) {
  const last = lastOnOrBefore(medEvents(med.id, ['cycle']), date);
  if (!last) return null;
  const len = cycleLen(med);
  const diff = diffDays(last.date, date);
  const dayIdx = diff % len;
  const onDays = Number(med.onDays) || 21;
  return {
    cycle: (Number(last.cycle) || 1) + Math.floor(diff / len),
    day: dayIdx + 1,
    len,
    onDays,
    on: dayIdx < onDays,
    nextOn: dayIdx < onDays ? date : addDays(date, len - dayIdx), // first pill day of next cycle
  };
}
function isPaused(med, date) {
  const e = lastOnOrBefore(medEvents(med.id, ['pause', 'resume']), date);
  return !!e && e.type === 'pause';
}
function pausedSince(med, date) {
  const e = lastOnOrBefore(medEvents(med.id, ['pause', 'resume']), date);
  return e && e.type === 'pause' ? e.date : null;
}
function currentDose(med, date) {
  const e = lastOnOrBefore(medEvents(med.id, ['dose']), date);
  return e ? e.dose : med.dose;
}
function medStarted(med, date) {
  if (med.kind === 'cycle') return !!lastOnOrBefore(medEvents(med.id, ['cycle']), date);
  if (med.kind === 'injection') return !!lastOnOrBefore(medEvents(med.id, ['injection']), date);
  return isDate(med.start) && med.start <= date;
}
function medStartDate(med) {
  if (med.kind === 'daily') return isDate(med.start) ? med.start : null;
  const first = medEvents(med.id, [med.kind === 'cycle' ? 'cycle' : 'injection'])[0];
  return first ? first.date : null;
}
function injectionInfo(med, date) {
  const list = medEvents(med.id, ['injection']);
  const last = lastOnOrBefore(list, date);
  if (!last) return null;
  const next = addDays(last.date, Number(med.intervalDays) || 28);
  return { last: last.date, next, dueIn: diffDays(date, next), count: list.filter(e => e.date <= date).length };
}
// Pills that apply on a date: [{ med, due, paused, cycle }]
function pillsFor(date) {
  const out = [];
  for (const m of activeMeds()) {
    if (m.kind === 'injection' || !medStarted(m, date)) continue;
    const paused = isPaused(m, date);
    if (m.kind === 'cycle') {
      const c = cycleInfo(m, date);
      out.push({ med: m, due: c.on && !paused, paused, cycle: c });
    } else {
      out.push({ med: m, due: !paused, paused });
    }
  }
  return out;
}
function medLabel(m, date) {
  const dose = currentDose(m, date || today());
  return dose ? `${m.name} ${dose}` : m.name;
}
function intervalText(days) {
  const n = Number(days) || 28;
  if (n === 28) return 'every 4 weeks';
  if (n === 84) return 'every 12 weeks';
  return `every ${n} days`;
}

/* ---------------- labs ---------------- */
const labTestById = id => S.labTests.find(t => t.id === id);
function labSeries(testId) { return S.labs.filter(l => l.test === testId).sort(byDate); }
function labBaseline(testId) {
  const list = labSeries(testId);
  const flagged = list.filter(l => l.baseline);
  if (flagged.length) return { entry: flagged[flagged.length - 1], flagged: true };
  return list.length ? { entry: list[0], flagged: false } : null;
}
function fmtNum(v) {
  if (v == null || !isFinite(v)) return '-';
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return Number(v.toFixed(digits)).toString();
}
function changeText(base, latest) {
  if (base == null || latest == null) return '';
  const d = latest - base;
  if (Math.abs(d) < 1e-9) return 'no change';
  const sign = d > 0 ? '+' : '−';
  let s = `${sign}${fmtNum(Math.abs(d))}`;
  if (base !== 0) s += ` (${sign}${Math.round(Math.abs(d / base) * 100)}%)`;
  return s;
}

/* ---------------- small UI bits shared by views ---------------- */
const UI = {
  date: today(),
  sxMode: 'log',
  sxRange: 30,
  sxSel: null,
  labForm: null,
  treatForm: null,
  sumRange: '30',
  research: { q: '', reviews: false, newest: false, free: false, results: null, loading: false, error: '' },
  timelineDays: 30,
};

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}
function pageHead(title, sub, actions) {
  return h('header', { class: 'head' },
    h('div', { class: 'grow' }, h('h1', null, title), sub ? h('div', { class: 'sub' }, sub) : null),
    actions ? h('div', { class: 'actions' }, actions) : null);
}
function backLink(href, label) {
  return h('a', { class: 'back', href }, icon('left'), label);
}
function card(title, ...kids) {
  return h('section', { class: 'card' }, title ? h('h2', null, title) : null, ...kids);
}
function checkRow({ label, sub, on, onToggle }) {
  const box = h('span', { class: 'box' });
  box.innerHTML = ICONS.check;
  return h('button', { class: 'check', type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: onToggle },
    box, h('span', { class: 't' }, h('span', null, label), sub ? h('small', null, sub) : null));
}
function field(label, input) { return h('label', { class: 'field' }, h('span', null, label), input); }
function dateNav(onChange) {
  const d = UI.date;
  const t = today();
  const sub = d === t ? 'Today' : relDays(diffDays(t, d)).replace(/^./, c => c.toUpperCase());
  const input = h('input', { type: 'date', value: d, max: addDays(t, 365), 'aria-label': 'Pick a date',
    onchange: e => { if (isDate(e.target.value)) { UI.date = e.target.value; onChange(); } } });
  const prev = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous day', onclick: () => { UI.date = addDays(UI.date, -1); onChange(); } }, icon('left'));
  const next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next day', onclick: () => { UI.date = addDays(UI.date, 1); onChange(); } }, icon('right'));
  return h('div', { class: 'datenav' }, prev, h('div', { class: 'mid' }, fmtDate(d, 'med'), h('small', null, sub), input), next);
}
function download(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// Opens the iPhone share sheet with a file when possible; otherwise downloads it.
async function shareOrDownload(filename, mime, text, title) {
  try {
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  download(filename, mime, text);
  return 'downloaded';
}
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
