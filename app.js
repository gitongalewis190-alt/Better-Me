import { VERSION, load, save, getState, getAreas, day, todayKey, addTask, saveProfile, logPrint, toggleTask, tickTasks, reviewTask, startFocus, pauseFocus, remainingMs, findTask, moveTask, removeTask, restoreTask, moveOpen, renameArea, addArea, removeArea, setLastArea, setOnboarded, saveTemplate, deleteTemplate, applyTemplate, applyScheduled, setGoal, setReminder, markReminded, reloadRemote, bytes, onSync, exportJSON, exportCSV } from './src/store.js';
import { requireUser, signOut } from './src/auth.js';
import { dayPct, streak, areaStats, weekdayStats, advice, weekSummary, goalProgress } from './src/analytics.js';
import { promptFor } from './src/prompts.js';
import { play, sounds, haptics } from './src/sound.js';
import { momentumForecast, chronotype, capacity } from './src/algorithms.js';

const $ = s => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'
};
const svg = (name, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const PALETTE = ['#ff5a36', '#7c5cff', '#1fc57a', '#ffb020', '#23b5d3', '#f0527a', '#8a6d3b', '#3b82f6'];
const colorFor = n => PALETTE[Math.max(0, getAreas().indexOf(n)) % PALETTE.length];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = n => String(n).padStart(2, '0');

const app = $('#view');
const sh = $('#sheet');

let tab = 'home', q = '', calSel = todayKey(), calMonth = new Date(), area = getAreas()[0], ready = false;
let tm = null;   // open focus sheet: { k, id }
let pendingRender = false; // a render waiting until the person stops typing
let drag = null; // active drag-to-reorder
let swipe = null; // active swipe on a task row
let pull = null;  // active pull-to-refresh

const fmt = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const buzz = () => { if (haptics.on && navigator.vibrate) navigator.vibrate(10); };

function applyTheme() { document.documentElement.dataset.theme = getState().settings.theme; }

function avatar() {
  const p = getState().profile;
  $('#avatar').innerHTML = p.photo ? `<img src="${p.photo}" alt="">` : esc((p.name || 'B')[0].toUpperCase());
}

function ring(pct, size = 60) {
  const r = 22, c = 2 * Math.PI * r, v = pct ?? 0;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 56 56" role="img" aria-label="${pct == null ? 'No tasks' : v + ' percent complete'}"><circle cx="28" cy="28" r="${r}" class="track"/><circle cx="28" cy="28" r="${r}" class="fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/><text x="28" y="32" text-anchor="middle">${pct == null ? '–' : v + '%'}</text></svg>`;
}

const STATUS_LABEL = { scheduled: 'Scheduled', running: 'In progress', waiting_review: 'Waiting for review', done: 'Done', missed: 'Not done', pushed: 'Moved to tomorrow' };
const isPaused = t => t.status === 'running' && t.runStart == null;
const labelOf = t => (isPaused(t) ? 'Paused' : STATUS_LABEL[t.status] || 'Scheduled');
const fmtRemain = (t, k) => { const s = Math.ceil(remainingMs(t, k) / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)} left`; };

// One task row. Its action and status follow its lifecycle.
function taskRow(key, t) {
  const st = t.status || 'scheduled';
  const sched = t.startTime ? `${esc(t.startTime)}${t.endTime ? '–' + esc(t.endTime) : ''}` : 'No time set';
  const live = st === 'running' ? `<span class="live" data-live="${key}|${t.id}">${fmtRemain(t, key)}</span>` : '';
  const spent = t.spent ? `<span class="spent">${Math.round(t.spent)}m focused</span>` : '';
  let action = '';
  if (st === 'waiting_review') action = `<button class="pill" data-review-open="${key}|${t.id}">Review</button>`;
  else if (st === 'scheduled' || st === 'running') action = `<button class="x timer-btn" data-timer="${key}|${t.id}" aria-label="Open focus for ${esc(t.text)}">${svg('timer', 18)}</button>`;
  return `<div class="task st-${st}${t.done ? ' done' : ''}" data-key="${key}" data-id="${t.id}">
    <button class="grip" type="button" data-grip="${key}|${t.id}" aria-label="Drag to reorder ${esc(t.text)}">⋮⋮</button>
    <label class="check"><input type="checkbox" data-toggle="${key}|${t.id}" ${t.done ? 'checked' : ''} aria-label="Complete ${esc(t.text)}"><span class="box"></span><span class="tx">${esc(t.text)}</span></label>
    ${action}<button class="x" data-remove="${key}|${t.id}" aria-label="Remove ${esc(t.text)}">×</button>
    <div class="meta"><span class="time">${sched}</span><span class="stat">${labelOf(t)}</span>${live}${spent}<span class="tag" style="--c:${colorFor(t.area)}">${esc(t.area)}</span></div>
  </div>`;
}

function bars(rows, colored = true) {
  return rows.map(r => `<div class="bar-row"><span>${esc(r.name)}</span><div class="bar"><b style="width:${r.pct ?? 0}%;background:${colored ? colorFor(r.name) : 'var(--acc)'}"></b></div><span>${r.pct == null ? '–' : r.pct + '%'}</span></div>`).join('');
}

function chips() {
  return `<div class="chips" id="chips" role="group" aria-label="Category">${getAreas().map(a => `<button type="button" class="chip${a === area ? ' on' : ''}" data-area="${esc(a)}" style="--c:${colorFor(a)}" aria-pressed="${a === area}">${esc(a)}</button>`).join('')}</div>`;
}

function calendar(y, m) {
  const s = getState().days, lead = (new Date(y, m, 1).getDay() + 6) % 7, total = new Date(y, m + 1, 0).getDate(), t = todayKey();
  let h = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span aria-hidden="true">${x}</span>`).join('');
  for (let i = 0; i < lead; i++) h += '<span aria-hidden="true"></span>';
  for (let d = 1; d <= total; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    const p = dayPct(s[k]);
    const lvl = p == null ? 0 : p >= 100 ? 3 : p >= 50 ? 2 : 1;
    h += `<button class="cell l${lvl}${k === t ? ' today' : ''}${k === calSel ? ' sel' : ''}" data-cal="${k}" aria-label="${fmtLong(k)}${p == null ? '' : ', ' + p + ' percent'}">${d}</button>`;
  }
  return `<div class="cal">${h}</div>`;
}

function home() {
  const k = todayKey(), d = day(k), p = dayPct(d), prof = getState().profile;
  const open = d.tasks.filter(t => !t.done).length;
  const tomorrow = todayKey(new Date(Date.now() + 86400000));
  return `
  <header class="intro"><p class="kicker">${fmtLong(k)}</p><h1>${prof.name ? `Hi, ${esc(prof.name)}` : 'Today'}</h1></header>
  <form id="quickForm" class="quick">${svg('plus', 20)}<input name="text" id="quick" placeholder="Add a task" autocomplete="off" aria-label="Add a task">
    <select name="area" class="qsel" aria-label="Category">${getAreas().map(a => `<option ${a === getState().lastArea ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></form>
  <section class="card">
    <div class="row-between"><div><p class="kicker">Today</p><h2>${d.tasks.length ? `${d.tasks.length - open} of ${d.tasks.length} done` : 'Nothing planned'}</h2></div>${ring(p)}</div>
    <p class="hint">Swipe right to complete, left to delete. Drag ⋮⋮ to reorder.</p>
    <div class="list" id="tasklist">${d.tasks.map(t => taskRow(k, t)).join('')}</div>
  </section>
  <section class="card"><p class="kicker">Reflection</p><p class="prompt">${esc(promptFor(k))}</p><textarea id="reflect" rows="3" placeholder="Write it honestly" aria-label="Reflection">${esc(d.reflection)}</textarea></section>
  <div class="row-wrap">
    ${open && p < 100 ? `<button class="pill" data-rollover="${k}" data-to="${tomorrow}">Move ${open} open to tomorrow</button>` : ''}
    ${d.tasks.length ? `<button class="pill" data-save-tpl>Save as template</button>` : ''}
  </div>`;
}

function newView() {
  const tpls = getState().templates;
  return `<header class="intro"><p class="kicker">Planning for ${fmtLong(todayKey())}</p><h1>New task</h1></header>
  ${tpls.length ? `<div class="tpl-row" role="group" aria-label="Templates">${tpls.map(t => `<button class="chip tpl" data-use-tpl="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}
  <form id="planForm" class="card stack">${planFields('')}</form>`;
}

// The same fields for the New tab, the quick-add shortcut sheet, and the template flow.
function planFields(text) {
  return `<label class="sr-only" for="planText">Task</label>
    <input id="planText" name="text" class="big-input" placeholder="What will you do?" autocomplete="off" value="${esc(text)}">
    <p class="kicker" style="margin:4px 0 0">Category</p>
    ${chips()}
    <div class="two">
      <label>Starts at<input name="start" type="time"></label>
      <label>Finish by<input name="end" type="time"></label>
    </div>
    <label>Minutes to spend<input name="minutes" type="number" min="1" inputmode="numeric" placeholder="30" value="30"></label>
    <p class="mut">The timer starts at the start time on its own. If you are away when it ends, the task waits for your review.</p>
    <div class="field-row">
      <button class="primary" type="submit" name="mode" value="plan">Plan task</button>
      <button class="ghost" type="submit" name="mode" value="now">Start now</button>
    </div>`;
}

function planSheet(text) {
  return `<form id="planForm" class="sheet-card"><div class="row-between"><h2>Plan a task</h2><button type="button" class="ghost" data-close>Cancel</button></div>${planFields(text)}</form>`;
}

function progress() {
  const s = getState(), cells = [];
  for (let i = 34; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const p = dayPct(s.days[todayKey(dt)]);
    cells.push(`<i class="hc" title="${todayKey(dt)}" style="--a:${p == null ? 0.1 : Math.max(0.25, p / 100)}"></i>`);
  }
  const f = momentumForecast(), c = chronotype();
  const w = weekSummary();
  const goals = goalProgress();
  const days = Object.values(s.days).filter(d => d.tasks.length).length;
  const caps = getAreas().slice(0, 3).map(a => `<div class="cap"><span style="--c:${colorFor(a)}"></span><p>${esc(capacity(a).note)}</p></div>`).join('');
  return `<header class="intro"><p class="kicker">Progress</p><h1>${streak()} day streak</h1></header>
  <section class="card"><p class="kicker">This week</p>
    <div class="review"><div><b>${w.done}</b><span>done</span></div><div><b>${w.pct == null ? '–' : w.pct + '%'}</b><span>completion</span></div><div><b>${w.streak}</b><span>streak</span></div></div>
    <p class="mut">${w.best ? `Strongest area: ${esc(w.best)}.` : 'Log a few tasks to see your strongest area.'}</p></section>
  <section class="card"><div class="heat" role="img" aria-label="Last 35 days of completion">${cells.join('')}</div><p class="mut">Last 35 days</p></section>
  <section class="card"><p class="kicker">Weekly goals</p>${goals.length ? goals.map(g => `<div class="bar-row"><span>${esc(g.name)}</span><div class="bar"><b style="width:${g.pct}%;background:${colorFor(g.name)}"></b></div><span>${g.done}/${g.goal}m</span></div>`).join('') : '<p class="mut">Set weekly minute goals per category in Settings.</p>'}</section>
  <section class="card"><p class="kicker">Forecast</p>${f.pct == null ? `<p>${esc(f.note)}</p>` : `<p class="big">${f.pct}%</p><p class="mut">${esc(f.note)}${days < 10 ? ' Early estimate, it sharpens as you log more days.' : ''}</p>`}</section>
  <section class="card"><p class="kicker">Rhythm</p><p>${esc(c.note)}</p></section>
  <section class="card"><p class="kicker">Capacity</p>${caps}</section>
  <section class="card"><p class="kicker">By area</p>${bars(areaStats())}</section>
  <section class="card"><p class="kicker">Weekdays</p>${bars(weekdayStats(), false)}</section>
  <section class="card"><p class="kicker">Advice</p>${advice().map(a => `<p style="margin:8px 0">${esc(a)}</p>`).join('')}</section>`;
}

function dayDetail(k) {
  const d = getState().days[k];
  const list = d ? d.tasks : [];
  return `<div class="row-between"><div><p class="kicker">Selected</p><h2>${fmt(k)}</h2></div>${d && list.length ? ring(dayPct(d), 52) : ''}</div>
    <div class="list">${list.length ? list.map(t => taskRow(k, t)).join('') : `<p class="empty">Nothing planned for this day.</p><button class="pill" data-plan="${k}">Plan this day</button>`}</div>`;
}

function history() {
  const label = calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `<header class="intro"><p class="kicker">History</p><h1>Your record</h1></header>
  <section class="card">
    <div class="mhead"><button class="nav" data-month="-1" aria-label="Previous month">‹</button><span aria-live="polite">${label}</span><button class="nav" data-month="1" aria-label="Next month">›</button></div>
    ${calendar(calMonth.getFullYear(), calMonth.getMonth())}
  </section>
  <section class="card">${dayDetail(calSel)}</section>`;
}

function profileView() {
  const p = getState().profile;
  return `<header class="intro"><p class="kicker">Profile</p><h1>You</h1></header>
  <form id="profileForm" class="card stack">
    <label>Name<input name="name" type="text" value="${esc(p.name)}" autocomplete="name"></label>
    <label>Age<input name="age" inputmode="numeric" type="text" value="${esc(p.age)}"></label>
    <label>Phone<input name="phone" type="tel" value="${esc(p.phone)}" autocomplete="tel"></label>
    <label>Bio<textarea name="bio" rows="3">${esc(p.bio)}</textarea></label>
    <label>Photo<input name="photo" type="file" accept="image/*"></label>
    <button class="primary" type="submit">Save profile</button>
  </form>`;
}

const views = { home, progress, new: newView, history, profile: profileView };

function skeleton() { return `<div class="skel" aria-hidden="true"></div><div class="skel short" aria-hidden="true"></div><div class="skel" aria-hidden="true"></div>`; }

function render() {
  applyTheme();
  avatar();
  document.querySelectorAll('[data-tab]').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  app.innerHTML = ready ? views[tab]() : skeleton();
  window.scrollTo({ top: 0 });
  $('#chips .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// One place that opens or closes every sheet. Closing logs any focus time already spent.
function sheet(html) {
  if (!html) tm = null;
  sh.innerHTML = html;
  sh.classList.toggle('open', !!html);
  if (html) {
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-modal', 'true');
    setTimeout(() => sh.querySelector('input:not([type=hidden]), select, button')?.focus(), 60);
  } else {
    sh.removeAttribute('role');
    sh.removeAttribute('aria-modal');
  }
}

function toast(msg, undo) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); el.remove(); render(); };
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function go(t) { tab = t; sheet(''); render(); }

// Focus sheet. It reads the task's own clock, so it survives reloads and sleep.
function timerSheet(k, id) {
  const t = findTask(k, id);
  if (!t) return;
  tm = { k, id };
  sheet(timerHtml(k, t));
}

function timerHtml(k, t) {
  const running = t.status === 'running' && !isPaused(t);
  const actionable = t.status === 'scheduled' || t.status === 'running';
  return `<div class="sheet-card timer" role="document"><p class="kicker">Focus · ${labelOf(t)}</p><h2>${esc(t.text)}</h2>
    <div class="clock" id="clock" aria-live="off">${fmtRemain(t, k).replace(' left', '')}</div>
    <p class="mut">${running ? 'Counting down. Closing this sheet keeps the timer running.' : 'Pausing keeps the time you have used.'}</p>
    <div class="field-row">${actionable ? `<button class="primary" data-timer-toggle>${running ? 'Pause' : 'Start'}</button>` : ''}<button class="ghost" data-review-open="${k}|${t.id}">Review</button></div></div>`;
}

function findOpenTask() { return tm ? findTask(tm.k, tm.id) : null; }

function toggleFocus() {
  if (!tm) return;
  const t = findOpenTask();
  if (!t) return;
  if (t.status === 'running' && !isPaused(t)) pauseFocus(tm.k, tm.id);
  else startFocus(tm.k, tm.id);
  sheet(timerHtml(tm.k, findOpenTask()));
  tm = { k: tm.k, id: tm.id };
  render();
}

function reviewSheet(k, id) {
  const t = findTask(k, id);
  if (!t) return;
  sheet(`<div class="sheet-card" role="document"><p class="kicker">Review</p><h2>${esc(t.text)}</h2>
    <p class="mut">Did you finish it?</p>
    <div class="field-row"><button class="primary" data-review="done|${k}|${id}">Done</button><button class="ghost" data-review="notdone|${k}|${id}">Not done</button></div>
    <button class="pill" data-review="tomorrow|${k}|${id}">Not done, move to tomorrow</button></div>`);
}

function doReview(outcome, k, id) {
  reviewTask(k, id, outcome);
  sheet('');
  play(outcome === 'done' ? 'complete' : 'cancel');
  toast(outcome === 'done' ? 'Marked done' : outcome === 'tomorrow' ? 'Moved to tomorrow' : 'Marked not done');
  render();
}

// Updates countdowns in place, so typing and scrolling are never interrupted.
function updateLive() {
  document.querySelectorAll('[data-live]').forEach(el => {
    const [k, id] = el.dataset.live.split('|');
    const t = findTask(k, id);
    if (t) el.textContent = fmtRemain(t, k);
  });
  const c = document.getElementById('clock'), t = findOpenTask();
  if (c && t && sh.classList.contains('open')) c.textContent = fmtRemain(t, tm.k).replace(' left', '');
}

const busy = () => sh.classList.contains('open') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

// Runs every few seconds. Status changes re-render the list only when it is safe to.
function liveTick() {
  if (tickTasks()) pendingRender = true;
  if (pendingRender && !busy()) { pendingRender = false; render(); }
  updateLive();
}

function tplSheet() {
  return `<form id="tplForm" class="sheet-card"><div class="row-between"><h2>Save as template</h2><button type="button" class="ghost" data-close>Cancel</button></div>
    <p class="mut">Saves today's tasks. Choose days to repeat it every week.</p>
    <label class="sr-only" for="tplName">Template name</label>
    <input id="tplName" name="name" class="big-input" placeholder="Template name, e.g. Revision day" required autocomplete="off">
    <p class="kicker">Repeat on</p>
    <div class="days" role="group" aria-label="Repeat on">${WEEKDAYS.map((w, i) => `<label class="dayck"><input type="checkbox" name="day" value="${i}"><span>${w}</span></label>`).join('')}</div>
    <button class="primary" type="submit">Save template</button></form>`;
}

function onboardSheet() {
  return `<form id="obForm" class="sheet-card"><p class="kicker">Welcome</p><h2>Let's set you up</h2>
    <p class="mut">Your categories and goals can be changed any time in Settings.</p>
    <label>What should we call you?<input name="name" type="text" autocomplete="given-name" placeholder="Your name"></label>
    <button class="primary" type="submit">Start planning</button></form>`;
}

const COMMANDS = [
  { label: 'Go to Home', run: () => go('home') },
  { label: 'Go to Progress', run: () => go('progress') },
  { label: 'Log a new SOP', run: () => go('new') },
  { label: 'Open History', run: () => go('history') },
  { label: 'Open Profile', run: () => go('profile') },
  { label: 'Export JSON backup', run: () => download('better-me-backup.json', exportJSON(), 'application/json') },
  { label: 'Export CSV', run: () => download('better-me-tasks.csv', exportCSV(), 'text/csv') },
  { label: 'Print or save PDF', run: () => sheet(printSheet()) },
  { label: 'Open settings', run: () => sheet(settingsSheet()) }
];

function results() {
  const cmds = COMMANDS.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.label.toLowerCase().includes(q));
  const cmdHtml = cmds.length ? `<p class="kicker">Actions</p>${cmds.map(({ c, i }) => `<button class="cmd" data-cmd="${i}">${esc(c.label)}</button>`).join('')}` : '';
  if (!q) return cmdHtml || '<p class="empty">Type to search tasks and reflections.</p>';
  const s = getState(), out = [];
  for (const k of Object.keys(s.days).sort().reverse()) {
    const d = s.days[k];
    for (const t of d.tasks) if (t.text.toLowerCase().includes(q)) out.push(`<button class="hit" data-open="${k}"><span>${esc(t.text)}</span><small>${fmt(k)} · ${esc(t.area)}</small></button>`);
    if (d.reflection.toLowerCase().includes(q)) out.push(`<button class="hit" data-open="${k}"><span>Reflection</span><small>${fmt(k)}</small></button>`);
    if (out.length > 80) break;
  }
  return cmdHtml + (out.join('') || '<p class="empty">No matches.</p>');
}

function searchSheet() {
  return `<div class="sheet-card"><div class="row-between"><h2>Search</h2><button class="ghost" data-close>Done</button></div>
    <label class="sr-only" for="gsearch">Search or type a command</label>
    <input id="gsearch" class="big-input" placeholder="Search or type a command" value="${esc(q)}" autocomplete="off">
    <div id="sresults" class="list">${results()}</div></div>`;
}

let settingsSection = null;
const SETTINGS_ROWS = [
  ['appearance', 'Appearance', s => (s.settings.theme === 'dark' ? 'Dark' : 'Light')],
  ['categories', 'Categories', () => `${getAreas().length} areas`],
  ['goals', 'Weekly goals', () => `${Object.values(getState().goals).filter(Boolean).length} set`],
  ['templates', 'Templates', s => `${s.templates.length} saved`],
  ['reminders', 'Reminders', s => s.settings.reminder || 'Off'],
  ['app', 'Sounds and haptics', s => (s.settings.sound ? 'Sound on' : 'Sound off')],
  ['data', 'Data and backup', () => 'Export'],
  ['account', 'Account', () => 'Sign out']
];

function settingsSheet() {
  settingsSection = null;
  const s = getState();
  return `<div class="sheet-card" role="document"><div class="row-between"><h2>Settings</h2><button class="ghost" data-close>Done</button></div>
    <ul class="settings-list" role="list">${SETTINGS_ROWS.map(([id, label, value]) => `<li role="listitem"><button class="setting-row" data-settings-open="${id}"><span class="sl">${esc(label)}</span><span class="sv">${esc(String(value(s)))}</span><span class="chev" aria-hidden="true">›</span></button></li>`).join('')}</ul></div>`;
}

function settingsDetail(id) {
  settingsSection = id;
  const s = getState();
  const kb = (bytes() / 1024).toFixed(1);
  const pct = Math.min(100, bytes() / (500 * 1024 * 1024) * 100).toFixed(2);
  const areas = getAreas().map((a, i) => `<div class="area-edit"><label class="sr-only" for="area-${i}">Category name</label><input id="area-${i}" type="text" value="${esc(a)}" data-area-name="${esc(a)}"><button class="ghost" data-area-rm="${i}">Remove</button></div>`).join('');
  const goals = getAreas().map((a, i) => `<label class="goal"><span>${esc(a)}</span><input id="goal-${i}" type="number" min="0" inputmode="numeric" placeholder="min/week" value="${s.goals[a] || ''}" data-goal="${esc(a)}"></label>`).join('');
  const tpls = s.templates.length ? s.templates.map(t => `<div class="area-edit"><span class="tpl-name">${esc(t.name)} · ${t.tasks.length} tasks${t.schedule?.length ? ' · ' + t.schedule.map(i => WEEKDAYS[i]).join(', ') : ''}</span><button class="ghost" data-tpl-rm="${t.id}">Delete</button></div>`).join('') : '<p class="mut">No templates yet. Save a day from Home.</p>';
  const body = {
    appearance: `<h2>Appearance</h2><div class="seg" role="group" aria-label="Theme"><button data-theme-set="light" class="${s.settings.theme === 'light' ? 'on' : ''}" aria-pressed="${s.settings.theme === 'light'}">Light</button><button data-theme-set="dark" class="${s.settings.theme === 'dark' ? 'on' : ''}" aria-pressed="${s.settings.theme === 'dark'}">Dark</button></div>`,
    categories: `<h2>Categories</h2>${areas}<div class="field-row"><label class="sr-only" for="newArea">New category</label><input id="newArea" type="text" placeholder="New category"><button class="ghost" data-area-add>Add</button></div>`,
    goals: `<h2>Weekly goals</h2>${goals}`,
    templates: `<h2>Templates</h2>${tpls}`,
    reminders: `<h2>Reminders</h2><label class="switch"><span>Daily reminder time</span><input type="time" value="${s.settings.reminder}" data-reminder aria-label="Daily reminder time"></label><button class="ghost" data-notify>Allow notifications</button><p class="mut">Reminders arrive while Better Me is installed and the phone allows them. On iPhone, add the app to your Home Screen first.</p>`,
    app: `<h2>Sounds and haptics</h2><label class="switch"><span>Sounds</span><input type="checkbox" data-sound ${s.settings.sound ? 'checked' : ''}></label><label class="switch"><span>Haptics</span><input type="checkbox" data-haptics ${s.settings.haptics ? 'checked' : ''}></label>`,
    data: `<h2>Data and backup</h2><div class="field-row"><button class="ghost" data-export-json>Export JSON</button><button class="ghost" data-export-csv>Export CSV</button></div><p class="kicker">Storage</p><div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Storage used"><b style="width:${pct}%"></b></div><div class="row-between"><span style="font-weight:700">${kb} KB used</span><span class="mut">of 500 MB</span></div>`,
    account: `<h2>Account</h2><div class="row-between"><span style="font-weight:700">Version</span><span class="mut">${VERSION}</span></div><button class="pill danger" data-signout>Sign out</button>`
  }[id] || '';
  return `<div class="sheet-card" role="document"><div class="row-between"><button class="ghost" data-settings-back>‹ Settings</button><button class="ghost" data-close>Done</button></div>${body}</div>`;
}

function refreshSettings() { sheet(settingsSection ? settingsDetail(settingsSection) : settingsSheet()); }

function printSheet() {
  const keys = Object.keys(getState().days).sort();
  return `<form id="printForm" class="sheet-card"><div class="row-between"><h2>Print</h2><button type="button" class="ghost" data-close>Cancel</button></div>
    <label>Document<select name="doc"><option value="sops">SOP history</option><option value="progress">Progress report</option><option value="profile">Profile</option></select></label>
    <label>From<input type="date" name="from" value="${keys[0] || todayKey()}"></label>
    <label>To<input type="date" name="to" value="${todayKey()}"></label>
    <label>Orientation<select name="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    <label>Font<select name="font"><option value="system">System</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
    <label>Colour<select name="color"><option value="color">Colour</option><option value="bw">Black and white</option></select></label>
    <label class="switch"><span>Include reflections</span><input type="checkbox" name="reflect" checked></label>
    <button class="primary" type="submit">Open print preview</button>
    <p class="mut">In the print dialog, choose "Save as PDF".</p>
    <h3>Printed documents</h3>${(getState().printLog || []).length ? `<ul class="plain">${getState().printLog.slice(0, 20).map(l => `<li>${new Date(l.at).toLocaleString()} · ${esc({ sops: 'SOP history', progress: 'Progress report', profile: 'Profile' }[l.doc] || l.doc)} · ${esc(l.from)} to ${esc(l.to)}</li>`).join('')}</ul>` : '<p class="mut">Nothing printed yet.</p>'}</form>`;
}

function printDoc(f) {
  const s = getState(), p = s.profile;
  const from = f.get('from') || '0000-01-01', to = f.get('to') || '9999-12-31';
  const fam = { system: '-apple-system,Helvetica,Arial,sans-serif', serif: 'Georgia,serif', mono: 'ui-monospace,Menlo,monospace' }[f.get('font')] || 'sans-serif';
  const ink = f.get('color') === 'bw' ? '#000' : '#14141a';
  const type = f.get('doc');
  let body = '';
  if (type === 'profile') {
    body = `<h2>Profile</h2><p><b>${esc(p.name)}</b>${p.age ? `, age ${esc(p.age)}` : ''}<br>${esc(p.phone)}</p><p>${esc(p.bio)}</p>`;
  } else if (type === 'progress') {
    body = `<h2>Progress</h2><p>Current streak: ${streak()} days</p>` + areaStats().map(a => `<p>${esc(a.name)}: ${a.pct == null ? '–' : a.pct + '%'} (${a.n} tasks)</p>`).join('');
  } else {
    const keys = Object.keys(s.days).filter(k => k >= from && k <= to && s.days[k].tasks.length).sort();
    body = keys.map(k => `<h3>${fmt(k)} · ${dayPct(s.days[k])}%</h3><ul>${s.days[k].tasks.map(t => `<li>${t.done ? '☑' : '☐'} ${t.startTime ? esc(t.startTime) + ' ' : ''}${esc(t.text)} <small>${esc(t.area)}${t.spent ? ` · ${t.spent}m focused` : ''}</small></li>`).join('')}</ul>${f.get('reflect') && s.days[k].reflection ? `<p><i>${esc(s.days[k].reflection)}</i></p>` : ''}`).join('') || '<p>No entries in this range.</p>';
  }
  const w = window.open('', '_blank');
  if (!w) { toast('Pop-ups are blocked. Allow them, then try again.'); return; }
  logPrint({ doc: type, from, to, orientation: f.get('orientation') || 'portrait', font: f.get('font') || 'system', color: f.get('color') || 'color' });
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Better Me</title><style>@page{size:${f.get('orientation') === 'landscape' ? 'landscape' : 'portrait'};margin:18mm}body{font-family:${fam};color:${ink};font-size:11pt;line-height:1.5;margin:0}h1{font-size:20pt;margin:0}h2{font-size:14pt;margin-top:18pt}h3{font-size:11pt;margin:14pt 0 4pt}small{color:#666;margin-left:6pt}li{margin:2pt 0}</style></head><body><h1>Better Me</h1><p>${esc(p.name)} · ${from} to ${to}</p>${body}<script>onload=()=>setTimeout(print,200)<\/script></body></html>`);
  w.document.close();
}

async function shrink(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const r = Math.min(1, 256 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c.toDataURL('image/jpeg', 0.85);
}

// Reminders: checked every 30 seconds while the app is open, once per day.
function checkReminder() {
  const s = getState(), r = s.settings.reminder;
  if (!r || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(), hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, today = todayKey();
  if (hhmm === r && s.lastReminder !== today) {
    markReminded(today);
    notify('Plan the day and check off what you finished.');
  }
}

async function notify(body) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Better Me', { body, tag: 'daily', icon: 'icon-192.png', badge: 'icon-192.png' });
  } catch {
    new Notification('Better Me', { body });
  }
}

async function refreshData() {
  await reloadRemote();
  applyScheduled(todayKey());
  render();
}

document.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'sheet' || t.closest('[data-close]')) {
    if (sh.classList.contains('open')) { sheet(''); play('cancel'); }
    return;
  }
  if (t.closest('[data-signout]')) return signOut();
  if (t.closest('[data-timer-toggle]')) return toggleFocus();
  const tmBtn = t.closest('[data-timer]');
  if (tmBtn) { const [k, id] = tmBtn.dataset.timer.split('|'); timerSheet(k, id); return; }
  const rvOpen = t.closest('[data-review-open]');
  if (rvOpen) { const [k, id] = rvOpen.dataset.reviewOpen.split('|'); return reviewSheet(k, id); }
  const rv = t.closest('[data-review]');
  if (rv) { const [outcome, k, id] = rv.dataset.review.split('|'); return doReview(outcome, k, id); }
  const so = t.closest('[data-settings-open]');
  if (so) return sheet(settingsDetail(so.dataset.settingsOpen));
  if (t.closest('[data-settings-back]')) return sheet(settingsSheet());
  if (t.closest('[data-notify]')) {
    if (!('Notification' in window)) { toast('Notifications are not supported on this device.'); return; }
    Notification.requestPermission().then(p => toast(p === 'granted' ? 'Reminders are on' : 'Notifications are blocked in settings'));
    return;
  }
  if (t.closest('#search')) { q = ''; sheet(searchSheet()); return; }
  if (t.closest('#settings')) { sheet(settingsSheet()); return; }
  if (t.closest('#print')) { sheet(printSheet()); return; }
  if (t.closest('[data-save-tpl]')) { sheet(tplSheet()); return; }
  if (t.closest('[data-export-json]')) { download('better-me-backup.json', exportJSON(), 'application/json'); return; }
  if (t.closest('[data-export-csv]')) { download('better-me-tasks.csv', exportCSV(), 'text/csv'); return; }
  if (t.closest('[data-area-add]')) { if (addArea($('#newArea').value)) play('save'); refreshSettings(); return; }
  const rmA = t.closest('[data-area-rm]');
  if (rmA) { const n = getAreas()[Number(rmA.dataset.areaRm)]; if (removeArea(n)) play('cancel'); refreshSettings(); return; }
  const tplRm = t.closest('[data-tpl-rm]');
  if (tplRm) { deleteTemplate(tplRm.dataset.tplRm); refreshSettings(); return; }
  const useTpl = t.closest('[data-use-tpl]');
  if (useTpl) { const n = applyTemplate(useTpl.dataset.useTpl, todayKey()); play('save'); toast(`Added ${n} task${n === 1 ? '' : 's'} from template`); tab = 'home'; return render(); }
  const cmd = t.closest('[data-cmd]');
  if (cmd) { COMMANDS[Number(cmd.dataset.cmd)].run(); return; }

  const ch = t.closest('[data-area]');
  if (ch) {
    area = ch.dataset.area;
    document.querySelectorAll('.chip[data-area]').forEach(c => { c.classList.toggle('on', c === ch); c.setAttribute('aria-pressed', c === ch); });
    ch.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    return;
  }
  const tb = t.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; return render(); }
  const rm = t.closest('[data-remove]');
  if (rm) {
    const [k, id] = rm.dataset.remove.split('|');
    const removed = removeTask(k, id);
    play('cancel');
    toast('Task removed', () => restoreTask(k, removed));
    return render();
  }
  const mo = t.closest('[data-month]');
  if (mo) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(mo.dataset.month), 1); return render(); }
  const cal = t.closest('[data-cal]');
  if (cal) { calSel = cal.dataset.cal; return render(); }
  const op = t.closest('[data-open]');
  if (op) { calSel = op.dataset.open; tab = 'history'; sheet(''); return render(); }
  const pl = t.closest('[data-plan]');
  if (pl) { calSel = pl.dataset.plan; tab = 'new'; return render(); }
  const ro = t.closest('[data-rollover]');
  if (ro) { const n = moveOpen(ro.dataset.rollover, ro.dataset.to); play('save'); toast(`Moved ${n} task${n === 1 ? '' : 's'} to tomorrow`); return render(); }
  const th = t.closest('[data-theme-set]');
  if (th) {
    getState().settings.theme = th.dataset.themeSet;
    save(); applyTheme(); play('save');
    return refreshSettings();
  }
});

