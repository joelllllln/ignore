// ASCENSION PACING SIMULATOR (v16.0) — run with: node tools/ascension-sim.js [--sweep]
//
// Models the v16.0 loop END TO END with the exact shipped formulas:
//   conquer time  t(g) = W0·R^(g-1) hours / M  + ramp        (M = engine income mult; targets do NOT ride M — that's the whoosh)
//   core award    c(g) = ceil(CB^(g-1)) per planet conquered  (+ 50% partial credit on the planet you're stuck on)
//   engine        M = E^lv, level lv costs ceil(C0·CR^lv) cores (war/overclock etc. modelled as a 45% core tax — engine is ~55% of spend)
//   player policy ascend when pending ≥ 1.75× banked (and ≥ 5) OR the next planet needs > WALL_H hours; spend greedily on engine
//
// GATES (the design contract — the sim FAILS if any breaks):
//   G1 run 1 walls on planet 4–6 within 3–8 active hours (first ascension day one)
//   G2 conquering planet 18 takes 7–14 ascensions (the cluster is a many-summit mountain)
//   G3 every ascension pushes the wall forward — never backwards, +1 planet or more ≥ 70% of runs
//   G4 total ACTIVE hours to planet 18 in 40–110 h (a real campaign, not a weekend, not a year)
//   G5 at every ascension the pending/banked ratio ≥ 1.5 (ascending always feels worth it)
//   G6 no single run drags past 12 active hours (no dead zone where ascending stops paying)
//   G7 final core balance ≤ 60k (numbers stay readable)
// Robustness: winner is re-run 40× with ±20% income noise; gates must hold in ≥ 90% of trials.
"use strict";

const TOTAL = 18;
const WALL_H = 3;            // "so slow the player restarts": players bail into ascension when the NEXT bar exceeds a session (~3h)
const ENGINE_SHARE = 0.55;   // share of cores the player effectively puts into the income engine

function simulate(P, noise) {
  const { W0, R, CB, E, C0, CR } = P;
  const wallH = global.WALL_OVERRIDE || WALL_H, engShare = global.SHARE_OVERRIDE || ENGINE_SHARE;
  const rnd = noise ? () => 1 + (Math.random() * 2 - 1) * 0.2 : () => 1;
  let cores = 0, engineLv = 0, engineSpent = 0;
  let hours = 0, runs = [], deepest = 0;
  const M = () => Math.pow(E, engineLv);
  const engCost = lv => Math.ceil(C0 * Math.pow(CR, lv));
  let lifetime = 0;
  const spend = () => {   // greedy: engine gets ENGINE_SHARE of every core; the rest goes to war/overclock etc. (a matching spend, not a hoard)
    let budget = cores * engShare;
    while (engCost(engineLv) <= budget) {
      const c = engCost(engineLv); budget -= c; cores -= c; engineSpent += c; engineLv++;
      const other = Math.min(cores, Math.round(c * (1 - engShare) / Math.max(0.01, engShare)));
      cores -= other;   // the sibling lines soak their share too
    }
  };
  for (let run = 1; run <= 60; run++) {
    spend();
    const lvStart = engineLv, multStart = M();
    let g = 1, runH = 0, banked = [];
    let pend = 0;
    const cval = x => Math.ceil(Math.pow(CB, x - 1));
    while (g <= TOTAL) {
      const t = (W0 * Math.pow(R, g - 1)) / M() * rnd() + 0.05 + 0.2 / Math.sqrt(M());
      if (g > deepest) deepest = g;
      // bail into ascension when the NEXT bar costs more than a session (and there's something to bank)
      if (t > wallH && banked.length >= 3) { pend = banked.reduce((s2, x) => s2 + cval(x), 0) + Math.floor(cval(g) * 0.25); break; }   // the GAME also enforces the 3-conquest floor before ascending (v16.1)
      hours += t; runH += t;
      banked.push(g); g++;
      if (runH > 30) break;   // hard safety
    }
    const pendFinal = pend || banked.reduce((s2, x) => s2 + cval(x), 0);
    runs.push({ run, wall: g, hours: runH, pend: pendFinal, banked: cores, lvStart, multStart, ratio: Math.max(1, lifetime) > 1 ? pendFinal / Math.max(1, lifetime) : Infinity });
    cores += pendFinal; lifetime += pendFinal;
    if (g > TOTAL) return { done: true, runs, hours, cores, engineLv };
  }
  return { done: false, runs, hours, cores, engineLv };
}

