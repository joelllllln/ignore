// MILESTONE CHECK (v18.56) — every economy upgrade now withholds part of its growth and repays it
// in a lump every MILE_LEG legacy levels. The owner's constraint was "keep the scaling pretty much
// exactly the same", which is a claim that can be measured rather than asserted, so this measures it,
// and then checks the UI that sells the lump is actually wired to all four rows.
//
// PART 1 — SCALING (the constraint)
//   M1  at every milestone rung, each stat equals the pre-milestone formula EXACTLY
//   M2  between milestones a stat may only ever be BEHIND, never ahead
//   M3  the worst mid-leg lag is at most MILE_SHARE*(MILE_LEG - 1/ECO_STEP) legacy levels
//       (1/ECO_STEP, not 1 — above ECO_FINE_FROM a rung is a FRACTION of a legacy level, so the
//        rung just short of a lump sits half a level back, not a whole one)
//   M4  no stat ever backslides as its level rises
//
// PART 2 — UI (the payoff)
//   M5  every eco row's --mile charge rises across a leg and RESETS after the lump: a cycle, not a fill
//   M6  every eco row reaches mile-ready and shows its MILESTONE chip before the lump
//   M7  every eco row's description carries a ✦ countdown, and it counts DOWN
//   M8  buying through a lump paints a banner NAMING THAT STAT — read off canvas fillText, which is
//       where floatTxt actually lands, so a silently-broken banner cannot pass
//   M9  no row's text is clipped by its own box, on a normal phone and on the narrowest screen
//
//   node tools/milestone-check.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');

const IDS = ['capacity', 'value', 'spawnRate', 'luck'];
const LABEL = { capacity: 'capacity', value: 'value', spawnRate: 'spawn', luck: 'luck' };
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const VIEWS = [{ n: 'iPhone 14 ProMax', w: 430, h: 932 }, { n: 'Fold closed', w: 280, h: 653 }];

const pad = (s, n) => String(s).padStart(n);

