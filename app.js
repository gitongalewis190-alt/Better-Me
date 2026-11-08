import { CONFIG, VERSION, load, save, getState, day, todayKey, addTask, toggleTask, removeTask, moveOpen, bytes } from './src/store.js';
import { AREAS, dayPct, streak, areaStats, weekdayStats, advice } from './src/analytics.js';
import { promptFor } from './src/prompts.js';
import { play, sounds } from './src/sound.js';

const $ = s => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sh = $('#sheet');
const app = $('#view');
let tab = 'home', viewDate = todayKey(), q = '', openDay = null;

const fmtDate = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

function applyTheme() { document.documentElement.dataset.theme = getState().settings.theme; }

function avatar() {
  const p = getState().profile;
  $('#avatar').innerHTML = p.photo ? `<img src="${p.photo}" alt="">` : esc((p.name || 'B')[0].toUpperCase());
}

function ring(pct) {
  const r = 18, c = 2 * Math.PI * r, v = pct ?? 0;
  return `<svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${r}" class="track"/><circle cx="22" cy="22" r="${r}" class="fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/></svg>`;
}

function taskRow(key, t) {
  return `<div class="task ${t.done ? 'done' : ''}"><label><input type="checkbox" data-toggle="${key}|${t.id}" ${t.done ? 'checked' : ''}><span class="tx">${esc(t.text)}</span></label><span class="meta">${esc(t.area)}${t.minutes ? ` · ${t.minutes}m` : ''}</span><button class="x" data-remove="${key}|${t.id}" aria-label="Remove task">×</button></div>`;
}

function bars(rows) {
  return rows.map(r => `<div class="bar-row"><span>${r.name}</span><div class="bar"><b style="width:${r.pct ?? 0}%"></b></div><span>${r.pct == null ? '–' : r.pct + '%'}</span></div>`).join('');
}

function home() {
  const k = todayKey(), d = day(k), pct = dayPct(d), p = getState().profile;
  const open = d.tasks.filter(t => !t.done).length;
  const tomorrow = todayKey(new Date(Date.now() + 86400000));
  return `
  <section class="hero"><p class="eyebrow">${fmtDate(k)}</p><h1>${p.name ? `Hi, ${esc(p.name)}` : 'Today'}</h1>
    <p class="sub">${d.tasks.length ? `${d.tasks.length - open} of ${d.tasks.length} complete` : 'Plan your day below.'}</p></section>
  <div class="card row"><input id="quick" placeholder="Quick add a task, then press Enter" autocomplete="off"></div>
  <section class="card"><div class="card-h"><h2>Today's SOPs</h2>${ring(pct)}</div>
    ${d.tasks.length ? d.tasks.map(t => taskRow(k, t)).join('') : '<p class="empty">Nothing planned yet.</p>'}
  </section>
  <section class="card prompt"><p class="eyebrow">Reflection</p><p>${esc(promptFor(k))}</p>
    <textarea id="reflect" class="reflect" rows="3" placeholder="Write it honestly.">${esc(d.reflection)}</textarea></section>
  ${open && pct < 100 ? `<button class="ghost" data-rollover="${k}" data-to="${tomorrow}">Move ${open} open task${open > 1 ? 's' : ''} to tomorrow</button>` : ''}`;
}

function newView() {
  return `<section class="hero"><p class="eyebrow">New SOP</p><h1>Plan a day</h1></section>
  <form id="newForm" class="card stack">
    <label>Date<input type="date" name="date" value="${viewDate}" required></label>
    <label>Area<select name="area">${AREAS.map(a => `<option>${a}</option>`).join('')}</select></label>
    <label>Task<input name="text" required placeholder="What will you do?" autocomplete="off"></label>
    <label>Minutes planned<input name="minutes" type="number" min="0" inputmode="numeric" placeholder="30"></label>
    <button class="primary">Save SOP</button>
  </form>`;
}

function progress() {
  const s = getState(), cells = [];
  for (let i = 34; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const k = todayKey(dt), p = dayPct(s.days[k]);
    cells.push(`<i class="cell" style="--a:${p == null ? 0.12 : Math.max(0.2, p / 100)}" title="${k}${p == null ? '' : ' · ' + p + '%'}"></i>`);
  }
  return `<section class="hero"><p class="eyebrow">Progress</p><h1>${streak()} day streak</h1><p class="sub">Last 35 days</p></section>
  <section class="card"><div class="heat">${cells.join('')}</div></section>
  <section class="card"><h2>By area</h2>${bars(areaStats())}</section>
  <section class="card"><h2>Weekday rhythm</h2>${bars(weekdayStats())}</section>
  <section class="card advice"><h2>Advice</h2>${advice().map(a => `<p>${esc(a)}</p>`).join('')}</section>`;
}

