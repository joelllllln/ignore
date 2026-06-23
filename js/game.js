/* =====================================================================
   IDLE DOT SHOOTER  (HTML5/Canvas, original implementation)
   Systems: auto-firing turret + weapons + marines, collector drone, dots
   with HP/value, three upgrade tabs (Defence / Drone / Economy), Big-Moment
   abilities (Frenzy / Dot Rain / Black Hole), galaxy travel, Rebirth +
   Star Dust prestige, capacity-capped cash, and offline earnings.
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

  /* ----------------------------- upgrades ------------------------ */
  const UPS = [
    // Defence
    { id: "fireRate", tab: "def", name: "Fire Rate", base: 12, mul: 1.16, desc: () => derived.fireRate.toFixed(1) + " /s" },
    { id: "damage",   tab: "def", name: "Damage",    base: 14, mul: 1.18, desc: () => fmt(derived.damage) + " dmg" },
    { id: "crit",     tab: "def", name: "Critical Hits", base: 60, mul: 1.26, desc: () => Math.round(derived.critChance * 100) + "% · ×" + derived.critMult.toFixed(1) },
    { id: "marines",  tab: "def", name: "Marines",   base: 250, mul: 1.55, max: 8, desc: l => l + " / 8 units" },
    { id: "mortar",   tab: "def", name: "Mortar (splash)", base: 800, mul: 3.2, max: 6, desc: l => l ? "Lv " + l : "Unlock" },
    { id: "plasma",   tab: "def", name: "Plasma (heavy)", base: 6000, mul: 3.4, max: 6, desc: l => l ? "Lv " + l : "Unlock" },
    // Drone
    { id: "droneSpeed", tab: "drone", name: "Drone Speed", base: 16, mul: 1.17, desc: () => Math.round(derived.droneSpeed) + " px/s" },
    { id: "suction",    tab: "drone", name: "Suction",     base: 22, mul: 1.20, desc: () => Math.round(derived.suction) + " radius" },
    { id: "agility",    tab: "drone", name: "Agility",     base: 18, mul: 1.18, max: 40, desc: l => "Lv " + l },
    { id: "size",       tab: "drone", name: "Collector Size", base: 28, mul: 1.20, desc: () => Math.round(derived.collect) + " px" },
    // Economy
    { id: "capacity",  tab: "eco", name: "Capacity",   base: 10, mul: 1.27, desc: () => "$" + fmt(derived.capacity) },
    { id: "value",     tab: "eco", name: "Value",      base: 16, mul: 1.22, desc: () => "×" + derived.valueMul.toFixed(2) + " /dot" },
    { id: "spawnRate", tab: "eco", name: "Spawn Rate", base: 24, mul: 1.21, desc: () => derived.spawnPerSec.toFixed(1) + " /s" },
    { id: "luck",      tab: "eco", name: "Luck",       base: 70, mul: 1.24, max: 25, desc: () => Math.round(derived.luck * 100) + "% special" },
  ];
  const UP = {}; UPS.forEach(u => UP[u.id] = u);
  const upCost = u => Math.floor(u.base * Math.pow(u.mul, S.lv[u.id] || 0));

  // Star Dust (permanent) upgrades
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

  /* ----------------------------- state --------------------------- */
  let S, derived = {};
  function fresh() {
    const lv = {}; UPS.forEach(u => lv[u.id] = 0);
    return { cash: 0, galaxy: 1, lv, totalRun: 0, peakGalaxy: 1 };
  }
  function freshMeta() { const sd = {}; SDS.forEach(u => sd[u.id] = 0); return { starDust: 0, sd, totalEver: 0 }; }

  // runtime-only (not saved)
  let dots = [], orbs = [], beams = [], drone, sources = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0;
  let abil = { frenzy: 0, dotrain: 0, blackhole: 0 }, frenzyT = 0, blackholeT = 0;
  const ABIL_CD = { frenzy: 45, dotrain: 40, blackhole: 60 };
  let activeTab = "def", paused = false, listRows = {}, buyMode = "x1", tabBtns = {};

  /* ----------------------------- derived ------------------------- */
  function recompute() {
    const m = META, L = S.lv;
    const sdDmg = 1 + 0.25 * m.sd.sdDmg, sdInc = 1 + 0.25 * m.sd.sdInc, sdFire = 1 + 0.15 * m.sd.sdFire;
    derived.fireRate = (1.0 + 0.12 * L.fireRate) * sdFire * (frenzyT > 0 ? 5 : 1);
    derived.damage = (3 + 2 * L.damage) * sdDmg;
    derived.critChance = Math.min(0.6, 0.03 * L.crit);
    derived.critMult = 1.8 + 0.06 * L.crit;
    derived.droneSpeed = 120 + 26 * L.droneSpeed;
    derived.suction = 50 + 18 * L.suction;
    derived.agility = clamp(0.06 + 0.012 * L.agility, 0, 0.55);
    derived.collect = 12 + 3 * L.size;
    derived.capacity = 200 * Math.pow(1.7, L.capacity);
    derived.valueMul = Math.pow(1.25, L.value);
    derived.spawnPerSec = 0.8 + 0.35 * L.spawnRate;
    derived.luck = Math.min(0.5, 0.02 * L.luck);
    derived.incomeMul = sdInc;
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v1";
  let META;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ S, META, ts: Date.now(), cps })); } catch (e) {}
  }
  function load() {
    S = fresh(); META = freshMeta();
    let off = null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {}); }
        if (d.META) { META = Object.assign(freshMeta(), d.META); META.sd = Object.assign(freshMeta().sd, d.META.sd || {}); }
        if (d.ts && d.cps > 0) {
          const elapsed = clamp((Date.now() - d.ts) / 1000, 0, 8 * 3600);
          if (elapsed >= 60) { const gain = Math.floor(d.cps * elapsed * 0.5); if (gain > 0) off = { gain, elapsed }; }
        }
      }
    } catch (e) {}
    recompute();
    if (off) { S.cash = Math.min(derived.capacity, S.cash + off.gain); S._welcome = off; }
  }

  /* ----------------------------- entities ------------------------ */
  function rebuildSources() {
    sources = [{ t: "turret", cd: 0 }];
    for (let i = 0; i < S.lv.marines; i++) sources.push({ t: "marine", cd: rnd(0, 0.3) });
    if (S.lv.mortar > 0) sources.push({ t: "mortar", cd: 0 });
    if (S.lv.plasma > 0) sources.push({ t: "plasma", cd: 0 });
  }
  function sourcePos(i, n) {
    if (i === 0) return { x: W / 2, y: H / 2 };           // turret centre
    const a = (i - 1) / Math.max(1, n - 1) * TAU, r = 46;
    return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r };
  }
  function newDrone() { drone = { x: W / 2, y: H * 0.4, vx: 0, vy: 0 }; }

  function spawnDot(special) {
    const g = S.galaxy, hp = 5 * enemyHpMul(g) * rnd(0.8, 1.6);
    special = special || Math.random() < derived.luck;
    const val = Math.round(2 * galValueMul(g) * derived.valueMul * derived.incomeMul * (special ? 9 : 1));
    const r = clamp(8 + Math.log10(hp + 10) * 3, 8, 26);
    dots.push({
      x: rnd(40, W - 40), y: rnd(70, H - 150),
      vx: rnd(-18, 18), vy: rnd(-18, 18),
      hp, maxHp: hp, value: val, r, special, hit: 0,
      color: special ? "#ffd45e" : `hsl(${(g * 47) % 360},70%,62%)`,
    });
  }

  function fireSource(src, pos) {
    let target = null, bd = Infinity;
    for (const d of dots) { const q = (d.x - pos.x) ** 2 + (d.y - pos.y) ** 2; if (q < bd) { bd = q; target = d; } }
    if (!target) return;
    let dmg = derived.damage, color = "#ff4040", aoe = 0;
    if (src.t === "marine") dmg *= 0.7;
    else if (src.t === "mortar") { dmg *= 1.2 + 0.4 * S.lv.mortar; aoe = 46 + 8 * S.lv.mortar; color = "#ff8c3a"; }
    else if (src.t === "plasma") { dmg *= 3 + 0.8 * S.lv.plasma; color = "#c08cff"; }
    if (Math.random() < derived.critChance) dmg *= derived.critMult;
    beams.push({ x1: pos.x, y1: pos.y, x2: target.x, y2: target.y, life: 0.08, color });
    if (aoe > 0) {
      for (const d of dots) if ((d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= aoe * aoe) hitDot(d, dmg);
    } else hitDot(target, dmg);
  }
  function hitDot(d, dmg) {
    if (d.dead) return; d.hp -= dmg; d.hit = 0.08;
    if (d.hp <= 0) { d.dead = true; orbs.push({ x: d.x, y: d.y, value: d.value, t: 0 }); }
  }

  /* ----------------------------- abilities ----------------------- */
  function useAbility(k) {
    if (abil[k] > 0 || paused) return;
    abil[k] = ABIL_CD[k];
    if (k === "frenzy") frenzyT = 6;
    else if (k === "dotrain") for (let i = 0; i < 40; i++) spawnDot(Math.random() < 0.3);
    else if (k === "blackhole") blackholeT = 5;
  }

  /* ----------------------------- update -------------------------- */
  function update(dt) {
    if (paused) return;
    recompute();
    if (frenzyT > 0) frenzyT -= dt;
    if (blackholeT > 0) blackholeT -= dt;
    for (const k in abil) if (abil[k] > 0) abil[k] = Math.max(0, abil[k] - dt);

    // spawning (capped concurrent for perf)
    spawnAcc += dt * derived.spawnPerSec;
    while (spawnAcc >= 1 && dots.length < 110) { spawnDot(); spawnAcc -= 1; }
    if (spawnAcc > 5) spawnAcc = 5;

    // dots drift / black hole pull
    for (const d of dots) {
      if (d.hit > 0) d.hit -= dt;
      if (blackholeT > 0) {
        const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1;
        d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt;
        hitDot(d, derived.damage * 2.5 * dt);
      } else {
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < 30 || d.x > W - 30) d.vx *= -1;
        if (d.y < 60 || d.y > H - 140) d.vy *= -1;
        d.x = clamp(d.x, 30, W - 30); d.y = clamp(d.y, 60, H - 140);
      }
    }
    dots = dots.filter(d => !d.dead);

    // fire sources in rotation
    const n = sources.length;
    for (let i = 0; i < n; i++) {
      const src = sources[i]; src.cd -= dt;
      const rateMul = src.t === "mortar" ? 0.45 : src.t === "plasma" ? 0.35 : 1;
      if (src.cd <= 0) { fireSource(src, sourcePos(i, n)); src.cd = 1 / (derived.fireRate * rateMul); }
    }
    for (const b of beams) b.life -= dt;
    beams = beams.filter(b => b.life > 0);

    // drone: seek nearest orb, suck nearby, collect within radius
    if (!drone) newDrone();
    let tgt = null, bd = Infinity;
    for (const o of orbs) { const q = (o.x - drone.x) ** 2 + (o.y - drone.y) ** 2; if (q < bd) { bd = q; tgt = o; } }
    if (tgt) {
      const dx = tgt.x - drone.x, dy = tgt.y - drone.y, dl = Math.hypot(dx, dy) || 1;
      drone.vx += (dx / dl * derived.droneSpeed - drone.vx) * derived.agility;
      drone.vy += (dy / dl * derived.droneSpeed - drone.vy) * derived.agility;
    } else { drone.vx *= 0.9; drone.vy *= 0.9; }
    drone.x = clamp(drone.x + drone.vx * dt, 0, W); drone.y = clamp(drone.y + drone.vy * dt, 0, H);

    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      const dx = drone.x - o.x, dy = drone.y - o.y, dl = Math.hypot(dx, dy) || 1;
      if (dl < derived.suction) { o.x += dx / dl * 260 * dt; o.y += dy / dl * 260 * dt; }
      if (dl < derived.collect + 6 || o.t > 25) {
        if (o.t <= 25) earned += o.value;
        orbs.splice(i, 1);
      }
    }
    if (earned > 0) {
      S.cash = Math.min(derived.capacity, S.cash + earned);
      S.totalRun += earned; META.totalEver += earned; earnAcc += earned;
    }

    // coins/sec estimate for offline
    earnT += dt; if (earnT >= 1) { cps = cps * 0.6 + (earnAcc / earnT) * 0.4; earnAcc = 0; earnT = 0; }

    if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy;
  }

  /* ----------------------------- render -------------------------- */
  function render() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, `hsl(${(S.galaxy * 47) % 360},40%,9%)`); g.addColorStop(1, "#05070d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (blackholeT > 0) { ctx.fillStyle = "rgba(150,90,255,0.10)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, TAU); ctx.fill(); }

    for (const b of beams) { ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.globalAlpha = clamp(b.life / 0.08, 0, 1); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;

    for (const d of dots) {
      ctx.fillStyle = d.hit > 0 ? "#fff" : d.color; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      if (d.special) { ctx.strokeStyle = "#fff8c0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke(); }
      if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#67e89a"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); }
    }
    // orbs
    for (const o of orbs) { ctx.fillStyle = "#ffd45e"; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, TAU); ctx.fill(); }
    // turret + sources
    const n = sources.length;
    for (let i = 0; i < n; i++) {
      const p = sourcePos(i, n), src = sources[i];
      ctx.fillStyle = src.t === "turret" ? "#7aa8ff" : src.t === "mortar" ? "#ff8c3a" : src.t === "plasma" ? "#c08cff" : "#5bd6ff";
      ctx.beginPath(); ctx.arc(p.x, p.y, src.t === "turret" ? 14 : 8, 0, TAU); ctx.fill();
    }
    // drone
    if (drone) {
      ctx.strokeStyle = "rgba(91,214,255,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(drone.x, drone.y, derived.suction, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#5bd6ff"; ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(Date.now() / 300); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
    }
  }

  /* ----------------------------- HUD / UI ------------------------ */
  function syncHUD() {
    $("ui-cash").textContent = fmt(S.cash);
    $("ui-cap").textContent = " / " + fmt(derived.capacity);
    $("ui-galaxy").textContent = S.galaxy;
    $("ui-gname").textContent = galName(S.galaxy);
    $("ui-stardust").textContent = fmt(META.starDust);
    const tc = travelCost(S.galaxy);
    $("galaxy-fill").style.width = clamp(S.cash / tc, 0, 1) * 100 + "%";
    $("btn-travel").textContent = "TRAVEL ▸ $" + fmt(tc);
    $("btn-travel").classList.toggle("ready", S.cash >= tc);
    $("btn-rebirth").classList.toggle("hidden", S.galaxy < 10 && S.peakGalaxy < 10);
    for (const k in ABIL_CD) {
      $("ab-" + k).disabled = abil[k] > 0;
      $("cd-" + k).style.width = abil[k] > 0 ? (abil[k] / ABIL_CD[k] * 100) + "%" : "0";
      $("s-" + k).textContent = abil[k] > 0 ? Math.ceil(abil[k]) + "s" : "";
    }
    // upgrade rows (buy-amount aware + affordability glow)
    for (const id in listRows) {
      const u = UP[id], lvl = S.lv[id], maxed = u.max != null && lvl >= u.max, row = listRows[id];
      row.lv.textContent = (u.id === "mortar" || u.id === "plasma") ? (lvl ? "Lv " + lvl : "") : "Lv " + lvl;
      row.desc.textContent = u.desc(lvl);
      if (maxed) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.el.classList.add("maxed"); row.buy.classList.remove("afford"); continue; }
      row.el.classList.remove("maxed");
      const r = levelsToBuy(u, buyMode);
      if (r.count <= 0) { row.buy.textContent = "$" + fmt(upCost(u)); row.buy.disabled = true; row.buy.classList.remove("afford"); }
      else { row.buy.textContent = (buyMode === "x1" ? "" : "×" + r.count + " ") + "$" + fmt(r.total); row.buy.disabled = false; row.buy.classList.add("afford"); }
    }
    // tab "affordable" badges
    const aff = { def: false, drone: false, eco: false };
    for (const u of UPS) { if (aff[u.tab]) continue; if (u.max != null && S.lv[u.id] >= u.max) continue; if (S.cash >= upCost(u)) aff[u.tab] = true; }
    for (const k in tabBtns) tabBtns[k].classList.toggle("has-buy", !!aff[k]);
  }

  function renderList() {
    const wrap = $("up-list"); wrap.innerHTML = ""; listRows = {};
    const col = activeTab === "def" ? "var(--def)" : activeTab === "drone" ? "var(--drone)" : "var(--eco)";
    for (const u of UPS) {
      if (u.tab !== activeTab) continue;
      const el = document.createElement("div"); el.className = "up";
      el.innerHTML = `<span class="u-dot" style="background:${col}"></span>` +
        `<div class="u-mid"><div class="u-name">${u.name}<span class="lv"></span></div><div class="u-desc"></div></div>` +
        `<button class="u-buy cash"></button>`;
      wrap.appendChild(el);
      const buy = el.querySelector(".u-buy");
      buy.onclick = () => buyUpgrade(u);
      listRows[u.id] = { el, lv: el.querySelector(".lv"), desc: el.querySelector(".u-desc"), buy };
    }
    syncHUD();
  }
  function levelsToBuy(u, mode) {
    let lvl = S.lv[u.id], cash = S.cash, count = 0, total = 0;
    const limit = mode === "max" ? Infinity : mode === "x10" ? 10 : 1;
    while (count < limit) {
      if (u.max != null && lvl >= u.max) break;
      const c = Math.floor(u.base * Math.pow(u.mul, lvl));
      if (cash < c) break;
      cash -= c; total += c; lvl++; count++;
    }
    return { count, total };
  }
  function buyUpgrade(u) {
    const r = levelsToBuy(u, buyMode);
    if (r.count <= 0) return;
    S.cash -= r.total; S.lv[u.id] += r.count;
    if (u.id === "marines" || u.id === "mortar" || u.id === "plasma") rebuildSources();
    const row = listRows[u.id];
    if (row && row.el.animate) row.el.animate([{ filter: "brightness(1.9)" }, { filter: "brightness(1)" }], 220);
    recompute(); syncHUD(); save();
  }

  /* ----------------------------- travel / rebirth / sd ----------- */
  function travel() {
    const c = travelCost(S.galaxy); if (S.cash < c) { flash($("btn-travel")); return; }
    S.cash -= c; S.galaxy++; if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy;
    dots = []; orbs = []; recompute(); syncHUD(); save();
  }
  function flash(el) { el.animate ? el.animate([{ filter: "brightness(2)" }, { filter: "brightness(1)" }], 250) : null; }

  function rebirthGain() { return Math.floor(5 + Math.max(0, S.peakGalaxy - 9) * 6 + Math.cbrt(S.totalRun + 1) * 0.5); }
  function openRebirth() {
    if (S.galaxy < 10 && S.peakGalaxy < 10) return;
    $("rb-text").textContent = "Reset this run (cash & upgrades wiped) to bank Star Dust for permanent upgrades. Star Dust is kept forever.";
    $("rb-gain").textContent = "✦ +" + fmt(rebirthGain()) + " Star Dust";
    $("rebirth-modal").classList.add("show");
  }
  function doRebirth() {
    META.starDust += rebirthGain();
    const keepMeta = META; S = fresh(); META = keepMeta;
    if (META.sd.sdStart > 0) S.cash = 50 * Math.pow(6, META.sd.sdStart);
    dots = []; orbs = []; beams = []; spawnAcc = 0; cps = 0;
    rebuildSources(); newDrone(); recompute();
    $("rebirth-modal").classList.remove("show"); renderList(); buildSD(); syncHUD(); save();
  }

  function buildSD() {
    $("ui-stardust").textContent = fmt(META.starDust);
    const wrap = $("sd-list"); wrap.innerHTML = "";
    for (const u of SDS) {
      const lvl = META.sd[u.id], c = sdCost(u);
      const el = document.createElement("div"); el.className = "up";
      el.innerHTML = `<span class="u-dot" style="background:var(--sd)"></span>` +
        `<div class="u-mid"><div class="u-name">${u.name}<span class="lv">Lv ${lvl}</span></div><div class="u-desc">${u.desc(lvl)}</div></div>` +
        `<button class="u-buy">✦ ${c}</button>`;
      wrap.appendChild(el);
      const buy = el.querySelector(".u-buy"); buy.disabled = META.starDust < c;
      buy.onclick = () => { if (META.starDust < sdCost(u)) return; META.starDust -= sdCost(u); META.sd[u.id]++; recompute(); buildSD(); syncHUD(); save(); };
    }
  }

  /* ----------------------------- input / wiring ------------------ */
  for (const t of document.querySelectorAll(".tab[data-tab]")) {
    tabBtns[t.dataset.tab] = t;
    t.onclick = () => { activeTab = t.dataset.tab; for (const k in tabBtns) tabBtns[k].classList.toggle("sel", tabBtns[k] === t); renderList(); };
  }
  $("buymode").onclick = () => {
    buyMode = buyMode === "x1" ? "x10" : buyMode === "x10" ? "max" : "x1";
    $("buymode").textContent = "BUY " + (buyMode === "x1" ? "×1" : buyMode === "x10" ? "×10" : "MAX");
    syncHUD();
  };
  $("ab-frenzy").onclick = () => useAbility("frenzy");
  $("ab-dotrain").onclick = () => useAbility("dotrain");
  $("ab-blackhole").onclick = () => useAbility("blackhole");
  $("btn-travel").onclick = travel;
  $("btn-rebirth").onclick = openRebirth;
  $("rb-confirm").onclick = doRebirth;
  $("rb-close").onclick = () => $("rebirth-modal").classList.remove("show");
  $("btn-sd").onclick = () => { buildSD(); $("sd-shop").classList.add("show"); };
  $("sd-close").onclick = () => $("sd-shop").classList.remove("show");
  $("btn-menu").onclick = () => { paused = true; $("menu").classList.add("show"); };
  $("menu-close").onclick = $("menu-resume").onclick = () => { paused = false; $("menu").classList.remove("show"); };
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress (including Star Dust)?")) { localStorage.removeItem(KEY); location.reload(); } };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  // tap the field to pop a dot (manual assist)
  canvas.addEventListener("pointerdown", e => {
    if (paused) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 44 * 44;
    for (const d of dots) { const q = (d.x - x) ** 2 + (d.y - y) ** 2; if (q < bd) { bd = q; best = d; } }
    if (best) hitDot(best, derived.damage * 6 + 5);
  });

  /* ----------------------------- loop / boot --------------------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (drone) { drone.x = clamp(drone.x, 0, W); drone.y = clamp(drone.y, 0, H); }
  }
  window.addEventListener("resize", resize);

  let last = 0, saveAcc = 0;
  function loop(now) {
    let dt = (now - last) / 1000 || 0; last = now; if (dt > 0.05) dt = 0.05;
    update(dt); render(); syncHUD();
    saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; save(); }
    requestAnimationFrame(loop);
  }

  load();
  resize();
  rebuildSources();
  newDrone();
  renderList();
  if (S._welcome) { $("welcome-text").textContent = "Your turret kept firing for " + fmtTime(S._welcome.elapsed) + "."; $("welcome-cash").textContent = "$" + fmt(S._welcome.gain); $("welcome").classList.add("show"); S._welcome = null; }
  window.addEventListener("beforeunload", save);
  requestAnimationFrame(loop);

  if (typeof window !== "undefined") window.__IDS = { S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, sources: () => sources, useAbility, travel, doRebirth, rebirthGain, fmt, buyUp: id => buyUpgrade(UP[id]), recompute, abil: () => abil, travelCost };
})();
