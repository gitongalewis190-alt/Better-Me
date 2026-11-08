import { sb } from './supabase.js';

export const VERSION = '1.0.1';

const KEY = 'bettermeV1';
const blank = () => ({
  profile: { name: '', age: '', phone: '', bio: '', photo: '' },
  settings: { theme: 'light', sound: true },
  days: {}
});

let state = blank();
let uid = null;
let timer = null;

export const todayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const getState = () => state;
export const bytes = () => new Blob([JSON.stringify(state)]).size;
export const day = k => (state.days[k] ??= { tasks: [], reflection: '' });

// Loads the signed-in user's cloud copy, falling back to the local cache if offline.
export async function load(userId) {
  uid = userId;
  try { state = { ...blank(), ...JSON.parse(localStorage.getItem(`${KEY}:${uid}`) || '{}') }; }
  catch { state = blank(); }

  const { data, error } = await sb.from('better_me_state').select('data').eq('user_id', uid).maybeSingle();
  if (error) console.warn('Sync unavailable, using local copy', error);
  else if (data?.data) state = { ...blank(), ...data.data };
  return state;
}

// Saves locally at once, and pushes to Supabase after 400 ms of quiet.
export function save() {
  if (!uid) return;
  localStorage.setItem(`${KEY}:${uid}`, JSON.stringify(state));
  clearTimeout(timer);
  timer = setTimeout(() => {
    sb.from('better_me_state')
      .upsert({ user_id: uid, data: state, updated_at: new Date().toISOString() })
      .then(({ error }) => error && console.warn('Sync failed', error));
  }, 400);
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
