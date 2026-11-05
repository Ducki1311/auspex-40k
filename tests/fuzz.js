require('./gq_head.js');
let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
const facs=A.GAME_DATA.factions.map(f=>f.id);const N=+(process.argv[2]||60);
const bad={};const add=(k,m)=>{(bad[k]=bad[k]||[]).push(m)};let runs=0,maxMs=0;
(async()=>{for(let i=0;i<N;i++){
 const fid=facs[Math.floor(rnd()*facs.length)],lim=[500,750,1000,1500,2000,2500,3000][Math.floor(rnd()*7)],mode=rnd()<.5?'ga':'smart',src=rnd()<.3?'inventory':'catalog';
 A.state.factionId=fid;A.state.armies[fid]=[];A.state.detachments[fid]=[];
 const f=A.faction();
 if(src==='inventory'){const c={};f.units.forEach(u=>{if(rnd()<.35)c[u.id]=1+Math.floor(rnd()*3)});A.state.collections=A.state.collections||{};A.state.collections[fid]=c;}
 const o={limit:lim,archetype:['balanced','shooting','melee','control'][Math.floor(rnd()*4)],source:src,locked:[],seed:Math.floor(rnd()*99)};
 const t=Date.now();let r;try{r=mode==='ga'?await A.runEvolutionAutoList(o):A.runAutoList(o);}catch(e){add('EXCEPTION',`${mode} ${fid} ${lim} ${src}: ${e.stack.split('\n').slice(0,3).join(' | ')}`);continue;}
 const ms=Date.now()-t;maxMs=Math.max(maxMs,ms);if(ms>(mode==='ga'?4000:3000))add('langsam',`${mode} ${fid} ${lim}: ${ms}ms`);
 if(!r||r.ok===false)continue;runs++;
 const ar=A.army();const pts=A.armyPoints();const sum=ar.reduce((s,e)=>s+A.entryPoints(e),0);
 if(pts>lim)add('ÜBER LIMIT',`${mode} ${fid} ${lim}: ${pts}`);
 if(pts!==sum)add('Punkte-Desync',`${mode} ${fid}: armyPoints ${pts} vs Summe ${sum}`);
 if(!Number.isFinite(pts))add('NaN',`${mode} ${fid}`);
 for(const e of ar){const u=A.unitDef(e.unitId);if(!u){add('unbekannte Einheit',fid+' '+e.unitId);continue;}
  if(!(e.sizeIdx>=0&&e.sizeIdx<u.sizes.length))add('ungültige Staffel',`${fid} ${u.name} ${e.sizeIdx}`);
  if(u.role==='transport'&&!ar.some(x=>x.embarkedIn===e.uid))add('leerer Transporter',`${mode} ${fid} ${lim} ${u.name}`);
  if(e.attachedTo&&!ar.some(x=>x.uid===e.attachedTo))add('Anschluss ins Leere',`${fid} ${u.name}`);
  if(e.embarkedIn&&!ar.some(x=>x.uid===e.embarkedIn))add('Fracht ohne Transporter',`${fid} ${u.name}`);}
 if(src==='inventory'){const c=A.state.collections[fid]||{};const cnt={};ar.forEach(e=>cnt[e.unitId]=(cnt[e.unitId]||0)+1);for(const [id,n] of Object.entries(cnt))if(n>(c[id]||0)*2&&!(r.picks||[]).find(p=>p.unitId===id&&p.locked))add('Bestand überschritten?',`${mode} ${fid} ${A.unitDef(id).name} ${n}/${c[id]||0}`);}
 const errs=[...A.validate(),...A.complianceIssues()].filter(x=>x.lvl==='err');if(errs.length)add('Regelfehler',`${mode} ${fid} ${lim}: ${errs.map(x=>x.msg).slice(0,2).join(' | ')}`);
}
console.log('Läufe',N,'gültig',runs,'max',maxMs,'ms');for(const [k,v] of Object.entries(bad))console.log(String(v.length).padStart(4),k,'|',v.slice(0,3).join(' ;; '));})();
