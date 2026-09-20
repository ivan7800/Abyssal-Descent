const api = window.__abyssal
if (!api) throw new Error('Abyssal v2 presentation could not find the core runtime')
const game = api.getGame?.()
if (!game?.scene || !game?.ctx) throw new Error('Abyssal v2 presentation could not find the canvas runtime')
const scene = game.scene
if (!scene.g) await new Promise((resolve, reject) => {
  let tries = 0
  const poll = () => {
    if (scene.g) return resolve()
    if (++tries > 500) return reject(new Error('Abyssal v2 presentation timed out waiting for the dungeon scene'))
    setTimeout(poll, 5)
  }
  poll()
})

const ctx = game.ctx
const W = game.width || 800
const H = game.height || 500
const CENTER_X = W / 2
const HORIZON = 238
const MAX_DEPTH = 7
const DIRS = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]
const legacyDraw = scene.draw.bind(scene)

const palettes = {
  1: {sky:'#11130f', ceil:'#181912', floor:'#0a0b08', wallL:'#211f18', wallR:'#171711', edge:'#766d56', light:'#b49b68', fog:'#10150f', accent:'#a89362'},
  2: {sky:'#10100f', ceil:'#1b1917', floor:'#0b0a09', wallL:'#26201b', wallR:'#1b1714', edge:'#846f57', light:'#c19768', fog:'#17120f', accent:'#b58a60'},
  3: {sky:'#0b0d10', ceil:'#12161b', floor:'#07090c', wallL:'#172027', wallR:'#10161d', edge:'#586f7d', light:'#7994a6', fog:'#0c1015', accent:'#7f9aab'},
  4: {sky:'#100b0b', ceil:'#1d1211', floor:'#0b0707', wallL:'#291816', wallR:'#1a100f', edge:'#81554e', light:'#b66c5f', fog:'#150b0b', accent:'#b86a59'},
}

