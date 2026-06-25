# Idle Dot Shooter

A hardcore idle/incremental space shooter built with **HTML5, JavaScript and
Canvas** — no dependencies, no build step. Open `index.html` and play. The art
is deliberately minimalist black-and-white, but the field is heavily *juiced*
(particles, screen shake, recoil, floating cash); the focus is a deep idle
systems loop where **your firepower IS your economy**.

You command a growing rack of auto-firing defenders in the void. Dots drift in,
your guns chew through them, collectors vacuum up the cash they drop, and you
pour that cash into upgrades, skill trees and new unit classes. Travel galaxies
for tougher dots and bigger payouts; reach Galaxy 10 to **Rebirth** for
permanent **Star Dust** upgrades.

## The core loop

Dots spawn → your defenders auto-fire at the nearest ones (spreading fire to
avoid overkill) → dots pop and drop cash orbs → **collectors** gather them
(capped by **Capacity**) → spend on upgrades, skill trees and new units → kills
come faster → travel / trigger an ability for a burst.

**Dots are tanky.** More damage = faster kills = more income, so your defenders
and their skill trees *are* your economy — you can't just spam the economy tab.

## You choose the difficulty (and the reward)

Dot difficulty and craziness are driven by how much you invest in **Value**:

- **At Value 0, every dot is the plainest tier-0 grey** — simple and quick to
  kill, low payout.
- As you pour cash into **Value**, dots roll tougher: more health, more elaborate
  visuals (spikes & rings), and they pay proportionally more.
- High Value unlocks **armored elites** (double-ringed, huge defense, heavy slow
  loot) and a roster of **exotic dot kinds** — each also gated by galaxy:
  - **Swift** / **Zigzag** — fast & erratic
  - **Splitter** — bursts into two on death
  - **Orbiter** — ringed by satellites
  - **Shielded** — soaks & reflects shots (keep firing)
  - **Pulsar** — throbs and emits shock rings
  - **Regenerator** — heals unless under fire
  - **Phantom** — phases out to dodge damage

The tougher a dot, the more spikes and rings it grows, so you can read its
threat at a glance.

## Defenders & per-class skill trees

Buy multiple defender classes (each capped, galaxy-gated) in the **DEFENCE** tab:
**Turret → Mortar (splash) → Plasma (heavy) → Laser (rapid) → Railgun (huge
single hits)**. Units auto-rack into a tidy formation that re-arranges as the
count grows, and fire simultaneously.

Tap any defender (or **⬆ Tree**) to open its **skill tree** — a unique,
interconnected node map per class:

- Allocate outward from the centre; each node needs a **connected** node first.
- Every node is named, shows an icon of what it upgrades, and a tap reveals a
  detail panel with a before/after stat preview.
- Stats **compound** (each node multiplies), so deep trees scale hard.
- ✦ **Keystones** are transformative: they turn turrets into machine-guns **and**
  grant **multishot** — every unit of that class fires at one extra simultaneous
  target per keystone.
- Costs climb steeply along a tree (keystones cost far more than passives), so
  plan your route. Every unit of a class shares its tree.
- Passive nodes give a solid (but sub-runaway) multiplier; **majors** and
  **keystones** are where the real spikes live. A full **Turret** tree lands around
  a ~700× DPS multiplier — strong, but no longer the ×100,000 runaway it briefly was.

### Buying more units

Extra defenders/collectors are a **major, paced expense**, not pocket change. Each
new unit costs a rising fraction of the **travel cost of the galaxy where its class
unlocks** — roughly **15% → 30% → 45%** of that galaxy's grind for your 2nd/3rd/4th.
So in Galaxy 1 a 2nd turret is ~$1.8B, a 3rd ~$3.6B, a 4th ~$5.4B (travel itself is
$12B): you unlock your roster *as you progress through the galaxy*, not all at once.

## Collectors

The **COLLECTORS** tab gathers the cash orbs dots drop. Buy more and unlock new
classes as you travel: **Drone → Drone Swarm → Collector → Magnet → Tractor →
Singularity** (a black hole that slowly drags every orb, and nearby dots,
inward). Each collector class has its **own skill web** (Speed / Suction /
Yield / **Ingest**).

