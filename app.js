import * as S from './src/store.js';
import { getState, getAreas, day, todayKey, addDays, colorFor, VERSION, PALETTE } from './src/store.js';
import { requireUser, signOut, currentUser } from './src/auth.js';
import * as A from './src/analytics.js';
import { momentumForecast, chronotype, capacity, suggestSlot } from './src/algorithms.js';
import { promptFor } from './src/prompts.js';
import { play, sounds, haptics, ambient, ambientVolume, stopAmbient, ambientOn, AMBIENTS } from './src/sound.js';
import { ACCENTS, BGS, resolveMode, accentOf } from './src/theme.js';
import { ring, defs, bars, hbars, donut, line, heatmap, spark } from './src/charts.js';
import { parseQuick, describe } from './src/nlp.js';
import { buildReport, downloadPdf, SECTIONS } from './src/report.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOODS = ['', '😞', '😕', '😐', '🙂', '😄'];
const MOOD_NAMES = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];
const PRI = ['None', 'Low', 'Medium', 'High'];
const STATUS_LABEL = { scheduled: 'Scheduled', running: 'In progress', waiting_review: 'Needs review', done: 'Done', missed: 'Not done', pushed: 'Moved' };
const EMOJI = ['✨', '💧', '📚', '🏃', '🧘', '🥗', '😴', '✍️', '🙏', '💪', '🎯', '🧠', '🎸', '🌿', '☀️', '📵', '💰', '🧹'];

