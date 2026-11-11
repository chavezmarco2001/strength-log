# Strength Log — notes for Claude

Personal strength-training log, PWA for Chrome on Android. The owner talks to you in Spanish; the app UI is English (US) with a Spanish (es-419) toggle.

## Product priorities (from the owner)
1. Logging a set must take very few taps; the workout screen must have nothing distracting. Reference: FitNotes (simple, fast, clear).
2. Offline, no backend, no accounts, no ads. Data only on the phone (IndexedDB). Units: kg.
3. Big one-hand buttons, dark mode by default.
Out of scope for now: accounts, cloud, social, nutrition, AI routines, iPhone, app stores.

## Stack
Plain HTML/CSS/ES modules, **no build step and no dependencies**. GitHub Pages serves the repo root as-is.
- `js/app.js` routing (hash routes), bottom nav (Workout · Calendar · Routines · Progress · More), wake lock, SW registration
- `js/data.js` the only module that touches the database (schema documented at the top). Sets with `done === false` are *planned*; only completed sets count for records, charts and history (`data.doneOnly`). DB version 2 (adds `bodyweight`); v1 data migrates automatically.
- `js/db.js` IndexedDB wrapper · `js/stats.js` records, e1RM, plates, weekly totals (pure) · `js/fitnotes.js` + `js/csv.js` + `js/sqlite.js` import (pure)
- `js/actions.js` completing a set (vibration, record toast, rest timer) — shared by workout and exercise screens
- `js/i18n.js` all UI text, `en` and `es` dicts must have the same keys; `key_one` = singular form when `{n}` is 1
- `js/ui.js` `h()` DOM helper, sheets/dialogs/toasts, accent themes · `js/chart.js` line + bar charts · `js/timer.js` rest timer · `js/checkin.js` post-workout questions
- `js/views/*` one file per screen; `components.js` = set table with ✓, category dots
- `css/app.css` design tokens at the top (accent themes via `data-accent`); display font Barlow Condensed in `fonts/` (OFL)
- `sw.js` offline cache: **bump `VERSION` on every release** and list any new file in `ASSETS`
- Roadmap and ideas for later: `docs/plan-v2.md`

## Before committing
- `node --test "tests/*.test.js"` must pass (also checks translations and the SW file list).
- Try the change in the browser pane at mobile size: `node tools/serve.js` (launch config "strength-log"). The SW is disabled on localhost unless the URL has `?sw`.
- Never commit personal data: `.gitignore` excludes `*.csv` (except test fixtures) and backup JSONs.
