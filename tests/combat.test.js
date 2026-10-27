// ──────────────────────────────────────────────
//  combat.test.js — Combat Damage and Health Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { enemyManager, EnemyTypes } from '../src/enemies.js';
import { gameState } from '../src/gameState.js';

test('Combat - enemy takes damage, awards score and increments kills upon death', () => {
  const scene = new THREE.Scene();
  enemyManager.init(scene);
  gameState.reset();

  const drone = enemyManager.spawnEnemy(EnemyTypes.SWARM_DRONE, new THREE.Vector3(0, 0, 10));
  assert.equal(drone.isAlive, true);
  assert.equal(drone.health, 45);

  const initialScore = gameState.get('score');
  const initialKills = gameState.get('kills');

  // Partial damage
  drone.takeDamage(20);
  assert.equal(drone.health, 25);
  assert.equal(drone.isAlive, true);

  // Fatal damage
  drone.takeDamage(30);
  assert.equal(drone.isAlive, false);
  assert.equal(gameState.get('score'), initialScore + drone.scoreValue);
  assert.equal(gameState.get('kills'), initialKills + 1);
});

test('Combat - alien brute has high durability and tank role', () => {
  const scene = new THREE.Scene();
  enemyManager.init(scene);

  const brute = enemyManager.spawnEnemy(EnemyTypes.ALIENT_BRUTE, new THREE.Vector3(0, 0, 15));
  assert.equal(brute.health, 320);

  brute.takeDamage(100);
  assert.equal(brute.isAlive, true);
  assert.equal(brute.health, 220);
});
