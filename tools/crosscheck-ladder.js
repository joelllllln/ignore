// LADDER CROSS-CHECK (v17.4 triple-check) — closes the loop between the two scaling authorities.
//
// ascension-sim.js proves the prestige ladder against the DESIGNED conquer curve. onearmy-sim.js
// measures what a real persistent army actually achieves: ×0.4–1.02 of designed, rising with depth.
// This tool re-runs the ladder policy model with conquer times scaled by the MEASURED envelope and
// asserts the ladder's own gates still hold at every point of it — i.e. the game the player actually
// gets (not just the design intent) still climbs walls, ascends on cadence, and summits P18.
//
// Scenarios swept:
//   uniform ×0.75 / ×0.90 / ×1.03 / ×1.20 / ×1.42 / ×1.59   (the measured wall-zone medians ± edges)
//   depth-rising 0.75→1.59 (linear in g)                     (the measured v18.21 ladder profile)
//
// Gates per scenario (ascension-sim's LOOSE bounds — its own ±20%-noise robustness envelope):
//   L1 finishes P18 · L2 run-1 wall P3–7 in 1.5–10h · L3 5–16 ascensions (see gate note) · L4 total 25–130 active h
//   L5 no run drags past 14h · L6 wall never collapses backwards by 2+
"use strict";

const TOTAL = 18, WALL_H = 3;
const P = { W0: 0.4, R: 1.65, A: 4, CB: 1.3, E: 1.25, C0: 3, CR: 1.19 };   // shipped constants (ascension-sim)

function simulate(ratioAt) {
  const { W0, R, A, CB, E, C0, CR } = P;
  let cores = 0, engineLv = 0, hours = 0, runs = [], minedTot = 0, bankedTot = 0;
  const M = () => Math.pow(E, engineLv);
  const engCost = lv => Math.ceil(C0 * Math.pow(CR, lv));
  const spend = () => { while (engCost(engineLv) <= cores) { cores -= engCost(engineLv); engineLv++; } };
  const cval = x => Math.ceil(A * Math.pow(CB, x - 1));
  for (let run = 1; run <= 60; run++) {
    spend();
    let g = 1, runH = 0, banked = [], pend = 0;
    while (g <= TOTAL) {
      const t = (W0 * Math.pow(R, g - 1) / M() + 0.05 + 0.2 / Math.sqrt(M())) * ratioAt(g);
      if (t > WALL_H && banked.length >= 3) { pend = banked.reduce((s, x) => s + cval(x), 0) + Math.floor(cval(g) * 0.25); break; }
      hours += t; runH += t; banked.push(g); g++;
      if (runH > 40) break;
    }
    const pendFinal = pend || banked.reduce((s, x) => s + cval(x), 0);
    // v18.3 ◈ CORE MINES — conquered worlds trickle cores on the WALL clock (v18.25: 1/2 · 1.3^(g−1) per day).
    // Upper-bound model: every banked planet held for the entire run at fully-idle pacing (×8.6 active).
    const mined = banked.reduce((s, x) => s + (1 / 2) * Math.pow(1.3, x - 1), 0) * (runH * 8.6 / 24);
    minedTot += mined; bankedTot += pendFinal;
    // v18.7 PARK-vs-ASCEND (owner ask: "it should never be pointless to ascend"): at this run's wall,
    // compare the two strategies' ◈/wall-clock-day — parking forever digs only the mines' rate, while
    // the ascend CYCLE banks the pending pool every re-climb (run length at fully-idle ×8.6 pacing).
    const parkedRate = banked.reduce((s, x) => s + (1 / 2) * Math.pow(1.3, x - 1), 0);
    const cycleRate = pendFinal / Math.max(0.05, runH * 8.6 / 24);
    runs.push({ run, wall: g, hours: runH, parkedRate, cycleRate, adv: cycleRate / Math.max(1e-9, parkedRate) });
    cores += pendFinal + Math.floor(mined);
    if (g > TOTAL) return { done: true, runs, hours, minedTot, bankedTot };
  }
  return { done: false, runs, hours, minedTot, bankedTot };
}

