// Sunset City — main loop, state machine, camera, orchestration.
// States: title | playing | paused | gameover | ending.

import { WORLD, TUNING, LANDMARKS } from './config.js';
import { mulberry32, clamp, lerp, dist, rand } from './utils.js';
import { generateCity, randomRoadPoint, drawCity } from './city.js';
import { createInput, isDown, wasPressed, endFrame } from './input.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { spawnTraffic, spawnParkedCars, updateTraffic, updatePlayerCar, drawCar, exitCar } from './cars.js';
import { spawnPedestrians, updatePedestrians, drawPedestrians } from './pedestrians.js';
import { updateWanted, updatePolice, drawPolice } from './police.js';
import { updateBullets, updatePickups, drawPickups, drawBullets, spawnPickup } from './combat.js';
import { startMission, updateMission, updateRivals, drawRivals, MISSIONS } from './missions.js';
import { drawHUD, drawMinimap, updateHudDom, showBanner, showDialogue } from './hud.js';
import { createAudio } from './audio.js';
import { updateParticles, drawParticles, drawSkids } from './particles.js';
import { applyShot } from './shots.js';
import { saveGame, loadGame, hasSave } from './save.js';

const VW = 1280;
const VH = 720;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function createWorld(seed) {
  const rng = mulberry32(seed);
  const city = generateCity(rng);
  const world = {
    seed, rng, city,
    time: 0,
    clock: 17.5,
    state: 'title',
    stateData: {},
    camera: { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, shakeMag: 0 },
    player: createPlayer(LANDMARKS.garage.x, LANDMARKS.garage.y + 90),
    cars: [],
    peds: [],
    cops: [],
    rivals: [],
    bullets: [],
    pickups: [],
    particles: [],
    skids: [],
    wanted: { heat: 0, stars: 0, hiddenTimer: 0, spawnTimer: 0 },
    mission: {
      index: 0, active: false, phase: 'idle',
      objective: '', marker: null, timer: 0, data: {}, holdTimer: 0,
    },
    cash: 0,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0 },
    input: null,
    audio: null,
    pickupTimer: 12,
  };
  spawnTraffic(world, 16);
  spawnParkedCars(world, 14);
  spawnPedestrians(world, 24);
  spawnPickup(world, LANDMARKS.garage.x + 120, LANDMARKS.garage.y, 'health');
  spawnPickup(world, LANDMARKS.garage.x - 100, LANDMARKS.garage.y + 60, 'ammo');
  spawnPickup(world, LANDMARKS.garage.x + 40, LANDMARKS.garage.y - 120, 'cash', 50);
  return world;
}

// ---- setup ----
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '20261120', 10);
const world = createWorld(shot ? 7 : seed);
world.input = createInput(canvas);
world.audio = createAudio();
if (shot) applyShot(shot, world);

const input = world.input;
const audio = world.audio;

// Debug/testing handle (harmless in play): lets a test driver read the
// live world state without touching the game itself.
window.__sunset = world;

