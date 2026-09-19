const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const assert = require('assert')

let ts
try { ts = require('typescript') }
catch { ts = require(path.join(execSync('npm root -g').toString().trim(), 'typescript')) }

const root = path.resolve(__dirname, '..')
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
const sceneSource = fs.readFileSync(path.join(root, 'src/game/DungeonScene.ts'), 'utf8')

// Static JSX audit: every rendered button template must be wired to an onClick handler.
const sourceFile = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
let buttonTemplates = 0
let buttonWithoutClick = 0
function visit(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    if (node.tagName.getText(sourceFile) === 'button') {
      buttonTemplates++
      if (!node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(sourceFile) === 'onClick')) buttonWithoutClick++
    }
  }
  ts.forEachChild(node, visit)
}
visit(sourceFile)
assert(buttonTemplates >= 20, `Expected the complete UI button surface, found only ${buttonTemplates} templates`)
assert.equal(buttonWithoutClick, 0, 'Every button template must define onClick')

const expectedLiteralActions = ['ability', 'attack', 'back', 'flee', 'focus', 'forward', 'guard', 'interact', 'left', 'load', 'right', 'save', 'title', 'toggle-audio', 'toggle-motion']
for (const action of expectedLiteralActions) {
  assert(appSource.includes(`send('${action}')`), `App is missing UI action ${action}`)
  assert(sceneSource.includes(`'${action}'`), `DungeonScene is missing handler contract ${action}`)
}
assert(appSource.includes('ending:${choice.id}'), 'Ending choice buttons are not wired')
assert(appSource.includes("'use' : 'equip'"), 'Inventory use/equip button is not wired')
assert(appSource.includes('setArchetype(id)'), 'Archetype selection buttons are not wired')
assert(appSource.includes("setTab('inventory')") && appSource.includes("setTab('journal')"), 'Inventory/journal tabs are not wired')
assert(appSource.indexOf("{state.dead ? (") < appSource.indexOf(") : state.enemy ? ("), 'Death UI must take precedence over combat controls after a lethal enemy turn')
assert(appSource.includes('consumableUseful(item, state)'), 'Consumable buttons must prevent no-benefit item waste')

class Emitter {
  constructor() { this.map = new Map() }
  on(name, fn, ctx) { const arr = this.map.get(name) || []; arr.push({ fn, ctx, once: false }); this.map.set(name, arr); return this }
  once(name, fn, ctx) { const arr = this.map.get(name) || []; arr.push({ fn, ctx, once: true }); this.map.set(name, arr); return this }
  off(name, fn, ctx) { const arr = this.map.get(name) || []; this.map.set(name, arr.filter(x => x.fn !== fn || (ctx !== undefined && x.ctx !== ctx))); return this }
  emit(name, ...args) { const arr = [...(this.map.get(name) || [])]; for (const x of arr) { x.fn.apply(x.ctx, args); if (x.once) this.off(name, x.fn, x.ctx) } return this }
}

class Graphics {
  constructor() { this.calls = []; this.fill = null }
  clear() { this.calls.push(['clear']); return this }
  fillStyle(...args) { this.fill = args; this.calls.push(['fillStyle', ...args]); return this }
  lineStyle(...args) { this.calls.push(['lineStyle', ...args]); return this }
  fillRect(...args) { this.calls.push(['fillRect', ...args, this.fill]); return this }
  strokeRect(...args) { this.calls.push(['strokeRect', ...args]); return this }
  fillCircle(...args) { this.calls.push(['fillCircle', ...args]); return this }
  strokeCircle(...args) { this.calls.push(['strokeCircle', ...args]); return this }
  fillEllipse(...args) { this.calls.push(['fillEllipse', ...args]); return this }
  strokeLineShape(...args) { this.calls.push(['strokeLineShape', ...args]); return this }
}
function textObj() {
  return {
    visible: true, text: '',
    setDepth() { return this }, setOrigin() { return this },
    setText(v) { this.text = v; return this }, setVisible(v) { this.visible = v; return this },
  }
}
class Scene {
  constructor() {
    this.game = { events: new Emitter() }
    this.events = new Emitter()
    this._graphics = new Graphics()
    this.add = { graphics: () => this._graphics, text: () => textObj() }
    this.input = { keyboard: { on() {} } }
    this.cameras = { main: { shake() {}, flash() {} } }
  }
}
const Phaser = {
  Scene,
  Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Geom: { Line: class { constructor(...args) { this.args = args } } },
}

