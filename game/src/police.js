// Sunset City — wanted level: heat -> stars, police cars + foot cops,
// chase / ram / arrest, and cooling down when the cops lose you.

import { WANTED, WORLD } from './config.js';
import { clamp, dist, angleTo, angleLerp, rand } from './utils.js';
import { citySolid, randomRoadPoint } from './city.js';
import { createCar, drawCar } from './cars.js';
import { showBanner } from './hud.js';
import { spawnParticles, addShake } from './particles.js';

export function starsFromHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.thresholds.length; i++) {
    if (heat >= WANTED.thresholds[i]) stars = i + 1;
  }
  return stars;
}

export function addHeat(world, n) {
  const before = world.wanted.stars;
  world.wanted.heat = clamp(world.wanted.heat + n, 0, WANTED.maxHeat);
  world.wanted.stars = starsFromHeat(world.wanted.heat);
  world.wanted.hiddenTimer = 0;
  if (world.wanted.stars > before && world.wanted.stars >= 3) {
    showBanner(`${'★'.repeat(world.wanted.stars)} WANTED LEVEL ${world.wanted.stars} ${'★'.repeat(world.wanted.stars)}`, 2200);
  }
}

function desiredPolice(stars) {
  return {
    cars: stars >= 2 ? stars - 1 : 0, // 1★:0, 2★:1, 3★:2, 4★:3, 5★:4
    cops: stars >= 1 ? (stars >= 3 ? 2 : 1) : 0,
  };
}

function spawnPointNearPlayer(world, minD, maxD) {
  for (let tries = 0; tries < 12; tries++) {
    const pt = randomRoadPoint(world.rng);
    const d = dist(pt.x, pt.y, world.player.x, world.player.y);
    if (d >= minD && d <= maxD) return pt;
  }
  const p = world.player;
  return { x: p.x + 550, y: p.y };
}

export function updateWanted(dt, world) {
  const w = world.wanted;
  const want = desiredPolice(w.stars);

  // Spawn missing police (throttled so they arrive in waves, not all at once).
  w.spawnTimer -= dt;
  const policeCars = world.cars.filter((c) => c.kind === 'police');
  if (w.spawnTimer <= 0 && policeCars.length < want.cars) {
    const pt = spawnPointNearPlayer(world, 480, 720);
    const car = createCar(world.rng, pt.x, pt.y, angleTo(pt.x, pt.y, world.player.x, world.player.y), 'police', 'police');
    car.speed = 200;
    world.cars.push(car);
    if (world.audio) world.audio.siren(true);
    w.spawnTimer = 1.6;
  }
  if (w.spawnTimer <= 0 && world.cops.length < want.cops) {
    const pt = spawnPointNearPlayer(world, 420, 650);
    world.cops.push({
      x: pt.x, y: pt.y, angle: 0, hp: 100,
      walkPhase: rand(world.rng, 0, 6),
    });
    w.spawnTimer = 1.6;
  }

  // Too many police (stars dropped): remove the farthest ones.
  if (policeCars.length > want.cars) {
    policeCars.sort((a, b) => dist(b.x, b.y, world.player.x, world.player.y) - dist(a.x, a.y, world.player.x, world.player.y));
    const extra = policeCars.slice(0, policeCars.length - want.cars);
    for (const c of extra) {
      const i = world.cars.indexOf(c);
      if (i >= 0) world.cars.splice(i, 1);
    }
  }
  if (world.cops.length > want.cops) {
    world.cops.sort((a, b) => dist(b.x, b.y, world.player.x, world.player.y) - dist(a.x, a.y, world.player.x, world.player.y));
    world.cops.splice(0, world.cops.length - want.cops);
  }

  // Cool down: no police within the hide radius for long enough.
  let nearest = Infinity;
  for (const c of world.cars) {
    if (c.kind === 'police') nearest = Math.min(nearest, dist(c.x, c.y, world.player.x, world.player.y));
  }
  for (const cop of world.cops) {
    nearest = Math.min(nearest, dist(cop.x, cop.y, world.player.x, world.player.y));
  }
  if (w.stars > 0 && nearest > WANTED.hideRadius) {
    w.hiddenTimer += dt;
    if (w.hiddenTimer > WANTED.hideTime) {
      w.heat = Math.max(0, w.heat - WANTED.decayPerSec * dt);
      const newStars = starsFromHeat(w.heat);
      if (newStars < w.stars) {
        w.stars = newStars;
        w.hiddenTimer = 0;
        if (w.stars === 0 && world.audio) world.audio.siren(false);
      }
    }
  } else {
    w.hiddenTimer = 0;
  }
  if (w.stars === 0 && world.audio) world.audio.siren(false);
}

export function updatePolice(dt, world) {
  const p = world.player;

  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    // Chase the player: steer toward them, accelerate hard.
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    car.angle = angleLerp(car.angle, targetAngle, Math.min(1, dt * 2.2));
    const d = dist(car.x, car.y, p.x, p.y);
    const wantSpeed = p.inCar ? 470 : (d > 130 ? 380 : 0);
    car.speed += clamp(wantSpeed - car.speed, -420 * dt, 340 * dt);

    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!citySolid(world.city, nx, car.y, car.radius * 0.7)) car.x = nx;
    if (!citySolid(world.city, car.x, ny, car.radius * 0.7)) car.y = ny;

    // On foot and cornered by a cruiser: a foot cop steps out to arrest.
    if (!p.inCar && d < 110 && world.cops.length < 2 && car.exitTimer <= 0) {
      car.exitTimer = 6;
      car.speed = 0;
      world.cops.push({ x: car.x + 30, y: car.y + 30, angle: 0, hp: 100, walkPhase: 0 });
    }
    car.exitTimer -= dt;
  }

  for (const cop of world.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < 30) {
      // Busted.
      world.state = 'gameover';
      world.stateData = { reason: 'busted' };
      if (world.audio) world.audio.siren(false);
      return;
    }
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = a;
    const nx = cop.x + Math.cos(a) * 152 * dt;
    const ny = cop.y + Math.sin(a) * 152 * dt;
    if (!citySolid(world.city, nx, cop.y, 10)) cop.x = nx;
    if (!citySolid(world.city, cop.x, ny, 10)) cop.y = ny;
    cop.walkPhase += dt * 10;
  }
}

export function drawPolice(ctx, cam, world, time) {
  for (const cop of world.cops) {
    const sx = cop.x - cam.x;
    const sy = cop.y - cam.y;
    const bob = Math.sin(cop.walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Navy uniform + cap.
    ctx.fillStyle = '#4361ee';
    ctx.beginPath();
    ctx.arc(sx, sy + bob * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(sx, sy - 2 + bob * 0.3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2a6b';
    ctx.fillRect(sx - 6, sy - 9 + bob * 0.3, 12, 4);
    // Baton.
    ctx.strokeStyle = '#22222e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx + 7, sy + 2);
    ctx.lineTo(sx + 13, sy + 8);
    ctx.stroke();
  }
  // Police cruisers are drawn with the other cars; their light bars flash
  // in cars.js drawCar.
}
