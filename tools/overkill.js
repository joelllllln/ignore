#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/overkill.js — DOES THE ARMY ACTUALLY HAVE TO FIGHT?
//
// Owner report (v18.82): "near max turrets, planet 3, level 50 economy — the turrets are just
// completely carrying, and as soon as it pops in radius it dies pretty much instantly."
//
// That last clause is the whole specification, and it names the right metric. A dot's LIFETIME is
// mostly travel: the field is far wider than a 240px turret, so a dot can live three seconds and
// still spend one millisecond of that under fire. What the player watches is what happens INSIDE the
// envelope, so that is what this measures — off the real running field with the real army, never
// from a DPS formula. See the note on the measurement below for why it is asked in distance.
//
// Measured before the fix, P3 / eco 50 / max army / full trees:
//     army capacity 3,246 kills-per-second against a field asking 28  ->  99.1% idle
//     median penetration 0.00 — dots died ON the rim   full tree = x16,600 (turret), x216,000 (nova)
// and it was not P3: idle ran 97-99% at every depth from P1 to P8.
//
//   O1  a finished tree does not melt dots on the rim — dots are actually INSIDE the guns, in numbers
//       you can see (>= MIN_IN on average), at every depth
//   O2  ...and the army is still winning: not the opposite failure, a field it can no longer clear
//       (<= MAX_IN, and the field never pins at its cap)
//   O3  THE COLD OPEN IS UNTOUCHED, and by construction rather than by tuning: a bare tree must give
//       an armour multiplier of exactly 1, so the opening minutes are bit-identical. They are tuned
//       to the gram and a bare army already needs ~11 seconds a dot.
//   O4  no cliff: no quarter of a tree may be worth more than CLIFF_MAX x of FELT power. The last
//       quarter used to be worth x9.3-x10 because every keystone gates deep and they land together.
//   O5  reported, not gated — see the note at that section.
//   O6  THE MONEY DOES NOT MOVE. Enemy HP is allowed to change precisely because payout keys off
//       hp/avg, where the base cancels. If that ever stops being true this fix silently rewrites the
//       whole economy, so it is checked rather than trusted.
//
// Run: node tools/overkill.js            (needs Playwright)
//      node tools/overkill.js --sweep    the constant search that picked the shipped values
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const SWEEP = process.argv.includes("--sweep");

// PENETRATION, 0..1: 0 = died on the rim of the guns' envelope (the reported defect), 1 = reached a
// muzzle. Dots must get meaningfully inside before dying — and must NOT reach the middle every time,
// which would be the opposite failure.

// ...but the percentile above is noisy, because where a dot happens to die mixes lethality with the
// geometry of overlapping 240px circles. The number that is neither noisy nor ambiguous is the
// AVERAGE POPULATION INSIDE the envelope: it is Little's law applied to the engagement zone
// (in-range population = arrival rate x mean time under fire), it needs no fine sampling because it
// is an average of counts, and it moved monotonically with the knobs in the sweep when nothing else
// did — 0 on the shipped v18.81 build, 3-5 at knee 10, 7-12 at knee 4. Zero is the owner's report
// stated as a measurement: there is never a dot inside the radius to look at.
// Shipped v18.81 measured 0.3-0.8 at every depth from P1 to P10 — that IS the bug, stated as a
// number. v18.82 measures 6.6-29.6. The floor sits at 4: comfortably above the broken build, and
// below the worst measured value so a noisy field cannot flap it. The ceiling catches the opposite
// failure, an army that has stopped clearing.
const MIN_IN = 4, MAX_IN = 320;
const CLIFF_MAX = 5;         // O4 — no quarter of a tree may be worth more than x5 of felt power

