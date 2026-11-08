import { getState } from './store.js';

// 1. Momentum Forecast
// Exponentially weighted completion rate across logged days. Recent days count more.
// The band is the smoothed mean plus or minus the mean absolute deviation of the residuals.
export function momentumForecast(alpha = 0.3) {
  const days = getState().days;
  const series = Object.keys(days).sort()
    .map(k => days[k].tasks)
    .filter(t => t.length)
    .map(t => t.filter(x => x.done).length / t.length);

  if (series.length < 3) return { pct: null, band: null, note: 'Log three days to unlock the forecast.' };

  let m = series[0];
  const residuals = [];
  for (const v of series.slice(1)) {
    residuals.push(Math.abs(v - m));
    m = alpha * v + (1 - alpha) * m;
  }
  const mad = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const pct = Math.round(m * 100);
  const band = [Math.max(0, Math.round((m - mad) * 100)), Math.min(100, Math.round((m + mad) * 100))];
  const note = pct >= 80
    ? `Momentum is strong. Expect about ${pct}% tomorrow, between ${band[0]} and ${band[1]}.`
    : `Expect about ${pct}% tomorrow, between ${band[0]} and ${band[1]}. Trim tomorrow's plan to lift it.`;
  return { pct, band, note };
}

// 2. Chronotype Map
// Circular mean of the hours at which tasks were completed. Circular maths handles
// the wrap-around at midnight, so 23:00 and 01:00 average to midnight rather than noon.
export function chronotype() {
  const hours = Array(24).fill(0);
  let x = 0, y = 0, n = 0;
  for (const d of Object.values(getState().days)) {
    for (const t of d.tasks) {
      if (!t.doneAt) continue;
      const h = new Date(t.doneAt).getHours();
      hours[h]++;
      const a = (h / 24) * 2 * Math.PI;
      x += Math.cos(a);
      y += Math.sin(a);
      n++;
    }
  }
  if (n < 5) return { peak: null, hours, note: 'Complete five tasks to map your rhythm.' };

  let a = Math.atan2(y, x);
  if (a < 0) a += 2 * Math.PI;
  const peak = Math.round((a / (2 * Math.PI)) * 24) % 24;
  return {
    peak,
    hours,
    note: `Your completions centre around ${String(peak).padStart(2, '0')}:00. Put hard tasks in that window.`
  };
}

// 3. Capacity Calibrator
// Compares minutes planned against minutes actually completed for one area, then
// recommends a realistic daily cap at 90 percent of your average completed minutes.
export function capacity(area) {
  const rows = Object.values(getState().days)
    .map(d => d.tasks.filter(t => t.area === area))
    .filter(ts => ts.length)
    .map(ts => ({
      planned: ts.reduce((a, t) => a + (t.minutes || 0), 0),
      done: ts.filter(t => t.done).reduce((a, t) => a + (t.minutes || 0), 0)
    }));

  if (rows.length < 3) return { cap: null, ratio: null, note: `Log three days in ${area} to calibrate.` };

  const avgPlanned = rows.reduce((a, r) => a + r.planned, 0) / rows.length;
  const avgDone = rows.reduce((a, r) => a + r.done, 0) / rows.length;
  const ratio = avgPlanned ? Math.round((avgDone / avgPlanned) * 100) : 100;
  const cap = Math.round(avgDone * 0.9);
  return {
    cap,
    ratio,
    note: `You complete about ${ratio}% of planned ${area} time. Plan around ${cap} minutes a day.`
  };
}

// Convenience: every algorithm in one call, for the Progress view.
export function insights(areas) {
  return {
    forecast: momentumForecast(),
    chronotype: chronotype(),
    capacity: Object.fromEntries(areas.map(a => [a, capacity(a)]))
  };
}
