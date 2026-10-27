// ──────────────────────────────────────────────
//  weapons.js — Player Weapon Arsenal
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { ProjectileTypes } from './projectiles.js';
import { gameState } from './gameState.js';
import { audio } from './audio.js';

export const WeaponTypes = Object.freeze({
  PULSE_RIFLE: 'PULSE_RIFLE',
  SCATTER_BLASTER: 'SCATTER_BLASTER',
  PLASMA_ROCKET: 'PLASMA_ROCKET',
});

export const WEAPON_DEFS = {
  [WeaponTypes.PULSE_RIFLE]: {
    name: 'Pulse Rifle',
    fireRate: 0.12, // seconds between shots (~8.3 shots/s)
    damage: 26,
    speed: 95,
    ammoCost: 1,
    recoilPitch: 0.022,
    recoilYaw: 0.008,
    trauma: 0.08,
    projectileType: ProjectileTypes.PLAYER_PULSE,
    sound: 'laser',
  },
  [WeaponTypes.SCATTER_BLASTER]: {
    name: 'Scatter Blaster',
    fireRate: 0.55,
    damage: 16, // per pellet
    pelletCount: 7,
    spreadAngle: 0.09, // radians cone
    speed: 85,
    ammoCost: 3,
    recoilPitch: 0.055,
    recoilYaw: 0.02,
    trauma: 0.22,
    projectileType: ProjectileTypes.PLAYER_PELLET,
    sound: 'shotgun',
  },
  [WeaponTypes.PLASMA_ROCKET]: {
    name: 'Plasma Rocket',
    fireRate: 0.9,
    damage: 110,
    splashRadius: 4.8,
    speed: 55,
    ammoCost: 5,
    recoilPitch: 0.08,
    recoilYaw: 0.025,
    trauma: 0.35,
    projectileType: ProjectileTypes.PLAYER_ROCKET,
    sound: 'rocket',
  },
};

export class WeaponSystem {
  constructor() {
    this.currentWeaponType = WeaponTypes.PULSE_RIFLE;
    this.cooldownTimer = 0;
    this.isReloading = false;
    this.reloadDuration = 1.3;
    this.reloadTimer = 0;
    this.maxMagazine = 30;
    this.infiniteAmmoTimer = 0; // For Overdrive power-up!
  }

  get currentDef() {
    return WEAPON_DEFS[this.currentWeaponType];
  }

  setWeapon(type) {
    if (WEAPON_DEFS[type]) {
      this.currentWeaponType = type;
      audio.playSfx('switchWeapon');
    }
  }

  nextWeapon() {
    const list = [WeaponTypes.PULSE_RIFLE, WeaponTypes.SCATTER_BLASTER, WeaponTypes.PLASMA_ROCKET];
    const idx = list.indexOf(this.currentWeaponType);
    this.setWeapon(list[(idx + 1) % list.length]);
  }

  prevWeapon() {
    const list = [WeaponTypes.PULSE_RIFLE, WeaponTypes.SCATTER_BLASTER, WeaponTypes.PLASMA_ROCKET];
    const idx = list.indexOf(this.currentWeaponType);
    this.setWeapon(list[(idx - 1 + list.length) % list.length]);
  }

  activateOverdrive(duration = 10) {
    this.infiniteAmmoTimer = duration;
    audio.playSfx('powerup');
  }

  canFire() {
    if (this.cooldownTimer > 0 || this.isReloading) return false;
    const currentAmmo = gameState.get('ammo');
    return this.infiniteAmmoTimer > 0 || currentAmmo >= this.currentDef.ammoCost;
  }

  startReload() {
    const currentAmmo = gameState.get('ammo');
    if (currentAmmo >= this.maxMagazine || this.isReloading) return;

    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    audio.playSfx('reload');
  }

  fire(muzzlePos, aimDir, projectileManager, camera) {
    if (!this.canFire()) {
      const currentAmmo = gameState.get('ammo');
      if (currentAmmo < this.currentDef.ammoCost && !this.isReloading) {
        this.startReload();
      }
      return false;
    }

    const def = this.currentDef;
    const isOverdrive = this.infiniteAmmoTimer > 0;

    // Deduct ammo if not in Overdrive
    if (!isOverdrive) {
      const remainingAmmo = Math.max(0, gameState.get('ammo') - def.ammoCost);
      gameState.setState({ ammo: remainingAmmo });
      gameState.addWaveStat('shotsFired', def.pelletCount || 1);
    }

    // Set cooldown
    this.cooldownTimer = isOverdrive ? def.fireRate * 0.5 : def.fireRate;

    // Recoil and Trauma screen shake
    camera.addRecoil(def.recoilPitch, def.recoilYaw);
    camera.addTrauma(def.trauma);

    // Audio SFX
    audio.playSfx(def.sound);

    // Spawn Projectiles
    if (this.currentWeaponType === WeaponTypes.SCATTER_BLASTER) {
      // Spawn multiple cone spread pellets
      for (let i = 0; i < def.pelletCount; i++) {
        const spreadDir = aimDir.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * def.spreadAngle * 2,
          (Math.random() - 0.5) * def.spreadAngle * 2,
          (Math.random() - 0.5) * def.spreadAngle * 2
        )).normalize();

        projectileManager.spawn({
          type: def.projectileType,
          origin: muzzlePos,
          direction: spreadDir,
          speed: def.speed + (Math.random() - 0.5) * 10,
          damage: def.damage,
          lifetime: 0.9,
          isPlayer: true,
        });
      }
    } else {
      // Single bolt or rocket
      projectileManager.spawn({
        type: def.projectileType,
        origin: muzzlePos,
        direction: aimDir,
        speed: def.speed,
        damage: def.damage,
        splashRadius: def.splashRadius || 0,
        lifetime: 2.2,
        isPlayer: true,
      });
    }

    return true;
  }

  update(dt) {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    if (this.infiniteAmmoTimer > 0) {
      this.infiniteAmmoTimer -= dt;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        gameState.setState({ ammo: this.maxMagazine });
      }
    }
  }

  reset() {
    this.cooldownTimer = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.infiniteAmmoTimer = 0;
    this.currentWeaponType = WeaponTypes.PULSE_RIFLE;
    gameState.setState({ ammo: this.maxMagazine, maxAmmo: this.maxMagazine });
  }
}

export const weaponSystem = new WeaponSystem();
