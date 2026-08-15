// PROGRESSION AUDIT (v18.51) — measured scaling across the whole campaign.
//
// onearmy-sim answers "does the ladder hold?" from a MODEL of income. This answers
// "what actually happens?" by playing each planet in the real loop and counting the
// money that really banks — then expressing every number in the only unit that lets
// planets be compared to each other: SECONDS OF YOUR OWN INCOME.
//
// The build for each planet is DERIVED, never hardcoded: the player is handed the cash
// they would have earned reaching that planet (the sum of every previous conquer target
// plus this planet's own bar) and it is spent with the game's own buy functions,
// cheapest-first — the same policy onearmy-sim's default player uses. So the audit
// re-derives itself whenever the curves move, and cannot drift from the shipped game.
//
// WHAT IT REPORTS, per planet:
//   income      measured ¤/s, and the ratio to the DESIGNED PASSIVE rate
//               (designed active rate / ACTIVE_MAX — this probe never taps the screen)
//   selection   share of the field's value your guns actually kill
//   collection  share of that your drones actually bank      (income ≈ their product)
//   field       arrivals/s, dots alive, and whether the 550 cap is gating spawns
//   prices      next unit / eco upgrade / tree node, in SECONDS OF INCOME
//   boss        the mini-boss bounty, in seconds of income
//
// The headline is not any single row — it is whether the ratios stay FLAT down the
// table. A flat column means the game scales; a drifting one is a progression bug.
//
//   node tools/progression-audit.js            (--planets 1,2,3,5,8  to pick the set)
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');

const argIdx = process.argv.indexOf('--planets');
const PLANETS = argIdx > -1 && process.argv[argIdx + 1]
  ? process.argv[argIdx + 1].split(',').map(Number).filter(Boolean)
  : [1, 2, 3, 4, 5, 6, 8];
const SETTLE_MS = 40000, WINDOW_MS = 25000;
const ACTIVE_MAX = 8.6;   // the active-vs-idle gap ACTIVE_REF is calibrated to; this probe is passive