// ---------- icons ----------
const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-6 6-6 9-1-1-2-2-2-4-2 2-1 5-1 7 0 4 3 7 7 7z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>',
  cloud: '<path d="M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 15h10"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M7.5 8a2.5 2.5 0 1 1 4.5-1.5L12 8M16.5 8A2.5 2.5 0 1 0 12 6.5"/>',
  drop: '<path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z"/>',
  bed: '<path d="M2 20V8M2 16h20v4M22 16v-4a3 3 0 0 0-3-3h-8v7"/><circle cx="7" cy="12" r="2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1.2" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1.2" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2c0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3a2 2 0 0 1 2-2H17a5 5 0 0 0 5-5c0-4.4-4.5-8.4-10-8.4z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01"/>'
};
const ic = (n, s = 20, cls = '') => `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

// ---------- navigation ----------
const NAV = [
  ['today', 'Today', 'home'], ['plan', 'Plan', 'calendar'], ['focus', 'Focus', 'timer'], ['habits', 'Habits', 'repeat'],
  ['insights', 'Insights', 'chart'], ['journal', 'Journal', 'book'], ['goals', 'Goals', 'target'], ['history', 'History', 'clock'], ['profile', 'You', 'user']
];

const app = $('#view'), sh = $('#sheet');
let view = 'today', ready = false, user = null;
let planDay = todayKey(), planMode = 'timeline', calMonth = new Date(), calSel = todayKey(), journalDay = todayKey();
let taskFilter = 'all', insightRange = 30, q = '', cmdIndex = 0;
let tm = null, pendingRender = false, drag = null, swipe = null, pull = null;
let settingsSection = null, lastLevel = 0, installEvt = null;
let reportOpt = null, reportTimer = null;

const fmtTime = hhmm => {
  if (!hhmm) return '';
  if (!getState().settings.hour12) return hhmm;
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return `${h}${m ? ':' + pad(m) : ''}${ap}`;
};
const fmt = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const relDay = k => { const t = todayKey(); return k === t ? 'Today' : k === addDays(t, 1) ? 'Tomorrow' : k === addDays(t, -1) ? 'Yesterday' : fmt(k); };
const hm = m => (m >= 60 ? `${Math.floor(m / 60)}h${Math.round(m % 60) ? ' ' + Math.round(m % 60) + 'm' : ''}` : `${Math.round(m)}m`);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${s >= 3600 ? Math.floor(s / 3600) + ':' : ''}${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const motionOK = () => getState().settings.motion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = () => { if (haptics.on && navigator.vibrate) try { navigator.vibrate(8); } catch { /* */ } };
const track = a => { S.trackAction(a); };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
}

// ---------- theme ----------
function applyTheme() {
  const st = getState().settings, root = document.documentElement;
  const mode = resolveMode(st.theme);
  const { a, b } = accentOf(st.accent, mode);
  root.dataset.theme = mode;
  root.dataset.bg = st.bg;
  root.dataset.density = st.density;
  root.dataset.contrast = st.contrast ? 'high' : '';
  root.dataset.motion = motionOK() ? 'full' : 'reduced';
  root.style.setProperty('--acc', a);
  root.style.setProperty('--acc2', b);
  root.style.setProperty('--fs', st.fontScale || 1);
  const meta = $('meta[name=theme-color]');
  if (meta) meta.content = mode === 'dark' ? '#0b0b10' : '#f5f4f0';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => ready && applyTheme());

// ---------- shared pieces ----------
const isPaused = t => t.status === 'running' && t.runStart == null;
const labelOf = t => (isPaused(t) ? 'Paused' : STATUS_LABEL[t.status] || 'Scheduled');
const fmtRemain = (t, k) => mmss(S.remainingMs(t, k));

function taskRow(k, t, opts = {}) {
  const st = t.status || 'scheduled';
  const time = t.startTime ? `${fmtTime(t.startTime)}${t.endTime ? '–' + fmtTime(t.endTime) : ''}` : 'Anytime';
  const subs = t.subtasks?.length ? `<span class="m-sub">${ic('list', 13)} ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>` : '';
  const live = st === 'running' && !isPaused(t) ? `<span class="m-live" data-live="${k}|${t.id}">${fmtRemain(t, k)}</span>` : '';
  let action = '';
  if (st === 'waiting_review') action = `<button class="pill pill-acc" data-act="review" data-ref="${k}|${t.id}">Review</button>`;
  else if (st === 'scheduled' || st === 'running') action = `<button class="ibtn" data-act="timer" data-ref="${k}|${t.id}" data-tip="${st === 'running' && !isPaused(t) ? 'Pause or check timer' : 'Start the timer'}" aria-label="Timer for ${esc(t.text)}">${ic(st === 'running' && !isPaused(t) ? 'pause' : 'play', 16)}</button>`;
  return `<div class="task st-${st}${t.done ? ' done' : ''}${t.priority ? ' p' + t.priority : ''}" data-key="${k}" data-id="${t.id}" style="--c:${colorFor(t.area)}">
    ${opts.noGrip ? '' : `<button class="grip" data-grip="${k}|${t.id}" aria-label="Drag to reorder" data-tip="Drag to reorder">${ic('grip', 16)}</button>`}
    <button class="check${t.done ? ' on' : ''}" data-act="toggle" data-ref="${k}|${t.id}" aria-pressed="${t.done}" aria-label="${t.done ? 'Mark not done' : 'Complete'} ${esc(t.text)}">${ic('check', 15)}</button>
    <button class="tbody" data-act="open-task" data-ref="${k}|${t.id}">
      <span class="ttl">${t.priority === 3 ? `<i class="flag" aria-label="High priority">${ic('flag', 13)}</i>` : ''}${esc(t.text)}</span>
      <span class="meta"><span>${time}</span><span class="m-st">${labelOf(t)}</span>${live}${t.spent ? `<span>${hm(t.spent)} focused</span>` : ''}${subs}${t.notes ? `<span>${ic('edit', 12)}</span>` : ''}<span class="tag">${esc(t.area)}</span></span>
    </button>
    <div class="tact">${action}<button class="ibtn ghosty" data-act="open-task" data-ref="${k}|${t.id}" aria-label="Edit" data-tip="Edit details">${ic('more', 16)}</button></div>
  </div>`;
}

function areaChips(name, selected) {
  return `<div class="chips" role="radiogroup" aria-label="Category">${getAreas().map(a => `<label class="chip" style="--c:${colorFor(a)}"><input type="radio" name="${name}" value="${esc(a)}" ${a === selected ? 'checked' : ''}><span>${esc(a)}</span></label>`).join('')}</div>`;
}

function priSeg(name, val = 0) {
  return `<div class="seg" role="radiogroup" aria-label="Priority">${PRI.map((p, i) => `<label><input type="radio" name="${name}" value="${i}" ${Number(val) === i ? 'checked' : ''}><span class="pri-${i}">${p}</span></label>`).join('')}</div>`;
}

const card = (body, cls = '', attrs = '') => `<section class="card ${cls}" ${attrs}>${body}</section>`;
const head = (kicker, title, right = '') => `<header class="vhead"><div><p class="kicker">${kicker}</p><h1>${title}</h1></div>${right}</header>`;
const empty = (icon, title, sub, btn = '') => `<div class="empty">${ic(icon, 34)}<b>${title}</b><p>${sub}</p>${btn}</div>`;

// ================= VIEWS =================

function todayView() {
  const k = todayKey(), d = day(k), p = A.dayPct(d), s = getState(), prof = s.profile;
  const open = d.tasks.filter(t => !t.done && t.status !== 'missed');
  const doneN = d.tasks.filter(t => t.done).length;
  const lv = A.level();
  const running = d.tasks.find(t => t.status === 'running' && !isPaused(t));
  const next = d.tasks.filter(t => t.status === 'scheduled' && t.startTime).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const review = d.tasks.filter(t => t.status === 'waiting_review');
  const list = d.tasks.filter(t => taskFilter === 'all' || (taskFilter === 'open' ? !t.done : t.done));
  const habits = A.habitsToday(k);
  const m = s.moods[k] || {}, w = s.wellness[k] || {};
  const fact = A.surprise();
  const nowCard = running
    ? `<div class="now running" style="--c:${colorFor(running.area)}"><div><p class="kicker">In progress</p><b>${esc(running.text)}</b><p class="mut">${esc(running.area)}</p></div><div class="now-r"><span class="big-clock" data-live="${k}|${running.id}">${fmtRemain(running, k)}</span><div class="row"><button class="ibtn" data-act="pause" data-ref="${k}|${running.id}" data-tip="Pause">${ic('pause', 16)}</button><button class="ibtn ok" data-act="toggle" data-ref="${k}|${running.id}" data-tip="Mark done">${ic('check', 16)}</button></div></div></div>`
    : next ? `<div class="now"><div><p class="kicker">Up next · ${fmtTime(next.startTime)}</p><b>${esc(next.text)}</b><p class="mut" data-until="${k}|${next.startTime}">${untilText(k, next.startTime)}</p></div><button class="btn sm" data-act="start" data-ref="${k}|${next.id}">${ic('play', 14)} Start now</button></div>`
      : '';
  return `
  ${head(fmtLong(k), `${greeting()}${prof.name ? `, <span class="grad">${esc(prof.name.split(' ')[0])}</span>` : ''}`, `<div class="hstats"><span class="chip-stat" data-tip="Days in a row with 80%+ done">${ic('flame', 15)} ${A.streak()}</span><button class="chip-stat" data-act="go" data-v="insights" data-tip="${lv.into}/${lv.need} XP to level ${lv.lvl + 1}">${ic('sparkle', 15)} Lv ${lv.lvl}</button></div>`)}
  ${fact && !sessionStorage.getItem('bm:factHidden') ? `<div class="fact">${ic('gift', 16)}<span>${esc(fact)}</span><button class="ibtn ghosty" data-act="hide-fact" aria-label="Hide">${ic('x', 14)}</button></div>` : ''}
  <div class="grid-today">
    <div class="col">
      ${card(`<form id="quickForm" class="quick" autocomplete="off">${ic('plus', 20)}<input name="text" id="quick" placeholder="Add a task… try “Read 30m at 4pm #Academic !high”" aria-label="Add a task"><button type="button" class="ibtn ghosty" data-act="plan-sheet" data-tip="More options" aria-label="More options">${ic('edit', 16)}</button></form><div id="qpreview" class="qpreview"></div>`, 'quick-card')}
      ${card(`<div class="row-between"><div><p class="kicker">Today's plan</p><h2>${d.tasks.length ? `${doneN} of ${d.tasks.length} done` : 'A blank page'}</h2>
          <input id="intention" class="intention" placeholder="Set an intention for today…" value="${esc(d.intention)}" aria-label="Today's intention"></div>${ring(p, 76, 8)}</div>
        ${nowCard}
        ${review.length ? `<div class="banner">${ic('bell', 16)} ${review.length} task${review.length > 1 ? 's' : ''} waiting for your review</div>` : ''}
        ${d.tasks.length ? `<div class="seg mini filt" role="tablist">${['all', 'open', 'done'].map(f => `<button class="${taskFilter === f ? 'on' : ''}" data-act="filter" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>` : ''}
        <div class="list" id="tasklist">${list.map(t => taskRow(k, t)).join('') || (d.tasks.length ? '<p class="mut pad">Nothing here.</p>' : empty('sparkle', 'Plan your first move', 'Type above, or use a template. Timed tasks start their timer on their own.', `<button class="btn" data-act="plan-sheet">${ic('plus', 16)} Plan a task</button>`))}</div>
        <div class="row-wrap foot-acts">
          ${open.length ? `<button class="pill" data-act="rollover" data-k="${k}">${ic('right', 14)} Move ${open.length} open to tomorrow</button>` : ''}
          ${d.tasks.length ? `<button class="pill" data-act="tpl-sheet">${ic('copy', 14)} Save as template</button>` : ''}
          ${s.templates.length ? `<button class="pill" data-act="use-tpl-sheet" data-k="${k}">${ic('layout', 14)} Use a template</button>` : ''}
        </div>`, 'tasks-card')}
    </div>
    <div class="col">
      ${card(`<div class="row-between"><p class="kicker">Habits today</p><button class="link" data-act="go" data-v="habits">Manage</button></div>
        ${habits.length ? `<div class="habit-pills">${habits.map(h => `<button class="hpill${S.habitDone(k, h.id) ? ' on' : ''}" style="--c:${h.color}" data-act="habit" data-k="${k}" data-id="${h.id}" aria-pressed="${S.habitDone(k, h.id)}"><span class="hi">${esc(h.icon)}</span><span>${esc(h.name)}</span><small>${A.habitStreak(h)}🔥</small></button>`).join('')}</div>` : `<p class="mut">Small daily wins compound. <button class="link" data-act="habit-sheet">Add a habit</button></p>`}`)}
      ${card(`<p class="kicker">Check-in</p>
        <div class="moods" role="radiogroup" aria-label="Mood">${[1, 2, 3, 4, 5].map(i => `<button class="mood${m.mood === i ? ' on' : ''}" data-act="mood" data-v="${i}" data-tip="${MOOD_NAMES[i]}" aria-label="Mood ${MOOD_NAMES[i]}" aria-pressed="${m.mood === i}">${MOODS[i]}</button>`).join('')}</div>
        <div class="energy"><span>${ic('bolt', 15)} Energy</span><div class="dots">${[1, 2, 3, 4, 5].map(i => `<button class="edot${(m.energy || 0) >= i ? ' on' : ''}" data-act="energy" data-v="${i}" aria-label="Energy ${i} of 5"></button>`).join('')}</div></div>
        <div class="well">
          <div class="stepper"><span>${ic('bed', 15)} Sleep</span><button data-act="well" data-f="sleep" data-d="-0.5" aria-label="Less sleep">−</button><b>${w.sleep || 0}h</b><button data-act="well" data-f="sleep" data-d="0.5" aria-label="More sleep">+</button></div>
          <div class="stepper"><span>${ic('drop', 15)} Water</span><button data-act="well" data-f="water" data-d="-1" aria-label="Less water">−</button><b>${w.water || 0}</b><button data-act="well" data-f="water" data-d="1" aria-label="More water">+</button></div>
        </div>`)}
      ${card(`<p class="kicker">Reflection</p><p class="prompt">${esc(promptFor(k))}</p><textarea id="reflect" rows="3" placeholder="Write it honestly…" aria-label="Reflection">${esc(d.reflection)}</textarea>
        <p class="kicker mt">Three good things</p>${[0, 1, 2].map(i => `<input class="grat" data-i="${i}" data-k="${k}" placeholder="${['Something that went well', 'Someone you appreciate', 'A small joy'][i]}" value="${esc(d.gratitude?.[i] || '')}">`).join('')}`)}
    </div>
  </div>`;
}

function untilText(k, hhmm) {
  const ms = new Date(`${k}T${hhmm}:00`).getTime() - Date.now();
  if (ms <= 0) return 'Starting now';
  const m = Math.round(ms / 60000);
  return `Starts in ${m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min'}`;
}

function weekStrip(sel) {
  const ws = getState().settings.weekStart;
  const d0 = new Date(sel + 'T12:00');
  const start = addDays(sel, -((d0.getDay() - ws + 7) % 7));
  const t = todayKey();
  return `<div class="week"><button class="ibtn" data-act="week" data-d="-7" aria-label="Previous week">${ic('left', 18)}</button>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => { const k = addDays(start, i), p = A.dayPct(getState().days[k]); return `<button class="wday${k === sel ? ' on' : ''}${k === t ? ' today' : ''}" data-act="pick-day" data-k="${k}"><small>${WD[new Date(k + 'T12:00').getDay()]}</small><b>${+k.slice(8)}</b><i style="--p:${p ?? 0}%" class="${p == null ? 'none' : ''}"></i></button>`; }).join('')}
    <button class="ibtn" data-act="week" data-d="7" aria-label="Next week">${ic('right', 18)}</button></div>`;
}

function timeline(k) {
  const d = day(k), S0 = 5, S1 = 24, PX = 64;
  const timed = d.tasks.filter(t => t.startTime);
  const free = d.tasks.filter(t => !t.startTime);
  const toMin = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const blocks = timed.map(t => {
    const s = toMin(t.startTime), dur = S.budgetMs(t, k) / 60000;
    const top = (s - S0 * 60) / 60 * PX, h = Math.max(30, dur / 60 * PX - 4);
    return { t, top, h, s, e: s + dur };
  });
  // Side-by-side columns for overlapping tasks.
  blocks.sort((a, b) => a.s - b.s);
  const cols = [];
  for (const b of blocks) { let c = cols.findIndex(end => end <= b.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = b.e; b.col = c; }
  const nc = Math.max(1, cols.length);
  const now = new Date(), nowTop = (now.getHours() * 60 + now.getMinutes() - S0 * 60) / 60 * PX;
  return `<div class="tl" style="--px:${PX}px;height:${(S1 - S0) * PX}px">
    ${Array.from({ length: S1 - S0 }, (_, i) => `<button class="tl-h" style="top:${i * PX}px" data-act="plan-at" data-k="${k}" data-t="${pad(S0 + i)}:00" aria-label="Plan at ${S0 + i}:00"><span>${fmtTime(pad(S0 + i) + ':00')}</span></button>`).join('')}
    ${k === todayKey() && nowTop > 0 ? `<div class="tl-now" style="top:${nowTop}px"><i></i></div>` : ''}
    ${blocks.map(b => `<button class="tl-b st-${b.t.status}${b.t.done ? ' done' : ''}" style="top:${b.top}px;height:${b.h}px;--c:${colorFor(b.t.area)};left:calc(56px + (100% - 60px) * ${b.col / nc});width:calc((100% - 60px) / ${nc} - 4px)" data-act="open-task" data-ref="${k}|${b.t.id}" data-tip="${esc(b.t.text)} · ${fmtTime(b.t.startTime)} · ${hm(S.budgetMs(b.t, k) / 60000)}">
      <b>${b.t.done ? '✓ ' : ''}${esc(b.t.text)}</b><small>${fmtTime(b.t.startTime)} · ${hm(S.budgetMs(b.t, k) / 60000)} · ${esc(b.t.area)}</small></button>`).join('')}
  </div>
  ${free.length ? `<p class="kicker mt">Anytime</p><div class="list">${free.map(t => taskRow(k, t, { noGrip: true })).join('')}</div>` : ''}`;
}

function planView() {
  const k = planDay, d = day(k), s = getState();
  return `${head('Plan', relDay(k) === fmt(k) ? fmtLong(k) : `${relDay(k)} <small class="hsub">${fmt(k)}</small>`, `<div class="seg mini" role="tablist"><button class="${planMode === 'timeline' ? 'on' : ''}" data-act="plan-mode" data-m="timeline">${ic('layout', 15)} Timeline</button><button class="${planMode === 'list' ? 'on' : ''}" data-act="plan-mode" data-m="list">${ic('list', 15)} List</button></div>`)}
  ${weekStrip(k)}
  <div class="grid-plan">
    ${card(`<form id="quickForm" class="quick" data-base="${k}" autocomplete="off">${ic('plus', 20)}<input name="text" id="quick" placeholder="Add to ${relDay(k).toLowerCase()}…" aria-label="Add a task"></form><div id="qpreview" class="qpreview"></div>
      ${planMode === 'timeline' ? timeline(k) : `<div class="list" id="tasklist">${d.tasks.map(t => taskRow(k, t)).join('') || empty('calendar', 'Nothing planned', 'Tap an hour on the timeline or add a task above.')}</div>`}`, 'plan-main')}
    <div class="col">
      ${card(`<h2>New task</h2><form id="planForm" class="stack" data-k="${k}">${planFields('', k)}</form>`, 'plan-form')}
      ${card(`<div class="row-between"><p class="kicker">Templates</p><button class="link" data-act="tpl-sheet" data-k="${k}">Save this day</button></div>${s.templates.length ? s.templates.map(t => `<div class="li"><div><b>${esc(t.name)}</b><small>${t.tasks.length} tasks${t.schedule?.length ? ' · ' + t.schedule.map(i => WD[i]).join(' ') : ''}</small></div><button class="pill" data-act="apply-tpl" data-id="${t.id}" data-k="${k}">Apply</button></div>`).join('') : '<p class="mut">Save a good day as a template and reuse it in one tap.</p>'}`)}
      ${card(`<p class="kicker">Recurring</p>${s.rules.length ? s.rules.map(r => `<div class="li"><div><b>${esc(r.text)}</b><small>${r.startTime ? fmtTime(r.startTime) + ' · ' : ''}${r.days.length === 7 ? 'Every day' : r.days.map(i => WD[i]).join(' ')}</small></div><button class="ibtn ghosty" data-act="rule-rm" data-id="${r.id}" aria-label="Stop repeating" data-tip="Stop repeating">${ic('trash', 15)}</button></div>`).join('') : '<p class="mut">Choose “Repeat on” when planning a task to make it recurring.</p>'}`)}
    </div>
  </div>`;
}

function planFields(text, k, at = '') {
  const s = getState(), today = k === todayKey();
  return `<label class="sr-only" for="planText">Task</label>
    <input id="planText" name="text" class="big-input" placeholder="What will you do?" autocomplete="off" value="${esc(text)}" required>
    <div class="field"><span class="flabel">Category</span>${areaChips('area', s.lastArea)}</div>
    <div class="field"><span class="flabel">Priority</span>${priSeg('priority', 0)}</div>
    <div class="three">
      <label>Day<input name="day" type="date" value="${k}"></label>
      <label>Starts<input name="start" type="time" value="${at}"></label>
      <label>Finish by<input name="end" type="time"></label>
    </div>
    <div class="two">
      <label>Minutes<input name="minutes" type="number" min="1" max="720" inputmode="numeric" value="${s.settings.defaultMinutes}"></label>
      <div class="field"><span class="flabel">&nbsp;</span><button type="button" class="btn ghost" data-act="suggest">${ic('sparkle', 15)} Suggest a time</button></div>
    </div>
    <details class="more"><summary>Notes, checklist and repeat</summary>
      <label>Notes<textarea name="notes" rows="2" placeholder="Links, details, why it matters…"></textarea></label>
      <label>Checklist <small class="mut">one item per line</small><textarea name="subs" rows="2" placeholder="Outline&#10;Draft&#10;Polish"></textarea></label>
      <div class="field"><span class="flabel">Repeat on</span><div class="days">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label class="dayck"><input type="checkbox" name="rep" value="${i}"><span>${WD[i][0]}</span></label>`).join('')}</div></div>
    </details>
    <p class="mut small">Timed tasks start their own countdown at the start time. When time is up, they wait for your review.</p>
    <div class="row-wrap">
      <button class="btn" type="submit" name="mode" value="plan">${ic('check', 16)} Plan task</button>
      ${today ? `<button class="btn ghost" type="submit" name="mode" value="now">${ic('play', 14)} Start now</button>` : ''}
    </div>`;
}

// ---------- focus (pomodoro) ----------
const POMO_KEY = () => `bm:pomo:${S.userId()}`;
let pomo = { mode: 'work', endAt: null, left: null, count: 0, ref: '' };
function loadPomo() { try { pomo = { ...pomo, ...JSON.parse(localStorage.getItem(POMO_KEY()) || '{}') }; } catch { /* */ } }
function savePomo() { localStorage.setItem(POMO_KEY(), JSON.stringify(pomo)); }
const pomoLen = mode => getState().settings.pomo[{ work: 'work', short: 'short', long: 'long' }[mode]] * 60000;
const pomoLeft = () => (pomo.endAt ? pomo.endAt - Date.now() : pomo.left ?? pomoLen(pomo.mode));
const MODE_NAME = { work: 'Focus', short: 'Short break', long: 'Long break' };

function focusView() {
  const s = getState(), k = todayKey();
  const left = pomoLeft(), total = pomoLen(pomo.mode), pct = 100 - Math.round(100 * left / total);
  const openTasks = day(k).tasks.filter(t => !t.done);
  const todayLog = s.focusLog.filter(f => f.at.slice(0, 10) === k);
  const R = 130, C = 2 * Math.PI * R;
  const every = s.settings.pomo.every;
  return `${head('Focus', 'Deep work', `<button class="btn ghost sm" data-act="zen" data-tip="Full-screen zen mode (Z)">${ic('expand', 15)} Zen</button>`)}
  <div class="grid-focus">
    ${card(`<div class="seg mini center" role="tablist">${['work', 'short', 'long'].map(m => `<button class="${pomo.mode === m ? 'on' : ''}" data-act="pomo-mode" data-m="${m}">${MODE_NAME[m]}</button>`).join('')}</div>
      <div class="pomo ${pomo.endAt ? 'running' : ''} mode-${pomo.mode}" id="pomo">
        <svg viewBox="0 0 300 300" class="pomo-ring" aria-hidden="true"><circle cx="150" cy="150" r="${R}" class="pr-track"/><circle cx="150" cy="150" r="${R}" class="pr-fill" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" data-c="${C}" id="prFill"/></svg>
        <div class="pomo-c"><span class="pomo-t" id="pomoT">${mmss(left)}</span><span class="pomo-m">${MODE_NAME[pomo.mode]}</span>
        <div class="pdots">${Array.from({ length: every }, (_, i) => `<i class="${i < pomo.count % every || (pomo.count && pomo.count % every === 0 && pomo.mode === 'long') ? 'on' : ''}"></i>`).join('')}</div></div>
      </div>
      <div class="pomo-ctl">
        <button class="ibtn lg" data-act="pomo-reset" data-tip="Reset" aria-label="Reset">${ic('repeat', 20)}</button>
        <button class="play-btn" data-act="pomo-toggle" aria-label="${pomo.endAt ? 'Pause' : 'Start'}">${ic(pomo.endAt ? 'pause' : 'play', 30)}</button>
        <button class="ibtn lg" data-act="pomo-skip" data-tip="Skip to next" aria-label="Skip">${ic('right', 20)}</button>
      </div>
      <label class="attach">Working on<select id="pomoTask"><option value="">Free focus</option>${openTasks.map(t => `<option value="${k}|${t.id}" ${pomo.ref === k + '|' + t.id ? 'selected' : ''}>${esc(t.text)}</option>`).join('')}</select></label>`, 'focus-main')}
    <div class="col">
      ${card(`<p class="kicker">${ic('music', 14)} Soundscape</p><div class="chips">${Object.entries(AMBIENTS).map(([id, n]) => `<button class="chip-b${(ambientOn() === id || (id === 'off' && ambientOn() === 'off')) ? ' on' : ''}" data-act="ambient" data-v="${id}">${n}</button>`).join('')}</div>
        <label class="range">Volume<input type="range" min="0" max="1" step="0.05" value="${s.settings.ambientVol}" id="ambVol"></label><p class="mut small">Generated live on your device. No downloads.</p>`)}
      ${card(`<div class="row-between"><p class="kicker">Today</p><span class="mut small">${todayLog.length} session${todayLog.length === 1 ? '' : 's'}</span></div><p class="big">${hm(todayLog.reduce((a, f) => a + f.minutes, 0))}</p>
        <div class="list">${todayLog.slice(0, 6).map(f => `<div class="li"><div><b>${esc(f.text || 'Free focus')}</b><small>${new Date(f.at).toTimeString().slice(0, 5)} · ${f.minutes} min</small></div></div>`).join('') || '<p class="mut">Start a session. Each one earns XP.</p>'}</div>`)}
      ${card(`<p class="kicker">Timer settings</p><div class="two">${[['work', 'Focus'], ['short', 'Short break'], ['long', 'Long break'], ['every', 'Long break every']].map(([f, l]) => `<label>${l}<input type="number" min="1" max="180" value="${s.settings.pomo[f]}" data-set="pomo.${f}" data-num></label>`).join('')}</div>
        <label class="switch"><span>Start breaks automatically</span><input type="checkbox" data-set="pomo.autoBreak" ${s.settings.pomo.autoBreak ? 'checked' : ''}></label>`)}
    </div>
  </div>`;
}

function pomoToggle() {
  if (pomo.endAt) { pomo.left = pomo.endAt - Date.now(); pomo.endAt = null; play('tap'); }
  else {
    pomo.endAt = Date.now() + (pomo.left ?? pomoLen(pomo.mode)); pomo.left = null; play('save');
    if (getState().settings.ambient !== 'off' && ambientOn() === 'off' && pomo.mode === 'work') ambient(getState().settings.ambient, getState().settings.ambientVol);
    track('Focus timer');
  }
  savePomo(); render();
}
function pomoNext(finished) {
  const st = getState().settings.pomo;
  if (pomo.mode === 'work') {
    if (finished) {
      const [k, id] = (pomo.ref || '').split('|');
      const t = id ? S.findTask(k, id) : null;
      S.logFocus({ minutes: st.work, text: t?.text || '', area: t?.area || '', taskId: id || '' });
      if (t && !(t.status === 'running' && t.runStart != null)) S.addSpent(k, id, st.work);
    }
    pomo.count++;
    pomo.mode = pomo.count % st.every === 0 ? 'long' : 'short';
  } else pomo.mode = 'work';
  pomo.left = null;
  pomo.endAt = finished && st.autoBreak && pomo.mode !== 'work' ? Date.now() + pomoLen(pomo.mode) : null;
  if (pomo.mode !== 'work' && finished) stopAmbient();
  savePomo();
}
function pomoTick() {
  if (pomo.endAt && Date.now() >= pomo.endAt) {
    const was = pomo.mode;
    pomoNext(true);
    play('chime');
    notify(was === 'work' ? 'Focus session done. Take a breath.' : 'Break over. Ready for the next round?');
    toast(was === 'work' ? `${ic('check', 14)} Session logged. +XP` : 'Break over', null, true);
    if (was === 'work') checkLevel();
    if (view === 'focus') render();
  }
  const t = $('#pomoT');
  if (t) {
    const left = pomoLeft();
    t.textContent = mmss(left);
    const f = $('#prFill');
    if (f) f.style.strokeDashoffset = f.dataset.c * (left / pomoLen(pomo.mode));
  }
  const z = $('#zenT');
  if (z) z.textContent = mmss(pomoLeft());
  document.title = pomo.endAt ? `${mmss(pomoLeft())} · ${MODE_NAME[pomo.mode]}` : 'Better Me';
}

function zen() {
  const el = document.createElement('div');
  el.className = 'zen';
  el.innerHTML = `<div class="zen-orb"></div><div class="zen-c"><p class="kicker">${MODE_NAME[pomo.mode]}</p><span id="zenT">${mmss(pomoLeft())}</span><p class="mut">Breathe in as the light grows, out as it fades.</p>
    <div class="row"><button class="play-btn" data-act="zen-toggle">${ic(pomo.endAt ? 'pause' : 'play', 28)}</button><button class="btn ghost" data-act="zen-exit">Exit</button></div></div>`;
  document.body.appendChild(el);
  el.requestFullscreen?.().catch(() => {});
  track('Zen mode');
}

// ---------- habits ----------
function habitsView() {
  const s = getState(), k = todayKey(), last = Array.from({ length: 7 }, (_, i) => addDays(k, i - 6));
  const hs = s.habits.filter(h => !h.archived);
  return `${head('Habits', 'Little things, every day', `<button class="btn sm" data-act="habit-sheet">${ic('plus', 15)} New habit</button>`)}
  ${hs.length ? `<div class="habit-grid">${hs.map(h => {
    const keys30 = Array.from({ length: 30 }, (_, i) => addDays(k, i - 29));
    const rate = A.habitRate(h, keys30), str = A.habitStreak(h);
    return card(`<div class="hh"><span class="hicon" style="--c:${h.color}">${esc(h.icon)}</span><div><b>${esc(h.name)}</b><small>${h.days.length === 7 ? 'Every day' : h.days.map(i => WD[i]).join(' ')}</small></div><button class="ibtn ghosty" data-act="habit-sheet" data-id="${h.id}" aria-label="Edit habit" data-tip="Edit">${ic('more', 16)}</button></div>
      <div class="hweek">${last.map(d => { const due = h.days.includes(new Date(d + 'T12:00').getDay()); const on = S.habitDone(d, h.id); return `<button class="hd${on ? ' on' : ''}${due ? '' : ' off'}${d === k ? ' today' : ''}" style="--c:${h.color}" data-act="habit" data-k="${d}" data-id="${h.id}" aria-pressed="${on}" aria-label="${fmt(d)}"><small>${WD[new Date(d + 'T12:00').getDay()][0]}</small>${on ? ic('check', 14) : ''}</button>`; }).join('')}</div>
      <div class="hstat"><span>${ic('flame', 14)} <b>${str}</b> streak</span><span><b>${rate ?? '–'}${rate == null ? '' : '%'}</b> last 30 days</span>${spark(keys30.map(d => (S.habitDone(d, h.id) ? 1 : 0)).reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) * 0.7 + v), acc), []), 80, 24)}</div>`, 'habit', `style="--c:${h.color}"`);
  }).join('')}</div>` : card(empty('repeat', 'Build your first habit', 'Drink water, read 10 pages, walk after lunch. Tap once a day and watch the streak grow.', `<button class="btn" data-act="habit-sheet">${ic('plus', 15)} Add a habit</button>`))}
  ${hs.length ? card(`<p class="kicker">Ideas</p><div class="chips">${['💧 Drink water', '📚 Read 10 pages', '🧘 Meditate', '🏃 Move 20 min', '📵 No phone after 10pm', '✍️ Journal', '😴 Sleep by 11'].map(x => `<button class="chip-b" data-act="habit-quick" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`) : ''}`;
}

function habitSheet(id) {
  const h = id ? getState().habits.find(x => x.id === id) : null;
  return `<form id="habitForm" class="sheet-card" data-id="${id || ''}"><div class="sheet-h"><h2>${h ? 'Edit habit' : 'New habit'}</h2><button type="button" class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
    <input name="name" class="big-input" placeholder="e.g. Read 10 pages" value="${esc(h?.name || '')}" required autocomplete="off">
    <div class="field"><span class="flabel">Icon</span><div class="emoji">${EMOJI.map(e => `<label><input type="radio" name="icon" value="${e}" ${(h?.icon || '✨') === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div></div>
    <div class="field"><span class="flabel">Colour</span><div class="swatches">${PALETTE.map(c => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${(h?.color || PALETTE[getState().habits.length % PALETTE.length]) === c ? 'checked' : ''}><span></span></label>`).join('')}</div></div>
    <div class="field"><span class="flabel">Days</span><div class="days">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label class="dayck"><input type="checkbox" name="days" value="${i}" ${!h || h.days.includes(i) ? 'checked' : ''}><span>${WD[i][0]}</span></label>`).join('')}</div></div>
    <div class="row-wrap"><button class="btn" type="submit">${ic('check', 16)} ${h ? 'Save' : 'Create habit'}</button>${h ? `<button type="button" class="btn danger ghost" data-act="habit-rm" data-id="${h.id}">${ic('trash', 15)} Delete</button>` : ''}</div></form>`;
}

// ---------- insights ----------
function insightsView() {
  const s = getState(), to = todayKey(), from = addDays(to, -(insightRange - 1));
  const sm = A.summary(from, to), keys = sm.keys;
  const lv = A.level(), got = new Set(A.earnedBadges());
  const f = momentumForecast(), c = chronotype();
  const areas = A.areaStats(keys);
  const parts = areas.map(a => ({ label: a.name, value: a.minutes, color: colorFor(a.name) }));
  const total = parts.reduce((a, b) => a + b.value, 0);
  const heatKeys = A.keysBetween(addDays(to, -181), to);
  const ms = A.moodSeries(keys);
  const goals = A.goalProgress();
  const corr = A.moodCorrelation(keys);
  const score = A.performanceScore(from, to), tr = A.trend(keys), cons = A.consistency(keys), cmp = A.comparePeriods(from, to);
  const usage = A.usageStats(keys);
  const delta = v => (v == null ? '' : `<em class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}</em>`);
  const tile = (v, l, sub = '', icn = '', d = '') => `<div class="tile">${icn ? ic(icn, 18) : ''}<b>${v}${d}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `${head('Insights', 'How you are doing', `<div class="seg mini">${[7, 30, 90, 365].map(r => `<button class="${insightRange === r ? 'on' : ''}" data-act="range" data-r="${r}">${r === 365 ? '1y' : r + 'd'}</button>`).join('')}</div>`)}
  <div class="tiles">
    ${tile(sm.pct == null ? '–' : sm.pct + '%', 'Completion', `${sm.done}/${sm.planned} tasks`, 'check', delta(cmp.pct))}
    ${tile(hm(sm.minutes + sm.focusMinutes), 'Time invested', `${sm.focusSessions} focus sessions`, 'timer')}
    ${tile(A.streak(), 'Day streak', `best ${A.bestStreak()}`, 'flame')}
    ${tile(sm.perfect, 'Perfect days', `${sm.activeDays} active`, 'sparkle')}
    ${tile(sm.avgMood ? MOODS[Math.round(sm.avgMood)] + ' ' + sm.avgMood : '–', 'Avg mood', `${sm.moodDays} check-ins`)}
    ${tile(sm.avgSleep ? sm.avgSleep + 'h' : '–', 'Avg sleep', sm.avgWater ? `${sm.avgWater} glasses water` : '', 'bed')}
  </div>
  <div class="grid-ins">
    ${card(`<div class="score">${ring(score, 120, 12, score == null ? '–' : String(score))}<div><p class="kicker">Performance score</p><h2>Grade ${A.grade(score)} ${delta(cmp.score)}</h2>
      <p class="mut small">Completion 40% · consistency 20% · focus 15% · habits 15% · reflection 10%</p>
      <div class="kv"><span>Trend</span><b>${tr == null ? 'Needs more days' : (tr >= 0 ? '+' : '') + tr + ' pts/week'}</b><span>Consistency</span><b>${cons ?? '–'}${cons == null ? '' : '/100'}</b><span>vs previous ${insightRange}d</span><b>${cmp.done >= 0 ? '+' : ''}${cmp.done} tasks</b></div></div></div>`, 'span2')}
    ${card(`<div class="row-between"><div><p class="kicker">Level ${lv.lvl}</p><h2>${A.xp()} XP</h2></div><span class="lvl-badge">${lv.lvl}</span></div><div class="bar thick"><b style="width:${lv.pct}%"></b></div><p class="mut small">${lv.need - lv.into} XP to level ${lv.lvl + 1}. Tasks, habits, focus and reflection all count.</p>`)}
    ${card(`<p class="kicker">Daily completion</p>${bars(keys.slice(-Math.min(31, keys.length)).map(k => ({ label: insightRange <= 7 ? WD[new Date(k + 'T12:00').getDay()] : String(+k.slice(8)), v: A.dayPct(s.days[k]), tip: `${fmt(k)}: ${A.dayPct(s.days[k]) ?? 'no tasks'}${A.dayPct(s.days[k]) == null ? '' : '%'}` })), { h: 150 })}`, 'span2')}
    ${card(`<p class="kicker">Where time went</p>${total ? donut(parts, 150, hm(total)) : empty('chart', 'No time logged yet', 'Complete or focus on tasks to see the split.')}`)}
    ${card(`<p class="kicker">Consistency · 26 weeks</p>${heatmap(heatKeys.map(k => ({ k, v: A.dayPct(s.days[k]), tip: `${fmt(k)}: ${A.dayPct(s.days[k]) ?? '–'}${A.dayPct(s.days[k]) == null ? '' : '%'}`, today: k === to })), s.settings.weekStart)}<div class="hm-legend"><span>Less</span><i style="--a:.2"></i><i style="--a:.5"></i><i style="--a:.8"></i><i style="--a:1"></i><span>More</span></div>`, 'span2')}
    ${card(`<p class="kicker">By area</p>${hbars(areas.map(a => ({ ...a, color: colorFor(a.name) })), { fmt: r => (r.pct == null ? '–' : r.pct + '%') })}`)}
    ${card(`<p class="kicker">Weekdays</p>${bars(A.weekdayStats(keys).map(w => ({ label: w.name, v: w.pct })), { h: 110 })}`)}
    ${card(`<p class="kicker">Mood trend</p>${ms.some(m => m.mood) ? line(ms.map(m => m.mood), { min: 1, max: 5, h: 120, labels: ms.map(m => m.k) }) : empty('sun', 'No check-ins yet', 'Tap a mood on Today. Patterns appear in a few days.')}${corr != null ? `<p class="mut small">Mood × completion: r = ${corr}</p>` : ''}`)}
    ${card(`<p class="kicker">When you get things done</p>${bars(A.hourStats(keys).map((v, i) => ({ label: i % 4 === 0 ? String(i) : '', v, tip: `${pad(i)}:00 · ${v} done` })), { h: 100, max: Math.max(1, ...A.hourStats(keys)), fmt: v => v })}`, 'span2')}
    ${card(`<p class="kicker">Weekly goals</p>${goals.length ? hbars(goals.map(g => ({ name: g.name, pct: g.pct, color: colorFor(g.name), g })), { fmt: r => `${r.g.done}/${r.g.goal}m` }) : `<p class="mut">Set weekly minutes per category in <button class="link" data-act="settings" data-sec="categories">Settings</button>.</p>`}`)}
    ${card(`<p class="kicker">Algorithms</p><div class="ins"><b>Forecast</b><p>${esc(f.note)}</p></div><div class="ins"><b>Rhythm</b><p>${esc(c.note)}</p></div>${getAreas().slice(0, 4).map(a => `<div class="ins"><b style="color:${colorFor(a)}">${esc(a)}</b><p>${esc(capacity(a).note)}</p></div>`).join('')}`, 'span2')}
    ${card(`<p class="kicker">Advice</p>${A.advice().map(a => `<p class="adv">${ic('sparkle', 14)} ${esc(a)}</p>`).join('')}`)}
    ${card(`<p class="kicker">App usage</p><div class="kv"><span>Days opened</span><b>${usage.daysUsed}/${keys.length}</b><span>Opens</span><b>${usage.opens}</b><span>Time in app</span><b>${hm(usage.minutes)}</b><span>Avg session</span><b>${usage.avgSession}m</b><span>Favourite view</span><b>${esc(NAV.find(n => n[0] === usage.views[0]?.[0])?.[1] || '–')}</b></div>`)}
    ${card(`<div class="row-between"><p class="kicker">Achievements</p><span class="mut small">${got.size}/${A.BADGES.length}</span></div><div class="badges">${A.BADGES.map(b => `<div class="badge${got.has(b.id) ? ' on' : ''}" data-tip="${esc(b.desc)}"><span>${b.icon}</span><b>${esc(b.name)}</b></div>`).join('')}</div>`, 'span2')}
    ${card(`<div class="cta-report"><div><p class="kicker">Your review document</p><h2>Export a full report</h2><p class="mut">Pick any period. Profile, theme, charts, scores, algorithms, every task and reflection — as a beautiful PDF.</p></div><button class="btn" data-act="report">${ic('download', 16)} Create PDF</button></div>`, 'span3 glow')}
  </div>`;
}

// ---------- journal ----------
function journalView() {
  const s = getState(), k = journalDay, d = day(k), m = s.moods[k] || {};
  const entries = Object.keys(s.days).filter(x => { const dd = s.days[x]; return dd.reflection || dd.note || (dd.gratitude || []).some(Boolean); }).sort().reverse();
  return `${head('Journal', relDay(k) === fmt(k) ? fmtLong(k) : relDay(k), `<div class="row"><button class="ibtn" data-act="jday" data-d="-1" aria-label="Previous day">${ic('left', 18)}</button><input type="date" id="jdate" value="${k}" max="${todayKey()}" aria-label="Journal date"><button class="ibtn" data-act="jday" data-d="1" aria-label="Next day" ${k >= todayKey() ? 'disabled' : ''}>${ic('right', 18)}</button></div>`)}
  <div class="grid-journal">
    ${card(`<div class="row-between"><p class="kicker">Prompt</p><span class="jmood">${m.mood ? MOODS[m.mood] : ''}</span></div><p class="prompt big-p">${esc(promptFor(k))}</p>
      <textarea class="jt" data-jf="reflection" rows="7" placeholder="Start writing…">${esc(d.reflection)}</textarea>
      <p class="kicker mt">Grateful for</p>${[0, 1, 2].map(i => `<input class="grat" data-i="${i}" data-k="${k}" value="${esc(d.gratitude?.[i] || '')}" placeholder="${i + 1}.">`).join('')}
      <p class="kicker mt">Free notes</p><textarea class="jt" data-jf="note" rows="4" placeholder="Ideas, lessons, anything…">${esc(d.note)}</textarea>
      <p class="mut small" id="jcount">${(d.reflection + ' ' + d.note).split(/\s+/).filter(Boolean).length} words · saves as you type</p>`, 'span2')}
    ${card(`<p class="kicker">Past entries · ${entries.length}</p><div class="entries">${entries.slice(0, 40).map(x => { const dd = s.days[x]; return `<button class="entry${x === k ? ' on' : ''}" data-act="jopen" data-k="${x}"><span>${fmt(x)} ${s.moods[x]?.mood ? MOODS[s.moods[x].mood] : ''}</span><small>${esc((dd.reflection || dd.note || dd.gratitude.filter(Boolean).join(', ')).slice(0, 90))}</small></button>`; }).join('') || '<p class="mut">Your first entry will appear here.</p>'}</div>`)}
  </div>`;
}

// ---------- goals ----------
function goalsView() {
  const s = getState(), t = todayKey();
  const lg = [...s.longGoals].sort((a, b) => (!!a.doneAt - !!b.doneAt) || (a.due || '9').localeCompare(b.due || '9'));
  return `${head('Goals', 'The long game', `<button class="btn sm" data-act="goal-sheet">${ic('plus', 15)} New goal</button>`)}
  ${lg.length ? `<div class="goal-grid">${lg.map(g => {
    const d = g.milestones.filter(x => x.done).length, n = g.milestones.length, pct = n ? Math.round(100 * d / n) : 0;
    const left = g.due ? Math.round((new Date(g.due + 'T12:00') - new Date(t + 'T12:00')) / 86400000) : null;
    return card(`<div class="gh">${ring(pct, 64, 7)}<div class="grow"><b class="gt">${esc(g.title)}</b><small>${g.area ? `<span class="tag" style="--c:${colorFor(g.area)}">${esc(g.area)}</span> ` : ''}${g.doneAt ? '🎉 Achieved' : left == null ? 'No deadline' : left < 0 ? `${-left} days overdue` : left === 0 ? 'Due today' : `${left} days left`}</small></div><button class="ibtn ghosty" data-act="goal-rm" data-id="${g.id}" aria-label="Delete goal" data-tip="Delete">${ic('trash', 15)}</button></div>
      ${g.why ? `<p class="why">“${esc(g.why)}”</p>` : ''}
      <div class="ms">${g.milestones.map(x => `<div class="msi${x.done ? ' done' : ''}"><button class="check sm${x.done ? ' on' : ''}" data-act="ms" data-id="${g.id}" data-m="${x.id}" aria-label="Toggle milestone">${ic('check', 12)}</button><span>${esc(x.text)}</span><button class="ibtn ghosty xs" data-act="ms-rm" data-id="${g.id}" data-m="${x.id}" aria-label="Remove">${ic('x', 12)}</button></div>`).join('')}</div>
      <form class="msadd" data-id="${g.id}"><input name="m" placeholder="Add a milestone…" autocomplete="off"><button class="ibtn" aria-label="Add">${ic('plus', 16)}</button></form>`, `goal${g.doneAt ? ' achieved' : ''}`);
  }).join('')}</div>` : card(empty('target', 'Set a long-term goal', 'Graduate with honours. Launch the first product. Run 10K. Break it into milestones and tick them off.', `<button class="btn" data-act="goal-sheet">${ic('plus', 15)} New goal</button>`))}
  ${card(`<p class="kicker">Weekly minutes per category</p><div class="goal-mins">${getAreas().map(a => `<label class="gm" style="--c:${colorFor(a)}"><span>${esc(a)}</span><input type="number" min="0" step="15" inputmode="numeric" placeholder="min/week" value="${s.goals[a] || ''}" data-goal="${esc(a)}"></label>`).join('')}</div>`)}`;
}

function goalSheet() {
  return `<form id="goalForm" class="sheet-card"><div class="sheet-h"><h2>New goal</h2><button type="button" class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
    <input name="title" class="big-input" placeholder="What do you want to achieve?" required autocomplete="off">
    <label>Why it matters<input name="why" placeholder="Your reason, in one line"></label>
    <div class="two"><label>Deadline<input name="due" type="date"></label><label>Category<select name="area"><option value="">None</option>${getAreas().map(a => `<option>${esc(a)}</option>`).join('')}</select></label></div>
    <label>Milestones <small class="mut">one per line</small><textarea name="ms" rows="4" placeholder="First step&#10;Halfway&#10;Done"></textarea></label>
    <button class="btn" type="submit">${ic('target', 16)} Create goal</button></form>`;
}

// ---------- history ----------
function historyView() {
  const s = getState(), y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const label = calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const ws = s.settings.weekStart, lead = (new Date(y, mo, 1).getDay() - ws + 7) % 7, total = new Date(y, mo + 1, 0).getDate(), t = todayKey();
  let cells = Array.from({ length: 7 }, (_, i) => `<span class="dow">${WD[(i + ws) % 7].slice(0, 2)}</span>`).join('');
  cells += '<span></span>'.repeat(lead);
  for (let d = 1; d <= total; d++) {
    const k = `${y}-${pad(mo + 1)}-${pad(d)}`, p = A.dayPct(s.days[k]);
    cells += `<button class="cell${k === t ? ' today' : ''}${k === calSel ? ' sel' : ''}" style="--a:${p == null ? 0 : Math.max(0.15, p / 100)}" data-act="cal" data-k="${k}" aria-label="${fmtLong(k)}${p == null ? '' : ', ' + p + '%'}"><span>${d}</span>${s.moods[k]?.mood ? `<i>${MOODS[s.moods[k].mood]}</i>` : ''}</button>`;
  }
  const d = s.days[calSel], list = d?.tasks || [];
  return `${head('History', 'Your record')}
  <div class="grid-hist">
    ${card(`<div class="mhead"><button class="ibtn" data-act="month" data-d="-1" aria-label="Previous month">${ic('left', 18)}</button><b>${label}</b><button class="ibtn" data-act="month" data-d="1" aria-label="Next month">${ic('right', 18)}</button></div><div class="cal">${cells}</div>`)}
    ${card(`<div class="row-between"><div><p class="kicker">${relDay(calSel)}</p><h2>${fmtLong(calSel)}</h2></div>${list.length ? ring(A.dayPct(d), 56, 6) : ''}</div>
      <div class="list">${list.map(t => taskRow(calSel, t, { noGrip: true })).join('') || `<p class="mut pad">Nothing planned.</p>`}</div>
      ${d?.reflection ? `<blockquote>${esc(d.reflection)}</blockquote>` : ''}
      <div class="row-wrap"><button class="pill" data-act="plan-day" data-k="${calSel}">${ic('calendar', 14)} Open in planner</button><button class="pill" data-act="jopen" data-k="${calSel}">${ic('book', 14)} Journal</button></div>`)}
  </div>`;
}

// ---------- profile ----------
function profileView() {
  const s = getState(), p = s.profile, lv = A.level();
  const all = Object.values(s.days).flatMap(d => d.tasks);
  return `${head('Profile', 'You')}
  <div class="grid-prof">
    ${card(`<div class="prof-hero"><label class="avatar-up" data-tip="Change photo">${p.photo ? `<img src="${p.photo}" alt="">` : `<span>${esc((p.name || 'B')[0].toUpperCase())}</span>`}<input type="file" accept="image/*" id="photo" class="sr-only"><i>${ic('upload', 14)}</i></label>
      <div><h2>${esc(p.name || 'Your name')}</h2><p class="mut">${esc(p.motto || p.occupation || 'Add a motto below')}</p><div class="row-wrap"><span class="chip-stat">${ic('sparkle', 14)} Level ${lv.lvl}</span><span class="chip-stat">${ic('check', 14)} ${all.filter(t => t.done).length} done</span><span class="chip-stat">${ic(S.isGuest() ? 'lock' : 'cloud', 14)} ${S.isGuest() ? 'This device only' : 'Synced'}</span></div></div></div>`, 'span2')}
    ${card(`<form id="profileForm" class="stack">
      <div class="two"><label>Name<input name="name" value="${esc(p.name)}" autocomplete="name"></label><label>Motto<input name="motto" value="${esc(p.motto)}" placeholder="Words you live by"></label></div>
      <div class="two"><label>Occupation<input name="occupation" value="${esc(p.occupation)}" placeholder="Student, founder…"></label><label>Location<input name="location" value="${esc(p.location)}" placeholder="Nairobi"></label></div>
      <div class="three"><label>Age<input name="age" inputmode="numeric" value="${esc(p.age)}"></label><label>Phone<input name="phone" type="tel" value="${esc(p.phone)}" autocomplete="tel"></label><label>Email<input name="email" type="email" value="${esc(p.email || user?.email || '')}" autocomplete="email"></label></div>
      <label>Bio<textarea name="bio" rows="3">${esc(p.bio)}</textarea></label>
      <div class="row-wrap"><button class="btn" type="submit">${ic('check', 16)} Save profile</button>${p.photo ? `<button type="button" class="btn ghost" data-act="photo-rm">Remove photo</button>` : ''}</div></form>`, 'span2')}
    ${card(`<p class="kicker">Account</p><div class="kv"><span>Status</span><b>${S.isGuest() ? 'Guest (this device)' : 'Signed in'}</b>${user?.email ? `<span>Email</span><b>${esc(user.email)}</b>` : ''}<span>Version</span><b>${VERSION}</b><span>Data size</span><b>${(S.bytes() / 1024).toFixed(1)} KB</b></div>
      <div class="stack-s">
        <button class="btn" data-act="report">${ic('download', 15)} Export my review (PDF)</button>
        <button class="btn ghost" data-act="settings">${ic('gear', 15)} Settings</button>
        ${S.isGuest() ? `<a class="btn ghost" href="lab.html?from=guest">${ic('cloud', 15)} Create account to sync</a>` : ''}
        <button class="btn ghost danger" data-act="signout">${ic('logout', 15)} ${S.isGuest() ? 'Leave guest mode' : 'Sign out'}</button>
      </div>`)}
  </div>`;
}

const VIEWS = { today: todayView, plan: planView, focus: focusView, habits: habitsView, insights: insightsView, journal: journalView, goals: goalsView, history: historyView, profile: profileView };

// ================= RENDER =================
function navHtml() {
  return NAV.map(([id, label, icn], i) => `<button class="nav-i${view === id ? ' on' : ''}" data-act="go" data-v="${id}" aria-current="${view === id ? 'page' : 'false'}" data-tip-r="${label} (${i + 1})">${id === 'profile' ? avatarHtml(22) : ic(icn, 20)}<span>${label}</span></button>`).join('');
}
function avatarHtml(size = 28) {
  const p = getState().profile;
  return `<span class="av" style="width:${size}px;height:${size}px">${p.photo ? `<img src="${p.photo}" alt="">` : esc((p.name || 'B')[0].toUpperCase())}</span>`;
}

function asideHtml() {
  const k = todayKey(), d = day(k), s = getState();
  const nextUp = d.tasks.filter(t => !t.done && t.startTime).slice(0, 4);
  const w = A.weekSummary();
  return `<div class="card mini-c"><p class="kicker">This week</p><div class="kv"><span>Done</span><b>${w.done}</b><span>Completion</span><b>${w.pct ?? '–'}${w.pct == null ? '' : '%'}</b><span>Focus</span><b>${hm(w.focusMinutes)}</b><span>Strongest</span><b>${esc(w.best || '–')}</b></div></div>
  <div class="card mini-c"><p class="kicker">Coming up</p>${nextUp.map(t => `<button class="li li-b" data-act="open-task" data-ref="${k}|${t.id}"><i class="dot" style="background:${colorFor(t.area)}"></i><div><b>${esc(t.text)}</b><small>${fmtTime(t.startTime)}</small></div></button>`).join('') || '<p class="mut small">Nothing else timed today.</p>'}</div>
  <div class="card mini-c"><p class="kicker">Last 14 days</p>${bars(A.lastKeys(14).reverse().map(x => ({ label: '', v: A.dayPct(s.days[x]), tip: `${fmt(x)}: ${A.dayPct(s.days[x]) ?? '–'}` })), { h: 60 })}</div>`;
}

function render(changed = false) {
  if (!ready) return;
  applyTheme();
  $('#nav').innerHTML = navHtml();
  $$('.tabs [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
  $('#topTitle').textContent = NAV.find(n => n[0] === view)?.[1] || '';
  const html = VIEWS[view]();
  const y = window.scrollY;
  const swap = () => {
    app.innerHTML = html;
    app.classList.toggle('enter', changed && motionOK());
    $('#aside').innerHTML = asideHtml();
    if (changed) window.scrollTo(0, 0); else window.scrollTo(0, y);
  };
  if (changed && document.startViewTransition && motionOK()) document.startViewTransition(swap);
  else swap();
}

function go(v) {
  if (!VIEWS[v]) v = 'today';
  if (location.hash !== '#' + v) history.pushState(null, '', '#' + v);
  view = v;
  S.trackView(v);
  sheet('');
  render(true);
}
addEventListener('popstate', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== view) { view = v; sheet(''); render(true); } });

