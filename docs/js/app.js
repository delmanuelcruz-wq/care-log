'use strict';
/* Start-up and routing. Each tab is a function that returns its screen. */

const ROUTES = { today: viewToday, symptoms: viewSymptoms, labs: viewLabs, visits: viewVisits, more: viewMore };
const TITLES = { today: 'Today', symptoms: 'Symptoms', labs: 'Labs', visits: 'Visits', more: 'More' };
let lastToday = today();

function currentRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
  const tab = ROUTES[parts[0]] ? parts[0] : 'today';
  return { tab, sub: ROUTES[parts[0]] ? parts.slice(1) : [] };
}

function render() {
  const r = currentRoute();
  const main = document.getElementById('main');
  let view;
  try {
    view = ROUTES[r.tab](r.sub);
  } catch (e) {
    console.error(e);
    view = h('div', { class: 'view' }, pageHead('Something went wrong'),
      card(null, h('p', null, 'This screen hit an error. Your saved data is safe.'), h('p', { class: 'small muted' }, String(e && e.message)),
        h('a', { class: 'btn', href: '#today' }, 'Go to Today')));
  }
  main.replaceChildren(view);
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === r.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.title = r.tab === 'today' ? 'Care Log' : `${TITLES[r.tab]} · Care Log`;
}
function rerender() { render(); }

function checkNewDay() {
  const t = today();
  if (t !== lastToday) {
    if (UI.date === lastToday) UI.date = t; // keep following "today" after midnight
    lastToday = t;
    render();
  }
}

function start() {
  S = load();
  for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });
  let lastWidth = window.innerWidth;
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; render(); } }, 200);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else checkNewDay();
  });
  window.addEventListener('pagehide', save);
  setInterval(checkNewDay, 60000);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline mode unavailable:', err));
  }
  render();
}

start();
