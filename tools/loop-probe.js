// LOOP PROBE (v18.47) — the sim that actually PLAYS the game.
//
// Every other tool in here models income analytically: onearmy-sim computes
// `min(dps/avgHP, spawn×1.2) × avgVal`, which prices every kill at the AVERAGE dot.
// Real kills range from 3¤ to 105¤ on the same planet depending on your build, so that
// model is blind to an entire class of failure — it reported ALL GATES PASS on a build
// measured at 8% of curve. This probe runs the real requestAnimationFrame loop in headless
// Chromium, buys real things with the game's own functions, and counts money that actually
// banks. Slower than the analytic sims (~1 min/case) and NOT a replacement for them: they
// gate the ladder, this one gates the two things they cannot see.
//
// It decomposes income into the two factors that actually predict it:
//   SELECTION  = mean value of the dots that DIE / mean value of the dots that SPAWN
//                (your guns' reach and damage — what share of the field's money you can take)
//   COLLECTION = ¤ banked / nominal ¤ of what died
//                (your drones — what share of that money you actually pick up)
// Income is their PRODUCT. Knock either down and the other stops mattering, which is why
// a maxed-gun / no-drone build banks 19% and a maxed-drone / no-gun build reaches 10%.
//
// GATES
//   L1 a build with BOTH trees selects ≥ 80% and collects ≥ 80%   (the intended build works)
//   L2 a guns-only build's COLLECTION is visibly bad (< 50%)      (the trap still exists to warn about…)
//   L3 …and the game SAYS so — the loot-rot HUD line is showing   (…and v18.47's warning fires)
//   L4 a warden's maxHp NEVER rises mid-duel, even if you finger-draw through the
//      calibration window                                        (the v18.50 heal bug)
//
//   node tools/loop-probe.js            (add --verbose for the per-case table)
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');

const TREES = ['turret', 'mortar', 'drone'];
const CASES = [
  { key: 'both',  trees: ['turret', 'mortar', 'drone'], label: 'guns + drones (the intended build)' },
  { key: 'guns',  trees: ['turret', 'mortar'],          label: 'guns only, drone tree neglected' },
  { key: 'none',  trees: [],                            label: 'no trees at all' },
];
const SETTLE_MS = 45000, WINDOW_MS = 25000;

