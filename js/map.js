/* =====================================================================
   HIVE WORLDS — map.js
   The star map: Universe -> Galaxy -> Solar System with animated
   zoom fly-in / fly-out transitions. Tapping a lit planet starts a battle.
   ===================================================================== */
const MapScreen = {
  level: "universe", galaxy: 0, system: 0, t: 0,
  targets: [],
  trans: null,   // { t, dur, dir, fx, fy, applied, apply }
  hoverPulse: 0,

  enter(level, galaxy, system) {
    this.level = level || "universe";
    if (galaxy != null) this.galaxy = galaxy;
    if (system != null) this.system = system;
    this.trans = null;
  },

  startTrans(dir, fx, fy, apply) {
    this.trans = { t: 0, dur: 0.5, dir, fx: fx || VIEW.w / 2, fy: fy || VIEW.h / 2, applied: false, apply };
    Audio2.click();
  },

  zoomOut() {
    if (this.trans) return;
    if (this.level === "system") this.startTrans("out", VIEW.w / 2, VIEW.h / 2, () => this.level = "galaxy");
    else if (this.level === "galaxy") this.startTrans("out", VIEW.w / 2, VIEW.h / 2, () => this.level = "universe");
    else setState("menu");
  },

  update(dt) {
    this.t += dt;
    this.hoverPulse += dt;
    if (this.trans) {
      this.trans.t += dt;
      const k = this.trans.t / this.trans.dur;
      if (k >= 0.5 && !this.trans.applied) { this.trans.applied = true; this.trans.apply(); }
      if (k >= 1) this.trans = null;
    }
  },

  // transform helper for transitions
  _applyTransform(c) {
    if (!this.trans) return 1;
    const k = clamp(this.trans.t / this.trans.dur, 0, 1);
    const half = k < 0.5;
    const e = half ? Ease.inQuad(k * 2) : Ease.outQuad((k - 0.5) * 2);
    let scale, alpha;
    if (this.trans.dir === "in") { scale = half ? lerp(1, 2.4, e) : lerp(0.5, 1, e); }
    else { scale = half ? lerp(1, 0.55, e) : lerp(1.9, 1, e); }
    alpha = half ? 1 - e : e;
    const fx = this.trans.fx, fy = this.trans.fy;
    c.translate(fx, fy); c.scale(scale, scale); c.translate(-fx, -fy);
    return alpha;
  },

  render() {
    const c = ctx;
    const g = GALAXIES[this.galaxy];
    Sky.draw(c, g ? g.nebula : null, 0, 0);
    this.targets = [];

    c.save();
    const alpha = this._applyTransform(c);
    c.globalAlpha = alpha;

    if (this.level === "universe") this._universe(c);
    else if (this.level === "galaxy") this._galaxy(c);
    else this._system(c);

    c.restore();
    c.globalAlpha = 1;

    // breadcrumb + hint
    setText("map-breadcrumb", this.level === "universe" ? "Universe"
      : this.level === "galaxy" ? g.name : g.name + " › " + g.systems[this.system].name);
    setText("map-hint", this.level === "universe" ? "Tap a galaxy to dive in"
      : this.level === "galaxy" ? "Tap a solar system" : "Tap a lit planet to invade");
  },

  _universe(c) {
    GALAXIES.forEach((g, gi) => {
      const ang = gi / GALAXIES.length * TAU + this.t * 0.04 - Math.PI / 2;
      const R = Math.min(VIEW.w, VIEW.h) * 0.27;
      const cx = VIEW.w / 2 + Math.cos(ang) * R, cy = VIEW.h / 2 + Math.sin(ang) * R * 0.8;
      const rad = Math.min(VIEW.w, VIEW.h) * 0.12;
      paintGalaxy(c, cx, cy, rad, g.hue, this.t, false);
      // conquered fraction
      let total = 0, done = 0;
      PLANETS.forEach(P => { if (P.galaxy === gi) { total++; if (progress.conquered[P.gi]) done++; } });
      c.fillStyle = PAL.text; c.font = "14px ui-monospace, monospace"; c.textAlign = "center";
      c.fillText(g.name, cx, cy + rad + 14);
      c.fillStyle = done === total ? PAL.good : PAL.sentinel2; c.font = "11px ui-monospace, monospace";
      c.fillText(done + "/" + total + " conquered", cx, cy + rad + 30);
      this.targets.push({ x: cx, y: cy, r: rad, act: () => this.startTrans("in", cx, cy, () => { this.level = "galaxy"; this.galaxy = gi; }) });
    });
  },

  _galaxy(c) {
    const g = GALAXIES[this.galaxy];
    paintGalaxy(c, VIEW.w / 2, VIEW.h / 2, Math.min(VIEW.w, VIEW.h) * 0.46, g.hue, this.t, true);
    g.systems.forEach((s, si) => {
      const ang = si / g.systems.length * TAU - Math.PI / 2 + this.t * 0.06;
      const R = Math.min(VIEW.w, VIEW.h) * 0.28;
      const cx = VIEW.w / 2 + Math.cos(ang) * R, cy = VIEW.h / 2 + Math.sin(ang) * R * 0.78;
      paintSun(c, cx, cy, 30, s.star, this.t + si);
      let total = 0, done = 0;
      PLANETS.forEach(P => { if (P.galaxy === this.galaxy && P.system === si) { total++; if (progress.conquered[P.gi]) done++; } });
      const unlockedSys = PLANETS.some(P => P.galaxy === this.galaxy && P.system === si && isUnlocked(P.gi));
      c.fillStyle = unlockedSys ? PAL.text : PAL.dim; c.font = "13px ui-monospace, monospace"; c.textAlign = "center";
      c.fillText(s.name + (done === total ? " ✓" : ""), cx, cy + 48);
      c.fillStyle = PAL.sentinel2; c.font = "10px ui-monospace, monospace";
      c.fillText(done + "/" + total, cx, cy + 62);
      this.targets.push({ x: cx, y: cy, r: 36, act: () => this.startTrans("in", cx, cy, () => { this.level = "system"; this.system = si; }) });
    });
  },

  _system(c) {
    const g = GALAXIES[this.galaxy], s = g.systems[this.system];
    const cx = VIEW.w / 2, cy = VIEW.h * 0.46;
    paintSun(c, cx, cy, 46, s.star, this.t);
    s.planets.forEach((p, pi) => {
      const orbit = Math.min(VIEW.w, VIEW.h) * (0.17 + pi * 0.135);
      const sq = 0.42;
      c.strokeStyle = "rgba(150,190,255,0.12)"; c.lineWidth = 1;
      c.beginPath(); c.ellipse(cx, cy, orbit, orbit * sq, 0, 0, TAU); c.stroke();
      const ang = this.t * (0.45 - pi * 0.07) + pi * 2.2;
      const px = cx + Math.cos(ang) * orbit, py = cy + Math.sin(ang) * orbit * sq;
      const P = PLANETS.find(Q => Q.galaxy === this.galaxy && Q.system === this.system && Q.planet === pi);
      const conquered = !!progress.conquered[P.gi], locked = !isUnlocked(P.gi);
      const pr = 22 + pi * 3;
      // selection pulse if next-to-do
      if (!conquered && !locked) {
        const pulse = 0.5 + 0.5 * Math.sin(this.hoverPulse * 3);
        c.strokeStyle = hexA(PAL.sentinel, 0.3 + pulse * 0.4); c.lineWidth = 2;
        c.beginPath(); c.arc(px, py, pr + 8 + pulse * 4, 0, TAU); c.stroke();
      }
      paintPlanet(c, px, py, pr, p.biome, conquered, locked, this.t);
      c.fillStyle = locked ? PAL.dim : PAL.text; c.font = "12px ui-monospace, monospace"; c.textAlign = "center";
      c.fillText(p.name + (P.isSystemEnd ? " ☠" : ""), px, py + pr + 16);
      if (!locked) this.targets.push({ x: px, y: py, r: pr + 10, act: () => this.startTrans("in", px, py, () => startBattle(P.gi)) });
    });
  },

  tap(x, y) {
    if (this.trans) return;
    for (const t of this.targets) if (dist2(x, y, t.x, t.y) < t.r * t.r) { t.act(); return; }
  },
};
