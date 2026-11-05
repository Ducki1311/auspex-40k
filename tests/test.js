const fs=require('fs');const els={};const handlers={};
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,checked:false,children:[],dataset:{},
 style:{setProperty(){}},classList:{toggle(){},add(){},remove(){}},focus(){},select(){},addEventListener(){},
 appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null}});
function el(id){return els[id]||(els[id]=mk(id));}
global.document={getElementById:el,querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('body'),
 documentElement:mk('html'),addEventListener:(t,f)=>{(handlers[t]=handlers[t]||[]).push(f)},createElement:()=>mk('x')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};
global.localStorage={_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=v}};
global.confirm=()=>true;global.navigator={clipboard:{writeText:async()=>{}}};
const code=fs.readFileSync(__dirname+'/app.js','utf8')+'\n;module.exports={GAME_DATA,state,handleAction,runAutoList,AuspexAutoListEngine,collection,army,armyPoints,buildExportText,validate,faction,entryPoints,modelCounts,selectedGear,unitDef,battleSize,breakdown,entryWounds,playState};';
const m=new module.constructor();m._compile(code,'app.js');const A=m.exports;
handlers.DOMContentLoaded[0]();
const E=(d,v,c)=>({dataset:d,value:v,checked:c});
let bad=0, n=0; const fill=[];
for(const f of A.GAME_DATA.factions){
 for(const lim of [500,1000,2000,3000]){
  A.state.factionId=f.id;A.state.limit=lim;A.state.collections[f.id]={};A.state.detachments[f.id]=[];
  f.units.filter(u=>!u.legends&&!u.ally).forEach(u=>A.state.collections[f.id][u.id]=2);
  const arch=['balanced','shooting','melee','control'][n%4];
  const R=A.runAutoList({limit:lim,archetype:arch,source:'inventory',locked:[],seed:0});
  n++;
  if(R.ok){ fill.push(R.points/lim); if(R.points/lim<.95) console.log('LOW',f.id,lim,arch,R.points,R.picks.length, 'inv≈', f.units.filter(u=>!u.legends&&!u.ally).reduce((s,u)=>s+2*u.sizes[0].points,0)); if(R.points>lim){bad++;console.log('OVER',f.id,lim,R.points);} }
  const errs=A.validate().filter(x=>x.lvl==='err');
  const L=A.army();
  for(const e of L){ const p=A.entryPoints(e); if(!(p>0)) {bad++;console.log('PTS',f.id,e.unitId,p);} A.modelCounts(e); A.selectedGear(e); A.entryWounds(e); }
  if(A.armyPoints()>lim||errs.length||(L.length&&!L.some(e=>e.warlord))){bad++;console.log('ISSUE',f.id,lim,A.armyPoints(),errs.map(x=>x.msg),L.length);}
  if(!els.strategyPanel.innerHTML.includes('Runde 1')&&L.length){bad++;console.log('STRAT',f.id,lim)}
  if(!els.catalogGrid.innerHTML.length){bad++;console.log('CAT',f.id)}
 }
}
console.log('Durchläufe',n,'Probleme',bad);
fill.sort((a,b)=>a-b); console.log('Auto-List Füllgrad: min',fill[0].toFixed(3),'median',fill[fill.length>>1].toFixed(3),'≥95%:',fill.filter(x=>x>=.95).length+'/'+fill.length);
{ // Archetypen unterscheiden sich, Lock-In bleibt erhalten, Katalog-Modus
  A.state.factionId='space_marines'; A.state.limit=2000; A.state.armies.space_marines=[]; A.state.detachments.space_marines=[];
  const res={}; for(const a of ['balanced','shooting','melee','control']){ const r=A.runAutoList({limit:2000,archetype:a,source:'catalog',locked:[],seed:0}); res[a]=r.picks.map(p=>p.name).sort().join('|'); console.log('SM',a,r.points,r.picks.length,'off',(r.totals.ieOff/r.picks.length).toFixed(2),'def',(r.totals.ieDef/r.picks.length).toFixed(2),'util',(r.totals.ieUtil/r.picks.length).toFixed(2)); }
  console.log('Archetypen verschieden:', new Set(Object.values(res)).size);
  const keep=A.army().slice(0,2).map(e=>e.uid); const kn=A.army().slice(0,2).map(e=>e.unitId);
  const r2=A.runAutoList({limit:1000,archetype:'melee',source:'catalog',locked:keep,seed:3});
  console.log(A.validate().filter(x=>x.lvl==='err').map(x=>x.msg)); console.log('Lock-In erhalten:', keep.every(u=>A.army().some(e=>e.uid===u)), 'Punkte', r2.points, 'Fehler', A.validate().filter(x=>x.lvl==='err').length);
}
// Feature-Tests mit Emperor's Children
A.state.factionId='emperors_children';A.state.limit=2000;A.state.detachments.emperors_children=[];A.state.armies.emperors_children=[];
const f=A.faction(); const id=nm=>f.units.find(u=>u.name===nm).id;
['Lucius the Eternal','Noise Marines','Noise Marines','Noise Marines','Tormentors','Fulgrim','Fulgrim','Defiler','Defiler'].forEach(nm=>A.handleAction('add-unit',E({unit:id(nm)})));
let L=A.army();
console.log('NM Punkte je Kopie',L.filter(e=>e.unitId===id('Noise Marines')).map(A.entryPoints),'Defiler',L.filter(e=>e.unitId===id('Defiler')).map(A.entryPoints));
console.log('Validierung:',A.validate().map(w=>w.lvl+': '+w.msg));
// Detachment + Enhancement
const det=f.detachments.find(d=>d.name.endsWith('(Mercurial Host)'));
A.handleAction('toggle-detachment',E({id:det.id},undefined,true));
const lord=L.find(e=>e.unitId===id('Lucius the Eternal'));
const tor=L.find(e=>e.unitId===id('Tormentors'));
A.handleAction('set-size',E({uid:tor.uid,idx:'1'}));
A.handleAction('model-step',E({uid:tor.uid,model:'Tormentor w/ meltagun',delta:'1'}));
A.handleAction('model-step',E({uid:tor.uid,model:'Tormentor w/ meltagun',delta:'1'}));
A.handleAction('model-step',E({uid:tor.uid,model:'Tormentor w/ meltagun',delta:'1'}));
console.log('Tormentors Modelle',A.modelCounts(tor),'LP',A.entryWounds(tor));
const obs=f.unitIndex[tor.unitId].models[0]; A.handleAction('slot',E({uid:tor.uid,key:'s|Obsessionist|Bolt Pistol'},'Plasma pistol'));
console.log('Gear',A.selectedGear(tor).filter(g=>!g.fixed).map(g=>g.label));
const ex=L.find(e=>f.unitIndex[e.unitId].name==='Fulgrim'); A.handleAction('set-warlord',E({uid:ex.uid}));
const exalt=f.units.find(u=>u.name==='Lord Exultant'); A.handleAction('add-unit',E({unit:exalt.id})); const le=A.army().slice(-1)[0];
const enh=f.enhancements.find(x=>x.detachment.endsWith('(Mercurial Host)')); A.handleAction('set-enh',E({uid:le.uid},enh.id));
A.handleAction('set-attach',E({uid:le.uid},tor.uid));
A.handleAction('set-attach',E({uid:lord.uid},L.find(e=>e.unitId===id('Noise Marines')).uid));
console.log('Breakdown Exultant',A.breakdown(le).map(r=>r.label+':'+r.points));
// Listen speichern/laden
A.state.armyNames.emperors_children='Testliste';
A.handleAction('save-list',E({}));
const saved=A.state.savedLists[0]; console.log('Gespeichert',saved.name,saved.points,saved.army.length);
A.handleAction('clear-army',E({})); console.log('nach Leeren',A.army().length);
A.handleAction('load-list',E({id:saved.id})); console.log('nach Laden',A.army().length,A.armyPoints());
// Spiel-Modus
A.handleAction('mode',E({mode:'play'}));
const u0=A.army()[0]; A.handleAction('wound',E({uid:u0.uid,delta:'-3'})); A.handleAction('cp',E({delta:'2'})); A.handleAction('round',E({delta:'1'}));
A.handleAction('vp',E({round:'0',key:'p'},'10'));
const p=A.playState(); console.log('Play: LP',p.wounds[u0.uid],'/',A.entryWounds(u0),'CP',p.cp,'Runde',p.round,'VP',p.vp[0]);
console.log('playView',els.playView.innerHTML.length);
A.handleAction('mode',E({mode:'build'}));
A.handleAction('datasheet',E({unit:id('Noise Marines')})); console.log('Datenblatt hat Blastmaster',els.datasheetBody.innerHTML.includes('Blastmaster'),'Profile',els.datasheetBody.innerHTML.includes('>T<'));
A.handleAction('export',E({}));
console.log(A.buildExportText().split('\n').slice(0,24).join('\n'));