async function runCase(browser, c) {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction('!!window.__IDS');
  await page.click('#home-play'); await page.waitForTimeout(400);
  await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });

  await page.evaluate(({ c, TREES }) => {
    const I = window.__IDS, S = I.S();
    S.vault[1] = { conquered: true, earned: 0, bgRate: 0, mine: 1, mineBuf: 0 };
    S.galaxy = 2; S.peakGalaxy = 2; S.vault[2] = { conquered: false, earned: 0, bgRate: 0 };
    S.cash = 1e18; I.recompute();
    for (const t of ['turret', 'mortar']) for (let i = 0; i < 8; i++) I.buyUnit(t);   // buyUnit caps at 4/type
    for (let i = 0; i < 8; i++) I.buyUnit('drone');
    for (let i = 0; i < 60 && I.derived().capacity < 1e12; i++) I.buyUp('capacity');
    while ((S.lv.value | 0) < 40) I.buyUp('value');
    while ((S.lv.spawnRate | 0) < 40) I.buyUp('spawnRate');
    // real allocation path: nodeAllocatable(type, NODE) -> allocNode(type, NODE). allocNode returns
    // undefined on every path, so progress is counted off S.classNodes, never off its return value.
    for (let pass = 0; pass < 200 && c.trees.length; pass++) {
      const count = () => c.trees.reduce((s, t) => s + Object.keys((S.classNodes || {})[t] || {}).length, 0);
      const before = count();
      for (const t of c.trees) for (const n of (I.buildTree(t).nodes || [])) {
        if (n.kind === 'start' || I.nodeAllocated(t, n.id) || !I.nodeAllocatable(t, n)) continue;
        S.cash = 1e18; try { I.allocNode(t, n); } catch (e) {}
      }
      if (count() === before) break;
    }
    S.cash = 1e18; I.recompute();
    // tag every dot at spawn, account for it when it leaves — that is what splits selection from collection
    window.__LP = { seq: 0, live: new Map(), spawnN: 0, spawnV: 0, deadN: 0, deadV: 0, on: false };
    window.__LPI = setInterval(() => {
      const T = window.__LP, now = new Set();
      for (const d of I.dots()) {
        if (d.__lp == null) { d.__lp = ++T.seq; T.live.set(d.__lp, d.value || 0); if (T.on) { T.spawnN++; T.spawnV += d.value || 0; } }
        now.add(d.__lp);
      }
      for (const [id, v] of T.live) if (!now.has(id)) { T.live.delete(id); if (T.on) { T.deadN++; T.deadV += v; } }
    }, 8);
  }, { c, TREES });

  await page.waitForTimeout(SETTLE_MS);
  const b0 = await page.evaluate(() => { const T = window.__LP;
    T.on = true; T.spawnN = 0; T.spawnV = 0; T.deadN = 0; T.deadV = 0;
    return { run: window.__IDS.S().totalRun, t: performance.now() }; });
  await page.waitForTimeout(WINDOW_MS);
  const r = await page.evaluate(() => { const T = window.__LP, el = document.getElementById('ui-leak');
    return { run: window.__IDS.S().totalRun, t: performance.now(),
             spawnN: T.spawnN, spawnV: T.spawnV, deadN: T.deadN, deadV: T.deadV,
             leakShown: !!(el && el.classList.contains('show')), leakText: el ? el.textContent : '',
             nodes: ['turret', 'mortar', 'drone'].reduce((s, t) => s + Object.keys((window.__IDS.S().classNodes || {})[t] || {}).length, 0) }; });
  await page.close();

  const el = (r.t - b0.t) / 1000;
  const spawnMean = r.spawnN ? r.spawnV / r.spawnN : 0;
  const deadMean = r.deadN ? r.deadV / r.deadN : 0;
  return {
    key: c.key, label: c.label, nodes: r.nodes, errs,
    banked: (r.run - b0.run) / el,
    selection: spawnMean > 0 ? deadMean / spawnMean : 0,
    collection: r.deadV > 0 ? (r.run - b0.run) / r.deadV : 0,
    leakShown: r.leakShown, leakText: r.leakText,
  };
}

// L4: drive a real warden duel while drawing through the 1s-5s calibration window — the exact input
// that used to make the keeper re-size its pool UPWARD and become unkillable.
async function wardenDuel(browser) {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction('!!window.__IDS');
  await page.click('#home-play'); await page.waitForTimeout(400);
  await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });
  const r = await page.evaluate(async () => {
    const I = window.__IDS, S = I.S();
    S.galaxy = 1; S.peakGalaxy = 1; S.cash = 1e12; I.recompute();
    for (let i = 0; i < 4; i++) I.buyUnit('turret');
    for (let i = 0; i < 2; i++) I.buyUnit('drone');
    while ((S.lv.value | 0) < 8) I.buyUp('value');
    S.cash = 1e12; I.recompute();
    I.earn(window.__SIM.conquerTarget(1));
    if (!I.summonWarden()) return { err: 'summonWarden refused' };
    const t0 = performance.now();
    let peakMax = 0, openMax = 0, maxRise = 0, hpRise = 0, prevMax = 0, prevHp = 0;
    for (let i = 0; i < 150; i++) {
      const d = I.dots().find(x => x.boss); if (!d) break;
      const el = (performance.now() - t0) / 1000;
      if (el > 1.0 && el < 5.0) I.brushAt(d.x, d.y);           // draw straight through the sample window
      if (!openMax) openMax = d.maxHp;
      if (prevMax) { maxRise = Math.max(maxRise, d.maxHp - prevMax); hpRise = Math.max(hpRise, d.hp - prevHp); }
      prevMax = d.maxHp; prevHp = d.hp; peakMax = Math.max(peakMax, d.maxHp);
      await new Promise(res => setTimeout(res, 100));
    }
    return { openMax: Math.round(openMax), peakMax: Math.round(peakMax),
             maxRise: Math.round(maxRise), hpRise: Math.round(hpRise) };
  });
  await page.close();
  return { ...r, errs };
}

