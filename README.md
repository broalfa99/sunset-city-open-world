# Sunset City — Open-World Crime Game

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/broalfa99/sunset-city-open-world/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/broalfa99/sunset-city-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

A complete open-world crime game that plays offline in a desktop browser, built for the make.fun **gta6-01** bounty ("Make GTA 6", $1,666).

You are **Rio**, a getaway driver in the sun-soaked coastal city of **Sunset City**. Steal cars, dodge traffic, outrun the police as your wanted level rises, and run six story jobs for the fixer **Mara** — ending with the Sunset Score at The Palms Casino and a getaway to the yacht at Sunset Beach.

Everything is original: the city, the characters, the story, the art and the sound. No real brands, no borrowed maps, no Rockstar assets.

## How to play

Serve the game (any static server works) and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests, no install. `game/index.html` plus its ES modules is the whole game.

### Controls

| Input | Action |
|---|---|
| WASD / Arrows | Move on foot / drive |
| Mouse | Aim |
| Click / Space | Shoot pistol (hold Space to handbrake while driving) |
| F | Melee swing |
| E | Enter / exit a car, interact |
| R | Reload |
| Enter | Start the next job |
| P / Esc | Pause |
| M | Mute |

## The city

A 3200×3200 open world: a road grid with traffic, sidewalks full of pedestrians, parks, a beach and animated water on the south edge, and named landmarks — Mara's Garage, Pier 9, the Sunset Motel, The Palms Casino, the Safehouse, Downtown and the yacht at Sunset Beach. The in-game clock runs from late afternoon into the evening and the sunset light deepens with it.

## Vehicles — 7 original types

Every type has its own size, handling and top-down look. All of them appear in traffic and parked around the city, and all of them can be stolen and driven (stealing a police cruiser adds instant heat).

| Vehicle | Feel | Look |
|---|---|---|
| Sedan | Balanced all-rounder | Classic 4-door |
| Van | Bigger, slower | Long body, big roof |
| Pickup | Fast, open bed | Cab + open cargo bed |
| Bus | Big, slow, heavy ram | Long body, window strips |
| Truck | Big, slow, heavy ram | Cab + closed cargo box |
| Fire Truck | Big, slow, strongest ram | Red, ladder on the roof |
| Police Cruiser | Fastest, chase-only | Black-and-white two-tone, flashing light bar |

## Wanted level

Crime raises heat: stealing a car (+1 star), hitting a pedestrian, firing near witnesses, hurting a cop, ramming police. Heat maps to 1–5 stars. Police cruisers chase and ram; foot cops close in and arrest you (BUSTED). Break line of sight and stay hidden and the heat cools off, star by star.

## Missions — the Sunset Crew story

Six jobs, unlocked in order, with free roam between them. Press ENTER to start the next one.

1. **First Wheels** — steal any car and drive it to Mara's Garage.
2. **Package Run** — pick up a package at Pier 9 on foot and deliver it to the Sunset Motel in 90 seconds (the pickup draws heat).
3. **Lose the Heat** — a set-up leaves you at 3 stars: lose every cop until the wanted level cools to zero.
4. **The Shootout** — defend Mara's Garage from six Vultures gang members, then escape to Pier 9.
5. **The Getaway** — drive Mara across the city to the safehouse while the police chase at 3 stars.
6. **Sunset Score** — reach The Palms Casino, hold E to crack the vault, then escape to the yacht at Sunset Beach with 4 stars on you. Finish it and Sunset City is yours.

## Systems

- **On foot and by car** — walk, aim and shoot, or drive anything you can steal.
- **Traffic and pedestrians** — cars cruise the roads and turn at intersections; pedestrians wander the sidewalks and flee from gunfire and speeding cars.
- **Combat** — pistol with a 12-round magazine and reloads, melee swings, rival gang members who shoot back.
- **Pickups** — health, ammo and cash scattered around the city and dropped by jobs.
- **HUD with minimap** — health, cash, ammo, wanted stars, in-game clock, current objective, and a live minimap (player, police, mission marker, traffic).
- **Save** — progress (cash, health, mission, position, clock) saves to localStorage on every completed job and from the pause menu; Continue on the title screen picks it up.
- **Sound** — WebAudio synthesis only (engine hum, sirens, gunshots, pickups, mission jingles). No audio files.
- **Polish** — smooth follow camera, screen shake, particles, skid marks, sunset lighting, title / pause / busted / wasted / ending screens.

## Screenshots

The four screenshots in `screenshots/` are real renders of this game in desktop Chrome, taken with the deterministic `?shot=` scenes (`chase`, `mission`, `street`, `start`): the cover is a 3-star police chase with the wanted level, the minimap and a mission objective all on the HUD.

## Tech

Plain HTML, CSS and JavaScript on a 2D canvas — no library, no engine, no build step. The source is split into one file per job under `game/src/` (`city`, `cars`, `player`, `pedestrians`, `police`, `combat`, `missions`, `hud`, `audio`, `particles`, `shots`, `save`, `input`, `main`). `main.ts` at the repository root copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## License

MIT — see `LICENSE`.
