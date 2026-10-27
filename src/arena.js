// ──────────────────────────────────────────────
//  arena.js — 3D Sci-Fi Outpost & Alien Arena
// ──────────────────────────────────────────────

import * as THREE from 'three';

class Arena {
  constructor() {
    this.scene = null;
    this.colliders = [];
    this.spawnPoints = [];
    this.playerSpawn = new THREE.Vector3(0, 0, 0);
    this.size = 100; // 100x100 playable arena
    this.halfSize = 50;
    this.lights = [];
  }

  init(scene) {
    this.scene = scene;
    this.colliders = [];

    this._createEnvironment();
    this._createFloor();
    this._createPerimeterWalls();
    this._createStructures();
    this._createAlienTerrainFeatures();
    this._setupLighting();
    this._setupSpawnPoints();
  }

  // ── Skybox & Fog ─────────────────────────────

  _createEnvironment() {
    // Dark deep-space nebula atmosphere
    this.scene.background = new THREE.Color(0x030712);
    this.scene.fog = new THREE.FogExp2(0x050c18, 0.012);

    // Distant stars / space dust particle field
    const starCount = 1500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 250 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 10;
      starPos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // Mix cyan, white, and purple stars
      const c = Math.random();
      if (c < 0.6) {
        starColors[i * 3] = 0.8; starColors[i * 3 + 1] = 0.9; starColors[i * 3 + 2] = 1.0;
      } else if (c < 0.85) {
        starColors[i * 3] = 0.2; starColors[i * 3 + 1] = 0.9; starColors[i * 3 + 2] = 1.0;
      } else {
        starColors[i * 3] = 0.9; starColors[i * 3 + 1] = 0.3; starColors[i * 3 + 2] = 0.8;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    const starField = new THREE.Points(starGeo, starMat);
    this.scene.add(starField);

    // Distant alien moons in the sky
    const moonGeo = new THREE.SphereGeometry(18, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0x4466aa,
      wireframe: false,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-140, 90, -220);
    this.scene.add(moon);

    const moonGlowGeo = new THREE.SphereGeometry(21, 16, 16);
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x0088cc,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
    moonGlow.position.copy(moon.position);
    this.scene.add(moonGlow);
  }

  // ── Arena Floor ──────────────────────────────

  _createFloor() {
    // High-tech sci-fi ground with grid & metallic look
    const floorSize = 120;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize, 60, 60);

    let floorTexture = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');

      // Dark titanium metallic background
      ctx.fillStyle = '#0a101d';
      ctx.fillRect(0, 0, 1024, 1024);

      // Hexagonal / grid panel lines
      ctx.strokeStyle = '#15253d';
      ctx.lineWidth = 4;
      const step = 64;
      for (let x = 0; x <= 1024; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }
      for (let y = 0; y <= 1024; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }

      // Glowing cyan circuit accent lines
      ctx.strokeStyle = '#00aacc';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;

      for (let i = 128; i < 1024; i += 256) {
        ctx.strokeRect(i + 16, i + 16, 96, 96);
        ctx.beginPath();
        ctx.arc(i + 64, i + 64, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Danger / hazard hazard stripes near edges
      ctx.fillStyle = '#22384a';
      ctx.fillRect(0, 0, 1024, 24);
      ctx.fillRect(0, 1000, 1024, 24);
      ctx.fillRect(0, 0, 24, 1024);
      ctx.fillRect(1000, 0, 24, 1024);

      floorTexture = new THREE.CanvasTexture(canvas);
      floorTexture.wrapS = THREE.RepeatWrapping;
      floorTexture.wrapT = THREE.RepeatWrapping;
      floorTexture.repeat.set(6, 6);
    }

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a101d,
      map: floorTexture,
      roughness: 0.65,
      metalness: 0.5,
      bumpMap: floorTexture,
      bumpScale: 0.05,
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Center outpost landing circle
    const padGeo = new THREE.RingGeometry(2, 9, 32);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    this.scene.add(pad);
  }

  // ── Perimeter Defense Walls ──────────────────

  _createPerimeterWalls() {
    const wallH = 6;
    const wallThickness = 2;
    const size = this.size;
    const half = this.halfSize;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x142032,
      roughness: 0.7,
      metalness: 0.6,
    });

