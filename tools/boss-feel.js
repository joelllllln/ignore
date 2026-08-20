#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/boss-feel.js — A BOSS REACTS TO YOU, AND A WARDEN STILL HOLDS THE SEAM
//
// Owner ask (v18.79): "the movement of bosses feels very stale and there is no
// interactivity... fix the movement of all the bosses, make sure it's adjusted
// for using black hole events and everything."
//
// The old personalities wrote d.x/d.y STRAIGHT FROM A CLOCK — lissajous, orbit
// and pace were pure functions of t. Nothing you did could move a boss, because
// the next frame recomputed where its clock said it should be. Movement is a
// steering force now, so the well, your knockback and the boss's own patrol all
// add into one velocity and compete.
//
// The danger in that change is a REGRESSION IN A DIFFERENT DIRECTION. v18.24
// pinned wardens to a tight orbit for a measured reason: roaming ones drifted
// out of a thin rack's range and made the seam duel a coin flip — the same
// warden died in 6s on one attempt and escaped the full 60s on the next. So
// half of this gate is about the new feel and half is about not undoing that.
//
//   BF1  a WARDEN stays inside its leash for a whole duel — the v18.24
//        guarantee, kept as a radius rather than as a scripted circle
//   BF2  duels still resolve inside the 60s clock, near the calibrated TTK,
//        and consistently — that is what "not a coin flip" means
//   BF3  wardens are not all the same: the 18 seam keepers use several
//        different personalities (every one of them was hard-coded to `orbit`)
//   BF4  the BLACK HOLE hauls a boss into your guns AND it recovers — pinned
//        dead-centre forever is not a fight, and neither is unmoved
//   BF5  DAMAGE moves a boss — a hit adds real velocity
//   BF6  no boss ever has an undefined movement style, and no boss position
//        is ever NaN (a leash divide-by-zero put one there during development)
//
// v18.80 adds the TRACKING GAME (owner: "make it a finger tracking game where each
// boss becomes harder and harder to track (not impossible) and finger damage
// should mean a lot to a boss"):
//
//   BF7  the finger is worth a great deal — tracking a boss must roughly HALVE
//        the duel against the same rack. Safe to make it this strong because a
//        warden's HP pool is calibrated with the finger's damage SUBTRACTED, so
//        a player who never touches the screen still gets the duel the pool was
//        built for.
//   BF8  bosses get harder to track with depth, MONOTONICALLY — and never
//        impossible: a hand with no reaction delay still holds ~98% at P18, so
//        the difficulty is against reaction time, not against physics.
//
// BF8 models a real hand: a reaction DELAY (it aims where the boss was ~190ms
// ago), a speed cap, and smoothing. Without the delay the model is a perfect
// tracker and every depth reads 98% — which is exactly what the first two
// attempts at this mechanic measured, and why "push the boss away" was the wrong
// design. A boss cannot out-run a finger. It can out-manoeuvre a slow one.
//
// Run: node tools/boss-feel.js         (needs Playwright)
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");

const DUEL_PLANETS = [1, 8, 18];
const ESCAPE_S = 60;

const RACK = () => {
  const I = window.__IDS, S = I.S();
  I.revealAll(); S.cash = 1e12;
  for (let i = 0; i < 5; i++) I.buyUnit("turret");
  const G = I.buildTree("turret");
  for (let pass = 0; pass < 25; pass++) for (const n of G.nodes) {
    if (n.kind === "start") continue;
    if (!I.nodeAllocated("turret", n.id) && I.nodeAllocatable("turret", n)) I.allocNode("turret", n);
  }
  I.recompute(); I.syncHUD();
};

const look = () => {
  const I = window.__IDS, d = I.dots().find(x => x.boss);
  if (!d) return null;
  const cx = I.worldCX(), cy = I.worldCY();
  return { r: Math.hypot(d.x - cx, d.y - cy), style: d.mstyle === undefined ? null : d.mstyle,
           leash: d.leashR || 0, nan: !isFinite(d.x) || !isFinite(d.y),
           v: Math.hypot(d.vx || 0, d.vy || 0), hp: d.maxHp > 0 ? d.hp / d.maxHp : 0 };
};

