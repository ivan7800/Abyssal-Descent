const path=require('path'); const {pathToFileURL}=require('url')
class FakeClassList{add(){}remove(){}}
class FakeCtx{constructor(){this.ops=0} save(){}restore(){}clearRect(){this.ops++}fillRect(){this.ops++}beginPath(){}arc(){this.ops++}fill(){this.ops++}stroke(){this.ops++}ellipse(){this.ops++}strokeRect(){this.ops++}moveTo(){}lineTo(){this.ops++}measureText(t){return {width:String(t).length*7}}fillText(){this.ops++}}
const ctxs=[]
const documentStub={
 createElement(tag){ if(tag!=='canvas')return {style:{},classList:new FakeClassList()}; const ctx=new FakeCtx();ctxs.push(ctx);return {width:0,height:0,className:'',style:{},setAttribute(){},getContext(){return ctx}} },
 addEventListener(){},removeEventListener(){}
}
const store=new Map(); global.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}
global.document=documentStub; global.CustomEvent=class{constructor(type,init={}){this.type=type;this.detail=init.detail}}
global.window={AudioContext:undefined,webkitAudioContext:undefined,dispatchEvent(){},addEventListener(){},removeEventListener(){}}
const parent={innerHTML:'',style:{setProperty(){}},classList:new FakeClassList(),append(){},offsetWidth:800}
;(async()=>{
 const base=path.resolve(__dirname,'../docs')
 const Phaser=(await import(pathToFileURL(path.join(base,'phaser-lite.js')).href)).default
 const {DungeonScene}=await import(pathToFileURL(path.join(base,'game/DungeonScene.js')).href)
 const {setLanguage,getLanguage}=await import(pathToFileURL(path.join(base,'i18n.js')).href)
 const meta=await import(pathToFileURL(path.join(base,'meta.js')).href)
 const game=new Phaser.Game({parent,width:800,height:500,scene:[DungeonScene],backgroundColor:'#070a08'})
 let last=null; game.events.on('snapshot',s=>{last=s})
 await new Promise(r=>setTimeout(r,0))
 if(!last||last.mode!=='title')throw new Error('Standalone scene did not emit title snapshot on boot')
 setLanguage('es'); game.renderTexts(); if(getLanguage()!=='es'||store.get('abyssal-descent-language-v1')!=='es')throw new Error('Standalone runtime did not persist Spanish language selection')
 setLanguage('en'); game.renderTexts()
 game.events.emit('ui-action','start:surveyor:RUNTIME-SMOKE')
 if(!last||last.mode!=='playing'||last.floor!==1||last.archetype!=='surveyor')throw new Error('Standalone scene could not begin expedition')
 for(const action of ['right','left','save','toggle-motion','toggle-audio'])game.events.emit('ui-action',action)
 if(!last||last.mode!=='playing')throw new Error('Standalone scene lost playable state during smoke actions')
 let codex=meta.updateCodexFromSnapshot(meta.freshCodex(),last)
 if(!codex.floors.includes(1)||codex.items.length<2)throw new Error('Codex did not unlock starting discoveries')
 meta.saveCodex(codex);if(meta.loadCodex().items.length!==codex.items.length)throw new Error('Codex persistence failed')
 const exported=meta.makeExportBundle(codex,'es');if(!exported.ok||exported.bundle.gameVersion!=='1.2.0'||exported.bundle.language!=='es')throw new Error('Portable save export failed')
 const parsed=meta.parseImport(JSON.stringify(exported.bundle),meta.freshCodex());if(!parsed.ok||parsed.save.seed!=='RUNTIME-SMOKE'||!parsed.codex.floors.includes(1))throw new Error('Portable save import parse/merge failed')
 const invalid=meta.parseImport('{bad-json',codex);if(invalid.ok)throw new Error('Malformed portable save was accepted')
 if(!ctxs.some(c=>c.ops>20))throw new Error('Standalone canvas renderer produced no meaningful draw operations')
 game.destroy(true)
 console.log('Standalone runtime smoke: OK')
 console.log(`boot=${last.mode}; floor=${last.floor}; archetype=${last.archetype}; canvasOps=${ctxs.reduce((a,c)=>a+c.ops,0)}`)
})().catch(e=>{console.error(e);process.exit(1)})
