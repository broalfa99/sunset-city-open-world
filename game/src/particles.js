// Sunset City — particles, screen shake, skid marks.

import { rand } from './utils.js';

export function spawnParticles(world, x, y, opts = {}) {
  const count = opts.count || 8;
  const speed = opts.speed || 120;
  const life = opts.life || 0.5;
  const size = opts.size || 3;
  const color = opts.color || '#ffd166';
  for (let i = 0; i < count; i++) {
    const a = rand(world.rng, 0, Math.PI * 2);
    const sp = rand(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(world.rng, life * 0.6, life),
      maxLife: life,
      size: rand(world.rng, size * 0.6, size * 1.4),
      color,
    });
  }
  if (world.particles.length > 400) {
    world.particles.splice(0, world.particles.length - 400);
  }
}

export function updateParticles(dt, world) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.4 * dt;
    pt.vy *= 1 - 2.4 * dt;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.skids.length - 1; i >= 0; i--) {
    world.skids[i].life -= dt;
    if (world.skids[i].life <= 0) world.skids.splice(i, 1);
  }
}

export function drawParticles(ctx, cam, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

export function addShake(world, mag) {
  world.camera.shakeMag = Math.max(world.camera.shakeMag, mag);
}

export function addSkid(world, x, y, angle) {
  world.skids.push({ x, y, angle, life: 5 });
  if (world.skids.length > 220) world.skids.shift();
}

export function drawSkids(ctx, cam, world) {
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 3;
  for (const s of world.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath();
    ctx.moveTo(s.x - cam.x - Math.cos(s.angle) * 10, s.y - cam.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x - cam.x + Math.cos(s.angle) * 10, s.y - cam.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
