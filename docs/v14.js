import { localizeFloor, translateText } from './i18n.js'
import { ACHIEVEMENTS, calculateDailyScore, dailySeed, isDailySeed, loadDaily } from './v13-meta.js'

let api=window.__abyssal
if(!api)api=await new Promise((resolve,reject)=>{let tries=0;const poll=()=>{if(window.__abyssal)return resolve(window.__abyssal);if(++tries>300)return reject(new Error('Abyssal v1.4 layer could not find the core runtime'));setTimeout(poll,5)};poll()})
let v12=window.__abyssalV12
if(!v12)v12=await new Promise((resolve,reject)=>{let tries=0;const poll=()=>{if(window.__abyssalV12)return resolve(window.__abyssalV12);if(++tries>300)return reject(new Error('Abyssal v1.4 layer could not find the v1.2 runtime'));setTimeout(poll,5)};poll()})
let v13=window.__abyssalV13
if(!v13)v13=await new Promise((resolve,reject)=>{let tries=0;const poll=()=>{if(window.__abyssalV13)return resolve(window.__abyssalV13);if(++tries>300)return reject(new Error('Abyssal v1.4 layer could not find the v1.3 runtime'));setTimeout(poll,5)};poll()})

const TEXT={
 en:{subtitle:'A cosmic-horror expedition beneath a drowned observatory.',resume:'Resume expedition',newRun:'New expedition',daily:'Daily Descent',codex:'Codex',achievements:'Achievements',settings:'Options',install:'Installable · Offline ready',meta:'Your discoveries persist between expeditions.',codexProgress:'Codex',achievementProgress:'Achievements',dailyBest:'Daily best',noDaily:'No score today',act:'Act',guardian:'Guardian encountered',phase:'Phase',dailyResult:'Daily Descent complete',score:'Score',steps:'Steps',damage:'Damage taken',secrets:'Secrets',newBest:'New personal best',previousBest:'Previous best',continue:'Continue',back:'Back to title',beginProfile:'Choose your expedition profile',pressAny:'Descend carefully. The abyss remembers.',presentation:'AUDITED · v1.4.2',language:'Language'},
 es:{subtitle:'Una expedición de horror cósmico bajo un observatorio anegado.',resume:'Continuar expedición',newRun:'Nueva expedición',daily:'Descenso diario',codex:'Códice',achievements:'Logros',settings:'Opciones',install:'Instalable · Disponible sin conexión',meta:'Tus descubrimientos persisten entre expediciones.',codexProgress:'Códice',achievementProgress:'Logros',dailyBest:'Mejor Daily',noDaily:'Sin puntuación hoy',act:'Acto',guardian:'Guardián encontrado',phase:'Fase',dailyResult:'Descenso diario completado',score:'Puntuación',steps:'Pasos',damage:'Daño recibido',secrets:'Secretos',newBest:'Nuevo récord personal',previousBest:'Récord anterior',continue:'Continuar',back:'Volver al inicio',beginProfile:'Elige tu perfil de expedición',pressAny:'Desciende con cuidado. El abismo recuerda.',presentation:'AUDITADA · v1.4.2',language:'Idioma'}
}
const lang=()=>api.getLanguage?.()||'en',t=k=>(TEXT[lang()]??TEXT.en)[k]??k,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tr=v=>translateText(String(v??''),lang())
const roman=n=>['I','II','III','IV'][Math.max(0,Math.min(3,(Number(n)||1)-1))]
const shell=document.querySelector('.shell')||document.body
const home=document.createElement('section');home.id='v14-home';home.className='v14-home';document.body.append(home)
const stage=document.createElement('div');stage.id='v14-stage';stage.className='v14-stage';stage.hidden=true;stage.setAttribute('aria-live','polite');document.body.append(stage)
let heroVisible=true,stageTimer=null,previous=api.getState?.()??{},lastBossKey='',lastDailyKey=''

