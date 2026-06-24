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
  const DEF_TYPES = {
    turret:  { name: "Turret",  base: 60,     gal: 1, dmg: 5,  rate: 1.4, range: 240, splash: 0 },
    mortar:  { name: "Mortar",  base: 500,    gal: 2, dmg: 9,  rate: 0.6, range: 215, splash: 55 },
    plasma:  { name: "Plasma",  base: 4000,   gal: 3, dmg: 26, rate: 0.5, range: 320, splash: 0 },
    laser:   { name: "Laser",   base: 30000,  gal: 5, dmg: 3,  rate: 4.2, range: 230, splash: 0 },
    railgun: { name: "Railgun", base: 250000, gal: 7, dmg: 90, rate: 0.3, range: 430, splash: 0 },
  };
  const DEF_ORDER = ["turret", "mortar", "plasma", "laser", "railgun"];
  /* ----------------------- collector types ----------------------- */
  // Collectors gather the cash orbs dots drop. Like defenders they come in
  // classes you buy more of, each with its OWN skill tree. "hole" mode = a
  // black-hole vacuum that slowly drags every orb (and nearby dots) inward.
  const COL_TYPES = {
    drone:       { name: "Drone",          base: 300,        gal: 1, speed: 110, suction: 70,  collect: 16, yield: 1.0, mode: "chase", sides: 4 },
    swarm:       { name: "Drone Swarm",    base: 9000,       gal: 2, speed: 165, suction: 100, collect: 22, yield: 1.2, mode: "swarm", sides: 3 },
    collector:   { name: "Heavy Collector",base: 120000,     gal: 3, speed: 120, suction: 135, collect: 34, yield: 1.5, mode: "chase", sides: 6 },
    magnet:      { name: "Magnet Rig",     base: 1800000,    gal: 4, speed: 150, suction: 190, collect: 42, yield: 1.9, mode: "chase", sides: 5 },
    tractor:     { name: "Tractor Array",  base: 26000000,   gal: 5, speed: 135, suction: 265, collect: 54, yield: 2.3, mode: "chase", sides: 8 },
    singularity: { name: "Black Hole",     base: 350000000,  gal: 6, speed: 50,  suction: 390, collect: 72, yield: 2.8, mode: "hole",  sides: 0 },
  };
  const COL_ORDER = ["drone", "swarm", "collector", "magnet", "tractor", "singularity"];
  const ALL_TYPES = [...DEF_ORDER, ...COL_ORDER];
  const isCol = type => !!COL_TYPES[type];
  const TY = type => DEF_TYPES[type] || COL_TYPES[type];
  const newUnit = type => ({ type, cd: rnd(0, 0.4) });
  const classList = type => isCol(type) ? S.collectors : S.units;
  const countType = type => classList(type).filter(u => u.type === type).length;
  const unitBuyCost = type => Math.floor(TY(type).base * Math.pow(1.9, countType(type)));
  // ---- class skill tree: an interconnected node MAP. Each class allocates
  // nodes outward from a start node; a node can only be taken once a CONNECTED
  // node is already allocated. Aggregated bonuses live in derived.cls[type].
  const DEF_PRIM = ["dmg", "rate", "range"], COL_PRIM = ["speed", "suction", "yield"];
  const MAG = { mul: { min: 0.10, maj: 0.22, key: 0.16 }, range: { min: 16, maj: 34, key: 24 }, crit: { min: 0.06, maj: 0.10, key: 0.06 }, collect: { min: 4, maj: 8, key: 5 } };
  const allocCount = type => { const m = S.classNodes[type]; let n = 0; if (m) for (const k in m) if (m[k]) n++; return n; };
  function slotAmt(type, s) {
    const col = isCol(type);
    if (s.p === "x") return col ? MAG.collect[s.mag] : MAG.crit[s.mag];
    const key = (col ? COL_PRIM : DEF_PRIM)[s.p - 1];
    return key === "range" ? MAG.range[s.mag] : MAG.mul[s.mag];
  }
  function classStats(type) {
    const col = isCol(type), prim = col ? COL_PRIM : DEF_PRIM;
    const o = { dmg: 1, rate: 1, range: 0, crit: 0, speed: 1, suction: 1, yield: 1, collect: 0 };
    const A = S.classNodes[type], G = buildTree();
    if (A) for (const id in A) { if (!A[id]) continue; const n = G.map[id]; if (!n || !n.slots) continue;
      for (const s of n.slots) { const amt = slotAmt(type, s);
        if (s.p === "x") { if (col) o.collect += amt; else o.crit += amt; }
        else { const key = prim[s.p - 1]; if (key === "range") o.range += amt; else o[key] += amt; } } }
    return o;
  }
  const ZERO = { dmg: 1, rate: 1, range: 0, crit: 0, speed: 1, suction: 1, yield: 1, collect: 0 };
  const cls = type => (derived.cls && derived.cls[type]) || ZERO;
  const uDmg = u => DEF_TYPES[u.type].dmg * cls(u.type).dmg * derived.sdDmg;
  const uRate = u => DEF_TYPES[u.type].rate * cls(u.type).rate * derived.sdFire;
  const uRange = u => DEF_TYPES[u.type].range + cls(u.type).range;
  const uCrit = u => Math.min(0.85, cls(u.type).crit);
  const uCritMul = u => 2.2;
  const uSplash = u => DEF_TYPES[u.type].splash ? DEF_TYPES[u.type].splash + cls(u.type).range * 0.4 : 0;
  const cSpeed   = type => COL_TYPES[type].speed   * cls(type).speed;
  const cSuction = type => COL_TYPES[type].suction * cls(type).suction;
  const cCollect = type => COL_TYPES[type].collect + cls(type).collect;
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
  // collector skill webs: a=Speed, b=Suction, c=Yield, x=Grab/Collect
  const COL_SKILLS = {
    drone:       { a: ["Light Frame", "Tuned Rotors", "Boosters", "Ion Thrust", "Slipstream", "Quick Servos", "Overdrive"], b: ["Magnet", "Wide Field", "Tractor Coil", "Graviton Pull", "Event Field", "Strong Coil", "Deep Pull"], c: ["Bigger Scoop", "Compactor", "Refinery", "Cash Sense", "Midas Touch", "Smelter", "Gold Logic"], x: ["Wide Scoop", "Cargo Bay", "Vault"] },
    swarm:       { a: ["Hive Mind", "Sync Wings", "Formation", "Overswarm", "Locust Dash", "Fast Hive", "Blitz"], b: ["Net Cast", "Mesh Field", "Swarm Pull", "Hive Gravity", "Total Sweep", "Wide Mesh", "Dragnet"], c: ["Many Hands", "Bulk Haul", "Hive Vault", "Pack Bonus", "Golden Swarm", "Rich Hive", "Gold Rush"], x: ["Big Net", "Hive Hold", "Treasury"] },
    collector:   { a: ["Servo Boost", "Heavy Treads", "Turbo", "Afterburner", "Warp Frame", "Quick Haul", "Blink Drive"], b: ["Big Magnet", "Wide Maw", "Gravity Plate", "Pull Field", "Vortex", "Strong Maw", "Black Maw"], c: ["Cargo Hold", "Crusher", "Smelter", "Bulk Bonus", "Gold Press", "Rich Hold", "Mint"], x: ["Maw Bay", "Cargo Bay", "Strongbox"] },
    magnet:      { a: ["Spin Up", "Coil Tune", "Rail Drive", "Mag-Lev", "Flux Dash", "Quick Coil", "Overspin"], b: ["Dipole", "Quad Coil", "Field Bloom", "Deep Pull", "Magnetar", "Strong Dipole", "Pole Reversal"], c: ["Bin", "Pack Rat", "Foundry", "Yield Coil", "Midas Coil", "Rich Bin", "Gold Coil"], x: ["Wide Coil", "Storage Coil", "Bullion"] },
    tractor:     { a: ["Emitter Tune", "Beam Drive", "Phase Step", "Warp Coil", "Lightspeed", "Quick Beam", "Hyperdrive"], b: ["Cone Cast", "Wide Beam", "Tow Field", "Deep Tow", "Star Reach", "Broad Beam", "Long Reach"], c: ["Hopper", "Baler", "Processor", "Beam Bonus", "Gold Beam", "Rich Hopper", "Goldsmith"], x: ["Wide Cone", "Hold Beam", "Reserve"] },
    singularity: { a: ["Drift Control", "Orbit Tune", "Wander", "Roam Field", "Phase Drift", "Slow Roll", "Free Orbit"], b: ["Deeper Well", "Wider Horizon", "Tidal Force", "Crushing Pull", "Infinite Reach", "Gravity Sink", "Abyssal Pull"], c: ["Accretion", "Compression", "Mass Yield", "Hawking Cash", "Quasar", "Rich Disk", "Goldhole"], x: ["Event Maw", "Mass Vault", "Singularity Core"] },
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
    { id: "capacity",  tab: "eco", name: "Capacity",   base: 10, mul: 1.27, desc: () => "$" + fmt(derived.capacity) },
    { id: "value",     tab: "eco", name: "Value",      base: 16, mul: 1.22, desc: () => "×" + derived.valueMul.toFixed(2) + " /dot" },
    { id: "spawnRate", tab: "eco", name: "Spawn Rate", base: 24, mul: 1.21, desc: () => derived.spawnPerSec.toFixed(1) + " /s" },
    { id: "luck",      tab: "eco", name: "Luck",       base: 70, mul: 1.24, max: 25, desc: () => Math.round(derived.luck * 100) + "% special" },
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
  const travelCost = g => Math.floor(800 * Math.pow(7, g - 1));
  const enemyHpMul = g => Math.pow(2.4, g - 1);
  const galValueMul = g => Math.pow(2.0, g - 1);
  const galSpawnMul = g => 1 + (g - 1) * 0.85;          // far more dots in later galaxies
  const galCap = g => Math.min(70 + g * 45, 340);

  /* ----------------------------- state --------------------------- */
  let S, derived = {}, META, state = "home";
  function fresh() {
    const lv = {}; UPS.forEach(u => lv[u.id] = 0);
    const classNodes = {}; ALL_TYPES.forEach(t => classNodes[t] = {});
    return { cash: 0, galaxy: 1, lv, classNodes, units: [newUnit("turret")], collectors: [{ type: "drone" }], totalRun: 0, peakGalaxy: 1 };
  }
  function freshMeta() { const sd = {}; SDS.forEach(u => sd[u.id] = 0); return { starDust: 0, sd, totalEver: 0 }; }

  let dots = [], orbs = [], beams = [], drones = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0;
  let drawing = false, lastDraw = null, trail = [], selUnit = -1, selType = "turret";
  let abil = { frenzy: 0, dotrain: 0, blackhole: 0 }, frenzyT = 0, blackholeT = 0;
  const ABIL_CD = { frenzy: 45, dotrain: 40, blackhole: 60 };
  let activeTab = "def", listRows = {}, tabBtns = {};

  function recompute() {
    const L = S.lv, m = META;
    derived.sdDmg = 1 + 0.25 * m.sd.sdDmg;
    derived.sdFire = (1 + 0.15 * m.sd.sdFire) * (frenzyT > 0 ? 5 : 1);
    derived.incomeMul = 1 + 0.25 * m.sd.sdInc;
    derived.capacity = 200 * Math.pow(1.7, L.capacity);
    derived.valueMul = Math.pow(1.25, L.value);
    derived.spawnPerSec = 0.9 + 0.4 * L.spawnRate;
    derived.luck = Math.min(0.5, 0.02 * L.luck);
    derived.cls = {}; for (const t of ALL_TYPES) derived.cls[t] = classStats(t);
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v2";
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, META, ts: Date.now(), cps })); } catch (e) {} }
  function load() {
    S = fresh(); META = freshMeta(); let off = null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {}); if (!S.units || !S.units.length) S.units = [newUnit("turret")]; S.units.forEach(u => { u.cd = u.cd || 0; }); if (!S.classNodes || typeof S.classNodes !== "object") S.classNodes = {}; ALL_TYPES.forEach(t => { if (!S.classNodes[t]) S.classNodes[t] = {}; }); if (!Array.isArray(S.collectors) || !S.collectors.length) { const n = 1 + (d.S.lv && d.S.lv.drones || 0); S.collectors = []; for (let i = 0; i < n; i++) S.collectors.push({ type: "drone" }); } }
        if (d.META) { META = Object.assign(freshMeta(), d.META); META.sd = Object.assign(freshMeta().sd, d.META.sd || {}); }
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

  function spawnDot(special) {
    const g = S.galaxy, hp = 5 * enemyHpMul(g) * rnd(0.8, 1.6);
    special = special || Math.random() < derived.luck;
    const val = Math.round(2 * galValueMul(g) * derived.valueMul * derived.incomeMul * (special ? 9 : 1));
    const r = clamp(7 + Math.log10(hp + 10) * 2.6, 7, 24);
    dots.push({ x: rnd(40, W - 40), y: rnd(60, H - 150), vx: rnd(-20, 20), vy: rnd(-20, 20),
      hp, maxHp: hp, value: val, r, special, hit: 0, drawCd: 0, color: special ? "#ffffff" : `hsl(0,0%,${44 + ((g - 1) % 6) * 8}%)` });
  }

  function fireUnit(u, p) {
    // pick the nearest dot in range that isn't already marked for lethal damage
    // this frame (so units spread fire instead of overkilling one dot); fall
    // back to the nearest in range if every candidate is already covered.
    const rng = uRange(u) ** 2; let target = null, bd = rng, fallback = null, fbd = rng;
    for (const d of dots) {
      if (d.dead) continue; const q = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (q > rng) continue;
      if (q < fbd) { fbd = q; fallback = d; }
      if ((d.pending || 0) < d.hp && q < bd) { bd = q; target = d; }
    }
    target = target || fallback; if (!target) return;
    let dmg = uDmg(u); if (Math.random() < uCrit(u)) dmg *= uCritMul(u);
    beams.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y, life: 0.08, color: uColor(u) });
    const aoe = uSplash(u);
    if (aoe > 0) { for (const d of dots) if (!d.dead && (d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= aoe * aoe) hitDot(d, dmg); }
    else { target.pending = (target.pending || 0) + dmg; hitDot(target, dmg); }
  }
  function hitDot(d, dmg) { if (d.dead) return; d.hp -= dmg; d.hit = 0.08; if (d.hp <= 0) { d.dead = true; orbs.push({ x: d.x, y: d.y, value: d.value, t: 0 }); } }
  function brushDmg() { let m = 5; for (const u of S.units) { const x = uDmg(u); if (x > m) m = x; } return m * 1.5 + 3; }
  function brushAt(x, y) { const R = 30, dmg = brushDmg(); for (const d of dots) { if (d.dead) continue; const rr = R + d.r; if ((d.x - x) ** 2 + (d.y - y) ** 2 <= rr * rr && d.drawCd <= 0) { hitDot(d, dmg); d.drawCd = 0.07; } } trail.push({ x, y, life: 0.35 }); }

  function useAbility(k) {
    if (abil[k] > 0 || state !== "play") return;
    abil[k] = ABIL_CD[k];
    if (k === "frenzy") frenzyT = 6;
    else if (k === "dotrain") { const n = 30 + S.galaxy * 8; for (let i = 0; i < n; i++) spawnDot(Math.random() < 0.3); }
    else if (k === "blackhole") blackholeT = 5;
  }

  /* ----------------------------- update -------------------------- */
  function update(dt) {
    if (state !== "play") return;
    recompute();
    if (frenzyT > 0) frenzyT -= dt;
    if (blackholeT > 0) blackholeT -= dt;
    for (const k in abil) if (abil[k] > 0) abil[k] = Math.max(0, abil[k] - dt);

    spawnAcc += dt * derived.spawnPerSec * galSpawnMul(S.galaxy);
    const cap = galCap(S.galaxy);
    while (spawnAcc >= 1 && dots.length < cap) { spawnDot(); spawnAcc -= 1; }
    if (spawnAcc > 6) spawnAcc = 6;

    for (const d of dots) {
      d.pending = 0;
      if (d.hit > 0) d.hit -= dt; if (d.drawCd > 0) d.drawCd -= dt;
      if (blackholeT > 0) { const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1; d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt; hitDot(d, brushDmg() * 0.6 * dt); }
      else { d.x += d.vx * dt; d.y += d.vy * dt; if (d.x < 30 || d.x > W - 30) d.vx *= -1; if (d.y < 50 || d.y > H - 130) d.vy *= -1; d.x = clamp(d.x, 30, W - 30); d.y = clamp(d.y, 50, H - 130); }
    }
    dots = dots.filter(d => !d.dead);

    for (let i = 0; i < S.units.length; i++) { const u = S.units[i]; u.cd -= dt; if (u.cd <= 0) { fireUnit(u, unitPos(i, S.units.length)); u.cd = 1 / uRate(u); } }
    for (const b of beams) b.life -= dt; beams = beams.filter(b => b.life > 0);

    // collectors coordinate: chase-types each claim their nearest orb (so they
    // split up); black-hole types stay put and drag everything in slowly.
    if (drones.length === 0) syncCollectors();
    for (const dr of drones) { dr.cand = null; dr.cbd = Infinity; }
    for (const o of orbs) { let nd = null, bd = Infinity; for (const dr of drones) { if (COL_TYPES[dr.type].mode === "hole") continue; const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2; if (q < bd) { bd = q; nd = dr; } } if (nd && bd < nd.cbd) { nd.cbd = bd; nd.cand = o; } }
    for (const dr of drones) {
      const hole = COL_TYPES[dr.type].mode === "hole", tgt = dr.cand;
      if (hole) { const dx = W / 2 - dr.x, dy = H * 0.42 - dr.y; dr.vx += (dx * 0.6 - dr.vx) * 0.04; dr.vy += (dy * 0.6 - dr.vy) * 0.04; }   // hovers near centre
      else if (tgt) { const dx = tgt.x - dr.x, dy = tgt.y - dr.y, dl = Math.hypot(dx, dy) || 1, sp = cSpeed(dr.type); dr.vx += (dx / dl * sp - dr.vx) * AGILITY; dr.vy += (dy / dl * sp - dr.vy) * AGILITY; }
      else { dr.vx *= 0.9; dr.vy *= 0.9; }
      dr.x = clamp(dr.x + dr.vx * dt, 0, W); dr.y = clamp(dr.y + dr.vy * dt, 0, H);
    }
    // black holes also drag nearby dots gently toward them (the "suck in" feel)
    for (const dr of drones) { if (COL_TYPES[dr.type].mode !== "hole") continue; const R = cSuction(dr.type) * 1.5; for (const d of dots) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < R) { d.x += dx / dl * 60 * dt; d.y += dy / dl * 60 * dt; } } }
    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      let nd = null, bd = Infinity; for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2, rng = cSuction(dr.type) ** 2; if (q < bd && q < rng) { bd = q; nd = dr; } }
      if (nd) { const dl = Math.sqrt(bd) || 1, pull = COL_TYPES[nd.type].mode === "hole" ? 150 : 240; o.x += (nd.x - o.x) / dl * pull * dt; o.y += (nd.y - o.y) / dl * pull * dt; if (dl < cCollect(nd.type) + 6 || o.t > 45) { if (o.t <= 45) earned += Math.round(o.value * cYield(nd.type)); orbs.splice(i, 1); } }
      else if (o.t > 45) orbs.splice(i, 1);
    }
    if (earned > 0) { S.cash = Math.min(derived.capacity, S.cash + earned); S.totalRun += earned; META.totalEver += earned; earnAcc += earned; }
    earnT += dt; if (earnT >= 1) { cps = cps * 0.6 + (earnAcc / earnT) * 0.4; earnAcc = 0; earnT = 0; }
    for (const tp of trail) tp.life -= dt; trail = trail.filter(tp => tp.life > 0);
    if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy;
  }

  /* ----------------------------- render -------------------------- */
  function render() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, `hsl(0,0%,${7 + ((S.galaxy - 1) % 6) * 2}%)`); g.addColorStop(1, "#000");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (blackholeT > 0) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, TAU); ctx.fill(); }
    for (const b of beams) { ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.globalAlpha = clamp(b.life / 0.08, 0, 1); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const d of dots) {
      ctx.fillStyle = d.hit > 0 ? "#fff" : d.color; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      if (d.special) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke(); }
      if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); }
    }
    for (const o of orbs) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, TAU); ctx.fill(); }
    const n = S.units.length;
    for (let i = 0; i < n; i++) {
      const u = S.units[i], p = unitPos(i, n);
      if (i === selUnit) { ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, uRange(u), 0, TAU); ctx.stroke(); }
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = uColor(u); ctx.beginPath(); ctx.arc(p.x, p.y, u.type === "turret" ? 11 : 9, 0, TAU); ctx.fill();
      ctx.fillStyle = "#000"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(DEF_TYPES[u.type].name[0], p.x, p.y + 1);
      const tot = allocCount(u.type); if (tot) { ctx.fillStyle = "#fff"; ctx.font = "9px ui-monospace,monospace"; ctx.fillText("" + tot, p.x, p.y - 21); }
    }
    ctx.textBaseline = "alphabetic";
    for (const dr of drones) {
      const mode = COL_TYPES[dr.type].mode, sr = cSuction(dr.type);
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, sr, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(dr.x, dr.y);
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
        const d = TY(id), locked = S.galaxy < d.gal, c = unitBuyCost(id);
        row.desc.textContent = "owned " + countType(id) + (locked ? "" : " · " + d.name);
        if (locked) { row.buy.textContent = "🔒 G" + d.gal; row.buy.disabled = true; row.buy.classList.remove("afford"); }
        else { row.buy.textContent = "$" + fmt(c); row.buy.disabled = S.cash < c; row.buy.classList.toggle("afford", S.cash >= c); }
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
        el.innerHTML = `<span class="u-dot" style="background:${col}"></span><div class="u-mid"><div class="u-name">${TY(type).name}</div><div class="u-desc"></div></div><button class="u-up" title="Upgrade class">⬆ Tree</button><button class="u-buy"></button>`;
        wrap.appendChild(el);
        el.querySelector(".u-up").onclick = () => openSkillTree(type);
        el.querySelector(".u-buy").onclick = () => buyUnit(type);
        listRows[type] = { kind: "unit", el, desc: el.querySelector(".u-desc"), buy: el.querySelector(".u-buy") };
      }
    } else {
      const col = activeTab === "drone" ? "var(--drone)" : "var(--eco)";
      for (const u of UPS) { if (u.tab !== activeTab) continue;
        const el = document.createElement("div"); el.className = "up";
        el.innerHTML = `<span class="u-dot" style="background:${col}"></span><div class="u-mid"><div class="u-name">${u.name}<span class="lv"></span></div><div class="u-desc"></div></div><button class="u-buy"></button>`;
        wrap.appendChild(el);
        el.querySelector(".u-buy").onclick = () => buyUpgrade(u);
        listRows[u.id] = { el, lv: el.querySelector(".lv"), desc: el.querySelector(".u-desc"), buy: el.querySelector(".u-buy") };
      }
    }
    syncHUD();
  }
  function buyUnit(type) {
    const list = classList(type), cap = isCol(type) ? 24 : 40;
    if (S.galaxy < TY(type).gal || list.length >= cap) return;
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
    drone:       { keys: ["Perfect Collector", "Rich Haul", "Swift Magnet"] },
    swarm:       { keys: ["Locust God", "Pack Yield", "Hive Sync"] },
    collector:   { keys: ["Mega Hauler", "Bulk Yield", "Power Magnet"] },
    magnet:      { keys: ["Magnetar Core", "Coil Yield", "Flux Drive"] },
    tractor:     { keys: ["Singularity Beam", "Tow Yield", "Beam Lock"] },
    singularity: { keys: ["Big Crunch", "Mass Cash", "Tidal Lock"] },
  };
  let _tree = null;
  function buildTree() {
    if (_tree) return _tree;
    const nodes = [{ id: "start", x: 0, y: 0, kind: "start", slots: [], wing: -1 }], edges = [];
    const wings = [{ l: 1, r: 2 }, { l: 2, r: 3 }, { l: 3, r: 1 }], cnt = { 1: 0, 2: 0, 3: 0, x: 0 };
    wings.forEach((w, i) => {
      const th = -Math.PI / 2 + i * 2 * Math.PI / 3, ux = Math.cos(th), uy = Math.sin(th), px = Math.cos(th + Math.PI / 2), py = Math.sin(th + Math.PI / 2);
      const id = k => "w" + i + k;
      const add = (k, r, s, kind, slots) => { const ns = kind === "key" ? "key" : slots[0].p, ni = kind === "key" ? i : cnt[ns]++; nodes.push({ id: id(k), x: ux * r + px * s, y: uy * r + py * s, kind, slots, wing: i, nameSlot: ns, ni }); };
      add("E", 1.05, 0, "minor", [{ p: w.l, mag: "min" }]);
      add("L", 1.95, -0.85, "minor", [{ p: w.l, mag: "min" }]);
      add("R", 1.95, 0.85, "minor", [{ p: w.r, mag: "min" }]);
      add("Lb", 2.6, -1.05, "minor", [{ p: w.l, mag: "min" }]);
      add("Rb", 2.6, 1.05, "minor", [{ p: w.r, mag: "min" }]);
      add("L2", 3.25, -0.72, "major", [{ p: w.l, mag: "maj" }]);
      add("R2", 3.25, 0.72, "major", [{ p: w.r, mag: "maj" }]);
      add("K", 4.05, 0, "key", [{ p: w.l, mag: "key" }, { p: w.r, mag: "key" }]);
      add("S", 4.85, 0, "major", [{ p: "x", mag: "maj" }]);
      const e = (a, b) => edges.push([id(a), id(b)]);
      edges.push(["start", id("E")]);
      e("E", "L"); e("E", "R"); e("L", "Lb"); e("Lb", "L2"); e("R", "Rb"); e("Rb", "R2"); e("L2", "K"); e("R2", "K"); e("K", "S");
      e("L", "R");   // rung across the diamond — extra internal route to the wing
    });
    // weave adjacent wings together at several radii: inner entries, the side
    // branches and the outer tips — so most nodes are reachable by >1 route.
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      edges.push(["w" + i + "E", "w" + j + "E"]);   // inner triangle
      edges.push(["w" + i + "R", "w" + j + "L"]);   // lower side link
      edges.push(["w" + i + "Rb", "w" + j + "Lb"]); // mid side link
      // (no outer-tip link: it ran almost on top of the Rb->R2 branch line)
    }
    const map = {}, adj = {}; nodes.forEach(n => { map[n.id] = n; adj[n.id] = []; });
    edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    _tree = { nodes, edges, map, adj };
    return _tree;
  }
  const STAT_LBL = { dmg: "dmg", rate: "rate", range: "rng", crit: "crit", speed: "spd", suction: "pull", yield: "yield", collect: "grab" };
  function slotText(type, s) {
    const col = isCol(type), amt = slotAmt(type, s);
    if (s.p === "x") return col ? "+" + amt + " grab" : "+" + Math.round(amt * 100) + "% crit";
    const key = (col ? COL_PRIM : DEF_PRIM)[s.p - 1];
    return key === "range" ? "+" + amt + " rng" : "+" + Math.round(amt * 100) + "% " + STAT_LBL[key];
  }
  const nodeFx = (type, n) => (n.slots || []).map(s => slotText(type, s)).join(" · ");
  function nodeLabel(type, n) {
    if (n.kind === "start") return TY(type).name;
    if (n.kind === "key") return (CLASS_WEB[type] || CLASS_WEB.turret).keys[n.wing] || "Keystone";
    const pool = n.nameSlot === "x" ? skillNames(type).x : skillNames(type)[["", "a", "b", "c"][n.nameSlot]];
    return (pool && pool[n.ni]) || nodeFx(type, n);
  }
  function statLine(tp) {
    const s = { type: tp };
    return isCol(tp)
      ? "<b>" + Math.round(cSpeed(tp)) + "</b> spd · <b>" + Math.round(cSuction(tp)) + "</b> pull · <b>" + Math.round(cCollect(tp)) + "</b> grab · <b>×" + cYield(tp).toFixed(2) + "</b> yield"
      : "<b>" + fmt(uDmg(s)) + "</b> dmg · <b>" + uRate(s).toFixed(1) + "</b>/s · <b>" + Math.round(uRange(s)) + "</b> rng" + (uSplash(s) ? " · splash" : "") + (uCrit(s) ? " · " + Math.round(uCrit(s) * 100) + "% crit" : "");
  }
  // allocation: a node is allocatable if a connected node is already allocated.
  const nodeAllocated = (type, id) => id === "start" || !!(S.classNodes[type] && S.classNodes[type][id]);
  const nodeAllocatable = (type, n) => !nodeAllocated(type, n.id) && (buildTree().adj[n.id] || []).some(a => nodeAllocated(type, a));
  function nodeCost(type, n) { const k = n.kind === "key" ? 5 : n.kind === "major" ? 2.3 : 1; return Math.floor(TY(type).base * 0.6 * Math.pow(1.17, allocCount(type)) * k); }
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
    $("si-name").textContent = nodeLabel(type, n) || fx;
    $("si-tag").textContent = n.kind === "key" ? "✦ Notable Keystone" : n.kind === "major" ? "◆ Notable" : "• Passive";
    $("si-desc").textContent = n.kind === "key" ? "A powerful node joining two stat branches of this wing." : n.kind === "major" ? "A stronger passive on this branch." : "A small passive on the path.";
    $("si-fx").textContent = "Grants: " + fx;
    const btn = $("st-upgrade");
    if (has) { $("si-prev").innerHTML = "✓ Allocated · class now <span class='si-after'>" + statLine(type) + "</span>"; btn.textContent = "ALLOCATED"; btn.disabled = true; }
    else if (can) { const p = nodePreview(type, n); $("si-prev").innerHTML = "Now: " + p.before + "<br>After: <span class='si-after'>" + p.after + "</span>"; btn.textContent = "ALLOCATE · $" + fmt(cost); btn.disabled = !afford; }
    else { $("si-prev").innerHTML = "🔒 Locked — first allocate a node connected to this one."; btn.textContent = "LOCKED"; btn.disabled = true; }
    panel.classList.add("show");
  }
  const STree = {
    type: "turret", cx: 0, cy: 0, zoom: 1, t: 0, cv: null, c: null, w: 0, h: 0, sel: null,
    ptrs: new Map(), lx: 0, ly: 0, moved: false, pinchD: 0, hit: [],
    selNode() { return this.sel ? buildTree().map[this.sel] : null; },
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
    clampPan() { const u = Math.min(this.w, this.h) * 0.085 * this.zoom, m = 5.4 * u; this.cx = clamp(this.cx, -m, m); this.cy = clamp(this.cy, -m, m); },
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); this.clampPan(); },
    nodeRad(n, u) { return n.kind === "key" ? clamp(u * 0.30, 13, 26) : n.kind === "major" ? clamp(u * 0.22, 10, 18) : n.kind === "start" ? clamp(u * 0.26, 12, 22) : clamp(u * 0.15, 7, 12); },
    sc(nx, ny) { const u = Math.min(this.w, this.h) * 0.085 * this.zoom; return { x: this.w / 2 + this.cx + nx * u, y: this.h / 2 + this.cy + ny * u, u }; },
    render(dt) {
      if (!this.cv) return; const c = this.c, type = this.type; this.t += dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = "#000"; c.fillRect(0, 0, this.w, this.h);
      const G = buildTree();
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
        if (n.kind === "key" || n.kind === "start") { c.fillStyle = has ? "#000" : "#fff"; c.font = "bold " + Math.round(rad * 0.95) + "px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(n.kind === "start" ? "★" : "✦", p.x, p.y + 1); }
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
      el.innerHTML = `<span class="u-dot" style="background:var(--sd)"></span><div class="u-mid"><div class="u-name">${u.name}<span class="lv">Lv ${lvl}</span></div><div class="u-desc">${u.desc(lvl)}</div></div><button class="u-buy">✦ ${c}</button>`;
      wrap.appendChild(el); const b = el.querySelector(".u-buy"); b.disabled = META.starDust < c;
      b.onclick = () => { if (META.starDust < sdCost(u)) return; META.starDust -= sdCost(u); META.sd[u.id]++; recompute(); buildSD(); syncHUD(); save(); };
    }
  }
  // interactive pseudo-3D black & white star map
  const GMap = {
    open: false, yaw: 0.6, pitch: -1.15, zoom: 1, t: 0, cv: null, c: null, w: 0, h: 0,
    reset() { this.yaw = 0.6; this.pitch = -1.15; this.zoom = 1; },
    ptrs: new Map(), lx: 0, ly: 0, moved: false, pinchD: 0, hit: [], stars: [], sel: 0,
    init() {
      this.cv = $("gmap"); if (!this.cv) return; this.c = this.cv.getContext("2d");
      this.cv.addEventListener("pointerdown", e => { this.ptrs.set(e.pointerId, this.pt(e)); this.moved = false; const p = this.pt(e); this.lx = p.x; this.ly = p.y; if (this.ptrs.size === 2) { const a = [...this.ptrs.values()]; this.pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
      this.cv.addEventListener("pointermove", e => {
        if (!this.ptrs.has(e.pointerId)) return; const p = this.pt(e); this.ptrs.set(e.pointerId, p);
        if (this.ptrs.size >= 2) { const a = [...this.ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (this.pinchD) this.zoom = clamp(this.zoom * d / this.pinchD, 0.4, 3.5); this.pinchD = d; this.moved = true; this.lx = p.x; this.ly = p.y; return; }
        const dx = p.x - this.lx, dy = p.y - this.ly; if (Math.hypot(dx, dy) > 6) this.moved = true; this.yaw += dx * 0.01; this.pitch = clamp(this.pitch + dy * 0.01, -1.2, 1.2); this.lx = p.x; this.ly = p.y;
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
    // flat spiral: galaxy 1 on the outer rim, winding ~4.5 turns inward to the
    // final galaxy at dead centre (the rotation pivot / end of the spiral).
    node(g) { const i = g - 1, total = 26, t = clamp(i / (total - 1), 0, 1), ang = i * 1.15, rad = (1 - t) * 172; return { x: Math.cos(ang) * rad, y: 0, z: Math.sin(ang) * rad }; },
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
      const maxG = Math.max(S.peakGalaxy + 2, S.galaxy + 2, 10), pts = [];
      for (let g = 1; g <= maxG; g++) { const w = this.node(g); pts.push({ g, p: this.proj(w.x, w.y, w.z) }); }
      c.strokeStyle = "#fff"; c.lineWidth = 1;
      for (let i = 0; i < pts.length - 1; i++) { c.globalAlpha = clamp(pts[i].p.f, 0.15, 1) * 0.4; c.beginPath(); c.moveTo(pts[i].p.x, pts[i].p.y); c.lineTo(pts[i + 1].p.x, pts[i + 1].p.y); c.stroke(); }
      c.globalAlpha = 1;
      const order = pts.slice().sort((a, b) => b.p.z - a.p.z); this.hit = [];
      for (const it of order) {
        const g = it.g, p = it.p, current = g === S.galaxy, reached = g < S.galaxy, next = g === S.galaxy + 1;
        const scale = clamp(26 * p.f, 8, 64), bright = current ? 1 : reached ? 0.85 : next ? 0.8 : 0.32;
        this.hit.push({ g, x: p.x, y: p.y, r: Math.max(scale * 0.7, 26) });
        if (current || g === this.sel) { const pulse = 0.5 + 0.5 * Math.sin(this.t * 4); c.strokeStyle = "rgba(255,255,255," + (0.35 + pulse * 0.5) + ")"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, scale * 0.7 + 6 + pulse * 4, 0, TAU); c.stroke(); }
        this.cluster(p.x, p.y, scale, bright, this.t * 0.3 + g);
        c.globalAlpha = clamp(p.f, 0.4, 1); c.textAlign = "center"; c.fillStyle = (reached || current || next) ? "#fff" : "rgba(255,255,255,0.5)"; c.font = Math.round(11 * clamp(p.f, 0.65, 1.4)) + "px ui-monospace,monospace";
        c.fillText((current ? "▶ " : "") + galName(g), p.x, p.y - scale * 0.7 - 8);
        c.globalAlpha = 1;
      }
    },
    tap(x, y) { let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } } if (best) { this.sel = best.g; showGalaxyInfo(best.g); } },
  };
  function travel() { const c = travelCost(S.galaxy); if (S.cash < c) return; S.cash -= c; S.galaxy++; if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy; dots = []; orbs = []; recompute(); syncHUD(); save(); }
  function rebirthGain() { return Math.floor(5 + Math.max(0, S.peakGalaxy - 9) * 6 + Math.cbrt(S.totalRun + 1) * 0.5); }
  function openRebirth() { if (S.galaxy < 10 && S.peakGalaxy < 10) return; $("rb-text").textContent = "Reset this run (cash, defenders & upgrades wiped) to bank Star Dust for permanent upgrades."; $("rb-gain").textContent = "✦ +" + fmt(rebirthGain()) + " Star Dust"; $("rebirth-modal").classList.add("show"); }
  function doRebirth() {
    META.starDust += rebirthGain(); const keep = META; S = fresh(); META = keep;
    if (META.sd.sdStart > 0) S.cash = 50 * Math.pow(6, META.sd.sdStart);
    dots = []; orbs = []; beams = []; spawnAcc = 0; cps = 0; drones = []; selUnit = -1;
    syncCollectors(); recompute(); $("rebirth-modal").classList.remove("show"); renderList(); buildSD(); syncHUD(); save();
  }

  /* ----------------------------- screens ------------------------- */
  function setScreen(s) {
    state = s;
    $("home").classList.toggle("show", s === "home");
    $("top").style.display = (s === "play") ? "flex" : "none";
    $("dock").style.display = (s === "play") ? "block" : "none";
    $("btn-menu").style.display = (s === "play") ? "block" : "none";
    if (s === "home") { $("home-gal").textContent = S.peakGalaxy; $("home-sd").textContent = fmt(META.starDust); }
  }

  /* ----------------------------- input --------------------------- */
  function ptr(e) { const r = canvas.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; }
  function unitAt(x, y) { const n = S.units.length; for (let i = 0; i < n; i++) { const p = unitPos(i, n); if ((p.x - x) ** 2 + (p.y - y) ** 2 <= 24 * 24) return i; } return -1; }
  canvas.addEventListener("pointerdown", e => {
    if (state !== "play") return;
    const p = ptr(e), ui = unitAt(p.x, p.y);
    if (ui >= 0) { openSkillTree(S.units[ui].type); return; }
    drawing = true; lastDraw = p; brushAt(p.x, p.y);
  });
  canvas.addEventListener("pointermove", e => {
    if (!drawing || state !== "play") return;
    const p = ptr(e), dx = p.x - lastDraw.x, dy = p.y - lastDraw.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / 14));
    for (let i = 1; i <= steps; i++) brushAt(lastDraw.x + dx * i / steps, lastDraw.y + dy * i / steps);
    lastDraw = p;
  });
  const endDraw = () => { drawing = false; };
  canvas.addEventListener("pointerup", endDraw); canvas.addEventListener("pointercancel", endDraw); canvas.addEventListener("pointerleave", endDraw);

  /* ----------------------------- wiring -------------------------- */
  for (const t of document.querySelectorAll(".tab[data-tab]")) { tabBtns[t.dataset.tab] = t; t.onclick = () => { activeTab = t.dataset.tab; for (const k in tabBtns) tabBtns[k].classList.toggle("sel", tabBtns[k] === t); renderList(); }; }
  $("ab-frenzy").onclick = () => useAbility("frenzy"); $("ab-dotrain").onclick = () => useAbility("dotrain"); $("ab-blackhole").onclick = () => useAbility("blackhole");
  $("btn-travel").onclick = travel; $("btn-rebirth").onclick = openRebirth; $("rb-confirm").onclick = doRebirth; $("rb-close").onclick = () => $("rebirth-modal").classList.remove("show");
  $("btn-sd").onclick = () => { buildSD(); $("sd-shop").classList.add("show"); }; $("sd-close").onclick = () => $("sd-shop").classList.remove("show");
  $("galaxy-open").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); }; $("gm-close").onclick = () => { $("galaxy-map").classList.remove("show"); GMap.hide(); };
  $("st-close").onclick = closeSkillTree; $("st-sell").onclick = sellOne;
  $("st-upgrade").onclick = () => {
    const type = STree.type, node = STree.selNode(); if (!node || !nodeAllocatable(type, node)) return;
    allocNode(type, node);
    // keep showing this node (now allocated) so the panel updates; if it leads
    // onward to a single newly-reachable node, hop the selection there.
    const G = buildTree(), onward = (G.adj[node.id] || []).map(a => G.map[a]).filter(m => nodeAllocatable(type, m));
    showNodeInfo(onward.length === 1 ? onward[0] : node);
  };
  $("gm-reset").onclick = () => GMap.reset(); $("st-reset").onclick = () => STree.reset();
  $("dock-toggle").onclick = () => { const d = $("dock"); const min = d.classList.toggle("min"); $("dock-toggle").textContent = min ? "▴ Menu" : "▾ Minimise"; };
  $("btn-menu").onclick = () => $("menu").classList.add("show");
  $("menu-close").onclick = () => $("menu").classList.remove("show");
  $("menu-resume").onclick = () => $("menu").classList.remove("show");
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress (including Star Dust)?")) { localStorage.removeItem(KEY); location.reload(); } };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  $("home-play").onclick = () => { renderList(); setScreen("play"); };
  $("home-galaxies").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); };
  $("home-how").onclick = () => $("how").classList.add("show");
  $("how-close").onclick = $("how-back").onclick = () => $("how").classList.remove("show");
  $("home-reset").onclick = () => { if (confirm("Erase ALL progress?")) { localStorage.removeItem(KEY); location.reload(); } };

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

  if (typeof window !== "undefined") window.__IDS = { S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, drones: () => drones, units: () => S.units, collectors: () => S.collectors, uDmg, uRate, cSpeed, cSuction, cCollect, cYield, brushAt, useAbility, travel, doRebirth, rebirthGain, fmt, buyUnit, buyUp: id => buyUpgrade(UP[id]), buildTree, allocNode, nodeAllocatable, nodeAllocated, nodeLabel, classStats: t => classStats(t), unitPos, openSkillTree, showNodeInfo, sellOne, showGalaxyInfo, recompute, setScreen, abil: () => abil, travelCost, galSpawnMul, galCap, state: () => state, GMap, STree, isCol };
})();
