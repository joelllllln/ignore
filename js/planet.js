/* =====================================================================
   HIVE WORLDS — planet.js
   The planet command view (Helldivers-style): a 360° spinning globe with
   city markers you can drag-spin and tap to invade. Uses the WebGL Globe
   when available; otherwise renders a 2D planet so it always works.
   ===================================================================== */
const PlanetScreen = {
  planet: null, rotX: -0.35, rotY: 0, velY: 0.25, lastX: 0, lastY: 0, t: 0, markers: [],
  land: [0.4, 0.8, 0.4], ocean: [0.1, 0.3, 0.6], seed: 0,

  init() {
    Input.on("dragStart", p => { if (state === "planet") { this.lastX = p.x; this.lastY = p.y; } });
    Input.on("drag", p => {
      if (state !== "planet") return;
      this.rotY += (p.x - this.lastX) * 0.008; this.velY = (p.x - this.lastX) * 0.008;
      this.rotX = clamp(this.rotX - (p.y - this.lastY) * 0.006, -1.1, 1.1);
      this.lastX = p.x; this.lastY = p.y;
    });
    Input.on("tap", p => { if (state === "planet") this.tap(p.x, p.y); });
  },

  enter(planet) {
    this.planet = planet;
    this.land = hexRGB(planet.ref.biome[0]); this.ocean = hexRGB(planet.ref.biome[1]);
    this.seed = (planet.gi + 1) * 3.137;
    this.rotY = 0; this.velY = 0.25; this.rotX = -0.35;
    Globe.show(Globe.ok);
    setState("planet");
  },
  exit() { Globe.show(false); MapScreen.enter(this.planet.galaxy); setState("map"); },

  update(dt) {
    this.t += dt;
    this.rotY += (0.18 + this.velY) * dt;
    this.velY *= Math.pow(0.06, dt);       // inertia decay
  },

  screenRadius() { const p = Globe.project([0, 1, 0], 0, 0); return Math.abs(p.y - VIEW.h / 2); },

  render() {
    const c = ctx;
    if (Globe.ok) {
      Globe.render(this.rotX, this.rotY, this.land, this.ocean, this.t, this.seed);
      c.clearRect(0, 0, VIEW.w, VIEW.h);               // 2D layer transparent over GL
      this._stars(c);
    } else {
      Sky.draw(c, this.planet.galRef.nebula, 0, 0);
      paintPlanet(c, VIEW.w / 2, VIEW.h / 2, Math.min(VIEW.w, VIEW.h) * 0.32, this.planet.ref.biome, false, false, this.rotY);
    }
    this._markers(c);
    this._hud(c);
  },

  _stars(c) {
    const cx = VIEW.w / 2, cy = VIEW.h / 2, R = this.screenRadius() * 1.05;
    if (Sky.built !== VIEW.w + VIEW.h) Sky.build();
    for (const s of Sky.stars) {
      if (dist2(s.x, s.y, cx, cy) < R * R) continue;
      c.globalAlpha = (0.4 + 0.5 * Math.abs(Math.sin(this.t * 0.8 + s.tw))) * (0.4 + s.layer * 0.2);
      c.fillStyle = s.c; c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  },

  _markers(c) {
    this.markers = [];
    for (const city of this.planet.cities) {
      const pr = Globe.project(latLonDir(city.lat, city.lon), this.rotX, this.rotY);
      if (!pr.vis) continue;
      const conquered = !!progress.conquered[city.ci], locked = !isUnlocked(city.ci);
      const col = conquered ? PAL.good : locked ? PAL.dim : city.capital ? PAL.gold : PAL.sentinel;
      this.markers.push({ city, x: pr.x, y: pr.y, locked });
      // marker icon
      c.save(); c.translate(pr.x, pr.y);
      if (!conquered && !locked) { const pulse = 0.5 + 0.5 * Math.sin(this.t * 4); c.strokeStyle = hexA(col, 0.3 + pulse * 0.4); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 11 + pulse * 4, 0, TAU); c.stroke(); }
      c.fillStyle = hexA(col, 0.9); c.strokeStyle = "#06121a"; c.lineWidth = 2;
      c.shadowColor = col; c.shadowBlur = 8;
      polygon(c, 6, 7, this.t * 0.5); c.fill(); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = "#06121a"; c.font = "bold 9px ui-monospace, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(conquered ? "✓" : locked ? "" : city.capital ? "☠" : "◆", 0, 1);
      c.restore();
      // label
      c.textAlign = "center"; c.textBaseline = "alphabetic";
      c.font = "10px ui-monospace, monospace"; c.fillStyle = locked ? PAL.dim : PAL.text;
      c.fillText(city.name, pr.x, pr.y + 20);
    }
  },

  _hud(c) {
    const pc = planetCityProgress(this.planet);
    setText("map-breadcrumb", this.planet.galRef.name + " › " + this.planet.ref.name);
    setText("map-hint", "Drag to spin • tap a city to invade  (" + pc.done + "/" + pc.total + ")");
  },

  tap(x, y) {
    let best = null, bd = 26 * 26;
    for (const m of this.markers) { const d = dist2(x, y, m.x, m.y); if (d < bd) { bd = d; best = m; } }
    if (best && !best.locked) { Globe.show(false); startBattle(best.city.ci); }
    else if (best) { Audio2.click(); }
  },
};
