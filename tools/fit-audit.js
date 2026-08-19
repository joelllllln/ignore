#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/fit-audit.js — DOES THE UI ACTUALLY FIT?
//
// Owner ask (v18.71): "make sure the UI fits out, for example" — attached to a
// screenshot of the SKILL TREE where the node-detail panel's UPGRADE button was
// swallowed by the two-tier nav and the panel sat on top of Recenter / SELL ONE.
//
// screen-audit.js already walked the five NAV destinations. It could not have
// caught this: the skill tree is not on the nav, it is opened from a shop row.
// This tool walks EVERY screen the game can show, including the ones behind
// other screens, and asks three questions of each of them:
//
//   F1 CLIPPED   — is any interactive control (or the panel holding it) outside
//                  the viewport, or underneath the persistent nav bar? The nav
//                  is fixed and always on top, so anything beneath it is gone.
//   F2 COVERED   — is any interactive control hidden behind another element?
//                  Asked with elementFromPoint at the control's own centre, so
//                  it is about what a THUMB would hit, not about z-index theory.
//   F3 OVERFLOW  — does any element's content spill its own box (scrollWidth or
//                  scrollHeight past clientWidth/Height) without that box being
//                  scrollable? That is text clipped mid-word, not a scroll list.
//
// A control 1px under the nav is as unusable as one a mile off screen, so the
// bar is the same for both. Panels that are DELIBERATELY scrollable (#up-list,
// #eco-list, the how-to body) are exempt from F3 by computed overflow, not by a
// name whitelist — a list that stops scrolling stops being exempt.
//
// Run: node tools/fit-audit.js         (needs Playwright)
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");

// the shapes that actually break: the narrowest phone, the shortest phone, a
// normal phone, a big phone, and landscape (where vertical room is scarcest).
const VIEWS = [
  { n: "Fold closed", w: 280, h: 653 },
  { n: "iPhone SE1", w: 320, h: 568 },
  { n: "iPhone 14", w: 390, h: 844 },
  { n: "iPhone 14 PMx", w: 430, h: 932 },
  { n: "phone landsc", w: 844, h: 390 },
];

// Every screen, how to open it, and (where a screen has interesting INNER
// state) what to do once it is open. The skill-tree entry selects a node,
// because an unselected tree hides the very panel the owner photographed.
const SCREENS = [
  { k: "play", open: () => { window.__IDS.navGo("play"); } },
  { k: "army", open: () => { window.__IDS.navGo("upgrades"); } },
  { k: "economy", open: () => { window.__IDS.navGo("economy"); } },
  { k: "planets", open: () => { window.__IDS.navGo("map"); } },
  { k: "ascend", open: () => { window.__IDS.navGo("ascend"); } },
  { k: "menu", open: () => { window.__IDS.navGo("more"); } },
  { k: "settings", open: () => { window.__IDS.navGo("more"); document.querySelector("#menu-settings").click(); } },
  { k: "how-to", open: () => { window.__IDS.navGo("more"); document.querySelector("#menu-settings").click(); document.querySelector("#set-how").click(); } },
  { k: "stats", open: () => { window.__IDS.navGo("more"); document.querySelector("#menu-stats").click(); } },
  { k: "auto-buy", open: () => { window.__IDS.navGo("play"); const b = document.querySelector("#btn-auto"); if (b) b.click(); } },
  { k: "unit info", open: () => { window.__IDS.navGo("upgrades"); window.__IDS.showInfo("Turret", "turret"); } },
  // THE ONE FROM THE SCREENSHOT: the tree with a node picked, so #st-info is up.
  // `must` — controls that have to be visible WITHOUT scrolling. F1 forgives anything inside a
  // scroll box as "one flick away", which is right for a list row and wrong for the panel's only
  // action: on a 320x568 phone the ALLOCATE button was 0 of its 38px visible, scrolled out of the
  // very panel that exists to offer it. Nothing else on the screen said the node cost anything.
  { k: "skill tree", must: ["#st-upgrade"],
    open: () => { window.__IDS.navGo("upgrades"); window.__IDS.openSkillTree("turret"); } },
  // PICK MODE adds a whole extra pill to the same column and swaps the foot hint for live feedback
  { k: "tree pick", must: ["#st-pick-done", "#st-pick-tip"],
    open: () => { window.__IDS.navGo("upgrades"); window.__IDS.openSkillTree("turret");
      window.__IDS.STree.pick = true;
      window.__IDS.STree.pickStep = { target: "tree:turret", nodes: {} }; } },
];

