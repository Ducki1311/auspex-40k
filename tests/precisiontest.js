const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,runAutoList,validate,unitAllowedByDetachment,selectedDetachments,armyPoints,isBattleline,unitLimit};','a.js');const A=m.exports;
let lists=0, wl1=0, leaders=0, leadersAtt=0, leadersPossible=0, detBad=0, left=[], errs=0, blDet=0;
for (const f of A.GAME_DATA.factions) for (const lim of [1000,2000]) for (const [arch,src] of [['balanced','catalog'],['shooting','catalog'],['melee','catalog'],['control','catalog']]) {
  A.state.factionId=f.id; A.state.limit=lim; A.state.armies[f.id]=[]; A.state.detachments[f.id]=[];
  const r=A.runAutoList({limit:lim,archetype:arch,source:src,locked:[],seed:0}); if(!r.ok) continue; lists++;
  const L=A.army(), dets=A.selectedDetachments();
  if (L.filter(e=>e.warlord).length===1) wl1++; else console.log('WL',f.id,lim,arch,L.filter(e=>e.warlord).length,'chars',L.filter(e=>{const u=A.unitDef(e.unitId);return u.role==='character'||u.character}).length, L.length);
  for (const e of L) {
    const u=A.unitDef(e.unitId);
    if (!A.unitAllowedByDetachment(u,dets)) detBad++;
    if (Array.isArray(u.detBattleline) && dets.some(d=>u.detBattleline.includes(d)) && L.filter(x=>x.unitId===u.id).length>A.GAME_DATA&&0) blDet++;
    if (u.leads && (u.charType||'leader')==='leader') { leaders++; if (e.attachedTo) leadersAtt++; else if (L.some(t=>u.leads.includes(t.unitId) && !L.some(x=>x.attachedTo===t.uid && (A.unitDef(x.unitId).charType||'leader')==='leader'))) leadersPossible++; }
  }
  left.push(lim-A.armyPoints());if(process.env.V&&lim-A.armyPoints()>40)console.log("REST",lim-A.armyPoints(),A.state.factionId,lim,typeof arch!=="undefined"?arch:"");
  if (A.validate().some(w=>w.lvl==='err')) { errs++; if(errs<4) console.log('ERR',f.id,lim,arch,A.validate().filter(w=>w.lvl==='err').map(w=>w.msg)); }
}
left.sort((a,b)=>a-b);
console.log(`Listen ${lists} | genau 1 Kriegsherr: ${wl1}/${lists} | Anführer ${leaders}, angeschlossen ${leadersAtt}, unangeschlossen trotz freiem Trupp ${leadersPossible} | Detachment-Verstöße ${detBad} | Regelfehler ${errs}`);
console.log(`Restpunkte: Median ${left[left.length>>1]}, 90%-Quantil ${left[Math.floor(left.length*.9)]}, max ${left[left.length-1]}, exakt 0: ${left.filter(x=>x===0).length}/${left.length}`);
// Konsistenz: Anführer fahren mit ihrem Trupp; Kapazität inkl. Anführer
let inc=0, capBad=0;
for (const f of A.GAME_DATA.factions) for (const arch of ['balanced','melee']) {
  A.state.factionId=f.id; A.state.limit=2000; A.state.armies[f.id]=[]; A.state.detachments[f.id]=[];
  if (!A.runAutoList({limit:2000,archetype:arch,source:'catalog',locked:[],seed:0}).ok) continue;
  const L=A.army();
  L.filter(e=>e.attachedTo).forEach(e=>{ const t=L.find(x=>x.uid===e.attachedTo); if ((e.embarkedIn||null)!==(t?.embarkedIn||null)) inc++; });
  L.filter(e=>A.unitDef(e.unitId).role==='transport').forEach(t=>{ const tu=A.unitDef(t.unitId); if(!tu.transport) return; const n=L.filter(x=>x.embarkedIn===t.uid).reduce((s,x)=>s+A.unitDef(x.unitId).sizes[x.sizeIdx].models,0); if(n>tu.transport.cap) capBad++; });
}
console.log('Anführer nicht beim Trupp:',inc,'| Kapazität überschritten (Modelle, ohne Platzfaktor):',capBad);
