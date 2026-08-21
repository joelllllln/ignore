#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/play-hud.js — THE PLAY SCREEN'S OWN FURNITURE
//
// Owner ask (v18.81): "the menus is still broken on the play page.." — attached
// to a 414x896 shot of a SETTLED world. Three separate defects were in it, and
// all three are the same failure mode: a piece of the play screen that was
// correct when it was written and then quietly stopped being correct when the
// UI around it moved. None of them throws, none of them shows up in a nav walk,
// and none of them would ever have been caught by reading the code.
//
//   P1  AN EARNED ◈ FLIES TO THE THING THAT COUNTS IT.
//       drawCoreFx flew every core to (width-54, 46) because that is where the
//       ascension pill lived. v18.66 moved ascend into the bottom NAV; v18.68
//       gave the top-right to the banner's ☰. So for fifteen versions the cores
//       flew UP AND OFF, ending as a diamond clipped under the status bar —
//       measured at (360,49) against the stray ◈ in the owner's screenshot at
//       (359,46). This gate hit-tests the target with elementFromPoint: the
//       point must land ON the ASCEND control, not merely near a number that
//       happens to match. A coordinate is only right relative to a live layout,
//       so it is checked against the live layout, on every shape.
//
//   P2  THE SETTLED OVERLAY DOES NOT REPEAT THE PANEL. It printed four lines
//       across the play field — no credits, the mine's rate, launching is free
//       — while the settlement panel two inches below said all three, better,
//       with a live countdown. One floating line literally ended "panel below".
//       Rule: at most two lines, and NO DIGITS in any of them. A number that
//       moves belongs in the panel that can redraw it, not in a banner drifting
//       over the playfield. P2b is the other half and the one that matters more:
//       cutting text must not LOSE anything, so the panel is checked to still
//       carry the rate, the no-credits fact and the free launch.
//
//   P3  THE BANNER FOOT DOES NOT EAT ITS OWN CAP. With the leak warning up, the
//       foot row wrapped into the capacity readout and clipped it: measured 42px
//       tall on a 390 and 68px on a 280, `#ui-cap` cut off on every shape.
//
// Run: node tools/play-hud.js         (needs Playwright)
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");

const VIEWS = [
  { n: "Fold closed", w: 280, h: 653 },
  { n: "iPhone SE1", w: 320, h: 568 },
  { n: "iPhone 14", w: 390, h: 844 },
  { n: "owner shot", w: 414, h: 896 },
  { n: "phone landsc", w: 844, h: 390 },
];

// P1 — fly a REAL core and ask where it actually went. Asking coreFxTarget() alone would be a gate on
// a helper nothing is obliged to call; coreFxLast() is the point drawCoreFx used on the last frame it
// drew, so the check follows the diamond the player watches.
const coreTarget = () => {
  const T = window.__SIM.coreFxLast();
  if (!T) return { flew: false };
  const el = document.elementFromPoint(T.x, T.y);
  const nav = document.querySelector('#nav .nv[data-nav="ascend"]');
  // strictly ON the control or inside it. `el.contains(nav)` would also be true for #nav itself, which
  // would quietly accept a core landing in the gap BETWEEN two nav items — that is not the counter.
  const onAscend = !!(el && nav && (el === nav || nav.contains(el)));
  const r = nav ? nav.getBoundingClientRect() : null;
  return { flew: true, x: Math.round(T.x), y: Math.round(T.y), from: T.from, onAscend,
           hit: el ? (el.id || el.getAttribute("data-nav") || (typeof el.className === "string" && el.className) || el.tagName) : "nothing",
           inView: T.x > 0 && T.y > 0 && T.x < innerWidth && T.y < innerHeight,
           navThere: !!(r && r.width > 1 && r.height > 1) };
};

// P2 — record one frame of canvas text and pull out the settled banner's lines.
// The overlay is the only thing that draws "✦ WORLD SETTLED"; its body lines are
// the centred fillTexts that follow it in the same frame.
const grabOverlay = async page => page.evaluate(() => new Promise(res => {
  const C = CanvasRenderingContext2D.prototype, orig = C.fillText, log = [];
  C.fillText = function (t, x, y) { log.push({ t: String(t), x, y }); return orig.apply(this, arguments); };
  setTimeout(() => {
    C.fillText = orig;
    let h = -1;
    for (let i = log.length - 1; i >= 0; i--) if (/WORLD SETTLED/.test(log[i].t)) { h = i; break; }
    if (h < 0) return res({ found: false, lines: [] });
    const head = log[h], lines = [head.t];
    for (let i = h + 1; i < log.length; i++) {
      const c = log[i];
      if (Math.abs(c.x - head.x) < 1.5 && c.y > head.y && c.y < head.y + 140) lines.push(c.t);
    }
    res({ found: true, lines });
  }, 260);
}));

