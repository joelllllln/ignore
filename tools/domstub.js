"use strict";
// ---------------------------------------------------------------------------
// tools/domstub.js — the headless DOM/canvas stub that lets js/game.js load in
// plain Node, for the two tools that need the SHIPPED constants rather than a
// browser: balance-check.js and ascension-sim.js --verify.
//
// WHY THIS FILE EXISTS (v18.70). The stub used to be copy-pasted into both
// tools, and it was missing pieces of the DOM that game.js legitimately uses.
// Every time a UI change touched a new API the sims crashed and the fix went
// into game.js as another defensive guard — document.querySelector (v18.64),
// element.children (v18.68), document.documentElement (v18.69), and
// style.setProperty (v18.70, when the economy rows started being built on every
// render instead of only when their tab was selected). Four guards in shipping
// game code, all paying for one incomplete fake.
//
// That is backwards. The harness is what is wrong, so the harness is what gets
// fixed: one stub, one place, complete enough that game.js can use the DOM the
// way any browser lets it. The guards already in game.js are harmless and stay
// (they cost nothing and they document the history), but nothing NEW should
// have to be added to game.js to keep these two tools running.
//
// It is deliberately dumb: every setter is a no-op, every getter returns
// something inert and correctly TYPED. It never simulates layout — these tools
// read numbers, not pixels. The Playwright tools are the ones that test the DOM.
// ---------------------------------------------------------------------------

// a canvas 2D context that answers to anything without throwing
function ctx() {
  const n = () => {};
  const g = { addColorStop: n };
  return new Proxy({}, {
    get(_, k) {
      if (String(k).indexOf("create") === 0) return () => g;
      if (k === "canvas") return { width: 800, height: 600 };
      return n;
    },
    set() { return true; },
  });
}

// a CSSStyleDeclaration-shaped bag: plain property assignment works AND the
// custom-property API works, which is how game.js publishes --mile and --nav-h
function style() {
  const props = {};
  return {
    setProperty(k, v) { props[k] = v == null ? "" : String(v); },
    removeProperty(k) { const v = props[k]; delete props[k]; return v; },
    getPropertyValue(k) { return props[k] || ""; },
  };
}

function el(id) {
  return {
    id, value: "1", textContent: "", style: style(), dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [],                 // element.children — an array-like, never undefined
    set innerHTML(v) {}, get innerHTML() { return ""; },
    appendChild(c) { return c; },
    removeChild(c) { return c; },
    closest() { return null; },
    querySelector() { return el("q"); },
    querySelectorAll() { return []; },
    getContext: () => ctx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, width: 800, height: 600 }),
    addEventListener() {}, removeEventListener() {},
    focus() {}, blur() {}, click() {},
  };
}

// Installs the whole fake environment onto the given global object and returns
// the element cache, so a caller can pre-seed or inspect a specific node.
function install(g) {
  g = g || global;
  const byId = {};
  g.document = {
    getElementById: i => byId[i] || (byId[i] = el(i)),
    querySelector: () => el("q"),
    querySelectorAll: () => [],
    createElement: () => el("c"),
    addEventListener() {}, removeEventListener() {},
    documentElement: el("html"),   // game.js publishes --nav-h onto this
    body: el("body"),
    hidden: false,
  };
  const cv = el("game"); cv.clientWidth = 800; cv.clientHeight = 600;
  byId["game"] = cv; byId["gmap"] = el("gmap"); byId["sttree"] = el("sttree");
  g.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = () => {};
  g.performance = { now: () => 0 };
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  g.confirm = () => true;
  g.location = { reload() {} };
  g.getComputedStyle = () => ({ getPropertyValue: () => "", display: "block", visibility: "visible", opacity: "1", zIndex: "0" });
  return byId;
}

module.exports = { install, el, ctx, style };
