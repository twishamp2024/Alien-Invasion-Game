// ──────────────────────────────────────────────
//  pickups.js — Power-ups & Field Supplies
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { player } from './player.js';
import { weaponSystem } from './weapons.js';
import { audio } from './audio.js';
import { gameState } from './gameState.js';

export const PickupTypes = Object.freeze({
  HEALTH: 'HEALTH',
  SHIELD: 'SHIELD',
  AMMO: 'AMMO',
  OVERDRIVE: 'OVERDRIVE',
});

class PickupManager {
  constructor() {
    this.scene = null;
    this.pickups = [];

    // Shared Geometries
    this.healthGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    this.shieldGeo = new THREE.OctahedronGeometry(0.45);
    this.ammoGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.6, 8);
    this.overdriveGeo = new THREE.DodecahedronGeometry(0.4);

    // Shared Materials
    this.healthMat = new THREE.MeshStandardMaterial({
      color: 0x11ff44,
      emissive: 0x00cc22,
      emissiveIntensity: 0.8,
    });
    this.shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aacc,
      emissiveIntensity: 0.8,
    });
    this.ammoMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xcc7700,
      emissiveIntensity: 0.8,
    });
    this.overdriveMat = new THREE.MeshStandardMaterial({
      color: 0xcc22ff,
      emissive: 0x9900ff,
      emissiveIntensity: 0.9,
    });
  }

  init(scene) {
    this.scene = scene;
    this.reset();
  }

  reset() {
    for (const p of this.pickups) {
      if (p.group && p.group.parent) {
        p.group.parent.remove(p.group);
      }
    }
    this.pickups = [];
  }

  spawnPickup(type, position) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = 0.8;

    let geo, mat;
    switch (type) {
      case PickupTypes.HEALTH:
        geo = this.healthGeo; mat = this.healthMat; break;
      case PickupTypes.SHIELD:
        geo = this.shieldGeo; mat = this.shieldMat; break;
      case PickupTypes.AMMO:
        geo = this.ammoGeo; mat = this.ammoMat; break;
      case PickupTypes.OVERDRIVE:
        geo = this.overdriveGeo; mat = this.overdriveMat; break;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);

    // Ground shadow / halo ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: mat.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.75;
    group.add(ring);

    if (this.scene) this.scene.add(group);

    this.pickups.push({
      type,
      group,
      mesh,
      position: group.position,
      lifetime: 20.0,
      animPhase: Math.random() * Math.PI * 2,
    });
  }

  rollDrop(position, probability = 0.35) {
    if (Math.random() > probability) return;

    const roll = Math.random();
    let type = PickupTypes.AMMO;
    if (roll < 0.35) {
      type = PickupTypes.HEALTH;
    } else if (roll < 0.65) {
      type = PickupTypes.SHIELD;
    } else if (roll < 0.92) {
      type = PickupTypes.AMMO;
    } else {
      type = PickupTypes.OVERDRIVE;
    }

    this.spawnPickup(type, position);
  }

  update(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        if (p.group.parent) p.group.parent.remove(p.group);
        this.pickups.splice(i, 1);
        continue;
      }

      // Bobbing & Rotation Animation
      p.animPhase += dt * 3.0;
      p.mesh.rotation.y += dt * 2.5;
      p.mesh.rotation.x = Math.sin(p.animPhase * 0.5) * 0.2;
      p.mesh.position.y = Math.sin(p.animPhase) * 0.15;

      // Despawn blink
      if (p.lifetime < 4.0) {
        p.mesh.visible = Math.floor(p.lifetime * 8) % 2 === 0;
      }

      // Check Collection Distance to Player
      if (player && player.isAlive) {
        const dist = player.position.distanceTo(p.position);
        if (dist <= 1.8) {
          this._applyPickup(p.type);
          if (p.group.parent) p.group.parent.remove(p.group);
          this.pickups.splice(i, 1);
        }
      }
    }
  }

  _applyPickup(type) {
    switch (type) {
      case PickupTypes.HEALTH:
        player.heal(40);
        break;
      case PickupTypes.SHIELD:
        player.restoreShield(60);
        break;
      case PickupTypes.AMMO:
        gameState.setState({ ammo: weaponSystem.maxMagazine });
        audio.playSfx('pickup');
        break;
      case PickupTypes.OVERDRIVE:
        weaponSystem.activateOverdrive(10);
        break;
    }
  }
}

export const pickupManager = new PickupManager();
