import { sb } from './supabase.js';

export const VERSION = '1.4.0';
const KEY = 'bettermeV1';
const DEFAULT_AREAS = ['Academic', 'Personal Intelligence', 'Monetization', 'Reflection'];

const blank = () => ({
  profile: { name: '', age: '', phone: '', bio: '', photo: '' },
  settings: { theme: 'light', sound: true, haptics: true, reminder: '' },
  areas: [...DEFAULT_AREAS],
  lastArea: DEFAULT_AREAS[0],
  goals: {},
  templates: [],
  appliedTpl: {},
  lastReminder: '',
  onboarded: false,
  days: {},
  updatedAt: null
});

let state = blank();
let uid = null;
let timer = null;
let snap = new Map(); // id -> comparison key of each task as last confirmed by the server
const listeners = [];

export const onSync = fn => listeners.push(fn);
const emit = s => listeners.forEach(f => f(s));

export const todayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const getState = () => state;
export const getAreas = () => state.areas;
export const bytes = () => new Blob([JSON.stringify(state)]).size;
export const day = k => (state.days[k] ??= { tasks: [], reflection: '' });

function normalise(raw) {
  const b = blank();
  return {
    ...b,
    ...(raw || {}),
    profile: { ...b.profile, ...(raw?.profile || {}) },
    settings: { ...b.settings, ...(raw?.settings || {}) },
    goals: { ...(raw?.goals || {}) },
    appliedTpl: { ...(raw?.appliedTpl || {}) },
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    days: { ...(raw?.days || {}) }
  };
}

// ---------- row mapping ----------

// Comparison key for a task. Local tasks and database rows produce the same key when their content matches.
function keyOf(r) {
  return JSON.stringify([
    r.day, r.text, r.area, Number(r.minutes) || 0, Number(r.spent) || 0, r.start_time || '',
    !!r.done, r.done_at ? new Date(r.done_at).getTime() : null, Number(r.position) || 0, r.rolled_from || null
  ]);
}

// Every local task as a database row, with its position set from its place in the day.
function currentRows() {
  const map = new Map();
  for (const [k, d] of Object.entries(state.days)) {
    (d.tasks || []).forEach((t, i) => {
      t.position = i;
      const row = {
        id: t.id, user_id: uid, day: k, text: t.text, area: t.area || '',
        minutes: t.minutes || 0, spent: t.spent || 0, start_time: t.startTime || '',
        done: !!t.done, done_at: t.doneAt || null, position: i, rolled_from: t.rolledFrom || null
      };
      map.set(t.id, { row, key: keyOf(row), task: t });
    });
  }
  return map;
}

function taskFromRow(r) {
  return {
    id: r.id, text: r.text, area: r.area || '', minutes: r.minutes || 0, spent: r.spent || 0,
    startTime: r.start_time || '', done: !!r.done, doneAt: r.done_at || null,
    rolledFrom: r.rolled_from || undefined, position: r.position || 0, updatedAt: r.updated_at
  };
}

function removeFromState(id, k) {
  if (state.days[k]) state.days[k].tasks = state.days[k].tasks.filter(t => t.id !== id);
}

function addToState(t, k) {
  state.days[k] ??= { tasks: [], reflection: '' };
  state.days[k].tasks.push(t);
}

// The record holds everything except tasks. Reflections are kept per day.
function recordData() {
  const days = {};
  for (const [k, d] of Object.entries(state.days)) days[k] = { reflection: d.reflection || '' };
  return { ...state, days };
}

function persistLocal() {
  if (uid) localStorage.setItem(`${KEY}:${uid}`, JSON.stringify(state));
}

function persistSnap() {
  if (uid) localStorage.setItem(`${KEY}:snap:${uid}`, JSON.stringify([...snap]));
}

function fail(err) {
  console.warn('Sync failed', err);
  emit('error');
  return false;
}

// ---------- pull and merge ----------