// Every form is handled here. Native submission would reload the page and drop the action.
document.addEventListener('submit', e => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement)) return;
  e.preventDefault();
  const fd = new FormData(f);
  const k = todayKey();

  if (f.id === 'quickForm') {
    const text = String(fd.get('text') || '').trim();
    if (!text) return;
    area = String(fd.get('area') || area);
    f.reset();
    sheet(planSheet(text));
    return;
  }
  if (f.id === 'planForm') {
    const text = String(fd.get('text') || '').trim();
    const startNow = e.submitter?.value === 'now';
    const start = String(fd.get('start') || '');
    const end = String(fd.get('end') || '');
    if (!text) { toast('Name the task first.'); return; }
    if (!startNow && !/^\d{2}:\d{2}$/.test(start)) { toast('Set the time it starts.'); return; }
    if (end && (startNow ? end <= new Date().toTimeString().slice(0, 5) : end <= start)) { toast('Finish time has to be after the start time.'); return; }
    const t = addTask(k, text, area, fd.get('minutes'), start, end, startNow);
    if (!t) return;
    play('save');
    tab = 'home';
    if (startNow) { toast('Started'); sheet(''); timerSheet(k, t.id); }
    else { toast('Planned'); sheet(''); render(); }
    return;
  }
  if (f.id === 'profileForm') {
    saveProfile(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
    play('save'); toast('Profile saved');
    return render();
  }
  if (f.id === 'tplForm') {
    const days = fd.getAll('day').map(Number);
    if (!saveTemplate(String(fd.get('name') || ''), k, days)) { toast('Add tasks to today first, then name the template.'); return; }
    play('save'); toast('Template saved');
    sheet('');
    return render();
  }
  if (f.id === 'obForm') {
    setOnboarded(String(fd.get('name') || ''));
    sheet(''); play('save');
    return render();
  }
  if (f.id === 'printForm') {
    printDoc(fd);
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.toggle) {
    const [k, id] = t.dataset.toggle.split('|');
    const done = toggleTask(k, id);
    play(done ? 'complete' : 'save');
    return render();
  }
  if ('sound' in t.dataset) { getState().settings.sound = t.checked; sounds.on = t.checked; save(); return; }
  if ('haptics' in t.dataset) { getState().settings.haptics = t.checked; haptics.on = t.checked; save(); return; }
  if ('reminder' in t.dataset) { setReminder(t.value); play('save'); return; }
  if (t.dataset.goal !== undefined) { setGoal(t.dataset.goal, t.value); play('save'); return; }
  if (t.dataset.areaName !== undefined) {
    const ok = renameArea(t.dataset.areaName, t.value.trim());
    if (!ok) toast('That name is taken or empty.');
    else play('save');
    refreshSettings();
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'reflect') { day(todayKey()).reflection = e.target.value; save(); return; }
  if (e.target.id === 'gsearch') {
    q = e.target.value.trim().toLowerCase();
    $('#sresults').innerHTML = results();
  }
});