// ================= SHEETS =================
let lastFocus = null;
function sheet(html, cls = '') {
  if (!html) {
    if (!sh.classList.contains('open')) return;
    tm = null; settingsSection = null;
    sh.classList.remove('open');
    setTimeout(() => { if (!sh.classList.contains('open')) { sh.innerHTML = ''; sh.className = 'sheet'; } }, 260);
    sh.removeAttribute('role');
    if (pendingRender) { pendingRender = false; render(); }
    lastFocus?.focus?.();
    return;
  }
  if (!sh.classList.contains('open')) lastFocus = document.activeElement;
  sh.className = `sheet open ${cls}`;
  sh.innerHTML = `<div class="sheet-in">${html}</div>`;
  sh.setAttribute('role', 'dialog');
  sh.setAttribute('aria-modal', 'true');
  setTimeout(() => sh.querySelector('[autofocus], input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea')?.focus({ preventScroll: true }), 80);
}
const sheetOpen = () => sh.classList.contains('open');

function toast(msg, undo, rawHtml = false) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${rawHtml ? msg : esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); el.remove(); render(); play('tap'); };
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 4600);
  setTimeout(() => el.remove(), 5000);
}

function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- task sheets ----------
function taskSheet(k, id) {
  const t = S.findTask(k, id);
  if (!t) return;
  tm = { k, id };
  const running = t.status === 'running' && !isPaused(t);
  sheet(`<form id="taskForm" class="sheet-card" data-k="${k}" data-id="${id}">
    <div class="sheet-h"><span class="st-badge st-${t.status}">${labelOf(t)}</span><button type="button" class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
    <input class="big-input" data-tf="text" value="${esc(t.text)}" aria-label="Task name">
    ${t.status !== 'done' && t.status !== 'missed' ? `<div class="timer-box"><div><p class="kicker">Timer</p><span class="clock" id="clock">${fmtRemain(t, k)}</span><small class="mut">${hm(S.elapsedMs(t) / 60000)} of ${hm(S.budgetMs(t, k) / 60000)} used</small></div>
      <div class="row-wrap">${t.status === 'waiting_review' ? '' : `<button type="button" class="btn sm" data-act="${running ? 'pause' : 'start'}" data-ref="${k}|${id}">${ic(running ? 'pause' : 'play', 14)} ${running ? 'Pause' : 'Start'}</button>`}<button type="button" class="pill" data-act="extend" data-ref="${k}|${id}" data-m="5">+5m</button><button type="button" class="pill" data-act="extend" data-ref="${k}|${id}" data-m="15">+15m</button></div></div>` : ''}
    ${t.status === 'waiting_review' ? reviewButtons(k, id) : ''}
    <div class="field"><span class="flabel">Category</span>${areaChips('tf-area', t.area)}</div>
    <div class="field"><span class="flabel">Priority</span>${priSeg('tf-priority', t.priority)}</div>
    <div class="three"><label>Starts<input type="time" data-tf="startTime" value="${t.startTime}"></label><label>Finish by<input type="time" data-tf="endTime" value="${t.endTime}"></label><label>Minutes<input type="number" min="0" data-tf="minutes" value="${t.minutes || ''}" placeholder="${S.budgetMs(t, k) / 60000}"></label></div>
    <label>Notes<textarea data-tf="notes" rows="3" placeholder="Details, links, thoughts…">${esc(t.notes)}</textarea></label>
    <div class="field"><span class="flabel">Checklist ${t.subtasks.length ? `· ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}` : ''}</span>
      <div class="subs">${t.subtasks.map(s => `<div class="sub${s.done ? ' done' : ''}"><button type="button" class="check sm${s.done ? ' on' : ''}" data-act="sub" data-sid="${s.id}" aria-label="Toggle">${ic('check', 12)}</button><span>${esc(s.text)}</span><button type="button" class="ibtn ghosty xs" data-act="sub-rm" data-sid="${s.id}" aria-label="Remove">${ic('x', 12)}</button></div>`).join('')}
      <div class="sub add"><input id="subNew" placeholder="Add a step and press Enter" autocomplete="off"><button type="button" class="ibtn" data-act="sub-add" aria-label="Add step">${ic('plus', 15)}</button></div></div></div>
    <div class="row-wrap acts">
      <button type="button" class="btn ${t.done ? 'ghost' : ''}" data-act="toggle" data-ref="${k}|${id}">${ic('check', 15)} ${t.done ? 'Mark not done' : 'Complete'}</button>
      <button type="button" class="pill" data-act="dup" data-ref="${k}|${id}">${ic('copy', 14)} Duplicate</button>
      <button type="button" class="pill" data-act="to-tomorrow" data-ref="${k}|${id}">${ic('right', 14)} ${k === todayKey() ? 'Tomorrow' : 'Next day'}</button>
      <label class="pill date-pill">${ic('calendar', 14)} Move to<input type="date" data-act-change="move-day" value="${k}"></label>
      <button type="button" class="pill danger" data-act="delete" data-ref="${k}|${id}">${ic('trash', 14)} Delete</button>
    </div>
    <p class="mut small">Changes save automatically.</p></form>`);
}

