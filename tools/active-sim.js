// ACTIVE-PLAY sims: the full 18-planet timeline at 4 engagement levels (0% / 10% / 35% / 100%
// active), driven by the REAL game scaling via window.__SIM. "X% active" = playing actively that
// share of the time; skilled active play banks ~8.6x passive (draw-to-kill + abilities), so the
// income multiplier = 1 + frac*(ACTIVE_MAX-1). Prints a per-planet conquer/cumulative timeline per level.
//
//   npm i -D playwright   (or have it globally)   then:   node tools/active-sim.js
//
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright: npm i -D playwright'); process.exit(1);} } }
// 4 playthrough sims at different active-play levels, real game scaling/DPS via __SIM.
// "X% active" = actively playing X% of the time; active play banks ~8.6x passive (per README),
// so income multiplier = 1 + frac*(40-1).
const { chromium } = requirePlaywright();
const ACTIVE_MAX = 8.6;
const LEVELS = [
  { label: 'PASSIVE (0% active)',  frac: 0.0 },
  { label: '10% active play',      frac: 0.10 },
  { label: '35% active play',      frac: 0.35 },
  { label: '100% active play',     frac: 1.0 },
];
const fmtT = s => {
  if (!isFinite(s)) return '—';
  const d = s / 86400;
  if (d >= 1) return d.toFixed(1) + 'd';
  const h = s / 3600; if (h >= 1) return h.toFixed(1) + 'h';
  const m = s / 60; if (m >= 1) return m.toFixed(0) + 'm';
  return Math.round(s) + 's';
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const data = await page.evaluate((ACTIVE_MAX) => {
    const SIM = window.__SIM, D = window.__IDS, S = D.S();
    const PL = SIM.PLANET_LOCAL(), PS = SIM.PLANET_SYS();
    const VALUE_LV = 18, SPAWN_LV = 14;
    function buildAndDPS(g) {
      S.galaxy = g; S.peakGalaxy = Math.max(S.peakGalaxy, g);
      S.lv.value = VALUE_LV; S.lv.spawnRate = SPAWN_LV; S.lv.capacity = 40; S.lv.luck = 10;
      S.units = []; S.collectors = [];
      for (const t of SIM.DEF_ORDER) if (SIM.DEF_TYPES[t].gal <= g) for (let i = 0; i < SIM.DEF_TYPES[t].max; i++) S.units.push({ type: t, cd: 0 });
      for (const t of SIM.COL_ORDER) if (SIM.COL_TYPES[t].gal <= g) for (let i = 0; i < SIM.COL_TYPES[t].max; i++) S.collectors.push({ type: t });
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
        if (SIM.DEF_TYPES[t] ? SIM.DEF_TYPES[t].gal > g : SIM.COL_TYPES[t].gal > g) continue;
        S.classNodes[t] = {}; const G = D.buildTree(t), ids = Object.keys(G.map).filter(id => id !== 'start');
        const target = Math.floor(ids.length * 0.7); let added = 1, guard = 0;
        while (added < target && guard++ < 5000) { let placed = false; for (const id of ids) { if (S.classNodes[t][id]) continue; if (D.nodeAllocatable(t, G.map[id])) { S.classNodes[t][id] = true; added++; placed = true; if (added >= target) break; } } if (!placed) break; }
      }
      D.recompute();
      let dps = 0; for (const u of S.units) dps += D.uDmg(u) * SIM.DEF_TYPES[u.type].rate * D.derived().cls[u.type].rate;
      return dps;
    }
    // base (passive) income/sec per planet, conquest applied at sim time
    const planets = [];
    for (let g = 1; g <= SIM.TOTAL_PLANETS; g++) {
      const dps = buildAndDPS(g);
      const eco = SIM.eco(g), hpMul = SIM.enemyHpMul(g), vMul = SIM.valueMul(VALUE_LV);
      const avgHP = 18 * hpMul * Math.pow(vMul, 1.3) * 1.3;
      const spawnPerSec = 0.9 + 2.0 * SPAWN_LV;
      const killsPerSec = Math.min(dps / avgHP, spawnPerSec * 1.2);
      const newHere = [...SIM.DEF_ORDER, ...SIM.COL_ORDER].filter(t => (SIM.DEF_TYPES[t] || SIM.COL_TYPES[t]).gal === g).map(t => (SIM.DEF_TYPES[t] || SIM.COL_TYPES[t]).name);
      S.conquest = Math.pow(SIM.CONQ_STEP, g - 1);
      planets.push({ g, sys: SIM.SYSTEMS[PS[g - 1]].name, local: PL[g - 1] + 1, newHere,
        eco, killsPerSec, vMul, tgt: SIM.conquerTarget(g) });
    }
    return { planets, CONQ_STEP: SIM.CONQ_STEP, TOTAL: SIM.TOTAL_PLANETS };
  }, ACTIVE_MAX);

  // compute per-level timelines (active multiplier applied to income)
  const sims = LEVELS.map(lvl => {
    const activeMult = 1 + lvl.frac * (ACTIVE_MAX - 1);
    let conquest = 1, cum = 0; const rows = [];
    for (const p of data.planets) {
      const avgVal = p.eco * p.vMul * conquest;
      const incPerSec = p.killsPerSec * avgVal * activeMult;
      const sec = incPerSec > 0 ? p.tgt / incPerSec : Infinity;
      cum += sec;
      rows.push({ ...p, sec, cum, conquest });
      conquest *= data.CONQ_STEP;
    }
    return { ...lvl, activeMult, rows, total: cum };
  });

  // ---- print 4 tables ----
  for (const sim of sims) {
    console.log(`\n══════════════════════════════════════════════════════════════════════`);
    console.log(`  ${sim.label}   (income ×${sim.activeMult.toFixed(1)})   ·   TOTAL TO FINISH: ${fmtT(sim.total)}`);
    console.log(`══════════════════════════════════════════════════════════════════════`);
    console.log(`  P  System  Planet  Unlocks here          ⚔Conquest   Conquer    Cumulative`);
    console.log(`  ─────────────────────────────────────────────────────────────────────────`);
    const NAMES = ["Vesta","Ember","Cinder","Hearth","Azure","Verdant","Cobalt","Mistral","Halcyon","Tempest","Umbra","Frost","Onyx","Wraith","Pyre","Abyss","Maw","Oblivion"];
    for (const r of sim.rows) {
      const wall = r.local === 1 && r.g > 1 ? ' ◀wall' : '';
      console.log(
        `  ${String(r.g).padStart(2)} ${r.sys.padEnd(6)} ${NAMES[r.g-1].padEnd(8)} ${(r.newHere.join(',')||'—').padEnd(20).slice(0,20)} ×${r.conquest.toExponential(1).padStart(7)}  ${fmtT(r.sec).padStart(7)}   ${fmtT(r.cum).padStart(7)}${wall}`
      );
    }
  }
  console.log('\n' + (errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors'));
  // compact comparison
  console.log('\nTOTAL TIME-TO-FINISH BY ENGAGEMENT:');
  for (const sim of sims) console.log(`  ${sim.label.padEnd(22)} ×${String(sim.activeMult.toFixed(1)).padStart(4)} income  →  ${fmtT(sim.total)}`);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
