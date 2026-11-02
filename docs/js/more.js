'use strict';
/* More: menu plus the visit summary, research search, timeline, activity, backup, lists and privacy pages. */

const MORE_PAGES = {
  treatment: () => viewTreatment(),
  summary: () => viewSummary(),
  research: () => viewResearch(),
  timeline: () => viewTimeline(),
  activity: () => viewActivity(),
  backup: () => viewBackup(),
  customize: () => viewCustomize(),
  about: () => viewAbout(),
};

function viewMore(sub) {
  if (sub[0] && MORE_PAGES[sub[0]]) return MORE_PAGES[sub[0]]();
  const v = h('div', { class: 'view' });
  v.append(pageHead('More'));
  const hasData = Object.keys(S.days).length || S.labs.length || S.events.length;
  const lb = S.meta.lastBackup;
  if (hasData && (!lb || diffDays(lb, today()) > 14)) {
    v.append(h('div', { class: 'banner' }, lb ? `Last backup was ${relDays(diffDays(today(), lb))}. ` : 'No backup saved yet. ',
      h('a', { href: '#more/backup' }, 'Save a backup')));
  }
  const items = [
    ['treatment', 'Treatment', 'Cycles, dose changes, injections', 'pill'],
    ['summary', 'Visit summary', 'One page to show your oncologist', 'doc'],
    ['research', 'Research', 'Search studies about your medicines', 'search'],
    ['timeline', 'Timeline', 'Everything in order, day by day', 'clock'],
    ['activity', 'Activity', 'Exercise and fish meals by week', 'activity'],
    ['backup', 'Backup & email', lb ? `Last backup ${fmtDate(lb, 'short')}` : 'Keep a copy of your data', 'save'],
    ['customize', 'Customize lists', 'Symptoms, supplements, lab tests', 'sliders'],
    ['about', 'Privacy & help', 'Where your data lives', 'info'],
  ];
  const list = h('ul', { class: 'list' });
  for (const [id, title, sub2, ic] of items) {
    const badge = h('span', { class: 'ico-badge' }, icon(ic));
    list.append(h('li', null, h('a', { class: 'linkrow', href: `#more/${id}` }, badge,
      h('div', { class: 'grow' }, h('div', { style: 'font-weight:600' }, title), h('div', { class: 'small muted' }, sub2)),
      h('span', { class: 'chev' }, icon('right')))));
  }
  v.append(h('section', { class: 'card' }, list));
  v.append(h('p', { class: 'small muted', style: 'text-align:center' }, `Care Log ${APP_VERSION}`));
  return v;
}

/* ---------------- visit summary ---------------- */
function firstUseDate() {
  const keys = Object.keys(S.days).filter(isDate).sort();
  const c = S.meta.created;
  return keys[0] && (!c || keys[0] < c) ? keys[0] : c || today();
}
function summaryRange(key) {
  const end = today();
  if (key === 'visit') {
    const last = pastAppts(end)[0];
    if (last) return { start: last.date, end, label: `Since ${last.title} on ${fmtDate(last.date, 'short')}` };
    return { start: addDays(end, -29), end, label: 'Last 30 days (no past visit saved yet)' };
  }
  if (key === 'all') {
    const all = [...Object.keys(S.days), ...S.labs.map(l => l.date), ...S.events.map(e => e.date)].filter(isDate).sort();
    return { start: all[0] && all[0] < end ? all[0] : end, end, label: 'Everything so far' };
  }
  const n = Number(key) || 30;
  return { start: addDays(end, -(n - 1)), end, label: `Last ${n} days` };
}

