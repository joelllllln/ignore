// MIND (◈ intelligence) VALIDATION SIM (v17.5) — does the Mind branch actually change OUTPUT?
//
// Mind is a BEHAVIORAL stat: overkill-avoidance, shot coordination, value triage. Formula sims
// (dps ÷ avgHP) are structurally blind to it — the only honest test is the REAL combat loop.
// For every defender class this drives the shipped update() at simulated time (__SIM.step) on the
// class's HOME planet, with an era-typical economy and a full collector fleet, and A/B compares:
//   arm A: mature tree with ZERO Mind      arm B: the same tree + every pure-Mind node (int → cap)
// Everything else — units, dots, economy, collectors, RNG regime — is identical. Output metrics are
// the game's own counters over a 90-simulated-second window after a 15s warm-up:
//   kills/sec (META.stats.dotsPopped) and income/sec (S.totalRun).
//
// GATE M1: every class with a Mind branch must show a MEASURABLE positive income effect (>+3%
// with Mind maxed vs none — else the branch is a trap stat and fails the audit).
//
//   node tools/mind-sim.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const result = await page.evaluate(async () => {
    const SIM = window.__SIM, D = window.__IDS, S = D.S();
    const out = [];
    D.setScreen("play");
    const WARM = 300, MEASURE = 1800, DT = 0.05;   // 15s warm-up, 90s measured window

    function eraSetup(t) {
      const g = SIM.DEF_TYPES[t].gal;
      S.galaxy = g; S.peakGalaxy = g; S.victory = true;                 // victory=true: no conquest fireworks mid-measure
      S.vault = {}; S.conquest = 1; S.travel = null;
      for (const k in S.lv) S.lv[k] = 0;
      S.lv.value = (SIM.ECO_BASE.value * (g - 1)) + 18;                 // era-typical committed economy (effective 18/14)
      S.lv.spawnRate = (SIM.ECO_BASE.spawnRate * (g - 1)) + 14;
      S.lv.capacity = 60; S.lv.luck = 10;                               // huge ceiling — banking never clamps the income metric
      S.units = []; for (let i = 0; i < 4; i++) S.units.push({ type: t, cd: 0 });
      S.collectors = [];                                                // max fleet of every unlocked collector — collection never bottlenecks
      for (const c of SIM.COL_ORDER) if (SIM.COL_TYPES[c].gal <= g) for (let i = 0; i < SIM.COL_TYPES[c].max; i++) S.collectors.push({ type: c });
      S.cash = 0;
    }
    // tree split: mature build WITHOUT Mind vs the same + every pure-Mind node
    function treeArms(t) {
      const G = D.buildTree(t), prim = [];
      const isIntNode = n => n.slots && n.slots.length > 0 && n.slots.every(s => {
        if (s.p === "x") return false;
        const key = (SIM.DEF_TYPES[t] ? window.__IDS : null), pr = D.classStats ? null : null;
        return true;   // resolved below via probe
      });
      // probe each node's stat contribution: allocate it alone and diff classStats
      const base = {}, mindIds = [], otherIds = [];
      for (const id in G.map) {
        if (id === "start") continue; const n = G.map[id]; if (!n.slots || !n.slots.length) { otherIds.push(id); continue; }
        S.classNodes[t] = { [id]: true }; D.recompute();
        const st = D.classStats(t);
        const inty = st.int > 0 && st.dmg === 1 && st.rate === 1 && st.range === 0 && st.crit === 0 && st.splash === 1;
        (inty ? mindIds : otherIds).push(id);
      }
      // arm A: ~70% of non-Mind nodes (cheap-connected walk not needed — stats sum regardless)
      const armA = {}; const take = Math.floor(otherIds.length * 0.7);
      otherIds.slice(0, take).forEach(id => armA[id] = true);
      const armB = Object.assign({}, armA); mindIds.forEach(id => armB[id] = true);
      return { armA, armB, mindCount: mindIds.length };
    }
    function runArm(t, nodes) {
      S.classNodes[t] = nodes; D.recompute();
      const dotsArr = D.dots(), orbsArr = D.orbs(); dotsArr.length = 0; orbsArr.length = 0;
      for (let i = 0; i < WARM; i++) SIM.step(DT);
      const k0 = D.META().stats.dotsPopped, r0 = S.totalRun;
      for (let i = 0; i < MEASURE; i++) SIM.step(DT);
      return { kills: (D.META().stats.dotsPopped - k0) / (MEASURE * DT), income: (S.totalRun - r0) / (MEASURE * DT), int: Math.min(1, D.classStats(t).int) };
    }
    for (const t of SIM.DEF_ORDER) {
      const { armA, armB, mindCount } = treeArms(t);
      eraSetup(t); const A = runArm(t, armA);
      eraSetup(t); const B = runArm(t, armB);
      out.push({ t, gal: SIM.DEF_TYPES[t].gal, mindCount, intA: A.int, intB: B.int,
        killsA: A.kills, killsB: B.kills, incA: A.income, incB: B.income,
        dKills: A.kills > 0 ? (B.kills / A.kills - 1) * 100 : 0, dInc: A.income > 0 ? (B.income / A.income - 1) * 100 : 0 });
      await new Promise(r => setTimeout(r, 30));
    }
    return out;
  });

  console.log('MIND A/B FIELD EXPERIMENT — real combat loop, 90 simulated seconds per arm, era-typical setups\n');
  console.log('class     home  ◈nodes  int A→B     kills/s A→B        Δkills    income/s A→B          Δincome');
  const fails = [];
  for (const x of result) {
    console.log(
      x.t.padEnd(9), ('P' + x.gal).padStart(4), String(x.mindCount).padStart(6),
      (Math.round(x.intA * 100) + '%→' + Math.round(x.intB * 100) + '%').padStart(9),
      (x.killsA.toFixed(1) + '→' + x.killsB.toFixed(1)).padStart(15),
      ((x.dKills >= 0 ? '+' : '') + x.dKills.toFixed(1) + '%').padStart(8),
      (x.incA.toExponential(2) + '→' + x.incB.toExponential(2)).padStart(20),
      ((x.dInc >= 0 ? '+' : '') + x.dInc.toFixed(1) + '%').padStart(8));
    if (x.mindCount > 0 && x.dInc < 3) fails.push(`M1 ${x.t}: Mind maxed adds only ${x.dInc.toFixed(1)}% income — trap stat`);
  }
  console.log('\n' + (errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors'));
  console.log(fails.length ? '\nFAIL:\n  ' + fails.join('\n  ') : '\nMIND VERIFIED: every class converts ◈ intelligence into real output');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
