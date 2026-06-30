// WEAPON BALANCE: per-class effective power, normalized to the enemies each class faces.
// Classes are era-tiered (later classes have huge base dmg for tougher worlds), so we measure
//   (1) DEBUT power: each class at ITS intro planet, full tree, vs that planet's dots — is it
//       a worthwhile, comparable addition when it arrives?
//   (2) NICHE split: anti-armor (×vsBig, single target) vs anti-swarm (×vsSwarm × multishot).
//   (3) COMMON-PLANET view at g14 to show the progression (later > earlier by design).
//   node tools/weapon-balance.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ return require('/home/user/ignore/node_modules/playwright'); } }
const { chromium } = requirePlaywright();
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await b.newPage({ viewport:{width:1000,height:800} });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname,'..','index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400); await p.click('#home-play').catch(()=>{}); await p.waitForTimeout(300);
  const data = await p.evaluate(() => {
    const D = window.__IDS, S = D.S(), SIM = window.__SIM;
    const eraValue = g => Math.max(2, Math.round(g * 1.2));        // era-appropriate Value level (grows as you progress)
    const fullTree = t => { S.classNodes[t] = {}; const G = D.buildTree(t), ids = Object.keys(G.map).filter(i=>i!=='start');
      let guard=0; while(guard++<9000){ let placed=false; for(const id of ids){ if(S.classNodes[t][id]) continue; if(D.nodeAllocatable(t,G.map[id])){ S.classNodes[t][id]=true; placed=true; } } if(!placed) break; } };
    const avgHP = (g,vlv) => 18 * SIM.enemyHpMul(g) * Math.pow(SIM.valueMul(vlv),1.3) * 1.3;
    function evalClass(t, g, vlv) {
      S.galaxy = g; S.peakGalaxy = 18; S.cash = 1e40; S.lv.value = vlv; fullTree(t); D.recompute();
      const cs = D.classStats(t), B = SIM.DEF_TYPES[t];
      const dmg = B.dmg * cs.dmg; let rate = B.rate * cs.rate; if (t==='mortar') rate = Math.min(2, rate);
      const crit = Math.min(0.85, cs.crit), cm = 2.2 + Math.max(0, cs.crit-0.85)*0.8, multi = Math.min(9, cs.multi);
      const rawDPS = dmg * rate * (1 + crit*(cm-1));               // per-projectile single-target DPS (dmg×rate×crit)
      const unit = SIM.unitBuyCost(t);
      return { dmg, rate:+rate.toFixed(2), crit:+(crit*100).toFixed(0), multi, splash: B.splash, vsBig: B.vsBig, vsSwarm: B.vsSwarm,
        rawDPS, antiBig: rawDPS*B.vsBig, antiSwarm: rawDPS*B.vsSwarm, unit, avgHP: avgHP(g,vlv) };
    }
    const out = {};
    for (const t of SIM.DEF_ORDER) {
      const g = SIM.DEF_TYPES[t].gal;
      out[t] = { gal: g, debut: evalClass(t, g, eraValue(g)), late: evalClass(t, 14, eraValue(14)) };
    }
    return out;
  });
  const ksAvg = e => e.rawDPS / e.avgHP;            // avg-dot kills/sec when this class debuts (era value)
  const perCost = e => e.rawDPS / e.unit;           // power per $ of a unit (cost-normalized)
  console.log('=== DEBUT POWER — each class at its intro planet, full tree, ERA-appropriate Value ===');
  console.log('  class    gal   avg-dot k/s   DPS-per-$unit   crit multi splash   niche(vsBig/vsSwarm)');
  for (const t in data) { const e = data[t].debut;
    console.log('  '+t.padEnd(8)+' '+String(data[t].gal).padStart(2)+'   '+ksAvg(e).toFixed(2).padStart(10)+'   '+perCost(e).toExponential(2).padStart(12)+'    '+String(e.crit).padStart(3)+'%  '+String(e.multi).padStart(2)+'   '+String(e.splash).padStart(3)+'     '+e.vsBig+' / '+e.vsSwarm); }
  const dAvg = Object.values(data).map(d=>ksAvg(d.debut)), dCost = Object.values(data).map(d=>perCost(d.debut));
  console.log('  --> debut avg-dot k/s spread: '+(Math.max(...dAvg)/Math.min(...dAvg)).toFixed(2)+'x   ·   DPS-per-$ spread: '+(Math.max(...dCost)/Math.min(...dCost)).toFixed(2)+'x   (1 = perfectly equal; <~3-4x = well balanced for an era-tiered roster)');
  console.log('\n=== NICHE IDENTITY — anti-armor vs anti-swarm effectiveness (per projectile, debut) ===');
  for (const t in data) { const e=data[t].debut; const big=e.antiBig/(e.avgHP*1.5), sw=e.antiSwarm/(e.avgHP*0.7);
    const lean = e.vsBig>e.vsSwarm ? 'ANTI-ARMOR' : e.vsSwarm>e.vsBig ? 'ANTI-SWARM' : 'NEUTRAL';
    console.log('  '+t.padEnd(8)+' '+lean.padEnd(10)+'  armor-dot k/s '+big.toFixed(2).padStart(8)+'   swarm-dot k/s '+sw.toFixed(2).padStart(8)+(e.splash?'  +splash AOE':'')+(e.multi>=6?'  +heavy multishot':'')); }
  console.log('\n=== COMMON-PLANET (galaxy 14, full trees) — progression check (later > earlier BY DESIGN) ===');
  for (const t in data) { const e=data[t].late; console.log('  '+t.padEnd(8)+' avg-dot k/s '+ksAvg(e).toFixed(3).padStart(10)+'   '+(ksAvg(e)<0.05?'outclassed at g14 (early-era unit, expected)':'still pulls weight late')); }
  console.log('\nERRORS:', errs.length?errs.join(' | '):'none');
  await b.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
