const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,runAutoList,validate,unitAllowedByDetachment,armyPoints};','a.js');const A=m.exports;
let leaders=0, attached=0, wl1=0, lists=0, left=[], allyUse=0, detBad=0;
for (const f of A.GAME_DATA.factions) for (const lim of [1000,2000,3000]) for (const arch of ['balanced','melee']) {
  A.state.factionId=f.id; A.state.armies[f.id]=[]; A.state.detachments[f.id]=[];
  const r=A.runAutoList({limit:lim,archetype:arch,source:'catalog',locked:[],seed:0}); if(!r.ok) continue; lists++;
  const L=A.army(); const dets=A.state.detachments[f.id];
  L.forEach(e=>{const u=A.unitDef(e.unitId); if(u.leads&&u.charType!=='support'){leaders++; if(e.attachedTo) attached++;} if(u.ally) allyUse++; if(!A.unitAllowedByDetachment(u,dets)) detBad++;});
  if (L.filter(e=>e.warlord).length===1) wl1++;
  left.push(lim-A.armyPoints());
}
left.sort((a,b)=>a-b);
console.log(`Listen ${lists} | genau 1 Kriegsherr: ${wl1}/${lists} | Anführer angeschlossen: ${attached}/${leaders} (${Math.round(attached/leaders*100)}%) | Detachment-Verstöße: ${detBad} | freigeschaltete Verbündete genutzt: ${allyUse} | Restpunkte median ${left[left.length>>1]}, max ${left[left.length-1]}, Anteil 0: ${left.filter(x=>x===0).length}/${left.length}`);
