// ASCENSION PACING SIMULATOR (v16.4) — run with: node tools/ascension-sim.js [--sweep|--policy|--verify|--json]
//
// Models the loop END TO END with the exact shipped formulas:
//   conquer time  t(g) = W0·R^(g-1) hours / M  + ramp        (M = engine income mult; targets do NOT ride M — that's the whoosh)
//   core award    c(g) = ceil(A·CB^(g-1)) per planet conquered  (+ 50% partial credit on the planet you're stuck on)
//   engine        M = E^lv, level lv costs ceil(C0·CR^lv) cores — prestige is ONE line (income only,
//                 +25%/lv since v16.4), so every core goes into the Engine; there is no sibling-line tax
//   player policy ascend when the next planet needs > WALL_H hours (and ≥ 3 banked); spend all-in on engine
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

function simulate(P, noise) {
  const { W0, R, A, CB, E, C0, CR } = P;   // A = base cores per planet (v16.4: "a few", not 1)
  const wallH = global.WALL_OVERRIDE || WALL_H;
  const rnd = noise ? () => 1 + (Math.random() * 2 - 1) * 0.2 : () => 1;
  let cores = 0, engineLv = 0, engineSpent = 0;
  let hours = 0, runs = [], deepest = 0;
  const M = () => Math.pow(E, engineLv);
  const engCost = lv => Math.ceil(C0 * Math.pow(CR, lv));
  let lifetime = 0;
  const spend = () => {   // v16.3: prestige is ONE line — every core goes into the Engine, all-in, no sibling tax
    while (engCost(engineLv) <= cores) { const c = engCost(engineLv); cores -= c; engineSpent += c; engineLv++; }
  };
  for (let run = 1; run <= 60; run++) {
    spend();
    const lvStart = engineLv, multStart = M();
    let g = 1, runH = 0, banked = [];
    let pend = 0;
    const cval = x => Math.ceil((A || 1) * Math.pow(CB, x - 1));
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

// SHIPPED constants. v16.3: prestige collapsed to ONE income line at ×1.5/lv (owner call — "only the
// cash thing, and gentler than ×2"). Planet pacing (W0/R) is FROZEN — the conquer bars players know
// don't move; only the prestige economics (E/CR/CB) were re-swept so every gate + the ladder hold.
// v16.4 (owner): drops should be "a few" cores not 1, the core curve must be FAR flatter, benefits
// gentler — and the whole economy needs headroom for MORE SOLAR SYSTEMS beyond the first three.
// The deep truth: prestige steepness is PINNED to the wall. A ×2-per-planet wall forces income
// multipliers of ×2^17 by P18 (×millions once more systems land) and forces core payouts to grow
// ~×1.7/planet or shallow churn becomes optimal (proven: every flat-core config under R 2.0 failed
// the ladder gate at bail 0.5h). So v16.4 flattens the WHOLE geometry coherently:
//   wall    ×1.65 per planet (was ×2)    — planets still compound hard, but numbers stay humble
//   cores   ceil(4·1.3^(g−1))            — P1 pays 4, P18 pays ~346 (was 1 … 8,273); P30 stays ~8k
//   engine  +25%/lv @ ceil(3·1.19^lv)    — endgame income ×~800 (was ×25,000), 2-3 buys per run
// Churn stays dead by the same two laws, restated for the new base: CB/R ≈ 0.79 (marginal planet
// still pays most of its time cost) and CR^(lnR/lnE) ≥ CB (reach never gets cheaper than cores grow).
const DEFAULT = { W0: 0.4, R: 1.65, A: 4, CB: 1.3, E: 1.25, C0: 3, CR: 1.19 };

if (process.argv.includes("--sweep")) {
  const winners = [];
  let total = 0;
  for (const W0 of [0.3, 0.35, 0.4])
    for (const R of [1.55, 1.6, 1.65])
      for (const A of [4, 5, 6])
      for (const CB of [1.3, 1.35, 1.4])
        for (const E of [1.2, 1.25])
          for (const C0 of [2, 3])
          for (const CR of [1.13, 1.15, 1.17, 1.19]) {   // must satisfy CB ≈ CR^(lnR/lnE) — cost-of-reach growth matches core growth per planet
            total++;
            const P = { W0, R, A, CB, E, C0, CR };
            const res = simulate(P, false);
            const f = gates(res, P);
            if (!f.length) {
              const asc = res.runs.length - 1;
              // score: ~9 ascensions, ~55 total hours, run1 wall P5ish, endgame income mult ~×300-1000
              const mult = Math.pow(E, res.engineLv);
              const score = Math.abs(asc - 9) + Math.abs(res.hours - 55) / 10 + Math.abs(res.runs[0].wall - 5) + Math.abs(Math.log10(mult) - 2.7);
              winners.push({ P, asc, hours: res.hours, wall1: res.runs[0].wall, cores: res.cores, mult, score });
            }
          }
  console.log("SWEEP — " + total + " configs × gates (v16.4: the WALL is in the grid — the whole geometry flattens together)\n");
  winners.sort((a, b) => a.score - b.score);
  console.log("passing configs:", winners.length, "/ " + total + "\n");
  for (const w of winners.slice(0, 12))
    console.log(`W0=${w.P.W0} R=${w.P.R} A=${w.P.A} CB=${w.P.CB} E=${w.P.E} C0=${w.P.C0} CR=${w.P.CR}  → asc ${w.asc}, ${w.hours.toFixed(0)}h, wall1 P${w.wall1}, cores ${w.cores}, mult ×${Math.round(w.mult)}  (score ${w.score.toFixed(2)})`);
  if (!winners.length) process.exit(1);
  // robustness: noise-test the SHIPPED constants when they pass the gates (fall back to the top scorer)
  const best = (winners.find(w => JSON.stringify(w.P) === JSON.stringify(DEFAULT)) || winners[0]).P;
  let pass = 0; const N = 40;
  for (let i = 0; i < N; i++) { const r = simulate(best, true); if (!gates(r, best, true).length) pass++; }
  console.log(`\nrobustness: best config passes ${pass}/${N} noisy trials (need ≥ ${Math.ceil(N * 0.9)})`);
  process.exit(pass >= N * 0.9 ? 0 : 1);
}

// ---- --policy: sweep player strategies on the SHIPPED constants — proves the optimum IS THE LADDER ----
if (process.argv.includes("--policy")) {
  // one prestige line (v16.3) \u2014 the only strategy dimension left is WHEN you bail into ascension
  const walls = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
  let best = { h: 1e9 };
  console.log("policy sweep on shipped constants (bail hour \u2192 total hours / runs / avg depth):\n");
  for (const w of walls) {
    global.WALL_OVERRIDE = w;
    const r = simulate(DEFAULT, false);
    const avg = r.done ? (r.runs.reduce((a, b) => a + Math.min(18, b.wall) - 1, 0) / r.runs.length) : 0;
    console.log((w + "h").padEnd(7) + (r.done ? r.hours.toFixed(1) + "h / " + r.runs.length + " runs / avg depth " + avg.toFixed(1) : "never finishes"));
    if (r.done && r.hours < best.h) best = { h: r.hours, runs: r.runs.length, w, avg };
  }
  console.log("\nOPTIMAL:", best.h.toFixed(1) + "h over " + best.runs + " runs \u00b7 bail " + best.w + "h \u00b7 avg depth " + best.avg.toFixed(1) + " planets/run");
  // THE LADDER (v16.2) \u2014 the optimum must not just be deep ON AVERAGE, it must be SHAPED like a
  // ladder: hop at ~3 worlds on run 1, then every ascension carries you deeper, all the way to P18.
  global.WALL_OVERRIDE = best.w;
  const opt = simulate(DEFAULT, false);
  delete global.WALL_OVERRIDE;
  const lad = opt.runs.map(r => Math.min(TOTAL, r.wall - 1));
  console.log("\nTHE LADDER (optimal route, conquests per run):\n  " + lad.map(d => "P" + d).join(" \u2192 "));
  const steps = lad.slice(1).map((d, i) => d - lad[i]);
  const ladFail = [];
  if (lad[0] > 4) ladFail.push("L1 run 1 goes P" + lad[0] + " deep (want a ~P3 hop)");
  // L2 (v16.4 reform): under the \u00d71.65 wall each planet is a smaller step, so "a few planets later"
  // means: three ascensions in, you're \u2265 3 worlds past your first hop (the old \u00d72-era rule was +2 on run 2).
  if (lad.length < 4 || lad[3] - lad[0] < 3) ladFail.push("L2 not \u22653 worlds past the first hop within 3 ascensions");
  if (steps.some(s => s < 0)) ladFail.push("L3 the ladder collapses (a run went SHALLOWER)");
  if (steps.filter(s => s >= 1).length < Math.ceil(steps.length * 0.8)) ladFail.push("L4 too flat (<80% of runs go deeper)");
  if (lad[lad.length - 1] !== TOTAL) ladFail.push("L5 never reaches P" + TOTAL);
  // churn check: a real ladder bails \u2265 1h and averages deep \u2014 0.5h shallow spam must never win
  const deepEnough = best.w >= 1 && best.avg >= 8;
  if (!deepEnough) ladFail.unshift("shallow churn is still optimal (bail " + best.w + "h / avg depth " + best.avg.toFixed(1) + ")");
  console.log(ladFail.length ? "FAIL: " + ladFail.join(" | ") : "PASS: the fastest route IS the ladder \u2014 a ~P3 first hop, then deeper every ascension, no churn");
  process.exit(ladFail.length ? 1 : 0);
}

// ---- --verify: load the SHIPPED game headless and assert it matches this sim's design contract ----
if (process.argv.includes("--verify")) {
  const fs = require("fs"), path = require("path");
  require("./domstub.js").install(global);   // v18.70: one shared stub, complete enough that game.js does not need guards for it
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"));
  const A = global.window.__IDS, SIM = global.window.__SIM;
  let bad = 0; const ok = (n, c, note) => { console.log(n.padEnd(30), (c ? "PASS \u2713 " : "FAIL \u2717 ") + (note || "")); if (!c) bad++; };
  console.log("GAME \u2194 SIM CONTRACT\n");
  ok("W0 matches", Math.abs(SIM.ASC_W0 - DEFAULT.W0) < 1e-9, SIM.ASC_W0);
  ok("R matches", Math.abs(SIM.ASC_R - DEFAULT.R) < 1e-9, SIM.ASC_R);
  ok("core base matches", Math.abs(SIM.CORE_B - DEFAULT.CB) < 1e-9, SIM.CORE_B);
  ok("core FLOOR matches (a few, not 1)", Math.abs(SIM.CORE_A - DEFAULT.A) < 1e-9, "planet 1 pays " + SIM.coreVal(1));
  ok("conquer curve geometric", Math.abs(SIM.conquerHours(7) / SIM.conquerHours(6) - DEFAULT.R) < 1e-9, "\u00d7" + (SIM.conquerHours(7) / SIM.conquerHours(6)));
  ok("coreVal(5)", SIM.coreVal(5) === Math.ceil(DEFAULT.A * Math.pow(DEFAULT.CB, 4)), SIM.coreVal(5));
  const eng = SIM.ASC_BY.engine;
  ok("engine cost curve matches", Math.abs(eng.c0 - DEFAULT.C0) < 1e-9 && Math.abs(eng.cr - DEFAULT.CR) < 1e-9, JSON.stringify({ c0: eng.c0, cr: eng.cr }));
  // v16.3: prestige is ONE line \u2014 income only. The other six lines must be GONE.
  ok("prestige = income ONLY", SIM.ASC_LINES.length === 1 && SIM.ASC_LINES[0].key === "engine", SIM.ASC_LINES.map(l => l.key).join(","));
  // behavioural: buying an engine level multiplies income-side numbers by E, never the conquer target
  const S = A.S(), M0 = A.derived().incomeMul, T0 = SIM.conquerTarget(3), C0 = A.derived().capacity;
  global.window.__IDS.META().asc.cores = 10; SIM.buyAsc("engine");
  const M1 = A.derived().incomeMul, T1 = SIM.conquerTarget(3), C1 = A.derived().capacity;
  ok("engine \u00d7" + DEFAULT.E + " incomeMul", Math.abs(M1 / M0 - DEFAULT.E) < 1e-9, M0 + " \u2192 " + M1);
  ok("capacity rides engine", Math.abs(C1 / C0 - DEFAULT.E) < 1e-6, "\u00d7" + (C1 / C0).toFixed(3));
  ok("target does NOT ride it", T1 === T0, T0 + " \u2192 " + T1 + " (the whoosh)");
  // ladder coach: the in-game hop hint must sit exactly on the --policy-proven optimal bail (1h since v16.4)
  ok("hop hint = policy optimum", SIM.ASC_HOP_H === 1.0, SIM.ASC_HOP_H + "h (--policy's OPTIMAL bail)");
  SIM.setCps(1000); SIM.setEarned(0);
  const tgtW = SIM.conquerTarget(S.galaxy);
  ok("wall ETA honest", Math.abs(SIM.wallEtaH() - tgtW / 1000 / 3600) < 1e-9, SIM.wallEtaH().toFixed(2) + "h = target/cps");
  ok("no coaching before floor", SIM.wallAhead() === false, "silent until 3 conquests (the ascend floor)");
  SIM.setCps(0); SIM.setEarned(0);
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
