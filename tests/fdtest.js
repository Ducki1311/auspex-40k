require('./gq_head.js');
const R=A.FactionDriverRegistry;let bad=0,ok=0;const out=[];
for(const id of R.ids()){if(id==='default'||R.get(id).base)continue;const f=A.GAME_DATA.factions.find(x=>x.id===id);if(!f){out.push('Profil ohne Fraktion: '+id);bad++;continue;}
 const p=R.resolve(id,null,f);const names=f.units.map(u=>u.name);const dets=f.detachments.map(d=>d.name.en||d.name);
 const chk=(sel,what)=>{if(!sel||!sel.name)return;const n=names.filter(x=>sel.name.test(x)).length;if(!n){out.push(`${id}: ${what} ${sel.name} trifft keine Einheit`);bad++;}else ok++;};
 p.squadOverrides.forEach(o=>chk(o.sel,'Override'));p.transportMatrix.forEach(r=>{chk(r.transport,'Transporter');chk(r.cargo,'Fracht')});p.leaderSynergies.forEach(r=>{chk(r.leader,'Anführer');chk(r.bodyguard,'Leibwache')});
 p.detachments.forEach(d=>{if(!dets.some(n=>d.det.test(n))&&!f.parent){out.push(`${id}: Detachment-Regel ${d.det} trifft kein Detachment`);bad++;}else ok++;});
 // Leader-Regeln: darf der Anführer die Leibwache laut Daten wirklich führen?
 p.leaderSynergies.forEach(r=>{const L=f.units.filter(u=>r.leader.name&&r.leader.name.test(u.name)),B=f.units.filter(u=>r.bodyguard.name&&r.bodyguard.name.test(u.name));
   if(L.length&&B.length&&!L.some(l=>(l.leads||[]).some(t=>B.some(b=>b.id===t)))){out.push(`${id}: Leader-Regel ${r.leader.name} → ${r.bodyguard.name}: laut Daten keine erlaubte Kombination`);bad++;}});
}
console.log(out.join('\n'));console.log('Profile',R.ids().length,'Prüfungen ok',ok,'Befunde',bad);
