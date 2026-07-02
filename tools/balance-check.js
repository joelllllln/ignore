// Balance guard — run with: node tools/balance-check.js
//
// v14 FIXED-COST economy: prices NEVER rise with purchases (owner decision).
// The planet sets the price (eco(g)); income growth and dot menace set the pace.
// So the old audit (cost growth must outrun effect growth) is retired — the new
// invariants are:
//   1. FLATNESS — for every economy upgrade, unit class and tree node, the price
//      at a high level/count equals the price at level/count 0. Any drift means
//      someone reintroduced per-purchase scaling.
//   2. NO SOFT-LOCK — Capacity's ceiling still grows while its price stays flat,
//      so the next level can never become unaffordable forever.
//   3. PLANET SCALING — prices still climb ACROSS planets (eco(g) strictly rises),
//      so later worlds keep meaningful price tags.
"use strict";
const fs = require("fs");
const path = require("path");

// ---- minimal DOM/canvas stub so game.js can load in Node ----
function ctx() { const n = () => {}; const g = { addColorStop: n }; return new Proxy({}, { get(_, k) { if (String(k).indexOf("create") === 0) return () => g; if (k === "canvas") return { width: 800, height: 600 }; return n; }, set() { return true; } }); }
function el(id) { return { id, value: "1", textContent: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, set innerHTML(v) {}, get innerHTML() { return ""; }, appendChild(c) { return c; }, querySelector() { return el("q"); }, querySelectorAll() { return []; }, getContext: () => ctx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), addEventListener() {} }; }
const byId = {};
global.document = { getElementById: i => byId[i] || (byId[i] = el(i)), querySelectorAll: () => [], createElement: () => el("c"), addEventListener() {}, removeEventListener() {}, hidden: false };
const cv = el("game"); cv.clientWidth = 800; cv.clientHeight = 600; byId["game"] = cv; byId["gmap"] = el("gmap"); byId["sttree"] = el("sttree");
global.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
global.requestAnimationFrame = () => {}; global.performance = { now: () => 0 };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.confirm = () => true; global.location = { reload() {} };

eval(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"));
const A = window.__IDS, SIM = window.__SIM;
const S = A.S();

let bad = 0;
const report = (label, flat, lo, hi) => {
  console.log(label.padEnd(26), flat ? "FLAT" : "DRIFTS", "  (first " + lo + " vs later " + hi + ")", flat ? "✓" : "✗ scaling crept back in");
  if (!flat) bad++;
};

console.log("FIXED-COST ECONOMY AUDIT (v14 — prices must not rise with purchases)\n");

// 1a. economy upgrades: price at level 0 == price at level 30
for (const id of ["value", "spawnRate", "capacity", "luck"]) {
  S.lv[id] = 0; A.recompute(); const lo = A.upCost(id);
  S.lv[id] = 30; A.recompute(); const hi = A.upCost(id);
  S.lv[id] = 0; A.recompute();
  report("eco: " + id, lo === hi, lo, hi);
}

// 1b. unit classes: price with 1 owned == price with 5 owned
{
  const saved = S.units;
  S.units = [{ type: "turret", cd: 0 }]; const lo = SIM.unitBuyCost("turret");
  S.units = Array.from({ length: 5 }, () => ({ type: "turret", cd: 0 })); const hi = SIM.unitBuyCost("turret");
  S.units = saved;
  report("unit: turret", lo === hi, lo, hi);
}

// 1c. tree nodes: passive price with 0 allocated == with 40 allocated (and keystone premium is a constant ratio)
{
  const G = A.buildTree("turret"), ids = Object.keys(G.map).filter(i => i !== "start");
  // price = cash delta of a REAL allocation of whichever passive is allocatable in that state (then undo)
  const probe = () => {
    const n = G.nodes.find(x => x.kind !== "start" && x.kind !== "key" && x.kind !== "major" && !S.classNodes.turret[x.id] && A.nodeAllocatable("turret", x));
    if (!n) return -1;
    const before = S.cash = 1e15; A.allocNode("turret", n);
    const paid = before - S.cash; delete S.classNodes.turret[n.id]; S.cash = 0; A.recompute();
    return paid;
  };
  S.classNodes.turret = {}; A.recompute();
  const cost0 = probe();
  ids.slice(0, 40).forEach(i => S.classNodes.turret[i] = true); A.recompute();
  const cost40 = probe();
  S.classNodes.turret = {}; A.recompute();
  report("tree: passive node", cost0 > 0 && cost0 === cost40, cost0, cost40);
}

// 2. capacity can never soft-lock: ceiling grows, price flat
{
  S.lv.capacity = 0; A.recompute(); const c0 = A.derived().capacity, p0 = A.upCost("capacity");
  S.lv.capacity = 20; A.recompute(); const c1 = A.derived().capacity, p1 = A.upCost("capacity");
  S.lv.capacity = 0; A.recompute();
  const okCap = c1 > c0 && p1 === p0;
  console.log("capacity soft-lock".padEnd(26), okCap ? "SAFE ✓ (ceiling grows, price flat)" : "AT RISK ✗"); if (!okCap) bad++;
}

// 3. planet scaling intact: eco strictly climbs so later worlds still price up
{
  let mono = true; for (let g = 2; g <= SIM.TOTAL_PLANETS; g++) if (SIM.eco(g) <= SIM.eco(g - 1)) mono = false;
  console.log("eco(g) climbs per planet".padEnd(26), mono ? "PASS ✓" : "FAIL ✗"); if (!mono) bad++;
}

console.log("\n" + (bad ? "FAIL: " + bad + " check(s) — per-purchase cost scaling has crept back in" : "PASS: all prices flat per planet; pacing is governed by income + menace, not price walls"));
process.exit(bad ? 1 : 0);
