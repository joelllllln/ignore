// Balance guard — run with: node tools/balance-check.js
//
// Loads the real game (js/game.js) headlessly and audits the economy upgrades
// for the "runaway" failure mode that lets you print infinite money: an upgrade
// whose income MULTIPLIER per level is bigger than its COST multiplier per level
// pays for itself faster every level, so it spirals out of control.
//
// The decisive number is  ratio = costMul / effectMul :
//   < 1.00  -> RUNAWAY (self-funds faster each level = infinite money / trivial)
//   ~ 1.0-1.1 -> too cheap (never a meaningful constraint)
//   > 1.1   -> healthy (each level takes more effort than the last)
//
// Additive-effect upgrades (Spawn, Luck) give a flat bonus per level, so any
// cost growth > 1 already converges; we just report their cost growth.
"use strict";
const fs = require("fs");
const path = require("path");

// ---- minimal DOM/canvas stub so game.js can load in Node ----
function ctx() { const n = () => {}; const g = { addColorStop: n }; return new Proxy({}, { get(_, k) { if (String(k).indexOf("create") === 0) return () => g; if (k === "canvas") return { width: 800, height: 600 }; return n; }, set() { return true; } }); }
function el(id) { return { id, value: "1", textContent: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, set innerHTML(v) {}, get innerHTML() { return ""; }, appendChild(c) { return c; }, querySelector() { return el("q"); }, querySelectorAll() { return []; }, getContext: () => ctx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), addEventListener() {} }; }
const byId = {};
global.document = { getElementById: i => byId[i] || (byId[i] = el(i)), querySelectorAll: () => [], createElement: () => el("c") };
const cv = el("game"); cv.clientWidth = 800; cv.clientHeight = 600; byId["game"] = cv; byId["gmap"] = el("gmap"); byId["sttree"] = el("sttree");
global.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
global.requestAnimationFrame = () => {}; global.performance = { now: () => 0 };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.confirm = () => true; global.location = { reload() {} };

eval(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"));
const A = window.__IDS;

// probe the real constants: set a level, recompute, read the derived effect + cost
function probe(id, effectKey, additive) {
  const S = A.S();
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

console.log("ECONOMY BALANCE AUDIT (cost growth vs effect growth per level)\n");
let bad = 0;
for (const c of checks) {
  const r = probe(c.id, c.eff, c.kind === "additive");
  let verdict, detail;
  if (c.kind === "additive") { detail = "(flat bonus/level)"; verdict = r.costMul > 1.05 ? "healthy (additive)" : "TOO CHEAP"; if (r.costMul <= 1.05) bad++; }
  else if (c.kind === "ceiling") {
    // a cash CEILING (not income): cost must NOT outgrow the ceiling it grants,
    // or the next level becomes unaffordable forever (soft-lock).
    detail = "effect ×" + r.effMul.toFixed(2) + "  ratio " + r.ratio.toFixed(3);
    if (r.costMul > r.effMul) { verdict = "SOFT-LOCK — cost outgrows ceiling"; bad++; }
    else verdict = "healthy (scalable)";
  } else { // income multiplier: cost must outgrow effect or it prints infinite money
    detail = "effect ×" + r.effMul.toFixed(2) + "  ratio " + r.ratio.toFixed(3);
    if (r.ratio < 1.0) { verdict = "RUNAWAY — infinite money"; bad++; }
    else if (r.ratio < 1.1) { verdict = "too cheap"; bad++; }
    else verdict = "healthy";
  }
  console.log(c.label.padEnd(20), "cost ×" + r.costMul.toFixed(2), detail, " -> " + verdict);
}
console.log("\n" + (bad ? "FAIL: " + bad + " upgrade(s) need rebalancing" : "PASS: no infinite-money exploits"));
process.exit(bad ? 1 : 0);