function reviewButtons(k, id) {
  return `<div class="review-box"><p><b>Time's up.</b> Did you finish it?</p><div class="row-wrap"><button type="button" class="btn ok" data-act="rv" data-o="done" data-ref="${k}|${id}">${ic('check', 15)} Done</button><button type="button" class="btn ghost" data-act="rv" data-o="notdone" data-ref="${k}|${id}">Not done</button><button type="button" class="btn ghost" data-act="rv" data-o="tomorrow" data-ref="${k}|${id}">Move to tomorrow</button><button type="button" class="pill" data-act="extend" data-ref="${k}|${id}" data-m="15">Need 15 more min</button></div></div>`;
}

function refreshTaskSheet() { if (tm && sheetOpen() && $('#taskForm')) taskSheet(tm.k, tm.id); }

function planSheet(text = '', k = todayKey(), at = '') {
  sheet(`<form id="planForm" class="sheet-card" data-k="${k}"><div class="sheet-h"><h2>Plan a task</h2><button type="button" class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>${planFields(text, k, at)}</form>`);
}

function tplSheet(k = todayKey()) {
  sheet(`<form id="tplForm" class="sheet-card" data-k="${k}"><div class="sheet-h"><h2>Save as template</h2><button type="button" class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
    <p class="mut">Saves ${relDay(k).toLowerCase()}'s ${day(k).tasks.length} tasks. Pick days to apply it automatically every week.</p>
    <input name="name" class="big-input" placeholder="e.g. Revision day" required autocomplete="off">
    <div class="field"><span class="flabel">Repeat on</span><div class="days">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label class="dayck"><input type="checkbox" name="day" value="${i}"><span>${WD[i][0]}</span></label>`).join('')}</div></div>
    <button class="btn" type="submit">${ic('check', 16)} Save template</button></form>`);
}

function useTplSheet(k) {
  sheet(`<div class="sheet-card"><div class="sheet-h"><h2>Use a template</h2><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
    ${getState().templates.map(t => `<div class="li"><div><b>${esc(t.name)}</b><small>${t.tasks.map(x => esc(x.text)).slice(0, 4).join(' · ')}${t.tasks.length > 4 ? '…' : ''}</small></div><div class="row"><button class="pill" data-act="apply-tpl" data-id="${t.id}" data-k="${k}">Apply</button><button class="ibtn ghosty" data-act="tpl-rm" data-id="${t.id}" aria-label="Delete template">${ic('trash', 15)}</button></div></div>`).join('')}</div>`);
}

// ---------- search / command palette ----------
const COMMANDS = [
  ['Go to Today', 'home', () => go('today'), 'today'], ['Go to Plan', 'calendar', () => go('plan'), 'plan'], ['Go to Focus', 'timer', () => go('focus'), 'focus'],
  ['Go to Habits', 'repeat', () => go('habits'), 'habits'], ['Go to Insights', 'chart', () => go('insights'), 'insights'], ['Go to Journal', 'book', () => go('journal'), 'journal'],
  ['Go to Goals', 'target', () => go('goals'), 'goals'], ['Go to History', 'clock', () => go('history'), 'history'], ['Go to Profile', 'user', () => go('profile'), 'profile'],
  ['New task', 'plus', () => planSheet(), 'add create'], ['New habit', 'repeat', () => sheet(habitSheet()), 'add'], ['New goal', 'target', () => sheet(goalSheet()), 'add'],
  ['Start / pause focus timer', 'play', () => { if (view !== 'focus') go('focus'); pomoToggle(); }, 'pomodoro'],
  ['Export PDF report', 'download', () => openReport(), 'print review'], ['Export JSON backup', 'download', () => exportJson(), 'backup'],
  ['Export CSV', 'download', () => download(`better-me-tasks-${todayKey()}.csv`, '﻿' + S.exportCSV(), 'text/csv'), 'spreadsheet excel'],
  ['Export calendar (.ics)', 'calendar', () => download('better-me.ics', S.exportICS(addDays(todayKey(), -30), addDays(todayKey(), 60)), 'text/calendar'), 'google outlook'],
  ['Toggle dark mode', 'moon', () => toggleTheme(), 'theme light'], ['Open settings', 'gear', () => settingsSheet(), 'preferences'],
  ['Keyboard shortcuts', 'key', () => shortcutsSheet(), 'help'], ["What's new", 'gift', () => whatsNew(), 'features'], ['Lock app now', 'lock', () => lockNow(), 'pin privacy']
];

function results() {
  const ql = q.toLowerCase();
  const cmds = COMMANDS.map((c, i) => ({ c, i })).filter(({ c }) => !ql || (c[0] + ' ' + c[3]).toLowerCase().includes(ql)).slice(0, ql ? 6 : 10);
  const items = cmds.map(({ c, i }) => `<button class="cmd" data-act="cmd" data-i="${i}">${ic(c[1], 16)}<span>${esc(c[0])}</span></button>`);
  if (ql) {
    const s = getState(), out = [];
    for (const k of Object.keys(s.days).sort().reverse()) {
      const d = s.days[k];
      for (const t of d.tasks) if ((t.text + ' ' + t.notes + ' ' + t.area).toLowerCase().includes(ql)) out.push(`<button class="cmd" data-act="hit-task" data-ref="${k}|${t.id}">${ic(t.done ? 'check' : 'list', 16)}<span>${esc(t.text)}</span><small>${fmt(k)} · ${esc(t.area)}</small></button>`);
      if ((d.reflection + ' ' + d.note).toLowerCase().includes(ql)) out.push(`<button class="cmd" data-act="jopen" data-k="${k}">${ic('book', 16)}<span>Journal</span><small>${fmt(k)}</small></button>`);
      if (out.length > 40) break;
    }
    for (const h of s.habits) if (h.name.toLowerCase().includes(ql)) out.push(`<button class="cmd" data-act="go" data-v="habits">${esc(h.icon)}<span>${esc(h.name)}</span><small>Habit</small></button>`);
    for (const g of s.longGoals) if (g.title.toLowerCase().includes(ql)) out.push(`<button class="cmd" data-act="go" data-v="goals">${ic('target', 16)}<span>${esc(g.title)}</span><small>Goal</small></button>`);
    items.push(...out);
    if (!items.length) return `<p class="mut pad">No matches. Press Enter to add “${esc(q)}” as a task.</p>`;
  }
  return items.join('');
}

function searchSheet() {
  q = ''; cmdIndex = 0;
  sheet(`<div class="sheet-card palette"><div class="pal-in">${ic('search', 20)}<input id="gsearch" placeholder="Search tasks, journal, or type a command…" autocomplete="off" aria-label="Search"><kbd>Esc</kbd></div><div id="sresults" class="cmds">${results()}</div></div>`, 'top');
  hiCmd();
}
function hiCmd() { const els = $$('#sresults .cmd'); els.forEach((e, i) => e.classList.toggle('hi', i === cmdIndex)); els[cmdIndex]?.scrollIntoView({ block: 'nearest' }); }

// ---------- settings ----------
const SETTINGS = [
  ['appearance', 'Appearance', 'palette', s => `${ACCENTS[s.settings.accent]?.name} · ${{ system: 'Auto', light: 'Light', dark: 'Dark' }[s.settings.theme]}`],
  ['categories', 'Categories & weekly goals', 'flag', () => `${getAreas().length} areas`],
  ['planning', 'Planning & templates', 'calendar', s => `${s.templates.length} templates · ${s.rules.length} recurring`],
  ['focus', 'Focus timer & sound', 'timer', s => `${s.settings.pomo.work}/${s.settings.pomo.short} min`],
  ['reminders', 'Reminders & alerts', 'bell', s => s.settings.reminder || 'Off'],
  ['feedback', 'Sounds & haptics', 'music', s => (s.settings.sound ? 'Sound on' : 'Muted')],
  ['privacy', 'Privacy & app lock', 'lock', s => (s.settings.lockHash ? 'PIN on' : 'Off')],
  ['data', 'Data, export & backup', 'download', () => `${(S.bytes() / 1024).toFixed(0)} KB`],
  ['shortcuts', 'Keyboard shortcuts', 'key', () => ''],
  ['about', 'About & what\'s new', 'gift', () => 'v' + VERSION],
  ['account', 'Account', 'user', () => (S.isGuest() ? 'Guest' : 'Signed in')]
];

function settingsSheet(sec = null) {
  settingsSection = sec;
  const s = getState();
  if (!sec) {
    sheet(`<div class="sheet-card"><div class="sheet-h"><h2>Settings</h2><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
      <div class="setlist">${SETTINGS.map(([id, l, icn, v]) => `<button class="setrow" data-act="settings" data-sec="${id}"><span class="si">${ic(icn, 18)}</span><span class="sl">${l}</span><span class="sv">${esc(v(s))}</span>${ic('right', 16)}</button>`).join('')}</div></div>`, 'wide');
    return;
  }
  sheet(`<div class="sheet-card"><div class="sheet-h"><button class="btn ghost sm" data-act="settings">${ic('left', 15)} Settings</button><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>${settingsBody(sec)}</div>`, 'wide');
}

function settingsBody(sec) {
  const s = getState(), st = s.settings;
  const sw = (label, path, on, sub = '') => `<label class="switch"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-set="${path}" ${on ? 'checked' : ''}><i></i></label>`;
  switch (sec) {
    case 'appearance': return `<h2>Appearance</h2>
      <div class="field"><span class="flabel">Mode</span><div class="seg">${[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" data-set="theme" value="${v}" ${st.theme === v ? 'checked' : ''}><span>${ic(v === 'dark' ? 'moon' : v === 'light' ? 'sun' : 'eye', 15)} ${l}</span></label>`).join('')}</div></div>
      <div class="field"><span class="flabel">Accent</span><div class="accents">${Object.entries(ACCENTS).map(([id, x]) => `<label data-tip="${x.name}"><input type="radio" name="accent" data-set="accent" value="${id}" ${st.accent === id ? 'checked' : ''}><span style="background:linear-gradient(135deg,${x.a},${x.b})"></span><small>${x.name}</small></label>`).join('')}</div></div>
      <div class="field"><span class="flabel">Background</span><div class="seg">${Object.entries(BGS).map(([v, l]) => `<label><input type="radio" name="bg" data-set="bg" value="${v}" ${st.bg === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <div class="field"><span class="flabel">Density</span><div class="seg">${[['comfy', 'Comfortable'], ['compact', 'Compact']].map(([v, l]) => `<label><input type="radio" name="density" data-set="density" value="${v}" ${st.density === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <label class="range">Text size <b>${Math.round(st.fontScale * 100)}%</b><input type="range" min="0.85" max="1.25" step="0.05" value="${st.fontScale}" data-set="fontScale" data-num></label>
      ${sw('Reduce motion', 'motion', st.motion === 'reduced', 'Fewer animations, no parallax')}
      ${sw('High contrast', 'contrast', st.contrast, 'Stronger borders and text')}
      ${sw('12-hour clock', 'hour12', st.hour12)}
      ${sw('Celebrate wins with confetti', 'confetti', st.confetti)}`;
    case 'categories': return `<h2>Categories</h2><p class="mut">Rename by editing. Colours show on tasks, charts and the PDF.</p>
      ${getAreas().map((a, i) => `<div class="area-edit"><input type="color" value="${colorFor(a)}" data-area-color="${esc(a)}" aria-label="Colour for ${esc(a)}"><input value="${esc(a)}" data-area-name="${esc(a)}" aria-label="Category name"><input type="number" min="0" step="15" placeholder="min/wk" value="${s.goals[a] || ''}" data-goal="${esc(a)}" aria-label="Weekly goal minutes" data-tip="Weekly goal in minutes"><button class="ibtn ghosty" data-act="area-rm" data-i="${i}" aria-label="Remove">${ic('trash', 15)}</button></div>`).join('')}
      <form class="area-add" id="areaAdd"><input name="n" placeholder="New category" autocomplete="off"><button class="btn sm">${ic('plus', 14)} Add</button></form>`;
    case 'planning': return `<h2>Planning</h2>
      <label>Default task length (minutes)<input type="number" min="5" max="480" value="${st.defaultMinutes}" data-set="defaultMinutes" data-num></label>
      <div class="field"><span class="flabel">Week starts on</span><div class="seg">${[[1, 'Monday'], [0, 'Sunday']].map(([v, l]) => `<label><input type="radio" name="ws" data-set="weekStart" data-num value="${v}" ${st.weekStart === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <p class="kicker mt">Templates</p>${s.templates.map(t => `<div class="li"><div><b>${esc(t.name)}</b><small>${t.tasks.length} tasks${t.schedule?.length ? ' · ' + t.schedule.map(i => WD[i]).join(' ') : ''}</small></div><button class="ibtn ghosty" data-act="tpl-rm" data-id="${t.id}" aria-label="Delete">${ic('trash', 15)}</button></div>`).join('') || '<p class="mut">None yet. Save a day from Today or Plan.</p>'}
      <p class="kicker mt">Recurring tasks</p>${s.rules.map(r => `<div class="li"><div><b>${esc(r.text)}</b><small>${r.days.map(i => WD[i]).join(' ')}</small></div><button class="ibtn ghosty" data-act="rule-rm" data-id="${r.id}" aria-label="Delete">${ic('trash', 15)}</button></div>`).join('') || '<p class="mut">None yet.</p>'}`;
    case 'focus': return `<h2>Focus timer</h2><div class="two">${[['work', 'Focus minutes'], ['short', 'Short break'], ['long', 'Long break'], ['every', 'Long break every']].map(([f, l]) => `<label>${l}<input type="number" min="1" max="180" value="${st.pomo[f]}" data-set="pomo.${f}" data-num></label>`).join('')}</div>
      ${sw('Start breaks automatically', 'pomo.autoBreak', st.pomo.autoBreak)}
      <label>Default soundscape when focusing<select data-set="ambient">${Object.entries(AMBIENTS).map(([v, l]) => `<option value="${v}" ${st.ambient === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    case 'reminders': return `<h2>Reminders & alerts</h2>
      <label>Daily planning reminder<input type="time" value="${st.reminder}" data-set="reminder"></label>
      ${sw('Alert when a task starts or needs review', 'taskAlerts', st.taskAlerts)}
      <button class="btn ghost" data-act="notify-perm">${ic('bell', 15)} ${'Notification' in window && Notification.permission === 'granted' ? 'Notifications allowed ✓' : 'Allow notifications'}</button>
      <p class="mut small">Alerts arrive while Better Me is open or installed. On iPhone, add it to the Home Screen first (Share → Add to Home Screen).</p>`;
    case 'feedback': return `<h2>Sounds & haptics</h2>${sw('Sounds', 'sound', st.sound)}${sw('Haptics (vibration)', 'haptics', st.haptics, 'On supported phones')}<button class="pill" data-act="test-sound">Test</button>`;
    case 'privacy': return `<h2>Privacy & app lock</h2><p class="mut">A 4-digit PIN hides your data when the app opens on this or any synced device.</p>
      ${st.lockHash ? `<div class="row-wrap"><button class="btn ghost" data-act="lock-now">${ic('lock', 15)} Lock now</button><button class="btn ghost danger" data-act="lock-off">Turn off PIN</button></div>` : `<form id="pinForm" class="row-wrap"><input name="pin" inputmode="numeric" pattern="\\d{4}" maxlength="4" placeholder="4-digit PIN" required autocomplete="off" class="pin-in"><button class="btn">${ic('lock', 15)} Set PIN</button></form>`}
      <p class="mut small">Your data is protected by your account and row-level security in the database. The PIN is a privacy screen on top.</p>`;
    case 'data': {
      const kb = (S.bytes() / 1024).toFixed(1), pct = Math.min(100, S.bytes() / (5 * 1024 * 1024) * 100);
      return `<h2>Data & export</h2>
      <button class="btn big-btn" data-act="report">${ic('download', 18)} <span><b>PDF review report</b><small>Choose a period · themed · every detail</small></span></button>
      <div class="exp-grid"><button class="btn ghost" data-act="exp-json">${ic('download', 15)} JSON backup</button><button class="btn ghost" data-act="exp-csv">${ic('download', 15)} CSV (Excel)</button><button class="btn ghost" data-act="exp-ics">${ic('calendar', 15)} Calendar .ics</button><label class="btn ghost">${ic('upload', 15)} Import backup<input type="file" accept="application/json,.json" id="importFile" class="sr-only"></label></div>
      <p class="kicker mt">Storage on this device</p><div class="bar thick"><b style="width:${pct}%"></b></div><p class="mut small">${kb} KB of ~5 MB local cache. Photos are resized to keep this small.</p>
      ${(s.printLog || []).length ? `<p class="kicker mt">Reports created</p><div class="list">${s.printLog.slice(0, 8).map(l => `<div class="li"><div><b>${new Date(l.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</b><small>${esc(l.from || '')} → ${esc(l.to || '')}${l.summary ? ' · ' + esc(l.summary) : ''}</small></div></div>`).join('')}</div>` : ''}`;
    }
    case 'shortcuts': return shortcutsHtml();
    case 'about': return `<h2>Better Me ${VERSION}</h2>${whatsNewHtml()}`;
    case 'account': return `<h2>Account</h2><div class="kv"><span>Mode</span><b>${S.isGuest() ? 'Guest — stored on this device' : 'Signed in — synced'}</b>${user?.email ? `<span>Email</span><b>${esc(user.email)}</b>` : ''}<span>Sync</span><b id="syncTxt">${syncText}</b></div>
      ${S.isGuest() ? `<a class="btn" href="lab.html?from=guest">${ic('cloud', 15)} Create account & sync</a>` : `<button class="btn ghost" data-act="sync-now">${ic('repeat', 15)} Sync now</button>`}
      ${installEvt ? `<button class="btn ghost" data-act="install">${ic('download', 15)} Install app</button>` : ''}
      <button class="btn ghost danger" data-act="signout">${ic('logout', 15)} ${S.isGuest() ? 'Leave guest mode' : 'Sign out'}</button>`;
  }
  return '';
}

const SHORTCUTS = [['⌘/Ctrl K or /', 'Search & commands'], ['N', 'New task'], ['1 – 9', 'Switch views'], ['Space', 'Start/pause focus (on Focus)'], ['Z', 'Zen mode'], ['E', 'Export PDF report'], ['T', 'Toggle dark mode'], [',', 'Settings'], ['?', 'This list'], ['Esc', 'Close sheet']];
const shortcutsHtml = () => `<h2>Keyboard shortcuts</h2><div class="kbds">${SHORTCUTS.map(([k, l]) => `<div><kbd>${k}</kbd><span>${l}</span></div>`).join('')}</div>`;
function shortcutsSheet() { sheet(`<div class="sheet-card"><div class="sheet-h"><span></span><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>${shortcutsHtml()}</div>`); }

const NEW_FEATURES = [
  ['sparkle', 'Brand-new design', 'Aurora backgrounds, glass cards, hover spotlights, fluid animations, desktop sidebar + tablet + phone layouts.'],
  ['download', 'PDF review report', 'Pick any period: profile, app icon, theme, performance score, charts, algorithms, usage, every task and reflection.'],
  ['chart', 'Performance score', 'A composite score with grade, weekly trend, consistency index and comparison with the previous period.'],
  ['edit', 'Natural-language add', '“Gym 6-7am tomorrow #Personal !high” fills time, day, category and priority.'],
  ['layout', 'Day timeline', 'See the day as time blocks, tap an hour to plan there, overlaps side by side.'],
  ['timer', 'Pomodoro focus', 'Focus/break cycles that survive reloads, attach to a task, log sessions.'],
  ['music', 'Soundscapes', 'Rain, ocean, brown/pink/white noise generated live while you focus.'],
  ['expand', 'Zen mode', 'Full-screen breathing timer for deep work.'],
  ['repeat', 'Habit tracker', 'Daily habits with streaks, weekly grid and 30-day rate.'],
  ['sun', 'Mood & energy check-in', 'Track mood, energy, sleep and water; see the correlation with output.'],
  ['book', 'Journal', 'Reflections, three good things and notes for any day, with history.'],
  ['target', 'Long-term goals', 'Goals with deadlines, reasons and milestones.'],
  ['list', 'Checklists & notes', 'Break tasks into steps; add notes and priority.'],
  ['calendar', 'Recurring tasks', 'Repeat a task on chosen weekdays automatically.'],
  ['sparkle', 'Levels, XP & 16 badges', 'Every task, habit and reflection earns XP.'],
  ['gift', 'Daily surprise', 'A fact about you, mined from your own data, on Today.'],
  ['search', 'Command palette', '⌘K to search everything and run any action from the keyboard.'],
  ['palette', '9 accents, 4 backgrounds', 'Auto/light/dark, density, text size, high contrast, reduced motion.'],
  ['lock', 'App lock PIN', 'A privacy screen when the app opens.'],
  ['upload', 'Import, CSV & calendar export', 'Restore backups, open in Excel, add plans to Google/Outlook calendar.'],
  ['user', 'Guest mode', 'Use it instantly without an account; move your data in when you sign up.'],
  ['bell', 'Smart alerts', 'Notifications when tasks start, finish, or a focus session ends.']
];
const whatsNewHtml = () => `<div class="feat">${NEW_FEATURES.map(([i, t, d]) => `<div>${ic(i, 18)}<span><b>${t}</b><small>${d}</small></span></div>`).join('')}</div>`;
function whatsNew() { S.markSeen(); sheet(`<div class="sheet-card"><div class="sheet-h"><div><p class="kicker">Better Me ${VERSION}</p><h2>Rebuilt from the ground up</h2></div><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>${whatsNewHtml()}<button class="btn" data-close>Let's go</button></div>`, 'wide'); }

// ---------- onboarding ----------
let ob = { step: 0, name: '', accent: 'ember', areas: [] };
function onboard() {
  const st = ob.step;
  const SUG = ['Academic', 'Personal Intelligence', 'Monetization', 'Reflection', 'Health', 'Work', 'Creative', 'Family', 'Faith', 'Fitness'];
  if (!ob.areas.length) ob.areas = [...getAreas()];
  const body = [
    `<p class="kicker">Welcome to Better Me</p><h2 class="ob-h">Let's make your days count.</h2><p class="mut">Plan, focus, track habits and see how you are really doing. Takes 20 seconds to set up.</p><label>What should we call you?<input id="obName" value="${esc(ob.name || getState().profile.name)}" placeholder="Your name" autocomplete="given-name"></label>`,
    `<p class="kicker">Make it yours</p><h2 class="ob-h">Pick a colour.</h2><div class="accents big">${Object.entries(ACCENTS).map(([id, x]) => `<label><input type="radio" name="obacc" value="${id}" ${ob.accent === id ? 'checked' : ''}><span style="background:linear-gradient(135deg,${x.a},${x.b})"></span><small>${x.name}</small></label>`).join('')}</div>`,
    `<p class="kicker">Your life areas</p><h2 class="ob-h">What do you work on?</h2><p class="mut">Pick up to 8. You can rename them later.</p><div class="chips wrap">${[...new Set([...SUG, ...ob.areas])].map(a => `<label class="chip"><input type="checkbox" name="obarea" value="${esc(a)}" ${ob.areas.includes(a) ? 'checked' : ''}><span>${esc(a)}</span></label>`).join('')}</div>`
  ][st];
  sheet(`<div class="sheet-card onboard"><div class="ob-dots">${[0, 1, 2].map(i => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>${body}<div class="row-between"><button class="btn ghost" data-act="ob-back" ${st ? '' : 'style="visibility:hidden"'}>Back</button><button class="btn" data-act="ob-next">${st === 2 ? 'Start' : 'Next'} ${ic('right', 15)}</button></div></div>`, 'center');
}
function obCollect() {
  if (ob.step === 0) ob.name = $('#obName')?.value || '';
  if (ob.step === 1) { ob.accent = $('input[name=obacc]:checked')?.value || 'ember'; getState().settings.accent = ob.accent; applyTheme(); }
  if (ob.step === 2) ob.areas = $$('input[name=obarea]:checked').map(i => i.value).slice(0, 8);
}

// ---------- report ----------
function defaultReportOpt() {
  const t = todayKey();
  return { preset: '30', from: addDays(t, -29), to: t, title: '', sections: Object.keys(SECTIONS), look: 'theme', paper: 'a4', orientation: 'portrait', journalInline: false };
}
function openReport() {
  reportOpt ||= defaultReportOpt();
  track('PDF report');
  const o = reportOpt;
  const first = Object.keys(getState().days).sort()[0] || todayKey();
  sheet(`<div class="sheet-card report"><div class="sheet-h"><div><p class="kicker">Export</p><h2>Your review document</h2></div><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div>
    <div class="rep-grid">
      <form id="repForm" class="rep-opts">
        <div class="field"><span class="flabel">Period</span><div class="seg wrap">${[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['month', 'This month'], ['365', '1 year'], ['all', 'All time'], ['custom', 'Custom']].map(([v, l]) => `<label><input type="radio" name="preset" value="${v}" ${o.preset === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="two"><label>From<input type="date" name="from" value="${o.from}" min="${first < o.from ? first : o.from}" max="${todayKey()}"></label><label>To<input type="date" name="to" value="${o.to}"></label></div>
        <label>Title<input name="title" value="${esc(o.title)}" placeholder="My days, reviewed."></label>
        <div class="field"><span class="flabel">Look</span><div class="seg">${[['theme', 'My theme'], ['print', 'Print-friendly']].map(([v, l]) => `<label><input type="radio" name="look" value="${v}" ${o.look === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="two"><label>Paper<select name="paper"><option value="a4" ${o.paper === 'a4' ? 'selected' : ''}>A4</option><option value="letter" ${o.paper === 'letter' ? 'selected' : ''}>Letter</option></select></label>
        <label>Orientation<select name="orientation"><option value="portrait" ${o.orientation === 'portrait' ? 'selected' : ''}>Portrait</option><option value="landscape" ${o.orientation === 'landscape' ? 'selected' : ''}>Landscape</option></select></label></div>
        <details class="more" open><summary>Sections · ${o.sections.length}/${Object.keys(SECTIONS).length}</summary><div class="secs">${Object.entries(SECTIONS).map(([id, l]) => `<label class="ck"><input type="checkbox" name="sec" value="${id}" ${o.sections.includes(id) ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          <label class="ck"><input type="checkbox" name="jinline" ${o.journalInline ? 'checked' : ''}><span>Show reflections inside the daily log</span></label></div></details>
        <div class="rep-acts">
          <button type="button" class="btn" data-act="rep-pdf" id="repPdf">${ic('download', 16)} Download PDF</button>
          <button type="button" class="btn ghost" data-act="rep-print">${ic('printer', 16)} Print / Save as PDF</button>
          ${navigator.canShare ? `<button type="button" class="btn ghost" data-act="rep-share">${ic('share', 16)} Share</button>` : ''}
        </div>
        <div class="progress" id="repProg" hidden><b></b><span>Building…</span></div>
      </form>
      <div class="rep-prev"><div class="prev-wrap" id="prevWrap"><iframe id="repFrame" title="Report preview"></iframe></div></div>
    </div></div>`, 'full');
  buildPreview();
}

function readReportForm() {
  const f = $('#repForm');
  if (!f) return;
  const fd = new FormData(f), t = todayKey(), o = reportOpt;
  const preset = fd.get('preset');
  o.preset = preset;
  if (preset !== 'custom') {
    const first = Object.keys(getState().days).sort()[0] || t;
    o.to = t;
    o.from = preset === 'all' ? first : preset === 'month' ? t.slice(0, 8) + '01' : addDays(t, -(Number(preset) - 1));
    f.from.value = o.from; f.to.value = o.to;
  } else { o.from = fd.get('from') || o.from; o.to = fd.get('to') || o.to; if (o.from > o.to) [o.from, o.to] = [o.to, o.from]; }
  o.title = fd.get('title') || '';
  o.look = fd.get('look'); o.paper = fd.get('paper'); o.orientation = fd.get('orientation');
  o.sections = fd.getAll('sec');
  o.journalInline = !!fd.get('jinline');
  const sum = f.querySelector('.more summary'); if (sum) sum.textContent = `Sections · ${o.sections.length}/${Object.keys(SECTIONS).length}`;
}

let lastReport = null;
function buildPreview() {
  const fr = $('#repFrame');
  if (!fr) return;
  lastReport = buildReport({ ...reportOpt, advice: A.advice(), email: user?.email || '' });
  fr.style.width = lastReport.width + 'px';
  fr.onload = () => fitPreview();
  fr.srcdoc = lastReport.html;
}
function fitPreview() {
  const fr = $('#repFrame'), wrap = $('#prevWrap');
  if (!fr || !wrap || !lastReport) return;
  const doc = fr.contentDocument;
  const h = doc?.documentElement.scrollHeight || 1200;
  fr.style.height = h + 'px';
  const sc = Math.min(1, wrap.clientWidth / lastReport.width);
  fr.style.transform = `scale(${sc})`;
  wrap.style.height = h * sc + 'px';
}
addEventListener('resize', () => { if ($('#repFrame')) fitPreview(); });

const loaded = {};
function loadScript(src) {
  return loaded[src] ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); });
}

async function makePdf() {
  const btn = $('#repPdf'), prog = $('#repProg');
  if (!btn || btn.disabled) return null;
  btn.disabled = true; prog.hidden = false;
  try {
    await Promise.all([loadScript('vendor/jspdf.umd.min.js'), loadScript('vendor/html2canvas.min.js')]);
    const name = `Better-Me-review-${reportOpt.from}-to-${reportOpt.to}.pdf`;
    const blob = await downloadPdf($('#repFrame'), reportOpt, name, p => { prog.querySelector('b').style.width = p + '%'; prog.querySelector('span').textContent = p < 100 ? `Building… ${p}%` : 'Done'; });
    S.logPrint({ doc: 'report', from: reportOpt.from, to: reportOpt.to, orientation: reportOpt.orientation, sections: reportOpt.sections, theme: reportOpt.look, summary: lastReport?.summary });
    return { blob, name };
  } catch (e) {
    console.error(e);
    toast('PDF could not be built here. Use “Print / Save as PDF” instead.');
    return null;
  } finally { btn.disabled = false; setTimeout(() => { if (prog) prog.hidden = true; }, 1200); }
}

// ---------- lock ----------
async function hashPin(pin) {
  const data = new TextEncoder().encode(`bm|${S.userId()}|${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function lockNow() { sessionStorage.removeItem('bm:unlocked'); sheet(''); showLock(); }
function showLock() {
  const el = $('#lock');
  let pin = '';
  el.hidden = false;
  el.innerHTML = `<div class="lock-c">${avatarHtml(72)}<h2>Welcome back${getState().profile.name ? ', ' + esc(getState().profile.name.split(' ')[0]) : ''}</h2><p class="mut">Enter your PIN</p><div class="pin-dots"><i></i><i></i><i></i><i></i></div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(n => (n === '' ? '<span></span>' : `<button data-k="${n}">${n}</button>`)).join('')}</div><button class="link" id="forgotPin">Forgot PIN?</button></div>`;
  const dots = () => el.querySelectorAll('.pin-dots i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const tryPin = async () => {
    if (await hashPin(pin) === getState().settings.lockHash) { sessionStorage.setItem('bm:unlocked', '1'); el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); el.innerHTML = ''; }, 350); play('save'); document.removeEventListener('keydown', kd, true); }
    else { el.querySelector('.pin-dots').classList.add('shake'); play('cancel'); setTimeout(() => { pin = ''; dots(); el.querySelector('.pin-dots')?.classList.remove('shake'); }, 450); }
  };
  const press = k => { if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k; dots(); buzz(); if (pin.length === 4) tryPin(); };
  el.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => press(b.dataset.k); });
  const kd = e => { if (el.hidden) return; if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); e.stopPropagation(); } else if (e.key === 'Backspace') { press('⌫'); e.preventDefault(); e.stopPropagation(); } };
  document.addEventListener('keydown', kd, true);
  el.querySelector('#forgotPin').onclick = () => {
    if (S.isGuest()) { if (confirm('Remove the PIN? Your data stays.')) { S.setSetting('lockHash', ''); el.hidden = true; } }
    else { localStorage.setItem('bm:pinreset', '1'); signOut(); }
  };
}

// ---------- celebrations ----------
function confetti(n = 140) {
  if (!getState().settings.confetti || !motionOK()) return;
  const c = $('#confetti'), x = c.getContext('2d');
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  const st = getComputedStyle(document.documentElement);
  const cols = [st.getPropertyValue('--acc'), st.getPropertyValue('--acc2'), '#18b26b', '#f5a524', '#7c5cff', '#1fa9d6'];
  const ps = Array.from({ length: n }, () => ({ x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3, y: c.height * 0.35, vx: (Math.random() - 0.5) * 22 * devicePixelRatio, vy: (-Math.random() * 18 - 6) * devicePixelRatio, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 }));
  const t0 = performance.now();
  c.hidden = false;
  (function frame() {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.6 * devicePixelRatio; p.vx *= 0.985; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r * devicePixelRatio * 0.6); x.restore(); }
    if (performance.now() - t0 < 2600) requestAnimationFrame(frame); else { x.clearRect(0, 0, c.width, c.height); c.hidden = true; }
  })();
}

function checkLevel() {
  const lv = A.level().lvl;
  if (lastLevel && lv > lastLevel) { play('level'); confetti(200); toast(`${ic('sparkle', 14)} Level ${lv}! Keep going.`, null, true); }
  lastLevel = lv;
  for (const id of A.earnedBadges()) if (S.unlockBadge(id)) {
    const b = A.BADGES.find(x => x.id === id);
    if (ready && b) setTimeout(() => toast(`${b.icon} Badge unlocked: <b>${esc(b.name)}</b>`, null, true), 600);
  }
}

function afterComplete(k) {
  const d = day(k);
  if (d.tasks.length >= 2 && d.tasks.every(t => t.done)) { setTimeout(() => { confetti(); toast(`${ic('sparkle', 14)} Every task done. What a day.`, null, true); play('level'); }, 250); }
  checkLevel();
}

// ---------- notifications ----------
async function notify(body, tag = 'bm') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { const reg = await navigator.serviceWorker?.ready; if (reg) return reg.showNotification('Better Me', { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' }); } catch { /* */ }
  try { new Notification('Better Me', { body }); } catch { /* */ }
}

function checkReminder() {
  const s = getState(), r = s.settings.reminder;
  if (!r) return;
  const now = new Date(), hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, today = todayKey();
  if (hhmm >= r && s.lastReminder !== today && hhmm < r.replace(/^(\d\d)/, h => pad(Math.min(23, +h + 1)))) {
    S.markReminded(today);
    notify('Time to plan the day and check off what you finished.', 'daily');
  }
}

// ---------- live updates ----------
const busy = () => sheetOpen() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || drag || swipe;
let tickN = 0;
function liveTick() {
  if (!ready) return;
  pomoTick();
  $$('[data-live]').forEach(el => { const [k, id] = el.dataset.live.split('|'); const t = S.findTask(k, id); if (t) el.textContent = fmtRemain(t, k); });
  $$('[data-until]').forEach(el => { const [k, h] = el.dataset.until.split('|'); el.textContent = untilText(k, h); });
  if (tm && $('#clock')) { const t = S.findTask(tm.k, tm.id); if (t) $('#clock').textContent = fmtRemain(t, tm.k); }
  if (++tickN % 5 === 0) {
    const { started, ended } = S.tickTasks();
    if (started.length || ended.length) {
      pendingRender = true;
      const st = getState().settings;
      for (const { t } of started) { if (st.taskAlerts) notify(`Starting now: ${t.text}`, 'start-' + t.id); if (!document.hidden) toast(`▶ Started: ${t.text}`); }
      for (const { t } of ended) { if (st.taskAlerts) notify(`Time's up: ${t.text}. Did you finish?`, 'end-' + t.id); if (!document.hidden) { play('chime'); toast(`⏰ Time's up: ${t.text}`); } }
      if (tm) refreshTaskSheet();
    }
    if (pendingRender && !busy()) { pendingRender = false; render(); }
  }
  if (tickN % 60 === 0) { if (!document.hidden) S.trackMinute(); checkReminder(); }
}

// ================= ACTIONS =================
const ref = el => (el.dataset.ref || '').split('|');
const ACT = {
  go: el => go(el.dataset.v),
  more: () => sheet(`<div class="sheet-card"><div class="sheet-h"><h2>More</h2><button class="ibtn" data-close aria-label="Close">${ic('x', 18)}</button></div><div class="more-grid">${NAV.map(([id, l, i]) => `<button class="mg" data-act="go" data-v="${id}">${ic(i, 22)}<span>${l}</span></button>`).join('')}<button class="mg" data-act="report">${ic('download', 22)}<span>Export PDF</span></button><button class="mg" data-act="settings">${ic('gear', 22)}<span>Settings</span></button><button class="mg" data-act="search">${ic('search', 22)}<span>Search</span></button></div></div>`),
  search: () => searchSheet(),
  settings: el => settingsSheet(el?.dataset?.sec || null),
  report: () => openReport(),
  toggle: el => {
    const [k, id] = ref(el);
    const done = S.toggleTask(k, id);
    play(done ? 'complete' : 'tap'); track('Complete task');
    const row = el.closest('.task');
    if (row && done && motionOK()) { row.classList.add('pop'); setTimeout(() => { render(); refreshTaskSheet(); }, 260); }
    else { render(); refreshTaskSheet(); }
    if (done) afterComplete(k);
  },
  'open-task': el => { const [k, id] = ref(el); taskSheet(k, id); },
  'hit-task': el => { const [k, id] = ref(el); if (k !== todayKey()) { planDay = k; view = 'plan'; render(true); } taskSheet(k, id); },
  timer: el => { const [k, id] = ref(el); const t = S.findTask(k, id); if (t?.status === 'running' && !isPaused(t)) taskSheet(k, id); else { S.startFocus(k, id); play('save'); track('Task timer'); render(); toast(`▶ ${t?.text}`); } },
  start: el => { const [k, id] = ref(el); S.startFocus(k, id); play('save'); render(); refreshTaskSheet(); },
  pause: el => { const [k, id] = ref(el); S.pauseFocus(k, id); play('tap'); render(); refreshTaskSheet(); },
  extend: el => { const [k, id] = ref(el); S.extendTask(k, id, Number(el.dataset.m)); play('save'); toast(`Added ${el.dataset.m} minutes`); render(); refreshTaskSheet(); },
  review: el => { const [k, id] = ref(el); taskSheet(k, id); },
  rv: el => { const [k, id] = ref(el); const o = el.dataset.o; S.reviewTask(k, id, o); play(o === 'done' ? 'complete' : 'cancel'); sheet(''); toast(o === 'done' ? 'Marked done' : o === 'tomorrow' ? 'Moved to tomorrow' : 'Marked not done'); render(); if (o === 'done') afterComplete(k); },
  dup: el => { const [k, id] = ref(el); S.duplicateTask(k, id); play('save'); toast('Duplicated'); sheet(''); render(); },
  'to-tomorrow': el => { const [k, id] = ref(el); S.moveToDay(k, id, addDays(k, 1)); play('save'); sheet(''); toast(`Moved to ${relDay(addDays(k, 1)).toLowerCase()}`); render(); },
  delete: el => { const [k, id] = ref(el); const r = S.removeTask(k, id); play('cancel'); sheet(''); toast('Task deleted', () => S.restoreTask(k, r)); render(); },
  sub: el => { const t = S.toggleSub(tm.k, tm.id, el.dataset.sid); play('tap'); refreshTaskSheet(); if (t?.subtasks.every(s => s.done) && !t.done) toast('All steps done — complete the task?'); render(); },
  'sub-rm': el => { const t = S.findTask(tm.k, tm.id); S.updateTask(tm.k, tm.id, { subtasks: t.subtasks.filter(s => s.id !== el.dataset.sid) }); refreshTaskSheet(); },
  'sub-add': () => addSub(),
  filter: el => { taskFilter = el.dataset.f; render(); },
  rollover: el => { const k = el.dataset.k, n = S.moveOpen(k, addDays(k, 1)); play('save'); toast(`Moved ${n} task${n === 1 ? '' : 's'} to tomorrow`); render(); },
  'tpl-sheet': el => tplSheet(el.dataset.k || (view === 'plan' ? planDay : todayKey())),
  'use-tpl-sheet': el => useTplSheet(el.dataset.k),
  'apply-tpl': el => { const n = S.applyTemplate(el.dataset.id, el.dataset.k); play('save'); toast(`Added ${n} task${n === 1 ? '' : 's'}`); sheet(''); render(); },
  'tpl-rm': el => { S.deleteTemplate(el.dataset.id); play('cancel'); settingsSection ? settingsSheet(settingsSection) : sheet(''); render(); },
  'rule-rm': el => { S.deleteRule(el.dataset.id); play('cancel'); toast('Stopped repeating. Existing tasks stay.'); if (settingsSection) settingsSheet(settingsSection); render(); },
  'plan-sheet': () => planSheet($('#quick')?.value || '', view === 'plan' ? planDay : todayKey()),
  'plan-at': el => planSheet('', el.dataset.k, el.dataset.t),
  'plan-day': el => { planDay = el.dataset.k; go('plan'); },
  'plan-mode': el => { planMode = el.dataset.m; render(); },
  'pick-day': el => { planDay = el.dataset.k; render(); },
  week: el => { planDay = addDays(planDay, Number(el.dataset.d)); render(); },
  suggest: el => {
    const f = el.closest('form'); const k = f.day.value || todayKey();
    const slot = suggestSlot(k, Number(f.minutes.value) || 30, k === todayKey());
    if (slot) { f.start.value = slot; toast(`Suggested ${fmtTime(slot)} — a free slot near your peak hours`); play('tap'); } else toast('No free slot left on that day.');
  },
  habit: el => { const on = S.toggleHabit(el.dataset.k, el.dataset.id); play(on ? 'complete' : 'tap'); track('Habit check'); render(); if (on) checkLevel(); },
  'habit-sheet': el => sheet(habitSheet(el.dataset.id)),
  'habit-quick': el => { const [icon, ...n] = el.dataset.v.split(' '); S.addHabit({ name: n.join(' '), icon }); play('save'); render(); },
  'habit-rm': el => { if (!confirm('Delete this habit and its history?')) return; S.deleteHabit(el.dataset.id); sheet(''); play('cancel'); render(); },
  mood: el => { S.setMood(todayKey(), { mood: Number(el.dataset.v) }); play('tap'); track('Mood check-in'); render(); },
  energy: el => { S.setMood(todayKey(), { energy: Number(el.dataset.v) }); play('tap'); render(); },
  well: el => { const k = todayKey(), f = el.dataset.f, cur = getState().wellness[k]?.[f] || 0; S.setWellness(k, { [f]: Math.max(0, Math.min(f === 'sleep' ? 16 : 20, cur + Number(el.dataset.d))) }); play('tap'); render(); },
  'hide-fact': () => { sessionStorage.setItem('bm:factHidden', '1'); render(); },
  range: el => { insightRange = Number(el.dataset.r); render(); },
  jday: el => { journalDay = addDays(journalDay, Number(el.dataset.d)); if (journalDay > todayKey()) journalDay = todayKey(); render(); },
  jopen: el => { journalDay = el.dataset.k; go('journal'); },
  month: el => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(el.dataset.d), 1); render(); },
  cal: el => { calSel = el.dataset.k; render(); },
  'goal-sheet': () => sheet(goalSheet()),
  'goal-rm': el => { if (!confirm('Delete this goal?')) return; S.deleteLongGoal(el.dataset.id); play('cancel'); render(); },
  ms: el => { const g = S.toggleMilestone(el.dataset.id, el.dataset.m); play('tap'); render(); if (g?.doneAt) { confetti(220); play('level'); toast(`🎯 Goal achieved: ${esc(g.title)}`, null, true); checkLevel(); } },
  'ms-rm': el => { S.removeMilestone(el.dataset.id, el.dataset.m); render(); },
  'pomo-toggle': () => pomoToggle(),
  'pomo-reset': () => { pomo.endAt = null; pomo.left = null; savePomo(); play('tap'); render(); },
  'pomo-skip': () => { pomoNext(false); play('tap'); render(); },
  'pomo-mode': el => { pomo.mode = el.dataset.m; pomo.endAt = null; pomo.left = null; savePomo(); render(); },
  ambient: el => { const v = el.dataset.v; S.setSetting('ambient', v); if (v === 'off') stopAmbient(); else ambient(v, getState().settings.ambientVol); track('Soundscape'); render(); },
  zen: () => zen(),
  'zen-toggle': () => { pomoToggle(); const b = $('.zen [data-act=zen-toggle]'); if (b) b.innerHTML = ic(pomo.endAt ? 'pause' : 'play', 28); },
  'zen-exit': () => { $('.zen')?.remove(); if (document.fullscreenElement) document.exitFullscreen?.(); },
  cmd: el => { const c = COMMANDS[Number(el.dataset.i)]; sheet(''); setTimeout(() => c[2](), 10); track('Command palette'); },
  'area-rm': el => { const a = getAreas()[Number(el.dataset.i)]; if (!confirm(`Remove “${a}”? Tasks keep their label.`)) return; if (S.removeArea(a)) play('cancel'); else toast('Keep at least one category.'); settingsSheet('categories'); render(); },
  'notify-perm': async () => { if (!('Notification' in window)) return toast('Notifications are not supported on this device.'); const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notifications on' : 'Notifications are blocked in your browser settings'); settingsSheet(settingsSection); },
  'test-sound': () => play('level'),
  'lock-now': () => lockNow(),
  'lock-off': () => { S.setSetting('lockHash', ''); toast('PIN removed'); settingsSheet('privacy'); },
  'exp-json': () => exportJson(),
  'exp-csv': () => { download(`better-me-tasks-${todayKey()}.csv`, '﻿' + S.exportCSV(), 'text/csv'); track('CSV export'); },
  'exp-ics': () => { download('better-me.ics', S.exportICS(addDays(todayKey(), -30), addDays(todayKey(), 90)), 'text/calendar'); track('Calendar export'); toast('Open the file to add your timed tasks to your calendar'); },
  'sync-now': async () => { toast('Syncing…'); const ok = await S.reloadRemote(); toast(ok ? 'Up to date' : 'Could not reach the server; changes are safe on this device'); render(); },
  install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; },
  signout: () => { if (S.isGuest() && !confirm('Leave guest mode? Your guest data stays on this device and can be moved into an account later.')) return; signOut(); },
  'photo-rm': () => { S.setPhoto(''); render(); },
  'ob-next': () => { obCollect(); if (ob.step < 2) { ob.step++; onboard(); } else { S.setOnboarded({ name: ob.name, areas: ob.areas.length ? ob.areas : null, accent: ob.accent }); sheet(''); render(true); play('level'); confetti(); setTimeout(() => toast('You are set. Add your first task above.'), 600); } },
  'ob-back': () => { obCollect(); ob.step = Math.max(0, ob.step - 1); onboard(); },
  'rep-pdf': async () => { readReportForm(); const r = await makePdf(); if (r) { download(r.name, r.blob); play('complete'); toast('PDF downloaded'); } },
  'rep-print': () => {
    readReportForm(); track('Print report');
    const fr = $('#repFrame');
    S.logPrint({ doc: 'report-print', from: reportOpt.from, to: reportOpt.to, orientation: reportOpt.orientation, sections: reportOpt.sections, theme: reportOpt.look, summary: lastReport?.summary });
    try { fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch { const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print.'); w.document.write(lastReport.html); w.document.close(); setTimeout(() => w.print(), 400); }
  },
  'rep-share': async () => {
    readReportForm(); const r = await makePdf(); if (!r) return;
    const file = new File([r.blob], r.name, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'My Better Me review' }); } catch { /* cancelled */ } }
    else download(r.name, r.blob);
  },
  'guest-merge': () => { const g = S.guestData(); if (g) { const n = S.mergeIn(g.raw); S.discardGuest(); toast(`Moved ${n} tasks into your account`); play('complete'); } sheet(''); render(); },
  'guest-skip': () => { S.discardGuest(); sheet(''); }
};

function exportJson() { download(`better-me-backup-${todayKey()}.json`, S.exportJSON(), 'application/json'); track('JSON backup'); toast('Backup downloaded'); }

function addSub() {
  const inp = $('#subNew'), v = inp?.value.trim();
  if (!v || !tm) return;
  const t = S.findTask(tm.k, tm.id);
  S.updateTask(tm.k, tm.id, { subtasks: [...t.subtasks, { id: S.uuid(), text: v, done: false }] });
  play('tap'); refreshTaskSheet(); render();
  setTimeout(() => $('#subNew')?.focus(), 90);
}

function toggleTheme() {
  const cur = resolveMode(getState().settings.theme);
  S.setSetting('theme', cur === 'dark' ? 'light' : 'dark');
  applyTheme(); play('tap');
}

document.addEventListener('click', e => {
  const t = e.target;
  if (t === sh || t.closest('[data-close]')) { if (sheetOpen()) { sheet(''); play('tap'); } return; }
  const a = t.closest('[data-act]');
  if (a && ACT[a.dataset.act] && !a.disabled) { e.preventDefault(); ACT[a.dataset.act](a, e); return; }
});

// ---------- forms ----------
document.addEventListener('submit', e => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement)) return;
  e.preventDefault();
  const fd = new FormData(f);

  if (f.id === 'quickForm') {
    const raw = String(fd.get('text') || '').trim();
    if (!raw) return;
    const base = f.dataset.base || todayKey();
    const p = parseQuick(raw, getAreas());
    if (!p.text) return toast('Add a few words describing the task.');
    const k = addDays(base, p.dayOffset);
    const area = p.area || getState().lastArea;
    S.addTask(k, p.text, area, p.minutes || (p.start ? getState().settings.defaultMinutes : 0), p.start, p.end, false, { priority: p.priority, tags: p.tags });
    if (p.area) S.setLastArea(p.area);
    play('save'); track('Quick add');
    toast(`Added${k !== base ? ' to ' + relDay(k).toLowerCase() : ''}${p.start ? ' at ' + fmtTime(p.start) : ''}`);
    f.reset(); $('#qpreview').innerHTML = '';
    render();
    setTimeout(() => $('#quick')?.focus(), 30);
    return;
  }
  if (f.id === 'planForm') {
    const text = String(fd.get('text') || '').trim();
    const startNow = e.submitter?.value === 'now';
    const k = String(fd.get('day') || f.dataset.k || todayKey());
    const start = String(fd.get('start') || ''), end = String(fd.get('end') || '');
    if (!text) return toast('Name the task first.');
    if (end && start && end <= start) return toast('Finish time must be after the start time.');
    const area = String(fd.get('area') || getState().lastArea);
    const priority = Number(fd.get('priority') || 0);
    const subtasks = String(fd.get('subs') || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => ({ id: S.uuid(), text: x, done: false }));
    const rep = fd.getAll('rep').map(Number);
    S.setLastArea(area);
    if (rep.length) {
      S.addRule({ text, area, minutes: fd.get('minutes'), startTime: start, endTime: end, priority, days: rep });
      S.applyScheduled(todayKey());
      if (k !== todayKey()) S.applyScheduled(k);
      toast(`Repeats every ${rep.length === 7 ? 'day' : rep.map(i => WD[i]).join(', ')}`);
    } else {
      const t = S.addTask(k, text, area, fd.get('minutes'), start, end, startNow && k === todayKey(), { priority, notes: String(fd.get('notes') || ''), subtasks });
      if (!t) return;
      toast(startNow ? '▶ Started' : `Planned for ${relDay(k).toLowerCase()}${start ? ' at ' + fmtTime(start) : ''}`);
    }
    play('save'); track('Plan task');
    sheet('');
    if (view === 'plan') planDay = k;
    render();
    if (f.closest('.plan-form')) setTimeout(() => $('#planText')?.focus(), 30);
    return;
  }
  if (f.id === 'profileForm') {
    S.saveProfile(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
    play('save'); toast('Profile saved'); render(); return;
  }
  if (f.id === 'tplForm') {
    if (!S.saveTemplate(String(fd.get('name') || ''), f.dataset.k, fd.getAll('day').map(Number))) return toast('Add tasks to the day first, then name the template.');
    play('save'); toast('Template saved'); sheet(''); render(); return;
  }
  if (f.id === 'habitForm') {
    const data = { name: String(fd.get('name') || '').trim(), icon: fd.get('icon') || '✨', color: fd.get('color'), days: fd.getAll('days').map(Number) };
    if (!data.name) return;
    if (!data.days.length) return toast('Pick at least one day.');
    if (f.dataset.id) S.updateHabit(f.dataset.id, data); else S.addHabit(data);
    play('save'); toast(f.dataset.id ? 'Habit updated' : 'Habit created'); sheet(''); render(); return;
  }
  if (f.id === 'goalForm') {
    const g = S.addLongGoal({ title: fd.get('title'), why: fd.get('why'), due: fd.get('due'), area: fd.get('area') });
    if (!g) return;
    String(fd.get('ms') || '').split('\n').map(x => x.trim()).filter(Boolean).forEach(m => S.addMilestone(g.id, m));
    play('save'); toast('Goal created'); sheet(''); render(); return;
  }
  if (f.classList.contains('msadd')) { S.addMilestone(f.dataset.id, fd.get('m')); play('tap'); render(); setTimeout(() => $(`.msadd[data-id="${f.dataset.id}"] input`)?.focus(), 30); return; }
  if (f.id === 'areaAdd') { if (S.addArea(String(fd.get('n') || ''))) play('save'); else toast('Empty, taken, or 12 categories already.'); settingsSheet('categories'); render(); return; }
  if (f.id === 'pinForm') {
    const pin = String(fd.get('pin') || '');
    if (!/^\d{4}$/.test(pin)) return toast('Use exactly 4 digits.');
    hashPin(pin).then(h => { S.setSetting('lockHash', h); sessionStorage.setItem('bm:unlocked', '1'); toast('PIN set. The app will ask for it when it opens.'); play('save'); settingsSheet('privacy'); });
  }
});

// ---------- inputs ----------
let repDeb = null;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'reflect') { S.setDayField(todayKey(), 'reflection', t.value); return; }
  if (t.id === 'intention') { S.setDayField(todayKey(), 'intention', t.value); return; }
  if (t.classList.contains('grat')) { S.setGratitude(t.dataset.k, Number(t.dataset.i), t.value); return; }
  if (t.dataset.jf) { S.setDayField(journalDay, t.dataset.jf, t.value); const d = day(journalDay); const c = $('#jcount'); if (c) c.textContent = `${(d.reflection + ' ' + d.note).split(/\s+/).filter(Boolean).length} words · saved`; return; }
  if (t.id === 'quick') {
    const p = parseQuick(t.value, getAreas());
    const base = t.form?.dataset.base || todayKey();
    const desc = t.value.trim() ? describe(p, n => relDay(addDays(base, n))) : '';
    $('#qpreview').innerHTML = desc ? `${ic('sparkle', 13)} <b>${esc(p.text || '…')}</b> · ${esc(desc)} <kbd>Enter</kbd>` : '';
    return;
  }
  if (t.id === 'gsearch') { q = t.value.trim(); cmdIndex = 0; $('#sresults').innerHTML = results(); hiCmd(); return; }
  if (t.id === 'ambVol') { S.setSetting('ambientVol', Number(t.value)); ambientVolume(Number(t.value)); return; }
  if (t.dataset.tf && tm && ['text', 'notes'].includes(t.dataset.tf)) { S.updateTask(tm.k, tm.id, { [t.dataset.tf]: t.value }); pendingRender = true; return; }
  if (t.closest('#repForm')) { clearTimeout(repDeb); repDeb = setTimeout(() => { readReportForm(); buildPreview(); }, t.type === 'text' ? 500 : 150); return; }
  if (t.dataset.set === 'fontScale') { S.setSetting('fontScale', Number(t.value)); applyTheme(); const b = t.closest('.range')?.querySelector('b'); if (b) b.textContent = Math.round(t.value * 100) + '%'; }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.set) {
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if ('num' in t.dataset) v = Number(v);
    if (t.dataset.set === 'motion') v = t.checked ? 'reduced' : 'full';
    if (t.dataset.set === 'reminder') S.setReminder(v); else S.setSetting(t.dataset.set, v);
    if (t.dataset.set === 'sound') sounds.on = v;
    if (t.dataset.set === 'haptics') haptics.on = v;
    applyTheme(); play('tap'); track('Change setting');
    if (['theme', 'accent', 'bg', 'density'].includes(t.dataset.set)) render();
    if (t.dataset.set.startsWith('pomo.') && !pomo.endAt) { pomo.left = null; savePomo(); if (view === 'focus' && !sheetOpen()) render(); }
    return;
  }
  if (t.closest('#taskForm') && tm) {
    if (t.name === 'tf-area') S.updateTask(tm.k, tm.id, { area: t.value });
    else if (t.name === 'tf-priority') S.updateTask(tm.k, tm.id, { priority: Number(t.value) });
    else if (t.dataset.tf === 'startTime' || t.dataset.tf === 'endTime') {
      const cur = S.findTask(tm.k, tm.id), patch = { [t.dataset.tf]: t.value };
      const s = t.dataset.tf === 'startTime' ? t.value : cur.startTime, en = t.dataset.tf === 'endTime' ? t.value : cur.endTime;
      if (s && en && en <= s) { toast('Finish time must be after the start.'); t.value = cur[t.dataset.tf]; return; }
      S.updateTask(tm.k, tm.id, patch);
    } else if (t.dataset.tf === 'minutes') S.updateTask(tm.k, tm.id, { minutes: Number(t.value) || 0 });
    else if (t.dataset.actChange === 'move-day' && t.value) { if (S.moveToDay(tm.k, tm.id, t.value)) { toast(`Moved to ${relDay(t.value).toLowerCase()}`); sheet(''); render(); } return; }
    play('tap'); pendingRender = true;
    return;
  }
  if (t.dataset.goal !== undefined) { S.setGoal(t.dataset.goal, t.value); play('tap'); return; }
  if (t.dataset.areaColor) { S.setAreaColor(t.dataset.areaColor, t.value); render(); return; }
  if (t.dataset.areaName !== undefined) { if (!S.renameArea(t.dataset.areaName, t.value)) toast('That name is empty or taken.'); else play('save'); settingsSheet('categories'); render(); return; }
  if (t.id === 'pomoTask') { pomo.ref = t.value; savePomo(); return; }
  if (t.id === 'jdate') { journalDay = t.value || todayKey(); render(); return; }
  if (t.id === 'photo' && t.files[0]) { try { S.setPhoto(await shrink(t.files[0])); play('save'); toast('Photo updated'); render(); } catch { toast('That image could not be read.'); } return; }
  if (t.id === 'importFile' && t.files[0]) {
    try {
      const raw = JSON.parse(await t.files[0].text());
      if (!raw || typeof raw !== 'object' || !raw.days) throw new Error('bad');
      const replace = confirm('Replace everything with this backup?\n\nOK = replace all  ·  Cancel = merge (keep both)');
      if (replace) S.replaceAll(raw); else S.mergeIn(raw);
      toast(replace ? 'Backup restored' : 'Backup merged'); play('complete'); sheet(''); render(true);
    } catch { toast('That file is not a Better Me backup.'); }
    return;
  }
  if (t.closest('#repForm')) { readReportForm(); buildPreview(); }
});

