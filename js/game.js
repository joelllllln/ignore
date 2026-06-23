/* =====================================================================
   IDLE DOT SHOOTER
   Dots fall, cannons auto-fire, kills pay coins, you buy a few upgrades.
   Waves scale exponentially so it lasts a very long time. No clutter.
   Uses engine.js (canvas/particles/input/math) + audio.js.
   ===================================================================== */
(() => {
  "use strict";

  /* ----------------------------- numbers ------------------------- */
  const SUF = ["", "K", "M", "B", "T", "aa", "ab", "ac", "ad", "ae", "af"];
  function fmt(n) {
    if (n < 1000) return Math.floor(n).toString();
    let i = 0; while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + SUF[i];
  }

  /* ----------------------------- upgrades ------------------------ */
  // level-based, exponential cost. value() derives the live stat.
  const UPGRADES = [
    { id: "dmg",    name: "Damage",     icon: "⚔", base: 15,  grow: 1.17, max: Infinity },
    { id: "rate",   name: "Fire Rate",  icon: "⚡", base: 25,  grow: 1.20, max: 60 },
    { id: "cannon", name: "+ Cannon",   icon: "➕", base: 140, grow: 2.35, max: 7 },
    { id: "coin",   name: "Coin Boost", icon: "💰", base: 60,  grow: 1.22, max: Infinity },
  ];
  const cost = (u, lvl) => Math.floor(u.base * Math.pow(u.grow, lvl));

  // A CITY is a long climb of WAVES_PER_CITY waves ending in a City Boss. Your
  // whole loadout (cannons + upgrades + coins) carries over to the next city.
  const WAVES_PER_CITY = 30;

  function damage()      { return 5 * Math.pow(1.20, G.lv.dmg); }
  function fireRate()    { return 1.0 + 0.12 * G.lv.rate; }      // shots/sec per cannon
  function cannonCount() { return 1 + G.lv.cannon; }
  function coinMult()    { return 1 + 0.3 * G.lv.coin; }
  function cityHpMul()   { return Math.pow(3.0, G.city - 1); }   // each city is a step up

  /* ----------------------------- dot tiers ----------------------- */
  const TIERS = [
    { c: "#7be86a", hp: 1.0,  coin: 1.0, spd: 1.0,  r: 14, w: 5 },   // grunt
    { c: "#ffe96b", hp: 0.6,  coin: 1.4, spd: 1.7,  r: 11, w: 3 },   // fast
    { c: "#ff8c5a", hp: 2.6,  coin: 2.6, spd: 0.7,  r: 19, w: 2 },   // tank
    { c: "#7ad0ff", hp: 1.5,  coin: 2.0, spd: 1.1,  r: 14, w: 2 },   // runner
    { c: "#d79bff", hp: 4.5,  coin: 5.0, spd: 0.6,  r: 22, w: 1 },   // elite
  ];
  function tiersForWave(w) {
    let n = 1;
    if (w >= 3) n = 2; if (w >= 6) n = 3; if (w >= 10) n = 4; if (w >= 16) n = 5;
    return TIERS.slice(0, n);
  }
  function enemyHp(w, tier) { return 12 * cityHpMul() * Math.pow(1.18, w - 1) * tier.hp; }
  function enemyCoins(w, tier) { return Math.ceil(2 * cityHpMul() * 0.9 * Math.pow(1.15, w - 1) * tier.coin * coinMult()); }
  function enemyDmg(w) { return 8 + w * 0.8 + G.city * 3; }

  /* ----------------------------- state --------------------------- */
  let G = null;
  let state = "menu";   // menu | play | pause | how
  const el = id => document.getElementById(id);

  function fresh() {
    return {
      coins: 0, city: 1, wave: 1, best: 1,
      lv: { dmg: 0, rate: 0, cannon: 0, coin: 0 },
      kills: 0, quota: waveQuota(1),
      cannons: [], dots: [], bullets: [],
      baseMax: 100, baseHp: 100, invuln: 0,
      boss: null, bossWave: false,
      speed: 1, spawnT: 0.6, time: 0,
      banner: null, bannerT: 0,
    };
  }
  function waveQuota(w) { return 15 + Math.floor(w * 3); }       // bigger quotas = longer waves
  function isBossWave(w) { return w % 10 === 0 || w === WAVES_PER_CITY; }
  function isCityBoss() { return G.wave === WAVES_PER_CITY; }

  const SAVE = "idledot.v2";
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ coins: G.coins, city: G.city, wave: G.wave, best: G.best, lv: G.lv })); } catch (e) {}
  }
  function load() {
    G = fresh();
    try {
      const s = JSON.parse(localStorage.getItem(SAVE));
      if (s) { G.coins = s.coins || 0; G.city = Math.max(1, s.city || 1); G.wave = Math.max(1, s.wave || 1); G.best = Math.max(s.best || 1, G.city); G.lv = Object.assign(G.lv, s.lv || {}); }
    } catch (e) {}
    G.quota = waveQuota(G.wave); G.bossWave = isBossWave(G.wave);
  }

  /* ----------------------------- setup --------------------------- */
  function layoutCannons() {
    const n = cannonCount(), y = VIEW.h - 86;
    G.cannons = [];
    for (let i = 0; i < n; i++) {
      const fx = n === 1 ? 0.5 : i / (n - 1);
      G.cannons.push({ x: VIEW.w * (0.16 + fx * 0.68), y, angle: -Math.PI / 2, cd: Math.random() * 0.3, flash: 0, recoil: 0 });
    }
  }

  function startGame() {
    layoutCannons();
    G.dots.length = 0; G.bullets.length = 0; G.boss = null;
    G.baseHp = G.baseMax; G.kills = 0; G.quota = waveQuota(G.wave); G.bossWave = isBossWave(G.wave);
    G.spawnT = 0.4; G.invuln = 1;
    banner("CITY " + G.city + " · WAVE " + G.wave, "#7ab8ff");
    setState("play");
    buildShop(); syncHUD();
  }

  function banner(text, color) { G.banner = { text, color: color || "#7be86a" }; G.bannerT = 1.4; }

  /* ----------------------------- waves --------------------------- */
  function nextWave() {
    G.wave++;
    G.kills = 0; G.quota = waveQuota(G.wave); G.bossWave = isBossWave(G.wave);
    G.boss = null; G.spawnT = 0.5; save();
    banner(G.wave === WAVES_PER_CITY ? "⚠ CITY BOSS ⚠" : G.bossWave ? "⚠ BOSS WAVE ⚠" : "WAVE " + G.wave, G.bossWave ? "#ff5a6a" : "#7be86a");
    if (G.bossWave) Audio2.boss(); else Audio2.click();
    layoutCannons(); syncHUD();
  }

  // City cleared — KEEP all upgrades, cannons and coins; advance to next city.
  function cityClear() {
    G.city++; G.best = Math.max(G.best, G.city);
    G.wave = 1; G.kills = 0; G.quota = waveQuota(1); G.bossWave = false;
    G.dots.length = 0; G.boss = null; G.baseHp = G.baseMax; G.invuln = 2.5; G.spawnT = 0.6;
    banner("CITY " + (G.city - 1) + " CLEARED → CITY " + G.city, "#ffd45e");
    Audio2.victory(); Camera.flashScreen("#ffd45e", 0.45); Camera.shake(8);
    layoutCannons(); save(); syncHUD();
  }

  function overrun() {
    const back = Math.max(1, G.wave - 3);
    G.wave = back;
    G.kills = 0; G.quota = waveQuota(G.wave); G.bossWave = isBossWave(G.wave);
    G.dots.length = 0; G.boss = null; G.baseHp = G.baseMax; G.invuln = 2.5;
    banner("OVERRUN — REGROUP", "#ff5a6a");
    Audio2.explosion(true); Camera.shake(14); Camera.pulseVignette("#ff5a6a", 0.9);
    save(); syncHUD();
  }

  /* ----------------------------- spawning ------------------------ */
  function spawnDot() {
    const tiers = tiersForWave(G.wave);
    let total = tiers.reduce((a, t) => a + t.w, 0), r = Math.random() * total, tier = tiers[0];
    for (const t of tiers) { if ((r -= t.w) <= 0) { tier = t; break; } }
    const hp = enemyHp(G.wave, tier);
    G.dots.push({ x: rand(40, VIEW.w - 40), y: -24, r: tier.r, hp, maxHp: hp, tier,
      vy: (26 + G.wave * 0.8) * tier.spd, wob: rand(0, TAU), wobx: rand(8, 22), hit: 0, coins: enemyCoins(G.wave, tier) });
  }
  function spawnBoss() {
    const city = isCityBoss(), tier = TIERS[4], hp = enemyHp(G.wave, tier) * (city ? 90 : 30);
    G.boss = { x: VIEW.w / 2, y: -60, r: city ? 58 : 46, hp, maxHp: hp, tier, vy: (city ? 9 : 14) + G.wave * 0.2, wob: 0, wobx: VIEW.w * 0.3, hit: 0,
      coins: Math.ceil(enemyCoins(G.wave, tier) * (city ? 60 : 25)), boss: true, city };
    G.dots.push(G.boss);
  }

  /* ----------------------------- combat -------------------------- */
  function nearestDot(x, y, maxD) {
    let best = null, bd = maxD ? maxD * maxD : Infinity;
    for (const d of G.dots) { if (d.dead) continue; const q = dist2(x, y, d.x, d.y); if (q < bd) { bd = q; best = d; } }
    return best;
  }
  function hurt(d, dmg) {
    if (d.dead) return;
    d.hp -= dmg; d.hit = 0.1;
    FloatText.add(d.x + rand(-6, 6), d.y - d.r, fmt(dmg), "#fff", { size: 12 });
    if (d.hp <= 0) kill(d);
  }
  function kill(d) {
    if (d.dead) return; d.dead = true;
    const gain = d.coins; G.coins += gain;
    FloatText.add(d.x, d.y, "+" + fmt(gain), "#ffd45e", { size: d.boss ? 20 : 13, crit: d.boss });
    Particles.burst(d.x, d.y, d.tier.c, d.boss ? 40 : 10, { speed: d.boss ? 260 : 130, life: 0.5 });
    Particles.ring(d.x, d.y, d.tier.c, 6, d.boss ? 120 : 34, 0.4);
    Audio2.kill(1); if (d.boss) { Audio2.explosion(true); Camera.shake(10); Camera.freeze(0.25); }
    if (d.boss) { G.boss = null; if (d.city) cityClear(); else nextWave(); return; }
    G.kills++;
    if (!G.bossWave && G.kills >= G.quota) nextWave();
    else if (G.bossWave && !G.boss) { /* boss spawns from update */ }
    syncHUD();
  }

  function fire(cn) {
    const t = nearestDot(cn.x, cn.y);
    if (!t) return;
    cn.angle = Math.atan2(t.y - cn.y, t.x - cn.x); cn.flash = 0.08; cn.recoil = 1;
    G.bullets.push({ x: cn.x + Math.cos(cn.angle) * 16, y: cn.y + Math.sin(cn.angle) * 16,
      vx: Math.cos(cn.angle) * 620, vy: Math.sin(cn.angle) * 620, dmg: damage(), r: 4, life: 2 });
    Audio2.shot();
  }

  function tapStrike(x, y) {
    const d = nearestDot(x, y, 46);
    Particles.burst(x, y, "#fff", 8, { speed: 120, life: 0.3 });
    if (d) { hurt(d, damage() * 8 + 5); Camera.shake(2); }
    Audio2.hit();
  }

  /* ----------------------------- update -------------------------- */
  function update(dt) {
    if (state !== "play") return;
    if (G.bannerT > 0) G.bannerT -= dt;
    if (G.invuln > 0) G.invuln -= dt;
    const sdt = dt * G.speed;       // dots/spawns fast-forward with speed
    G.time += sdt;

    // spawning
    G.spawnT -= sdt;
    if (G.bossWave) {
      if (!G.boss && !G.dots.some(d => d.boss)) { if (G.spawnT <= 0) { spawnBoss(); } }
      // a few minions during boss
      if (G.spawnT <= 0 && G.dots.length < 10) { spawnDot(); G.spawnT = 1.4; }
    } else if (G.spawnT <= 0 && G.dots.length < 46) {
      spawnDot();
      G.spawnT = Math.max(0.18, 0.7 - G.wave * 0.01);
    }

    // cannons fire on REAL dt (speed = pressure, not extra dps)
    for (const cn of G.cannons) {
      cn.flash = Math.max(0, cn.flash - dt * 3);
      cn.recoil = Math.max(0, cn.recoil - dt * 6);
      cn.cd -= dt;
      if (cn.cd <= 0) { fire(cn); cn.cd = 1 / fireRate(); }
    }

    // bullets (world time)
    for (const b of G.bullets) {
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt;
      if (b.y < -30 || b.x < -30 || b.x > VIEW.w + 30) { b.life = 0; continue; }
      for (const d of G.dots) {
        if (d.dead) continue; const rr = d.r + b.r;
        if (dist2(d.x, d.y, b.x, b.y) < rr * rr) { hurt(d, b.dmg); b.life = 0; Particles.burst(b.x, b.y, d.tier.c, 3, { speed: 70, life: 0.2 }); break; }
      }
    }
    G.bullets = G.bullets.filter(b => b.life > 0);

    // dots descend; reaching base hurts it
    const baseY = VIEW.h - 56;
    for (const d of G.dots) {
      if (d.dead) continue;
      d.wob += sdt * 2;
      d.y += d.vy * sdt;
      d.x += Math.sin(d.wob) * d.wobx * sdt * 0.4;
      if (d.hit > 0) d.hit -= dt;
      if (d.y >= baseY - d.r) {
        if (G.invuln <= 0) { G.baseHp -= enemyDmg(G.wave) * (d.boss ? 6 : 1); Camera.shake(d.boss ? 10 : 4); Camera.pulseVignette("#ff5a6a", 0.4); Audio2.coreHit(); }
        Particles.burst(d.x, baseY, "#ff5a6a", 8, { speed: 120, life: 0.4 });
        d.dead = true; if (d.boss) G.boss = null;
      }
    }
    G.dots = G.dots.filter(d => !d.dead);

    // base regen + overrun (check depletion BEFORE regen so it reliably fires)
    if (G.baseHp <= 0) overrun();
    else G.baseHp = Math.min(G.baseMax, G.baseHp + G.baseMax * 0.04 * dt);

    syncHUD();
  }

  /* ----------------------------- render -------------------------- */
  function render() {
    const c = ctx;
    // bg
    const g = c.createLinearGradient(0, 0, 0, VIEW.h);
    g.addColorStop(0, "#0a1422"); g.addColorStop(1, "#05080f");
    c.fillStyle = g; c.fillRect(0, 0, VIEW.w, VIEW.h);
    starfield(c);

    Camera.begin();
    const baseY = VIEW.h - 56;
    // base strip
    c.fillStyle = G.invuln > 0 ? "rgba(122,184,255,0.18)" : "rgba(122,184,255,0.10)";
    c.fillRect(0, baseY, VIEW.w, VIEW.h - baseY);
    c.strokeStyle = "rgba(122,184,255,0.5)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, baseY); c.lineTo(VIEW.w, baseY); c.stroke();

    for (const d of G.dots) drawDot(c, d);
    for (const b of G.bullets) { c.fillStyle = "#fff"; c.shadowColor = "#7ab8ff"; c.shadowBlur = 8; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); }
    c.shadowBlur = 0;
    for (const cn of G.cannons) drawCannon(c, cn);

    Particles.draw(c);
    FloatText.draw(c);
    Camera.end();

    // banner
    if (G.bannerT > 0) {
      const a = clamp(G.bannerT / 1.4, 0, 1);
      c.globalAlpha = a; c.textAlign = "center";
      c.font = "900 34px ui-monospace, monospace"; c.fillStyle = G.banner.color;
      c.shadowColor = G.banner.color; c.shadowBlur = 16;
      c.fillText(G.banner.text, VIEW.w / 2, VIEW.h * 0.32);
      c.shadowBlur = 0; c.globalAlpha = 1;
    }
  }

  let _stars = [];
  function starfield(c) {
    if (_stars.length === 0 || _stars._k !== VIEW.w + VIEW.h) {
      _stars = []; _stars._k = VIEW.w + VIEW.h;
      for (let i = 0; i < 70; i++) _stars.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, r: rand(0.5, 1.6), s: rand(8, 26) });
    }
    for (const s of _stars) {
      if (state === "play") { s.y += s.s * 0.016 * (G ? G.speed : 1); if (s.y > VIEW.h) { s.y = 0; s.x = Math.random() * VIEW.w; } }
      c.globalAlpha = 0.5; c.fillStyle = "#9fc4ff"; c.fillRect(s.x, s.y, s.r, s.r);
    }
    c.globalAlpha = 1;
  }

  function drawDot(c, d) {
    const col = d.hit > 0 ? "#ffffff" : d.tier.c;
    c.shadowColor = d.tier.c; c.shadowBlur = d.boss ? 18 : 10;
    c.fillStyle = col; c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "rgba(0,0,0,0.32)"; c.beginPath(); c.arc(d.x, d.y, d.r * 0.5, 0, TAU); c.fill();
    if (d.hp < d.maxHp) {
      const f = clamp(d.hp / d.maxHp, 0, 1), bw = d.r * 2.1;
      c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(d.x - bw / 2, d.y - d.r - 9, bw, 4);
      c.fillStyle = d.boss ? "#ff5a6a" : "#7be86a"; c.fillRect(d.x - bw / 2, d.y - d.r - 9, bw * f, 4);
    }
    if (d.boss) { c.fillStyle = "#fff"; c.font = "bold 12px ui-monospace,monospace"; c.textAlign = "center"; c.fillText("BOSS", d.x, d.y + 4); }
  }
  function drawCannon(c, cn) {
    c.fillStyle = "#1b2a38"; c.beginPath(); c.arc(cn.x, cn.y, 17, 0, TAU); c.fill();
    c.save(); c.translate(cn.x, cn.y); c.rotate(cn.angle); c.translate(-cn.recoil * 4, 0);
    c.fillStyle = "#4ff0d0"; c.fillRect(0, -4, 22, 8);
    if (cn.flash > 0) { c.fillStyle = "#fff"; c.beginPath(); c.arc(24, 0, 5, 0, TAU); c.fill(); }
    c.restore();
    c.fillStyle = "#4ff0d0"; c.shadowColor = "#4ff0d0"; c.shadowBlur = 8; c.beginPath(); c.arc(cn.x, cn.y, 8, 0, TAU); c.fill(); c.shadowBlur = 0;
  }

  /* ----------------------------- shop / HUD ---------------------- */
  function buildShop() {
    const shop = el("shop"); shop.innerHTML = "";
    for (const u of UPGRADES) {
      const b = document.createElement("button"); b.className = "buy"; b.dataset.id = u.id;
      b.innerHTML = `<span class="buy-ic">${u.icon}</span><span class="buy-mid"><span class="buy-name">${u.name}</span>` +
        `<span class="buy-lv" id="lv-${u.id}"></span></span><span class="buy-cost" id="cost-${u.id}"></span>`;
      b.onclick = () => buy(u);
      shop.appendChild(b);
    }
    syncHUD();
  }
  function buy(u) {
    const lvl = G.lv[u.id];
    if (lvl >= u.max) return;
    const c = cost(u, lvl);
    if (G.coins < c) { Audio2.click(); return; }
    G.coins -= c; G.lv[u.id]++;
    Audio2.buy();
    if (u.id === "cannon") layoutCannons();
    save(); syncHUD();
  }
  function syncHUD() {
    el("ui-coins").textContent = fmt(G.coins);
    el("ui-city").textContent = G.city;
    el("ui-wave").textContent = G.wave + "/" + WAVES_PER_CITY;
    el("ui-best").textContent = G.best;
    if (G.bossWave) { el("ui-quota").textContent = isCityBoss() ? "CITY BOSS" : "BOSS"; el("wave-fill").style.width = (G.boss ? clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 : 100) + "%"; }
    else { el("ui-quota").textContent = G.kills + "/" + G.quota; el("wave-fill").style.width = clamp(G.kills / G.quota, 0, 1) * 100 + "%"; }
    el("base-fill").style.width = clamp(G.baseHp / G.baseMax, 0, 1) * 100 + "%";
    for (const u of UPGRADES) {
      const lvl = G.lv[u.id], maxed = lvl >= u.max, c = cost(u, lvl);
      el("lv-" + u.id).textContent = u.id === "cannon" ? "×" + cannonCount() : "Lv " + lvl;
      el("cost-" + u.id).textContent = maxed ? "MAX" : fmt(c) + "◆";
      const btn = document.querySelector('.buy[data-id="' + u.id + '"]');
      btn.classList.toggle("poor", !maxed && G.coins < c);
      btn.classList.toggle("maxed", maxed);
    }
  }

  /* ----------------------------- state / input ------------------- */
  function setState(s) {
    state = s;
    el("menu").classList.toggle("visible", s === "menu");
    el("how").classList.toggle("visible", s === "how");
    el("pause").classList.toggle("visible", s === "pause");
    el("hud").style.display = (s === "play" || s === "pause") ? "block" : "none";
    el("controls").style.display = (s === "play" || s === "pause") ? "block" : "none";
    if (s === "menu") el("ui-best").textContent = G.best;
  }

  Input.on("tap", p => { if (state === "play") tapStrike(p.x, p.y); });
  window.onResize = function () { if (G && G.cannons.length) layoutCannons(); };

  /* ----------------------------- buttons ------------------------- */
  el("btn-play").onclick = () => { Audio2.unlock(); startGame(); };
  el("btn-how").onclick = () => setState("how");
  el("btn-how-back").onclick = () => setState("menu");
  el("btn-pause").onclick = () => { Audio2.click(); setState("pause"); };
  el("btn-resume").onclick = () => { Audio2.click(); setState("play"); };
  el("btn-quit").onclick = () => { Audio2.click(); save(); setState("menu"); };
  el("btn-reset").onclick = () => { if (confirm("Erase your save?")) { localStorage.removeItem(SAVE); load(); setState("menu"); } };
  const soundToggle = e => Audio2.setEnabled(e.target.checked);
  el("set-sound").onchange = soundToggle; el("set-sound2").onchange = soundToggle;
  el("speed").oninput = e => { G.speed = parseInt(e.target.value); el("speed-val").textContent = G.speed + "×"; };

  /* ----------------------------- loop ---------------------------- */
  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    Camera.update(dt); Tween.update(dt); Particles.update(dt); FloatText.update(dt);
    Audio2.music(dt);
    update(dt);
    render();
    Camera.renderOverlays();
    Input.postFrame();
    requestAnimationFrame(loop);
  }

  /* ----------------------------- boot ---------------------------- */
  load();
  resizeCanvas();
  Input.init();
  setState("menu");
  requestAnimationFrame(loop);

  // lightweight debug handle (used by tests / console)
  if (typeof window !== "undefined") window.__IDS = { G: () => G, state: () => state, fmt, cannonCount, WAVES_PER_CITY };
})();
