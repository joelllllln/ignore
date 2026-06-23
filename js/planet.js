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
    this.rotY = 0; this.velY = 0.12; this.rotX = -0.35;
    Globe.show(false);                 // reliable 2D globe (canvas), no WebGL dependency
    this.buildCityList();
    setState("planet");
  },
  exit() { Globe.show(false); MapScreen.enter(this.planet.galaxy); setState("map"); },

  // Always-available city selector (works regardless of WebGL / globe rotation)
  buildCityList() {
    const pc = planetCityProgress(this.planet);
    setText("planet-name", this.planet.galRef.name + " › " + this.planet.ref.name);
    const bar = document.getElementById("planet-cities"); bar.innerHTML = "";
    for (const city of this.planet.cities) {
      const conquered = !!progress.conquered[city.ci], locked = !isUnlocked(city.ci);
      const b = document.createElement("button");
      b.className = "city-chip" + (conquered ? " done" : locked ? " locked" : city.capital ? " capital" : " open");
      b.innerHTML = `<span class="cc-ic">${conquered ? "✓" : locked ? "🔒" : city.capital ? "☠" : "◆"}</span>` +
        `<span class="cc-name">${city.name}</span>` +
        `<span class="cc-sub">${conquered ? "liberated" : locked ? "locked" : city.capital ? "CAPITAL" : "invade"}</span>`;
      if (!locked) b.onclick = () => { Audio2.click(); Globe.show(false); startBattle(city.ci); };
      else b.disabled = true;
      bar.appendChild(b);
    }
  },

  update(dt) {
    this.t += dt;
    this.rotY += (0.12 + this.velY) * dt;
    this.velY *= Math.pow(0.04, dt);       // inertia decay
  },

  // True projected silhouette radius of the unit sphere (px), so the drawn
  // planet disc matches where city markers land.
  screenRadius() {
    const d = Globe._camDist(), z = 1 / d, y = Math.sqrt(Math.max(0, 1 - z * z));
    const p = Globe.project([0, y, z], 0, 0);
    return Math.abs(p.y - VIEW.h / 2);
  },

  render() {
    const c = ctx;
    Sky.draw(c, this.planet.galRef.nebula, 0, 0);
    const cx = VIEW.w / 2, cy = VIEW.h / 2, R = this.screenRadius();
    paintPlanet(c, cx, cy, R, this.planet.ref.biome, false, false, this.rotY);
    this._graticule(c);
    this._markers(c);
    FloatText.draw(c);
    this._hud(c);
  },

  // rotating lat/long wireframe — makes the 3D spin obvious & anchors cities
  _graticule(c) {
    c.strokeStyle = hexA(PAL.sentinelHi, 0.13); c.lineWidth = 1;
    for (let m = 0; m < 12; m++) {
      const lon = m / 12 * TAU; let started = false; c.beginPath();
      for (let a = -80; a <= 80; a += 8) {
        const pr = Globe.project(latLonDir(a * Math.PI / 180, lon), this.rotX, this.rotY);
        if (pr.vis) { started ? c.lineTo(pr.x, pr.y) : c.moveTo(pr.x, pr.y); started = true; } else started = false;
      }
      c.stroke();
    }
    for (let p = -60; p <= 60; p += 30) {
      let started = false; c.beginPath();
      for (let lon = 0; lon <= 360; lon += 8) {
        const pr = Globe.project(latLonDir(p * Math.PI / 180, lon * Math.PI / 180), this.rotX, this.rotY);
        if (pr.vis) { started ? c.lineTo(pr.x, pr.y) : c.moveTo(pr.x, pr.y); started = true; } else started = false;
      }
      c.stroke();
    }
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
    setText("planet-hint", "drag to spin • " + pc.done + "/" + pc.total + " cities liberated");
  },

  tap(x, y) {
    let best = null, bd = 32 * 32;
    for (const m of this.markers) { const d = dist2(x, y, m.x, m.y); if (d < bd) { bd = d; best = m; } }
    if (!best) return;
    if (best.locked) { Audio2.click(); FloatText.add(best.x, best.y - 24, "LOCKED", PAL.warn, { size: 12 }); return; }
    Audio2.click(); Globe.show(false); startBattle(best.city.ci);
  },
};