let store = new Map()
const normalStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
}
global.localStorage = normalStorage

const moduleCache = new Map()
function loadTs(file) {
  file = path.resolve(root, file)
  if (moduleCache.has(file)) return moduleCache.get(file).exports
  const source = fs.readFileSync(file, 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: file,
  }).outputText
  const mod = { exports: {} }
  moduleCache.set(file, mod)
  const localRequire = id => {
    if (id === 'phaser') return Phaser
    if (id.startsWith('.')) {
      let resolved = path.resolve(path.dirname(file), id)
      if (!path.extname(resolved)) resolved += '.ts'
      return loadTs(path.relative(root, resolved))
    }
    return require(id)
  }
  new Function('exports', 'module', 'require', '__filename', '__dirname', js)(mod.exports, mod, localRequire, file, path.dirname(file))
  return mod.exports
}

const { DungeonScene } = loadTs('src/game/DungeonScene.ts')
const SAVE_KEY = 'abyssal-descent-save-v5'
function makeScene() {
  const scene = new DungeonScene()
  let snapshot = null
  scene.game.events.on('snapshot', value => { snapshot = value })
  scene.create()
  return { scene, snapshot: () => snapshot, action: value => scene.game.events.emit('ui-action', value) }
}

// Start/profile buttons and preference buttons.
for (const archetype of ['surveyor', 'occultist', 'veteran']) {
  store = new Map()
  global.localStorage = normalStorage
  const { snapshot, action } = makeScene()
  assert.equal(snapshot().mode, 'title')
  action(`start:${archetype}:AUDIT-${archetype}%3ASEED`)
  assert.equal(snapshot().mode, 'playing')
  assert.equal(snapshot().archetype, archetype)
  assert.equal(snapshot().seed, `AUDIT-${archetype}:SEED`)
}

let { scene, snapshot, action } = makeScene()
const audioBefore = snapshot().audioEnabled
action('toggle-audio'); assert.equal(snapshot().audioEnabled, !audioBefore)
action('toggle-motion'); assert.equal(snapshot().reducedMotion, true)
action('start:surveyor:AUDIT-NAV')

// Keyboard input must not hijack text fields or modified browser shortcuts.
let prevented = false
const audioState = snapshot().audioEnabled
scene.onKey({ key: 'm', target: { tagName: 'INPUT', isContentEditable: false }, preventDefault() { prevented = true }, ctrlKey: false, metaKey: false, altKey: false })
assert.equal(snapshot().audioEnabled, audioState, 'Typing M in the seed input must not toggle audio')
assert.equal(prevented, false)
scene.onKey({ key: 'm', target: null, preventDefault() { prevented = true }, ctrlKey: true, metaKey: false, altKey: false })
assert.equal(snapshot().audioEnabled, audioState, 'Modified keyboard shortcuts must be left to the browser')
const dirBeforeKey = scene.player.dir
prevented = false
scene.onKey({ key: 'ArrowRight', target: null, preventDefault() { prevented = true }, ctrlKey: false, metaKey: false, altKey: false })
assert(prevented, 'Gameplay arrow keys should prevent page scrolling')
assert.notEqual(scene.player.dir, dirBeforeKey)

// Exploration button actions.
const dirBefore = scene.player.dir
action('left'); assert.notEqual(scene.player.dir, dirBefore)
action('right'); assert.equal(scene.player.dir, dirBefore)
const dirs = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
const start = { x: scene.player.x, y: scene.player.y }
const walkDir = dirs.findIndex(d => scene.layout.map[start.y + d.y]?.[start.x + d.x] === '.')
assert(walkDir >= 0)
scene.player.dir = walkDir
action('forward')
assert.notDeepEqual({ x: scene.player.x, y: scene.player.y }, start)
action('back')
assert.deepEqual({ x: scene.player.x, y: scene.player.y }, start)