document.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q = ''; sheet(searchSheet()); return; }
  if (e.key === '/' && !typing) { e.preventDefault(); q = ''; sheet(searchSheet()); return; }
  if (e.key === 'Escape' && sh.classList.contains('open')) { sheet(''); return; }
  if (!typing && ['1', '2', '3', '4', '5'].includes(e.key)) go(['home', 'progress', 'new', 'history', 'profile'][Number(e.key) - 1]);
});

// Swipe on a task row: right completes, left deletes (with undo).
document.addEventListener('touchstart', e => {
  const row = e.target.closest('.task[data-id]');
  if (!row || e.target.closest('[data-grip]') || drag || sh.classList.contains('open')) { swipe = null; return; }
  swipe = { row, x: e.touches[0].clientX, dx: 0 };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!swipe) return;
  swipe.dx = e.touches[0].clientX - swipe.x;
  swipe.row.style.transform = `translateX(${swipe.dx}px)`;
  swipe.row.classList.toggle('sw-done', swipe.dx > 40);
  swipe.row.classList.toggle('sw-del', swipe.dx < -40);
}, { passive: true });

document.addEventListener('touchend', () => {
  if (!swipe) return;
  const { row, dx } = swipe;
  swipe = null;
  row.style.transform = '';
  row.classList.remove('sw-done', 'sw-del');
  const k = row.dataset.key, id = row.dataset.id;
  if (dx > 90) { toggleTask(k, id); play('complete'); render(); }
  else if (dx < -90) {
    const removed = removeTask(k, id);
    play('cancel');
    toast('Task removed', () => restoreTask(k, removed));
    render();
  }
});

