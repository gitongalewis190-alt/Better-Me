# Handoff: Better Me 2.0 → Supabase

Give this file to the Claude that has the Supabase MCP connected to the project **xshpnnanpetrqyjurwji** (Better-Me).

## What to do
1. Run `Supabase/migration_v2_0.sql` with `apply_migration` (name: `better_me_v2_0`). It is idempotent and safe to re-run.
   - Older policies with other names (e.g. "own row select") can stay; the new ones are only added if missing.
2. Run the two verification `select`s at the bottom with `execute_sql` and confirm:
   - `better_me_state`, `better_me_tasks`, `better_me_prints` all have `rowsecurity = true`.
   - Each has select/insert/update/delete policies (state may lack delete — fine).
3. Run `get_advisors` (security + performance) and fix anything flagged for these three tables.
4. Authentication → URL configuration:
   - Site URL: `https://better-me-ashen.vercel.app`
   - Redirect URLs: `https://better-me-ashen.vercel.app/**` (needed for magic links and password reset — the app sends people to `lab.html?reset=1` and `app.html`).
5. Authentication → Providers → Email: keep enabled; magic links ("Email me a sign-in link") use the same provider.

## Nothing else is required
The app needs no new tables or columns. All 2.0 features live in `better_me_state.data` (jsonb):
`habits, habitLog, moods, wellness, focusLog, longGoals, badges, taskMeta (priority/notes/subtasks per task id), usage, rules, templates, settings, profile, days[k].{reflection,intention,gratitude,note}`.

## Do NOT
- Commit or paste the `service_role` key or the DB password anywhere.
- Drop `better_me_tasks_backup_v14` without the owner's say-so.
