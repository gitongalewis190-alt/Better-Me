<<<<<<< HEAD
# Better Me v1.0.0

A daily SOP tracker. Plan the day, check tasks off, review progress, and print or save a PDF.

## Files
- `index.html`, `styles.css`, `app.js`: the app shell and UI
- `sw.js`, `manifest.webmanifest`: offline support and install to home screen
- `src/store.js`: local storage with optional Supabase sync, plus the version and config
- `src/analytics.js`: completion, streaks, area and weekday stats, advice rules
- `src/prompts.js`: reflection prompts
- `src/sound.js`: interface sounds (save, complete, cancel)

## Setup
1. Create a Supabase project. In the SQL editor, run:

```sql
create table if not exists better_me_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table better_me_state enable row level security;
create policy “owner full access” on better_me_state for all using (true) with check (true);
=======
# Better-Me
>>>>>>> main