// ---- state builder: a given depth, economy and tree fill, max army ----
const setup = ([g, ecoLv, treeFrac]) => {
  const D = window.__IDS, S = D.S(), SIM = window.__SIM;
  D.revealAll();
  S.free = true; S.cash = 1e18; S.galaxy = g; S.peakGalaxy = Math.max(S.peakGalaxy, g);
  S.vault[g] = { conquered: false, earned: 0 };
  for (const k of ["capacity", "value", "spawnRate", "luck"]) S.lv[k] = ecoLv;
  S.units.length = 0; S.collectors.length = 0; D.recompute();
  for (const t of SIM.DEF_ORDER) { const B = SIM.DEF_TYPES[t]; if (B.gal > g) continue;
    for (let i = 0; i < 40 && S.units.filter(u => u.type === t).length < B.max; i++) D.buyUnit(t); }
  for (const t of Object.keys(SIM.COL_TYPES)) { const B = SIM.COL_TYPES[t]; if (B.gal > g) continue;
    for (let i = 0; i < 40 && S.collectors.filter(u => u.type === t).length < B.max; i++) D.buyUnit(t); }
  for (const t of SIM.DEF_ORDER) {
    S.classNodes[t] = {}; if (SIM.DEF_TYPES[t].gal > g) continue;
    const G = D.buildTree(t), ids = Object.keys(G.map).filter(i => i !== "start");
    const target = Math.round(ids.length * treeFrac);
    let guard = 0;
    while (guard++ < 9000 && Object.keys(S.classNodes[t]).length < target) {
      let best = null, bc = Infinity;
      for (const id of ids) { if (S.classNodes[t][id]) continue; if (!D.nodeAllocatable(t, G.map[id])) continue;
        const c = D.nodeCost(t, G.map[id]); if (c < bc) { bc = c; best = id; } }
      if (!best) break; S.classNodes[t][best] = true; }
  }
  S.cash = 1e18; D.recompute(); D.syncHUD();
  return { units: S.units.length };
};

// ---- the measurement: HOW FAR INTO THE GUNS DOES A DOT GET? ----
// The first version of this timed how long a dot survived in range, and every cell of the sweep came
// back 16-32ms — the sampler's own floor. That was not a reading, it was the instrument bottoming
// out, and it would have made the knee look inert when the knee was in fact working (measured: the
// turret's dmg x rate product goes 4,834 -> 320 -> 96 across the swept values).
//
// PENETRATION is the same question asked in distance instead of time, and distance does not have a
// floor: a dot moves under a pixel per frame, so wherever it dies, that position is real. For each
// dot we keep the closest it ever got to a gun, as a fraction of that gun's radius. Die on the rim
// and penetration is 0 — which is literally the owner's sentence, "as soon as it pops in radius it
// dies". Reach the muzzle and it is 1.
//
// NB: started as a fire-and-forget that parks its answer on window, NOT as a promise awaited across
// the CDP boundary — a 12-second evaluate promise gets garbage collected mid-run.
const startTIR = ([holdProg, ms]) => { window.__TIR = null; const res = r => { window.__TIR = r; }; {
  const D = window.__IDS, SIM = window.__SIM, S = D.S();
  const target = SIM.conquerTarget(S.galaxy);
  const hold = setInterval(() => SIM.setEarned(target * holdProg), 40);   // pin menace so runs compare
  setTimeout(() => {
    const best = new Map(), seenAll = new Set(); const done = []; let inSum = 0, fSum = 0, n = 0, peak = 0, deaths = 0;
    let blew = null; const t0 = performance.now();
    const iv = setInterval(() => {
      try {
        const units = S.units.map((u, i) => { const p = D.unitPos(i, S.units.length);
          return { x: p.x, y: p.y, r: SIM.DEF_TYPES[u.type].range + ((D.derived().cls || {})[u.type] || { range: 0 }).range }; });
        const live = new Set(); let inR = 0;
        for (const d of D.dots()) {
          if (d.boss) continue;
          live.add(d);
          let deep = 0;                                    // deepest penetration across all guns, 0..1
          for (const u of units) { const dl = Math.hypot(d.x - u.x, d.y - u.y);
            if (dl <= u.r) deep = Math.max(deep, 1 - dl / u.r); }
          if (deep > 0) { inR++; best.set(d, Math.max(best.get(d) || 0, deep)); }
        }
        for (const [d, p] of best) if (!live.has(d)) { done.push(p); best.delete(d); }
        for (const d of seenAll) if (!live.has(d)) { deaths++; seenAll.delete(d); }
        for (const d of live) seenAll.add(d);
        const f = D.dots().length; peak = Math.max(peak, f); fSum += f; inSum += inR; n++;
      } catch (e) { blew = e.message; clearInterval(iv); }
    }, 16);
    setTimeout(() => { clearInterval(iv); clearInterval(hold);
      done.sort((a, b) => a - b);
      const q = p => done.length ? done[Math.min(done.length - 1, Math.floor(p * done.length))] : 0;
      res({ n: done.length, p50: q(0.5), p90: q(0.9), kps: deaths / (ms / 1000),
            field: n ? fSum / n : 0, inRange: n ? inSum / n : 0, peak, cap: D.galCap(S.galaxy), blew });
    }, ms);
  }, 2500);
} };

