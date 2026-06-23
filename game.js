/* =====================================================================
   HIVE WORLDS — an HTML5 / Canvas tower-defense progression game
   ---------------------------------------------------------------------
   Core loop:
     Enter world -> hive enemies spawn & crawl toward your towers ->
     towers auto-fire -> player adjusts speed + taps to assist ->
     world completion climbs to 100% -> advance to the next world.

   Damage to towers never ends the game; it lowers EFFICIENCY, which
   throttles completion gain and energy income. Higher game speed means
   faster progress and more energy, but a fiercer, faster swarm.
   ===================================================================== */

(() => {
  "use strict";

  // ---------------------------------------------------------------- Canvas
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (game) layoutTowers();
  }
  window.addEventListener("resize", resize);

  // ---------------------------------------------------------------- Worlds
  const WORLDS = [
    { name: "Verdant Reach",   bg: ["#0c1f1a", "#06120e"], enemy: "#67e08a", accent: "#45e0c0" },
    { name: "Amber Wastes",    bg: ["#241a0c", "#120c06"], enemy: "#ffb84d", accent: "#ffd45e" },
    { name: "Cobalt Depths",   bg: ["#0c1626", "#06090f"], enemy: "#5aa0ff", accent: "#7ab8ff" },
    { name: "Crimson Hollow",  bg: ["#260c10", "#120608"], enemy: "#ff6b6b", accent: "#ff8e8e" },
    { name: "Violet Expanse",  bg: ["#1c0c26", "#0c0612"], enemy: "#c07aff", accent: "#d7a3ff" },
    { name: "Frost Citadel",   bg: ["#0c1f26", "#061014"], enemy: "#7ce8ff", accent: "#a8f0ff" },
  ];

  // ----------------------------------------------------------- Game state
  let game = null;

  function newGame() {
    return {
      worldIndex: 0,
      energy: 60,
      towers: [],
      enemies: [],
      bullets: [],
      particles: [],
      floaters: [],
      spawned: 0,
      killed: 0,
      hiveTotal: 0,
      spawnTimer: 0,
      completion: 0,      // 0..100
      efficiency: 1,      // 0..1 (avg tower hp fraction, eased)
      speed: 1,
      running: false,
      worldClearing: false,
      shake: 0,
      time: 0,
      costs: { tower: 50, damage: 40, firerate: 40, repair: 30 },
    };
  }

  // ----------------------------------------------------------- Entities
  function makeTower(x, y) {
    return {
      x, y, r: 18,
      maxHp: 100, hp: 100,
      damage: 8,
      fireCooldown: 0,
      fireRate: 1.1,      // shots per second (base)
      range: 230,
      angle: -Math.PI / 2,
      flash: 0,
    };
  }

  function layoutTowers() {
    // Keep towers anchored along a defensive arc near the bottom.
    const n = game.towers.length;
    if (!n) return;
    const marginX = W * 0.12;
    const usable = W - marginX * 2;
    const baseY = H - 150;
    for (let i = 0; i < n; i++) {
      const fx = (n === 1) ? 0.5 : i / (n - 1);
      game.towers[i].x = marginX + usable * fx;
      // slight upward bow in the middle
      const bow = Math.sin(fx * Math.PI) * 26;
      game.towers[i].y = baseY - bow;
    }
  }

  // World configuration scaling
  function worldConfig(idx) {
    return {
      hive: 18 + idx * 8,                         // fixed enemy count for the world
      enemyHp: 14 + idx * 7,
      enemySpeed: 26 + idx * 4,                   // px/sec base
      enemyDamage: 6 + idx * 2,
      spawnInterval: Math.max(0.45, 1.4 - idx * 0.12),
    };
  }

  function startWorld(idx) {
    const cfg = worldConfig(idx);
    game.worldIndex = idx;
    game.enemies.length = 0;
    game.bullets.length = 0;
    game.particles.length = 0;
    game.floaters.length = 0;
    game.spawned = 0;
    game.killed = 0;
    game.hiveTotal = cfg.hive;
    game.spawnTimer = 0;
    game.completion = 0;
    game.worldClearing = false;

    // Ensure at least one tower; on first world create a starter pair.
    if (game.towers.length === 0) {
      game.towers.push(makeTower(0, 0));
      game.towers.push(makeTower(0, 0));
    }
    // Fully repair towers entering a fresh world.
    for (const t of game.towers) t.hp = t.maxHp;

    layoutTowers();
    applyWorldTheme(idx);
    game.running = true;
    updateHUD();
  }

  function applyWorldTheme(idx) {
    const w = WORLDS[idx % WORLDS.length];
    document.documentElement.style.setProperty("--accent", w.accent);
    document.getElementById("ui-world-name").textContent = w.name;
  }

  // --------------------------------------------------------- Spawning
  function spawnEnemy() {
    const idx = game.worldIndex;
    const cfg = worldConfig(idx);
    const w = WORLDS[idx % WORLDS.length];
    // Spawn along the top / upper sides, drift toward tower line.
    const edge = Math.random();
    let x, y;
    if (edge < 0.7) { x = Math.random() * W; y = -20; }
    else if (edge < 0.85) { x = -20; y = Math.random() * H * 0.4; }
    else { x = W + 20; y = Math.random() * H * 0.4; }

    const tier = Math.random();
    const big = tier > 0.82;
    const hpMul = big ? 2.2 : 1;
    const sizeR = big ? 16 : 9 + Math.random() * 4;

    game.enemies.push({
      x, y,
      r: sizeR,
      maxHp: cfg.enemyHp * hpMul,
      hp: cfg.enemyHp * hpMul,
      speed: cfg.enemySpeed * (big ? 0.8 : 1) * (0.85 + Math.random() * 0.35),
      damage: cfg.enemyDamage * (big ? 1.6 : 1),
      color: w.enemy,
      wobble: Math.random() * Math.PI * 2,
      target: null,
      hitCooldown: 0,
    });
    game.spawned++;
  }

  // --------------------------------------------------------- Combat
  function fireTower(t) {
    // find nearest living enemy in range
    let best = null, bestD = t.range * t.range;
    for (const e of game.enemies) {
      const dx = e.x - t.x, dy = e.y - t.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    t.angle = Math.atan2(best.y - t.y, best.x - t.x);
    t.flash = 0.08;
    const speed = 520;
    game.bullets.push({
      x: t.x + Math.cos(t.angle) * t.r,
      y: t.y + Math.sin(t.angle) * t.r,
      vx: Math.cos(t.angle) * speed,
      vy: Math.sin(t.angle) * speed,
      damage: t.damage,
      r: 4,
      life: 2,
    });
  }

  function damageEnemy(e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0) {
      killEnemy(e);
      return true;
    }
    return false;
  }

  function killEnemy(e) {
    e.dead = true;
    game.killed++;
    // Energy income scales with game speed (reward for pressure).
    const gain = Math.round((3 + e.maxHp * 0.06) * (0.7 + game.speed * 0.3));
    game.energy += gain;
    spawnParticles(e.x, e.y, e.color, e.r > 14 ? 16 : 8);
    addFloater(e.x, e.y, "+" + gain, "#ffd45e");
    // Defeating hive members is the main driver of completion.
    const perKill = 100 / game.hiveTotal;
    game.completion = Math.min(100, game.completion + perKill);
  }

  // --------------------------------------------------------- FX
  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 140;
      game.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  }

  function addFloater(x, y, text, color) {
    game.floaters.push({ x, y, text, color, life: 0.9 });
  }

  // --------------------------------------------------------- Player tap
  function playerStrike(x, y) {
    if (!game.running) return;
    const radius = 64;
    spawnParticles(x, y, "#ffffff", 14);
    game.particles.push({ x, y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: "#ffffff", r: radius, ring: true });
    let hit = 0;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        const dmg = 14 + game.worldIndex * 3;
        damageEnemy(e, dmg);
        hit++;
      }
    }
    if (hit) addFloater(x, y - 10, "STRIKE!", "#ffffff");
  }

  // --------------------------------------------------------- Update
  function update(dt) {
    if (!game.running) return;
    const sdt = dt * game.speed;   // simulation time scaled by speed slider
    game.time += sdt;

    // ---- spawn hive members until the world's fixed count is reached
    const cfg = worldConfig(game.worldIndex);
    if (game.spawned < game.hiveTotal) {
      game.spawnTimer -= sdt;
      if (game.spawnTimer <= 0) {
        spawnEnemy();
        game.spawnTimer = cfg.spawnInterval;
      }
    }

    // ---- efficiency = average tower HP fraction (eased toward target)
    let hpFrac = 0;
    let alive = 0;
    for (const t of game.towers) {
      if (t.hp > 0) { hpFrac += t.hp / t.maxHp; alive++; }
    }
    const targetEff = alive ? hpFrac / game.towers.length : 0.15;
    game.efficiency += (targetEff - game.efficiency) * Math.min(1, dt * 3);

    // ---- towers fire
    for (const t of game.towers) {
      if (t.flash > 0) t.flash -= dt;
      if (t.hp <= 0) continue;
      // damaged towers fire slower (efficiency tie-in, per-tower)
      const effRate = t.fireRate * (0.4 + 0.6 * (t.hp / t.maxHp));
      t.fireCooldown -= sdt;
      if (t.fireCooldown <= 0) {
        fireTower(t);
        t.fireCooldown = 1 / effRate;
      }
    }

    // ---- bullets
    for (const b of game.bullets) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      b.life -= sdt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.life = 0;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const rr = (e.r + b.r);
        if (dx * dx + dy * dy < rr * rr) {
          damageEnemy(e, b.damage);
          b.life = 0;
          spawnParticles(b.x, b.y, e.color, 3);
          break;
        }
      }
    }
    game.bullets = game.bullets.filter(b => b.life > 0);

    // ---- enemies move toward nearest living tower & attack it
    for (const e of game.enemies) {
      if (e.dead) continue;
      e.wobble += sdt * 4;
      let tgt = null, bestD = Infinity;
      for (const t of game.towers) {
        if (t.hp <= 0) continue;
        const dx = t.x - e.x, dy = t.y - e.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; tgt = t; }
      }
      // if all towers down, drift to bottom center
      const aim = tgt ? tgt : { x: W / 2, y: H - 80, r: 20 };
      const dx = aim.x - e.x, dy = aim.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = e.r + aim.r;
      if (dist > reach) {
        const wob = Math.sin(e.wobble) * 8;
        e.x += (dx / dist) * e.speed * sdt + (-dy / dist) * wob * sdt;
        e.y += (dy / dist) * e.speed * sdt + (dx / dist) * wob * sdt;
      } else if (tgt) {
        // in contact: damage the tower
        e.hitCooldown -= sdt;
        if (e.hitCooldown <= 0) {
          tgt.hp = Math.max(0, tgt.hp - e.damage);
          e.hitCooldown = 0.6;
          spawnParticles(e.x, e.y, "#ff6b6b", 4);
          game.shake = Math.min(8, game.shake + 3);
        }
      }
    }
    game.enemies = game.enemies.filter(e => !e.dead);

    // ---- passive completion trickle (research) scaled by efficiency & speed
    // This lets a healthy, fast base finish a touch quicker; a battered base crawls.
    const trickle = 0.6 * game.efficiency * game.speed * dt;
    game.completion = Math.min(100, game.completion + trickle);

    // ---- particles & floaters
    for (const p of game.particles) {
      p.life -= dt;
      if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
    }
    game.particles = game.particles.filter(p => p.life > 0);
    for (const f of game.floaters) { f.life -= dt; f.y -= 24 * dt; }
    game.floaters = game.floaters.filter(f => f.life > 0);

    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 20);

    // ---- world completion check
    if (game.completion >= 100 && !game.worldClearing) {
      game.worldClearing = true;
      game.running = false;
      onWorldComplete();
    }

    updateHUD();
  }

  // --------------------------------------------------------- Render
  function render() {
    const w = WORLDS[game.worldIndex % WORLDS.length];
    // background gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, w.bg[0]);
    g.addColorStop(1, w.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }

    drawGrid(w.accent);
    drawTowerBaseline();

    // bullets
    for (const b of game.bullets) {
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = w.accent; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // enemies
    for (const e of game.enemies) drawEnemy(e);

    // towers
    for (const t of game.towers) drawTower(t, w.accent);

    // particles
    for (const p of game.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.ring) {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - alpha) + 8, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // floaters
    ctx.textAlign = "center";
    ctx.font = "bold 14px Segoe UI, sans-serif";
    for (const f of game.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.4);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawGrid(accent) {
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    const step = 48;
    for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  function drawTowerBaseline() {
    // a faint defensive band behind the towers
    const y = H - 165;
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, "rgba(255,255,255,0.0)");
    grad.addColorStop(1, "rgba(120,200,255,0.06)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, H - y);
  }

  function drawEnemy(e) {
    // body
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // dark core
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2); ctx.fill();
    // hp ring if damaged
    if (e.hp < e.maxHp) {
      const frac = e.hp / e.maxHp;
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawTower(t, accent) {
    const down = t.hp <= 0;
    const frac = Math.max(0, t.hp / t.maxHp);

    // range ring (subtle)
    ctx.strokeStyle = down ? "rgba(120,120,120,0.08)" : "rgba(120,200,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2); ctx.stroke();

    // base
    ctx.fillStyle = down ? "#33424d" : "#1c2c38";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 5, 0, Math.PI * 2); ctx.fill();

    // barrel
    if (!down) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = accent;
      ctx.fillRect(0, -4, t.r + 12, 8);
      if (t.flash > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(t.r + 14, 0, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // turret dome
    ctx.fillStyle = down ? "#55636d" : accent;
    ctx.shadowColor = down ? "transparent" : accent;
    ctx.shadowBlur = down ? 0 : 12;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // HP bar
    const bw = 38, bh = 5;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(t.x - bw / 2, t.y + t.r + 8, bw, bh);
    ctx.fillStyle = frac > 0.5 ? "#67e08a" : frac > 0.25 ? "#ffd45e" : "#ff6b6b";
    ctx.fillRect(t.x - bw / 2, t.y + t.r + 8, bw * frac, bh);
  }

  // --------------------------------------------------------- HUD
  function updateHUD() {
    document.getElementById("ui-world").textContent = game.worldIndex + 1;
    document.getElementById("ui-energy").textContent = Math.floor(game.energy);
    document.getElementById("ui-hive").textContent = game.killed + " / " + game.hiveTotal;
    document.getElementById("ui-eff").textContent = Math.round(game.efficiency * 100) + "%";
    const eff = document.getElementById("ui-eff");
    eff.style.color = game.efficiency > 0.6 ? "var(--accent)" : game.efficiency > 0.3 ? "#ffd45e" : "#ff6b6b";

    const pct = Math.floor(game.completion);
    document.getElementById("completion-fill").style.width = pct + "%";
    document.getElementById("completion-pct").textContent = pct + "%";

    // build buttons affordability
    for (const btn of document.querySelectorAll(".build-btn")) {
      const a = btn.dataset.action;
      const cost = game.costs[a];
      document.getElementById("cost-" + a).textContent = cost;
      const ok = game.energy >= cost && (a !== "tower" || game.towers.length < 8);
      btn.disabled = !ok;
      btn.classList.toggle("affordable", ok);
    }
  }

  // --------------------------------------------------------- Build actions
  function doAction(action) {
    if (!game.running) return;
    const cost = game.costs[action];
    if (game.energy < cost) return;

    if (action === "tower") {
      if (game.towers.length >= 8) return;
      game.energy -= cost;
      game.towers.push(makeTower(0, 0));
      layoutTowers();
      game.costs.tower = Math.round(cost * 1.5);
      addFloater(W / 2, H - 150, "New Tower!", WORLDS[game.worldIndex % WORLDS.length].accent);
    } else if (action === "damage") {
      game.energy -= cost;
      for (const t of game.towers) t.damage += 4;
      game.costs.damage = Math.round(cost * 1.35);
    } else if (action === "firerate") {
      game.energy -= cost;
      for (const t of game.towers) t.fireRate += 0.25;
      game.costs.firerate = Math.round(cost * 1.35);
    } else if (action === "repair") {
      game.energy -= cost;
      for (const t of game.towers) t.hp = t.maxHp;
      game.shake = 0;
    }
    updateHUD();
  }

  // --------------------------------------------------------- World complete
  function onWorldComplete() {
    const next = game.worldIndex + 1;
    const overlay = document.getElementById("overlay");
    const last = next >= WORLDS.length;
    document.getElementById("ov-title").textContent = last ? "ALL WORLDS CLEARED!" : "WORLD CLEARED!";
    document.getElementById("ov-text").textContent = last
      ? "You conquered the entire hive. The swarm endures — keep going into deeper, harder worlds!"
      : "The hive of " + WORLDS[game.worldIndex % WORLDS.length].name + " is broken. Advance to " +
        WORLDS[next % WORLDS.length].name + ".";
    document.getElementById("ov-rules").style.display = "none";
    // bonus energy for clearing
    const bonus = 40 + game.worldIndex * 15;
    game.energy += bonus;
    const btn = document.getElementById("ov-btn");
    btn.textContent = (last ? "ENTER ENDLESS WORLD " : "ENTER WORLD ") + (next + 1) + "  (+" + bonus + "⚡)";
    overlay.classList.add("visible");
    btn.onclick = () => {
      overlay.classList.remove("visible");
      startWorld(next);
    };
  }

  // --------------------------------------------------------- Input
  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    const src = evt.touches ? evt.touches[0] : evt;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  canvas.addEventListener("pointerdown", (e) => {
    const p = canvasPoint(e);
    playerStrike(p.x, p.y);
    const hint = document.getElementById("tap-hint");
    if (hint) hint.style.display = "none";
  });

  document.getElementById("speed").addEventListener("input", (e) => {
    game.speed = parseFloat(e.target.value);
    document.getElementById("speed-val").textContent = game.speed.toFixed(1) + "×";
  });

  for (const btn of document.querySelectorAll(".build-btn")) {
    btn.addEventListener("click", () => doAction(btn.dataset.action));
  }

  // --------------------------------------------------------- Main loop
  let lastT = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // --------------------------------------------------------- Boot
  function boot() {
    game = newGame();
    resize();
    render();
    const overlay = document.getElementById("overlay");
    document.getElementById("ov-btn").onclick = () => {
      overlay.classList.remove("visible");
      startWorld(0);
    };
    requestAnimationFrame(loop);
  }

  boot();
})();
