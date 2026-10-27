// ──────────────────────────────────────────────
//  settings.js — Persistent game settings
// ──────────────────────────────────────────────

const STORAGE_KEY = 'alien_invasion_settings';

const DEFAULTS = Object.freeze({
  mouseSensitivity: 1.0,
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  graphicsQuality: 'medium', // 'low' | 'medium' | 'high'
  screenShake: true,
});

class Settings {
  constructor() {
    /** @type {typeof DEFAULTS} */
    this._values = { ...DEFAULTS };
    this.load();
  }

  // ── Accessors ────────────────────────────────

  get mouseSensitivity() { return this._values.mouseSensitivity; }
  set mouseSensitivity(v) {
    this._values.mouseSensitivity = Math.max(0.1, Math.min(2.0, Number(v) || DEFAULTS.mouseSensitivity));
    this.save();
  }

  get masterVolume() { return this._values.masterVolume; }
  set masterVolume(v) {
    this._values.masterVolume = Math.max(0, Math.min(1, Number(v) || 0));
    this.save();
  }

  get sfxVolume() { return this._values.sfxVolume; }
  set sfxVolume(v) {
    this._values.sfxVolume = Math.max(0, Math.min(1, Number(v) || 0));
    this.save();
  }

  get musicVolume() { return this._values.musicVolume; }
  set musicVolume(v) {
    this._values.musicVolume = Math.max(0, Math.min(1, Number(v) || 0));
    this.save();
  }

  get graphicsQuality() { return this._values.graphicsQuality; }
  set graphicsQuality(v) {
    const valid = ['low', 'medium', 'high'];
    this._values.graphicsQuality = valid.includes(v) ? v : DEFAULTS.graphicsQuality;
    this.save();
  }

  get screenShake() { return this._values.screenShake; }
  set screenShake(v) {
    this._values.screenShake = Boolean(v);
    this.save();
  }

  // ── Bulk get / set ───────────────────────────

  /** Return a plain copy of all current settings. */
  getAll() {
    return { ...this._values };
  }

  /**
   * Merge partial settings into the current values.
   * Unknown keys are silently ignored.
   */
  setAll(partial) {
    if (partial.mouseSensitivity !== undefined) this.mouseSensitivity = partial.mouseSensitivity;
    if (partial.masterVolume !== undefined) this.masterVolume = partial.masterVolume;
    if (partial.sfxVolume !== undefined) this.sfxVolume = partial.sfxVolume;
    if (partial.musicVolume !== undefined) this.musicVolume = partial.musicVolume;
    if (partial.graphicsQuality !== undefined) this.graphicsQuality = partial.graphicsQuality;
    if (partial.screenShake !== undefined) this.screenShake = partial.screenShake;
  }

  // ── Persistence ──────────────────────────────

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._values));
    } catch { /* quota exceeded — silently ignore */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults so new keys always have a fallback
        this._values = { ...DEFAULTS, ...parsed };
        // Re-validate every field through setters
        this.setAll(this._values);
      }
    } catch {
      this._values = { ...DEFAULTS };
    }
  }

  reset() {
    this._values = { ...DEFAULTS };
    this.save();
  }
}

export const settings = new Settings();
