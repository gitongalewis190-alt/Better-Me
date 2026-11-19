import { sb, hasCloud } from './supabase.js';

export const VERSION = '2.0.0';
const KEY = 'bettermeV1';
export const GUEST = 'guest';
const DEFAULT_AREAS = ['Academic', 'Personal Intelligence', 'Monetization', 'Reflection'];
export const PALETTE = ['#ff5a36', '#7c5cff', '#18b26b', '#f5a524', '#1fa9d6', '#f0527a', '#a0703c', '#3b82f6', '#14b8a6', '#e11d48'];

const blank = () => ({
  profile: { name: '', age: '', phone: '', bio: '', photo: '', email: '', occupation: '', location: '', motto: '' },
  settings: {
    theme: 'system', accent: 'ember', bg: 'aurora', density: 'comfy', fontScale: 1, motion: 'full', contrast: false,
    sound: true, haptics: true, reminder: '', weekStart: 1, confetti: true, taskAlerts: true, hour12: false,
    pomo: { work: 25, short: 5, long: 15, every: 4, autoBreak: true }, ambient: 'off', ambientVol: 0.4,
    lockHash: '', defaultMinutes: 30
  },
  areas: [...DEFAULT_AREAS],
  areaColors: {},
  lastArea: DEFAULT_AREAS[0],
  goals: {},
  templates: [],
  appliedTpl: {},
  rules: [],
  appliedRules: {},
  habits: [],
  habitLog: {},
  moods: {},
  wellness: {},
  focusLog: [],
  longGoals: [],
  badges: {},
  taskMeta: {},
  usage: { opens: {}, minutes: {}, views: {}, actions: {}, first: '' },
  lastReminder: '',
  onboarded: false,
  seenVersion: '',
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
export const addDays = (k, n) => todayKey(new Date(new Date(k + 'T12:00').getTime() + n * 86400000));
export const getState = () => state;
export const getAreas = () => state.areas;
export const isGuest = () => uid === GUEST;
export const userId = () => uid;
export const bytes = () => new Blob([JSON.stringify(state)]).size;
const blankDay = () => ({ tasks: [], reflection: '', intention: '', gratitude: ['', '', ''], note: '' });
export const day = k => (state.days[k] ??= blankDay());
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

export function colorFor(a) {
  if (state.areaColors[a]) return state.areaColors[a];
  const i = state.areas.indexOf(a);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

const HHMM = /^\d{2}:\d{2}$/;
const META_FIELDS = ['priority', 'notes', 'subtasks', 'tags', 'ruleId', 'energy'];

// Older tasks have no status. Give them one so every task follows the same lifecycle.
const LEGACY = { planned: 'scheduled', review: 'waiting_review', notdone: 'missed', paused: 'running' };
const STATUSES = ['scheduled', 'running', 'waiting_review', 'done', 'missed', 'pushed'];
const statusOf = (raw, done) => (STATUSES.includes(raw) ? raw : LEGACY[raw]) || (done ? 'done' : 'scheduled');

function migrateTask(t) {
  const done = !!t.done;
  return {
    ...t, minutes: Number(t.minutes) || 0, spent: Number(t.spent) || 0,
    startTime: t.startTime || '', endTime: t.endTime || '', done,
    status: statusOf(t.status, done), runStart: t.runStart ?? null,
    priority: t.priority || 0, notes: t.notes || '', subtasks: Array.isArray(t.subtasks) ? t.subtasks : [], tags: Array.isArray(t.tags) ? t.tags : []
  };
}

function migrateDays(days) {
  const out = {};
  for (const [k, d] of Object.entries(days || {})) {
    out[k] = {
      ...blankDay(), reflection: d?.reflection || '', intention: d?.intention || '', note: d?.note || '',
      gratitude: Array.isArray(d?.gratitude) ? [...d.gratitude, '', '', ''].slice(0, 3) : ['', '', ''],
      tasks: (d?.tasks || []).map(migrateTask)
    };
  }
  return out;
}

function normalise(raw) {
  const b = blank();
  const s = {
    ...b,
    ...(raw || {}),
    profile: { ...b.profile, ...(raw?.profile || {}) },
    settings: { ...b.settings, ...(raw?.settings || {}), pomo: { ...b.settings.pomo, ...(raw?.settings?.pomo || {}) } },
    areas: Array.isArray(raw?.areas) && raw.areas.length ? raw.areas : b.areas,
    areaColors: { ...(raw?.areaColors || {}) },
    goals: { ...(raw?.goals || {}) },
    appliedTpl: { ...(raw?.appliedTpl || {}) },
    appliedRules: { ...(raw?.appliedRules || {}) },
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    rules: Array.isArray(raw?.rules) ? raw.rules : [],
    habits: Array.isArray(raw?.habits) ? raw.habits : [],
    habitLog: { ...(raw?.habitLog || {}) },
    moods: { ...(raw?.moods || {}) },
    wellness: { ...(raw?.wellness || {}) },
    focusLog: Array.isArray(raw?.focusLog) ? raw.focusLog : [],
    longGoals: Array.isArray(raw?.longGoals) ? raw.longGoals : [],
    badges: { ...(raw?.badges || {}) },
    taskMeta: { ...(raw?.taskMeta || {}) },
    usage: { opens: {}, minutes: {}, views: {}, actions: {}, first: '', ...(raw?.usage || {}) },
    printLog: Array.isArray(raw?.printLog) ? raw.printLog : [],
    days: migrateDays(raw?.days || {})
  };
  // 1.x stored theme as 'light' or 'dark' only; both stay valid.
  if (!['system', 'light', 'dark'].includes(s.settings.theme)) s.settings.theme = 'system';
  attachMeta(s);
  return s;
}

// Extra task fields (priority, notes, subtasks, tags) live in the record, keyed by task id,
// so they sync without any change to the task table.
function attachMeta(s = state) {
  const meta = s.taskMeta || {};
  for (const d of Object.values(s.days)) for (const t of d.tasks) {
    const m = meta[t.id];
    if (m) for (const f of META_FIELDS) if (m[f] !== undefined) t[f] = m[f];
  }
}

function collectMeta() {
  const meta = {};
  for (const d of Object.values(state.days)) for (const t of d.tasks) {
    const m = {};
    if (t.priority) m.priority = t.priority;
    if (t.notes) m.notes = t.notes;
    if (t.subtasks?.length) m.subtasks = t.subtasks;
    if (t.tags?.length) m.tags = t.tags;
    if (t.ruleId) m.ruleId = t.ruleId;
    if (Object.keys(m).length) meta[t.id] = m;
  }
  state.taskMeta = meta;
  return meta;
}

// ---------- row mapping ----------

function keyOf(r) {
  return JSON.stringify([
    r.day, r.text, r.area, Number(r.minutes) || 0, Number(r.spent) || 0, r.start_time || '',
    !!r.done, r.done_at ? new Date(r.done_at).getTime() : null, Number(r.position) || 0, r.rolled_from || null,
    r.status || '', r.end_time || '', r.timer_started_at ? Date.parse(r.timer_started_at) : 0
  ]);
}

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
  const t = migrateTask({
    id: r.id, text: r.text, area: r.area || '', minutes: r.minutes || 0, spent: r.spent || 0,
    startTime: r.start_time || '', done: !!r.done, doneAt: r.done_at || null,
    rolledFrom: r.rolled_from || undefined, position: r.position || 0, updatedAt: r.updated_at,
    status: statusOf(r.status, r.done), endTime: r.end_time || '', runStart: r.timer_started_at ? Date.parse(r.timer_started_at) : null
  });
  const m = state.taskMeta[r.id];
  if (m) for (const f of META_FIELDS) if (m[f] !== undefined) t[f] = m[f];
  return t;
}

function removeFromState(id, k) {
  if (state.days[k]) state.days[k].tasks = state.days[k].tasks.filter(t => t.id !== id);
}

function addToState(t, k) {
  day(k).tasks.push(t);
}

// The record holds everything except tasks. Day-level journal fields are kept per day.
function recordData() {
  collectMeta();
  const days = {};
  for (const [k, d] of Object.entries(state.days)) {
    const has = d.reflection || d.intention || d.note || (d.gratitude || []).some(Boolean);
    if (has) days[k] = { reflection: d.reflection || '', intention: d.intention || '', note: d.note || '', gratitude: d.gratitude || [] };
  }
  return { ...state, days };
}

const storeKey = () => `${KEY}:${uid}`;
function persistLocal() {
  if (!uid) return;
  collectMeta();
  try { localStorage.setItem(storeKey(), JSON.stringify(state)); }
  catch (e) { console.warn('Local save failed', e); emit('error'); }
}

function persistSnap() {
  if (uid && uid !== GUEST) localStorage.setItem(`${KEY}:snap:${uid}`, JSON.stringify([...snap]));
}

function fail(err) {
  console.warn('Sync failed', err);
  emit('error');
  return false;
}

// ---------- pull and merge ----------

function mergeRows(rows) {
  const local = currentRows();
  const remote = new Map(rows.map(r => [r.id, r]));
  const touched = new Set();

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
      if (snap.has(r.id)) continue;
      addToState(taskFromRow(r), r.day);
      touched.add(r.day);
      continue;
    }
    const localChanged = snap.get(r.id) !== loc.key;
    const remoteChanged = snap.get(r.id) !== remoteKey;
    let takeRemote = false;
    if (remoteChanged && !localChanged) takeRemote = true;
    else if (remoteChanged && localChanged) takeRemote = Date.parse(r.updated_at || 0) > Date.parse(loc.task.updatedAt || 0);
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
      const localDays = state.days;
      const next = normalise({ ...remote, days: {} });
      for (const [k, d] of Object.entries(localDays)) next.days[k] = { ...d };
      for (const [k, d] of Object.entries(remote.days || {})) {
        const cur = next.days[k] ??= blankDay();
        cur.reflection = d?.reflection || '';
        cur.intention = d?.intention || '';
        cur.note = d?.note || '';
        cur.gratitude = Array.isArray(d?.gratitude) ? [...d.gratitude, '', '', ''].slice(0, 3) : ['', '', ''];
      }
      state = next;
      attachMeta();
    }
  }

  mergeRows(rows.data || []);
  persistLocal();
  emit('saved');
  return true;
}