// ---- O6's sampler: every dot's ROLL, its HP and what it paid ----
// spawnMenace is pinned with a defineProperty trap rather than by writing it on a timer: the spawn
// loop rewrites it from live field fullness every frame, so a timer loses the race. This is the one
// term that rides field fullness and is deliberately NOT in `avg`, so leaving it free means tougher
// dots (fuller field, thinner spawn) change payout for a reason that has nothing to do with `base`.
const startPay = ms => { window.__PAY = null;
  const D = window.__IDS, SIM = window.__SIM, S = D.S(), tgt = SIM.conquerTarget(S.galaxy), der = D.derived();
  const had = Object.getOwnPropertyDescriptor(der, "spawnMenace");
  Object.defineProperty(der, "spawnMenace", { configurable: true, get: () => 1, set: () => {} });
  const hold = setInterval(() => SIM.setEarned(tgt * 0.25), 16);
  const rows = [], seen = new WeakSet();
  // The field carries over between runs, so every dot already standing there was rolled under the
  // PREVIOUS configuration. Tag them all as seen — without this the sample is dominated by stale
  // dots and reads backwards (measured: dot HP going DOWN under x106 armour).
  for (const d of D.dots()) seen.add(d);
  const iv = setInterval(() => { for (const d of D.dots()) {
    if (d.boss || seen.has(d)) continue; seen.add(d);
    rows.push({ roll: d.menace, hp: d.maxHp, val: d.value0 != null ? d.value0 : (d.value || 0) }); } }, 25);
  setTimeout(() => { clearInterval(iv); clearInterval(hold);
    Object.defineProperty(der, "spawnMenace", had || { value: 1, writable: true, configurable: true });
    window.__PAY = { rows, n: rows.length }; }, ms);
};
const payout = async (page, ms) => { await page.evaluate(startPay, ms);
  await page.waitForFunction("window.__PAY !== null", null, { timeout: ms + 40000 });
  return page.evaluate(() => window.__PAY); };

// ---- income, for O6 — same park-on-window shape, same reason ----
const startInc = ms => { window.__INC = null; const D = window.__IDS, a = D.curEarned(), t0 = performance.now();
  setTimeout(() => { window.__INC = (D.curEarned() - a) / ((performance.now() - t0) / 1000); }, ms); };

// node-side helpers that drive the two above and wait for the parked answer
const tir = async (page, holdProg, ms) => { await page.evaluate(startTIR, [holdProg, ms]);
  await page.waitForFunction("window.__TIR !== null", null, { timeout: ms + 40000 });
  return page.evaluate(() => window.__TIR); };
const inc = async (page, ms) => { await page.evaluate(startInc, ms);
  await page.waitForFunction("window.__INC !== null", null, { timeout: ms + 40000 });
  return page.evaluate(() => window.__INC); };

// ---- the tree's own shape, with the knobs live ----
const treeShape = ([g]) => {
  const D = window.__IDS, S = D.S(), SIM = window.__SIM;
  D.revealAll(); S.free = true; S.cash = 1e18; S.galaxy = g; S.peakGalaxy = 18;
  const out = {};
  for (const t of SIM.DEF_ORDER) {
    const pts = [];
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      S.classNodes[t] = {};
      const G = D.buildTree(t), ids = Object.keys(G.map).filter(i => i !== "start");
      const want = Math.round(ids.length * frac);
      let guard = 0;
      while (guard++ < 9000 && Object.keys(S.classNodes[t]).length < want) {
        let best = null, bc = Infinity;
        for (const id of ids) { if (S.classNodes[t][id]) continue; if (!D.nodeAllocatable(t, G.map[id])) continue;
          const c = D.nodeCost(t, G.map[id]); if (c < bc) { bc = c; best = id; } }
        if (!best) break; S.classNodes[t][best] = true; }
      D.recompute();
      const cs = D.classStats(t), crit = Math.min(0.85, cs.crit), cm = 2.2 + Math.max(0, cs.crit - 0.85) * 0.8;
      pts.push(cs.dmg * cs.rate * (1 + crit * (cm - 1)));
    }
    out[t] = pts;
  }
  return out;
};

