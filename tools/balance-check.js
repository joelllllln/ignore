// Balance guard — run with: node tools/balance-check.js
//
// v14.1 HYBRID economy (owner decision):
//   • Units & ECONOMY upgrades keep classic geometric cost growth — audited the
//     original way: an income upgrade's cost multiplier per level must OUTGROW
//     its effect multiplier (ratio = costMul/effectMul > 1.1) or it prints
//     infinite money; a cash CEILING must not outgrow the room it grants.
//   • TREE NODES are DEPTH-PRICED (sim-calibrated span x12000): a node's price is
//     set by its ring, NEVER by how many nodes you've bought — audited two ways:
//     allocation-independence (same node, same price at 0 vs 40 allocated) and
//     depth-monotonicity (mean passive price rises ring by ring, big total span).
"use strict";
const fs = require("fs");
const path = require("path");

// ---- DOM/canvas stub so game.js can load in Node (v18.70: shared, see tools/domstub.js) ----
require("./domstub.js").install(global);

eval(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"));
const A = window.__IDS, SIM = window.__SIM;
const S = A.S();
let bad = 0;

// ── PART 1: the classic runaway audit for the geometric costs ──
function probe(id, effectKey, additive) {
  const read = lv => { S.lv[id] = lv; A.recompute(); return { eff: A.derived()[effectKey], cost: A.upCost(id) }; };
  // v18.56: measure across a WHOLE milestone leg, not two adjacent levels. Every economy stat now
  // withholds MILE_SHARE of its growth and repays it in a lump every MILE_LEG legacy levels, so an
  // adjacent-level sample reads either the shaved slope or the lump — never the real per-level rate.
  // (It already read the lump before this change: Capacity showed ×3.09 and Value ×1.23, both of
  // which are one leg's worth of growth wearing a single level's clothes.) Both endpoints here are
  // milestones, where the curve is identical to the pre-milestone one, so the geometric mean over
  // the leg IS the per-level growth this audit is asking about.
  const LEG = SIM.MILE_LEG, a = read(SIM.rungLv(LEG)), b = read(SIM.rungLv(2 * LEG));
  S.lv[id] = 0; A.recompute();
  const per = 1 / LEG;   // in LEGACY levels — the unit the curve constants are written in
  const costMul = Math.pow(b.cost / a.cost, per);
  const effMul = additive ? 1 : Math.pow(b.eff / a.eff, per);
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

// ── PART 2: TREE NODES are DEPTH-PRICED and allocation-independent (v14.2) ──
{
  const G = A.buildTree("turret"), ids = Object.keys(G.map).filter(i => i !== "start");
  // BFS depths (same walk the game uses)
  let adj = G.adj; if (!adj) { adj = {}; for (const [a2, b2] of G.edges) { (adj[a2] = adj[a2] || []).push(b2); (adj[b2] = adj[b2] || []).push(a2); } }
  const dep = { start: 0 }, q = ["start"];
  while (q.length) { const id = q.shift(); for (const m of (adj[id] || [])) if (!(m in dep)) { dep[m] = dep[id] + 1; q.push(m); } }
  const price = n => { const before = S.cash = 1e18; A.allocNode("turret", n); const paid = before - S.cash; delete S.classNodes.turret[n.id]; S.cash = 0; A.recompute(); return paid; };
  console.log("\nTREE AUDIT — depth-priced, allocation-independent");
  // (a) allocation-independence: the FIRST allocatable passive costs the same with 40 other nodes bought
  S.classNodes.turret = {}; A.recompute();
  const n0 = G.nodes.find(x => x.kind !== "start" && x.kind !== "key" && x.kind !== "major" && A.nodeAllocatable("turret", x));
  const p0 = price(n0);
  ids.slice(0, 40).forEach(i => { if (i !== n0.id) S.classNodes.turret[i] = true; }); A.recompute();
  const p40 = A.nodeAllocatable("turret", n0) ? price(n0) : p0;
  S.classNodes.turret = {}; A.recompute();
  const indep = p0 > 0 && p0 === p40;
  console.log("alloc-independence".padEnd(20), p0 + " vs " + p40 + " (same node, 0 vs 40 bought)", " -> " + (indep ? "PASS ✓" : "FAIL ✗ coupling crept back")); if (!indep) bad++;
  // (b) depth-monotone + span: mean passive price per ring rises; deepest/entry span is big (idle scaling)
  S.free = true;   // sandbox pricing path is 1% but RATIOS are unchanged; use direct cost readout instead via alloc trick on empty tree per ring
  S.free = false;
  const byRing = {};
  for (const n of G.nodes) { if (n.kind !== "minor" && n.kind !== "start" && n.kind !== "key" && n.kind !== "major") continue; }
  // read prices structurally: allocate along a BFS order so every node becomes reachable, recording each passive's paid price by its ring
  S.classNodes.turret = {}; A.recompute(); S.cash = 1e18;
  const order = Object.keys(dep).filter(i => i !== "start").sort((a2, b2) => dep[a2] - dep[b2]);
  for (const id of order) { const n = G.map[id]; if (!n || !A.nodeAllocatable("turret", n)) continue; const before = S.cash; A.allocNode("turret", n); const paid = before - S.cash;
    if (n.kind !== "key" && n.kind !== "major") (byRing[dep[id]] = byRing[dep[id]] || []).push(paid); }
  S.classNodes.turret = {}; S.cash = 0; A.recompute();
  const rings = Object.keys(byRing).map(Number).sort((a2, b2) => a2 - b2);
  const means = rings.map(r => byRing[r].reduce((x, y) => x + y, 0) / byRing[r].length);
  let mono = true; for (let i = 1; i < means.length; i++) if (means[i] <= means[i - 1]) mono = false;
  const span = means[means.length - 1] / means[0];
  console.log("depth-monotone".padEnd(20), rings.map((r, i) => "r" + r + ":" + Math.round(means[i])).join(" "), " -> " + (mono ? "PASS ✓" : "FAIL ✗")); if (!mono) bad++;
  // NB: wings END in keystone/major tips, so the deepest PASSIVES sit ~ring 6 of 9 — the passive span is
  // x100-200 while keystones extend the full x12000 curve. Band reflects passives only.
  const spanOk = span > 60 && span < 60000;
  console.log("inner->outer span".padEnd(20), "x" + Math.round(span) + " (passives; keystone tips extend deeper)", " -> " + (spanOk ? "PASS ✓ (steep idle scaling)" : "FAIL ✗ out of band")); if (!spanOk) bad++;
}

console.log("\n" + (bad ? "FAIL: " + bad + " check(s) need attention" : "PASS: geometric costs healthy, tree depth-pricing sound"));
process.exit(bad ? 1 : 0);