let flushing = false, again = false;
async function flush() {
  if (!uid) return;
  if (uid === GUEST) { persistLocal(); emit('local'); return; }
  if (!navigator.onLine) { emit('offline'); return; }
  if (flushing) { again = true; return; }
  flushing = true;
  try {
    const now = new Date().toISOString();
    const cur = currentRows();
    const upserts = [], deletes = [];
    for (const [id, { row, key, task }] of cur) {
      if (snap.get(id) !== key) { task.updatedAt = now; row.updated_at = now; upserts.push(row); }
    }
    for (const id of snap.keys()) if (!cur.has(id)) deletes.push(id);

    for (let i = 0; i < upserts.length; i += 400) {
      const { error } = await sb.from('better_me_tasks').upsert(upserts.slice(i, i + 400), { onConflict: 'id' });
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
  } catch (e) { fail(e); }
  finally {
    flushing = false;
    if (again) { again = false; setTimeout(flush, 200); }
  }
}

// ---------- public API ----------

export async function load(userId) {
  uid = userId;
  try { state = normalise(JSON.parse(localStorage.getItem(storeKey()) || 'null')); }
  catch { state = blank(); }
  if (uid === GUEST) { emit('local'); return state; }
  try { snap = new Map(JSON.parse(localStorage.getItem(`${KEY}:snap:${uid}`) || '[]')); }
  catch { snap = new Map(); }

  if (navigator.onLine && hasCloud) {
    try { if (await pullAll()) await flush(); } catch (e) { fail(e); }
  } else emit('offline');
  window.addEventListener('online', () => save());
  return state;
}

export async function reloadRemote() {
  if (!uid || uid === GUEST) return false;
  if (!navigator.onLine) { emit('offline'); return false; }
  try { if (!(await pullAll())) return false; } catch (e) { return fail(e); }
  await flush();
  return true;
}

export function save() {
  if (!uid) return;
  state.updatedAt = new Date().toISOString();
  persistLocal();
  emit(uid === GUEST ? 'local' : 'saving');
  clearTimeout(timer);
  timer = setTimeout(flush, 450);
}

export function flushNow() { clearTimeout(timer); return flush(); }

// Guest data saved on this device, waiting to be moved into an account.
export function guestData() {
  try {
    const raw = JSON.parse(localStorage.getItem(`${KEY}:${GUEST}`) || 'null');
    if (!raw) return null;
    const n = Object.values(raw.days || {}).reduce((a, d) => a + (d.tasks || []).length, 0);
    return n || (raw.habits || []).length ? { raw, tasks: n } : null;
  } catch { return null; }
}
export function discardGuest() { localStorage.removeItem(`${KEY}:${GUEST}`); }

// Adds another dataset to this one without overwriting what is here.
export function mergeIn(raw) {
  const other = normalise(raw);
  let tasks = 0;
  const have = new Set(Object.values(state.days).flatMap(d => d.tasks.map(t => t.id)));
  for (const [k, d] of Object.entries(other.days)) {
    const cur = day(k);
    for (const t of d.tasks) if (!have.has(t.id)) { cur.tasks.push(t); tasks++; }
    for (const f of ['reflection', 'intention', 'note']) if (!cur[f] && d[f]) cur[f] = d[f];
    if (!cur.gratitude.some(Boolean)) cur.gratitude = d.gratitude;
  }
  for (const a of other.areas) if (!state.areas.includes(a) && state.areas.length < 12) state.areas.push(a);
  const byId = (list, add) => { const ids = new Set(list.map(x => x.id)); for (const x of add) if (!ids.has(x.id)) list.push(x); };
  byId(state.habits, other.habits);
  byId(state.templates, other.templates);
  byId(state.rules, other.rules);
  byId(state.longGoals, other.longGoals);
  for (const [k, ids] of Object.entries(other.habitLog)) state.habitLog[k] = [...new Set([...(state.habitLog[k] || []), ...ids])];
  for (const [k, m] of Object.entries(other.moods)) state.moods[k] ??= m;
  for (const [k, w] of Object.entries(other.wellness)) state.wellness[k] ??= w;
  state.focusLog = [...state.focusLog, ...other.focusLog].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 1000);
  for (const f of Object.keys(state.profile)) if (!state.profile[f] && other.profile[f]) state.profile[f] = other.profile[f];
  save();
  return tasks;
}

