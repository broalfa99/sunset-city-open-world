// Sunset City — the player on foot: move, aim, shoot, melee, enter/exit cars.

import { TUNING } from './config.js';
import { clamp, dist } from './utils.js';
import { citySolid } from './city.js';
import { axisDown, isDown, wasPressed } from './input.js';
import { shoot, meleeSwing } from './combat.js';
import { tryEnterCar } from './cars.js';
import { handleInteract } from './missions.js';
import { spawnParticles } from './particles.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    hp: TUNING.playerMaxHp,
    ammo: TUNING.pistolMag,
    maxAmmo: TUNING.pistolMag,
    inCar: null,
    meleeCd: 0,
    shootCd: 0,
    reloadTimer: 0,
    walkPhase: 0,
    moving: false,
    radius: TUNING.playerRadius,
    hurtFlash: 0,
  };
}

export function hurtPlayer(world, dmg) {
  const p = world.player;
  if (world.state !== 'playing' || p.hp <= 0) return;
  p.hp -= dmg;
  p.hurtFlash = 0.35;
  spawnParticles(world, p.x, p.y, { count: 8, color: '#e63946', speed: 140, life: 0.5, size: 3 });
  if (p.hp <= 0) {
    p.hp = 0;
    world.state = 'gameover';
    world.stateData = { reason: 'wasted' };
  }
}

export function updatePlayer(dt, input, world) {
  const p = world.player;
  if (p.inCar) return; // driving is handled by cars.js
  p.meleeCd = Math.max(0, p.meleeCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  // Movement (axis-separated so the player slides along buildings).
  const ax = axisDown(input);
  p.moving = ax.x !== 0 || ax.y !== 0;
  if (p.moving) {
    const sp = TUNING.playerWalkSpeed;
    const nx = p.x + ax.x * sp * dt;
    if (!citySolid(world.city, nx, p.y, p.radius)) p.x = nx;
    const ny = p.y + ax.y * sp * dt;
    if (!citySolid(world.city, p.x, ny, p.radius)) p.y = ny;
    p.walkPhase += dt * 11;
  }

  // Aim at the mouse (world coordinates are set by main.js each frame).
  p.angle = Math.atan2(input.mouse.worldY - p.y, input.mouse.worldX - p.x);

  // Reload: R, or automatically when the magazine is empty.
  if (p.ammo === 0 && p.reloadTimer <= 0) p.reloadTimer = 0.8;
  if (wasPressed(input, 'KeyR') && p.ammo < p.maxAmmo && p.reloadTimer <= 0) {
    p.reloadTimer = 0.8;
  }
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) p.ammo = p.maxAmmo;
  }

  // Shoot: left mouse button or Space.
  if ((input.mouse.down || isDown(input, 'Space')) && p.shootCd <= 0 && p.ammo > 0 && p.reloadTimer <= 0) {
    p.shootCd = TUNING.pistolCooldown;
    p.ammo -= 1;
    shoot(world, p.x, p.y, p.angle, 'player');
  }

  // Melee swing: F.
  if (wasPressed(input, 'KeyF') && p.meleeCd <= 0) {
    p.meleeCd = TUNING.meleeCooldown;
    meleeSwing(world, p.x, p.y, p.angle);
  }

  // Interact / enter a car: E.
  if (wasPressed(input, 'KeyE')) {
    const car = tryEnterCar(world);
    if (!car) {
      handleInteract(world);
    } else {
      // Eat the press: without this, updatePlayerCar (same frame) would
      // read the same E edge and exit the car again at once.
      input.justPressed.delete('KeyE');
    }
  }
}

export function drawPlayer(ctx, cam, world) {
  const p = world.player;
  if (p.inCar || world.state === 'title') return;
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 6, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (simple animated stride).
  ctx.fillStyle = '#2b2b3d';
  const l1 = Math.sin(p.walkPhase) * 5;
  ctx.fillRect(sx - 7 + l1 * 0.4, sy - 2, 5, 10);
  ctx.fillRect(sx + 2 - l1 * 0.4, sy - 2, 5, 10);

  // Body + head.
  ctx.fillStyle = '#2ec4b6';
  ctx.beginPath();
  ctx.arc(sx, sy + bob * 0.3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(sx, sy - 2 + bob * 0.3, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b3d';
  ctx.beginPath();
  ctx.arc(sx, sy - 4 + bob * 0.3, 6.5, Math.PI, Math.PI * 2);
  ctx.fill();

  // Pistol pointing at the aim angle.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#22222e';
  ctx.fillRect(6, -2, 14, 4);
  ctx.restore();

  if (p.reloadTimer > 0) {
    ctx.fillStyle = '#ffe9c9';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RELOADING', sx, sy - 22);
  }
}
