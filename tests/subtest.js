const A=require('./harness.js');const F=A.GAME_DATA.factions;
// 1) Chapter Locking: Blood-Angels-Einheit in Space-Wolves-Liste einschleusen
const sw=F.find(f=>f.id==='space_wolves'), ba=F.find(f=>f.id==='blood_angels');
const baU=ba.units.find(u=>u.subFaction==='blood_angels'), swU=sw.units.find(u=>u.subFaction==='space_wolves');
console.log('Kapitel-Einheiten: SW',sw.units.filter(u=>u.subFaction).length,'BA',ba.units.filter(u=>u.subFaction).length,'| SM generisch',F.find(f=>f.id==='space_marines').units.filter(u=>u.subFaction).length, '|', baU.name,'/',swU.name);
A.state.factionId='space_wolves';A.state.detachments.space_wolves=[];
sw.unitIndex[baU.id]=baU;   // Fremd-Einheit simulieren (z. B. manipuliertes Backup)
A.state.armies.space_wolves=[A.makeEntry(swU.id),A.makeEntry(baU.id)];
console.log('SW+BA:',A.subFactionIssues().map(w=>w.code+': '+w.msg));
delete sw.unitIndex[baU.id];
A.state.armies.space_wolves=[A.makeEntry(swU.id)];console.log('nur SW:',A.subFactionIssues().length);
// 2) Generator: nie Kapitel-Mischung, Leader nur an allowedBodyguards, Supreme Commander = Warlord
let lists=0,mix=0,badAttach=0,wlBad=0,epicWl=0,epicIn=0,errs=0;
for(const f of F)for(const lim of [1000,2000])for(const arch of ['balanced','melee','shooting']){
  A.state.factionId=f.id;A.state.limit=lim;A.state.armies[f.id]=[];A.state.detachments[f.id]=[];
  const r=A.runAutoList({limit:lim,archetype:arch,source:'catalog',locked:[],seed:0});if(!r.ok)continue;lists++;
  const L=A.army();const subs=new Set(L.map(e=>A.unitDef(e.unitId).subFaction).filter(Boolean));if([...subs].some(s=>s!==f.id))mix++;
  L.filter(e=>e.attachedTo).forEach(e=>{const t=L.find(x=>x.uid===e.attachedTo);if(!A.canLead(A.unitDef(e.unitId),A.unitDef(t.unitId)))badAttach++;});
  const wl=L.find(e=>e.warlord);const best=Math.max(0,...L.map(e=>A.warlordRank(A.unitDef(e.unitId))));
  if(!wl||A.warlordRank(A.unitDef(wl.unitId))<best)wlBad++;
  if(L.some(e=>A.unitDef(e.unitId).epicHero)){epicIn++;if(wl&&A.unitDef(wl.unitId).epicHero)epicWl++;}
  if(A.validate().some(w=>w.lvl==='err'))errs++;
}
console.log(`Listen ${lists} | fremde Kapitel ${mix} | ungültige Anschlüsse ${badAttach} | Warlord nicht bester Rang ${wlBad} | Epic Hero als Warlord ${epicWl}/${epicIn} | Regelfehler ${errs}`);
// 3) Supreme Commander: Guilliman in Liste, anderer Warlord -> Fehler
const um=F.find(f=>f.id==='ultramarines');A.state.factionId='ultramarines';A.state.detachments.ultramarines=[];
const g=um.units.find(u=>u.name==='Roboute Guilliman'), cap=um.units.find(u=>u.name==='Captain');
const eg=A.makeEntry(g.id), ec=A.makeEntry(cap.id); ec.warlord=true; A.state.armies.ultramarines=[eg,ec];
console.log('Supreme:',A.isSupremeCommander(g),A.warlordIssues().map(w=>w.msg));
eg.warlord=true;ec.warlord=false;console.log('Guilliman Warlord:',A.warlordIssues().length);
// Generator mit fixiertem Captain als Warlord + Guilliman
A.state.armies.ultramarines=[Object.assign(A.makeEntry(cap.id),{uid:'C',warlord:true}),Object.assign(A.makeEntry(g.id),{uid:'G'})];
A.runAutoList({limit:2000,archetype:'balanced',source:'catalog',locked:['C','G'],seed:0});
console.log('Generator Warlord:',A.army().filter(e=>e.warlord).map(e=>A.unitDef(e.unitId).name), A.warlordIssues().length);
