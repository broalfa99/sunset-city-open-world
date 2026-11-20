// Sunset City — city generation, drawing and collision.
// World 3200x3200: road grid every 400px, blocks with 1-4 buildings or a park,
// a beach strip and animated water on the south edge.

import { WORLD, COLORS, LANDMARKS } from './config.js';
import { rand, randInt, pick, circleHitsRect } from './utils.js';

export function generateCity(rng) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const grid = WORLD.GRID;
  const half = WORLD.ROAD_WIDTH / 2;

  // Blocks sit between neighbouring grid lines. Two blocks become parks.
  const parkBlocks = new Set();
  while (parkBlocks.size < 2) {
    parkBlocks.add(randInt(rng, 0, 6) * 10 + randInt(rng, 0, 6));
  }

  for (let bi = 0; bi < 7; bi++) {
    for (let bj = 0; bj < 7; bj++) {
      const x0 = grid[bi] + half + 4;
      const y0 = grid[bj] + half + 4;
      const x1 = grid[bi + 1] - half - 4;
      const y1 = grid[bj + 1] - half - 4;
      const key = bi * 10 + bj;
      if (parkBlocks.has(key)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const treeCount = randInt(rng, 5, 8);
        for (let t = 0; t < treeCount; t++) {
          trees.push({
            x: rand(rng, x0 + 24, x1 - 24),
            y: rand(rng, y0 + 24, y1 - 24),
            r: rand(rng, 12, 20),
          });
        }
        continue;
      }
      // Split the block into a 2x2 cell grid; fill 1-4 cells with buildings.
      const cells = [0, 1, 2, 3].sort(() => rng() - 0.5);
      const count = randInt(rng, 1, 4);
      const cw = (x1 - x0) / 2;
      const ch = (y1 - y0) / 2;
      for (let c = 0; c < count; c++) {
        const cell = cells[c];
        const cx = x0 + (cell % 2) * cw;
        const cy = y0 + Math.floor(cell / 2) * ch;
        const w = rand(rng, 70, cw - 28);
        const h = rand(rng, 70, ch - 28);
        const bx = cx + (cw - w) / 2 + rand(rng, -8, 8);
        const by = cy + (ch - h) / 2 + rand(rng, -8, 8);
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, COLORS.roofPalette),
          ac: randInt(rng, 1, 3),
        });
      }
    }
  }

  return { buildings, parks, trees, landmarks: LANDMARKS };
}

export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return true;
  }
  return false;
}

// Solid for movement: buildings, water, and the world edge.
export function citySolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.SIZE - r || y > WORLD.SIZE - r) return true;
  if (y + r > WORLD.WATER_Y) return true;
  return collidesBuilding(city, x, y, r);
}

export function isOnRoad(x, y) {
  const m = WORLD.ROAD_WIDTH / 2 + 8;
  for (const g of WORLD.GRID) {
    if (Math.abs(x - g) <= m || Math.abs(y - g) <= m) return true;
  }
  return false;
}

// A random point on a road centreline, with a lane offset.
export function randomRoadPoint(rng) {
  const g = pick(rng, WORLD.GRID);
  const along = rand(rng, 120, WORLD.SIZE - 120);
  const lane = pick(rng, [-16, 16]);
  if (rng() < 0.5) return { x: g + lane, y: along };
  return { x: along, y: g + lane };
}

// A random point on a sidewalk (just off a road edge).
export function randomSidewalkPoint(rng) {
  const g = pick(rng, WORLD.GRID);
  const along = rand(rng, 120, WORLD.SIZE - 120);
  const off = pick(rng, [-44, 44]);
  if (rng() < 0.5) return { x: g + off, y: along };
  return { x: along, y: g + off };
}

// Nearest grid-line point to (x, y) — used to snap spawned cars onto roads.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const g of WORLD.GRID) {
    for (const [px, py] of [[g, y], [x, g]]) {
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        best = { x: px, y: py };
      }
    }
  }
  return best;
}

