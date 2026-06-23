# Hive Worlds

A browser **tower-defense progression** game built entirely with **HTML5, JavaScript,
and Canvas** — no build step, no dependencies. Open `index.html` and play.

You advance through a series of **worlds**, each holding a fixed-size swarm of enemies
(the **hive**). Enemies crawl toward your towers and chip away at them; your towers
auto-fire back. Fill each world's **completion meter** to 100% to unlock the next world.

## How to play

Just open `index.html` in any modern browser (desktop or mobile). Press **Enter World 1**
and defend.

## Core loop

1. **Enter a world** — the hive begins spawning.
2. **Enemies move toward your towers** and damage them on contact.
3. **Towers auto-fire** at the nearest enemy.
4. **Adjust speed and tap** the battlefield to influence the fight.
5. **World completion climbs** as you defeat the hive (plus a passive trickle).
6. At **100%**, advance to the **next world** — tougher, faster, with a bigger hive.

## Mechanics

- **No game over.** Towers can be knocked offline, but that never ends the run.
  Instead, damaged towers drop your **Efficiency**, which throttles both completion
  gain and energy income — so damage *slows progression* rather than killing you.
- **Speed slider (1×–5×).** Higher speed = faster spawns, faster completion, and more
  **Energy** per kill — but a fiercer, faster swarm pressing your towers.
- **Tap to assist.** Tap/click anywhere on the battlefield to unleash an area strike
  that damages nearby enemies.
- **Energy economy.** Kills grant Energy. Spend it on:
  - **+ Tower** — add a turret to your defensive line (up to 8).
  - **⚔ Damage** — more damage per shot.
  - **⚡ Fire Rate** — towers shoot faster.
  - **✚ Repair** — fully restore all towers (restores Efficiency).
- **Worlds scale.** Each world raises hive size, enemy HP, speed, damage, and spawn
  rate. Six themed worlds, then an endless continuation.

## Project layout

```
index.html   Markup, HUD, completion meter, controls, start/clear overlay
style.css    Layout and theming (responsive, mobile-friendly)
game.js      All game logic: worlds, spawning, towers, bullets, enemies,
             completion/efficiency, economy, FX, and the render/update loop
icon.svg     App icon
```

Everything runs client-side in a single `requestAnimationFrame` loop; no server,
bundler, or assets required.
