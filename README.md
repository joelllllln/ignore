# Hive Worlds — Galactic Tower Defense

A browser **tower-defense progression** game built entirely with **HTML5, JavaScript,
and Canvas** — no build step, no dependencies. Open `index.html` and play.

Conquer a galaxy planet by planet. Each planet hides a fixed-size swarm (the **hive**)
that crawls toward your defenders. Build a defensive grid, auto-fire on the swarm, fill
the **conquest meter** to 100%, and move on to the next world.

## Screens

- **Main menu** — Play, Star Map, How to Play, Reset Progress. Tracks planets conquered.
- **Star map** — a zoomable, pseudo-3D view: **Universe → Galaxy → Solar System**. Spiral
  galaxies, orbiting shaded planets with day/night terminators, and lit/locked/✓-conquered
  states so you can *see* your conquest spread. Tap a lit planet to invade it.
- **Battle** — the grid-based defense.

## Battle features

- **Grid placement.** Pick a defender from the palette, tap a cell to deploy.
  **Hold &amp; drag** a placed defender to move it to another cell.
- **5 defender types**, each distinct: **Blaster** (rapid), **Sniper** (long-range burst),
  **Cannon** (splash), **Frost** (slows the swarm), **Tesla** (chain lightning).
- **Per-defender skill trees.** Tap a defender to open its panel — spend energy on a
  branching tree (power / precision / special) unique to each type.
- **Target priorities.** Each defender can prioritize **First / Close / Strong / Fast / Weak**.
- **7 enemy species** with their own art, animation, and abilities: Crawler (walking legs),
  Runner (dashing), Brute (armored tank), Shielded (regenerating shield), Flyer (flapping,
  erratic), Splitter (bursts into minis on death), Healer (pulses heals to nearby hive).
- **You start with one** defender's worth of energy and build up from kills.

## Speed &amp; economy

- **Speed slider (1×–6×)** scales enemy movement, spawns, and conquest speed, and applies a
  matching **reward multiplier** to energy income (shown as `×N reward`).
- **Fire rate does NOT scale with speed** — so cranking speed means a faster swarm against the
  same volume of fire: faster progress and richer rewards, but real pressure.
- **No game over.** Damaged defenders lower **Efficiency**, which throttles conquest gain and
  income (and slows each turret's fire). Damage *slows the conquest*, it never ends the run.
- **👆 Tap the sky** (above your grid) to strike enemies directly.

## Progress

Conquest is saved to `localStorage`, so your galaxy map remembers what you've taken.

## Project layout

```
index.html   Screens (menu / how-to / map UI / battle HUD / clear) + canvas
style.css    Layout & theming (responsive, mobile-friendly)
game.js      Engine: galaxy data, tower & enemy definitions, skill trees,
             star-map renderer, battle sim, grid/drag input, render loop
icon.svg     App icon
```

Everything runs client-side in a single `requestAnimationFrame` loop — no server,
bundler, or assets required.
