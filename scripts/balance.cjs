const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
let ts
try { ts = require('typescript') } catch { ts = require(path.join(execSync('npm root -g').toString().trim(), 'typescript')) }
const root = path.resolve(__dirname, '..')
function loadTs(rel) {
  const filename = path.join(root, rel)
  const source = fs.readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  new Function('exports', 'module', 'require', js)(module.exports, module, () => { throw new Error('unexpected require') })
  return module.exports
}
const { ARCHETYPES, ITEM_DEFS, ENEMY_DEFS, FLOOR_DATA } = loadTs('src/game/content.ts')

function rng(seed) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const randint = (r, a, b) => a + Math.floor(r() * (b - a + 1))

const checkpoints = {
  1: {
    minimum: { level: 1, weapon: { surveyor: 'surveyor_knife', occultist: 'ritual_athame', veteran: 'trench_hatchet' }, charm: { surveyor: 'brass_compass', occultist: 'glass_eye', veteran: 'iron_token' } },
    explorer: { level: 2, weapon: { surveyor: 'bone_sabre', occultist: 'bone_sabre', veteran: 'bone_sabre' }, charm: { surveyor: 'salt_charm', occultist: 'salt_charm', veteran: 'salt_charm' } },
  },
  2: {
    minimum: { level: 3, weapon: { surveyor: 'coral_blade', occultist: 'coral_blade', veteran: 'coral_blade' }, charm: { surveyor: 'brass_compass', occultist: 'glass_eye', veteran: 'iron_token' } },
    explorer: { level: 4, weapon: { surveyor: 'cantor_needle', occultist: 'cantor_needle', veteran: 'cantor_needle' }, charm: { surveyor: 'choir_mask', occultist: 'choir_mask', veteran: 'choir_mask' } },
  },
  3: {
    minimum: { level: 5, weapon: { surveyor: 'bell_hammer', occultist: 'bell_hammer', veteran: 'bell_hammer' }, charm: { surveyor: 'brass_compass', occultist: 'glass_eye', veteran: 'iron_token' } },
    explorer: { level: 6, weapon: { surveyor: 'dream_sickle', occultist: 'dream_sickle', veteran: 'dream_sickle' }, charm: { surveyor: 'choir_mask', occultist: 'choir_mask', veteran: 'choir_mask' } },
  },
  4: {
    minimum: { level: 7, weapon: { surveyor: 'void_lance', occultist: 'void_lance', veteran: 'void_lance' }, charm: { surveyor: 'brass_compass', occultist: 'glass_eye', veteran: 'iron_token' } },
    explorer: { level: 8, weapon: { surveyor: 'void_lance', occultist: 'void_lance', veteran: 'void_lance' }, charm: { surveyor: 'saint_bone', occultist: 'saint_bone', veteran: 'saint_bone' } },
  },
}