const clamp = (v,a,b) => Math.max(a, Math.min(b, v))
const rgba = (hex, a=1) => {
  const n = Number.parseInt(String(hex).replace('#',''), 16)
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`
}
const mix = (a,b,t) => {
  const pa = Number.parseInt(a.slice(1),16), pb = Number.parseInt(b.slice(1),16)
  const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255
  const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255
  const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t)
  return `rgb(${r},${g},${bl})`
}
const rngFor = text => {
  let h=2166136261
  for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return () => {h += 0x6D2B79F5; let t=h; t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}
}
const frameAt = depth => {
  const t = Math.pow(.70, depth)
  const halfW = 388 * t + 12
  const halfH = 231 * t + 7
  return {left:CENTER_X-halfW,right:CENTER_X+halfW,top:HORIZON-halfH,bottom:HORIZON+halfH}
}
const frames = Array.from({length:MAX_DEPTH+1},(_,i)=>frameAt(i))

function pathPoly(points){
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath()
}
function fillPoly(points, fill, alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=fill;pathPoly(points);ctx.fill();ctx.restore()}
function strokePoly(points, stroke, width=1, alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=stroke;ctx.lineWidth=width;pathPoly(points);ctx.stroke();ctx.restore()}
function gradientPoly(points, x0,y0,x1,y1, stops){
  ctx.save();pathPoly(points);ctx.clip();const g=ctx.createLinearGradient(x0,y0,x1,y1);for(const [p,c] of stops)g.addColorStop(p,c);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore()
}
function line(x1,y1,x2,y2,color,width=1,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}

function stoneTexture(points, seed, depth, side){
  const r=rngFor(seed), minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]))
  ctx.save();pathPoly(points);ctx.clip()
  const alpha=clamp(.19-depth*.018,.05,.18)
  ctx.strokeStyle=`rgba(177,157,117,${alpha})`;ctx.lineWidth=Math.max(.6,1.4-depth*.09)
  const rows=6
  for(let j=1;j<rows;j++){
    const y=minY+(maxY-minY)*j/rows+(r()-.5)*7
    ctx.beginPath();ctx.moveTo(minX,y);ctx.lineTo(maxX,y+(r()-.5)*4);ctx.stroke()
  }
  const cols=side==='front'?7:4
  for(let i=1;i<cols;i++){
    const x=minX+(maxX-minX)*i/cols+(r()-.5)*9
    ctx.beginPath();ctx.moveTo(x,minY);ctx.lineTo(x+(r()-.5)*7,maxY);ctx.stroke()
  }
  ctx.strokeStyle=`rgba(10,7,6,${.28-depth*.015})`;ctx.lineWidth=1
  for(let i=0;i<4;i++){
    let x=minX+r()*(maxX-minX),y=minY+r()*(maxY-minY)
    ctx.beginPath();ctx.moveTo(x,y)
    for(let k=0;k<4;k++){x+=(r()-.5)*28;y+=8+r()*22;ctx.lineTo(x,y)}
    ctx.stroke()
  }
  ctx.restore()
}

function drawBackdrop(pal){
  const sky=ctx.createLinearGradient(0,0,0,H)
  sky.addColorStop(0,mix(pal.sky,'#000000',.20));sky.addColorStop(.48,pal.sky);sky.addColorStop(.52,pal.floor);sky.addColorStop(1,'#020202')
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H)
  const glow=ctx.createRadialGradient(CENTER_X,HORIZON,18,CENTER_X,HORIZON,430)
  glow.addColorStop(0,rgba(pal.light,.15));glow.addColorStop(.28,rgba(pal.light,.055));glow.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H)
}

function drawSurfaceSegment(near, far, depth, pal, seed){
  const fade=clamp(1-depth*.075,.35,1)
  const ceilPts=[[near.left,near.top],[near.right,near.top],[far.right,far.top],[far.left,far.top]]
  const floorPts=[[near.left,near.bottom],[near.right,near.bottom],[far.right,far.bottom],[far.left,far.bottom]]
  const leftPts=[[near.left,near.top],[far.left,far.top],[far.left,far.bottom],[near.left,near.bottom]]
  const rightPts=[[near.right,near.top],[far.right,far.top],[far.right,far.bottom],[near.right,near.bottom]]
  gradientPoly(ceilPts,0,near.top,0,far.top,[[0,mix(pal.ceil,'#000000',.05)],[1,mix(pal.ceil,'#000000',.48)]])
  gradientPoly(floorPts,0,near.bottom,0,far.bottom,[[0,mix(pal.floor,pal.light,.12)],[1,mix(pal.floor,'#000000',.58)]])
  gradientPoly(leftPts,near.left,0,far.left,0,[[0,mix(pal.wallL,pal.light,.10)],[1,mix(pal.wallL,'#000000',.50)]])
  gradientPoly(rightPts,near.right,0,far.right,0,[[0,mix(pal.wallR,pal.light,.055)],[1,mix(pal.wallR,'#000000',.57)]])
  stoneTexture(leftPts,`${seed}:L:${depth}`,depth,'side');stoneTexture(rightPts,`${seed}:R:${depth}`,depth,'side')
  const edge=mix(pal.edge,'#000000',1-fade)
  line(near.left,near.top,far.left,far.top,edge,Math.max(.8,2.5-depth*.18),.66)
  line(near.left,near.bottom,far.left,far.bottom,edge,Math.max(.8,2.5-depth*.18),.48)
  line(near.right,near.top,far.right,far.top,edge,Math.max(.8,2.5-depth*.18),.58)
  line(near.right,near.bottom,far.right,far.bottom,edge,Math.max(.8,2.5-depth*.18),.42)
  line(far.left,far.bottom,far.right,far.bottom,pal.edge,1,.11+fade*.08)
  line(far.left,far.top,far.right,far.top,pal.edge,1,.09+fade*.06)
}

function drawPortal(side, forward, near, far, pal){
  if(scene.relativeCell(side,forward)==='#')return
  const nH=near.bottom-near.top,fH=far.bottom-far.top
  const nx=side<0?near.left:near.right, fx=side<0?far.left:far.right
  const innerNx=side<0?nx+Math.max(18,(far.left-near.left)*-.22):nx-Math.max(18,(near.right-far.right)*.22)
  const innerFx=side<0?fx+5:fx-5
  const nt=near.top+nH*.17,nb=near.bottom-nH*.10,ft=far.top+fH*.15,fb=far.bottom-fH*.10
  const pts=[[nx,nt],[fx,ft],[innerFx,ft+6],[innerNx,nt+10],[innerNx,nb-7],[innerFx,fb-5],[fx,fb],[nx,nb]]
  fillPoly(pts,'#010101',.97)
  const glow=ctx.createLinearGradient(nx,0,fx,0);glow.addColorStop(0,rgba(pal.accent,.48));glow.addColorStop(1,rgba(pal.accent,.10))
  line(nx,nt,fx,ft,glow,Math.max(1,3-forward*.22),.78);line(nx,nb,fx,fb,pal.edge,Math.max(1,2-forward*.12),.44);line(fx,ft,fx,fb,pal.edge,1,.5)
  if(forward<=2){
    const cx=(nx+fx)/2,cy=(nt+nb+ft+fb)/4
    ctx.save();ctx.fillStyle=rgba(pal.light,.16);ctx.beginPath();ctx.arc(cx,cy,Math.max(2,8-forward*2),0,Math.PI*2);ctx.fill();ctx.restore()
  }
}

function drawFrontWall(frame, depth, pal, seed){
  const pts=[[frame.left,frame.top],[frame.right,frame.top],[frame.right,frame.bottom],[frame.left,frame.bottom]]
  const g=ctx.createRadialGradient(CENTER_X,HORIZON,0,CENTER_X,HORIZON,(frame.right-frame.left)*.7)
  g.addColorStop(0,mix(pal.wallL,pal.light,.13));g.addColorStop(1,mix(pal.wallR,'#000000',.40))
  fillPoly(pts,g,.99);stoneTexture(pts,`${seed}:front:${depth}`,depth,'front');strokePoly(pts,pal.edge,Math.max(1,3.3-depth*.26),.65)
  const w=frame.right-frame.left,h=frame.bottom-frame.top
  if(w>70){
    ctx.save();ctx.translate(CENTER_X,(frame.top+frame.bottom)/2);ctx.strokeStyle=rgba(pal.accent,.11);ctx.lineWidth=1
    const r=Math.min(w,h)*.19;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.55,0,Math.PI*2);ctx.stroke()
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.55,Math.sin(a)*r*.55);ctx.lineTo(Math.cos(a)*r*1.1,Math.sin(a)*r*1.1);ctx.stroke()}
    ctx.restore()
  }
}

function aheadCell(depth){const d=DIRS[scene.player.dir];return{x:scene.player.x+d.x*depth,y:scene.player.y+d.y*depth}}
function drawExitAndObjects(pal, wallDepth){
  for(let depth=1;depth<=MAX_DEPTH;depth++){
    const p=aheadCell(depth);if(scene.layout.map[p.y]?.[p.x]==='#')break
    const f=frames[depth],floorY=f.bottom-3,cx=CENTER_X,scale=Math.max(.18,Math.pow(.72,depth-1))
    if(p.x===scene.layout.exit.x&&p.y===scene.layout.exit.y){
      const ready=scene.floorObjectiveReady(),w=120*scale,h=190*scale,left=cx-w/2,top=floorY-h
      ctx.save();ctx.shadowColor=ready?pal.light:'#6d302a';ctx.shadowBlur=ready?18*scale:8*scale;ctx.strokeStyle=ready?pal.accent:'#72473f';ctx.lineWidth=Math.max(1,5*scale);ctx.strokeRect(left,top,w,h);ctx.shadowBlur=0
      const door=ctx.createLinearGradient(left,0,left+w,0);door.addColorStop(0,'#0b0907');door.addColorStop(.5,ready?mix(pal.wallL,pal.light,.15):'#160d0c');door.addColorStop(1,'#070605');ctx.fillStyle=door;ctx.fillRect(left+4*scale,top+4*scale,w-8*scale,h-4*scale)
      ctx.fillStyle=ready?rgba(pal.light,.75):'rgba(120,55,45,.6)';ctx.beginPath();ctx.arc(cx+w*.28,floorY-h*.48,Math.max(1.5,3*scale),0,Math.PI*2);ctx.fill();ctx.restore()
    }
    const loot=scene.loot.find(l=>!l.taken&&l.x===p.x&&l.y===p.y)
    if(loot){ctx.save();ctx.shadowColor=pal.light;ctx.shadowBlur=22*scale;ctx.fillStyle=pal.light;ctx.beginPath();ctx.arc(cx,floorY-14*scale,6*scale+1,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;line(cx-10*scale,floorY-5*scale,cx+10*scale,floorY-5*scale,pal.accent,1,.65);ctx.restore()}
    const special=(scene.layout.npc&&scene.layout.npc.x===p.x&&scene.layout.npc.y===p.y)||scene.layout.altars.some(q=>q.x===p.x&&q.y===p.y)||scene.layout.setpieces?.some(q=>q.x===p.x&&q.y===p.y)||(scene.layout.sanctuary.x===p.x&&scene.layout.sanctuary.y===p.y)
    if(special){
      ctx.save();ctx.translate(cx,floorY-28*scale);ctx.strokeStyle=rgba(pal.accent,.78);ctx.lineWidth=Math.max(1,2*scale);ctx.shadowColor=pal.light;ctx.shadowBlur=12*scale
      ctx.beginPath();ctx.arc(0,0,14*scale,0,Math.PI*2);ctx.stroke();ctx.rotate(Math.PI/4);ctx.strokeRect(-8*scale,-8*scale,16*scale,16*scale);ctx.restore()
    }
    const enemy=scene.enemies.find(e=>!e.defeated&&e.x===p.x&&e.y===p.y)
    if(enemy)drawEnemySilhouette(enemy.kind,enemy.boss,cx,floorY,scale*.62,pal,.45+.45/depth)
  }
}

function enemyShape(kind, boss, cx, floorY, s){
  ctx.beginPath()
  if(kind==='moth'){
    ctx.moveTo(cx,floorY-95*s);ctx.bezierCurveTo(cx-115*s,floorY-155*s,cx-120*s,floorY-35*s,cx-18*s,floorY-42*s);ctx.lineTo(cx,floorY-110*s);ctx.lineTo(cx+18*s,floorY-42*s);ctx.bezierCurveTo(cx+120*s,floorY-35*s,cx+115*s,floorY-155*s,cx,floorY-95*s)
  }else if(kind==='leech'){
    ctx.ellipse(cx,floorY-42*s,90*s,34*s,0,0,Math.PI*2)
  }else if(kind==='choir'){
    ctx.moveTo(cx-70*s,floorY);ctx.quadraticCurveTo(cx-90*s,floorY-120*s,cx-35*s,floorY-155*s);ctx.quadraticCurveTo(cx,floorY-195*s,cx+35*s,floorY-155*s);ctx.quadraticCurveTo(cx+90*s,floorY-120*s,cx+70*s,floorY);ctx.closePath()
  }else if(kind==='abyss_heart'){
    ctx.ellipse(cx,floorY-95*s,75*s,92*s,0,0,Math.PI*2)
  }else{
    const shoulder=boss?76:58,head=boss?25:20
    ctx.moveTo(cx-shoulder*s,floorY);ctx.lineTo(cx-52*s,floorY-104*s);ctx.quadraticCurveTo(cx-40*s,floorY-146*s,cx-head*s,floorY-155*s);ctx.arc(cx,floorY-171*s,head*s,Math.PI,0);ctx.quadraticCurveTo(cx+40*s,floorY-146*s,cx+52*s,floorY-104*s);ctx.lineTo(cx+shoulder*s,floorY);ctx.closePath()
  }
}
function drawEnemySilhouette(kind,boss,cx,floorY,s,pal,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor=boss?pal.light:'#5c1313';ctx.shadowBlur=(boss?32:16)*s
  const body=ctx.createLinearGradient(cx,floorY-180*s,cx,floorY);body.addColorStop(0,boss?mix(pal.accent,'#d8c19a',.25):'#241b18');body.addColorStop(.35,boss?'#34241d':'#1c1513');body.addColorStop(1,'#050404')
  ctx.fillStyle=body;enemyShape(kind,boss,cx,floorY,s);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=rgba(pal.edge,.75);ctx.lineWidth=Math.max(1,2*s);ctx.stroke()
  if(kind==='abyss_heart'){
    ctx.strokeStyle=rgba(pal.accent,.42);for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*55*s,floorY-95*s+Math.sin(a)*65*s);ctx.bezierCurveTo(cx+Math.cos(a)*90*s,floorY-95*s+Math.sin(a)*85*s,cx+Math.cos(a+.5)*120*s,floorY-40*s,cx+Math.cos(a+.2)*145*s,floorY);ctx.stroke()}
  }
  const eyeY=kind==='leech'?floorY-48*s:floorY-169*s
  ctx.fillStyle=boss?'#e6c37d':'#b95645';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10*s
  const eyeGap=kind==='choir'?28:11;for(const ox of [-eyeGap,eyeGap]){ctx.beginPath();ctx.arc(cx+ox*s,eyeY,Math.max(1.4,3.2*s),0,Math.PI*2);ctx.fill()}
  ctx.restore()
}
function drawActiveEnemy(pal){
  const enemy=scene.activeEnemy?.();if(!enemy)return
  const kind=enemy.kind,boss=enemy.boss
  ctx.save();const aura=ctx.createRadialGradient(CENTER_X,265,10,CENTER_X,265,boss?255:190);aura.addColorStop(0,boss?rgba(pal.light,.17):'rgba(110,25,18,.13)');aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.fillRect(120,30,560,440);ctx.restore()
  drawEnemySilhouette(kind,boss,CENTER_X,430,boss?1.25:1,pal,1)
  if(boss){
    ctx.save();ctx.strokeStyle=rgba(pal.accent,.22);ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(CENTER_X,245,155+i*25,0,Math.PI*2);ctx.stroke()}ctx.restore()
  }
}

function drawAtmosphere(pal, seed){
  const r=rngFor(seed)
  ctx.save();for(let i=0;i<28;i++){
    const x=r()*W,y=40+r()*(H-70),size=.5+r()*1.8,alpha=.025+r()*.08
    ctx.fillStyle=rgba(pal.light,alpha);ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill()
  }ctx.restore()
  const fog=ctx.createLinearGradient(0,150,0,430);fog.addColorStop(0,'rgba(0,0,0,0)');fog.addColorStop(.55,rgba(pal.fog,.08));fog.addColorStop(1,rgba(pal.fog,.30));ctx.fillStyle=fog;ctx.fillRect(0,120,W,380)
  const vignette=ctx.createRadialGradient(CENTER_X,HORIZON,170,CENTER_X,HORIZON,520);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(.68,'rgba(0,0,0,.12)');vignette.addColorStop(1,'rgba(0,0,0,.78)');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H)
  ctx.save();ctx.globalAlpha=.07;ctx.strokeStyle='#d8caaa';ctx.lineWidth=.5;for(let y=0;y<H;y+=4)line(0,y,W,y,'#b9a77e',.35,.05);ctx.restore()
}

function drawPremium(){
  if(scene.mode==='title'||!scene.layout){legacyDraw();return}
  const pal=palettes[scene.floor]||palettes[1]
  const seed=`${scene.seed}:${scene.floor}:${scene.player.x}:${scene.player.y}:${scene.player.dir}:${scene.steps}`
  ctx.save();ctx.clearRect(0,0,W,H);drawBackdrop(pal)
  let wallDepth=MAX_DEPTH+1
  for(let d=1;d<=MAX_DEPTH;d++){if(scene.relativeCell(0,d)==='#'){wallDepth=d;break}}
  const segmentCount=Math.min(MAX_DEPTH,wallDepth)
  for(let d=segmentCount;d>=1;d--){const near=frames[d-1],far=frames[d];drawSurfaceSegment(near,far,d,pal,seed);drawPortal(-1,d-1,near,far,pal);drawPortal(1,d-1,near,far,pal)}
  if(wallDepth<=MAX_DEPTH)drawFrontWall(frames[wallDepth],wallDepth,pal,seed)
  else {const f=frames[MAX_DEPTH];const abyss=ctx.createRadialGradient(CENTER_X,HORIZON,0,CENTER_X,HORIZON,120);abyss.addColorStop(0,rgba(pal.light,.07));abyss.addColorStop(1,'rgba(0,0,0,.98)');fillPoly([[f.left,f.top],[f.right,f.top],[f.right,f.bottom],[f.left,f.bottom]],abyss,.98)}
  drawExitAndObjects(pal,wallDepth);if(scene.activeEnemy?.())drawActiveEnemy(pal)
  drawAtmosphere(pal,seed)
  ctx.restore()
  scene.drawMinimap?.();scene.drawCompass?.();scene.drawCrosshair?.();scene.drawLocalSpecialMarker?.()
  if(scene.hp<=0)scene.drawOverlay?.('LOST TO THE ABYSS','Load your save or begin another expedition')
  else if(scene.mode==='ending')scene.drawOverlay?.(scene.endingTitle,scene.endingTitle==='THE HEART WAITS'?'Your final choice is shown in the expedition panel':'The expedition is complete')
  else scene.clearOverlay?.()
  scene.emit?.()
}

scene.draw = drawPremium
if(scene.mode!=='title'&&scene.layout)scene.draw()

document.body.classList.add('v20-premium')
let prev = api.getState?.()||{}, prevDir=scene.player?.dir, prevEnemy=prev.enemy?.id||null, prevHp=prev.hp
const root=document.documentElement
function setVersion(){const badge=document.getElementById('badge');if(badge)badge.textContent='PREMIUM · v2.0.0';const kicker=document.querySelector('.v14-kicker');if(kicker)kicker.textContent=(api.getLanguage?.()==='es'?'EDICIÓN PREMIUM · v2.0.0':'PREMIUM EDITION · v2.0.0')}
function pulse(cls,ms=360){const el=document.querySelector('.game');if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),ms+40)}
function decorateUI(snapshot){
  root.dataset.abyssAct=String(snapshot.floor||1);document.body.dataset.mode=snapshot.mode||'title';setVersion()
  const stats=document.querySelectorAll('.stats .stat');stats.forEach((el,i)=>{el.classList.toggle('v20-vitality',i===0);el.classList.toggle('v20-sanity',i===1);el.classList.toggle('v20-xp',i===2)})
  const combat=document.querySelector('.combat-actions');if(combat){combat.querySelector('[data-action="attack"]')?.classList.add('v20-attack');combat.querySelector('[data-action="guard"]')?.classList.add('v20-guard');combat.querySelector('[data-action="ability"]')?.classList.add('v20-ability')}
}
game.events.on('snapshot',snapshot=>{
  const dir=scene.player?.dir,pos=snapshot.position
  if(prev.mode!=='title'&&snapshot.mode!=='title'){
    if(dir!==prevDir)pulse('v20-turn',260)
    else if(pos&&prev.position&&pos!==prev.position)pulse('v20-step',300)
    if(snapshot.enemy?.id&&snapshot.enemy.id!==prevEnemy)pulse('v20-encounter',520)
    if(typeof prevHp==='number'&&snapshot.hp<prevHp)pulse('v20-hurt',360)
  }
  prevDir=dir;prevEnemy=snapshot.enemy?.id||null;prevHp=snapshot.hp;prev=snapshot;decorateUI(snapshot)
})

document.addEventListener('click',event=>{
  const b=event.target.closest?.('button');if(!b)return
  if(b.dataset.action==='attack')pulse('v20-strike',220)
  if(b.dataset.action==='ability')pulse('v20-ability-flash',300)
  setTimeout(setVersion,0)
},{capture:true})
setTimeout(()=>decorateUI(api.getState?.()||{}),0)
window.__abyssalV20={version:'2.0.0',renderer:'premium-canvas-dark-fantasy',redraw:()=>scene.draw()}