// Drag to reorder: press and hold the ⋮⋮ handle, then move up or down.
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-grip]');
  if (!g) return;
  const row = g.closest('.task');
  const [k, id] = g.dataset.grip.split('|');
  drag = { k, id, row, startY: e.clientY, moved: false };
  row.classList.add('lifting');
  g.setPointerCapture?.(e.pointerId);
});

document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = e.clientY - drag.startY;
  if (Math.abs(dy) > 6) drag.moved = true;
  drag.row.style.transform = `translateY(${dy}px)`;
});

function endDrag(e) {
  if (!drag) return;
  const { k, id, row, moved } = drag;
  drag = null;
  row.classList.remove('lifting');
  row.style.transform = '';
  if (!moved || !e) { render(); return; }
  const siblings = [...row.parentElement.querySelectorAll('.task')].filter(r => r !== row);
  const above = siblings.filter(r => {
    const b = r.getBoundingClientRect();
    return b.top + b.height / 2 < e.clientY;
  }).length;
  moveTask(k, id, above);
  buzz();
  render();
}

document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', () => endDrag(null));

// Pull to refresh: drag down from the top of the page and let go.
document.addEventListener('touchstart', e => {
  if (window.scrollY > 0 || swipe || drag || sh.classList.contains('open')) { pull = null; return; }
  pull = { y: e.touches[0].clientY, dy: 0 };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!pull) return;
  pull.dy = Math.max(0, e.touches[0].clientY - pull.y);
  const el = $('#ptr');
  el.style.transform = `translate(-50%, ${Math.min(pull.dy, 120) * 0.5 - 40}px)`;
  el.style.opacity = Math.min(1, pull.dy / 70);
}, { passive: true });

