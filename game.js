/* =====================================================================
   HIVE WORLDS — Galactic Tower Defense (HTML5 / Canvas / JS)
   Single-file engine. Sections:
     1. Canvas + utils         5. Star map (universe/galaxy/system)
     2. Game data              6. Battle simulation
     3. Progress (save)        7. Battle rendering
     4. State machine + UI     8. Input + main loop
   ===================================================================== */
(() => {
  "use strict";

  // ============================ 1. CANVAS + UTILS ====================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state === "battle") computeGrid();
  }
  window.addEventListener("resize", resize);

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const TAU = Math.PI * 2;

  // ============================ 2. GAME DATA =========================
  // ---- Galaxies -> Systems -> Planets (each planet is a level) ----
  const GALAXIES = [
    { name: "Andromeda Verge", hue: 165, systems: [
      { name: "Sol Prime", star: "#ffd45e", planets: [
        { name: "Verda",    biome: ["#56c878", "#1c6b3e"] },
        { name: "Cindros",  biome: ["#ff9d4d", "#a8501c"] },
        { name: "Aquon",    biome: ["#4db8ff", "#1c5ba8"] },
      ]},
      { name: "Cygnus Gate", star: "#7ab8ff", planets: [
        { name: "Frostholm", biome: ["#bdf2ff", "#4d8ca8"] },
        { name: "Dunsea",    biome: ["#e7cc77", "#a8853c"] },
        { name: "Mycera",    biome: ["#c98cff", "#6b3ca8"] },
      ]},
    ]},
    { name: "Crimson Reach", hue: 5, systems: [
      { name: "Ember Cross", star: "#ff7a4d", planets: [
        { name: "Pyros",   biome: ["#ff6b5a", "#8a2418"] },
        { name: "Ashen",   biome: ["#b06b5a", "#3a1c16"] },
        { name: "Magmara", biome: ["#ffb04d", "#a83c1c"] },
      ]},
      { name: "Bloodstar", star: "#ff5577", planets: [
        { name: "Vermil",  biome: ["#ff5577", "#8a1c3c"] },
        { name: "Crava",   biome: ["#d94d8c", "#6b1c4d"] },
        { name: "Scorne",  biome: ["#ff8c6b", "#8a3018"] },
      ]},
    ]},
    { name: "Violet Expanse", hue: 280, systems: [
      { name: "Nebula Heart", star: "#c98cff", planets: [
        { name: "Lumia",   biome: ["#c98cff", "#5a2ca8"] },
        { name: "Xenth",   biome: ["#8c6bff", "#3c2c8a"] },
        { name: "Orphea",  biome: ["#a8c8ff", "#3c5ba8"] },
      ]},
      { name: "Void Crown", star: "#7affd4", planets: [
        { name: "Cryx",    biome: ["#7affd4", "#1c8a6b"] },
        { name: "Nethys",  biome: ["#6bff9d", "#1c8a4d"] },
        { name: "Omega",   biome: ["#ffffff", "#7a7aff"] },
      ]},
    ]},
  ];
  // Flatten to a global ordered planet list.
  const PLANETS = [];
  GALAXIES.forEach((g, gi) => g.systems.forEach((s, si) => s.planets.forEach((p, pi) => {
    PLANETS.push({ gi: PLANETS.length, galaxy: gi, system: si, planet: pi, ref: p, sysRef: s });
  })));

  function planetConfig(idx) {
    return {
      hive: 30 + idx * 6,
      hpMul: 1 + idx * 0.20,
      speed: 24 + idx * 2.2,
      dmgMul: 1 + idx * 0.14,
      spawn: Math.max(0.35, 1.3 - idx * 0.07),
    };
  }

  // ---- Enemy species ----
  const ENEMY_TYPES = {
    crawler:  { name: "Crawler",  hp: 1.0, spd: 1.0, size: 1.0, dmg: 1.0, color: "#9be88a" },
    runner:   { name: "Runner",   hp: 0.6, spd: 1.9, size: 0.8, dmg: 0.7, color: "#ffe96b" },
    brute:    { name: "Brute",    hp: 3.2, spd: 0.55,size: 1.7, dmg: 2.2, color: "#ff8c5a" },
    shielded: { name: "Shielded", hp: 1.4, spd: 0.9, size: 1.1, dmg: 1.1, color: "#7ad0ff", shield: 1.2 },
    flyer:    { name: "Flyer",    hp: 0.8, spd: 1.5, size: 0.9, dmg: 0.9, color: "#d79bff", fly: true },
    splitter: { name: "Splitter", hp: 1.6, spd: 0.85,size: 1.3, dmg: 1.0, color: "#9bffd0", split: 3 },
    healer:   { name: "Healer",   hp: 1.5, spd: 0.8, size: 1.0, dmg: 0.6, color: "#ff9bd0", heal: true },
  };
  function availableSpecies(idx) {
    const list = ["crawler", "runner"];
    if (idx >= 2) list.push("brute");
    if (idx >= 4) list.push("shielded");
    if (idx >= 5) list.push("flyer");
    if (idx >= 7) list.push("splitter");
    if (idx >= 9) list.push("healer");
    return list;
  }

  // ---- Tower types + skill trees ----
  // node: { id, name, desc, cost, req:[ids], apply(t) }
  const TOWER_TYPES = {
    blaster: {
      name: "Blaster", cost: 45, color: "#45e0c0",
      base: { range: 175, damage: 9, fireRate: 1.6, projSpeed: 460, splash: 0, slowMul: 1, slowDur: 0, chain: 0 },
      desc: "Reliable rapid-fire turret.",
      tree: [
        { id: "hr",  name: "Heavy Rounds", desc: "+6 damage", cost: 30, req: [], apply: t => t.damage += 6 },
        { id: "ds",  name: "Depleted Slugs", desc: "+10 damage", cost: 60, req: ["hr"], apply: t => t.damage += 10 },
        { id: "al",  name: "Auto-Loader", desc: "+0.6 fire rate", cost: 30, req: [], apply: t => t.fireRate += 0.6 },
        { id: "oc",  name: "Overclock", desc: "+0.9 fire rate", cost: 70, req: ["al"], apply: t => t.fireRate += 0.9 },
        { id: "lb",  name: "Long Barrel", desc: "+60 range", cost: 35, req: [], apply: t => t.range += 60 },
        { id: "tc",  name: "Twin Cannon", desc: "+1.2 rate, +damage", cost: 120, req: ["hr", "al"], apply: t => { t.fireRate += 1.2; t.damage += 6; } },
      ],
    },
    sniper: {
      name: "Sniper", cost: 80, color: "#ffd45e",
      base: { range: 360, damage: 34, fireRate: 0.55, projSpeed: 900, splash: 0, slowMul: 1, slowDur: 0, chain: 0 },
      desc: "Extreme range, huge single-target hits.",
      tree: [
        { id: "ap",  name: "AP Core", desc: "+18 damage", cost: 40, req: [], apply: t => t.damage += 18 },
        { id: "rg",  name: "Railgun", desc: "+40 damage", cost: 90, req: ["ap"], apply: t => t.damage += 40 },
        { id: "sc",  name: "Scope", desc: "+120 range", cost: 40, req: [], apply: t => t.range += 120 },
        { id: "ee",  name: "Eagle Eye", desc: "+90 range, +15 dmg", cost: 100, req: ["sc"], apply: t => { t.range += 90; t.damage += 15; } },
        { id: "rb",  name: "Rapid Bolt", desc: "+0.4 fire rate", cost: 60, req: [], apply: t => t.fireRate += 0.4 },
        { id: "hs",  name: "Headshot", desc: "+70 damage", cost: 160, req: ["ap", "rg"], apply: t => t.damage += 70 },
      ],
    },
    cannon: {
      name: "Cannon", cost: 90, color: "#ff8c5a",
      base: { range: 200, damage: 16, fireRate: 0.7, projSpeed: 320, splash: 48, slowMul: 1, slowDur: 0, chain: 0 },
      desc: "Lobs explosive shells — splash damage.",
      tree: [
        { id: "bs",  name: "Bigger Shells", desc: "+12 damage", cost: 40, req: [], apply: t => t.damage += 12 },
        { id: "wb",  name: "Wide Blast", desc: "+22 splash radius", cost: 50, req: [], apply: t => t.splash += 22 },
        { id: "cl",  name: "Cluster", desc: "+18 splash, +8 dmg", cost: 110, req: ["wb"], apply: t => { t.splash += 18; t.damage += 8; } },
        { id: "ff",  name: "Fast Fuse", desc: "+0.4 fire rate", cost: 50, req: [], apply: t => t.fireRate += 0.4 },
        { id: "ho",  name: "Heavy Ord", desc: "+20 damage", cost: 100, req: ["bs"], apply: t => t.damage += 20 },
        { id: "cb",  name: "Carpet Bomb", desc: "+40 splash", cost: 160, req: ["cl"], apply: t => t.splash += 40 },
      ],
    },
    frost: {
      name: "Frost", cost: 70, color: "#7ad0ff",
      base: { range: 165, damage: 5, fireRate: 1.2, projSpeed: 420, splash: 0, slowMul: 0.55, slowDur: 1.4, chain: 0 },
      desc: "Chills enemies, slowing the swarm.",
      tree: [
        { id: "dc",  name: "Deep Chill", desc: "Stronger slow", cost: 40, req: [], apply: t => t.slowMul = Math.max(0.18, t.slowMul - 0.18) },
        { id: "lf",  name: "Long Freeze", desc: "+1.2s slow", cost: 40, req: [], apply: t => t.slowDur += 1.2 },
        { id: "fb",  name: "Frost Bite", desc: "+7 damage", cost: 40, req: [], apply: t => t.damage += 7 },
        { id: "gl",  name: "Glacier", desc: "+70 range", cost: 50, req: [], apply: t => t.range += 70 },
        { id: "az",  name: "Absolute Zero", desc: "Near-freeze + dmg", cost: 140, req: ["dc", "lf"], apply: t => { t.slowMul = 0.12; t.damage += 10; } },
        { id: "sh",  name: "Shatter", desc: "+14 damage", cost: 90, req: ["fb"], apply: t => t.damage += 14 },
      ],
    },
    tesla: {
      name: "Tesla", cost: 110, color: "#a88cff",
      base: { range: 185, damage: 11, fireRate: 1.1, projSpeed: 0, splash: 0, slowMul: 1, slowDur: 0, chain: 2 },
      desc: "Chain lightning arcs between enemies.",
      tree: [
        { id: "cd",  name: "Conductor", desc: "+1 chain", cost: 50, req: [], apply: t => t.chain += 1 },
        { id: "hv",  name: "High Voltage", desc: "+8 damage", cost: 40, req: [], apply: t => t.damage += 8 },
        { id: "am",  name: "Arc Master", desc: "+2 chain, +range", cost: 110, req: ["cd"], apply: t => { t.chain += 2; t.range += 40; } },
        { id: "cp",  name: "Capacitor", desc: "+0.7 fire rate", cost: 60, req: [], apply: t => t.fireRate += 0.7 },
        { id: "ov",  name: "Overload", desc: "+16 damage", cost: 110, req: ["hv"], apply: t => t.damage += 16 },
        { id: "st",  name: "Storm", desc: "+3 chain", cost: 170, req: ["am"], apply: t => t.chain += 3 },
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

  // ============================ 3. PROGRESS (SAVE) ===================
  const SAVE_KEY = "hiveworlds.v2";
  let progress = { conquered: {}, maxUnlocked: 0 };
  function loadProgress() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) progress = s; } catch (e) {}
    if (!progress.conquered) progress.conquered = {};
    if (typeof progress.maxUnlocked !== "number") progress.maxUnlocked = 0;
  }
  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) {} }
  function isUnlocked(gi) { return gi <= progress.maxUnlocked; }
  function conqueredCount() { return Object.keys(progress.conquered).filter(k => progress.conquered[k]).length; }

  // ============================ 4. STATE + UI ========================
  let state = "menu";   // menu | howto | map | battle | clear
  const el = id => document.getElementById(id);
  const screens = {
    menu: el("menu"), howto: el("howto"), clear: el("clear"),
    mapUI: el("map-ui"), battleUI: el("battle-ui"),
  };
  function setState(s) {
    state = s;
    screens.menu.classList.toggle("visible", s === "menu");
    screens.howto.classList.toggle("visible", s === "howto");
    screens.clear.classList.toggle("visible", s === "clear");
    screens.mapUI.classList.toggle("visible", s === "map");
    screens.battleUI.classList.toggle("visible", s === "battle" || s === "clear");
    if (s === "menu") el("menu-progress").textContent = "Planets conquered: " + conqueredCount() + " / " + PLANETS.length;
    if (s === "battle") computeGrid();
  }

  // ============================ 5. STAR MAP ==========================
  let map = { level: "universe", galaxy: 0, system: 0, t: 0 };
  let mapTargets = [];   // clickable hot-zones built each render

  function drawStarfield(seedShift) {
    ctx.fillStyle = "#04070d";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (let i = 0; i < 120; i++) {
      const x = (Math.sin(i * 12.9898 + seedShift) * 43758.5453 % 1 + 1) % 1 * W;
      const y = (Math.sin(i * 78.233 + seedShift) * 12543.987 % 1 + 1) % 1 * H;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(map.t * 0.8 + i));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = i % 5 === 0 ? "#9cf" : "#fff";
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Pseudo-3D shaded, rotating planet.
  function drawPlanet(cx, cy, r, biome, conquered, locked, ringHue) {
    // atmosphere glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.6);
    glow.addColorStop(0, "rgba(120,200,255,0.0)");
    glow.addColorStop(0.7, conquered ? "rgba(120,255,200,0.18)" : "rgba(120,180,255,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, TAU); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    // base sphere (lit from upper-left)
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    const c0 = locked ? "#6a727a" : biome[0];
    const c1 = locked ? "#2a2f34" : biome[1];
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // rotating surface bands
    const rot = map.t * 0.4;
    ctx.globalAlpha = locked ? 0.15 : 0.32;
    for (let i = 0; i < 5; i++) {
      const bx = cx + Math.sin(rot + i * 1.7) * r * 0.9 - r;
      ctx.fillStyle = i % 2 ? c1 : c0;
      ctx.fillRect(bx, cy - r, r * 0.5, r * 2);
    }
    ctx.globalAlpha = 1;
    // terminator shadow
    const sh = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.2, cx + r * 0.3, cy + r * 0.3, r * 1.3);
    sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // rim light
    ctx.strokeStyle = conquered ? "rgba(120,255,200,0.7)" : "rgba(160,210,255,0.35)";
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

    if (conquered) {
      ctx.fillStyle = "#7affc0"; ctx.font = "bold " + Math.max(12, r * 0.6) + "px Segoe UI";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("✓", cx, cy - r - 12);
    } else if (locked) {
      ctx.fillStyle = "rgba(220,235,245,0.7)"; ctx.font = "bold " + Math.max(11, r * 0.5) + "px Segoe UI";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🔒", cx, cy);
    }
  }

  function renderMap() {
    map.t += 0.016;
    drawStarfield(0);
    mapTargets = [];
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";

    if (map.level === "universe") {
      el("map-breadcrumb").textContent = "Universe";
      el("map-hint").textContent = "Tap a galaxy to zoom in";
      GALAXIES.forEach((g, gi) => {
        const ang = gi / GALAXIES.length * TAU + map.t * 0.05;
        const cx = W / 2 + Math.cos(ang) * Math.min(W, H) * 0.26;
        const cy = H / 2 + Math.sin(ang) * Math.min(W, H) * 0.22;
        drawGalaxyBlob(cx, cy, Math.min(W, H) * 0.13, g, gi);
        mapTargets.push({ x: cx, y: cy, r: Math.min(W, H) * 0.14, action: () => { map.level = "galaxy"; map.galaxy = gi; } });
      });
    } else if (map.level === "galaxy") {
      const g = GALAXIES[map.galaxy];
      el("map-breadcrumb").textContent = g.name;
      el("map-hint").textContent = "Tap a solar system";
      drawGalaxyBlob(W / 2, H / 2, Math.min(W, H) * 0.42, g, map.galaxy, true);
      g.systems.forEach((s, si) => {
        const ang = si / g.systems.length * TAU - Math.PI / 2 + map.t * 0.08;
        const rad = Math.min(W, H) * 0.27;
        const cx = W / 2 + Math.cos(ang) * rad;
        const cy = H / 2 + Math.sin(ang) * rad * 0.8;
        const done = s.planets.every((_, pi) => progress.conquered[PLANETS.find(P => P.galaxy === map.galaxy && P.system === si && P.planet === pi).gi]);
        // star
        const sg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
        sg.addColorStop(0, "#fff"); sg.addColorStop(0.3, s.star); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
        ctx.fillStyle = "#dfeaf5"; ctx.font = "13px Segoe UI";
        ctx.fillText(s.name + (done ? " ✓" : ""), cx, cy + 50);
        mapTargets.push({ x: cx, y: cy, r: 40, action: () => { map.level = "system"; map.system = si; } });
      });
    } else if (map.level === "system") {
      const g = GALAXIES[map.galaxy];
      const s = g.systems[map.system];
      el("map-breadcrumb").textContent = g.name + " › " + s.name;
      el("map-hint").textContent = "Tap a lit planet to invade";
      // sun
      const cx = W / 2, cy = H * 0.46;
      const sg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60);
      sg.addColorStop(0, "#fff"); sg.addColorStop(0.4, s.star); sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, TAU); ctx.fill();
      // orbits + planets (perspective squash on Y)
      s.planets.forEach((p, pi) => {
        const orbit = Math.min(W, H) * (0.18 + pi * 0.13);
        const squash = 0.42;
        ctx.strokeStyle = "rgba(160,200,255,0.12)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, orbit, orbit * squash, 0, 0, TAU); ctx.stroke();
        const ang = map.t * (0.5 - pi * 0.08) + pi * 2.1;
        const px = cx + Math.cos(ang) * orbit;
        const py = cy + Math.sin(ang) * orbit * squash;
        const P = PLANETS.find(Pp => Pp.galaxy === map.galaxy && Pp.system === map.system && Pp.planet === pi);
        const conquered = !!progress.conquered[P.gi];
        const locked = !isUnlocked(P.gi);
        const pr = 20 + pi * 3;
        drawPlanet(px, py, pr, p.biome, conquered, locked);
        ctx.fillStyle = locked ? "#6f8699" : "#dfeaf5"; ctx.font = "12px Segoe UI";
        ctx.fillText(p.name, px, py + pr + 16);
        if (!locked) mapTargets.push({ x: px, y: py, r: pr + 10, action: () => enterPlanet(P.gi) });
      });
    }
  }

  function drawGalaxyBlob(cx, cy, r, g, gi, big) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(map.t * 0.1 + gi);
    const arms = 3, pts = big ? 220 : 90;
    for (let i = 0; i < pts; i++) {
      const t = i / pts;
      const arm = i % arms;
      const ang = t * 6 + arm / arms * TAU;
      const rr = t * r;
      const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * 0.7;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.fillStyle = "hsl(" + (g.hue + t * 40) + ",80%," + (70 - t * 20) + "%)";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // core
    const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 0.4);
    cg.addColorStop(0, "#fff"); cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, TAU); ctx.fill();
    if (!big) {
      ctx.fillStyle = "#dfeaf5"; ctx.font = "14px Segoe UI"; ctx.textAlign = "center";
      ctx.fillText(g.name, cx, cy + r + 6);
      // conquered fraction
      const total = g.systems.reduce((a, s) => a + s.planets.length, 0);
      let done = 0;
      PLANETS.forEach(P => { if (P.galaxy === gi && progress.conquered[P.gi]) done++; });
      ctx.fillStyle = "#7ab8ff"; ctx.font = "11px Segoe UI";
      ctx.fillText(done + "/" + total + " conquered", cx, cy + r + 22);
    }
  }

  function mapZoomOut() {
    if (map.level === "system") map.level = "galaxy";
    else if (map.level === "galaxy") map.level = "universe";
    else setState("menu");
  }

  // ============================ 6. BATTLE ============================
  let game = null;
  let grid = { cols: 0, rows: 0, cell: 60, x0: 0, y0: 0 };

  function computeGrid() {
    const cell = clamp(Math.floor(W / 8), 52, 76);
    const cols = Math.max(4, Math.floor((W - 16) / cell));
    const rows = 4;
    const gw = cols * cell;
    grid.cell = cell; grid.cols = cols; grid.rows = rows;
    grid.x0 = (W - gw) / 2;
    grid.y0 = H - 150 - rows * cell;   // build zone sits above the controls bar
  }
  function cellCenter(c, r) { return { x: grid.x0 + c * grid.cell + grid.cell / 2, y: grid.y0 + r * grid.cell + grid.cell / 2 }; }
  function cellAt(x, y) {
    const c = Math.floor((x - grid.x0) / grid.cell);
    const r = Math.floor((y - grid.y0) / grid.cell);
    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
    return { c, r };
  }
  function towerAtCell(c, r) { return game.towers.find(t => t.c === c && t.r === r); }

  function makeTower(typeId, c, r) {
    const def = TOWER_TYPES[typeId];
    const b = def.base;
    const pos = cellCenter(c, r);
    return {
      type: typeId, c, r, x: pos.x, y: pos.y,
      range: b.range, damage: b.damage, fireRate: b.fireRate, projSpeed: b.projSpeed,
      splash: b.splash, slowMul: b.slowMul, slowDur: b.slowDur, chain: b.chain,
      maxHp: 100, hp: 100, cd: 0, angle: -Math.PI / 2, flash: 0,
      priority: "first", unlocked: {}, spent: def.cost,
    };
  }

  function newBattle(gi) {
    const cfg = planetConfig(gi);
    computeGrid();
    game = {
      gi, cfg, species: availableSpecies(gi),
      energy: 75, towers: [], enemies: [], bullets: [], beams: [], particles: [], floaters: [],
      spawned: 0, killed: 0, hiveTotal: cfg.hive, spawnTimer: 0,
      completion: 0, efficiency: 1, speed: 1, running: true, shake: 0, time: 0,
      buildType: "blaster", selected: null,
      drag: null, // {tower, ox,oy}
    };
    el("speed").value = 1; el("speed-val").textContent = "1.0×";
    const P = PLANETS[gi];
    el("ui-world-name").textContent = P.ref.name;
    el("ui-planet").textContent = "Planet " + (gi + 1);
    buildPalette();
    closePanel();
    updateHUD();
  }
  function enterPlanet(gi) { newBattle(gi); setState("battle"); }

  function rewardMult() { return game.speed; }  // higher speed = proportionally more energy

  function spawnEnemy(forceType) {
    const cfg = game.cfg;
    const typeId = forceType || game.species[(Math.random() * game.species.length) | 0];
    const ty = ENEMY_TYPES[typeId];
    const fromSide = Math.random();
    let x, y;
    if (fromSide < 0.75) { x = rand(W * 0.08, W * 0.92); y = -24; }
    else if (fromSide < 0.875) { x = -24; y = rand(0, H * 0.35); }
    else { x = W + 24; y = rand(0, H * 0.35); }
    const baseHp = (14 + game.gi * 6) * cfg.hpMul * ty.hp;
    const e = {
      type: typeId, x, y, r: (10 + game.gi * 0.3) * ty.size,
      maxHp: baseHp, hp: baseHp,
      shield: ty.shield ? baseHp * ty.shield : 0, maxShield: ty.shield ? baseHp * ty.shield : 0,
      baseSpeed: cfg.speed * ty.spd * rand(0.9, 1.15),
      dmg: (6 + game.gi * 1.5) * cfg.dmgMul * ty.dmg,
      color: ty.color, anim: Math.random() * TAU, wob: Math.random() * TAU,
      slowT: 0, slowF: 1, hitCd: 0, dashCd: rand(1, 3), healCd: 1, mini: !!forceType,
    };
    game.enemies.push(e);
    if (!forceType) game.spawned++;
  }

  function getTarget(t) {
    let best = null, bestScore = -Infinity;
    const r2 = t.range * t.range;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d2 = dist2(e.x, e.y, t.x, t.y);
      if (d2 > r2) continue;
      let score;
      switch (t.priority) {
        case "close": score = -d2; break;
        case "strong": score = e.hp + e.shield; break;
        case "fast": score = e.baseSpeed * e.slowF; break;
        case "weak": score = -(e.hp + e.shield); break;
        default: score = e.y; break; // first = furthest down toward base
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function fireTower(t) {
    const target = getTarget(t);
    if (!target) return;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.flash = 0.07;
    if (t.type === "tesla") {
      // instant chain lightning
      const pts = [{ x: t.x, y: t.y }];
      let cur = target, hit = new Set();
      for (let i = 0; i <= t.chain; i++) {
        if (!cur || hit.has(cur)) break;
        hit.add(cur);
        pts.push({ x: cur.x, y: cur.y });
        damageEnemy(cur, t.damage, t);
        // next: nearest un-hit enemy within 130px
        let nxt = null, nd = 130 * 130;
        for (const e of game.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = dist2(e.x, e.y, cur.x, cur.y);
          if (d < nd) { nd = d; nxt = e; }
        }
        cur = nxt;
      }
      game.beams.push({ pts, life: 0.12, color: TOWER_TYPES.tesla.color });
    } else {
      game.bullets.push({
        x: t.x + Math.cos(t.angle) * t.r, y: t.y + Math.sin(t.angle) * t.r,
        vx: Math.cos(t.angle) * t.projSpeed, vy: Math.sin(t.angle) * t.projSpeed,
        damage: t.damage, splash: t.splash, slowMul: t.slowMul, slowDur: t.slowDur,
        r: t.type === "cannon" ? 6 : 4, life: 2.2, color: TOWER_TYPES[t.type].color,
      });
    }
  }

  function damageEnemy(e, dmg, src) {
    if (e.dead) return;
    if (e.shield > 0) {
      e.shield -= dmg;
      if (e.shield < 0) { e.hp += e.shield; e.shield = 0; }
    } else {
      e.hp -= dmg;
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    if (!e.mini) game.killed++;
    const gain = Math.round((2 + e.maxHp * 0.05) * rewardMult());
    game.energy += gain;
    spawnParticles(e.x, e.y, e.color, e.r > 14 ? 16 : 9);
    addFloater(e.x, e.y, "+" + gain, "#ffd45e");
    // completion contribution scaled by efficiency (damaged base = slower conquest)
    if (!e.mini) game.completion = Math.min(100, game.completion + (100 / game.hiveTotal) * (0.5 + 0.5 * game.efficiency));
    // splitter spawns minis
    const ty = ENEMY_TYPES[e.type];
    if (ty.split && !e.mini) {
      for (let i = 0; i < ty.split; i++) {
        spawnEnemy("crawler");
        const child = game.enemies[game.enemies.length - 1];
        child.x = e.x + rand(-12, 12); child.y = e.y + rand(-12, 12);
        child.maxHp = child.hp = e.maxHp * 0.28; child.r = e.r * 0.6; child.mini = true;
      }
    }
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rand(40, 170);
      game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.7), maxLife: 0.7, color, r: rand(1.5, 3.5) });
    }
  }
  function addFloater(x, y, text, color) { game.floaters.push({ x, y, text, color, life: 0.9 }); }

  function playerStrike(x, y) {
    const R = 60;
    spawnParticles(x, y, "#fff", 12);
    game.particles.push({ x, y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: "#fff", r: R, ring: true });
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (dist2(e.x, e.y, x, y) < R * R) damageEnemy(e, 16 + game.gi * 3, null);
    }
  }

  function updateBattle(dt) {
    if (!game.running) return;
    const sp = game.speed;
    const sdt = dt * sp;          // world time (movement/spawns/progress scale with speed)
    game.time += sdt;
    const cfg = game.cfg;

    // spawning: main hive, then slow stragglers so completion is always reachable
    game.spawnTimer -= sdt;
    if (game.spawnTimer <= 0) {
      if (game.spawned < game.hiveTotal) { spawnEnemy(); game.spawnTimer = cfg.spawn; }
      else if (game.completion < 100) { spawnEnemy(); game.spawnTimer = cfg.spawn * 2.2; }
    }

    // efficiency = avg tower hp fraction (eased)
    let frac = 0;
    for (const t of game.towers) frac += t.hp / t.maxHp;
    const target = game.towers.length ? frac / game.towers.length : 0.25;
    game.efficiency += (target - game.efficiency) * Math.min(1, dt * 3);

    // towers fire — fire rate uses REAL dt (does NOT scale with speed → more pressure)
    for (const t of game.towers) {
      if (t.flash > 0) t.flash -= dt;
      if (t.hp <= 0) continue;
      const rate = t.fireRate * (0.45 + 0.55 * (t.hp / t.maxHp)); // damaged towers fire slower
      t.cd -= dt;
      if (t.cd <= 0) { fireTower(t); t.cd = 1 / rate; }
    }

    // bullets (move in world time)
    for (const b of game.bullets) {
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt;
      if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { b.life = 0; continue; }
      for (const e of game.enemies) {
        if (e.dead) continue;
        const rr = e.r + b.r;
        if (dist2(e.x, e.y, b.x, b.y) < rr * rr) {
          if (b.splash > 0) {
            spawnParticles(b.x, b.y, b.color, 10);
            for (const o of game.enemies) {
              if (o.dead) continue;
              if (dist2(o.x, o.y, b.x, b.y) < b.splash * b.splash) {
                damageEnemy(o, b.damage, null);
                if (b.slowDur > 0 && !o.dead) { o.slowT = b.slowDur; o.slowF = b.slowMul; }
              }
            }
          } else {
            damageEnemy(e, b.damage, null);
            if (b.slowDur > 0 && !e.dead) { e.slowT = b.slowDur; e.slowF = b.slowMul; }
            spawnParticles(b.x, b.y, e.color, 3);
          }
          b.life = 0; break;
        }
      }
    }
    game.bullets = game.bullets.filter(b => b.life > 0);
    for (const bm of game.beams) bm.life -= dt;
    game.beams = game.beams.filter(b => b.life > 0);

    // enemies move + abilities
    for (const e of game.enemies) {
      if (e.dead) continue;
      e.anim += sdt * 6; e.wob += sdt * 4;
      if (e.slowT > 0) { e.slowT -= sdt; } else { e.slowF = 1; }
      const ty = ENEMY_TYPES[e.type];

      // abilities
      if (ty.heal) {
        e.healCd -= sdt;
        if (e.healCd <= 0) {
          e.healCd = 1.2;
          for (const o of game.enemies) {
            if (o === e || o.dead) continue;
            if (dist2(o.x, o.y, e.x, e.y) < 90 * 90) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08); }
          }
          game.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: "#ff9bd0", r: 90, ring: true });
        }
      }
      if (ty.shield && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.05 * sdt);
      let speed = e.baseSpeed * e.slowF;
      if (ty.spd >= 1.5) { // runners/flyers dash
        e.dashCd -= sdt;
        if (e.dashCd <= 0) { e.dashCd = rand(2, 4); e.dashT = 0.5; }
        if (e.dashT > 0) { e.dashT -= sdt; speed *= 2.1; }
      }

      // target nearest living tower else base core
      let tgt = null, bd = Infinity;
      for (const t of game.towers) {
        if (t.hp <= 0) continue;
        const d = dist2(t.x, t.y, e.x, e.y);
        if (d < bd) { bd = d; tgt = t; }
      }
      const aim = tgt || { x: W / 2, y: H - 95, r: 26 };
      const dx = aim.x - e.x, dy = aim.y - e.y, dd = Math.hypot(dx, dy) || 1;
      const reach = e.r + aim.r;
      if (dd > reach) {
        const wob = Math.sin(e.wob) * (ty.fly ? 14 : 6);
        e.x += (dx / dd) * speed * sdt + (-dy / dd) * wob * sdt;
        e.y += (dy / dd) * speed * sdt + (dx / dd) * wob * sdt;
      } else if (tgt) {
        e.hitCd -= sdt;
        if (e.hitCd <= 0) {
          tgt.hp = Math.max(0, tgt.hp - e.dmg);
          e.hitCd = 0.6;
          spawnParticles(e.x, e.y, "#ff6b6b", 4);
          game.shake = Math.min(9, game.shake + 3);
        }
      }
    }
    game.enemies = game.enemies.filter(e => !e.dead);

    // small passive trickle, throttled by efficiency & speed
    game.completion = Math.min(100, game.completion + 0.4 * game.efficiency * sp * dt);

    // fx decay
    for (const p of game.particles) { p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } }
    game.particles = game.particles.filter(p => p.life > 0);
    for (const f of game.floaters) { f.life -= dt; f.y -= 22 * dt; }
    game.floaters = game.floaters.filter(f => f.life > 0);
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 20);

    if (game.completion >= 100) { game.running = false; onConquer(); }
    updateHUD();
  }

  function onConquer() {
    progress.conquered[game.gi] = true;
    progress.maxUnlocked = Math.max(progress.maxUnlocked, game.gi + 1);
    saveProgress();
    const last = game.gi + 1 >= PLANETS.length;
    const P = PLANETS[game.gi];
    el("clear-title").textContent = last ? "GALAXY CONQUERED!" : "PLANET CONQUERED!";
    el("clear-text").textContent = last
      ? "Every world has fallen to your hive-breakers. The galaxy is yours, Commander."
      : P.ref.name + " is liberated. The next world awaits.";
    const next = el("clear-next");
    next.style.display = last ? "none" : "block";
    next.textContent = "INVADE " + (PLANETS[Math.min(PLANETS.length - 1, game.gi + 1)].ref.name).toUpperCase() + " ▶";
    next.onclick = () => { if (!last) enterPlanet(game.gi + 1); };
    setState("clear");
  }

  // ============================ 7. BATTLE RENDER =====================
  function renderBattle() {
    const P = PLANETS[game.gi];
    const biome = P.ref.biome;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#070b12"); g.addColorStop(1, "#04070d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawStarfield(7);

    ctx.save();
    if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));

    // home core (your planet) at bottom
    drawPlanet(W / 2, H - 70, 46, biome, false, false);

    drawGrid();

    // build/drag preview
    if (game.drag) {
      const cur = game.drag.tower;
      drawTowerSprite(cur.x, cur.y, cur, true);
    }

    // range ring of selected
    if (game.selected && !game.selected.dragGhost) {
      const t = game.selected;
      ctx.strokeStyle = "rgba(120,200,255,0.25)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, TAU); ctx.stroke();
    }

    // bullets
    for (const b of game.bullets) {
      ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
    // beams (tesla)
    for (const bm of game.beams) {
      ctx.globalAlpha = clamp(bm.life / 0.12, 0, 1);
      ctx.strokeStyle = bm.color; ctx.lineWidth = 2.5; ctx.shadowColor = bm.color; ctx.shadowBlur = 10;
      ctx.beginPath();
      bm.pts.forEach((p, i) => { i ? ctx.lineTo(p.x + rand(-3, 3), p.y + rand(-3, 3)) : ctx.moveTo(p.x, p.y); });
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    for (const e of game.enemies) drawEnemy(e);
    for (const t of game.towers) drawTowerSprite(t.x, t.y, t, false);

    // particles
    for (const p of game.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1); ctx.globalAlpha = a;
      if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - a) + 8, 0, TAU); ctx.stroke(); }
      else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.font = "bold 14px Segoe UI";
    for (const f of game.floaters) { ctx.globalAlpha = clamp(f.life * 1.4, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGrid() {
    for (let c = 0; c < grid.cols; c++) for (let r = 0; r < grid.rows; r++) {
      const x = grid.x0 + c * grid.cell, y = grid.y0 + r * grid.cell;
      const occupied = towerAtCell(c, r);
      ctx.strokeStyle = "rgba(120,200,255,0.12)";
      ctx.fillStyle = occupied ? "rgba(120,200,255,0.02)" : "rgba(120,200,255,0.05)";
      ctx.fillRect(x + 1, y + 1, grid.cell - 2, grid.cell - 2);
      ctx.strokeRect(x + 1, y + 1, grid.cell - 2, grid.cell - 2);
    }
    // build hint highlight on hovered cell during placement handled by tap
  }

  function drawTowerSprite(x, y, t, ghost) {
    const def = TOWER_TYPES[t.type];
    const down = t.hp <= 0;
    const frac = Math.max(0, t.hp / t.maxHp);
    ctx.globalAlpha = ghost ? 0.6 : 1;
    // base
    ctx.fillStyle = down ? "#33424d" : "#16222e";
    ctx.beginPath(); ctx.arc(x, y, t.r + 5, 0, TAU); ctx.fill();
    // barrel
    if (!down) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(t.angle);
      ctx.fillStyle = def.color;
      if (t.type === "sniper") ctx.fillRect(0, -3, t.r + 18, 6);
      else if (t.type === "cannon") ctx.fillRect(0, -6, t.r + 8, 12);
      else if (t.type === "tesla") { ctx.fillRect(0, -2, t.r + 6, 4); ctx.beginPath(); ctx.arc(t.r + 8, 0, 5, 0, TAU); ctx.fill(); }
      else ctx.fillRect(0, -4, t.r + 12, 8);
      if (t.flash > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(t.r + 14, 0, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // dome
    ctx.fillStyle = down ? "#55636d" : def.color;
    ctx.shadowColor = down ? "transparent" : def.color; ctx.shadowBlur = down ? 0 : 10;
    ctx.beginPath(); ctx.arc(x, y, t.r * 0.65, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // type glyph
    ctx.fillStyle = "#04121a"; ctx.font = "bold 11px Segoe UI"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(def.name[0], x, y + 1);
    ctx.textBaseline = "alphabetic";
    // hp bar
    if (!ghost) {
      const bw = t.r * 2.1, bh = 4;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - bw / 2, y + t.r + 7, bw, bh);
      ctx.fillStyle = frac > 0.5 ? "#67e08a" : frac > 0.25 ? "#ffd45e" : "#ff6b6b";
      ctx.fillRect(x - bw / 2, y + t.r + 7, bw * frac, bh);
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e) {
    const ty = ENEMY_TYPES[e.type];
    const a = e.anim;
    ctx.save();
    ctx.translate(e.x, e.y);
    // shield aura
    if (e.shield > 0) {
      ctx.strokeStyle = "rgba(122,208,255,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 5, a * 0.5, a * 0.5 + Math.PI * 1.4); ctx.stroke();
    }
    ctx.shadowColor = e.color; ctx.shadowBlur = 8;
    ctx.fillStyle = e.color;
    switch (e.type) {
      case "runner": {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(e.r * 0.7, e.r); ctx.lineTo(-e.r * 0.7, e.r); ctx.closePath(); ctx.fill();
        break;
      }
      case "brute": {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; const rr = e.r * (1 + 0.08 * Math.sin(a + i)); ctx[i ? "lineTo" : "moveTo"](Math.cos(an) * rr, Math.sin(an) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.5, 0, TAU); ctx.fill();
        break;
      }
      case "flyer": {
        const flap = Math.sin(a) * 0.6;
        ctx.save(); ctx.rotate(flap); ctx.beginPath(); ctx.ellipse(-e.r, 0, e.r, e.r * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.save(); ctx.rotate(-flap); ctx.beginPath(); ctx.ellipse(e.r, 0, e.r, e.r * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.6, 0, TAU); ctx.fill();
        break;
      }
      case "splitter": {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; const rr = e.r * (1 + 0.18 * Math.sin(a * 1.5 + i * 2)); ctx[i ? "lineTo" : "moveTo"](Math.cos(an) * rr, Math.sin(an) * rr); }
        ctx.closePath(); ctx.fill();
        break;
      }
      case "healer": {
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-e.r * 0.5, 0); ctx.lineTo(e.r * 0.5, 0); ctx.moveTo(0, -e.r * 0.5); ctx.lineTo(0, e.r * 0.5); ctx.stroke();
        break;
      }
      case "shielded": {
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.55, 0, TAU); ctx.fill();
        break;
      }
      default: { // crawler — body + animated legs
        for (let i = 0; i < 6; i++) {
          const side = i < 3 ? -1 : 1, k = i % 3;
          const lx = side * e.r, ly = (k - 1) * e.r * 0.55;
          const sw = Math.sin(a + i) * 4;
          ctx.strokeStyle = e.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(lx + side * 4, ly + sw); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(0, 0, e.r * 0.85, e.r, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.arc(0, -e.r * 0.2, e.r * 0.35, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    // hp ring
    const total = e.hp + e.shield, max = e.maxHp + e.maxShield;
    if (total < max) {
      const fr = clamp(total / max, 0, 1);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, -Math.PI / 2, -Math.PI / 2 + fr * TAU); ctx.stroke();
    }
  }

  // ============================ HUD / PALETTE / PANEL ================
  function updateHUD() {
    el("ui-energy").textContent = Math.floor(game.energy);
    el("ui-hive").textContent = Math.min(game.killed, game.hiveTotal) + "/" + game.hiveTotal;
    el("ui-eff").textContent = Math.round(game.efficiency * 100) + "%";
    el("ui-eff").style.color = game.efficiency > 0.6 ? "var(--accent)" : game.efficiency > 0.3 ? "#ffd45e" : "#ff6b6b";
    const pct = Math.floor(game.completion);
    el("completion-fill").style.width = pct + "%";
    el("completion-pct").textContent = pct + "%";
    el("ui-reward").textContent = "×" + rewardMult().toFixed(1) + " reward";
    // palette affordability
    for (const btn of document.querySelectorAll(".pal-btn")) {
      const id = btn.dataset.type;
      btn.disabled = game.energy < TOWER_TYPES[id].cost;
      btn.classList.toggle("selected", game.buildType === id);
    }
    if (game.selected) updatePanelLive();
  }

  function panelStatsHTML(t) {
    return `<b>DMG</b> ${Math.round(t.damage)} &nbsp; <b>Rate</b> ${t.fireRate.toFixed(1)}/s<br>` +
      `<b>Range</b> ${Math.round(t.range)} &nbsp; <b>HP</b> ${Math.round(t.hp)}/${t.maxHp}` +
      (t.splash ? `<br><b>Splash</b> ${Math.round(t.splash)}` : "") +
      (t.chain ? `<br><b>Chain</b> ${t.chain}` : "") +
      (t.slowDur ? `<br><b>Slow</b> ${(100 - t.slowMul * 100) | 0}% / ${t.slowDur.toFixed(1)}s` : "");
  }

  // Live, non-destructive panel update (no DOM rebuild → no flicker/scroll reset).
  function updatePanelLive() {
    const t = game.selected; if (!t) return;
    el("tp-stats").innerHTML = panelStatsHTML(t);
    if (game.panelNodes) for (const pn of game.panelNodes) {
      const reqMet = pn.node.req.every(r => t.unlocked[r]);
      pn.btn.disabled = !reqMet || game.energy < pn.node.cost;
    }
  }

  function buildPalette() {
    const pal = el("palette");
    pal.innerHTML = "";
    TOWER_ORDER.forEach(id => {
      const def = TOWER_TYPES[id];
      const b = document.createElement("button");
      b.className = "pal-btn"; b.dataset.type = id;
      b.innerHTML = `<canvas class="pal-icon" width="22" height="22"></canvas>
        <span class="pal-name">${def.name}</span><span class="pal-cost">${def.cost}⚡</span>`;
      b.onclick = () => { game.buildType = id; closePanel(); updateHUD(); };
      pal.appendChild(b);
      const ic = b.querySelector("canvas").getContext("2d");
      ic.fillStyle = def.color; ic.beginPath(); ic.arc(11, 11, 7, 0, TAU); ic.fill();
      ic.fillStyle = "#04121a"; ic.font = "bold 9px Segoe UI"; ic.textAlign = "center"; ic.textBaseline = "middle";
      ic.fillText(def.name[0], 11, 12);
    });
  }

  function selectTower(t) { game.selected = t; openPanel(); }
  function openPanel() { el("tower-panel").classList.remove("hidden"); refreshPanel(); }
  function closePanel() { game.selected = null; game.panelNodes = null; el("tower-panel").classList.add("hidden"); }

  function refreshPanel() {
    const t = game.selected; if (!t) return;
    const def = TOWER_TYPES[t.type];
    el("tp-name").textContent = def.name;
    el("tp-stats").innerHTML = panelStatsHTML(t);
    // targeting
    const tg = el("tp-targets"); tg.innerHTML = "";
    PRIORITIES.forEach(p => {
      const b = document.createElement("button");
      b.textContent = p.label; b.className = t.priority === p.id ? "active" : "";
      b.onclick = () => { t.priority = p.id; refreshPanel(); };
      tg.appendChild(b);
    });
    // skill tree
    const tr = el("tp-tree"); tr.innerHTML = ""; game.panelNodes = [];
    def.tree.forEach(node => {
      const owned = !!t.unlocked[node.id];
      const reqMet = node.req.every(r => t.unlocked[r]);
      const div = document.createElement("div");
      div.className = "tp-node" + (owned ? " owned" : reqMet ? "" : " locked");
      const info = `<div class="n-info"><span class="n-name">${node.name}</span><span class="n-desc">${node.desc}</span></div>`;
      if (owned) div.innerHTML = info + `<span class="n-tag">✓</span>`;
      else {
        div.innerHTML = info + `<button ${(!reqMet || game.energy < node.cost) ? "disabled" : ""}>${node.cost}⚡</button>`;
        const btn = div.querySelector("button");
        if (btn) {
          game.panelNodes.push({ node, btn });
          btn.onclick = () => {
            const met = node.req.every(r => t.unlocked[r]);
            if (game.energy < node.cost || !met || t.unlocked[node.id]) return;
            game.energy -= node.cost; t.unlocked[node.id] = true; t.spent += node.cost; node.apply(t);
            refreshPanel(); updateHUD();
          };
        }
      }
      tr.appendChild(div);
    });
    el("tp-sell").onclick = () => {
      const refund = Math.round(t.spent * 0.6);
      game.energy += refund;
      game.towers = game.towers.filter(x => x !== t);
      addFloater(t.x, t.y, "+" + refund, "#ffd45e");
      closePanel(); updateHUD();
    };
  }

  // ============================ 8. INPUT + LOOP ======================
  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return { x: s.clientX - rect.left, y: s.clientY - rect.top };
  }

  let ptr = { down: false, startX: 0, startY: 0, moved: false, onTower: null };
  canvas.addEventListener("pointerdown", e => {
    const p = canvasPoint(e);
    if (state === "map") return; // map handled on pointerup (tap)
    if (state !== "battle") return;
    ptr.down = true; ptr.startX = p.x; ptr.startY = p.y; ptr.moved = false; ptr.onTower = null;
    const cell = cellAt(p.x, p.y);
    if (cell) { const t = towerAtCell(cell.c, cell.r); if (t) ptr.onTower = t; }
  });
  canvas.addEventListener("pointermove", e => {
    if (!ptr.down || state !== "battle") return;
    const p = canvasPoint(e);
    if (!ptr.moved && Math.hypot(p.x - ptr.startX, p.y - ptr.startY) > 10) {
      ptr.moved = true;
      if (ptr.onTower) { game.drag = { tower: ptr.onTower }; ptr.onTower.dragging = true; }
    }
    if (game.drag) { game.drag.tower.x = p.x; game.drag.tower.y = p.y; }
  });
  canvas.addEventListener("pointerup", e => {
    const p = canvasPoint(e);
    if (state === "map") { handleMapTap(p); return; }
    if (state !== "battle") { ptr.down = false; return; }

    if (game.drag) {                       // ---- drop a dragged tower
      const t = game.drag.tower; t.dragging = false;
      const cell = cellAt(p.x, p.y);
      if (cell && !towerAtCell(cell.c, cell.r)) {
        t.c = cell.c; t.r = cell.r; const pos = cellCenter(cell.c, cell.r); t.x = pos.x; t.y = pos.y;
      } else { const pos = cellCenter(t.c, t.r); t.x = pos.x; t.y = pos.y; } // revert
      game.drag = null; ptr.down = false; return;
    }
    if (!ptr.moved) {                      // ---- tap
      const cell = cellAt(p.x, p.y);
      if (cell) {
        const t = towerAtCell(cell.c, cell.r);
        if (t) selectTower(t);
        else {                              // build on empty cell
          const def = TOWER_TYPES[game.buildType];
          if (game.energy >= def.cost) {
            game.energy -= def.cost;
            const nt = makeTower(game.buildType, cell.c, cell.r);
            game.towers.push(nt); selectTower(nt);
            const hint = el("tap-hint"); if (hint) hint.style.opacity = 0;
            updateHUD();
          }
        }
      } else if (p.y < grid.y0) {           // tap the sky → strike
        playerStrike(p.x, p.y); closePanel();
      } else { closePanel(); }
    }
    ptr.down = false;
  });

  function handleMapTap(p) {
    for (const tgt of mapTargets) {
      if (dist2(p.x, p.y, tgt.x, tgt.y) < tgt.r * tgt.r) { tgt.action(); return; }
    }
  }

  // speed slider
  el("speed").addEventListener("input", e => {
    game.speed = parseFloat(e.target.value);
    el("speed-val").textContent = game.speed.toFixed(1) + "×";
    updateHUD();
  });

  // menu / nav buttons
  el("btn-play").onclick = () => {
    // jump to the furthest unlocked, not-yet-conquered planet's system
    const gi = clamp(progress.maxUnlocked, 0, PLANETS.length - 1);
    const P = PLANETS[gi]; map.level = "system"; map.galaxy = P.galaxy; map.system = P.system;
    setState("map");
  };
  el("btn-map").onclick = () => { map.level = "universe"; setState("map"); };
  el("btn-howto").onclick = () => setState("howto");
  el("btn-howto-back").onclick = () => setState("menu");
  el("btn-reset").onclick = () => { if (confirm("Reset all conquest progress?")) { progress = { conquered: {}, maxUnlocked: 0 }; saveProgress(); setState("menu"); } };
  el("map-menu").onclick = () => setState("menu");
  el("map-zoomout").onclick = mapZoomOut;
  el("btn-to-map").onclick = () => { map.level = "system"; map.galaxy = PLANETS[game.gi].galaxy; map.system = PLANETS[game.gi].system; setState("map"); };
  el("tp-close").onclick = closePanel;
  el("clear-map").onclick = () => { map.level = "system"; map.galaxy = PLANETS[game.gi].galaxy; map.system = PLANETS[game.gi].system; setState("map"); };

  // main loop
  let lastT = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (state === "battle") { updateBattle(dt); renderBattle(); }
    else if (state === "clear") { renderBattle(); }
    else if (state === "map") { renderMap(); }
    else { drawStarfield(0); }   // menu/howto background
    requestAnimationFrame(loop);
  }

  // ============================ BOOT =================================
  loadProgress();
  resize();
  setState("menu");
  requestAnimationFrame(loop);
})();