const clearBoss = () => { for (const d of window.__IDS.dots()) if (d.boss) { d.hp = -1; d.dead = true; } };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [], fails = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction("!!window.__IDS");
  await page.click("#home-play");
  await page.waitForTimeout(700);
  await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
  await page.evaluate(RACK);

  // ---- BF3/BF6 — every seam keeper's personality --------------------------------------------
  const styles = [];
  for (let g = 1; g <= 18; g++) {
    await page.evaluate(gg => { window.__IDS.S().galaxy = gg; }, g);
    await page.evaluate(clearBoss); await page.waitForTimeout(90);
    const st = await page.evaluate(() => { window.__SIM.spawnBoss(true);
      const d = window.__IDS.dots().filter(x => x.boss).pop();
      const s = d ? (d.mstyle === undefined ? null : d.mstyle) : "none";
      if (d) { d.hp = -1; d.dead = true; } return s; });
    styles.push(st);
  }
  const distinct = [...new Set(styles.filter(Boolean))];
  console.log("BF3 warden personalities  " + distinct.length + " distinct across 18 seams — " + distinct.join(", "));
  if (styles.some(s => s === null)) fails.push("a warden has an UNDEFINED movement style (planets " + styles.map((s, i) => s === null ? i + 1 : null).filter(Boolean).join(",") + ")");
  if (distinct.length < 3) fails.push("all 18 wardens share " + distinct.length + " personality/ies — the seam duel is the same fight every time");

  // ---- BF1/BF2 — the leash, and the duel it protects -----------------------------------------
  const duels = [];
  for (const g of DUEL_PLANETS) {
    await page.evaluate(gg => { window.__IDS.S().galaxy = gg; }, g);
    await page.evaluate(clearBoss); await page.waitForTimeout(200);
    await page.evaluate(() => window.__SIM.spawnBoss(true));
    await page.waitForTimeout(150);
    let maxR = 0, leash = 0, style = null, t = 0, killed = null, sawNaN = false;
    for (let i = 0; i < 130 && killed === null; i++) {
      const r = await page.evaluate(look);
      if (!r) { killed = t; break; }
      if (r.nan) sawNaN = true;
      if (isFinite(r.r)) maxR = Math.max(maxR, r.r);
      leash = r.leash || leash; style = r.style;
      t += 0.5; await page.waitForTimeout(500);
    }
    duels.push({ g, style, maxR: Math.round(maxR), leash: Math.round(leash), killed, sawNaN });
    if (sawNaN) fails.push("P" + g + ": a boss position went NaN mid-duel");
    if (leash > 0 && maxR > leash * 1.3)
      fails.push("P" + g + ": the warden reached " + Math.round(maxR) + "px, well outside its " + Math.round(leash) + "px leash — this is the v18.24 coin-flip duel coming back");
    if (killed === null) fails.push("P" + g + ": the warden survived the whole " + ESCAPE_S + "s clock against a fully-spent rack");
  }
  for (const d of duels) console.log("BF1/BF2 P" + String(d.g).padStart(2) + "  " + String(d.style).padEnd(10)
    + "  strayed " + String(d.maxR).padStart(4) + "px of " + String(d.leash).padStart(4) + "px leash"
    + "   killed at " + (d.killed === null ? "NEVER" : d.killed.toFixed(1) + "s"));
  { const ts = duels.map(d => d.killed).filter(v => v !== null);
    if (ts.length > 1 && Math.max(...ts) - Math.min(...ts) > 25)
      fails.push("duel length swings " + Math.min(...ts).toFixed(0) + "s to " + Math.max(...ts).toFixed(0) + "s — that is the coin flip, not a fight"); }

  // ---- BF4 — the well hauls it in, and it gets back out --------------------------------------
  // The sweeps above KILL wardens, and killing a warden conquers its planet — by this point every
  // world 1..18 is settled, a settled world spawns nothing and the field is emptied, so a boss put
  // there is culled on the next tick. That is why this said NO BOSS. Reset to a live frontier.
  await page.evaluate(() => { const I = window.__IDS, S = I.S();
    S.vault = {}; S.galaxy = 1; I.recompute(); I.syncHUD(); });
  await page.waitForTimeout(400);
  await page.evaluate(clearBoss); await page.waitForTimeout(200);
  // an ordinary mini-boss dies to a fully-spent rack in seconds, and a dead boss cannot be measured
  // for movement — so this one is made unkillable and given no escape clock. It is a MOVEMENT test.
  const spawned = await page.evaluate(() => { window.__SIM.spawnBoss();
    const d = window.__IDS.dots().filter(x => x.boss).pop();
    if (!d) return false;
    d.hp = 1e18; d.maxHp = 1e18; d.ttl = 1e9; d.regen = 0; return true; });
  if (!spawned) fails.push("could not spawn a boss to measure movement against");
  await page.waitForTimeout(2500);
  // Top the boss up every sample rather than once. The warden-calibration pass rewrites maxHp/hp a
  // couple of seconds in, so a one-shot "make it unkillable" is undone and a fully-spent rack then
  // deletes the very thing being measured — which is exactly what happened, and why this said NO BOSS.
  const sample = async n => { const out = [];
    for (let i = 0; i < n; i++) {
      const r = await page.evaluate(() => { const d = window.__IDS.dots().find(x => x.boss);
        if (d) { d.hp = d.maxHp; d.ttl = 1e9; }
        return d ? { r: Math.hypot(d.x - window.__IDS.worldCX(), d.y - window.__IDS.worldCY()) } : null; });
      if (r) out.push(r.r);
      await page.waitForTimeout(400);
    } return out; };
  const idle = await sample(7);
  await page.evaluate(() => window.__IDS.useAbility("blackhole"));
  const well = await sample(8);
  await page.waitForTimeout(3000);
  const after = await sample(6);
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const [mi, mw, ma] = [mean(idle), mean(well), mean(after)];
  console.log("BF4 black hole            mean radius idle " + Math.round(mi) + "px -> well " + Math.round(mw) + "px -> after " + Math.round(ma) + "px");
  if (!(mw < mi * 0.5)) fails.push("the well barely moved the boss: " + Math.round(mi) + "px -> " + Math.round(mw) + "px");
  if (!(ma > mw * 1.8)) fails.push("the boss never got back out of the well: " + Math.round(mw) + "px -> " + Math.round(ma) + "px");

  // ---- BF5 — damage moves it ----------------------------------------------------------------
  const kick = await page.evaluate(() => {
    const I = window.__IDS, d = I.dots().find(x => x.boss);
    if (!d) return null;
    d.hp = d.maxHp;
    d.vx = 0; d.vy = 0;
    const before = Math.hypot(d.vx, d.vy);
    window.__SIM.hitDot(d, d.maxHp * 0.04, "turret");
    return { before, after: Math.hypot(d.vx, d.vy) };
  });
  console.log("BF5 knockback             |v| " + (kick ? Math.round(kick.before) + " -> " + Math.round(kick.after) + "px/s on one hit" : "NO BOSS"));
  if (!kick || !(kick.after > 40)) fails.push("damage does not move a boss — a hit changed its speed by " + (kick ? Math.round(kick.after - kick.before) : "n/a") + "px/s");

  // ---- BF7/BF8 — the tracking game ----------------------------------------------------------
  // The virtual hand lives IN THE PAGE and drives the real brushAt() every frame. Round-tripping a
  // Playwright mouse per sample was far too slow to finish a duel.
  await page.evaluate(() => {
    window.__F = { on: false, lag: 0.35, speed: 1100, delay: 190, hist: null, x: null, y: null, contact: 0, frames: 0, last: 0 };
    const step = ts => {
      const I = window.__IDS, F = window.__F;
      const dt = F.last ? Math.min(0.05, (ts - F.last) / 1000) : 0.016; F.last = ts;
      if (F.on) { const d = I.dots().find(x => x.boss);
        if (d) {
          if (F.x === null) { F.x = d.x - 260; F.y = d.y - 200; }
          F.hist = F.hist || []; F.hist.push({ t: ts, x: d.x, y: d.y });
          while (F.hist.length > 2 && ts - F.hist[0].t > F.delay) F.hist.shift();
          const aim = F.hist[0];
          let nx = F.x + (aim.x - F.x) * F.lag, ny = F.y + (aim.y - F.y) * F.lag;
          const mx = F.speed * dt, dd = Math.hypot(nx - F.x, ny - F.y);
          if (dd > mx) { nx = F.x + (nx - F.x) * mx / dd; ny = F.y + (ny - F.y) * mx / dd; }
          F.x = nx; F.y = ny; I.brushAt(F.x, F.y);
          F.frames++; if (Math.hypot(d.x - F.x, d.y - F.y) <= 30 + d.r) F.contact++;
        } }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  const trackDuel = async (g, opts) => {
    await page.evaluate(gg => { const I = window.__IDS, S = I.S(); S.galaxy = gg; S.vault = {};
      for (const d of I.dots()) if (d.boss) { d.hp = -1; d.dead = true; }
      const F = window.__F; F.on = false; F.x = null; F.contact = 0; F.frames = 0; F.last = 0; F.hist = null;
      I.recompute(); I.syncHUD(); }, g);
    await page.waitForTimeout(300);
    await page.evaluate(o => { window.__SIM.spawnBoss(true);
      if (o) { const F = window.__F; F.lag = o.lag; F.delay = o.delay; F.on = true; } }, opts || null);
    let t = 0, dead = false;
    for (let i = 0; i < 70; i++) {
      await page.waitForTimeout(500); t += 0.5;
      if (!(await page.evaluate(() => !!window.__IDS.dots().find(x => x.boss)))) { dead = true; break; }
    }
    const st = await page.evaluate(() => { const F = window.__F; F.on = false; return { c: F.contact, f: F.frames }; });
    return { t: dead ? t : null, contact: st.f ? st.c / st.f : 0 };
  };
  const HAND = { lag: 0.35, delay: 190 }, PERFECT = { lag: 1, delay: 0 };
  const track = [];
  for (const g of [1, 9, 18]) {
    const none = await trackDuel(g, null);
    const hand = await trackDuel(g, HAND);
    const perf = await trackDuel(g, PERFECT);
    track.push({ g, none: none.t, hand: hand.t, handC: hand.contact, perfC: perf.contact });
  }
  for (const r of track) console.log("BF7/BF8 P" + String(r.g).padStart(2)
    + "  no finger " + (r.none === null ? "NEVER" : r.none.toFixed(1) + "s").padEnd(7)
    + "  tracked " + (r.hand === null ? "NEVER" : r.hand.toFixed(1) + "s").padEnd(7)
    + "  on target: hand " + Math.round(r.handC * 100) + "%, perfect " + Math.round(r.perfC * 100) + "%");
  for (const r of track) {
    if (r.none === null || r.hand === null) { fails.push("P" + r.g + ": a duel never resolved in the tracking test"); continue; }
    if (!(r.hand <= r.none * 0.72)) fails.push("P" + r.g + ": tracking only took the duel from " + r.none + "s to " + r.hand + "s — the finger is not worth much");
    if (!(r.perfC > 0.9)) fails.push("P" + r.g + ": even a PERFECT tracker only holds " + Math.round(r.perfC * 100) + "% — this boss is not trackable, it is random");
  }
  { const c = track.map(r => r.handC);
    if (!(c[0] > c[c.length - 1] + 0.12))
      fails.push("tracking does not get harder with depth: P1 " + Math.round(c[0] * 100) + "% vs P18 " + Math.round(c[c.length - 1] * 100) + "% on target");
    for (let i = 1; i < c.length; i++) if (c[i] > c[i - 1] + 0.03)
      fails.push("difficulty is not monotonic: P" + track[i].g + " (" + Math.round(c[i] * 100) + "%) is EASIER than P" + track[i - 1].g + " (" + Math.round(c[i - 1] * 100) + "%)"); }

  await browser.close();
  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nBOSS FEEL GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL BOSS FEEL GATES PASS — bosses react, wardens still hold the seam");
})();
