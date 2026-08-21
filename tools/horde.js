#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/horde.js — DOES A PLANET ACTUALLY ESCALATE?
//
// Owner (v18.83): "for the amount of time conquering, like 24 hours, you can't actually change the
// spawn rate that much. Like you should start off small then by the end you're killing hordes and
// hordes."
//
// Measured on the shipped v18.82 build, walking one planet's bar end to end at a FIXED economy:
//     bar 2% -> 82 dots · 25% -> 97 · 50% -> 130 · 75% -> 202 · 100% -> 260      a x3.2 arc
// It opens at 82, which is not "small", and ends at 260, which is not "hordes". The cause was a
// single term: fieldMul = 0.35 + 0.65*prog, a x2.9 ramp and the ONLY thing in the game that made a
// field thicker as you conquered — everything else the bar drives goes into per-dot TOUGHNESS, so a
// planet's endgame got tankier instead of more crowded.
//
//   H1  ARRIVAL IS SPARSE. Landing on a fresh world shows a handful of dots, not a crowd.
//   H2  THE ENDGAME IS A HORDE, and one the field cap has not flattened — if the last stretch of the
//       bar is pinned at the cap then the ramp has stopped meaning anything exactly where it matters.
//   H3  the climb is MONOTONIC. Every quarter of the bar is thicker than the one before it, so the
//       escalation is something you watch happen rather than a step at the end.
//   H4  the whole arc is worth at least MIN_ARC x. This is the owner's sentence as a number.
//   H5  THE MONEY DOES NOT MOVE, and this is what licenses the change: frontierPay divides every
//       dot's bounty by this exact fieldMul (see spawnDot), so a thinner stream pays proportionally
//       fatter and $/s is unchanged. The two live in different functions, so this checks the identity
//       rather than trusting it — halve the field and every dot must pay exactly twice as much.
//   H6  the horde is AFFORDABLE — frame time at a full bar stays inside budget.
//       CAVEAT, stated because it would otherwise be over-read: this runs in headless Chromium, whose
//       canvas is rasterised in software. A CPU profile at 264 dots put 41% of frame time in
//       (program) — rasterisation the phone's GPU largely absorbs. So H6's fps is a LOWER BOUND on
//       real hardware, and the gate is set where it catches a regression, not where it models a phone.
//
// Run: node tools/horde.js            (needs Playwright)
//      node tools/horde.js --sweep    the curve search that picked the shipped constants
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const SWEEP = process.argv.includes("--sweep");

const MAX_ARRIVAL = 40;    // H1 — dots on screen just after landing
const MIN_HORDE = 280;     // H2 — dots on screen at a full bar
const MIN_ARC = 8;         // H4 — end/start ratio
const MIN_FPS = 18;        // H6 — headless floor (see the caveat above)

const setup = ([g, ecoLv, treeFrac]) => {
  const D = window.__IDS, S = D.S(), SIM = window.__SIM;
  D.revealAll();
  S.free = true; S.cash = 1e15; S.galaxy = g; S.peakGalaxy = Math.max(S.peakGalaxy, g);
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
    const want = Math.round(ids.length * treeFrac);
    let guard = 0;
    while (guard++ < 9000 && Object.keys(S.classNodes[t]).length < want) {
      let best = null, bc = Infinity;
      for (const id of ids) { if (S.classNodes[t][id]) continue; if (!D.nodeAllocatable(t, G.map[id])) continue;
        const c = D.nodeCost(t, G.map[id]); if (c < bc) { bc = c; best = id; } }
      if (!best) break; S.classNodes[t][best] = true; }
  }
  S.cash = 1e15; D.recompute(); D.syncHUD();
  return { cap: D.galCap(g) };
};

