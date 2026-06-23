# Idle Dot Shooter

An idle/incremental space shooter built with **HTML5, JavaScript and Canvas** —
no dependencies, no build step. Open `index.html` and play. Visuals are simple
placeholder shapes; the focus is the full idle systems loop.

You command a single auto-firing turret in the void. Dots drift in, your guns
pop them, a drone vacuums up the cash they drop, and you pour that cash into
upgrades across three tabs. Travel galaxies for tougher dots and bigger payouts;
reach Galaxy 10 to **Rebirth** for permanent **Star Dust** upgrades.

## The loop

Dots spawn → turret + weapons + marines auto-fire at the nearest ones → dots pop
and drop cash → the **drone** collects it (capped by **Capacity**) → spend on
upgrades → the rhythm shifts → travel / trigger an ability for a burst.

## Three upgrade tabs

- **Defence** — Fire Rate, Damage, Critical Hits, **Marines** (extra fire
  streams), **Mortar** (splash), **Plasma** (heavy single-target). Multiple
  weapons fire in rotation.
- **Drone** — Speed, Suction (pull radius), Agility, Collector Size. Sets how
  much of your earned cash you actually pick up.
- **Economy** — Capacity (cash ceiling), Value (cash per dot), Spawn Rate
  (more targets), Luck (chance of high-value special dots). These multiply the
  other two pillars, so keep all three in step.

## Big-Moment abilities

- **⚡ Frenzy** — massive fire-rate burst for a few seconds.
- **▽ Dot Rain** — floods the field with targets.
- **◉ Black Hole** — drags every dot to the centre and crushes them.

Each runs on a cooldown — save them for dense or high-value screens.

## Galaxies, Rebirth & Star Dust

- **Travel** to the next galaxy (a cash spend): dots get tougher *and* worth
  more. Income ceilings rise with difficulty.
- At **Galaxy 10**, **Rebirth**: reset the run (cash & upgrades wiped) to bank
  **Star Dust**, then buy permanent upgrades (damage, income, fire rate,
  head-start cash) that carry into every future run — so each run starts
  stronger and reaches Galaxy 10 faster.

## Idle & offline

- Cash keeps flowing with zero input. **Offline earnings**: while you're away
  your turret "keeps firing" — on return you collect a capped share (up to 8h)
  of your recent coins-per-second, shown on a Welcome-back screen.
- Everything autosaves to `localStorage`.

## Project layout

```
index.html   HUD (cash/galaxy/star dust), dock (abilities, tabs, upgrade list),
             modals (Star Dust shop, Rebirth, Welcome-back, menu)
style.css    Layout + theme (responsive, mobile-friendly)
js/game.js   The whole game: dots, turret/weapons/marines, drone, upgrades,
             abilities, galaxies, Rebirth/Star Dust, offline, save, loop
icon.svg     App icon
```

Tap a dot to pop it yourself. Everything runs client-side in one
`requestAnimationFrame` loop.
