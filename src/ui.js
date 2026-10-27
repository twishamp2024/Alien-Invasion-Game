// ──────────────────────────────────────────────
//  ui.js — Clean HUD & Screen UI Manager
// ──────────────────────────────────────────────

import { gameState, GameStates } from './gameState.js';
import { settings } from './settings.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);

class UIManager {
  constructor() {
    this.els = {};
    this._hitMarkerTimer = null;
    this._damageVignetteTimer = null;
    this._waveBannerTimer = null;
    this._previousScreen = null;
    this._initialized = false;
    this._displayedScore = 0;
    this._targetScore = 0;
    this._scoreAnimId = null;
  }

  init(callbacks = {}) {
    if (this._initialized) return;

    this.callbacks = callbacks;

    // Cache elements
    this.els = {
      // Screens
      loadingScreen: $('loadingScreen'),
      loadingStatus: $('loadingStatus'),
      loadingBarFill: $('loadingBarFill'),
      loadingPercent: $('loadingPercent'),

      titleScreen: $('titleScreen'),
      controlsScreen: $('controlsScreen'),
      settingsScreen: $('settingsScreen'),
      hud: $('hud'),
      pauseMenu: $('pauseMenu'),
      gameOverScreen: $('gameOverScreen'),
      victoryScreen: $('victoryScreen'),

      // Buttons - Title
      btnStartGame: $('btnStartGame'),
      btnControls: $('btnControls'),
      btnSettings: $('btnSettings'),

      // Buttons - Controls
      btnControlsBack: $('btnControlsBack'),

      // Buttons - Settings
      btnSettingsBack: $('btnSettingsBack'),
      sensitivitySlider: $('sensitivitySlider'),
      sensitivityValue: $('sensitivityValue'),
      masterVolume: $('masterVolume'),
      masterVolumeValue: $('masterVolumeValue'),
      sfxVolume: $('sfxVolume'),
      sfxVolumeValue: $('sfxVolumeValue'),
      musicVolume: $('musicVolume'),
      musicVolumeValue: $('musicVolumeValue'),
      qualityBtns: document.querySelectorAll('.quality-btn'),
      screenShakeToggle: $('screenShakeToggle'),
      screenShakeLabel: $('screenShakeLabel'),

      // HUD elements
      healthBar: $('healthBar'),
      healthValue: $('healthValue'),
      shieldBar: $('shieldBar'),
      shieldValue: $('shieldValue'),
      waveCounter: $('waveCounter'),
      scoreDisplay: $('scoreDisplay'),
      ammoCurrent: $('ammoCurrent'),
      ammoReserve: $('ammoReserve'),
      crosshair: $('crosshair'),
      hitMarker: $('hitMarker'),
      damageVignette: $('damageVignette'),

      // Wave banner
      waveBanner: $('waveBanner'),
      waveBannerText: $('waveBannerText'),
      waveBannerSub: $('waveBannerSub'),

      // Pause Menu buttons
      btnResume: $('btnResume'),
      btnPauseSettings: $('btnPauseSettings'),
      btnRestart: $('btnRestart'),
      btnQuitToMenu: $('btnQuitToMenu'),

      // Game Over elements
      goScore: $('goScore'),
      goWaves: $('goWaves'),
      goHighScore: $('goHighScore'),
      btnGoRestart: $('btnGoRestart'),
      btnGoMenu: $('btnGoMenu'),

      // Victory elements
      vicScore: $('vicScore'),
      vicKills: $('vicKills'),
      btnVicRestart: $('btnVicRestart'),
      btnVicMenu: $('btnVicMenu'),
    };

    this._bindButtons();
    this._bindSettings();
    this._subscribeToState();

    this._initialized = true;
  }

  // ── Screen Visibility ────────────────────────

  setLoadingProgress(percent, statusText) {
    if (this.els.loadingBarFill) {
      this.els.loadingBarFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.els.loadingPercent) {
      this.els.loadingPercent.textContent = `${Math.round(percent)}%`;
    }
    if (this.els.loadingStatus && statusText) {
      this.els.loadingStatus.textContent = statusText;
    }
  }

  showScreen(state) {
    const screens = [
      this.els.loadingScreen,
      this.els.titleScreen,
      this.els.controlsScreen,
      this.els.settingsScreen,
      this.els.hud,
      this.els.pauseMenu,
      this.els.gameOverScreen,
      this.els.victoryScreen,
    ];

    screens.forEach((el) => {
      if (el) el.classList.add('hidden');
    });

    switch (state) {
      case GameStates.MENU:
        if (this.els.titleScreen) this.els.titleScreen.classList.remove('hidden');
        break;

      case GameStates.PLAYING:
        if (this.els.hud) this.els.hud.classList.remove('hidden');
        break;

      case GameStates.PAUSED:
        if (this.els.hud) this.els.hud.classList.remove('hidden');
        if (this.els.pauseMenu) this.els.pauseMenu.classList.remove('hidden');
        break;

      case GameStates.GAME_OVER:
        if (this.els.gameOverScreen) {
          this.els.gameOverScreen.classList.remove('hidden');
          const st = gameState.getState();
          if (this.els.goScore) this.els.goScore.textContent = st.score.toLocaleString();
          if (this.els.goWaves) this.els.goWaves.textContent = st.wave;
          if (this.els.goHighScore) this.els.goHighScore.textContent = st.highScore.toLocaleString();
        }
        break;

      case GameStates.VICTORY:
        if (this.els.victoryScreen) {
          this.els.victoryScreen.classList.remove('hidden');
          const st = gameState.getState();
          if (this.els.vicScore) this.els.vicScore.textContent = st.score.toLocaleString();
          if (this.els.vicKills) this.els.vicKills.textContent = st.kills;
        }
        break;
    }
  }

