// ──────────────────────────────────────────────
//  gameState.js — Reactive game-state manager
// ──────────────────────────────────────────────

const HIGH_SCORE_KEY = 'alien_invasion_highscore';

/**
 * Game state constants.
 * @enum {string}
 */
export const GameStates = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
});

// ── Default values ────────────────────────────

function createDefaults() {
  return {
    gameState: GameStates.MENU,
    score: 0,
    wave: 0,
    kills: 0,
    health: 100,
    shield: 0,
    ammo: 30,
    maxAmmo: 30,
    highScore: loadHighScore(),
    // Per-wave stats for end-of-game summary
    waveStats: {
      startTime: 0,
      enemiesSpawned: 0,
      enemiesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
    },
  };
}

// ── localStorage helpers ──────────────────────

function loadHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch { /* silently ignore */ }
}

// ── Reactive state class ──────────────────────

class GameState {
  constructor() {
    /** @type {ReturnType<typeof createDefaults>} */
    this._state = createDefaults();

    /** @type {Set<(key: string, value: any, state: object) => void>} */
    this._subscribers = new Set();
  }

  // ── Read ─────────────────────────────────────

  /** Return a shallow copy of the full state. */
  getState() {
    return { ...this._state };
  }

  /** Convenience getter for a single key. */
  get(key) {
    return this._state[key];
  }

  // ── Write ────────────────────────────────────

  /**
   * Merge partial state updates.  Notifies subscribers for every changed key.
   * @param {Partial<ReturnType<typeof createDefaults>>} partial
   */
  setState(partial) {
    for (const key of Object.keys(partial)) {
      if (!(key in this._state)) continue;
      const oldVal = this._state[key];
      const newVal = partial[key];
      if (oldVal !== newVal) {
        this._state[key] = newVal;
        this._notify(key, newVal);
      }
    }

    // Persist high score whenever score exceeds it
    if (partial.score !== undefined && this._state.score > this._state.highScore) {
      this._state.highScore = this._state.score;
      saveHighScore(this._state.highScore);
      this._notify('highScore', this._state.highScore);
    }
  }

  // ── Subscribe / Unsubscribe ──────────────────

  /**
   * Register a callback that fires on every state change.
   * @param {(key: string, value: any, state: object) => void} fn
   * @returns {() => void} unsubscribe function
   */
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  // ── Wave stat helpers ────────────────────────

  /** Increment a wave-stat counter by `amount` (default 1). */
  addWaveStat(key, amount = 1) {
    if (key in this._state.waveStats) {
      this._state.waveStats[key] += amount;
    }
  }

  /** Reset wave stats for a new wave. */
  resetWaveStats() {
    this._state.waveStats = {
      startTime: performance.now(),
      enemiesSpawned: 0,
      enemiesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
    };
  }

  /** Return accuracy percentage for the current wave. */
  getAccuracy() {
    const { shotsFired, shotsHit } = this._state.waveStats;
    return shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  }

  // ── Reset for new game ──────────────────────

  reset() {
    const hs = this._state.highScore; // preserve high score
    const defaults = createDefaults();
    defaults.highScore = hs;
    this._state = defaults;

    // Notify every key so UI refreshes fully
    for (const key of Object.keys(this._state)) {
      this._notify(key, this._state[key]);
    }
  }

  // ── Private ──────────────────────────────────

  /** @private */
  _notify(key, value) {
    for (const fn of this._subscribers) {
      try {
        fn(key, value, this._state);
      } catch (err) {
        console.error('[GameState] subscriber error:', err);
      }
    }
  }
}

export const gameState = new GameState();
