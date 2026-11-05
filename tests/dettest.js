const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const src=process.argv[2]==='base'?fs.readFileSync(__dirname+'/app.js','utf8').replace(/function detachmentFactor\(u, det, f = faction\(\)\) \{/,'function detachmentFactor(u, det, f = faction()) { return 1;'):fs.readFileSync(__dirname+'/app.js','utf8');
const m=new module.constructor();m._compile(src+';module.exports={GAME_DATA,state,army,unitDef,runAutoList,runEvolutionAutoList,applyDetachmentRules,validate,complianceIssues,armyPoints};','a.js');const A=m.exports;
(async()=>{
 const cases=[['space_marines','Ironstorm Spearhead'],['space_marines','Tacticus Firestorm Force'],['space_marines','Shadowmark Talon'],['space_marines','Stormlance Task Force'],['tyranids','Crusher Stampede'],['tyranids','Assimilation Swarm'],['necrons','Starshatter Arsenal'],['necrons','Hypercrypt Legion'],['orks','Dread Mob'],['astra_militarum','Mechanised Assault']];
 let S={smart:[0,0,0,0],ga:[0,0,0,0]};
 for(const [fid,dn] of cases){const f=A.GAME_DATA.factions.find(x=>x.id===fid);const d=f.detachments.find(x=>(x.name.en||x.name).includes(dn)||JSON.stringify(x.name).includes(dn));if(!d){console.log('fehlt',dn);continue;}
  for(const mode of ['smart','ga']){A.state.factionId=fid;A.state.armies[fid]=[];A.state.detachments[fid]=[d.id];
   const r=mode==='ga'?await A.runEvolutionAutoList({limit:2000,source:'catalog',locked:[],seed:0,ga:{detachmentId:d.id}}):A.runAutoList({limit:2000,source:'catalog',locked:[],seed:0});
   const rep=A.applyDetachmentRules(A.army(),d.id);const err=[...A.validate(),...A.complianceIssues()].filter(x=>x.lvl==='err').length;
   const s=S[mode];s[0]+=rep.coreShare;s[1]+=rep.offTheme;s[2]+=err;s[3]++;
   if(process.argv[3]==='v')console.log(mode.padEnd(5),dn.padEnd(26),'Primär',String(rep.primary).padEnd(16),'perfekt',(rep.coreShare*100).toFixed(0).padStart(3)+'%','daneben',(rep.offTheme*100).toFixed(0).padStart(3)+'%','Grad',(rep.score*100).toFixed(0)+'%','Pkt',A.armyPoints(),'Fehler',err, '|', A.army().filter(e=>{const u=A.unitDef(e.unitId);return u.role!=='character'}).map(e=>A.unitDef(e.unitId).name).slice(0,6).join(', '));
 }}
 for(const k of ['smart','ga']){const s=S[k];console.log(process.argv[2]||'neu',k,'Ø perfekt passende Kampf-Punkte',(s[0]/s[3]*100).toFixed(0)+'%','| Ø daneben',(s[1]/s[3]*100).toFixed(0)+'%','| Regelfehler',s[2]);}
})();
