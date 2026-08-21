// DEVICE MATRIX (v18.55) — every real screen shape, every screen of the game, measured.
//
// The existing battery checked two or three shapes. Owner reports UI problems that differ
// phone to phone, which is exactly what a two-shape check cannot see. This sweeps the real
// spread — from a 280px-wide folded Fold to a 1366px iPad — opens each of the game's screens
// on each shape, and asserts things that are objectively wrong rather than matters of taste:
//
//   D1  the page never scrolls horizontally
//   D2  nothing interactive sits outside the viewport (off-screen = unreachable)
//   D3  the dock never overflows the bottom of the screen
//   D4  no text is clipped by its own box (scrollWidth > clientWidth on a single-line label)
//   D5  every tap target is at least MIN_TAP px on its short side
//   D6  open modals fit inside the viewport
//   D7  no two interactive siblings overlap (a button under another button is untappable)
//   D8  no page errors on any shape
//
//   node tools/device-matrix.js               (--only 320x568  to focus one shape)
//   node tools/device-matrix.js --shots       (also writes a screenshot per shape)
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');
const fs = require('fs');

const MIN_TAP = 28;          // px on the short side. Apple says 44, Android 48; 28 is the floor
                             // below which a real thumb genuinely misses, so it is the gate.
const DEVICES = [
  { n: 'Fold closed',    w: 280,  h: 653 },   // narrowest phone still sold
  { n: 'iPhone SE1',     w: 320,  h: 568 },   // smallest iOS target
  { n: 'Galaxy S8',      w: 360,  h: 740 },
  { n: 'iPhone SE2/3',   w: 375,  h: 667 },
  { n: 'iPhone 13 mini', w: 375,  h: 812 },
  { n: 'iPhone 14',      w: 390,  h: 844 },
  { n: 'Pixel 5',        w: 393,  h: 851 },
  { n: 'iPhone 14 ProMx',w: 430,  h: 932 },
  { n: 'Fold open',      w: 717,  h: 512 },   // squat and wide
  { n: 'phone landscape',w: 844,  h: 390 },   // the shape most likely to break a bottom dock
  { n: 'iPad mini',      w: 768,  h: 1024 },
  { n: 'iPad Pro',       w: 1024, h: 1366 },
];

const only = (() => { const i = process.argv.indexOf('--only'); if (i < 0) return null;
  const m = /^(\d+)x(\d+)$/.exec(process.argv[i + 1] || ''); return m ? { w: +m[1], h: +m[2] } : null; })();
const SHOTS = process.argv.includes('--shots');

// Every state worth opening. Each returns after the UI has settled.
const SCREENS = [
  { k: 'home',    open: async p => {} },
  { k: 'play',    open: async p => { await p.click('#home-play'); await p.waitForTimeout(350);
                                     await p.evaluate(() => { const t = document.querySelector('#tut-skip'); if (t) t.click(); }); } },
  // v18.60: features are progressively revealed now, so unlock everything first — this tool is
  // testing LAYOUT at full complexity, which is the harder case. tools/onboarding.js tests the gate.
  { k: 'defence', open: async p => { await p.evaluate(() => { window.__IDS.revealAll(); window.__IDS.syncHUD(); window.__IDS.navGo('upgrades');   /* v18.67: the shop is its own screen now */ document.querySelector('.tab[data-tab="def"]').click(); }); } },
  { k: 'collect', open: async p => { await p.evaluate(() => { window.__IDS.navGo('upgrades'); document.querySelector('.tab[data-tab="drone"]').click(); }); } },
  { k: 'economy', open: async p => { await p.evaluate(() => { window.__IDS.navGo('economy'); }); } },   /* v18.70: its own destination, not the third tab of the army shop */
  { k: 'starmap', open: async p => { await p.evaluate(() => window.__IDS.setScreen('map')); await p.waitForTimeout(250); } },
  { k: 'tree',    open: async p => { await p.evaluate(() => { window.__IDS.setScreen('play'); window.__IDS.openSkillTree('turret'); }); await p.waitForTimeout(300); } },
  { k: 'ascend',  open: async p => { await p.evaluate(() => { window.__IDS.setScreen('play'); window.__IDS.openAscend(); }); await p.waitForTimeout(250); } },
  { k: 'metrics', open: async p => { await p.evaluate(() => { const b = document.getElementById('btn-metrics'); if (b) b.click(); }); await p.waitForTimeout(250); } },
];

