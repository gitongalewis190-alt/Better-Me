
**7. `src/store.js`**

```js
export const VERSION = '1.0.0';
export const CONFIG = { supabaseUrl: '', supabaseAnonKey: '' }; // paste your Supabase values here

const KEY = 'bettermeV1';
const blank = () => ({
  profile: { name: '', age: '', phone: '', bio: '', photo: '' },
  settings: { theme: 'light', sound: true },
  days: {}
});

let state = blank();
let remote = null;

export const todayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const getState = () => state;
export const bytes = () => new Blob([JSON.stringify(state)]).size;
export const day = k => (state.days[k] ??= { tasks: [], reflection: '' });

export async function load() {
  try { state = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { state = blank(); }

  if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      remote = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
      const { data } = await remote.from('better_me_state').select('data').eq('id', 'owner').maybeSingle();
      if (data?.data) state = { ...blank(), ...data.data };
    } catch (err) {
      console.warn('Supabase unavailable, running local-only', err);
      remote = null;
    }
  }
  return state;
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (remote) {
    remote.from('better_me_state')
      .upsert({ id: 'owner', data: state, updated_at: new Date().toISOString() })
      .then(() => {}, err => console.warn('Sync failed', err));
  }
}

export function addTask(k, text, area, minutes) {
  if (!text) return;
  day(k).tasks.push({ id: crypto.randomUUID(), text, area, minutes: Number(minutes) || 0, done: false, doneAt: null });
  save();
}

export function toggleTask(k, id) {
  const t = day(k).tasks.find(x => x.id === id);
  if (!t) return false;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  save();
  return t.done;
}

export function removeTask(k, id) {
  const d = day(k);
  d.tasks = d.tasks.filter(x => x.id !== id);
  save();
}

export function moveOpen(fromKey, toKey) {
  const from = day(fromKey);
  const open = from.tasks.filter(t => !t.done);
  if (!open.length) return 0;
  open.forEach(t => day(toKey).tasks.push({ ...t, id: crypto.randomUUID(), done: false, doneAt: null }));
  from.tasks = from.tasks.filter(t => t.done);
  save();
  return open.length;
}
