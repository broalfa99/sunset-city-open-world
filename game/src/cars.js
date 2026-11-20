// Sunset City — vehicles: 7 original types (sedan, van, pickup, bus, truck,
// fire truck, police cruiser), traffic AI, parked cars, player driving,
// stealing, and per-type top-down drawing.

import { VEHICLES, WANTED, WORLD, TUNING } from './config.js';
import { rand, pick, clamp, dist, angleLerp, angleDiff } from './utils.js';
import { citySolid, isOnRoad, randomRoadPoint } from './city.js';
import { isDown, wasPressed } from './input.js';
import { addHeat } from './police.js';
import { spawnParticles, addShake, addSkid } from './particles.js';
import { hurtPlayer } from './player.js';

let nextCarId = 1;

export function weightedType(rng, weightKey) {
  const types = Object.keys(VEHICLES).filter((t) => VEHICLES[t][weightKey] > 0);
  let total = 0;
  for (const t of types) total += VEHICLES[t][weightKey];
  let roll = rng() * total;
  for (const t of types) {
    roll -= VEHICLES[t][weightKey];
    if (roll <= 0) return t;
  }
  return types[0];
}

export function createCar(rng, x, y, angle, type, kind, opts = {}) {
  const spec = VEHICLES[type];
  return {
    id: nextCarId++,
    type, kind, // kind: 'traffic' | 'parked' | 'police' | 'player'
    x, y, angle,
    speed: 0,
    len: spec.len,
    wid: spec.wid,
    radius: spec.radius,
    color: opts.color || pick(rng, spec.colors),
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    cruise: spec.cruise * rand(rng, 0.9, 1.1),
    targetSpeed: 0,
    occupied: kind === 'traffic',
    siren: type === 'police',
    hp: 100,
    honkCd: 0,
    exitTimer: 0,
  };
}

export function spawnTraffic(world, count = 16) {
  for (let i = 0; i < count; i++) {
    const type = weightedType(world.rng, 'trafficWeight');
    const pt = randomRoadPoint(world.rng);
    // randomRoadPoint returns a point on a vertical road (x on a grid line)
    // or a horizontal road (y on a grid line): the axis follows the road.
    const onVertical = WORLD.GRID.some((g) => Math.abs(pt.x - g) < 40);
    const axis = onVertical ? 'y' : 'x';
    const car = createCar(world.rng, pt.x, pt.y, axis === 'x' ? 0 : Math.PI / 2, type, 'traffic', {
      axis, dir: world.rng() < 0.5 ? 1 : -1,
    });
    car.speed = car.cruise;
    world.cars.push(car);
  }
}

export function spawnParkedCars(world, count = 14) {
  // Park along the curb: on the road, offset perpendicular to it, facing
  // along the road — never inside a block or a building.
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const type = weightedType(world.rng, 'parkedWeight');
    const pt = randomRoadPoint(world.rng);
    const onVertical = WORLD.GRID.some((g) => Math.abs(pt.x - g) < 40);
    const side = world.rng() < 0.5 ? -1 : 1;
    const curb = 20; // inside the 64px road, near its edge
    let x;
    let y;
    let angle;
    if (onVertical) {
      const g = WORLD.GRID.reduce((best, gg) => (Math.abs(pt.x - gg) < Math.abs(pt.x - best) ? gg : best), WORLD.GRID[0]);
      x = g + side * curb;
      y = pt.y;
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const g = WORLD.GRID.reduce((best, gg) => (Math.abs(pt.y - gg) < Math.abs(pt.y - best) ? gg : best), WORLD.GRID[0]);
      x = pt.x;
      y = g + side * curb;
      angle = side > 0 ? 0 : Math.PI;
    }
    const spec = VEHICLES[type];
    if (citySolid(world.city, x, y, spec.radius)) continue;
    // Don't park on top of another car.
    if (world.cars.some((c) => dist(c.x, c.y, x, y) < 70)) continue;
    world.cars.push(createCar(world.rng, x, y, angle, type, 'parked'));
    placed++;
  }
}

