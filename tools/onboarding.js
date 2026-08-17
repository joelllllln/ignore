// ONBOARDING (v18.60) — can a new player act, and does the game teach itself?
//
// This exists because the failure it was written for was invisible to every other tool. Measured on
// a virgin save before the change: 28 interactive controls on screen of which exactly ONE was
// affordable; four of six defence rows were locked adverts for planets hours away, each still
// offering a ⬆ Tree button for a unit you cannot buy; a ten-step, 331-word tutorial (~100 seconds of
// reading) delivered before the first dot died, with PRESTIGE taught at step 9; and a field that
// killed 2 of 28 spawned dots in 31 seconds because everything was still walking in from the rim.
//
//   O1  a virgin save shows at most MAX_CTL interactive controls
//   O2  locked classes render no row at all — just one honest "N more unlock as you travel" line
//   O3  the ⬆ Tree button never appears for a class you own none of
//   O4  the objective line is present, and it CHANGES once you satisfy it
//   O5  the opening tutorial is at most MAX_TUT steps
//   O6  the field is already populated on arrival (the seed) — no walk-in dead zone
//   O7  the conquer ETA is either absent or believable; it must never print a three-digit hour count
//   O8  reveals are STICKY — a feature that has appeared must never disappear again
//   O9  no page errors anywhere in the run
//   O10 the ECONOMY tab is reachable from the FIRST FRAME. v18.60 gated it and that was wrong —
//       at second zero all four economy upgrades are affordable (40/54/117/140 against 400 cash)
//       while the only visible alternative costs 393, so hiding it removed the affordable actions
//       rather than the complexity. This gate stops that from coming back.
//   --- v18.62, the pre-existing systems this all had to be adapted to ---
//   O11 the objective is VISIBLE during the first-run tutorial. The tutorial's second step talks
//       about it, so hiding it there made the tutorial contradict itself on screen.
//   O12 only ONE teaching UI at a time — the just-in-time coach must not paint over the tutorial.
//   O13 the settlement panel replaces the shop, so the objective and abilities stand down with it,
//       and un-settling must NOT un-hide abilities the reveal gate deliberately hid (the settle
//       block used to set display:"" on #abilities every transition and fight the gate).
//   O14 a save written BEFORE progressive reveal existed must not be re-onboarded. META.seen is
//       absent on every pre-v18.60 save, so a returning player would load in to find their
//       COLLECTORS tab, abilities and ascend button gone after hours of play.
//
//   node tools/onboarding.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const MAX_CTL = 12;      // Cookie Clicker opens with one button; a dozen is already generous
const MAX_TUT = 3;
const VIEWS = [{ n: 'Fold closed', w: 280, h: 653 }, { n: 'iPhone SE1', w: 320, h: 568 }, { n: 'iPhone 14 PMx', w: 430, h: 932 }];

const visibleControls = () => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05
      && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0; };
  return [...document.querySelectorAll('#root button, #root .tab, #root .ab')].filter(vis);
};

