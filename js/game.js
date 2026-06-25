/* =====================================================================
   IDLE DOT SHOOTER  (HTML5/Canvas, original implementation)
   Defenders are individual units, each with its own upgrade tree (tap to
   open). Drones are a coordinated collection fleet. Galaxies scale dot
   count + toughness. Rebirth -> Star Dust. Offline earnings. Home screen.
   ===================================================================== */
(() => {
  "use strict";
  const canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0, DPR = 1;

  function fmt(n) {
    if (n < 1000) return (n | 0).toString();
    const u = ["", "K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"]; let i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i];
  }
  function fmtTime(s) { s |= 0; const h = s / 3600 | 0, m = s % 3600 / 60 | 0, x = s % 60; return h ? h + "h " + m + "m" : m ? m + "m " + x + "s" : x + "s"; }

  /* ----------------------- defender unit types ------------------- */
  // Each class has a NICHE: vsBig = bonus damage to armored/tanky dots, vsSwarm =
  // bonus to weak/small/fast dots. So mixing classes beats stacking one.
  const DEF_TYPES = {
    turret:  { name: "Turret",  base: 60,     gal: 1, dmg: 5,  rate: 1.4, range: 240, splash: 0,  max: 4, vsBig: 1.0, vsSwarm: 1.0, niche: "all-rounder — steady single-target backbone" },
    mortar:  { name: "Mortar",  base: 500,    gal: 2, dmg: 9,  rate: 0.6, range: 215, splash: 55, max: 4, vsBig: 1.1, vsSwarm: 2.2, niche: "splash — shreds clustered swarms" },
    plasma:  { name: "Plasma",  base: 4000,   gal: 3, dmg: 26, rate: 0.5, range: 320, splash: 0,  max: 4, vsBig: 2.4, vsSwarm: 0.8, niche: "heavy bolts — melts tanky dots" },
    laser:   { name: "Laser",   base: 30000,  gal: 5, dmg: 3,  rate: 4.2, range: 230, splash: 0,  max: 4, vsBig: 0.7, vsSwarm: 2.6, niche: "rapid beam — vaporizes fast/weak swarms" },
    railgun: { name: "Railgun", base: 250000, gal: 7, dmg: 90, rate: 0.3, range: 430, splash: 0,  max: 4, vsBig: 4.0, vsSwarm: 0.6, niche: "huge slugs — anti-armor sniper" },
  };
  const DEF_ORDER = ["turret", "mortar", "plasma", "laser", "railgun"];
  /* ----------------------- collector types ----------------------- */
  // Collectors gather the cash orbs dots drop. Like defenders they come in
  // classes you buy more of, each with its OWN skill tree. "hole" mode = a
  // black-hole vacuum that slowly drags every orb (and nearby dots) inward.
  const COL_TYPES = {
    drone:       { name: "Drone",          base: 60,         gal: 1, speed: 88,  suction: 38,  collect: 9,  yield: 1.0, mode: "chase", sides: 4, max: 4 },
    swarm:       { name: "Drone Swarm",    base: 9000,       gal: 2, speed: 150, suction: 60,  collect: 13, yield: 1.2, mode: "swarm", sides: 3, max: 2 },
    collector:   { name: "Heavy Collector",base: 120000,     gal: 3, speed: 110, suction: 86,  collect: 20, yield: 1.5, mode: "chase", sides: 6, max: 2 },
    magnet:      { name: "Magnet Rig",     base: 1800000,    gal: 4, speed: 140, suction: 120, collect: 26, yield: 1.9, mode: "chase", sides: 5, max: 2 },
    tractor:     { name: "Tractor Array",  base: 26000000,   gal: 5, speed: 130, suction: 170, collect: 34, yield: 2.3, mode: "chase", sides: 8, max: 2 },
    singularity: { name: "Black Hole",     base: 350000000,  gal: 6, speed: 48,  suction: 250, collect: 46, yield: 2.8, mode: "hole",  sides: 0, max: 2 },
  };
  const COL_ORDER = ["drone", "swarm", "collector", "magnet", "tractor", "singularity"];
  const ALL_TYPES = [...DEF_ORDER, ...COL_ORDER];
  const isCol = type => !!COL_TYPES[type];
  const TY = type => DEF_TYPES[type] || COL_TYPES[type];
  const newUnit = type => ({ type, cd: rnd(0, 0.4) });
  const classList = type => isCol(type) ? S.collectors : S.units;
  const countType = type => classList(type).filter(u => u.type === type).length;
  // Units are paced GEOMETRICALLY across the galaxy, not as a flat % of its travel
  // cost. Income grows exponentially, so "15% of the way through" means 15% of the
  // way up the cash LOG-scale: base*(travel/base)^frac. That keeps a 2nd turret
  // cheap (~$1k in G1) and scales the 4th up into the mid-galaxy ($100k+), all well
  // under the travel wall — instead of the nonsensical flat 15%·12B = $1.8B.
  const UNIT_FRAC = [0.10, 0.15, 0.30, 0.45, 0.60];
  const unitBuyCost = type => {
    const t = TY(type), f = UNIT_FRAC[Math.min(countType(type), UNIT_FRAC.length - 1)];
    return Math.floor(2 * t.base * Math.pow(travelCost(t.gal) / t.base, f));   // ×2: units cost twice as much
  };
  // ---- class skill tree: an interconnected node MAP. Each class allocates
  // nodes outward from a start node; a node can only be taken once a CONNECTED
  // node is already allocated. Aggregated bonuses live in derived.cls[type].
  const DEF_PRIM = ["dmg", "rate", "range"], COL_PRIM = ["speed", "suction", "collect"];
  // Tree nodes add a FLAT bonus that STACKS ADDITIVELY — a stat's multiplier is
  // 1 + (sum of its nodes' bonuses). Bonuses do NOT compound off each other, so
  // deep trees scale LINEARLY (no exponential runaway), and because each new node
  // is a smaller share of a growing total, the effect naturally tapers — early
  // nodes feel strong, late nodes are incremental.
  // mul/rate/speed/suction/ingest bonuses are FRACTIONS (0.4 = +40%); range/collect
  // are flat distances; crit is flat chance.
  // Defender baseline (turret = tier 1). Later classes scale UP via DEF_SCALE, so a
  // gal-7 Railgun tree is FAR stronger per node than a gal-1 Turret — "scaled correctly."
  const MAG_DEF = { mul: { min: 2.5, maj: 7.0, key: 18 }, rate: { min: 2.0, maj: 4.5, key: 11 }, range: { min: 60, maj: 160, key: 360 }, crit: { min: 0.10, maj: 0.25, key: 0.50 } };
  const DEF_SCALE = { turret: 1.0, mortar: 1.35, plasma: 1.8, laser: 2.4, railgun: 3.2 };
  // Collectors are pure LOGISTICS (no income multiplier — yield lives in Economy):
  // Speed strong, Suction gentle (radius-capped in cSuction), Reach (collect) = how
  // close it must get to grab loot (flat), Ingest = how fast it swallows what it grabs.
  const MAG_COL = { speed: { min: 2.0, maj: 4.5, key: 9 }, suction: { min: 0.6, maj: 1.2, key: 2.2 }, collect: { min: 10, maj: 26, key: 60 }, ingest: { min: 2.6, maj: 5.5, key: 11 } };
  const allocCount = type => { const m = S.classNodes[type]; let n = 0; if (m) for (const k in m) if (m[k]) n++; return n; };
  function slotAmt(type, s) {
    if (isCol(type)) {
      if (s.p === "x") return MAG_COL.ingest[s.mag];                 // x branch = ingestion speed
      return MAG_COL[COL_PRIM[s.p - 1]][s.mag];                      // speed / suction / collect (reach)
    }
    const sc = DEF_SCALE[type] || 1;
    if (s.p === "x") return MAG_DEF.crit[s.mag];                        // crit = flat chance, not tier-scaled
    const key = DEF_PRIM[s.p - 1];
    if (key === "range") return MAG_DEF.range[s.mag];                   // range = flat distance, not scaled
    return (key === "rate" ? MAG_DEF.rate[s.mag] : MAG_DEF.mul[s.mag]) * sc;   // dmg/rate bonuses scale by class tier
  }
  function classStats(type) {
    const col = isCol(type), prim = col ? COL_PRIM : DEF_PRIM;
    const o = { dmg: 1, rate: 1, range: 0, crit: 0, speed: 1, suction: 1, yield: 1, collect: 0, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0 };
    const A = S.classNodes[type], G = buildTree(type);
    if (A) for (const id in A) { if (!A[id]) continue; const n = G.map[id]; if (!n || !n.slots) continue;
      if (n.kind === "key") { o.multi++; if (n.spec) o[n.spec]++; }   // keystone = +1 multishot AND a ✦ specialization
      // Every bonus ADDS (sums linearly) — nothing compounds, so no runaway.
      for (const s of n.slots) { const amt = slotAmt(type, s);
        if (s.p === "x") o[col ? "ingest" : "crit"] += amt;
        else o[prim[s.p - 1]] += amt; } }
    o.multi = Math.min(o.multi, 6);
    return o;
  }
  const ZERO = { dmg: 1, rate: 1, range: 0, crit: 0, speed: 1, suction: 1, yield: 1, collect: 0, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0 };
  const uMulti = u => cls(u.type).multi || 0;
  const cls = type => (derived.cls && derived.cls[type]) || ZERO;
  const uDmg = u => DEF_TYPES[u.type].dmg * cls(u.type).dmg * derived.sdDmg;
  const uRate = u => DEF_TYPES[u.type].rate * cls(u.type).rate * derived.sdFire;
  const uRange = u => DEF_TYPES[u.type].range + cls(u.type).range;
  const uCrit = u => Math.min(0.85, cls(u.type).crit);
  const uCritMul = u => 2.2;
  const uSplash = u => DEF_TYPES[u.type].splash ? DEF_TYPES[u.type].splash + cls(u.type).range * 0.4 : 0;
  // ✦ keystone SPECIALIZATIONS (BTD-style transformations) — counts of allocated keystones of each kind
  const uExplode = u => cls(u.type).explosive || 0;   // shots detonate (splash) — "bomb tower"
  const uChain   = u => cls(u.type).chain || 0;        // shots arc to nearby dots — "chain lightning"
  const uPierce  = u => cls(u.type).pierce || 0;        // shot becomes a piercing beam — "laser lance"
  const SPEC_NAME = { explosive: "Explosive Rounds", chain: "Chain Lightning", pierce: "Piercing Laser" };
  const SPECS = ["explosive", "chain", "pierce"];
  // Each defender has a SIGNATURE specialization its keystones all reinforce (stacking
  // = stronger), matching its niche: bombs for the splash class, beams for the snipers…
  const CLASS_SPEC = { turret: "chain", mortar: "explosive", plasma: "chain", laser: "pierce", railgun: "pierce" };
  // Speed is capped so a maxed Speed tree makes collectors fast & agile, not so
  // fast they teleport PAST orbs (which used to zero out collection). Suction
  // (the pull/ring radius) is capped well under the field so collectors must keep
  // roaming to cover it — they never become stationary field-wide magnets. The
  // black hole keeps its huge reach.
  const cSpeed   = type => Math.min(900, COL_TYPES[type].speed * cls(type).speed);
  const cSuction = type => Math.min(COL_TYPES[type].mode === "hole" ? 900 : 240, COL_TYPES[type].suction * cls(type).suction);
  const cCollect = type => Math.min(140, COL_TYPES[type].collect + cls(type).collect);   // capped so collectors must keep chasing (not a field-wide magnet); Reach still matters for grabbing fresh loot fast
  const cIngest  = type => cls(type).ingest;                 // how fast loot is swallowed (x branch); big loot benefits most
  const cYield   = type => COL_TYPES[type].yield   * cls(type).yield * derived.incomeMul;
  const AGILITY = 0.12;

  // flavour names: one pool per stat branch (a/b/c) plus the extra 'x' branch.
  // every node — even the small passives — pulls a distinct name from its pool.
  const SKILLS = {
    turret:  { a: ["Reinforced Rounds", "Tungsten Core", "Armor Piercing", "Hollow Points", "Overcharge", "Heavy Slugs", "Devastator"], b: ["Quick Hands", "Belt Feed", "Rapid Servos", "Hair Trigger", "Double Tap", "Cyclic Bolt", "Gatling Drive"], c: ["Scope", "Range Finder", "Laser Sight", "Tracking AI", "Eagle Eye", "Long Barrel", "Hawkeye"], x: ["Critical Core", "Deadeye", "Killshot"] },
    mortar:  { a: ["Bigger Shells", "Dense Payload", "Thermobaric", "Cluster Munitions", "Carpet Bomb", "Heavy Ordnance", "Doomshell"], b: ["Fast Fuse", "Auto-Loader", "Twin Tubes", "Rapid Mortar", "Barrage", "Quick Crew", "Drumfire"], c: ["Wider Blast", "Shrapnel", "Spotter", "Precision Strike", "Saturation", "Wide Arc", "Bullseye"], x: ["Shell Shock", "Pinpoint", "Devastation"] },
    plasma:  { a: ["Ion Charge", "Superheated", "Fusion Core", "Antimatter", "Singularity Bolt", "Plasma Surge", "Star Core"], b: ["Capacitor", "Coolant Loop", "Overclock", "Rapid Cycle", "Continuous Beam", "Supercooled", "Flux Drive"], c: ["Focusing Lens", "Long Barrel", "Crit Matrix", "Targeting Array", "Lancer", "Beam Optics", "Far Sight"], x: ["Crit Core", "Overcharge Cell", "Meltdown"] },
    laser:   { a: ["Amplifier", "Focused Beam", "Burning Ray", "Photon Surge", "Death Ray", "Hot Lens", "Sunfire"], b: ["Pulse Rate", "Rapid Emitter", "Resonance", "Overdrive", "Constant Stream", "Fast Cycle", "Lightstorm"], c: ["Mirror Array", "Extended Optics", "Heat Seeker", "Crit Lens", "Prism Split", "Wide Mirror", "True Aim"], x: ["Crit Focus", "Focal Point", "Vaporize"] },
    railgun: { a: ["Mag Core", "Hypervelocity", "Depleted Slug", "Mass Driver", "Annihilator", "Tungsten Rod", "Worldbreaker"], b: ["Quick Charge", "Capacitor Bank", "Auto-Rack", "Rapid Rail", "Salvo", "Fast Coil", "Volley"], c: ["Long Rail", "Calibration", "Piercing Round", "Crit Targeting", "Railstorm", "Extended Rail", "Dead Centre"], x: ["Crit Lock", "Penetrator", "One Shot"] },
  };
  // collector skill webs: a=Speed, b=Suction, c=Reach (grab distance), x=Ingest (loot-swallow speed)
  const COL_SKILLS = {
    drone:       { a: ["Light Frame", "Tuned Rotors", "Boosters", "Ion Thrust", "Slipstream", "Quick Servos", "Overdrive"], b: ["Magnet", "Wide Field", "Tractor Coil", "Graviton Pull", "Event Field", "Strong Coil", "Deep Pull"], c: ["Bigger Scoop", "Wide Grip", "Long Arms", "Quick Latch", "Tractor Grip", "Snap Reach", "Vacuum Maw"], x: ["Quick Gulp", "Maw Servo", "Devourer"] },
    swarm:       { a: ["Hive Mind", "Sync Wings", "Formation", "Overswarm", "Locust Dash", "Fast Hive", "Blitz"], b: ["Net Cast", "Mesh Field", "Swarm Pull", "Hive Gravity", "Total Sweep", "Wide Mesh", "Dragnet"], c: ["Many Hands", "Wide Reach", "Long Grip", "Pack Latch", "Total Grasp", "Far Hands", "Hive Grip"], x: ["Big Net", "Hive Hold", "Treasury"] },
    collector:   { a: ["Servo Boost", "Heavy Treads", "Turbo", "Afterburner", "Warp Frame", "Quick Haul", "Blink Drive"], b: ["Big Magnet", "Wide Maw", "Gravity Plate", "Pull Field", "Vortex", "Strong Maw", "Black Maw"], c: ["Cargo Arms", "Wide Maw", "Long Reach", "Bulk Grip", "Grand Reach", "Heavy Latch", "Maw Spread"], x: ["Maw Bay", "Cargo Bay", "Strongbox"] },
    magnet:      { a: ["Spin Up", "Coil Tune", "Rail Drive", "Mag-Lev", "Flux Dash", "Quick Coil", "Overspin"], b: ["Dipole", "Quad Coil", "Field Bloom", "Deep Pull", "Magnetar", "Strong Dipole", "Pole Reversal"], c: ["Grab Coil", "Wide Pole", "Long Coil", "Grip Field", "Vast Reach", "Strong Latch", "Pole Spread"], x: ["Wide Coil", "Storage Coil", "Bullion"] },
    tractor:     { a: ["Emitter Tune", "Beam Drive", "Phase Step", "Warp Coil", "Lightspeed", "Quick Beam", "Hyperdrive"], b: ["Cone Cast", "Wide Beam", "Tow Field", "Deep Tow", "Star Reach", "Broad Beam", "Long Reach"], c: ["Hopper Arm", "Wide Grip", "Long Tow", "Cone Latch", "Far Reach", "Broad Grip", "Tow Spread"], x: ["Wide Cone", "Hold Beam", "Reserve"] },
    singularity: { a: ["Drift Control", "Orbit Tune", "Wander", "Roam Field", "Phase Drift", "Slow Roll", "Free Orbit"], b: ["Deeper Well", "Wider Horizon", "Tidal Force", "Crushing Pull", "Infinite Reach", "Gravity Sink", "Abyssal Pull"], c: ["Event Reach", "Wide Maw", "Long Horizon", "Deep Grip", "Vast Reach", "Abyss Latch", "Maw Spread"], x: ["Event Maw", "Mass Vault", "Singularity Core"] },
  };
  const skillNames = type => isCol(type) ? COL_SKILLS[type] : SKILLS[type];
  const GAL_DESC = [
    "A quiet starting sector. Sparse, fragile dots — good for finding your rhythm.",
    "Azure nebula. Swarms drift faster; keep your drones close.",
    "Ember fields. Hotter, tougher dots — Mortars unlock here.",
    "Verdant drift. Dense clouds of targets and richer payouts; Plasma unlocks.",
    "Cobalt deep. Heavily reinforced dots demand real damage.",
    "Crimson expanse. Relentless waves; Lasers unlock for crowd control.",
    "Amber reach. High-value specials appear far more often.",
    "Violet void. Chaotic, dense spawns; Railguns unlock to punch through.",
    "Frost belt. Slow but massive, high-HP dots.",
    "Nova core. Extreme density — your whole arsenal earns its keep.",
    "The Abyss. Endless and brutal. How deep can you push?",
  ];
  const galDesc = g => GAL_DESC[(g - 1) % GAL_DESC.length];
  const uColor = u => u.type === "mortar" ? "#9a9a9a" : u.type === "turret" ? "#ffffff" : "#cccccc";
  // Defenders auto-arrange into a tidy, centred formation that re-racks itself
  // as you buy more — like beer-pong cups: a lone unit sits centre, a handful
  // form a neat ring, more fill concentric rings (the last ring always spread
  // evenly), so 5 and 50 read as different but equally organised shapes.
  let _form = { n: -1, pts: [] };
  function formation(n) {
    if (_form.n === n) return _form.pts;
    const pts = [], GAP = 42;
    if (n >= 1) pts.push({ x: 0, y: 0 });
    let placed = 1, ring = 1;
    while (placed < n) {
      const radius = ring * 48, cap = Math.max(1, Math.floor(TAU * radius / GAP)), take = Math.min(cap, n - placed);
      const phase = (ring % 2 ? Math.PI / take : 0) - Math.PI / 2;
      for (let k = 0; k < take; k++) { const a = k / take * TAU + phase; pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius }); }
      placed += take; ring++;
    }
    _form = { n, pts };
    return pts;
  }
  function unitPos(i, n) { const p = formation(n)[i] || { x: 0, y: 0 }; return { x: W / 2 + p.x, y: H / 2 + p.y }; }

  /* ----------------------- drone + economy upgrades -------------- */
  const UPS = [
    { id: "capacity",  tab: "eco", name: "Capacity",   base: 20, mul: 1.55, desc: () => "$" + fmt(derived.capacity) },
    { id: "value",     tab: "eco", name: "Value",      base: 30, mul: 1.42, desc: () => "×" + derived.valueMul.toFixed(2) + " /dot" },
    { id: "spawnRate", tab: "eco", name: "Spawn Rate", base: 64, mul: 1.55, desc: () => derived.spawnPerSec.toFixed(1) + " /s" },
    { id: "luck",      tab: "eco", name: "Luck",       base: 70, mul: 1.28, desc: () => (derived.luck * 100).toFixed(1) + "% special" },
  ];
  const UP = {}; UPS.forEach(u => UP[u.id] = u);
  const upCost = u => Math.floor(u.base * Math.pow(u.mul, S.lv[u.id] || 0));

  const SDS = [
    { id: "sdDmg",   name: "Permanent Damage",  base: 4, mul: 1.7, desc: l => "+" + 25 * l + "% damage" },
    { id: "sdInc",   name: "Permanent Income",  base: 4, mul: 1.7, desc: l => "+" + 25 * l + "% income" },
    { id: "sdFire",  name: "Permanent Fire Rate", base: 5, mul: 1.8, desc: l => "+" + 15 * l + "% fire rate" },
    { id: "sdStart", name: "Head-Start Cash",   base: 6, mul: 1.9, desc: l => "start $" + fmt(50 * Math.pow(6, l)) },
  ];
  const SD = {}; SDS.forEach(u => SD[u.id] = u);
  const sdCost = u => Math.floor(u.base * Math.pow(u.mul, META.sd[u.id] || 0));

  const GAL_NAMES = ["The Void", "Azure", "Ember", "Verdant", "Cobalt", "Crimson", "Amber", "Violet", "Frost", "Nova", "Abyss"];
  const galName = g => GAL_NAMES[(g - 1) % GAL_NAMES.length] + (g > GAL_NAMES.length ? " " + g : "");
  // Travel is a hard, escalating wall tuned to the (deliberately slow) income ramp:
  // ~1 day to set up + bank the first jump, ramping gently (≈×3.2/galaxy) to a few
  // days each by the late galaxies. Rebirth/Star Dust helps you outpace it.
  const travelCost = g => Math.floor(5e9 * Math.pow(3.2, Math.pow(g - 1, 1.12)));
  const enemyHpMul = g => Math.pow(2.1, g - 1);
  const galValueMul = g => Math.pow(2.2, g - 1);
  const galSpawnMul = g => 1 + (g - 1) * 0.95;          // far more dots in later galaxies
  const galCap = g => Math.min(150 + g * 90, 720);     // more dots allowed on-field to feed the higher spawn rate
  // Income now comes from THROUGHPUT — killing more, tougher, more-rewarding dots —
  // not a collector yield multiplier. DROP_BASE is the cash a plain dot drops;
  // TOUGH_POW makes reward scale SUPER-linearly with a dot's toughness, so tanky
  // dots & armored elites pay disproportionately more (rewarding turret damage to
  // kill them and stronger drones to haul the bigger loot).
  const DROP_BASE = 15;
  const TOUGH_POW = 1.45;
  const ORB_LIFE = 9;                                   // orbs vanish fast — collectors must keep up or loot is LOST
  // Loot freshness: an orb pays full value when grabbed instantly and decays to
  // FRESH_MIN of its value by the time it expires. So faster/more collectors bank
  // more cash — collector Speed/Reach/Ingest/count are a real income lever again.
  const FRESH_MIN = 0.35;
  const orbFresh = o => FRESH_MIN + (1 - FRESH_MIN) * clamp(1 - o.t / ORB_LIFE, 0, 1);

  /* ----------------------------- state --------------------------- */
  let S, derived = {}, META, state = "home";
  function fresh() {
    const lv = {}; UPS.forEach(u => lv[u.id] = 0);
    const classNodes = {}; ALL_TYPES.forEach(t => classNodes[t] = {});
    return { cash: 0, galaxy: 1, lv, classNodes, units: [newUnit("turret")], collectors: [{ type: "drone" }], totalRun: 0, peakGalaxy: 1, runSec: 0 };
  }
  // trim a unit/collector list down to each type's max (enforces caps on load)
  function capList(list) { const c = {}, out = []; for (const u of list || []) { const t = u.type, m = TY(t) ? TY(t).max : 99; c[t] = (c[t] || 0) + 1; if (c[t] <= m) out.push(u); } return out; }
  function freshStats() {
    const kills = {}; DEF_ORDER.forEach(t => kills[t] = 0); kills.draw = 0; kills.blackhole = 0;
    const collected = {}; COL_ORDER.forEach(t => collected[t] = 0);
    return { playSec: 0, dotsPopped: 0, specials: 0, armored: 0, kills, collected, abilities: { frenzy: 0, dotrain: 0, blackhole: 0 }, travels: 0, rebirths: 0, lost: 0, lostCash: 0 };
  }
  function freshMeta() { const sd = {}; SDS.forEach(u => sd[u.id] = 0); return { starDust: 0, sd, totalEver: 0, stats: freshStats() }; }
  const stat = () => META.stats;

  let dots = [], orbs = [], beams = [], drones = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0;
  let drawing = false, lastDraw = null, trail = [], selUnit = -1, selType = "turret";
  // ---- juice: particles, screen shake, flash, floating cash ----
  let parts = [], shake = 0, flash = 0, fxEarn = 0, fxEarnT = 0, fxEarnX = 0, fxEarnY = 0;
  const MAXP = 440;
  function burst(x, y, n, spd, sz) { if (parts.length > MAXP) return; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = spd * (0.35 + Math.random() * 0.9);
    if (Math.random() < 0.4) parts.push({ t: 4, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.35, max: 0.65, ang: a, len: sz * 2 + Math.random() * sz * 2, spin: (Math.random() - 0.5) * 12 });  // shard
    else parts.push({ t: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.32 + Math.random() * 0.36, max: 0.7, r: sz * (0.5 + Math.random()) }); } }
  function ring(x, y, r0, r1, life) { if (parts.length > MAXP) return; parts.push({ t: 1, x, y, r: r0, r1, life, max: life }); }
  function floatTxt(x, y, txt) { if (parts.length > MAXP) return; parts.push({ t: 2, x, y, vy: -40, life: 0.95, max: 0.95, txt }); }
  function spark(x, y) { if (parts.length > MAXP) return; parts.push({ t: 3, x, y, life: 0.22, max: 0.22 }); }
  function shakeAdd(a) { shake = Math.min(7, shake + a); }   // lower cap so dense late-game kills don't rattle the screen
  function flashAdd(a) { flash = Math.min(0.9, flash + a); }
  function stepFx(dt) {
    for (const p of parts) { p.life -= dt; if (p.t === 0 || p.t === 4) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; if (p.t === 4) p.ang += p.spin * dt; } else if (p.t === 2) { p.y += p.vy * dt; p.vy *= 0.9; } }
    if (parts.length) parts = parts.filter(p => p.life > 0);
    shake *= Math.exp(-dt * 13); if (shake < 0.2) shake = 0;
    flash = Math.max(0, flash - dt * 3.2);
  }
  function drawParts() {
    for (const p of parts) { const k = clamp(p.life / p.max, 0, 1);
      if (p.t === 0) { ctx.globalAlpha = k; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k + 0.5, 0, TAU); ctx.fill(); }
      else if (p.t === 1) { const rr = p.r + (p.r1 - p.r) * (1 - k); ctx.globalAlpha = k * 0.55; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, rr), 0, TAU); ctx.stroke(); }
      else if (p.t === 2) { ctx.globalAlpha = k; ctx.fillStyle = "#fff"; ctx.font = "bold 13px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(p.txt, p.x, p.y); }
      else if (p.t === 4) { ctx.globalAlpha = k; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; const dx = Math.cos(p.ang) * p.len * k * 0.5, dy = Math.sin(p.ang) * p.len * k * 0.5; ctx.beginPath(); ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke(); }  // shard
      else { ctx.globalAlpha = k; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * (1 - k) + 2, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
  }
  let abil = { frenzy: 0, dotrain: 0, blackhole: 0 }, frenzyT = 0, blackholeT = 0;
  const ABIL_CD = { frenzy: 45, dotrain: 40, blackhole: 60 };
  let activeTab = "def", listRows = {}, tabBtns = {};

  function recompute() {
    const L = S.lv, m = META;
    derived.sdDmg = 1 + 0.25 * m.sd.sdDmg;
    derived.sdFire = (1 + 0.15 * m.sd.sdFire) * (frenzyT > 0 ? 5 : 1);
    derived.incomeMul = 1 + 0.25 * m.sd.sdInc;
    derived.capacity = 400 * Math.pow(1.60, L.capacity);   // higher base so the very start isn't ceiling-blocked; still exponential (must hold travel cash)
    derived.valueMul = 1 + 0.08 * L.value;          // FLAT +8% cash per level (additive — no compounding/runaway); also drives dot "menace"
    derived.spawnPerSec = 0.9 + 2.0 * L.spawnRate;   // beefed: spawn is now a primary income lever (covers the softer Value)
    derived.luck = Math.min(0.5, 0.001 * L.luck);    // +0.1% chance of a rare 9× SPECIAL dot per Luck level
    derived.cls = {}; for (const t of ALL_TYPES) derived.cls[t] = classStats(t);
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v2";
  let wiping = false;
  function save() { if (wiping) return; try { localStorage.setItem(KEY, JSON.stringify({ S, META, ts: Date.now(), cps })); } catch (e) {} }
  function wipeSave() { wiping = true; try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }
  function load() {
    S = fresh(); META = freshMeta(); let off = null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {}); if (!S.units || !S.units.length) S.units = [newUnit("turret")]; S.units.forEach(u => { u.cd = u.cd || 0; }); if (!S.classNodes || typeof S.classNodes !== "object") S.classNodes = {}; ALL_TYPES.forEach(t => { if (!S.classNodes[t]) S.classNodes[t] = {}; }); if (!Array.isArray(S.collectors) || !S.collectors.length) { const n = 1 + (d.S.lv && d.S.lv.drones || 0); S.collectors = []; for (let i = 0; i < n; i++) S.collectors.push({ type: "drone" }); } S.units = capList(S.units); S.collectors = capList(S.collectors); }
        if (d.META) { META = Object.assign(freshMeta(), d.META); META.sd = Object.assign(freshMeta().sd, d.META.sd || {});
          const st = d.META.stats || {}; META.stats = Object.assign(freshStats(), st);
          META.stats.kills = Object.assign(freshStats().kills, st.kills || {});
          META.stats.collected = Object.assign(freshStats().collected, st.collected || {});
          META.stats.abilities = Object.assign({ frenzy: 0, dotrain: 0, blackhole: 0 }, st.abilities || {}); }
        if (d.ts && d.cps > 0) { const e = clamp((Date.now() - d.ts) / 1000, 0, 8 * 3600); if (e >= 60) { const g = Math.floor(d.cps * e * 0.5); if (g > 0) off = { gain: g, elapsed: e }; } }
      }
    } catch (e) {}
    recompute();
    if (off) { S.cash = Math.min(derived.capacity, S.cash + off.gain); S._welcome = off; }
  }

  /* ----------------------------- entities ------------------------ */
  function syncCollectors() {
    const n = S.collectors.length;
    while (drones.length < n) drones.push({ x: rnd(W * 0.3, W * 0.7), y: rnd(H * 0.3, H * 0.6), vx: 0, vy: 0 });
    while (drones.length > n) drones.pop();
    for (let i = 0; i < n; i++) drones[i].type = S.collectors[i].type;
  }

  const armorChance = g => Math.min(0.05 + 0.022 * (g - 1), 0.28);
  // enemy archetypes that appear in later galaxies — each with its own twist.
  const DOT_KINDS = {
    swift:    { gal: 2, weight: 1.0, hp: 0.55, val: 1.7, speed: 3.0 },                 // fast, fragile, pays extra
    zigzag:   { gal: 2, weight: 0.9, hp: 0.7,  val: 1.5, speed: 2.2, zig: 1 },         // erratic, jukes around
    splitter: { gal: 3, weight: 0.9, hp: 1.1,  val: 1.0, splits: 2 },                  // bursts into 2 smaller dots
    orbiter:  { gal: 3, weight: 0.8, hp: 1.3,  val: 1.4, sat: 3 },                     // ringed by orbiting satellites
    shield:   { gal: 4, weight: 0.8, hp: 1.0,  val: 1.5, shield: 0.7, reflect: 0.3 },  // shield soaks/reflects shots
    pulsar:   { gal: 4, weight: 0.7, hp: 1.5,  val: 1.7, pulse: 1 },                   // throbs, emits shock rings
    regen:    { gal: 5, weight: 0.7, hp: 1.4,  val: 1.6, regen: 0.07 },                // heals unless under fire
    phantom:  { gal: 6, weight: 0.6, hp: 1.2,  val: 2.0, phase: 1 },                   // phases out, dodges damage
  };
  const DOT_ORDER = ["swift", "zigzag", "splitter", "orbiter", "shield", "pulsar", "regen", "phantom"];
  const kindChance = g => Math.min(0.12 + 0.05 * (g - 2), 0.55);
  function spawnDot(special) {
    const g = S.galaxy, vscale = Math.sqrt(derived.valueMul), base = 14 * enemyHpMul(g) * vscale, avg = base * 1.3;
    const men = clamp(S.lv.value / 35, 0, 1.3);   // "menace": as Value climbs, tougher dots appear more (and pay more)
    const men01 = Math.min(1, men);               // 0..1 gate — keeps dots BASIC until Value is invested
    let roll = rnd(0.7, 1.0 + men * 2.8), armored = false, kind = "normal", cfg = null, mv = 20;
    // difficulty & craziness are bought with VALUE: at Value 0 every dot is the
    // plainest tier-0 grey. armored elites & exotic kinds only appear once you invest.
    if (Math.random() < armorChance(g) * men01 + men * 0.08) { armored = true; roll *= rnd(4, 7) * (1 + men); mv = 9; }   // super-advanced elite: LOTS of health
    else { const elig = DOT_ORDER.filter(k => g >= DOT_KINDS[k].gal);
      if (elig.length && Math.random() < kindChance(g) * men01 + men * 0.06) { let tot = 0; elig.forEach(k => tot += DOT_KINDS[k].weight); let r2 = Math.random() * tot; for (const k of elig) { r2 -= DOT_KINDS[k].weight; if (r2 <= 0) { kind = k; cfg = DOT_KINDS[k]; break; } } } }
    if (cfg) { roll *= cfg.hp; if (cfg.speed) mv *= cfg.speed; }
    const hp = base * roll;
    special = special || (!armored && !cfg && Math.random() < derived.luck);
    const val = Math.max(1, Math.round(DROP_BASE * galValueMul(g) * derived.valueMul * derived.incomeMul * Math.pow(hp / avg, TOUGH_POW) * (special ? 9 : 1) * (cfg ? cfg.val : 1)));
    const r = clamp(7 + Math.log10(hp + 10) * 2.6, kind === "swift" ? 6 : 7, armored ? 40 : 24);
    // visual tier: the tougher the dot, the more elaborate (spikes/rings)
    const tier = roll < 1.0 ? 0 : roll < 1.5 ? 1 : roll < 2.2 ? 2 : roll < 4 ? 3 : roll < 6 ? 4 : roll < 9 ? 5 : 6;
    const d = { x: rnd(40, W - 40), y: rnd(60, H - 150), vx: rnd(-mv, mv), vy: rnd(-mv, mv),
      hp, maxHp: hp, value: val, r, tier, spin: Math.random() * TAU, special, armored, kind, weight: armored ? 2.6 : 1, hit: 0, drawCd: 0, refl: 0, born: 0,
      color: armored ? "#9a9a9a" : special ? "#ffffff" : kind !== "normal" ? "#cfcfcf" : `hsl(0,0%,${44 + ((g - 1) % 6) * 8}%)` };
    if (cfg && cfg.shield) { d.shieldMax = hp * cfg.shield; d.shield = d.shieldMax; d.reflect = cfg.reflect; }
    if (cfg && cfg.regen) d.regen = cfg.regen;
    if (cfg && cfg.splits) { d.splits = cfg.splits; d.gen = 0; }
    if (cfg && cfg.sat) d.sat = cfg.sat;
    if (cfg && cfg.pulse) d.pulse = 0;
    if (cfg && cfg.phase) { d.phase = 0; d.phased = false; }
    if (cfg && cfg.zig) d.zig = 0;
    dots.push(d);
  }

  function fireUnit(u, p) {
    // gather every in-range dot, nearest first, preferring ones not already
    // marked for lethal damage this frame (so fire spreads instead of overkilling).
    const rng = uRange(u) ** 2; const cands = [];
    for (const d of dots) {
      if (d.dead) continue; const q = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (q > rng) continue;
      cands.push({ d, q, covered: (d.pending || 0) >= d.hp });
    }
    if (!cands.length) return;
    cands.sort((a, b) => (a.covered - b.covered) || (a.q - b.q));   // uncovered first, then nearest
    const shots = 1 + uMulti(u);                            // keystone nodes grant extra simultaneous targets
    const fired = cands.slice(0, shots);
    let recoiled = false;
    for (const c of fired) {
      const target = c.d;
      let dmg = uDmg(u), crit = Math.random() < uCrit(u); if (crit) dmg *= uCritMul(u);
      const ddx = target.x - p.x, ddy = target.y - p.y, ddl = Math.hypot(ddx, ddy) || 1;
      if (!recoiled) { u.rx = -ddx / ddl * 4; u.ry = -ddy / ddl * 4; u.aim = Math.atan2(ddy, ddx); u.flash = 0.08; recoiled = true; }   // muzzle recoil + aim + muzzle-flash (toward first target)
      beams.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y, life: crit ? 0.13 : 0.08, color: uColor(u), w: (crit ? 3.5 : 2) + Math.min(Math.log10(uDmg(u) + 1) * 0.5, 3) });   // bolder beams with more damage
      if (crit) burst(target.x, target.y, 5, 90, 2);        // crit pops a little extra
      const explode = uExplode(u), aoe = uSplash(u) + (explode ? 34 + explode * 26 : 0);
      if (aoe > 0) {
        for (const d of dots) if (!d.dead && (d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= aoe * aoe) hitDot(d, dmg, u.type);
        if (explode) { ring(target.x, target.y, 4, aoe, 0.2); burst(target.x, target.y, 7, 90, 2); }
      } else { target.pending = (target.pending || 0) + dmg; hitDot(target, dmg, u.type); }
      // ✦ Chain Lightning — arc from the hit dot to nearby dots, fading per jump
      const chain = uChain(u);
      if (chain > 0) {
        let src = target, jumps = chain + 1, cdmg = dmg * 0.6; const seen = new Set([target]);
        while (jumps-- > 0) {
          let best = null, bd = 140 * 140;
          for (const d of dots) { if (d.dead || seen.has(d)) continue; const q = (d.x - src.x) ** 2 + (d.y - src.y) ** 2; if (q < bd) { bd = q; best = d; } }
          if (!best) break;
          beams.push({ x1: src.x, y1: src.y, x2: best.x, y2: best.y, life: 0.1, color: "#dff0ff", w: 2 });
          seen.add(best); hitDot(best, cdmg, u.type); src = best; cdmg *= 0.85;
        }
      }
      // ✦ Piercing Laser — punch a beam through every dot along the line of fire
      const pierce = uPierce(u);
      if (pierce > 0) {
        const nx = ddx / ddl, ny = ddy / ddl, width = 14 + pierce * 8, rngU = uRange(u);
        for (const d of dots) { if (d.dead || d === target) continue;
          const rx = d.x - p.x, ry = d.y - p.y, t = rx * nx + ry * ny; if (t < 0 || t > rngU) continue;
          if (Math.abs(rx * -ny + ry * nx) <= width + d.r) hitDot(d, dmg * 0.85, u.type); }
        beams.push({ x1: p.x, y1: p.y, x2: p.x + nx * rngU, y2: p.y + ny * rngU, life: 0.09, color: "#fff", w: 2.5 });
      }
    }
  }
  function hitDot(d, dmg, src) {
    if (d.dead) return;
    const ty = DEF_TYPES[src];                                  // class NICHE: anti-armor vs anti-swarm
    if (ty) { if (d.armored || (d.tier || 0) >= 3) dmg *= ty.vsBig; else if (!d.armored && (d.tier || 0) <= 1) dmg *= ty.vsSwarm; }
    if (d.phased) dmg *= 0.45;                                   // phantom shrugs off most damage while phased
    if (d.shield > 0) {
      if (Math.random() < d.reflect) { d.refl = 0.14; return; }   // shield reflects the shot
      d.shield -= dmg; d.hit = 0.08;
      if (d.shield > 0) return;                                   // fully absorbed
      dmg = -d.shield; d.shield = 0;                              // overflow spills to hp
    }
    d.hp -= dmg; d.hit = 0.08;
    if (d.hp <= 0) {
      d.dead = true;
      // bigger / tougher kills drop heavier loot that takes longer to consume
      const big = d.armored || (d.tier || 0) >= 3, cmax = big ? 1.6 : ((d.tier || 0) >= 1 || d.r > 12 ? 0.55 : 0.1);
      orbs.push({ x: d.x, y: d.y, value: d.value, t: 0, weight: d.weight || 1, consume: 0, consumeMax: cmax, r0: big ? 6.5 : ((d.tier || 0) >= 1 ? 4 : 2.6), big });
      const s = stat(); s.dotsPopped++; if (d.special) s.specials++; if (d.armored) s.armored = (s.armored || 0) + 1; if (src) s.kills[src] = (s.kills[src] || 0) + 1;
      const nb = Math.min(28, 6 + (d.tier || 0) * 4 + (d.armored ? 8 : 0));
      burst(d.x, d.y, nb, 90 + (d.tier || 0) * 24 + (d.armored ? 60 : 0), 2 + (d.tier || 0) * 0.3);
      ring(d.x, d.y, d.r, d.r + 18 + (d.tier || 0) * 8, 0.3); if (d.armored || (d.tier || 0) >= 4) shakeAdd(d.armored ? 1.8 : 1);
      if (d.splits && (d.gen || 0) < 1) for (let i = 0; i < d.splits; i++) {
        const hp = d.maxHp * 0.4;
        dots.push({ x: d.x + rnd(-10, 10), y: d.y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-40, 40), hp, maxHp: hp,
          value: Math.max(1, Math.round(d.value * 0.4)), r: Math.max(6, d.r * 0.66), tier: 0, spin: 0, special: false, armored: false,
          kind: "splitter", splits: 0, gen: 1, weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: d.color });
      }
    }
  }
  function brushDmg() { let m = 5; for (const u of S.units) { const x = uDmg(u); if (x > m) m = x; } return m * 1.5 + 3; }
  function brushAt(x, y) { const R = 30, dmg = brushDmg(); for (const d of dots) { if (d.dead) continue; const rr = R + d.r; if ((d.x - x) ** 2 + (d.y - y) ** 2 <= rr * rr && d.drawCd <= 0) { hitDot(d, dmg, "draw"); d.drawCd = 0.07; } } trail.push({ x, y, life: 0.35 }); }
  // tap / drag over loot to manually bank it (no collector needed) — instant, full value.
  function collectAt(x, y) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; if ((o.x - x) ** 2 + (o.y - y) ** 2 > (26 + (o.r0 || 4)) ** 2) continue;
      const got = Math.max(1, Math.round(o.value * derived.incomeMul));
      S.cash = Math.min(derived.capacity, S.cash + got); S.totalRun += got; META.totalEver += got;
      fxEarn += got; fxEarnX = o.x; fxEarnY = o.y - 6; burst(o.x, o.y, o.big ? 9 : 5, 80, 2); spark(o.x, o.y);
      orbs.splice(i, 1);
    }
  }

  function useAbility(k) {
    if (abil[k] > 0 || state !== "play") return;
    abil[k] = ABIL_CD[k]; META.stats.abilities[k] = (META.stats.abilities[k] || 0) + 1;
    if (k === "frenzy") { frenzyT = 6; shakeAdd(3.5); flashAdd(0.3); ring(W / 2, H / 2, 30, Math.max(W, H) * 0.55, 0.5); }
    else if (k === "dotrain") { const n = 30 + S.galaxy * 8; for (let i = 0; i < n; i++) spawnDot(Math.random() < 0.3); shakeAdd(4); ring(W / 2, 70, 20, W * 0.55, 0.5); }
    else if (k === "blackhole") { blackholeT = 5; shakeAdd(5); flashAdd(0.25); ring(W / 2, H / 2, Math.max(W, H) * 0.55, 40, 0.6); }
  }

  /* ----------------------------- update -------------------------- */
  function update(dt) {
    if (state !== "play") return;
    recompute();
    META.stats.playSec += dt; S.runSec += dt;
    if (frenzyT > 0) frenzyT -= dt;
    if (blackholeT > 0) blackholeT -= dt;
    for (const k in abil) if (abil[k] > 0) abil[k] = Math.max(0, abil[k] - dt);

    spawnAcc += dt * derived.spawnPerSec * galSpawnMul(S.galaxy);
    const cap = galCap(S.galaxy);
    while (spawnAcc >= 1 && dots.length < cap) { spawnDot(); spawnAcc -= 1; }
    if (spawnAcc > 6) spawnAcc = 6;

    for (const d of dots) {
      d.pending = 0; if (d.born < 0.2) d.born += dt; d.spin += dt * 0.9;
      if (d.hit > 0) d.hit -= dt; if (d.drawCd > 0) d.drawCd -= dt; if (d.refl > 0) d.refl -= dt;
      if (d.regen && d.hit <= 0 && d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * d.regen * dt);  // heals unless under fire
      if (d.pulse !== undefined) { d.pulse += dt; if (d.pulse > 1.5) { d.pulse = 0; ring(d.x, d.y, d.r, d.r + 26, 0.45); } }
      if (d.phase !== undefined) { d.phase += dt; d.phased = (d.phase % 2.4) < 1.0; }
      if (d.zig !== undefined) { d.zig += dt; if (d.zig > 0.35) { d.zig = 0; const sp = Math.hypot(d.vx, d.vy) || 1, a = Math.random() * TAU; d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp; } }
      if (blackholeT > 0) { const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1; d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt; hitDot(d, brushDmg() * 0.6 * dt, "blackhole"); }
      else { d.x += d.vx * dt; d.y += d.vy * dt; if (d.x < 30 || d.x > W - 30) d.vx *= -1; if (d.y < 50 || d.y > H - 130) d.vy *= -1; d.x = clamp(d.x, 30, W - 30); d.y = clamp(d.y, 50, H - 130); }
    }
    dots = dots.filter(d => !d.dead);

    for (let i = 0; i < S.units.length; i++) { const u = S.units[i]; if (u.rx) { const dc = Math.exp(-dt * 16); u.rx *= dc; u.ry *= dc; } if (u.flash > 0) u.flash -= dt; u.cd -= dt; let shots = 0; const period = 1 / uRate(u); while (u.cd <= 0 && shots < 8) { fireUnit(u, unitPos(i, S.units.length)); u.cd += period; shots++; } }   // machine-gun: many shots/frame at high fire rate
    for (const b of beams) b.life -= dt; beams = beams.filter(b => b.life > 0);

    // collectors coordinate: chase-types each claim their nearest orb (so they
    // split up); black-hole types stay put and drag everything in slowly.
    if (drones.length === 0) syncCollectors();
    for (const dr of drones) { dr.cand = null; dr.cbd = Infinity; }
    for (const o of orbs) { let nd = null, bd = Infinity; for (const dr of drones) { if (COL_TYPES[dr.type].mode === "hole") continue; const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2; if (q < bd) { bd = q; nd = dr; } } if (nd && bd < nd.cbd) { nd.cbd = bd; nd.cand = o; } }
    for (const dr of drones) {
      const hole = COL_TYPES[dr.type].mode === "hole", tgt = dr.cand;
      if (hole) { const dx = W / 2 - dr.x, dy = H * 0.42 - dr.y; dr.vx += (dx * 0.6 - dr.vx) * 0.04; dr.vy += (dy * 0.6 - dr.vy) * 0.04; }   // hovers near centre
      else if (dr.parking) { dr.vx *= 0.55; dr.vy *= 0.55; }                                  // parked, consuming big loot
      else if (tgt) { const dx = tgt.x - dr.x, dy = tgt.y - dr.y, dl = Math.hypot(dx, dy) || 1, sp = cSpeed(dr.type); dr.vx += (dx / dl * sp - dr.vx) * AGILITY; dr.vy += (dy / dl * sp - dr.vy) * AGILITY; }
      else { dr.vx *= 0.9; dr.vy *= 0.9; }
      // separation: chase collectors push apart so they SPREAD and cover more of the
      // field — so fielding more (and faster) collectors collects meaningfully more.
      if (!hole) for (const o2 of drones) { if (o2 === dr || COL_TYPES[o2.type].mode === "hole") continue; const dx = dr.x - o2.x, dy = dr.y - o2.y, d2 = dx * dx + dy * dy; if (d2 > 1 && d2 < 200 * 200) { const inv = 1 / Math.sqrt(d2), f = (200 - Math.sqrt(d2)) * cSpeed(dr.type) * 0.012; dr.vx += dx * inv * f * dt; dr.vy += dy * inv * f * dt; } }
      dr.x = clamp(dr.x + dr.vx * dt, 0, W); dr.y = clamp(dr.y + dr.vy * dt, 0, H);
      dr.parking = false;
    }
    // black holes also drag nearby dots gently toward them (the "suck in" feel)
    for (const dr of drones) { if (COL_TYPES[dr.type].mode !== "hole") continue; const R = cSuction(dr.type) * 1.5; for (const d of dots) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < R) { d.x += dx / dl * 60 * dt; d.y += dy / dl * 60 * dt; } } }
    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      let nd = null, bd = Infinity; for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2, rng = cSuction(dr.type) ** 2; if (q < bd && q < rng) { bd = q; nd = dr; } }
      if (nd) {
        const dl = Math.sqrt(bd) || 1, pull = (COL_TYPES[nd.type].mode === "hole" ? 150 : 240) / (o.weight || 1);
        if (dl < cCollect(nd.type) + 6) {                         // must REACH loot to bank it — collector Speed/Reach/Ingest is the lever
          o.consume += dt * cIngest(nd.type); o.x += (nd.x - o.x) * 0.3; o.y += (nd.y - o.y) * 0.3; if (o.consumeMax > 0.2) nd.parking = true;
          if (Math.random() < (o.big ? 0.4 : 0.12)) spark(o.x, o.y);
          if (o.consume >= o.consumeMax) { const got = Math.round(o.value * cYield(nd.type) * orbFresh(o)); earned += got; META.stats.collected[nd.type] = (META.stats.collected[nd.type] || 0) + got; fxEarn += got; fxEarnX = nd.x; fxEarnY = nd.y - 6; if (o.big) burst(o.x, o.y, 8, 70, 2); orbs.splice(i, 1); }
        } else { o.x += (nd.x - o.x) / dl * pull * dt; o.y += (nd.y - o.y) / dl * pull * dt; if (o.t > ORB_LIFE) { META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(i, 1); } }
      }
      else if (o.t > ORB_LIFE) { META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(i, 1); }
    }
    if (earned > 0) { S.cash = Math.min(derived.capacity, S.cash + earned); S.totalRun += earned; META.totalEver += earned; earnAcc += earned; }
    fxEarnT += dt; if (fxEarn > 0 && fxEarnT > 0.22) { floatTxt(fxEarnX, fxEarnY - 14, "+$" + fmt(fxEarn)); fxEarn = 0; fxEarnT = 0; }
    earnT += dt; if (earnT >= 1) { cps = cps * 0.6 + (earnAcc / earnT) * 0.4; earnAcc = 0; earnT = 0; }
    for (const tp of trail) tp.life -= dt; trail = trail.filter(tp => tp.life > 0);
    stepFx(dt);
    if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy;
  }

  /* ----------------------------- render -------------------------- */
  function render() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, `hsl(0,0%,${7 + ((S.galaxy - 1) % 6) * 2}%)`); g.addColorStop(1, "#000");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.2) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    if (blackholeT > 0) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, TAU); ctx.fill(); }
    for (const b of beams) { const a = clamp(b.life / (b.w > 2 ? 0.13 : 0.08), 0, 1); ctx.strokeStyle = b.color; ctx.globalAlpha = a * 0.25; ctx.lineWidth = (b.w || 2) * 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); ctx.globalAlpha = a; ctx.lineWidth = b.w || 2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const d of dots) {
      const pulse = d.pulse !== undefined ? 1 + 0.12 * Math.sin(d.born * 0.1 + d.pulse * 4) : 1;
      const dr2 = d.r * (d.born < 0.2 ? clamp(d.born / 0.18, 0.2, 1) : 1) * (d.hit > 0 ? 1 + d.hit / 0.08 * 0.28 : 1) * pulse;
      const ga = d.phased ? 0.4 : 1;
      if (d.kind === "swift" || d.kind === "zigzag") { ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 0.12, d.y - d.vy * 0.12); ctx.stroke(); }  // motion streak
      // HP-tier spikes: tougher dots grow rotating spikes around the core
      if (d.tier >= 1) { ctx.globalAlpha = ga; ctx.strokeStyle = d.color; ctx.lineWidth = 1.5 + d.tier * 0.3; const ns = 3 + d.tier * 2; for (let k = 0; k < ns; k++) { const a = d.spin + k / ns * TAU, i0 = dr2 * 0.9, o0 = dr2 + 3 + d.tier * 1.6; ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * i0, d.y + Math.sin(a) * i0); ctx.lineTo(d.x + Math.cos(a) * o0, d.y + Math.sin(a) * o0); ctx.stroke(); } ctx.globalAlpha = 1; }
      ctx.globalAlpha = ga; ctx.fillStyle = d.hit > 0 ? "#fff" : d.color; ctx.beginPath(); ctx.arc(d.x, d.y, dr2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      // tier rings inside (segmented core)
      if (d.tier >= 2) { ctx.globalAlpha = ga * 0.8; ctx.strokeStyle = "#000"; ctx.lineWidth = 1; for (let k = 1; k < d.tier; k++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (k / d.tier), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (d.special) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke(); }
      if (d.armored) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 - 2, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3, 0, TAU); ctx.stroke(); }
      if (d.kind === "splitter") { ctx.fillStyle = "#000"; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(d.x + (k ? dr2 * 0.35 : -dr2 * 0.35), d.y, dr2 * 0.28, 0, TAU); ctx.fill(); } }  // cell-division look
      if (d.kind === "regen") { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x - dr2 * 0.45, d.y); ctx.lineTo(d.x + dr2 * 0.45, d.y); ctx.moveTo(d.x, d.y - dr2 * 0.45); ctx.lineTo(d.x, d.y + dr2 * 0.45); ctx.stroke(); }  // + cross
      if (d.kind === "orbiter") { ctx.fillStyle = "#fff"; const sc = d.sat || 3; for (let k = 0; k < sc; k++) { const a = d.spin * 2 + k / sc * TAU, rr = d.r + 9; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 2.4, 0, TAU); ctx.fill(); } }  // orbiting satellites
      if (d.kind === "pulsar") { ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4, 0, TAU); ctx.stroke(); }
      if (d.phase !== undefined) { ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5, d.spin, d.spin + TAU); ctx.stroke(); ctx.setLineDash([]); }  // phantom dashed ring
      if (d.shield > 0) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2.5; ctx.globalAlpha = clamp(d.shield / d.shieldMax, 0.25, 1); ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5, -0.9, 0.9); ctx.stroke(); ctx.globalAlpha = 1; }  // front shield arc
      if (d.refl > 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8, 0, TAU); ctx.stroke(); }  // reflect flash
      if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); }
    }
    for (const o of orbs) {
      const life = clamp(1 - o.t / ORB_LIFE, 0, 1), rr = (o.r0 || 3) + (o.consume > 0 ? Math.sin(o.consume * 30) * 1.2 : 0);
      ctx.globalAlpha = 0.35 + 0.65 * life; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(o.x, o.y, rr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      if (o.consume > 0 && o.consumeMax > 0.2) { const f = clamp(o.consume / o.consumeMax, 0, 1); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(o.x, o.y, rr + 4, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.stroke(); }  // consume progress
    }
    const n = S.units.length;
    for (let i = 0; i < n; i++) {
      const u = S.units[i], p = unitPos(i, n); p.x += u.rx || 0; p.y += u.ry || 0;
      const c = cls(u.type);
      if (i === selUnit) { ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, uRange(u), 0, TAU); ctx.stroke(); }
      // --- build-reflecting visuals: barrels=fire rate (+multishot), length=range, thickness/size=damage, colour=specialization ---
      const barrels = clamp(Math.max(1 + Math.floor(Math.log(Math.max(c.rate, 1)) / Math.log(2.2)), 1 + (c.multi || 0)), 1, 6);
      const blen = 13 + Math.min(uRange(u) - DEF_TYPES[u.type].range, 260) * 0.04;
      const bw = 2.6 + Math.min(Math.log10(c.dmg + 1) * 1.7, 6.5);
      const bodyR = (u.type === "turret" ? 11 : 9) + Math.min(Math.log10(c.dmg + 1) * 1.4, 6);
      const specCol = c.explosive ? "#ffb060" : c.chain ? "#a9d6ff" : c.pierce ? "#ffffff" : "#c8d2e6";
      const aim = u.aim != null ? u.aim : -Math.PI / 2;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(aim); ctx.lineCap = "round";
      for (let b = 0; b < barrels; b++) {
        const off = (b - (barrels - 1) / 2) * (bw + 2.4);
        ctx.strokeStyle = "#3a4150"; ctx.lineWidth = bw + 1.6; ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
        ctx.strokeStyle = specCol; ctx.lineWidth = Math.max(1, bw * 0.5); ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
        if (u.flash > 0) { const a = u.flash / 0.08; ctx.fillStyle = "rgba(255,238,170," + a + ")"; ctx.beginPath(); ctx.arc(blen + 1, off, bw * 0.8 + 3 * a, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
      // --- body (size = damage) ---
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(p.x, p.y, bodyR + 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = uColor(u); ctx.beginPath(); ctx.arc(p.x, p.y, bodyR, 0, TAU); ctx.fill();
      if (uCrit(u) > 0.2) { ctx.fillStyle = "rgba(255,255,255," + Math.min(uCrit(u), 0.9) + ")"; ctx.beginPath(); ctx.arc(p.x - bodyR * 0.32, p.y - bodyR * 0.32, 2.3, 0, TAU); ctx.fill(); }   // crit glint
      if (c.multi) { const t2 = Date.now() / 760; for (let k = 0; k < c.multi; k++) { const a = t2 + k / c.multi * TAU; ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * (bodyR + 6), p.y + Math.sin(a) * (bodyR + 6), 1.6, 0, TAU); ctx.fill(); } }   // orbiting ticks = keystones (specialization level)
      ctx.fillStyle = "#000"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(DEF_TYPES[u.type].name[0], p.x, p.y + 1);
      const tot = allocCount(u.type); if (tot) { ctx.fillStyle = "#fff"; ctx.font = "9px ui-monospace,monospace"; ctx.fillText("" + tot, p.x, p.y - bodyR - 11); }
    }
    ctx.textBaseline = "alphabetic";
    for (const dr of drones) {
      const mode = COL_TYPES[dr.type].mode, sr = cSuction(dr.type);
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, sr, 0, TAU); ctx.stroke();
      const sp = Math.hypot(dr.vx || 0, dr.vy || 0);
      if (mode !== "hole" && sp > 40) { ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dr.x - (dr.vx || 0) * 0.1, dr.y - (dr.vy || 0) * 0.1); ctx.lineTo(dr.x, dr.y); ctx.stroke(); }   // speed trail
      const cs = 1 + Math.min(Math.log10(cIngest(dr.type)) * 0.5, 1.4);   // Process -> bigger maw
      ctx.save(); ctx.translate(dr.x, dr.y); ctx.scale(cs, cs);
      if (mode === "hole") {
        const rot = Date.now() / 600;
        for (let k = 0; k < 3; k++) { ctx.strokeStyle = "rgba(255,255,255," + (0.5 - k * 0.13) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 7 + k * 5, rot + k, rot + k + 4.2); ctx.stroke(); }
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (dr.type === "swarm") {
        ctx.rotate(Date.now() / 240); ctx.fillStyle = "#eee";
        for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 6, Math.sin(a) * 6, 3.2, 0, TAU); ctx.fill(); }
      } else {
        ctx.rotate(Date.now() / 300); ctx.fillStyle = "#ddd"; ctx.fillRect(-6, -6, 12, 12);
      }
      ctx.restore();
    }
    if (trail.length) { ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 16; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); for (let i = 0; i < trail.length; i++) { const tp = trail[i]; i ? ctx.lineTo(tp.x, tp.y) : ctx.moveTo(tp.x, tp.y); } ctx.stroke(); }
    drawParts();
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = "rgba(255,255,255," + Math.min(0.55, flash * 0.6) + ")"; ctx.fillRect(0, 0, W, H); }
  }

  /* ----------------------------- HUD ----------------------------- */
  function syncHUD() {
    $("ui-cash").textContent = fmt(S.cash); $("ui-cap").textContent = " / " + fmt(derived.capacity);
    $("ui-galaxy").textContent = S.galaxy; $("ui-gname").textContent = galName(S.galaxy); $("ui-stardust").textContent = fmt(META.starDust);
    const tc = travelCost(S.galaxy);
    $("galaxy-fill").style.width = clamp(S.cash / tc, 0, 1) * 100 + "%";
    $("btn-travel").textContent = "TRAVEL ▸ $" + fmt(tc); $("btn-travel").classList.toggle("ready", S.cash >= tc);
    $("btn-rebirth").classList.toggle("hidden", S.galaxy < 10 && S.peakGalaxy < 10);
    for (const k in ABIL_CD) { $("ab-" + k).disabled = abil[k] > 0; $("cd-" + k).style.width = abil[k] > 0 ? (abil[k] / ABIL_CD[k] * 100) + "%" : "0"; $("s-" + k).textContent = abil[k] > 0 ? Math.ceil(abil[k]) + "s" : ""; }
    for (const id in listRows) {
      const row = listRows[id];
      if (row.kind === "unit") {
        const d = TY(id), locked = S.galaxy < d.gal, c = unitBuyCost(id), n = countType(id), full = n >= d.max;
        row.desc.textContent = n + "/" + d.max + (locked ? "" : " · " + d.name);
        if (locked) { row.buy.textContent = "🔒 G" + d.gal; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.remove("maxed"); }
        else if (full) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.add("maxed"); }
        else { row.buy.textContent = "$" + fmt(c); row.buy.disabled = S.cash < c; row.buy.classList.toggle("afford", S.cash >= c); row.el.classList.remove("maxed"); }
      } else {
        const u = UP[id], lvl = S.lv[id], maxed = u.max != null && lvl >= u.max;
        row.lv.textContent = "Lv " + lvl; row.desc.textContent = u.desc(lvl);
        if (maxed) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.el.classList.add("maxed"); row.buy.classList.remove("afford"); }
        else { const c = upCost(u); row.buy.textContent = "$" + fmt(c); row.buy.disabled = S.cash < c; row.buy.classList.toggle("afford", S.cash >= c); row.el.classList.remove("maxed"); }
      }
    }
    // tab badges
    const aff = { def: false, drone: false, eco: false };
    for (const t of DEF_ORDER) if (S.galaxy >= DEF_TYPES[t].gal && S.cash >= unitBuyCost(t)) aff.def = true;
    for (const t of COL_ORDER) if (S.galaxy >= COL_TYPES[t].gal && S.cash >= unitBuyCost(t)) aff.drone = true;
    for (const u of UPS) { if (aff[u.tab]) continue; if (u.max != null && S.lv[u.id] >= u.max) continue; if (S.cash >= upCost(u)) aff[u.tab] = true; }
    for (const k in tabBtns) tabBtns[k].classList.toggle("has-buy", !!aff[k]);
  }

  function renderList() {
    const wrap = $("up-list"); wrap.innerHTML = ""; listRows = {};
    if (activeTab === "def" || activeTab === "drone") {
      const order = activeTab === "def" ? DEF_ORDER : COL_ORDER, col = activeTab === "def" ? "#fff" : "var(--drone)";
      for (const type of order) {
        const el = document.createElement("div"); el.className = "up";
        el.innerHTML = `<span class="u-dot" style="background:${col}"></span><div class="u-mid"><div class="u-name">${TY(type).name}</div><div class="u-desc"></div></div><button class="u-info" title="Info">i</button><button class="u-up" title="Upgrade class">⬆ Tree</button><button class="u-buy"></button>`;
        wrap.appendChild(el);
        el.querySelector(".u-info").onclick = () => showInfo(TY(type).name, type);
        el.querySelector(".u-up").onclick = () => openSkillTree(type);
        el.querySelector(".u-buy").onclick = () => buyUnit(type);
        listRows[type] = { kind: "unit", el, desc: el.querySelector(".u-desc"), buy: el.querySelector(".u-buy") };
      }
    } else {
      const col = activeTab === "drone" ? "var(--drone)" : "var(--eco)";
      for (const u of UPS) { if (u.tab !== activeTab) continue;
        const el = document.createElement("div"); el.className = "up";
        el.innerHTML = `<span class="u-dot" style="background:${col}"></span><div class="u-mid"><div class="u-name">${u.name}<span class="lv"></span></div><div class="u-desc"></div></div><button class="u-info" title="Info">i</button><button class="u-buy"></button>`;
        wrap.appendChild(el);
        el.querySelector(".u-info").onclick = () => showInfo(u.name, u.id);
        el.querySelector(".u-buy").onclick = () => buyUpgrade(u);
        listRows[u.id] = { el, lv: el.querySelector(".lv"), desc: el.querySelector(".u-desc"), buy: el.querySelector(".u-buy") };
      }
    }
    syncHUD();
  }
  function buyUnit(type) {
    const list = classList(type);
    if (S.galaxy < TY(type).gal || countType(type) >= TY(type).max) return;
    const c = unitBuyCost(type); if (S.cash < c) return;
    S.cash -= c; list.push(isCol(type) ? { type } : newUnit(type)); if (isCol(type)) syncCollectors();
    Audio_buy(); renderList(); save();
  }
  function buyUpgrade(u) {
    const lvl = S.lv[u.id]; if (u.max != null && lvl >= u.max) return;
    const c = upCost(u); if (S.cash < c) return;
    S.cash -= c; S.lv[u.id]++;
    Audio_buy(); recompute(); syncHUD(); save();
  }
  function Audio_buy() {}  // (silent build)

  /* --------------------- class skill TREE (interconnected map) ----- */
  // A real, Path-of-Exile-style skill tree: a START node at the centre with
  // three "wings". Each wing is a diamond LOOP of small nodes (so there are
  // multiple routes), feeding two stat branches into a big NOTABLE keystone and
  // an outer extra node. Adjacent wings are cross-linked, so the whole thing is
  // one connected graph. A node can only be allocated once a CONNECTED node is
  // already allocated — that is the prerequisite. Layout is shared; each class
  // names its notables differently and resolves its own stat magnitudes.
  const CLASS_WEB = {
    turret:      { keys: ["War Machine", "Marksman", "Heavy Ordnance"] },
    mortar:      { keys: ["Annihilation", "Spotter Net", "Saturation Field"] },
    plasma:      { keys: ["Overload", "Crit Cascade", "Ion Storm"] },
    laser:       { keys: ["Death Beam", "Prism Crit", "Resonant Cascade"] },
    railgun:     { keys: ["Railstorm Core", "Calibrated", "Overrail"] },
    drone:       { keys: ["Perfect Collector", "Slipstream", "Swift Magnet"] },
    swarm:       { keys: ["Locust God", "Pack Hunter", "Hive Sync"] },
    collector:   { keys: ["Mega Hauler", "Bulk Maw", "Power Magnet"] },
    magnet:      { keys: ["Magnetar Core", "Coil Reach", "Flux Drive"] },
    tractor:     { keys: ["Singularity Beam", "Tow Reach", "Beam Lock"] },
    singularity: { keys: ["Big Crunch", "Event Maw", "Tidal Lock"] },
  };
  // Each class gets its OWN tree, generated deterministically from its name:
  // a START hub with a random number of wings (3-5), each wing a chain or a
  // diamond loop of varying length, fed by its own stat, with notables and
  // keystones at the tips and some wings woven to their neighbour. Same rules
  // (allocate outward by adjacency); only the shape differs per class.
  const _trees = {};
  function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeRng(seed) { let s = (seed || 1) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function buildTree(type) {
    type = type || (typeof STree !== "undefined" && STree.type) || "turret";
    if (_trees[type]) return _trees[type];
    const R = makeRng(fnv("ids:" + type)), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const nodes = [{ id: "start", x: 0, y: 0, kind: "start", slots: [], wing: -1, nameSlot: "start", ni: 0 }], edges = [];
    const cnt = { 1: 0, 2: 0, 3: 0, x: 0 }; let keyN = 0;
    const setSpec = () => { if (CLASS_SPEC[type]) nodes[nodes.length - 1].spec = CLASS_SPEC[type]; };   // defenders only; call right after an add("K",…)
    const stats = [1, 2, 3]; for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [stats[i], stats[j]] = [stats[j], stats[i]]; }
    const deep = { turret: 0, mortar: 0, plasma: 1, laser: 1, railgun: 2 }[type] || 0;   // later classes get deeper trees
    const nW = ri(5, 7) + deep, rot = R() * Math.PI * 2;     // far more wings — bigger trees
    for (let w = 0; w < nW; w++) {
      const th = rot + w * (Math.PI * 2 / nW), ux = Math.cos(th), uy = Math.sin(th), px = Math.cos(th + Math.PI / 2), py = Math.sin(th + Math.PI / 2);
      const wid = "w" + w, stat = stats[w % 3], stat2 = stats[(w + 1) % 3];
      const step = 0.66 + R() * 0.16, dx = 0.62 + R() * 0.3, arm = ri(4, 6) + deep, loop = R() < 0.55;   // longer arms — far more nodes per wing (deeper for later classes)
      const add = (k, r, s, kind, slots) => { const ns = kind === "key" ? "key" : slots[0].p, ni = kind === "key" ? keyN++ : cnt[ns]++; nodes.push({ id: wid + k, x: ux * r + px * s, y: uy * r + py * s, kind, slots, wing: w, nameSlot: ns, ni }); };
      const e = (a, b) => edges.push([wid + a, wid + b]);
      add("E", 0.95, 0, "minor", [{ p: stat, mag: "min" }]); edges.push(["start", wid + "E"]);
      // x-branch (Process for collectors / Crit for defenders) sub-arm hanging off the
      // ENTRY node, so it's investable THROUGHOUT the tree instead of one node at the tips.
      { const xn = ri(1, 2), side = w % 2 ? 1 : -1; for (let t = 1; t <= xn; t++) { add("Y" + t, 0.95 + step * (t + 0.25), side * (1.5 + 0.3 * t), t === xn ? "major" : "minor", [{ p: "x", mag: t === xn ? "maj" : "min" }]); e(t === 1 ? "E" : "Y" + (t - 1), "Y" + t); } }
      if (loop) {
        let pL = "E", pR = "E";
        for (let t = 1; t <= arm; t++) {
          const r = 0.95 + step * t, last = t === arm;
          add("L" + t, r, -dx * (0.7 + 0.1 * t), last ? "major" : "minor", [{ p: stat, mag: last ? "maj" : "min" }]);
          add("R" + t, r, dx * (0.7 + 0.1 * t), last ? "major" : "minor", [{ p: stat2, mag: last ? "maj" : "min" }]);
          e(pL, "L" + t); e(pR, "R" + t); pL = "L" + t; pR = "R" + t;
        }
        const kr = 0.95 + step * (arm + 1.1);
        add("K", kr, 0, "key", [{ p: stat, mag: "key" }, { p: stat2, mag: "key" }]); setSpec(w); e("L" + arm, "K"); e("R" + arm, "K");
        add("S", kr + 0.85, 0, "major", [{ p: "x", mag: "maj" }]); e("K", "S");
        if (R() < 0.6) e("L1", "R1"); // rung
      } else {
        let prev = "E";
        for (let t = 1; t <= arm; t++) {
          const r = 0.95 + step * t, last = t === arm;
          add("C" + t, r, (R() - 0.5) * 0.5, last ? "major" : "minor", [{ p: stat, mag: last ? "maj" : "min" }]);
          e(prev, "C" + t); prev = "C" + t;
          if (R() < 0.5) { add("P" + t, r + 0.15, (R() < 0.5 ? -1 : 1) * (0.8 + 0.12 * t), "minor", [{ p: stat2, mag: "min" }]); e("C" + t, "P" + t); }
        }
        if (R() < 0.7) { const kr = 0.95 + step * (arm + 1); add("K", kr, 0, "key", [{ p: stat, mag: "key" }, { p: stats[(w + 2) % 3], mag: "key" }]); setSpec(w); e("C" + arm, "K"); }
        else { add("X", 0.95 + step * (arm + 1), 0, "major", [{ p: "x", mag: "maj" }]); e("C" + arm, "X"); }
      }
    }
    for (let w = 0; w < nW; w++) if (R() < 0.7) edges.push(["w" + w + "E", "w" + ((w + 1) % nW) + "E"]); // inner ring weave
    const map = {}, adj = {}; nodes.forEach(n => { map[n.id] = n; adj[n.id] = []; });
    const eds = edges.filter(([a, b]) => map[a] && map[b]);
    eds.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    _trees[type] = { nodes, edges: eds, map, adj };
    return _trees[type];
  }
  const STAT_LBL = { dmg: "dmg", rate: "rate", range: "rng", crit: "crit", speed: "spd", suction: "pull", collect: "reach", ingest: "process" };
  function slotText(type, s) {
    const col = isCol(type), amt = slotAmt(type, s);
    if (s.p === "x") return "+" + Math.round(amt * 100) + "% " + (col ? "process" : "crit");
    const key = (col ? COL_PRIM : DEF_PRIM)[s.p - 1];
    return key === "range" || key === "collect" ? "+" + amt + " " + STAT_LBL[key] : "+" + Math.round(amt * 100) + "% " + STAT_LBL[key];
  }
  const nodeFx = (type, n) => { let s = (n.slots || []).map(sl => slotText(type, sl)).join(" · "); if (n.spec) s += (s ? " · " : "") + "✦ " + SPEC_NAME[n.spec]; return s; };
  // Plain-language glossary for every stat a tree node can grant — surfaced by an
  // ⓘ button in the node panel so you always know what a boost actually does.
  const STAT_TITLE = { dmg: "Damage", rate: "Fire Rate", range: "Range", crit: "Crit", multi: "Multishot", speed: "Speed", suction: "Pull", collect: "Reach", ingest: "Process", explosive: "✦ Explosive Rounds", chain: "✦ Chain Lightning", pierce: "✦ Piercing Laser" };
  const STAT_INFO = {
    explosive: "✦ SPECIALIZATION — every shot DETONATES, dealing its full damage to all dots in a blast radius (turns the unit into a bomb tower). Each Explosive keystone makes the blast bigger.",
    chain: "✦ SPECIALIZATION — every shot ARCS like lightning from the dot it hits to nearby dots, jumping one extra time per keystone (damage fades a little each jump). Shreds clusters.",
    pierce: "✦ SPECIALIZATION — every shot becomes a LASER LANCE that punches through and hits every dot in a straight line, not just the target. More keystones = a wider beam.",
    dmg: "Damage per shot. Kills come faster, and since kills ARE your income, raw damage is your economy.",
    rate: "Fire rate (shots/sec). High enough and a unit machine-guns, firing several shots per frame.",
    range: "Targeting range (flat bonus). Wider range keeps more dots in reach, so units idle less.",
    crit: "Crit chance. A critical shot deals ~2.2× damage and pops a little extra.",
    multi: "Multishot. Each keystone lets EVERY unit of this class fire at one extra dot at the same time.",
    speed: "Movement speed — how fast this collector chases orbs. Capped so it stays agile instead of flying straight past loot.",
    suction: "Pull radius — how far it drags orbs in toward itself. Capped below the field, so it must keep roaming; it never becomes a stationary field-wide magnet.",
    collect: "Reach — how close a collector must get to an orb before it grabs and starts consuming it. More reach = it snags loot from a little further out, so less precise chasing. Collectors carry NO cash multiplier — income lives in the Economy tab.",
    ingest: "Process speed — how quickly a collector consumes the loot a dot drops once it reaches it. Big/heavy loot takes longer to process, so this matters most for fat dots and armored elites — a key drone lever.",
  };
  function nodeStats(type, n) {
    const col = isCol(type), keys = [];
    for (const s of (n.slots || [])) { const k = s.p === "x" ? (col ? "ingest" : "crit") : (col ? COL_PRIM : DEF_PRIM)[s.p - 1]; if (!keys.includes(k)) keys.push(k); }
    if (n.kind === "key" && !col && !keys.includes("multi")) keys.push("multi");
    if (n.spec) keys.push(n.spec);
    return keys;
  }
  // a small glyph showing WHAT a node upgrades (damage / rate / range / crit /
  // speed / suction / yield / ingest), plus class & keystone markers.
  const STAT_ICON = { dmg: "✸", rate: "»", range: "◎", crit: "✶", speed: "➤", suction: "◉", yield: "❖", collect: "▣", ingest: "⊛" };
  function nodeIcon(type, n) {
    if (n.kind === "start") return "★";
    if (n.kind === "key") return "✦";
    const s = n.slots[0];
    if (s.p === "x") return isCol(type) ? STAT_ICON.ingest : STAT_ICON.crit;
    return STAT_ICON[(isCol(type) ? COL_PRIM : DEF_PRIM)[s.p - 1]] || "•";
  }
  function nodeLabel(type, n) {
    if (n.kind === "start") return TY(type).name;
    if (n.kind === "key") { const ks = (CLASS_WEB[type] || CLASS_WEB.turret).keys; return ks[n.ni % ks.length] || "Keystone"; }
    const pool = n.nameSlot === "x" ? skillNames(type).x : skillNames(type)[["", "a", "b", "c"][n.nameSlot]];
    return (pool && pool[n.ni % pool.length]) || nodeFx(type, n);
  }
  function statLine(tp) {
    const s = { type: tp };
    return isCol(tp)
      ? "<b>" + Math.round(cSpeed(tp)) + "</b> spd · <b>" + Math.round(cSuction(tp)) + "</b> pull · <b>" + Math.round(cCollect(tp)) + "</b> reach · <b>×" + cIngest(tp).toFixed(2) + "</b> process"
      : "<b>" + fmt(uDmg(s)) + "</b> dmg · <b>" + uRate(s).toFixed(1) + "</b>/s · <b>" + Math.round(uRange(s)) + "</b> rng" + (uSplash(s) ? " · splash" : "") + (uCrit(s) ? " · " + Math.round(uCrit(s) * 100) + "% crit" : "") + (uMulti(s) ? " · <b>×" + (1 + uMulti(s)) + "</b> targets" : "") + (uExplode(s) ? " · <b>✦bombs</b>" : "") + (uChain(s) ? " · <b>✦chain</b>" : "") + (uPierce(s) ? " · <b>✦laser</b>" : "");
  }
  // allocation: a node is allocatable if a connected node is already allocated.
  const nodeAllocated = (type, id) => id === "start" || !!(S.classNodes[type] && S.classNodes[type][id]);
  const nodeAllocatable = (type, n) => !nodeAllocated(type, n.id) && (buildTree(type).adj[n.id] || []).some(a => nodeAllocated(type, a));
  function nodeCost(type, n) { const k = n.kind === "key" ? 20 : n.kind === "major" ? 5 : 1; return Math.floor(TY(type).base * 3 * Math.pow(1.33, allocCount(type)) * k); }   // cheap early (rewarding start), STEEP growth: deep trees are a long progressive grind (the main pacing wall)
  function allocNode(type, n) {
    if (!n || !nodeAllocatable(type, n)) return; const c = nodeCost(type, n); if (S.cash < c) return;
    S.cash -= c; (S.classNodes[type] || (S.classNodes[type] = {}))[n.id] = true; recompute(); syncHUD(); save();
  }
  // before/after stat preview if this node were allocated.
  function nodePreview(type, n) {
    const before = statLine(type), set = S.classNodes[type] || (S.classNodes[type] = {}), had = set[n.id];
    set[n.id] = true; derived.cls[type] = classStats(type);
    const after = statLine(type);
    if (!had) delete set[n.id]; derived.cls[type] = classStats(type);
    return { before, after };
  }
  function showNodeInfo(n) {
    const panel = $("st-info"), type = STree.type;
    if (!n || n.kind === "start") { panel.classList.remove("show"); STree.sel = n ? n.id : null; return; }
    STree.sel = n.id;
    const has = nodeAllocated(type, n.id), can = nodeAllocatable(type, n), cost = nodeCost(type, n), afford = S.cash >= cost, fx = nodeFx(type, n);
    $("si-name").textContent = nodeIcon(type, n) + "  " + (nodeLabel(type, n) || fx);
    $("si-tag").textContent = n.kind === "key" ? "✦ Notable Keystone" : n.kind === "major" ? "◆ Notable" : "• Passive";
    const keyDef = n.kind === "key" && !isCol(type);
    $("si-desc").textContent = n.kind === "key"
      ? (keyDef ? "A devastating keystone: +1 multishot AND unlocks/stacks a ✦ " + (SPEC_NAME[n.spec] || "specialization") + " — a crazy weapon transformation (see the ⓘ)." : "A powerful node joining two stat branches of this wing.")
      : n.kind === "major" ? "A stronger passive on this branch." : "A small passive on the path.";
    const sk = nodeStats(type, n);
    $("si-fx").innerHTML = "Grants: " + fx + (keyDef ? " · +1 simultaneous target" : "") +
      " <button class='u-info si-info' id='si-info-btn' title='What does this boost?'>i</button>";
    $("si-info-btn").onclick = () => showInfoText("What this node boosts",
      sk.map(k => "<b>" + STAT_TITLE[k] + "</b> — " + STAT_INFO[k]).join("<br><br>"));
    const btn = $("st-upgrade");
    if (has) { $("si-prev").innerHTML = "✓ Allocated · class now <span class='si-after'>" + statLine(type) + "</span>"; btn.textContent = "ALLOCATED"; btn.disabled = true; }
    else if (can) { const p = nodePreview(type, n); $("si-prev").innerHTML = "Now: " + p.before + "<br>After: <span class='si-after'>" + p.after + "</span>"; btn.textContent = "ALLOCATE · $" + fmt(cost); btn.disabled = !afford; }
    else { $("si-prev").innerHTML = "🔒 Locked — first allocate a node connected to this one."; btn.textContent = "LOCKED"; btn.disabled = true; }
    panel.classList.add("show");
  }
  const STree = {
    type: "turret", cx: 0, cy: 0, zoom: 1, t: 0, cv: null, c: null, w: 0, h: 0, sel: null,
    ptrs: new Map(), lx: 0, ly: 0, moved: false, pinchD: 0, hit: [],
    selNode() { return this.sel ? buildTree(this.type).map[this.sel] : null; },
    init() {
      this.cv = $("sttree"); if (!this.cv) return; this.c = this.cv.getContext("2d");
      this.cv.addEventListener("pointerdown", e => { this.ptrs.set(e.pointerId, this.pt(e)); this.moved = false; const p = this.pt(e); this.lx = p.x; this.ly = p.y; if (this.ptrs.size === 2) { const a = [...this.ptrs.values()]; this.pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
      this.cv.addEventListener("pointermove", e => {
        if (!this.ptrs.has(e.pointerId)) return; const p = this.pt(e); this.ptrs.set(e.pointerId, p);
        if (this.ptrs.size >= 2) { const a = [...this.ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (this.pinchD) this.zoom = clamp(this.zoom * d / this.pinchD, 0.5, 3); this.pinchD = d; this.moved = true; this.clampPan(); this.lx = p.x; this.ly = p.y; return; }
        const dx = p.x - this.lx, dy = p.y - this.ly; if (Math.hypot(dx, dy) > 5) this.moved = true; this.cx += dx; this.cy += dy; this.clampPan(); this.lx = p.x; this.ly = p.y;
      });
      const up = e => { const had = this.ptrs.size; this.ptrs.delete(e.pointerId); this.pinchD = 0; if (this.ptrs.size === 1) { const r = [...this.ptrs.values()][0]; this.lx = r.x; this.ly = r.y; } if (had === 1 && !this.moved) { const p = this.pt(e); this.tap(p.x, p.y); } };
      this.cv.addEventListener("pointerup", up); this.cv.addEventListener("pointercancel", e => { this.ptrs.delete(e.pointerId); this.pinchD = 0; });
      this.cv.addEventListener("wheel", e => { e.preventDefault(); this.zoom = clamp(this.zoom * (1 - e.deltaY * 0.0015), 0.5, 3); this.clampPan(); }, { passive: false });
    },
    pt(e) { const r = this.cv.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; },
    open(type) { this.type = type; this.sel = null; $("st-info").classList.remove("show"); this.reset(); this.resize(); },
    reset() { this.cx = 0; this.cy = 0; this.zoom = 1; },
    clampPan() { const u = Math.min(this.w, this.h) * 0.078 * this.zoom, m = 6.8 * u; this.cx = clamp(this.cx, -m, m); this.cy = clamp(this.cy, -m, m); },
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); this.clampPan(); },
    nodeRad(n, u) { return n.kind === "key" ? clamp(u * 0.30, 13, 26) : n.kind === "major" ? clamp(u * 0.22, 10, 18) : n.kind === "start" ? clamp(u * 0.26, 12, 22) : clamp(u * 0.15, 7, 12); },
    sc(nx, ny) { const u = Math.min(this.w, this.h) * 0.078 * this.zoom; return { x: this.w / 2 + this.cx + nx * u, y: this.h / 2 + this.cy + ny * u, u }; },
    render(dt) {
      if (!this.cv) return; const c = this.c, type = this.type; this.t += dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = "#000"; c.fillRect(0, 0, this.w, this.h);
      const G = buildTree(type);
      // edges: bright if both allocated, medium if one (the frontier), dim else.
      for (const [ai, bi] of G.edges) {
        const A = G.map[ai], B = G.map[bi], oa = nodeAllocated(type, ai), ob = nodeAllocated(type, bi);
        const a = this.sc(A.x, A.y), b = this.sc(B.x, B.y);
        c.globalAlpha = oa && ob ? 0.85 : oa || ob ? 0.4 : 0.13; c.strokeStyle = "#fff"; c.lineWidth = oa && ob ? 3 : 2;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
      c.globalAlpha = 1; this.hit = [];
      for (const n of G.nodes) {
        const p = this.sc(n.x, n.y), rad = this.nodeRad(n, p.u), has = nodeAllocated(type, n.id), can = nodeAllocatable(type, n), cost = nodeCost(type, n), afford = S.cash >= cost;
        this.hit.push({ n, x: p.x, y: p.y, r: rad + 7 });
        if (n.id === this.sel) { c.globalAlpha = 1; c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, rad + 7, 0, TAU); c.stroke(); }
        if (can && afford) { const pl = 0.5 + 0.5 * Math.sin(this.t * 4); c.globalAlpha = 0.35 + pl * 0.5; c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, rad + 4, 0, TAU); c.stroke(); c.globalAlpha = 1; }
        c.beginPath(); c.arc(p.x, p.y, rad, 0, TAU);
        c.fillStyle = has ? "#fff" : can ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)";
        c.strokeStyle = has || can ? "#fff" : "rgba(255,255,255,0.28)"; c.lineWidth = n.kind === "minor" ? 1.5 : 2.5; c.fill(); c.stroke();
        // icon of what this node upgrades, centred in the node
        c.fillStyle = has ? "#000" : can ? "#fff" : "rgba(255,255,255,0.55)"; c.textAlign = "center"; c.textBaseline = "middle";
        c.font = "bold " + Math.round(rad * (n.kind === "minor" ? 1.1 : 0.95)) + "px serif"; c.fillText(nodeIcon(type, n), p.x, p.y + 1);
        // every node is named (smaller for the small passives)
        c.textAlign = "center"; c.textBaseline = "alphabetic";
        c.fillStyle = has || can ? "#fff" : "rgba(255,255,255,0.5)";
        c.font = Math.round(n.kind === "minor" ? clamp(p.u * 0.11, 8, 11) : clamp(p.u * 0.13, 9, 13)) + "px ui-monospace,monospace";
        c.fillText(nodeLabel(type, n), p.x, p.y - rad - 5);
      }
      $("st-title").textContent = TY(type).name.toUpperCase();
      $("st-owned").textContent = "· " + countType(type) + " deployed · " + allocCount(type) + " nodes · affects ALL";
      $("st-stats").innerHTML = statLine(type);
    },
    tap(x, y) { let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } } if (!best) { this.sel = null; $("st-info").classList.remove("show"); return; } showNodeInfo(best.n); },
  };
  function openSkillTree(type) { selType = type; $("skilltree").classList.add("show"); STree.open(type); }
  function closeSkillTree() { $("skilltree").classList.remove("show"); }
  function sellOne() {
    const list = classList(selType), i = list.findIndex(u => u.type === selType);
    const minKeep = isCol(selType) ? (selType === "drone" ? 1 : 0) : 1;
    if (i < 0 || countType(selType) <= minKeep) return;
    S.cash += Math.round(unitBuyCost(selType) / 1.9 * 0.5);
    list.splice(i, 1); if (isCol(selType)) syncCollectors();
    renderList(); syncHUD(); save();
  }
  function showGalaxyInfo(g) {
    const current = g === S.galaxy, reached = g < S.galaxy, next = g === S.galaxy + 1, cost = travelCost(S.galaxy);
    const weps = ALL_TYPES.filter(t => TY(t).gal === g).map(t => TY(t).name);
    const action = current ? "<span class='gi-tag'>▶ You are here</span>" : reached ? "<span class='gi-tag'>Conquered ✓</span>"
      : next ? "<button id='gi-travel'" + (S.cash >= cost ? "" : " disabled") + ">Travel · $" + fmt(cost) + "</button>" : "<span class='gi-tag'>🔒 Locked</span>";
    $("gm-info").innerHTML = "<div class='gi-name'>" + galName(g) + "</div><div class='gi-desc'>" + galDesc(g) + "</div>" +
      (weps.length ? "<div class='gi-unlock'>Unlocks: " + weps.join(", ") + "</div>" : "") + "<div class='gi-act'>" + action + "</div>";
    $("gm-info").classList.add("show");
    const t = $("gi-travel"); if (t) t.onclick = () => { travel(); $("gm-info").classList.remove("show"); };
  }

  /* ------------------------- star dust + galaxy ------------------ */
  function buildSD() {
    $("ui-stardust").textContent = fmt(META.starDust);
    const wrap = $("sd-list"); wrap.innerHTML = "";
    for (const u of SDS) { const lvl = META.sd[u.id], c = sdCost(u);
      const el = document.createElement("div"); el.className = "up";
      el.innerHTML = `<span class="u-dot" style="background:var(--sd)"></span><div class="u-mid"><div class="u-name">${u.name}<span class="lv">Lv ${lvl}</span></div><div class="u-desc">${u.desc(lvl)}</div></div><button class="u-info" title="Info">i</button><button class="u-buy">✦ ${c}</button>`;
      wrap.appendChild(el); el.querySelector(".u-info").onclick = () => showInfo(u.name, u.id); const b = el.querySelector(".u-buy"); b.disabled = META.starDust < c;
      b.onclick = () => { if (META.starDust < sdCost(u)) return; META.starDust -= sdCost(u); META.sd[u.id]++; recompute(); buildSD(); syncHUD(); save(); };
    }
  }
  const INFO = {
    turret: "ALL-ROUNDER backbone — cheap, fast single-target. Even damage vs everything. Signature keystone: ✦ Chain Lightning. Smallest tree.",
    mortar: "SWARM-CLEARER — splash shells, ×2.2 damage to weak/small dots (but barely scratches armor). Signature: ✦ Explosive Rounds. Deeper tree than turret.",
    plasma: "ANTI-TANK — heavy bolts, ×2.4 vs armored/tanky dots. Signature: ✦ Chain Lightning. Deep, strong tree.",
    laser: "SWARM-SHREDDER — rapid beam, ×2.6 vs fast/weak swarms (weak vs armor). Signature: ✦ Piercing Laser. Deep tree, scales hard with crit.",
    railgun: "ARMOR SNIPER — devastating ×4 damage to armored/tanky dots (weak vs swarms). Signature: ✦ Piercing Laser. Huge, top-tier tree.",
    drone: "Fast, agile collector — chases the nearest cash orb. Its tree is about Speed & Ingest (how quickly it swallows loot), not a big magnet pull. Field up to 4.",
    swarm: "Faster with a wider net — covers more of the field than a lone drone.",
    collector: "Heavy hauler: big pull radius & grab size, higher yield per orb.",
    magnet: "Strong long-range magnetic pull and high yield.",
    tractor: "Very wide tractor beam that sweeps huge areas of orbs.",
    singularity: "Black hole — hovers centre-field and slowly drags EVERY orb (and nearby dots) inward. Huge reach & yield.",
    capacity: "Your cash ceiling — how much money you can hold at once. Raise it to afford big buys and travel; it also caps offline earnings.",
    value: "A FLAT +8% cash per dot per level (additive — it doesn't compound, so no runaway). Also ramps dot 'menace' — tougher dots, armored elites and exotic kinds appear (and pay more) as you invest.",
    spawnRate: "More dots appear per second = more targets and income, up to the on-screen cap.",
    luck: "Chance for rare SPECIAL dots worth about 9× normal cash. A slow +0.1% per level.",
    frenzy: "All defenders fire ~5× faster for 6 seconds. Cooldown 45s — save it for dense screens.",
    dotrain: "Instantly floods the field with extra dots to pop. Cooldown 40s.",
    blackhole: "Drags every dot to the centre and crushes them over 5s. Cooldown 60s.",
    sdDmg: "+25% damage per level — kept forever across every run (survives Rebirth).",
    sdInc: "+25% cash income per level — permanent across runs.",
    sdFire: "+15% fire rate per level — permanent across runs.",
    sdStart: "Begin each new run with a chunk of starting cash.",
  };
  function showInfo(title, id) { $("info-title").textContent = title; $("info-text").textContent = INFO[id] || ""; $("info-modal").classList.add("show"); }
  function showInfoText(title, html) { $("info-title").textContent = title; $("info-text").innerHTML = html; $("info-modal").classList.add("show"); }
  function buildMetrics() {
    const s = stat();
    const sec = (t, h) => `<div class="met-sec"><h3>${t}</h3>${h}</div>`;
    const grid = h => `<div class="met-grid">${h}</div>`;
    const row = (k, v) => `<div class="met-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const bar = (k, v, pct) => `<div class="met-bar"><div class="bl"><span class="k">${k}</span><span class="v">${v}</span></div><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
    const empty = t => `<div class="met-empty">${t}</div>`;
    const killNames = { draw: "Draw-to-pop", blackhole: "Black Hole ability" };
    const ke = Object.keys(s.kills).filter(k => s.kills[k] > 0).map(k => ({ n: s.kills[k], label: TY(k) ? TY(k).name : (killNames[k] || k) })).sort((a, b) => b.n - a.n);
    const tk = ke.reduce((a, e) => a + e.n, 0) || 1;
    const ce = COL_ORDER.filter(t => s.collected[t] > 0).map(t => ({ v: s.collected[t], label: TY(t).name })).sort((a, b) => b.v - a.v);
    const tc = ce.reduce((a, e) => a + e.v, 0) || 1;
    const defFleet = DEF_ORDER.filter(t => countType(t) > 0).map(t => `${TY(t).name} ×${countType(t)}`).join(" · ") || "—";
    const colFleet = COL_ORDER.filter(t => countType(t) > 0).map(t => `${TY(t).name} ×${countType(t)}`).join(" · ") || "—";
    let nodes = 0; ALL_TYPES.forEach(t => nodes += allocCount(t));
    $("metrics-body").innerHTML =
      sec("Time &amp; progress", grid(
        row("Played (total)", fmtTime(s.playSec)) + row("This run", fmtTime(S.runSec)) +
        row("Galaxy", S.galaxy + " · " + galName(S.galaxy)) + row("Peak galaxy", S.peakGalaxy) +
        row("Travels", s.travels) + row("Rebirths", s.rebirths))) +
      sec("Economy", grid(
        row("Cash / sec", "$" + fmt(cps)) + row("Capacity", "$" + fmt(derived.capacity)) +
        row("Earned this run", "$" + fmt(S.totalRun)) + row("Earned all-time", "$" + fmt(META.totalEver)) +
        row("Star Dust", "✦ " + fmt(META.starDust)) + row("Skill nodes", nodes) +
        row("Cash lost (uncollected)", "$" + fmt(s.lostCash || 0)))) +
      sec("Combat", grid(
        row("Dots popped", fmt(s.dotsPopped)) + row("Special dots", fmt(s.specials)) + row("Armored killed", fmt(s.armored || 0)) +
        row("On screen now", dots.length) + row("Avg pops / min", s.playSec > 1 ? fmt(Math.round(s.dotsPopped / s.playSec * 60)) : "0"))) +
      sec("Destroyed by", ke.length ? ke.map(e => bar(e.label, fmt(e.n) + " · " + Math.round(e.n / tk * 100) + "%", e.n / tk * 100)).join("") : empty("No kills yet")) +
      sec("Cash collected by", ce.length ? ce.map(e => bar(e.label, "$" + fmt(e.v) + " · " + Math.round(e.v / tc * 100) + "%", e.v / tc * 100)).join("") : empty("Nothing collected yet")) +
      sec("Abilities used", grid(row("⚡ Frenzy", s.abilities.frenzy) + row("▽ Dot Rain", s.abilities.dotrain) + row("◉ Black Hole", s.abilities.blackhole))) +
      sec("Fleet", empty("<b style='color:#fff'>Defenders:</b> " + defFleet) + empty("<b style='color:#fff'>Collectors:</b> " + colFleet));
  }
  // interactive pseudo-3D black & white star map
  const GMap = {
    open: false, yaw: 0.5, pitch: -0.82, zoom: 1, t: 0, cv: null, c: null, w: 0, h: 0,
    reset() { this.yaw = 0.5; this.pitch = -0.82; this.zoom = 1; },
    ptrs: new Map(), lx: 0, ly: 0, moved: false, pinchD: 0, hit: [], stars: [], sel: 0,
    init() {
      this.cv = $("gmap"); if (!this.cv) return; this.c = this.cv.getContext("2d");
      this.cv.addEventListener("pointerdown", e => { this.ptrs.set(e.pointerId, this.pt(e)); this.moved = false; const p = this.pt(e); this.lx = p.x; this.ly = p.y; if (this.ptrs.size === 2) { const a = [...this.ptrs.values()]; this.pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
      this.cv.addEventListener("pointermove", e => {
        if (!this.ptrs.has(e.pointerId)) return; const p = this.pt(e); this.ptrs.set(e.pointerId, p);
        if (this.ptrs.size >= 2) { const a = [...this.ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (this.pinchD) this.zoom = clamp(this.zoom * d / this.pinchD, 0.4, 3.5); this.pinchD = d; this.moved = true; this.lx = p.x; this.ly = p.y; return; }
        const dx = p.x - this.lx, dy = p.y - this.ly; if (Math.hypot(dx, dy) > 6) this.moved = true; this.yaw += dx * 0.01; this.pitch = clamp(this.pitch - dy * 0.01, -1.2, 1.2); this.lx = p.x; this.ly = p.y;
      });
      const up = e => { const had = this.ptrs.size; this.ptrs.delete(e.pointerId); this.pinchD = 0; if (this.ptrs.size === 1) { const r = [...this.ptrs.values()][0]; this.lx = r.x; this.ly = r.y; } if (had === 1 && !this.moved) { const p = this.pt(e); this.tap(p.x, p.y); } };
      this.cv.addEventListener("pointerup", up); this.cv.addEventListener("pointercancel", e => { this.ptrs.delete(e.pointerId); this.pinchD = 0; });
      this.cv.addEventListener("wheel", e => { e.preventDefault(); this.zoom = clamp(this.zoom * (1 - e.deltaY * 0.0015), 0.4, 3.5); }, { passive: false });
    },
    pt(e) { const r = this.cv.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; },
    show() { this.open = true; this.resize(); if (!this.stars.length) for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random(), y: Math.random(), r: rnd(0.4, 1.5) }); $("gm-info").classList.remove("show"); },
    hide() { this.open = false; },
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); },
    proj(x, y, z) { const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); let x1 = x * cy + z * sy, z1 = -x * sy + z * cy; const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch); let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const f = 360 / (360 + z2 + 360) * this.zoom; return { x: this.w / 2 + x1 * f, y: this.h * 0.5 + y1 * f, z: z2, f }; },
    // each galaxy orbits the central black hole on its own ring (XZ plane);
    // outer galaxies orbit slower. Position depends on this.t so they drift.
    orbitR(g) { return 34 + g * 15; },
    node(g) { const R = this.orbitR(g), sp = 0.16 / Math.sqrt(g), ang = g * 2.39963 + this.t * sp; return { x: Math.cos(ang) * R, y: 0, z: Math.sin(ang) * R }; },
    blackHole(p) {
      const c = this.c, r = clamp(26 * p.f, 12, 48), rot = this.t * 0.6;
      for (let k = 0; k < 3; k++) { c.globalAlpha = 0.55 - k * 0.14; c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r * (0.55 + k * 0.3), rot + k, rot + k + 4.3); c.stroke(); }
      c.globalAlpha = 1; c.fillStyle = "#000"; c.beginPath(); c.arc(p.x, p.y, r * 0.5, 0, TAU); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke();
      c.globalAlpha = 0.6; c.fillStyle = "#fff"; c.font = "10px ui-monospace,monospace"; c.textAlign = "center"; c.fillText("BLACK HOLE", p.x, p.y - r - 6); c.globalAlpha = 1;
    },
    cluster(cx, cy, scale, bright, rot) {
      const c = this.c, n = 22;
      for (let k = 0; k < n; k++) { const tk = k / n, ang = tk * 6.2 + rot, r = tk * scale, x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.62; c.globalAlpha = bright * (1 - tk * 0.55); c.fillStyle = "#fff"; c.fillRect(x, y, 1.6, 1.6); }
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.55); g.addColorStop(0, "rgba(255,255,255," + bright + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, scale * 0.55, 0, TAU); c.fill(); c.globalAlpha = 1;
    },
    render(dt) {
      if (!this.cv) return; const c = this.c;
      this.t += dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = "#000"; c.fillRect(0, 0, this.w, this.h);
      c.fillStyle = "#fff"; for (const s of this.stars) { c.globalAlpha = 0.2 + 0.35 * Math.abs(Math.sin(this.t + s.x * 9)); c.fillRect(s.x * this.w, s.y * this.h, s.r, s.r); } c.globalAlpha = 1;
      const maxG = Math.max(10, S.peakGalaxy, S.galaxy);
      // orbit trajectories (white ellipses) — projected rings in the XZ plane
      for (let g = 1; g <= maxG; g++) {
        const R = this.orbitR(g), cur = g === S.galaxy, seld = g === this.sel;
        c.beginPath();
        for (let k = 0; k <= 72; k++) { const a = k / 72 * TAU, pr = this.proj(Math.cos(a) * R, 0, Math.sin(a) * R); k ? c.lineTo(pr.x, pr.y) : c.moveTo(pr.x, pr.y); }
        c.globalAlpha = seld ? 0.95 : cur ? 0.55 : 0.18; c.strokeStyle = "#fff"; c.lineWidth = seld ? 3 : cur ? 2 : 1; c.stroke();
      }
      c.globalAlpha = 1;
      const pts = []; for (let g = 1; g <= maxG; g++) { const w = this.node(g); pts.push({ g, p: this.proj(w.x, w.y, w.z) }); }
      const order = pts.slice().sort((a, b) => b.p.z - a.p.z); this.hit = []; const hole = this.proj(0, 0, 0); let drewHole = false;
      for (const it of order) {
        if (!drewHole && it.p.z <= 0) { this.blackHole(hole); drewHole = true; }
        const g = it.g, p = it.p, current = g === S.galaxy, reached = g < S.galaxy, next = g === S.galaxy + 1;
        const scale = clamp(22 * p.f, 7, 54), bright = current ? 1 : reached ? 0.85 : next ? 0.8 : 0.32;
        this.hit.push({ g, x: p.x, y: p.y, r: Math.max(scale * 0.7, 24) });
        if (current || g === this.sel) { const pulse = 0.5 + 0.5 * Math.sin(this.t * 4); c.strokeStyle = "rgba(255,255,255," + (0.35 + pulse * 0.5) + ")"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, scale * 0.7 + 6 + pulse * 4, 0, TAU); c.stroke(); }
        this.cluster(p.x, p.y, scale, bright, this.t * 0.3 + g);
        c.globalAlpha = clamp(p.f, 0.4, 1); c.textAlign = "center"; c.fillStyle = (reached || current || next) ? "#fff" : "rgba(255,255,255,0.5)"; c.font = Math.round(11 * clamp(p.f, 0.65, 1.4)) + "px ui-monospace,monospace";
        c.fillText((current ? "▶ " : "") + galName(g), p.x, p.y - scale * 0.7 - 8);
        c.globalAlpha = 1;
      }
      if (!drewHole) this.blackHole(hole);
    },
    tap(x, y) { let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } } if (best) { this.sel = best.g; showGalaxyInfo(best.g); } },
  };
  function travel() { const c = travelCost(S.galaxy); if (S.cash < c) return; S.cash -= c; S.galaxy++; META.stats.travels++; if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy; dots = []; orbs = []; parts = []; flashAdd(0.7); shakeAdd(6); ring(W / 2, H / 2, 10, Math.max(W, H), 0.6); recompute(); syncHUD(); save(); }
  function rebirthGain() { return Math.floor(5 + Math.max(0, S.peakGalaxy - 9) * 6 + Math.cbrt(S.totalRun + 1) * 0.5); }
  function openRebirth() { if (S.galaxy < 10 && S.peakGalaxy < 10) return; $("rb-text").textContent = "Reset this run (cash, defenders & upgrades wiped) to bank Star Dust for permanent upgrades."; $("rb-gain").textContent = "✦ +" + fmt(rebirthGain()) + " Star Dust"; $("rebirth-modal").classList.add("show"); }
  function doRebirth() {
    META.starDust += rebirthGain(); META.stats.rebirths++; const keep = META; S = fresh(); META = keep;
    if (META.sd.sdStart > 0) S.cash = 50 * Math.pow(6, META.sd.sdStart);
    dots = []; orbs = []; beams = []; parts = []; spawnAcc = 0; cps = 0; drones = []; selUnit = -1; flashAdd(0.85); shakeAdd(12);
    syncCollectors(); recompute(); $("rebirth-modal").classList.remove("show"); renderList(); buildSD(); syncHUD(); save();
  }

  /* ----------------------------- screens ------------------------- */
  function setScreen(s) {
    state = s;
    $("home").classList.toggle("show", s === "home");
    $("top").style.display = (s === "play") ? "flex" : "none";
    $("dock").style.display = (s === "play") ? "block" : "none";
    $("btn-menu").style.display = (s === "play") ? "block" : "none";
    $("btn-metrics").style.display = (s === "play") ? "block" : "none";
    if (s === "home") { $("home-gal").textContent = S.peakGalaxy; $("home-sd").textContent = fmt(META.starDust); }
  }

  /* ----------------------------- input --------------------------- */
  function ptr(e) { const r = canvas.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
  function unitAt(x, y) { const n = S.units.length; for (let i = 0; i < n; i++) { const p = unitPos(i, n); if ((p.x - x) ** 2 + (p.y - y) ** 2 <= 24 * 24) return i; } return -1; }
  canvas.addEventListener("pointerdown", e => {
    if (state !== "play") return;
    const p = ptr(e), ui = unitAt(p.x, p.y);
    if (ui >= 0) { openSkillTree(S.units[ui].type); return; }
    collectAt(p.x, p.y);
    drawing = true; lastDraw = p; brushAt(p.x, p.y);
  });
  canvas.addEventListener("pointermove", e => {
    if (!drawing || state !== "play") return;
    const p = ptr(e), dx = p.x - lastDraw.x, dy = p.y - lastDraw.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / 14));
    for (let i = 1; i <= steps; i++) { const bx = lastDraw.x + dx * i / steps, by = lastDraw.y + dy * i / steps; brushAt(bx, by); collectAt(bx, by); }
    lastDraw = p;
  });
  const endDraw = () => { drawing = false; };
  canvas.addEventListener("pointerup", endDraw); canvas.addEventListener("pointercancel", endDraw); canvas.addEventListener("pointerleave", endDraw);

  /* ----------------------------- wiring -------------------------- */
  for (const t of document.querySelectorAll(".tab[data-tab]")) { tabBtns[t.dataset.tab] = t; t.onclick = () => { activeTab = t.dataset.tab; for (const k in tabBtns) tabBtns[k].classList.toggle("sel", tabBtns[k] === t); renderList(); }; }
  $("ab-frenzy").onclick = () => useAbility("frenzy"); $("ab-dotrain").onclick = () => useAbility("dotrain"); $("ab-blackhole").onclick = () => useAbility("blackhole");
  for (const i of document.querySelectorAll(".ab-i")) i.onclick = e => { e.stopPropagation(); const k = i.dataset.info; showInfo({ frenzy: "Frenzy", dotrain: "Dot Rain", blackhole: "Black Hole" }[k], k); };
  $("info-close").onclick = $("info-back").onclick = () => $("info-modal").classList.remove("show");
  $("btn-travel").onclick = travel; $("btn-rebirth").onclick = openRebirth; $("rb-confirm").onclick = doRebirth; $("rb-close").onclick = () => $("rebirth-modal").classList.remove("show");
  $("btn-sd").onclick = () => { buildSD(); $("sd-shop").classList.add("show"); }; $("sd-close").onclick = () => $("sd-shop").classList.remove("show");
  $("galaxy-open").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); }; $("gm-close").onclick = () => { $("galaxy-map").classList.remove("show"); GMap.hide(); };
  $("st-close").onclick = closeSkillTree; $("st-sell").onclick = sellOne;
  $("st-upgrade").onclick = () => {
    const type = STree.type, node = STree.selNode(); if (!node || !nodeAllocatable(type, node)) return;
    allocNode(type, node);
    // keep showing this node (now allocated) so the panel updates; if it leads
    // onward to a single newly-reachable node, hop the selection there.
    const G = buildTree(type), onward = (G.adj[node.id] || []).map(a => G.map[a]).filter(m => nodeAllocatable(type, m));
    showNodeInfo(onward.length === 1 ? onward[0] : node);
  };
  $("gm-reset").onclick = () => GMap.reset(); $("st-reset").onclick = () => STree.reset();
  $("btn-metrics").onclick = () => { buildMetrics(); $("metrics").classList.add("show"); };
  $("metrics-close").onclick = $("metrics-back").onclick = () => $("metrics").classList.remove("show");
  $("dock-toggle").onclick = () => { const d = $("dock"); const min = d.classList.toggle("min"); $("dock-toggle").textContent = min ? "▴ Menu" : "▾ Minimise"; };
  $("btn-menu").onclick = () => $("menu").classList.add("show");
  $("menu-close").onclick = () => $("menu").classList.remove("show");
  $("menu-resume").onclick = () => $("menu").classList.remove("show");
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress (including Star Dust)?")) wipeSave(); };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  $("home-play").onclick = () => { renderList(); setScreen("play"); };
  $("home-galaxies").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); };
  $("home-how").onclick = () => $("how").classList.add("show");
  $("how-close").onclick = $("how-back").onclick = () => $("how").classList.remove("show");
  $("home-reset").onclick = () => { if (confirm("Erase ALL progress?")) wipeSave(); };

  /* ----------------------------- loop / boot --------------------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const dr of drones) { dr.x = clamp(dr.x, 0, W); dr.y = clamp(dr.y, 0, H); }
    if (GMap.open) GMap.resize();
    if ($("skilltree").classList.contains("show")) STree.resize();
  }
  window.addEventListener("resize", resize);
  let last = 0, saveAcc = 0;
  function loop(now) { let dt = (now - last) / 1000 || 0; last = now; if (dt > 0.05) dt = 0.05; update(dt); render(); syncHUD(); if (GMap.open) GMap.render(dt); if ($("skilltree").classList.contains("show")) STree.render(dt); saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; save(); } requestAnimationFrame(loop); }

  load(); resize(); syncCollectors(); renderList(); GMap.init(); STree.init(); setScreen("home");
  if (S._welcome) { $("welcome-text").textContent = "Your defenders kept firing for " + fmtTime(S._welcome.elapsed) + "."; $("welcome-cash").textContent = "$" + fmt(S._welcome.gain); $("welcome").classList.add("show"); S._welcome = null; }
  window.addEventListener("beforeunload", save);
  requestAnimationFrame(loop);

  if (typeof window !== "undefined") window.__IDS = { S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, parts: () => parts, shake: () => shake, drones: () => drones, units: () => S.units, collectors: () => S.collectors, uDmg, uRate, cSpeed, cSuction, cCollect, cYield, brushAt, collectAt, useAbility, travel, doRebirth, rebirthGain, fmt, buyUnit, buyUp: id => buyUpgrade(UP[id]), upCost: id => upCost(UP[id]), buildTree, allocNode, nodeAllocatable, nodeAllocated, nodeLabel, classStats: t => classStats(t), unitPos, openSkillTree, showNodeInfo, showInfo, sellOne, showGalaxyInfo, recompute, setScreen, abil: () => abil, travelCost, galSpawnMul, galCap, state: () => state, GMap, STree, isCol };
})();