document.addEventListener('touchend', async () => {
  if (!pull) return;
  const go = pull.dy > 70;
  pull = null;
  const el = $('#ptr');
  el.style.transform = '';
  el.style.opacity = '';
  if (go) {
    el.classList.add('spin');
    buzz();
    await refreshData();
    el.classList.remove('spin');
    toast('Up to date');
  }
});

onSync(s => {
  const el = $('#sync');
  if (!el) return;
  el.dataset.s = s;
  el.title = { saving: 'Saving', saved: 'Saved', offline: 'Offline, changes kept on this phone', error: 'Sync failed, will retry' }[s] || '';
});

(async () => {
  $('#search').innerHTML = svg('search');
  $('#print').innerHTML = svg('print');
  $('#settings').innerHTML = svg('gear');
  document.querySelectorAll('[data-ic]').forEach(i => { i.innerHTML = svg(i.dataset.ic, 22); });
  render();
  const user = await requireUser();
  if (!user) return;
  await load(user.id);
  area = getState().lastArea;
  sounds.on = getState().settings.sound;
  haptics.on = getState().settings.haptics ?? true;
  applyScheduled(todayKey());
  ready = true;
  render();
  if (!getState().onboarded) sheet(onboardSheet());
  tickTasks();
  setInterval(liveTick, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) liveTick(); });
  setInterval(checkReminder, 30000);
  checkReminder();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });
})();
