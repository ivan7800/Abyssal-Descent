import { getLanguage, translateText } from './i18n.js'

class Emitter {
  constructor(){ this.map=new Map() }
  on(name, fn, ctx){ const a=this.map.get(name)||[]; a.push({fn,ctx,once:false}); this.map.set(name,a); return this }
  once(name, fn, ctx){ const a=this.map.get(name)||[]; a.push({fn,ctx,once:true}); this.map.set(name,a); return this }
  off(name, fn, ctx){ if(!this.map.has(name)) return this; if(!fn){ this.map.delete(name); return this } const a=this.map.get(name).filter(x=>x.fn!==fn || (ctx!==undefined && x.ctx!==ctx)); if(a.length) this.map.set(name,a); else this.map.delete(name); return this }
  emit(name, ...args){ const a=[...(this.map.get(name)||[])]; for(const h of a){ try{ h.fn.apply(h.ctx,args) }catch(err){ console.error(err); window.dispatchEvent(new CustomEvent('abyssal-runtime-error',{detail:err})) } if(h.once) this.off(name,h.fn,h.ctx) } return this }
  removeAll(){ this.map.clear() }
}

const rgba=(color,alpha=1)=>{ const n=Number(color)>>>0; return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})` }

class Graphics {
  constructor(game){ this.game=game; this.ctx=game.ctx; this.fill=rgba(0xffffff,1); this.stroke=rgba(0xffffff,1); this.lineWidth=1 }
  clear(){ this.ctx.clearRect(0,0,this.game.width,this.game.height); return this }
  fillStyle(color,alpha=1){ this.fill=rgba(color,alpha); return this }
  lineStyle(width,color,alpha=1){ this.lineWidth=width; this.stroke=rgba(color,alpha); return this }
  _fill(fn){ const c=this.ctx; c.save(); c.fillStyle=this.fill; fn(c); c.restore(); return this }
  _stroke(fn){ const c=this.ctx; c.save(); c.strokeStyle=this.stroke; c.lineWidth=this.lineWidth; fn(c); c.stroke(); c.restore(); return this }
  fillRect(x,y,w,h){ return this._fill(c=>c.fillRect(x,y,w,h)) }
  strokeRect(x,y,w,h){ const c=this.ctx; c.save(); c.strokeStyle=this.stroke; c.lineWidth=this.lineWidth; c.strokeRect(x,y,w,h); c.restore(); return this }
  fillCircle(x,y,r){ return this._fill(c=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}) }
  strokeCircle(x,y,r){ return this._stroke(c=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2)}) }
  fillEllipse(x,y,w,h){ return this._fill(c=>{c.beginPath();c.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);c.fill()}) }
  strokeLineShape(line){ return this._stroke(c=>{c.beginPath();c.moveTo(line.x1,line.y1);c.lineTo(line.x2,line.y2)}) }
}

function wrapLines(ctx,text,maxWidth){
  const source=String(text??'').split('\n'), out=[]
  for(const part of source){
    if(!maxWidth){ out.push(part); continue }
    const words=part.split(/\s+/); let line=''
    for(const word of words){ const test=line?`${line} ${word}`:word; if(line && ctx.measureText(test).width>maxWidth){out.push(line);line=word}else line=test }
    out.push(line)
  }
  return out
}
class TextObj {
  constructor(game,x,y,text,style={}){ this.game=game; this.x=x; this.y=y; this.text=String(text??''); this.style=style; this.visible=true; this.originX=0; this.originY=0; this.depth=0; game.texts.push(this); game.renderTexts() }
  setDepth(v){this.depth=v;this.game.renderTexts();return this}
  setOrigin(x,y=x){this.originX=x;this.originY=y;this.game.renderTexts();return this}
  setText(t){this.text=String(t??'');this.game.renderTexts();return this}
  setVisible(v){this.visible=!!v;this.game.renderTexts();return this}
}
class Line { constructor(x1,y1,x2,y2){Object.assign(this,{x1,y1,x2,y2})} }
class Scene { constructor(key){ this.sys={settings:{key}}; this.events=new Emitter() } }

class KeyboardManager {
  constructor(){ this.handlers=[] }
  on(name,fn){ if(name!=='keydown') return this; const wrapped=e=>fn(e); document.addEventListener('keydown',wrapped); this.handlers.push(wrapped); return this }
  destroy(){ this.handlers.forEach(h=>document.removeEventListener('keydown',h)); this.handlers=[] }
}

class Game {
  constructor(config){
    this.config=config; this.width=config.width||800; this.height=config.height||500; this.events=new Emitter();
    const parent=typeof config.parent==='string'?document.getElementById(config.parent):config.parent
    if(!parent) throw new Error('Phaser-lite parent element not found')
    this.parent=parent; parent.innerHTML=''; parent.style.position='relative';
    this.canvas=document.createElement('canvas'); this.canvas.width=this.width; this.canvas.height=this.height; this.canvas.className='abyssal-canvas'; this.canvas.setAttribute('aria-label','Dungeon renderer');
    this.canvas.style.width='100%';this.canvas.style.height='auto';this.canvas.style.display='block';this.canvas.style.background=String(config.backgroundColor||'#000');
    this.overlay=document.createElement('canvas');this.overlay.width=this.width;this.overlay.height=this.height;this.overlay.className='abyssal-text-layer';Object.assign(this.overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    parent.append(this.canvas,this.overlay); this.ctx=this.canvas.getContext('2d'); this.octx=this.overlay.getContext('2d'); this.texts=[];
    const SceneCtor=Array.isArray(config.scene)?config.scene[0]:config.scene; this.scene=new SceneCtor();
    const keyboard=new KeyboardManager(); this.keyboard=keyboard;
    Object.assign(this.scene,{game:this,add:{graphics:()=>new Graphics(this),text:(x,y,t,s)=>new TextObj(this,x,y,t,s)},input:{keyboard},cameras:{main:{flash:(dur=100)=>this.flash(dur),shake:(dur=100,intensity=.01)=>this.shake(dur,intensity)}}});
    queueMicrotask(()=>{ try{ this.scene.create?.() }catch(err){ console.error(err); window.dispatchEvent(new CustomEvent('abyssal-runtime-error',{detail:err})) } });
  }
  renderTexts(){
    const c=this.octx;if(!c)return;c.clearRect(0,0,this.width,this.height)
    for(const t of [...this.texts].sort((a,b)=>a.depth-b.depth)){ if(!t.visible) continue; const s=t.style||{}; const size=parseFloat(String(s.fontSize||'16'))||16; const family=s.fontFamily||'sans-serif'; c.save(); c.font=`${size}px ${family}`; c.textBaseline='top'; const max=s.wordWrap?.width||0; const displayText=translateText(t.text,getLanguage()); const lines=wrapLines(c,displayText,max); const lh=size*1.22; const widths=lines.map(line=>c.measureText(line).width); const w=Math.max(0,...widths); const h=Math.max(lh,lines.length*lh); const padX=s.padding?.x||0,padY=s.padding?.y||0; const boxW=w+padX*2,boxH=h+padY*2; const bx=t.x-boxW*t.originX,by=t.y-boxH*t.originY; if(s.backgroundColor){c.fillStyle=s.backgroundColor;c.fillRect(bx,by,boxW,boxH)} c.fillStyle=s.color||'#fff'; c.textAlign=s.align==='center'?'center':'left'; const tx=s.align==='center'?bx+boxW/2:bx+padX; lines.forEach((line,i)=>c.fillText(line,tx,by+padY+i*lh)); c.restore() }
  }
  flash(duration){ this.parent.classList.remove('abyssal-flash'); void this.parent.offsetWidth; this.parent.style.setProperty('--flash-duration',`${duration}ms`); this.parent.classList.add('abyssal-flash'); setTimeout(()=>this.parent.classList.remove('abyssal-flash'),duration+30) }
  shake(duration,intensity){ this.parent.classList.remove('abyssal-shake'); void this.parent.offsetWidth; this.parent.style.setProperty('--shake-duration',`${duration}ms`); this.parent.style.setProperty('--shake-px',`${Math.max(1,Math.round(intensity*500))}px`); this.parent.classList.add('abyssal-shake'); setTimeout(()=>this.parent.classList.remove('abyssal-shake'),duration+30) }
  destroy(){ try{this.scene.events.emit('shutdown')}catch{} this.keyboard?.destroy(); this.events.removeAll(); this.parent.innerHTML='' }
}

const Phaser={AUTO:0,Scene,Game,GameObjects:{Graphics,Text:TextObj},Geom:{Line},Math:{Clamp:(v,min,max)=>Math.max(min,Math.min(max,v))},Scenes:{Events:{SHUTDOWN:'shutdown'}},Scale:{FIT:'FIT',CENTER_BOTH:'CENTER_BOTH'}}
export default Phaser
