// ──────────────────────────────────────────────
//  arena.test.js — Arena Bounds and Collision Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { arena } from '../src/arena.js';

test('Arena - collision boundary limits', () => {
  const scene = new THREE.Scene();
  arena.init(scene);

  const radius = 0.8;
  const safePos = new THREE.Vector3(0, 0, 0);
  assert.equal(arena.checkCollision(safePos, radius), false, 'Center of arena should be safe');

  // Exceeding boundaries
  const outOfBoundsPos = new THREE.Vector3(55, 0, 0);
  assert.equal(arena.checkCollision(outOfBoundsPos, radius), true, 'Position past half-size should collide');
});

test('Arena - sliding collision resolution at boundaries', () => {
  const scene = new THREE.Scene();
  arena.init(scene);

  const currentPos = new THREE.Vector3(45, 0, 0);
  const nextPos = new THREE.Vector3(55, 0, 10); // Trying to exit arena
  const resolved = arena.resolveCollision(currentPos, nextPos, 0.8);

  const limit = arena.halfSize - 0.8 - 0.5;
  assert.ok(resolved.x <= limit, `X should be clamped within ${limit}`);
  assert.equal(resolved.z, 10, 'Z movement should slide smoothly');
});

test('Arena - obstacle collision resolution with cylinder pylon', () => {
  const scene = new THREE.Scene();
  arena.init(scene);

  // Pylon exists at (-18, 0, -28) with radius 2.8
  const pylonCenter = new THREE.Vector3(-18, 0, -28);
  const insidePylon = pylonCenter.clone().add(new THREE.Vector3(0.5, 0, 0.5));

  const resolved = arena.resolveCollision(new THREE.Vector3(-15, 0, -28), insidePylon, 0.8);
  const distToPylon = resolved.distanceTo(pylonCenter);
  assert.ok(distToPylon >= 2.8 + 0.8 - 0.01, 'Resolved position should be outside pylon radius');
});
