// Sunset City — combat: pistol bullets, melee swings, pickups.

import { TUNING, WANTED } from './config.js';
import { dist, angleTo, angleDiff } from './utils.js';
import { collidesBuilding } from './city.js';
import { addHeat } from './police.js';
import { fleeFrom } from './pedestrians.js';
import { spawnParticles } from './particles.js';
import { hurtPlayer } from './player.js';

export function shoot(world, x, y, angle, from) {
  world.bullets.push({
    x: x + Math.cos(angle) * 18,
    y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * TUNING.bulletSpeed,
    vy: Math.sin(angle) * TUNING.bulletSpeed,
    life: 0.9,
    from,
  });
  spawnParticles(world, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20,
    { count: 4, color: '#ffd166', speed: 160, life: 0.15, size: 2 });
  if (world.audio) world.audio.gunshot();
  if (from === 'player') {
    world.stats.shotsFired++;
    // A shot nearby makes pedestrians flee and witnesses call the cops.
    fleeFrom(world, x, y, 320);
    let witness = false;
    for (const ped of world.peds) {
      if (dist(ped.x, ped.y, x, y) < 300) { witness = true; break; }
    }
    for (const cop of world.cops) {
      if (dist(cop.x, cop.y, x, y) < 300) { witness = true; break; }
    }
    if (witness) addHeat(world, WANTED.heatShotWitness);
  }
}

export function meleeSwing(world, x, y, angle) {
  spawnParticles(world, x + Math.cos(angle) * 30, y + Math.sin(angle) * 30,
    { count: 6, color: '#ffffff', speed: 200, life: 0.2, size: 2 });
  const range = TUNING.meleeRange;
  const hit = (tx, ty) => {
    if (dist(x, y, tx, ty) > range) return false;
    return Math.abs(angleDiff(angle, angleTo(x, y, tx, ty))) < 1.1;
  };
  for (const rival of world.rivals) {
    if (hit(rival.x, rival.y)) {
      rival.hp -= TUNING.meleeDamage;
      const a = angleTo(x, y, rival.x, rival.y);
      rival.x += Math.cos(a) * 26;
      rival.y += Math.sin(a) * 26;
      spawnParticles(world, rival.x, rival.y, { count: 8, color: '#e63946', speed: 130, life: 0.4, size: 3 });
    }
  }
  for (const cop of world.cops) {
    if (hit(cop.x, cop.y)) {
      cop.hp -= 40;
      addHeat(world, WANTED.heatCopHurt);
      const a = angleTo(x, y, cop.x, cop.y);
      cop.x += Math.cos(a) * 26;
      cop.y += Math.sin(a) * 26;
    }
  }
  for (const ped of world.peds) {
    if (ped.state !== 'down' && hit(ped.x, ped.y)) {
      ped.state = 'down';
      ped.downTimer = 2.5;
      addHeat(world, WANTED.heatHitPed);
    }
  }
  if (world.audio) world.audio.swoosh();
}

export function updateBullets(dt, world) {
  const p = world.player;
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && collidesBuilding(world.city, b.x, b.y, 2)) {
      spawnParticles(world, b.x, b.y, { count: 4, color: '#ffd166', speed: 100, life: 0.25, size: 2 });
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (let r = world.rivals.length - 1; r >= 0; r--) {
        const rival = world.rivals[r];
        if (dist(b.x, b.y, rival.x, rival.y) < 15) {
          rival.hp -= TUNING.pistolDamage;
          spawnParticles(world, b.x, b.y, { count: 8, color: '#e63946', speed: 140, life: 0.4, size: 3 });
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (let c = world.cops.length - 1; c >= 0; c--) {
          const cop = world.cops[c];
          if (dist(b.x, b.y, cop.x, cop.y) < 15) {
            cop.hp -= 50;
            addHeat(world, WANTED.heatCopHurt);
            spawnParticles(world, b.x, b.y, { count: 8, color: '#4361ee', speed: 140, life: 0.4, size: 3 });
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of world.peds) {
          if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 13) {
            ped.state = 'down';
            ped.downTimer = 2.5;
            addHeat(world, WANTED.heatHitPed);
            spawnParticles(world, b.x, b.y, { count: 6, color: '#ffd166', speed: 120, life: 0.4, size: 3 });
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'rival') {
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 14) {
        hurtPlayer(world, 8);
        dead = true;
      } else if (p.inCar && dist(b.x, b.y, p.x, p.y) < 22) {
        hurtPlayer(world, 4);
        dead = true;
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }
  // Clean up dead rivals and cops.
  for (let r = world.rivals.length - 1; r >= 0; r--) {
    if (world.rivals[r].hp <= 0) {
      spawnParticles(world, world.rivals[r].x, world.rivals[r].y,
        { count: 14, color: '#e63946', speed: 170, life: 0.6, size: 4 });
      spawnPickup(world, world.rivals[r].x, world.rivals[r].y, 'cash', 75);
      world.rivals.splice(r, 1);
    }
  }
  for (let c = world.cops.length - 1; c >= 0; c--) {
    if (world.cops[c].hp <= 0) {
      spawnParticles(world, world.cops[c].x, world.cops[c].y,
        { count: 12, color: '#4361ee', speed: 150, life: 0.5, size: 4 });
      world.cops.splice(c, 1);
    }
  }
}

export function spawnPickup(world, x, y, kind, amount = 0) {
  world.pickups.push({ x, y, kind, amount, bob: Math.random() * 6 });
}

export function updatePickups(dt, world) {
  const p = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.bob += dt * 3;
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < TUNING.pickupMagnet && d > 1) {
      // Magnet: drift toward the player.
      pk.x += ((p.x - pk.x) / d) * 260 * dt;
      pk.y += ((p.y - pk.y) / d) * 260 * dt;
    }
    if (d < TUNING.pickupCollect) {
      if (pk.kind === 'health') {
        p.hp = Math.min(TUNING.playerMaxHp, p.hp + 40);
      } else if (pk.kind === 'ammo') {
        p.ammo = p.maxAmmo;
        p.reloadTimer = 0;
      } else if (pk.kind === 'cash') {
        world.cash += pk.amount;
      }
      spawnParticles(world, pk.x, pk.y, { count: 10, color: '#ffd166', speed: 120, life: 0.5, size: 3 });
      if (world.audio) world.audio.pickup();
      world.pickups.splice(i, 1);
    }
  }
}

export function drawPickups(ctx, cam, world) {
  for (const pk of world.pickups) {
    const sx = pk.x - cam.x;
    const sy = pk.y - cam.y + Math.sin(pk.bob) * 2;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 8, sy - 8, 16, 16);
      ctx.fillStyle = '#43aa5b';
      ctx.fillRect(sx - 2, sy - 6, 4, 12);
      ctx.fillRect(sx - 6, sy - 2, 12, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(sx - 7, sy - 5, 14, 10);
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(sx - 4, sy - 5, 2, 10);
      ctx.fillRect(sx + 1, sy - 5, 2, 10);
    } else {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d1f';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', sx, sy + 4);
    }
  }
}

export function drawBullets(ctx, cam, world) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const b of world.bullets) {
    const sx = b.x - cam.x;
    const sy = b.y - cam.y;
    const len = 10;
    const ux = b.vx / TUNING.bulletSpeed;
    const uy = b.vy / TUNING.bulletSpeed;
    ctx.moveTo(sx - ux * len, sy - uy * len);
    ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}
