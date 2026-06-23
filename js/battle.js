/* =====================================================================
   HIVE WORLDS — battle.js
   The core defense loop. A "battle" liberates one CITY. You must clear the
   whole hive (and, in a capital, defeat the boss) — completion is strictly
   kill-driven, so the bar tracks real progress.
   ===================================================================== */
const Battle = {
  s: null,
  grid: { cols: 0, rows: 0, cell: 60, x0: 0, y0: 0 },

  computeGrid() {
    const cell = clamp(Math.floor(VIEW.w / 8.5), 50, 74);
    const cols = Math.max(4, Math.floor((VIEW.w - 16) / cell));
    const rows = 4;
    this.grid = { cell, cols, rows, x0: (VIEW.w - cols * cell) / 2, y0: VIEW.h - 156 - rows * cell };
  },
  cellCenter(cc, rr) { return { x: this.grid.x0 + cc * this.grid.cell + this.grid.cell / 2, y: this.grid.y0 + rr * this.grid.cell + this.grid.cell / 2 }; },
  cellAt(x, y) {
    const cc = Math.floor((x - this.grid.x0) / this.grid.cell), rr = Math.floor((y - this.grid.y0) / this.grid.cell);
    if (cc < 0 || rr < 0 || cc >= this.grid.cols || rr >= this.grid.rows) return null;
    return { c: cc, r: rr };
  },
  towerAtCell(cc, rr) { return this.s.towers.find(t => t.cc === cc && t.rr === rr); },

  start(ci) {
    this.computeGrid();
    const city = CITIES[ci], cfg = cityConfig(city), tb = techBonus(progress);
    this.s = {
      ci, city, P: city.planet, diff: city.planet.gi, isBoss: cfg.boss, cfg, tb,
      species: availableSpecies(city.planet.gi),
      energy: 80 + tb.startE, towers: [], enemies: [], bullets: [], beams: [], pickups: [],
      spawned: 0, killed: 0, hiveTotal: cfg.hive, spawnT: 1.0,
      completion: 0, efficiency: 1, speed: 1, paused: false,
      coreMax: 120 * tb.core, coreHp: 120 * tb.core,
      bossSpawned: false, bossDead: false, boss: null,
      buildType: "blaster", selected: null, drag: null,
      combo: 0, comboT: 0, time: 0, done: false,
      coreX: VIEW.w / 2, coreY: VIEW.h - 74,
    };
    setSpeedUI(1);
    this.deselect();
  },

  bossTarget() { return this.s.isBoss ? 90 : 100; },   // completion reachable from kills
  cap() { return this.s.bossDead ? 100 : this.s.isBoss ? 90 : 100; },
  rewardMult() { return this.s.speed; },

  makeTower(typeId, cc, rr) {
    const def = TOWER_TYPES[typeId], b = def.base, tb = this.s.tb, pos = this.cellCenter(cc, rr);
    return {
      type: typeId, r: this.grid.cell * 0.3, col: def.color, x: pos.x, y: pos.y, cc, rr,
      range: b.range * tb.range, damage: b.damage * tb.dmg, fireRate: b.fireRate * tb.rate,
      projSpeed: b.projSpeed, splash: b.splash, slowMul: b.slowMul, slowDur: b.slowDur, chain: b.chain, crit: b.crit,
      maxHp: Math.round(100 * tb.hp), hp: Math.round(100 * tb.hp), cd: rand(0, 0.4), angle: -Math.PI / 2,
      flash: 0, recoil: 0, priority: "first", unlocked: {}, spent: def.cost, placeT: 0,
    };
  },

  spawnEnemy(forceType, mini) {
    const s = this.s, cfg = s.cfg, typeId = forceType || choose(s.species), ty = ENEMY_TYPES[typeId];
    const side = Math.random(); let x, y;
    if (side < 0.74) { x = rand(VIEW.w * 0.08, VIEW.w * 0.92); y = -26; }
    else if (side < 0.87) { x = -26; y = rand(0, VIEW.h * 0.34); }
    else { x = VIEW.w + 26; y = rand(0, VIEW.h * 0.34); }
    const baseHp = (14 + s.diff * 6) * cfg.hpMul * ty.hp;
    const e = {
      type: typeId, def: ty, x, y, r: (10 + s.diff * 0.3) * ty.size,
      maxHp: baseHp, hp: baseHp,
      shield: ty.shield ? baseHp * ty.shield : 0, maxShield: ty.shield ? baseHp * ty.shield : 0,
      baseSpeed: cfg.speed * ty.spd * rand(0.9, 1.15), dmg: (6 + s.diff * 1.4) * cfg.dmgMul * ty.dmg,
      anim: rand(0, TAU), wob: rand(0, TAU), dir: Math.PI / 2,
      slowT: 0, slowF: 1, hitCd: 0, dashCd: rand(1, 3), dashT: 0, healCd: 1, flash: 0, mini: !!mini,
    };
    s.enemies.push(e);
    if (!forceType && !mini) s.spawned++;
    return e;
  },

  spawnBoss() {
    const s = this.s, type = s.P.sysRef.boss, def = BOSSES[type];
    const scale = (s.city.capital ? 1.5 : 1) * (1 + s.diff * 0.12);
    const hp = def.hp * (14 + s.diff * 5) * scale;
    const e = {
      type, def, boss: true, x: VIEW.w / 2, y: -70, r: (28 + s.diff) * (def.size / 3.4),
      maxHp: hp, hp,
      shield: def.shield ? hp * (def.shield - 1) : 0, maxShield: def.shield ? hp * (def.shield - 1) : 0,
      baseSpeed: s.cfg.speed * def.spd, dmg: (10 + s.diff * 2) * def.dmg,
      anim: 0, wob: 0, dir: Math.PI / 2, slowT: 0, slowF: 1, hitCd: 0, spawnCd: 2.4, flash: 0, mini: false,
    };
    s.enemies.push(e); s.boss = e; s.bossSpawned = true;
    Audio2.boss(); Camera.shake(16); Camera.pulseVignette(def.color, 0.8);
    FloatText.add(VIEW.w / 2, VIEW.h * 0.4, "⚠ " + def.name.toUpperCase() + " ⚠", PAL.warn, { vy: -8, life: 2.2, size: 26, crit: true });
  },

  getTarget(t) {
    let best = null, bestScore = -Infinity; const r2 = t.range * t.range;
    for (const e of this.s.enemies) {
      if (e.dead) continue;
      const d2 = dist2(e.x, e.y, t.x, t.y); if (d2 > r2) continue;
      let score;
      switch (t.priority) {
        case "close": score = -d2; break;
        case "strong": score = e.hp + e.shield; break;
        case "fast": score = e.baseSpeed * e.slowF; break;
        case "weak": score = -(e.hp + e.shield); break;
        default: score = e.y + (e.boss ? 9999 : 0); break;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  },

  fireTower(t) {
    const target = this.getTarget(t); if (!target) return;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.flash = 0.12; t.recoil = 1;
    const crit = Math.random() < t.crit;
    Audio2.shot(t.type);
    if (t.type === "tesla") {
      const pts = [{ x: t.x, y: t.y }]; let cur = target; const hit = new Set();
      for (let i = 0; i <= t.chain; i++) {
        if (!cur || hit.has(cur)) break;
        hit.add(cur); pts.push({ x: cur.x, y: cur.y });
        this.damageEnemy(cur, t.damage * (crit ? 2 : 1), crit && i === 0);
        let nxt = null, nd = 135 * 135;
        for (const e of this.s.enemies) { if (e.dead || hit.has(e)) continue; const d = dist2(e.x, e.y, cur.x, cur.y); if (d < nd) { nd = d; nxt = e; } }
        cur = nxt;
      }
      this.s.beams.push({ pts, life: 0.14, maxLife: 0.14, color: t.col });
      Particles.burst(target.x, target.y, t.col, 4, { speed: 80, life: 0.3 });
    } else {
      const ang = t.angle;
      this.s.bullets.push({
        x: t.x + Math.cos(ang) * (t.r + 6), y: t.y + Math.sin(ang) * (t.r + 6),
        vx: Math.cos(ang) * t.projSpeed, vy: Math.sin(ang) * t.projSpeed,
        damage: t.damage, splash: t.splash, slowMul: t.slowMul, slowDur: t.slowDur,
        r: t.type === "cannon" ? 6 : 4, life: 2.2, color: t.col, crit, trail: t.type === "sniper",
      });
      Particles.burst(t.x + Math.cos(ang) * (t.r + 6), t.y + Math.sin(ang) * (t.r + 6), t.col, 3, { speed: 60, life: 0.2, dir: ang, cone: 0.4 });
    }
  },

  damageEnemy(e, dmg, crit) {
    if (e.dead) return;
    e.flash = 0.12;
    if (e.shield > 0) { e.shield -= dmg; if (e.shield < 0) { e.hp += e.shield; e.shield = 0; } }
    else e.hp -= dmg;
    if (dmg >= 1) FloatText.add(e.x + rand(-6, 6), e.y - e.r, "" + Math.round(dmg), crit ? PAL.gold : "#fff", { size: crit ? 18 : 12, crit });
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    if (e.dead) return; e.dead = true;
    const s = this.s, big = e.r > 16 || e.boss;
    if (e.boss) {
      s.bossDead = true; s.boss = null;
      Camera.shake(20); Camera.freeze(0.35); Camera.flashScreen(e.def.core, 0.6);
      Audio2.explosion(true); Audio2.victory();
      Particles.burst(e.x, e.y, e.def.color, 60, { speed: 320, life: 1.0 });
      Particles.ring(e.x, e.y, e.def.core, 10, 260, 0.7);
      FloatText.add(e.x, e.y, "HIVE BROKEN!", PAL.good, { vy: -20, life: 1.6, size: 26, crit: true });
      Tween.to(s, { completion: 100 }, 1.0, Ease.outCubic);
    } else {
      if (!e.mini) s.killed++;
      s.combo++; s.comboT = 1.9;
      Audio2.kill(s.combo); if (big) { Audio2.explosion(false); Camera.shake(5); }
      const gain = Math.round((2 + e.maxHp * 0.05) * this.rewardMult() * s.tb.eco * (0.6 + 0.4 * s.efficiency));
      this.spawnPickup(e.x, e.y, gain);
      Particles.burst(e.x, e.y, e.def.color, big ? 18 : 9, { speed: big ? 200 : 130, life: 0.5 });
      Particles.ring(e.x, e.y, e.def.color, 6, big ? 60 : 34, 0.4);
      // completion is strictly kill-driven (reach 90 in a capital, 100 otherwise)
      if (!e.mini) s.completion = Math.min(this.cap(), (s.killed / s.hiveTotal) * this.bossTarget());
      const ty = e.def;
      if (ty.split && !e.mini) for (let i = 0; i < ty.split; i++) {
        const ch = this.spawnEnemy("crawler", true);
        ch.x = e.x + rand(-12, 12); ch.y = e.y + rand(-12, 12);
        ch.maxHp = ch.hp = e.maxHp * 0.26; ch.r = e.r * 0.55;
      }
      if (s.combo >= 3) FloatText.add(e.x, e.y - e.r - 12, s.combo + "× COMBO", PAL.sentinel, { size: 12 + Math.min(s.combo, 12), crit: s.combo > 6 });
    }
  },

  spawnPickup(x, y, amount) { this.s.pickups.push({ x, y, vy: -30, amount, life: 1.1, t: 0 }); },

  playerStrike(x, y) {
    const R = 64, s = this.s;
    Particles.ring(x, y, PAL.sentinelHi, 8, R, 0.35);
    Particles.burst(x, y, PAL.sentinelHi, 12, { speed: 160, life: 0.4 });
    Audio2.hit(); Camera.shake(3);
    for (const e of s.enemies) if (!e.dead && dist2(e.x, e.y, x, y) < R * R) this.damageEnemy(e, 16 + s.diff * 3, false);
  },

  update(dt) {
    const s = this.s; if (!s || s.done || s.paused) return;
    if (Camera.hitstop > 0) dt *= 0.15;
    const sp = s.speed, sdt = dt * sp;
    s.time += sdt;

    // spawn the full hive, then the boss (capital only)
    s.spawnT -= sdt;
    if (s.spawnT <= 0) {
      if (s.spawned < s.hiveTotal) { this.spawnEnemy(); s.spawnT = s.cfg.spawn; }
      else if (s.isBoss && !s.bossSpawned && s.killed >= s.hiveTotal) this.spawnBoss();
    }
    if (s.boss && s.boss.def.spawns) { s.boss.spawnCd -= sdt; if (s.boss.spawnCd <= 0) { s.boss.spawnCd = 3; const a = this.spawnEnemy(s.boss.def.spawns, true); a.x = s.boss.x + rand(-30, 30); a.y = s.boss.y + 20; } }
    // non-capital city: liberated once the whole hive is cleared
    if (!s.isBoss && s.killed >= s.hiveTotal) s.completion = 100;

    // efficiency from towers + core (affects fire rate + income, NOT the bar)
    let frac = 0; for (const t of s.towers) frac += t.hp / t.maxHp;
    const towerFrac = s.towers.length ? frac / s.towers.length : 0;
    const coreFrac = s.coreHp / s.coreMax;
    const targetEff = s.towers.length ? towerFrac * 0.72 + coreFrac * 0.28 : coreFrac * 0.4;
    s.efficiency += (targetEff - s.efficiency) * Math.min(1, dt * 3);
    s.coreHp = Math.min(s.coreMax, s.coreHp + s.coreMax * 0.012 * sdt);
    if (s.comboT > 0) { s.comboT -= dt; if (s.comboT <= 0) s.combo = 0; }

    // towers fire (REAL dt → speed adds pressure, not DPS)
    for (const t of s.towers) {
      t.flash = Math.max(0, t.flash - dt * 2);
      t.recoil = Math.max(0, t.recoil - dt * 6);
      t.placeT = Math.min(1, t.placeT + dt * 4);
      if (t.hp <= 0) continue;
      const rate = t.fireRate * (0.45 + 0.55 * (t.hp / t.maxHp));
      t.cd -= dt; if (t.cd <= 0) { this.fireTower(t); t.cd = 1 / rate; }
    }

    // bullets
    for (const b of s.bullets) {
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt;
      if (b.x < -40 || b.x > VIEW.w + 40 || b.y < -40 || b.y > VIEW.h + 40) { b.life = 0; continue; }
      for (const e of s.enemies) {
        if (e.dead) continue; const rr = e.r + b.r;
        if (dist2(e.x, e.y, b.x, b.y) < rr * rr) {
          if (b.splash > 0) {
            Particles.burst(b.x, b.y, b.color, 14, { speed: 180, life: 0.5 });
            Particles.ring(b.x, b.y, b.color, 6, b.splash, 0.35); Audio2.explosion(false); Camera.shake(4);
            for (const o of s.enemies) if (!o.dead && dist2(o.x, o.y, b.x, b.y) < b.splash * b.splash) {
              this.damageEnemy(o, b.damage, false);
              if (b.slowDur > 0 && !o.dead) { o.slowT = b.slowDur; o.slowF = b.slowMul; }
            }
          } else {
            this.damageEnemy(e, b.damage * (b.crit ? 2 : 1), b.crit);
            if (b.slowDur > 0 && !e.dead) { e.slowT = b.slowDur; e.slowF = b.slowMul; }
            Particles.burst(b.x, b.y, e.def.color, 3, { speed: 70, life: 0.25 });
          }
          b.life = 0; break;
        }
      }
    }
    s.bullets = s.bullets.filter(b => b.life > 0);
    for (const bm of s.beams) bm.life -= dt; s.beams = s.beams.filter(b => b.life > 0);

    // enemies
    for (const e of s.enemies) {
      if (e.dead) continue;
      e.anim += sdt * 6; e.wob += sdt * 4; e.flash = Math.max(0, e.flash - dt * 6);
      if (e.slowT > 0) e.slowT -= sdt; else e.slowF = 1;
      const ty = e.def;
      if (ty.heal) { e.healCd -= sdt; if (e.healCd <= 0) { e.healCd = 1.3; for (const o of s.enemies) if (o !== e && !o.dead && dist2(o.x, o.y, e.x, e.y) < 92 * 92) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08); Particles.ring(e.x, e.y, ty.color, 8, 92, 0.45); } }
      if (ty.shield && e.shield < e.maxShield && e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.05 * sdt);
      let speed = e.baseSpeed * e.slowF;
      if (ty.dash) { e.dashCd -= sdt; if (e.dashCd <= 0) { e.dashCd = rand(2, 4); e.dashT = 0.5; } if (e.dashT > 0) { e.dashT -= sdt; speed *= 2.2; } }
      let tgt = null, bd = Infinity;
      for (const t of s.towers) { if (t.hp <= 0) continue; const d = dist2(t.x, t.y, e.x, e.y); if (d < bd) { bd = d; tgt = t; } }
      const aim = tgt || { x: s.coreX, y: s.coreY, r: 30, core: true };
      const dx = aim.x - e.x, dy = aim.y - e.y, dd = Math.hypot(dx, dy) || 1;
      e.dir = Math.atan2(dy, dx);
      const reach = e.r + (aim.r || 26);
      if (dd > reach) {
        const wob = Math.sin(e.wob) * (ty.fly ? 16 : 6);
        e.x += (dx / dd) * speed * sdt + (-dy / dd) * wob * sdt;
        e.y += (dy / dd) * speed * sdt + (dx / dd) * wob * sdt;
      } else {
        e.hitCd -= sdt;
        if (e.hitCd <= 0) {
          e.hitCd = 0.6;
          if (aim.core) {
            s.coreHp = Math.max(0, s.coreHp - e.dmg);
            Camera.shake(6); Camera.pulseVignette(PAL.warn, 0.5); Audio2.coreHit();
            Particles.burst(e.x, e.y, PAL.warn, 6, { speed: 100, life: 0.4 });
          } else {
            tgt.hp = Math.max(0, tgt.hp - e.dmg);
            if (tgt.hp === 0) { Particles.burst(tgt.x, tgt.y, "#888", 16, { speed: 160 }); Audio2.explosion(false); Camera.shake(6); if (s.selected === tgt) this.deselect(); }
            Particles.burst(e.x, e.y, PAL.warn, 4, { speed: 90, life: 0.3 }); Camera.shake(3);
          }
        }
      }
    }
    s.enemies = s.enemies.filter(e => !e.dead);

    for (let i = s.pickups.length - 1; i >= 0; i--) {
      const p = s.pickups[i]; p.t += dt; p.y += p.vy * dt; p.vy += 40 * dt;
      if (p.t > 0.5) { s.energy += p.amount; FloatText.add(p.x, p.y, "+" + p.amount, PAL.gold, { size: 12 }); s.pickups.splice(i, 1); }
    }

    if (s.completion >= 100 && !s.done) { s.done = true; this.onConquer(); }
    syncBattleHUD(s);
  },

  onConquer() {
    const s = this.s, first = !progress.conquered[s.ci];
    progress.conquered[s.ci] = true;
    progress.maxUnlocked = Math.max(progress.maxUnlocked, s.ci + 1);
    if (first) progress.cores = (progress.cores || 0) + (1 + Math.floor(s.diff / 2)) + (s.city.capital ? 2 : 0);
    saveProgress();
    Camera.flashScreen(PAL.good, 0.5);
    showClear(s.ci, first);
  },

  /* ----------------------------- input --------------------------- */
  init() {
    Input.on("tap", p => { if (state !== "battle" || !this.s || this.s.paused) return; this.onTap(p.x, p.y); });
    Input.on("dragStart", p => {
      if (state !== "battle" || !this.s || this.s.paused) return;
      const cell = this.cellAt(p.x, p.y); if (!cell) return;
      const t = this.towerAtCell(cell.c, cell.r); if (t) this.s.drag = { tower: t };
    });
    Input.on("drag", p => { if (this.s && this.s.drag) { this.s.drag.tower.x = p.x; this.s.drag.tower.y = p.y; } });
    Input.on("dragEnd", p => {
      const d = this.s && this.s.drag; if (!d) return;
      const t = d.tower, cell = this.cellAt(p.x, p.y);
      if (cell && !this.towerAtCell(cell.c, cell.r)) { t.cc = cell.c; t.rr = cell.r; }
      const pos = this.cellCenter(t.cc, t.rr); t.x = pos.x; t.y = pos.y; this.s.drag = null; Audio2.place();
    });
  },

  onTap(x, y) {
    const s = this.s, cell = this.cellAt(x, y);
    if (cell) {
      const t = this.towerAtCell(cell.c, cell.r);
      if (t) this.selectTower(t);
      else {
        const def = TOWER_TYPES[s.buildType];
        if (s.energy >= def.cost) {
          s.energy -= def.cost;
          const nt = this.makeTower(s.buildType, cell.c, cell.r);
          s.towers.push(nt); this.selectTower(nt);
          const pos = this.cellCenter(cell.c, cell.r);
          Particles.burst(pos.x, pos.y, def.color, 12, { speed: 120, life: 0.4 });
          Particles.ring(pos.x, pos.y, def.color, 8, this.grid.cell, 0.35);
          Audio2.place(); Camera.shake(3);
        } else { Audio2.click(); FloatText.add(x, y, "NEED ENERGY", PAL.warn, { size: 12 }); }
      }
    } else if (y < this.grid.y0) { this.playerStrike(x, y); this.deselect(); }
    else this.deselect();
  },

  selectTower(t) { this.s.selected = t; if (typeof UI !== "undefined") UI.showTowerPanel(t); },
  deselect() { if (this.s) this.s.selected = null; if (typeof UI !== "undefined") UI.hideTowerPanel(); },
  sellSelected() {
    const t = this.s.selected; if (!t) return;
    const refund = Math.round(t.spent * 0.6); this.s.energy += refund;
    this.s.towers = this.s.towers.filter(x => x !== t);
    FloatText.add(t.x, t.y, "+" + refund, PAL.gold); Particles.burst(t.x, t.y, t.col, 14, { speed: 140 });
    Audio2.buy(); this.deselect();
  },
  buyNode(t, node) {
    if (this.s.energy < node.cost || t.unlocked[node.id]) return false;
    if (!node.req.every(r => t.unlocked[r])) return false;
    this.s.energy -= node.cost; t.unlocked[node.id] = true; t.spent += node.cost; node.apply(t);
    Particles.burst(t.x, t.y, t.col, 16, { speed: 120, life: 0.5 }); Audio2.buy();
    FloatText.add(t.x, t.y - t.r, node.name + "!", t.col, { size: 12 });
    return true;
  },
  setSpeed(v) { this.s.speed = v; },

  /* ---------------------------- render --------------------------- */
  render() {
    const s = this.s, c = ctx, g = this.grid, P = s.P;
    Sky.draw(c, P.galRef.nebula, 0, 0);
    c.fillStyle = hexA(P.ref.surface, 1);
    c.beginPath(); c.moveTo(0, VIEW.h);
    for (let x = 0; x <= VIEW.w; x += 20) c.lineTo(x, VIEW.h - 36 - Math.sin(x * 0.01 + s.time * 0.2) * 8 - 18);
    c.lineTo(VIEW.w, VIEW.h); c.closePath(); c.fill();

    Camera.begin();
    this.drawGrid(c);
    paintNexus(c, s.coreX, s.coreY, 30, s.coreHp / s.coreMax, s.time);
    if (s.drag) { c.globalAlpha = 0.6; paintTower(c, s.drag.tower, s.time); c.globalAlpha = 1; }
    if (s.selected) {
      const t = s.selected; c.strokeStyle = hexA(t.col, 0.35); c.lineWidth = 1.5;
      c.beginPath(); c.arc(t.x, t.y, t.range, 0, TAU); c.stroke(); c.fillStyle = hexA(t.col, 0.05); c.fill();
    }
    for (const b of s.bullets) paintBullet(c, b);
    for (const bm of s.beams) paintBeam(c, bm);
    for (const e of s.enemies) if (!e.boss) paintEnemy(c, e, s.time);
    for (const e of s.enemies) if (e.boss) paintEnemy(c, e, s.time);
    for (const t of s.towers) {
      if (s.drag && s.drag.tower === t) continue;
      if (t.placeT < 1) { c.save(); const sc = Ease.outBack(t.placeT); c.translate(t.x, t.y); c.scale(sc, sc); c.translate(-t.x, -t.y); paintTower(c, t, s.time); c.restore(); }
      else paintTower(c, t, s.time);
    }
    Particles.draw(c);
    for (const p of s.pickups) { c.globalAlpha = clamp(1 - p.t, 0, 1); c.fillStyle = PAL.gold; c.shadowColor = PAL.gold; c.shadowBlur = 8; c.beginPath(); c.arc(p.x, p.y, 4, 0, TAU); c.fill(); c.shadowBlur = 0; }
    c.globalAlpha = 1;
    FloatText.draw(c);
    Camera.end();

    if (s.boss) {
      const bw = VIEW.w * 0.7, bx = (VIEW.w - bw) / 2, by = 124;
      c.fillStyle = "rgba(0,0,0,0.5)"; roundRect(c, bx, by, bw, 12, 6); c.fill();
      const f = clamp((s.boss.hp + s.boss.shield) / (s.boss.maxHp + s.boss.maxShield), 0, 1);
      c.fillStyle = s.boss.def.color; roundRect(c, bx, by, bw * f, 12, 6); c.fill();
      c.fillStyle = PAL.text; c.font = "11px ui-monospace, monospace"; c.textAlign = "center";
      c.fillText(s.boss.def.name, VIEW.w / 2, by - 4);
    }
  },

  drawGrid(c) {
    const g = this.grid;
    for (let cc = 0; cc < g.cols; cc++) for (let rr = 0; rr < g.rows; rr++) {
      const x = g.x0 + cc * g.cell, y = g.y0 + rr * g.cell, occ = this.towerAtCell(cc, rr), m = 2;
      c.strokeStyle = hexA(PAL.sentinel2, occ ? 0.08 : 0.18);
      c.fillStyle = hexA(PAL.sentinel2, occ ? 0.015 : 0.04);
      c.beginPath(); c.rect(x + m, y + m, g.cell - m * 2, g.cell - m * 2); c.fill(); c.stroke();
      c.strokeStyle = hexA(PAL.sentinel, 0.25); c.lineWidth = 1.5; const k = 6;
      c.beginPath();
      c.moveTo(x + m, y + m + k); c.lineTo(x + m, y + m); c.lineTo(x + m + k, y + m);
      c.moveTo(x + g.cell - m - k, y + g.cell - m); c.lineTo(x + g.cell - m, y + g.cell - m); c.lineTo(x + g.cell - m, y + g.cell - m - k);
      c.stroke();
    }
  },
};

function startBattle(ci) { Battle.start(ci); setState("battle"); }
