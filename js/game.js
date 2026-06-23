/* =====================================================================
   IDLE DOT SHOOTER — HTML5/Canvas port of the original (Godot) game.
   Faithful 1:1 recreation: same constants, formulas, colours, layout,
   spawning, cannons, bullets, wall, upgrades and game-over.
   ===================================================================== */
(() => {
  "use strict";

  // --- Layout constants (from the original) --------------------------------
  const W = 1152, H = 648;
  const WALL_Y = 588;          // dots crossing this line breach the wall
  const CANNON_Y = 606;        // turrets sit just behind the wall
  const SPAWN_MARGIN = 42;
  const BULLET_SPEED = 640;
  const MAX_CANNONS = 10;
  const START_WALL_HP = 20;
  const TAU = Math.PI * 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // --- Runtime state -------------------------------------------------------
  let difficulty = 1.0, elapsed = 0, spawnTimer = 0;
  let coins = 0, kills = 0, wallHp = START_WALL_HP, wallMaxHp = START_WALL_HP, gameOver = false;
  let dmgLevel = 0, rateLevel = 0, cannonCount = 1, wallLevel = 0;
  let dots = [], bullets = [], cannons = [];

  // --- UI refs -------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const slider = $("slider"), diffVal = $("diff-val"), statsLabel = $("stats");
  const btnDmg = $("btn-dmg"), btnRate = $("btn-rate"), btnCannon = $("btn-cannon"), btnWall = $("btn-wall");
  const gameoverPanel = $("gameover"), goLabel = $("go-text");

  // --- Derived stats (exact formulas) --------------------------------------
  const bulletDamage = () => 2.0 + dmgLevel * 1.5;
  const fireRate = () => Math.min(1.2 + rateLevel * 0.25, 14.0);
  const dmgCost = () => Math.round(15.0 * Math.pow(1.5, dmgLevel));
  const rateCost = () => Math.round(20.0 * Math.pow(1.55, rateLevel));
  const cannonCost = () => Math.round(50.0 * Math.pow(1.8, cannonCount - 1));
  const wallCost = () => Math.round(25.0 * Math.pow(1.5, wallLevel));

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const DOT_PALETTE = [
    "rgb(235,92,92)",   // red
    "rgb(245,158,69)",  // orange
    "rgb(242,219,77)",  // yellow
    "rgb(140,217,102)", // green
    "rgb(102,199,235)", // cyan
    "rgb(179,140,242)", // purple
  ];
  const dotColor = tier => DOT_PALETTE[tier % DOT_PALETTE.length];

  // ==========================================================================
  //  MAIN LOOP
  // ==========================================================================
  let last = 0;
  function frame(now) {
    let delta = (now - last) / 1000 || 0; last = now;
    if (delta > 0.05) delta = 0.05;
    difficulty = parseFloat(slider.value);

    if (!gameOver) {
      elapsed += delta;
      handleSpawning(delta);
      updateDots(delta);
      updateCannons(delta);
      updateBullets(delta);
    }
    updateUI();
    render();
    requestAnimationFrame(frame);
  }

  function handleSpawning(delta) {
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnDot();
      const interval = clamp(1.4 - elapsed * 0.01, 0.32, 1.4) / difficulty;
      spawnTimer = interval;
    }
  }

  function updateDots(delta) {
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.y += d.speed * difficulty * delta;
      if (d.y >= WALL_Y) {
        const dmg = Math.max(1, Math.ceil(d.maxHp / 6.0));   // bigger dots hit harder
        wallHp -= dmg;
        dots.splice(i, 1);
        if (wallHp <= 0) { wallHp = 0; triggerGameOver(); }
      }
    }
  }

  function updateCannons(delta) {
    for (const c of cannons) {
      c.cooldown -= delta;
      const target = nearestDot(c.x, c.y);
      if (target) {
        c.aim = Math.atan2(target.y - c.y, target.x - c.x);
        if (c.cooldown <= 0) { fireBullet(c, target); c.cooldown = 1.0 / fireRate(); }
      }
    }
  }

  function updateBullets(delta) {
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      b.x += b.vx * delta; b.y += b.vy * delta;
      let remove = false;
      if (b.y < -30 || b.x < -30 || b.x > W + 30 || b.y > H + 30) {
        remove = true;
      } else {
        for (let k = dots.length - 1; k >= 0; k--) {
          const d = dots[k];
          if (Math.hypot(b.x - d.x, b.y - d.y) <= d.radius + b.radius) {
            d.hp -= b.damage;
            remove = true;
            if (d.hp <= 0) { coins += d.reward; kills += 1; dots.splice(k, 1); }
            break;
          }
        }
      }
      if (remove) bullets.splice(j, 1);
    }
  }

  // ==========================================================================
  //  ENTITY HELPERS
  // ==========================================================================
  function spawnDot() {
    const tier = Math.floor(elapsed / 12.0);
    const hp = 3.0 + tier * 2.5 + elapsed * 0.05;
    dots.push({
      maxHp: hp, hp: hp,
      speed: 40.0 + elapsed * 0.22,
      reward: 1 + tier,
      radius: clamp(7.0 + hp * 0.12, 7.0, 22.0),
      color: dotColor(tier),
      x: rnd(SPAWN_MARGIN, W - SPAWN_MARGIN), y: -24.0,
    });
  }

  function fireBullet(cannon, target) {
    const bx = cannon.x + Math.cos(cannon.aim) * 24.0;
    const by = cannon.y + Math.sin(cannon.aim) * 24.0;
    let dx = target.x - bx, dy = target.y - by;
    let len = Math.hypot(dx, dy);
    if (len < 0.001) { dx = 0; dy = -1; len = 1; }
    bullets.push({ x: bx, y: by, vx: dx / len * BULLET_SPEED, vy: dy / len * BULLET_SPEED, damage: bulletDamage(), radius: 4.0 });
  }

  function nearestDot(fx, fy) {
    let best = null, bestD = Infinity;
    for (const d of dots) {
      const dist = (fx - d.x) * (fx - d.x) + (fy - d.y) * (fy - d.y);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  function addCannon() {
    cannons.push({ x: 0, y: CANNON_Y, cooldown: 0, aim: -Math.PI / 2 });
    repositionCannons();
  }
  function repositionCannons() {
    const n = cannons.length;
    for (let i = 0; i < n; i++) {
      cannons[i].x = n === 1 ? W / 2.0 : lerp(130.0, W - 130.0, i / (n - 1));
      cannons[i].y = CANNON_Y;
    }
  }

  // ==========================================================================
  //  UPGRADES
  // ==========================================================================
  btnDmg.onclick = () => { const c = dmgCost(); if (coins >= c) { coins -= c; dmgLevel += 1; } };
  btnRate.onclick = () => { const c = rateCost(); if (coins >= c) { coins -= c; rateLevel += 1; } };
  btnCannon.onclick = () => {
    if (cannonCount >= MAX_CANNONS) return;
    const c = cannonCost();
    if (coins >= c) { coins -= c; cannonCount += 1; addCannon(); }
  };
  btnWall.onclick = () => {
    const c = wallCost();
    if (coins >= c) { coins -= c; wallLevel += 1; wallMaxHp += 10; wallHp = wallMaxHp; }  // full repair
  };

  // ==========================================================================
  //  GAME OVER / RESTART
  // ==========================================================================
  function triggerGameOver() {
    gameOver = true;
    goLabel.textContent =
      "WALL BREACHED!\n\nWaves survived: " + Math.floor(elapsed / 12.0) +
      "\nDots destroyed: " + kills + "\nCoins banked: " + coins +
      "\n\nPress Restart to defend again.";
    gameoverPanel.classList.add("show");
  }

  $("btn-restart").onclick = () => {
    dots = []; bullets = []; cannons = [];
    elapsed = 0; spawnTimer = 0; coins = 0; kills = 0;
    dmgLevel = 0; rateLevel = 0; cannonCount = 1; wallLevel = 0;
    wallMaxHp = START_WALL_HP; wallHp = START_WALL_HP; gameOver = false;
    gameoverPanel.classList.remove("show");
    addCannon();
  };

  // ==========================================================================
  //  UI
  // ==========================================================================
  function updateUI() {
    diffVal.textContent = difficulty.toFixed(1) + "x";
    statsLabel.textContent =
      "Coins: " + coins + "\nWall: " + wallHp + " / " + wallMaxHp +
      "\nWave: " + (Math.floor(elapsed / 12.0) + 1) + "\nKills: " + kills + "\nCannons: " + cannonCount;

    const dc = dmgCost();
    btnDmg.textContent = "⬆ Damage  Lv." + dmgLevel + "\n(" + bulletDamage().toFixed(1) + " → " + (bulletDamage() + 1.5).toFixed(1) + ")  [" + dc + "c]";
    btnDmg.disabled = coins < dc;

    const rc = rateCost();
    btnRate.textContent = "⬆ Fire Rate  Lv." + rateLevel + "\n(" + fireRate().toFixed(2) + "/s)  [" + rc + "c]";
    btnRate.disabled = coins < rc;

    if (cannonCount >= MAX_CANNONS) {
      btnCannon.textContent = "Cannons MAXED (" + MAX_CANNONS + ")";
      btnCannon.disabled = true;
    } else {
      const cc = cannonCost();
      btnCannon.textContent = "➕ Add Cannon  (" + cannonCount + "/" + MAX_CANNONS + ")\n[" + cc + "c]";
      btnCannon.disabled = coins < cc;
    }

    const wc = wallCost();
    btnWall.textContent = "🛡 Reinforce Wall  Lv." + wallLevel + "\n(+10 HP, full repair)  [" + wc + "c]";
    btnWall.disabled = coins < wc;
  }

  // ==========================================================================
  //  RENDER
  // ==========================================================================
  function render() {
    // Background
    ctx.fillStyle = "rgb(18,20,28)"; ctx.fillRect(0, 0, W, H);
    // Subtle vertical guide lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, WALL_Y); ctx.stroke(); }
    // Danger zone near the wall
    ctx.fillStyle = "rgba(230,51,51,0.05)"; ctx.fillRect(0, WALL_Y - 60, W, 60);
    // The wall / defense line
    ctx.strokeStyle = "rgba(217,64,64,0.85)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, WALL_Y); ctx.lineTo(W, WALL_Y); ctx.stroke();
    // Ground beneath the wall
    ctx.fillStyle = "rgb(28,33,46)"; ctx.fillRect(0, WALL_Y, W, H - WALL_Y);

    for (const d of dots) drawDot(d);
    for (const b of bullets) drawBullet(b);
    for (const c of cannons) drawCannon(c);
  }

  function drawDot(d) {
    ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, TAU); ctx.fillStyle = d.color; ctx.fill();
    ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, TAU); ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(d.x - d.radius * 0.3, d.y - d.radius * 0.3, d.radius * 0.28, 0, TAU); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fill();
    const frac = clamp(d.hp / Math.max(d.maxHp, 0.001), 0, 1);
    if (frac < 0.999) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.radius + 4, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      ctx.strokeStyle = "rgb(115,255,140)"; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }

  function drawBullet(b) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 1.5, 0, TAU); ctx.fillStyle = "rgba(255,179,51,0.5)"; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, TAU); ctx.fillStyle = "rgb(255,242,115)"; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.5, 0, TAU); ctx.fillStyle = "rgb(255,255,255)"; ctx.fill();
  }

  function drawCannon(c) {
    const dx = Math.cos(c.aim), dy = Math.sin(c.aim);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + dx * 24, c.y + dy * 24); ctx.strokeStyle = "rgb(191,209,242)"; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + dx * 24, c.y + dy * 24); ctx.strokeStyle = "rgb(230,242,255)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x, c.y, 17, 0, TAU); ctx.fillStyle = "rgb(38,46,66)"; ctx.fill();
    ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, TAU); ctx.fillStyle = "rgb(89,184,255)"; ctx.fill();
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, TAU); ctx.fillStyle = "rgb(242,250,255)"; ctx.fill();
  }

  // ==========================================================================
  //  SCALING (fit 1152x648 to the window, letterboxed)
  // ==========================================================================
  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const ox = (window.innerWidth - W * s) / 2, oy = (window.innerHeight - H * s) / 2;
    for (const elx of [canvas, document.getElementById("ui-root")]) {
      elx.style.transform = "translate(" + ox + "px," + oy + "px) scale(" + s + ")";
    }
  }
  window.addEventListener("resize", resize);

  // ==========================================================================
  //  BOOT
  // ==========================================================================
  resize();
  addCannon();   // start with one cannon
  requestAnimationFrame(frame);
})();
