/* =====================================================================
   HIVE WORLDS — art.js
   Hand-authored procedural artwork. Distinct silhouettes & animation for
   every defender (crystalline "Sentinels") and enemy ("the Hive"), plus
   planets, suns, galaxies, the player Nexus, projectiles and backgrounds.
   ===================================================================== */

/* --------------------------- backgrounds ------------------------- */
const Sky = {
  stars: [], built: 0, t: 0,
  build() {
    this.stars = [];
    const n = Math.round(VIEW.w * VIEW.h / 5200);
    for (let i = 0; i < n; i++) {
      const layer = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2;
      this.stars.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, layer,
        r: layer === 2 ? rand(1.2, 2.2) : rand(0.4, 1.2), tw: Math.random() * TAU, c: Math.random() < 0.15 ? PAL.sentinel2 : "#cfe6ff" });
    }
    this.built = VIEW.w + VIEW.h;
  },
  draw(c, nebula, parX, parY) {
    if (this.built !== VIEW.w + VIEW.h) this.build();
    this.t += 0.016;
    c.fillStyle = PAL.ink; c.fillRect(0, 0, VIEW.w, VIEW.h);
    // nebula clouds
    if (nebula) {
      for (let i = 0; i < 3; i++) {
        const gx = VIEW.w * (0.25 + i * 0.3) + Math.sin(this.t * 0.05 + i) * 30 - (parX || 0) * 0.2;
        const gy = VIEW.h * (0.3 + (i % 2) * 0.4) + Math.cos(this.t * 0.04 + i) * 20 - (parY || 0) * 0.2;
        const rad = Math.max(VIEW.w, VIEW.h) * (0.4 + i * 0.12);
        const g = c.createRadialGradient(gx, gy, 0, gx, gy, rad);
        g.addColorStop(0, hexA(nebula[i % nebula.length], 0.5));
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(0, 0, VIEW.w, VIEW.h);
      }
    }
    // stars w/ parallax + twinkle
    for (const s of this.stars) {
      const px = (parX || 0) * (s.layer + 1) * 0.04;
      const py = (parY || 0) * (s.layer + 1) * 0.04;
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(this.t * (0.6 + s.layer * 0.3) + s.tw));
      c.globalAlpha = tw * (0.5 + s.layer * 0.25);
      c.fillStyle = s.c;
      let x = (s.x - px) % VIEW.w; if (x < 0) x += VIEW.w;
      let y = (s.y - py) % VIEW.h; if (y < 0) y += VIEW.h;
      c.beginPath(); c.arc(x, y, s.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  },
};

// subtle CRT-ish grain + scanlines for a "designed" cohesive finish
function postFX(c) {
  c.globalAlpha = 0.04;
  c.fillStyle = "#000";
  for (let y = 0; y < VIEW.h; y += 3) c.fillRect(0, y, VIEW.w, 1);
  c.globalAlpha = 1;
  // edge vignette (static, soft)
  const g = c.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.4, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
  c.fillStyle = g; c.fillRect(0, 0, VIEW.w, VIEW.h);
}