// Hold the bar at a fixed point, let the field find its equilibrium, then report size + frame time
// + what a dot pays. Parked on window rather than awaited: a 20s evaluate promise gets collected.
const startBar = ([prog, ms]) => { window.__H = null;
  const D = window.__IDS, SIM = window.__SIM, S = D.S(), tgt = SIM.conquerTarget(S.galaxy);
  // Clear the field FIRST. Readings run in sequence and the previous one ends at a full bar with
  // hundreds of dots; a sparse curve cannot drain that inside the settle window, so without this the
  // arrival cell reports the tail of the last run — measured 192-388 dots where the shipped build
  // reads 82, i.e. the reading came out backwards.
  D.dots().length = 0;
  const hold = setInterval(() => SIM.setEarned(tgt * prog), 16);
  setTimeout(() => {
    let n = 0, sum = 0, peak = 0, raf = 0, rt = 0, rl = performance.now(), stop = false;
    const vals = [], seen = new WeakSet();
    const rtick = t => { rt += t - rl; rl = t; raf++; if (!stop) requestAnimationFrame(rtick); };
    requestAnimationFrame(rtick);
    const iv = setInterval(() => {
      const f = D.dots(); let live = 0;
      for (const d of f) { if (d.boss) continue; live++;
        if (!seen.has(d)) { seen.add(d); vals.push({ roll: d.menace, val: d.value0 != null ? d.value0 : (d.value || 0) }); } }
      sum += live; n++; peak = Math.max(peak, live);
    }, 32);
    setTimeout(() => { clearInterval(iv); clearInterval(hold); stop = true;
      window.__H = { field: n ? sum / n : 0, peak, ms: raf ? rt / raf : 0, vals, cap: D.galCap(S.galaxy) };
    }, ms);
  }, 11000);
};
const bar = async (page, prog, ms) => { await page.evaluate(startBar, [prog, ms]);
  await page.waitForFunction("window.__H !== null", null, { timeout: ms + 90000 });
  return page.evaluate(() => window.__H); };

