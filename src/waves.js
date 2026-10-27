// ──────────────────────────────────────────────
//  waves.js — Wave Progression & Spawning Director
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { enemyManager, EnemyTypes } from './enemies.js';
import { arena } from './arena.js';
import { pickupManager, PickupTypes } from './pickups.js';
import { gameState, GameStates } from './gameState.js';
import { audio } from './audio.js';
import { ui } from './ui.js';

export const WAVE_CONFIGS = [
  // Wave 1: Intro to movement & shooting
  {
    wave: 1,
    title: 'WAVE 1',
    subtitle: 'FIRST INVASION: SWARM DRONES',
    spawns: [
      { type: EnemyTypes.SWARM_DRONE, count: 8, delay: 0.5 },
    ],
  },
  // Wave 2: Ranged threats introduction
  {
    wave: 2,
    title: 'WAVE 2',
    subtitle: 'ACID RAIN: SPITTERS DETECTED',
    spawns: [
      { type: EnemyTypes.SWARM_DRONE, count: 10, delay: 0.8 },
      { type: EnemyTypes.ACID_SPITTER, count: 4, delay: 2.0 },
    ],
  },
  // Wave 3: Armored Tanks
  {
    wave: 3,
    title: 'WAVE 3',
    subtitle: 'HEAVY ENFORCERS: ALIEN BRUTES',
    spawns: [
      { type: EnemyTypes.SWARM_DRONE, count: 12, delay: 0.7 },
      { type: EnemyTypes.ACID_SPITTER, count: 5, delay: 1.5 },
      { type: EnemyTypes.ALIENT_BRUTE, count: 2, delay: 3.5 },
    ],
  },
  // Wave 4: Massive Horde
  {
    wave: 4,
    title: 'WAVE 4',
    subtitle: 'THE SWARM HORDE: SURVIVE',
    spawns: [
      { type: EnemyTypes.SWARM_DRONE, count: 20, delay: 0.5 },
      { type: EnemyTypes.ACID_SPITTER, count: 8, delay: 1.2 },
      { type: EnemyTypes.ALIENT_BRUTE, count: 3, delay: 3.0 },
    ],
  },
  // Wave 5: BOSS BATTLE
  {
    wave: 5,
    title: 'FINAL WAVE',
    subtitle: 'THE HARVESTER OVERLORD ARRIVES',
    spawns: [
      { type: EnemyTypes.HARVESTER_BOSS, count: 1, delay: 1.0 },
      { type: EnemyTypes.SWARM_DRONE, count: 10, delay: 2.0 },
      { type: EnemyTypes.ACID_SPITTER, count: 4, delay: 4.0 },
    ],
  },
];

class WaveManager {
  constructor() {
    this.currentWave = 1;
    this.state = 'INACTIVE'; // INACTIVE | SPAWNING | COMBAT | INTERMISSION
    this.intermissionTimer = 0;
    this.intermissionDuration = 4.5;
    this.spawnQueue = [];
    this.spawnTimer = 0;
  }

  init() {
    this.reset();
  }

  reset() {
    this.currentWave = 1;
    this.state = 'INACTIVE';
    this.intermissionTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
  }

  start() {
    this.currentWave = 1;
    this._startWave(this.currentWave);
  }

  _startWave(waveNum) {
    this.currentWave = waveNum;
    gameState.setState({ wave: waveNum });
    gameState.resetWaveStats();

    // Spawn bonus supplies at start of wave
    pickupManager.spawnPickup(PickupTypes.AMMO, new THREE.Vector3(-10, 0, 0));
    pickupManager.spawnPickup(PickupTypes.SHIELD, new THREE.Vector3(10, 0, 0));

    // Get config or generate infinite scaling wave
    let config = WAVE_CONFIGS[waveNum - 1];
    if (!config) {
      // Infinite procedural scaling for wave 6+
      const droneCount = 18 + waveNum * 3;
      const spitterCount = 6 + Math.floor(waveNum * 1.5);
      const bruteCount = 2 + Math.floor(waveNum * 0.8);

      config = {
        wave: waveNum,
        title: `WAVE ${waveNum}`,
        subtitle: 'ENDLESS INCURSION: MAXIMUM HOSTILITY',
        spawns: [
          { type: EnemyTypes.SWARM_DRONE, count: droneCount, delay: 0.4 },
          { type: EnemyTypes.ACID_SPITTER, count: spitterCount, delay: 1.2 },
          { type: EnemyTypes.ALIENT_BRUTE, count: bruteCount, delay: 2.5 },
        ],
      };
    }

    // Build spawn queue
    this.spawnQueue = [];
    for (const group of config.spawns) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({
          type: group.type,
          delay: group.delay,
        });
      }
    }

    // Shuffle spawn queue for dynamic variety
    this.spawnQueue.sort(() => Math.random() - 0.5);

    this.state = 'SPAWNING';
    this.spawnTimer = 1.0;

    // Show wave banner & sound
    ui.showWaveBanner(waveNum, config.subtitle);
    audio.playSfx('waveStart');
    audio.setCombatIntensity(0.7);
  }

  update(dt) {
    if (gameState.get('gameState') !== GameStates.PLAYING) return;

    // Update dynamic audio combat intensity based on living enemy count
    const livingEnemies = enemyManager.activeEnemies.length;
    const intensity = Math.min(1.0, livingEnemies / 12);
    audio.setCombatIntensity(intensity);

    if (this.state === 'SPAWNING') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
        const next = this.spawnQueue.shift();
        this._spawnSingle(next.type);
        this.spawnTimer = next.delay;
      }

      if (this.spawnQueue.length === 0) {
        this.state = 'COMBAT';
      }
    } else if (this.state === 'COMBAT') {
      // All enemies from queue spawned; check if all are defeated
      if (livingEnemies === 0) {
        // Wave Cleared!
        audio.playSfx('waveClear');

        // Check if finished final boss wave (Wave 5)
        if (this.currentWave === 5) {
          gameState.setState({ gameState: GameStates.VICTORY });
          audio.stopMusic();
          audio.playSfx('victory');
          this.state = 'INACTIVE';
          return;
        }

        // Enter intermission before next wave
        this.state = 'INTERMISSION';
        this.intermissionTimer = this.intermissionDuration;
        ui.showWaveBanner(this.currentWave, 'WAVE CLEARED — RESUPPLYING');
      }
    } else if (this.state === 'INTERMISSION') {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this._startWave(this.currentWave + 1);
      }
    }
  }

  _spawnSingle(type) {
    // Pick a random perimeter spawn point from arena
    const pts = arena.spawnPoints;
    const pt = pts[Math.floor(Math.random() * pts.length)].clone();

    // Small jitter so they don't stack
    pt.x += (Math.random() - 0.5) * 4;
    pt.z += (Math.random() - 0.5) * 4;

    enemyManager.spawnEnemy(type, pt);
  }
}

export const waveManager = new WaveManager();
