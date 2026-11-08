# Better Me v1.4.0

A daily SOP tracker. Plan the day, focus with a timer, swipe and reorder tasks, read your progress, search, export, and print or save a PDF.

## What’s in v1.4.0
- Per-task sync: every task is stored as its own row, so two devices no longer overwrite each other’s whole day. Tasks changed on one device appear on the other after a pull or a reload.
- Conflicts on the same task: the newer edit wins. Offline changes are kept on the phone and sent when it reconnects.

## What’s in v1.3.0
- Swipe a task right to complete, left to delete (with undo).
- Drag the ⋮⋮ handle to reorder tasks within a day.
- Pull down at the top of the page to refresh from the cloud.
- Haptic feedback on save, complete, and cancel where the device supports it. Toggle in Settings.
- Weekly templates: choose days when saving a template, and it applies itself on those days.
- Daily reminder: set a time in Settings and allow notifications.
- Accessibility pass: labelled controls, dialog roles, focus outlines, a skip link, 44px touch targets, and reduced-motion support.
- iOS splash screens for common iPhone sizes, plus app icons (192, 512, 180).
- Earlier: focus timer, start times, templates, weekly goals, weekly review, onboarding, undo, sync indicator, command bar (Ctrl/⌘ K or “/“), categories, JSON and CSV export, plain-language sign-in errors, password reset, offline fallback.

## Notes on reminders
- Reminders fire while the app is open, or when the phone wakes the installed app. True background push needs a server and is not built yet.
- On iPhone, notifications only work for apps added to the Home Screen (iOS 16.4 or later).

## Structure
- `index.html` landing, `lab.html` sign in, `app.html` app shell (signed-in only)
- `app.js` UI, gestures, reorder, reminders; `styles.css` theme, layout, motion
- `sw.js` offline fallback and notification click handling
- `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `splash-*.png`
- `src/config.js` Supabase URL and public anon key
- `src/supabase.js` shared client; `src/auth.js` sign in, sign up, reset, sign out, plain errors
- `src/store.js` per-user state, sync, categories, goals, templates, schedules, reminders, export
- `src/analytics.js` streaks, weekly summary, goal progress; `src/algorithms.js` forecast, rhythm, capacity
- `src/prompts.js` reflection prompts; `src/sound.js` sounds and haptics

## Setup
1. Supabase → SQL Editor, run once (already applied to the Better-Me project):

```sql
create table if not exists public.better_me_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default ‘{}’::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.better_me_state enable row level security;
create policy “own row select” on public.better_me_state for select to authenticated using (auth.uid() = user_id);
create policy “own row insert” on public.better_me_state for insert to authenticated with check (auth.uid() = user_id);
create policy “own row update” on public.better_me_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

2. Authentication → URL Configuration: Site URL `https://better-me-ashen.vercel.app`; add `https://better-me-ashen.vercel.app/**` to Redirect URLs.
3. Authentication → Email templates: the reset link goes to `lab.html`.
4. Deploy on Vercel from the GitHub repo, no build step.

## Keys
- `src/config.js` holds only the public URL and anon key. Row Level Security protects the data.
- Never commit the `service_role` key or the database password.

## Not yet built
- Profile photos in Supabase Storage (kept inside the record, so keep them small).
- Real Supabase storage usage (the meter estimates from data size).
- Background push notifications (needs a server).
- Full time-block timeline (start times show in lists only).
- Swahili (deferred).