async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const r = Math.min(1, 320 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    const side = Math.min(img.width, img.height);
    c.width = c.height = Math.round(Math.min(320, side));
    // Square crop from the centre.
    c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, c.width, c.height);
    void r;
    return c.toDataURL('image/jpeg', 0.84);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;
  if (!$('#lock').hidden) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchSheet(); return; }
  if (e.key === 'Escape') { if ($('.zen')) { ACT['zen-exit'](); return; } if (sheetOpen()) { sheet(''); return; } }
  if (e.target.id === 'gsearch') {
    const n = $$('#sresults .cmd').length;
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdIndex = Math.min(n - 1, cmdIndex + 1); hiCmd(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdIndex = Math.max(0, cmdIndex - 1); hiCmd(); }
    else if (e.key === 'Enter') { e.preventDefault(); const el = $$('#sresults .cmd')[cmdIndex]; if (el) el.click(); else if (q) { S.addTask(todayKey(), q, getState().lastArea); toast('Added to today'); sheet(''); render(); } }
    return;
  }
  if (e.target.id === 'subNew' && e.key === 'Enter') { e.preventDefault(); addSub(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (sheetOpen()) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); searchSheet(); }
  else if (/^[1-9]$/.test(k)) go(NAV[Number(k) - 1][0]);
  else if (k === 'n' || k === 'N') { e.preventDefault(); if ($('#quick')) $('#quick').focus(); else planSheet(); }
  else if (k === ' ' && view === 'focus') { e.preventDefault(); pomoToggle(); }
  else if (k === 'z' || k === 'Z') zen();
  else if (k === 'e' || k === 'E') openReport();
  else if (k === 't' || k === 'T') toggleTheme();
  else if (k === ',') settingsSheet();
  else if (k === '?') shortcutsSheet();
});

