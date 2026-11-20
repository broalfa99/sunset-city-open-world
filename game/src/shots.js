// Sunset City — deterministic screenshot scenes (?shot=).
// Each shot sets up a fixed, reproducible scene so the 4 submitted
// screenshots show the game at its most complete. The world itself is
// created with a fixed seed in shot mode, so the city layout matches too.

import { LANDMARKS } from './config.js';
import { angleTo } from './utils.js';
import { createCar } from './cars.js';
import { startMission } from './missions.js';

export function applyShot(name, world) {
  if (name === 'start') {
    // Title screen over a slow pan of the city centre.
    world.state = 'title';
    world.camera.x = 1600;
    world.camera.y = 1500;
    return;
  }

  world.state = 'playing';

  if (name === 'chase') {
    // Cover shot: Rio in a pickup downtown at 3 stars, two cruisers
    // ramming from behind, Getaway mission objective + minimap on the HUD.
    const p = world.player;
    let car = world.cars.find((c) => c.kind === 'parked' && c.type === 'pickup')
      || world.cars.find((c) => c.kind === 'parked');
    car.kind = 'player';
    car.x = 1800;
    car.y = 1400;
    car.angle = 0;
    car.speed = 300;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    world.wanted.heat = 120;
    world.wanted.stars = 3;
    for (const off of [[-170, -46], [-230, 64]]) {
      const cop = createCar(world.rng, car.x + off[0], car.y + off[1], 0, 'police', 'police');
      cop.speed = 330;
      world.cars.push(cop);
    }
    startMission(world, 4);
    world.camera.x = p.x;
    world.camera.y = p.y;
  } else if (name === 'mission') {
    // Mission 4 shootout: Rio on foot at the garage, six Vultures
    // closing in, traffic and the objective banner on screen.
    startMission(world, 3);
    const g = LANDMARKS.garage;
    world.player.x = g.x + 70;
    world.player.y = g.y + 130;
    world.player.angle = angleTo(world.player.x, world.player.y, g.x, g.y);
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
  } else if (name === 'street') {
    // On foot downtown: traffic, pedestrians, first mission objective.
    startMission(world, 0);
    world.player.x = 1800;
    world.player.y = 1400;
    world.camera.x = 1800;
    world.camera.y = 1400;
  }
}
