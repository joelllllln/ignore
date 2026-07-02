// Balance guard — run with: node tools/balance-check.js
//
// v14.1 HYBRID economy (owner decision):
//   • Units & ECONOMY upgrades keep classic geometric cost growth — audited the
//     original way: an income upgrade's cost multiplier per level must OUTGROW
//     its effect multiplier (ratio = costMul/effectMul > 1.1) or it prints
//     infinite money; a cash CEILING must not outgrow the room it grants.
//   • TREE NODES are FIXED-COST per planet — audited for flatness: a passive's
//     price with 40 nodes allocated must equal its price with 0. Any drift means
//     per-node scaling crept back in.
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

// ── PART 1: the classic runaway audit for the geometric costs ──
function probe(id, effectKey, additive) {
  const read = lv => { S.lv[id] = lv; A.recompute(); return { eff: A.derived()[effectKey], cost: A.upCost(id) }; };
  const a = read(4), b = read(5); S.lv[id] = 0; A.recompute();
  const costMul = b.cost / a.cost;
  const effMul = additive ? 1 : b.eff / a.eff;
  return { costMul, effMul, ratio: costMul / effMul, additive };
}
const checks = [
  { id: "value", eff: "valueMul", kind: "income", label: "Value (cash/dot)" },
  { id: "capacity", eff: "capacity", kind: "ceiling", label: "Capacity (ceiling)" },
  { id: "spawnRate", eff: "spawnPerSec", kind: "additive", label: "Spawn Rate" },
  { id: "luck", eff: "luck", kind: "additive", label: "Luck" },
];
console.log("ECONOMY AUDIT — geometric costs (cost growth vs effect growth per level)\n");
for (const c of checks) {
  const r = probe(c.id, c.eff, c.kind === "additive");
  let verdict, detail;
  if (c.kind === "additive") { detail = "(flat bonus/level)"; verdict = r.costMul > 1.05 ? "healthy (additive)" : "TOO CHEAP"; if (r.costMul <= 1.05) bad++; }
  else if (c.kind === "ceiling") {
    detail = "effect ×" + r.effMul.toFixed(2) + "  ratio " + r.ratio.toFixed(3);
    if (r.costMul > r.effMul) { verdict = "SOFT-LOCK — cost outgrows ceiling"; bad++; }
    else verdict = "healthy (scalable)";
  } else {
    detail = "effect ×" + r.effMul.toFixed(2) + "  ratio " + r.ratio.toFixed(3);
    if (r.ratio < 1.0) { verdict = "RUNAWAY — infinite money"; bad++; }
    else if (r.ratio < 1.1) { verdict = "too cheap"; bad++; }
    else verdict = "healthy";
  }
  console.log(c.label.padEnd(20), "cost ×" + r.costMul.toFixed(2), detail, " -> " + verdict);
}

// units: geometric in count (sanity: the 5th costs more than the 1st)
{
  const saved = S.units;
  S.units = [{ type: "turret", cd: 0 }]; const lo = SIM.unitBuyCost("turret");
  S.units = Array.from({ length: 5 }, () => ({ type: "turret", cd: 0 })); const hi = SIM.unitBuyCost("turret");
  S.units = saved;
  const ok = hi > lo;
  console.log("Units (geometric)".padEnd(20), "1-owned " + lo + " vs 5-owned " + hi, " -> " + (ok ? "healthy (grows)" : "FLAT — growth lost")); if (!ok) bad++;
}

// ── PART 2: TREE NODES must be FLAT per planet (owner decision, v14.1) ──
{
  const G = A.buildTree("turret"), ids = Object.keys(G.map).filter(i => i !== "start");
  const probeNode = () => {
    const n = G.nodes.find(x => x.kind !== "start" && x.kind !== "key" && x.kind !== "major" && !S.classNodes.turret[x.id] && A.nodeAllocatable("turret", x));
    if (!n) return -1;
    const before = S.cash = 1e15; A.allocNode("turret", n);
    const paid = before - S.cash; delete S.classNodes.turret[n.id]; S.cash = 0; A.recompute();
    return paid;
  };
  S.classNodes.turret = {}; A.recompute();
  const cost0 = probeNode();
  ids.slice(0, 40).forEach(i => S.classNodes.turret[i] = true); A.recompute();
  const cost40 = probeNode();
  S.classNodes.turret = {}; A.recompute();
  const flat = cost0 > 0 && cost0 === cost40;
  console.log("\nTREE AUDIT — nodes must be flat-priced per planet");
  console.log("Passive node".padEnd(20), "0-allocated " + cost0 + " vs 40-allocated " + cost40, " -> " + (flat ? "FLAT ✓" : "DRIFTS ✗ per-node scaling crept back")); if (!flat) bad++;
}

console.log("\n" + (bad ? "FAIL: " + bad + " check(s) need attention" : "PASS: geometric costs healthy, tree nodes flat"));
process.exit(bad ? 1 : 0);
