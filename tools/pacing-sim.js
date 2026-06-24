// Pacing oracle: optimal idle player, reports days-to-reach each galaxy.
// Used to tune the travel-cost curve to a hardcore multi-day schedule.
// node balance.js          (uses TBASE/TGROW below)
// node balance.js 3000 9   (override travel base / growth)
"use strict";
const DAY = 86400;
const fmt = s => s >= DAY ? (s / DAY).toFixed(1) + "d" : s >= 3600 ? (s / 3600).toFixed(1) + "h" : s >= 60 ? (s / 60).toFixed(1) + "m" : Math.round(s) + "s";

// --- economy constants (mirror game.js) ---
const VALUE = { base: 20, mul: 1.6, eff: L => Math.pow(1.20, L) };
const SPAWN = { base: 24, mul: 1.33, eff: L => 0.9 + 0.45 * L };
const CAP = { base: 14, mul: 1.5, eff: L => 200 * Math.pow(1.6, L) };
const LUCK = { base: 70, mul: 1.35, max: 25, eff: L => Math.min(0.5, 0.02 * L) };
const UNIT = [ { gal: 1, base: 60, dmg: 5, rate: 1.4 }, { gal: 2, base: 500, dmg: 9, rate: 0.6 },
  { gal: 3, base: 4000, dmg: 26, rate: 0.5 }, { gal: 5, base: 30000, dmg: 3, rate: 4.2 }, { gal: 7, base: 250000, dmg: 90, rate: 0.3 } ];
const UNIT_CAP = 4;                                      // max units per defender type
const NODE = { base: 150, mul: 1.4 };                    // skill-tree nodes: pricey
const NODE_MUL = 1.27;                                   // each node COMPOUNDS damage (stronger now)
const HPB = 8, HPM = 2.1, GVAL = 2.2, GSPAWN = g => 1 + (g - 1) * 0.95;
const COLL_EFF = 0.85, YIELD = 1.1, CRIT = 2.1;          // collection + crit/abilities/class-tree baseline

// --- travel curve (the thing we are tuning) ---
const TBASE = +process.argv[2] || 800;
const TGROW = +process.argv[3] || 7;
const TEXP = +process.argv[4] || 1;   // super-exponential exponent on (g-1)
const travel = g => Math.floor(TBASE * Math.pow(TGROW, Math.pow(g - 1, TEXP)));

const S = { cash: 0, g: 1, lv: { value: 0, spawn: 0, cap: 0, luck: 0 }, units: [1, 0, 0, 0, 0], nodes: 0, t: 0 };
const upc = { value: () => Math.floor(VALUE.base * Math.pow(VALUE.mul, S.lv.value)), spawn: () => Math.floor(SPAWN.base * Math.pow(SPAWN.mul, S.lv.spawn)), cap: () => Math.floor(CAP.base * Math.pow(CAP.mul, S.lv.cap)), luck: () => Math.floor(LUCK.base * Math.pow(LUCK.mul, S.lv.luck)) };
const unitCost = i => Math.floor(UNIT[i].base * Math.pow(1.9, S.units[i]));
const nodeCost = () => Math.floor(NODE.base * Math.pow(NODE.mul, S.nodes));
const cap = () => CAP.eff(S.lv.cap);
const dmgMul = () => Math.pow(NODE_MUL, S.nodes) * CRIT;
const dps = () => { let d = 0; for (let i = 0; i < UNIT.length; i++) d += S.units[i] * UNIT[i].dmg * UNIT[i].rate; return d * dmgMul(); };
const avgHp = g => HPB * Math.pow(HPM, g - 1) * 1.3 * Math.sqrt(VALUE.eff(S.lv.value));
const spawn = g => SPAWN.eff(S.lv.spawn) * GSPAWN(g);
const kills = g => Math.min(spawn(g), dps() / avgHp(g));
const valDot = g => 2 * Math.pow(GVAL, g - 1) * VALUE.eff(S.lv.value) * (1 + 8 * LUCK.eff(S.lv.luck)) * COLL_EFF * YIELD;
const income = g => kills(g) * valDot(g);
const di = fn => { const a = income(S.g); fn(1); const b = income(S.g); fn(-1); return b - a; };

const galTimes = {}; let steps = 0;
const TIME_CAP = 1000 * DAY;
function advanceTo(cost) { // advance time until affordable or capacity-blocked
  if (S.cash >= cost) return true;
  const inc = income(S.g); if (inc <= 0) return false;
  if (cost > cap()) { // need capacity first
    const cc = upc.cap(); if (cc > cap()) return false;
    if (S.cash < cc) { S.t += (cc - S.cash) / inc; S.cash = cap(); } S.cash -= cc; S.lv.cap++; return "cap"; }
  S.t += (cost - S.cash) / inc; S.cash = cost; S.cash -= cost; return true;
}

while (S.g < 13 && S.t < TIME_CAP && steps++ < 5e5) {
  const tc = travel(S.g), sustain = dps() / avgHp(S.g + 1) >= 0.33 * spawn(S.g + 1);
  if (sustain && S.cash >= tc) { S.cash -= tc; S.g++; if (galTimes[S.g] == null) galTimes[S.g] = S.t; continue; }
  if (!sustain) { // buy best damage-per-cost
    const opts = [{ k: "n", c: nodeCost(), d: (() => { S.nodes++; const x = dps(); S.nodes--; return x - dps(); })() }];
    for (let i = 0; i < UNIT.length; i++) if (S.g >= UNIT[i].gal && S.units[i] < UNIT_CAP) { S.units[i]++; const x = dps(); S.units[i]--; opts.push({ k: i, c: unitCost(i), d: x - dps() }); }
    opts.sort((a, b) => a.c / b.d - b.c / a.d); const o = opts.sort((a, b) => (a.c / a.d) - (b.c / b.d))[0];
    const r = advanceTo(o.c); if (r === false) break; if (r === "cap") continue;
    if (o.k === "n") S.nodes++; else S.units[o.k]++; continue;
  }
  // sustain ok, save for travel — but grow income first if a fast-payback upgrade exists
  const cands = [ { k: "value", c: upc.value(), d: di(s => S.lv.value += s) }, { k: "spawn", c: upc.spawn(), d: di(s => S.lv.spawn += s) } ];
  if (S.lv.luck < LUCK.max) cands.push({ k: "luck", c: upc.luck(), d: di(s => S.lv.luck += s) });
  cands.forEach(c => c.pb = c.d > 0 ? c.c / c.d : Infinity);
  cands.sort((a, b) => a.pb - b.pb);
  const inc = income(S.g), saveT = (tc - S.cash) / inc;
  if (cands[0].pb < saveT * 0.5) { const r = advanceTo(cands[0].c); if (r === false) break; if (r === "cap") continue; S.lv[cands[0].k]++; continue; }
  const r = advanceTo(tc); if (r === false) break; if (r === "cap") continue; S.cash -= tc; S.g++; if (galTimes[S.g] == null) galTimes[S.g] = S.t;
}

console.log("travel = " + TBASE + " * " + TGROW + "^((g-1)^" + TEXP + ")\n");
let prev = 0;
for (let g = 2; g <= 12; g++) {
  if (galTimes[g] == null) { console.log("  G" + (g - 1) + "->G" + g + ":  (not reached)"); continue; }
  console.log("  G" + (g - 1) + "->G" + g + ":  +" + fmt(galTimes[g] - prev) + "   (total " + fmt(galTimes[g]) + ")");
  prev = galTimes[g];
}
console.log("\n  final galaxy", S.g, "| value lv", S.lv.value, "| units", S.units.join("/"), "| nodes", S.nodes);
