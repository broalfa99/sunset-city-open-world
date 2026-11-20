// Sunset City — HUD (canvas bars, stars, clock, objective, minimap) and
// DOM banners + dialogue boxes.

import { WORLD, COLORS, TUNING } from './config.js';
import { clamp, dist } from './utils.js';
import { missionObjectiveText } from './missions.js';

let bannerEl = null;
let dialogueEl = null;
let dialogueNameEl = null;
let dialogueTextEl = null;
let bannerUntil = 0;
let dialogueUntil = 0;
const dialogueQueue = [];

function els() {
  if (!bannerEl) {
    bannerEl = document.getElementById('banner');
    dialogueEl = document.getElementById('dialogue');
    dialogueNameEl = document.getElementById('dialogue-name');
    dialogueTextEl = document.getElementById('dialogue-text');
  }
}

export function showBanner(text, ms = 2600) {
  els();
  if (!bannerEl) return;
  bannerEl.textContent = text;
  bannerEl.style.opacity = '1';
  bannerUntil = performance.now() + ms;
}

export function showDialogue(name, text, ms = 4200) {
  els();
  if (!dialogueEl) return;
  dialogueNameEl.textContent = name;
  dialogueTextEl.textContent = text;
  dialogueEl.style.opacity = '1';
  dialogueUntil = performance.now() + ms;
}

export function queueDialogue(name, text, ms = 4200) {
  dialogueQueue.push({ name, text, ms });
}

