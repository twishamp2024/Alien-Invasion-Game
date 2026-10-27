// ──────────────────────────────────────────────
//  enemies.js — Alien Invasion Horde AI & Boss
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { ProjectileTypes, projectileManager } from './projectiles.js';
import { particleManager } from './particles.js';
import { pickupManager } from './pickups.js';
import { gameState } from './gameState.js';
import { audio } from './audio.js';
import { ui } from './ui.js';

export const EnemyTypes = Object.freeze({
  SWARM_DRONE: 'SWARM_DRONE',
  ACID_SPITTER: 'ACID_SPITTER',
  ALIENT_BRUTE: 'ALIENT_BRUTE',
  HARVESTER_BOSS: 'HARVESTER_BOSS',
});

// ── Base Alien Class ──────────────────────────

class BaseEnemy {
  constructor(type, position, scene) {
    this.type = type;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.position = this.group.position;

    this.isAlive = true;
    this.isBoss = false;
    this.health = 50;
    this.maxHealth = 50;
    this.scoreValue = 100;

    this.speed = 8.0;
    this.hitboxRadius = 0.8;
    this.hitboxHeight = 1.6;

    // AI timers & state
    this.attackCooldown = 1.5;
    this.attackTimer = 0;
    this.state = 'CHASE'; // CHASE | ATTACK | STRAFE | CHARGE | DEAD
    this.stateTimer = 0;

    // Visual feedback
    this.damageFlashTimer = 0;
    this.materials = [];
    this.originalColors = [];

    this._buildModel();
    this.scene.add(this.group);
  }

  _buildModel() {
    // Implemented by subclasses
  }

  _registerMaterial(mat) {
    this.materials.push(mat);
    this.originalColors.push(mat.color.getHex());
  }

  takeDamage(amount, hitPoint = null) {
    if (!this.isAlive) return;

    this.health -= amount;
    this.damageFlashTimer = 0.08;

    // Damage flash white
    for (const mat of this.materials) {
      if (mat.color) mat.color.setHex(0xffffff);
    }

    ui.triggerHitMarker();
    gameState.addWaveStat('damageDealt', amount);
    gameState.addWaveStat('shotsHit', 1);

    if (this.health <= 0) {
      this.die(hitPoint);
    }
  }

  die(hitPoint = null) {
    if (!this.isAlive) return;
    this.isAlive = false;

    const deathPos = hitPoint || this.position.clone().add(new THREE.Vector3(0, 1, 0));
    particleManager.spawnExplosion(deathPos, this.isBoss ? 5.0 : 2.0, this.isBoss);
    audio.playSfx(this.isBoss ? 'bossDeath' : 'enemyDeath');

    // Add score & kill stats
    const currentScore = gameState.get('score') + this.scoreValue;
    const currentKills = gameState.get('kills') + 1;
    gameState.setState({ score: currentScore, kills: currentKills });
    gameState.addWaveStat('enemiesKilled', 1);

    // Roll pickup drops
    pickupManager.rollDrop(this.position, this.isBoss ? 1.0 : 0.35);

    // Remove from scene
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  update(dt, player, arena) {
    if (!this.isAlive || !player || !player.isAlive) return;

    // Damage flash reset
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      if (this.damageFlashTimer <= 0) {
        for (let i = 0; i < this.materials.length; i++) {
          if (this.materials[i].color) {
            this.materials[i].color.setHex(this.originalColors[i]);
          }
        }
      }
    }

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    this._updateAI(dt, player, arena);
  }

  _updateAI(dt, player, arena) {
    // Implemented by subclasses
  }
}

// ── 1. Swarm Drone (Scuttler) ─────────────────

class SwarmDrone extends BaseEnemy {
  constructor(position, scene) {
    super(EnemyTypes.SWARM_DRONE, position, scene);
    this.health = 45;
    this.maxHealth = 45;
    this.speed = 10.5;
    this.hitboxRadius = 0.7;
    this.hitboxHeight = 1.0;
    this.scoreValue = 100;
    this.attackCooldown = 1.0;
    this.weavePhase = Math.random() * Math.PI * 2;
  }