(async () => {
  const browser = await chromium.launch();
  let bad = 0;

  // ── O14: a veteran save from before progressive reveal existed ───────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    // planted BEFORE boot: the live page re-saves on unload and would clobber a post-hoc write
    await ctx.addInitScript(() => {
      const S = { v18: 1, ecoS: 1, cash: 5e6, galaxy: 4, peakGalaxy: 4, lv: { value: 30, spawnRate: 28, capacity: 34, luck: 12 },
        classNodes: { turret: { a1: 1, a2: 1 } }, units: [{ type: 'turret' }, { type: 'turret' }, { type: 'mortar' }],
        collectors: [{ type: 'drone' }, { type: 'drone' }], totalRun: 5e6, runSec: 9000,
        vault: { 1: { conquered: true }, 2: { conquered: true }, 3: { conquered: true }, 4: { conquered: false, earned: 0 } },
        travel: null, conquest: 1, victory: false, auto: {} };
      const META = { totalEver: 9e6, stats: {}, opts: {}, tutorialDone: true,
        asc: { cores: 120, lv: { engine: 4 }, runs: 2, best: 5, lifetime: 300, v: 3 } };   // NOTE: no `seen`
      try { localStorage.setItem('ids_clone.v3', JSON.stringify({ S, META })); } catch (e) {}
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('!!window.__IDS');
    await page.click('#home-play'); await page.waitForTimeout(600);
    const vet = await page.evaluate(() => {
      const I = window.__IDS;
      const vis = sel => { const e = document.querySelector(sel); if (!e) return false;
        return getComputedStyle(e.closest('.tslot') || e).display !== 'none'; };
      return { loaded: I.S().peakGalaxy, keys: ['collect', 'tree', 'eco', 'abil', 'ascend'].filter(k => I.revealed(k)),
        collectTab: vis('.tab[data-tab="drone"]'), abil: vis('#abilities'), ascend: vis('#btn-ascend') };
    });
    const f = [];
    if (vet.loaded !== 4) f.push('the planted veteran save did not load (peakGalaxy ' + vet.loaded + ')');
    else {
      if (vet.keys.length < 5) f.push('veteran save re-onboarded — only revealed: ' + (vet.keys.join(',') || 'nothing'));
      if (!vet.collectTab) f.push('veteran lost the COLLECTORS tab');
      if (!vet.abil) f.push('veteran lost abilities');
      if (!vet.ascend) f.push('veteran lost the ascend button');
    }
    bad += f.length;
    console.log('  ' + 'veteran save (pre-v18.60)'.padEnd(24) + 'P' + vet.loaded + '  revealed ' + vet.keys.length + '/5' +
      '  tabs ' + (vet.collectTab ? 'y' : 'N') + ' abil ' + (vet.abil ? 'y' : 'N') + ' ascend ' + (vet.ascend ? 'y' : 'N'));
    f.forEach(x => console.log('      <-- ' + x));
    await page.close();
  }

  for (const vp of VIEWS) {
    const page = await (await browser.newContext({ viewport: { width: vp.w, height: vp.h } })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('!!window.__IDS');
    const tutLen = await page.evaluate(() => (window.__IDS.TUT_LEN || 0));
    await page.click('#home-play'); await page.waitForTimeout(700);
    await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });
    await page.waitForTimeout(500);

    const t0 = await page.evaluate(vc => {
      const f = new Function('return (' + vc + ')()');
      const ctl = f();
      const rows = [...document.querySelectorAll('#up-list .up')];
      const treeOnUnowned = rows.filter(r => {
        const up = r.querySelector('.u-up'); if (!up || getComputedStyle(up).display === 'none') return false;
        const d = (r.querySelector('.u-desc') || {}).textContent || '';
        return /^0\//.test(d.trim());
      }).length;
      const lockedRows = rows.filter(r => /from P\d/.test((r.querySelector('.u-buy') || {}).textContent || '')).length;
      const ecoTab = document.querySelector('.tab[data-tab="eco"]');
      const ecoVisible = !!ecoTab && getComputedStyle(ecoTab.closest('.tslot') || ecoTab).display !== 'none';
      const ob = document.querySelector('#objective');
      return { ecoVisible, controls: ctl.length, labels: ctl.map(b => (b.textContent || '').trim().slice(0, 14)),
        rows: rows.length, lockedRows, treeOnUnowned,
        moreLine: !!document.querySelector('.up-more'),
        objShown: !!(ob && ob.classList.contains('show')),
        objText: ((document.querySelector('#objective .ob-t') || {}).textContent || '').trim(),
        dots: window.__IDS.dots().length,
        travel: (document.querySelector('#btn-travel') || {}).textContent || '' };
    }, visibleControls.toString());

    // O11/O12 — with the tutorial up: objective visible, coach silent
    const tut = await page.evaluate(() => new Promise(res => {
      const I = window.__IDS;
      I.META().tutorialDone = false;
      const t = document.querySelector('#set-tutorial'); if (t) t.click();
      setTimeout(() => {
        const ob = document.querySelector('#objective'), co = document.querySelector('#coach');
        res({ tutUp: !!document.querySelector('#tutorial.show'),
              objShown: !!(ob && ob.classList.contains('show')),
              coachShown: !!(co && co.classList.contains('show')) });
      }, 900);
    }));
    await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });
    await page.waitForTimeout(300);

    // O13 — settle the world, then un-settle, and check nobody clobbered the reveal gate
    const settle = await page.evaluate(async () => {
      const I = window.__IDS, S = I.S();
      const vis = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
      const abilBefore = vis('#abilities');                          // hidden on a virgin save
      S.vault[S.galaxy] = { conquered: true, earned: 0 }; I.recompute(); I.syncHUD();
      await new Promise(r => setTimeout(r, 250));
      const ob = document.querySelector('#objective');
      const onSettle = { obj: !!(ob && ob.classList.contains('show')), abil: vis('#abilities') };
      S.vault[S.galaxy] = { conquered: false, earned: 0 }; I.recompute(); I.syncHUD();
      await new Promise(r => setTimeout(r, 120)); I.syncHUD();
      return { abilBefore, onSettle, abilAfter: vis('#abilities') };
    });

    // O4 — satisfy the objective and check it moves on
    const obj2 = await page.evaluate(() => { const I = window.__IDS, S = I.S();
      S.cash = 1e9; I.buyUnit('turret'); I.syncHUD();
      return ((document.querySelector('#objective .ob-t') || {}).textContent || '').trim(); });

    // O8 — reveals are sticky: force one on, then remove its cause, and it must stay
    const sticky = await page.evaluate(() => { const I = window.__IDS, S = I.S();
      S.collectors.push({ type: 'drone' }); S.collectors.push({ type: 'drone' }); I.syncHUD();
      const on = !!I.revealed('collect');
      S.collectors.length = 1; I.syncHUD();                      // cause removed
      const slot = document.querySelector('.tab[data-tab="drone"]');
      const still = slot ? getComputedStyle(slot.closest('.tslot') || slot).display !== 'none' : false;
      return { on, still }; });

    const fails = [];
    if (t0.controls > MAX_CTL) fails.push(t0.controls + ' controls at t=0 (max ' + MAX_CTL + '): ' + t0.labels.join('/'));
    if (!t0.ecoVisible) fails.push('ECONOMY tab hidden at t=0 — its upgrades are the cheapest buys in the game');
    if (t0.lockedRows > 0) fails.push(t0.lockedRows + ' locked class rows rendered');
    if (t0.rows > 1 && !t0.moreLine) fails.push('locked classes hidden but no "more unlock" line');
    if (t0.treeOnUnowned > 0) fails.push(t0.treeOnUnowned + ' Tree buttons on unowned classes');
    if (tutLen > MAX_TUT) fails.push('tutorial is ' + tutLen + ' steps (max ' + MAX_TUT + ')');
    if (!t0.objShown || !t0.objText) fails.push('no objective line on a virgin save');
    if (obj2 === t0.objText) fails.push('objective did not advance after being satisfied ("' + obj2 + '")');
    if (t0.dots < 4) fails.push('field had only ' + t0.dots + ' dots on arrival — the seed did not fire');
    { const m = t0.travel.match(/~\s*(\d+(?:\.\d+)?)h/);
      if (m && +m[1] > 24) fails.push('conquer bar advertises a ' + m[1] + 'h ETA'); }
    if (!sticky.on) fails.push('reveal did not fire when its condition was met');
    if (sticky.on && !sticky.still) fails.push('a revealed feature DISAPPEARED again — reveals must be sticky');
    if (!tut.tutUp) fails.push('could not reopen the tutorial to test it');
    if (tut.tutUp && !tut.objShown) fails.push('objective HIDDEN during the tutorial that talks about it');
    if (tut.tutUp && tut.coachShown) fails.push('coach painted over the tutorial — two teaching UIs at once');
    if (settle.onSettle.obj) fails.push('objective still shown over the settlement panel');
    if (settle.onSettle.abil) fails.push('abilities still shown over the settlement panel');
    if (!settle.abilBefore && settle.abilAfter) fails.push('un-settling UN-HID abilities the reveal gate had hidden');
    if (errs.length) fails.push('page errors: ' + errs.join(' | '));
    bad += fails.length;

    console.log('  ' + (vp.n + ' ' + vp.w + 'x' + vp.h).padEnd(24) +
      'ctl ' + String(t0.controls).padStart(2) + '/' + MAX_CTL +
      '  rows ' + t0.rows + (t0.moreLine ? '+more' : '') +
      '  tut ' + tutLen +
      '  dots@land ' + String(t0.dots).padStart(2) +
      '  obj "' + t0.objText.slice(0, 22) + '" -> "' + obj2.slice(0, 22) + '"' +
      '  eco ' + (t0.ecoVisible ? 'shown' : 'HIDDEN') +
      '  tut[obj ' + (tut.objShown ? 'y' : 'N') + ' coach ' + (tut.coachShown ? 'ON' : 'off') + ']' +
      '  settle[' + (settle.onSettle.obj || settle.onSettle.abil ? 'LEAK' : 'clean') + ']' +
      '  sticky ' + (sticky.on && sticky.still ? 'ok' : 'NO'));
    fails.forEach(f => console.log('      <-- ' + f));
    await page.close();
  }

  await browser.close();
  console.log('\n' + (bad ? 'ONBOARDING GATES FAILED (' + bad + ')' : 'ALL ONBOARDING GATES PASS'));
  process.exit(bad ? 1 : 0);
})();
