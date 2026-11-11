import { sb } from './supabase.js';

export const VERSION = '1.5.0';
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
  printLog: [],
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

const HHMM = /^\d{2}:\d{2}$/;
const DEFAULT_MINUTES = 30;

// Older tasks have no status. Give them one so every task follows the same lifecycle.
const LEGACY = { planned: 'scheduled', review: 'waiting_review', notdone: 'missed', paused: 'running', scheduled: 'scheduled', running: 'running', waiting_review: 'waiting_review', done: 'done', missed: 'missed', pushed: 'pushed' };
const STATUSES = ['scheduled', 'running', 'waiting_review', 'done', 'missed', 'pushed'];
const statusOf = (raw, done) => (STATUSES.includes(raw) ? raw : LEGACY[raw]) || (done ? 'done' : 'scheduled');

function migrateTask(t) {
  const done = !!t.done;
  return {
    ...t, minutes: Number(t.minutes) || 0, spent: Number(t.spent) || 0,
    startTime: t.startTime || '', endTime: t.endTime || '', done,
    status: statusOf(t.status, done), runStart: t.runStart ?? null
  };
}

function migrateDays(days) {
  const out = {};
  for (const [k, d] of Object.entries(days)) {
    out[k] = { reflection: d?.reflection || '', tasks: (d?.tasks || []).map(migrateTask) };
  }
  return out;
}

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
    days: migrateDays(raw?.days || {})
  };
}

// ---------- row mapping ----------