  openSettings(fromScreen) {
    this._previousScreen = fromScreen;
    if (this.els.titleScreen) this.els.titleScreen.classList.add('hidden');
    if (this.els.pauseMenu) this.els.pauseMenu.classList.add('hidden');
    if (this.els.controlsScreen) this.els.controlsScreen.classList.add('hidden');
    if (this.els.settingsScreen) this.els.settingsScreen.classList.remove('hidden');
  }

  closeSettings() {
    if (this.els.settingsScreen) this.els.settingsScreen.classList.add('hidden');
    if (this._previousScreen === 'pause') {
      if (this.els.pauseMenu) this.els.pauseMenu.classList.remove('hidden');
    } else {
      if (this.els.titleScreen) this.els.titleScreen.classList.remove('hidden');
    }
  }

  openControls() {
    if (this.els.titleScreen) this.els.titleScreen.classList.add('hidden');
    if (this.els.controlsScreen) this.els.controlsScreen.classList.remove('hidden');
  }

  closeControls() {
    if (this.els.controlsScreen) this.els.controlsScreen.classList.add('hidden');
    if (this.els.titleScreen) this.els.titleScreen.classList.remove('hidden');
  }

  // ── Combat Feedback ──────────────────────────

  triggerHitMarker() {
    if (!this.els.hitMarker) return;
    this.els.hitMarker.classList.remove('hidden');
    clearTimeout(this._hitMarkerTimer);
    this._hitMarkerTimer = setTimeout(() => {
      if (this.els.hitMarker) this.els.hitMarker.classList.add('hidden');
    }, 120);
  }

  triggerDamageVignette(intensity = 0.8) {
    if (!this.els.damageVignette) return;
    this.els.damageVignette.style.opacity = String(intensity);
    clearTimeout(this._damageVignetteTimer);
    this._damageVignetteTimer = setTimeout(() => {
      if (this.els.damageVignette) this.els.damageVignette.style.opacity = '0';
    }, 300);
  }

  showWaveBanner(waveNum, subtitle = 'INCOMING HOSTILES') {
    if (!this.els.waveBanner) return;
    if (this.els.waveBannerText) this.els.waveBannerText.textContent = `WAVE ${waveNum}`;
    if (this.els.waveBannerSub) this.els.waveBannerSub.textContent = subtitle;

    this.els.waveBanner.classList.remove('hidden');
    clearTimeout(this._waveBannerTimer);
    this._waveBannerTimer = setTimeout(() => {
      if (this.els.waveBanner) this.els.waveBanner.classList.add('hidden');
    }, 2800);
  }

  // ── Private Event Binders ────────────────────