// ---------- gestures: swipe, drag, pull ----------
document.addEventListener('touchstart', e => {
  const row = e.target.closest('.task[data-id]');
  if (row && !e.target.closest('[data-grip]') && !drag && !sheetOpen()) swipe = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lock: null };
  else swipe = null;
  if (window.scrollY <= 0 && !swipe && !drag && !sheetOpen() && !S.isGuest()) pull = { y: e.touches[0].clientY, dy: 0 }; else pull = null;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (swipe) {
    const dx = e.touches[0].clientX - swipe.x, dy = e.touches[0].clientY - swipe.y;
    if (swipe.lock == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) swipe.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (swipe.lock !== 'x') return;
    swipe.dx = dx;
    swipe.row.style.transform = `translateX(${dx}px)`;
    swipe.row.classList.toggle('sw-done', dx > 50);
    swipe.row.classList.toggle('sw-del', dx < -50);
    return;
  }
  if (pull) {
    pull.dy = Math.max(0, e.touches[0].clientY - pull.y);
    const el = $('#ptr');
    el.style.transform = `translate(-50%, ${Math.min(pull.dy, 120) * 0.6 - 50}px) rotate(${pull.dy * 3}deg)`;
    el.style.opacity = Math.min(1, pull.dy / 80);
  }
}, { passive: true });

