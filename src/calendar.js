import { getState, todayKey } from './store.js';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Month grid. Each day is a button carrying data-cal="YYYY-MM-DD".
// The dot ring shows completion for that day (--p is 0 to 100).
export function monthGrid(year, month) {
  const days = getState().days;
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: lead }, () => '<span class="cal-blank" aria-hidden="true"></span>');

  for (let d = 1; d <= total; d++) {
    const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const day = days[k];
    const n = day ? day.tasks.length : 0;
    const done = day ? day.tasks.filter(t => t.done).length : 0;
    const dot = n ? `<i class="dot" style="--p:${Math.round((100 * done) / n)}"></i>` : '';
    cells.push(
      `<button class="cal-day${k === todayKey() ? ' today' : ''}" data-cal="${k}" aria-label="${k}, ${n} tasks">` +
      `<span>${d}</span>${dot}</button>`
    );
  }

  return `<div class="cal-dow">${DOW.map(x => `<span>${x}</span>`).join('')}</div>` +
         `<div class="cal-grid">${cells.join('')}</div>`;
}

// Detail panel for one date: lists its SOPs and links onward.
// data-plan sends the user to New SOP for that date.
// data-open-history sends the user to that day in History.
export function dayPanel(k) {
  const d = getState().days[k];
  if (!d || !d.tasks.length) {
    return `<p class="empty">Nothing planned for ${esc(k)}.</p>
            <button class="ghost" data-plan="${esc(k)}">Plan this day</button>`;
  }
  const rows = d.tasks.map(t =>
    `<div class="task${t.done ? ' done' : ''}"><span class="tx">${t.done ? '☑' : '☐'} ${esc(t.text)}</span>` +
    `<span class="meta">${esc(t.area)}</span></div>`
  ).join('');
  return `${rows}<button class="ghost" data-open-history="${esc(k)}">Open in History</button>`;
}
