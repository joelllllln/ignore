#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/ability-check.js — THE POWERS SET UP KILLS, THEY DO NOT MAKE THEM
//
// Owner ask (v18.74): "the black hole shouldn't ever kill a dot directly."
//
// It did, and it did nearly all of them. Measured on the v18.73 build with a
// real turret build (6 turrets, 97 tree nodes) against a full field:
//
//     during a 5s Black Hole:  230 dots died, 228 credited to the ABILITY
//     your six turrets:        2
//
// The ability was the army. That is the wrong shape for this game, where damage
// is supposed to be the thing you built. It is a gravity well now — it drags
// the field into your guns and the guns do the work.
//
// Three gates, and the second is what stops the first from being satisfied the
// lazy way (deleting the ability would trivially pass "credits no kills"):
//
//   A1  a Black Hole credits ZERO kills to itself, on a full field, with a
//       build that can actually kill. Not "few" — zero.
//   A2  it is still worth its 60s cooldown: kills during the 5s must clearly
//       beat a quiet 5s. Measured over three windows and compared on the
//       median, because a single window on a live field is noisy (the same
//       lesson loop-probe's L1 gate learned).
//   A3  the pull actually pulls: measured PER DOT, not as a field average. The
//       average is useless here — the dots the well drags in are the ones your
//       guns then kill, so they leave the array and fresh ones spawn at the rim,
//       and the mean radius barely moves while the pull is working perfectly.
//
// Run: node tools/ability-check.js         (needs Playwright)
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");

const MIN_GAIN = 1.6;    // a 60s cooldown has to buy more than a passive five seconds
const ROUNDS = 3;

// a build that can actually kill: six turrets and a fully-spent tree. Without
// this the whole test is vacuous — a field nothing can kill reports zero kills
// for the ability and zero for the army, and A1 passes for the wrong reason.
const BUILD = () => {
  const I = window.__IDS, S = I.S();
  I.revealAll(); S.cash = 1e12;
  for (let i = 0; i < 6; i++) I.buyUnit("turret");
  const G = I.buildTree("turret");
  for (let pass = 0; pass < 40; pass++) for (const n of G.nodes) {
    if (n.kind === "start") continue;
    if (!I.nodeAllocated("turret", n.id) && I.nodeAllocatable("turret", n)) I.allocNode("turret", n);
  }
  for (let i = 0; i < 14; i++) I.buyUp("value");
  for (let i = 0; i < 22; i++) I.buyUp("spawnRate");
  S.cash = 1e12; I.recompute(); I.syncHUD();
};

const snap = () => {
  const I = window.__IDS, st = I.META().stats;
  return { popped: st.dotsPopped | 0, bh: (st.kills.blackhole) | 0, dots: I.dots().length };
};

// A3 measures the pull PER DOT, not as a field average. The average is useless here:
// the dots the well drags in are the ones your guns then kill, so they leave the array
// and fresh ones spawn at the rim — the mean radius barely moves while the pull is
// working perfectly. Tag each dot's radius, wait, and read the drift of the survivors.
const tagR = () => { const I = window.__IDS, cx = I.worldCX(), cy = I.worldCY();
  for (const d of I.dots()) d.__r0 = Math.hypot(d.x - cx, d.y - cy); };
const readR = () => { const I = window.__IDS, cx = I.worldCX(), cy = I.worldCY();
  let n = 0, sum = 0;
  for (const d of I.dots()) { if (d.__r0 === undefined) continue;
    sum += Math.hypot(d.x - cx, d.y - cy) - d.__r0; n++; }
  return { n, drift: n ? sum / n : 0 }; };

