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
  const MAXTIER = 5;
  const PATHS = [
    { key: "a", name: "Power",  fx: t => "×" + Math.pow(1.7, t).toFixed(1) + " dmg" },
    { key: "b", name: "Speed",  fx: t => "×" + Math.pow(1.35, t).toFixed(1) + " rate" },
    { key: "c", name: "Optics", fx: t => "+" + 55 * t + " rng" + (t >= 3 ? " · crit" : "") },
  ];
  const newUnit = type => ({ type, t: { a: 0, b: 0, c: 0 }, cd: rnd(0, 0.4) });
  const countType = type => S.units.filter(u => u.type === type).length;
  const unitBuyCost = type => Math.floor(DEF_TYPES[type].base * Math.pow(1.9, countType(type)));
  const pathCost = (u, k) => Math.floor(DEF_TYPES[u.type].base * 0.8 * Math.pow(3.0, u.t[k]));
  const uDmg = u => DEF_TYPES[u.type].dmg * Math.pow(1.7, u.t.a) * derived.sdDmg;
  const uRate = u => DEF_TYPES[u.type].rate * Math.pow(1.35, u.t.b) * derived.sdFire;
  const uRange = u => DEF_TYPES[u.type].range + 55 * u.t.c;
  const uCrit = u => u.t.c >= 3 ? 0.25 : 0;
  const uCritMul = u => 2 + 0.3 * u.t.c;
  const uSplash = u => DEF_TYPES[u.type].splash ? DEF_TYPES[u.type].splash + 14 * u.t.c : 0;
  const uColor = u => u.type === "mortar" ? "#9a9a9a" : u.type === "turret" ? "#ffffff" : "#cccccc";
  function unitPos(i, n) {
    const ring = Math.floor(i / 9), per = 9, idx = i % per;
    const r = 60 + ring * 56, a = idx / per * TAU + ring * 0.5 - Math.PI / 2;
    return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r };
  }

  /* ----------------------- drone + economy upgrades -------------- */
  const UPS = [
    { id: "drones",     tab: "drone", name: "Extra Drone", base: 300, mul: 1.85, max: 8, desc: l => (1 + l) + " drones" },
    { id: "droneSpeed", tab: "drone", name: "Drone Speed", base: 18, mul: 1.18, desc: () => Math.round(derived.droneSpeed) + " px/s" },
    { id: "suction",    tab: "drone", name: "Suction",     base: 24, mul: 1.20, desc: () => Math.round(derived.suction) + " radius" },
    { id: "agility",    tab: "drone", name: "Agility",     base: 18, mul: 1.18, max: 40, desc: l => "Lv " + l },
    { id: "size",       tab: "drone", name: "Collector Size", base: 28, mul: 1.20, desc: () => Math.round(derived.collect) + " px" },
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
    return { cash: 0, galaxy: 1, lv, units: [newUnit("turret")], totalRun: 0, peakGalaxy: 1 };
  }
  function freshMeta() { const sd = {}; SDS.forEach(u => sd[u.id] = 0); return { starDust: 0, sd, totalEver: 0 }; }

  let dots = [], orbs = [], beams = [], drones = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0;
  let drawing = false, lastDraw = null, trail = [], selUnit = -1;
  let abil = { frenzy: 0, dotrain: 0, blackhole: 0 }, frenzyT = 0, blackholeT = 0;
  const ABIL_CD = { frenzy: 45, dotrain: 40, blackhole: 60 };
  let activeTab = "def", listRows = {}, tabBtns = {};

  function recompute() {
    const L = S.lv, m = META;
    derived.sdDmg = 1 + 0.25 * m.sd.sdDmg;
    derived.sdFire = (1 + 0.15 * m.sd.sdFire) * (frenzyT > 0 ? 5 : 1);
    derived.incomeMul = 1 + 0.25 * m.sd.sdInc;
    derived.droneSpeed = 90 + 16 * L.droneSpeed;
    derived.suction = 26 + 7 * L.suction;              // small base -> need more drones
    derived.agility = clamp(0.06 + 0.01 * L.agility, 0, 0.5);
    derived.collect = 8 + 2 * L.size;
    derived.capacity = 200 * Math.pow(1.7, L.capacity);
    derived.valueMul = Math.pow(1.25, L.value);
    derived.spawnPerSec = 0.9 + 0.4 * L.spawnRate;
    derived.luck = Math.min(0.5, 0.02 * L.luck);
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v2";
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, META, ts: Date.now(), cps })); } catch (e) {} }
  function load() {
    S = fresh(); META = freshMeta(); let off = null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {}); if (!S.units || !S.units.length) S.units = [newUnit("turret")]; S.units.forEach(u => { if (!u.t) u.t = { a: 0, b: 0, c: 0 }; u.cd = u.cd || 0; }); }
        if (d.META) { META = Object.assign(freshMeta(), d.META); META.sd = Object.assign(freshMeta().sd, d.META.sd || {}); }
        if (d.ts && d.cps > 0) { const e = clamp((Date.now() - d.ts) / 1000, 0, 8 * 3600); if (e >= 60) { const g = Math.floor(d.cps * e * 0.5); if (g > 0) off = { gain: g, elapsed: e }; } }
      }
    } catch (e) {}
    recompute();
    if (off) { S.cash = Math.min(derived.capacity, S.cash + off.gain); S._welcome = off; }
  }

  /* ----------------------------- entities ------------------------ */
  function syncDrones() { const n = 1 + S.lv.drones; while (drones.length < n) drones.push({ x: rnd(W * 0.3, W * 0.7), y: rnd(H * 0.3, H * 0.6), vx: 0, vy: 0 }); while (drones.length > n) drones.pop(); }

  function spawnDot(special) {
    const g = S.galaxy, hp = 5 * enemyHpMul(g) * rnd(0.8, 1.6);
    special = special || Math.random() < derived.luck;
    const val = Math.round(2 * galValueMul(g) * derived.valueMul * derived.incomeMul * (special ? 9 : 1));
    const r = clamp(7 + Math.log10(hp + 10) * 2.6, 7, 24);
    dots.push({ x: rnd(40, W - 40), y: rnd(60, H - 150), vx: rnd(-20, 20), vy: rnd(-20, 20),
      hp, maxHp: hp, value: val, r, special, hit: 0, drawCd: 0, color: special ? "#ffffff" : `hsl(0,0%,${44 + ((g - 1) % 6) * 8}%)` });
  }

  function fireUnit(u, p) {
    let target = null, bd = uRange(u) ** 2;
    for (const d of dots) { const q = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (q < bd) { bd = q; target = d; } }
    if (!target) return;
    let dmg = uDmg(u); if (Math.random() < uCrit(u)) dmg *= uCritMul(u);
    beams.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y, life: 0.08, color: uColor(u) });
    const aoe = uSplash(u);
    if (aoe > 0) { for (const d of dots) if ((d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= aoe * aoe) hitDot(d, dmg); }
    else hitDot(target, dmg);
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
      if (d.hit > 0) d.hit -= dt; if (d.drawCd > 0) d.drawCd -= dt;
      if (blackholeT > 0) { const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1; d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt; hitDot(d, brushDmg() * 0.6 * dt); }
      else { d.x += d.vx * dt; d.y += d.vy * dt; if (d.x < 30 || d.x > W - 30) d.vx *= -1; if (d.y < 50 || d.y > H - 130) d.vy *= -1; d.x = clamp(d.x, 30, W - 30); d.y = clamp(d.y, 50, H - 130); }
    }
    dots = dots.filter(d => !d.dead);

    for (let i = 0; i < S.units.length; i++) { const u = S.units[i]; u.cd -= dt; if (u.cd <= 0) { fireUnit(u, unitPos(i, S.units.length)); u.cd = 1 / uRate(u); } }
    for (const b of beams) b.life -= dt; beams = beams.filter(b => b.life > 0);

    // drones coordinate: each claims its nearest orb (so they split up)
    if (drones.length === 0) syncDrones();
    for (const dr of drones) { dr.cand = null; dr.cbd = Infinity; }
    for (const o of orbs) { let nd = null, bd = Infinity; for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2; if (q < bd) { bd = q; nd = dr; } } if (nd && bd < nd.cbd) { nd.cbd = bd; nd.cand = o; } }
    for (const dr of drones) {
      const tgt = dr.cand;
      if (tgt) { const dx = tgt.x - dr.x, dy = tgt.y - dr.y, dl = Math.hypot(dx, dy) || 1; dr.vx += (dx / dl * derived.droneSpeed - dr.vx) * derived.agility; dr.vy += (dy / dl * derived.droneSpeed - dr.vy) * derived.agility; }
      else { dr.vx *= 0.9; dr.vy *= 0.9; }
      dr.x = clamp(dr.x + dr.vx * dt, 0, W); dr.y = clamp(dr.y + dr.vy * dt, 0, H);
    }
    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      let nd = null, bd = Infinity; for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2; if (q < bd) { bd = q; nd = dr; } }
      if (nd) { const dl = Math.sqrt(bd) || 1; if (dl < derived.suction) { o.x += (nd.x - o.x) / dl * 240 * dt; o.y += (nd.y - o.y) / dl * 240 * dt; } if (dl < derived.collect + 6 || o.t > 30) { if (o.t <= 30) earned += o.value; orbs.splice(i, 1); } }
      else if (o.t > 30) orbs.splice(i, 1);
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
      const tot = u.t.a + u.t.b + u.t.c; if (tot) { ctx.fillStyle = "#fff"; ctx.font = "9px ui-monospace,monospace"; ctx.fillText("" + tot, p.x, p.y - 21); }
    }
    ctx.textBaseline = "alphabetic";
    for (const dr of drones) { ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, derived.suction, 0, TAU); ctx.stroke(); ctx.fillStyle = "#ddd"; ctx.save(); ctx.translate(dr.x, dr.y); ctx.rotate(Date.now() / 300); ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
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
        const d = DEF_TYPES[id], locked = S.galaxy < d.gal, c = unitBuyCost(id);
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
    for (const u of UPS) { if (aff[u.tab]) continue; if (u.max != null && S.lv[u.id] >= u.max) continue; if (S.cash >= upCost(u)) aff[u.tab] = true; }
    for (const k in tabBtns) tabBtns[k].classList.toggle("has-buy", !!aff[k]);
    if (selUnit >= 0 && state === "play") refreshUnitPanel();
  }

  function renderList() {
    const wrap = $("up-list"); wrap.innerHTML = ""; listRows = {};
    if (activeTab === "def") {
      for (const type of DEF_ORDER) {
        const el = document.createElement("div"); el.className = "up";
        el.innerHTML = `<span class="u-dot" style="background:#fff"></span><div class="u-mid"><div class="u-name">${DEF_TYPES[type].name}</div><div class="u-desc"></div></div><button class="u-buy"></button>`;
        wrap.appendChild(el);
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
    if (S.galaxy < DEF_TYPES[type].gal || S.units.length >= 40) return;
    const c = unitBuyCost(type); if (S.cash < c) return;
    S.cash -= c; S.units.push(newUnit(type)); Audio_buy(); renderList(); save();
  }
  function buyUpgrade(u) {
    const lvl = S.lv[u.id]; if (u.max != null && lvl >= u.max) return;
    const c = upCost(u); if (S.cash < c) return;
    S.cash -= c; S.lv[u.id]++; if (u.id === "drones") syncDrones();
    Audio_buy(); recompute(); syncHUD(); save();
  }
  function Audio_buy() {}  // (silent build)

  /* ------------------------- unit upgrade tree ------------------- */
  function openUnitPanel(i) { selUnit = i; refreshUnitPanel(); $("unit-panel").classList.add("show"); }
  function closeUnitPanel() { selUnit = -1; $("unit-panel").classList.remove("show"); }
  function refreshUnitPanel() {
    const u = S.units[selUnit]; if (!u) { closeUnitPanel(); return; }
    const d = DEF_TYPES[u.type];
    $("up-name").textContent = d.name + "  (" + (u.t.a + u.t.b + u.t.c) + " upgrades)";
    $("up-stats").innerHTML = "<b>" + fmt(uDmg(u)) + "</b> dmg · <b>" + uRate(u).toFixed(1) + "</b>/s · <b>" + Math.round(uRange(u)) + "</b> rng" + (uSplash(u) ? " · splash" : "") + (uCrit(u) ? " · " + Math.round(uCrit(u) * 100) + "% crit" : "");
    const wrap = $("up-paths"); wrap.innerHTML = "";
    for (const p of PATHS) {
      const tier = u.t[p.key], maxed = tier >= MAXTIER, c = pathCost(u, p.key);
      const pips = "●".repeat(tier) + "○".repeat(MAXTIER - tier);
      const el = document.createElement("div"); el.className = "path";
      el.innerHTML = `<div class="p-mid"><div class="p-name">${p.name} <span class="p-pips">${pips}</span></div><div class="p-fx">${p.fx(tier)} → ${p.fx(tier + 1)}</div></div>` +
        `<button class="p-buy">${maxed ? "MAX" : "$" + fmt(c)}</button>`;
      wrap.appendChild(el);
      const b = el.querySelector(".p-buy");
      if (maxed) b.disabled = true; else { b.disabled = S.cash < c; b.onclick = () => buyPath(u, p.key); }
    }
  }
  function buyPath(u, k) {
    if (u.t[k] >= MAXTIER) return; const c = pathCost(u, k); if (S.cash < c) return;
    S.cash -= c; u.t[k]++; recompute(); refreshUnitPanel(); syncHUD(); save();
  }
  function sellUnit() {
    if (selUnit < 0 || S.units.length <= 1) { closeUnitPanel(); return; }   // keep at least one
    const u = S.units[selUnit];
    let spent = unitBuyCost(u.type) / 1.9; for (const k of ["a", "b", "c"]) for (let t = 0; t < u.t[k]; t++) spent += DEF_TYPES[u.type].base * 0.8 * Math.pow(3, t);
    S.cash += Math.round(spent * 0.5); S.units.splice(selUnit, 1); closeUnitPanel(); save();
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
  function buildGalaxyMap() {
    const wrap = $("gm-list"); wrap.innerHTML = "";
    const maxG = Math.max(S.peakGalaxy + 2, S.galaxy + 2, 10);
    for (let g = 1; g <= maxG; g++) {
      const current = g === S.galaxy, reached = g < S.galaxy, next = g === S.galaxy + 1;
      const weps = DEF_ORDER.filter(t => DEF_TYPES[t].gal === g).map(t => DEF_TYPES[t].name).join(", ");
      const el = document.createElement("div"); el.className = "gm " + (current ? "current" : reached ? "done" : next ? "next" : "locked");
      let right; if (current) right = "<span class='gm-here'>▶ HERE</span>"; else if (reached) right = "<span class='gm-chk'>✓</span>";
      else if (next) { const c = travelCost(S.galaxy); right = "<button class='gm-go'" + (S.cash >= c ? "" : " disabled") + ">$" + fmt(c) + "</button>"; } else right = "<span class='gm-lock'>🔒</span>";
      el.innerHTML = "<span class='gm-n'>" + g + "</span><div class='gm-mid'><div class='gm-name'>" + galName(g) + "</div><div class='gm-sub'>" + (weps ? "Unlocks: " + weps : current ? "You are here" : next ? "Next galaxy" : "Locked") + "</div></div>" + right;
      wrap.appendChild(el);
      if (next) { const b = el.querySelector(".gm-go"); if (b) b.onclick = () => { travel(); buildGalaxyMap(); }; }
    }
  }
  function travel() { const c = travelCost(S.galaxy); if (S.cash < c) return; S.cash -= c; S.galaxy++; if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy; dots = []; orbs = []; recompute(); syncHUD(); save(); }
  function rebirthGain() { return Math.floor(5 + Math.max(0, S.peakGalaxy - 9) * 6 + Math.cbrt(S.totalRun + 1) * 0.5); }
  function openRebirth() { if (S.galaxy < 10 && S.peakGalaxy < 10) return; $("rb-text").textContent = "Reset this run (cash, defenders & upgrades wiped) to bank Star Dust for permanent upgrades."; $("rb-gain").textContent = "✦ +" + fmt(rebirthGain()) + " Star Dust"; $("rebirth-modal").classList.add("show"); }
  function doRebirth() {
    META.starDust += rebirthGain(); const keep = META; S = fresh(); META = keep;
    if (META.sd.sdStart > 0) S.cash = 50 * Math.pow(6, META.sd.sdStart);
    dots = []; orbs = []; beams = []; spawnAcc = 0; cps = 0; drones = []; selUnit = -1;
    syncDrones(); recompute(); $("rebirth-modal").classList.remove("show"); renderList(); buildSD(); syncHUD(); save();
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
    if (ui >= 0) { openUnitPanel(ui); return; }
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
  $("galaxy-open").onclick = () => { buildGalaxyMap(); $("galaxy-map").classList.add("show"); }; $("gm-close").onclick = () => $("galaxy-map").classList.remove("show");
  $("up-close").onclick = closeUnitPanel; $("up-sell").onclick = sellUnit;
  $("dock-toggle").onclick = () => { const d = $("dock"); const min = d.classList.toggle("min"); $("dock-toggle").textContent = min ? "▴ Menu" : "▾ Minimise"; };
  $("btn-menu").onclick = () => $("menu").classList.add("show");
  $("menu-close").onclick = () => $("menu").classList.remove("show");
  $("menu-resume").onclick = () => $("menu").classList.remove("show");
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress (including Star Dust)?")) { localStorage.removeItem(KEY); location.reload(); } };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  $("home-play").onclick = () => { renderList(); setScreen("play"); };
  $("home-galaxies").onclick = () => { buildGalaxyMap(); $("galaxy-map").classList.add("show"); };
  $("home-how").onclick = () => $("how").classList.add("show");
  $("how-close").onclick = $("how-back").onclick = () => $("how").classList.remove("show");
  $("home-reset").onclick = () => { if (confirm("Erase ALL progress?")) { localStorage.removeItem(KEY); location.reload(); } };

  /* ----------------------------- loop / boot --------------------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const dr of drones) { dr.x = clamp(dr.x, 0, W); dr.y = clamp(dr.y, 0, H); }
  }
  window.addEventListener("resize", resize);
  let last = 0, saveAcc = 0;
  function loop(now) { let dt = (now - last) / 1000 || 0; last = now; if (dt > 0.05) dt = 0.05; update(dt); render(); syncHUD(); saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; save(); } requestAnimationFrame(loop); }

  load(); resize(); syncDrones(); renderList(); setScreen("home");
  if (S._welcome) { $("welcome-text").textContent = "Your defenders kept firing for " + fmtTime(S._welcome.elapsed) + "."; $("welcome-cash").textContent = "$" + fmt(S._welcome.gain); $("welcome").classList.add("show"); S._welcome = null; }
  window.addEventListener("beforeunload", save);
  requestAnimationFrame(loop);

  if (typeof window !== "undefined") window.__IDS = { S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, drones: () => drones, units: () => S.units, uDmg, uRate, brushAt, useAbility, travel, doRebirth, rebirthGain, fmt, buyUnit, buyUp: id => buyUpgrade(UP[id]), buyPath, openUnitPanel, sellUnit, recompute, setScreen, abil: () => abil, travelCost, galSpawnMul, galCap, state: () => state };
})();
