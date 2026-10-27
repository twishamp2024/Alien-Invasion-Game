// ──────────────────────────────────────────────
//  waves.test.js — Wave Progression Logic Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import { waveManager, WAVE_CONFIGS } from '../src/waves.js';
import { gameState } from '../src/gameState.js';
import { EnemyTypes } from '../src/enemies.js';

test('Waves - all 5 wave configurations defined correctly', () => {
  assert.equal(WAVE_CONFIGS.length, 5);

  // Wave 1 has drones
  const w1 = WAVE_CONFIGS[0];
  assert.equal(w1.wave, 1);
  assert.ok(w1.spawns.some((s) => s.type === EnemyTypes.SWARM_DRONE));

  // Wave 5 has Boss
  const w5 = WAVE_CONFIGS[4];
  assert.equal(w5.wave, 5);
  assert.ok(w5.spawns.some((s) => s.type === EnemyTypes.HARVESTER_BOSS));
});

test('Waves - wave start initializes state and spawn queue', () => {
  waveManager.reset();
  gameState.reset();

  waveManager._startWave(1);

  assert.equal(waveManager.currentWave, 1);
  assert.equal(gameState.get('wave'), 1);
  assert.equal(waveManager.state, 'SPAWNING');
  assert.ok(waveManager.spawnQueue.length > 0, 'Spawn queue must be populated');
});
