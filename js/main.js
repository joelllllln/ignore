/* =====================================================================
   HIVE WORLDS — main.js
   Progress + save system, the screen/state machine, resize handling,
   and the master update/render loop that ties every module together.
   ===================================================================== */

/* ---------------------------- progress --------------------------- */
function freshProgress() { return { conquered: {}, maxUnlocked: 0, cores: 0, tech: {} }; }
let progress = freshProgress();
const SAVE_KEY = "hiveworlds.v3";
function loadProgress() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) progress = Object.assign(freshProgress(), s); } catch (e) {}
  progress.conquered = progress.conquered || {};
  progress.tech = progress.tech || {};
}
function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) {} }
function isUnlocked(gi) { return gi <= progress.maxUnlocked; }
function conqueredCount() { return Object.keys(progress.conquered).filter(k => progress.conquered[k]).length; }

/* -------------------------- state machine ------------------------ */
let state = "menu", prevState = "menu";
const SCREENS = ["menu", "howto", "settings", "tech", "pause", "clear"];
function setState(s) {
  prevState = state; state = s;
  for (const id of SCREENS) document.getElementById(id).classList.toggle("visible", id === s);
  document.getElementById("map-ui").classList.toggle("visible", s === "map");
  document.getElementById("battle-ui").classList.toggle("visible", s === "battle");
  if (s === "menu") {
    setText("menu-progress", conqueredCount() + " / " + PLANETS.length + " conquered");
    setText("menu-cores", "◆ " + (progress.cores || 0) + " Cores");
  }
  if (s === "battle") { UI.buildPalette(); UI.syncBattle(Battle.s); }
}

/* ---------------------------- resize ----------------------------- */
function onResize() {
  if (Battle.s && (state === "battle" || state === "pause" || state === "clear")) {
    Battle.computeGrid();
    Battle.s.coreX = VIEW.w / 2; Battle.s.coreY = VIEW.h - 74;
    for (const t of Battle.s.towers) { const p = Battle.cellCenter(t.cc, t.rr); t.x = p.x; t.y = p.y; }
  }
}

/* ---------------------------- main loop -------------------------- */
let lastT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;

  // --- update ---
  Tween.update(dt);
  Camera.update(dt);
  Audio2.music(dt);
  if (state === "battle") Battle.update(dt);
  else if (state === "map") MapScreen.update(dt);
  Particles.update(dt);
  FloatText.update(dt);

  // --- render ---
  if (Battle.s && (state === "battle" || state === "pause" || state === "clear")) Battle.render();
  else if (state === "map") MapScreen.render();
  else { Sky.draw(ctx, ["#13324a", "#0a1830"], 0, 0); drawMenuFlair(); }

  Camera.renderOverlays();
  postFX(ctx);

  Input.postFrame();
  requestAnimationFrame(loop);
}

// subtle drifting motes behind the menus
function drawMenuFlair() {
  const t = Sky.t;
  for (let i = 0; i < 5; i++) {
    const x = (VIEW.w * 0.5) + Math.cos(t * 0.3 + i * 1.3) * VIEW.w * 0.3;
    const y = (VIEW.h * 0.45) + Math.sin(t * 0.25 + i * 1.7) * VIEW.h * 0.25;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 60);
    g.addColorStop(0, hexA(i % 2 ? PAL.sentinel : PAL.sentinel2, 0.10));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 60, 0, TAU); ctx.fill();
  }
}

/* ------------------------------ boot ----------------------------- */
function boot() {
  loadProgress();
  resizeCanvas();
  Input.init();
  Battle.init();
  UI.init();
  // map taps
  Input.on("tap", p => { if (state === "map") MapScreen.tap(p.x, p.y); });
  // unlock audio on first interaction
  const unlock = () => { Audio2.unlock(); Audio2.setMusic($("set-music") ? $("set-music").checked : true); window.removeEventListener("pointerdown", unlock); };
  window.addEventListener("pointerdown", unlock);

  setState("menu");
  requestAnimationFrame(loop);
}
boot();
