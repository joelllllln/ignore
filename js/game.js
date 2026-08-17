/* =====================================================================
   IDLE DOT SHOOTER  (HTML5/Canvas, original implementation)
   Defenders are individual units, each with its own upgrade tree (tap to
   open). Drones are a coordinated collection fleet. Planets (across three
   solar systems) scale dot count + toughness. Offline earnings. Home screen.
   ===================================================================== */
(() => {
  "use strict";
  const canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  // ── bespoke icon set — hand-drawn thin-line glyphs (one source of truth; no emoji, no libraries) ──
  // monochrome, inherit currentColor; used in DOM via iconMarkup() or <i data-ico="name"> + hydrateIcons().
  const ICONS = {
    play: '<path d="M8 5.5l11 6.5-11 6.5z"/>',
    planet: '<circle cx="11" cy="11" r="5.4"/><ellipse cx="12" cy="12" rx="11" ry="3.6" transform="rotate(-24 12 12)"/>',
    help: '<path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z"/><path d="M9.8 9.4a2.3 2.3 0 1 1 3 2.2c-.8.4-1.2.9-1.2 1.8"/><circle cx="11.6" cy="16.4" r=".6" fill="currentColor" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
    reset: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M18 3.5v4h-4"/>',
    home: '<path d="M3.5 11.2L12 4l8.5 7.2"/><path d="M5.6 9.6V20h12.8V9.6"/><path d="M10 20v-5h4v5"/>',
    turret: '<circle cx="7" cy="16" r="3"/><path d="M7 13V9h5l8-2v3l-8 2H9"/><path d="M4.2 18.8L2.5 21"/>',
    shield: '<path d="M12 3l7 2.4v5.1c0 4.9-3.2 8-7 10.2-3.8-2.2-7-5.3-7-10.2V5.4z"/><path d="M9 11.5l2 2 4-4"/>',
    alien: '<path d="M12 3.4l6 4.3v8.6L12 20.6 6 16.3V7.7z"/><circle cx="9.6" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="11" r="1.1" fill="currentColor" stroke="none"/><path d="M9.5 15h5"/>',
    gem: '<path d="M6 4.5h12l3 4.6-9 10.4L3 9.1z"/><path d="M3 9.1h18M9 4.5L6 9.1l6 10.4 6-10.4-3-4.6"/>',
    tree: '<circle cx="12" cy="5" r="2.1"/><circle cx="6" cy="16" r="2.1"/><circle cx="18" cy="16" r="2.1"/><path d="M12 7.1v3.4M11 12l-4 2.3M13 12l4 2.3"/>',
    collector: '<rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.2"/><circle cx="5.4" cy="5.4" r="2.1"/><circle cx="18.6" cy="5.4" r="2.1"/><circle cx="5.4" cy="18.6" r="2.1"/><circle cx="18.6" cy="18.6" r="2.1"/><path d="M9.2 9.2L6.9 6.9M14.8 9.2l2.3-2.3M9.2 14.8l-2.3 2.3M14.8 14.8l2.3 2.3"/>',
    swords: '<path d="M4 4l11 11M9.5 15.5l-5 5M20 4L9 15"/><path d="M3.5 18l2.5 2.5M18.5 18L16 20.5"/>',
    castle: '<path d="M4 21V10h2V7.5h2V10h2V8h4v2h2V7.5h2V10h2v11z"/><path d="M10 21v-4h4v4"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7.4v9.2M9.6 9.4c0-1 1-1.7 2.4-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.5-2.5.5-2.5 1.6 1.1 1.7 2.5 1.7 2.4-.7 2.4-1.6"/>',
    brush: '<path d="M4 20.5c2.2 0 3.4-1.2 3.4-3.2"/><path d="M7 16.6l8.4-8.4 2.8 2.8-8.4 8.4z"/><path d="M15.4 8.2l2-2 .9-.9 1.9 1.9-.9.9-2 2"/>',
    bolt: '<path d="M13 2.5L5.5 13H11l-1 8.5L18.5 10H12.5z"/>',
    power: '<path d="M12 3.5v8"/><path d="M7.6 6.4a7 7 0 1 0 8.8 0"/>',
    lock: '<rect x="5" y="10.6" width="14" height="9.4" rx="1.6"/><path d="M8 10.6V8a4 4 0 0 1 8 0v2.6"/>',
    sound: '<path d="M4 9.2v5.6h3.4L13 19V5L7.4 9.2z"/><path d="M16 9.4a3.6 3.6 0 0 1 0 5.2M18.4 7a7 7 0 0 1 0 10"/>',
    vibe: '<rect x="8.2" y="4" width="7.6" height="16" rx="1.6"/><path d="M4.5 9v6M19.5 9v6M10.8 17.4h2.4"/>',
    shake: '<rect x="7" y="7" width="10" height="10" rx="1.3"/><path d="M2.5 9.5v5M21.5 9.5v5M9.5 2.5h5M9.5 21.5h5"/>',
    spark: '<path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21M5.6 5.6l2.6 2.6M15.8 15.8l2.6 2.6M18.4 5.6l-2.6 2.6M8.2 15.8l-2.6 2.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    hash: '<path d="M8.5 4L6.5 20M17.5 4l-2 16M4 9h16M3.2 15H19"/>',
    rocket: '<path d="M20 4c-4 .2-7 1.8-9.2 4.8L8 12l4 4 3.2-2.8C18.2 11 19.8 8 20 4z"/><path d="M8 12l-3.5 1 2 2M12 16l1 3.5 2-2M6.5 17.5L4 20"/>',
    rain: '<path d="M5 11a3.6 3.6 0 0 1 3.4-3.6 4.6 4.6 0 0 1 8.6-1 3.3 3.3 0 0 1 .5 6.4"/><path d="M8 16v3M12 17v3M16 16v3"/>',
    blackhole: '<ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-18 12 12)"/><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none"/>',
    chart: '<path d="M4 20V4M4 20h16M8 20v-5M12 20v-9M16 20v-6"/>',
    star4: '<path d="M12 2.2l2.3 7.5 7.5 2.3-7.5 2.3-2.3 7.5-2.3-7.5L2.2 12l7.5-2.3z" fill="currentColor" stroke="none"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };
  function iconMarkup(name, extra) { const p = ICONS[name]; if (!p) return ""; return '<svg class="ico' + (extra ? " " + extra : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>"; }
  function hydrateIcons(root) { (root || document).querySelectorAll("i[data-ico]").forEach(e => { const m = iconMarkup(e.getAttribute("data-ico"), e.getAttribute("data-cls") || ""); if (m) e.outerHTML = m; }); }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // ▶ BUILD VERSION — bump this on EVERY change (shown top-right in-game) so it's obvious which build is live.
  const VERSION = "v18.59";   // v18.59 = THREE PATTERNS BORROWED FROM SHIPPED IDLE GAMES (owner: "try emulate a strategy that already works, copy other games, research how other games make it look"). Checked this page against the prestige-screen anatomy Cookie Clicker, AdVenture Capitalist, Egg Inc and Clicker Heroes all share. We already had four of the seven shared elements — the always-visible offer on the HUD button, the gain preview, the before/after multiplier (the thing players most often ask for), and celebratory flair. Three were genuinely missing and all three are now in. (1) PROGRESS TO THE NEXT UNIT OF PRESTIGE CURRENCY — Cookie Clicker prints "next chip at N cookies" and it is the genre core retention hook, because a flat "+110" is a fact while a bar at 80% is an itch. We had a real threshold to show and were not showing it: the current world conquer bar pays floor(coreVal(g)*frac*0.5) into pending, so there is an exact earnings figure at which pending ticks up by one. nextCore() computes it, with an ETA at live income. (2) RUN IDENTITY — every one of those games puts the ascension count on screen; we already tracked runs, best and lifetime in META.asc and displayed none of them. (3) AN IN-FRAME CONFIRM — they all gate the reset behind a styled confirmation. We had one, but it was the browser native confirm(), which on a phone paints an alert carrying the domain name across a black-and-white game, AND had a real trap in it: a headless caller gets that dialog auto-dismissed, so ascend() would have silently no-opped for every future tool. The guard is now a two-tap arm on the button itself (first tap turns it amber and reads "TAP AGAIN - RESETS THE RUN", disarming after 4s; any re-render clears it), and tools/ascend-page.js drives it for real at five device sizes: one tap must arm and change nothing, two must commit and reset to P1, and no native dialog may fire. // v18.58 = THE ASCENSION LOOP, AS PICTURES (owner: "needs to be more obvious what's going on, super simple and visual"). v18.57 fixed the page's HIERARCHY but still explained prestige in sentences, and a sentence is not a picture. Three swaps, no new numbers: (1) a four-tile numbered LOOP STRIP at the very top carries the whole mechanic — lose the run / worlds pay cores / cores buy income / go deeper — so "what is this screen" is answered before you read a word, and it wraps 4-across to 2x2 under 380px; (2) the income change is now TWO BARS ON ONE AXIS instead of "x56 -> x69", because an arrow between two numbers asks you to do the division and two bars of different lengths just show you the answer; (3) RESETS vs KEEPS became icon rows rather than a five-item word list, with the columns weighted 1.42fr/1fr so the four RESETS icons sit on one line instead of orphaning "cash". The Engine block gained a fill bar for how close the bank is to the next level, dropped its explanatory sub-line into the header ("Lv 6 -> 18 affordable"), and the closing ladder paragraph lost half its words. Nothing in the model moved: same verdict logic, same engReach() math, same pendingCores(). tools/ascend-page.js extended to gate the new furniture — loop strip present with all four steps, both comparison bars present and correctly proportioned, trade icons rendered — and still passes 5 device sizes x 3 player states. Device matrix 12/12. // v18.57 = THE ASCENSION PAGE, REBUILT AROUND THE DECISION (owner: "if you had to redo the ascension page to make it as intuitive and cool as possible please remake it better"). MEASURED FIRST: the old page opened with a six-line essay, then four charts of roughly equal weight, and the ASCEND button — the one action the page exists for — sat 108% of the way down the scroll, i.e. you had to go looking for the verb. It asked "should I ascend?" in FOUR places (a coach paragraph, a wall ETA, a pending tile, and a farms-vs-hop chart) and never once answered it. The rebuild is one screen, one decision, in the order a player actually asks: HERO (what pressing it banks, and what that turns your income into) / VERDICT (a real recommendation, off the same wallEtaH() vs ASC_HOP_H the ascension sim proved) / TRADE (resets vs keeps, two columns, no prose) / ENGINE (the one thing cores buy, as the next three CONCRETE purchases instead of an abstract x-income-against-cores-spent curve) / then sources, mines and the run split folded into <details> so evidence cannot outrank the verb. The button is pinned in a sticky dock, reachable at any scroll position. THE HERO MATH WAS WRONG AND THE PROBE CAUGHT IT: it first showed ascPreview(), which pours BANKED + PENDING into the Engine together — right for "come back stronger", wrong here, because it credits ascending with cores you can already spend without ascending. On a real deep save it read "x3.8 -> x69" when the honest delta is x56 -> x69. engReach() now prices both sides separately. Same fix applied to the Engine block, which reported "your 340 reach Lv 9" when that was just the last row of a three-level window (really Lv 18). Motion deliberately echoes the upgrade milestones — the GO hero takes the same travelling sheen — so the two juiciest moments in the game rhyme. tools/ascend-page.js gates the structure: verb above the fold, verdict present and correct in all three states, hero math never double-counting, no clipping, 12/12 device shapes. // v18.56 = MILESTONES ON ALL FOUR ECONOMY UPGRADES (owner: "add in milestones for ALL upgrades whilst keeping the scaling pretty much exactly the same, I like the animation a lot"). v18.51 gave Value a lump every MILE_LEG legacy levels and left Capacity, Spawn Rate and Luck on a flat trickle, so three of the four rows had nothing to save toward. There is now ONE shape, mileL(), and every stat feeds its own curve through it: an additive stat withholds additive gain, the one geometric stat (Capacity) withholds EXPONENT, which is the only way "same scaling" means the same thing for both shapes. THE SCALING CLAIM IS MEASURED, NOT ASSERTED: mileL(L) === L on every multiple of MILE_LEG, so all four stats are bit-identical to v18.55 at all 42 milestones across the sampled range; between them a stat may only ever be BEHIND, never ahead, by at most MILE_SHARE*(MILE_LEG - 1/ECO_STEP) = 1.575 legacy levels — the same lag Value has run since v18.51 — and no stat ever backslides. The felt lump at legacy level 40: Value x1.045, Spawn x1.054, Luck x1.055, Capacity x2.652 (Capacity is geometric at 1.60/level, so its lump is the loud one). Pacing unmoved: onearmy ratios shift within run-to-run noise and all gates pass, ladder holds across the whole envelope, ascension contract holds, loop-probe passes. Every row now carries the charge-up bar, the shine sweep, the MILESTONE chip and the full-screen payoff banner, each naming itself and stating what its lump bought. Also fixed a measurement bug this exposed: balance-check sampled two ADJACENT levels, which since v18.51 straddled Value's lump and reported x1.23 per level (and would have read Capacity as x3.09) — it now samples a whole leg between two milestones, so Capacity reads x1.60, exactly the source constant. // v18.55 = DEVICE COMPATIBILITY, MEASURED ACROSS TWELVE REAL SHAPES (owner: "there were lots of UI issues phone to phone and different device sizes"). The old battery checked two or three shapes, which is exactly why a phone-to-phone difference could hide. tools/device-matrix.js now sweeps 280x653 (folded Fold) through 1024x1366 (iPad Pro) including landscape and the squat open Fold, opens NINE screens on each (home, play, all three dock tabs, star map, skill tree, ascension, metrics) and gates eight things that are objectively wrong rather than matters of taste: horizontal scroll, off-viewport interactives, dock overflow, clipped text, tap targets under 28px, modals that do not fit, overlapping tappables, page errors. THE REAL BUG: #up-list is a column flex box with max-height:25vh and the rows had default flex-shrink:1, so on a short screen they were SQUASHED BELOW their own content — measured 20px rows holding a 36px buy button on a 320x568 iPhone SE, spilling 8px above and below so the buttons of ADJACENT ROWS physically collided, and the last row overhung the list. Invisible at 430x932, broken at 320x568, which is the phone-to-phone report exactly. flex:0 0 auto — rows keep their natural 52px and the list scrolls, which is what its overflow-y:auto was always for. Consequence stated plainly: large phones now scroll a list that used to fit six squashed rows. Also fixed: .u-info was 26px wide on every device (under the tap floor, now 28), #buymode collapsed to a 21px sliver at 280px (min-width:44px; the tabs have flex:1 and give ground instead), and the skill-tree footer pushed the page to 305px on a 280px screen and scrolled it sideways (wraps now, buttons may shrink). 12/12 shapes pass. // v18.54 = THE MILESTONE BUILD IS CONTINUOUS AND THE PAYOFF IS A LIVE BANNER (owner: "it should be a gradual build up then have like a motion shiny moving dynamic banner"). v18.53 snapped between three discrete states, which reads as a switch rather than a build. Every visual now rides --mile (0..1) directly through calc(): the border brightness, the outer glow, the class dot's size and halo, the name's text-shadow and the fill all climb smoothly, so buy 1 already looks different from buy 4 instead of nothing happening until a threshold trips. A shine sweeps the row on a loop the whole way up at opacity --mile×0.5, so the row is visibly ALIVE while charging. On the buy that pays the lump the row becomes the banner outright: white border, a pulsing halo, the shine at full strength on a faster loop, and the ✦ MILESTONE chip carrying its own metallic sheen crawling the opposite way (a moving background-position on a 280%-wide gradient). Still monochrome per the art rule — brightness, scale and motion only, never colour — still zero numbers moved, and the whole thing goes still under prefers-reduced-motion with the shine left as a static highlight. // v18.53 = THE MILESTONE IS AN EVENT NOW (owner: "if there is a special upgrade every 10 or whatever levels of economy can you highlight it gradually and then when there is a special upgrade make sure it's obvious. MAKE IT JUICY"). v18.51 added the lump but announced it with four words of grey text, which is not a reward, it is a footnote. Three stages now. CHARGE: the Value row fills left-to-right as the lump approaches, so you watch it coming across several buys instead of being surprised. NEAR (<=3 away): the fill brightens, the border lifts and the class dot starts to breathe. READY (the very next buy pays it): white border, outer glow, a pulsing ✦ MILESTONE chip, the name lit, and the buy button goes solid white and scales up — unmissable. PAYOFF: buying through it fires the conquest juice kit scaled down — flash, shake, haptics, a ring and a burst from the middle of the field, and the new ×N per dot floated right there. Crossing is detected off the LEGACY level passing a multiple of MILE_LEG, so a buy-10 that vaults several lumps still fires exactly once rather than stacking. Strictly presentation: not one number moved, and the whole thing is monochrome per the art rule — brightness, scale and motion do the work, never colour. Honours prefers-reduced-motion. // v18.52 = WARDEN DUELS ACTUALLY LAST THE LENGTH THEY ARE CALIBRATED TO. WARDEN_TTK documents the duel as 26s of YOUR real output, but the 4-second sample that sizes the pool runs with regen OFF (gated on d.calib) while the duel that follows runs with it ON — so the keeper was sized to an output you never sustain. Measured on a REAL P1 build (derived the progression-audit way: the purse a P1 player holds, spent cheapest-first — 4 units, 4 collectors, ~130 tree nodes): 39.6 / 39.3 / 39.8 / 39.7s against a designed 26, a dead-consistent ×1.52, which is exactly 1/(1 - regen×TTK). The pool now solves (obs - regen·P)·T = P instead of obs·T, and the same four duels land at 27.4 / 26.9 / 26.9 / 26.8s — ×1.03, with 33s of headroom in the 60s escape clock instead of 20s. Worth recording HOW this was nearly missed: the first measurement used a hand-picked 4-turret rack with an EMPTY tree and every duel hit the 60s clock, which reads as "the keeper is unkillable" and is really "that build does not exist". Same no-tree trap that sent the P2 economy investigation down a wrong path twice. Also LOOKED AT AND DELIBERATELY LEFT ALONE: the bounty wheel. Its node faces do swing ×63 in value, but they sit ON TOP of an already-banked bounty and the dearest node already carries the highest face weight (18 vs 14) — two attempted fixes either trivialised the prize or reproduced the original, so the honest answer is that it is a bonus layer already biased the right way. // v18.51 = FINER RUNGS ABOVE THE COLD OPEN + MILESTONES + AN ASCEND PROMPT (owner: "cheaper upgrades that do less so it feels better", "I like the milestone", "I like the ascend prompt"). MEASURED FIRST, and it corrected me: eco upgrades are NOT mispriced — the next Value costs a flat ~2.4% of whatever planet you stand on, P1 to P8 (1.9/2.8/2.9/2.9/2.3/2.3/2.4%). What grows is the PLANET, 2.8h to 75h, so that same correct proportion becomes a 1.8-hour wait for a +3% bump. The complaint was granularity, not price, and my earlier "upgrades get 30x less affordable" headline was an artifact of measuring in seconds while the yardstick grew underneath it. A first attempt halved every rung EVERYWHERE: per-stat exactly neutral, and it still broke the game, because the buy loop picks the cheapest thing ACROSS categories — halving eco entry prices made eco win against units and nodes whose prices had not moved, so a greedy player pumped Value at the cold open where Value inflates enemy HP by ^1.3 (P1 x1.47 -> x2.53, ecoFirst walled at x5.40, gate FAILED, reverted). Rungs now go finer only ABOVE ECO_FINE_FROM=12 legacy levels: below it a rung IS a legacy level, priced and powered bit-identically (verified 117/1435/10944 to the unit), and above it a fine rung costs the legacy step scaled by (mul^(1/STEP)-1)/(mul-1) so STEP of them sum to exactly one legacy level. Every effect reads legacyLv(), so power and cumulative spend match the old curve at every legacy level in both zones. MILESTONES shave 35% off Value's linear gain and hand it back every 5 legacy levels — net-neutral ON each milestone (1.65/2.3/3.6/6.2 all exact), a rhythm change and not free income. The ASCEND PROMPT appears only when ascending would bank a core AND the next rung is past 30 min of farming. Saves remap through rungLv() behind their own flag. onearmy-sim read its own copy of 0.9+1.15*lv and of the U3 level window; both now come from the game. // v18.50 = A BOSS CAN NEVER HEAL ITSELF AGAIN (owner: "a boss gained like loads of hp back then was basically invincible, but I tried again and that didn't happen"). Reproduced first try. A WARDEN opens with a deliberately oversized provisional pool and re-sizes it ~5s in from what you dealt in a 4s window — but finger-drawing does x2 damage vs bosses, so DRAWING THROUGH THAT WINDOW told the game you were twice as strong as you sustainably are and it sized the pool to a burst you cannot hold. Measured on P1 with a plain 4-turret rack: drawing 1s-5s made the bar jump 4,477 -> 8,234 and maxHp 5,457 -> 9,214 at t=5.02s, so ~1,000 damage left the keeper with MORE hp than it started with — unkillable the moment you lift your finger. Intermittent exactly because it depends on whether you happened to be drawing in that one window. This inverted the design's own intent: drawing is meant to SEAL a duel faster. Two guards: the calibration now measures SUSTAINED output (draw damage is tracked per-dot and subtracted), and the pool may only ever SHRINK (Math.min against the provisional). After: the drawn duel calibrates to 1,073 like the undrawn 1,024, and drawing leaves the keeper on 404hp where turrets alone leave 869 — faster, as intended. loop-probe gains gate L4, which drives a real duel while drawing through the window and fails if maxHp rises at all; it reads +3,757 on the old code and 0 on this one. Boss hp still ticks up between hits from the designed regen (0.012/s) — that is intended and only maxHp is asserted flat. // v18.49 = THE TAB COUNT BADGES ARE ACTUALLY ON THE BUTTONS (owner, with a screenshot: "the icons are not on top of the buttons"). Nothing to do with z-order, which is what it looks like: <button> carries overflow:hidden from the Chromium UA stylesheet (measured overflowX/Y = hidden on .tab), so the badge — deliberately overhanging at top:-6px right:-4px — was SLICED along the button's own border-radius. Half a badge peeking out of a corner reads exactly like something painted behind. elementFromPoint at the badge centre always returned the badge, so hit-testing was fine and only the paint was wrong. .tab (and #tabs) now say overflow:visible; .ab deliberately keeps its clipping because the cooldown bar relies on it. No layout moved and nothing needed more room — the badge top already lands 1px below the abilities row. // v18.48 = THE SPAWN RING IS THE WHOLE MAP NOW (owner, with a screenshot: "the spawning of dots is fixed to a smaller rectangle and I can still zoom out further — should be spawning at the actual edges"). v18.46 was half a fix: it correctly stopped the ring riding camZoom, but anchored it to viewHW/viewHH — the screen at NORMAL zoom — when a pinch reveals 1/ZOOM_OUT more than that. Measured before: fauna came in over 47% of the map width and used 25% of its AREA, so three quarters of the world you can see was dead space you could zoom out and stare at. The ring is now the widest extent that is ever on screen (view / ZOOM_OUT): measured 99% of the visible width, 98% of its area, on phone and laptop alike. Still fixed, still independent of the current camera — v18.46 got the principle right and the number wrong. MAP_PAD stays out of it so nothing spawns on the clamp line, and Dot Rain deliberately keeps falling into the inner bowl, where your guns actually are. Checked for the obvious risk — spawning twice as far out could have starved the middle — and it does not: dots drift inward, so at steady state 100% (phone) and 85% (laptop) of the field still sits inside the normal-zoom view. // v18.47 = YOU CAN SEE THE MONEY ROT NOW (owner: the drone tree turned out to be silently mandatory). Measured with a tag-at-spawn / account-at-death probe: a MAXED gun build with no drone tree kills everything on the field and banks 19% of it — 81% of the loot times out on the floor — capping that build at 0.47x the intended income, while guns+drones together reach 3.79x. Income is a PRODUCT of two terms bought in two different trees (selection: how much of the field value your guns reach and kill; collection: how much of that your drones actually bank) and knocking either one down makes the other stop mattering. The game did warn — a 6s "!" on the drone tab via hintLeakUntil — but a brief nudge cannot say "most of your income is evaporating". Every rotted orb now floats a red -¤ where it died (one choke point, orbRot, so no path can lose money silently), and a rolling 8s ratio drives a HUD line under your income once a QUARTER of it is being lost. No balance number moved: ORB_LIFE, yield and the curves are all untouched — this only makes an existing failure legible. Also adds tools/loop-probe.js, which PLAYS the game headlessly and measures banked income, because the analytic sims price every kill at the field average (real kills run 3¤ to 105¤) and passed every gate on a build earning 8% of curve. // v18.46 = THE SPAWN RING IS THE MAP, NOT THE CAMERA (owner: "dots are spawning dependent on how zoomed in I am, not the actual size of the map"): spawnDot read liveHW/liveHH — SW/2/camZoom — so the ring literally WAS the zoom. Pinching out doubled the radius fauna came in from (measured 583 → 1341 across a 2.3× pinch, exactly the zoom ratio), which quietly made the camera a difficulty lever and put dots OUTSIDE the rim drawn for them: the rim, Dot Rain, the boss patrol and the mine rig all use the FIXED viewHW/viewHH. One line — the ring is now that same fixed size, the map's own — and the three-zoom measurement reads 666/665/663. liveHW/liveHH now have no callers in the simulation at all, with a note saying why: a game rule that changes with the camera is a bug. // v18.45 = EVERY ◈ IS AN EVENT (owner: "there needs to be an animation for getting the cores when you conquer a planet, and every time you get a core a full animation"): ◈ used to arrive as a small card sliding in under the top bar — the same weight as a shop receipt for the rarest thing in the game. Every ◈ event now plays a 3.4s sequence: the core FORGES (a ring collapsing into the seam), STRIKES (flash, shake), DRAWS itself edge by edge, MULTIPLIES into one diamond per core, then FLIES into the ascension counter and lands — and only then does the old card slide in, as the receipt rather than as the whole event. Taking a world queues it too, labelled as EARNED (the bounty still banks at ascension — moving the payout is the economy change, not this). One choke point now banks every core (awardCores), so no source can pay silently, and the queue waits for the conquest film, for any open card, and the mine build waits for IT — nothing in this game plays over anything else. // v18.44 = ASCEND WHEN YOU WANT, AND THE ◈ SAY WHERE THEY CAME FROM (owner: "there is still a blocker to ascend, I should be able to do it when I want, and why is there 4"): the v16.1 three-planet floor is gone from the button, the action and the glow — the only thing that can grey ASCEND out now is having nothing to bank, because ascending for +0◈ would delete a run for nothing. Checked before removing it rather than after: tools/ascension-sim.js --policy still routes P3 → deeper every run (17 runs, 45.6h, no churn), so the floor was redundant as an anti-exploit — CORE_B's depth pricing already makes a shallow hop bad, it just used to be forbidden as well as bad. The ◈ PENDING tile now names its sources (P1 +4 · P2 +5 · …) instead of asserting a total: the 4 is planet 1's bounty, CORE_A, and every planet deeper pays ×CORE_B. // v18.43 = A CONQUERED WORLD PAYS NO RENT (owner: "cut the idle income of a conquered planet"): worlds you had taken paid tribute forever — from any distance, asleep, for doing nothing. bgRate was the single source of every tribute path (empireIdleRate from worlds you had left, the on-site trickle once spoils ran dry, the away integral, the star-map readout), so IDLE_PAYBACK_H goes to Infinity and all of them are zero by construction, in the game AND in tools/empire-sim.js which builds its own model from that constant. What survives is what you EARN: the ⚑ victory spoils pot (a one-time payout for taking the world, now on its own rate priced at exactly the old 26h-payback-at-×20, so it drains in the same ~23 minutes and still covers the launch) and the ◈ mine you won off the keeper. Measured: a 100%-active campaign pays ~15% for this, 35%-active ~34%, and pure idle stops finishing at all — the tribute was almost entirely a subsidy for not playing. IDLE_FRAC bar-fill is now dead by construction rather than by a flag. // v18.42 = THE ASCENSION TAB SHOWS ITS WORKING (owner: "make sure I can access whenever I want, make sure the ascension tab is full of informative visuals around production"): Ascension only had a door on the PLAY screen — the ◈ pill is display:none anywhere else — so it was unreachable from home or the star map. It now has its own button on the home card. Inside, the screen leads with what it never used to show: a KPI row (banked, pending, dig rate, engine), ⛏ ◈-per-day BY WORLD as horizontal bars, this run's ◈ split between conquest and mining (honest now — mined cores bank instantly and pendingCores() never saw them, so S.minedRun records them), the ascend-now-vs-sit-on-the-farms head-to-head on ONE ◈ axis, and the Singularity Engine plotted against ◈ ACTUALLY SPENT rather than level (against level it is a straight line that tells you nothing; against spend it bends, and the bend is the decision) with your current reach marked. Monochrome throughout: nothing is encoded by colour, identity is position plus a direct label, so a reader who sees no colour loses nothing. // v18.41 = ONE THING AT A TIME, AND NO WAY OUT OF IT (owner: "after I beat the boss the mine animation and completion animation start at the same time!! Make sure you can't skip the animations"): a mine won WITH the world is founded on the kill frame, and mineBuildP() reads 1 for a founded mine — so the COMPLETE mining complex was being drawn on the world underneath the conquest film, and then rebuilding itself from nothing once the report card was closed. The rig is now suppressed entirely while its build is pending (one predicate, mineRigOn(), read by both the renderer and the battery), so the film plays over clean ground and the site is only ever seen being raised. And there is no skip left anywhere: the tap handler, the Esc branch and the TAP TO SKIP hint are all gone, so the conquest sequence plays in full every single time; the dock holds LAUNCH back with ⛏ RAISING THE SITE… until the headframe turns, so the build cannot be cut short either. // v18.40 = THE KEEPER IS THE CONQUEST (owner: "the conquer screen should only be after you beat the boss, you should be able to farm at 100% before fighting the boss and the button gives you the option to fight it and summon it"): filling the bar no longer TAKES a world — it earns you the right to fight for it. At 100% the planet is still contested: dots keep spawning, you keep farming and banking, and the dock button turns from CONQUER n% into ▲ SUMMON <keeper>. Press it when YOU are ready and that world's seam keeper comes out; kill it inside 60s and only then is the planet yours — conquerWorld() now runs from the warden's death instead of the income check, so the cinematic and the report card can only ever play AFTER the boss falls. Lose and nothing is lost: the bar stays full, the world keeps paying, and the offer stands as often as you like. The ◈ seam comes off the keeper with the planet (its hoard founds it), so there is no mine without the fight and none to buy — and the site raises itself once the report card is read, not under the film. Old saves conquered under the previous rules get their mine back-filled on load, since a conquered world can no longer summon a keeper at all. // v18.39 = THE SEAM IS WON, NOT BOUGHT (owner: "shouldn't be able to get round fighting the boss by buying the mine"): a conquered world's ◈ seam could be taken with a cheque — the settlement panel and the star-map card both carried a ⛏ BUILD button at 10% of the conquer target, so the seam keeper was optional scenery you could walk past if you were rich enough. Both buttons are gone, with the star map's handler and the panel's affordability check. The ONLY route to a mine is now beating that world's warden: its hoard founds the seam on the spot, exactly as before. There is still no clock on it — the offer stands in the panel for as long as you like, and a lost duel is re-offered as often as you want — so you are never rushed into the fight, only never excused from it. Copy follows everywhere: the report card names the keeper holding the seam, the star map says land here and win the duel, the map dot reads ▲ ◈ SEAM instead of a price, and the settled banner and how-to say the seam is won, not bought. // v18.38 = TAKING A WORLD IS A FILM (owner: "there needs to be an animation for conquering the world like a nice long triple-A one"): the biggest thing that happens in a run was a 1.2s flash. It is now a 10.5s sequence in five movements, drawn in screen space behind DOM letterbox bars with the whole HUD faded off — IMPACT (the shock off the last kill, rings tearing outward, iris slammed shut, camera slammed in), SURVEY (the iris opens onto a wireframe globe assembling latitude by latitude while a terminator sweeps down it), SIGIL (the planet's OWN signature polygon — the same one its dots wear — draws itself edge by edge, spins down to true and LOCKS with a flare and a shock ring), CLAIM (the mark holds under the title card while claim rules run to the edges), SETTLE (bars lift, camera comes home, report card follows). Every world reads differently because the mark is its own. A tap or Esc skips it — but only when it is actually on screen, so a tap meant for the star map or a card is never stolen. The settled banner is suppressed for the duration; it was spelling out every beat before the reveal. // v18.37 = A LONGER DIG (owner: "make it last like 10 seconds"): MINE_BUILD_DUR 4.2s → 10s. Every stage window is a fraction of that constant, so the whole sequence stretches in proportion — the claim survey runs ~1.8s, the fence and floodlights ~2.4s, sinking the shaft ~2.4s, hanging and spinning up the gear ~1.8s, the works ~2.5s, the ore roads ~2.2s, the belt and spoil heap ~1.6s — and nothing is starved or left idle. The build battery now asserts the length itself: still building at 8s, finished by 12s. // v18.36 = THE MINE IS BUILT, NOT SPAWNED (owner: "can we make an animation for building the mine on the planet"): pressing BUILD used to swap a finished mining complex onto the world in one frame. The rig now ASSEMBLES over ~4.2s in the order a mine really goes up — a survey ring pegs the claim out to the perimeter, the fence draws round and the floodlights strike up one by one, the shaft is sunk (its mouth widens and the apron is poured, with a thump of dust and shake as it breaks through), the winding gear is hung and spins up to speed, the works and silos stand and the engine house starts to breathe, the ore roads are laid outward from the apron, the belt runs out and the spoil heap grows under it, and only then does the first ◈ come up the shaft. Each stage has its own sound, the settlement panel narrates the step it is on, and the mine is FUNCTIONAL from the click — it is only the site that takes time. Live-only, like the duel: a reload or a launch mid-build lands on the finished mine rather than replaying or stranding the show. // v18.35 = VICTORY WAITS ITS TURN: on the FINAL conquest the victory screen was pushed at t=0 while the conquest report waits out the kill beat, so the last world in the cluster showed you the trophy and buried what it actually paid. Victory now rides the same beat and queues AFTER the report — read the payout, then take the bow — and it is re-queued rather than dropped if the beat is interrupted by a travel or an ascension. // v18.34 = THE CONQUEST FLOWS (owner: "sometimes I load in I get a few different things pop up but then I'm thrusted without consent into boss battle, then a mine randomly appears and then a launch button appears — this needs a big smooth remake"): conquest fired everything at once from one statement — four 0.95s floating texts carrying PERMANENT information (cores, spoils, the mine site, what to do next), a dock that swapped itself to the settlement panel, a relabelled LAUNCH button, and wardenAutoT = 2.5 which summoned the seam keeper 2.5s later with no input from you, swapping the dock a second time and a third when the duel ended. On a cold load where idle income finished the bar in the first frames, all of that raced the Welcome Back modal and the ◈ core card, in whatever order the away-credit landed — hence "a few different things". Now: BEAT 0 is the kill alone (flash, shake, sound, field clears, nothing said), and one beat later ONE ⚑ CONQUEST REPORT card states everything the conquest paid — cores pending, the spoils pot, the ◈ seam that was found, and what LAUNCH costs whenever you want it. Dismiss it and you are standing on a quiet settled world with the settlement panel and LAUNCH both waiting; the warden now sits on its button with no clock and is summoned only by you, so every dock swap is a consequence of a press. All blocking cards (Welcome Back, the report, victory) go through one FIFO queue that shows exactly one at a time and advances on ANY close path, and the ◈ core popup defers until the queue drains. Also fixes a swallowed comment from v18.21 that had been commenting out the conquest's own flashAdd/shakeAdd/vibe/Audio_conquer/syncHUD since that version — the biggest moment in the game was landing silent. // v18.33 = THE FIELD IS THE WHOLE SCREEN (owner: "now the map size is the minused version always of the map with or without the upgrades menu up or down — it should be the full version not regarding menu up or down"): v18.32 stopped the world resizing, but pinned it to the SMALL version (the strip left above an expanded dock). The world is now fitted to the whole screen and knows nothing about the dock at all — the dock is an overlay that covers the bottom of the field while it is up, so Minimise uncovers more of the same world instead of changing one, exactly as it worked before v18.26. Nothing about the map, the camera or the spawn ring reads any DOM element any more, so Minimise, tab switches and the settlement panel cannot move the world; only a real resize can. The band watcher and the dock ResizeObserver are gone with it. dock-stability gains D6: the field must measure the FULL screen at every step, so it can never be pinned to the reduced one again. // v18.32 = THE WORLD HOLDS STILL (owner: "having the menu up and down changes the spawning locations and the size of map when it shouldn’t"): the play band was measured from the dock LIVE, so every time the dock changed height the world was refitted underneath the player — Minimise resized the field and moved the spawn ring with it, and so did switching tabs and the settlement panel swapping in. The band is now pinned to bandRef, the tallest the dock has ever been at this screen size: a minimised dock is ignored outright (it says nothing about the dock’s real size), and the dock’s own ResizeObserver no longer refits anything — it only feeds the same measurement. A real resize or rotate is the ONLY thing that re-measures. New dock-stability probe drives the real UI through Minimise x2, all three tabs, and a settlement swap, asserting the map size, camera centre, zoom range and spawn rectangle are identical throughout — and that a genuine resize still refits. // v18.31 = BORDERLESS (owner: "why the fuck when I zoom out is there some dumb rectangular border — needs to look borderless, like I’m zooming out the map"): NOTHING draws the world’s edge any more — no border line, no ground plate, no frame. The map’s bounds still exist for physics, but they are invisible and now sit outside the WIDEST view rather than just past the normal one, so you never see anything pile up against a wall. Two things follow: pinching out is a real move again (half scale — twice the field on screen, and no line anywhere to say where it stops), and fauna now comes in over the edge of the LIVE view rather than a fixed rectangle, so it keeps arriving from just off-screen at whatever zoom you are sitting at. world-frame gains a pixel check for this: at full zoom-out it profiles the pixels either side of where the bounds actually are and fails if anything draws a line there (a re-introduced frame measures 41-53 against a borderless 0-2). // v18.30 = ONE MAP, EVERY WORLD (owner: "get rid of all map designs, have them all the same for now"): the whole per-planet landscape layer is deleted — 18 formation motifs, five rim layouts, five ridge silhouettes, seven ground surfaces, the signature structures and the outer wastes are all gone, along with the seeded generator behind them. Every world is now the same clean field: a rounded border sitting just past the edge of the play band, solid ground inside it, and nothing else competing with the fight. Fauna still comes in over the edges, evenly all the way around, landing just inside the view so you always see it arrive. The seeded per-world BACKDROP (star density, nebula) is untouched — it sits behind the field, not on the map. // v18.29 = THE MAP HAS A BORDER AGAIN (owner: "make it a rectangle … the edges of the world are black rather than the planet’s actual environment … things are still spawning not around the edges of the map"): the disc is gone. A circle whose limb sat off-screen put the whole landscape out of sight — the edges of what you actually look at were plain black ground, and fauna crossed a line with nothing on it. The world is a rounded RECTANGLE sized just past the play band, and its BORDER carries the terrain. Everything about the landscape is now expressed as (t, depth) — position along the border and depth inward — so it composes identically on a tall phone, a landscape phone or a tablet, and the belt is measured PER EDGE (on a landscape phone the border sits 63px beyond the view on the sides and 4px beyond it top and bottom; one global depth reached into view on two sides and nowhere near it on the other two). What that buys: the RIDGE and the formations standing on it are on screen along every edge, so the border of the map is this planet’s environment instead of black; fauna emerges FROM that terrain, snapped to a real formation and set just inside the edge of view, on whichever side it comes over; past the border the outer wastes carry the same landscape outward as receding contours; and pinching out frames the whole map, border and all. Physics follows the rectangle: dots bounce off the border, collectors and the swarm are held by it, the boss patrols the visible field. // v18.28 = IN OVER THE EDGE (owner: "they’re not spawning on the edges, also make the map slightly bigger"): (1) FAUNA CROSSES THE EDGE OF THE SCREEN. The spawn ring was a CIRCLE, and the view is a RECTANGLE — a circle that clears the top and sides sits well inside the corners, so on the diagonals dots were appearing in open ground in front of you instead of walking in. Spawning now follows viewEdge(bearing): the actual boundary of the visible band along the direction the dot is coming from, so fauna enters over the rim of what you are looking at on every side, on every shape of phone. (2) A BIGGER WORLD — the planet grows from 1.06 to 1.24 of the band’s half-diagonal, so there is markedly more world left to find when you pull the camera back, and terrain counts now scale with the SIZE of the disc (formations, surface and outer wastes all keep their density instead of being stretched thinner over a bigger planet), capped so a desktop-sized world stays cheap to draw. // v18.27 = A PLANET YOU STAND ON (owner: "the circle should be big enough that you don’t see the edges normally — only zoom out do you see the circle, the map is so small … the edges should be the environment/terrain of the planet not random shit … all the planets terrain looks fucked and mistakes"): (1) THE MAP IS BIG AGAIN — the ground disc is sized so its limb clears every corner of the play band at normal zoom: wherever you look you are looking at ground, and the edge of the world only exists when you pinch out. Pinching out now stops exactly where the whole planet frames inside the band (camMin), so zoom-out is a real move with a real destination. The camera also frames the PLAY BAND rather than the screen, so the army finally stands in the middle of the ground instead of at the bottom of it, and everything that must stay watchable — the boss patrol, Dot Rain, the mine complex — is sized to the new PLAY radius. (2) OUTER WASTES REPLACE THE ORBITAL INSTRUMENTS — past the limb it is the same landscape carrying on: this world’s ridge receding as fainter contours, its own formations standing in the half-light, dimming into the planet’s shadow. The orbit rings, 72 bearing ticks, corner survey brackets and starfield are gone. (3) THE TERRAIN WAS NEVER RANDOM — the seeded PRNG behind every world was a LINEAR hash of its own counter, so consecutive draws differed by a constant and every scatter came out as a lattice: rings of evenly spaced overlapping circles, stars in rows. Replaced with a properly mixing generator (mulberry32), and the art rebuilt on top of it — every dimension is now a fraction of the planet instead of raw pixels (v18.26 sized formations for a disc a third of today’s), formations reserve their ground so nothing grows through a neighbour, signatures claim theirs first, the ridge is built from coherent waves and spikes instead of per-vertex noise, everything is clipped to the horizon, and each world gets its own SURFACE — cratered, cracked, pooled, dune-combed, plated, ash-drifted or rift-torn — laid faintly under the fight. (4) the settled-world banner now fits the screen it is on and sits at the top of the band instead of across the mine. // v18.26 = THE WORLD IS A DISC + PER-PLANET BIOMES + RESPONSIVE PASS (owner: "make the maps like a big circle you can zoom in and out of instead of rectangle \u2026 the new empty space in the corners when fully zoomed out full of the map border design \u2026 a full rework, make each planet unique with a REAL cool design not just the same shape repeated \u2026 make sure the screen and buttons align to all phone shapes well"): (1) THE GROUND IS A CIRCLE \u2014 you stand on a planet seen from above, so the playfield is a disc fitted to the live play band between the HUD and the dock. Fauna crawls in around its circumference, the army and collectors are held on it, bosses patrol it, and the surface is solid ground (the backdrop starfield no longer shines up through the planet). (2) ORBITAL VOID \u2014 outside the limb: atmosphere glow, orbit rings, 72 bearing ticks, corner survey brackets with their bearings, and a seeded starfield, so the corners at full zoom-out are full of border design. (3) PER-PLANET BIOMES \u2014 no world is one motif stamped N times any more: each composes 2-3 DIFFERENT formations, its own rim LAYOUT (even / clumps with empty stretches / one packed belt / twin opposing bands / sparse-and-monumental), its own terrain silhouette (jagged / dunes / shards / flats / broken plateaus), and 1-3 colossal SIGNATURE structures ringed by survey circles. (4) RESPONSIVE \u2014 new layout-audit gates seven real device shapes from a 320x568 SE to a 844x390 landscape: fixed a 47px horizontal overflow (the tab row could not shrink), the LAUNCH row falling below the fold on short screens, thumb targets under size, and a 120px minimum band that overrode the real dock position and drew the limb straight through the dock. // v18.25 = MINES THAT MATTER (owner: "make mines more productive"): base dig rate \u00d73.5 \u2014 P1 goes from 1\u25c8/week to 1\u25c8 every TWO DAYS, so a mine repays its planet\u2019s conquest bounty in ~8 days instead of ~28 and the 10%-of-target build is a real strategic call instead of a garnish. Measured across the whole ladder envelope, campaign mining moves from ~7-9% of the \u25c8 you bank to ~25-33%, while ASCENDING still out-earns parking by \u00d72.8-3.5 at every wall of every run (L8) and the cadence holds (5-9 ascensions, 40-67h). The mine curve K stays at 1.3 \u2014 it must never outgrow the bounty curve, or deep parking out-digs the loop. L7 is now a BAND rather than a ceiling: mining must stay under 40% (never the majority source) AND over 12% (never a rounding error again), so neither edge of the intent can drift away silently. Also: the two noisiest early wardens (ARC SHRIKE, SLAG BROODMOTHER) get lower duel dials \u2014 with a thin early rack, a juking target and a brood competing for turret attention swung the measured fight by \u00b110s, which left them sitting on the 60s clock\u2019s edge instead of inside it. // v18.24 = A BESPOKE WARDEN PER WORLD (owner: "should be a new boss with new abilities for each end of planet"): all 18 seams are now guarded by their OWN named keeper, each built from the apex mechanics of that world's native race \u2014 DUSTMAW MATRIARCH, ARC SHRIKE, SLAG BROODMOTHER (brood), BLOAT SOVEREIGN (swells), AZURE BULWARK (reflecting shield), THE ARCHMENDER (heals its brood), SENTINEL PRIME (satellites), GALEREAVER (shockwaves), HALCYON PHANTASM (cloaks out of targeting), VOLTAIC COLOSSUS, UMBRAL DREAD (phases), RIMEWARDEN (regrows armour), SHARDBREAKER (deflects), WISPCALLER (blinks), ASHEN BEHEMOTH, VOIDSTONE IDOL (drags your loot), BILEWURM (eats loot to heal), THE NULL KING. Each announces its own name and TELL so the trick is teachable. Three engine fixes were needed to make them fair: (1) HP is now CALIBRATED to the damage you actually land \u2014 the old estimate (uDmg\u00d7rate) ignores multishot/splash/chain/pierce and ran ~10\u00d7 low on a keystoned rack (3s duels) and high on a thin one (60s escapes); a warden samples your real output over 1\u21925s and sizes its pool to \u2248WARDEN_TTK\u00d7its own dial. (2) Its SUSTAIN is inert during that window \u2014 regen/armour/leech heal a fraction of the oversized provisional pool, which corrupted the reading into 5s deaths on early worlds. (3) A warden HOLDS THE SEAM at close orbit instead of roaming the rim \u2014 measured back-to-back, patrol geometry alone swung the same duel between 6s and a full escape. Per-warden mechanic rates retuned against the calibrated kill rate (brood 3.5% of pool not 18%, leech 0.8%/orb not 4%, armour +30% not +100%, cloak 19% not 33%). New warden-gauntlet probe fights all 18 with era-correct armies, 3 trials each, and gates every one winnable (18\u201353s of a 60s clock, no finger, medians stable). // v18.23 = WARDEN WIN FOUNDS THE MINE + TOP-DOWN PIT HEAD (owner: "got to the end of a planet, auto logged me into the boss fight, but then I had the option to pay for another boss fight or launch \u2014 which shouldn\u2019t happen" + "the mine should be a top down full mine set up"): (1) THE WARDEN FARM \u2014 a won duel paid the hoard but never claimed the seam, so the panel kept offering \u25b2 SUMMON and the same fight could be re-won for free cash forever. The hoard now passes STRAIGHT THROUGH into the build: beat the warden and the mine is founded on the spot (net wallet change zero), the seam is claimed, no second duel exists, and the only next step is LAUNCH. Losing still re-offers the duel \u2014 that\u2019s the retry. (2) TOP-DOWN PIT HEAD \u2014 the field is viewed from ABOVE, so the v18.19 side-elevation derrick was simply the wrong projection. The mine is now a full plan-view complex: shaft mouth with the winding gear turning over it and the cage shrinking as it descends, six ore-cart rail spokes with sleepers and carts running loaded-out/empty-back, processing sheds and workshops with roof ribs, silos (the main one wearing the live \u25c8 hopper gauge as an arc), a conveyor to a contoured spoil heap, a fenced perimeter haul road with floodlight pools and a sweeping survey beam, venting steam, and the seam glowing up through the whole works. // v18.22 = IDLE COUNTS 20% (owner: "a planet shouldn\u2019t be beatable passively, but the contribution to conquest should only count 20% of active"): v18.21 shut idle out of the conquer bar entirely, which over-corrected \u2014 idle is now a real contributor at IDLE_FRAC 0.20, live AND offline through the one shared allowance. Measured: P1 still needs you (no empire behind it), P2\u2013P6 sit BELOW the ceiling because the young empire isn\u2019t rich enough (idle 6\u201393\u00d7 slower than active), and from P7 the cap binds at exactly \u00d75.0 slower \u2014 56\u2013415 days of pure idling at depth, so no world falls while you\u2019re away and playing is always ~5\u00d7 faster. Also fixed: the live cap omitted buildPow(g), silently tightening the allowance ~41\u00d7 by P18 (harmless at 0.00, wrong at 0.20) \u2014 both paths now key off one designedActiveRate(g). Welcome popup + How-to-play state the 20%/5\u00d7 rule. Probe hygiene: 22 boot/reload waits across the battery now wait for the game to be READY instead of a fixed timeout (three probes were flaking under load), and boot-smoke\u2019s version pin \u2014 hard-coded to v18.0 since v18.1, so it had been exiting non-zero unnoticed \u2014 now checks the in-game version against the source VERSION and both ?v= cache-busters in lockstep. // v18.21 = ACTIVE CONQUEST + HARDER LADDER + FLOW ORDER (owner: "I passively beat a lot of the planets so scaling per upgrade should be more aggressive" + "the go to new world / summon boss / building buttons don\u2019t flow chronologically and cheat around things"): (1) THE PASSIVE-CONQUEST HOLE \u2014 the live loop always capped idle bar-fill at IDLE_FRAC (0: idle never advances a conquest), but BOTH offline paths credited their whole haul straight into the bar, so with no away-cap ("gone a week, earn a week") closing the tab was the FASTEST way to conquer. Offline now obeys the same rule: cash still banks in full, the conquer BAR only moves at the idle allowance \u2014 worlds are taken by playing. The welcome popup says so. (2) AGGRESSIVE ECO SCALING \u2014 Value \u00d71.37\u21921.46 and Spawn \u00d71.39\u21921.48 per level, so the ladder can\u2019t be bought out cheaply (measured wall-zone medians \u00d70.75\u20131.59; onearmy O/U/P + crosscheck L1\u2013L8 + ascension-sim all re-pass; hostile-save level clamp 2000\u21921200 \u2014 the steeper curve overflows double past ~1800 levels, caught by the fuzzer). (3) FLOW ORDER \u2014 one wardenReset() choke point clears the duel on every world change and on ascension (a leaked wardenOn used to keep the NEXT conquest from ever settling: no panel, endless spawns), LAUNCH and map-JUMP both refuse mid-duel with the travel button reading \u26cf WARDEN DUEL \u00b7 Ns, and the conquest floats now announce the warden before travel. New flow-probe walks the whole chain (fight\u2192conquer\u2192warden\u2192build\u2192launch) and attacks every out-of-order shortcut. // v18.20 = STAR-MAP QUICK NAV + JUICY COMBO BAR (owner: "make the star map easier to move around \u2014 quickly look at different galaxies and next planets rather than always navigating by zoom and pan" + "remove the emoji from the multiplier bar and make the bar more juicy"): (1) a nav row under the map title \u2014 \u25c0/\u25b6 step planet-by-planet (clamped P1..P18, camera GLIDES in close and TRACKS the planet along its orbit until you grab the map), \u25c9 snaps back to your world, the centre chip names what you\u2019re looking at and taps open its card, and three \u2605 SYSTEM chips jump between solar systems at overview zoom with the active one lit; manual pinch/pan always wins (cancels the ease, releases the lock); one row on phones. (2) the combo meter drops the \u261d glyph entirely and gets real juice \u2014 the readout punches and grows with heat, glow-blur rides the chain, the fill is a gradient with a travelling shimmer band and a hot leading edge that flares on every gain, tick marks light as you pass each whole \u00d7, and MAX strobes a bright frame around the whole rig. // v18.19 = \u26cf THE MINE IS A MACHINE (owner: "the mine should be a lot bigger visually and moving parts and cool looking"): the tiny rim headframe is now a full CENTERPIECE MINING COMPLEX planted mid-field on settled worlds (~80% of a phone screen wide) \u2014 tall X-braced headframe tower with service ladder and a blinking beacon, spinning winding wheel + counter-spinning idler, a cable ELEVATOR CAGE that genuinely rides down into the dark shaft and back, a nodding pump-jack (walking beam, horse head, counterweight, sucker rod), an engine house with roof, chimney STEAM, a spinning flywheel and a live \u25c8-HOPPER GAUGE whose fill is this mine\u2019s real mineBuf, a conveyor walking ore chunks up onto a spoil heap, seam-glow breathing beneath it all, glowing ground cracks, and bigger brighter \u25c8 glints rising from the shaft. Draws only on settled calm worlds (never during a warden duel). // v18.18 = \u26cf MINE WARDEN + MINE OVERHAUL (owner batch): (1) WARDEN DUEL \u2014 moments after every conquest a decently-strong boss (\u00d71.5 a normal boss, sized to your dps) challenges you on a 60s escape clock; the settled world UN-SETTLES for the fight (fauna returns, army wakes, abilities work) and killing it pays EXACTLY the mine price \u2014 no more AFK-saving for the mine. Lose and the settlement panel offers \u25b2 SUMMON THE MINE WARDEN again (buying outright stays available; buying mid-duel retires the warden with no payout). (2) SETTLED CALM \u2014 a settled world now shows NOTHING of your army: no units, no drones, stray fauna scatters, loot sweeps itself into the wallet \u2014 just the world, its rim, and the mine at work. (3) PER-MINE TIMELINES \u2014 every mine digs from its OWN hopper (vault mineBuf) on its own clock (P1 1\u25c8/7d while P2 runs 1\u25c8/5.4d independently); panel counts down THIS mine; old global-hopper saves fold in losslessly; hostile hoppers/spoils clamped on load. (4) BUILD AUDIT \u2014 new permanent probe: every build button (panel \u00b7 planet card \u00b7 star-map route) charges exactly, refuses broke/double/NaN, builds only its own planet. (5) SWARM TERRITORY \u2014 the hive radius is now clearly visible (breathing dashed ring + whisper fill + dash crawl). // v18.17 = \u25c8 CORE POPUP (owner: "there needs to be a pop up every time you get actual prestige currency so the player knows when and how they\u2019re rewarded"): every \u25c8 that LANDS in the bank now announces itself with a sliding card under the top bar \u2014 amount, SOURCE, and the new balance ("\u25c8 +1 PRESTIGE CORE \u00b7 dug by your \u26cf \u25c8 core mines \u00b7 banked: 13 \u25c8 \u2014 spend them in Ascension"). One choke point (showCorePop) wired into all three live sources \u2014 mine ticks, the bounty wheel\u2019s rare core, and Ascension banking \u2014 so no source can ever pay silently; offline hauls keep their Welcome-Back line, migration refunds stay quiet. Auto-hides in 4.2s, probe-gated (amount/source/balance text + auto-hide, both live sources). // v18.16 = COMBO TUNING (owner: "the metre is blocked, and pretty much instantly goes up to \u00d75 \u2014 should be slightly harder"): (1) the \u261d COMBO meter moved down to ~18.5% screen height (min 150px) \u2014 it sat at y=100 where notch safe-area insets push the DOM top bar right over it. (2) heat is now BUDGETED at +0.55/s with +0.16/kill max \u2014 one swipe through a cluster used to slam \u00d75 instantly (12 kills \u00d70.35); a 16-kill burst now reaches only ~\u00d72 and the cap takes ~6-8s of SUSTAINED slaughter to earn (probe-gated: burst \u2264\u00d72.3, time-to-max 5-11s). // v18.15 = \u261d SABER COMBO (owner pick from the active-play menu: "killing dots with your finger does a multiplier like Cookie Clicker \u2014 the quicker you kill the bigger, up to \u00d75"): finger-draw kills CHAIN \u2014 each kill pays the CURRENT multiplier into its loot, then heats the chain +0.35 (cap \u00d75 \u2248 a 12-kill slaughter); 1.6s grace per kill, then it drains \u00d75\u2192\u00d71 in 2.5s. Screen-space \u261d COMBO meter under the top bar (dims while draining), throttled \u00d7N floats at the kill point. Purely active by construction: only src==="draw" kills touch it, unit/drone kills never heat it (probe-gated), bosses keep their wheel economy, and it multiplies finger-kill loot only \u2014 the macro curves and every sim stay untouched. // v18.14 = THE BIG BALANCING ACT (owner: reward active play more \u00b7 "always bottlenecked by value and spawn rate" \u00b7 "new planet: few, tough units that drop serious money \u2014 more than the previous planet"): (1) VICTORY SPOILS \u2014 the v18.9 flat \u00d720 parked tribute quietly beat frontier play from P6 on (P10 frontier = 11% of parking!); the \u00d720 is now a finite spoils pool (30% of the planet\u2019s value \u2014 launch+mine still fit with room over), after which parking pays EXACTLY the from-anywhere tribute \u2014 income-neutral parking, probe-proven, so the frontier always out-pays it. (2) FEW, TOUGH, RICH arrivals \u2014 spawn stream opens at \u00d70.35 and thickens with the bar, per-dot bounty scales \u00d71/fieldMul (\u2248\u00d73 chunks at arrival), menace floor raised (P2 0.8 \u2192 P8+ 2.2; P1 exempt); engineered income-neutral in both the spawn-limited and dps-limited regimes. (3) FRONTIER PREMIUM \u2014 payouts carry +8% per menace point (arrival floor rides it; full bar +28%); settled worlds spawn nothing, so the premium only ever rewards pushing the CURRENT bar \u2014 a structural active-play reward on top of the idle-cap. (4) CHUNKIER ECO \u2014 Value +13%/lv at \u00d71.37 (was +10%/\u00d71.30), Spawn +1.15/s at \u00d71.39 (was +0.9/\u00d71.32): ~25% fewer buys to the same power, each one a felt jump. BUILD 1.19\u21921.24 pulls the faster campaign back onto the prestige cadence (measured medians \u00d70.55\u20131.14, onearmy + crosscheck L1\u2013L8 + full probe battery green; arrival-pay gate: fresh P3 \u00d72.6 over parked settled P2). // v18.13 = SETTLEMENT PANEL + ARRIVAL FLOOR (owner: "when I visit the planet I should see the mine at work and how long until it produces a reward, so drop the normal upgrades menu" + "went from planet 2 to 3 without upgrades and I\u2019m still demolishing planet 3\u2019s dots"): (1) settled worlds swap the whole shop dock (tabs + upgrade list + abilities) for a SETTLEMENT panel \u2014 the mine at work with a progress bar and a live countdown to the next whole \u25c8 (or the \u26cf BUILD offer right in the dock when unbuilt), plus the settlement/tribute income you\u2019re living on; LAUNCH stays. (2) fresh planets no longer open at menace ZERO \u2014 arrivals get a depth-scaled menace floor (0.25\u00b7(g\u22121), capped 1.5: P3 opens \u00d75.5 tougher than P1, measured), and since the payout divisor keys off the same menace, tougher arrival dots pay proportionally more \u2014 income stays exactly on curve (formula-contract, onearmy L-gates, crosscheck L1\u2013L8 all green). Banner copy now points at the panel instead of the star map. // v18.12 = SMALL-DETAILS SWEEP (owner: "make sure there isn't missing things — I can still see Auto buttons"): (1) the stashed Auto-Buy was still leaking through the star-map planet card (Auto ON/OFF + Edit ▸ buttons render on every card — now gated behind AUTOBUY_ON with the dock/map buttons), and stale Auto-Buy copy lingered in the ascend confirm + Ascension modal "Keeps" line — cleaned. (2) ALL abilities now refuse on settled worlds (Frenzy and Black Hole were castable with nothing to frenzy at or vacuum — cooldown burned for zero; same no-cooldown error-buzz refusal as Dot Rain). (3) Stale copy from deleted systems fixed: the How-to-play still TAUGHT the v17.2 re-baseline economy ("levels re-baseline each world, lifetime Σ carries" — replaced with the v18 one-continuous-ladder truth), its empire bullet now teaches settled worlds + ⛏ core mines, and the landing card's "the economy re-baselines" sub-line is gone. (4) NEW PERMANENT PROBE: detail-audit walks the real DOM — play screen, all planet-card states, ascend modal, settings — hunting visible AUTO leaks, stale copy, dead ability casts and settled-world spawns; green.   // v18.11 = RAIN ON THE FIELD + MIDFIELD BOSSES + MINES ON THE MAP (owner reports): (1) Dot Rain's storm dropped every dot on the sky LINE — 150 dots crawling down from the top edge read as "most of the spawned dots keep near the top"; the rain now LANDS across the upper field (random spread to 60% depth), straight into the fight. (2) Boss patrol anchor moved from H×0.30 to H×0.44 — the seeded movement personalities orbit that point, and the old anchor kept bosses hugging the top out of easy reach. (3) Mines are ON THE STAR MAP: every conquered world wears its ⛏ status under its name — built mines show their dig rate, an unbuilt site shows its price and PULSES "⛏ BUILD ◈ MINE — tap" whenever you can afford it; tapping the planet opens its card with the build button.   // v18.10 = THE SETTLED BANNER (owner: "money going up but I don't see dots spawning" — peace read as a bug): parked on a conquered world the field now SAYS what is happening, screen-space and quiet: "✦ WORLD SETTLED — NO MORE ENEMIES HERE · your settlement pays ✦X/s to the fleet while you're parked here · ⛏ mine digging (or: site ready — build from the STAR MAP, priced) · launch ⟶ the next frontier when your wallet is ready". Frontier-resume probe added: spawning verifiably resumes the moment you land on an unconquered world (0 dots parked on settled P1 → 11 dots within 10s of arriving at P2).   // v18.9 = SETTLEMENT INCOME + ONE WALLET (owner catch: "after conquering I can't farm — I still need to afford the launch!"): settled worlds spawn nothing (v18.6), so the world you JUST conquered now pays you directly — while you're parked on your own conquered planet its settlement works under fleet supervision at ×20 the background tribute (flows to cash + cps + the offline paths). Worst case flat-broke at conquest: launch ≈ 11.7 parked minutes, ⛏ mine ≈ 8 (probe-verified; typically far less — the conquest itself just paid you). onearmy-sim models the same settle-save (medians ×0.64-0.92, all gates green — deep saves actually got QUICKER: a flat ~12-min tribute save beats 15% of a deep planet's designed time). ONE WALLET clarity: there has only ever been one wallet — but the ⛏ BUILD MINE button priced in the VIEWED planet's local tender symbol, which read as a second currency; every price now displays in the symbol your wallet shows right now, and the planet card says plainly "settlement pays +X/s while you're parked here".   // v18.8 = LIVING RIMS + THE STORM (owner calls): (1) second edge-environment art pass — a TERRAIN RIDGE now runs along every edge (a continuous jagged seeded ground-line threading through the features' feet, so each rim is one landscape instead of floating stamps), a SILHOUETTE BACK ROW of smaller fainter motifs pressed against the edge behind the foreground rank (instant depth), another density notch (features /135·/155, +35% dust, 14 motes). (2) DOT RAIN is A LOT stronger — the old instant sprinkle (30+8·g dots, 30% special) is now a real 4.5-second STORM falling from the sky edge: 90+18·g dots (P2 ~126, P10 ~270, P18 ~414 — roughly ×3) at 45% special (×9 value each) — measured ≈×4-5 total value per cast; opening crack of 16 + sustained downpour, capped by the field limit; refuses (with the error buzz, no cooldown burned) over settled worlds.   // v18.7 = ASCENDING ALWAYS WINS (owner ask: "it should never be pointless to ascend"): proven, gated, and made visible. PROVEN: at every wall of every run across the whole measured envelope, the ascend cycle's ◈/day beats parked mining by at least ×10.5 (pending bank re-earned in days vs the mines' 28-day-per-bounty drip). GATED: crosscheck-ladder L8 now fails the build if that advantage ever drops below ×2 at any wall of any run (and prints the minimum per scenario). VISIBLE: the Ascension modal coach shows the head-to-head live — "parked, your mines dig X◈/day · ascending banks +Y◈ right now ≈ Z days of parked mining in one hop, and the Engine makes the next climb faster." The ladder shape already matches the asked-for cadence: run-1 wall lands P5-6 (L2-gated), each ascension pushes 2-3 planets deeper, summit P18 after 6-8 hops.   // v18.6 = SETTLED WORLDS (owner call: "on the conquered planet there should be no enemies or your turrets"): a CONQUERED planet is at peace — nothing spawns (no bosses either), the army stands down (not drawn, no volleys), and the moment of conquest scatters the remaining fauna lootlessly (no conquest jackpot) while collectors stay out to haul leftover orbs. A settled world's income is purely passive: idle tribute + its ⛏ ◈ core mine. This retires farm-backwards ABSOLUTELY — there is nothing to farm behind you (probe-verified: zero spawns, zero active income on conquered worlds; every frontier stage still earns). FARM MATH audited end-to-end: build cost = 10% of the planet's target; rate = (1/7)·1.3^(g−1) ◈/day; because the mine curve matches the ×1.3 bounty curve, EVERY planet's mine digs its own conquest bounty in ~28 days flat ("a mine = one extra conquest per month"); the full 18-mine empire tops out at ~53◈/day; campaign mining measures 7-8% of ascension banking at the fully-idle upper bound (L7 gate ≤25%, now printed per scenario in crosscheck-ladder).   // v18.5 = RIM WORLDS + PAID ◈ FARMS (owner calls): (1) the edge environment got a full art pass — ~1.6× denser themed features with ~1-in-5 grown into bold LANDMARKS (each rim reads as a skyline, not a picket fence), a seeded dust layer of pebbles/scratches through the band, slow glinting motes drifting along every edge, and a layered world frame (solid edge + per-planet dashed survey line + corner brackets). (2) Turning a conquered world into an ascension farm is now a COST, VISUAL AND OBVIOUS: conquest only SECURES the mine site — the ⛏ BUILD ◈ CORE MINE button on its star-map card costs 10% of that planet's conquer target (you just earned 100% conquering it; launch is 15% — the farm is a real allocation choice), fails closed, and a BUILT farm erects a working headframe on the planet itself: A-frame derrick, spinning winding wheel, shaft mouth, ◈ glints rising on the mine's heartbeat — plus its dig rate on the card and the mines chip in the Ascension modal. Unbuilt sites dig NOTHING (probe-verified: 2 days = 0◈; build deducts exactly; NaN/broke wallets refused).   // v18.4 = HIVE SWARM + BIGGER FIELDS + AUTO-BUY STASHED (owner calls): (1) the Drone Swarm is now THREE real wingmate drones — each hunts, chases and hauls its OWN orbs independently, all tethered inside a shared 150px hive radius whose anchor is a hive mind: every 0.4s it samples the field and glides to the DENSEST loot cluster (not the centroid — a two-pile field put the centroid in the empty middle and the hive starved: measured 614 orbs backed up, zero banked, before the cluster-seek fix), staggering so multiple swarms fan out over separate piles; wingmates carry tuned stat shares (×0.8 speed/reach) so 3 bodies land at PARITY with the old single swarm (measured 640/s vs 663/s baseline — and losses HALVED, 52/s vs 108/s: the hive parks where the loot actually is); each wingmate draws as its own small tri-rotor with a faint dashed hive ring. (2) Visible spawn ceiling raised: soft knee 38→60/s and field cap 400→550 dots (~825 on the PC shell) — measured 0.29ms/step at the new full field, headroom to spare. (3) AUTO-BUY is STASHED, not deleted (flip AUTOBUY_ON to restore): buttons hidden, live tick and offline spending dormant (away pools now bank whole, capacity-clamped), saved plans persist untouched.   // v18.3 = ◈ CORE MINES (owner ask: "when you travel to the next planet you set up a farm/mine that farms prestige — a tiny tiny bit, like 1 per week, scaled deeper"): conquering a world now FOUNDS A CORE MINE that digs ◈ prestige cores on the REAL-TIME clock — P1 pays exactly 1◈/week, each deeper planet ×1.3 faster (P5 ≈ 1◈/2.5 days, P10 ≈ 1.5◈/day; the mine curve deliberately tracks the ×1.3 bounty curve — a ×1.45 draft let deep parking out-dig ascending, caught by the new L7 ladder gate at 28-37% and retuned). Mines dig while you play AND through your whole absence (no away-cap: gone two weeks, the mines paid two weeks — surfaced in the welcome-back popup), stop when Ascension resets the map, and re-open on re-conquest. Whole cores land straight in the spendable ◈ bank with a float; fractional progress persists in META.asc.mineBuf. Surfaced: conquest banner (◈ CORE MINE ESTABLISHED · rate), star-map planet cards (per-world mine rate), and the Ascension modal (mines chip + honest copy replacing "nothing drips in over time"). Balance: crosscheck-ladder now models mining at its fully-idle upper bound (every conquered world held all run at ×8.6 wall-clock) and gates it ≤25% of banked cores (L7) — measured ~10-20%, ladder cadence intact (6-8 ascensions). Live-probed: 7-day tick digs exactly on rate, 14-day offline credits in the welcome, post-ascension mines are closed.   // v18.2 = THE FRONTIER ALWAYS PAYS MORE (owner catch: "P1 paid ~50k/s, the new planet pays way less — better to stick to the previous planet, which should never be"): dot payouts keyed off a FIXED divisor (base×1.3), so a conquered world's fat menace-2.0 field (rolls avg ~5.9 + 21% elites at ×28) rode the TOUGH_POW^1.45 premium to ~×9 per dot while a fresh frontier's soft field paid ×0.5 — farm-backwards beat the ×1.5/planet eco step outright. The payout divisor is now the TOUGH_POW-POWER-MEAN of the CURRENT field's toughness distribution (plain-roll term + armored/exotic mix, closed form) — E[payout] = eco×vMul at every menace level BY CONSTRUCTION, so menace and elite mix are pure difficulty and only eco(g) decides where the money is. (A plain arithmetic-mean divisor was tried first and still leaked ×1.18 to the conquered world through Jensen's inequality — val^1.45 is convex and the conquered field's bimodal elite mix kept a ×1.7 convexity premium.) Within a field nothing changes: tougher-than-average dots still pay superlinearly (triage food, fire-discipline economy intact — mind-sim re-passes +51-59% per class). MEASURED (same army, real loop): fresh P2 arrival ×1.24 the parked conquered P1, mid-conquest ×1.62, closing ×1.48, parked P2 ×1.47 — the frontier strictly dominates at every stage, permanently gated by the new farm-compare probe. Full suite green (wall medians unchanged ×0.72-1.01 — the sims' income model always assumed menace-neutral payouts; the live game now honors it, live-vs-model tightened to ×0.72-1.01).   // v18.1 = ONE ANCHOR FOR EVERY PRICE (owner call: "tree upgrades on my new mortar cost 550?? WTF") + TRIPLE-CHECK HARDENING: (1) tree nodes were the LAST price still riding eco(gal) (×1.5/planet) while income grows ~×100+ across the same span — a fresh class's opening rungs read as pocket change at its own frontier; nodes now anchor to the CONQUER TARGET like units (2%) and travel (15%): ring-1 of a new class ≈ 6-9% of the class's own price (mortar tree opens at ~12.9k next to the 89k mortar ≈ a minute of unlock income), keystones ×8, the ×12000 depth span puts tips at a few× the home target — climbed over the NEXT planets; the gal-1 starter pair keeps cursor pricing exactly (ring-1 213, the O1-gated cold open untouched); wall medians moved to ×0.72-1.01 rising to ×1.25-1.31 at the summit (dead on the designed curve), crosscheck re-passes 6-8 ascensions. (2) Triple-check battery findings all fixed: fresh()/ascend() now stamps v18:1 (a post-ascension reload used to re-run the v17 fold and STRIP eco levels — lv-70 Value reloaded as 30); the fold decision now reads the SAVE's own flag (Object.assign was masking it); capList runs FIRST in load and skips junk entries (one null in a save's units array used to kill the whole boot via the swallowed try/catch — permanently); eco level sanitation caps at 2000 not 1e6 (1.32^1e6 = Infinity prices); junk S.travel (string/array/Infinity dur) nulls instead of crashing the update loop every frame. Verified by: formula contract (every price recomputed independently — exact), 40-save hostile fuzzer (boot clean, prices finite, buys fail closed), 8-case migration matrix (folds exact), live ascension round-trip (cores exact, perks flow, reload holds), offline/welcome-back (banks capacity-clamped, over-cap wallets untouched, bar advances but never past target), live-combat-vs-model (killed value ×1.5-2.3 of the sim model at campaign-representative states — model conservative, honest), menace ramp measured live (fresh ×1 → full-bar ×188 → conquered ×59), and the full sim suite green.   // v18.0 = NORMAL IDLE ECONOMY (owner call: "redo the scaling and progression — reflect a normal idle game, we're not reinventing the wheel; the only work needed is planet-to-planet balance"): every price is a FIXED geometric curve set at design time (Clicker Heroes template) — units cost 2% of their unlock planet's conquer target ×1.5/copy (the starter turret/drone pair is the "cursor" at 0.01%: a run-1 cold open earns ~1/1000 of era-average income, so the 2% second turret measured as a 19-hour wall / O1 breach); eco upgrades are ONE GLOBAL ladder (Spawn 60·1.32^lv = the cheap thrust stat, Value 130·1.30^lv = the chunky multiplier — deliberate order: while dps-limited, Value toughens dots ×1.139/lv but pays only ×1.10, so cheap Value was a newbie trap); travel is a flat 15% of the current target (no more moving goalposts); tree nodes keep fixed era prices; menace rides the conquer bar (fresh worlds readable, closing conquests monstrous, conquered worlds settle ×2.0); the ENTIRE adaptive-pricing machinery (cpsS income ratchet, farmed-income anchors, frozen launch quotes, per-planet eco re-baseline snapshots) is DELETED, not disabled; BUILD 1.13→1.19 re-measured for the fixed-curve economy (wall-zone medians ×0.64-0.81 rising to ×1.08 at the P18 summit — crosscheck-ladder re-passes with 6-7 ascensions, run-1 wall P5-6 in 4.5-6.6h, 41-55 total active hours); start purse 40→160 eco-units (covers the first tree node + a couple of Spawn levels at minute 0). MEASURED FEEL: P2 arrival eco upgrade = a 37s wait (the asked-for ~30s), first mortar = 11.9 min; static-AFK conquest with zero purchases = 3.6 DAYS at P2 → months deep, while upgraded active play is ×70-250 faster — AFK farms at FULL rate, conquest simply takes so long that upgrading is always the quicker path. Old saves fold their effective eco levels + a 6/5-per-planet depth credit onto the global ladder (live-tested against a v17.30 P6 save, round-trip verified); the eco-tab desc refresh was un-swallowed from a v17.2 trailing comment (stale "×N /dot" until a full re-render).   // v17.30 = FIXED FINISH LINES + SUBTERRANEAN SABER (owner calls): (1) the LAUNCH price FREEZES at the moment you conquer — it was re-pricing against your income ratchet while you saved (earning faster moved the goalpost; onearmy-sim always modeled a fixed at-conquest quote — the live game was the divergent one); (2) the saber drops to a 33Hz core with a 16.5Hz sub through an 85Hz lowpass capped ~700Hz flat-out — felt more than heard   // v17.29 = QOL (owner asks): pay-to-skip travel REMOVED (it's a 7s warp cinematic — nothing worth skipping; the dock button reads ⟶ IN WARP…, the star map shows the countdown only), and the top-left credits panel now shows your live CASH CEILING ("cap 12.5M") on its meta line — always visible, amber when your wallet is pinned against it   // v17.28 = PACING, NOT GATES (owner call: AFK farming stays FULL-RATE everywhere — the v17.27 idle-gate is REVERTED — and instead the game's own pacing makes static conquest hopeless: landing on a NEW FRONTIER snapshots your eco levels as the new ZERO (the v17.2 ask, now fully honored — effective Value/Spawn start at 0 on every new world), so a no-upgrade army earns planet-noob income against a target sized for the grown economy. Measured: static-AFK conquest = 21 DAYS at P2, 4.5 months at P5, years deeper — upgrading is ×700-2300 faster, organically. Old saves migrate to an equivalent snapshot   // v17.26 = PAINFUL LANDINGS (owner call: arriving at a new planet should be a LOT harder — no upgrade spam, ~30s waits): the eco anchor triples (0.03→0.1s of farmed income) — a carried mid-arc level costs ~30s of income at arrival and escalates ×1.42 into minutes; the arrival wallet buys ~1 level, not 20. Crosscheck envelope extended to the new measured medians (×0.90-1.15) — the prestige ladder holds (8 ascensions, 58-63h, all L-gates green)   // v17.25 = ECO ARC ANCHORED (owner call: landed on P2 with 3M and eco upgrades cost ~1000): the eco upgrade price BASE now also rides FARMED income (live ÷ the prestige Engine, from P2 on) — a carried level-12 Value costs ~10s of income for EVERY player regardless of how hard they farmed P1, the deep arc stays the long save, virgin P1 keeps its classic prices, and each Ascension still melts everything (the Engine divides the anchor — caught by gate O3 and fixed before ship). All anchors (units/travel/eco) now share one rule: prices ride farmed income, ratcheted, from P2   // v17.24 = P1 PRICES RESTORED (owner call: "drones are too expensive on P1, why is it 20k") — the income anchor only engages once you have REACHED P2 (income carrying across planets is what it exists for); virgin P1 of every run plays the classic tuned arc again: drone 125, next 188, 281… P2+ anchored pricing unchanged   // v17.23 = WARP CINEMATIC (owner call: a 7-second super trippy transit): travel is now a 7s hyperspace tunnel — 150 streaking starlines, five counter-rotating dashed rings, three breathing vortex arms, a drunken camera roll, and the destination planet's signature polygon rushing out of the void into a white-out → landing cinematic; scored by a rising noise bed, three swirling-stereo shepard risers and an accelerating heartbeat. Pure spectacle — the launch save stays the only gate   // v17.22 = INSTANT TRAVEL (owner call): the transit wait between planets is GONE — travel is a 2-second cinematic jump (launch rumble → arrival cinematic); the income-anchored launch SAVE is the whole gate now. onearmy-sim updated to match; full suite re-passes (wall medians ×0.64-0.84, inside the gated envelope)   // v17.21 = ROBUSTNESS AUDIT part 2 (code-review + state-fuzzer findings): save SANITATION (every load-bearing number coerced on load — a corrupted/hand-edited save can no longer plant NaN/Infinity/strings; a string cpsS used to make prices NaN and the buy paths FAILED OPEN, granting free units and a NaN wallet, durably); every purchase path now fails CLOSED on NaN; cpsS heals + caps at 1e30; empire income now feeds cps (the bounty floor and price anchor see TRUE throughput); cluster-seek can no longer fire twice at one dot in a volley and triages at the radius the shot actually detonates (explosive keystones); elite knocks genuinely punch through the trash-pop throttle; kill-rate windows expire (no stale melt-register after a lull); saber stroke speed measured over a 40ms window (interpolated input had saturated it to on/off)   // v17.20 = ROBUSTNESS AUDIT part 1 (owner call: scrutinise everything): (1) TRAVEL was a hidden wall no sim measured — launch cost (eco×5e6, a pre-ONE-ARMY relic ~3 HOURS of saving on a fresh run's first hop) + ≥600s transit are now both modeled in onearmy-sim forever, and travelCost is an income-anchored ~7-minute save (old formula kept as ceiling, small eco floor); (2) the v17.19 price anchor was farmable by parking on a weak old planet to deflate income — the anchor is now min-cps-of-the-last-10s, RATCHETED rise-only per run (deflation-proof, jackpot-proof, reload-proof; still resets on ascend); (3) full price sweep in seconds-of-income across P2/5/8/11/14 arrivals: trees/eco-arcs/capacity/luck/bounty/ceiling all verified healthy   // v17.19 = INCOME-ANCHORED ARMY (owner call: on P2 new mortars cost ~600 while earning 50k/s — a serious scaling hole): ONE ARMY made income carry the whole investment multiplier between worlds while unit prices stayed keyed to the planet currency scale (a pre-v17 assumption). Units now cost SECONDS OF YOUR OWN LIVE INCOME (turret 10s → nova 100s/wormhole 130s, ×1.5 per copy), floored by the old eco formula so the virgin P1 start is untouched; the anchor is a slow-smoothed income tracker saved in S (jackpot spikes wash out, reloads can't reset prices). onearmy-sim now feeds its modeled income into the same anchor — full suite re-passes, wall pacing unchanged (units were never the wall)   // v17.18 = DARKER STILL (owner call): saber core 55→46Hz (sub 23Hz), filter idles at 120Hz and caps ~1.2kHz flat-out, softer resonance, and the whole voice sits ~35% lower in the mix   // v17.17 = DARK SABER (owner call: much darker, deeper, dynamic to speed AND direction) — the draw voice drops to a 55Hz growl with a sub-octave sine for chest weight through a dark lowpass (150Hz idle, capped ~1.7kHz flat-out); vertical stroke bends pitch (doppler: up-cuts rise, down-slashes drag low), horizontal stroke PANS the hum across the stereo field, and sharp direction flips slam the filter for the voom-VOOM of a back-and-forth slash   // v17.16 = CLARITY PASS (owner calls): (1) the huge backdrop watermark polygon+circle removed ("random grey triangle with no significance"); (2) the amber tab flash now EXPLAINS itself — opening a flashing COLLECTORS/ECONOMY tab shows an in-tab banner saying exactly what is wrong and what to do; (3) the Ascension modal teaches the ◈ economy: cores are banked ONLY on ascend, each conquered planet pays a fixed bounty (~×1.3 per depth), the current planet adds up to half pro-rata — with a LIVE itemized planet-by-planet breakdown summing to the ASCEND button   // v17.15 = BREATHING FIELD SOUND (owner call: the combo ding is lovely slow but a steady high-pitched drone 5 minutes in) — field sounds now follow the TRUE kill rate: calm fields keep the full two-octave pentatonic climb, brisk fields cap the climb an octave down and space the dings, MELTING fields (15+ kills/s) retire tonal dings entirely for a soft low popcorn patter (and collector blips drop an octave, go sparse); elite/boss knocks always punch through, and the ladder resets while melted so the melody returns when the field calms   // v17.14 = SABER DRAW (owner call): the finger-draw sound is no longer a zap re-fired many times a second — it is ONE persistent lightsaber voice: detuned saw hum with LFO shimmer, and sweep speed drives the VOOM (filter flings open, pitch lifts, volume swells fast and sags slow); lifting or resting the finger powers the blade down   // v17.13 = BULLETPROOF UPDATE APPLY (owner call: double-check UPDATE NOW works in the saved iPhone web app) — tapping the pill or Settings ⬆ UPDATE NOW now navigates to index.html?upd=<version> instead of location.reload(): a plain reload can serve the HTTP-CACHED start page on iOS Safari/standalone and land you right back on the old build; the query busts the document cache so the fresh index (with new ?v= assets) always loads. Manifest start_url "." → "index.html" (raw.githack serves no directory index — Android installs would have opened a 404)   // v17.12 = NOTCH-SAFE EDGES (owner call: "the menu around the edges I can't really click on iPhone 11") — every edge-anchored HUD layer (top bar, right-rail buttons, tree header, star-map bar, toasts, boss banner) now offsets by env(safe-area-inset-*) so nothing hides under the notch/status bar or curved corners, and the right-rail buttons grew 38→46px   // v17.11 = BIG EXIT (owner call: "on a tree I can't get out") — the skill tree and star map ✕ buttons are now large, visible 50px+ bordered buttons, and every modal close button gets a real ~44px thumb target   // v17.10 = EDGE-LOCKED CAMERA (owner call): zoom-out now stops at "fit the whole world" (ZOOM_OUT 0.55 → 1.0) — on phone you could pinch back past the map border into empty void; since v17.8 the rim terrain + border already fit exactly at full zoom-out, so the extra margin showed nothing but space   // v17.9 = WEB GATES (owner call): deep tree nodes now ask for BREADTH before depth — past ring 3, each further ring wants ~0.8 allocated nodes outside its own wing (cap 8), so you can't max Fire Rate (or any wing) while the rest of the web sits empty; deliberately NOT 1-for-1 — a keystone rush just needs a handful of cheap picks in related branches. Web-locked nodes render with a dashed ring and the panel counts down the breadth needed (auto-buy simply skips them until the web catches up)   // v17.8 = SPAWN-RIM ENVIRONMENT (owner call): the dead band between the spawn line and the true map edge is now dressed per planet — 18 unique seeded minimalist line-art motifs (craters, cinder cones, slag fissures, bloat pods, tidal pools, trees, sentinel pylons, wind reeds, mirage arches, storm rods, shadow rifts, ice shards, broken monoliths, wisp markers, ash pyres, void wells, burrow maws, null gates), each themed to the planet's native race & boss; dots now SPAWN out of the features (spawn points snap to rim anchors with jitter), and a faint border marks the world's real edge   // v17.7 = MIND QUANTA + TREE DECLUTTER (owner calls): every ◈ Mind slot is a flat +10% and each defender tree carries EXACTLY ten of them (closest-to-start kept, surplus deep Mind converts to Crit) — a countable ten-step 0→100% climb; and buildTree now runs a deterministic pairwise relaxation so no two nodes overlap (neighbouring wings/sub-arms used to land discs on top of each other — you literally couldn't see some upgrades)   // v17.6 = FIRE DISCIPLINE (owner call: "the game should naturally make more mistakes so Mind becomes more useful"): (1) dumbness is now continuous & real — each volley a unit reads the field with probability = ◈ Mind, otherwise it sprays nearest-first like every dumb neighbour; reading earns doomed-target skipping, value triage (>40%) and AoE cluster-seeking (>50%); (2) killing blows landing with ≥3× needed force VAPORIZE up to 30% of the loot and Mind is the fire-control stat that keeps it — the honest income channel that works in every regime (dots never escape, so pure target choice can't move melt-regime income); (3) fixed the coordination bookkeeping: `covered` used to count already-landed damage (instant beams marked resolved hits), making smart units skip wounded-but-alive dots — now only genuinely in-flight mortar shells claim targets (re-marked each frame). Proven by tools/mind-sim.js (seeded A/B on the real loop, killed-value metric)   // v17.5 = MIND VALIDATION: __SIM.step exports the real update loop for simulated-time A/B field experiments; tools/mind-sim.js runs every defender class with Mind 0% vs maxed on its home planet and measures ACTUAL kills + income deltas (behavioral stats can't be proven by formula sims)   // v17.4 = UPGRADE-SCALING AUDIT: onearmy-sim now gates every upgrade dimension per planet (Capacity bankable-time, Luck vs its 60% cap, Value/Spawn effective bands) across all three Engine regimes; fixed the one real finding — the cash ceiling now rides the FRONTIER economy, so visiting an old world can no longer crash the ceiling below your wallet and freeze banking. Luck confirmed capped, Capacity effect (×1.60/lv) confirmed outpacing its cost (×1.55/lv), P1–3 tight ceiling confirmed as the designed opening   // v17.3 = UPDATE NOW button in Settings (owner ask): one tap force-checks the server (bypasses the 10-min auto-throttle) and reloads into the newest build — or says ✓ UP TO DATE / OFFLINE BUILD honestly. The automatic update pill is unchanged   // v17.2 = PLANET-RELATIVE ECONOMY (owner call): Value & Spawn Rate levels PERSIST but each new frontier raises the baseline "zero" — your carried lv-50 Spawn acts like an early level on the new world and you climb again (costs rebase on the same effective level, so every planet gets its full affordable eco-tab arc back; menace re-baselines with it — worlds start calm and grow monstrous). Capacity & Luck stay absolute. Currency reverted to ONE uniform ✦ Credit everywhere (the economy itself resets per planet now). Scaling re-proven: onearmy-sim ALL GATES PASS (P18 lands ×1.02 of designed — dead on curve), full sim suite green   // v17.1 = ERA WEAPONS + WORLD IDENTITY: new classes land punching at their era's weight (base dmg ×enemyHpMul of their home planet, tree nodes priced ×ERA to match — no more wet-noodle Railguns), arriving anywhere fires the FULL landing cinematic (letterbox, veil, camera slam, title card), every planet gets a seeded grayscale field backdrop (stars/nebulae/signature-polygon watermark) and mints its own LOCAL TENDER (name+symbol re-denominate per world; value identical — the one-economy stays sim-locked)   // v17.0 = ONE ARMY (owner call): your fleet, trees, upgrade levels and cash TRAVEL WITH YOU — planets are one escalating campaign for one continuously-growing force, not 18 fresh starts. Ascension is now the game's ONLY reset (which is what gives it weight). Every price rides the FRONTIER planet's economy (no farm-backwards exploit); class unlocks ride your peak; the vault keeps campaign metadata only (conquered/earned/idle tribute); Auto-Buy collapses to ONE global build order; old saves migrate (active build becomes the army). Scaling re-proven end-to-end: tools/onearmy-sim.js measures the persistent army's real income per planet against the designed conquer curve; ascension ladder gates re-pass   // v16.10 = LOUDER INTUITION (owner: "keep making it more obvious"): tab dots → COUNT badges (how many affordable things wait inside, "!" amber for problems), travel button BOUNCES once a launch is payable, one-shot attention pops when a launch becomes payable / the wall arrives, and a 10s idle nudge bounces the cheapest affordable buy — still zero words   // v16.9 = INTUITION — the "what next?" is ambient, never spoken: ⬆ Tree buttons pulse when a node is affordable (trees pull you in), tab dots count tree nodes too, freshly-unlocked classes wear a NEW chip, COLLECTORS burns amber while loot expires uncollected, ECONOMY + the cap line burn amber while the wallet is pinned at Capacity, ready abilities glow when the field is target-rich. Whispers for options, amber for problems, chips for news — signals stay scarce   // v16.8 = JUICY sound: master bus with compressor glue (stacked pops duck musically, never clip), feedback-echo "room" the big one-shots tail into, Peggle-style kill-combo pentatonic ladder (streaks literally play a rising melody), two-stage loot gulps, abilities sized to their real durations (5s Black Hole drone + end-swallow, Frenzy sparkles across its 6s), layered boss detonation with sub, wheel spin-up rip, expedition landing bookend, jackpot run over a bass root   // v16.7 = SOUND — a full synthesized WebAudio layer to match the juiced visuals: throttled+ducked dot pops & loot gulps, draw-zaps, a voice per ability, conquest arpeggio, ascension riser+boom, victory fanfare, expedition launch rumble, wheel-slam (+jackpot run), boss-escape shrug, whisper-quiet UI ticks, error buzz. All synth, no assets; everything respects the Sound toggle   // v16.6 = every platform FEELS a push: cache-busted assets (?v= on css/js — iOS/Android can no longer serve a stale game.js under a fresh index), live "NEW VERSION — TAP TO UPDATE" detector (checks on load + every return from background), PWA manifest + Apple/Android install metadata + real PNG touch icons, notch-safe dock padding (viewport-fit=cover)   // v16.5 = release-polish pass: crash-proof main loop (an exception can no longer freeze the game), persistent VICTORY screen, honest Welcome-Back banking breakdown, bulk-buy (BUY ×N) unlocked for everyone, Esc/1-2-3 keyboard support, exclusive card modals, zoom-gated tree labels (mobile readability), closer star-map rest zoom on phones, 5-min first hop, retired FX/exchange dead code fully removed   // v16.4 = the WHOLE geometry flattens (owner call): planets pay a FEW cores on a flat curve (4·1.3^g — P1 pays 4, P18 ~346 not 8,273), Engine is +25%/lv topping out ~×800 not ×25k, and the wall softens ×2→×1.65 to make those numbers possible + leave headroom for future solar systems. Ladder & churn-death re-proven; old spends refunded
  let hudCashLast = 0, hudBumpT = 0;   // cash-counter bump throttle (see syncHUD)
  let settleShown = false, settleLast = 0, settleKey = "";   // v18.13 settled-dock swap state (see renderSettlePanel)
  const hudAbPrev = {};                // last-seen ability cooldowns → "ready" flash on the 0-crossing
  // v16.9 AMBIENT HINTS — the "what next?" layer. The game never tells you what to do; instead the thing
  // worth doing looks slightly alive: cheapest-affordable-tree-node glows the ⬆ Tree button, freshly
  // unlocked classes wear a NEW chip, the COLLECTORS tab burns amber while loot is expiring uncollected,
  // ECONOMY burns amber while the wallet is pinned at its Capacity cap, and ready abilities glow when the
  // field is target-rich. Signals stay SCARCE: whispers for options, amber only for problems.
  let hintLast = 0, hintTreeAff = {}, hintLostPrev = -1, hintLeakUntil = 0;
  // v16.10 — LOUDER "what next" (owner: "keep making it more obvious"): tab dots become COUNT badges
  // (how many affordable things wait inside; "!" amber when something's wrong), the travel button BOUNCES
  // the moment a launch is actually payable, the two macro transitions (launchable / wall) fire a one-shot
  // attention pop, and after ~10s of not buying anything while something is affordable the cheapest visible
  // buy button gives a little bounce — a wordless "psst, over here".
  let lastBuyT = 0, lastNudgeT = 0, prevTravelGo = false, prevWall = false;
  let hudConqG = 0, hudConqQ = -1;     // conquer-bar quarter milestones (per planet)
  let hudGemLast = 0;                  // pending-◈ chip pop on increase (name is a v15 relic)
  let W = 0, H = 0, DPR = 1, SW = 0, SH = 0, camZoom = 0, camFit = 0;   // W/H = WORLD (bigger than screen); SW/SH = screen; camZoom = world→screen scale (center-locked)
  // THE MAP IS A ROUNDED RECTANGLE, fitted to the play band — the strip of screen between the top
  // HUD and the dock, measured from the real DOM at every resize. That is what makes it work on
  // every phone shape: a tall 20:9, a short 16:9, a tablet and a landscape phone all get a correctly
  // framed map with its border where you can see it.
  //   WORLD.hw/.hh — the map's half extents; its border sits MAP_PAD past the edge of the view
  //   WORLD.vw/.vh — the visible band, in world units at normal zoom
  // Positions on the border are given as t ∈ [0,1) (see perim) — one coordinate that behaves the
  // same on any shape of screen, which is how fauna comes in evenly all the way around the edge.
  let WORLD = { cx: 0, cy: 0, hw: 300, hh: 300, vw: 260, vh: 260 };
  let VIEW_CY = 0, VIEW_T = 0, VIEW_B = 0;   // the visible field on screen — the whole of it since v18.33
  let camMin = 0;     // furthest the camera pulls back: the whole map framed inside the play band
  const MAP_PAD = 1.06;   // the map's bounds sit this far past the widest view — invisible, they only stop things drifting out of the world
  const ZOOM_OUT = 0.5;   // pinch out to half scale: twice as much field on screen, and nothing marks where it ends
  // v18.33 (owner: "now the map size is the minused version always … it should be the full version
  // not regarding menu up or down"): the world is fitted to the WHOLE SCREEN and knows nothing about
  // the dock. The dock is an overlay that covers the bottom of the field while it is up — minimising
  // it uncovers more of the same world, exactly as it did before v18.26, rather than resizing one.
  // Nothing about the map, the camera or the spawn ring depends on any DOM element any more, so
  // Minimise, tab switches and the settlement panel cannot move the world: only a real resize can.
  const wCX = () => WORLD.cx, wCY = () => WORLD.cy, wHW = () => WORLD.hw, wHH = () => WORLD.hh;
  const viewHW = () => WORLD.vw, viewHH = () => WORLD.vh;
  // v18.48: the widest the field EVER gets on screen — what a full pinch-out shows. viewHW/viewHH are
  // the normal-zoom view; the map's hard bounds (wHW/wHH) sit MAP_PAD past this. Fauna comes in over
  // THIS, so the whole visible world is live no matter how you are zoomed.
  const spawnHW = () => WORLD.vw / ZOOM_OUT, spawnHH = () => WORLD.vh / ZOOM_OUT;
  function fitWorld() {
    const z = camFit || 1;
    VIEW_CY = SH / 2; VIEW_T = 0; VIEW_B = SH;                    // the camera frames the screen, dock and all
    WORLD.vw = Math.max(40, SW / 2 / z); WORLD.vh = Math.max(40, SH / 2 / z);   // the screen, in world units, at NORMAL zoom
    camMin = z * ZOOM_OUT;                                        // how far back the pinch goes
    WORLD.hw = WORLD.vw / ZOOM_OUT * MAP_PAD; WORLD.hh = WORLD.vh / ZOOM_OUT * MAP_PAD;   // bounds hold the WIDEST view, so nothing is ever pinned inside what you can see
    WORLD.cx = W / 2; WORLD.cy = H / 2;                           // the map IS the world centre, so the army stands in the middle of it
  }
  // pull a point back inside the map (m = margin from the border); returns whether it had to move
  function worldClamp(o, m) {
    const hw = Math.max(10, wHW() - (m || 0)), hh = Math.max(10, wHH() - (m || 0));
    const x = clamp(o.x, wCX() - hw, wCX() + hw), y = clamp(o.y, wCY() - hh, wCY() + hh);
    const moved = x !== o.x || y !== o.y; o.x = x; o.y = y; return moved;
  }
  // pull a point back into the part of the map that is ON SCREEN at normal zoom
  function viewClamp(o, m) {
    const hw = Math.max(10, viewHW() - (m || 0)), hh = Math.max(10, viewHH() - (m || 0));
    const x = clamp(o.x, wCX() - hw, wCX() + hw), y = clamp(o.y, wCY() - hh, wCY() + hh);
    const moved = x !== o.x || y !== o.y; o.x = x; o.y = y; return moved;
  }
  // WALK A RECTANGLE'S EDGE: t in [0,1) → a point on it plus the INWARD normal there. One coordinate
  // that behaves the same on any shape of screen, which is how fauna comes in evenly all the way
  // around. Defaults to the map's bounds; spawnDot walks the LIVE view with it instead.
  function perim(t, hwIn, hhIn) {
    const hw = hwIn || wHW(), hh = hhIn || wHH(), r = Math.min(hw, hh) * 0.16, cx = wCX(), cy = wCY();
    const ew = 2 * (hw - r), eh = 2 * (hh - r), ac = r * Math.PI / 2;
    const arc = (a, ox, oy) => ({ x: cx + ox + Math.cos(a) * r, y: cy + oy + Math.sin(a) * r, nx: -Math.cos(a), ny: -Math.sin(a) });
    let p = (((t % 1) + 1) % 1) * (2 * ew + 2 * eh + 4 * ac);
    if (p < ew) return { x: cx - hw + r + p, y: cy - hh, nx: 0, ny: 1 };            p -= ew;
    if (p < ac) return arc(-Math.PI / 2 + p / r, hw - r, -hh + r);                  p -= ac;
    if (p < eh) return { x: cx + hw, y: cy - hh + r + p, nx: -1, ny: 0 };           p -= eh;
    if (p < ac) return arc(p / r, hw - r, hh - r);                                  p -= ac;
    if (p < ew) return { x: cx + hw - r - p, y: cy + hh, nx: 0, ny: -1 };           p -= ew;
    if (p < ac) return arc(Math.PI / 2 + p / r, -hw + r, hh - r);                   p -= ac;
    if (p < eh) return { x: cx - hw, y: cy + hh - r - p, nx: 1, ny: 0 };            p -= eh;
    return arc(Math.PI + p / r, -hw + r, -hh + r);
  }
  // half-extents of what is on screen RIGHT NOW, in world units — this follows the pinch, so fauna
  // keeps arriving over the edge of the view at whatever zoom the player is sitting at
  // liveHW/liveHH are the CURRENT view including pinch. Nothing in the simulation may read them — a
  // game rule that changes with the camera is a bug (v18.46). Kept for debugging and the __IDS hooks.
  const liveHW = () => SW / 2 / (camZoom || camFit || 1);
  const liveHH = () => Math.max(30, (VIEW_B - VIEW_T)) / 2 / (camZoom || camFit || 1);
  const WORLD_SCALE = 1.45;   // the playfield is this much bigger than the screen (unchanged gameplay)
  let FIELD_COMP = 1;         // PC-only collector compensation: the desktop field is ~4x a phone's AREA, so collector speed/reach/pull scale by ~sqrt(area ratio) (set in resize) — same collection LATENCY as mobile, throughput stats (capacity/process) untouched
  // v18.27: the zoom-out stop is no longer a constant — it is camMin, computed in fitWorld() as exactly
  // the zoom that frames the whole planet inside the play band. Normal zoom (camFit) is INSIDE the
  // planet with its limb off-screen; pinch out to camMin and you see the world entire, and no further.
  // ── tiny synthesized SFX engine (no assets) — used for the cinematic warp-into-base jump ──
  const Sfx = {
    ctx: null, nb: null, _busFor: null, _busIn: null, _echoIn: null,
    ac() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) { this.ctx = null; } return this.ctx; },
    noise() { const a = this.ctx; if (!a) return null; if (!this.nb || this._nbFor !== a) { const n = a.sampleRate * 2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.nb = b; this._nbFor = a; } const s = a.createBufferSource(); s.buffer = this.nb; s.loop = true; return s; },
    // MASTER BUS (v16.8): every sound routes master → gentle compressor → speakers. The compressor is the
    // glue — twenty stacked pops duck each other musically instead of clipping into crunch. The echo return
    // is a cheap feedback-delay "room": big one-shots (conquest, victory, ascension, wheel) send a little
    // into it and get a tail, so they feel like events in a space instead of dry beeps.
    out(a) {
      if (this._busFor !== a) {
        const comp = a.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.24;
        const master = a.createGain(); master.gain.value = 3.0;   // v16.8 mix calibration: individual voices are mixed conservative; the bus brings the whole layer up to a healthy level (big one-shots ≈ -8 dBFS peak) and the compressor catches the sum
        const dly = a.createDelay(0.6); dly.delayTime.value = 0.16; const fb = a.createGain(); fb.gain.value = 0.32;
        const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
        const wet = a.createGain(); wet.gain.value = 0.55;
        dly.connect(lp); lp.connect(fb); fb.connect(dly);   // feedback loop, darkening each repeat
        dly.connect(wet); wet.connect(master);
        master.connect(comp); comp.connect(a.destination);
        this._busFor = a; this._busIn = master; this._echoIn = dly;
      } return this._busIn;
    },
    echo(a) { this.out(a); return this._echoIn; },
    swoosh(dur) { if (!opt("sound")) return; const a = this.ac(); if (!a) return; const t0 = a.currentTime, s = this.noise(); if (!s) return; const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(2800, t0); bp.frequency.exponentialRampToValueAtTime(180, t0 + dur); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(bp).connect(g).connect(this.out(a)); s.start(t0); s.stop(t0 + dur + 0.05); },   // descending "drop out of hyperspace" whoosh
    warp(dur) {
      if (!opt("sound")) return; const a = this.ac(); if (!a) return; const t0 = a.currentTime, dest = this.out(a);
      const tube = this.noise(); if (tube) { const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.3; bp.frequency.setValueAtTime(180, t0); bp.frequency.exponentialRampToValueAtTime(3200, t0 + dur * 0.82); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.34, t0 + dur * 0.78); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.96); tube.connect(bp).connect(g).connect(dest); tube.start(t0); tube.stop(t0 + dur); }
      const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(55, t0); o.frequency.exponentialRampToValueAtTime(440, t0 + dur * 0.8); const og = a.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.11, t0 + dur * 0.75); og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.9); o.connect(og).connect(dest); o.start(t0); o.stop(t0 + dur * 0.95);
      const tb = t0 + dur * 0.8;   // BOOM at the punch
      const bo = a.createOscillator(); bo.type = "sine"; bo.frequency.setValueAtTime(170, tb); bo.frequency.exponentialRampToValueAtTime(38, tb + 0.5); const bg = a.createGain(); bg.gain.setValueAtTime(0.0001, tb); bg.gain.exponentialRampToValueAtTime(0.55, tb + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, tb + 0.6); bo.connect(bg).connect(dest); bo.start(tb); bo.stop(tb + 0.62);
      const tr = this.noise(); if (tr) { const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400; const ng = a.createGain(); ng.gain.setValueAtTime(0.3, tb); ng.gain.exponentialRampToValueAtTime(0.0001, tb + 0.2); tr.connect(hp).connect(ng).connect(dest); tr.start(tb); tr.stop(tb + 0.22); }
      const tl = t0 + dur;   // landing rumble
      const ro = a.createOscillator(); ro.type = "sine"; ro.frequency.setValueAtTime(58, tl); ro.frequency.exponentialRampToValueAtTime(26, tl + 0.7); const rg = a.createGain(); rg.gain.setValueAtTime(0.0001, tl); rg.gain.exponentialRampToValueAtTime(0.4, tl + 0.05); rg.gain.exponentialRampToValueAtTime(0.0001, tl + 0.85); ro.connect(rg).connect(dest); ro.start(tl); ro.stop(tl + 0.88);
    }
  };

  const FMT_U = ["", "K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"];
  const FMT_CAP = Math.pow(1000, FMT_U.length);   // first magnitude past the last suffix (1e36) → switch to scientific
  function fmt(n) {
    if (n == null || isNaN(n)) return "0";
    if (!isFinite(n)) return n < 0 ? "-∞" : "∞";
    const neg = n < 0; let a = neg ? -n : n;
    if (a < 1000) return (neg ? "-" : "") + (a | 0).toString();
    const sci = (META && META.opts && META.opts.notation === "sci");
    if (sci || a >= FMT_CAP) {   // scientific: forced by the setting, or auto when it gets crazy (beyond the suffix table)
      const e = Math.floor(Math.log10(a)), m = a / Math.pow(10, e);
      return (neg ? "-" : "") + m.toFixed(2) + "e" + e;
    }
    let i = 0; while (a >= 1000 && i < FMT_U.length - 1) { a /= 1000; i++; }
    return (neg ? "-" : "") + (a < 10 ? a.toFixed(2) : a < 100 ? a.toFixed(1) : Math.floor(a)) + FMT_U[i];
  }
  function fmtTime(s) { s |= 0; const d = s / 86400 | 0, h = s % 86400 / 3600 | 0, m = s % 3600 / 60 | 0, x = s % 60; return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m ? m + "m " + x + "s" : x + "s"; }   // days tier matters now that away time is uncapped

  /* ----------------------- defender unit types ------------------- */
  // Each class has a NICHE: vsBig = bonus damage to armored/tanky dots, vsSwarm =
  // bonus to weak/small/fast dots. So mixing classes beats stacking one.
  const DEF_TYPES = {
    turret:  { name: "Turret",  base: 60,     gal: 1,  dmg: 5,   rate: 1.4, range: 240, splash: 0,  max: 4, vsBig: 1.0, vsSwarm: 1.0, niche: "all-rounder — steady single-target backbone" },
    mortar:  { name: "Mortar",  base: 500,    gal: 2,  dmg: 64,  rate: 0.3, range: 215, splash: 95, max: 4, vsBig: 1.1, vsSwarm: 2.2, lob: 1, niche: "artillery — heavy arcing bombs (up to 2/s with its tree), devastating splash over a wide blast" },
    plasma:  { name: "Plasma",  base: 4000,   gal: 5,  dmg: 26,  rate: 0.5, range: 320, splash: 0,  max: 4, vsBig: 2.4, vsSwarm: 0.8, niche: "heavy bolts — melts tanky dots" },
    laser:   { name: "Laser",   base: 30000,  gal: 8,  dmg: 3,   rate: 4.2, range: 230, splash: 0,  max: 4, vsBig: 0.7, vsSwarm: 2.6, niche: "rapid beam — vaporizes fast/weak swarms" },
    railgun: { name: "Railgun", base: 250000, gal: 11, dmg: 90,  rate: 0.3, range: 430, splash: 0,  max: 4, vsBig: 4.0, vsSwarm: 0.6, niche: "huge slugs — anti-armor sniper" },
    nova:    { name: "Nova",    base: 4.0e6,  gal: 14, dmg: 340, rate: 0.5, range: 380, splash: 72, max: 4, vsBig: 3.2, vsSwarm: 1.0, niche: "void bombardment — Erebus-forged, splash that clears whole clusters (its power is the blast, not a per-dot swarm bonus)" },
  };
  const DEF_ORDER = ["turret", "mortar", "plasma", "laser", "railgun", "nova"];
  /* ----------------------- collector types ----------------------- */
  // Collectors gather the cash orbs dots drop. Like defenders they come in
  // classes you buy more of, each with its OWN skill tree. "hole" mode = a
  // black-hole vacuum that slowly drags every orb (and nearby dots) inward.
  const COL_TYPES = {
    drone:       { name: "Drone",          base: 60,         gal: 1,  speed: 88,  suction: 38,  collect: 9,  yield: 1.0, cap: 2,  mode: "chase", sides: 4, max: 4 },
    swarm:       { name: "Drone Swarm",    base: 9000,       gal: 3,  speed: 150, suction: 60,  collect: 13, yield: 1.2, cap: 3,  mode: "swarm", sides: 3, max: 2 },
    collector:   { name: "Heavy Collector",base: 120000,     gal: 6,  speed: 110, suction: 86,  collect: 20, yield: 1.5, cap: 3,  mode: "chase", sides: 6, max: 2 },
    magnet:      { name: "Magnet Rig",     base: 1800000,    gal: 9,  speed: 140, suction: 120, collect: 26, yield: 1.9, cap: 4,  mode: "chase", sides: 5, max: 2 },
    tractor:     { name: "Tractor Array",  base: 26000000,   gal: 11, speed: 130, suction: 170, collect: 34, yield: 2.3, cap: 4,  mode: "chase", sides: 8, max: 2 },
    singularity: { name: "Black Hole",     base: 350000000,  gal: 13, speed: 48,  suction: 450, collect: 46, yield: 2.8, cap: 6,  mode: "hole",  sides: 0, max: 2 },
    wormhole:    { name: "Wormhole",       base: 5.0e9,      gal: 16, speed: 64,  suction: 650, collect: 64, yield: 3.4, cap: 8,  mode: "hole",  sides: 0, max: 2 },   // base bays cut (m2): Capacity now STARTS as a real throttle you must upgrade. Base suction raised (m4) so a fresh hole already covers a real chunk of the field instead of a tiny circle.
  };
  const COL_ORDER = ["drone", "swarm", "collector", "magnet", "tractor", "singularity", "wormhole"];
  const ALL_TYPES = [...DEF_ORDER, ...COL_ORDER];
  const isCol = type => !!COL_TYPES[type];
  const TY = type => DEF_TYPES[type] || COL_TYPES[type];
  const newUnit = type => ({ type, cd: rnd(0, 0.4) });
  const classList = type => isCol(type) ? S.collectors : S.units;
  const countType = type => classList(type).filter(u => u.type === type).length;
  const BUY_MUL = 5;   // global ~5× slowdown on buying units/upgrades/nodes — army-building is a long arc, not a 40-min sprint
  const TEST_MUL = () => S.free ? 0.01 : 1;   // TEST MODE is no longer "free" — everything costs 1% of normal (so the economy still runs, just 100× faster, and between-planet flow behaves)
  const ecoCost = () => eco(Math.max(S.galaxy, S.peakGalaxy || 1));   // v17 ONE ARMY: every price rides the FRONTIER planet's economy — revisiting an early world never discounts purchases (one fleet, one economy, no farm-backwards exploit)
  // ── v18.0 NORMAL IDLE ECONOMY (owner call: "redo the scaling — reflect a normal idle game, we're
  // not reinventing the wheel; the only bespoke work is planet-to-planet balance"). Every price in
  // the game is now a FIXED geometric curve set at design time — nothing reads your income, nothing
  // ratchets, nothing re-baselines. Income is purely the product of what you bought; pacing comes
  // entirely from the planet-to-planet ratios (eco step / system jump / target growth). The whole
  // adaptive-pricing era (cpsS anchors, farmed-income division, frozen quotes, eco snapshots) is
  // deleted, not disabled. Template: Clicker Heroes — zones escalate, prices never care what you earn.
  // A class costs 2% of its UNLOCK planet's conquer target (a fixed constant — meaningful money at
  // unlock, melting later exactly like an old Cookie Clicker building), ×1.5 per copy.
  // STARTER-PAIR EXCEPTION (P1 cold open): every later class lands on an army that's already rolling,
  // but the turret/drone are met at run-1 minute-0, when income is ~1/1000 of P1's designed average —
  // at 2% the second turret would be a 19-hour wall (measured ×3.4 designed, O1 breach). The starter
  // pair is the game's "cursor": ~0.01% of the P1 target (≈ a couple of minutes at cold-open income),
  // still ×1.5 per copy so the chain lands at millions by the cap and melts on schedule.
  const UNIT_FRAC = t => (TY(t).gal || 1) <= 1 ? 1e-4 : 0.02;
  const unitBuyCost = type => Math.ceil(UNIT_FRAC(type) * conquerTarget(TY(type).gal || 1) * Math.pow(1.5, countType(type)) * pk().cost * TEST_MUL());
  // ---- class skill tree: an interconnected node MAP. Each class allocates
  // nodes outward from a start node; a node can only be taken once a CONNECTED
  // node is already allocated. Aggregated bonuses live in derived.cls[type].
  const DEF_PRIM = ["dmg", "rate", "range", "int"], COL_PRIM = ["speed", "suction", "collect", "capacity"];
  // BESPOKE per-class primaries — a hook for giving a class a different wing layout.
  // The Mortar starts as a slow artillery piece (one heavy bomb every few seconds) but
  // its fire-rate wing lets it climb to a 2/s cap (uRate) — a hard-hitting 0.5s splasher,
  // never a machine gun. Its blast radius still scales via the range wing + its big base.
  const DEF_PRIM_BY = { mortar: ["dmg", "rate", "range", "int"] };   // mortar shares the standard dmg/rate/range/Mind wings; the 2/s cap in uRate keeps it artillery, not a turret
  const dPrim = type => DEF_PRIM_BY[type] || DEF_PRIM;
  // Tree nodes add a FLAT bonus that STACKS ADDITIVELY — a stat's multiplier is
  // 1 + (sum of its nodes' bonuses). Bonuses do NOT compound off each other, so
  // deep trees scale LINEARLY (no exponential runaway), and because each new node
  // is a smaller share of a growing total, the effect naturally tapers — early
  // nodes feel strong, late nodes are incremental.
  // mul/rate/speed/suction/ingest bonuses are FRACTIONS (0.4 = +40%); range/collect
  // are flat distances; crit is flat chance.
  // Defender baseline (turret = tier 1). Later classes scale UP via DEF_SCALE, so a
  // gal-7 Railgun tree is FAR stronger per node than a gal-1 Turret — "scaled correctly."
  const MAG_DEF = { mul: { min: 1.75, maj: 4.9, key: 12.6 }, rate: { min: 1.5, maj: 3.375, key: 8.25 }, range: { min: 16, maj: 42, key: 95 }, crit: { min: 0.05, maj: 0.12, key: 0.25 }, splash: { min: 0.22, maj: 0.55, key: 1.3 } };   // crit magnitudes retuned DOWN so a full wing lands near its cap (0.85) instead of 3-7× over — every node counts; crit excess past 85% becomes bonus crit DAMAGE (see uCritMul); int has NO magnitude table — every ◈ slot is a flat +10% (INT_STEP)   // splash = +% blast RADIUS per node (mortar only), flat (not class-scaled) — area grows with the square so it's potent   // DMG (mul) calmed ×0.7 (250→175% minor), FIRE RATE calmed ×0.75 (200→150% minor) at every tier — same shape, "a bit more than half", so spawn-rate/value aren't out-bottlenecked. range = flat px/node; int = "Mind" smarter targeting (additive toward fully-smart=1)
  const DEF_SCALE = { turret: 1.0, mortar: 1.4, plasma: 1.5, laser: 1.6, railgun: 1.7, nova: 1.8 };   // COMPRESSED (was up to 4.2) so later classes aren't strictly dominant; nodeCost now also rides DEF_SCALE so stronger nodes cost proportionally — classes are sidegrades, not strict upgrades
  // Collectors are pure LOGISTICS (no income multiplier — yield lives in Economy):
  // Speed = chase movement, Reach (collect) = gather RADIUS / engagement gate (cReach),
  // Pull (suction) = reel STRENGTH that hauls engaged orbs to the mouth (cPull),
  // Ingest = how fast it swallows what reaches the mouth, Capacity = parallel maw bays.
  // Process (ingest) is a STRONG per-node lever — +100% / +200% / +400% — so a full
  // Process wing makes even heavy loot vanish. capacity = how many loot orbs a collector
  // PROCESSES at once (parallel maw bays): a multiplier on the (now low) base bay count.
  // m2 fix: base bays cut + Capacity magnitudes slashed (+12% / +28% / +60% per node) so
  // Capacity is a SLOW, meaningful upgrade you genuinely need — start throttled, climb to a
  // sensible max (~tens of bays maxed, not hundreds), instead of an instant over-provision.
  const MAG_COL = { speed: { min: 0.5, maj: 1.1, key: 2.2 }, suction: { min: 0.2, maj: 0.4, key: 0.8 }, collect: { min: 0.2, maj: 0.45, key: 1.0 }, capacity: { min: 0.12, maj: 0.28, key: 0.6 }, ingest: { min: 1.0, maj: 2.0, key: 4.0 } };   // suction (Pull) = reel-STRENGTH multiplier; collect (Reach) = gather-RADIUS multiplier (both now %-style); past their caps → yield (cYield) so no node is wasted   // speed/suction/reach magnitudes calmed ~3-4× so a wing is a gradual CLIMB to its cap, not a 1-2-node instant-cap; whatever a maxed wing pushes PAST the hard cap converts to collection yield (see cYield) so no logistics node is ever wasted — robust to the 3× base-speed variance across collectors
  const allocCount = type => { const m = S.classNodes[type]; let n = 0; if (m) for (const k in m) if (m[k]) n++; return n; };
  // Mind (int) quanta (v17.7, owner call): every ◈ node grants a flat +10%, and each defender tree
  // carries EXACTLY ten Mind slots (enforced in buildTree — surplus deep Mind converts to Crit), so
  // the branch is a clean, countable 0% → 100% climb: ten upgrades to a fully calibrated class.
  const INT_STEP = 0.10;
  function slotAmt(type, s) {
    if (isCol(type)) {
      if (s.p === "x") return MAG_COL.ingest[s.mag];                 // x branch = ingestion speed
      return MAG_COL[COL_PRIM[s.p - 1]][s.mag];                      // speed / suction / collect (reach)
    }
    const sc = DEF_SCALE[type] || 1;
    if (s.p === "x") return MAG_DEF.crit[s.mag];                        // crit = flat chance, not tier-scaled
    const key = dPrim(type)[s.p - 1];
    if (key === "range") return MAG_DEF.range[s.mag];                   // range = flat distance, not scaled
    if (key === "int") return INT_STEP;                                 // Mind — flat +10% per slot, ten slots per tree (see buildTree)
    if (key === "splash") return MAG_DEF.splash[s.mag];                 // blast radius = flat % bonus, not class-scaled (mortar)
    return (key === "rate" ? MAG_DEF.rate[s.mag] : MAG_DEF.mul[s.mag]) * sc;   // dmg/rate bonuses scale by class tier
  }
  function classStats(type) {
    const col = isCol(type), prim = col ? COL_PRIM : dPrim(type);
    const o = { dmg: 1, rate: 1, range: 0, crit: 0, int: 0, splash: 1, speed: 1, suction: 1, yield: 1, collect: 1, capacity: 1, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0,
      n: { dmg: 0, rate: 0, range: 0, int: 0, crit: 0, splash: 0, speed: 0, suction: 0, collect: 0, capacity: 0, ingest: 0 } };   // n = allocated-node count per branch, drives the per-upgrade visual marks
    const A = S.classNodes[type], G = buildTree(type);
    if (A) for (const id in A) { if (!A[id]) continue; const n = G.map[id]; if (!n || !n.slots) continue;
      if (n.kind === "key") { if (col) { o.capacity += 0.6; o.suction += 0.4; } else { o.multi++; if (n.spec) o[n.spec]++; } }   // defender keystone = +1 multishot + ✦ spec; collector keystone = ✦ +60% parallel bays & +40% pull (its transformative payoff)
      // Every bonus ADDS (sums linearly) — nothing compounds, so no runaway.
      for (const s of n.slots) { const amt = slotAmt(type, s), key = s.p === "x" ? (col ? "ingest" : "crit") : prim[s.p - 1];
        o[key] += amt; if (o.n[key] != null) o.n[key]++; } }
    o.multi = Math.min(o.multi, 9);   // raised 6→9 so railgun(8)/nova(9) keystones all contribute (no wasted "+1 multishot")
    if (!col) o.int = Math.min(1, o.int);   // Mind hard-caps at 100% — ten +10% slots land exactly there (see buildTree); no overflow, no crit cascade
    return o;
  }
  const ZERO = { dmg: 1, rate: 1, range: 0, crit: 0, int: 0, splash: 1, speed: 1, suction: 1, yield: 1, collect: 1, capacity: 1, ingest: 1, multi: 0, explosive: 0, chain: 0, pierce: 0, n: { dmg: 0, rate: 0, range: 0, int: 0, crit: 0, splash: 0, speed: 0, suction: 0, collect: 0, capacity: 0, ingest: 0 } };
  const uMulti = u => cls(u.type).multi || 0;
  const uInt = u => cls(u.type).int || 0;   // intelligence: 0 = dumb, ~1 = perfect overkill-avoidance & coordination
  const cls = type => (derived.cls && derived.cls[type]) || ZERO;
  // v17.1 ERA SCALING — under ONE ARMY a class bought at its unlock planet arrives with an EMPTY tree
  // into dots whose HP has grown diff(g)^0.4 since P1; without this a shiny new Railgun plinked like a
  // wet noodle next to your veteran turrets. Each defender's BASE damage now rides the exact HP scale of
  // its HOME planet (ERA = enemyHpMul(gal)) — a naked new weapon lands punching at its era's weight. Its
  // tree nodes are priced ×ERA to match (same philosophy as DEF_SCALE: stronger nodes cost proportionally),
  // so classes stay sidegrades per credit spent. Collectors are pure logistics — no era scaling needed.
  const ERA = type => isCol(type) ? 1 : Math.pow(diff(TY(type).gal || 1), 0.4);
  const uDmg = u => DEF_TYPES[u.type].dmg * ERA(u.type) * cls(u.type).dmg * pk().dmg;   // × era weight × permanent Ascension damage perk
  const uRate = u => { const r = DEF_TYPES[u.type].rate * cls(u.type).rate * pk().rate * (frenzyT > 0 ? 5 : 1); return u.type === "mortar" ? Math.min(2, r) : r; };   // Frenzy = 5× fire rate; × Ascension rate perk; mortar HARD-CAPPED at 2/s (every 0.5s) even after perks — heavy arcing bombs, never a machine gun
  const uRange = u => DEF_TYPES[u.type].range + cls(u.type).range + pk().range;
  const uCrit = u => Math.min(0.85, cls(u.type).crit + pk().crit);   // + permanent Ascension crit perk (still hard-capped at 0.85; excess → crit damage via uCritMul)
  const uCritMul = u => 2.2 + Math.max(0, cls(u.type).crit - 0.85) * 0.8;   // crit chance hard-caps at 0.85, but a deeper crit wing isn't wasted: every point of crit past the cap converts to bonus crit DAMAGE — heavy-crit specialists hit harder instead of overflowing into nothing
  const uSplash = u => DEF_TYPES[u.type].splash ? (DEF_TYPES[u.type].splash + cls(u.type).range * 0.4) * (cls(u.type).splash || 1) : 0;   // blast radius grows with the dedicated splash wing (mortar)
  // ✦ keystone SPECIALIZATIONS (BTD-style transformations) — counts of allocated keystones of each kind
  const uExplode = u => cls(u.type).explosive || 0;   // shots detonate (splash) — "bomb tower"
  const uChain   = u => cls(u.type).chain || 0;        // shots arc to nearby dots — "chain lightning"
  const uPierce  = u => cls(u.type).pierce || 0;        // shot becomes a piercing beam — "laser lance"
  const SPEC_NAME = { explosive: "Explosive Rounds", chain: "Chain Lightning", pierce: "Piercing Laser" };
  const SPECS = ["explosive", "chain", "pierce"];
  // Each defender has a SIGNATURE specialization its keystones all reinforce (stacking
  // = stronger), matching its niche: bombs for the splash class, beams for the snipers…
  const CLASS_SPEC = { turret: "chain", mortar: "explosive", plasma: "chain", laser: "pierce", railgun: "pierce", nova: "explosive" };
  // Speed is capped so a maxed Speed tree makes collectors fast & agile, not so
  // fast they teleport PAST orbs (which used to zero out collection). Suction
  // (the pull/ring radius) is capped well under the field so collectors must keep
  // roaming to cover it — they never become stationary field-wide magnets. The
  // black hole keeps its huge reach.
  const cSpeed   = type => Math.min(900, COL_TYPES[type].speed * cls(type).speed) * FIELD_COMP;   // x FIELD_COMP: a bigger field needs faster roaming (cap scales with it — "fast but never teleports past orbs" stays relatively true)
  // REACH = gather RADIUS (the engagement gate): base radius (the well-tuned old pull base) × the Reach wing.
  // Any orb inside cReach is locked on and reeled toward the collector. Capped so a collector still roams.
  const REACH_CAP = type => COL_TYPES[type].mode === "hole" ? 900 : 240;
  const cReach   = type => Math.min(REACH_CAP(type), COL_TYPES[type].suction * cls(type).collect) * FIELD_COMP;   // x FIELD_COMP: grab radius keeps the same RELATIVE coverage of the bigger PC field
  // PULL = drag STRENGTH (×1 at base): how fast an engaged orb is reeled to the mouth. Applied to the reel
  // force at the orb site; heavy/armored loot drags slowly, so Pull matters most for fat orbs & big Reach.
  const cPull    = type => cls(type).suction * FIELD_COMP;   // x FIELD_COMP: reel distances grow with the field, so drag strength grows with it — engaged orbs land in the same time as on mobile
  const MOUTH    = 16;   // fixed grab distance: once an orb is reeled within MOUTH it starts being consumed (Process/Capacity take over)
  const cIngest  = type => cls(type).ingest;                 // how fast loot is swallowed (x branch); big loot benefits most
  const cCapacity = type => Math.max(1, Math.round(COL_TYPES[type].cap * cls(type).capacity));   // how many orbs it processes in parallel (bays); low base × the slow Capacity wing — a real throttle you upgrade (m2)
  const colOverYield = type => {   // logistics points pushed PAST a hard cap (speed/pull/reach) convert to collection yield, so no logistics node is ever wasted even with the 3× base-speed variance across collectors; under-cap stats simply benefit from raw value
    const c = cls(type), B = COL_TYPES[type], sucCap = B.mode === "hole" ? 900 : 240;
    const over = (val, cap) => Math.max(0, val / cap - 1);
    const r = over(B.speed * c.speed, 900) + over(B.suction * c.collect, sucCap);   // Speed & Reach-radius past their caps convert to yield; Pull is an uncapped reel force, so it's never wasted
    return 1 + Math.min(0.4, r * 0.06);   // BOUNDED: a fully-maxed logistics build adds at most +40% yield, and only by heavily over-investing past the caps
  };
  const cYield   = type => COL_TYPES[type].yield   * cls(type).yield * colOverYield(type) * pk().yield;   // gather efficiency × overcap-yield × permanent Ascension yield perk. (Conquest multiplier was removed; orb value no longer carries it, so income is applied cleanly once here.)
  const AGILITY = 0.12;

  // flavour names: one pool per stat branch (a/b/c) plus the extra 'x' branch.
  // every node — even the small passives — pulls a distinct name from its pool.
  const SKILLS = {
    turret:  { a: ["Reinforced Rounds", "Tungsten Core", "Armor Piercing", "Hollow Points", "Overcharge", "Heavy Slugs", "Devastator"], b: ["Quick Hands", "Belt Feed", "Rapid Servos", "Hair Trigger", "Double Tap", "Cyclic Bolt", "Gatling Drive"], c: ["Scope", "Range Finder", "Laser Sight", "Tracking AI", "Eagle Eye", "Long Barrel", "Hawkeye"], d: ["Targeting Chip", "Threat Sense", "Kill Tracker", "Fire Discipline", "Combat Logic", "Squad Link", "Tactical Core"], x: ["Critical Core", "Deadeye", "Killshot"] },
    mortar:  { a: ["Bigger Shells", "Dense Payload", "Thermobaric", "Heavy Ordnance", "Tungsten Casing", "Bunker Buster", "Doomshell"], b: ["Wider Blast", "Shrapnel Load", "Airburst", "Saturation", "Cluster Munitions", "Wide Arc", "Fuel-Air Bomb"], c: ["Spotter", "Long Tube", "Range Tables", "High Angle", "Forward Spotter", "Extended Charge", "Bullseye"], d: ["Fire Plan", "Spotter Net", "Impact Sense", "Salvo Logic", "Forward Observer", "Battery Link", "Strike Command"], x: ["Shell Shock", "Pinpoint", "Devastation"] },
    plasma:  { a: ["Ion Charge", "Superheated", "Fusion Core", "Antimatter", "Singularity Bolt", "Plasma Surge", "Star Core"], b: ["Capacitor", "Coolant Loop", "Overclock", "Rapid Cycle", "Continuous Beam", "Supercooled", "Flux Drive"], c: ["Focusing Lens", "Long Barrel", "Crit Matrix", "Targeting Array", "Lancer", "Beam Optics", "Far Sight"], d: ["Logic Core", "Heuristics", "Threat Model", "Predict Engine", "Sentience", "Neural Mesh", "Mind Lattice"], x: ["Crit Core", "Overcharge Cell", "Meltdown"] },
    laser:   { a: ["Amplifier", "Focused Beam", "Burning Ray", "Photon Surge", "Death Ray", "Hot Lens", "Sunfire"], b: ["Pulse Rate", "Rapid Emitter", "Resonance", "Overdrive", "Constant Stream", "Fast Cycle", "Lightstorm"], c: ["Mirror Array", "Extended Optics", "Heat Seeker", "Crit Lens", "Prism Split", "Wide Mirror", "True Aim"], d: ["Tracking AI", "Scan Logic", "Priority Lock", "Predictive Aim", "Swarm Sense", "Hunter Net", "Omniscience"], x: ["Crit Focus", "Focal Point", "Vaporize"] },
    railgun: { a: ["Mag Core", "Hypervelocity", "Depleted Slug", "Mass Driver", "Annihilator", "Tungsten Rod", "Worldbreaker"], b: ["Quick Charge", "Capacitor Bank", "Auto-Rack", "Rapid Rail", "Salvo", "Fast Coil", "Volley"], c: ["Long Rail", "Calibration", "Piercing Round", "Crit Targeting", "Railstorm", "Extended Rail", "Dead Centre"], d: ["Fire Solution", "Ballistic AI", "Target Lock", "Lead Computer", "Kill Predictor", "War Mind", "Oracle Core"], x: ["Crit Lock", "Penetrator", "One Shot"] },
    nova:    { a: ["Void Charge", "Dark Matter", "Collapsed Core", "Singularity Shell", "Entropy Warhead", "Null Lance", "Annihilation"], b: ["Rift Cycle", "Warp Loader", "Phase Battery", "Rapid Rift", "Continuous Void", "Fast Collapse", "Eventstorm"], c: ["Deep Sight", "Void Optics", "Far Rift", "Gravity Lens", "Horizon Scope", "Long Reach", "Omni-Sight"], d: ["Void Logic", "Star Sense", "Threat Horizon", "Cosmic Predict", "Astral Mind", "Nebula Net", "Cosmic Oracle"], x: ["Critical Void", "Dead Star", "Supernova"] },
  };
  // collector skill webs: a=Speed, b=Suction, c=Reach (grab distance), d=Capacity (parallel
  // maw bays — how many orbs at once), x=Ingest (loot-swallow speed)
  const COL_SKILLS = {
    drone:       { a: ["Light Frame", "Tuned Rotors", "Boosters", "Ion Thrust", "Slipstream", "Quick Servos", "Overdrive"], b: ["Magnet", "Wide Field", "Tractor Coil", "Graviton Pull", "Event Field", "Strong Coil", "Deep Pull"], c: ["Bigger Scoop", "Wide Grip", "Long Arms", "Quick Latch", "Tractor Grip", "Snap Reach", "Vacuum Maw"], d: ["Twin Bay", "Extra Hopper", "Triple Maw", "Parallel Feed", "Multi-Intake", "Bay Array", "Hydra Maw"], x: ["Quick Gulp", "Maw Servo", "Grinder", "Crush Jaws", "Smelter", "Furnace Maw", "Devourer"] },
    swarm:       { a: ["Hive Mind", "Sync Wings", "Formation", "Overswarm", "Locust Dash", "Fast Hive", "Blitz"], b: ["Net Cast", "Mesh Field", "Swarm Pull", "Hive Gravity", "Total Sweep", "Wide Mesh", "Dragnet"], c: ["Many Hands", "Wide Reach", "Long Grip", "Pack Latch", "Total Grasp", "Far Hands", "Hive Grip"], d: ["Split Duty", "More Mouths", "Spread Feed", "Parallel Swarm", "Many Maws", "Wide Intake", "Devour Cloud"], x: ["Big Net", "Hive Hold", "Quick Strip", "Mass Feed", "Pack Digest", "Hive Mill", "Treasury"] },
    collector:   { a: ["Servo Boost", "Heavy Treads", "Turbo", "Afterburner", "Warp Frame", "Quick Haul", "Blink Drive"], b: ["Big Magnet", "Wide Maw", "Gravity Plate", "Pull Field", "Vortex", "Strong Maw", "Black Maw"], c: ["Cargo Arms", "Wide Maw", "Long Reach", "Bulk Grip", "Grand Reach", "Heavy Latch", "Maw Spread"], d: ["Twin Hopper", "Extra Bay", "Triple Intake", "Parallel Bays", "Conveyor Bank", "Bay Cluster", "Mega Intake"], x: ["Maw Bay", "Cargo Bay", "Crusher", "Bulk Mill", "Ore Press", "Smelt Bay", "Strongbox"] },
    magnet:      { a: ["Spin Up", "Coil Tune", "Rail Drive", "Mag-Lev", "Flux Dash", "Quick Coil", "Overspin"], b: ["Dipole", "Quad Coil", "Field Bloom", "Deep Pull", "Magnetar", "Strong Dipole", "Pole Reversal"], c: ["Grab Coil", "Wide Pole", "Long Coil", "Grip Field", "Vast Reach", "Strong Latch", "Pole Spread"], d: ["Twin Pole", "Extra Coil Bay", "Triple Intake", "Parallel Coils", "Multi-Pole", "Coil Bank", "Pole Array"], x: ["Wide Coil", "Storage Coil", "Flux Mill", "Eddy Press", "Induction Forge", "Quick Smelt", "Bullion"] },
    tractor:     { a: ["Emitter Tune", "Beam Drive", "Phase Step", "Warp Coil", "Lightspeed", "Quick Beam", "Hyperdrive"], b: ["Cone Cast", "Wide Beam", "Tow Field", "Deep Tow", "Star Reach", "Broad Beam", "Long Reach"], c: ["Hopper Arm", "Wide Grip", "Long Tow", "Cone Latch", "Far Reach", "Broad Grip", "Tow Spread"], d: ["Twin Beam", "Extra Tractor", "Triple Tow", "Parallel Beams", "Multi-Lock", "Beam Bank", "Beam Array"], x: ["Wide Cone", "Hold Beam", "Beam Mill", "Phase Press", "Plasma Forge", "Quick Render", "Reserve"] },
    singularity: { a: ["Drift Control", "Orbit Tune", "Wander", "Roam Field", "Phase Drift", "Slow Roll", "Free Orbit"], b: ["Deeper Well", "Wider Horizon", "Tidal Force", "Crushing Pull", "Infinite Reach", "Gravity Sink", "Abyssal Pull"], c: ["Event Reach", "Wide Maw", "Long Horizon", "Deep Grip", "Vast Reach", "Abyss Latch", "Maw Spread"], d: ["Twin Horizon", "Extra Well", "Triple Maw", "Parallel Wells", "Multi-Crush", "Event Bank", "Devour Array"], x: ["Event Maw", "Mass Vault", "Spaghetti Mill", "Tidal Crush", "Hawking Forge", "Quick Collapse", "Singularity Core"] },
    wormhole:    { a: ["Throat Tune", "Rift Drive", "Phase Jump", "Warp Frame", "Lightfold", "Quick Fold", "Hyperfold"], b: ["Deep Throat", "Wide Maw", "Spacetime Pull", "Crushing Well", "Infinite Draw", "Gravity Sink", "Cosmic Pull"], c: ["Event Reach", "Wide Horizon", "Long Throat", "Deep Grip", "Vast Reach", "Rift Latch", "Maw Spread"], d: ["Twin Throat", "Extra Well", "Triple Maw", "Parallel Rifts", "Multi-Fold", "Rift Bank", "Devour Array"], x: ["Rift Maw", "Void Vault", "Spacetime Mill", "Tidal Render", "Hawking Forge", "Fast Render", "Wormhole Core"] },
  };
  const skillNames = type => isCol(type) ? COL_SKILLS[type] : SKILLS[type];
  // --- progression MAP: three SOLAR SYSTEMS, each with 4–8 PLANETS. The linear
  // travel index S.galaxy is the GLOBAL planet number (1..TOTAL_PLANETS); the map
  // just groups those planets into systems visually. Travel still advances one
  // planet at a time, and all the difficulty/scaling functions stay f(globalIndex).
  const SYSTEMS = [
    { name: "Helios", planets: 4 },   // inner, warm — find your rhythm
    { name: "Cygnus", planets: 6 },   // mid — the arsenal fills out
    { name: "Erebus", planets: 8 },   // outer dark — endless brutal grind
  ];
  const PLANET_NAMES = [
    "Vesta", "Ember", "Cinder", "Hearth",                              // Helios
    "Azure", "Verdant", "Cobalt", "Mistral", "Halcyon", "Tempest",     // Cygnus
    "Umbra", "Frost", "Onyx", "Wraith", "Pyre", "Abyss", "Maw", "Oblivion", // Erebus
  ];
  const PLANET_DESC = [
    "A quiet inner world. Sparse, fragile dots — find your rhythm.",
    "Drifting embers. Swarms move faster; keep collectors close.",
    "Scorched cinder fields. Hotter, tougher dots — Mortars forge here.",
    "The hearth-world. Dense clouds and richer payouts — feed your Mortars.",
    "Azure tides. Reinforced dots demand real damage — Plasma ignites.",
    "Verdant sprawl. Relentless waves — Plasma cuts through.",
    "Cobalt deep. High-value specials surface far more often.",
    "Stormwinds. Chaotic, dense spawns — Lasers shred them.",
    "A deceptive calm before the outer dark.",
    "Tempest belt. Massive, high-HP dots roll through.",
    "The outer dark begins. Brutal density — your whole arsenal earns its keep.",
    "Frostbound. Slow but enormous dots.",
    "Onyx void. Armored elites everywhere.",
    "Wraith-light. Phantoms phase through your fire.",
    "A dying star's pyre. Everything burns hotter.",
    "The Abyss. Endless and merciless.",
    "The Maw. It only takes.",
    "Oblivion. How deep can you push?",
  ];
  const PLANET_SYS = [], PLANET_LOCAL = [];
  SYSTEMS.forEach((s, si) => { for (let l = 0; l < s.planets; l++) { PLANET_SYS.push(si); PLANET_LOCAL.push(l); } });
  const TOTAL_PLANETS = PLANET_SYS.length;
  const planetIdx = g => Math.min(Math.max(g, 1), TOTAL_PLANETS) - 1;
  const sysName = g => SYSTEMS[PLANET_SYS[planetIdx(g)]].name;
  const galName = g => PLANET_NAMES[g - 1] || (PLANET_NAMES[PLANET_NAMES.length - 1] + " " + g);
  const galDesc = g => PLANET_DESC[planetIdx(g)];
  const uColor = u => u.type === "mortar" ? "#9a9a9a" : (u.type === "turret" || u.type === "nova") ? "#ffffff" : "#cccccc";   // nova glows bright white like the endgame weapon it is
  // Defenders auto-arrange into a tidy, centred formation that re-racks itself
  // as you buy more — like beer-pong cups: a lone unit sits centre, a handful
  // form a neat ring, more fill concentric rings (the last ring always spread
  // evenly), so 5 and 50 read as different but equally organised shapes.
  let _form = { sig: null, pts: [] };
  // Defenders arrange by COMPOSITION: each type forms its own centred, evenly-spaced row, and the rows
  // stack symmetrically around the field centre. So 4 turrets + 2 mortars reads as a row of 4 over a row
  // of 2 (each centred → left/right symmetric), distinct from any other mix — tidy, balanced, legible.
  function unitFormation() {
    const sig = S.units.map(u => u.type).join(",");
    if (_form.sig === sig) return _form.pts;
    const byType = {}; S.units.forEach((u, i) => { (byType[u.type] || (byType[u.type] = [])).push(i); });
    const rows = DEF_ORDER.filter(t => byType[t]).map(t => byType[t]);   // one row per present type, in canonical order
    const pts = new Array(S.units.length).fill(null);
    const SX = 60, SY = 64, totalH = (rows.length - 1) * SY;             // even gaps; whole block vertically centred
    rows.forEach((idxs, r) => {
      const y = -totalH / 2 + r * SY, w = (idxs.length - 1) * SX;        // each row horizontally centred → symmetric
      idxs.forEach((ui, k) => { pts[ui] = { x: -w / 2 + k * SX, y }; });
    });
    _form = { sig, pts };
    return pts;
  }
  function unitPos(i) { const p = unitFormation()[i] || { x: 0, y: 0 }; return { x: W / 2 + p.x, y: H / 2 + p.y }; }

  /* ----------------------- drone + economy upgrades -------------- */
  const UPS = [
    { id: "capacity",  tab: "eco", name: "Capacity",   base: 40, mul: 1.42,   /* v18.0 fixed global curves */ desc: () => curSym(S.galaxy) + " " + fmt(derived.capacity) + mileTag("capacity") },
    // Spawn Rate is the CHEAP thrust stat and Value the chunky multiplier — deliberate order (v18.0):
    // while dps-limited a Value level raises enemy HP ×1.139 (vMul^1.3) but income only ×1.10, so a
    // cheap Value would be the cold-open's first buy AND a newbie trap. Spawn never betrays you.
    { id: "value",     tab: "eco", name: "Value",      base: 130, mul: 1.46, desc: () => "×" + derived.valueMul.toFixed(2) + " /dot" + mileTag("value") },
    { id: "spawnRate", tab: "eco", name: "Spawn Rate", base: 60, mul: 1.48, desc: () => { const raw = derived.spawnPerSec || 0, om = spawnOver(raw); return raw.toFixed(1) + " /s" + (om > 1.02 ? "  ·  ~" + spawnVis(raw).toFixed(0) + "/s on screen + ×" + om.toFixed(1) + " tougher" : "") + mileTag("spawnRate"); } },
    { id: "luck",      tab: "eco", name: "Luck",       base: 140, mul: 1.34, desc: () => (derived.luck * 100).toFixed(1) + "% special" + mileTag("luck") },
  ];
  // =============== v18.51 FINER RUNGS ABOVE THE COLD OPEN, SAME LADDER ===============
  // Owner: "cheaper upgrades that do less so it feels better", plus milestones, plus an ascend
  // prompt. Measured first: eco upgrades are NOT mispriced — the next Value costs a flat ~2.4% of
  // whatever planet you stand on, P1 to P8 (1.9/2.8/2.9/2.9/2.3/2.3/2.4%). What grows is the PLANET,
  // 2.8h to 75h, so that same correct proportion becomes a 1.8-hour wait for a +3% bump and the buy
  // loop stops handing you decisions. The problem is GRANULARITY, not price.
  //
  // A first attempt split every rung in half everywhere. Per-stat it was exactly neutral — and it
  // still broke the game, because the buy loop picks the cheapest thing ACROSS categories: halving
  // every eco entry price made eco rungs win against units and tree nodes whose prices had not
  // moved, so a greedy player pumped Value at the cold open, where Value inflates enemy HP by ^1.3
  // (the v18.0 note above says exactly this: "a cheap Value would be the cold-open's first buy AND a
  // newbie trap"). Measured: P1 ×1.47 → ×2.53, and the ecoFirst stress policy walled at ×5.40.
  //
  // So the split now starts ABOVE the cold open. Below ECO_FINE_FROM legacy levels a rung IS a legacy
  // level, priced and powered exactly as before — P1 is bit-identical. Above it, rungs are ECO_STEP×
  // finer, and the price of a fine rung is the legacy step scaled by (mul^(1/STEP)-1)/(mul-1), which
  // makes STEP of them cost precisely one legacy level. Every effect reads legacyLv(), so power and
  // cumulative spend match the old curve at every legacy level, in both zones.
  const ECO_STEP = 2, ECO_FINE_FROM = 12;
  const legacyLv = r => r <= ECO_FINE_FROM ? r : ECO_FINE_FROM + (r - ECO_FINE_FROM) / ECO_STEP;
  const rungLv   = L => L <= ECO_FINE_FROM ? L : ECO_FINE_FROM + (L - ECO_FINE_FROM) * ECO_STEP;   // save migration
  const ecoLegacy = id => legacyLv(ecoLv(id));
  // MILESTONES (owner call), defined in LEGACY levels so they behave identically in both zones.
  // A stat's growth is shaved by MILE_SHARE and handed back in a lump every MILE_LEG legacy
  // levels — something to save TOWARD instead of a flat trickle. Net-neutral ON every milestone by
  // construction; deliberately NOT extra income, which would be a balance change wearing a UX hat.
  //
  // v18.56 — ALL FOUR economy upgrades, one shape (owner: "milestones for ALL upgrades whilst
  // keeping the scaling pretty much exactly the same"). mileL() IS that shape: a legacy level with
  // MILE_SHARE of its most recent growth withheld, repaid in a lump on every multiple of MILE_LEG.
  // Two properties make the "same scaling" claim exact rather than approximate:
  //   mileL(L) === L whenever L % MILE_LEG === 0   → every stat is bit-identical to v18.55 at every
  //                                                  milestone, so the long-run ladder is untouched
  //   L - mileL(L) <= MILE_SHARE*(MILE_LEG-1) = 1.4 legacy levels → the worst-case mid-leg deficit,
  //                                                  the same 1.4 levels Value has run since v18.51
  // Every stat feeds its OWN curve through it, so an additive stat (Value, Spawn, Luck) withholds
  // additive gain and the one geometric stat (Capacity) withholds EXPONENT — same 1.4-legacy-level
  // lag in both cases, which is the only way "same scaling" means the same thing for both shapes.
  const MILE_LEG = 5, MILE_SHARE = 0.35, VAL_PER = 0.13;
  const mileL = L => (1 - MILE_SHARE) * L + MILE_SHARE * MILE_LEG * Math.floor(L / MILE_LEG);
  const valueFromLv = r => 1 + VAL_PER * mileL(legacyLv(r));
  const spawnFromLv = r => 0.9 + 1.15 * mileL(legacyLv(r));
  const capFromLv   = r => Math.pow(1.60, mileL(legacyLv(r)));
  const luckFromLv  = r => 0.003 * mileL(legacyLv(r));
  // what the lump actually bought, for the payoff banner — read AFTER recompute()
  const MILE_BLURB = {
    value:     () => "×" + derived.valueMul.toFixed(2) + " per dot",
    spawnRate: () => (derived.spawnPerSec || 0).toFixed(1) + " /s spawn",
    capacity:  () => curSym(S.galaxy) + " " + fmt(derived.capacity) + " ceiling",
    luck:      () => (derived.luck * 100).toFixed(1) + "% special",
  };
  const mileNext = r => { const L = legacyLv(r); const need = (Math.floor(L / MILE_LEG) + 1) * MILE_LEG; return Math.max(1, Math.ceil(rungLv(need) - r)); };
  // the countdown that rides every economy row's description. Suppressed once a stat has hit its
  // effect ceiling (only Luck has one, at 60%) — counting down to a lump that can't land is a lie.
  const mileTag = id => (id === "luck" && derived.luck >= 0.6) ? "" : "  ·  ✦ in " + mileNext(ecoLv(id));
  const ASC_HINT_S = 1800;   // one rung costing 30 min of farming = the run has given what it has
  const UP = {}; UPS.forEach(u => UP[u.id] = u);
  const UP_DISC = { value: 0.9, spawnRate: 0.9 };   // Value & Spawn Rate are a permanent 10% cheaper than the rest
  // v17.2 PLANET-RELATIVE ECONOMY (owner call): Value & Spawn Rate LEVELS persist with the army, but each
  // new frontier raises the BASELINE that "level zero" means — your carried level-50 Spawn behaves like an
  // early level on the new world ("the economy scales down to the planet") and you climb again from there.
  // COSTS rebase on the same effective level, so every planet gets its full, affordable eco-tab arc back.
  // Capacity & Luck stay ABSOLUTE — ceiling infrastructure persists outright (a re-baselined Capacity would
  // drop the cash ceiling below your wallet on every landing and dead-zone all banking).
  // v18.0: ONE GLOBAL LEVEL per eco upgrade — the normal idle model. No effective levels, no
  // re-baselines, no snapshots: the ladder is continuous across the whole campaign, and each new
  // planet's harder, richer dots are what re-scale the game (planet-to-planet ratios do the pacing).
  // ECO_BASE survives only as a legacy constant for old-save migration.
  const ECO_BASE = { value: 16, spawnRate: 12 };
  const ecoLv = id => S.lv[id] || 0;
  // v17.25 (owner call: "I land on P2 with 3 million and the eco upgrades cost 1000 — where is the
  // critical thinking"): the eco arc's price BASE now also rides YOUR income, not just the planet
  // constant. The audit had verified these arcs against DESIGN-typical arrival income — but a real
  // player farms P1 past the curve and lands earning 10× design, so planet-constant prices read as
  // chips against a launch-save wallet. Same disease as the mortars, same cure: the base is floored
  // at ~0.03s of live income (the mul^effectiveLevel growth curve is unchanged, so a carried level-12
  // Value costs ~10s of income, level-20 minutes, the deep arc stays the long save). Engages from
  // P2 like the unit anchor — virgin P1 keeps its classic tuned arc.
  // v18.0: the CLASSIC idle formula — a fixed base × a fixed ratio ^ your one global level. The curve
  // never resets, never reads your income; landing on a new planet just continues the same ladder
  // (which is exactly why there's no arrival spam and no moving goalposts — the next level costs
  // what the ladder says, forever).
  const upCost = u => { const r = ecoLv(u.id), L = legacyLv(r);
    const frac = r < ECO_FINE_FROM ? 1 : (Math.pow(u.mul, 1 / ECO_STEP) - 1) / (u.mul - 1);   // STEP fine rungs sum to exactly one legacy level
    return Math.ceil(u.base * Math.pow(u.mul, L) * frac * pk().cost * (UP_DISC[u.id] || 1) * TEST_MUL()); };

  // Travel is a hard, escalating wall tuned to the (deliberately slow) income ramp:
  // ~1 day to set up + bank the first jump, ramping gently (≈×3.2/planet) to a few
  // days each by the late planets.
  // Launching an expedition costs a sum scaling with the planet's economy (NOT your bank ceiling — so you
  // can't dodge it by keeping capacity low). It rides eco(g) exactly like your income does, so it stays a
  // ~constant ~8–15% slice of a planet's earnings on every world. (The old ×1.2^g escalator was balanced
  // against the now-removed Conquest multiplier's ×1.8^g income growth; with Conquest gone it would make
  // late-planet travel unaffordable, so it's dropped.)
  const TRAVEL_COST_K = 5e6;
  // v17.20 (robustness audit): travel is now a deliberate ~7-minute SAVE at your own live income —
  // the flat eco(g)×5e6 was tuned for the pre-ONE-ARMY per-planet economy and had become a hidden
  // 3-4 HOUR wall on a fresh run's first hop (P1 income is tiny vs eco×5e6), while melting far too
  // low relative to late-run incomes. The old formula survives as a CEILING (deep Engine regimes
  // melt old planets — their launches should be trivial), with a small eco floor so it's never free.
  // v18.0: launching costs a FIXED 15% of the planet's conquer target — proportionate at every depth,
  // frozen by construction (a constant can't move), no quotes, no anchors.
  const travelCost = g => { g = g || S.galaxy; return Math.round(0.15 * conquerTarget(g) * TEST_MUL()); };
  const launchPrice = () => travelCost();
  // HYBRID DIFFICULTY (see diff/eco below): each planet's NUMBER-MAGNITUDE rides eco(g) — income AND
  // costs both ride it, so it cancels and the per-planet loop has the same shape everywhere. What does
  // NOT cancel is enemyHpMul: dots get genuinely tankier per planet (and ~double at each new solar
  // system), the COMBAT wall a fresh fleet feels on landing — you out-grow it with more units & deeper trees.
  const enemyHpMul = g => Math.pow(diff(g), 0.4);       // dampened difficulty → dots tankier per planet (in-planet Value ramps them further)
  const galSpawnMul = g => 1;                           // flat base spawn (you raise it in-planet with Spawn Rate)
  const galCap = g => Math.round(550 * Math.min(FIELD_COMP, 1.5));   // field cap — v18.4 raised 400→550 (owner call: up the visual spawn limit; measured 0.21ms/step at the old 400-dot ceiling — headroom to spare). PC shell holds up to ~825; never shrinks for any reason
  // SOFT spawn ceiling (v14.4 — "Spawn Rate never goes dead"). Below the knee dots spawn 1:1 with
  // Spawn Rate. Above it the on-screen count KEEPS growing (38% of the extra rate becomes bodies) and
  // the rest converts to per-dot TOUGHNESS at a PREMIUM: cash rides menace^TOUGH_POW and
  // 0.8 × 1.45 ≈ 1.16 > 1, so overflow levels earn strictly MORE per point than 1:1 levels did —
  // the stat visibly and economically pays at EVERY level. Knee rides FIELD_COMP (the PC shell's
  // bigger field genuinely shows more raw spawns before tapering).
  const SPAWN_SMOOTH = 60, SPAWN_PASS = 0.38;   // v18.4: visible-spawn knee raised 38→60/s (owner call) — more of your Spawn Rate shows up as actual bodies before the toughness spillover kicks in
  const spawnKnee = () => SPAWN_SMOOTH * Math.min(FIELD_COMP, 1.5);
  const spawnVis = raw => { const k = spawnKnee(); return raw <= k ? raw : k + (raw - k) * SPAWN_PASS; };   // visible dots/sec (soft knee — keeps climbing forever, never flat)
  const spawnOver = raw => { const v = spawnVis(raw); return raw > v ? Math.min(Math.pow(raw / v, 0.8), 8) : 1; };   // un-spawned share → toughness at a premium (see TOUGH_POW note above)

  /* ====================== PLANET LAYERS (per-planet economy) ======================
     Each planet has its OWN currency and is its OWN fresh run. eco(g) is that planet's
     natural currency scale (what a plain dot drops there), so EVERY cost is rebased to
     eco(g): a planet plays the same shape in bigger numbers. Conquer a planet -> it joins
     your BACKGROUND empire, earning its currency passively (online + offline) at the rate
     you left it; revisit to upgrade it. (Historical note: the per-planet EXCHANGE this block
     once described is retired — one global currency since the v3 economy.) */
  // GLOBAL MONEY SCALE — the single root every cash number rides (eco(g) = CUR_BASE × diff(g), and the
  // starter purse, costs, dot drops, capacity and conquer targets all key off eco). Lower it and ALL money
  // scales down uniformly; because income AND costs ride it equally, pacing/conquer-times are unchanged.
  // At 2.5 you LAND with ~$100, first upgrade ~$25, plain dots drop a couple bucks — a humble idle start
  // that grows to billions+. (Bump it for bigger headline numbers; it only moves the decimal point.)
  const CUR_BASE = 2.5;
  // Each planet's currency has its OWN seeded magnitude (distinct, non-uniform) on top of the ×2.2 ladder.
  // conquerTarget AND income both ride eco(g), so this per-planet bump CANCELS in time-to-conquer — pacing
  // is provably unchanged; it only makes each planet's numbers feel unique and its starting purse distinct.
  // Each planet's currency is worth MORE than the previous — by a SEEDED, varying step (×1.6…×2.8), so the
  // magnitudes are distinct/non-uniform yet ALWAYS climbing. conquerTarget AND income both ride eco(g), so
  // the steps cancel in time-to-conquer — pacing is provably unchanged.
  // HYBRID DIFFICULTY: ONE global currency, but each planet's NUMBER-MAGNITUDE scales by difficulty.
  // Inside a solar system difficulty creeps up gently (WITHIN_STEP); crossing into a NEW system it
  // JUMPS (SYS_JUMP) and dots get genuinely tankier. The steamroll/wall FEEL now comes from the
  // designed conquer-time curve (SYS_ACTIVE_HOURS: each system eases ~24h→12h, then the next system's
  // first planet spikes back to ~24h) — three power-fantasy arcs, one per solar system.
  const SYS_JUMP = 6.0, WITHIN_STEP = 1.5;
  const diff = g => { g = Math.max(1, Math.min(g, TOTAL_PLANETS)); let v = 1; for (let k = 2; k <= g; k++) v *= (PLANET_LOCAL[planetIdx(k)] === 0 ? SYS_JUMP : WITHIN_STEP); return v; };
  const eco = g => CUR_BASE * diff(g);   // planet number-magnitude (single global currency; costs & drops BOTH ride this so it cancels — progression now is class unlocks, deeper trees & the idle empire)
  const startMul = g => 160 * pk().start; // run-start purse (× eco(1); only fresh() uses it) — covers the first tree node + a couple of Spawn levels so minute-0 isn't a 5-minute stare. ~3 designed-seconds of income: invisible at any later scale. × the Head Start ascension line (pk() is 1 before first recompute)
  // ONE global currency now — no per-planet money, no exchange (v16.5: the exchange code itself is gone too).
  // ONE currency everywhere (v17.2, owner call — reverting v17.1's per-planet tender): the ECONOMY itself
  // now re-baselines per planet (Value/Spawn effective levels), so the money stays a single uniform Credit.
  const curName = g => "Credits";
  const curSym  = g => "✦";
  // CONQUER-TIME CURVE (the ASCENSION WALL). Active hours per planet grow GEOMETRICALLY:
  // ~24 min on planet 1, ×1.65 every planet after (v16.4: softened from ×2 — a ×2 wall forces
  // ×2^17 income multipliers by P18 and ×millions once MORE SOLAR SYSTEMS land; ×1.65 keeps every
  // number humble and leaves headroom for future systems). At ×1 income the wall lands on planet
  // 4–6 inside the first session; every Ascension multiplies INCOME (never the target), so each run
  // melts the old territory and stalls further out — planet 18 is the summit of ~7 ascensions
  // (~55 active hours). Constants are SIM-LOCKED by tools/ascension-sim.js (1296-config sweep with
  // the wall IN the grid, 7 pacing gates, ladder gate, 40/40 noise robustness) — run it before touching.
  const ASC_W0 = 0.4, ASC_R = 1.65;
  const conquerHours = g => ASC_W0 * Math.pow(ASC_R, Math.max(0, (g | 0) - 1));
  // The target is anchored to your real INCOME so the active TIME actually lands on the curve above. Real
  // active brushing income does NOT just track eco·Conquest — each planet you also unlock more classes and
  // afford deeper trees, so measured income compounds an EXTRA ~BUILD× per planet on top. We model that with
  // a geometric build-power term; without it the target can't keep pace and late planets balloon to days.
  // A small live-empire term is added so a fat idle empire can't trivialise the conquest. Idle income is a
  // fraction of active, so idle takes longer; the empire "carries" you toward the next world over time.
  const ACTIVE_REF = 727;    // measured active $/s on planet 1 per (eco-unit × Conquest) — anchors the curve level so a fully-active player lands on SYS_ACTIVE_HOURS (calibrated to the ~8.6× active-vs-idle gap, see sims)
  // BUILD = 1.0: real measured income (full playthrough/active sims) is gated by the on-screen SPAWN CAP, so
  // extra DPS from class unlocks + deeper trees does NOT compound income across planets — income tracks
  // eco·Conquest, which already rides eco(g)·conquest in the target and cancels. A BUILD>1 here inflated the
  // target ~×2.15/planet with no matching income, which is what made late conquer-times balloon to years.
  const BUILD = 1.24;        // ONE ARMY: the persistent fleet's income compounds beyond eco every planet (accumulated trees + global Value/Spawn levels never reset) — targets ride it so conquer TIMES stay on the designed 0.4·1.65^(g−1) curve. Re-measured for v18.0's fixed-curve economy by tools/onearmy-sim.js: at 1.13 the army ran ×0.42-0.53 of designed and the campaign collapsed to 4-5 ascensions (ladder wants 6-16, see crosscheck-ladder); 1.19 puts wall-zone medians back at ~×0.6 and the prestige cadence on contract
  const EMPIRE_W = 0.8;      // how strongly the live idle empire inflates the target (keeps idle from trivialising a conquest)
  const buildPow = g => Math.pow(BUILD, Math.max(0, (g | 0) - 1));
  const baseTarget = g => conquerHours(g) * 3600 * ACTIVE_REF * buildPow(g) * eco(g) * (S.conquest || 1);   // income-model part (no empire) — also drives idle bgRate, so the empire never feeds back on itself
  const conquerTarget = g => Math.ceil(baseTarget(g));   // P4: the target is now the pure income-model only. The idle empire no longer INFLATES the target; instead its bar-fill is CAPPED at IDLE_FRAC of active (see the empire feed in the loop), which stops idle trivialising a conquest without the old feedback term. (EMPIRE_W retained for reference / easy revert.)
  // CONQUEST MULTIPLIER — REMOVED, and it stays removed (v14.6 restored it on a misread; the owner
  // clarified in v14.7 that progression-scaling belongs to the BOSS DROP, not to dots in general —
  // see spawnBoss, where the bounty is floored at a slice of your LIVE income). CONQ_STEP = 1.0 keeps
  // S.conquest at 1 forever, so derived.incomeMul / capacity / conquerTarget are all unaffected.
  // Conquering still UNLOCKS travel and grows the idle empire (EMPIRE_RAMP) — that's the progression.
  // (Set back to 1.8 to restore the multiplier — the plumbing below is kept live.)
  const CONQ_STEP = 1.0;
  const BG_EFF = 0.4;                                                // (legacy) live-rate fraction — superseded by the target-based idle below
  // IDLE EMPIRE — a conquered planet keeps earning for you while you're away on another world. Its
  // idle rate is a fraction of ITS OWN conquest cost (so it auto-scales with the difficulty curve and the
  // whole difficulty curve), and the entire empire's idle output RAMPS UP the more planets you hold.
  // So early planets are an active grind, but by lategame your empire can largely IDLE you to the
  // next conquest — you don't have to hand-manage all 18 worlds.
  const AWAY_CAP_H = Infinity;  // NO ceiling on credited away time (owner call) — gone a week, earn a week. The clamp's lower bound still guards backwards clock jumps, and the real bounds live elsewhere: cash is capacity-clamped, the conquer bar caps at its target, auto-buy pays +50%.
  // v18.43 (owner: "cut the idle income of a conquered planet"): a world you have taken pays NOTHING for
  // simply being owned. bgRate is the single source of every tribute path — empireIdleRate (worlds you
  // have left), the on-site trickle once spoils run dry, the away integral, the star-map readout — so
  // setting the payback to Infinity zeroes all of them by construction, in the game AND in
  // tools/empire-sim.js, which builds its own model from this same exported constant.
  // Measured before shipping (tools/empire-sim.js, total days to finish): a 100%-active run pays ~15%
  // for this, 35%-active ~34%, and pure idle goes from "eventually" to "never" — the tribute was almost
  // entirely a subsidy for not playing. crosscheck-ladder and onearmy-sim never modelled it, so the
  // prestige ladder and the active-pacing contract are untouched.
  const IDLE_PAYBACK_H = Infinity;
  const EMPIRE_RAMP = 0.30;     // every planet you hold boosts ALL your planets' idle output by +30% (empire snowball)
  // P4 fix — how fast the idle empire can fill the CONQUER BAR of the planet you're on, as a fraction of the
  // designed ACTIVE income rate. Capping it here is what stops idle from out-pacing active play late game: the
  // empire still fully funds your TREASURY (your cash), but it can only push the conquer bar at ≤ IDLE_FRAC of
  // active speed — so pure-idle conquest takes ~1/IDLE_FRAC × the designed active hours (a real help, never a
  // replacement for playing). Active play stacks ON TOP, so playing is always clearly faster.
  // v18.22 (owner call): "a planet shouldn't be beatable passively, but the contribution to conquest
  // should count 20% of active". So idle is a real, visible contributor — never the fast route:
  // passive alone needs ~1/IDLE_FRAC = 5× the designed active hours (P10 ≈ 9 days, P18 far beyond),
  // and active play stacks ON TOP, so playing is always ~5× quicker and the wall still arrives on the
  // ladder's schedule. (v18.21 had this at 0.00 — idle contributed nothing, which over-corrected.)
  const IDLE_FRAC = 0.20;
  // the DESIGNED active income rate for planet g — target ÷ designed hours, exactly as conquerTarget
  // builds it (ACTIVE_REF × BUILD^(g−1) × eco × Conquest). The idle allowance is a fraction of THIS,
  // so "20% of active" means the same thing on P1 and P18. (The live cap used to omit buildPow, which
  // silently tightened the allowance ~41× by the last planet — harmless at 0.00, wrong at 0.20.)
  const designedActiveRate = g => ACTIVE_REF * buildPow(g) * eco(g) * (S.conquest || 1);
  // v18.21 OFFLINE CONQUEST GATE (owner: "I passively beat a lot of the planets"). The LIVE loop has
  // always capped idle bar-fill at IDLE_FRAC of the designed active rate — but BOTH offline paths
  // credited their entire haul straight into the bar, on the fiction that your army kept fighting
  // while the tab was shut. With no away-cap (owner call: "gone a week, earn a week") that made
  // closing the game the fastest way to conquer: a night away banked a night of full active income
  // INTO the conquest. Offline now obeys the same rule as live idle — cash still banks in FULL, and
  // the conquer BAR advances at the same 20% allowance the empire gets while you watch.
  const offlineBarGain = (total, secs) => Math.max(0, Math.min(+total || 0, IDLE_FRAC * designedActiveRate(S.galaxy) * Math.max(0, +secs || 0)));
  const conqueredCount = () => { let c = 0; if (S.vault) for (const k in S.vault) if (S.vault[k] && S.vault[k].conquered) c++; return c; };
  // v18.9 SETTLEMENT INCOME (owner catch: "after conquering I can't farm but still need the launch!"):
  // settled worlds spawn nothing (v18.6), so the planet you JUST conquered must pay you another way —
  // it's YOUR world now, and while you're parked on it its settlement works under your fleet's
  // supervision. v18.14 VICTORY SPOILS (owner catch #2: "the new planet needs to drop serious money —
  // more than the previous planet"): the flat ×20 on-site tribute quietly resurrected farm-backwards
  // through the settlement door — measured against the design curve, parking on your settled previous
  // world OUT-EARNED frontier play from P6 on (P10 frontier paid 11% of parking). The ×20 is now a
  // finite SPOILS pool: each conquest banks 30% of the planet's value as victory spoils, paid out at
  // ×20 while you're parked (launch 15% ≈ 12 min, mine 10% ≈ 8 min — the v18.9 flat-broke UX is
  // intact, both fit inside the pool with room over). Once the spoils run dry the world pays the SAME
  // ramped empire tribute it would pay from anywhere — parking is income-neutral by construction, so
  // the frontier's active income always wins, at every depth, with any economy.
  const SETTLE_ON_SITE = 20;         // spoils-window on-site multiplier (kept for the save-migration read and the copy)
  // v18.43: the ⚑ spoils pot is the ONE-TIME payout for taking the world, not rent for holding it, so it
  // survives the tribute cut with its own rate. Priced at exactly what it used to be — the old 26h
  // payback paid at ×20 — so the pot still drains in ~23 minutes of parking and still covers the launch.
  const SPOILS_PAYOUT_H = 26 / SETTLE_ON_SITE;
  const spoilsRate = g => baseTarget(g) / (SPOILS_PAYOUT_H * 3600) * pk().empire;
  const SETTLE_SPOILS_FRAC = 0.30;   // spoils pool = 30% of the planet's conquer target
  const settleSpoils = g => { const v = S.vault && S.vault[g]; if (!v || !v.conquered) return 0;
    if (v.spoils == null) v.spoils = Math.round(SETTLE_SPOILS_FRAC * conquerTarget(g));   // pre-v18.14 settled worlds get a fresh pool on first read (they had ×20 forever — never a nerf into stranding)
    return Math.max(0, +v.spoils || 0); };
  const settleIncomeRate = () => { const v = S.vault && S.vault[S.galaxy]; if (!(v && v.conquered)) return 0;
    return settleSpoils(S.galaxy) > 0 ? spoilsRate(S.galaxy) : 0; };   // v18.43: spoils while they last, then the world is done paying — parked or not
  // parked-on-own-world tribute over a whole ABSENCE — the spoils pool drains mid-interval, so the
  // offline credit is a two-segment integral (×20 until the pool dries, ramped ×1 after), never rate×e
  function settleOffline(e) {
    const v = S.vault && S.vault[S.galaxy]; if (!(v && v.conquered) || !(e > 0)) return 0;
    const hi = spoilsRate(S.galaxy); if (!(hi > 0)) return 0;
    const pool = settleSpoils(S.galaxy), paid = Math.min(pool, hi * e);   // v18.43: one segment now — the pot drains, and after it there is nothing to integrate
    v.spoils = Math.max(0, pool - paid);
    return paid;
  }
  // v18.43: worlds you have left pay nothing. Kept as a function (every call site reads it, and the
  // metrics/HUD lines fold away cleanly at zero) rather than deleted, so there is exactly one place to
  // look if the empire is ever given a different kind of output.
  const empireIdleRate = () => 0;
  // (v16.5: the retired FX/exchange market — fxRate, IMPORT_CAP, doExchange, the whole floating-market
  // sim and its UI — is fully deleted. One global currency; planet vaults keep only build + cash snapshots.)
  // per-class buy-cost factors (× eco(active) × 1.5^count) — keeps class differentiation but planet-local
  const UNIT_FACTOR = { turret: 10, mortar: 26, plasma: 70, laser: 150, railgun: 360, nova: 820, drone: 10, swarm: 26, collector: 70, magnet: 150, tractor: 320, singularity: 650, wormhole: 1150 };
  // Income now comes from THROUGHPUT — killing more, tougher, more-rewarding dots —
  // not a collector yield multiplier. DROP_BASE is the cash a plain dot drops;
  // TOUGH_POW makes reward scale SUPER-linearly with a dot's toughness, so tanky
  // dots & armored elites pay disproportionately more (rewarding turret damage to
  // kill them and stronger drones to haul the bigger loot).
  const DROP_BASE = CUR_BASE;   // a plain dot drops one eco-unit of the planet's currency (must match eco's base)
  const TOUGH_POW = 1.45;
  const ORB_LIFE = 12;                                  // orbs vanish if collectors can't keep up (some loss is intended tension; raised 9→12 so it's not chronic)
  // Loot freshness: an orb pays full value when grabbed instantly and decays to
  // FRESH_MIN of its value by the time it expires. So faster/more collectors bank
  // more cash — collector Speed/Reach/Ingest/count are a real income lever again.
  const FRESH_MIN = 0.35;
  const orbFresh = o => FRESH_MIN + (1 - FRESH_MIN) * clamp(1 - o.t / ORB_LIFE, 0, 1);

  /* ----------------------------- state --------------------------- */
  let S, derived = {}, META, state = "home";
  function fresh() {
    const lv = {}; UPS.forEach(u => lv[u.id] = 0);
    const classNodes = {}; ALL_TYPES.forEach(t => classNodes[t] = {});
    return { v18: 1, ecoS: 1, cash: Math.floor(eco(1) * startMul(1)), galaxy: 1, lv, classNodes, units: [newUnit("turret")], collectors: [{ type: "drone" }], totalRun: 0, peakGalaxy: 1, runSec: 0, vault: {}, travel: null, conquest: 1, victory: false, auto: defaultAuto() };
    // ^ v18:1 MUST ride fresh(): ascend() rebuilds S from fresh(), and a post-ascension save without
    // the flag would re-run the v17 fold on its NEXT load — stripping real levels off the global ladder
    // (triple-check finding: a lv-70 Value at P5 reloaded as lv 30). fresh saves skip the migration.
  }
  // trim a unit/collector list down to each type's max (enforces caps on load)
  function capList(list) { const c = {}, out = []; for (const u of list || []) { const t = u && typeof u === "object" ? u.type : null; if (!t || !TY(t)) continue; const m = TY(t).max; c[t] = (c[t] || 0) + 1; if (c[t] <= m) out.push(u); } return out; }   // null/junk entries skipped, not dereferenced — one null in a hand-edited save used to kill the whole boot (fuzzer finding)   // DROP unknown types (a renamed/removed class in an old save would otherwise crash on the first tick via DEF_TYPES[t].x)
  function freshStats() {
    const kills = {}; DEF_ORDER.forEach(t => kills[t] = 0); kills.draw = 0; kills.blackhole = 0;
    const collected = {}; COL_ORDER.forEach(t => collected[t] = 0);
    return { playSec: 0, dotsPopped: 0, specials: 0, armored: 0, kills, collected, abilities: { frenzy: 0, dotrain: 0, blackhole: 0 }, travels: 0, lost: 0, lostCash: 0 };
  }
  function freshOpts() { return { sound: true, haptics: true, shake: true, flash: true, fx: "full", notation: "short", perf: false }; }   // player settings (persist in META). perf = optional FPS-saver (simplifies dots on busy fields)
  function freshMeta() { return { totalEver: 0, stats: freshStats(), opts: freshOpts(), asc: { cores: 0, lv: {}, runs: 0, best: 0, lifetime: 0, v: 3 }, tutorialDone: false }; }   // the ASCENSION layer lives in META — the only thing that survives an ascension. asc.v = shop schema (3 = the v16.4 flat-curve shop; older saves get every past spend refunded at its era's prices on load)
  const opt = k => (META && META.opts ? META.opts[k] : freshOpts()[k]);
  function vibe(ms) { if (opt("haptics") && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }
  const stat = () => META.stats;

  let dots = [], orbs = [], beams = [], shells = [], drones = [], spawnAcc = 0, cps = 0, earnAcc = 0, earnT = 0, curEarned = 0, bossAcc = 0;
  // v18.15 SABER COMBO (owner: "killing dots with your finger does a multiplier like Cookie Clicker —
  // the quicker you kill the bigger, up to ×5"): finger kills CHAIN. Each draw kill pays the current
  // multiplier, then heats it +0.35 (cap ×5 ≈ a 12-kill slaughter); a 1.6s grace window per kill,
  // then it drains fast (5→1 in 2.5s). Purely active by construction — no unit, drone or idle path
  // touches it — and bounded: it multiplies FINGER-kill loot only (bosses keep their wheel economy).
  // v18.16: heat is BUDGETED — at most +0.55 heat per second no matter how many dots one swipe
  // catches (a cluster-swipe used to slam ×5 instantly). Maxing the chain now takes ~7-8s of
  // SUSTAINED slaughter: each kill adds up to +0.16, drawing from the recovering 0.55/s budget.
  let comboMul = 1, comboT = 0, comboFxT = 0, comboGain1s = 0, comboPopT = 0;
  // v18.18 ⛏ MINE WARDEN (owner: "after conquering there should be a decently strong boss with a
  // time limit — beat it and you get the money to build a mine; lose and the dots come back with a
  // SUMMON BOSS button — rather than sitting AFK at 5k/s saving up"): a settled, mine-less world can
  // call out the warden guarding its ◈ seam. While the duel runs the world UN-SETTLES — fauna
  // returns, the army wakes, abilities work — and the boss's 60s escape clock is the time limit.
  // Kill it and its hoard pays EXACTLY the mine price. Lose and the settlement panel offers the
  // summon again. Not persisted: reload mid-fight = fight called off, summon again from the panel.
  let wardenOn = false, wardenClear = false;
  // v18.40: the bar filling makes a world TAKEABLE, not taken. It stays full (and you keep farming and
  // banking on it) until you call the keeper out and win.
  const barFull = () => !planetMeta(S.galaxy).conquered && curEarned >= conquerTarget(S.galaxy);
  // v18.34: the conquest report opens one beat AFTER the kill, so the explosion is allowed to be the
  // explosion before any UI arrives. Held in loop state (not a setTimeout) so ascending, travelling or
  // a reload during the beat simply drops it instead of firing a card onto a world you already left.
  let conqCardT = 0, conqCardG = 0, conqCardCores = 0, conqCardSpoils = 0, conqCardVic = false, conqCineStage = 0;
  // v18.36 MINE CONSTRUCTION: -1 = nothing building (the rig draws complete), otherwise seconds into the
  // build. Live-only, like the duel — a reload lands on the finished mine rather than replaying the show.
  const MINE_BUILD_DUR = 10;   // v18.37 (owner: "make it last like 10 seconds") — every stage window below is a FRACTION of this, so the whole sequence stretches in proportion and no step is starved
  let mineBuildT = -1, mineBuildStage = 0, minePendingBuild = false;   // v18.40: a mine won WITH the world waits for the report card to be read before it starts going up
  const mineBuildP = () => mineBuildT < 0 ? 1 : clamp(mineBuildT / MINE_BUILD_DUR, 0, 1);
  let drawing = false, lastDraw = null, trail = [], selUnit = -1, selType = "turret";
  // ---- juice: particles, screen shake, flash, floating cash ----
  let parts = [], shake = 0, flash = 0, fxEarn = 0, fxEarnT = 0, fxEarnX = 0, fxEarnY = 0, veilT = 0, landT = 0;
  const VEIL_FADE = 0.6;   // seconds for the zoom-into-base white-wipe to fade back out after landing
  const LAND_DUR = 0.85;   // camera pull-back "you have arrived" settle after the warp lands
  const MAXP = 440;
  function burst(x, y, n, spd, sz) { const fx = opt("fx"); if (fx === "off") return; if (fx === "low") n = Math.max(1, Math.ceil(n * 0.4)); if (parts.length > MAXP) return; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = spd * (0.35 + Math.random() * 0.9);
    if (Math.random() < 0.4) parts.push({ t: 4, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.35, max: 0.65, ang: a, len: sz * 2 + Math.random() * sz * 2, spin: (Math.random() - 0.5) * 12 });  // shard
    else parts.push({ t: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.32 + Math.random() * 0.36, max: 0.7, r: sz * (0.5 + Math.random()) }); } }
  function ring(x, y, r0, r1, life) { if (opt("fx") === "off" || parts.length > MAXP) return; parts.push({ t: 1, x, y, r: r0, r1, life, max: life }); }
  function floatTxt(x, y, txt) { if (parts.length > MAXP) return; parts.push({ t: 2, x, y, vy: -40, life: 0.95, max: 0.95, txt }); }
  // v18.47 LOOT ROT IS VISIBLE NOW (owner call). Money that times out on the floor used to vanish in
  // total silence — no float, no number, and only a 6-second "!" on the drone tab (hintLeakUntil) that
  // reads as a nudge rather than as "most of your income is evaporating". Measured: a maxed gun build
  // with a neglected drone tree banks 19% of what it kills and caps at under half the intended income,
  // and NOTHING on screen said so. Every rot now floats a red -¤ where it died, and the two rolling
  // accumulators below drive a persistent HUD readout of the actual share being lost.
  let leakLost = 0, leakGot = 0;                     // exponentially-decayed ¤ (see decayLeak) — a ratio, not a total
  function orbRot(o) {
    META.stats.lost++; META.stats.lostCash += o.value;
    leakLost += o.value || 0;
    floatTxt(o.x, o.y, "-" + fmt(o.value || 0));
  }
  const leakPct = () => { const t = leakLost + leakGot; return t > 0 ? leakLost / t : 0; };
  const decayLeak = dt => { const k = Math.exp(-dt / 8);  leakLost *= k; leakGot *= k; };   // ~8s memory: reacts fast, no flicker
  function spark(x, y) { if (opt("fx") === "off" || parts.length > MAXP) return; parts.push({ t: 3, x, y, life: 0.22, max: 0.22 }); }
  function shakeAdd(a) { shake = Math.min(4.5, shake + a); }   // capped low so dense late-game kills can't pin the screen into a constant rattle
  function flashAdd(a) { flash = Math.min(0.9, flash + a); }
  function stepFx(dt) {
    for (const p of parts) { p.life -= dt; if (p.t === 0 || p.t === 4) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; if (p.t === 4) p.ang += p.spin * dt; } else if (p.t === 2) { p.y += p.vy * dt; p.vy *= 0.9; } }
    if (parts.length) parts = parts.filter(p => p.life > 0);
    shake *= Math.exp(-dt * 13); if (shake < 0.2) shake = 0;
    flash = Math.max(0, flash - dt * 3.2);
  }
  function drawParts() {
    for (const p of parts) { const k = clamp(p.life / p.max, 0, 1);
      if (p.t === 0) { ctx.globalAlpha = k; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k + 0.5, 0, TAU); ctx.fill(); }
      else if (p.t === 1) { const rr = p.r + (p.r1 - p.r) * (1 - k); ctx.globalAlpha = k * 0.55; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, rr), 0, TAU); ctx.stroke(); }
      else if (p.t === 2) { ctx.globalAlpha = k; ctx.fillStyle = "#fff"; ctx.font = "bold 13px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(p.txt, p.x, p.y); }
      else if (p.t === 4) { ctx.globalAlpha = k; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; const dx = Math.cos(p.ang) * p.len * k * 0.5, dy = Math.sin(p.ang) * p.len * k * 0.5; ctx.beginPath(); ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke(); }  // shard
      else { ctx.globalAlpha = k; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * (1 - k) + 2, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
  }
  let abil = { frenzy: 0, dotrain: 0, blackhole: 0 }, frenzyT = 0, blackholeT = 0, rainT = 0, rainRate = 0, rainAcc = 0;   // rain*: the v18.8 Dot Rain downpour (timer, dots/sec, fractional carry)
  let autoAcc = 0;   // fractional auto-buy budget carried between frames
  const ABIL_CD = { frenzy: 45, dotrain: 40, blackhole: 60 };
  let activeTab = "def", listRows = {}, tabBtns = {};
  const BUY_AMTS = [1, 10, 100, "max"];               // bulk-buy multipliers — cycled by the BUY ×N button (v16.5: available to EVERYONE, not just test mode — each iteration re-checks cost/caps so it's exploit-free)
  let buyIdx = 0;                                      // index into BUY_AMTS
  const buyN = () => BUY_AMTS[buyIdx] === "max" ? 100000 : BUY_AMTS[buyIdx];   // "max" = buy until unaffordable/maxed

  /* ---- ASCENSION (v16.0, ground-up) — the prestige loop. Gems are GONE. ----
     Push the cluster until the next conquer bar is a WALL (hours), then ASCEND: the whole run resets
     (planets, empire, units, trees, cash — Auto-Buy plans survive) and every conquered planet banks
     ◈ CORES: coreVal(g) = ceil(CORE_A·CORE_B^(g-1)) — a few from planet 1, exponentially more deeper —
     plus 50% partial credit on the bar you were stuck on. Cores buy ONE permanent line: the Singularity
     Engine, +25% ALL income per level (v16.4). It is the whoosh: it rides derived.incomeMul, and conquer
     TARGETS never do, so each ascension melts the early planets and moves the wall out. The Engine
     deliberately does NOT ride valueMul — dot HP scales with valueMul^1.3 (menace), and hundreds-x
     through that channel would out-tank your guns. All curves are SIM-LOCKED by tools/ascension-sim.js. */
  const CORE_A = 4, CORE_B = 1.3;   // v16.4: "a few" cores from planet 1 (base ×4) on a FAR flatter curve — P18 pays ~346 not 8,273, and planet 30 will still be sane when more systems land. CB tracks the ×1.65 wall (CB/R ≈ 0.79: the marginal deeper planet still pays most of its time cost — churn stays dead)
  const coreVal = g => Math.ceil(CORE_A * Math.pow(CORE_B, Math.max(0, (g | 0) - 1)));
  // ── ◈ CORE MINES (v18.3, owner call): conquering a world FOUNDS A MINE that digs prestige cores on
  // the WALL CLOCK — P1 pays 1◈ every 2 days, each deeper planet ×1.3 faster (P5 ≈ 1.4◈/day, P10 ≈
  // 5◈/day). Mines run while you play AND while you're away (no away-cap: gone a week, the P1 mine
  // pays its 3-4). They stop when Ascension resets the map — re-conquering re-opens them — so the
  // dig is a property of THIS RUN's empire, a real second stream alongside ascension banking but
  // never a replacement (crosscheck-ladder L7 bands campaign mining into 12-40% of banked cores;
  // measured ~25-33% since v18.25, and L8 still proves ascending out-earns parking ×2.8+).
  // v18.25 (owner: "make mines more productive"): base rate ×3.5 — 1◈/week → 1◈ every TWO DAYS on
  // P1, so a mine repays its planet's conquest bounty in ~8 days instead of ~28 and the 10%-of-target
  // build is a real strategic call rather than a garnish. Campaign mining moves from ~7-9% of the
  // cores you bank to ~25-30% (crosscheck L7, ceiling raised to 40%) — a meaningful minority that
  // rewards holding worlds and coming back after time away, while CONQUEST still carries the main
  // line so active play stays the fast route. K stays at 1.3: the mine curve must never outgrow the
  // bounty curve (K ≤ CORE_B), or deep parking out-digs ascending (L7 measured 28-37% at K=1.45),
  // and L8 still proves the ascend cycle beats parked mining at every wall of every run.
  const MINE_BASE_D = 1 / 2, MINE_K = 1.3;
  const mineRate = g => MINE_BASE_D * Math.pow(MINE_K, Math.max(0, (g | 0) - 1));   // ◈ per real DAY
  // v18.5 (owner call: "a cost, visual and obvious, to make a planet an ascension farm"): a conquest
  // only SECURES the mine site — turning a world into a ◈-digging ascension farm is a separate, paid,
  // visible act: ⛏ BUILD costs 10% of that planet's conquer target (you just earned 100% conquering
  // it; launch is 15% — building the farm is a real allocation choice, not a freebie), and a built
  // mine draws a working headframe on the planet's rim plus its rate on the star-map card.
  const mineCost = g => Math.round(0.10 * conquerTarget(g) * TEST_MUL());
  const mineBuilt = g => !!(S && S.vault && S.vault[g] && S.vault[g].mine);
  // v18.40: `quiet` is the conquest path — the seam is founded as part of taking the world, so the site
  // announces itself later (after the report card, via minePendingBuild) instead of shouting under the film.
  function buildMine(g, quiet) {
    const v = S.vault && S.vault[g];
    if (!v || !v.conquered || v.mine) return false;
    const c = mineCost(g); if (!(S.cash >= c)) return false;   // fail-CLOSED on NaN
    S.cash -= c; v.mine = 1; v.mineBuf = +v.mineBuf || 0;   // v18.18: this mine's OWN hopper starts here
    // v18.36: the mine is FUNCTIONALLY built on this frame (it is already digging), but the site now
    // assembles itself on screen instead of appearing whole — claim, fence, shaft, gear, works, rails,
    // belt, first ore. Only on the world you are standing on.
    if (quiet) { mineBuildT = -1; mineBuildStage = 0; }
    else if (g === S.galaxy) { mineBuildT = 0; mineBuildStage = 0;
      floatTxt(W / 2, H / 2 - 20, "⛏ BREAKING GROUND — " + galName(g)); ring(W / 2, H / 2, 6, 90, 0.5); }
    else { mineBuildT = -1; floatTxt(W / 2, H / 2 - 20, "⛏ ◈ CORE MINE BUILT — " + galName(g)); floatTxt(W / 2, H / 2 + 6, "digging " + fmtMineRate(mineRate(g))); }
    if (!quiet) { Audio_buy(); flashAdd(0.25); vibe([30, 20, 60]); }   // rim rebuilds so the headframe appears immediately
    recompute(); syncHUD(); save(); return true;
  }
  // v18.41: ONE predicate for whether this world's rig is on screen — the renderer and the headless
  // battery read the same line, so a pending mine can never quietly start being drawn again.
  const mineRigOn = () => mineBuilt(S.galaxy) && !wardenOn && !minePendingBuild;
  const mineRateTotal = () => { let r = 0; if (S && S.vault) for (const k in S.vault) if (S.vault[k] && S.vault[k].conquered && S.vault[k].mine) r += mineRate(+k); return r; };
  const fmtMineRate = r => r >= 1 ? (r >= 10 ? Math.round(r) : r.toFixed(1)) + "◈/day" : "1◈ / " + (1 / r).toFixed(1) + "d";
  // v18.17 ◈ CORE POPUP (owner: "there needs to be a pop up every time you get actual prestige
  // currency so the player knows when and how they're rewarded"): every ◈ that LANDS in the bank
  // announces itself — how many, from which source, and the new balance — via one non-blocking card
  // that slides in under the top bar and auto-hides. One choke point, so no source can pay silently.
  // (Offline hauls keep their own line in the Welcome-Back breakdown; save-migration refunds stay quiet.)
  let corePopT = null;
  // ══ ◈ CORE AWARD — the full animation (v18.45) ════════════════════════════
  // Owner: "there needs to be an animation for getting the cores when you conquer a planet, and every
  // time you get a core a full animation." ◈ used to arrive as a small card sliding in under the top
  // bar — the same weight as a shop receipt for the rarest thing in the game. Every ◈ event now plays a
  // real sequence: the core FORGES (a ring collapsing into the seam), STRIKES (flash, shake), DRAWS
  // itself edge by edge, MULTIPLIES into one diamond per core, then FLIES to the ascension counter and
  // lands — at which point the old card slides in as the receipt rather than as the whole event.
  //
  // Strictly one at a time, and never over anything else: the queue waits for the conquest cinematic,
  // for any open card, and the mine build waits for IT. Nothing in this game plays over anything else.
  const CORE_FX_DUR = 3.4;
  let coreFx = null, coreFxQ = [];
  function queueCoreFx(n, why, pending) { if (n > 0) coreFxQ.push({ n: Math.floor(n), why: why || "", pending: !!pending }); }
  // ONE choke point for banking ◈: nothing may add cores without going through here, so no source can
  // ever pay silently again (the v18.17 rule, now with the animation attached to it).
  function awardCores(n, why, quiet) {
    n = Math.floor(n); if (!(n > 0) || !META || !META.asc) return 0;
    META.asc.cores = (META.asc.cores | 0) + n;
    META.asc.lifetime = (META.asc.lifetime | 0) + n;
    if (!quiet) queueCoreFx(n, why);
    return n;
  }
  function stepCoreFx(dt) {
    if (!coreFx) {
      // never over the film, never over a card, and never under the mine build
      if (!coreFxQ.length || conqCardT > 0 || Cards.busy() || mineBuildT >= 0) return;
      coreFx = { ...coreFxQ.shift(), t: 0, stage: 0 };
      shakeAdd(0.6); Audio_spinup();
      return;
    }
    coreFx.t += dt;
    const e = coreFx.t, n = coreFx.n;
    const CUES = [
      [0.90, () => { flashAdd(0.45); shakeAdd(3.2); vibe([30, 25, 60]); Audio_zap(); ring(W / 2, H / 2, 8, Math.max(W, H) * 0.35, 0.5); }],
      [1.90, () => { Audio_node(); if (n > 1) vibe([15]); }],
      [2.30, () => { Audio_collect(); }],
      [3.05, () => { flashAdd(0.16); Audio_win(); vibe([40, 20, 70]);
        showCorePop(n, coreFx.why, coreFx.pending); }],   // the card is the RECEIPT now, not the event
    ];
    while (coreFx.stage < CUES.length && e >= CUES[coreFx.stage][0]) CUES[coreFx.stage++][1]();
    if (e >= CORE_FX_DUR) coreFx = null;
  }
  // Drawn in SCREEN space over the world. The HUD deliberately stays up: the whole point of the last
  // movement is watching the cores fly into the ◈ counter you are about to spend them from.
  function drawCoreFx(e, n) {
    const cw = SW, ch = SH, cx = cw / 2, cy = VIEW_CY || ch / 2, R = Math.min(cw, ch);
    const seg = (a, b) => { const k = clamp((e - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const raw = (a, b) => clamp((e - a) / (b - a), 0, 1);
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff";

    // ── FORGE: the field dims and a ring collapses into the point the core forms at ──
    { const k = raw(0, 0.9), fade = seg(0, 0.35) * (1 - seg(2.6, 3.4));
      if (fade > 0) { ctx.globalAlpha = 0.5 * fade; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = "#fff"; }
      if (k > 0 && k < 1) {
        ctx.globalAlpha = 0.25 + 0.6 * k; ctx.lineWidth = 1 + 3 * k;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.9 * (1 - k) + 6, 0, TAU); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + k * 2.2, r0 = R * 0.9 * (1 - k) + 6;   // shards drawn in with it
          ctx.globalAlpha = 0.5 * k; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          ctx.lineTo(cx + Math.cos(a) * (r0 * 0.82), cy + Math.sin(a) * (r0 * 0.82)); ctx.stroke(); }
      } }

    // ── the ◈ itself: drawn edge by edge, then filled, then multiplied and flown ──
    const shown = Math.min(n, 10), fly = seg(2.3, 3.1), spread = seg(1.6, 2.3);
    const tx = cw - 54, ty = Math.max(46, ch * 0.055);   // the ascension pill, top-right
    // The row has to READ as n cores, so the step is set from the mark width and then clamped to the
    // screen — at the old R*0.085 four diamonds overlapped into one smear. The hero shrinks into the row
    // rather than staying oversized, and the whole row stays centred on the point it was forged at.
    const step = shown > 1 ? Math.min(R * 0.17, (cw * 0.74) / (shown - 1)) : 0;
    const szRow = Math.min(R * 0.10, step * 0.60), szSolo = R * 0.13;
    for (let i = 0; i < shown; i++) {
      const born = 1.6 + (i / Math.max(1, shown)) * 0.45;                      // they split off one after another
      const alive = i === 0 ? raw(0.85, 1.0) : raw(born, born + 0.20);
      if (alive <= 0) continue;
      const fan = shown > 1 ? (i - (shown - 1) / 2) * step : 0;
      const hx = cx + fan * spread, hy = cy - R * 0.02 * spread;
      const px = hx + (tx - hx) * fly, py = hy + (ty - hy) * fly;
      const sz = (szSolo + (szRow - szSolo) * spread) * (0.35 + 0.65 * alive) * (1 - 0.72 * fly);
      const rot = (1 - seg(0.9, 1.9)) * 0.9;
      ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
      const dk = i === 0 ? raw(0.9, 1.7) : 1;                                   // the first one STROKES itself on
      ctx.globalAlpha = (0.9 * alive) * (1 - fly * 0.15); ctx.lineWidth = 2.4;
      const pts = [[0, -sz], [sz * 0.72, 0], [0, sz], [-sz * 0.72, 0]];
      for (let k2 = 0; k2 < 4; k2++) { const on = clamp(dk * 4 - k2, 0, 1); if (on <= 0) break;
        const p0 = pts[k2], p1 = pts[(k2 + 1) % 4];
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p0[0] + (p1[0] - p0[0]) * on, p0[1] + (p1[1] - p0[1]) * on); ctx.stroke(); }
      if (dk >= 1) { ctx.globalAlpha = 0.20 * alive * (1 - fly * 0.5); ctx.beginPath();
        pts.forEach((p, k3) => k3 ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.5 * alive * (1 - fly); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -sz * 0.55); ctx.lineTo(0, sz * 0.55); ctx.stroke(); }   // the facet
      ctx.restore();
    }
    // more cores than diamonds worth drawing → the count rides alongside
    if (n > shown) { const a2 = seg(1.9, 2.2) * (1 - fly * 0.6);
      ctx.globalAlpha = a2; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.font = "700 " + Math.round(R * 0.055) + "px ui-monospace,monospace";
      ctx.fillText("×" + n, cx, cy + R * 0.16); }

    ctx.globalAlpha = 1; ctx.restore();
  }

  function showCorePop(n, why, pending) {
    const el = $("core-pop"); if (!el || !(n > 0)) return;
    // v18.34: a mine tipping over mid-conquest used to slide this card in on top of whatever modal was
    // open. It waits for the queue to drain instead — the ◈ still announces itself, just not over a card.
    if (Cards.busy()) { Cards.onIdle(() => showCorePop(n, why)); return; }
    $("cp-n").textContent = "◈ +" + fmt(n) + " PRESTIGE CORE" + (n > 1 ? "S" : "");
    $("cp-src").textContent = why;
    $("cp-tot").textContent = pending
      ? "pending: " + fmt(pendingCores()) + " ◈ — banks the moment you ascend"
      : "banked: " + fmt((META.asc && META.asc.cores) | 0) + " ◈ — spend them in Ascension";
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    clearTimeout(corePopT); corePopT = setTimeout(() => el.classList.remove("show"), 4200);
    Audio_node(); vibe([20, 30, 40]); flashAdd(0.1);
  }
  function mineAccrue(sec, quiet) {
    // v18.18 PER-MINE HOPPERS (owner: "make sure all the mines work — all separately producing on
    // their own timeline"): every built mine keeps its OWN fractional hopper (vault[g].mineBuf) and
    // drops whole cores on its OWN schedule — P1 every 7 days, P5 every ~2.5 days, independently.
    // (The old design pooled all rates into one global buffer, so mines shared a single countdown.)
    if (!META || !META.asc || !S || !S.vault || !(sec > 0)) return 0;
    let total = 0;
    for (const k in S.vault) { const v = S.vault[k];
      if (!v || !v.conquered || !v.mine) continue;
      v.mineBuf = (+v.mineBuf || 0) + mineRate(+k) * sec / 86400;
      const whole = Math.floor(v.mineBuf + 1e-9);   // FP guard: an exactly-7-day sum can land at 0.99999999999
      if (whole >= 1) { v.mineBuf = Math.max(0, v.mineBuf - whole); total += whole; }
    }
    if (total < 1) return 0;
    awardCores(total, "dug by your ⛏ ◈ core mines", quiet);   // v18.45: banking and the animation are the same call now
    S.minedRun = (S.minedRun | 0) + total;   // v18.42: mined ◈ bank INSTANTLY, so pendingCores() never sees them — this is the only honest record of what the mines contributed this run, and the split chart reads it
    return total;
  }
  const ASC_ARM_MS = 4000;   // v18.59: how long the ascend button stays armed before it forgets
  let ascArmed = false, ascArmT = 0;
  const ASC_HOP_H = 1.0;   // THE LADDER's hop point, proven by tools/ascension-sim.js --policy: once the CURRENT bar needs more than this many hours at your live income (floor met), ascending and re-running IS the faster route — the UI says so instead of leaving it a spreadsheet fact (1.5h → 1h with the ×1.65 wall)
  // Prestige does ONE thing \u2014 cash (v16.3), and gently (v16.4): +25% ALL income per level on a
  // near-flat cost curve, so every ascension affords a couple of levels and endgame income tops out
  // around \u00d7800 (was \u00d725,000). Cost growth 1.19^lv \u2248 CB per planet-of-reach \u2014 reach never gets
  // cheaper than cores grow, which (with the 3-conquest floor) keeps shallow churn strictly slower.
  const ASC_E = 1.25;
  const multFmt = m => m < 10 ? String(Math.round(m * 10) / 10) : fmt(Math.round(m));   // \u00d71.3, \u00d72.4, \u00d75.1, \u00d711 \u2014 fmt() alone floors small floats to "1"
  const ASC_LINES = [
    { key: "engine", ico: "coin", name: "Singularity Engine", max: 60, c0: 3, cr: 1.19, fx: "+25% ALL income / lv", word: lv => "\u00d7" + multFmt(Math.pow(ASC_E, lv)) + " income" },
  ];
  const ASC_BY = {}; ASC_LINES.forEach(l => ASC_BY[l.key] = l);
  const ascLv = k => (META && META.asc && META.asc.lv && META.asc.lv[k]) | 0;
  const ascCost = (l, lv) => Math.ceil(l.c0 * Math.pow(l.cr, lv));
  const PERK0 = { dmg: 1, rate: 1, value: 1, cost: 1, yield: 1, spawn: 1, empire: 1, income: 1, start: 1, crit: 0, range: 0, luck: 0 };
  const pk = () => derived.perk || PERK0;                                   // current aggregated Ascension bonuses (neutral defaults before first recompute)
  function perkAgg() {   // fold Ascension into one bundle — same interface the old perk shop used, so every consumer is unchanged
    const a = Object.assign({}, PERK0);
    a.income = Math.pow(ASC_E, ascLv("engine"));   // the ONLY prestige effect (v16.3) — every other stat stays neutral
    return a;
  }
  // pending ◈ — the ALWAYS-VISIBLE offer: what ascending right now would bank
  function pendingCores() {
    let p = 0; if (S && S.vault) for (const k in S.vault) if (S.vault[k] && S.vault[k].conquered) p += coreVal(+k);
    if (S && S.vault && !(S.vault[S.galaxy] && S.vault[S.galaxy].conquered)) { const t = conquerTarget(S.galaxy); if (t > 0) p += Math.floor(coreVal(S.galaxy) * Math.min(1, curEarned / t) * 0.5); }
    return p;
  }
  // THE LADDER (v16.2) — the optimal route is 3 worlds on run 1, then a few worlds deeper every
  // ascension (sim-gated: 3→5→7→9→11→…→18). These make the hop point VISIBLE in play:
  const wallEtaH = () => {   // hours left on the CURRENT conquer bar at your live income (Infinity while income is 0)
    const v = S.vault && S.vault[S.galaxy]; if (v && v.conquered) return 0;
    const rem = conquerTarget(S.galaxy) - curEarned;
    return rem <= 0 ? 0 : (cps > 0 ? rem / cps / 3600 : Infinity);
  };
  const wallAhead = () => {   // floor met + you've genuinely worked this bar (≥5%) + it now outprices a hop ⇒ the sim says GO
    if (conqueredCount() < 3) return false;
    const t = conquerTarget(S.galaxy); if (!(t > 0) || curEarned < t * 0.05) return false;
    const e = wallEtaH(); return isFinite(e) && e > ASC_HOP_H;
  };
  function ascPreview() {   // the "come back ×N stronger" promise: banked + pending cores poured greedily into the Engine
    let cores = ((META && META.asc && META.asc.cores) | 0) + pendingCores(), lv = ascLv("engine"), bought = 0;
    const l = ASC_BY.engine;
    while (lv + bought < l.max && ascCost(l, lv + bought) <= cores) { cores -= ascCost(l, lv + bought); bought++; }
    return Math.pow(ASC_E, bought);   // ×1 when nothing new is affordable
  }
  function buyAsc(key) {
    const l = ASC_BY[key]; if (!l || !META || !META.asc) return;
    const lv = ascLv(key); if (lv >= l.max) return;
    const c = ascCost(l, lv); if ((META.asc.cores | 0) < c) return;
    META.asc.cores -= c; (META.asc.lv || (META.asc.lv = {}))[key] = lv + 1;
    Audio_node(); recompute(); syncHUD(); renderAscend(); save();
  }
  function ascend() {
    // v18.44 (owner: "there is still a blocker to ascend, I should be able to do it when I want"): the
    // v16.1 three-planet floor is gone. Ascending is YOUR call at any point — the only requirement left
    // is that there is something to bank, because ascending for +0◈ would just delete a run for nothing.
    // v18.59: the destructive guard is a two-tap arm on the button itself (see renderAscend). The
    // native confirm() that used to sit here painted a browser alert with the domain name across a
    // black-and-white game, and a headless sim calling ascend() had it auto-dismissed and silently
    // did nothing — a trap for every future tool.
    const pend = pendingCores(); if (pend < 1) return;
    META.asc.runs = (META.asc.runs | 0) + 1; META.asc.best = Math.max(META.asc.best | 0, conqueredCount());
    awardCores(pend, "banked by ASCENSION — run " + META.asc.runs + " complete");
    const keepAuto = S.auto;                       // build orders are configuration, not progress — they survive the reset
    S = fresh(); S.auto = keepAuto;
    wardenReset();                                 // v18.21: a duel never survives the reset
    dots.length = 0; orbs.length = 0; beams.length = 0; shells.length = 0;
    for (const k in abil) abil[k] = 0;
    curEarned = 0; earnAcc = 0; earnT = 0; cps = 0; spawnAcc = 0; bossAcc = 0; autoAcc = 0;
    recompute(); syncCollectors(); renderList(); GMap.init(); syncHUD(); save();
    const am = $("ascend"); if (am) am.classList.remove("show");
    floatTxt(W / 2, H / 2 - 40, "\u25c8 ASCENSION " + META.asc.runs);
    floatTxt(W / 2, H / 2 - 16, "+" + pend + " \u25c8 banked \u00b7 the cluster resets \u00b7 you come back harder");
    flashAdd(0.8); shakeAdd(8); vibe([60, 40, 120]); Audio_ascend();
  }

  function recompute() {
    const L = S.lv, m = META;
    derived.perk = perkAgg();                                           // FIRST — valueMul/spawn/luck below read it via pk()
    let conqN = 0; for (const k in (S.vault || {})) if (S.vault[k] && S.vault[k].conquered) conqN++;   // conquered-world count (≤18 — cheap every recompute)
    S.conquest = Math.pow(CONQ_STEP, conqN);           // derived from the count (drift-proof). CONQ_STEP=1.0 → always ×1, INERT — the multiplier is one constant away if ever wanted
    derived.incomeMul = S.conquest * pk().income;      // ← THE WHOOSH (v16.0): the Ascension Engine multiplies every dot/boss/salvage payout, and conquer TARGETS never ride incomeMul — so each ascension melts the early planets
    derived.capacity = ecoCost() * 220 * capFromLv(ecoLv("capacity")) * (derived.incomeMul || 1);   // cash ceiling rides the FRONTIER economy (v17.4 — visiting an old world must not crash the ceiling below your wallet and freeze banking) × the SAME income multiplier as the payouts (engine incl.) so it never lags your income
    derived.valueMul = valueFromLv(ecoLv("value")) * pk().value;          // v18.14: +13% per GLOBAL level at ×1.37 cost (was +10%/×1.30) — CHUNKIER: each buy is a felt jump and the ladder needs ~25% fewer clicks (owner: "always bottlenecked by value and spawn") — long-run cost-per-doubling ~12% cheaper. × Ascension value perk.
    // Spawn Rate: each level wants +2 dots/sec. Past the soft knee the screen can't hold every extra
    // body — instead of wasting the upgrade, the surplus "spills over" into MENACE: every dot spawns
    // tougher & (via TOUGH_POW) worth disproportionately MORE than the skipped spawn would have paid.
    // So Spawn Rate keeps paying off at every level, exactly like Value never caps out.
    const rawSpawn = spawnFromLv(ecoLv("spawnRate")) * pk().spawn;   // v18.14: +1.15/s per level at ×1.39 cost (was +0.9/×1.32) — chunkier buys, fewer clicks, same continuous global ladder
    derived.spawnPerSec = rawSpawn;                                           // FULL benefit — the field cap limits count, so if you kill fast you just get flooded with more dots
    if (derived.spawnMenace == null) derived.spawnMenace = 1;                 // live value, updated each frame from real field fullness in the spawn loop
    derived.luck = Math.min(0.6, luckFromLv(ecoLv("luck")) + pk().luck);    // +0.3% chance of a rare 9× SPECIAL dot per Luck level (buffed from 0.1% — was a trap stat vs Value) + Ascension Fortune perk
    derived.cls = {}; for (const t of ALL_TYPES) derived.cls[t] = classStats(t);
  }

  /* ----------------------------- save ---------------------------- */
  const KEY = "ids_clone.v3";   // bumped for the v3 economy (single global currency + Conquest multiplier) — old saves start fresh on the new model
  let wiping = false;
  function save() { if (wiping) return; try { if (S && S.vault) { const v = S.vault[S.galaxy] || (S.vault[S.galaxy] = { conquered: false, earned: 0, bgRate: 0 }); v.earned = curEarned; }
    const payload = JSON.stringify({ S, META, ts: Date.now(), cps, abil });   // abil persisted so leaving the app never refreshes ability cooldowns
    localStorage.setItem(KEY, payload);
    // CLOUD-SAVE BRIDGE — a native shell (Capacitor/TWA wrapper) can set window.__SAVE_BRIDGE = { push(json){...} }
    // to mirror every save into Play Games Saved Games / iCloud. The shell restores by writing the newest
    // snapshot into localStorage[KEY] BEFORE this script loads (newest ts wins) — no async plumbing in-game.
    if (typeof window !== "undefined" && window.__SAVE_BRIDGE && window.__SAVE_BRIDGE.push) try { window.__SAVE_BRIDGE.push(payload); } catch (e) {}
  } catch (e) {} }
  function wipeSave() { wiping = true; try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }
  // ---- SAVE CODES — manual cross-device transfer that works on every platform (web/PC/Android/iOS),
  // no account needed: Settings → Export gives a portable code, Import restores it anywhere. ----
  const SAVE_TAG = "IDS1.";   // format tag so future save-code formats can migrate old codes
  function exportSave() { save(); const raw = localStorage.getItem(KEY); if (!raw) return null; return SAVE_TAG + btoa(unescape(encodeURIComponent(raw))); }
  function importSave(code) {
    try {
      code = String(code || "").trim(); if (!code.startsWith(SAVE_TAG)) return "That doesn't look like a save code (missing IDS1 tag).";
      const json = decodeURIComponent(escape(atob(code.slice(SAVE_TAG.length)))), d = JSON.parse(json);
      if (!d || !d.S || !d.META) return "Save code is damaged — missing game state.";
      localStorage.setItem(KEY, json); wiping = true; location.reload(); return null;   // wiping=true: block autosave/beforeunload from stomping the imported save before reload
    } catch (e) { return "Couldn't read that save code."; }
  }
  function load() {
    S = fresh(); META = freshMeta(); let off = null, offSmall = 0;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) {
        // capList FIRST, before anything dereferences an entry: load() sits in a try/catch, and a throw
        // mid-sanitation (u.cd on a null entry) used to be swallowed leaving a HALF-sanitized S — the
        // junk then killed the boot later in renderList/countType (fuzzer finding). capList skips junk,
        // and an all-junk list falls back to the starter loadout instead of an empty army.
        if (d.S) { S = Object.assign(fresh(), d.S); S.lv = Object.assign(fresh().lv, d.S.lv || {});
          S.units = capList(Array.isArray(S.units) ? S.units : []); if (!S.units.length) S.units = [newUnit("turret")];
          S.units.forEach(u => { u.cd = u.cd || 0; });
          if (!S.classNodes || typeof S.classNodes !== "object") S.classNodes = {}; ALL_TYPES.forEach(t => { if (!S.classNodes[t]) S.classNodes[t] = {}; });
          if (!Array.isArray(S.collectors) || !S.collectors.length) { const n = 1 + (d.S.lv && d.S.lv.drones || 0); S.collectors = []; for (let i = 0; i < n; i++) S.collectors.push({ type: "drone" }); }
          S.collectors = capList(S.collectors); if (!S.collectors.length) S.collectors = [{ type: "drone" }];
          // v17.21 SAVE SANITATION (fuzzer finding): a corrupted or hand-edited save could plant
          // Infinity / NaN / strings in numeric fields — a string cpsS made every price NaN, and
          // NaN comparisons FAIL OPEN in the buy paths (one tap = free unit + NaN wallet, saved).
          // Coerce every load-bearing number; junk collapses to a sane default, never propagates.
          const num = (v, dflt, max) => { const x = +v; return isFinite(x) && x >= 0 ? Math.min(x, max || 1e300) : dflt; };
          S.cash = num(S.cash, 0); S.totalRun = num(S.totalRun, 0); S.runSec = num(S.runSec, 0);
          S.galaxy = Math.max(1, Math.min(TOTAL_PLANETS, num(S.galaxy, 1))); S.peakGalaxy = Math.max(S.galaxy, Math.min(TOTAL_PLANETS, num(S.peakGalaxy, 1)));
          S.conquest = num(S.conquest, 1) || 1; for (const k in S.lv) S.lv[k] = Math.round(num(S.lv[k], 0, 1200));   // level cap 1200, NOT 1e6: base·mul^lv overflows double past ~1800 levels at the v18.21 curves (60·1.48^2000 = Infinity → Infinity prices, fuzzer finding — 2000 was safe only while spawn was ×1.39); legitimate campaigns top out ~120
          if (S.travel && (typeof S.travel !== "object" || Array.isArray(S.travel) || !isFinite(+S.travel.t) || !isFinite(+S.travel.dur))) S.travel = null;   // a junk travel value crashed the update loop every frame (S.travel.t on a string — fuzzer finding); an Infinity dur would strand the ship in warp forever
          if (!d.S.v18) {   // v18.0 migration — keyed off the SAVE's own flag, never the merged state: fresh() carries v18:1 (see fresh), so Object.assign would mask a v17 save's missing flag and skip its fold. Fold the re-baseline era into ONE global ladder — your EFFECTIVE
            // levels (what actually powered the economy) carry over, plus a modest depth credit per planet reached.
            const strip = (id, per) => { const snap = S.ecoSnap && isFinite(+S.ecoSnap[id]) ? +S.ecoSnap[id] : Math.min(S.lv[id] || 0, per * (S.peakGalaxy - 1)); return Math.max(0, (S.lv[id] || 0) - snap); };
            S.lv.value = strip("value", 16) + 6 * (S.peakGalaxy - 1);
            S.lv.spawnRate = strip("spawnRate", 12) + 5 * (S.peakGalaxy - 1);
            delete S.ecoSnap; delete S.cpsS; delete S.launchQuote; S.v18 = 1; } }
          // v18.51 ECO GRANULARITY migration: saves store LEGACY levels, and rungs past
          // ECO_FINE_FROM are finer now, so the counter must be remapped or every economy stat would
          // read low. Keyed off the SAVE's own flag (fresh() carries ecoS:1) so a post-ascension save
          // can never re-run it — the exact trap the v18 fold above fell into and documents.
          if (!d.S.ecoS) { for (const u of UPS) S.lv[u.id] = Math.min(1200, Math.round(rungLv(S.lv[u.id] || 0))); S.ecoS = 1; }   // the adaptive-era trackers ride out with the snapshot
        if (d.META) { META = Object.assign(freshMeta(), d.META);
          const st = d.META.stats || {}; META.stats = Object.assign(freshStats(), st);
          META.stats.kills = Object.assign(freshStats().kills, st.kills || {});
          META.stats.collected = Object.assign(freshStats().collected, st.collected || {});
          META.stats.abilities = Object.assign({ frenzy: 0, dotrain: 0, blackhole: 0 }, st.abilities || {});
          META.opts = Object.assign(freshOpts(), d.META.opts || {});
          const da = d.META.asc; if (da && typeof da === "object") META.asc = { cores: +da.cores || 0, lv: (da.lv && typeof da.lv === "object") ? da.lv : {}, runs: +da.runs || 0, best: +da.best || 0, lifetime: +da.lifetime || 0, v: +da.v || 0, mineBuf: Math.min(1, Math.max(0, +da.mineBuf || 0)) };
          // v16.0 MIGRATION — gems are GONE. Refund every gem this save ever earned as ◈ cores (perk
          // purchases were paid FROM earned gems, so gemsEarned covers them; oldest saves lack it → count perks).
          if (d.META.gems != null || d.META.perks) {
            let refund = Math.max(+d.META.gemsEarned || 0, +d.META.gems || 0);
            if (refund <= 0 && d.META.perks) for (const id in d.META.perks) if (d.META.perks[id]) refund += (+String(id).slice(-1) || 1);
            if (refund > 0) { META.asc.cores += refund; META.asc.lifetime += refund; }
            delete META.gems; delete META.gemsEarned; delete META.perks;   // scrub the legacy fields — otherwise the next save re-carries them and the refund would re-run on EVERY load
          }
          // v16.3 MIGRATION — the Ascension shop became ONE line (income only). Refund every core
          // spent in the old seven-line shop at its OLD prices and clear the levels for a clean
          // rebuy. asc.v marks the shop schema so a refund can never run twice.
          if ((META.asc.v | 0) < 2) {
            const OLD_COST = { engine: [1, 2.0], war: [1, 2.0], clock: [2, 2.0], frugal: [2, 2.0], bond: [2, 2.0], fortune: [2, 2.2], head: [4, 3.0] };
            let back = 0; const lvs = META.asc.lv || {};
            for (const k in lvs) { const oc = OLD_COST[k], n = lvs[k] | 0; if (!oc || n <= 0) continue; for (let i = 0; i < n; i++) back += Math.ceil(oc[0] * Math.pow(oc[1], i)); }
            if (back > 0) META.asc.cores += back;   // lifetime already counted these cores when they were first banked
            META.asc.lv = {}; META.asc.v = 2;
          }
          // v16.4 MIGRATION — the whole geometry flattened (wall ×1.65, Engine +25%/lv @ 3·1.19^lv).
          // Refund v16.3 Engine levels at the v16.3 prices (ceil(0.5·1.5^lv)) for a clean rebuy.
          if ((META.asc.v | 0) < 3) {
            const n = (META.asc.lv && META.asc.lv.engine) | 0; let back = 0;
            for (let i = 0; i < n; i++) back += Math.ceil(0.5 * Math.pow(1.5, i));
            if (back > 0) META.asc.cores += back;
            META.asc.lv = {}; META.asc.v = 3;
          } }
        // v18.40 MIGRATION — under the new rules a mine comes WITH the world, and the keeper can only
        // be called on a world you have not taken yet. Any world conquered under the old rules and left
        // mineless would otherwise be stranded with no route to a seam at all, so it gets its mine now.
        if (S && S.vault) for (const k in S.vault) { const vm = S.vault[k]; if (vm && vm.conquered && !vm.mine) { vm.mine = 1; vm.mineBuf = +vm.mineBuf || 0; } }
        // v17 ONE-ARMY MIGRATION — planet vaults now hold campaign metadata ONLY (conquered/earned/bgRate).
        // The build you were actively playing becomes THE army and travels from here on; stored per-planet
        // builds (and their pocket banks) are retired — the strongest live build wins.
        if (S && S.vault) for (const k in S.vault) { const v2 = S.vault[k]; if (v2 && (v2.units || v2.lv || v2.classNodes || v2.cash != null)) S.vault[k] = { conquered: !!v2.conquered, earned: +v2.earned || 0, bgRate: +v2.bgRate || 0 }; }
        if (d.ts) { const e = clamp((Date.now() - d.ts) / 1000, 0, AWAY_CAP_H * 3600);
          // away earnings = the on-screen $/s you were passively earning (your collector income + empire) × seconds away
          const rate = (d.cps > 0 ? d.cps : 0) + (S.vault ? empireIdleRate() : 0), offTotal = Math.floor(Math.max(0, rate) * e + (S.vault ? settleOffline(e) : 0));   // v18.14: the on-site term is a two-segment spoils integral, not rate×e
          if (offTotal > 0) { S.totalRun += offTotal; META.totalEver += offTotal;
            // offline ALSO advances the active planet's conquer bar (mirrors the live loop), capped at the
            // target — so progress doesn't stall just because the tab was closed. Picked up by curEarned below.
            const pmv = S.vault && (S.vault[S.galaxy] || (S.vault[S.galaxy] = { conquered: false, earned: 0, bgRate: 0 }));
            if (pmv && !pmv.conquered) pmv.earned = Math.min(conquerTarget(S.galaxy), (pmv.earned || 0) + offlineBarGain(offTotal, e));   // v18.21: the BAR obeys the idle allowance; the cash above is untouched
            if (e >= 60) off = { gain: Math.floor(offTotal), elapsed: e, pool: offTotal };   // hold the pool; auto-buy spends it after recompute (below)
            else offSmall = offTotal; }   // <60s: defer to the capacity-clamped add after recompute (was S.cash += offTotal, which bypassed the cap → reload-grind exploit)
          if (S.travel && S.travel.dur) S.travel.t = (S.travel.t || 0) + Math.max(0, (Date.now() - d.ts) / 1000);   // expedition keeps travelling while away (uncapped — long trips must finish)
          const mLoad = mineAccrue(e, true);   // ◈ core mines dig on the full away clock (their own rates are the bound)
          if (mLoad > 0) { if (!off && e >= 60) off = { gain: 0, elapsed: e }; if (off) off.mined = mLoad; }
        }
      }
    } catch (e) {}
    if (!S.vault) S.vault = {};
    // v18.18 vault hygiene: per-planet mine hoppers + spoils are player-facing CURRENCY state — coerce
    // & clamp on every load (a hostile 1e9 hopper would floor straight into 1e9 instant cores), and
    // fold the old GLOBAL mineBuf (pre-v18.18 saves) into the first built mine so no progress is lost.
    for (const k in S.vault) { const v = S.vault[k]; if (!v) continue;
      v.mineBuf = clamp(+v.mineBuf || 0, 0, 1);
      if (v.spoils != null) v.spoils = clamp(+v.spoils || 0, 0, SETTLE_SPOILS_FRAC * conquerTarget(+k)); }
    if (META && META.asc && +META.asc.mineBuf > 0) { for (const k in S.vault) { const v = S.vault[k]; if (v && v.conquered && v.mine) { v.mineBuf = Math.min(1, v.mineBuf + Math.min(1, +META.asc.mineBuf)); break; } } META.asc.mineBuf = 0; }
    try { const d2 = JSON.parse(localStorage.getItem(KEY));   // ability cooldowns survive a reload/app-kill: restore minus real seconds away (never an instant refresh)
      if (d2 && d2.abil) { const eAb = d2.ts ? Math.max(0, (Date.now() - d2.ts) / 1000) : 0;
        for (const k in abil) if (k in d2.abil) abil[k] = Math.max(0, (+d2.abil[k] || 0) - eAb); } } catch (e) {}
    ensureAuto();
    curEarned = (S.vault[S.galaxy] && S.vault[S.galaxy].earned) || 0;
    recompute();
    if (offSmall > 0) S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + offSmall));   // short-session offline gain, now capacity-clamped
    if (off) {
      const cash0 = S.cash;   // v16.5: track what ACTUALLY lands in the wallet so the popup can't over-promise
      if (off.pool != null) {   // simulate auto-buy spending the banked away-budget, then bank what's left (clamped)
        const r = autoBuyOffline(off.pool); recompute();
        off.autoBought = r.bought; off.spent = off.pool - r.leftover;
        S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + r.leftover)); delete off.pool;
      } else { S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + off.gain)); }
      off.banked = Math.max(0, S.cash - cash0); off.cap = derived.capacity;
      S._welcome = off;
    }
  }

  // ---- BACKGROUND / MOBILE CATCH-UP ----------------------------------------
  // Phones (and tabs) SUSPEND all JS when the screen locks or you switch apps — the live loop simply
  // stops, so nothing can "run" in the background. Instead we stamp the time on hide and, the moment we
  // come back, credit the elapsed wall-clock time exactly like a reload would (idle empire + half your
  // active rate, capped at 12h, auto-buy spends it). So progress genuinely continues while you're away.
  function countUpTo(el, target, prefix, dur) {   // juice: "number goes up" — ease a displayed amount to its final value
    if (!el) return; const t0 = performance.now(); dur = dur || 700;
    const step = now => { const k = clamp((now - t0) / dur, 0, 1), e = 1 - (1 - k) * (1 - k);
      el.textContent = prefix + fmt(Math.round(target * e));
      if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // ── ONE CARD AT A TIME (v18.34) ────────────────────────────────────────────
  // Owner: "sometimes I load in and get a few different things pop up, then I'm thrust without
  // consent into a boss battle, then a mine appears, then a launch button". Every announcement used
  // to open itself the instant its own code ran, so a conquest completing during the first frames
  // after a cold load (the conquest check is unconditional — idle empire income finishes bars while
  // you're away) raced Welcome Back, the ◈ core card and the victory screen, in whatever order the
  // away-credit happened to land. Cards is the single door they all go through: FIFO, one on screen,
  // the next only after the last is dismissed. Closing is detected by watching the .show class, so
  // EVERY existing close path (its own button, Esc, closeCards, openAscend) advances the queue and
  // no card can ever be stranded behind one that was dismissed some other way.
  const Cards = (() => {
    const q = []; let cur = null, idleFns = [];
    const shown = el => !!el && el.classList.contains("show");
    // Anything the player opened themselves — star map, ascension, skill tree, settings — blocks the
    // queue too: a conquest completing while you read the map used to throw its announcements over the
    // top of it. HOME is the screen everything else sits on, never a blocker.
    // Deliberately ONLY .modal.show: #tutorial keeps its .show class while hidden, so treating it as a
    // blocker would stall the queue forever on any save that has ever seen the tutorial.
    const blocker = () => { for (const m of document.querySelectorAll(".modal.show")) if (m.id !== "home" && m.id !== cur) return m; return null; };
    function watch(el, fn) { new MutationObserver((m, o) => { if (!shown(el)) { o.disconnect(); fn(); } }).observe(el, { attributes: true, attributeFilter: ["class"] }); }
    function pump() {
      if (cur) { if (shown($(cur))) return; cur = null; }   // still up — wait for it
      const next = q[0];
      if (!next) { const fns = idleFns; idleFns = []; for (const f of fns) f(); return; }
      const b = blocker();
      if (b) { watch(b, pump); return; }                    // hold the queue until the player closes it
      q.shift();
      cur = next.id; next.open();
      const el = $(cur); if (!el) { cur = null; pump(); return; }
      if (!shown(el)) { cur = null; pump(); return; }        // open() declined to show — skip it
      watch(el, () => { if (cur === el.id) cur = null; pump(); });
    }
    return {
      push(id, open) { q.push({ id, open }); pump(); },
      busy() { return !!cur || q.length > 0; },
      onIdle(fn) { if (!this.busy()) fn(); else idleFns.push(fn); },
    };
  })();

  function showWelcome(w) {
    // v16.5: the headline number is what you actually BANK — the old popup counted up the full earned total
    // even when the capacity cap let almost none of it into the wallet, which read as a broken promise.
    const banked = w.banked != null ? w.banked : w.gain, clamped = banked < w.gain - 1;
    let txt = "You kept earning for " + fmtTime(w.elapsed) + " at your last on-screen rate — " + curSym(S.galaxy) + " " + fmt(w.gain) + " earned.";
    if (w.autoBought) txt += "  Auto-Buy spent part of it on " + w.autoBought + " upgrade" + (w.autoBought === 1 ? "" : "s") + ".";
    if (w.mined >= 1) txt += "  Your ◈ core mines dug up " + w.mined + " core" + (w.mined === 1 ? "" : "s") + " while you were gone.";
    if (clamped) txt += "  Your wallet banked what fits under the " + curSym(S.galaxy) + " " + fmt(w.cap || derived.capacity) + " capacity cap — invest in Capacity to bank more.";
    if (!planetMeta(S.galaxy).conquered) txt += "  The conquer bar does not move while you are gone — worlds are taken in person. Spend the haul and go and take it.";   // v18.22: the bar DOES move while you're away, at the idle allowance — say by how much
    $("welcome-text").textContent = txt;
    countUpTo($("welcome-cash"), banked, curSym(S.galaxy) + " ", 800); $("welcome").classList.add("show");
  }
  // ⚑ CONQUEST REPORT (v18.34) — the one card a conquest opens. It replaces four 0.95s floating texts
  // that carried PERMANENT information (cores banked, the spoils pot, the fact a mine site exists, what
  // to do next) and were gone before you could read them. Everything a conquest paid is stated once, in
  // one place, and nothing else happens until you press the button: the world is already settled behind
  // it, so dismissing lands you on a quiet world with the settlement panel and LAUNCH both waiting.
  function showConquest(g, cores, spoils) {
    const el = $("conquest"); if (!el) return;
    const nm = $("cq-name"); if (nm) nm.textContent = "✦ " + galName(g).toUpperCase() + " CONQUERED";
    // one line per row: the card sits over the dock on a phone, so every line it saves is a line of the
    // settled world you can see behind it
    const rows = [
      ["◈ CORES", "+" + fmt(cores) + " pending (" + fmt(pendingCores()) + " ready)"],
      ["⚑ SPOILS", curSym(g) + " " + fmt(spoils) + " at ×" + SETTLE_ON_SITE + " parked"],
      ["⛏ ◈ MINE", "founded on the seam — " + fmtMineRate(mineRate(g))],
      ["⟶ LAUNCH", curSym(g) + " " + fmt(travelCost(g)) + ", when you like"],
    ];
    const cs = $("cq-rows"); if (cs) cs.innerHTML = rows.map(r => "<div class='vs-row'><span>" + r[0] + "</span><b>" + r[1] + "</b></div>").join("");
    const nt = $("cq-note");
    if (nt) nt.textContent = "You took " + wardenOf(g).n + " down and the world with it. It is yours and at peace — the ◈ seam came with it, "
      + "and the site goes up as soon as you close this. Launch whenever you are ready.";
    el.classList.add("show");
  }
  // VICTORY (v16.5): conquering the final world deserves a real screen, not a 2-second float text.
  // Shown once when the last conquest lands (S.victory guards it); replayable from nowhere — it's a moment.
  function showVictory() {
    const el = $("victory"); if (!el) return;
    const st = (META && META.stats) || {}, asc = (META && META.asc) || {};
    const rows = [
      ["TIME PLAYED", fmtTime(st.playSec | 0)],
      ["ASCENSIONS", fmt(asc.runs | 0)],
      ["DOTS POPPED", fmt(st.dotsPopped | 0)],
      ["EARNED ALL-TIME", curSym(S.galaxy) + " " + fmt(Math.floor(META.totalEver || 0))],
    ];
    const vs = $("victory-stats"); if (vs) vs.innerHTML = rows.map(r => "<div class='vs-row'><span>" + r[0] + "</span><b>" + r[1] + "</b></div>").join("");
    el.classList.add("show");
  }
  function showBossReward(name, amount, gem, node, escaped, dealtPct) {   // non-blocking end-of-boss recap (kill OR escape); auto-dismisses
    const el = $("boss-reward"); if (!el) return;
    el.classList.toggle("escape", !!escaped);
    if (escaped) Audio_escape();   // v16.7: the getaway gets its falling-minor shrug
    $("br-title").textContent = escaped ? "✕ " + name + " ESCAPED" : "▲ " + name + " DEFEATED";
    countUpTo($("br-cash"), amount, "+" + curSym(S.galaxy) + " ", 600);
    const bn = $("br-bonus"); if (bn) { bn.textContent = escaped
      ? (amount > 0 ? "you dealt " + dealtPct + "% — salvage banked · defeat it for the full bounty" : "no damage landed — hit it next time for the bounty")
      : gem ? "◈ +1 GEM — spend it in Ascension"
      : node ? "✦ FREE NODE — " + nodeLabel(node.type, node.node) + " · " + TY(node.type).name + " tree · worth " + curSym(S.galaxy) + " " + fmt(node.cost)
      : "loot dropped — grab the orbs"; }
    el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), escaped ? 5200 : 4200);
  }

  /* ══════════════ BOSS BOUNTY WHEEL (v15.0) ══════════════
     Every boss KILL spins a fortune wheel instead of the old recap popup (escapes keep the popup).
     Slices are rebuilt fresh per kill and are all PROGRESS-MATCHED: cash tiers show LITERAL multiples
     of the live-income bounty this boss pays, node slices are the priciest skill nodes you can
     actually reach right now (named on the wheel), and a ◈ GEM hides at exactly 2%. The outcome is
     weight-rolled before the wheel moves — the spin only travels to it ("you get what you get") —
     with a wind-up pull, 5–6 revolutions, per-slice pointer ticks with recoil, a long quintic
     slow-down, confetti burst and a slammed-in reveal. Non-blocking: the field keeps playing
     underneath; a tap launches instantly / dismisses after landing. Monochrome AAA — luminance
     tiers, white glow, a shimmering jackpot slice — matching the game's palette. */
  const Wheel = (() => {
    // SLOT-DRUM geometry (v15.2): ONE octagonal reel facing you, spinning vertically past a payline
    // (owner: "a slot machine with 1 wheel spinning in front of you, but it's an octagon"). clean face-on slot window:
    // NO side plates (owner call) — just the octagonal reel's flat panels scrolling full-width past
    // the payline, framed by plain machine rails. The octagon reads through the 8 hard panel seams
    // and the prism foreshortening. XL/XR = window sides, RY = reel radius.
    const CSW = 340, CSH = 310, C = 170, CY = 150, XL = 46, XR = 294, RY = 116;
    let segs = [], v0 = 0, bossNm = "", state = "off";      // off | arm | spin | done
    let a = 0, a0 = 0, aT = 0, t = 0, dur = 4.2, armT = 0, doneT = 0, tickIdx = -1, studT = 0, won = -1, parts = [], raf = 0, lastTs = 0, wired = false, resultTxt = "";
    const el = () => $("wheel");
    const easeOutQuint = k => 1 + (--k) * k * k * k * k;
    const easeInOut = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    // which slice sits under the fixed top pointer for a given wheel rotation
    function segAt(ang) {   // which FACE sits on the payline (drum front, angle 0). Faces are equal 1/N
      // sectors of the octagon; the ODDS stay weighted because the outcome is pre-rolled and the spin
      // just travels to that face — exactly how a real slot's virtual reel works.
      const n = segs.length || 8, f = (((-ang) % TAU) + TAU) % TAU;
      return Math.min(n - 1, Math.floor(f / (TAU / n)));
    }
    function build(v) {
      const top = nodeCandidates().slice(0, 3);
      const L = [];
      const cash = (mul, w) => L.push({ kind: mul >= 10 ? "jack" : "cash", mul, w, lum: mul >= 10 ? 68 : mul >= 3 ? 37 : 30, label: (mul >= 10 ? "★ " : "") + curSym(S.galaxy) + " " + fmt(Math.round(v * mul)) });
      const node = p => L.push({ kind: "node", pick: p, w: 0, lum: 46, label: "✦ " + nodeLabel(p.type, p.node) });
      const nw = [18, 16, 14], nmul = [3, 4, 5];            // node face weights (48 when all three exist); a missing
      // node face becomes a BONUS cash face at the same odds — the octagon drum always has exactly 8 faces
      top[0] ? (node(top[0]), L[L.length - 1].w = nw[0]) : cash(nmul[0], nw[0]);
      cash(2, 14);
      top[1] ? (node(top[1]), L[L.length - 1].w = nw[1]) : cash(nmul[1], nw[1]);
      cash(3, 12);
      top[2] ? (node(top[2]), L[L.length - 1].w = nw[2]) : cash(nmul[2], nw[2]);
      cash(2, 14);
      L.push({ kind: "core", w: 2, lum: 84, label: "◈ CORE" });   // super low, exactly 2% — a rare Ascension core, banked directly
      cash(10, 10);                                         // the JACKPOT face — ×10 the bounty
      return L;
    }
    function roll() { let r = Math.random() * 100, acc = 0; for (let i = 0; i < segs.length; i++) { acc += segs[i].w; if (r < acc) return i; } return segs.length - 1; }
    // ── the prize actually lands (called once, at the moment the wheel stops) ──
    function apply(sg) {
      if (sg.kind === "node") {
        let p = sg.pick;
        if (!nodeAllocatable(p.type, p.node) || (S.classNodes[p.type] && S.classNodes[p.type][p.node.id])) p = nodeCandidates()[0];   // auto-buy raced us mid-spin — regift the current best
        if (p) { applyNodePick(p); syncHUD(); save(); return "✦ " + nodeLabel(p.type, p.node).toUpperCase() + " — " + TY(p.type).name + " tree"; }
        sg = { kind: "cash", mul: 2 };                      // every tree maxed: pay double instead
      }
      if (sg.kind === "core") { awardCores(1, "rare drop — BOSS BOUNTY WHEEL"); save(); return "◈ +1 CORE — banked to Ascension"; }
      const amt = Math.round(v0 * sg.mul);                  // cash tiers bypass the capacity ceiling, exactly like the banked lump
      S.cash += amt; S.totalRun += amt; META.totalEver += amt; curEarned += amt; earnAcc += amt; syncHUD();
      return "+" + curSym(S.galaxy) + " " + fmt(amt) + (sg.mul >= 10 ? "  ·  JACKPOT!" : "");
    }
    function show(v, name) {
      const host = el(); if (!host) return false;
      if (!wired) { wired = true; host.addEventListener("pointerdown", tap); }
      segs = build(v); v0 = v; bossNm = name || "BOSS"; won = roll();
      state = "arm"; armT = 0; doneT = 0; t = 0; tickIdx = -1; parts.length = 0; resultTxt = "";
      a = a0 = rnd(0, TAU);
      $("wh-title").textContent = "▲ " + bossNm.toUpperCase() + " BOUNTY";
      $("wh-result").textContent = ""; $("wh-result").classList.remove("slam");
      $("wh-hint").textContent = "TAP TO SPIN";
      host.classList.add("show");
      lastTs = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      return true;
    }
    function launch() {
      if (state !== "arm") return;
      Audio_spinup();   // v16.8: the reel ripping into motion has a wind-up voice
      state = "spin"; t = 0; a0 = a; dur = rnd(3.9, 4.6);
      // land the winning slice centred under the pointer (± a little in-slice jitter), 5–6 turns out
      const span = TAU / segs.length, centre = (won + 0.5) * span;
      const base = -centre + rnd(-0.3, 0.3) * span;   // land the rolled face on the payline (± in-face jitter)
      const delta = (((base - a) % TAU) + TAU) % TAU;
      aT = a + (5 + (Math.random() < 0.5 ? 0 : 1)) * TAU + delta;
      $("wh-hint").textContent = " ";
    }
    function land() {
      state = "done"; doneT = 0;
      resultTxt = apply(segs[won]);
      Audio_win(segs[won] && segs[won].kind === "jack");   // v16.7: the landing slam finally has a voice
      const rs = $("wh-result"); rs.textContent = resultTxt; rs.classList.remove("slam"); void rs.offsetWidth; rs.classList.add("slam");
      $("wh-hint").textContent = "TAP TO CLOSE";
      flashAdd(segs[won].kind === "jack" ? 0.55 : 0.3); shakeAdd(segs[won].kind === "jack" ? 7 : 3); vibe(segs[won].kind === "jack" ? [50, 40, 90] : [30, 20, 40]);
      Audio_node();
      for (let i = 0; i < 74; i++) {                        // confetti — white sparks from the pointer + hub
        const top_ = Math.random() < 0.65, ang = rnd(0, TAU), sp = rnd(60, 300);
        parts.push({ x: top_ ? XL + Math.random() * (XR - XL) : C, y: top_ ? CY : CY - 30, vx: Math.cos(ang) * sp * (top_ ? 0.5 : 1), vy: top_ ? rnd(40, 200) : Math.sin(ang) * sp, r: rnd(1.5, 3.5), life: rnd(0.7, 1.3), t: 0, spin: rnd(0, TAU) });
      }
    }
    function tap() {
      if (state === "arm") launch();
      else if (state === "done" && doneT > 0.45) hide();
    }
    function hide() { state = "off"; cancelAnimationFrame(raf); const h = el(); if (h) h.classList.remove("show"); }
    function loop(ts) {
      if (state === "off") return;
      const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016); lastTs = ts;
      if (state === "arm") { armT += dt; a = a0 - easeInOut(Math.min(armT / 0.6, 1)) * 0.22; if (armT >= 0.85) launch(); }   // wind-up pull, then it rips
      else if (state === "spin") {
        t += dt; const k = Math.min(t / dur, 1);
        a = a0 + (aT - a0) * easeOutQuint(k);
        const idx = segAt(a);
        if (idx !== tickIdx) { tickIdx = idx; studT = 0.12; Audio_tick(); const p = document.querySelector("#wheel .wh-pointer"); if (p) { p.classList.remove("tick"); void p.offsetWidth; p.classList.add("tick"); } }
        if (k >= 1) land();
      }
      else if (state === "done") { doneT += dt; if (doneT > 3.8) { hide(); return; } }
      if (studT > 0) studT -= dt;
      for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.spin += dt * 6; }
      parts = parts.filter(p => p.t < p.life);
      draw();
      raf = requestAnimationFrame(loop);
    }
    function draw() {
      const cv = $("wh-canvas"); if (!cv) return;
      const dp = window.devicePixelRatio || 1, nw2 = Math.round(CSW * dp), nh2 = Math.round(CSH * dp);
      if (cv.width !== nw2 || cv.height !== nh2) { cv.width = nw2; cv.height = nh2; }
      const x = cv.getContext("2d"); x.setTransform(cv.width / CSW, 0, 0, cv.height / CSH, 0, 0); x.clearRect(0, 0, CSW, CSH);
      const n = segs.length || 8, span = TAU / n, HALF = Math.PI / 2;
      const pulse = state === "done" ? 0.5 + 0.5 * Math.sin(doneT * 6) : 0;
      const Y = f => CY - Math.sin(f) * RY;                 // panel edge height on the prism (φ 0 = payline front)
      const wrap = f => (((f + Math.PI) % TAU) + TAU) % TAU - Math.PI;
      const top0 = CY - RY, bot0 = CY + RY, W2 = XR - XL;
      // ── ground shadow ──
      x.save(); x.translate(C, bot0 + 14); x.scale(1, 0.18);
      const gs = x.createRadialGradient(0, 0, 20, 0, 0, 170);
      gs.addColorStop(0, "rgba(0,0,0,.5)"); gs.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = gs; x.beginPath(); x.arc(0, 0, 170, 0, TAU); x.fill(); x.restore();
      // ── solid reel body behind the panels ──
      x.fillStyle = "hsl(0,0%,9%)"; x.fillRect(XL, top0, W2, RY * 2);
      // ── prize panels: strict front hemisphere, edges clamped to the rim — flat full-width bands,
      //    exactly like a slot reel behind its window; the hard seams are the octagon's edges ──
      const order = [];
      for (let i = 0; i < n; i++) {
        const w1 = wrap(i * span + a), w2 = w1 + span;
        const a1 = clamp(w1, -HALF, HALF), a2 = clamp(w2, -HALF, HALF);
        if (a2 - a1 < 0.012) continue;
        order.push([Math.cos((a1 + a2) / 2), i, a1, a2]);
      }
      order.sort((p, q) => p[0] - q[0]);   // back-to-front; the payline panel paints last
      for (const [cm, i, a1, a2] of order) {
        const sg = segs[i], mid = (a1 + a2) / 2, y1 = Y(a1), y2 = Y(a2);
        const winGlow = state === "done" && i === won;
        let lum = sg.lum * (0.42 + 0.58 * Math.max(0, cm));   // curvature shading — panels darken as they roll away
        if (sg.kind === "jack") lum += Math.sin((state === "off" ? 0 : performance.now() / 300) + i) * 5 * Math.max(0.2, cm);
        if (winGlow) lum = Math.min(94, lum + 24 + pulse * 10);
        x.beginPath(); x.rect(XL, Math.min(y1, y2), W2, Math.abs(y1 - y2));
        x.fillStyle = "hsl(0,0%," + Math.round(lum) + "%)";
        if (winGlow) { x.shadowColor = "rgba(255,255,255,.9)"; x.shadowBlur = 24; }
        x.fill(); x.shadowBlur = 0;
        x.strokeStyle = "rgba(255,255,255," + (0.14 + 0.3 * Math.max(0, cm)) + ")"; x.lineWidth = 1.4; x.stroke();
        // label — squashes as the panel rolls away from the payline
        if (cm > 0.3) {
          x.save(); x.translate(C, (y1 + y2) / 2); x.scale(1, Math.max(0.2, cm));
          const bright = lum > 52;
          x.textAlign = "center"; x.textBaseline = "middle";
          x.font = "700 " + (sg.kind === "core" ? 14 : 16) + "px ui-monospace,Consolas,monospace";
          x.fillStyle = bright ? "rgba(0,0,0,.9)" : winGlow ? "#fff" : "rgba(255,255,255," + (sg.kind === "cash" ? 0.9 : 0.98) + ")";
          let lb = sg.label; if (lb.length > 20) lb = lb.slice(0, 19) + "…";
          x.fillText(lb, 0, sg.kind === "jack" ? 6 : 0);
          if (sg.kind === "jack") { x.font = "800 9px ui-monospace,Consolas,monospace"; x.fillText("J A C K P O T", 0, -12); }
          x.restore();
        }
      }
      // ── cabinet glass: hoods + sheen inside the window ──
      x.save(); x.beginPath(); x.rect(XL, top0, W2, RY * 2); x.clip();
      let g2 = x.createLinearGradient(0, top0, 0, CY - 58);
      g2.addColorStop(0, "rgba(0,0,0,.62)"); g2.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g2; x.fillRect(XL, top0, W2, RY - 56);
      g2 = x.createLinearGradient(0, CY + 58, 0, bot0);
      g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "rgba(0,0,0,.62)");
      x.fillStyle = g2; x.fillRect(XL, CY + 58, W2, RY - 56);
      g2 = x.createLinearGradient(0, CY - 32, 0, CY + 8);
      g2.addColorStop(0, "rgba(255,255,255,0)"); g2.addColorStop(0.5, "rgba(255,255,255,.06)"); g2.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g2; x.fillRect(XL, CY - 32, W2, 40);
      x.restore();
      // ── machine frame: side rails + window bezel (plain, no plates — owner call) ──
      const rail = (rx) => {
        const rg = x.createLinearGradient(rx, 0, rx + 12, 0);
        rg.addColorStop(0, "hsl(0,0%,20%)"); rg.addColorStop(0.5, "hsl(0,0%,13%)"); rg.addColorStop(1, "hsl(0,0%,7%)");
        x.fillStyle = rg; x.fillRect(rx, top0 - 8, 12, RY * 2 + 16);
        x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 1; x.strokeRect(rx + 0.5, top0 - 7.5, 11, RY * 2 + 15);
      };
      rail(XL - 14); rail(XR + 2);
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2;
      x.beginPath(); x.moveTo(XL, top0); x.lineTo(XR, top0); x.stroke();       // window rims
      x.beginPath(); x.moveTo(XL, bot0); x.lineTo(XR, bot0); x.stroke();
      x.strokeStyle = "rgba(255,255,255,.16)"; x.lineWidth = 1;
      x.strokeRect(XL - 16.5, top0 - 10.5, W2 + 33, RY * 2 + 21);              // outer bezel
      // ── PAYLINE — arrows on the rails (kick on ticks, flare on the win) ──
      const kick = studT > 0 ? 5 : 0, flare = state === "done" ? 0.55 + pulse * 0.45 : 0.85;
      x.fillStyle = "rgba(255,255,255," + flare + ")";
      x.beginPath(); x.moveTo(XL - 30 + kick, CY - 9); x.lineTo(XL - 30 + kick, CY + 9); x.lineTo(XL - 13 + kick, CY); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(XR + 30 - kick, CY - 9); x.lineTo(XR + 30 - kick, CY + 9); x.lineTo(XR + 13 - kick, CY); x.closePath(); x.fill();
      x.strokeStyle = "rgba(255,255,255," + (state === "done" ? 0.3 + pulse * 0.2 : 0.15) + ")"; x.lineWidth = 1;
      x.beginPath(); x.moveTo(XL, CY); x.lineTo(XR, CY); x.stroke();
      for (const p of parts) {                              // confetti
        x.save(); x.translate(p.x, p.y); x.rotate(p.spin); x.globalAlpha = Math.max(0, 1 - p.t / p.life);
        x.fillStyle = "#fff"; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore();
      }
      x.globalAlpha = 1;
    }
    return { show, build, apply, tap, hide, state: () => state, won: () => won, segs: () => segs };
  })();

  function applyAway(e) {
    e = clamp(e, 0, AWAY_CAP_H * 3600); if (e < 1 || !S) return;
    if (S.travel && S.travel.dur) S.travel.t = (S.travel.t || 0) + e;                 // expeditions keep travelling while away
    for (const k in abil) if (abil[k] > 0) abil[k] = Math.max(0, abil[k] - e);        // cooldowns tick while away (loop was frozen) — but never reset
    const rate = (cps > 0 ? cps : 0) + (S.vault ? empireIdleRate() : 0), offTotal = Math.floor(Math.max(0, rate) * e + (S.vault ? settleOffline(e) : 0));   // away earnings = passive $/s (collectors + empire) × seconds away + the settled-world spoils integral (v18.14)
    const mAway = mineAccrue(e, e < 60);   // ◈ mines dig through the whole absence
    if (offTotal > 0) {
      S.totalRun += offTotal; META.totalEver += offTotal;
      const pmv = S.vault[S.galaxy] || (S.vault[S.galaxy] = { conquered: false, earned: 0, bgRate: 0 });
      if (!pmv.conquered) { pmv.earned = Math.min(conquerTarget(S.galaxy), (pmv.earned || 0) + offlineBarGain(offTotal, e)); curEarned = pmv.earned; }   // v18.21: the conquer BAR only moves at the idle allowance (cash banks in full above)
      if (e >= 60) { const cash0 = S.cash, r = autoBuyOffline(offTotal); recompute(); S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + r.leftover)); showWelcome({ gain: Math.floor(offTotal), elapsed: e, autoBought: r.bought, banked: Math.max(0, S.cash - cash0), cap: derived.capacity, mined: mAway }); }
      else S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + offTotal));   // short blips: bank silently (capacity-clamped)
    } else if (mAway >= 1 && e >= 60) showWelcome({ gain: 0, elapsed: e, banked: 0, cap: derived.capacity, mined: mAway });
    save(); recompute(); syncHUD();
  }
  let bgHideTs = 0;
  function onHidden() { if (!S || bgHideTs) return; bgHideTs = Date.now(); save(); }     // stamp + persist so a hard kill still credits via load()
  function onVisible() { if (!bgHideTs) return; const e = (Date.now() - bgHideTs) / 1000; bgHideTs = 0; last = 0; applyAway(e); checkForUpdate(); }   // last=0 → the first resumed frame's dt is clamped, not a giant jump; returning from background is also the perfect moment to look for a newer build
  // ---- LIVE UPDATE DETECTOR (v16.6) — how a push gets FELT on every platform. Phones keep a tab (or
  // installed PWA) alive for days; without this they'd run a stale build forever. We re-fetch index.html
  // with cache:'no-store' (tiny — the game itself is NOT re-downloaded), read the ?v= cache-buster it
  // points at, and if it's NEWER than the running build show a persistent TAP TO UPDATE pill; the reload
  // then pulls the new ?v= URLs past every HTTP cache. On commit-pinned links (raw.githack/<sha>/) the
  // fetched version always equals the running one, so the pill correctly never appears there.
  let updLastCheck = 0, updOffered = false;
  const verNum = v => { const m = /([0-9]+)\.([0-9]+)/.exec(v || ""); return m ? (+m[1]) * 1000 + (+m[2]) : 0; };
  // v17.13 iOS-PWA-proof apply: a plain location.reload() can serve the HTTP-CACHED index.html
  // (Safari and the saved home-screen app cache the start page for minutes) — you'd tap UPDATE and
  // land right back on the old build. Navigating to index.html?upd=<new version> busts every HTTP
  // cache on the document itself; the fresh index then carries the new ?v= asset URLs. replace()
  // stays inside the standalone shell and overwrites any previous ?upd= query cleanly.
  const updApply = v => { save(); location.replace(location.pathname + "?upd=" + encodeURIComponent(v || Date.now())); };
  function checkForUpdate(manual, cb) {   // manual=true (v17.3 Settings "UPDATE NOW"): bypass the throttle + pill-dedupe and report the outcome
    const now = Date.now();
    if (!manual && (updOffered || now - updLastCheck < 10 * 60e3)) return;
    updLastCheck = now;
    if (location.protocol === "file:") { if (cb) cb("offline"); return; }   // opened from disk — nothing to poll
    try { fetch("index.html", { cache: "no-store" }).then(r => r.ok ? r.text() : "").then(html => {
      const m = /js\/game\.js\?v=([0-9.]+)/.exec(html || ""); if (!m) { if (cb) cb("error"); return; }
      if (verNum(m[1]) > verNum(VERSION)) { updOffered = true;
        let t = $("upd-toast"); if (!t) { t = document.createElement("button"); t.id = "upd-toast"; document.body.appendChild(t); }
        t.onclick = () => updApply(m[1]);   // (re)bound every check so the buster always carries the newest seen version
        t.textContent = "⬆ NEW VERSION v" + m[1] + " — TAP TO UPDATE"; t.classList.add("show");
        if (cb) cb("newer:" + m[1]); }
      else if (cb) cb("current");
    }).catch(() => { if (cb) cb("error"); }); } catch (e) { if (cb) cb("error"); }
  }
  setTimeout(checkForUpdate, 5000);   // one early check after boot, then piggyback on every return-to-foreground
  document.addEventListener("visibilitychange", () => { if (document.hidden) onHidden(); else onVisible(); });   // mobile: fires on screen-lock & app-switch
  window.addEventListener("pagehide", onHidden); window.addEventListener("pageshow", onVisible);                 // iOS Safari bfcache / tab suspension
  document.addEventListener("freeze", onHidden); document.addEventListener("resume", onVisible);                 // Chrome Page Lifecycle (Android/TWA background freeze) — the OS can freeze the page without a visibilitychange

  /* ----------------------------- entities ------------------------ */
  // ── v18.4 HIVE SWARM (owner call): a Drone Swarm is now THREE real wingmate bodies, not one token
  // with orbiting dots. Each wingmate hunts and hauls its OWN orbs, independently — but all three are
  // tethered inside a shared HIVE RADIUS whose anchor drifts with the action (the hive mind). Each
  // wingmate carries a SHARE of the swarm's stats (tuned so 3 bodies ≈ the old single swarm's measured
  // bank rate — parallelism buys coverage, not free throughput).
  const WING_N = 3, HIVE_R = 150;
  const hiveAnchors = {};                                  // hive index → drifting anchor (runtime only)
  const cSpeedD  = dr => cSpeed(dr.type)  * (dr.wing != null ? 0.8 : 1);
  const cReachD  = dr => cReach(dr.type)  * (dr.wing != null ? 0.8 : 1);
  const cCapD    = dr => dr.wing != null ? Math.max(1, Math.ceil(cCapacity(dr.type) / WING_N)) : cCapacity(dr.type);
  const cIngestD = dr => cIngest(dr.type) * (dr.wing != null ? 1.0 : 1);
  function syncCollectors() {
    const want = [];   // expansion: every Drone Swarm fields WING_N wingmate bodies sharing one hive
    for (let i = 0; i < S.collectors.length; i++) { const t = S.collectors[i].type;
      if (t === "swarm") { for (let w = 0; w < WING_N; w++) want.push({ type: t, hive: i, wing: w }); }
      else want.push({ type: t, hive: undefined, wing: undefined });
    }
    while (drones.length < want.length) drones.push({ x: rnd(W * 0.3, W * 0.7), y: rnd(H * 0.3, H * 0.6), vx: 0, vy: 0 });
    while (drones.length > want.length) drones.pop();
    for (let i = 0; i < want.length; i++) { drones[i].type = want[i].type; drones[i].hive = want[i].hive; drones[i].wing = want[i].wing; }
    for (const k in hiveAnchors) if (!want.some(w => w.hive === +k)) delete hiveAnchors[k];   // sold swarms release their anchors
  }

  const armorChance = g => Math.min(0.05 + 0.022 * (g - 1), 0.28);
  // enemy archetypes that appear in later galaxies — each with its own twist.
  // --- DOT RACES: every PLANET has its OWN native race (a unique ability + look).
  // RACES[g] is the signature race that debuts on planet g; on planet g the exotic
  // spawns are mostly that race, mixed with earlier planets' races (you've seen them).
  // A race's toughness still ramps with the normal tier system, so each race has tiers.
  // niche = which weapon class hard-counters this race (the per-planet rock-paper-scissors):
  //   "swarm" → rapid-fire (Mortar/Laser get vsSwarm); "armor" → heavy hits (Plasma/Railgun/Nova get vsBig);
  //   "balanced" → no class bonus (raw DPS / the all-rounder Turret). EVERY race is tagged so no world
  //   silently defaults to "anti-armor" via the toughness-tier fallback (which only covers plain/elite dots now).
  const RACES = [
    null,
    { p: 1,  key: "swift",     name: "Vesta Motes",      niche: "swarm",    hp: 0.55, val: 1.7, weight: 1.0, speed: 3.0 },                    // fast, fragile, pays extra
    { p: 2,  key: "zigzag",    name: "Ember Sparks",     niche: "swarm",    hp: 0.7,  val: 1.5, weight: 1.0, speed: 2.2, zig: 1 },            // erratic, jukes around
    { p: 3,  key: "splitter",  name: "Cinder Brood",     niche: "swarm",    hp: 1.1,  val: 1.0, weight: 1.0, splits: 2, maxGen: 3 },          // splits into many fragments → clear the flood
    { p: 4,  key: "grower",    name: "Hearth Bloat",     niche: "swarm",    hp: 1.2,  val: 1.3, weight: 0.9, grow: 1 },                       // swells over time → clear fast before it bloats
    { p: 5,  key: "shield",    name: "Azure Bastion",    niche: "armor",    hp: 1.0,  val: 1.5, weight: 0.9, shield: 0.7, reflect: 0.3 },     // front shield soaks/reflects → punch through
    { p: 6,  key: "healer",    name: "Verdant Mender",   niche: "armor",    hp: 1.0,  val: 1.6, weight: 0.8, regen: 0.018, healAura: 1 },      // heals → out-burst the regen
    { p: 7,  key: "orbiter",   name: "Cobalt Sentinel",  niche: "armor",    hp: 1.3,  val: 1.5, weight: 0.8, sat: 3, satGuard: 1 },           // guarded core → heavy hits
    { p: 8,  key: "flock",     name: "Mistral Gale",     niche: "swarm",    hp: 0.7,  val: 1.4, weight: 1.0, speed: 1.7, flock: 1 },          // flocks together (boids)
    { p: 9,  key: "cloak",     name: "Halcyon Mirage",   niche: "swarm",    hp: 1.0,  val: 1.9, weight: 0.8, cloak: 1 },                      // evasive → rapid fire catches its visible windows
    { p: 10, key: "pulsar",    name: "Tempest Cell",     niche: "armor",    hp: 1.5,  val: 1.7, weight: 0.7, pulse: 1, shock: 1 },            // tanky disruptor → heavy hits
    { p: 11, key: "phantom",   name: "Umbral Shade",     niche: "swarm",    hp: 1.2,  val: 2.0, weight: 0.7, phase: 1 },                      // phases out → rapid fire to land hits between phases
    { p: 12, key: "juggernaut",name: "Frost Glacian",    niche: "armor",    hp: 1.9,  val: 1.8, weight: 0.7, speed: 0.7, armorUp: 1 },        // heavy tank that regrows armor
    { p: 13, key: "reflector", name: "Onyx Warden",      niche: "armor",    hp: 1.4,  val: 1.9, weight: 0.7, deflect: 0.45 },                 // deflects a share of every shot → fewer, bigger hits
    { p: 14, key: "blink",     name: "Wraith",           niche: "swarm",    hp: 1.1,  val: 2.2, weight: 0.7, blink: 1 },                      // teleports → rapid fire to catch it
    { p: 15, key: "bomber",    name: "Pyreling",         niche: "balanced", hp: 1.3,  val: 1.8, weight: 0.7, bomb: 1 },                       // loot-scatter gimmick, no damage-type weakness
    { p: 16, key: "gravity",   name: "Abyssal Pull",     niche: "armor",    hp: 1.6,  val: 2.0, weight: 0.7, gravity: 1 },                    // tanky loot-dragger → heavy hits
    { p: 17, key: "leech",     name: "Devourer",         niche: "armor",    hp: 1.5,  val: 1.9, weight: 0.7, leech: 1 },                      // heals off loot → out-burst it
    { p: 18, key: "spawner",   name: "Null Spawn",       niche: "swarm",    hp: 2.0,  val: 2.2, weight: 0.6, spawner: 1 },                    // floods minions → clear the swarm
  ];
  const raceAt = g => RACES[Math.min(Math.max(g, 1), RACES.length - 1)];
  // PER-PLANET DOT SIGNATURE — every world's dots get a distinct silhouette (polygon sides),
  // grayscale shade and centre glyph, so they read differently planet-to-planet (no 6-planet
  // repeat). sides 0 = circle. glyph: 0 none·1 ring·2 dot·3 cross·4 bars·5 bar·6 tri·7 square·8 X·9 diamond.
  const DOT_LOOK = [null,
    { s: 0, sh: 60, g: 0, r: 0 },                 // 1  Vesta — plain mote
    { s: 3, sh: 73, g: 2, r: -Math.PI / 2 },      // 2  Ember — up-triangle, cored
    { s: 4, sh: 50, g: 1, r: Math.PI / 4 },       // 3  Cinder — diamond, ringed
    { s: 6, sh: 82, g: 4, r: 0 },                 // 4  Hearth — bright hex, barred
    { s: 5, sh: 46, g: 3, r: -Math.PI / 2 },      // 5  Azure — pentagon, crossed
    { s: 0, sh: 88, g: 5, r: 0 },                 // 6  Verdant — bright circle, slit
    { s: 8, sh: 56, g: 1, r: 0 },                 // 7  Cobalt — octagon, ringed
    { s: 3, sh: 77, g: 6, r: Math.PI / 2 },       // 8  Mistral — down-triangle
    { s: 6, sh: 42, g: 2, r: Math.PI / 6 },       // 9  Halcyon — dim hex, cored
    { s: 4, sh: 84, g: 7, r: 0 },                 // 10 Tempest — square, boxed
    { s: 5, sh: 39, g: 3, r: Math.PI / 5 },       // 11 Umbra — dark pentagon
    { s: 6, sh: 68, g: 8, r: 0 },                 // 12 Frost — hex, X
    { s: 8, sh: 35, g: 4, r: Math.PI / 8 },       // 13 Onyx — dark octagon, barred
    { s: 3, sh: 75, g: 9, r: -Math.PI / 2 },      // 14 Wraith — triangle, diamond core
    { s: 7, sh: 52, g: 2, r: 0 },                 // 15 Pyre — heptagon
    { s: 4, sh: 33, g: 8, r: Math.PI / 4 },       // 16 Abyss — dark diamond, X
    { s: 9, sh: 63, g: 1, r: 0 },                 // 17 Maw — nonagon, ringed
    { s: 5, sh: 31, g: 9, r: Math.PI / 10 },      // 18 Oblivion — darkest pentagon
  ];
  const dotLook = g => DOT_LOOK[Math.min(Math.max(g | 0, 1), DOT_LOOK.length - 1)] || DOT_LOOK[1];
  // trace a regular-polygon (or circle) body path of radius r
  function dotBodyPath(c, x, y, r, sides, rot) {
    c.beginPath();
    if (sides < 3) { c.arc(x, y, r, 0, TAU); return; }
    for (let k = 0; k < sides; k++) { const a = rot + k / sides * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
  }
  // draw the per-planet centre glyph (cut into the body in black so it reads on any shade)
  function dotGlyph(c, x, y, r, gly) {
    if (!gly || r < 4) return; const u = r * 0.42; c.strokeStyle = "#000"; c.fillStyle = "#000"; c.lineWidth = Math.max(1, r * 0.13);
    if (gly === 1) { c.beginPath(); c.arc(x, y, u, 0, TAU); c.stroke(); }
    else if (gly === 2) { c.beginPath(); c.arc(x, y, u * 0.7, 0, TAU); c.fill(); }
    else if (gly === 3) { c.beginPath(); c.moveTo(x - u, y); c.lineTo(x + u, y); c.moveTo(x, y - u); c.lineTo(x, y + u); c.stroke(); }
    else if (gly === 4) { c.beginPath(); c.moveTo(x - u, y - u * 0.45); c.lineTo(x + u, y - u * 0.45); c.moveTo(x - u, y + u * 0.45); c.lineTo(x + u, y + u * 0.45); c.stroke(); }
    else if (gly === 5) { c.beginPath(); c.moveTo(x, y - u); c.lineTo(x, y + u); c.stroke(); }
    else if (gly === 6) { c.beginPath(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k / 3 * TAU; k ? c.lineTo(x + Math.cos(a) * u, y + Math.sin(a) * u) : c.moveTo(x + Math.cos(a) * u, y + Math.sin(a) * u); } c.closePath(); c.fill(); }
    else if (gly === 7) { c.fillRect(x - u * 0.75, y - u * 0.75, u * 1.5, u * 1.5); }
    else if (gly === 8) { c.beginPath(); c.moveTo(x - u, y - u); c.lineTo(x + u, y + u); c.moveTo(x + u, y - u); c.lineTo(x - u, y + u); c.stroke(); }
    else if (gly === 9) { c.beginPath(); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU, px = x + Math.cos(a) * u, py = y + Math.sin(a) * u; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); }
  }
  const RACE_FX = {
    swift: "fast & fragile, pays extra", zigzag: "jukes around erratically", splitter: "splits again and again",
    grower: "swells bigger & richer the longer it lives", shield: "front shield soaks & reflects shots",
    healer: "heals itself and nearby dots", orbiter: "orbiting satellites shield its core", flock: "swarms together in a flock",
    cloak: "cloaks invisible & untargetable in bursts", pulsar: "shock rings shove your collectors away",
    phantom: "phases out, dodging most damage", juggernaut: "slow tank that regrows its armor",
    reflector: "mirror facets deflect a share of shots", blink: "teleports around to dodge fire",
    bomber: "detonates on death, scattering your loot", gravity: "drags loot orbs away from your collectors",
    leech: "devours loot orbs and heals from them", spawner: "endlessly births minion dots",
  };
  // per-race recommended counter, shown on the planet card so the rock-paper-scissors is legible
  const NICHE_HINT = {
    swarm:    "weak to RAPID FIRE — Mortar & Laser shred them",
    armor:    "weak to HEAVY HITS — Plasma, Railgun & Nova punch through",
    balanced: "no damage-type weakness — bring raw firepower (Turret holds up)",
  };
  const raceNiche = g => (raceAt(g) || {}).niche || "balanced";
  const kindChance = g => Math.min(0.14 + 0.05 * (g - 1), 0.6);
  // ── MINI-BOSSES: one elite per planet, unique name & seeded design, every ~5 min of active play ──
  const WARDEN_TTK = 26;       // v18.24: the duel length a warden is calibrated to, in seconds of YOUR real damage output (× its own dur dial); the 60s escape clock leaves headroom for drawing, abilities and mistakes
  const BOSS_INTERVAL = 240;   // seconds of active (boss-free) play between bosses (was 600 — too rare to register in a 12–24h campaign)
  // Boss drop odds live on the BOUNTY WHEEL now (v15.0, see const Wheel): ~48% one named skill node
  // (three slices, each a different top reachable node), ~50% cash tiers (×2/×3/×10 of the bounty),
  // exactly 2% ◈ GEM (owner call — kept super low; a full run kills thousands of bosses).
  const BOSS_NAMES = ["Dustmaw", "Arcfiend", "Slagtitan", "Cinderlord", "Tidewretch", "Sporemother", "Cobalt Sentinel", "Galereaver", "Glimmertyrant", "Voltaic Colossus", "Umbral Dread", "Rimewarden", "Shardbreaker", "Wispcaller", "Ashen Behemoth", "Voidstone Idol", "Bilewurm", "The Null King"];
  const bossName = g => BOSS_NAMES[Math.min(Math.max(g, 1), 18) - 1] || "Boss";
  // v18.24 A BESPOKE WARDEN PER WORLD (owner: "should be a new boss with new abilities for each end
  // of planet"). Every seam is guarded by the APEX specimen of that world's own native race — the
  // same mechanics its fauna spent the whole planet teaching you, amplified and re-mixed, so each
  // end-of-planet duel is a different fight testing a different skill. The kits reuse the shipped
  // dot-mechanic flags (all handled generically in update/render, bosses included), so none of this
  // is bespoke physics — it's a genuinely different creature each time, with its own silhouette.
  // `dur` is a DURATION dial (× the ~26s target), not a raw-HP number: a warden's pool is calibrated
  // 1.2s into the duel against the damage you are ACTUALLY landing (see WARDEN_TTK), so a duel lasts
  // the same felt length whether you arrive with four turrets or a keystoned late-game rack. Nastier
  // kits get a slightly longer fight — more time exposed to what they do.
  // `add` = seconds between escort waves (0 = none — the kit itself is the pressure).
  // P2/P3 run a lower dial than their depth suggests: with a thin early rack, a juking target and a
  // brood competing for turret attention swing the measured duel by ±10s, so they get headroom under
  // the 60s clock rather than sitting on the edge of it (see the warden-gauntlet medians).
  const WARDENS = [null,
    { n: "DUSTMAW MATRIARCH",  tell: "fast and honest — simply out-damage it",                 dur: 1.5,  add: 8,      kit: {} },
    { n: "ARC SHRIKE",         tell: "jukes constantly — your finger tracks it better than turrets", dur: 1.15, add: 7, kit: { zig: 1 } },
    { n: "SLAG BROODMOTHER",   tell: "floods the pit with brood — clear the adds or drown",    dur: 1.1,  add: 0,      kit: { spawner: 1 } },   // brood IS its kit: no separate escort waves on top
    { n: "BLOAT SOVEREIGN",    tell: "swells the longer it lives — burst it down early",       dur: 1.3,  add: 7, kit: { grow: 1, regen: 0.006 } },
    { n: "AZURE BULWARK",      tell: "a reflecting barrier — break the shield before the body", dur: 1.2, add: 8,     kit: { shield: 0.6, reflect: 0.25 } },
    { n: "THE ARCHMENDER",     tell: "heals itself and its brood — you must out-damage the regen", dur: 1.2, add: 4,   kit: { regen: 0.008, healAura: 1 } },
    { n: "SENTINEL PRIME",     tell: "satellites eat your shots — strip them with heavy hits", dur: 1.25, add: 8,     kit: { sat: 4, satGuard: 1 } },
    { n: "GALEREAVER",         tell: "shockwaves scatter your collectors — keep the loot moving", dur: 1.4, add: 7,  kit: { pulse: 1, shock: 1 } },
    { n: "HALCYON PHANTASM",   tell: "cloaks out of turret targeting — only your finger finds it", dur: 1.3, add: 8,  kit: { cloak: 1 } },
    { n: "VOLTAIC COLOSSUS",   tell: "pulses and re-armours between volleys — never stop hitting", dur: 1.1, add: 6,  kit: { pulse: 1, shock: 1, armorUp: 1 } },
    { n: "UMBRAL DREAD",       tell: "phases out of reality — land damage between phases",     dur: 1.1,  add: 7, kit: { phase: 1 } },
    { n: "RIMEWARDEN",         tell: "regrows armour whenever unhit — sustained fire, not chip", dur: 1.15, add: 8,    kit: { armorUp: 1 } },
    { n: "SHARDBREAKER",       tell: "deflects most shots — fewer, bigger hits get through",   dur: 1.05, add: 7,     kit: { deflect: 0.4 } },
    { n: "WISPCALLER",         tell: "teleports across the pit — rapid fire catches it",       dur: 1.35, add: 5,      kit: { blink: 1 } },
    { n: "ASHEN BEHEMOTH",     tell: "its death throes scatter your loot — collect fast",      dur: 1.3,  add: 7,    kit: { bomb: 1, grow: 1 } },
    { n: "VOIDSTONE IDOL",     tell: "drags everything toward it — your loot included",        dur: 1.15, add: 7,     kit: { gravity: 1, sat: 3, satGuard: 1 } },
    { n: "BILEWURM",           tell: "feeds on loose loot to heal — deny it, collect first",   dur: 1.25, add: 6,     kit: { leech: 1, regen: 0.006 } },
    { n: "THE NULL KING",      tell: "the last seam's keeper — brood and phase at once",       dur: 1.0,  add: 4, kit: { spawner: 1, phase: 1 } },
  ];
  const wardenOf = g => WARDENS[clamp(g | 0, 1, TOTAL_PLANETS)] || WARDENS[1];
  // auto-allocate up to n FREE skill-tree nodes, spread across the classes you currently field (boss reward).
  // Every un-owned node currently REACHABLE across all owned classes, priciest first — depth-priced
  // cost is a direct progression proxy, so the front of this list is always "the node you were saving
  // for". Feeds both the free-node grants and the Bounty Wheel's node slices.
  function nodeCandidates() {
    const owned = [...new Set([...S.units.map(u => u.type), ...S.collectors.map(c => c.type)])];
    const out = [];
    for (const t of owned) {
      const G = buildTree(t), set = S.classNodes[t] || (S.classNodes[t] = {});
      for (const node of Object.values(G.map)) {
        if (node.id === "start" || set[node.id] || !nodeAllocatable(t, node)) continue;
        out.push({ type: t, node, cost: nodeCost(t, node) });
      }
    }
    return out.sort((x, y) => y.cost - x.cost);
  }
  function applyNodePick(p) { (S.classNodes[p.type] || (S.classNodes[p.type] = {}))[p.node.id] = true; recompute(); }
  function grantTreeNodes(n) {   // grant the priciest reachable node(s); near-ties break randomly so one class can't hog every drop
    const grants = []; let guard = 0;
    while (grants.length < n && guard++ < 80) {
      const cands = nodeCandidates(); if (!cands.length) break;
      const ties = cands.filter(c => c.cost >= cands[0].cost * 0.999);
      const pick = ties[(Math.random() * ties.length) | 0];
      applyNodePick(pick); grants.push(pick);
    }
    return grants;
  }
  // v18.21 WARDEN LIFECYCLE (owner: "the go to new world / summon boss / building buttons don't flow
  // chronologically and cheat around things"): the duel is per-planet, live-only state. ONE reset
  // point, called on every world change and on ascension, so a duel can never leak onto another
  // world (a leaked wardenOn kept the next conquest from ever settling — no panel, endless spawns).
  function wardenReset() {
    if (wardenOn) for (const d of dots) if (d.warden) d.dead = true;
    wardenOn = false; wardenClear = false;
    if (conqCardT > 0) conqCineEnd();   // v18.34/v18.38: a pending report dies with the world it belongs to — and the cinematic hands back the camera, veil and letterbox on the way out
    if (conqCardVic) { conqCardVic = false; Cards.push("victory", showVictory); }   // …but victory is the RUN's, not the world's — never drop it just because the beat was interrupted
    mineBuildT = -1; mineBuildStage = 0; minePendingBuild = false;   // v18.36: leaving mid-build lands you on a finished mine, never a half-built one
  }
  function summonWarden() {
    // v18.40: the keeper is the world's LAST STAND, not a post-conquest side quest. It can only be
    // called once the conquer bar is full, and the planet is not yours until it falls.
    if (!barFull() || planetMeta(S.galaxy).conquered || wardenOn || S.travel || state !== "play") return false;
    wardenOn = true; bossAcc = 0;
    spawnBoss(true);
    { const Wd = wardenOf(S.galaxy);
      floatTxt(W / 2, H / 2 - 40, "▲ " + Wd.n + " HOLDS " + galName(S.galaxy).toUpperCase());
      floatTxt(W / 2, H / 2 - 16, Wd.tell);
      floatTxt(W / 2, H / 2 + 8, "kill it in 60s and the world is yours — its hoard founds the ◈ mine"); }
    syncHUD(); return true;
  }
  function spawnBoss(warden) {
    const g = S.galaxy, vm = derived.valueMul, base = 18 * Math.pow(vm, 1.3);
    const W_ = warden ? wardenOf(g) : null;                                   // v18.24: this world's bespoke seam-keeper
    let dps = 0; for (const u of S.units) dps += uDmg(u) * DEF_TYPES[u.type].rate * cls(u.type).rate;   // size HP to your real firepower → a ~minute+ fight, scales with you
    const wm = W_ ? W_.dur : 1;   // duration dial — the real pool is calibrated to your measured output 1.2s in
    const hp = warden ? Math.max(base * 20 * wm, dps * 30 * wm) * 4 : Math.max(base * 20, dps * 30);   // wardens open with an oversized PROVISIONAL pool — it exists only to survive the 1→3s measurement window, then the calibration above sets the real one   // one honest HP pool, no shield — a full rack alone clears it in ~30s of the 60s window; finger-drawing (x2 damage) seals it far faster and a miss still pays salvage. A WARDEN scales that by its own kit's multiplier
    const r = clamp(40 + Math.log10(hp + 10) * 2.4, 42, 60);
    // BOSS DROP RIDES YOUR PROGRESS (v14.7, owner call): the bounty is floored at 20 seconds of your
    // LIVE income/s — a kill pays 3× value (2× instant lump + 1× in dropped orbs) ≈ a full MINUTE of
    // income no matter how far your economy has scaled (spawn rate, value, units, planet — everything
    // cps captures). Early on, before cps exists, the eco-based floor keeps it phat. Mirrors how boss
    // HP rides your dps. Escape salvage rides value too, so a near-miss also stays worth the fight.
    const val = Math.max(1, Math.round(eco(g) * vm * derived.incomeMul * 320), Math.round((cps || 0) * 20));
    // each planet's boss gets its OWN seeded movement personality (not the lazy drift-to-centre)
    const mh = Math.imul((g + 13) * 2654435761, 40503) >>> 0, mr = k => ((mh >>> (k * 4)) & 15) / 15;
    const styles = ["lissajous", "orbit", "charge", "pace", "prowl", "dash"];
    const d = { x: wCX(), y: wCY(), vx: rnd(-18, 18), vy: rnd(-8, 8), hp, maxHp: hp, value: val, value0: val,   // v18.11: anchor at midfield — the patrol personalities orbit THIS point, and H*0.3 kept bosses hugging the top out of easy reach
      r, r0: r, tier: 6, spin: Math.random() * TAU, special: false, armored: true, kind: "boss", boss: true, warden: warden ? 1 : 0, bg: g, life: 0, ttl: 60,
      shieldMax: 0, shield: 0, armorUp: 0, regen: 0.012, add: 0,   // shield REMOVED (owner call) — the fight is one honest HP bar
      mstyle: styles[Math.floor(mr(0) * styles.length)], mt: 0, mphase: mr(1) * TAU, mfx: 0.5 + mr(2) * 0.9, mfy: 0.45 + mr(3) * 0.9, mdir: mr(4) < 0.5 ? -1 : 1, mrad: 95 + mr(5) * 75, mtimer: 0, mtx: wCX(), mty: wCY(), mdash: false,
      weight: 5, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#ffffff" };
    if (W_) {   // v18.24: bolt on this world's warden kit — same init semantics spawnDot uses, so every
      const k = W_.kit;                                              // mechanic behaves exactly as its fauna taught you
      d.wname = W_.n; d.mstyle = W_.m || d.mstyle; d.addEvery = W_.add; d.wdur = W_.dur; d.calib = 1;
      d.mstyle = "orbit"; d.mrad = 46 + (g % 5) * 6; d.mdir = (g % 2) ? 1 : -1;
      // A WARDEN HOLDS THE SEAM. The roaming boss personalities are built for the wandering
      // mini-boss, where escaping is a fine outcome — but on a GATE they made the duel a dice
      // roll: measured back-to-back, the same warden died in 6s on one attempt and escaped the
      // full 60s on the next, purely on whether it drifted inside a thin early rack's range.
      // It now circles the pit head at close range, so the fight is decided by your damage.
      if (k.shield) { d.shieldMax = hp * k.shield; d.shield = d.shieldMax; d.reflect = k.reflect || 0; }
      if (k.regen) d.regen = k.regen;
      if (k.healAura) d.healAura = 0;
      if (k.sat) { d.sat = k.sat; if (k.satGuard) { d.satGuard = 1; d.satAcc = 0; } }
      if (k.pulse) { d.pulse = 0; if (k.shock) d.shock = 1; }
      if (k.phase) { d.phase = 0; d.phased = false; }
      if (k.zig) d.zig = 0;
      if (k.grow) { d.grow = 0; d.growCap = 0.35; }   // a bloating warden is a wider target, and width feeds every splash/pierce hit — cap the swell or it kills itself
      if (k.cloak) { d.cloak = Math.random() * 3; d.cloaked = false; d.cloakOn = 0.6; d.cloakPeriod = 3.2; }   // ~19% untargetable, not 33%
      if (k.armorUp) { d.armorUp = 0; d.shieldMax = hp * 0.3; d.shield = 0; d.armorRate = 0.10; }   // a warden's plating tops out at +30% of the pool (its fauna doubles) and regrows half as fast — texture, not a second health bar
      if (k.deflect) d.deflect = k.deflect;
      if (k.blink) d.blink = Math.random();
      if (k.bomb) d.bomb = 1;
      if (k.gravity) d.gravity = 1;
      if (k.leech) { d.leech = 1; d.leechHeal = 0.008; }   // 0.8% per swallowed orb, not its fauna's 4% — still a race for the loot, not an unkillable sponge in a field full of it
      if (k.spawner) { d.spawner = 0; d.spawnEvery = 7; d.spawnFrac = 0.035; }   // brood at 5% of the keeper's pool every 5.5s: real pressure on your turrets' attention, not an unkillable damage sponge (fauna spawn 18% every 3.8s)
    }
    dots.push(d);
    floatTxt(W / 2, H / 2 - 70, warden ? "⛏ " + W_.n + " ⛏" : "▲ " + bossName(g) + " ▲"); flashAdd(0.55); shakeAdd(9);
  }
  // boss movement with personality — each style roams the upper field very differently
  function bossMove(d, dt) {
    d.mt += dt; const t = d.mt;
    // v18.26: patrol the DISC — the old box let personalities drift into the void corners
    const cx = wCX(), cy = wCY(), px = viewHW() * 0.80, py = viewHH() * 0.80;   // the VISIBLE field — a boss that patrolled the whole map would spend half the duel off-screen
    const L = cx - px, R = cx + px, T = cy - py, B = cy + py;
    if (d.mstyle === "lissajous") {                                   // graceful serpentine figure-weave
      const tx = cx + Math.sin(t * d.mfx + d.mphase) * (R - L) / 2 * 0.86, ty = cy + Math.sin(t * d.mfy * 1.4) * (B - T) / 2 * 0.82;
      d.x += (tx - d.x) * Math.min(1, dt * 1.7); d.y += (ty - d.y) * Math.min(1, dt * 1.7);
    } else if (d.mstyle === "orbit") {                                // territorial guardian, circling
      const a = t * 0.55 * d.mdir + d.mphase, tx = cx + Math.cos(a) * d.mrad, ty = cy + Math.sin(a) * d.mrad * 0.6;
      d.x += (tx - d.x) * Math.min(1, dt * 2.3); d.y += (ty - d.y) * Math.min(1, dt * 2.3);
    } else if (d.mstyle === "charge") {                               // aggressive bruiser: lunges, recoils, repicks
      d.mtimer -= dt; if (d.mtimer <= 0) { d.mtx = rnd(L, R); d.mty = rnd(T, B); d.mtimer = rnd(1.1, 2.1); burst(d.x, d.y, 5, 50, 1.2); }
      d.vx = (d.vx || 0) * 0.9 + (d.mtx - d.x) * 0.07; d.vy = (d.vy || 0) * 0.9 + (d.mty - d.y) * 0.07;
      const sp = Math.hypot(d.vx, d.vy); if (sp > 280) { d.vx *= 280 / sp; d.vy *= 280 / sp; } d.x += d.vx * dt; d.y += d.vy * dt;
    } else if (d.mstyle === "pace") {                                 // pacing sentinel along the top, bobbing
      const tx = cx + Math.sin(t * 0.9 * d.mdir + d.mphase) * (R - L) / 2 * 0.92, ty = T + 38 + Math.abs(Math.sin(t * 2)) * 34;
      d.x += (tx - d.x) * Math.min(1, dt * 3); d.y += (ty - d.y) * Math.min(1, dt * 2.4);
    } else if (d.mstyle === "prowl") {                                // erratic predator: sudden bursts & turns
      d.mtimer -= dt; if (d.mtimer <= 0) { const a = Math.random() * TAU, sp = rnd(70, 175); d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp; d.mtimer = rnd(0.5, 1.4); }
      d.x += (d.vx || 0) * dt; d.y += (d.vy || 0) * dt; if (d.x < L || d.x > R) d.vx *= -1; if (d.y < T || d.y > B) d.vy *= -1;
    } else {                                                          // dash: twitchy — holds, then darts to a new spot
      d.mtimer -= dt;
      if (d.mdash) { const dx = d.mtx - d.x, dy = d.mty - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < 12 || d.mtimer <= 0) { d.mdash = false; d.mtimer = rnd(0.8, 1.7); burst(d.x, d.y, 9, 90, 1.7); ring(d.x, d.y, d.r, d.r + 34, 0.3); } else { const step = Math.min(dl, 560 * dt); d.x += dx / dl * step; d.y += dy / dl * step; } }
      else if (d.mtimer <= 0) { d.mdash = true; d.mtx = rnd(L, R); d.mty = rnd(T, B); d.mtimer = 0.7; }
    }
    d.x = clamp(d.x, L, R); d.y = clamp(d.y, T, B);
  }
  function spawnDot(special, fromTop) {   // fromTop (v18.8): Dot Rain falls from the SKY edge, not all four
    const g = S.galaxy, vscale = Math.pow(derived.valueMul, 1.3), base = 18 * enemyHpMul(g) * vscale;   // HP scales SUPER-linearly with Value — Value genuinely & heavily toughens enemies; cash is unaffected (it keys off hp/avg, where base cancels)
    // v18.0 MENACE rides the CONQUER BAR: every world starts readable and grows monstrous as its
    // conquest advances — per-planet escalation with zero bookkeeping (the bar IS the state).
    // Conquered worlds settle at a spicy-but-farmable 2.0.
    const pmSpawn = S.vault && S.vault[S.galaxy];
    // v18.13/v18.14 ARRIVAL FLOOR (owner: "when I join a new planet the units should be few and
    // tough… I spawn in and crush them quickly"): the bar-driven ramp used to reset menace to ZERO
    // on every fresh world, so a deep army's opening minutes were a massacre. Every world past P1 now
    // opens with a real menace floor (P2 0.8 · P4 1.3 · P8+ 2.2) — arrival dots are genuinely tanky
    // from the first spawn. P1 stays 0: the cold open is tuned to the gram and stays readable.
    const prog = clamp(curEarned / Math.max(1, conquerTarget(S.galaxy)), 0, 1);
    const menFloor = S.galaxy <= 1 ? 0 : Math.min(2.2, 0.8 + 0.25 * (S.galaxy - 2));
    const men = (pmSpawn && pmSpawn.conquered) ? 2.0 : Math.max(menFloor, 3.5 * Math.pow(prog, 0.7));
    const men01 = Math.min(1, men);               // 0..1 gate — keeps dots BASIC until Value is invested
    // v18.2 MENACE IS DIFFICULTY, NOT PAYDAY (owner catch: "P1 paid 50k/s, the new planet pays way
    // less — better to stick to the previous planet, which should never be"): the payout divisor used
    // to be a FIXED base×1.3, so a conquered world's fat menace-2.0 field (rolls avg ~5.9, +elites)
    // paid ~×9 per dot on TOUGH_POW while a fresh frontier's soft field paid ×0.5 — farm-backwards
    // beat the ×1.5 eco step outright. The divisor is now the EXPECTED toughness of the CURRENT field
    // (plain-roll mean × the armored/exotic mix expectation), so menace/mix cancel out of the average
    // payout everywhere and only eco(g) decides where the money is — the frontier always pays more.
    // Within a field nothing changes: tougher-than-average dots still pay superlinearly (triage food).
    // The divisor is the TOUGH_POW-power-mean of the field's toughness distribution — not the plain
    // mean: val^1.45 is convex, and a conquered world's bimodal mix (21% elites at ×28) would keep a
    // ×1.7 Jensen premium over a fresh field under a linear mean (measured: retreat still paid ×1.18).
    // With the power mean, E[payout] = eco×vMul at EVERY menace level by construction.
    const pArmE = Math.min(1, armorChance(g) * men01 + men * 0.08);
    const pKindE = Math.min(1, (1 - pArmE) * (kindChance(g) * men01 + men * 0.06));
    const eCfgHp = (RACES[Math.min(g, RACES.length - 1)] || { hp: 1 }).hp;   // native race dominates the exotic pick (72%)
    const TP1 = 1 + TOUGH_POW, eU = (a, b) => (Math.pow(b, TP1) - Math.pow(a, TP1)) / (TP1 * (b - a));   // E[u^TOUGH_POW], u ~ uniform(a,b)
    const eMixTP = eU(0.7, 1.0 + men * 5.0) * (1 - pArmE - pKindE + pArmE * eU(7, 12) * Math.pow(1 + men, TOUGH_POW) + pKindE * Math.pow(eCfgHp, TOUGH_POW));
    const avg = base * Math.pow(eMixTP, 1 / TOUGH_POW);
    let roll = rnd(0.7, 1.0 + men * 5.0), armored = false, kind = "normal", cfg = null, mv = 20;
    // difficulty & craziness are bought with VALUE: at Value 0 every dot is the
    // plainest tier-0 grey. armored elites & exotic kinds only appear once you invest.
    if (Math.random() < armorChance(g) * men01 + men * 0.08) { armored = true; roll *= rnd(7, 12) * (1 + men); mv = 9; }   // super-advanced elite: LOTS of health
    else if (Math.random() < kindChance(g) * men01 + men * 0.06) {
      // mostly THIS planet's native race, sometimes an earlier planet's race (variety)
      const gi = Math.min(g, RACES.length - 1);
      cfg = (Math.random() < 0.72 || gi <= 1) ? RACES[gi] : RACES[1 + Math.floor(Math.random() * gi)];
      kind = cfg.key;
    }
    if (cfg) { roll *= cfg.hp; if (cfg.speed) mv *= cfg.speed; }
    const hp = base * roll * (derived.spawnMenace || 1);   // surplus Spawn Rate (past the field cap) makes every dot tougher & richer
    special = special || (!armored && !cfg && Math.random() < derived.luck);
    // v18.14 FEW, TOUGH, RICH (owner: "the new planet needs to drop serious money — more than the
    // previous planet, even with poor economy"): fieldMul thins the arrival spawn stream to ×0.35
    // (ramping to ×1 as the bar fills — "you make them more and tougher"), and each dot's cash
    // scales by 1/fieldMul so $/s stays on curve while arrival chunks land ~×3 fatter. On top, the
    // FRONTIER PREMIUM pays +8% per point of menace — tough fields are worth real extra money now,
    // and since settled worlds spawn nothing (v18.6) there is no old planet to farm it on: the
    // premium only ever rewards pushing the CURRENT bar, which active play does fastest (idle
    // bar-fill is capped at IDLE_FRAC). Arrival floor menace also rides it, so a fresh deep world
    // out-pays the one behind it from the very first kill.
    // (P1 is exempt from the thinning: its menace floor is 0, so a thinned-but-soft P1 field would pay
    // ~×2.9 in the dps-limited cold open. From P2 on the raised floor makes thin+tough+rich ≈ neutral
    // in BOTH regimes: spawn-limited 0.35×2.86≈×1, dps-limited (2.86 pay)/(≈×3 HP inflow)≈×1.)
    const fieldMul = (g <= 1 || (pmSpawn && pmSpawn.conquered)) ? 1 : 0.35 + 0.65 * prog;
    const frontierPay = ((pmSpawn && pmSpawn.conquered) ? 1 : 1 + 0.08 * men) / fieldMul;
    const val = Math.max(1, Math.round(eco(g) * derived.valueMul * derived.incomeMul * frontierPay * Math.pow(hp / avg, TOUGH_POW) * (special ? 9 : 1) * (cfg ? cfg.val : 1)));
    const r = clamp(7 + Math.log10(hp + 10) * 2.6, kind === "swift" || kind === "flock" ? 6 : 7, armored ? 40 : 24);
    // visual tier: the tougher the dot, the more elaborate (spikes/rings)
    const tier = roll < 1.0 ? 0 : roll < 1.5 ? 1 : roll < 2.2 ? 2 : roll < 4 ? 3 : roll < 6 ? 4 : roll < 9 ? 5 : 6;
    // WAVE STYLE: enter from the perimeter and drift toward the centre. v17.8: spawns SNAP (with
    // jitter) to this planet's rim features, so dots visibly crawl out of the craters / trees /
    // rifts that dress the world's edge — the terrain is where the fauna actually comes from.
    // v18.26 SPAWN ON THE RIM: the world is a disc, so fauna crawls in from its circumference — the
    // spawn angle snaps to a real rim FEATURE (with jitter) exactly as it used to snap to the edge
    // terrain, so dots still visibly emerge from the craters / vents / reefs that dress the horizon.
    let ex, ey;
    if (fromTop) {   // Dot Rain falls INTO the bowl — spread over the disc, not piled on one line
      ex = wCX() + rnd(-1, 1) * viewHW() * 0.94; ey = wCY() + rnd(-1, 1) * viewHH() * 0.94;
    } else {
      // v18.46 (owner: "dots are spawning dependent on how zoomed in I am, not the actual size of the
      // map"): this used to read liveHW/liveHH — SW/2/camZoom — so the spawn ring WAS the zoom. Pinching
      // out doubled the radius dots came in from, which quietly made zoom a difficulty lever and put the
      // fauna OUTSIDE the rim drawn for them (the rim, Dot Rain, the boss patrol and the mine rig all
      // use the fixed viewHW/viewHH). The ring is now that same fixed size — the map's own — so zooming
      // changes only how much of the approach you can watch, never where anything comes from.
      // v18.48 (owner, with a screenshot: "the spawning of dots is fixed to a smaller rectangle and I
      // can still zoom out further — should be spawning at the actual edges"). v18.46 correctly stopped
      // the ring riding camZoom, but anchored it to viewHW/viewHH — the screen at NORMAL zoom — which is
      // only 1/ZOOM_OUT of what a pinch actually reveals. Measured: dots came in over 47% of the map's
      // width, using 25% of its AREA, so three quarters of the world you can see was permanently dead
      // space. The ring is now the widest extent you can actually see (view / ZOOM_OUT). Still fixed,
      // still nothing to do with the current camera — just the right fixed size. MAP_PAD is deliberately
      // left OUT: the map's hard bounds sit 6% further again so nothing spawns on the clamp line.
      const vhw = spawnHW(), vhh = spawnHH(), bp = perim(Math.random(), vhw, vhh);
      const inset = rnd(0.01, 0.07) * Math.min(vhw, vhh);
      const p2 = { x: bp.x + bp.nx * inset, y: bp.y + bp.ny * inset };
      ex = p2.x; ey = p2.y;
    }
    const ia = Math.atan2(wCY() - ey, wCX() - ex) + rnd(-0.55, 0.55), isp = mv * rnd(0.55, 1.0);
    const d = { x: ex, y: ey, vx: Math.cos(ia) * isp, vy: Math.sin(ia) * isp, spd: mv,
      hp, maxHp: hp, value: val, value0: val, r, r0: r, tier, pg: g, menace: roll, spin: Math.random() * TAU, special, armored, kind, weight: armored ? 2.6 : 1, hit: 0, drawCd: 0, refl: 0, born: 0,
      color: armored ? "#9a9a9a" : special ? "#ffffff" : kind !== "normal" ? "#cfcfcf" : `hsl(0,0%,${dotLook(g).sh}%)` };   // per-planet shade (no 6-planet repeat)
    if (cfg) {
      d.niche = cfg.niche;                                       // this race's hard-counter category (drives the vsBig/vsSwarm class bonus in hitDot)
      if (cfg.shield) { d.shieldMax = hp * cfg.shield; d.shield = d.shieldMax; d.reflect = cfg.reflect; }
      if (cfg.regen) d.regen = cfg.regen;
      if (cfg.healAura) d.healAura = 0;
      if (cfg.splits) { d.splits = cfg.splits; d.gen = 0; d.maxGen = cfg.maxGen || 1; }
      if (cfg.sat) { d.sat = cfg.sat; if (cfg.satGuard) { d.satGuard = 1; d.satAcc = 0; } }
      if (cfg.pulse) { d.pulse = 0; if (cfg.shock) d.shock = 1; }
      if (cfg.phase) { d.phase = 0; d.phased = false; }
      if (cfg.zig) d.zig = 0;
      if (cfg.grow) d.grow = 0;
      if (cfg.flock) d.flock = 1;
      if (cfg.cloak) { d.cloak = Math.random() * 3; d.cloaked = false; }
      if (cfg.armorUp) { d.armorUp = 0; d.shieldMax = hp; d.shield = 0; }
      if (cfg.deflect) d.deflect = cfg.deflect;
      if (cfg.blink) d.blink = Math.random();
      if (cfg.bomb) d.bomb = 1;
      if (cfg.gravity) d.gravity = 1;
      if (cfg.leech) d.leech = 1;
      if (cfg.spawner) d.spawner = 0;
    }
    dots.push(d);
  }

  function fireUnit(u, p) {
    // gather every in-range dot. `covered` = lethal damage genuinely IN FLIGHT (mortar shells
    // arcing toward it) — v17.6 fixed this: it used to also count damage that had ALREADY landed
    // (instant beams marked `aimed`/`pending` on resolved hits), so "coordination" made smart units
    // skip wounded-but-alive dots instead of finishing them.
    const rng = uRange(u) ** 2; const cands = [];
    const iq = Math.min(1, uInt(u));   // 0 = dumb (nearest-first spray), ~1 = perfect fire control
    for (const d of dots) {
      if (d.dead || d.cloaked) continue; const q = (d.x - p.x) ** 2 + (d.y - p.y) ** 2; if (q > rng) continue;   // Halcyon Mirage can't be targeted while cloaked
      cands.push({ d, q, covered: (d.aimed || 0) >= d.hp, value: d.value || 0 });
    }
    if (!cands.length) return;
    // v17.6 (owner call: "the game should naturally make more mistakes so Mind becomes more useful"):
    // dumbness is CONTINUOUS. Each volley the unit READS THE FIELD with probability = ◈ Mind — or
    // just sprays at whatever's nearest, doomed or not, exactly like its dumb neighbours. Reading earns:
    //   · doomed targets (lethal shells inbound) drop to the back of the queue and are skipped
    //   · > 40% Mind: value triage — shots go to the richest dot in range (which, per TOUGH_POW,
    //     is also the best-matched target for a big shot — see FIRE DISCIPLINE in hitDot)
    //   · > 50% Mind + splash: cluster-seeking — aim where the blast catches the most total loot
    const reads = Math.random() < iq;
    cands.sort((a, b) => (reads ? (a.covered - b.covered) : 0) ||
      (reads && iq > 0.4 ? (b.value - a.value) : 0) || (a.q - b.q));
    const eaoe = uSplash(u) + (uExplode(u) ? 34 + uExplode(u) * 26 : 0);   // v17.21 audit: triage with the radius the shot actually DETONATES at (explosive keystones included)
    if (eaoe > 0 && uSplash(u) > 0 && reads && iq > 0.5 && cands.length > 2) {
      // sample the NEAREST 24 (the thick of the field), not the richest few — a lone fat elite
      // lagging at the spawn edge must lose to a trash cluster whose combined loot beats it
      const R2 = eaoe * eaoe, top = cands.slice().sort((a, b) => a.q - b.q).slice(0, 24);
      for (const c of top) { c.bv = c.value; for (const o of cands) { if (o !== c && (o.d.x - c.d.x) ** 2 + (o.d.y - c.d.y) ** 2 <= R2) c.bv += o.value; } }
      top.sort((a, b) => (a.covered - b.covered) || (b.bv - a.bv) || (a.q - b.q));   // bv = total ✦ under the blast — cluster-seeking IS value triage for AoE
      for (let i = 0; i < top.length; i++) cands[i] = top[i];
    }
    const shots = 1 + uMulti(u);                            // keystone nodes grant extra simultaneous targets
    const fired = [];
    for (const c of cands) {
      if (fired.length >= shots) break;
      if (c.covered && reads) continue;                     // a reading unit never wastes a volley on a doomed dot
      if (fired.indexOf(c) >= 0) continue;                  // v17.21 audit: the cluster re-rank can leave an object at two indices when >24 candidates — never fire twice at one dot in a volley
      fired.push(c);
    }
    if (!fired.length) fired.push(cands[0]);   // nothing valid to skip onto — fire anyway
    let recoiled = false;
    for (const c of fired) {
      const target = c.d;
      let dmg = uDmg(u), crit = Math.random() < uCrit(u); if (crit) dmg *= uCritMul(u);
      const ddx = target.x - p.x, ddy = target.y - p.y, ddl = Math.hypot(ddx, ddy) || 1;
      if (!recoiled) { u.rx = -ddx / ddl * 4; u.ry = -ddy / ddl * 4; u.aim = Math.atan2(ddy, ddx); u.flash = 0.08; recoiled = true; }   // muzzle recoil + aim + brief flash (toward first target)
      // LOB weapons (mortar) DON'T shoot a straight beam — they fire a high arcing bomb that
      // sails over the field and detonates on landing, blanketing the impact point in splash.
      if (DEF_TYPES[u.type].lob) {
        const explode = uExplode(u), aoe = uSplash(u) + (explode ? 34 + explode * 26 : 0);
        target.aimed = (target.aimed || 0) + dmg;   // claim the target: this damage is genuinely IN FLIGHT (the shell re-marks its claim every frame until it lands — see the units pass in update)
        shells.push({ x0: p.x, y0: p.y, tx: target.x, ty: target.y, t: 0, tref: target,
          dur: clamp(0.34 + ddl / 820, 0.36, 0.78), arc: 30 + Math.min(ddl * 0.18, 90),
          dmg, aoe, crit, type: u.type, color: uColor(u),
          r: 3 + Math.min(Math.log10(uDmg(u) + 1) * 1.1, 5), spin: 0 });
        continue;
      }
      beams.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y, life: crit ? 0.13 : 0.08, color: uColor(u), w: (crit ? 3.5 : 2) + Math.min(Math.log10(uDmg(u) + 1) * 0.5, 3) });   // bolder beams with more damage
      if (crit) burst(target.x, target.y, 5, 90, 2);        // crit pops a little extra
      const explode = uExplode(u), aoe = uSplash(u) + (explode ? 34 + explode * 26 : 0);
      if (aoe > 0) {
        for (const d of dots) if (!d.dead && (d.x - target.x) ** 2 + (d.y - target.y) ** 2 <= aoe * aoe) hitDot(d, dmg, u.type);   // instant damage — resolves right here, so no coordination mark (v17.6: marking resolved damage made `covered` lie)
        if (explode) { ring(target.x, target.y, 4, aoe, 0.2); burst(target.x, target.y, 7, 90, 2); }
      } else hitDot(target, dmg, u.type);
      // ✦ Chain Lightning — arc from the hit dot to nearby dots, fading per jump
      const chain = uChain(u);
      if (chain > 0) {
        let src = target, jumps = chain + 1, cdmg = dmg * 0.6; const seen = new Set([target]);
        while (jumps-- > 0) {
          let best = null, bd = 140 * 140;
          for (const d of dots) { if (d.dead || seen.has(d)) continue; const q = (d.x - src.x) ** 2 + (d.y - src.y) ** 2; if (q < bd) { bd = q; best = d; } }
          if (!best) break;
          beams.push({ x1: src.x, y1: src.y, x2: best.x, y2: best.y, life: 0.1, color: "#fff", w: 2 });
          seen.add(best); hitDot(best, cdmg, u.type); src = best; cdmg *= 0.85;
        }
      }
      // ✦ Piercing Laser — punch a beam through every dot along the line of fire
      const pierce = uPierce(u);
      if (pierce > 0) {
        const nx = ddx / ddl, ny = ddy / ddl, width = 14 + pierce * 8, rngU = uRange(u);
        for (const d of dots) { if (d.dead || d === target) continue;
          const rx = d.x - p.x, ry = d.y - p.y, t = rx * nx + ry * ny; if (t < 0 || t > rngU) continue;
          if (Math.abs(rx * -ny + ry * nx) <= width + d.r) hitDot(d, dmg * 0.85, u.type); }
        beams.push({ x1: p.x, y1: p.y, x2: p.x + nx * rngU, y2: p.y + ny * rngU, life: 0.09, color: "#fff", w: 2.5 });
      }
    }
  }
  // NICHE classification (the per-planet rock-paper-scissors). EVERY native race carries an explicit
  // d.niche ("swarm"/"armor"/"balanced") set at spawn, so the planet's signature race always rewards the
  // right class. Only un-tagged dots — plain greys, armored elites, spawner minions — fall back to the
  // toughness tier (small = swarm, tanky = big). This is what fixes the old "everything defaults to
  // anti-armor" collapse (the tier fallback used to catch all 11 untagged races and skew them big).
  function hitDot(d, dmg, src) {
    if (d.dead) return;
    const ty = DEF_TYPES[src];                                  // class NICHE: anti-armor (vsBig) vs anti-swarm (vsSwarm)
    if (ty) {
      let big = false, swarm = false;
      if (d.niche === "armor") big = true;                      // race-tagged tanky/defensive
      else if (d.niche === "swarm") swarm = true;               // race-tagged fast/many/evasive
      else if (d.niche === "balanced") { /* no class bonus — raw DPS */ }
      else { big = d.armored || (d.tier || 0) >= 3; swarm = !d.armored && (d.tier || 0) <= 1; }   // plain/elite/minion: by toughness
      if (big) dmg *= ty.vsBig; else if (swarm) dmg *= ty.vsSwarm;
    }
    if (d.phased) dmg *= 0.45;                                   // phantom shrugs off most damage while phased
    if (d.deflect && Math.random() < d.deflect) { d.refl = 0.14; return; }   // Onyx mirror facets deflect a share of every shot
    if (d.sat > 0 && d.satGuard) { d.satAcc += dmg; const per = d.maxHp * 0.14; while (d.satAcc >= per && d.sat > 0) { d.satAcc -= per; d.sat--; burst(d.x, d.y, 4, 60, 1.4); } dmg *= 0.4; }   // Cobalt satellites shield the core until stripped
    // v18.50: a WARDEN sizes its real HP pool from what you dealt in a 4s window (see the calibration
    // in the boss branch of update). Finger-draw damage must NOT count toward that: drawing is ×2 vs
    // bosses, so drawing THROUGH the sample told the game you were twice as strong as you sustainably
    // are and it sized the pool to a burst — measured, the bar jumped 4,477 → 8,234 mid-duel and the
    // keeper ended the fight with MORE hp than it started. Drawing is meant to END a duel faster, not
    // lengthen it. Tracked here, where the real applied number is known, shield spill included.
    if (d.calib && src === "draw") d.drawDealt = (d.drawDealt || 0) + dmg;
    if (d.shield > 0) {
      if (Math.random() < d.reflect) { d.refl = 0.14; return; }   // shield reflects the shot
      d.shield -= dmg; d.hit = 0.08;
      if (d.shield > 0) return;                                   // fully absorbed
      dmg = -d.shield; d.shield = 0;                              // overflow spills to hp
    }
    d.hp -= dmg; d.hit = 0.08;
    if (d.hp <= 0) {
      d.dead = true;
      // v18.15 SABER COMBO — a finger kill pays the CURRENT multiplier, then heats the chain
      if (src === "draw") {
        const cm = comboMul;
        if (!d.boss && cm > 1.01) { d.value = Math.max(1, Math.round(d.value * cm));
          if (comboFxT <= 0) { floatTxt(d.x, d.y - d.r - 10, "×" + cm.toFixed(1)); comboFxT = 0.3; } }
        const gain = Math.min(0.16, Math.max(0, 0.55 - comboGain1s));   // v18.16 heat budget — see declaration
        comboMul = Math.min(5, cm + gain); comboGain1s += gain; comboT = 1.6;
        if (gain > 0.001) comboPopT = 0.25;   // v18.20: the meter punches on every real heat gain
      }
      if (d.boss && d.warden) {   // v18.18 the WARDEN's hoard IS the mine price — no wheel, the reward is the build
        // v18.23 (owner: "after the auto boss fight I was offered ANOTHER boss fight or launch —
        // that shouldn't happen"). The kill used to pay the hoard and stop there, leaving the seam
        // unclaimed: the panel kept offering ▲ SUMMON, so a won duel could be re-fought forever for
        // free cash. The hoard now passes STRAIGHT THROUGH into the build — you beat the warden, the
        // mine is founded on the spot (net wallet change zero), the seam is claimed, and the only
        // thing left to do is launch. Losing still re-offers the duel; that's the retry path.
        // v18.40: THIS is the conquest. The keeper falling is what takes the world — the bar only ever
        // bought you the right to try. Its hoard still founds the seam, so the mine comes with the world
        // and can never be bought around; the conquest cinematic opens on the very next beat.
        const amt = mineCost(S.galaxy);
        S.cash += amt; S.totalRun += amt; META.totalEver += amt; earnAcc += amt;   // bypasses the capacity ceiling, exactly like a boss lump — the prize must land in full
        burst(d.x, d.y, 60, 240, 3.4); ring(d.x, d.y, d.r, d.r + 150, 0.7); shakeAdd(9); flashAdd(0.5);
        floatTxt(d.x, d.y - d.r - 12, "▲ " + (d.wname || "SEAM KEEPER") + " DOWN");
        Audio_boss(); const sw = stat(); sw.dotsPopped++; sw.bosses = (sw.bosses || 0) + 1;
        wardenOn = false; wardenClear = true;   // the world re-settles next frame (fauna scatters, loot banks)
        conquerWorld();                         // ✦ the planet is taken FIRST — buildMine only founds a seam on a world you own
        minePendingBuild = buildMine(S.galaxy, true);   // its hoard founds the seam; the site is raised after the report card, not under the film
        recompute(); syncHUD();
        return;
      }
      if (d.boss) {   // a defeated mini-boss → orb burst + a 1× banked floor, then the BOUNTY WHEEL spins for the rest (cash tiers / named skill node / 2% gem)
        const np = 6; for (let i = 0; i < np; i++) { const a = i / np * TAU; orbs.push({ x: d.x + Math.cos(a) * d.r * 0.6, y: d.y + Math.sin(a) * d.r * 0.6, value: Math.round(d.value / np), t: 0, weight: 2, consume: 0, consumeMax: 1.2, r0: 6.5, big: true }); }
        const lump = Math.round(d.value);   // 1× banked instantly — the can't-miss floor (orbs carry another 1×); the wheel decides the bonus on top
        S.cash += lump; S.totalRun += lump; META.totalEver += lump; curEarned += lump; earnAcc += lump;   // bounty bypasses the capacity ceiling so the reward always lands in full (also feeds the live $/s)
        burst(d.x, d.y, 60, 240, 3.4); ring(d.x, d.y, d.r, d.r + 150, 0.7); ring(d.x, d.y, d.r, d.r + 80, 0.5); shakeAdd(9); flashAdd(0.5);
        floatTxt(d.x, d.y - d.r - 12, "✦ " + bossName(d.bg || S.galaxy) + " DEFEATED");
        floatTxt(d.x, d.y - d.r - 30, "+" + curSym(S.galaxy) + " " + fmt(lump + d.value));
        if (!Wheel.show(d.value, bossName(d.bg || S.galaxy))) {   // shell without wheel markup (safety net): legacy 2× lump + recap popup
          const l2 = Math.round(d.value); S.cash += l2; S.totalRun += l2; META.totalEver += l2; curEarned += l2; earnAcc += l2;
          showBossReward(bossName(d.bg || S.galaxy), lump + l2 + d.value, false, false);
        }
        Audio_boss();   // the one field event that earns a real sound
        const sb = stat(); sb.dotsPopped++; sb.bosses = (sb.bosses || 0) + 1; if (src) sb.kills[src] = (sb.kills[src] || 0) + 1;
        recompute(); syncHUD();
        return;
      }
      // v17.6 FIRE DISCIPLINE (owner call: "the game should naturally make more mistakes so Mind
      // becomes more useful"): a killing blow that lands with more force than the dot had left
      // VAPORIZES part of the loot — ramping from 1.5× overshoot up to 30% at 8× — and ◈ Mind is
      // the fire-control stat that keeps it: a calibrated class refunds the burn, and its value
      // triage (rich = tough = well-matched targets, per TOUGH_POW) dodges the overshoot in the
      // first place. This is what makes Mind pay real income in EVERY regime — dots never leave
      // the field, so in melt regimes target choice alone can't move income; wasted force burning
      // loot is the honest cost of dumbness. The gentle 1.5× knee is what reaches the rapid
      // small-hit classes (Turret/Laser/Plasma): their killing blows overshoot modestly but often.
      // ...and PRECISION HARVEST, the dividend side of the same coin: a calibrated class extracts
      // up to +12% more loot from every kill. Rapid small-hit classes (Turret) physically can't
      // overshoot much — their chained shots are well-matched to trash and elites die to clean
      // chip-kills — so without the dividend their ◈ branch would stay a trap at home era.
      if (ty) {
        const k = dmg / Math.max(1e-9, d.hp + dmg);   // killing-blow overshoot (d.hp is ≤0 here; hp-before = hp + dmg)
        const disc = Math.min(1, (derived.cls[src] || {}).int || 0);
        const burn = 0.30 * clamp((k - 1.5) / 6.5, 0, 1) * (1 - disc);
        d.value = Math.max(1, Math.round(d.value * (1 - burn) * (1 + 0.12 * disc)));
      }
      // bigger / tougher kills drop heavier loot that takes longer to consume
      const big = d.armored || (d.tier || 0) >= 3, cmax = big ? 1.6 : ((d.tier || 0) >= 1 || d.r > 12 ? 0.55 : 0.1);
      orbs.push({ x: d.x, y: d.y, value: d.value, t: 0, weight: d.weight || 1, consume: 0, consumeMax: cmax, r0: big ? 6.5 : ((d.tier || 0) >= 1 ? 4 : 2.6), big });
      const s = stat(); s.dotsPopped++; if (d.special) s.specials++; if (d.armored) s.armored = (s.armored || 0) + 1; if (src) s.kills[src] = (s.kills[src] || 0) + 1;
      Audio_pop(big, d.tier);   // v16.7: the field speaks — throttled + ducked, see the sound layer
      const nb = Math.min(28, 6 + (d.tier || 0) * 4 + (d.armored ? 8 : 0));
      burst(d.x, d.y, nb, 90 + (d.tier || 0) * 24 + (d.armored ? 60 : 0), 2 + (d.tier || 0) * 0.3);
      ring(d.x, d.y, d.r, d.r + 18 + (d.tier || 0) * 8, 0.3); if (d.armored) shakeAdd(0.5);   // only armored elites nudge the screen — tier-4+ became common late game and pinned the shake
      if (d.splits && (d.gen || 0) < (d.maxGen || 1) && dots.length < galCap(S.galaxy) + 40) for (let i = 0; i < d.splits; i++) {   // field-cap guard (with headroom) — consistent with other spawn sites; prevents a big splitter wave overshooting the cap
        const hp = d.maxHp * 0.42, cv = Math.max(1, Math.round(d.value * 0.4)), cr = Math.max(6, d.r * 0.66);
        dots.push({ x: d.x + rnd(-10, 10), y: d.y + rnd(-10, 10), vx: rnd(-50, 50), vy: rnd(-50, 50), hp, maxHp: hp,
          value: cv, value0: cv, r: cr, r0: cr, tier: 0, spin: 0, special: false, armored: false,
          kind: "splitter", niche: "swarm", splits: d.splits, maxGen: d.maxGen, gen: (d.gen || 0) + 1, weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: d.color });   // fragments stay anti-swarm like their parent
      }
      if (d.bomb) { ring(d.x, d.y, d.r, d.r + 75, 0.5); burst(d.x, d.y, 18, 170, 2.6); shakeAdd(1.0); flashAdd(0.12);
        for (let oi = orbs.length - 1; oi >= 0; oi--) { const o = orbs[oi], dx = o.x - d.x, dy = o.y - d.y, q = dx * dx + dy * dy; if (q < 8100) { const dl = Math.sqrt(q) || 1; o.x = clamp(o.x + dx / dl * 70, 20, W - 20); o.y = clamp(o.y + dy / dl * 70, 40, H - 110); o.t += 3.5; } }   // Pyreling detonation scatters & ages your loot
      }
    }
  }
  function brushDmg() { let m = 5; for (const u of S.units) { const x = uDmg(u); if (x > m) m = x; } return m * 1.5 + 3; }
  function brushAt(x, y) { Audio_saber(x, y); const R = 30, dmg = brushDmg(); for (const d of dots) { if (d.dead) continue; const rr = R + d.r; if ((d.x - x) ** 2 + (d.y - y) ** 2 <= rr * rr && d.drawCd <= 0) {
    const dd = d.boss ? dmg * 2 : dmg;   // DOUBLE draw damage vs bosses — active drawing is what seals the boss kill
    hitDot(d, dd, "draw"); d.drawCd = 0.07;
    if (d.boss && !d.dead) {   // the finger must stay VISIBLE under constant turret fire: the generic hit-flash is
      // pinned on by bullets, so draw hits add their own sparks at the contact point + throttled damage numbers
      burst(x, y, 4, 120, 1.4); d.hit = 0.14;
      d.drawFxAcc = (d.drawFxAcc || 0) + dd;
      if (d.drawFxT === undefined || d.life - d.drawFxT > 0.22 || d.life < d.drawFxT) { floatTxt(x, y - d.r * 0.4, "−" + fmt(Math.round(d.drawFxAcc))); d.drawFxT = d.life; d.drawFxAcc = 0; }
    }
  } } trail.push({ x, y, life: 0.35 }); }
  // tap / drag over loot to manually bank it (no collector needed) — instant, full value.
  function collectAt(x, y) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; if ((o.x - x) ** 2 + (o.y - y) ** 2 > (26 + (o.r0 || 4)) ** 2) continue;
      const got = Math.max(1, Math.round(o.value));   // orb value already includes the Conquest multiplier (set at spawn) — do NOT multiply by incomeMul again (would be Conquest²)
      S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + got)); S.totalRun += got; META.totalEver += got; curEarned += got; earnAcc += got;
      fxEarn += got; fxEarnX = o.x; fxEarnY = o.y - 6; burst(o.x, o.y, o.big ? 9 : 5, 80, 2); spark(o.x, o.y);
      orbs.splice(i, 1);
    }
  }

  function useAbility(k) {
    if (abil[k] > 0 || state !== "play") return;
    if (planetMeta(S.galaxy).conquered && !wardenOn) { Audio_err(); return; }   // v18.18: abilities WORK during the mine-warden duel — it's a real fight   // v18.12: NO abilities on settled worlds — there is nothing to storm, frenzy at, or vacuum; no cooldown burned on the refusal
    abil[k] = ABIL_CD[k]; META.stats.abilities[k] = (META.stats.abilities[k] || 0) + 1; vibe(15); Audio_ability(k);
    if (k === "frenzy") { frenzyT = 6; shakeAdd(3.5); flashAdd(0.3); ring(W / 2, H / 2, 30, Math.max(W, H) * 0.55, 0.5); }
    else if (k === "dotrain") {   // v18.8 (owner call: ALOT stronger) — a real STORM: ~×3 the dots of the old sprinkle, 45% special
      // (×9 value each), falling from the sky edge as a 4.5s downpour instead of one instant puff
      const total = 90 + S.galaxy * 18; rainT = 4.5; rainRate = total / 4.5; rainAcc = 0;
      const cap = galCap(S.galaxy); for (let i = 0; i < 16 && dots.length < cap; i++) spawnDot(Math.random() < 0.45, true);   // the opening crack of the storm
      shakeAdd(6); flashAdd(0.15); ring(W / 2, 70, 20, W * 0.65, 0.6); }
    else if (k === "blackhole") { blackholeT = 5; shakeAdd(5); flashAdd(0.25); ring(W / 2, H / 2, Math.max(W, H) * 0.55, 40, 0.6); }
  }

  /* ----------------------------- update -------------------------- */
  function update(dt) {
    if (S.travel) {   // an expedition is in transit — advance it and arrive (ticks on any screen)
      S.travel.t += dt;
      if (S.travel.t >= S.travel.dur) { const to = S.travel.to; S.travel = null; snapshotActive(); activatePlanet(to); arrivalCinematic(to); Audio_land(); Sfx.swoosh(0.9); save(); }   // v17.1: landing from an expedition is now the FULL cinematic, not a flash
    }
    if (state !== "play") return;
    recompute();
    META.stats.playSec += dt; S.runSec += dt;
    decayLeak(dt);   // v18.47: the rolling loot-rot ratio behind the HUD readout
    if (frenzyT > 0) frenzyT -= dt;
    if (blackholeT > 0) blackholeT -= dt;
    if (comboFxT > 0) comboFxT -= dt;
    if (comboPopT > 0) comboPopT -= dt;
    if (comboGain1s > 0) comboGain1s = Math.max(0, comboGain1s - 0.55 * dt);   // the heat budget recovers at its own cap rate
    if (comboT > 0) comboT -= dt; else if (comboMul > 1) comboMul = Math.max(1, comboMul - 1.6 * dt);   // v18.15: stop slashing and the chain drains (×5→×1 in 2.5s)
    for (const k in abil) if (abil[k] > 0) abil[k] = Math.max(0, abil[k] - dt);
    autoBuyTick(dt);   // idle automation: spend cash on upgrades by your priority order

    const rawRate = derived.spawnPerSec * galSpawnMul(S.galaxy);
    // SOFT-SMOOTHED SPAWNING. The field has room to BREATHE — a cleared screen refills as a gentle pulse,
    // not an instant 1:1 wall (that was the stutter). But Spawn Rate is never pointless: dots keep growing
    // with it (soft knee via spawnVis, 38% pass-through), and the rest converts to per-dot TOUGHNESS at a
    // PREMIUM (spawnOver × TOUGH_POW > linear). The standing cap NEVER shrinks (the old surplus "thinning"
    // made buying Spawn Rate reduce on-screen dots — exactly the "this stat does nothing" feel; removed v14.4).
    const visRate = spawnVis(rawRate);
    const overflowMen = spawnOver(rawRate);
    const cap = galCap(S.galaxy);
    const sat = clamp((dots.length / cap - 0.6) / 0.4, 0, 1);                // extra toughness only if the field genuinely backs up (you can't keep up)
    const targetMenace = overflowMen * (1 + sat * 0.6);
    derived.spawnMenace += (targetMenace - derived.spawnMenace) * Math.min(1, dt * 2);   // smooth so it doesn't jitter
    // v18.6 SETTLED WORLDS (owner call): a CONQUERED planet is at peace — nothing spawns, no bosses,
    // and the army stands down (not drawn, no volleys). Its income identity is purely passive: idle
    // tribute + the ◈ core mine. Active farming lives on unconquered frontiers only — which also
    // retires the farm-backwards question permanently (there is nothing to farm behind you).
    // v18.18: an active ⛏ MINE WARDEN duel UN-SETTLES the world — fauna returns at the settled 2.0
    // menace, the army wakes, the fight is real. The moment it ends (either way) peace returns.
    const settled = planetMeta(S.galaxy).conquered && !wardenOn;
    // v18.34: the post-conquest BEAT. When it elapses the report is handed to Cards, which shows it
    // immediately on a quiet boot or queues it behind Welcome Back on a loud one. It is dropped if you
    // are no longer on the world that was conquered.
    if (conqCardT > 0) {
      conqCardT -= dt;
      const e = CONQ_CINE - conqCardT;
      // the camera: slammed in on the impact, riding back out as the world is surveyed, then home
      { const tgt = e < 1.0 ? camFit * 1.75 : e < 6.4 ? camFit * 1.06 : camFit;
        camZoom += (tgt - camZoom) * Math.min(1, dt * 2.2); }
      setVeil(e < 3.6 ? 52 + 83 * clamp((e - 0.9) / 2.7, 0, 1) : null);   // the iris opens onto the survey
      const CUES = [
        [1.0, () => { Audio_spinup(); }],                                                    // the survey spins up
        [3.2, () => { Audio_ascend(); shakeAdd(1.2); }],                                     // the mark begins to draw
        [6.0, () => { flashAdd(0.5); shakeAdd(5); vibe([50, 40, 90]); Audio_win();           // IT LOCKS
                      ring(W / 2, H / 2, 20, Math.max(W, H) * 0.5, 0.55); burst(W / 2, H / 2, 26, 200, 2.4); }],
        [6.3, () => { const lt = $("land-title");                                            // and only then is it named
          if (lt) { lt.innerHTML = "✦ " + galName(S.galaxy).toUpperCase() + " CONQUERED"
              + "<span class='lt-sub'>" + sysName(S.galaxy) + " — the world is yours, and at peace</span>";
            lt.classList.remove("show"); void lt.offsetWidth; lt.classList.add("show"); } }],
        [9.4, () => { const root = $("root"); if (root) { root.classList.remove("cinematic"); root.classList.remove("conquering"); }
                      setVeil(null); Audio_land(); }],
      ];
      while (conqCineStage < CUES.length && e >= CUES[conqCineStage][0]) CUES[conqCineStage++][1]();
      if (conqCardT <= 0) { const g = conqCardG, c = conqCardCores, s = conqCardSpoils;
        conqCineEnd();
        if (g === S.galaxy) Cards.push("conquest", () => showConquest(g, c, s));
        if (conqCardVic) { conqCardVic = false; Cards.push("victory", showVictory); } } }   // read what the last world paid, THEN take the bow

    stepCoreFx(dt);   // v18.45: the ◈ award sequence — self-gating, never plays over the film, a card, or the mine build
    // v18.40: a mine that came with the world starts going up once the conquest card has been read —
    // the film first, then the report, then you watch the site raised on the world you just took.
    if (minePendingBuild && conqCardT <= 0 && !Cards.busy() && !coreFx && !coreFxQ.length) {
      minePendingBuild = false; mineBuildT = 0; mineBuildStage = 0;
      floatTxt(W / 2, H / 2 - 20, "⛏ BREAKING GROUND — " + galName(S.galaxy)); ring(W / 2, H / 2, 6, 90, 0.5); Audio_buy();
    }
    // v18.36: the mine site building itself. Each stage boundary gets its own beat — dust off the pegs,
    // the shaft breaking through, the winding gear spinning up — so the animation is heard as well as seen.
    if (mineBuildT >= 0) {
      mineBuildT += dt;
      const p = mineBuildP(), cx = W / 2, cy = H / 2;
      const STAGES = [
        [.18, () => { ring(cx, cy, 88, 96, 0.4); Audio_tick(); }],                                    // claim pegged
        [.34, () => { ring(cx, cy, 92, 100, 0.35); Audio_node(); }],                                  // fence closed, floodlights lit
        [.52, () => { shakeAdd(1.8); burst(cx, cy, 16, 90, 1.1); flashAdd(0.12); Audio_zap(); vibe([25]); }],   // the shaft breaks through
        [.64, () => { Audio_spinup(); }],                                                             // winding gear up to speed
        [.80, () => { burst(cx, cy, 8, 60, 0.8); Audio_buy(); }],                                     // the works stand
        [.96, () => { Audio_collect(); }],                                                            // belt running to the heap
      ];
      while (mineBuildStage < STAGES.length && p >= STAGES[mineBuildStage][0]) STAGES[mineBuildStage++][1]();
      if (p >= 1) {
        mineBuildT = -1; mineBuildStage = 0;
        ring(cx, cy, 10, 120, 0.7); burst(cx, cy, 22, 130, 1.3); flashAdd(0.22); shakeAdd(1.2); vibe([30, 20, 60]);
        floatTxt(cx, cy - 20, "◈ CORE MINE ONLINE — " + galName(S.galaxy));
        floatTxt(cx, cy + 6, "digging " + fmtMineRate(mineRate(S.galaxy)));
        Audio_win(); syncHUD();
      }
    }
    if (!settled) {
      // v18.14 FEW, TOUGH, RICH: the spawn STREAM opens at ×0.35 on a fresh bar and ramps to ×1 as
      // the conquest advances — arrivals are a handful of tanky, fat-bounty dots, and the field
      // thickens as the world fights back. spawnDot pays each dot ×1/fieldMul so $/s never drops.
      const fieldMul = S.galaxy <= 1 ? 1 : 0.35 + 0.65 * clamp(curEarned / Math.max(1, conquerTarget(S.galaxy)), 0, 1);   // P1 exempt — the cold open keeps its classic field (see spawnDot)
      spawnAcc += dt * visRate * fieldMul;
      let _spawned = 0; while (spawnAcc >= 1 && dots.length < cap && _spawned < 4) { spawnDot(); spawnAcc -= 1; _spawned++; }   // small per-frame cap softens bursts (no frame spike)
      if (spawnAcc > 4) spawnAcc = 4;                                          // tiny buffer — lets a cleared field release a gentle pulse, never a robotic one-at-a-time nor an instant wall
      // mini-boss: one at a time; timer only counts while no boss is on the field
      if (!dots.some(d => d.boss)) { bossAcc += dt; if (bossAcc >= BOSS_INTERVAL) { bossAcc = 0; spawnBoss(); } }
      // v18.8 DOT RAIN downpour — the storm keeps falling for its duration, from the sky edge
      if (rainT > 0) { rainT -= dt; rainAcc += dt * rainRate;
        let rs = 0; while (rainAcc >= 1 && dots.length < cap && rs < 6) { spawnDot(Math.random() < 0.45, true); rainAcc -= 1; rs++; } }
    } else rainT = 0;   // settling a world (or arriving on one) ends any storm

    // Black Hole crush scales with your fleet (over its 5s it deals ~0.6s of total fleet DPS to every
    // dragged dot) — a real crush that grows with investment but never trivially one-shots tanky lategame dots.
    const bhDmg = blackholeT > 0 ? S.units.reduce((s, u) => s + uDmg(u) * uRate(u), 0) * 0.12 : 0;
    for (const d of dots) {
      d.aimed = 0; if (d.born < 0.2) d.born += dt; d.spin += dt * 0.9;   // claims rebuild each frame: live shells re-mark below, units add at fire time
      if (d.hit > 0) d.hit -= dt; if (d.drawCd > 0) d.drawCd -= dt; if (d.refl > 0) d.refl -= dt;
      if (d.boss) {
        d.life = (d.life || 0) + dt;
        // v18.24 WARDEN CALIBRATION — the old pool was sized from an ESTIMATED dps (uDmg × rate),
        // which ignores multishot, splash, chain and pierce: measured, that estimate ran ~10× low on
        // a keystoned late rack (wardens died in 3s) and too high on a thin early one (they escaped a
        // full 60s). 1.2s in, we read the damage that has ACTUALLY landed and rescale the whole pool
        // — HP and shield together, so the health bar's fraction never jumps — to the intended duel
        // length. Every warden now lasts ~WARDEN_TTK × its own dial against whatever you really deal,
        // and a kit's mitigation shows up as its own disruption rather than as a stretched clock.
        if (d.warden && d.calib) {
          const dealt = (d.maxHp - d.hp) + ((d.shieldMax || 0) - (d.shield || 0));
          // sample the WINDOW 1s→3s, not the first instant: the opening moment catches turret
          // acquisition and shells still in flight, so a single early reading came out wildly low on
          // one world (a 5.8s duel) and wildly high on another (a 60s escape). Two seconds of steady
          // fire is the honest rate. The warden spawns with a deliberately oversized provisional pool
          // so it always survives to be measured.
          if (d.calib === 1 && d.life >= 1.0) { d.calib = 2; d.cmark = dealt; d.cdraw = d.drawDealt || 0; }
          else if (d.calib === 2 && d.life >= 5.0) {
            d.calib = 0;
            // v18.50: the sample is your SUSTAINED output — the finger's contribution is subtracted,
            // because you cannot draw for the whole duel and a pool sized to a burst is unkillable
            // once you stop. Drawing still doubles damage; it just shortens the fight now, as intended.
            const drew = (d.drawDealt || 0) - (d.cdraw || 0);
            const obs = ((dealt - (d.cmark || 0)) - drew) / 4.0;   // FOUR seconds: early racks fire in lumpy mortar salvos, and a shorter sample caught one salvo or none
            if (obs > 0) {
              // and the pool may only ever SHRINK. The provisional pool is deliberately oversized (×4)
              // purely to survive the measurement, so the calibrated one is meant to come in under it —
              // a calibration that raises maxHp is a boss healing itself, which is never intended.
              // v18.52: the 4s sample runs with regen OFF (it is gated on d.calib), but the duel that
              // follows runs with it ON — so the pool was sized to an output you do not sustain and
              // every duel overshot. Measured on a real P1 build: 39.6/39.3/39.8/39.7s against a
              // designed 26, a dead-consistent ×1.52, which is exactly 1/(1 - regen×TTK). Solve for
              // the pool that ACTUALLY takes TTK seconds against net damage: (obs - regen·P)·T = P.
              const T = WARDEN_TTK * (d.wdur || 1);
              const want = Math.min(obs * T / (1 + (d.regen || 0) * T), d.maxHp);
              const sMax = d.shieldMax || 0, sFrac = sMax > 0 ? d.shield / sMax : 0;
              d.maxHp = want; d.hp = clamp(want - dealt, want * 0.1, want);   // honest bar: the damage you already landed counts
              if (sMax > 0) { d.shieldMax = want * (d.armorUp !== undefined ? 0.3 : 0.6); d.shield = d.shieldMax * sFrac; }
            }
          }
        }
        if (d.life >= (d.ttl || 60)) { d.dead = true; burst(d.x, d.y, 30, 200, 2.6); ring(d.x, d.y, d.r, d.r + 130, 0.5);
          // 1-MINUTE LIMIT — but the damage you DID land pays out as SALVAGE (half rate on the kill bounty), so a near-miss never feels like nothing
          const frac = clamp(1 - (Math.max(0, d.hp) + Math.max(0, d.shield || 0)) / (d.maxHp + (d.shieldMax || 0)), 0, 1);
          const partial = Math.round(d.value * 3 * frac * 0.5);   // a kill pays ~3x value (lump + orbs); salvage = half of that, scaled by damage dealt
          if (partial > 0) { S.cash += partial; S.totalRun += partial; META.totalEver += partial; curEarned += partial; earnAcc += partial; }
          const escNm = d.warden ? "⛏ " + (d.wname || "MINE WARDEN") : bossName(d.bg || S.galaxy);
          floatTxt(d.x, d.y - d.r - 12, "✕ " + escNm + " ESCAPED");
          if (partial > 0) floatTxt(d.x, d.y - d.r - 30, "+" + curSym(S.galaxy) + " " + fmt(partial) + " salvage");
          showBossReward(escNm, partial, false, false, true, Math.round(frac * 100));
          if (d.warden) { wardenOn = false; wardenClear = true; floatTxt(W / 2, H / 2 + 8, "the world holds — keep farming and call it out again when you are ready"); }   // v18.18: a lost duel re-settles the world; the panel offers the rematch
          flashAdd(0.3); shakeAdd(3); continue; }
        d.add += dt; if ((d.addEvery == null || d.addEvery > 0) && d.add > (d.addEvery || 6) && dots.length < cap - 2) { d.add = 0;   // boss summons a couple of adds to keep the pressure on
          const mb = 18 * Math.pow(derived.valueMul, 1.3) * rnd(1.5, 3), mr = clamp(8 + Math.log10(mb + 10) * 2, 8, 16), mv = Math.max(1, Math.round((d.value0 || 1) * 0.01));
          for (let i = 0; i < 2; i++) dots.push({ x: d.x + rnd(-24, 24), y: d.y + rnd(-24, 24), vx: rnd(-65, 65), vy: rnd(-50, 50), hp: mb, maxHp: mb, value: mv, value0: mv, r: mr, r0: mr, tier: 1, spin: 0, special: false, armored: false, kind: "minion", weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#bbbbbb" });
          burst(d.x, d.y, 6, 60, 1.4); } }
      if (d.regen && !d.calib && d.hit <= 0 && d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * d.regen * dt);  // heals unless under fire
      if (d.pulse !== undefined) { d.pulse += dt; if (d.pulse > 1.5) { d.pulse = 0; ring(d.x, d.y, d.r, d.r + 26, 0.45); if (d.shock) for (const dr of drones) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy); if (dl < 115) { dr.vx += dx / (dl || 1) * 210; dr.vy += dy / (dl || 1) * 210; } } } }   // Tempest shock shoves collectors off
      if (d.phase !== undefined) { d.phase += dt; d.phased = (d.phase % 2.4) < 1.0; }
      if (d.zig !== undefined) { d.zig += dt; if (d.zig > 0.35) { d.zig = 0; const sp = Math.hypot(d.vx, d.vy) || 1, a = Math.random() * TAU; d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp; } }
      if (d.grow !== undefined) { d.grow += dt; const f = 1 + Math.min(d.grow * 0.05, d.growCap != null ? d.growCap : 1.4); d.r = d.r0 * f; d.value = Math.round(d.value0 * f * f); }                                                       // Hearth swells bigger & richer
      if (d.healAura !== undefined) { d.healAura += dt; if (d.healAura > 1.2) { d.healAura = 0; for (const o of dots) { if (o === d || o.dead) continue; if ((o.x - d.x) ** 2 + (o.y - d.y) ** 2 < 4900 && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.02); } } }   // Verdant mends nearby dots
      if (d.armorUp !== undefined) { d.armorUp += dt; if (d.hit <= 0 && !d.calib) d.shield = Math.min(d.shieldMax, d.shield + d.shieldMax * (d.armorRate || 0.2) * dt); }                                                              // Frost regrows armor
      if (d.cloak !== undefined) { d.cloak += dt; d.cloaked = (d.cloak % (d.cloakPeriod || 3.0)) < (d.cloakOn || 1.0); }                                                                                                                    // Halcyon cloaks invisible ~33% of the time (was 47% — less frustrating to target)
      if (d.blink !== undefined) { d.blink += dt; if (d.blink > 1.6) { d.blink = 0; burst(d.x, d.y, 5, 50, 1.5); d.bx = d.x; d.by = d.y; d.x = d.x + rnd(-95, 95); d.y = clamp(d.y + rnd(-95, 95), 50, H - 130); } }   // Wraith teleports
      if (d.flock) { let ax = 0, ay = 0, cx = 0, cy = 0, n = 0; for (const o of dots) { if (o === d || !o.flock) continue; const dx = o.x - d.x, dy = o.y - d.y, q = dx * dx + dy * dy; if (q < 8100) { ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; n++; if (q < 676) { d.vx -= dx * 0.05; d.vy -= dy * 0.05; } } } if (n) { d.vx += (ax / n - d.vx) * 0.02 + (cx / n - d.x) * 0.004; d.vy += (ay / n - d.vy) * 0.02 + (cy / n - d.y) * 0.004; } }   // Mistral flocks (boids)
      if (d.gravity) for (const o of orbs) { const dx = d.x - o.x, dy = d.y - o.y, q = dx * dx + dy * dy; if (q < 19600) { const dl = Math.sqrt(q) || 1; o.x += dx / dl * 55 * dt; o.y += dy / dl * 55 * dt; } }   // Abyss drags loot away from collectors
      if (d.leech) for (let oi = orbs.length - 1; oi >= 0; oi--) { const o = orbs[oi], dx = d.x - o.x, dy = d.y - o.y, q = dx * dx + dy * dy; if (q < 12100) { const dl = Math.sqrt(q) || 1; o.x += dx / dl * 95 * dt; o.y += dy / dl * 95 * dt; if (q < (d.r + 8) ** 2) { if (!d.calib) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * (d.leechHeal || 0.04)); ring(d.x, d.y, d.r, d.r + 10, 0.3); orbRot(o); orbs.splice(oi, 1); } } }   // Devourer eats orbs & heals — softened (smaller/slower pull, less heal) so loot is contestable
      if (d.spawner !== undefined) { d.spawner += dt; if (d.spawner > (d.spawnEvery || 3.8) && dots.length < cap) { d.spawner = 0; const hp = d.maxHp * (d.spawnFrac || 0.18), mr = Math.max(5, d.r0 * 0.5); dots.push({ x: d.x + rnd(-14, 14), y: d.y + rnd(-14, 14), vx: rnd(-55, 55), vy: rnd(-55, 55), hp, maxHp: hp, value: Math.max(1, Math.round((d.value0 || d.value) * 0.18)), value0: 1, r: mr, r0: mr, tier: 0, spin: 0, special: false, armored: false, kind: "minion", weight: 1, hit: 0, drawCd: 0, refl: 0, born: 0, color: "#bbbbbb" }); burst(d.x, d.y, 4, 40, 1.2); } }   // Null Spawn births minions
      if (blackholeT > 0) { const dx = W / 2 - d.x, dy = H / 2 - d.y, dl = Math.hypot(dx, dy) || 1; d.x += dx / dl * 220 * dt; d.y += dy / dl * 220 * dt; hitDot(d, bhDmg * dt, "blackhole"); }
      else if (d.boss) { bossMove(d, dt); }   // bosses roam with their own personality, not the slow drift-to-centre
      else {   // wave drift: gentle pull toward the centre + a little wander, capped to a slow creep
        const cxp = W / 2 - d.x, cyp = H / 2 - d.y, cdp = Math.hypot(cxp, cyp) || 1;
        d.vx += (cxp / cdp) * 9 * dt + rnd(-13, 13) * dt; d.vy += (cyp / cdp) * 9 * dt + rnd(-13, 13) * dt;
        const sp2 = Math.hypot(d.vx, d.vy), mx = Math.max(d.spd || 20, 16) * 1.3;
        if (sp2 > mx) { d.vx *= mx / sp2; d.vy *= mx / sp2; }
        d.x += d.vx * dt; d.y += d.vy * dt;
        // v18.29: the map is a rectangle again — drift bounces off its border
        { const hw = wHW() - 26, hh = wHH() - 26, cx = wCX(), cy = wCY();
          if (d.x < cx - hw) { d.x = cx - hw; if (d.vx < 0) d.vx = -d.vx; }
          else if (d.x > cx + hw) { d.x = cx + hw; if (d.vx > 0) d.vx = -d.vx; }
          if (d.y < cy - hh) { d.y = cy - hh; if (d.vy < 0) d.vy = -d.vy; }
          else if (d.y > cy + hh) { d.y = cy + hh; if (d.vy > 0) d.vy = -d.vy; } }
      }
    }
    dots = dots.filter(d => !d.dead);
    // v18.18: the warden duel just ended (win, loss, or bought-out) — the world re-settles: the
    // returned fauna scatters lootless and any storm dies with it. Loot on the ground banks below.
    if (wardenClear) { wardenClear = false;
      for (const d of dots) if (Math.random() < 0.3) burst(d.x, d.y, 3, 70, 0.9);
      dots.length = 0; shells.length = 0; rainT = 0; }
    // v18.18 SETTLED CALM (owner: "the planet I visit after building a mine shouldn't have my
    // weapons and stuff on it — I want to see the mine at work"): on a settled world the whole army
    // stands down — drones included (they're not drawn, see render) — and any loot on the ground
    // banks itself instantly: the settlement crews sweep the field, no collectors needed.
    // (re-check wardenOn LIVE here, not the frame-start `settled` — summonWarden fires mid-frame via
    // the summon button, and the stale flag would sweep the freshly-summoned warden right off the field)
    if (settled && !wardenOn && dots.length) {   // belt & braces: however a world settles, any lingering fauna scatters — the calm view is guaranteed
      for (const d of dots) if (Math.random() < 0.3) burst(d.x, d.y, 3, 70, 0.9);
      dots.length = 0; shells.length = 0; }
    if (settled && !wardenOn && orbs.length) { let sweep = 0; for (const o of orbs) sweep += o.value || 0; orbs.length = 0;
      if (sweep > 0) { S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + sweep)); S.totalRun += sweep; META.totalEver += sweep; earnAcc += sweep;
        floatTxt(W / 2, H * 0.5, "+" + curSym(S.galaxy) + " " + fmt(sweep) + " — settlement crews sweep the field"); } }

    for (const sh of shells) if (sh.tref && !sh.tref.dead) sh.tref.aimed = (sh.tref.aimed || 0) + sh.dmg;   // v17.6: in-flight shells re-claim their target each frame, so `covered` means truly doomed — real coordination, not the old already-landed double-count
    if (!settled) for (let i = 0; i < S.units.length; i++) { const u = S.units[i]; if (u.rx) { const dc = Math.exp(-dt * 16); u.rx *= dc; u.ry *= dc; } if (u.flash > 0) u.flash -= dt; u.cd -= dt; const period = 1 / uRate(u); const maxShots = Math.min(64, Math.max(1, Math.ceil(uRate(u) * dt) + 1)); let shots = 0; while (u.cd <= 0 && shots < maxShots) { fireUnit(u, unitPos(i, S.units.length)); u.cd += period; shots++; } if (u.cd < -period) u.cd = -period; }   // machine-gun: per-frame allowance scales with rate×dt so high fire rates (Laser, Frenzy) fully realize and stay FRAME-RATE-INDEPENDENT; debt floored so it can't spiral. v18.6: the army stands down on settled worlds
    for (const b of beams) b.life -= dt; beams = beams.filter(b => b.life > 0);
    // arcing mortar bombs: fly their parabola, then detonate on landing (deferred splash).
    for (const sh of shells) {
      sh.t += dt; sh.spin += dt * 13;
      if (sh.t >= sh.dur) {
        sh.dead = true;
        const aoe = sh.aoe; if (aoe > 0) for (const d of dots) if (!d.dead && (d.x - sh.tx) ** 2 + (d.y - sh.ty) ** 2 <= aoe * aoe) hitDot(d, sh.dmg, sh.type);
        ring(sh.tx, sh.ty, sh.crit ? 6 : 4, Math.max(aoe, 22), 0.24); burst(sh.tx, sh.ty, sh.crit ? 13 : 8, 120, 2.6);
        shake = Math.max(shake, sh.crit ? 1.8 : 1.0);
      }
    }
    shells = shells.filter(s => !s.dead);

    // collectors coordinate: chase-types each claim their nearest orb (so they
    // split up); black-hole types stay put and drag everything in slowly.
    if (drones.length === 0) syncCollectors();
    // m4: holes keep their DISTINCT spread offsets (so several don't pile up) but the whole formation
    // SLIDES toward the live loot centroid — so a hole sits where the orbs actually are (and follows
    // them as the fight drifts), instead of idling on a fixed dot while loot expires elsewhere.
    let oCx = 0, oCy = 0, oN = 0; for (const o of orbs) { oCx += o.x; oCy += o.y; oN++; }
    const lootX = oN ? oCx / oN : W * 0.5, lootY = oN ? oCy / oN : H * 0.5;
    // ACTION HUB: where collectors should gravitate when they have nothing claimed — the loot centroid if
    // any orbs exist, else where the DOTS are (the fight). Stops collectors idling far out on big maps.
    let dCx = 0, dCy = 0, dN = 0; for (const d of dots) { dCx += d.x; dCy += d.y; dN++; }
    const hubX = oN ? lootX : (dN ? dCx / dN : W * 0.5), hubY = oN ? lootY : (dN ? dCy / dN : H * 0.5);
    // HIVE MIND (v18.4): each swarm's anchor is its own slow agent. It hunts the DENSEST orb cluster —
    // not the centroid: a two-pile field puts the centroid in the empty middle and the whole hive
    // starves in place (measured: 614 orbs backed up, zero banked). Every ~0.4s it samples a couple
    // dozen orbs, scores each by the loot value within 180px, and glides toward the richest spot
    // (staggered per hive so two hives split the piles; falls back to the action hub when loot is thin).
    for (const dr of drones) if (dr.wing === 0) {
      const h = hiveAnchors[dr.hive] || (hiveAnchors[dr.hive] = { x: dr.x, y: dr.y, tx: dr.x, ty: dr.y, scanT: 0 });
      h.scanT = (h.scanT || 0) - dt;
      if (h.scanT <= 0) { h.scanT = 0.4;
        if (orbs.length > 3) { let bx = hubX, by = hubY, bs = -1;
          for (let s = 0; s < 24; s++) { const o = orbs[(Math.random() * orbs.length) | 0]; let sc = 0;
            for (let j = 0; j < 40; j++) { const o2 = orbs[(Math.random() * orbs.length) | 0]; if ((o2.x - o.x) ** 2 + (o2.y - o.y) ** 2 < 180 * 180) sc += o2.value || 1; }
            // stagger: hive k>0 penalises spots near LOWER hives' targets so multiple swarms fan out over separate piles
            for (let k2 = 0; k2 < dr.hive; k2++) { const h2 = hiveAnchors[k2]; if (h2 && (h2.tx - o.x) ** 2 + (h2.ty - o.y) ** 2 < 260 * 260) sc *= 0.25; }
            if (sc > bs) { bs = sc; bx = o.x; by = o.y; } }
          h.tx = bx; h.ty = by;
        } else { h.tx = hubX; h.ty = hubY; }
      }
      const k = Math.min(1, dt * 1.1); h.x += ((h.tx || hubX) - h.x) * k; h.y += ((h.ty || hubY) - h.y) * k;
      viewClamp(h, 34);   // v18.26: the hive roams the disc, not the box — v18.27: and stays in view
    }
    // orb claims: each chase collector takes its nearest orb — wingmates claim only what a TETHERED
    // body can actually service (anchor + hive radius + its own reel reach, with a small margin)
    for (const dr of drones) { dr.cand = null; dr.cbd = Infinity; }
    for (const o of orbs) { let nd = null, bd = Infinity; for (const dr of drones) { if (COL_TYPES[dr.type].mode === "hole") continue;
      if (dr.wing != null) { const h = hiveAnchors[dr.hive], cr = HIVE_R + cReachD(dr) + 40; if (h && (h.x - o.x) ** 2 + (h.y - o.y) ** 2 > cr * cr) continue; }
      const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2; if (q < bd) { bd = q; nd = dr; } } if (nd && bd < nd.cbd) { nd.cbd = bd; nd.cand = o; } }
    const HOLE_SPOTS = [[0.5, 0.40], [0.30, 0.50], [0.70, 0.52], [0.50, 0.62]]; let holeN = 0;
    for (const dr of drones) {
      const hole = COL_TYPES[dr.type].mode === "hole", tgt = dr.cand;
      if (hole) { const hs = HOLE_SPOTS[holeN++ % HOLE_SPOTS.length];
        const hx = lootX + (W * hs[0] - W * 0.5) * 0.7, hy = lootY + (H * hs[1] - H * 0.5) * 0.7;   // loot centroid + this hole's spread offset
        dr.vx += ((hx - dr.x) * 0.6 - dr.vx) * 0.04; dr.vy += ((hy - dr.y) * 0.6 - dr.vy) * 0.04; }
      else if (dr.parking) { dr.vx *= 0.55; dr.vy *= 0.55; }                                  // parked, consuming big loot
      else if (tgt) { const dx = tgt.x - dr.x, dy = tgt.y - dr.y, dl = Math.hypot(dx, dy) || 1, sp = cSpeedD(dr); dr.vx += (dx / dl * sp - dr.vx) * AGILITY; dr.vy += (dy / dl * sp - dr.vy) * AGILITY; }
      else if (dr.wing != null) {   // idle wingmate: patrol a personal orbit slot inside the hive, never the global hub
        const h = hiveAnchors[dr.hive] || { x: hubX, y: hubY };
        const pa = Date.now() / 1400 + dr.wing * (TAU / WING_N);
        const px = h.x + Math.cos(pa) * HIVE_R * 0.55, py = h.y + Math.sin(pa) * HIVE_R * 0.55;
        const dx = px - dr.x, dy = py - dr.y, dl = Math.hypot(dx, dy) || 1, sp = cSpeedD(dr) * 0.6;
        dr.vx += (dx / dl * sp - dr.vx) * AGILITY; dr.vy += (dy / dl * sp - dr.vy) * AGILITY; }
      else { const dx = hubX - dr.x, dy = hubY - dr.y, dl = Math.hypot(dx, dy) || 1;   // no orb claimed → don't idle; drift toward the action hub so far-out collectors rejoin the fight
        if (dl > 50) { const sp = cSpeed(dr.type) * 0.7; dr.vx += (dx / dl * sp - dr.vx) * AGILITY; dr.vy += (dy / dl * sp - dr.vy) * AGILITY; } else { dr.vx *= 0.9; dr.vy *= 0.9; } }
      // HIVE TETHER: a wingmate straying past the hive radius gets pulled home, harder the farther out
      if (dr.wing != null) { const h = hiveAnchors[dr.hive]; if (h) { const dx = dr.x - h.x, dy = dr.y - h.y, dl = Math.hypot(dx, dy);
        if (dl > HIVE_R) { const ret = cSpeedD(dr) * 1.3, wgt = Math.min(1, (dl - HIVE_R) / 70) * 0.25; dr.vx += (-dx / dl * ret - dr.vx) * wgt; dr.vy += (-dy / dl * ret - dr.vy) * wgt; } } }
      // separation: chase collectors push apart so they SPREAD and cover more of the field — so fielding
      // more collects meaningfully more. Same-hive wingmates use a short bubble (the 200px field spread
      // would fight the 150px hive tether forever).
      if (!hole) for (const o2 of drones) { if (o2 === dr || COL_TYPES[o2.type].mode === "hole") continue; const sep = (dr.wing != null && o2.wing != null && o2.hive === dr.hive) ? 46 : 200; const dx = dr.x - o2.x, dy = dr.y - o2.y, d2 = dx * dx + dy * dy; if (d2 > 1 && d2 < sep * sep) { const inv = 1 / Math.sqrt(d2), f = (sep - Math.sqrt(d2)) * cSpeedD(dr) * 0.012; dr.vx += dx * inv * f * dt; dr.vy += dy * inv * f * dt; } }
      dr.x += dr.vx * dt; dr.y += dr.vy * dt; worldClamp(dr, 12);   // collectors are held on the map
      if (dr.pop > 0) dr.pop -= dt;
      dr.parking = false;
    }
    // black holes also drag nearby dots gently toward them (the "suck in" feel)
    for (const dr of drones) { if (COL_TYPES[dr.type].mode !== "hole") continue; const R = cReach(dr.type) * 1.5, ps = 60 * cPull(dr.type); for (const d of dots) { const dx = dr.x - d.x, dy = dr.y - d.y, dl = Math.hypot(dx, dy) || 1; if (dl < R) { d.x += dx / dl * ps * dt; d.y += dy / dl * ps * dt; } } }   // hole drags dots within its Reach toward it, at its Pull strength
    for (const dr of drones) dr.proc = 0;   // free maw bays this frame; Capacity = how many orbs a collector processes in parallel
    let earned = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.t += dt;
      // route to the nearest in-range collector that still has a FREE maw bay; only fall back to a
      // full one if none is free (stops loot queueing at a jammed collector while another sits idle).
      let nd = null, bd = Infinity, ndF = null, bdF = Infinity;
      for (const dr of drones) { const q = (dr.x - o.x) ** 2 + (dr.y - o.y) ** 2, rng = cReachD(dr) ** 2; if (q >= rng) continue; if (q < bd) { bd = q; nd = dr; } if (dr.proc < cCapD(dr) && q < bdF) { bdF = q; ndF = dr; } }
      if (ndF) { nd = ndF; bd = bdF; }
      if (nd) {
        const dl = Math.sqrt(bd) || 1, pull = (COL_TYPES[nd.type].mode === "hole" ? 420 / Math.sqrt(o.weight || 1) : 240 / (o.weight || 1)) * cPull(nd.type);   // reel force × Pull strength; holes pull HARD (sqrt-damped) so heavy high-value orbs reach the maw before expiry
        if (dl < MOUTH) {                                          // reeled to the mouth — but it needs a free maw bay to actually process it
          if (nd.proc < cCapD(nd)) {                     // a bay is open → process this orb (Speed/Reach get it here, Process/Capacity chew through it)
            nd.proc++;
            o.consume += dt * cIngestD(nd); o.x += (nd.x - o.x) * 0.3; o.y += (nd.y - o.y) * 0.3; if (o.consumeMax > 0.8) nd.parking = true;   // only park for genuinely heavy loot (armored/boss), not tier-1 orbs
            if (Math.random() < (o.big ? 0.4 : 0.12)) spark(o.x, o.y);
            if (o.consume >= o.consumeMax) { const got = Math.round(o.value * cYield(nd.type) * orbFresh(o)); earned += got; leakGot += got; META.stats.collected[nd.type] = (META.stats.collected[nd.type] || 0) + got; fxEarn += got; fxEarnX = nd.x; fxEarnY = nd.y - 6; if (o.big) { burst(o.x, o.y, 8, 70, 2); nd.pop = 0.25; } Audio_collect(o.big); orbs.splice(i, 1); }
          } else {                                                 // all bays busy — orb queues at the maw; with too little Capacity a dense pile backs up and can expire
            o.x += (nd.x - o.x) * 0.1; o.y += (nd.y - o.y) * 0.1;
            if (o.t > ORB_LIFE) { orbRot(o); orbs.splice(i, 1); }
          }
        } else { o.x += (nd.x - o.x) / dl * pull * dt; o.y += (nd.y - o.y) / dl * pull * dt; if (o.t > ORB_LIFE) { orbRot(o); orbs.splice(i, 1); } }
      }
      else if (o.t > ORB_LIFE) { orbRot(o); orbs.splice(i, 1); }
    }
    if (earned > 0) { S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + earned)); S.totalRun += earned; META.totalEver += earned; earnAcc += earned; curEarned += earned; }
    // background empire: every conquered, non-active planet feeds its idle rate straight into your GLOBAL
    // treasury AND (on an unconquered planet) the conquer bar — so the empire can idle you to the next world.
    // v18.43: bgSum is now ONLY the spoils pot draining on the world you are parked on. Since a world
    // has to be conquered to pay spoils, this can never push an unconquered world's conquer bar — the
    // idle bar-fill (IDLE_FRAC) is dead by construction, not by a flag.
    { const sRate = settleIncomeRate(); const bgSum = sRate;
      if (sRate > 0) { const v = S.vault[S.galaxy]; if (v && v.spoils > 0) v.spoils = Math.max(0, v.spoils - sRate * dt); }   // v18.14: the ×20 window pays FROM the victory-spoils pool — when it dries, settleIncomeRate drops to the ramped empire rate
      if (bgSum > 0) { const add = bgSum * dt; S.cash = Math.max(S.cash, Math.min(derived.capacity, S.cash + add)); S.totalRun += add; META.totalEver += add; earnAcc += add;   // v17.21 audit: empire income now counts in cps — the boss bounty floor AND the unit-price anchor see your TRUE throughput. v18.9: + the settled CURRENT planet's supervised on-site tribute
        if (!planetMeta(S.galaxy).conquered) { const barCap = IDLE_FRAC * designedActiveRate(S.galaxy); curEarned += Math.min(bgSum, barCap) * dt; } } }   // treasury gets the FULL empire rate; the conquer BAR gets at most IDLE_FRAC of the DESIGNED active rate (v18.22: same allowance offline — idle contributes 20%, never out-paces playing)
    // conquest check — UNCONDITIONAL so ANY income source (active orbs OR idle empire) can complete it
    mineAccrue(dt);   // ◈ core mines tick on the live clock too (conquered worlds only; no-op otherwise)
    // v18.40 (owner: "the conquer screen should only be after you beat the boss, you should be able to
    // farm at 100% before fighting the boss and the button gives you the option to fight it"): filling
    // the bar no longer TAKES the world — it unlocks the fight for it. The bar sits full while you keep
    // farming and banking, the dock button turns into the summon, and ONLY the keeper's death conquers
    // the planet. See conquerWorld(), called from the warden kill.
    fxEarnT += dt; if (fxEarn > 0 && fxEarnT > 0.22) { floatTxt(fxEarnX, fxEarnY - 14, "+" + curSym(S.galaxy) + fmt(fxEarn)); fxEarn = 0; fxEarnT = 0; }
    earnT += dt; if (earnT >= 1) { cps = cps * 0.6 + (earnAcc / earnT) * 0.4; earnAcc = 0; earnT = 0;
}   // v18.0: the price-anchor bookkeeping is gone — no price in the game reads income anymore (cps above still feeds the boss bounty floor)
    for (const tp of trail) tp.life -= dt; trail = trail.filter(tp => tp.life > 0);
    stepFx(dt);
    if (S.galaxy > S.peakGalaxy) S.peakGalaxy = S.galaxy;
  }

  // each planet's boss gets a distinct, seeded silhouette (sides / spokes / rings / spin) + a health bar
  function drawBoss(d) {
    const g = d.bg || S.galaxy, hsh = Math.imul((g + 7) * 2654435761, 40503) >>> 0, rv = k => ((hsh >> (k * 3)) & 7) / 7;
    const sides = 3 + Math.floor(rv(0) * 6), spokes = 6 + Math.floor(rv(1) * 8), rings = 1 + Math.floor(rv(2) * 3);
    const dir = rv(3) < 0.5 ? -1 : 1, sp = d.spin * (0.6 + rv(4) * 0.8) * dir;
    const r = d.r * (d.hit > 0 ? 1.12 : 1) * (d.born < 0.3 ? clamp(d.born / 0.3, 0.3, 1) : 1);
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(d.spin * 3); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x, d.y, r * 2.0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;   // menace aura
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(d.x, d.y, r * 1.62, -sp, -sp + TAU); ctx.stroke(); ctx.setLineDash([]);   // dashed halo
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4; ctx.fillStyle = "#fff";                                          // rotating spokes/limbs
    for (let k = 0; k < spokes; k++) { const a = sp + k / spokes * TAU, o = r * (1.35 + 0.22 * Math.sin(d.spin * 2 + k)); ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * r * 1.02, d.y + Math.sin(a) * r * 1.02); ctx.lineTo(d.x + Math.cos(a) * o, d.y + Math.sin(a) * o); ctx.stroke(); ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * o, d.y + Math.sin(a) * o, 2.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = d.hit > 0 ? "#fff" : "#d8d8d8"; ctx.beginPath();                                                // core polygon
    for (let k = 0; k <= sides; k++) { const a = -sp * 0.5 + k / sides * TAU, rr = r * (k % 2 && rv(5) > 0.5 ? 0.82 : 1); (k ? ctx.lineTo : ctx.moveTo).call(ctx, d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.4; for (let k = 1; k <= rings; k++) { ctx.beginPath(); ctx.arc(d.x, d.y, r * (k / (rings + 1)), 0, TAU); ctx.stroke(); }   // inner rings
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, r * 0.24, 0, TAU); ctx.fill();                       // core eye
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x + Math.cos(d.spin) * r * 0.1, d.y + Math.sin(d.spin) * r * 0.1, r * 0.1, 0, TAU); ctx.fill();
    if (d.shield > 0) { ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.globalAlpha = clamp(d.shield / d.shieldMax, 0.25, 1); ctx.beginPath(); ctx.arc(d.x, d.y, r * 1.78, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const bw = 150, bx = d.x - bw / 2, by = d.y - r * 1.95 - 16;                                                    // COMBINED health bar (hp + shield share one bar so it ALWAYS drains — no more "frozen" HP while the shield is up)
    const maxTot = d.maxHp + (d.shieldMax || 0), hpW = bw * clamp(d.hp / maxTot, 0, 1), shW = bw * clamp((d.shield || 0) / maxTot, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
    ctx.fillStyle = "#fff"; ctx.fillRect(bx, by, hpW, 5);                                                            // solid HP (bright)
    if (shW > 0.4) { ctx.fillStyle = "rgba(255,255,255,0.32)"; ctx.fillRect(bx + hpW, by, shW, 5);                    // SHIELD segment (dim) sits to the right and depletes FIRST — you always see the total bar shrinking
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1; for (let sx = bx + hpW + 3; sx < bx + hpW + shW; sx += 4) { ctx.beginPath(); ctx.moveTo(sx, by + 0.5); ctx.lineTo(sx - 2.5, by + 4.5); ctx.stroke(); }   // diagonal hatching = "shield/armor" so it reads distinctly in monochrome
      ctx.fillStyle = "#fff"; ctx.fillRect(bx + hpW - 0.5, by, 1, 5); }                                              // crisp divider between HP and shield
    // 1-minute COUNTDOWN: a draining bar under the health bar + a ticking number (flashes white when low)
    const lifeFrac = clamp(1 - (d.life || 0) / (d.ttl || 60), 0, 1), left = Math.max(0, Math.ceil((d.ttl || 60) - (d.life || 0))), low = left <= 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 2, by + 7, bw + 4, 4);
    ctx.fillStyle = low ? (Math.sin(d.spin * 8) > 0 ? "#fff" : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.7)"; ctx.fillRect(bx, by + 8, bw * lifeFrac, 2);
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText((d.warden ? "⛏ " + (d.wname || "MINE WARDEN") : bossName(g)) + "  ·  " + left + "s", d.x, by - 4);
  }
  // Black-iris veil for the zoom-into-base transition. rPct = radius of the clear hole (% of screen):
  // 0 = fully black, ≥135 = fully clear (veil off). Centered, so it closes on / opens from the planet.
  function setVeil(rPct) {
    const v = $("transition"); if (!v) return;
    if (rPct == null || rPct >= 135) { v.style.opacity = "0"; return; }
    const r = Math.max(0, rPct);
    v.style.opacity = "1";
    v.style.background = "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) " + r.toFixed(1) + "%, #000 " + (r + 8).toFixed(1) + "%)";
  }
  /* ----------------------------- render -------------------------- */
  /* v17.8 SPAWN-RIM ENVIRONMENT (owner call: "zoom out and there's dead space between where dots
     spawn and the real map edge — add unique minimalist environment bits per planet"). Every world
     dresses its perimeter band with its OWN seeded line-art motif — craters, trees, ice shards,
     void wells… one per planet, themed to its native race & boss — and dots now EMERGE from the
     features: spawn points snap (with jitter) to the nearest rim anchor, so the world's fauna
     visibly crawls out of its world's terrain. Monochrome, faint, and behind the field. */
  // v18.30 ONE MAP FOR EVERY WORLD (owner: "get rid of all map designs, have them all the same for
  // now"). The whole per-planet landscape layer is gone — 18 formation motifs, five rim layouts,
  // five ridge silhouettes, seven ground surfaces, the signature structures, the outer wastes. Every
  // world is now the same clean field: a rounded border you can see, solid ground inside it, and
  // nothing else competing with the fight. Fauna still comes in over the edges, all the way around.
  // (The seeded per-world BACKDROP — star density and nebula — is untouched; it lives in
  // buildBackdrop and is behind the field, not on the map.)
  // Self-healing fit: the dock's height changes for many reasons (rows rendering in, the settlement
  // panel swapping, Minimise, a rotate). Rather than trust any one event to fire in time, re-measure
  // the band a few times a second and re-fit only when it has actually moved.
  function drawEnv() {
    // v18.31 BORDERLESS (owner: "why the fuck when I zoom out is there some dumb rectangular border
    // — needs to look borderless, like I'm zooming out the map"). NOTHING draws the world's edge any
    // more: no border line, no ground plate, no frame. The map's bounds still exist for physics and
    // for where fauna comes in over the edges, but they are invisible, so pulling the camera back
    // just shows more of the same field. The only thing this layer still draws is the mine complex
    // on a settled world.
    // v18.41 (owner: "the mine animation and completion animation start at the same time"): a mine won
    // WITH the world is founded on the kill frame but its site is not raised until the report card has
    // been read. Until then it must not be DRAWN either — mineBuildP() reads 1 for a finished mine, so
    // the complete complex was appearing on the world under the conquest film and then rebuilding itself
    // from nothing afterwards. Pending means invisible.
    if (mineRigOn()) drawMineRig(performance.now() / 1000, mineBuildP());
  }
  // ══ ✦ CONQUEST CINEMATIC (v18.38) ═════════════════════════════════════════
  // Owner: "there needs to be an animation for conquering the world like a nice long triple-A one."
  // Taking a world is the biggest thing that happens in a run and it used to be a 1.2s flash. This is a
  // ten-and-a-half second sequence in five movements, drawn in SCREEN space over the world (the DOM
  // letterbox bars, the HUD fade and the title card sit above it):
  //
  //   IMPACT   0.0-1.2   the shock off the last kill — rings tearing outward, the iris slammed shut
  //   SURVEY   1.0-3.6   the iris opens onto a wireframe globe that assembles latitude by latitude,
  //                      a terminator line sweeping across it as the world is read
  //   SIGIL    3.2-6.4   the planet's own signature polygon draws itself edge by edge over the globe,
  //                      spins down to true, and LOCKS — flare, shock ring, the mark filled
  //   CLAIM    5.8-9.4   the mark holds under the title card while the claim rules run out to the edges
  //   SETTLE   9.4-10.5  the letterbox lifts, the camera comes home, and the report card follows
  //
  // Every phase reads the planet you are actually on — its polygon, its rotation — so conquering Vesta
  // and conquering Oblivion are not the same film.
  const CONQ_CINE = 10.5;
  // ONE teardown, used by the natural end, the skip, and wardenReset — the cinematic borrows the camera,
  // the veil and two body classes, and every one of them has to be handed back however it ends.
  function conqCineEnd() {
    conqCardT = 0; conqCineStage = 0;
    const root = $("root"); if (root) { root.classList.remove("cinematic"); root.classList.remove("conquering"); }
    const lt = $("land-title"); if (lt) lt.classList.remove("show");
    setVeil(null); camZoom = camFit; syncHUD();
  }
  // v18.41 (owner: "make sure you can't skip the animations"): there is no skip. Taking a world is the
  // moment the whole run builds to, and it plays in full every time — no tap-out, no Esc-out, no hint
  // offering one. conqCineEnd() survives only as the teardown for a sequence that is ENDED FOR you by
  // travelling or ascending, which are the two things that legitimately take the world out from under it.
  // ✦ TAKING THE WORLD — called ONLY from the seam keeper's death (v18.40). Everything a conquest is
  // lives here: the payout, the cinematic, the settling of the field, and the capstone victory check.
  function conquerWorld() {
    const pm = planetMeta(S.galaxy);
    if (pm.conquered) return;
    pm.conquered = true;
    // v18.43: no tribute — a taken world's payout is its ⚑ spoils pot and its ◈ seam, both finite or earned.
    // (Comment on its OWN line: an appended one swallows the rest of the statement, which is exactly how
    // v18.21 silently commented out this block's juice for seventeen versions.)
    pm.bgRate = 0;
    pm.spoils = Math.round(SETTLE_SPOILS_FRAC * conquerTarget(S.galaxy));
    const cg = coreVal(S.galaxy);
    recompute();
        // v18.34 BEAT 0 — the kill lands and NOTHING is said. The four floating texts that used to
        // fire here (cores, spoils, "the warden is coming", "hold position then launch") all faded in
        // 0.95s and are now rows on the conquest report, which opens a beat later via conqCardT.
        // (They also swallowed this line's juice: pre-v18.34 the "// v18.21" comment ran on into
        // flashAdd/shakeAdd/vibe/Audio_conquer/syncHUD, so the biggest moment in the game landed
        // SILENT and un-flashed, and the HUD only caught up on the next frame. Restored below.)
        // v18.45: the ◈ this world earned get their own sequence. It is QUEUED, so it plays after the
        // film and after the report card — the cores fly into the counter on the quiet settled world,
        // and the mine build waits for them. Earned here, banked when you ascend (see the receipt).
        queueCoreFx(cg, "◈ earned by taking " + galName(S.galaxy), true);
        conqCardG = S.galaxy; conqCardCores = cg; conqCardSpoils = pm.spoils; conqCardT = CONQ_CINE; conqCineStage = 0;
        // v18.38: the cinematic opens on the shock of the kill itself — hard flash, deep shake, two
        // shockwaves and the iris slammed shut, with the HUD and dock pulled off screen behind the bars.
        flashAdd(0.85); shakeAdd(9); vibe([40, 30, 90, 30, 120]); Audio_conquer();
        ring(W / 2, H / 2, 14, Math.max(W, H) * 0.7, 0.7); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.38, 0.45); burst(W / 2, H / 2, 40, 260, 3.0);
        { const root = $("root"); if (root) { root.classList.add("cinematic"); root.classList.add("conquering"); } }
        camZoom = camFit * 1.75; veilT = 0; setVeil(52);
        syncHUD();
        // v18.6 SETTLED: the world is yours — the remaining fauna scatters (lootless, no conquest jackpot)
        // and the army stands down; leftover loot is swept by the settlement crews (see SETTLED CALM).
        for (const d of dots) if (Math.random() < 0.3) burst(d.x, d.y, 3, 70, 0.9);
        dots.length = 0; shells.length = 0;
        // v18.34: the warden is NOT summoned for you any more (was wardenAutoT = 2.5 — owner: "then
        // I'm thrusted without consent into boss battle"). It waits on its button in the settlement
        // panel, with no clock, for as long as you want to sit on your new world.
        let totConq = 0; for (const k in S.vault) if (S.vault[k] && S.vault[k].conquered) totConq++;   // capstone: every world in the cluster subdued
        if (totConq >= TOTAL_PLANETS && !S.victory) { S.victory = true; flashAdd(0.9); shakeAdd(9); ring(W / 2, H / 2, 14, Math.max(W, H), 0.8); burst(W / 2, H / 2, 60, 320, 3.2); Audio_victory(); conqCardVic = true; save(); }
  }   // v18.34: victory rides the SAME beat as the report and queues AFTER it — pushing it here fired it at t=0 and buried what the final conquest actually paid   // v16.5: a PERSISTENT victory screen — the old floating text faded in ~2s and the summit of ~55 active hours was missable by an alt-tab

  function drawConquestCine(e) {
    const cw = SW, ch = SH, cx = cw / 2, cy = VIEW_CY || ch / 2, R = Math.min(cw, ch);
    const seg = (a, b) => { const k = clamp((e - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const raw = (a, b) => clamp((e - a) / (b - a), 0, 1);
    const out = 1 - seg(9.4, 10.5);                       // the whole overlay lifts at the end
    if (out <= 0) return;
    const look = dotLook(S.galaxy), sides = look.s < 3 ? 12 : look.s;   // circle-worlds get a 12-gon so the mark still draws
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff";

    // ── I. IMPACT ──────────────────────────────────────────────────────────
    { const k = raw(0, 1.2);
      if (k < 1) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
        g.addColorStop(0, "rgba(255,255,255," + (0.55 * (1 - k)).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = "#fff"; }
      for (let i = 0; i < 3; i++) { const kk = clamp((e - i * 0.16) / 1.1, 0, 1); if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = (1 - kk) * 0.85 * out; ctx.lineWidth = 7 * (1 - kk) + 0.6;
        ctx.beginPath(); ctx.arc(cx, cy, R * (0.04 + 1.15 * kk), 0, TAU); ctx.stroke(); } }

    // ── II. SURVEY: the wireframe globe ────────────────────────────────────
    const gk = seg(1.0, 3.6), Rg = R * 0.30;
    if (gk > 0) {
      const grow = 0.35 + 0.65 * gk, rr = Rg * grow, spin = e * 0.16;
      ctx.globalAlpha = 0.5 * gk * out; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();                    // the limb
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {                                                 // latitudes, north and south
        const f = i / 5, on = clamp(gk * 5 - i, 0, 1); if (on <= 0) continue;
        const yy = Math.sin(f * Math.PI / 2) * rr, w = Math.cos(f * Math.PI / 2) * rr;
        ctx.globalAlpha = 0.26 * on * out;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx, cy + yy * s, w, w * 0.20, 0, 0, TAU); ctx.stroke(); } }
      ctx.globalAlpha = 0.20 * gk * out;
      for (let i = 0; i < 6; i++) {                                                  // longitudes, turning
        const ph = spin + i * Math.PI / 6, sq = Math.cos(ph);
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(sq) * rr, rr, 0, 0, TAU); ctx.stroke(); }
      { ctx.globalAlpha = 0.14 * gk * out; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.22, 0, 0, TAU); ctx.stroke(); }   // the equator
      // the terminator: a bright chord sweeping down the globe as the world is read
      const tk = raw(1.2, 3.4);
      if (tk > 0 && tk < 1) { const ty = cy - rr + 2 * rr * tk, half = Math.sqrt(Math.max(0, rr * rr - (ty - cy) * (ty - cy)));
        ctx.globalAlpha = 0.9 * Math.sin(tk * Math.PI) * out; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - half, ty); ctx.lineTo(cx + half, ty); ctx.stroke();
        const lg = ctx.createLinearGradient(0, ty - 26, 0, ty + 26);
        lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255," + (0.16 * Math.sin(tk * Math.PI) * out).toFixed(3) + ")"); lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lg; ctx.fillRect(cx - rr, ty - 26, rr * 2, 52); ctx.fillStyle = "#fff"; }
    }

    // ── III. SIGIL: the planet's own mark, drawn edge by edge, then locked ──
    const sk = raw(3.2, 6.0), lock = seg(6.0, 6.4);
    if (sk > 0) {
      const rs = R * 0.185, spin = (1 - seg(3.2, 6.2)) * 1.1;                        // spins down to true as it completes
      const rot = (look.r || 0) + spin;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * TAU - Math.PI / 2; pts.push([Math.cos(a) * rs, Math.sin(a) * rs]); }
      const drawn = sk * sides;                                                       // edges land one after another
      ctx.globalAlpha = (0.5 + 0.5 * lock) * out; ctx.lineWidth = 2.2;
      for (let i = 0; i < sides; i++) { const on = clamp(drawn - i, 0, 1); if (on <= 0) break;
        const p0 = pts[i], p1 = pts[(i + 1) % sides];
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p0[0] + (p1[0] - p0[0]) * on, p0[1] + (p1[1] - p0[1]) * on); ctx.stroke(); }
      ctx.globalAlpha = 0.30 * sk * out; ctx.lineWidth = 1;
      for (let i = 0; i < sides; i++) { const on = clamp(drawn - i, 0, 1); if (on <= 0) break;   // spokes to the vertices
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(pts[i][0] * on, pts[i][1] * on); ctx.stroke(); }
      if (lock > 0) {                                                                 // it fills, and a hard flare goes off
        ctx.globalAlpha = 0.10 * lock * out; ctx.beginPath();
        for (let i = 0; i < sides; i++) { const p = pts[i]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.closePath(); ctx.fill();
        const fk = raw(6.0, 7.0);
        if (fk < 1) { ctx.globalAlpha = (1 - fk) * 0.8 * out; ctx.lineWidth = 5 * (1 - fk) + 0.6;
          ctx.beginPath(); ctx.arc(0, 0, rs * (1 + 1.6 * fk), 0, TAU); ctx.stroke(); } }
      ctx.restore();
    }

    // ── IV. CLAIM: rules run out to the edges under the title ──────────────
    { const k = seg(6.2, 8.4); if (k > 0) {
      const y1 = cy - R * 0.30, y2 = cy + R * 0.30, half = cw * 0.5 * k;
      ctx.globalAlpha = 0.5 * k * out; ctx.lineWidth = 1.4;
      for (const yy of [y1, y2]) { ctx.beginPath(); ctx.moveTo(cx - half, yy); ctx.lineTo(cx + half, yy); ctx.stroke(); }
      ctx.globalAlpha = 0.18 * k * out; ctx.lineWidth = 1;
      for (const yy of [y1 + 5, y2 - 5]) { ctx.beginPath(); ctx.moveTo(cx - half * 0.82, yy); ctx.lineTo(cx + half * 0.82, yy); ctx.stroke(); } } }

    ctx.globalAlpha = 1; ctx.restore();
  }

  function drawMineRig(t, b) {
    const v = S.vault && S.vault[S.galaxy] || {}, buf = clamp(+v.mineBuf || 0, 0, 1);
    // v18.36 CONSTRUCTION (owner: "can we make an animation for building the mine on the planet"): b is
    // 0→1 while the site is being built and 1 forever after. Each part of the complex has its own window
    // on that clock, in the order a mine really goes up — peg the claim, fence it, sink the shaft, hang
    // the winding gear, raise the works, lay the rails, run the belt, and only then does ore come up.
    // Overlapping windows mean something is always in motion; smoothstep keeps every part easing in.
    b = b == null ? 1 : clamp(b, 0, 1);
    const seg = (a0, a1) => { const k = clamp((b - a0) / (a1 - a0), 0, 1); return k * k * (3 - 2 * k); };
    const P = { claim: seg(0, .18), fence: seg(.10, .34), shaft: seg(.28, .52), gear: seg(.46, .64),
                works: seg(.55, .80), rails: seg(.68, .90), belt: seg(.80, .96), ore: seg(.93, 1) };
    // fit the complex to the field: design radius 100 → the perimeter spans ~76% of the short axis
    const R = Math.max(70, Math.min(viewHW(), viewHH()) * 0.78), sc = R / 100;   // sized to the ground you can see
    ctx.save(); ctx.translate(W * 0.5, H * 0.5); ctx.scale(sc, sc);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff";
    const ring = (r, a, w) => { ctx.globalAlpha = a; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };
    const arcTo = (r, a, w, k) => { ctx.globalAlpha = a; ctx.lineWidth = w || 1; ctx.beginPath();   // a ring drawn only k of the way round — how every circular part builds
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k, 0, 1)); ctx.stroke(); };

    // ── the seam, glowing up through the ground ── (it flares while the site is opened, settles after)
    { const bloom = 1 + 2.2 * P.claim * (1 - P.works);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 62), pa = (0.11 + 0.05 * Math.sin(t * 1.3)) * (0.25 + 0.75 * P.claim) * bloom;
      g.addColorStop(0, "rgba(255,255,255," + pa.toFixed(3) + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; }

    // ── pegging the claim: a survey ring runs out to the perimeter before anything is built on it ──
    if (b < 1 && P.claim < 1) { const k = P.claim;
      ring(4 + k * 96, 0.42 * (1 - k * 0.55), 1.6);
      ctx.globalAlpha = 0.5 * (1 - k); ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2, rr = 4 + k * 96;   // survey pegs riding the ring out
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * (rr - 3), Math.sin(a) * (rr - 3)); ctx.lineTo(Math.cos(a) * (rr + 3), Math.sin(a) * (rr + 3)); ctx.stroke(); } }

    // ── perimeter: fenced haul road with gate gaps, floodlights, and a rotating survey sweep ──
    if (P.fence > 0) {
      ctx.globalAlpha = 0.18 * P.fence; ctx.lineWidth = 1; ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.arc(0, 0, 100, -Math.PI / 2, -Math.PI / 2 + TAU * P.fence); ctx.stroke(); ctx.setLineDash([]);
      arcTo(93, 0.10 * P.fence, 1, P.fence);
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2, lx = Math.cos(a) * 100, ly = Math.sin(a) * 100;
        const on = clamp(8 * P.fence - i, 0, 1);   // floodlights strike up one by one behind the fence line
        if (on <= 0) continue;
        const lit = (0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.6 + i))) * on;
        ctx.globalAlpha = lit; ctx.beginPath(); ctx.arc(lx, ly, 1.8, 0, TAU); ctx.fill();
        const cg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26);   // floodlight pool aimed inward
        cg.addColorStop(0, "rgba(255,255,255," + (0.10 * lit).toFixed(3) + ")"); cg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(lx - Math.cos(a) * 12, ly - Math.sin(a) * 12, 26, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; } }
    { const sa = t * (0.55 + 3.4 * (1 - P.works));   // the survey sweep races while the site is being read, then slows to its patrol
      const sg = ctx.createRadialGradient(0, 0, 10, 0, 0, 96);
      sg.addColorStop(0, "rgba(255,255,255," + (0.055 * (0.4 + 0.6 * P.claim) * (1 + 1.4 * (1 - P.works))).toFixed(4) + ")"); sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 96, sa, sa + 0.5); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; }

    // ── ore-cart rails: six spokes from the shaft apron out to the works, sleepers and all ──
    // (they are LAID outward from the apron — rail ends creep out to the works as P.rails runs)
    const SPOKES = 6;
    if (P.rails > 0) for (let i = 0; i < SPOKES; i++) {
      const a = i * TAU / SPOKES + 0.35, ca = Math.cos(a), sa2 = Math.sin(a), nx = -sa2, ny = ca;
      const end = 30 + 58 * P.rails;
      ctx.globalAlpha = 0.3 * P.rails; ctx.lineWidth = 1;
      for (const off of [-1.8, 1.8]) { ctx.beginPath();
        ctx.moveTo(ca * 30 + nx * off, sa2 * 30 + ny * off); ctx.lineTo(ca * end + nx * off, sa2 * end + ny * off); ctx.stroke(); }
      ctx.globalAlpha = 0.16 * P.rails;
      for (let s = 0; s < 10; s++) { const rr = 30 + s * 6.4; if (rr > end) break;
        ctx.beginPath(); ctx.moveTo(ca * rr + nx * 3, sa2 * rr + ny * 3); ctx.lineTo(ca * rr - nx * 3, sa2 * rr - ny * 3); ctx.stroke(); }
      // a cart shuttling the line: out loaded, back empty (loaded carts read solid) — only once the line is down
      if (P.rails >= 1) {
        const ph = ((t * 0.22 + i / SPOKES) % 1), out = ph < 0.5, u = out ? ph * 2 : (1 - ph) * 2;
        const rr = 32 + u * 54, cx2 = ca * rr, cy2 = sa2 * rr;
        ctx.globalAlpha = 0.8; ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(a);
        if (out) { ctx.fillRect(-3, -2.6, 6, 5.2); } else { ctx.lineWidth = 1.1; ctx.strokeRect(-3, -2.6, 6, 5.2); }
        ctx.restore(); }
    }

    // ── the works: processing sheds, silos and the engine house, all in plan ──
    // wa: the works stand up together — each building fades in and grows from its own footprint
    const wa = P.works, shedS = 0.55 + 0.45 * wa;
    const shed = (a, rr, w, h, hatch) => { const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.scale(shedS, shedS);
      ctx.globalAlpha = 0.62 * wa; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 0.22 * wa; ctx.lineWidth = 1;
      for (let k = -w / 2 + 4; k < w / 2; k += 4) { ctx.beginPath(); ctx.moveTo(k, -h / 2); ctx.lineTo(k, h / 2); ctx.stroke(); }   // roof ribs from above
      if (hatch) { ctx.globalAlpha = 0.5 * wa; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke(); }
      ctx.restore(); return { x, y }; };
    shed(0.35 + TAU / SPOKES * 0, 92, 26, 15, true);          // processing plant
    shed(0.35 + TAU / SPOKES * 2, 92, 22, 13, false);         // workshop
    const eng = shed(0.35 + TAU / SPOKES * 4, 92, 20, 16, true);   // engine house (vents steam below)
    // silos: circles with a cross-brace; the FIRST one wears the live ◈ hopper gauge
    const silo = (a, rr, r2) => { const x = Math.cos(a) * rr, y = Math.sin(a) * rr, r3 = r2 * shedS;
      ctx.globalAlpha = 0.6 * wa; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r3, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.28 * wa; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r3, y); ctx.lineTo(x + r3, y); ctx.moveTo(x, y - r3); ctx.lineTo(x, y + r3); ctx.stroke();
      return { x, y }; };
    const hop = silo(0.35 + TAU / SPOKES * 1, 90, 9);
    silo(0.35 + TAU / SPOKES * 1 + 0.28, 78, 5.5);
    // ◈ HOPPER GAUGE — the arc around the main silo IS this mine's real progress to its next core
    { ctx.globalAlpha = 0.9 * wa; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(hop.x, hop.y, 12, -Math.PI / 2, -Math.PI / 2 + buf * TAU); ctx.stroke();
      ctx.globalAlpha = 0.16 * wa; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(hop.x, hop.y, 12, 0, TAU); ctx.stroke();
      ctx.globalAlpha = (0.5 + 0.3 * Math.sin(t * 2.2)) * wa; ctx.font = "7px ui-monospace,monospace"; ctx.textAlign = "center";
      ctx.fillText("◈", hop.x, hop.y + 2.6); }
    // steam venting from the engine house, drifting off the pad — it only breathes once the works are lit
    for (let i = 0; i < 3; i++) { const kk = (t * 0.4 + i / 3) % 1;
      ctx.globalAlpha = 0.22 * (1 - kk) * wa; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(eng.x + Math.cos(0.35 + TAU / SPOKES * 4) * kk * 16, eng.y + Math.sin(0.35 + TAU / SPOKES * 4) * kk * 16, 2 + kk * 9, 0, TAU); ctx.stroke(); }

    // ── conveyor out to the spoil heap: belt with travelling ore, heap drawn as contour rings ──
    if (P.belt > 0) { const a = 0.35 + TAU / SPOKES * 3, ca = Math.cos(a), sa2 = Math.sin(a), nx = -sa2, ny = ca;
      const bend = 34 + 50 * P.belt;   // the gantry is run out to the heap
      ctx.globalAlpha = 0.5 * P.belt; ctx.lineWidth = 1.2;
      for (const off of [-3, 3]) { ctx.beginPath(); ctx.moveTo(ca * 34 + nx * off, sa2 * 34 + ny * off); ctx.lineTo(ca * bend + nx * off, sa2 * bend + ny * off); ctx.stroke(); }
      if (P.belt >= 1) for (let i = 0; i < 5; i++) { const u = (t * 0.3 + i / 5) % 1, rr = 34 + u * 50;
        ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(ca * rr, sa2 * rr, 1.5, 0, TAU); ctx.fill(); }
      const hx = ca * 95, hy = sa2 * 95;   // the heap it feeds — concentric contours, tallest inside; it GROWS as spoil arrives
      for (let k = 0; k < 3; k++) { const hr = (13 - k * 4) * P.belt; if (hr <= 0.5) continue;
        ctx.globalAlpha = (0.34 - k * 0.07) * P.belt; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.stroke(); } }

    // ── the shaft: apron, collar, the dark mouth, and the winding gear turning above it ──
    if (P.shaft > 0) { const sp = P.shaft;
      arcTo(30, 0.3 * sp, 1.4, sp);                       // concrete apron edge, poured round
      ctx.globalAlpha = 0.5 * sp; ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; if (12 * sp < i + 1) break;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.stroke(); }   // apron slabs
      // the mouth opens as the shaft is sunk: the dark bore widens to its full 18
      ctx.globalAlpha = 1; ctx.fillStyle = "#070707"; ctx.beginPath(); ctx.arc(0, 0, 18 * sp, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff";
      ring(18 * sp, 0.8 * sp, 2); ring(13 * sp, 0.3 * sp, 1); ring(8.5 * sp, 0.18 * sp, 1);   // collar + shaft walls receding into the dark
      if (P.gear > 0) { const gp = P.gear, rot = t * 1.5 * (0.15 + 0.85 * gp);   // winding gear seen from above — it is hung, then spins up to speed
        ctx.globalAlpha = 0.75 * gp; ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) { const a = rot + i * TAU / 4;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * (5 + 16 * gp), Math.sin(a) * (5 + 16 * gp)); ctx.stroke(); }
        ring(21 * (0.4 + 0.6 * gp), 0.45 * gp, 1.2);
        // the cage: a square in the mouth that shrinks as it descends, then rides back up — it only runs once the gear is up
        if (gp >= 1) { const ph = (t * 0.16) % 1, depth = ph < 0.5 ? ph * 2 : (1 - ph) * 2, cs = 7 * (1 - depth * 0.72);
          ctx.globalAlpha = 0.35 + 0.5 * (1 - depth); ctx.lineWidth = 1.4;
          ctx.strokeRect(-cs, -cs, cs * 2, cs * 2);
          ctx.beginPath(); ctx.moveTo(-cs, -cs); ctx.lineTo(cs, cs); ctx.moveTo(cs, -cs); ctx.lineTo(-cs, cs); ctx.stroke(); } } }

    // ── ◈ glints rising out of the mouth — the seam paying out (the last thing to happen) ──
    if (P.ore > 0) for (let i = 0; i < 3; i++) { const kk = (t * 0.3 + i / 3) % 1, a = i * 2.1 + t * 0.4;
      const gr = kk * 26, gx = Math.cos(a) * gr, gy = Math.sin(a) * gr, gs = 2.2 + 2.4 * (1 - kk);
      ctx.globalAlpha = 0.75 * (1 - kk) * P.ore; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(gx, gy - gs); ctx.lineTo(gx + gs, gy); ctx.lineTo(gx, gy + gs); ctx.lineTo(gx - gs, gy); ctx.closePath(); ctx.stroke(); }
    ctx.restore();
  }
  // v17.1 PLANET BACKDROP — every world gets a seeded grayscale identity (star density, faint nebulae,
  // a huge ultra-faint watermark of the planet's signature polygon) so a landing LOOKS like a new place
  // at a glance, without breaking the monochrome art or field readability. Rebuilt on planet change/resize.
  let bgCv = null, bgFor = 0, bgW = 0, bgH = 0;
  // A properly mixing seeded PRNG (mulberry32). What came before was a LINEAR hash of its own
  // counter — consecutive draws differed by a constant step, so every scatter taken from it landed
  // on a lattice (this is what laid the backdrop's stars out in rows).
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a;
      x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  function buildBackdrop() {
    const w = Math.max(64, SW | 0), h = Math.max(64, SH | 0);
    if (!bgCv) bgCv = document.createElement("canvas");
    bgCv.width = w; bgCv.height = h; bgFor = S.galaxy; bgW = w; bgH = h;
    const c = bgCv.getContext("2d");
    const rnd2 = rng(Math.imul(S.galaxy * 2654435761 + 13, 40503));
    const base = 6 + Math.floor(rnd2() * 5);
    const g2 = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g2.addColorStop(0, "hsl(0,0%," + (base + 3) + "%)"); g2.addColorStop(1, "#000");
    c.fillStyle = g2; c.fillRect(0, 0, w, h);
    const stars = 60 + Math.floor(rnd2() * 90);                               // star density is part of the world's fingerprint
    c.fillStyle = "#fff";
    for (let i = 0; i < stars; i++) { c.globalAlpha = 0.03 + rnd2() * 0.10; c.beginPath(); c.arc(rnd2() * w, rnd2() * h, 0.5 + rnd2() * 1.4, 0, TAU); c.fill(); }
    for (let i = 0; i < 3; i++) {                                              // faint nebula blobs, seeded positions
      const bx = rnd2() * w, by = rnd2() * h, br = (0.25 + rnd2() * 0.3) * Math.max(w, h);
      const ng = c.createRadialGradient(bx, by, 0, bx, by, br); const lum = 10 + Math.floor(rnd2() * 8);
      ng.addColorStop(0, "hsla(0,0%," + lum + "%,0.10)"); ng.addColorStop(1, "hsla(0,0%,0%,0)");
      c.fillStyle = ng; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill(); }
    // (v17.16, owner call: the huge watermark polygon + circle read as "a random grey triangle and
    // circle with no significance" — removed. World identity now lives in the spawn-rim terrain,
    // dot silhouettes, backdrop seed and currency; the field itself stays clean.)
    c.globalAlpha = 1;
  }
  function render() {
    ctx.clearRect(0, 0, SW, SH);
    if (!bgCv || bgFor !== S.galaxy || bgW !== Math.max(64, SW | 0) || bgH !== Math.max(64, SH | 0)) buildBackdrop();
    ctx.drawImage(bgCv, 0, 0);
    ctx.save();
    ctx.translate(SW / 2, VIEW_CY || SH / 2);                       // the camera frames the PLAY BAND (v18.27), so the middle of the planet is the middle of what you can see
    if (shake > 0.2 && opt("shake")) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    ctx.scale(camZoom, camZoom); ctx.translate(-W / 2, -H / 2);
    drawEnv();   // v17.8: the planet's spawn-rim terrain — under everything that moves
    if (blackholeT > 0) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, TAU); ctx.fill(); }
    for (const b of beams) { const a = clamp(b.life / (b.w > 2 ? 0.13 : 0.08), 0, 1); ctx.strokeStyle = b.color; ctx.globalAlpha = a * 0.25; ctx.lineWidth = (b.w || 2) * 2.4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); ctx.globalAlpha = a; ctx.lineWidth = b.w || 2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // arcing mortar bombs — parabola over the field, ground shadow + target reticle, smoke trail, fused shell
    for (const sh of shells) {
      const k = clamp(sh.t / sh.dur, 0, 1);
      const gx = sh.x0 + (sh.tx - sh.x0) * k, gy = sh.y0 + (sh.ty - sh.y0) * k;   // ground-track point
      const y = gy - Math.sin(k * Math.PI) * sh.arc;                              // lobbed height
      // impact reticle that tightens as the bomb falls
      ctx.globalAlpha = 0.18 + 0.4 * k; ctx.strokeStyle = sh.color; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(sh.tx, sh.ty, Math.max(sh.aoe, 16) * (1.15 - 0.45 * k), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(sh.tx, sh.ty, 2.2, 0, TAU); ctx.stroke();
      // shadow on the ground beneath the shell (shrinks/darkens as it climbs/descends)
      const climb = Math.sin(k * Math.PI);
      ctx.globalAlpha = 0.26 * (1 - climb * 0.6); ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(gx, gy, sh.r * (1.3 - climb * 0.5), sh.r * (0.6 - climb * 0.25), 0, 0, TAU); ctx.fill();
      // smoke trail
      for (let s = 1; s <= 3; s++) { const kk = clamp(k - s * 0.06, 0, 1); const px = sh.x0 + (sh.tx - sh.x0) * kk, py = sh.y0 + (sh.ty - sh.y0) * kk - Math.sin(kk * Math.PI) * sh.arc; ctx.globalAlpha = 0.13 * (1 - s / 4); ctx.fillStyle = "#9a9a9a"; ctx.beginPath(); ctx.arc(px, py, sh.r * (1 - s * 0.16), 0, TAU); ctx.fill(); }
      // the bomb: dark casing, class-tinted core, sparking fuse
      ctx.globalAlpha = 1; ctx.fillStyle = "#161616"; ctx.beginPath(); ctx.arc(gx, y, sh.r + 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(gx, y, sh.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(gx + sh.r * 0.3, y + sh.r * 0.3, sh.r * 0.5, 0, TAU); ctx.fill();   // shaded underside
      const fl = 0.5 + 0.5 * Math.sin(sh.spin * 3);
      ctx.fillStyle = "rgba(255,255,255," + (0.55 + fl * 0.45) + ")"; ctx.beginPath(); ctx.arc(gx, y - sh.r * 0.8, 1.3 + fl * 1.1, 0, TAU); ctx.fill();   // fuse spark
      ctx.globalAlpha = 1;
    }
    const lod = opt("perf") && dots.length > 80;   // render LOD is OFF by default (dots keep their full flare); only the optional Performance-mode setting simplifies per-dot spikes/rings/glyphs on a busy field to save FPS
    for (const d of dots) {
      if (d.boss) { drawBoss(d); continue; }
      const pulse = d.pulse !== undefined ? 1 + 0.12 * Math.sin(d.born * 0.1 + d.pulse * 4) : 1;
      const dr2 = d.r * (d.born < 0.2 ? clamp(d.born / 0.18, 0.2, 1) : 1) * (d.hit > 0 ? 1 + d.hit / 0.08 * 0.28 : 1) * pulse;
      const ga = d.phased ? 0.4 : d.cloaked ? 0.12 : 1;
      // L = this planet's dot signature · gc = a CONTINUOUS menace grade (grows with Value/HP, never plateaus like the old tier cap)
      const L = dotLook(d.pg || S.galaxy), gc = d.menace ? Math.min(13, Math.log2(1 + d.menace) * 1.85) : (d.tier || 0);
      if (d.kind === "swift" || d.kind === "zigzag") { ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 0.12, d.y - d.vy * 0.12); ctx.stroke(); }  // motion streak
      if (d.blink !== undefined && d.bx !== undefined) { const a2 = clamp(0.35 - d.blink * 0.22, 0, 0.35), ghosts = clamp(1 + Math.floor(gc * 0.3), 1, 4); ctx.fillStyle = "#fff"; for (let q = 0; q < ghosts; q++) { const t = (q + 1) / (ghosts + 1); ctx.globalAlpha = a2 * (1 - t * 0.55); ctx.beginPath(); ctx.arc(d.bx + (d.x - d.bx) * (1 - t), d.by + (d.y - d.by) * (1 - t), dr2 * (0.8 - t * 0.3), 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }  // Wraith — teleport after-image trail, longer with Value
      // HP/Value spikes: more & longer the higher the menace grade — keeps growing past the old tier-6 cap
      if (!lod && d.tier >= 1) { ctx.globalAlpha = ga; ctx.strokeStyle = d.color; ctx.lineWidth = 1.4 + Math.min(gc * 0.26, 4); const ns = clamp(3 + Math.floor(gc) * 2, 3, 30); for (let k = 0; k < ns; k++) { const a = d.spin + k / ns * TAU, i0 = dr2 * 0.9, o0 = dr2 + 3 + gc * 1.5; ctx.beginPath(); ctx.moveTo(d.x + Math.cos(a) * i0, d.y + Math.sin(a) * i0); ctx.lineTo(d.x + Math.cos(a) * o0, d.y + Math.sin(a) * o0); ctx.stroke(); } ctx.globalAlpha = 1; }
      // menace AURA — high-grade dots gain a faint outer halo that keeps expanding with Value
      if (!lod && gc > 6) { ctx.globalAlpha = ga * Math.min((gc - 6) * 0.05, 0.3); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 7 + (gc - 6) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      // BODY — per-planet silhouette (polygon/circle) + shade, with the planet's centre glyph
      ctx.globalAlpha = ga; ctx.fillStyle = d.hit > 0 ? "#fff" : d.color; dotBodyPath(ctx, d.x, d.y, dr2, L.s, L.r); ctx.fill();
      if (!lod && d.hit <= 0 && d.kind === "normal" && !d.armored) dotGlyph(ctx, d.x, d.y, dr2, L.g);   // common dots wear the planet glyph (race/elite dots keep their own look)
      ctx.globalAlpha = 1;
      // inner rings (segmented core) — count climbs with the menace grade, not the capped tier
      if (!lod && d.tier >= 2) { ctx.globalAlpha = ga * 0.8; ctx.strokeStyle = "#000"; ctx.lineWidth = 1; const nr = clamp(Math.floor(gc) - 1, 1, 9); for (let k = 1; k <= nr; k++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (k / (nr + 1)), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (d.special) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 3, 0, TAU); ctx.stroke(); }
      if (d.armored) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 - 2, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3, 0, TAU); ctx.stroke(); }
      if (lod) { if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); } continue; }
      if (d.kind === "splitter") { const cells = clamp(2 + Math.floor(gc * 0.4), 2, 5); for (let k = 0; k < cells; k++) { const a = k / cells * TAU + d.spin * 0.5, rr = dr2 * 0.34, cx = d.x + Math.cos(a) * rr, cy = d.y + Math.sin(a) * rr, cr = dr2 * (cells > 3 ? 0.2 : 0.27); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(cx, cy, cr * 0.32, 0, TAU); ctx.fill(); } }   // Cinder brood — dividing cells multiply with Value
      if (d.kind === "zigzag") { const fl = 0.5 + 0.5 * Math.sin(d.spin * 9); ctx.fillStyle = "rgba(255,255,255," + (0.55 + fl * 0.45) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (0.26 + 0.16 * fl), 0, TAU); ctx.fill(); const sparks = clamp(2 + Math.floor(gc * 0.7), 2, 8); ctx.fillStyle = "rgba(255,255,255," + (0.28 + 0.4 * fl) + ")"; for (let k = 0; k < sparks; k++) { const a = d.spin * 2.4 + k / sparks * TAU, rr = dr2 + 2.5 + (k % 3) * 3 + fl * 4; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 1 + fl, 0, TAU); ctx.fill(); } }   // Ember: flickering hot core sheds sparks — fiercer with Value
      // (Verdant Mender's "+" cross is drawn by the d.healAura branch below — no separate branch needed.)
      if (d.kind === "orbiter") { const sc = clamp(d.sat || 0, 0, 8); if (sc > 0) { ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 9, 0, TAU); ctx.stroke(); ctx.fillStyle = "#fff"; for (let k = 0; k < sc; k++) { const a = d.spin * 2 + k / sc * TAU, rr = d.r + 9; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 2.2 + Math.min(gc * 0.1, 1.4), 0, TAU); ctx.fill(); } } }   // Cobalt — satellites track the ACTUAL guard count (vanish as stripped), not a fixed 3
      if (d.kind === "pulsar") { const rings = clamp(1 + Math.floor(gc * 0.4), 1, 4); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; for (let q = 0; q < rings; q++) { const ph = (d.spin * 0.8 + q * 0.55) % 1; ctx.globalAlpha = (1 - ph) * 0.7; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4 + ph * (14 + gc * 2), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }   // Tempest — expanding shock rings, more & wider with Value
      if (d.phase !== undefined) { const rings = clamp(1 + Math.floor(gc * 0.3), 1, 3); ctx.strokeStyle = "rgba(255,255,255,0.78)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); for (let q = 0; q < rings; q++) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5 + q * 4, d.spin + q, d.spin + q + TAU); ctx.stroke(); } ctx.setLineDash([]); if (gc > 4) { ctx.globalAlpha = 0.22; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x + Math.cos(d.spin * 2) * 6, d.y + Math.sin(d.spin * 2) * 6, dr2 * 0.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } }   // Umbra — phasing dashed rings + a ghost double at high Value
      if (d.shield > 0 && d.armorUp === undefined) { ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.globalAlpha = clamp(d.shield / d.shieldMax, 0.25, 1); const plates = clamp(1 + Math.floor(gc * 0.3), 1, 4); for (let q = 0; q < plates; q++) { ctx.lineWidth = 2.5 - q * 0.4; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5 + q * 3, -0.9 - q * 0.08, 0.9 + q * 0.08); ctx.stroke(); } ctx.globalAlpha = 1; }   // Azure bastion — front shield plates (NOT for Frost/juggernaut, which uses d.shield for its own hex armor drawn below)
      if (d.refl > 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8, 0, TAU); ctx.stroke(); }  // reflect flash
      // --- planet-native race visuals ---
      if (d.grow !== undefined) { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.55, 0, TAU); ctx.stroke(); const rings = clamp(1 + Math.floor(gc * 0.4), 1, 4); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; for (let q = 0; q < rings; q++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 3 + q * 4 + Math.sin(d.grow * 2 - q) * 2, 0, TAU); ctx.stroke(); } }   // Hearth bloat — swelling membranes multiply with Value
      if (d.healAura !== undefined) { const pulses = clamp(1 + Math.floor(gc * 0.35), 1, 4); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; for (let q = 0; q < pulses; q++) { const rp = 24 + q * 13 + (d.healAura % 1.2) * 26; ctx.globalAlpha = clamp((0.22 + 0.16 * Math.sin(d.healAura * 9)) * (1 - q * 0.2), 0, 0.4); ctx.beginPath(); ctx.arc(d.x, d.y, rp, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(d.x - dr2 * 0.5, d.y); ctx.lineTo(d.x + dr2 * 0.5, d.y); ctx.moveTo(d.x, d.y - dr2 * 0.5); ctx.lineTo(d.x, d.y + dr2 * 0.5); ctx.stroke(); }   // Verdant mender — expanding heal pulses, more with Value
      if (d.flock) { const a = Math.atan2(d.vy, d.vx), wings = clamp(1 + Math.floor(gc * 0.35), 1, 4); ctx.fillStyle = "#000"; for (let q = 0; q < wings; q++) { const sc2 = 1 - q * 0.16, bx = d.x - Math.cos(a) * q * dr2 * 0.7, by = d.y - Math.sin(a) * q * dr2 * 0.7; ctx.globalAlpha = 1 - q * 0.22; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * dr2 * 0.9 * sc2, by + Math.sin(a) * dr2 * 0.9 * sc2); ctx.lineTo(bx + Math.cos(a + 2.5) * dr2 * 0.6 * sc2, by + Math.sin(a + 2.5) * dr2 * 0.6 * sc2); ctx.lineTo(bx + Math.cos(a - 2.5) * dr2 * 0.6 * sc2, by + Math.sin(a - 2.5) * dr2 * 0.6 * sc2); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; }   // Mistral — chevron trails into a formation with Value
      if (d.cloak !== undefined) { const bands = clamp(1 + Math.floor(gc * 0.3), 1, 3); ctx.strokeStyle = "rgba(255,255,255," + (d.cloaked ? 0.22 : 0.55) + ")"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); for (let q = 0; q < bands; q++) { ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 4 + q * 3, d.spin + q * 1.3, d.spin + q * 1.3 + TAU); ctx.stroke(); } ctx.setLineDash([]); }   // Halcyon — shimmering distortion bands, more with Value
      if (d.armorUp !== undefined) { const plates = clamp(1 + Math.floor(gc * 0.35), 1, 4); ctx.strokeStyle = "#fff"; for (let q = 0; q < plates; q++) { ctx.lineWidth = 2.5 - q * 0.4; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = d.spin * 0.3 + q * 0.26 + k / 6 * TAU, rr = dr2 + 3 + q * 3.5, px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); } }   // Frost — nested hex armor plates thicken with Value
      if (d.deflect) { const facets = clamp(4 + Math.floor(gc * 0.5), 4, 9); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < facets; k++) { const a = d.spin + k / facets * TAU, rr = dr2 + 4, px = d.x + Math.cos(a) * rr, py = d.y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); const gi = Math.floor(d.spin * 1.5) % facets, gA = d.spin + gi / facets * TAU; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x + Math.cos(gA) * (dr2 + 4), d.y + Math.sin(gA) * (dr2 + 4), 1.7, 0, TAU); ctx.fill(); }   // Onyx — more mirror facets + a roving glint with Value
      if (d.bomb) { const fl = 0.5 + 0.5 * Math.sin(d.spin * 7); ctx.fillStyle = "rgba(255,255,255," + (0.4 + fl * 0.6) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * (0.36 + 0.1 * fl + Math.min(gc * 0.02, 0.18)), 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255," + (0.4 + fl * 0.35) + ")"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); const rings = clamp(1 + Math.floor(gc * 0.3), 1, 3); for (let q = 0; q < rings; q++) { const sp = d.spin * (q % 2 ? -1 : 1); ctx.beginPath(); ctx.arc(d.x, d.y, dr2 + 5 + q * 4, sp, sp + TAU); ctx.stroke(); } ctx.setLineDash([]); }   // Pyreling — hotter blast-fuse + warning rings with Value
      if (d.gravity) { const arms = clamp(3 + Math.floor(gc * 0.5), 3, 8); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; for (let k = 0; k < arms; k++) { const rr = dr2 + 6 + (k % 4) * 5, a0 = d.spin * 1.6 + k * (TAU / arms); ctx.beginPath(); ctx.arc(d.x, d.y, rr, a0, a0 + 3.0); ctx.stroke(); } ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.5, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.5, 0, TAU); ctx.stroke(); }   // Abyss — accretion swirl gains arms with Value
      if (d.leech) { const op = 0.22 + 0.32 * Math.abs(Math.sin(d.spin * 4)), mr = dr2 * (0.7 + Math.min(gc * 0.02, 0.18)); ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5 + Math.min(gc * 0.18, 2); ctx.beginPath(); ctx.arc(d.x, d.y, mr, op, Math.PI - op); ctx.stroke(); ctx.beginPath(); ctx.arc(d.x, d.y, mr, Math.PI + op, TAU - op); ctx.stroke(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.22, 0, TAU); ctx.fill(); }   // Devourer — gnashing maw widens & darkens with Value
      if (d.spawner !== undefined) { const brood = clamp(4 + Math.floor(gc * 0.5), 4, 9); ctx.fillStyle = "#fff"; for (let k = 0; k < brood; k++) { const a = d.spin * 1.5 + k / brood * TAU, rr = dr2 * 0.55; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, dr2 * 0.2, 0, TAU); ctx.fill(); } ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255," + (0.3 + 0.3 * Math.sin(d.spin * 6)) + ")"; ctx.beginPath(); ctx.arc(d.x, d.y, dr2 * 0.13, 0, TAU); ctx.fill(); }   // Null Spawn — brood multiplies with Value + pulsing core
      if (d.hp < d.maxHp) { const f = clamp(d.hp / d.maxHp, 0, 1); ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2, 3); ctx.fillStyle = "#fff"; ctx.fillRect(d.x - d.r, d.y - d.r - 7, d.r * 2 * f, 3); }
    }
    for (const o of orbs) {
      const life = clamp(1 - o.t / ORB_LIFE, 0, 1), rr = (o.r0 || 3) + (o.consume > 0 ? Math.sin(o.consume * 30) * 1.2 : 0);
      ctx.globalAlpha = 0.35 + 0.65 * life; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(o.x, o.y, rr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      if (o.consume > 0 && o.consumeMax > 0.2) { const f = clamp(o.consume / o.consumeMax, 0, 1); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(o.x, o.y, rr + 4, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.stroke(); }  // consume progress
    }
    const n = (planetMeta(S.galaxy).conquered && !wardenOn) ? 0 : S.units.length;   // v18.6 settled worlds: the army stands down — nothing to fight, nothing deployed. v18.18: it WAKES for the mine-warden duel
    for (let i = 0; i < n; i++) {
      const u = S.units[i], p = unitPos(i, n); p.x += u.rx || 0; p.y += u.ry || 0;
      const c = cls(u.type);
      // every defender shows its targeting radius — faint by default, highlighted when selected
      { const sel = i === selUnit; ctx.strokeStyle = sel ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.07)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, uRange(u), 0, TAU); ctx.stroke(); }
      // --- build-reflecting visuals (strictly black & white, no idle motion): barrels = fire rate
      //     (+multishot), length = range, thickness/body size = damage, silhouette = class ---
      const barrels = clamp(Math.max(1 + Math.floor(Math.log(Math.max(c.rate, 1)) / Math.log(2.2)), 1 + (c.multi || 0)), 1, 6);
      const blen = 13 + Math.min(uRange(u) - DEF_TYPES[u.type].range, 260) * 0.04;
      const bw = 2.6 + Math.min(Math.log10(c.dmg + 1) * 1.7, 6.5);
      const bodyR = (u.type === "turret" ? 11 : 9) + Math.min(Math.log10(c.dmg + 1) * 1.4, 6);
      const aim = u.aim != null ? u.aim : -Math.PI / 2;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(aim); ctx.lineCap = "round";
      if (u.type === "mortar") {
        // MORTAR: not barrels but a single fat, stubby launch tube on a base plate with a bipod —
        // recoils on its kick, flares at the muzzle, reads instantly as a lob weapon not a gun.
        const recoil = u.flash > 0 ? (u.flash / 0.08) * 3 : 0;          // tube kicks back when it fires
        const tubeW = bw + 5.5, tEnd = bodyR + 8 + Math.min(uRange(u) - DEF_TYPES.mortar.range, 150) * 0.02 - recoil, tBeg = -bodyR * 0.55 - recoil;
        // heavy base plate seated under the tube (perpendicular slab)
        ctx.fillStyle = "#262626"; ctx.beginPath(); ctx.ellipse(-bodyR * 0.15, 0, bodyR * 0.55, bodyR * 1.05, 0, 0, TAU); ctx.fill();
        // bipod legs splaying out near the muzzle
        ctx.strokeStyle = "#383838"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
        for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tEnd * 0.5, 0); ctx.lineTo(tEnd * 0.42, sgn * (bodyR + 6)); ctx.stroke(); }
        // the tube — thick dark casing with a bright bore stripe, taper to a reinforced muzzle
        ctx.strokeStyle = "#1c1c1c"; ctx.lineWidth = tubeW + 2.5; ctx.beginPath(); ctx.moveTo(tBeg, 0); ctx.lineTo(tEnd, 0); ctx.stroke();
        ctx.strokeStyle = "#454545"; ctx.lineWidth = tubeW; ctx.beginPath(); ctx.moveTo(tBeg, 0); ctx.lineTo(tEnd, 0); ctx.stroke();
        ctx.strokeStyle = "#cfcfcf"; ctx.lineWidth = Math.max(1.2, tubeW * 0.34); ctx.beginPath(); ctx.moveTo(tBeg + 1, 0); ctx.lineTo(tEnd - tubeW * 0.4, 0); ctx.stroke();
        // muzzle collar + dark bore mouth
        ctx.fillStyle = "#e8e8e8"; ctx.beginPath(); ctx.arc(tEnd, 0, tubeW * 0.7, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0a0a0a"; ctx.beginPath(); ctx.arc(tEnd, 0, tubeW * 0.42, 0, TAU); ctx.fill();
        if (u.flash > 0) { const a = u.flash / 0.08; ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.beginPath(); ctx.arc(tEnd + 3, 0, tubeW * 0.7 + 5 * a, 0, TAU); ctx.fill(); }   // muzzle blast on launch
      } else {
        for (let b = 0; b < barrels; b++) {
          const off = (b - (barrels - 1) / 2) * (bw + 2.4);
          ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = bw + 1.6; ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
          ctx.strokeStyle = "#e6e6e6"; ctx.lineWidth = Math.max(1, bw * 0.5); ctx.beginPath(); ctx.moveTo(bodyR * 0.3, off); ctx.lineTo(blen, off); ctx.stroke();
          if (u.flash > 0) { const a = u.flash / 0.08; ctx.fillStyle = "rgba(255,255,255," + a + ")"; ctx.beginPath(); ctx.arc(blen + 1, off, bw * 0.55 + 2 * a, 0, TAU); ctx.fill(); }   // brief white muzzle flash only while firing
        }
        // RANGE branch (Scope · Range Finder · Laser Sight · Long Barrel): a faint sight line creeps past the muzzle, one notch longer per range node
        if (c.n.range > 0) { const sl = Math.min(5 + c.n.range * 3.5, 40); ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(blen + 2, 0); ctx.lineTo(blen + 2 + sl, 0); ctx.stroke(); }
      }
      ctx.restore();
      // --- body (size = damage) · distinct per-class silhouette: turret circle · mortar hex · plasma diamond · laser triangle · railgun square ---
      const shp = { mortar: [6, 0], plasma: [4, Math.PI / 4], laser: [3, -Math.PI / 2], railgun: [4, 0], nova: [8, Math.PI / 8] }[u.type];   // nova = octagon "void burst"
      const body = r => { if (!shp) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); } else { ctx.beginPath(); for (let k = 0; k < shp[0]; k++) { const a = shp[1] + k / shp[0] * TAU, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); } };
      ctx.fillStyle = "#222"; body(bodyR + 3.5);
      ctx.fillStyle = uColor(u); body(bodyR);
      // DAMAGE branch (Reinforced Rounds · Tungsten Core · Heavy Slugs · Armor Piercing): reinforcement rivets stud the body, one per damage node
      { const nD = Math.min(c.n.dmg, 9); for (let k = 0; k < nD; k++) { const a = -Math.PI / 2 + k / Math.max(nD, 1) * TAU; ctx.fillStyle = "rgba(0,0,0,0.34)"; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * bodyR * 0.6, p.y + Math.sin(a) * bodyR * 0.6, 1.1, 0, TAU); ctx.fill(); } }
      if (uCrit(u) > 0.2) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.arc(p.x - bodyR * 0.3, p.y - bodyR * 0.3, Math.min(uCrit(u) * 3.5, 3), 0, TAU); ctx.fill(); }   // crit = small dark inset on the body (reads on bright units)
      const iq = Math.min(1, uInt(u));   // Mind = a faint STATIC concentric ring, brighter the smarter — no motion, no colour
      if (iq > 0.05) { ctx.strokeStyle = "rgba(255,255,255," + (0.1 + 0.35 * iq) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, bodyR + 5, 0, TAU); ctx.stroke();
        // MIND branch (Targeting Chip · Threat Sense · Squad Link): sensor ticks notch the ring, one per mind node
        const nM = Math.min(c.n.int, 10); for (let k = 0; k < nM; k++) { const a = -Math.PI / 2 + k / Math.max(nM, 1) * TAU; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * (bodyR + 3.5), p.y + Math.sin(a) * (bodyR + 3.5)); ctx.lineTo(p.x + Math.cos(a) * (bodyR + 6.5), p.y + Math.sin(a) * (bodyR + 6.5)); ctx.stroke(); } }
      if (c.multi) { for (let k = 0; k < c.multi; k++) { const a = -Math.PI / 2 + (k - (c.multi - 1) / 2) * 0.46; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * (bodyR + 8.5), p.y + Math.sin(a) * (bodyR + 8.5), 1.5, 0, TAU); ctx.fill(); } }   // static white pips = keystones (multishot/spec level)
      ctx.fillStyle = "#000"; ctx.font = "bold 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(DEF_TYPES[u.type].name[0], p.x, p.y + 1);
      const tot = allocCount(u.type); if (tot) { ctx.fillStyle = "#fff"; ctx.font = "9px ui-monospace,monospace"; ctx.fillText("" + tot, p.x, p.y - bodyR - 11); }
    }
    ctx.textBaseline = "alphabetic";
    // v18.18 SETTLED CALM: collectors don't deploy on a settled world either (owner: "nothing to do
    // with my weapons and stuff — I want to see the mine at work") — the field is world + mine only
    if (!(planetMeta(S.galaxy).conquered && !wardenOn)) for (const dr of drones) {
      const mode = COL_TYPES[dr.type].mode, sr = cReachD(dr);
      // hive wingmate 0 also draws the shared hive radius — v18.18 (owner: "make the swarm's radius
      // more obvious"): a clearly visible breathing dashed ring with a slow dash crawl, plus a whisper
      // of fill, so the group's roaming territory reads at a glance
      if (dr.wing === 0) { const h = hiveAnchors[dr.hive]; if (h) {
        const breathe = 0.22 + 0.08 * Math.sin(performance.now() / 460 + dr.hive * 2);
        ctx.fillStyle = "rgba(255,255,255,0.025)"; ctx.beginPath(); ctx.arc(h.x, h.y, HIVE_R, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255," + breathe.toFixed(3) + ")"; ctx.lineWidth = 1.5; ctx.setLineDash([7, 9]); ctx.lineDashOffset = -performance.now() / 90;
        ctx.beginPath(); ctx.arc(h.x, h.y, HIVE_R, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; } }
      // collectors reflect their build too (all monochrome): outer ring = gather RADIUS (Reach),
      // inner dot = the mouth (grab point), maw size = Process/Ingest, trail length = Speed.
      ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, sr, 0, TAU); ctx.stroke();   // Reach (engagement radius)
      if (mode !== "hole") { ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dr.x, dr.y, MOUTH, 0, TAU); ctx.stroke(); }   // mouth (fixed grab distance)
      const sp = Math.hypot(dr.vx || 0, dr.vy || 0);
      if (mode !== "hole" && sp > 25) { const tl = Math.min(sp * 0.06, 22), ux2 = (dr.vx || 0) / (sp || 1), uy2 = (dr.vy || 0) / (sp || 1); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dr.x - ux2 * tl, dr.y - uy2 * tl); ctx.lineTo(dr.x, dr.y); ctx.stroke(); }   // speed trail — length scales with Speed
      const cs = (1 + Math.min(Math.log10(cIngest(dr.type)) * 0.5, 1.4)) * (1 + Math.max(0, dr.pop || 0) * 1.6);   // Process -> bigger maw; chomp-pop when banking big loot
      ctx.save(); ctx.translate(dr.x, dr.y); ctx.scale(cs, cs);
      if (mode === "hole") {
        const worm = dr.type === "wormhole", rings = worm ? 5 : 3, rot = Date.now() / (worm ? 420 : 600) * (worm ? -1 : 1);   // Wormhole spins tighter, more accretion rings, counter-rotating — distinct from the Black Hole
        for (let k = 0; k < rings; k++) { ctx.strokeStyle = "rgba(255,255,255," + (0.55 - k * (worm ? 0.09 : 0.13)) + ")"; ctx.lineWidth = worm ? 2.4 : 2; ctx.beginPath(); ctx.arc(0, 0, (worm ? 6 : 7) + k * (worm ? 4 : 5), rot + k, rot + k + 4.2); ctx.stroke(); }
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, worm ? 7 : 6, 0, TAU); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = worm ? 2 : 1.5; ctx.stroke();
      } else if (dr.type === "swarm") {
        // v18.4: each wingmate is its own small tri-rotor body (the old single token drew 3 orbiting dots — those dots are now real drones)
        ctx.rotate(Date.now() / 240 + (dr.wing || 0) * 2.1); ctx.fillStyle = "#eee";
        for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 2.2, 0, TAU); ctx.fill(); }
      } else {
        ctx.rotate(Date.now() / 300); ctx.fillStyle = "#ddd"; ctx.fillRect(-6, -6, 12, 12);
        // PROCESS/INGEST branch (Quick Gulp · Maw Servo · Devourer): maw teeth, one per Ingest node
        const nI = Math.min(cls(dr.type).n.ingest, 8); ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1; for (let k = 0; k < nI; k++) { const a = k / nI * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (trail.length) { ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 16; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); for (let i = 0; i < trail.length; i++) { const tp = trail[i]; i ? ctx.lineTo(tp.x, tp.y) : ctx.moveTo(tp.x, tp.y); } ctx.stroke(); }
    drawParts();
    ctx.restore();
    if (conqCardT > 0) drawConquestCine(CONQ_CINE - conqCardT);
    else if (coreFx) drawCoreFx(coreFx.t, coreFx.n);   // v18.45: never both — the film owns the screen while it runs   // v18.38: screen-space, over the world, under the DOM furniture
    // v18.15 SABER COMBO meter — screen-space, under the top bar, only while the chain is alive.
    // Fill = heat toward ×5; the readout dims once the grace window lapses and the chain is draining.
    // v18.20 COMBO METER, juiced (owner: "remove the emoji and make the bar more juicy"): no glyph —
    // the readout IS the juice. It punches on every heat gain, the fill glows and shimmers, a bright
    // leading edge rides the tip, tick marks mark each whole ×, and MAX strobes the whole rig.
    if (state === "play" && comboMul > 1.02 && (!planetMeta(S.galaxy).conquered || wardenOn)) {
      const cm01 = (comboMul - 1) / 4, draining = comboT <= 0, maxed = comboMul >= 4.99;
      const cy = Math.max(150, SH * 0.185);   // v18.16 (owner: "the metre is blocked") — clear of the DOM top bar even with notch safe-area insets pushing it down
      const now = performance.now(), pop = comboPopT > 0 ? comboPopT / 0.25 : 0;   // 1 → 0 punch envelope
      const BW = 150, bx = SW / 2 - BW / 2, by = cy + 9, BH = 7;
      ctx.save(); ctx.textAlign = "center";
      // ── the number: scales up on each gain, glows harder the hotter the chain, strobes at MAX ──
      const heat = cm01, strobe = maxed ? 0.5 + 0.5 * Math.sin(now / 90) : 0;
      ctx.save(); ctx.translate(SW / 2, cy); ctx.scale(1 + pop * 0.22, 1 + pop * 0.22);
      ctx.globalAlpha = draining ? 0.42 : 0.9;
      ctx.shadowColor = "rgba(255,255,255," + (0.35 + 0.5 * heat + 0.3 * strobe).toFixed(3) + ")";
      ctx.shadowBlur = 8 + 20 * heat + 14 * pop + 10 * strobe;
      ctx.fillStyle = "#fff"; ctx.font = "800 " + (16 + 5 * heat).toFixed(1) + "px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillText("COMBO ×" + comboMul.toFixed(1) + (maxed ? "  MAX" : ""), 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
      // ── track ──
      ctx.globalAlpha = draining ? 0.3 : 0.75;
      ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(bx, by, BW, BH);
      ctx.strokeStyle = "rgba(255,255,255," + (0.18 + 0.25 * heat).toFixed(3) + ")"; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, BW + 1, BH + 1);
      // ── fill: gradient body + a travelling shimmer band, brighter as the chain heats ──
      const fw = Math.max(0, BW * cm01);
      if (fw > 0) {
        const g = ctx.createLinearGradient(bx, 0, bx + fw, 0);
        g.addColorStop(0, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0.95)");
        ctx.fillStyle = g; ctx.fillRect(bx, by, fw, BH);
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by, fw, BH); ctx.clip();
        const sx = bx + ((now / 620) % 1) * (fw + 40) - 20;   // shimmer sweep
        const sg = ctx.createLinearGradient(sx - 16, 0, sx + 16, 0);
        sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255," + (0.35 + 0.3 * heat).toFixed(3) + ")"); sg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sg; ctx.fillRect(sx - 16, by, 32, BH); ctx.restore();
        // leading edge: a hot cap + a bloom that flares on every gain
        ctx.fillStyle = "#fff"; ctx.fillRect(bx + fw - 2, by - 1.5, 2.5, BH + 3);
        ctx.globalAlpha = (draining ? 0.3 : 0.75) * (0.35 + 0.65 * pop);
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 10 + 16 * pop;
        ctx.fillRect(bx + fw - 2, by - 1.5, 2.5, BH + 3); ctx.shadowBlur = 0;
      }
      // ── tick marks at each whole × (2,3,4,5): passed ticks glow, upcoming ones stay faint ──
      for (let k = 1; k <= 4; k++) { const tx = bx + BW * (k / 4), passed = cm01 >= k / 4 - 1e-6;
        ctx.globalAlpha = (draining ? 0.3 : 0.8) * (passed ? 0.95 : 0.3);
        ctx.fillStyle = "#fff"; ctx.fillRect(tx - 0.5, by - (passed ? 3 : 2), 1, BH + (passed ? 6 : 4)); }
      // ── MAX: a bright frame pulsing around the whole meter ──
      if (maxed) { ctx.globalAlpha = 0.25 + 0.45 * strobe; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 4.5, by - 4.5, BW + 9, BH + 9); }
      ctx.restore();
    }
    // v18.10 SETTLED BANNER (owner: "money going up but I don't see dots spawning") — a settled world
    // must SAY what it is doing, or peace reads as a bug. Screen-space, quiet, always on while parked.
    // v18.38: NOT during the conquest cinematic — the banner is a settled world's standing sign, and
    // spelling out the spoils, the mine and the launch over the film gives away every beat of it.
    if (state === "play" && !S.travel && planetMeta(S.galaxy).conquered && !wardenOn && conqCardT <= 0) {
      const v = S.vault[S.galaxy] || {}, cy = Math.max(70, SH * 0.10) + 26, breathe = 0.85 + 0.15 * Math.sin(performance.now() / 900);
      ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      const head = "✦ WORLD SETTLED — NO MORE ENEMIES HERE";
      const body = [
        settleSpoils(S.galaxy) > 0 ? "⚑ victory spoils — settlement pays " + curSym(S.galaxy) + " " + fmt(settleIncomeRate()) + "/s while they last" : "settlement pays " + curSym(S.galaxy) + " " + fmt(settleIncomeRate()) + "/s — the frontier is where the money is",
        v.mine ? "⛏ core mine digging " + fmtMineRate(mineRate(S.galaxy)) + " — progress in the panel below" : "⛏ ◈ core mine — the site is going up, panel below",
        "launch ⟶ the next frontier when your wallet is ready",
      ];
      // v18.27: fit to the SCREEN, not to one phone — these lines used fixed 20/13px and ran off the
      // edge of a narrow handset. Shrink until the longest line fits, and keep the body one size.
      // 132px of headroom keeps the lines clear of the right-hand HUD rail (menu / minimise / cores)
      const fitPx = (lines, px, weight) => { const cap = SW - 132;
        for (; px > 9; px--) { ctx.font = weight + " " + px + "px 'Space Grotesk', system-ui, sans-serif";
          if (lines.every(l => ctx.measureText(l).width <= cap)) break; }
        return px; };
      const hp = fitPx([head], 20, "600"), bp = fitPx(body, 13, "500"), lh = bp + 6;
      ctx.globalAlpha = 0.34 * breathe; ctx.font = "600 " + hp + "px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillText(head, SW / 2, cy);
      ctx.globalAlpha = 0.30; ctx.font = "500 " + bp + "px 'Space Grotesk', system-ui, sans-serif";
      body.forEach((l, i) => ctx.fillText(l, SW / 2, cy + 24 + i * lh));
      ctx.restore();
    }
    drawWarp();   // v17.23: the 7s hyperspace transit — screen-space, over everything, under the flash
    if (flash > 0 && opt("flash")) { ctx.fillStyle = "rgba(255,255,255," + Math.min(0.55, flash * 0.6) + ")"; ctx.fillRect(0, 0, SW, SH); }
  }
  /* ── v17.23 WARP CINEMATIC (owner call: "a 7 second cinematic, super trippy and amazing") ──
     While an expedition is in transit the screen becomes the tunnel: 150 hyperspace starlines
     streaking out of the vanishing point, five expanding counter-rotating DASHED rings, three
     breathing vortex arms, the whole frame slowly rolling like a ship in a spin — and in the
     final seconds the DESTINATION planet's signature polygon rushes up out of the void and the
     screen whites out into the landing cinematic. All monochrome, all procedural, zero assets. */
  let warpStars = [], warpFor = "";
  function buildWarp() {
    warpFor = S.travel ? S.travel.from + ">" + S.travel.to : "";
    warpStars = [];
    for (let i = 0; i < 150; i++) warpStars.push({ a: Math.random() * TAU, d: 8 + Math.random() * Math.max(SW, SH) * 0.6, v: 1.5 + Math.random() * 5, w: 0.6 + Math.random() * 2 });
  }
  function drawWarp() {
    if (!S.travel || !S.travel.dur) return;
    const k = clamp((S.travel.t || 0) / S.travel.dur, 0, 1), now = performance.now() / 1000;
    if (!warpStars.length || warpFor !== S.travel.from + ">" + S.travel.to) buildWarp();
    const w = SW, h = SH, R = Math.hypot(w, h);
    const inten = k < 0.12 ? k / 0.12 : k > 0.82 ? Math.max(0.35, (1 - k) / 0.18) : 1;   // ramp in → cruise → converge
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.5 + k * 3);                                  // the field dissolves into the tunnel
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.sin(now * 0.7) * 0.22 + k * 0.7);                            // drunken roll — the ship is spinning
    const breathe = 1 + Math.sin(now * 2.3) * 0.04 * inten; ctx.scale(breathe, breathe);
    ctx.strokeStyle = "#fff"; ctx.lineCap = "round";
    for (const st of warpStars) {                                                // hyperspace starlines
      st.d += st.v * (0.6 + inten * 4.2); if (st.d > R * 0.75) st.d = 8 + Math.random() * 60;
      const len = st.d * (0.1 + inten * 0.55), c1 = Math.cos(st.a), s1 = Math.sin(st.a);
      ctx.globalAlpha = Math.min(1, 0.12 + st.d / (R * 0.35)) * (0.35 + inten * 0.65);
      ctx.lineWidth = st.w * (0.5 + inten * 1.1);
      ctx.beginPath(); ctx.moveTo(c1 * st.d, s1 * st.d); ctx.lineTo(c1 * (st.d + len), s1 * (st.d + len)); ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {                                                // the tunnel: expanding dashed rings, counter-rotating
      const ph = (now * (0.34 + i * 0.11) + i * 0.37 + k * 1.7) % 1, r = ph * ph * R * 0.62 + 14;
      ctx.globalAlpha = (1 - ph) * 0.5 * inten; ctx.lineWidth = 1.5 + ph * 5;
      ctx.setLineDash([12 + i * 9, 20 + i * 6]); ctx.lineDashOffset = now * (i % 2 ? 170 : -140);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let s2 = 0; s2 < 3; s2++) {                                             // vortex arms, breathing and counter-spinning
      ctx.globalAlpha = 0.32 * inten; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a2 = 0; a2 < 5.6; a2 += 0.12) {
        const rr = 18 + a2 * a2 * 13 + Math.sin(now * 3 + a2 * 3 + s2 * 2) * 9;
        const aa = a2 + s2 * (TAU / 3) + now * (s2 % 2 ? 1.15 : -0.95);
        const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr;
        a2 ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    if (k > 0.66) {                                                              // the destination rises out of the void
      const kk = (k - 0.66) / 0.34, RD = kk * kk * Math.min(w, h) * 0.3 + 4, sides = 3 + ((S.travel.to - 1) % 7);
      ctx.rotate(now * 0.45);
      ctx.globalAlpha = Math.min(1, kk * 1.2); ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) { const aa = -Math.PI / 2 + i / sides * TAU; i ? ctx.lineTo(Math.cos(aa) * RD, Math.sin(aa) * RD) : ctx.moveTo(Math.cos(aa) * RD, Math.sin(aa) * RD); }
      ctx.stroke();
      ctx.globalAlpha = kk * 0.5; ctx.beginPath(); ctx.arc(0, 0, RD * 0.62, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    if (k > 0.92) { ctx.globalAlpha = (k - 0.92) / 0.08; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }   // white-out → the landing cinematic takes it from here
  }

  /* ----------------------------- HUD ----------------------------- */
  // v18.13 SETTLED DOCK (owner ask: "when I visit the planet I should see the mine at work and how
  // long until it produces me a reward — drop the normal upgrades menu"): a settled world has no
  // enemies, no firing units and nothing worth shopping for, so the tabs/list/abilities dock is dead
  // weight there. syncHUD swaps the whole shop for THIS panel: the mine's live dig (or its ⛏ BUILD
  // offer when unbuilt), a progress bar + countdown to the next whole ◈, and the income you're
  // actually living on while parked. LAUNCH stays — the panel funds it, not replaces it.
  function renderSettlePanel() {
    const sp = $("settle-panel"); if (!sp) return;
    const g = S.galaxy, built = mineBuilt(g), now = performance.now();
    const vg = S.vault && S.vault[g];
    const buf = clamp(+(vg && vg.mineBuf) || 0, 0, 1);   // v18.18: THIS planet's OWN hopper — every mine runs its own independent timeline
    const rate = mineRate(g);
    let secs = -1;
    if (built && rate > 0) secs = Math.max(0, (1 - buf) * 86400 / rate);
    const bp = mineBuildP();   // v18.36: while the site assembles, the panel reports the build, not the dig
    // bp<1 is its OWN key term: the bucketed progress below is identical at 0.96 and at 1.0, so without it
    // the panel would sit on "BUILDING THE SITE" until some other term happened to move
    const key = [g, built ? 1 : 0, Math.floor(secs / 30), Math.floor(buf * 200), bp < 1 ? 1 : 0, Math.ceil(bp * 12)].join("|");
    if (key === settleKey && now - settleLast < 900) return;          // ~1Hz rebuild, and only when something visible moved
    settleKey = key; settleLast = now;
    const fmtEta = s => { if (!(s >= 0)) return "…"; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d > 0 ? d + "d " + h + "h" : h > 0 ? h + "h " + m + "m" : m > 0 ? m + "m" : "<1m"; };
    let html = '<div class="sp-head">⛏ SETTLEMENT — ' + galName(g).toUpperCase() + '</div>';
    if (built && bp < 1) {
      const step = bp < .18 ? "pegging out the claim" : bp < .34 ? "fencing the site" : bp < .52 ? "sinking the shaft"
                 : bp < .64 ? "hanging the winding gear" : bp < .80 ? "raising the works" : bp < .96 ? "laying the ore road" : "running the belt";
      html += '<div class="sp-mine"><div class="sp-dig">⛏ BUILDING THE SITE — ' + step + '</div>'
           + '<div class="sp-bar"><div class="sp-fill" style="width:' + (bp * 100).toFixed(0) + '%"></div></div>'
           + '<div class="sp-eta">the seam pays as soon as the headframe turns</div></div>';
    } else if (built) {
      html += '<div class="sp-mine"><div class="sp-dig">◈ CORE MINE at work — digging ' + fmtMineRate(rate) + '</div>'
           + '<div class="sp-bar"><div class="sp-fill" style="width:' + (buf * 100).toFixed(1) + '%"></div></div>'
           + '<div class="sp-eta">next ◈ from THIS mine in <b>' + fmtEta(secs) + '</b></div></div>';
    } else {
      // v18.18 THE WARDEN OPTION (owner: "rather than sit AFK saving up"): the duel is the ACTIVE
      // route to the mine — its hoard pays the exact build price.
      // v18.40: a settled world ALWAYS has its mine — the seam came off the keeper with the planet, and
      // v18.40's migration back-fills anything conquered under the old rules. This branch is the safety
      // net only, and it still offers no way to buy one.
      html += '<div class="sp-note">⛏ the ◈ seam on this world is unclaimed — it came with the planet and will be sunk shortly.</div>';
    }
    const spl = settleSpoils(g);
    html += '<div class="sp-inc">' + (spl > 0
         ? '⚑ <b>victory spoils</b> — settlement pays <b>+' + curSym(g) + ' ' + fmt(settleIncomeRate()) + '/s</b> (×' + SETTLE_ON_SITE + ') until ' + curSym(g) + ' ' + fmt(spl) + ' is paid out'
         : 'settlement pays <b>+' + curSym(g) + ' ' + fmt(settleIncomeRate()) + '/s</b> — spoils spent; the frontier is where the money is')
         + '</div>';
    sp.innerHTML = html;
  }
  function syncHUD() {
    const bg = empireIdleRate();
    const cq = S.conquest || 1, cqStr = cq < 100 ? cq.toFixed(1) : fmt(cq);   // fmt() floors small numbers (1.8→"1"), so keep a decimal while the multiplier is small
    { const uc = $("ui-cash"); uc.textContent = curSym(S.galaxy) + " " + fmt(S.cash);
      // juice: bump the counter when cash GROWS — throttled so a steady trickle breathes instead of strobing
      const nowMs = performance.now();
      if (S.cash > hudCashLast && nowMs - hudBumpT > 400) { hudBumpT = nowMs; uc.classList.remove("bump"); void uc.offsetWidth; uc.classList.add("bump"); }
      hudCashLast = S.cash; }
    $("ui-cap").textContent = "cap " + fmt(derived.capacity) + (cq > 1.001 ? "  ·  ✦×" + cqStr : "") + (bg > 0 ? "  ·  +" + fmt(bg) + "/s idle" : "");   // v17.29 (owner ask): the CASH CEILING lives right under your credits — you always see what you're saving against (amber when pinned)
    { const cpsEl = $("ui-cps"); if (cpsEl) cpsEl.textContent = "+" + curSym(S.galaxy) + fmt(Math.max(0, cps)) + "/s"; }
    // v18.47: the loot-rot readout, right under the income it is eating. Only appears once a QUARTER of
    // your money is timing out on the floor — below that some loss is intended tension (see ORB_LIFE),
    // above it your collectors are the bottleneck and nothing else on screen was saying so.
    // v18.51 ASCEND PROMPT (owner call). Late in a run one rung costs half an hour of income — that
    // is not a stall, it is the run telling you to cash it in. Shown only when ascending would
    // actually BANK something, so it can never nag a player who is still progressing.
    { const ah = $("ui-ascend-hint");
      if (ah) { const pend = pendingCores();
        let cheap = Infinity;
        for (const u of UPS) { if (u.max != null && S.lv[u.id] >= u.max) continue; cheap = Math.min(cheap, upCost(u)); }
        const secs = cps > 0 ? cheap / cps : Infinity;
        const due = pend >= 1 && isFinite(secs) && secs > ASC_HINT_S && state === "play";
        ah.textContent = due ? "\u25c8 next upgrade is " + Math.round(secs / 60) + " min away \u2014 ascending banks " + pend + " \u25c8" : "";
        ah.classList.toggle("show", !!due); } }
    { const lk = $("ui-leak"), pct = leakPct(), bad = pct >= 0.25 && (leakLost + leakGot) > 0;
      if (lk) { lk.textContent = bad ? "\u25b2 " + Math.round(pct * 100) + "% of your loot is rotting - upgrade collectors" : "";
                lk.classList.toggle("show", !!bad); } }   // live ACTIVE income rate beside the total, always visible while playing
    $("ui-cash").classList.toggle("capped", S.cash >= derived.capacity * 0.999);   // pulse when at the currency ceiling
    { const p = pendingCores(), ab = $("ascend-n"); if (ab) ab.textContent = "+" + fmt(p); const abtn = $("btn-ascend"); if (abtn) { abtn.classList.toggle("has", p >= 5);   // the ALWAYS-VISIBLE offer (v16.0): what ascending right now banks; glows once it's a real haul
      const wl = wallAhead(); abtn.classList.toggle("wall", wl);   // v16.2 ladder coach: this bar now outprices a hop — ascending is the FASTER route, and the button burns amber until you take it
      const wt = wl ? "THE WALL IS HERE — ascend & return stronger" : "Ascension"; if (abtn.title !== wt) abtn.title = wt;
      if (p > hudGemLast) { abtn.classList.remove("bump"); void abtn.offsetWidth; abtn.classList.add("bump"); }   // juice: the pending pot pops whenever it grows
      hudGemLast = p; } }
    $("ui-galaxy").textContent = S.galaxy; $("ui-gname").textContent = galName(S.galaxy) + " · " + sysName(S.galaxy);
    const tgt = conquerTarget(S.galaxy), conq = planetMeta(S.galaxy).conquered;
    $("galaxy-fill").style.width = clamp(conq ? 1 : curEarned / tgt, 0, 1) * 100 + "%";
    const last = S.galaxy >= TOTAL_PLANETS;
    let label, dis = true, ready = false, enroute = false;
    if (S.travel) { enroute = true; label = "⟶ IN WARP…"; dis = true; }   // v17.29: travel is a 7s cinematic — pay-to-skip removed (there is nothing to skip)
    else if (wardenOn) { const wd = dots.find(d => d.warden); label = "⛏ WARDEN DUEL" + (wd ? "  ·  " + Math.max(0, Math.ceil((wd.ttl || 60) - (wd.life || 0))) + "s" : ""); dis = true; }   // v18.21: the order is explicit — settle the duel, then launch
    else if (conq || S.free) {
      if (mineBuildP() < 1) { label = "⛏ RAISING THE SITE…"; dis = true; }   // v18.41: the build plays out in full — LAUNCH comes back the moment the headframe turns
      else if (last) { label = "★ FINAL WORLD"; }
      else if (!S.free && S.galaxy + 1 <= S.peakGalaxy) { ready = true; dis = false; label = "VISIT " + galName(S.galaxy + 1) + " ▸"; }   // next world already reached (you jumped back) — instant hop, NOT a fresh paid re-launch
      else { const cost = launchPrice(); ready = true; dis = S.cash < cost; label = "LAUNCH ⟶ " + curSym(S.galaxy) + " " + fmt(cost); }
    } else if (wardenOn) { label = "▲ " + wardenOf(S.galaxy).n + " — FIGHT"; dis = true; }
      else if (barFull()) { ready = true; dis = false; label = "▲ SUMMON " + wardenOf(S.galaxy).n; }   // v18.40: a full bar arms the world's last stand — the button IS the offer, and it waits as long as you like
      else { label = "CONQUER " + Math.floor(clamp(curEarned / tgt, 0, 1) * 100) + "%"; }
    const bt = $("btn-travel");
    if (bt.textContent !== label) bt.textContent = label;   // write only on change — no per-frame repaint flicker
    if (bt.disabled !== dis) bt.disabled = dis;
    bt.classList.toggle("ready", ready); bt.classList.toggle("enroute", enroute);
    // v18.13: settled worlds swap the whole shop dock (tabs + list + abilities) for the settlement
    // panel — v18.18: NOT during a mine-warden duel, when the world un-settles and combat UI returns
    { const dockCalm = conq && !wardenOn;
      if (dockCalm !== settleShown) { settleShown = dockCalm; settleKey = "";
        const sp = $("settle-panel"); if (sp) sp.style.display = dockCalm ? "" : "none";
        for (const id of ["tabs", "up-list", "abilities"]) { const el = $(id); if (el) el.style.display = dockCalm ? "none" : ""; } }
      if (dockCalm) renderSettlePanel(); }
    for (const k in ABIL_CD) { const b = $("ab-" + k); b.classList.toggle("cd", abil[k] > 0); $("cd-" + k).style.width = abil[k] > 0 ? (abil[k] / ABIL_CD[k] * 100) + "%" : "0"; $("s-" + k).textContent = abil[k] > 0 ? Math.ceil(abil[k]) + "s" : "";   // use a CLASS for cooldown dimming, NOT the disabled attr — a disabled <button> makes its child info "i" inert (useAbility already no-ops on cooldown)
      if (hudAbPrev[k] > 0 && abil[k] <= 0) { b.classList.remove("ready-pop"); void b.offsetWidth; b.classList.add("ready-pop"); }   // juice: one bright pulse the moment a cooldown ends
      b.classList.toggle("oppo", abil[k] <= 0 && state === "play" && dots.length >= 40);   // v16.9: ready + a target-rich field (40+ dots — galCap-relative was ~280 and never fired) = NOW is the moment; steady quiet glow, no blinking
      hudAbPrev[k] = abil[k]; }
    // juice: pulse the conquer bar each quarter it crosses (25/50/75%) — a visible milestone beat
    { const pq = clamp(conq ? 1 : curEarned / tgt, 0, 1), q = Math.floor(pq * 4);
      if (S.galaxy !== hudConqG) { hudConqG = S.galaxy; hudConqQ = q; }
      else if (q > hudConqQ && q < 4) { hudConqQ = q; const gb = document.querySelector(".g-bar"); if (gb) { gb.classList.remove("milestone"); void gb.offsetWidth; gb.classList.add("milestone"); } }
      else if (q < hudConqQ) hudConqQ = q; }
    for (const id in listRows) {
      const row = listRows[id];
      if (row.kind === "unit") {
        const d = TY(id), locked = !S.free && S.peakGalaxy < d.gal, c = unitBuyCost(id), n = countType(id), full = n >= d.max;   // v17: gated by your FRONTIER — reached it once, unlocked forever
        row.desc.textContent = n + "/" + d.max + (locked ? "" : " · " + d.name);
        if (locked) { row.buy.innerHTML = iconMarkup("lock") + "from P" + d.gal; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.remove("maxed"); }
        else if (full) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.buy.classList.remove("afford"); row.el.classList.add("maxed"); }
        else { row.buy.textContent = curSym(S.galaxy) + " " + fmt(c); row.buy.disabled = S.cash < c; row.buy.classList.toggle("afford", S.cash >= c); row.el.classList.remove("maxed"); }
        if (row.newc) row.newc.style.display = !locked && n === 0 && d.gal === S.peakGalaxy && S.peakGalaxy > 1 ? "inline-block" : "none";   // this class JUST unlocked on this world and you own none — the unlock moment announces itself (explicit inline-block: the stylesheet base is display:none, so "" would fall back to hidden)
        if (row.up) row.up.classList.toggle("afford", !locked && n > 0 && hintTreeAff[id] != null && S.cash >= hintTreeAff[id]);   // a tree node is waiting and you can afford it — the tree pulls you in
      } else {
        const u = UP[id], lvl = S.lv[id], eff = ecoLv(id), maxed = u.max != null && lvl >= u.max;
        row.lv.textContent = "Lv " + lvl;   // v18.0: ONE global ladder — the level you see is the level that acts, everywhere
        row.desc.textContent = u.desc(lvl);   // (this refresh had been swallowed into a trailing comment since v17.2 — stale "×N /dot" text until a full re-render)
        if (maxed) { row.buy.textContent = "MAX"; row.buy.disabled = true; row.el.classList.add("maxed"); row.buy.classList.remove("afford"); }
        else { const c = upCost(u); row.buy.textContent = curSym(S.galaxy) + " " + fmt(c); row.buy.disabled = S.cash < c; row.buy.classList.toggle("afford", S.cash >= c); row.el.classList.remove("maxed"); }
        // v18.53 MILESTONE CHARGE (owner: "highlight it gradually and then make it obvious. MAKE IT
        // JUICY"). A lump lands every MILE_LEG legacy levels; the row fills toward it so you can
        // SEE it coming, then goes loud on the buy that actually pays it. Monochrome throughout —
        // brightness, scale and motion do the work, never colour (the art rule).
        // v18.56: every economy row charges, not just Value — they all carry the lump now, and a row
        // that pays one while sitting still is exactly the row that ought to look like it will.
        if (row.mile && !maxed) {
          // the gap between lumps is MILE_LEG legacy levels, but that is a DIFFERENT number of rungs
          // either side of ECO_FINE_FROM (5 coarse, 10 fine) — derive it from the rung mapping instead
          // of assuming, or the bar opens at 56% full in the cold open instead of empty.
          const r = ecoLv(u.id), L = legacyLv(r), away = mileNext(r);
          const L0 = Math.floor(L / MILE_LEG) * MILE_LEG;
          const span = Math.max(1, rungLv(L0 + MILE_LEG) - rungLv(L0));
          const chg = clamp(1 - away / span, 0, 1);
          row.el.style.setProperty("--mile", chg.toFixed(3));
          row.el.classList.add("mile-charge");            // continuous: every visual rides --mile
          row.el.classList.toggle("mile-ready", away <= 1);
          // NB: no ✦ prefix here — curSym is already ✦ on most worlds and it rendered as "✦ ✦ 123".
          // The white button, the scale-up and the chip carry the signal without doubling the glyph.
        } else if (row.mile) { row.el.classList.remove("mile-charge", "mile-ready"); row.el.style.setProperty("--mile", 0); }
      }
    }
    // ambient-hint refresh (throttled ~1s — tree scans + leak detection are too heavy for every frame)
    { const nowH = performance.now();
      if (nowH - hintLast > 900) { hintLast = nowH;
        hintTreeAff = {};
        for (const t of [...DEF_ORDER, ...COL_ORDER]) if (countType(t) > 0 && (S.free || S.peakGalaxy >= TY(t).gal)) {
          let best = Infinity; const G = buildTree(t);
          for (const nd of G.nodes) if (!nodeAllocated(t, nd.id) && nodeAllocatable(t, nd)) { const cc = nodeCost(t, nd); if (cc < best) best = cc; }
          if (isFinite(best)) hintTreeAff[t] = best;
        }
        const lost = META.stats.lost || 0;                                    // loot expired uncollected since last look → collectors are drowning
        if (hintLostPrev >= 0 && lost > hintLostPrev) hintLeakUntil = nowH + 6000;
        hintLostPrev = lost;
      } }
    // tab COUNT badges (v16.10) — the number of affordable things waiting inside each tab (units + upgrades
    // + one per class with an affordable tree node); "!" on amber when something in there is WRONG.
    const aff = { def: 0, drone: 0, eco: 0 };
    for (const t of DEF_ORDER) if ((S.free || S.peakGalaxy >= DEF_TYPES[t].gal) && countType(t) < DEF_TYPES[t].max && S.cash >= unitBuyCost(t)) aff.def++;
    for (const t of COL_ORDER) if ((S.free || S.peakGalaxy >= COL_TYPES[t].gal) && countType(t) < COL_TYPES[t].max && S.cash >= unitBuyCost(t)) aff.drone++;
    for (const t of DEF_ORDER) if (hintTreeAff[t] != null && S.cash >= hintTreeAff[t]) aff.def++;
    for (const t of COL_ORDER) if (hintTreeAff[t] != null && S.cash >= hintTreeAff[t]) aff.drone++;
    for (const u of UPS) { if (u.max != null && S.lv[u.id] >= u.max) continue; if (S.cash >= upCost(u)) aff[u.tab]++; }
    const capped = S.cash >= derived.capacity * 0.999, leak = performance.now() < hintLeakUntil;
    for (const k in tabBtns) { const b = tabBtns[k], warn = k === "drone" ? leak : k === "eco" ? capped : false, n = aff[k];
      b.classList.remove("has-buy");   // the count badge fully replaces the legacy dot
      if (b._badge) { const txt = warn ? "!" : n > 9 ? "9+" : String(n);
        if (b._badge.textContent !== txt) b._badge.textContent = txt;
        b._badge.classList.toggle("on", warn || n > 0); b._badge.classList.toggle("warn", warn); } }
    { const ce = $("ui-cap"); if (ce) ce.classList.toggle("full", capped); }                          // the cap line itself goes amber — the number you're pinned against
    { const ln = $("leak-note"); if (ln) ln.classList.toggle("show", leak); const cn = $("cap-note"); if (cn) cn.classList.toggle("show", capped); }   // the in-tab amber explainers track the same conditions as the badges
    // macro-transition attention pops + travel bounce (v16.10)
    { const bt = $("btn-travel"), go = bt && bt.classList.contains("ready") && !bt.disabled && !S.travel;
      if (bt) { bt.classList.toggle("go", go);
        if (go && !prevTravelGo) { bt.classList.remove("attn"); void bt.offsetWidth; bt.classList.add("attn"); } }   // the launch just became payable — one loud pop
      prevTravelGo = !!go;
      const ab2 = $("btn-ascend"), wl2 = ab2 && ab2.classList.contains("wall");
      if (ab2 && wl2 && !prevWall) { ab2.classList.remove("attn"); void ab2.offsetWidth; ab2.classList.add("attn"); }   // the wall just arrived — pop the amber
      prevWall = !!wl2; }
    // idle nudge (v16.10): bought nothing for 10s while something on-screen is affordable → the cheapest
    // affordable buy button bounces once. Repeats no faster than every 6s; any purchase resets the clock.
    { const nowN = performance.now();
      if (state === "play" && nowN - lastBuyT > 10000 && nowN - lastNudgeT > 6000) {
        let best = null, bc = Infinity;
        for (const id in listRows) { const row = listRows[id]; if (!row.buy || row.buy.disabled || !row.buy.classList.contains("afford")) continue;
          const c2 = row.kind === "unit" ? unitBuyCost(id) : upCost(UP[id]); if (c2 < bc) { bc = c2; best = row.buy; } }
        if (best) { lastNudgeT = nowN; best.classList.remove("nudge"); void best.offsetWidth; best.classList.add("nudge"); } } }
  }

  function renderList() {
    const wrap = $("up-list"); wrap.innerHTML = ""; listRows = {};
    // v17.16 (owner call: "not sure why collectors is the only tab that flashes orange"): the amber
    // "!" now EXPLAINS itself — opening the flashing tab shows exactly what's wrong and what to do.
    // syncHUD toggles these live (same conditions that drive the badges).
    if (activeTab === "drone") { const n = document.createElement("div"); n.id = "leak-note"; n.className = "tab-note"; n.textContent = "⚠ Loot is EXPIRING uncollected — your collectors can't keep up. Add more, or upgrade their trees (Speed/Reach/Capacity)."; wrap.appendChild(n); }
    if (activeTab === "eco") { const n = document.createElement("div"); n.id = "cap-note"; n.className = "tab-note"; n.textContent = "⚠ Wallet PINNED at the Capacity ceiling — everything you earn past it is lost. Raise Capacity."; wrap.appendChild(n); }
    if (activeTab === "def" || activeTab === "drone") {
      const order = activeTab === "def" ? DEF_ORDER : COL_ORDER, col = activeTab === "def" ? "#fff" : "var(--drone)";
      for (const type of order) {
        const el = document.createElement("div"); el.className = "up";
        el.innerHTML = `<span class="u-dot" style="background:${col}"></span><div class="u-mid"><div class="u-name">${TY(type).name}<span class="u-newchip">NEW</span></div><div class="u-desc"></div></div><button class="u-info" title="Info">i</button><button class="u-up" title="Upgrade class">⬆ Tree</button><button class="u-buy"></button>`;
        wrap.appendChild(el);
        el.querySelector(".u-info").onclick = () => showInfo(TY(type).name, type);
        el.querySelector(".u-up").onclick = () => openSkillTree(type);
        el.querySelector(".u-buy").onclick = () => buyUnit(type);
        listRows[type] = { kind: "unit", el, desc: el.querySelector(".u-desc"), buy: el.querySelector(".u-buy"), up: el.querySelector(".u-up"), newc: el.querySelector(".u-newchip") };
      }
    } else {
      const col = activeTab === "drone" ? "var(--drone)" : "var(--eco)";
      for (const u of UPS) { if (u.tab !== activeTab) continue;
        const el = document.createElement("div"); el.className = "up";
        el.innerHTML = `<span class="u-mile"></span><span class="u-shine"></span><span class="u-dot" style="background:${col}"></span><div class="u-mid"><div class="u-name">${u.name}<span class="lv"></span><span class="u-milechip">✦ MILESTONE</span></div><div class="u-desc"></div></div><button class="u-info" title="Info">i</button><button class="u-buy"></button>`;
        wrap.appendChild(el);
        el.querySelector(".u-info").onclick = () => showInfo(u.name, u.id);
        el.querySelector(".u-buy").onclick = () => buyUpgrade(u);
        listRows[u.id] = { el, lv: el.querySelector(".lv"), desc: el.querySelector(".u-desc"), buy: el.querySelector(".u-buy"), mile: el.querySelector(".u-mile") };
      }
    }
    syncHUD();
  }
  function buyUnit(type) {
    const list = classList(type);
    if (!S.free && S.peakGalaxy < TY(type).gal) return;   // v17 ONE ARMY: unlocks ride your FRONTIER — reach the class's planet once and it's buyable forever, wherever you're parked
    let bought = 0;
    for (let i = 0; i < buyN(); i++) {
      if (countType(type) >= TY(type).max) break;
      const c = unitBuyCost(type); if (!(S.cash >= c)) break;   // fail-CLOSED: a NaN price/wallet refuses the sale (v17.21 fuzzer finding)
      S.cash -= c; list.push(isCol(type) ? { type } : newUnit(type)); bought++;
    }
    if (!bought) return;
    lastBuyT = performance.now();   // v16.10: purchases quiet the idle nudge
    if (isCol(type)) syncCollectors();
    // deploy pop — a small burst + ring where the new unit racks in, so a purchase lands ON the field, not just in the list
    if (!isCol(type)) { const i = S.units.length - 1, p = unitPos(i, S.units.length); burst(p.x, p.y, 10, 130, 1.6); ring(p.x, p.y, 6, 44, 0.4); }
    else { const dr = drones[drones.length - 1]; if (dr) { burst(dr.x, dr.y, 10, 130, 1.4); ring(dr.x, dr.y, 6, 40, 0.4); } }
    Audio_buy(); renderList(); save();
  }
  function buyUpgrade(u) {
    let bought = 0; const lvl0 = S.lv[u.id] | 0;   // v18.53: pre-buy level, for the milestone-crossing check below
    for (let i = 0; i < buyN(); i++) {
      const lvl = S.lv[u.id]; if (u.max != null && lvl >= u.max) break;
      const c = upCost(u); if (!(S.cash >= c)) break;   // fail-CLOSED on NaN
      S.cash -= c; S.lv[u.id]++; bought++;
    }
    if (!bought) return;
    lastBuyT = performance.now();   // v16.10: purchases quiet the idle nudge
    recompute();
    // v18.53: crossing a MILESTONE is the payoff the charge-up was promising. Fire the full kit —
    // the same flash/shake/vibe language a conquest uses, scaled down — so the lump reads as an EVENT
    // rather than one more receipt. Detected off the legacy level actually crossing a multiple of
    // MILE_LEG, so a buy-10 that vaults several lumps still fires exactly once.
    // v18.56: fires for ANY economy upgrade \u2014 each names itself and states what its lump just bought.
    if (Math.floor(legacyLv(lvl0) / MILE_LEG) < Math.floor(legacyLv(S.lv[u.id]) / MILE_LEG)) {
      flashAdd(0.45); shakeAdd(3.2); vibe([40, 30, 70]); Audio_win();
      ring(W / 2, H / 2, 30, Math.max(W, H) * 0.34, 0.5); burst(W / 2, H / 2, 22, 170, 2.1);
      floatTxt(W / 2, H / 2 - 30, "\u2726 " + u.name.toUpperCase() + " MILESTONE");
      floatTxt(W / 2, H / 2 - 6, (MILE_BLURB[u.id] || (() => u.desc(S.lv[u.id])))());
    } else Audio_buy();
    syncHUD(); save();
  }
  // ── tiny synthesized UI sounds (no assets, all gated by the sound setting). Kept SOFT and short —
  // routine actions whisper, only the rare boss kill gets a real hit. Auto-buy uses its own closures,
  // so none of these ever fire from background automation. ──
  function Audio_buy() {   // soft two-note confirm — a routine manual purchase
    if (!opt("sound")) return; const a = Sfx.ac(); if (!a) return; const t0 = a.currentTime;
    [[620, 0], [930, 0.05]].forEach(([f, d]) => { const o = a.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.1, t0 + d + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.085);
      o.connect(g).connect(Sfx.out(a)); o.start(t0 + d); o.stop(t0 + d + 0.1); });
  }
  function Audio_node() {   // a skill node locks in — quick rising arpeggio, a touch grander than a buy
    if (!opt("sound")) return; const a = Sfx.ac(); if (!a) return; const t0 = a.currentTime;
    [[523, 0], [659, 0.055], [880, 0.11]].forEach(([f, d]) => { const o = a.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.11, t0 + d + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
      o.connect(g).connect(Sfx.out(a)); o.start(t0 + d); o.stop(t0 + d + 0.18); });
  }
  function Audio_boss() {   // boss down — layered detonation: sub thump + body + crack, with a room tail (rare, earned)
    if (!opt("sound")) return; const a = Sfx.ac(); if (!a) return; const t0 = a.currentTime;
    const o = a.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.45);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    o.connect(g).connect(Sfx.out(a)); o.start(t0); o.stop(t0 + 0.52);
    const nz = Sfx.noise(); if (nz) { const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800; const ng = a.createGain(); ng.gain.setValueAtTime(0.22, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16); nz.connect(hp).connect(ng).connect(Sfx.out(a)); nz.start(t0); nz.stop(t0 + 0.18); }
    sTone(55, 24, 0.7, "sine", 0.22, 0.02);                 // v16.8: sub layer under the thump — feel it in the chest
    sNoise(700, 150, 0.5, 0.08, 0.05, "bandpass", 0.45);    // debris settling into the room
  }
  function Audio_tick() {   // the Bounty Wheel pointer clips a slice boundary — the quietest sound in the game
    if (!opt("sound")) return; const a = Sfx.ac(); if (!a) return; const t0 = a.currentTime;
    const o = a.createOscillator(); o.type = "square"; o.frequency.value = 2200 + Math.random() * 350;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);
    o.connect(g).connect(Sfx.out(a)); o.start(t0); o.stop(t0 + 0.032);
  }
  // ── FULL SOUND LAYER (v16.7) — the field finally speaks. All synthesized WebAudio (no assets, no deps),
  // mixed QUIET and heavily THROTTLED: at 40 kills/sec a per-event sound would be white noise, so the field
  // sounds share rate gates + an adaptive duck (the busier the second, the softer each hit). Everything
  // respects the Sound toggle via opt("sound"). One-shot event sounds (conquest, ascension, victory,
  // launch, wheel win) are allowed to be a moment — they're rare.
  function sTone(f0, f1, dur, type, vol, delay, send) {   // one enveloped osc, optional pitch glide — the shared voice of the layer. `send` (0..1) leaks it into the echo return for a tail
    const a = Sfx.ac(); if (!a) return; const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(); o.type = type || "sine"; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(Sfx.out(a));
    if (send) { const sg = a.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(Sfx.echo(a)); }
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function sNoise(fc0, fc1, dur, vol, delay, type, send) {   // enveloped filtered noise — whooshes, cracks, rumbles; `send` echoes it
    const a = Sfx.ac(); if (!a) return; const s = Sfx.noise(); if (!s) return; const t0 = a.currentTime + (delay || 0);
    const f = a.createBiquadFilter(); f.type = type || "bandpass"; f.Q.value = 0.8; f.frequency.setValueAtTime(fc0, t0);
    if (fc1 && fc1 !== fc0) f.frequency.exponentialRampToValueAtTime(Math.max(30, fc1), t0 + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(Sfx.out(a));
    if (send) { const sg = a.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(Sfx.echo(a)); }
    s.start(t0); s.stop(t0 + dur + 0.05);
  }
  let sfxPopT = 0, sfxPopN = 0, sfxPopWin = 0, sfxColT = 0, sfxZapT = 0, sfxBigT = 0;   // field-sound rate gates + rolling busy counter
  const sfxDuck = () => { const now = performance.now(); if (now - sfxPopWin > 1000) { sfxPopWin = now; sfxPopN = 0; } sfxPopN++; return 1 / Math.sqrt(1 + sfxPopN * 0.35); };   // the busier this second, the softer each hit
  // KILL-COMBO PITCH LADDER (v16.8) — the Peggle trick: consecutive kills walk UP a pentatonic scale.
  // v17.15 RETHINK (owner call: "the progressive ding is nice when the game is slow, but 5 minutes in
  // it's a horrible steady high-pitched dinging"): at melt rates the ladder pinned at its top octave
  // and the throttle still let ~18 dings/s through — a treble drone. The field now BREATHES with the
  // true kill rate (counted pre-throttle):
  //   CALM  (≤4 kills/s): the full charm — pentatonic climb, two octaves, the Peggle melody.
  //   BRISK (5-14/s):     the climb caps ONE octave down, dings space out — busy, never shrill.
  //   MELT  (15+/s):      tonal dings RETIRE for plain kills — a soft LOW popcorn patter (filtered
  //                       tick + low sine, ≤~7/s) reads as "furnace roaring", not music. Elite/boss
  //                       knocks keep punching through. Collector blips drop an octave and go sparse.
  //   The ladder resets while melted, so when the field calms the melody returns from its root.
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0];
  let comboN = 0, comboLast = 0, krWin = 0, krN = 0, krPrev = 0;
  const krTick = () => { const now = performance.now(); if (now - krWin > 1000) { krPrev = now - krWin > 2000 ? 0 : krN; krN = 0; krWin = now; } krN++; };   // TRUE kills/s, pre-throttle; a fully-skipped window means the field went quiet — don't replay the stale count (v17.21 audit)
  const krRate = () => (performance.now() - krWin > 2500 ? 0 : Math.max(krPrev, krN));   // and a long-dead window reads CALM even for callers that never tick it (collector blips)
  function Audio_pop(big, tier) {   // a dot dies — pitched pop that climbs the combo ladder; armored/high-tier lands a deeper knock
    if (!opt("sound")) return; const now = performance.now();
    krTick();
    const rate = krRate(), gap = rate >= 15 ? 135 : rate >= 5 ? 90 : 55;
    if (big) {   // elite/boss knocks PUNCH THROUGH the trash throttle on their own (rarer) gate — v17.21: the comment promised it, now the code does it
      if (now - sfxBigT < 120) return; sfxBigT = now;
      const db = sfxDuck(); sTone(190 + Math.random() * 40, 55, 0.14, "sine", 0.12 * db, 0, 0.15); sNoise(2600, 480, 0.07, 0.045 * db); return; }
    if (now - sfxPopT < gap) return; sfxPopT = now;
    const d = sfxDuck();
    if (rate >= 15) {   // MELT: low popcorn patter — texture, not melody
      sNoise(900, 300, 0.045, 0.03 * d, 0, "lowpass");
      sTone(150 + Math.random() * 60, 90, 0.05, "sine", 0.028 * d);
      return;
    }
    comboN = now - comboLast < 1200 ? Math.min(comboN + 1, 14) : 0; comboLast = now;
    const f = PENTA[comboN % 5] * Math.pow(2, Math.min(rate >= 5 ? 1 : 2, (comboN / 5) | 0));   // brisk fields never reach the shrill top
    sTone(f, f * 0.94, 0.07, "sine", 0.055 * d);
    sNoise(5200, 2600, 0.018, 0.02 * d);   // tiny click transient on top — reads as a "pop", not a beep
  }
  function Audio_collect(big) {   // a collector swallows loot — pentatonic blip in a high register; heavy loot gulps lower
    if (!opt("sound")) return; const now = performance.now();
    const rate = krRate(), gap = rate >= 15 ? 260 : 70;   // in a melting field the loot stream goes sparse & low too
    if (now - sfxColT < gap) return; sfxColT = now;
    const d = sfxDuck();
    if (big) { sTone(330, 660, 0.11, "triangle", 0.06 * d); sTone(660, 990, 0.07, "sine", 0.03 * d, 0.05); }   // two-stage gulp
    else { const f = PENTA[(Math.random() * 5) | 0] * (rate >= 15 ? 1 : 2); sTone(f, f * 1.5, 0.05, "sine", (rate >= 15 ? 0.022 : 0.035) * d); }
  }
  function Audio_zap() {   // legacy dry zap (no longer the draw voice — kept for the sfx export/tools)
    if (!opt("sound")) return; const now = performance.now(); if (now - sfxZapT < 65) return; sfxZapT = now;
    sTone(190 + Math.random() * 50, 80, 0.05, "square", 0.028);
  }
  // ── LIGHTSABER DRAW (v17.14, deepened v17.17 — owner call: "much darker, deeper, and dynamic to
  // speed AND direction"). ONE persistent voice: twin detuned saws at a LOW 55Hz growl + a sub-octave
  // sine for chest weight, through a dark resonant lowpass (150Hz at idle — it never gets bright,
  // even at full swing). The blade answers the STROKE, not just its speed:
  //   · speed     → the VOOM: filter opens (capped dark ~1.2kHz), pitch lifts, volume swells fast/sags slow
  //   · vertical  → doppler: a rising cut bends the pitch UP, a falling slash drags it DOWN
  //   · horizontal→ the hum PANS across the stereo field with the stroke (left slash = left ear)
  //   · direction FLIPS (sharp turns) → a brief extra filter slam + push — the voom-VOOM of a back-and-forth slash
  // Lift (or rest) the finger ~160ms and the blade powers down. No per-hit one-shots at all.
  const Saber = { o1: null, o2: null, sub: null, fil: null, g: null, lfo: null, pan: null, killer: 0, lx: 0, ly: 0, lt: 0, hd: 0 };
  function Audio_saber(x, y) {
    if (!opt("sound")) return; const a = Sfx.ac(); if (!a) return;
    const now = performance.now();
    // v17.21 audit: the draw input layer INTERPOLATES brushAt calls every ~14px within one event,
    // so per-call deltas always landed in the 8ms floor and computed speed saturated to max — the
    // "dynamic to speed" mapping had collapsed to on/off. The stroke is now AGGREGATED over a 40ms
    // window: true velocity = summed path / real elapsed time, so slow drags finally sound slow.
    if (Saber.lt && now - Saber.lt < 200) { Saber.dist = (Saber.dist || 0) + Math.hypot(x - Saber.lx, y - Saber.ly); }
    else { Saber.dist = 0; Saber.wx = x; Saber.wy = y; Saber.wt = now; }
    Saber.lx = x; Saber.ly = y; Saber.lt = now;
    let speed = null, vx = 0, vy = 0, turn = 0;
    if (now - (Saber.wt || 0) >= 40) {
      const dtm = Math.max(20, now - Saber.wt);
      speed = (Saber.dist || 0) / dtm * 1000;                       // true path speed over the window
      vx = (x - Saber.wx) / dtm * 1000; vy = (y - Saber.wy) / dtm * 1000;   // net stroke direction
      if (speed > 60) { const hd = Math.atan2(vy, vx); let dh = hd - Saber.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        turn = Math.abs(dh) / (dtm / 1000); Saber.hd = hd; }       // angular velocity, rad/s — the direction-flip detector
      Saber.dist = 0; Saber.wx = x; Saber.wy = y; Saber.wt = now;
    }
    if (!Saber.g) {   // ignite
      const t0 = a.currentTime;
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.setTargetAtTime(0.036, t0, 0.03);
      const fil = a.createBiquadFilter(); fil.type = "lowpass"; fil.Q.value = 4; fil.frequency.value = 85;
      const o1 = a.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 33;
      const o2 = a.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = 33; o2.detune.value = 9;
      const sub = a.createOscillator(); sub.type = "sine"; sub.frequency.value = 16.5;
      const sg = a.createGain(); sg.gain.value = 0.7; sub.connect(sg); sg.connect(fil);   // the weight under the growl
      const lfo = a.createOscillator(); lfo.frequency.value = 4.1; const lg = a.createGain(); lg.gain.value = 6;
      lfo.connect(lg); lg.connect(o2.detune);   // the electric shimmer, slower & subtler at this register
      let pan = null; try { pan = a.createStereoPanner(); } catch (e) {}
      o1.connect(fil); o2.connect(fil); fil.connect(g);
      if (pan) { g.connect(pan); pan.connect(Sfx.out(a)); } else g.connect(Sfx.out(a));
      o1.start(); o2.start(); sub.start(); lfo.start();
      Object.assign(Saber, { o1, o2, sub, fil, g, lfo, pan });
    }
    if (speed != null) {   // params update once per stroke window — between windows the hum just holds
      const t = a.currentTime, k = Math.min(1, speed / 1400);
      const lift = clamp(-vy / 2400, -0.16, 0.26);                     // doppler: up-cuts bend the pitch up, down-slashes drag it low
      const f0 = 33 * (1 + k * 0.4 + lift);
      Saber.o1.frequency.setTargetAtTime(f0, t, 0.055);
      Saber.o2.frequency.setTargetAtTime(f0, t, 0.055);
      Saber.sub.frequency.setTargetAtTime(f0 / 2, t, 0.055);
      const flip = Math.min(1, turn / 18);                             // sharp turns read as a fresh slash
      Saber.fil.frequency.setTargetAtTime(85 + k * 430 + flip * 190, t, flip > 0.4 ? 0.02 : 0.05);   // v17.30: SUBTERRANEAN — caps ~700Hz flat-out; the blade is felt more than heard
      Saber.g.gain.setTargetAtTime(0.036 + k * 0.05 + flip * 0.014, t, (k > 0.25 || flip > 0.4) ? 0.028 : 0.12);
      if (Saber.pan) Saber.pan.pan.setTargetAtTime(clamp(speed > 80 ? vx / Math.max(320, speed) : 0, -0.8, 0.8) * 0.7, t, 0.07);   // the blade crosses the stereo field with the stroke
    }
    clearTimeout(Saber.killer);
    Saber.killer = setTimeout(() => {   // blade off — quick ramp, then release the nodes
      const aa = Sfx.ctx; if (!aa || !Saber.g) return;
      Saber.g.gain.setTargetAtTime(0.0001, aa.currentTime, 0.06);
      const { o1, o2, sub, lfo } = Saber;
      setTimeout(() => { try { o1.stop(); o2.stop(); sub.stop(); lfo.stop(); } catch (e) {} }, 350);
      Saber.o1 = Saber.o2 = Saber.sub = Saber.fil = Saber.g = Saber.lfo = Saber.pan = null; Saber.lt = 0;
    }, 160);
  }
  function Audio_warp(dur) {   // v17.23: the 7s transit soundscape — rising noise bed, three swirling-stereo shepard risers, an accelerating heartbeat
    if (!opt("sound")) return; const a = Sfx.ac(); if (!a) return; const t0 = a.currentTime;
    const nz = Sfx.noise(); if (nz) {   // the wind of the tunnel: bandpass sweep climbing the whole trip, dropping at the threshold
      const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(150, t0); bp.frequency.exponentialRampToValueAtTime(2600, t0 + dur * 0.85); bp.frequency.exponentialRampToValueAtTime(420, t0 + dur);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.1, t0 + dur * 0.25); g.gain.setValueAtTime(0.1, t0 + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      nz.connect(bp).connect(g).connect(Sfx.out(a)); nz.start(t0); nz.stop(t0 + dur + 0.05);
    }
    for (let i = 0; i < 3; i++) {       // shepard-ish risers, each swirling across the stereo field at its own rate
      const o = a.createOscillator(); o.type = i === 1 ? "triangle" : "sawtooth";
      const f0 = 55 * Math.pow(2, i * 0.5); o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 3, t0 + dur);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.045 / (i + 1), t0 + 1 + i * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let p = null; try { p = a.createStereoPanner(); } catch (e) {}
      if (p) { const lf = a.createOscillator(); lf.frequency.value = 0.35 + i * 0.3; const lg = a.createGain(); lg.gain.value = 0.7;
        lf.connect(lg); lg.connect(p.pan); lf.start(t0); lf.stop(t0 + dur + 0.05); o.connect(g); g.connect(p); p.connect(Sfx.out(a)); }
      else { o.connect(g); g.connect(Sfx.out(a)); }
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    let tt = 0.6, gap = 0.9;            // the heartbeat accelerates as the destination closes in
    while (tt < dur - 0.6) { sTone(48, 40, 0.16, "sine", 0.08, tt); gap *= 0.86; tt += Math.max(0.2, gap); }
  }
  function Audio_ability(k) {   // each ability announces itself in its own voice, sized to its duration
    if (!opt("sound")) return;
    if (k === "frenzy") {   // 6s of overdrive: rising rip, then sparse high sparkles across the window
      sTone(220, 880, 0.35, "sawtooth", 0.07, 0, 0.2); sTone(440, 1760, 0.35, "sine", 0.04, 0.04);
      for (let i = 0; i < 5; i++) sTone(PENTA[(Math.random() * 5) | 0] * 2, 0, 0.09, "sine", 0.025, 0.8 + i * 1.05, 0.3);
    } else if (k === "dotrain") {   // the sky falls in — big whoosh + a patter of arrival plinks
      sNoise(3200, 260, 0.55, 0.16, 0, "bandpass", 0.25); sTone(980, 240, 0.4, "sine", 0.05, 0.1);
      for (let i = 0; i < 6; i++) sTone(1200 + Math.random() * 900, 500, 0.05, "sine", 0.03, 0.35 + i * 0.09);
    } else if (k === "blackhole") {   // 5s hungry sub-bass drone — lives exactly as long as the pull does
      sTone(72, 30, 5, "sine", 0.18); sTone(108, 45, 5, "sine", 0.07);
      sNoise(420, 55, 4.6, 0.09, 0, "lowpass");
      sNoise(60, 900, 0.5, 0.1, 4.5, "bandpass", 0.4);   // the swallow — everything rushes back out at the end
    }
  }
  function Audio_conquer() {   // a world falls — bright major arpeggio with a room tail, the run's best regular moment
    if (!opt("sound")) return;
    sNoise(900, 3800, 0.3, 0.05);   // intro sparkle
    [[392, 0], [494, 0.09], [587, 0.18], [784, 0.3]].forEach(([f, d]) => sTone(f, f, 0.34, "triangle", 0.09, d, 0.35));
    sTone(1568, 1568, 0.5, "sine", 0.035, 0.42, 0.5);   // high shimmer cap
  }
  function Audio_victory() {   // ALL 18 — the only fanfare in the game; it earns its length and its echo
    if (!opt("sound")) return;
    [[392, 0], [523, 0.14], [659, 0.28], [784, 0.42]].forEach(([f, d]) => sTone(f, f, 0.5, "triangle", 0.10, d, 0.4));
    [523, 659, 784, 1046].forEach(f => sTone(f, f, 1.6, "sine", 0.05, 0.62, 0.5));   // sustained closing chord, echoing out
    sNoise(700, 4200, 0.8, 0.08, 0.55, "bandpass", 0.4);                              // shimmer up and out
    sTone(98, 98, 1.6, "sine", 0.1, 0.62);                                            // low root under the chord — weight
  }
  function Audio_ascend() {   // the run collapses into the Engine — a riser, then a rebirth boom with a tail
    if (!opt("sound")) return;
    sNoise(220, 4000, 0.8, 0.16, 0, "bandpass", 0.3);                                // charge-up sweep
    sTone(160, 30, 0.9, "sine", 0.3, 0.75, 0.3); sNoise(2600, 300, 0.25, 0.12, 0.75, "bandpass", 0.4); // detonation + crack
    sTone(523, 523, 0.7, "triangle", 0.05, 1.15, 0.5); sTone(784, 784, 0.7, "triangle", 0.04, 1.28, 0.5);   // two calm echoing notes: you're back
  }
  function Audio_launch() {   // an expedition lifts off — rumble under a climbing engine, trailing away
    if (!opt("sound")) return;
    sNoise(180, 90, 0.9, 0.18, 0, "lowpass");                                    // launch-pad rumble
    sTone(80, 340, 0.85, "sawtooth", 0.05, 0, 0.3);                              // engine climbing away into the room
    sNoise(1200, 2800, 0.4, 0.04, 0.5, "bandpass", 0.5);                         // thinning exhaust hiss
  }
  function Audio_land() {   // the expedition arrives — impact thump + settling dust (the launch's bookend)
    if (!opt("sound")) return;
    sTone(150, 32, 0.5, "sine", 0.3, 0, 0.2); sNoise(2200, 400, 0.18, 0.1);
    sTone(392, 523, 0.25, "triangle", 0.05, 0.3, 0.4);   // a small "we made it" lift
  }
  function Audio_spinup() {   // the Bounty Wheel rips into motion — rising mechanical wind-up
    if (!opt("sound")) return;
    sNoise(300, 2600, 0.55, 0.12); sTone(90, 260, 0.55, "sawtooth", 0.04);
  }
  function Audio_win(jack) {   // the Bounty Wheel lands — a slam with a room tail, and a rising run on jackpot
    if (!opt("sound")) return;
    sNoise(1800, 400, 0.12, 0.14); sTone(523, 523, 0.24, "triangle", 0.1, 0, 0.35); sTone(784, 784, 0.32, "triangle", 0.09, 0.07, 0.35);
    if (jack) { [[1046, 0.16], [1318, 0.26], [1568, 0.36], [2093, 0.46]].forEach(([f, d]) => sTone(f, f, 0.35, "sine", 0.06, d, 0.5)); sTone(131, 131, 0.8, "sine", 0.12, 0.16); }   // jackpot: run climbs an extra octave over a bass root
  }
  function Audio_escape() {   // the boss got away — a falling minor shrug, trailing off in the room
    if (!opt("sound")) return;
    [[440, 0], [349, 0.12], [262, 0.26]].forEach(([f, d]) => sTone(f, f, 0.3, "triangle", 0.06, d, 0.4));
  }
  function Audio_click() {   // UI tab/toggle tap — barely-there
    if (!opt("sound")) return; sTone(1400 + Math.random() * 200, 1400, 0.025, "square", 0.018);
  }
  function Audio_err() {   // the loop recovered from an exception — a dry low buzz, as rare as the toast
    if (!opt("sound")) return; try { sTone(110, 90, 0.22, "sawtooth", 0.05); } catch (e) {}
  }

  /* ----------------------- AUTO-BUY (idle automation) -----------------------
     A SEQUENTIAL queue of steps — each step is "buy <thing> N times", and the queue
     runs strictly in order (step 1 fully, then step 2…). You get ONE slot per planet
     you've reached (planet 1 → 1 step, planet 2 → 2 steps, …), so deeper progress lets
     you program longer build orders. <thing> = any Economy upgrade, any Unit, or a
     class's skill tree (buys N cheapest nodes). +50% tax; runs live and while away.  */
  const AUTO_TAX = 1.5;     // auto-bought upgrades cost +50% over manual — a steep convenience tax
  const ECO_KEYS = ["value", "spawnRate", "capacity", "luck"];
  const ECO_LABEL = { value: "Value", spawnRate: "Spawn Rate", capacity: "Capacity", luck: "Luck" };
  const isTreeStep = s => s && typeof s.target === "string" && s.target.slice(0, 5) === "tree:";
  const defaultAuto = () => ({ v: 6, on: false, queue: [] });   // v17 ONE ARMY: one global build order — the army persists across planets, so there is exactly ONE plan (was v5: a separate queue per planet, 18 lists to babysit)
  function ensureAuto() {
    if (!S.auto || typeof S.auto !== "object") { S.auto = defaultAuto(); return; }
    if (S.auto.v === 5 && S.auto.planets) {   // MIGRATE v5 per-planet queues → one global queue, planet order preserved (P1's steps first)
      const merged = defaultAuto(); merged.on = Object.values(S.auto.planets).some(p => p && p.on);
      for (let g = 1; g <= TOTAL_PLANETS; g++) { const p = S.auto.planets[g]; if (p && Array.isArray(p.queue)) merged.queue.push(...p.queue); }
      S.auto = merged;
    }
    if (S.auto.v !== 6) S.auto = defaultAuto();
    if (!Array.isArray(S.auto.queue)) S.auto.queue = [];
  }
  function autoCfg() {   // THE global auto-buy config (normalised in place)
    ensureAuto(); const p = S.auto;
    // normalise IN PLACE — the live planet's cfg is re-fetched every frame by the auto-buy tick, so we must
    // NOT swap p.queue for a new array (that would orphan the reference captured by the Add-step / ± / ✕ UI
    // handlers, silently dropping their edits). Mutate the existing array instead.
    for (let i = p.queue.length - 1; i >= 0; i--) {
      const s = p.queue[i];
      if (!s || !s.target) { p.queue.splice(i, 1); continue; }
      if (isTreeStep(s)) { if (!s.nodes || typeof s.nodes !== "object") s.nodes = {}; delete s.count; }
      else { s.count = Math.max(0, s.count | 0); delete s.nodes; }
    }
    if ((p.doneFx || p.doneSeen) && p.queue.some(stepPending)) { p.doneFx = false; p.doneSeen = false; }   // new work → the ✓ state retires itself
    return p;
  }
  const curAuto = () => autoCfg();   // one army, one plan
  const autoUnlocked = () => true;
  const autoSlots = () => 30;        // one generous global list (was: one slot per planet number)
  const autoRate = () => Math.min(80, 5 + 4 * conqueredCount());         // purchases/sec — empire snowball makes it faster
  const autoTax = c => Math.ceil(c * AUTO_TAX);
  const treeNodesPending = s => { if (!isTreeStep(s)) return 0; const t = s.target.slice(5), sel = s.nodes || {}; let n = 0; for (const id in sel) if (sel[id] && !nodeAllocated(t, id)) n++; return n; };
  const stepPending = s => (isTreeStep(s) ? treeNodesPending(s) : (s && s.count || 0)) > 0;
  const autoAllDone = cfg => cfg.queue.length > 0 && !cfg.queue.some(stepPending);   // every programmed step fully bought
  // PLAN COMPLETE — the moment a planet's whole build order finishes, say so in MANY ways (owner call):
  // field banner + flash + rumble + chime, a ✓ badge pinned to the AUTO buttons, and the planet's
  // panel shows PLAN COMPLETE until more steps are added (doneFx auto-clears in autoCfg when new
  // work appears). doneSeen stops the badge pulsing once the player has opened the panel.
  function autoDoneFx() {
    floatTxt(W / 2, H * 0.3, "✓ AUTO-BUY PLAN COMPLETE");
    floatTxt(W / 2, H * 0.3 + 22, "your build order is finished — add more steps");
    flashAdd(0.35); shakeAdd(2); vibe([30, 30, 60]); Audio_node(); syncAutoBtn();
  }
  // next eco/unit purchase: { cost (taxed), buy() } or null
  function autoTargetNext(target) {
    if (ECO_KEYS.includes(target)) { const u = UP[target]; if (u.max != null && (S.lv[target] || 0) >= u.max) return null; return { cost: autoTax(upCost(u)), buy() { S.lv[target] = (S.lv[target] || 0) + 1; } }; }
    const t = target; if (!TY(t)) return null; if (!S.free && S.peakGalaxy < TY(t).gal) return null; if (countType(t) >= TY(t).max) return null;
    return { cost: autoTax(unitBuyCost(t)), buy() { classList(t).push(isCol(t) ? { type: t } : newUnit(t)); if (isCol(t)) syncCollectors(); } };
  }
  // a step's next purchase: tree → cheapest still-allocatable PICKED node; eco/unit → next buy while count remains. null = step done/blocked.
  function stepNext(s) {
    if (!s || !s.target) return null;
    if (isTreeStep(s)) {
      // buys follow YOUR PICK ORDER (insertion order of s.nodes — the numbers shown on the tree).
      // Paths are inserted shallow→deep at pick time, so the next un-owned node in order is always
      // reachable; if one ever isn't, the loop just moves on — the step can never stall.
      const t = s.target.slice(5), sel = s.nodes || {}, G = buildTree(t);
      for (const id in sel) {
        if (!sel[id] || nodeAllocated(t, id)) continue;
        const n = G.map[id]; if (!n || !nodeAllocatable(t, n)) continue;
        return { cost: autoTax(nodeCost(t, n)), buy() { (S.classNodes[t] || (S.classNodes[t] = {}))[id] = true; } };
      }
      return null;
    }
    if ((s.count || 0) <= 0) return null;
    const nx = autoTargetNext(s.target); if (!nx) return null;
    return { cost: nx.cost, buy() { nx.buy(); s.count = Math.max(0, (s.count || 0) - 1); } };
  }
  // first runnable step of the ACTIVE planet: earlier steps must finish before later ones run
  function autoActive() {
    const q = curAuto().queue, slots = autoSlots();
    for (let i = 0; i < q.length && i < slots; i++) { const nx = stepNext(q[i]); if (nx) return { step: q[i], next: nx, idx: i }; }
    return null;
  }
  // one purchase pass: advance the active step (sequential — wait, don't skip, if it's unaffordable)
  function autoBuyOnce(b) {
    const a = autoActive(); if (!a || !(a.next.cost <= b.cash)) return false;   // fail-CLOSED on NaN
    a.next.buy(); b.cash -= a.next.cost; b.n = (b.n || 0) + 1; return true;   // always pay (test mode's 1% cost is already baked into the cost fns)
  }
  // shortest node path from the tree's centre to a node (so picking a deep node also marks its prerequisites)
  function treePath(type, id) {
    const G = buildTree(type), adj = G.adj, prev = { start: null }, q = ["start"], seen = new Set(["start"]);
    while (q.length) { const cur = q.shift(); if (cur === id) break; for (const nb of (adj[cur] || [])) { if (seen.has(nb)) continue; seen.add(nb); prev[nb] = cur; q.push(nb); } }
    if (!(id in prev)) return [id];
    const path = []; let c = id; while (c && c !== "start") { path.push(c); c = prev[c]; } return path;
  }
  // LIVE tick: spend accumulated cash this frame (rate-limited, scaling with conquests)
  // v18.4 (owner call): Auto-Buy is STASHED, not deleted — flip AUTOBUY_ON to bring the whole system
  // back (UI buttons, live tick, offline spending). Plans in S.auto keep persisting meanwhile.
  const AUTOBUY_ON = false;
  function autoBuyTick(dt) {
    if (!AUTOBUY_ON) return;
    if (!curAuto().on || !autoUnlocked()) return;
    autoAcc = Math.min(autoAcc + autoRate() * dt, 120);
    if (autoAcc < 1) return;
    const b = { cash: S.cash }; let tries = Math.floor(autoAcc);
    while (tries-- > 0 && autoBuyOnce(b)) { autoAcc -= 1; }
    if (autoAcc >= 1) autoAcc = Math.min(autoAcc, 4);   // nothing affordable — don't bank an ever-growing backlog
    if (b.n) { S.cash = b.cash; recompute(); if (state === "play") renderList(); if ($("auto-modal") && $("auto-modal").classList.contains("show")) renderAuto(); }
    const cfg = curAuto();
    if (!cfg.doneFx && autoAllDone(cfg)) { cfg.doneFx = true; autoDoneFx(); save(); if ($("auto-modal") && $("auto-modal").classList.contains("show")) renderAuto(); }
  }
  // OFFLINE: drain a banked budget into purchases (bounded). returns { bought, leftover }
  function autoBuyOffline(pool) {
    if (!AUTOBUY_ON) return { bought: 0, leftover: pool };   // stashed: the whole away-pool banks (capacity-clamped by the caller)
    if (!curAuto().on || !autoUnlocked()) return { bought: 0, leftover: pool };
    const b = { cash: pool }; let n = 0;
    while (n < 50000 && autoBuyOnce(b)) n++;
    return { bought: n, leftover: b.cash };
  }
  function syncAutoBtn() {
    const cfg = curAuto(), on = !!(cfg.on && autoUnlocked());
    ["btn-auto", "gm-auto"].forEach(id => { const b = $(id); if (!b) return; b.classList.toggle("on", on); b.classList.toggle("done", !!cfg.doneFx); b.classList.toggle("seen", !!cfg.doneSeen); });
  }
  // the choices for a step's target on planet g — every Economy upgrade, plus every Unit/Tree unlocked by planet g
  function autoTargetOptions(g) {
    const gg = g || S.galaxy, o = [];
    for (const id of ECO_KEYS) o.push({ value: id, label: ECO_LABEL[id], group: "Economy" });
    for (const t of [...DEF_ORDER, ...COL_ORDER]) if (S.free || S.peakGalaxy >= TY(t).gal) o.push({ value: t, label: TY(t).name, group: "Units" });
    for (const t of [...DEF_ORDER, ...COL_ORDER]) if (S.free || S.peakGalaxy >= TY(t).gal) o.push({ value: "tree:" + t, label: TY(t).name + " tree", group: "Trees" });
    return o;
  }
  // when the dropdown target changes, switch the step between count-shape and tree-shape
  function autoRetarget(s, target) {
    s.target = target;
    if (isTreeStep(s)) { delete s.count; if (!s.nodes) s.nodes = {}; }
    else { delete s.nodes; if (s.count == null) s.count = 10; }
  }
  function autoStepRow(s, i, opts, active, q) {
    const tree = isTreeStep(s);
    let optHtml = "";
    for (const g of ["Economy", "Units", "Trees"]) { const items = opts.filter(o => o.group === g); if (!items.length) continue; optHtml += '<optgroup label="' + g + '">'; for (const o of items) optHtml += '<option value="' + o.value + '"' + (o.value === s.target ? " selected" : "") + '>' + o.label + '</option>'; optHtml += '</optgroup>'; }
    let sub, ctrl;
    if (tree) {
      const pend = treeNodesPending(s), picked = s.nodes ? Object.values(s.nodes).filter(Boolean).length : 0;
      sub = picked ? (pend + " / " + picked + " nodes left") : "no nodes picked — hit EDIT";
      ctrl = '<button class="as-edit">' + iconMarkup("gear") + 'EDIT</button>';
    } else {
      const nx = autoTargetNext(s.target), c = s.count || 0;
      sub = c <= 0 ? "✓ done" : (nx ? (c + "× left · @ " + curSym(S.galaxy) + " " + fmt(nx.cost) + " ea") : (c + "× left · nothing to buy"));
      ctrl = '<div class="ar-step"><button class="as-m">−</button><b class="as-q">' + c + '</b><button class="as-p">+</button><button class="as-p10">+10</button></div>';
    }
    const row = document.createElement("div");
    row.className = "auto-row" + ((tree ? treeNodesPending(s) > 0 : (s.count || 0) > 0) ? "" : " off") + (active ? " active" : "");
    row.innerHTML = '<span class="ar-slot">' + (i + 1) + '</span>'
      + '<div class="ar-main"><select class="ar-sel">' + optHtml + '</select><div class="ar-next">' + (active ? "▶ " : "") + sub + '</div></div>'
      + ctrl + '<button class="ar-x">✕</button>';
    row.querySelector(".ar-sel").onchange = e => { autoRetarget(s, e.target.value); save(); renderAuto(); };
    row.querySelector(".ar-x").onclick = () => { q.splice(i, 1); save(); renderAuto(); };
    if (tree) { row.querySelector(".as-edit").onclick = () => { $("auto-modal").classList.remove("show"); openSkillTree(s.target.slice(5)); STree.pick = true; STree.pickStep = s; }; }
    else {
      row.querySelector(".as-m").onclick = () => { s.count = Math.max(0, (s.count || 0) - 1); save(); renderAuto(); };
      row.querySelector(".as-p").onclick = () => { s.count = (s.count || 0) + 1; save(); renderAuto(); };
      row.querySelector(".as-p10").onclick = () => { s.count = (s.count || 0) + 10; save(); renderAuto(); };
      row.querySelector(".as-q").onclick = () => { s.count = 0; save(); renderAuto(); };
    }
    return row;
  }
  function openAuto() { closeCards(); ensureAuto(); const cfg = curAuto(); if (cfg.doneFx) { cfg.doneSeen = true; save(); } renderAuto(); $("auto-modal").classList.add("show"); }
  function renderAuto() {   // v17 ONE ARMY: one plan, one panel — the 18 per-planet sections are gone
    ensureAuto();
    const lock = $("auto-lock"), list = $("auto-list"), ph = $("auto-planet"), tog = $("auto-toggle"); if (!list) return;
    const cfg = curAuto(), q = cfg.queue, slots = autoSlots(), opts = autoTargetOptions(), act = cfg.on ? autoActive() : null;
    if (ph) ph.textContent = "· one army, one plan";
    if (tog) { tog.textContent = cfg.doneFx ? "✓ PLAN COMPLETE — AUTO-BUY " + (cfg.on ? "ON" : "OFF") : "AUTO-BUY: " + (cfg.on ? "ON" : "OFF"); tog.classList.toggle("on", !!cfg.on); tog.onclick = () => { cfg.on = !cfg.on; autoAcc = 0; save(); syncAutoBtn(); renderAuto(); }; }
    if (lock) lock.textContent = "Steps run top to bottom, planet after planet — your army carries everything forward. +50% tax.";
    list.innerHTML = "";
    q.slice(0, slots).forEach((s, i) => list.appendChild(autoStepRow(s, i, opts, !!act && act.idx === i, q)));
    if (q.length < slots) { const add = document.createElement("button"); add.className = "auto-add"; add.textContent = "＋ Add step  (" + (q.length + 1) + "/" + slots + ")"; add.onclick = () => { q.push({ target: opts[0] ? opts[0].value : "value", count: 10 }); save(); renderAuto(); }; list.appendChild(add); }
    syncAutoBtn();
  }

  /* --------------------- class skill TREE (interconnected map) ----- */
  // A real, Path-of-Exile-style skill tree: a START node at the centre with
  // three "wings". Each wing is a diamond LOOP of small nodes (so there are
  // multiple routes), feeding two stat branches into a big NOTABLE keystone and
  // an outer extra node. Adjacent wings are cross-linked, so the whole thing is
  // one connected graph. A node can only be allocated once a CONNECTED node is
  // already allocated — that is the prerequisite. Layout is shared; each class
  // names its notables differently and resolves its own stat magnitudes.
  const CLASS_WEB = {
    turret:      { keys: ["War Machine", "Marksman", "Heavy Ordnance"] },
    mortar:      { keys: ["Annihilation", "Spotter Net", "Saturation Field"] },
    plasma:      { keys: ["Overload", "Crit Cascade", "Ion Storm"] },
    laser:       { keys: ["Death Beam", "Prism Crit", "Resonant Cascade"] },
    railgun:     { keys: ["Railstorm Core", "Calibrated", "Overrail"] },
    drone:       { keys: ["Perfect Collector", "Slipstream", "Swift Magnet"] },
    swarm:       { keys: ["Locust God", "Pack Hunter", "Hive Sync"] },
    collector:   { keys: ["Mega Hauler", "Bulk Maw", "Power Magnet"] },
    magnet:      { keys: ["Magnetar Core", "Coil Reach", "Flux Drive"] },
    tractor:     { keys: ["Singularity Beam", "Tow Reach", "Beam Lock"] },
    singularity: { keys: ["Big Crunch", "Event Maw", "Tidal Lock"] },
    nova:        { keys: ["Singularity Core", "Void Caller", "Supernova"] },
    wormhole:    { keys: ["Event Horizon", "Spaghettify", "Cosmic Maw"] },
  };
  // Each class gets its OWN tree, generated deterministically from its name:
  // a START hub with a random number of wings (3-5), each wing a chain or a
  // diamond loop of varying length, fed by its own stat, with notables and
  // keystones at the tips and some wings woven to their neighbour. Same rules
  // (allocate outward by adjacency); only the shape differs per class.
  const _trees = {};
  function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeRng(seed) { let s = (seed || 1) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function buildTree(type) {
    type = type || (typeof STree !== "undefined" && STree.type) || "turret";
    if (_trees[type]) return _trees[type];
    const R = makeRng(fnv("ids:" + type)), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const nodes = [{ id: "start", x: 0, y: 0, kind: "start", slots: [], wing: -1, nameSlot: "start", ni: 0 }], edges = [];
    const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, x: 0 }; let keyN = 0;
    const setSpec = () => { if (CLASS_SPEC[type]) nodes[nodes.length - 1].spec = CLASS_SPEC[type]; };   // defenders only; call right after an add("K",…)
    const stats = [1, 2, 3, 4], NP = stats.length;   // 4 primaries: defenders = dmg/rate/range/Mind, collectors = speed/pull/reach/Capacity
    for (let i = NP - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [stats[i], stats[j]] = [stats[j], stats[i]]; }
    const deep = { turret: 0, mortar: 0, plasma: 1, laser: 1, railgun: 2, nova: 3 }[type] || 0;   // later classes get deeper trees
    const col = isCol(type);
    const nW = ri(5, 7) + deep, rot = R() * Math.PI * 2;     // far more wings — bigger trees
    // COLLECTORS ONLY: one whole wing is dedicated to Process/consumption (the x-branch),
    // a single coherent section you path into and invest as a block, instead of process
    // being dotted around as a little sub-arm hanging off every wing. Defender trees are
    // untouched — their Crit (x) still weaves throughout exactly as before.
    const procW = col ? nW - 1 : -1;
    const keySlots = (s1, s2) => s1 === s2 ? [{ p: s1, mag: "key" }] : [{ p: s1, mag: "key" }, { p: s2, mag: "key" }];
    for (let w = 0; w < nW; w++) {
      const th = rot + w * (Math.PI * 2 / nW), ux = Math.cos(th), uy = Math.sin(th), px = Math.cos(th + Math.PI / 2), py = Math.sin(th + Math.PI / 2);
      const isProc = w === procW;     // the dedicated Process section (collectors only)
      const wid = "w" + w, stat = isProc ? "x" : stats[w % NP], stat2 = isProc ? "x" : stats[(w + 1) % NP];
      const step = 0.66 + R() * 0.16, dx = 0.62 + R() * 0.3, arm = ri(4, 6) + deep, loop = R() < 0.55;   // longer arms — far more nodes per wing (deeper for later classes)
      const add = (k, r, s, kind, slots) => { const ns = kind === "key" ? "key" : slots[0].p, ni = kind === "key" ? keyN++ : cnt[ns]++; nodes.push({ id: wid + k, x: ux * r + px * s, y: uy * r + py * s, kind, slots, wing: w, nameSlot: ns, ni }); };
      const e = (a, b) => edges.push([wid + a, wid + b]);
      add("E", 0.95, 0, "minor", [{ p: stat, mag: "min" }]); edges.push(["start", wid + "E"]);
      // Defenders weave Crit (x) throughout via a small sub-arm off each entry node;
      // collectors don't — their Process lives in the dedicated wing above.
      if (!col) { const xn = ri(1, 2), side = w % 2 ? 1 : -1; for (let t = 1; t <= xn; t++) { add("Y" + t, 0.95 + step * (t + 0.25), side * (1.5 + 0.3 * t), t === xn ? "major" : "minor", [{ p: "x", mag: t === xn ? "maj" : "min" }]); e(t === 1 ? "E" : "Y" + (t - 1), "Y" + t); } }
      if (loop) {
        let pL = "E", pR = "E";
        for (let t = 1; t <= arm; t++) {
          const r = 0.95 + step * t, last = t === arm;
          add("L" + t, r, -dx * (0.7 + 0.1 * t), last ? "major" : "minor", [{ p: stat, mag: last ? "maj" : "min" }]);
          add("R" + t, r, dx * (0.7 + 0.1 * t), last ? "major" : "minor", [{ p: stat2, mag: last ? "maj" : "min" }]);
          e(pL, "L" + t); e(pR, "R" + t); pL = "L" + t; pR = "R" + t;
        }
        const kr = 0.95 + step * (arm + 1.1);
        add("K", kr, 0, "key", keySlots(stat, stat2)); setSpec(w); e("L" + arm, "K"); e("R" + arm, "K");
        add("S", kr + 0.85, 0, "major", [{ p: col ? stat : "x", mag: "maj" }]); e("K", "S");
        if (R() < 0.6) e("L1", "R1"); // rung
      } else {
        let prev = "E";
        for (let t = 1; t <= arm; t++) {
          const r = 0.95 + step * t, last = t === arm;
          add("C" + t, r, (R() - 0.5) * 0.5, last ? "major" : "minor", [{ p: stat, mag: last ? "maj" : "min" }]);
          e(prev, "C" + t); prev = "C" + t;
          if (R() < 0.5) { add("P" + t, r + 0.15, (R() < 0.5 ? -1 : 1) * (0.8 + 0.12 * t), "minor", [{ p: stat2, mag: "min" }]); e("C" + t, "P" + t); }
        }
        if (R() < 0.7) { const kr = 0.95 + step * (arm + 1); add("K", kr, 0, "key", keySlots(stat, isProc ? "x" : stats[(w + 2) % NP])); setSpec(w); e("C" + arm, "K"); }
        else { add("X", 0.95 + step * (arm + 1), 0, "major", [{ p: col ? stat : "x", mag: "maj" }]); e("C" + arm, "X"); }
      }
    }
    for (let w = 0; w < nW; w++) if (R() < 0.7) edges.push(["w" + w + "E", "w" + ((w + 1) % nW) + "E"]); // inner ring weave
    // v17.7 MIND QUANTA (owner call: "10% Mind at a time per upgrade"): each defender tree carries
    // EXACTLY ten ◈ slots — a countable ten-step 0%→100% climb. Keep the ten CLOSEST to the start
    // (the natural progression along the wing); every surplus deeper Mind slot converts to Crit so
    // no generated node is wasted. slotAmt pays each surviving slot a flat +10% (INT_STEP).
    if (!col) {
      const intP = dPrim(type).indexOf("int") + 1;
      if (intP > 0) {
        const carriers = [];
        for (const n of nodes) if (n.slots) for (const s of n.slots) if (s.p === intP) carriers.push({ n, s });
        carriers.sort((a, b) => Math.hypot(a.n.x, a.n.y) - Math.hypot(b.n.x, b.n.y));
        for (let i = 10; i < carriers.length; i++) {
          const { n, s } = carriers[i]; s.p = "x";
          if (n.slots.every(sl => sl.p === "x") && n.nameSlot !== "key") n.nameSlot = "x";   // fully converted node reads as a Crit node (icon + name pool)
        }
      }
    }
    // v17.7 DECLUTTER (owner call: "trees have overlap — you can't fully see an upgrade node"):
    // the generator can land nodes of neighbouring wings and sub-arms on top of each other.
    // Deterministic pairwise relaxation: push overlapping discs apart (radii mirror STree.nodeRad's
    // tree-unit sizes + a visible margin) until every node stands clear; the start stays pinned.
    {
      const KR = { start: 0.34, minor: 0.20, major: 0.28, key: 0.37 };
      for (let it = 0; it < 120; it++) {
        let moved = false;
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i], B = nodes[j], need = KR[A.kind] + KR[B.kind];
          let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          if (d >= need) continue;
          if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
          const push = (need - d) / 2 + 0.01, ux = dx / d, uy = dy / d;
          if (A.kind !== "start") { A.x -= ux * push; A.y -= uy * push; }
          if (B.kind !== "start") { B.x += ux * push; B.y += uy * push; }
          moved = true;
        }
        if (!moved) break;
      }
    }
    const map = {}, adj = {}; nodes.forEach(n => { map[n.id] = n; adj[n.id] = []; });
    const eds = edges.filter(([a, b]) => map[a] && map[b]);
    eds.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    _trees[type] = { nodes, edges: eds, map, adj };
    return _trees[type];
  }
  const STAT_LBL = { dmg: "dmg", rate: "rate", range: "rng", crit: "crit", int: "mind", splash: "blast", speed: "spd", suction: "pull", collect: "reach", capacity: "capacity", ingest: "process" };
  function slotText(type, s) {
    const col = isCol(type), amt = slotAmt(type, s);
    if (s.p === "x") return "+" + Math.round(amt * 100) + "% " + (col ? "process" : "crit");
    const key = (col ? COL_PRIM : dPrim(type))[s.p - 1];
    return key === "range" ? "+" + amt + " " + STAT_LBL[key] : "+" + Math.round(amt * 100) + "% " + STAT_LBL[key];
  }
  const nodeFx = (type, n) => { let s = (n.slots || []).map(sl => slotText(type, sl)).join(" · "); if (n.spec) s += (s ? " · " : "") + "✦ " + SPEC_NAME[n.spec]; return s; };
  // Plain-language glossary for every stat a tree node can grant — surfaced by an
  // ⓘ button in the node panel so you always know what a boost actually does.
  const STAT_TITLE = { dmg: "Damage", rate: "Fire Rate", range: "Range", crit: "Crit", int: "Mind", splash: "Blast Radius", multi: "Multishot", speed: "Speed", suction: "Pull", collect: "Reach", capacity: "Capacity", ingest: "Process", explosive: "✦ Explosive Rounds", chain: "✦ Chain Lightning", pierce: "✦ Piercing Laser" };
  const STAT_INFO = {
    explosive: "✦ SPECIALIZATION — every shot DETONATES, dealing its full damage to all dots in a blast radius (turns the unit into a bomb tower). Each Explosive keystone makes the blast bigger.",
    chain: "✦ SPECIALIZATION — every shot ARCS like lightning from the dot it hits to nearby dots, jumping one extra time per keystone (damage fades a little each jump). Shreds clusters.",
    pierce: "✦ SPECIALIZATION — every shot becomes a LASER LANCE that punches through and hits every dot in a straight line, not just the target. More keystones = a wider beam.",
    dmg: "Damage per shot. Kills come faster, and since kills ARE your income, raw damage is your economy.",
    rate: "Fire rate (shots/sec). High enough and a unit machine-guns, firing several shots per frame.",
    range: "Targeting range (flat bonus). Wider range keeps more dots in reach, so units idle less.",
    crit: "Crit chance. A critical shot deals ~2.2× damage and pops a little extra.",
    int: "Mind — fire control & coordination, in ten +10% steps (10 ◈ nodes = a fully calibrated 100% class). Each volley a unit READS THE FIELD with probability = Mind; otherwise it sprays at whatever's nearest like any dumb gun. Reading skips doomed targets (lethal shells already inbound), triages shots onto the richest dot it can hit (>40%), and aims blasts where they catch the most loot (>50%, splash classes). Above all: FIRE DISCIPLINE — an overshot killing blow vaporizes up to 30% of a dot's loot, and Mind is what keeps it (plus a precision-harvest bonus up to +12%). Higher Mind = fewer mistakes = visibly more income per kill.",
    splash: "Blast Radius — how wide the Mortar's bomb detonates. Every dot inside the blast takes the FULL shell damage, so a wider blast means one lobbed bomb wipes a whole cluster at once. Area grows with the square of the radius, so each node hits dramatically more dots — the Mortar's core lever alongside raw shell damage (it fires only once every several seconds, so each bomb must count).",
    multi: "Multishot. Each keystone lets EVERY unit of this class fire at one extra dot at the same time.",
    speed: "Movement speed — how fast this collector chases orbs. Capped so it stays agile instead of flying straight past loot.",
    suction: "Pull — reel STRENGTH. Once an orb is inside your Reach it gets dragged toward the collector; Pull is how FAST. Heavy loot (armored & boss orbs) drags slowly and can expire mid-haul, so Pull matters most for fat orbs and for big-Reach builds where the trip in is long. (Pull is a force, not a radius — Reach decides how far you engage.)",
    collect: "Reach — gather RADIUS, the collector's engagement zone. Any orb inside this radius is locked on and reeled in; orbs outside it are ignored and expire. Bigger Reach works a much larger slice of the field at once (capped, so it still roams and you still want more collectors). Pull then governs how fast the engaged orbs actually arrive. Collectors carry NO cash multiplier — income lives in the Economy tab.",
    capacity: "Capacity — how many loot orbs this collector can PROCESS at the same time (its parallel maw bays). With low capacity a collector consumes orbs one or two at a time and a dense pile backs up (and orbs can expire before it gets to them); high capacity lets it chew through a whole cluster at once. Matters most after big multi-kills, Dot Rain, and Black Hole pulls — exactly when loot piles up faster than a single bay can clear it. (Separate from the Economy tab's Capacity, which is your cash ceiling.)",
    ingest: "Process speed — how quickly a collector consumes the loot a dot drops once it reaches it. Big/heavy loot takes longer to process, so this matters most for fat dots and armored elites — a key drone lever.",
  };
  function nodeStats(type, n) {
    const col = isCol(type), keys = [];
    for (const s of (n.slots || [])) { const k = s.p === "x" ? (col ? "ingest" : "crit") : (col ? COL_PRIM : dPrim(type))[s.p - 1]; if (!keys.includes(k)) keys.push(k); }
    if (n.kind === "key") { if (!col) { if (!keys.includes("multi")) keys.push("multi"); } else { if (!keys.includes("capacity")) keys.push("capacity"); if (!keys.includes("suction")) keys.push("suction"); } }
    if (n.spec) keys.push(n.spec);
    return keys;
  }
  // a small glyph showing WHAT a node upgrades (damage / rate / range / crit /
  // speed / suction / yield / ingest), plus class & keystone markers.
  const STAT_ICON = { dmg: "✸", rate: "»", range: "◎", crit: "✶", int: "◈", splash: "✺", speed: "➤", suction: "◉", yield: "❖", collect: "▣", capacity: "▦", ingest: "⊛" };
  function nodeIcon(type, n) {
    if (n.kind === "start") return "★";
    if (n.kind === "key") return "✦";
    const s = n.slots[0];
    if (s.p === "x") return isCol(type) ? STAT_ICON.ingest : STAT_ICON.crit;
    return STAT_ICON[(isCol(type) ? COL_PRIM : dPrim(type))[s.p - 1]] || "•";
  }
  function nodeLabel(type, n) {
    if (n.kind === "start") return TY(type).name;
    if (n.kind === "key") { const ks = (CLASS_WEB[type] || CLASS_WEB.turret).keys; return ks[n.ni % ks.length] || "Keystone"; }
    const pool = n.nameSlot === "x" ? skillNames(type).x : skillNames(type)[["", "a", "b", "c", "d"][n.nameSlot]];
    return (pool && pool[n.ni % pool.length]) || nodeFx(type, n);
  }
  function statLine(tp) {
    const s = { type: tp };
    return isCol(tp)
      ? "<b>" + Math.round(cSpeed(tp)) + "</b> spd · <b>" + Math.round(cReach(tp)) + "</b> reach · <b>×" + cPull(tp).toFixed(2) + "</b> pull · <b>" + cCapacity(tp) + "</b> bays · <b>×" + cIngest(tp).toFixed(2) + "</b> process"
      : "<b>" + fmt(uDmg(s)) + "</b> dmg · <b>" + uRate(s).toFixed(1) + "</b>/s · <b>" + Math.round(uRange(s)) + "</b> rng" + (uSplash(s) ? " · splash" : "") + (uCrit(s) ? " · " + Math.round(uCrit(s) * 100) + "% crit" : "") + (uMulti(s) ? " · <b>×" + (1 + uMulti(s)) + "</b> targets" : "") + (uInt(s) ? " · <b>" + Math.round(Math.min(1, uInt(s)) * 100) + "%</b> mind" : "") + (uExplode(s) ? " · <b>✦bombs</b>" : "") + (uChain(s) ? " · <b>✦chain</b>" : "") + (uPierce(s) ? " · <b>✦laser</b>" : "");
  }
  // allocation: a node is allocatable if a connected node is already allocated…
  const nodeAllocated = (type, id) => id === "start" || !!(S.classNodes[type] && S.classNodes[type][id]);
  // …AND (v17.9 WEB GATES, owner call: "you shouldn't be able to fully max out fire rate without
  // some basic prerequisites in a related area") the web wants a little BREADTH before depth: past
  // ring 3, each further ring asks for ~0.8 allocated nodes somewhere OUTSIDE the node's own wing
  // (capped at 8). Deliberately NOT 1-for-1 — a keystone rush just needs a handful of cheap picks
  // in other branches first, so real builds spread like a spider's web instead of one maxed spoke.
  const webNeed = (type, n) => { const d = treeDepths(type).d[n.id] || 1; return Math.min(8, Math.floor(Math.max(0, d - 3) * 0.8)); };
  const webHave = (type, wing) => { const m = S.classNodes[type]; if (!m) return 0; const G = buildTree(type); let c = 0; for (const id in m) if (m[id] && G.map[id] && G.map[id].wing !== wing) c++; return c; };
  const webLock = (type, n) => { const need = webNeed(type, n); if (!need) return null; const have = webHave(type, n.wing); return have >= need ? null : { need, have }; };
  const nodeAdjacent = (type, n) => (buildTree(type).adj[n.id] || []).some(a => nodeAllocated(type, a));
  const nodeAllocatable = (type, n) => !nodeAllocated(type, n.id) && nodeAdjacent(type, n) && !webLock(type, n);
  // DEPTH-BASED tree pricing (owner call, sim-calibrated): a node's price is set by how deep it sits in
  // the web — each ring outward costs ~2.3-2.8x the last (inner->outer span x12000, normalized per class so
  // every tree spans the same ratio regardless of size). Buying a node NEVER changes any other node's
  // price (that allocation-count coupling was what forced route-optimizing). Keystones x8, majors x3 on
  // top of their ring. Sim result: full trees land at ~30-135% of their home planet's campaign income —
  // front rings are quick buys, the outer rings + keystones are the long-game saves.
  const TREE_SPAN = 12000, KEY_MUL = 8, MAJOR_MUL = 3;
  const _treeDepth = {};
  function treeDepths(type) {
    if (_treeDepth[type]) return _treeDepth[type];
    const G = buildTree(type);
    let adj = G.adj;
    if (!adj) { adj = {}; for (const [a, b] of G.edges) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); } }
    const d = { start: 0 }, q = ["start"];
    while (q.length) { const id = q.shift(); for (const m of (adj[id] || [])) if (!(m in d)) { d[m] = d[id] + 1; q.push(m); } }
    let max = 1; for (const k in d) if (d[k] > max) max = d[k];
    return _treeDepth[type] = { d, max };
  }
  // v18.1 (owner call: "tree upgrades on my new mortar cost 550?? WTF"): nodes were the LAST price
  // still anchored to eco(gal) — the planet currency magnitude, ×1.5/planet — while income grows
  // ~×100+ across the same span, so a fresh class's opening rungs read as pocket change at its own
  // frontier. Nodes now anchor to the CONQUER TARGET like units (2%) and travel (15%) — ONE rule for
  // every price in the game. Ring-1 of a new class ≈ 8-9% of the class's own price (mortar ~13k next
  // to the 89k mortar — a real save at unlock income); keystones ×8 land at ~2/3 of a class copy; the
  // ×12000 depth span puts tree TIPS at a few× the home target — genuinely climbed over the next
  // planets, which is what "a ladder you climb over many planets" was always supposed to mean.
  // Starter pair (gal 1) keeps its cursor pricing exactly (2.87e-5×target(1) ≡ the old eco×30 = 75
  // base, ring-1 213) — the O1-gated cold open is untouched. ERA dropped from the price: the target
  // anchor already grows faster per era than eco×ERA ever did (damage-side ERA is unchanged).
  const NODE_FRAC = t => (TY(t).gal || 1) <= 1 ? 2.87e-5 : 4.2e-4;
  function nodeCost(type, n) { const k = n.kind === "key" ? KEY_MUL : n.kind === "major" ? MAJOR_MUL : 1;
    const td = treeDepths(type), depth = td.d[n.id] || 1;
    return Math.ceil(NODE_FRAC(type) * conquerTarget(TY(type).gal || 1) * Math.pow(TREE_SPAN, depth / td.max) * k * (DEF_SCALE[type] || 1) * pk().cost * TEST_MUL()); }
  function allocNode(type, n) {
    if (!n || !nodeAllocatable(type, n)) return; const c = nodeCost(type, n); if (!(S.cash >= c)) return;   // fail-CLOSED on NaN
    S.cash -= c; (S.classNodes[type] || (S.classNodes[type] = {}))[n.id] = true;
    lastBuyT = performance.now();   // v16.10: allocations quiet the idle nudge too
    Audio_node(); STree.pulse(n);   // lock-in chime + a ripple on the web at the node (manual path only — auto-buy allocates via its own closure)
    recompute(); syncHUD(); save();
  }
  function allocAll(type) {   // test-mode: instantly allocate the WHOLE tree (skips cost/affordability — free sandbox only)
    if (!S.free) return;
    const G = buildTree(type), set = S.classNodes[type] || (S.classNodes[type] = {});
    let guard = 0;
    for (;;) { const next = G.nodes.find(n => n.kind !== "start" && nodeAllocatable(type, n)); if (!next || guard++ > 5000) break; set[next.id] = true; }
    recompute(); syncHUD(); save();
  }
  // before/after stat preview if this node were allocated.
  function nodePreview(type, n) {
    const before = statLine(type), set = S.classNodes[type] || (S.classNodes[type] = {}), had = set[n.id];
    set[n.id] = true; derived.cls[type] = classStats(type);
    try { const after = statLine(type); return { before, after }; }
    finally { if (!had) delete set[n.id]; derived.cls[type] = classStats(type); }   // ALWAYS revert the temp allocation, even if statLine throws (else the node would be silently allocated for free)
  }
  function showNodeInfo(n) {
    const panel = $("st-info"), type = STree.type;
    if (!n || n.kind === "start") { panel.classList.remove("show"); STree.sel = n ? n.id : null; return; }
    STree.sel = n.id;
    const has = nodeAllocated(type, n.id), can = nodeAllocatable(type, n), cost = nodeCost(type, n), afford = S.cash >= cost, fx = nodeFx(type, n);
    $("si-name").textContent = nodeIcon(type, n) + "  " + (nodeLabel(type, n) || fx);
    $("si-tag").textContent = n.kind === "key" ? "✦ Notable Keystone" : n.kind === "major" ? "◆ Notable" : "• Passive";
    const keyDef = n.kind === "key" && !isCol(type);
    $("si-desc").textContent = n.kind === "key"
      ? (keyDef ? "A devastating keystone: +1 multishot AND unlocks/stacks a ✦ " + (SPEC_NAME[n.spec] || "specialization") + " — a crazy weapon transformation (see the ⓘ)." : "A powerful node joining two stat branches of this wing.")
      : n.kind === "major" ? "A stronger passive on this branch." : "A small passive on the path.";
    const sk = nodeStats(type, n);
    $("si-fx").innerHTML = "Grants: " + fx + (keyDef ? " · +1 simultaneous target" : "") +
      " <button class='u-info si-info' id='si-info-btn' title='What does this boost?'>i</button>";
    $("si-info-btn").onclick = () => showInfoText("What this node boosts",
      sk.map(k => "<b>" + STAT_TITLE[k] + "</b> — " + STAT_INFO[k]).join("<br><br>"),
      sk.map(k => STAT_GIF[k]).find(Boolean));   // show the clip for this node's primary stat
    const btn = $("st-upgrade");
    if (has) { $("si-prev").innerHTML = "✓ Allocated · class now <span class='si-after'>" + statLine(type) + "</span>"; btn.textContent = "ALLOCATED"; btn.disabled = true; btn.dataset.liveCost = ""; btn.classList.remove("afford"); }
    else if (can) { const p = nodePreview(type, n); $("si-prev").innerHTML = "Now: " + p.before + "<br>After: <span class='si-after'>" + p.after + "</span>"; btn.textContent = "ALLOCATE · " + curSym(S.galaxy) + " " + fmt(cost); btn.disabled = !afford; btn.dataset.liveCost = String(cost); btn.classList.toggle("afford", afford); }
    else if (nodeAdjacent(type, n) && webLock(type, n)) { const wl = webLock(type, n), left = wl.need - wl.have;
      $("si-prev").innerHTML = iconMarkup("lock") + "Web-locked — this deep, the web wants BREADTH: allocate " + left + " more node" + (left > 1 ? "s" : "") + " in <b>other wings</b> first (" + wl.have + "/" + wl.need + ").";
      btn.textContent = "WEB-LOCKED · " + wl.have + "/" + wl.need; btn.disabled = true; btn.dataset.liveCost = ""; btn.classList.remove("afford"); }
    else { $("si-prev").innerHTML = iconMarkup("lock") + "Locked — first allocate a node connected to this one."; btn.textContent = "LOCKED"; btn.disabled = true; btn.dataset.liveCost = ""; btn.classList.remove("afford"); }
    panel.classList.add("show");
  }
  // QOL: the node panel renders once on tap, but idle income keeps flowing — without this tick the
  // ALLOCATE button stayed greyed until you re-tapped the node. Runs every frame while the tree is
  // open: the moment cash crosses the stamped cost, the button enables and pulses (and re-greys if
  // you dip back below, e.g. after buying something else mid-hover).
  function refreshTreeAfford() {
    const panel = $("st-info"); if (!panel || !panel.classList.contains("show")) return;
    const btn = $("st-upgrade"), c = btn && btn.dataset ? btn.dataset.liveCost : "";
    if (!c) return;                                     // only live in the ALLOCATE state (not ALLOCATED/LOCKED)
    const afford = S.cash >= +c;
    if (btn.disabled !== !afford) btn.disabled = !afford;   // write only on change — no per-frame repaint
    btn.classList.toggle("afford", afford);
  }
  const STree = {
    type: "turret", cx: 0, cy: 0, zoom: 1, t: 0, cv: null, c: null, w: 0, h: 0, sel: null, pick: false, pickStep: null,
    ptrs: new Map(), lx: 0, ly: 0, moved: false, pinchD: 0, hit: [], fx: [],
    selNode() { return this.sel ? buildTree(this.type).map[this.sel] : null; },
    pulse(n) { if (n && n.x !== undefined) this.fx.push({ x: n.x, y: n.y, t: 0 }); },   // allocation ripple, in TREE-space so it pans/zooms with the web
    init() {
      this.cv = $("sttree"); if (!this.cv) return; this.c = this.cv.getContext("2d");
      this.cv.addEventListener("pointerdown", e => { this.ptrs.set(e.pointerId, this.pt(e)); this.moved = false; const p = this.pt(e); this.lx = p.x; this.ly = p.y; if (this.ptrs.size === 2) { const a = [...this.ptrs.values()]; this.pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
      this.cv.addEventListener("pointermove", e => {
        if (!this.ptrs.has(e.pointerId)) return; const p = this.pt(e); this.ptrs.set(e.pointerId, p);
        if (this.ptrs.size >= 2) { const a = [...this.ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (this.pinchD) this.zoom = clamp(this.zoom * d / this.pinchD, 0.5, 3); this.pinchD = d; this.moved = true; this.clampPan(); this.lx = p.x; this.ly = p.y; return; }
        const dx = p.x - this.lx, dy = p.y - this.ly; if (Math.hypot(dx, dy) > 5) this.moved = true; this.cx += dx; this.cy += dy; this.clampPan(); this.lx = p.x; this.ly = p.y;
      });
      const up = e => { const had = this.ptrs.size; this.ptrs.delete(e.pointerId); this.pinchD = 0; if (this.ptrs.size === 1) { const r = [...this.ptrs.values()][0]; this.lx = r.x; this.ly = r.y; } if (had === 1 && !this.moved) { const p = this.pt(e); this.tap(p.x, p.y); } };
      this.cv.addEventListener("pointerup", up); this.cv.addEventListener("pointercancel", e => { this.ptrs.delete(e.pointerId); this.pinchD = 0; });
      this.cv.addEventListener("wheel", e => { e.preventDefault(); this.zoom = clamp(this.zoom * (1 - e.deltaY * 0.0015), 0.5, 3); this.clampPan(); }, { passive: false });
    },
    pt(e) { const r = this.cv.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; },
    open(type) { this.type = type; this.sel = null; this.pick = false; this.pickStep = null; $("st-info").classList.remove("show"); this.reset(); this.resize(); },
    pickSet() { return (this.pickStep && isTreeStep(this.pickStep) && this.pickStep.target.slice(5) === this.type) ? (this.pickStep.nodes || (this.pickStep.nodes = {})) : null; },
    reset() { this.cx = 0; this.cy = 0; this.zoom = 1; },
    clampPan() { const u = Math.min(this.w, this.h) * 0.078 * this.zoom, m = 13 * u; this.cx = clamp(this.cx, -m, m); this.cy = clamp(this.cy, -m, m); },   // roomier pan so nothing's locked off-screen
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); this.clampPan(); },
    nodeRad(n, u) { return n.kind === "key" ? clamp(u * 0.30, 13, 26) : n.kind === "major" ? clamp(u * 0.22, 10, 18) : n.kind === "start" ? clamp(u * 0.26, 12, 22) : clamp(u * 0.15, 7, 12); },
    sc(nx, ny) { const u = Math.min(this.w, this.h) * 0.078 * this.zoom; return { x: this.w / 2 + this.cx + nx * u, y: this.h / 2 + this.cy + ny * u, u }; },
    render(dt) {
      if (!this.cv) return; const c = this.c, type = this.type; this.t += dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = "#000"; c.fillRect(0, 0, this.w, this.h);
      const G = buildTree(type);
      // edges: bright if both allocated, medium if one (the frontier), dim else.
      for (const [ai, bi] of G.edges) {
        const A = G.map[ai], B = G.map[bi], oa = nodeAllocated(type, ai), ob = nodeAllocated(type, bi);
        const a = this.sc(A.x, A.y), b = this.sc(B.x, B.y);
        c.globalAlpha = oa && ob ? 0.85 : oa || ob ? 0.4 : 0.13; c.strokeStyle = "#fff"; c.lineWidth = oa && ob ? 3 : 2;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
      c.globalAlpha = 1; this.hit = [];
      const psetAll = this.pick ? this.pickSet() : null;
      this._pickIdx = null; if (psetAll) { this._pickIdx = {}; let oi = 0; for (const id in psetAll) if (psetAll[id]) this._pickIdx[id] = ++oi; }
      for (const n of G.nodes) {
        const p = this.sc(n.x, n.y), rad = this.nodeRad(n, p.u), has = nodeAllocated(type, n.id), can = nodeAllocatable(type, n), cost = nodeCost(type, n), afford = S.cash >= cost;
        this.hit.push({ n, x: p.x, y: p.y, r: rad + 7 });
        const pset = this.pickSet();
        if (pset && pset[n.id] && !has) {   // picked for this Auto-Buy step: dashed ring + its BUY-ORDER number
          c.globalAlpha = 1; c.strokeStyle = "#fff"; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.arc(p.x, p.y, rad + 6, 0, TAU); c.stroke(); c.setLineDash([]);
          const oi = this._pickIdx && this._pickIdx[n.id];
          if (oi) { const bx = p.x + rad + 9, by = p.y - rad - 5;
            c.beginPath(); c.arc(bx, by, 8.5, 0, TAU); c.fillStyle = "#fff"; c.fill();
            c.fillStyle = "#000"; c.font = "800 10px ui-monospace,monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(oi > 99 ? "99+" : oi, bx, by + 0.5); c.textBaseline = "alphabetic"; }
        }
        if (n.id === this.sel) { c.globalAlpha = 1; c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, rad + 7, 0, TAU); c.stroke(); }
        if (can && afford) { const pl = 0.5 + 0.5 * Math.sin(this.t * 4); c.globalAlpha = 0.35 + pl * 0.5; c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, rad + 4, 0, TAU); c.stroke(); c.globalAlpha = 1; }
        const wlock = !has && !can && nodeAdjacent(type, n) && webLock(type, n);   // reachable but the web wants breadth first
        c.beginPath(); c.arc(p.x, p.y, rad, 0, TAU);
        c.fillStyle = has ? "#fff" : can ? "rgba(255,255,255,0.18)" : wlock ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
        c.strokeStyle = has || can ? "#fff" : wlock ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.28)"; c.lineWidth = n.kind === "minor" ? 1.5 : 2.5;
        if (wlock) c.setLineDash([3, 3]); c.fill(); c.stroke(); c.setLineDash([]);
        // icon of what this node upgrades, centred in the node
        c.fillStyle = has ? "#000" : can ? "#fff" : "rgba(255,255,255,0.55)"; c.textAlign = "center"; c.textBaseline = "middle";
        c.font = "bold " + Math.round(rad * (n.kind === "minor" ? 1.1 : 0.95)) + "px serif"; c.fillText(nodeIcon(type, n), p.x, p.y + 1);
        // every node is named (smaller for the small passives) — v16.5: labels FADE OUT below a zoom
        // threshold instead of clamping up to 8px, which turned the whole zoomed-out tree into an
        // unreadable label soup on phones. Zoom in and they resolve; the selected node always keeps its name.
        { const fs = p.u * (n.kind === "minor" ? 0.11 : 0.13), la = n.id === this.sel ? 1 : clamp((fs - 5.2) / 2.4, 0, 1);
          if (la > 0.02) {
            c.textAlign = "center"; c.textBaseline = "alphabetic";
            c.globalAlpha = la; c.fillStyle = has || can ? "#fff" : "rgba(255,255,255,0.5)";
            c.font = Math.round(clamp(Math.max(fs, 8), 8, n.kind === "minor" ? 11 : 13)) + "px ui-monospace,monospace";
            c.fillText(nodeLabel(type, n), p.x, p.y - rad - 5); c.globalAlpha = 1; } }
      }
      // allocation ripples — expanding, fading rings at freshly-bought nodes
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i]; f.t += dt; const k = f.t / 0.55; if (k >= 1) { this.fx.splice(i, 1); continue; }
        const p = this.sc(f.x, f.y), e = 1 - (1 - k) * (1 - k);   // ease-out
        c.globalAlpha = (1 - k) * 0.85; c.strokeStyle = "#fff"; c.lineWidth = 1 + 2.5 * (1 - k);
        c.beginPath(); c.arc(p.x, p.y, p.u * (0.28 + e * 1.3), 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;
      $("st-title").textContent = TY(type).name.toUpperCase();
      $("st-owned").textContent = "· " + countType(type) + " deployed · " + allocCount(type) + " nodes · affects ALL";
      $("st-stats").innerHTML = statLine(type);
      const ab = $("st-auto"); if (ab) { ab.style.display = this.pickStep ? "" : "none"; ab.classList.toggle("on", !!this.pick); }
      const picking = !!(this.pick && this.pickStep);
      const tip = $("st-pick-tip");
      if (tip) { tip.style.display = picking ? "" : "none";
        if (picking) { if (this.pickMsg) { this.pickMsg.t += dt; if (this.pickMsg.t > 2.6) this.pickMsg = null; }
          const txt = this.pickMsg ? this.pickMsg.txt : "PICK MODE — every tap is saved to this Auto-Buy step instantly";
          if (tip.textContent !== txt) tip.textContent = txt;
          tip.classList.toggle("saved", !!this.pickMsg); } }
      const pd = $("st-pick-done");
      if (pd) { pd.style.display = picking ? "" : "none";
        if (picking) { const ps = this.pickSet(), tot = ps ? Object.values(ps).filter(Boolean).length : 0;
          const txt2 = "✓ DONE — ORDER SAVED (" + tot + ")"; if (pd.textContent !== txt2) pd.textContent = txt2; } }
    },
    tap(x, y) {
      let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } }
      if (this.pick && this.pickSet()) { if (best) this.togglePick(best.n); return; }
      if (!best) { this.sel = null; $("st-info").classList.remove("show"); return; }
      showNodeInfo(best.n);
    },
    // PICK MODE toggle — every tap is SAVED to the bound Auto-Buy step instantly, and the UI says so:
    // ripple + soft chime + a "✓ SAVED" line + the numbered badge + the DONE pill's live count.
    // Adding a deep node also marks its path SHALLOW→DEEP, so the shown numbers ARE the buy order.
    togglePick(n) {
      const pset = this.pickSet(); if (!pset || !n || n.kind === "start" || nodeAllocated(this.type, n.id)) return 0;
      let delta = 0;
      if (pset[n.id]) { delete pset[n.id]; delta = -1; }
      else { const path = treePath(this.type, n.id).reverse(); for (const id of path) if (!nodeAllocated(this.type, id) && !pset[id]) { pset[id] = true; delta++; } this.pulse(n); Audio_buy(); }
      const total = Object.values(pset).filter(Boolean).length;
      this.pickMsg = { t: 0, txt: delta > 0
        ? "✓ SAVED  #" + total + " " + nodeLabel(this.type, n) + (delta > 1 ? "  (+" + (delta - 1) + " path)" : "") + "  ·  " + total + " in this step"
        : "✕ removed  ·  " + total + " left in this step" };
      const pd = $("st-pick-done"); if (pd) { pd.classList.remove("bump"); void pd.offsetWidth; pd.classList.add("bump"); }
      save(); return delta;
    },
  };
  function openSkillTree(type) { selType = type; $("skilltree").classList.add("show"); STree.open(type); if ($("st-max")) $("st-max").style.display = S.free ? "" : "none"; }
  function closeSkillTree() { $("skilltree").classList.remove("show"); }
  function sellOne() {
    const list = classList(selType), i = list.findIndex(u => u.type === selType);
    const minKeep = isCol(selType) ? (selType === "drone" ? 1 : 0) : 1;
    if (i < 0 || countType(selType) <= minKeep) return;
    S.cash += Math.round(unitBuyCost(selType) / 1.9 * 0.5);
    list.splice(i, 1); if (isCol(selType)) syncCollectors();
    renderList(); syncHUD(); save();
  }
  function showGalaxyInfo(g) {
    const current = g === S.galaxy, reached = g <= S.peakGalaxy && !current, next = g === S.galaxy + 1;
    const conqHere = planetMeta(S.galaxy).conquered || S.free;
    const enroute = !!S.travel;
    const weps = ALL_TYPES.filter(t => TY(t).gal === g).map(t => TY(t).name);
    const action = current ? "<span class='gi-tag'>▶ You are here</span> <button id='gi-visit'>⊙ Zoom to base ▸</button>"
      : (enroute && g === S.travel.to) ? "<span class='gi-tag'>" + iconMarkup("rocket") + "En route — arriving in " + fmtTime(Math.max(0, S.travel.dur - S.travel.t)) + "</span>"   // v17.29: just the warp countdown — pay-to-skip removed
      : enroute ? "<span class='gi-tag'>" + iconMarkup("rocket") + "In transit…</span>"                                                                                            // can't travel/visit elsewhere mid-flight
      : reached ? "<button id='gi-jump'>⊙ Visit ▸</button>"   // dive into & play your save on this visited world
      : next ? (conqHere
          ? (S.cash >= launchPrice()
              ? "<button id='gi-travel'>Travel here ▸  " + curSym(S.galaxy) + " " + fmt(launchPrice()) + "</button>"
              : "<button id='gi-travel' class='gi-lock' disabled>Travel ▸ need " + curSym(S.galaxy) + " " + fmt(launchPrice()) + "</button>")   // show the launch cost + grey out until you can afford it (no more dead 'travel here')
          : "<span class='gi-tag'>" + iconMarkup("lock") + "Conquer " + galName(S.galaxy) + " first</span>")
      : "<span class='gi-tag'>" + iconMarkup("lock") + "Conquer earlier worlds first</span>";
    const localN = PLANET_LOCAL[planetIdx(g)] + 1, sysSize = SYSTEMS[PLANET_SYS[planetIdx(g)]].planets, race = raceAt(g), pv = S.vault[g];
    // per-planet campaign status (v17 ONE ARMY: no per-planet banks or builds — the army is global)
    const prog = current ? (planetMeta(g).conquered ? (settleIncomeRate() > 0 ? "✓ conquered  ·  ⚑ spoils paying +" + curSym(S.galaxy) + " " + fmt(settleIncomeRate()) + "/s while they last" : "✓ conquered  ·  spoils spent — the frontier is where the money is") : Math.floor(clamp(curEarned / conquerTarget(g), 0, 1) * 100) + "% to conquer  ·  unlocks Travel + idle income")
      : (pv && pv.conquered ? "✓ conquered" : (reached ? "visited — not conquered" : "unexplored"));
    const stats = "<div class='gi-unlock'>" + curSym(g) + " <b>" + curName(g) + "</b>" +
      (pv && pv.conquered && pv.mine ? " · <b>⛏ ◈ " + fmtMineRate(mineRate(g)) + "</b>" : "") +
      // v18.40: a world is only conquered by beating its keeper, and the seam comes off the keeper with
      // it — so an unconquered world advertises the fight waiting on it, and there is nothing to buy here.
      (pv && !pv.conquered && reached
        ? "<br><span class='gi-lock'>▲ " + wardenOf(g).n + " holds this world — fill the bar, then call it out</span>"
        : "") +
      "<br>" + prog + "</div>";
    $("gm-info").innerHTML = "<div class='gi-name'>" + galName(g) + "</div>" +
      "<div class='gi-desc'>" + sysName(g) + " system · planet " + localN + "/" + sysSize + " · world " + g + "/" + TOTAL_PLANETS + "<br>" + galDesc(g) + "</div>" +
      stats +
      "<div class='gi-unlock'>" + iconMarkup("alien") + "Native race: <b>" + race.name + "</b> — " + RACE_FX[race.key] + "<br><span class='gi-counter'>↳ " + NICHE_HINT[race.niche || "balanced"] + "</span></div>" +
      (weps.length ? "<div class='gi-unlock'>Unlocks: " + weps.join(", ") + "</div>" : "") + "<div class='gi-act'>" + action
      + (AUTOBUY_ON ? "<button id='gi-autotog' class='gi-auto" + (curAuto().on ? " on" : "") + "'>" + iconMarkup("gear") + "Auto " + (curAuto().on ? "ON" : "OFF") + "</button>"
      + "<button id='gi-auto' class='gi-auto'>Edit ▸</button>" : "") + "</div>";   // v18.12: the card's AUTO pair follows the stash flag too (owner: "I can still see Auto buttons")
    $("gm-info").classList.add("show");
    const at = $("gi-autotog"); if (at) at.onclick = () => { const c = curAuto(); c.on = !c.on; autoAcc = 0; save(); syncAutoBtn(); showGalaxyInfo(g); };   // v17: ONE global auto-buy toggle
    const ab = $("gi-auto"); if (ab) ab.onclick = () => { $("gm-info").classList.remove("show"); openAuto(); };   // open THE build order
    const t = $("gi-travel"); if (t) t.onclick = () => { if (S.travel) return; travel(); $("gm-info").classList.remove("show"); };   // v17.29: launch only — no pay-to-skip mid-warp
    // v18.39: the star map's BUILD handler is gone with its button — nothing outside the duel founds a mine.
    const j = $("gi-jump"); if (j) j.onclick = () => { $("gm-info").classList.remove("show"); GMap.flyInto(g, () => { jumpTo(g); $("galaxy-map").classList.remove("show"); GMap.hide(); }); };
    const vc = $("gi-visit"); if (vc) vc.onclick = () => { $("gm-info").classList.remove("show"); GMap.flyInto(g, () => { $("galaxy-map").classList.remove("show"); GMap.hide(); }); };   // already here → just dive to the base
  }

  const INFO = {
    turret: "ALL-ROUNDER backbone — cheap, fast single-target. Even damage vs everything. Signature keystone: ✦ Chain Lightning. Smallest tree.",
    mortar: "SWARM-CLEARER — splash shells, ×2.2 damage to weak/small dots (but barely scratches armor). Signature: ✦ Explosive Rounds. Deeper tree than turret.",
    plasma: "ANTI-TANK — heavy bolts, ×2.4 vs armored/tanky dots. Signature: ✦ Chain Lightning. Deep, strong tree.",
    laser: "SWARM-SHREDDER — rapid beam, ×2.6 vs fast/weak swarms (weak vs armor). Signature: ✦ Piercing Laser. Deep tree, scales hard with crit.",
    railgun: "ARMOR SNIPER — devastating ×4 damage to armored/tanky dots (weak vs swarms). Signature: ✦ Piercing Laser. Huge, top-tier tree.",
    nova: "VOID BOMBARDMENT — endgame artillery with massive splash that devastates everything on screen. Signature: ✦ Explosive Rounds. The deepest, strongest tree in the game.",
    drone: "Fast, agile collector — chases the nearest cash orb. Its tree is about Speed & Ingest (how quickly it swallows loot), not a big magnet pull. Field up to 4.",
    swarm: "Faster with a wider net — covers more of the field than a lone drone.",
    collector: "Heavy hauler: big pull radius & grab size, higher yield per orb.",
    magnet: "Strong long-range magnetic pull and high yield.",
    tractor: "Very wide tractor beam that sweeps huge areas of orbs.",
    singularity: "Black hole — hovers centre-field and slowly drags EVERY orb (and nearby dots) inward. Huge reach & yield.",
    wormhole: "Wormhole — the ultimate singularity: hovers and slowly drags EVERY orb (and nearby dots) across the whole field inward. The largest reach & yield of any collector.",
    capacity: "Your cash ceiling — how much money you can hold at once. Raise it to afford big buys and travel; it also caps offline earnings.",
    value: "A FLAT +8% cash per dot per level (additive — it doesn't compound, so no runaway). Also ramps dot 'menace' — tougher dots, armored elites and exotic kinds appear (and pay more) as you invest.",
    spawnRate: "More dots per second — and if you're clearing them fast, you just get MORE to kill. Only when the field actually fills up (you can't keep up) does extra Spawn Rate convert into 'menace' instead: every dot spawns tougher and worth far more. So fast killing is rewarded with sheer volume, and the upgrade still pays off as toughness when the screen is packed.",
    luck: "Chance for rare SPECIAL dots worth about 9× normal cash. +0.3% per level.",
    frenzy: "All defenders fire ~5× faster for 6 seconds. Cooldown 45s — save it for dense screens.",
    dotrain: "Calls a STORM: a 4.5-second downpour of dots from the sky — roughly triple a planet's normal standing field, nearly half of them special (×9 value). Cooldown 40s.",
    blackhole: "Drags every dot to the centre and crushes them over 5s. Cooldown 60s.",
  };
  // Each upgrade/tree-stat has a short side-by-side BEFORE/AFTER clip in assets/stat-gifs (gameplay
  // for the visible stats, hand-drawn schematics for the invisible ones like Mind/Luck/Capacity).
  const GIF_DIR = "assets/stat-gifs/";
  const STAT_GIF = { dmg: "damage", rate: "fire-rate", range: "range", crit: "crit", int: "mind", multi: "multishot", splash: "splash",
    speed: "collector-speed", suction: "collector-pull", collect: "reach", capacity: "capacity-col", ingest: "process",
    explosive: "multishot", chain: "multishot", pierce: "multishot" };   // ✦ specials live on keystones → show the keystone clip
  const INFO_GIF = { value: "value", spawnRate: "spawn-rate", luck: "luck", capacity: "eco-capacity" };   // economy-tab upgrades (note: 'capacity' here = cash ceiling, a different clip than the collector Capacity stat)
  function setInfoGif(name) { const im = $("info-gif"); if (!im) return; if (name) { im.src = GIF_DIR + name + ".gif"; im.style.display = "block"; } else { im.removeAttribute("src"); im.style.display = "none"; } }
  function showInfo(title, id) { $("info-title").textContent = title; $("info-text").textContent = INFO[id] || ""; setInfoGif(INFO_GIF[id]); $("info-modal").classList.add("show"); }
  function showInfoText(title, html, gifId) { $("info-title").textContent = title; $("info-text").innerHTML = html; setInfoGif(gifId); $("info-modal").classList.add("show"); }
  // ---- ASCENSION screen (v16.0): the always-armed ASCEND button + the permanent core lines ----
  // ══ ◈ PRODUCTION VISUALS (v18.42) ═════════════════════════════════════════
  // Owner: "make the ascension tab full of informative visuals around production and stuff."
  //
  // The game is monochrome by decision, so NOTHING here is encoded by colour: every mark is the same
  // white at different opacities (a single-hue sequential), and identity comes from position and a
  // direct label. That is deliberate and it is also the accessible answer — a reader who sees no colour
  // at all loses nothing, because colour carries nothing.
  //
  // Forms follow the job: headline numbers are stat tiles (not one-bar charts), per-planet output is a
  // horizontal bar chart (magnitude, long labels), this run's ◈ sources are a two-segment stacked bar
  // with a legend (part-to-whole), bank-vs-dig is two bars on ONE ◈ axis (same measure — never two
  // scales), and the Engine is a line with the current level emphasised. Bars are capped thin with a
  // rounded data-end, gridlines are hairline and solid, and labels ride the tips rather than every mark.
  // v18.44 (owner: "why is there 4"): the pending number never said where it came from. Each world you
  // hold banks a fixed bounty — P1 is CORE_A (4), and each planet deeper is ×CORE_B — so the tile now
  // names its sources instead of asserting a total.
  function pendSrc() {
    const parts = [];
    for (let g = 1; g <= TOTAL_PLANETS; g++) { const v = S.vault && S.vault[g]; if (v && v.conquered) parts.push("P" + g + " +" + coreVal(g)); }
    const cur = S.vault && S.vault[S.galaxy];
    if (!(cur && cur.conquered)) { const t = conquerTarget(S.galaxy);
      if (t > 0) { const part = Math.floor(coreVal(S.galaxy) * Math.min(1, curEarned / t) * 0.5);
        if (part > 0) parts.push("P" + S.galaxy + " bar +" + part); } }
    if (!parts.length) return "take a world and it fills";
    return parts.length <= 3 ? parts.join(" · ") : parts.slice(0, 2).join(" · ") + " · +" + (parts.length - 2) + " more";
  }
  const ascTile = (label, value, sub) => '<div class="av-tile"><span class="av-k">' + label + '</span>'
    + '<b class="av-v">' + value + '</b>' + (sub ? '<span class="av-s">' + sub + '</span>' : '') + '</div>';
  const fmtHrs = h => h >= 1 ? (h >= 10 ? Math.round(h) : h.toFixed(1)) + "h" : Math.max(1, Math.round(h * 60)) + "m";

  // ============ v18.57 THE ASCENSION PAGE, REBUILT AROUND THE DECISION ============
  // The old page opened with a six-line essay, then four charts of roughly equal weight, and put
  // the one button the whole page exists for BELOW THE FOLD — measured at 108% of the way down the
  // scroll, so you had to go looking for the verb. It asked "should I ascend?" in four separate
  // places (a coach paragraph, a wall ETA, a pending tile, a farms-vs-hop chart) and never actually
  // answered it. Four charts with no hierarchy is the same as no chart.
  //
  // The rebuild is ONE screen with ONE decision on it, in the order a player actually asks:
  //   HERO     what pressing it banks, and what that turns your income into — the promise, up top
  //   VERDICT  a real recommendation, off the same wallEtaH()/ASC_HOP_H the ascension sim proved
  //   TRADE    resets vs keeps, side by side — the scariest question, finally scannable
  //   ENGINE   the one thing cores buy, as the next three CONCRETE purchases, not an abstract curve
  //   DETAILS  sources, mines, run split — all kept, folded away so they cannot block the verb
  // The button is pinned to the bottom of the card, so it is one tap away at any scroll position.

  // the honest recommendation. Same numbers the coach used, but it commits to an answer.
  function ascVerdict(pend) {
    const eta = wallEtaH();
    if (pend < 1) return { kind: "none", line: "Take a world first — conquering is what fills the ◈ bank." };
    if (!isFinite(eta)) return { kind: "wait", line: "No income on this world yet. Get the guns paying before you call it." };
    if (eta <= 0) return { kind: "go", line: "This world is yours. Every world you hold pays its bounty the moment you hop." };
    if (eta > ASC_HOP_H) return { kind: "go", line: "THE WALL — this bar needs ≈ " + fmtHrs(eta) + " more at your income. Hopping beats grinding it." };
    return { kind: "wait", line: "This bar lands in ≈ " + fmtHrs(eta) + " — take it first. Deeper worlds bank far more ◈." };
  }

  // THE HERO — the haul, the transform it buys, and the verdict. Everything else on the page is
  // evidence for this block. The transform is ascPreview(), which used to live inside one clause of
  // a coach sentence: it is the actual promise of prestige and it belongs at the top in big type.
  // extra Engine levels a given pile of ◈ buys from where the Engine stands today, and the ◈ still
  // short of the level after that. The distinction matters: ascPreview() pours BANKED + PENDING in
  // together, which is the right number for "come back stronger" but the wrong one for this block —
  // it credits ascending with cores you can already spend without ascending at all. Measured on a
  // real deep save it read "×3.8 → ×69" when the honest delta was ×7.5 → ×9.3.
  function engReach(cores) {
    const l = ASC_BY.engine; let c = cores, lv = ascLv("engine"), n = 0;
    while (lv + n < l.max && ascCost(l, lv + n) <= c) { c -= ascCost(l, lv + n); n++; }
    return { levels: n, short: lv + n >= l.max ? 0 : ascCost(l, lv + n) - c };
  }

  // v18.58 — the LOOP, in four pictures. Owner: "needs to be more obvious what's going on, super
  // simple and visual". v18.57 fixed the hierarchy but still explained prestige in sentences, and a
  // sentence is not a picture. This is the whole mechanic as four numbered tiles: what you give up,
  // what pays you, what it buys, and what that does to the next run. Read it once, never again.
  const ASC_LOOP = [
    ["reset",  "LOSE THE RUN",  "planets · units · cash"],
    ["gem",    "WORLDS PAY ◈",  "deeper = far more"],
    ["coin",   "◈ BUY INCOME",  "forever · never resets"],
    ["rocket", "GO DEEPER",     "same climb, much faster"],
  ];
  const ascLoopHtml = () => '<div class="ax-loop">' + ASC_LOOP.map((s, i) =>
    '<div class="ax-loop-s"><span class="ax-loop-n">' + (i + 1) + '</span>'
    + iconMarkup(s[0]) + '<b>' + s[1] + '</b><span>' + s[2] + '</span></div>').join('') + '</div>';

  // the income change as TWO BARS on one axis, not "×56 → ×69". An arrow between two numbers asks
  // you to do the division; two bars of different lengths just show you the answer.
  function ascCmpHtml(now, after) {
    const m = Math.max(after, now, 1e-9);
    const row = (k, v, w, cls) => '<div class="ax-cmp-r ' + cls + '"><span class="ax-cmp-k">' + k + '</span>'
      + '<span class="ax-cmp-t"><span class="ax-cmp-b" style="width:' + w.toFixed(1) + '%"></span></span>'
      + '<span class="ax-cmp-v">×' + multFmt(v) + '</span></div>';
    return '<div class="ax-cmp">' + row("now", now, now / m * 100, "")
      + row("after", after, after / m * 100, "after") + '</div>';
  }

  // ===== v18.59 — THREE PATTERNS BORROWED FROM SHIPPED IDLE GAMES =====
  // Owner: "try emulate a strategy that already works, copy other games, research how other games
  // make it look". Cookie Clicker, AdVenture Capitalist, Egg Inc and Clicker Heroes share a prestige
  // screen anatomy. Checked ours against it — three things were genuinely missing:
  //
  //  1. PROGRESS TO THE NEXT UNIT OF PRESTIGE CURRENCY. Cookie Clicker's legacy screen says "next
  //     chip at N cookies"; it is the genre's core retention hook, because a flat "+110" is a fact
  //     while a bar at 84% is an itch. We already have a real threshold to show: the current world's
  //     conquer bar pays floor(coreVal(g) * frac * 0.5) into the pending bank, so there is an exact
  //     earnings figure at which pending ticks up by one. nextCore() computes it.
  //  2. RUN IDENTITY. Every one of those games puts the ascension count on the screen. We already
  //     track runs, best and lifetime in META.asc and showed none of them.
  //  3. AN IN-FRAME CONFIRM. They all gate the reset behind a styled confirmation. We had one, but
  //     it was the browser's native confirm() — on a phone that paints an alert with the domain name
  //     across a black-and-white game, and worse, a headless sim calling ascend() gets it
  //     auto-dismissed and silently no-ops. The guard moves onto the button as a two-tap arm.

  // how close the current world's conquer bar is to paying one MORE ◈ into the pending bank
  function nextCore() {
    const v = S.vault && S.vault[S.galaxy];
    if (v && v.conquered) return null;                    // this world already banked its full bounty
    const t = conquerTarget(S.galaxy), half = coreVal(S.galaxy) * 0.5;
    if (!(t > 0) || !(half > 0)) return null;
    const have = Math.floor(half * Math.min(1, curEarned / t));
    if (have >= Math.floor(half)) return null;            // the bar has given everything it can
    const at = (have + 1) / half * t, from = have / half * t;   // earnings that bracket the next ◈
    const gap = Math.max(0, at - curEarned);
    return { prog: clamp((curEarned - from) / Math.max(1, at - from), 0, 1),
      gap, etaH: cps > 0 ? gap / cps / 3600 : Infinity };
  }

  // run identity — the ascension count every game in the genre puts on this screen
  function ascRunHtml() {
    const A = (META && META.asc) || {};
    const bits = [["RUN", fmt((A.runs | 0) + 1)], ["BEST", "P" + Math.max(1, A.best | 0)], ["◈ ALL-TIME", fmt(A.lifetime | 0)]];
    return '<div class="ax-run">' + bits.map(b =>
      '<span class="ax-run-i"><em>' + b[0] + '</em><b>' + b[1] + '</b></span>').join('') + '</div>';
  }

  function ascHeroHtml(pend) {
    const A = (META && META.asc) || { cores: 0, lv: {} }, l = ASC_BY.engine;
    const lv = ascLv("engine"), banked = A.cores | 0;
    const nowR = engReach(banked), aftR = engReach(banked + pend);
    const now = Math.pow(ASC_E, lv + nowR.levels), after = Math.pow(ASC_E, lv + aftR.levels);
    const v = ascVerdict(pend);
    const body = after > now ? ascCmpHtml(now, after)
      : '<div class="ax-flat">×' + multFmt(now) + ' income · '
        + (lv + aftR.levels >= l.max ? "Engine maxed"
           : aftR.short > 0 ? '<b>' + fmt(aftR.short) + '◈</b> more lifts it'
           : "the next level is yours to build") + '</div>';
    return '<div class="ax-hero ' + v.kind + '">'
      + '<span class="ax-k">' + (pend < 1 ? "NOTHING BANKED YET" : "ASCEND NOW AND BANK") + '</span>'
      + '<b class="ax-haul">' + (pend < 1 ? "—" : "+" + fmt(pend) + '<i class="ax-gem">◈</i>') + '</b>'
      + body
      + ascNextHtml()
      + '<div class="ax-verdict">' + v.line + '</div></div>';
  }

  // the hook: a bar you want to fill, instead of a number you already read
  function ascNextHtml() {
    const n = nextCore(); if (!n) return "";
    return '<div class="ax-next"><span class="ax-next-k">NEXT ◈</span>'
      + '<span class="ax-next-t"><span class="ax-next-b" style="width:' + (n.prog * 100).toFixed(1) + '%"></span></span>'
      + '<span class="ax-next-v">' + Math.round(n.prog * 100) + '%'
      + (isFinite(n.etaH) && n.etaH > 0 ? ' · ' + fmtHrs(n.etaH) : '') + '</span></div>';
  }

  // THE TRADE — icons, not a five-item word list. What leaves, what stays, at a glance.
  const ascTradeHtml = () => {
    const col = (cls, head, items) => '<div class="ax-col ' + cls + '"><span class="ax-col-h">' + head + '</span>'
      + '<div class="ax-ics">' + items.map(([i, w]) => '<span class="ax-ic">' + iconMarkup(i) + '<em>' + w + '</em></span>').join('') + '</div></div>';
    return '<div class="ax-trade">'
      + col("lose", "✕ RESETS", [["planet", "planets"], ["turret", "units"], ["tree", "trees"], ["coin", "cash"]])
      + col("keep", "✓ KEEPS", [["gem", "◈ cores"], ["power", "engine"]])
      + '</div>';
  };

  // THE ENGINE — the only sink cores have. Big current multiplier, a bar filling toward the next
  // level so "how close am I" is a picture, then the next three levels priced as a running total.
  function ascEngineHtml() {
    const A = (META && META.asc) || { cores: 0, lv: {} }, l = ASC_BY.engine;
    const lv = ascLv("engine"), banked = A.cores | 0, maxed = lv >= l.max;
    // reach comes from engReach, NOT from the three rows below — the window shows three levels but
    // a fat bank can clear far more, and "your 340◈ reach Lv 9" was just the window's last row.
    const reach = lv + engReach(banked).levels;
    const c = maxed ? 0 : ascCost(l, lv), afford = banked >= c;
    let steps = "", spend = 0;
    for (let i = 0; i < 3 && lv + i < l.max; i++) {
      spend += ascCost(l, lv + i);
      const can = banked >= spend;
      steps += '<div class="ax-step' + (can ? " can" : "") + '">'
        + '<span class="ax-step-lv">Lv ' + (lv + i + 1) + '</span>'
        + '<span class="ax-step-c">◈ ' + fmt(spend) + '</span>'
        + '<span class="ax-step-x">×' + multFmt(Math.pow(ASC_E, lv + i + 1)) + '</span></div>';
    }
    return '<div class="ax-eng"><div class="ax-eng-head">'
      + '<span class="ax-eng-t">' + iconMarkup(l.ico) + 'ENGINE</span>'
      + '<span class="ax-eng-lv">Lv ' + lv + (reach > lv ? ' → <b>' + reach + '</b> affordable' : ' / ' + l.max) + '</span></div>'
      + '<div class="ax-eng-now"><b>×' + multFmt(Math.pow(ASC_E, lv)) + '</b><span>to ALL income · +25% a level</span></div>'
      + (maxed ? '' : '<div class="ax-fill"><span style="width:' + (clamp(banked / Math.max(1, c), 0, 1) * 100).toFixed(1) + '%"></span></div>')
      + (steps ? '<div class="ax-steps">' + steps + '</div>' : '')
      + '<button class="big ax-buy' + (afford && !maxed ? " hot" : "") + '" data-asc="engine"' + (maxed || !afford ? " disabled" : "") + '>'
      + (maxed ? "★ MAXED" : "BUILD Lv " + (lv + 1) + " · ◈ " + fmt(c)) + '</button></div>';
  }
  // ── the evidence, folded away. Same charts as before; they just no longer outrank the button. ──
  const ascDetail = (sum, body) => '<details class="ax-more"><summary>' + sum + '</summary>' + body + '</details>';

  function ascMinesHtml() {
    const rows = [];
    for (let g = 1; g <= TOTAL_PLANETS; g++) { const v = S.vault && S.vault[g];
      if (v && v.conquered) rows.push({ g, name: galName(g), rate: v.mine ? mineRate(g) : 0, mine: !!v.mine }); }
    if (!rows.length) return "";
    const maxR = Math.max(...rows.map(r => r.rate), 0.0001), tot = mineRateTotal(), pend = pendingCores();
    let html = '<div class="av-sub">every mine runs on the wall clock — asleep, away, all of it</div><div class="av-bars">';
    for (const r of rows) {
      const w = Math.max(r.rate > 0 ? 3 : 0, r.rate / maxR * 100);
      html += '<div class="av-row"><span class="av-lbl">P' + r.g + ' ' + r.name + '</span>'
        + '<span class="av-track"><span class="av-bar" style="width:' + w.toFixed(1) + '%"></span></span>'
        + '<span class="av-val">' + (r.mine ? fmtMineRate(r.rate) : "—") + '</span></div>';
    }
    html += '</div>';
    // the old "ascend now or sit on the farms?" chart, as the one line it always was
    if (tot > 0 && pend > 0) html += '<div class="av-sub">parked, your mines would need <b>'
      + (pend / tot >= 1 ? Math.round(pend / tot) + " days" : Math.max(1, Math.round(pend / tot * 24)) + "h")
      + '</b> to dig the <b>' + fmt(pend) + '◈</b> one hop banks instantly.</div>';
    return ascDetail('⛏ MINES · ' + (tot > 0 ? fmtMineRate(tot) : "none built yet"), html);
  }

  function ascSplitHtml() {
    const bounty = pendingCores(), dug = S.minedRun | 0, tot = bounty + dug;
    if (!(tot > 0)) return "";
    let body;
    if (dug > 0 && bounty > 0) { const bp = bounty / tot * 100;
      body = '<div class="av-stack"><span class="av-seg s1" style="width:' + bp.toFixed(1) + '%"></span>'
        + '<span class="av-seg s2" style="width:' + (100 - bp).toFixed(1) + '%"></span></div>'
        + '<div class="av-legend"><span><i class="av-sw s1"></i>conquest, pending <b>' + fmt(bounty) + '◈</b></span>'
        + '<span><i class="av-sw s2"></i>mined, already banked <b>' + fmt(dug) + '◈</b></span></div>';
    } else body = '<div class="av-sub">' + (dug > 0
      ? 'all <b>' + fmt(dug) + '◈</b> of it dug by your mines so far — conquest pays the rest when you ascend'
      : 'all of it from conquest so far — <b>' + fmt(bounty) + '◈</b> pending. Your mines bank theirs the moment each whole ◈ lands.') + '</div>';
    return ascDetail("THIS RUN’S ◈ · WHERE IT CAME FROM", body);
  }

  function ascSourcesHtml() {
    let chips = "";
    for (let g = 1; g <= TOTAL_PLANETS; g++) { const v = S.vault && S.vault[g]; if (v && v.conquered) chips += '<span class="asc-chip">P' + g + ' ✓ +' + coreVal(g) + '</span>'; }
    { const mr = mineRateTotal(); if (mr > 0) chips += '<span class="asc-chip">◈ mines ' + fmtMineRate(mr) + '</span>'; }
    if (!(S.vault && S.vault[S.galaxy] && S.vault[S.galaxy].conquered)) { const tg = conquerTarget(S.galaxy);
      if (tg > 0) { const frac = Math.min(1, curEarned / tg), part = Math.floor(coreVal(S.galaxy) * frac * 0.5);
        chips += '<span class="asc-chip dim">P' + S.galaxy + ' bar ' + Math.round(frac * 100) + '% → +' + part + '</span>'; } }
    const body = '<div class="asc-chips">' + (chips || '<span class="asc-chip dim">nothing conquered yet — the bank is empty</span>') + '</div>'
      + '<p class="muted asc-how">The big ◈ payday lands <b>at the moment you ascend</b>: each planet <b>conquered this run</b> banks a fixed bounty that grows ~×1.3 per planet deeper (P1 +' + coreVal(1) + ' · P5 +' + coreVal(5) + ' · P10 +' + coreVal(10) + ' · P18 +' + coreVal(18) + '). The planet you\'re still fighting adds up to <b>half</b> its bounty, scaled by its conquer bar. On top, every conquered world can <b>⛏ BUILD a ◈ core mine</b> from the star map (costs 10% of that planet\'s conquer target) — a real-time dig that keeps going while you\'re away and stops when you ascend.</p>';
    return ascDetail("WHERE THE ◈ COME FROM", body);
  }

  function renderAscend() {
    const A2 = (META && META.asc) || { cores: 0, lv: {} }, pend = pendingCores();
    $("ascend-bal").textContent = fmt(A2.cores | 0);
    const html = ascLoopHtml()
      + ascRunHtml()
      + ascHeroHtml(pend)
      + ascTradeHtml()
      + ascEngineHtml()
      + ascMinesHtml()
      + ascSplitHtml()
      + ascSourcesHtml()
      + '<p class="muted ax-ladder">Hop at ~3 worlds on run 1, then a few deeper every time. Grinding a wall is never faster than hopping it.</p>';
    const body = $("ascend-body"); body.innerHTML = html; hydrateIcons(body);
    body.querySelectorAll("button[data-asc]").forEach(b2 => b2.onclick = () => buyAsc(b2.getAttribute("data-asc")));
    // the pinned action bar — outside the scrolling body, so the verb is never something you scroll to find
    const go = $("ascend-go");
    if (go) { go.disabled = pend < 1;
      go.classList.toggle("hot", ascVerdict(pend).kind === "go");
      go.classList.remove("armed"); clearTimeout(ascArmT); ascArmed = false;
      go.textContent = pend < 1 ? "◈ NOTHING TO BANK YET" : "◈ ASCEND · BANK +" + fmt(pend);
      // v18.59 TWO-TAP ARM — every prestige game in the genre gates the reset behind a confirmation,
      // and this one is in-frame instead of a browser alert. First tap arms and states the cost in
      // plain words, second commits; it disarms itself after ASC_ARM_MS so a stray tap can never sit
      // primed, and any re-render (buying an Engine level, closing) resets it too.
      go.onclick = () => {
        if (pend < 1) return;
        if (!ascArmed) {
          ascArmed = true; go.classList.add("armed");
          go.textContent = "TAP AGAIN — RESETS THE RUN";
          vibe(20); Audio_click();
          clearTimeout(ascArmT); ascArmT = setTimeout(() => {
            ascArmed = false; go.classList.remove("armed");
            go.textContent = "◈ ASCEND · BANK +" + fmt(pendingCores());
          }, ASC_ARM_MS);
          return;
        }
        clearTimeout(ascArmT); ascArmed = false; go.classList.remove("armed"); ascend();
      }; }
  }
  function openAscend() { closeCards(); renderAscend(); $("ascend").classList.add("show"); }
  function buildMetrics() {
    const s = stat();
    const sec = (t, h) => `<div class="met-sec"><h3>${t}</h3>${h}</div>`;
    const grid = h => `<div class="met-grid">${h}</div>`;
    const row = (k, v) => `<div class="met-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const bar = (k, v, pct) => `<div class="met-bar"><div class="bl"><span class="k">${k}</span><span class="v">${v}</span></div><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
    const empty = t => `<div class="met-empty">${t}</div>`;
    const killNames = { draw: "Draw-to-pop", blackhole: "Black Hole ability" };
    const ke = Object.keys(s.kills).filter(k => s.kills[k] > 0).map(k => ({ n: s.kills[k], label: TY(k) ? TY(k).name : (killNames[k] || k) })).sort((a, b) => b.n - a.n);
    const tk = ke.reduce((a, e) => a + e.n, 0) || 1;
    const ce = COL_ORDER.filter(t => s.collected[t] > 0).map(t => ({ v: s.collected[t], label: TY(t).name })).sort((a, b) => b.v - a.v);
    const tc = ce.reduce((a, e) => a + e.v, 0) || 1;
    const defFleet = DEF_ORDER.filter(t => countType(t) > 0).map(t => `${TY(t).name} ×${countType(t)}`).join(" · ") || "—";
    const colFleet = COL_ORDER.filter(t => countType(t) > 0).map(t => `${TY(t).name} ×${countType(t)}`).join(" · ") || "—";
    let nodes = 0; ALL_TYPES.forEach(t => nodes += allocCount(t));
    let conquered = 0; for (const k in S.vault) { const v = S.vault[k]; if (v && v.conquered) conquered++; }
    $("metrics-body").innerHTML =
      sec("Time &amp; progress", grid(
        row("Played (total)", fmtTime(s.playSec)) + row("This run", fmtTime(S.runSec)) +
        row("Planet", S.galaxy + " · " + galName(S.galaxy) + " (" + sysName(S.galaxy) + ")") + row("Peak planet", S.peakGalaxy) +
        row("Travels", s.travels))) +
      sec("Empire", grid(
        row(iconMarkup("star4") + "Planets conquered", conquered + " / " + TOTAL_PLANETS) +
        row("Empire idle income", "none — worlds pay ⚑ spoils once, then nothing (v18.43)"))) +
      sec("Economy", grid(
        row("Cash / sec", curSym(S.galaxy) + " " + fmt(cps)) + row("Capacity", curSym(S.galaxy) + " " + fmt(derived.capacity)) +
        row("Earned this run", curSym(S.galaxy) + " " + fmt(S.totalRun)) + row("Earned all-time", curSym(S.galaxy) + " " + fmt(META.totalEver)) +
        row("Skill nodes", nodes) +
        row("Cash lost (uncollected)", curSym(S.galaxy) + " " + fmt(s.lostCash || 0)))) +
      sec("Combat", grid(
        row("Dots popped", fmt(s.dotsPopped)) + row("Special dots", fmt(s.specials)) + row("Armored killed", fmt(s.armored || 0)) +
        row("On screen now", dots.length) + row("Avg pops / min", s.playSec > 1 ? fmt(Math.round(s.dotsPopped / s.playSec * 60)) : "0"))) +
      sec("Destroyed by", ke.length ? ke.map(e => bar(e.label, fmt(e.n) + " · " + Math.round(e.n / tk * 100) + "%", e.n / tk * 100)).join("") : empty("No kills yet")) +
      sec("Cash collected by", ce.length ? ce.map(e => bar(e.label, curSym(S.galaxy) + " " + fmt(e.v) + " · " + Math.round(e.v / tc * 100) + "%", e.v / tc * 100)).join("") : empty("Nothing collected yet")) +
      sec("Abilities used", grid(row(iconMarkup("bolt") + "Frenzy", s.abilities.frenzy) + row(iconMarkup("rain") + "Dot Rain", s.abilities.dotrain) + row(iconMarkup("blackhole") + "Black Hole", s.abilities.blackhole))) +
      sec("Fleet", empty("<b style='color:#fff'>Defenders:</b> " + defFleet) + empty("<b style='color:#fff'>Collectors:</b> " + colFleet));
  }
  // interactive pseudo-3D black & white star map
  const GMap = {
    open: false, yaw: 0.45, pitch: -0.72, zoom: 0.7, t: 0, cv: null, c: null, w: 0, h: 0,
    cx: 0, cz: 0, tcx: 0, tcz: 0, _orb: null,   // camera focus (world XZ) + smooth-lerp target
    // v16.5: the resting zoom adapts to the screen — 0.7 framed the whole galaxy nicely on desktop but left
    // a phone squinting at a thumbnail with the planet names colliding; small screens rest ~80% closer.
    restZoom() { return Math.min(this.w || window.innerWidth, this.h || window.innerHeight) < 560 ? 1.25 : 0.7; },
    reset() { this.yaw = 0.45; this.pitch = -0.72; this.zoom = this.restZoom(); this.tzoom = null; this.navG = null; this.navFollow = false; this.focusSystem(PLANET_SYS[planetIdx(S.galaxy)], true); this.updateNav(); },
    ptrs: new Map(), lx: 0, ly: 0, sx0: 0, sy0: 0, moved: false, pinchD: 0, midX: null, midY: 0, rotMode: false, hit: [], stars: [], sel: 0,
    init() {
      this.cv = $("gmap"); if (!this.cv) return; this.c = this.cv.getContext("2d");
      this.cv.addEventListener("contextmenu", e => e.preventDefault());
      this.cv.addEventListener("pointerdown", e => {
        if (this.flight) return;                              // ignore input mid-dive
        try { this.cv.setPointerCapture(e.pointerId); } catch (_) {}
        const p = this.pt(e); this.ptrs.set(e.pointerId, p); this.moved = false;
        this.lx = p.x; this.ly = p.y; this.sx0 = p.x; this.sy0 = p.y;
        this.rotMode = e.shiftKey || e.button === 2;   // desktop: shift / right-drag to ROTATE instead of move
        if (this.ptrs.size === 2) { const a = [...this.ptrs.values()]; this.pinchD = this.d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); this.midX = this.m0x = (a[0].x + a[1].x) / 2; this.midY = this.m0y = (a[0].y + a[1].y) / 2; this.gMode = null; }
      });
      this.cv.addEventListener("pointermove", e => {
        if (this.flight || !this.ptrs.has(e.pointerId)) return; const p = this.pt(e); this.ptrs.set(e.pointerId, p);
        if (this.ptrs.size >= 2) {   // TWO fingers: pinch = zoom, deliberate drag = rotate. Intent is locked against the gesture
          // START (a pure drag keeps the spread ~constant while the midpoint travels), after a small deadzone — so the
          // per-finger event wobble can never make a pinch tumble the camera or a drag snap the zoom.
          const a = [...this.ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
          if (!this.gMode) { const spread = Math.abs(d - this.d0), mid = Math.hypot(mx - this.m0x, my - this.m0y); if (spread > 14 || mid > 14) this.gMode = spread > mid ? "zoom" : "rot"; }
          if (this.gMode === "zoom" && this.pinchD) this.zoomBy(d / this.pinchD);
          else if (this.gMode === "rot" && this.midX != null) this.rotate(mx - this.midX, my - this.midY);
          this.pinchD = d; this.midX = mx; this.midY = my; this.moved = true; return;
        }
        const dx = p.x - this.lx, dy = p.y - this.ly;
        if (Math.hypot(p.x - this.sx0, p.y - this.sy0) > 9) this.moved = true;
        if (this.rotMode) this.rotate(dx, dy);   // shift / right-drag rotates (desktop)
        else this.pan(dx, dy);                    // ONE finger: move
        this.lx = p.x; this.ly = p.y;
      });
      const up = e => {
        const had = this.ptrs.size; this.ptrs.delete(e.pointerId); this.pinchD = 0; this.midX = null; this.gMode = null;
        if (this.ptrs.size === 1) { const r = [...this.ptrs.values()][0]; this.lx = r.x; this.ly = r.y; this.sx0 = r.x; this.sy0 = r.y; this.moved = true; }   // a finger lifting from a 2-finger gesture must NOT become a tap or a jump
        if (had === 1 && !this.moved) { const p = this.pt(e); this.tap(p.x, p.y); }
      };
      this.cv.addEventListener("pointerup", up); this.cv.addEventListener("pointercancel", e => { this.ptrs.delete(e.pointerId); this.pinchD = 0; this.midX = null; this.gMode = null; });
      this.cv.addEventListener("wheel", e => { e.preventDefault(); this.zoomBy(1 - e.deltaY * 0.0015); }, { passive: false });
    },
    pt(e) { const r = this.cv.getBoundingClientRect(), s = e.touches ? e.touches[0] : e; return { x: s.clientX - r.left, y: s.clientY - r.top }; },
    show() { this.open = true; this.flight = null; this.resize(); if (!this.stars.length) for (let i = 0; i < 160; i++) this.stars.push({ x: Math.random(), y: Math.random(), r: rnd(0.4, 1.6) }); this.focusSystem(PLANET_SYS[planetIdx(S.galaxy)], true); this.navG = S.galaxy; this.navFollow = false; this.tzoom = null; this.updateNav(); $("gm-info").classList.remove("show");
      this.intro = 0; this.introDur = 1.25; this.iz0 = 3.2; this.zoom = 3.2; this._warp = 1.7; Sfx.swoosh(1.05); },   // full hyperspace ARRIVAL on opening the map
    hide() { this.open = false; if (this.flight) { this.flight = null; this._warp = 1; this._diveP = null; const tv = $("transition"); if (tv) { tv.style.opacity = "0"; tv.style.background = ""; } const root = $("root"); if (root) root.classList.remove("cinematic"); } },   // closing mid-dive ABORTS the cinematic cleanly (was: left the letterbox + black veil stuck forever — a soft-lock)
    resize() { if (!this.cv) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.w = this.cv.clientWidth; this.h = this.cv.clientHeight; this.cv.width = this.w * dpr | 0; this.cv.height = this.h * dpr | 0; this.c.setTransform(dpr, 0, 0, dpr, 0, 0); },
    focusSystem(si, instant) { const c = this.sunCenter(si); this.tcx = c.x; this.tcz = c.z; if (instant) { this.cx = c.x; this.cz = c.z; } this.clampFocus(); },
    // keep the camera focus inside the galaxy so it can NEVER fly off to infinity
    clampFocus() { this.cx = clamp(this.cx, -1700, 1700); this.cz = clamp(this.cz, -1300, 1300); this.tcx = clamp(this.tcx, -1700, 1700); this.tcz = clamp(this.tcz, -1300, 1300); },   // wider bounds so you can roam the whole map
    // ALWAYS-STABLE pan: a screen drag moves the focus in the camera's ground plane, bounded — no perspective
    // inversion (which blew up near edge-on), so it can't rocket the view away.
    pan(dx, dy) {
      const k = 1 / (this.zoom * 0.5), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const fore = 1 / Math.max(0.4, Math.abs(Math.sin(this.pitch)));   // vertical foreshorten, capped so it can't explode
      const wx = -dx * k, wz = -dy * k * fore;
      this.cx += wx * cy - wz * sy; this.cz += wx * sy + wz * cy; this.tcx = this.cx; this.tcz = this.cz; this.clampFocus();
      this.navFollow = false;   // v18.20: grabbing the map releases the quick-nav orbit lock
    },
    zoomBy(factor) { this.tzoom = null; this.zoom = clamp(this.zoom * factor, 0.4, 4.5); },    // zoom toward centre — predictable, no drift (manual zoom cancels any quick-nav ease)
    // v18.20 QUICK NAV (owner: "easier to move around — quickly look at different galaxies and next
    // planets rather than always navigating by zoom and pan"). The nav bar drives these: the camera
    // GLIDES to the chosen planet (and keeps tracking it on its orbit until you grab the map), with
    // a comfortable close-up zoom; system chips glide to each sun at overview zoom.
    focusPlanet(g, follow) {
      g = clamp(g | 0, 1, TOTAL_PLANETS); this.navG = g; this.navFollow = follow !== false;
      const p = this.planetWorld(g); this.tcx = p.x; this.tcz = p.z; this.clampFocus();
      this.tzoom = Math.max(this.zoom, this.restZoom() < 1 ? 1.5 : 2.0);
      this.updateNav();
    },
    focusSys(si) {
      this.navFollow = false; this.navG = null;
      this.focusSystem(si); this.tzoom = this.restZoom();
      this.updateNav();
    },
    updateNav() {
      const cur = $("gm-cur"); if (cur) { const g = this.navG || S.galaxy; cur.textContent = "P" + g + " · " + galName(g); }
      const viewSys = this.navG != null ? PLANET_SYS[planetIdx(this.navG)] : null;
      for (let i = 0; i < 3; i++) { const b = $("gm-sys" + i); if (b) { if (!b.textContent) b.textContent = "★ " + (SYSTEMS[i] ? SYSTEMS[i].name : "SYS " + (i + 1)); b.classList.toggle("on", viewSys === i); } }
    },
    rotate(dx, dy) { this.yaw += dx * 0.009; this.pitch = clamp(this.pitch - dy * 0.009, -1.5, 1.5); },   // full tilt: from straight-down, through edge-on, all the way under to view from below
    proj(x, y, z) { x -= this.cx; z -= this.cz; const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw); let x1 = x * cy + z * sy, z1 = -x * sy + z * cy; const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch); let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const f = 360 / Math.max(120, 720 + z2) * this.zoom; return { x: this.w / 2 + x1 * f, y: this.h * 0.5 + y1 * f, z: z2, f }; },   // near-clip (max 120) stops f going zero/negative when far planets cross behind the camera on a wide pan — was flipping/NaN-ing the projection
    // THREE widely-spaced solar systems (a big triangle). Each planet rides its OWN
    // orbit: a distinct ellipse, inclination (tilt) and orientation, seeded by planet.
    SYS_POS: [{ x: -680, z: -150 }, { x: 0, z: 300 }, { x: 680, z: -150 }],
    sunCenter(si) { const p = this.SYS_POS[si] || this.SYS_POS[0]; return { x: p.x, y: 0, z: p.z }; },
    orbitParams(g) {
      if (!this._orb) this._orb = {}; if (this._orb[g]) return this._orb[g];
      const i = planetIdx(g), L = PLANET_LOCAL[i], si = PLANET_SYS[i];
      const h = Math.imul(g + si * 131 + 7, 2654435761) >>> 0, r = k => ((h >>> (k * 5)) & 31) / 31;
      const base = 66 + L * 56;                                  // wider per-ring spacing so neighbours (e.g. Ember/Cinder) don't crowd
      const a = base * (0.9 + r(0) * 0.26), b = base * (0.64 + r(1) * 0.3);   // tighter random spread → orbits keep their order, no overlap
      const inc = (r(2) - 0.5) * 1.3, node = r(3) * TAU, ph = L * 2.1 + r(4) * TAU, sp = (0.08 + r(5) * 0.06) / Math.sqrt(L + 1) * (r(0) < 0.5 ? -1 : 1);
      return this._orb[g] = { a, b, inc, node, ph, sp };
    },
    orbitPoint(g, ang) {
      const o = this.orbitParams(g), ctr = this.sunCenter(PLANET_SYS[planetIdx(g)]);
      let px = Math.cos(ang) * o.a, pz = Math.sin(ang) * o.b, py = pz * Math.sin(o.inc); pz *= Math.cos(o.inc);
      const cn = Math.cos(o.node), sn = Math.sin(o.node);
      return { x: ctr.x + px * cn - pz * sn, y: py, z: ctr.z + px * sn + pz * cn };
    },
    planetWorld(g) { const o = this.orbitParams(g); return this.orbitPoint(g, o.ph + this.t * o.sp); },
    sun(p, lit, label) {
      const c = this.c, r = clamp(12 * p.f, 5, 24);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6);
      g.addColorStop(0, "rgba(255,255,255," + (lit ? 0.85 : 0.45) + ")"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2.6, 0, TAU); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 1;
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + this.t * 0.25; c.beginPath(); c.moveTo(p.x + Math.cos(a) * r * 1.25, p.y + Math.sin(a) * r * 1.25); c.lineTo(p.x + Math.cos(a) * r * 1.6, p.y + Math.sin(a) * r * 1.6); c.stroke(); }
      c.fillStyle = "#fff"; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.globalAlpha = lit ? 1 : 0.7; c.fillStyle = "#fff"; c.font = "bold 11px ui-monospace,monospace"; c.textAlign = "center"; c.fillText("★ " + label.toUpperCase(), p.x, p.y - r * 2.6 - 4); c.globalAlpha = 1;
    },
    // EACH of the 18 planets gets a hand-assigned ARCHETYPE (+ seeded sub-variation) so every world reads
    // clearly different while staying strict black & white: cratered moons, banded gas giants, ringed
    // worlds, strong crescents, storm-spots, speckled rocks, a mooned world, inverted (white) discs,
    // fractured & spiked worlds, a clean half-shadow, a swirl. Deterministic & stable per planet index.
    planetStyle(g) {
      const cache = this._pst || (this._pst = {});
      if (cache[g]) return cache[g];
      const LOOK = ["crater", "bands", "cresc", "ring", "spot", "speck", "moon", "doublering", "inv", "vstripe", "crack", "icy", "half", "swirl", "eye", "dunes", "facet", "pulsar"];   // 18 UNIQUE looks, no repeats
      const SZ = [0.5, 1.4, 0.78, 1.95, 1.15, 0.45, 1.6, 2.4, 0.68, 1.3, 0.92, 1.8, 0.6, 1.5, 1.08, 0.55, 2.1, 2.7];   // huge size spread: tiny moons (0.45×) → giant worlds (2.7×)
      const ALB = [0.3, 0.58, 0.42, 0.72, 0.5, 0.22, 0.85, 0.52, 0.88, 0.38, 0.66, 0.9, 0.18, 0.55, 0.78, 0.28, 0.62, 0.7];   // per-world BASE BRIGHTNESS — coal-dark worlds → chalk/ice-bright worlds (the big distinguisher)
      const i = Math.min(Math.max(g, 1), 18) - 1;
      const rnd = n => ((Math.imul(((g + 1) * 374761393) ^ ((n + 1) * 668265263), 2654435761) >>> 0) / 4294967296);
      return cache[g] = { arch: LOOK[i], sizeMul: SZ[i], rot: rnd(1) * TAU, phase: rnd(2) * TAU, ringAng: (rnd(3) - 0.5) * 1.4, ringTilt: 0.2 + rnd(4) * 0.28, cs: rnd(5), inv: LOOK[i] === "inv",
        halo: rnd(6) < 0.5, haloR: 1.16 + rnd(7) * 0.3, rim2: rnd(8) < 0.4, oblate: 0.82 + rnd(9) * 0.36,
        albedo: ALB[i], rough: 0.45 + rnd(10) * 1.15, con: 0.75 + rnd(11) * 0.8, hard: rnd(12) < 0.5 };   // base brightness + surface roughness + feature contrast + hard/soft terminator → far more variety
    },
    // bake a per-planet procedural ALBEDO texture (grayscale surface, unlit) into an offscreen canvas, once.
    // The lit sphere is composited from this in planet(): texture × shading. Gives every world real detail.
    bakeTexture(g) {
      const cache = this._tex || (this._tex = {});
      if (cache[g]) return cache[g];
      const st = this.planetStyle(g), A = st.arch, lit = st.inv, TS = 128, C = TS / 2;
      const oc = (typeof document !== "undefined") ? document.createElement("canvas") : null;
      if (!oc) return null; oc.width = oc.height = TS; const o = oc.getContext("2d");
      let s = (Math.imul((g + 5) * 2654435761, 40503) >>> 0) || 1; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
      const con = st.con, dk = a => "rgba(0,0,0," + Math.min(0.92, a * con) + ")", lt = a => "rgba(255,255,255," + Math.min(0.95, a * con) + ")";
      const bv = Math.round(st.albedo * 255); o.fillStyle = "rgb(" + bv + "," + bv + "," + bv + ")"; o.fillRect(0, 0, TS, TS);   // per-world base brightness
      for (let layer = 0; layer < 4; layer++) { const n = Math.round(18 * (layer + 1) * st.rough), rad = TS * (0.2 / (layer * 0.7 + 1)); for (let i = 0; i < n; i++) { o.globalAlpha = (0.04 + 0.07 * rnd()) * st.rough; o.fillStyle = rnd() < 0.5 ? "#000" : "#fff"; o.beginPath(); o.arc(rnd() * TS, rnd() * TS, rad * (0.5 + rnd()), 0, TAU); o.fill(); } }   // fractal mottling, intensity per-world
      o.globalAlpha = 1;
      const bandsT = (n, vert) => { for (let b = 0; b < n; b++) { const u = TS * (b + 1) / (n + 1); o.strokeStyle = b % 2 ? lt(0.16) : dk(0.28); o.lineWidth = TS * (0.04 + rnd() * 0.05); o.beginPath(); if (vert) { o.moveTo(u, 0); o.lineTo(u, TS); } else { o.moveTo(0, u); o.bezierCurveTo(TS * 0.33, u + TS * 0.03 * (rnd() - 0.5), TS * 0.66, u - TS * 0.03 * (rnd() - 0.5), TS, u); } o.stroke(); } };
      const cratersT = n => { for (let k = 0; k < n; k++) { const x = rnd() * TS, y = rnd() * TS, cr = TS * (0.04 + rnd() * 0.09); o.fillStyle = dk(0.42); o.beginPath(); o.arc(x, y, cr, 0, TAU); o.fill(); o.fillStyle = dk(0.3); o.beginPath(); o.arc(x - Math.cos(st.phase) * cr * 0.3, y - Math.sin(st.phase) * cr * 0.3, cr * 0.62, 0, TAU); o.fill(); o.strokeStyle = lt(0.5); o.lineWidth = cr * 0.28; o.beginPath(); o.arc(x, y, cr * 0.85, st.phase - 1.4, st.phase + 1.4); o.stroke(); } };
      if (A === "bands" || A === "ring" || A === "doublering" || A === "spot") { bandsT(A === "spot" ? 5 : 4); if (A === "spot") { o.save(); o.translate(C + TS * 0.16, C - TS * 0.1); o.rotate(st.rot); o.fillStyle = dk(0.36); o.beginPath(); o.ellipse(0, 0, TS * 0.17, TS * 0.11, 0, 0, TAU); o.fill(); o.strokeStyle = lt(0.22); o.lineWidth = TS * 0.02; o.beginPath(); o.ellipse(0, 0, TS * 0.12, TS * 0.075, 0, 0, TAU); o.stroke(); o.restore(); } }
      else if (A === "crater") cratersT(11);
      else if (A === "moon") cratersT(6);
      else if (A === "inv") cratersT(7);
      else if (A === "vstripe") bandsT(6, true);
      else if (A === "dunes") { for (let b = 0; b < 7; b++) { const u = TS * (b + 1) / 8; o.strokeStyle = b % 2 ? lt(0.14) : dk(0.26); o.lineWidth = TS * 0.04; o.beginPath(); for (let sx = 0; sx <= 14; sx++) { const xx = sx / 14 * TS, yy = u + Math.sin(sx * 0.8 + b) * TS * 0.045; sx ? o.lineTo(xx, yy) : o.moveTo(xx, yy); } o.stroke(); } }
      else if (A === "speck") { for (let i = 0; i < 80; i++) { o.fillStyle = rnd() < 0.5 ? dk(0.42) : lt(0.32); o.beginPath(); o.arc(rnd() * TS, rnd() * TS, TS * 0.018 * (1 + rnd()), 0, TAU); o.fill(); } }
      else if (A === "crack" || A === "icy") { if (A === "icy") { o.fillStyle = "#ececec"; o.fillRect(0, 0, TS, TS); } o.strokeStyle = A === "icy" ? dk(0.3) : lt(0.55); o.lineWidth = TS * 0.014; for (let k = 0; k < 8; k++) { o.beginPath(); o.moveTo(C, C); let rr = 0, aa = rnd() * TAU; for (let sg = 0; sg < 4; sg++) { rr += TS / 8; aa += (rnd() - 0.5) * 0.8; o.lineTo(C + Math.cos(aa) * rr, C + Math.sin(aa) * rr); } o.stroke(); } }
      else if (A === "swirl") { o.strokeStyle = lt(0.5); o.lineWidth = TS * 0.05; o.beginPath(); for (let sg = 0; sg <= 44; sg++) { const t2 = sg / 44, aa = st.rot + t2 * 8, rr = TS * 0.46 * t2, x = C + Math.cos(aa) * rr, y = C + Math.sin(aa) * rr; sg ? o.lineTo(x, y) : o.moveTo(x, y); } o.stroke(); }
      else if (A === "eye") { for (let k = 1; k <= 3; k++) { o.strokeStyle = k % 2 ? lt(0.2) : dk(0.36); o.lineWidth = TS * 0.07; o.beginPath(); o.arc(C, C, TS * 0.46 * k / 3.1, 0, TAU); o.stroke(); } o.fillStyle = dk(0.42); o.beginPath(); o.arc(C, C, TS * 0.07, 0, TAU); o.fill(); }
      else if (A === "facet") { const sd = 6; for (let k = 0; k < sd; k++) { const a0 = st.rot + k / sd * TAU, a1 = st.rot + (k + 1) / sd * TAU; o.fillStyle = k % 2 ? lt(0.1) : dk(0.2); o.beginPath(); o.moveTo(C, C); o.lineTo(C + Math.cos(a0) * C, C + Math.sin(a0) * C); o.lineTo(C + Math.cos(a1) * C, C + Math.sin(a1) * C); o.closePath(); o.fill(); } }
      else if (A === "half") { o.fillStyle = dk(0.6); o.save(); o.translate(C, C); o.rotate(st.phase); o.fillRect(-C, -C, C, 2 * C); o.restore(); }
      else if (A === "pulsar") { o.fillStyle = "#f6f6f6"; o.fillRect(0, 0, TS, TS); }
      cache[g] = oc; return oc;
    },
    planet(p, r, bright, current, seld, g) {
      const c = this.c, st = this.planetStyle(g), A = st.arch, lit = st.inv, t = this.t, ringed = A === "ring" || A === "doublering";
      if (current || seld) { const pulse = 0.5 + 0.5 * Math.sin(t * 4); c.strokeStyle = "rgba(255,255,255," + (0.35 + pulse * 0.5) + ")"; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, r + 7 + pulse * 3, 0, TAU); c.stroke(); }
      c.globalAlpha = bright;
      const lx = Math.cos(st.phase), ly = Math.sin(st.phase), gx = p.x + lx * r * 0.4, gy = p.y + ly * r * 0.4, lite = a => "rgba(255,255,255," + a + ")";
      // tilted ring annulus, clipped to its far (behind) or near (front) half for proper occlusion
      const ringPass = front => { c.save(); c.translate(p.x, p.y); c.rotate(st.ringAng); c.scale(1, st.ringTilt); c.beginPath(); c.rect(-r * 3, front ? 0 : -r * 3, r * 6, r * 3); c.clip();
        const rg = c.createRadialGradient(0, 0, r * 1.42, 0, 0, r * 2.3); rg.addColorStop(0, "rgba(255,255,255,0)"); rg.addColorStop(0.2, lite(bright * 0.95)); rg.addColorStop(0.4, lite(bright * 0.22)); rg.addColorStop(0.5, lite(bright * 0.55)); rg.addColorStop(0.66, lite(bright * 0.92)); rg.addColorStop(0.82, lite(bright * 0.3)); rg.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = rg; c.lineWidth = r * 0.86; c.beginPath(); c.arc(0, 0, r * 1.84, 0, TAU); c.stroke(); c.restore(); };
      if (ringed) ringPass(false);                                                                            // back of the ring (behind the planet)
      // ── textured, lit sphere ──
      c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.clip();
      const tex = this.bakeTexture(g);
      if (tex) c.drawImage(tex, p.x - r, p.y - r, 2 * r, 2 * r); else { c.fillStyle = lit ? "#bbb" : "#555"; c.fill(); }
      c.globalCompositeOperation = "multiply";                                                                // shade the albedo: highlight → terminator → limb-dark
      const sg = c.createRadialGradient(gx, gy, r * 0.05, p.x, p.y, r * 1.14);
      if (lit) { sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.55, "#e0e0e0"); sg.addColorStop(0.85, "#9c9c9c"); sg.addColorStop(1, "#6a6a6a"); }
      else if (st.hard) { sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.48, "#cccccc"); sg.addColorStop(0.6, "#3a3a3a"); sg.addColorStop(0.86, "#0c0c0c"); sg.addColorStop(1, "#030303"); }   // airless: crisp terminator
      else { sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.42, "#cacaca"); sg.addColorStop(0.76, "#585858"); sg.addColorStop(0.95, "#1a1a1a"); sg.addColorStop(1, "#080808"); }   // atmospheric: soft terminator
      c.fillStyle = sg; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.globalCompositeOperation = "lighter";                                                                 // specular/illumination bloom on the lit cap
      const hg = c.createRadialGradient(gx, gy, 0, gx, gy, r * 0.62); hg.addColorStop(0, lite(lit ? 0.5 : 0.4)); hg.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = hg; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
      c.restore();                                                                                            // (auto-resets composite op)
      // crisp limb + a bright rim-light arc on the lit edge
      c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
      c.strokeStyle = lite(0.75); c.lineWidth = Math.max(1, r * 0.045); c.beginPath(); c.arc(p.x, p.y, r * 0.97, st.phase - 1.25, st.phase + 1.25); c.stroke();
      // atmosphere glow (soft Fresnel halo)
      if (st.halo || A === "icy" || A === "pulsar") { const ag = c.createRadialGradient(p.x, p.y, r * 0.94, p.x, p.y, r * (st.haloR + 0.26)); ag.addColorStop(0, lite(bright * 0.34)); ag.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = ag; c.beginPath(); c.arc(p.x, p.y, r * (st.haloR + 0.26), 0, TAU); c.fill(); }
      if (ringed) ringPass(true);                                                                             // front of the ring (passes in front of the planet)
      if (A === "icy") { c.fillStyle = "#fff"; const ns = 14; for (let k = 0; k < ns; k++) { const a = st.rot + k / ns * TAU; c.beginPath(); c.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); c.lineTo(p.x + Math.cos(a - 0.1) * r * 1.02, p.y + Math.sin(a - 0.1) * r * 1.02); c.lineTo(p.x + Math.cos(a) * r * 1.26, p.y + Math.sin(a) * r * 1.26); c.closePath(); c.fill(); } }   // crystalline spikes
      if (A === "pulsar") { c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.5; const ns = 10; for (let k = 0; k < ns; k++) { const a = st.rot + k / ns * TAU, ext = 1.45 + 0.28 * Math.sin(t * 3 + k); c.beginPath(); c.moveTo(p.x + Math.cos(a) * r * 0.82, p.y + Math.sin(a) * r * 0.82); c.lineTo(p.x + Math.cos(a) * r * ext, p.y + Math.sin(a) * r * ext); c.stroke(); } }   // radiating energy rays
      if (A === "moon") { const ma = st.rot + t * 0.1, mr = r * 0.3, md = r * 2.1, mx = p.x + Math.cos(ma) * md, my = p.y + Math.sin(ma) * md; const mg = c.createRadialGradient(mx + lx * mr * 0.4, my + ly * mr * 0.4, mr * 0.1, mx, my, mr); mg.addColorStop(0, "#e8e8e8"); mg.addColorStop(0.7, "#777"); mg.addColorStop(1, "#1a1a1a"); c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.strokeStyle = "rgba(0,0,0,0.5)"; c.lineWidth = 1; c.stroke(); }   // shaded satellite moon (slowly orbiting)
      c.globalAlpha = 1;
    },
    // the expedition ship — a HYPER-FUTURISTIC interceptor in stark B&W: long angular dart hull, swept
    // delta wings, glowing twin ion engines (bloom + bright core) trailing energy streaks, a lit canopy,
    // panel lines and blinking wing-tip lights. All animated. Drawn nose-along `ang`.
    drawShip(x, y, ang, r) {
      const c = this.c, t = this.t, pulse = 0.6 + 0.4 * Math.sin(t * 16);
      c.save(); c.translate(x, y); c.rotate(ang);
      c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 1;                                       // hyperdrive energy streaks
      for (const wy of [-r * 0.46, 0, r * 0.46]) { c.beginPath(); c.moveTo(-r * 1.1, wy); c.lineTo(-r * (2.8 + pulse * 1.2), wy); c.stroke(); }
      for (const wy of [-r * 0.42, r * 0.42]) {                                                        // twin ion-engine bloom → bright core
        c.fillStyle = "rgba(255,255,255,0.28)"; c.beginPath(); c.arc(-r * 1.05, wy, r * (0.55 + pulse * 0.35), 0, TAU); c.fill();
        c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.arc(-r * 1.0, wy, r * 0.34, 0, TAU); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(-r * 0.95, wy, r * 0.16, 0, TAU); c.fill();
      }
      c.fillStyle = "#9a9a9a";                                                                         // swept delta wings
      c.beginPath(); c.moveTo(r * 0.1, r * 0.24); c.lineTo(-r * 0.5, r * 1.05); c.lineTo(-r * 0.95, r * 0.95); c.lineTo(-r * 0.5, r * 0.26); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.1, -r * 0.24); c.lineTo(-r * 0.5, -r * 1.05); c.lineTo(-r * 0.95, -r * 0.95); c.lineTo(-r * 0.5, -r * 0.26); c.closePath(); c.fill();
      c.fillStyle = "#fff";                                                                            // long sharp dart hull
      c.beginPath(); c.moveTo(r * 1.9, 0); c.lineTo(r * 0.5, r * 0.3); c.lineTo(-r * 0.7, r * 0.34); c.lineTo(-r * 1.05, r * 0.5); c.lineTo(-r * 0.85, 0); c.lineTo(-r * 1.05, -r * 0.5); c.lineTo(-r * 0.7, -r * 0.34); c.lineTo(r * 0.5, -r * 0.3); c.closePath(); c.fill();
      c.strokeStyle = "#111"; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 0.8;                                           // panel lines
      c.beginPath(); c.moveTo(r * 1.7, 0); c.lineTo(-r * 0.7, 0); c.stroke();
      c.beginPath(); c.moveTo(r * 0.3, r * 0.22); c.lineTo(-r * 0.6, r * 0.24); c.stroke();
      c.beginPath(); c.moveTo(r * 0.3, -r * 0.22); c.lineTo(-r * 0.6, -r * 0.24); c.stroke();
      c.fillStyle = "#000"; c.beginPath(); c.ellipse(r * 0.65, 0, r * 0.36, r * 0.18, 0, 0, TAU); c.fill();   // glowing canopy
      c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.ellipse(r * 0.78, 0, r * 0.16, r * 0.08, 0, 0, TAU); c.fill();
      if (Math.sin(t * 7) > 0) { c.fillStyle = "#fff"; for (const wy of [-r * 1.0, r * 1.0]) { c.beginPath(); c.arc(-r * 0.5, wy, r * 0.1, 0, TAU); c.fill(); } }   // blinking wing-tip nav lights
      c.restore();
    },
    // cinematic dive: glide focus onto a planet, accelerate the zoom, white-wipe over the cut, drop into the world
    flyInto(g, onArrive) { this.flight = { g, t: 0, dur: 1.45, cx0: this.cx, cz0: this.cz, z0: this.zoom, onArrive, done: false }; Sfx.warp(1.45); const root = $("root"); if (root) root.classList.add("cinematic"); },
    render(dt) {
      if (!this.cv) return; const c = this.c;
      this.t += dt;
      if (!this.flight && this.intro == null && this._warp) this._warp = Math.max(0, this._warp - dt * 4);   // warp streaks settle after the dive
      if (this.intro != null) {                              // FULL hyperspace arrival when the map opens
        this.intro += dt; const p = clamp(this.intro / this.introDur, 0, 1), q = (1 - p) * (1 - p);
        this._warp = 1.7 * q;                                 // stars streak fast, then decelerate to points
        { const rz = this.restZoom(); this.zoom = rz + (this.iz0 - rz) * q; }             // drop out: ease the zoom from close-in out to the resting (screen-fitted) galaxy view
        if (p >= 1) { this.intro = null; this._warp = 0; this.zoom = this.restZoom(); }
      }
      if (this.flight) {                                     // zoom-into-base animation overrides the camera
        const fl = this.flight; fl.t += dt; const p = clamp(fl.t / fl.dur, 0, 1), e = p * p * (3 - 2 * p), w = this.planetWorld(fl.g);
        this.cx = fl.cx0 + (w.x - fl.cx0) * clamp(e * 1.4, 0, 1); this.cz = fl.cz0 + (w.z - fl.cz0) * clamp(e * 1.4, 0, 1);
        const dip = Math.sin(clamp(p / 0.16, 0, 1) * Math.PI) * 0.16;                              // anticipation: pull back, THEN lunge
        this.tcx = this.cx; this.tcz = this.cz; this.zoom = fl.z0 * (1 - dip) + (28 - fl.z0) * (p * p * p);
        this._warp = Math.min(1.3, e * 1.3); this._diveP = p; this._diveG = fl.g;
        const tv = $("transition");
        if (tv) {
          if (p < 0.72) { const r = 135 * (1 - clamp((p - 0.34) / 0.38, 0, 1)); tv.style.background = "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) " + r.toFixed(1) + "%, #000 " + (r + 8).toFixed(1) + "%)"; tv.style.opacity = r >= 134 ? "0" : "1"; }   // black iris closes on the planet
          else if (p < 0.88) { tv.style.background = "radial-gradient(circle at 50% 50%, #fff 0%, #fff 32%, rgba(255,255,255,.85) 62%, rgba(255,255,255,.4) 100%)"; tv.style.opacity = "1"; }   // blooming hyperspace WHITE PUNCH
          else { tv.style.background = "#000"; tv.style.opacity = "1"; }                  // settle to black for the cut
        }
        if (p >= 1 && !fl.done) { fl.done = true; const cb = fl.onArrive, gg = fl.g; this.flight = null; this._warp = 1; this._diveP = null; if (tv) { tv.style.background = "#000"; tv.style.opacity = "1"; } if (cb) cb();
          veilT = VEIL_FADE; landT = LAND_DUR; camZoom = camFit * 2.3;                    // arrive zoomed on the base, then pull back
          shakeAdd(9); flashAdd(0.4); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.6, 0.6); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.34, 0.4); burst(W / 2, H / 2, 34, 240, 2.8);   // landing impact
          const lt = $("land-title"); if (lt) { const wall = PLANET_LOCAL[planetIdx(gg)] === 0 && gg > 1;   // first world of a NEW solar system = the difficulty wall
            lt.innerHTML = galName(gg).toUpperCase() + "  ·  " + sysName(gg)
              + "<span class='lt-sub'>" + (wall ? "▲ NEW FRONTIER — far tougher dots. Dig into deeper tree rings and the new class." : "") + "</span>";
            if (wall) { shakeAdd(6); flashAdd(0.25); }
            lt.classList.remove("show"); void lt.offsetWidth; lt.classList.add("show"); }
        }
      }
      this.cx += (this.tcx - this.cx) * Math.min(1, dt * 5); this.cz += (this.tcz - this.cz) * Math.min(1, dt * 5);   // smooth focus glide
      if (this.tzoom != null) { this.zoom += (this.tzoom - this.zoom) * Math.min(1, dt * 5); if (Math.abs(this.zoom - this.tzoom) < 0.01) this.tzoom = null; }   // v18.20 quick-nav zoom ease (manual zoom/pinch cancels it — see zoomBy)
      if (this.navG != null && this.navFollow) { const pw = this.planetWorld(this.navG); this.tcx = pw.x; this.tcz = pw.z; this.clampFocus(); }   // v18.20: while nav-locked, track the planet along its orbit
      const dpr = Math.min(window.devicePixelRatio || 1, 2); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this._diveP != null && opt("shake")) { const sh = this._diveP * this._diveP * 10; c.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh); }   // build-up camera shake during the dive
      c.fillStyle = "#000"; c.fillRect(0, 0, this.w, this.h);
      const warp = this._warp || 0;
      if (warp > 0.05) {   // hyperspace: stars stretch radially away from centre as you dive in
        c.lineCap = "round";
        for (const s of this.stars) { const sx = s.x * this.w, sy = s.y * this.h, dx = sx - this.w / 2, dy = sy - this.h / 2, dl = Math.hypot(dx, dy) || 1, str = warp * warp * (50 + dl); c.strokeStyle = "rgba(255,255,255," + (0.25 + 0.55 * warp).toFixed(2) + ")"; c.lineWidth = s.r * (1 + warp * 1.6); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + dx / dl * str, sy + dy / dl * str); c.stroke(); }
      } else { c.fillStyle = "#fff"; for (const s of this.stars) { c.globalAlpha = 0.2 + 0.35 * Math.abs(Math.sin(this.t + s.x * 9)); c.fillRect(s.x * this.w, s.y * this.h, s.r, s.r); } c.globalAlpha = 1; }
      const curSys = PLANET_SYS[planetIdx(S.galaxy)];
      this.hit = [];
      // each planet's own elliptical/inclined orbit ring
      for (let g = 1; g <= TOTAL_PLANETS; g++) {
        const cur = g === S.galaxy, seld = g === this.sel;
        c.beginPath();
        for (let k = 0; k <= 64; k++) { const w = this.orbitPoint(g, k / 64 * TAU), pr = this.proj(w.x, w.y, w.z); k ? c.lineTo(pr.x, pr.y) : c.moveTo(pr.x, pr.y); }
        c.globalAlpha = seld ? 0.85 : cur ? 0.5 : 0.12; c.strokeStyle = "#fff"; c.lineWidth = seld ? 2.5 : cur ? 2 : 1; c.stroke();
      }
      c.globalAlpha = 1;
      // suns behind (far-to-near) — and register each as a tappable focus target
      SYSTEMS.map((s, si) => ({ si, p: this.proj(this.sunCenter(si).x, 0, this.sunCenter(si).z) }))
        .sort((a, b) => b.p.z - a.p.z).forEach(s => { this.sun(s.p, s.si === curSys, SYSTEMS[s.si].name); this.hit.push({ sun: s.si, x: s.p.x, y: s.p.y, r: Math.max(clamp(12 * s.p.f, 5, 24) * 2.2, 34) }); });
      // planets, far-to-near (painter's depth sort)
      const pts = []; for (let g = 1; g <= TOTAL_PLANETS; g++) { const w = this.planetWorld(g); pts.push({ g, p: this.proj(w.x, w.y, w.z) }); }
      pts.sort((a, b) => b.p.z - a.p.z);
      for (const it of pts) {
        const g = it.g, p = it.p, current = g === S.galaxy, reached = g < S.galaxy, next = g === S.galaxy + 1;
        const r = clamp(7 * p.f * this.planetStyle(g).sizeMul, 2, 38), bright = current ? 1 : reached ? 0.85 : next ? 0.8 : 0.3;   // wide min/max so tiny moons & giant worlds both read
        this.hit.push({ g, x: p.x, y: p.y, r: Math.max(r + 11, 24) });
        this.planet(p, r, bright, current, g === this.sel, g);
        c.globalAlpha = clamp(p.f, 0.4, 1); c.textAlign = "center"; c.fillStyle = (reached || current || next) ? "#fff" : "rgba(255,255,255,0.5)"; c.font = Math.round(10 * clamp(p.f, 0.7, 1.3)) + "px ui-monospace,monospace";
        c.fillText((current ? "▶ " : "") + galName(g), p.x, p.y - r - 7);
        // v18.11 (owner: "I don't see the mine and don't know how to interact with it") — mines live
        // ON THE MAP: every conquered world wears its ⛏ status under its name; an unbuilt site PULSES
        // with its price when you can afford it. Tap the planet → the card has the BUILD button.
        const pv2 = S.vault && S.vault[g];
        if (pv2 && pv2.conquered) {
          c.font = Math.round(9 * clamp(p.f, 0.7, 1.2)) + "px ui-monospace,monospace";
          if (pv2.mine) { c.fillStyle = "rgba(255,255,255,0.72)"; c.fillText("⛏◈ " + fmtMineRate(mineRate(g)), p.x, p.y + r + 12); }
          else { c.fillStyle = "rgba(255,255,255,0.45)"; c.fillText("⛏ ◈ seam unclaimed", p.x, p.y + r + 12); }   // v18.40: only reachable on a pre-migration save; nothing to buy
        }
        c.globalAlpha = 1;
      }
      // ── your expedition in transit: a STATIC dashed trajectory (frozen at launch), an OUTLINE of the
      //    destination where you're headed, and a detailed little ship riding ON the line ──
      if (S && S.travel) {
        const tv = S.travel;
        if (!tv.fromW) tv.fromW = this.planetWorld(tv.from);   // snapshot BOTH endpoints once (covers older saves) — from here the line is frozen and NEVER tracks the orbiting planets
        if (!tv.toW) tv.toW = this.planetWorld(tv.to);
        const a = tv.fromW, b = tv.toW, pr = clamp(tv.t / tv.dur, 0, 1);
        const pa = this.proj(a.x, a.y, a.z), pb = this.proj(b.x, b.y, b.z);
        c.save();
        // STILL DASHED DUPLICATE of the destination planet — frozen at the launch-time target (its real
        // size + ring), so you always see where you're landing even as the live planet keeps orbiting away
        { const st = this.planetStyle(tv.to), dr = clamp(7 * pb.f * st.sizeMul, 3, 18);
          c.save(); c.setLineDash([3, 4]); c.lineWidth = 1.3; c.strokeStyle = "rgba(255,255,255,0.62)";
          c.beginPath(); c.arc(pb.x, pb.y, dr, 0, TAU); c.stroke();                                                  // dashed planet body at its true size
          if (st.ring) { c.save(); c.translate(pb.x, pb.y); c.rotate(st.ringAng); c.scale(1, st.ringTilt); c.beginPath(); c.arc(0, 0, dr * 1.7, 0, TAU); c.stroke(); c.restore(); }   // dashed ring if it has one
          c.restore(); c.setLineDash([]);
          c.fillStyle = "rgba(255,255,255,0.85)"; c.font = "9px ui-monospace,monospace"; c.textAlign = "center";
          c.fillText("◎ " + galName(tv.to), pb.x, pb.y - dr - 8); }
        // STATIC dashed trajectory — frozen endpoints, so it never drifts as the planets orbit
        c.setLineDash([4, 6]); c.lineWidth = 1.3; c.strokeStyle = "rgba(255,255,255,0.4)";
        c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke(); c.setLineDash([]);
        // ship rides ON the (screen-space) line — interpolate the projected endpoints, no off-plane arc
        const sp = { x: pa.x + (pb.x - pa.x) * pr, y: pa.y + (pb.y - pa.y) * pr, f: pa.f + (pb.f - pa.f) * pr };
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), r = clamp(8 * sp.f, 6, 14);
        c.restore();
        this.drawShip(sp.x, sp.y, ang, r);
        c.fillStyle = "rgba(255,255,255,0.9)"; c.font = "bold 10px ui-monospace,monospace"; c.textAlign = "center";
        c.fillText(fmtTime(Math.max(0, tv.dur - tv.t)) + " ⟶", sp.x, sp.y - r - 9);
      }
      // dive-only juice: tunnel vignette + a lens-flare starburst right before the white punch
      if (this.flight && this._diveP != null) {
        const dp = this._diveP, cx2 = this.w / 2, cy2 = this.h / 2;
        const vg = c.createRadialGradient(cx2, cy2, this.h * 0.18, cx2, cy2, this.h * 0.78); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0," + (0.55 * dp).toFixed(2) + ")"); c.fillStyle = vg; c.fillRect(0, 0, this.w, this.h);
        if (dp > 0.46 && dp < 0.74) { const fa = (dp - 0.46) / 0.28; c.strokeStyle = "#fff"; c.lineCap = "round"; for (let k = 0; k < 10; k++) { const a2 = k / 10 * TAU + this.t * 0.6, len = 30 + 300 * fa * fa; c.globalAlpha = fa * 0.85; c.lineWidth = (k % 2 ? 1.5 : 3.5) * (1 + fa); c.beginPath(); c.moveTo(cx2, cy2); c.lineTo(cx2 + Math.cos(a2) * len, cy2 + Math.sin(a2) * len); c.stroke(); } c.globalAlpha = fa; c.fillStyle = "#fff"; c.beginPath(); c.arc(cx2, cy2, 6 + 60 * fa * fa, 0, TAU); c.fill(); c.globalAlpha = 1; }
      }
      // ENTERING <PLANET> banner during the dive — fades in, then the iris swallows it
      if (this.flight && this._diveP != null) {
        const a = clamp(this._diveP * 4, 0, 1) * clamp((0.7 - this._diveP) * 6, 0, 1);
        if (a > 0.02) {
          c.globalAlpha = a; c.fillStyle = "#fff"; c.textAlign = "center";
          c.font = "700 12px ui-monospace,monospace"; c.fillText("▶  E N T E R I N G", this.w / 2, this.h * 0.26);
          c.font = "800 22px ui-monospace,monospace"; c.fillText(galName(this._diveG).toUpperCase(), this.w / 2, this.h * 0.26 + 26);
          c.globalAlpha = 1;
        }
      }
    },
    tap(x, y) { let best = null, bd = Infinity; for (const h of this.hit) { const q = (h.x - x) ** 2 + (h.y - y) ** 2; if (q < bd && q < h.r * h.r) { bd = q; best = h; } }
      if (!best) return;
      if (best.sun != null) { this.focusSystem(best.sun); this.sel = null; $("gm-info").classList.remove("show"); }   // tap a sun -> recenter on its system
      else { this.sel = best.g; showGalaxyInfo(best.g); } },
  };
  // ---- PLANET LAYERS (v17 ONE ARMY): the vault holds each planet's CAMPAIGN metadata only — conquered
  // flag, conquer-bar progress, and its idle tribute rate. The fleet, trees, upgrade levels and cash are
  // ONE global army that travels with you; nothing is rebuilt, nothing is stored per planet. Ascension is
  // the game's only reset — which is the whole point of it.
  function planetMeta(g) { return S.vault[g] || (S.vault[g] = { conquered: false, earned: 0, bgRate: 0 }); }
  function snapshotActive() {   // record the departing planet's conquest metadata; the army comes along
    const v = planetMeta(S.galaxy);
    v.earned = curEarned; v.bgRate = 0;   // v18.43: the world you are leaving keeps nothing on the meter   // m7 fix: the live-cps idle estimate is CLAMPED to the designed conquer-set rate, so an over-built planet can't permanently inflate its empire idle above the curve
  }
  function arrivalCinematic(g) {   // v17.1: ARRIVING IS AN EVENT — letterbox bars, white veil iris, camera slam +
    // pull-back, double shockwave, and a title card naming the world, its system and its LOCAL TENDER.
    // Both arrival paths (expedition completing, map dive) speak with this one voice.
    const root = $("root"); if (root) root.classList.add("cinematic");
    veilT = VEIL_FADE; landT = LAND_DUR; camZoom = camFit * 2.3;
    shakeAdd(9); flashAdd(0.45); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.6, 0.6); ring(W / 2, H / 2, 14, Math.max(W, H) * 0.34, 0.4); burst(W / 2, H / 2, 34, 240, 2.8);
    const lt = $("land-title"); if (lt) { const wall = PLANET_LOCAL[planetIdx(g)] === 0 && g > 1;
      lt.innerHTML = galName(g).toUpperCase() + "  ·  " + sysName(g)
        + "<span class='lt-sub'>" + (wall ? "▲ NEW FRONTIER — far tougher dots. Dig into deeper tree rings and the new class." : "tougher, richer dots — your whole army and eco ladder carry with you") + "</span>";
      lt.classList.remove("show"); void lt.offsetWidth; lt.classList.add("show"); }
  }
  function activatePlanet(g) {   // point the ONE ARMY at planet g — fleet, trees, levels and cash all arrive with you
    const v = planetMeta(g);
    S.galaxy = g; if (g > S.peakGalaxy) S.peakGalaxy = g; curEarned = v.earned || 0;
    wardenReset();   // v18.21: the duel belongs to the world you left — never carry it across
    dots = []; orbs = []; beams = []; shells = []; parts = []; selUnit = -1;
    syncCollectors(); recompute(); renderList(); syncHUD(); GMap.reset && 0;
  }
  // journey time is RELATIVE TO THE REAL MAP DISTANCE between the two planets (the line the ship
  // flies). Calibrated so the first short hop ≈ 3h; far planets & inter-system hauls scale up
  // naturally (the big cross-system jumps land around a day+).
  const TRAVEL_SEC_PER_UNIT = 26.8;   // ~1/3 of the old pace — journeys are a third as long
  function travelDur(a) {
    // v17.23 (owner call): travel is a 7-second WARP CINEMATIC — hyperspace starlines, a rolling
    // dashed tunnel, breathing vortex arms, and the destination planet's silhouette rushing up out
    // of the void into a white flash → the arrival cinematic. Pure spectacle: the income-anchored
    // launch SAVE is still the only real gate (v17.22 removed the old 5-10 minute transit walls).
    return 7;
  }
  function travel() {   // LAUNCH an expedition to the next planet: costs treasury + takes a real journey
    const g = S.galaxy;
    if (S.travel) return;                                   // already en route
    if (wardenOn) { Audio_err(); floatTxt(W / 2, H * 0.36, "⛏ FINISH THE WARDEN DUEL FIRST"); return; }   // v18.21: one thing at a time — no launching out of a live fight
    if (g >= TOTAL_PLANETS) return;                         // no planet beyond the last
    if (!S.free && g + 1 <= S.peakGalaxy) { jumpTo(g + 1); return; }   // next world already reached — instant hop, never a fresh paid re-launch/journey (fixes re-launching P1→P2 after already doing it)
    if (!S.free && !planetMeta(g).conquered) return;        // must conquer the current planet first (test mode may jump)
    const cost = launchPrice();
    if (!(S.cash >= cost)) return;                          // need the launch funds banked (fail-CLOSED on NaN)
    S.cash -= cost;
    let fromW = null, toW = null; try { const w = GMap.planetWorld(g), w2 = GMap.planetWorld(g + 1); fromW = { x: w.x, y: w.y, z: w.z }; toW = { x: w2.x, y: w2.y, z: w2.z }; } catch (e) {}   // freeze BOTH endpoints at launch — the trajectory line is fixed in space and never drifts as the planets orbit
    S.travel = { from: g, to: g + 1, t: 0, dur: travelDur(g), fromW, toW, cost };   // store the launch cost — the same amount, paid again, finishes the journey instantly (partial payments cut it proportionally)
    META.stats.travels++; flashAdd(0.35); shakeAdd(2); vibe(60); Audio_launch(); Audio_warp(S.travel.dur); recompute(); syncHUD(); save();
  }
  // (v17.29: pay-to-skip travel retired — travel is a 7-second warp cinematic, there is nothing worth skipping.)
  // jump to ANY reached planet (revisit & upgrade your background empire, or test)
  function jumpTo(g) { g = clamp(Math.round(g), 1, Math.max(S.peakGalaxy, 1)); if (g === S.galaxy) return;
    if (wardenOn) { Audio_err(); floatTxt(W / 2, H * 0.36, "⛏ FINISH THE WARDEN DUEL FIRST"); return; }   // v18.21: the map's VISIT route obeys the same order as LAUNCH
    snapshotActive(); flashAdd(0.5); ring(W / 2, H / 2, 10, Math.max(W, H), 0.5); activatePlanet(g); save(); }
  // CODES: "test" turns on FREE SANDBOX mode — everything is unlocked & free to
  // buy so you click and test whatever you want yourself (it does NOT hand you a
  // pre-built roster). Toggle off by entering the code again.
  function unlockAll() {
    S.free = !S.free;                                       // toggle free sandbox
    if (S.free) { S.peakGalaxy = TOTAL_PLANETS; S.cash = Math.max(S.cash, 1e12); }   // TEST MODE: all planets jumpable + a big cash float so the 1%-cost buys are trivially affordable
    syncBuyMode();   // (v16.5: bulk-buy shows for everyone now — just refresh its label)
    syncCollectors(); recompute(); renderList(); syncHUD(); save();
    return S.free;
  }
  /* ----------------------------- screens ------------------------- */
  // v16.5: the card modals are mutually exclusive — opening one closes the others, so Settings can never
  // sit half-visible behind Ascension (they used to stack, both interactive at once).
  const CARD_MODALS = ["menu", "settings", "metrics", "ascend", "auto-modal", "how", "victory", "info-modal"];
  function closeCards() { for (const id of CARD_MODALS) { const el = $(id); if (el) el.classList.remove("show"); } }
  function setScreen(s) {
    state = s;
    $("home").classList.toggle("show", s === "home");
    $("top").style.display = (s === "play") ? "flex" : "none";
    $("dock").style.display = (s === "play") ? "block" : "none";
    $("btn-menu").style.display = (s === "play") ? "block" : "none";
    $("btn-metrics").style.display = (s === "play") ? "block" : "none";
    $("btn-ascend").style.display = (s === "play") ? "flex" : "none";
    if (s === "play") syncAutoBtn();
    if (s === "home") { $("home-gal").textContent = S.peakGalaxy; }
  }

  /* ----------------------------- input --------------------------- */
  // screen → WORLD coords (inverse of the center-locked camera), plus raw screen for pinch
  function ptr(e) { const r = canvas.getBoundingClientRect(), s = e.touches ? e.touches[0] : e, sx = s.clientX - r.left, sy = s.clientY - r.top; return { x: (sx - SW / 2) / camZoom + W / 2, y: (sy - (VIEW_CY || SH / 2)) / camZoom + H / 2, sx, sy }; }
  function unitAt(x, y) { const n = S.units.length; for (let i = 0; i < n; i++) { const p = unitPos(i, n); if ((p.x - x) ** 2 + (p.y - y) ** 2 <= 24 * 24) return i; } return -1; }
  const gptrs = new Map(); let pinchD0 = 0;
  canvas.addEventListener("pointerdown", e => {
    if (state !== "play") return;
    const p = ptr(e); gptrs.set(e.pointerId, { sx: p.sx, sy: p.sy });
    if (gptrs.size >= 2) { drawing = false; const a = [...gptrs.values()]; pinchD0 = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy); return; }   // two fingers = zoom, not draw
    const ui = unitAt(p.x, p.y);
    if (ui >= 0) { openSkillTree(S.units[ui].type); return; }
    collectAt(p.x, p.y); drawing = true; lastDraw = p; brushAt(p.x, p.y);
  });
  canvas.addEventListener("pointermove", e => {
    if (state !== "play") return;
    if (gptrs.has(e.pointerId)) { const q = ptr(e); gptrs.set(e.pointerId, { sx: q.sx, sy: q.sy }); }
    if (gptrs.size >= 2) { const a = [...gptrs.values()], d = Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy); if (pinchD0) camZoom = clamp(camZoom * d / pinchD0, camMin, 1.15); pinchD0 = d; return; }   // pinch to zoom the playfield
    if (!drawing) return;
    const p = ptr(e), dx = p.x - lastDraw.x, dy = p.y - lastDraw.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / 14));
    for (let i = 1; i <= steps; i++) { const bx = lastDraw.x + dx * i / steps, by = lastDraw.y + dy * i / steps; brushAt(bx, by); collectAt(bx, by); }
    lastDraw = p;
  });
  const endDraw = e => { if (e && e.pointerId !== undefined) gptrs.delete(e.pointerId); if (gptrs.size < 2) pinchD0 = 0; drawing = false; };
  canvas.addEventListener("pointerup", endDraw); canvas.addEventListener("pointercancel", endDraw); canvas.addEventListener("pointerleave", endDraw);
  canvas.addEventListener("wheel", e => { if (state !== "play") return; e.preventDefault(); camZoom = clamp(camZoom * (1 - e.deltaY * 0.0012), camMin, 1.15); }, { passive: false });

  /* ----------------------------- wiring -------------------------- */
  // v18.49: the badge is parented to the .tslot WRAPPER, never to the button — Chromium's UA
  // stylesheet forces overflow:hidden on <button> and ignores an author overflow:visible, so a badge
  // inside one is always clipped to its border-radius.
  for (const t of document.querySelectorAll(".tab[data-tab]")) { tabBtns[t.dataset.tab] = t; const bd = document.createElement("span"); bd.className = "t-badge"; (t.closest(".tslot") || t).appendChild(bd); t._badge = bd; t.onclick = () => { activeTab = t.dataset.tab; for (const k in tabBtns) tabBtns[k].classList.toggle("sel", tabBtns[k] === t); Audio_click(); renderList(); }; }
  const syncBuyMode = () => { const b = $("buymode"); if (!b || !S) return; b.style.display = ""; b.textContent = "BUY ×" + BUY_AMTS[buyIdx]; };   // v16.5: standard idle QoL for every player (was sandbox-only)
  if ($("buymode")) $("buymode").onclick = () => { buyIdx = (buyIdx + 1) % BUY_AMTS.length; Audio_click(); syncBuyMode(); renderList(); };
  $("ab-frenzy").onclick = () => useAbility("frenzy"); $("ab-dotrain").onclick = () => useAbility("dotrain"); $("ab-blackhole").onclick = () => useAbility("blackhole");
  for (const i of document.querySelectorAll(".ab-i")) i.onclick = e => { e.stopPropagation(); const k = i.dataset.info; showInfo({ frenzy: "Frenzy", dotrain: "Dot Rain", blackhole: "Black Hole" }[k], k); };
  $("info-close").onclick = $("info-back").onclick = () => $("info-modal").classList.remove("show");
  // v18.40: one button, two jobs, decided by whether the world is yours yet. Full bar and still
  // contested → it calls the keeper out. Conquered → it launches. Never both, never a surprise.
  $("btn-travel").onclick = () => { if (S.travel) return; if (barFull()) { summonWarden(); return; } travel(); };   // v17.29: in warp the button just waits — pay-to-skip removed (it's a 7s cinematic)
  if ($("fx-close")) $("fx-close").onclick = () => $("fxpage").classList.remove("show");
  $("galaxy-open").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); syncAutoBtn(); }; $("gm-close").onclick = () => { $("galaxy-map").classList.remove("show"); GMap.hide(); };
  $("st-close").onclick = closeSkillTree; $("st-sell").onclick = sellOne;
  { const pd = $("st-pick-done"); if (pd) pd.onclick = () => { STree.pick = false; save(); closeSkillTree(); openAuto(S.galaxy); }; }   // ✓ DONE: back to the Auto-Buy panel with the order stored
  $("st-upgrade").onclick = () => {
    const type = STree.type, node = STree.selNode(); if (!node || !nodeAllocatable(type, node)) return;
    allocNode(type, node);
    // keep showing this node (now allocated) so the panel updates; if it leads
    // onward to a single newly-reachable node, hop the selection there.
    const G = buildTree(type), onward = (G.adj[node.id] || []).map(a => G.map[a]).filter(m => nodeAllocatable(type, m));
    showNodeInfo(onward.length === 1 ? onward[0] : node);
  };
  if ($("st-max")) $("st-max").onclick = () => { allocAll(STree.type); showNodeInfo(STree.selNode()); };
  $("gm-reset").onclick = () => GMap.reset(); $("st-reset").onclick = () => STree.reset();
  // v18.20 star-map quick nav — hop planets, jump systems, snap to your world, tap the name for the card
  { const nv = (id, fn) => { const b = $(id); if (b) b.onclick = () => { Audio_click(); fn(); }; };
    nv("gm-prev", () => GMap.focusPlanet((GMap.navG || S.galaxy) - 1));
    nv("gm-next", () => GMap.focusPlanet((GMap.navG || S.galaxy) + 1));
    nv("gm-you", () => GMap.focusPlanet(S.galaxy));
    nv("gm-cur", () => { const g = GMap.navG || S.galaxy; GMap.focusPlanet(g); showGalaxyInfo(g); });
    for (let i = 0; i < 3; i++) { const si = i; nv("gm-sys" + i, () => GMap.focusSys(si)); } }
  $("st-auto").onclick = () => { STree.pick = !STree.pick; };   // toggle node-picking for the bound Auto-Buy step
  $("btn-metrics").onclick = () => { closeCards(); buildMetrics(); $("metrics").classList.add("show"); };
  $("metrics-close").onclick = $("metrics-back").onclick = () => $("metrics").classList.remove("show");
  $("btn-ascend").onclick = openAscend;
  // v18.42 (owner: "make sure I can access whenever I want"): the ◈ pill only exists on the play screen,
  // so Ascension was unreachable from the home screen and the star map. It now has its own door on home.
  if ($("home-ascend")) $("home-ascend").onclick = () => { vibe(10); openAscend(); };
  $("ascend-close").onclick = $("ascend-back").onclick = () => $("ascend").classList.remove("show");
  $("btn-auto").onclick = $("gm-auto").onclick = () => openAuto(S.galaxy);   // dock / map-bar → the planet you're ON
  if (!AUTOBUY_ON) { ["btn-auto", "gm-auto"].forEach(id => { const b = $(id); if (b) b.style.display = "none"; }); }   // v18.4: Auto-Buy stashed — buttons hidden, system dormant, plans preserved
  $("auto-close").onclick = $("auto-back").onclick = () => $("auto-modal").classList.remove("show");
  $("dock-toggle").onclick = () => { const d = $("dock"); const min = d.classList.toggle("min"); $("dock-toggle").textContent = min ? "▴ Menu" : "▾ Minimise"; };
  // ── SETTINGS menu (data-driven; opts persist in META.opts) ──
  const OPT_DEFS = [
    { k: "sound", t: "toggle", lbl: iconMarkup("sound") + "Sound effects", sub: "warp & UI audio" },
    { k: "haptics", t: "toggle", lbl: iconMarkup("vibe") + "Vibration", sub: "haptic feedback (mobile)" },
    { k: "shake", t: "toggle", lbl: iconMarkup("shake") + "Screen shake" },
    { k: "flash", t: "toggle", lbl: iconMarkup("bolt") + "Screen flashes", sub: "reduce for photosensitivity" },
    { k: "fx", t: "seg", lbl: iconMarkup("spark") + "Particle effects", sub: "lower to boost FPS on older phones", opts: [["full", "Full"], ["low", "Low"], ["off", "Off"]] },
    { k: "perf", t: "toggle", lbl: iconMarkup("gear") + "Performance mode", sub: "simplify dots on a busy field to save FPS (off = full detail)" },
    { k: "notation", t: "seg", lbl: iconMarkup("hash") + "Number format", sub: "how huge numbers are shown", opts: [["short", "1.2M"], ["sci", "1.2e6"]] },
  ];
  function refreshNums() { try { syncHUD(); } catch (e) {} try { renderList(); } catch (e) {} }
  function renderSettings() {
    const box = $("set-list"); if (!box) return; box.innerHTML = "";
    OPT_DEFS.forEach(d => {
      const row = document.createElement("div"); row.className = "set-row";
      const lab = document.createElement("div"); lab.className = "set-lbl";
      lab.innerHTML = "<b>" + d.lbl + "</b>" + (d.sub ? "<span>" + d.sub + "</span>" : "");
      const ctrl = document.createElement("div"); ctrl.className = "set-ctrl";
      if (d.t === "toggle") {
        const sw = document.createElement("button"); sw.className = "sw" + (opt(d.k) ? " on" : ""); sw.innerHTML = '<span class="knob"></span>';
        sw.onclick = () => { META.opts[d.k] = !opt(d.k); save(); renderSettings(); vibe(10); };
        ctrl.appendChild(sw);
      } else {
        const seg = document.createElement("div"); seg.className = "seg";
        d.opts.forEach(([val, txt]) => { const b = document.createElement("button"); b.textContent = txt; if (opt(d.k) === val) b.className = "on";
          b.onclick = () => { META.opts[d.k] = val; save(); renderSettings(); refreshNums(); vibe(10); }; seg.appendChild(b); });
        ctrl.appendChild(seg);
      }
      row.appendChild(lab); row.appendChild(ctrl); box.appendChild(row);
    });
    // ---- SAVE row — export/import codes (cross-device transfer without an account) ----
    const srow = document.createElement("div"); srow.className = "set-row";
    const slab = document.createElement("div"); slab.className = "set-lbl";
    slab.innerHTML = "<b>Save transfer</b><span>Move your progress between devices with a save code</span>";
    const sctrl = document.createElement("div"); sctrl.className = "set-ctrl";
    const bx = document.createElement("button"); bx.className = "seg-btn save-io"; bx.textContent = "EXPORT";
    bx.onclick = () => { vibe(10); const code = exportSave(); if (!code) return;
      let copied = false; try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code); copied = true; } } catch (e) {}
      showInfoText("Your save code", (copied ? "<b>Copied to clipboard.</b> " : "") + "Paste it into Settings → Import on any device (web, PC, Android, iOS) to continue there:<br><br><textarea readonly rows='5' style='width:100%;background:#000;color:#cfcfcf;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px;font:11px monospace' onclick='this.select()'>" + code + "</textarea>"); };
    const bi = document.createElement("button"); bi.className = "seg-btn save-io"; bi.textContent = "IMPORT";
    bi.onclick = () => { vibe(10); const code = prompt("Paste your save code (starts with IDS1.) — this OVERWRITES the save on this device:"); if (code == null || !String(code).trim()) return;
      const err = importSave(code); if (err) alert(err); };
    sctrl.appendChild(bx); sctrl.appendChild(bi);
    srow.appendChild(slab); srow.appendChild(sctrl); box.appendChild(srow);
    // ---- UPDATE row (v17.3, owner ask) — one tap to pull the latest build on the web version ----
    const urow = document.createElement("div"); urow.className = "set-row";
    const ulab = document.createElement("div"); ulab.className = "set-lbl";
    ulab.innerHTML = "<b>Game update</b><span>You're on " + VERSION + " · checks the server and reloads into the newest build</span>";
    const uctrl = document.createElement("div"); uctrl.className = "set-ctrl";
    const ub = document.createElement("button"); ub.className = "seg-btn upd-now"; ub.textContent = "⬆ UPDATE NOW";
    ub.onclick = () => { vibe(10); ub.disabled = true; ub.textContent = "CHECKING…";
      checkForUpdate(true, res => {
        if (res && res.indexOf("newer:") === 0) { ub.textContent = "⬆ v" + res.slice(6) + " — UPDATING…"; setTimeout(() => updApply(res.slice(6)), 350); return; }
        ub.textContent = res === "current" ? "✓ UP TO DATE" : res === "offline" ? "OFFLINE BUILD" : "✗ CHECK FAILED — RETRY";
        setTimeout(() => { ub.disabled = false; ub.textContent = "⬆ UPDATE NOW"; }, 2600);
      }); };
    uctrl.appendChild(ub);
    urow.appendChild(ulab); urow.appendChild(uctrl); box.appendChild(urow);
  }
  function openSettings() { closeCards(); renderSettings(); $("settings").classList.add("show"); }
  $("btn-menu").onclick = () => { closeCards(); $("menu").classList.add("show"); };
  $("menu-close").onclick = () => $("menu").classList.remove("show");
  $("menu-resume").onclick = () => $("menu").classList.remove("show");
  $("menu-home").onclick = () => { save(); $("menu").classList.remove("show"); setScreen("home"); };   // back to the home screen (progress saved)
  $("menu-reset").onclick = () => { if (confirm("Erase ALL progress?")) wipeSave(); };
  $("menu-settings").onclick = () => { $("menu").classList.remove("show"); openSettings(); };
  $("home-settings").onclick = () => openSettings();
  $("set-close").onclick = $("set-back").onclick = () => $("settings").classList.remove("show");
  $("set-how").onclick = () => $("how").classList.add("show");
  // ---- FIRST-RUN COACH MARKS: a guided walkthrough of the whole loop, shown once on a fresh save ----
  const TUT_STEPS = [
    { t: "Welcome, commander", x: "Your goal: conquer all <b>18 worlds</b> of the cluster. Your defenders auto-fire at the dots, and <b>killing dots is your entire economy</b> — let's run through how it all works." },
    { sel: "#game", t: "Blast the field", x: "<b>Drag across the field</b> to fire a sweep yourself — go on, try it now, then tap Next. Active play is the fast path; dots are tanky, and the more you kill the more cash they drop." },
    { sel: '#tabs [data-tab="def"]', t: "Defenders", x: "Defenders auto-fire on their own. Buy more and switch classes in the <b>DEFENCE</b> tab — each class has a niche: <b>anti-swarm</b> (Mortar, Laser) vs <b>anti-armor</b> (Plasma, Railgun, Nova)." },
    { sel: "#up-list", t: "Skill trees", x: "Tap a defender's <b>⬆ Tree</b> to open its skill web — try it now: <b>Damage, Fire Rate, Range</b>, and <b>Mind</b> (smart targeting, no wasted shots). ✦ <b>Keystones</b> add multishot plus a weapon special. Close it and tap Next when ready." },
    { sel: '#tabs [data-tab="drone"]', t: "Collectors", x: "Killed dots drop <b>cash orbs</b> — collectors gather them. Buy & upgrade them in the <b>COLLECTORS</b> tab, or your loot expires uncollected." },
    { sel: '#tabs [data-tab="eco"]', t: "Economy", x: "The <b>ECONOMY</b> tab boosts cash value, spawn rate, your cash ceiling, and luck — the backbone of your income." },
    { sel: "#abilities", t: "Abilities", x: "Tap an ability for a burst: <b>Frenzy</b> (fire rate), <b>Dot Rain</b> (flood the field), or <b>Black Hole</b> (vacuum). They run on cooldowns." },
    { sel: "#galaxy-open", t: "Conquer & travel", x: "Fill <b>this bar</b> to conquer the planet and unlock <b>Travel</b> — and your whole army travels WITH you; nothing restarts. Tap the bar for the <b>star map</b> — three solar systems, and every planet's native race has a <b>weakness</b> shown there." },
    { sel: "#btn-ascend", t: "Ascension", x: "This counter is your <b>pending ◈ cores</b> — every conquered planet charges it (deeper worlds pay exponentially more). When the next conquer bar becomes a <b>WALL</b>, ascend: the run resets, the cores bank, and the permanent <b>Engine (+25% ALL income per level)</b> makes the next campaign melt everything you just fought through. Ascension is the game's ONE reset — everything else you build is yours for the whole run." },
    { t: "Go conquer", x: "That's the loop: <b>kill dots → gather cash → upgrade → fill the bar → travel</b>. Take all 18 worlds. Good luck, commander!" },
  ];
  const Tut = {
    i: 0,
    start(force) { if (!force && META.tutorialDone) return; this.i = 0; $("tutorial").classList.add("show"); this.render(); },
    render() {
      const s = TUT_STEPS[this.i], wrap = $("tutorial"), spot = $("tut-spot"), card = $("tut-card");
      $("tut-step").textContent = "STEP " + (this.i + 1) + " / " + TUT_STEPS.length;
      $("tut-title").textContent = s.t; $("tut-text").innerHTML = s.x;
      $("tut-next").textContent = this.i >= TUT_STEPS.length - 1 ? "Got it ✓" : "Next ▸";
      const el = s.sel ? document.querySelector(s.sel) : null, r = el && el.getBoundingClientRect();
      if (r && r.width) { wrap.classList.remove("nospot"); const pad = 6;
        spot.style.left = (r.left - pad) + "px"; spot.style.top = (r.top - pad) + "px"; spot.style.width = (r.width + pad * 2) + "px"; spot.style.height = (r.height + pad * 2) + "px";
        card.style.transform = "translateX(-50%)";
        if (r.top + r.height / 2 < innerHeight / 2) { card.style.top = "auto"; card.style.bottom = "20px"; } else { card.style.top = "20px"; card.style.bottom = "auto"; }
      } else { wrap.classList.add("nospot"); }   // no target → centered card on a dim backdrop
    },
    next() { this.i++; if (this.i >= TUT_STEPS.length) this.finish(); else this.render(); },
    finish() { $("tutorial").classList.remove("show"); META.tutorialDone = true; save(); },
  };
  $("tut-next").onclick = () => Tut.next();
  $("tut-skip").onclick = () => Tut.finish();
  $("set-tutorial").onclick = () => { $("settings").classList.remove("show"); if (state !== "play") { renderList(); setScreen("play"); } setTimeout(() => Tut.start(true), 350); };
  $("welcome-ok").onclick = () => $("welcome").classList.remove("show");
  if ($("cq-ok")) $("cq-ok").onclick = () => $("conquest").classList.remove("show");
  if ($("victory-ok")) $("victory-ok").onclick = () => $("victory").classList.remove("show");
  if ($("victory-ascend")) $("victory-ascend").onclick = () => openAscend();   // openAscend's closeCards dismisses the victory card
  // ---- KEYBOARD (v16.5): Esc closes the topmost overlay (or pauses), 1/2/3 fire abilities. Desktop only
  // by nature — phones never see these events, so nothing mobile changes.
  document.addEventListener("keydown", e => {
    const tgt = e.target; if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;   // never steal keys from the CODES box
    const vis = id => { const el = $(id); return !!el && el.classList.contains("show"); };
    if (e.key === "Escape") {
      if (vis("info-modal")) $("info-modal").classList.remove("show");
      else if (vis("skilltree")) closeSkillTree();
      else if (vis("galaxy-map")) { $("galaxy-map").classList.remove("show"); GMap.hide(); }
      else if (vis("welcome")) $("welcome-ok").click();
      else if (vis("conquest")) $("cq-ok").click();
      else if (vis("auto-modal")) $("auto-modal").classList.remove("show");
      else if (vis("how")) $("how").classList.remove("show");
      else if (vis("settings")) $("settings").classList.remove("show");
      else if (vis("metrics")) $("metrics").classList.remove("show");
      else if (vis("ascend")) $("ascend").classList.remove("show");
      else if (vis("victory")) $("victory").classList.remove("show");
      else if (vis("menu")) $("menu").classList.remove("show");
      else if (Wheel.state() === "done") Wheel.hide();
      else if (state === "play") $("menu").classList.add("show");   // nothing open → Esc = pause
      e.preventDefault();
    } else if ((e.key === "1" || e.key === "2" || e.key === "3") && state === "play" && !document.querySelector(".modal.show")) {
      useAbility(["frenzy", "dotrain", "blackhole"][+e.key - 1]);
    }
  });
  $("home-play").onclick = () => { renderList(); setScreen("play"); if (!META.tutorialDone) setTimeout(() => Tut.start(), 550); };   // first-run coach marks once the play UI is laid out
  $("home-galaxies").onclick = () => { $("galaxy-map").classList.add("show"); GMap.show(); };
  $("home-how").onclick = () => $("how").classList.add("show");
  $("how-close").onclick = $("how-back").onclick = () => $("how").classList.remove("show");
  $("home-reset").onclick = () => { if (confirm("Erase ALL progress?")) wipeSave(); };
  // CODES box — "test" toggles FREE SANDBOX mode: all planets jumpable, every
  // defender/collector/upgrade unlocked and FREE to buy (you click & test yourself).
  function applyCode() {
    const raw = ($("code-input").value || "").trim(), msg = $("code-msg");
    if (raw.startsWith(SAVE_TAG)) {   // a pasted SAVE CODE (case-sensitive — check before lowercasing); works everywhere incl. wraps without window.prompt
      if (!confirm("Import this save code? It OVERWRITES the save on this device.")) return;
      const err = importSave(raw);
      if (err) { msg.textContent = "✗ " + err; msg.style.color = "var(--warn)"; }
      return;
    }
    const v = raw.toLowerCase();
    if (v === "test") { const on = unlockAll(); msg.textContent = on ? "✓ FREE MODE ON" : "free mode off"; msg.style.color = "#fff"; $("code-input").value = ""; $("home-gal").textContent = S.peakGalaxy; }
    else { msg.textContent = v ? "✗ invalid code" : ""; msg.style.color = "var(--warn)"; }
  }
  if ($("code-go")) $("code-go").onclick = applyCode;
  if ($("code-input")) $("code-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } });

  /* ----------------------------- loop / boot --------------------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); SW = canvas.clientWidth; SH = canvas.clientHeight;
    FIELD_COMP = (document.body && document.body.classList && document.body.classList.contains("pc")) ? clamp(Math.sqrt((SW * SH) / (460 * 830)), 1, 2.2) : 1;   // PC shell only (detected off <body class="pc"> so this line is identical on every branch); ~2.07 at 1920x1080 with the console open
    canvas.width = SW * DPR | 0; canvas.height = SH * DPR | 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = SW * WORLD_SCALE; H = SH * WORLD_SCALE; camFit = Math.min(SW / W, SH / H);   // camFit = NORMAL zoom (world box exactly fills the screen)
    fitWorld();                                  // the world is the screen: a real resize is the only thing that changes it
    camZoom = camZoom ? clamp(camZoom, camMin, 1.15) : camFit;                       // normal zoom sits inside the planet; pull back to camMin to see all of it
    for (const dr of drones) worldClamp(dr, 12);
    if (GMap.open) GMap.resize();
    if ($("skilltree").classList.contains("show")) STree.resize();
  }
  window.addEventListener("resize", resize);
  // The dock's height is not stable at the moment play opens — the upgrade rows are rendered after,
  // the settlement panel swaps in on settled worlds, and Minimise collapses it. Any of those changes
  let last = 0, saveAcc = 0, errAcc = 0, errShown = 0;
  // A thrown exception anywhere in the frame must NEVER kill the game: before v16.5 an uncaught error here
  // ended the rAF chain — everything (field, income, conquest, even autosave) froze silently until a reload.
  // Now the frame body is guarded, rAF ALWAYS re-arms, and the player gets a brief toast instead of a dead screen.
  function frameErr(e) {
    errAcc++; if (errAcc <= 3 || errAcc % 300 === 0) console.error("[loop]", e);   // log the first few + a heartbeat, never spam every frame
    const now2 = performance.now();
    if (now2 - errShown > 4000) { errShown = now2;
      let t = $("err-toast"); if (!t) { t = document.createElement("div"); t.id = "err-toast"; document.body.appendChild(t); }
      t.textContent = "⚠ something glitched — recovered (progress is safe)"; t.classList.add("show");
      try { Audio_err(); } catch (e2) {}
      clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 3200); }
  }
  function loop(now) {
    try {
      let dt = (now - last) / 1000 || 0; last = now; if (dt > 0.05) dt = 0.05; update(dt); render(); syncHUD(); if (GMap.open) GMap.render(dt); if ($("skilltree").classList.contains("show")) { STree.render(dt); refreshTreeAfford(); const wt = $("sw-tot"), wr = $("sw-rate"); if (wt) wt.textContent = fmt(S.cash); if (wr) wr.textContent = "+" + fmt(Math.max(0, cps)) + "/s"; }   // live wallet in the tree: total climbs, plus $/s — and the node panel's ALLOCATE lights the moment you can afford it
      if (veilT > 0) { veilT = Math.max(0, veilT - dt); setVeil(135 * (1 - veilT / VEIL_FADE)); }   // iris the black veil open over the base after landing
      if (landT > 0) { landT = Math.max(0, landT - dt); camZoom += (camFit - camZoom) * Math.min(1, dt * 3.5); if (landT === 0) { camZoom = camFit; const root = $("root"); if (root) root.classList.remove("cinematic"); } }   // camera pulls back to the base, then letterbox retracts
      saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; save(); }
    } catch (e) { frameErr(e); }
    requestAnimationFrame(loop);   // OUTSIDE the guard — the heartbeat survives anything a frame throws
  }

  if ($("version")) $("version").textContent = VERSION;
  hydrateIcons(document);   // swap all static <i data-ico> placeholders for the bespoke SVG glyphs
  load(); resize(); syncCollectors(); renderList(); GMap.init(); STree.init(); setScreen("home"); syncBuyMode();
  if (S._welcome) { const w = S._welcome; S._welcome = null; Cards.push("welcome", () => showWelcome(w)); }   // v18.34: through the same door as every other card — a conquest that completes in the first frames now waits its turn instead of racing this
  window.addEventListener("beforeunload", save);
  requestAnimationFrame(loop);

  // v18.34: `earn` is how the headless flow battery (CONTRIBUTING §5 — conquer → warden → build → launch)
  // completes a conquer bar in one call; nothing else can move curEarned from outside, and a bar that takes
  // real hours cannot be driven any other way. No new exposure — __IDS already hands out the live S object.
  if (typeof window !== "undefined") window.__IDS = { earn: v => { curEarned += (+v || 0); }, curEarned: () => curEarned, conquestCardPending: () => conqCardT > 0, mineBuildP, mineRigOn, coreFxOn: () => !!coreFx, coreFxT: () => coreFx ? coreFx.t : -1, camFitV: () => camFit, camMinV: () => camMin, setZoom: z => { camZoom = z; }, awardCores, queueCoreFx, S: () => S, META: () => META, derived: () => derived, dots: () => dots, orbs: () => orbs, parts: () => parts, shake: () => shake, drones: () => drones, units: () => S.units, collectors: () => S.collectors, uDmg, uRate, cSpeed, cReach, cPull, cSuction: cReach, cCollect: cReach, cYield, brushAt, collectAt, useAbility, travel, fmt, buyUnit, buyUp: id => buyUpgrade(UP[id]), upCost: id => upCost(UP[id]), buildTree, allocNode, nodeAllocatable, nodeAllocated, nodeLabel, nodeCost, treeDepths, classStats: t => classStats(t), unitPos, openSkillTree, showNodeInfo, showInfo, sellOne, showGalaxyInfo, recompute, setScreen, syncHUD, combo: () => comboMul, summonWarden, wardenOn: () => wardenOn, worldCX: wCX, worldCY: wCY, worldHW: wHW, worldHH: wHH, viewHW, viewHH, perim, camMin: () => camMin, viewCY: () => VIEW_CY, worldRect: () => ({ cx: wCX(), cy: wCY(), hw: wHW(), hh: wHH(), vw: viewHW(), vh: viewHH() }),  camZoom: () => camZoom, worldW: () => W, worldH: () => H, abil: () => abil, travelCost, galSpawnMul, galCap, state: () => state, GMap, STree, isCol, buyAsc, openAscend, ascend, pendingCores, coreVal, ascLv, ASC_LINES, exportSave, importSave, checkForUpdate, Wheel, Sfx, sfx: { pop: Audio_pop, collect: Audio_collect, zap: Audio_zap, saber: Audio_saber, ability: Audio_ability, conquer: Audio_conquer, victory: Audio_victory, ascend: Audio_ascend, launch: Audio_launch, land: Audio_land, spinup: Audio_spinup, win: Audio_win, escape: Audio_escape, click: Audio_click, err: Audio_err, buy: Audio_buy, node: Audio_node, boss: Audio_boss, tick: Audio_tick } };   // Sfx + the whole sound layer exported for the offline audio-render harness (tools/ + tuning sessions)
  // read-only scaling hooks for the headless pacing/scaling simulator (tools/playthrough-sim.js) — no game logic, just exposes the real curves so the sim can never diverge from the shipped game
  if (typeof window !== "undefined") window.__SIM = {
    TOTAL_PLANETS, CONQ_STEP, SYS_JUMP, WITHIN_STEP, CUR_BASE, TOUGH_POW, BUY_MUL,
    eco, diff, enemyHpMul, conquerTarget, travelCost, startMul,
    unitBuyCost: t => unitBuyCost(t), upCost: id => upCost(UP[id]),
    DEF_TYPES, COL_TYPES, DEF_ORDER, COL_ORDER, UNIT_FACTOR, DEF_SCALE,
    SYSTEMS, PLANET_LOCAL: () => PLANET_LOCAL, PLANET_SYS: () => PLANET_SYS,
    valueMul: valueFromLv, spawnFromLv, capFromLv, luckFromLv, mileL, mileNext, MILE_LEG, MILE_SHARE, legacyLv, rungLv, ECO_STEP, ECO_FINE_FROM,   // v18.51: the GAME's curves — the sim carried its own copy of 1 + 0.13*lv and would have silently kept the old scale
    spawnVis, spawnOver, spawnKnee, SPAWN_PASS,   // real spawn curves (v14.4) so the audit can never diverge from the shipped game
    setCps: v => { cps = +v || 0; },              // test hook: set the live income/s the boss bounty floor reads (v14.7)
    setEarned: v => { curEarned = +v || 0; },     // test hook: drive the conquer bar so the wall coach can be audited (v16.2)
    spawnBoss, grantTreeNodes, dots: () => dots,
    mineRate, mineCost, buildMine, mineBuilt, mineRateTotal,   // v18.39: buildMine is reachable ONLY from the warden kill now; exported so the sims can still price a seam
    ASC_LINES, ASC_BY, coreVal, pendingCores, perkAgg, ascLv, buyAsc, ascend, ascCost, CORE_A, CORE_B, ASC_W0, ASC_R,
    ASC_HOP_H, wallEtaH, wallAhead, ascPreview, ecoLv, ECO_BASE,   // the ladder coach (v16.2): hop-point contract audited by ascension-sim --verify
    baseTarget, conquerHours, IDLE_FRAC, ACTIVE_REF, IDLE_PAYBACK_H, EMPIRE_RAMP, SPOILS_PAYOUT_H, spoilsRate,   // v18.43: the sims must price ⚑ spoils from the GAME's rate — they used to derive it as bgRate×20, which is 0 now that a conquered world pays no tribute
    Wheel, nodeCandidates,                        // Bounty Wheel test hooks (v15.0): build/apply/segs/state
    step: dt => update(dt),                       // v17.5: drive the REAL combat loop at simulated time — the Mind-sim's fast-forward (behavioral stats are invisible to formula sims)
    RACES, raceNiche, NICHE_HINT,
  };
})();
