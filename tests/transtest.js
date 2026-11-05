const fs=require('fs');
const mk=id=>({id,innerHTML:'',value:'',textContent:'',className:'',hidden:false,children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){},select(){}});
const els={};global.document={getElementById:i=>els[i]||(els[i]=mk(i)),querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:mk('b'),documentElement:mk('h'),addEventListener(){},createElement:()=>mk('x'),head:mk('hd')};
global.window={matchMedia:()=>({addEventListener(){}}),scrollTo(){}};global.localStorage={getItem(){return null},setItem(){}};global.navigator={};global.location={protocol:'file:'};global.requestAnimationFrame=f=>f();
const m=new module.constructor();m._compile(fs.readFileSync(__dirname+'/app.js','utf8')+';module.exports={GAME_DATA,state,army,unitDef,runAutoList,validate,armyPoints,collection,unitHas,transportFits};','a.js');const A=m.exports;
const isDT=u=>u.role==='transport'||A.unitHas(u,'dedicated transport');
// Daten-Check: DT-Keyword ohne Rolle transport
let odd=[];for(const f of A.GAME_DATA.factions)for(const u of f.units)if(A.unitHas(u,'dedicated transport')&&u.role!=='transport')odd.push(f.id+':'+u.name);
console.log('DT-Keyword aber Rolle≠transport:',odd.length,odd.slice(0,8));
let lists=0,trans=0,empty=0,noCarry=0,over=0,errs=0,ex=[];let rnd=1;const R=()=>(rnd=(rnd*16807)%2147483647)/2147483647;
for(const f of A.GAME_DATA.factions)for(const lim of [500,1000,1500,2000,3000])for(const arch of ['balanced','shooting','melee','control'])for(const src of ['catalog','inventory']){
  A.state.factionId=f.id;A.state.limit=lim;A.state.armies[f.id]=[];A.state.detachments[f.id]=[];
  if(src==='inventory'){const c=A.collection();Object.keys(c).forEach(k=>delete c[k]);f.units.forEach(u=>{if(R()<.45)c[u.id]=1+Math.floor(R()*3)});}
  const r=A.runAutoList({limit:lim,archetype:arch,source:src,locked:[],seed:0});if(!r.ok)continue;lists++;
  const L=A.army();if(A.armyPoints()>lim)over++;
  L.filter(e=>isDT(A.unitDef(e.unitId))).forEach(t=>{trans++;const c=L.filter(x=>x.embarkedIn===t.uid);if(!c.length){empty++;if(ex.length<6)ex.push(`${f.id} ${lim} ${arch} ${src}: ${A.unitDef(t.unitId).name}`)}
    if(!Array.isArray(t.carrying)||!t.carrying.length)noCarry++;});
  if(A.validate().some(w=>w.code==='transport-empty'||w.code==='transport-unloaded'))errs++;
}
console.log(`Listen ${lists} | Transporter ${trans} | leer ${empty} | ohne carrying ${noCarry} | über Limit ${over} | Transport-Fehler in validate ${errs}`);console.log(ex.join('\n'));