function codexProgress(){const c=v12.getCodex?.()??{},got=(c.enemies?.length||0)+(c.items?.length||0)+(c.floors?.length||0)+(c.endings?.length||0)+(c.secrets?.length||0),total=14+26+4+5+8;return Math.round(got/total*100)}
function achievementProgress(){return v13.getAchievements?.().unlocked?.length||0}
function todayBest(){const key=dailySeed().slice('ABYSS-DAILY-'.length),r=loadDaily()[key];return r?.score??null}
function setBadge(){const badge=document.getElementById('badge');if(badge){badge.textContent='FINAL · v1.4.2';badge.classList.toggle('v13-badge-daily',isDailySeed(api.getState?.().seed))}}
function setHero(show){heroVisible=!!show;renderHome();syncProfileBack();setBadge()}
function renderHome(){
 const s=api.getState?.()??{},show=s.mode==='title'&&heroVisible
 home.hidden=!show
 if(!show)return
 const best=todayBest(),codex=codexProgress(),ach=achievementProgress(),hasSave=!!s.hasSave
 setBadge()
 home.innerHTML=`<div class="v14-veil" aria-hidden="true"><i></i><i></i><i></i></div><div class="v14-home-inner"><div class="v14-brand"><div class="v14-brand-top"><span class="v14-kicker">${esc(t('presentation'))}</span><div class="v14-languages" aria-label="${esc(t('language'))}"><button data-v14="lang-en" aria-pressed="${lang()==='en'}">EN</button><button data-v14="lang-es" aria-pressed="${lang()==='es'}">ES</button></div></div><h1><span>ABYSSAL</span><strong>DESCENT</strong></h1><p>${esc(t('subtitle'))}</p></div><div class="v14-home-actions">${hasSave?`<button class="primary v14-resume" data-v14="resume"><span>${esc(t('resume'))}</span><small>${esc(s.seed||'')}</small></button>`:''}<button class="v14-new" data-v14="new"><span>${esc(t('newRun'))}</span><small>${esc(t('beginProfile'))}</small></button><button data-v14="daily"><span>${esc(t('daily'))}</span><small>${esc(dailySeed())}</small></button><div class="v14-secondary"><button data-v14="codex">${esc(t('codex'))} <b>${codex}%</b></button><button data-v14="achievements">${esc(t('achievements'))} <b>${ach}/${ACHIEVEMENTS.length}</b></button><button data-v14="settings">${esc(t('settings'))}</button></div></div><div class="v14-home-meta"><span>${esc(t('install'))}</span><span>${esc(t('meta'))}</span><span>${esc(t('dailyBest'))}: <b>${best??esc(t('noDaily'))}</b></span></div><p class="v14-whisper">${esc(t('pressAny'))}</p></div>`
}
function syncProfileBack(){
 const panel=document.getElementById('start-panel');if(!panel)return
 let btn=document.getElementById('v14-back')
 if(api.getState?.().mode==='title'&&!heroVisible){if(!btn){btn=document.createElement('button');btn.id='v14-back';btn.className='v14-back';btn.dataset.v14='home';panel.prepend(btn)}btn.textContent=`← ${t('back')}`;panel.classList.add('v14-profile-open')}
 else{btn?.remove();panel.classList.remove('v14-profile-open')}
}
function showStage(kind,title,body='',stats=''){
 clearTimeout(stageTimer);stage.hidden=false;stage.dataset.kind=kind;stage.innerHTML=`<div class="v14-stage-card"><span>${esc(kind)}</span><h2>${esc(title)}</h2>${body?`<p>${esc(body)}</p>`:''}${stats?`<div class="v14-stage-stats">${stats}</div>`:''}</div>`
 const reduced=!!api.getState?.().reducedMotion;stageTimer=setTimeout(()=>{stage.hidden=true},reduced?900:2300)
}
function showAct(snapshot){const loc=localizeFloor(snapshot.floor,lang());showStage(`${t('act')} ${roman(snapshot.floor)}`,loc?.name??tr(snapshot.floorName),loc?.objective??tr(snapshot.objective))}
function showBoss(snapshot){const e=snapshot.enemy;if(!e?.boss)return;showStage(t('guardian'),tr(e.name),`${t('phase')} ${e.phase}/${e.maxPhase}`)}
function maybeDailyResult(snapshot){
 if(!isDailySeed(snapshot?.seed)||snapshot?.mode!=='ending'||!snapshot?.endingTitle||snapshot.endingTitle==='THE HEART WAITS')return
 const key=`${snapshot.seed}|${snapshot.endingTitle}|${snapshot.steps}`;if(key===lastDailyKey)return;lastDailyKey=key
 const score=calculateDailyScore(snapshot),r=snapshot.runStats??{},best=todayBest(),outcome=v13.getLastDailyOutcome?.(),sameOutcome=outcome?.key===key,changed=sameOutcome?!!outcome.changed:best===score,previousBest=sameOutcome?outcome.previousScore:null,items=[[t('score'),score],[t('steps'),snapshot.steps||0],[t('damage'),r.damageTaken||0],[t('secrets'),snapshot.secretCount||0]]
 const stats=items.map(([a,b])=>`<div><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')
 setTimeout(()=>showStage(changed?t('newBest'):t('dailyResult'),tr(snapshot.endingTitle),previousBest!==null&&previousBest!==undefined?`${t('previousBest')}: ${previousBest}`:(!changed&&best!==null?`${t('previousBest')}: ${best}`:''),stats),450)
}
function processSnapshot(snapshot){
 const was=previous||{},modeChanged=was.mode!==snapshot.mode,floorChanged=was.floor!==snapshot.floor
 if(snapshot.mode!=='title')heroVisible=false
 if(snapshot.mode==='title'&&was.mode!=='title')heroVisible=true
 renderHome();syncProfileBack();setBadge()
 if(snapshot.mode!=='title'&&!snapshot.dead&&(floorChanged||modeChanged&&was.mode==='title'))showAct(snapshot)
 const bossKey=snapshot.enemy?.boss?`${snapshot.floor}|${snapshot.enemy.name}|${snapshot.enemy.phase}`:''
 if(snapshot.enemy?.boss&&bossKey&&bossKey!==lastBossKey){lastBossKey=bossKey;showBoss(snapshot)}
 if(!snapshot.enemy)lastBossKey=''
 maybeDailyResult(snapshot);previous=structuredClone(snapshot)
}
function openFromHome(action){if(action==='resume'){api.send('load');setHero(false)}else if(action==='new')setHero(false);else if(action==='daily'){v13.openDaily?.()}else if(action==='codex'){v12.openCodex?.()}else if(action==='achievements'){v13.openAchievements?.()}else if(action==='settings'){v13.openSettings?.()}else if(action==='lang-en'||action==='lang-es'){api.setLanguage?.(action.slice(-2));renderHome();syncProfileBack();setBadge()}else if(action==='home')setHero(true)}

document.addEventListener('click',event=>{const b=event.target.closest?.('[data-v14]');if(b){event.preventDefault();openFromHome(b.dataset.v14);return}if(event.target.closest?.('[data-lang]'))setTimeout(()=>{renderHome();syncProfileBack()},0)})
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&api.getState?.().mode==='title'&&!heroVisible){setHero(true);event.preventDefault();event.stopImmediatePropagation()}},true)
const observer=new MutationObserver(()=>syncProfileBack());observer.observe(shell,{childList:true,subtree:true})
const game=api.getGame?.();game?.events?.on?.('snapshot',processSnapshot)
setBadge()
renderHome();syncProfileBack();setBadge()
window.__abyssalV14={showHome:()=>setHero(true),newExpedition:()=>setHero(false),showAct:()=>showAct(api.getState()),showBoss:()=>showBoss(api.getState()),route:openFromHome,version:'1.4.2'}