  _buildModel() {
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x2b0d38,
      roughness: 0.3,
      metalness: 0.8,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const spineMat = new THREE.MeshStandardMaterial({ color: 0xaa0055, roughness: 0.4 });

    this._registerMaterial(chitinMat);
    this._registerMaterial(spineMat);

    // Body carapace
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), chitinMat);
    body.position.y = 0.55;
    body.scale.set(1.2, 0.7, 1.4);
    body.castShadow = true;
    this.group.add(body);

    // Glowing alien eyes
    [-0.2, 0.2].forEach((ox) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
      eye.position.set(ox, 0.65, 0.62);
      this.group.add(eye);
    });

    // Glowing dorsal spines & alien aura
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), eyeMat);
    dorsal.position.set(0, 0.9, -0.1);
    this.group.add(dorsal);

    const droneLight = new THREE.PointLight(0xff0044, 0.8, 4.0);
    droneLight.position.set(0, 0.7, 0);
    this.group.add(droneLight);

    // Articulated legs
    this.legs = [];
    [-0.5, 0.5].forEach((ox) => {
      [-0.3, 0.3].forEach((oz) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.9, 6), chitinMat);
        leg.position.set(ox * 1.1, 0.35, oz);
        leg.rotation.z = ox > 0 ? -0.5 : 0.5;
        this.group.add(leg);
        this.legs.push(leg);
      });
    });
  }

  _updateAI(dt, player, arena) {
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();

    // Look at player
    this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Weaving movement pattern (steering behavior)
    this.weavePhase += dt * 6.0;
    const sideDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
    const weaveOffset = sideDir.multiplyScalar(Math.sin(this.weavePhase) * 3.0);

    const moveDir = toPlayer.clone().normalize().multiplyScalar(this.speed).add(weaveOffset).normalize();

    // Move towards player
    const nextPos = this.position.clone().addScaledVector(moveDir, this.speed * dt);
    const resolved = arena ? arena.resolveCollision(this.position, nextPos, this.hitboxRadius) : nextPos;
    this.position.copy(resolved);

    // Melee attack lunge
    if (dist < 2.0 && this.attackTimer <= 0) {
      player.takeDamage(16);
      this.attackTimer = this.attackCooldown;
      audio.playSfx('enemyBite');
      particleManager.spawnSparks(player.position.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 1, 0), 6, 0xff0044);
    }
  }
}

// ── 2. Acid Spitter (Bombardier) ──────────────

class AcidSpitter extends BaseEnemy {
  constructor(position, scene) {
    super(EnemyTypes.ACID_SPITTER, position, scene);
    this.health = 90;
    this.maxHealth = 90;
    this.speed = 5.2;
    this.hitboxRadius = 0.9;
    this.hitboxHeight = 2.0;
    this.scoreValue = 250;
    this.attackCooldown = 2.4;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
  }

  _buildModel() {
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x1d3318,
      roughness: 0.6,
      metalness: 0.3,
    });
    const sacMat = new THREE.MeshBasicMaterial({ color: 0x44ff11 });
    this._registerMaterial(skinMat);

    // Tall torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.4, 8), skinMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.group.add(torso);

    // Glowing acid sac on back
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), sacMat);
    sac.position.set(0, 1.35, -0.4);
    this.group.add(sac);
    this.acidSac = sac;

    // Head with open spitter maw
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), skinMat);
    head.rotateX(Math.PI / 2);
    head.position.set(0, 1.8, 0.3);
    this.group.add(head);
  }

  _updateAI(dt, player, arena) {
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();

    this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Pulse glowing acid sac
    if (this.acidSac) {
      const s = 1.0 + Math.sin(performance.now() * 0.008) * 0.12;
      this.acidSac.scale.set(s, s, s);
    }

    // AI Range Tactics:
    // If too close (< 10m), back up
    // If in sweet spot (10-22m), strafe laterally
    // If too far (> 22m), advance
    let moveDir = new THREE.Vector3();

    if (dist < 10.0) {
      moveDir.copy(toPlayer).negate().normalize(); // retreat
    } else if (dist > 22.0) {
      moveDir.copy(toPlayer).normalize(); // advance
    } else {
      // Strafe sideways
      const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      moveDir.copy(side).multiplyScalar(this.strafeDir);
    }

    const nextPos = this.position.clone().addScaledVector(moveDir, this.speed * dt);
    const resolved = arena ? arena.resolveCollision(this.position, nextPos, this.hitboxRadius) : nextPos;
    this.position.copy(resolved);

    // Fire acid mortar
    if (dist < 35.0 && this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;

      const launchPos = this.position.clone().add(new THREE.Vector3(0, 1.8, 0.5));
      const targetPos = player.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const dir = targetPos.sub(launchPos).normalize();

      projectileManager.spawn({
        type: ProjectileTypes.ALIEN_SPIT,
        origin: launchPos,
        direction: dir,
        speed: 28,
        damage: 18,
        splashRadius: 2.2,
        lifetime: 3.5,
        isPlayer: false,
      });

      audio.playSfx('enemySpit');
    }
  }
}