// median payout at a matched roll — the same robust estimator tools/overkill.js landed on, and for
// the same reason: payout rides (hp/avg)^1.45, so a sample mean is decided by its armored tail.
const matched = (A, B) => {
  const binOf = r => Math.round(Math.log(Math.max(1e-6, r)) * 3);
  const tab = rows => { const m = new Map();
    for (const r of rows) { const b = binOf(r.roll); if (!m.has(b)) m.set(b, []); m.get(b).push(r.val); }
    const o = new Map();
    for (const [b, v] of m) if (v.length >= 5) { v.sort((x, y) => x - y); o.set(b, v[v.length >> 1]); }
    return o; };
  const ta = tab(A), tb = tab(B), rs = [];
  for (const [b, va] of ta) { const vb = tb.get(b); if (vb != null && va > 0) rs.push(vb / va); }
  rs.sort((x, y) => x - y);
  return { n: rs.length, med: rs.length ? rs[rs.length >> 1] : NaN };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction("!!window.__IDS");
  await page.click("#home-play"); await page.waitForTimeout(600);
  await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
  const fails = [];

  if (SWEEP) {
    console.log("\n=== SWEEP: field size across one planet's bar (P3, eco 30, full tree) ===");
    console.log("  lo/span/curve         2%      25%      50%      75%     100%     arc      fps@full");
    for (const [lo, span, cv] of [[0.35, 0.65, 1.0], [0.08, 1.45, 1.5], [0.06, 1.8, 1.8], [0.05, 2.4, 2.0]]) {
      await page.evaluate(([a, b, c]) => window.__SIM.setFieldCurve(a, b, c), [lo, span, cv]);
      await page.evaluate(setup, [3, 30, 1]);
      const row = []; let last = null;
      for (const p of [0.02, 0.25, 0.5, 0.75, 1.0]) { const r = await bar(page, p, 9000); row.push(r.field); last = r; }
      console.log("   " + (lo + "/" + span + "/" + cv).padEnd(18) + row.map(v => v.toFixed(0).padStart(8)).join("")
        + ("   x" + (row[4] / Math.max(1e-9, row[0])).toFixed(1)).padStart(10)
        + "     " + (last.ms > 0 ? (1000 / last.ms).toFixed(0) : "-"));
    }
    await browser.close(); return;
  }

  // ---------------- H1-H4 + H6: the arc ----------------
  const k = await page.evaluate(() => window.__SIM.fieldKnobs());
  const st = await page.evaluate(setup, [3, 30, 1]);
  console.log("\n=== H1-H4 — one planet, start to finish (P3, eco 30, full tree) ===");
  console.log("  conquer bar    dots on screen    peak / cap     fps");
  const pts = [];
  for (const p of [0.02, 0.25, 0.5, 0.75, 1.0]) {
    const r = await bar(page, p, 10000);
    pts.push(r);
    console.log("    " + (100 * p).toFixed(0).padStart(5) + "%    " + r.field.toFixed(0).padStart(13)
      + "     " + (r.peak + " / " + r.cap).padStart(10) + "    " + (r.ms > 0 ? (1000 / r.ms).toFixed(0) : "-").padStart(4));
  }
  const start = pts[0].field, end = pts[pts.length - 1].field, arc = end / Math.max(1e-9, start);
  console.log("\n  the arc: " + start.toFixed(0) + " dots on arrival  ->  " + end.toFixed(0) + " at a full bar   =  x" + arc.toFixed(1)
    + "   (shipped v18.82 was 82 -> 260, x3.2)");
  if (start > MAX_ARRIVAL) fails.push("H1: landing on a fresh world already shows " + start.toFixed(0) + " dots — that is a crowd, not a start (max " + MAX_ARRIVAL + ")");
  if (end < MIN_HORDE) fails.push("H2: a full bar musters only " + end.toFixed(0) + " dots — not a horde (min " + MIN_HORDE + ")");
  // On the SUSTAINED field, not an instantaneous peak. This asked `peak >= cap` and flapped: the
  // endgame field averages ~417 against a 550 cap but touches it now and then, and one sample on the
  // ceiling is not "the ramp is clamped". What the gate means is that the last stretch of the bar
  // still has somewhere to grow, which is a question about where the field SITS.
  const last = pts[pts.length - 1];
  if (last.field >= last.cap * 0.92)
    fails.push("H2: the endgame field sits at " + last.field.toFixed(0) + " against a " + last.cap
      + "-dot cap — the ramp is clamped exactly where it should pay off");
  for (let i = 1; i < pts.length; i++) if (pts[i].field <= pts[i - 1].field)
    fails.push("H3: the field does not grow from " + (100 * [0.02, 0.25, 0.5, 0.75, 1.0][i - 1]).toFixed(0) + "% to "
      + (100 * [0.02, 0.25, 0.5, 0.75, 1.0][i]).toFixed(0) + "% of the bar (" + pts[i - 1].field.toFixed(0) + " -> " + pts[i].field.toFixed(0) + ")");
  if (arc < MIN_ARC) fails.push("H4: the whole conquest is only a x" + arc.toFixed(1) + " escalation (min x" + MIN_ARC + ")");
  const fps = pts[pts.length - 1].ms > 0 ? 1000 / pts[pts.length - 1].ms : 0;
  if (fps < MIN_FPS) fails.push("H6: a full-bar horde runs at " + fps.toFixed(0) + "fps headless — below the " + MIN_FPS + " floor");

  // ---------------- H5: halve the field, every dot must pay double ----------------
  // fieldMul thins the stream; frontierPay divides each bounty by the same number. They live in
  // different functions, so the identity is measured: set two curves whose fieldMul at a fixed bar
  // differ by a known factor, and the per-dot payout must move by exactly its inverse.
  console.log("\n=== H5 — thinning the stream must fatten every dot by exactly as much ===");
  const at = 0.5;
  const A = [0.08, 1.45, 1.5], B = [0.04, 0.725, 1.5];    // B is exactly half of A at every bar point
  const shot = async c => { await page.evaluate(([a, b, cc]) => window.__SIM.setFieldCurve(a, b, cc), c);
    await page.evaluate(setup, [3, 30, 1]); return bar(page, at, 12000); };
  const ra = await shot(A), rb = await shot(B);
  const fa = await page.evaluate(([a, b, c, p]) => { window.__SIM.setFieldCurve(a, b, c); return window.__SIM.fieldMulFor(3, p); }, [...A, at]);
  const fb = await page.evaluate(([a, b, c, p]) => { window.__SIM.setFieldCurve(a, b, c); return window.__SIM.fieldMulFor(3, p); }, [...B, at]);
  await page.evaluate(([a, b, c]) => window.__SIM.setFieldCurve(a, b, c), [k.lo, k.span, k.curve]);
  const m = matched(ra.vals, rb.vals), want = fa / fb;
  console.log("  fieldMul " + fa.toFixed(3) + " -> " + fb.toFixed(3) + " (x" + (fb / fa).toFixed(2) + " of the stream)");
  console.log("  payout per dot at a matched roll: x" + (isFinite(m.med) ? m.med.toFixed(2) : "-")
    + "   expected x" + want.toFixed(2) + "   (" + m.n + " bins)");
  if (m.n < 3) fails.push("H5: only " + m.n + " matched roll bins — the payout identity was not actually tested");
  else if (!(m.med > want * 0.75 && m.med < want * 1.33))
    fails.push("H5: thinning the stream to x" + (fb / fa).toFixed(2) + " changed per-dot payout x" + m.med.toFixed(2)
      + " instead of x" + want.toFixed(2) + " — the stream and the bounty that compensates it have decoupled, so $/s moves with the curve");

  await browser.close();
  console.log("\ncurve: FIELD_LOW=" + k.lo + " FIELD_SPAN=" + k.span + " FIELD_CURVE=" + k.curve);
  console.log("page errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nHORDE GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL HORDE GATES PASS — a planet starts quiet and ends buried");
})();
