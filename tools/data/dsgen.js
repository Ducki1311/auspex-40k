// datasheets.json aus GAME_DATA (game-data-11e.js) erzeugen
const fs=require('fs');const G=require(process.argv[2]);const old=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const fk=[...new Set(old.factions.flatMap(f=>Object.keys(f)))];const ukAll=new Set();old.factions.forEach(f=>f.units.forEach(u=>Object.keys(u).forEach(k=>ukAll.add(k))));
const pick=(o,ks)=>{const r={};ks.forEach(k=>{if(o[k]!==undefined)r[k]=o[k]});return r;};
const out={...old,factions:G.factions.map(f=>{const r=pick(f,fk);r.units=f.units.map(u=>pick(u,[...ukAll]));return r;})};
if(process.argv[5])out.dataDate=process.argv[5];
fs.writeFileSync(process.argv[4],JSON.stringify(out));
