#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/map-focus.js — THE PLANET YOU PICKED MUST BE THE PLANET YOU CAN SEE
//
// Owner (v18.86, with a 828x1792 shot of the star map): "the menu is in front of the planet you're
// viewing." It was. Tapping Vesta glided the camera onto Vesta and then drew the info card straight
// over it — the card names the planet, describes its race, and hides the thing it is describing.
//
// The cause is one term. GMap.proj puts the focused point at `this.h * 0.5`, the geometric middle of
// the CANVAS, and the canvas is full-screen — while the bottom of that screen is a dock holding the
// info card, the system row and a chip per planet. On a tall phone the dock owns most of the lower
// half, so "centre of the canvas" is a point behind the furniture. The play field solved exactly
// this in v18.27 with VIEW_CY, framing the visible band instead of the canvas; the map never got it.
//
//   F1  a planet you focus lands in the VISIBLE SKY — not under the dock, not under the header,
//       not off screen. Checked for every planet, on every shape.
//   F2  ...with real clearance, so it is a planet you are looking AT rather than one grazing the
//       edge of the card (MARGIN px from either boundary).
//   F3  the YOU button and the three system chips put their target in the sky too — they are the
//       same camera move and would rot the same way.
//   F4  the sky is worth aiming at: the dock and header together must not leave less than MIN_SKY
//       of the screen. If they do, no amount of aiming helps and the dock needs to shrink.
//
// Run: node tools/map-focus.js         (needs Playwright)
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
const MARGIN = 12;      // F2 — px of clearance from the dock lid and the header
const MIN_SKY = 0.22;   // F4 — the sky must be at least this share of the screen

// Where is the sky, and where did the focused planet actually land?
const look = ([g]) => {
  const D = window.__IDS, GM = D.GMap;
  const cv = document.querySelector("#gmap");
  const r = cv.getBoundingClientRect();
  let top = 0, bot = r.height;
  const hint = document.querySelector("#galaxy-map .map-hint");
  const bar = document.querySelector("#galaxy-map .map-bar");
  for (const el of [bar, hint]) { if (!el) continue; const q = el.getBoundingClientRect();
    if (q.height > 1) top = Math.max(top, q.bottom - r.top); }
  const dock = document.querySelector("#gm-dock");
  if (dock) { const q = dock.getBoundingClientRect(); if (q.height > 1) bot = Math.min(bot, q.top - r.top); }
  const w = GM.planetWorld(g), p = GM.proj(w.x, w.y, w.z);
  return { x: p.x, y: p.y, top, bot, h: r.height, cardUp: !!document.querySelector("#gm-info.show") };
};

const pick = ([g]) => { const D = window.__IDS;
  D.GMap.navSys = null; D.GMap.focusPlanet(g); D.showGalaxyInfo(g); };

(async () => {
  const browser = await chromium.launch();
  const fails = [], errs = [];
  const say = (k, v) => console.log("  " + k.padEnd(24) + v);

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    page.on("pageerror", e => errs.push(v.n + ": " + e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForFunction("!!window.__IDS");
    await page.click("#home-play"); await page.waitForTimeout(500);
    await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
    await page.evaluate(() => { const I = window.__IDS; I.revealAll(); I.S().peakGalaxy = 18; I.syncHUD(); I.navGo("map"); });
    await page.waitForTimeout(700);

    let worst = null, sky = null;
    for (const g of [1, 2, 5, 9, 14, 18]) {
      await page.evaluate(pick, [g]);
      await page.waitForTimeout(1100);          // let the camera glide settle
      const r = await page.evaluate(look, [g]);
      sky = r;
      const overDock = r.y > r.bot - MARGIN, overHead = r.y < r.top + MARGIN;
      const off = r.y < 0 || r.y > r.h;
      const slack = Math.min(r.bot - r.y, r.y - r.top);
      if (worst == null || slack < worst.slack) worst = { g, slack, y: Math.round(r.y), top: Math.round(r.top), bot: Math.round(r.bot) };
      if (!r.cardUp) fails.push(v.n + " / P" + g + ": no info card is showing, so nothing was actually tested");
      if (off) fails.push(v.n + " / P" + g + ": the focused planet is off screen at y=" + Math.round(r.y));
      else if (overDock) fails.push(v.n + " / P" + g + " / F1: the focused planet sits at y=" + Math.round(r.y)
        + ", behind the dock that starts at " + Math.round(r.bot) + " — the card is in front of the planet it describes");
      else if (overHead) fails.push(v.n + " / P" + g + " / F2: the focused planet is jammed under the header (y=" + Math.round(r.y) + ", header ends " + Math.round(r.top) + ")");
    }
    const skyH = sky ? sky.bot - sky.top : 0, share = sky ? skyH / sky.h : 0;
    say(v.n + " " + v.w + "x" + v.h, "sky " + Math.round(sky.top) + "→" + Math.round(sky.bot)
      + " of " + Math.round(sky.h) + " (" + (100 * share).toFixed(0) + "%)   tightest planet: P" + worst.g
      + " y=" + worst.y + " clearance " + Math.round(worst.slack) + "px");
    if (share < MIN_SKY) fails.push(v.n + " / F4: the header and dock leave only " + (100 * share).toFixed(0)
      + "% of the screen as sky — there is nowhere to put the planet");

    // F3 — the YOU button and the system chips are the same camera move
    for (const [sel, lbl] of [["#gm-you", "YOU"], ["#gm-sys0", "system 1"], ["#gm-sys1", "system 2"], ["#gm-sys2", "system 3"]]) {
      const there = await page.evaluate(s => { const e = document.querySelector(s); return !!(e && e.getBoundingClientRect().height > 1); }, sel);
      if (!there) continue;
      await page.click(sel).catch(() => {});
      await page.waitForTimeout(1100);
      const r = await page.evaluate(([g]) => { const D = window.__IDS;
        const GM = D.GMap, cv = document.querySelector("#gmap"), rr = cv.getBoundingClientRect();
        let top = 0, bot = rr.height;
        for (const s of ["#galaxy-map .map-bar", "#galaxy-map .map-hint"]) { const e = document.querySelector(s);
          if (e) { const q = e.getBoundingClientRect(); if (q.height > 1) top = Math.max(top, q.bottom - rr.top); } }
        const d = document.querySelector("#gm-dock"); if (d) { const q = d.getBoundingClientRect(); if (q.height > 1) bot = Math.min(bot, q.top - rr.top); }
        // whatever the camera is looking at right now, projected
        const p = GM.proj(GM.cx, 0, GM.cz);
        return { y: p.y, top, bot };
      }, [0]);
      if (r.y > r.bot - MARGIN || r.y < r.top + MARGIN)
        fails.push(v.n + " / F3: " + lbl + " parks the camera at y=" + Math.round(r.y) + ", outside the sky " + Math.round(r.top) + "→" + Math.round(r.bot));
    }
    await page.close();
  }
  await browser.close();

  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nMAP FOCUS GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL MAP FOCUS GATES PASS — you are looking at the planet, not at the card about it");
})();