export function replaceAll(raw) {
  const keepSettings = state.settings;
  state = normalise(raw);
  if (!raw?.settings) state.settings = keepSettings;
  save();
}

export function wipeLocal() {
  if (!uid) return;
  localStorage.removeItem(storeKey());
  localStorage.removeItem(`${KEY}:snap:${uid}`);
}

// ---------- profile and settings ----------

export function setLastArea(a) { state.lastArea = a; save(); }
export function saveProfile(f) {
  const p = state.profile;
  for (const k of ['name', 'age', 'phone', 'bio', 'email', 'occupation', 'location', 'motto']) if (k in f) p[k] = String(f[k] || '').trim();
  save();
}
export function setPhoto(dataUrl) { state.profile.photo = dataUrl || ''; save(); }
export function setSetting(path, value) {
  const parts = path.split('.');
  let o = state.settings;
  while (parts.length > 1) o = o[parts.shift()] ??= {};
  o[parts[0]] = value;
  save();
}

export function logPrint(entry) {
  const row = { id: uuid(), at: new Date().toISOString(), ...entry };
  state.printLog = [row, ...(state.printLog || [])].slice(0, 200);
  save();
  if (uid && uid !== GUEST && hasCloud) {
    sb.from('better_me_prints').insert({
      id: row.id, user_id: uid, doc: String(entry.doc || 'report'), title: 'Better Me',
      range_from: entry.from || null, range_to: entry.to || null,
      options: { orientation: entry.orientation, sections: entry.sections, theme: entry.theme },
      summary: entry.summary || ''
    }).then(({ error }) => { if (error) console.warn('Print log not saved', error); });
  }
}