function inView(cam, vw, vh, x, y, w, h) {
  // cam is the TOP-LEFT corner of the view (main.js passes the view origin).
  return x + w > cam.x - 40 && x < cam.x + vw + 40 &&
    y + h > cam.y - 40 && y < cam.y + vh + 40;
}

export function drawCity(ctx, city, cam, vw, vh, time) {
  const x0 = cam.x - 40;
  const y0 = cam.y - 40;
  const x1 = cam.x + vw + 40;
  const y1 = cam.y + vh + 40;

  // Draw everything in WORLD coordinates: shift the canvas by the view
  // origin so world positions land on the right screen pixels.
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Ground.
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Block ground.
  ctx.fillStyle = COLORS.blockGround;
  const half = WORLD.ROAD_WIDTH / 2;
  for (let bi = 0; bi < 7; bi++) {
    for (let bj = 0; bj < 7; bj++) {
      const bx = WORLD.GRID[bi] + half + 4;
      const by = WORLD.GRID[bj] + half + 4;
      const bw = WORLD.GRID[bi + 1] - half - 4 - bx;
      const bh = WORLD.GRID[bj + 1] - half - 4 - by;
      if (inView(cam, vw, vh, bx, by, bw, bh)) {
        ctx.fillRect(bx, by, bw, bh);
      }
    }
  }

  // Roads: asphalt strips + sidewalks + dashed centre lines.
  ctx.fillStyle = COLORS.road;
  for (const g of WORLD.GRID) {
    ctx.fillRect(x0, g - half, x1 - x0, WORLD.ROAD_WIDTH);
    ctx.fillRect(g - half, y0, WORLD.ROAD_WIDTH, y1 - y0);
  }
  ctx.fillStyle = COLORS.sidewalk;
  for (const g of WORLD.GRID) {
    ctx.fillRect(x0, g - half, x1 - x0, 5);
    ctx.fillRect(x0, g + half - 5, x1 - x0, 5);
    ctx.fillRect(g - half, y0, 5, y1 - y0);
    ctx.fillRect(g + half - 5, y0, 5, y1 - y0);
  }
  ctx.strokeStyle = COLORS.roadLine;
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([18, 22]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const g of WORLD.GRID) {
    ctx.moveTo(x0, g);
    ctx.lineTo(x1, g);
    ctx.moveTo(g, y0);
    ctx.lineTo(g, y1);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Parks and trees.
  for (const p of city.parks) {
    if (!inView(cam, vw, vh, p.x, p.y, p.w, p.h)) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(t.x - 2, t.y - 2, 4, 6);
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Beach + water on the south edge.
  if (y1 > WORLD.BEACH_Y) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, WORLD.BEACH_Y, x1 - x0, WORLD.WATER_Y - WORLD.BEACH_Y);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(x0, WORLD.WATER_Y, x1 - x0, WORLD.SIZE - WORLD.WATER_Y);
    ctx.strokeStyle = COLORS.waterDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
      const wy = WORLD.WATER_Y + 18 + Math.sin(time * 1.4 + wx * 0.02) * 4;
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 46, wy);
    }
    ctx.stroke();
  }

  // Buildings: roof, parapet edge, rooftop details.
  for (const b of city.buildings) {
    if (!inView(cam, vw, vh, b.x, b.y, b.w, b.h)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = COLORS.roofEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 8, b.y + 8, Math.min(26, b.w - 16), 14);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let a = 0; a < b.ac; a++) {
      ctx.fillRect(b.x + 10 + a * 16, b.y + b.h - 16, 10, 8);
    }
  }

  // Landmark labels (small, so the city reads as a place with names).
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(city.landmarks)) {
    const lm = city.landmarks[key];
    if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(lm.name).width + 12;
    ctx.fillRect(lm.x - w / 2, lm.y - 26, w, 17);
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText(lm.name, lm.x, lm.y - 13);
  }

  ctx.restore();
}
