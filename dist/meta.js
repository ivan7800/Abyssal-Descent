import { ARCHETYPES, ENEMY_DEFS, FLOOR_DATA, ITEM_DEFS, SETPIECE_TEXT } from './game/content.js'

export const SAVE_KEY='abyssal-descent-save-v5'
export const CODEX_KEY='abyssal-descent-codex-v1'
export const CODEX_VERSION=1
export const ENDING_TITLES=['ENDING — THE LAST SURVEY','ENDING — THE TRANSLATOR','ENDING — THE OPEN MOUTH','ENDING — BEYOND THE BLACK STAR','SECRET ENDING — THE FIFTH DIRECTION']

export const freshCodex=()=>({version:CODEX_VERSION,enemies:[],items:[],floors:[],notes:[],endings:[],secrets:[]})
const uniq=a=>[...new Set(a)]
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v)
const strings=v=>Array.isArray(v)&&v.every(x=>typeof x==='string')
export function safeGet(key){try{return typeof localStorage==='undefined'?null:localStorage.getItem(key)}catch{return null}}
export function safeSet(key,value){try{if(typeof localStorage==='undefined')return false;localStorage.setItem(key,value);return true}catch{return false}}
export function safeRemove(key){try{localStorage?.removeItem(key)}catch{}}
export function sanitizeCodex(value){
 if(!isObj(value)||value.version!==CODEX_VERSION)return freshCodex()
 const enemies=strings(value.enemies)?uniq(value.enemies.filter(id=>id in ENEMY_DEFS)):[]
 const items=strings(value.items)?uniq(value.items.filter(id=>id in ITEM_DEFS)):[]
 const floors=Array.isArray(value.floors)?uniq(value.floors.filter(n=>Number.isInteger(n)&&n>=1&&n<=4)).sort((a,b)=>a-b):[]
 const notes=strings(value.notes)?uniq(value.notes.filter(n=>n.length<=800)).slice(-256):[]
 const endings=strings(value.endings)?uniq(value.endings.filter(n=>ENDING_TITLES.includes(n))):[]
 const secrets=strings(value.secrets)?uniq(value.secrets.filter(n=>/^setpiece-[1-4]-[01]$/.test(n))):[]
 return {version:CODEX_VERSION,enemies,items,floors,notes,endings,secrets}
}
export function loadCodex(){try{const raw=safeGet(CODEX_KEY);return raw?sanitizeCodex(JSON.parse(raw)):freshCodex()}catch{return freshCodex()}}
export function saveCodex(codex){return safeSet(CODEX_KEY,JSON.stringify(sanitizeCodex(codex)))}
export function mergeCodex(a,b){const x=sanitizeCodex(a),y=sanitizeCodex(b);return sanitizeCodex({version:CODEX_VERSION,enemies:[...x.enemies,...y.enemies],items:[...x.items,...y.items],floors:[...x.floors,...y.floors],notes:[...x.notes,...y.notes],endings:[...x.endings,...y.endings],secrets:[...x.secrets,...y.secrets]})}
function enemyIdFromView(view){if(!view?.name)return null;const raw=String(view.name).replace(/^Scarred /,'').replace(/^Elite /,'');return Object.keys(ENEMY_DEFS).find(id=>ENEMY_DEFS[id].name===raw)??null}
export function updateCodexFromSnapshot(current,snapshot){
 const next=sanitizeCodex(current), add=(key,val)=>{if(val!==null&&val!==undefined&&!next[key].includes(val))next[key].push(val)}
 if(snapshot?.mode&&snapshot.mode!=='title'&&Number.isInteger(snapshot.floor))add('floors',snapshot.floor)
 for(const item of snapshot?.inventory??[])if(item?.defId in ITEM_DEFS)add('items',item.defId)
 for(const note of snapshot?.journal??[])if(typeof note==='string'&&note.length<=800)add('notes',note)
 const enemy=enemyIdFromView(snapshot?.enemy);if(enemy)add('enemies',enemy)
 if(snapshot?.mode==='ending'&&snapshot.endingTitle&&snapshot.endingTitle!=='THE HEART WAITS'&&ENDING_TITLES.includes(snapshot.endingTitle))add('endings',snapshot.endingTitle)
 for(const [floor,pieces] of Object.entries(SETPIECE_TEXT))for(let i=0;i<pieces.length;i++)if((snapshot?.journal??[]).some(n=>n.startsWith(`${pieces[i].title} —`)))add('secrets',`setpiece-${floor}-${i}`)
 return sanitizeCodex(next)
}
const finite=v=>typeof v==='number'&&Number.isFinite(v)
const integer=v=>typeof v==='number'&&Number.isInteger(v)
const point=v=>isObj(v)&&integer(v.x)&&integer(v.y)
const stringArray=v=>Array.isArray(v)&&v.every(x=>typeof x==='string')
const layout=v=>{if(!isObj(v)||!Array.isArray(v.map)||!v.map.every(row=>typeof row==='string'&&row.length>0))return false;const width=v.map[0]?.length??0;if(!width||!v.map.every(row=>row.length===width&&/^[.#]+$/.test(row)))return false;const points=x=>Array.isArray(x)&&x.every(point);return point(v.start)&&point(v.exit)&&point(v.sanctuary)&&(v.npc===null||point(v.npc))&&(v.miniboss===null||point(v.miniboss))&&points(v.enemySpawns)&&points(v.lootSpawns)&&points(v.eventSpawns)&&points(v.altars)&&points(v.setpieces)}
const runStats=v=>isObj(v)&&['kills','bossesDefeated','elitesDefeated','damageDealt','damageTaken','itemsUsed','retreats','rests'].every(k=>finite(v[k])&&v[k]>=0)
const inventory=v=>Array.isArray(v)&&v.every(item=>isObj(item)&&typeof item.instanceId==='string'&&typeof item.defId==='string'&&item.defId in ITEM_DEFS&&typeof item.name==='string'&&['weapon','charm','consumable','quest'].includes(String(item.kind))&&typeof item.description==='string')
const enemies=v=>Array.isArray(v)&&v.every(enemy=>isObj(enemy)&&typeof enemy.id==='string'&&typeof enemy.kind==='string'&&enemy.kind in ENEMY_DEFS&&integer(enemy.x)&&integer(enemy.y)&&finite(enemy.hp)&&finite(enemy.maxHp)&&typeof enemy.defeated==='boolean'&&typeof enemy.boss==='boolean'&&integer(enemy.combatTurn))
const loot=v=>Array.isArray(v)&&v.every(x=>isObj(x)&&integer(x.x)&&integer(x.y)&&typeof x.defId==='string'&&x.defId in ITEM_DEFS&&typeof x.taken==='boolean')
export function validSaveEnvelope(v){
 if(!isObj(v)||v.version!==5||!['playing','ending'].includes(String(v.mode)))return false
 if(typeof v.seed!=='string'||v.seed.length>48||typeof v.archetype!=='string'||!(v.archetype in ARCHETYPES)||!integer(v.floor)||v.floor<1||v.floor>4||!integer(v.level)||v.level<1||!finite(v.xp))return false
 if(!layout(v.layout)||!isObj(v.player)||!integer(v.player.x)||!integer(v.player.y)||!integer(v.player.dir)||v.player.dir<0||v.player.dir>3)return false
 if(![v.hp,v.maxHp,v.baseMaxSanity,v.sanity,v.steps,v.itemSerial,v.turnSerial,v.abilityCooldown,v.secretCount].every(finite)||v.maxHp<=0||v.baseMaxSanity<=0||v.hp<0||v.hp>v.maxHp||v.sanity<0||v.steps<0||v.itemSerial<0||v.turnSerial<0||v.abilityCooldown<0||v.secretCount<0)return false
 if(!stringArray(v.log)||!stringArray(v.journal)||!inventory(v.inventory)||!enemies(v.enemies)||!loot(v.loot)||![v.triggeredEvents,v.questFlags,v.discovered,v.setpieceTriggered].every(stringArray))return false
 if(!Array.isArray(v.sanctuaryUsed)||!v.sanctuaryUsed.every(integer))return false
 if(!(v.activeEnemyId===null||typeof v.activeEnemyId==='string')||!(v.equippedWeaponId===null||typeof v.equippedWeaponId==='string')||!(v.equippedCharmId===null||typeof v.equippedCharmId==='string'))return false
 if(v.activeEnemyId!==null&&!v.enemies.some(e=>e.id===v.activeEnemyId&&!e.defeated))return false
 if(v.equippedWeaponId!==null&&!v.inventory.some(i=>i.instanceId===v.equippedWeaponId&&i.kind==='weapon'))return false
 if(v.equippedCharmId!==null&&!v.inventory.some(i=>i.instanceId===v.equippedCharmId&&i.kind==='charm'))return false
 if(![v.guarded,v.counterReady,v.audioEnabled,v.reducedMotion].every(x=>typeof x==='boolean')||typeof v.endingTitle!=='string'||typeof v.endingText!=='string'||!runStats(v.runStats))return false
 return true
}
export function makeExportBundle(codex,language){
 const raw=safeGet(SAVE_KEY);if(!raw)return {ok:false,reason:'no-save'}
 try{const save=JSON.parse(raw);if(!validSaveEnvelope(save))return {ok:false,reason:'invalid'};return {ok:true,bundle:{format:'abyssal-descent-save',exportVersion:1,gameVersion:'1.4.1',exportedAt:new Date().toISOString(),language:language==='es'?'es':'en',save,codex:sanitizeCodex(codex)}}}catch{return {ok:false,reason:'invalid'}}
}
export function parseImport(text,currentCodex){
 try{const parsed=typeof text==='string'?JSON.parse(text):text;const save=parsed?.format==='abyssal-descent-save'?parsed.save:parsed;if(!validSaveEnvelope(save))return {ok:false,reason:'invalid'};const incoming=parsed?.format==='abyssal-descent-save'?sanitizeCodex(parsed.codex):freshCodex();return {ok:true,save,saveText:JSON.stringify(save),codex:mergeCodex(currentCodex,incoming),language:parsed?.language==='es'||parsed?.language==='en'?parsed.language:null}}catch{return {ok:false,reason:'invalid'}}
}