// Refuge interaction cannot be accidentally consumed at full resources.
scene.player.x = scene.layout.sanctuary.x; scene.player.y = scene.layout.sanctuary.y
scene.hp = scene.maxHp; scene.sanity = scene.maxSanity()
action('interact')
assert(!scene.sanctuaryUsed.has(scene.floor), 'Full-health interaction must preserve the one-use refuge')
scene.hp = Math.max(1, scene.maxHp - 5); scene.sanity = Math.max(1, scene.maxSanity() - 5)
action('interact')
assert(scene.sanctuaryUsed.has(scene.floor), 'Refuge interaction should work when recovery is useful')

// Inventory equip/use buttons.
const weapon = scene.addItem('bone_sabre')
action(`equip:${weapon.instanceId}`); assert.equal(scene.equippedWeaponId, weapon.instanceId)
const dressing = scene.inventory.find(i => i.defId === 'field_dressing')
scene.hp = Math.max(1, scene.maxHp - 8)
const quantityBefore = dressing.quantity || 1
action(`use:${dressing.instanceId}`)
assert(scene.hp > 1)
assert(!scene.inventory.includes(dressing) || (dressing.quantity || 0) < quantityBefore)

// Full-resource consumables must not be consumed by a stray click/action.
const spare = scene.addItem('field_dressing')
scene.hp = scene.maxHp; scene.sanity = scene.maxSanity()
const spareQuantity = spare.quantity || 1
const usedBefore = scene.runStats.itemsUsed
action(`use:${spare.instanceId}`)
assert.equal(spare.quantity || 1, spareQuantity)
assert.equal(scene.runStats.itemsUsed, usedBefore)

// Combat button actions.
for (const combatAction of ['attack', 'guard', 'focus', 'ability']) {
  ({ scene, snapshot, action } = makeScene())
  action(`start:veteran:AUDIT-COMBAT-${combatAction}`)
  const enemy = scene.enemies.find(e => !e.boss)
  scene.activeEnemyId = enemy.id
  const enemyHp = enemy.hp
  action(combatAction)
  assert.equal(snapshot().mode, 'playing')
  if (combatAction === 'attack') assert(enemy.hp < enemyHp || enemy.defeated)
  if (combatAction === 'ability') assert(scene.abilityCooldown > 0)
}

// Flee button must move one grid step, count it and leave the scarred enemy behind.
;({ scene, snapshot, action } = makeScene())
action('start:surveyor:AUDIT-FLEE')
const fleeEnemy = scene.enemies.find(e => !e.boss && !e.elite)
const neighbor = dirs.map((d, dir) => ({ dir, x: fleeEnemy.x - d.x, y: fleeEnemy.y - d.y })).find(p => scene.layout.map[p.y]?.[p.x] === '.')
assert(neighbor)
scene.player.x = fleeEnemy.x; scene.player.y = fleeEnemy.y; scene.player.dir = neighbor.dir
scene.activeEnemyId = fleeEnemy.id
scene.roll = () => 0
const stepsBeforeFlee = scene.steps
action('flee')
assert.equal(scene.steps, stepsBeforeFlee + 1)
assert.equal(scene.player.x, neighbor.x); assert.equal(scene.player.y, neighbor.y)
assert((fleeEnemy.nemesisRank || 0) >= 1)

// Panic death must stop tile processing: dead explorers cannot pick up loot after dying mid-step.
;({ scene, action } = makeScene())
action('start:occultist:AUDIT-PANIC')
const origin = { x: scene.player.x, y: scene.player.y }
const panicDir = dirs.findIndex(d => scene.layout.map[origin.y + d.y]?.[origin.x + d.x] === '.')
assert(panicDir >= 0)
const d = dirs[panicDir]
scene.player.dir = panicDir; scene.hp = 1; scene.sanity = 0; scene.roll = () => 0
scene.loot = [{ x: origin.x + d.x, y: origin.y + d.y, defId: 'field_dressing', taken: false }]
action('forward')
assert.equal(scene.hp, 0)
assert.equal(scene.loot[0].taken, false, 'Tile rewards must not resolve after panic has killed the player')

