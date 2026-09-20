export const V13_SETTINGS_KEY='abyssal-descent-v13-settings-v1'
export const ACHIEVEMENTS_KEY='abyssal-descent-achievements-v1'
export const DAILY_KEY='abyssal-descent-daily-v1'

export const DEFAULT_BINDINGS=Object.freeze({
  forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',attack:'KeyF',guard:'KeyG',focus:'KeyR',ability:'KeyQ',flee:'KeyX',
})
export const BINDABLE_ACTIONS=Object.freeze(Object.keys(DEFAULT_BINDINGS))
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v)
const safeGet=key=>{try{return localStorage.getItem(key)}catch{return null}}
const safeSet=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}}
const validCode=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Space|Enter|Slash|Semicolon|Quote|Comma|Period|BracketLeft|BracketRight|Backslash|Minus|Equal)$/.test(code)

export function sanitizeSettings(value){
 const src=isObj(value)?value:{}
 const bindings={...DEFAULT_BINDINGS},used=new Set()
 if(isObj(src.bindings))for(const action of BINDABLE_ACTIONS){const code=src.bindings[action];if(validCode(code)&&!used.has(code)){bindings[action]=code;used.add(code)}}
 // Make defaults unique even when an imported/custom value collides with a later default.
 const finalUsed=new Set();for(const action of BINDABLE_ACTIONS){let code=bindings[action];if(finalUsed.has(code)){code=DEFAULT_BINDINGS[action];if(finalUsed.has(code))code=Object.values(DEFAULT_BINDINGS).find(c=>!finalUsed.has(c))??code}bindings[action]=code;finalUsed.add(code)}
 return {version:1,sfxVolume:clamp(Number.isFinite(Number(src.sfxVolume))?Number(src.sfxVolume):0.85,0,1),ambienceVolume:clamp(Number.isFinite(Number(src.ambienceVolume))?Number(src.ambienceVolume):0.7,0,1),textScale:clamp(Number.isFinite(Number(src.textScale))?Number(src.textScale):1,0.9,1.25),bindings}
}
export function loadSettings(){try{return sanitizeSettings(JSON.parse(safeGet(V13_SETTINGS_KEY)||'{}'))}catch{return sanitizeSettings({})}}
export function saveSettings(settings){return safeSet(V13_SETTINGS_KEY,JSON.stringify(sanitizeSettings(settings)))}
export function resetSettings(){const v=sanitizeSettings({});saveSettings(v);return v}

