// ──────────────────────────────────────────────
//  projectiles.js — Projectile Simulation & Collision
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { particleManager } from './particles.js';
import { audio } from './audio.js';

export const ProjectileTypes = Object.freeze({
  PLAYER_PULSE: 'PLAYER_PULSE',
  PLAYER_ROCKET: 'PLAYER_ROCKET',
  PLAYER_PELLET: 'PLAYER_PELLET',
  ALIEN_SPIT: 'ALIEN_SPIT',
  ALIEN_BOSS_ORB: 'ALIEN_BOSS_ORB',
});

class ProjectileManager {
  constructor() {
    this.scene = null;
    this.projectiles = [];
    this.maxProjectiles = 200;

    // Shared Geometries
    this.pulseGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6);
    this.pulseGeo.rotateX(Math.PI / 2); // align with forward Z

    this.rocketGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8);
    this.rocketGeo.rotateX(Math.PI / 2);

    this.pelletGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.acidGeo = new THREE.SphereGeometry(0.25, 8, 8);
    this.bossOrbGeo = new THREE.SphereGeometry(0.5, 12, 12);

    // Shared Materials
    this.pulseMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    this.rocketMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    this.pelletMat = new THREE.MeshBasicMaterial({ color: 0x55ffff });
    this.acidMat = new THREE.MeshBasicMaterial({ color: 0x44ff22 });
    this.bossOrbMat = new THREE.MeshBasicMaterial({ color: 0xcc00ff });
  }

  init(scene) {
    this.scene = scene;
    this.reset();
  }

  reset() {
    for (const p of this.projectiles) {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    }
    this.projectiles = [];
  }

  // ── Spawn Projectile ─────────────────────────

  spawn({
    type = ProjectileTypes.PLAYER_PULSE,
    origin,
    direction,
    speed = 80,
    damage = 25,
    splashRadius = 0,
    lifetime = 2.0,
    isPlayer = true,
  }) {
    if (this.projectiles.length >= this.maxProjectiles) {
      const old = this.projectiles.shift();
      if (old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
    }

    let geo, mat;
    switch (type) {
      case ProjectileTypes.PLAYER_PULSE:
        geo = this.pulseGeo; mat = this.pulseMat; break;
      case ProjectileTypes.PLAYER_ROCKET:
        geo = this.rocketGeo; mat = this.rocketMat; break;
      case ProjectileTypes.PLAYER_PELLET:
        geo = this.pelletGeo; mat = this.pelletMat; break;
      case ProjectileTypes.ALIEN_SPIT:
        geo = this.acidGeo; mat = this.acidMat; break;
      case ProjectileTypes.ALIEN_BOSS_ORB:
        geo = this.bossOrbGeo; mat = this.bossOrbMat; break;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);

    const normDir = direction.clone().normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normDir);

    this.scene.add(mesh);

    const projectile = {
      type,
      mesh,
      position: origin.clone(),
      previousPosition: origin.clone(),
      direction: normDir,
      velocity: normDir.clone().multiplyScalar(speed),
      speed,
      damage,
      splashRadius,
      lifetime,
      isPlayer,
      gravity: type === ProjectileTypes.ALIEN_SPIT ? 5.0 : 0.0,
    };

    this.projectiles.push(projectile);
    return projectile;
  }

  // ── Frame Update & Collision Detection ───────

  update(dt, { arena, enemies = [], player = null, onHitTarget = null }) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        this._destroyProjectile(i);
        continue;
      }

      // Save previous position for continuous raycast sweep
      p.previousPosition.copy(p.position);

      // Apply gravity if projectile has drop (like alien spit)
      if (p.gravity > 0) {
        p.velocity.y -= p.gravity * dt;
        p.direction.copy(p.velocity).normalize();
        p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.direction);
      }

      // Move position
      const moveStep = p.velocity.clone().multiplyScalar(dt);
      p.position.add(moveStep);
      p.mesh.position.copy(p.position);

      // Raycast segment: from previousPosition to current position
      const segmentDir = p.position.clone().sub(p.previousPosition);
      const segmentLen = segmentDir.length();

      if (segmentLen < 0.0001) continue;
      segmentDir.normalize();

      let hitOccurred = false;

      // 1. Collision with Arena Obstacles and Ground
      if (p.position.y <= 0.1) {
        // Hit floor
        this._handleEnvironmentImpact(p, new THREE.Vector3(p.position.x, 0.1, p.position.z), new THREE.Vector3(0, 1, 0), enemies, player);
        this._destroyProjectile(i);
        continue;
      }

      if (arena && arena.colliders) {
        for (const col of arena.colliders) {
          if (col.type === 'box') {
            if (
              p.position.x >= col.minX && p.position.x <= col.maxX &&
              p.position.z >= col.minZ && p.position.z <= col.maxZ &&
              p.position.y < 6.0
            ) {
              this._handleEnvironmentImpact(p, p.position, new THREE.Vector3(0, 0, 1), enemies, player);
              hitOccurred = true;
              break;
            }
          } else if (col.type === 'cylinder') {
            const dx = p.position.x - col.x;
            const dz = p.position.z - col.z;
            if (dx * dx + dz * dz < col.radius * col.radius && p.position.y < 12.0) {
              this._handleEnvironmentImpact(p, p.position, new THREE.Vector3(dx, 0, dz).normalize(), enemies, player);
              hitOccurred = true;
              break;
            }
          }
        }
      }

      if (hitOccurred) {
        this._destroyProjectile(i);
        continue;
      }

      // 2. Player Projectiles vs Enemies
      if (p.isPlayer) {
        for (const enemy of enemies) {
          if (!enemy.isAlive) continue;

          // Capsule/Sphere distance check
          const enemyPos = enemy.position.clone().add(new THREE.Vector3(0, enemy.hitboxHeight * 0.5, 0));
          const dist = p.position.distanceTo(enemyPos);

          if (dist <= enemy.hitboxRadius + 0.3) {
            // Impact!
            this._handleEnemyHit(p, enemy, enemies);
            onHitTarget?.(p, enemy);
            hitOccurred = true;
            break;
          }
        }
      }
      // 3. Enemy Projectiles vs Player
      else if (!p.isPlayer && player && player.isAlive) {
        const playerCenter = player.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const dist = p.position.distanceTo(playerCenter);

        if (dist <= player.hitboxRadius + 0.3) {
          this._handlePlayerHit(p, player);
          hitOccurred = true;
        }
      }

      if (hitOccurred) {
        this._destroyProjectile(i);
      }
    }
  }

  _destroyProjectile(index) {
    const p = this.projectiles[index];
    if (p.mesh && p.mesh.parent) {
      p.mesh.parent.remove(p.mesh);
    }
    this.projectiles.splice(index, 1);
  }

  // ── Impact Handlers ──────────────────────────

  _handleEnvironmentImpact(p, point, normal, enemies, player) {
    if (p.splashRadius > 0) {
      // Area of Effect Explosion
      particleManager.spawnExplosion(point, p.splashRadius, p.type === ProjectileTypes.PLAYER_ROCKET);
      audio.playSfx('explosion');

      // Splash damage against enemies
      if (p.isPlayer) {
        for (const enemy of enemies) {
          if (!enemy.isAlive) continue;
          const d = enemy.position.distanceTo(point);
          if (d <= p.splashRadius) {
            const falloff = 1 - (d / p.splashRadius);
            enemy.takeDamage(p.damage * falloff, point);
          }
        }
      }
    } else {
      // Small spark impact
      particleManager.spawnSparks(point, normal, 6, p.isPlayer ? 0x00ffff : 0x44ff22);
      audio.playSfx('ricochet');
    }
  }

  _handleEnemyHit(p, enemy, allEnemies) {
    const hitPoint = p.position.clone();
    particleManager.spawnAlienBlood(hitPoint, p.direction.clone().negate(), 12, enemy.isBoss);
    audio.playSfx('enemyHit');

    if (p.splashRadius > 0) {
      particleManager.spawnExplosion(hitPoint, p.splashRadius, true);
      audio.playSfx('explosion');

      // Splash damage to nearby cluster
      for (const other of allEnemies) {
        if (!other.isAlive) continue;
        const d = other.position.distanceTo(hitPoint);
        if (d <= p.splashRadius) {
          const falloff = 1 - (d / p.splashRadius);
          other.takeDamage(p.damage * falloff, hitPoint);
        }
      }
    } else {
      enemy.takeDamage(p.damage, hitPoint);
    }
  }

  _handlePlayerHit(p, player) {
    const hitPoint = p.position.clone();
    particleManager.spawnSparks(hitPoint, p.direction.clone().negate(), 8, 0xff3333);
    player.takeDamage(p.damage);
  }
}

export const projectileManager = new ProjectileManager();
