# Care Log

A private, offline treatment tracker for iPhone. It runs as a web app that you add to the
Home Screen, and it opens like a regular app.

**Live app:** https://delmanuelcruz-wq.github.io/care-log/

## Privacy

There is no account, no server and no tracking. Everything you enter is stored only in the app
on your phone (browser local storage). This repository holds the app's code only, never anyone's
data. The Research page sends just the search words to [Europe PMC](https://europepmc.org/),
a public library of published studies.

## What it tracks

- **Today:** pill and supplement check-offs, where you are in a treatment cycle, the next injection
  date, exercise, and a note for the day
- **Symptoms:** a 0–5 rating with a short note for each side effect, a day-by-day view over 2 weeks,
  30 days or 90 days, and a history list
- **Labs:** results typed in by hand, baseline values, and a trend chart for each test
- **Visits:** appointments, a before-treatment checklist, and reminders added to the iPhone Calendar
- **More:** cycle starts, dose changes, pauses and injections; a one-page visit summary to print or
  email; a search for published studies; a full timeline; weekly activity; backup and restore;
  customizable symptom, supplement and lab lists

Care Log is a personal notebook. It does not give medical advice.

## Install on an iPhone

1. Open the live app link in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Tap **Add to Home Screen**, then **Add**.
4. From then on, open it from the Home Screen icon.

## Develop

No build step and no dependencies. The app is plain HTML, CSS and JavaScript in `docs/`.

```bash
node tools/serve.cjs docs 5180
```

Then open http://localhost:5180.

To release a change, bump `VERSION` in `docs/sw.js` and `APP_VERSION` in `docs/js/core.js`,
then push. Installed copies update the next time they open with an internet connection.
Saved data (local storage key `carelog.v1`) is not affected by updates.

`tools/make_icons.py` redraws the Home Screen icons using only the Python standard library.