// P3 — the banner's bottom row with BOTH of its optional lines populated. The two warnings are driven
// by decayed internals the game will not hold still for, so the gate writes the real strings into the
// real spans and measures in the SAME tick, before syncHUD's next frame can clear them. The question
// is a pure layout one — given this much text, does the capacity readout survive — so producing the
// text by hand is honest; what must not be faked is the measurement.
const footBox = () => {
  const f = document.querySelector(".hud-foot"), c = document.querySelector("#ui-cap");
  const lk = document.querySelector("#ui-leak"), ah = document.querySelector("#ui-ascend-hint");
  if (!f || !c || !lk || !ah) return { there: false };
  lk.textContent = "▲ 41% of your loot is rotting - upgrade collectors"; lk.classList.add("show");
  ah.textContent = "◈ next upgrade is 24 min away — ascending banks 3 ◈"; ah.classList.add("show");
  const fr = f.getBoundingClientRect(), cr = c.getBoundingClientRect();   // forces sync layout with the text in
  const out = { there: true, footH: Math.round(fr.height),
                capClipped: c.scrollWidth > c.clientWidth + 1 || cr.right > fr.right + 1 || cr.left < fr.left - 1,
                capTxt: (c.textContent || "").trim(),
                lines: Math.round(fr.height / (parseFloat(getComputedStyle(c).lineHeight) || 14)) };
  lk.textContent = ""; ah.textContent = "";
  return out;
};

const settle = page => page.evaluate(() => {
  const I = window.__IDS, S = I.S();
  I.revealAll(); S.cash = 5e5; S.peakGalaxy = 3;
  S.vault[S.galaxy] = { conquered: true, earned: 0, mine: true, mineBuf: 0.4 };
  for (const d of I.dots()) d.hp = -1;
  I.recompute(); I.syncHUD();
});

(async () => {
  const browser = await chromium.launch();
  const fails = [], errs = [];
  const say = (k, v) => console.log("  " + k.padEnd(22) + v);

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    page.on("pageerror", e => errs.push(v.n + ": " + e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForFunction("!!window.__IDS");
    await page.click("#home-play");
    await page.waitForTimeout(600);
    await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
    await page.evaluate(() => { const I = window.__IDS; I.revealAll(); I.syncHUD(); });
    await page.waitForTimeout(500);

    // ---- P1: fly a real core and see where it lands ----
    await page.evaluate(() => window.__SIM.queueCoreFx(3, "gate"));
    await page.waitForTimeout(900);
    const ct = await page.evaluate(coreTarget);
    if (!ct.flew) { fails.push(v.n + " / P1: queued a core and nothing ever flew"); say(v.n + " P1", "NO FLIGHT"); }
    else {
    say(v.n + " P1", "◈ flew to (" + ct.x + "," + ct.y + ") from " + ct.from + " → hits " + ct.hit);
    if (!ct.navThere) fails.push(v.n + " / P1: no ASCEND nav item on the play screen to fly a core to");
    else {
      if (ct.from !== "nav") fails.push(v.n + " / P1: the core target fell back to a hard-coded corner while the nav was up");
      if (!ct.inView) fails.push(v.n + " / P1: cores fly to (" + ct.x + "," + ct.y + "), off a " + v.w + "x" + v.h + " screen");
      if (!ct.onAscend) fails.push(v.n + " / P1: cores land on \"" + ct.hit + "\", not on the ASCEND control that counts them");
    } }

    // ---- P3: the banner foot with both warnings up — the state from the owner's screenshot ----
    await page.evaluate(() => { const I = window.__IDS, S = I.S();
      S.cash = 1e12; I.recompute(); I.syncHUD(); });
    await page.waitForTimeout(400);
    const fb = await page.evaluate(footBox);
    say(v.n + " P3", "foot " + fb.footH + "px (~" + fb.lines + " rows), cap \"" + fb.capTxt + "\" "
      + (fb.capClipped ? "CLIPPED" : "whole"));
    if (!fb.there) fails.push(v.n + " / P3: no banner foot or capacity readout to measure");
    else if (fb.capClipped) fails.push(v.n + " / P3: the capacity readout is cut off by the banner foot");

    // ---- P2: the settled overlay ----
    await settle(page);
    await page.waitForTimeout(900);
    const ov = await grabOverlay(page);
    const digits = ov.lines.filter(l => /\d/.test(l));
    say(v.n + " P2", ov.found ? ov.lines.length + " line(s): " + ov.lines.map(l => '"' + l + '"').join(" ") : "NO SETTLED OVERLAY DRAWN");
    if (!ov.found) fails.push(v.n + " / P2: a settled world drew no banner at all");
    else {
      if (ov.lines.length > 2) fails.push(v.n + " / P2: the settled overlay prints " + ov.lines.length + " lines over the field — the panel says the rest");
      if (digits.length) fails.push(v.n + " / P2: the overlay carries a number the panel keeps live: \"" + digits[0] + "\"");
    }

    // ---- P2b: nothing the overlay dropped may be lost — the panel must still say it ----
    const sp = await page.evaluate(() => { const e = document.querySelector("#settle-panel");
      const cs = e && getComputedStyle(e);
      return { up: !!(e && cs.display !== "none" && e.getBoundingClientRect().height > 1), txt: (e ? e.textContent : "") }; });
    if (!sp.up) fails.push(v.n + " / P2b: the settlement panel is not on screen, so the overlay's pointer to it is a lie");
    else {
      const has = re => re.test(sp.txt);
      if (!has(/no credits/i)) fails.push(v.n + " / P2b: the panel never says a settled world pays no credits");
      if (!has(/free/i)) fails.push(v.n + " / P2b: the panel never says launching is free");
      if (!has(/digging|BUILDING THE SITE|seam/i)) fails.push(v.n + " / P2b: the panel never reports the mine");
    }

    await page.close();
  }
  await browser.close();

  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nPLAY HUD GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL PLAY HUD GATES PASS — cores land on the counter, the banner says it once, the cap is whole");
})();
