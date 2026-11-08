let ctx;
export const sounds = { on: true };
export const haptics = { on: true };

function tone(freq, start, dur, vol = 0.06) {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(), g = ctx.createGain();
  const t0 = ctx.currentTime + start;
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const PATTERNS = { save: [10], complete: [12, 40, 12], cancel: [22] };

// Plays the sound and the haptic together. Haptics only fire on devices that support them.
export function play(kind) {
  if (haptics.on && navigator.vibrate) navigator.vibrate(PATTERNS[kind] || 10);
  if (!sounds.on) return;
  try {
    if (kind === 'save') { tone(660, 0, 0.12); tone(880, 0.08, 0.18); }
    else if (kind === 'complete') { tone(523, 0, 0.1); tone(784, 0.09, 0.1); tone(1047, 0.18, 0.22); }
    else if (kind === 'cancel') { tone(330, 0, 0.2, 0.05); }
  } catch { /* audio unavailable, stay silent */ }
}
