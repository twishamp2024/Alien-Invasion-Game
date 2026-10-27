// ──────────────────────────────────────────────
//  player.test.js — Player Mechanics & Health Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { player } from '../src/player.js';
import { gameState, GameStates } from '../src/gameState.js';

test('Player - initial state and reset', () => {
  const scene = new THREE.Scene();
  player.init(scene);

  assert.equal(player.health, 100);
  assert.equal(player.shield, 100);
  assert.equal(player.isAlive, true);
  assert.equal(player.isDashing, false);
});

test('Player - shield absorbs damage before health', () => {
  player.reset();

  // 1. Hit for 40 damage: shield drops from 100 to 60, health stays 100
  player.takeDamage(40);
  assert.equal(player.shield, 60);
  assert.equal(player.health, 100);

  // 2. Hit for 80 damage: shield absorbs 60 (to 0), remaining 20 damages health (to 80)
  player.takeDamage(80);
  assert.equal(player.shield, 0);
  assert.equal(player.health, 80);

  // 3. Shield recharge after delay
  player.shieldRegenTimer = 0; // delay elapsed
  player.update(1.0, null); // 1 second of regen at 30/s
  assert.equal(player.shield, 30);
});

test('Player - heal and shield restore pickups', () => {
  player.reset();
  player.takeDamage(120); // 0 shield, 80 HP

  player.heal(15);
  assert.equal(player.health, 95);

  player.restoreShield(50);
  assert.equal(player.shield, 50);

  // Cap at max
  player.heal(100);
  assert.equal(player.health, 100);

  player.restoreShield(100);
  assert.equal(player.shield, 100);
});

test('Player - fatal damage triggers die and GAME_OVER', () => {
  player.reset();
  gameState.setState({ gameState: GameStates.PLAYING });

  player.takeDamage(300);
  assert.equal(player.isAlive, false);
  assert.equal(player.health, 0);
  assert.equal(gameState.get('gameState'), GameStates.GAME_OVER);
});

test('Player - invulnerability during dash prevents damage', () => {
  player.reset();
  player.isInvulnerable = true;

  player.takeDamage(50);
  assert.equal(player.shield, 100);
  assert.equal(player.health, 100);
});
