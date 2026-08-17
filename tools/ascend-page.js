// ASCENSION PAGE (v18.57) — the page exists to answer one question and offer one button.
// This gates that, because the failure it was rebuilt from was invisible to every other tool:
// the ASCEND button had drifted to 108% of the way down the scroll and nothing caught it.
//
//   A1  the ASCEND button is ON SCREEN the moment the page opens, at every device size
//   A2  the hero states the haul, and it equals pendingCores() — no separate truth
//   A3  the verdict is present, and says the RIGHT thing in each of three real states
//       (nothing banked / the wall is here / this bar lands soon)
//   A4  the hero's income transform never double-counts cores you can already spend
//       (the bug the rebuild shipped with: it read x3.8 -> x69 when the honest delta was x56 -> x69)
//   A5  the Engine's "your N reach Lv X" matches a full greedy spend, not a 3-row window
//   A6  the evidence sections are FOLDED by default — they must not outrank the verb
//   A7  nothing is clipped by its own box and there are no page errors
//
//   node tools/ascend-page.js            (--shots to also write a screenshot per state)
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.argv.includes('--shots');
const VIEWS = [
  { n: 'Fold closed',   w: 280,  h: 653 },
  { n: 'iPhone SE1',    w: 320,  h: 568 },
  { n: 'iPhone 14 PMx', w: 430,  h: 932 },
  { n: 'phone landsc',  w: 844,  h: 390 },
  { n: 'iPad Pro',      w: 1024, h: 1366 },
];

// three states a real player is actually in when they open this page
const STATES = {
  // nothing taken yet — the page must not pretend there is a decision to make
  fresh: { expect: 'none', fn: () => { const I = window.__IDS, S = I.S(), M = I.META();
    S.galaxy = 1; S.peakGalaxy = 1; S.vault = { 1: { conquered: false, earned: 0 } };
    M.asc = { cores: 0, lv: {}, runs: 0 }; S.minedRun = 0; I.recompute(); } },
  // run 1 at the hop point: three worlds held and the next bar is a 14-hour wall
  wall: { expect: 'go', fn: () => { const I = window.__IDS, S = I.S(), M = I.META(), SIM = window.__SIM;
    S.galaxy = 4; S.peakGalaxy = 4; S.vault = {};
    for (let g = 1; g <= 3; g++) S.vault[g] = { conquered: true, earned: 0, mine: 0 };
    S.vault[4] = { conquered: false, earned: 0 };
    SIM.setEarned(SIM.conquerTarget(4) * 0.4); SIM.setCps(SIM.conquerTarget(4) * 0.6 / (14 * 3600));
    M.asc = { cores: 0, lv: {}, runs: 0 }; S.minedRun = 0; I.recompute(); } },
  // deep veteran, mines running, and this bar lands in ~24 minutes — take it before hopping
  soon: { expect: 'wait', fn: () => { const I = window.__IDS, S = I.S(), M = I.META(), SIM = window.__SIM;
    S.galaxy = 9; S.peakGalaxy = 9; S.vault = {};
    for (let g = 1; g <= 8; g++) S.vault[g] = { conquered: true, earned: 0, mine: g <= 5 ? 1 : 0, mineBuf: 0 };
    S.vault[9] = { conquered: false, earned: 0 };
    SIM.setEarned(SIM.conquerTarget(9) * 0.7); SIM.setCps(SIM.conquerTarget(9) * 0.3 / (0.4 * 3600));
    M.asc = { cores: 340, lv: { engine: 6 }, runs: 3 }; S.minedRun = 41; I.recompute(); } },
};