const hpCurve = () => { const SIM = window.__SIM, o = [];
  for (const g of [1, 2, 3, 4, 5, 6, 8, 10, 14, 18]) o.push([g, SIM.enemyHpMul(g)]); return o; };

const boot = async page => {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction("!!window.__IDS");
  await page.click("#home-play"); await page.waitForTimeout(600);
  await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await boot(page);
  const fails = [];

  // ================= the sweep that picked the constants =================
  if (SWEEP) {
    console.log("\n=== SWEEP: dots inside the guns, across DEPTH — eco 50 / max army / FULL tree ===");
    console.log("  MENACE_TREE  planet   armour x   in range   field / cap   kills/s   net gain");
    for (const mt of [0, 0.55, 0.62, 0.68]) {
      for (const g of [1, 3, 6, 10]) {
        await page.evaluate(v => window.__SIM.setMenaceTree(v), mt);
        await page.evaluate(setup, [g, 50, 1]);
        const kn = await page.evaluate(() => window.__SIM.balKnobs());
        const r = await tir(page, 0.25, 11000);
        console.log("   " + mt.toFixed(2).padStart(9) + "   P" + String(g).padEnd(4)
          + "  " + kn.armor.toFixed(0).padStart(9) + "   " + r.inRange.toFixed(1).padStart(8)
          + "  " + (r.field.toFixed(0) + " / " + r.cap).padStart(11)
          + "   " + r.kps.toFixed(1).padStart(7) + "   x" + (kn.power / kn.armor).toFixed(0).padStart(6) + "   n=" + r.n);
      }
      console.log("");
    }
    await browser.close(); return;
  }

  // ================= O1/O2 — the band, at every depth, finished tree =================
  console.log("\n=== O1/O2 — a finished tree still has to fight ===");
  console.log("  planet   armour x   dots IN RANGE   field / cap   kills/s    verdict");
  for (const g of [1, 3, 6, 10]) {
    await page.evaluate(setup, [g, 50, 1]);
    const kn = await page.evaluate(() => window.__SIM.balKnobs());
    const r = await tir(page, 0.25, 11000);
    const bad = r.inRange < MIN_IN ? "DIES ON THE RIM" : r.inRange > MAX_IN ? "ARMY IS DROWNING" : "fights";
    console.log("    P" + String(g).padEnd(3) + "   " + kn.armor.toFixed(0).padStart(8)
      + "   " + r.inRange.toFixed(1).padStart(13) + "   " + (r.field.toFixed(0) + " / " + r.cap).padStart(11)
      + "   " + r.kps.toFixed(1).padStart(7) + "    " + bad + "   (n=" + r.n + ")");
    if (r.n < 8) fails.push("P" + g + ": only " + r.n + " dots completed a pass through range — nothing measured");
    else {
      if (r.inRange < MIN_IN) fails.push("P" + g + " / O1: only " + r.inRange.toFixed(1) + " dots are ever inside the guns — they melt on the rim");
      if (r.inRange > MAX_IN) fails.push("P" + g + " / O2: " + r.inRange.toFixed(0) + " dots sit inside the guns — the army cannot clear them");
      if (r.peak >= r.cap) fails.push("P" + g + " / O2: the field pinned at its " + r.cap + "-dot cap — the army is being overrun");
    }
  }

  // ================= O3 — the cold open is untouched BY CONSTRUCTION =================
  // This is the claim the whole design rests on, so it is checked rather than asserted in a comment:
  // a bare tree must produce an armour multiplier of exactly 1, which makes the opening minutes
  // bit-identical to the pre-v18.82 build. Then a quarter-tree army must still comfortably clear.
  console.log("\n=== O3 — the cold open ===");
  for (const [frac, lbl] of [[0, "bare tree"], [0.25, "quarter tree"]]) {
    await page.evaluate(setup, [1, 2, frac]);
    const kn = await page.evaluate(() => window.__SIM.balKnobs());
    const r = await tir(page, 0.05, 9000);
    console.log("    P1 " + lbl.padEnd(14) + "armour x" + kn.armor.toFixed(2).padStart(7)
      + "   power x" + kn.power.toFixed(1).padStart(8) + "   field " + r.field.toFixed(0) + " / " + r.cap
      + "   kills/s " + r.kps.toFixed(1));
    if (frac === 0 && Math.abs(kn.armor - 1) > 1e-9)
      fails.push("O3: a BARE tree already multiplies enemy armour x" + kn.armor.toFixed(3) + " — the cold open is not bit-identical any more");
    if (r.peak >= r.cap) fails.push("O3: a " + lbl + " army is overrun at P1 — the opening is no longer winnable");
  }

  // ================= O4 — the keystone cliff must damp itself =================
  // Raw tree power per quarter, and what the player actually FEELS once armour rides it. The last
  // quarter used to be worth x9.3-x10 raw because every keystone gates deep and they land together.
  const shape = await page.evaluate(treeShape, [3]);
  const k = await page.evaluate(() => window.__SIM.balKnobs());
  console.log("\n=== O4 — no quarter of a tree is a cliff (what the player FEELS per quarter) ===");
  console.log("  class      Q1*     Q2      Q3      Q4     full tree: raw -> felt      (*Q1 reported, not gated)");
  for (const t in shape) {
    const p = shape[t];
    const felt = p.map(v => v / Math.pow(Math.max(1, v), k.menaceTree));   // armour rides the same quantity
    const qs = [felt[1] / felt[0], felt[2] / felt[1], felt[3] / felt[2], felt[4] / felt[3]];
    console.log("    " + t.padEnd(9) + qs.map(x => ("x" + x.toFixed(1)).padStart(6)).join("  ")
      + "   " + p[4].toExponential(2) + " -> x" + felt[4].toFixed(0));
    // Q1 is REPORTED, not gated. Going from a bare tree to a quarter tree is the biggest relative
    // jump there is and always should be — that is the cold open paying off, and it was x85 raw
    // before v18.82 against x7.4 felt now. The defect this gate exists for is the LATE cliff: the
    // finished tree that breaks the game in its last stretch because every keystone gates deep and
    // they all land together. So Q2 onward is what must stay under CLIFF_MAX.
    const worst = Math.max(qs[1], qs[2], qs[3]);
    if (worst > CLIFF_MAX) fails.push(t + " / O4: a late quarter of the tree is worth x" + worst.toFixed(1) + " on its own — that is a cliff, not a curve");
    if (felt[4] < 5) fails.push(t + " / O4: a whole tree is only worth x" + felt[4].toFixed(1) + " — the reward has been flattened out of existence");
  }

  // ================= O5 — REPORTED, NOT GATED =================
  // The sweep turned this up and it is real, but it is NOT what v18.82 fixes and it is not safe to
  // change here: enemyHpMul's exponent also drives ERA (a class's base damage and its node prices at
  // depth), so raising it re-prices every deep tree and needs its own pass with the ladder sims.
  // Printed so the number stays in front of whoever picks it up, never asserted.
  const hp = await page.evaluate(hpCurve);
  console.log("\n=== O5 (report only) — what one planet further out buys, HP_POW=" + k.hpPow + " ===");
  console.log("  planet : " + hp.map(v => ("P" + v[0]).padStart(8)).join(""));
  console.log("  x HP   : " + hp.map(v => v[1].toFixed(2).padStart(8)).join(""));
  console.log("  NOTE: P1->P4 is x" + (hp[3][1] / hp[0][1]).toFixed(2) + " across THREE planets. Still flat. Not fixed here.");

  // ================= O6 — the money must not have moved =================
  // v18.82 makes dots much tougher, and it is only allowed to do that because payout keys off hp/avg
  // where `base` cancels exactly. Getting a trustworthy reading took five tries and every failure is
  // worth recording, because each one looked like a finding rather than an instrument fault:
  //   1. integrating live income -> x16 / x0.27 / x0.13, drifts disagreeing in DIRECTION. curEarned
  //      is never reset between runs and menace rides the conquer bar.
  //   2. mean payout per dot     -> the field carries over, so the sample was dominated by stale dots
  //      rolled under the previous config; it read dot HP going DOWN under x106 armour.
  //   3. mean payout, fresh dots -> still x4.24 at P5. Payout rides (hp/avg)^1.45 over a distribution
  //      whose tail is armored dots at ~x200; a sample mean is simply not an estimator here.
  //   4. median payout per dot   -> pinned flat on the Math.max(1,..) floor, vacuous, while p90 showed
  //      a real x0.08. Chasing that found the mechanism: spawnMenace rides live FIELD FULLNESS and is
  //      deliberately not in `avg`, so tougher dots thin the spawn and drag payout with them.
  //   5. total income, alternated -> two samples of the SAME config came back 7.4e3 and 1.1e2. A live
  //      field cannot resolve a 2x effect at any sample count I am willing to pay for.
  // So this asks the question with the noise removed instead of averaged: spawnMenace hard-pinned, and
  // dots MATCHED BY THEIR OWN ROLL (d.menace, which the game stamps on every dot). Within a roll bin
  // the only thing left that can move payout is `base`, which is exactly the claim.
  console.log("\n=== O6 — the money does not move ===");
  console.log("  planet   dot HP off -> on    payout drift, matched by roll (p25/p50/p75)      verdict");
  for (const g of [3, 6]) {
    const shot = async mt => { await page.evaluate(v => window.__SIM.setMenaceTree(v), mt);
      await page.evaluate(setup, [g, 30, 1]);
      return payout(page, 14000); };
    const A = await shot(0), B = await shot(k.menaceTree);
    // bin both samples by roll on a shared log ladder, then compare median payout inside each bin
    const bin = r => Math.round(Math.log(Math.max(1e-6, r)) * 3);
    const tab = rows => { const m = new Map();
      for (const r of rows) { const b = bin(r.roll); if (!m.has(b)) m.set(b, []); m.get(b).push(r.val); }
      const o = new Map();
      for (const [b, v] of m) if (v.length >= 5) { v.sort((x, y) => x - y); o.set(b, v[v.length >> 1]); }
      return o; };
    const ta = tab(A.rows), tb = tab(B.rows);
    const ratios = [];
    for (const [b, va] of ta) { const vb = tb.get(b); if (vb != null && va > 0) ratios.push(vb / va); }
    ratios.sort((x, y) => x - y);
    const q = p => ratios.length ? ratios[Math.min(ratios.length - 1, Math.floor(p * ratios.length))] : NaN;
    const med = q(0.5);
    const mh = rows => { const h = rows.map(r => r.hp).sort((x, y) => x - y); return h.length ? h[h.length >> 1] : 0; };
    const hpMove = mh(A.rows) > 0 ? mh(B.rows) / mh(A.rows) : NaN;
    console.log("    P" + String(g).padEnd(3) + "   " + (mh(A.rows).toExponential(1) + " -> " + mh(B.rows).toExponential(1)).padStart(17)
      + "     " + [q(0.25), med, q(0.75)].map(v => isFinite(v) ? "x" + v.toFixed(2) : "-").join(" / ").padStart(24)
      + "      " + (isFinite(med) && med >= 0.8 && med <= 1.25 ? "unchanged" : "MOVED")
      + "   (" + ratios.length + " bins, n=" + A.n + "/" + B.n + ")");
    if (ratios.length < 3) fails.push("P" + g + " / O6: only " + ratios.length + " matched roll bins — not enough to say anything");
    else {
      if (!(med >= 0.8 && med <= 1.25)) fails.push("P" + g + " / O6: at a matched roll, arming the dots moved payout x" + med.toFixed(2) + " — `base` is NOT cancelling, the economy has been rewritten");
      if (!(hpMove > 3)) fails.push("P" + g + " / O6: the armour only moved dot HP x" + hpMove.toFixed(1) + " — O6 would be passing vacuously");
    }
  }

  await browser.close();
  console.log("\nknobs: MENACE_TREE=" + k.menaceTree + " HP_POW=" + k.hpPow);
  console.log("page errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nOVERKILL GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL OVERKILL GATES PASS — the army wins, but it has to fight for it");
})();
