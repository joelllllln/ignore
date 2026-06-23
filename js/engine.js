/* =====================================================================
   HIVE WORLDS — engine.js
   Core systems shared by every screen: canvas, math, easing, RNG,
   input, camera (with shake + hit-stop), tween scheduler, and a pooled
   particle system. No external assets — everything is procedural.
   ===================================================================== */

const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
const VIEW = { w: 0, h: 0, dpr: 1 };

function resizeCanvas() {
  VIEW.dpr = Math.min(window.devicePixelRatio || 1, 2);
  VIEW.w = cv.clientWidth;
  VIEW.h = cv.clientHeight;
  cv.width = Math.floor(VIEW.w * VIEW.dpr);
  cv.height = Math.floor(VIEW.h * VIEW.dpr);
  ctx.setTransform(VIEW.dpr, 0, 0, VIEW.dpr, 0, 0);
  if (typeof onResize === "function") onResize();
}
window.addEventListener("resize", resizeCanvas);

/* ----------------------------- math ------------------------------ */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => (a + Math.random() * (b - a + 1)) | 0;
const choose = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return a + d * t;
}
function approach(v, target, step) { return v < target ? Math.min(v + step, target) : Math.max(v - step, target); }

/* ----------------------------- easing ---------------------------- */
const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: t => (--t) * t * t + 1,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => { if (t === 0 || t === 1) return t; const c4 = TAU / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/* ----------------------------- tweens ---------------------------- */
const Tween = {
  list: [],
  to(obj, props, dur, ease, onDone) {
    const from = {};
    for (const k in props) from[k] = obj[k];
    const t = { obj, from, props, dur, t: 0, ease: ease || Ease.outCubic, onDone };
    this.list.push(t);
    return t;
  },
  value(dur, ease, onUpdate, onDone) {
    this.list.push({ scalar: true, t: 0, dur, ease: ease || Ease.linear, onUpdate, onDone });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      const e = tw.ease(k);
      if (tw.scalar) { if (tw.onUpdate) tw.onUpdate(e); }
      else for (const p in tw.props) tw.obj[p] = lerp(tw.from[p], tw.props[p], e);
      if (k >= 1) { this.list.splice(i, 1); if (tw.onDone) tw.onDone(); }
    }
  },
  clear() { this.list.length = 0; },
};

/* ----------------------------- camera ---------------------------- */
const Camera = {
  shakeX: 0, shakeY: 0, shakeMag: 0, shakeDecay: 0,
  hitstop: 0,            // seconds of frozen-ish time remaining
  flash: 0, flashColor: "#ffffff",
  vignette: 0, vignetteColor: "#ff5a5a",
  shake(mag) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeDecay = 1; },
  kick(mag) { this.shake(mag); },
  freeze(sec) { this.hitstop = Math.max(this.hitstop, sec); },
  flashScreen(c, amt) { this.flashColor = c; this.flash = Math.max(this.flash, amt); },
  pulseVignette(c, amt) { this.vignetteColor = c; this.vignette = Math.max(this.vignette, amt); },
  update(dt) {
    if (this.shakeMag > 0.05) {
      this.shakeX = rand(-1, 1) * this.shakeMag;
      this.shakeY = rand(-1, 1) * this.shakeMag;
      this.shakeMag *= Math.pow(0.0015, dt); // fast exp decay
      this.shakeMag -= dt * 6;
      if (this.shakeMag < 0.05) this.shakeMag = 0;
    } else { this.shakeX = this.shakeY = 0; }
    if (this.hitstop > 0) this.hitstop -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.5);
    if (this.vignette > 0) this.vignette = Math.max(0, this.vignette - dt * 1.6);
  },
  begin() { ctx.save(); ctx.translate(this.shakeX, this.shakeY); },
  end() { ctx.restore(); },
  renderOverlays() {
    if (this.flash > 0) {
      ctx.globalAlpha = clamp(this.flash, 0, 1) * 0.6;
      ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.globalAlpha = 1;
    }
    if (this.vignette > 0) {
      const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.3, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, this.vignetteColor);
      ctx.globalAlpha = clamp(this.vignette, 0, 1) * 0.7;
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.globalAlpha = 1;
    }
  },
};