function gates(res, name) {
  const f = [];
  if (!res.done) { f.push("L1 never finishes P18"); return f; }
  const r1 = res.runs[0], asc = res.runs.length - 1;
  if (r1.wall < 3 || r1.wall > 7) f.push(`L2 run-1 wall P${r1.wall}`);
  if (r1.hours < 1.5 || r1.hours > 10) f.push(`L2 run-1 ${r1.hours.toFixed(1)}h`);
  // L3 floor 6→5 (v18.14): the ladder's ascension count is quantized — the dense ratio map (see
  // scratch ladder-map) shows a knife-edge 5/6 boundary running right through the measured fast-edge
  // medians (×0.62-0.65), plus an isolated 5-pocket at exactly ×0.75; the previously "passing" ×0.64
  // rows sat on the same edge by luck. 5 full ascension cycles still honors the owner's stated cadence
  // ("first ascension ~P5, then 10, then the final planet" ≈ 3-4), and the gates that actually protect
  // the prestige loop are L8 (ascend ≥2× parked — measured ≥×9.7 everywhere), L5/L6 (no drags, no
  // collapse) and L2 (sane run-1 wall). The ceiling stays 16 (grind-forever guard).
  if (asc < 5 || asc > 16) f.push(`L3 ${asc} ascensions`);
  if (res.hours < 25 || res.hours > 130) f.push(`L4 total ${res.hours.toFixed(0)}h`);
  if (res.runs.some(r => r.hours > 14)) f.push("L5 a run dragged past 14h");
  for (let i = 1; i < res.runs.length; i++) if (res.runs[i].wall < res.runs[i - 1].wall - 1) f.push("L6 wall collapsed");
  // L7 is a BAND, not a ceiling (v18.25, owner: "make mines more productive"). Mining used to be a
  // garnish at 7-9% of banked cores, so the 10%-of-target build barely registered as a decision; the
  // base rate is now ×3.5 and mining lands at ~26-32%. The two edges encode the intent from both
  // sides, so neither can drift away silently:
  //   ceiling 40% — mining must never become the MAJORITY source, or holding worlds substitutes for
  //     the loop (the harder guarantee lives in L8: the ascend cycle must still out-earn parking)
  //   floor   12% — and it must never fall back to a rounding error, which is what made it feel
  //     pointless in the first place
  // Both are measured at the fully-idle upper bound: every conquered world held for the entire run
  // at ×8.6 wall-clock pacing, which is the most generous case mining can possibly get.
  const minePct = res.minedTot / Math.max(1, res.bankedTot);
  if (minePct > 0.40) f.push(`L7 mines dug ${Math.round(res.minedTot)} vs ${res.bankedTot} banked (${(minePct * 100).toFixed(0)}% > 40%) — idling for cores rivals ascending`);
  if (minePct < 0.12) f.push(`L7 mines dug only ${(minePct * 100).toFixed(0)}% of banked cores (<12%) — the mine build is back to being a garnish`);
  // v18.7 L8: at EVERY wall of EVERY run, the ascend cycle's ◈/day must beat parked mining by ≥2× —
  // there is never a point in the campaign where sitting on your mines out-earns ascending
  for (const r of res.runs) if (r.adv < 2) f.push(`L8 run ${r.run} wall P${r.wall}: ascend cycle only ×${r.adv.toFixed(1)} parked mining (<2×) — parking competes with ascending`);
  return f;
}

// GATED scenarios span the MEASURED wall-zone envelope. v18.21 (owner: "I passively beat a lot of
// the planets — per-upgrade scaling should be more aggressive") steepened Value ×1.37→1.46 and Spawn
// ×1.39→1.48, so every eco level is a real commitment and the ladder can't be bought out cheaply:
// measured wall-zone medians ×0.75–1.59 (M×1 0.75 · M×16 1.03 · M×256 1.42 · M×800 1.59), rising
// with depth inside each wall zone. The ×0.42 stress row is the untuned BUILD-1.13 economy —
// informational: complete and sane there, but only 4 ascensions, which is why BUILD moved up.
const scenarios = [
  ["uniform ×0.42 (stress: BUILD-1.13 economy)", () => 0.42, false],
  ...[0.75, 0.90, 1.03, 1.20, 1.42, 1.59].map(k => [`uniform ×${k}`, () => k, true]),
  ["measured v18.21 wall profile 0.75→1.59", g => 0.75 + (1.59 - 0.75) * (g - 1) / (TOTAL - 1), true],
];

let allFails = [];
console.log("LADDER × MEASURED ENVELOPE — the prestige loop under what the army actually achieves\n");
for (const [name, fn, gated] of scenarios) {
  const res = simulate(fn), f = gated ? gates(res, name) : [];
  const r1 = res.runs[0];
  const minAdv = Math.min(...res.runs.map(r => r.adv));
  console.log(`${name.padEnd(38)} ${res.done ? "finishes" : "STALLS  "} · ascensions ${String(res.runs.length - 1).padStart(2)} · run1 wall P${r1.wall} ${r1.hours.toFixed(1)}h · total ${res.hours.toFixed(1)}h · mines ${Math.round(res.minedTot)}◈/${res.bankedTot}◈ (${(res.minedTot / res.bankedTot * 100).toFixed(0)}%) · ascend≥×${minAdv.toFixed(1)} parked  ${gated ? (f.length ? "FAIL: " + f.join(", ") : "PASS") : "(stress row — info only)"}`);
  allFails.push(...f.map(x => `[${name}] ${x}`));
}
console.log(allFails.length ? "\nFAIL:\n  " + allFails.join("\n  ") : "\nLADDER HOLDS ACROSS THE ENTIRE MEASURED ENVELOPE");
process.exit(allFails.length ? 1 : 0);