function buildSummary(key) {
  const R = summaryRange(key);
  const { start, end } = R;
  const inRange = d => d >= start && d <= end;
  const dates = dateRange(start, end);
  const counted = dates.filter(d => d >= firstUseDate());

  const meds = activeMeds().map(m => medStatusParts(m, end));
  const events = S.events.filter(e => inRange(e.date)).sort(byDate).map(e => {
    const m = medById(e.med);
    return { date: e.date, text: `${m ? m.name : 'Medicine'}: ${eventText(e, m)}${e.note ? ` (${e.note})` : ''}` };
  });

  const adher = new Map();
  for (const d of counted) {
    const rec = S.days[d];
    for (const p of pillsFor(d)) {
      if (!p.due) continue;
      const a = adher.get(p.med.id) || { name: p.med.name, due: 0, taken: 0, unit: 'pill days' };
      a.due++;
      if (rec && rec.meds && rec.meds[p.med.id]) a.taken++;
      adher.set(p.med.id, a);
    }
    for (const s of S.supplements.filter(x => !x.hidden)) {
      const a = adher.get('s:' + s.id) || { name: s.name, due: 0, taken: 0, unit: 'days' };
      a.due++;
      if (rec && rec.supps && rec.supps[s.id]) a.taken++;
      adher.set('s:' + s.id, a);
    }
  }

  const sx = [];
  for (const s of S.symptoms) {
    const vals = dates.map(d => ({ d, e: sxEntry(d, s.id) })).filter(x => x.e);
    if (!vals.length) continue;
    let worst = vals[0];
    for (const x of vals) if (x.e.s >= worst.e.s) worst = x;
    sx.push({
      name: s.name,
      logged: vals.length,
      present: vals.filter(x => x.e.s > 0).length,
      avg: vals.reduce((a, x) => a + x.e.s, 0) / vals.length,
      worst: worst.e.s,
      worstDate: worst.d,
    });
  }
  sx.sort((a, b) => b.avg - a.avg);
  const sxNotes = [];
  for (const d of [...dates].reverse()) {
    for (const s of S.symptoms) {
      const e = sxEntry(d, s.id);
      if (e && e.n && e.n.trim()) sxNotes.push({ date: d, text: `${s.name} ${e.s}: ${e.n.trim()}` });
    }
  }

  const labs = [];
  for (const t of S.labTests) {
    const ser = labSeries(t.id);
    if (!ser.length) continue;
    labs.push({ t, base: labBaseline(t.id), latest: ser[ser.length - 1], inRange: ser.filter(l => inRange(l.date)).length });
  }

  let strength = 0;
  let cardio = 0;
  let fish = 0;
  for (const d of dates) {
    const r = S.days[d];
    if (!r) continue;
    if (r.strength) strength++;
    cardio += Number(r.cardio) || 0;
    if (r.fish) fish++;
  }
  const weeks = Math.max(1, counted.length / 7);
  const notes = dates.filter(d => S.days[d] && S.days[d].note && S.days[d].note.trim()).reverse().map(d => ({ date: d, text: S.days[d].note.trim() }));
  return {
    ...R, meds, events, adher: [...adher.values()], sx, sxNotes: sxNotes.slice(0, 12), labs,
    act: { strength, cardio, fish, perWeekStrength: strength / weeks, perWeekCardio: cardio / weeks },
    notes: notes.slice(0, 8), next: upcomingAppts(end)[0] || null,
  };
}

