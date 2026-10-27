// ──────────────────────────────────────────────
//  gameState.test.js — Game State & Stats Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState, GameStates } from '../src/gameState.js';

test('GameState - initial defaults', () => {
  gameState.reset();
  assert.equal(gameState.get('score'), 0);
  assert.equal(gameState.get('wave'), 0);
  assert.equal(gameState.get('health'), 100);
  assert.equal(gameState.get('ammo'), 30);
  assert.equal(gameState.get('gameState'), GameStates.MENU);
});

test('GameState - state updates and subscriptions', () => {
  gameState.reset();
  const notifications = [];

  const unsubscribe = gameState.subscribe((key, val) => {
    notifications.push({ key, val });
  });

  gameState.setState({ score: 500 });
  assert.equal(gameState.get('score'), 500);

  // Both 'score' and 'highScore' should have been notified
  const scoreEvent = notifications.find((n) => n.key === 'score');
  const hsEvent = notifications.find((n) => n.key === 'highScore');

  assert.ok(scoreEvent, 'Score notification should exist');
  assert.equal(scoreEvent.val, 500);
  assert.ok(hsEvent, 'HighScore notification should exist when score exceeds highScore');
  assert.equal(hsEvent.val, 500);

  unsubscribe();
});

test('GameState - wave stats tracking and accuracy calculation', () => {
  gameState.reset();
  gameState.resetWaveStats();

  gameState.addWaveStat('shotsFired', 10);
  gameState.addWaveStat('shotsHit', 7);
  gameState.addWaveStat('enemiesKilled', 3);

  const stats = gameState.get('waveStats');
  assert.equal(stats.shotsFired, 10);
  assert.equal(stats.shotsHit, 7);
  assert.equal(stats.enemiesKilled, 3);
  assert.equal(gameState.getAccuracy(), 70);
});
