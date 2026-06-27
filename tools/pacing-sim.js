// Pacing oracle (v3 economy): models the HYBRID difficulty + Conquest-multiplier curve
// the game actually ships, and reports the RELATIVE conquer-pace per planet so you can
// see the two power-fantasy arcs and the system walls at a glance.
//
//   node tools/pacing-sim.js                 (uses the constants below)
//   node tools/pacing-sim.js 1.8 6.0 1.5     (override CONQ_STEP SYS_JUMP WITHIN_STEP)
//
// MODEL (mirrors js/game.js):
//   diff(g)      planet number-magnitude — ×WITHIN_STEP within a system, ×SYS_JUMP entering a new one.
//   conquest     permanent income multiplier, ×CONQ_STEP per planet conquered (carries forever).
//   eco(g)       = CUR_BASE * diff(g) — costs AND drops both ride this, so it cancels.
//   income/sec   ∝ value(eco·conquest) × kill-rate(dps / dotHP),  dotHP ∝ diff^0.4 (enemyHpMul).
//   conquerTgt   ∝ eco(g) · 1.2^(g-1).
// => relative conquer time  ∝  diff(g)^0.4 · 1.2^(g-1) / (conquest · dps).
//    Within a system this SHRINKS (you outpace); at a system jump it SPIKES (you feel small).
"use strict";

const CONQ_STEP   = +process.argv[2] || 1.8;
const SYS_JUMP    = +process.argv[3] || 6.0;
const WITHIN_STEP = +process.argv[4] || 1.5;
const HP_DAMP     = 0.4;     // enemyHpMul = diff^HP_DAMP
const TRAVEL_ESC  = 1.2;     // conquerTarget escalation 1.2^(g-1)

const SYSTEMS = [{ name: "Helios", planets: 4 }, { name: "Cygnus", planets: 6 }, { name: "Erebus", planets: 8 }];
const LOCAL = [], SYS = [];
SYSTEMS.forEach((s, si) => { for (let l = 0; l < s.planets; l++) { LOCAL.push(l); SYS.push(si); } });
const TOTAL = LOCAL.length;

const diff = g => { g = Math.max(1, Math.min(g, TOTAL)); let v = 1; for (let k = 2; k <= g; k++) v *= (LOCAL[k - 1] === 0 ? SYS_JUMP : WITHIN_STEP); return v; };
const hpMul = g => Math.pow(diff(g), HP_DAMP);
// conquest you HAVE when you arrive at planet g = CONQ_STEP^(planets already conquered = g-1)
const arriveConq = g => Math.pow(CONQ_STEP, g - 1);
// relative conquer pace (lower = faster). dps held flat here to isolate the macro curve;
// in-planet rebuild only makes late planets faster still, never slower.
const relTime = g => hpMul(g) * Math.pow(TRAVEL_ESC, g - 1) / arriveConq(g);

console.log(`v3 PACING — CONQ_STEP ×${CONQ_STEP}/planet · SYS_JUMP ×${SYS_JUMP} · WITHIN ×${WITHIN_STEP}\n`);
console.log(" g  system   diff      dotHP×   conquest×   rel-pace   note");
let prev = relTime(1), prevHp = hpMul(1);
for (let g = 1; g <= TOTAL; g++) {
  const wall = LOCAL[g - 1] === 0 && g > 1;
  const paceJump = relTime(g) / prev;
  const hpJump = (hpMul(g) / prevHp);
  const note = g === 1 ? "start (easiest)"
    : wall ? `◀ SYSTEM WALL — dotHP ×${hpJump.toFixed(2)}, pace ×${paceJump.toFixed(2)} (feel small)`
    : `steamroll — pace ×${paceJump.toFixed(2)}`;
  console.log(
    String(g).padStart(2),
    SYSTEMS[SYS[g - 1]].name.padEnd(7),
    diff(g).toExponential(1).padStart(8),
    hpMul(g).toFixed(1).padStart(7) + "×",
    arriveConq(g).toExponential(1).padStart(9) + "×",
    relTime(g).toExponential(1).padStart(9),
    " " + note
  );
  prev = relTime(g); prevHp = hpMul(g);
}

// summary: confirm the design invariants hold
let within = [], walls = [];
for (let g = 2; g <= TOTAL; g++) { const r = relTime(g) / relTime(g - 1); (LOCAL[g - 1] === 0 ? walls : within).push(r); }
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log("\nINVARIANTS:");
console.log(`  within-system pace ×${avg(within).toFixed(2)}  (want < 1 → you outpace, steamroll)  -> ${avg(within) < 1 ? "PASS" : "FAIL"}`);
console.log(`  system-wall  pace ×${avg(walls).toFixed(2)}  (want > 1 → a real wall, feel small)  -> ${avg(walls) > 1 ? "PASS" : "FAIL"}`);
console.log(`  net power g1→g${TOTAL}: ×${(arriveConq(TOTAL) / 1).toExponential(1)} income, dots ×${hpMul(TOTAL).toFixed(0)} tankier`);
