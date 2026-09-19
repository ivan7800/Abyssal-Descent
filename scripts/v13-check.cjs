const assert=require('assert'),path=require('path');const {pathToFileURL}=require('url')
const store=new Map();global.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}
;(async()=>{
 const root=path.resolve(__dirname,'..'),m=await import(pathToFileURL(path.join(root,'docs/v13-meta.js')).href+`?t=${Date.now()}`)
 const defaults=m.loadSettings();assert.equal(defaults.sfxVolume,.85);assert.equal(defaults.ambienceVolume,.7);assert.equal(defaults.bindings.forward,'KeyW')
 const custom=m.sanitizeSettings({sfxVolume:2,ambienceVolume:-1,textScale:2,bindings:{forward:'KeyQ',ability:'KeyQ',attack:'KeyZ'}})
 assert.equal(custom.sfxVolume,1);assert.equal(custom.ambienceVolume,0);assert.equal(custom.textScale,1.25);assert.equal(new Set(Object.values(custom.bindings)).size,Object.keys(custom.bindings).length,'Bindings must remain unique')
 assert.equal(m.dailySeed(new Date('2026-09-19T23:59:59Z')),'ABYSS-DAILY-2026-09-19');assert(m.isDailySeed('ABYSS-DAILY-2026-09-19'));assert(!m.isDailySeed('RANDOM'))
 const snapshot={mode:'ending',endingTitle:'ENDING — TEST',seed:'ABYSS-DAILY-2026-09-19',floor:4,level:7,steps:320,secretCount:5,archetype:'surveyor',runStats:{kills:12,bossesDefeated:4,elitesDefeated:2,damageTaken:40,retreats:0}}
 assert(m.calculateDailyScore(snapshot)>10000,'Completed daily score should reward completion')
 const codex={secrets:Array(8).fill(0).map((_,i)=>`s${i}`),items:Array(26).fill(0).map((_,i)=>`i${i}`),enemies:Array(14).fill(0).map((_,i)=>`e${i}`),endings:Array(5).fill(0).map((_,i)=>`x${i}`)}
 const result=m.evaluateAchievements({version:1,unlocked:[],times:{}},snapshot,codex)
 for(const id of ['first_blood','guardian_felled','deep_diver','survivor','no_retreat','anomaly_hunter','anomaly_scholar','collector','bestiary','many_endings','all_endings','daily_complete'])assert(result.state.unlocked.includes(id),`Achievement did not unlock: ${id}`)
 assert.equal(m.ACHIEVEMENTS.length,12);assert.equal(m.codeLabel('KeyQ','es'),'Q');assert.equal(m.codeLabel('Space','es'),'Espacio')
 const rec=m.recordDaily(snapshot);assert(rec.record&&rec.record.seed===snapshot.seed);assert(m.loadDaily()['2026-09-19'])
 console.log('v1.3 product systems: OK (split audio settings, remappable keys, UTC daily seed, scoring, 12 achievements)')
})().catch(e=>{console.error(e);process.exit(1)})
