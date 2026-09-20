const VERSION='abyssal-descent-v1.4.3-r1'
const CORE=[
  './','./index.html','./bootstrap.js','./styles.css','./v12.css','./v13.css','./v14.css','./main.js','./v12.js','./v13.js','./v14.js','./v13-meta.js','./phaser-lite.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png',
  './game/DungeonScene.js','./game/audio.js','./game/content.js','./game/generator.js','./game/types.js',
  './i18n.js','./meta.js','./i18n/ui.js','./i18n/actors.js','./i18n/items.js','./i18n/world.js','./i18n/fixed-a.js','./i18n/fixed-b.js'
]
const cachePut=async(req,res)=>{if(res?.ok){const c=await caches.open(VERSION);await c.put(req,res.clone())}return res}
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return
  const url=new URL(event.request.url)
  if(url.origin!==location.origin)return
  const codeAsset=/\.(?:js|css|html|webmanifest)$/i.test(url.pathname)
  if(event.request.mode==='navigate'||codeAsset){
    event.respondWith(fetch(event.request).then(r=>cachePut(event.request,r)).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))))
    return
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>cachePut(event.request,r))))
})
