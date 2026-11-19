import { getState, getAreas, todayKey, addDays, habitDone } from './store.js';

export function dayPct(d) {
  if (!d || !d.tasks.length) return null;
  return Math.round(100 * d.tasks.filter(t => t.done).length / d.tasks.length);
}

const pctOf = k => dayPct(getState().days[k]);

export function streak() {
  let k = todayKey();
  if (pctOf(k) == null || pctOf(k) < 80) k = addDays(k, -1);
  let n = 0;
  for (;;) { const p = pctOf(k); if (p == null || p < 80) break; n++; k = addDays(k, -1); }
  return n;
}

export function bestStreak() {
  const keys = Object.keys(getState().days).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const p = pctOf(k);
    if (p == null || p < 80) { run = 0; prev = k; continue; }
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

export function lastKeys(n = 7, end = todayKey()) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(addDays(end, -i));
  return out;
}

export function keysBetween(from, to) {
  const out = [];
  for (let k = from; k <= to && out.length < 3700; k = addDays(k, 1)) out.push(k);
  return out;
}

const minutesOf = t => Math.round(t.spent || (t.done ? t.minutes : 0) || 0);

export function areaStats(keys) {
  const s = getState();
  const all = (keys ? keys.map(k => s.days[k]).filter(Boolean) : Object.values(s.days)).flatMap(d => d.tasks);
  return getAreas().map(name => {
    const ts = all.filter(t => t.area === name);
    return { name, n: ts.length, done: ts.filter(t => t.done).length, minutes: ts.reduce((a, t) => a + minutesOf(t), 0), pct: ts.length ? Math.round(100 * ts.filter(t => t.done).length / ts.length) : null };
  });
}

export function weekdayStats(keys) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = names.map(() => []);
  const s = getState();
  for (const k of keys || Object.keys(s.days)) {
    const p = dayPct(s.days[k]);
    if (p != null) buckets[new Date(k + 'T12:00').getDay()].push(p);
  }
  return names.map((name, i) => ({ name, pct: buckets[i].length ? Math.round(buckets[i].reduce((a, b) => a + b, 0) / buckets[i].length) : null }));
}

export function hourStats(keys) {
  const hours = Array(24).fill(0);
  const s = getState();
  for (const k of keys || Object.keys(s.days)) for (const t of s.days[k]?.tasks || []) if (t.doneAt) hours[new Date(t.doneAt).getHours()]++;
  return hours;
}