document.addEventListener('touchend', async () => {
  if (swipe) {
    const { row, dx, lock } = swipe; swipe = null;
    row.style.transform = ''; row.classList.remove('sw-done', 'sw-del');
    if (lock === 'x') {
      const k = row.dataset.key, id = row.dataset.id;
      if (dx > 100) { const done = S.toggleTask(k, id); play(done ? 'complete' : 'tap'); render(); if (done) afterComplete(k); }
      else if (dx < -100) { const r = S.removeTask(k, id); play('cancel'); toast('Task deleted', () => S.restoreTask(k, r)); render(); }
    }
  }
  if (pull) {
    const goPull = pull.dy > 90; pull = null;
    const el = $('#ptr'); el.style.transform = ''; el.style.opacity = '';
    if (goPull) { el.classList.add('spin'); buzz(); await S.reloadRemote(); S.applyScheduled(todayKey()); render(); el.classList.remove('spin'); toast('Up to date'); }
  }
});

document.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-grip]');
  if (!g) return;
  e.preventDefault();
  const row = g.closest('.task'), [k, id] = g.dataset.grip.split('|');
  drag = { k, id, row, startY: e.clientY, moved: false };
  row.classList.add('lifting');
  g.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (drag) { const dy = e.clientY - drag.startY; if (Math.abs(dy) > 4) drag.moved = true; drag.row.style.transform = `translateY(${dy}px) scale(1.02)`; return; }
  spotlight(e);
});
function endDrag(e) {
  if (!drag) return;
  const { k, id, row, moved } = drag; drag = null;
  row.classList.remove('lifting'); row.style.transform = '';
  if (!moved || !e) return;
  const sibs = [...row.parentElement.querySelectorAll('.task')].filter(r => r !== row);
  const above = sibs.filter(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2 < e.clientY; }).length;
  S.moveTask(k, id, above); buzz(); render();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', () => endDrag(null));

