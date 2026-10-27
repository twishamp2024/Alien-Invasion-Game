// ──────────────────────────────────────────────
//  player.js — Third-Person Armored Cyber-Commando
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { input } from './input.js';
import { gameState, GameStates } from './gameState.js';
import { weaponSystem, WeaponTypes } from './weapons.js';
import { projectileManager } from './projectiles.js';
import { particleManager } from './particles.js';
import { camera as gameCamera } from './camera.js';
import { audio } from './audio.js';
import { ui } from './ui.js';

class Player {
  constructor() {
    this.scene = null;
    this.group = new THREE.Group();
    this.position = this.group.position;

    // Hitbox
    this.hitboxRadius = 0.7;
    this.hitboxHeight = 1.8;

    // Movement Physics
    this.velocity = new THREE.Vector3();
    this.moveSpeed = 8.5; // m/s
    this.sprintMultiplier = 1.45;
    this.acceleration = 45.0;
    this.friction = 14.0;

    // Dash / Dodge
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDuration = 0.3;
    this.dashCooldown = 0.75;
    this.dashCooldownTimer = 0;
    this.dashSpeed = 26.0;
    this.dashDir = new THREE.Vector3();
    this.isInvulnerable = false;

    // Health & Energy Shield
    this.maxHealth = 100;
    this.maxShield = 100;
    this.health = 100;
    this.shield = 100;
    this.shieldRegenDelay = 4.0;
    this.shieldRegenTimer = 0;
    this.shieldRegenRate = 30.0; // shield/sec

    // Status
    this.isAlive = true;

    // Procedural Model Components
    this.bodyParts = {};
    this.muzzlePoint = new THREE.Vector3();
    this.animTime = 0;

    // Thrusters
    this.thrusterFlames = [];
  }

  init(scene) {
    this.scene = scene;
    this._buildCharacterModel();
    this.scene.add(this.group);
    gameCamera.setTarget(this.group);
    this.reset();
  }

  // ── Procedural Sci-Fi Soldier Model ──────────

