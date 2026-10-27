// ──────────────────────────────────────────────
//  settings.test.js — Settings Unit Tests
// ──────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import { settings } from '../src/settings.js';

test('Settings - clamping and defaults', () => {
  settings.reset();

  settings.mouseSensitivity = 1.2;
  assert.equal(settings.mouseSensitivity, 1.2);

  // Clamping
  settings.mouseSensitivity = 100; // clamp to 2.0
  assert.equal(settings.mouseSensitivity, 2.0);

  settings.mouseSensitivity = -5; // clamp to 0.1
  assert.equal(settings.mouseSensitivity, 0.1);

  settings.masterVolume = 1.5; // clamp to 1.0
  assert.equal(settings.masterVolume, 1.0);

  settings.graphicsQuality = 'ultra'; // invalid, keeps fallback or previous
  assert.match(settings.graphicsQuality, /^(low|medium|high)$/);

  settings.graphicsQuality = 'high';
  assert.equal(settings.graphicsQuality, 'high');
});