Collectors are about **speed and agility**, not becoming stationary magnets:

- **Speed** is the headline stat (capped so a maxed drone is fast & agile, not so
  fast it teleports *past* orbs). You can now field up to **4 drones**.
- **Suction** (the pull/ring radius) grows *gently* and is **hard-capped well under
  the field**, so a collector always has to keep roaming to cover it.
- **Ingest** (the 4th branch) is **how fast a collector swallows loot**. Big kills
  drop **heavy loot** a collector must sit on and consume (watch the ring fill) —
  small dots are instant, fat ones tie a collector up, so Ingest matters most there.
- **Yield** multiplies cash per orb.

## Economy

The **ECONOMY** tab multiplies the other pillars:

- **Value** — a gentle **+5% cash per dot** per level, and the difficulty/craziness
  dial (see above): the main reason to invest is ramping dot *menace* — tougher dots,
  armored elites and exotic kinds — not raw income.
- **Spawn Rate** — more dots per second. With Value softened, this is now a
  primary income lever (more targets → more kills → more cash), up to the
  on-screen cap — lean on it and your collectors to keep up.
- **Capacity** — your cash ceiling (raise it before big purchases).
- **Luck** — a slow **+0.1% per level** chance of rare high-value **special** dots (~9× cash).

## Big-Moment abilities

- **⚡ Frenzy** — massive fire-rate burst for a few seconds.
- **▽ Dot Rain** — floods the field with targets.
- **◉ Black Hole** — drags every dot to the centre and crushes them.

Each runs on a cooldown — save them for dense or high-value screens.

## Galaxies, pacing, Rebirth & Star Dust

- The **Star Map** is interactive: 10 galaxies orbit a central black hole, each
  on its own white orbital trajectory, slowly drifting. Drag to rotate, scroll/
  pinch to zoom, tap a galaxy to inspect or travel.
- **Travel** to the next galaxy is a large cash spend on a **super-exponential**
  curve — this is a deliberately **hardcore, multi-day** game. The first jump is
  on the order of ~12 billion cash and each subsequent jump escalates sharply
  (hours → days → weeks → months of idle progress for later galaxies).
- At **Galaxy 10**, **Rebirth**: reset the run (cash & upgrades wiped) to bank
  **Star Dust**, then buy permanent upgrades (damage, income, fire rate,
  head-start cash) that carry into every future run.

## Idle, offline & saving

- Cash keeps flowing with zero input. **Offline earnings**: while away your
  defenders "keep firing" — on return you collect a capped share of your recent
  coins-per-second, shown on a Welcome-back screen.
- Everything autosaves to `localStorage`. **Reset Save** fully wipes progress.
- **Draw across the field** to blast dots yourself.
- Info (ⓘ) buttons sit on nearly every system, and the **▁▄█ Metrics** panel
  tracks economy, combat, kills, armored killed, cash lost, and more.

## Project layout

```
index.html   HUD (cash/galaxy/star dust), dock (abilities, tabs, upgrade list),
             modals (skill tree, star map, Star Dust shop, Rebirth,
             Welcome-back, info, metrics, menu)
style.css    Minimalist B&W theme, reactive button feel, modal & map styles
js/game.js   The whole game: dots & dot kinds, defender classes & formation,
             per-class skill trees, collectors, economy, abilities, galaxies,
             Rebirth/Star Dust, juice (particles/shake/flash), offline,
             save, single requestAnimationFrame loop
icon.svg     App icon
tools/       Headless balancing aids (run with Node):
  balance-check.js   audits economy upgrade cost-vs-effect ratios for
                     infinite-money exploits
  pacing-sim.js      models an optimal idle player and reports days-to-reach
                     each galaxy, used to tune the travel-cost curve
```

Everything runs client-side in one `requestAnimationFrame` loop.

## Dev tools

```bash
node --check js/game.js     # syntax check
node tools/balance-check.js # economy exploit audit (should PASS)
node tools/pacing-sim.js    # days-to-galaxy pacing report
```