// Called every frame: hides expired banner/dialogue, advances the queue.
export function updateHudDom() {
  els();
  const now = performance.now();
  if (bannerEl && bannerUntil && now > bannerUntil) {
    bannerEl.style.opacity = '0';
    bannerUntil = 0;
  }
  if (dialogueEl && dialogueUntil && now > dialogueUntil) {
    dialogueEl.style.opacity = '0';
    dialogueUntil = 0;
    if (dialogueQueue.length > 0) {
      const next = dialogueQueue.shift();
      showDialogue(next.name, next.text, next.ms);
    }
  }
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(ctx, world, vw, vh) {
  const p = world.player;

  // Damage vignette.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(230,57,70,${(p.hurtFlash / 0.35) * 0.28})`;
    ctx.fillRect(0, 0, vw, vh);
  }

  // Top-left: health bar + cash.
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('RIO', 16, 26);
  ctx.fillStyle = '#22222e';
  ctx.fillRect(16, 32, 200, 16);
  ctx.fillStyle = p.hp > 30 ? COLORS.health : COLORS.healthLow;
  ctx.fillRect(18, 34, 196 * clamp(p.hp / TUNING.playerMaxHp, 0, 1), 12);
  ctx.fillStyle = '#ffe9c9';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 222, 45);
  ctx.fillStyle = COLORS.cash;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`$${world.cash}`, 16, 70);
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Ammo ${p.ammo}/${p.maxAmmo}${p.inCar ? '  •  ' + (p.inCar.type || '') : ''}`, 16, 90);
  if (p.inCar) {
    ctx.fillStyle = '#ffe9c9';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const label = p.inCar.type ? p.inCar.type.toUpperCase() : 'CAR';
    ctx.fillText(`Driving: ${label}  (E to exit)`, 16, 110);
  }

  // Top-right: wanted stars + clock.
  const stars = world.wanted.stars;
  for (let i = 0; i < 5; i++) {
    const x = vw - 30 - i * 30;
    const y = 30;
    starPath(ctx, x, y, 12);
    ctx.fillStyle = i < stars ? COLORS.star : COLORS.starEmpty;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (stars >= 3) {
    ctx.fillStyle = Math.sin(world.time * 8) > 0 ? '#ff5a5a' : '#ffe9c9';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WANTED', vw - 16, 62);
  }
  ctx.fillStyle = '#ffe9c9';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(world.clock), vw - 16, 84);
  ctx.textAlign = 'left';

  // Centre-top: current objective.
  const obj = missionObjectiveText(world);
  if (obj) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(obj).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect((vw - w) / 2, 12, w, 26);
    ctx.fillStyle = '#ffe9c9';
    ctx.textAlign = 'center';
    ctx.fillText(obj, vw / 2, 30);
    ctx.textAlign = 'left';
  }

  // Bottom-left: controls hint.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(12, vh - 30, 470, 20);
  ctx.fillStyle = '#d8d8e8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move/drive  •  Mouse aim  •  Click/Space shoot  •  F melee  •  E enter car / interact  •  R reload  •  P pause  •  M mute', 18, vh - 16);

  // Vault hold progress (mission 6).
  const m = world.mission;
  if (m.active && m.index === 5 && m.data.atVault && !m.data.vaultDone) {
    const frac = clamp(m.holdTimer / 5, 0, 1);
    ctx.fillStyle = '#22222e';
    ctx.fillRect(vw / 2 - 110, vh / 2 + 60, 220, 16);
    ctx.fillStyle = COLORS.star;
    ctx.fillRect(vw / 2 - 108, vh / 2 + 62, 216 * frac, 12);
    ctx.fillStyle = '#ffe9c9';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRACKING THE VAULT…', vw / 2, vh / 2 + 50);
    ctx.textAlign = 'left';
  }
}

export function drawMinimap(ctx, world, x, y, size) {
  const scale = size / WORLD.SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,18,0.85)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#ffe9c9';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

  // Roads.
  ctx.strokeStyle = '#5a5470';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const g of WORLD.GRID) {
    ctx.moveTo(x + g * scale, y);
    ctx.lineTo(x + g * scale, y + size);
    ctx.moveTo(x, y + g * scale);
    ctx.lineTo(x + size, y + g * scale);
  }
  ctx.stroke();

  // Water + beach at the south edge.
  ctx.fillStyle = '#1f8a8a';
  ctx.fillRect(x, y + WORLD.WATER_Y * scale, size, size - WORLD.WATER_Y * scale);
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(x, y + WORLD.BEACH_Y * scale, size, (WORLD.WATER_Y - WORLD.BEACH_Y) * scale);

  // Parks.
  ctx.fillStyle = '#2f6b4f';
  for (const pk of world.city.parks) {
    ctx.fillRect(x + pk.x * scale, y + pk.y * scale, pk.w * scale, pk.h * scale);
  }

  // Landmarks.
  ctx.fillStyle = '#ffd166';
  for (const key of Object.keys(world.city.landmarks)) {
    const lm = world.city.landmarks[key];
    ctx.fillRect(x + lm.x * scale - 2, y + lm.y * scale - 2, 4, 4);
  }

  // Mission marker (pulsing).
  const m = world.mission;
  if (m.marker) {
    const pulse = 4 + Math.sin(world.time * 5) * 2;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + m.marker.x * scale, y + m.marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cars (grey), police (flashing red/blue), rivals (red).
  ctx.fillStyle = '#9a9aa8';
  for (const car of world.cars) {
    if (car.kind === 'police') continue;
    ctx.fillRect(x + car.x * scale - 1, y + car.y * scale - 1, 2, 2);
  }
  const flash = Math.sin(world.time * 10) > 0;
  ctx.fillStyle = flash ? '#ff2e2e' : '#1e3aff';
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4361ee';
  for (const cop of world.cops) {
    ctx.fillRect(x + cop.x * scale - 1, y + cop.y * scale - 1, 2, 2);
  }
  ctx.fillStyle = '#e63946';
  for (const rival of world.rivals) {
    ctx.beginPath();
    ctx.arc(x + rival.x * scale, y + rival.y * scale, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player (green dot + white ring).
  ctx.fillStyle = '#2ec4b6';
  ctx.beginPath();
  ctx.arc(x + world.player.x * scale, y + world.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + world.player.x * scale, y + world.player.y * scale, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Camera viewport outline.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x + (world.camera.x - 640) * scale,
    y + (world.camera.y - 360) * scale,
    1280 * scale,
    720 * scale
  );
  ctx.restore();
}