// ── 3. Alien Brute (Juggernaut) ───────────────

class AlienBrute extends BaseEnemy {
  constructor(position, scene) {
    super(EnemyTypes.ALIENT_BRUTE, position, scene);
    this.health = 320;
    this.maxHealth = 320;
    this.speed = 4.2;
    this.hitboxRadius = 1.4;
    this.hitboxHeight = 2.6;
    this.scoreValue = 600;
    this.attackCooldown = 2.0;
    this.isEnraged = false;
  }

  _buildModel() {
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3d1c14,
      roughness: 0.8,
      metalness: 0.4,
    });
    const magmaMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    this._registerMaterial(armorMat);

    // Heavy torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.2), armorMat);
    torso.position.y = 1.4;
    torso.castShadow = true;
    this.group.add(torso);

    // Glowing magma chest core
    const magma = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), magmaMat);
    magma.position.set(0, 1.5, 0.6);
    this.group.add(magma);

    // Massive shoulder spikes
    [-0.95, 0.95].forEach((ox) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 6), armorMat);
      spike.position.set(ox, 2.2, 0);
      spike.rotation.z = ox > 0 ? -0.4 : 0.4;
      this.group.add(spike);
    });

    // Heavy fist clubs
    [-0.9, 0.9].forEach((ox) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.5), armorMat);
      arm.position.set(ox, 1.1, 0.3);
      this.group.add(arm);
    });
  }

  _updateAI(dt, player, arena) {
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();

    this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Enrage trigger below 50% HP
    if (this.health < this.maxHealth * 0.5 && !this.isEnraged) {
      this.isEnraged = true;
      this.speed = 9.5; // Fast charge!
      audio.playSfx('bruteRoar');
    }

    const moveDir = toPlayer.clone().normalize();
    const nextPos = this.position.clone().addScaledVector(moveDir, this.speed * dt);
    const resolved = arena ? arena.resolveCollision(this.position, nextPos, this.hitboxRadius) : nextPos;
    this.position.copy(resolved);

    // Ground slam melee attack
    if (dist < 3.2 && this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      player.takeDamage(34);
      audio.playSfx('explosion');
      particleManager.spawnExplosion(this.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 3.0, false);
    }
  }
}

// ── 4. Harvester Overlord (Boss) ──────────────

class HarvesterBoss extends BaseEnemy {
  constructor(position, scene) {
    super(EnemyTypes.HARVESTER_BOSS, position, scene);
    this.isBoss = true;
    this.health = 1200;
    this.maxHealth = 1200;
    this.speed = 3.0;
    this.hitboxRadius = 3.2;
    this.hitboxHeight = 4.5;
    this.scoreValue = 3500;
    this.attackCooldown = 3.0;
    this.phase = 1;
    this.hoverTime = 0;
  }

