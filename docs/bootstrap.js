const RELEASE='1.5.0'
const RELEASE_KEY='abyssal-descent-release-session'
async function clearStaleWorker(){
  try{
    if(!('serviceWorker' in navigator)||!navigator.serviceWorker.controller)return false
    if(sessionStorage.getItem(RELEASE_KEY)===RELEASE)return false
    sessionStorage.setItem(RELEASE_KEY,RELEASE)
    const regs=await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map(r=>r.unregister()))
    if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('abyssal-descent-')).map(k=>caches.delete(k)))}
    location.reload();return true
  }catch{return false}
}
function fatal(error){
  const root=document.getElementById('root')||document.body
  root.innerHTML=`<section class="boot-error"><h1>Runtime bootstrap error</h1><p>The game could not load all interface layers. Reload the page; if the problem persists, clear the site cache.</p><code>${String(error?.stack||error?.message||error).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</code></section>`
}
try{
  if(!(await clearStaleWorker())){
    await import('./main.js?v=1.5.0')
    if(!window.__abyssal)throw new Error('Core runtime did not initialize')
    await import('./v15-renderer.js?v=1.5.0')
    if(!window.__abyssalV15)throw new Error('Dungeon renderer layer did not initialize')
    await import('./v12.js?v=1.5.0')
    if(!window.__abyssalV12)throw new Error('PWA/Codex layer did not initialize')
    await import('./v13.js?v=1.5.0')
    if(!window.__abyssalV13)throw new Error('Daily/Options layer did not initialize')
    await import('./v14.js?v=1.5.0')
    if(!window.__abyssalV14)throw new Error('Presentation layer did not initialize')
  }
}catch(error){console.error('[Abyssal bootstrap]',error);fatal(error)}
