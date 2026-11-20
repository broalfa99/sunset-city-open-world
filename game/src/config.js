// Sunset City — configuration: world size, colours, tuning, wanted thresholds.
// All values tuned for a 3200x3200 city viewed through a 1280x720 camera.

export const WORLD = {
  SIZE: 3200,
  ROAD_SPACING: 400,
  ROAD_WIDTH: 64,
  // Grid lines of the road network (vertical and horizontal).
  GRID: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  BEACH_Y: 3050, // sand starts here
  WATER_Y: 3120, // water starts here (impassable)
};

export const COLORS = {
  ground: '#241f30',
  blockGround: '#2e2a3d',
  road: '#3a3348',
  roadLine: '#c9b458',
  sidewalk: '#4a4360',
  park: '#2f6b4f',
  tree: '#3f8f5f',
  treeTrunk: '#6b4a2f',
  sand: '#d9b380',
  water: '#1f8a8a',
  waterDeep: '#166b6b',
  roofPalette: ['#b5654a', '#4a8f8f', '#7a5a9e', '#c9a86a', '#8f5a6b', '#5a7a9e'],
  roofEdge: '#241f30',
  player: '#2ec4b6',
  playerDark: '#1d7a70',
  rival: '#e63946',
  cop: '#4361ee',
  copDark: '#2b3a8f',
  star: '#ffd166',
  starEmpty: '#3a3348',
  cash: '#ffd166',
  health: '#43aa5b',
  healthLow: '#e63946',
};

export const TUNING = {
  playerWalkSpeed: 185,
  playerRadius: 13,
  playerMaxHp: 100,
  pistolMag: 12,
  pistolDamage: 34,
  pistolCooldown: 0.22,
  pistolRange: 520,
  bulletSpeed: 640,
  meleeRange: 58,
  meleeDamage: 42,
  meleeCooldown: 0.45,
  carLength: 48,
  carWidth: 24,
  carRadius: 20,
  trafficSpeedMin: 90,
  trafficSpeedMax: 150,
  playerCarAccel: 280,
  playerCarBrake: 460,
  playerCarMaxSpeed: 430,
  playerCarReverseMax: 150,
  playerCarTurn: 2.6,
  policeCarMaxSpeed: 480,
  policeCarAccel: 320,
  footCopSpeed: 152,
  rivalSpeed: 130,
  rivalHp: 100,
  pedSpeed: 55,
  pedFleeSpeed: 150,
  cameraLerp: 6,
  clockRate: 0.02, // game hours per real second (sunset deepens over ~2 min)
  pickupMagnet: 90,
  pickupCollect: 28,
};

// Vehicle types (user order 20 Nov: many models, all original/generic designs).
// len/wid in px (top-down), maxSpeed/accel for player driving, cruise for traffic,
// turn = steering rate, ram = how hard it hits when ramming, drivable = player
// can steal and drive it, trafficWeight = how often it appears in traffic,
// parkedWeight = how often it appears parked. Police cars are never traffic;
// stealing one adds big heat (see WANTED.heatStealPolice).
export const VEHICLES = {
  sedan: {
    label: 'Sedan', len: 48, wid: 24, radius: 20,
    maxSpeed: 430, accel: 280, turn: 2.6, cruise: 130, ram: 1.0,
    drivable: true, trafficWeight: 34, parkedWeight: 34,
    colors: ['#c94f4f', '#4f7ac9', '#c9a44f', '#7a4fc9', '#4fc98a'],
  },
  van: {
    label: 'Van', len: 56, wid: 26, radius: 23,
    maxSpeed: 360, accel: 230, turn: 2.2, cruise: 110, ram: 1.2,
    drivable: true, trafficWeight: 16, parkedWeight: 16,
    colors: ['#8a8f96', '#b0a58a', '#5a7a8a'],
  },
  pickup: {
    label: 'Pickup', len: 54, wid: 25, radius: 22,
    maxSpeed: 455, accel: 300, turn: 2.7, cruise: 140, ram: 1.2,
    drivable: true, trafficWeight: 16, parkedWeight: 16,
    colors: ['#c96a2e', '#3e6b4f', '#7a3e5a'],
  },
  bus: {
    label: 'Bus', len: 86, wid: 28, radius: 32,
    maxSpeed: 300, accel: 170, turn: 1.6, cruise: 95, ram: 2.2,
    drivable: true, trafficWeight: 8, parkedWeight: 6,
    colors: ['#e8a33d', '#3d8a7a', '#d8d8d8'],
  },
  truck: {
    label: 'Truck', len: 78, wid: 28, radius: 30,
    maxSpeed: 320, accel: 190, turn: 1.7, cruise: 100, ram: 2.0,
    drivable: true, trafficWeight: 12, parkedWeight: 10,
    colors: ['#8a6a3d', '#5a5f6b', '#3d6b8a'],
  },
  fire: {
    label: 'Fire Truck', len: 82, wid: 28, radius: 31,
    maxSpeed: 335, accel: 200, turn: 1.7, cruise: 105, ram: 2.4,
    drivable: true, trafficWeight: 2, parkedWeight: 3,
    colors: ['#d42a1e'],
  },
  police: {
    label: 'Police Cruiser', len: 50, wid: 25, radius: 21,
    maxSpeed: 480, accel: 320, turn: 2.9, cruise: 150, ram: 1.3,
    drivable: true, trafficWeight: 0, parkedWeight: 0,
    colors: ['#f2f2f2'],
  },
};

export const WANTED = {  // Heat thresholds for stars 1..5.
  thresholds: [25, 60, 120, 200, 300],
  heatStealCar: 25,
  heatStealPolice: 60, // stealing a police cruiser: instant 2 stars of heat
  heatHitPed: 30,
  heatShotWitness: 15,
  heatCopHurt: 50,
  heatSpeeding: 10,
  hideRadius: 600,
  hideTime: 8,
  decayPerSec: 30,
  maxHeat: 400,
};

// Fixed landmark positions (all on roads, so the player can always reach them).
export const LANDMARKS = {
  garage: { x: 600, y: 600, name: "Mara's Garage" },
  pier9: { x: 1600, y: 3000, name: 'Pier 9' },
  motel: { x: 2200, y: 1000, name: 'Sunset Motel' },
  casino: { x: 1400, y: 2200, name: 'The Palms Casino' },
  safehouse: { x: 1800, y: 1800, name: 'Safehouse' },
  yacht: { x: 1600, y: 3085, name: 'Yacht' },
  downtown: { x: 1800, y: 1400, name: 'Downtown' },
};

export const SAVE_KEY = 'sunset-city-save-v1';