// Comparison key for a task. Local tasks and database rows produce the same key when their content matches.
function keyOf(r) {
  return JSON.stringify([
    r.day, r.text, r.area, Number(r.minutes) || 0, Number(r.spent) || 0, r.start_time || '',
    !!r.done, r.done_at ? new Date(r.done_at).getTime() : null, Number(r.position) || 0, r.rolled_from || null,
    r.status || '', r.end_time || '', r.timer_started_at ? Date.parse(r.timer_started_at) : 0
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
        minutes: Math.round(t.minutes || 0), spent: Math.round(t.spent || 0), start_time: t.startTime || '',
        done: !!t.done, done_at: t.doneAt || null, position: i, rolled_from: t.rolledFrom || null,
        status: t.status || 'scheduled', end_time: t.endTime || '', timer_started_at: t.runStart ? new Date(t.runStart).toISOString() : null
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
    rolledFrom: r.rolled_from || undefined, position: r.position || 0, updatedAt: r.updated_at,
    status: statusOf(r.status, r.done), endTime: r.end_time || '', runStart: r.timer_started_at ? Date.parse(r.timer_started_at) : null
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
export function saveProfile(f) {
  const p = state.profile;
  p.name = (f.name || '').trim();
  p.age = (f.age || '').trim();
  p.phone = (f.phone || '').trim();
  p.bio = (f.bio || '').trim();
  save();
}

export function logPrint(entry) {
  const row = { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry };
  state.printLog = [row, ...(state.printLog || [])].slice(0, 200);
  save();
  if (uid) {
    sb.from('better_me_prints').insert({
      id: row.id, user_id: uid, doc: String(entry.doc || 'sops'), title: 'Better Me',
      range_from: entry.from || null, range_to: entry.to || null,
      options: { orientation: entry.orientation, font: entry.font, color: entry.color },
      summary: ''
    }).then(({ error }) => { if (error) console.warn('Print log not saved', error); });
  }
}

export function setOnboarded(name) {
  state.profile.name = (name || '').trim() || state.profile.name;
  state.onboarded = true;
  save();
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
    day(k).tasks.push({ id: crypto.randomUUID(), text: t.text, area: t.area, minutes: t.minutes || 0, startTime: t.startTime || '', endTime: '', spent: 0, done: false, doneAt: null, status: 'scheduled', runStart: null });
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

// ---------- task lifecycle ----------
// scheduled → running (at its start time) → waiting_review (minutes used up) → done | missed.
// A task that is running with no timer start is paused. Moved tasks are removed from the day and copied to the next day.
// Everything is computed from timestamps, so a phone that was asleep catches up when it opens.

export const findTask = (k, id) => day(k).tasks.find(x => x.id === id);
const instantOf = (k, hhmm) => new Date(`${k}T${hhmm}:00`).getTime();
const nextKey = k => todayKey(new Date(new Date(k + 'T12:00').getTime() + 86400000));

export function budgetMs(t, k) {
  if (t.minutes > 0) return t.minutes * 60000;
  if (HHMM.test(t.startTime || '') && HHMM.test(t.endTime || '')) {
    const span = instantOf(k, t.endTime) - instantOf(k, t.startTime);
    if (span > 0) return span;
  }
  return DEFAULT_MINUTES * 60000;
}

export function elapsedMs(t, now = Date.now()) {
  return (t.spent || 0) * 60000 + (t.status === 'running' && t.runStart != null ? now - t.runStart : 0);
}

export function remainingMs(t, k, now = Date.now()) {
  return Math.max(0, budgetMs(t, k) - elapsedMs(t, now));
}

export function addTask(k, text, area, minutes, startTime = '', endTime = '', startNow = false) {
  text = (text || '').trim();
  if (!text) return null;
  const now = Date.now();
  const start = startNow ? new Date(now).toTimeString().slice(0, 5) : (HHMM.test(startTime || '') ? startTime : '');
  const t = {
    id: crypto.randomUUID(), text, area: area || '', minutes: Number(minutes) || 0,
    startTime: start, endTime: HHMM.test(endTime || '') ? endTime : '', spent: 0, done: false, doneAt: null,
    status: startNow ? 'running' : 'scheduled', runStart: startNow ? now : null
  };
  day(k).tasks.push(t);
  save();
  return t;
}

export function tickTasks(now = Date.now()) {
  let changed = false;
  for (const [k, d] of Object.entries(state.days)) {
    for (const t of d.tasks) {
      if (t.status === 'scheduled' && HHMM.test(t.startTime || '')) {
        const at = instantOf(k, t.startTime);
        if (now >= at) { t.status = 'running'; t.runStart = at; changed = true; }
      }
      if (t.status === 'running' && t.runStart != null && elapsedMs(t, now) >= budgetMs(t, k)) {
        t.spent = budgetMs(t, k) / 60000;
        t.runStart = null;
        t.status = 'waiting_review';
        changed = true;
      }
    }
  }
  if (changed) save();
  return changed;
}

export function startFocus(k, id, now = Date.now()) {
  const t = findTask(k, id);
  if (!t) return false;
  const startable = t.status === 'scheduled' || (t.status === 'running' && t.runStart == null);
  if (!startable) return false;
  t.status = 'running';
  t.runStart = now;
  save();
  return true;
}

export function pauseFocus(k, id, now = Date.now()) {
  const t = findTask(k, id);
  if (!t || t.status !== 'running' || t.runStart == null) return false;
  t.spent = elapsedMs(t, now) / 60000;
  t.runStart = null;
  save();
  return true;
}

export function toggleTask(k, id) {
  const t = findTask(k, id);
  if (!t) return false;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  t.status = t.done ? 'done' : 'waiting_review';
  t.runStart = null;
  save();
  return t.done;
}

// Review outcome: done, not done (kept as a record), or moved to tomorrow with the same start time.
export function reviewTask(k, id, outcome) {
  const d = day(k), t = d.tasks.find(x => x.id === id);
  if (!t) return false;
  if (outcome === 'done') { t.status = 'done'; t.done = true; t.doneAt = new Date().toISOString(); t.runStart = null; }
  else if (outcome === 'notdone') { t.status = 'missed'; t.done = false; t.doneAt = null; t.runStart = null; }
  else if (outcome === 'tomorrow') {
    d.tasks = d.tasks.filter(x => x.id !== id);
    day(nextKey(k)).tasks.push({ ...t, status: 'scheduled', runStart: null, spent: 0, done: false, doneAt: null, rolledFrom: k });
  }
  save();
  return true;
}

// Moves every task that is not done or missed to the next day, as scheduled tasks.
export function moveOpen(fromKey, toKey) {
  const from = day(fromKey), to = day(toKey);
  const open = from.tasks.filter(t => !t.done && t.status !== 'missed');
  from.tasks = from.tasks.filter(t => t.done || t.status === 'missed');
  for (const t of open) to.tasks.push({ ...t, status: 'scheduled', runStart: null, spent: 0, rolledFrom: fromKey });
  save();
  return open.length;
}