(async () => {
  const verbose = process.argv.includes('--verbose');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const out = {};
  console.log('LOOP PROBE — real loop, real purchases, money that actually banks (P2, passive)\n');
  if (verbose) console.log('build                                 | nodes | selection | collection | banked ¤/s | rot warning');
  for (const c of CASES) {
    const o = await runCase(browser, c);
    out[o.key] = o;
    if (verbose) console.log(o.label.padEnd(37) + ' | ' + String(o.nodes).padStart(5) + ' | ' +
      ((o.selection * 100).toFixed(0) + '%').padStart(9) + ' | ' + ((o.collection * 100).toFixed(0) + '%').padStart(10) +
      ' | ' + Math.round(o.banked).toLocaleString().padStart(10) + ' | ' + (o.leakShown ? o.leakText : '—'));
  }
  const wd = await wardenDuel(browser);
  await browser.close();

  const fails = [];
  if (wd.err) fails.push('L4 ' + wd.err);
  else {
    if (verbose) console.log('\nwarden duel (drawing through calibration): opens ' + wd.openMax.toLocaleString() +
      ' · peak maxHp ' + wd.peakMax.toLocaleString() + ' · biggest maxHp rise ' + wd.maxRise.toLocaleString());
    // regen (0.012/s, by design) makes hp tick up between hits, so only maxHp is asserted flat.
    if (wd.maxRise > 1) fails.push(`L4 warden maxHp ROSE by ${wd.maxRise.toLocaleString()} mid-duel — the pool must only ever shrink`);
    if (wd.peakMax > wd.openMax + 1) fails.push(`L4 warden peak maxHp ${wd.peakMax.toLocaleString()} exceeded its opening pool ${wd.openMax.toLocaleString()}`);
  }
  for (const e of wd.errs || []) fails.push('page error [warden]: ' + e);
  const both = out.both, guns = out.guns;
  if (!(both.selection >= 0.80)) fails.push(`L1 both-tree selection ${(both.selection * 100).toFixed(0)}% < 80% — guns cannot reach the field's value`);
  if (!(both.collection >= 0.80)) fails.push(`L1 both-tree collection ${(both.collection * 100).toFixed(0)}% < 80% — drones cannot bank what dies`);
  if (!(guns.collection < 0.50)) fails.push(`L2 guns-only collection ${(guns.collection * 100).toFixed(0)}% — expected the neglected-drone trap to be visible here`);
  else if (!guns.leakShown) fails.push('L3 guns-only is losing most of its loot and the HUD rot warning did NOT show');
  for (const k in out) for (const e of out[k].errs) fails.push(`page error [${k}]: ${e}`);

  console.log('');
  for (const k of ['both', 'guns', 'none']) {
    const o = out[k];
    console.log('  ' + o.label.padEnd(37) + ' selection ' + (o.selection * 100).toFixed(0).padStart(3) + '%  ×  collection ' +
      (o.collection * 100).toFixed(0).padStart(3) + '%  =  ' + Math.round(o.banked).toLocaleString().padStart(6) + ' ¤/s' +
      (o.leakShown ? '   [warned]' : ''));
  }
  console.log('');
  if (fails.length) { for (const f of fails) console.log('FAIL: ' + f); process.exit(1); }
  console.log('ALL LOOP-PROBE GATES PASS');
})();
