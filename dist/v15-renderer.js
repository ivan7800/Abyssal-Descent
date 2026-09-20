import Phaser from './phaser-lite.js'

const api=window.__abyssal
if(!api)throw new Error('Abyssal v1.5 renderer could not find the core runtime')
const game=api.getGame?.()
if(!game?.scene)throw new Error('Abyssal v1.5 renderer could not find the dungeon scene')
const scene=game.scene
if(!scene.g)await new Promise((resolve,reject)=>{let tries=0;const poll=()=>{if(scene.g)return resolve();if(++tries>400)return reject(new Error('Abyssal v1.5 renderer timed out waiting for scene graphics'));setTimeout(poll,5)};poll()})

const lerp=(a,b,t)=>a+(b-a)*t
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
const frameAt=depth=>{const scale=Math.pow(.79,depth),halfW=382*scale,halfH=226*scale;return{left:400-halfW,right:400+halfW,top:250-halfH,bottom:250+halfH}}
const shadeColor=(color,factor)=>{const r=clamp(Math.round(((color>>16)&255)*factor),0,255),g=clamp(Math.round(((color>>8)&255)*factor),0,255),b=clamp(Math.round((color&255)*factor),0,255);return(r<<16)|(g<<8)|b}

function fillCeiling(g,cur,next,color,alpha=.98,steps=10){
  g.fillStyle(color,alpha)
  for(let i=0;i<steps;i++){const t0=i/steps,t1=(i+1)/steps,tm=(t0+t1)/2,y0=lerp(cur.top,next.top,t0),y1=lerp(cur.top,next.top,t1),left=lerp(cur.left,next.left,tm),right=lerp(cur.right,next.right,tm);g.fillRect(left,y0,Math.max(1,right-left),Math.max(1,y1-y0+1))}
}
function fillFloor(g,cur,next,color,alpha=.99,steps=10){
  g.fillStyle(color,alpha)
  for(let i=0;i<steps;i++){const t0=i/steps,t1=(i+1)/steps,tm=(t0+t1)/2,y0=lerp(next.bottom,cur.bottom,t0),y1=lerp(next.bottom,cur.bottom,t1),left=lerp(next.left,cur.left,tm),right=lerp(next.right,cur.right,tm);g.fillRect(left,y0,Math.max(1,right-left),Math.max(1,y1-y0+1))}
}
function fillSide(g,cur,next,side,color,alpha=.98,steps=12,topPad=0,bottomPad=0){
  g.fillStyle(color,alpha)
  const cH=cur.bottom-cur.top,nH=next.bottom-next.top
  for(let i=0;i<steps;i++){
    const t0=i/steps,t1=(i+1)/steps,tm=(t0+t1)/2
    const x0=side<0?lerp(cur.left,next.left,t0):lerp(cur.right,next.right,t0)
    const x1=side<0?lerp(cur.left,next.left,t1):lerp(cur.right,next.right,t1)
    const top=lerp(cur.top+cH*topPad,next.top+nH*topPad,tm)
    const bottom=lerp(cur.bottom-cH*bottomPad,next.bottom-nH*bottomPad,tm)
    g.fillRect(Math.min(x0,x1)-1,top,Math.max(2,Math.abs(x1-x0)+2),Math.max(1,bottom-top))
  }
}
function drawPortal(s,side,forward,cur,next,shade){
  if(s.relativeCell(side,forward)==='#')return
  const g=s.g,cH=cur.bottom-cur.top,nH=next.bottom-next.top
  const pc={...cur},pn={...next}
  pc.top+=cH*.18;pc.bottom-=cH*.12;pn.top+=nH*.16;pn.bottom-=nH*.12
  fillSide(g,pc,pn,side,0x010302,.99,11)
  const nearX=side<0?cur.left+3:cur.right-3,farX=side<0?next.left+3:next.right-3
  const aY=cur.top+cH*.18,bY=next.top+nH*.16,cY=next.bottom-nH*.12,dY=cur.bottom-cH*.12
  g.lineStyle(Math.max(1,3-forward*.25),shadeColor(0x8aa692,.56+shade*.33),.82)
  g.strokeLineShape(new Phaser.Geom.Line(nearX,aY,farX,bY));g.strokeLineShape(new Phaser.Geom.Line(farX,bY,farX,cY));g.strokeLineShape(new Phaser.Geom.Line(farX,cY,nearX,dY))
  if(forward<=1){g.lineStyle(1,0xb9cdbd,.18);const mx=(nearX+farX)/2;g.strokeLineShape(new Phaser.Geom.Line(mx,(aY+bY)/2,mx,(cY+dY)/2))}
}
function drawFrontWall(s,frame,depth){
  const g=s.g,shade=Math.max(.44,1-depth*.10),w=frame.right-frame.left,h=frame.bottom-frame.top
  g.fillStyle(shadeColor(0x1b2c21,shade),.99).fillRect(frame.left,frame.top,w,h)
  g.lineStyle(Math.max(1,4-depth*.45),shadeColor(0xa0b9a5,.55+shade*.34),.84).strokeRect(frame.left,frame.top,w,h)
  for(let i=1;i<5;i++){const y=frame.top+h*i/5;g.lineStyle(1,0x78917c,.10+(5-i)*.018).strokeLineShape(new Phaser.Geom.Line(frame.left,y,frame.right,y))}
  for(let i=1;i<4;i++){const x=frame.left+w*i/4;g.lineStyle(1,0x657b69,.09).strokeLineShape(new Phaser.Geom.Line(x,frame.top,x,frame.bottom))}
  s.drawGlyphs?.(frame.left,frame.top,w,h)
}
function drawExit(s,maxDepth){
  const d=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}][s.player.dir]
  for(let depth=1;depth<=maxDepth;depth++){
    const x=s.player.x+d.x*depth,y=s.player.y+d.y*depth
    if(s.layout.map[y]?.[x]==='#')break
    if(x!==s.layout.exit.x||y!==s.layout.exit.y)continue
    const f=frameAt(depth),width=Math.max(16,(f.right-f.left)*.22),height=Math.max(28,(f.bottom-f.top)*.52),left=400-width/2,top=f.bottom-height,ready=s.floorObjectiveReady()
    s.g.fillStyle(ready?0x182419:0x1a1210,.78).fillRect(left,top,width,height)
    s.g.lineStyle(Math.max(1,4-depth*.35),ready?0xc8d7aa:0x8b665b,.96).strokeRect(left,top,width,height)
    s.g.lineStyle(1,ready?0xdce6bb:0x8b665b,.30).strokeRect(left+width*.15,top+height*.12,width*.70,height*.76)
    break
  }
}
function drawAheadMarkers(s,maxDepth){
  const dirs=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}],d=dirs[s.player.dir],g=s.g
  for(let depth=1;depth<=maxDepth;depth++){
    const x=s.player.x+d.x*depth,y=s.player.y+d.y*depth
    if(s.layout.map[y]?.[x]==='#')break
    const f=frameAt(depth),cx=(f.left+f.right)/2,floorY=f.bottom-4,width=Math.max(10,(f.right-f.left)*.12)
    const enemy=s.enemies.find(e=>!e.defeated&&e.x===x&&e.y===y)
    if(enemy){const h=Math.max(18,width*(enemy.boss?1.8:1.35));g.fillStyle(enemy.boss?0xd3decf:0xa9bcae,Math.max(.28,.86-depth*.10)).fillEllipse(cx,floorY-h*.44,width,h);g.fillStyle(0x050806,.82).fillCircle(cx-width*.16,floorY-h*.57,Math.max(1.5,width*.045)).fillCircle(cx+width*.16,floorY-h*.57,Math.max(1.5,width*.045))}
    const loot=s.loot.find(l=>!l.taken&&l.x===x&&l.y===y)
    if(loot){const r=Math.max(3,10-depth);g.fillStyle(0xb6cfae,.76).fillCircle(cx,floorY-r*1.8,r);g.lineStyle(1,0xdbe9d8,.65).strokeCircle(cx,floorY-r*1.8,r+3)}
    const special=(s.layout.npc&&s.layout.npc.x===x&&s.layout.npc.y===y)||s.layout.altars.some(p=>p.x===x&&p.y===y)||s.layout.setpieces?.some(p=>p.x===x&&p.y===y)||(s.layout.sanctuary.x===x&&s.layout.sanctuary.y===y)
    if(special){const r=Math.max(5,15-depth*1.5);g.lineStyle(2,0x92b29a,Math.max(.28,.8-depth*.08)).strokeCircle(cx,floorY-r*2,r);g.strokeLineShape(new Phaser.Geom.Line(cx-r,floorY-r*2,cx+r,floorY-r*2))}
  }
}

