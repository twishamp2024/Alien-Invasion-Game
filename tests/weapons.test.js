// ──────────────────────────────────────────────
//  weapons.test.js — Weapon System Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponSystem, WeaponTypes, WEAPON_DEFS } from '../src/weapons.js';
import { gameState } from '../src/gameState.js';

test('Weapons - switching and definitions', () => {
  weaponSystem.reset();
  assert.equal(weaponSystem.currentWeaponType, WeaponTypes.PULSE_RIFLE);
  assert.equal(weaponSystem.currentDef.name, 'Pulse Rifle');

  weaponSystem.setWeapon(WeaponTypes.SCATTER_BLASTER);
  assert.equal(weaponSystem.currentWeaponType, WeaponTypes.SCATTER_BLASTER);
  assert.equal(weaponSystem.currentDef.name, 'Scatter Blaster');

  weaponSystem.setWeapon(WeaponTypes.PLASMA_ROCKET);
  assert.equal(weaponSystem.currentWeaponType, WeaponTypes.PLASMA_ROCKET);
  assert.equal(weaponSystem.currentDef.damage, 110);
});

test('Weapons - ammo consumption and canFire check', () => {
  weaponSystem.reset();
  gameState.setState({ ammo: 30 });

  assert.equal(weaponSystem.canFire(), true);

  // When ammo is 0
  gameState.setState({ ammo: 0 });
  assert.equal(weaponSystem.canFire(), false);
});

test('Weapons - reload duration and ammo restoration', () => {
  weaponSystem.reset();
  gameState.setState({ ammo: 5 });

  weaponSystem.startReload();
  assert.equal(weaponSystem.isReloading, true);
  assert.equal(weaponSystem.canFire(), false);

  // Advance time past reload duration
  weaponSystem.update(1.5);
  assert.equal(weaponSystem.isReloading, false);
  assert.equal(gameState.get('ammo'), 30);
  assert.equal(weaponSystem.canFire(), true);
});

test('Weapons - overdrive powerup (infinite ammo & half cooldown)', () => {
  weaponSystem.reset();
  gameState.setState({ ammo: 0 });

  weaponSystem.activateOverdrive(5.0);
  assert.equal(weaponSystem.canFire(), true, 'Can fire even with 0 ammo during Overdrive');

  // Cooldown simulation
  weaponSystem.cooldownTimer = 0.5;
  weaponSystem.update(0.3);
  assert.equal(weaponSystem.cooldownTimer > 0, true);

  weaponSystem.update(0.3);
  assert.equal(weaponSystem.cooldownTimer <= 0, true);
});