// ---------- hover: spotlight + tooltips ----------
let spotRaf = 0;
function spotlight(e) {
  if (e.pointerType !== 'mouse' || spotRaf) return;
  spotRaf = requestAnimationFrame(() => {
    spotRaf = 0;
    const c = e.target.closest?.('.card, .tile, .btn, .nav-i');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}
const tip = $('#tip');
document.addEventListener('mouseover', e => {
  const el = e.target.closest?.('[data-tip], [data-tip-r]');
  if (!el || matchMedia('(hover: none)').matches) return;
  const side = el.dataset.tipR != null && document.body.classList.contains('narrow-side');
  tip.textContent = el.dataset.tip || el.dataset.tipR;
  if (!tip.textContent || (el.dataset.tipR != null && !side)) return;
  const r = el.getBoundingClientRect();
  tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  if (side) { tip.style.left = r.right + 10 + 'px'; tip.style.top = r.top + r.height / 2 - th / 2 + 'px'; }
  else { tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px'; tip.style.top = (r.top - th - 8 < 4 ? r.bottom + 8 : r.top - th - 8) + 'px'; }
  tip.classList.add('on');
});
document.addEventListener('mouseout', e => { if (e.target.closest?.('[data-tip], [data-tip-r]')) { tip.classList.remove('on'); tip.hidden = true; } });
document.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

// ---------- sync status ----------
let syncText = 'Saved';
S.onSync(s => {
  syncText = { saving: 'Saving…', saved: 'All changes saved', offline: 'Offline — saved on this device', error: 'Sync failed — will retry', local: 'Saved on this device' }[s] || '';
  $$('.sync').forEach(el => { el.dataset.s = s; el.title = syncText; });
  const st = $('#syncTxt'); if (st) st.textContent = syncText;
  $$('.sync-l').forEach(el => { el.textContent = syncText; });
});
addEventListener('offline', () => { toast('You are offline. Everything keeps working and syncs later.'); });
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

// ================= BOOT =================
(async () => {
  $('#defs').innerHTML = defs();
  $$('[data-ic]').forEach(i => { i.innerHTML = ic(i.dataset.ic, Number(i.dataset.s) || 20); });
  const sideMQ = matchMedia('(min-width: 900px) and (max-width: 1199px)');
  const setNarrow = () => document.body.classList.toggle('narrow-side', sideMQ.matches);
  sideMQ.addEventListener?.('change', setNarrow); setNarrow();

  user = await requireUser();
  if (!user) return;
  await S.load(user.id);
  if (!S.isGuest() && localStorage.getItem('bm:pinreset')) { S.setSetting('lockHash', ''); localStorage.removeItem('bm:pinreset'); }
  const st = getState().settings;
  sounds.on = st.sound; haptics.on = st.haptics ?? true;
  if (user.email && !getState().profile.email) getState().profile.email = user.email;
  loadPomo();
  S.applyScheduled(todayKey());
  S.tickTasks();
  S.trackOpen();
  const hv = location.hash.slice(1);
  view = VIEWS[hv] ? hv : 'today';
  S.trackView(view);
  ready = true;
  lastLevel = A.level().lvl;
  for (const id of A.earnedBadges()) S.unlockBadge(id);
  document.body.classList.add('ready');
  $('#boot')?.remove();
  render(true);
  $('#userCard').innerHTML = `${avatarHtml(34)}<div><b>${esc(getState().profile.name || 'You')}</b><small><i class="sync" data-s="saved"></i><span class="sync-l">${S.isGuest() ? 'Saved on this device' : 'All changes saved'}</span></small></div>`;

  if (st.lockHash && !sessionStorage.getItem('bm:unlocked')) showLock();
  if (!getState().onboarded) onboard();
  else if (!S.isGuest() && S.guestData()) {
    const g = S.guestData();
    sheet(`<div class="sheet-card"><h2>Bring your guest data?</h2><p class="mut">This device has ${g.tasks} tasks from guest mode. Move them into your account so they sync everywhere.</p><div class="row-wrap"><button class="btn" data-act="guest-merge">${ic('upload', 15)} Move into my account</button><button class="btn ghost" data-act="guest-skip">Discard</button></div></div>`, 'center');
  } else if (getState().seenVersion !== VERSION) whatsNew();

  setInterval(liveTick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { S.flushNow(); return; }
    tickN = 4; liveTick();
    if (!S.isGuest() && !sheetOpen()) S.reloadRemote().then(ok => { if (ok && !busy()) render(); });
  });
  addEventListener('pagehide', () => S.flushNow());
  checkReminder();
})();
