# ALIEN INVASION — 3D Sci-Fi Action Shooter

> **Defend Earth. Survive the Swarm.**  
> A high-performance, polished third-person 3D science-fiction action shooter built from scratch with Three.js, Web Audio procedural synthesis, and Vite.

---

## 🎮 Overview & Game Vision

In **ALIEN INVASION**, you are Earth's last line of defense deployed at a forward planetary outpost. Waves of hostile biomechanical alien invaders are breaching the defense perimeter. Your mission: mobilize your cybernetic combat suit, harness an arsenal of futuristic plasma weaponry, dodge acid mortars and brute shockwaves, and conquer all 5 escalation waves to eliminate the colossal **Harvester Overlord**.

### Key Highlights
- **High-Fidelity 3D Visuals**: Physically based rendering (PBR), real-time PCF soft shadows, exponential space fog, dynamic bloom post-processing (`UnrealBloomPass`), and procedural metallic grid environment with pulsing energy pylons and crystalline alien spires.
- **Third-Person Cyber-Commando**: Fully articulated procedural combat chassis with glowing visor, dual backpack jet thrusters, animated running locomotion, and omnidirectional thrust dash with invulnerability frames.
- **Advanced Camera Feel**: Smooth exponential spring tracking, pitch-clamped mouse orbit, dynamic shoulder ADS zooming, wall-clipping prevention, and decaying quadratic trauma screen shake (`game-feel` & `camera-systems` discipline).
- **Procedural Web Audio Engine**: Zero external audio files — 100% synthetically generated soundscape using the Web Audio API with real-time frequency modulation, pink/white noise filters, dynamic multi-layer combat music, weapon audio, and spatial feedback.
- **Tactical Alien Enemy Archetypes**:
  1. **Xeno-Swarm Drone (Scuttler)**: Fast, agile melee stalkers that weave laterally in steering pursuit and leap with claw strikes.
  2. **Acid Spitter (Bombardier)**: Long-range tactical artillery aliens that strafe behind cover and lob radioactive green mortar globes.
  3. **Alien Brute (Juggernaut)**: Massive cyber-mutant tank that enrages below 50% HP to charge at high speed and smash the earth with shockwaves.
  4. **The Harvester Overlord (Boss)**: Floating biomechanical mothership with rotating containment rings, phase-shifting shield mechanics, and devastating homing plasma barrages.
- **Weapons Arsenal & Field Power-ups**:
  - **Pulse Rifle**: Rapid-fire plasma blaster with 30-round magazine and continuous tracers.
  - **Scatter Blaster**: Heavy 7-pellet cone blast for point-blank crowd eradication.
  - **Plasma Rocket**: High-yield explosive missile with area-of-effect radius.
  - **Pickups**: Nanite Health Capsules (+40 HP), Energy Shield Batteries (+60 Shield), Ammo Crates (Full Magazine), and Overdrive Matrix (10s infinite ammo & double fire rate).
- **Comprehensive UI/UX**: Cyberpunk HUD with health/shield gauges, reactive crosshairs, hitmarkers, damage vignette, wave announcement banners, settings panel (sensitivity, master/sfx/music volume, graphics quality, screen shake toggle), pause screen, and end-game score summary.

---

## 🕹️ Controls

| Action | Keyboard / Mouse Binding |
| :--- | :--- |
| **Move** | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> |
| **Aim / Look** | <kbd>Mouse</kbd> (Pointer Locked) |
| **Fire Weapon** | <kbd>Left Click</kbd> |
| **Aim Down Sights (ADS)** | <kbd>Right Click</kbd> (Hold) |
| **Jet Dash / Dodge** | <kbd>Space</kbd> (Invulnerability Frames) |
| **Sprint** | <kbd>Shift</kbd> (Hold) |
| **Reload** | <kbd>R</kbd> |
| **Select Pulse Rifle** | <kbd>1</kbd> |
| **Select Scatter Blaster** | <kbd>2</kbd> |
| **Select Plasma Rocket** | <kbd>3</kbd> |
| **Pause / Resume** | <kbd>Esc</kbd> |

---

## 🚀 Quick Start & Launch Instructions

### Prerequisites
- **Node.js** (v18+ recommended, verified on Node v26)
- **NPM** (v9+)
- A modern desktop browser supporting WebGL (Google Chrome, Brave, Safari, Edge, Firefox)

