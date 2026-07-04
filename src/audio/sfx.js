/**
 * WebAudio SFX — synthesized tones with proper ADSR envelopes.
 * Zero asset deps. Lazy-init on first user gesture (autoplay policy).
 *
 * Sound design (v0.3.0):
 *   - Sine + triangle waves only (no harsh square/sawtooth)
 *   - Short ADSR envelope per sound (5ms attack, exponential release)
 *   - Soft master volume + per-sound gain scaling
 *   - Mute state persisted to localStorage
 *   - wallBounce is much softer (was annoying in v0.1)
 */

let ctx = null;
let masterGain = null;
let muted = false;

const STORAGE_KEY = 'brickbreaker.muted';

function loadMuteState() {
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    muted = false;
  }
}

function saveMuteState() {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch (e) {
    /* localStorage may be unavailable in private mode */
  }
}

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.18;
    masterGain.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

/**
 * ADSR-shaped tone. duration = total time including release.
 */
function tone({
  freq,
  duration = 0.1,
  type = 'sine',
  volume = 0.5,
  attack = 0.005,
  release = null,
}) {
  const c = ensureCtx();
  if (!c || muted) return;
  release = release ?? duration;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  // ADSR: quick attack, hold at volume, exponential release.
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + attack);
  gain.gain.setValueAtTime(volume, now + Math.max(attack, duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/**
 * A short pitch-glide tone — sounds like a soft tap or blip.
 */
function blip(startFreq, endFreq, duration, type = 'sine', volume = 0.4) {
  const c = ensureCtx();
  if (!c || muted) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/**
 * White-noise burst (filtered) — for crash / lose sounds.
 */
function noise(duration, volume = 0.4) {
  const c = ensureCtx();
  if (!c || muted) return;
  const now = c.currentTime;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decay envelope
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = volume;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(now);
  src.stop(now + duration);
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  saveMuteState();
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.18, ctx.currentTime, 0.05);
  }
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

// ---------- Sound library ----------

export const sfx = {
  /** Paddle hit — soft "thunk" with pitch variation based on hit offset. */
  paddleHit: (spin = 0) => {
    // Spin in [-1, 1] shifts pitch ±100Hz around 400Hz.
    const freq = 380 + Math.abs(spin) * 120 + (spin < 0 ? -40 : 0);
    tone({ freq, duration: 0.08, type: 'triangle', volume: 0.35 });
  },

  /** Brick break — short blip + soft noise tail. */
  brickBreak: () => {
    blip(880, 440, 0.06, 'sine', 0.3);
    setTimeout(() => tone({ freq: 220, duration: 0.04, type: 'sine', volume: 0.12 }), 25);
  },

  /** Wall bounce — very soft and short (was the annoying one in v1). */
  wallBounce: () => {
    tone({ freq: 180, duration: 0.025, type: 'sine', volume: 0.1 });
  },

  /** Life lost — descending sweep + noise. */
  lifeLoss: () => {
    blip(300, 80, 0.35, 'triangle', 0.4);
    setTimeout(() => noise(0.15, 0.18), 80);
  },

  /** Power-up — ascending arpeggio. */
  powerUp: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, duration: 0.08, type: 'sine', volume: 0.28 }), i * 60)
    );
  },

  /** Win — triumphant chord. */
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, duration: 0.2, type: 'triangle', volume: 0.35 }), i * 120)
    );
  },

  /** Game over — descending sigh. */
  lose: () => {
    [400, 320, 240, 160].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, duration: 0.25, type: 'triangle', volume: 0.35 }), i * 180)
    );
  },

  /** Launch — quick upward chirp. */
  launch: () => {
    blip(440, 880, 0.08, 'sine', 0.3);
  },
};

// Initialize mute state from storage on module load.
loadMuteState();
