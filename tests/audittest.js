const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,validate,complianceIssues,makeEntry,unitLimit,runAutoList,availableEnhancements,pactPoints,alliesPoints};','a.js');const A=m.exports;
let ok=0,bad=0;const t=(n,c)=>{c?ok++:bad++;console.log((c?'✓ ':'✗ ')+n)};
const all=()=>[...A.validate(),...A.complianceIssues()].map(x=>x.msg);
const setup=(fid,limit,det)=>{A.state.factionId=fid;A.state.limit=limit;A.army().length=0;A.state.detachments[fid]=det?[det]:[];};
const add=n=>{const f=A.GAME_DATA.factions.find(f=>f.id===A.state.factionId);const u=f.units.find(u=>u.name===n);const e=A.makeEntry(u.id);A.army().push(e);return e;};
// a) Transporter-Limit je Datenblatt
setup('space_marines',2000);const rh=A.GAME_DATA.factions.find(f=>f.id==='space_marines').units.find(u=>u.name==='Rhino');
t('Rhino Limit Strike Force = 6',A.unitLimit(rh)===6);
for(let i=0;i<7;i++)add('Rhino');t('7 Rhinos → Fehler',all().some(m=>/Rhino: 7×/.test(m)));
A.army().length=0;for(let i=0;i<6;i++)add('Rhino');for(let i=0;i<2;i++)add('Impulsor');t('6 Rhinos + 2 Impulsor → kein Transport-Gesamtfehler',!all().some(m=>/Dedicated Transports –|Rhino: |Impulsor: /.test(m)));
A.state.limit=1000;t('Rhino Limit Incursion = 4',A.unitLimit(rh)===4);
// d) Warlord Fraktions-Keyword / e) Pakt 50 %
const ec=A.GAME_DATA.factions.find(f=>f.id==='emperors_children');const car=ec.detachments.find(d=>/Carnival/.test(d.name)).id;
setup('emperors_children',1000,car);
const dae=ec.units.filter(u=>u.ally==='Legions of Excess');console.log('  Pakt-Einheiten:',dae.map(u=>u.name+' '+u.sizes[0].points).join(', '));
const dch=dae.find(u=>u.charType||/Keeper|Daemon Prince|Herald|Masque|Shalaxi|Contorted/.test(u.name))||dae[0];
const e=A.makeEntry(dch.id);A.army().push(e);e.warlord=true;
t('Pakt-Dämon als Warlord → Fehler',all().some(m=>/Fraktions-Keyword|Faction keyword/.test(m)));
A.army().length=0;let p=0;while(A.pactPoints(A.army())<=500&&p<40){A.army().push(A.makeEntry(dae[p%dae.length].id));p++;}
t('Pakt > 50 % → Fehler',all().some(m=>/Pakt|Pact/.test(m)));
t('Pakt zählt nicht als 25 %-Verbündete',A.alliesPoints(A.army())===0);
// b) Upgrade zählt 1×
// c) ein Enhancement je angeschlossener Einheit
setup('space_marines',2000);
const enhs=A.availableEnhancements?A.availableEnhancements().filter(x=>!x.upgrade):[];
console.log('  Enhancements (ohne Det):',enhs.length);
// Generator: Pakt & Warlord
setup('emperors_children',2000,car);
let wlBad=0,pactBad=0,multiEnh=0,errs=0;
for(let s=1;s<=25;s++){try{A.runAutoList({limit:2000,archetype:'balanced',source:'catalog',locked:[],seed:s});}catch(err){}
 const l=A.army();const w=l.find(x=>x.warlord);if(w&&A.unitDef(w.unitId).ally)wlBad++;
 if(A.pactPoints(l)>1000)pactBad++;
 l.filter(x=>!x.attachedTo).forEach(r=>{if([r,...l.filter(x=>x.attachedTo===r.uid)].filter(x=>x.enhancementId).length>1)multiEnh++;});
 errs+=all().filter(m=>/Fraktions-Keyword|Pakt|Enhancements – erlaubt ist eins/.test(m)).length;}
t('Generator: kein Pakt-Warlord ('+wlBad+')',wlBad===0);t('Generator: Pakt ≤ 50 %',pactBad===0);t('Generator: 1 Enh je Einheit ('+multiEnh+')',multiEnh===0);t('Generator: keine neuen Regelfehler ('+errs+')',errs===0);
console.log('Audit-Tests:',ok,'ok,',bad,'Fehler');
// c) Validierung: zwei Leader mit Enhancement an einem Trupp
{const f=A.GAME_DATA.factions.find(f=>f.id==='space_marines');const det=f.detachments.find(d=>f.enhancements.filter(e=>e.detachment===d.name&&!e.upgrade).length>=2);setup('space_marines',2000,det.id);
 const tr=add('Intercessor Squad'),c=add('Captain'),l=add('Lieutenant');c.attachedTo=tr.uid;l.attachedTo=tr.uid;c.warlord=true;
 const en=f.enhancements.filter(e=>e.detachment===det.name&&!e.upgrade);c.enhancementId=en[0].id;l.enhancementId=en[1].id;
 t('Captain+Lt. mit je Enhancement am selben Trupp → Fehler',all().some(m=>/erlaubt ist eins/.test(m)));
 l.enhancementId=null;t('nur ein Enhancement → ok',!all().some(m=>/erlaubt ist eins/.test(m)));}
// b) Upgrade zählt beim Limit einmal (Incursion: 2 Enhancements)
{const f=A.GAME_DATA.factions.find(f=>f.id==='astra_militarum');const up=f.enhancements.find(e=>e.upgrade);const D=f.detachments.find(d=>d.name===up.detachment);const det=D.name;setup('astra_militarum',1000,D.id);
 const ch=f.enhancements.filter(e=>!e.upgrade);console.log('  Upgrade:',up.name,'| Charakter-Enh im Det:',ch.length);
 const cnt=()=>{const m=all().find(m=>/Enhancements gewählt/.test(m));return m||'ok'};
 const sq=[0,1,2].map(()=>{const u=f.units.find(u=>u.role==='battleline');const e=A.makeEntry(u.id);A.army().push(e);return e;});sq.forEach(e=>e.enhancementId=up.id);
 const c1=add('Cadian Castellan');c1.warlord=true;if(ch[0])c1.enhancementId=ch[0].id;
 t('Upgrade auf 3 Trupps + 1 Charakter-Enh = 2 → ok ('+cnt()+')',cnt()==='ok');
 const c2=add('Commissar');if(ch[1])c2.enhancementId=ch[1].id;
 t('… + 2. Charakter-Enh = 3 > 2 → Fehler',!ch[1]||cnt()!=='ok');}
console.log('Audit-Tests gesamt:',ok,'ok,',bad,'Fehler');
