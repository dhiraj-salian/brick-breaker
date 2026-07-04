/**
 * WebAudio SFX — oscillator beeps for v1. Zero asset deps.
 * Lazy-init on first user gesture (autoplay policy).
 */

let ctx = null;
let masterGain = null;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function beep(freq, duration = 0.08, type = 'square', volume = 0.5) {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const sfx = {
  paddleHit: () => beep(440, 0.05, 'square', 0.4),
  brickBreak: () => {
    beep(880, 0.06, 'sawtooth', 0.3);
    setTimeout(() => beep(660, 0.04, 'sine', 0.2), 30);
  },
  wallBounce: () => beep(220, 0.04, 'triangle', 0.25),
  lifeLoss: () => {
    beep(200, 0.2, 'sawtooth', 0.5);
    setTimeout(() => beep(120, 0.3, 'sawtooth', 0.5), 100);
  },
  powerUp: () => {
    beep(523, 0.05, 'sine', 0.4);
    setTimeout(() => beep(659, 0.05, 'sine', 0.4), 50);
    setTimeout(() => beep(784, 0.08, 'sine', 0.4), 100);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'sine', 0.5), i * 100));
  },
  lose: () => {
    [400, 350, 300, 200].forEach((f, i) =>
      setTimeout(() => beep(f, 0.2, 'sawtooth', 0.5), i * 150)
    );
  },
  launch: () => beep(660, 0.06, 'triangle', 0.3),
};
