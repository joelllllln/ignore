#!/usr/bin/env node
// ---------------------------------------------------------------------------
// tools/boss-timer.js — THE COUNTDOWN MUST BE THE SPAWNER'S OWN CLOCK
//
// Owner ask (v18.77): "include a timer until the next mini boss spawns in."
//
// A readout like this is only worth having if it is TRUE, and the easy way to
// build one is a second timer that drifts away from the real thing. The
// spawner's clock only advances while the field is boss-free AND the world is
// unsettled; a naive countdown keeps ticking through both and then lies to you
// about when the wheel is coming. So every check here compares what the BANNER
// says against what the SPAWNER is actually holding.
//
//   B1  the readout counts DOWN in real time, at real time (±1s over 6s)
//   B2  it reaches 0:00 and a boss really spawns there — the clock is not
//       decorative, and it does not fire early or late
//   B3  while a boss is on the field the spawner's clock is frozen, and the
//       readout says so instead of showing a number that is not moving
//   B4  a settled world spawns no bosses, so the readout is EMPTY — not a
//       frozen countdown implying one is coming
//   B5  the displayed time equals the spawner's own remaining time, to the
//       second, at several points across the interval
//
// Run: node tools/boss-timer.js         (needs Playwright)
// ---------------------------------------------------------------------------
"use strict";
function requirePlaywright() { try { return require("playwright"); } catch (e) { try { return require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("This tool needs Playwright"); process.exit(1); } } }
const { chromium } = requirePlaywright();
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "..", "index.html");

// "  ·  ▲ BOSS 3:58" -> 238
const parse = txt => { const m = /(\d+):(\d\d)/.exec(txt || ""); return m ? +m[1] * 60 + +m[2] : null; };

const read = () => { const e = document.querySelector("#ui-boss");
  return { txt: (e.textContent || "").trim(), soon: e.classList.contains("soon"), here: e.classList.contains("here"),
           left: window.__SIM.bossLeft(), boss: window.__IDS.dots().filter(d => d.boss).length }; };

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
  await page.waitForTimeout(400);

  const fails = [];
  const say = (k, v) => console.log("  " + k.padEnd(26) + v);

  // B1 — it counts down at real speed
  const a = await page.evaluate(read);
  await page.waitForTimeout(6000);
  const b = await page.evaluate(read);
  const drop = parse(a.txt) - parse(b.txt);
  say("B1 counts down", a.txt + "  ->  " + b.txt + "   (" + drop + "s in 6s)");
  if (!(drop >= 5 && drop <= 7)) fails.push("the countdown ran at " + drop + "s per 6s of real time");

  // B5 — the number on screen is the spawner's own number, sampled across the interval
  const agree = [];
  for (const acc of [10, 90, 180, 231, 239]) {
    await page.evaluate(v => window.__SIM.setBossAcc(v), acc);
    await page.waitForTimeout(220);
    const r = await page.evaluate(read);
    const shown = parse(r.txt), real = Math.floor(r.left);
    agree.push(shown + "/" + real);
    if (Math.abs(shown - real) > 1) fails.push("banner says " + shown + "s, the spawner is holding " + real + "s");
    if (real <= 15 && !r.soon) fails.push("no warning class at " + real + "s left");
    if (real > 20 && r.soon) fails.push("warning class at " + real + "s left — too early to mean anything");
  }
  say("B5 shown/actual", agree.join("  "));

  // B2 — run it to zero and check a boss really appears there
  await page.evaluate(() => window.__SIM.setBossAcc(237));
  let fired = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250);
    const r = await page.evaluate(read);
    if (r.boss > 0) { fired = r; break; }
  }
  say("B2 fired at 0:00", fired ? "yes — readout now \"" + fired.txt + "\"" : "NO BOSS EVER SPAWNED");
  if (!fired) fails.push("the countdown reached zero and no boss spawned");
  else if (!fired.here) fails.push('a boss is on the field but the readout does not say so: "' + fired.txt + '"');

  // B3 — the spawner's clock is frozen while it is up, and the readout is not a stale number
  const f1 = await page.evaluate(read);
  await page.waitForTimeout(3000);
  const f2 = await page.evaluate(read);
  say("B3 frozen while up", "spawner " + Math.round(f1.left) + "s -> " + Math.round(f2.left) + "s, readout \"" + f2.txt + "\"");
  if (Math.abs(f1.left - f2.left) > 0.5) fails.push("the spawner's clock advanced while a boss was on the field");
  if (parse(f2.txt) !== null) fails.push('the readout shows a frozen countdown while a boss is up: "' + f2.txt + '"');

  // B4 — a settled world has no bosses coming, so it says nothing at all
  await page.evaluate(() => { const I = window.__IDS, S = I.S();
    for (const d of I.dots()) if (d.boss) d.hp = -1;
    S.vault[S.galaxy] = { conquered: true, earned: 0 }; I.recompute(); I.syncHUD(); });
  await page.waitForTimeout(1200);
  const st = await page.evaluate(read);
  say("B4 settled world", st.txt === "" ? "empty (correct)" : '"' + st.txt + '"');
  if (st.txt !== "") fails.push('a settled world spawns no bosses but the readout says "' + st.txt + '"');

  await browser.close();
  console.log("\npage errors: " + (errs.length ? errs.join("\n  ") : "none"));
  if (errs.length) fails.push("page errors: " + errs.length);
  if (fails.length) { console.log("\nBOSS TIMER GATES FAILED (" + fails.length + ")"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("\nALL BOSS TIMER GATES PASS — the banner is showing the spawner's own clock");
})();
