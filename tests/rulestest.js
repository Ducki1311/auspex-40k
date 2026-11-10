const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,makeEntry,validate,complianceIssues,enhancementEligibility,localizeData,COMPLIANCE,army,unitDef,runAutoList};','a.js');const A=m.exports;
A.localizeData();
let ok=0, fail=0; const chk=(n,c)=>{ if(c) ok++; else {fail++; console.log('FEHL', n);} };
const setup=(fid,limit=2000)=>{A.state.factionId=fid;A.state.limit=limit;A.state.armies[fid]=[];A.state.detachments[fid]=[];return A.GAME_DATA.factions.find(f=>f.id===fid);};
const U=(f,n)=>f.units.find(u=>u._i?.name?.en===n||u.name===n);
const add=(f,n)=>{const e=A.makeEntry(U(f,n).id);A.army().push(e);return e;};
const codes=()=>A.complianceIssues().map(x=>x.code);
// 1) Epischer Held mit Enhancement
let f=setup('space_marines'); const gladius=f.detachments.find(d=>d._i.name.en==='Gladius Task Force'); A.state.detachments[f.id]=[gladius.id];
const enhG=f.enhancements.filter(e=>e._i.detachment.en==='Gladius Task Force');
const epic=f.units.find(u=>u.epicHero&&u.role==='character'); const ee=A.makeEntry(epic.id); A.army().push(ee); ee.enhancementId=enhG[0].id;
chk('Epischer Held mit Enhancement → Fehler', codes().includes('epic-enh'));
// 2) Adept of the Codex nur für Captain
A.state.armies[f.id]=[]; const lt=add(f,'Lieutenant'); const adept=f.enhancements.find(e=>e._i.name.en==='Adept of the Codex');
lt.enhancementId=adept.id; chk('Adept of the Codex auf Lieutenant → Fehler', codes().includes('enh-invalid'));
const cap=add(f,'Captain'); lt.enhancementId=null; cap.enhancementId=adept.id; chk('Adept of the Codex auf Captain → ok', !codes().includes('enh-invalid'));
// 3) Enhancement aus fremdem Detachment
const other=f.enhancements.find(e=>e._i.detachment.en!=='Gladius Task Force'&&!e.upgrade&&!e.req);
cap.enhancementId=other.id; chk('Fremdes Detachment → Fehler', codes().includes('enh-invalid'));
cap.enhancementId=null;
// 4) Rhino ohne Infanterie / nur mit Terminatoren / mit Intercessors
A.state.armies[f.id]=[]; add(f,'Rhino'); chk('Rhino allein → Fehler', codes().includes('transport-empty'));
add(f,'Terminator Squad'); chk('Rhino + Terminatoren → Fehler', codes().includes('transport-empty'));
add(f,'Intercessor Squad'); chk('Rhino + Intercessors → ok', !codes().includes('transport-empty'));
A.state.armies[f.id]=[]; const imp=add(f,'Impulsor'); const hi=add(f,'Heavy Intercessor Squad'); hi.sizeIdx=1;
console.log('   Impulsor + 10 Heavy Intercessors (Gravis ×2 > 7):', codes().includes('transport-empty') ? 'Fehler ✓' : 'ok');
hi.sizeIdx=0; chk('Impulsor + 5 Heavy Intercessors (Gravis 10 Plätze > 7) → Fehler', codes().includes('transport-empty'));
add(f,'Assault Intercessor Squad'); chk('Impulsor + Assault Intercessors → ok', !codes().includes('transport-empty'));
// 5) Verbündete über 25 %
f=setup('chaos_daemons',1000); const ally=f.units.filter(u=>u.ally&&!u.allyRule).sort((a,b)=>b.sizes[0].points-a.sizes[0].points);
let pts=0; for(const u of ally){ if(pts>260) break; const e=A.makeEntry(u.id); A.army().push(e); pts+=u.sizes[0].points; }
chk(`Verbündete ${pts} Pkt bei 1000 → Fehler`, codes().includes('allies'));
A.state.armies[f.id]=[A.makeEntry(ally[ally.length-1].id)]; chk('Ein kleiner Verbündeter → ok', !codes().includes('allies'));
// 6) Enhancement-Obergrenze per Konfiguration
f=setup('space_marines'); A.state.detachments[f.id]=[gladius.id]; const free=enhG.filter(e=>!e.upgrade);
['Captain','Lieutenant','Chaplain','Librarian'].forEach((n,i)=>{const e=add(f,n); if(free[i]) e.enhancementId=free[i].id;});
const n4=A.army().filter(e=>e.enhancementId).length; console.log('   free',free.length,'n4',n4);
chk(`${n4} Enhancements bei Strike Force (Limit 4 laut 11. Edition) → ok`, !A.validate().some(w=>w.lvl==='err'&&/Enhancements gewählt/.test(w.msg)));
A.COMPLIANCE.enhancementCap=3; chk('Mit COMPLIANCE.enhancementCap = 3 → Fehler', A.validate().some(w=>w.lvl==='err'&&/Enhancements gewählt/.test(w.msg))); A.COMPLIANCE.enhancementCap=null;
// 7) Auto-List hält alle Regeln ein (inkl. Transporte) – alle Fraktionen im Katalog-Modus
let bad=0,n=0;
for (const fx of A.GAME_DATA.factions) for (const a of ['balanced','control']) {
  setup(fx.id,2000); const r=A.runAutoList({limit:2000,archetype:a,source:'catalog',locked:[],seed:0}); n++;
  const errs=A.validate().filter(w=>w.lvl==='err'); if(errs.length){bad++; if(bad<6) console.log('  ',fx.id,a,errs.map(x=>x.msg));}
}
chk(`Auto-List Katalog-Modus: ${n} Listen ohne Regelfehler`, bad===0);
console.log(`Regel-Tests: ${ok} ok, ${fail} Fehler`);
