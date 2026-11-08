import { getState, todayKey } from './store.js';

export const AREAS = ['Academic', 'Personal Intelligence', 'Monetization', 'Reflection'];

export function dayPct(d) {
  if (!d || !d.tasks.length) return null;
  return Math.round(100 * d.tasks.filter(t => t.done).length / d.tasks.length);
}

export function streak() {
  const days = getState().days;
  const d = new Date();
  if (dayPct(days[todayKey(d)]) == null) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    const p = dayPct(days[todayKey(d)]);
    if (p == null || p < 80) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function areaStats() {
  const all = Object.values(getState().days).flatMap(d => d.tasks);
  return AREAS.map(name => {
    const ts = all.filter(t => t.area === name);
    return { name, n: ts.length, pct: ts.length ? Math.round(100 * ts.filter(t => t.done).length / ts.length) : null };
  });
}

export function weekdayStats() {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = names.map(() => []);
  for (const [k, d] of Object.entries(getState().days)) {
    const p = dayPct(d);
    if (p != null) buckets[new Date(k + 'T12:00').getDay()].push(p);
  }
  return names.map((name, i) => ({
    name,
    pct: buckets[i].length ? Math.round(buckets[i].reduce((a, b) => a + b, 0) / buckets[i].length) : null
  }));
}

export function advice() {
  const out = [];
  for (const a of areaStats()) {
    if (a.n >= 3 && a.pct < 50) out.push(`${a.name} tasks finish at ${a.pct}%. Split them into smaller steps and start with one 25-minute block.`);
  }
  const wd = weekdayStats().filter(w => w.pct != null).sort((a, b) => a.pct - b.pct);
  if (wd.length >= 3 && wd[0].pct < wd[wd.length - 1].pct - 20) {
    out.push(`${wd[0].name} is your weakest day at ${wd[0].pct}%. Plan a lighter load there.`);
  }
  if (!out.length) {
    out.push(Object.keys(getState().days).length < 5
      ? 'Log a few days of SOPs and personalised advice appears here.'
      : 'Your pattern is steady. Keep the streak and raise one task a week.');
  }
  return out;
}
