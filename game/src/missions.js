// Sunset City — missions: the 6-job story chain for Rio, the getaway driver.
// Mara the fixer calls with jobs; the crew is the Sunset Crew; the rivals
// are the Vultures. Free roam between jobs; ENTER starts the next one.

import { LANDMARKS, TUNING } from './config.js';
import { dist, rand } from './utils.js';
import { addHeat } from './police.js';
import { showBanner, showDialogue, queueDialogue } from './hud.js';
import { spawnPickup } from './combat.js';
import { saveGame } from './save.js';
import { spawnParticles } from './particles.js';

export const MISSIONS = [
  {
    name: 'First Wheels',
    reward: 200,
    intro: [
      ['Mara', 'Rio, the crew needs wheels. Steal any car — any car — and bring it to my garage.'],
      ['Rio', 'On it. One car, coming up.'],
    ],
  },
  {
    name: 'Package Run',
    reward: 350,
    intro: [
      ['Mara', 'A package is waiting at Pier 9. Grab it on foot and run it to the Sunset Motel. Fast.'],
      ['Mara', 'Heads up: picking it up will draw heat. Do not get caught.'],
    ],
  },
  {
    name: 'Lose the Heat',
    reward: 300,
    intro: [
      ['Mara', 'That was a set-up, Rio. Three stars and every cruiser in the city is on you.'],
      ['Mara', 'Lose them. Break line of sight and stay gone until the heat cools off.'],
    ],
  },
  {
    name: 'The Shootout',
    reward: 500,
    intro: [
      ['Mara', 'The Vultures are hitting my garage! Get there and hold the line, Rio.'],
      ['Rio', 'They picked the wrong garage.'],
    ],
  },
  {
    name: 'The Getaway',
    reward: 600,
    intro: [
      ['Mara', 'I am in the car with you, Rio. Drive me to the safehouse — and do not stop for anyone.'],
      ['Rio', 'Hold on tight, Mara.'],
    ],
  },
  {
    name: 'Sunset Score',
    reward: 1500,
    intro: [
      ['Mara', 'Last one, Rio. The Palms Casino vault. Get in, hold the door, get out rich.'],
      ['Mara', 'Then the yacht at Sunset Beach. Do this and the city is ours.'],
    ],
  },
];

export function missionObjectiveText(world) {
  const m = world.mission;
  if (m.phase === 'done') return 'All jobs done — Sunset City is yours. Free roam!';
  if (m.phase === 'idle') return 'Press ENTER to start your first job';
  if (m.phase === 'between') return 'Job done. Press ENTER for the next job.';
  return m.objective;
}

