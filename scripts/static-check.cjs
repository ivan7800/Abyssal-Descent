const fs=require('fs'),path=require('path')
const root=path.resolve(__dirname,'..'),docs=path.join(root,'docs')
const required=['index.html','main.js','i18n.js','phaser-lite.js','styles.css','game/DungeonScene.js','game/audio.js','game/content.js','game/generator.js']
for(const rel of required){const p=path.join(docs,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`Missing static asset: docs/${rel}`)}
const html=fs.readFileSync(path.join(docs,'index.html'),'utf8')
if(!html.includes('src="./main.js"')||!html.includes('href="./styles.css"'))throw new Error('docs/index.html does not use relative standalone assets')
const rootHtml=fs.readFileSync(path.join(root,'index.html'),'utf8')
if(!rootHtml.includes('./docs/'))throw new Error('Repository-root Pages fallback does not redirect to docs/')
const jsFiles=[]
const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.js'))jsFiles.push(p)}};walk(docs)
const importRe=/(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+)['"]([^'"]+)['"]/g
for(const file of jsFiles){const code=fs.readFileSync(file,'utf8');if(/https?:\/\//.test(code))throw new Error(`Remote runtime URL found in ${path.relative(root,file)}`);let m;while((m=importRe.exec(code))){const spec=m[1];if(!spec.startsWith('.'))throw new Error(`Bare production import '${spec}' in ${path.relative(root,file)}`);const target=path.resolve(path.dirname(file),spec);if(!fs.existsSync(target))throw new Error(`Broken production import ${spec} from ${path.relative(root,file)}`)}}
const main=fs.readFileSync(path.join(docs,'main.js'),'utf8')
if(!main.includes('window.__abyssal'))throw new Error('Production runtime diagnostics hook missing')
const phaser=fs.readFileSync(path.join(docs,'phaser-lite.js'),'utf8')
if(!phaser.includes('class Game')||!phaser.includes('class Graphics')||!phaser.includes('translateText(t.text,getLanguage())'))throw new Error('Standalone canvas runtime/localization layer incomplete')
const sourceScene=fs.readFileSync(path.join(root,'src/game/DungeonScene.ts'),'utf8'),prodScene=fs.readFileSync(path.join(docs,'game/DungeonScene.js'),'utf8')
for(const marker of ['presentEndingChoices','gainSecret','startBoss','useAbility','saveGame','loadGame','drawMinimap'])if(!sourceScene.includes(marker)||!prodScene.includes(marker))throw new Error(`Production parity marker missing: ${marker}`)
console.log('Standalone release check: OK')
console.log(`${required.length} required static assets; ${jsFiles.length} JS modules resolved locally; no runtime CDN dependency`)