function history() {
  const s = getState();
  const keys = Object.keys(s.days).filter(k => s.days[k].tasks.length).sort().reverse();
  const items = keys.filter(k => !q || s.days[k].tasks.some(t => t.text.toLowerCase().includes(q)) || s.days[k].reflection.toLowerCase().includes(q));
  const detail = openDay && s.days[openDay]
    ? `<section class="card"><div class="card-h"><h2>${fmtDate(openDay)}</h2>${ring(dayPct(s.days[openDay]))}</div>${s.days[openDay].tasks.map(t => taskRow(openDay, t)).join('')}</section>`
    : '';
  return `<section class="hero"><p class="eyebrow">History</p><h1>Your record</h1></section>
  <div class="card row"><input id="search" placeholder="Search tasks and reflections" value="${esc(q)}" autocomplete="off"></div>
  ${detail}
  ${items.map(k => `<button class="card day" data-open="${k}"><span>${fmtDate(k)}</span><span class="muted">${s.days[k].tasks.filter(t => t.done).length}/${s.days[k].tasks.length}</span></button>`).join('') || '<p class="empty">No matching days.</p>'}`;
}

function profileView() {
  const p = getState().profile;
  return `<section class="hero"><p class="eyebrow">Profile</p><h1>You</h1></section>
  <form id="profileForm" class="card stack">
    <label>Name<input name="name" value="${esc(p.name)}"></label>
    <label>Age<input name="age" inputmode="numeric" value="${esc(p.age)}"></label>
    <label>Phone<input name="phone" type="tel" value="${esc(p.phone)}"></label>
    <label>Bio<textarea name="bio" rows="3">${esc(p.bio)}</textarea></label>
    <label>Photo<input name="photo" type="file" accept="image/*"></label>
    <button class="primary">Save profile</button>
  </form>`;
}

const views = { home, progress, new: newView, history, profile: profileView };

function render() {
  applyTheme();
  avatar();
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  app.innerHTML = views[tab]();
  window.scrollTo({ top: 0 });
}

function sheet(html) {
  sh.innerHTML = html;
  sh.classList.toggle('open', !!html);
}

function settingsSheet() {
  const s = getState();
  const pct = Math.min(100, bytes() / (500 * 1024 * 1024) * 100);
  return `<div class="sheet-card"><div class="card-h"><h2>Settings</h2><button class="ghost" style="width:auto" data-close>Done</button></div>
    <p class="eyebrow">Theme</p>
    <div class="seg"><button data-theme-set="light" class="${s.settings.theme === 'light' ? 'on' : ''}">Light</button><button data-theme-set="dark" class="${s.settings.theme === 'dark' ? 'on' : ''}">Dark</button></div>
    <label class="switch"><span>Sounds</span><input type="checkbox" data-sound ${s.settings.sound ? 'checked' : ''}></label>
    <p class="eyebrow" style="margin-top:18px">Storage</p>
    <div class="bar"><b style="width:${pct}%"></b></div>
    <p class="muted">${(bytes() / 1024).toFixed(1)} KB used of 500 MB (Supabase free plan) · ${CONFIG.supabaseUrl ? 'Sync on' : 'Local only'}</p>
    <p class="muted" style="margin-top:18px">Better Me v${VERSION}</p></div>`;
}

function printSheet() {
  const keys = Object.keys(getState().days).sort();
  return `<form id="printForm" class="sheet-card stack"><div class="card-h"><h2>Print</h2><button type="button" class="ghost" style="width:auto" data-close>Cancel</button></div>
    <label>Document<select name="doc"><option value="sops">SOP history</option><option value="progress">Progress report</option><option value="profile">Profile</option></select></label>
    <label>From<input type="date" name="from" value="${keys[0] || todayKey()}"></label>
    <label>To<input type="date" name="to" value="${todayKey()}"></label>
    <label>Orientation<select name="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    <label>Font<select name="font"><option value="system">System</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
    <label>Colour<select name="color"><option value="color">Colour</option><option value="bw">Black and white</option></select></label>
    <label class="switch"><span>Include reflections</span><input type="checkbox" name="reflect" checked></label>
    <button class="primary">Open print preview</button>
    <p class="muted">In the print dialog, choose "Save as PDF" to export.</p></form>`;
}

