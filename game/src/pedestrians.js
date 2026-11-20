// Sunset City — pedestrians: wander the sidewalks, flee from danger,
// get knocked down by cars (no gore — a star puff and they run off).

import { TUNING } from './config.js';
import { rand, pick, dist, angleTo, clamp } from './utils.js';
import { citySolid, randomSidewalkPoint } from './city.js';

const SHIRTS = ['#e8e8e8', '#c96a2e', '#3e6b8f', '#8f3e6b', '#4f8f5a', '#c9a44f', '#7a5a9e'];

export function createPed(rng, x, y) {
  return {
    x, y,
    angle: rand(rng, 0, Math.PI * 2),
    speed: 0,
    shirt: pick(rng, SHIRTS),
    state: 'walk', // 'walk' | 'flee' | 'down'
    target: { x, y },
    downTimer: 0,
    threatX: 0,
    threatY: 0,
    walkPhase: rand(rng, 0, 6),
  };
}

export function spawnPedestrians(world, count = 24) {
  for (let i = 0; i < count; i++) {
    const pt = randomSidewalkPoint(world.rng);
    const ped = createPed(world.rng, pt.x, pt.y);
    ped.target = randomSidewalkPoint(world.rng);
    world.peds.push(ped);
  }
}

// Make every pedestrian within radius flee from (x, y).
export function fleeFrom(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.threatX = x;
      ped.threatY = y;
    }
  }
}

export function updatePedestrians(dt, world) {
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.threatX = world.player.x;
        ped.threatY = world.player.y;
      }
      continue;
    }

    let tx;
    let ty;
    let speed;
    if (ped.state === 'flee') {
      // Run directly away from the threat.
      const a = angleTo(ped.threatX, ped.threatY, ped.x, ped.y);
      tx = ped.x + Math.cos(a) * 100;
      ty = ped.y + Math.sin(a) * 100;
      speed = TUNING.pedFleeSpeed;
      if (dist(ped.x, ped.y, ped.threatX, ped.threatY) > 420) {
        ped.state = 'walk';
        ped.target = randomSidewalkPoint(world.rng);
      }
    } else {
      tx = ped.target.x;
      ty = ped.target.y;
      speed = TUNING.pedSpeed;
      if (dist(ped.x, ped.y, tx, ty) < 24) {
        ped.target = randomSidewalkPoint(world.rng);
        continue;
      }
    }

    const a = angleTo(ped.x, ped.y, tx, ty);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * speed * dt;
    const ny = ped.y + Math.sin(a) * speed * dt;
    if (!citySolid(world.city, nx, ped.y, 10)) ped.x = nx;
    if (!citySolid(world.city, ped.x, ny, 10)) ped.y = ny;
    ped.walkPhase += dt * 8;
  }
}

export function drawPedestrians(ctx, cam, world) {
  for (const ped of world.peds) {
    const sx = ped.x - cam.x;
    const sy = ped.y - cam.y;
    if (ped.state === 'down') {
      // Lying down: a flat ellipse, then they get up and flee.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 11, 5, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('*', sx - 8, sy - 8);
      ctx.fillText('*', sx + 8, sy - 10);
      continue;
    }
    const bob = Math.sin(ped.walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(sx, sy + bob * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(sx, sy - 2 + bob * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', sx, sy - 16);
    }
  }
}