// Totals for any range of days. Used by Insights and the PDF report.
export function summary(from, to) {
  const s = getState();
  const keys = keysBetween(from, to);
  let planned = 0, done = 0, missed = 0, minutes = 0, perfect = 0, activeDays = 0, journal = 0;
  for (const k of keys) {
    const d = s.days[k];
    if (!d) continue;
    if (d.tasks.length) activeDays++;
    planned += d.tasks.length;
    done += d.tasks.filter(t => t.done).length;
    missed += d.tasks.filter(t => t.status === 'missed').length;
    minutes += d.tasks.reduce((a, t) => a + minutesOf(t), 0);
    if (d.tasks.length && d.tasks.every(t => t.done)) perfect++;
    if (d.reflection || d.note || (d.gratitude || []).some(Boolean)) journal++;
  }
  const focus = s.focusLog.filter(f => f.at.slice(0, 10) >= from && f.at.slice(0, 10) <= to);
  const moods = keys.map(k => s.moods[k]).filter(m => m?.mood);
  const avgMood = moods.length ? +(moods.reduce((a, m) => a + m.mood, 0) / moods.length).toFixed(1) : null;
  const energies = keys.map(k => s.moods[k]).filter(m => m?.energy);
  const avgEnergy = energies.length ? +(energies.reduce((a, m) => a + m.energy, 0) / energies.length).toFixed(1) : null;
  const sleeps = keys.map(k => s.wellness[k]?.sleep).filter(v => v > 0);
  const waters = keys.map(k => s.wellness[k]?.water).filter(v => v > 0);
  return {
    keys, planned, done, missed, minutes, perfect, activeDays, journal,
    pct: planned ? Math.round(100 * done / planned) : null,
    focusSessions: focus.length, focusMinutes: focus.reduce((a, f) => a + (f.minutes || 0), 0),
    avgMood, avgEnergy, moodDays: moods.length,
    avgSleep: sleeps.length ? +(sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : null,
    avgWater: waters.length ? +(waters.reduce((a, b) => a + b, 0) / waters.length).toFixed(1) : null,
    habits: habitSummary(keys)
  };
}

export function weekSummary() {
  const sm = summary(addDays(todayKey(), -6), todayKey());
  const byArea = areaStats(sm.keys).filter(a => a.done).sort((a, b) => b.done - a.done);
  return { ...sm, best: byArea[0]?.name || null, streak: streak() };
}

export function goalProgress() {
  const s = getState();
  const minutes = {};
  for (const k of lastKeys(7)) for (const t of s.days[k]?.tasks || []) if (t.done || t.spent) minutes[t.area] = (minutes[t.area] || 0) + minutesOf(t);
  return getAreas().filter(a => s.goals[a] > 0).map(a => ({ name: a, done: minutes[a] || 0, goal: s.goals[a], pct: Math.min(100, Math.round(100 * (minutes[a] || 0) / s.goals[a])) }));
}

// ---------- habits ----------

const scheduled = (h, k) => h.days.includes(new Date(k + 'T12:00').getDay()) && k >= (h.createdAt || '0000');

export function habitStreak(h, end = todayKey()) {
  let k = end, n = 0, guard = 0;
  if (scheduled(h, k) && !habitDone(k, h.id)) k = addDays(k, -1);
  while (guard++ < 1000) {
    if (k < (h.createdAt || '0000')) break;
    if (!scheduled(h, k)) { k = addDays(k, -1); continue; }
    if (!habitDone(k, h.id)) break;
    n++; k = addDays(k, -1);
  }
  return n;
}

export function habitRate(h, keys) {
  const due = keys.filter(k => scheduled(h, k));
  if (!due.length) return null;
  return Math.round(100 * due.filter(k => habitDone(k, h.id)).length / due.length);
}

export function habitSummary(keys) {
  return getState().habits.filter(h => !h.archived).map(h => ({ id: h.id, name: h.name, icon: h.icon, color: h.color, rate: habitRate(h, keys), streak: habitStreak(h), done: keys.filter(k => habitDone(k, h.id)).length }));
}

export function habitsToday(k = todayKey()) {
  return getState().habits.filter(h => !h.archived && h.days.includes(new Date(k + 'T12:00').getDay()));
}

// ---------- mood and correlation ----------

export function moodSeries(keys) {
  const s = getState();
  return keys.map(k => ({ k, mood: s.moods[k]?.mood || null, energy: s.moods[k]?.energy || null, pct: dayPct(s.days[k]) }));
}

// Pearson correlation between mood and completion, on days that have both.
export function moodCorrelation(keys) {
  const pts = moodSeries(keys).filter(p => p.mood && p.pct != null);
  if (pts.length < 5) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p.mood, 0) / n, my = pts.reduce((a, p) => a + p.pct, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const p of pts) { num += (p.mood - mx) * (p.pct - my); dx += (p.mood - mx) ** 2; dy += (p.pct - my) ** 2; }
  if (!dx || !dy) return null;
  return +(num / Math.sqrt(dx * dy)).toFixed(2);
}

// ---------- XP, levels, achievements ----------

export function xp() {
  const s = getState();
  let total = 0;
  for (const d of Object.values(s.days)) for (const t of d.tasks) if (t.done) total += 10 + (t.priority === 3 ? 5 : 0) + Math.min(20, Math.round((t.spent || 0) / 5));
  total += Object.values(s.habitLog).reduce((a, l) => a + l.length * 5, 0);
  total += Object.values(s.days).filter(d => d.reflection).length * 8;
  total += Object.keys(s.moods).length * 2;
  total += s.longGoals.filter(g => g.doneAt).length * 100;
  return total;
}

export function level(points = xp()) {
  // Each level needs 20% more than the last, starting at 100.
  let lvl = 1, need = 100, left = points;
  while (left >= need) { left -= need; lvl++; need = Math.round(need * 1.2); }
  return { lvl, into: left, need, pct: Math.round(100 * left / need) };
}