async function auditPlanet(browser, g) {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction('!!window.__IDS');
  await page.click('#home-play'); await page.waitForTimeout(400);
  await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });

  const setup = await page.evaluate(({ g }) => {
    const I = window.__IDS, SIM = window.__SIM, S = I.S();
    // stand on planet g with every earlier world taken
    for (const k in S.lv) S.lv[k] = 0;
    for (const t in S.classNodes) S.classNodes[t] = {};
    // ascension-fresh army, exactly what onearmy-sim's resetArmy starts from — a player never
    // stands on a planet with zero guns, and starting empty made P1 bank nothing at all.
    S.units = [{ type: 'turret', cd: 0 }]; S.collectors = [{ type: 'drone' }]; S.vault = {};
    for (let q = 1; q < g; q++) S.vault[q] = { conquered: true, earned: 0, bgRate: 0, mine: 1, mineBuf: 0 };
    S.vault[g] = { conquered: false, earned: 0, bgRate: 0 };
    S.galaxy = g; S.peakGalaxy = g;
    // the purse a player REACHING this planet would have spent: every previous target,
    // minus what the launches cost. Not a sandbox — the real budget, spent the real way.
    // ...plus HALF of this planet's own bar, because a player reinvests as they go: the
    // representative state to measure is mid-planet, not the instant they touch down. Without
    // this, P1's purse is just the cold-open 160×eco and the audit measures the first minute
    // of a brand new game instead of the planet's steady state.
    let purse = 0;
    for (let q = 1; q < g; q++) purse += SIM.conquerTarget(q) - SIM.travelCost(q);
    purse += SIM.conquerTarget(g) * 0.5;
    S.cash = Math.max(SIM.eco(1) * 160, purse);
    I.recompute();
    // cheapest-first, exactly the default onearmy-sim policy, using the game's own gates
    for (let guard = 0; guard < 6000; guard++) {
      let best = Infinity, buy = null;
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
        const ty = SIM.DEF_TYPES[t] || SIM.COL_TYPES[t];
        if (S.peakGalaxy < ty.gal) continue;
        const n = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length;
        if (n >= ty.max) continue;
        const c = SIM.unitBuyCost(t); if (c < best) { best = c; buy = () => I.buyUnit(t); }
      }
      for (const id of ['value', 'spawnRate', 'capacity', 'luck']) {
        const c = SIM.upCost(id); if (c < best) { best = c; buy = () => I.buyUp(id); }
      }
      let boughtNode = false;
      for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
        const n = (SIM.DEF_TYPES[t] ? S.units : S.collectors).filter(u => u.type === t).length;
        if (n === 0) continue;
        for (const nd of (I.buildTree(t).nodes || [])) {
          if (nd.kind === 'start' || I.nodeAllocated(t, nd.id) || !I.nodeAllocatable(t, nd)) continue;
          if (I.nodeCost(t, nd) > best) continue;              // only if it is the CHEAPEST thing available
          const before = S.cash; I.allocNode(t, nd);
          if (S.cash !== before) { boughtNode = true; break; }
        }
        if (boughtNode) break;
      }
      if (boughtNode) continue;
      if (!buy || best > S.cash) break;
      const before = S.cash; buy(); if (S.cash === before) break;
    }
    I.recompute();

    // instrument: tag at spawn, account at death (selection / collection)
    window.__PA = { seq: 0, live: new Map(), spawnN: 0, spawnV: 0, deadN: 0, deadV: 0, on: false };
    window.__PAI = setInterval(() => {
      const T = window.__PA, now = new Set();
      for (const d of I.dots()) {
        if (d.__pa == null) { d.__pa = ++T.seq; T.live.set(d.__pa, d.value || 0); if (T.on) { T.spawnN++; T.spawnV += d.value || 0; } }
        now.add(d.__pa);
      }
      for (const [id, v] of T.live) if (!now.has(id)) { T.live.delete(id); if (T.on) { T.deadN++; T.deadV += v; } }
    }, 8);

    const D = I.derived();
    return {
      units: S.units.length, cols: S.collectors.length,
      nodes: [...SIM.DEF_ORDER, ...SIM.COL_ORDER].reduce((s, t) => s + Object.keys((S.classNodes || {})[t] || {}).length, 0),
      valueLv: S.lv.value | 0, spawnLv: S.lv.spawnRate | 0, capLv: S.lv.capacity | 0,
      leftover: Math.round(S.cash), cap: I.galCap(g),
      tgt: SIM.conquerTarget(g), designedActive: SIM.conquerTarget(g) / (SIM.conquerHours(g) * 3600),
      bossEco: Math.round(SIM.eco(g) * D.valueMul * (D.incomeMul || 1) * 320),
    };
  }, { g });

  await page.waitForTimeout(SETTLE_MS);
  const b0 = await page.evaluate(() => { const T = window.__PA;
    T.on = true; T.spawnN = 0; T.spawnV = 0; T.deadN = 0; T.deadV = 0;
    return { run: window.__IDS.S().totalRun, pop: window.__IDS.META().stats.dotsPopped | 0,
             lost: window.__IDS.META().stats.lostCash || 0, t: performance.now() }; });
  await page.waitForTimeout(WINDOW_MS);
  const r = await page.evaluate(() => { const T = window.__PA, I = window.__IDS, SIM = window.__SIM;
    // cheapest next purchase of each kind, priced now
    let node = Infinity;
    for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
      if ((SIM.DEF_TYPES[t] ? I.S().units : I.S().collectors).filter(u => u.type === t).length === 0) continue;
      for (const nd of (I.buildTree(t).nodes || [])) {
        if (nd.kind === 'start' || I.nodeAllocated(t, nd.id) || !I.nodeAllocatable(t, nd)) continue;
        node = Math.min(node, I.nodeCost(t, nd));
      }
    }
    let unit = Infinity;
    for (const t of [...SIM.DEF_ORDER, ...SIM.COL_ORDER]) {
      const ty = SIM.DEF_TYPES[t] || SIM.COL_TYPES[t];
      if (I.S().peakGalaxy < ty.gal) continue;
      if ((SIM.DEF_TYPES[t] ? I.S().units : I.S().collectors).filter(u => u.type === t).length >= ty.max) continue;
      unit = Math.min(unit, SIM.unitBuyCost(t));
    }
    return { run: I.S().totalRun, pop: window.__IDS.META().stats.dotsPopped | 0,
             lost: window.__IDS.META().stats.lostCash || 0, t: performance.now(),
             spawnN: T.spawnN, spawnV: T.spawnV, deadN: T.deadN, deadV: T.deadV,
             dots: I.dots().length, cps: I.derived().cps || 0,
             priceValue: SIM.upCost('value'), priceSpawn: SIM.upCost('spawnRate'),
             // null, NOT 0 — "every unlocked type is already at its cap of 4" is not a free
             // purchase, and printing it as 0s made the cheapest row in the table a lie.
             priceNode: isFinite(node) ? node : null, priceUnit: isFinite(unit) ? unit : null };
  });
  await page.close();

  const el = (r.t - b0.t) / 1000;
  const banked = (r.run - b0.run) / el;
  const lost = (r.lost - b0.lost) / el;
  const spawnMean = r.spawnN ? r.spawnV / r.spawnN : 0;
  const deadMean = r.deadN ? r.deadV / r.deadN : 0;
  const designedPassive = setup.designedActive / ACTIVE_MAX;
  const secs = v => v == null ? null : (banked > 0 ? v / banked : Infinity);
  return {
    g, setup, errs, banked, lost,
    ratio: banked / designedPassive,
    selection: spawnMean > 0 ? deadMean / spawnMean : 0,
    collection: r.deadV > 0 ? (r.run - b0.run) / r.deadV : 0,
    arrivals: r.spawnN / el, kills: (r.pop - b0.pop) / el, dots: r.dots,
    capped: r.dots >= setup.cap * 0.95,
    rotPct: (banked + lost) > 0 ? lost / (banked + lost) : 0,
    hoursToConquer: banked > 0 ? setup.tgt / banked / 3600 : Infinity,
    secsValue: secs(r.priceValue), secsSpawn: secs(r.priceSpawn),
    secsNode: secs(r.priceNode), secsUnit: secs(r.priceUnit),
    secsBoss: secs(Math.max(setup.bossEco, banked * 20)),
  };
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const rows = [];
  for (const g of PLANETS) { const o = await auditPlanet(browser, g); rows.push(o); }
  await browser.close();

  const pad = (s, n) => String(s).padStart(n);
  const pct = v => (v * 100).toFixed(0) + '%';
  console.log('PROGRESSION AUDIT — every planet played in the real loop, passive (no taps)\n');
  console.log('the build is derived: the purse a player reaching that planet would hold, spent');
  console.log('cheapest-first with the game\'s own buy functions. ratio is vs the DESIGNED PASSIVE');
  console.log('rate (designed active / ' + ACTIVE_MAX + '). What matters is whether the columns stay FLAT.\n');
  console.log('  P | units/cols/nodes | val/spn/cap | measured ¤/s |  ratio | select | collect | arrivals | dots | rot | conquer h');
  for (const r of rows)
    console.log(pad(r.g, 3) + ' | ' + pad(r.setup.units + '/' + r.setup.cols + '/' + r.setup.nodes, 16) +
      ' | ' + pad(r.setup.valueLv + '/' + r.setup.spawnLv + '/' + r.setup.capLv, 11) +
      ' | ' + pad(r.banked.toExponential(2), 12) + ' | ' + pad('×' + r.ratio.toFixed(2), 6) +
      ' | ' + pad(pct(r.selection), 6) + ' | ' + pad(pct(r.collection), 7) +
      ' | ' + pad(r.arrivals.toFixed(1) + '/s', 8) + ' | ' + pad(r.dots + (r.capped ? '*' : ''), 4) +
      ' | ' + pad(pct(r.rotPct), 3) + ' | ' + pad(r.hoursToConquer.toFixed(1), 9));
  console.log('  (* = field pinned at the ' + rows[0].setup.cap + '-dot cap, which BLOCKS further spawns)');

  console.log('\nPRICES, in seconds of the income measured on that planet — flat means affordable-ness scales');
  console.log('  P | next unit | next Value | next Spawn | next node | boss bounty');
  for (const r of rows) {
    const f = v => v == null ? '     —' : !isFinite(v) ? '  never' : v < 6000 ? Math.round(v) + 's' : (v / 3600).toFixed(1) + 'h';
    console.log(pad(r.g, 3) + ' | ' + pad(f(r.secsUnit), 9) + ' | ' + pad(f(r.secsValue), 10) +
      ' | ' + pad(f(r.secsSpawn), 10) + ' | ' + pad(f(r.secsNode), 9) + ' | ' + pad(f(r.secsBoss), 11));
  }

  // drift = how far the worst planet is from the best, per column. Flat is the goal.
  const drift = (key) => { const v = rows.map(r => r[key]).filter(x => x != null && isFinite(x) && x > 0);
    return v.length ? (Math.max(...v) / Math.min(...v)) : 0; };
  console.log('\nDRIFT ACROSS THE CAMPAIGN (max ÷ min — 1.0 is perfectly flat)');
  for (const [k, label] of [['ratio', 'income vs designed'], ['selection', 'selection'], ['collection', 'collection'],
                            ['secsValue', 'Value price in secs'], ['secsNode', 'node price in secs'], ['secsBoss', 'boss bounty in secs']])
    console.log('  ' + label.padEnd(24) + '×' + drift(k).toFixed(1));
  const errs = rows.flatMap(r => r.errs.map(e => 'P' + r.g + ': ' + e));
  console.log(errs.length ? '\nPAGE ERRORS: ' + errs.join(' | ') : '\nno page errors');
})();
