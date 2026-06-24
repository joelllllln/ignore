# Idle Dot Shooter

A one-shot idle tower-defense shooter built in **Godot 4.6 / GDScript**, inspired by
idle dot shooters with a *They Are Billions*–style defense twist.

Colored **dots** descend from the top of the screen and drift down toward your line of
**cannons** at the bottom. Cannons auto-target and fire at the nearest dot. Destroying
dots earns **coins**, which you spend on upgrades. Let too many dots breach the wall and
it's game over.

## How to play

1. Open the project folder in Godot 4.6 (`Import` → select `project.godot`).
2. Press **F5** / the Play button to run `scenes/Main.tscn`.
3. Everything is automatic — cannons fire on their own. Spend coins on the right-hand
   upgrade buttons and survive as long as you can.

## Controls / UI

- **Speed / Difficulty slider** (top): drag to scale dot speed *and* spawn rate live
  (0.5x – 3.0x). Crank it up for more pressure (and faster waves).
- **Upgrades** (right panel) — split into two power trees plus defense. These are
  *transformative* upgrades: most of them **double** a stat instead of nudging it.

  **Turrets**
  - **Heavy Rounds** — ×2 bullet damage every level (2 → 4 → 8 → 16 …)
  - **Double Barrel** — ×2 rate of fire every level (capped at 24/s)
  - **Multishot** — ×2 simultaneous targets per turret (1 → 2 → 4 → 8)
  - **Add Turret** — adds a turret to the line (up to 10), spread evenly

  **Drones**
  - **Deploy Drone** — adds an autonomous combat drone that orbits above the wall
    and auto-fires at dots (up to 8)
  - **Overclock** — ×2 drone fire rate every level
  - **Plasma Core** — ×2 drone damage every level

  **Defense**
  - **Reinforce Wall** — +10 max wall HP and a full repair

  Because each tier doubles its stat, costs climb steeply (≈×3 per level) so the big
  jumps stay earned.
- **Stats** (top-left): coins, wall HP, current wave, kills, turret and drone count.
- On game over, press **Restart**.

## Mechanics

- Dots get tougher and spawn faster the longer you survive (wave tiers every ~12s).
- Bigger/tankier dots hit the wall harder if they breach.
- Difficulty multiplier affects both descent speed and spawn rate, so it doubles as a
  pace control and a challenge dial.

## Project layout

```
project.godot        Godot 4.6 project config (main scene = scenes/Main.tscn)
icon.svg             App icon
scenes/Main.tscn     Minimal root scene (Node2D + Main.gd)
scripts/Main.gd      Game manager: spawning, cannons, bullets, economy, UI
scripts/Dot.gd       Descending enemy
scripts/Bullet.gd    Projectile (turret + drone fire)
scripts/Cannon.gd    Turret
scripts/Drone.gd     Orbiting autonomous combat drone
```

Entities are created programmatically from `Main.gd`, so the scene tree stays simple.