function hexA(hex, a) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ----------------------------- planets --------------------------- */
function paintPlanet(c, cx, cy, r, biome, conquered, locked, t) {
  // atmosphere
  const glow = c.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.7);
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(0.65, conquered ? hexA(PAL.good, 0.22) : locked ? "rgba(90,110,130,0.12)" : hexA(biome[0], 0.18));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(cx, cy, r * 1.7, 0, TAU); c.fill();

  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
  const c0 = locked ? "#6a727a" : biome[0], c1 = locked ? "#262b30" : biome[1];
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  // continents / banding — deterministic per planet via biome hash
  const seed = (biome[0].charCodeAt(1) || 7) * 13;
  const rot = t * 0.25;
  c.globalAlpha = locked ? 0.1 : 0.28;
  for (let i = 0; i < 7; i++) {
    const bx = cx + (((Math.sin(rot + i * 1.3 + seed) * 0.5 + 0.5) * 2 - 1)) * r;
    const bw = r * (0.18 + (i % 3) * 0.12);
    c.fillStyle = i % 2 ? c1 : c0;
    c.beginPath(); c.ellipse(bx, cy + Math.sin(i * 2 + seed) * r * 0.4, bw, r * 0.9, 0, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  // terminator shadow
  const sh = c.createRadialGradient(cx - r * 0.45, cy - r * 0.45, r * 0.2, cx + r * 0.35, cy + r * 0.35, r * 1.35);
  sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.78)");
  c.fillStyle = sh; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  // specular
  c.globalAlpha = 0.5; c.fillStyle = "rgba(255,255,255,0.5)";
  c.beginPath(); c.ellipse(cx - r * 0.4, cy - r * 0.42, r * 0.16, r * 0.1, -0.6, 0, TAU); c.fill();
  c.globalAlpha = 1;
  c.restore();

  c.strokeStyle = conquered ? hexA(PAL.good, 0.8) : hexA(biome[0], 0.4);
  c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();

  if (conquered) {
    c.fillStyle = PAL.good; c.font = `bold ${Math.max(13, r * 0.55)}px ui-monospace, monospace`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✓", cx, cy - r - 13);
  } else if (locked) {
    c.fillStyle = "rgba(220,235,245,0.65)"; c.font = `${Math.max(12, r * 0.5)}px sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("🔒", cx, cy);
  }
  c.textBaseline = "alphabetic";
}

function paintSun(c, cx, cy, r, color, t) {
  const pulse = 1 + Math.sin(t * 1.5) * 0.04;
  const g = c.createRadialGradient(cx, cy, 2, cx, cy, r * pulse);
  g.addColorStop(0, "#fff"); g.addColorStop(0.35, color); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * pulse, 0, TAU); c.fill();
  // corona flares
  c.strokeStyle = hexA(color, 0.5); c.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + t * 0.3;
    const fl = r * (0.5 + Math.abs(Math.sin(t * 2 + i)) * 0.4);
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45);
    c.lineTo(cx + Math.cos(a) * (r * 0.45 + fl), cy + Math.sin(a) * (r * 0.45 + fl)); c.stroke();
  }
}

function paintGalaxy(c, cx, cy, r, hue, t, big) {
  c.save(); c.translate(cx, cy); c.rotate(t * 0.08);
  const arms = 3, pts = big ? 260 : 110;
  for (let i = 0; i < pts; i++) {
    const f = i / pts, arm = i % arms;
    const ang = f * 6.2 + arm / arms * TAU;
    const rr = f * r, jit = (Math.sin(i * 12.9) * 0.5) * r * 0.04;
    const x = Math.cos(ang) * rr + jit, y = Math.sin(ang) * rr * 0.62 + jit;
    c.globalAlpha = (1 - f) * 0.9;
    c.fillStyle = `hsl(${hue + f * 50},85%,${72 - f * 24}%)`;
    c.fillRect(x, y, big ? 2.2 : 1.8, big ? 2.2 : 1.8);
  }
  c.restore(); c.globalAlpha = 1;
  const cg = c.createRadialGradient(cx, cy, 1, cx, cy, r * 0.42);
  cg.addColorStop(0, "#fff"); cg.addColorStop(0.4, `hsl(${hue},90%,80%)`); cg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, r * 0.42, 0, TAU); c.fill();
}

/* ----------------------------- Nexus (base) ---------------------- */
function paintNexus(c, cx, cy, r, integrity, t) {
  // damaged tint
  const hurt = 1 - integrity;
  // outer rotating rings
  for (let i = 0; i < 3; i++) {
    c.save(); c.translate(cx, cy); c.rotate(t * (0.3 - i * 0.1) * (i % 2 ? -1 : 1));
    c.strokeStyle = hexA(i % 2 ? PAL.sentinel2 : PAL.sentinel, 0.5 - i * 0.12);
    c.lineWidth = 3 - i;
    const rr = r * (1 + i * 0.35);
    for (let s = 0; s < 6; s++) {
      const a0 = s / 6 * TAU + 0.1, a1 = a0 + 0.7;
      c.beginPath(); c.arc(0, 0, rr, a0, a1); c.stroke();
    }
    c.restore();
  }
  // core crystal
  const pulse = 1 + Math.sin(t * 3) * 0.05;
  const g = c.createRadialGradient(cx, cy, 2, cx, cy, r * pulse);
  g.addColorStop(0, "#fff"); g.addColorStop(0.4, PAL.sentinel); g.addColorStop(1, hexA(PAL.sentinel2, 0.1));
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 0.7 * pulse, 0, TAU); c.fill();
  // facets
  c.strokeStyle = hexA(PAL.sentinelHi, 0.7); c.lineWidth = 1.5;
  c.beginPath();
  for (let s = 0; s < 6; s++) { const a = s / 6 * TAU - t * 0.4; const x = cx + Math.cos(a) * r * 0.55, y = cy + Math.sin(a) * r * 0.55; s ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath(); c.stroke();
  if (hurt > 0.05) { // damage cracks / sparks
    c.strokeStyle = hexA(PAL.warn, hurt); c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + t; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 0.6 * hurt, cy + Math.sin(a) * r * 0.6 * hurt); c.stroke(); }
  }
}

/* ----------------------------- defenders ------------------------- */
function paintTower(c, t, time) {
  const def = TOWER_TYPES[t.type];
  const col = def.color, down = t.hp <= 0;
  const x = t.x, y = t.y, r = t.r;
  const recoil = t.recoil || 0;
  // base plate (steel hex) with rim light
  c.save(); c.translate(x, y);
  c.fillStyle = down ? "#2a3640" : PAL.steel;
  polygon(c, 6, r + 6, time * 0 + 0.5); c.fill();
  c.strokeStyle = down ? "#3a4a56" : hexA(col, 0.7); c.lineWidth = 2; polygon(c, 6, r + 6, 0.5); c.stroke();
  // inner ring
  c.fillStyle = PAL.steelHi; c.beginPath(); c.arc(0, 0, r * 0.7, 0, TAU); c.fill();
  c.restore();

  if (down) { // wrecked
    c.fillStyle = "#55636d"; c.beginPath(); c.arc(x, y, r * 0.5, 0, TAU); c.fill();
    return;
  }

  c.save(); c.translate(x, y); c.rotate(t.angle);
  c.translate(-recoil * 5, 0);
  c.shadowColor = col; c.shadowBlur = 10;
  switch (def.shape) {
    case "tri": { // sniper rail
      c.fillStyle = col;
      c.fillRect(0, -2.5, r + 22, 5);
      c.fillStyle = PAL.sentinelHi; c.beginPath(); c.arc(r + 22, 0, 3.5, 0, TAU); c.fill();
      c.fillStyle = PAL.steel; c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fill();
      c.fillStyle = col; c.fillRect(-2, -r * 0.5, 4, r); // scope mount
      break;
    }
    case "dome": { // cannon
      c.fillStyle = PAL.steel; roundRect(c, -r * 0.5, -r * 0.55, r, r * 1.1, 5); c.fill();
      c.fillStyle = col; c.fillRect(0, -6, r + 8, 12);
      c.fillStyle = "#0c1118"; c.beginPath(); c.arc(r + 8, 0, 5, 0, TAU); c.fill();
      break;
    }
    case "spire": { // frost — diamond + shards
      c.fillStyle = col; polygon(c, 4, r * 0.8, time * 0.5); c.fill();
      c.fillStyle = hexA(PAL.sentinelHi, 0.9); polygon(c, 4, r * 0.45, time * 0.5); c.fill();
      c.strokeStyle = hexA(col, 0.5); c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = time * 1.2 + i / 3 * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8)); c.stroke(); }
      break;
    }
    case "coil": { // tesla
      c.strokeStyle = col; c.lineWidth = 3;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(r * 0.2, 0, 4 + i * 4, 0, TAU); c.stroke(); }
      c.fillStyle = PAL.sentinelHi; c.beginPath(); c.arc(r * 0.2, 0, 3, 0, TAU); c.fill();
      // idle sparks
      if (Math.random() < 0.3) { const a = rand(0, TAU); c.strokeStyle = hexA(col, 0.7); c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 0.2 + Math.cos(a) * 10, Math.sin(a) * 10); c.stroke(); }
      break;
    }
    default: { // blaster twin barrels
      c.fillStyle = col;
      c.fillRect(0, -6, r + 12, 4); c.fillRect(0, 2, r + 12, 4);
      c.fillStyle = PAL.steel; c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill();
    }
  }
  // muzzle flash
  if (t.flash > 0) {
    c.shadowBlur = 16; c.fillStyle = "#fff"; c.globalAlpha = clamp(t.flash * 8, 0, 1);
    const mz = def.shape === "tri" ? r + 24 : def.shape === "coil" ? r * 0.2 : r + 12;
    c.beginPath(); c.arc(mz, 0, 6, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  c.restore();
  c.shadowBlur = 0;

  // turret dome + type glyph
  c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 8;
  c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); c.fill(); c.shadowBlur = 0;
  c.fillStyle = "#06121a"; c.font = "bold 10px ui-monospace, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(def.name[0], x, y + 0.5); c.textBaseline = "alphabetic";

  // hp bar (only if hurt)
  if (t.hp < t.maxHp) {
    const f = clamp(t.hp / t.maxHp, 0, 1), bw = r * 2.2;
    c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(x - bw / 2, y + r + 8, bw, 4);
    c.fillStyle = f > 0.5 ? PAL.good : f > 0.25 ? PAL.gold : PAL.warn;
    c.fillRect(x - bw / 2, y + r + 8, bw * f, 4);
  }
}
function polygon(c, n, r, rot) { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); }

/* ----------------------------- enemies --------------------------- */
function paintEnemy(c, e, time) {
  const ty = e.def, a = e.anim, r = e.r;
  c.save(); c.translate(e.x, e.y);
  const face = (e.dir || Math.PI / 2);

  // shield bubble
  if (e.shield > 0) {
    const sf = e.shield / e.maxShield;
    c.strokeStyle = hexA("#9fe0ff", 0.4 + sf * 0.4); c.lineWidth = 2;
    polygon(c, 6, r + 7, time * 0.5); c.stroke();
    c.fillStyle = hexA("#9fe0ff", 0.06 * sf); polygon(c, 6, r + 7, time * 0.5); c.fill();
  }

  c.shadowColor = ty.color; c.shadowBlur = 9;
  const bodyCol = e.flash > 0 ? "#ffffff" : ty.color;

  if (e.boss) { paintBoss(c, e, time, bodyCol); c.restore(); c.shadowBlur = 0; drawHpRing(c, e); return; }

  switch (e.type) {
    case "runner": {
      c.rotate(face + Math.PI / 2);
      // tail streak
      c.fillStyle = hexA(ty.color, 0.3); c.beginPath(); c.moveTo(0, r); c.lineTo(-r * 0.4, r * 2.2); c.lineTo(r * 0.4, r * 2.2); c.closePath(); c.fill();
      c.fillStyle = bodyCol; c.beginPath(); c.moveTo(0, -r * 1.2); c.lineTo(r * 0.75, r * 0.8); c.lineTo(-r * 0.75, r * 0.8); c.closePath(); c.fill();
      c.fillStyle = ty.core; c.beginPath(); c.arc(0, -r * 0.1, r * 0.28, 0, TAU); c.fill();
      break;
    }
    case "brute": {
      // armored carapace plates
      c.fillStyle = bodyCol; polygon(c, 8, r * (1 + 0.05 * Math.sin(a)), a * 0.05); c.fill();
      c.fillStyle = hexA("#000", 0.25);
      for (let i = 0; i < 4; i++) { const ax = (i - 1.5) * r * 0.4; c.fillRect(ax - r * 0.16, -r * 0.7, r * 0.32, r * 1.4); }
      c.fillStyle = ty.core; c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill();
      // little legs
      c.strokeStyle = bodyCol; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const s = i < 2 ? -1 : 1, k = i % 2; const ly = (k - 0.5) * r; c.beginPath(); c.moveTo(s * r * 0.8, ly); c.lineTo(s * (r + 6), ly + Math.sin(a + i) * 4); c.stroke(); }
      break;
    }
    case "flyer": {
      const flap = Math.sin(a * 1.6) * 0.7;
      c.fillStyle = hexA(ty.color, e.flash > 0 ? 1 : 0.85);
      c.save(); c.rotate(flap); c.beginPath(); c.ellipse(-r, 0, r * 1.1, r * 0.4, 0, 0, TAU); c.fill(); c.restore();
      c.save(); c.rotate(-flap); c.beginPath(); c.ellipse(r, 0, r * 1.1, r * 0.4, 0, 0, TAU); c.fill(); c.restore();
      c.fillStyle = bodyCol; c.beginPath(); c.ellipse(0, 0, r * 0.5, r * 0.8, 0, 0, TAU); c.fill();
      c.fillStyle = ty.core; c.beginPath(); c.arc(0, -r * 0.2, r * 0.22, 0, TAU); c.fill();
      break;
    }
    case "splitter": {
      c.fillStyle = bodyCol; c.beginPath();
      for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; const rr = r * (1 + 0.2 * Math.sin(a * 1.6 + i * 1.7)); const x = Math.cos(an) * rr, y = Math.sin(an) * rr; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.closePath(); c.fill();
      // inner blobs (future babies)
      c.fillStyle = hexA(ty.core, 0.8);
      for (let i = 0; i < 3; i++) { const an = a + i / 3 * TAU; c.beginPath(); c.arc(Math.cos(an) * r * 0.4, Math.sin(an) * r * 0.4, r * 0.22, 0, TAU); c.fill(); }
      break;
    }
    case "healer": {
      // jellyfish dome + tendrils
      c.fillStyle = bodyCol; c.beginPath(); c.arc(0, 0, r, Math.PI, TAU); c.fill();
      c.beginPath(); c.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI); c.fillStyle = hexA(ty.color, 0.7); c.fill();
      c.strokeStyle = hexA(ty.color, 0.8); c.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const tx = (i - 2) * r * 0.4; c.beginPath(); c.moveTo(tx, 0); c.quadraticCurveTo(tx + Math.sin(a + i) * 4, r * 0.8, tx + Math.sin(a * 1.3 + i) * 6, r * 1.5); c.stroke(); }
      c.fillStyle = ty.core; c.beginPath(); c.arc(0, -r * 0.2, r * 0.3, 0, TAU); c.fill();
      break;
    }
    case "shielded": {
      c.fillStyle = bodyCol; polygon(c, 5, r, a * 0.1); c.fill();
      c.fillStyle = hexA("#fff", 0.25); polygon(c, 5, r * 0.55, a * 0.1); c.fill();
      c.fillStyle = ty.core; c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.fill();
      break;
    }
    default: { // crawler — segmented grub with legs
      c.strokeStyle = bodyCol; c.lineWidth = 2.4;
      for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1, k = i % 3; const ly = (k - 1) * r * 0.5; const sw = Math.sin(a + i * 1.2) * 4; c.beginPath(); c.moveTo(0, ly); c.lineTo(s * (r + 5), ly + sw); c.stroke(); }
      // body segments
      for (let i = 0; i < 3; i++) { c.fillStyle = i === 0 ? bodyCol : hexA(ty.color, e.flash > 0 ? 1 : 0.9 - i * 0.12); c.beginPath(); c.ellipse((i - 1) * r * 0.5, Math.sin(a + i) * 2, r * 0.6, r * 0.78, 0, 0, TAU); c.fill(); }
      c.fillStyle = ty.core; c.beginPath(); c.arc(0, -r * 0.1, r * 0.3, 0, TAU); c.fill();
    }
  }
  c.restore(); c.shadowBlur = 0;
  drawHpRing(c, e);
}

function paintBoss(c, e, time, bodyCol) {
  const r = e.r;
  // pulsing outer carapace
  c.fillStyle = bodyCol;
  c.beginPath();
  for (let i = 0; i < 14; i++) { const an = i / 14 * TAU; const rr = r * (1 + 0.08 * Math.sin(time * 2 + i)); const x = Math.cos(an) * rr, y = Math.sin(an) * rr; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath(); c.fill();
  // armor plates
  c.fillStyle = hexA("#000", 0.28);
  for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + time * 0.2; c.save(); c.rotate(an); c.fillRect(r * 0.4, -r * 0.12, r * 0.55, r * 0.24); c.restore(); }
  // glowing weak-point core
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  const g = c.createRadialGradient(0, 0, 2, 0, 0, r * 0.5 * pulse);
  g.addColorStop(0, "#fff"); g.addColorStop(0.4, e.def.core); g.addColorStop(1, hexA(bodyCol, 0.1));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.5 * pulse, 0, TAU); c.fill();
  // mandibles
  c.strokeStyle = bodyCol; c.lineWidth = 4;
  for (let s = -1; s <= 1; s += 2) { c.beginPath(); c.moveTo(s * r * 0.7, -r); c.quadraticCurveTo(s * r * 1.2, -r * 0.4 + Math.sin(time * 3) * 6, s * r * 0.5, r * 0.2); c.stroke(); }
}

function drawHpRing(c, e) {
  const total = e.hp + e.shield, max = e.maxHp + e.maxShield;
  if (total >= max) return;
  const f = clamp(total / max, 0, 1), rr = e.r + (e.boss ? 12 : 6);
  c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = e.boss ? 5 : 3;
  c.beginPath(); c.arc(e.x, e.y, rr, 0, TAU); c.stroke();
  c.strokeStyle = e.boss ? PAL.warn : "#fff";
  c.beginPath(); c.arc(e.x, e.y, rr, -Math.PI / 2, -Math.PI / 2 + f * TAU); c.stroke();
}

/* --------------------------- projectiles ------------------------- */
function paintBullet(c, b) {
  if (b.trail) { c.strokeStyle = hexA(b.color, 0.4); c.lineWidth = b.r * 1.4; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); c.stroke(); }
  c.shadowColor = b.color; c.shadowBlur = 8; c.fillStyle = "#fff";
  c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
  c.fillStyle = b.color; c.beginPath(); c.arc(b.x, b.y, b.r * 0.6, 0, TAU); c.fill();
  c.shadowBlur = 0;
}
function paintBeam(c, bm) {
  const a = clamp(bm.life / bm.maxLife, 0, 1);
  c.globalAlpha = a; c.strokeStyle = bm.color; c.shadowColor = bm.color; c.shadowBlur = 12;
  c.lineWidth = 1 + a * 2.5;
  c.beginPath();
  bm.pts.forEach((p, i) => { const jx = rand(-3, 3), jy = rand(-3, 3); i ? c.lineTo(p.x + jx, p.y + jy) : c.moveTo(p.x, p.y); });
  c.stroke();
  c.shadowBlur = 0; c.globalAlpha = 1;
}