function carAhead(world, car, maxDist) {
  let best = Infinity;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of world.cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along > 0 && along < maxDist) {
      const side = Math.abs(-dx * fy + dy * fx);
      if (side < 26 && along < best) best = along;
    }
  }
  return best;
}

export function updateTraffic(dt, world) {
  const grid = WORLD.GRID;
  for (const car of world.cars) {
    if (car.kind !== 'traffic') continue;
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = grid.find((g) => Math.abs(car.x - g) < 26);
    const nearY = grid.find((g) => Math.abs(car.y - g) < 26);
    if (nearX !== undefined && nearY !== undefined && world.rng() < dt * 0.9) {
      if (car.axis === 'x' && world.rng() < 0.5) {
        car.axis = 'y';
        car.dir = world.rng() < 0.5 ? 1 : -1;
        car.y = nearY;
      } else if (car.axis === 'y' && world.rng() < 0.5) {
        car.axis = 'x';
        car.dir = world.rng() < 0.5 ? 1 : -1;
        car.x = nearX;
      }
    }
    // Stop for the car ahead; otherwise cruise.
    const ahead = carAhead(world, car, 78);
    car.targetSpeed = ahead < 78 ? 0 : car.cruise;
    car.speed += clamp(car.targetSpeed - car.speed, -260 * dt, 160 * dt);
    const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.angle = angleLerp(car.angle, targetAngle, Math.min(1, dt * 4));

    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!citySolid(world.city, nx, car.y, car.radius * 0.7)) car.x = nx;
    if (!citySolid(world.city, car.x, ny, car.radius * 0.7)) car.y = ny;

    // Turn around at the world edge instead of leaving the city.
    if (car.x < 120 || car.x > WORLD.SIZE - 120 || car.y < 120 || car.y > WORLD.SIZE - 120) {
      car.dir *= -1;
      car.speed = car.cruise;
    }
  }
}

export function tryEnterCar(world) {
  const p = world.player;
  let best = null;
  let bestD = 78;
  for (const car of world.cars) {
    if (car.kind === 'player') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;

  if (best.kind === 'traffic' && best.occupied) {
    // Pull the driver out; they flee on foot.
    best.occupied = false;
    world.peds.push({
      x: best.x + 30, y: best.y + 30, angle: 0, speed: 0,
      shirt: '#c9c9c9', state: 'flee', target: { x: best.x + 200, y: best.y + 200 },
      downTimer: 0, threatX: best.x, threatY: best.y, walkPhase: 0,
    });
    addHeat(world, WANTED.heatStealCar);
    world.stats.carsStolen++;
  } else if (best.kind === 'parked') {
    addHeat(world, WANTED.heatStealCar);
    world.stats.carsStolen++;
  } else if (best.kind === 'police') {
    addHeat(world, WANTED.heatStealPolice);
    world.stats.carsStolen++;
  }
  best.kind = 'player';
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  if (world.audio) world.audio.click();
  return best;
}

export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  p.x = car.x + side * (car.wid / 2 + 16);
  p.y = car.y + sideY * (car.wid / 2 + 16);
  p.inCar = null;
  if (world.audio) world.audio.setEngine(false, 0);
}