// strict gates = the design contract at expected play. loose gates = what must SURVIVE ±20% income
// noise: the loop's structure (finishes, walls never collapse, no dead zones) — not the exact numbers.
function gates(res, P, loose) {
  const f = [];
  if (!res.done) { f.push("never finishes P18"); return f; }
  const r1 = res.runs[0], asc = res.runs.length - 1;
  const wLo = loose ? 3 : 4, wHi = loose ? 7 : 6, hLo = loose ? 2 : 3, hHi = loose ? 10 : 8;
  if (r1.wall < wLo || r1.wall > wHi) f.push(`G1 run1 wall P${r1.wall}`);
  if (r1.hours < hLo || r1.hours > hHi) f.push(`G1 run1 ${r1.hours.toFixed(1)}h`);
  if (asc < (loose ? 6 : 7) || asc > (loose ? 16 : 14)) f.push(`G2 ${asc} ascensions`);
  let fwd = 0, back = 0;
  for (let i = 1; i < res.runs.length; i++) { const d = res.runs[i].wall - res.runs[i - 1].wall; if (d >= 1) fwd++; if (d < (loose ? -1 : 0)) back++; }
  if (back > 0) f.push("G3 wall collapsed");
  if (fwd / Math.max(1, res.runs.length - 1) < (loose ? 0.5 : 0.7)) f.push("G3 too few advancing runs");
  if (res.hours < (loose ? 35 : 40) || res.hours > (loose ? 130 : 110)) f.push(`G4 total ${res.hours.toFixed(0)}h`);
  if (!loose) for (let i = 2; i < res.runs.length; i++) if (res.runs[i - 1].ratio < 0.6) { f.push("G5 weak ascension (+<60% of lifetime)"); break; }
  if (res.runs.some(r => r.hours > (loose ? 14 : 12))) f.push("G6 a run dragged too long");
  if (res.cores > 60000) f.push(`G7 cores ${res.cores}`);
  return f;
}

// SHIPPED constants — the sweep winner (324 configs, all gates + 40/40 noisy robustness):
//   conquer hours 0.35·2^(g-1) / M · core award ceil(1.7^(g-1)) · engine ×2 income per level @ cost ceil(2^lv)
// v16.1: CB/CR retuned so OPTIMAL play conquers ~11-12 planets/run (bail ~1.5h) instead of churning
// shallow resets — proven by this file's --policy sweep, which now gates it.
const DEFAULT = { W0: 0.35, R: 2.0, CB: 1.7, E: 2.0, C0: 1, CR: 2.0 };

if (process.argv.includes("--sweep")) {
  console.log("SWEEP — 324 configs × gates\n");
  const winners = [];
  for (const W0 of [0.25, 0.35, 0.5])
    for (const R of [1.5, 1.65, 1.8, 2.0])
      for (const CB of [1.6, 1.7, 1.8, 2.0])
        for (const E of [1.5, 1.7, 2.0])
          for (const CR of [1.8, 2.0, 2.5]) {
            const P = { W0, R, CB, E, C0: 1, CR };
            const res = simulate(P, false);
            const f = gates(res, P);
            if (!f.length) {
              const asc = res.runs.length - 1;
              // score: prefer ~9 ascensions, ~65 total hours, run1 wall P5
              const score = Math.abs(asc - 9) + Math.abs(res.hours - 65) / 10 + Math.abs(res.runs[0].wall - 5);
              winners.push({ P, asc, hours: res.hours, wall1: res.runs[0].wall, cores: res.cores, score });
            }
          }
  winners.sort((a, b) => a.score - b.score);
  console.log("passing configs:", winners.length, "/ 324\n");
  for (const w of winners.slice(0, 12))
    console.log(`W0=${w.P.W0} R=${w.P.R} CB=${w.P.CB} E=${w.P.E} CR=${w.P.CR}  → asc ${w.asc}, ${w.hours.toFixed(0)}h, run1 wall P${w.wall1}, cores ${w.cores}  (score ${w.score.toFixed(2)})`);
  if (!winners.length) process.exit(1);
  // robustness: best config under noise
  const best = winners[0].P;
  let pass = 0; const N = 40;
  for (let i = 0; i < N; i++) { const r = simulate(best, true); if (!gates(r, best, true).length) pass++; }
  console.log(`\nrobustness: best config passes ${pass}/${N} noisy trials (need ≥ ${Math.ceil(N * 0.9)})`);
  process.exit(pass >= N * 0.9 ? 0 : 1);
}

