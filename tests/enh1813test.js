const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,validate,complianceIssues,makeEntry,unitLimit,runAutoList,availableEnhancements,pactPoints,alliesPoints,enhancementEligibility,canTakeEnhancement,codexStatus,CODEX_11E,wahapediaUnitUrl,modelCounts,gearAlloc,selectedGear,playLog,playState};','a.js');const A=m.exports;
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

// v18.14: Ausrüstung, Verbündete, Detachments, Codex-Status
const W=(fid,n)=>{const u=U(fid,n);const s=new Set();JSON.stringify([u.models,u.unitLoadout],(k,v)=>{if(k==='w')v.forEach(x=>s.add(x));return v});return s;};
t('Captain in Gravis: Relic-Waffen wählbar',['Relic Blade','Relic Chainsword','Relic Power Fist','Boltstorm Gauntlet'].every(x=>W('space_marines','Captain in Gravis Armour').has(x)));
t('Termite: Kombiwaffen statt Storm bolter',W('space_marines','Terrax-pattern Termite').has('➤ Combi-weapon - Infernus')&&!W('space_marines','Terrax-pattern Termite').has('Storm bolter'));
t('Kill Tank: Dual Big Shoota',W('orks','Kill Tank').has('Dual Big Shoota'));
t("Tesseract Vault: C'tan Powers",W('necrons','Tesseract Vault').has('➤ Cosmic Fire'));
t('T\'au: keine Missile Drone mehr',!F('tau_empire').units.some(u=>JSON.stringify(u.models||[]).includes('"Missile Drone"')));
t('Canis Rex: ein Modell, Hekhtur nur Referenz',U('imperial_knights','Canis Rex').models.length===1&&(U('imperial_knights','Canis Rex').refWeapons||[]).length>0);
t('X-101 vorhanden',!!U('adeptus_mechanicus','X-101'));
t('Chaos Daemons: Chaos Lord on Juggernaut als Verbündeter',!!U('chaos_daemons','Chaos Lord on Juggernaut')&&!!U('chaos_daemons','Chaos Lord on Juggernaut').ally);
t('Aeldari ohne Drukhari-Detachments',!F('aeldari').detachments.some(d=>/Realspace Raiders|Kabalite Cartel/.test(N(d.name))));
t('Drukhari ohne Craftworld-Detachments',!F('drukhari').detachments.some(d=>/Warhost|Seer Council/.test(N(d.name))));
t('Chaos Spawn (Flesh Change) nicht kaufbar',!U('thousand_sons','Chaos Spawn (Flesh Change)'));
t('Jede Waffe hat ein Profil',(()=>{let bad=[];for(const f of A.GAME_DATA.factions)for(const u of f.units){const s=new Set();JSON.stringify([u.models,u.unitLoadout],(k,v)=>{if(k==='w')v.forEach(x=>s.add(x));return v});[...s,...(u.refWeapons||[])].forEach(w=>{if(!((u.wpn||{})[w]||f.weapons[w]))bad.push(f.id+'/'+N(u.name)+'/'+w)})}if(bad.length)console.log('  ohne Profil:',bad.slice(0,8));return !bad.length;})());
A.state.factionId='space_marines';A.army().length=0;const lg=F('space_marines').units.find(u=>u.noMfm);if(lg){A.army().push(A.makeEntry(lg.id));t('Legends ohne MFM: Warnung',A.validate().some(x=>/Munitorum Field Manual/.test(x.msg)));}
A.CODEX_11E.necrons='2099-01-01';t('Codex-Status „erscheint“',A.codexStatus(F('necrons')).kind==='upcoming');delete A.CODEX_11E.necrons;
t('Datenblatt-Link',/^https:\/\/wahapedia\.ru\/wh40k11ed\/factions\/necrons\//.test(A.wahapediaUnitUrl(U('necrons','Necron Warriors'),F('necrons'))));

// v18.15: Optionsgrenzen und Zusammensetzung laut Datenblatt
const cnt=(fid,un,size,opts)=>{A.state.factionId=fid;A.army().length=0;const u=U(fid,un);const e=A.makeEntry(u.id);e.sizeIdx=u.sizes.findIndex(z=>z.models===size);Object.assign(e.options,opts);A.army().push(e);return A.modelCounts(e);};
t('Boyz (10): höchstens 1 Big Shoota',cnt('orks','Boyz',10,{'m|Boy w/ Big shoota':2})['Boy w/ Big shoota']===1);
t('Boyz (20): 2 Nobz Pflicht',cnt('orks','Boyz',20,{})['Nob']===2);
t('Voidscarred mit 10 Modellen wählbar',U('aeldari','Corsair Voidscarred').sizes.some(z=>z.models===10&&z.points===140));
t('Voidscarred: schwere Waffe erst ab 10',cnt('aeldari','Corsair Voidscarred',5,{'m|Voidscarred with heavy weapon':1})['Voidscarred with heavy weapon']===0&&cnt('aeldari','Corsair Voidscarred',10,{'m|Voidscarred with heavy weapon':1})['Voidscarred with heavy weapon']===1);
t('Raptors (5): höchstens 2 Spezialwaffen',(c=>c['Raptor w/ flamer']+c['Raptor w/ meltagun']+c['Raptor w/ plasma gun'])(cnt('chaos_space_marines','Raptors',5,{'m|Raptor w/ flamer':1,'m|Raptor w/ meltagun':1,'m|Raptor w/ plasma gun':1}))===2);
t('Crusader Squad (10): genau 4 Neophytes',(c=>c['Neophyte w/ Shotgun']+c['Neophyte w/ Chainsword'])(cnt('black_templars','Crusader Squad',10,{}))===4);
// Ausrüstung je Modell (v18.16)
const gear=(fid,un,size,opts)=>{cnt(fid,un,size,opts);const e=A.army()[0];const g={};A.selectedGear(e).forEach(x=>{g[x.label]=(g[x.label]||0)+x.count});return g;};
let g=gear('black_templars','Sword Brethren Squad',5,{'n|Sword Brother|Melee Option|Thunder Hammer':3});
t('Sword Brethren (5): höchstens 1 Thunder Hammer',g['Thunder Hammer']===1);
g=gear('black_templars','Sword Brethren Squad',5,{'n|Sword Brother|Melee Option|Thunder Hammer':1,'n|Sword Brother|Pistol Option|Hand flamer':2});
t('Sword Brethren: Thunder Hammer und Hand flamer kombinierbar',g['Thunder Hammer']===1&&g['Hand flamer']===2);
g=gear('black_templars','Sword Brethren Squad',5,{'s|Sword Brother|Melee Option':'Thunder Hammer'});
t('Auswahl „alle mit Thunder Hammer“ wird auf das Erlaubte begrenzt',g['Thunder Hammer']===1);
g=gear('blood_angels','Death Company Marines with Jump Packs',10,{'n|Death Company Marine|Melee Weapon|Power weapon':4,'n|Death Company Marine|Pistol Weapon|Plasma pistol':4});
t('Death Company JP (10): 4 Power weapons + 4 Plasma pistols',g['Power weapon']===4&&g['Plasma pistol']===4);
// Spielprotokoll
A.state.factionId='orks';A.army().length=0;A.army().push(A.makeEntry(U('orks','Boyz').id));const ps=A.playState();ps.cp=3;A.playLog('Test');ps.cp=5;
t('Spielprotokoll merkt den Stand',ps.history.length>0&&JSON.parse(ps.history[ps.history.length-1].snap).cp===3);
console.log('v18.13/14-Tests:',ok,'ok,',bad,'Fehler');
