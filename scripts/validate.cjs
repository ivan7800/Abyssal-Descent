const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
let ts
try { ts = require('typescript') } catch { ts = require(path.join(execSync('npm root -g').toString().trim(), 'typescript')) }

const root = path.resolve(__dirname, '..')

function loadTs(rel) {
  const filename = path.join(root, rel)
  const source = fs.readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const localRequire = (id) => { throw new Error(`Unexpected runtime import ${id} while loading ${rel}`) }
  new Function('exports', 'module', 'require', '__filename', '__dirname', js)(module.exports, module, localRequire, filename, path.dirname(filename))
  return module.exports
}

const { generateDungeon, bfsDistances } = loadTs('src/game/generator.ts')
const { ARCHETYPES, ITEM_DEFS, ENEMY_DEFS, FLOOR_DATA, SETPIECE_TEXT } = loadTs('src/game/content.ts')

function key(p) { return `${p.x},${p.y}` }
function assert(condition, message) { if (!condition) throw new Error(message) }

for (const [id, archetype] of Object.entries(ARCHETYPES)) {
  assert(ITEM_DEFS[archetype.weapon], `${id} references missing weapon ${archetype.weapon}`)
  if (archetype.charm) assert(ITEM_DEFS[archetype.charm], `${id} references missing charm ${archetype.charm}`)
  assert(archetype.passiveName && archetype.passiveDescription, `${id} is missing passive identity`)
}

for (const floor of [1, 2, 3, 4]) {
  const data = FLOOR_DATA[floor]
  assert(ENEMY_DEFS[data.boss], `Act ${floor} references missing boss ${data.boss}`)
  for (const kind of data.regulars) assert(ENEMY_DEFS[kind], `Act ${floor} references missing enemy ${kind}`)
  assert((SETPIECE_TEXT[floor] || []).length >= 2, `Act ${floor} needs at least two setpieces`)
}

const routeLengths = { 1: [], 2: [], 3: [], 4: [] }
const permutations = (items) => {
  if (items.length <= 1) return [items]
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]))
}
const routeDistance = (layout, ordered) => {
  let current = layout.start
  let total = 0
  for (const target of [...ordered, layout.exit]) {
    const distances = bfsDistances(layout.map, current)
    const distance = distances.get(key(target))
    if (distance == null) return Infinity
    total += distance
    current = target
  }
  return total
}

let floors = 0
let minWalkable = Infinity
let maxWalkable = 0
let totalWalkable = 0
for (let seedIndex = 0; seedIndex < 1000; seedIndex++) {
  const seed = `VALIDATE-${seedIndex}`
  for (const floor of [1, 2, 3, 4]) {
    const layout = generateDungeon(`${seed}:floor:${floor}`, 17, 13, floor)
    const distances = bfsDistances(layout.map, layout.start)
    const walkable = [...distances.keys()].length
    const allWalkable = layout.map.reduce((sum, row) => sum + [...row].filter(c => c === '.').length, 0)
    assert(walkable === allWalkable, `${seed} act ${floor}: disconnected floor (${walkable}/${allWalkable})`)
    assert(distances.has(key(layout.exit)), `${seed} act ${floor}: exit unreachable`)
    assert(distances.has(key(layout.sanctuary)), `${seed} act ${floor}: sanctuary unreachable`)
    if (layout.npc) assert(distances.has(key(layout.npc)), `${seed} act ${floor}: NPC unreachable`)
    for (const p of [...layout.altars, ...layout.enemySpawns, ...layout.lootSpawns, ...layout.eventSpawns, ...layout.setpieces]) {
      assert(distances.has(key(p)), `${seed} act ${floor}: generated point unreachable at ${key(p)}`)
    }
    if (layout.miniboss) assert(distances.has(key(layout.miniboss)), `${seed} act ${floor}: miniboss unreachable`)

    const reserved = [layout.start, layout.exit, layout.sanctuary, ...(layout.npc ? [layout.npc] : []), ...layout.altars,
      ...(layout.miniboss ? [layout.miniboss] : []), ...layout.setpieces, ...layout.enemySpawns, ...layout.lootSpawns, ...layout.eventSpawns]
    const unique = new Set(reserved.map(key))
    assert(unique.size === reserved.length, `${seed} act ${floor}: reserved spawn overlap`)
    const expectedAltars = floor === 1 ? 0 : floor === 4 ? 3 : 2
    assert(layout.altars.length === expectedAltars, `${seed} act ${floor}: expected ${expectedAltars} objectives, got ${layout.altars.length}`)
    if (floor === 1 || floor === 3) assert(layout.miniboss, `${seed} act ${floor}: expected miniboss`)
    const mandatory = floor === 1 ? [layout.miniboss] : layout.altars
    const route = Math.min(...permutations(mandatory.filter(Boolean)).map(order => routeDistance(layout, order)))
    routeLengths[floor].push(route)

    floors++
    minWalkable = Math.min(minWalkable, allWalkable)
    maxWalkable = Math.max(maxWalkable, allWalkable)
    totalWalkable += allWalkable
  }
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
}
console.log(`Content integrity: OK (${Object.keys(ENEMY_DEFS).length} enemies, ${Object.keys(ITEM_DEFS).length} items, ${Object.keys(ARCHETYPES).length} classes)`)
console.log(`Procedural validation: ${floors}/${floors} floors connected and collision-free`)
console.log(`Walkable cells: min ${minWalkable}, max ${maxWalkable}, avg ${(totalWalkable / floors).toFixed(1)}`)
for (const floor of [1, 2, 3, 4]) {
  console.log(`Act ${floor} mandatory route: median ${percentile(routeLengths[floor], .5)} steps, p90 ${percentile(routeLengths[floor], .9)}, max ${Math.max(...routeLengths[floor])}`)
}