  _bindButtons() {
    const bindClick = (el, fn) => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.playSfx('menuClick');
        fn();
      });
      el.addEventListener('mouseenter', () => {
        audio.playSfx('menuHover');
      });
    };

    // Title
    bindClick(this.els.btnStartGame, () => this.callbacks.onStart?.());
    bindClick(this.els.btnControls, () => this.openControls());
    bindClick(this.els.btnSettings, () => this.openSettings('title'));

    // Controls
    bindClick(this.els.btnControlsBack, () => this.closeControls());

    // Settings Back
    bindClick(this.els.btnSettingsBack, () => this.closeSettings());

    // Pause
    bindClick(this.els.btnResume, () => this.callbacks.onResume?.());
    bindClick(this.els.btnPauseSettings, () => this.openSettings('pause'));
    bindClick(this.els.btnRestart, () => this.callbacks.onRestart?.());
    bindClick(this.els.btnQuitToMenu, () => this.callbacks.onQuit?.());

    // Game Over
    bindClick(this.els.btnGoRestart, () => this.callbacks.onRestart?.());
    bindClick(this.els.btnGoMenu, () => this.callbacks.onQuit?.());

    // Victory
    bindClick(this.els.btnVicRestart, () => this.callbacks.onRestart?.());
    bindClick(this.els.btnVicMenu, () => this.callbacks.onQuit?.());
  }

  _bindSettings() {
    // Mouse Sensitivity (1-100 map to 0.1 - 2.0)
    if (this.els.sensitivitySlider) {
      const currentSens = Math.round(settings.mouseSensitivity * 50);
      this.els.sensitivitySlider.value = currentSens;
      if (this.els.sensitivityValue) this.els.sensitivityValue.textContent = currentSens;

      this.els.sensitivitySlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (this.els.sensitivityValue) this.els.sensitivityValue.textContent = val;
        settings.mouseSensitivity = (val / 50);
      });
    }

    // Master Volume
    if (this.els.masterVolume) {
      const currentVol = Math.round(settings.masterVolume * 100);
      this.els.masterVolume.value = currentVol;
      if (this.els.masterVolumeValue) this.els.masterVolumeValue.textContent = currentVol;

      this.els.masterVolume.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (this.els.masterVolumeValue) this.els.masterVolumeValue.textContent = val;
        settings.masterVolume = val / 100;
        audio.setMasterVolume(settings.masterVolume);
      });
    }

    // SFX Volume
    if (this.els.sfxVolume) {
      const currentSfx = Math.round(settings.sfxVolume * 100);
      this.els.sfxVolume.value = currentSfx;
      if (this.els.sfxVolumeValue) this.els.sfxVolumeValue.textContent = currentSfx;

      this.els.sfxVolume.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (this.els.sfxVolumeValue) this.els.sfxVolumeValue.textContent = val;
        settings.sfxVolume = val / 100;
        audio.setSfxVolume(settings.sfxVolume);
      });
    }

    // Music Volume
    if (this.els.musicVolume) {
      const currentMus = Math.round(settings.musicVolume * 100);
      this.els.musicVolume.value = currentMus;
      if (this.els.musicVolumeValue) this.els.musicVolumeValue.textContent = currentMus;

      this.els.musicVolume.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (this.els.musicVolumeValue) this.els.musicVolumeValue.textContent = val;
        settings.musicVolume = val / 100;
        audio.setMusicVolume(settings.musicVolume);
      });
    }

    // Quality Buttons
    if (this.els.qualityBtns) {
      this.els.qualityBtns.forEach((btn) => {
        const q = btn.dataset.quality;
        if (q === settings.graphicsQuality) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }

        btn.addEventListener('click', () => {
          this.els.qualityBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          settings.graphicsQuality = q;
          this.callbacks.onQualityChange?.(q);
        });
      });
    }

    // Screen Shake
    if (this.els.screenShakeToggle) {
      this.els.screenShakeToggle.checked = settings.screenShake;
      if (this.els.screenShakeLabel) {
        this.els.screenShakeLabel.textContent = settings.screenShake ? 'ON' : 'OFF';
      }

      this.els.screenShakeToggle.addEventListener('change', (e) => {
        settings.screenShake = e.target.checked;
        if (this.els.screenShakeLabel) {
          this.els.screenShakeLabel.textContent = settings.screenShake ? 'ON' : 'OFF';
        }
      });
    }
  }

  _subscribeToState() {
    gameState.subscribe((key, value) => {
      switch (key) {
        case 'gameState':
          this.showScreen(value);
          break;

        case 'health': {
          const hp = Math.max(0, Math.min(100, Math.round(value)));
          if (this.els.healthBar) this.els.healthBar.style.width = `${hp}%`;
          if (this.els.healthValue) this.els.healthValue.textContent = hp;
          if (hp < 30) {
            this.els.healthBar?.classList.add('critical');
          } else {
            this.els.healthBar?.classList.remove('critical');
          }
          break;
        }

        case 'shield': {
          const sh = Math.max(0, Math.min(100, Math.round(value)));
          if (this.els.shieldBar) this.els.shieldBar.style.width = `${sh}%`;
          if (this.els.shieldValue) this.els.shieldValue.textContent = sh;
          break;
        }

        case 'ammo':
          if (this.els.ammoCurrent) this.els.ammoCurrent.textContent = value;
          break;

        case 'maxAmmo':
          if (this.els.ammoReserve) this.els.ammoReserve.textContent = value;
          break;

        case 'wave':
          if (this.els.waveCounter) this.els.waveCounter.textContent = `WAVE ${value}`;
          break;

        case 'score':
          this._targetScore = value;
          this._animateScore();
          break;
      }
    });
  }

  _animateScore() {
    if (this._scoreAnimId) return;

    const step = () => {
      const diff = this._targetScore - this._displayedScore;
      if (Math.abs(diff) <= 2) {
        this._displayedScore = this._targetScore;
        if (this.els.scoreDisplay) this.els.scoreDisplay.textContent = `SCORE: ${this._displayedScore.toLocaleString()}`;
        this._scoreAnimId = null;
        return;
      }

      this._displayedScore += Math.ceil(diff * 0.15);
      if (this.els.scoreDisplay) this.els.scoreDisplay.textContent = `SCORE: ${this._displayedScore.toLocaleString()}`;
      this._scoreAnimId = requestAnimationFrame(step);
    };

    this._scoreAnimId = requestAnimationFrame(step);
  }
}

export const ui = new UIManager();