function fight(archetypeId, floor, spec, seed) {
  const r = rng(seed)
  const a = ARCHETYPES[archetypeId]
  const weapon = ITEM_DEFS[spec.weapon[archetypeId]]
  const charm = ITEM_DEFS[spec.charm[archetypeId]]
  const def = ENEMY_DEFS[FLOOR_DATA[floor].boss]
  const level = spec.level
  const maxHp = a.hp + (level - 1) * 4
  let hp = maxHp
  const maxSanity = a.sanity + (level - 1) * 2 + (weapon.maxSanityBonus || 0) + (charm.maxSanityBonus || 0)
  let sanity = maxSanity
  const scale = 1 + (floor - 1) * .12
  const maxEnemyHp = Math.round(def.hp * scale)
  let enemyHp = maxEnemyHp
  let combatTurn = 0
  let cooldown = 0
  let heals = 2
  let tonics = 1

  for (let actions = 0; actions < 120 && hp > 0 && enemyHp > 0; actions++) {
    const phaseFor = () => {
      const ratio = enemyHp / Math.max(1, maxEnemyHp)
      if ((def.phases || 1) === 2) return ratio <= .5 ? 2 : 1
      if ((def.phases || 1) === 3) return ratio <= .33 ? 3 : ratio <= .66 ? 2 : 1
      return 1
    }
    const phase = phaseFor()
    const heavyNext = (combatTurn + 1) % Math.max(2, 4 - phase) === 0
    let action
    if (heavyNext) action = archetypeId === 'veteran' && cooldown === 0 ? 'ability' : 'guard'
    else if (hp / maxHp < .33 && heals > 0) action = 'heal'
    else if (sanity / maxSanity < .28 && tonics > 0) action = 'tonic'
    else if (sanity / maxSanity < .25) action = 'focus'
    else if (cooldown === 0) action = 'ability'
    else action = 'attack'

    let guarded = false
    let counter = false
    if (['attack', 'guard', 'focus', 'heal', 'tonic'].includes(action) && cooldown > 0) cooldown--
    if (action === 'attack') {
      const base = randint(r, 3, 6) + (weapon.attackBonus || 0) + Math.floor((level - 1) / 2)
      const critChance = (archetypeId === 'surveyor' ? .18 : .10) + (weapon.critBonus || 0) + (charm.critBonus || 0)
      const crit = r() < critChance
      const damage = Math.max(1, Math.round((base - def.defense) * (crit ? 1.65 : 1)))
      enemyHp = Math.max(0, enemyHp - damage)
    } else if (action === 'guard') guarded = true
    else if (action === 'focus') sanity = Math.min(maxSanity, sanity + randint(r, 2, archetypeId === 'occultist' ? 6 : 4))
    else if (action === 'ability') {
      if (archetypeId === 'surveyor') enemyHp = Math.max(0, enemyHp - (randint(r, 7, 10) + (weapon.attackBonus || 0) + level))
      else if (archetypeId === 'occultist') {
        const cost = Math.min(4, Math.max(1, sanity - 1))
        sanity = Math.max(0, sanity - cost)
        enemyHp = Math.max(0, enemyHp - (randint(r, 9, 13) + (weapon.attackBonus || 0) + level + cost))
      } else { guarded = true; counter = true }
      cooldown = 3
    } else if (action === 'heal') {
      heals--
      const baseHeal = 14
      hp = Math.min(maxHp, hp + (archetypeId === 'veteran' ? Math.ceil(baseHeal * 1.25) : baseHeal))
    } else if (action === 'tonic') { tonics--; sanity = Math.min(maxSanity, sanity + 7) }
    if (enemyHp <= 0) break

    combatTurn++
    const newPhase = phaseFor()
    const heavy = combatTurn % Math.max(2, 4 - newPhase) === 0
    let damage = randint(r, def.min, def.max) + Math.floor((floor - 1) / 2)
    if (heavy) damage += floor + newPhase + 1
    const guardRate = archetypeId === 'veteran' ? .68 : .56
    if (guarded) damage -= Math.ceil(damage * Math.min(.82, guardRate + (heavy ? .10 : 0)))
    damage = Math.max(0, damage - (charm.defenseBonus || 0))
    hp = Math.max(0, hp - damage)
    if (counter && hp > 0) enemyHp = Math.max(0, enemyHp - (randint(r, 5, 8) + Math.floor(level / 2)))
    if (enemyHp <= 0) break

    const sanityResist = (charm.sanityResist || 0) + (archetypeId === 'occultist' ? .10 : 0)
    const sanityChance = Math.max(0, def.sanityChance + (heavy ? .15 : 0) - sanityResist)
    if (r() < sanityChance) sanity = Math.max(0, sanity - def.sanityDamage - (heavy ? 1 : 0))
    if (sanity === 0 && r() < .28) hp = Math.max(0, hp - 2)
  }
  return hp > 0 && enemyHp <= 0
}

const runs = 3000
const rows = []
for (const floor of [1, 2, 3, 4]) {
  for (const route of ['minimum', 'explorer']) {
    for (const archetype of Object.keys(ARCHETYPES)) {
      let wins = 0
      for (let i = 0; i < runs; i++) if (fight(archetype, floor, checkpoints[floor][route], i + floor * 10000)) wins++
      rows.push({ floor, route, archetype, winRate: wins / runs })
    }
  }
}
for (const row of rows) console.log(`Act ${row.floor} ${row.route.padEnd(8)} ${row.archetype.padEnd(9)} ${(row.winRate * 100).toFixed(1)}%`)

for (const row of rows.filter(r => r.route === 'explorer')) {
  const floorMinimum = { 1: .95, 2: .95, 3: .85, 4: .70 }[row.floor]
  if (row.winRate < floorMinimum) {
    console.error(`Balance regression: Act ${row.floor} ${row.archetype} explorer win rate ${(row.winRate * 100).toFixed(1)}% < ${(floorMinimum * 100).toFixed(0)}%`)
    process.exit(1)
  }
}
console.log('Heuristic boss balance: OK')