export function setOnboarded(f = {}) {
  if (f.name) state.profile.name = String(f.name).trim();
  if (f.areas?.length) state.areas = f.areas.slice(0, 12);
  if (f.accent) state.settings.accent = f.accent;
  state.onboarded = true;
  state.seenVersion = VERSION;
  save();
}
export function markSeen() { state.seenVersion = VERSION; save(); }

// ---------- tasks ----------

export const findTask = (k, id) => day(k).tasks.find(x => x.id === id);
const instantOf = (k, hhmm) => new Date(`${k}T${hhmm}:00`).getTime();
const nextKey = k => addDays(k, 1);

export function locate(id) {
  for (const [k, d] of Object.entries(state.days)) { const t = d.tasks.find(x => x.id === id); if (t) return { k, t }; }
  return null;
}

export function budgetMs(t, k) {
  if (t.minutes > 0) return t.minutes * 60000;
  if (HHMM.test(t.startTime || '') && HHMM.test(t.endTime || '')) {
    const span = instantOf(k, t.endTime) - instantOf(k, t.startTime);
    if (span > 0) return span;
  }
  return (state.settings.defaultMinutes || 30) * 60000;
}

export function elapsedMs(t, now = Date.now()) {
  return (t.spent || 0) * 60000 + (t.status === 'running' && t.runStart != null ? now - t.runStart : 0);
}

export function remainingMs(t, k, now = Date.now()) {
  return Math.max(0, budgetMs(t, k) - elapsedMs(t, now));
}

