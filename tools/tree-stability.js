#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/tree-stability.js — THE SKILL TREE MUST NOT MOVE UNDER YOUR FINGER
//
// Owner ask (v18.72): "the upgrade tree is having some issues with resetting
// position when I click certain things."
//
// It was mine. v18.71 made the node-detail panel a flex item in the tree column
// to stop it reaching under the nav. That fixed the fit and broke the feel: the
// panel took ~190px of height from the canvas, and the tree's scale is derived
// from min(canvasW, canvasH), so TAPPING A NODE re-scaled and re-centred the
// whole web. Measured on a 390x844 phone: a node sitting at y=211 leapt to
// y=118 and shrank 20%, every single tap. You would pan to the wing you wanted,
// tap it, and the wing would be somewhere else.
//
// Fit gates cannot see this — everything still FITS, it just moves. So this is
// its own question, asked the only way that means anything: pan and zoom to an
// arbitrary spot, then do the things a player does, and check that a chosen
// node is still at exactly the same screen pixel afterwards.
//
//   S1  tapping a node does not move the tree
//   S2  opening and closing the "what does this boost?" modal does not move it
//   S3  allocating the node does not move it
//   S4  entering PICK mode does not move it
//   S5  deselecting (tapping empty space) does not move it
//   S6  the canvas backing store always matches its CSS box — a drifted canvas
//       draws the tree stretched, and the hit boxes stop matching the pixels
//
// Tolerance is 1px: this is about a tree that stays put, not about float noise.
//
// Run: node tools/tree-stability.js         (needs Playwright)
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
const TOL = 1;

// where is a fixed node on screen right now, and is the canvas honest?
const snap = () => {
  const I = window.__IDS, T = I.STree, G = I.buildTree(T.type);
  const n = G.nodes.find(x => x.kind !== "start");
  const s = T.sc(n.x, n.y), cv = document.querySelector("#sttree");
  const r = cv.getBoundingClientRect();
  return { x: s.x, y: s.y, u: s.u, zoom: T.zoom, cx: T.cx, cy: T.cy,
           drift: Math.abs(cv.clientWidth - T.w) + Math.abs(cv.clientHeight - T.h),
           cssW: Math.round(r.width), cssH: Math.round(r.height) };
};
const moved = (a, b) => Math.abs(a.x - b.x) > TOL || Math.abs(a.y - b.y) > TOL || Math.abs(a.u - b.u) > 0.05;
const delta = (a, b) => "moved " + Math.round(b.x - a.x) + "," + Math.round(b.y - a.y) + "px, scale x" + (b.u / a.u).toFixed(2);

(async () => {
  const browser = await chromium.launch();
  const fails = [];
  const errs = [];

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    page.on("pageerror", e => errs.push(v.n + ": " + e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForFunction("!!window.__IDS");
    await page.click("#home-play");
    await page.waitForTimeout(600);
    await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click();
      const I = window.__IDS; I.revealAll(); I.S().cash = 5e6; I.recompute(); I.syncHUD(); });
    await page.evaluate(() => { window.__IDS.navGo("upgrades"); window.__IDS.openSkillTree("turret"); });
    await page.waitForTimeout(600);

    // pan and zoom somewhere arbitrary — a tree parked at the origin could hide a
    // reset, because reset() puts it back exactly where it already was
    await page.evaluate(() => { const T = window.__IDS.STree; T.cx = 40; T.cy = -30; T.zoom = 1.6; });
    await page.waitForTimeout(120);
    const base = await page.evaluate(snap);
    const row = [];
    const check = async (label, act) => {
      await page.evaluate(act);
      await page.waitForTimeout(350);
      const now = await page.evaluate(snap);
      if (moved(base, now)) { fails.push(v.n + " / " + label + ": " + delta(base, now)); row.push(label + " MOVED"); }
      else if (now.drift > 1) { fails.push(v.n + " / " + label + ": canvas drifted " + now.drift + "px from its CSS box"); row.push(label + " DRIFT"); }
      else row.push(label + " ok");
    };

    // S1 — tap the node
    await check("tap", () => { const T = window.__IDS.STree, G = window.__IDS.buildTree(T.type);
      const n = G.nodes.find(x => x.kind !== "start"); const s = T.sc(n.x, n.y); T.tap(s.x, s.y); });
    // S2 — the "what does this boost?" modal, open then closed
    await check("info", () => { const b = document.querySelector("#si-info-btn"); if (b) b.click(); });
    await check("info-x", () => { const b = document.querySelector("#info-close"); if (b) b.click(); });
    // S3 — buy it
    await check("allocate", () => { const b = document.querySelector("#st-upgrade"); if (b && !b.disabled) b.click(); });
    // S4 — PICK mode adds a whole pill to the column
    await check("pick-on", () => { const T = window.__IDS.STree;
      T.pick = true; T.pickStep = { target: "tree:turret", nodes: {} }; });
    await check("pick-off", () => { const T = window.__IDS.STree; T.pick = false; T.pickStep = null; });
    // S5 — deselect by tapping empty space (closes the panel again)
    await check("deselect", () => { window.__IDS.showNodeInfo(null); });

    console.log("  " + (v.n + " " + v.w + "x" + v.h).padEnd(24) + row.join("  "));
    await page.close();
  }
  await browser.close();

  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nTREE STABILITY FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL TREE STABILITY GATES PASS — the web stays exactly where you left it");
})();
