// ONE-ARMY SCALING VALIDATOR (v17.0) — proves the persistent-fleet economy against the designed curve.
//
// Drives the REAL js/game.js in headless Chromium via __IDS/__SIM. Unlike the old per-planet model,
// the army ACCUMULATES: this sim starts from an ascension-fresh state (1 turret, 1 drone, empty trees)
// and plays the whole campaign with the game's OWN purchase functions — buyUnit / buyUp / allocNode —
// so every price, unlock gate, cap and tree rule is the shipped one and can never diverge.
//
// Per planet: income is modeled from the real total DPS vs the real HP/value/spawn curves (same model
// playthrough-sim.js used, active-equivalent via ACTIVE_MAX), a greedy spend policy reinvests earnings
// (cheapest of: any unit, any eco upgrade, cheapest allocatable tree node), and the planet is conquered
// when accumulated earnings cross the real conquerTarget(g).
//
// GATES (the v17 scaling contract). Each regime splits into the MELT ZONE (Engine makes the designed
// curve smaller than the ramp floor — planets are meant to evaporate) and the WALL ZONE (the designed
// curve dominates — this is where hop decisions happen and pacing is FELT):
//   O1 nothing is ever SLOWER than ×3 the designed curve (no surprise walls, anywhere)
//   O2 inside the wall zone the measured curve GROWS (no collapse into steamroll-forever)
//   O3 wall-zone median ratio in [0.40 .. 2.0] — on-curve where it matters; the melt zone may melt
//   O4 every planet is conquerable (income never dies, no >400h runaways)
//
//   node tools/onearmy-sim.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const result = await page.evaluate((ENGINE_MULT) => {
    const SIM = window.__SIM, D = window.__IDS, S = D.S();
    const ACTIVE_MAX = 8.6;                     // skilled active play banks ~8.6× the passive model (see README/sims)
    const out = { rows: [], TOTAL: SIM.TOTAL_PLANETS };

    // ---- ascension-fresh army ----
    function resetArmy() {
      S.units = [{ type: 'turret', cd: 0 }]; S.collectors = [{ type: 'drone' }];
      for (const k in S.lv) S.lv[k] = 0;
      for (const t in S.classNodes) S.classNodes[t] = {};
      S.cash = Math.floor(SIM.eco(1) * 160); S.vault = {}; S.conquest = 1;   // mirrors startMul (v18.0 cold-open purse)
      S.galaxy = 1; S.peakGalaxy = 1; D.recompute();
    }

    const dpsNow = () => { D.recompute(); let d = 0; for (const u of S.units) d += D.uDmg(u) * SIM.DEF_TYPES[u.type].rate * D.derived().cls[u.type].rate; return d; };
    // income model (same shape playthrough-sim used, from real curves)
    function incomePerSec(g, engineMult) {
      const vMul = SIM.valueMul(SIM.ecoLv('value'));               // v18.0: ONE global level — the ladder is continuous
      const avgHP = 18 * SIM.enemyHpMul(g) * Math.pow(vMul, 1.3) * 1.3;
      const avgVal = SIM.eco(g) * vMul * (engineMult || 1);
      const spawn = 0.9 + 0.9 * SIM.ecoLv('spawnRate');
      const kills = Math.min(dpsNow() / avgHP, spawn * 1.2);
      return kills * avgVal;
    }
    // spend POLICIES (v17.4 triple-check): 'cheapest' = greedy default; 'ecoFirst' = pump the eco tab, then rest;
    // 'treesFirst' = trees before everything; 'lazy' = keeps a 60% cash reserve (a cautious/idle player).
    // Gates must hold for the default; variants must still FINISH with no wall past ×4 designed.
    let POLICY = 'cheapest';
    function spendAll() {
      let guard = 0;
      if (POLICY === 'ecoFirst') { let g2 = 0; while (g2++ < 2000) { let bought = false; for (const id of ['value', 'spawnRate', 'capacity', 'luck']) { const c = SIM.upCost(id); if (c <= S.cash) { D.buyUp(id); bought = true; break; } } if (!bought) break; } }
      if (POLICY === 'treesFirst') { let g3 = 0; while (g3++ < 2000) { let bought = false;
        for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) { const n2 = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length; if (n2 === 0) continue;
          const G = D.buildTree(t); for (const nd of G.nodes) { if (D.nodeAllocated(t, nd.id) || !D.nodeAllocatable(t, nd)) continue; const before = S.cash; D.allocNode(t, nd); if (S.cash !== before) { bought = true; break; } } if (bought) break; }
        if (!bought) break; } }
      while (guard++ < 4000) {
        if (POLICY === 'lazy') { /* cautious player: only spend while holding a big reserve */ }
        let bestCost = Infinity, buy = null;
        for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
          const ty = SIM.DEF_TYPES[t] || SIM.COL_TYPES[t];
          if (S.peakGalaxy < ty.gal) continue;
          const n = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length;
          if (n >= ty.max) continue;
          const c = SIM.unitBuyCost(t); if (c < bestCost) { bestCost = c; buy = () => D.buyUnit(t); }
        }
        for (const id of ['value', 'spawnRate', 'capacity', 'luck']) {
          const c = SIM.upCost(id); if (c < bestCost) { bestCost = c; buy = () => D.buyUp(id); }
        }
        for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
          const ty = SIM.DEF_TYPES[t] || SIM.COL_TYPES[t];
          const n = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length;
          if (n === 0) continue;   // only grow trees of classes you field
          const G = D.buildTree(t);
          for (const nd of G.nodes) {
            if (D.nodeAllocated(t, nd.id) || !D.nodeAllocatable(t, nd)) continue;
            // real node price via the real allocator: probe with allocNode (it no-ops if unaffordable)
            const before = S.cash; D.allocNode(t, nd); if (S.cash !== before) { bestCost = -1; buy = null; break; }   // bought it — restart scan
          }
          if (bestCost === -1) break;
        }
        if (bestCost === -1) continue;             // a node was bought inside the scan — rescan
        if (!buy || bestCost > (POLICY === 'lazy' ? S.cash * 0.4 : S.cash)) break;   // lazy keeps a 60% reserve
        const before = S.cash; buy(); if (S.cash === before) break;   // gate refused — stop
      }
    }

    function campaign(engineMult, maxPlanet, policy) {
      POLICY = policy || 'cheapest';
      resetArmy();
      const rows = []; let empire = 0;
      for (let g = 1; g <= (maxPlanet || SIM.TOTAL_PLANETS); g++) {
        S.galaxy = g; S.peakGalaxy = Math.max(S.peakGalaxy, g); D.recompute();
        const tgt = SIM.conquerTarget(g);
        let earned = 0, secs = 0, guard = 0;
        while (earned < tgt && guard++ < 30000) {
          const inc = incomePerSec(g, engineMult) + empire;
          if (inc <= 0) return { rows, dead: g };
          spendAll();
          const remain = tgt - earned;
          // log-scaled integration: fine steps through the exponential ramp, coarser as elapsed grows —
          // giant slices at the weakest moment were inflating early-planet times ~40× in v1 of this sim
          const slice = Math.min(remain / inc, Math.max(120, secs * 0.08));
          earned += inc * slice; S.cash += inc * slice; secs += slice;
          if (secs / 3600 / ACTIVE_MAX > 400) return { rows, dead: g };
        }
        spendAll();
        // v17.20 TRAVEL MODELING (audit finding): the real game charges eco(g)×5e6 to LAUNCH and a
        // ≥600s transit (300s for the first hop) — neither was modeled, silently understating every
        // planet's true cost exactly like the unit-price hole. Save for the launch (income continues),
        // pay it, then ride the transit (empire ticks; the field is in cargo).
        if (g < (maxPlanet || SIM.TOTAL_PLANETS)) {
          // v18.9 SETTLED WORLDS: after conquest COMBAT INCOME IS OVER (v18.6 — nothing spawns on your
          // own world). The launch save runs on the settlement instead: the planet's supervised on-site
          // tribute (×20 background rate) + the rest of the empire — exactly what the live game pays.
          const tc = SIM.travelCost(g); let gT = 0;
          const settle = SIM.baseTarget(g) / (SIM.IDLE_PAYBACK_H * 3600) * 20;
          while (S.cash < tc && gT++ < 20000) {
            const inc2 = settle + empire; if (inc2 <= 0) break;
            const slice = Math.min((tc - S.cash) / inc2, 300); S.cash += inc2 * slice; secs += slice;
          }
          S.cash = Math.max(0, S.cash - tc);
          secs += 2;   // v17.22 (owner call): transit time removed — travel is a 2s cinematic jump; the launch SAVE above is the whole gate
        }
        empire += incomePerSec(g, engineMult) * 0.4 * 0.15;                      // BG_EFF tribute fraction
        const activeH = secs / 3600 / ACTIVE_MAX;
        const inc1 = incomePerSec(g, 1);   // engine-free income — capacity also excludes the engine here, so the ratio is regime-invariant
        rows.push({ g, activeH, designedH: 0.4 * Math.pow(1.65, g - 1) / (engineMult || 1) + 0.05 + 0.2 / Math.sqrt(engineMult || 1), dps: dpsNow(), value: S.lv.value, eff: SIM.ecoLv('value'), spawn: S.lv.spawnRate, effS: SIM.ecoLv('spawnRate'), capLv: S.lv.capacity, luckLv: S.lv.luck, luckPct: Math.round(D.derived().luck * 1000) / 10, bankSecs: inc1 > 0 ? Math.round(D.derived().capacity / inc1) : Infinity, units: S.units.length, cols: S.collectors.length, nodes: (() => { let n = 0; for (const t in S.classNodes) n += Object.keys(S.classNodes[t]).length; return n; })() });
      }
      return { rows };
    }

    // regimes of the real ladder — run 1 (M=1), mid (×16), late (×256), TRUE SUMMIT (×800 = Engine lv 30) —
    // plus player-policy variants at the mid-ladder regime (triple-check: robustness to play styles)
    out.regimes = [];
    for (const [M, maxP, policy] of [[1, 8, 'cheapest'], [16, 13, 'cheapest'], [256, SIM.TOTAL_PLANETS, 'cheapest'], [800, SIM.TOTAL_PLANETS, 'cheapest'], [16, 13, 'ecoFirst'], [16, 13, 'treesFirst'], [16, 13, 'lazy']]) {
      const c = campaign(M, maxP, policy);
      out.regimes.push({ M, maxP, policy, rows: c.rows, dead: c.dead });
    }
    return out;
  }, 16);

  // ---- report + gates ----
  // The designed contract per regime: measured active hours ≈ designed 0.4·1.65^(g−1)/M. Bands are wide
  // (the ascension-sim ladder survives ±20% noise with headroom) but the SHAPE must hold in every regime.
  const r = result, fails = [];
  console.log('ONE-ARMY CAMPAIGN — persistent fleet vs designed conquer curve (active-equivalent hours)');
  for (const reg of (r.regimes || [])) {
    const variant = reg.policy && reg.policy !== 'cheapest';
    console.log(`\n== ENGINE ×${reg.M} (planets 1–${reg.maxP})${reg.policy ? ' · policy: ' + reg.policy : ''} ==`);
    console.log(' g   measured   designed   ratio   dps        valueLv effV effS capLv luck%  bank-s units cols nodes');
    const ratios = [];
    for (const x of reg.rows) {
      const ratio = x.activeH / x.designedH; ratios.push(ratio);
      console.log(String(x.g).padStart(2), (x.activeH.toFixed(2) + 'h').padStart(9), (x.designedH.toFixed(2) + 'h').padStart(10), ('×' + ratio.toFixed(2)).padStart(7), x.dps.toExponential(2).padStart(10), String(x.value).padStart(7), String(x.eff == null ? '-' : x.eff).padStart(4), String(x.effS == null ? '-' : x.effS).padStart(4), String(x.capLv == null ? '-' : x.capLv).padStart(5), String(x.luckPct == null ? '-' : x.luckPct).padStart(5), String(x.bankSecs == null ? '-' : x.bankSecs).padStart(7), String(x.units).padStart(5), String(x.cols).padStart(4), String(x.nodes).padStart(5));
    }
    if (reg.dead) fails.push(`O4 [M×${reg.M}${reg.policy ? ' ' + reg.policy : ''}] planet ${reg.dead} unconquerable`);
    if (!ratios.length) continue;
    if (variant) {   // policy variants: looser contract — must finish, and never wall past ×4 designed
      for (const x of reg.rows) { const ratio = x.activeH / x.designedH; if (ratio > 4.0) fails.push(`P1 [M×${reg.M} ${reg.policy}] P${x.g} ratio ×${ratio.toFixed(2)} > 4.0`); }
      continue;
    }
    const ramp = 0.05 + 0.2 / Math.sqrt(reg.M);
    const wall = reg.rows.filter(x => 0.4 * Math.pow(1.65, x.g - 1) / reg.M >= 2 * ramp);   // curve-dominated planets
    const wallRatios = wall.map(x => x.activeH / x.designedH);
    const med = wallRatios.length ? wallRatios.slice().sort((a, b) => a - b)[Math.floor(wallRatios.length / 2)] : NaN;
    console.log(`   wall zone P${wall.length ? wall[0].g : '-'}+ · wall-zone median ×${isNaN(med) ? '-' : med.toFixed(2)}`);
    for (const x of reg.rows) { const ratio = x.activeH / x.designedH; if (ratio > 3.0) fails.push(`O1 [M×${reg.M}] P${x.g} ratio ×${ratio.toFixed(2)} > 3.0 (surprise wall)`); }
    for (let i = 1; i < wall.length; i++) if (wall[i].activeH <= wall[i - 1].activeH) fails.push(`O2 [M×${reg.M}] wall-zone curve collapsed at P${wall[i].g}`);
    if (wallRatios.length && (med < 0.40 || med > 2.0)) fails.push(`O3 [M×${reg.M}] wall-zone median ×${med.toFixed(2)} outside [0.40,2.0]`);
    // UPGRADE-AUDIT gates (v17.4): every upgrade dimension must stay sane the whole campaign
    for (const x of reg.rows) {
      const inWall = 0.4 * Math.pow(1.65, x.g - 1) / reg.M >= 2 * ramp;   // U1 belongs where you PARK: melt planets are crossed in seconds and never bank
      if (x.g >= 4 && inWall && x.bankSecs != null && isFinite(x.bankSecs) && x.bankSecs < 600) fails.push(`U1 [M×${reg.M}] P${x.g} cash ceiling holds only ${x.bankSecs}s of income (<10min) — Capacity curve lagging`);   // P1–3 opening is DESIGNED tight (unchanged pre-v17 formula): forces active spending, teaches Capacity via the amber hint
      if (x.luckPct != null && x.luckPct >= 60) fails.push(`U2 [M×${reg.M}] P${x.g} Luck at the 60% cap — further buys would be dead`);
      // U3 (v18.0 semantics): eco levels are ONE global ladder now — absolute level, no re-baseline.
      // Floor: the spend policy must find eco worth buying early (else the curve is mispriced into a
      // trap). Ceiling: geometric costs (×1.30/×1.32 per level) must contain the level count even at
      // Engine ×800 / P18 — a blowout past it means a value→income→value runaway feedback loop.
      if (x.eff != null && x.g > 1 && (x.eff < 4 || x.eff > 140)) fails.push(`U3 [M×${reg.M}] P${x.g} global Value level ${x.eff} outside [4,140] — eco ladder starved or runaway`);
      if (x.effS != null && x.g > 1 && (x.effS < 3 || x.effS > 130)) fails.push(`U3 [M×${reg.M}] P${x.g} global Spawn level ${x.effS} outside [3,130]`);
    }
    // U3-mono: a single global ladder can only rise — any per-planet DROP in level is a state bug
    for (let i = 1; i < reg.rows.length; i++) {
      if (reg.rows[i].eff < reg.rows[i - 1].eff) fails.push(`U3 [M×${reg.M}] Value level fell P${reg.rows[i - 1].g}→P${reg.rows[i].g} (${reg.rows[i - 1].eff}→${reg.rows[i].eff}) — global ladder went backwards`);
      if (reg.rows[i].effS < reg.rows[i - 1].effS) fails.push(`U3 [M×${reg.M}] Spawn level fell P${reg.rows[i - 1].g}→P${reg.rows[i].g}`);
    }
  }
  console.log('\n' + (errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors'));
  console.log(fails.length ? '\nFAIL:\n  ' + fails.join('\n  ') : '\nALL ONE-ARMY GATES PASS');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
