/* =====================================================================
   HIVE WORLDS — map.js
   Galaxy sector view: the planets of one galaxy laid out as a connected
   lane of worlds. Switch galaxies with the side arrows; tap a planet to
   drop into its globe (PlanetScreen).
   ===================================================================== */
const MapScreen = {
  galaxy: 0, t: 0, targets: [], slide: 0,

  enter(galaxy) { if (galaxy != null) this.galaxy = clamp(galaxy, 0, GALAXIES.length - 1); },
  zoomOut() { setState("menu"); },

  switchGalaxy(dir) {
    const ng = clamp(this.galaxy + dir, 0, GALAXIES.length - 1);
    if (ng === this.galaxy) return;
    this.galaxy = ng; this.slide = dir; Audio2.click();
    Tween.value(0.35, Ease.outCubic, v => { this.slide = dir * (1 - v); });
  },

  update(dt) { this.t += dt; },

  render() {
    const c = ctx, g = GALAXIES[this.galaxy];
    Sky.draw(c, g.nebula, this.slide * 120, 0);
    this.targets = [];

    // faint galaxy emblem behind
    paintGalaxy(c, VIEW.w / 2, VIEW.h * 0.5, Math.min(VIEW.w, VIEW.h) * 0.55, g.hue, this.t, true);
    c.globalAlpha = 0.5; c.fillStyle = PAL.ink; c.fillRect(0, 0, VIEW.w, VIEW.h); c.globalAlpha = 1;

    const planets = g.systems.flatMap(s => s.planets.map((p, pi) => ({ p, s }))); // ordered
    const flat = [];
    g.systems.forEach(s => s.planets.forEach(p => flat.push(PLANETS.find(P => P.ref === p))));
    const n = flat.length;
    const midY = VIEW.h * 0.5, x0 = VIEW.w * 0.14, x1 = VIEW.w * 0.86;
    const ox = this.slide * VIEW.w;

    // connecting lane
    c.strokeStyle = hexA(PAL.sentinel2, 0.25); c.lineWidth = 2; c.beginPath();
    for (let i = 0; i < n; i++) { const x = lerp(x0, x1, n === 1 ? 0.5 : i / (n - 1)) + ox; const y = midY + Math.sin(i * 1.1) * VIEW.h * 0.12; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();

    flat.forEach((P, i) => {
      const x = lerp(x0, x1, n === 1 ? 0.5 : i / (n - 1)) + ox;
      const y = midY + Math.sin(i * 1.1) * VIEW.h * 0.12;
      const pr = planetCityProgress(P);
      const done = pr.done === pr.total;
      const locked = !isUnlocked(P.cities[0].ci);
      const next = !done && !locked;
      const r = 30 + (i % 3) * 4;
      if (next) { const pulse = 0.5 + 0.5 * Math.sin(this.t * 3); c.strokeStyle = hexA(PAL.sentinel, 0.3 + pulse * 0.4); c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 10 + pulse * 5, 0, TAU); c.stroke(); }
      paintPlanet(c, x, y, r, P.ref.biome, done, locked, this.t + i);
      c.textAlign = "center"; c.font = "13px ui-monospace, monospace"; c.fillStyle = locked ? PAL.dim : PAL.text;
      c.fillText(P.ref.name, x, y + r + 16);
      c.font = "10px ui-monospace, monospace"; c.fillStyle = done ? PAL.good : PAL.sentinel2;
      c.fillText(pr.done + "/" + pr.total + " cities", x, y + r + 30);
      if (!locked) this.targets.push({ x, y, r: r + 12, act: () => PlanetScreen.enter(P) });
    });

    // galaxy arrows + dots
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = "26px ui-monospace, monospace";
    if (this.galaxy > 0) { c.fillStyle = hexA(PAL.text, 0.8); c.fillText("‹", 24, midY); this.targets.push({ x: 24, y: midY, r: 30, act: () => this.switchGalaxy(-1) }); }
    if (this.galaxy < GALAXIES.length - 1) { c.fillStyle = hexA(PAL.text, 0.8); c.fillText("›", VIEW.w - 24, midY); this.targets.push({ x: VIEW.w - 24, y: midY, r: 30, act: () => this.switchGalaxy(1) }); }
    c.textBaseline = "alphabetic";
    const dotY = VIEW.h - 24;
    GALAXIES.forEach((_, gi) => { const dx = VIEW.w / 2 + (gi - (GALAXIES.length - 1) / 2) * 18; c.fillStyle = gi === this.galaxy ? PAL.sentinel : hexA(PAL.dim, 0.6); c.beginPath(); c.arc(dx, dotY, 4, 0, TAU); c.fill(); });

    setText("map-breadcrumb", g.name);
    setText("map-hint", "Tap a planet • ‹ › switch galaxy");
  },

  tap(x, y) { for (const t of this.targets) if (dist2(x, y, t.x, t.y) < t.r * t.r) { t.act(); return; } },
};
