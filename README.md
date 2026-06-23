# Idle Dot Shooter

A focused **idle shooter** built with **HTML5, JavaScript and Canvas** — no
dependencies, no asset files (graphics are drawn procedurally, sound is
synthesized). Open `index.html` and play.

Dots fall from the top. Your cannons auto-fire at the nearest one. Kills pay
**coins**. Spend coins on a handful of upgrades whose costs rise each level.
Waves scale **exponentially**, so progression is a long, satisfying grind.

## Core loop

1. **Dots descend** — health grows every wave and every city.
2. **Cannons auto-fire** at the nearest dot; kills grant coins.
3. **Upgrade** with coins (costs rise each level):
   - **⚔ Damage** · **⚡ Fire Rate** · **➕ Cannon** (up to 8) · **💰 Coin Boost**.
4. **Climb the city.** Each **city is 30 waves**; every 10th wave is a boss and
   wave 30 is the **City Boss**. Beat it to **unlock the next city** (a step
   harder — ~3× tougher dots).
5. **Everything carries over.** Your cannons, all upgrades and coins persist
   from city to city forever — so you stomp the early waves of a new city, then
   hit the wall and grind deeper.
6. **Defend the Base** — leaked dots damage it. If it falls you *regroup a few
   waves back* (loadout intact) — never a permanent game over.

Cities are long by design — enemy health outpaces raw damage, so each one is a
sustained grind of many waves and bosses before it falls.

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