// what a player can actually press
const CTL = 'button, [role="button"], input, select, a[href], .up, .nv, .ab, .tab, .mnav, .perk, .ax-row';

const probe = (navSel, CTL) => {
  const vis = el => { const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05; };
  const shown = el => { if (!vis(el)) return false;
    let p = el.parentElement; while (p) { if (!vis(p)) return false; p = p.parentElement; } return true; };
  const named = el => el.id || (el.className && String(el.className).trim().split(/\s+/).slice(0, 2).join(".")) || el.tagName.toLowerCase();

  // ---- THE LIVE LAYER ----------------------------------------------------
  // A full-screen modal hides what is under it. A control down there is not
  // "covered" in any sense a player cares about — it is on another screen.
  // So the audit only ever looks at the TOPMOST open modal (by paint order),
  // plus the nav, which is fixed above everything by design. Without this the
  // report is 90% noise about the banner sitting behind the shop.
  const modals = [...document.querySelectorAll(".modal")].filter(shown);
  const top = modals.length ? modals[modals.length - 1] : null;
  const nav = document.querySelector(navSel);
  const inLayer = el => (nav && nav.contains(el)) || (top ? top.contains(el) : !modals.some(m => m.contains(el)));

  // the nav is fixed and paints over everything — its top edge is a hard floor
  // for every control that is NOT part of the nav itself
  const navTop = nav && vis(nav) ? nav.getBoundingClientRect().top : innerHeight;

  // A control below the fold of a panel that SCROLLS is not clipped — it is one
  // flick away, and its raw bounding rect lies about where it is on screen. So
  // every rect is intersected with every clipping ancestor first. What survives
  // is what the player can actually SEE right now:
  //   • visible and under the nav / off the viewport  -> unreachable, a defect
  //   • not visible, but inside something scrollable  -> one flick away, fine
  //   • not visible, with nothing to scroll           -> clipped away, a defect
  const clipRect = el => { let r = el.getBoundingClientRect();
    let p = el.parentElement;
    while (p && p !== document.documentElement) { const s = getComputedStyle(p);
      if (s.overflow !== "visible" || s.overflowX !== "visible" || s.overflowY !== "visible") {
        const q = p.getBoundingClientRect();
        r = { left: Math.max(r.left, q.left), right: Math.min(r.right, q.right),
              top: Math.max(r.top, q.top), bottom: Math.min(r.bottom, q.bottom) }; }
      p = p.parentElement; }
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
             w: Math.max(0, r.right - r.left), h: Math.max(0, r.bottom - r.top) }; };
  const scrollable = el => { let p = el.parentElement;
    while (p && p !== document.body) { const s = getComputedStyle(p);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && p.scrollHeight > p.clientHeight + 2) return true;
      if ((s.overflowX === "auto" || s.overflowX === "scroll") && p.scrollWidth > p.clientWidth + 2) return true;
      p = p.parentElement; }
    return false; };

  const clipped = [], covered = [], overflow = [];
  for (const el of document.querySelectorAll(CTL)) {
    if (!shown(el) || !inLayer(el)) continue;
    const raw = el.getBoundingClientRect();
    if (raw.width < 1 || raw.height < 1) continue;
    const r = clipRect(el);

    // F1 — off screen, or under the nav. Both make the control unreachable.
    if (r.w < 1 || r.h < 1) {
      if (!scrollable(el)) clipped.push(named(el) + " clipped away");
      continue;
    }
    const under = !(nav && nav.contains(el)) && r.bottom > navTop + 0.5;
    const off = r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5;
    if (under || off) {
      clipped.push(named(el) + (under ? " under-nav by " + Math.round(r.bottom - navTop) + "px" : " off-screen"));
      continue;   // an unreachable control cannot also be meaningfully hit-tested
    }
    // F2 — what does a thumb at the middle of the VISIBLE part actually hit?
    const hit = document.elementFromPoint(r.left + r.w / 2, r.top + r.h / 2);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) covered.push(named(el) + " <- " + named(hit));
  }

  // F3 — content spilling a box that is not scrollable
  for (const el of document.querySelectorAll("div, span, p, h1, h2, h3, b, button")) {
    if (!shown(el) || !inLayer(el)) continue;
    const s = getComputedStyle(el);
    const scrollsY = s.overflowY === "auto" || s.overflowY === "scroll";
    const scrollsX = s.overflowX === "auto" || s.overflowX === "scroll";
    // ellipsis IS the designed answer to horizontal overflow — not a defect
    const ellipsis = s.textOverflow === "ellipsis";
    const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;
    if (!scrollsY && s.overflowY === "hidden" && dy > 2) overflow.push(named(el) + " +" + dy + "px tall");
    else if (!scrollsX && s.overflowX === "hidden" && !ellipsis && dx > 2) overflow.push(named(el) + " +" + dx + "px wide");
  }
  // F4 — named controls that must be visible without scrolling (see `must` above)
  const buried = [];
  for (const sel of (window.__FIT_MUST || [])) {
    const el = document.querySelector(sel);
    if (!el || !shown(el)) { buried.push(sel + " missing"); continue; }
    const r = clipRect(el);
    if (r.w < 1 || r.h < 1) buried.push(sel + " scrolled out of view");
    else { const raw = el.getBoundingClientRect();
      if (r.h < raw.height - 2) buried.push(sel + " only " + Math.round(r.h) + "/" + Math.round(raw.height) + "px visible"); }
  }

  return { clipped: [...new Set(clipped)], covered: [...new Set(covered)], overflow: [...new Set(overflow)], buried: [...new Set(buried)] };
};

