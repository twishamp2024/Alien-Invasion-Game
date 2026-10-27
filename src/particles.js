// ──────────────────────────────────────────────
//  particles.js — High-Performance Particle Engine
// ──────────────────────────────────────────────

import * as THREE from 'three';

class ParticleManager {
  constructor() {
    this.scene = null;
    this.particles = [];
    this.maxParticles = 600;

    // Shared geometries and materials for zero reallocation
    this.sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.25);
    this.bloodGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.smokeGeo = new THREE.DodecahedronGeometry(0.3, 1);
    this.debrisGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.ringGeo = new THREE.RingGeometry(0.2, 0.4, 16);

    // Reusable materials
    this.cyanMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 });
    this.orangeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1 });
    this.greenMat = new THREE.MeshBasicMaterial({ color: 0x33ff55, transparent: true, opacity: 1 });
    this.purpleMat = new THREE.MeshBasicMaterial({ color: 0xcc22ff, transparent: true, opacity: 1 });
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.7 });
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
  }

  init(scene) {
    this.scene = scene;
    this.reset();
  }

  reset() {
    for (const p of this.particles) {
      if (p.mesh && p.mesh.parent) {
        p.mesh.parent.remove(p.mesh);
      }
    }
    this.particles = [];
  }

  // ── Spawn Helpers ────────────────────────────

  _addParticle(mesh, velocity, lifetime, options = {}) {
    if (this.particles.length >= this.maxParticles) {
      // Remove oldest
      const old = this.particles.shift();
      if (old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
    }

    if (this.scene) this.scene.add(mesh);
    this.particles.push({
      mesh,
      velocity: velocity.clone(),
      lifetime,
      maxLifetime: lifetime,
      gravity: options.gravity !== undefined ? options.gravity : 9.8,
      drag: options.drag !== undefined ? options.drag : 0.96,
      scaleRate: options.scaleRate !== undefined ? options.scaleRate : 0.0,
      rotSpeed: options.rotSpeed || new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      ),
    });
  }

  // ── Muzzle Flash ─────────────────────────────

  spawnMuzzleFlash(pos, dir, color = 0x00ffff) {
    const flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    flashMesh.position.copy(pos);
    this._addParticle(flashMesh, dir.clone().multiplyScalar(4), 0.06, {
      gravity: 0,
      scaleRate: -4.0,
    });
  }

  // ── Impact Sparks ────────────────────────────

  spawnSparks(pos, normal, count = 8, color = 0xffaa22) {
    const mat = color === 0x00ffff ? this.cyanMat : this.orangeMat;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, mat.clone());
      mesh.position.copy(pos);

      // Reflect direction around normal with spread
      const vel = normal.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        Math.random() * 1.2,
        (Math.random() - 0.5) * 1.8
      )).normalize().multiplyScalar(4 + Math.random() * 7);

      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.clone().normalize());

      this._addParticle(mesh, vel, 0.2 + Math.random() * 0.25, {
        gravity: 14.0,
        drag: 0.94,
        scaleRate: -1.5,
      });
    }
  }

  // ── Alien Blood Splatter ─────────────────────

  spawnAlienBlood(pos, normal, count = 10, isPurple = false) {
    const mat = isPurple ? this.purpleMat : this.greenMat;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.bloodGeo, mat.clone());
      mesh.position.copy(pos);

      const vel = normal.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2.0
      )).normalize().multiplyScalar(3 + Math.random() * 6);

      this._addParticle(mesh, vel, 0.3 + Math.random() * 0.3, {
        gravity: 12.0,
        drag: 0.93,
        scaleRate: -1.0,
      });
    }
  }

  // ── Explosions ───────────────────────────────

  spawnExplosion(pos, radius = 2.5, isCyan = false) {
    // 1. Shockwave ring
    const ringMesh = new THREE.Mesh(this.ringGeo, this.shockwaveMat.clone());
    ringMesh.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0));
    ringMesh.rotation.x = -Math.PI / 2;
    this._addParticle(ringMesh, new THREE.Vector3(0, 0, 0), 0.35, {
      gravity: 0,
      scaleRate: 14.0,
    });

    // 2. Fireball center
    const fireMesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.5, 12, 12),
      new THREE.MeshBasicMaterial({
        color: isCyan ? 0x00ffff : 0xff5500,
        transparent: true,
        opacity: 1,
      })
    );
    fireMesh.position.copy(pos);
    this._addParticle(fireMesh, new THREE.Vector3(0, 1, 0), 0.25, {
      gravity: -2,
      scaleRate: 3.0,
    });

    // 3. Smoke puffs
    for (let i = 0; i < 8; i++) {
      const smokeMesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      smokeMesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * radius * 0.5,
        Math.random() * 0.5,
        (Math.random() - 0.5) * radius * 0.5
      ));

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 5
      );

      this._addParticle(smokeMesh, vel, 0.5 + Math.random() * 0.4, {
        gravity: -1.5,
        drag: 0.92,
        scaleRate: 2.0,
      });
    }

    // 4. Debris chunks
    for (let i = 0; i < 12; i++) {
      const dMesh = new THREE.Mesh(this.debrisGeo, this.orangeMat.clone());
      dMesh.position.copy(pos);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        4 + Math.random() * 8,
        (Math.random() - 0.5) * 12
      );

      this._addParticle(dMesh, vel, 0.4 + Math.random() * 0.3, {
        gravity: 16.0,
        drag: 0.95,
        scaleRate: -1.0,
      });
    }
  }

  // ── Dash Thruster Ghosts ─────────────────────

  spawnDashGhost(pos, vel) {
    const ghost = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 6),
      this.cyanMat.clone()
    );
    ghost.position.copy(pos);
    this._addParticle(ghost, vel.clone().multiplyScalar(-0.15), 0.25, {
      gravity: 0,
      scaleRate: -1.2,
    });
  }

  // ── Update All Particles ─────────────────────

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        if (p.mesh && p.mesh.parent) {
          p.mesh.parent.remove(p.mesh);
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(Math.pow(p.drag, dt * 60));

      p.mesh.position.addScaledVector(p.velocity, dt);

      // Floor bounce / clamp
      if (p.mesh.position.y < 0.05 && p.gravity > 0) {
        p.mesh.position.y = 0.05;
        p.velocity.y = -p.velocity.y * 0.4;
        p.velocity.x *= 0.7;
        p.velocity.z *= 0.7;
      }

      // Rotation
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;
      p.mesh.rotation.z += p.rotSpeed.z * dt;

      // Scale animation
      if (p.scaleRate !== 0) {
        const s = Math.max(0.01, p.mesh.scale.x + p.scaleRate * dt);
        p.mesh.scale.set(s, s, s);
      }

      // Alpha fade
      const progress = p.lifetime / p.maxLifetime;
      if (p.mesh.material && p.mesh.material.opacity !== undefined) {
        p.mesh.material.opacity = Math.max(0, progress);
      }
    }
  }
}

export const particleManager = new ParticleManager();