function summaryText(sm) {
  const L = [];
  L.push(`Treatment summary: ${fmtDate(sm.start, 'full')} to ${fmtDate(sm.end, 'full')} (${sm.label})`);
  L.push('');
  L.push('CURRENT TREATMENT');
  for (const m of sm.meds) L.push(`- ${m.title}: ${[m.sub, m.status].filter(Boolean).join('. ')}`);
  if (sm.events.length) { L.push('', 'CHANGES IN THIS PERIOD'); for (const e of sm.events) L.push(`- ${fmtDate(e.date, 'short')}: ${e.text}`); }
  if (sm.adher.length) { L.push('', 'CHECKED OFF'); for (const a of sm.adher) L.push(`- ${a.name}: ${a.taken} of ${a.due} ${a.unit}`); }
  if (sm.sx.length) {
    L.push('', 'SYMPTOMS (0 none to 5 very severe)');
    for (const s of sm.sx) L.push(`- ${s.name}: average ${s.avg.toFixed(1)}, worst ${s.worst} on ${fmtDate(s.worstDate, 'short')}, present on ${s.present} of ${s.logged} days logged`);
  }
  if (sm.sxNotes.length) { L.push('', 'SYMPTOM NOTES'); for (const n of sm.sxNotes) L.push(`- ${fmtDate(n.date, 'short')}: ${n.text}`); }
  if (sm.labs.length) {
    L.push('', 'LABS');
    for (const l of sm.labs) {
      const u = l.t.unit ? ` ${l.t.unit}` : '';
      const same = l.base.entry === l.latest;
      L.push(`- ${l.t.name}: ${same ? '' : `${l.base.flagged ? 'baseline' : 'first'} ${fmtNum(l.base.entry.value)} (${fmtDate(l.base.entry.date, 'short')}), `}latest ${fmtNum(l.latest.value)}${u} (${fmtDate(l.latest.date, 'short')})${same ? '' : `, change ${changeText(l.base.entry.value, l.latest.value)}`}`);
    }
  }
  L.push('', 'ACTIVITY');
  L.push(`- Strength training: ${sm.act.strength} sessions (about ${sm.act.perWeekStrength.toFixed(1)} a week)`);
  L.push(`- Cardio: ${sm.act.cardio} minutes (about ${Math.round(sm.act.perWeekCardio)} a week)`);
  L.push(`- Fish meals: ${sm.act.fish}`);
  if (sm.notes.length) { L.push('', 'DAY NOTES'); for (const n of sm.notes) L.push(`- ${fmtDate(n.date, 'short')}: ${n.text}`); }
  if (sm.next) L.push('', `NEXT APPOINTMENT: ${sm.next.title}, ${fmtDate(sm.next.date, 'med')}${sm.next.time ? ` at ${fmtTime(sm.next.time)}` : ''}`);
  L.push('', `Made with Care Log on ${fmtDate(today(), 'full')}.`);
  return L.join('\n');
}

