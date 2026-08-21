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
//   O10 ECONOMY is reachable AND populated from the FIRST FRAME. v18.60 gated it and that was wrong —
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
//   --- v18.64, the tutorial itself, driven rather than counted ---
//   T1  no step's spotlight may cover most of the viewport. Step 1 targeted #game — the full-screen
//       canvas — so the "spotlight" lit everything, the dim never appeared, and the card floated
//       over a fully lit game with no focus at all. A step with no usable target must go NOSPOT
//       (centred card on a dim backdrop) instead.
//   T2  every step is EITHER nospot-with-a-dim OR has a real, smaller-than-screen spotlight
//   T3  the card never covers the spotlight it is pointing at
//   T4  a drag REACHES THE GAME while the cards are up — step 1 says "go on, try it now", so if the
//       overlay swallowed input that instruction would be a lie
//   T5  Next advances, the last button closes, tutorialDone survives a reload, replay still works
//   T6  the spotlight TRACKS its target — it used to be positioned once at render(), so a reveal
//       firing mid-tutorial reflowed the dock and left the ring pointing at empty space
//
//   --- v18.66, the nav: screens instead of corner icons ---
//   N1  five destinations exist and each shows its NAME, not just an icon (on a normal phone)
//   N7  PLAY sits in the MIDDLE of the bar (v18.67, owner: "the shoot page should be in the middle")
//   N8  ONE SCREEN AT A TIME — opening a destination must leave no other screen's controls live.
//       The v18.66 audit found the star map still tappable behind the ascension page (galaxy-map and
//       skilltree were missing from CARD_MODALS) and the whole shop dock under every screen.
//   N2  every nav item clears the tap floor on both axes
//   N3  each destination actually opens its screen
//   N4  the nav stays ABOVE an open modal, so switching screens is one tap from anywhere
//   N5  ASCEND is inert until a core is pending, then carries the pending count as a badge
//   N6  the old corner icons (#btn-menu, #btn-metrics) are gone — not merely hidden
//   N10 a core you WIN is a core you can spend: the boss wheel banks one directly, so the ascend
//       door opens on the BANK, not only on cores a conquest has staged.
//   N9  the three POWERS belong to PLAY and only to PLAY (v18.72, owner call reversing v18.69):
//       present AND tappable on the field, GONE on every other destination. You fire them at dots,
//       so a live Black Hole tile on the Economy page is offering something you cannot even see.
//       Checked both ways — a gate that only asserted "visible on PLAY" would pass if they were
//       visible everywhere, which is the exact state this replaced.
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
  // #nav excluded deliberately: O1 is about CROWDING on the play surface, and the nav is five
  // labelled persistent destinations — the cure for that crowding. N1/N2 gate the nav on its own terms.
  return [...document.querySelectorAll('#root button, #root .tab, #root .ab')]
    .filter(e => !e.closest('#nav')).filter(vis);
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
        collectTab: vis('.tab[data-tab="drone"]'), abil: vis('#abilities'),
        // v18.66: the corner #btn-ascend is now ONLY the centre-stage wall badge. A veteran's route
        // to ascension is the nav, so that is what must not be locked away from them.
        ascend: !document.querySelector('#nav .nv[data-nav="ascend"]').classList.contains('locked') };
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

  // ── N1-N6: the nav ───────────────────────────────────────────────────────────────────────────
  {
    const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('!!window.__IDS');
    await page.click('#home-play'); await page.waitForTimeout(600);
    await page.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); });
    await page.waitForTimeout(400);
    const f = [];

    const base = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#nav .nv')].map(b => {
        const r = b.getBoundingClientRect(), sp = b.querySelector('span');
        return { key: b.dataset.nav, w: Math.round(r.width), h: Math.round(r.height),
          name: sp && getComputedStyle(sp).display !== 'none' ? sp.textContent.trim() : '',
          locked: b.classList.contains('locked') };
      });
      return { items, corners: !!document.querySelector('#btn-menu') || !!document.querySelector('#btn-metrics'),
        ascLocked: (items.find(i => i.key === 'ascend') || {}).locked };
    });
    if (base.items.length !== 5) f.push('nav has ' + base.items.length + ' destinations, want 5');
    for (const it of base.items) {
      if (!it.name) f.push(it.key + ' has no visible name — icon only');
      if (Math.min(it.w, it.h) < 28) f.push(it.key + ' tap target ' + it.w + 'x' + it.h);
    }
    if (base.corners) f.push('the old corner icons still exist in the DOM');
    // N7 — PLAY is the middle seat
    { const keys = base.items.map(i => i.key), mid = keys[Math.floor(keys.length / 2)];
      if (mid !== 'play') f.push('PLAY is not the middle destination (order: ' + keys.join(',') + ')'); }
    if (!base.ascLocked) f.push('ASCEND is live on a virgin save with nothing pending');

    // N3/N4 — every destination opens, and the nav stays reachable on top of it
    // v18.70: MORE left the nav for the banner ☰ (five destinations, PLAY in the middle), and
    // ECONOMY took its seat as a screen of its own.
    const dest = { map: '#galaxy-map', upgrades: '#upgrades', economy: '#economy', ascend: '#ascend' };
    const opened = {};
    await page.evaluate(() => { window.__IDS.revealAll(); window.__IDS.syncHUD(); });   // unlock ASCEND
    for (const [k, sel] of Object.entries(dest)) {
      await page.click('#nav .nv[data-nav="' + k + '"]'); await page.waitForTimeout(320);
      const r = await page.evaluate(s2 => {
        const m = document.querySelector(s2), nav = document.querySelector('#nav');
        const nr = nav.getBoundingClientRect();
        const zTop = +getComputedStyle(nav).zIndex >= +getComputedStyle(m).zIndex;
        // is the nav actually clickable, or is the modal painted over it?
        const mid = document.elementFromPoint(nr.left + nr.width * 0.1, nr.top + nr.height / 2);
        return { open: !!m && m.classList.contains('show'), zTop, hitsNav: !!(mid && mid.closest('#nav')) };
      }, sel);
      opened[k] = r.open;
      const leak = await page.evaluate(sel2 => {
        const own = document.querySelector(sel2);
        const vis = el => { const q = el.getBoundingClientRect(), st = getComputedStyle(el);
          return q.width > 1 && q.height > 1 && st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > 0.05; };
        // any control that is visible, belongs to neither this screen nor the nav, and is not the
        // always-on top bar, means two screens are open at once
        return [...document.querySelectorAll('#root button, #root .tab, #root .ab')].filter(vis)
          .filter(e => !e.closest('#nav') && !e.closest('#top') && !(own && own.contains(e)))
          .map(e => e.id || (e.textContent || '').trim().slice(0, 14)).slice(0, 8);
      }, sel);
      if (leak.length) f.push('another screen is still live behind ' + k + ': ' + leak.join(', '));
      if (!r.open) f.push('nav ' + k + ' did not open ' + sel);
      if (!r.zTop || !r.hitsNav) f.push('the nav is not tappable over ' + sel + ' (z ' + r.zTop + ', hit ' + r.hitsNav + ')');
      await page.click('#nav .nv[data-nav="play"]'); await page.waitForTimeout(220);
    }
    // N9 — the powers live on PLAY, and nowhere else
    await page.evaluate(() => { window.__IDS.revealAll(); window.__IDS.syncHUD(); });
    let powWhere = [];
    for (const k of ['play', 'upgrades', 'economy', 'map', 'ascend', 'more']) {
      await page.evaluate(kk => window.__IDS.navGo(kk), k); await page.waitForTimeout(260);
      const st = await page.evaluate(() => ['ab-frenzy', 'ab-dotrain', 'ab-blackhole'].map(id => {
        const e = document.getElementById(id); if (!e) return 'missing';
        const q = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (!(q.width > 1 && q.height > 1 && cs.display !== 'none' && +cs.opacity > 0.05)) return 'hidden';
        const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return hit && e.contains(hit) ? 'ok' : 'blocked';
      }));
      // on PLAY all three must be there and pressable; anywhere else all three must be gone
      const want = k === 'play' ? 'ok' : 'hidden';
      const bad2 = st.filter(x => x !== want);
      if (bad2.length) powWhere.push(k + ' wanted ' + want + ', got ' + bad2.join('/'));
    }
    if (powWhere.length) f.push('powers are not PLAY-only — ' + powWhere.join('; '));
    // ...and on PLAY, one must actually FIRE
    await page.evaluate(() => window.__IDS.navGo('play')); await page.waitForTimeout(260);
    const cdBefore = await page.evaluate(() => window.__IDS.abil().frenzy);
    await page.click('#ab-frenzy'); await page.waitForTimeout(280);
    const cdAfter = await page.evaluate(() => window.__IDS.abil().frenzy);
    if (!(cdAfter > cdBefore)) f.push('firing a power from PLAY did nothing');

    // N10 — a core WON is a core you can spend. The boss-bounty wheel banks a core directly on a 2%
    // roll, and a boss can die long before your first conquest — so the ascend door must open on the
    // BANK, not only on pending. Measured before v18.76: the wheel printed "◈ +1 CORE — banked to
    // Ascension" while the nav's ASCEND item sat at pointer-events:none, holding a currency you
    // could not spend. Asked on a virgin save, which is the only state where the two differ.
    { const wheel = await page.evaluate(() => {
        const I = window.__IDS;
        I.META().seen = {};                                   // forget the reveal, so this is a real question
        const na = () => document.querySelector('#nav .nv[data-nav="ascend"]');
        I.syncHUD();
        const before = { locked: !!(na() && na().classList.contains('locked')), banked: (I.META().asc.cores) | 0 };
        I.awardCores(1, 'rare drop — BOSS BOUNTY WHEEL'); I.syncHUD();
        const el = na(), cs = el ? getComputedStyle(el) : null;
        return { before, banked: (I.META().asc.cores) | 0, pending: I.pendingCores(),
                 locked: !!(el && el.classList.contains('locked')), pointer: cs ? cs.pointerEvents : 'none' };
      });
      if (!wheel.before.locked) f.push('N10 is vacuous — ASCEND was already unlocked before the wheel core');
      if (wheel.locked || wheel.pointer === 'none') f.push('a WHEEL core (banked ' + wheel.banked + ', pending ' + wheel.pending + ') left ASCEND unclickable — you cannot spend what you won');
      await page.evaluate(() => { const I = window.__IDS; I.META().asc.cores = 0; I.revealAll(); I.syncHUD(); }); }

    // N5 — the pending badge
    const badge = await page.evaluate(() => {
      const I = window.__IDS, S = I.S();
      S.vault = { 1: { conquered: true }, 2: { conquered: true } }; I.recompute(); I.syncHUD();
      const b2 = document.querySelector('#nv-asc');
      return { pend: I.pendingCores(), txt: (b2 || {}).textContent || '', on: !!(b2 && b2.classList.contains('on')) };
    });
    if (badge.pend > 0 && !badge.on) f.push('ASCEND badge not shown with ' + badge.pend + ' pending');
    if (badge.pend > 0 && !badge.txt.includes(String(badge.pend))) f.push('ASCEND badge reads "' + badge.txt + '", pending is ' + badge.pend);

    if (errs.length) f.push('page errors: ' + errs.join(' | '));
    bad += f.length;
    console.log('  ' + 'nav'.padEnd(24) + base.items.length + ' dests [' + base.items.map(i => i.name || i.key + '?').join(' ') + ']' +
      '  opens ' + Object.entries(opened).filter(([, v]) => v).length + '/' + Object.keys(dest).length +
      '  corners-gone ' + (base.corners ? 'NO' : 'y') +
      '  asc-locked-at-start ' + (base.ascLocked ? 'y' : 'N') +
      '  badge ' + (badge.on ? '"' + badge.txt + '"' : 'off') +
      '  powers ' + (powWhere.length ? 'BROKEN' : 'PLAY only'));
    f.forEach(x => console.log('      <-- ' + x));
    await page.close();
  }

  // ── T1-T6: the tutorial, driven step by step ─────────────────────────────────────────────────
  {
    const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('!!window.__IDS');
    await page.click('#home-play'); await page.waitForTimeout(1100);
    const f = [];
    const readStep = () => page.evaluate(() => {
      const w = document.querySelector('#tutorial'), sp = document.querySelector('#tut-spot'), cd = document.querySelector('#tut-card');
      const rb = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const nospot = w.classList.contains('nospot');
      return { up: w.classList.contains('show'), nospot,
        step: (document.querySelector('#tut-step') || {}).textContent || '',
        dim: nospot ? getComputedStyle(w).backgroundColor : getComputedStyle(sp).boxShadow.slice(0, 40),
        spot: nospot ? null : rb(sp), card: rb(cd), vw: innerWidth, vh: innerHeight };
    });
    const steps = [];
    for (let i = 0; i < 6; i++) {
      const st = await readStep(); if (!st.up) break;
      steps.push(st);
      const area = st.spot ? (st.spot.w * st.spot.h) / (st.vw * st.vh) : 0;
      if (st.spot && area > 0.55) f.push(st.step + ': spotlight covers ' + Math.round(area * 100) + '% of the screen — it lights everything and kills the dim');
      if (st.nospot && !/rgba?\(/.test(st.dim || '')) f.push(st.step + ': nospot step has no dim backdrop');
      if (st.spot) { const c = st.card, sp = st.spot;   // T3: card must not cover its own spotlight
        const ox = Math.max(0, Math.min(c.x + c.w, sp.x + sp.w) - Math.max(c.x, sp.x));
        const oy = Math.max(0, Math.min(c.y + c.h, sp.y + sp.h) - Math.max(c.y, sp.y));
        if (ox * oy > sp.w * sp.h * 0.25) f.push(st.step + ': the card covers its own spotlight'); }
      await page.click('#tut-next'); await page.waitForTimeout(350);
    }
    if (steps.length < 1) f.push('the tutorial never appeared on a fresh save');
    const closed = await page.evaluate(() => !document.querySelector('#tutorial.show'));
    if (!closed) f.push('the last button did not close the tutorial');

    // T5 — persistence and replay
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction('!!window.__IDS');
    await page.click('#home-play'); await page.waitForTimeout(900);
    if (await page.evaluate(() => !!document.querySelector('#tutorial.show'))) f.push('the tutorial came BACK after being completed');
    await page.evaluate(() => { const t = document.querySelector('#set-tutorial'); if (t) t.click(); });
    await page.waitForTimeout(800);
    const replayed = await page.evaluate(() => !!document.querySelector('#tutorial.show'));
    if (!replayed) f.push('replay from settings did not reopen the tutorial');

    // T4 — a drag must reach the game through the overlay ("go on, try it now")
    let dragOk = false;
    if (replayed) {
      const b4 = await page.evaluate(() => ({ popped: (window.__IDS.META().stats.dotsPopped | 0) }));
      // v18.70: this used to be six sweeps down one fixed strip and it cleared the bar by a single
      // dot — a coin-flip, not a gate (same shape as the loop-probe flake). It now sweeps the FIELD:
      // bands either side of the world centre, both directions, with a beat between passes for the
      // spawner to refill. It is still testing exactly one thing — does a drag reach the game.
      { const vp = page.viewportSize(), cy = Math.round(vp.height * 0.5);
        for (let pass = 0; pass < 10; pass++) {
          const y = cy + (pass % 5 - 2) * 46, ltr = pass % 2 === 0;
          const x0 = ltr ? 30 : vp.width - 30, dx = (ltr ? 1 : -1) * Math.round((vp.width - 60) / 12);
          await page.mouse.move(x0, y); await page.mouse.down();
          for (let k = 1; k <= 12; k++) await page.mouse.move(x0 + k * dx, y + (k % 2 ? 22 : -22));
          await page.mouse.up(); await page.waitForTimeout(180);
        } }
      await page.waitForTimeout(350);
      const af = await page.evaluate(() => ({ popped: (window.__IDS.META().stats.dotsPopped | 0) }));
      dragOk = af.popped > b4.popped;
      if (!dragOk) f.push('a drag did NOT reach the game while the tutorial was up — step 1 says "try it now"');
    }

    // T6 — the spotlight must track its target across a reflow
    let tracks = 'n/a';
    if (replayed) {
      await page.evaluate(() => { const n = document.querySelector('#tut-next'); if (n) n.click(); });   // step 2 targets #up-list
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.__IDS.revealAll(); window.__IDS.syncHUD(); });   // force a reflow
      await page.waitForTimeout(350);
      // v18.67: ask the GAME what this step targets. The gate used to hardcode #up-list, which moved
      // to the Upgrades screen — so it was measuring drift against an element the step no longer aims at.
      const t = await page.evaluate(() => {
        const sel = window.__IDS.TUT_SEL(); if (!sel) return 0;          // a nospot step cannot drift
        const el = document.querySelector(sel); if (!el) return 9999;
        const sp = document.querySelector('#tut-spot').getBoundingClientRect(), er = el.getBoundingClientRect();
        return Math.abs(sp.top + sp.height / 2 - (er.top + er.height / 2));
      });
      tracks = t <= 12 ? 'ok' : 'DRIFTED ' + Math.round(t) + 'px';
      if (t > 12) f.push('the spotlight drifted ' + Math.round(t) + 'px off its target after a reflow');
    }

    if (errs.length) f.push('page errors: ' + errs.join(' | '));
    bad += f.length;
    console.log('  ' + 'tutorial'.padEnd(24) + 'steps ' + steps.length +
      '  ' + steps.map(x => x.nospot ? 'dim' : 'spot').join('/') +
      '  closes ' + (closed ? 'y' : 'N') + '  replay ' + (replayed ? 'y' : 'N') +
      '  drag-through ' + (dragOk ? 'y' : 'N') + '  tracks ' + tracks);
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
      // v18.70: ECONOMY is a nav destination, not a tab. Same question, asked of the new furniture —
      // and asked HARDER: the nav item must be visible AND the screen must actually hold its rows,
      // because a reachable button onto an empty page fails the player the same way a hidden tab did.
      const ecoNav = document.querySelector('#nav .nv[data-nav="economy"]');
      const ecoVisible = !!ecoNav && getComputedStyle(ecoNav).display !== 'none'
        && !ecoNav.classList.contains('locked')
        && document.querySelectorAll('#eco-list .up').length >= 4;
      // v18.68: the objective banner left the play surface for the UPGRADES screen. Open that screen
      // to read it — a gate that keeps checking the field would just certify it as missing.
      window.__IDS.navGo('upgrades');
      const ob = document.querySelector('#objective');
      return { ecoVisible, controls: ctl.length, labels: ctl.map(b => (b.textContent || '').trim().slice(0, 14)),
        rows: rows.length, lockedRows, treeOnUnowned,
        moreLine: !!document.querySelector('.up-more'),
        objShown: !!(ob && ob.classList.contains('show')),
        objText: ((document.querySelector('#objective .ob-t') || {}).textContent || '').trim(),
        dots: window.__IDS.dots().length,
        // v18.68: the conquer readout moved off the LAUNCH button into the top progress banner
        travel: (document.querySelector('#ui-conq') || {}).textContent || '' };
    }, visibleControls.toString());
    await page.evaluate(() => window.__IDS.navGo('play'));   // back to the field for the rest

    // O11/O12 — with the tutorial up: objective visible, coach silent
    const tut = await page.evaluate(() => new Promise(res => {
      const I = window.__IDS;
      I.META().tutorialDone = false;
      const t = document.querySelector('#set-tutorial'); if (t) t.click();
      setTimeout(() => {
        window.__IDS.navGo('upgrades');
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
      // v18.73: reveal FIRST, so the settled-world check is asked of a save that actually has powers.
      // Asked of a virgin save it was vacuous — abilities are hidden either way, so "hidden while
      // settled" passed for the wrong reason and could never have caught the powers going missing.
      I.revealAll(); I.navGo('play'); I.syncHUD();
      await new Promise(r => setTimeout(r, 150));
      const abilBefore = vis('#abilities');
      S.vault[S.galaxy] = { conquered: true, earned: 0 }; I.recompute(); I.syncHUD();
      await new Promise(r => setTimeout(r, 250));
      // v18.68: the objective banner left the play surface for the UPGRADES screen, so it is read
      // there. v18.73: the POWERS went the other way — they are PLAY-only now — so the two halves of
      // this check have to be asked on their own screens, or each one certifies the other's home.
      window.__IDS.navGo('upgrades');
      await new Promise(r => setTimeout(r, 150));
      const ob = document.querySelector('#objective');
      const objOnSettle = !!(ob && ob.classList.contains('show'));
      I.navGo('play');
      await new Promise(r => setTimeout(r, 150));
      const onSettle = { obj: objOnSettle, abil: vis('#abilities') };
      S.vault[S.galaxy] = { conquered: false, earned: 0 }; I.recompute(); I.syncHUD();
      await new Promise(r => setTimeout(r, 150)); I.syncHUD();
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
    if (!t0.ecoVisible) fails.push('ECONOMY unreachable or empty at t=0 — its upgrades are the cheapest buys in the game');
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
    // v18.73: this used to demand the OPPOSITE — abilities hidden over the settlement panel — which
    // was right when they were dock furniture the panel replaced (v18.13) and wrong the moment they
    // moved into the nav (v18.69). A conquered planet is a settled world, and that is where a mature
    // save spends most of its time farming the travel cost, so the powers were gone exactly when you
    // most want them. The settle panel is in the DOCK; the powers are in the NAV, above it.
    if (settle.abilBefore && !settle.onSettle.abil) fails.push('SETTLING a world hid the powers — they are nav furniture, not dock furniture');
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
      '  settle[obj ' + (settle.onSettle.obj ? 'LEAK' : 'hidden') + ' powers ' + (settle.onSettle.abil ? 'kept' : 'LOST') + ']' +
      '  sticky ' + (sticky.on && sticky.still ? 'ok' : 'NO'));
    fails.forEach(f => console.log('      <-- ' + f));
    await page.close();
  }

  await browser.close();
  console.log('\n' + (bad ? 'ONBOARDING GATES FAILED (' + bad + ')' : 'ALL ONBOARDING GATES PASS'));
  process.exit(bad ? 1 : 0);
})();
