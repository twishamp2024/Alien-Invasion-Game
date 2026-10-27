// ──────────────────────────────────────────────
//  main.js — ALIEN INVASION Entry Point & Game Loop
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { gameState, GameStates } from './gameState.js';
import { settings } from './settings.js';
import { input } from './input.js';
import { ui } from './ui.js';

import { player } from './player.js';
import { enemyManager } from './enemies.js';
import { projectileManager } from './projectiles.js';
import { particleManager } from './particles.js';
import { pickupManager } from './pickups.js';
import { arena } from './arena.js';
import { audio } from './audio.js';
import { camera as gameCamera } from './camera.js';
import { waveManager } from './waves.js';

// ── Three.js Core ─────────────────────────────

let renderer, scene, camera, composer;
let bloomPass = null;
const timer = new THREE.Timer();
let menuOrbitAngle = 0;

// ── Bloom Quality Presets ─────────────────────

const BLOOM_PRESETS = {
  low: { strength: 0.25, radius: 0.2, threshold: 0.9 },
  medium: { strength: 0.5, radius: 0.4, threshold: 0.8 },
  high: { strength: 0.75, radius: 0.55, threshold: 0.72 },
};

// ── Initialisation ────────────────────────────

function initRenderer() {
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Real-time shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030712);
  scene.fog = new THREE.FogExp2(0x050c18, 0.012);
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, 15, -25);
  camera.lookAt(0, 0, 0);
}

function initPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const preset = BLOOM_PRESETS[settings.graphicsQuality] || BLOOM_PRESETS.medium;
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    preset.strength,
    preset.radius,
    preset.threshold
  );
  bloomPass.name = 'bloom';
  composer.addPass(bloomPass);

  composer.addPass(new OutputPass());
}

function updateBloomQuality(quality) {
  if (!bloomPass) return;
  const preset = BLOOM_PRESETS[quality] || BLOOM_PRESETS.medium;
  bloomPass.strength = preset.strength;
  bloomPass.radius = preset.radius;
  bloomPass.threshold = preset.threshold;
}

// ── Game-System Bootstrap ─────────────────────

async function initGameSystems() {
  input.attach(renderer.domElement);

  // Build arena
  arena.init(scene);

  // Entities and managers
  player.init(scene);
  gameCamera.init(camera, player.group);
  enemyManager.init(scene);
  projectileManager.init(scene);
  particleManager.init(scene);
  pickupManager.init(scene);
  waveManager.init();

  // Audio system
  await audio.init();
}

// ── Game-State Transitions ────────────────────

function startGame() {
  gameState.reset();
  gameState.setState({ gameState: GameStates.PLAYING, wave: 1 });
  gameState.resetWaveStats();

  player.reset(new THREE.Vector3(0, 0, 0));
  enemyManager.reset();
  projectileManager.reset();
  particleManager.reset();
  pickupManager.reset();
  waveManager.start();

  input.requestPointerLock();
  audio.playMusic();
}

function pauseGame() {
  if (gameState.get('gameState') !== GameStates.PLAYING) return;
  gameState.setState({ gameState: GameStates.PAUSED });
  input.exitPointerLock();
  audio.pauseMusic();
}

function resumeGame() {
  if (gameState.get('gameState') !== GameStates.PAUSED) return;
  gameState.setState({ gameState: GameStates.PLAYING });
  input.requestPointerLock();
  audio.resumeMusic();
}

function returnToMenu() {
  gameState.setState({ gameState: GameStates.MENU });
  input.exitPointerLock();
  enemyManager.reset();
  projectileManager.reset();
  particleManager.reset();
  pickupManager.reset();
  audio.stopMusic(0.5);
}

// ── Pointer-Lock Observation ──────────────────

function setupPointerLockHandlers() {
  document.addEventListener('pointerlockchange', () => {
    const state = gameState.get('gameState');
    const locked = document.pointerLockElement === renderer.domElement;

    if (state === GameStates.PLAYING && !locked) {
      pauseGame();
    }
  });

  // Re-lock pointer on canvas click during play
  renderer.domElement.addEventListener('click', () => {
    if (gameState.get('gameState') === GameStates.PLAYING && !input.isPointerLocked) {
      input.requestPointerLock();
    }
  });
}

// ── Window Resize ─────────────────────────────

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (composer) {
    composer.setSize(w, h);
  }
}

// ── Main Game Loop ────────────────────────────

function gameLoop(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1); // clamp to prevent delta spike
  const state = gameState.get('gameState');

  if (state === GameStates.PLAYING) {
    if (input.isKeyPressed('Escape')) {
      pauseGame();
    } else {
      player.update(dt, arena);
      arena.update(dt);
      gameCamera.update(dt, arena.colliders);
      enemyManager.update(dt, player, arena);
      projectileManager.update(dt, {
        arena,
        enemies: enemyManager.activeEnemies,
        player,
      });
      particleManager.update(dt);
      pickupManager.update(dt);
      waveManager.update(dt);
      audio.update(dt);
    }
  } else if (state === GameStates.PAUSED) {
    if (input.isKeyPressed('Escape')) {
      resumeGame();
    }
  } else if (state === GameStates.MENU) {
    // Dynamic cinematic 3D title screen camera orbit!
    menuOrbitAngle += dt * 0.2;
    const r = 38;
    camera.position.set(
      Math.sin(menuOrbitAngle) * r,
      14 + Math.sin(menuOrbitAngle * 0.5) * 4,
      Math.cos(menuOrbitAngle) * r
    );
    camera.lookAt(0, 3, 0);

    arena.update(dt);
    particleManager.update(dt);
  }

  // Render Scene
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }

  // End of frame input flush
  input.endFrame();
}

// ── Bootstrap ─────────────────────────────────

async function main() {
  ui.setLoadingProgress(15, 'INITIALIZING GRAPHICS PIPELINE...');
  initRenderer();
  initScene();
  initCamera();
  initPostProcessing();

  ui.setLoadingProgress(45, 'GENERATING SCI-FI DEFENSE ARENA...');
  ui.init({
    onStart: startGame,
    onResume: resumeGame,
    onRestart: startGame,
    onQuit: returnToMenu,
    onQualityChange: updateBloomQuality,
  });

  ui.setLoadingProgress(70, 'CALIBRATING SYNTHESIZERS & COMBAT SUIT...');
  await initGameSystems();

  setupPointerLockHandlers();
  window.addEventListener('resize', onResize);

  ui.setLoadingProgress(100, 'SYSTEMS OPERATIONAL');

  // Small delay for smooth intro
  setTimeout(() => {
    ui.showScreen(GameStates.MENU);
    renderer.setAnimationLoop(gameLoop);
  }, 400);
}

main().catch((err) => {
  console.error('[ALIEN INVASION] Fatal initialization error:', err);
});