// Merges server rows into local state. Changes made only on this phone are kept and sent later.
// Changes made only on another device are taken. Changes on both sides: the newer edit wins.
function mergeRows(rows) {
  const local = currentRows();
  const remote = new Map(rows.map(r => [r.id, r]));
  const touched = new Set();

  // Tasks the server no longer has are removed here, unless they were edited on this phone.
  for (const [id, { row, key }] of local) {
    if (!remote.has(id) && snap.has(id) && snap.get(id) === key) {
      removeFromState(id, row.day);
      touched.add(row.day);
    }
  }

  for (const r of rows) {
    const loc = local.get(r.id);
    const remoteKey = keyOf(r);
    if (!loc) {
      if (snap.has(r.id)) continue; // deleted on this phone, the flush removes it on the server
      addToState(taskFromRow(r), r.day);
      touched.add(r.day);
      continue;
    }
    const localChanged = snap.get(r.id) !== loc.key;
    const remoteChanged = snap.get(r.id) !== remoteKey;
    let takeRemote = false;
    if (remoteChanged && !localChanged) takeRemote = true;
    else if (remoteChanged && localChanged) {
      takeRemote = Date.parse(r.updated_at || 0) > Date.parse(loc.task.updatedAt || 0);
    }
    if (takeRemote) {
      removeFromState(r.id, loc.row.day);
      addToState(taskFromRow(r), r.day);
      touched.add(r.day);
      touched.add(loc.row.day);
    }
  }

  for (const k of touched) {
    if (state.days[k]) state.days[k].tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
}

async function pullAll() {
  const [rec, rows] = await Promise.all([
    sb.from('better_me_state').select('data,updated_at').eq('user_id', uid).maybeSingle(),
    sb.from('better_me_tasks').select('*').eq('user_id', uid)
  ]);
  if (rec.error || rows.error) return fail(rec.error || rows.error);

  if (rec.data?.data) {
    const remote = rec.data.data;
    if (!state.updatedAt || (remote.updatedAt && remote.updatedAt > state.updatedAt)) {
      const localTasks = {};
      for (const [k, d] of Object.entries(state.days)) localTasks[k] = d.tasks || [];
      const next = normalise({ ...remote, days: {} });
      for (const [k, d] of Object.entries(remote.days || {})) next.days[k] = { tasks: localTasks[k] || [], reflection: d?.reflection || '' };
      for (const k of Object.keys(localTasks)) next.days[k] ??= { tasks: localTasks[k], reflection: '' };
      state = next;
    }
  }

  mergeRows(rows.data || []);
  persistLocal();
  emit('saved');
  return true;
}

// Sends local changes to the server: changed tasks, deleted tasks, then the record.
async function flush() {
  if (!uid) return;
  if (!navigator.onLine) { emit('offline'); return; }
  const now = new Date().toISOString();
  const cur = currentRows();
  const upserts = [], deletes = [];
  for (const [id, { row, key, task }] of cur) {
    if (snap.get(id) !== key) {
      task.updatedAt = now;
      row.updated_at = now;
      upserts.push(row);
    }
  }
  for (const id of snap.keys()) if (!cur.has(id)) deletes.push(id);

  if (upserts.length) {
    const { error } = await sb.from('better_me_tasks').upsert(upserts, { onConflict: 'id' });
    if (error) return fail(error);
  }
  if (deletes.length) {
    const { error } = await sb.from('better_me_tasks').delete().in('id', deletes);
    if (error) return fail(error);
  }
  state.updatedAt = now;
  const { error } = await sb.from('better_me_state').upsert({ user_id: uid, data: recordData(), updated_at: now });
  if (error) return fail(error);

  snap = new Map([...cur].map(([id, v]) => [id, v.key]));
  persistSnap();
  persistLocal();
  emit('saved');
}

// ---------- public API ----------

export async function load(userId) {
  uid = userId;
  try { state = normalise(JSON.parse(localStorage.getItem(`${KEY}:${uid}`) || 'null')); }
  catch { state = blank(); }
  try { snap = new Map(JSON.parse(localStorage.getItem(`${KEY}:snap:${uid}`) || '[]')); }
  catch { snap = new Map(); }

  if (navigator.onLine) {
    if (await pullAll()) await flush();
  } else {
    emit('offline');
  }
  window.addEventListener('online', () => save());
  return state;
}

// Pull to refresh: fetch the latest from the server, merge, and send anything still pending.
export async function reloadRemote() {
  if (!uid) return false;
  if (!navigator.onLine) { emit('offline'); return false; }
  if (!(await pullAll())) return false;
  await flush();
  return true;
}

export function save() {
  if (!uid) return;
  state.updatedAt = new Date().toISOString();
  persistLocal();
  emit('saving');
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

export function setLastArea(a) { state.lastArea = a; save(); }
export function setOnboarded(name) {
  state.profile.name = (name || '').trim() || state.profile.name;
  state.onboarded = true;
  save();
}

export function addTask(k, text, area, minutes, startTime = '') {
  if (!text) return;
  day(k).tasks.push({ id: crypto.randomUUID(), text, area, minutes: Number(minutes) || 0, startTime: startTime || '', spent: 0, done: false, doneAt: null });
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

export function addSpent(k, id, mins) {
  const t = day(k).tasks.find(x => x.id === id);
  if (!t || mins <= 0) return;
  t.spent = (t.spent || 0) + mins;
  save();
}

export function moveTask(k, id, toIndex) {
  const d = day(k);
  const from = d.tasks.findIndex(t => t.id === id);
  if (from < 0) return;
  const [item] = d.tasks.splice(from, 1);
  d.tasks.splice(Math.max(0, Math.min(toIndex, d.tasks.length)), 0, item);
  save();
}

export function removeTask(k, id) {
  const d = day(k);
  const t = d.tasks.find(x => x.id === id);
  d.tasks = d.tasks.filter(x => x.id !== id);
  save();
  return t;
}

export function restoreTask(k, t) {
  if (!t) return;
  day(k).tasks.push(t);
  save();
}

export function moveOpen(fromKey, toKey) {
  const from = day(fromKey), target = day(toKey);
  let moved = 0;
  for (const t of from.tasks.filter(t => !t.done)) {
    if (target.tasks.some(x => x.rolledFrom === t.id)) continue;
    target.tasks.push({ ...t, id: crypto.randomUUID(), done: false, doneAt: null, spent: 0, rolledFrom: t.id });
    moved++;
  }
  from.tasks = from.tasks.filter(t => t.done);
  save();
  return moved;
}

export function saveTemplate(name, k, schedule = []) {
  const tasks = day(k).tasks.map(({ text, area, minutes, startTime }) => ({ text, area, minutes, startTime: startTime || '' }));
  name = (name || '').trim();
  if (!name || !tasks.length) return false;
  state.templates.push({ id: crypto.randomUUID(), name, tasks, schedule: schedule.map(Number) });
  save();
  return true;
}

export function deleteTemplate(id) {
  state.templates = state.templates.filter(t => t.id !== id);
  save();
}

function pushTemplateTasks(tpl, k) {
  for (const t of tpl.tasks) {
    day(k).tasks.push({ id: crypto.randomUUID(), text: t.text, area: t.area, minutes: t.minutes || 0, startTime: t.startTime || '', spent: 0, done: false, doneAt: null });
  }
  return tpl.tasks.length;
}

export function applyTemplate(id, k) {
  const tpl = state.templates.find(x => x.id === id);
  if (!tpl) return 0;
  const n = pushTemplateTasks(tpl, k);
  save();
  return n;
}

export function applyScheduled(k) {
  const weekday = new Date(k + 'T12:00').getDay();
  const done = state.appliedTpl[k] || [];
  let added = 0;
  for (const tpl of state.templates) {
    if (!tpl.schedule?.includes(weekday) || done.includes(tpl.id)) continue;
    added += pushTemplateTasks(tpl, k);
    done.push(tpl.id);
  }
  if (added) { state.appliedTpl[k] = done; save(); }
  return added;
}

export function setGoal(area, mins) {
  state.goals[area] = Math.max(0, Number(mins) || 0);
  save();
}

export function setReminder(hhmm) {
  state.settings.reminder = hhmm || '';
  save();
}

export function markReminded(k) {
  state.lastReminder = k;
  save();
}

export function renameArea(oldN, newN) {
  const i = state.areas.indexOf(oldN);
  if (i < 0 || !newN || newN === oldN || state.areas.includes(newN)) return false;
  state.areas[i] = newN;
  for (const d of Object.values(state.days)) for (const t of d.tasks) if (t.area === oldN) t.area = newN;
  if (state.lastArea === oldN) state.lastArea = newN;
  if (state.goals[oldN] !== undefined) { state.goals[newN] = state.goals[oldN]; delete state.goals[oldN]; }
  save();
  return true;
}

export function addArea(n) {
  n = (n || '').trim();
  if (!n || state.areas.includes(n) || state.areas.length >= 8) return false;
  state.areas.push(n);
  save();
  return true;
}

export function removeArea(n) {
  if (state.areas.length <= 1) return false;
  state.areas = state.areas.filter(a => a !== n);
  if (state.lastArea === n) state.lastArea = state.areas[0];
  delete state.goals[n];
  save();
  return true;
}

export const exportJSON = () => JSON.stringify(state, null, 2);

export function exportCSV() {
  const rows = [['date', 'task', 'area', 'start', 'minutes', 'spent', 'done', 'completed_at']];
  for (const k of Object.keys(state.days).sort()) {
    for (const t of state.days[k].tasks) {
      rows.push([k, `"${t.text.replace(/"/g, '""')}"`, `"${t.area}"`, t.startTime || '', t.minutes, t.spent || 0, t.done, t.doneAt || '']);
    }
  }
  return rows.map(r => r.join(',')).join('\n');
}