export function addSpent(k, id, mins) {
  const t = findTask(k, id);
  if (!t || mins <= 0) return;
  t.spent = (t.spent || 0) + mins;
  save();
}

export function addTask(k, text, area, minutes, startTime = '', endTime = '', startNow = false, extra = {}) {
  text = (text || '').trim();
  if (!text) return null;
  const now = Date.now();
  const start = startNow ? new Date(now).toTimeString().slice(0, 5) : (HHMM.test(startTime || '') ? startTime : '');
  const t = migrateTask({
    id: uuid(), text, area: area || state.lastArea || state.areas[0], minutes: Number(minutes) || 0,
    startTime: start, endTime: HHMM.test(endTime || '') ? endTime : '', spent: 0, done: false, doneAt: null,
    status: startNow ? 'running' : 'scheduled', runStart: startNow ? now : null,
    priority: Number(extra.priority) || 0, notes: extra.notes || '', subtasks: extra.subtasks || [], tags: extra.tags || [], ruleId: extra.ruleId
  });
  day(k).tasks.push(t);
  if (start) sortDay(k);
  save();
  return t;
}

// Keeps timed tasks in time order while untimed tasks keep their place at the end.
function sortDay(k) {
  const d = day(k);
  const timed = d.tasks.filter(t => t.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const free = d.tasks.filter(t => !t.startTime);
  d.tasks = [...timed, ...free];
}

export function updateTask(k, id, patch) {
  const t = findTask(k, id);
  if (!t) return null;
  const timeChanged = 'startTime' in patch && patch.startTime !== t.startTime;
  Object.assign(t, patch);
  if (t.startTime && !HHMM.test(t.startTime)) t.startTime = '';
  if (t.endTime && !HHMM.test(t.endTime)) t.endTime = '';
  t.minutes = Number(t.minutes) || 0;
  if (timeChanged && t.status === 'running' && t.runStart != null && t.startTime && instantOf(k, t.startTime) > Date.now()) {
    t.status = 'scheduled'; t.runStart = null;
  }
  if (timeChanged) sortDay(k);
  save();
  return t;
}

export function moveToDay(k, id, toKey) {
  if (k === toKey) return false;
  const d = day(k), t = d.tasks.find(x => x.id === id);
  if (!t) return false;
  d.tasks = d.tasks.filter(x => x.id !== id);
  day(toKey).tasks.push({ ...t, status: t.done ? 'done' : 'scheduled', runStart: null, rolledFrom: k });
  sortDay(toKey);
  save();
  return true;
}

export function duplicateTask(k, id) {
  const t = findTask(k, id);
  if (!t) return null;
  const c = { ...t, id: uuid(), done: false, doneAt: null, status: 'scheduled', runStart: null, spent: 0, subtasks: (t.subtasks || []).map(s => ({ ...s, id: uuid(), done: false })) };
  const d = day(k);
  d.tasks.splice(d.tasks.indexOf(t) + 1, 0, c);
  save();
  return c;
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
  const i = d.tasks.findIndex(x => x.id === id);
  const t = d.tasks[i];
  d.tasks = d.tasks.filter(x => x.id !== id);
  save();
  return t ? { t, i } : null;
}

export function restoreTask(k, r) {
  if (!r?.t) return;
  const d = day(k);
  d.tasks.splice(Math.min(r.i ?? d.tasks.length, d.tasks.length), 0, r.t);
  save();
}

export function toggleSub(k, id, sid) {
  const t = findTask(k, id);
  const s = t?.subtasks?.find(x => x.id === sid);
  if (!s) return;
  s.done = !s.done;
  save();
  return t;
}

// ---------- templates and recurring rules ----------

export function saveTemplate(name, k, schedule = []) {
  const tasks = day(k).tasks.map(({ text, area, minutes, startTime, endTime, priority }) => ({ text, area, minutes, startTime: startTime || '', endTime: endTime || '', priority: priority || 0 }));
  name = (name || '').trim();
  if (!name || !tasks.length) return false;
  state.templates.push({ id: uuid(), name, tasks, schedule: schedule.map(Number) });
  save();
  return true;
}

export function deleteTemplate(id) { state.templates = state.templates.filter(t => t.id !== id); save(); }

function pushTemplateTasks(tpl, k) {
  for (const t of tpl.tasks) {
    day(k).tasks.push(migrateTask({ id: uuid(), text: t.text, area: t.area, minutes: t.minutes || 0, startTime: t.startTime || '', endTime: t.endTime || '', spent: 0, done: false, doneAt: null, status: 'scheduled', runStart: null, priority: t.priority || 0 }));
  }
  sortDay(k);
  return tpl.tasks.length;
}

export function applyTemplate(id, k) {
  const tpl = state.templates.find(x => x.id === id);
  if (!tpl) return 0;
  const n = pushTemplateTasks(tpl, k);
  save();
  return n;
}

export function addRule(r) {
  const rule = { id: uuid(), text: String(r.text || '').trim(), area: r.area || state.areas[0], minutes: Number(r.minutes) || 0, startTime: r.startTime || '', endTime: r.endTime || '', priority: Number(r.priority) || 0, days: (r.days || []).map(Number), since: todayKey() };
  if (!rule.text || !rule.days.length) return null;
  state.rules.push(rule);
  save();
  return rule;
}
export function deleteRule(id) { state.rules = state.rules.filter(r => r.id !== id); save(); }

// Puts scheduled templates and recurring tasks on a day once.
export function applyScheduled(k) {
  const weekday = new Date(k + 'T12:00').getDay();
  const doneT = state.appliedTpl[k] || [];
  const doneR = state.appliedRules[k] || [];
  let added = 0;
  for (const tpl of state.templates) {
    if (!tpl.schedule?.includes(weekday) || doneT.includes(tpl.id)) continue;
    added += pushTemplateTasks(tpl, k);
    doneT.push(tpl.id);
  }
  for (const r of state.rules) {
    if (!r.days.includes(weekday) || doneR.includes(r.id) || (r.since && k < r.since)) continue;
    day(k).tasks.push(migrateTask({ id: uuid(), text: r.text, area: r.area, minutes: r.minutes, startTime: r.startTime, endTime: r.endTime, spent: 0, done: false, doneAt: null, status: 'scheduled', runStart: null, priority: r.priority, ruleId: r.id }));
    doneR.push(r.id);
    added++;
  }
  if (added) {
    sortDay(k);
    state.appliedTpl[k] = doneT;
    state.appliedRules[k] = doneR;
    // Keep the bookkeeping small.
    const cut = addDays(todayKey(), -45);
    for (const m of [state.appliedTpl, state.appliedRules]) for (const key of Object.keys(m)) if (key < cut) delete m[key];
    save();
  }
  return added;
}

// ---------- categories and goals ----------

export function setGoal(area, mins) { state.goals[area] = Math.max(0, Number(mins) || 0); save(); }
export function setReminder(hhmm) { state.settings.reminder = hhmm || ''; save(); }
export function markReminded(k) { state.lastReminder = k; save(); }

export function renameArea(oldN, newN) {
  newN = (newN || '').trim();
  const i = state.areas.indexOf(oldN);
  if (i < 0 || !newN || newN === oldN || state.areas.includes(newN)) return false;
  state.areas[i] = newN;
  for (const d of Object.values(state.days)) for (const t of d.tasks) if (t.area === oldN) t.area = newN;
  for (const r of state.rules) if (r.area === oldN) r.area = newN;
  for (const g of state.longGoals) if (g.area === oldN) g.area = newN;
  if (state.lastArea === oldN) state.lastArea = newN;
  if (state.goals[oldN] !== undefined) { state.goals[newN] = state.goals[oldN]; delete state.goals[oldN]; }
  if (state.areaColors[oldN]) { state.areaColors[newN] = state.areaColors[oldN]; delete state.areaColors[oldN]; }
  save();
  return true;
}

export function addArea(n) {
  n = (n || '').trim();
  if (!n || state.areas.includes(n) || state.areas.length >= 12) return false;
  state.areas.push(n);
  save();
  return true;
}

export function removeArea(n) {
  if (state.areas.length <= 1) return false;
  state.areas = state.areas.filter(a => a !== n);
  if (state.lastArea === n) state.lastArea = state.areas[0];
  delete state.goals[n];
  delete state.areaColors[n];
  save();
  return true;
}

export function setAreaColor(a, c) { state.areaColors[a] = c; save(); }

// ---------- habits ----------

export function addHabit(h) {
  const name = String(h.name || '').trim();
  if (!name) return null;
  const habit = { id: uuid(), name, icon: h.icon || '✨', color: h.color || PALETTE[state.habits.length % PALETTE.length], days: (h.days?.length ? h.days : [0, 1, 2, 3, 4, 5, 6]).map(Number), createdAt: todayKey(), archived: false };
  state.habits.push(habit);
  save();
  return habit;
}
export function updateHabit(id, patch) { const h = state.habits.find(x => x.id === id); if (h) { Object.assign(h, patch); save(); } return h; }
export function deleteHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  for (const k of Object.keys(state.habitLog)) state.habitLog[k] = state.habitLog[k].filter(x => x !== id);
  save();
}
export const habitDone = (k, id) => (state.habitLog[k] || []).includes(id);
export function toggleHabit(k, id) {
  const list = state.habitLog[k] ||= [];
  const on = !list.includes(id);
  state.habitLog[k] = on ? [...list, id] : list.filter(x => x !== id);
  if (!state.habitLog[k].length) delete state.habitLog[k];
  save();
  return on;
}

