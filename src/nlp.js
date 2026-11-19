// Natural-language quick add.
// "Revise chapter 3 tomorrow at 2pm for 45m #Academic !high" →
// { text: 'Revise chapter 3', day: +1, start: '14:00', minutes: 45, area: 'Academic', priority: 3 }

const pad = n => String(n).padStart(2, '0');
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toHHMM(h, m, ap) {
  h = Number(h); m = Number(m || 0);
  if (ap) { ap = ap.toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; }
  if (h > 23 || m > 59) return '';
  return `${pad(h)}:${pad(m)}`;
}

export function parseQuick(input, areas = [], now = new Date()) {
  let s = ` ${input} `;
  const out = { text: '', dayOffset: 0, start: '', end: '', minutes: 0, area: '', priority: 0, tags: [] };
  const take = (re, fn) => { s = s.replace(re, (...m) => { fn(...m); return ' '; }); };

  // Category: #Name or #"Two words" (matched case-insensitively, also by prefix).
  take(/\s#"([^"]+)"/g, (_, a) => { out.area = a; });
  take(/\s#([\p{L}\p{N}_-]+)/gu, (_, a) => {
    const hit = areas.find(x => x.toLowerCase() === a.toLowerCase()) || areas.find(x => x.toLowerCase().replace(/\s+/g, '').startsWith(a.toLowerCase()));
    if (hit && !out.area) out.area = hit; else out.tags.push(a);
  });
  // Priority: !high !med !low, !1 !2 !3, or !!! style.
  take(/\s!(high|h|3|!!)(?=\s)/gi, () => { out.priority = 3; });
  take(/\s!(med|medium|m|2|!)(?=\s)/gi, () => { out.priority = 2; });
  take(/\s!(low|l|1)(?=\s)/gi, () => { out.priority = 1; });
  // Duration: for 45m, 1h30, 1.5h, 90 min.
  take(/\s(?:for\s+)?(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(\d+)?\s*(?:m(?:in(?:utes?)?)?)?(?=\s)/gi, (_, h, m) => { out.minutes = Math.round(Number(h) * 60 + Number(m || 0)); });
  take(/\s(?:for\s+)?(\d+)\s*(?:m|min|mins|minutes)(?=\s)/gi, (_, m) => { out.minutes = Number(m); });
  // Time range: 9-11, 9am-11am, 14:00-15:30.
  take(/\s(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=\s)/gi, (_, h1, m1, a1, h2, m2, a2) => {
    out.start = toHHMM(h1, m1, a1 || a2); out.end = toHHMM(h2, m2, a2);
  });
  // Single time: at 2pm, @14:30, 9am.
  take(/\s(?:at\s+|@)?(\d{1,2}):(\d{2})\s*(am|pm)?(?=\s)/gi, (_, h, m, ap) => { if (!out.start) out.start = toHHMM(h, m, ap); });
  take(/\s(?:at\s+|@)?(\d{1,2})\s*(am|pm)(?=\s)/gi, (_, h, ap) => { if (!out.start) out.start = toHHMM(h, 0, ap); });
  take(/\s(?:at|@)\s*(\d{1,2})(?=\s)/gi, (_, h) => { if (!out.start) out.start = toHHMM(h, 0); });
  // Day words.
  take(/\s(today|tonight)(?=\s)/gi, () => { out.dayOffset = 0; });
  take(/\s(tomorrow|tmrw|tmr)(?=\s)/gi, () => { out.dayOffset = 1; });
  take(/\sin\s+(\d+)\s+days?(?=\s)/gi, (_, n) => { out.dayOffset = Number(n); });
  take(/\s(?:on\s+|next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?(?=\s)/gi, (_, d) => {
    const idx = DAYS.findIndex(x => x.startsWith(d.toLowerCase().slice(0, 3)));
    if (idx >= 0) out.dayOffset = ((idx - now.getDay() + 7) % 7) || 7;
  });

  out.text = s.replace(/\s+/g, ' ').trim();
  return out;
}

// Short human summary of what was understood, shown under the quick-add box.
export function describe(p, fmtDay) {
  const bits = [];
  if (p.dayOffset) bits.push(fmtDay(p.dayOffset));
  if (p.start) bits.push(p.end ? `${p.start}–${p.end}` : `at ${p.start}`);
  if (p.minutes) bits.push(`${p.minutes} min`);
  if (p.area) bits.push(p.area);
  if (p.priority) bits.push(['', 'Low', 'Medium', 'High'][p.priority] + ' priority');
  if (p.tags.length) bits.push(p.tags.map(t => '#' + t).join(' '));
  return bits.join(' · ');
}
