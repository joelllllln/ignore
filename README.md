# Idle Dot Shooter

A focused **idle shooter** built with **HTML5, JavaScript and Canvas** — no
dependencies, no asset files (graphics are drawn procedurally, sound is
synthesized). Open `index.html` and play.

Dots fall from the top. Your cannons auto-fire at the nearest one. Kills pay
**coins**. Spend coins on a handful of upgrades whose costs rise each level.
Waves scale **exponentially**, so progression is a long, satisfying grind.

## Core loop

1. **Dots descend** — each has health that grows every wave (`hp ≈ 10 × 1.165^wave`).
2. **Cannons auto-fire** at the nearest dot; kills grant coins (`≈ 2 × 1.15^wave`).
3. **Upgrade** with coins:
   - **⚔ Damage** — more damage per shot.
   - **⚡ Fire Rate** — cannons shoot faster.
   - **➕ Cannon** — add a turret (up to 8).
   - **💰 Coin Boost** — more coins per kill.
4. **Clear the wave's quota** to advance. Every **10th wave is a BOSS** — one
   huge dot you must destroy.
5. **Defend the Base** — dots that reach the bottom damage it. If it falls you
   *regroup a few waves back* and refill — there's no permanent game over.

## Controls

- **Speed slider (1×–5×)** fast-forwards the assault: faster coins, but the
  swarm presses harder (fire rate stays real-time).
- **Tap a dot** to blast it yourself.
- **Pause** any time; progress (coins, wave, upgrades, best wave) is saved to
  `localStorage` and resumes next visit.

## Why it lasts

Enemy health grows exponentially per wave while your damage grows from upgrades
you can only afford as fast as coins come in — so you naturally stall, grind,
upgrade, and push deeper. The wave counter climbs indefinitely.

## Project layout

```
index.html   Single screen: HUD, shop, menus
style.css    Theme + layout (responsive, mobile-friendly)
js/engine.js Canvas, math, camera shake, particles, floating text, input
js/audio.js  Procedural Web Audio SFX + ambient
js/game.js   The whole game: dots, cannons, waves, bosses, shop, save, loop
icon.svg     App icon
```

Everything runs client-side in a single `requestAnimationFrame` loop.
