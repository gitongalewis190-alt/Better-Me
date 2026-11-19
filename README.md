# Better Me 2.0

Plan the day in plain words, focus with timers that run themselves, build habits, journal, track mood and sleep, and export a beautiful PDF review of any period. Works on phone, tablet and laptop, online or offline, with or without an account.

Live: https://better-me-ashen.vercel.app

## What's new in 2.0 (rebuilt from the ground up)
1. **New design system** — aurora/mesh/paper/plain backgrounds, glass cards, hover spotlight, tooltips, spring animations, view transitions. Phone (bottom bar + FAB), tablet (icon rail), laptop (sidebar), wide screens (summary column).
2. **PDF review report** — pick any period (7/30/90 days, month, year, all, custom), choose sections, theme or print look, A4/Letter, portrait/landscape. Cover with your profile, photo and the app icon in your accent; theme swatches; performance; app usage; charts; algorithms; habits; mood/sleep; goals; achievements; every task per day; journal; focus sessions; full settings snapshot. Download as PDF, print, or share.
3. **Performance score** — composite 0–100 + grade, weekly trend (least-squares), consistency index, comparison with the previous period.
4. **App-usage tracking** — days opened, sessions, time in app, most-used views and features.
5. **Natural-language quick add** — `Gym 6-7pm tomorrow #Personal !high`.
6. **Day timeline** — time blocks, overlaps side by side, tap an hour to plan, live “now” line.
7. **Smart slot suggestion** — finds a free gap near your peak hour.
8. **Pomodoro focus** — work/short/long cycles that survive reloads, attach to a task, logs sessions.
9. **Soundscapes** — rain, ocean, brown/pink/white noise generated live.
10. **Zen mode** — full-screen breathing timer.
11. **Habit tracker** — per-weekday habits, streaks, 7-day grid, 30-day rate.
12. **Mood, energy, sleep, water check-in** — with mood × output correlation.
13. **Journal** — prompt, reflection, three good things, notes, past entries.
14. **Long-term goals** — deadlines, reasons, milestones, celebrations.
15. **Task details** — priority, notes, checklists, duplicate, move to any day, +5/+15 min.
16. **Recurring tasks** — repeat on chosen weekdays.
17. **Levels, XP and 16 badges**, plus a daily “surprise” fact mined from your data.
18. **Command palette** (⌘/Ctrl K) and keyboard shortcuts (N, 1–9, Space, Z, E, T, “,”, ?).
19. **Personalisation** — auto/light/dark, 9 accents, density, text size, high contrast, reduced motion, 12h clock, category colours.
20. **App lock PIN**, **guest mode** (no account needed; data moves into your account on sign-up), magic-link sign-in, password reset.
21. **Import/restore JSON, CSV (Excel), calendar .ics export.**
22. **Smart alerts** — notify when tasks start, time is up, focus sessions end; daily reminder.

Kept from 1.x: per-task cloud sync with conflict handling, offline queue, swipe to complete/delete, drag to reorder, pull to refresh, templates, weekly goals, forecast/rhythm/capacity algorithms.

## Structure
- `index.html` landing · `lab.html` sign in / guest · `app.html` app shell
- `app.js` UI, views, sheets, gestures, focus timer, report UI
- `styles.css` design system
- `src/store.js` state, sync, lifecycle, habits, goals, usage · `src/analytics.js` stats, scores, badges · `src/algorithms.js` forecast, rhythm, capacity, slot finder
- `src/report.js` PDF report · `src/charts.js` SVG charts · `src/theme.js` themes + icon · `src/nlp.js` quick-add parser · `src/sound.js` sounds + soundscapes
- `vendor/` Supabase client, jsPDF, html2canvas (vendored, no CDN needed, works offline)
- `sw.js` offline cache · `manifest.webmanifest` + PNG icons

## Database
No schema change is required for 2.0 — new data lives in `better_me_state.data`. To verify/harden the database, see `Supabase/HANDOFF_FOR_CLAUDE.md` and run `Supabase/migration_v2_0.sql`.

## Deploy
Static site on Vercel from this repo, no build step. Never commit the `service_role` key or DB password; `src/config.js` holds only the public anon key (RLS protects data).