function viewSummary() {
  const sm = buildSummary(UI.sumRange);
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Visit summary', `${fmtDate(sm.start, 'full')} – ${fmtDate(sm.end, 'full')}`));
  v.append(h('div', { class: 'no-print' }, segmented([['30', '30 days'], ['visit', 'Since visit'], ['90', '90 days'], ['all', 'All']], UI.sumRange, val => { UI.sumRange = val; rerender(); }, 'Summary range')));
  const text = summaryText(sm);
  const subject = `Treatment summary ${fmtDate(sm.start, 'short')} to ${fmtDate(sm.end, 'short')}`;
  v.append(h('div', { class: 'btn-row no-print', style: 'margin-bottom:14px' },
    h('button', { class: 'btn small primary', type: 'button', onclick: () => window.print() }, 'Print or save PDF'),
    h('button', { class: 'btn small soft', type: 'button', onclick: () => shareText(subject, text) }, 'Share'),
    h('a', { class: 'btn small soft', href: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` }, 'Email')));

  const r = h('section', { class: 'card report' });
  r.append(h('p', { class: 'small muted' }, `${sm.label}. Symptoms are rated 0 (none) to 5 (very severe).`));
  r.append(h('h2', null, 'Current treatment'));
  r.append(h('ul', null, sm.meds.map(m => h('li', null, h('b', null, m.title), `: ${[m.sub, m.status].filter(Boolean).join('. ')}`))));
  if (sm.events.length) {
    r.append(h('h2', null, 'Changes in this period'));
    r.append(h('ul', null, sm.events.map(e => h('li', null, `${fmtDate(e.date, 'short')}: ${e.text}`))));
  }
  if (sm.adher.length) {
    r.append(h('h2', null, 'Checked off'));
    r.append(h('ul', null, sm.adher.map(a => h('li', null, `${a.name}: ${a.taken} of ${a.due} ${a.unit}`))));
  }
  r.append(h('h2', null, 'Symptoms'));
  if (!sm.sx.length) r.append(h('p', { class: 'empty' }, 'None logged in this period.'));
  else {
    r.append(h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Symptom'), h('th', { class: 'num' }, 'Avg'), h('th', { class: 'num' }, 'Worst'), h('th', { class: 'num' }, 'Days present'))),
      h('tbody', null, sm.sx.map(s => h('tr', null, h('td', null, s.name), h('td', { class: 'num' }, s.avg.toFixed(1)),
        h('td', { class: 'num' }, `${s.worst} · ${fmtDate(s.worstDate, 'short')}`), h('td', { class: 'num' }, `${s.present} of ${s.logged}`))))));
  }
  if (sm.sxNotes.length) {
    r.append(h('h2', null, 'Symptom notes'));
    r.append(h('ul', null, sm.sxNotes.map(n => h('li', null, `${fmtDate(n.date, 'short')}: ${n.text}`))));
  }
  r.append(h('h2', null, 'Labs'));
  if (!sm.labs.length) r.append(h('p', { class: 'empty' }, 'No lab results saved.'));
  else {
    r.append(h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Test'), h('th', { class: 'num' }, 'Baseline'), h('th', { class: 'num' }, 'Latest'), h('th', { class: 'num' }, 'Change'))),
      h('tbody', null, sm.labs.map(l => h('tr', null,
        h('td', null, l.t.name, l.t.unit ? h('span', { class: 'muted' }, ` (${l.t.unit})`) : null),
        h('td', { class: 'num' }, l.base.entry === l.latest ? '–' : `${fmtNum(l.base.entry.value)} · ${fmtDate(l.base.entry.date, 'short')}`),
        h('td', { class: 'num' }, `${fmtNum(l.latest.value)} · ${fmtDate(l.latest.date, 'short')}`),
        h('td', { class: 'num' }, l.base.entry === l.latest ? '–' : changeText(l.base.entry.value, l.latest.value)))))));
  }
  r.append(h('h2', null, 'Activity'));
  r.append(h('ul', null,
    h('li', null, `Strength training: ${sm.act.strength} sessions (about ${sm.act.perWeekStrength.toFixed(1)} a week)`),
    h('li', null, `Cardio: ${sm.act.cardio} minutes (about ${Math.round(sm.act.perWeekCardio)} a week)`),
    h('li', null, `Fish meals: ${sm.act.fish}`)));
  if (sm.notes.length) {
    r.append(h('h2', null, 'Day notes'));
    r.append(h('ul', null, sm.notes.map(n => h('li', null, `${fmtDate(n.date, 'short')}: `, h('span', { class: 'note-text' }, n.text)))));
  }
  if (sm.next) {
    r.append(h('h2', null, 'Next appointment'));
    r.append(h('p', null, `${sm.next.title}, ${fmtDate(sm.next.date, 'med')}${sm.next.time ? ` at ${fmtTime(sm.next.time)}` : ''}`));
  }
  r.append(h('p', { class: 'small muted', style: 'margin-top:14px' }, `Made with Care Log on ${fmtDate(today(), 'full')}.`));
  v.append(r);
  return v;
}

async function shareText(title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Summary copied. Paste it into a message or email.');
  } catch (e) {
    toast('Sharing is not available here. Use Email instead.');
  }
}

/* ---------------- research ---------------- */
const RESEARCH_TOPICS = [
  'Ribociclib (Kisqali) side effects',
  'Ribociclib neutropenia dose reduction',
  'Aromatase inhibitor joint pain',
  'Goserelin (Zoladex) bone density',
  'Exercise during endocrine therapy',
  'Vitamin D with aromatase inhibitors',
  'Hot flashes treatment breast cancer',
  'Vaginal dryness aromatase inhibitor',
];

// Titles and abstracts arrive as HTML, sometimes escaped twice (&lt;i&gt;). Turn them into plain text.
function stripTags(html) {
  if (!html) return '';
  const text = s => new DOMParser().parseFromString(String(s), 'text/html').body.textContent || '';
  let t = text(html);
  if (/<\/?[a-z][^>]*>/i.test(t)) t = text(t);
  return t.replace(/\s+\n/g, '\n').trim();
}

async function runResearch() {
  const R = UI.research;
  const q = R.q.trim();
  if (!q) return;
  if (!navigator.onLine) { R.error = 'You are offline. Research needs an internet connection.'; R.results = null; rerender(); return; }
  R.loading = true;
  R.error = '';
  rerender();
  let query = `(${q}) AND SRC:MED`;
  if (R.reviews) query += ' AND PUB_TYPE:"review"';
  if (R.free) query += ' AND OPEN_ACCESS:y';
  const params = new URLSearchParams({ query, format: 'json', resultType: 'core', pageSize: '15' });
  if (R.newest) params.set('sort', 'FIRST_PDATE_D desc');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    R.total = json.hitCount || 0;
    R.results = ((json.resultList && json.resultList.result) || []).map(r => ({
      id: r.id,
      title: stripTags(r.title),
      authors: r.authorString || '',
      journal: (r.journalInfo && r.journalInfo.journal && (r.journalInfo.journal.isoabbreviation || r.journalInfo.journal.title)) || r.bookOrReportDetails?.publisher || '',
      year: r.pubYear || '',
      pmid: r.pmid,
      abstract: stripTags(r.abstractText),
      free: r.isOpenAccess === 'Y' || r.inEPMC === 'Y',
      review: ((r.pubTypeList && r.pubTypeList.pubType) || []).some(t => /review/i.test(t)),
      cited: r.citedByCount || 0,
    }));
  } catch (e) {
    R.results = null;
    R.error = e.name === 'AbortError' ? 'The search took too long. Try again.' : 'The search did not work. Check the internet connection and try again.';
  } finally {
    clearTimeout(timer);
    R.loading = false;
    rerender();
    const target = document.getElementById('research-results');
    if (target) window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY - 12));
  }
}

function shortAuthors(s) {
  const parts = s.replace(/\.$/, '').split(', ');
  return parts.length > 3 ? `${parts.slice(0, 3).join(', ')}, et al.` : s;
}

function viewResearch() {
  const R = UI.research;
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Research', 'Published studies from PubMed, via Europe PMC'));
  const input = h('input', { type: 'search', value: R.q, placeholder: 'e.g. ribociclib fatigue', 'aria-label': 'Search studies', enterkeyhint: 'search',
    oninput: e => { R.q = e.target.value; },
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); runResearch(); } } });
  const opt = (key, label) => h('label', { class: 'inline-check', style: 'margin:0' },
    h('input', { type: 'checkbox', checked: R[key], onchange: e => { R[key] = e.target.checked; if (R.results) runResearch(); } }), h('span', { class: 'small' }, label));
  v.append(h('section', { class: 'card' },
    h('div', { class: 'row' }, h('div', { class: 'grow' }, input), h('button', { class: 'btn primary', type: 'button', disabled: R.loading, onclick: runResearch }, 'Search')),
    h('div', { class: 'row wrap', style: 'gap:6px 16px;margin-top:10px' }, opt('reviews', 'Reviews only'), opt('free', 'Free full text'), opt('newest', 'Newest first')),
    h('div', { class: 'field-label', style: 'margin-top:14px' }, 'Quick topics'),
    h('div', { class: 'chips' }, RESEARCH_TOPICS.map(t => h('button', { class: 'chip', type: 'button', onclick: () => { R.q = t; runResearch(); } }, t)))));

  if (R.loading) v.append(card(null, h('p', { class: 'empty' }, 'Searching…')));
  else if (R.error) v.append(h('div', { class: 'banner warn' }, R.error));
  else if (R.results) {
    const c = h('section', { class: 'card', id: 'research-results', style: 'scroll-margin-top:12px' }, h('h2', null, 'Results', h('span', { class: 'count' }, `${R.results.length} of ${Number(R.total).toLocaleString()}`)));
    if (!R.results.length) c.append(h('p', { class: 'empty' }, 'No studies found. Try fewer or simpler words.'));
    for (const r of R.results) {
      const url = r.pmid ? `https://europepmc.org/article/MED/${encodeURIComponent(r.pmid)}` : `https://europepmc.org/search?query=${encodeURIComponent(r.title)}`;
      c.append(h('div', { class: 'result' },
        h('a', { class: 'title', href: url, target: '_blank', rel: 'noopener noreferrer' }, r.title),
        h('div', { class: 'meta' }, [shortAuthors(r.authors), [r.journal, r.year].filter(Boolean).join(' '), r.cited ? `cited ${r.cited}×` : ''].filter(Boolean).join(' · ')),
        (r.review || r.free) ? h('div', { class: 'chips', style: 'margin-top:6px' }, r.review ? h('span', { class: 'pill-tag gray' }, 'Review') : null, r.free ? h('span', { class: 'pill-tag' }, 'Free to read') : null) : null,
        r.abstract ? h('details', { style: 'margin-top:6px' }, h('summary', { class: 'small' }, 'Summary from the authors'), h('div', { class: 'abstract' }, r.abstract)) : null));
    }
    v.append(c);
  }
  v.append(h('p', { class: 'small muted' }, 'Studies describe groups of people, not you. Bring questions to your care team. Searches go to Europe PMC; only the search words are sent, nothing from your log.'));
  return v;
}

/* ---------------- timeline ---------------- */
function viewTimeline() {
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Timeline', 'Everything you logged, newest first'));
  const end = today();
  const start = addDays(end, -(UI.timelineDays - 1));
  const upcoming = upcomingAppts(addDays(end, 1)).slice(0, 3);
  if (upcoming.length) v.append(card('Coming up', h('ul', { class: 'list' }, upcoming.map(a => h('li', null, apptLine(a, end))))));
  let shown = 0;
  for (const d of dateRange(start, end).reverse()) {
    const items = timelineItems(d);
    if (!items.length) continue;
    shown++;
    v.append(h('section', { class: 'card' }, h('h2', null, fmtDate(d, 'med'), h('span', { class: 'count' }, relDays(diffDays(end, d)))),
      h('ul', { class: 'list' }, items.map(x => h('li', { class: 'small' }, h('b', null, `${x.k}: `), h('span', { class: 'note-text' }, x.t))))));
  }
  if (!shown) v.append(card(null, h('p', { class: 'empty' }, `Nothing logged in the last ${UI.timelineDays} days.`)));
  v.append(h('button', { class: 'btn block', type: 'button', onclick: () => { UI.timelineDays += 30; rerender(); } }, 'Show 30 more days'));
  return v;
}

function timelineItems(d) {
  const out = [];
  for (const e of S.events.filter(x => x.date === d)) {
    const m = medById(e.med);
    out.push({ k: m ? m.name : 'Treatment', t: eventText(e, m) + (e.note ? ` (${e.note})` : '') });
  }
  for (const a of S.appts.filter(x => x.date === d)) out.push({ k: 'Appointment', t: [a.title, fmtTime(a.time), a.place].filter(Boolean).join(' · ') });
  const labs = S.labs.filter(l => l.date === d);
  if (labs.length) out.push({ k: 'Labs', t: labs.map(l => { const t = labTestById(l.test); return `${t ? t.name : l.test} ${fmtNum(l.value)}${t && t.unit ? ` ${t.unit}` : ''}`; }).join(', ') });
  const r = S.days[d];
  if (r) {
    const sx = S.symptoms.map(s => ({ s, e: sxEntry(d, s.id) })).filter(x => x.e);
    const present = sx.filter(x => x.e.s > 0);
    if (sx.length) out.push({ k: 'Symptoms', t: present.length ? present.map(x => `${x.s.name} ${x.e.s}${x.e.n ? ` (${x.e.n})` : ''}`).join(', ') : 'all rated 0' });
    const due = pillsFor(d).filter(p => p.due);
    const taken = due.filter(p => r.meds && r.meds[p.med.id]);
    const supps = S.supplements.filter(s => r.supps && r.supps[s.id]);
    if (due.length || supps.length) out.push({ k: 'Checked off', t: [due.length ? `${taken.length} of ${due.length} pills` : '', supps.map(s => s.name).join(', ')].filter(Boolean).join(' · ') });
    const act = [r.strength ? 'strength training' : '', r.cardio ? `${r.cardio} min cardio` : '', r.fish ? 'fish meal' : ''].filter(Boolean);
    if (act.length) out.push({ k: 'Activity', t: act.join(', ') });
    if (r.note && r.note.trim()) out.push({ k: 'Note', t: r.note.trim() });
  }
  return out;
}

/* ---------------- activity ---------------- */
function viewActivity() {
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Activity', 'Weekly totals (weeks start Monday)'));
  const goal = (key, label) => field(label, h('input', { type: 'number', inputmode: 'numeric', min: '0', value: String(S.goals[key]),
    onchange: e => { S.goals[key] = clamp(Math.round(Number(e.target.value) || 0), 0, 2000); save(); rerender(); } }));
  v.append(card('Weekly goals', h('div', { class: 'two' }, goal('strengthPerWeek', 'Strength sessions'), goal('cardioMinPerWeek', 'Cardio minutes'))));
  const tbody = h('tbody');
  let ws = weekStart(today());
  for (let i = 0; i < 12; i++) {
    const w = weekStats(ws);
    tbody.append(h('tr', null, h('td', null, fmtDate(ws, 'short')),
      h('td', { class: 'num' }, `${w.strength} / ${S.goals.strengthPerWeek}`),
      h('td', { class: 'num' }, `${w.cardio} / ${S.goals.cardioMinPerWeek}`),
      h('td', { class: 'num' }, String(w.fish))));
    ws = addDays(ws, -7);
  }
  v.append(card('Last 12 weeks', h('table', { class: 'data' },
    h('thead', null, h('tr', null, h('th', null, 'Week of'), h('th', { class: 'num' }, 'Strength'), h('th', { class: 'num' }, 'Cardio min'), h('th', { class: 'num' }, 'Fish'))), tbody)));
  return v;
}

/* ---------------- backup ---------------- */
function viewBackup() {
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Backup & email'));
  v.append(card(null,
    h('p', null, 'Your log lives only in this app on this phone. If the app is removed from the Home Screen or the phone is replaced, the log goes with it. Save a backup every couple of weeks and keep it somewhere safe, like your email or Files.'),
    S.meta.lastBackup ? h('p', { class: 'small muted' }, `Last backup: ${fmtDate(S.meta.lastBackup, 'full')}`) : null,
    h('button', { class: 'btn block primary', type: 'button', onclick: async () => {
      const result = await shareOrDownload(`care-log-backup-${today()}.json`, 'application/json', JSON.stringify(S, null, 1), 'Care Log backup');
      if (result === 'cancelled') return;
      S.meta.lastBackup = today();
      save();
      toast(result === 'shared' ? 'Backup shared' : 'Backup file downloaded');
      rerender();
    } }, 'Save a backup file'),
    h('p', { class: 'small muted', style: 'margin-top:8px' }, 'On iPhone this opens the share sheet. Choose Mail to email it to yourself, or Save to Files.')));

  const sm = buildSummary('30');
  v.append(card('Email yourself a summary',
    h('p', { class: 'small' }, 'Sends the last 30 days as readable text. For a full copy you can restore later, use the backup file above.'),
    h('a', { class: 'btn block soft', href: `mailto:?subject=${encodeURIComponent('Care Log: last 30 days')}&body=${encodeURIComponent(summaryText(sm))}` }, 'Email summary')));

  const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!validData(data)) throw new Error('not a backup');
      if (!confirm('Replace everything in Care Log on this phone with this backup?')) return;
      S = migrate(data);
      save();
      toast('Backup restored');
      location.hash = '#today';
    } catch (err) {
      toast('That file is not a Care Log backup.');
    } finally {
      e.target.value = '';
    }
  } });
  v.append(card('Restore from a backup', file,
    h('p', { class: 'small' }, 'Use this on a new phone, or to undo a mistake. It replaces what is in the app now.'),
    h('button', { class: 'btn block', type: 'button', onclick: () => file.click() }, 'Choose backup file')));

  v.append(card('Start over',
    h('p', { class: 'small' }, 'Erases everything in Care Log on this phone. Save a backup first if you might want it back.'),
    h('button', { class: 'btn block danger', type: 'button', onclick: () => {
      if (!confirm('Erase all Care Log data on this phone?')) return;
      if (!confirm('Are you sure? This cannot be undone without a backup file.')) return;
      S = defaults();
      save();
      toast('All data erased');
      location.hash = '#today';
    } }, 'Erase all data')));
  return v;
}