// Save/load buttons, dead-save protection, and corrupted-save recovery.
store = new Map(); global.localStorage = normalStorage
;({ scene, snapshot, action } = makeScene())
action('start:occultist:AUDIT-SAVE')
const savedHp = scene.hp
action('save')
const validSave = store.get(SAVE_KEY)
assert(validSave)
scene.hp = 1; action('load'); assert.equal(scene.hp, savedHp)
scene.hp = 0; action('save'); assert.equal(store.get(SAVE_KEY), validSave, 'Dead state must not overwrite the valid checkpoint')
action('title'); assert.equal(snapshot().mode, 'title')
store.set(SAVE_KEY, '{broken-json')
action('load')
assert.equal(store.has(SAVE_KEY), false, 'Unreadable saves should be discarded so Resume is not permanently broken')

// Structurally invalid but valid JSON saves must be rejected before mutating live state.
const hpBeforeMalformedLoad = scene.hp
const floorBeforeMalformedLoad = scene.floor
store.set(SAVE_KEY, JSON.stringify({ version: 5, mode: 'playing', archetype: 'surveyor', seed: 'BROKEN' }))
action('load')
assert.equal(scene.hp, hpBeforeMalformedLoad)
assert.equal(scene.floor, floorBeforeMalformedLoad)
assert.equal(store.has(SAVE_KEY), false, 'Malformed v5 saves should be rejected atomically and discarded')

// Storage-denied browser contexts must keep the game playable.
global.localStorage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') }, removeItem() { throw new Error('denied') } }
;({ scene, snapshot, action } = makeScene())
assert.equal(snapshot().hasSave, false)
action('start:veteran:AUDIT-NOSTORAGE')
assert.equal(snapshot().mode, 'playing')
action('save')
assert(snapshot().log.some(line => line.includes('Local saving is unavailable')))
global.localStorage = normalStorage

// All final decision button branches.
function endingScene(id) {
  store = new Map(); global.localStorage = normalStorage
  const ctx = makeScene(); ctx.action(`start:surveyor:AUDIT-END-${id}`)
  ctx.scene.mode = 'ending'; ctx.scene.endingTitle = 'THE HEART WAITS'; ctx.scene.endingText = 'x'
  if (id === 'enter') ctx.scene.addItem('black_star')
  if (id === 'refuse') { ctx.scene.secretCount = 5; ctx.scene.addItem('mirror_shard') }
  ctx.scene.draw(); ctx.action(`ending:${id}`)
  return ctx.scene.endingTitle
}
assert(endingScene('seal').startsWith('ENDING —'))
assert(endingScene('listen').startsWith('ENDING —'))
assert.equal(endingScene('enter'), 'ENDING — BEYOND THE BLACK STAR')
assert.equal(endingScene('refuse'), 'SECRET ENDING — THE FIFTH DIRECTION')

// The Surveyor bearing must follow traversable path distance, not point through walls.
;({ scene, action } = makeScene())
action('start:surveyor:AUDIT-BEARING')
scene.floor = 1
scene.layout = {
  map: ['#######', '#.#...#', '#...###', '#######'], start: { x: 1, y: 1 }, exit: { x: 5, y: 1 },
  enemySpawns: [], lootSpawns: [], eventSpawns: [], sanctuary: { x: 1, y: 2 }, npc: null, altars: [], miniboss: { x: 3, y: 1 }, setpieces: [],
}
scene.player = { x: 1, y: 1, dir: 1 }
scene.questFlags.delete('salt-seal')
assert.equal(scene.surveyBearing(), ' · SURVEY S 4')

