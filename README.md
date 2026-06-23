# Idle Dot Shooter

An **HTML5 / Canvas** port of the original *Idle Dot Shooter* (Godot 4.6) — a
faithful 1:1 recreation of every mechanic, formula, colour and the UI layout.
No dependencies, no build step: open `index.html` and play.

Colored **dots** descend from the top and drift toward your line of **cannons**
at the bottom. Cannons auto-target and fire at the nearest dot. Destroying dots
earns **coins**, which you spend on upgrades. Let too many dots breach the wall
and it's game over.

## Controls / UI

- **Speed / Difficulty slider** (top): drag to scale dot speed *and* spawn rate
  live (0.5×–3.0×). Higher = more pressure and faster waves.
- **Upgrades** (right panel):
  - **Damage** — `2 + 1.5·level` damage per bullet.
  - **Fire Rate** — `1.2 + 0.25·level` shots/sec (capped at 14).
  - **Add Cannon** — adds a turret to the line (up to 10), spread evenly.
  - **Reinforce Wall** — +10 max wall HP and a full repair.
- **Stats** (top-left): coins, wall HP, wave, kills, cannon count.
- On game over, press **Restart**.

## Mechanics (exact)

- Dots get tougher and spawn faster the longer you survive — a new tier every
  ~12s (`hp = 3 + 2.5·tier + 0.05·elapsed`, speed `40 + 0.22·elapsed`).
- Spawn interval `clamp(1.4 − 0.01·elapsed, 0.32, 1.4) / difficulty`.
- Bigger/tankier dots hit the wall harder if they breach (`ceil(maxHp / 6)`).
- The difficulty multiplier scales both descent speed and spawn rate.

## Project layout

```
index.html   Canvas + UI (slider, stats, upgrades, game-over), scaled to fit
style.css    UI styled in the original's 1152×648 logical layout
js/game.js   The whole game (spawning, cannons, bullets, wall, upgrades, draw)
icon.svg     App icon
```

The play field is the original's logical **1152×648**, letterboxed to fit any
window. Everything runs client-side in a single `requestAnimationFrame` loop.