    const forceFieldMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    });

    const createWallSegment = (x, z, w, d) => {
      // Base barrier
      const geo = new THREE.BoxGeometry(w, wallH, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, wallH / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Glowing force-field extension on top
      const ffGeo = new THREE.BoxGeometry(w, 8, d * 0.5);
      const ffMesh = new THREE.Mesh(ffGeo, forceFieldMat);
      ffMesh.position.set(x, wallH + 4, z);
      this.scene.add(ffMesh);

      // Collider box
      this.colliders.push({
        type: 'box',
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        mesh,
      });
    };

    // North wall
    createWallSegment(0, -half, size + wallThickness, wallThickness);
    // South wall
    createWallSegment(0, half, size + wallThickness, wallThickness);
    // West wall
    createWallSegment(-half, 0, wallThickness, size + wallThickness);
    // East wall
    createWallSegment(half, 0, wallThickness, size + wallThickness);

    // Corner watchtowers
    const towerH = 12;
    const towerR = 3.5;
    const towerGeo = new THREE.CylinderGeometry(towerR * 0.8, towerR, towerH, 8);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0d1828,
      roughness: 0.5,
      metalness: 0.8,
    });

    const corners = [
      [-half, -half],
      [half, -half],
      [-half, half],
      [half, half],
    ];

    corners.forEach(([cx, cz]) => {
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(cx, towerH / 2, cz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);

      // Beacon light atop tower
      const beaconGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(cx, towerH + 0.5, cz);
      this.scene.add(beacon);

      const light = new THREE.PointLight(0x00ffff, 2, 25);
      light.position.set(cx, towerH + 1, cz);
      this.scene.add(light);
      this.lights.push(light);

      this.colliders.push({
        type: 'cylinder',
        x: cx,
        z: cz,
        radius: towerR,
      });
    });
  }

  // ── Outpost Cover & Structures ───────────────

  _createStructures() {
    // Modular sci-fi barricades / tactical cover
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1f2e46,
      roughness: 0.6,
      metalness: 0.5,
    });

    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
    });

    const addBarricade = (x, z, rotY = 0, length = 7) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotY;

      // Lower heavy block
      const bGeo = new THREE.BoxGeometry(length, 2.2, 1.4);
      const bMesh = new THREE.Mesh(bGeo, barrierMat);
      bMesh.position.y = 1.1;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      group.add(bMesh);

      // Glowing trim
      const tGeo = new THREE.BoxGeometry(length + 0.1, 0.2, 1.45);
      const tMesh = new THREE.Mesh(tGeo, stripeMat);
      tMesh.position.y = 2.1;
      group.add(tMesh);

      this.scene.add(group);

      // Collider approximation (oriented bounding box or bounding radius)
      const rad = Math.max(length, 1.4) * 0.55;
      this.colliders.push({
        type: 'box',
        minX: x - (rotY === 0 ? length / 2 : 1.2),
        maxX: x + (rotY === 0 ? length / 2 : 1.2),
        minZ: z - (rotY === 0 ? 1.2 : length / 2),
        maxZ: z + (rotY === 0 ? 1.2 : length / 2),
        group,
      });
    };

    // Tactical cover layout for dynamic gunfights
    addBarricade(-16, -15, 0, 9);
    addBarricade(16, -15, 0, 9);
    addBarricade(-16, 15, 0, 9);
    addBarricade(16, 15, 0, 9);

    addBarricade(-28, 0, Math.PI / 2, 11);
    addBarricade(28, 0, Math.PI / 2, 11);

    // Central Energy Generators / Pylons
    const createEnergyPylon = (x, z) => {
      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(x, 0, z);

      // Base
      const baseGeo = new THREE.CylinderGeometry(2.4, 3.2, 1.5, 8);
      const baseMesh = new THREE.Mesh(baseGeo, barrierMat);
      baseMesh.position.y = 0.75;
      pylonGroup.add(baseMesh);

      // Core column
      const colGeo = new THREE.CylinderGeometry(1.2, 1.2, 7, 16);
      const colMesh = new THREE.Mesh(colGeo, barrierMat);
      colMesh.position.y = 4.5;
      pylonGroup.add(colMesh);

      // Glowing plasma reactor core
      const coreGeo = new THREE.SphereGeometry(1.6, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.y = 5.2;
      pylonGroup.add(coreMesh);

      // Rotating containment ring
      const ringGeo = new THREE.TorusGeometry(2.5, 0.25, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x335577,
        emissive: 0x00aacc,
        emissiveIntensity: 0.5,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 5.2;
      ring.rotation.x = Math.PI / 2;
      pylonGroup.add(ring);

      pylonGroup.userData = { ring };

      this.scene.add(pylonGroup);

      // Pylon light
      const pLight = new THREE.PointLight(0x00ffff, 2.5, 18);
      pLight.position.set(x, 5.5, z);
      this.scene.add(pLight);
      this.lights.push(pLight);

      this.colliders.push({
        type: 'cylinder',
        x,
        z,
        radius: 2.8,
      });

      return pylonGroup;
    };

    this.pylons = [
      createEnergyPylon(-18, -28),
      createEnergyPylon(18, -28),
      createEnergyPylon(-18, 28),
      createEnergyPylon(18, 28),
    ];
  }

  // ── Alien Terrain & Spire Crystals ───────────

  _createAlienTerrainFeatures() {
    // Alien Spire Crystals (luminescent alien corruption invading the base)
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x9900ff,
      emissive: 0x6600cc,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });

    const addSpireCluster = (x, z, scale = 1) => {
      const cluster = new THREE.Group();
      cluster.position.set(x, 0, z);

      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const height = (4 + Math.random() * 5) * scale;
        const width = (0.7 + Math.random() * 0.6) * scale;
        const spireGeo = new THREE.ConeGeometry(width, height, 5);
        const spire = new THREE.Mesh(spireGeo, crystalMat);

        const offsetX = (Math.random() - 0.5) * 2 * scale;
        const offsetZ = (Math.random() - 0.5) * 2 * scale;
        spire.position.set(offsetX, height / 2, offsetZ);

        spire.rotation.x = (Math.random() - 0.5) * 0.3;
        spire.rotation.z = (Math.random() - 0.5) * 0.3;
        spire.castShadow = true;
        cluster.add(spire);
      }

      this.scene.add(cluster);

      const cLight = new THREE.PointLight(0xaa22ff, 1.5, 12 * scale);
      cLight.position.set(x, 3 * scale, z);
      this.scene.add(cLight);
      this.lights.push(cLight);

      this.colliders.push({
        type: 'cylinder',
        x,
        z,
        radius: 2.0 * scale,
      });
    };

    // Place alien crystal spires around perimeter incursions
    addSpireCluster(-36, -35, 1.2);
    addSpireCluster(36, -35, 1.3);
    addSpireCluster(-36, 35, 1.1);
    addSpireCluster(36, 35, 1.4);
    addSpireCluster(0, -42, 1.5);
    addSpireCluster(0, 42, 1.5);
  }

  // ── Lighting Rig ─────────────────────────────

  _setupLighting() {
    // Soft sky-ground fill (hemisphere light)
    const hemiLight = new THREE.HemisphereLight(0x336699, 0x050c18, 0.9);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Primary dramatic Key Sun/Moon Light
    const keyLight = new THREE.DirectionalLight(0xaad5ff, 2.2);
    keyLight.position.set(35, 55, 30);
    keyLight.castShadow = true;

    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 160;

    const d = 55;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;

    this.scene.add(keyLight);
    this.mainDirectionalLight = keyLight;

    // Tactical arena spotlight
    const spot = new THREE.SpotLight(0x00ffff, 4, 80, Math.PI / 4, 0.4, 1.5);
    spot.position.set(0, 30, 0);
    spot.target.position.set(0, 0, 0);
    this.scene.add(spot);
    this.scene.add(spot.target);
  }

  // ── Enemy Spawning Nodes ─────────────────────

  _setupSpawnPoints() {
    // 8 Strategic invasion spawn portals located near perimeter incursions
    this.spawnPoints = [
      new THREE.Vector3(-40, 0, -40),
      new THREE.Vector3(0, 0, -44),
      new THREE.Vector3(40, 0, -40),
      new THREE.Vector3(44, 0, 0),
      new THREE.Vector3(40, 0, 40),
      new THREE.Vector3(0, 0, 44),
      new THREE.Vector3(-40, 0, 40),
      new THREE.Vector3(-44, 0, 0),
    ];
  }

  // ── Update Animation (Pylon rotation etc.) ────

  update(dt) {
    if (this.pylons) {
      for (const p of this.pylons) {
        if (p.userData.ring) {
          p.userData.ring.rotation.z += dt * 1.5;
        }
      }
    }
  }

  // ── Collision Query ──────────────────────────

  checkCollision(pos, radius = 0.8) {
    // Boundary check
    const limit = this.halfSize - radius - 0.5;
    if (pos.x < -limit || pos.x > limit || pos.z < -limit || pos.z > limit) {
      return true;
    }

    // Obstacle checks
    for (const c of this.colliders) {
      if (c.type === 'box') {
        if (
          pos.x + radius > c.minX &&
          pos.x - radius < c.maxX &&
          pos.z + radius > c.minZ &&
          pos.z - radius < c.maxZ
        ) {
          return true;
        }
      } else if (c.type === 'cylinder') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const distSq = dx * dx + dz * dz;
        const minDist = radius + c.radius;
        if (distSq < minDist * minDist) {
          return true;
        }
      }
    }

    return false;
  }

  resolveCollision(currentPos, nextPos, radius = 0.8) {
    const resolved = nextPos.clone();
    const limit = this.halfSize - radius - 0.5;

    // Arena boundary clamp
    resolved.x = Math.max(-limit, Math.min(limit, resolved.x));
    resolved.z = Math.max(-limit, Math.min(limit, resolved.z));

    // Sliding collision along obstacles
    for (const c of this.colliders) {
      if (c.type === 'box') {
        if (
          resolved.x + radius > c.minX &&
          resolved.x - radius < c.maxX &&
          resolved.z + radius > c.minZ &&
          resolved.z - radius < c.maxZ
        ) {
          // Test single-axis slide
          if (
            currentPos.x + radius <= c.minX ||
            currentPos.x - radius >= c.maxX
          ) {
            resolved.x = currentPos.x;
          }
          if (
            currentPos.z + radius <= c.minZ ||
            currentPos.z - radius >= c.maxZ
          ) {
            resolved.z = currentPos.z;
          }
        }
      } else if (c.type === 'cylinder') {
        const dx = resolved.x - c.x;
        const dz = resolved.z - c.z;
        const dist = Math.hypot(dx, dz);
        const minDist = radius + c.radius;
        if (dist < minDist && dist > 0.0001) {
          // Push out along normal
          const nx = dx / dist;
          const nz = dz / dist;
          resolved.x = c.x + nx * minDist;
          resolved.z = c.z + nz * minDist;
        }
      }
    }

    return resolved;
  }
}

export const arena = new Arena();
