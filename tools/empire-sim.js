// PER-PLANET conquer-time sim that models BOTH active kill-income AND the idle empire
// (the empire was previously invisible to active-sim/playthrough-sim — the M7 tooling gap).
// Drives the REAL game (DPS, eco, targets, IDLE_FRAC cap, empire ramp) via window.__SIM/__IDS.
//   node tools/empire-sim.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/home/user/ignore/node_modules/playwright'); } catch(e2){ console.error('needs playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const LEVELS = [
  { label: '0% active (pure idle: auto-fire + empire)', frac: 0.0 },
  { label: '10% active', frac: 0.10 },
  { label: '35% active', frac: 0.35 },
  { label: '100% active', frac: 1.0 },
];
const fmtT = s => { if (!isFinite(s)) return '—'; const d = s/86400; if (d>=1) return d.toFixed(1)+'d'; const h=s/3600; if (h>=1) return h.toFixed(1)+'h'; const m=s/60; if (m>=1) return m.toFixed(0)+'m'; return Math.round(s)+'s'; };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => {
    const SIM = window.__SIM, D = window.__IDS, S = D.S();
    const VALUE_LV = 18, SPAWN_LV = 14;
    function killIncomePassive(g) {   // defenders auto-firing, NO brushing — the frac=0 baseline (same model as active-sim)
      S.galaxy = g; S.peakGalaxy = Math.max(S.peakGalaxy, g);
      S.lv.value = VALUE_LV; S.lv.spawnRate = SPAWN_LV; S.lv.capacity = 40; S.lv.luck = 10;
      S.units = []; S.collectors = [];
      for (const t of SIM.DEF_ORDER) if (SIM.DEF_TYPES[t].gal <= g) for (let i=0;i<SIM.DEF_TYPES[t].max;i++) S.units.push({type:t,cd:0});
      for (const t of SIM.COL_ORDER) if (SIM.COL_TYPES[t].gal <= g) for (let i=0;i<SIM.COL_TYPES[t].max;i++) S.collectors.push({type:t});
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) { if ((SIM.DEF_TYPES[t]||SIM.COL_TYPES[t]).gal > g) continue;
        S.classNodes[t] = {}; const G = D.buildTree(t), ids = Object.keys(G.map).filter(id=>id!=='start');
        const target = Math.floor(ids.length*0.7); let added=1,guard=0;
        while (added<target && guard++<5000){ let placed=false; for (const id of ids){ if (S.classNodes[t][id]) continue; if (D.nodeAllocatable(t,G.map[id])){ S.classNodes[t][id]=true; added++; placed=true; if (added>=target) break; } } if (!placed) break; } }
      D.recompute();
      let dps=0; for (const u of S.units) dps += D.uDmg(u)*SIM.DEF_TYPES[u.type].rate*D.derived().cls[u.type].rate;
      const hpMul=SIM.enemyHpMul(g), vMul=SIM.valueMul(VALUE_LV), avgHP=18*hpMul*Math.pow(vMul,1.3)*1.3;
      const spawnPerSec=0.9+2.0*SPAWN_LV, killsPerSec=Math.min(dps/avgHP, spawnPerSec*1.2);
      const avgVal=SIM.eco(g)*vMul;   // conquest=1
      return killsPerSec*avgVal;      // passive kill income $/s
    }
    const planets=[];
    for (let g=1; g<=SIM.TOTAL_PLANETS; g++) {
      planets.push({ g, sys: SIM.SYSTEMS[SIM.PLANET_SYS()[g-1]].name, killPassive: killIncomePassive(g),
        baseTarget: SIM.baseTarget(g), eco: SIM.eco(g), conquerHours: SIM.conquerHours(g),
        idleCap: SIM.IDLE_FRAC * SIM.ACTIVE_REF * SIM.eco(g) });
    }
    return { planets, ACTIVE_MAX: 8.6, IDLE_PAYBACK_H: SIM.IDLE_PAYBACK_H, EMPIRE_RAMP: SIM.EMPIRE_RAMP, IDLE_FRAC: SIM.IDLE_FRAC, ACTIVE_REF: SIM.ACTIVE_REF, TOTAL: SIM.TOTAL_PLANETS };
  });

  const NAMES = ["Vesta","Ember","Cinder","Hearth","Azure","Verdant","Cobalt","Mistral","Halcyon","Tempest","Umbra","Frost","Onyx","Wraith","Pyre","Abyss","Maw","Oblivion"];
  // empire rate available WHILE conquering planet g = sum of bgRate(1..g-1) * (1+RAMP*(g-1)); bgRate(k)=baseTarget(k)/(PAYBACK*3600)
  const bgRate = p => p.baseTarget / (data.IDLE_PAYBACK_H * 3600);
  function sim(frac) {
    const mult = 1 + frac * (data.ACTIVE_MAX - 1);
    let cumIdle = 0, total = 0; const rows = [];
    for (let i=0;i<data.planets.length;i++) {
      const p = data.planets[i];
      const empireRaw = cumIdle * (1 + data.EMPIRE_RAMP * i);            // i = planets already conquered
      const empireBar = Math.min(empireRaw, p.idleCap);                 // P4 cap
      const fill = p.killPassive * mult + empireBar;
      const sec = fill > 0 ? p.baseTarget / fill : Infinity;
      total += sec; rows.push({ ...p, sec, empireBar, empireRaw, capped: empireRaw > p.idleCap });
      cumIdle += bgRate(p);                                             // planet p now joins the empire
    }
    return { frac, mult, rows, total };
  }
  console.log(`IDLE_FRAC=${data.IDLE_FRAC}  (pure-idle should be ~${(1/data.IDLE_FRAC).toFixed(1)}× the active time)\n`);
  for (const lvl of LEVELS) {
    const r = sim(lvl.frac);
    console.log(`══ ${lvl.label}  ·  income ×${r.mult.toFixed(1)}  ·  TOTAL ${fmtT(r.total)} ══`);
    console.log('  P  Planet    Sys      conquer   (empire share of bar)');
    for (const row of r.rows) {
      const share = (row.empireBar/(row.killPassive*r.mult+row.empireBar)*100);
      console.log(`  ${String(row.g).padStart(2)} ${NAMES[row.g-1].padEnd(9)} ${row.sys.padEnd(7)} ${fmtT(row.sec).padStart(7)}   ${share.toFixed(0)}%${row.capped?' (capped)':''}`);
    }
    console.log('');
  }
  console.log('SUMMARY @ current IDLE_FRAC=' + data.IDLE_FRAC + ' (total time to conquer all 18):');
  for (const lvl of LEVELS) { const r = sim(lvl.frac); console.log(`  ${lvl.label.padEnd(44)} ${fmtT(r.total)}`); }

  // ---- IDLE_FRAC sweep: how idle strength trades off active-vs-idle pacing ----
  function simIF(frac, idleFrac) {
    const mult = 1 + frac * (data.ACTIVE_MAX - 1);
    let cumIdle = 0, total = 0;
    for (let i=0;i<data.planets.length;i++) { const p = data.planets[i];
      const capBase = data.ACTIVE_REF * p.eco;                          // = ACTIVE_REF*eco(g)  (NOT derived from idleCap — that divides by zero when IDLE_FRAC=0)
      const empireBar = Math.min(cumIdle * (1 + data.EMPIRE_RAMP * i), idleFrac * capBase);
      const fill = p.killPassive * mult + empireBar;
      total += fill > 0 ? p.baseTarget / fill : Infinity;
      cumIdle += bgRate(p);
    }
    return total;
  }
  console.log('\n══ IDLE_FRAC SWEEP — total days to finish (per active level) ══');
  console.log('  IDLE_FRAC   0% idle    10% act    35% act    100% act');
  for (const IF of [0.00, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.20, 0.40]) {
    console.log('   ' + IF.toFixed(2).padEnd(10) + LEVELS.map(l => fmtT(simIF(l.frac, IF)).padStart(8)).join('   '));
  }
  console.log('  (higher IDLE_FRAC = idle carries you faster, but also speeds active play; lower = active stays near the 12d design, idle is slow)');
  console.log('\n' + (errs.length ? 'ERRORS: '+errs.join(' | ') : 'no errors'));
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