function resize() {
  const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  canvas.style.width = `${Math.floor(VW * scale)}px`;
  canvas.style.height = `${Math.floor(VH * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', () => audio.unlock(), { once: false });
window.addEventListener('mousedown', () => audio.unlock(), { once: false });

// ---- DOM screens ----
const screens = {
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  gameover: document.getElementById('gameover-screen'),
  ending: document.getElementById('ending-screen'),
};
let lastShown = null;
function syncScreens() {
  const want = world.state === 'playing' ? null
    : world.state === 'paused' ? 'pause'
    : world.state === 'gameover' ? 'gameover'
    : world.state === 'ending' ? 'ending'
    : 'title';
  if (want === lastShown) return;
  lastShown = want;
  for (const key of Object.keys(screens)) {
    screens[key].style.display = key === want ? 'flex' : 'none';
  }
  if (want === 'gameover') {
    const title = document.getElementById('gameover-title');
    const text = document.getElementById('gameover-text');
    if (world.stateData.reason === 'busted') {
      title.textContent = 'BUSTED';
      text.textContent = 'The Sunset City police caught you. The crew will bail you out — try the job again.';
    } else {
      title.textContent = 'WASTED';
      text.textContent = 'Rio went down. The crew patches you up — try the job again.';
    }
  }
  if (want === 'ending') {
    document.getElementById('ending-text').textContent =
      `The vault is cracked, the yacht is waiting, and Sunset City is yours. Final take: $${world.cash}.`;
  }
  if (want === 'title') {
    document.getElementById('continue-btn').style.display = hasSave() ? 'inline-block' : 'none';
  }
}

function blurButton(e) {
  if (e && e.currentTarget) e.currentTarget.blur();
}

document.getElementById('play-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.unlock();
  audio.click();
  world.state = 'playing';
  showBanner('Welcome to Sunset City — press ENTER to start your first job', 3200);
});
document.getElementById('continue-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.unlock();
  const save = loadGame();
  if (save) {
    world.cash = save.cash;
    world.player.hp = save.hp;
    world.player.ammo = save.ammo;
    world.player.x = save.x;
    world.player.y = save.y;
    world.clock = save.clock;
    world.mission.index = Math.min(save.missionIndex, MISSIONS.length - 1);
    world.mission.phase = 'between';
    world.camera.x = save.x;
    world.camera.y = save.y;
    world.state = 'playing';
    showBanner('Welcome back, Rio. Press ENTER for the next job.', 3000);
  }
});
document.getElementById('resume-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.click();
  world.state = 'playing';
});
document.getElementById('save-btn').addEventListener('click', (e) => {
  blurButton(e);
  if (saveGame(world)) showBanner('Game saved.', 1800);
  audio.click();
});
document.getElementById('restart-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.click();
  resetAfterBusted();
});
document.getElementById('quit-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.click();
  world.state = 'title';
});
document.getElementById('mute-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.setMuted(!audio.muted);
  e.currentTarget.textContent = audio.muted ? 'Unmute (M)' : 'Mute (M)';
});
document.getElementById('retry-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.click();
  resetAfterBusted();
});
document.getElementById('gameover-quit-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.click();
  resetAfterBusted();
  world.state = 'title';
});
document.getElementById('ending-btn').addEventListener('click', (e) => {
  blurButton(e);
  audio.click();
  world.state = 'playing';
  world.mission.phase = 'done';
});

function resetAfterBusted() {
  const p = world.player;
  if (p.inCar) {
    p.inCar.kind = 'parked';
    p.inCar.speed = 0;
    p.inCar = null;
  }
  p.hp = 100;
  p.ammo = p.maxAmmo;
  p.x = LANDMARKS.garage.x;
  p.y = LANDMARKS.garage.y + 90;
  world.cops.length = 0;
  world.rivals.length = 0;
  world.bullets.length = 0;
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.wanted.hiddenTimer = 0;
  world.camera.x = p.x;
  world.camera.y = p.y;
  audio.siren(false);
  audio.setEngine(false, 0);
  if (world.mission.index < MISSIONS.length) {
    startMission(world, world.mission.index);
  } else {
    world.mission.phase = 'done';
  }
  world.state = 'playing';
}

// ---- update ----
function update(dt) {
  world.time += dt;
  if (world.state === 'playing') {
    world.clock = Math.min(20.5, world.clock + dt * TUNING.clockRate);
  }

  // Mouse position in world coordinates (for aiming).
  const rect = canvas.getBoundingClientRect();
  const scaleX = VW / rect.width;
  const scaleY = VH / rect.height;
  input.mouse.worldX = world.camera.x + (input.mouse.x * scaleX - VW / 2);
  input.mouse.worldY = world.camera.y + (input.mouse.y * scaleY - VH / 2);

  if (world.state === 'title') {
    // Slow cinematic pan around the city centre.
    world.camera.x = 1600 + Math.cos(world.time * 0.05) * 320;
    world.camera.y = 1500 + Math.sin(world.time * 0.05) * 260;
    // ENTER starts the game from the title screen too.
    if (wasPressed(input, 'Enter')) {
      audio.unlock();
      audio.click();
      world.state = 'playing';
      showBanner('Welcome to Sunset City — press ENTER to start your first job', 3200);
    }
    return;
  }
  if (world.state !== 'playing') return;

  // Start the next job with ENTER (free roam between jobs).
  if (wasPressed(input, 'Enter') && !world.mission.active &&
      (world.mission.phase === 'idle' || world.mission.phase === 'between') &&
      world.mission.index < MISSIONS.length) {
    startMission(world, world.mission.index);
  }
  if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) {
    world.state = 'paused';
    return;
  }
  if (wasPressed(input, 'KeyM')) {
    audio.setMuted(!audio.muted);
  }

  updatePlayer(dt, input, world);
  if (world.player.inCar) updatePlayerCar(dt, input, world);
  updateTraffic(dt, world);
  updatePedestrians(dt, world);
  updateWanted(dt, world);
  updatePolice(dt, world);
  updateRivals(dt, world);
  updateMission(dt, world);
  updateBullets(dt, world);
  updatePickups(dt, world);
  updateParticles(dt, world);
  audio.update(dt);

  // Keep the city alive: fresh pickups, traffic and pedestrians.
  world.pickupTimer -= dt;
  if (world.pickupTimer <= 0) {
    world.pickupTimer = 14;
    if (world.pickups.length < 8) {
      const pt = randomRoadPoint(world.rng);
      const kinds = ['health', 'ammo', 'cash'];
      const kind = kinds[Math.floor(world.rng() * kinds.length)];
      spawnPickup(world, pt.x, pt.y, kind, kind === 'cash' ? 25 + Math.floor(world.rng() * 75) : 0);
    }
  }
  const trafficCount = world.cars.filter((c) => c.kind === 'traffic').length;
  if (trafficCount < 12) spawnTraffic(world, 2);
  if (world.peds.length < 16) spawnPedestrians(world, 4);

  // Camera follows the player smoothly.
  const p = world.player;
  const k = 1 - Math.exp(-6 * dt);
  world.camera.x = lerp(world.camera.x, p.x, k);
  world.camera.y = lerp(world.camera.y, p.y, k);
  world.camera.x = clamp(world.camera.x, VW / 2, WORLD.SIZE - VW / 2);
  world.camera.y = clamp(world.camera.y, VH / 2, WORLD.SIZE - VH / 2);
  world.camera.shakeMag = Math.max(0, world.camera.shakeMag - dt * 34);
}

// ---- render ----
function render() {
  const cam = world.camera;
  const shX = (Math.random() - 0.5) * cam.shakeMag;
  const shY = (Math.random() - 0.5) * cam.shakeMag;
  // Top-left of the view, passed to every world draw function.
  const view = { x: cam.x - VW / 2 + shX, y: cam.y - VH / 2 + shY };

  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, VW, VH);

  drawCity(ctx, world.city, view, VW, VH, world.time);
  drawSkids(ctx, view, world);
  drawPickups(ctx, view, world);

  // Mission marker: pulsing ring + label.
  const m = world.mission;
  if (m.marker) {
    const mx = m.marker.x - view.x;
    const my = m.marker.y - view.y;
    const pulse = 14 + Math.sin(world.time * 5) * 4;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, my, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(mx, my - pulse - 14);
    ctx.lineTo(mx - 7, my - pulse - 26);
    ctx.lineTo(mx + 7, my - pulse - 26);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText(m.marker.label, mx, my - pulse - 32);
    ctx.textAlign = 'left';
  }

  for (const car of world.cars) drawCar(ctx, view, car, world.time);
  drawPedestrians(ctx, view, world);
  drawRivals(ctx, view, world);
  drawPolice(ctx, view, world, world.time);
  drawPlayer(ctx, view, world);
  drawBullets(ctx, view, world);
  drawParticles(ctx, view, world);

  // Sunset lighting: the sky warms as the in-game clock runs to evening.
  const warm = clamp((world.clock - 17.5) / 2, 0, 1) * 0.2;
  if (warm > 0) {
    ctx.fillStyle = `rgba(255,110,50,${warm})`;
    ctx.fillRect(0, 0, VW, VH);
  }

  if (world.state !== 'title') {
    drawHUD(ctx, world, VW, VH);
    drawMinimap(ctx, world, VW - 186, VH - 186, 170);
  }
  updateHudDom();
  syncScreens();
}

// ---- loop ----
let last = performance.now();
function gameLoop(t) {
  const dt = clamp((t - last) / 1000, 0, 0.05);
  last = t;
  try {
    update(dt);
    render();
  } catch (err) {
    // Never let one frame kill the game: show the error once on screen.
    ctx.fillStyle = '#14101f';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Sunset City hit an error: ' + err.message, 20, 40);
    console.error(err);
  }
  endFrame(input);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
