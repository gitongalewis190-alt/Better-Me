// The personal review document: a themed, multi-section report built as a standalone HTML page.
// It previews in an iframe, prints natively (vector, "Save as PDF"), or downloads as a real PDF file
// built block by block with jsPDF + html2canvas, so page breaks never cut through a card.
import { getState, getAreas, colorFor, VERSION, budgetMs, isGuest } from './store.js';
import { summary, areaStats, weekdayStats, hourStats, moodSeries, moodCorrelation, streak, bestStreak, xp, level, BADGES, earnedBadges, habitSummary, dayPct, keysBetween, performanceScore, grade, trend, consistency, comparePeriods, usageStats } from './analytics.js';
import { momentumForecast, chronotype, capacity } from './algorithms.js';
import { ACCENTS, BGS, LIGHT, DARK, accentOf, resolveMode, iconSvg } from './theme.js';
import { donut, line, bars, hbars, ring } from './charts.js';
import { AMBIENTS } from './sound.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDay = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const hm = m => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
const MOODS = ['', '😞', '😕', '😐', '🙂', '😄'];
const STATUS = { scheduled: 'Scheduled', running: 'In progress', waiting_review: 'Awaiting review', done: 'Done', missed: 'Not done', pushed: 'Moved' };
const PRI = ['', 'Low', 'Medium', 'High'];
const rgbOf = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const rgba = (h, a) => `rgba(${rgbOf(h).join(',')},${a})`;
const mix = (h1, h2, p) => { const a = rgbOf(h1), b = rgbOf(h2); return '#' + a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, '0')).join(''); };
const tagOf = (name, color, big = false) => `<span class="tag${big ? ' big' : ''}" style="color:${color};background:${rgba(color, 0.15)}">${esc(name)}</span>`;

export const SECTIONS = {
  cover: 'Cover and profile',
  summary: 'Summary and key numbers',
  performance: 'Performance score and algorithms',
  usage: 'How you use the app',
  charts: 'Charts and trends',
  insights: 'Insights, forecast and advice',
  habits: 'Habits',
  wellbeing: 'Mood, energy and wellness',
  goals: 'Goals and milestones',
  achievements: 'Achievements and level',
  daily: 'Day-by-day log',
  journal: 'Journal and reflections',
  focus: 'Focus sessions',
  settings: 'Theme, settings and setup'
};

