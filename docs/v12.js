import { ENEMY_DEFS, FLOOR_DATA, ITEM_DEFS, SETPIECE_TEXT } from './game/content.js'
import { getLanguage, localizeEnemy, localizeFloor, localizeItem, translateText } from './i18n.js'
import { CODEX_KEY, ENDING_TITLES, SAVE_KEY, loadCodex, makeExportBundle, parseImport, safeGet, safeRemove, safeSet, saveCodex, updateCodexFromSnapshot } from './meta.js'

const api=window.__abyssal
if(!api)throw new Error('Abyssal v1.2 layer requires the core runtime')

const TEXT={
 en:{tools:'Expedition tools',install:'Install app',export:'Export save',import:'Import save',codex:'Codex',close:'Close',cancel:'Cancel',chooseFile:'Choose a JSON backup',noSave:'No valid expedition save is available to export.',exported:'Portable save exported.',imported:'Save imported. The expedition is ready to resume.',invalid:'That file is not a valid Abyssal Descent save. Your current checkpoint was preserved.',readFail:'The selected file could not be read.',storageFail:'Browser storage is unavailable, so the imported save could not be stored.',installed:'Abyssal Descent is installed.',installUnavailable:'Installation is not available in this browser right now.',offline:'Offline ready',completion:'Codex completion',bestiary:'Bestiary',relics:'Items & relics',acts:'Acts',anomalies:'Anomalies',notes:'Field notes',endings:'Endings',discovered:'discovered',locked:'Undiscovered',none:'Nothing recorded yet.',portable:'Portable saves include expedition, Codex discoveries and language.',meta:'Discoveries persist across expeditions.',act:'Act',objective:'Objective',journal:'Archive',secret:'Anomaly',secretHint:'Find authored anomalies hidden in each act.',notesHint:'Journal discoveries are preserved here across expeditions.'},
 es:{tools:'Herramientas de expedición',install:'Instalar app',export:'Exportar partida',import:'Importar partida',codex:'Códice',close:'Cerrar',cancel:'Cancelar',chooseFile:'Elegir copia JSON',noSave:'No hay una partida de expedición válida para exportar.',exported:'Partida portable exportada.',imported:'Partida importada. La expedición está lista para continuar.',invalid:'El archivo no es una partida válida de Abyssal Descent. Tu checkpoint actual se ha conservado.',readFail:'No se ha podido leer el archivo seleccionado.',storageFail:'El almacenamiento del navegador no está disponible, así que no se pudo guardar la partida importada.',installed:'Abyssal Descent se ha instalado.',installUnavailable:'La instalación no está disponible ahora mismo en este navegador.',offline:'Disponible sin conexión',completion:'Progreso del códice',bestiary:'Bestiario',relics:'Objetos y reliquias',acts:'Actos',anomalies:'Anomalías',notes:'Notas de campo',endings:'Finales',discovered:'descubiertos',locked:'Sin descubrir',none:'Aún no hay nada registrado.',portable:'Las copias portables incluyen expedición, descubrimientos del códice e idioma.',meta:'Los descubrimientos persisten entre expediciones.',act:'Acto',objective:'Objetivo',journal:'Archivo',secret:'Anomalía',secretHint:'Encuentra anomalías diseñadas a mano y ocultas en cada acto.',notesHint:'Los descubrimientos del diario se conservan aquí entre expediciones.'}
}
const t=k=>(TEXT[api.getLanguage?.()||getLanguage()]??TEXT.en)[k]??k
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const currentLang=()=>api.getLanguage?.()||getLanguage()
const tr=v=>translateText(String(v??''),currentLang())

let codex=loadCodex(), installPrompt=null, modal=null, toastTimer=null
const root=document.querySelector('.shell')||document.body
const runbar=document.getElementById('runbar')
const tools=document.createElement('section')
tools.id='v12-tools'; tools.className='v12-tools'; tools.setAttribute('aria-label','Expedition tools')
runbar?.insertAdjacentElement('afterend',tools)

const fileInput=document.createElement('input')
fileInput.type='file';fileInput.accept='application/json,.json';fileInput.hidden=true;fileInput.id='v12-import-file';document.body.append(fileInput)
const toast=document.createElement('div');toast.className='v12-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;document.body.append(toast)