const median = a => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction("!!window.__IDS");
  await page.click("#home-play");
  await page.waitForTimeout(700);
  await page.evaluate(() => { const t = document.querySelector("#tut-skip"); if (t) t.click(); });
  await page.evaluate(BUILD);
  await page.waitForTimeout(10000);   // let the field fill

  const fails = [];
  const quiet = [], loud = [], bhCredit = [];
  let pull = null;

  for (let r = 0; r < ROUNDS; r++) {
    // a quiet window first, as the baseline for this round
    let a = await page.evaluate(snap);
    await page.waitForTimeout(5200);
    let b = await page.evaluate(snap);
    quiet.push(b.popped - a.popped);

    await page.waitForTimeout(4000);   // let the field refill before firing

    a = await page.evaluate(snap);
    await page.evaluate(() => { window.__IDS.useAbility("blackhole"); });
    await page.evaluate(tagR);
    await page.waitForTimeout(1000);
    const drift = await page.evaluate(readR);        // A3: per-dot radial drift while it is running
    await page.waitForTimeout(4200);
    b = await page.evaluate(snap);
    loud.push(b.popped - a.popped);
    bhCredit.push(b.bh - a.bh);
    if (r === 0) pull = { drift: drift.drift, tracked: drift.n, dots: a.dots };

    // the ability is on a 60s cooldown — wait it out before the next round
    await page.evaluate(() => { window.__IDS.abil().blackhole = 0.01; });
    await page.waitForTimeout(6000);
  }
  // ---- A4/A5: the powers belong to the PLAY screen and nowhere else ----
  // Owner (v18.87): "the 3 temporary boosts — the boxes — make sure on other screens they're not
  // affecting things." Two separate ways they could: the row could move or intercept things on the
  // other tabs, or an ability could still be SPENT while you are not looking at the field. The
  // second was live: useAbility guarded on `state`, which is home-vs-play and stays "play" on every
  // nav tab, so the 1/2/3 keyboard shortcut fired from the Economy and Army panels (they are not
  // `.modal.show`, which is all its own guard excluded). You paid a 60-second cooldown for an
  // effect you could not see.
  console.log("\n=== A4/A5 — the powers stay on the play screen ===");
  console.log("  screen      row       nav dest top   tap at the row lands on      ability spendable");
  const abilFails = [], abilNavTops = [];
  for (const sc of ["play", "map", "upgrades", "economy", "ascend"]) {
    await page.evaluate(k => window.__IDS.navGo(k), sc);
    await page.waitForTimeout(650);
    const r = await page.evaluate(() => {
      const I = window.__IDS, a = I.abil();
      for (const k in a) a[k] = 0;                       // abil maps key -> COOLDOWN NUMBER
      const row = document.querySelector("#abilities");
      const cs = row ? getComputedStyle(row) : null, rr = row ? row.getBoundingClientRect() : null;
      const nav = document.querySelector("#nav .nav-dest");
      const x = rr && rr.width > 1 ? rr.left + rr.width / 2 : innerWidth / 2;
      const y = rr && rr.height > 1 ? rr.top + rr.height / 2
        : (document.querySelector("#nav").getBoundingClientRect().top - 20);
      const hit = document.elementFromPoint(x, y);
      I.useAbility("blackhole");                          // the source every path goes through
      return { shown: !!(cs && cs.display !== "none" && rr.height > 1),
        destTop: Math.round(nav.getBoundingClientRect().top),
        hit: hit ? (hit.id || (typeof hit.className === "string" && hit.className) || hit.tagName) : "nothing",
        spent: (I.abil().blackhole || 0) > 0 };
    });
    console.log("   " + sc.padEnd(10) + (r.shown ? "shown" : "hidden").padEnd(10)
      + String(r.destTop).padStart(11) + "    " + String(r.hit).slice(0, 26).padEnd(28) + r.spent);
    if (sc === "play") {
      if (!r.shown) abilFails.push("A4: the ability row is not on the PLAY screen at all");
      if (!r.spent) abilFails.push("A5: an ability cannot be spent on the play screen");
    } else {
      if (r.shown) abilFails.push("A4 / " + sc + ": the ability row is on screen where it does not belong");
      if (/^ab-|abilities/.test(String(r.hit))) abilFails.push("A4 / " + sc + ": a tap where the row sits still lands on an ability box (" + r.hit + ")");
      if (r.spent) abilFails.push("A5 / " + sc + ": an ability was SPENT from this screen — cooldown paid for an effect you cannot see");
    }
    abilNavTops.push(r.destTop);
  }
  // A4: the row must not shove the nav's destination buttons around as it comes and goes
  if (new Set(abilNavTops).size > 1)
    abilFails.push("A4: the nav destinations move between screens (" + abilNavTops.join(", ") + ") — the row is shifting the furniture");
  for (const f of abilFails) fails.push(f);

  await browser.close();

  const credited = bhCredit.reduce((s, v) => s + v, 0);
  const mq = Math.max(1, median(quiet)), ml = median(loud), gain = ml / mq;

  console.log("build                6 turrets, tree fully spent");
  console.log("field at fire        " + pull.dots + " dots");
  console.log("A1 kills credited to the BLACK HOLE   " + bhCredit.join(", ") + "   (must be 0)");
  console.log("A2 kills during it   " + loud.join(", ") + "   vs quiet " + quiet.join(", ")
    + "   -> x" + gain.toFixed(2) + " (must beat x" + MIN_GAIN + ")");
  console.log("A3 per-dot pull    " + Math.round(pull.drift) + "px toward the centre in 1s, over " + pull.tracked + " surviving dots");


  if (credited > 0) fails.push("the Black Hole killed " + credited + " dots ITSELF — it must only pull");
  if (!(gain >= MIN_GAIN)) fails.push("the Black Hole is not worth its cooldown: x" + gain.toFixed(2) + " a quiet window (need x" + MIN_GAIN + ")");
  if (!(pull.drift < -120)) fails.push("the pull is not pulling: " + Math.round(pull.drift) + "px/s radial drift (the well is 220px/s)");
  if (errs.length) fails.push("page errors: " + errs.join(" | "));

  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (fails.length) { console.log("\nABILITY GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL ABILITY GATES PASS — the Black Hole gathers the field and your guns do the killing");
})();