(async () => {
  const browser = await chromium.launch();
  const fails = [];
  let pageErrors = [];

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    page.on("pageerror", e => pageErrors.push(v.n + ": " + e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForFunction("!!window.__IDS");
    await page.click("#home-play");
    await page.waitForTimeout(600);
    await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
    // a fully unlocked, mid-run save: every panel populated, nothing hidden by
    // progressive reveal, so the audit sees the BUSIEST version of each screen
    await page.evaluate(() => {
      const I = window.__IDS, S = I.S();
      I.revealAll(); S.cash = 5e6; I.awardCores(40);
      for (let i = 0; i < 3; i++) { I.buyUnit("turret"); I.buyUnit("drone"); }
      I.recompute(); I.syncHUD();
    });
    await page.waitForTimeout(300);
    console.log("\n== " + v.n + " " + v.w + "x" + v.h + " ==");

    for (const sc of SCREENS) {
      await page.evaluate(fn => { new Function("return (" + fn + ")")()(); }, sc.open.toString());
      await page.waitForTimeout(sc.k.indexOf("tree") === 0 || sc.k === "skill tree" ? 700 : 380);
      // the skill tree needs a node SELECTED for #st-info to exist at all —
      // that is the panel in the owner's screenshot, so select one for real
      if (sc.k === "skill tree" || sc.k === "tree pick") {
        await page.evaluate(() => { const G = window.__IDS.buildTree("turret");
          const n = G.nodes.find(x => x.kind !== "start"); if (n) window.__IDS.showNodeInfo(n); });
        await page.waitForTimeout(320);
      }
      await page.evaluate(m => { window.__FIT_MUST = m; }, sc.must || []);
      const res = await page.evaluate(([src, navSel, ctl]) => new Function("return (" + src + ")")()(navSel, ctl), [probe.toString(), "#nav", CTL]);
      const bad = res.clipped.length || res.covered.length || res.overflow.length || res.buried.length;
      console.log("  " + sc.k.padEnd(11)
        + " clipped " + (res.clipped.join(", ") || "-").slice(0, 46).padEnd(46)
        + " covered " + (res.covered.join(", ") || "-").slice(0, 38).padEnd(38)
        + " overflow " + (res.overflow.join(", ") || "-").slice(0, 26).padEnd(26)
        + " must-see " + (res.buried.join(", ") || (sc.must ? "ok" : "-")));
      if (bad) fails.push(v.n + " / " + sc.k + ": "
        + [res.clipped.length ? "CLIPPED " + res.clipped.join(", ") : "",
           res.covered.length ? "COVERED " + res.covered.join(", ") : "",
           res.overflow.length ? "OVERFLOW " + res.overflow.join(", ") : "",
           res.buried.length ? "BURIED " + res.buried.join(", ") : ""].filter(Boolean).join(" | "));
      await page.evaluate(() => window.__IDS.navGo("play"));
      await page.waitForTimeout(200);
    }
    await page.close();
  }
  await browser.close();

  console.log("\npage errors: " + (pageErrors.length ? pageErrors.join("\n  ") : "none"));
  if (pageErrors.length) fails.push("page errors: " + pageErrors.length);
  if (fails.length) { console.log("\nFIT AUDIT FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL FIT GATES PASS — every control on every screen is on screen, above the nav, unobstructed and unclipped");
})();
