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
  // ── bespoke icon set — hand-drawn thin-line glyphs (one source of truth; no emoji, no libraries) ──
  // monochrome, inherit currentColor; used in DOM via iconMarkup() or <i data-ico="name"> + hydrateIcons().
  const ICONS = {
    play: '<path d="M8 5.5l11 6.5-11 6.5z"/>',
    planet: '<circle cx="11" cy="11" r="5.4"/><ellipse cx="12" cy="12" rx="11" ry="3.6" transform="rotate(-24 12 12)"/>',
    help: '<path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z"/><path d="M9.8 9.4a2.3 2.3 0 1 1 3 2.2c-.8.4-1.2.9-1.2 1.8"/><circle cx="11.6" cy="16.4" r=".6" fill="currentColor" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
    reset: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M18 3.5v4h-4"/>',
    home: '<path d="M3.5 11.2L12 4l8.5 7.2"/><path d="M5.6 9.6V20h12.8V9.6"/><path d="M10 20v-5h4v5"/>',
    turret: '<circle cx="7" cy="16" r="3"/><path d="M7 13V9h5l8-2v3l-8 2H9"/><path d="M4.2 18.8L2.5 21"/>',
    shield: '<path d="M12 3l7 2.4v5.1c0 4.9-3.2 8-7 10.2-3.8-2.2-7-5.3-7-10.2V5.4z"/><path d="M9 11.5l2 2 4-4"/>',
    alien: '<path d="M12 3.4l6 4.3v8.6L12 20.6 6 16.3V7.7z"/><circle cx="9.6" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="11" r="1.1" fill="currentColor" stroke="none"/><path d="M9.5 15h5"/>',
    gem: '<path d="M6 4.5h12l3 4.6-9 10.4L3 9.1z"/><path d="M3 9.1h18M9 4.5L6 9.1l6 10.4 6-10.4-3-4.6"/>',
    tree: '<circle cx="12" cy="5" r="2.1"/><circle cx="6" cy="16" r="2.1"/><circle cx="18" cy="16" r="2.1"/><path d="M12 7.1v3.4M11 12l-4 2.3M13 12l4 2.3"/>',
    collector: '<rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.2"/><circle cx="5.4" cy="5.4" r="2.1"/><circle cx="18.6" cy="5.4" r="2.1"/><circle cx="5.4" cy="18.6" r="2.1"/><circle cx="18.6" cy="18.6" r="2.1"/><path d="M9.2 9.2L6.9 6.9M14.8 9.2l2.3-2.3M9.2 14.8l-2.3 2.3M14.8 14.8l2.3 2.3"/>',
    swords: '<path d="M4 4l11 11M9.5 15.5l-5 5M20 4L9 15"/><path d="M3.5 18l2.5 2.5M18.5 18L16 20.5"/>',
    castle: '<path d="M4 21V10h2V7.5h2V10h2V8h4v2h2V7.5h2V10h2v11z"/><path d="M10 21v-4h4v4"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7.4v9.2M9.6 9.4c0-1 1-1.7 2.4-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.5-2.5.5-2.5 1.6 1.1 1.7 2.5 1.7 2.4-.7 2.4-1.6"/>',
    brush: '<path d="M4 20.5c2.2 0 3.4-1.2 3.4-3.2"/><path d="M7 16.6l8.4-8.4 2.8 2.8-8.4 8.4z"/><path d="M15.4 8.2l2-2 .9-.9 1.9 1.9-.9.9-2 2"/>',
    bolt: '<path d="M13 2.5L5.5 13H11l-1 8.5L18.5 10H12.5z"/>',
    power: '<path d="M12 3.5v8"/><path d="M7.6 6.4a7 7 0 1 0 8.8 0"/>',
    lock: '<rect x="5" y="10.6" width="14" height="9.4" rx="1.6"/><path d="M8 10.6V8a4 4 0 0 1 8 0v2.6"/>',
    sound: '<path d="M4 9.2v5.6h3.4L13 19V5L7.4 9.2z"/><path d="M16 9.4a3.6 3.6 0 0 1 0 5.2M18.4 7a7 7 0 0 1 0 10"/>',
    vibe: '<rect x="8.2" y="4" width="7.6" height="16" rx="1.6"/><path d="M4.5 9v6M19.5 9v6M10.8 17.4h2.4"/>',
    shake: '<rect x="7" y="7" width="10" height="10" rx="1.3"/><path d="M2.5 9.5v5M21.5 9.5v5M9.5 2.5h5M9.5 21.5h5"/>',
    spark: '<path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M5.6 5.6l2.6 2.6M15.8 15.8l2.6 2.6M18.4 5.6l-2.6 2.6M8.2 15.8l-2.6 2.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    hash: '<path d="M8.5 4L6.5 20M17.5 4l-2 16M4 9h16M3.2 15H19"/>',
    rocket: '<path d="M20 4c-4 .2-7 1.8-9.2 4.8L8 12l4 4 3.2-2.8C18.2 11 19.8 8 20 4z"/><path d="M8 12l-3.5 1 2 2M12 16l1 3.5 2-2M6.5 17.5L4 20"/>',
    rain: '<path d="M5 11a3.6 3.6 0 0 1 3.4-3.6 4.6 4.6 0 0 1 8.6-1 3.3 3.3 0 0 1 .5 6.4"/><path d="M8 16v3M12 17v3M16 16v3"/>',
    blackhole: '<ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-18 12 12)"/><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none"/>',
    chart: '<path d="M4 20V4M4 20h16M8 20v-5M12 20v-9M16 20v-6"/>',
    star4: '<path d="M12 2.2l2.3 7.5 7.5 2.3-7.5 2.3-2.3 7.5-2.3-7.5L2.2 12l7.5-2.3z" fill="currentColor" stroke="none"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };
  function iconMarkup(name, extra) { const p = ICONS[name]; if (!p) return ""; return '<svg class="ico' + (extra ? " " + extra : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>"; }
  function hydrateIcons(root) { (root || document).querySelectorAll("i[data-ico]").forEach(e => { const m = iconMarkup(e.getAttribute("data-ico"), e.getAttribute("data-cls") || ""); if (m) e.outerHTML = m; }); }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // ▶ BUILD VERSION — bump this on EVERY change (shown top-right in-game) so it's obvious which build is live.
  const VERSION = "v10.2";
  let W = 0, H = 0, DPR = 1, SW = 0, SH = 0, camZoom = 0, camFit = 0;   // W/H = WORLD (bigger than screen); SW/SH = screen; camZoom = world→screen scale (center-locked)
  const WORLD_SCALE = 1.45;   // the playfield is this much bigger than the screen (unchanged gameplay)
  const ZOOM_OUT = 0.55;      // how far PAST "fit the whole world" you can pull the camera back (pure view — lets you see the full field + spawns with margin, drones no longer hug the screen edge; does NOT change the playfield)
  // ── tiny synthesized SFX engine (no assets) — used for the cinematic warp-into-base jump ──
  const Sfx = {
    ctx: null, nb: null,
    ac() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) { this.ctx = null; } return this.ctx; },
    noise() { const a = this.ctx; if (!a) return null; if (!this.nb) { const n = a.sampleRate * 2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.nb = b; } const s = a.createBufferSource(); s.buffer = this.nb; s.loop = true; return s; },
    swoosh(dur) { if (!opt("sound")) return; const a = this.ac(); if (!a) return; const t0 = a.currentTime, s = this.noise(); if (!s) return; const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(2800, t0); bp.frequency.exponentialRampToValueAtTime(180, t0 + dur); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(bp).connect(g).connect(a.destination); s.start(t0); s.stop(t0 + dur + 0.05); },   // descending "drop out of hyperspace" whoosh
    warp(dur) {
      if (!opt("sound")) return; const a = this.ac(); if (!a) return; const t0 = a.currentTime, dest = a.destination;
      const tube = this.noise(); if (tube) { const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.3; bp.frequency.setValueAtTime(180, t0); bp.frequency.exponentialRampToValueAtTime(3200, t0 + dur * 0.82); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.34, t0 + dur * 0.78); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.96); tube.connect(bp).connect(g).connect(dest); tube.start(t0); tube.stop(t0 + dur); }
      const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(55, t0); o.frequency.exponentialRampToValueAtTime(440, t0 + dur * 0.8); const og = a.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.11, t0 + dur * 0.75); og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.9); o.connect(og).connect(dest); o.start(t0); o.stop(t0 + dur * 0.95);
      const tb = t0 + dur * 0.8;   // BOOM at the punch
      const bo = a.createOscillator(); bo.type = "sine"; bo.frequency.setValueAtTime(170, tb); bo.frequency.exponentialRampToValueAtTime(38, tb + 0.5); const bg = a.createGain(); bg.gain.setValueAtTime(0.0001, tb); bg.gain.exponentialRampToValueAtTime(0.55, tb + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, tb + 0.6); bo.connect(bg).connect(dest); bo.start(tb); bo.stop(tb + 0.62);
      const tr = this.noise(); if (tr) { const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400; const ng = a.createGain(); ng.gain.setValueAtTime(0.3, tb); ng.gain.exponentialRampToValueAtTime(0.0001, tb + 0.2); tr.connect(hp).connect(ng).connect(dest); tr.start(tb); tr.stop(tb + 0.22); }
      const tl = t0 + dur;   // landing rumble
      const ro = a.createOscillator(); ro.type = "sine"; ro.frequency.setValueAtTime(58, tl); ro.frequency.exponentialRampToValueAtTime(26, tl + 0.7); const rg = a.createGain(); rg.gain.setValueAtTime(0.0001, tl); rg.gain.exponentialRampToValueAtTime(0.4, tl + 0.05); rg.gain.exponentialRampToValueAtTime(0.0001, tl + 0.85); ro.connect(rg).connect(dest); ro.start(tl); ro.stop(tl + 0.88);
    }
  };

  const FMT_U = ["", "K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"];
  const FMT_CAP = Math.pow(1000, FMT_U.length);   // first magnitude past the last suffix (1e36) → switch to scientific
  function fmt(n) {
    if (n == null || isNaN(n)) return "0";
    if (!isFinite(n)) return n < 0 ? "-∞" : "∞";
    const neg = n < 0; let a = neg ? -n : n;
    if (a < 1000) return (neg ? "-" : "") + (a | 0).toString();
    const sci = (META && META.opts && META.opts.notation === "sci");
    if (sci || a >= FMT_CAP) {   // scientific: forced by the setting, or auto when it gets crazy (beyond the suffix table)
      const e = Math.floor(Math.log10(a)), m = a / Math.pow(10, e);
      return (neg ? "-" : "") + m.toFixed(2) + "e" + e;
    }
    let i = 0; while (a >= 1000 && i < FMT_U.length - 1) { a /= 1000; i++; }
    return (neg ? "-" : "") + (a < 10 ? a.toFixed(2) : a < 100 ? a.toFixed(1) : Math.floor(a)) + FMT_U[i];
  }
  function fmtTime(s) { s |= 0; const h = s / 3600 | 0, m = s % 3600 / 60 | 0, x = s % 60; return h ? h + "h " + m + "m" : m ? m + "m " + x + "s" : x + "s"; }

  /* ----------------------- defender unit types ------------------- */
  // Each class has a NICHE: vsBig = bonus damage to armored/tanky dots, vsSwarm =
  // bonus to weak/small/fast dots. So mixing classes beats stacking one.
  const DEF_TYPES = {
    turret:  { name: "Turret",  base: 60,     gal: 1,  dmg: 5,   rate: 1.4, range: 240, splash: 0,  max: 4, vsBig: 1.0, vsSwarm: 1.0, niche: "all-rounder — steady single-target backbone" },
    mortar:  { name: "Mortar",  base: 500,    gal: 2,  dmg: 64,  rate: 0.3, range: 215, splash: 95, max: 4, vsBig: 1.1, vsSwarm: 2.2, lob: 1, niche: "artillery — heavy arcing bombs (up to 2/s with its tree), devastating splash over a wide blast" },
    plasma:  { name: "Plasma",  base: 4000,   gal: 5,  dmg: 26,  rate: 0.5, range: 320, splash: 0,  max: 4, vsBig: 2.4, vsSwarm: 0.8, niche: "heavy bolts — melts tanky dots" },
    laser:   { name: "Laser",   base: 30000,  gal: 8,  dmg: 3,   rate: 4.2, range: 230, splash: 0,  max: 4, vsBig: 0.7, vsSwarm: 2.6, niche: "rapid beam — vaporizes fast/weak swarms" },
    railgun: { name: "Railgun", base: 250000, gal: 11, dmg: 90,  rate: 0.3, range: 430, splash: 0,  max: 4, vsBig: 4.0, vsSwarm: 0.6, niche: "huge slugs — anti-armor sniper" },
    nova:    { name: "Nova",    base: 4.0e6,  gal: 14, dmg: 340, rate: 0.5, range: 380, splash: 72, max: 4, vsBig: 3.2, vsSwarm: 1.0, niche: "void bombardment — Erebus-forged, splash that clears whole clusters (its power is the blast, not a per-dot swarm bonus)" },
  };
  const DEF_ORDER = ["turret", "mortar", "plasma", "laser", "railgun", "nova"];
  /* ----------------------- collector types ----------------------- */
  // Collectors gather the cash orbs dots drop. Like defenders they come in
  // classes you buy more of, each with its OWN skill tree. "hole" mode = a
  // black-hole vacuum that slowly drags every orb (and nearby dots) inward.
  const COL_TYPES = {
    drone:       { name: "Drone",          base: 60,         gal: 1,  speed: 88,  suction: 38,  collect: 9,  yield: 1.0, cap: 2,  mode: "chase", sides: 4, max: 4 },
    swarm:       { name: "Drone Swarm",    base: 9000,       gal: 3,  speed: 150, suction: 60,  collect: 13, yield: 1.2, cap: 3,  mode: "swarm", sides: 3, max: 2 },
    collector:   { name: "Heavy Collector",base: 120000,     gal: 6,  speed: 110, suction: 86,  collect: 20, yield: 1.5, cap: 3,  mode: "chase", sides: 6, max: 2 },
    magnet:      { name: "Magnet Rig",     base: 1800000,    gal: 9,  speed: 140, suction: 120, collect: 26, yield: 1.9, cap: 4,  mode: "chase", sides: 5, max: 2 },
    tractor:     { name: "Tractor Array",  base: 26000000,   gal: 11, speed: 130, suction: 170, collect: 34, yield: 2.3, cap: 4,  mode: "chase", sides: 8, max: 2 },
    singularity: { name: "Black Hole",     base: 350000000,  gal: 13, speed: 48,  suction: 450, collect: 46, yield: 2.8, cap: 6,  mode: "hole",  sides: 0, max: 2 },
    wormhole:    { name: "Wormhole",       base: 5.0e9,      gal: 16, speed: 64,  suction: 650, collect: 64, yield: 3.4, cap: 8,  mode: "hole",  sides: 0, max: 2 },   // base bays cut (m2): Capacity now STARTS as a real throttle you must upgrade. Base suction raised (m4) so a fresh hole already covers a real chunk of the field instead of a tiny circle.
  };
  const COL_ORDER = ["drone", "swarm", "collector", "magnet", "tractor", "singularity", "wormhole"];
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
  const unitBuyCost = type => Math.ceil(eco(S.galaxy) * (UNIT_FACTOR[type] || 40) * BUY_MUL * Math.pow(1.5, countType(type)) * pk().cost);   // planet-local, geometric in count — ~5× the old cost, so the LAST unit lands only when you're in the billions; × Ascension cost-reduction perk
  // ---- class skill tree: an interconnected node MAP. Each class allocates
  // nodes outward from a start node; a node can only be taken once a CONNECTED
  // node is already allocated. Aggregated bonuses live in derived.cls[type].
  const DEF_PRIM = ["dmg", "rate", "range", "int"], COL_PRIM = ["speed", "suction", "collect", "capacity"];
  // BESPOKE per-class primaries — a hook for giving a class a different wing layout.
  // The Mortar starts as a slow artillery piece (one heavy bomb every few seconds) but
  // its fire-rate wing lets it climb to a 2/s cap (uRate) — a hard-hitting 0.5s splasher,
  // never a machine gun. Its blast radius still scales via the range wing + its big base.
  const DEF_PRIM_BY = { mortar: ["dmg", "rate", "range", "int"] };   // mortar shares the standard dmg/rate/range/Mind wings; the 2/s cap in uRate keeps it artillery, not a turret
  const dPrim = type => DEF_PRIM_BY[type] || DEF_PRIM;
  // Tree nodes add a FLAT bonus that STACKS ADDITIVELY — a stat's multiplier is
  // 1 + (sum of its nodes' bonuses). Bonuses do NOT compound off each other, so
  // deep trees scale LINEARLY (no exponential runaway), and because each new node
  // is a smaller share of a growing total, the effect naturally tapers — early
  // nodes feel strong, late nodes are incremental.
  // mul/rate/speed/suction/ingest bonuses are FRACTIONS (0.4 = +40%); range/collect
  // are flat distances; crit is flat chance.
  // Defender baseline (turret = tier 1). Later classes scale UP via DEF_SCALE, so a
  // gal-7 Railgun tree is FAR stronger per node than a gal-1 Turret — "scaled correctly."
  const MAG_DEF = { mul: { min: 1.75, maj: 4.9, key: 12.6 }, rate: { min: 1.5, maj: 3.375, key: 8.25 }, range: { min: 16, maj: 42, key: 95 }, crit: { min: 0.05, maj: 0.12, key: 0.25 }, int: { min: 0.03, maj: 0.07, key: 0.14 }, splash: { min: 0.22, maj: 0.55, key: 1.3 } };   // crit/int magnitudes retuned DOWN so a full wing lands near its cap (0.85 / 1.0) instead of 3-7× over — every node counts; crit excess past 85% becomes bonus crit DAMAGE (see uCritMul)   // splash = +% blast RADIUS per node (mortar only), flat (not class-scaled) — area grows with the square so it's potent   // DMG (mul) calmed ×0.7 (250→175% minor), FIRE RATE calmed ×0.75 (200→150% minor) at every tier — same shape, "a bit more than half", so spawn-rate/value aren't out-bottlenecked. range = flat px/node; int = "Mind" smarter targeting (additive toward fully-smart=1)
  const DEF_SCALE = { turret: 1.0, mortar: 1.4, plasma: 1.5, laser: 1.6, railgun: 1.7, nova: 1.8 };   // COMPRESSED (was up to 4.2) so later classes aren't strictly dominant; nodeCost now also rides DEF_SCALE so stronger nodes cost proportionally — classes are sidegrades, not strict upgrades
  // Collectors are pure LOGISTICS (no income multiplier — yield lives in Economy):
  // Speed = chase movement, Reach (collect) = gather RADIUS / engagement gate (cReach),
  // Pull (suction) = reel STRENGTH that hauls engaged orbs to the mouth (cPull),
  // Ingest = how fast it swallows what reaches the mouth, Capacity = parallel maw bays.
  // Process (ingest) is a STRONG per-node lever — +100% / +200% / +400% — so a full
  // Process wing makes even heavy loot vanish. capacity = how many loot orbs a collector
  // PROCESSES at once (parallel maw bays): a multiplier on the (now low) base bay count.
  // m2 fix: base bays cut + Capacity magnitudes slashed (+12% / +28% / +60% per node) so
  // Capacity is a SLOW, meaningful upgrade you genuinely need — start throttled, climb to a
  // sensible max (~tens of bays maxed, not hundreds), instead of an instant over-provision.
  const MAG_COL = { speed: { min: 0.5, maj: 1.1, key: 2.2 }, suction: { min: 0.2, maj: 0.4, key: 0.8 }, collect: { min: 0.2, maj: 0.45, key: 1.0 }, capacity: { min: 0.12, maj: 0.28, key: 0.6 }, ingest: { min: 1.0, maj: 2.0, key: 4.0 } };   // suction (Pull) = reel-STRENGTH multiplier; collect (Reach) = gather-RADIUS multiplier (both now %-style); past their caps → yield (cYield) so no node is wasted   // speed/suction/reach magnitudes calmed ~3-4× so a wing is a gradual CLIMB to its cap, not a 1-2-node instant-cap; whatever a maxed wing pushes PAST the hard cap converts to collection yield (see cYield) so no logistics node is ever wasted — robust to the 3× base-speed variance across collectors
  const allocCount = type => { const m = S.classNodes[type]; let n = 0; if (m) for (const k in m) if (m[k]) n++; return n; };
  // Mind (int) normalizer: a FULL Mind wing should add up to exactly 1.0 (100%) and never over,
  // regardless of how many int nodes a given class's tree happens to have. We scale every int node
  // by 1 / (raw int total of the whole tree), so 100% int = fully-allocated Mind, no waste, no overflow.
  const _intScale = {};
  function intScale(type) {
    if (_intScale[type] != null) return _intScale[type];
    const G = buildTree(type), prim = dPrim(type); let sum = 0;
    for (const id in G.map) { const n = G.map[id]; if (!n.slots) continue; for (const s of n.slots) if (s.p !== "x" && prim[s.p - 1] === "int") sum += MAG_DEF.int[s.mag]; }
    return _intScale[type] = sum > 0 ? 1 / sum : 1;
  }
  function slotAmt(type, s) {
    if (isCol(type)) {
      if (s.p === "x") return MAG_COL.ingest[s.mag];                 // x branch = ingestion speed
      return MAG_COL[COL_PRIM[s.p - 1]][s.mag];                      // speed / suction / collect (reach)
    }
    const sc = DEF_SCALE[type] || 1;
    if (s.p === "x") return MAG_DEF.crit[s.mag];                        // crit = flat chance, not tier-scaled
    const key = dPrim(type)[s.p - 1];
    if (key === "range") return MAG_DEF.range[s.mag];                   // range = flat distance, not scaled
    if (key === "int") return MAG_DEF.int[s.mag] * intScale(type);      // intelligence — normalized so a FULL Mind wing = exactly 100% (never over)
    if (key === "splash") return MAG_DEF.splash[s.mag];                 // blast radius = flat % bonus, not class-scaled (mortar)
    return (key === "rate" ? MAG_DEF.rate[s.mag] : MAG_DEF.mul[s.mag]) * sc;   // dmg/rate bonuses scale by class tier
  }
  function classStats(type) {
    const col = isCol(type), prim = col ? COL_PRIM : dPrim(type);
    const o = { dmg: 1, rate: 1, range: 0, crit: 0, int: 0, splash: 1, speed: 1, suction: 1, yield: 1, collect: 1, capacity: 1, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0,
      n: { dmg: 0, rate: 0, range: 0, int: 0, crit: 0, splash: 0, speed: 0, suction: 0, collect: 0, capacity: 0, ingest: 0 } };   // n = allocated-node count per branch, drives the per-upgrade visual marks
    const A = S.classNodes[type], G = buildTree(type);
    if (A) for (const id in A) { if (!A[id]) continue; const n = G.map[id]; if (!n || !n.slots) continue;
      if (n.kind === "key") { if (col) { o.capacity += 0.6; o.suction += 0.4; } else { o.multi++; if (n.spec) o[n.spec]++; } }   // defender keystone = +1 multishot + ✦ spec; collector keystone = ✦ +60% parallel bays & +40% pull (its transformative payoff)
      // Every bonus ADDS (sums linearly) — nothing compounds, so no runaway.
      for (const s of n.slots) { const amt = slotAmt(type, s), key = s.p === "x" ? (col ? "ingest" : "crit") : prim[s.p - 1];
        o[key] += amt; if (o.n[key] != null) o.n[key]++; } }
    o.multi = Math.min(o.multi, 9);   // raised 6→9 so railgun(8)/nova(9) keystones all contribute (no wasted "+1 multishot")
    if (!col) o.int = Math.min(1, o.int);   // Mind hard-caps at 100% — a full wing lands exactly there (see intScale); no overflow, no crit cascade
    return o;
  }
  const ZERO = { dmg: 1, rate: 1, range: 0, crit: 0, int: 0, splash: 1, speed: 1, suction: 1, yield: 1, collect: 1, capacity: 1, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0, n: { dmg: 0, rate: 0, range: 0, int: 0, crit: 0, splash: 0, speed: 0, suction: 0, collect: 0, capacity: 0, ingest: 0 } };
  const uMulti = u => cls(u.type).multi || 0;
  const uInt = u => cls(u.type).int || 0;   // intelligence: 0 = dumb, ~1 = perfect overkill-avoidance & coordination
  const cls = type => (derived.cls && derived.cls[type]) || ZERO;
  const uDmg = u => DEF_TYPES[u.type].dmg * cls(u.type).dmg * pk().dmg;   // × permanent Ascension damage perk
  const uRate = u => { const r = DEF_TYPES[u.type].rate * cls(u.type).rate * pk().rate * (frenzyT > 0 ? 5 : 1); return u.type === "mortar" ? Math.min(2, r) : r; };   // Frenzy = 5× fire rate; × Ascension rate perk; mortar HARD-CAPPED at 2/s (every 0.5s) even after perks — heavy arcing bombs, never a machine gun
  const uRange = u => DEF_TYPES[u.type].range + cls(u.type).range + pk().range;
  const uCrit = u => Math.min(0.85, cls(u.type).crit + pk().crit);   // + permanent Ascension crit perk (still hard-capped at 0.85; excess → crit damage via uCritMul)
  const uCritMul = u => 2.2 + Math.max(0, cls(u.type).crit - 0.85) * 0.8;   // crit chance hard-caps at 0.85, but a deeper crit wing isn't wasted: every point of crit past the cap converts to bonus crit DAMAGE — heavy-crit specialists hit harder instead of overflowing into nothing
  const uSplash = u => DEF_TYPES[u.type].splash ? (DEF_TYPES[u.type].splash + cls(u.type).range * 0.4) * (cls(u.type).splash || 1) : 0;   // blast radius grows with the dedicated splash wing (mortar)
  // ✦ keystone SPECIALIZATIONS (BTD-style transformations) — counts of allocated keystones of each kind
  const uExplode = u => cls(u.type).explosive || 0;   // shots detonate (splash) — "bomb tower"
  const uChain   = u => cls(u.type).chain || 0;        // shots arc to nearby dots — "chain lightning"
  const uPierce  = u => cls(u.type).pierce || 0;        // shot becomes a piercing beam — "laser lance"
  const SPEC_NAME = { explosive: "Explosive Rounds", chain: "Chain Lightning", pierce: "Piercing Laser" };
  const SPECS = ["explosive", "chain", "pierce"];
  // Each defender has a SIGNATURE specialization its keystones all reinforce (stacking
  // = stronger), matching its niche: bombs for the splash class, beams for the snipers…
  const CLASS_SPEC = { turret: "chain", mortar: "explosive", plasma: "chain", laser: "pierce", railgun: "pierce", nova: "explosive" };
  // Speed is capped so a maxed Speed tree makes collectors fast & agile, not so
  // fast they teleport PAST orbs (which used to zero out collection). Suction
  // (the pull/ring radius) is capped well under the field so collectors must keep
  // roaming to cover it — they never become stationary field-wide magnets. The
  // black hole keeps its huge reach.
  const cSpeed   = type => Math.min(900, COL_TYPES[type].speed * cls(type).speed);
  // REACH = gather RADIUS (the engagement gate): base radius (the well-tuned old pull base) × the Reach wing.
  // Any orb inside cReach is locked on and reeled toward the collector. Capped so a collector still roams.
  const REACH_CAP = type => COL_TYPES[type].mode === "hole" ? 900 : 240;
  const cReach   = type => Math.min(REACH_CAP(type), COL_TYPES[type].suction * cls(type).collect);
  // PULL = drag STRENGTH (×1 at base): how fast an engaged orb is reeled to the mouth. Applied to the reel
  // force at the orb site; heavy/armored loot drags slowly, so Pull matters most for fat orbs & big Reach.
  const cPull    = type => cls(type).suction;
  const MOUTH    = 16;   // fixed grab distance: once an orb is reeled within MOUTH it starts being consumed (Process/Capacity take over)
  const cIngest  = type => cls(type).ingest;                 // how fast loot is swallowed (x branch); big loot benefits most
  const cCapacity = type => Math.max(1, Math.round(COL_TYPES[type].cap * cls(type).capacity));   // how many orbs it processes in parallel (bays); low base × the slow Capacity wing — a real throttle you upgrade (m2)
  const colOverYield = type => {   // logistics points pushed PAST a hard cap (speed/pull/reach) convert to collection yield, so no logistics node is ever wasted even with the 3× base-speed variance across collectors; under-cap stats simply benefit from raw value
    const c = cls(type), B = COL_TYPES[type], sucCap = B.mode === "hole" ? 900 : 240;
    const over = (val, cap) => Math.max(0, val / cap - 1);
    const r = over(B.speed * c.speed, 900) + over(B.suction * c.collect, sucCap);   // Speed & Reach-radius past their caps convert to yield; Pull is an uncapped reel force, so it's never wasted
    return 1 + Math.min(0.4, r * 0.06);   // BOUNDED: a fully-maxed logistics build adds at most +40% yield, and only by heavily over-investing past the caps
  };
  const cYield   = type => COL_TYPES[type].yield   * cls(type).yield * colOverYield(type) * pk().yield;   // gather efficiency × overcap-yield × permanent Ascension yield perk. (Conquest multiplier was removed; orb value no longer carries it, so income is applied cleanly once here.)
  const AGILITY = 0.12;

  // flavour names: one pool per stat branch (a/b/c) plus the extra 'x' branch.
  // every node — even the small passives — pulls a distinct name from its pool.
  const SKILLS = {
    turret:  { a: ["Reinforced Rounds", "Tungsten Core", "Armor Piercing", "Hollow Points", "Overcharge", "Heavy Slugs", "Devastator"], b: ["Quick Hands", "Belt Feed", "Rapid Servos", "Hair Trigger", "Double Tap", "Cyclic Bolt", "Gatling Drive"], c: ["Scope", "Range Finder", "Laser Sight", "Tracking AI", "Eagle Eye", "Long Barrel", "Hawkeye"], d: ["Targeting Chip", "Threat Sense", "Kill Tracker", "Fire Discipline", "Combat Logic", "Squad Link", "Tactical Core"], x: ["Critical Core", "Deadeye", "Killshot"] },
    mortar:  { a: ["Bigger Shells", "Dense Payload", "Thermobaric", "Heavy Ordnance", "Tungsten Casing", "Bunker Buster", "Doomshell"], b: ["Wider Blast", "Shrapnel Load", "Airburst", "Saturation", "Cluster Munitions", "Wide Arc", "Fuel-Air Bomb"], c: ["Spotter", "Long Tube", "Range Tables", "High Angle", "Forward Spotter", "Extended Charge", "Bullseye"], d: ["Fire Plan", "Spotter Net", "Impact Sense", "Salvo Logic", "Forward Observer", "Battery Link", "Strike Command"], x: ["Shell Shock", "Pinpoint", "Devastation"] },
    plasma:  { a: ["Ion Charge", "Superheated", "Fusion Core", "Antimatter", "Singularity Bolt", "Plasma Surge", "Star Core"], b: ["Capacitor", "Coolant Loop", "Overclock", "Rapid Cycle", "Continuous Beam", "Supercooled", "Flux Drive"], c: ["Focusing Lens", "Long Barrel", "Crit Matrix", "Targeting Array", "Lancer", "Beam Optics", "Far Sight"], d: ["Logic Core", "Heuristics", "Threat Model", "Predict Engine", "Sentience", "Neural Mesh", "Mind Lattice"], x: ["Crit Core", "Overcharge Cell", "Meltdown"] },
    laser:   { a: ["Amplifier", "Focused Beam", "Burning Ray", "Photon Surge", "Death Ray", "Hot Lens", "Sunfire"], b: ["Pulse Rate", "Rapid Emitter", "Resonance", "Overdrive", "Constant Stream", "Fast Cycle", "Lightstorm"], c: ["Mirror Array", "Extended Optics", "Heat Seeker", "Crit Lens", "Prism Split", "Wide Mirror", "True Aim"], d: ["Tracking AI", "Scan Logic", "Priority Lock", "Predictive Aim", "Swarm Sense", "Hunter Net", "Omniscience"], x: ["Crit Focus", "Focal Point", "Vaporize"] },
    railgun: { a: ["Mag Core", "Hypervelocity", "Depleted Slug", "Mass Driver", "Annihilator", "Tungsten Rod", "Worldbreaker"], b: ["Quick Charge", "Capacitor Bank", "Auto-Rack", "Rapid Rail", "Salvo", "Fast Coil", "Volley"], c: ["Long Rail", "Calibration", "Piercing Round", "Crit Targeting", "Railstorm", "Extended Rail", "Dead Centre"], d: ["Fire Solution", "Ballistic AI", "Target Lock", "Lead Computer", "Kill Predictor", "War Mind", "Oracle Core"], x: ["Crit Lock", "Penetrator", "One Shot"] },
    nova:    { a: ["Void Charge", "Dark Matter", "Collapsed Core", "Singularity Shell", "Entropy Warhead", "Null Lance", "Annihilation"], b: ["Rift Cycle", "Warp Loader", "Phase Battery", "Rapid Rift", "Continuous Void", "Fast Collapse", "Eventstorm"], c: ["Deep Sight", "Void Optics", "Far Rift", "Gravity Lens", "Horizon Scope", "Long Reach", "Omni-Sight"], d: ["Void Logic", "Star Sense", "Threat Horizon", "Cosmic Predict", "Astral Mind", "Nebula Net", "Cosmic Oracle"], x: ["Critical Void", "Dead Star", "Supernova"] },
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
    wormhole:    { a: ["Throat Tune", "Rift Drive", "Phase Jump", "Warp Frame", "Lightfold", "Quick Fold", "Hyperfold"], b: ["Deep Throat", "Wide Maw", "Spacetime Pull", "Crushing Well", "Infinite Draw", "Gravity Sink", "Cosmic Pull"], c: ["Event Reach", "Wide Horizon", "Long Throat", "Deep Grip", "Vast Reach", "Rift Latch", "Maw Spread"], d: ["Twin Throat", "Extra Well", "Triple Maw", "Parallel Rifts", "Multi-Fold", "Rift Bank", "Devour Array"], x: ["Rift Maw", "Void Vault", "Spacetime Mill", "Tidal Render", "Hawking Forge", "Fast Render", "Wormhole Core"] },
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
    "The hearth-world. Dense clouds and richer payouts — feed your Mortars.",
    "Azure tides. Reinforced dots demand real damage — Plasma ignites.",
    "Verdant sprawl. Relentless waves — Plasma cuts through.",
    "Cobalt deep. High-value specials surface far more often.",
    "Stormwinds. Chaotic, dense spawns — Lasers shred them.",
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
  const uColor = u => u.type === "mortar" ? "#9a9a9a" : (u.type === "turret" || u.type === "nova") ? "#ffffff" : "#cccccc";   // nova glows bright white like the endgame weapon it is
  // Defenders auto-arrange into a tidy, centred formation that re-racks itself
  // as you buy more — like beer-pong cups: a lone unit sits centre, a handful
  // form a neat ring, more fill concentric rings (the last ring always spread
  // evenly), so 5 and 50 read as different but equally organised shapes.
  let _form = { sig: null, pts: [] };
  // Defenders arrange by COMPOSITION: each type forms its own centred, evenly-spaced row, and the rows
  // stack symmetrically around the field centre. So 4 turrets + 2 mortars reads as a row of 4 over a row
  // of 2 (each centred → left/right symmetric), distinct from any other mix — tidy, balanced, legible.
  function unitFormation() {
    const sig = S.units.map(u => u.type).join(",");
    if (_form.sig === sig) return _form.pts;
    const byType = {}; S.units.forEach((u, i) => { (byType[u.type] || (byType[u.type] = [])).push(i); });
    const rows = DEF_ORDER.filter(t => byType[t]).map(t => byType[t]);   // one row per present type, in canonical order
    const pts = new Array(S.units.length).fill(null);
    const SX = 60, SY = 64, totalH = (rows.length - 1) * SY;             // even gaps; whole block vertically centred
    rows.forEach((idxs, r) => {
      const y = -totalH / 2 + r * SY, w = (idxs.length - 1) * SX;        // each row horizontally centred → symmetric
      idxs.forEach((ui, k) => { pts[ui] = { x: -w / 2 + k * SX, y }; });
    });
    _form = { sig, pts };
    return pts;
  }
  function unitPos(i) { const p = unitFormation()[i] || { x: 0, y: 0 }; return { x: W / 2 + p.x, y: H / 2 + p.y }; }

  /* ----------------------- drone + economy upgrades -------------- */
  const UPS = [
    { id: "capacity",  tab: "eco", name: "Capacity",   base: 20, mul: 1.55, desc: () => curSym(S.galaxy) + " " + fmt(derived.capacity) },
    { id: "value",     tab: "eco", name: "Value",      base: 30, mul: 1.42, desc: () => "×" + derived.valueMul.toFixed(2) + " /dot" },
    { id: "spawnRate", tab: "eco", name: "Spawn Rate", base: 64, mul: 1.55, desc: () => { const raw = derived.spawnPerSec || 0, om = spawnOver(raw); return raw.toFixed(1) + " /s" + (om > 1.02 ? "  ·  ~" + spawnVis(raw).toFixed(0) + "/s on screen + ×" + om.toFixed(1) + " tougher" : ""); } },
    { id: "luck",      tab: "eco", name: "Luck",       base: 70, mul: 1.28, desc: () => (derived.luck * 100).toFixed(1) + "% special" },
  ];
  const UP = {}; UPS.forEach(u => UP[u.id] = u);
  const upCost = u => Math.ceil(eco(S.galaxy) * 2 * BUY_MUL * Math.pow(u.mul, S.lv[u.id] || 0) * pk().cost);   // planet-local: ~5× slower than before, grows by mul; × Ascension cost-reduction perk

  // Travel is a hard, escalating wall tuned to the (deliberately slow) income ramp:
  // ~1 day to set up + bank the first jump, ramping gently (≈×3.2/planet) to a few
  // days each by the late planets.
  // Launching an expedition costs a sum scaling with the planet's economy (NOT your bank ceiling — so you
  // can't dodge it by keeping capacity low). It rides eco(g) exactly like your income does, so it stays a
  // ~constant ~8–15% slice of a planet's earnings on every world. (The old ×1.2^g escalator was balanced
  // against the now-removed Conquest multiplier's ×1.8^g income growth; with Conquest gone it would make
  // late-planet travel unaffordable, so it's dropped.)
  const TRAVEL_COST_K = 5e6;
  const travelCost = g => { g = g || S.galaxy; return Math.round(eco(g) * TRAVEL_COST_K); };
  // HYBRID DIFFICULTY (see diff/eco below): each planet's NUMBER-MAGNITUDE rides eco(g) — income AND
  // costs both ride it, so it cancels and the per-planet loop has the same shape everywhere. What does
  // NOT cancel is enemyHpMul: dots get genuinely tankier per planet (and ~double at each new solar
  // system), the COMBAT wall a fresh fleet feels on landing — you out-grow it with more units & deeper trees.
  const enemyHpMul = g => Math.pow(diff(g), 0.4);       // dampened difficulty → dots tankier per planet (in-planet Value ramps them further)
  const galSpawnMul = g => 1;                           // flat base spawn (you raise it in-planet with Spawn Rate)
  const galCap = g => 400;                              // flat field cap
  // SOFT spawn ceiling. Below SPAWN_SMOOTH/sec dots spawn 1:1 with Spawn Rate. Above it, the on-screen
  // count keeps GROWING (so Spawn Rate is never pointless) but gently tapered — only ~25% of the extra
  // rate becomes new bodies, the other ~75% becomes per-dot TOUGHNESS. So the field has room to breathe
  // (no instant 1:1 respawn wall) yet every Spawn-Rate level still visibly adds dots AND beef.
  const SPAWN_SMOOTH = 26, SPAWN_PASS = 0.25;
  const spawnVis = raw => raw <= SPAWN_SMOOTH ? raw : SPAWN_SMOOTH + (raw - SPAWN_SMOOTH) * SPAWN_PASS;   // visible dots/sec (soft-capped)
  const spawnOver = raw => { const v = spawnVis(raw); return raw > v ? Math.min(Math.pow(raw / v, 0.69), 8) : 1; };   // un-spawned share → toughness (income-neutral vs the old uncapped spawn)

  /* ====================== PLANET LAYERS (per-planet economy) ======================
     Each planet has its OWN currency and is its OWN fresh run. eco(g) is that planet's
     natural currency scale (what a plain dot drops there), so EVERY cost is rebased to
     eco(g): a planet plays the same shape in bigger numbers. Conquer a planet -> it joins
     your BACKGROUND empire, earning its currency passively (online + offline) at the rate
     you left it; revisit to upgrade it. The EXCHANGE converts any planet's currency into
     the one you're spending now, so a fresh landing is a running start, never a grind. */
  // GLOBAL MONEY SCALE — the single root every cash number rides (eco(g) = CUR_BASE × diff(g), and the
  // starter purse, costs, dot drops, capacity and conquer targets all key off eco). Lower it and ALL money
  // scales down uniformly; because income AND costs ride it equally, pacing/conquer-times are unchanged.
  // At 2.5 you LAND with ~$100, first upgrade ~$25, plain dots drop a couple bucks — a humble idle start
  // that grows to billions+. (Bump it for bigger headline numbers; it only moves the decimal point.)
  const CUR_BASE = 2.5;
  // Each planet's currency has its OWN seeded magnitude (distinct, non-uniform) on top of the ×2.2 ladder.
  // conquerTarget AND income both ride eco(g), so this per-planet bump CANCELS in time-to-conquer — pacing
  // is provably unchanged; it only makes each planet's numbers feel unique and its starting purse distinct.
  // Each planet's currency is worth MORE than the previous — by a SEEDED, varying step (×1.6…×2.8), so the
  // magnitudes are distinct/non-uniform yet ALWAYS climbing. conquerTarget AND income both ride eco(g), so
  // the steps cancel in time-to-conquer — pacing is provably unchanged.
  // HYBRID DIFFICULTY: ONE global currency, but each planet's NUMBER-MAGNITUDE scales by difficulty.
  // Inside a solar system difficulty creeps up gently (WITHIN_STEP); crossing into a NEW system it
  // JUMPS (SYS_JUMP) and dots get genuinely tankier. The steamroll/wall FEEL now comes from the
  // designed conquer-time curve (SYS_ACTIVE_HOURS: each system eases ~24h→12h, then the next system's
  // first planet spikes back to ~24h) — three power-fantasy arcs, one per solar system.
  const SYS_JUMP = 6.0, WITHIN_STEP = 1.5;
  const diff = g => { g = Math.max(1, Math.min(g, TOTAL_PLANETS)); let v = 1; for (let k = 2; k <= g; k++) v *= (PLANET_LOCAL[planetIdx(k)] === 0 ? SYS_JUMP : WITHIN_STEP); return v; };
  const eco = g => CUR_BASE * diff(g);   // planet number-magnitude (single global currency; costs & drops BOTH ride this so it cancels — progression now is class unlocks, deeper trees & the idle empire)
  const startMul = g => 40;              // flat fresh-landing starter purse (× eco(g)) — you rebuild from scratch on every planet
  // ONE global currency now — no per-planet money, no exchange. (kept as helpers so existing call-sites resolve.)
  const curName = g => "Credits";
  const curSym  = g => "✦";
  const curWorth = g => eco(g);
  // CONQUER-TIME CURVE — designed ACTIVE-play hours per planet: a gentle steamroll DOWN within a solar
  // system, then a JUMP back UP crossing into a new system (the wall), declining again. These are the
  // wall-clock hours an engaged active player (brushing + abilities + upgrades) should spend per planet.
  // DESIGN: every planet sits in the 12–24h active band. Crossing into a NEW solar system SPIKES its
  // first planet back up to the hard end (~24h — "goes hard again"); within a system each successive
  // planet is easier, easing down toward ~12h (the steamroll). Helios opens gentler (the tutorial system,
  // no wall to cross into it) and still eases to 12h.
  const SYS_ACTIVE_HOURS = [
    [16, 14, 13, 12],                       // Helios (4) — gentle intro, eases to 12h
    [24, 20, 17, 15, 13, 12],               // Cygnus (6) — WALL: spikes to 24h, eases to 12h
    [24, 22, 20, 18, 16, 14, 13, 12],       // Erebus (8) — WALL: spikes to 24h, eases to 12h
  ];
  const DESIRED_HOURS = [0]; SYS_ACTIVE_HOURS.forEach(a => a.forEach(h => DESIRED_HOURS.push(h)));
  const conquerHours = g => { const h = DESIRED_HOURS[Math.max(1, Math.min(g | 0, TOTAL_PLANETS))] || 8; return (g | 0) === 1 ? h / 3 : h; };   // planet 1 is made 3× easier — a gentler first conquer (target scales linearly with this, so /3 = 1/3 the work)
  // The target is anchored to your real INCOME so the active TIME actually lands on the curve above. Real
  // active brushing income does NOT just track eco·Conquest — each planet you also unlock more classes and
  // afford deeper trees, so measured income compounds an EXTRA ~BUILD× per planet on top. We model that with
  // a geometric build-power term; without it the target can't keep pace and late planets balloon to days.
  // A small live-empire term is added so a fat idle empire can't trivialise the conquest. Idle income is a
  // fraction of active, so idle takes longer; the empire "carries" you toward the next world over time.
  const ACTIVE_REF = 727;    // measured active $/s on planet 1 per (eco-unit × Conquest) — anchors the curve level so a fully-active player lands on SYS_ACTIVE_HOURS (calibrated to the ~8.6× active-vs-idle gap, see sims)
  // BUILD = 1.0: real measured income (full playthrough/active sims) is gated by the on-screen SPAWN CAP, so
  // extra DPS from class unlocks + deeper trees does NOT compound income across planets — income tracks
  // eco·Conquest, which already rides eco(g)·conquest in the target and cancels. A BUILD>1 here inflated the
  // target ~×2.15/planet with no matching income, which is what made late conquer-times balloon to years.
  const BUILD = 1.0;         // per-planet income compounding beyond eco·Conquest — measured ≈1 (spawn-capped), so no extra inflation
  const EMPIRE_W = 0.8;      // how strongly the live idle empire inflates the target (keeps idle from trivialising a conquest)
  const buildPow = g => Math.pow(BUILD, Math.max(0, (g | 0) - 1));
  const baseTarget = g => conquerHours(g) * 3600 * ACTIVE_REF * buildPow(g) * eco(g) * (S.conquest || 1);   // income-model part (no empire) — also drives idle bgRate, so the empire never feeds back on itself
  const conquerTarget = g => Math.ceil(baseTarget(g));   // P4: the target is now the pure income-model only. The idle empire no longer INFLATES the target; instead its bar-fill is CAPPED at IDLE_FRAC of active (see the empire feed in the loop), which stops idle trivialising a conquest without the old feedback term. (EMPIRE_W retained for reference / easy revert.)
  // CONQUEST MULTIPLIER — REMOVED. CONQ_STEP = 1.0 means conquering a planet no longer grants a permanent
  // income multiplier (S.conquest stays 1 forever, so derived.incomeMul / capacity / conquerTarget are all
  // unaffected by it). Conquering still UNLOCKS travel and grows the idle empire (EMPIRE_RAMP) — that's the
  // progression now. Pacing is unchanged because the old multiplier rode BOTH income and the conquer target,
  // so it cancelled out of conquer-time anyway. (Set back to 1.8 to restore the multiplier.)
  const CONQ_STEP = 1.0;
  const BG_EFF = 0.4;                                                // (legacy) live-rate fraction — superseded by the target-based idle below
  // IDLE EMPIRE — a conquered planet keeps earning for you while you're away on another world. Its
  // idle rate is a fraction of ITS OWN conquest cost (so it auto-scales with the difficulty curve and the
  // whole difficulty curve), and the entire empire's idle output RAMPS UP the more planets you hold.
  // So early planets are an active grind, but by lategame your empire can largely IDLE you to the
  // next conquest — you don't have to hand-manage all 18 worlds.
  const IDLE_PAYBACK_H = 26;    // left alone, a conquered planet repays its own conquest cost in ~26h of pure idle (before the ramp)
  const EMPIRE_RAMP = 0.30;     // every planet you hold boosts ALL your planets' idle output by +30% (empire snowball)
  // P4 fix — how fast the idle empire can fill the CONQUER BAR of the planet you're on, as a fraction of the
  // designed ACTIVE income rate. Capping it here is what stops idle from out-pacing active play late game: the
  // empire still fully funds your TREASURY (your cash), but it can only push the conquer bar at ≤ IDLE_FRAC of
  // active speed — so pure-idle conquest takes ~1/IDLE_FRAC × the designed active hours (a real help, never a
  // replacement for playing). Active play stacks ON TOP, so playing is always clearly faster.
  const IDLE_FRAC = 0.00;       // empire funds your TREASURY (cash) at full rate but does NOT auto-fill the conquer bar — so the 10%-active playthrough lands on its ~60-day design target and idle can never out-pace playing. Raise this (e.g. 0.05–0.12) to let a fully-AFK empire also chip the conquer bar (idle finishes faster, 10%-active drops below 60d).
  const conqueredCount = () => { let c = 0; if (S.vault) for (const k in S.vault) if (S.vault[k] && S.vault[k].conquered) c++; return c; };
  const empireIdleRate = () => {   // live total idle income from conquered, NON-active planets, with the empire ramp applied
    if (!S.vault) return 0; let sum = 0;
    for (const k in S.vault) { if (+k === S.galaxy) continue; const v = S.vault[k]; if (v && v.conquered && v.bgRate > 0) sum += v.bgRate; }
    return sum * (1 + EMPIRE_RAMP * conqueredCount()) * pk().empire;
  };
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
  // per-class buy-cost factors (× eco(active) × 1.5^count) — keeps class differentiation but planet-local
  const UNIT_FACTOR = { turret: 10, mortar: 26, plasma: 70, laser: 150, railgun: 360, nova: 820, drone: 10, swarm: 26, collector: 70, magnet: 150, tractor: 320, singularity: 650, wormhole: 1150 };
  // Income now comes from THROUGHPUT — killing more, tougher, more-rewarding dots —
  // not a collector yield multiplier. DROP_BASE is the cash a plain dot drops;
  // TOUGH_POW makes reward scale SUPER-linearly with a dot's toughness, so tanky
  // dots & armored elites pay disproportionately more (rewarding turret damage to
  // kill them and stronger drones to haul the bigger loot).
  const DROP_BASE = CUR_BASE;   // a plain dot drops one eco-unit of the planet's currency (must match eco's base)
  const TOUGH_POW = 1.45;
  const ORB_LIFE = 12;                                  // orbs vanish if collectors can't keep up (some loss is intended tension; raised 9→12 so it's not chronic)
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
    return { cash: Math.floor(eco(1) * startMul(1)), galaxy: 1, lv, classNodes, units: [newUnit("turret")], collectors: [{ type: "drone" }], totalRun: 0, peakGalaxy: 1, runSec: 0, vault: {}, travel: null, imported: {}, conquest: 1, victory: false, auto: defaultAuto() };
  }
  // trim a unit/collector list down to each type's max (enforces caps on load)
  function capList(list) { const c = {}, out = []; for (const u of list || []) { const t = u.type; if (!TY(t)) continue; const m = TY(t).max; c[t] = (c[t] || 0) + 1; if (c[t] <= m) out.push(u); } return out; }   // DROP unknown types (a renamed/removed class in an old save would otherwise crash on the first tick via DEF_TYPES[t].x)
  function freshStats() {
    const kills = {}; DEF_ORDER.forEach(t => kills[t] = 0); kills.draw = 0; kills.blackhole = 0;
    const collected = {}; COL_ORDER.forEach(t => collected[t] = 0);
    return { playSec: 0, dotsPopped: 0, specials: 0, armored: 0, kills, collected, abilities: { frenzy: 0, dotrain: 0, blackhole: 0 }, travels: 0, lost: 0, lostCash: 0 };
  }
  function freshOpts() { return { sound: true, haptics: true, shake: true, flash: true, fx: "full", notation: "short" }; }   // player settings (persist in META)
  function freshMeta() { return { totalEver: 0, stats: freshStats(), opts: freshOpts(), gems: 0, gemsEarned: 0, perks: {}, tutorialDone: false }; }   // gems + Ascension perks persist across planets for the whole run
  const opt = k => (META && META.opts ? META.opts[k] : freshOpts()[k]);
  function vibe(ms) { if (opt("haptics") && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }
  const stat = () => META.stats;

  let dots = [], orbs = [], beams = [], shells = [], drones = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0, curEarned = 0, bossAcc = 0;
  let drawing = false, lastDraw = null, trail = [], selUnit = -1, selType = "turret";
  // ---- juice: particles, screen shake, flash, floating cash ----
  let parts = [], shake = 0, flash = 0, fxEarn = 0, fxEarnT = 0, fxEarnX = 0, fxEarnY = 0, veilT = 0, landT = 0, fxAcc = 0;
  const VEIL_FADE = 0.6;   // seconds for the zoom-into-base white-wipe to fade back out after landing
  const LAND_DUR = 0.85;   // camera pull-back "you have arrived" settle after the warp lands
  const MAXP = 440;
  function burst(x, y, n, spd, sz) { const fx = opt("fx"); if (fx === "off") return; if (fx === "low") n = Math.max(1, Math.ceil(n * 0.4)); if (parts.length > MAXP) return; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = spd * (0.35 + Math.random() * 0.9);
    if (Math.random() < 0.4) parts.push({ t: 4, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.35, max: 0.65, ang: a, len: sz * 2 + Math.random() * sz * 2, spin: (Math.random() - 0.5) * 12 });  // shard
    else parts.push({ t: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.32 + Math.random() * 0.36, max: 0.7, r: sz * (0.5 + Math.random()) }); } }
  function ring(x, y, r0, r1, life) { if (opt("fx") === "off" || parts.length > MAXP) return; parts.push({ t: 1, x, y, r: r0, r1, life, max: life }); }
  function floatTxt(x, y, txt) { if (parts.length > MAXP) return; parts.push({ t: 2, x, y, vy: -40, life: 0.95, max: 0.95, txt }); }
  function spark(x, y) { if (opt("fx") === "off" || parts.length > MAXP) return; parts.push({ t: 3, x, y, life: 0.22, max: 0.22 }); }
  function shakeAdd(a) { shake = Math.min(4.5, shake + a); }   // capped low so dense late-game kills can't pin the screen into a constant rattle
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
  let autoAcc = 0;   // fractional auto-buy budget carried between frames
  let autoExpanded = null;   // Set of planet indices currently expanded in the all-planets Auto-Buy overview
  const ABIL_CD = { frenzy: 45, dotrain: 40, blackhole: 60 };
  let activeTab = "def", listRows = {}, tabBtns = {};
  const BUY_AMTS = [1, 10, 100, "max"];               // bulk-buy multipliers (test mode) — cycled by the BUY ×N button
  let buyIdx = 0;                                      // index into BUY_AMTS
  const buyN = () => BUY_AMTS[buyIdx] === "max" ? 100000 : BUY_AMTS[buyIdx];   // "max" = buy until unaffordable/maxed

  /* ---- ASCENSION: a PERMANENT, cross-planet perk tree bought with Gems ----
     Skill trees reset every planet; this does NOT. You earn a few Gems per planet
     CONQUERED and spend them on small, global, one-time perks that persist for the
     whole run (stored in META). Costs are tiered: Tier I = 1 gem, II = 2, III = 3.
     Bonuses are deliberately SMALL (a gentle edge, not a power spike) and the tree
     is bigger than 18 planets' worth of gems, so it's never fully finishable yet. */
  const PERK_LINES = [
    { key: "dmg",    ico: "swords",    name: "Weapon Calibration", kind: "mul",  word: "damage",             v: [0.05, 0.08, 0.12] },
    { key: "rate",   ico: "bolt",      name: "Autoloaders",        kind: "mul",  word: "fire rate",          v: [0.05, 0.08, 0.12] },
    { key: "crit",   ico: "spark",     name: "Targeting Logic",    kind: "pct",  word: "crit chance",        v: [0.03, 0.04, 0.06] },
    { key: "range",  ico: "rocket",    name: "Sensor Range",       kind: "flat", word: "range",              v: [12, 20, 30] },
    { key: "value",  ico: "coin",      name: "Bounty Networks",    kind: "mul",  word: "cash value",         v: [0.02, 0.02, 0.03] },
    { key: "cost",   ico: "gear",      name: "War Economy",        kind: "cost", word: "upgrade costs",      v: [0.02, 0.03, 0.04] },
    { key: "yield",  ico: "collector", name: "Salvage Refits",     kind: "mul",  word: "collector yield",    v: [0.02, 0.03, 0.04] },
    { key: "spawn",  ico: "rain",      name: "Provocation",        kind: "mul",  word: "spawn rate",         v: [0.02, 0.02, 0.03] },
    { key: "empire", ico: "castle",    name: "Empire Logistics",   kind: "mul",  word: "idle empire income", v: [0.03, 0.04, 0.05] },
    { key: "luck",   ico: "star4",     name: "Fortune",            kind: "pct",  word: "rare-dot luck",      v: [0.04, 0.06, 0.10] },
    { key: "gem",    ico: "gem",       name: "Gem Resonance",      kind: "flat", word: "gem per conquer",    v: [null, null, 1] },
  ];
  const TIER_NUM = ["", "I", "II", "III"];
  const PERKS = [];
  PERK_LINES.forEach(line => { for (let t = 1; t <= 3; t++) { const amt = line.v[t - 1]; if (amt == null) continue;
    PERKS.push({ id: line.key + t, tier: t, cost: t, key: line.key, kind: line.kind, ico: line.ico, word: line.word, name: line.name + " " + TIER_NUM[t], amt }); } });
  const PERK_BY = {}; PERKS.forEach(p => PERK_BY[p.id] = p);
  const PERK0 = { dmg: 1, rate: 1, value: 1, cost: 1, yield: 1, spawn: 1, empire: 1, crit: 0, range: 0, luck: 0, gem: 0 };
  const pk = () => derived.perk || PERK0;                                   // current aggregated perk bonuses (1× / +0 defaults before first recompute)
  const perkOwned = id => !!(META && META.perks && META.perks[id]);
  const tierOwned = t => { let n = 0; for (const p of PERKS) if (p.tier === t && perkOwned(p.id)) n++; return n; };
  const tierOpen = t => t === 1 || (t === 2 && tierOwned(1) >= 4) || (t === 3 && tierOwned(2) >= 4);   // a tier unlocks once you own 4 of the previous tier
  function perkAgg() {                                                      // fold all owned perks into one multiplier/offset bundle
    const a = { dmg: 1, rate: 1, value: 1, cost: 1, yield: 1, spawn: 1, empire: 1, crit: 0, range: 0, luck: 0, gem: 0 };
    const own = (META && META.perks) || {};
    for (const p of PERKS) { if (!own[p.id]) continue;
      if (p.kind === "cost") a.cost *= (1 - p.amt);                         // cost reduction stacks multiplicatively, can't hit 0
      else if (p.kind === "mul") a[p.key] *= (1 + p.amt);
      else a[p.key] += p.amt; }                                            // pct (crit/luck) + flat (range/gem) are additive
    return a;
  }
  const perkFx = p => p.key === "range" ? "+" + p.amt + " range"
    : p.key === "gem" ? "+" + p.amt + " gem / conquer"
    : (p.kind === "cost" ? "−" : "+") + Math.round(p.amt * 100) + "% " + p.word;
  const gemReward = g => 2 + Math.floor((g - 1) / 6) + (pk().gem || 0);     // "a few" gems per conquer, gently scaling with depth, + any Gem Resonance

  function recompute() {
    const L = S.lv, m = META;
    derived.perk = perkAgg();                                           // FIRST — valueMul/spawn/luck below read it via pk()
    derived.incomeMul = S.conquest || 1;               // Conquest multiplier — REMOVED (CONQ_STEP=1 keeps S.conquest=1), so this is always 1 / inert. Plumbing kept so it's reversible.
    derived.capacity = eco(S.galaxy) * 220 * Math.pow(1.60, L.capacity) * (S.conquest || 1);   // cash ceiling scales with difficulty AND conquest so it never lags your income
    derived.valueMul = (1 + 0.08 * L.value) * pk().value;          // FLAT +8% cash per level (additive — no compounding/runaway); also drives dot "menace". × small permanent Ascension value perk.
    // Spawn Rate: each level wants +2 dots/sec. But the field caps at galCap (400) dots, so past a
    // soft cap the screen can't hold more — instead of wasting the upgrade, the surplus "spills over"
    // into MENACE: every dot spawns tougher & (via TOUGH_POW) worth disproportionately more. So Spawn
    // Rate keeps paying off even with a full screen, exactly like Value never caps out.
    const rawSpawn = (0.9 + 2.0 * L.spawnRate) * pk().spawn;
    derived.spawnPerSec = rawSpawn;                                           // FULL benefit — the field cap limits count, so if you kill fast you just get flooded with more dots
    derived.spawnSurplus = Math.max(0, rawSpawn - 12);                        // rate beyond the field's comfortable throughput — becomes MENACE, but only while the field is actually saturated
    if (derived.spawnMenace == null) derived.spawnMenace = 1;                 // live value, updated each frame from real field fullness in the spawn loop
    derived.luck = Math.min(0.6, 0.003 * L.luck + pk().luck);    // +0.3% chance of a rare 9× SPECIAL dot per Luck level (buffed from 0.1% — was a trap stat vs Value) + Ascension Fortune perk
    derived.cls = {}; for (const t of ALL_TYPES) derived.cls[t] = classStats(t);
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v3";   // bumped for the v3 economy (single global currency + Conquest multiplier) — old saves start fresh on the new model
  let wiping = false;
  function save() { if (wiping) return; try { if (S && S.vault) { const v = S.vault[S.galaxy] || (S.vault[S.galaxy] = { conquered: false, earned: 0, bgRate: 0 }); v.earned = curEarned; } localStorage.setItem(KEY, JSON.stringify({ S, META, ts: Date.now(), cps })); } catch (e) {} }
  function wipeSave() { wiping = true; try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }
  function load() {
    S = fresh(); META = freshMeta(); let off = null, offSmall = 0;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {}); if (!S.units || !S.units.length) S.units = [newUnit("turret")]; S.units.forEach(u => { u.cd = u.cd || 0; }); if (!S.classNodes || typeof S.classNodes !== "object") S.classNodes = {}; ALL_TYPES.forEach(t => { if (!S.classNodes[t]) S.classNodes[t] = {}; }); if (!Array.isArray(S.collectors) || !S.collectors.length) { const n = 1 + (d.S.lv && d.S.lv.drones || 0); S.collectors = []; for (let i = 0; i < n; i++) S.collectors.push({ type: "drone" }); } S.units = capList(S.units); S.collectors = capList(S.collectors); }
        if (d.META) { META = Object.assign(freshMeta(), d.META);
          const st = d.META.stats || {}; META.stats = Object.assign(freshStats(), st);
          META.stats.kills = Object.assign(freshStats().kills, st.kills || {});
          META.stats.collected = Object.assign(freshStats().collected, st.collected || {});
          META.stats.abilities = Object.assign({ frenzy: 0, dotrain: 0, blackhole: 0 }, st.abilities || {});
          META.opts = Object.assign(freshOpts(), d.META.opts || {});
          META.gems = +d.META.gems || 0; META.gemsEarned = +d.META.gemsEarned || 0; META.perks = (d.META.perks && typeof d.META.perks === "object") ? d.META.perks : {}; }
        if (d.ts) { const e = clamp((Date.now() - d.ts) / 1000, 0, 12 * 3600);
          // everything you earned while away: your active rate (half-credited) + the idle empire
          const offGain = d.cps > 0 ? Math.floor(d.cps * e * 0.5) : 0;
          const bg = S.vault ? empireIdleRate() : 0, offIdle = bg > 0 ? bg * e : 0, offTotal = offGain + offIdle;
          if (offTotal > 0) { S.totalRun += offTotal; META.totalEver += offTotal;
            // offline ALSO advances the active planet's conquer bar (mirrors the live loop), capped at the
            // target — so progress doesn't stall just because the tab was closed. Picked up by curEarned below.
            const pmv = S.vault && (S.vault[S.galaxy] || (S.vault[S.galaxy] = { conquered: false, earned: 0, bgRate: 0 }));
            if (pmv && !pmv.conquered) pmv.earned = Math.min(conquerTarget(S.galaxy), (pmv.earned || 0) + offTotal);
            if (e >= 60) off = { gain: Math.floor(offTotal), elapsed: e, pool: offTotal };   // hold the pool; auto-buy spends it after recompute (below)
            else offSmall = offTotal; }   // <60s: defer to the capacity-clamped add after recompute (was S.cash += offTotal, which bypassed the cap → reload-grind exploit)
          if (S.travel && S.travel.dur) S.travel.t = (S.travel.t || 0) + Math.max(0, (Date.now() - d.ts) / 1000);   // expedition keeps travelling while away (uncapped — long trips must finish)
        }
      }
    } catch (e) {}
    if (!S.vault) S.vault = {};
    if (!S.imported) S.imported = {};
    ensureAuto();
    curEarned = (S.vault[S.galaxy] && S.vault[S.galaxy].earned) || 0;
    recompute();
    if (offSmall > 0) S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + offSmall));   // short-session offline gain, now capacity-clamped
    if (off) {
      if (off.pool != null) {   // simulate auto-buy spending the banked away-budget, then bank what's left (clamped)
        const r = autoBuyOffline(off.pool); recompute();
        off.autoBought = r.bought; off.spent = off.pool - r.leftover;
        S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + r.leftover)); delete off.pool;
      } else { S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + off.gain)); }
      S._welcome = off;
    }
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
  // niche = which weapon class hard-counters this race (the per-planet rock-paper-scissors):
  //   "swarm" → rapid-fire (Mortar/Laser get vsSwarm); "armor" → heavy hits (Plasma/Railgun/Nova get vsBig);
  //   "balanced" → no class bonus (raw DPS / the all-rounder Turret). EVERY race is tagged so no world
  //   silently defaults to "anti-armor" via the toughness-tier fallback (which only covers plain/elite dots now).
  const RACES = [
    null,
    { p: 1,  key: "swift",     name: "Vesta Motes",      niche: "swarm",    hp: 0.55, val: 1.7, weight: 1.0, speed: 3.0 },                    // fast, fragile, pays extra
    { p: 2,  key: "zigzag",    name: "Ember Sparks",     niche: "swarm",    hp: 0.7,  val: 1.5, weight: 1.0, speed: 2.2, zig: 1 },            // erratic, jukes around
    { p: 3,  key: "splitter",  name: "Cinder Brood",     niche: "swarm",    hp: 1.1,  val: 1.0, weight: 1.0, splits: 2, maxGen: 3 },          // splits into many fragments → clear the flood
    { p: 4,  key: "grower",    name: "Hearth Bloat",     niche: "swarm",    hp: 1.2,  val: 1.3, weight: 0.9, grow: 1 },                       // swells over time → clear fast before it bloats
    { p: 5,  key: "shield",    name: "Azure Bastion",    niche: "armor",    hp: 1.0,  val: 1.5, weight: 0.9, shield: 0.7, reflect: 0.3 },     // front shield soaks/reflects → punch through
    { p: 6,  key: "healer",    name: "Verdant Mender",   niche: "armor",    hp: 1.0,  val: 1.6, weight: 0.8, regen: 0.018, healAura: 1 },      // heals → out-burst the regen
    { p: 7,  key: "orbiter",   name: "Cobalt Sentinel",  niche: "armor",    hp: 1.3,  val: 1.5, weight: 0.8, sat: 3, satGuard: 1 },           // guarded core → heavy hits
    { p: 8,  key: "flock",     name: "Mistral Gale",     niche: "swarm",    hp: 0.7,  val: 1.4, weight: 1.0, speed: 1.7, flock: 1 },          // flocks together (boids)
    { p: 9,  key: "cloak",     name: "Halcyon Mirage",   niche: "swarm",    hp: 1.0,  val: 1.9, weight: 0.8, cloak: 1 },                      // evasive → rapid fire catches its visible windows
    { p: 10, key: "pulsar",    name: "Tempest Cell",     niche: "armor",    hp: 1.5,  val: 1.7, weight: 0.7, pulse: 1, shock: 1 },            // tanky disruptor → heavy hits
    { p: 11, key: "phantom",   name: "Umbral Shade",     niche: "swarm",    hp: 1.2,  val: 2.0, weight: 0.7, phase: 1 },                      // phases out → rapid fire to land hits between phases
    { p: 12, key: "juggernaut",name: "Frost Glacian",    niche: "armor",    hp: 1.9,  val: 1.8, weight: 0.7, speed: 0.7, armorUp: 1 },        // heavy tank that regrows armor
    { p: 13, key: "reflector", name: "Onyx Warden",      niche: "armor",    hp: 1.4,  val: 1.9, weight: 0.7, deflect: 0.45 },                 // deflects a share of every shot → fewer, bigger hits
    { p: 14, key: "blink",     name: "Wraith",           niche: "swarm",    hp: 1.1,  val: 2.2, weight: 0.7, blink: 1 },                      // teleports → rapid fire to catch it
    { p: 15, key: "bomber",    name: "Pyreling",         niche: "balanced", hp: 1.3,  val: 1.8, weight: 0.7, bomb: 1 },                       // loot-scatter gimmick, no damage-type weakness
    { p: 16, key: "gravity",   name: "Abyssal Pull",     niche: "armor",    hp: 1.6,  val: 2.0, weight: 0.7, gravity: 1 },                    // tanky loot-dragger → heavy hits
    { p: 17, key: "leech",     name: "Devourer",         niche: "armor",    hp: 1.5,  val: 1.9, weight: 0.7, leech: 1 },                      // heals off loot → out-burst it
    { p: 18, key: "spawner",   name: "Null Spawn",       niche: "swarm",    hp: 2.0,  val: 2.2, weight: 0.6, spawner: 1 },                    // floods minions → clear the swarm
  ];
  const raceAt = g => RACES[Math.min(Math.max(g, 1), RACES.length - 1)];
  // PER-PLANET DOT SIGNATURE — every world's dots get a distinct silhouette (polygon sides),
  // grayscale shade and centre glyph, so they read differently planet-to-planet (no 6-planet
  // repeat). sides 0 = circle. glyph: 0 none·1 ring·2 dot·3 cross·4 bars·5 bar·6 tri·7 square·8 X·9 diamond.
  const DOT_LOOK = [null,
    { s: 0, sh: 60, g: 0, r: 0 },                 // 1  Vesta — plain mote
    { s: 3, sh: 73, g: 2, r: -Math.PI / 2 },      // 2  Ember — up-triangle, cored
    { s: 4, sh: 50, g: 1, r: Math.PI / 4 },       // 3  Cinder — diamond, ringed
    { s: 6, sh: 82, g: 4, r: 0 },                 // 4  Hearth — bright hex, barred
    { s: 5, sh: 46, g: 3, r: -Math.PI / 2 },      // 5  Azure — pentagon, crossed
    { s: 0, sh: 88, g: 5, r: 0 },                 // 6  Verdant — bright circle, slit
    { s: 8, sh: 56, g: 1, r: 0 },                 // 7  Cobalt — octagon, ringed
    { s: 3, sh: 77, g: 6, r: Math.PI / 2 },       // 8  Mistral — down-triangle
    { s: 6, sh: 42, g: 2, r: Math.PI / 6 },       // 9  Halcyon — dim hex, cored
    { s: 4, sh: 84, g: 7, r: 0 },                 // 10 Tempest — square, boxed
    { s: 5, sh: 39, g: 3, r: Math.PI / 5 },       // 11 Umbra — dark pentagon
    { s: 6, sh: 68, g: 8, r: 0 },                 // 12 Frost — hex, X
    { s: 8, sh: 35, g: 4, r: Math.PI / 8 },       // 13 Onyx — dark octagon, barred
    { s: 3, sh: 75, g: 9, r: -Math.PI / 2 },      // 14 Wraith — triangle, diamond core
    { s: 7, sh: 52, g: 2, r: 0 },                 // 15 Pyre — heptagon
    { s: 4, sh: 33, g: 8, r: Math.PI / 4 },       // 16 Abyss — dark diamond, X
    { s: 9, sh: 63, g: 1, r: 0 },                 // 17 Maw — nonagon, ringed
    { s: 5, sh: 31, g: 9, r: Math.PI / 10 },      // 18 Oblivion — darkest pentagon
  ];
  const dotLook = g => DOT_LOOK[Math.min(Math.max(g | 0, 1), DOT_LOOK.length - 1)] || DOT_LOOK[1];
  // trace a regular-polygon (or circle) body path of radius r
  function dotBodyPath(c, x, y, r, sides, rot) {
    c.beginPath();
    if (sides < 3) { c.arc(x, y, r, 0, TAU); return; }
    for (let k = 0; k < sides; k++) { const a = rot + k / sides * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
  }
  // draw the per-planet centre glyph (cut into the body in black so it reads on any shade)
  function dotGlyph(c, x, y, r, gly) {
    if (!gly || r < 4) return; const u = r * 0.42; c.strokeStyle = "#000"; c.fillStyle = "#000"; c.lineWidth = Math.max(1, r * 0.13);
    if (gly === 1) { c.beginPath(); c.arc(x, y, u, 0, TAU); c.stroke(); }
    else if (gly === 2) { c.beginPath(); c.arc(x, y, u * 0.7, 0, TAU); c.fill(); }
    else if (gly === 3) { c.beginPath(); c.moveTo(x - u, y); c.lineTo(x + u, y); c.moveTo(x, y - u); c.lineTo(x, y + u); c.stroke(); }
    else if (gly === 4) { c.beginPath(); c.moveTo(x - u, y - u * 0.45); c.lineTo(x + u, y - u * 0.45); c.moveTo(x - u, y + u * 0.45); c.lineTo(x + u, y + u * 0.45); c.stroke(); }
    else if (gly === 5) { c.beginPath(); c.moveTo(x, y - u); c.lineTo(x, y + u); c.stroke(); }
    else if (gly === 6) { c.beginPath(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k / 3 * TAU; k ? c.lineTo(x + Math.cos(a) * u, y + Math.sin(a) * u) : c.moveTo(x + Math.cos(a) * u, y + Math.sin(a) * u); } c.closePath(); c.fill(); }
    else if (gly === 7) { c.fillRect(x - u * 0.75, y - u * 0.75, u * 1.5, u * 1.5); }
    else if (gly === 8) { c.beginPath(); c.moveTo(x - u, y - u); c.lineTo(x + u, y + u); c.moveTo(x + u, y - u); c.lineTo(x - u, y + u); c.stroke(); }
    else if (gly === 9) { c.beginPath(); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU, px = x + Math.cos(a) * u, py = y + Math.sin(a) * u; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); }
  }
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
  // per-race recommended counter, shown on the planet card so the rock-paper-scissors is legible
  const NICHE_HINT = {
    swarm:    "weak to RAPID FIRE — Mortar & Laser shred them",
    armor:    "weak to HEAVY HITS — Plasma, Railgun & Nova punch through",
    balanced: "no damage-type weakness — bring raw firepower (Turret holds up)",
  };
  const raceNiche = g => (raceAt(g) || {}).niche || "balanced";
  const kindChance = g => Math.min(0.14 + 0.05 * (g - 1), 0.6);
  // ── MINI-BOSSES: one elite per planet, unique name & seeded design, every ~5 min of active play ──
  const BOSS_INTERVAL = 240;   // seconds of active (boss-free) play between bosses (was 600 — too rare to register in a 12–24h campaign)
  const BOSS_GEM_CHANCE = 0.01;   // a defeated mini-boss has a 1% chance to drop a Gem — kept LOW because a full active run kills thousands of bosses, so 5% flooded the Ascension economy (tree maxed with a huge wasted surplus); 1% keeps gems meaningful
  const BOSS_NODE_CHANCE = 0.15;  // …and a 15% chance to grant ONE free skill node. Otherwise it's just the cash bounty (the common case). No more "3 free nodes every boss".
  const BOSS_NAMES = ["Dustmaw", "Arcfiend", "Slagtitan", "Cinderlord", "Tidewretch", "Sporemother", "Cobalt Sentinel", "Galereaver", "Glimmertyrant", "Voltaic Colossus", "Umbral Dread", "Rimewarden", "Shardbreaker", "Wispcaller", "Ashen Behemoth", "Voidstone Idol", "Bilewurm", "The Null King"];
  const bossName = g => BOSS_NAMES[Math.min(Math.max(g, 1), 18) - 1] || "Boss";
  // auto-allocate up to n FREE skill-tree nodes, spread across the classes you currently field (boss reward).
  function grantTreeNodes(n) {
    const owned = [...new Set([...S.units.map(u => u.type), ...S.collectors.map(c => c.type)])];
    let granted = 0, guard = 0;
    while (granted < n && guard++ < 80) {
      let any = false;
      for (const t of owned) {
        if (granted >= n) break;
        const G = buildTree(t), set = S.classNodes[t] || (S.classNodes[t] = {});
        const cand = Object.values(G.map).find(node => node.id !== "start" && !set[node.id] && nodeAllocatable(t, node));
        if (cand) { set[cand.id] = true; granted++; any = true; }
      }
      if (!any) break;
    }
    return granted;
  }
  function spawnBoss() {
    const g = S.galaxy, vm = derived.valueMul, base = 18 * Math.pow(vm, 1.3);
    let dps = 0; for (const u of S.units) dps += uDmg(u) * DEF_TYPES[u.type].rate * cls(u.type).rate;   // size HP to your real firepower → a ~minute+ fight, scales with you
    const hp = Math.max(base * 30, dps * 60);
    const r = clamp(40 + Math.log10(hp + 10) * 2.4, 42, 60);
    const val = Math.max(1, Math.round(eco(g) * vm * derived.incomeMul * 320));   // PHAT bounty for a hard, timed kill
    // each planet's boss gets its OWN seeded movement personality (not the lazy drift-to-centre)
    const mh = Math.imul((g + 13) * 2654435761, 40503) >>> 0, mr = k => ((mh >>> (k * 4)) & 15) / 15;
    const styles = ["lissajous", "orbit", "charge", "pace", "prowl", "dash"];
    dots.push({ x: W / 2, y: H * 0.3, vx: rnd(-18, 18), vy: rnd(-8, 8), hp, maxHp: hp, value: val, value0: val,
      r, r0: r, tier: 6, spin: Math.random() * TAU, special: false, armored: true, kind: "boss", boss: true, bg: g, life: 0, ttl: 60,
      shieldMax: hp * 0.35, shield: hp * 0.35, armorUp: 0, regen: 0.012, add: 0,
      mstyle: styles[Math.floor(mr(0) * styles.length)], mt: 0, mphase: mr(1) * TAU, mfx: 0.5 + mr(2) * 0.9, mfy: 0.45 + mr(3) * 0.9, mdir: mr(4) < 0.5 ? -1 : 1, mrad: 95 + mr(5) * 75, mtimer: 0, mtx: W / 2, mty: H * 0.35, mdash: false,
      weight: 5, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#ffffff" });
    floatTxt(W / 2, H / 2 - 70, "▲ " + bossName(g) + " ▲"); flashAdd(0.55); shakeAdd(9);
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
      hp, maxHp: hp, value: val, value0: val, r, r0: r, tier, pg: g, menace: roll, spin: Math.random() * TAU, special, armored, kind, weight: armored ? 2.6 : 1, hit: 0, drawCd: 0, refl: 0, born: 0,
      color: armored ? "#9a9a9a" : special ? "#ffffff" : kind !== "normal" ? "#cfcfcf" : `hsl(0,0%,${dotLook(g).sh}%)` };   // per-planet shade (no 6-planet repeat)
    if (cfg) {
      d.niche = cfg.niche;                                       // this race's hard-counter category (drives the vsBig/vsSwarm class bonus in hitDot)
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
      // LOB weapons (mortar) DON'T shoot a straight beam — they fire a high arcing bomb that
      // sails over the field and detonates on landing, blanketing the impact point in splash.
      if (DEF_TYPES[u.type].lob) {
        const explode = uExplode(u), aoe = uSplash(u) + (explode ? 34 + explode * 26 : 0);
        shells.push({ x0: p.x, y0: p.y, tx: target.x, ty: target.y, t: 0,
          dur: clamp(0.34 + ddl / 820, 0.36, 0.78), arc: 30 + Math.min(ddl * 0.18, 90),
          dmg, aoe, crit, type: u.type, color: uColor(u),
          r: 3 + Math.min(Math.log10(uDmg(u) + 1) * 1.1, 5), spin: 0 });
        continue;
      }
      beams.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y, life: crit ? 0.13 : 0.08, color: uColor(u), w: (crit ? 3.5 : 2) + Math.min(Math.log10(uDmg(u) + 1) * 0.5, 3) });   // bolder beams with more damage
      if (crit) burst(target.x, target.y, 5, 90, 2);        // crit pops a little extra
      const explode = uExplode(u), aoe = uSplash(u) + (explode ? 34 + explode * 26 : 0);
      if (aoe > 0) {
        for (const d of dots) if (!d.dead && (d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= aoe * aoe) { d.pending = (d.pending || 0) + dmg; hitDot(d, dmg, u.type); }   // mark pending so overkill-avoidance (Mind) sees splash kills
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
          seen.add(best); best.pending = (best.pending || 0) + cdmg; hitDot(best, cdmg, u.type); src = best; cdmg *= 0.85;   // mark pending so Mind sees chain kills
        }
      }
      // ✦ Piercing Laser — punch a beam through every dot along the line of fire
      const pierce = uPierce(u);
      if (pierce > 0) {
        const nx = ddx / ddl, ny = ddy / ddl, width = 14 + pierce * 8, rngU = uRange(u);
        for (const d of dots) { if (d.dead || d === target) continue;
          const rx = d.x - p.x, ry = d.y - p.y, t = rx * nx + ry * ny; if (t < 0 || t > rngU) continue;
          if (Math.abs(rx * -ny + ry * nx) <= width + d.r) { d.pending = (d.pending || 0) + dmg * 0.85; hitDot(d, dmg * 0.85, u.type); } }   // mark pending so Mind sees pierce kills
        beams.push({ x1: p.x, y1: p.y, x2: p.x + nx * rngU, y2: p.y + ny * rngU, life: 0.09, color: "#fff", w: 2.5 });
      }
    }
  }
  // NICHE classification (the per-planet rock-paper-scissors). EVERY native race carries an explicit
  // d.niche ("swarm"/"armor"/"balanced") set at spawn, so the planet's signature race always rewards the
  // right class. Only un-tagged dots — plain greys, armored elites, spawner minions — fall back to the
  // toughness tier (small = swarm, tanky = big). This is what fixes the old "everything defaults to
  // anti-armor" collapse (the tier fallback used to catch all 11 untagged races and skew them big).
  function hitDot(d, dmg, src) {
    if (d.dead) return;
    const ty = DEF_TYPES[src];                                  // class NICHE: anti-armor (vsBig) vs anti-swarm (vsSwarm)
    if (ty) {
      let big = false, swarm = false;
      if (d.niche === "armor") big = true;                      // race-tagged tanky/defensive
      else if (d.niche === "swarm") swarm = true;               // race-tagged fast/many/evasive
      else if (d.niche === "balanced") { /* no class bonus — raw DPS */ }
      else { big = d.armored || (d.tier || 0) >= 3; swarm = !d.armored && (d.tier || 0) <= 1; }   // plain/elite/minion: by toughness
      if (big) dmg *= ty.vsBig; else if (swarm) dmg *= ty.vsSwarm;
    }
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
      if (d.boss) {   // a defeated mini-boss → a big cash bounty (the common drop) + a fat orb burst; RARELY a Gem (5%) or one free skill node (15%)
        const np = 6; for (let i = 0; i < np; i++) { const a = i / np * TAU; orbs.push({ x: d.x + Math.cos(a) * d.r * 0.6, y: d.y + Math.sin(a) * d.r * 0.6, value: Math.round(d.value / np), t: 0, weight: 2, consume: 0, consumeMax: 1.2, r0: 6.5, big: true }); }
        const lump = Math.round(d.value * 2);   // guaranteed instant bank (you can't miss the bounty even if orbs scatter)
        S.cash += lump; S.totalRun += lump; META.totalEver += lump; curEarned += lump;   // bounty bypasses the capacity ceiling so the reward always lands in full
        let bonus = "";                          // rare bonus on top of the cash bounty
        const roll = Math.random();
        if (roll < BOSS_GEM_CHANCE) { META.gems = (META.gems || 0) + 1; META.gemsEarned = (META.gemsEarned || 0) + 1; bonus = "  ·  ◈ +1 GEM!"; floatTxt(W / 2, H / 2 - 30, "◈ A GEM DROPPED — spend it in Ascension"); flashAdd(0.4); }
        else if (roll < BOSS_GEM_CHANCE + BOSS_NODE_CHANCE) { if (grantTreeNodes(1)) bonus = "  ·  ✦ +1 FREE NODE"; }
        burst(d.x, d.y, 60, 240, 3.4); ring(d.x, d.y, d.r, d.r + 150, 0.7); ring(d.x, d.y, d.r, d.r + 80, 0.5); shakeAdd(9); flashAdd(0.5);
        floatTxt(d.x, d.y - d.r - 12, "✦ " + bossName(d.bg || S.galaxy) + " DEFEATED");
        floatTxt(d.x, d.y - d.r - 30, "+" + curSym(S.galaxy) + " " + fmt(lump + d.value) + bonus);
        const sb = stat(); sb.dotsPopped++; sb.bosses = (sb.bosses || 0) + 1; if (src) sb.kills[src] = (sb.kills[src] || 0) + 1;
        recompute(); syncHUD();
        return;
      }
      // bigger / tougher kills drop heavier loot that takes longer to consume
      const big = d.armored || (d.tier || 0) >= 3, cmax = big ? 1.6 : ((d.tier || 0) >= 1 || d.r > 12 ? 0.55 : 0.1);
      orbs.push({ x: d.x, y: d.y, value: d.value, t: 0, weight: d.weight || 1, consume: 0, consumeMax: cmax, r0: big ? 6.5 : ((d.tier || 0) >= 1 ? 4 : 2.6), big });
      const s = stat(); s.dotsPopped++; if (d.special) s.specials++; if (d.armored) s.armored = (s.armored || 0) + 1; if (src) s.kills[src] = (s.kills[src] || 0) + 1;
      const nb = Math.min(28, 6 + (d.tier || 0) * 4 + (d.armored ? 8 : 0));
      burst(d.x, d.y, nb, 90 + (d.tier || 0) * 24 + (d.armored ? 60 : 0), 2 + (d.tier || 0) * 0.3);
      ring(d.x, d.y, d.r, d.r + 18 + (d.tier || 0) * 8, 0.3); if (d.armored) shakeAdd(0.5);   // only armored elites nudge the screen — tier-4+ became common late game and pinned the shake
      if (d.splits && (d.gen || 0) < (d.maxGen || 1) && dots.length < galCap(S.galaxy) + 40) for (let i = 0; i < d.splits; i++) {   // field-cap guard (with headroom) — consistent with other spawn sites; prevents a big splitter wave overshooting the cap
        const hp = d.maxHp * 0.42, cv = Math.max(1, Math.round(d.value * 0.4)), cr = Math.max(6, d.r * 0.66);
        dots.push({ x: d.x + rnd(-10, 10), y: d.y + rnd(-10, 10), vx: rnd(-50, 50), vy: rnd(-50, 50), hp, maxHp: hp,
          value: cv, value0: cv, r: cr, r0: cr, tier: 0, spin: 0, special: false, armored: false,
          kind: "splitter", niche: "swarm", splits: d.splits, maxGen: d.maxGen, gen: (d.gen || 0) + 1, weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: d.color });   // fragments stay anti-swarm like their parent
      }
      if (d.bomb) { ring(d.x, d.y, d.r, d.r + 75, 0.5); burst(d.x, d.y, 18, 170, 2.6); shakeAdd(1.0); flashAdd(0.12);
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
      const got = Math.max(1, Math.round(o.value));   // orb value already includes the Conquest multiplier (set at spawn) — do NOT multiply by incomeMul again (would be Conquest²)
      S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + got)); S.totalRun += got; META.totalEver += got; curEarned += got;
      fxEarn += got; fxEarnX = o.x; fxEarnY = o.y - 6; burst(o.x, o.y, o.big ? 9 : 5, 80, 2); spark(o.x, o.y);
      orbs.splice(i, 1);
    }
  }

  function useAbility(k) {
    if (abil[k] > 0 || state !== "play") return;
    abil[k] = ABIL_CD[k]; META.stats.abilities[k] = (META.stats.abilities[k] || 0) + 1; vibe(15);
    if (k === "frenzy") { frenzyT = 6; shakeAdd(3.5); flashAdd(0.3); ring(W / 2, H / 2, 30, Math.max(W, H) * 0.55, 0.5); }
    else if (k === "dotrain") { const n = 30 + S.galaxy * 8, cap = galCap(S.galaxy); for (let i = 0; i < n && dots.length < cap; i++) spawnDot(Math.random() < 0.3); shakeAdd(4); ring(W / 2, 70, 20, W * 0.55, 0.5); }   // respect the field cap so the flood doesn't overwhelm collectors into net loss
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
    autoBuyTick(dt);   // idle automation: spend cash on upgrades by your priority order

    const baseCap = galCap(S.galaxy);
    const sup = Math.min(derived.spawnSurplus || 0, 80);
    const rawRate = derived.spawnPerSec * galSpawnMul(S.galaxy);
    // SOFT-SMOOTHED SPAWNING. The field has room to BREATHE — a cleared screen refills as a gentle pulse,
    // not an instant 1:1 wall (that was the stutter). But Spawn Rate is never pointless: dots keep growing
    // with it (soft-capped via spawnVis), and the rest converts to per-dot TOUGHNESS (spawnOver, tuned
    // income-neutral). So every Spawn-Rate level still visibly adds bodies AND beef.
    const visRate = spawnVis(rawRate);
    const overflowMen = spawnOver(rawRate);
    const thin = clamp(1 - 0.011 * sup, 0.3, 1);                             // late game also THINS the standing count
    const cap = Math.max(50, Math.round(baseCap * thin));
    const sat = clamp((dots.length / cap - 0.6) / 0.4, 0, 1);                // extra toughness only if the field genuinely backs up (you can't keep up)
    const targetMenace = overflowMen * (1 + sat * 0.6);
    derived.spawnMenace += (targetMenace - derived.spawnMenace) * Math.min(1, dt * 2);   // smooth so it doesn't jitter
    spawnAcc += dt * visRate;
    let _spawned = 0; while (spawnAcc >= 1 && dots.length < cap && _spawned < 4) { spawnDot(); spawnAcc -= 1; _spawned++; }   // small per-frame cap softens bursts (no frame spike)
    if (spawnAcc > 4) spawnAcc = 4;                                          // tiny buffer — lets a cleared field release a gentle pulse, never a robotic one-at-a-time nor an instant wall
    // mini-boss: one at a time; timer only counts while no boss is on the field
    if (!dots.some(d => d.boss)) { bossAcc += dt; if (bossAcc >= BOSS_INTERVAL) { bossAcc = 0; spawnBoss(); } }

    // Black Hole crush scales with your fleet (over its 5s it deals ~0.6s of total fleet DPS to every
    // dragged dot) — a real crush that grows with investment but never trivially one-shots tanky lategame dots.
    const bhDmg = blackholeT > 0 ? S.units.reduce((s, u) => s + uDmg(u) * uRate(u), 0) * 0.12 : 0;
    for (const d of dots) {
      d.pending = 0; d.aimed = 0; if (d.born < 0.2) d.born += dt; d.spin += dt * 0.9;
      if (d.hit > 0) d.hit -= dt; if (d.drawCd > 0) d.drawCd -= dt; if (d.refl > 0) d.refl -= dt;
      if (d.boss) {
        d.life = (d.life || 0) + dt;
        if (d.life >= (d.ttl || 60)) { d.dead = true; burst(d.x, d.y, 30, 200, 2.6); ring(d.x, d.y, d.r, d.r + 130, 0.5); floatTxt(d.x, d.y - d.r - 12, "✕ " + bossName(d.bg || S.galaxy) + " ESCAPED"); flashAdd(0.3); shakeAdd(3); continue; }   // 1-MINUTE LIMIT — fails out with no reward if you can't bring it down in time
        d.add += dt; if (d.add > 6 && dots.length < cap - 2) { d.add = 0;   // boss summons a couple of adds to keep the pressure on
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
      if (d.cloak !== undefined) { d.cloak += dt; d.cloaked = (d.cloak % 3.0) < 1.0; }                                                                                                                    // Halcyon cloaks invisible ~33% of the time (was 47% — less frustrating to target)
      if (d.blink !== undefined) { d.blink += dt; if (d.blink > 1.6) { d.blink = 0; burst(d.x, d.y, 5, 50, 1.5); d.bx = d.x; d.by = d.y; d.x = clamp(d.x + rnd(-95, 95), 30, W - 30); d.y = clamp(d.y + rnd(-95, 95), 50, H - 130); } }   // Wraith teleports
      if (d.flock) { let ax = 0, ay = 0, cx = 0, cy = 0, n = 0; for (const o of dots) { if (o === d || !o.flock) continue; const dx = o.x - d.x, dy = o.y - d.y, q = dx * dx + dy * dy; if (q < 8100) { ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; n++; if (q < 676) { d.vx -= dx * 0.05; d.vy -= dy * 0.05; } } } if (n) { d.vx += (ax / n - d.vx) * 0.02 + (cx / n - d.x) * 0.004; d.vy += (ay / n - d.vy) * 0.02 + (cy / n - d.y) * 0.004; } }   // Mistral flocks (boids)
      if (d.gravity) for (const o of orbs) { const dx = d.x - o.x, dy = d.y - o.y, q = dx * dx + dy * dy; if (q < 19600) { const dl = Math.sqrt(q) || 1; o.x += dx / dl * 55 * dt; o.y += dy / dl * 55 * dt; } }   // Abyss drags loot away from collectors
      if (d.leech) for (let oi = orbs.length - 1; oi >= 0; oi--) { const o = orbs[oi], dx = d.x - o.x, dy = d.y - o.y, q = dx * dx + dy * dy; if (q < 12100) { const dl = Math.sqrt(q) || 1; o.x += dx / dl * 95 * dt; o.y += dy / dl * 95 * dt; if (q < (d.r + 8) ** 2) { d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.04); ring(d.x, d.y, d.r, d.r + 10, 0.3); META.stats.lost++; META.stats.lostCash += o.value; orbs.splice(oi, 1); } } }   // Devourer eats orbs & heals — softened (smaller/slower pull, less heal) so loot is contestable
      if (d.spawner !== undefined) { d.spawner += dt; if (d.spawner > 3.8 && dots.length < cap) { d.spawner = 0; const hp = d.maxHp * 0.18, mr = Math.max(5, d.r0 * 0.5); dots.push({ x: d.x + rnd(-14, 14), y: d.y + rnd(-14, 14), vx: rnd(-55, 55), vy: rnd(-55, 55), hp, maxHp: hp, value: Math.max(1, Math.round((d.value0 || d.value) * 0.18)), value0: 1, r: mr, r0: mr, tier: 0, spin: 0, special: false, armored: false, kind: "minion", weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#bbbbbb" }); burst(d.x, d.y, 4, 40, 1.2); } }   // Null Spawn births minions
      if (blackholeT > 0) { const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1; d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt; hitDot(d, bhDmg * dt, "blackhole"); }
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

    for (let i = 0; i < S.units.length; i++) { const u = S.units[i]; if (u.rx) { const dc = Math.exp(-dt * 16); u.rx *= dc; u.ry *= dc; } if (u.flash > 0) u.flash -= dt; u.cd -= dt; const period = 1 / uRate(u); const maxShots = Math.min(64, Math.max(1, Math.ceil(uRate(u) * dt) + 1)); let shots = 0; while (u.cd <= 0 && shots < maxShots) { fireUnit(u, unitPos(i, S.units.length)); u.cd += period; shots++; } if (u.cd < -period) u.cd = -period; }   // machine-gun: per-frame allowance scales with rate×dt so high fire rates (Laser, Frenzy) fully realize and stay FRAME-RATE-INDEPENDENT; debt floored so it can't spiral
    for (const b of beams) b.life -= dt; beams = beams.filter(b => b.life > 0);
    // arcing mortar bombs: fly their parabola, then detonate on landing (deferred splash).
    for (const sh of shells) {
      sh.t += dt; sh.spin += dt * 13;
      if (sh.t >= sh.dur) {
        sh.dead = true;
        const aoe = sh.aoe; if (aoe > 0) for (const d of dots) if (!d.dead && (d.x - sh.tx) ** 2 + (d.y - sh.ty) ** 2 <= aoe * aoe) hitDot(d, sh.dmg, sh.type);
        ring(sh.tx, sh.ty, sh.crit ? 6 : 4, Math.max(aoe, 22), 0.24); burst(sh.tx, sh.ty, sh.crit ? 13 : 8, 120, 2.6);
        shake = Math.max(shake, sh.crit ? 1.8 : 1.0);
      }
    }
    shells = shells.filter(s => !s.dead);

    // collectors coordinate: chase-types each claim their nearest orb (so they
    // split up); black-hole types stay put and drag everything in slowly.
    if (drones.length === 0) syncCollectors();
    for (const dr of drones) { dr.cand = null; dr.cbd = Infinity; }
    for (const o of orbs) { let nd = null, bd = Infinity; for (const dr of drones) { if (COL_TYPES[dr.type].mode === "hole") continue; const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2; if (q < bd) { bd = q; nd = dr; } } if (nd && bd < nd.cbd) { nd.cbd = bd; nd.cand = o; } }
    const HOLE_SPOTS = [[0.5, 0.40], [0.30, 0.50], [0.70, 0.52], [0.50, 0.62]]; let holeN = 0;
    // m4: holes keep their DISTINCT spread offsets (so several don't pile up) but the whole formation
    // SLIDES toward the live loot centroid — so a hole sits where the orbs actually are (and follows
    // them as the fight drifts), instead of idling on a fixed dot while loot expires elsewhere.
    let oCx = 0, oCy = 0, oN = 0; for (const o of orbs) { oCx += o.x; oCy += o.y; oN++; }
    const lootX = oN ? oCx / oN : W * 0.5, lootY = oN ? oCy / oN : H * 0.5;
    for (const dr of drones) {
      const hole = COL_TYPES[dr.type].mode === "hole", tgt = dr.cand;
      if (hole) { const hs = HOLE_SPOTS[holeN++ % HOLE_SPOTS.length];
        const hx = lootX + (W * hs[0] - W * 0.5) * 0.7, hy = lootY + (H * hs[1] - H * 0.5) * 0.7;   // loot centroid + this hole's spread offset
        dr.vx += ((hx - dr.x) * 0.6 - dr.vx) * 0.04; dr.vy += ((hy - dr.y) * 0.6 - dr.vy) * 0.04; }
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
    for (const dr of drones) { if (COL_TYPES[dr.type].mode !== "hole") continue; const R = cReach(dr.type) * 1.5, ps = 60 * cPull(dr.type); for (const d of dots) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < R) { d.x += dx / dl * ps * dt; d.y += dy / dl * ps * dt; } } }   // hole drags dots within its Reach toward it, at its Pull strength
    for (const dr of drones) dr.proc = 0;   // free maw bays this frame; Capacity = how many orbs a collector processes in parallel
    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      // route to the nearest in-range collector that still has a FREE maw bay; only fall back to a
      // full one if none is free (stops loot queueing at a jammed collector while another sits idle).
      let nd = null, bd = Infinity, ndF = null, bdF = Infinity;
      for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2, rng = cReach(dr.type) ** 2; if (q >= rng) continue; if (q < bd) { bd = q; nd = dr; } if (dr.proc < cCapacity(dr.type) && q < bdF) { bdF = q; ndF = dr; } }
      if (ndF) { nd = ndF; bd = bdF; }
      if (nd) {
        const dl = Math.sqrt(bd) || 1, pull = (COL_TYPES[nd.type].mode === "hole" ? 420 / Math.sqrt(o.weight || 1) : 240 / (o.weight || 1)) * cPull(nd.type);   // reel force × Pull strength; holes pull HARD (sqrt-damped) so heavy high-value orbs reach the maw before expiry
        if (dl < MOUTH) {                                          // reeled to the mouth — but it needs a free maw bay to actually process it
          if (nd.proc < cCapacity(nd.type)) {                     // a bay is open → process this orb (Speed/Reach get it here, Process/Capacity chew through it)
            nd.proc++;
            o.consume += dt * cIngest(nd.type); o.x += (nd.x - o.x) * 0.3; o.y += (nd.y - o.y) * 0.3; if (o.consumeMax > 0.8) nd.parking = true;   // only park for genuinely heavy loot (armored/boss), not tier-1 orbs
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
    if (earned > 0) { S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + earned)); S.totalRun += earned; META.totalEver += earned; earnAcc += earned; curEarned += earned; }
    // background empire: every conquered, non-active planet feeds its idle rate straight into your GLOBAL
    // treasury AND (on an unconquered planet) the conquer bar — so the empire can idle you to the next world.
    { const bgSum = empireIdleRate(); if (bgSum > 0) { const add = bgSum * dt; S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + add)); S.totalRun += add; META.totalEver += add;
        if (!planetMeta(S.galaxy).conquered) { const barCap = IDLE_FRAC * ACTIVE_REF * eco(S.galaxy) * (S.conquest || 1); curEarned += Math.min(bgSum, barCap) * dt; } } }   // treasury gets the FULL empire rate; the conquer BAR gets at most IDLE_FRAC of active income (P4 — idle never out-paces playing)
    // conquest check — UNCONDITIONAL so ANY income source (active orbs OR idle empire) can complete it
    { const pm = planetMeta(S.galaxy); if (!pm.conquered && curEarned >= conquerTarget(S.galaxy)) { pm.conquered = true; pm.bgRate = Math.max(pm.bgRate || 0, baseTarget(S.galaxy) / (IDLE_PAYBACK_H * 3600)); S.conquest = (S.conquest || 1) * CONQ_STEP; const gg = gemReward(S.galaxy); META.gems += gg; META.gemsEarned += gg; recompute(); floatTxt(W / 2, H / 2 - 40, "✦ PLANET CONQUERED  ·  TRAVEL UNLOCKED"); floatTxt(W / 2, H / 2 - 16, "+" + gg + " ◈ GEMS — spend in Ascension"); flashAdd(0.5); shakeAdd(4); vibe([40, 30, 90]); syncHUD();
        let totConq = 0; for (const k in S.vault) if (S.vault[k] && S.vault[k].conquered) totConq++;   // capstone: every world in the cluster subdued
        if (totConq >= TOTAL_PLANETS && !S.victory) { S.victory = true; floatTxt(W / 2, H / 2 - 80, "★ ALL " + TOTAL_PLANETS + " WORLDS CONQUERED ★"); floatTxt(W / 2, H / 2 - 56, "the cluster is yours"); flashAdd(0.9); shakeAdd(9); ring(W / 2, H / 2, 14, Math.max(W, H), 0.8); burst(W / 2, H / 2, 60, 320, 3.2); } } }
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
    // 1-minute COUNTDOWN: a draining bar under the health bar + a ticking number (flashes white when low)
    const lifeFrac = clamp(1 - (d.life || 0) / (d.ttl || 60), 0, 1), left = Math.max(0, Math.ceil((d.ttl || 60) - (d.life || 0))), low = left <= 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 2, by + 7, bw + 4, 4);
    ctx.fillStyle = low ? (Math.sin(d.spin * 8) > 0 ? "#fff" : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.7)"; ctx.fillRect(bx, by + 8, bw * lifeFrac, 2);
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(bossName(g) + "  ·  " + left + "s", d.x, by - 4);
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
    if (shake > 0.2 && opt("shake")) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    ctx.scale(camZoom, camZoom); ctx.translate(-W / 2, -H / 2);
    if (blackholeT > 0) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, TAU); ctx.fill(); }
    for (const b of beams) { const a = clamp(b.life / (b.w > 2 ? 0.13 : 0.08), 0, 1); ctx.strokeStyle = b.color; ctx.globalAlpha = a * 0.25; ctx.lineWidth = (b.w || 2) * 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); ctx.globalAlpha = a; ctx.lineWidth = b.w || 2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // arcing mortar bombs — parabola over the field, ground shadow + target reticle, smoke trail, fused shell
    for (const sh of shells) {
      const k = clamp(sh.t / sh.dur, 0, 1);
      const gx = sh.x0 + (sh.tx - sh.x0) * k, gy = sh.y0 + (sh.ty - sh.y0) * k;   // ground-track point
      const y = gy - Math.sin(k * Math.PI) * sh.arc;                              // lobbed height
      // impact reticle that tightens as the bomb falls
      ctx.globalAlpha = 0.18 + 0.4 * k; ctx.strokeStyle = sh.color; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(sh.tx, sh.ty, Math.max(sh.aoe, 16) * (1.15 - 0.45 * k), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(sh.tx, sh.ty, 2.2, 0, TAU); ctx.stroke();
      // shadow on the ground beneath the shell (shrinks/darkens as it climbs/descends)
      const climb = Math.sin(k * Math.PI);
      ctx.globalAlpha = 0.26 * (1 - climb * 0.6); ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(gx, gy, sh.r * (1.3 - climb * 0.5), sh.r * (0.6 - climb * 0.25), 0, 0, TAU); ctx.fill();
      // smoke trail
      for (let s = 1; s <= 3; s++) { const kk = clamp(k - s * 0.06, 0, 1); const px = sh.x0 + (sh.tx - sh.x0) * kk, py = sh.y0 + (sh.ty - sh.y0) * kk - Math.sin(kk * Math.PI) * sh.arc; ctx.globalAlpha = 0.13 * (1 - s / 4); ctx.fillStyle = "#9a9a9a"; ctx.beginPath(); ctx.arc(px, py, sh.r * (1 - s * 0.16), 0, TAU); ctx.fill(); }
      // the bomb: dark casing, class-tinted core, sparking fuse
      ctx.globalAlpha = 1; ctx.fillStyle = "#161616"; ctx.beginPath(); ctx.arc(gx, y, sh.r + 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(gx, y, sh.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(gx + sh.r * 0.3, y + sh.r * 0.3, sh.r * 0.5, 0, TAU); ctx.fill();   // shaded underside
      const fl = 0.5 + 0.5 * Math.sin(sh.spin * 3);
      ctx.fillStyle = "rgba(255,255,255," + (0.55 + fl * 0.45) + ")"; ctx.beginPath(); ctx.arc(gx, y - sh.r * 0.8, 1.3 + fl * 1.1, 0, TAU); ctx.fill();   // fuse spark
      ctx.globalAlpha = 1;
    }
    const lod = dots.length > 150;   // render LOD: when the field is busy, skip per-dot spikes/rings/race decorations (keep core + threat rings + HP bar) so a crowded field stays at 60fps
    for (const d of dots) {
      if (d.boss) { drawBoss(d); continue; }
      const pulse = d.pulse !== undefined ? 1 + 0.12 * Math.sin(d.born * 0.1 + d.pulse * 4) : 1;
      const dr2 = d.r * (d.born < 0.2 ? clamp(d.born / 0.18, 0.2, 1) : 1) * (d.hit > 0 ? 1 + d.hit / 0.08 * 0.28 : 1) * pulse;
      const ga = d.phased ? 0.4 : d.cloaked ? 0.12 : 1;
      // L = this planet's dot signature · gc = a CONTINUOUS menace grade (grows with Value/HP, never plateaus like the old tier cap)
      const L = dotLook(d.pg || S.galaxy), gc = d.menace ? Math.min(13, Math.log2(1 + d.menace) * 1.85) : (d.tier || 0);
      if (d.kind === "swift" || d.kind === "zigzag") { ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 0.12, d.y - d.vy * 0.12); ctx.stroke(); }  // motion streak
      if (d.blink !== undefined && d.bx !== undefined) { const a2 = clamp(0.35 - d.blink * 0.22, 0, 0.35), ghosts = clamp(1 + Math.floor(gc * 0.3), 1, 4); ctx.fillStyle = "#fff"; for (let q = 0; q < ghosts; q++) { const t = (q + 1) / (ghosts + 1); ctx.globalAlpha = a2 * (1 - t * 0.55); ctx.beginPath(); ctx.arc(d.bx + (d.x - d.bx) * (1 - t), d.by + (d.y - d.by) * (1 - t), dr2 * (0.8 - t * 0.3), 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }  // Wraith — teleport after-image trail, longer with Value
      // HP/Value spikes: more & longer the higher the menace grade — keeps growing past the old tier-6 cap
      if (!lod && d.tier >= 1) { ctx.globalAlpha = ga; ctx.strokeStyle = d.color; ctx.lineWidth = 1.4 + Math.min(gc * 0.26, 4); const ns = clamp(3 + Math.floor(gc) * 2, 3, 30); for (let k = 0; k < ns; k++) { const a = d.spin + k / ns * TAU, i0 = dr2 * 0.9, o0 = dr2 + 3 + gc * 1.5; ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * i0, d.y + Math.sin(a) * i0); ctx.lineTo(d.x + Math.cos(a) * o0, d.y + Math.sin(a) * o0); ctx.stroke(); } ctx.globalAlpha = 1; }
      // menace AURA — high-grade dots gain a faint outer halo that keeps expanding with Value
      if (!lod && gc > 6) { ctx.globalAlpha = ga * Math.min((gc - 6) * 0.05, 0.3); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 7 + (gc - 6) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      // BODY — per-planet silhouette (polygon/circle) + shade, with the planet's centre glyph
      ctx.globalAlpha = ga; ctx.fillStyle = d.hit > 0 ? "#fff" : d.color; dotBodyPath(ctx, d.x, d.y, dr2, L.s, L.r); ctx.fill();
      if (!lod && d.hit <= 0 && d.kind === "normal" && !d.armored) dotGlyph(ctx, d.x, d.y, dr2, L.g);   // common dots wear the planet glyph (race/elite dots keep their own look)
      ctx.globalAlpha = 1;
      // inner rings (segmented core) — count climbs with the menace grade, not the capped tier
      if (!lod && d.tier >= 2) { ctx.globalAlpha = ga * 0.8; ctx.strokeStyle = "#000"; ctx.lineWidth = 1; const nr = clamp(Math.floor(gc) - 1, 1, 9); for (let k = 1; k <= nr; k++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (k / (nr + 1)), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (d.special) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke(); }
      if (d.armored) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 - 2, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3, 0, TAU); ctx.stroke(); }
      if (lod) { if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); } continue; }
      if (d.kind === "splitter") { const cells = clamp(2 + Math.floor(gc * 0.4), 2, 5); for (let k = 0; k < cells; k++) { const a = k / cells * TAU + d.spin * 0.5, rr = dr2 * 0.34, cx = d.x + Math.cos(a) * rr, cy = d.y + Math.sin(a) * rr, cr = dr2 * (cells > 3 ? 0.2 : 0.27); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(cx, cy, cr * 0.32, 0, TAU); ctx.fill(); } }   // Cinder brood — dividing cells multiply with Value
      if (d.kind === "zigzag") { const fl = 0.5 + 0.5 * Math.sin(d.spin * 9); ctx.fillStyle = "rgba(255,255,255," + (0.55 + fl * 0.45) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (0.26 + 0.16 * fl), 0, TAU); ctx.fill(); const sparks = clamp(2 + Math.floor(gc * 0.7), 2, 8); ctx.fillStyle = "rgba(255,255,255," + (0.28 + 0.4 * fl) + ")"; for (let k = 0; k < sparks; k++) { const a = d.spin * 2.4 + k / sparks * TAU, rr = dr2 + 2.5 + (k % 3) * 3 + fl * 4; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 1 + fl, 0, TAU); ctx.fill(); } }   // Ember: flickering hot core sheds sparks — fiercer with Value
      // (Verdant Mender's "+" cross is drawn by the d.healAura branch below — no separate branch needed.)
      if (d.kind === "orbiter") { const sc = clamp(d.sat || 0, 0, 8); if (sc > 0) { ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 9, 0, TAU); ctx.stroke(); ctx.fillStyle = "#fff"; for (let k = 0; k < sc; k++) { const a = d.spin * 2 + k / sc * TAU, rr = d.r + 9; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 2.2 + Math.min(gc * 0.1, 1.4), 0, TAU); ctx.fill(); } } }   // Cobalt — satellites track the ACTUAL guard count (vanish as stripped), not a fixed 3
      if (d.kind === "pulsar") { const rings = clamp(1 + Math.floor(gc * 0.4), 1, 4); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; for (let q = 0; q < rings; q++) { const ph = (d.spin * 0.8 + q * 0.55) % 1; ctx.globalAlpha = (1 - ph) * 0.7; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4 + ph * (14 + gc * 2), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }   // Tempest — expanding shock rings, more & wider with Value
      if (d.phase !== undefined) { const rings = clamp(1 + Math.floor(gc * 0.3), 1, 3); ctx.strokeStyle = "rgba(255,255,255,0.78)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); for (let q = 0; q < rings; q++) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5 + q * 4, d.spin + q, d.spin + q + TAU); ctx.stroke(); } ctx.setLineDash([]); if (gc > 4) { ctx.globalAlpha = 0.22; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x + Math.cos(d.spin * 2) * 6, d.y + Math.sin(d.spin * 2) * 6, dr2 * 0.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } }   // Umbra — phasing dashed rings + a ghost double at high Value
      if (d.shield > 0 && d.armorUp === undefined) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.globalAlpha = clamp(d.shield / d.shieldMax, 0.25, 1); const plates = clamp(1 + Math.floor(gc * 0.3), 1, 4); for (let q = 0; q < plates; q++) { ctx.lineWidth = 2.5 - q * 0.4; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5 + q * 3, -0.9 - q * 0.08, 0.9 + q * 0.08); ctx.stroke(); } ctx.globalAlpha = 1; }   // Azure bastion — front shield plates (NOT for Frost/juggernaut, which uses d.shield for its own hex armor drawn below)
      if (d.refl > 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8, 0, TAU); ctx.stroke(); }  // reflect flash
      // --- planet-native race visuals ---
      if (d.grow !== undefined) { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.55, 0, TAU); ctx.stroke(); const rings = clamp(1 + Math.floor(gc * 0.4), 1, 4); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; for (let q = 0; q < rings; q++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3 + q * 4 + Math.sin(d.grow * 2 - q) * 2, 0, TAU); ctx.stroke(); } }   // Hearth bloat — swelling membranes multiply with Value
      if (d.healAura !== undefined) { const pulses = clamp(1 + Math.floor(gc * 0.35), 1, 4); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; for (let q = 0; q < pulses; q++) { const rp = 24 + q * 13 + (d.healAura % 1.2) * 26; ctx.globalAlpha = clamp((0.22 + 0.16 * Math.sin(d.healAura * 9)) * (1 - q * 0.2), 0, 0.4); ctx.beginPath(); ctx.arc(d.x, d.y, rp, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(d.x - dr2 * 0.5, d.y); ctx.lineTo(d.x + dr2 * 0.5, d.y); ctx.moveTo(d.x, d.y - dr2 * 0.5); ctx.lineTo(d.x, d.y + dr2 * 0.5); ctx.stroke(); }   // Verdant mender — expanding heal pulses, more with Value
      if (d.flock) { const a = Math.atan2(d.vy, d.vx), wings = clamp(1 + Math.floor(gc * 0.35), 1, 4); ctx.fillStyle = "#000"; for (let q = 0; q < wings; q++) { const sc2 = 1 - q * 0.16, bx = d.x - Math.cos(a) * q * dr2 * 0.7, by = d.y - Math.sin(a) * q * dr2 * 0.7; ctx.globalAlpha = 1 - q * 0.22; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * dr2 * 0.9 * sc2, by + Math.sin(a) * dr2 * 0.9 * sc2); ctx.lineTo(bx + Math.cos(a + 2.5) * dr2 * 0.6 * sc2, by + Math.sin(a + 2.5) * dr2 * 0.6 * sc2); ctx.lineTo(bx + Math.cos(a - 2.5) * dr2 * 0.6 * sc2, by + Math.sin(a - 2.5) * dr2 * 0.6 * sc2); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; }   // Mistral — chevron trails into a formation with Value
      if (d.cloak !== undefined) { const bands = clamp(1 + Math.floor(gc * 0.3), 1, 3); ctx.strokeStyle = "rgba(255,255,255," + (d.cloaked ? 0.22 : 0.55) + ")"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); for (let q = 0; q < bands; q++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4 + q * 3, d.spin + q * 1.3, d.spin + q * 1.3 + TAU); ctx.stroke(); } ctx.setLineDash([]); }   // Halcyon — shimmering distortion bands, more with Value
      if (d.armorUp !== undefined) { const plates = clamp(1 + Math.floor(gc * 0.35), 1, 4); ctx.strokeStyle = "#fff"; for (let q = 0; q < plates; q++) { ctx.lineWidth = 2.5 - q * 0.4; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = d.spin * 0.3 + q * 0.26 + k / 6 * TAU, rr = dr2 + 3 + q * 3.5, px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); } }   // Frost — nested hex armor plates thicken with Value
      if (d.deflect) { const facets = clamp(4 + Math.floor(gc * 0.5), 4, 9); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < facets; k++) { const a = d.spin + k / facets * TAU, rr = dr2 + 4, px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); const gi = Math.floor(d.spin * 1.5) % facets, gA = d.spin + gi / facets * TAU; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x + Math.cos(gA) * (dr2 + 4), d.y + Math.sin(gA) * (dr2 + 4), 1.7, 0, TAU); ctx.fill(); }   // Onyx — more mirror facets + a roving glint with Value
      if (d.bomb) { const fl = 0.5 + 0.5 * Math.sin(d.spin * 7); ctx.fillStyle = "rgba(255,255,255," + (0.4 + fl * 0.6) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (0.36 + 0.1 * fl + Math.min(gc * 0.02, 0.18)), 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255," + (0.4 + fl * 0.35) + ")"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); const rings = clamp(1 + Math.floor(gc * 0.3), 1, 3); for (let q = 0; q < rings; q++) { const sp = d.spin * (q % 2 ? -1 : 1); ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 5 + q * 4, sp, sp + TAU); ctx.stroke(); } ctx.setLineDash([]); }   // Pyreling — hotter blast-fuse + warning rings with Value
      if (d.gravity) { const arms = clamp(3 + Math.floor(gc * 0.5), 3, 8); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; for (let k = 0; k < arms; k++) { const rr = dr2 + 6 + (k % 4) * 5, a0 = d.spin * 1.6 + k * (TAU / arms); ctx.beginPath(); ctx.arc(d.x, d.y, rr, a0, a0 + 3.0); ctx.stroke(); } ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.5, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.5, 0, TAU); ctx.stroke(); }   // Abyss — accretion swirl gains arms with Value
      if (d.leech) { const op = 0.22 + 0.32 * Math.abs(Math.sin(d.spin * 4)), mr = dr2 * (0.7 + Math.min(gc * 0.02, 0.18)); ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5 + Math.min(gc * 0.18, 2); ctx.beginPath(); ctx.arc(d.x, d.y, mr, op, Math.PI - op); ctx.stroke(); ctx.beginPath(); ctx.arc(d.x, d.y, mr, Math.PI + op, TAU - op); ctx.stroke(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.22, 0, TAU); ctx.fill(); }   // Devourer — gnashing maw widens & darkens with Value
      if (d.spawner !== undefined) { const brood = clamp(4 + Math.floor(gc * 0.5), 4, 9); ctx.fillStyle = "#fff"; for (let k = 0; k < brood; k++) { const a = d.spin * 1.5 + k / brood * TAU, rr = dr2 * 0.55; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, dr2 * 0.2, 0, TAU); ctx.fill(); } ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255," + (0.3 + 0.3 * Math.sin(d.spin * 6)) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.13, 0, TAU); ctx.fill(); }   // Null Spawn — brood multiplies with Value + pulsing core
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
      if (u.type === "mortar") {
        // MORTAR: not barrels but a single fat, stubby launch tube on a base plate with a bipod —
        // recoils on its kick, flares at the muzzle, reads instantly as a lob weapon not a gun.
        const recoil = u.flash > 0 ? (u.flash / 0.08) * 3 : 0;          // tube kicks back when it fires
        const tubeW = bw + 5.5, tEnd = bodyR + 8 + Math.min(uRange(u) - DEF_TYPES.mortar.range, 150) * 0.02 - recoil, tBeg = -bodyR * 0.55 - recoil;
        // heavy base plate seated under the tube (perpendicular slab)
        ctx.fillStyle = "#262626"; ctx.beginPath(); ctx.ellipse(-bodyR * 0.15, 0, bodyR * 0.55, bodyR * 1.05, 0, 0, TAU); ctx.fill();
        // bipod legs splaying out near the muzzle
        ctx.strokeStyle = "#383838"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
        for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tEnd * 0.5, 0); ctx.lineTo(tEnd * 0.42, sgn * (bodyR + 6)); ctx.stroke(); }
        // the tube — thick dark casing with a bright bore stripe, taper to a reinforced muzzle
        ctx.strokeStyle = "#1c1c1c"; ctx.lineWidth = tubeW + 2.5; ctx.beginPath(); ctx.moveTo(tBeg, 0); ctx.lineTo(tEnd, 0); ctx.stroke();
        ctx.strokeStyle = "#454545"; ctx.lineWidth = tubeW; ctx.beginPath(); ctx.moveTo(tBeg, 0); ctx.lineTo(tEnd, 0); ctx.stroke();
        ctx.strokeStyle = "#cfcfcf"; ctx.lineWidth = Math.max(1.2, tubeW * 0.34); ctx.beginPath(); ctx.moveTo(tBeg + 1, 0); ctx.lineTo(tEnd - tubeW * 0.4, 0); ctx.stroke();
        // muzzle collar + dark bore mouth
        ctx.fillStyle = "#e8e8e8"; ctx.beginPath(); ctx.arc(tEnd, 0, tubeW * 0.7, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0a0a0a"; ctx.beginPath(); ctx.arc(tEnd, 0, tubeW * 0.42, 0, TAU); ctx.fill();
        if (u.flash > 0) { const a = u.flash / 0.08; ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.beginPath(); ctx.arc(tEnd + 3, 0, tubeW * 0.7 + 5 * a, 0, TAU); ctx.fill(); }   // muzzle blast on launch
      } else {
        for (let b = 0; b < barrels; b++) {
          const off = (b - (barrels - 1) / 2) * (bw + 2.4);
          ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = bw + 1.6; ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
          ctx.strokeStyle = "#e6e6e6"; ctx.lineWidth = Math.max(1, bw * 0.5); ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
          if (u.flash > 0) { const a = u.flash / 0.08; ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.beginPath(); ctx.arc(blen + 1, off, bw * 0.55 + 2 * a, 0, TAU); ctx.fill(); }   // brief white muzzle flash only while firing
        }
        // RANGE branch (Scope · Range Finder · Laser Sight · Long Barrel): a faint sight line creeps past the muzzle, one notch longer per range node
        if (c.n.range > 0) { const sl = Math.min(5 + c.n.range * 3.5, 40); ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(blen + 2, 0); ctx.lineTo(blen + 2 + sl, 0); ctx.stroke(); }
      }
      ctx.restore();
      // --- body (size = damage) · distinct per-class silhouette: turret circle · mortar hex · plasma diamond · laser triangle · railgun square ---
      const shp = { mortar: [6, 0], plasma: [4, Math.PI / 4], laser: [3, -Math.PI / 2], railgun: [4, 0], nova: [8, Math.PI / 8] }[u.type];   // nova = octagon "void burst"
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
      const mode = COL_TYPES[dr.type].mode, sr = cReach(dr.type);
      // collectors reflect their build too (all monochrome): outer ring = gather RADIUS (Reach),
      // inner dot = the mouth (grab point), maw size = Process/Ingest, trail length = Speed.
      ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, sr, 0, TAU); ctx.stroke();   // Reach (engagement radius)
      if (mode !== "hole") { ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, MOUTH, 0, TAU); ctx.stroke(); }   // mouth (fixed grab distance)
      const sp = Math.hypot(dr.vx || 0, dr.vy || 0);
      if (mode !== "hole" && sp > 25) { const tl = Math.min(sp * 0.06, 22), ux2 = (dr.vx || 0) / (sp || 1), uy2 = (dr.vy || 0) / (sp || 1); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dr.x - ux2 * tl, dr.y - uy2 * tl); ctx.lineTo(dr.x, dr.y); ctx.stroke(); }   // speed trail — length scales with Speed
      const cs = (1 + Math.min(Math.log10(cIngest(dr.type)) * 0.5, 1.4)) * (1 + Math.max(0, dr.pop || 0) * 1.6);   // Process -> bigger maw; chomp-pop when banking big loot
      ctx.save(); ctx.translate(dr.x, dr.y); ctx.scale(cs, cs);
      if (mode === "hole") {
        const worm = dr.type === "wormhole", rings = worm ? 5 : 3, rot = Date.now() / (worm ? 420 : 600) * (worm ? -1 : 1);   // Wormhole spins tighter, more accretion rings, counter-rotating — distinct from the Black Hole
        for (let k = 0; k < rings; k++) { ctx.strokeStyle = "rgba(255,255,255," + (0.55 - k * (worm ? 0.09 : 0.13)) + ")"; ctx.lineWidth = worm ? 2.4 : 2; ctx.beginPath(); ctx.arc(0, 0, (worm ? 6 : 7) + k * (worm ? 4 : 5), rot + k, rot + k + 4.2); ctx.stroke(); }
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, worm ? 7 : 6, 0, TAU); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = worm ? 2 : 1.5; ctx.stroke();
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
    if (flash > 0 && opt("flash")) { ctx.fillStyle = "rgba(255,255,255," + Math.min(0.55, flash * 0.6) + ")"; ctx.fillRect(0, 0, SW, SH); }
  }

  /* ----------------------------- HUD ----------------------------- */
  function syncHUD() {
    const bg = empireIdleRate();
    const cq = S.conquest || 1, cqStr = cq < 100 ? cq.toFixed(1) : fmt(cq);   // fmt() floors small numbers (1.8→"1"), so keep a decimal while the multiplier is small
    $("ui-cash").textContent = curSym(S.galaxy) + " " + fmt(S.cash); $("ui-cap").textContent = curName(S.galaxy) + (cq > 1.001 ? "  ·  ✦×" + cqStr : "") + (bg > 0 ? "  ·  +" + fmt(bg) + "/s" : "");   // compact meta on its own line (see .t-cash span CSS) so it never squeezes the conquer bar
    $("ui-cash").classList.toggle("capped", S.cash >= derived.capacity * 0.999);   // pulse when at the currency ceiling
    { const g = (META && META.gems) || 0, ab = $("ascend-n"); if (ab) ab.textContent = g; const abtn = $("btn-ascend"); if (abtn) abtn.classList.toggle("has", g > 0 && PERKS.some(p => !perkOwned(p.id) && tierOpen(p.tier) && p.cost <= g)); }   // glow the Ascension button only when you can actually afford+unlock something
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
        const d = TY(id), locked = !S.free && S.galaxy < d.gal, c = unitBuyCost(id), n = countType(id), full = n >= d.max;   // gated by the CURRENT planet (era-appropriate), not your furthest — no retro-gearing old worlds
        row.desc.textContent = n + "/" + d.max + (locked ? "" : " · " + d.name);
        if (locked) { row.buy.innerHTML = iconMarkup("lock") + "from P" + d.gal; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.remove("maxed"); }
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
    for (const t of DEF_ORDER) if (S.free || (S.galaxy >= DEF_TYPES[t].gal && S.cash >= unitBuyCost(t))) aff.def = true;
    for (const t of COL_ORDER) if (S.free || (S.galaxy >= COL_TYPES[t].gal && S.cash >= unitBuyCost(t))) aff.drone = true;
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
    if (!S.free && S.galaxy < TY(type).gal) return;   // available only on its planet and ONWARD — never retroactively on earlier worlds (so revisits keep their era kit, no back-gearing chore); free mode ignores it
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

  /* ----------------------- AUTO-BUY (idle automation) -----------------------
     A SEQUENTIAL queue of steps — each step is "buy <thing> N times", and the queue
     runs strictly in order (step 1 fully, then step 2…). You get ONE slot per planet
     you've reached (planet 1 → 1 step, planet 2 → 2 steps, …), so deeper progress lets
     you program longer build orders. <thing> = any Economy upgrade, any Unit, or a
     class's skill tree (buys N cheapest nodes). +50% tax; runs live and while away.  */
  const AUTO_TAX = 1.5;     // auto-bought upgrades cost +50% over manual — a steep convenience tax
  const ECO_KEYS = ["value", "spawnRate", "capacity", "luck"];
  const ECO_LABEL = { value: "Value", spawnRate: "Spawn Rate", capacity: "Capacity", luck: "Luck" };
  const isTreeStep = s => s && typeof s.target === "string" && s.target.slice(0, 5) === "tree:";
  const defaultAuto = () => ({ v: 5, planets: {} });   // PER-PLANET configs: planets[g] = { on, queue:[step] }. Each planet is a fresh build, so it has its own build order.
  function ensureAuto() {
    if (!S.auto || typeof S.auto !== "object" || S.auto.v !== 5) S.auto = defaultAuto();   // (re)build to the per-planet model
    if (!S.auto.planets || typeof S.auto.planets !== "object") S.auto.planets = {};
  }
  function autoCfg(g) {   // the auto-buy config for a planet (created + normalised on demand)
    ensureAuto(); const k = g || S.galaxy; const p = S.auto.planets[k] || (S.auto.planets[k] = { on: false, queue: [] });
    if (!Array.isArray(p.queue)) p.queue = [];
    p.queue = p.queue.filter(s => s && s.target).map(s =>
      isTreeStep(s) ? { target: s.target, nodes: (s.nodes && typeof s.nodes === "object") ? s.nodes : {} }
                    : { target: s.target, count: Math.max(0, s.count | 0) });
    return p;
  }
  const curAuto = () => autoCfg(S.galaxy);   // the config that actually RUNS (your active planet)
  const autoIsOn = g => !!(S.auto && S.auto.planets && S.auto.planets[g] && S.auto.planets[g].on);   // peek a planet's on-state without creating its config
  const autoUnlocked = () => true;                                       // available from planet 1 (with a single slot)
  const autoSlots = g => Math.max(1, Math.min(g || S.galaxy, TOTAL_PLANETS));   // a planet gets one sequential slot per its number (planet 1 → 1, planet 2 → 2, …)
  const autoRate = () => Math.min(80, 5 + 4 * conqueredCount());         // purchases/sec — empire snowball makes it faster
  const autoTax = c => Math.ceil(c * AUTO_TAX);
  const treeNodesPending = s => { if (!isTreeStep(s)) return 0; const t = s.target.slice(5), sel = s.nodes || {}; let n = 0; for (const id in sel) if (sel[id] && !nodeAllocated(t, id)) n++; return n; };
  // next eco/unit purchase: { cost (taxed), buy() } or null
  function autoTargetNext(target) {
    if (ECO_KEYS.includes(target)) { const u = UP[target]; if (u.max != null && (S.lv[target] || 0) >= u.max) return null; return { cost: autoTax(upCost(u)), buy() { S.lv[target] = (S.lv[target] || 0) + 1; } }; }
    const t = target; if (!TY(t)) return null; if (!S.free && S.galaxy < TY(t).gal) return null; if (countType(t) >= TY(t).max) return null;
    return { cost: autoTax(unitBuyCost(t)), buy() { classList(t).push(isCol(t) ? { type: t } : newUnit(t)); if (isCol(t)) syncCollectors(); } };
  }
  // a step's next purchase: tree → cheapest still-allocatable PICKED node; eco/unit → next buy while count remains. null = step done/blocked.
  function stepNext(s) {
    if (!s || !s.target) return null;
    if (isTreeStep(s)) {
      const t = s.target.slice(5), sel = s.nodes || {}, G = buildTree(t); let best = null;
      for (const id in sel) { if (!sel[id] || nodeAllocated(t, id)) continue; const n = G.map[id]; if (!n || !nodeAllocatable(t, n)) continue; const c = nodeCost(t, n); if (!best || c < best.cost) best = { cost: c, id }; }
      return best ? { cost: autoTax(best.cost), buy() { (S.classNodes[t] || (S.classNodes[t] = {}))[best.id] = true; } } : null;
    }
    if ((s.count || 0) <= 0) return null;
    const nx = autoTargetNext(s.target); if (!nx) return null;
    return { cost: nx.cost, buy() { nx.buy(); s.count = Math.max(0, (s.count || 0) - 1); } };
  }
  // first runnable step of the ACTIVE planet: earlier steps must finish before later ones run
  function autoActive() {
    const q = curAuto().queue, slots = autoSlots(S.galaxy);
    for (let i = 0; i < q.length && i < slots; i++) { const nx = stepNext(q[i]); if (nx) return { step: q[i], next: nx, idx: i }; }
    return null;
  }
  // one purchase pass: advance the active step (sequential — wait, don't skip, if it's unaffordable)
  function autoBuyOnce(b) {
    const a = autoActive(); if (!a || a.next.cost > b.cash) return false;
    a.next.buy(); if (!S.free) b.cash -= a.next.cost; b.n = (b.n || 0) + 1; return true;
  }
  // shortest node path from the tree's centre to a node (so picking a deep node also marks its prerequisites)
  function treePath(type, id) {
    const G = buildTree(type), adj = G.adj, prev = { start: null }, q = ["start"], seen = new Set(["start"]);
    while (q.length) { const cur = q.shift(); if (cur === id) break; for (const nb of (adj[cur] || [])) { if (seen.has(nb)) continue; seen.add(nb); prev[nb] = cur; q.push(nb); } }
    if (!(id in prev)) return [id];
    const path = []; let c = id; while (c && c !== "start") { path.push(c); c = prev[c]; } return path;
  }
  // LIVE tick: spend accumulated cash this frame (rate-limited, scaling with conquests)
  function autoBuyTick(dt) {
    if (!curAuto().on || !autoUnlocked()) return;
    autoAcc = Math.min(autoAcc + autoRate() * dt, 120);
    if (autoAcc < 1) return;
    const b = { cash: S.free ? Infinity : S.cash }; let tries = Math.floor(autoAcc);
    while (tries-- > 0 && autoBuyOnce(b)) { autoAcc -= 1; }
    if (autoAcc >= 1) autoAcc = Math.min(autoAcc, 4);   // nothing affordable — don't bank an ever-growing backlog
    if (b.n) { if (!S.free) S.cash = b.cash; recompute(); if (state === "play") renderList(); if ($("auto-modal") && $("auto-modal").classList.contains("show")) renderAuto(); }
  }
  // OFFLINE: drain a banked budget into purchases (bounded). returns { bought, leftover }
  function autoBuyOffline(pool) {
    if (!curAuto().on || !autoUnlocked()) return { bought: 0, leftover: pool };
    const b = { cash: pool }; let n = 0;
    while (n < 50000 && autoBuyOnce(b)) n++;
    return { bought: n, leftover: b.cash };
  }
  function syncAutoBtn() { const on = !!(curAuto().on && autoUnlocked()); ["btn-auto", "gm-auto"].forEach(id => { const b = $(id); if (b) b.classList.toggle("on", on); }); }
  // the choices for a step's target on planet g — every Economy upgrade, plus every Unit/Tree unlocked by planet g
  function autoTargetOptions(g) {
    const gg = g || S.galaxy, o = [];
    for (const id of ECO_KEYS) o.push({ value: id, label: ECO_LABEL[id], group: "Economy" });
    for (const t of [...DEF_ORDER, ...COL_ORDER]) if (S.free || gg >= TY(t).gal) o.push({ value: t, label: TY(t).name, group: "Units" });
    for (const t of [...DEF_ORDER, ...COL_ORDER]) if (S.free || gg >= TY(t).gal) o.push({ value: "tree:" + t, label: TY(t).name + " tree", group: "Trees" });
    return o;
  }
  // when the dropdown target changes, switch the step between count-shape and tree-shape
  function autoRetarget(s, target) {
    s.target = target;
    if (isTreeStep(s)) { delete s.count; if (!s.nodes) s.nodes = {}; }
    else { delete s.nodes; if (s.count == null) s.count = 10; }
  }
  function autoStepRow(s, i, opts, active, q) {
    const tree = isTreeStep(s);
    let optHtml = "";
    for (const g of ["Economy", "Units", "Trees"]) { const items = opts.filter(o => o.group === g); if (!items.length) continue; optHtml += '<optgroup label="' + g + '">'; for (const o of items) optHtml += '<option value="' + o.value + '"' + (o.value === s.target ? " selected" : "") + '>' + o.label + '</option>'; optHtml += '</optgroup>'; }
    let sub, ctrl;
    if (tree) {
      const pend = treeNodesPending(s), picked = s.nodes ? Object.values(s.nodes).filter(Boolean).length : 0;
      sub = picked ? (pend + " / " + picked + " nodes left") : "no nodes picked — hit EDIT";
      ctrl = '<button class="as-edit">' + iconMarkup("gear") + 'EDIT</button>';
    } else {
      const nx = autoTargetNext(s.target), c = s.count || 0;
      sub = c <= 0 ? "✓ done" : (nx ? (c + "× left · @ " + curSym(S.galaxy) + " " + fmt(nx.cost) + " ea") : (c + "× left · nothing to buy"));
      ctrl = '<div class="ar-step"><button class="as-m">−</button><b class="as-q">' + c + '</b><button class="as-p">+</button><button class="as-p10">+10</button></div>';
    }
    const row = document.createElement("div");
    row.className = "auto-row" + ((tree ? treeNodesPending(s) > 0 : (s.count || 0) > 0) ? "" : " off") + (active ? " active" : "");
    row.innerHTML = '<span class="ar-slot">' + (i + 1) + '</span>'
      + '<div class="ar-main"><select class="ar-sel">' + optHtml + '</select><div class="ar-next">' + (active ? "▶ " : "") + sub + '</div></div>'
      + ctrl + '<button class="ar-x">✕</button>';
    row.querySelector(".ar-sel").onchange = e => { autoRetarget(s, e.target.value); save(); renderAuto(); };
    row.querySelector(".ar-x").onclick = () => { q.splice(i, 1); save(); renderAuto(); };
    if (tree) { row.querySelector(".as-edit").onclick = () => { $("auto-modal").classList.remove("show"); openSkillTree(s.target.slice(5)); STree.pick = true; STree.pickStep = s; }; }
    else {
      row.querySelector(".as-m").onclick = () => { s.count = Math.max(0, (s.count || 0) - 1); save(); renderAuto(); };
      row.querySelector(".as-p").onclick = () => { s.count = (s.count || 0) + 1; save(); renderAuto(); };
      row.querySelector(".as-p10").onclick = () => { s.count = (s.count || 0) + 10; save(); renderAuto(); };
      row.querySelector(".as-q").onclick = () => { s.count = 0; save(); renderAuto(); };
    }
    return row;
  }
  function openAuto(g) { ensureAuto(); if (!autoExpanded) autoExpanded = new Set(); autoExpanded.add(g || S.galaxy); renderAuto(); $("auto-modal").classList.add("show"); }
  // one collapsible panel for a planet in the all-planets overview
  function autoPlanetSection(g) {
    const peek = S.auto.planets[g], on = !!(peek && peek.on), qlen = peek && Array.isArray(peek.queue) ? peek.queue.length : 0;
    const slots = autoSlots(g), live = g === S.galaxy, exp = autoExpanded.has(g);
    const wrap = document.createElement("div"); wrap.className = "auto-sec" + (exp ? " exp" : "") + (on ? " on" : "");
    const head = document.createElement("div"); head.className = "auto-sec-head";
    head.innerHTML = '<button class="asx-pow' + (on ? " on" : "") + '">' + iconMarkup("power") + '</button>'
      + '<div class="asx-main"><div class="asx-name">' + (exp ? "▾ " : "▸ ") + "Planet " + g + " · " + galName(g) + (live ? ' <span class="asx-here">• here</span>' : '') + '</div>'
      + '<div class="asx-sub">' + (on ? "ON" : "off") + " · " + Math.min(qlen, slots) + "/" + slots + " step" + (slots > 1 ? "s" : "") + '</div></div>';
    head.querySelector(".asx-pow").onclick = e => { e.stopPropagation(); const cfg = autoCfg(g); cfg.on = !cfg.on; if (live) autoAcc = 0; save(); syncAutoBtn(); renderAuto(); };
    head.querySelector(".asx-main").onclick = () => { if (autoExpanded.has(g)) autoExpanded.delete(g); else autoExpanded.add(g); renderAuto(); };
    wrap.appendChild(head);
    if (exp) {
      const body = document.createElement("div"); body.className = "auto-sec-body";
      const cfg = autoCfg(g), q = cfg.queue, opts = autoTargetOptions(g), act = live ? autoActive() : null;
      q.slice(0, slots).forEach((s, i) => body.appendChild(autoStepRow(s, i, opts, !!act && act.idx === i, q)));
      if (q.length < slots) { const add = document.createElement("button"); add.className = "auto-add"; add.textContent = "＋ Add step  (" + (q.length + 1) + "/" + slots + ")"; add.onclick = () => { q.push({ target: opts[0] ? opts[0].value : "value", count: 10 }); save(); renderAuto(); }; body.appendChild(add); }
      wrap.appendChild(body);
    }
    return wrap;
  }
  function renderAuto() {
    ensureAuto();
    const tog = $("auto-toggle"), lock = $("auto-lock"), list = $("auto-list"), ph = $("auto-planet"); if (!list) return;
    if (!autoExpanded) autoExpanded = new Set([S.galaxy]);
    if (tog) tog.style.display = "none";           // each planet has its own power toggle in its panel
    if (ph) ph.textContent = "· all " + TOTAL_PLANETS + " planets";
    if (lock) lock.textContent = "Tap a planet to expand its build order · arm it with its power toggle · slots = planet number · +50% tax.";
    list.innerHTML = "";
    for (let g = 1; g <= TOTAL_PLANETS; g++) list.appendChild(autoPlanetSection(g));
    syncAutoBtn();
  }

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
    nova:        { keys: ["Singularity Core", "Void Caller", "Supernova"] },
    wormhole:    { keys: ["Event Horizon", "Spaghettify", "Cosmic Maw"] },
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
    const deep = { turret: 0, mortar: 0, plasma: 1, laser: 1, railgun: 2, nova: 3 }[type] || 0;   // later classes get deeper trees
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
  const STAT_LBL = { dmg: "dmg", rate: "rate", range: "rng", crit: "crit", int: "mind", splash: "blast", speed: "spd", suction: "pull", collect: "reach", capacity: "capacity", ingest: "process" };
  function slotText(type, s) {
    const col = isCol(type), amt = slotAmt(type, s);
    if (s.p === "x") return "+" + Math.round(amt * 100) + "% " + (col ? "process" : "crit");
    const key = (col ? COL_PRIM : dPrim(type))[s.p - 1];
    return key === "range" ? "+" + amt + " " + STAT_LBL[key] : "+" + Math.round(amt * 100) + "% " + STAT_LBL[key];
  }
  const nodeFx = (type, n) => { let s = (n.slots || []).map(sl => slotText(type, sl)).join(" · "); if (n.spec) s += (s ? " · " : "") + "✦ " + SPEC_NAME[n.spec]; return s; };
  // Plain-language glossary for every stat a tree node can grant — surfaced by an
  // ⓘ button in the node panel so you always know what a boost actually does.
  const STAT_TITLE = { dmg: "Damage", rate: "Fire Rate", range: "Range", crit: "Crit", int: "Mind", splash: "Blast Radius", multi: "Multishot", speed: "Speed", suction: "Pull", collect: "Reach", capacity: "Capacity", ingest: "Process", explosive: "✦ Explosive Rounds", chain: "✦ Chain Lightning", pierce: "✦ Piercing Laser" };
  const STAT_INFO = {
    explosive: "✦ SPECIALIZATION — every shot DETONATES, dealing its full damage to all dots in a blast radius (turns the unit into a bomb tower). Each Explosive keystone makes the blast bigger.",
    chain: "✦ SPECIALIZATION — every shot ARCS like lightning from the dot it hits to nearby dots, jumping one extra time per keystone (damage fades a little each jump). Shreds clusters.",
    pierce: "✦ SPECIALIZATION — every shot becomes a LASER LANCE that punches through and hits every dot in a straight line, not just the target. More keystones = a wider beam.",
    dmg: "Damage per shot. Kills come faster, and since kills ARE your income, raw damage is your economy.",
    rate: "Fire rate (shots/sec). High enough and a unit machine-guns, firing several shots per frame.",
    range: "Targeting range (flat bonus). Wider range keeps more dots in reach, so units idle less.",
    crit: "Crit chance. A critical shot deals ~2.2× damage and pops a little extra.",
    int: "Mind — combat intelligence & coordination. A smart unit reads the field: it won't waste a bolt on a dot another shot is already guaranteed to kill (overkill avoidance), it coordinates with the rest of your rack so two units don't both fire on the same doomed dot, and it triages — putting shots on the highest-value targets it can finish. Higher Mind = fewer wasted shots = more effective DPS and income.",
    splash: "Blast Radius — how wide the Mortar's bomb detonates. Every dot inside the blast takes the FULL shell damage, so a wider blast means one lobbed bomb wipes a whole cluster at once. Area grows with the square of the radius, so each node hits dramatically more dots — the Mortar's core lever alongside raw shell damage (it fires only once every several seconds, so each bomb must count).",
    multi: "Multishot. Each keystone lets EVERY unit of this class fire at one extra dot at the same time.",
    speed: "Movement speed — how fast this collector chases orbs. Capped so it stays agile instead of flying straight past loot.",
    suction: "Pull — reel STRENGTH. Once an orb is inside your Reach it gets dragged toward the collector; Pull is how FAST. Heavy loot (armored & boss orbs) drags slowly and can expire mid-haul, so Pull matters most for fat orbs and for big-Reach builds where the trip in is long. (Pull is a force, not a radius — Reach decides how far you engage.)",
    collect: "Reach — gather RADIUS, the collector's engagement zone. Any orb inside this radius is locked on and reeled in; orbs outside it are ignored and expire. Bigger Reach works a much larger slice of the field at once (capped, so it still roams and you still want more collectors). Pull then governs how fast the engaged orbs actually arrive. Collectors carry NO cash multiplier — income lives in the Economy tab.",
    capacity: "Capacity — how many loot orbs this collector can PROCESS at the same time (its parallel maw bays). With low capacity a collector consumes orbs one or two at a time and a dense pile backs up (and orbs can expire before it gets to them); high capacity lets it chew through a whole cluster at once. Matters most after big multi-kills, Dot Rain, and Black Hole pulls — exactly when loot piles up faster than a single bay can clear it. (Separate from the Economy tab's Capacity, which is your cash ceiling.)",
    ingest: "Process speed — how quickly a collector consumes the loot a dot drops once it reaches it. Big/heavy loot takes longer to process, so this matters most for fat dots and armored elites — a key drone lever.",
  };
  function nodeStats(type, n) {
    const col = isCol(type), keys = [];
    for (const s of (n.slots || [])) { const k = s.p === "x" ? (col ? "ingest" : "crit") : (col ? COL_PRIM : dPrim(type))[s.p - 1]; if (!keys.includes(k)) keys.push(k); }
    if (n.kind === "key") { if (!col) { if (!keys.includes("multi")) keys.push("multi"); } else { if (!keys.includes("capacity")) keys.push("capacity"); if (!keys.includes("suction")) keys.push("suction"); } }
    if (n.spec) keys.push(n.spec);
    return keys;
  }
  // a small glyph showing WHAT a node upgrades (damage / rate / range / crit /
  // speed / suction / yield / ingest), plus class & keystone markers.
  const STAT_ICON = { dmg: "✸", rate: "»", range: "◎", crit: "✶", int: "◈", splash: "✺", speed: "➤", suction: "◉", yield: "❖", collect: "▣", capacity: "▦", ingest: "⊛" };
  function nodeIcon(type, n) {
    if (n.kind === "start") return "★";
    if (n.kind === "key") return "✦";
    const s = n.slots[0];
    if (s.p === "x") return isCol(type) ? STAT_ICON.ingest : STAT_ICON.crit;
    return STAT_ICON[(isCol(type) ? COL_PRIM : dPrim(type))[s.p - 1]] || "•";
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
      ? "<b>" + Math.round(cSpeed(tp)) + "</b> spd · <b>" + Math.round(cReach(tp)) + "</b> reach · <b>×" + cPull(tp).toFixed(2) + "</b> pull · <b>" + cCapacity(tp) + "</b> bays · <b>×" + cIngest(tp).toFixed(2) + "</b> process"
      : "<b>" + fmt(uDmg(s)) + "</b> dmg · <b>" + uRate(s).toFixed(1) + "</b>/s · <b>" + Math.round(uRange(s)) + "</b> rng" + (uSplash(s) ? " · splash" : "") + (uCrit(s) ? " · " + Math.round(uCrit(s) * 100) + "% crit" : "") + (uMulti(s) ? " · <b>×" + (1 + uMulti(s)) + "</b> targets" : "") + (uInt(s) ? " · <b>" + Math.round(Math.min(1, uInt(s)) * 100) + "%</b> mind" : "") + (uExplode(s) ? " · <b>✦bombs</b>" : "") + (uChain(s) ? " · <b>✦chain</b>" : "") + (uPierce(s) ? " · <b>✦laser</b>" : "");
  }
  // allocation: a node is allocatable if a connected node is already allocated.
  const nodeAllocated = (type, id) => id === "start" || !!(S.classNodes[type] && S.classNodes[type][id]);
  const nodeAllocatable = (type, n) => !nodeAllocated(type, n.id) && (buildTree(type).adj[n.id] || []).some(a => nodeAllocated(type, a));
  function nodeCost(type, n) { const k = n.kind === "key" ? 20 : n.kind === "major" ? 5 : 1; return Math.ceil(eco(S.galaxy) * 6.0 * BUY_MUL * Math.pow(1.28, allocCount(type)) * k * (DEF_SCALE[type] || 1) * pk().cost); }   // base 6.0 → the FIRST node is a real save-up investment (~4× the old cost, ~40% of a 2nd unit), not pocket change; growth eased 1.33→1.28 so the pricier early cost doesn't balloon the late curve (the back half stays about as reachable as before); ×DEF_SCALE keeps stronger-per-node classes proportionally costed
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
    try { const after = statLine(type); return { before, after }; }
    finally { if (!had) delete set[n.id]; derived.cls[type] = classStats(type); }   // ALWAYS revert the temp allocation, even if statLine throws (else the node would be silently allocated for free)
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
      sk.map(k => "<b>" + STAT_TITLE[k] + "</b> — " + STAT_INFO[k]).join("<br><br>"),
      sk.map(k => STAT_GIF[k]).find(Boolean));   // show the clip for this node's primary stat
    const btn = $("st-upgrade");
    if (has) { $("si-prev").innerHTML = "✓ Allocated · class now <span class='si-after'>" + statLine(type) + "</span>"; btn.textContent = "ALLOCATED"; btn.disabled = true; }
    else if (can) { const p = nodePreview(type, n); $("si-prev").innerHTML = "Now: " + p.before + "<br>After: <span class='si-after'>" + p.after + "</span>"; btn.textContent = S.free ? "ALLOCATE · FREE" : "ALLOCATE · " + curSym(S.galaxy) + " " + fmt(cost); btn.disabled = !afford; }
    else { $("si-prev").innerHTML = iconMarkup("lock") + "Locked — first allocate a node connected to this one."; btn.textContent = "LOCKED"; btn.disabled = true; }
    panel.classList.add("show");
  }
  const STree = {
    type: "turret", cx: 0, cy: 0, zoom: 1, t: 0, cv: null, c: null, w: 0, h: 0, sel: null, pick: false, pickStep: null,
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
    open(type) { this.type = type; this.sel = null; this.pick = false; this.pickStep = null; $("st-info").classList.remove("show"); this.reset(); this.resize(); },
    pickSet() { return (this.pickStep && isTreeStep(this.pickStep) && this.pickStep.target.slice(5) === this.type) ? (this.pickStep.nodes || (this.pickStep.nodes = {})) : null; },
    reset() { this.cx = 0; this.cy = 0; this.zoom = 1; },
    clampPan() { const u = Math.min(this.w, this.h) * 0.078 * this.zoom, m = 13 * u; this.cx = clamp(this.cx, -m, m); this.cy = clamp(this.cy, -m, m); },   // roomier pan so nothing's locked off-screen
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
        const pset = this.pickSet();
        if (pset && pset[n.id] && !has) { c.globalAlpha = 1; c.strokeStyle = "#8cf"; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.arc(p.x, p.y, rad + 6, 0, TAU); c.stroke(); c.setLineDash([]); }   // picked for this Auto-Buy step
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
      const ab = $("st-auto"); if (ab) { ab.style.display = this.pickStep ? "" : "none"; ab.classList.toggle("on", !!this.pick); }
      const tip = $("st-pick-tip"); if (tip) tip.style.display = (this.pick && this.pickStep) ? "" : "none";
    },
    tap(x, y) {
      let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } }
      const pset = this.pick ? this.pickSet() : null;
      if (pset) {   // PICK MODE — tap marks/unmarks this node for the bound Auto-Buy step (adding also marks its path to the centre so it's reachable)
        if (!best || best.n.kind === "start" || nodeAllocated(this.type, best.n.id)) return;
        if (pset[best.n.id]) delete pset[best.n.id];
        else for (const id of treePath(this.type, best.n.id)) if (!nodeAllocated(this.type, id)) pset[id] = true;
        save(); return;
      }
      if (!best) { this.sel = null; $("st-info").classList.remove("show"); return; }
      showNodeInfo(best.n);
    },
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
    const enroute = !!S.travel;
    const weps = ALL_TYPES.filter(t => TY(t).gal === g).map(t => TY(t).name);
    const action = current ? "<span class='gi-tag'>▶ You are here</span> <button id='gi-visit'>⊙ Zoom to base ▸</button>"
      : (enroute && g === S.travel.to) ? "<span class='gi-tag'>" + iconMarkup("rocket") + "En route — arriving in " + fmtTime(Math.max(0, S.travel.dur - S.travel.t)) + "</span>"   // already flying here: no fresh-start button until you land
      : enroute ? "<span class='gi-tag'>" + iconMarkup("rocket") + "In transit…</span>"                                                                                            // can't travel/visit elsewhere mid-flight
      : reached ? "<button id='gi-jump'>⊙ Visit ▸</button>"   // dive into & play your save on this visited world
      : next ? (conqHere ? "<button id='gi-travel'>Travel here ▸ (fresh start)</button>" : "<span class='gi-tag'>" + iconMarkup("lock") + "Conquer " + galName(S.galaxy) + " first</span>")
      : "<span class='gi-tag'>" + iconMarkup("lock") + "Locked</span>";
    const localN = PLANET_LOCAL[planetIdx(g)] + 1, sysSize = SYSTEMS[PLANET_SYS[planetIdx(g)]].planets, race = raceAt(g), pv = S.vault[g];
    // per-planet progression: currency bank, idle rate, build, conquer status
    const bank = current ? S.cash : (pv ? pv.cash || 0 : 0);
    const nDef = current ? S.units.length : (pv && pv.units ? pv.units.length : 0);
    const nCol = current ? S.collectors.length : (pv && pv.collectors ? pv.collectors.length : 0);
    const nNodes = (() => { const cn = current ? S.classNodes : (pv ? pv.classNodes : null); let n = 0; if (cn) for (const k in cn) n += Object.keys(cn[k] || {}).length; return n; })();
    const prog = current ? (planetMeta(g).conquered ? "✓ conquered  ·  earning idle" : Math.floor(clamp(curEarned / conquerTarget(g), 0, 1) * 100) + "% to conquer  ·  unlocks Travel + idle income")
      : (pv && pv.conquered ? "✓ conquered" : (reached ? "visited — not conquered" : "unexplored"));
    const stats = "<div class='gi-unlock'>" + curSym(g) + " <b>" + curName(g) + "</b>" +
      (pv && pv.conquered ? " · <b>+" + fmt(pv.bgRate || 0) + "/s</b> idle" : "") +
      (nDef + nCol > 0 ? " · build " + nDef + " def · " + nCol + " col · " + nNodes + " nodes" : "") +
      "<br>" + prog + "</div>";
    $("gm-info").innerHTML = "<div class='gi-name'>" + galName(g) + "</div>" +
      "<div class='gi-desc'>" + sysName(g) + " system · planet " + localN + "/" + sysSize + " · world " + g + "/" + TOTAL_PLANETS + "<br>" + galDesc(g) + "</div>" +
      stats +
      "<div class='gi-unlock'>" + iconMarkup("alien") + "Native race: <b>" + race.name + "</b> — " + RACE_FX[race.key] + "<br><span class='gi-counter'>↳ " + NICHE_HINT[race.niche || "balanced"] + "</span></div>" +
      (weps.length ? "<div class='gi-unlock'>Unlocks: " + weps.join(", ") + "</div>" : "") + "<div class='gi-act'>" + action
      + "<button id='gi-autotog' class='gi-auto" + (autoIsOn(g) ? " on" : "") + "'>" + iconMarkup("gear") + "Auto " + (autoIsOn(g) ? "ON" : "OFF") + "</button>"
      + "<button id='gi-auto' class='gi-auto'>Edit ▸</button></div>";
    $("gm-info").classList.add("show");
    const at = $("gi-autotog"); if (at) at.onclick = () => { const c = autoCfg(g); c.on = !c.on; autoAcc = 0; save(); syncAutoBtn(); showGalaxyInfo(g); };   // toggle THIS planet's auto-buy on/off
    const ab = $("gi-auto"); if (ab) ab.onclick = () => { $("gm-info").classList.remove("show"); openAuto(g); };   // configure THIS planet's auto-buy build order
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
    nova: "VOID BOMBARDMENT — endgame artillery with massive splash that devastates everything on screen. Signature: ✦ Explosive Rounds. The deepest, strongest tree in the game.",
    drone: "Fast, agile collector — chases the nearest cash orb. Its tree is about Speed & Ingest (how quickly it swallows loot), not a big magnet pull. Field up to 4.",
    swarm: "Faster with a wider net — covers more of the field than a lone drone.",
    collector: "Heavy hauler: big pull radius & grab size, higher yield per orb.",
    magnet: "Strong long-range magnetic pull and high yield.",
    tractor: "Very wide tractor beam that sweeps huge areas of orbs.",
    singularity: "Black hole — hovers centre-field and slowly drags EVERY orb (and nearby dots) inward. Huge reach & yield.",
    wormhole: "Wormhole — the ultimate singularity: hovers and slowly drags EVERY orb (and nearby dots) across the whole field inward. The largest reach & yield of any collector.",
    capacity: "Your cash ceiling — how much money you can hold at once. Raise it to afford big buys and travel; it also caps offline earnings.",
    value: "A FLAT +8% cash per dot per level (additive — it doesn't compound, so no runaway). Also ramps dot 'menace' — tougher dots, armored elites and exotic kinds appear (and pay more) as you invest.",
    spawnRate: "More dots per second — and if you're clearing them fast, you just get MORE to kill. Only when the field actually fills up (you can't keep up) does extra Spawn Rate convert into 'menace' instead: every dot spawns tougher and worth far more. So fast killing is rewarded with sheer volume, and the upgrade still pays off as toughness when the screen is packed.",
    luck: "Chance for rare SPECIAL dots worth about 9× normal cash. +0.3% per level.",
    frenzy: "All defenders fire ~5× faster for 6 seconds. Cooldown 45s — save it for dense screens.",
    dotrain: "Instantly floods the field with extra dots to pop. Cooldown 40s.",
    blackhole: "Drags every dot to the centre and crushes them over 5s. Cooldown 60s.",
  };
  // Each upgrade/tree-stat has a short side-by-side BEFORE/AFTER clip in assets/stat-gifs (gameplay
  // for the visible stats, hand-drawn schematics for the invisible ones like Mind/Luck/Capacity).
  const GIF_DIR = "assets/stat-gifs/";
  const STAT_GIF = { dmg: "damage", rate: "fire-rate", range: "range", crit: "crit", int: "mind", multi: "multishot", splash: "splash",
    speed: "collector-speed", suction: "collector-pull", collect: "reach", capacity: "capacity-col", ingest: "process",
    explosive: "multishot", chain: "multishot", pierce: "multishot" };   // ✦ specials live on keystones → show the keystone clip
  const INFO_GIF = { value: "value", spawnRate: "spawn-rate", luck: "luck", capacity: "eco-capacity" };   // economy-tab upgrades (note: 'capacity' here = cash ceiling, a different clip than the collector Capacity stat)
  function setInfoGif(name) { const im = $("info-gif"); if (!im) return; if (name) { im.src = GIF_DIR + name + ".gif"; im.style.display = "block"; } else { im.removeAttribute("src"); im.style.display = "none"; } }
  function showInfo(title, id) { $("info-title").textContent = title; $("info-text").textContent = INFO[id] || ""; setInfoGif(INFO_GIF[id]); $("info-modal").classList.add("show"); }
  function showInfoText(title, html, gifId) { $("info-title").textContent = title; $("info-text").innerHTML = html; setInfoGif(gifId); $("info-modal").classList.add("show"); }
  // ---- ASCENSION perk tree (permanent, gem-bought) ----
  function buyPerk(id) {
    const p = PERK_BY[id]; if (!p || perkOwned(id) || !tierOpen(p.tier) || (META.gems || 0) < p.cost) return;
    META.gems -= p.cost; (META.perks || (META.perks = {}))[id] = true;
    recompute(); save(); syncHUD(); renderAscend(); vibe(20); flashAdd(0.2);
  }
  function renderAscend() {
    const gems = (META && META.gems) || 0;
    $("ascend-bal").textContent = gems;
    let html = "";
    for (let t = 1; t <= 3; t++) {
      const open = tierOpen(t), need = t === 2 ? 4 - tierOwned(1) : t === 3 ? 4 - tierOwned(2) : 0;
      html += '<div class="perk-tier"><div class="perk-tier-h"><span>TIER ' + TIER_NUM[t] + ' · ' + t + ' gem' + (t > 1 ? 's' : '') + ' each</span>' +
        (open ? '' : '<span class="locked">' + iconMarkup("lock") + 'own ' + Math.max(0, need) + ' more from Tier ' + TIER_NUM[t - 1] + '</span>') + '</div><div class="perk-grid">';
      for (const p of PERKS) { if (p.tier !== t) continue;
        const owned = perkOwned(p.id), afford = gems >= p.cost, cls = owned ? "owned" : !open || !afford ? (open ? "cant" : "locked") : "";
        html += '<button class="perk ' + cls + '" data-perk="' + p.id + '"' + ((owned || !open) ? ' disabled' : '') + '>' +
          '<span class="pk-top">' + iconMarkup(p.ico) + p.name + '</span>' +
          '<span class="pk-eff">' + perkFx(p) + '</span>' +
          '<span class="pk-cost">' + (owned ? "✓ owned" : iconMarkup("gem") + p.cost) + '</span></button>';
      }
      html += '</div></div>';
    }
    const body = $("ascend-body"); body.innerHTML = html; hydrateIcons(body); hydrateIcons($("ascend-bal").parentElement);
    body.querySelectorAll("button[data-perk]").forEach(b => b.onclick = () => buyPerk(b.getAttribute("data-perk")));
  }
  function openAscend() { renderAscend(); $("ascend").classList.add("show"); }
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
    let conquered = 0; for (const k in S.vault) { const v = S.vault[k]; if (v && v.conquered) conquered++; } const empireRate = empireIdleRate();
    $("metrics-body").innerHTML =
      sec("Time &amp; progress", grid(
        row("Played (total)", fmtTime(s.playSec)) + row("This run", fmtTime(S.runSec)) +
        row("Planet", S.galaxy + " · " + galName(S.galaxy) + " (" + sysName(S.galaxy) + ")") + row("Peak planet", S.peakGalaxy) +
        row("Travels", s.travels))) +
      sec("Empire", grid(
        row(iconMarkup("star4") + "Planets conquered", conquered + " / " + TOTAL_PLANETS) +
        row("Empire idle income", curSym(S.galaxy) + " " + fmt(empireRate) + " /s"))) +
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
      sec("Abilities used", grid(row(iconMarkup("bolt") + "Frenzy", s.abilities.frenzy) + row(iconMarkup("rain") + "Dot Rain", s.abilities.dotrain) + row(iconMarkup("blackhole") + "Black Hole", s.abilities.blackhole))) +
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
    hide() { this.open = false; if (this.flight) { this.flight = null; this._warp = 1; this._diveP = null; const tv = $("transition"); if (tv) { tv.style.opacity = "0"; tv.style.background = ""; } const root = $("root"); if (root) root.classList.remove("cinematic"); } },   // closing mid-dive ABORTS the cinematic cleanly (was: left the letterbox + black veil stuck forever — a soft-lock)
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); },
    focusSystem(si, instant) { const c = this.sunCenter(si); this.tcx = c.x; this.tcz = c.z; if (instant) { this.cx = c.x; this.cz = c.z; } this.clampFocus(); },
    // keep the camera focus inside the galaxy so it can NEVER fly off to infinity
    clampFocus() { this.cx = clamp(this.cx, -1700, 1700); this.cz = clamp(this.cz, -1300, 1300); this.tcx = clamp(this.tcx, -1700, 1700); this.tcz = clamp(this.tcz, -1300, 1300); },   // wider bounds so you can roam the whole map
    // ALWAYS-STABLE pan: a screen drag moves the focus in the camera's ground plane, bounded — no perspective
    // inversion (which blew up near edge-on), so it can't rocket the view away.
    pan(dx, dy) {
      const k = 1 / (this.zoom * 0.5), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const fore = 1 / Math.max(0.4, Math.abs(Math.sin(this.pitch)));   // vertical foreshorten, capped so it can't explode
      const wx = -dx * k, wz = -dy * k * fore;
      this.cx += wx * cy - wz * sy; this.cz += wx * sy + wz * cy; this.tcx = this.cx; this.tcz = this.cz; this.clampFocus();
    },
    zoomBy(factor) { this.zoom = clamp(this.zoom * factor, 0.4, 4.5); },                       // zoom toward centre — predictable, no drift
    rotate(dx, dy) { this.yaw += dx * 0.009; this.pitch = clamp(this.pitch - dy * 0.009, -1.5, 1.5); },   // full tilt: from straight-down, through edge-on, all the way under to view from below
    proj(x, y, z) { x -= this.cx; z -= this.cz; const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); let x1 = x * cy + z * sy, z1 = -x * sy + z * cy; const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch); let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const f = 360 / Math.max(120, 720 + z2) * this.zoom; return { x: this.w / 2 + x1 * f, y: this.h * 0.5 + y1 * f, z: z2, f }; },   // near-clip (max 120) stops f going zero/negative when far planets cross behind the camera on a wide pan — was flipping/NaN-ing the projection
    // THREE widely-spaced solar systems (a big triangle). Each planet rides its OWN
    // orbit: a distinct ellipse, inclination (tilt) and orientation, seeded by planet.
    SYS_POS: [{ x: -680, z: -150 }, { x: 0, z: 300 }, { x: 680, z: -150 }],
    sunCenter(si) { const p = this.SYS_POS[si] || this.SYS_POS[0]; return { x: p.x, y: 0, z: p.z }; },
    orbitParams(g) {
      if (!this._orb) this._orb = {}; if (this._orb[g]) return this._orb[g];
      const i = planetIdx(g), L = PLANET_LOCAL[i], si = PLANET_SYS[i];
      const h = Math.imul(g + si * 131 + 7, 2654435761) >>> 0, r = k => ((h >>> (k * 5)) & 31) / 31;
      const base = 66 + L * 56;                                  // wider per-ring spacing so neighbours (e.g. Ember/Cinder) don't crowd
      const a = base * (0.9 + r(0) * 0.26), b = base * (0.64 + r(1) * 0.3);   // tighter random spread → orbits keep their order, no overlap
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
    // EACH of the 18 planets gets a hand-assigned ARCHETYPE (+ seeded sub-variation) so every world reads
    // clearly different while staying strict black & white: cratered moons, banded gas giants, ringed
    // worlds, strong crescents, storm-spots, speckled rocks, a mooned world, inverted (white) discs,
    // fractured & spiked worlds, a clean half-shadow, a swirl. Deterministic & stable per planet index.
    planetStyle(g) {
      const cache = this._pst || (this._pst = {});
      if (cache[g]) return cache[g];
      const LOOK = ["crater", "bands", "cresc", "ring", "spot", "speck", "moon", "doublering", "inv", "vstripe", "crack", "icy", "half", "swirl", "eye", "dunes", "facet", "pulsar"];   // 18 UNIQUE looks, no repeats
      const SZ = [0.5, 1.4, 0.78, 1.95, 1.15, 0.45, 1.6, 2.4, 0.68, 1.3, 0.92, 1.8, 0.6, 1.5, 1.08, 0.55, 2.1, 2.7];   // huge size spread: tiny moons (0.45×) → giant worlds (2.7×)
      const ALB = [0.3, 0.58, 0.42, 0.72, 0.5, 0.22, 0.85, 0.52, 0.88, 0.38, 0.66, 0.9, 0.18, 0.55, 0.78, 0.28, 0.62, 0.7];   // per-world BASE BRIGHTNESS — coal-dark worlds → chalk/ice-bright worlds (the big distinguisher)
      const i = Math.min(Math.max(g, 1), 18) - 1;
      const rnd = n => ((Math.imul(((g + 1) * 374761393) ^ ((n + 1) * 668265263), 2654435761) >>> 0) / 4294967296);
      return cache[g] = { arch: LOOK[i], sizeMul: SZ[i], rot: rnd(1) * TAU, phase: rnd(2) * TAU, ringAng: (rnd(3) - 0.5) * 1.4, ringTilt: 0.2 + rnd(4) * 0.28, cs: rnd(5), inv: LOOK[i] === "inv",
        halo: rnd(6) < 0.5, haloR: 1.16 + rnd(7) * 0.3, rim2: rnd(8) < 0.4, oblate: 0.82 + rnd(9) * 0.36,
        albedo: ALB[i], rough: 0.45 + rnd(10) * 1.15, con: 0.75 + rnd(11) * 0.8, hard: rnd(12) < 0.5 };   // base brightness + surface roughness + feature contrast + hard/soft terminator → far more variety
    },
    // bake a per-planet procedural ALBEDO texture (grayscale surface, unlit) into an offscreen canvas, once.
    // The lit sphere is composited from this in planet(): texture × shading. Gives every world real detail.
    bakeTexture(g) {
      const cache = this._tex || (this._tex = {});
      if (cache[g]) return cache[g];
      const st = this.planetStyle(g), A = st.arch, lit = st.inv, TS = 128, C = TS / 2;
      const oc = (typeof document !== "undefined") ? document.createElement("canvas") : null;
      if (!oc) return null; oc.width = oc.height = TS; const o = oc.getContext("2d");
      let s = (Math.imul((g + 5) * 2654435761, 40503) >>> 0) || 1; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
      const con = st.con, dk = a => "rgba(0,0,0," + Math.min(0.92, a * con) + ")", lt = a => "rgba(255,255,255," + Math.min(0.95, a * con) + ")";
      const bv = Math.round(st.albedo * 255); o.fillStyle = "rgb(" + bv + "," + bv + "," + bv + ")"; o.fillRect(0, 0, TS, TS);   // per-world base brightness
      for (let layer = 0; layer < 4; layer++) { const n = Math.round(18 * (layer + 1) * st.rough), rad = TS * (0.2 / (layer * 0.7 + 1)); for (let i = 0; i < n; i++) { o.globalAlpha = (0.04 + 0.07 * rnd()) * st.rough; o.fillStyle = rnd() < 0.5 ? "#000" : "#fff"; o.beginPath(); o.arc(rnd() * TS, rnd() * TS, rad * (0.5 + rnd()), 0, TAU); o.fill(); } }   // fractal mottling, intensity per-world
      o.globalAlpha = 1;
      const bandsT = (n, vert) => { for (let b = 0; b < n; b++) { const u = TS * (b + 1) / (n + 1); o.strokeStyle = b % 2 ? lt(0.16) : dk(0.28); o.lineWidth = TS * (0.04 + rnd() * 0.05); o.beginPath(); if (vert) { o.moveTo(u, 0); o.lineTo(u, TS); } else { o.moveTo(0, u); o.bezierCurveTo(TS * 0.33, u + TS * 0.03 * (rnd() - 0.5), TS * 0.66, u - TS * 0.03 * (rnd() - 0.5), TS, u); } o.stroke(); } };
      const cratersT = n => { for (let k = 0; k < n; k++) { const x = rnd() * TS, y = rnd() * TS, cr = TS * (0.04 + rnd() * 0.09); o.fillStyle = dk(0.42); o.beginPath(); o.arc(x, y, cr, 0, TAU); o.fill(); o.fillStyle = dk(0.3); o.beginPath(); o.arc(x - Math.cos(st.phase) * cr * 0.3, y - Math.sin(st.phase) * cr * 0.3, cr * 0.62, 0, TAU); o.fill(); o.strokeStyle = lt(0.5); o.lineWidth = cr * 0.28; o.beginPath(); o.arc(x, y, cr * 0.85, st.phase - 1.4, st.phase + 1.4); o.stroke(); } };
      if (A === "bands" || A === "ring" || A === "doublering" || A === "spot") { bandsT(A === "spot" ? 5 : 4); if (A === "spot") { o.save(); o.translate(C + TS * 0.16, C - TS * 0.1); o.rotate(st.rot); o.fillStyle = dk(0.36); o.beginPath(); o.ellipse(0, 0, TS * 0.17, TS * 0.11, 0, 0, TAU); o.fill(); o.strokeStyle = lt(0.22); o.lineWidth = TS * 0.02; o.beginPath(); o.ellipse(0, 0, TS * 0.12, TS * 0.075, 0, 0, TAU); o.stroke(); o.restore(); } }
      else if (A === "crater") cratersT(11);
      else if (A === "moon") cratersT(6);
      else if (A === "inv") cratersT(7);
      else if (A === "vstripe") bandsT(6, true);
      else if (A === "dunes") { for (let b = 0; b < 7; b++) { const u = TS * (b + 1) / 8; o.strokeStyle = b % 2 ? lt(0.14) : dk(0.26); o.lineWidth = TS * 0.04; o.beginPath(); for (let sx = 0; sx <= 14; sx++) { const xx = sx / 14 * TS, yy = u + Math.sin(sx * 0.8 + b) * TS * 0.045; sx ? o.lineTo(xx, yy) : o.moveTo(xx, yy); } o.stroke(); } }
      else if (A === "speck") { for (let i = 0; i < 80; i++) { o.fillStyle = rnd() < 0.5 ? dk(0.42) : lt(0.32); o.beginPath(); o.arc(rnd() * TS, rnd() * TS, TS * 0.018 * (1 + rnd()), 0, TAU); o.fill(); } }
      else if (A === "crack" || A === "icy") { if (A === "icy") { o.fillStyle = "#ececec"; o.fillRect(0, 0, TS, TS); } o.strokeStyle = A === "icy" ? dk(0.3) : lt(0.55); o.lineWidth = TS * 0.014; for (let k = 0; k < 8; k++) { o.beginPath(); o.moveTo(C, C); let rr = 0, aa = rnd() * TAU; for (let sg = 0; sg < 4; sg++) { rr += TS / 8; aa += (rnd() - 0.5) * 0.8; o.lineTo(C + Math.cos(aa) * rr, C + Math.sin(aa) * rr); } o.stroke(); } }
      else if (A === "swirl") { o.strokeStyle = lt(0.5); o.lineWidth = TS * 0.05; o.beginPath(); for (let sg = 0; sg <= 44; sg++) { const t2 = sg / 44, aa = st.rot + t2 * 8, rr = TS * 0.46 * t2, x = C + Math.cos(aa) * rr, y = C + Math.sin(aa) * rr; sg ? o.lineTo(x, y) : o.moveTo(x, y); } o.stroke(); }
      else if (A === "eye") { for (let k = 1; k <= 3; k++) { o.strokeStyle = k % 2 ? lt(0.2) : dk(0.36); o.lineWidth = TS * 0.07; o.beginPath(); o.arc(C, C, TS * 0.46 * k / 3.1, 0, TAU); o.stroke(); } o.fillStyle = dk(0.42); o.beginPath(); o.arc(C, C, TS * 0.07, 0, TAU); o.fill(); }
      else if (A === "facet") { const sd = 6; for (let k = 0; k < sd; k++) { const a0 = st.rot + k / sd * TAU, a1 = st.rot + (k + 1) / sd * TAU; o.fillStyle = k % 2 ? lt(0.1) : dk(0.2); o.beginPath(); o.moveTo(C, C); o.lineTo(C + Math.cos(a0) * C, C + Math.sin(a0) * C); o.lineTo(C + Math.cos(a1) * C, C + Math.sin(a1) * C); o.closePath(); o.fill(); } }
      else if (A === "half") { o.fillStyle = dk(0.6); o.save(); o.translate(C, C); o.rotate(st.phase); o.fillRect(-C, -C, C, 2 * C); o.restore(); }
      else if (A === "pulsar") { o.fillStyle = "#f6f6f6"; o.fillRect(0, 0, TS, TS); }
      cache[g] = oc; return oc;
    },
    planet(p, r, bright, current, seld, g) {
      const c = this.c, st = this.planetStyle(g), A = st.arch, lit = st.inv, t = this.t, ringed = A === "ring" || A === "doublering";
      if (current || seld) { const pulse = 0.5 + 0.5 * Math.sin(t * 4); c.strokeStyle = "rgba(255,255,255," + (0.35 + pulse * 0.5) + ")"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 7 + pulse * 3, 0, TAU); c.stroke(); }
      c.globalAlpha = bright;
      const lx = Math.cos(st.phase), ly = Math.sin(st.phase), gx = p.x + lx * r * 0.4, gy = p.y + ly * r * 0.4, lite = a => "rgba(255,255,255," + a + ")";
      // tilted ring annulus, clipped to its far (behind) or near (front) half for proper occlusion
      const ringPass = front => { c.save(); c.translate(p.x, p.y); c.rotate(st.ringAng); c.scale(1, st.ringTilt); c.beginPath(); c.rect(-r * 3, front ? 0 : -r * 3, r * 6, r * 3); c.clip();
        const rg = c.createRadialGradient(0, 0, r * 1.42, 0, 0, r * 2.3); rg.addColorStop(0, "rgba(255,255,255,0)"); rg.addColorStop(0.2, lite(bright * 0.95)); rg.addColorStop(0.4, lite(bright * 0.22)); rg.addColorStop(0.5, lite(bright * 0.55)); rg.addColorStop(0.66, lite(bright * 0.92)); rg.addColorStop(0.82, lite(bright * 0.3)); rg.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = rg; c.lineWidth = r * 0.86; c.beginPath(); c.arc(0, 0, r * 1.84, 0, TAU); c.stroke(); c.restore(); };
      if (ringed) ringPass(false);                                                                            // back of the ring (behind the planet)
      // ── textured, lit sphere ──
      c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.clip();
      const tex = this.bakeTexture(g);
      if (tex) c.drawImage(tex, p.x - r, p.y - r, 2 * r, 2 * r); else { c.fillStyle = lit ? "#bbb" : "#555"; c.fill(); }
      c.globalCompositeOperation = "multiply";                                                                // shade the albedo: highlight → terminator → limb-dark
      const sg = c.createRadialGradient(gx, gy, r * 0.05, p.x, p.y, r * 1.14);
      if (lit) { sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.55, "#e0e0e0"); sg.addColorStop(0.85, "#9c9c9c"); sg.addColorStop(1, "#6a6a6a"); }
      else if (st.hard) { sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.48, "#cccccc"); sg.addColorStop(0.6, "#3a3a3a"); sg.addColorStop(0.86, "#0c0c0c"); sg.addColorStop(1, "#030303"); }   // airless: crisp terminator
      else { sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.42, "#cacaca"); sg.addColorStop(0.76, "#585858"); sg.addColorStop(0.95, "#1a1a1a"); sg.addColorStop(1, "#080808"); }   // atmospheric: soft terminator
      c.fillStyle = sg; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.globalCompositeOperation = "lighter";                                                                 // specular/illumination bloom on the lit cap
      const hg = c.createRadialGradient(gx, gy, 0, gx, gy, r * 0.62); hg.addColorStop(0, lite(lit ? 0.5 : 0.4)); hg.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = hg; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.restore();                                                                                            // (auto-resets composite op)
      // crisp limb + a bright rim-light arc on the lit edge
      c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
      c.strokeStyle = lite(0.75); c.lineWidth = Math.max(1, r * 0.045); c.beginPath(); c.arc(p.x, p.y, r * 0.97, st.phase - 1.25, st.phase + 1.25); c.stroke();
      // atmosphere glow (soft Fresnel halo)
      if (st.halo || A === "icy" || A === "pulsar") { const ag = c.createRadialGradient(p.x, p.y, r * 0.94, p.x, p.y, r * (st.haloR + 0.26)); ag.addColorStop(0, lite(bright * 0.34)); ag.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = ag; c.beginPath(); c.arc(p.x, p.y, r * (st.haloR + 0.26), 0, TAU); c.fill(); }
      if (ringed) ringPass(true);                                                                             // front of the ring (passes in front of the planet)
      if (A === "icy") { c.fillStyle = "#fff"; const ns = 14; for (let k = 0; k < ns; k++) { const a = st.rot + k / ns * TAU; c.beginPath(); c.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); c.lineTo(p.x + Math.cos(a - 0.1) * r * 1.02, p.y + Math.sin(a - 0.1) * r * 1.02); c.lineTo(p.x + Math.cos(a) * r * 1.26, p.y + Math.sin(a) * r * 1.26); c.closePath(); c.fill(); } }   // crystalline spikes
      if (A === "pulsar") { c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.5; const ns = 10; for (let k = 0; k < ns; k++) { const a = st.rot + k / ns * TAU, ext = 1.45 + 0.28 * Math.sin(t * 3 + k); c.beginPath(); c.moveTo(p.x + Math.cos(a) * r * 0.82, p.y + Math.sin(a) * r * 0.82); c.lineTo(p.x + Math.cos(a) * r * ext, p.y + Math.sin(a) * r * ext); c.stroke(); } }   // radiating energy rays
      if (A === "moon") { const ma = st.rot + t * 0.1, mr = r * 0.3, md = r * 2.1, mx = p.x + Math.cos(ma) * md, my = p.y + Math.sin(ma) * md; const mg = c.createRadialGradient(mx + lx * mr * 0.4, my + ly * mr * 0.4, mr * 0.1, mx, my, mr); mg.addColorStop(0, "#e8e8e8"); mg.addColorStop(0.7, "#777"); mg.addColorStop(1, "#1a1a1a"); c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 1; c.stroke(); }   // shaded satellite moon (slowly orbiting)
      c.globalAlpha = 1;
    },
    // the expedition ship — a HYPER-FUTURISTIC interceptor in stark B&W: long angular dart hull, swept
    // delta wings, glowing twin ion engines (bloom + bright core) trailing energy streaks, a lit canopy,
    // panel lines and blinking wing-tip lights. All animated. Drawn nose-along `ang`.
    drawShip(x, y, ang, r) {
      const c = this.c, t = this.t, pulse = 0.6 + 0.4 * Math.sin(t * 16);
      c.save(); c.translate(x, y); c.rotate(ang);
      c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 1;                                       // hyperdrive energy streaks
      for (const wy of [-r * 0.46, 0, r * 0.46]) { c.beginPath(); c.moveTo(-r * 1.1, wy); c.lineTo(-r * (2.8 + pulse * 1.2), wy); c.stroke(); }
      for (const wy of [-r * 0.42, r * 0.42]) {                                                        // twin ion-engine bloom → bright core
        c.fillStyle = "rgba(255,255,255,0.28)"; c.beginPath(); c.arc(-r * 1.05, wy, r * (0.55 + pulse * 0.35), 0, TAU); c.fill();
        c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.arc(-r * 1.0, wy, r * 0.34, 0, TAU); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(-r * 0.95, wy, r * 0.16, 0, TAU); c.fill();
      }
      c.fillStyle = "#9a9a9a";                                                                         // swept delta wings
      c.beginPath(); c.moveTo(r * 0.1, r * 0.24); c.lineTo(-r * 0.5, r * 1.05); c.lineTo(-r * 0.95, r * 0.95); c.lineTo(-r * 0.5, r * 0.26); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.1, -r * 0.24); c.lineTo(-r * 0.5, -r * 1.05); c.lineTo(-r * 0.95, -r * 0.95); c.lineTo(-r * 0.5, -r * 0.26); c.closePath(); c.fill();
      c.fillStyle = "#fff";                                                                            // long sharp dart hull
      c.beginPath(); c.moveTo(r * 1.9, 0); c.lineTo(r * 0.5, r * 0.3); c.lineTo(-r * 0.7, r * 0.34); c.lineTo(-r * 1.05, r * 0.5); c.lineTo(-r * 0.85, 0); c.lineTo(-r * 1.05, -r * 0.5); c.lineTo(-r * 0.7, -r * 0.34); c.lineTo(r * 0.5, -r * 0.3); c.closePath(); c.fill();
      c.strokeStyle = "#111"; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 0.8;                                           // panel lines
      c.beginPath(); c.moveTo(r * 1.7, 0); c.lineTo(-r * 0.7, 0); c.stroke();
      c.beginPath(); c.moveTo(r * 0.3, r * 0.22); c.lineTo(-r * 0.6, r * 0.24); c.stroke();
      c.beginPath(); c.moveTo(r * 0.3, -r * 0.22); c.lineTo(-r * 0.6, -r * 0.24); c.stroke();
      c.fillStyle = "#000"; c.beginPath(); c.ellipse(r * 0.65, 0, r * 0.36, r * 0.18, 0, 0, TAU); c.fill();   // glowing canopy
      c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.ellipse(r * 0.78, 0, r * 0.16, r * 0.08, 0, 0, TAU); c.fill();
      if (Math.sin(t * 7) > 0) { c.fillStyle = "#fff"; for (const wy of [-r * 1.0, r * 1.0]) { c.beginPath(); c.arc(-r * 0.5, wy, r * 0.1, 0, TAU); c.fill(); } }   // blinking wing-tip nav lights
      c.restore();
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
        this.zoom = 0.7 + (this.iz0 - 0.7) * q;             // drop out: ease the zoom from close-in out to the resting (wider) galaxy view
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
          else if (p < 0.88) { tv.style.background = "radial-gradient(circle at 50% 50%, #fff 0%, #fff 32%, rgba(255,255,255,.85) 62%, rgba(255,255,255,.4) 100%)"; tv.style.opacity = "1"; }   // blooming hyperspace WHITE PUNCH
          else { tv.style.background = "#000"; tv.style.opacity = "1"; }                  // settle to black for the cut
        }
        if (p >= 1 && !fl.done) { fl.done = true; const cb = fl.onArrive, gg = fl.g; this.flight = null; this._warp = 1; this._diveP = null; if (tv) { tv.style.background = "#000"; tv.style.opacity = "1"; } if (cb) cb();
          veilT = VEIL_FADE; landT = LAND_DUR; camZoom = camFit * 2.3;                    // arrive zoomed on the base, then pull back
          shakeAdd(9); flashAdd(0.4); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.6, 0.6); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.34, 0.4); burst(W / 2, H / 2, 34, 240, 2.8);   // landing impact
          const lt = $("land-title"); if (lt) { const wall = PLANET_LOCAL[planetIdx(gg)] === 0 && gg > 1;   // first world of a NEW solar system = the difficulty wall
            lt.innerHTML = galName(gg).toUpperCase() + "  ·  " + sysName(gg) + (wall ? "<span class='lt-sub'>▲ NEW FRONTIER — the dots here are far tougher. Rebuild and earn your footing.</span>" : "");
            if (wall) { shakeAdd(6); flashAdd(0.25); }
            lt.classList.remove("show"); void lt.offsetWidth; lt.classList.add("show"); }
        }
      }
      this.cx += (this.tcx - this.cx) * Math.min(1, dt * 5); this.cz += (this.tcz - this.cz) * Math.min(1, dt * 5);   // smooth focus glide
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this._diveP != null && opt("shake")) { const sh = this._diveP * this._diveP * 10; c.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh); }   // build-up camera shake during the dive
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
        const r = clamp(7 * p.f * this.planetStyle(g).sizeMul, 2, 38), bright = current ? 1 : reached ? 0.85 : next ? 0.8 : 0.3;   // wide min/max so tiny moons & giant worlds both read
        this.hit.push({ g, x: p.x, y: p.y, r: Math.max(r + 11, 24) });
        this.planet(p, r, bright, current, g === this.sel, g);
        c.globalAlpha = clamp(p.f, 0.4, 1); c.textAlign = "center"; c.fillStyle = (reached || current || next) ? "#fff" : "rgba(255,255,255,0.5)"; c.font = Math.round(10 * clamp(p.f, 0.7, 1.3)) + "px ui-monospace,monospace";
        c.fillText((current ? "▶ " : "") + galName(g), p.x, p.y - r - 7);
        c.globalAlpha = 1;
      }
      // ── your expedition in transit: a STATIC dashed trajectory (frozen at launch), an OUTLINE of the
      //    destination where you're headed, and a detailed little ship riding ON the line ──
      if (S && S.travel) {
        const tv = S.travel;
        if (!tv.fromW) tv.fromW = this.planetWorld(tv.from);   // snapshot BOTH endpoints once (covers older saves) — from here the line is frozen and NEVER tracks the orbiting planets
        if (!tv.toW) tv.toW = this.planetWorld(tv.to);
        const a = tv.fromW, b = tv.toW, pr = clamp(tv.t / tv.dur, 0, 1);
        const pa = this.proj(a.x, a.y, a.z), pb = this.proj(b.x, b.y, b.z);
        c.save();
        // STILL DASHED DUPLICATE of the destination planet — frozen at the launch-time target (its real
        // size + ring), so you always see where you're landing even as the live planet keeps orbiting away
        { const st = this.planetStyle(tv.to), dr = clamp(7 * pb.f * st.sizeMul, 3, 18);
          c.save(); c.setLineDash([3, 4]); c.lineWidth = 1.3; c.strokeStyle = "rgba(255,255,255,0.62)";
          c.beginPath(); c.arc(pb.x, pb.y, dr, 0, TAU); c.stroke();                                                  // dashed planet body at its true size
          if (st.ring) { c.save(); c.translate(pb.x, pb.y); c.rotate(st.ringAng); c.scale(1, st.ringTilt); c.beginPath(); c.arc(0, 0, dr * 1.7, 0, TAU); c.stroke(); c.restore(); }   // dashed ring if it has one
          c.restore(); c.setLineDash([]);
          c.fillStyle = "rgba(255,255,255,0.85)"; c.font = "9px ui-monospace,monospace"; c.textAlign = "center";
          c.fillText("◎ " + galName(tv.to), pb.x, pb.y - dr - 8); }
        // STATIC dashed trajectory — frozen endpoints, so it never drifts as the planets orbit
        c.setLineDash([4, 6]); c.lineWidth = 1.3; c.strokeStyle = "rgba(255,255,255,0.4)";
        c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke(); c.setLineDash([]);
        // ship rides ON the (screen-space) line — interpolate the projected endpoints, no off-plane arc
        const sp = { x: pa.x + (pb.x - pa.x) * pr, y: pa.y + (pb.y - pa.y) * pr, f: pa.f + (pb.f - pa.f) * pr };
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), r = clamp(8 * sp.f, 6, 14);
        c.restore();
        this.drawShip(sp.x, sp.y, ang, r);
        c.fillStyle = "rgba(255,255,255,0.9)"; c.font = "bold 10px ui-monospace,monospace"; c.textAlign = "center";
        c.fillText(fmtTime(Math.max(0, tv.dur - tv.t)) + " ⟶", sp.x, sp.y - r - 9);
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
    v.earned = curEarned; v.bgRate = Math.max(v.bgRate || 0, Math.min(cps * BG_EFF, baseTarget(S.galaxy) / (IDLE_PAYBACK_H * 3600)));   // m7 fix: the live-cps idle estimate is CLAMPED to the designed conquer-set rate, so an over-built planet can't permanently inflate its empire idle above the curve
  }
  function activatePlanet(g) {   // make planet g the live playfield (restore its build, or fresh-start it)
    const v = planetMeta(g), fresh = !(v && v.units), b = fresh ? freshPlanetBuild() : v;
    S.cash = fresh ? Math.floor(eco(g) * startMul(g)) : (b.cash || 0);   // a fresh landing comes with starter supplies so you build immediately
    S.units = (b.units && b.units.length) ? b.units : [newUnit("turret")];
    S.collectors = (b.collectors && b.collectors.length) ? b.collectors : [{ type: "drone" }];
    S.lv = b.lv || freshPlanetBuild().lv; S.classNodes = b.classNodes || freshPlanetBuild().classNodes;
    S.galaxy = g; if (g > S.peakGalaxy) S.peakGalaxy = g; curEarned = v.earned || 0;
    dots = []; orbs = []; beams = []; shells = []; parts = []; selUnit = -1;
    syncCollectors(); recompute(); renderList(); syncHUD(); GMap.reset && 0;
  }
  // journey time is RELATIVE TO THE REAL MAP DISTANCE between the two planets (the line the ship
  // flies). Calibrated so the first short hop ≈ 3h; far planets & inter-system hauls scale up
  // naturally (the big cross-system jumps land around a day+).
  const TRAVEL_SEC_PER_UNIT = 26.8;   // ~1/3 of the old pace — journeys are a third as long
  function travelDur(a) {
    let d = 67;
    try { const pa = GMap.planetWorld(a), pb = GMap.planetWorld(a + 1); d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z); } catch (e) {}
    return Math.max(600, Math.round(d * TRAVEL_SEC_PER_UNIT));
  }
  function travel() {   // LAUNCH an expedition to the next planet: costs treasury + takes a real journey
    const g = S.galaxy;
    if (S.travel) return;                                   // already en route
    if (g >= TOTAL_PLANETS) return;                         // no planet beyond the last
    if (!S.free && !planetMeta(g).conquered) return;        // must conquer the current planet first
    const cost = travelCost();
    if (!S.free && S.cash < cost) return;                   // need the launch funds banked
    if (!S.free) { S.cash -= cost; }
    let fromW = null, toW = null; try { const w = GMap.planetWorld(g), w2 = GMap.planetWorld(g + 1); fromW = { x: w.x, y: w.y, z: w.z }; toW = { x: w2.x, y: w2.y, z: w2.z }; } catch (e) {}   // freeze BOTH endpoints at launch — the trajectory line is fixed in space and never drifts as the planets orbit
    S.travel = { from: g, to: g + 1, t: 0, dur: travelDur(g), fromW, toW };
    META.stats.travels++; flashAdd(0.35); shakeAdd(2); vibe(60); recompute(); syncHUD(); save();
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
    $("btn-ascend").style.display = (s === "play") ? "flex" : "none";
    if (s === "play") syncAutoBtn();
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
    if (gptrs.size >= 2) { const a = [...gptrs.values()], d = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy); if (pinchD0) camZoom = clamp(camZoom * d / pinchD0, camFit * ZOOM_OUT, 1.15); pinchD0 = d; return; }   // pinch to zoom the playfield
    if (!drawing) return;
    const p = ptr(e), dx = p.x - lastDraw.x, dy = p.y - lastDraw.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / 14));
    for (let i = 1; i <= steps; i++) { const bx = lastDraw.x + dx * i / steps, by = lastDraw.y + dy * i / steps; brushAt(bx, by); collectAt(bx, by); }
    lastDraw = p;
  });
  const endDraw = e => { if (e && e.pointerId !== undefined) gptrs.delete(e.pointerId); if (gptrs.size < 2) pinchD0 = 0; drawing = false; };
  canvas.addEventListener("pointerup", endDraw); canvas.addEventListener("pointercancel", endDraw); canvas.addEventListener("pointerleave", endDraw);
  canvas.addEventListener("wheel", e => { if (state !== "play") return; e.preventDefault(); camZoom = clamp(camZoom * (1 - e.deltaY * 0.0012), camFit * ZOOM_OUT, 1.15); }, { passive: false });

  /* ----------------------------- wiring -------------------------- */
  for (const t of document.querySelectorAll(".tab[data-tab]")) { tabBtns[t.dataset.tab] = t; t.onclick = () => { activeTab = t.dataset.tab; for (const k in tabBtns) tabBtns[k].classList.toggle("sel", tabBtns[k] === t); renderList(); }; }
  const syncBuyMode = () => { const b = $("buymode"); if (!b || !S) return; b.style.display = S.free ? "" : "none"; b.textContent = "BUY ×" + BUY_AMTS[buyIdx]; };
  if ($("buymode")) $("buymode").onclick = () => { buyIdx = (buyIdx + 1) % BUY_AMTS.length; syncBuyMode(); renderList(); };
  $("ab-frenzy").onclick = () => useAbility("frenzy"); $("ab-dotrain").onclick = () => useAbility("dotrain"); $("ab-blackhole").onclick = () => useAbility("blackhole");
  for (const i of document.querySelectorAll(".ab-i")) i.onclick = e => { e.stopPropagation(); const k = i.dataset.info; showInfo({ frenzy: "Frenzy", dotrain: "Dot Rain", blackhole: "Black Hole" }[k], k); };
  $("info-close").onclick = $("info-back").onclick = () => $("info-modal").classList.remove("show");
  $("btn-travel").onclick = () => { if (S.travel) { if (S.free) S.travel.t = S.travel.dur; return; } travel(); };   // free mode: tapping while EN ROUTE skips the journey timer (arrival is processed next update tick)
  const openFx = () => { if (!$("fxpage")) return; openExchange(); $("fxpage").classList.add("show"); };   // EXCHANGE retired — one global currency now; guarded so the removed buttons can't throw
  if ($("btn-exchange")) $("btn-exchange").onclick = openFx;
  if ($("fx-close")) $("fx-close").onclick = () => $("fxpage").classList.remove("show");
  if ($("fx-massconvert")) $("fx-massconvert").onclick = () => { exchangeAll(); openExchange(); };
  $("galaxy-open").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); syncAutoBtn(); }; $("gm-close").onclick = () => { $("galaxy-map").classList.remove("show"); GMap.hide(); };
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
  $("st-auto").onclick = () => { STree.pick = !STree.pick; };   // toggle node-picking for the bound Auto-Buy step
  if ($("gm-exchange")) $("gm-exchange").onclick = openFx;
  $("btn-metrics").onclick = () => { buildMetrics(); $("metrics").classList.add("show"); };
  $("metrics-close").onclick = $("metrics-back").onclick = () => $("metrics").classList.remove("show");
  $("btn-ascend").onclick = openAscend;
  $("ascend-close").onclick = $("ascend-back").onclick = () => $("ascend").classList.remove("show");
  $("btn-auto").onclick = $("gm-auto").onclick = () => openAuto(S.galaxy);   // dock / map-bar → the planet you're ON
  $("auto-close").onclick = $("auto-back").onclick = () => $("auto-modal").classList.remove("show");
  $("auto-toggle").onclick = () => { const cfg = curAuto(); cfg.on = !cfg.on; autoAcc = 0; save(); renderAuto(); };   // (hidden in the all-planets overview; per-planet power toggles are used)
  $("dock-toggle").onclick = () => { const d = $("dock"); const min = d.classList.toggle("min"); $("dock-toggle").textContent = min ? "▴ Menu" : "▾ Minimise"; };
  // ── SETTINGS menu (data-driven; opts persist in META.opts) ──
  const OPT_DEFS = [
    { k: "sound", t: "toggle", lbl: iconMarkup("sound") + "Sound effects", sub: "warp & UI audio" },
    { k: "haptics", t: "toggle", lbl: iconMarkup("vibe") + "Vibration", sub: "haptic feedback (mobile)" },
    { k: "shake", t: "toggle", lbl: iconMarkup("shake") + "Screen shake" },
    { k: "flash", t: "toggle", lbl: iconMarkup("bolt") + "Screen flashes", sub: "reduce for photosensitivity" },
    { k: "fx", t: "seg", lbl: iconMarkup("spark") + "Particle effects", sub: "lower to boost FPS on older phones", opts: [["full", "Full"], ["low", "Low"], ["off", "Off"]] },
    { k: "notation", t: "seg", lbl: iconMarkup("hash") + "Number format", sub: "how huge numbers are shown", opts: [["short", "1.2M"], ["sci", "1.2e6"]] },
  ];
  function refreshNums() { try { syncHUD(); } catch (e) {} try { renderList(); } catch (e) {} }
  function renderSettings() {
    const box = $("set-list"); if (!box) return; box.innerHTML = "";
    OPT_DEFS.forEach(d => {
      const row = document.createElement("div"); row.className = "set-row";
      const lab = document.createElement("div"); lab.className = "set-lbl";
      lab.innerHTML = "<b>" + d.lbl + "</b>" + (d.sub ? "<span>" + d.sub + "</span>" : "");
      const ctrl = document.createElement("div"); ctrl.className = "set-ctrl";
      if (d.t === "toggle") {
        const sw = document.createElement("button"); sw.className = "sw" + (opt(d.k) ? " on" : ""); sw.innerHTML = '<span class="knob"></span>';
        sw.onclick = () => { META.opts[d.k] = !opt(d.k); save(); renderSettings(); vibe(10); };
        ctrl.appendChild(sw);
      } else {
        const seg = document.createElement("div"); seg.className = "seg";
        d.opts.forEach(([val, txt]) => { const b = document.createElement("button"); b.textContent = txt; if (opt(d.k) === val) b.className = "on";
          b.onclick = () => { META.opts[d.k] = val; save(); renderSettings(); refreshNums(); vibe(10); }; seg.appendChild(b); });
        ctrl.appendChild(seg);
      }
      row.appendChild(lab); row.appendChild(ctrl); box.appendChild(row);
    });
  }
  function openSettings() { renderSettings(); $("settings").classList.add("show"); }
  $("btn-menu").onclick = () => $("menu").classList.add("show");
  $("menu-close").onclick = () => $("menu").classList.remove("show");
  $("menu-resume").onclick = () => $("menu").classList.remove("show");
  $("menu-home").onclick = () => { save(); $("menu").classList.remove("show"); setScreen("home"); };   // back to the home screen (progress saved)
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress?")) wipeSave(); };
  $("menu-settings").onclick = () => { $("menu").classList.remove("show"); openSettings(); };
  $("home-settings").onclick = () => openSettings();
  $("set-close").onclick = $("set-back").onclick = () => $("settings").classList.remove("show");
  $("set-how").onclick = () => $("how").classList.add("show");
  // ---- FIRST-RUN COACH MARKS: a guided walkthrough of the whole loop, shown once on a fresh save ----
  const TUT_STEPS = [
    { t: "Welcome, commander", x: "Your goal: conquer all <b>18 worlds</b> of the cluster. Your defenders auto-fire at the dots, and <b>killing dots is your entire economy</b> — let's run through how it all works." },
    { sel: "#game", t: "Blast the field", x: "<b>Drag across the field</b> to fire a sweep yourself — go on, try it now, then tap Next. Active play is the fast path; dots are tanky, and the more you kill the more cash they drop." },
    { sel: '#tabs [data-tab="def"]', t: "Defenders", x: "Defenders auto-fire on their own. Buy more and switch classes in the <b>DEFENCE</b> tab — each class has a niche: <b>anti-swarm</b> (Mortar, Laser) vs <b>anti-armor</b> (Plasma, Railgun, Nova)." },
    { sel: "#up-list", t: "Skill trees", x: "Tap a defender's <b>⬆ Tree</b> to open its skill web — try it now: <b>Damage, Fire Rate, Range</b>, and <b>Mind</b> (smart targeting, no wasted shots). ✦ <b>Keystones</b> add multishot plus a weapon special. Close it and tap Next when ready." },
    { sel: '#tabs [data-tab="drone"]', t: "Collectors", x: "Killed dots drop <b>cash orbs</b> — collectors gather them. Buy & upgrade them in the <b>COLLECTORS</b> tab, or your loot expires uncollected." },
    { sel: '#tabs [data-tab="eco"]', t: "Economy", x: "The <b>ECONOMY</b> tab boosts cash value, spawn rate, your cash ceiling, and luck — the backbone of your income." },
    { sel: "#abilities", t: "Abilities", x: "Tap an ability for a burst: <b>Frenzy</b> (fire rate), <b>Dot Rain</b> (flood the field), or <b>Black Hole</b> (vacuum). They run on cooldowns." },
    { sel: "#galaxy-open", t: "Conquer & travel", x: "Fill <b>this bar</b> to conquer the planet and unlock <b>Travel</b>. Tap the bar for the <b>star map</b> — three solar systems, and every planet's native race has a <b>weakness</b> shown there." },
    { sel: "#btn-ascend", t: "Ascension", x: "Conquering planets earns 💎 <b>Gems</b>. Spend them here on <b>permanent perks</b> that carry from planet to planet — they never reset." },
    { t: "Go conquer", x: "That's the loop: <b>kill dots → gather cash → upgrade → fill the bar → travel</b>. Take all 18 worlds. Good luck, commander!" },
  ];
  const Tut = {
    i: 0,
    start(force) { if (!force && META.tutorialDone) return; this.i = 0; $("tutorial").classList.add("show"); this.render(); },
    render() {
      const s = TUT_STEPS[this.i], wrap = $("tutorial"), spot = $("tut-spot"), card = $("tut-card");
      $("tut-step").textContent = "STEP " + (this.i + 1) + " / " + TUT_STEPS.length;
      $("tut-title").textContent = s.t; $("tut-text").innerHTML = s.x;
      $("tut-next").textContent = this.i >= TUT_STEPS.length - 1 ? "Got it ✓" : "Next ▸";
      const el = s.sel ? document.querySelector(s.sel) : null, r = el && el.getBoundingClientRect();
      if (r && r.width) { wrap.classList.remove("nospot"); const pad = 6;
        spot.style.left = (r.left - pad) + "px"; spot.style.top = (r.top - pad) + "px"; spot.style.width = (r.width + pad * 2) + "px"; spot.style.height = (r.height + pad * 2) + "px";
        card.style.transform = "translateX(-50%)";
        if (r.top + r.height / 2 < innerHeight / 2) { card.style.top = "auto"; card.style.bottom = "20px"; } else { card.style.top = "20px"; card.style.bottom = "auto"; }
      } else { wrap.classList.add("nospot"); }   // no target → centered card on a dim backdrop
    },
    next() { this.i++; if (this.i >= TUT_STEPS.length) this.finish(); else this.render(); },
    finish() { $("tutorial").classList.remove("show"); META.tutorialDone = true; save(); },
  };
  $("tut-next").onclick = () => Tut.next();
  $("tut-skip").onclick = () => Tut.finish();
  $("set-tutorial").onclick = () => { $("settings").classList.remove("show"); if (state !== "play") { renderList(); setScreen("play"); } setTimeout(() => Tut.start(true), 350); };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  $("home-play").onclick = () => { renderList(); setScreen("play"); if (!META.tutorialDone) setTimeout(() => Tut.start(), 550); };   // first-run coach marks once the play UI is laid out
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
    camZoom = camZoom ? clamp(camZoom, camFit * ZOOM_OUT, 1.15) : camFit;            // default still fills the screen; you can now pull back to camFit*ZOOM_OUT to see more
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
  hydrateIcons(document);   // swap all static <i data-ico> placeholders for the bespoke SVG glyphs
  load(); resize(); syncCollectors(); renderList(); GMap.init(); STree.init(); setScreen("home"); syncBuyMode();
  if (S._welcome) { const w = S._welcome; $("welcome-text").textContent = "Your empire kept earning for " + fmtTime(w.elapsed) + "." + (w.autoBought ? "  Auto-Buy spent it on " + w.autoBought + " upgrade" + (w.autoBought === 1 ? "" : "s") + " while you were away." : ""); $("welcome-cash").textContent = curSym(S.galaxy) + " " + fmt(w.gain); $("welcome").classList.add("show"); S._welcome = null; }
  window.addEventListener("beforeunload", save);
  requestAnimationFrame(loop);

  if (typeof window !== "undefined") window.__IDS = { S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, parts: () => parts, shake: () => shake, drones: () => drones, units: () => S.units, collectors: () => S.collectors, uDmg, uRate, cSpeed, cReach, cPull, cSuction: cReach, cCollect: cReach, cYield, brushAt, collectAt, useAbility, travel, fmt, buyUnit, buyUp: id => buyUpgrade(UP[id]), upCost: id => upCost(UP[id]), buildTree, allocNode, nodeAllocatable, nodeAllocated, nodeLabel, classStats: t => classStats(t), unitPos, openSkillTree, showNodeInfo, showInfo, sellOne, showGalaxyInfo, recompute, setScreen, abil: () => abil, travelCost, galSpawnMul, galCap, state: () => state, GMap, STree, isCol, doExchange, exchangeAll, exchangeAmt, importRoom, importCap: () => IMPORT_CAP(S.galaxy), fxRate, buyPerk, openAscend, PERKS };
  // read-only scaling hooks for the headless pacing/scaling simulator (tools/playthrough-sim.js) — no game logic, just exposes the real curves so the sim can never diverge from the shipped game
  if (typeof window !== "undefined") window.__SIM = {
    TOTAL_PLANETS, CONQ_STEP, SYS_JUMP, WITHIN_STEP, CUR_BASE, TOUGH_POW, BUY_MUL,
    eco, diff, enemyHpMul, conquerTarget, travelCost, startMul,
    unitBuyCost: t => unitBuyCost(t), upCost: id => upCost(UP[id]),
    DEF_TYPES, COL_TYPES, DEF_ORDER, COL_ORDER, UNIT_FACTOR, DEF_SCALE,
    SYSTEMS, PLANET_LOCAL: () => PLANET_LOCAL, PLANET_SYS: () => PLANET_SYS,
    valueMul: lv => 1 + 0.08 * lv,
    spawnBoss, grantTreeNodes, dots: () => dots,
    PERKS, gemReward, perkAgg,
    baseTarget, conquerHours, IDLE_FRAC, ACTIVE_REF, IDLE_PAYBACK_H, EMPIRE_RAMP, BOSS_GEM_CHANCE, BOSS_NODE_CHANCE,
    RACES, raceNiche, NICHE_HINT,
  };
})();
