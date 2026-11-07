// Retro UI sounds, synthesised with Web Audio — no audio files.
// The AudioContext can only start after a user gesture (autoplay policy),
// so it is created lazily by unlock() on "Press Start".

let ctx = null;
let muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch (e) {}

export function unlock() {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {
    ctx = null;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('muted', value ? '1' : '0'); } catch (e) {}
}

function ready() {
  return ctx && !muted;
}

function tone({ freq, to = freq, duration, gain, type = 'square', delay = 0 }) {
  if (!ready()) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noise({ duration, gain, filter = 'bandpass', from, to, q = 1, delay = 0 }) {
  if (!ready()) return;
  const start = ctx.currentTime + delay;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(from, start);
  biquad.frequency.exponentialRampToValueAtTime(to, start + duration);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + Math.min(0.01, duration / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(biquad).connect(amp).connect(ctx.destination);
  src.start(start);
  src.stop(start + duration + 0.05);
}

export const sfx = {
  // Rising 8-bit arpeggio for "Press Start".
  start() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone({ freq: f, duration: 0.12, gain: 0.05, delay: i * 0.07 });
    });
  },

  // Soft, slightly detuned pad when the avatar scene fades in.
  boot() {
    for (const [f, d] of [[130.81, 0], [196, 0.04], [261.63, 0.08], [329.63, 0.12]]) {
      tone({ freq: f, to: f * 1.003, duration: 2.6, gain: 0.035, type: 'triangle', delay: d });
    }
  },

  // Two quick autofocus beeps.
  focus() {
    tone({ freq: 2200, duration: 0.05, gain: 0.03, type: 'sine' });
    tone({ freq: 2200, duration: 0.05, gain: 0.03, type: 'sine', delay: 0.11 });
  },

  // Mechanical shutter: click, short noise, second click.
  shutter() {
    noise({ duration: 0.05, gain: 0.25, from: 4000, to: 1500, q: 0.8 });
    noise({ duration: 0.09, gain: 0.18, from: 2500, to: 800, q: 0.7, delay: 0.07 });
    tone({ freq: 180, to: 90, duration: 0.06, gain: 0.08, type: 'square', delay: 0.07 });
  },

  // Airy sweep for the zoom out.
  whoosh() {
    noise({ duration: 2.2, gain: 0.07, filter: 'lowpass', from: 3200, to: 260, q: 1.4 });
  },

  hover() {
    tone({ freq: 1600, to: 1300, duration: 0.03, gain: 0.015 });
  },

  click() {
    tone({ freq: 880, to: 440, duration: 0.07, gain: 0.04 });
  },

  // Glass breaking into a falling sparkle.
  shatter() {
    noise({ duration: 0.12, gain: 0.12, filter: 'highpass', from: 5000, to: 2500, q: 0.7 });
    [2093, 1568, 1319, 1047].forEach((f, i) => {
      tone({ freq: f, duration: 0.09, gain: 0.025, delay: 0.03 + i * 0.045 });
    });
  },

  // Quick rising chime when the handheld spins.
  spin() {
    tone({ freq: 660, to: 990, duration: 0.18, gain: 0.04, type: 'triangle' });
    tone({ freq: 990, to: 1320, duration: 0.2, gain: 0.03, type: 'triangle', delay: 0.12 });
  },

  // Menu "select" blip for jumping to another section.
  page() {
    tone({ freq: 660, duration: 0.06, gain: 0.04 });
    tone({ freq: 990, duration: 0.09, gain: 0.04, delay: 0.06 });
  },

  theme(next) {
    const notes = next === 'dark' ? [784, 523.25] : [523.25, 784];
    tone({ freq: notes[0], duration: 0.1, gain: 0.04 });
    tone({ freq: notes[1], duration: 0.14, gain: 0.04, delay: 0.08 });
  },
};
