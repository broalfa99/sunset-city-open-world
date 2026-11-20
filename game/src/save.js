// Sunset City — save / load via localStorage.

import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      cash: world.cash,
      hp: world.player.hp,
      ammo: world.player.ammo,
      missionIndex: world.mission.index,
      x: world.player.x,
      y: world.player.y,
      clock: world.clock,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* ignore */ }
}