export function startMission(world, index) {
  const m = world.mission;
  const def = MISSIONS[index];
  m.index = index;
  m.active = true;
  m.phase = 'active';
  m.data = {};
  m.timer = 0;
  m.holdTimer = 0;
  m.marker = null;

  showBanner(`MISSION ${index + 1}: ${def.name}`, 2600);
  showDialogue(def.intro[0][0], def.intro[0][1], 4200);
  for (let i = 1; i < def.intro.length; i++) {
    queueDialogue(def.intro[i][0], def.intro[i][1], 4200);
  }
  if (world.audio) world.audio.jingle();

  switch (index) {
    case 0:
      m.objective = 'Steal any car (press E near a car)';
      break;
    case 1:
      m.objective = 'Pick up the package at Pier 9';
      m.marker = { x: LANDMARKS.pier9.x, y: LANDMARKS.pier9.y, label: 'Pier 9' };
      break;
    case 2:
      world.wanted.heat = 120;
      world.wanted.stars = 3;
      world.wanted.hiddenTimer = 0;
      m.objective = 'Lose the cops — get your wanted level to 0 stars';
      break;
    case 3: {
      m.objective = 'Defend the garage — Vultures left: 6';
      m.marker = { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Mara's Garage" };
      const g = LANDMARKS.garage;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        world.rivals.push({
          x: g.x + Math.cos(a) * 180,
          y: g.y + Math.sin(a) * 180,
          hp: 100, angle: 0, shootCd: rand(world.rng, 0.5, 1.5), walkPhase: 0,
        });
      }
      break;
    }
    case 4:
      world.wanted.heat = 120;
      world.wanted.stars = 3;
      world.wanted.hiddenTimer = 0;
      m.data.mara = true;
      m.objective = 'Drive Mara to the safehouse (stay in a car)';
      m.marker = { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Safehouse' };
      break;
    case 5:
      m.objective = 'Reach The Palms Casino';
      m.marker = { x: LANDMARKS.casino.x, y: LANDMARKS.casino.y, label: 'The Palms Casino' };
      break;
    default:
      break;
  }
}

export function completeMission(world) {
  const m = world.mission;
  const def = MISSIONS[m.index];
  world.cash += def.reward;
  showBanner(`MISSION COMPLETE — ${def.name}  +$${def.reward}`, 3000);
  showDialogue('Mara', `Clean work, Rio. $${def.reward} is yours.`, 3600);
  spawnParticles(world, world.player.x, world.player.y,
    { count: 24, color: '#ffd166', speed: 200, life: 0.8, size: 4 });
  spawnPickup(world, world.player.x + 40, world.player.y, 'cash', 50);
  if (world.audio) world.audio.jingle();
  m.active = false;
  m.phase = 'between';
  m.objective = '';
  m.marker = null;
  m.index++;
  if (m.index >= MISSIONS.length) {
    m.phase = 'done';
  }
  saveGame(world);
}

export function failMission(world, reason) {
  const m = world.mission;
  showBanner(`JOB FAILED — ${reason}. Try again.`, 3000);
  // Reset the mission's side effects, then restart it.
  world.rivals.length = 0;
  startMission(world, m.index);
}

// E-key interactions: package pickup (mission 2) and the vault (mission 6).
export function handleInteract(world) {
  const m = world.mission;
  if (!m.active) return;
  const p = world.player;
  if (m.index === 1 && !m.data.picked && dist(p.x, p.y, LANDMARKS.pier9.x, LANDMARKS.pier9.y) < 80) {
    m.data.picked = true;
    m.timer = 90;
    addHeat(world, 25); // picking up the package draws 1 star of heat
    m.objective = 'Deliver the package to the Sunset Motel — 90s!';
    m.marker = { x: LANDMARKS.motel.x, y: LANDMARKS.motel.y, label: 'Sunset Motel' };
    showDialogue('Mara', 'Package secured. Now run — the motel, 90 seconds!', 3600);
  }
}

export function updateMission(dt, world) {
  const m = world.mission;
  if (!m.active) return;
  const p = world.player;

  switch (m.index) {
    case 0: {
      if (p.inCar) {
        m.objective = "Drive to Mara's Garage";
        m.marker = { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Mara's Garage" };
        if (dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 95) completeMission(world);
      }
      break;
    }
    case 1: {
      if (m.data.picked) {
        m.timer -= dt;
        m.objective = `Deliver the package to the Sunset Motel — ${Math.max(0, Math.ceil(m.timer))}s!`;
        if (m.timer <= 0) {
          failMission(world, 'Out of time');
        } else if (dist(p.x, p.y, LANDMARKS.motel.x, LANDMARKS.motel.y) < 95) {
          completeMission(world);
        }
      }
      break;
    }
    case 2: {
      if (world.wanted.stars === 0) completeMission(world);
      break;
    }
    case 3: {
      m.objective = `Defend the garage — Vultures left: ${world.rivals.length}`;
      if (world.rivals.length === 0 && !m.data.escaped) {
        m.data.escaped = true;
        m.objective = 'Garage clear! Escape to Pier 9';
        m.marker = { x: LANDMARKS.pier9.x, y: LANDMARKS.pier9.y, label: 'Pier 9' };
        showDialogue('Mara', 'Garage is clear. Get to Pier 9 before more of them show up!', 3600);
      }
      if (m.data.escaped && dist(p.x, p.y, LANDMARKS.pier9.x, LANDMARKS.pier9.y) < 95) {
        completeMission(world);
      }
      break;
    }
    case 4: {
      if (!p.inCar) {
        m.objective = 'Get in a car — then drive Mara to the safehouse';
      } else {
        m.objective = 'Drive Mara to the safehouse';
        if (dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 100) {
          completeMission(world);
        }
      }
      break;
    }
    case 5: {
      if (!m.data.vaultDone) {
        if (dist(p.x, p.y, LANDMARKS.casino.x, LANDMARKS.casino.y) < 95) {
          m.data.atVault = true;
          m.objective = 'Hold E at the vault!';
        }
        if (m.data.atVault && dist(p.x, p.y, LANDMARKS.casino.x, LANDMARKS.casino.y) < 80) {
          if (world.input.keys.has('KeyE')) {
            m.holdTimer += dt;
            m.objective = `Cracking the vault… ${Math.ceil(5 - m.holdTimer)}s (hold E)`;
            if (m.holdTimer >= 5) {
              m.data.vaultDone = true;
              world.wanted.heat = 200;
              world.wanted.stars = 4;
              world.wanted.hiddenTimer = 0;
              m.objective = 'Vault cracked! Escape to the yacht at Sunset Beach';
              m.marker = { x: LANDMARKS.yacht.x, y: LANDMARKS.yacht.y, label: 'Yacht' };
              showDialogue('Mara', 'Four stars, Rio! Get to the yacht — do not stop!', 3600);
            }
          } else {
            m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
          }
        }
      } else if (dist(p.x, p.y, LANDMARKS.yacht.x, LANDMARKS.yacht.y) < 100) {
        completeMission(world);
        world.state = 'ending';
        world.stateData = { cash: world.cash };
      }
      break;
    }
    default:
      break;
  }
}

export function updateRivals(dt, world) {
  const p = world.player;
  for (const rival of world.rivals) {
    const d = dist(rival.x, rival.y, p.x, p.y);
    rival.shootCd -= dt;
    if (d > 240) {
      // Close in until in range.
      const a = Math.atan2(p.y - rival.y, p.x - rival.x);
      rival.angle = a;
      rival.x += Math.cos(a) * TUNING.rivalSpeed * dt;
      rival.y += Math.sin(a) * TUNING.rivalSpeed * dt;
      rival.walkPhase += dt * 9;
    } else {
      rival.angle = Math.atan2(p.y - rival.y, p.x - rival.x);
      if (rival.shootCd <= 0 && d < 380 && world.state === 'playing') {
        rival.shootCd = rand(world.rng, 1.3, 2.1);
        // Rival bullets use the shared bullet list (from: 'rival').
        world.bullets.push({
          x: rival.x + Math.cos(rival.angle) * 18,
          y: rival.y + Math.sin(rival.angle) * 18,
          vx: Math.cos(rival.angle) * TUNING.bulletSpeed * 0.85,
          vy: Math.sin(rival.angle) * TUNING.bulletSpeed * 0.85,
          life: 0.9,
          from: 'rival',
        });
        if (world.audio) world.audio.gunshot();
      }
    }
  }
}

export function drawRivals(ctx, cam, world) {
  for (const rival of world.rivals) {
    const sx = rival.x - cam.x;
    const sy = rival.y - cam.y;
    const bob = Math.sin(rival.walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(sx, sy + bob * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(sx, sy - 2 + bob * 0.3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Gun toward the player.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rival.angle);
    ctx.fillStyle = '#22222e';
    ctx.fillRect(6, -2, 13, 4);
    ctx.restore();
    // Health bar.
    ctx.fillStyle = '#22222e';
    ctx.fillRect(sx - 12, sy - 20, 24, 4);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(sx - 12, sy - 20, 24 * Math.max(0, rival.hp / 100), 4);
  }
}
