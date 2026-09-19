import { ARCHETYPES, ENEMY_DEFS, FLOOR_DATA, ITEM_DEFS, SETPIECE_TEXT } from './game/content.js'
import { UI_ES, UI_EN } from './i18n/ui.js'
import { ARCH_ES, ENEMY_ES } from './i18n/actors.js'
import { ITEM_ES } from './i18n/items.js'
import { FLOOR_ES, SETPIECE_ES } from './i18n/world.js'
import { FIXED_ES_A } from './i18n/fixed-a.js'
import { FIXED_ES_B } from './i18n/fixed-b.js'

export const LANGUAGE_KEY = 'abyssal-descent-language-v1'
const FIXED_ES = { ...FIXED_ES_A, ...FIXED_ES_B }

for (const [id,a] of Object.entries(ARCHETYPES)) {
  const es=ARCH_ES[id]; for (const k of ['name','blurb','abilityName','abilityDescription','passiveName','passiveDescription']) FIXED_ES[a[k]]=es[k]
}
for (const [id,d] of Object.entries(ITEM_DEFS)) { const es=ITEM_ES[id]; if(es){FIXED_ES[d.name]=es.name;FIXED_ES[d.description]=es.description} }
for (const [id,d] of Object.entries(ENEMY_DEFS)) { const es=ENEMY_ES[id]; if(es){FIXED_ES[d.name]=es.name;FIXED_ES[d.description]=es.description;FIXED_ES[d.intent]=es.intent} }
for (const [n,d] of Object.entries(FLOOR_DATA)) { const es=FLOOR_ES[Number(n)]; FIXED_ES[d.name]=es.name;FIXED_ES[d.objective]=es.objective;FIXED_ES[d.journal]=es.journal }
for (const pieces of Object.values(SETPIECE_TEXT)) for(const p of pieces){if(SETPIECE_ES[p.title])FIXED_ES[p.title]=SETPIECE_ES[p.title];if(SETPIECE_ES[p.text])FIXED_ES[p.text]=SETPIECE_ES[p.text]}

export function getLanguage() {
  try { const saved=typeof localStorage!=='undefined'?localStorage.getItem(LANGUAGE_KEY):null; if(saved==='en'||saved==='es') return saved } catch {}
  try { return typeof navigator!=='undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en' } catch { return 'en' }
}
export function setLanguage(lang){ try{if(typeof localStorage!=='undefined')localStorage.setItem(LANGUAGE_KEY,lang)}catch{}; try{if(typeof document!=='undefined')document.documentElement.lang=lang}catch{} }
export function ui(key,lang){ return lang==='es' ? (UI_ES[key]??key) : UI_EN[key]??key }
export function localizeArchetype(id,lang){ return lang==='es'?ARCH_ES[id]:ARCHETYPES[id] }
export function localizeItem(id,lang){ const d=ITEM_DEFS[id]; return lang==='es'?(ITEM_ES[id]??d):d }
export function localizeEnemy(id,lang){ const d=ENEMY_DEFS[id]; return lang==='es'?(ENEMY_ES[id]??d):d }
export function localizeFloor(floor,lang){ const d=FLOOR_DATA[floor]; return lang==='es'?(FLOOR_ES[floor]??d):d }
export function sanityLabel(s,lang){ if(lang==='en')return s; return ({Stable:'Estable',Uneasy:'Inquieto',Distorted:'Distorsionado',Delirious:'Delirante',Beyond:'Más allá'})[s] }

