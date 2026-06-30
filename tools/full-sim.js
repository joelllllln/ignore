// FULL playthrough sim — accounts for EVERYTHING that moves the conquer clock:
//   • real per-planet DPS / income (drives the game via __SIM)
//   • the idle empire (treasury-only at IDLE_FRAC=0, so it doesn't feed the bar)
//   • GEMS earned (per-conquer reward + boss drops during active play) and SPENT on the
//     Ascension perk tree as the run progresses — the income perks then speed later planets.
// Reports per-planet time at 0/10/35/100% active WITH perks accumulating, the gem economy,
// and the perk speed-up vs a no-Ascension baseline.   node tools/full-sim.js
function requirePlaywright(){ try { return require('playwright'); } catch(e){ return require('/home/user/ignore/node_modules/playwright'); } }
const { chromium } = requirePlaywright();
const BOSS_PERIOD = 300;   // ~240s interval + ~60s alive, per boss, of ACTIVE play
const fmtT = s => { if(!isFinite(s))return '—'; const d=s/86400; if(d>=1)return d.toFixed(1)+'d'; const h=s/3600; if(h>=1)return h.toFixed(1)+'h'; const m=s/60; if(m>=1)return m.toFixed(0)+'m'; return Math.round(s)+'s'; };
(async () => {
  const b = await chromium.launch(); const errs=[]; const p = await b.newPage({ viewport:{width:1000,height:800} });
  p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=>{ if(m.type()==='error') errs.push('C:'+m.text()); });
  await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'), { waitUntil:'load' });
  await p.waitForTimeout(400); await p.click('#home-play').catch(()=>{}); await p.waitForTimeout(300);
  const data = await p.evaluate(() => {
    const D=window.__IDS, S=D.S(), SIM=window.__SIM; const VALUE_LV=18, SPAWN_LV=14;
    function killPassive(g){   // defenders auto-firing, no brushing (frac=0 baseline), same model as the other sims
      S.galaxy=g; S.peakGalaxy=Math.max(S.peakGalaxy,g); S.lv.value=VALUE_LV; S.lv.spawnRate=SPAWN_LV; S.lv.capacity=40; S.lv.luck=10;
      S.units=[]; S.collectors=[];
      for(const t of SIM.DEF_ORDER) if(SIM.DEF_TYPES[t].gal<=g) for(let i=0;i<SIM.DEF_TYPES[t].max;i++) S.units.push({type:t,cd:0});
      for(const t of SIM.COL_ORDER) if(SIM.COL_TYPES[t].gal<=g) for(let i=0;i<SIM.COL_TYPES[t].max;i++) S.collectors.push({type:t});
      for(const t of [...SIM.DEF_ORDER,...SIM.COL_ORDER]){ if((SIM.DEF_TYPES[t]||SIM.COL_TYPES[t]).gal>g) continue;
        S.classNodes[t]={}; const G=D.buildTree(t), ids=Object.keys(G.map).filter(i=>i!=='start'); const tgt=Math.floor(ids.length*0.7);
        let added=1,guard=0; while(added<tgt&&guard++<5000){ let pl=false; for(const id of ids){ if(S.classNodes[t][id])continue; if(D.nodeAllocatable(t,G.map[id])){ S.classNodes[t][id]=true; added++; pl=true; if(added>=tgt)break; } } if(!pl)break; } }
      D.recompute();
      let dps=0; for(const u of S.units) dps += D.uDmg(u)*SIM.DEF_TYPES[u.type].rate*D.derived().cls[u.type].rate;
      const hpMul=SIM.enemyHpMul(g), vMul=SIM.valueMul(VALUE_LV), avgHP=18*hpMul*Math.pow(vMul,1.3)*1.3;
      const spawnPerSec=0.9+2.0*SPAWN_LV, kps=Math.min(dps/avgHP, spawnPerSec*1.2);
      return kps * SIM.eco(g)*vMul;   // passive kill income $/s
    }
    const planets=[]; for(let g=1;g<=18;g++) planets.push({ g, killPassive:killPassive(g), baseTarget:SIM.baseTarget(g), gemBase:SIM.gemReward(g) });
    return { planets, ACTIVE_MAX:8.6, BOSS_GEM:SIM.BOSS_GEM_CHANCE, PERKS:SIM.PERKS };
  });

  // perk model: income perks (value/yield/spawn) multiply bar income; gem perk adds gems/conquer.
  const PERKS = data.PERKS;
  const tierOwned = (own,t) => PERKS.filter(p=>p.tier===t&&own[p.id]).length;
  const tierOpen  = (own,t) => t===1 || (t===2&&tierOwned(own,1)>=4) || (t===3&&tierOwned(own,2)>=4);
  function buyGreedy(own, gemsObj){   // balanced buyer: cheapest available perk first (line order within a tier)
    let bought=true;
    while(bought){ bought=false;
      for(const pk of PERKS){ if(own[pk.id]) continue; if(!tierOpen(own,pk.tier)) continue; if(gemsObj.g < pk.cost) continue;
        own[pk.id]=true; gemsObj.g-=pk.cost; bought=true; break; } }
  }
  const incomeMult = own => { let v=1; for(const pk of PERKS){ if(!own[pk.id]) continue; if(pk.key==='value'||pk.key==='yield'||pk.key==='spawn') v*=(1+pk.amt); } return v; };
  const gemBonus   = own => { let g=0; for(const pk of PERKS){ if(own[pk.id]&&pk.key==='gem') g+=pk.amt; } return g; };

  function sim(frac, useAscension) {
    const mult = 1 + frac*(data.ACTIVE_MAX-1);
    const own = {}; let gemsTotal=0; const gemsObj={g:0}; let bossGemsTot=0, conquerGemsTot=0;
    let total=0; const rows=[];
    for (const pl of data.planets) {
      const im = useAscension ? incomeMult(own) : 1;
      const fill = pl.killPassive * mult * im;
      const sec = fill>0 ? pl.baseTarget/fill : Infinity;
      total += sec;
      // gems earned this planet
      const conquerGems = pl.gemBase + (useAscension ? gemBonus(own) : 0);
      const activeSec = sec * frac;
      const bossGems = useAscension ? (activeSec/BOSS_PERIOD)*data.BOSS_GEM : 0;
      conquerGemsTot += conquerGems; bossGemsTot += bossGems; gemsTotal += conquerGems + bossGems;
      if (useAscension) { gemsObj.g += conquerGems + bossGems; buyGreedy(own, gemsObj); }
      rows.push({ ...pl, sec, im, ownedCount: Object.keys(own).filter(k=>own[k]).length });
    }
    return { frac, mult, rows, total, gemsTotal, bossGemsTot, conquerGemsTot, ownedCount: Object.keys(own).filter(k=>own[k]).length, gemsLeft: gemsObj.g };
  }

  const NAMES=["Vesta","Ember","Cinder","Hearth","Azure","Verdant","Cobalt","Mistral","Halcyon","Tempest","Umbra","Frost","Onyx","Wraith","Pyre","Abyss","Maw","Oblivion"];
  const LEVELS=[{l:'0% (pure idle)',f:0},{l:'10% active',f:0.10},{l:'35% active',f:0.35},{l:'100% active',f:1.0}];
  const treeCost = PERKS.reduce((a,p)=>a+p.cost,0);
  console.log('Ascension tree: '+PERKS.length+' perks, '+treeCost+' gems to fully buy.\n');
  for (const lv of LEVELS) {
    const A = sim(lv.f, true), B = sim(lv.f, false);
    console.log('══ '+lv.l+'  (income ×'+A.mult.toFixed(1)+') ══');
    console.log('  TOTAL: '+fmtT(A.total)+' WITH Ascension   ·   '+fmtT(B.total)+' without   ('+((B.total/A.total-1)*100).toFixed(0)+'% faster from perks)');
    console.log('  Gems earned: '+A.gemsTotal.toFixed(0)+' total = '+A.conquerGemsTot.toFixed(0)+' conquer + '+A.bossGemsTot.toFixed(0)+' boss drops  ->  bought '+A.ownedCount+'/'+PERKS.length+' perks ('+(A.gemsTotal>=treeCost?'TREE MAXED, +'+(A.gemsTotal-treeCost).toFixed(0)+' spare':Math.round(A.gemsTotal/treeCost*100)+'% of tree')+')');
    console.log('  per-planet (WITH perks):');
    let line='   ';
    A.rows.forEach((r,i)=>{ line += (NAMES[i].slice(0,4)+' '+fmtT(r.sec)).padEnd(13); if((i+1)%6===0){console.log(line);line='   ';} });
    if(line.trim())console.log(line);
    console.log('');
  }
  console.log('Note: boss gems assume one boss ~every '+BOSS_PERIOD+'s of ACTIVE play, 5% gem each — an estimate.');
  console.log(errs.length?'ERRORS: '+errs.join(' | '):'no errors');
  await b.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