async function probe(page, k) {
  return page.evaluate(({ k, MIN_TAP }) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fails = [];
    const vis = el => { const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const named = el => el.id ? '#' + el.id : '.' + (el.className || el.tagName).toString().trim().split(/\s+/).slice(0, 2).join('.');

    // D1 horizontal scroll
    if (document.documentElement.scrollWidth > vw + 1) fails.push(`D1 page scrolls horizontally (${document.documentElement.scrollWidth} > ${vw})`);

    // an element only counts if it is genuinely the TOPMOST thing at its own centre. Without this
    // every dock button "overlaps" whatever modal is painted over it, which is z-order working
    // correctly, not a bug — that alone was 504 of the first run's 907 findings.
    const onTop = el => { const r = el.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) return false;
      const hit = document.elementFromPoint(cx, cy);
      return !!hit && (hit === el || el.contains(hit) || hit.contains(el)); };
    // and an element scrolled out of its own scroll container is FINE — that is what scrolling is for
    const inScroller = el => { for (let a = el.parentElement; a; a = a.parentElement) {
      const o = getComputedStyle(a).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
    // a rect must be CLIPPED to its scroll ancestor before it can be compared to anything: a row
    // scrolled below its list's clip line still reports its unclipped position, which read as the
    // whole upgrade list overlapping the TRAVEL button beneath it (72 phantom findings).
    const clipped = el => { let r = el.getBoundingClientRect();
      let t = r.top, b = r.bottom, l = r.left, rt = r.right;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow === 'visible' && cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
        const ar = a.getBoundingClientRect();
        t = Math.max(t, ar.top); b = Math.min(b, ar.bottom);
        l = Math.max(l, ar.left); rt = Math.min(rt, ar.right);
      }
      return { top: t, bottom: b, left: l, right: rt, width: rt - l, height: b - t }; };
    const inter = [...document.querySelectorAll('button, .tab, .up, .ab, .act, [data-tab], #home-play, .big')]
      .filter(vis).filter(el => { const c = clipped(el); return c.width > 1 && c.height > 1; })
      .filter(onTop);

    for (const el of inter) {
      const r = el.getBoundingClientRect();
      // D2 off-viewport
      if (inScroller(el)) { /* scrolled inside its own list — reachable by scrolling */ }
      else if (r.right < -1 || r.left > vw + 1 || r.bottom < -1 || r.top > vh + 1)
        fails.push(`D2 ${named(el)} fully outside the viewport (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`);
      else if (r.left < -1 || r.right > vw + 1)
        fails.push(`D2 ${named(el)} cut off horizontally (left ${Math.round(r.left)}, right ${Math.round(r.right)} vs ${vw})`);
      // D5 tap target
      if (Math.min(r.width, r.height) < MIN_TAP - 0.5 && el.tagName === 'BUTTON')
        fails.push(`D5 ${named(el)} tap target ${Math.round(r.width)}x${Math.round(r.height)} (min ${MIN_TAP})`);
    }

    // D3 dock inside the screen
    const dock = document.getElementById('dock');
    if (dock && vis(dock)) { const r = dock.getBoundingClientRect();
      if (r.bottom > vh + 2) fails.push(`D3 dock overflows the bottom by ${Math.round(r.bottom - vh)}px`);
      if (r.top < -2) fails.push(`D3 dock top is off-screen by ${Math.round(-r.top)}px`); }

    // D4 clipped single-line text
    for (const el of document.querySelectorAll('.u-name, .u-desc, .tab, .g-label, .act, .ab-n, #ui-cash, #ui-cap, .u-buy')) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis') continue;   // it is allowed to spill
      if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis')
        fails.push(`D4 ${named(el)} text clipped ("${(el.textContent||'').trim().slice(0,26)}" ${el.scrollWidth}>${el.clientWidth})`);
    }

    // D6 modals fit
    for (const m of document.querySelectorAll('.modal.show')) {
      if (m.id === 'tutorial') continue;                       // deliberately keeps .show while hidden
      if (!vis(m)) continue;
      for (const card of m.querySelectorAll(':scope > div, :scope > .card, .ascend-body')) {
        if (!vis(card)) continue;
        const r = card.getBoundingClientRect();
        const scrolls = ['auto', 'scroll'].includes(getComputedStyle(card).overflowY) || inScroller(card);
        if (!scrolls && r.height > vh + 2) fails.push(`D6 ${named(m)} > ${named(card)} taller than the screen and does not scroll (${Math.round(r.height)} > ${vh})`);
        if (r.width > vw + 2) fails.push(`D6 ${named(m)} > ${named(card)} wider than the screen (${Math.round(r.width)} > ${vw})`);
      }
    }

    // D7 overlapping interactive siblings (a button under a button cannot be tapped)
    for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
      const a = inter[i], b = inter[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = clipped(a), rb = clipped(b);
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 6 && oy > 6) fails.push(`D7 ${named(a)} overlaps ${named(b)} by ${Math.round(ox)}x${Math.round(oy)}px`);
    }
    return fails;
  }, { k, MIN_TAP });
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const list = only ? DEVICES.filter(d => d.w === only.w && d.h === only.h) : DEVICES;
  if (!list.length) { console.error('no device matches --only'); process.exit(1); }
  if (SHOTS) fs.mkdirSync(path.resolve(__dirname, '..', '.shots'), { recursive: true });

  const all = [];
  for (const d of list) {
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
    await page.waitForFunction('!!window.__IDS');
    // a mid-game state, so lists are populated and the HUD has real numbers to fit
    await page.evaluate(() => { const I = window.__IDS, S = I.S();
      S.vault[1] = { conquered: true, earned: 0, bgRate: 0, mine: 1, mineBuf: 0 };
      S.galaxy = 2; S.peakGalaxy = 2; S.vault[2] = { conquered: false, earned: 0, bgRate: 0 };
      S.cash = 1.234e9; I.recompute(); });

    const perScreen = {};
    for (const sc of SCREENS) {
      try { await sc.open(page); } catch (e) { perScreen[sc.k] = ['open failed: ' + String(e.message).split('\n')[0]]; continue; }
      await page.waitForTimeout(140);
      perScreen[sc.k] = await probe(page, sc.k);
      if (SHOTS) await page.screenshot({ path: path.resolve(__dirname, '..', '.shots', `${d.w}x${d.h}-${sc.k}.png`) });
      // close whatever we opened so the next screen starts clean. NOT after 'home' — forcing the
      // play screen there hides #home-play, and the next step's click then times out for 30s.
      if (sc.k !== 'home') await page.evaluate(() => {
        for (const m of document.querySelectorAll('.modal.show')) if (m.id !== 'home') m.classList.remove('show');
        if (window.__IDS.state() !== 'play') window.__IDS.setScreen('play'); });
    }
    await ctx.close();
    all.push({ d, perScreen, errs });
  }
  await browser.close();

  let total = 0;
  const byRule = {};
  for (const { d, perScreen, errs } of all) {
    const flat = Object.entries(perScreen).flatMap(([k, f]) => f.map(x => ({ k, x })));
    for (const e of errs) flat.push({ k: 'boot', x: 'D8 page error: ' + e });
    total += flat.length;
    for (const { x } of flat) { const r = x.slice(0, 2); byRule[r] = (byRule[r] || 0) + 1; }
    const tag = `${d.n} ${d.w}x${d.h}`;
    if (!flat.length) { console.log('PASS  ' + tag); continue; }
    console.log('FAIL  ' + tag + '  (' + flat.length + ')');
    const seen = new Set();
    for (const { k, x } of flat) {
      const key = k + x.slice(0, 60); if (seen.has(key)) continue; seen.add(key);
      console.log('        [' + k.padEnd(7) + '] ' + x);
    }
  }
  console.log('\n' + (total ? total + ' finding(s) — by rule: ' + Object.entries(byRule).sort().map(([r, n]) => r + '×' + n).join('  ')
                            : 'ALL DEVICE GATES PASS'));
  process.exit(total ? 1 : 0);
})();