export const BADGES = [
  { id: 'first', icon: '🌱', name: 'First step', desc: 'Complete your first task' },
  { id: 'ten', icon: '🔟', name: 'Getting going', desc: 'Complete 10 tasks' },
  { id: 'fifty', icon: '🚀', name: 'Lift-off', desc: 'Complete 50 tasks' },
  { id: 'hundred', icon: '💯', name: 'Centurion', desc: 'Complete 100 tasks' },
  { id: 'fivehundred', icon: '🏔️', name: 'Summit', desc: 'Complete 500 tasks' },
  { id: 'perfect', icon: '✨', name: 'Flawless', desc: 'Finish every task in a day' },
  { id: 'streak3', icon: '🔥', name: 'On fire', desc: '3-day streak' },
  { id: 'streak7', icon: '⚡', name: 'Week warrior', desc: '7-day streak' },
  { id: 'streak30', icon: '👑', name: 'Unstoppable', desc: '30-day streak' },
  { id: 'focus10', icon: '🎧', name: 'Deep worker', desc: '10 hours of focus' },
  { id: 'focus50', icon: '🧠', name: 'Flow master', desc: '50 hours of focus' },
  { id: 'journal7', icon: '📓', name: 'Reflective', desc: 'Journal on 7 days' },
  { id: 'habit21', icon: '🔗', name: 'Habit formed', desc: '21-day habit streak' },
  { id: 'early', icon: '🌅', name: 'Early bird', desc: 'Finish a task before 7:00' },
  { id: 'night', icon: '🦉', name: 'Night owl', desc: 'Finish a task after 23:00' },
  { id: 'goal', icon: '🎯', name: 'Goal getter', desc: 'Complete a long-term goal' }
];

export function earnedBadges() {
  const s = getState();
  const tasks = Object.values(s.days).flatMap(d => d.tasks);
  const done = tasks.filter(t => t.done);
  const focusMin = s.focusLog.reduce((a, f) => a + (f.minutes || 0), 0) + tasks.reduce((a, t) => a + (t.spent || 0), 0);
  const best = Math.max(bestStreak(), streak());
  const hours = done.filter(t => t.doneAt).map(t => new Date(t.doneAt).getHours());
  const got = {
    first: done.length >= 1, ten: done.length >= 10, fifty: done.length >= 50, hundred: done.length >= 100, fivehundred: done.length >= 500,
    perfect: Object.values(s.days).some(d => d.tasks.length >= 3 && d.tasks.every(t => t.done)),
    streak3: best >= 3, streak7: best >= 7, streak30: best >= 30,
    focus10: focusMin >= 600, focus50: focusMin >= 3000,
    journal7: Object.values(s.days).filter(d => d.reflection).length >= 7,
    habit21: s.habits.some(h => habitStreak(h) >= 21),
    early: hours.some(h => h < 7 && h >= 3), night: hours.some(h => h >= 23),
    goal: s.longGoals.some(g => g.doneAt)
  };
  return BADGES.filter(b => got[b.id]).map(b => b.id);
}

export function advice() {
  const out = [];
  for (const a of areaStats()) if (a.n >= 3 && a.pct < 50) out.push(`${a.name} tasks finish at ${a.pct}%. Split them into smaller steps and start with one 25-minute block.`);
  const wd = weekdayStats().filter(w => w.pct != null).sort((a, b) => a.pct - b.pct);
  if (wd.length >= 3 && wd[0].pct < wd[wd.length - 1].pct - 20) out.push(`${wd[0].name} is your weakest day at ${wd[0].pct}%. Plan a lighter load there, and use ${wd[wd.length - 1].name} for heavy work.`);
  const r = moodCorrelation(lastKeys(60));
  if (r != null && r > 0.3) out.push(`Your mood and output move together (r = ${r}). Protect sleep and breaks on busy days.`);
  const w = weekSummary();
  if (w.avgSleep && w.avgSleep < 6.5) out.push(`You averaged ${w.avgSleep}h of sleep this week. Under 7h usually costs focus the next day.`);
  if (!out.length) out.push(Object.keys(getState().days).length < 5 ? 'Log a few days and personalised advice appears here.' : 'Your pattern is steady. Keep the streak and raise one task a week.');
  return out;
}

// ---------- performance algorithms ----------

// Least-squares slope of daily completion, in percentage points per week.
export function trend(keys) {
  const pts = keys.map((k, i) => [i, dayPct(getState().days[k])]).filter(p => p[1] != null);
  if (pts.length < 4) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den ? +((num / den) * 7).toFixed(1) : 0;
}

