const A=require('./harness.js');
let lists=0,paidEntries=0,paidAt=[],tierBad=0,over=0,errs=0,left=[];
for(const f of A.GAME_DATA.factions)for(const lim of [1000,2000])for(const arch of ['balanced','shooting','melee']){
  A.state.factionId=f.id;A.state.limit=lim;A.state.armies[f.id]=[];A.state.detachments[f.id]=[];
  const r=A.runAutoList({limit:lim,archetype:arch,source:'catalog',locked:[],seed:0});if(!r.ok)continue;lists++;
  const L=A.army();if(A.armyPoints()>lim)over++;left.push(lim-A.armyPoints());
  for(const e of L){const u=A.unitDef(e.unitId);const s=u.pointsCost[e.sizeIdx];if(!s||A.tierPoints(u,s.models)!==s.points)tierBad++;
    const g=A.breakdown(e).filter(x=>x.kind==='opt').reduce((a,x)=>a+x.points,0);if(g>0)paidEntries++;}
  if(A.validate().some(w=>w.lvl==='err'))errs++;
}
left.sort((a,b)=>a-b);
console.log(`Listen ${lists} | Einträge mit bezahltem Wargear ${paidEntries} | ungültige Staffeln ${tierBad} | über Limit ${over} | Regelfehler ${errs} | Rest Median ${left[left.length>>1]} max ${left[left.length-1]}`);