/* ---------------- customize lists ---------------- */
function listEditor(title, items, opts) {
  const c = h('section', { class: 'card' }, h('h2', null, title));
  const list = h('ul', { class: 'list' });
  items.forEach((it, i) => {
    const name = h('input', { type: 'text', value: it.name, 'aria-label': `Name for ${it.name}`, style: it.hidden ? 'opacity:.55' : '',
      onchange: e => { if (e.target.value.trim()) { it.name = e.target.value.trim(); save(); } } });
    const unit = opts.unit ? h('input', { type: 'text', value: it.unit || '', placeholder: 'unit', 'aria-label': `Unit for ${it.name}`, style: 'width:90px;flex-shrink:0',
      onchange: e => { it.unit = e.target.value.trim(); save(); } }) : null;
    list.append(h('li', { class: 'row' },
      h('div', { class: 'grow' }, name), unit,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${it.name} up`, disabled: i === 0, onclick: () => { items.splice(i - 1, 0, items.splice(i, 1)[0]); save(); rerender(); } }, '↑'),
      h('button', { class: 'btn small', type: 'button', style: 'width:64px', onclick: () => { it.hidden = !it.hidden; save(); rerender(); } }, it.hidden ? 'Show' : 'Hide')));
  });
  c.append(list);
  const newName = h('input', { type: 'text', placeholder: opts.placeholder, 'aria-label': `New ${opts.noun}` });
  const newUnit = opts.unit ? h('input', { type: 'text', placeholder: 'unit', 'aria-label': 'Unit', style: 'width:90px' }) : null;
  const newGroup = opts.unit ? h('input', { type: 'text', list: 'lab-groups', placeholder: 'Group, e.g. Liver enzymes', 'aria-label': 'Group' }) : null;
  const add = () => {
    const n = newName.value.trim();
    if (!n) return;
    const rec = { id: uid(), name: n };
    if (opts.unit) { rec.unit = newUnit.value.trim(); rec.group = newGroup.value.trim() || 'Other'; }
    items.push(rec);
    save();
    toast(`Added ${n}`);
    rerender();
  };
  c.append(h('div', { style: 'margin-top:12px' },
    h('div', { class: 'row' }, h('div', { class: 'grow' }, newName), newUnit, h('button', { class: 'btn', type: 'button', onclick: add }, 'Add')),
    newGroup ? h('div', { style: 'margin-top:8px' }, newGroup, h('datalist', { id: 'lab-groups' }, [...new Set(S.labTests.map(t => t.group))].map(g => h('option', { value: g })))) : null));
  c.append(h('p', { class: 'small muted', style: 'margin:10px 0 0' }, 'Hiding keeps past entries saved. Show it again any time.'));
  return c;
}

function viewCustomize() {
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Customize lists', 'Change names take effect when you leave the box'));
  v.append(listEditor('Symptoms', S.symptoms, { placeholder: 'New symptom', noun: 'symptom' }));
  v.append(listEditor('Supplements', S.supplements, { placeholder: 'New supplement', noun: 'supplement' }));
  v.append(listEditor('Lab tests', S.labTests, { placeholder: 'New lab test', noun: 'lab test', unit: true }));
  return v;
}

/* ---------------- privacy & help ---------------- */
function viewAbout() {
  const v = h('div', { class: 'view' }, backLink('#more', 'More'));
  v.append(pageHead('Privacy & help'));
  v.append(card('Where your data lives',
    h('p', null, 'Everything you enter stays in this app on this phone. There is no account and no server, and nothing is sent anywhere unless you share or email it yourself.'),
    h('p', null, 'The Research page sends only the words you search for to Europe PMC, a public library of published studies.'),
    h('p', { class: 'small muted' }, `Saving is ${storageOK ? 'working' : 'NOT working (try turning off Private Browsing)'}.`)));
  v.append(card('Put it on your Home Screen',
    h('ol', { style: 'margin:0;padding-left:20px' },
      h('li', null, 'Open the Care Log link in Safari.'),
      h('li', null, 'Tap the Share button (the square with an arrow).'),
      h('li', null, 'Tap Add to Home Screen, then Add.')),
    h('p', { class: 'small muted', style: 'margin-top:8px' }, 'Open it from the Home Screen icon from then on. The Home Screen app keeps its own data, separate from Safari.')));
  v.append(card('Good to know',
    h('ul', { style: 'margin:0;padding-left:20px' },
      h('li', null, 'Care Log is a personal notebook. It does not give medical advice and does not warn about symptoms. Call your care team as you normally would.'),
      h('li', null, 'Calendar reminders are copies. After a dose pause or schedule change, add them again from Visits.'),
      h('li', null, 'Save a backup now and then from More → Backup & email.'))));
  v.append(h('p', { class: 'small muted', style: 'text-align:center' }, `Care Log ${APP_VERSION}`));
  return v;
}