// 0-100: how steady daily completion is (100 = identical every day).
export function consistency(keys) {
  const v = keys.map(k => dayPct(getState().days[k])).filter(p => p != null);
  if (v.length < 3) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  return Math.max(0, Math.round(100 - sd * 1.6));
}

// Composite performance score (0-100): completion 40%, consistency 20%, focus 15%, habits 15%, reflection 10%.
export function performanceScore(from, to) {
  const sm = summary(from, to);
  if (!sm.planned && !sm.focusSessions && !sm.habits.length) return null;
  const days = Math.max(1, sm.keys.length);
  const comp = sm.pct ?? 0;
  const cons = consistency(sm.keys) ?? comp;
  const focus = Math.min(100, (sm.focusMinutes + sm.minutes) / days / 1.2); // 120 min/day = 100
  const hab = sm.habits.length ? sm.habits.reduce((a, h) => a + (h.rate || 0), 0) / sm.habits.length : comp;
  const refl = Math.min(100, (sm.journal / days) * 100);
  return Math.round(comp * 0.4 + cons * 0.2 + focus * 0.15 + hab * 0.15 + refl * 0.1);
}

export const grade = sc => (sc == null ? '–' : sc >= 90 ? 'A+' : sc >= 80 ? 'A' : sc >= 70 ? 'B' : sc >= 60 ? 'C' : sc >= 45 ? 'D' : 'E');

// Compares a period with the one right before it.
export function comparePeriods(from, to) {
  const len = keysBetween(from, to).length;
  const pf = addDays(from, -len), pt = addDays(from, -1);
  const a = summary(from, to), b = summary(pf, pt);
  const d = (x, y) => (x == null || y == null ? null : x - y);
  return { prevFrom: pf, prevTo: pt, pct: d(a.pct, b.pct), done: a.done - b.done, minutes: a.minutes - b.minutes, focus: a.focusMinutes - b.focusMinutes, score: d(performanceScore(from, to), performanceScore(pf, pt)) };
}

export function usageStats(keys) {
  const u = getState().usage;
  const opens = keys.reduce((a, k) => a + (u.opens[k] || 0), 0);
  const minutes = keys.reduce((a, k) => a + (u.minutes[k] || 0), 0);
  const daysUsed = keys.filter(k => u.opens[k]).length;
  const views = Object.entries(u.views).sort((a, b) => b[1] - a[1]);
  const actions = Object.entries(u.actions).sort((a, b) => b[1] - a[1]);
  return { opens, minutes, daysUsed, avgSession: opens ? +(minutes / opens).toFixed(1) : 0, views, actions, since: u.first, perDay: keys.map(k => u.minutes[k] || 0) };
}

// A surprising, data-driven line for the day. Picks from facts that are actually true.
export function surprise() {
  const s = getState(), facts = [];
  const all = Object.values(s.days).flatMap(d => d.tasks);
  const done = all.filter(t => t.done);
  if (done.length >= 5) facts.push(`You have finished ${done.length} tasks with Better Me. That is ${Math.round(done.reduce((a, t) => a + (t.spent || t.minutes || 0), 0) / 60)} hours of follow-through.`);
  const wd = weekdayStats().filter(w => w.pct != null).sort((a, b) => b.pct - a.pct)[0];
  if (wd && wd.pct >= 50) facts.push(`${wd.name} is quietly your best day: ${wd.pct}% average completion.`);
  const hrs = hourStats(), peak = hrs.indexOf(Math.max(...hrs));
  if (Math.max(...hrs) >= 3) facts.push(`Most of your wins land around ${String(peak).padStart(2, '0')}:00. Guard that hour.`);
  const b = bestStreak();
  if (b >= 2 && done.length >= 5) facts.push(`Your record streak is ${b} days. ${streak() >= b ? 'You are on it right now.' : 'Beat it.'}`);
  const t = trend(lastKeys(21).reverse());
  if (t != null && t > 2) facts.push(`You are trending up: +${t} points a week over the last three weeks.`);
  const words = Object.values(s.days).reduce((a, d) => a + (d.reflection || '').split(/\s+/).filter(Boolean).length, 0);
  if (words > 50) facts.push(`You have written ${words} words of reflection. That is a small book about yourself.`);
  if (!facts.length) return null;
  return facts[(new Date().getDate() + new Date().getHours()) % facts.length];
}
