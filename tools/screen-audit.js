// SCREEN AUDIT (v18.67) — open every destination and click through every visible control.
//
// Written because "a lot of the UI is broken" needed evidence, not opinion, and because none of the
// existing tools would have caught what it found. On the v18.66 nav it reported:
//   - the star map still fully live behind the ascension page (galaxy-map and skilltree were never
//     in CARD_MODALS, so screens STACKED instead of replacing each other)
//   - the whole shop dock — abilities, DEFENCE, the buy button, LAUNCH — present and tappable
//     underneath every screen you opened
//   - seven sub-28px tap targets on the star map
//
// For each destination it reports controls that are OFF-SCREEN, below the tap floor (TINY), or
// COVERED by something else at their own centre point. Nothing here is a matter of taste.
//
//   node tools/screen-audit.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ try { return require('/opt/node22/lib/node_modules/playwright'); } catch(e2){ console.error('This tool needs Playwright'); process.exit(1);} } }
const { chromium } = requirePlaywright();
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 430, height: 932 } })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 120)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForFunction("!!window.__IDS");
  await p.click("#home-play"); await p.waitForTimeout(600);
  await p.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); window.__IDS.revealAll(); window.__IDS.syncHUD(); });
  await p.waitForTimeout(400);
  for (const nav of ["map","upgrades","play","ascend","more"]) {
    await p.evaluate(k => { const b2 = document.querySelector('#nav .nv[data-nav="'+k+'"]'); if (b2) b2.click(); }, nav);
    await p.waitForTimeout(350);
    const r = await p.evaluate(() => {
      const vis = el => { const q = el.getBoundingClientRect(), s = getComputedStyle(el);
        return q.width > 1 && q.height > 1 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > .05; };
      const all = [...document.querySelectorAll("#root button, #root .tab, #root .ab")].filter(vis);
      const off = all.filter(e => { const q = e.getBoundingClientRect();
        return q.bottom > innerHeight + .5 || q.top < -.5 || q.right > innerWidth + .5 || q.left < -.5; });
      const tiny = all.filter(e => { const q = e.getBoundingClientRect(); return Math.min(q.width, q.height) < 28; });
      const covered = all.filter(e => { const q = e.getBoundingClientRect();
        const m = document.elementFromPoint(q.left + q.width/2, q.top + q.height/2);
        return m && !e.contains(m) && !m.contains(e); });
      return { n: all.length,
        off: off.map(e => (e.id || e.className) + " " + Math.round(e.getBoundingClientRect().bottom)),
        tiny: tiny.map(e => (e.id || e.textContent||"").trim().slice(0,18)),
        covered: covered.map(e => (e.id || e.textContent||"").trim().slice(0,18)) };
    });
    console.log(nav.padEnd(7), "controls", String(r.n).padStart(3),
      " OFF-SCREEN", r.off.length ? r.off.join(", ") : "-",
      " TINY", r.tiny.length ? r.tiny.join(",") : "-",
      " COVERED", r.covered.length ? r.covered.join(",") : "-");
  }
  console.log("\npage errors:", errs.length ? errs.join(" | ") : "none");
  await b.close();
})();
