/* =====================================================================
   IDLE DOT SHOOTER  (HTML5/Canvas, original implementation)
   Defenders are individual units, each with its own upgrade tree (tap to
   open). Drones are a coordinated collection fleet. Planets (across three
   solar systems) scale dot count + toughness. Offline earnings. Home screen.
   ===================================================================== */
(() => {
  "use strict";
  const canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // ▶ BUILD VERSION — bump this on EVERY change (shown top-right in-game) so it's obvious which build is live.
  const VERSION = "v2.8";
  let W = 0, H = 0, DPR = 1, SW = 0, SH = 0, camZoom = 0, camFit = 0;   // W/H = WORLD (bigger than screen); SW/SH = screen; camZoom = world→screen scale (center-locked)
  const WORLD_SCALE = 1.45;   // the playfield is this much bigger than the screen — pinch out to see the wave roll in from the edges
  // ── tiny synthesized SFX engine (no assets) — used for the cinematic warp-into-base jump ──
  const Sfx = {
    ctx: null, nb: null,
    ac() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) { this.ctx = null; } return this.ctx; },
    noise() { const a = this.ctx; if (!a) return null; if (!this.nb) { const n = a.sampleRate * 2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.nb = b; } const s = a.createBufferSource(); s.buffer = this.nb; s.loop = true; return s; },
    swoosh(dur) { const a = this.ac(); if (!a) return; const t0 = a.currentTime, s = this.noise(); if (!s) return; const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(2800, t0); bp.frequency.exponentialRampToValueAtTime(180, t0 + dur); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(bp).connect(g).connect(a.destination); s.start(t0); s.stop(t0 + dur + 0.05); },   // descending "drop out of hyperspace" whoosh
    warp(dur) {
      const a = this.ac(); if (!a) return; const t0 = a.currentTime, dest = a.destination;
      const tube = this.noise(); if (tube) { const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.3; bp.frequency.setValueAtTime(180, t0); bp.frequency.exponentialRampToValueAtTime(3200, t0 + dur * 0.82); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.34, t0 + dur * 0.78); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.96); tube.connect(bp).connect(g).connect(dest); tube.start(t0); tube.stop(t0 + dur); }
      const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(55, t0); o.frequency.exponentialRampToValueAtTime(440, t0 + dur * 0.8); const og = a.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.11, t0 + dur * 0.75); og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.9); o.connect(og).connect(dest); o.start(t0); o.stop(t0 + dur * 0.95);
      const tb = t0 + dur * 0.8;   // BOOM at the punch
      const bo = a.createOscillator(); bo.type = "sine"; bo.frequency.setValueAtTime(170, tb); bo.frequency.exponentialRampToValueAtTime(38, tb + 0.5); const bg = a.createGain(); bg.gain.setValueAtTime(0.0001, tb); bg.gain.exponentialRampToValueAtTime(0.55, tb + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, tb + 0.6); bo.connect(bg).connect(dest); bo.start(tb); bo.stop(tb + 0.62);
      const tr = this.noise(); if (tr) { const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400; const ng = a.createGain(); ng.gain.setValueAtTime(0.3, tb); ng.gain.exponentialRampToValueAtTime(0.0001, tb + 0.2); tr.connect(hp).connect(ng).connect(dest); tr.start(tb); tr.stop(tb + 0.22); }
      const tl = t0 + dur;   // landing rumble
      const ro = a.createOscillator(); ro.type = "sine"; ro.frequency.setValueAtTime(58, tl); ro.frequency.exponentialRampToValueAtTime(26, tl + 0.7); const rg = a.createGain(); rg.gain.setValueAtTime(0.0001, tl); rg.gain.exponentialRampToValueAtTime(0.4, tl + 0.05); rg.gain.exponentialRampToValueAtTime(0.0001, tl + 0.85); ro.connect(rg).connect(dest); ro.start(tl); ro.stop(tl + 0.88);
    }
  };

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
    drone:       { name: "Drone",          base: 60,         gal: 1, speed: 88,  suction: 38,  collect: 9,  yield: 1.0, cap: 5, mode: "chase", sides: 4, max: 4 },
    swarm:       { name: "Drone Swarm",    base: 9000,       gal: 2, speed: 150, suction: 60,  collect: 13, yield: 1.2, cap: 7, mode: "swarm", sides: 3, max: 2 },
    collector:   { name: "Heavy Collector",base: 120000,     gal: 3, speed: 110, suction: 86,  collect: 20, yield: 1.5, cap: 7, mode: "chase", sides: 6, max: 2 },
    magnet:      { name: "Magnet Rig",     base: 1800000,    gal: 4, speed: 140, suction: 120, collect: 26, yield: 1.9, cap: 8, mode: "chase", sides: 5, max: 2 },
    tractor:     { name: "Tractor Array",  base: 26000000,   gal: 5, speed: 130, suction: 170, collect: 34, yield: 2.3, cap: 9, mode: "chase", sides: 8, max: 2 },
    singularity: { name: "Black Hole",     base: 350000000,  gal: 6, speed: 48,  suction: 250, collect: 46, yield: 2.8, cap: 14, mode: "hole",  sides: 0, max: 2 },
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
  const BUY_MUL = 5;   // global ~5× slowdown on buying units/upgrades/nodes — army-building is a long arc, not a 40-min sprint
  const unitBuyCost = type => Math.ceil(eco(S.galaxy) * (UNIT_FACTOR[type] || 40) * BUY_MUL * Math.pow(1.5, countType(type)));   // planet-local, geometric in count — ~5× the old cost, so the LAST unit lands only when you're in the billions
  // ---- class skill tree: an interconnected node MAP. Each class allocates
  // nodes outward from a start node; a node can only be taken once a CONNECTED
  // node is already allocated. Aggregated bonuses live in derived.cls[type].
  const DEF_PRIM = ["dmg", "rate", "range", "int"], COL_PRIM = ["speed", "suction", "collect", "capacity"];
  // Tree nodes add a FLAT bonus that STACKS ADDITIVELY — a stat's multiplier is
  // 1 + (sum of its nodes' bonuses). Bonuses do NOT compound off each other, so
  // deep trees scale LINEARLY (no exponential runaway), and because each new node
  // is a smaller share of a growing total, the effect naturally tapers — early
  // nodes feel strong, late nodes are incremental.
  // mul/rate/speed/suction/ingest bonuses are FRACTIONS (0.4 = +40%); range/collect
  // are flat distances; crit is flat chance.
  // Defender baseline (turret = tier 1). Later classes scale UP via DEF_SCALE, so a
  // gal-7 Railgun tree is FAR stronger per node than a gal-1 Turret — "scaled correctly."
  const MAG_DEF = { mul: { min: 2.5, maj: 7.0, key: 18 }, rate: { min: 2.0, maj: 4.5, key: 11 }, range: { min: 16, maj: 42, key: 95 }, crit: { min: 0.10, maj: 0.25, key: 0.50 }, int: { min: 0.14, maj: 0.34, key: 0.7 } };   // range = flat px/node, tuned so a FULL branch ~covers the field (not 2-3x beyond) and every node still grows the circle a visible amount; int = "Mind": smarter targeting (no overkill / coordination), additive toward fully-smart=1
  const DEF_SCALE = { turret: 1.0, mortar: 1.35, plasma: 1.8, laser: 2.4, railgun: 3.2 };
  // Collectors are pure LOGISTICS (no income multiplier — yield lives in Economy):
  // Speed strong, Suction gentle (radius-capped in cSuction), Reach (collect) = how
  // close it must get to grab loot (flat), Ingest = how fast it swallows what it grabs.
  // Process (ingest) is a STRONG per-node lever — +100% / +200% / +400% — so a full
  // Process wing makes even heavy loot vanish. capacity = how many loot orbs a collector
  // PROCESSES at once (parallel maw bays): a multiplier on the base bay count with BIG
  // upgrades (+30% / +70% / +150% per node), floored to whole bays in cCapacity. Base
  // bays are generous so Capacity is never a harsh throttle. Speed / suction / reach as-is.
  const MAG_COL = { speed: { min: 2.0, maj: 4.5, key: 9 }, suction: { min: 0.6, maj: 1.2, key: 2.2 }, collect: { min: 10, maj: 26, key: 60 }, capacity: { min: 0.30, maj: 0.70, key: 1.5 }, ingest: { min: 1.0, maj: 2.0, key: 4.0 } };
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
    if (key === "int") return MAG_DEF.int[s.mag];                       // intelligence = flat smartness, not scaled
    return (key === "rate" ? MAG_DEF.rate[s.mag] : MAG_DEF.mul[s.mag]) * sc;   // dmg/rate bonuses scale by class tier
  }
  function classStats(type) {
    const col = isCol(type), prim = col ? COL_PRIM : DEF_PRIM;
    const o = { dmg: 1, rate: 1, range: 0, crit: 0, int: 0, speed: 1, suction: 1, yield: 1, collect: 0, capacity: 1, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0,
      n: { dmg: 0, rate: 0, range: 0, int: 0, crit: 0, speed: 0, suction: 0, collect: 0, capacity: 0, ingest: 0 } };   // n = allocated-node count per branch, drives the per-upgrade visual marks
    const A = S.classNodes[type], G = buildTree(type);
    if (A) for (const id in A) { if (!A[id]) continue; const n = G.map[id]; if (!n || !n.slots) continue;
      if (n.kind === "key") { o.multi++; if (n.spec) o[n.spec]++; }   // keystone = +1 multishot AND a ✦ specialization
      // Every bonus ADDS (sums linearly) — nothing compounds, so no runaway.
      for (const s of n.slots) { const amt = slotAmt(type, s), key = s.p === "x" ? (col ? "ingest" : "crit") : prim[s.p - 1];
        o[key] += amt; if (o.n[key] != null) o.n[key]++; } }
    o.multi = Math.min(o.multi, 6);
    return o;
  }
  const ZERO = { dmg: 1, rate: 1, range: 0, crit: 0, int: 0, speed: 1, suction: 1, yield: 1, collect: 0, capacity: 1, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0, n: { dmg: 0, rate: 0, range: 0, int: 0, crit: 0, speed: 0, suction: 0, collect: 0, capacity: 0, ingest: 0 } };
  const uMulti = u => cls(u.type).multi || 0;
  const uInt = u => cls(u.type).int || 0;   // intelligence: 0 = dumb, ~1 = perfect overkill-avoidance & coordination
  const cls = type => (derived.cls && derived.cls[type]) || ZERO;
  const uDmg = u => DEF_TYPES[u.type].dmg * cls(u.type).dmg;
  const uRate = u => DEF_TYPES[u.type].rate * cls(u.type).rate * (frenzyT > 0 ? 5 : 1);   // Frenzy ability = 5× fire rate
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
  const cCapacity = type => Math.max(1, Math.round(COL_TYPES[type].cap * cls(type).capacity));   // how many orbs it processes in parallel (bays); multiplies the base bay count, floored to a whole number
  const cYield   = type => COL_TYPES[type].yield   * cls(type).yield * derived.incomeMul;
  const AGILITY = 0.12;

  // flavour names: one pool per stat branch (a/b/c) plus the extra 'x' branch.
  // every node — even the small passives — pulls a distinct name from its pool.
  const SKILLS = {
    turret:  { a: ["Reinforced Rounds", "Tungsten Core", "Armor Piercing", "Hollow Points", "Overcharge", "Heavy Slugs", "Devastator"], b: ["Quick Hands", "Belt Feed", "Rapid Servos", "Hair Trigger", "Double Tap", "Cyclic Bolt", "Gatling Drive"], c: ["Scope", "Range Finder", "Laser Sight", "Tracking AI", "Eagle Eye", "Long Barrel", "Hawkeye"], d: ["Targeting Chip", "Threat Sense", "Kill Tracker", "Fire Discipline", "Combat Logic", "Squad Link", "Tactical Core"], x: ["Critical Core", "Deadeye", "Killshot"] },
    mortar:  { a: ["Bigger Shells", "Dense Payload", "Thermobaric", "Cluster Munitions", "Carpet Bomb", "Heavy Ordnance", "Doomshell"], b: ["Fast Fuse", "Auto-Loader", "Twin Tubes", "Rapid Mortar", "Barrage", "Quick Crew", "Drumfire"], c: ["Wider Blast", "Shrapnel", "Spotter", "Precision Strike", "Saturation", "Wide Arc", "Bullseye"], d: ["Fire Plan", "Spotter Net", "Impact Sense", "Salvo Logic", "Forward Observer", "Battery Link", "Strike Command"], x: ["Shell Shock", "Pinpoint", "Devastation"] },
    plasma:  { a: ["Ion Charge", "Superheated", "Fusion Core", "Antimatter", "Singularity Bolt", "Plasma Surge", "Star Core"], b: ["Capacitor", "Coolant Loop", "Overclock", "Rapid Cycle", "Continuous Beam", "Supercooled", "Flux Drive"], c: ["Focusing Lens", "Long Barrel", "Crit Matrix", "Targeting Array", "Lancer", "Beam Optics", "Far Sight"], d: ["Logic Core", "Heuristics", "Threat Model", "Predict Engine", "Sentience", "Neural Mesh", "Mind Lattice"], x: ["Crit Core", "Overcharge Cell", "Meltdown"] },
    laser:   { a: ["Amplifier", "Focused Beam", "Burning Ray", "Photon Surge", "Death Ray", "Hot Lens", "Sunfire"], b: ["Pulse Rate", "Rapid Emitter", "Resonance", "Overdrive", "Constant Stream", "Fast Cycle", "Lightstorm"], c: ["Mirror Array", "Extended Optics", "Heat Seeker", "Crit Lens", "Prism Split", "Wide Mirror", "True Aim"], d: ["Tracking AI", "Scan Logic", "Priority Lock", "Predictive Aim", "Swarm Sense", "Hunter Net", "Omniscience"], x: ["Crit Focus", "Focal Point", "Vaporize"] },
    railgun: { a: ["Mag Core", "Hypervelocity", "Depleted Slug", "Mass Driver", "Annihilator", "Tungsten Rod", "Worldbreaker"], b: ["Quick Charge", "Capacitor Bank", "Auto-Rack", "Rapid Rail", "Salvo", "Fast Coil", "Volley"], c: ["Long Rail", "Calibration", "Piercing Round", "Crit Targeting", "Railstorm", "Extended Rail", "Dead Centre"], d: ["Fire Solution", "Ballistic AI", "Target Lock", "Lead Computer", "Kill Predictor", "War Mind", "Oracle Core"], x: ["Crit Lock", "Penetrator", "One Shot"] },
  };
  // collector skill webs: a=Speed, b=Suction, c=Reach (grab distance), d=Capacity (parallel
  // maw bays — how many orbs at once), x=Ingest (loot-swallow speed)
  const COL_SKILLS = {
    drone:       { a: ["Light Frame", "Tuned Rotors", "Boosters", "Ion Thrust", "Slipstream", "Quick Servos", "Overdrive"], b: ["Magnet", "Wide Field", "Tractor Coil", "Graviton Pull", "Event Field", "Strong Coil", "Deep Pull"], c: ["Bigger Scoop", "Wide Grip", "Long Arms", "Quick Latch", "Tractor Grip", "Snap Reach", "Vacuum Maw"], d: ["Twin Bay", "Extra Hopper", "Triple Maw", "Parallel Feed", "Multi-Intake", "Bay Array", "Hydra Maw"], x: ["Quick Gulp", "Maw Servo", "Grinder", "Crush Jaws", "Smelter", "Furnace Maw", "Devourer"] },
    swarm:       { a: ["Hive Mind", "Sync Wings", "Formation", "Overswarm", "Locust Dash", "Fast Hive", "Blitz"], b: ["Net Cast", "Mesh Field", "Swarm Pull", "Hive Gravity", "Total Sweep", "Wide Mesh", "Dragnet"], c: ["Many Hands", "Wide Reach", "Long Grip", "Pack Latch", "Total Grasp", "Far Hands", "Hive Grip"], d: ["Split Duty", "More Mouths", "Spread Feed", "Parallel Swarm", "Many Maws", "Wide Intake", "Devour Cloud"], x: ["Big Net", "Hive Hold", "Quick Strip", "Mass Feed", "Pack Digest", "Hive Mill", "Treasury"] },
    collector:   { a: ["Servo Boost", "Heavy Treads", "Turbo", "Afterburner", "Warp Frame", "Quick Haul", "Blink Drive"], b: ["Big Magnet", "Wide Maw", "Gravity Plate", "Pull Field", "Vortex", "Strong Maw", "Black Maw"], c: ["Cargo Arms", "Wide Maw", "Long Reach", "Bulk Grip", "Grand Reach", "Heavy Latch", "Maw Spread"], d: ["Twin Hopper", "Extra Bay", "Triple Intake", "Parallel Bays", "Conveyor Bank", "Bay Cluster", "Mega Intake"], x: ["Maw Bay", "Cargo Bay", "Crusher", "Bulk Mill", "Ore Press", "Smelt Bay", "Strongbox"] },
    magnet:      { a: ["Spin Up", "Coil Tune", "Rail Drive", "Mag-Lev", "Flux Dash", "Quick Coil", "Overspin"], b: ["Dipole", "Quad Coil", "Field Bloom", "Deep Pull", "Magnetar", "Strong Dipole", "Pole Reversal"], c: ["Grab Coil", "Wide Pole", "Long Coil", "Grip Field", "Vast Reach", "Strong Latch", "Pole Spread"], d: ["Twin Pole", "Extra Coil Bay", "Triple Intake", "Parallel Coils", "Multi-Pole", "Coil Bank", "Pole Array"], x: ["Wide Coil", "Storage Coil", "Flux Mill", "Eddy Press", "Induction Forge", "Quick Smelt", "Bullion"] },
    tractor:     { a: ["Emitter Tune", "Beam Drive", "Phase Step", "Warp Coil", "Lightspeed", "Quick Beam", "Hyperdrive"], b: ["Cone Cast", "Wide Beam", "Tow Field", "Deep Tow", "Star Reach", "Broad Beam", "Long Reach"], c: ["Hopper Arm", "Wide Grip", "Long Tow", "Cone Latch", "Far Reach", "Broad Grip", "Tow Spread"], d: ["Twin Beam", "Extra Tractor", "Triple Tow", "Parallel Beams", "Multi-Lock", "Beam Bank", "Beam Array"], x: ["Wide Cone", "Hold Beam", "Beam Mill", "Phase Press", "Plasma Forge", "Quick Render", "Reserve"] },
    singularity: { a: ["Drift Control", "Orbit Tune", "Wander", "Roam Field", "Phase Drift", "Slow Roll", "Free Orbit"], b: ["Deeper Well", "Wider Horizon", "Tidal Force", "Crushing Pull", "Infinite Reach", "Gravity Sink", "Abyssal Pull"], c: ["Event Reach", "Wide Maw", "Long Horizon", "Deep Grip", "Vast Reach", "Abyss Latch", "Maw Spread"], d: ["Twin Horizon", "Extra Well", "Triple Maw", "Parallel Wells", "Multi-Crush", "Event Bank", "Devour Array"], x: ["Event Maw", "Mass Vault", "Spaghetti Mill", "Tidal Crush", "Hawking Forge", "Quick Collapse", "Singularity Core"] },
  };
  const skillNames = type => isCol(type) ? COL_SKILLS[type] : SKILLS[type];
  // --- progression MAP: three SOLAR SYSTEMS, each with 4–8 PLANETS. The linear
  // travel index S.galaxy is the GLOBAL planet number (1..TOTAL_PLANETS); the map
  // just groups those planets into systems visually. Travel still advances one
  // planet at a time, and all the difficulty/scaling functions stay f(globalIndex).
  const SYSTEMS = [
    { name: "Helios", planets: 4 },   // inner, warm — find your rhythm
    { name: "Cygnus", planets: 6 },   // mid — the arsenal fills out
    { name: "Erebus", planets: 8 },   // outer dark — endless brutal grind
  ];
  const PLANET_NAMES = [
    "Vesta", "Ember", "Cinder", "Hearth",                              // Helios
    "Azure", "Verdant", "Cobalt", "Mistral", "Halcyon", "Tempest",     // Cygnus
    "Umbra", "Frost", "Onyx", "Wraith", "Pyre", "Abyss", "Maw", "Oblivion", // Erebus
  ];
  const PLANET_DESC = [
    "A quiet inner world. Sparse, fragile dots — find your rhythm.",
    "Drifting embers. Swarms move faster; keep collectors close.",
    "Scorched cinder fields. Hotter, tougher dots — Mortars forge here.",
    "The hearth-world. Dense clouds and richer payouts — Plasma ignites.",
    "Azure tides. Reinforced dots demand real damage.",
    "Verdant sprawl. Relentless waves — Lasers cut through.",
    "Cobalt deep. High-value specials surface far more often.",
    "Stormwinds. Chaotic, dense spawns — Railguns punch through.",
    "A deceptive calm before the outer dark.",
    "Tempest belt. Massive, high-HP dots roll through.",
    "The outer dark begins. Brutal density — your whole arsenal earns its keep.",
    "Frostbound. Slow but enormous dots.",
    "Onyx void. Armored elites everywhere.",
    "Wraith-light. Phantoms phase through your fire.",
    "A dying star's pyre. Everything burns hotter.",
    "The Abyss. Endless and merciless.",
    "The Maw. It only takes.",
    "Oblivion. How deep can you push?",
  ];
  const PLANET_SYS = [], PLANET_LOCAL = [];
  SYSTEMS.forEach((s, si) => { for (let l = 0; l < s.planets; l++) { PLANET_SYS.push(si); PLANET_LOCAL.push(l); } });
  const TOTAL_PLANETS = PLANET_SYS.length;
  const planetIdx = g => Math.min(Math.max(g, 1), TOTAL_PLANETS) - 1;
  const sysName = g => SYSTEMS[PLANET_SYS[planetIdx(g)]].name;
  const galName = g => PLANET_NAMES[g - 1] || (PLANET_NAMES[PLANET_NAMES.length - 1] + " " + g);
  const galDesc = g => PLANET_DESC[planetIdx(g)];
  const uColor = u => u.type === "mortar" ? "#9a9a9a" : u.type === "turret" ? "#ffffff" : "#cccccc";
  // Defenders auto-arrange into a tidy, centred formation that re-racks itself
  // as you buy more — like beer-pong cups: a lone unit sits centre, a handful
  // form a neat ring, more fill concentric rings (the last ring always spread
  // evenly), so 5 and 50 read as different but equally organised shapes.
  let _form = { n: -1, pts: [] };
  function formation(n) {
    if (_form.n === n) return _form.pts;
    const pts = [], GAP = 36;
    if (n >= 1) pts.push({ x: 0, y: 0 });
    let placed = 1, ring = 1;
    while (placed < n) {
      const radius = ring * 40, cap = Math.max(1, Math.floor(TAU * radius / GAP)), take = Math.min(cap, n - placed);
      const phase = (ring % 2 ? Math.PI / take : 0) - Math.PI / 2;
      for (let k = 0; k < take; k++) { const a = k / take * TAU + phase; pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius * 1.35 }); }   // stretch vertically to use the tall portrait field & keep units off the side edges
      placed += take; ring++;
    }
    _form = { n, pts };
    return pts;
  }
  function unitPos(i, n) { const p = formation(n)[i] || { x: 0, y: 0 }; return { x: W / 2 + p.x, y: H / 2 + p.y }; }

  /* ----------------------- drone + economy upgrades -------------- */
  const UPS = [
    { id: "capacity",  tab: "eco", name: "Capacity",   base: 20, mul: 1.55, desc: () => curSym(S.galaxy) + " " + fmt(derived.capacity) },
    { id: "value",     tab: "eco", name: "Value",      base: 30, mul: 1.42, desc: () => "×" + derived.valueMul.toFixed(2) + " /dot" },
    { id: "spawnRate", tab: "eco", name: "Spawn Rate", base: 64, mul: 1.55, desc: () => { const raw = derived.spawnPerSec || 0, om = raw > SPAWN_SMOOTH ? Math.min(Math.pow(raw / SPAWN_SMOOTH, 0.7), 8) : 1; return raw.toFixed(1) + " /s" + (om > 1.02 ? "  ·  " + SPAWN_SMOOTH + "/s spawn, overflow → ×" + om.toFixed(1) + " tougher" : ""); } },
    { id: "luck",      tab: "eco", name: "Luck",       base: 70, mul: 1.28, desc: () => (derived.luck * 100).toFixed(1) + "% special" },
  ];
  const UP = {}; UPS.forEach(u => UP[u.id] = u);
  const upCost = u => Math.ceil(eco(S.galaxy) * 2 * BUY_MUL * Math.pow(u.mul, S.lv[u.id] || 0));   // planet-local: ~5× slower than before, grows by mul

  // Travel is a hard, escalating wall tuned to the (deliberately slow) income ramp:
  // ~1 day to set up + bank the first jump, ramping gently (≈×3.2/planet) to a few
  // days each by the late planets.
  // Launching an expedition costs a FIXED, huge sum scaling with the planet's economy (NOT your
  // bank ceiling — so you can't dodge it by keeping capacity low). On planet 1 it's ~25T; you'll
  // need to invest in Capacity just to hold that much cash, then bank it. Escalates ×1.2 per planet.
  const TRAVEL_COST_K = 5e6;
  const travelCost = g => { g = g || S.galaxy; return Math.round(eco(g) * TRAVEL_COST_K * Math.pow(1.2, g - 1)); };
  // PLANET LAYERS: every planet is a self-contained run of the SAME base difficulty —
  // its identity comes from its native RACE and your in-planet Value ramp, not raw HP.
  // So base HP/spawn are FLAT across planets (a fresh army can always start killing);
  // only the CURRENCY scale (galValueMul) grows, and costs scale with it (eco), so each
  // planet plays identically in bigger numbers and conquer time stays constant.
  const enemyHpMul = g => 1;                            // flat: dots aren't tankier on later planets (in-planet Value still ramps them)
  const galValueMul = g => Math.pow(2.2, g - 1);        // currency scale of planet g (income AND costs both ride this, so it cancels)
  const galSpawnMul = g => 1;                           // flat base spawn (you raise it in-planet with Spawn Rate)
  const galCap = g => 400;                              // flat field cap
  const SPAWN_SMOOTH = 26;                              // max NEW dots/sec on screen — a cleared field refills as a gentle trickle, never an instant wall (no respawn stutter). Spawn Rate above this becomes TOUGHNESS, not churn.

  /* ====================== PLANET LAYERS (per-planet economy) ======================
     Each planet has its OWN currency and is its OWN fresh run. eco(g) is that planet's
     natural currency scale (what a plain dot drops there), so EVERY cost is rebased to
     eco(g): a planet plays the same shape in bigger numbers. Conquer a planet -> it joins
     your BACKGROUND empire, earning its currency passively (online + offline) at the rate
     you left it; revisit to upgrade it. The EXCHANGE converts any planet's currency into
     the one you're spending now, so a fresh landing is a running start, never a grind. */
  // Big idle-game numbers: planet 1's currency starts in the millions and each planet
  // is ×2.2 bigger, so progression runs millions → billions → trillions+. This is purely
  // the SCALE — income and every cost ride the same eco(g), so pacing is unchanged.
  const CUR_BASE = 5e6;
  // Each planet's currency has its OWN seeded magnitude (distinct, non-uniform) on top of the ×2.2 ladder.
  // conquerTarget AND income both ride eco(g), so this per-planet bump CANCELS in time-to-conquer — pacing
  // is provably unchanged; it only makes each planet's numbers feel unique and its starting purse distinct.
  // Each planet's currency is worth MORE than the previous — by a SEEDED, varying step (×1.6…×2.8), so the
  // magnitudes are distinct/non-uniform yet ALWAYS climbing. conquerTarget AND income both ride eco(g), so
  // the steps cancel in time-to-conquer — pacing is provably unchanged.
  const ecoStep = k => 1.6 + ((Math.imul((k + 11) * 2654435761, 40503) >>> 0 >>> 7) & 1023) / 1023 * 1.2;   // ×1.6…×2.8 vs the previous planet, seeded, always > 1
  const eco = g => { g = Math.max(1, g); let v = CUR_BASE; for (let k = 2; k <= g; k++) v *= ecoStep(k); return v; };   // strictly-increasing, distinct currency scale of planet g
  const startMul = g => 28 + ((Math.imul((Math.max(1, g) + 19) * 2654435761, 40503) >>> 0 >>> 6) & 511) / 511 * 64;   // seeded fresh-landing purse: eco(g) × [28..92], distinct per planet
  const CUR_NAMES = ["Dust","Sparks","Slag","Embers","Brine","Spores","Cobalt","Gusts","Glimmer","Charge","Shade","Rime","Shards","Wisps","Ash","Voidstone","Bile","Null"];
  const CUR_SYM   = ["✦","✷","◆","✸","≋","✤","◈","❂","✧","⚡","◐","❄","◇","∿","▲","⬟","☣","⊘"];   // each planet's currency has its own symbol
  const curName = g => CUR_NAMES[Math.min(Math.max(g,1),CUR_NAMES.length)-1] || "Null";
  const curSym  = g => CUR_SYM[Math.min(Math.max(g,1),CUR_SYM.length)-1] || "✦";
  const curWorth = g => eco(g);                                      // exchange value of one unit of planet g's currency
  // Conquering a planet is a ~day-long active grind (proper idle pacing), escalating per planet.
  // CALIBRATED TO REAL ACTIVE PLAY: a skilled player (drawing to kill + abilities + the Spawn-Rate
  // menace buff) banks ~40× faster than a passive upgrade-only sim, finishing the old eco*1.5M target
  // in ~40 min. So the base is eco*6e7 ≈ ~27h of active play on planet 1; ×1.2 per planet makes later
  // worlds progressively longer (planet 18 is a months-long journey). EXCHANGE only adds spending
  // power (S.cash), never conquer progress (curEarned), so the day-per-planet floor can't be bought past.
  const CONQUER_BASE = 6e7, CONQUER_ESCALATE = 1.2;
  const conquerTarget = g => Math.ceil(eco(g) * CONQUER_BASE * Math.pow(CONQUER_ESCALATE, Math.max(1, g) - 1));
  const BG_EFF = 0.4;                                                // a conquered planet earns at this fraction of its live rate, idle
  // EXCHANGE is BRUTAL — you really start fresh on each world (AdCap "moon" style). You keep only ~2% of
  // value, EVERY pair's market spread is below 1 (so it's always a loss even at peak), far-behind worlds
  // decay hard, and a tiny hard cap applies. The background empire is a faint leg-up, never a buy-past-it.
  const EXCHANGE_KEEP = 0.02;
  // ── FLOATING FX MARKET — every currency PAIR has a unique seeded base spread that ALSO drifts over real
  // time (a live market you can time). The conversion stays value-anchored (worth ratio) + harsh keep +
  // distance decay + a hard cap, so it can NEVER flood an economy or shortcut a conquest. ──
  const fxHash = (a, b) => Math.imul(Math.min(a, b) * 131 + Math.max(a, b) * 977 + 17, 2654435761) >>> 0;
  const fxBase = (a, b) => 0.28 + ((fxHash(a, b) >>> 9) & 1023) / 1023 * 0.4;                            // unique base spread per pair ~[0.28,0.68] — even ×1.3 peak drift stays <1 (ALWAYS a loss)
  const fxDriftAt = (a, b, t) => { const h = fxHash(a, b), ph1 = ((h >>> 3) & 255) / 255 * TAU, ph2 = ((h >>> 13) & 255) / 255 * TAU, f1 = 0.02 + ((h >>> 21) & 15) / 15 * 0.04, f2 = 0.07 + ((h >>> 25) & 15) / 15 * 0.11; return 1 + 0.2 * Math.sin(t * f1 + ph1) + 0.1 * Math.sin(t * f2 + ph2); };
  const fxMarketAt = (a, b, t) => fxBase(a, b) * fxDriftAt(a, b, t);                                    // the live "rate" the player sees, floats ~[0.45,2.1]
  const fxMarket = (a, b) => fxMarketAt(a, b, Date.now() / 1000);
  const fxRate = (fromG, toG) => (curWorth(fromG) / curWorth(toG)) * EXCHANGE_KEEP * Math.pow(0.5, Math.max(0, Math.abs(toG - fromG) - 1)) * fxMarket(fromG, toG);   // steep distance decay
  // CUMULATIVE per-planet import cap: the live planet can only ever absorb IMPORT_CAP of foreign aid total.
  // This is what makes partial/mass conversions un-exploitable — you can split a wallet into a hundred tiny
  // converts but you still can't import more than the cap, so timing spikes only changes HOW MUCH SOURCE it
  // costs you, never lets you exceed the budget. (Replaces the old per-call 1.5% cap, which splitting bypassed.)
  const IMPORT_CAP = g => conquerTarget(g) * 0.03;                  // lifetime foreign-aid budget for planet g (≈3% of a conquest)
  const importUsed = () => (S.imported && S.imported[S.galaxy]) || 0;
  const importRoom = () => Math.max(0, IMPORT_CAP(S.galaxy) - importUsed());
  const exchangeAmt = (fromG, cash) => { if (fromG === S.galaxy || !(cash > 0)) return 0; return Math.floor(Math.min(cash * fxRate(fromG, S.galaxy), importRoom())); };   // what `cash` of fromG converts to NOW, clamped to remaining import room
  // per-class buy-cost factors (× eco(active) × 1.9^count) — keeps class differentiation but planet-local
  const UNIT_FACTOR = { turret: 10, mortar: 26, plasma: 70, laser: 150, railgun: 360, drone: 10, swarm: 26, collector: 70, magnet: 150, tractor: 320, singularity: 650 };
  // Income now comes from THROUGHPUT — killing more, tougher, more-rewarding dots —
  // not a collector yield multiplier. DROP_BASE is the cash a plain dot drops;
  // TOUGH_POW makes reward scale SUPER-linearly with a dot's toughness, so tanky
  // dots & armored elites pay disproportionately more (rewarding turret damage to
  // kill them and stronger drones to haul the bigger loot).
  const DROP_BASE = CUR_BASE;   // a plain dot drops one eco-unit of the planet's currency (must match eco's base)
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
    return { cash: Math.floor(eco(1) * startMul(1)), galaxy: 1, lv, classNodes, units: [newUnit("turret")], collectors: [{ type: "drone" }], totalRun: 0, peakGalaxy: 1, runSec: 0, vault: {}, travel: null, imported: {} };
  }
  // trim a unit/collector list down to each type's max (enforces caps on load)
  function capList(list) { const c = {}, out = []; for (const u of list || []) { const t = u.type, m = TY(t) ? TY(t).max : 99; c[t] = (c[t] || 0) + 1; if (c[t] <= m) out.push(u); } return out; }
  function freshStats() {
    const kills = {}; DEF_ORDER.forEach(t => kills[t] = 0); kills.draw = 0; kills.blackhole = 0;
    const collected = {}; COL_ORDER.forEach(t => collected[t] = 0);
    return { playSec: 0, dotsPopped: 0, specials: 0, armored: 0, kills, collected, abilities: { frenzy: 0, dotrain: 0, blackhole: 0 }, travels: 0, lost: 0, lostCash: 0 };
  }
  function freshMeta() { return { totalEver: 0, stats: freshStats() }; }
  const stat = () => META.stats;

  let dots = [], orbs = [], beams = [], drones = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0, curEarned = 0, bossAcc = 0;
  let drawing = false, lastDraw = null, trail = [], selUnit = -1, selType = "turret";
  // ---- juice: particles, screen shake, flash, floating cash ----
  let parts = [], shake = 0, flash = 0, fxEarn = 0, fxEarnT = 0, fxEarnX = 0, fxEarnY = 0, veilT = 0, landT = 0, fxAcc = 0;
  const VEIL_FADE = 0.6;   // seconds for the zoom-into-base white-wipe to fade back out after landing
  const LAND_DUR = 0.85;   // camera pull-back "you have arrived" settle after the warp lands
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
  const BUY_AMTS = [1, 10, 100, "max"];               // bulk-buy multipliers (test mode) — cycled by the BUY ×N button
  let buyIdx = 0;                                      // index into BUY_AMTS
  const buyN = () => BUY_AMTS[buyIdx] === "max" ? 100000 : BUY_AMTS[buyIdx];   // "max" = buy until unaffordable/maxed

  function recompute() {
    const L = S.lv, m = META;
    derived.incomeMul = 1;
    derived.capacity = eco(S.galaxy) * 220 * Math.pow(1.60, L.capacity);   // planet-local cash ceiling (scales with the planet's currency)
    derived.valueMul = 1 + 0.08 * L.value;          // FLAT +8% cash per level (additive — no compounding/runaway); also drives dot "menace"
    // Spawn Rate: each level wants +2 dots/sec. But the field caps at galCap (400) dots, so past a
    // soft cap the screen can't hold more — instead of wasting the upgrade, the surplus "spills over"
    // into MENACE: every dot spawns tougher & (via TOUGH_POW) worth disproportionately more. So Spawn
    // Rate keeps paying off even with a full screen, exactly like Value never caps out.
    const rawSpawn = 0.9 + 2.0 * L.spawnRate;
    derived.spawnPerSec = rawSpawn;                                           // FULL benefit — the field cap limits count, so if you kill fast you just get flooded with more dots
    derived.spawnSurplus = Math.max(0, rawSpawn - 12);                        // rate beyond the field's comfortable throughput — becomes MENACE, but only while the field is actually saturated
    if (derived.spawnMenace == null) derived.spawnMenace = 1;                 // live value, updated each frame from real field fullness in the spawn loop
    derived.luck = Math.min(0.5, 0.001 * L.luck);    // +0.1% chance of a rare 9× SPECIAL dot per Luck level
    derived.cls = {}; for (const t of ALL_TYPES) derived.cls[t] = classStats(t);
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v2";
  let wiping = false;
  function save() { if (wiping) return; try { if (S && S.vault) { const v = S.vault[S.galaxy] || (S.vault[S.galaxy] = { conquered: false, earned: 0, bgRate: 0 }); v.earned = curEarned; } localStorage.setItem(KEY, JSON.stringify({ S, META, ts: Date.now(), cps })); } catch (e) {} }
  function wipeSave() { wiping = true; try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }
  function load() {
    S = fresh(); META = freshMeta(); let off = null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {}); if (!S.units || !S.units.length) S.units = [newUnit("turret")]; S.units.forEach(u => { u.cd = u.cd || 0; }); if (!S.classNodes || typeof S.classNodes !== "object") S.classNodes = {}; ALL_TYPES.forEach(t => { if (!S.classNodes[t]) S.classNodes[t] = {}; }); if (!Array.isArray(S.collectors) || !S.collectors.length) { const n = 1 + (d.S.lv && d.S.lv.drones || 0); S.collectors = []; for (let i = 0; i < n; i++) S.collectors.push({ type: "drone" }); } S.units = capList(S.units); S.collectors = capList(S.collectors); }
        if (d.META) { META = Object.assign(freshMeta(), d.META);
          const st = d.META.stats || {}; META.stats = Object.assign(freshStats(), st);
          META.stats.kills = Object.assign(freshStats().kills, st.kills || {});
          META.stats.collected = Object.assign(freshStats().collected, st.collected || {});
          META.stats.abilities = Object.assign({ frenzy: 0, dotrain: 0, blackhole: 0 }, st.abilities || {}); }
        if (d.ts) { const e = clamp((Date.now() - d.ts) / 1000, 0, 12 * 3600);
          if (d.cps > 0 && e >= 60) { const g = Math.floor(d.cps * e * 0.5); if (g > 0) off = { gain: g, elapsed: e }; }
          // background empire kept earning while away
          if (S.vault) for (const k in S.vault) { if (+k === S.galaxy) continue; const v = S.vault[k]; if (v.conquered && v.bgRate > 0) v.cash = (v.cash || 0) + v.bgRate * e; }
          if (S.travel && S.travel.dur) S.travel.t = (S.travel.t || 0) + Math.max(0, (Date.now() - d.ts) / 1000);   // expedition keeps travelling while away (uncapped — long trips must finish)
        }
      }
    } catch (e) {}
    if (!S.vault) S.vault = {};
    if (!S.imported) S.imported = {};
    curEarned = (S.vault[S.galaxy] && S.vault[S.galaxy].earned) || 0;
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
  // --- DOT RACES: every PLANET has its OWN native race (a unique ability + look).
  // RACES[g] is the signature race that debuts on planet g; on planet g the exotic
  // spawns are mostly that race, mixed with earlier planets' races (you've seen them).
  // A race's toughness still ramps with the normal tier system, so each race has tiers.
  const RACES = [
    null,
    { p: 1,  key: "swift",     name: "Vesta Motes",      hp: 0.55, val: 1.7, weight: 1.0, speed: 3.0 },                    // fast, fragile, pays extra
    { p: 2,  key: "zigzag",    name: "Ember Sparks",     hp: 0.7,  val: 1.5, weight: 1.0, speed: 2.2, zig: 1 },            // erratic, jukes around
    { p: 3,  key: "splitter",  name: "Cinder Brood",     hp: 1.1,  val: 1.0, weight: 1.0, splits: 2, maxGen: 3 },          // splits again and again across generations
    { p: 4,  key: "grower",    name: "Hearth Bloat",     hp: 1.2,  val: 1.3, weight: 0.9, grow: 1 },                       // swells bigger & richer the longer it lives
    { p: 5,  key: "shield",    name: "Azure Bastion",    hp: 1.0,  val: 1.5, weight: 0.9, shield: 0.7, reflect: 0.3 },     // front shield soaks/reflects shots
    { p: 6,  key: "healer",    name: "Verdant Mender",   hp: 1.0,  val: 1.6, weight: 0.8, regen: 0.018, healAura: 1 },      // heals itself AND nearby dots
    { p: 7,  key: "orbiter",   name: "Cobalt Sentinel",  hp: 1.3,  val: 1.5, weight: 0.8, sat: 3, satGuard: 1 },           // orbiting satellites shield the core
    { p: 8,  key: "flock",     name: "Mistral Gale",     hp: 0.7,  val: 1.4, weight: 1.0, speed: 1.7, flock: 1 },          // flocks together (boids)
    { p: 9,  key: "cloak",     name: "Halcyon Mirage",   hp: 1.0,  val: 1.9, weight: 0.8, cloak: 1 },                      // cloaks invisible & untargetable in bursts
    { p: 10, key: "pulsar",    name: "Tempest Cell",     hp: 1.5,  val: 1.7, weight: 0.7, pulse: 1, shock: 1 },            // throbs, shock rings shove your collectors
    { p: 11, key: "phantom",   name: "Umbral Shade",     hp: 1.2,  val: 2.0, weight: 0.7, phase: 1 },                      // phases out, dodges most damage
    { p: 12, key: "juggernaut",name: "Frost Glacian",    hp: 1.9,  val: 1.8, weight: 0.7, speed: 0.7, armorUp: 1 },        // slow tank that regrows armor over time
    { p: 13, key: "reflector", name: "Onyx Warden",      hp: 1.4,  val: 1.9, weight: 0.7, deflect: 0.45 },                 // mirror facets deflect a share of every shot
    { p: 14, key: "blink",     name: "Wraith",           hp: 1.1,  val: 2.2, weight: 0.7, blink: 1 },                      // teleports around, hard to pin
    { p: 15, key: "bomber",    name: "Pyreling",         hp: 1.3,  val: 1.8, weight: 0.7, bomb: 1 },                       // detonates on death, scattering your loot
    { p: 16, key: "gravity",   name: "Abyssal Pull",     hp: 1.6,  val: 2.0, weight: 0.7, gravity: 1 },                    // drags loot orbs away from your collectors
    { p: 17, key: "leech",     name: "Devourer",         hp: 1.5,  val: 1.9, weight: 0.7, leech: 1 },                      // eats nearby loot orbs and heals from them
    { p: 18, key: "spawner",   name: "Null Spawn",       hp: 2.0,  val: 2.2, weight: 0.6, spawner: 1 },                    // endlessly births minion dots
  ];
  const raceAt = g => RACES[Math.min(Math.max(g, 1), RACES.length - 1)];
  const RACE_FX = {
    swift: "fast & fragile, pays extra", zigzag: "jukes around erratically", splitter: "splits again and again",
    grower: "swells bigger & richer the longer it lives", shield: "front shield soaks & reflects shots",
    healer: "heals itself and nearby dots", orbiter: "orbiting satellites shield its core", flock: "swarms together in a flock",
    cloak: "cloaks invisible & untargetable in bursts", pulsar: "shock rings shove your collectors away",
    phantom: "phases out, dodging most damage", juggernaut: "slow tank that regrows its armor",
    reflector: "mirror facets deflect a share of shots", blink: "teleports around to dodge fire",
    bomber: "detonates on death, scattering your loot", gravity: "drags loot orbs away from your collectors",
    leech: "devours loot orbs and heals from them", spawner: "endlessly births minion dots",
  };
  const kindChance = g => Math.min(0.14 + 0.05 * (g - 1), 0.6);
  // ── MINI-BOSSES: one elite per planet, unique name & seeded design, every ~5 min of active play ──
  const BOSS_INTERVAL = 600;   // seconds of active (boss-free) play between bosses
  const BOSS_NAMES = ["Dustmaw", "Arcfiend", "Slagtitan", "Cinderlord", "Tidewretch", "Sporemother", "Cobalt Sentinel", "Galereaver", "Glimmertyrant", "Voltaic Colossus", "Umbral Dread", "Rimewarden", "Shardbreaker", "Wispcaller", "Ashen Behemoth", "Voidstone Idol", "Bilewurm", "The Null King"];
  const bossName = g => BOSS_NAMES[Math.min(Math.max(g, 1), 18) - 1] || "Boss";
  function spawnBoss() {
    const g = S.galaxy, vm = derived.valueMul, base = 18 * Math.pow(vm, 1.3);
    let dps = 0; for (const u of S.units) dps += uDmg(u) * DEF_TYPES[u.type].rate * cls(u.type).rate;   // size HP to your real firepower → a ~minute+ fight, scales with you
    const hp = Math.max(base * 30, dps * 60);
    const r = clamp(40 + Math.log10(hp + 10) * 2.4, 42, 60);
    const val = Math.max(1, Math.round(eco(g) * vm * derived.incomeMul * 120));   // fat bounty for a hard kill
    // each planet's boss gets its OWN seeded movement personality (not the lazy drift-to-centre)
    const mh = Math.imul((g + 13) * 2654435761, 40503) >>> 0, mr = k => ((mh >>> (k * 4)) & 15) / 15;
    const styles = ["lissajous", "orbit", "charge", "pace", "prowl", "dash"];
    dots.push({ x: W / 2, y: H * 0.3, vx: rnd(-18, 18), vy: rnd(-8, 8), hp, maxHp: hp, value: val, value0: val,
      r, r0: r, tier: 6, spin: Math.random() * TAU, special: false, armored: true, kind: "boss", boss: true, bg: g,
      shieldMax: hp * 0.35, shield: hp * 0.35, armorUp: 0, regen: 0.012, add: 0,
      mstyle: styles[Math.floor(mr(0) * styles.length)], mt: 0, mphase: mr(1) * TAU, mfx: 0.5 + mr(2) * 0.9, mfy: 0.45 + mr(3) * 0.9, mdir: mr(4) < 0.5 ? -1 : 1, mrad: 95 + mr(5) * 75, mtimer: 0, mtx: W / 2, mty: H * 0.35, mdash: false,
      weight: 5, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#ffffff" });
    floatTxt(W / 2, H / 2 - 70, "⚠ " + bossName(g) + " ⚠"); flashAdd(0.55); shakeAdd(9);
  }
  // boss movement with personality — each style roams the upper field very differently
  function bossMove(d, dt) {
    d.mt += dt; const t = d.mt;
    const L = 52, R = W - 52, T = 72, B = H * 0.6, cx = (L + R) / 2, cy = (T + B) / 2;
    if (d.mstyle === "lissajous") {                                   // graceful serpentine figure-weave
      const tx = cx + Math.sin(t * d.mfx + d.mphase) * (R - L) / 2 * 0.86, ty = cy + Math.sin(t * d.mfy * 1.4) * (B - T) / 2 * 0.82;
      d.x += (tx - d.x) * Math.min(1, dt * 1.7); d.y += (ty - d.y) * Math.min(1, dt * 1.7);
    } else if (d.mstyle === "orbit") {                                // territorial guardian, circling
      const a = t * 0.55 * d.mdir + d.mphase, tx = cx + Math.cos(a) * d.mrad, ty = cy + Math.sin(a) * d.mrad * 0.6;
      d.x += (tx - d.x) * Math.min(1, dt * 2.3); d.y += (ty - d.y) * Math.min(1, dt * 2.3);
    } else if (d.mstyle === "charge") {                               // aggressive bruiser: lunges, recoils, repicks
      d.mtimer -= dt; if (d.mtimer <= 0) { d.mtx = rnd(L, R); d.mty = rnd(T, B); d.mtimer = rnd(1.1, 2.1); burst(d.x, d.y, 5, 50, 1.2); }
      d.vx = (d.vx || 0) * 0.9 + (d.mtx - d.x) * 0.07; d.vy = (d.vy || 0) * 0.9 + (d.mty - d.y) * 0.07;
      const sp = Math.hypot(d.vx, d.vy); if (sp > 280) { d.vx *= 280 / sp; d.vy *= 280 / sp; } d.x += d.vx * dt; d.y += d.vy * dt;
    } else if (d.mstyle === "pace") {                                 // pacing sentinel along the top, bobbing
      const tx = cx + Math.sin(t * 0.9 * d.mdir + d.mphase) * (R - L) / 2 * 0.92, ty = T + 38 + Math.abs(Math.sin(t * 2)) * 34;
      d.x += (tx - d.x) * Math.min(1, dt * 3); d.y += (ty - d.y) * Math.min(1, dt * 2.4);
    } else if (d.mstyle === "prowl") {                                // erratic predator: sudden bursts & turns
      d.mtimer -= dt; if (d.mtimer <= 0) { const a = Math.random() * TAU, sp = rnd(70, 175); d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp; d.mtimer = rnd(0.5, 1.4); }
      d.x += (d.vx || 0) * dt; d.y += (d.vy || 0) * dt; if (d.x < L || d.x > R) d.vx *= -1; if (d.y < T || d.y > B) d.vy *= -1;
    } else {                                                          // dash: twitchy — holds, then darts to a new spot
      d.mtimer -= dt;
      if (d.mdash) { const dx = d.mtx - d.x, dy = d.mty - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < 12 || d.mtimer <= 0) { d.mdash = false; d.mtimer = rnd(0.8, 1.7); burst(d.x, d.y, 9, 90, 1.7); ring(d.x, d.y, d.r, d.r + 34, 0.3); } else { const step = Math.min(dl, 560 * dt); d.x += dx / dl * step; d.y += dy / dl * step; } }
      else if (d.mtimer <= 0) { d.mdash = true; d.mtx = rnd(L, R); d.mty = rnd(T, B); d.mtimer = 0.7; }
    }
    d.x = clamp(d.x, L, R); d.y = clamp(d.y, T, B);
  }
  function spawnDot(special) {
    const g = S.galaxy, vscale = Math.pow(derived.valueMul, 1.3), base = 18 * enemyHpMul(g) * vscale, avg = base * 1.3;   // HP scales SUPER-linearly with Value — Value genuinely & heavily toughens enemies; cash is unaffected (it keys off hp/avg, where base cancels)
    const men = S.free ? 1.0 : clamp(S.lv.value / 28, 0, 3.5);   // "menace": Value drives how tough/common the hard dots are — steeper & high cap so the strongest become real multi-second tanks
    const men01 = S.free ? 1 : Math.min(1, men);                  // 0..1 gate — keeps dots BASIC until Value is invested
    let roll = rnd(0.7, 1.0 + men * 5.0), armored = false, kind = "normal", cfg = null, mv = 20;
    // difficulty & craziness are bought with VALUE: at Value 0 every dot is the
    // plainest tier-0 grey. armored elites & exotic kinds only appear once you invest.
    if (Math.random() < armorChance(g) * men01 + men * 0.08) { armored = true; roll *= rnd(7, 12) * (1 + men); mv = 9; }   // super-advanced elite: LOTS of health
    else if (Math.random() < kindChance(g) * men01 + men * 0.06) {
      // mostly THIS planet's native race, sometimes an earlier planet's race (variety)
      const gi = Math.min(g, RACES.length - 1);
      cfg = (Math.random() < 0.72 || gi <= 1) ? RACES[gi] : RACES[1 + Math.floor(Math.random() * gi)];
      kind = cfg.key;
    }
    if (cfg) { roll *= cfg.hp; if (cfg.speed) mv *= cfg.speed; }
    const hp = base * roll * (derived.spawnMenace || 1);   // surplus Spawn Rate (past the field cap) makes every dot tougher & richer
    special = special || (!armored && !cfg && Math.random() < derived.luck);
    const val = Math.max(1, Math.round(eco(g) * derived.valueMul * derived.incomeMul * Math.pow(hp / avg, TOUGH_POW) * (special ? 9 : 1) * (cfg ? cfg.val : 1)));
    const r = clamp(7 + Math.log10(hp + 10) * 2.6, kind === "swift" || kind === "flock" ? 6 : 7, armored ? 40 : 24);
    // visual tier: the tougher the dot, the more elaborate (spikes/rings)
    const tier = roll < 1.0 ? 0 : roll < 1.5 ? 1 : roll < 2.2 ? 2 : roll < 4 ? 3 : roll < 6 ? 4 : roll < 9 ? 5 : 6;
    // WAVE STYLE: enter from a random point on the perimeter and drift slowly toward the centre
    let ex, ey; const edge = Math.floor(Math.random() * 4), j = () => rnd(0, 26);
    if (edge === 0) { ex = rnd(34, W - 34); ey = 44 + j(); }              // top
    else if (edge === 1) { ex = rnd(34, W - 34); ey = H - 140 - j(); }    // bottom (above the dock)
    else if (edge === 2) { ex = 34 + j(); ey = rnd(64, H - 150); }        // left
    else { ex = W - 34 - j(); ey = rnd(64, H - 150); }                    // right
    const ia = Math.atan2(H / 2 - ey, W / 2 - ex) + rnd(-0.55, 0.55), isp = mv * rnd(0.55, 1.0);
    const d = { x: ex, y: ey, vx: Math.cos(ia) * isp, vy: Math.sin(ia) * isp, spd: mv,
      hp, maxHp: hp, value: val, value0: val, r, r0: r, tier, spin: Math.random() * TAU, special, armored, kind, weight: armored ? 2.6 : 1, hit: 0, drawCd: 0, refl: 0, born: 0,
      color: armored ? "#9a9a9a" : special ? "#ffffff" : kind !== "normal" ? "#cfcfcf" : `hsl(0,0%,${44 + ((g - 1) % 6) * 8}%)` };
    if (cfg) {
      if (cfg.shield) { d.shieldMax = hp * cfg.shield; d.shield = d.shieldMax; d.reflect = cfg.reflect; }
      if (cfg.regen) d.regen = cfg.regen;
      if (cfg.healAura) d.healAura = 0;
      if (cfg.splits) { d.splits = cfg.splits; d.gen = 0; d.maxGen = cfg.maxGen || 1; }
      if (cfg.sat) { d.sat = cfg.sat; if (cfg.satGuard) { d.satGuard = 1; d.satAcc = 0; } }
      if (cfg.pulse) { d.pulse = 0; if (cfg.shock) d.shock = 1; }
      if (cfg.phase) { d.phase = 0; d.phased = false; }
      if (cfg.zig) d.zig = 0;
      if (cfg.grow) d.grow = 0;
      if (cfg.flock) d.flock = 1;
      if (cfg.cloak) { d.cloak = Math.random() * 3; d.cloaked = false; }
      if (cfg.armorUp) { d.armorUp = 0; d.shieldMax = hp; d.shield = 0; }
      if (cfg.deflect) d.deflect = cfg.deflect;
      if (cfg.blink) d.blink = Math.random();
      if (cfg.bomb) d.bomb = 1;
      if (cfg.gravity) d.gravity = 1;
      if (cfg.leech) d.leech = 1;
      if (cfg.spawner) d.spawner = 0;
    }
    dots.push(d);
  }

  function fireUnit(u, p) {
    // gather every in-range dot, nearest first, preferring ones not already
    // marked for lethal damage this frame (so fire spreads instead of overkilling).
    const rng = uRange(u) ** 2; const cands = [];
    const iq = Math.min(1, uInt(u));   // 0 = dumb (nearest-first), ~1 = perfect coordination
    for (const d of dots) {
      if (d.dead || d.cloaked) continue; const q = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (q > rng) continue;   // Halcyon Mirage can't be targeted while cloaked
      // a smarter unit "reads" lethal damage already inbound (pending kills + a margin
      // for shots that haven't resolved yet) and won't waste a bolt on a doomed dot.
      const inbound = (d.pending || 0) + (d.aimed || 0);
      cands.push({ d, q, covered: inbound >= d.hp, value: d.value || 0 });
    }
    if (!cands.length) return;
    // dumb units sort by distance only; intelligent ones triage live targets first,
    // then put their shots on the highest-value dots they can actually finish.
    cands.sort((a, b) => (a.covered - b.covered) ||
      (iq > 0.4 ? (b.value - a.value) : 0) || (a.q - b.q));
    const shots = 1 + uMulti(u);                            // keystone nodes grant extra simultaneous targets
    const fired = [];
    for (const c of cands) {
      if (fired.length >= shots) break;
      // overkill avoidance: the more intelligent the unit, the more reliably it
      // *skips* a dot another shot is already guaranteed to kill (saving the bolt).
      if (c.covered && iq > 0 && Math.random() < iq) continue;
      fired.push(c);
    }
    if (!fired.length) fired.push(cands[0]);   // nothing valid to skip onto — fire anyway
    let recoiled = false;
    for (const c of fired) {
      const target = c.d;
      let dmg = uDmg(u), crit = Math.random() < uCrit(u); if (crit) dmg *= uCritMul(u);
      target.aimed = (target.aimed || 0) + dmg;   // mark for coordination — later units this frame see it's spoken-for
      const ddx = target.x - p.x, ddy = target.y - p.y, ddl = Math.hypot(ddx, ddy) || 1;
      if (!recoiled) { u.rx = -ddx / ddl * 4; u.ry = -ddy / ddl * 4; u.aim = Math.atan2(ddy, ddx); u.flash = 0.08; recoiled = true; }   // muzzle recoil + aim + brief flash (toward first target)
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
          beams.push({ x1: src.x, y1: src.y, x2: best.x, y2: best.y, life: 0.1, color: "#fff", w: 2 });
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
    if (d.deflect && Math.random() < d.deflect) { d.refl = 0.14; return; }   // Onyx mirror facets deflect a share of every shot
    if (d.sat > 0 && d.satGuard) { d.satAcc += dmg; const per = d.maxHp * 0.14; while (d.satAcc >= per && d.sat > 0) { d.satAcc -= per; d.sat--; burst(d.x, d.y, 4, 60, 1.4); } dmg *= 0.4; }   // Cobalt satellites shield the core until stripped
    if (d.shield > 0) {
      if (Math.random() < d.reflect) { d.refl = 0.14; return; }   // shield reflects the shot
      d.shield -= dmg; d.hit = 0.08;
      if (d.shield > 0) return;                                   // fully absorbed
      dmg = -d.shield; d.shield = 0;                              // overflow spills to hp
    }
    d.hp -= dmg; d.hit = 0.08;
    if (d.hp <= 0) {
      d.dead = true;
      if (d.boss) {   // a defeated mini-boss bursts into several fat loot orbs + big payoff fx
        const np = 5; for (let i = 0; i < np; i++) { const a = i / np * TAU; orbs.push({ x: d.x + Math.cos(a) * d.r * 0.6, y: d.y + Math.sin(a) * d.r * 0.6, value: Math.round(d.value / np), t: 0, weight: 2, consume: 0, consumeMax: 1.2, r0: 6.5, big: true }); }
        burst(d.x, d.y, 44, 210, 3.2); ring(d.x, d.y, d.r, d.r + 130, 0.6); ring(d.x, d.y, d.r, d.r + 70, 0.4); shakeAdd(7); flashAdd(0.35);
        floatTxt(d.x, d.y - d.r - 12, "☠ " + bossName(d.bg || S.galaxy) + " DEFEATED");
        const sb = stat(); sb.dotsPopped++; sb.bosses = (sb.bosses || 0) + 1; if (src) sb.kills[src] = (sb.kills[src] || 0) + 1;
        return;
      }
      // bigger / tougher kills drop heavier loot that takes longer to consume
      const big = d.armored || (d.tier || 0) >= 3, cmax = big ? 1.6 : ((d.tier || 0) >= 1 || d.r > 12 ? 0.55 : 0.1);
      orbs.push({ x: d.x, y: d.y, value: d.value, t: 0, weight: d.weight || 1, consume: 0, consumeMax: cmax, r0: big ? 6.5 : ((d.tier || 0) >= 1 ? 4 : 2.6), big });
      const s = stat(); s.dotsPopped++; if (d.special) s.specials++; if (d.armored) s.armored = (s.armored || 0) + 1; if (src) s.kills[src] = (s.kills[src] || 0) + 1;
      const nb = Math.min(28, 6 + (d.tier || 0) * 4 + (d.armored ? 8 : 0));
      burst(d.x, d.y, nb, 90 + (d.tier || 0) * 24 + (d.armored ? 60 : 0), 2 + (d.tier || 0) * 0.3);
      ring(d.x, d.y, d.r, d.r + 18 + (d.tier || 0) * 8, 0.3); if (d.armored || (d.tier || 0) >= 4) shakeAdd(d.armored ? 1.8 : 1);
      if (d.splits && (d.gen || 0) < (d.maxGen || 1)) for (let i = 0; i < d.splits; i++) {
        const hp = d.maxHp * 0.42, cv = Math.max(1, Math.round(d.value * 0.4)), cr = Math.max(6, d.r * 0.66);
        dots.push({ x: d.x + rnd(-10, 10), y: d.y + rnd(-10, 10), vx: rnd(-50, 50), vy: rnd(-50, 50), hp, maxHp: hp,
          value: cv, value0: cv, r: cr, r0: cr, tier: 0, spin: 0, special: false, armored: false,
          kind: "splitter", splits: d.splits, maxGen: d.maxGen, gen: (d.gen || 0) + 1, weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: d.color });
      }
      if (d.bomb) { ring(d.x, d.y, d.r, d.r + 75, 0.5); burst(d.x, d.y, 18, 170, 2.6); shakeAdd(2.5); flashAdd(0.12);
        for (let oi = orbs.length - 1; oi >= 0; oi--) { const o = orbs[oi], dx = o.x - d.x, dy = o.y - d.y, q = dx * dx + dy * dy; if (q < 8100) { const dl = Math.sqrt(q) || 1; o.x = clamp(o.x + dx / dl * 70, 20, W - 20); o.y = clamp(o.y + dy / dl * 70, 40, H - 110); o.t += 3.5; } }   // Pyreling detonation scatters & ages your loot
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
      S.cash = Math.min(derived.capacity, S.cash + got); S.totalRun += got; META.totalEver += got; curEarned += got;
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
    if (S.travel) {   // an expedition is in transit — advance it and arrive (ticks on any screen)
      S.travel.t += dt;
      if (S.travel.t >= S.travel.dur) { const to = S.travel.to; S.travel = null; snapshotActive(); flashAdd(0.7); shakeAdd(6); ring(W / 2, H / 2, 10, Math.max(W, H), 0.6); activatePlanet(to); save(); }
    }
    if (state !== "play") return;
    recompute();
    META.stats.playSec += dt; S.runSec += dt;
    if (frenzyT > 0) frenzyT -= dt;
    if (blackholeT > 0) blackholeT -= dt;
    for (const k in abil) if (abil[k] > 0) abil[k] = Math.max(0, abil[k] - dt);

    const baseCap = galCap(S.galaxy);
    const sup = Math.min(derived.spawnSurplus || 0, 80);
    const rawRate = derived.spawnPerSec * galSpawnMul(S.galaxy);
    // SMOOTH SPAWNING + quantity → toughness. New dots appear at most SPAWN_SMOOTH/sec, so a cleared
    // field refills as a gentle trickle instead of slamming 120 back in at once (that instant 1:1 respawn
    // was the stutter). Spawn Rate bought beyond that ceiling is NOT wasted — it converts to per-dot
    // TOUGHNESS, and the exponent is tuned (×0.7, against TOUGH_POW 1.45) so it's income-NEUTRAL: you kill
    // fewer dots but each is worth the difference. Net on every planet: late game is a handful of beefy
    // tanks at a calm cadence, not a churning 120-dot blizzard. Easier to read, kinder to the framerate.
    const visRate = Math.min(rawRate, SPAWN_SMOOTH);
    const overflowMen = rawRate > SPAWN_SMOOTH ? Math.min(Math.pow(rawRate / SPAWN_SMOOTH, 0.7), 8) : 1;   // income-neutral redistribution, capped ×8 so dots stay killable & the field stays light
    const thin = clamp(1 - 0.011 * sup, 0.3, 1);                             // late game also THINS the standing count
    const cap = Math.max(50, Math.round(baseCap * thin));
    const sat = clamp((dots.length / cap - 0.6) / 0.4, 0, 1);                // extra toughness only if the field genuinely backs up (you can't keep up)
    const targetMenace = overflowMen * (1 + sat * 0.6);
    derived.spawnMenace += (targetMenace - derived.spawnMenace) * Math.min(1, dt * 2);   // smooth so it doesn't jitter
    spawnAcc += dt * visRate;
    let _spawned = 0; while (spawnAcc >= 1 && dots.length < cap && _spawned < 3) { spawnDot(); spawnAcc -= 1; _spawned++; }   // hard per-frame cap kills the burst-spawn frame spike
    if (spawnAcc > 2) spawnAcc = 2;
    // mini-boss: one at a time; timer only counts while no boss is on the field
    if (!dots.some(d => d.boss)) { bossAcc += dt; if (bossAcc >= BOSS_INTERVAL) { bossAcc = 0; spawnBoss(); } }

    for (const d of dots) {
      d.pending = 0; d.aimed = 0; if (d.born < 0.2) d.born += dt; d.spin += dt * 0.9;
      if (d.hit > 0) d.hit -= dt; if (d.drawCd > 0) d.drawCd -= dt; if (d.refl > 0) d.refl -= dt;
      if (d.boss) { d.add += dt; if (d.add > 6 && dots.length < cap - 2) { d.add = 0;   // boss summons a couple of adds to keep the pressure on
          const mb = 18 * Math.pow(derived.valueMul, 1.3) * rnd(1.5, 3), mr = clamp(8 + Math.log10(mb + 10) * 2, 8, 16), mv = Math.max(1, Math.round((d.value0 || 1) * 0.01));
          for (let i = 0; i < 2; i++) dots.push({ x: d.x + rnd(-24, 24), y: d.y + rnd(-24, 24), vx: rnd(-65, 65), vy: rnd(-50, 50), hp: mb, maxHp: mb, value: mv, value0: mv, r: mr, r0: mr, tier: 1, spin: 0, special: false, armored: false, kind: "minion", weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#bbbbbb" });
          burst(d.x, d.y, 6, 60, 1.4); } }
      if (d.regen && d.hit <= 0 && d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * d.regen * dt);  // heals unless under fire
      if (d.pulse !== undefined) { d.pulse += dt; if (d.pulse > 1.5) { d.pulse = 0; ring(d.x, d.y, d.r, d.r + 26, 0.45); if (d.shock) for (const dr of drones) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy); if (dl < 115) { dr.vx += dx / (dl || 1) * 210; dr.vy += dy / (dl || 1) * 210; } } } }   // Tempest shock shoves collectors off
      if (d.phase !== undefined) { d.phase += dt; d.phased = (d.phase % 2.4) < 1.0; }
      if (d.zig !== undefined) { d.zig += dt; if (d.zig > 0.35) { d.zig = 0; const sp = Math.hypot(d.vx, d.vy) || 1, a = Math.random() * TAU; d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp; } }
      if (d.grow !== undefined) { d.grow += dt; const f = 1 + Math.min(d.grow * 0.05, 1.4); d.r = d.r0 * f; d.value = Math.round(d.value0 * f * f); }                                                       // Hearth swells bigger & richer
      if (d.healAura !== undefined) { d.healAura += dt; if (d.healAura > 1.2) { d.healAura = 0; for (const o of dots) { if (o === d || o.dead) continue; if ((o.x - d.x) ** 2 + (o.y - d.y) ** 2 < 4900 && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.02); } } }   // Verdant mends nearby dots
      if (d.armorUp !== undefined) { d.armorUp += dt; if (d.hit <= 0) d.shield = Math.min(d.shieldMax, d.shield + d.shieldMax * 0.2 * dt); }                                                              // Frost regrows armor
      if (d.cloak !== undefined) { d.cloak += dt; d.cloaked = (d.cloak % 3.0) < 1.4; }                                                                                                                    // Halcyon cloaks invisible
      if (d.blink !== undefined) { d.blink += dt; if (d.blink > 1.6) { d.blink = 0; burst(d.x, d.y, 5, 50, 1.5); d.bx = d.x; d.by = d.y; d.x = clamp(d.x + rnd(-95, 95), 30, W - 30); d.y = clamp(d.y + rnd(-95, 95), 50, H - 130); } }   // Wraith teleports
      if (d.flock) { let ax = 0, ay = 0, cx = 0, cy = 0, n = 0; for (const o of dots) { if (o === d || !o.flock) continue; const dx = o.x - d.x, dy = o.y - d.y, q = dx * dx + dy * dy; if (q < 8100) { ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; n++; if (q < 676) { d.vx -= dx * 0.05; d.vy -= dy * 0.05; } } } if (n) { d.vx += (ax / n - d.vx) * 0.02 + (cx / n - d.x) * 0.004; d.vy += (ay / n - d.vy) * 0.02 + (cy / n - d.y) * 0.004; } }   // Mistral flocks (boids)
      if (d.gravity) for (const o of orbs) { const dx = d.x - o.x, dy = d.y - o.y, q = dx * dx + dy * dy; if (q < 19600) { const dl = Math.sqrt(q) || 1; o.x += dx / dl * 55 * dt; o.y += dy / dl * 55 * dt; } }   // Abyss drags loot away from collectors
      if (d.leech) for (let oi = orbs.length - 1; oi >= 0; oi--) { const o = orbs[oi], dx = d.x - o.x, dy = d.y - o.y, q = dx * dx + dy * dy; if (q < 22500) { const dl = Math.sqrt(q) || 1; o.x += dx / dl * 135 * dt; o.y += dy / dl * 135 * dt; if (q < (d.r + 9) ** 2) { d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.06); ring(d.x, d.y, d.r, d.r + 10, 0.3); META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(oi, 1); } } }   // Devourer eats orbs & heals
      if (d.spawner !== undefined) { d.spawner += dt; if (d.spawner > 3.8 && dots.length < cap) { d.spawner = 0; const hp = d.maxHp * 0.18, mr = Math.max(5, d.r0 * 0.5); dots.push({ x: d.x + rnd(-14, 14), y: d.y + rnd(-14, 14), vx: rnd(-55, 55), vy: rnd(-55, 55), hp, maxHp: hp, value: Math.max(1, Math.round((d.value0 || d.value) * 0.18)), value0: 1, r: mr, r0: mr, tier: 0, spin: 0, special: false, armored: false, kind: "minion", weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#bbbbbb" }); burst(d.x, d.y, 4, 40, 1.2); } }   // Null Spawn births minions
      if (blackholeT > 0) { const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1; d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt; hitDot(d, brushDmg() * 0.6 * dt, "blackhole"); }
      else if (d.boss) { bossMove(d, dt); }   // bosses roam with their own personality, not the slow drift-to-centre
      else {   // wave drift: gentle pull toward the centre + a little wander, capped to a slow creep
        const cxp = W / 2 - d.x, cyp = H / 2 - d.y, cdp = Math.hypot(cxp, cyp) || 1;
        d.vx += (cxp / cdp) * 9 * dt + rnd(-13, 13) * dt; d.vy += (cyp / cdp) * 9 * dt + rnd(-13, 13) * dt;
        const sp2 = Math.hypot(d.vx, d.vy), mx = Math.max(d.spd || 20, 16) * 1.3;
        if (sp2 > mx) { d.vx *= mx / sp2; d.vy *= mx / sp2; }
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < 30 || d.x > W - 30) d.vx *= -0.5; if (d.y < 50 || d.y > H - 130) d.vy *= -0.5;
        d.x = clamp(d.x, 30, W - 30); d.y = clamp(d.y, 50, H - 130);
      }
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
      if (dr.pop > 0) dr.pop -= dt;
      dr.parking = false;
    }
    // black holes also drag nearby dots gently toward them (the "suck in" feel)
    for (const dr of drones) { if (COL_TYPES[dr.type].mode !== "hole") continue; const R = cSuction(dr.type) * 1.5; for (const d of dots) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < R) { d.x += dx / dl * 60 * dt; d.y += dy / dl * 60 * dt; } } }
    for (const dr of drones) dr.proc = 0;   // free maw bays this frame; Capacity = how many orbs a collector processes in parallel
    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      let nd = null, bd = Infinity; for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2, rng = cSuction(dr.type) ** 2; if (q < bd && q < rng) { bd = q; nd = dr; } }
      if (nd) {
        const dl = Math.sqrt(bd) || 1, pull = (COL_TYPES[nd.type].mode === "hole" ? 150 : 240) / (o.weight || 1);
        if (dl < cCollect(nd.type) + 6) {                         // in reach — but it needs a free maw bay to actually process it
          if (nd.proc < cCapacity(nd.type)) {                     // a bay is open → process this orb (Speed/Reach get it here, Process/Capacity chew through it)
            nd.proc++;
            o.consume += dt * cIngest(nd.type); o.x += (nd.x - o.x) * 0.3; o.y += (nd.y - o.y) * 0.3; if (o.consumeMax > 0.2) nd.parking = true;
            if (Math.random() < (o.big ? 0.4 : 0.12)) spark(o.x, o.y);
            if (o.consume >= o.consumeMax) { const got = Math.round(o.value * cYield(nd.type) * orbFresh(o)); earned += got; META.stats.collected[nd.type] = (META.stats.collected[nd.type] || 0) + got; fxEarn += got; fxEarnX = nd.x; fxEarnY = nd.y - 6; if (o.big) { burst(o.x, o.y, 8, 70, 2); nd.pop = 0.25; } orbs.splice(i, 1); }
          } else {                                                 // all bays busy — orb queues at the maw; with too little Capacity a dense pile backs up and can expire
            o.x += (nd.x - o.x) * 0.1; o.y += (nd.y - o.y) * 0.1;
            if (o.t > ORB_LIFE) { META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(i, 1); }
          }
        } else { o.x += (nd.x - o.x) / dl * pull * dt; o.y += (nd.y - o.y) / dl * pull * dt; if (o.t > ORB_LIFE) { META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(i, 1); } }
      }
      else if (o.t > ORB_LIFE) { META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(i, 1); }
    }
    if (earned > 0) { S.cash = Math.min(derived.capacity, S.cash + earned); S.totalRun += earned; META.totalEver += earned; earnAcc += earned; curEarned += earned;
      const pm = planetMeta(S.galaxy); if (!pm.conquered && curEarned >= conquerTarget(S.galaxy)) { pm.conquered = true; pm.bgRate = Math.max(pm.bgRate || 0, cps * BG_EFF); floatTxt(W / 2, H / 2 - 40, "✦ PLANET CONQUERED"); flashAdd(0.4); shakeAdd(3); } }
    // background empire: every conquered, non-active planet keeps earning its own currency
    for (const k in S.vault) { if (+k === S.galaxy) continue; const v = S.vault[k]; if (v.conquered && v.bgRate > 0) v.cash = (v.cash || 0) + v.bgRate * dt; }
    fxEarnT += dt; if (fxEarn > 0 && fxEarnT > 0.22) { floatTxt(fxEarnX, fxEarnY - 14, "+" + curSym(S.galaxy) + fmt(fxEarn)); fxEarn = 0; fxEarnT = 0; }
    earnT += dt; if (earnT >= 1) { cps = cps * 0.6 + (earnAcc / earnT) * 0.4; earnAcc = 0; earnT = 0; }
    for (const tp of trail) tp.life -= dt; trail = trail.filter(tp => tp.life > 0);
    stepFx(dt);
    if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy;
  }

  // each planet's boss gets a distinct, seeded silhouette (sides / spokes / rings / spin) + a health bar
  function drawBoss(d) {
    const g = d.bg || S.galaxy, hsh = Math.imul((g + 7) * 2654435761, 40503) >>> 0, rv = k => ((hsh >> (k * 3)) & 7) / 7;
    const sides = 3 + Math.floor(rv(0) * 6), spokes = 6 + Math.floor(rv(1) * 8), rings = 1 + Math.floor(rv(2) * 3);
    const dir = rv(3) < 0.5 ? -1 : 1, sp = d.spin * (0.6 + rv(4) * 0.8) * dir;
    const r = d.r * (d.hit > 0 ? 1.12 : 1) * (d.born < 0.3 ? clamp(d.born / 0.3, 0.3, 1) : 1);
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(d.spin * 3); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x, d.y, r * 2.0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;   // menace aura
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(d.x, d.y, r * 1.62, -sp, -sp + TAU); ctx.stroke(); ctx.setLineDash([]);   // dashed halo
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4; ctx.fillStyle = "#fff";                                          // rotating spokes/limbs
    for (let k = 0; k < spokes; k++) { const a = sp + k / spokes * TAU, o = r * (1.35 + 0.22 * Math.sin(d.spin * 2 + k)); ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * r * 1.02, d.y + Math.sin(a) * r * 1.02); ctx.lineTo(d.x + Math.cos(a) * o, d.y + Math.sin(a) * o); ctx.stroke(); ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * o, d.y + Math.sin(a) * o, 2.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = d.hit > 0 ? "#fff" : "#d8d8d8"; ctx.beginPath();                                                // core polygon
    for (let k = 0; k <= sides; k++) { const a = -sp * 0.5 + k / sides * TAU, rr = r * (k % 2 && rv(5) > 0.5 ? 0.82 : 1); (k ? ctx.lineTo : ctx.moveTo).call(ctx, d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.4; for (let k = 1; k <= rings; k++) { ctx.beginPath(); ctx.arc(d.x, d.y, r * (k / (rings + 1)), 0, TAU); ctx.stroke(); }   // inner rings
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, r * 0.24, 0, TAU); ctx.fill();                       // core eye
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x + Math.cos(d.spin) * r * 0.1, d.y + Math.sin(d.spin) * r * 0.1, r * 0.1, 0, TAU); ctx.fill();
    if (d.shield > 0) { ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.globalAlpha = clamp(d.shield / d.shieldMax, 0.25, 1); ctx.beginPath(); ctx.arc(d.x, d.y, r * 1.78, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const bw = 150, bx = d.x - bw / 2, by = d.y - r * 1.95 - 16;                                                    // health bar + name
    ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
    ctx.fillStyle = "#fff"; ctx.fillRect(bx, by, bw * clamp(d.hp / d.maxHp, 0, 1), 5);
    if (d.shield > 0) { ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(bx, by, bw * clamp(d.shield / d.shieldMax, 0, 1), 5); }
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText("☠ " + bossName(g), d.x, by - 4);
  }
  // Black-iris veil for the zoom-into-base transition. rPct = radius of the clear hole (% of screen):
  // 0 = fully black, ≥135 = fully clear (veil off). Centered, so it closes on / opens from the planet.
  function setVeil(rPct) {
    const v = $("transition"); if (!v) return;
    if (rPct == null || rPct >= 135) { v.style.opacity = "0"; return; }
    const r = Math.max(0, rPct);
    v.style.opacity = "1";
    v.style.background = "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) " + r.toFixed(1) + "%, #000 " + (r + 8).toFixed(1) + "%)";
  }
  /* ----------------------------- render -------------------------- */
  function render() {
    ctx.clearRect(0, 0, SW, SH);
    const g = ctx.createRadialGradient(SW / 2, SH / 2, 0, SW / 2, SH / 2, Math.max(SW, SH) * 0.7);
    g.addColorStop(0, `hsl(0,0%,${7 + ((S.galaxy - 1) % 6) * 2}%)`); g.addColorStop(1, "#000");
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    ctx.save();
    ctx.translate(SW / 2, SH / 2);                                  // center-locked world camera
    if (shake > 0.2) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    ctx.scale(camZoom, camZoom); ctx.translate(-W / 2, -H / 2);
    if (blackholeT > 0) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, TAU); ctx.fill(); }
    for (const b of beams) { const a = clamp(b.life / (b.w > 2 ? 0.13 : 0.08), 0, 1); ctx.strokeStyle = b.color; ctx.globalAlpha = a * 0.25; ctx.lineWidth = (b.w || 2) * 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); ctx.globalAlpha = a; ctx.lineWidth = b.w || 2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const lod = dots.length > 150;   // render LOD: when the field is busy, skip per-dot spikes/rings/race decorations (keep core + threat rings + HP bar) so a crowded field stays at 60fps
    for (const d of dots) {
      if (d.boss) { drawBoss(d); continue; }
      const pulse = d.pulse !== undefined ? 1 + 0.12 * Math.sin(d.born * 0.1 + d.pulse * 4) : 1;
      const dr2 = d.r * (d.born < 0.2 ? clamp(d.born / 0.18, 0.2, 1) : 1) * (d.hit > 0 ? 1 + d.hit / 0.08 * 0.28 : 1) * pulse;
      const ga = d.phased ? 0.4 : d.cloaked ? 0.12 : 1;
      if (d.kind === "swift" || d.kind === "zigzag") { ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 0.12, d.y - d.vy * 0.12); ctx.stroke(); }  // motion streak
      if (d.blink !== undefined && d.bx !== undefined) { ctx.globalAlpha = clamp(0.35 - d.blink * 0.22, 0, 0.35); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.bx, d.by, dr2 * 0.8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }  // Wraith after-image
      // HP-tier spikes: tougher dots grow rotating spikes around the core
      if (!lod && d.tier >= 1) { ctx.globalAlpha = ga; ctx.strokeStyle = d.color; ctx.lineWidth = 1.5 + d.tier * 0.3; const ns = 3 + d.tier * 2; for (let k = 0; k < ns; k++) { const a = d.spin + k / ns * TAU, i0 = dr2 * 0.9, o0 = dr2 + 3 + d.tier * 1.6; ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * i0, d.y + Math.sin(a) * i0); ctx.lineTo(d.x + Math.cos(a) * o0, d.y + Math.sin(a) * o0); ctx.stroke(); } ctx.globalAlpha = 1; }
      ctx.globalAlpha = ga; ctx.fillStyle = d.hit > 0 ? "#fff" : d.color; ctx.beginPath(); ctx.arc(d.x, d.y, dr2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      // tier rings inside (segmented core)
      if (!lod && d.tier >= 2) { ctx.globalAlpha = ga * 0.8; ctx.strokeStyle = "#000"; ctx.lineWidth = 1; for (let k = 1; k < d.tier; k++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (k / d.tier), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (d.special) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke(); }
      if (d.armored) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 - 2, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3, 0, TAU); ctx.stroke(); }
      if (lod) { if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); } continue; }
      if (d.kind === "splitter") { ctx.fillStyle = "#000"; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(d.x + (k ? dr2 * 0.35 : -dr2 * 0.35), d.y, dr2 * 0.28, 0, TAU); ctx.fill(); } }  // cell-division look
      if (d.kind === "regen") { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x - dr2 * 0.45, d.y); ctx.lineTo(d.x + dr2 * 0.45, d.y); ctx.moveTo(d.x, d.y - dr2 * 0.45); ctx.lineTo(d.x, d.y + dr2 * 0.45); ctx.stroke(); }  // + cross
      if (d.kind === "orbiter") { ctx.fillStyle = "#fff"; const sc = d.sat || 3; for (let k = 0; k < sc; k++) { const a = d.spin * 2 + k / sc * TAU, rr = d.r + 9; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 2.4, 0, TAU); ctx.fill(); } }  // orbiting satellites
      if (d.kind === "pulsar") { ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4, 0, TAU); ctx.stroke(); }
      if (d.phase !== undefined) { ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5, d.spin, d.spin + TAU); ctx.stroke(); ctx.setLineDash([]); }  // phantom dashed ring
      if (d.shield > 0) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2.5; ctx.globalAlpha = clamp(d.shield / d.shieldMax, 0.25, 1); ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5, -0.9, 0.9); ctx.stroke(); ctx.globalAlpha = 1; }  // front shield arc
      if (d.refl > 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8, 0, TAU); ctx.stroke(); }  // reflect flash
      // --- planet-native race visuals ---
      if (d.grow !== undefined) { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.55, 0, TAU); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3 + Math.sin(d.grow * 2) * 2, 0, TAU); ctx.stroke(); }   // Hearth bloat
      if (d.healAura !== undefined) { ctx.globalAlpha = 0.18 + 0.18 * Math.sin(d.healAura * 9); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, 62, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(d.x - dr2 * 0.5, d.y); ctx.lineTo(d.x + dr2 * 0.5, d.y); ctx.moveTo(d.x, d.y - dr2 * 0.5); ctx.lineTo(d.x, d.y + dr2 * 0.5); ctx.stroke(); }   // Verdant mender (+ halo)
      if (d.flock) { const a = Math.atan2(d.vy, d.vx); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * dr2 * 0.9, d.y + Math.sin(a) * dr2 * 0.9); ctx.lineTo(d.x + Math.cos(a + 2.5) * dr2 * 0.6, d.y + Math.sin(a + 2.5) * dr2 * 0.6); ctx.lineTo(d.x + Math.cos(a - 2.5) * dr2 * 0.6, d.y + Math.sin(a - 2.5) * dr2 * 0.6); ctx.closePath(); ctx.fill(); }   // Mistral chevron
      if (d.cloak !== undefined) { ctx.strokeStyle = "rgba(255,255,255," + (d.cloaked ? 0.25 : 0.6) + ")"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4, d.spin, d.spin + TAU); ctx.stroke(); ctx.setLineDash([]); }   // Halcyon shimmer
      if (d.armorUp !== undefined) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = d.spin * 0.3 + k / 6 * TAU, rr = dr2 + 3, px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }   // Frost hex armor
      if (d.deflect) { ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = d.spin + k / 4 * TAU, rr = dr2 + 4, px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }   // Onyx mirror facets
      if (d.bomb) { const fl = 0.5 + 0.5 * Math.sin(d.spin * 7); ctx.fillStyle = "rgba(255,255,255," + (0.4 + fl * 0.6) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.4, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }   // Pyreling fuse
      if (d.gravity) { ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const rr = dr2 + 6 + k * 5, a0 = d.spin * 1.6 + k * 2; ctx.beginPath(); ctx.arc(d.x, d.y, rr, a0, a0 + 3.4); ctx.stroke(); } ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.5, 0, TAU); ctx.fill(); }   // Abyss accretion swirl
      if (d.leech) { const op = 0.25 + 0.3 * Math.abs(Math.sin(d.spin * 4)); ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.7, op, Math.PI - op); ctx.stroke(); ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.7, Math.PI + op, TAU - op); ctx.stroke(); }   // Devourer maw
      if (d.spawner !== undefined) { ctx.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { const a = d.spin * 1.5 + k / 4 * TAU, rr = dr2 * 0.55; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, dr2 * 0.22, 0, TAU); ctx.fill(); } ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.3, 0, TAU); ctx.fill(); }   // Null Spawn brood-core
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
      // every defender shows its targeting radius — faint by default, highlighted when selected
      { const sel = i === selUnit; ctx.strokeStyle = sel ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.07)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, uRange(u), 0, TAU); ctx.stroke(); }
      // --- build-reflecting visuals (strictly black & white, no idle motion): barrels = fire rate
      //     (+multishot), length = range, thickness/body size = damage, silhouette = class ---
      const barrels = clamp(Math.max(1 + Math.floor(Math.log(Math.max(c.rate, 1)) / Math.log(2.2)), 1 + (c.multi || 0)), 1, 6);
      const blen = 13 + Math.min(uRange(u) - DEF_TYPES[u.type].range, 260) * 0.04;
      const bw = 2.6 + Math.min(Math.log10(c.dmg + 1) * 1.7, 6.5);
      const bodyR = (u.type === "turret" ? 11 : 9) + Math.min(Math.log10(c.dmg + 1) * 1.4, 6);
      const aim = u.aim != null ? u.aim : -Math.PI / 2;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(aim); ctx.lineCap = "round";
      for (let b = 0; b < barrels; b++) {
        const off = (b - (barrels - 1) / 2) * (bw + 2.4);
        ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = bw + 1.6; ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
        ctx.strokeStyle = "#e6e6e6"; ctx.lineWidth = Math.max(1, bw * 0.5); ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
        if (u.flash > 0) { const a = u.flash / 0.08; ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.beginPath(); ctx.arc(blen + 1, off, bw * 0.55 + 2 * a, 0, TAU); ctx.fill(); }   // brief white muzzle flash only while firing
      }
      // RANGE branch (Scope · Range Finder · Laser Sight · Long Barrel): a faint sight line creeps past the muzzle, one notch longer per range node
      if (c.n.range > 0) { const sl = Math.min(5 + c.n.range * 3.5, 40); ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(blen + 2, 0); ctx.lineTo(blen + 2 + sl, 0); ctx.stroke(); }
      ctx.restore();
      // --- body (size = damage) · distinct per-class silhouette: turret circle · mortar hex · plasma diamond · laser triangle · railgun square ---
      const shp = { mortar: [6, 0], plasma: [4, Math.PI / 4], laser: [3, -Math.PI / 2], railgun: [4, 0] }[u.type];
      const body = r => { if (!shp) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); } else { ctx.beginPath(); for (let k = 0; k < shp[0]; k++) { const a = shp[1] + k / shp[0] * TAU, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); } };
      ctx.fillStyle = "#222"; body(bodyR + 3.5);
      ctx.fillStyle = uColor(u); body(bodyR);
      // DAMAGE branch (Reinforced Rounds · Tungsten Core · Heavy Slugs · Armor Piercing): reinforcement rivets stud the body, one per damage node
      { const nD = Math.min(c.n.dmg, 9); for (let k = 0; k < nD; k++) { const a = -Math.PI / 2 + k / Math.max(nD, 1) * TAU; ctx.fillStyle = "rgba(0,0,0,0.34)"; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * bodyR * 0.6, p.y + Math.sin(a) * bodyR * 0.6, 1.1, 0, TAU); ctx.fill(); } }
      if (uCrit(u) > 0.2) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.arc(p.x - bodyR * 0.3, p.y - bodyR * 0.3, Math.min(uCrit(u) * 3.5, 3), 0, TAU); ctx.fill(); }   // crit = small dark inset on the body (reads on bright units)
      const iq = Math.min(1, uInt(u));   // Mind = a faint STATIC concentric ring, brighter the smarter — no motion, no colour
      if (iq > 0.05) { ctx.strokeStyle = "rgba(255,255,255," + (0.1 + 0.35 * iq) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, bodyR + 5, 0, TAU); ctx.stroke();
        // MIND branch (Targeting Chip · Threat Sense · Squad Link): sensor ticks notch the ring, one per mind node
        const nM = Math.min(c.n.int, 10); for (let k = 0; k < nM; k++) { const a = -Math.PI / 2 + k / Math.max(nM, 1) * TAU; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * (bodyR + 3.5), p.y + Math.sin(a) * (bodyR + 3.5)); ctx.lineTo(p.x + Math.cos(a) * (bodyR + 6.5), p.y + Math.sin(a) * (bodyR + 6.5)); ctx.stroke(); } }
      if (c.multi) { for (let k = 0; k < c.multi; k++) { const a = -Math.PI / 2 + (k - (c.multi - 1) / 2) * 0.46; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * (bodyR + 8.5), p.y + Math.sin(a) * (bodyR + 8.5), 1.5, 0, TAU); ctx.fill(); } }   // static white pips = keystones (multishot/spec level)
      ctx.fillStyle = "#000"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(DEF_TYPES[u.type].name[0], p.x, p.y + 1);
      const tot = allocCount(u.type); if (tot) { ctx.fillStyle = "#fff"; ctx.font = "9px ui-monospace,monospace"; ctx.fillText("" + tot, p.x, p.y - bodyR - 11); }
    }
    ctx.textBaseline = "alphabetic";
    for (const dr of drones) {
      const mode = COL_TYPES[dr.type].mode, sr = cSuction(dr.type);
      // collectors reflect their build too (all monochrome): outer ring = pull radius (Suction),
      // inner ring = grab zone (Reach), maw size = Process/Ingest, trail length = Speed.
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, sr, 0, TAU); ctx.stroke();
      if (mode !== "hole") { const reach = cCollect(dr.type); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, reach, 0, TAU); ctx.stroke(); }   // grab-distance ring (Reach)
      const sp = Math.hypot(dr.vx || 0, dr.vy || 0);
      if (mode !== "hole" && sp > 25) { const tl = Math.min(sp * 0.06, 22), ux2 = (dr.vx || 0) / (sp || 1), uy2 = (dr.vy || 0) / (sp || 1); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dr.x - ux2 * tl, dr.y - uy2 * tl); ctx.lineTo(dr.x, dr.y); ctx.stroke(); }   // speed trail — length scales with Speed
      const cs = (1 + Math.min(Math.log10(cIngest(dr.type)) * 0.5, 1.4)) * (1 + Math.max(0, dr.pop || 0) * 1.6);   // Process -> bigger maw; chomp-pop when banking big loot
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
        // PROCESS/INGEST branch (Quick Gulp · Maw Servo · Devourer): maw teeth, one per Ingest node
        const nI = Math.min(cls(dr.type).n.ingest, 8); ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1; for (let k = 0; k < nI; k++) { const a = k / nI * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (trail.length) { ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 16; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); for (let i = 0; i < trail.length; i++) { const tp = trail[i]; i ? ctx.lineTo(tp.x, tp.y) : ctx.moveTo(tp.x, tp.y); } ctx.stroke(); }
    drawParts();
    ctx.restore();
    if (flash > 0) { ctx.fillStyle = "rgba(255,255,255," + Math.min(0.55, flash * 0.6) + ")"; ctx.fillRect(0, 0, SW, SH); }
  }

  /* ----------------------------- HUD ----------------------------- */
  function syncHUD() {
    let bg = 0; for (const k in S.vault) { if (+k === S.galaxy) continue; const v = S.vault[k]; if (v.conquered) bg += v.bgRate || 0; }
    $("ui-cash").textContent = curSym(S.galaxy) + " " + fmt(S.cash); $("ui-cap").textContent = " " + curName(S.galaxy) + (bg > 0 ? "  ·  +" + fmt(bg) + "/s idle" : "");
    $("ui-cash").classList.toggle("capped", S.cash >= derived.capacity * 0.999);   // pulse when at the currency ceiling
    $("ui-galaxy").textContent = S.galaxy; $("ui-gname").textContent = galName(S.galaxy) + " · " + sysName(S.galaxy);
    const tgt = conquerTarget(S.galaxy), conq = planetMeta(S.galaxy).conquered;
    $("galaxy-fill").style.width = clamp(conq ? 1 : curEarned / tgt, 0, 1) * 100 + "%";
    const last = S.galaxy >= TOTAL_PLANETS;
    let label, dis = true, ready = false, enroute = false;
    if (S.travel) { enroute = true; if (S.free) { label = "▸▸ SKIP JOURNEY (" + fmtTime(Math.max(0, S.travel.dur - S.travel.t)) + ")"; dis = false; } else { label = "EN ROUTE … " + fmtTime(Math.max(0, S.travel.dur - S.travel.t)); } }
    else if (conq || S.free) {
      if (last) { label = "★ FINAL WORLD"; }
      else { const cost = travelCost(); ready = true; dis = !(S.free || S.cash >= cost); label = "LAUNCH ⟶ " + (S.free ? "FREE" : curSym(S.galaxy) + " " + fmt(cost)); }
    } else { label = "CONQUER " + Math.floor(clamp(curEarned / tgt, 0, 1) * 100) + "%"; }
    const bt = $("btn-travel");
    if (bt.textContent !== label) bt.textContent = label;   // write only on change — no per-frame repaint flicker
    if (bt.disabled !== dis) bt.disabled = dis;
    bt.classList.toggle("ready", ready); bt.classList.toggle("enroute", enroute);
    for (const k in ABIL_CD) { $("ab-" + k).disabled = abil[k] > 0; $("cd-" + k).style.width = abil[k] > 0 ? (abil[k] / ABIL_CD[k] * 100) + "%" : "0"; $("s-" + k).textContent = abil[k] > 0 ? Math.ceil(abil[k]) + "s" : ""; }
    for (const id in listRows) {
      const row = listRows[id];
      if (row.kind === "unit") {
        const d = TY(id), locked = !S.free && S.peakGalaxy < d.gal, c = unitBuyCost(id), n = countType(id), full = n >= d.max;
        row.desc.textContent = n + "/" + d.max + (locked ? "" : " · " + d.name);
        if (locked) { row.buy.textContent = "🔒 G" + d.gal; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.remove("maxed"); }
        else if (full) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.add("maxed"); }
        else { row.buy.textContent = S.free ? "FREE" : curSym(S.galaxy) + " " + fmt(c); row.buy.disabled = !S.free && S.cash < c; row.buy.classList.toggle("afford", S.free || S.cash >= c); row.el.classList.remove("maxed"); }
      } else {
        const u = UP[id], lvl = S.lv[id], maxed = u.max != null && lvl >= u.max;
        row.lv.textContent = "Lv " + lvl; row.desc.textContent = u.desc(lvl);
        if (maxed) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.el.classList.add("maxed"); row.buy.classList.remove("afford"); }
        else { const c = upCost(u); row.buy.textContent = S.free ? "FREE" : curSym(S.galaxy) + " " + fmt(c); row.buy.disabled = !S.free && S.cash < c; row.buy.classList.toggle("afford", S.free || S.cash >= c); row.el.classList.remove("maxed"); }
      }
    }
    // tab badges
    const aff = { def: false, drone: false, eco: false };
    for (const t of DEF_ORDER) if (S.free || (S.peakGalaxy >= DEF_TYPES[t].gal && S.cash >= unitBuyCost(t))) aff.def = true;
    for (const t of COL_ORDER) if (S.free || (S.peakGalaxy >= COL_TYPES[t].gal && S.cash >= unitBuyCost(t))) aff.drone = true;
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
    if (!S.free && S.peakGalaxy < TY(type).gal) return;   // unlocked once you've REACHED its planet (permanent); free mode ignores it
    let bought = 0;
    for (let i = 0; i < buyN(); i++) {
      if (countType(type) >= TY(type).max) break;
      const c = unitBuyCost(type); if (!S.free && S.cash < c) break;
      if (!S.free) S.cash -= c; list.push(isCol(type) ? { type } : newUnit(type)); bought++;
    }
    if (!bought) return;
    if (isCol(type)) syncCollectors();
    Audio_buy(); renderList(); save();
  }
  function buyUpgrade(u) {
    let bought = 0;
    for (let i = 0; i < buyN(); i++) {
      const lvl = S.lv[u.id]; if (u.max != null && lvl >= u.max) break;
      const c = upCost(u); if (!S.free && S.cash < c) break;
      if (!S.free) S.cash -= c; S.lv[u.id]++; bought++;
    }
    if (!bought) return;
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
    const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, x: 0 }; let keyN = 0;
    const setSpec = () => { if (CLASS_SPEC[type]) nodes[nodes.length - 1].spec = CLASS_SPEC[type]; };   // defenders only; call right after an add("K",…)
    const stats = [1, 2, 3, 4], NP = stats.length;   // 4 primaries: defenders = dmg/rate/range/Mind, collectors = speed/pull/reach/Capacity
    for (let i = NP - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [stats[i], stats[j]] = [stats[j], stats[i]]; }
    const deep = { turret: 0, mortar: 0, plasma: 1, laser: 1, railgun: 2 }[type] || 0;   // later classes get deeper trees
    const col = isCol(type);
    const nW = ri(5, 7) + deep, rot = R() * Math.PI * 2;     // far more wings — bigger trees
    // COLLECTORS ONLY: one whole wing is dedicated to Process/consumption (the x-branch),
    // a single coherent section you path into and invest as a block, instead of process
    // being dotted around as a little sub-arm hanging off every wing. Defender trees are
    // untouched — their Crit (x) still weaves throughout exactly as before.
    const procW = col ? nW - 1 : -1;
    const keySlots = (s1, s2) => s1 === s2 ? [{ p: s1, mag: "key" }] : [{ p: s1, mag: "key" }, { p: s2, mag: "key" }];
    for (let w = 0; w < nW; w++) {
      const th = rot + w * (Math.PI * 2 / nW), ux = Math.cos(th), uy = Math.sin(th), px = Math.cos(th + Math.PI / 2), py = Math.sin(th + Math.PI / 2);
      const isProc = w === procW;     // the dedicated Process section (collectors only)
      const wid = "w" + w, stat = isProc ? "x" : stats[w % NP], stat2 = isProc ? "x" : stats[(w + 1) % NP];
      const step = 0.66 + R() * 0.16, dx = 0.62 + R() * 0.3, arm = ri(4, 6) + deep, loop = R() < 0.55;   // longer arms — far more nodes per wing (deeper for later classes)
      const add = (k, r, s, kind, slots) => { const ns = kind === "key" ? "key" : slots[0].p, ni = kind === "key" ? keyN++ : cnt[ns]++; nodes.push({ id: wid + k, x: ux * r + px * s, y: uy * r + py * s, kind, slots, wing: w, nameSlot: ns, ni }); };
      const e = (a, b) => edges.push([wid + a, wid + b]);
      add("E", 0.95, 0, "minor", [{ p: stat, mag: "min" }]); edges.push(["start", wid + "E"]);
      // Defenders weave Crit (x) throughout via a small sub-arm off each entry node;
      // collectors don't — their Process lives in the dedicated wing above.
      if (!col) { const xn = ri(1, 2), side = w % 2 ? 1 : -1; for (let t = 1; t <= xn; t++) { add("Y" + t, 0.95 + step * (t + 0.25), side * (1.5 + 0.3 * t), t === xn ? "major" : "minor", [{ p: "x", mag: t === xn ? "maj" : "min" }]); e(t === 1 ? "E" : "Y" + (t - 1), "Y" + t); } }
      if (loop) {
        let pL = "E", pR = "E";
        for (let t = 1; t <= arm; t++) {
          const r = 0.95 + step * t, last = t === arm;
          add("L" + t, r, -dx * (0.7 + 0.1 * t), last ? "major" : "minor", [{ p: stat, mag: last ? "maj" : "min" }]);
          add("R" + t, r, dx * (0.7 + 0.1 * t), last ? "major" : "minor", [{ p: stat2, mag: last ? "maj" : "min" }]);
          e(pL, "L" + t); e(pR, "R" + t); pL = "L" + t; pR = "R" + t;
        }
        const kr = 0.95 + step * (arm + 1.1);
        add("K", kr, 0, "key", keySlots(stat, stat2)); setSpec(w); e("L" + arm, "K"); e("R" + arm, "K");
        add("S", kr + 0.85, 0, "major", [{ p: col ? stat : "x", mag: "maj" }]); e("K", "S");
        if (R() < 0.6) e("L1", "R1"); // rung
      } else {
        let prev = "E";
        for (let t = 1; t <= arm; t++) {
          const r = 0.95 + step * t, last = t === arm;
          add("C" + t, r, (R() - 0.5) * 0.5, last ? "major" : "minor", [{ p: stat, mag: last ? "maj" : "min" }]);
          e(prev, "C" + t); prev = "C" + t;
          if (R() < 0.5) { add("P" + t, r + 0.15, (R() < 0.5 ? -1 : 1) * (0.8 + 0.12 * t), "minor", [{ p: stat2, mag: "min" }]); e("C" + t, "P" + t); }
        }
        if (R() < 0.7) { const kr = 0.95 + step * (arm + 1); add("K", kr, 0, "key", keySlots(stat, isProc ? "x" : stats[(w + 2) % NP])); setSpec(w); e("C" + arm, "K"); }
        else { add("X", 0.95 + step * (arm + 1), 0, "major", [{ p: col ? stat : "x", mag: "maj" }]); e("C" + arm, "X"); }
      }
    }
    for (let w = 0; w < nW; w++) if (R() < 0.7) edges.push(["w" + w + "E", "w" + ((w + 1) % nW) + "E"]); // inner ring weave
    const map = {}, adj = {}; nodes.forEach(n => { map[n.id] = n; adj[n.id] = []; });
    const eds = edges.filter(([a, b]) => map[a] && map[b]);
    eds.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    _trees[type] = { nodes, edges: eds, map, adj };
    return _trees[type];
  }
  const STAT_LBL = { dmg: "dmg", rate: "rate", range: "rng", crit: "crit", int: "mind", speed: "spd", suction: "pull", collect: "reach", capacity: "capacity", ingest: "process" };
  function slotText(type, s) {
    const col = isCol(type), amt = slotAmt(type, s);
    if (s.p === "x") return "+" + Math.round(amt * 100) + "% " + (col ? "process" : "crit");
    const key = (col ? COL_PRIM : DEF_PRIM)[s.p - 1];
    return key === "range" || key === "collect" ? "+" + amt + " " + STAT_LBL[key] : "+" + Math.round(amt * 100) + "% " + STAT_LBL[key];
  }
  const nodeFx = (type, n) => { let s = (n.slots || []).map(sl => slotText(type, sl)).join(" · "); if (n.spec) s += (s ? " · " : "") + "✦ " + SPEC_NAME[n.spec]; return s; };
  // Plain-language glossary for every stat a tree node can grant — surfaced by an
  // ⓘ button in the node panel so you always know what a boost actually does.
  const STAT_TITLE = { dmg: "Damage", rate: "Fire Rate", range: "Range", crit: "Crit", int: "Mind", multi: "Multishot", speed: "Speed", suction: "Pull", collect: "Reach", capacity: "Capacity", ingest: "Process", explosive: "✦ Explosive Rounds", chain: "✦ Chain Lightning", pierce: "✦ Piercing Laser" };
  const STAT_INFO = {
    explosive: "✦ SPECIALIZATION — every shot DETONATES, dealing its full damage to all dots in a blast radius (turns the unit into a bomb tower). Each Explosive keystone makes the blast bigger.",
    chain: "✦ SPECIALIZATION — every shot ARCS like lightning from the dot it hits to nearby dots, jumping one extra time per keystone (damage fades a little each jump). Shreds clusters.",
    pierce: "✦ SPECIALIZATION — every shot becomes a LASER LANCE that punches through and hits every dot in a straight line, not just the target. More keystones = a wider beam.",
    dmg: "Damage per shot. Kills come faster, and since kills ARE your income, raw damage is your economy.",
    rate: "Fire rate (shots/sec). High enough and a unit machine-guns, firing several shots per frame.",
    range: "Targeting range (flat bonus). Wider range keeps more dots in reach, so units idle less.",
    crit: "Crit chance. A critical shot deals ~2.2× damage and pops a little extra.",
    int: "Mind — combat intelligence & coordination. A smart unit reads the field: it won't waste a bolt on a dot another shot is already guaranteed to kill (overkill avoidance), it coordinates with the rest of your rack so two units don't both fire on the same doomed dot, and it triages — putting shots on the highest-value targets it can finish. Higher Mind = fewer wasted shots = more effective DPS and income.",
    multi: "Multishot. Each keystone lets EVERY unit of this class fire at one extra dot at the same time.",
    speed: "Movement speed — how fast this collector chases orbs. Capped so it stays agile instead of flying straight past loot.",
    suction: "Pull radius — how far it drags orbs in toward itself. Capped below the field, so it must keep roaming; it never becomes a stationary field-wide magnet.",
    collect: "Reach — how close a collector must get to an orb before it grabs and starts consuming it. More reach = it snags loot from a little further out, so less precise chasing. Collectors carry NO cash multiplier — income lives in the Economy tab.",
    capacity: "Capacity — how many loot orbs this collector can PROCESS at the same time (its parallel maw bays). With low capacity a collector consumes orbs one or two at a time and a dense pile backs up (and orbs can expire before it gets to them); high capacity lets it chew through a whole cluster at once. Matters most after big multi-kills, Dot Rain, and Black Hole pulls — exactly when loot piles up faster than a single bay can clear it. (Separate from the Economy tab's Capacity, which is your cash ceiling.)",
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
  const STAT_ICON = { dmg: "✸", rate: "»", range: "◎", crit: "✶", int: "◈", speed: "➤", suction: "◉", yield: "❖", collect: "▣", capacity: "▦", ingest: "⊛" };
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
    const pool = n.nameSlot === "x" ? skillNames(type).x : skillNames(type)[["", "a", "b", "c", "d"][n.nameSlot]];
    return (pool && pool[n.ni % pool.length]) || nodeFx(type, n);
  }
  function statLine(tp) {
    const s = { type: tp };
    return isCol(tp)
      ? "<b>" + Math.round(cSpeed(tp)) + "</b> spd · <b>" + Math.round(cSuction(tp)) + "</b> pull · <b>" + Math.round(cCollect(tp)) + "</b> reach · <b>" + cCapacity(tp) + "</b> bays · <b>×" + cIngest(tp).toFixed(2) + "</b> process"
      : "<b>" + fmt(uDmg(s)) + "</b> dmg · <b>" + uRate(s).toFixed(1) + "</b>/s · <b>" + Math.round(uRange(s)) + "</b> rng" + (uSplash(s) ? " · splash" : "") + (uCrit(s) ? " · " + Math.round(uCrit(s) * 100) + "% crit" : "") + (uMulti(s) ? " · <b>×" + (1 + uMulti(s)) + "</b> targets" : "") + (uInt(s) ? " · <b>" + Math.round(Math.min(1, uInt(s)) * 100) + "%</b> mind" : "") + (uExplode(s) ? " · <b>✦bombs</b>" : "") + (uChain(s) ? " · <b>✦chain</b>" : "") + (uPierce(s) ? " · <b>✦laser</b>" : "");
  }
  // allocation: a node is allocatable if a connected node is already allocated.
  const nodeAllocated = (type, id) => id === "start" || !!(S.classNodes[type] && S.classNodes[type][id]);
  const nodeAllocatable = (type, n) => !nodeAllocated(type, n.id) && (buildTree(type).adj[n.id] || []).some(a => nodeAllocated(type, a));
  function nodeCost(type, n) { const k = n.kind === "key" ? 20 : n.kind === "major" ? 5 : 1; return Math.ceil(eco(S.galaxy) * 1.5 * BUY_MUL * Math.pow(1.33, allocCount(type)) * k); }   // planet-local: ~5× slower; cheap early, STEEP growth (the in-planet grind)
  function allocNode(type, n) {
    if (!n || !nodeAllocatable(type, n)) return; const c = nodeCost(type, n); if (!S.free && S.cash < c) return;
    if (!S.free) S.cash -= c; (S.classNodes[type] || (S.classNodes[type] = {}))[n.id] = true; recompute(); syncHUD(); save();
  }
  function allocAll(type) {   // test-mode: instantly allocate the WHOLE tree (skips cost/affordability — free sandbox only)
    if (!S.free) return;
    const G = buildTree(type), set = S.classNodes[type] || (S.classNodes[type] = {});
    let guard = 0;
    for (;;) { const next = G.nodes.find(n => n.kind !== "start" && nodeAllocatable(type, n)); if (!next || guard++ > 5000) break; set[next.id] = true; }
    recompute(); syncHUD(); save();
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
    const has = nodeAllocated(type, n.id), can = nodeAllocatable(type, n), cost = nodeCost(type, n), afford = S.free || S.cash >= cost, fx = nodeFx(type, n);
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
    else if (can) { const p = nodePreview(type, n); $("si-prev").innerHTML = "Now: " + p.before + "<br>After: <span class='si-after'>" + p.after + "</span>"; btn.textContent = S.free ? "ALLOCATE · FREE" : "ALLOCATE · " + curSym(S.galaxy) + " " + fmt(cost); btn.disabled = !afford; }
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
  function openSkillTree(type) { selType = type; $("skilltree").classList.add("show"); STree.open(type); if ($("st-max")) $("st-max").style.display = S.free ? "" : "none"; }
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
    const current = g === S.galaxy, reached = g <= S.peakGalaxy && !current, next = g === S.galaxy + 1;
    const conqHere = planetMeta(S.galaxy).conquered || S.free;
    const weps = ALL_TYPES.filter(t => TY(t).gal === g).map(t => TY(t).name);
    const action = current ? "<span class='gi-tag'>▶ You are here</span> <button id='gi-visit'>⊙ Zoom to base ▸</button>"
      : reached ? "<button id='gi-jump'>⊙ Visit ▸</button>"   // dive into & play your save on this visited world
      : next ? (conqHere ? "<button id='gi-travel'>Travel here ▸ (fresh start)</button>" : "<span class='gi-tag'>🔒 Conquer " + galName(S.galaxy) + " first</span>")
      : "<span class='gi-tag'>🔒 Locked</span>";
    const localN = PLANET_LOCAL[planetIdx(g)] + 1, sysSize = SYSTEMS[PLANET_SYS[planetIdx(g)]].planets, race = raceAt(g), pv = S.vault[g];
    // per-planet progression: currency bank, idle rate, build, conquer status
    const bank = current ? S.cash : (pv ? pv.cash || 0 : 0);
    const nDef = current ? S.units.length : (pv && pv.units ? pv.units.length : 0);
    const nCol = current ? S.collectors.length : (pv && pv.collectors ? pv.collectors.length : 0);
    const nNodes = (() => { const cn = current ? S.classNodes : (pv ? pv.classNodes : null); let n = 0; if (cn) for (const k in cn) n += Object.keys(cn[k] || {}).length; return n; })();
    const prog = current ? (planetMeta(g).conquered ? "✓ conquered" : Math.floor(clamp(curEarned / conquerTarget(g), 0, 1) * 100) + "% to conquer")
      : (pv && pv.conquered ? "✓ conquered" : (reached ? "visited — not conquered" : "unexplored"));
    const stats = "<div class='gi-unlock'>" + curSym(g) + " <b>" + curName(g) + "</b> · bank " + fmt(bank) +
      (pv && pv.conquered ? " · <b>+" + fmt(pv.bgRate || 0) + "/s</b> idle" : "") +
      (nDef + nCol > 0 ? " · build " + nDef + "⚔ " + nCol + "✦ " + nNodes + "◆" : "") +
      "<br>" + prog + "</div>";
    $("gm-info").innerHTML = "<div class='gi-name'>" + galName(g) + "</div>" +
      "<div class='gi-desc'>" + sysName(g) + " system · planet " + localN + "/" + sysSize + " · world " + g + "/" + TOTAL_PLANETS + "<br>" + galDesc(g) + "</div>" +
      stats +
      "<div class='gi-unlock'>☣ Native race: <b>" + race.name + "</b> — " + RACE_FX[race.key] + "</div>" +
      (weps.length ? "<div class='gi-unlock'>Unlocks: " + weps.join(", ") + "</div>" : "") + "<div class='gi-act'>" + action + "</div>";
    $("gm-info").classList.add("show");
    const t = $("gi-travel"); if (t) t.onclick = () => { travel(); $("gm-info").classList.remove("show"); };
    const j = $("gi-jump"); if (j) j.onclick = () => { $("gm-info").classList.remove("show"); GMap.flyInto(g, () => { jumpTo(g); $("galaxy-map").classList.remove("show"); GMap.hide(); }); };
    const vc = $("gi-visit"); if (vc) vc.onclick = () => { $("gm-info").classList.remove("show"); GMap.flyInto(g, () => { $("galaxy-map").classList.remove("show"); GMap.hide(); }); };   // already here → just dive to the base
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
    spawnRate: "More dots per second — and if you're clearing them fast, you just get MORE to kill. Only when the field actually fills up (you can't keep up) does extra Spawn Rate convert into 'menace' instead: every dot spawns tougher and worth far more. So fast killing is rewarded with sheer volume, and the upgrade still pays off as toughness when the screen is packed.",
    luck: "Chance for rare SPECIAL dots worth about 9× normal cash. A slow +0.1% per level.",
    frenzy: "All defenders fire ~5× faster for 6 seconds. Cooldown 45s — save it for dense screens.",
    dotrain: "Instantly floods the field with extra dots to pop. Cooldown 40s.",
    blackhole: "Drags every dot to the centre and crushes them over 5s. Cooldown 60s.",
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
        row("Planet", S.galaxy + " · " + galName(S.galaxy) + " (" + sysName(S.galaxy) + ")") + row("Peak planet", S.peakGalaxy) +
        row("Travels", s.travels))) +
      sec("Economy", grid(
        row("Cash / sec", curSym(S.galaxy) + " " + fmt(cps)) + row("Capacity", curSym(S.galaxy) + " " + fmt(derived.capacity)) +
        row("Earned this run", curSym(S.galaxy) + " " + fmt(S.totalRun)) + row("Earned all-time", curSym(S.galaxy) + " " + fmt(META.totalEver)) +
        row("Skill nodes", nodes) +
        row("Cash lost (uncollected)", curSym(S.galaxy) + " " + fmt(s.lostCash || 0)))) +
      sec("Combat", grid(
        row("Dots popped", fmt(s.dotsPopped)) + row("Special dots", fmt(s.specials)) + row("Armored killed", fmt(s.armored || 0)) +
        row("On screen now", dots.length) + row("Avg pops / min", s.playSec > 1 ? fmt(Math.round(s.dotsPopped / s.playSec * 60)) : "0"))) +
      sec("Destroyed by", ke.length ? ke.map(e => bar(e.label, fmt(e.n) + " · " + Math.round(e.n / tk * 100) + "%", e.n / tk * 100)).join("") : empty("No kills yet")) +
      sec("Cash collected by", ce.length ? ce.map(e => bar(e.label, curSym(S.galaxy) + " " + fmt(e.v) + " · " + Math.round(e.v / tc * 100) + "%", e.v / tc * 100)).join("") : empty("Nothing collected yet")) +
      sec("Abilities used", grid(row("⚡ Frenzy", s.abilities.frenzy) + row("▽ Dot Rain", s.abilities.dotrain) + row("◉ Black Hole", s.abilities.blackhole))) +
      sec("Fleet", empty("<b style='color:#fff'>Defenders:</b> " + defFleet) + empty("<b style='color:#fff'>Collectors:</b> " + colFleet));
  }
  // interactive pseudo-3D black & white star map
  const GMap = {
    open: false, yaw: 0.45, pitch: -0.72, zoom: 0.7, t: 0, cv: null, c: null, w: 0, h: 0,
    cx: 0, cz: 0, tcx: 0, tcz: 0, _orb: null,   // camera focus (world XZ) + smooth-lerp target
    reset() { this.yaw = 0.45; this.pitch = -0.72; this.zoom = 0.7; this.focusSystem(PLANET_SYS[planetIdx(S.galaxy)], true); },
    ptrs: new Map(), lx: 0, ly: 0, sx0: 0, sy0: 0, moved: false, pinchD: 0, midX: null, midY: 0, rotMode: false, hit: [], stars: [], sel: 0,
    init() {
      this.cv = $("gmap"); if (!this.cv) return; this.c = this.cv.getContext("2d");
      this.cv.addEventListener("contextmenu", e => e.preventDefault());
      this.cv.addEventListener("pointerdown", e => {
        if (this.flight) return;                              // ignore input mid-dive
        try { this.cv.setPointerCapture(e.pointerId); } catch (_) {}
        const p = this.pt(e); this.ptrs.set(e.pointerId, p); this.moved = false;
        this.lx = p.x; this.ly = p.y; this.sx0 = p.x; this.sy0 = p.y;
        this.rotMode = e.shiftKey || e.button === 2;   // desktop: shift / right-drag to ROTATE instead of move
        if (this.ptrs.size === 2) { const a = [...this.ptrs.values()]; this.pinchD = this.d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); this.midX = this.m0x = (a[0].x + a[1].x) / 2; this.midY = this.m0y = (a[0].y + a[1].y) / 2; this.gMode = null; }
      });
      this.cv.addEventListener("pointermove", e => {
        if (this.flight || !this.ptrs.has(e.pointerId)) return; const p = this.pt(e); this.ptrs.set(e.pointerId, p);
        if (this.ptrs.size >= 2) {   // TWO fingers: pinch = zoom, deliberate drag = rotate. Intent is locked against the gesture
          // START (a pure drag keeps the spread ~constant while the midpoint travels), after a small deadzone — so the
          // per-finger event wobble can never make a pinch tumble the camera or a drag snap the zoom.
          const a = [...this.ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
          if (!this.gMode) { const spread = Math.abs(d - this.d0), mid = Math.hypot(mx - this.m0x, my - this.m0y); if (spread > 14 || mid > 14) this.gMode = spread > mid ? "zoom" : "rot"; }
          if (this.gMode === "zoom" && this.pinchD) this.zoomBy(d / this.pinchD);
          else if (this.gMode === "rot" && this.midX != null) this.rotate(mx - this.midX, my - this.midY);
          this.pinchD = d; this.midX = mx; this.midY = my; this.moved = true; return;
        }
        const dx = p.x - this.lx, dy = p.y - this.ly;
        if (Math.hypot(p.x - this.sx0, p.y - this.sy0) > 9) this.moved = true;
        if (this.rotMode) this.rotate(dx, dy);   // shift / right-drag rotates (desktop)
        else this.pan(dx, dy);                    // ONE finger: move
        this.lx = p.x; this.ly = p.y;
      });
      const up = e => {
        const had = this.ptrs.size; this.ptrs.delete(e.pointerId); this.pinchD = 0; this.midX = null; this.gMode = null;
        if (this.ptrs.size === 1) { const r = [...this.ptrs.values()][0]; this.lx = r.x; this.ly = r.y; this.sx0 = r.x; this.sy0 = r.y; this.moved = true; }   // a finger lifting from a 2-finger gesture must NOT become a tap or a jump
        if (had === 1 && !this.moved) { const p = this.pt(e); this.tap(p.x, p.y); }
      };
      this.cv.addEventListener("pointerup", up); this.cv.addEventListener("pointercancel", e => { this.ptrs.delete(e.pointerId); this.pinchD = 0; this.midX = null; this.gMode = null; });
      this.cv.addEventListener("wheel", e => { e.preventDefault(); this.zoomBy(1 - e.deltaY * 0.0015); }, { passive: false });
    },
    pt(e) { const r = this.cv.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; },
    show() { this.open = true; this.flight = null; this.resize(); if (!this.stars.length) for (let i = 0; i < 160; i++) this.stars.push({ x: Math.random(), y: Math.random(), r: rnd(0.4, 1.6) }); this.focusSystem(PLANET_SYS[planetIdx(S.galaxy)], true); $("gm-info").classList.remove("show");
      this.intro = 0; this.introDur = 1.25; this.iz0 = 3.2; this.zoom = 3.2; this._warp = 1.7; Sfx.swoosh(1.05); },   // full hyperspace ARRIVAL on opening the map
    hide() { this.open = false; },
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); },
    focusSystem(si, instant) { const c = this.sunCenter(si); this.tcx = c.x; this.tcz = c.z; if (instant) { this.cx = c.x; this.cz = c.z; } this.clampFocus(); },
    // keep the camera focus inside the galaxy so it can NEVER fly off to infinity
    clampFocus() { this.cx = clamp(this.cx, -1100, 1100); this.cz = clamp(this.cz, -750, 850); this.tcx = clamp(this.tcx, -1100, 1100); this.tcz = clamp(this.tcz, -750, 850); },
    // ALWAYS-STABLE pan: a screen drag moves the focus in the camera's ground plane, bounded — no perspective
    // inversion (which blew up near edge-on), so it can't rocket the view away.
    pan(dx, dy) {
      const k = 1 / (this.zoom * 0.5), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const fore = 1 / Math.max(0.4, Math.abs(Math.sin(this.pitch)));   // vertical foreshorten, capped so it can't explode
      const wx = -dx * k, wz = -dy * k * fore;
      this.cx += wx * cy - wz * sy; this.cz += wx * sy + wz * cy; this.tcx = this.cx; this.tcz = this.cz; this.clampFocus();
    },
    zoomBy(factor) { this.zoom = clamp(this.zoom * factor, 0.4, 4.5); },                       // zoom toward centre — predictable, no drift
    rotate(dx, dy) { this.yaw += dx * 0.009; this.pitch = clamp(this.pitch - dy * 0.009, -1.45, -0.12); },   // gentler, safe pitch range (never edge-on)
    proj(x, y, z) { x -= this.cx; z -= this.cz; const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); let x1 = x * cy + z * sy, z1 = -x * sy + z * cy; const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch); let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const f = 360 / (360 + z2 + 360) * this.zoom; return { x: this.w / 2 + x1 * f, y: this.h * 0.5 + y1 * f, z: z2, f }; },
    // THREE widely-spaced solar systems (a big triangle). Each planet rides its OWN
    // orbit: a distinct ellipse, inclination (tilt) and orientation, seeded by planet.
    SYS_POS: [{ x: -680, z: -150 }, { x: 0, z: 300 }, { x: 680, z: -150 }],
    sunCenter(si) { const p = this.SYS_POS[si] || this.SYS_POS[0]; return { x: p.x, y: 0, z: p.z }; },
    orbitParams(g) {
      if (!this._orb) this._orb = {}; if (this._orb[g]) return this._orb[g];
      const i = planetIdx(g), L = PLANET_LOCAL[i], si = PLANET_SYS[i];
      const h = Math.imul(g + si * 131 + 7, 2654435761) >>> 0, r = k => ((h >>> (k * 5)) & 31) / 31;
      const base = 60 + L * 40;                                  // way more spaced out
      const a = base * (0.8 + r(0) * 0.6), b = base * (0.5 + r(1) * 0.55);   // ellipse semi-axes
      const inc = (r(2) - 0.5) * 1.3, node = r(3) * TAU, ph = L * 2.1 + r(4) * TAU, sp = (0.08 + r(5) * 0.06) / Math.sqrt(L + 1) * (r(0) < 0.5 ? -1 : 1);
      return this._orb[g] = { a, b, inc, node, ph, sp };
    },
    orbitPoint(g, ang) {
      const o = this.orbitParams(g), ctr = this.sunCenter(PLANET_SYS[planetIdx(g)]);
      let px = Math.cos(ang) * o.a, pz = Math.sin(ang) * o.b, py = pz * Math.sin(o.inc); pz *= Math.cos(o.inc);
      const cn = Math.cos(o.node), sn = Math.sin(o.node);
      return { x: ctr.x + px * cn - pz * sn, y: py, z: ctr.z + px * sn + pz * cn };
    },
    planetWorld(g) { const o = this.orbitParams(g); return this.orbitPoint(g, o.ph + this.t * o.sp); },
    sun(p, lit, label) {
      const c = this.c, r = clamp(12 * p.f, 5, 24);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6);
      g.addColorStop(0, "rgba(255,255,255," + (lit ? 0.85 : 0.45) + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2.6, 0, TAU); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 1;
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + this.t * 0.25; c.beginPath(); c.moveTo(p.x + Math.cos(a) * r * 1.25, p.y + Math.sin(a) * r * 1.25); c.lineTo(p.x + Math.cos(a) * r * 1.6, p.y + Math.sin(a) * r * 1.6); c.stroke(); }
      c.fillStyle = "#fff"; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.globalAlpha = lit ? 1 : 0.7; c.fillStyle = "#fff"; c.font = "bold 11px ui-monospace,monospace"; c.textAlign = "center"; c.fillText("★ " + label.toUpperCase(), p.x, p.y - r * 2.6 - 4); c.globalAlpha = 1;
    },
    planet(p, r, bright, current, seld) {
      const c = this.c;
      if (current || seld) { const pulse = 0.5 + 0.5 * Math.sin(this.t * 4); c.strokeStyle = "rgba(255,255,255," + (0.35 + pulse * 0.5) + ")"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 5 + pulse * 3, 0, TAU); c.stroke(); }
      c.globalAlpha = bright; c.fillStyle = "#000"; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(p.x - r * 0.32, p.y - r * 0.32, r * 0.5, 0, TAU); c.fill();   // lit crescent
      c.globalAlpha = 1;
    },
    // cinematic dive: glide focus onto a planet, accelerate the zoom, white-wipe over the cut, drop into the world
    flyInto(g, onArrive) { this.flight = { g, t: 0, dur: 1.45, cx0: this.cx, cz0: this.cz, z0: this.zoom, onArrive, done: false }; Sfx.warp(1.45); const root = $("root"); if (root) root.classList.add("cinematic"); },
    render(dt) {
      if (!this.cv) return; const c = this.c;
      this.t += dt;
      if (!this.flight && this.intro == null && this._warp) this._warp = Math.max(0, this._warp - dt * 4);   // warp streaks settle after the dive
      if (this.intro != null) {                              // FULL hyperspace arrival when the map opens
        this.intro += dt; const p = clamp(this.intro / this.introDur, 0, 1), q = (1 - p) * (1 - p);
        this._warp = 1.7 * q;                                 // stars streak fast, then decelerate to points
        this.zoom = 0.7 + (this.iz0 - 0.7) * q;               // drop out: ease the zoom from close-in out to the resting galaxy view
        if (p >= 1) { this.intro = null; this._warp = 0; this.zoom = 0.7; }
      }
      if (this.flight) {                                     // zoom-into-base animation overrides the camera
        const fl = this.flight; fl.t += dt; const p = clamp(fl.t / fl.dur, 0, 1), e = p * p * (3 - 2 * p), w = this.planetWorld(fl.g);
        this.cx = fl.cx0 + (w.x - fl.cx0) * clamp(e * 1.4, 0, 1); this.cz = fl.cz0 + (w.z - fl.cz0) * clamp(e * 1.4, 0, 1);
        const dip = Math.sin(clamp(p / 0.16, 0, 1) * Math.PI) * 0.16;                              // anticipation: pull back, THEN lunge
        this.tcx = this.cx; this.tcz = this.cz; this.zoom = fl.z0 * (1 - dip) + (28 - fl.z0) * (p * p * p);
        this._warp = Math.min(1.3, e * 1.3); this._diveP = p; this._diveG = fl.g;
        const tv = $("transition");
        if (tv) {
          if (p < 0.72) { const r = 135 * (1 - clamp((p - 0.34) / 0.38, 0, 1)); tv.style.background = "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) " + r.toFixed(1) + "%, #000 " + (r + 8).toFixed(1) + "%)"; tv.style.opacity = r >= 134 ? "0" : "1"; }   // black iris closes on the planet
          else if (p < 0.88) { tv.style.background = "radial-gradient(circle at 50% 50%, #fff 0%, #fff 32%, rgba(255,255,255,.85) 62%, rgba(255,255,255,.4) 100%)"; tv.style.opacity = "1"; }   // ⚡ blooming hyperspace WHITE PUNCH
          else { tv.style.background = "#000"; tv.style.opacity = "1"; }                  // settle to black for the cut
        }
        if (p >= 1 && !fl.done) { fl.done = true; const cb = fl.onArrive, gg = fl.g; this.flight = null; this._warp = 1; this._diveP = null; if (tv) { tv.style.background = "#000"; tv.style.opacity = "1"; } if (cb) cb();
          veilT = VEIL_FADE; landT = LAND_DUR; camZoom = camFit * 2.3;                    // arrive zoomed on the base, then pull back
          shakeAdd(9); flashAdd(0.4); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.6, 0.6); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.34, 0.4); burst(W / 2, H / 2, 34, 240, 2.8);   // landing impact
          const lt = $("land-title"); if (lt) { lt.textContent = galName(gg).toUpperCase() + "  ·  " + sysName(gg); lt.classList.remove("show"); void lt.offsetWidth; lt.classList.add("show"); }
        }
      }
      this.cx += (this.tcx - this.cx) * Math.min(1, dt * 5); this.cz += (this.tcz - this.cz) * Math.min(1, dt * 5);   // smooth focus glide
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this._diveP != null) { const sh = this._diveP * this._diveP * 10; c.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh); }   // build-up camera shake during the dive
      c.fillStyle = "#000"; c.fillRect(0, 0, this.w, this.h);
      const warp = this._warp || 0;
      if (warp > 0.05) {   // hyperspace: stars stretch radially away from centre as you dive in
        c.lineCap = "round";
        for (const s of this.stars) { const sx = s.x * this.w, sy = s.y * this.h, dx = sx - this.w / 2, dy = sy - this.h / 2, dl = Math.hypot(dx, dy) || 1, str = warp * warp * (50 + dl); c.strokeStyle = "rgba(255,255,255," + (0.25 + 0.55 * warp).toFixed(2) + ")"; c.lineWidth = s.r * (1 + warp * 1.6); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + dx / dl * str, sy + dy / dl * str); c.stroke(); }
      } else { c.fillStyle = "#fff"; for (const s of this.stars) { c.globalAlpha = 0.2 + 0.35 * Math.abs(Math.sin(this.t + s.x * 9)); c.fillRect(s.x * this.w, s.y * this.h, s.r, s.r); } c.globalAlpha = 1; }
      const curSys = PLANET_SYS[planetIdx(S.galaxy)];
      this.hit = [];
      // each planet's own elliptical/inclined orbit ring
      for (let g = 1; g <= TOTAL_PLANETS; g++) {
        const cur = g === S.galaxy, seld = g === this.sel;
        c.beginPath();
        for (let k = 0; k <= 64; k++) { const w = this.orbitPoint(g, k / 64 * TAU), pr = this.proj(w.x, w.y, w.z); k ? c.lineTo(pr.x, pr.y) : c.moveTo(pr.x, pr.y); }
        c.globalAlpha = seld ? 0.85 : cur ? 0.5 : 0.12; c.strokeStyle = "#fff"; c.lineWidth = seld ? 2.5 : cur ? 2 : 1; c.stroke();
      }
      c.globalAlpha = 1;
      // suns behind (far-to-near) — and register each as a tappable focus target
      SYSTEMS.map((s, si) => ({ si, p: this.proj(this.sunCenter(si).x, 0, this.sunCenter(si).z) }))
        .sort((a, b) => b.p.z - a.p.z).forEach(s => { this.sun(s.p, s.si === curSys, SYSTEMS[s.si].name); this.hit.push({ sun: s.si, x: s.p.x, y: s.p.y, r: Math.max(clamp(12 * s.p.f, 5, 24) * 2.2, 34) }); });
      // planets, far-to-near (painter's depth sort)
      const pts = []; for (let g = 1; g <= TOTAL_PLANETS; g++) { const w = this.planetWorld(g); pts.push({ g, p: this.proj(w.x, w.y, w.z) }); }
      pts.sort((a, b) => b.p.z - a.p.z);
      for (const it of pts) {
        const g = it.g, p = it.p, current = g === S.galaxy, reached = g < S.galaxy, next = g === S.galaxy + 1;
        const r = clamp(7 * p.f, 3, 15), bright = current ? 1 : reached ? 0.85 : next ? 0.8 : 0.3;
        this.hit.push({ g, x: p.x, y: p.y, r: Math.max(r + 11, 24) });
        this.planet(p, r, bright, current, g === this.sel);
        c.globalAlpha = clamp(p.f, 0.4, 1); c.textAlign = "center"; c.fillStyle = (reached || current || next) ? "#fff" : "rgba(255,255,255,0.5)"; c.font = Math.round(10 * clamp(p.f, 0.7, 1.3)) + "px ui-monospace,monospace";
        c.fillText((current ? "▶ " : "") + galName(g), p.x, p.y - r - 7);
        c.globalAlpha = 1;
      }
      // ── your expedition in transit: dashed trajectory + a little ship riding it ──
      if (S && S.travel) {
        const tv = S.travel, a = tv.fromW || this.planetWorld(tv.from), b = this.planetWorld(tv.to), pr = clamp(tv.t / tv.dur, 0, 1);
        const pa = this.proj(a.x, a.y, a.z), pb = this.proj(b.x, b.y, b.z);
        c.save();
        c.setLineDash([4, 6]); c.lineWidth = 1.3; c.strokeStyle = "rgba(255,255,255,0.45)";
        c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke(); c.setLineDash([]);
        // arced ship position (lifts off the orbital plane mid-flight)
        const sx = a.x + (b.x - a.x) * pr, sz = a.z + (b.z - a.z) * pr, sy = a.y + (b.y - a.y) * pr - Math.sin(pr * Math.PI) * 60;
        const sp = this.proj(sx, sy, sz), ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), r = clamp(7 * sp.f, 4, 12);
        c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 2;                                   // exhaust trail
        c.beginPath(); c.moveTo(sp.x - Math.cos(ang) * r * 2.6, sp.y - Math.sin(ang) * r * 2.6); c.lineTo(sp.x, sp.y); c.stroke();
        c.translate(sp.x, sp.y); c.rotate(ang);                                                       // ship triangle, nose toward target
        c.fillStyle = "#fff"; c.beginPath(); c.moveTo(r, 0); c.lineTo(-r * 0.7, r * 0.62); c.lineTo(-r * 0.7, -r * 0.62); c.closePath(); c.fill();
        c.restore();
        c.fillStyle = "rgba(255,255,255,0.9)"; c.font = "bold 10px ui-monospace,monospace"; c.textAlign = "center";
        c.fillText("⟶ " + galName(tv.to) + "  " + fmtTime(Math.max(0, tv.dur - tv.t)), sp.x, sp.y - r - 6);
      }
      // dive-only juice: tunnel vignette + a lens-flare starburst right before the white punch
      if (this.flight && this._diveP != null) {
        const dp = this._diveP, cx2 = this.w / 2, cy2 = this.h / 2;
        const vg = c.createRadialGradient(cx2, cy2, this.h * 0.18, cx2, cy2, this.h * 0.78); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0," + (0.55 * dp).toFixed(2) + ")"); c.fillStyle = vg; c.fillRect(0, 0, this.w, this.h);
        if (dp > 0.46 && dp < 0.74) { const fa = (dp - 0.46) / 0.28; c.strokeStyle = "#fff"; c.lineCap = "round"; for (let k = 0; k < 10; k++) { const a2 = k / 10 * TAU + this.t * 0.6, len = 30 + 300 * fa * fa; c.globalAlpha = fa * 0.85; c.lineWidth = (k % 2 ? 1.5 : 3.5) * (1 + fa); c.beginPath(); c.moveTo(cx2, cy2); c.lineTo(cx2 + Math.cos(a2) * len, cy2 + Math.sin(a2) * len); c.stroke(); } c.globalAlpha = fa; c.fillStyle = "#fff"; c.beginPath(); c.arc(cx2, cy2, 6 + 60 * fa * fa, 0, TAU); c.fill(); c.globalAlpha = 1; }
      }
      // ENTERING <PLANET> banner during the dive — fades in, then the iris swallows it
      if (this.flight && this._diveP != null) {
        const a = clamp(this._diveP * 4, 0, 1) * clamp((0.7 - this._diveP) * 6, 0, 1);
        if (a > 0.02) {
          c.globalAlpha = a; c.fillStyle = "#fff"; c.textAlign = "center";
          c.font = "700 12px ui-monospace,monospace"; c.fillText("▶  E N T E R I N G", this.w / 2, this.h * 0.26);
          c.font = "800 22px ui-monospace,monospace"; c.fillText(galName(this._diveG).toUpperCase(), this.w / 2, this.h * 0.26 + 26);
          c.globalAlpha = 1;
        }
      }
    },
    tap(x, y) { let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } }
      if (!best) return;
      if (best.sun != null) { this.focusSystem(best.sun); this.sel = null; $("gm-info").classList.remove("show"); }   // tap a sun -> recenter on its system
      else { this.sel = best.g; showGalaxyInfo(best.g); } },
  };
  // ---- PLANET LAYERS: each planet is its own run; vault holds conquered planets' builds + idle rate ----
  function planetMeta(g) { return S.vault[g] || (S.vault[g] = { conquered: false, earned: 0, bgRate: 0 }); }
  function freshPlanetBuild() { const lv = {}; UPS.forEach(u => lv[u.id] = 0); const cn = {}; ALL_TYPES.forEach(t => cn[t] = {}); return { cash: 0, units: [newUnit("turret")], collectors: [{ type: "drone" }], lv, classNodes: cn }; }
  function snapshotActive() {   // write the live build back into the vault, lock in the best idle rate
    const v = planetMeta(S.galaxy);
    v.cash = S.cash; v.units = S.units; v.collectors = S.collectors; v.lv = S.lv; v.classNodes = S.classNodes;
    v.earned = curEarned; v.bgRate = Math.max(v.bgRate || 0, cps * BG_EFF);
  }
  function activatePlanet(g) {   // make planet g the live playfield (restore its build, or fresh-start it)
    const v = planetMeta(g), fresh = !(v && v.units), b = fresh ? freshPlanetBuild() : v;
    S.cash = fresh ? Math.floor(eco(g) * startMul(g)) : (b.cash || 0);   // a fresh landing comes with starter supplies so you build immediately
    S.units = (b.units && b.units.length) ? b.units : [newUnit("turret")];
    S.collectors = (b.collectors && b.collectors.length) ? b.collectors : [{ type: "drone" }];
    S.lv = b.lv || freshPlanetBuild().lv; S.classNodes = b.classNodes || freshPlanetBuild().classNodes;
    S.galaxy = g; if (g > S.peakGalaxy) S.peakGalaxy = g; curEarned = v.earned || 0;
    dots = []; orbs = []; beams = []; parts = []; selUnit = -1;
    syncCollectors(); recompute(); renderList(); syncHUD(); GMap.reset && 0;
  }
  // journey time is RELATIVE TO THE REAL MAP DISTANCE between the two planets (the line the ship
  // flies). Calibrated so the first short hop ≈ 3h; far planets & inter-system hauls scale up
  // naturally (the big cross-system jumps land around a day+).
  const TRAVEL_SEC_PER_UNIT = 80.5;
  function travelDur(a) {
    let d = 67;
    try { const pa = GMap.planetWorld(a), pb = GMap.planetWorld(a + 1); d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z); } catch (e) {}
    return Math.max(1800, Math.round(d * TRAVEL_SEC_PER_UNIT));
  }
  function travel() {   // LAUNCH an expedition to the next planet: costs treasury + takes a real journey
    const g = S.galaxy;
    if (S.travel) return;                                   // already en route
    if (g >= TOTAL_PLANETS) return;                         // no planet beyond the last
    if (!S.free && !planetMeta(g).conquered) return;        // must conquer the current planet first
    const cost = travelCost();
    if (!S.free && S.cash < cost) return;                   // need the launch funds banked
    if (!S.free) { S.cash -= cost; }
    let fromW = null; try { const w = GMap.planetWorld(g); fromW = { x: w.x, y: w.y, z: w.z }; } catch (e) {}   // freeze the DEPARTURE point in space at launch — the ship then flies a stable line from here, not a rubber-band between two orbiting planets
    S.travel = { from: g, to: g + 1, t: 0, dur: travelDur(g), fromW };
    META.stats.travels++; flashAdd(0.35); shakeAdd(2); recompute(); syncHUD(); save();
  }
  // jump to ANY reached planet (revisit & upgrade your background empire, or test)
  function jumpTo(g) { g = clamp(Math.round(g), 1, Math.max(S.peakGalaxy, 1)); if (g === S.galaxy) return; snapshotActive(); flashAdd(0.5); ring(W / 2, H / 2, 10, Math.max(W, H), 0.5); activatePlanet(g); save(); }
  // EXCHANGE: convert (part of) a background planet's currency into the one you're spending now.
  // Room-aware: only consumes as much source as fits the remaining import budget, so converting on a
  // spike just costs LESS source — you can never exceed IMPORT_CAP no matter how you slice it.
  function doExchange(fromG, reqCash) {
    const v = S.vault[fromG]; if (!v || fromG === S.galaxy) return 0;
    const rate = fxRate(fromG, S.galaxy), room = importRoom();
    if (!(rate > 0) || room <= 0) return 0;
    const cash = Math.min(Math.floor(reqCash), Math.floor(v.cash || 0), Math.ceil(room / rate));
    if (!(cash > 0)) return 0;
    const got = Math.floor(Math.min(cash * rate, room)); if (got <= 0) return 0;
    v.cash -= cash; S.cash += got;
    (S.imported || (S.imported = {}))[S.galaxy] = importUsed() + got;
    recompute(); syncHUD(); save(); return got;
  }
  function exchangeAll() {   // mass-convert every wallet's full balance (each respects the shared import room)
    let total = 0; for (let g = 1; g <= S.peakGalaxy; g++) { if (g === S.galaxy) continue; const v = S.vault[g]; if (v && v.conquered && v.cash > 0) total += doExchange(g, v.cash); }
    return total;
  }
  const fxWallets = () => { const out = []; for (let g = 1; g <= S.peakGalaxy; g++) { if (g === S.galaxy) continue; const v = S.vault[g]; if (v && v.conquered) out.push(g); } return out; };
  let fxPct = {};   // per-wallet convert fraction (0..1) chosen via slider
  let fxOpen = null;   // which wallet (planet g) is expanded in the accordion
  const FX_CHIPS = [["25%", 25], ["50%", 50], ["75%", 75], ["MAX", 100]];
  function openExchange() {
    const sym = curSym(S.galaxy);
    if ($("fx-into")) $("fx-into").textContent = "→ " + sym + " " + curName(S.galaxy);
    const wrap = $("fx-list"); if (!wrap) return; wrap.innerHTML = "";
    const wallets = fxWallets();
    if (!wallets.length) { wrap.innerHTML = "<p class='muted' style='padding:24px 18px;text-align:center'>No foreign wallets yet.<br>Conquer this world, travel onward, and each planet's idle currency pools into its own wallet here — ready to bankroll your next fresh start.</p>"; refreshExchange(); return; }
    wallets.sort((a, b) => Math.floor((S.vault[b].cash) || 0) - Math.floor((S.vault[a].cash) || 0));   // funded wallets at top, empties drop to the bottom as a market-view list
    if (fxOpen == null || !wallets.includes(fxOpen)) { const top = wallets.find(g => (S.vault[g].cash || 0) > 0); fxOpen = top == null ? null : top; }   // default-expand the richest wallet
    for (const g of wallets) {
      const bal = Math.floor((S.vault[g].cash) || 0), has = bal > 0, isOpen = g === fxOpen;
      if (fxPct[g] == null) fxPct[g] = 1;
      const el = document.createElement("div"); el.className = "fx-row" + (has ? "" : " locked") + (isOpen ? " open" : ""); el.dataset.fxg = g;
      const chips = FX_CHIPS.map(([lab, p]) => `<button class="fx-chip" data-g="${g}" data-p="${p}">${lab}</button>`).join("");
      // compact tappable header: symbol, name, balance, live rate, chevron (all 18 fit at a glance)
      let html =
        `<div class="fx-head-row" data-g="${g}"><span class="fx-sym">${curSym(g)}</span><span class="fx-name">${curName(g)}</span>` +
        `<span class="fx-bal2 ${has ? "" : "fx-dim"}" data-g="${g}">${curSym(g)} ${fmt(bal)}</span>` +
        `<span class="fx-rate" data-g="${g}"></span><span class="fx-chev">${has ? (isOpen ? "▾" : "▸") : ""}</span></div>`;
      // expanded converter body only on the open, funded row
      if (has && isOpen) html +=
        `<div class="fx-body">` +
          `<div class="fx-ctrl"><input type="range" class="fx-slider" min="1" max="100" value="${Math.round(fxPct[g]*100)}" data-g="${g}"><span class="fx-pct" data-g="${g}">${Math.round(fxPct[g]*100)}%</span></div>` +
          `<div class="fx-chips">${chips}</div>` +
          `<div class="fx-line"><span class="fx-k">Convert</span><span class="fx-v fx-send" data-g="${g}"></span></div>` +
          `<div class="fx-line fx-rcv"><span class="fx-k">Receive</span><span class="fx-v fx-amt" data-g="${g}"></span></div>` +
          `<button class="fx-go" data-g="${g}">CONVERT</button>` +
        `</div>`;
      el.innerHTML = html;
      wrap.appendChild(el);
      el.querySelector(".fx-head-row").onclick = () => { if (!has) return; fxOpen = (fxOpen === g ? null : g); openExchange(); };
      if (has && isOpen) {
        const sl = el.querySelector(".fx-slider"), pct = el.querySelector(".fx-pct");
        const setPct = p => { fxPct[g] = clamp(p / 100, 0.01, 1); sl.value = Math.round(fxPct[g] * 100); pct.textContent = Math.round(fxPct[g] * 100) + "%"; refreshExchange(); };
        sl.oninput = () => setPct(+sl.value);
        el.querySelectorAll(".fx-chip").forEach(c => c.onclick = () => setPct(+c.dataset.p));
        el.querySelector(".fx-go").onclick = () => { doExchange(g, Math.floor(bal * fxPct[g])); openExchange(); };
      }
    }
    refreshExchange();
  }
  function refreshExchange() {   // live floating rates + payouts + budget meter while the FX page is open
    const ex = $("fxpage"); if (!ex || !ex.classList.contains("show")) return;
    const now = Date.now() / 1000, list = $("fx-list"), sym = curSym(S.galaxy);
    // import-budget meter
    const cap = IMPORT_CAP(S.galaxy), used = importUsed(), room = Math.max(0, cap - used), pctUsed = clamp(used / cap, 0, 1) * 100;
    const meter = $("fx-budget");
    if (meter) meter.innerHTML =
      "<div class='fxb-top'><span class='fxb-title'>FOREIGN-AID BUDGET</span><span class='fxb-cap'>cap " + sym + " " + fmt(cap) + "</span></div>" +
      "<div class='fxb-bar'><div class='fxb-fill' style='width:" + pctUsed.toFixed(1) + "%'></div></div>" +
      "<div class='fxb-num'><span>used " + sym + " " + fmt(used) + "</span><span>" + sym + " " + fmt(room) + " left</span></div>" +
      "<div class='fxb-note'>Rates are brutal — you keep ~2%, every spread is below 1, and " + curName(S.galaxy) + " can only ever absorb the cap above. Convert on a spike ↗.</div>";
    if (!list) return;
    list.querySelectorAll(".fx-rate").forEach(sp => { const g = +sp.dataset.g, m = fxMarketAt(g, S.galaxy, now), up = m >= fxMarketAt(g, S.galaxy, now - 1.5); sp.textContent = (up ? "↗ ×" : "↘ ×") + m.toFixed(2); sp.classList.toggle("dn", !up); });
    list.querySelectorAll("[data-fxg]").forEach(row => {
      const g = +row.dataset.fxg, v = S.vault[g], bal = Math.floor((v && v.cash) || 0), frac = fxPct[g] == null ? 1 : fxPct[g];
      const send = Math.floor(bal * frac), conv = exchangeAmt(g, send);
      const b2 = row.querySelector(".fx-bal2"); if (b2) b2.textContent = curSym(g) + " " + fmt(bal);
      const se = row.querySelector(".fx-send"); if (se) se.textContent = curSym(g) + " " + fmt(send);
      const amt = row.querySelector(".fx-amt"); if (amt) amt.textContent = sym + " " + fmt(conv);
      const b = row.querySelector(".fx-go"); if (b) { b.disabled = conv <= 0; b.textContent = conv > 0 ? "CONVERT → " + sym + " " + fmt(conv) : (room <= 0 ? "BUDGET FULL" : "CONVERT"); }
    });
    // mass-convert footer
    let massTotal = 0; for (const g of fxWallets()) { const v = S.vault[g]; if (v && v.cash > 0) massTotal += Math.min(Math.floor(v.cash) * fxRate(g, S.galaxy), room); }   // indicative (shared room means actual may differ slightly)
    const mi = $("fx-massinfo"), mb = $("fx-massconvert");
    if (mi) mi.textContent = room <= 0 ? "Import budget full." : "All wallets ≈ " + sym + " " + fmt(Math.floor(Math.min(massTotal, room)));
    if (mb) mb.disabled = room <= 0 || !fxWallets().some(g => (S.vault[g].cash || 0) > 0);
  }
  // CODES: "test" turns on FREE SANDBOX mode — everything is unlocked & free to
  // buy so you click and test whatever you want yourself (it does NOT hand you a
  // pre-built roster). Toggle off by entering the code again.
  function unlockAll() {
    S.free = !S.free;                                       // toggle free sandbox
    if (S.free) { S.peakGalaxy = TOTAL_PLANETS; S.cash = Math.max(S.cash, 1e12); }   // all planets jumpable; cash just for show (buys are free)
    if ($("buymode")) { $("buymode").style.display = S.free ? "" : "none"; $("buymode").textContent = "BUY ×" + BUY_AMTS[buyIdx]; }   // bulk-buy control is a test-mode tool
    syncCollectors(); recompute(); renderList(); syncHUD(); save();
    return S.free;
  }
  /* ----------------------------- screens ------------------------- */
  function setScreen(s) {
    state = s;
    $("home").classList.toggle("show", s === "home");
    $("top").style.display = (s === "play") ? "flex" : "none";
    $("dock").style.display = (s === "play") ? "block" : "none";
    $("btn-menu").style.display = (s === "play") ? "block" : "none";
    $("btn-metrics").style.display = (s === "play") ? "block" : "none";
    if (s === "home") { $("home-gal").textContent = S.peakGalaxy; }
  }

  /* ----------------------------- input --------------------------- */
  // screen → WORLD coords (inverse of the center-locked camera), plus raw screen for pinch
  function ptr(e) { const r = canvas.getBoundingClientRect(), s = e.touches ? e.touches[0] : e, sx = s.clientX - r.left, sy = s.clientY - r.top; return { x: (sx - SW / 2) / camZoom + W / 2, y: (sy - SH / 2) / camZoom + H / 2, sx, sy }; }
  function unitAt(x, y) { const n = S.units.length; for (let i = 0; i < n; i++) { const p = unitPos(i, n); if ((p.x - x) ** 2 + (p.y - y) ** 2 <= 24 * 24) return i; } return -1; }
  const gptrs = new Map(); let pinchD0 = 0;
  canvas.addEventListener("pointerdown", e => {
    if (state !== "play") return;
    const p = ptr(e); gptrs.set(e.pointerId, { sx: p.sx, sy: p.sy });
    if (gptrs.size >= 2) { drawing = false; const a = [...gptrs.values()]; pinchD0 = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy); return; }   // two fingers = zoom, not draw
    const ui = unitAt(p.x, p.y);
    if (ui >= 0) { openSkillTree(S.units[ui].type); return; }
    collectAt(p.x, p.y); drawing = true; lastDraw = p; brushAt(p.x, p.y);
  });
  canvas.addEventListener("pointermove", e => {
    if (state !== "play") return;
    if (gptrs.has(e.pointerId)) { const q = ptr(e); gptrs.set(e.pointerId, { sx: q.sx, sy: q.sy }); }
    if (gptrs.size >= 2) { const a = [...gptrs.values()], d = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy); if (pinchD0) camZoom = clamp(camZoom * d / pinchD0, camFit, 1.15); pinchD0 = d; return; }   // pinch to zoom the playfield
    if (!drawing) return;
    const p = ptr(e), dx = p.x - lastDraw.x, dy = p.y - lastDraw.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / 14));
    for (let i = 1; i <= steps; i++) { const bx = lastDraw.x + dx * i / steps, by = lastDraw.y + dy * i / steps; brushAt(bx, by); collectAt(bx, by); }
    lastDraw = p;
  });
  const endDraw = e => { if (e && e.pointerId !== undefined) gptrs.delete(e.pointerId); if (gptrs.size < 2) pinchD0 = 0; drawing = false; };
  canvas.addEventListener("pointerup", endDraw); canvas.addEventListener("pointercancel", endDraw); canvas.addEventListener("pointerleave", endDraw);
  canvas.addEventListener("wheel", e => { if (state !== "play") return; e.preventDefault(); camZoom = clamp(camZoom * (1 - e.deltaY * 0.0012), camFit, 1.15); }, { passive: false });

  /* ----------------------------- wiring -------------------------- */
  for (const t of document.querySelectorAll(".tab[data-tab]")) { tabBtns[t.dataset.tab] = t; t.onclick = () => { activeTab = t.dataset.tab; for (const k in tabBtns) tabBtns[k].classList.toggle("sel", tabBtns[k] === t); renderList(); }; }
  const syncBuyMode = () => { const b = $("buymode"); if (!b || !S) return; b.style.display = S.free ? "" : "none"; b.textContent = "BUY ×" + BUY_AMTS[buyIdx]; };
  if ($("buymode")) $("buymode").onclick = () => { buyIdx = (buyIdx + 1) % BUY_AMTS.length; syncBuyMode(); renderList(); };
  $("ab-frenzy").onclick = () => useAbility("frenzy"); $("ab-dotrain").onclick = () => useAbility("dotrain"); $("ab-blackhole").onclick = () => useAbility("blackhole");
  for (const i of document.querySelectorAll(".ab-i")) i.onclick = e => { e.stopPropagation(); const k = i.dataset.info; showInfo({ frenzy: "Frenzy", dotrain: "Dot Rain", blackhole: "Black Hole" }[k], k); };
  $("info-close").onclick = $("info-back").onclick = () => $("info-modal").classList.remove("show");
  $("btn-travel").onclick = () => { if (S.travel) { if (S.free) S.travel.t = S.travel.dur; return; } travel(); };   // free mode: tapping while EN ROUTE skips the journey timer (arrival is processed next update tick)
  const openFx = () => { openExchange(); $("fxpage").classList.add("show"); };
  $("btn-exchange").onclick = openFx;
  if ($("fx-close")) $("fx-close").onclick = () => $("fxpage").classList.remove("show");
  if ($("fx-massconvert")) $("fx-massconvert").onclick = () => { exchangeAll(); openExchange(); };
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
  if ($("st-max")) $("st-max").onclick = () => { allocAll(STree.type); showNodeInfo(STree.selNode()); };
  $("gm-reset").onclick = () => GMap.reset(); $("st-reset").onclick = () => STree.reset();
  $("gm-exchange").onclick = openFx;
  $("btn-metrics").onclick = () => { buildMetrics(); $("metrics").classList.add("show"); };
  $("metrics-close").onclick = $("metrics-back").onclick = () => $("metrics").classList.remove("show");
  $("dock-toggle").onclick = () => { const d = $("dock"); const min = d.classList.toggle("min"); $("dock-toggle").textContent = min ? "▴ Menu" : "▾ Minimise"; };
  $("btn-menu").onclick = () => $("menu").classList.add("show");
  $("menu-close").onclick = () => $("menu").classList.remove("show");
  $("menu-resume").onclick = () => $("menu").classList.remove("show");
  $("menu-home").onclick = () => { save(); $("menu").classList.remove("show"); setScreen("home"); };   // back to the home screen (progress saved)
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress?")) wipeSave(); };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  $("home-play").onclick = () => { renderList(); setScreen("play"); };
  $("home-galaxies").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); };
  $("home-how").onclick = () => $("how").classList.add("show");
  $("how-close").onclick = $("how-back").onclick = () => $("how").classList.remove("show");
  $("home-reset").onclick = () => { if (confirm("Erase ALL progress?")) wipeSave(); };
  // CODES box — "test" toggles FREE SANDBOX mode: all planets jumpable, every
  // defender/collector/upgrade unlocked and FREE to buy (you click & test yourself).
  function applyCode() {
    const v = ($("code-input").value || "").trim().toLowerCase();
    const msg = $("code-msg");
    if (v === "test") { const on = unlockAll(); msg.textContent = on ? "✓ FREE MODE ON" : "free mode off"; msg.style.color = "#fff"; $("code-input").value = ""; $("home-gal").textContent = S.peakGalaxy; }
    else { msg.textContent = v ? "✗ invalid code" : ""; msg.style.color = "var(--warn)"; }
  }
  if ($("code-go")) $("code-go").onclick = applyCode;
  if ($("code-input")) $("code-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } });

  /* ----------------------------- loop / boot --------------------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); SW = canvas.clientWidth; SH = canvas.clientHeight;
    canvas.width = SW * DPR | 0; canvas.height = SH * DPR | 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = SW * WORLD_SCALE; H = SH * WORLD_SCALE; camFit = Math.min(SW / W, SH / H);   // fit the whole world on screen by default
    camZoom = camZoom ? clamp(camZoom, camFit, 1.15) : camFit;
    for (const dr of drones) { dr.x = clamp(dr.x, 0, W); dr.y = clamp(dr.y, 0, H); }
    if (GMap.open) GMap.resize();
    if ($("skilltree").classList.contains("show")) STree.resize();
  }
  window.addEventListener("resize", resize);
  let last = 0, saveAcc = 0;
  function loop(now) { let dt = (now - last) / 1000 || 0; last = now; if (dt > 0.05) dt = 0.05; update(dt); render(); syncHUD(); if (GMap.open) GMap.render(dt); if ($("skilltree").classList.contains("show")) STree.render(dt);
    if (veilT > 0) { veilT = Math.max(0, veilT - dt); setVeil(135 * (1 - veilT / VEIL_FADE)); }   // iris the black veil open over the base after landing
    if (landT > 0) { landT = Math.max(0, landT - dt); camZoom += (camFit - camZoom) * Math.min(1, dt * 3.5); if (landT === 0) { camZoom = camFit; const root = $("root"); if (root) root.classList.remove("cinematic"); } }   // camera pulls back to the base, then letterbox retracts
    fxAcc += dt; if (fxAcc > 0.2) { fxAcc = 0; refreshExchange(); }   // tick the live FX rates while the exchange is open
    saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; save(); } requestAnimationFrame(loop); }

  if ($("version")) $("version").textContent = VERSION;
  load(); resize(); syncCollectors(); renderList(); GMap.init(); STree.init(); setScreen("home"); syncBuyMode();
  if (S._welcome) { $("welcome-text").textContent = "Your defenders kept firing for " + fmtTime(S._welcome.elapsed) + "."; $("welcome-cash").textContent = curSym(S.galaxy) + " " + fmt(S._welcome.gain); $("welcome").classList.add("show"); S._welcome = null; }
  window.addEventListener("beforeunload", save);
  requestAnimationFrame(loop);

  if (typeof window !== "undefined") window.__IDS = { S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, parts: () => parts, shake: () => shake, drones: () => drones, units: () => S.units, collectors: () => S.collectors, uDmg, uRate, cSpeed, cSuction, cCollect, cYield, brushAt, collectAt, useAbility, travel, fmt, buyUnit, buyUp: id => buyUpgrade(UP[id]), upCost: id => upCost(UP[id]), buildTree, allocNode, nodeAllocatable, nodeAllocated, nodeLabel, classStats: t => classStats(t), unitPos, openSkillTree, showNodeInfo, showInfo, sellOne, showGalaxyInfo, recompute, setScreen, abil: () => abil, travelCost, galSpawnMul, galCap, state: () => state, GMap, STree, isCol, doExchange, exchangeAll, exchangeAmt, importRoom, importCap: () => IMPORT_CAP(S.galaxy), fxRate };
})();