  _buildModel() {
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x180b29,
      roughness: 0.3,
      metalness: 0.9,
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xcc00ff });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x4d0080,
      emissive: 0xaa00ff,
      emissiveIntensity: 0.7,
    });

    this._registerMaterial(hullMat);
    this._registerMaterial(ringMat);

    // Central Leviathan Core
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 2), hullMat);
    core.position.y = 5.0;
    core.castShadow = true;
    this.group.add(core);

    // Pulsing central plasma eye
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), coreMat);
    eye.position.set(0, 5.0, 1.6);
    this.group.add(eye);
    this.bossEye = eye;

    // Rotating biomechanical containment rings
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.3, 8, 32), ringMat);
    ring1.position.y = 5.0;
    this.group.add(ring1);
    this.ring1 = ring1;

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.25, 8, 32), ringMat);
    ring2.position.y = 5.0;
    ring2.rotation.x = Math.PI / 3;
    this.group.add(ring2);
    this.ring2 = ring2;
  }

  _updateAI(dt, player, arena) {
    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();

    // Hover floating motion
    this.hoverTime += dt * 1.5;
    this.group.position.y = 4.5 + Math.sin(this.hoverTime) * 0.8;

    // Rotate energy rings
    if (this.ring1) this.ring1.rotation.z += dt * 1.2;
    if (this.ring2) this.ring2.rotation.y += dt * 0.9;

    this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Check boss phase
    if (this.health < this.maxHealth * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.attackCooldown = 1.8;
      audio.playSfx('bossRoar');
      particleManager.spawnExplosion(this.position.clone(), 6.0, true);
    }

    // Boss Attacks
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;

      if (this.phase === 1) {
        // Attack 1: Triple homing purple plasma orbs
        [-0.3, 0, 0.3].forEach((spread) => {
          const spawnPos = this.position.clone().add(new THREE.Vector3(0, 2.5, 2.0));
          const aimDir = toPlayer.clone().normalize();
          aimDir.x += spread;
          aimDir.normalize();

          projectileManager.spawn({
            type: ProjectileTypes.ALIEN_BOSS_ORB,
            origin: spawnPos,
            direction: aimDir,
            speed: 22,
            damage: 28,
            splashRadius: 3.5,
            lifetime: 4.0,
            isPlayer: false,
          });
        });

        audio.playSfx('bossOrb');
      } else {
        // Phase 2: Barrage of 5 fast explosive orbs
        for (let i = 0; i < 5; i++) {
          const spawnPos = this.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            2.5,
            2.0
          ));
          const aimDir = toPlayer.clone().normalize().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.4
          )).normalize();

          projectileManager.spawn({
            type: ProjectileTypes.ALIEN_BOSS_ORB,
            origin: spawnPos,
            direction: aimDir,
            speed: 30,
            damage: 32,
            splashRadius: 4.0,
            lifetime: 3.5,
            isPlayer: false,
          });
        }

        audio.playSfx('bossBarrage');
      }
    }
  }
}

// ── Enemy Manager Singleton ───────────────────

class EnemyManager {
  constructor() {
    this.scene = null;
    this.enemies = [];
  }

  init(scene) {
    this.scene = scene;
    this.reset();
  }

  reset() {
    for (const enemy of this.enemies) {
      if (enemy.group && enemy.group.parent) {
        enemy.group.parent.remove(enemy.group);
      }
    }
    this.enemies = [];
  }

  spawnEnemy(type, position) {
    let enemy = null;
    switch (type) {
      case EnemyTypes.SWARM_DRONE:
        enemy = new SwarmDrone(position, this.scene);
        break;
      case EnemyTypes.ACID_SPITTER:
        enemy = new AcidSpitter(position, this.scene);
        break;
      case EnemyTypes.ALIENT_BRUTE:
        enemy = new AlienBrute(position, this.scene);
        break;
      case EnemyTypes.HARVESTER_BOSS:
        enemy = new HarvesterBoss(position, this.scene);
        break;
    }

    if (enemy) {
      this.enemies.push(enemy);
      gameState.addWaveStat('enemiesSpawned', 1);
    }
    return enemy;
  }

  get activeEnemies() {
    return this.enemies.filter((e) => e.isAlive);
  }

  update(dt, player, arena) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isAlive) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(dt, player, arena);
    }
  }
}

export const enemyManager = new EnemyManager();