export function buildReport(opt) {
  const s = getState(), p = s.profile, st = s.settings;
  const mode = opt.look === 'print' ? 'light' : resolveMode(st.theme);
  const pal = mode === 'dark' ? DARK : LIGHT;
  const { a: acc, b: acc2 } = accentOf(st.accent, mode);
  const keys = keysBetween(opt.from, opt.to);
  const sm = summary(opt.from, opt.to);
  const on = id => opt.sections.includes(id);
  const lv = level(xp());
  const generated = new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  const W = opt.orientation === 'landscape' ? (opt.paper === 'letter' ? 1056 : 1123) : (opt.paper === 'letter' ? 816 : 794);
  const blocks = [];
  const block = (html, cls = '') => blocks.push(`<section class="blk ${cls}">${html}</section>`);
  const h2 = (t, sub = '') => `<div class="h2"><span class="dot"></span><h2>${esc(t)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const kpi = (v, l, sub = '') => `<div class="kpi"><b>${v}</b><span>${esc(l)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;

  // ---------- cover ----------
  if (on('cover')) {
    const photo = p.photo ? `<img class="photo" src="${p.photo}" alt="">` : `<div class="photo ph">${esc((p.name || 'B')[0].toUpperCase())}</div>`;
    const facts = [['Email', p.email || opt.email], ['Phone', p.phone], ['Age', p.age], ['Occupation', p.occupation], ['Location', p.location]].filter(x => x[1]);
    block(`<div class="cover">
      <div class="brandline">${iconSvg(acc, acc2, 54, 'cv')}<div><b>Better Me</b><span>Personal review · v${VERSION}</span></div></div>
      <h1>${esc(opt.title || 'My days,')} <em>${opt.title ? '' : 'reviewed.'}</em></h1>
      <p class="range">${fmtDay(opt.from)} — ${fmtDay(opt.to)} · ${keys.length} day${keys.length === 1 ? '' : 's'}</p>
      <div class="who">${photo}<div><h3>${esc(p.name || 'Better Me user')}</h3>${p.motto ? `<p class="motto">“${esc(p.motto)}”</p>` : ''}${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Account</dt><dd>${isGuest() ? 'Device only (guest)' : 'Synced to cloud'}</dd><dt>Level</dt><dd>${lv.lvl} · ${xp()} XP</dd></dl></div></div>
      <div class="swatches"><span style="background:${acc}"></span><span style="background:${acc2}"></span><span style="background:${pal.bg};border:1px solid ${pal.line}"></span><span style="background:${pal.ink}"></span><small>${esc(ACCENTS[st.accent]?.name || 'Ember')} accent · ${mode === 'dark' ? 'Dark' : 'Light'} mode · ${esc(BGS[st.bg] || 'Aurora')} background</small></div>
      <p class="gen">Generated ${esc(generated)}</p></div>`, 'cover-blk');
  }

  // ---------- summary ----------
  if (on('summary')) {
    block(`${h2('At a glance', `${fmtShort(opt.from)} – ${fmtShort(opt.to)}`)}
      <div class="kpis">
        ${kpi(sm.pct == null ? '–' : sm.pct + '%', 'Completion', `${sm.done} of ${sm.planned} tasks`)}
        ${kpi(hm(sm.minutes), 'Time on tasks', `${sm.activeDays} active days`)}
        ${kpi(sm.focusSessions, 'Focus sessions', hm(sm.focusMinutes))}
        ${kpi(sm.perfect, 'Perfect days', 'every task done')}
        ${kpi(streak(), 'Current streak', `best ${bestStreak()} days`)}
        ${kpi(sm.avgMood == null ? '–' : MOODS[Math.round(sm.avgMood)] + ' ' + sm.avgMood, 'Average mood', `${sm.moodDays} check-ins`)}
        ${kpi(sm.habits.length ? Math.round(sm.habits.reduce((a, h) => a + (h.rate || 0), 0) / sm.habits.length) + '%' : '–', 'Habit consistency', `${sm.habits.length} habits`)}
        ${kpi(sm.journal, 'Journal days', `${sm.missed} tasks not done`)}
      </div>
      <div class="levelbar"><span>Level ${lv.lvl}</span><div class="bar"><b style="width:${lv.pct}%"></b></div><span>${lv.into}/${lv.need} XP</span></div>`);
  }

  // ---------- performance ----------
  if (on('performance')) {
    const sc = performanceScore(opt.from, opt.to), tr = trend(keys), cs = consistency(keys), cmp = comparePeriods(opt.from, opt.to);
    const delta = (v, unit = '') => (v == null ? '–' : `<span style="color:${v >= 0 ? '#18b26b' : '#e5484d'}">${v >= 0 ? '▲ +' : '▼ '}${v}${unit}</span>`);
    block(`${h2('Performance', 'computed from your own data')}
      <div class="two"><div style="display:flex;gap:18px;align-items:center">${ring(sc, 120, 12, sc == null ? '–' : String(sc))}<div><b style="font-size:40px;letter-spacing:-.03em">${grade(sc)}</b><p class="mut small">Performance score out of 100.<br>Completion 40% · Consistency 20% · Focus 15% · Habits 15% · Reflection 10%</p></div></div>
      <table class="tbl kv"><tbody>
        <tr><td>Trend</td><td>${tr == null ? 'Needs 4+ logged days' : (tr >= 0 ? '+' : '') + tr + ' pts / week'}</td></tr>
        <tr><td>Consistency index</td><td>${cs == null ? '–' : cs + ' / 100'}</td></tr>
        <tr><td>vs previous period</td><td class="small">${fmtShort(cmp.prevFrom)} – ${fmtShort(cmp.prevTo)}</td></tr>
        <tr><td>Score change</td><td>${delta(cmp.score)}</td></tr>
        <tr><td>Completion change</td><td>${delta(cmp.pct, ' pts')}</td></tr>
        <tr><td>Tasks done change</td><td>${delta(cmp.done)}</td></tr>
        <tr><td>Focus time change</td><td>${delta(cmp.focus, ' min')}</td></tr>
      </tbody></table></div>`);
  }

  // ---------- usage ----------
  if (on('usage')) {
    const u = usageStats(keys);
    const NAMES = { today: 'Today', plan: 'Plan', focus: 'Focus', habits: 'Habits', insights: 'Insights', journal: 'Journal', goals: 'Goals', history: 'History', profile: 'Profile' };
    const maxV = Math.max(1, ...u.views.map(v => v[1]));
    block(`${h2('How you use Better Me', u.since ? 'tracking since ' + fmtShort(u.since) : '')}
      <div class="kpis">${kpi(u.daysUsed + '/' + keys.length, 'Days opened')}${kpi(u.opens, 'App opens')}${kpi(hm(u.minutes), 'Time in app')}${kpi(u.avgSession + 'm', 'Average session')}</div>
      ${u.perDay.some(Boolean) ? `<div class="sub">${bars(keys.slice(-31).map((k, i, arr) => ({ label: String(+k.slice(8)), v: u.perDay[u.perDay.length - arr.length + i] || null, tip: k })), { h: 80, max: Math.max(1, ...u.perDay), fmt: v => v + 'm', color: acc2 })}</div>` : ''}
      <div class="two sub"><div><h3>Most visited</h3>${hbars(u.views.slice(0, 8).map(([n, c]) => ({ name: NAMES[n] || n, pct: Math.round(100 * c / maxV), c })), { fmt: r => r.c + '×' })}</div>
      <div><h3>Most used features</h3>${u.actions.length ? `<table class="tbl"><tbody>${u.actions.slice(0, 10).map(([n, c]) => `<tr><td>${esc(n)}</td><td>${c}×</td></tr>`).join('')}</tbody></table>` : '<p class="mut small">Not enough activity yet.</p>'}</div></div>`);
  }

  // ---------- charts ----------
  if (on('charts')) {
    const show = keys.slice(-31);
    block(`${h2('Daily completion', show.length < keys.length ? 'last 31 days of the range' : '')}${bars(show.map(k => ({ label: show.length > 16 ? String(+k.slice(8)) : fmtShort(k), v: dayPct(s.days[k]) })), { h: 150 })}`);
    const areas = areaStats(keys);
    const parts = areas.map(a => ({ label: a.name, value: a.minutes, color: colorFor(a.name) }));
    const total = parts.reduce((x, y) => x + y.value, 0);
    block(`<div class="two"><div>${h2('Where the time went')}${total ? donut(parts, 170, hm(total)) : '<p class="mut">No time logged in this range.</p>'}</div>
      <div>${h2('Completion by area')}${hbars(areas.map(a => ({ ...a, color: colorFor(a.name) })), { fmt: r => (r.pct == null ? '–' : `${r.pct}% · ${r.done}/${r.n}`) })}</div></div>`);
    const heat = keys.slice(-182).map(k => ({ k, v: dayPct(s.days[k]), tip: k }));
    block(`<div class="two"><div>${h2('Consistency map')}${heat.length ? `<div class="heatmap">${Array((new Date(heat[0].k + 'T12:00').getDay() - st.weekStart + 7) % 7).fill('<i class="pad"></i>').join('')}${heat.map(c => `<i style="background:${c.v == null ? pal.track : mix(acc, pal.track, Math.max(0.18, c.v / 100))}"></i>`).join('')}</div>` : ''}<p class="mut small">Each square is a day; darker means more done.</p></div>
      <div>${h2('By weekday')}${bars(weekdayStats(keys).map(w => ({ label: w.name, v: w.pct })), { h: 120 })}</div></div>`);
    const hrs = hourStats(keys);
    block(`${h2('When you finish things', 'tasks completed per hour')}${bars(hrs.map((v, i) => ({ label: i % 3 === 0 ? String(i).padStart(2, '0') : '', v, tip: `${i}:00 · ${v}` })), { h: 110, max: Math.max(1, ...hrs), fmt: v => v })}`);
  }

  // ---------- insights ----------
  if (on('insights')) {
    const f = momentumForecast(), c = chronotype();
    const corr = moodCorrelation(keys);
    block(`${h2('Insights')}
      <div class="ins"><b>Forecast</b><p>${esc(f.note)}</p></div>
      <div class="ins"><b>Rhythm</b><p>${esc(c.note)}</p></div>
      ${getAreas().map(a => `<div class="ins"><b style="color:${colorFor(a)}">Capacity · ${esc(a)}</b><p>${esc(capacity(a).note)}</p></div>`).join('')}
      ${corr != null ? `<div class="ins"><b>Mood × output</b><p>Correlation between mood and completion: r = ${corr} (${Math.abs(corr) < 0.2 ? 'little link' : corr > 0 ? 'better mood, more done' : 'inverse link'}).</p></div>` : ''}
      ${opt.advice.map(a => `<div class="ins"><b>Advice</b><p>${esc(a)}</p></div>`).join('')}`);
  }

  // ---------- habits ----------
  if (on('habits') && s.habits.length) {
    const hs = habitSummary(keys);
    const last = keys.slice(-28);
    block(`${h2('Habits', `${hs.length} tracked`)}<table class="tbl"><thead><tr><th>Habit</th><th>Consistency</th><th>Streak</th><th>Days done</th><th>Last 28 days</th></tr></thead><tbody>
      ${hs.map(h => `<tr><td><span class="hi" style="background:${rgba(h.color, 0.14)};color:${h.color}">${esc(h.icon)}</span> ${esc(h.name)}</td><td>${h.rate == null ? '–' : h.rate + '%'}</td><td>${h.streak} 🔥</td><td>${h.done}</td>
        <td><div class="mini">${last.map(k => `<i style="${(s.habitLog[k] || []).includes(h.id) ? `background:${h.color}` : ''}"></i>`).join('')}</div></td></tr>`).join('')}</tbody></table>`);
  }

  // ---------- wellbeing ----------
  if (on('wellbeing')) {
    const ms = moodSeries(keys.slice(-60));
    const hasMood = ms.some(m => m.mood);
    const sleeps = keys.slice(-60).map(k => s.wellness[k]?.sleep || null);
    block(`${h2('Mood and energy', hasMood ? 'scale 1–5' : '')}${hasMood ? `${line(ms.map(m => m.mood), { min: 1, max: 5, h: 120, labels: ms.map(m => m.k), fill: false, color: acc })}<p class="mut small"><span class="lg" style="background:${acc}"></span>Mood ${sm.avgMood ?? '–'} avg · Energy ${sm.avgEnergy ?? '–'} avg</p>` : '<p class="mut">No mood check-ins in this range.</p>'}
      ${sleeps.some(Boolean) ? `<div class="sub">${h2('Sleep', `${sm.avgSleep ?? '–'}h average · water ${sm.avgWater ?? '–'} glasses`)}${bars(keys.slice(-60).slice(-31).map(k => ({ label: String(+k.slice(8)), v: s.wellness[k]?.sleep || null, tip: `${k}: ${s.wellness[k]?.sleep || '–'}h` })), { h: 90, max: 10, fmt: v => v + 'h', color: acc2 })}</div>` : ''}`);
  }

  // ---------- goals ----------
  if (on('goals')) {
    const lg = s.longGoals;
    const weekly = getAreas().filter(a => s.goals[a] > 0);
    block(`${h2('Goals')}${lg.length ? lg.map(g => {
      const d = g.milestones.filter(m => m.done).length, n = g.milestones.length;
      return `<div class="goal"><div class="gh">${ring(n ? Math.round(100 * d / n) : 0, 48, 6)}<div><b>${esc(g.title)}</b>${g.doneAt ? ' <span class="pill ok">Achieved</span>' : ''}<p class="mut small">${g.area ? esc(g.area) + ' · ' : ''}${g.due ? 'Due ' + fmtShort(g.due) + ' · ' : ''}${d}/${n} milestones</p>${g.why ? `<p class="small">${esc(g.why)}</p>` : ''}</div></div>
        ${n ? `<ul class="ms">${g.milestones.map(m => `<li class="${m.done ? 'done' : ''}">${m.done ? '✓' : '○'} ${esc(m.text)}</li>`).join('')}</ul>` : ''}</div>`;
    }).join('') : '<p class="mut">No long-term goals yet.</p>'}
      ${weekly.length ? `<h3>Weekly minute goals</h3>${hbars(weekly.map(a => ({ name: a, pct: s.goals[a], color: colorFor(a) })), { fmt: r => `${s.goals[r.name]} min/week` })}` : ''}`);
  }

  // ---------- achievements ----------
  if (on('achievements')) {
    const got = new Set(earnedBadges());
    block(`${h2('Achievements', `${got.size} of ${BADGES.length} unlocked · Level ${lv.lvl}`)}<div class="badges">${BADGES.map(b => `<div class="badge ${got.has(b.id) ? 'on' : ''}"><span>${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}${s.badges[b.id] ? ' · ' + fmtShort(s.badges[b.id].slice(0, 10)) : ''}</small></div>`).join('')}</div>`);
  }

  // ---------- daily log ----------
  if (on('daily')) {
    const logged = keys.filter(k => s.days[k]?.tasks.length || s.moods[k] || s.habitLog[k] || s.days[k]?.reflection);
    block(`${h2('Day-by-day log', `${logged.length} days with entries`)}`, 'tight');
    for (const k of logged) {
      const d = s.days[k] || { tasks: [] }, m = s.moods[k], w = s.wellness[k];
      const habits = (s.habitLog[k] || []).map(id => s.habits.find(h => h.id === id)).filter(Boolean);
      const pct = dayPct(d);
      block(`<div class="dayh"><div><b>${fmtDay(k)}</b>${d.intention ? `<p class="small">Intention: ${esc(d.intention)}</p>` : ''}</div>
        <div class="dm">${m?.mood ? `<span title="Mood">${MOODS[m.mood]}</span>` : ''}${m?.energy ? `<span class="chip">⚡ ${m.energy}/5</span>` : ''}${w?.sleep ? `<span class="chip">😴 ${w.sleep}h</span>` : ''}${w?.water ? `<span class="chip">💧 ${w.water}</span>` : ''}${pct != null ? ring(pct, 40, 5) : ''}</div></div>
        ${d.tasks.length ? `<table class="tbl tasks"><tbody>${d.tasks.map(t => `<tr class="${t.done ? 'done' : t.status === 'missed' ? 'missed' : ''}"><td class="ck">${t.done ? '✓' : t.status === 'missed' ? '✕' : '○'}</td>
          <td><b>${esc(t.text)}</b>${t.priority ? ` <span class="pri p${t.priority}">${PRI[t.priority]}</span>` : ''}${t.subtasks?.length ? `<div class="small mut">${t.subtasks.map(x => (x.done ? '☑ ' : '☐ ') + esc(x.text)).join(' · ')}</div>` : ''}${t.notes ? `<div class="small note">${esc(t.notes)}</div>` : ''}</td>
          <td class="small">${t.startTime ? esc(t.startTime) + (t.endTime ? '–' + esc(t.endTime) : '') : 'Anytime'}</td>
          <td class="small">${hm(budgetMs(t, k) / 60000)} plan${t.spent ? `<br>${hm(t.spent)} spent` : ''}</td>
          <td>${tagOf(t.area, colorFor(t.area))}</td><td class="small">${STATUS[t.status] || ''}${t.doneAt ? '<br>' + new Date(t.doneAt).toTimeString().slice(0, 5) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="mut small">No tasks.</p>'}
        ${habits.length ? `<p class="small">Habits: ${habits.map(h => `${esc(h.icon)} ${esc(h.name)}`).join(' · ')}</p>` : ''}
        ${opt.journalInline && d.reflection ? `<blockquote>${esc(d.reflection)}</blockquote>` : ''}`, 'day');
    }
    if (!logged.length) block('<p class="mut">No activity in this range.</p>');
  }

  // ---------- journal ----------
  if (on('journal')) {
    const js = keys.filter(k => { const d = s.days[k]; return d && (d.reflection || d.note || (d.gratitude || []).some(Boolean)); });
    block(`${h2('Journal and reflections', `${js.length} entries`)}`, 'tight');
    for (const k of js) {
      const d = s.days[k];
      block(`<div class="jr"><b>${fmtDay(k)}</b>${d.reflection ? `<blockquote>${esc(d.reflection)}</blockquote>` : ''}${d.note ? `<p>${esc(d.note)}</p>` : ''}${(d.gratitude || []).some(Boolean) ? `<p class="small"><b>Grateful for:</b> ${d.gratitude.filter(Boolean).map(esc).join(' · ')}</p>` : ''}</div>`, 'day');
    }
    if (!js.length) block('<p class="mut">No journal entries in this range.</p>');
  }

  // ---------- focus ----------
  if (on('focus')) {
    const fl = s.focusLog.filter(f => f.at.slice(0, 10) >= opt.from && f.at.slice(0, 10) <= opt.to);
    const byArea = {};
    for (const f of fl) byArea[f.area || 'Other'] = (byArea[f.area || 'Other'] || 0) + (f.minutes || 0);
    block(`${h2('Focus sessions', `${fl.length} sessions · ${hm(fl.reduce((a, f) => a + (f.minutes || 0), 0))}`)}
      ${fl.length ? `${hbars(Object.entries(byArea).map(([n, m]) => ({ name: n, pct: Math.round(100 * m / Math.max(...Object.values(byArea))), color: colorFor(n), m })), { fmt: r => hm(r.m) })}
      <table class="tbl"><thead><tr><th>When</th><th>Session</th><th>Length</th></tr></thead><tbody>${fl.slice(0, 40).map(f => `<tr><td class="small">${new Date(f.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${esc(f.text || 'Free focus')}${f.area ? ' ' + tagOf(f.area, colorFor(f.area)) : ''}</td><td>${hm(f.minutes)}</td></tr>`).join('')}</tbody></table>${fl.length > 40 ? `<p class="mut small">and ${fl.length - 40} more</p>` : ''}` : '<p class="mut">No focus sessions in this range.</p>'}`);
  }

  // ---------- settings ----------
  if (on('settings')) {
    const row = (k, v) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`;
    block(`${h2('Theme, settings and setup')}<div class="two"><div>
      <table class="tbl kv"><tbody>
        ${row('App icon', iconSvg(acc, acc2, 28, 'ic2'))}
        ${row('Theme', `${st.theme === 'system' ? 'Follow device' : st.theme === 'dark' ? 'Dark' : 'Light'} (now ${resolveMode(st.theme)})`)}
        ${row('Accent', `<span class="sw" style="background:linear-gradient(135deg,${acc},${acc2})"></span> ${esc(ACCENTS[st.accent]?.name || 'Ember')}`)}
        ${row('Background', esc(BGS[st.bg] || st.bg))}
        ${row('Density', st.density === 'compact' ? 'Compact' : 'Comfortable')}
        ${row('Text size', Math.round(st.fontScale * 100) + '%')}
        ${row('Motion', st.motion === 'reduced' ? 'Reduced' : 'Full')}
        ${row('High contrast', st.contrast ? 'On' : 'Off')}
        ${row('Week starts', st.weekStart === 0 ? 'Sunday' : 'Monday')}
      </tbody></table></div><div>
      <table class="tbl kv"><tbody>
        ${row('Focus timer', `${st.pomo.work}m work · ${st.pomo.short}m break · ${st.pomo.long}m long break every ${st.pomo.every}`)}
        ${row('Soundscape', esc(AMBIENTS[st.ambient] || 'Off'))}
        ${row('Daily reminder', st.reminder || 'Off')}
        ${row('Task alerts', st.taskAlerts ? 'On' : 'Off')}
        ${row('Sounds / haptics', `${st.sound ? 'On' : 'Off'} / ${st.haptics ? 'On' : 'Off'}`)}
        ${row('App lock', st.lockHash ? 'PIN set' : 'Off')}
        ${row('Default task length', st.defaultMinutes + ' min')}
      </tbody></table></div></div>
      <h3>Categories</h3><div class="cats">${getAreas().map(a => tagOf(a + (s.goals[a] ? ` · ${s.goals[a]}m/wk` : ''), colorFor(a), true)).join('')}</div>
      ${s.templates.length ? `<h3>Templates</h3><ul class="plain">${s.templates.map(t => `<li><b>${esc(t.name)}</b> · ${t.tasks.length} tasks${t.schedule?.length ? ' · repeats ' + t.schedule.map(i => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]).join(', ') : ''}</li>`).join('')}</ul>` : ''}
      ${s.rules.length ? `<h3>Recurring tasks</h3><ul class="plain">${s.rules.map(r => `<li><b>${esc(r.text)}</b> · ${r.startTime || 'anytime'} · ${r.days.map(i => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]).join(', ')}</li>`).join('')}</ul>` : ''}`);
  }

  const css = `
  :root{--bg:${pal.bg};--card:${pal.card};--ink:${pal.ink};--mut:${pal.mut};--line:${pal.line};--track:${pal.track};--soft:${pal.soft};--acc:${acc};--acc2:${acc2}}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.5 Inter,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .doc{width:${W}px;margin:0 auto;padding:36px 40px;background:var(--bg)}
  .blk{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px 22px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid}
  .blk.tight{background:none;border:0;padding:6px 2px 0;margin-bottom:4px}
  .blk.day{padding:14px 18px}
  .cover-blk{padding:34px;background:linear-gradient(140deg,${mix(acc, pal.card, 0.16)},${pal.card} 55%,${mix(acc2, pal.card, 0.14)});min-height:${Math.round(W * 1.1)}px;display:flex}
  .cover{display:flex;flex-direction:column;gap:22px;width:100%}
  .brandline{display:flex;gap:14px;align-items:center}.brandline b{display:block;font-size:20px;letter-spacing:-.02em}.brandline span{color:var(--mut);font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
  h1{font-size:46px;line-height:1.02;letter-spacing:-.04em;margin:40px 0 0;color:var(--ink)}h1 em{font-style:normal;color:var(--acc)}
  .range{font-size:15px;color:var(--mut);margin:0;font-weight:600}
  .who{display:flex;gap:22px;align-items:flex-start;margin-top:16px;padding:22px;border-radius:18px;background:var(--card);border:1px solid var(--line)}
  .photo{width:96px;height:96px;border-radius:28px;object-fit:cover;flex:none}.photo.ph{display:grid;place-items:center;font-size:40px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--acc),var(--acc2))}
  .who h3{margin:0;font-size:24px;letter-spacing:-.02em;text-transform:none;color:var(--ink)}.who p{margin:6px 0}.motto{font-style:italic;color:var(--acc)}
  dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:12px 0 0;font-size:12.5px}dt{color:var(--mut);font-weight:600}dd{margin:0;font-weight:600}
  .swatches{display:flex;align-items:center;gap:8px;margin-top:auto}.swatches span{width:26px;height:26px;border-radius:8px}.swatches small{color:var(--mut);margin-left:6px;font-weight:600}
  .gen{color:var(--mut);font-size:11px;margin:0}
  .h2{display:flex;align-items:center;gap:10px;margin:0 0 14px}.h2 h2{font-size:17px;margin:0;letter-spacing:-.01em}.h2 small{margin-left:auto;color:var(--mut);font-weight:600;font-size:11.5px}
  .dot{width:10px;height:10px;border-radius:4px;background:linear-gradient(135deg,var(--acc),var(--acc2))}
  h3{font-size:13px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .kpi{padding:14px;border-radius:14px;background:var(--soft);display:grid;gap:2px}.kpi b{font-size:22px;letter-spacing:-.02em}.kpi span{font-weight:700;font-size:11.5px}.kpi em{font-style:normal;color:var(--mut);font-size:11px}
  .levelbar{display:flex;align-items:center;gap:12px;margin-top:14px;font-weight:700;font-size:12px}.levelbar .bar{flex:1}
  .bar{height:9px;border-radius:9px;background:var(--track);overflow:hidden}.bar b{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,var(--acc),var(--acc2))}
  .bar-row{display:grid;grid-template-columns:120px 1fr 92px;gap:10px;align-items:center;margin:7px 0;font-size:12px}.bar-row .bl{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-row .bv{text-align:right;color:var(--mut);font-weight:600}
  .vbars{display:flex;align-items:flex-end;height:calc(var(--h) + 20px);gap:0}.vb{display:flex;flex-direction:column;align-items:center;height:100%}.vb-col{flex:1;width:70%;display:flex;align-items:flex-end;background:var(--soft);border-radius:6px 6px 3px 3px}.vb-col b{display:block;width:100%;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,var(--acc2),var(--acc))}.vb span{font-size:9.5px;color:var(--mut);height:18px;line-height:18px;white-space:nowrap}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .donut{display:flex;gap:16px;align-items:center}.legend{list-style:none;margin:0;padding:0;display:grid;gap:5px;font-size:12px;flex:1}.legend li{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center}.legend i{width:12px;height:12px;border-radius:4px}
  .heatmap{display:grid;grid-template-rows:repeat(7,13px);grid-auto-flow:column;grid-auto-columns:13px;gap:3px}.heatmap i{border-radius:3px}.heatmap i.pad{background:none}
  svg.line{width:100%;display:block}
  .ins{padding:10px 0;border-bottom:1px solid var(--line)}.ins:last-child{border:0}.ins b{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--acc)}.ins p{margin:3px 0 0}
  .tbl{width:100%;border-collapse:collapse;font-size:12px}.tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);padding:6px 8px;border-bottom:1px solid var(--line)}.tbl td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}.tbl tr:last-child td{border:0}
  .tbl.kv td:first-child{color:var(--mut);font-weight:600;width:42%}
  .tasks tr.done b{text-decoration:line-through;color:var(--mut)}.tasks tr.missed{opacity:.7}.ck{width:22px;font-weight:800;color:var(--acc)}
  .hi{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:8px;margin-right:4px}
  .mini{display:grid;grid-template-columns:repeat(28,1fr);gap:2px;min-width:160px}.mini i{height:12px;border-radius:2px;background:var(--track)}
  .tag{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}.tag.big{font-size:12px;padding:5px 12px;margin:0 6px 6px 0}
  .pri{font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;background:var(--soft)}.pri.p3{color:#e5484d}.pri.p2{color:#d98e04}.pri.p1{color:var(--mut)}
  .note{margin-top:3px;padding-left:8px;border-left:2px solid var(--line);color:var(--mut)}
  .chip{font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:var(--soft)}
  .dayh{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}.dayh b{font-size:14px}.dm{display:flex;align-items:center;gap:6px;font-size:18px}
  blockquote{margin:8px 0 0;padding:10px 14px;border-left:3px solid var(--acc);background:var(--soft);border-radius:0 10px 10px 0;font-style:italic;white-space:pre-wrap}
  .jr p{margin:6px 0}
  .goal{padding:12px 0;border-bottom:1px solid var(--line)}.goal:last-of-type{border:0}.gh{display:flex;gap:14px;align-items:center}.gh p{margin:2px 0}.ms{margin:8px 0 0 62px;padding:0;list-style:none;display:grid;gap:3px;font-size:12px}.ms li.done{color:var(--mut);text-decoration:line-through}
  .pill{font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:var(--soft)}.pill.ok{background:rgba(24,178,107,.14);color:#18b26b}
  .badges{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.badge{padding:12px;border-radius:14px;background:var(--soft);display:grid;gap:2px;opacity:.45;filter:grayscale(1)}.badge.on{opacity:1;filter:none;background:${mix(acc, pal.card, 0.1)};border:1px solid ${rgba(acc, 0.3)}}.badge span{font-size:24px}.badge b{font-size:12px}.badge small{font-size:10.5px;color:var(--mut)}
  .sw{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px}
  .cats{display:flex;flex-wrap:wrap}
  .plain{margin:0;padding-left:18px;font-size:12px}
  .mut{color:var(--mut)}.small{font-size:11.5px}.sub{margin-top:16px}.lg{display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .ring text{fill:var(--ink)}svg.ring,.photo,.dot,.hi{flex:none}
  .foot{display:flex;justify-content:space-between;color:var(--mut);font-size:10.5px;padding:4px 4px 0}
  @page{size:${opt.paper === 'letter' ? 'letter' : 'A4'} ${opt.orientation};margin:0}
  @media print{.doc{width:auto;padding:12mm}.cover-blk{min-height:250mm}}`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(opt.title || 'Better Me review')} · ${esc(p.name || '')}</title>
<style>${css}</style></head><body><div class="doc" id="doc">
<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="gAcc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${acc}"/><stop offset="1" stop-color="${acc2}"/></linearGradient><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${acc}" stop-opacity=".35"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></linearGradient></defs></svg>
${blocks.join('\n')}
<div class="foot"><span>Better Me v${VERSION} · ${esc(p.name || '')}</span><span>${esc(generated)}</span></div>
</div></body></html>`;
  const lit = { '--track': pal.track, '--line': pal.line, '--acc': acc, '--acc2': acc2, '--ink': pal.ink, '--mut': pal.mut, '--soft': pal.soft };
  const out = html.replace(/="var\((--[a-z0-9]+)\)"/g, (m, v) => `="${lit[v] || '#888'}"`).replace(/="url\(#gAcc\)"/g, `="${acc}"`).replace(/="url\(#gArea\)"/g, `="${rgba(acc, 0.15)}"`).replace(/fill="currentColor"/g, `fill="${pal.ink}"`);
  return { html: out, width: W, bg: pal.bg, summary: `${sm.done}/${sm.planned} tasks, ${sm.pct ?? 0}%` };
}

// Renders each block of the report document to its own canvas and lays them onto PDF pages.
export async function downloadPdf(frame, opt, filename, onProgress = () => {}) {
  const win = frame.contentWindow, doc = frame.contentDocument;
  const { jsPDF } = window.jspdf || {};
  const h2c = window.html2canvas;
  if (!jsPDF || !h2c) throw new Error('PDF engine not loaded');
  const landscape = opt.orientation === 'landscape';
  const pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: opt.paper === 'letter' ? 'letter' : 'a4', compress: true });
  const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight();
  const M = 22;
  const docEl = doc.getElementById('doc');
  const bg = getComputedStyle(doc.body).backgroundColor;
  const rgb = (bg.match(/\d+(\.\d+)?/g) || [255, 255, 255]).slice(0, 3).map(Number);
  const fill = () => { pdf.setFillColor(rgb[0], rgb[1], rgb[2]); pdf.rect(0, 0, PW, PH, 'F'); };
  const els = [...docEl.children].filter(e => e.tagName !== 'svg' && e.getBoundingClientRect().height > 0);
  const scale = Math.min(2, Math.max(1.5, win.devicePixelRatio || 1));
  const cssW = docEl.getBoundingClientRect().width - 80; // minus doc padding
  const k = (PW - 2 * M) / cssW; // css px → pt
  let y = M, first = true;
  fill();
  for (let i = 0; i < els.length; i++) {
    onProgress(Math.round(100 * i / els.length));
    const el = els[i];
    const isCover = el.classList.contains('cover-blk');
    const canvas = await h2c(el, { scale, backgroundColor: bg, useCORS: true, logging: false, windowWidth: docEl.scrollWidth });
    const wPt = canvas.width / scale * k, hPt = canvas.height / scale * k;
    const gap = 10;
    if (isCover && !first) { pdf.addPage(); fill(); y = M; }
    if (y + hPt > PH - M && y > M + 1) { pdf.addPage(); fill(); y = M; }
    if (hPt <= PH - 2 * M) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', M, y, wPt, hPt, undefined, 'FAST');
      y += hPt + gap;
    } else {
      // A block taller than a page is cut into page-sized slices.
      const sliceCss = (PH - 2 * M) / k * scale;
      for (let off = 0; off < canvas.height; off += sliceCss) {
        const h = Math.min(sliceCss, canvas.height - off);
        const part = doc.createElement('canvas');
        part.width = canvas.width; part.height = h;
        part.getContext('2d').drawImage(canvas, 0, off, canvas.width, h, 0, 0, canvas.width, h);
        if (off > 0) { pdf.addPage(); fill(); y = M; }
        pdf.addImage(part, 'JPEG', M, y, wPt, h / scale * k, undefined, 'FAST');
        y += h / scale * k + gap;
      }
    }
    if (isCover && i < els.length - 1) { pdf.addPage(); fill(); y = M; }
    first = false;
    await new Promise(r => setTimeout(r, 0));
  }
  // Page numbers.
  const n = pdf.getNumberOfPages();
  pdf.setFontSize(8);
  pdf.setTextColor(140);
  for (let i = 2; i <= n; i++) { pdf.setPage(i); pdf.text(`Better Me · page ${i} of ${n}`, PW - M, PH - 9, { align: 'right' }); }
  onProgress(100);
  pdf.setProperties({ title: filename.replace(/\.pdf$/, ''), creator: 'Better Me', author: getState().profile.name || 'Better Me' });
  const blob = pdf.output('blob');
  return blob;
}
