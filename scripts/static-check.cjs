const fs=require('fs'),path=require('path')
const root=path.resolve(__dirname,'..'),docs=path.join(root,'docs')
const required=['index.html','main.js','v12.js','v12.css','v13.js','v13-meta.js','v13.css','v14.js','v14.css','i18n.js','meta.js','phaser-lite.js','styles.css','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png','game/DungeonScene.js','game/audio.js','game/content.js','game/generator.js']
for(const rel of required){const p=path.join(docs,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`Missing static asset: docs/${rel}`)}
const html=fs.readFileSync(path.join(docs,'index.html'),'utf8')
if(!html.includes('src="./main.js"')||!html.includes('src="./v12.js"')||!html.includes('src="./v13.js"')||!html.includes('href="./styles.css"')||!html.includes('href="./v12.css"')||!html.includes('href="./v13.css"')||!html.includes('src="./v14.js"')||!html.includes('href="./v14.css"'))throw new Error('docs/index.html does not use the complete relative standalone asset set')
if(!html.includes('rel="manifest"')||!html.includes('./manifest.webmanifest'))throw new Error('PWA manifest link missing from docs/index.html')
const manifest=JSON.parse(fs.readFileSync(path.join(docs,'manifest.webmanifest'),'utf8'));if(manifest.start_url!=='./'||manifest.scope!=='./'||manifest.display!=='standalone')throw new Error('PWA manifest must use relative Pages-safe scope/start URL and standalone display');if(!Array.isArray(manifest.icons)||manifest.icons.length<2)throw new Error('PWA manifest icons incomplete')
const sw=fs.readFileSync(path.join(docs,'sw.js'),'utf8');for(const marker of ['abyssal-descent-v1.4.0','caches.open','skipWaiting','clients.claim'])if(!sw.includes(marker))throw new Error(`Service worker missing ${marker}`)
const coreMatch=sw.match(/const CORE=\[([\s\S]*?)\]/);if(!coreMatch)throw new Error('Service worker CORE cache list missing');for(const rel of [...coreMatch[1].matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]).filter(Boolean)){if(!fs.existsSync(path.join(docs,rel)))throw new Error(`Service worker caches missing asset: ${rel}`)}
const rootHtml=fs.readFileSync(path.join(root,'index.html'),'utf8')
if(!rootHtml.includes('./docs/'))throw new Error('Repository-root Pages fallback does not redirect to docs/')
const jsFiles=[]
const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.js'))jsFiles.push(p)}};walk(docs)
const importRe=/(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+)['"]([^'"]+)['"]/g
for(const file of jsFiles){const code=fs.readFileSync(file,'utf8');if(/https?:\/\//.test(code))throw new Error(`Remote runtime URL found in ${path.relative(root,file)}`);let m;while((m=importRe.exec(code))){const spec=m[1];if(!spec.startsWith('.'))throw new Error(`Bare production import '${spec}' in ${path.relative(root,file)}`);const target=path.resolve(path.dirname(file),spec);if(!fs.existsSync(target))throw new Error(`Broken production import ${spec} from ${path.relative(root,file)}`)}}
const main=fs.readFileSync(path.join(docs,'main.js'),'utf8')
if(!main.includes('window.__abyssal'))throw new Error('Production runtime diagnostics hook missing')
const v12=fs.readFileSync(path.join(docs,'v12.js'),'utf8')
for(const marker of ['data-v12="export"','data-v12="import"','data-v12="codex"','beforeinstallprompt','makeExportBundle','parseImport',"serviceWorker.register('./sw.js')",'updateCodexFromSnapshot'])if(!v12.includes(marker))throw new Error(`v1.2 UI/PWA marker missing: ${marker}`)

const v13=fs.readFileSync(path.join(docs,'v13.js'),'utf8'),v13meta=fs.readFileSync(path.join(docs,'v13-meta.js'),'utf8'),audio=fs.readFileSync(path.join(docs,'game/audio.js'),'utf8')
for(const marker of ['data-v13="settings"','data-v13="daily"','data-v13="achievements"','ABYSS-DAILY-','evaluateAchievements','setVolumes'])if(!(v13+v13meta+audio).includes(marker))throw new Error(`v1.3 product marker missing: ${marker}`)
if(!audio.includes('sfxMaster')||!audio.includes('ambienceMaster'))throw new Error('Split SFX/ambience audio buses missing')

const phaser=fs.readFileSync(path.join(docs,'phaser-lite.js'),'utf8')
if(!phaser.includes('class Game')||!phaser.includes('class Graphics')||!phaser.includes('translateText(t.text,getLanguage())'))throw new Error('Standalone canvas runtime/localization layer incomplete')
const sourceScene=fs.readFileSync(path.join(root,'src/game/DungeonScene.ts'),'utf8'),prodScene=fs.readFileSync(path.join(docs,'game/DungeonScene.js'),'utf8')
for(const marker of ['presentEndingChoices','gainSecret','startBoss','useAbility','saveGame','loadGame','drawMinimap'])if(!sourceScene.includes(marker)||!prodScene.includes(marker))throw new Error(`Production parity marker missing: ${marker}`)
console.log('Standalone release check: OK')
console.log(`${required.length} required static assets; ${jsFiles.length} JS modules resolved locally; no runtime CDN dependency`)
