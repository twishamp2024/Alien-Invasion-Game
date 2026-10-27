// ──────────────────────────────────────────────
//  camera.js — Third-Person Camera with Smooth Spring & Trauma Shake
// ──────────────────────────────────────────────

import * as THREE from 'three';
import { settings } from './settings.js';
import { input } from './input.js';

class GameCamera {
  constructor() {
    this.camera = null;
    this.target = null; // usually player position/group

    // Orientation (angles in radians)
    this.yaw = 0;
    this.pitch = 0.15; // slight downward angle

    // Angle clamps
    this.minPitch = -Math.PI / 4;   // -45 deg (looking up)
    this.maxPitch = Math.PI / 2.5;  // +72 deg (looking down)

    // Third-person offset relative to target facing
    // x: shoulder offset (right), y: height above feet, z: distance behind
    this.offset = new THREE.Vector3(0.85, 1.8, -3.2);
    this.aimOffset = new THREE.Vector3(0.65, 1.6, -2.2);
    this.isAiming = false;

    // Follow smoothing
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.followSpeed = 14.0; // exponential convergence rate

    // Trauma-based Screen Shake (from game-feel skill)
    this.trauma = 0.0;
    this.traumaDecay = 1.4; // lost per second
    this.maxShakeOffset = new THREE.Vector3(0.35, 0.35, 0.25);
    this.maxShakeRoll = 0.06; // radians
    this._shakeTime = 0;

    // Recoil kickback
    this.recoilPitch = 0.0;
    this.recoilYaw = 0.0;
    this.recoilRecoverySpeed = 16.0;

    // Raycaster for camera wall collision
    this.raycaster = new THREE.Raycaster();
  }

  init(camera, target = null) {
    this.camera = camera;
    this.target = target;

    if (this.target) {
      this.currentPosition.copy(this.target.position).add(new THREE.Vector3(0, 2, -3.5));
      this.currentLookAt.copy(this.target.position).add(new THREE.Vector3(0, 1.5, 0));
    }
  }

  setTarget(target) {
    this.target = target;
  }

  // ── Input & Orientation ──────────────────────

  handleInput() {
    if (!input.isPointerLocked) return;

    const delta = input.getMouseDelta();
    const sens = settings.mouseSensitivity * 0.0022;

    this.yaw -= delta.x * sens;
    this.pitch -= delta.y * sens;

    // Clamp pitch
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  // ── Game Feel: Shake & Recoil ────────────────

  /**
   * Add screen shake trauma (0.0 - 1.0).
   * Trauma is additive and clamped to 1.
   */
  addTrauma(amount) {
    if (!settings.screenShake) return;
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /**
   * Add weapon recoil kick.
   */
  addRecoil(pitchKick = 0.02, yawKick = 0.005) {
    this.recoilPitch += pitchKick;
    this.recoilYaw += (Math.random() - 0.5) * yawKick;
  }

  // ── Forward & Aim Direction ──────────────────

  getForwardDirection() {
    const totalYaw = this.yaw + this.recoilYaw;
    const totalPitch = this.pitch + this.recoilPitch;

    const dir = new THREE.Vector3(
      Math.sin(totalYaw) * Math.cos(totalPitch),
      Math.sin(totalPitch),
      Math.cos(totalYaw) * Math.cos(totalPitch)
    );
    return dir.normalize();
  }

  getAimRay() {
    const dir = this.getForwardDirection();
    return {
      origin: this.camera.position.clone(),
      direction: dir,
    };
  }

  // ── Frame Update ─────────────────────────────

  update(dt, arenaColliders = []) {
    if (!this.camera || !this.target) return;

    // Process mouse movement
    this.handleInput();

    // Recoil recovery
    this.recoilPitch = Math.max(0, this.recoilPitch - this.recoilRecoverySpeed * dt);
    this.recoilYaw *= Math.max(0, 1 - this.recoilRecoverySpeed * dt);

    const effectiveYaw = this.yaw + this.recoilYaw;
    const effectivePitch = this.pitch + this.recoilPitch;

    // Target pivot point (head/chest level)
    const targetPivot = this.target.position.clone().add(new THREE.Vector3(0, 1.5, 0));

    // Choose base offset
    const activeOffset = this.isAiming ? this.aimOffset : this.offset;

    // Calculate ideal camera position in world space
    const cosY = Math.cos(effectiveYaw);
    const sinY = Math.sin(effectiveYaw);
    const cosP = Math.cos(effectivePitch);
    const sinP = Math.sin(effectivePitch);

    // Rotate offset around yaw & pitch
    const right = new THREE.Vector3(cosY, 0, -sinY);
    const forward = new THREE.Vector3(sinY * cosP, sinP, cosY * cosP);
    const up = new THREE.Vector3(-sinY * sinP, cosP, -cosY * sinP);

    const desiredPos = targetPivot.clone()
      .add(right.clone().multiplyScalar(activeOffset.x))
      .add(up.clone().multiplyScalar(activeOffset.y))
      .add(forward.clone().multiplyScalar(activeOffset.z));

    // Camera collision check: prevent clipping behind walls
    let finalDesiredPos = desiredPos;
    if (arenaColliders && arenaColliders.length > 0) {
      const dirToCam = desiredPos.clone().sub(targetPivot);
      const camDist = dirToCam.length();
      if (camDist > 0.1) {
        dirToCam.normalize();
        this.raycaster.set(targetPivot, dirToCam);
        this.raycaster.far = camDist;

        // Collect mesh obstacles
        const obstacleMeshes = arenaColliders
          .map((c) => c.mesh || c.group)
          .filter(Boolean);

        const hits = this.raycaster.intersectObjects(obstacleMeshes, true);
        if (hits.length > 0 && hits[0].distance < camDist) {
          // Pull camera closer to target pivot to avoid wall clipping
          finalDesiredPos = targetPivot.clone().add(dirToCam.multiplyScalar(Math.max(0.6, hits[0].distance - 0.2)));
        }
      }
    }

    // Exponential frame-rate independent smoothing
    const t = 1.0 - Math.exp(-this.followSpeed * dt);
    this.currentPosition.lerp(finalDesiredPos, t);

    // Look at target pivot + look-ahead offset
    const desiredLookAt = targetPivot.clone().add(forward.clone().multiplyScalar(15));
    this.currentLookAt.lerp(desiredLookAt, t);

    // Apply trauma screen shake
    let shakeOffset = new THREE.Vector3();
    let shakeRoll = 0;

    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
      const shake = this.trauma * this.trauma; // quadratic feel

      this._shakeTime += dt * 32.0;
      shakeOffset.set(
        this.maxShakeOffset.x * shake * Math.sin(this._shakeTime * 1.4),
        this.maxShakeOffset.y * shake * Math.sin(this._shakeTime * 1.8),
        this.maxShakeOffset.z * shake * Math.cos(this._shakeTime * 2.1)
      );
      shakeRoll = this.maxShakeRoll * shake * Math.sin(this._shakeTime * 1.1);
    }

    // Set camera transform
    this.camera.position.copy(this.currentPosition).add(shakeOffset);
    this.camera.lookAt(this.currentLookAt);
    if (shakeRoll !== 0) {
      this.camera.rotation.z += shakeRoll;
    }
  }
}

export const camera = new GameCamera();
