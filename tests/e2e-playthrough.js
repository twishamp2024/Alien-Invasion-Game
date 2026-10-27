// ──────────────────────────────────────────────
//  e2e-playthrough.js — Automated Browser Playthrough
// ──────────────────────────────────────────────

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = './tests/screenshots';

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function runPlaythrough() {
  console.log('--- STARTING E2E GAMEPLAY PLAYTHROUGH ---');

  // 1. Start Vite Preview server on port 4173
  console.log('1. Starting Vite preview server...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => console.log(`[Vite] ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.error(`[Vite ERR] ${d.toString().trim()}`));

  // Wait 1.5s for server startup
  await new Promise((r) => setTimeout(r, 1500));

  let browser;
  const consoleMessages = [];
  const errors = [];

  try {
    console.log('2. Launching Chrome with WebGL support...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-gl=angle',
        '--enable-webgl',
        '--window-size=1280,720',
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    const page = await browser.newPage();

    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.warn(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    page.on('console', (msg) => {
      const txt = msg.text();
      consoleMessages.push(txt);
      if (msg.type() === 'error') {
        if (!txt.includes('favicon.ico')) {
          errors.push(txt);
          console.error(`[Browser Console Error] ${txt}`);
        }
      }
    });

    page.on('pageerror', (err) => {
      errors.push(err.message);
      console.error(`[Browser Page Error] ${err.message}`);
    });

    console.log('3. Navigating to http://localhost:4173...');
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });

    // Wait for loading screen to finish and title screen to display
    console.log('4. Waiting for Title Screen...');
    await page.waitForSelector('#titleScreen:not(.hidden)', { timeout: 8000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_title_screen.png` });
    console.log('✓ Captured 01_title_screen.png');

    // 5. Click "CONTROLS" to test controls panel
    console.log('5. Testing Controls Screen...');
    await page.click('#btnControls');
    await page.waitForSelector('#controlsScreen:not(.hidden)');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02_controls_screen.png` });
    console.log('✓ Captured 02_controls_screen.png');

    await page.click('#btnControlsBack');
    await page.waitForSelector('#titleScreen:not(.hidden)');
    await new Promise((r) => setTimeout(r, 400));

    // 6. Click "SETTINGS" to test settings panel
    console.log('6. Testing Settings Screen...');
    await page.click('#btnSettings');
    await page.waitForSelector('#settingsScreen:not(.hidden)');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03_settings_screen.png` });
    console.log('✓ Captured 03_settings_screen.png');

    await page.click('#btnSettingsBack');
    await page.waitForSelector('#titleScreen:not(.hidden)');

    // 7. Click "START GAME"
    console.log('7. Starting New Game...');
    await page.click('#btnStartGame');
    await page.waitForSelector('#hud:not(.hidden)', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04_gameplay_start.png` });
    console.log('✓ Captured 04_gameplay_start.png');

    // 8. Simulate player movement & firing
    console.log('8. Simulating Movement (WASD), Aim, and Firing...');
    await page.keyboard.down('KeyW');
    await new Promise((r) => setTimeout(r, 600));
    await page.keyboard.up('KeyW');

    await page.keyboard.down('KeyD');
    await page.mouse.move(700, 320);
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.up('KeyD');

    // Fire weapon bursts
    for (let i = 0; i < 6; i++) {
      await page.mouse.down({ button: 'left' });
      await new Promise((r) => setTimeout(r, 120));
      await page.mouse.up({ button: 'left' });
      await new Promise((r) => setTimeout(r, 80));
    }

    // Capture active combat action screenshot
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05_active_combat.png` });
    console.log('✓ Captured 05_active_combat.png');

    // 9. Test Dodge Dash
    console.log('9. Testing Jet Thruster Dash (Space)...');
    await page.keyboard.press('Space');
    await new Promise((r) => setTimeout(r, 200));

    // 10. Switch Weapons (Key 2: Scatter Blaster, Key 3: Rocket)
    console.log('10. Testing Weapon Switching...');
    await page.keyboard.press('Digit2');
    await page.mouse.down({ button: 'left' });
    await new Promise((r) => setTimeout(r, 150));
    await page.mouse.up({ button: 'left' });

    await page.keyboard.press('Digit3');
    await page.mouse.down({ button: 'left' });
    await new Promise((r) => setTimeout(r, 150));
    await page.mouse.up({ button: 'left' });

    // 11. Test Pause Menu (Escape)
    console.log('11. Testing Pause Menu...');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#pauseMenu:not(.hidden)', { timeout: 3000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06_pause_menu.png` });
    console.log('✓ Captured 06_pause_menu.png');

    // Resume
    await page.click('#btnResume');
    await page.waitForSelector('#pauseMenu.hidden');
    console.log('✓ Resumed from pause');

    // Let combat run for 4 seconds to observe alien AI pursuit
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07_wave_incursion.png` });
    console.log('✓ Captured 07_wave_incursion.png');

    console.log('--- PLAYTHROUGH SUMMARY ---');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Total errors: ${errors.length}`);

    if (errors.length > 0) {
      console.error('Errors encountered:');
      errors.forEach((e) => console.error(` - ${e}`));
      process.exitCode = 1;
    } else {
      console.log('🎉 ALL PLAYTHROUGH CHECKS PASSED WITH ZERO ERRORS!');
    }
  } catch (err) {
    console.error('Playthrough failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

runPlaythrough();
