let ctx;
export const sounds = { on: true };
export const haptics = { on: true };

const ac = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, start, dur, vol = 0.06, type = 'sine') {
  const c = ac();
  const o = c.createOscillator(), g = c.createGain();
  const t0 = c.currentTime + start;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const PATTERNS = { save: [10], complete: [12, 40, 12], cancel: [22], tap: [6], chime: [30, 60, 30, 60, 60], level: [20, 40, 20, 40, 80] };

export function play(kind) {
  if (haptics.on && navigator.vibrate) { try { navigator.vibrate(PATTERNS[kind] || 10); } catch { /* blocked */ } }
  if (!sounds.on) return;
  try {
    if (kind === 'save') { tone(660, 0, 0.12); tone(880, 0.07, 0.16); }
    else if (kind === 'complete') { tone(523, 0, 0.1); tone(784, 0.08, 0.1); tone(1047, 0.16, 0.24); }
    else if (kind === 'cancel') tone(330, 0, 0.18, 0.05);
    else if (kind === 'tap') tone(1200, 0, 0.04, 0.02);
    else if (kind === 'chime') { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.14, 0.6, 0.05)); }
    else if (kind === 'level') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.05, 'triangle')); }
  } catch { /* audio unavailable */ }
}

// ---------- ambient soundscapes, generated live (no audio files) ----------
let amb = null;

function noiseBuffer(c, kind) {
  const len = c.sampleRate * 4, buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink' || kind === 'rain' || kind === 'ocean') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else d[i] = w * 0.5;
    }
  }
  return buf;
}

export const AMBIENTS = { off: 'Off', rain: 'Rain', ocean: 'Ocean waves', brown: 'Brown noise', pink: 'Pink noise', white: 'White noise', cafe: 'Low hum' };

export function ambient(kind, vol = 0.4) {
  stopAmbient();
  if (!kind || kind === 'off') return;
  const c = ac();
  if (c.state === 'suspended') c.resume();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, kind === 'cafe' ? 'brown' : kind);
  src.loop = true;
  const gain = c.createGain();
  gain.gain.value = 0;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = { rain: 9000, ocean: 900, brown: 1200, pink: 8000, white: 12000, cafe: 400 }[kind] || 8000;
  src.connect(filter).connect(gain).connect(c.destination);
  const nodes = [src];
  if (kind === 'ocean') {
    // Slow swell on the volume, like waves.
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 0.08; depth.gain.value = vol * 0.45;
    lfo.connect(depth).connect(gain.gain); lfo.start(); nodes.push(lfo);
  }
  src.start();
  gain.gain.linearRampToValueAtTime(vol * (kind === 'white' ? 0.35 : 0.8), c.currentTime + 1.2);
  amb = { nodes, gain, kind };
}

export function ambientVolume(v) { if (amb) amb.gain.gain.setTargetAtTime(v * (amb.kind === 'white' ? 0.35 : 0.8), ac().currentTime, 0.1); }
export function stopAmbient() {
  if (!amb) return;
  const { nodes, gain } = amb;
  amb = null;
  try {
    gain.gain.setTargetAtTime(0, ac().currentTime, 0.2);
    setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch { /* stopped */ } }), 800);
  } catch { /* gone */ }
}
export const ambientOn = () => amb?.kind || 'off';