// ---------- mood, wellness, journal ----------

export function setMood(k, patch) { state.moods[k] = { ...(state.moods[k] || {}), ...patch, at: new Date().toISOString() }; save(); }
export function setWellness(k, patch) { state.wellness[k] = { ...(state.wellness[k] || {}), ...patch }; save(); }
export function setDayField(k, field, value) { day(k)[field] = value; save(); }
export function setGratitude(k, i, value) { const d = day(k); d.gratitude = [...(d.gratitude || ['', '', ''])]; d.gratitude[i] = value; save(); }

// ---------- focus sessions ----------

export function logFocus(entry) {
  state.focusLog = [{ id: uuid(), at: new Date().toISOString(), ...entry }, ...state.focusLog].slice(0, 1000);
  save();
}

// ---------- long-term goals ----------

export function addLongGoal(g) {
  const title = String(g.title || '').trim();
  if (!title) return null;
  const goal = { id: uuid(), title, why: g.why || '', due: g.due || '', area: g.area || '', milestones: [], createdAt: todayKey(), doneAt: null };
  state.longGoals.push(goal);
  save();
  return goal;
}
export function updateLongGoal(id, patch) { const g = state.longGoals.find(x => x.id === id); if (g) { Object.assign(g, patch); save(); } return g; }
export function deleteLongGoal(id) { state.longGoals = state.longGoals.filter(g => g.id !== id); save(); }
export function addMilestone(id, text) {
  const g = state.longGoals.find(x => x.id === id);
  text = String(text || '').trim();
  if (!g || !text) return;
  g.milestones.push({ id: uuid(), text, done: false });
  save();
}
export function toggleMilestone(id, mid) {
  const g = state.longGoals.find(x => x.id === id);
  const m = g?.milestones.find(x => x.id === mid);
  if (!m) return;
  m.done = !m.done;
  g.doneAt = g.milestones.length && g.milestones.every(x => x.done) ? (g.doneAt || new Date().toISOString()) : null;
  save();
  return g;
}
export function removeMilestone(id, mid) { const g = state.longGoals.find(x => x.id === id); if (g) { g.milestones = g.milestones.filter(m => m.id !== mid); save(); } }

