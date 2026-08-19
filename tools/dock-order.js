#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/dock-order.js — CHROME NEVER SITS ON TOP OF THE ACTION
//
// Owner ask (v18.78): "the summon button is misplaced."
//
// It was. The dock's own order was Minimise → settlement panel → actions, so a
// 26px chrome pill sat directly ON TOP of ▲ SUMMON — the single highest-stakes
// button in a run, the thing the banner's "CONQUER 100%" is announcing. Worse,
// tapping that pill HID the summon button outright: #dock.min collapsed
// #actions along with everything else, so the offer could be dismissed by a
// control whose only job is to tidy the dock away.
//
// Measured before the fix, on a 390x844 phone with the bar full:
//     dock 90px = 26px "Minimise" ABOVE a 44px ▲ SUMMON
//     tap Minimise -> the summon button is gone
// and in landscape the button was an 825px slab across the whole world.
//
//   D1  Minimise NEVER hides the primary action — collapse the settlement
//       panel, keep the button
//   D2  chrome is BELOW the action it shares a dock with, never above it
//   D3  the toggle only exists when there is something bulky to collapse; a
//       dock holding one button has nothing to minimise
//   D4  the action is a button, not a bar: it never exceeds 560px, so a wide
//       screen gets a button rather than a slab across the whole world
//   D5  the dock can never end up collapsed with no way to expand it again
//
// Run: node tools/dock-order.js         (needs Playwright)
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
  { n: "phone landsc", w: 844, h: 390 },
];
// An ABSOLUTE cap, not a fraction of the screen. On a 320px phone the primary action SHOULD run
// nearly edge to edge — that is how a phone button looks, and how TRAVEL has always looked. The
// defect was the 844px landscape slab that ate a third of the playfield, so the rule is about how
// wide a button may ever get, not about what share of a given screen it takes.
const MAX_ACTION_PX = 560;

const box = () => {
  const g = sel => { const e = document.querySelector(sel);
    if (!e) return { there: false };
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return { there: false };
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { there: false };
    return { there: true, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
  return { toggle: g("#dock-toggle"), action: g("#btn-travel"), settle: g("#settle-panel"),
           min: document.querySelector("#dock").classList.contains("min"), vw: innerWidth };
};

const setup = async (page, state) => page.evaluate(st => {
  const I = window.__IDS, S = I.S();
  I.revealAll(); S.cash = 5e5; S.peakGalaxy = 3;
  S.vault[S.galaxy] = { conquered: st === "settled", earned: 0 };
  if (st === "full") window.__SIM.setEarned(1e12);
  I.recompute(); I.syncHUD();
}, state);

(async () => {
  const browser = await chromium.launch();
  const fails = [], errs = [];

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    page.on("pageerror", e => errs.push(v.n + ": " + e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForFunction("!!window.__IDS");
    await page.click("#home-play");
    await page.waitForTimeout(600);
    await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });

    // --- bar full: the ▲ SUMMON offer, the state from the owner's report ---
    await setup(page, "full");
    await page.waitForTimeout(700);
    let b = await page.evaluate(box);
    const row = [];
    if (!b.action.there) fails.push(v.n + " / full bar: the SUMMON button is not on screen at all");
    if (b.toggle.there) fails.push(v.n + " / full bar: a Minimise pill is offered over a dock holding one button");
    if (b.action.there && b.action.w > MAX_ACTION_PX)
      fails.push(v.n + " / full bar: the action is " + Math.round(b.action.w) + "px wide — a bar across the world, not a button (max " + MAX_ACTION_PX + ")");
    row.push("full[action " + (b.action.there ? Math.round(b.action.w) + "px" : "MISSING")
      + ", chrome " + (b.toggle.there ? "PRESENT" : "none") + "]");

    // --- settled: the settlement panel is bulky, so the toggle earns its place ---
    await setup(page, "settled");
    await page.waitForTimeout(900);
    b = await page.evaluate(box);
    if (!b.settle.there) fails.push(v.n + " / settled: no settlement panel to test against");
    if (!b.toggle.there) fails.push(v.n + " / settled: nothing offers to collapse a " + Math.round(b.settle.h) + "px panel");
    // D2 — chrome below the action, never above it
    if (b.toggle.there && b.action.there && b.toggle.top < b.action.bottom - 1)
      fails.push(v.n + " / settled: the Minimise pill sits ABOVE the primary action");
    row.push("settled[panel " + Math.round(b.settle.h) + "px, chrome " + (b.toggle.there ? "below" : "MISSING") + "]");

    // --- D1/D5 — minimise, and the action must survive it ---
    if (b.toggle.there) {
      await page.click("#dock-toggle");
      await page.waitForTimeout(500);
      const m = await page.evaluate(box);
      if (!m.action.there) fails.push(v.n + " / minimised: Minimise HID the primary action");
      if (m.settle.there) fails.push(v.n + " / minimised: the settlement panel did not collapse");
      if (!m.toggle.there) fails.push(v.n + " / minimised: no way left to expand the dock again");
      row.push("min[action " + (m.action.there ? "kept" : "LOST") + ", panel " + (m.settle.there ? "STILL UP" : "collapsed") + "]");
      await page.click("#dock-toggle"); await page.waitForTimeout(300);
    }

    // --- D5 — going back to a dock with nothing bulky must not leave it stuck collapsed ---
    if (b.toggle.there) {
      await page.click("#dock-toggle"); await page.waitForTimeout(300);
      await setup(page, "full");
      await page.waitForTimeout(800);
      const f = await page.evaluate(box);
      if (!f.action.there) fails.push(v.n + " / un-settled while minimised: the action never came back");
      if (f.min) fails.push(v.n + " / un-settled while minimised: the dock is stuck collapsed");
      row.push("unsettle[" + (f.action.there && !f.min ? "clean" : "STUCK") + "]");
    }

    console.log("  " + (v.n + " " + v.w + "x" + v.h).padEnd(24) + row.join("  "));
    await page.close();
  }
  await browser.close();

  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nDOCK ORDER GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL DOCK ORDER GATES PASS — the action is on top, and nothing can tidy it away");
})();