// Perspective regression: a wall one cell away must render larger than a wall three cells away.
function wallRectAt(depth) {
  const ctx = makeScene(); ctx.action('start:surveyor:AUDIT-PROJECTION')
  const row = ['#', '.', '.', '.', '.', '.', '#']
  for (let x = 2; x < 6; x++) row[x] = x === 1 + depth ? '#' : '.'
  ctx.scene.layout = {
    map: ['#######', row.join(''), '#######'], start: { x: 1, y: 1 }, exit: { x: 5, y: 1 }, enemySpawns: [], lootSpawns: [], eventSpawns: [],
    sanctuary: { x: 1, y: 1 }, npc: null, altars: [], miniboss: null, setpieces: [],
  }
  ctx.scene.player = { x: 1, y: 1, dir: 1 }; ctx.scene.enemies = []; ctx.scene.loot = []; ctx.scene.discovered = new Set(['1,1'])
  ctx.scene._graphics.calls = []; ctx.scene.draw()
  return ctx.scene._graphics.calls.filter(c => c[0] === 'fillRect' && c[3] > 100 && c[4] > 100).map(c => ({ x: c[1], y: c[2], w: c[3], h: c[4] })).find(r => r.w < 800)
}
const nearWall = wallRectAt(1); const farWall = wallRectAt(3)
assert(nearWall && farWall)
assert(nearWall.w > farWall.w && nearWall.h > farWall.h, 'Perspective depth must shrink with distance')

// Combat must clear stale special-location labels from the canvas overlay layer.
;({ scene, action } = makeScene())
action('start:surveyor:AUDIT-SPECIAL')
scene.specialText = textObj(); scene.specialText.visible = true
scene.activeEnemyId = scene.enemies[0].id
scene.drawLocalSpecialMarker()
assert.equal(scene.specialText.visible, false)

// Full campaign progression smoke test using the real scene state machine.
store = new Map(); global.localStorage = normalStorage
;({ scene, snapshot, action } = makeScene())
action('start:surveyor:AUDIT-CAMPAIGN')
const beatActiveBoss = () => {
  const boss = scene.activeEnemy()
  assert(boss?.boss, `Expected active boss on Act ${scene.floor}`)
  scene.defeatEnemy(boss)
  assert(scene.questFlags.has(`boss-${scene.floor}-defeated`))
}
const useAllAltars = () => {
  for (const altar of scene.layout.altars) {
    scene.player.x = altar.x; scene.player.y = altar.y
    action('interact')
  }
}
const firstElite = scene.enemies.find(e => e.id === 'salt-warden-elite')
assert(firstElite)
scene.defeatEnemy(firstElite)
assert(scene.questFlags.has('salt-seal'))
scene.player.x = scene.layout.exit.x; scene.player.y = scene.layout.exit.y
action('interact'); beatActiveBoss(); action('interact')
assert.equal(scene.floor, 2)
useAllAltars()
assert(scene.floorObjectiveReady())
scene.player.x = scene.layout.exit.x; scene.player.y = scene.layout.exit.y
action('interact'); beatActiveBoss(); action('interact')
assert.equal(scene.floor, 3)
useAllAltars()
assert(scene.inventory.some(i => i.defId === 'black_star'))
scene.player.x = scene.layout.exit.x; scene.player.y = scene.layout.exit.y
action('interact'); beatActiveBoss(); action('interact')
assert.equal(scene.floor, 4)
useAllAltars()
assert(scene.inventory.some(i => i.defId === 'abyss_key'))
scene.player.x = scene.layout.exit.x; scene.player.y = scene.layout.exit.y
action('interact'); beatActiveBoss(); action('interact')
assert.equal(snapshot().mode, 'ending')
assert(snapshot().choices.some(choice => choice.id === 'seal') && snapshot().choices.some(choice => choice.id === 'listen') && snapshot().choices.some(choice => choice.id === 'enter'))

console.log(`UI/campaign regression: OK (${buttonTemplates} button templates audited; all action contracts and the four-act progression exercised)`)