(async () => {
  const browser = await chromium.launch();
  let bad = 0;

  for (const vp of VIEWS) {
    const lines = [];
    for (const [name, st] of Object.entries(STATES)) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
      await page.goto(URL, { waitUntil: 'load' });
      await page.waitForFunction('!!window.__IDS');
      await page.click('#home-play'); await page.waitForTimeout(320);
      await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });
      await page.evaluate(st.fn); await page.waitForTimeout(120);
      await page.evaluate(() => window.__IDS.openAscend());
      await page.waitForTimeout(360);

      const r = await page.evaluate(() => {
        const I = window.__IDS, S = I.S(), M = I.META();
        const q = s => document.querySelector(s);
        const go = q('#ascend-go'), hero = q('.ax-hero'), vh = window.innerHeight;
        const gr = go ? go.getBoundingClientRect() : null;
        const pend = I.pendingCores();
        const haulTxt = (q('.ax-haul') || {}).textContent || '';
        const haulNum = (haulTxt.match(/[\d.,]+[KMBTqQ]?/) || [''])[0];
        // A4: recompute the honest transform independently of the page
        const ASC_E = 1.25, l = window.__SIM.ASC_BY.engine, lv = I.ascLv('engine'), banked = (M.asc && M.asc.cores) | 0;
        const reach = c => { let n = 0, left = c; while (lv + n < l.max && window.__SIM.ascCost(l, lv + n) <= left) { left -= window.__SIM.ascCost(l, lv + n); n++; } return n; };
        const wantNow = Math.pow(ASC_E, lv + reach(banked)), wantAft = Math.pow(ASC_E, lv + reach(banked + pend));
        const from = (q('.ax-from') || {}).textContent || '', to = (q('.ax-to') || {}).textContent || '';
        // A5: the Engine's reach claim
        const engSub = (q('.ax-eng-sub') || {}).textContent || '';
        const engReachClaim = (engSub.match(/Lv (\d+)/) || [])[1];
        // A7: anything clipped by its own box
        const clipped = [...document.querySelectorAll('#ascend .ax-hero *, #ascend .ax-col, #ascend .ax-step, #ascend .ax-eng-head *, #ascend .ax-dock *')]
          .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length;
        return {
          pend, haulNum, goOnScreen: !!gr && gr.top >= 0 && gr.bottom <= vh + 0.5 && gr.width > 0,
          goTop: gr ? Math.round(gr.top) : -1, vh,
          heroKind: hero ? ['go', 'wait', 'none'].find(k => hero.classList.contains(k)) || '?' : 'NO-HERO',
          verdict: ((document.querySelector('.ax-verdict') || {}).textContent || '').trim().slice(0, 40),
          from, to, wantFrom: '×' + (wantNow < 10 ? Math.round(wantNow * 10) / 10 : Math.round(wantNow)),
          wantTo: '×' + (wantAft < 10 ? Math.round(wantAft * 10) / 10 : Math.round(wantAft)),
          sameMult: Math.abs(wantAft - wantNow) < 1e-9,
          engReachClaim: engReachClaim ? +engReachClaim : null, engWant: lv + reach(banked),
          openDetails: [...document.querySelectorAll('#ascend details')].filter(d => d.open).length,
          totalDetails: document.querySelectorAll('#ascend details').length,
          clipped,
        };
      });

      if (SHOTS) { const c = await page.$('#ascend .card');
        if (c) await c.screenshot({ path: path.resolve(__dirname, '..', 'asc-' + vp.w + '-' + name + '.png') }); }

      const fails = [];
      if (!r.goOnScreen) fails.push('BUTTON OFF SCREEN (top ' + r.goTop + ' of ' + r.vh + ')');
      if (r.pend >= 1 && r.haulNum !== String(r.pend)) fails.push('haul "' + r.haulNum + '" != pending ' + r.pend);
      if (r.heroKind !== st.expect) fails.push('verdict ' + r.heroKind + ', expected ' + st.expect);
      if (!r.verdict) fails.push('no verdict line');
      if (!r.sameMult && (r.from !== r.wantFrom || r.to !== r.wantTo)) fails.push('transform ' + r.from + '->' + r.to + ' should be ' + r.wantFrom + '->' + r.wantTo);
      if (r.engReachClaim != null && r.engReachClaim !== r.engWant) fails.push('engine reach Lv' + r.engReachClaim + ' should be Lv' + r.engWant);
      if (r.openDetails > 0) fails.push(r.openDetails + ' details open by default');
      if (r.clipped) fails.push(r.clipped + ' clipped');
      if (errs.length) fails.push('page errors: ' + errs.join(' | '));
      if (fails.length) bad += fails.length;

      lines.push('    ' + name.padEnd(6) + ' verdict=' + r.heroKind.padEnd(4) +
        ' haul=' + (r.pend >= 1 ? '+' + r.haulNum : '—').padEnd(6) +
        ' ' + (r.sameMult ? (r.from + ' flat').padEnd(14) : (r.from + '->' + r.to).padEnd(14)) +
        ' btn@' + String(r.goTop).padStart(4) + '/' + r.vh +
        ' folded ' + (r.totalDetails - r.openDetails) + '/' + r.totalDetails +
        (fails.length ? '   <-- ' + fails.join('; ') : ''));
      await page.close();
    }
    console.log('  ' + vp.n + ' ' + vp.w + 'x' + vp.h);
    lines.forEach(l => console.log(l));
  }

  await browser.close();
  console.log('\n' + (bad ? 'ASCENSION PAGE GATES FAILED (' + bad + ')' : 'ALL ASCENSION PAGE GATES PASS'));
  process.exit(bad ? 1 : 0);
})();
