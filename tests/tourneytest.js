const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,makeEntry,validate,runAutoList,buildGWExportText,isActionMonkey,reserveEntries,armyPoints};','a.js');const A=m.exports;
let ok=0,fail=0; const chk=(n,c)=>{ if(c) ok++; else {fail++; console.log('FEHL',n);} };
const setup=(fid,lim=2000)=>{A.state.factionId=fid;A.state.limit=lim;A.state.armies[fid]=[];A.state.detachments[fid]=[];A.state.tournament={format:'gw'};return A.GAME_DATA.factions.find(f=>f.id===fid);};
const U=(f,n)=>f.units.find(u=>u._i?.name?.en===n);
const add=(f,n,k=0)=>{const e=A.makeEntry(U(f,n).id);e.sizeIdx=k;A.army().push(e);return e;};
const codes=()=>A.validate().map(w=>w.code).filter(Boolean);
// 1) Reserven
let f=setup('space_marines',1000);
const t1=add(f,'Terminator Squad',1), t2=add(f,'Deathwatch Terminator Squad',1); add(f,'Intercessor Squad');
console.log('   Terminatoren', A.armyPoints(), 'Pkt gesamt');
chk('Deep-Strike-Punkte > 50 % → Warnung', codes().includes('reserve-ds'));
t1.reserve=true; chk('Eine Einheit in Reserve (≤ 500) → ok', !codes().includes('reserve-limit'));
t2.reserve=true; chk('Beide in Reserve (> 500) → „Reserve-Limit überschritten“', A.validate().some(w=>w.code==='reserve-limit'&&/Reserve-Limit von 50 %/.test(w.msg)));
const cap=add(f,'Captain in Terminator Armour'); cap.attachedTo=t1.uid; t2.reserve=false;
chk('Angeschlossener Captain zählt zur Reserve', A.reserveEntries().includes(cap));
// 2) WTC-Format
f=setup('chaos_daemons',2000); const allies=f.units.filter(u=>u.ally&&!u.allyRule);
const facs=[...new Set(allies.map(u=>u.ally))]; console.log('   Verbündete Fraktionen bei Chaos Daemons:', facs.slice(0,4));
const a1=allies.find(u=>u.ally===facs[0]&&!u.epicHero&&u.role!=='character'), a2=allies.find(u=>u.ally===facs[1]&&!u.epicHero&&u.role!=='character');
A.army().push(A.makeEntry(a1.id)); if(a2) A.army().push(A.makeEntry(a2.id));
chk('GW: zwei verbündete Fraktionen erlaubt', !codes().includes('allies-factions'));
A.state.tournament={format:'wtc'}; chk('WTC: zwei verbündete Fraktionen → Fehler', !a2 || codes().includes('allies-factions'));
const ae=allies.find(u=>u.epicHero); if(ae){ A.army().push(A.makeEntry(ae.id)); chk('WTC: verbündeter Epischer Held → Fehler', codes().includes('allies-epic')); }
A.state.tournament={format:'gw'}; chk('GW: verbündeter Epischer Held erlaubt', !codes().includes('allies-epic'));
// 3) Board Control: Action Monkeys
let withMonkeys=0, n=0;
for (const fx of A.GAME_DATA.factions) { setup(fx.id,2000); const r=A.runAutoList({limit:2000,archetype:'control',source:'catalog',locked:[],seed:0}); if(!r.ok) continue; n++;
  const mk2=A.army().filter(e=>A.isActionMonkey(A.unitDef(e.unitId))).length; if (mk2>=2 || !fx.units.some(u=>A.isActionMonkey(u)&&!u.legends&&!u.ally)) withMonkeys++; }
chk(`Board Control 2000: mind. 2 Action Monkeys (sofern vorhanden) in ${withMonkeys}/${n} Listen`, withMonkeys===n);
// 4) GW / BCP Export
f=setup('space_marines',2000); A.runAutoList({limit:2000,archetype:'balanced',source:'catalog',locked:[],seed:0});
const txt=A.buildGWExportText();
chk('Export: Kopfzeile mit Gesamtpunkten', /\(\d+ Points\)\n\nSpace Marines\nStrike Force \(2000 Points\)/.test(txt));
chk('Export: genau ein „• Warlord“', (txt.match(/• Warlord/g)||[]).length===1);
chk('Export: Enhancements gelistet', /• Enhancements: /.test(txt) === A.army().some(e=>e.enhancementId));
chk('Export: angeschlossene Charaktere', /• Attached to: /.test(txt) === A.army().some(e=>e.attachedTo));
chk('Export: rein englisch', !/[äöüß]/i.test(txt));
fs.writeFileSync('/tmp/gw_export.txt', txt);
console.log(`Turnier-Tests: ${ok} ok, ${fail} Fehler`);
for (const fx of A.GAME_DATA.factions) { setup(fx.id,2000); const r=A.runAutoList({limit:2000,archetype:'control',source:'catalog',locked:[],seed:0}); if(!r.ok) continue;
  const mk2=A.army().filter(e=>A.isActionMonkey(A.unitDef(e.unitId))); const avail=fx.units.filter(u=>A.isActionMonkey(u)&&!u.legends&&!u.ally);
  if (mk2.length<2 && avail.length) console.log('MONKEY',fx.id,'in Liste',mk2.length,'verfügbar',avail.length, avail.slice(0,4).map(u=>u._i.name.en+' '+u.sizes[0].points+(u.detOnly?' detOnly':'')).join('; ')); }
const lt=A.GAME_DATA.factions.find(x=>x.id==='space_marines').units.find(u=>u._i.name.en==='Lieutenant'); console.log(JSON.stringify(lt.models.map(m=>({n:m.n,min:m.min,max:m.max,slots:(m.lo.slots||[]).map(s=>s.n+'['+s.min+'-'+s.max+']:'+s.opts.map(o=>o.n).join('/')),fixed:(m.lo.fixed||[]).map(x=>x.n)}))));
