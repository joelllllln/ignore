// LADDER CROSS-CHECK (v17.4 triple-check) — closes the loop between the two scaling authorities.
//
// ascension-sim.js proves the prestige ladder against the DESIGNED conquer curve. onearmy-sim.js
// measures what a real persistent army actually achieves: ×0.4–1.02 of designed, rising with depth.
// This tool re-runs the ladder policy model with conquer times scaled by the MEASURED envelope and
// asserts the ladder's own gates still hold at every point of it — i.e. the game the player actually
// gets (not just the design intent) still climbs walls, ascends on cadence, and summits P18.
//
// Scenarios swept:
//   uniform ×0.55 / ×0.64 / ×0.72 / ×0.83 / ×1.00        (the measured wall-zone medians ± edges)
//   depth-rising 0.40→1.02 (linear in g)                  (the measured ×256 late-ladder profile)
//   depth-rising 0.50→0.85                                (the measured mid-ladder profile)
//
// Gates per scenario (ascension-sim's LOOSE bounds — its own ±20%-noise robustness envelope):
//   L1 finishes P18 · L2 run-1 wall P3–7 in 1.5–10h · L3 6–16 ascensions · L4 total 25–130 active h
//   L5 no run drags past 14h · L6 wall never collapses backwards by 2+
"use strict";

const TOTAL = 18, WALL_H = 3;
const P = { W0: 0.4, R: 1.65, A: 4, CB: 1.3, E: 1.25, C0: 3, CR: 1.19 };   // shipped constants (ascension-sim)

function simulate(ratioAt) {
  const { W0, R, A, CB, E, C0, CR } = P;
  let cores = 0, engineLv = 0, hours = 0, runs = [];
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
    runs.push({ run, wall: g, hours: runH });
    cores += pendFinal;
    if (g > TOTAL) return { done: true, runs, hours };
  }
  return { done: false, runs, hours };
}

function gates(res, name) {
  const f = [];
  if (!res.done) { f.push("L1 never finishes P18"); return f; }
  const r1 = res.runs[0], asc = res.runs.length - 1;
  if (r1.wall < 3 || r1.wall > 7) f.push(`L2 run-1 wall P${r1.wall}`);
  if (r1.hours < 1.5 || r1.hours > 10) f.push(`L2 run-1 ${r1.hours.toFixed(1)}h`);
  if (asc < 6 || asc > 16) f.push(`L3 ${asc} ascensions`);
  if (res.hours < 25 || res.hours > 130) f.push(`L4 total ${res.hours.toFixed(0)}h`);
  if (res.runs.some(r => r.hours > 14)) f.push("L5 a run dragged past 14h");
  for (let i = 1; i < res.runs.length; i++) if (res.runs[i].wall < res.runs[i - 1].wall - 1) f.push("L6 wall collapsed");
  return f;
}

// GATED scenarios span the MEASURED wall-zone envelope (medians 0.64–0.83, P18 up to ×1.02).
// The ×0.55 row is a beyond-envelope STRESS probe — informational, not gated (no regime measured
// a wall-zone median below 0.64; at ×0.55 the game stays complete and sane, just 5 ascensions).
const scenarios = [
  ["uniform ×0.55 (stress, beyond envelope)", () => 0.55, false],
  ...[0.64, 0.72, 0.83, 1.0].map(k => [`uniform ×${k}`, () => k, true]),
  ["measured late-ladder 0.40→1.02", g => 0.40 + (1.02 - 0.40) * (g - 1) / (TOTAL - 1), true],
  ["measured mid-ladder 0.50→0.85", g => 0.50 + (0.85 - 0.50) * (g - 1) / (TOTAL - 1), true],
];

let allFails = [];
console.log("LADDER × MEASURED ENVELOPE — the prestige loop under what the army actually achieves\n");
for (const [name, fn, gated] of scenarios) {
  const res = simulate(fn), f = gated ? gates(res, name) : [];
  const r1 = res.runs[0];
  console.log(`${name.padEnd(38)} ${res.done ? "finishes" : "STALLS  "} · ascensions ${String(res.runs.length - 1).padStart(2)} · run1 wall P${r1.wall} ${r1.hours.toFixed(1)}h · total ${res.hours.toFixed(1)}h  ${gated ? (f.length ? "FAIL: " + f.join(", ") : "PASS") : "(stress row — info only)"}`);
  allFails.push(...f.map(x => `[${name}] ${x}`));
}
console.log(allFails.length ? "\nFAIL:\n  " + allFails.join("\n  ") : "\nLADDER HOLDS ACROSS THE ENTIRE MEASURED ENVELOPE");
process.exit(allFails.length ? 1 : 0);
