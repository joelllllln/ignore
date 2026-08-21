// MIND (◈ intelligence) VALIDATION SIM (v17.6) — does the Mind branch actually change OUTPUT?
//
// Mind is a BEHAVIORAL stat: field-reading (vs nearest-first spray), doomed-target skipping,
// value triage, AoE cluster-seeking — and FIRE DISCIPLINE (v17.6): overshot killing blows burn
// up to 30% of a dot's loot and Mind refunds it. Formula sims (dps ÷ avgHP) are structurally
// blind to all of it — the only honest test is the REAL combat loop, driven at simulated time
// via __SIM.step. For every defender class, on its home planet with an era-typical economy:
//   arm A: mature tree with ZERO pure-Mind nodes    arm B: the same tree + every pure-Mind node
// Both arms replay identical seeded RNG streams (3 seeds, averaged) — unseeded single windows
// swung ±30% on unchanged code from spawn-tier luck alone.
//
// METRIC: value KILLED per second (banked + expired-in-transit + still-in-orbs), NOT banked
// income — the collector fleet is a fixed shared pipeline, and WHICH orbs it happens to reach
// before ORB_LIFE is a lottery that swamps the Mind signal.
//
// GATE M1: every class with a Mind branch must show a MEASURABLE positive killed-value effect
// (>+3% with Mind maxed vs none — else the branch is a trap stat and fails the audit).
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
    // v18.83: measured window doubled, 120s -> 240s. v18.83 made a planet's ARRIVAL field genuinely
    // sparse (fieldMul at the bar's foot went 0.35 -> 0.08, see fieldMulFor), which is the intended
    // design but cut this sim's sample with it: plasma at its home planet now kills ~1.4/s into a
    // crowd of 27, and killed VALUE is heavy-tailed because payout rides (hp/avg)^1.45. Three runs of
    // IDENTICAL code read -11.6%, +48.5% and +61.8% — the gate had become a coin flip. Nothing about
    // the assertion changed; it just needs the kills to back it up.
    const WARM = 400, MEASURE = 4800, DT = 0.05;   // 20s warm-up, 240s measured window
    const SEEDS = [11, 23, 37];                    // paired seeding: both arms replay the SAME random streams, then average —
    // unseeded single windows swung ±30% on UNCHANGED code paths (spawn-tier luck dominates a 90s read)
    const mulberry32 = s => () => { s = (s + 0x6D2B79F5) | 0; let z = s ^ (s >>> 15); z = Math.imul(z, 1 | s); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };

    // NOTE: the live `dots`/`shells` arrays are REASSIGNED every frame (dots = dots.filter(...)),
    // so a captured reference goes stale after ONE step — always read via D.dots() fresh.
    const alive = () => D.dots().filter(d => !d.dead).length;
    function eraSetup(t, push) {
      // `push` = planets past the class's home era. push 0 = the canonical everyday regime (the
      // army keeps up and melts spawns) — v17.6's FIRE DISCIPLINE makes Mind pay there: dumb
      // volleys land with wild overshoot and burn loot, calibrated (◈) classes keep it. push 2
      // = wall regime (info column) where triage/coordination add on top.
      const g = Math.min(SIM.TOTAL_PLANETS || 18, SIM.DEF_TYPES[t].gal + push);
      S.galaxy = g; S.peakGalaxy = g; S.victory = true;                 // victory=true: no conquest fireworks mid-measure
      S.vault = {}; S.conquest = 1; S.travel = null;
      for (const k in S.lv) S.lv[k] = 0;
      S.lv.value = 12 + 2 * (g - 1);                                    // v18.0: era-typical GLOBAL levels (one continuous ladder)
      S.lv.spawnRate = Math.round(10 + 1.5 * (g - 1));
      S.lv.capacity = 60; S.lv.luck = 10;                               // huge ceiling — banking never clamps the metric
      S.units = []; for (let i = 0; i < 4; i++) S.units.push({ type: t, cd: 0 });
      S.collectors = [];                                                // max fleet of every unlocked collector — collection never bottlenecks
      for (const c of SIM.COL_ORDER) if (SIM.COL_TYPES[c].gal <= g) for (let i = 0; i < SIM.COL_TYPES[c].max; i++) S.collectors.push({ type: c });
      S.cash = 0;
      return g;
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
    function runArm(t, nodes, seed, push, reg) {
      eraSetup(t, push);
      Math.random = mulberry32(seed);              // identical stream for both arms of a pair
      S.classNodes[t] = nodes; D.recompute();
      D.dots().length = 0; D.orbs().length = 0;
      // mini-bosses are EXCISED (killed lootlessly at spawn): their dps-scaled bounty is a huge
      // discrete event — one landing inside vs outside the window swamps the per-kill Mind signal
      const deboss = () => { for (const d of D.dots()) if (d.boss) d.dead = true; };
      for (let i = 0; i < WARM; i++) { if (reg.bar) SIM.setEarned(SIM.conquerTarget(S.galaxy) * reg.bar); SIM.step(DT); deboss(); }
      const M = D.META(), backlog = () => D.orbs().reduce((s, o) => s + (o.value || 0), 0);
      const k0 = M.stats.dotsPopped, r0 = S.totalRun, lc0 = M.stats.lostCash, b0 = backlog();
      let crowd = 0, n = 0;
      for (let i = 0; i < reg.measure; i++) { if (reg.bar) SIM.setEarned(SIM.conquerTarget(S.galaxy) * reg.bar); SIM.step(DT); deboss(); if (i % 50 === 0) { crowd += alive(); n++; } }
      // OUTPUT metric = value KILLED per second: banked + expired-in-transit + still-in-orbs.
      // (Gating on banked income alone is a collection LOTTERY — the fleet is a fixed shared
      // pipeline, so which orbs it happens to reach before ORB_LIFE swamps the Mind signal.)
      const killed = (S.totalRun - r0) + (M.stats.lostCash - lc0) + (backlog() - b0);
      return { kills: (M.stats.dotsPopped - k0) / (reg.measure * DT), income: killed / (reg.measure * DT),
        fieldN: crowd / n, int: Math.min(1, D.classStats(t).int) };
    }
    function runAvg(t, nodes, push, reg) {
      let kills = 0, income = 0, int = 0, fieldN = 0;
      for (const s of SEEDS) { const r = runArm(t, nodes, s, push, reg); kills += r.kills; income += r.income; fieldN += r.fieldN; int = r.int; }
      return { kills: kills / SEEDS.length, income: income / SEEDS.length, fieldN: fieldN / SEEDS.length, int };
    }
    // ============ v18.84 BOTH REGIMES, BECAUSE THE TRAP ONLY LIVED IN ONE ============
    // This gate ran the ARRIVAL field only, and a real trap hid behind that for versions: measured on
    // v18.83, turret's Mind was worth +22.5% on a fresh bar and -12.5% once the field filled up. A
    // stat that pays on landing and then quietly turns on you is exactly the thing M1 exists to catch,
    // and one regime could never see it. The crowded pass needs a SHORTER window, not a longer one —
    // it kills 5-10x more per second, so the same statistical power costs less time.
    const REGIMES = [{ k: "arrival", bar: 0, measure: MEASURE }, { k: "crowded", bar: 0.6, measure: 2400 }];
    for (const t of SIM.DEF_ORDER) {
      const { armA, armB, mindCount } = treeArms(t);
      const push = 0;   // canonical everyday regime — where the vast majority of real play happens
      for (const reg of REGIMES) {
        const A = runAvg(t, armA, push, reg);
        const B = runAvg(t, armB, push, reg);
        out.push({ t, reg: reg.k, gal: SIM.DEF_TYPES[t].gal, push, mindCount, intA: A.int, intB: B.int, fieldN: (A.fieldN + B.fieldN) / 2,
          killsA: A.kills, killsB: B.kills, incA: A.income, incB: B.income,
          dKills: A.kills > 0 ? (B.kills / A.kills - 1) * 100 : 0, dInc: A.income > 0 ? (B.income / A.income - 1) * 100 : 0 });
        await new Promise(r => setTimeout(r, 30));
      }
    }
    return out;
  });

  console.log('MIND A/B FIELD EXPERIMENT — real combat loop, 90 simulated seconds per arm, era-typical setups\n');
  console.log('class     home  regime   ◈nodes  int A→B   crowd     kills/s A→B        Δkills    value/s A→B           Δvalue');
  const fails = [];
  for (const x of result) {
    console.log(
      x.t.padEnd(9), ('P' + x.gal).padStart(4), x.reg.padStart(8), String(x.mindCount).padStart(6),
      (Math.round(x.intA * 100) + '%→' + Math.round(x.intB * 100) + '%').padStart(9),
      String(Math.round(x.fieldN)).padStart(5),
      (x.killsA.toFixed(1) + '→' + x.killsB.toFixed(1)).padStart(15),
      ((x.dKills >= 0 ? '+' : '') + x.dKills.toFixed(1) + '%').padStart(8),
      (x.incA.toExponential(2) + '→' + x.incB.toExponential(2)).padStart(20),
      ((x.dInc >= 0 ? '+' : '') + x.dInc.toFixed(1) + '%').padStart(8));
    if (x.mindCount > 0 && x.dInc < 3) fails.push(`M1 ${x.t} (${x.reg} field): Mind maxed adds only ${x.dInc.toFixed(1)}% killed value — trap stat`);
  }
  console.log('\n' + (errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors'));
  console.log(fails.length ? '\nFAIL:\n  ' + fails.join('\n  ') : '\nMIND VERIFIED: every class converts ◈ intelligence into real output');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
