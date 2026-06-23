# HIVE WORLDS — Galactic Tower Defense

A complete, polished browser tower-defense game built entirely with **HTML5,
JavaScript and Canvas** — **zero dependencies, zero asset files**. Every visual
is hand-authored procedural art and every sound is synthesized at runtime with
the Web Audio API. Just open `index.html` and play (desktop or mobile).

Crystalline **Sentinel** defenders hold the line against the organic **Hive**.
Build a grid of turrets, fill each world's conquest meter to 100%, defeat the
boss, and take the galaxy planet by planet.

## Play

Open `index.html` in any modern browser, or play the hosted build (see *Hosting*).

## Features

### Worlds & progression
- **Three galaxies → six solar systems → eighteen planets**, each its own level.
- A **zoomable star map** (Universe → Galaxy → System) with animated **fly-in /
  fly-out** zoom transitions, spiral galaxies, flaring suns and shaded, rotating
  pseudo-3D planets that light up as you conquer them.
- **Persistent save** (localStorage): conquest, unlocked worlds, Cores and tech.

### The battle
- **Grid placement** — pick a defender, tap a cell to deploy; **hold & drag** to
  relocate any turret.
- **Five defender types**, each a distinct animated sprite & playstyle:
  Pulse (rapid), Lance (railgun sniper), Mortar (splash), Cryo (slows), Arc
  (chain lightning).
- **Per-defender skill trees** (7 nodes each, branching) plus **target priority**
  (First / Close / Strong / Fast / Weak) and sell-for-refund.
- **Seven enemy species**, each with bespoke art, animation and abilities:
  Crawler, Runner (dashes), Brute (armored), Shielded (regen shield), Flyer
  (flapping), Splitter (bursts into minis), Healer (heals the swarm).
- **A boss finale on every world** — Broodmother, Colossus or Leviathan — with a
  weak-point core, a dedicated health bar, and summon abilities.
- **The Nexus** — your animated home core. Enemies that slip past your turrets
  chip its integrity, which (with turret damage) lowers **Efficiency** and slows
  your conquest. There is no game-over — only faster or slower victory.

### Economy & pacing
- **Speed slider (1×–6×)** scales the swarm, conquest and a matching **reward
  multiplier**. Fire rate stays fixed, so speed buys progress and energy in
  exchange for pressure.
- **Cores** earned by conquering feed a **persistent meta tech tree** — permanent
  bonuses to damage, fire rate, range, hull, economy and Nexus integrity.

### Game feel
- Screen shake, **hit-stop** on big kills, hit-flash, recoil, muzzle flashes,
  bullet trails, explosions & shockwave rings, debris, smoke.
- **Combo streaks**, arcing damage numbers, energy pickups, placement pops.
- Screen flashes & damage vignette, parallax starfield + nebula, a CRT-style
  finish, and a fully procedural soundtrack + SFX.

## Project layout

```
index.html      Screens, HUD and module <script> tags
style.css       Cohesive sci-fi UI theme (responsive)
js/engine.js    Canvas, math, easing, tweens, camera (shake/hit-stop),
                particles, floating text, input
js/audio.js     Procedural Web Audio SFX + ambient music
js/data.js      Galaxies, defenders + skill trees, enemies, bosses, tech tree
js/art.js       All procedural artwork (backgrounds, planets, towers, enemies)
js/map.js       Star map with zoom transitions
js/battle.js    Battle simulation, rendering, grid, bosses, economy, juice
js/ui.js        Menus, HUD, defender panel, tech tree
js/main.js      Save system, state machine, master loop
icon.svg        App icon
```

Everything runs client-side in a single `requestAnimationFrame` loop — no
server, bundler, or downloads.

## Hosting

The game is static, so GitHub Pages can serve it directly: **Settings → Pages →
Deploy from a branch → `claude/html5-tower-defense-5izjr2` / root**. It will be
playable at `https://joelllllln.github.io/ignore/`.