export function unlockBadge(id) { if (state.badges[id]) return false; state.badges[id] = new Date().toISOString(); save(); return true; }

// ---------- export ----------

export const exportJSON = () => { collectMeta(); return JSON.stringify({ app: 'Better Me', version: VERSION, exportedAt: new Date().toISOString(), ...state }, null, 2); };

const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function exportCSV() {
  const rows = [['date', 'task', 'area', 'priority', 'start', 'end', 'minutes', 'spent', 'status', 'done', 'completed_at', 'subtasks', 'notes']];
  for (const k of Object.keys(state.days).sort()) {
    for (const t of state.days[k].tasks) {
      rows.push([k, t.text, t.area, t.priority || '', t.startTime || '', t.endTime || '', t.minutes, Math.round(t.spent || 0), t.status, t.done, t.doneAt || '', (t.subtasks || []).map(s => (s.done ? '[x] ' : '[ ] ') + s.text).join(' | '), t.notes || ''].map(csvCell));
    }
  }
  return rows.map(r => r.join(',')).join('\r\n');
}

export function exportICS(from, to) {
  const z = n => String(n).padStart(2, '0');
  const stamp = d => `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}00Z`;
  const esc = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Better Me//EN', 'CALSCALE:GREGORIAN'];
  for (const k of Object.keys(state.days).sort()) {
    if (k < from || k > to) continue;
    for (const t of state.days[k].tasks) {
      if (!t.startTime) continue;
      const s = new Date(`${k}T${t.startTime}:00`);
      const e = new Date(s.getTime() + budgetMs(t, k));
      lines.push('BEGIN:VEVENT', `UID:${t.id}@better-me`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(s)}`, `DTEND:${stamp(e)}`, `SUMMARY:${esc(t.text)}`, `CATEGORIES:${esc(t.area)}`, `DESCRIPTION:${esc(`${t.area} · ${t.status}${t.notes ? '\n' + t.notes : ''}`)}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ---------- task lifecycle ----------
// scheduled → running (at its start time) → waiting_review (minutes used up) → done | missed.
// Everything is computed from timestamps, so a device that was asleep catches up when it opens.

export function tickTasks(now = Date.now()) {
  const started = [], ended = [];
  for (const [k, d] of Object.entries(state.days)) {
    for (const t of d.tasks) {
      if (t.status === 'scheduled' && HHMM.test(t.startTime || '')) {
        const at = instantOf(k, t.startTime);
        if (now >= at) {
          t.status = 'running'; t.runStart = at;
          started.push({ k, t });
        }
      }
      if (t.status === 'running' && t.runStart != null && elapsedMs(t, now) >= budgetMs(t, k)) {
        t.spent = budgetMs(t, k) / 60000;
        t.runStart = null;
        t.status = 'waiting_review';
        ended.push({ k, t });
      }
    }
  }
  if (started.length || ended.length) save();
  return { started: started.filter(x => x.t.status === 'running'), ended };
}

export function startFocus(k, id, now = Date.now()) {
  const t = findTask(k, id);
  if (!t) return false;
  if (t.status === 'waiting_review' || t.status === 'missed') { t.status = 'running'; t.runStart = now; t.spent = Math.min(t.spent || 0, Math.max(0, budgetMs(t, k) / 60000 - 1)); save(); return true; }
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

export function extendTask(k, id, mins) {
  const t = findTask(k, id);
  if (!t) return;
  const used = elapsedMs(t) / 60000;
  t.minutes = Math.max(Math.ceil(used), (t.minutes || budgetMs(t, k) / 60000)) + mins;
  if (t.status === 'waiting_review') { t.status = 'running'; t.runStart = Date.now(); }
  save();
}

export function toggleTask(k, id) {
  const t = findTask(k, id);
  if (!t) return false;
  if (t.status === 'running' && t.runStart != null) t.spent = elapsedMs(t) / 60000;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  t.status = t.done ? 'done' : (t.startTime && instantOf(k, t.startTime) <= Date.now() ? 'waiting_review' : 'scheduled');
  t.runStart = null;
  if (t.done && t.subtasks?.length) t.subtasks.forEach(s => { s.done = true; });
  save();
  return t.done;
}

export function reviewTask(k, id, outcome) {
  const d = day(k), t = d.tasks.find(x => x.id === id);
  if (!t) return false;
  if (outcome === 'done') { t.status = 'done'; t.done = true; t.doneAt = new Date().toISOString(); t.runStart = null; }
  else if (outcome === 'notdone') { t.status = 'missed'; t.done = false; t.doneAt = null; t.runStart = null; }
  else if (outcome === 'tomorrow') {
    d.tasks = d.tasks.filter(x => x.id !== id);
    day(nextKey(k)).tasks.push({ ...t, status: 'scheduled', runStart: null, spent: 0, done: false, doneAt: null, rolledFrom: k });
    sortDay(nextKey(k));
  }
  save();
  return true;
}

export function moveOpen(fromKey, toKey) {
  const from = day(fromKey), to = day(toKey);
  const open = from.tasks.filter(t => !t.done && t.status !== 'missed');
  from.tasks = from.tasks.filter(t => t.done || t.status === 'missed');
  for (const t of open) to.tasks.push({ ...t, status: 'scheduled', runStart: null, spent: 0, rolledFrom: fromKey });
  sortDay(toKey);
  save();
  return open.length;
}

// ---------- app usage (how the app itself is used) ----------
export function trackOpen() {
  const u = state.usage, k = todayKey();
  u.first ||= k;
  u.opens[k] = (u.opens[k] || 0) + 1;
  save();
}
export function trackMinute() {
  const u = state.usage, k = todayKey();
  u.minutes[k] = (u.minutes[k] || 0) + 1;
  persistLocal();
}
export function trackView(v) { const u = state.usage; u.views[v] = (u.views[v] || 0) + 1; }
export function trackAction(a) { const u = state.usage; u.actions[a] = (u.actions[a] || 0) + 1; }