const trName=(name)=>FIXED_ES[name]??name
export function translateText(text,lang) {
  if(lang==='en'||!text)return text
  if(FIXED_ES[text])return FIXED_ES[text]
  for (const [n,d] of Object.entries(FLOOR_DATA)) {
    if (/^[NESW] ·/.test(text) && text.includes(d.name)) {
      let out=text.replace(d.name,FLOOR_ES[Number(n)]?.name??d.name)
      out=out.replace(/ · SURVEY HERE$/,' · OBJETIVO AQUÍ').replace(/ · SURVEY ([NESW?]) (\d+)$/,' · RUMBO $1 $2')
      return out
    }
  }
  let m
  if((m=text.match(/^You enter the drowned observatory as the (.+)\.$/)))return `Entras en el observatorio ahogado como ${trName(m[1])}.`
  if((m=text.match(/^Expedition seed: (.+)\.$/)))return `Semilla de expedición: ${m[1]}.`
  if((m=text.match(/^You descend into (.+)\.$/)))return `Desciendes a ${trName(m[1])}.`
  if((m=text.match(/^ACT (\d+): (.+)$/)))return `ACTO ${m[1]}: ${translateText(m[2],lang)}`
  if((m=text.match(/^REFUGE (\d+): Someone maintained this lamp recently\. The oil is still warm\.$/)))return `REFUGIO ${m[1]}: Alguien ha mantenido esta lámpara recientemente. El aceite aún está caliente.`
  if((m=text.match(/^The scarred thing you escaped has not forgotten you: (.+) emerges from the dark\. Sanity -(\d+)\.$/)))return `La criatura marcada de la que huiste no te ha olvidado: ${trName(m[1])} emerge de la oscuridad. Cordura -${m[2]}.`
  if((m=text.match(/^A greater shape blocks the passage: (.+) emerges from the dark\. Sanity -(\d+)\.$/)))return `Una forma mayor bloquea el paso: ${trName(m[1])} emerge de la oscuridad. Cordura -${m[2]}.`
  if((m=text.match(/^(.+) emerges from the dark\. Sanity -(\d+)\.$/)))return `${trName(m[1])} emerge de la oscuridad. Cordura -${m[2]}.`
  if((m=text.match(/^Recovered: (.+)\.$/)))return `Recuperado: ${trName(m[1])}.`
  if((m=text.match(/^Hidden cache: (.+)\.$/)))return `Alijo oculto: ${trName(m[1])}.`
  if((m=text.match(/^Five anomalies align into one impossible route\. Hidden relic: (.+)\.$/)))return `Cinco anomalías se alinean formando una ruta imposible. Reliquia oculta: ${trName(m[1])}.`
  if((m=text.match(/^(.+): (.+) Sanity ([+-]?\d+)\.$/))&&FIXED_ES[m[1]])return `${trName(m[1])}: ${translateText(m[2],lang)} Cordura ${m[3]}.`
  if((m=text.match(/^(.*) Sanity ([+-]\d+)\.$/))){const base=translateText(m[1],lang);if(base!==m[1])return `${base} Cordura ${m[2]}.`}
  if((m=text.match(/^You wake hymn altar (\d+)\. A note passes through your bones\. Sanity -2\.$/)))return `Despiertas el altar del himno ${m[1]}. Una nota atraviesa tus huesos. Cordura -2.`
  if((m=text.match(/^Memory (\d+) enters you: the first survey team willingly opened the final seal\. Sanity -3\.$/)))return `El recuerdo ${m[1]} entra en ti: el primer equipo de prospección abrió voluntariamente el sello final. Cordura -3.`
  if((m=text.match(/^Anchor sigil (\d+) locks into one possible geometry\. Sanity -2\.$/)))return `El sigilo de anclaje ${m[1]} se fija en una geometría posible. Cordura -2.`
  if((m=text.match(/^(.+) answers the opened way\.$/)))return `${trName(m[1])} responde al camino abierto.`
  if((m=text.match(/^Critical\. You strike (.+) for (\d+)\.$/)))return `Crítico. Golpeas a ${trName(m[1])} y causas ${m[2]} de daño.`
  if((m=text.match(/^You strike (.+) for (\d+)\.$/)))return `Golpeas a ${trName(m[1])} y causas ${m[2]} de daño.`
  if((m=text.match(/^You count your breaths\. Sanity \+(\d+)\.$/)))return `Cuentas tus respiraciones. Cordura +${m[1]}.`
  if((m=text.match(/^(.+) is not ready\.$/)))return `${trName(m[1])} todavía no está lista.`
  if((m=text.match(/^Measured Strike finds the seam\. (\d+) damage; enemy defense is broken\.$/)))return `Golpe Medido encuentra la abertura. ${m[1]} de daño; la defensa enemiga queda rota.`
  if((m=text.match(/^You speak the Forbidden Word\. Sanity -(\d+); (\d+) damage\.$/)))return `Pronuncias la Palabra Prohibida. Cordura -${m[1]}; ${m[2]} de daño.`
  if((m=text.match(/^(.+) (.+)\. Vitality -(\d+)\.$/))){return `${trName(m[1])} ${translateText(m[2],lang)}. Vitalidad -${m[3]}.`}
  if((m=text.match(/^You counter through the impact for (\d+)\.$/)))return `Contraatacas atravesando el impacto y causas ${m[1]} de daño.`
  if((m=text.match(/^The contact leaves an alien thought behind\. Sanity -(\d+)\.$/)))return `El contacto deja atrás un pensamiento alienígena. Cordura -${m[1]}.`
  if((m=text.match(/^At zero sanity, the corridor hurts you simply by being believed\. Vitality -(\d+)\.$/)))return `Con cero de cordura, el corredor te hiere simplemente porque crees en él. Vitalidad -${m[1]}.`
  if((m=text.match(/^(.+) collapses into stillness\. \+(\d+) XP\.$/)))return `${trName(m[1])} se desploma y queda inmóvil. +${m[2]} PX.`
  if((m=text.match(/^(.+) drinks the aftermath\. Vitality \+(\d+)\.$/)))return `${trName(m[1])} bebe las secuelas. Vitalidad +${m[2]}.`
  if((m=text.match(/^The false reflection breaks\. You recover (.+)\.$/)))return `El reflejo falso se rompe. Recuperas ${trName(m[1])}.`
  if((m=text.match(/^It leaves behind (.+)\.$/)))return `Deja atrás ${trName(m[1])}.`
  if((m=text.match(/^LEVEL (\d+)\. Vitality \+4 max, Sanity \+2 max\. You recover some strength\.$/)))return `NIVEL ${m[1]}. Vitalidad máxima +4, cordura máxima +2. Recuperas parte de tus fuerzas.`
  if((m=text.match(/^You break line of sight and retreat\. (.+) survives scarred and will be stronger if you meet again\.$/)))return `Rompes la línea de visión y te retiras. ${trName(m[1])} sobrevive marcado y será más fuerte si volvéis a encontraros.`
  if((m=text.match(/^Equipped (.+)\.$/)))return `Equipado: ${trName(m[1])}.`
  if((m=text.match(/^(.+) would provide no benefit right now, so you keep it\.$/)))return `${trName(m[1])} no aportaría ningún beneficio ahora mismo, así que lo conservas.`
  if((m=text.match(/^(.+): Vitality \+(\d+)\.$/)))return `${trName(m[1])}: Vitalidad +${m[2]}.`
  if((m=text.match(/^(.+): Sanity ([+-]\d+)\.$/)))return `${trName(m[1])}: Cordura ${m[2]}.`
  if((m=text.match(/^Wake hymn altar (\d+)$/)))return `Despertar altar del himno ${m[1]}`
  if((m=text.match(/^Touch black-star memory (\d+)$/)))return `Tocar recuerdo de la Estrella Negra ${m[1]}`
  if((m=text.match(/^Stabilize anchor sigil (\d+)$/)))return `Estabilizar sigilo de anclaje ${m[1]}`
  if((m=text.match(/^Confront (.+)$/)))return `Enfrentarse a ${trName(m[1])}`
  if((m=text.match(/^(.+) \((\d+)\/(\d+) complete\)$/)))return `${translateText(m[1],lang)} (${m[2]}/${m[3]} completado)`
  if((m=text.match(/^(.+) enters phase (\d+)\. The chamber changes with it\.$/)))return `${trName(m[1])} entra en la fase ${m[2]}. La cámara cambia con él.`
  if((m=text.match(/^(.+) · phase (\d+)\/(\d+)$/)))return `${translateText(m[1],lang)} · fase ${m[2]}/${m[3]}`
  if((m=text.match(/^Scarred (.+)$/)))return `Marcado: ${trName(m[1])}`
  if((m=text.match(/^Elite (.+)$/)))return `Élite: ${trName(m[1])}`
  if((m=text.match(/^ · SURVEY HERE$/)))return ' · OBJETIVO AQUÍ'
  if((m=text.match(/^ · SURVEY ([NESW?]) (\d+)$/)))return ` · RUMBO ${m[1]} ${m[2]}`
  if((m=text.match(/^You drive the Salt Seal into the Heart and the buried architecture begins folding inward\. (Mara reaches the surface behind you, carrying the only surviving map\.|No other survivor follows you into the daylight\.) The observatory is demolished within the month\. You keep one page of your field notes, although the ink rearranges itself whenever it rains\.$/))){const mid=m[1].startsWith('Mara')?'Mara llega a la superficie detrás de ti llevando el único mapa superviviente.':'Ningún otro superviviente te sigue hasta la luz del día.';return `Clavas el Sello de Sal en el Corazón y la arquitectura enterrada empieza a plegarse hacia dentro. ${mid} El observatorio es demolido antes de que termine el mes. Conservas una página de tus notas de campo, aunque la tinta se reorganiza cada vez que llueve.`}
  return text
}