export function dailySeed(date=new Date()){const iso=date.toISOString().slice(0,10);return `ABYSS-DAILY-${iso}`}
export function dailyDateFromSeed(seed){const m=/^ABYSS-DAILY-(\d{4}-\d{2}-\d{2})$/.exec(String(seed||''));if(!m)return null;const d=new Date(`${m[1]}T00:00:00.000Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===m[1]?m[1]:null}
export function isDailySeed(seed){return dailyDateFromSeed(seed)!==null}
export function calculateDailyScore(snapshot){
 const s=snapshot??{},r=s.runStats??{};const completed=s.mode==='ending'&&s.endingTitle&&s.endingTitle!=='THE HEART WAITS'
 const base=completed?10000:Math.max(0,(Number(s.floor)||1)-1)*1600
 return Math.max(0,Math.round(base+(Number(r.bossesDefeated)||0)*1200+(Number(r.elitesDefeated)||0)*180+(Number(r.kills)||0)*45+(Number(s.secretCount)||0)*260+(Number(s.level)||1)*90-(Number(s.steps)||0)*2-(Number(r.damageTaken)||0)*3-(Number(r.retreats)||0)*180))
}
export function loadDaily(){try{const v=JSON.parse(safeGet(DAILY_KEY)||'{}');return isObj(v)?v:{}}catch{return {}}}
export function recordDaily(snapshot){
 const date=dailyDateFromSeed(snapshot?.seed);if(!date)return {changed:false,record:null}
 const all=loadDaily(),score=calculateDailyScore(snapshot),old=isObj(all[date])?all[date]:null
 const run={date,seed:snapshot.seed,score,archetype:String(snapshot.archetype||''),endingTitle:String(snapshot.endingTitle||''),steps:Number(snapshot.steps)||0,recordedAt:new Date().toISOString()}
 const next=old&&Number(old.score)>=score?old:run;all[date]=next;safeSet(DAILY_KEY,JSON.stringify(all));return {changed:next===run,record:next,previous:old}
}

export const ACHIEVEMENTS=Object.freeze([
 {id:'first_blood',icon:'I',name:{en:'First Blood',es:'Primera sangre'},description:{en:'Defeat your first enemy.',es:'Derrota a tu primer enemigo.'}},
 {id:'guardian_felled',icon:'II',name:{en:'Guardian Felled',es:'Guardián abatido'},description:{en:'Defeat a major guardian.',es:'Derrota a un guardián principal.'}},
 {id:'deep_diver',icon:'III',name:{en:'The Fourth Descent',es:'El cuarto descenso'},description:{en:'Reach Act IV.',es:'Alcanza el Acto IV.'}},
 {id:'survivor',icon:'IV',name:{en:'Return From Below',es:'Regreso desde abajo'},description:{en:'Reach any ending.',es:'Alcanza cualquier final.'}},
 {id:'no_retreat',icon:'V',name:{en:'No Step Back',es:'Ni un paso atrás'},description:{en:'Finish an expedition without retreating.',es:'Termina una expedición sin huir.'}},
 {id:'anomaly_hunter',icon:'VI',name:{en:'Pattern Breaker',es:'Rompepatrones'},description:{en:'Discover four anomalies.',es:'Descubre cuatro anomalías.'}},
 {id:'anomaly_scholar',icon:'VII',name:{en:'Eight Impossible Rooms',es:'Ocho salas imposibles'},description:{en:'Discover every authored anomaly.',es:'Descubre todas las anomalías diseñadas.'}},
 {id:'collector',icon:'VIII',name:{en:'Relic Archivist',es:'Archivero de reliquias'},description:{en:'Record every item in the Codex.',es:'Registra todos los objetos en el Códice.'}},
 {id:'bestiary',icon:'IX',name:{en:'Nothing Unnamed',es:'Nada sin nombre'},description:{en:'Record every enemy in the Bestiary.',es:'Registra todos los enemigos en el Bestiario.'}},
 {id:'many_endings',icon:'X',name:{en:'Three Truths',es:'Tres verdades'},description:{en:'Discover three different endings.',es:'Descubre tres finales distintos.'}},
 {id:'all_endings',icon:'XI',name:{en:'Every Door Open',es:'Todas las puertas abiertas'},description:{en:'Discover all five endings.',es:'Descubre los cinco finales.'}},
 {id:'daily_complete',icon:'XII',name:{en:'Marked Calendar',es:'Calendario marcado'},description:{en:'Complete a Daily Descent.',es:'Completa un Descenso diario.'}},
])
const ACH_IDS=new Set(ACHIEVEMENTS.map(a=>a.id))
export function sanitizeAchievements(value){const ids=Array.isArray(value?.unlocked)?[...new Set(value.unlocked.filter(id=>ACH_IDS.has(id)))]:[];const times=isObj(value?.times)?Object.fromEntries(Object.entries(value.times).filter(([id,v])=>ACH_IDS.has(id)&&typeof v==='string').slice(0,ACHIEVEMENTS.length)):{};return {version:1,unlocked:ids,times}}
export function loadAchievements(){try{return sanitizeAchievements(JSON.parse(safeGet(ACHIEVEMENTS_KEY)||'{}'))}catch{return sanitizeAchievements({})}}
export function saveAchievements(value){return safeSet(ACHIEVEMENTS_KEY,JSON.stringify(sanitizeAchievements(value)))}
export function evaluateAchievements(current,snapshot,codex){
 const next=sanitizeAchievements(current),before=new Set(next.unlocked),unlock=id=>{if(!before.has(id)&&ACH_IDS.has(id)){next.unlocked.push(id);next.times[id]=new Date().toISOString();before.add(id)}}
 const r=snapshot?.runStats??{},ending=snapshot?.mode==='ending'&&snapshot?.endingTitle&&snapshot.endingTitle!=='THE HEART WAITS'
 if((Number(r.kills)||0)>=1)unlock('first_blood')
 if((Number(r.bossesDefeated)||0)>=1)unlock('guardian_felled')
 if((Number(snapshot?.floor)||0)>=4)unlock('deep_diver')
 if(ending)unlock('survivor')
 if(ending&&(Number(r.retreats)||0)===0)unlock('no_retreat')
 if((codex?.secrets?.length||0)>=4)unlock('anomaly_hunter')
 if((codex?.secrets?.length||0)>=8)unlock('anomaly_scholar')
 if((codex?.items?.length||0)>=26)unlock('collector')
 if((codex?.enemies?.length||0)>=14)unlock('bestiary')
 if((codex?.endings?.length||0)>=3)unlock('many_endings')
 if((codex?.endings?.length||0)>=5)unlock('all_endings')
 if(ending&&isDailySeed(snapshot?.seed))unlock('daily_complete')
 const previous=sanitizeAchievements(current);const newly=next.unlocked.filter(id=>!previous.unlocked.includes(id));return {state:sanitizeAchievements(next),newly}
}
export function achievementById(id){return ACHIEVEMENTS.find(a=>a.id===id)??null}
export function codeLabel(code,lang='en'){const fixed={Space:lang==='es'?'Espacio':'Space',Enter:'Enter'};if(fixed[code])return fixed[code];if(/^Key[A-Z]$/.test(code))return code.slice(3);if(/^Digit[0-9]$/.test(code))return code.slice(5);if(/^Numpad[0-9]$/.test(code))return `Num ${code.slice(6)}`;return code.replace('BracketLeft','[').replace('BracketRight',']').replace('Backslash','\\').replace('Slash','/').replace('Semicolon',';').replace('Quote',"'").replace('Comma',',').replace('Period','.').replace('Minus','-').replace('Equal','=')}
