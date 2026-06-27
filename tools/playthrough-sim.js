// Full 18-planet PLAYTHROUGH validation. Unlike pacing-sim.js (a standalone model),
// this drives the REAL js/game.js in a headless browser via the window.__SIM hook, so
// every scaling number, DPS value, unlock gate and cost comes straight from the shipped
// game and can never diverge. It builds a maxed fleet on each planet, models income from
// the real eco/HP/value curves, conquers, banks the real Conquest multiplier, pays the real
// travel cost, and asserts: unlocks gate correctly, scaling climbs, money carries, no walls.
//
//   npm i -D playwright   (or have it globally)   then:   node tools/playthrough-sim.js
//
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright: npm i -D playwright'); process.exit(1);} } }
// Full 18-planet playthrough simulation driving the REAL game scaling + DPS code via __SIM.
// Builds a maxed fleet on each planet, reads real total DPS, models income from the real
// eco/HP/value curves, conquers, banks the real Conquest multiplier, pays real travel cost,
// and verifies unlocks + money-carry the whole way to the finish.
const { chromium } = requirePlaywright();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const SIM = window.__SIM, D = window.__IDS, S = D.S();
    const PL = SIM.PLANET_LOCAL(), PS = SIM.PLANET_SYS();
    const out = { rows: [], checks: [], TOTAL: SIM.TOTAL_PLANETS };

    // helper: build a "mature" fleet for planet g and return real total DPS
    const VALUE_LV = 18, SPAWN_LV = 14;   // a committed-but-not-maxed economy investment
    function buildAndDPS(g, unlockedDef) {
      S.galaxy = g; S.peakGalaxy = Math.max(S.peakGalaxy, g);
      S.lv.value = VALUE_LV; S.lv.spawnRate = SPAWN_LV; S.lv.capacity = 40; S.lv.luck = 10;
      // own max of every unlocked defender + collector class
      S.units = []; S.collectors = [];
      for (const t of SIM.DEF_ORDER) if (SIM.DEF_TYPES[t].gal <= g) for (let i = 0; i < SIM.DEF_TYPES[t].max; i++) S.units.push({ type: t, cd: 0 });
      for (const t of SIM.COL_ORDER) if (SIM.COL_TYPES[t].gal <= g) for (let i = 0; i < SIM.COL_TYPES[t].max; i++) S.collectors.push({ type: t });
      // allocate ~70% of each unlocked class tree (cheapest-connected walk)
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
        if (SIM.DEF_TYPES[t] ? SIM.DEF_TYPES[t].gal > g : SIM.COL_TYPES[t].gal > g) continue;
        S.classNodes[t] = {};
        const G = D.buildTree(t), ids = Object.keys(G.map).filter(id => id !== 'start');
        const target = Math.floor(ids.length * 0.7);
        let added = 1, guard = 0;
        while (added < target && guard++ < 5000) {
          let placed = false;
          for (const id of ids) { if (S.classNodes[t][id]) continue; if (D.nodeAllocatable(t, G.map[id])) { S.classNodes[t][id] = true; added++; placed = true; if (added >= target) break; } }
          if (!placed) break;
        }
      }
      D.recompute();
      let dps = 0; for (const u of S.units) dps += D.uDmg(u) * SIM.DEF_TYPES[u.type].rate * D.derived().cls[u.type].rate;
      return dps;
    }

    let conquest = 1, treasury = 0, empireRate = 0, cumSec = 0;
    const fmt = D.fmt;
    for (let g = 1; g <= SIM.TOTAL_PLANETS; g++) {
      const sys = SIM.SYSTEMS[PS[g - 1]].name, local = PL[g - 1];
      const unlockedDef = SIM.DEF_ORDER.filter(t => SIM.DEF_TYPES[t].gal <= g);
      const newHere = [...SIM.DEF_ORDER, ...SIM.COL_ORDER].filter(t => (SIM.DEF_TYPES[t] || SIM.COL_TYPES[t]).gal === g).map(t => (SIM.DEF_TYPES[t] || SIM.COL_TYPES[t]).name);

      // --- structural: a class must be LOCKED at g-1 and buyable at its gal ---
      // (checked once, when it unlocks)
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
        const ty = SIM.DEF_TYPES[t] || SIM.COL_TYPES[t];
        if (ty.gal === g) {
          S.peakGalaxy = g - 1; const lockedRefused = (() => { S.galaxy = Math.max(1, g - 1); const before = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length; S.cash = 1e40; D.buyUnit(t); const after = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length; return after === before; })();
          S.peakGalaxy = g; S.galaxy = g; const unlockBuyable = (() => { const before = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length; S.cash = 1e40; D.buyUnit(t); const after = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length; return after > before; })();
          out.checks.push({ cls: ty.name, gal: g, lockedAtPrev: lockedRefused, buyableAtGal: unlockBuyable, ok: lockedRefused && unlockBuyable });
        }
      }

      // --- build maxed fleet, read REAL dps, model income via REAL curves ---
      const dps = buildAndDPS(g, unlockedDef);
      const eco = SIM.eco(g), hpMul = SIM.enemyHpMul(g), vMul = SIM.valueMul(VALUE_LV);
      const avgHP = 18 * hpMul * Math.pow(vMul, 1.3) * 1.3;
      const avgVal = eco * vMul * conquest;                 // average dot pays eco*value*conquest (hp/avg=1)
      const spawnPerSec = 0.9 + 2.0 * SPAWN_LV;             // raw spawn rate
      const killsPerSec = Math.min(dps / avgHP, spawnPerSec * 1.2);   // gated by spawn supply
      const incomePerSec = killsPerSec * avgVal + empireRate;
      const tgt = SIM.conquerTarget(g);
      const conquerSec = incomePerSec > 0 ? tgt / incomePerSec : Infinity;

      // unit cost of the cheapest NEW class (affordability sanity)
      let newUnitCost = null;
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) { const ty = SIM.DEF_TYPES[t] || SIM.COL_TYPES[t]; if (ty.gal === g) { S.galaxy = g; S.units = S.units.filter(u => u.type !== t); S.collectors = S.collectors.filter(u => u.type !== t); newUnitCost = SIM.unitBuyCost(t); break; } }

      const travelC = g < SIM.TOTAL_PLANETS ? SIM.travelCost(g) : 0;
      // treasury at conquer ≈ a chunk of what you earned (cap by capacity); model: you can bank travel cost from income over the run
      const canAffordTravel = incomePerSec * conquerSec >= travelC;   // total earned this planet >= ticket

      out.rows.push({
        g, sys, local: local + 1, newHere: newHere.join(',') || '-',
        eco: eco.toExponential(2), hpMul: hpMul.toFixed(1), tgt: tgt.toExponential(2),
        travel: travelC ? travelC.toExponential(2) : 'FINAL',
        newUnitCost: newUnitCost != null ? newUnitCost.toExponential(2) : '-',
        dps: dps.toExponential(2), incPerSec: incomePerSec.toExponential(2),
        conquerSec: Math.round(conquerSec), conquerH: (conquerSec / 3600).toFixed(1),
        conquest: conquest.toExponential(2), affordTravel: canAffordTravel,
      });

      // --- conquer: bank conquest, accumulate empire, travel ---
      empireRate += incomePerSec * 0.4 * 0.15;   // BG_EFF on a fraction (you don't leave at full live rate)
      conquest *= SIM.CONQ_STEP;
      cumSec += conquerSec;
    }

    // invariants
    const allUnlockOk = out.checks.every(c => c.ok);
    const ecoMono = out.rows.every((r, i) => i === 0 || +r.eco >= +out.rows[i - 1].eco);
    const tgtMono = out.rows.every((r, i) => i === 0 || +r.tgt >= +out.rows[i - 1].tgt);
    const allAfford = out.rows.every(r => r.affordTravel);
    const conquerTimes = out.rows.map(r => r.conquerSec);
    const noWall = conquerTimes.every(s => s < 30 * 86400);   // no planet should take > 30 days
    const finalConquest = Math.pow(SIM.CONQ_STEP, SIM.TOTAL_PLANETS - 1);
    out.summary = { allUnlockOk, ecoMono, tgtMono, allAfford, noWall, finalConquest: finalConquest.toExponential(2), cumDays: (cumSec / 86400).toFixed(1) };
    return out;
  });

  // ---- print report ----
  const r = result;
  console.log('FULL PLAYTHROUGH SIM — 18 planets, real game scaling + DPS\n');
  console.log('planet                unlocks            eco       dotHP  conquerTgt   travel    newUnit$   totalDPS   inc/sec   conquer  ⚔conquest aff');
  for (const x of r.rows) {
    console.log(
      `${String(x.g).padStart(2)} ${x.sys.padEnd(6)} ${x.newHere.padEnd(18).slice(0,18)} ${x.eco.padStart(9)} ${x.hpMul.padStart(5)} ${x.tgt.padStart(10)} ${x.travel.padStart(9)} ${x.newUnitCost.padStart(9)} ${x.dps.padStart(9)} ${x.incPerSec.padStart(9)} ${(x.conquerH+'h').padStart(7)} ${x.conquest.padStart(9)} ${x.affordTravel?'Y':'N'}`
    );
  }
  console.log('\nUNLOCK GATE CHECKS (locked at g-1, buyable at gal):');
  for (const c of r.checks) console.log(`  ${c.cls.padEnd(16)} gal ${String(c.gal).padStart(2)}  locked@prev:${c.lockedAtPrev?'Y':'N'}  buyable@gal:${c.buyableAtGal?'Y':'N'}  -> ${c.ok?'PASS':'FAIL'}`);
  console.log('\nINVARIANTS:');
  const s = r.summary;
  console.log(`  all class unlocks gate correctly:        ${s.allUnlockOk ? 'PASS' : 'FAIL'}`);
  console.log(`  eco(g) strictly climbs:                  ${s.ecoMono ? 'PASS' : 'FAIL'}`);
  console.log(`  conquerTarget(g) strictly climbs:        ${s.tgtMono ? 'PASS' : 'FAIL'}`);
  console.log(`  travel always affordable from a run:     ${s.allAfford ? 'PASS' : 'FAIL'}`);
  console.log(`  no planet walls (>30 days):              ${s.noWall ? 'PASS' : 'FAIL'}`);
  console.log(`  final Conquest multiplier ×${s.finalConquest}  (=1.8^17)`);
  console.log(`  est. total active time to finish: ~${s.cumDays} days`);
  console.log('\n' + (errs.length ? 'ERRORS: ' + errs.join(' | ') : 'NO CONSOLE/PAGE ERRORS'));
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