function printDoc(f) {
  const s = getState(), p = s.profile;
  const from = f.get('from') || '0000-01-01', to = f.get('to') || '9999-12-31';
  const fam = { system: '-apple-system,Helvetica,Arial,sans-serif', serif: 'Georgia,serif', mono: 'ui-monospace,Menlo,monospace' }[f.get('font')] || 'sans-serif';
  const ink = f.get('color') === 'bw' ? '#000' : '#1d1d1f';
  const type = f.get('doc');
  let body = '';
  if (type === 'profile') {
    body = `<h2>Profile</h2><p><b>${esc(p.name)}</b>${p.age ? `, age ${esc(p.age)}` : ''}<br>${esc(p.phone)}</p><p>${esc(p.bio)}</p>`;
  } else if (type === 'progress') {
    body = `<h2>Progress</h2><p>Current streak: ${streak()} days</p>` + areaStats().map(a => `<p>${a.name}: ${a.pct == null ? '–' : a.pct + '%'} (${a.n} tasks)</p>`).join('');
  } else {
    const keys = Object.keys(s.days).filter(k => k >= from && k <= to && s.days[k].tasks.length).sort();
    body = keys.map(k => `<h3>${fmtDate(k)} · ${dayPct(s.days[k])}%</h3><ul>${s.days[k].tasks.map(t => `<li>${t.done ? '☑' : '☐'} ${esc(t.text)} <small>${esc(t.area)}</small></li>`).join('')}</ul>${f.get('reflect') && s.days[k].reflection ? `<p><i>${esc(s.days[k].reflection)}</i></p>` : ''}`).join('') || '<p>No entries in this range.</p>';
  }
  const w = window.open('', '_blank');
  if (!w) return;
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

document.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'sheet' || t.closest('[data-close]')) {
    if (sh.classList.contains('open')) { sheet(''); play('cancel'); }
    return;
  }
  if (t.closest('#settings')) return sheet(settingsSheet());
  if (t.closest('#print')) return sheet(printSheet());
  const tb = t.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; return render(); }
  const rm = t.closest('[data-remove]');
  if (rm) { const [k, id] = rm.dataset.remove.split('|'); removeTask(k, id); play('cancel'); return render(); }
  const op = t.closest('[data-open]');
  if (op) { openDay = op.dataset.open; return render(); }
  const ro = t.closest('[data-rollover]');
  if (ro) { moveOpen(ro.dataset.rollover, ro.dataset.to); play('save'); return render(); }
  const th = t.closest('[data-theme-set]');
  if (th) {
    getState().settings.theme = th.dataset.themeSet;
    save(); applyTheme(); play('save');
    return sheet(settingsSheet());
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
  if ('sound' in t.dataset) {
    getState().settings.sound = t.checked;
    sounds.on = t.checked;
    save();
  }
});

document.addEventListener('input', e => {
  if (e.target.id !== 'search') return;
  q = e.target.value.trim().toLowerCase();
  const pos = e.target.selectionStart;
  render();
  const s = $('#search');
  s.focus();
  s.setSelectionRange(pos, pos);
});

document.addEventListener('keydown', e => {
  if (e.target.id === 'quick' && e.key === 'Enter' && e.target.value.trim()) {
    addTask(todayKey(), e.target.value.trim(), AREAS[0], 0);
    play('save');
    render();
  }
});

document.addEventListener('focusout', e => {
  if (e.target.id === 'reflect') {
    day(todayKey()).reflection = e.target.value;
    save();
  }
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'newForm') {
    const d = new FormData(f);
    viewDate = d.get('date');
    addTask(viewDate, d.get('text').trim(), d.get('area'), d.get('minutes'));
    play('save');
    tab = 'home';
    return render();
  }
  if (f.id === 'profileForm') {
    const d = new FormData(f), p = getState().profile, file = d.get('photo');
    if (file && file.size) p.photo = await shrink(file);
    Object.assign(p, { name: d.get('name').trim(), age: d.get('age'), phone: d.get('phone'), bio: d.get('bio') });
    save();
    play('save');
    return render();
  }
  if (f.id === 'printForm') {
    printDoc(new FormData(f));
    sheet('');
    play('save');
  }
});

(async () => {
  await load();
  sounds.on = getState().settings.sound;
  render();
})();