const originalDraw=scene.draw.bind(scene)
scene.draw=function(){
  if(this.mode==='title'||!this.layout){originalDraw();return}
  const g=this.g,w=800,h=500,maxDepth=6,sanityRatio=this.sanity/Math.max(1,this.maxSanity()),frames=Array.from({length:maxDepth+1},(_,i)=>frameAt(i))
  g.clear();g.fillStyle(0x030604).fillRect(0,0,w,h);g.fillStyle(0x0b1510).fillRect(0,0,w,250);g.fillStyle(0x07100b).fillRect(0,250,w,250)
  for(let band=0;band<6;band++){g.fillStyle(shadeColor(0x152219,.72-band*.07),.30).fillRect(0,band*42,w,42);g.fillStyle(shadeColor(0x102017,.70-band*.06),.24).fillRect(0,h-(band+1)*42,w,42)}
  let wallDepth=maxDepth+1;for(let depth=1;depth<=maxDepth;depth++){if(this.relativeCell(0,depth)==='#'){wallDepth=depth;break}}
  const corridorDepth=Math.min(maxDepth,wallDepth)
  for(let seg=corridorDepth-1;seg>=0;seg--){
    const cur=frames[seg],next=frames[seg+1],shade=Math.max(.30,1-seg*.115)
    fillCeiling(g,cur,next,shadeColor(0x132019,shade*.88),.97);fillFloor(g,cur,next,shadeColor(0x0c1811,shade),.99);fillSide(g,cur,next,-1,shadeColor(0x1a2b20,shade),.98);fillSide(g,cur,next,1,shadeColor(0x14241a,shade*.91),.98)
    drawPortal(this,-1,seg,cur,next,shade);drawPortal(this,1,seg,cur,next,shade)
    const edge=shadeColor(0x78977f,.42+shade*.45);g.lineStyle(Math.max(1,3-seg*.27),edge,.66);g.strokeLineShape(new Phaser.Geom.Line(cur.left,cur.top,next.left,next.top));g.strokeLineShape(new Phaser.Geom.Line(cur.right,cur.top,next.right,next.top));g.strokeLineShape(new Phaser.Geom.Line(cur.left,cur.bottom,next.left,next.bottom));g.strokeLineShape(new Phaser.Geom.Line(cur.right,cur.bottom,next.right,next.bottom));g.lineStyle(1,0x8ba48f,.12+shade*.16);g.strokeLineShape(new Phaser.Geom.Line(next.left,next.bottom,next.right,next.bottom));g.strokeLineShape(new Phaser.Geom.Line(next.left,next.top,next.right,next.top))
  }
  if(wallDepth<=maxDepth)drawFrontWall(this,frames[wallDepth],wallDepth);else{const far=frames[maxDepth];g.fillStyle(0x010302,.95).fillRect(far.left,far.top,far.right-far.left,far.bottom-far.top);g.lineStyle(1,0x749079,.24).strokeRect(far.left,far.top,far.right-far.left,far.bottom-far.top)}
  const detailSeed=`${this.seed}:corridor-detail:${this.floor}:${this.player.x}:${this.player.y}:${this.player.dir}`
  let hash=2166136261;for(const ch of detailSeed){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)};const rnd=()=>{hash+=0x6d2b79f5;let t=hash;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
  for(let i=0;i<9;i++){const y=292+rnd()*176,half=40+rnd()*260,x=400+(rnd()-.5)*Math.max(20,600-(y-292)*2.2);g.lineStyle(1,0x94ad99,.035+rnd()*.07).strokeLineShape(new Phaser.Geom.Line(x-half*.12,y,x+half*.12,y+(rnd()-.5)*4))}
  drawAheadMarkers(this,maxDepth);drawExit(this,maxDepth);this.drawCrosshair();this.drawMinimap();this.drawCompass();if(this.activeEnemy())this.drawEnemy(this.activeEnemy().kind,this.activeEnemy().boss);else this.drawHallucinations(sanityRatio);this.drawLocalSpecialMarker();this.drawSetpieceAura()
  if(sanityRatio<=.2){g.lineStyle(1,0xb4cdb8,.09);for(let i=0;i<24;i++){const y=(i*47+this.steps*13)%500;g.strokeLineShape(new Phaser.Geom.Line(0,y,800,y+((i%5)-2)))}}
  if(this.hp<=0)this.drawOverlay('LOST TO THE ABYSS','Load your save or begin another expedition');else if(this.mode==='ending')this.drawOverlay(this.endingTitle,this.endingTitle==='THE HEART WAITS'?'Your final choice is shown in the expedition panel':'The expedition is complete');else this.clearOverlay();this.emit()
}

if(scene.mode!=='title'&&scene.layout)scene.draw()
window.__abyssalV15={version:'1.5.0',renderer:'filled-pseudo3d',frameAt}
