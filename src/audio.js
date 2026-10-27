/**
 * Procedural Audio System for ALIEN INVASION
 *
 * Generates all game audio procedurally using the Web Audio API — no external
 * audio files required.  Every sound is built from combinations of oscillators,
 * filtered noise buffers, frequency sweeps, and gain-envelope shaping.
 *
 * Signal chain:
 *   source → sfxGain / musicGain → masterGain → destination
 *
 * @module audio
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/**
 * Create a white-noise AudioBuffer (mono, 2 s long).
 * Re-used by every noise-based sound so we only allocate once.
 */
function createNoiseBuffer(ctx, duration = 2) {
  const length = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Create a pink-noise AudioBuffer (mono, 2 s long).
 * Uses Paul Kellet's refined method.
 */
function createPinkNoiseBuffer(ctx, duration = 2) {
  const length = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    data[i] = pink;
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

class AudioManager {
  constructor() {
    /** @type {AudioContext | null} */
    this._ctx = null;

    // Gain nodes (created lazily in _ensureContext)
    /** @type {GainNode | null} */ this._masterGain = null;
    /** @type {GainNode | null} */ this._sfxGain = null;
    /** @type {GainNode | null} */ this._musicGain = null;

    // Volume scalars (applied to gain nodes)
    this._masterVol = 0.7;
    this._sfxVol = 0.8;
    this._musicVol = 0.5;

    // Noise buffers (created once)
    /** @type {AudioBuffer | null} */ this._whiteNoise = null;
    /** @type {AudioBuffer | null} */ this._pinkNoise = null;

    // Active source tracking for sound-pool limiting
    /** @type {Set<AudioNode>} */
    this._activeSources = new Set();
    this._maxConcurrent = 16;

    // Music state
    /** @type {object | null} */ this._currentMusic = null;
    this._combatIntensity = 0.5;
  }

  // -----------------------------------------------------------------------
  // Context bootstrap
  // -----------------------------------------------------------------------

  /**
   * Lazily create / resume the AudioContext. Safe to call many times.
   * Returns immediately — sounds scheduled on a suspended context will play
   * once the context resumes on user gesture.
   */
  _ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this._ctx) {
      this._ctx = new AudioCtx();

      // Build gain chain: source → sfx/music → master → destination
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._masterVol;
      this._masterGain.connect(this._ctx.destination);

      this._sfxGain = this._ctx.createGain();
      this._sfxGain.gain.value = this._sfxVol;
      this._sfxGain.connect(this._masterGain);

      this._musicGain = this._ctx.createGain();
      this._musicGain.gain.value = this._musicVol;
      this._musicGain.connect(this._masterGain);

      // Pre-generate noise buffers
      this._whiteNoise = createNoiseBuffer(this._ctx);
      this._pinkNoise = createPinkNoiseBuffer(this._ctx);
    }

    // Auto-resume on user interaction (Chrome policy)
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }

    return this._ctx;
  }

  // -----------------------------------------------------------------------
  // Source tracking / pooling
  // -----------------------------------------------------------------------

  /**
   * Register an audio source so we can cap concurrency.
   * Automatically removes itself when the node ends.
   */
  _track(node) {
    if (this._activeSources.size >= this._maxConcurrent) {
      // Drop oldest source to make room
      const oldest = this._activeSources.values().next().value;
      if (oldest) {
        try { oldest.stop(); } catch (_) { /* already stopped */ }
        this._activeSources.delete(oldest);
      }
    }
    this._activeSources.add(node);
    node.onended = () => {
      this._activeSources.delete(node);
      node.disconnect();
    };
  }

  // -----------------------------------------------------------------------
  // Primitive builders (internal)
  // -----------------------------------------------------------------------

  /**
   * Convenience: create an OscillatorNode already connected through a
   * per-voice GainNode → the SFX bus.  Returns { osc, gain } so the caller
   * can shape the envelope and schedule start/stop.
   */
  _osc(type = 'sine', freq = 440) {
    const ctx = this._ensureContext();
    if (!ctx) {
      const noop = () => {};
      return {
        osc: { type, frequency: { value: freq, setValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop, start: noop, stop: noop },
        gain: { gain: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop },
        ctx: { currentTime: 0, createOscillator: () => ({ connect: noop, start: noop, stop: noop, frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop } }), createGain: () => ({ gain: { setValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop }) },
      };
    }
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.value = 0; // caller sets envelope
    osc.connect(gain);
    gain.connect(this._sfxGain);

    return { osc, gain, ctx };
  }

  /**
   * Noise burst routed through a filter → per-voice gain → SFX bus.
   * @param {'white'|'pink'} color
   * @param {BiquadFilterType} filterType
   * @param {number} filterFreq
   */
  _noise(color = 'white', filterType = 'lowpass', filterFreq = 4000) {
    const ctx = this._ensureContext();
    if (!ctx) {
      const noop = () => {};
      return {
        src: { buffer: null, loop: false, connect: noop, start: noop, stop: noop },
        filter: { type: filterType, frequency: { value: filterFreq } },
        gain: { gain: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop } },
        ctx: { currentTime: 0 },
      };
    }
    const src = ctx.createBufferSource();
    src.buffer = color === 'pink' ? this._pinkNoise : this._whiteNoise;
    src.loop = false;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._sfxGain);

    return { src, filter, gain, ctx };
  }

  // -----------------------------------------------------------------------
  // Volume controls
  // -----------------------------------------------------------------------

  setMasterVolume(v) {
    this._masterVol = Math.max(0, Math.min(1, v));
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._masterVol, this._ctx.currentTime, 0.02);
    }
  }

  setSFXVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (this._sfxGain) {
      this._sfxGain.gain.setTargetAtTime(this._sfxVol, this._ctx.currentTime, 0.02);
    }
  }

  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this._musicGain) {
      this._musicGain.gain.setTargetAtTime(this._musicVol, this._ctx.currentTime, 0.02);
    }
  }

  setSfxVolume(v) {
    this.setSFXVolume(v);
  }

  async init() {
    this._ensureContext();
  }

  playMusic() {
    this.startCombatMusic();
  }

  pauseMusic() {
    this.stopMusic(0.2);
  }

  resumeMusic() {
    this.startCombatMusic();
  }

  update(dt) {
    // Audio engine active
  }

  playSfx(name) {
    if (!this._ensureContext()) return;
    switch (name) {
      case 'laser':
      case 'shoot':
        this.playShoot();
        break;
      case 'shotgun':
        this.playShoot();
        break;
      case 'rocket':
        this.playShoot();
        break;
      case 'explosion':
        this.playExplosion();
        break;
      case 'hit':
      case 'enemyHit':
      case 'ricochet':
        this.playHit();
        break;
      case 'playerHurt':
      case 'shieldHit':
        this.playPlayerHit();
        break;
      case 'playerDeath':
      case 'gameOver':
        this.playGameOver();
        break;
      case 'enemyDeath':
      case 'bossDeath':
        this.playExplosion();
        break;
      case 'pickup':
      case 'heal':
      case 'shieldRestore':
      case 'powerup':
        this.playPickup();
        break;
      case 'reload':
        this.playReload();
        break;
      case 'dash':
        this.playDodge();
        break;
      case 'waveStart':
        this.playWaveStart();
        break;
      case 'waveClear':
        this.playWaveComplete();
        break;
      case 'victory':
        this.playVictory();
        break;
      case 'menuClick':
      case 'switchWeapon':
        this.playMenuSelect();
        break;
      case 'menuHover':
        this.playMenuHover();
        break;
      case 'enemySpit':
        this.playEnemyShoot();
        break;
      case 'bruteRoar':
      case 'bossRoar':
      case 'bossOrb':
      case 'bossBarrage':
        this.playBossRoar();
        break;
      default:
        break;
    }
  }

  // -----------------------------------------------------------------------
  // SFX — Weapon & Combat
  // -----------------------------------------------------------------------

  /** Laser / plasma weapon fire — bright zap with pitch sweep down. */
  playShoot() {
    const { osc, gain, ctx } = this._osc('sawtooth', 1800);
    const t = ctx.currentTime;

    // Pitch sweep 1800 → 300 Hz
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);

    // Sharp attack, quick decay
    gain.gain.setValueAtTime(0.30, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    // Add a second harmonic layer for brightness
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2400, t);
    osc2.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc2.connect(g2);
    g2.connect(this._sfxGain);

    osc.start(t);
    osc.stop(t + 0.12);
    osc2.start(t);
    osc2.stop(t + 0.08);

    this._track(osc);
    this._track(osc2);
  }

  /** Enemy hit confirmation — punchy transient click/thud. */
  playHit() {
    const { osc, gain, ctx } = this._osc('sine', 600);
    const t = ctx.currentTime;

    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

    gain.gain.setValueAtTime(0.40, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    // Noise transient for the "click"
    const n = this._noise('white', 'bandpass', 3000);
    n.filter.Q.value = 2;
    n.gain.gain.setValueAtTime(0.20, t);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    n.src.start(t);
    n.src.stop(t + 0.05);

    osc.start(t);
    osc.stop(t + 0.10);

    this._track(osc);
    this._track(n.src);
  }

  /** Enemy death explosion — rumbling boom with filtered noise decay. */
  playExplosion() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Sub-bass sine thump
    const { osc, gain } = this._osc('sine', 80);
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);
    gain.gain.setValueAtTime(0.50, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.start(t);
    osc.stop(t + 0.75);
    this._track(osc);

    // Mid rumble — sawtooth crunch
    const { osc: osc2, gain: g2 } = this._osc('sawtooth', 120);
    osc2.frequency.setValueAtTime(120, t);
    osc2.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.start(t);
    osc2.stop(t + 0.55);
    this._track(osc2);

    // Noise burst — filtered rumble tail
    const n = this._noise('pink', 'lowpass', 800);
    n.filter.frequency.setValueAtTime(800, t);
    n.filter.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    n.gain.gain.setValueAtTime(0.35, t);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    n.src.start(t);
    n.src.stop(t + 1.0);
    this._track(n.src);
  }

  /** Player damage — heavy low impact with distortion. */
  playPlayerHit() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Low sine impact
    const { osc, gain } = this._osc('sine', 200);
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    // Waveshaper for distortion
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 3.0) * x / (Math.PI + 3.0 * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = '2x';

    // Re-route: osc → shaper → gain (already connected to sfxGain)
    osc.disconnect();
    osc.connect(shaper);
    shaper.connect(gain);

    osc.start(t);
    osc.stop(t + 0.3);
    this._track(osc);

    // Harsh noise layer
    const n = this._noise('white', 'lowpass', 1200);
    n.gain.gain.setValueAtTime(0.25, t);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.src.start(t);
    n.src.stop(t + 0.2);
    this._track(n.src);
  }

  /** Health/ammo pickup — bright ascending chime. */
  playPickup() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    const notes = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6
    const dur = 0.08;

    notes.forEach((freq, i) => {
      const { osc, gain } = this._osc('sine', freq);
      const start = t + i * dur;
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur * 1.8);

      // Add a triangle layer for shimmer
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.08, start);
      g2.gain.exponentialRampToValueAtTime(0.001, start + dur * 1.5);
      osc2.connect(g2);
      g2.connect(this._sfxGain);

      osc.start(start);
      osc.stop(start + dur * 2);
      osc2.start(start);
      osc2.stop(start + dur * 2);

      this._track(osc);
      this._track(osc2);
    });
  }

  /** Weapon reload — mechanical click sequence. */
  playReload() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Three distinct click/clunk sounds at short intervals
    const timings = [0, 0.12, 0.28];
    const freqs = [2200, 1600, 3000];

    timings.forEach((offset, i) => {
      const start = t + offset;

      // Metallic click (high bandpass noise)
      const n = this._noise('white', 'bandpass', freqs[i]);
      n.filter.Q.value = 8;
      n.gain.gain.setValueAtTime(0.25, start);
      n.gain.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
      n.src.start(start);
      n.src.stop(start + 0.04);
      this._track(n.src);

      // Tonal ping
      const { osc, gain } = this._osc('square', freqs[i]);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.025);
      osc.start(start);
      osc.stop(start + 0.03);
      this._track(osc);
    });

    // Final satisfying clack — heavier low click
    const { osc: clack, gain: clackG } = this._osc('sine', 400);
    const clackT = t + 0.42;
    clack.frequency.setValueAtTime(400, clackT);
    clack.frequency.exponentialRampToValueAtTime(120, clackT + 0.04);
    clackG.gain.setValueAtTime(0.30, clackT);
    clackG.gain.exponentialRampToValueAtTime(0.001, clackT + 0.06);
    clack.start(clackT);
    clack.stop(clackT + 0.08);
    this._track(clack);
  }

  /** Dodge/dash — breathy whoosh. */
  playDodge() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Bandpass-filtered noise with frequency sweep
    const n = this._noise('white', 'bandpass', 600);
    n.filter.Q.value = 1.2;
    n.filter.frequency.setValueAtTime(600, t);
    n.filter.frequency.exponentialRampToValueAtTime(3000, t + 0.08);
    n.filter.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    n.gain.gain.setValueAtTime(0.001, t);
    n.gain.gain.linearRampToValueAtTime(0.30, t + 0.05);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    n.src.start(t);
    n.src.stop(t + 0.30);
    this._track(n.src);

    // Subtle tonal sweep adds "movement" feel
    const { osc, gain } = this._osc('sine', 200);
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.25);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t);
    osc.stop(t + 0.28);
    this._track(osc);
  }

  // -----------------------------------------------------------------------
  // SFX — Wave events
  // -----------------------------------------------------------------------

  /** New wave announcement — epic synth horn stinger. */
  playWaveStart() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Two-note rising horn:  C4 → E4  (dramatic fourth-ish)
    const notes = [
      { freq: 261.63, start: 0, dur: 0.30 },
      { freq: 329.63, start: 0.25, dur: 0.45 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const s = t + start;

      // Sawtooth body
      const { osc, gain } = this._osc('sawtooth', freq);
      gain.gain.setValueAtTime(0.001, s);
      gain.gain.linearRampToValueAtTime(0.25, s + 0.04);
      gain.gain.setValueAtTime(0.25, s + dur - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.01);
      this._track(osc);

      // Square sub-octave
      const { osc: sub, gain: sg } = this._osc('square', freq / 2);
      sg.gain.setValueAtTime(0.001, s);
      sg.gain.linearRampToValueAtTime(0.10, s + 0.05);
      sg.gain.setValueAtTime(0.10, s + dur - 0.1);
      sg.gain.exponentialRampToValueAtTime(0.001, s + dur);
      sub.start(s);
      sub.stop(s + dur + 0.01);
      this._track(sub);
    });

    // Noise swell for impact
    const n = this._noise('pink', 'lowpass', 2000);
    n.gain.gain.setValueAtTime(0.001, t);
    n.gain.gain.linearRampToValueAtTime(0.12, t + 0.15);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.src.start(t);
    n.src.stop(t + 0.75);
    this._track(n.src);
  }

  /** Wave cleared — triumphant three-note fanfare. */
  playWaveComplete() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // C5 → E5 → G5 (major triad ascending)
    const fanfare = [
      { freq: 523.25, start: 0, dur: 0.20 },
      { freq: 659.25, start: 0.18, dur: 0.20 },
      { freq: 783.99, start: 0.36, dur: 0.50 },
    ];

    fanfare.forEach(({ freq, start, dur }) => {
      const s = t + start;

      // Bright triangle
      const { osc, gain } = this._osc('triangle', freq);
      gain.gain.setValueAtTime(0.001, s);
      gain.gain.linearRampToValueAtTime(0.25, s + 0.02);
      gain.gain.setValueAtTime(0.25, s + dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.01);
      this._track(osc);

      // Octave shimmer
      const { osc: shim, gain: sg } = this._osc('sine', freq * 2);
      sg.gain.setValueAtTime(0.001, s);
      sg.gain.linearRampToValueAtTime(0.08, s + 0.03);
      sg.gain.exponentialRampToValueAtTime(0.001, s + dur);
      shim.start(s);
      shim.stop(s + dur + 0.01);
      this._track(shim);
    });
  }

  // -----------------------------------------------------------------------
  // SFX — UI
  // -----------------------------------------------------------------------

  /** Menu button click — short digital blip. */
  playMenuSelect() {
    const { osc, gain, ctx } = this._osc('square', 1200);
    const t = ctx.currentTime;

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    const { osc: o2, gain: g2 } = this._osc('sine', 1800);
    g2.gain.setValueAtTime(0.10, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.start(t);
    osc.stop(t + 0.06);
    o2.start(t);
    o2.stop(t + 0.05);
    this._track(osc);
    this._track(o2);
  }

  /** Menu hover — subtle soft tone. */
  playMenuHover() {
    const { osc, gain, ctx } = this._osc('sine', 900);
    const t = ctx.currentTime;

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.start(t);
    osc.stop(t + 0.07);
    this._track(osc);
  }

  /** Game over — descending ominous tone sequence. */
  playGameOver() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Descending minor thirds: E4 → C4 → Ab3 → E3
    const notes = [
      { freq: 329.63, start: 0 },
      { freq: 261.63, start: 0.30 },
      { freq: 207.65, start: 0.60 },
      { freq: 164.81, start: 0.90 },
    ];

    notes.forEach(({ freq, start }, i) => {
      const s = t + start;
      const dur = 0.35 + i * 0.1;

      // Sawtooth for dark timbre
      const { osc, gain } = this._osc('sawtooth', freq);
      gain.gain.setValueAtTime(0.001, s);
      gain.gain.linearRampToValueAtTime(0.18, s + 0.04);
      gain.gain.setValueAtTime(0.18, s + dur * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, s + dur);

      // Low-pass filter for "muffled doom"
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800 - i * 120;
      lp.Q.value = 2;
      osc.disconnect();
      osc.connect(lp);
      lp.connect(gain);

      osc.start(s);
      osc.stop(s + dur + 0.01);
      this._track(osc);
    });

    // Rumble sub underneath
    const n = this._noise('pink', 'lowpass', 200);
    n.gain.gain.setValueAtTime(0.001, t);
    n.gain.gain.linearRampToValueAtTime(0.15, t + 0.3);
    n.gain.gain.setValueAtTime(0.15, t + 1.0);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    n.src.start(t);
    n.src.stop(t + 1.7);
    this._track(n.src);
  }

  /** Victory fanfare — ascending triumphant tones (C major arpeggio). */
  playVictory() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // C5→E5→G5→C6 arpeggiated then final chord
    const arp = [
      { freq: 523.25, start: 0, dur: 0.15 },
      { freq: 659.25, start: 0.12, dur: 0.15 },
      { freq: 783.99, start: 0.24, dur: 0.15 },
      { freq: 1046.50, start: 0.36, dur: 0.60 },
    ];

    arp.forEach(({ freq, start, dur }) => {
      const s = t + start;

      const { osc, gain } = this._osc('triangle', freq);
      gain.gain.setValueAtTime(0.001, s);
      gain.gain.linearRampToValueAtTime(0.22, s + 0.02);
      gain.gain.setValueAtTime(0.22, s + dur * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
      osc.start(s);
      osc.stop(s + dur + 0.01);
      this._track(osc);

      // Octave double for brightness
      const { osc: o2, gain: g2 } = this._osc('sine', freq * 2);
      g2.gain.setValueAtTime(0.001, s);
      g2.gain.linearRampToValueAtTime(0.07, s + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.001, s + dur);
      o2.start(s);
      o2.stop(s + dur + 0.01);
      this._track(o2);
    });

    // Sustained chord at the end  (C5+E5+G5)
    const chordStart = t + 0.50;
    const chordDur = 0.8;
    [523.25, 659.25, 783.99].forEach((freq) => {
      const { osc, gain } = this._osc('triangle', freq);
      gain.gain.setValueAtTime(0.001, chordStart);
      gain.gain.linearRampToValueAtTime(0.14, chordStart + 0.05);
      gain.gain.setValueAtTime(0.14, chordStart + chordDur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + chordDur);
      osc.start(chordStart);
      osc.stop(chordStart + chordDur + 0.01);
      this._track(osc);
    });
  }

  /** Enemy projectile fire — alien warble / chirp. */
  playEnemyShoot() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // FM-style warble: carrier modulated by a fast LFO
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(600, t);
    carrier.frequency.exponentialRampToValueAtTime(200, t + 0.12);

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 40;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.22, t);
    envGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    carrier.connect(envGain);
    envGain.connect(this._sfxGain);

    carrier.start(t);
    carrier.stop(t + 0.16);
    lfo.start(t);
    lfo.stop(t + 0.16);

    this._track(carrier);
  }

  /** Boss appearance — deep rumbling growl with overtones. */
  playBossRoar() {
    const ctx = this._ensureContext();
    const t = ctx.currentTime;

    // Deep fundamental with pitch bend
    const { osc, gain } = this._osc('sawtooth', 60);
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.4);
    osc.frequency.linearRampToValueAtTime(55, t + 0.8);
    osc.frequency.exponentialRampToValueAtTime(25, t + 1.5);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.15);
    gain.gain.setValueAtTime(0.35, t + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);

    // Distortion for growl texture
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 4);
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    osc.disconnect();
    osc.connect(shaper);
    shaper.connect(gain);

    osc.start(t);
    osc.stop(t + 1.7);
    this._track(osc);

    // Rumble noise
    const n = this._noise('pink', 'lowpass', 300);
    n.filter.frequency.setValueAtTime(300, t);
    n.filter.frequency.exponentialRampToValueAtTime(80, t + 1.5);
    n.gain.gain.setValueAtTime(0.001, t);
    n.gain.gain.linearRampToValueAtTime(0.22, t + 0.2);
    n.gain.gain.setValueAtTime(0.22, t + 0.9);
    n.gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    n.src.start(t);
    n.src.stop(t + 1.7);
    this._track(n.src);

    // Overtone growl harmonics
    [120, 180].forEach((freq) => {
      const { osc: h, gain: hg } = this._osc('square', freq);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = freq * 2;
      lp.Q.value = 3;
      h.disconnect();
      h.connect(lp);
      lp.connect(hg);
      hg.gain.setValueAtTime(0.001, t);
      hg.gain.linearRampToValueAtTime(0.08, t + 0.2);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      h.start(t);
      h.stop(t + 1.5);
      this._track(h);
    });
  }

  // -----------------------------------------------------------------------
  // Music System
  // -----------------------------------------------------------------------

  /** Stop whatever music is playing with a fade-out. */
  stopMusic(fadeDuration = 1.0) {
    if (!this._currentMusic) return;

    const ctx = this._ensureContext();
    const t = ctx.currentTime;
    const music = this._currentMusic;
    this._currentMusic = null;

    // Fade out the music group gain
    if (music.groupGain) {
      music.groupGain.gain.setValueAtTime(music.groupGain.gain.value, t);
      music.groupGain.gain.linearRampToValueAtTime(0, t + fadeDuration);
    }

    // Schedule stop for all sources
    const stopTime = t + fadeDuration + 0.1;
    if (music.sources) {
      music.sources.forEach((src) => {
        try { src.stop(stopTime); } catch (_) { /* already stopped */ }
      });
    }
    if (music.oscs) {
      music.oscs.forEach((osc) => {
        try { osc.stop(stopTime); } catch (_) { /* already stopped */ }
      });
    }
  }

  /**
   * Ambient sci-fi drone for the title/menu screen.
   * Layers: low pad, mid shimmer, high sparkle, filtered noise atmosphere.
   */
  startMenuMusic() {
    this.stopMusic(0.3);

    const ctx = this._ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Group gain for this music instance
    const groupGain = ctx.createGain();
    groupGain.gain.setValueAtTime(0, t);
    groupGain.gain.linearRampToValueAtTime(1.0, t + 2.0);
    groupGain.connect(this._musicGain);

    const oscs = [];
    const sources = [];

    // --- Layer 1: Low drone pad (C2 + G2) ---
    [65.41, 98.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      osc.connect(g);
      g.connect(groupGain);
      osc.start(t);
      oscs.push(osc);
    });

    // --- Layer 2: Mid shimmer (slow detuned triangle) ---
    {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 261.63; // C4
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.3;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 3;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.04;
      osc.connect(g);
      g.connect(groupGain);
      osc.start(t);
      lfo.start(t);
      oscs.push(osc, lfo);
    }

    // --- Layer 3: High sparkle (sine with slow tremolo) ---
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 783.99; // G5
      const tremLfo = ctx.createOscillator();
      tremLfo.type = 'sine';
      tremLfo.frequency.value = 0.15;
      const tremG = ctx.createGain();
      tremG.gain.value = 0.02;
      const g = ctx.createGain();
      g.gain.value = 0.02;
      tremLfo.connect(tremG);
      tremG.connect(g.gain);
      osc.connect(g);
      g.connect(groupGain);
      osc.start(t);
      tremLfo.start(t);
      oscs.push(osc, tremLfo);
    }

    // --- Layer 4: Filtered noise atmosphere ---
    {
      const noise = ctx.createBufferSource();
      noise.buffer = this._pinkNoise;
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 400;
      bp.Q.value = 0.5;
      // Slow filter sweep via LFO
      const filterLfo = ctx.createOscillator();
      filterLfo.type = 'sine';
      filterLfo.frequency.value = 0.08;
      const filterLfoG = ctx.createGain();
      filterLfoG.gain.value = 200;
      filterLfo.connect(filterLfoG);
      filterLfoG.connect(bp.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.06;
      noise.connect(bp);
      bp.connect(g);
      g.connect(groupGain);
      noise.start(t);
      filterLfo.start(t);
      sources.push(noise);
      oscs.push(filterLfo);
    }

    this._currentMusic = { groupGain, oscs, sources, type: 'menu' };
  }

  /**
   * Driving combat music loop with bass, rhythm, and layered intensity.
   * Uses ScriptProcessor-free approach: oscillators for bass and lead,
   * noise + gain-envelope rhythm (pseudo kick/hat patterns).
   */
  startCombatMusic() {
    this.stopMusic(0.3);

    const ctx = this._ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const groupGain = ctx.createGain();
    groupGain.gain.setValueAtTime(0, t);
    groupGain.gain.linearRampToValueAtTime(1.0, t + 1.0);
    groupGain.connect(this._musicGain);

    const oscs = [];
    const sources = [];

    const bpm = 140;
    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;

    // We'll schedule a repeating loop using a long oscillator setup
    // and a ConstantSource-based envelope pattern.

    // --- Bass Layer (always on) ---
    // Low sawtooth filtered through lowpass
    {
      const bassOsc = ctx.createOscillator();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.value = 55; // A1
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.value = 200;
      bassFilter.Q.value = 4;
      // Sidechain-style pumping via gain LFO
      const pumpLfo = ctx.createOscillator();
      pumpLfo.type = 'sine';
      pumpLfo.frequency.value = bpm / 60; // pump on every beat
      const pumpG = ctx.createGain();
      pumpG.gain.value = 0.06;
      const bassGain = ctx.createGain();
      bassGain.gain.value = 0.15;
      pumpLfo.connect(pumpG);
      pumpG.connect(bassGain.gain);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(groupGain);
      bassOsc.start(t);
      pumpLfo.start(t);
      oscs.push(bassOsc, pumpLfo);
    }

    // --- Kick-like pulse (low sine with fast envelope, looped) ---
    // We simulate a repeating kick with a ConstantSource driving gain
    // shaped by a waveshaper to create periodic pulses.
    {
      const kickOsc = ctx.createOscillator();
      kickOsc.type = 'sine';
      kickOsc.frequency.value = 55;

      // Create a pulse LFO: square wave at beat rate → fast gain envelope
      const pulseLfo = ctx.createOscillator();
      pulseLfo.type = 'square';
      pulseLfo.frequency.value = bpm / 60;
      // Use a waveshaper to convert bipolar square → unipolar spike
      const rectifier = ctx.createWaveShaper();
      const rectCurve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        rectCurve[i] = x > 0.8 ? 1 : 0;
      }
      rectifier.curve = rectCurve;
      const kickGain = ctx.createGain();
      kickGain.gain.value = 0;
      const kickVol = ctx.createGain();
      kickVol.gain.value = 0.22;
      pulseLfo.connect(rectifier);
      rectifier.connect(kickGain.gain);
      kickOsc.connect(kickGain);
      kickGain.connect(kickVol);
      kickVol.connect(groupGain);
      kickOsc.start(t);
      pulseLfo.start(t);
      oscs.push(kickOsc, pulseLfo);
    }

    // --- Hi-hat noise rhythm (on off-beats) ---
    {
      const hatNoise = ctx.createBufferSource();
      hatNoise.buffer = this._whiteNoise;
      hatNoise.loop = true;
      const hatBp = ctx.createBiquadFilter();
      hatBp.type = 'highpass';
      hatBp.frequency.value = 8000;
      // Square LFO at 2x beat for off-beats
      const hatLfo = ctx.createOscillator();
      hatLfo.type = 'square';
      hatLfo.frequency.value = (bpm / 60) * 2;
      const hatRect = ctx.createWaveShaper();
      const hatCurve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        hatCurve[i] = x > 0 ? 1 : 0;
      }
      hatRect.curve = hatCurve;
      const hatGain = ctx.createGain();
      hatGain.gain.value = 0;
      const hatVol = ctx.createGain();
      // Intensity-controlled: louder at higher intensity
      hatVol.gain.value = 0.06 * this._combatIntensity;
      hatLfo.connect(hatRect);
      hatRect.connect(hatGain.gain);
      hatNoise.connect(hatBp);
      hatBp.connect(hatGain);
      hatGain.connect(hatVol);
      hatVol.connect(groupGain);
      hatNoise.start(t);
      hatLfo.start(t);
      sources.push(hatNoise);
      oscs.push(hatLfo);

      // Store reference for intensity control
      this._combatHatVol = hatVol;
    }

    // --- Lead synth layer (intensity-controlled) ---
    {
      const leadOsc = ctx.createOscillator();
      leadOsc.type = 'square';
      leadOsc.frequency.value = 220; // A3
      // Vibrato
      const vibLfo = ctx.createOscillator();
      vibLfo.type = 'sine';
      vibLfo.frequency.value = 5;
      const vibG = ctx.createGain();
      vibG.gain.value = 4;
      vibLfo.connect(vibG);
      vibG.connect(leadOsc.frequency);
      // Filter for warmth
      const leadFilter = ctx.createBiquadFilter();
      leadFilter.type = 'lowpass';
      leadFilter.frequency.value = 800;
      leadFilter.Q.value = 2;
      const leadGain = ctx.createGain();
      leadGain.gain.value = 0.08 * this._combatIntensity;
      leadOsc.connect(leadFilter);
      leadFilter.connect(leadGain);
      leadGain.connect(groupGain);
      leadOsc.start(t);
      vibLfo.start(t);
      oscs.push(leadOsc, vibLfo);

      this._combatLeadGain = leadGain;
      this._combatLeadFilter = leadFilter;
    }

    // --- Tension pad (intensity-controlled) ---
    {
      // Dissonant minor second cluster for high-intensity tension
      [220, 233.08].forEach((freq) => { // A3 and Bb3
        const padOsc = ctx.createOscillator();
        padOsc.type = 'sawtooth';
        padOsc.frequency.value = freq;
        const padLp = ctx.createBiquadFilter();
        padLp.type = 'lowpass';
        padLp.frequency.value = 400;
        const padG = ctx.createGain();
        padG.gain.value = 0.04 * Math.max(0, this._combatIntensity - 0.4);
        padOsc.connect(padLp);
        padLp.connect(padG);
        padG.connect(groupGain);
        padOsc.start(t);
        oscs.push(padOsc);
      });
    }

    this._currentMusic = { groupGain, oscs, sources, type: 'combat' };
  }

  /**
   * Dynamically adjust combat music intensity (0–1).
   * 0 = minimal (just bass + kick),  1 = full layers.
   */
  setCombatIntensity(value) {
    this._combatIntensity = Math.max(0, Math.min(1, value));

    if (this._currentMusic && this._currentMusic.type === 'combat') {
      const ctx = this._ensureContext();
      const t = ctx.currentTime;

      if (this._combatHatVol) {
        this._combatHatVol.gain.setTargetAtTime(
          0.06 * this._combatIntensity, t, 0.3
        );
      }
      if (this._combatLeadGain) {
        this._combatLeadGain.gain.setTargetAtTime(
          0.08 * this._combatIntensity, t, 0.3
        );
      }
      if (this._combatLeadFilter) {
        this._combatLeadFilter.frequency.setTargetAtTime(
          400 + 1200 * this._combatIntensity, t, 0.3
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /** Force-stop everything (useful on scene transitions). */
  dispose() {
    this.stopMusic(0);
    this._activeSources.forEach((src) => {
      try { src.stop(); } catch (_) { /* noop */ }
    });
    this._activeSources.clear();
    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
      this._masterGain = null;
      this._sfxGain = null;
      this._musicGain = null;
      this._whiteNoise = null;
      this._pinkNoise = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const audio = new AudioManager();
export { AudioManager };
