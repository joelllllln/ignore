/* =====================================================================
   HIVE WORLDS — ui.js
   All DOM glue: menus, settings, pause, tech tree, the battle HUD, the
   defender palette and the per-defender skill-tree panel.
   ===================================================================== */
function $(id) { return document.getElementById(id); }
function setText(id, t) { const e = $(id); if (e) e.textContent = t; }
function setSpeedUI(v) { setText("speed-val", v.toFixed(1) + "×"); const s = $("speed"); if (s) s.value = v; }

const UI = {
  panelNodes: null,

  init() {
    // menu nav
    $("btn-play").onclick = () => { click(); const gi = clamp(progress.maxUnlocked, 0, PLANETS.length - 1); const P = PLANETS[gi]; MapScreen.enter("system", P.galaxy, P.system); setState("map"); };
    $("btn-map").onclick = () => { click(); MapScreen.enter("universe"); setState("map"); };
    $("btn-tech").onclick = () => { click(); this.buildTech(); setState("tech"); };
    $("btn-howto").onclick = () => { click(); setState("howto"); };
    $("btn-settings").onclick = () => { click(); setState("settings"); };
    $("btn-howto-back").onclick = () => { click(); setState("menu"); };
    $("tech-back").onclick = () => { click(); setState("menu"); };

    // settings
    $("set-sound").onchange = e => Audio2.setEnabled(e.target.checked);
    $("set-music").onchange = e => Audio2.setMusic(e.target.checked);
    $("set-reset").onclick = () => { if (confirm("Erase ALL conquest + tech progress?")) { progress = freshProgress(); saveProgress(); this.buildTech(); setState("menu"); } };
    $("set-back").onclick = () => { click(); setState(prevState === "pause" ? "pause" : "menu"); };

    // map
    $("map-menu").onclick = () => { click(); setState("menu"); };
    $("map-zoomout").onclick = () => MapScreen.zoomOut();

    // battle
    $("btn-to-map").onclick = () => { click(); MapScreen.enter("system", Battle.s.P.galaxy, Battle.s.P.system); setState("map"); };
    $("btn-pause").onclick = () => { click(); Battle.s.paused = true; setState("pause"); };
    $("tp-close").onclick = () => { click(); Battle.deselect(); };
    $("tp-sell").onclick = () => Battle.sellSelected();
    $("speed").oninput = e => { const v = parseFloat(e.target.value); setSpeedUI(v); Battle.setSpeed(v); };

    // pause
    $("pause-resume").onclick = () => { click(); Battle.s.paused = false; setState("battle"); };
    $("pause-settings").onclick = () => { click(); setState("settings"); };
    $("pause-retreat").onclick = () => { click(); MapScreen.enter("system", Battle.s.P.galaxy, Battle.s.P.system); setState("map"); };

    // clear
    $("clear-map").onclick = () => { click(); MapScreen.enter("system", Battle.s.P.galaxy, Battle.s.P.system); setState("map"); };
  },

  /* ----------------------------- palette ------------------------- */
  buildPalette() {
    const pal = $("palette"); pal.innerHTML = "";
    TOWER_ORDER.forEach(id => {
      const def = TOWER_TYPES[id];
      const b = document.createElement("button");
      b.className = "pal-btn"; b.dataset.type = id;
      b.innerHTML = `<canvas class="pal-ic" width="26" height="26"></canvas><span class="pal-n">${def.name}</span><span class="pal-c">${def.cost}◇</span>`;
      b.onclick = () => { Battle.s.buildType = id; Battle.deselect(); click(); };
      pal.appendChild(b);
      const ic = b.querySelector("canvas").getContext("2d");
      ic.fillStyle = def.color; ic.shadowColor = def.color; ic.shadowBlur = 6;
      ic.beginPath(); ic.arc(13, 13, 8, 0, TAU); ic.fill(); ic.shadowBlur = 0;
      ic.fillStyle = "#06121a"; ic.font = "bold 11px ui-monospace, monospace"; ic.textAlign = "center"; ic.textBaseline = "middle";
      ic.fillText(def.name[0], 13, 14);
    });
  },

  /* --------------------------- tower panel ----------------------- */
  showTowerPanel(t) { $("tower-panel").classList.remove("hidden"); this.refreshPanel(t); },
  hideTowerPanel() { this.panelNodes = null; $("tower-panel").classList.add("hidden"); },

  statsHTML(t) {
    return `<span><b>${Math.round(t.damage)}</b> dmg</span><span><b>${t.fireRate.toFixed(1)}</b>/s</span>` +
      `<span><b>${Math.round(t.range)}</b> rng</span><span><b>${Math.round(t.hp)}</b> hp</span>` +
      (t.crit ? `<span><b>${Math.round(t.crit * 100)}%</b> crit</span>` : "") +
      (t.splash ? `<span><b>${Math.round(t.splash)}</b> splash</span>` : "") +
      (t.chain ? `<span><b>${t.chain}</b> chain</span>` : "") +
      (t.slowDur ? `<span><b>${(100 - t.slowMul * 100) | 0}%</b> slow</span>` : "");
  },

  refreshPanel(tower) {
    const t = tower || Battle.s.selected; if (!t) return;
    const def = TOWER_TYPES[t.type];
    setText("tp-name", def.name + " Defender");
    $("tp-stats").innerHTML = this.statsHTML(t);
    const tg = $("tp-targets"); tg.innerHTML = "";
    PRIORITIES.forEach(p => {
      const b = document.createElement("button"); b.textContent = p.label; b.className = t.priority === p.id ? "active" : "";
      b.onclick = () => { t.priority = p.id; click(); this.refreshPanel(t); };
      tg.appendChild(b);
    });
    const tr = $("tp-tree"); tr.innerHTML = ""; this.panelNodes = [];
    def.tree.forEach(node => {
      const owned = !!t.unlocked[node.id], reqMet = node.req.every(r => t.unlocked[r]);
      const d = document.createElement("div");
      d.className = "tp-node" + (owned ? " owned" : reqMet ? "" : " locked");
      d.innerHTML = `<div class="n-info"><span class="n-name">${node.name}</span><span class="n-desc">${node.desc}</span></div>` +
        (owned ? `<span class="n-tag">✓</span>` : `<button>${node.cost}◇</button>`);
      if (!owned) { const btn = d.querySelector("button"); this.panelNodes.push({ node, btn }); btn.onclick = () => { if (Battle.buyNode(t, node)) this.refreshPanel(t); }; }
      tr.appendChild(d);
    });
  },

  updatePanelLive() {
    const t = Battle.s.selected; if (!t) return;
    $("tp-stats").innerHTML = this.statsHTML(t);
    if (this.panelNodes) for (const pn of this.panelNodes) {
      const reqMet = pn.node.req.every(r => t.unlocked[r]);
      pn.btn.disabled = !reqMet || Battle.s.energy < pn.node.cost;
    }
  },

  /* ----------------------------- tech tree ----------------------- */
  buildTech() {
    setText("tech-cores", "◆ " + (progress.cores || 0));
    setText("menu-cores", "◆ " + (progress.cores || 0) + " Cores");
    const grid = $("tech-grid"); grid.innerHTML = "";
    TECH.forEach(node => {
      const owned = progress.tech && progress.tech[node.id];
      const reqMet = node.req.every(r => progress.tech && progress.tech[r]);
      const afford = (progress.cores || 0) >= node.cost;
      const d = document.createElement("div");
      d.className = "tech-node" + (owned ? " owned" : reqMet ? "" : " locked");
      d.style.gridColumn = node.col + 1; d.style.gridRow = node.row + 1;
      d.innerHTML = `<span class="t-name">${node.name}</span><span class="t-desc">${node.desc}</span>` +
        (owned ? `<span class="t-tag">✓ owned</span>` : `<button ${(!reqMet || !afford) ? "disabled" : ""}>${node.cost} ◆</button>`);
      if (!owned) { const btn = d.querySelector("button"); if (btn) btn.onclick = () => {
        if (!reqMet || (progress.cores || 0) < node.cost || (progress.tech && progress.tech[node.id])) return;
        progress.cores -= node.cost; progress.tech = progress.tech || {}; progress.tech[node.id] = true; saveProgress(); Audio2.buy(); this.buildTech();
      }; }
      grid.appendChild(d);
    });
  },

  /* ------------------------------ HUD ---------------------------- */
  syncBattle(s) {
    setText("ui-energy", Math.floor(s.energy));
    setText("ui-hive", Math.min(s.killed, s.hiveTotal) + "/" + s.hiveTotal);
    setText("ui-eff", Math.round(s.efficiency * 100) + "%");
    $("ui-eff").style.color = s.efficiency > 0.6 ? PAL.sentinel : s.efficiency > 0.3 ? PAL.gold : PAL.warn;
    setText("ui-core", Math.round(s.coreHp / s.coreMax * 100) + "%");
    $("ui-core").style.color = s.coreHp / s.coreMax > 0.5 ? PAL.sentinel : s.coreHp / s.coreMax > 0.25 ? PAL.gold : PAL.warn;
    setText("ui-world-name", s.P.ref.name);
    setText("ui-planet", "Planet " + (s.gi + 1));
    const pct = Math.floor(s.completion);
    $("completion-fill").style.width = pct + "%"; setText("completion-pct", pct + "%");
    setText("ui-reward", "×" + s.speed.toFixed(1));
    // combo tag
    const ct = $("combo-tag");
    if (s.combo >= 3) { ct.textContent = s.combo + "× COMBO"; ct.style.opacity = clamp(s.comboT / 1.9, 0, 1); ct.style.transform = `translateX(-50%) scale(${1 + Math.min(s.combo, 15) * 0.03})`; }
    else ct.style.opacity = 0;
    // palette affordability
    for (const btn of document.querySelectorAll(".pal-btn")) {
      const id = btn.dataset.type;
      btn.classList.toggle("selected", s.buildType === id);
      btn.classList.toggle("poor", s.energy < TOWER_TYPES[id].cost);
    }
    if (s.selected) this.updatePanelLive();
  },
};

// global shims called by other modules
function syncBattleHUD(s) { UI.syncBattle(s); }
function click() { Audio2.click(); }

function showClear(gi, first) {
  const P = PLANETS[gi], last = gi + 1 >= PLANETS.length;
  setText("clear-title", last ? "GALAXY CONQUERED" : P.isSystemEnd ? "SYSTEM SECURED" : "PLANET CONQUERED");
  setText("clear-text", last ? "Every world has fallen. The Hive is broken across the stars."
    : P.ref.name + " is liberated. " + (P.isSystemEnd ? "The system is yours." : "The next world calls."));
  const cores = first ? ((1 + Math.floor(gi / 2)) + (P.isSystemEnd ? 2 : 0)) : 0;
  setText("clear-reward", first ? "◆ +" + cores + " Cores" : "Already conquered");
  const next = $("clear-next");
  next.style.display = last ? "none" : "block";
  next.textContent = "INVADE " + PLANETS[Math.min(PLANETS.length - 1, gi + 1)].ref.name.toUpperCase() + " ▶";
  next.onclick = () => { click(); if (!last) { MapScreen.enter("system", PLANETS[gi + 1].galaxy, PLANETS[gi + 1].system); startBattle(gi + 1); } };
  setState("clear");
}