export function updatePlayerCar(dt, input, world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  const spec = VEHICLES[car.type];
  const forward = isDown(input, 'KeyW') || isDown(input, 'ArrowUp');
  const back = isDown(input, 'KeyS') || isDown(input, 'ArrowDown');
  const left = isDown(input, 'KeyA') || isDown(input, 'ArrowLeft');
  const right = isDown(input, 'KeyD') || isDown(input, 'ArrowRight');
  const handbrake = isDown(input, 'Space');

  const offRoad = !isOnRoad(car.x, car.y);
  const maxSpeed = spec.maxSpeed * (offRoad ? 0.55 : 1);

  if (forward) car.speed += spec.accel * dt;
  if (back) {
    if (car.speed > 10) car.speed -= spec.brake * dt * 1.6;
    else car.speed -= spec.accel * 0.7 * dt;
  }
  if (!forward && !back) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 520 * dt);
    if (Math.abs(car.speed) > 120) {
      addSkid(world, car.x, car.y, car.angle);
      if (world.rng() < dt * 8) {
        spawnParticles(world, car.x - Math.cos(car.angle) * car.len / 2, car.y - Math.sin(car.angle) * car.len / 2,
          { count: 2, color: '#9a9a9a', speed: 40, life: 0.5, size: 4 });
      }
    }
  }
  car.speed = clamp(car.speed, -TUNING.playerCarReverseMax, maxSpeed);

  // Steering scales with speed so the car feels planted at pace.
  const steerFactor = clamp(Math.abs(car.speed) / 130, 0, 1);
  if (left) car.angle -= spec.turn * steerFactor * dt * Math.sign(car.speed || 1);
  if (right) car.angle += spec.turn * steerFactor * dt * Math.sign(car.speed || 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hitX = citySolid(world.city, nx, car.y, car.radius * 0.7);
  const hitY = citySolid(world.city, car.x, ny, car.radius * 0.7);
  if (hitX || hitY) {
    car.speed *= 0.35;
    addShake(world, 5);
    spawnParticles(world, car.x, car.y, { count: 6, color: '#ffd166', speed: 120, life: 0.4, size: 3 });
    if (world.audio) world.audio.thud();
  }
  if (!hitX) car.x = nx;
  if (!hitY) car.y = ny;

  // Collisions with other cars: push apart, lose speed, damage on hard hits.
  for (const other of world.cars) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    const minD = car.radius + other.radius;
    if (d < minD && d > 0.01) {
      const push = (minD - d) / 2;
      const ux = (car.x - other.x) / d;
      const uy = (car.y - other.y) / d;
      car.x += ux * push;
      car.y += uy * push;
      if (other.kind !== 'parked') {
        other.x -= ux * push;
        other.y -= uy * push;
      }
      const impact = Math.abs(car.speed) + Math.abs(other.speed || 0);
      if (impact > 180) {
        car.speed *= 0.5;
        addShake(world, 4);
        spawnParticles(world, (car.x + other.x) / 2, (car.y + other.y) / 2,
          { count: 8, color: '#ffd166', speed: 150, life: 0.4, size: 3 });
        if (other.kind === 'police') {
          hurtPlayer(world, 6);
          addHeat(world, WANTED.heatSpeeding);
        }
        if (world.audio) world.audio.thud();
      } else {
        car.speed *= 0.85;
      }
    }
  }

  // Running over pedestrians.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (dist(car.x, car.y, ped.x, ped.y) < car.radius + 10 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.downTimer = 2.5;
      addHeat(world, WANTED.heatHitPed);
      world.stats.pedsHit++;
      addShake(world, 4);
      spawnParticles(world, ped.x, ped.y, { count: 10, color: '#ffd166', speed: 130, life: 0.5, size: 3 });
    }
  }

  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (world.audio) world.audio.setEngine(true, Math.abs(car.speed) / spec.maxSpeed);

  if (wasPressed(input, 'KeyE')) exitCar(world);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCar(ctx, cam, car, time) {
  const sx = car.x - cam.x;
  const sy = car.y - cam.y;
  const spec = VEHICLES[car.type];
  const L = car.len;
  const W = car.wid;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRectPath(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 6);
  ctx.fill();

  // Wheels.
  ctx.fillStyle = '#14141c';
  const wy = W / 2 - 2;
  ctx.fillRect(-L / 2 + 6, -wy - 3, 12, 5);
  ctx.fillRect(-L / 2 + 6, wy - 2, 12, 5);
  ctx.fillRect(L / 2 - 18, -wy - 3, 12, 5);
  ctx.fillRect(L / 2 - 18, wy - 2, 12, 5);

  // Body.
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const glass = '#bfe3ea';
  const dark = 'rgba(0,0,0,0.35)';

  if (car.type === 'sedan' || car.type === 'police') {
    if (car.type === 'police') {
      // Black hood + trunk, white middle (classic two-tone cruiser).
      ctx.fillStyle = '#1c1c26';
      roundRectPath(ctx, -L / 2, -W / 2, 12, W, 7);
      ctx.fill();
      ctx.fillRect(L / 2 - 12, -W / 2 + 1, 11, W - 2);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-L / 2 + 12, -W / 2 + 1, L - 24, W - 2);
    }
    ctx.fillStyle = glass;
    ctx.fillRect(L / 2 - 15, -W / 2 + 4, 8, W - 8); // windshield
    ctx.fillRect(-L / 2 + 7, -W / 2 + 4, 6, W - 8); // rear window
    ctx.fillStyle = dark;
    ctx.fillRect(-6, -W / 2 + 3, 16, W - 6); // roof
  } else if (car.type === 'van') {
    ctx.fillStyle = glass;
    ctx.fillRect(L / 2 - 12, -W / 2 + 4, 7, W - 8);
    ctx.fillStyle = dark;
    ctx.fillRect(-L / 2 + 6, -W / 2 + 3, L - 20, W - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, -W / 2 + 3);
    ctx.lineTo(0, W / 2 - 3);
    ctx.stroke();
  } else if (car.type === 'pickup') {
    // Cab at the front, open bed at the rear.
    ctx.fillStyle = glass;
    ctx.fillRect(L / 2 - 14, -W / 2 + 4, 7, W - 8);
    ctx.fillStyle = dark;
    ctx.fillRect(L / 2 - 20, -W / 2 + 3, 12, W - 6); // cab
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 3, L / 2 - 6, W - 6); // open bed
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(-L / 2 + 4, -W / 2 + 3, L / 2 - 6, W - 6);
  } else if (car.type === 'bus') {
    ctx.fillStyle = glass;
    for (let i = 0; i < 5; i++) {
      const wx = -L / 2 + 10 + i * ((L - 24) / 5);
      ctx.fillRect(wx, -W / 2 + 3, (L - 24) / 5 - 4, 5);
      ctx.fillRect(wx, W / 2 - 8, (L - 24) / 5 - 4, 5);
    }
    ctx.fillRect(L / 2 - 8, -W / 2 + 4, 5, W - 8); // windshield
    ctx.fillStyle = dark;
    ctx.fillRect(-L / 2 + 6, -W / 2 + 8, L - 16, W - 16);
    ctx.fillStyle = '#ffe9c9';
    ctx.fillRect(L / 2 - 14, -3, 8, 6); // destination sign
  } else if (car.type === 'truck') {
    // Cab at the front, closed cargo box at the rear.
    ctx.fillStyle = glass;
    ctx.fillRect(L / 2 - 13, -W / 2 + 4, 7, W - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(L / 2 - 20, -W / 2 + 2, 13, W - 4); // cab
    ctx.fillStyle = '#cfd3d8';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 2, L - 26, W - 4); // cargo box
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(-L / 2 + 3 + (L - 26) / 2, -W / 2 + 2);
    ctx.lineTo(-L / 2 + 3 + (L - 26) / 2, W / 2 - 2);
    ctx.stroke();
  } else if (car.type === 'fire') {
    // Ladder along the roof, cab at the front, white stripe.
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-L / 2 + 4, -2.5, L - 8, 5); // stripe
    ctx.fillStyle = '#c8ccd2';
    ctx.fillRect(-L / 2 + 8, -6, L - 26, 12); // ladder
    ctx.strokeStyle = '#7a7f88';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const lx = -L / 2 + 12 + i * ((L - 34) / 7);
      ctx.beginPath();
      ctx.moveTo(lx, -6);
      ctx.lineTo(lx, 6);
      ctx.stroke();
    }
    ctx.fillStyle = glass;
    ctx.fillRect(L / 2 - 12, -W / 2 + 4, 7, W - 8);
  }

  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 4, 3, 4);
  ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 4);

  // Police light bar, flashing red/blue.
  if (car.type === 'police') {
    const flash = Math.sin(time * 10) > 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#7a1010';
    ctx.fillRect(-4, -W / 2 + 2, 8, 6);
    ctx.fillStyle = flash ? '#1e3aff' : '#101a7a';
    ctx.fillRect(-4, W / 2 - 8, 8, 6);
    if (flash) {
      ctx.fillStyle = 'rgba(255,60,60,0.25)';
      ctx.beginPath();
      ctx.arc(0, -W / 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