(async () => {
  const browser = await chromium.launch();
  let bad = 0;

  // ── PART 1: the scaling constraint ───────────────────────────────────────────────────────────
  {
    const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('!!window.__SIM');
    const out = await page.evaluate(() => {
      const SIM = window.__SIM, LEG = SIM.MILE_LEG, SHARE = SIM.MILE_SHARE;
      // the pre-milestone curves, verbatim — the thing "same scaling" is measured against
      const OLD = {
        value:     r => 1 + 0.13 * SIM.legacyLv(r),
        spawnRate: r => 0.9 + 1.15 * SIM.legacyLv(r),
        capacity:  r => Math.pow(1.60, SIM.legacyLv(r)),
        luck:      r => 0.003 * SIM.legacyLv(r),
      };
      const NEW = { value: SIM.valueMul, spawnRate: SIM.spawnFromLv, capacity: SIM.capFromLv, luck: SIM.luckFromLv };
      // invert each stat's OWN curve, so an additive stat's lag and a geometric stat's lag are both
      // expressed in legacy levels and are therefore directly comparable
      const LAG = {
        value:     nw => (nw - 1) / 0.13,
        spawnRate: nw => (nw - 0.9) / 1.15,
        capacity:  nw => Math.log(nw) / Math.log(1.60),
        luck:      nw => nw / 0.003,
      };
      const rows = [];
      for (const id of ['value', 'spawnRate', 'capacity', 'luck']) {
        let hits = 0, miss = 0, worstLag = 0, ahead = 0, backslide = 0, prev = -Infinity;
        for (let r = 0; r <= 400; r++) {
          const L = SIM.legacyLv(r), nw = NEW[id](r), od = OLD[id](r);
          if (nw < prev - 1e-12) backslide++;
          prev = nw;
          if (Math.abs(L % LEG) < 1e-9) { if (Math.abs(nw - od) <= Math.abs(od) * 1e-12) hits++; else miss++; }
          const lag = L - LAG[id](nw);
          if (lag < -1e-9) ahead++;
          if (lag > worstLag) worstLag = lag;
        }
        rows.push({ id, hits, miss, worstLag: +worstLag.toFixed(6), ahead, backslide });
      }
      const jumps = {};
      for (const id of ['value', 'spawnRate', 'capacity', 'luck']) {
        const r = SIM.rungLv(40), before = NEW[id](r - 1), after = NEW[id](r);
        jumps[id] = { before, after, ratio: before > 0 ? after / before : Infinity };
      }
      return { rows, jumps, LEG, SHARE, bound: SHARE * (LEG - 1 / SIM.ECO_STEP) };
    });
    await page.close();

    console.log('MILESTONE CHECK — scaling first, because "keep the scaling the same" is the constraint\n');
    console.log('  MILE_LEG ' + out.LEG + '   MILE_SHARE ' + out.SHARE + '   worst permitted lag ' + out.bound + ' legacy levels\n');
    console.log('  stat        | exact at milestones | worst mid-leg lag | ever ahead | ever backslides');
    for (const r of out.rows) {
      const ok = r.miss === 0 && r.ahead === 0 && r.backslide === 0 && r.worstLag <= out.bound + 1e-9;
      if (!ok) bad++;
      console.log('  ' + r.id.padEnd(11) + ' | ' + pad(r.hits + '/' + (r.hits + r.miss), 19) +
        ' | ' + pad(r.worstLag.toFixed(3) + ' lv', 17) + ' | ' + pad(r.ahead, 10) +
        ' | ' + pad(r.backslide, 15) + (ok ? '' : '   <-- FAIL'));
    }
    console.log('\n  the lump you actually feel, crossing legacy level 40:');
    for (const id in out.jumps) { const j = out.jumps[id];
      console.log('    ' + id.padEnd(11) + ' ' + j.before.toPrecision(4) + ' -> ' + j.after.toPrecision(4) + '   x' + j.ratio.toFixed(3)); }
    if (errs.length) { console.log('  PAGE ERRORS: ' + errs.join(' | ')); bad++; }
  }

  // ── PART 2: the UI that sells it ─────────────────────────────────────────────────────────────
  for (const vp of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    // record every string the game paints, before the page boots — floatTxt has no exported spy
    await ctx.addInitScript(() => {
      window.__TXT = [];
      const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t) { try { window.__TXT.push(String(t)); } catch (e) {} return f.apply(this, arguments); };
    });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('!!window.__IDS');
    await page.click('#home-play'); await page.waitForTimeout(350);
    await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });
    await page.waitForTimeout(200);
    // the dock opens on DEFENCE — the economy rows do not exist until that tab is picked, and since
    // v18.60 the ECONOMY tab itself is hidden on a virgin save until a squad exists (progressive
    // reveal). This tool is testing the milestone system at full complexity, so unlock first.
    await page.evaluate(() => { window.__IDS.revealAll(); window.__IDS.syncHUD();
      const t = [...document.querySelectorAll('#tabs button')].find(x => /ECONOMY/i.test(x.textContent)); if (t) t.click(); });
    await page.waitForTimeout(250);

    const res = await page.evaluate(({ ids, LABEL }) => {
      const I = window.__IDS, SIM = window.__SIM, S = I.S();
      const rowOf = id => [...document.querySelectorAll('#up-list .up')].find(el => {
        const n = el.querySelector('.u-name'); return n && (n.textContent || '').toLowerCase().startsWith(LABEL[id]); });
      const out = {};
      for (const id of ids) {
        S.cash = 1e30;
        const start = SIM.rungLv(SIM.MILE_LEG * 3);            // sit ON a milestone, then climb off it
        const span = SIM.rungLv(SIM.MILE_LEG * 4) - start;     // one whole leg, in RUNGS
        const charges = [], readies = [], counts = [], chips = [];
        for (let k = 0; k <= span; k++) {
          S.lv[id] = start + k; I.recompute(); I.syncHUD();
          const el = rowOf(id); if (!el) break;
          charges.push(+(getComputedStyle(el).getPropertyValue('--mile') || 0));
          readies.push(el.classList.contains('mile-ready'));
          const chip = el.querySelector('.u-milechip');
          chips.push(chip ? getComputedStyle(chip).display : 'none');
          const m = ((el.querySelector('.u-desc') || {}).textContent || '').match(/✦ in (\d+)/);
          counts.push(m ? +m[1] : null);
        }
        const el = rowOf(id), mid = el && el.querySelector('.u-mid');
        out[id] = { charges, readies, counts, chips,
          clipped: mid ? mid.scrollWidth > mid.clientWidth + 1 : false,
          rowH: el ? Math.round(el.getBoundingClientRect().height) : 0 };
        S.lv[id] = 0;
      }
      I.recompute(); I.syncHUD();
      return out;
    }, { ids: IDS, LABEL });

    const banners = {};
    for (const id of IDS) {
      await page.evaluate(i => { const I = window.__IDS, SIM = window.__SIM, S = I.S();
        S.cash = 1e30; S.lv[i] = SIM.rungLv(SIM.MILE_LEG * 4) - 1; I.recompute();
        window.__TXT.length = 0; I.buyUp(i); }, id);
      await page.waitForTimeout(260);
      // dedupe: a live floatTxt is repainted every frame, and older banners are still on screen
      banners[id] = await page.evaluate(() => [...new Set((window.__TXT || []).filter(t => /MILESTONE/i.test(t)))].join(' | '));
    }

    console.log('\n== ' + vp.n + ' ' + vp.w + 'x' + vp.h + ' ==');
    for (const id of IDS) {
      const r = res[id]; if (!r || !r.charges.length) { console.log('  ' + id + '  NO ROW  <-- FAIL'); bad++; continue; }
      const c = r.charges;
      const rises = c.length > 2 && c[c.length - 2] > c[0] + 0.05;
      const resets = c.length > 2 && c[c.length - 1] < c[c.length - 2] - 0.2;
      const readyOnce = r.readies.some(Boolean);
      const chipShown = r.chips.some(d => d !== 'none');
      const cts = r.counts.filter(x => x != null);
      const countsDown = cts.length > 2 && cts[0] > cts[cts.length - 2];
      const ok = rises && resets && readyOnce && chipShown && countsDown && !r.clipped;
      if (!ok) bad++;
      console.log('  ' + id.padEnd(10) +
        ' charge ' + c[0].toFixed(2) + '->' + c[c.length - 2].toFixed(2) + '->' + c[c.length - 1].toFixed(2) +
        (rises ? ' rises' : ' FLAT!') + (resets ? ' resets' : ' NO-RESET!') +
        ' | ready ' + (readyOnce ? 'y' : 'N!') + ' chip ' + (chipShown ? 'y' : 'N!') +
        ' | in ' + cts.slice(0, 4).join(',') + (countsDown ? '' : ' NOT-DESCENDING!') +
        ' | row ' + r.rowH + 'px' + (r.clipped ? ' CLIPPED!' : '') + (ok ? '' : '   <-- FAIL'));
    }
    console.log('  payoff banner painted on the buy that crosses the lump:');
    for (const id of IDS) {
      const t = banners[id] || '', named = new RegExp(LABEL[id], 'i').test(t);
      if (!named) bad++;
      console.log('    ' + id.padEnd(10) + ' ' + (t || '(nothing painted)') + (named ? '' : '   <-- FAIL'));
    }
    if (errs.length) { console.log('  PAGE ERRORS: ' + errs.join(' | ')); bad++; }
    await page.close();
  }

  await browser.close();
  console.log('\n' + (bad ? 'MILESTONE GATES FAILED (' + bad + ')' : 'ALL MILESTONE GATES PASS'));
  process.exit(bad ? 1 : 0);
})();