### 1. Installation
Clone or navigate to the project directory:
```bash
cd "Alien Invasion Game"
npm install
```

### 2. Launch Standalone Desktop Mode (Recommended)
Launch the game directly in an isolated, borderless desktop window:
```bash
./launch.sh
# or
npm run desktop
```

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production & Preview
```bash
npm run build
npm run preview
```

---

## 🧪 Automated Testing & Verification

The project includes both a Node unit/integration test suite and an automated end-to-end browser playthrough test using headless Chrome:

### Run Unit & Integration Tests (20 Tests)
```bash
npm test
```
Verifies:
- Reactive game state management, score caching, and persistence.
- Settings bounds validation and volume clamping.
- Arena boundary limits and obstacle collision resolution.
- Weapon fire rates, ammo consumption, reloading, and Overdrive.
- Player health, shield absorption, regeneration delays, and fatal damage handling.
- Enemy combat damage, health reduction, and kill score rewards.
- Wave configs, spawning queues, and boss wave transitions.

### Run End-to-End Headless Browser Playthrough
```bash
npm run test:e2e
```
Launches Google Chrome with WebGL enabled, navigates the application, verifies Title/Controls/Settings panels, triggers game start, tests movement, aims and fires weapons, verifies pause/resume, and captures 7 gameplay verification screenshots into `tests/screenshots/`.

---

## 📁 Architecture & File Layout

```
├── index.html               # Main entry HTML & UI screen overlays
├── style.css                # Sci-fi UI stylesheet & HUD layout
├── package.json             # Project dependencies and script runner
├── launch.sh                # Standalone desktop game launcher
├── src/
│   ├── main.js              # Application lifecycle, renderer, post-processing & game loop
│   ├── gameState.js         # Reactive game state manager & high score persistence
│   ├── settings.js          # User settings (mouse sensitivity, volume, graphics quality)
│   ├── input.js             # Mouse & keyboard input manager with pointer lock
│   ├── ui.js                # HUD, menus, damage vignette & hitmarker manager
│   ├── camera.js            # Third-person smooth spring camera with trauma shake
│   ├── player.js            # Player controller, 3D character mesh, dash & health/shield
│   ├── weapons.js           # Weapon arsenal (Pulse Rifle, Scatter Blaster, Plasma Rocket)
│   ├── projectiles.js       # Continuous collision detection projectile simulation
│   ├── enemies.js           # 4 alien archetypes (Swarm Drone, Acid Spitter, Brute, Boss)
│   ├── arena.js             # 3D outpost environment, metallic floor, barriers & pylons
│   ├── particles.js         # Particle engine (muzzle flashes, blood, sparks, explosions)
│   ├── pickups.js           # 3D floating supply crates (Health, Shield, Ammo, Overdrive)
│   ├── waves.js             # Wave director, spawn queueing & victory condition
│   └── audio.js             # Web Audio API procedural sound synthesizer & adaptive music
└── tests/
    ├── gameState.test.js    # State management unit tests
    ├── settings.test.js     # Settings unit tests
    ├── arena.test.js        # Boundary & collision unit tests
    ├── weapons.test.js      # Weapons & ammo unit tests
    ├── player.test.js       # Player mechanics unit tests
    ├── combat.test.js       # Combat & enemy health unit tests
    ├── waves.test.js        # Wave director unit tests
    ├── e2e-playthrough.js   # Automated Chrome playthrough with screenshot capture
    └── screenshots/         # Captured verification screenshots
```

---

## 🎨 Asset Licensing & Attribution

- **3D Meshes & Geometry**: 100% original procedural geometry generated via Three.js primitives and custom mathematical surfaces (no third-party 3D models required).
- **Textures & Materials**: Procedurally generated canvas textures (metallic sci-fi grid, glowing circuit paths, warning stripes).
- **Audio & Music**: 100% original procedural sound effects and multi-track adaptive music generated in real-time via the Web Audio API.
- **Fonts**: System monospace font stack (`Courier New`, `Consolas`, `Liberation Mono`).
- **Dependencies**: Open-source libraries under MIT/ISC licenses:
  - `three` (MIT)
  - `vite` (MIT)
  - `puppeteer-core` (Apache-2.0, dev-dependency only)

---

## 🛡️ License

ISC License. Built with pride for the ALIEN INVASION Master Mission.
