const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,validate,complianceIssues,makeEntry,unitLimit,runAutoList,availableEnhancements,pactPoints,alliesPoints,enhancementEligibility,canTakeEnhancement};','a.js');const A=m.exports;
let ok=0,bad=0;const t=(n,c)=>{c?ok++:bad++;console.log((c?'✓ ':'✗ ')+n)};
const all=()=>[...A.validate(),...A.complianceIssues()].map(x=>x.msg);
const F=id=>A.GAME_DATA.factions.find(f=>f.id===id);
const N=x=>{const s=(x&&typeof x==='object')?x.en:String(x);const m=s.match(/\(([^()]+)\)$/);return m?m[1]:s;};
const setup=(fid,det)=>{A.state.factionId=fid;A.state.limit=2000;A.army().length=0;const d=F(fid).detachments.find(d=>N(d.name)===det||String(d.name).includes(det));A.state.detachments[fid]=[d.id];return d.id;};
const U=(fid,n)=>F(fid).units.find(u=>N(u.name)===n||u.name===n);
const E=(fid,n)=>F(fid).enhancements.find(e=>N(e.name)===n||String(e.name).endsWith('('+n+')')||e.name===n);
const put=(fid,un,en)=>{const e=A.makeEntry(U(fid,un).id);A.army().push(e);if(en)e.enhancementId=E(fid,en).id;return e;};
// Pantheon of Woe: C'tan (Epic Hero) mit passender Fähigkeit
let det=setup('necrons','Pantheon of Woe');
t('Quantum Goad für Nightbringer erlaubt',A.enhancementEligibility(E('necrons','Quantum Goad'),U('necrons',"C'tan Shard of the Nightbringer"),[det]).ok);
t('Quantum Goad nicht für Deceiver',!A.enhancementEligibility(E('necrons','Quantum Goad'),U('necrons',"C'tan Shard of the Deceiver"),[det]).ok);
t('Normaler Epic Hero (Imotekh) weiter gesperrt',!A.enhancementEligibility(E('necrons','Quantum Goad'),U('necrons','Imotekh the Stormlord'),[det]).ok);
put('necrons',"C'tan Shard of the Nightbringer",'Quantum Goad');
t('Liste mit Quantum Goad ohne Regelfehler',!all().some(m=>/Episch|Epic|Quantum/.test(m)));
t('Nightbringer bekommt Enhancement-Feld',A.canTakeEnhancement(U('necrons',"C'tan Shard of the Nightbringer")));
// Houndpack Lance: War Dog (kein Charakter)
det=setup('chaos_knights','Houndpack Lance');
t('War Dog darf Houndpack-Enhancement',A.enhancementEligibility(E('chaos_knights','Loping Predator'),U('chaos_knights','War Dog Karnivore'),[det]).ok);
put('chaos_knights','War Dog Karnivore','Loping Predator');
console.log('  ',all().filter(m=>/Loping|nur für Charaktere|Characters only/.test(m)));t('Houndpack-Liste ohne Enhancement-Fehler',!all().some(m=>/Loping|nur für Charaktere|Characters only/.test(m)));
// Flyblown Host: Upgrade auf Plague Marines
det=setup('death_guard','Flyblown Host');
t('Insectile Murmuration auf Plague Marines',A.enhancementEligibility(E('death_guard','Insectile Murmuration'),U('death_guard','Plague Marines'),[det]).ok);
t('… nicht auf Poxwalkers',!A.enhancementEligibility(E('death_guard','Insectile Murmuration'),U('death_guard','Poxwalkers'),[det]).ok);
// Agents: Assassinen-Enhancements
det=setup('agents_of_the_imperium','Veiled Blade Elimination Force');
t('Decoy Targets nur Callidus',A.enhancementEligibility(E('agents_of_the_imperium','Decoy Targets'),U('agents_of_the_imperium','Callidus Assassin'),[det]).ok&&!A.enhancementEligibility(E('agents_of_the_imperium','Decoy Targets'),U('agents_of_the_imperium','Eversor Assassin'),[det]).ok);
// Kernfähigkeiten / FNP
t('Gretchin ohne Infiltrators/Stealth',!(U('orks','Gretchin').core||[]).some(c=>/Infiltrat|Stealth/.test(N(c))));
t('Skitarii Rangers: kein FNP in der Rechnung',!U('adeptus_mechanicus','Skitarii Rangers').fnp);
t('Repentia FNP 5+ bleibt',U('adepta_sororitas','Repentia Squad').fnp===5);
// Generator in neuen Detachments
let errs=0;for(const [fid,d] of [['necrons','Pantheon of Woe'],['chaos_knights','Houndpack Lance'],['death_guard','Flyblown Host'],['agents_of_the_imperium','Imperialis Fleet'],['world_eaters','Brazen Engines']]){setup(fid,d);for(let s=1;s<=6;s++){try{A.runAutoList({limit:2000,archetype:'balanced',source:'catalog',locked:[],seed:s});}catch(e){errs+=100;console.log(e.message)}errs+=[...A.validate(),...A.complianceIssues()].filter(x=>x.lvl==='err').length;}}
t('Generator in neuen Detachments ohne Regelfehler ('+errs+')',errs===0);
console.log('v18.13-Tests:',ok,'ok,',bad,'Fehler');
