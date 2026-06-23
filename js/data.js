/* =====================================================================
   HIVE WORLDS — data.js
   All static game definitions: galaxies/planets, defenders + skill trees,
   enemy species + bosses, the persistent tech tree, palettes.
   ===================================================================== */

/* ----------------------------- palette --------------------------- */
const PAL = {
  sentinel: "#4ff0d0", sentinel2: "#7ab8ff", sentinelHi: "#d7fbff",
  steel: "#1b2a38", steelHi: "#2c4256",
  gold: "#ffd45e", warn: "#ff5a6a", good: "#67e89a",
  ink: "#060912", text: "#d7e6f0", dim: "#6f8699",
};

/* --------------------- galaxies / systems / planets --------------- */
const GALAXIES = [
  { name: "Andromeda Verge", hue: 168, nebula: ["#0c3a3a", "#06121f"], systems: [
    { name: "Sol Prime", star: "#ffd45e", boss: "broodmother", planets: [
      { name: "Verda",   biome: ["#56c878", "#1c6b3e"], surface: "#123524" },
      { name: "Cindros", biome: ["#ff9d4d", "#a8501c"], surface: "#3a1e10" },
      { name: "Aquon",   biome: ["#4db8ff", "#1c5ba8"], surface: "#0e2a45" },
    ]},
    { name: "Cygnus Gate", star: "#7ab8ff", boss: "colossus", planets: [
      { name: "Frostholm", biome: ["#bdf2ff", "#4d8ca8"], surface: "#16323f" },
      { name: "Dunsea",    biome: ["#e7cc77", "#a8853c"], surface: "#3a3016" },
      { name: "Mycera",    biome: ["#c98cff", "#6b3ca8"], surface: "#2a1640" },
    ]},
  ]},
  { name: "Crimson Reach", hue: 6, nebula: ["#3a0c12", "#1f0608"], systems: [
    { name: "Ember Cross", star: "#ff7a4d", boss: "broodmother", planets: [
      { name: "Pyros",   biome: ["#ff6b5a", "#8a2418"], surface: "#3a1212" },
      { name: "Ashen",   biome: ["#b06b5a", "#3a1c16"], surface: "#241410" },
      { name: "Magmara", biome: ["#ffb04d", "#a83c1c"], surface: "#3a1e0e" },
    ]},
    { name: "Bloodstar", star: "#ff5577", boss: "colossus", planets: [
      { name: "Vermil", biome: ["#ff5577", "#8a1c3c"], surface: "#3a1020" },
      { name: "Crava",  biome: ["#d94d8c", "#6b1c4d"], surface: "#2e1028" },
      { name: "Scorne", biome: ["#ff8c6b", "#8a3018"], surface: "#3a1810" },
    ]},
  ]},
  { name: "Violet Expanse", hue: 280, nebula: ["#26083a", "#0e0620"], systems: [
    { name: "Nebula Heart", star: "#c98cff", boss: "broodmother", planets: [
      { name: "Lumia",  biome: ["#c98cff", "#5a2ca8"], surface: "#22103a" },
      { name: "Xenth",  biome: ["#8c6bff", "#3c2c8a"], surface: "#161232" },
      { name: "Orphea", biome: ["#a8c8ff", "#3c5ba8"], surface: "#101e3a" },
    ]},
    { name: "Void Crown", star: "#7affd4", boss: "leviathan", planets: [
      { name: "Cryx",   biome: ["#7affd4", "#1c8a6b"], surface: "#0e2e26" },
      { name: "Nethys", biome: ["#6bff9d", "#1c8a4d"], surface: "#0e2e1c" },
      { name: "Omega",  biome: ["#ffffff", "#7a7aff"], surface: "#1a1a3a" },
    ]},
  ]},
];

// Flatten into an ordered planet list with global indices.
const PLANETS = [];
GALAXIES.forEach((g, gi) => g.systems.forEach((s, si) => s.planets.forEach((p, pi) => {
  PLANETS.push({ gi: PLANETS.length, galaxy: gi, system: si, planet: pi, ref: p, sysRef: s, galRef: g,
                 isSystemEnd: pi === s.planets.length - 1 });
})));