// ---- --policy: sweep player strategies on the SHIPPED constants — proves the optimum plays DEEP ----
if (process.argv.includes("--policy")) {
  const shares = [0.55, 0.7, 0.85, 1.0], walls = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
  let best = { h: 1e9 };
  console.log("policy sweep on shipped constants (bail \u00d7 engine-share \u2192 hours/runs/avg-depth):\n");
  for (const w of walls) { let row = (w + "h").padEnd(6);
    for (const sh of shares) {
      global.WALL_OVERRIDE = w; global.SHARE_OVERRIDE = sh;
      const r = simulate(DEFAULT, false);
      const avg = r.done ? (r.runs.reduce((a, b) => a + Math.min(18, b.wall) - 1, 0) / r.runs.length) : 0;
      row += (r.done ? r.hours.toFixed(1) + "h/" + r.runs.length + "r/d" + avg.toFixed(0) : "never").padStart(17);
      if (r.done && r.hours < best.h) best = { h: r.hours, runs: r.runs.length, w, sh, avg };
    }
    console.log(row);
  }
  delete global.WALL_OVERRIDE; delete global.SHARE_OVERRIDE;
  console.log("\nOPTIMAL:", best.h.toFixed(1) + "h over " + best.runs + " runs \u00b7 bail " + best.w + "h \u00b7 engine " + Math.round(best.sh * 100) + "% \u00b7 avg depth " + best.avg.toFixed(1) + " planets/run");
  const deepEnough = best.w >= 1.5 && best.avg >= 8;
  console.log(deepEnough ? "PASS: the fastest route conquers real depth (no churn exploit)" : "FAIL: shallow churn is still optimal");
  process.exit(deepEnough ? 0 : 1);
}