/* -------------------------- particle system ---------------------- */
// One pooled array. Each particle: x,y,vx,vy,life,max,r,color,kind,grav,drag,spin,rot
const Particles = {
  pool: [],
  spawn(o) {
    const p = this.pool.find(p => p.dead) || (this.pool.push(_blankP()), this.pool[this.pool.length - 1]);
    p.dead = false;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = p.max = o.life || 0.6;
    p.r = o.r || 2; p.r0 = p.r;
    p.color = o.color || "#fff";
    p.kind = o.kind || "spark";   // spark | smoke | ring | shard | glow | debris
    p.grav = o.grav || 0;
    p.drag = o.drag == null ? 0.92 : o.drag;
    p.spin = o.spin || 0; p.rot = o.rot || 0;
    p.r1 = o.r1 != null ? o.r1 : p.r;   // ring end radius
    return p;
  },
  burst(x, y, color, n, opt) {
    opt = opt || {};
    const spd = opt.speed || 140, life = opt.life || 0.5, kind = opt.kind || "spark";
    for (let i = 0; i < n; i++) {
      const a = opt.cone ? opt.dir + rand(-opt.cone, opt.cone) : rand(0, TAU);
      const s = rand(spd * 0.3, spd);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.6, life), r: opt.r || rand(1.5, 3.5), color, kind, grav: opt.grav || 0, drag: opt.drag });
    }
  },
  ring(x, y, color, r0, r1, life) {
    this.spawn({ x, y, vx: 0, vy: 0, life: life || 0.4, r: r0, r1: r1 || 60, color, kind: "ring", drag: 1 });
  },
  smoke(x, y, color, n) {
    for (let i = 0; i < n; i++) this.spawn({ x, y, vx: rand(-20, 20), vy: rand(-40, -10), life: rand(0.5, 1.0), r: rand(4, 9), color: color || "rgba(120,130,150,1)", kind: "smoke", drag: 0.96 });
  },
  update(dt) {
    for (const p of this.pool) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.rot += p.spin * dt;
    }
  },
  draw(c) {
    for (const p of this.pool) {
      if (p.dead) continue;
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = a;
      if (p.kind === "ring") {
        const r = lerp(p.r, p.r1, 1 - a);
        c.strokeStyle = p.color; c.lineWidth = 2 + a * 2;
        c.globalAlpha = a * 0.8;
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
      } else if (p.kind === "smoke") {
        c.fillStyle = p.color; c.globalAlpha = a * 0.35;
        c.beginPath(); c.arc(p.x, p.y, p.r * (1.6 - a), 0, TAU); c.fill();
      } else if (p.kind === "glow") {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, p.color); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
      } else if (p.kind === "shard" || p.kind === "debris") {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color;
        const s = p.r * a;
        c.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
        c.restore();
      } else { // spark
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  },
  clear() { for (const p of this.pool) p.dead = true; },
};
function _blankP() { return { dead: true }; }

/* --------------------------- floating text ----------------------- */
const FloatText = {
  list: [],
  add(x, y, text, color, opt) {
    opt = opt || {};
    this.list.push({ x, y, vx: opt.vx || rand(-12, 12), vy: opt.vy || -46, text, color: color || "#fff", life: opt.life || 0.9, max: opt.life || 0.9, size: opt.size || 14, crit: opt.crit });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt;
      if (f.life <= 0) this.list.splice(i, 1);
    }
  },
  draw(c) {
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const f of this.list) {
      const a = clamp(f.life / f.max, 0, 1);
      const pop = f.crit ? 1 + (1 - a) * 0.5 : 1;
      c.globalAlpha = a;
      c.font = `${f.crit ? "900" : "700"} ${f.size * pop}px ui-monospace, "Consolas", monospace`;
      c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.6)";
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1; c.textBaseline = "alphabetic";
  },
  clear() { this.list.length = 0; },
};

/* ------------------------------ input ---------------------------- */
// Normalized pointer with tap/drag discrimination. Screens read Input.*
const Input = {
  x: 0, y: 0, down: false, justDown: false, justUp: false,
  startX: 0, startY: 0, moved: false, downTime: 0,
  _handlers: { tap: [], dragStart: [], drag: [], dragEnd: [] },
  on(ev, fn) { this._handlers[ev].push(fn); },
  emit(ev, a) { for (const fn of this._handlers[ev]) fn(a); },
  point(e) {
    const r = cv.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    this.x = s.clientX - r.left; this.y = s.clientY - r.top;
  },
  init() {
    cv.addEventListener("pointerdown", e => {
      this.point(e); this.down = true; this.justDown = true; this.moved = false;
      this.startX = this.x; this.startY = this.y; this.downTime = performance.now();
    });
    cv.addEventListener("pointermove", e => {
      this.point(e);
      if (this.down && !this.moved && dist(this.x, this.y, this.startX, this.startY) > 9) {
        this.moved = true; this.emit("dragStart", { x: this.startX, y: this.startY });
      }
      if (this.down && this.moved) this.emit("drag", { x: this.x, y: this.y });
    });
    const up = e => {
      if (e.changedTouches) this.point({ touches: e.changedTouches });
      if (this.down) {
        if (this.moved) this.emit("dragEnd", { x: this.x, y: this.y });
        else this.emit("tap", { x: this.x, y: this.y });
      }
      this.down = false; this.justUp = true;
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", () => { if (this.down && this.moved) this.emit("dragEnd", { x: this.x, y: this.y }); this.down = false; });
  },
  postFrame() { this.justDown = this.justUp = false; },
};

/* --------------------- sci-fi UI drawing helpers ----------------- */
// Notched panel frame for canvas-drawn UI bits.
function notchRect(c, x, y, w, h, notch, fill, stroke) {
  c.beginPath();
  c.moveTo(x + notch, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + h - notch);
  c.lineTo(x + w - notch, y + h);
  c.lineTo(x, y + h);
  c.lineTo(x, y + notch);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