function showToast(message,type='ok'){
 toast.textContent=message;toast.dataset.type=type;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true},4200)
}
function totalProgress(c=codex){const got=c.enemies.length+c.items.length+c.floors.length+c.endings.length+c.secrets.length,total=Object.keys(ENEMY_DEFS).length+Object.keys(ITEM_DEFS).length+4+ENDING_TITLES.length+8;return {got,total,pct:Math.round(got/total*100)}}
function renderTools(){
 const p=totalProgress();const badge=document.getElementById('badge');if(badge)badge.textContent='FINAL · v1.2.0'
 tools.setAttribute('aria-label',t('tools'))
 tools.innerHTML=`<div class="v12-copy"><strong>${esc(t('tools'))}</strong><span>${esc(t('portable'))}</span></div><div class="v12-actions">${installPrompt?`<button data-v12="install">${esc(t('install'))}</button>`:''}<button data-v12="export">${esc(t('export'))}</button><button data-v12="import">${esc(t('import'))}</button><button class="v12-codex-button" data-v12="codex">${esc(t('codex'))} <span>${p.pct}%</span></button></div>`
 if(modal)renderCodex()
}
function discoveredSet(arr){return new Set(arr||[])}
function codexEntries(){
 const lang=currentLang(), enemies=discoveredSet(codex.enemies),items=discoveredSet(codex.items),floors=discoveredSet(codex.floors),endings=discoveredSet(codex.endings),secrets=discoveredSet(codex.secrets)
 const enemyCards=Object.entries(ENEMY_DEFS).map(([id,d])=>{const open=enemies.has(id),loc=localizeEnemy(id,lang)??d;return `<article class="codex-entry ${open?'':'locked'}"><strong>${open?esc(loc.name):'???'}</strong><p>${open?esc(loc.description):esc(t('locked'))}</p></article>`}).join('')
 const itemCards=Object.entries(ITEM_DEFS).map(([id,d])=>{const open=items.has(id),loc=localizeItem(id,lang)??d;return `<article class="codex-entry ${open?'':'locked'}"><strong>${open?esc(loc.name):'???'}</strong><p>${open?esc(loc.description):esc(t('locked'))}</p></article>`}).join('')
 const floorCards=[1,2,3,4].map(n=>{const open=floors.has(n),loc=localizeFloor(n,lang)??FLOOR_DATA[n];return `<article class="codex-entry ${open?'':'locked'}"><strong>${open?esc(loc.name):`${esc(t('act'))} ${n} · ???`}</strong><p>${open?`${esc(t('objective'))}: ${esc(loc.objective)}`:esc(t('locked'))}</p>${open?`<small>${esc(loc.journal)}</small>`:''}</article>`}).join('')
 const secretCards=Object.entries(SETPIECE_TEXT).flatMap(([floor,pieces])=>pieces.map((piece,i)=>{const key=`setpiece-${floor}-${i}`,open=secrets.has(key);return `<article class="codex-entry ${open?'':'locked'}"><strong>${open?esc(tr(piece.title)):`${esc(t('secret'))} ${floor}.${i+1} · ???`}</strong><p>${open?esc(tr(piece.text)):esc(t('locked'))}</p></article>`})).join('')
 const endingCards=ENDING_TITLES.map(title=>`<article class="codex-entry ${endings.has(title)?'':'locked'}"><strong>${endings.has(title)?esc(tr(title)):'???'}</strong><p>${endings.has(title)?esc(tr(title)):esc(t('locked'))}</p></article>`).join('')
 const notes=(codex.notes||[]).slice().reverse().map(note=>`<article class="codex-note">${esc(tr(note))}</article>`).join('')||`<p class="codex-empty">${esc(t('none'))}</p>`
 return {enemyCards,itemCards,floorCards,secretCards,endingCards,notes}
}
function progressLine(label,value,max){const pct=Math.round(value/max*100);return `<div class="codex-progress-row"><span>${esc(label)}</span><strong>${value}/${max} · ${pct}%</strong><div><i style="width:${pct}%"></i></div></div>`}
function renderCodex(){
 if(!modal)return;const p=totalProgress(),e=codexEntries();modal.innerHTML=`<div class="codex-dialog" role="dialog" aria-modal="true" aria-labelledby="codex-title"><header><div><p>${esc(t('meta'))}</p><h2 id="codex-title">${esc(t('codex'))} · ${p.pct}%</h2></div><button data-v12="close-codex" aria-label="${esc(t('close'))}">×</button></header><section class="codex-progress"><h3>${esc(t('completion'))}</h3>${progressLine(t('bestiary'),codex.enemies.length,Object.keys(ENEMY_DEFS).length)}${progressLine(t('relics'),codex.items.length,Object.keys(ITEM_DEFS).length)}${progressLine(t('acts'),codex.floors.length,4)}${progressLine(t('anomalies'),codex.secrets.length,8)}${progressLine(t('endings'),codex.endings.length,ENDING_TITLES.length)}</section><div class="codex-scroll"><section><h3>${esc(t('bestiary'))}</h3><div class="codex-grid">${e.enemyCards}</div></section><section><h3>${esc(t('relics'))}</h3><div class="codex-grid">${e.itemCards}</div></section><section><h3>${esc(t('acts'))}</h3><div class="codex-grid codex-grid-wide">${e.floorCards}</div></section><section><h3>${esc(t('anomalies'))} · ${codex.secrets.length}/8 · ${Math.round(codex.secrets.length/8*100)}%</h3><p class="codex-hint">${esc(t('secretHint'))}</p><div class="codex-grid codex-grid-wide">${e.secretCards}</div></section><section><h3>${esc(t('endings'))}</h3><div class="codex-grid codex-grid-wide">${e.endingCards}</div></section><section><h3>${esc(t('notes'))}</h3><p class="codex-hint">${esc(t('notesHint'))}</p><div class="codex-notes">${e.notes}</div></section></div></div>`
}
function openCodex(){if(modal)return;modal=document.createElement('div');modal.className='codex-modal';document.body.append(modal);renderCodex();modal.querySelector('[data-v12="close-codex"]')?.focus()}
function closeCodex(){modal?.remove();modal=null}
function downloadBundle(){const out=makeExportBundle(codex,currentLang());if(!out.ok){showToast(t('noSave'),'error');return}const blob=new Blob([JSON.stringify(out.bundle,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`abyssal-descent-${out.bundle.save.seed||'expedition'}-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast(t('exported'))}
async function importFile(file){
 let text;try{text=await file.text()}catch{showToast(t('readFail'),'error');return}
 const parsed=parseImport(text,codex);if(!parsed.ok){showToast(t('invalid'),'error');return}
 const previous=safeGet(SAVE_KEY);if(!safeSet(SAVE_KEY,parsed.saveText)){showToast(t('storageFail'),'error');return}
 try{
  api.send('load');const s=api.getState();const accepted=s?.hasSave&&s.seed===parsed.save.seed&&s.archetype===parsed.save.archetype&&s.floor===parsed.save.floor
  if(!accepted)throw new Error('core rejected imported save')
  codex=parsed.codex;saveCodex(codex);if(parsed.language)api.setLanguage(parsed.language);showToast(t('imported'));renderTools()
 }catch{
  if(previous===null)safeRemove(SAVE_KEY);else safeSet(SAVE_KEY,previous);showToast(t('invalid'),'error')
 }
}
async function installApp(){if(!installPrompt){showToast(t('installUnavailable'),'error');return}const prompt=installPrompt;installPrompt=null;renderTools();try{await prompt.prompt();await prompt.userChoice}catch{}}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;renderTools()})
window.addEventListener('appinstalled',()=>{installPrompt=null;renderTools();showToast(t('installed'))})
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),{once:true})

fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];fileInput.value='';if(file)await importFile(file)})
document.addEventListener('click',event=>{
 const btn=event.target.closest?.('[data-v12]');if(btn){const a=btn.dataset.v12;if(a==='install')installApp();else if(a==='export')downloadBundle();else if(a==='import')fileInput.click();else if(a==='codex')openCodex();else if(a==='close-codex')closeCodex();return}
 if(event.target.closest?.('[data-lang]'))setTimeout(renderTools,0)
})
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal)closeCodex()})

const game=api.getGame();if(game?.events?.on)game.events.on('snapshot',snapshot=>{const next=updateCodexFromSnapshot(codex,snapshot);if(JSON.stringify(next)!==JSON.stringify(codex)){codex=next;saveCodex(codex)}renderTools()})
codex=updateCodexFromSnapshot(codex,api.getState());saveCodex(codex);renderTools()

window.__abyssalV12={openCodex,closeCodex,getCodex:()=>structuredClone(codex),exportBundle:()=>makeExportBundle(codex,currentLang()),importText:async text=>{const blob=new Blob([text],{type:'application/json'});blob.name='import.json';await importFile(blob)}}