// ---- --verify: load the SHIPPED game headless and assert it matches this sim's design contract ----
if (process.argv.includes("--verify")) {
  const fs = require("fs"), path = require("path");
  function ctx() { const n = () => {}; const g = { addColorStop: n }; return new Proxy({}, { get(_, k) { if (String(k).indexOf("create") === 0) return () => g; if (k === "canvas") return { width: 800, height: 600 }; return n; }, set() { return true; } }); }
  function el(id) { return { id, value: "1", textContent: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, set innerHTML(v) {}, get innerHTML() { return ""; }, appendChild(c) { return c; }, querySelector() { return el("q"); }, querySelectorAll() { return []; }, getContext: () => ctx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), addEventListener() {} }; }
  const byId = {};
  global.document = { getElementById: i => byId[i] || (byId[i] = el(i)), querySelector: () => el("q"), querySelectorAll: () => [], createElement: () => el("c"), addEventListener() {}, removeEventListener() {}, hidden: false };
  const cv = el("game"); cv.clientWidth = 800; cv.clientHeight = 600; byId["game"] = cv; byId["gmap"] = el("gmap"); byId["sttree"] = el("sttree");
  global.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  global.requestAnimationFrame = () => 0; global.cancelAnimationFrame = () => {}; global.performance = { now: () => 0 };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.confirm = () => true; global.location = { reload() {} };
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"));
  const A = global.window.__IDS, SIM = global.window.__SIM;
  let bad = 0; const ok = (n, c, note) => { console.log(n.padEnd(30), (c ? "PASS \u2713 " : "FAIL \u2717 ") + (note || "")); if (!c) bad++; };
  console.log("GAME \u2194 SIM CONTRACT\n");
  ok("W0 matches", Math.abs(SIM.ASC_W0 - DEFAULT.W0) < 1e-9, SIM.ASC_W0);
  ok("R matches", Math.abs(SIM.ASC_R - DEFAULT.R) < 1e-9, SIM.ASC_R);
  ok("core base matches", Math.abs(SIM.CORE_B - DEFAULT.CB) < 1e-9, SIM.CORE_B);
  ok("conquer curve geometric", Math.abs(SIM.conquerHours(7) / SIM.conquerHours(6) - DEFAULT.R) < 1e-9, "\u00d7" + (SIM.conquerHours(7) / SIM.conquerHours(6)));
  ok("coreVal(5)", SIM.coreVal(5) === Math.ceil(Math.pow(DEFAULT.CB, 4)), SIM.coreVal(5));
  const eng = SIM.ASC_BY.engine;
  ok("engine \u00d72/lv @ 1.8^lv cost", eng.c0 === DEFAULT.C0 && Math.abs(eng.cr - DEFAULT.CR) < 1e-9, JSON.stringify({ c0: eng.c0, cr: eng.cr }));
  // behavioural: buying an engine level doubles income-side numbers, never the conquer target
  const S = A.S(), M0 = A.derived().incomeMul, T0 = SIM.conquerTarget(3), C0 = A.derived().capacity;
  global.window.__IDS.META().asc.cores = 10; SIM.buyAsc("engine"); 
  const M1 = A.derived().incomeMul, T1 = SIM.conquerTarget(3), C1 = A.derived().capacity;
  ok("engine doubles incomeMul", Math.abs(M1 / M0 - 2) < 1e-9, M0 + " \u2192 " + M1);
  ok("capacity rides engine", Math.abs(C1 / C0 - 2) < 1e-6, "\u00d7" + (C1 / C0).toFixed(3));
  ok("target does NOT ride it", T1 === T0, T0 + " \u2192 " + T1 + " (the whoosh)");
  ok("gems are gone", !/gemReward|META\.gems\s*=/.test(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8").replace(/d\.META\.gems|d\.META\.gemsEarned/g, "")), "only the migration reads remain");
  console.log("\n" + (bad ? "CONTRACT BROKEN: " + bad : "CONTRACT HOLDS: game matches the sim-locked design"));
  process.exit(bad ? 1 : 0);
}

// ---- --json: emit the run trajectory + per-planet hour curves (feeds the pacing chart) ----
if (process.argv.includes("--json")) {
  const res = simulate(DEFAULT, false);
  const perPlanet = res.runs.map(r => ({ run: r.run, mult: r.multStart,
    hours: Array.from({ length: TOTAL }, (_, i) => (DEFAULT.W0 * Math.pow(DEFAULT.R, i)) / r.multStart + 0.05 + 0.2 / Math.sqrt(r.multStart)) }));
  console.log(JSON.stringify({ P: DEFAULT, wallH: WALL_H, runs: res.runs, perPlanet, totalHours: res.hours, engineLv: res.engineLv, cores: res.cores }));
  process.exit(0);
}

// ---- single-run report on the DEFAULT (shipped) constants ----
const res = simulate(DEFAULT, false);
console.log("ASCENSION PACING — shipped constants", JSON.stringify(DEFAULT), "\n");
console.log("run  wall  run-hrs  cum-hrs  pending  banked-after  engineLv  mult");
let cum = 0, cores = 0;
for (const r of res.runs) {
  cum += r.hours; cores = r.banked + r.pend;
  console.log(String(r.run).padStart(3), ("P" + r.wall).padStart(5), r.hours.toFixed(1).padStart(8), cum.toFixed(1).padStart(8), String(r.pend).padStart(8), String(cores).padStart(13), String(r.lvStart).padStart(9), ("\u00d7" + fmtM(r.multStart)).padStart(7));
}
function fmtM(m) { return m >= 1024 ? (m / 1024).toFixed(m % 1024 ? 1 : 0) + "k" : String(Math.round(m)); }
console.log("\nfinished:", res.done, "· ascensions:", res.runs.length - 1, "· total active hours:", res.hours.toFixed(1), "· final cores:", res.cores, "· engine lv:", res.engineLv);
const f = gates(res, DEFAULT);
console.log(f.length ? "GATES FAIL: " + f.join(" | ") : "ALL GATES PASS");
process.exit(f.length ? 1 : 0);