  _buildCharacterModel() {
    // Clear any previous children
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2638,
      roughness: 0.4,
      metalness: 0.8,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x0088cc,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.9,
    });

    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.7 });

    // 1. Torso & Chestplate
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.15;

    const chestGeo = new THREE.BoxGeometry(0.85, 0.65, 0.55);
    const chest = new THREE.Mesh(chestGeo, armorMat);
    chest.castShadow = true;
    torsoGroup.add(chest);

    // Glowing chest power core
    const coreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, visorMat);
    core.position.set(0, 0.08, 0.28);
    torsoGroup.add(core);

    // Abdomen / belt
    const abGeo = new THREE.BoxGeometry(0.65, 0.35, 0.45);
    const ab = new THREE.Mesh(abGeo, darkMat);
    ab.position.y = -0.42;
    torsoGroup.add(ab);

    // 2. Helmet
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.52;

    const helmGeo = new THREE.BoxGeometry(0.48, 0.48, 0.52);
    const helm = new THREE.Mesh(helmGeo, armorMat);
    helm.castShadow = true;
    headGroup.add(helm);

    // Visor slit
    const visorGeo = new THREE.BoxGeometry(0.38, 0.1, 0.05);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.02, 0.27);
    headGroup.add(visor);

    torsoGroup.add(headGroup);

    // 3. Backpack Thruster Unit
    const packGeo = new THREE.BoxGeometry(0.55, 0.55, 0.28);
    const pack = new THREE.Mesh(packGeo, armorMat);
    pack.position.set(0, 0.05, -0.38);
    torsoGroup.add(pack);

    // Glowing reactor strip on backpack
    const stripGeo = new THREE.BoxGeometry(0.38, 0.08, 0.04);
    const strip = new THREE.Mesh(stripGeo, visorMat);
    strip.position.set(0, 0.12, -0.53);
    torsoGroup.add(strip);

    // Suit rim light illuminating player from behind
    const suitLight = new THREE.PointLight(0x00d4ff, 1.8, 6.0);
    suitLight.position.set(0, 0.2, -0.6);
    torsoGroup.add(suitLight);

    // Dual thruster nozzles
    this.thrusterFlames = [];
    [-0.18, 0.18].forEach((ox) => {
      const nozzleGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.25, 8);
      const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
      nozzle.position.set(ox, -0.22, -0.42);
      torsoGroup.add(nozzle);

      // Jet exhaust flame
      const flameGeo = new THREE.ConeGeometry(0.09, 0.45, 8);
      flameGeo.rotateX(Math.PI);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x00e1ff, transparent: true, opacity: 0.85 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(ox, -0.46, -0.42);
      torsoGroup.add(flame);
      this.thrusterFlames.push(flame);
    });

    // 4. Arms & Heavy Rifle
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), armorMat);
    leftArm.position.set(-0.52, -0.05, 0.12);
    leftArm.castShadow = true;
    torsoGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), armorMat);
    rightArm.position.set(0.52, -0.05, 0.18);
    rightArm.castShadow = true;
    torsoGroup.add(rightArm);

    // Futuristic Plasma Rifle held in hands
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.35, -0.1, 0.55);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.7), darkMat);
    rifleGroup.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), trimMat);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.04, 0.48);
    rifleGroup.add(barrel);

    // Glowing ammo cell on rifle
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.2), visorMat);
    cell.position.set(0, 0.12, -0.05);
    rifleGroup.add(cell);

    torsoGroup.add(rifleGroup);

    this.group.add(torsoGroup);

    // 5. Armored Legs (hinged at hip)
    const legGeo = new THREE.BoxGeometry(0.26, 0.75, 0.28);

    const leftLeg = new THREE.Mesh(legGeo, armorMat);
    leftLeg.position.set(-0.25, 0.4, 0);
    leftLeg.castShadow = true;
    this.group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, armorMat);
    rightLeg.position.set(0.25, 0.4, 0);
    rightLeg.castShadow = true;
    this.group.add(rightLeg);

    // Cache components for procedural animation
    this.bodyParts = {
      torso: torsoGroup,
      head: headGroup,
      leftArm,
      rightArm,
      rifle: rifleGroup,
      leftLeg,
      rightLeg,
    };
  }

  // ── Reset ────────────────────────────────────

  reset(startPos = new THREE.Vector3(0, 0, 0)) {
    this.position.copy(startPos);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.isAlive = true;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.shieldRegenTimer = 0;

    weaponSystem.reset();

    gameState.setState({
      health: this.health,
      shield: this.shield,
      ammo: weaponSystem.maxMagazine,
    });
  }

  // ── Health & Damage ──────────────────────────

  takeDamage(amount) {
    if (!this.isAlive || this.isInvulnerable) return;

    this.shieldRegenTimer = this.shieldRegenDelay;

    let remainingDmg = amount;

    // Shield absorbs first
    if (this.shield > 0) {
      if (this.shield >= remainingDmg) {
        this.shield -= remainingDmg;
        remainingDmg = 0;
      } else {
        remainingDmg -= this.shield;
        this.shield = 0;
      }
      audio.playSfx('shieldHit');
    }

    if (remainingDmg > 0) {
      this.health = Math.max(0, this.health - remainingDmg);
      audio.playSfx('playerHurt');
      ui.triggerDamageVignette(0.75);
      gameCamera.addTrauma(0.35);

      if (this.health <= 0) {
        this.die();
      }
    }

    gameState.setState({
      health: this.health,
      shield: this.shield,
    });
  }

  heal(amount) {
    if (!this.isAlive) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    gameState.setState({ health: this.health });
    audio.playSfx('heal');
  }

  restoreShield(amount) {
    if (!this.isAlive) return;
    this.shield = Math.min(this.maxShield, this.shield + amount);
    gameState.setState({ shield: this.shield });
    audio.playSfx('shieldRestore');
  }

  die() {
    this.isAlive = false;
    audio.playSfx('playerDeath');
    particleManager.spawnExplosion(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 3.5, false);
    gameState.setState({ gameState: GameStates.GAME_OVER });
  }

  // ── Movement & Controls ──────────────────────

  handleMovement(dt, arena) {
    if (!this.isAlive) return;

    // Read WASD input
    let moveX = 0;
    let moveZ = 0;

    if (input.isKeyDown('KeyW')) moveZ += 1;
    if (input.isKeyDown('KeyS')) moveZ -= 1;
    if (input.isKeyDown('KeyA')) moveX -= 1;
    if (input.isKeyDown('KeyD')) moveX += 1;

    // Relative to camera yaw
    const camYaw = gameCamera.yaw;
    const forward = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));

    const inputDir = new THREE.Vector3();
    if (moveX !== 0 || moveZ !== 0) {
      inputDir.addScaledVector(right, moveX);
      inputDir.addScaledVector(forward, moveZ);
      inputDir.normalize();
    }

    // Sprint modifier
    const isSprinting = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');
    const targetSpeed = this.moveSpeed * (isSprinting ? this.sprintMultiplier : 1.0);

    // Dash / Dodge
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= dt;
    }

    if (input.isKeyPressed('Space') && this.dashCooldownTimer <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.isInvulnerable = true;
      this.dashTimer = this.dashDuration;
      this.dashCooldownTimer = this.dashCooldown;
      this.dashDir.copy(inputDir.lengthSq() > 0 ? inputDir : forward).normalize();

      audio.playSfx('dash');
      gameCamera.addTrauma(0.18);
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      this.velocity.copy(this.dashDir).multiplyScalar(this.dashSpeed);
      particleManager.spawnDashGhost(this.position.clone().add(new THREE.Vector3(0, 1, 0)), this.velocity);

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.isInvulnerable = false;
      }
    } else {
      // Normal acceleration and friction
      if (inputDir.lengthSq() > 0) {
        const desiredVel = inputDir.clone().multiplyScalar(targetSpeed);
        this.velocity.lerp(desiredVel, Math.min(1.0, this.acceleration * dt));
      } else {
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, this.friction * dt));
      }
    }

    // Integrate position with collision check
    const currentPos = this.position.clone();
    const nextPos = currentPos.clone().addScaledVector(this.velocity, dt);

    if (arena) {
      const resolved = arena.resolveCollision(currentPos, nextPos, this.hitboxRadius);
      this.position.copy(resolved);
    } else {
      this.position.copy(nextPos);
    }

    // Rotate character smoothly to face camera aim direction
    const targetYaw = camYaw;
    this.group.rotation.y = targetYaw;

    // Thruster visual flame scaling
    const speedRatio = this.velocity.length() / (this.moveSpeed * this.sprintMultiplier);
    this.thrusterFlames.forEach((flame) => {
      const scale = this.isDashing ? 2.5 : Math.max(0.4, speedRatio * 1.6);
      flame.scale.set(1, scale, 1);
    });

    // Procedural leg swing animation
    if (this.velocity.length() > 0.5 && !this.isDashing) {
      this.animTime += dt * this.velocity.length() * 1.5;
      const swing = Math.sin(this.animTime) * 0.45;
      if (this.bodyParts.leftLeg) this.bodyParts.leftLeg.rotation.x = swing;
      if (this.bodyParts.rightLeg) this.bodyParts.rightLeg.rotation.x = -swing;
      if (this.bodyParts.leftArm) this.bodyParts.leftArm.rotation.x = -swing * 0.5;
    } else {
      if (this.bodyParts.leftLeg) this.bodyParts.leftLeg.rotation.x = 0;
      if (this.bodyParts.rightLeg) this.bodyParts.rightLeg.rotation.x = 0;
      if (this.bodyParts.leftArm) this.bodyParts.leftArm.rotation.x = 0;
    }
  }

  // ── Firing & Weapons ─────────────────────────

  handleCombat(dt) {
    if (!this.isAlive) return;

    weaponSystem.update(dt);

    // Weapon slot hotkeys (1, 2, 3)
    if (input.isKeyPressed('Digit1')) weaponSystem.setWeapon(WeaponTypes.PULSE_RIFLE);
    if (input.isKeyPressed('Digit2')) weaponSystem.setWeapon(WeaponTypes.SCATTER_BLASTER);
    if (input.isKeyPressed('Digit3')) weaponSystem.setWeapon(WeaponTypes.PLASMA_ROCKET);

    // Reload hotkey (R)
    if (input.isKeyPressed('KeyR')) {
      weaponSystem.startReload();
    }

    // ADS / Zoom toggle (Right Click)
    gameCamera.isAiming = input.isMouseDown(2);

    // Primary Fire (Left Click)
    if (input.isMouseDown(0) && input.isPointerLocked) {
      // Calculate world muzzle position
      const muzzleLocal = new THREE.Vector3(0.35, 1.05, 1.1);
      const muzzleWorld = muzzleLocal.clone().applyMatrix4(this.group.matrixWorld);

      // Aim ray from camera center
      const aimRay = gameCamera.getAimRay();

      // Muzzle flash particle
      particleManager.spawnMuzzleFlash(muzzleWorld, aimRay.direction, 0x00ffff);

      // Fire weapon
      weaponSystem.fire(muzzleWorld, aimRay.direction, projectileManager, gameCamera);
    }
  }

  // ── Frame Update ─────────────────────────────

  update(dt, arena) {
    if (!this.isAlive) return;

    // Movement & Dash
    this.handleMovement(dt, arena);

    // Combat & Weapons
    this.handleCombat(dt);

    // Shield Regeneration
    if (this.shieldRegenTimer > 0) {
      this.shieldRegenTimer -= dt;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * dt);
      gameState.setState({ shield: this.shield });
    }
  }
}

export const player = new Player();