// Every planet is broken into CITIES — each city is a battle ("liberate the
// city"). Conquering every city liberates the planet. Cities are placed at
// deterministic lat/lon on the globe so their markers stay put.
function srand(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const CITY_PARTS = ["Haven", "Bastion", "Reach", "Spire", "Hollow", "Forge", "Vale", "Crest", "Drift", "Keep", "Cross", "Port", "Watch", "Gate", "Ridge", "Mere", "Hold", "Span", "Anvil", "Verge"];
const CITIES = [];
PLANETS.forEach(P => {
  const rng = srand((P.gi + 1) * 97 + 13);
  const n = 4 + Math.floor(rng() * 3);          // 4–6 cities per planet
  P.cities = [];
  const used = {};
  for (let i = 0; i < n; i++) {
    const lat = (rng() * 130 - 65) * Math.PI / 180;
    const lon = (rng() * 360 - 180) * Math.PI / 180;
    const capital = i === n - 1;
    let nm; do { nm = CITY_PARTS[Math.floor(rng() * CITY_PARTS.length)]; } while (used[nm]); used[nm] = 1;
    const city = { ci: CITIES.length, planet: P, idx: i, lat, lon, capital,
      name: capital ? nm + " Capital" : nm + " " + ["Outpost", "Sector", "District", "Colony", "Station"][i % 5] };
    CITIES.push(city); P.cities.push(city);
  }
});

// Long, idle-shooter style levels: you grind down a large hive while income and
// upgrades compound. Difficulty scales with the planet index, size with the city.
function cityConfig(city) {
  const d = city.planet.gi;
  return {
    hive: 160 + d * 70 + city.idx * 40,     // ~160 early → 1000s late
    hpMul: 1 + d * 0.28,
    speed: 20 + d * 1.8,
    dmgMul: 1 + d * 0.12,
    spawn: Math.max(0.18, 0.7 - d * 0.025),
    maxAlive: 44,                            // concurrent cap (perf + steady grind)
    boss: city.capital,
  };
}
function planetCityProgress(P) { let done = 0; for (const c of P.cities) if (progress.conquered[c.ci]) done++; return { done, total: P.cities.length }; }

/* ----------------------------- defenders ------------------------- */
// base stats; skill tree nodes mutate a tower instance permanently.
const TOWER_TYPES = {
  blaster: {
    name: "Pulse", color: "#4ff0d0", cost: 45, shape: "hex",
    base: { range: 178, damage: 9, fireRate: 1.7, projSpeed: 480, splash: 0, slowMul: 1, slowDur: 0, chain: 0, crit: 0.05 },
    blurb: "Rapid twin-barrel turret. Cheap and dependable.",
    tree: [
      { id: "hr", name: "Heavy Rounds", desc: "+6 DMG", cost: 30, req: [], apply: t => t.damage += 6 },
      { id: "ds", name: "Depleted Slugs", desc: "+11 DMG", cost: 60, req: ["hr"], apply: t => t.damage += 11 },
      { id: "al", name: "Auto-Loader", desc: "+0.6 rate", cost: 30, req: [], apply: t => t.fireRate += 0.6 },
      { id: "oc", name: "Overclock", desc: "+1.0 rate", cost: 75, req: ["al"], apply: t => t.fireRate += 1.0 },
      { id: "lb", name: "Long Barrel", desc: "+60 range", cost: 35, req: [], apply: t => t.range += 60 },
      { id: "cr", name: "Targeting AI", desc: "+15% crit", cost: 70, req: ["lb"], apply: t => t.crit += 0.15 },
      { id: "tc", name: "Twin Cannon", desc: "+1.2 rate, +6 DMG", cost: 130, req: ["hr", "al"], apply: t => { t.fireRate += 1.2; t.damage += 6; } },
    ],
  },
  sniper: {
    name: "Lance", color: "#ffd45e", cost: 85, shape: "tri",
    base: { range: 370, damage: 36, fireRate: 0.55, projSpeed: 1100, splash: 0, slowMul: 1, slowDur: 0, chain: 0, crit: 0.2 },
    blurb: "Long-range railgun. Massive single-target hits.",
    tree: [
      { id: "ap", name: "AP Core", desc: "+18 DMG", cost: 40, req: [], apply: t => t.damage += 18 },
      { id: "rg", name: "Railgun", desc: "+44 DMG", cost: 95, req: ["ap"], apply: t => t.damage += 44 },
      { id: "sc", name: "Scope", desc: "+130 range", cost: 40, req: [], apply: t => t.range += 130 },
      { id: "ee", name: "Eagle Eye", desc: "+90 range, +16 DMG", cost: 105, req: ["sc"], apply: t => { t.range += 90; t.damage += 16; } },
      { id: "rb", name: "Rapid Bolt", desc: "+0.4 rate", cost: 65, req: [], apply: t => t.fireRate += 0.4 },
      { id: "mc", name: "Marksman", desc: "+25% crit", cost: 80, req: ["ap"], apply: t => t.crit += 0.25 },
      { id: "hs", name: "Headshot", desc: "+75 DMG", cost: 170, req: ["ap", "rg"], apply: t => t.damage += 75 },
    ],
  },
  cannon: {
    name: "Mortar", color: "#ff8c5a", cost: 90, shape: "dome",
    base: { range: 205, damage: 17, fireRate: 0.7, projSpeed: 300, splash: 52, slowMul: 1, slowDur: 0, chain: 0, crit: 0.05, arc: true },
    blurb: "Lobs explosive shells. Splash damage.",
    tree: [
      { id: "bs", name: "Bigger Shells", desc: "+12 DMG", cost: 40, req: [], apply: t => t.damage += 12 },
      { id: "wb", name: "Wide Blast", desc: "+24 splash", cost: 50, req: [], apply: t => t.splash += 24 },
      { id: "cl", name: "Cluster", desc: "+18 splash, +8 DMG", cost: 115, req: ["wb"], apply: t => { t.splash += 18; t.damage += 8; } },
      { id: "ff", name: "Fast Fuse", desc: "+0.4 rate", cost: 50, req: [], apply: t => t.fireRate += 0.4 },
      { id: "ho", name: "Heavy Ord", desc: "+22 DMG", cost: 105, req: ["bs"], apply: t => t.damage += 22 },
      { id: "sf", name: "Shrapnel", desc: "Slows hit foes", cost: 80, req: ["wb"], apply: t => { t.slowMul = 0.6; t.slowDur = 1.0; } },
      { id: "cb", name: "Carpet Bomb", desc: "+42 splash", cost: 170, req: ["cl"], apply: t => t.splash += 42 },
    ],
  },
  frost: {
    name: "Cryo", color: "#7ad0ff", cost: 70, shape: "spire",
    base: { range: 168, damage: 5, fireRate: 1.2, projSpeed: 440, splash: 0, slowMul: 0.55, slowDur: 1.5, chain: 0, crit: 0 },
    blurb: "Chills the swarm — slows everything it hits.",
    tree: [
      { id: "dc", name: "Deep Chill", desc: "Stronger slow", cost: 40, req: [], apply: t => t.slowMul = Math.max(0.18, t.slowMul - 0.18) },
      { id: "lf", name: "Long Freeze", desc: "+1.2s slow", cost: 40, req: [], apply: t => t.slowDur += 1.2 },
      { id: "fb", name: "Frost Bite", desc: "+8 DMG", cost: 40, req: [], apply: t => t.damage += 8 },
      { id: "gl", name: "Glacier", desc: "+72 range", cost: 50, req: [], apply: t => t.range += 72 },
      { id: "ic", name: "Ice Shards", desc: "+0.6 rate", cost: 65, req: ["fb"], apply: t => t.fireRate += 0.6 },
      { id: "az", name: "Absolute Zero", desc: "Near-freeze + DMG", cost: 145, req: ["dc", "lf"], apply: t => { t.slowMul = 0.1; t.damage += 12; } },
      { id: "sh", name: "Shatter", desc: "+16 DMG", cost: 95, req: ["fb"], apply: t => t.damage += 16 },
    ],
  },
  tesla: {
    name: "Arc", color: "#b98cff", cost: 115, shape: "coil",
    base: { range: 188, damage: 12, fireRate: 1.1, projSpeed: 0, splash: 0, slowMul: 1, slowDur: 0, chain: 2, crit: 0.05 },
    blurb: "Chain lightning that leaps between foes.",
    tree: [
      { id: "cd", name: "Conductor", desc: "+1 chain", cost: 50, req: [], apply: t => t.chain += 1 },
      { id: "hv", name: "High Voltage", desc: "+9 DMG", cost: 40, req: [], apply: t => t.damage += 9 },
      { id: "am", name: "Arc Master", desc: "+2 chain, +40 range", cost: 115, req: ["cd"], apply: t => { t.chain += 2; t.range += 40; } },
      { id: "cp", name: "Capacitor", desc: "+0.7 rate", cost: 65, req: [], apply: t => t.fireRate += 0.7 },
      { id: "ov", name: "Overload", desc: "+18 DMG", cost: 115, req: ["hv"], apply: t => t.damage += 18 },
      { id: "rs", name: "Resonator", desc: "+0.9 rate", cost: 95, req: ["cp"], apply: t => t.fireRate += 0.9 },
      { id: "st", name: "Tempest", desc: "+3 chain", cost: 175, req: ["am"], apply: t => t.chain += 3 },
    ],
  },
};
const TOWER_ORDER = ["blaster", "sniper", "cannon", "frost", "tesla"];

const PRIORITIES = [
  { id: "first", label: "First" },
  { id: "close", label: "Close" },
  { id: "strong", label: "Strong" },
  { id: "fast", label: "Fast" },
  { id: "weak", label: "Weak" },
];

/* ----------------------------- enemies --------------------------- */
const ENEMY_TYPES = {
  crawler:  { name: "Crawler",  hp: 1.0, spd: 1.0, size: 1.0, dmg: 1.0, color: "#9be86a", core: "#e9ffb0" },
  runner:   { name: "Runner",   hp: 0.6, spd: 1.9, size: 0.8, dmg: 0.7, color: "#ffe96b", core: "#fff6c0", dash: true },
  brute:    { name: "Brute",    hp: 3.4, spd: 0.55,size: 1.8, dmg: 2.3, color: "#ff8c5a", core: "#ffd0a0", armor: true },
  shielded: { name: "Shielded", hp: 1.3, spd: 0.9, size: 1.1, dmg: 1.1, color: "#7ad0ff", core: "#d0f0ff", shield: 1.3 },
  flyer:    { name: "Flyer",    hp: 0.8, spd: 1.5, size: 0.9, dmg: 0.9, color: "#d79bff", core: "#f0d0ff", fly: true },
  splitter: { name: "Splitter", hp: 1.7, spd: 0.85,size: 1.35,dmg: 1.0, color: "#7affc0", core: "#d0ffe8", split: 3 },
  healer:   { name: "Healer",   hp: 1.6, spd: 0.8, size: 1.05,dmg: 0.6, color: "#ff9bd0", core: "#ffd0e8", heal: true },
};
const BOSSES = {
  broodmother: { name: "Broodmother", hp: 42, spd: 0.45, size: 3.4, dmg: 3, color: "#b8ff5a", core: "#eaffc0", spawns: "crawler" },
  colossus:    { name: "Colossus",    hp: 70, spd: 0.4,  size: 4.0, dmg: 4, color: "#ff7a5a", core: "#ffd0b0", armor: true },
  leviathan:   { name: "Leviathan",   hp: 120,spd: 0.5,  size: 4.4, dmg: 5, color: "#9b6bff", core: "#e0d0ff", shield: 1.5, spawns: "runner" },
};
function availableSpecies(idx) {
  const list = ["crawler", "runner"];
  if (idx >= 2) list.push("brute");
  if (idx >= 3) list.push("shielded");
  if (idx >= 5) list.push("flyer");
  if (idx >= 7) list.push("splitter");
  if (idx >= 9) list.push("healer");
  return list;
}

/* --------------------------- meta tech tree ---------------------- */
// Persistent across runs; bought with Cores earned by conquering planets.
const TECH = [
  { id: "dmg1",  name: "Weapon Calibration", desc: "+8% all defender damage", cost: 2, col: 0, row: 0, req: [], fx: { dmg: 0.08 } },
  { id: "dmg2",  name: "Munitions Lab",      desc: "+12% all defender damage", cost: 5, col: 0, row: 1, req: ["dmg1"], fx: { dmg: 0.12 } },
  { id: "rate1", name: "Servo Actuators",    desc: "+8% fire rate", cost: 2, col: 1, row: 0, req: [], fx: { rate: 0.08 } },
  { id: "rate2", name: "Coolant Systems",    desc: "+12% fire rate", cost: 5, col: 1, row: 1, req: ["rate1"], fx: { rate: 0.12 } },
  { id: "rng1",  name: "Optics Array",       desc: "+12% range", cost: 3, col: 2, row: 0, req: [], fx: { range: 0.12 } },
  { id: "hp1",   name: "Hull Plating",       desc: "+25% defender HP", cost: 3, col: 3, row: 0, req: [], fx: { hp: 0.25 } },
  { id: "eco1",  name: "Salvage Drones",     desc: "+15% energy income", cost: 3, col: 4, row: 0, req: [], fx: { eco: 0.15 } },
  { id: "eco2",  name: "Reactor Boost",      desc: "+40 starting energy", cost: 4, col: 4, row: 1, req: ["eco1"], fx: { startE: 40 } },
  { id: "core1", name: "Nexus Shielding",    desc: "+50% Nexus integrity", cost: 4, col: 5, row: 0, req: [], fx: { core: 0.5 } },
];
function techBonus(progress) {
  const b = { dmg: 1, rate: 1, range: 1, hp: 1, eco: 1, startE: 0, core: 1 };
  for (const t of TECH) {
    if (progress.tech && progress.tech[t.id]) {
      if (t.fx.dmg) b.dmg += t.fx.dmg;
      if (t.fx.rate) b.rate += t.fx.rate;
      if (t.fx.range) b.range += t.fx.range;
      if (t.fx.hp) b.hp += t.fx.hp;
      if (t.fx.eco) b.eco += t.fx.eco;
      if (t.fx.startE) b.startE += t.fx.startE;
      if (t.fx.core) b.core += t.fx.core;
    }
  }
  return b;
}
