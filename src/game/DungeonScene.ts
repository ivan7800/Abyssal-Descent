import Phaser from 'phaser'
import { bfsDistances, generateDungeon, seededRandom } from './generator'
import { ARCHETYPES, ENEMY_DEFS, FLOOR_DATA, ITEM_DEFS, SETPIECE_TEXT, type EnemyKind } from './content'
import { AbyssAudio } from './audio'
import type { ArchetypeId, ChoiceView, Dir, DungeonLayout, GameMode, GameSnapshot, InventoryItem, RunStats, SanityState } from './types'

export type { GameSnapshot } from './types'

const SAVE_KEY = 'abyssal-descent-save-v5'
const SETTINGS_KEY = 'abyssal-descent-settings-v1'
const DIRS = [
  { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
] as const
const key = (x: number, y: number) => `${x},${y}`

const storageGet = (storageKey: string) => {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey) }
  catch { return null }
}
const storageSet = (storageKey: string, value: string) => {
  try { if (typeof localStorage === 'undefined') return false; localStorage.setItem(storageKey, value); return true }
  catch { return false }
}
const storageRemove = (storageKey: string) => {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey) }
  catch { /* Storage can be unavailable in privacy-restricted contexts. */ }
}

type EnemyState = {
  id: string
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  defeated: boolean
  boss: boolean
  elite?: boolean
  combatTurn: number
  staggered?: boolean
  phase?: number
  nemesisRank?: number
}

type LootState = { x: number; y: number; defId: string; taken: boolean }

type SaveData = {
  version: 5
  mode: GameMode
  seed: string
  archetype: ArchetypeId
  floor: number
  level: number
  xp: number
  layout: DungeonLayout
  player: { x: number; y: number; dir: Dir }
  hp: number
  maxHp: number
  baseMaxSanity: number
  sanity: number
  steps: number
  log: string[]
  journal: string[]
  inventory: InventoryItem[]
  equippedWeaponId: string | null
  equippedCharmId: string | null
  enemies: EnemyState[]
  loot: LootState[]
  triggeredEvents: string[]
  questFlags: string[]
  sanctuaryUsed: number[]
  discovered: string[]
  activeEnemyId: string | null
  itemSerial: number
  turnSerial: number
  abilityCooldown: number
  guarded: boolean
  counterReady: boolean
  endingTitle: string
  endingText: string
  setpieceTriggered: string[]
  secretCount: number
  audioEnabled: boolean
  reducedMotion: boolean
  runStats: RunStats
}

const freshRunStats = (): RunStats => ({
  kills: 0, bossesDefeated: 0, elitesDefeated: 0, damageDealt: 0, damageTaken: 0, itemsUsed: 0, retreats: 0, rests: 0,
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string')
const isPoint = (value: unknown) => isRecord(value) && isInteger(value.x) && isInteger(value.y)
const isLayout = (value: unknown): value is DungeonLayout => {
  if (!isRecord(value) || !Array.isArray(value.map) || !value.map.every(row => typeof row === 'string' && row.length > 0)) return false
  const width = value.map[0]?.length ?? 0
  if (!width || !value.map.every(row => row.length === width && /^[.#]+$/.test(row))) return false
  const pointArray = (candidate: unknown) => Array.isArray(candidate) && candidate.every(isPoint)
  return isPoint(value.start) && isPoint(value.exit) && isPoint(value.sanctuary)
    && (value.npc === null || isPoint(value.npc)) && (value.miniboss === null || isPoint(value.miniboss))
    && pointArray(value.enemySpawns) && pointArray(value.lootSpawns) && pointArray(value.eventSpawns)
    && pointArray(value.altars) && pointArray(value.setpieces)
}
const isRunStats = (value: unknown): value is RunStats => isRecord(value)
  && ['kills', 'bossesDefeated', 'elitesDefeated', 'damageDealt', 'damageTaken', 'itemsUsed', 'retreats', 'rests'].every(k => isFiniteNumber(value[k]) && (value[k] as number) >= 0)
const isInventory = (value: unknown): value is InventoryItem[] => Array.isArray(value) && value.every(item => isRecord(item)
  && typeof item.instanceId === 'string' && typeof item.defId === 'string' && item.defId in ITEM_DEFS && typeof item.name === 'string'
  && ['weapon', 'charm', 'consumable', 'quest'].includes(String(item.kind)) && typeof item.description === 'string')
const isEnemyArray = (value: unknown): value is EnemyState[] => Array.isArray(value) && value.every(enemy => isRecord(enemy)
  && typeof enemy.id === 'string' && typeof enemy.kind === 'string' && enemy.kind in ENEMY_DEFS
  && isInteger(enemy.x) && isInteger(enemy.y) && isFiniteNumber(enemy.hp) && isFiniteNumber(enemy.maxHp)
  && typeof enemy.defeated === 'boolean' && typeof enemy.boss === 'boolean' && isInteger(enemy.combatTurn))
const isLootArray = (value: unknown): value is LootState[] => Array.isArray(value) && value.every(loot => isRecord(loot)
  && isInteger(loot.x) && isInteger(loot.y) && typeof loot.defId === 'string' && loot.defId in ITEM_DEFS && typeof loot.taken === 'boolean')

const isSaveData = (value: unknown): value is SaveData => {
  if (!isRecord(value) || value.version !== 5 || !['playing', 'ending'].includes(String(value.mode))) return false
  if (typeof value.seed !== 'string' || value.seed.length > 48 || typeof value.archetype !== 'string' || !(value.archetype in ARCHETYPES)) return false
  if (!isInteger(value.floor) || (value.floor as number) < 1 || (value.floor as number) > 4) return false
  if (!isInteger(value.level) || (value.level as number) < 1 || !isFiniteNumber(value.xp)) return false
  if (!isLayout(value.layout) || !isRecord(value.player) || !isInteger(value.player.x) || !isInteger(value.player.y)
    || !isInteger(value.player.dir) || (value.player.dir as number) < 0 || (value.player.dir as number) > 3) return false
  if (![value.hp, value.maxHp, value.baseMaxSanity, value.sanity, value.steps, value.itemSerial, value.turnSerial, value.abilityCooldown, value.secretCount].every(isFiniteNumber)) return false
  if ((value.maxHp as number) <= 0 || (value.baseMaxSanity as number) <= 0 || (value.hp as number) < 0 || (value.hp as number) > (value.maxHp as number)
    || (value.sanity as number) < 0 || (value.steps as number) < 0 || (value.itemSerial as number) < 0 || (value.turnSerial as number) < 0 || (value.abilityCooldown as number) < 0 || (value.secretCount as number) < 0) return false
  if (!isStringArray(value.log) || !isStringArray(value.journal) || !isInventory(value.inventory) || !isEnemyArray(value.enemies) || !isLootArray(value.loot)) return false
  if (![value.triggeredEvents, value.questFlags, value.discovered, value.setpieceTriggered].every(isStringArray)) return false
  if (!Array.isArray(value.sanctuaryUsed) || !value.sanctuaryUsed.every(isInteger)) return false
  if (!(value.activeEnemyId === null || typeof value.activeEnemyId === 'string') || !(value.equippedWeaponId === null || typeof value.equippedWeaponId === 'string')
    || !(value.equippedCharmId === null || typeof value.equippedCharmId === 'string')) return false
  if (value.activeEnemyId !== null && !(value.enemies as EnemyState[]).some(enemy => enemy.id === value.activeEnemyId && !enemy.defeated)) return false
  if (value.equippedWeaponId !== null && !(value.inventory as InventoryItem[]).some(item => item.instanceId === value.equippedWeaponId && item.kind === 'weapon')) return false
  if (value.equippedCharmId !== null && !(value.inventory as InventoryItem[]).some(item => item.instanceId === value.equippedCharmId && item.kind === 'charm')) return false
  if (![value.guarded, value.counterReady, value.audioEnabled, value.reducedMotion].every(v => typeof v === 'boolean')) return false
  if (typeof value.endingTitle !== 'string' || typeof value.endingText !== 'string' || !isRunStats(value.runStats)) return false
  return true
}

const EVENT_TEXT = [
  ['A voice behind the stone finishes a sentence you were thinking.', -2],
  ['Your shadow turns a corner before you do.', -1],
  ['The floor pulses once, like a sleeping throat.', -2],
  ['You find your own boot print ahead of you.', -3],
  ['A distant bell rings underwater.', -1],
  ['For one second, the corridor remembers daylight.', 1],
  ['A childhood room appears behind a door that was not there. You do not enter.', -2],
  ['Someone whispers your expedition seed back to you.', -2],
] as const

export class DungeonScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics
  private compass!: Phaser.GameObjects.Text
  private overlayText?: Phaser.GameObjects.Text
  private overlaySubtext?: Phaser.GameObjects.Text
  private specialText?: Phaser.GameObjects.Text

  private mode: GameMode = 'title'
  private seed = ''
  private archetype: ArchetypeId | null = null
  private floor = 1
  private level = 1
  private xp = 0
  private layout!: DungeonLayout
  private player = { x: 1, y: 1, dir: 1 as Dir }
  private hp = 1
  private maxHp = 1
  private baseMaxSanity = 1
  private sanity = 1
  private steps = 0
  private logLines: string[] = ['Choose an expedition profile to begin.']
  private journalEntries: string[] = []
  private inventory: InventoryItem[] = []
  private equippedWeaponId: string | null = null
  private equippedCharmId: string | null = null
  private enemies: EnemyState[] = []
  private loot: LootState[] = []
  private triggeredEvents = new Set<string>()
  private questFlags = new Set<string>()
  private sanctuaryUsed = new Set<number>()
  private discovered = new Set<string>()
  private activeEnemyId: string | null = null
  private itemSerial = 0
  private turnSerial = 0
  private abilityCooldown = 0
  private guarded = false
  private counterReady = false
  private endingTitle = ''
  private endingText = ''
  private setpieceTriggered = new Set<string>()
  private secretCount = 0
  private audioEnabled = true
  private reducedMotion = false
  private runStats: RunStats = freshRunStats()
  private audio = new AbyssAudio()

  constructor() { super('dungeon') }

  create() {
    this.g = this.add.graphics()
    this.compass = this.add.text(18, 16, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#a8c0ac', backgroundColor: '#070a08cc', padding: { x: 8, y: 5 },
    }).setDepth(3)

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))
    this.game.events.on('ui-action', this.onAction, this)
    this.loadPreferences()
    this.audio.setEnabled(this.audioEnabled)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.game.events.off('ui-action', this.onAction, this); this.audio.stopDrone() })
    this.drawTitle()
    this.emit()
  }

  private loadPreferences() {
    try {
      const raw = storageGet(SETTINGS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { audioEnabled?: boolean; reducedMotion?: boolean }
      if (typeof parsed.audioEnabled === 'boolean') this.audioEnabled = parsed.audioEnabled
      if (typeof parsed.reducedMotion === 'boolean') this.reducedMotion = parsed.reducedMotion
    } catch { storageRemove(SETTINGS_KEY) /* Discard malformed preferences and keep safe defaults. */ }
  }

  private savePreferences() {
    storageSet(SETTINGS_KEY, JSON.stringify({ audioEnabled: this.audioEnabled, reducedMotion: this.reducedMotion }))
  }

  private dailySeed() {
    const d = new Date()
    return `ABYSS-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  private onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const tag = target?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const keyName = event.key
    const k = keyName.toLowerCase()
    const action = k === 'w' || keyName === 'ArrowUp' ? 'forward'
      : k === 's' || keyName === 'ArrowDown' ? 'back'
        : k === 'a' || keyName === 'ArrowLeft' ? 'left'
          : k === 'd' || keyName === 'ArrowRight' ? 'right'
            : k === 'e' ? 'interact'
              : k === 'f' ? 'attack'
                : k === 'q' ? 'ability'
                  : k === 'g' ? 'guard'
                    : k === 'r' ? 'focus'
                      : k === 'x' ? 'flee'
                        : k === 'm' ? 'toggle-audio'
                          : null
    if (!action) return
    event.preventDefault()
    this.onAction(action)
  }

  private onAction(action: string) {
    if (action.startsWith('start:')) {
      const [, archetypeRaw, seedRaw = ''] = action.split(':')
      const archetype = archetypeRaw as ArchetypeId
      if (!(archetype in ARCHETYPES)) return
      this.newCampaign(archetype, decodeURIComponent(seedRaw).trim() || this.dailySeed())
      return
    }
    if (action === 'title') { this.returnToTitle(); return }
    if (action === 'toggle-audio') {
      this.audioEnabled = !this.audioEnabled
      this.audio.setEnabled(this.audioEnabled)
      if (this.audioEnabled && this.mode !== 'title') this.audio.startDrone(this.floor)
      this.savePreferences()
      this.log(`Audio ${this.audioEnabled ? 'enabled' : 'muted'}.`)
      return
    }
    if (action === 'toggle-motion') { this.reducedMotion = !this.reducedMotion; this.savePreferences(); this.log(`Reduced motion ${this.reducedMotion ? 'enabled' : 'disabled'}.`); this.draw(); return }
    if (action === 'save') { this.saveGame(true); return }
    if (action === 'load') { this.loadGame(); return }
    if (action.startsWith('equip:')) { this.equip(action.slice(6)); return }
    if (action.startsWith('use:')) { this.useItem(action.slice(4)); return }
    if (action.startsWith('ending:')) { this.chooseEnding(action.slice(7)); return }

    if (this.mode !== 'playing' || this.hp <= 0) return
    const enemy = this.activeEnemy()
    if (enemy) {
      if (action === 'attack') this.attack()
      if (action === 'guard') this.guard()
      if (action === 'focus') this.focus()
      if (action === 'ability') this.useAbility()
      if (action === 'flee') this.flee()
      return
    }

    if (action === 'left') this.turn(-1)
    if (action === 'right') this.turn(1)
    if (action === 'forward') this.move(1)
    if (action === 'back') this.move(-1)
    if (action === 'interact') this.interact()
  }

  private newCampaign(archetype: ArchetypeId, seed: string) {
    const a = ARCHETYPES[archetype]
    this.mode = 'playing'
    this.seed = seed.slice(0, 48)
    this.archetype = archetype
    this.floor = 1
    this.level = 1
    this.xp = 0
    this.maxHp = a.hp
    this.hp = this.maxHp
    this.baseMaxSanity = a.sanity
    this.sanity = this.baseMaxSanity
    this.steps = 0
    this.logLines = [`You enter the drowned observatory as the ${a.name}.`, `Expedition seed: ${this.seed}.`]
    this.journalEntries = ['EXPEDITION ORDER — Descend beneath the observatory and determine why the lower survey team stopped transmitting.']
    this.inventory = []
    this.equippedWeaponId = null
    this.equippedCharmId = null
    this.questFlags.clear()
    this.sanctuaryUsed.clear()
    this.itemSerial = 0
    this.turnSerial = 0
    this.endingTitle = ''
    this.endingText = ''
    this.setpieceTriggered.clear()
    this.secretCount = 0
    this.runStats = freshRunStats()
    this.audio.startDrone(1)

    const weapon = this.addItem(a.weapon)
    this.equippedWeaponId = weapon.instanceId
    if (a.charm) this.equippedCharmId = this.addItem(a.charm).instanceId
    this.sanity = this.maxSanity()
    this.addItem('field_dressing')
    this.addItem('lucid_tonic')
    this.setupFloor(1, true)
  }

  private setupFloor(floor: number, first = false) {
    this.floor = floor
    this.audio.startDrone(floor)
    this.layout = generateDungeon(`${this.seed}:floor:${floor}`, 17, 13, floor)
    this.player = { ...this.layout.start, dir: 1 }
    this.discovered = new Set([key(this.player.x, this.player.y)])
    this.discoverAround(this.player.x, this.player.y)
    this.triggeredEvents.clear()
    this.activeEnemyId = null
    this.abilityCooldown = 0
    this.guarded = false
    this.counterReady = false
    this.populateFloor()
    const data = FLOOR_DATA[this.floor as 1 | 2 | 3 | 4]
    if (!first) this.logLines = [...this.logLines, `You descend into ${data.name}.`].slice(-60)
    this.addJournalOnce(`ACT ${this.floor}: ${data.journal}`)
    this.checkTile(false)
    this.draw()
    this.saveGame(false)
  }

  private populateFloor() {
    const data = FLOOR_DATA[this.floor as 1 | 2 | 3 | 4]
    this.enemies = this.layout.enemySpawns.map((p, i) => this.makeEnemy(`enemy-${this.floor}-${i}`, data.regulars[i % data.regulars.length], p.x, p.y, false))
    if (this.floor === 1 && this.layout.miniboss) {
      this.enemies.push(this.makeEnemy('salt-warden-elite', 'warden', this.layout.miniboss.x, this.layout.miniboss.y, false, true))
    }
    if (this.floor === 3 && this.layout.miniboss) {
      this.enemies.push(this.makeEnemy('mirror-stalker-optional', 'mirror_stalker', this.layout.miniboss.x, this.layout.miniboss.y, false, true))
    }

    const guaranteed: Record<number, string[]> = {
      1: ['bone_sabre', 'salt_charm'],
      2: ['cantor_needle', 'choir_mask'],
      3: ['dream_sickle', 'white_tincture'],
      4: ['saint_bone', 'black_draught'],
    }
    const weighted: Record<number, string[]> = {
      1: ['field_dressing', 'field_dressing', 'lucid_tonic', 'lucid_tonic', 'white_tincture'],
      2: ['field_dressing', 'strong_dressing', 'strong_dressing', 'lucid_tonic', 'white_tincture', 'salt_charm'],
      3: ['strong_dressing', 'strong_dressing', 'lucid_tonic', 'lucid_tonic', 'white_tincture', 'choir_mask'],
      4: ['strong_dressing', 'strong_dressing', 'black_draught', 'lucid_tonic', 'white_tincture', 'choir_mask'],
    }
    const rnd = seededRandom(`${this.seed}:loot:${this.floor}`)
    const fixed = guaranteed[this.floor]
    const pool = weighted[this.floor]
    this.loot = this.layout.lootSpawns.map((p, i) => ({
      x: p.x, y: p.y,
      defId: i < fixed.length ? fixed[i] : pool[Math.floor(rnd() * pool.length)],
      taken: false,
    }))
  }

  private makeEnemy(id: string, kind: EnemyKind, x: number, y: number, boss: boolean, elite = false): EnemyState {
    const def = ENEMY_DEFS[kind]
    const scale = 1 + (this.floor - 1) * .12
    const isElite = elite || !!def.elite
    const hp = Math.round(def.hp * scale * (isElite ? 1.28 : 1))
    return { id, kind, x, y, hp, maxHp: hp, defeated: false, boss, elite: isElite, combatTurn: 0, phase: 1 }
  }

  private activeEnemy() { return this.enemies.find(e => e.id === this.activeEnemyId && !e.defeated) ?? null }

  private turn(delta: number) {
    this.player.dir = ((this.player.dir + delta + 4) % 4) as Dir
    this.audio.cue('turn')
    this.draw()
  }

  private move(sign: number) {
    const d = DIRS[this.player.dir]
    const nx = this.player.x + d.x * sign
    const ny = this.player.y + d.y * sign
    if (this.layout.map[ny]?.[nx] === '#') {
      this.log('Cold stone blocks the way.')
      this.draw(); return
    }
    this.player.x = nx; this.player.y = ny; this.steps++
    this.audio.cue('step')
    this.discoverAround(nx, ny)
    if (this.sanity <= Math.ceil(this.maxSanity() * .2) && this.roll() < .12) {
      const before = this.hp
      this.hp = Math.max(0, this.hp - 1)
      this.runStats.damageTaken += before - this.hp
      this.log('Panic turns a harmless scrape into a wound. Vitality -1.')
      if (this.hp <= 0) {
        this.log('The abyss keeps your name.')
        this.draw()
        return
      }
    }
    this.checkTile(true)
    this.draw()
  }

  private discoverAround(x: number, y: number) {
    const radius = this.archetype === 'surveyor' ? 2 : 1
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue
        const nx = x + dx, ny = y + dy
        if (this.layout.map[ny]?.[nx] === '.') this.discovered.add(key(nx, ny))
      }
    }
  }

  private checkTile(logQuiet: boolean) {
    const here = key(this.player.x, this.player.y)
    const enemy = this.enemies.find(e => !e.defeated && key(e.x, e.y) === here)
    if (enemy) {
      this.activeEnemyId = enemy.id
      const def = ENEMY_DEFS[enemy.kind]
      const shock = enemy.elite ? 2 : 1
      this.sanity = Math.max(0, this.sanity - shock)
      const returnText = enemy.nemesisRank ? 'The scarred thing you escaped has not forgotten you: ' : enemy.elite ? 'A greater shape blocks the passage: ' : ''
      this.log(`${returnText}${def.name} emerges from the dark. Sanity -${shock}.`)
      if (!this.questFlags.has('tutorial-combat')) { this.questFlags.add('tutorial-combat'); this.log('COMBAT — Attack for damage, Guard against telegraphed danger, Focus to recover sanity, or use your class ability when ready.') }
      this.audio.cue(enemy.boss ? 'boss' : 'sanity', enemy.boss ? 1.15 : .65)
      this.draw(); return
    }

    const loot = this.loot.find(l => !l.taken && key(l.x, l.y) === here)
    if (loot) {
      loot.taken = true
      const item = this.addItem(loot.defId)
      this.log(`Recovered: ${item.name}.`)
      if (!this.questFlags.has('tutorial-inventory')) { this.questFlags.add('tutorial-inventory'); this.log('INVENTORY — Equipment can be changed outside combat. Consumables can be used in combat, but doing so costs the turn.') }
      this.audio.cue('pickup')
    }

    const setpieceIndex = this.layout.setpieces?.findIndex(p => key(p.x, p.y) === here) ?? -1
    const setpieceFlag = `setpiece-${this.floor}-${setpieceIndex}`
    if (setpieceIndex >= 0 && !this.setpieceTriggered.has(setpieceFlag)) {
      this.setpieceTriggered.add(setpieceFlag)
      const piece = SETPIECE_TEXT[this.floor]?.[setpieceIndex % (SETPIECE_TEXT[this.floor]?.length || 1)]
      if (piece) {
        this.sanity = Phaser.Math.Clamp(this.sanity + piece.sanity, 0, this.maxSanity())
        this.log(`${piece.title}: ${piece.text}${piece.sanity ? ` Sanity ${piece.sanity}.` : ''}`)
        if (piece.reward) { const reward = this.addItem(piece.reward); this.log(`Hidden cache: ${reward.name}.`) }
        this.addJournalOnce(`${piece.title} — ${piece.text}`)
        this.gainSecret()
        this.audio.cue('secret')
      }
    }

    if (this.layout.eventSpawns.some(p => key(p.x, p.y) === here) && !this.triggeredEvents.has(here)) {
      this.triggeredEvents.add(here)
      const rnd = seededRandom(`${this.seed}:${this.floor}:${here}:event`)
      const [text, delta] = EVENT_TEXT[Math.floor(rnd() * EVENT_TEXT.length)]
      const before = this.sanity
      this.sanity = Phaser.Math.Clamp(this.sanity + delta, 0, this.maxSanity())
      const actual = this.sanity - before
      this.log(`${text}${actual === 0 ? '' : ` Sanity ${actual > 0 ? '+' : ''}${actual}.`}`)
    } else if (!logQuiet) {
      this.emit()
    }
  }

  private gainSecret() {
    this.secretCount++
    if (this.secretCount >= 5 && !this.inventory.some(i => i.defId === 'star_cutter')) {
      const relic = this.addItem('star_cutter')
      this.log(`Five anomalies align into one impossible route. Hidden relic: ${relic.name}.`)
      this.addJournalOnce('THE FIFTH LINE — Five anomalous chambers describe a weapon-shaped absence. The Star Cutter was waiting where those descriptions intersected.')
      this.saveGame(false)
    }
  }

  private interact() {
    const here = key(this.player.x, this.player.y)
    if (key(this.layout.sanctuary.x, this.layout.sanctuary.y) === here && !this.sanctuaryUsed.has(this.floor)) {
      if (this.hp >= this.maxHp && this.sanity >= this.maxSanity()) {
        this.log('The survey lamp is steady. You are already fully rested, so its single use is preserved.')
        return
      }
      this.sanctuaryUsed.add(this.floor)
      this.runStats.rests++
      const heal = Math.max(1, Math.ceil(this.maxHp * .45))
      const calm = Math.max(1, Math.ceil(this.maxSanity() * .40))
      this.hp = Math.min(this.maxHp, this.hp + heal)
      this.sanity = Math.min(this.maxSanity(), this.sanity + calm)
      this.log(`You rest at the survey lamp. Vitality and sanity recover.`)
      this.audio.cue('rest')
      this.addJournalOnce(`REFUGE ${this.floor}: Someone maintained this lamp recently. The oil is still warm.`)
      this.saveGame(false); this.draw(); return
    }

    if (this.floor === 2 && this.layout.npc && key(this.layout.npc.x, this.layout.npc.y) === here && !this.questFlags.has('cartographer-met')) {
      this.questFlags.add('cartographer-met')
      this.addItem('white_tincture')
      this.log('Cartographer Mara Vey refuses to look at you directly. “Wake both hymn altars. The city only opens its throat when it remembers the whole song.” She gives you a White Tincture.')
      this.addJournalOnce('MARA VEY — The missing cartographer survived. She claims the buried city is not abandoned; it is “waiting between verses.”')
      this.saveGame(false); this.draw(); return
    }

    const altarIndex = this.layout.altars.findIndex(p => key(p.x, p.y) === here)
    if (altarIndex >= 0) {
      const flag = `altar-${this.floor}-${altarIndex}`
      if (!this.questFlags.has(flag)) {
        this.questFlags.add(flag)
        if (this.floor === 2) {
          this.sanity = Math.max(0, this.sanity - 2)
          this.log(`You wake hymn altar ${altarIndex + 1}. A note passes through your bones. Sanity -2.`)
          if (this.floorObjectiveReady()) {
            this.addItem('city_canticle')
            this.addJournalOnce('THE CANTICLE — The two altar tones form a sentence: “The door below dreams in borrowed minds.”')
          }
        } else if (this.floor === 3) {
          this.sanity = Math.max(0, this.sanity - 3)
          this.log(`Memory ${altarIndex + 1} enters you: the first survey team willingly opened the final seal. Sanity -3.`)
          if (this.floorObjectiveReady()) {
            this.addItem('black_star')
            this.addJournalOnce('BLACK-STAR MEMORY — The abyss did not call the surveyors. They came because each of them dreamed the same impossible star.')
          }
        } else {
          this.sanity = Math.max(0, this.sanity - 2)
          this.log(`Anchor sigil ${altarIndex + 1} locks into one possible geometry. Sanity -2.`)
          if (this.floorObjectiveReady()) {
            this.addItem('abyss_key')
            this.addJournalOnce('ABYSS KEY — The three sigils describe an angle that cannot exist until someone chooses to walk through it.')
          }
        }
        this.audio.cue('interact')
        this.saveGame(false); this.draw(); return
      }
    }

    if (this.player.x === this.layout.exit.x && this.player.y === this.layout.exit.y) {
      if (!this.floorObjectiveReady()) {
        this.log(this.floorBlockedMessage()); this.draw(); return
      }
      const bossFlag = `boss-${this.floor}-defeated`
      if (!this.questFlags.has(bossFlag)) {
        this.startBoss(); return
      }
      if (this.floor < 4) {
        this.setupFloor(this.floor + 1)
      } else {
        this.presentEndingChoices()
      }
      return
    }

    this.log('Nothing here responds to your touch.')
    this.draw()
  }

  private floorObjectiveReady() {
    if (this.floor === 1) return this.questFlags.has('salt-seal')
    const required = this.floor === 4 ? 3 : 2
    return Array.from({ length: required }, (_, i) => i).every(i => this.questFlags.has(`altar-${this.floor}-${i}`))
  }

  private floorBlockedMessage() {
    if (this.floor === 1) return 'The stair is sealed by a rib-shaped lock. The Salt Warden carries what fits it.'
    if (this.floor === 2) return 'The gate has two silent resonators. Both hymn altars must be awake.'
    if (this.floor === 3) return 'The Heart remains out of phase. Two black-star memories are missing.'
    return 'The final chamber has no stable location. All three anchor sigils must be fixed.'
  }

  private startBoss() {
    const kind = FLOOR_DATA[this.floor as 1 | 2 | 3 | 4].boss
    const boss = this.makeEnemy(`boss-${this.floor}`, kind, this.player.x, this.player.y, true)
    this.enemies.push(boss)
    this.activeEnemyId = boss.id
    this.sanity = Math.max(0, this.sanity - (this.floor + 1))
    this.log(`${ENEMY_DEFS[kind].name} answers the opened way.`)
    this.audio.cue('boss', 1.3)
    this.gameFeel('boss')
    this.draw()
  }

  private enemyDefense(enemy: EnemyState) {
    if (enemy.staggered) return 0
    let defense = ENEMY_DEFS[enemy.kind].defense
    if (enemy.kind === 'warden' && (enemy.combatTurn + 1) % 3 === 0) defense += 2
    return defense
  }

  private attack() {
    const enemy = this.activeEnemy(); if (!enemy) return
    this.startPlayerTurn()
    const weapon = this.inventory.find(i => i.instanceId === this.equippedWeaponId)
    const base = this.randomInt(3, 6) + (weapon?.attackBonus ?? 0) + Math.floor((this.level - 1) / 2)
    const defense = this.enemyDefense(enemy)
    const charm = this.inventory.find(i => i.instanceId === this.equippedCharmId)
    const critical = this.roll() < (this.archetype === 'surveyor' ? .18 : .10) + (weapon?.critBonus ?? 0) + (charm?.critBonus ?? 0)
    const damage = Math.max(1, Math.round((base - defense) * (critical ? 1.65 : 1)))
    enemy.staggered = false
    const hpBefore = enemy.hp
    enemy.hp = Math.max(0, enemy.hp - damage)
    const actualDamage = hpBefore - enemy.hp
    this.runStats.damageDealt += actualDamage
    this.log(`${critical ? 'Critical. ' : ''}You strike ${ENEMY_DEFS[enemy.kind].name} for ${actualDamage}.`)
    this.audio.cue(critical ? 'critical' : 'attack')
    this.gameFeel(critical ? 'critical' : 'attack')
    this.afterPlayerAttack(enemy)
  }

  private guard() {
    const enemy = this.activeEnemy(); if (!enemy) return
    this.startPlayerTurn()
    this.guarded = true
    this.log('You brace for the next attack.')
    this.enemyTurn(enemy)
  }

  private focus() {
    const enemy = this.activeEnemy(); if (!enemy) return
    this.startPlayerTurn()
    const gain = this.randomInt(2, this.archetype === 'occultist' ? 6 : 4)
    const before = this.sanity
    this.sanity = Math.min(this.maxSanity(), this.sanity + gain)
    this.log(`You count your breaths. Sanity +${this.sanity - before}.`)
    this.enemyTurn(enemy)
  }

  private useAbility() {
    const enemy = this.activeEnemy(); if (!enemy || !this.archetype) return
    if (this.abilityCooldown > 0) { this.log(`${ARCHETYPES[this.archetype].abilityName} is not ready.`); return }
    this.startPlayerTurn(false)
    const weapon = this.inventory.find(i => i.instanceId === this.equippedWeaponId)
    const bonus = weapon?.attackBonus ?? 0
    if (this.archetype === 'surveyor') {
      const damage = this.randomInt(7, 10) + bonus + this.level
      const hpBefore = enemy.hp
      enemy.hp = Math.max(0, enemy.hp - damage)
      const actualDamage = hpBefore - enemy.hp
      this.runStats.damageDealt += actualDamage
      enemy.staggered = true
      this.log(`Measured Strike finds the seam. ${actualDamage} damage; enemy defense is broken.`)
    } else if (this.archetype === 'occultist') {
      const cost = Math.min(4, Math.max(1, this.sanity - 1))
      this.sanity = Math.max(0, this.sanity - cost)
      const damage = this.randomInt(9, 13) + bonus + this.level + cost
      const hpBefore = enemy.hp
      enemy.hp = Math.max(0, enemy.hp - damage)
      const actualDamage = hpBefore - enemy.hp
      this.runStats.damageDealt += actualDamage
      enemy.staggered = true
      this.log(`You speak the Forbidden Word. Sanity -${cost}; ${actualDamage} damage.`)
    } else {
      this.guarded = true
      this.counterReady = true
      this.log('Hold Fast: you lock your stance and prepare a counterattack.')
    }
    this.abilityCooldown = 3
    this.audio.cue('critical', .85)
    this.gameFeel('attack')
    this.afterPlayerAttack(enemy)
  }

  private startPlayerTurn(tickCooldown = true) {
    this.guarded = false
    if (tickCooldown && this.abilityCooldown > 0) this.abilityCooldown--
  }

  private afterPlayerAttack(enemy: EnemyState) {
    if (enemy.hp <= 0) { this.defeatEnemy(enemy); return }
    this.enemyTurn(enemy)
  }

  private enemyTurn(enemy: EnemyState) {
    if (enemy.defeated) return
    enemy.combatTurn++
    const def = ENEMY_DEFS[enemy.kind]
    this.updateBossPhase(enemy)
    const charm = this.inventory.find(i => i.instanceId === this.equippedCharmId)
    let damage = this.randomInt(def.min, def.max) + Math.floor((this.floor - 1) / 2)
    const phase = enemy.phase ?? 1
    const heavyBossTurn = enemy.boss && enemy.combatTurn % Math.max(2, 4 - phase) === 0
    const rushingHusk = enemy.kind === 'husk' && enemy.combatTurn === 1
    const tollingBell = enemy.kind === 'bell_devourer' && enemy.combatTurn % 2 === 0
    if (heavyBossTurn) damage += this.floor + phase + 1
    if (rushingHusk) damage += 2
    if (tollingBell) damage += 2
    if (enemy.nemesisRank) damage += Math.min(3, enemy.nemesisRank)
    const telegraphedHeavy = heavyBossTurn || rushingHusk || tollingBell
    const guardRate = this.archetype === 'veteran' ? .68 : .56
    const guardBonus = telegraphedHeavy ? .10 : 0
    damage = Math.max(0, damage - (charm?.defenseBonus ?? 0) - (this.guarded ? Math.ceil(damage * Math.min(.82, guardRate + guardBonus)) : 0))
    const hpBefore = this.hp
    this.hp = Math.max(0, this.hp - damage)
    const actualDamage = hpBefore - this.hp
    this.runStats.damageTaken += actualDamage
    if (this.guarded && telegraphedHeavy) this.log('You read the tell and absorb the worst of the impact.')
    this.log(`${def.name} ${heavyBossTurn ? this.bossAttackText(enemy) : 'attacks'}. Vitality -${actualDamage}.`)
    this.audio.cue('hurt', Math.min(1.35, .65 + damage / 12))
    this.gameFeel('hurt')

    if (this.counterReady && this.archetype === 'veteran' && this.hp > 0) {
      const counter = this.randomInt(5, 8) + Math.floor(this.level / 2)
      const hpBefore = enemy.hp
      enemy.hp = Math.max(0, enemy.hp - counter)
      const actualCounter = hpBefore - enemy.hp
      this.runStats.damageDealt += actualCounter
      this.counterReady = false
      this.log(`You counter through the impact for ${actualCounter}.`)
      if (enemy.hp <= 0) { this.defeatEnemy(enemy); return }
    }

    const innateSanityResist = this.archetype === 'occultist' ? .10 : 0
    const sanityResist = (charm?.sanityResist ?? 0) + innateSanityResist
    let sanityChance = Math.max(0, def.sanityChance + (heavyBossTurn ? .15 : 0) - sanityResist)
    if (enemy.kind === 'oracle') sanityChance += .12
    if (enemy.kind === 'mirror_stalker' && enemy.combatTurn % 2 === 0) sanityChance += .15
    if (this.roll() < sanityChance) {
      const loss = def.sanityDamage + (heavyBossTurn ? 1 : 0)
      this.sanity = Math.max(0, this.sanity - loss)
      this.log(`The contact leaves an alien thought behind. Sanity -${loss}.`)
      this.audio.cue('sanity')
    }
    if (this.sanity === 0 && this.roll() < .28) {
      const before = this.hp
      this.hp = Math.max(0, this.hp - 2)
      const loss = before - this.hp
      this.runStats.damageTaken += loss
      this.log(`At zero sanity, the corridor hurts you simply by being believed. Vitality -${loss}.`)
    }
    if (this.hp <= 0) this.log('The abyss keeps your name.')
    this.draw()
  }

  private defeatEnemy(enemy: EnemyState) {
    enemy.defeated = true
    this.activeEnemyId = null
    let checkpointAfterRewards = false
    const def = ENEMY_DEFS[enemy.kind]
    this.runStats.kills++
    if (enemy.boss) this.runStats.bossesDefeated++
    else if (enemy.elite) this.runStats.elitesDefeated++
    this.log(`${def.name} collapses into stillness. +${def.xp} XP.`)
    this.gainXp(def.xp)
    const killCharm = this.inventory.find(i => i.instanceId === this.equippedCharmId)
    if (killCharm?.healOnKill) { const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + killCharm.healOnKill); if (this.hp > before) this.log(`${killCharm.name} drinks the aftermath. Vitality +${this.hp - before}.`) }

    if (enemy.id === 'salt-warden-elite' && !this.questFlags.has('salt-seal')) {
      this.questFlags.add('salt-seal')
      this.addItem('salt_seal')
      this.log('You cut the Salt Seal from its rib cage. The stair can now be opened.')
      this.addJournalOnce('SALT SEAL — The cells were not built to keep prisoners in. The seal faces downward.')
      checkpointAfterRewards = true
    }
    if (enemy.id === 'mirror-stalker-optional' && !this.questFlags.has('mirror-stalker-defeated')) {
      this.questFlags.add('mirror-stalker-defeated')
      const shard = this.addItem('mirror_shard')
      this.log(`The false reflection breaks. You recover ${shard.name}.`)
      this.addJournalOnce('MIRROR STALKER — It knew every movement because it was watching from the version of the corridor where you had already made it.')
      this.gainSecret()
      this.audio.cue('secret')
      checkpointAfterRewards = true
    }
    if (enemy.boss) {
      this.questFlags.add(`boss-${this.floor}-defeated`)
      this.log(this.floor < 4 ? 'The way below is open. Interact with the stair to descend.' : 'The Void Saint unravels. The last threshold is yours to answer.')
      if (this.floor === 1) { this.addItem('coral_blade'); this.addJournalOnce('THE SALT KNIGHT — Beneath its mineral armor was a human survey harness, older than the observatory by centuries.') }
      if (this.floor === 2) { this.addItem('bell_hammer'); this.addJournalOnce('CHOIR BENEATH — The voices were not singing together. They were arguing about which version of the city should survive.') }
      if (this.floor === 3) { this.addItem('void_lance'); this.addJournalOnce('HEART OF THE ABYSS — The Heart was never the source. It was a relay pointed toward something farther down.') }
      if (this.floor === 4) this.addJournalOnce('THE VOID SAINT — The final guardian was not defending the abyss from you. It was defending you from the choice beyond it.')
      this.audio.cue('victory', 1.2)
      this.saveGame(false)
    } else if (this.roll() < .28) {
      const drop = this.addItem(this.roll() < .55 ? 'field_dressing' : 'lucid_tonic')
      this.log(`It leaves behind ${drop.name}.`)
    }
    if (checkpointAfterRewards) this.saveGame(false)
    this.draw()
  }

  private gainXp(amount: number) {
    this.xp += amount
    while (this.xp >= this.nextXp()) {
      const needed = this.nextXp()
      this.xp -= needed
      this.level++
      this.maxHp += 4
      this.baseMaxSanity += 2
      this.hp = Math.min(this.maxHp, this.hp + 6)
      this.sanity = Math.min(this.maxSanity(), this.sanity + 4)
      this.log(`LEVEL ${this.level}. Vitality +4 max, Sanity +2 max. You recover some strength.`)
    }
  }

  private nextXp() { return 18 + this.level * 16 }

  private flee() {
    const enemy = this.activeEnemy(); if (!enemy || enemy.boss) return
    this.startPlayerTurn()
    if (this.roll() < (enemy.elite ? .35 : .62)) {
      this.activeEnemyId = null
      this.runStats.retreats++
      enemy.nemesisRank = (enemy.nemesisRank ?? 0) + 1
      enemy.elite = true
      enemy.maxHp += 2
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 4)
      const d = DIRS[this.player.dir]
      const bx = this.player.x - d.x, by = this.player.y - d.y
      if (this.layout.map[by]?.[bx] === '#') {
        this.log('There is no room behind you. The attempted retreat collapses into another exchange.')
        this.activeEnemyId = enemy.id
        this.enemyTurn(enemy)
        return
      }
      this.player.x = bx; this.player.y = by; this.steps++
      this.discoverAround(bx, by)
      this.log(`You break line of sight and retreat. ${ENEMY_DEFS[enemy.kind].name} survives scarred and will be stronger if you meet again.`)
      this.checkTile(true)
    } else {
      this.log('It anticipates the escape.')
      this.enemyTurn(enemy); return
    }
    this.draw()
  }

  private addItem(defId: string) {
    const def = ITEM_DEFS[defId] ?? ITEM_DEFS.field_dressing
    if (def.kind === 'consumable') {
      const stack = this.inventory.find(i => i.defId === def.defId && i.kind === 'consumable')
      if (stack) { stack.quantity = (stack.quantity ?? 1) + 1; return stack }
    }
    if (def.unique) {
      const existing = this.inventory.find(i => i.defId === def.defId)
      if (existing) return existing
    }
    const item: InventoryItem = { ...def, instanceId: `item-${++this.itemSerial}`, ...(def.kind === 'consumable' ? { quantity: 1 } : {}) }
    this.inventory.push(item)
    return item
  }

  private equip(instanceId: string) {
    const item = this.inventory.find(i => i.instanceId === instanceId)
    if (!item || item.kind === 'consumable' || item.kind === 'quest' || this.hp <= 0 || this.mode !== 'playing') return
    if (this.activeEnemy()) { this.log('You cannot reorganize equipment while something is trying to kill you.'); return }
    if (item.kind === 'weapon') this.equippedWeaponId = item.instanceId
    if (item.kind === 'charm') this.equippedCharmId = item.instanceId
    this.sanity = Math.min(this.maxSanity(), this.sanity)
    this.log(`Equipped ${item.name}.`); this.draw()
  }

  private useItem(instanceId: string) {
    const index = this.inventory.findIndex(i => i.instanceId === instanceId)
    if (index < 0 || this.hp <= 0 || this.mode !== 'playing') return
    const item = this.inventory[index]
    if (item.kind !== 'consumable') return
    if (!this.consumableWouldHelp(item)) { this.log(`${item.name} would provide no benefit right now, so you keep it.`); return }
    const enemy = this.activeEnemy()
    if (enemy) this.startPlayerTurn()
    if (item.heal) {
      const heal = this.archetype === 'veteran' ? Math.ceil(item.heal * 1.25) : item.heal
      const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + heal)
      this.log(`${item.name}: Vitality +${this.hp - before}.`)
    }
    if (item.restoreSanity) {
      const before = this.sanity; this.sanity = Phaser.Math.Clamp(this.sanity + item.restoreSanity, 0, this.maxSanity())
      const delta = this.sanity - before
      this.log(`${item.name}: Sanity ${delta >= 0 ? '+' : ''}${delta}.`)
    }
    if ((item.quantity ?? 1) > 1) item.quantity = (item.quantity ?? 1) - 1
    else this.inventory.splice(index, 1)
    this.runStats.itemsUsed++
    if (enemy) this.enemyTurn(enemy)
    else this.draw()
  }

  private consumableWouldHelp(item: InventoryItem) {
    const rawHeal = item.heal ? (this.archetype === 'veteran' ? Math.ceil(item.heal * 1.25) : item.heal) : 0
    const hpGain = Math.max(0, Math.min(this.maxHp, this.hp + rawHeal) - this.hp)
    const sanityGain = item.restoreSanity && item.restoreSanity > 0 ? Math.max(0, Math.min(this.maxSanity(), this.sanity + item.restoreSanity) - this.sanity) : 0
    return hpGain > 0 || sanityGain > 0
  }

  private maxSanity() {
    const charm = this.inventory.find(i => i.instanceId === this.equippedCharmId)
    const weapon = this.inventory.find(i => i.instanceId === this.equippedWeaponId)
    return this.baseMaxSanity + (charm?.maxSanityBonus ?? 0) + (weapon?.maxSanityBonus ?? 0)
  }

  private currentInteraction() {
    if (this.mode !== 'playing' || this.hp <= 0 || this.activeEnemy()) return null
    const here = key(this.player.x, this.player.y)
    if (key(this.layout.sanctuary.x, this.layout.sanctuary.y) === here && !this.sanctuaryUsed.has(this.floor)) {
      return { label: 'Rest at lamp', hint: 'Restore vitality and sanity. One use on this floor.' }
    }
    if (this.floor === 2 && this.layout.npc && key(this.layout.npc.x, this.layout.npc.y) === here && !this.questFlags.has('cartographer-met')) {
      return { label: 'Speak to Mara Vey', hint: 'The missing cartographer is alive.' }
    }
    const altarIndex = this.layout.altars.findIndex(p => key(p.x, p.y) === here)
    if (altarIndex >= 0 && !this.questFlags.has(`altar-${this.floor}-${altarIndex}`)) {
      return { label: this.floor === 2 ? `Wake hymn altar ${altarIndex + 1}` : this.floor === 3 ? `Touch black-star memory ${altarIndex + 1}` : `Stabilize anchor sigil ${altarIndex + 1}`, hint: 'This will affect your sanity.' }
    }
    if (this.player.x === this.layout.exit.x && this.player.y === this.layout.exit.y) {
      if (!this.floorObjectiveReady()) return { label: 'Inspect sealed way', hint: this.floorBlockedMessage() }
      if (!this.questFlags.has(`boss-${this.floor}-defeated`)) return { label: `Confront ${ENEMY_DEFS[FLOOR_DATA[this.floor as 1 | 2 | 3 | 4].boss].name}`, hint: 'A major encounter waits beyond the seal.' }
      return { label: this.floor < 4 ? 'Descend' : 'Approach the final threshold', hint: this.floor < 4 ? 'Continue to the next act.' : 'Choose what becomes of the abyss.' }
    }
    return null
  }

  private currentObjective() {
    const data = FLOOR_DATA[this.floor as 1 | 2 | 3 | 4]
    if (this.questFlags.has(`boss-${this.floor}-defeated`)) return this.floor < 4 ? 'The guardian is dead. Return to the stair and descend.' : 'The final threshold is open. Decide what becomes of the abyss.'
    if (this.floor === 1 && this.questFlags.has('salt-seal')) return 'Take the Salt Seal to the far stair and face its guardian.'
    if (this.floor >= 2) {
      const total = this.floor === 4 ? 3 : 2
      const count = Array.from({ length: total }, (_, i) => i).filter(i => this.questFlags.has(`altar-${this.floor}-${i}`)).length
      if (count < total) return `${data.objective} (${count}/${total} complete)`
    }
    return data.objective
  }

  private presentEndingChoices() {
    this.mode = 'ending'
    this.endingTitle = 'THE HEART WAITS'
    this.endingText = 'With the Void Saint gone, the abyss is no longer an enemy. It is a possibility. The final choice belongs to the only witness still standing.'
    this.draw(); this.emit()
  }

  private endingChoices(): ChoiceView[] {
    if (this.mode !== 'ending' || this.endingTitle !== 'THE HEART WAITS') return []
    const choices: ChoiceView[] = [
      { id: 'seal', label: 'Seal the Abyss', description: 'Use the Salt Seal and collapse the route forever.' },
      { id: 'listen', label: 'Listen', description: 'Remain long enough to understand what the Heart was trying to say.' },
      { id: 'enter', label: 'Enter the Dream', description: this.inventory.some(i => i.defId === 'black_star') ? 'Carry the Black Star through the opening.' : 'Requires the Black Star.', disabled: !this.inventory.some(i => i.defId === 'black_star') },
    ]
    if (this.secretCount >= 5 && this.inventory.some(i => i.defId === 'mirror_shard')) {
      choices.push({ id: 'refuse', label: 'Break the Map', description: 'Use the Mirror Shard to reject every route the abyss offers.' })
    }
    return choices
  }

  private chooseEnding(id: string) {
    if (this.mode !== 'ending' || this.endingTitle !== 'THE HEART WAITS') return
    if (id === 'seal') {
      const mara = this.questFlags.has('cartographer-met')
      this.endingTitle = 'ENDING — THE LAST SURVEY'
      this.endingText = `You drive the Salt Seal into the Heart and the buried architecture begins folding inward. ${mara ? 'Mara reaches the surface behind you, carrying the only surviving map.' : 'No other survivor follows you into the daylight.'} The observatory is demolished within the month. You keep one page of your field notes, although the ink rearranges itself whenever it rains.`
    } else if (id === 'listen') {
      this.endingTitle = this.sanity >= Math.ceil(this.maxSanity() * .45) ? 'ENDING — THE TRANSLATOR' : 'ENDING — THE OPEN MOUTH'
      this.endingText = this.sanity >= Math.ceil(this.maxSanity() * .45)
        ? 'You listen without answering. The Heart is not a god but a relay, carrying dreams between worlds too distant for light. You return with a language no human throat can speak and spend the rest of your life building machines that can.'
        : 'You listen until the distinction between hearing and speaking disappears. Months later, radio operators across the coast report a new signal using your voice. You never return to the surface, but something wearing your memories begins answering every call.'
    } else if (id === 'enter' && this.inventory.some(i => i.defId === 'black_star')) {
      this.endingTitle = 'ENDING — BEYOND THE BLACK STAR'
      this.endingText = 'The Black Star opens like an eye. You step through the Heart and the dungeon becomes a shoreline beneath an unfamiliar sky. Behind you, Earth is a tiny dream already fading. Ahead, impossible cities turn their lights on one by one. The expedition ends. The journey does not.'
    } else if (id === 'refuse' && this.secretCount >= 5 && this.inventory.some(i => i.defId === 'mirror_shard')) {
      this.endingTitle = 'SECRET ENDING — THE FIFTH DIRECTION'
      this.endingText = 'You hold the Mirror Shard against the threshold and refuse every offered future. The reflected corridor turns ninety degrees into a direction space was never taught to contain. You leave by a route the abyss cannot follow. On the surface, every map now has a blank margin that points somewhere else.'
    } else return
    this.saveGame(false)
    this.draw(); this.emit()
  }

  private returnToTitle() {
    this.mode = 'title'; this.activeEnemyId = null; this.endingTitle = ''; this.endingText = ''
    this.audio.stopDrone()
    this.drawTitle(); this.emit()
  }

  private addJournalOnce(entry: string) {
    if (!this.journalEntries.includes(entry)) this.journalEntries.push(entry)
  }

  private saveGame(withLog: boolean) {
    if (!this.archetype || !this.layout || this.mode === 'title') { if (withLog) this.emit(); return }
    if (this.hp <= 0) {
      if (withLog) { this.logLines = [...this.logLines, 'A lost expedition cannot overwrite the last valid checkpoint.'].slice(-60); this.draw() }
      return
    }
    const data: SaveData = {
      version: 5, mode: this.mode, seed: this.seed, archetype: this.archetype, floor: this.floor, level: this.level, xp: this.xp,
      layout: this.layout, player: this.player, hp: this.hp, maxHp: this.maxHp, baseMaxSanity: this.baseMaxSanity, sanity: this.sanity,
      steps: this.steps, log: this.logLines, journal: this.journalEntries, inventory: this.inventory, equippedWeaponId: this.equippedWeaponId,
      equippedCharmId: this.equippedCharmId, enemies: this.enemies, loot: this.loot, triggeredEvents: [...this.triggeredEvents], questFlags: [...this.questFlags],
      sanctuaryUsed: [...this.sanctuaryUsed], discovered: [...this.discovered], activeEnemyId: this.activeEnemyId, itemSerial: this.itemSerial, turnSerial: this.turnSerial,
      abilityCooldown: this.abilityCooldown, guarded: this.guarded, counterReady: this.counterReady, endingTitle: this.endingTitle, endingText: this.endingText,
      setpieceTriggered: [...this.setpieceTriggered], secretCount: this.secretCount, audioEnabled: this.audioEnabled, reducedMotion: this.reducedMotion, runStats: { ...this.runStats },
    }
    const saved = storageSet(SAVE_KEY, JSON.stringify(data))
    if (withLog) {
      this.logLines = [...this.logLines, saved ? 'Expedition saved locally.' : 'Local saving is unavailable in this browser context. The current checkpoint was not overwritten.'].slice(-60)
      this.draw()
    }
  }

  private loadGame() {
    const raw = storageGet(SAVE_KEY)
    if (!raw) { this.logLines = [...this.logLines, 'No readable local save exists yet, or browser storage is unavailable.'].slice(-60); this.emit(); return }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isSaveData(parsed)) throw new Error('Unsupported or malformed save')
      const d = parsed
      this.mode = d.mode; this.seed = d.seed; this.archetype = d.archetype; this.floor = d.floor; this.level = d.level; this.xp = d.xp
      this.layout = d.layout; this.player = d.player; this.hp = d.hp; this.maxHp = d.maxHp; this.baseMaxSanity = d.baseMaxSanity; this.sanity = d.sanity
      this.steps = d.steps; this.logLines = [...d.log, 'Local expedition restored.'].slice(-60); this.journalEntries = d.journal; this.inventory = d.inventory
      this.equippedWeaponId = d.equippedWeaponId; this.equippedCharmId = d.equippedCharmId; this.enemies = d.enemies; this.loot = d.loot
      this.triggeredEvents = new Set(d.triggeredEvents); this.questFlags = new Set(d.questFlags); this.sanctuaryUsed = new Set(d.sanctuaryUsed); this.discovered = new Set(d.discovered)
      this.activeEnemyId = d.activeEnemyId; this.itemSerial = d.itemSerial; this.turnSerial = d.turnSerial; this.abilityCooldown = d.abilityCooldown
      this.guarded = d.guarded; this.counterReady = d.counterReady; this.endingTitle = d.endingTitle; this.endingText = d.endingText
      this.setpieceTriggered = new Set(d.setpieceTriggered ?? []); this.secretCount = d.secretCount ?? 0
      const savedAudio = d.audioEnabled ?? true
      const savedMotion = d.reducedMotion ?? false
      this.audioEnabled = savedAudio; this.reducedMotion = savedMotion
      this.loadPreferences()
      this.runStats = d.runStats ?? freshRunStats()
      this.audio.setEnabled(this.audioEnabled); if (this.audioEnabled) this.audio.startDrone(this.floor)
      this.draw(); this.emit()
    } catch {
      storageRemove(SAVE_KEY)
      this.logLines = [...this.logLines, 'The local save was unreadable or unsupported and has been discarded to prevent a broken resume loop.'].slice(-60); this.emit()
    }
  }

  private log(message: string) {
    this.logLines = [...this.logLines, message].slice(-60)
    this.emit()
  }

  private roll() {
    const r = seededRandom(`${this.seed}:${this.floor}:turn:${this.turnSerial++}`)()
    return r
  }

  private randomInt(min: number, max: number) { return min + Math.floor(this.roll() * (max - min + 1)) }

  private sanityState(): SanityState {
    if (this.sanity <= 0) return 'Beyond'
    const ratio = this.sanity / Math.max(1, this.maxSanity())
    if (ratio > .7) return 'Stable'
    if (ratio > .4) return 'Uneasy'
    if (ratio > .2) return 'Distorted'
    return 'Delirious'
  }

  private gameFeel(kind: 'attack' | 'critical' | 'hurt' | 'boss') {
    if (this.reducedMotion) return
    if (kind === 'critical') { this.cameras.main.shake(90, .012); this.cameras.main.flash(45, 210, 225, 210, false) }
    else if (kind === 'hurt') this.cameras.main.shake(120, .009)
    else if (kind === 'boss') { this.cameras.main.shake(260, .014); this.cameras.main.flash(80, 150, 175, 155, false) }
    else this.cameras.main.shake(55, .004)
  }

  private updateBossPhase(enemy: EnemyState) {
    if (!enemy.boss) return
    const def = ENEMY_DEFS[enemy.kind]
    const maxPhase = def.phases ?? 1
    if (maxPhase <= 1) return
    const ratio = enemy.hp / Math.max(1, enemy.maxHp)
    const target = maxPhase === 2 ? (ratio <= .5 ? 2 : 1) : ratio <= .33 ? 3 : ratio <= .66 ? 2 : 1
    if (target > (enemy.phase ?? 1)) {
      enemy.phase = target
      enemy.staggered = false
      this.log(`${def.name} enters phase ${target}. The chamber changes with it.`)
      this.sanity = Math.max(0, this.sanity - 1)
      this.audio.cue('boss', 1.1)
      this.gameFeel('boss')
    }
  }

  private bossAttackText(enemy: EnemyState) {
    const phase = enemy.phase ?? 1
    if (enemy.kind === 'salt_knight') return phase === 1 ? 'sweeps the bell-blade in a mineral arc' : 'shatters its own armor into a storm of salt'
    if (enemy.kind === 'choir') return phase === 1 ? 'releases a chord that buckles the floor' : 'splits into competing voices and screams both futures at once'
    if (enemy.kind === 'abyss_heart') return phase === 1 ? 'contracts and drags the corridor inward' : phase === 2 ? 'beats backwards, returning pain before the strike' : 'opens like a door and lets the outside look in'
    if (enemy.kind === 'void_saint') return phase === 1 ? 'turns gravity sideways with a gesture' : phase === 2 ? 'removes a second from the room and attacks inside the missing time' : 'breaks its halo into three black suns'
    return 'unleashes a crushing pattern'
  }

  private enemyIntent(enemy: EnemyState) {
    const def = ENEMY_DEFS[enemy.kind]
    if (!enemy.boss) {
      if (enemy.kind === 'warden' && (enemy.combatTurn + 1) % 3 === 0) return 'locks its salt shield and prepares a measured strike'
      if (enemy.kind === 'oracle') return 'predicts a thought you have not had yet'
      if (enemy.kind === 'mirror_stalker') return (enemy.combatTurn + 1) % 2 === 0 ? 'mirrors your breathing; the next contact will test sanity' : 'waits for you to choose first'
      if (enemy.kind === 'bell_devourer') return (enemy.combatTurn + 1) % 2 === 0 ? 'swallows every sound before a violent toll' : def.intent
      return def.intent
    }
    const next = enemy.combatTurn + 1
    const phase = enemy.phase ?? 1
    const heavy = next % Math.max(2, 4 - phase) === 0
    if (heavy) return this.bossAttackText(enemy)
    if (enemy.kind === 'void_saint' && phase >= 2) return 'moves its hand toward the place your body will occupy next'
    return `${def.intent} · phase ${phase}/${def.phases ?? 1}`
  }

  private snapshot(): GameSnapshot {
    const enemy = this.activeEnemy()
    const def = enemy ? ENEMY_DEFS[enemy.kind] : null
    const archetype = this.archetype ? ARCHETYPES[this.archetype] : null
    const walkable = this.layout?.map?.reduce((sum, row) => sum + [...row].filter(c => c === '.').length, 0) ?? 0
    return {
      mode: this.mode, hp: this.hp, maxHp: this.maxHp, sanity: this.sanity, maxSanity: this.maxSanity(), level: this.level, xp: this.xp, nextXp: this.nextXp(),
      archetype: this.archetype, archetypeName: archetype?.name ?? '', abilityName: archetype?.abilityName ?? '', abilityReady: this.abilityCooldown === 0,
      passiveName: archetype?.passiveName ?? '', passiveDescription: archetype?.passiveDescription ?? '', guarded: this.guarded,
      log: this.logLines,
      enemy: enemy && def ? { id: enemy.id, name: enemy.nemesisRank ? `Scarred ${def.name}` : enemy.elite ? `Elite ${def.name}` : def.name, hp: enemy.hp, maxHp: enemy.maxHp, description: def.description, boss: enemy.boss, intent: this.enemyIntent(enemy), phase: enemy.phase ?? 1, maxPhase: def.phases ?? 1 } : null,
      dead: this.hp <= 0, seed: this.seed, floor: this.floor, floorName: this.mode === 'title' ? 'The Drowned Observatory' : FLOOR_DATA[this.floor as 1 | 2 | 3 | 4].name,
      objective: this.mode === 'title' ? 'Begin an expedition.' : this.currentObjective(), steps: this.steps, position: this.layout ? `${this.player.x},${this.player.y}` : '-',
      inventory: this.inventory.map(i => ({ ...i })), equippedWeaponId: this.equippedWeaponId, equippedCharmId: this.equippedCharmId,
      hasSave: storageGet(SAVE_KEY) !== null, interaction: this.layout ? this.currentInteraction() : null,
      endingTitle: this.endingTitle, endingText: this.endingText, choices: this.endingChoices(), journal: [...this.journalEntries], discovered: this.discovered.size, totalWalkable: walkable,
      sanityState: this.sanityState(), audioEnabled: this.audioEnabled, reducedMotion: this.reducedMotion, secretCount: this.secretCount, runStats: { ...this.runStats },
    }
  }

  private emit() { this.game.events.emit('snapshot', this.snapshot()) }

  private drawTitle() {
    this.specialText?.setVisible(false)
    this.g.clear(); this.g.fillStyle(0x040604).fillRect(0, 0, 800, 500)
    for (let i = 0; i < 13; i++) {
      const inset = i * 27
      this.g.lineStyle(1, 0x6f8d74, .12 + i * .008)
      this.g.strokeRect(105 + inset / 2, 60 + inset / 3, 590 - inset, 380 - inset / 1.5)
    }
    this.g.lineStyle(3, 0xa6bca9, .55); this.g.strokeCircle(400, 250, 92); this.g.strokeCircle(400, 250, 47)
    this.g.lineStyle(1, 0xa6bca9, .30)
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2
      this.g.strokeLineShape(new Phaser.Geom.Line(400 + Math.cos(a) * 47, 250 + Math.sin(a) * 47, 400 + Math.cos(a) * 120, 250 + Math.sin(a) * 120))
    }
    this.compass.setText('ABYSSAL DESCENT · COMPLETE EXPEDITION')
    this.clearOverlay()
  }

  private draw() {
    if (this.mode === 'title' || !this.layout) { this.drawTitle(); this.emit(); return }
    this.g.clear()
    const w = 800, h = 500
    this.g.fillStyle(0x050806).fillRect(0, 0, w, h)
    this.g.fillStyle(0x101812).fillRect(0, 0, w, 248)
    this.g.fillStyle(0x080c09).fillRect(0, 248, w, 252)

    const sanityRatio = this.sanity / Math.max(1, this.maxSanity())
    const maxDepth = 5
    let visibleDepth = maxDepth
    for (let depth = 1; depth <= maxDepth; depth++) {
      if (this.relativeCell(0, depth) === '#') { visibleDepth = depth; break }
    }
    for (let depth = visibleDepth; depth >= 1; depth--) {
      const cell = this.relativeCell(0, depth)
      const inset = (depth - 1) * 65 + 20
      const top = (depth - 1) * 36 + 22
      const bottom = h - top
      const nextInset = inset + 61
      const nextTop = top + 35
      const wall = cell === '#'
      const jitter = sanityRatio < .3 ? this.randomVisual(-2, 2, depth) : 0
      this.g.lineStyle(3, wall ? 0x91ad97 : 0x45634e, wall ? .95 : .58)
      this.g.strokeLineShape(new Phaser.Geom.Line(inset + jitter, top, nextInset, nextTop))
      this.g.strokeLineShape(new Phaser.Geom.Line(w - inset + jitter, top, w - nextInset, nextTop))
      this.g.strokeLineShape(new Phaser.Geom.Line(inset, bottom + jitter, nextInset, h - nextTop))
      this.g.strokeLineShape(new Phaser.Geom.Line(w - inset, bottom + jitter, w - nextInset, h - nextTop))
      if (wall) {
        this.g.fillStyle(0x162019, .95); this.g.fillRect(nextInset, nextTop, w - nextInset * 2, h - nextTop * 2)
        this.drawGlyphs(nextInset, nextTop, w - nextInset * 2, h - nextTop * 2)
      } else {
        this.drawSideOpenings(depth, inset, top, bottom, nextInset)
      }
    }

    this.drawExitMarker(); this.drawCrosshair(); this.drawMinimap(); this.drawCompass()
    if (this.activeEnemy()) this.drawEnemy(this.activeEnemy()!.kind, this.activeEnemy()!.boss)
    else this.drawHallucinations(sanityRatio)
    this.drawLocalSpecialMarker(); this.drawSetpieceAura()

    if (sanityRatio <= .2) {
      this.g.lineStyle(1, 0xb4cdb8, .09)
      for (let i = 0; i < 24; i++) {
        const y = (i * 47 + this.steps * 13) % 500
        this.g.strokeLineShape(new Phaser.Geom.Line(0, y, 800, y + ((i % 5) - 2)))
      }
    }

    if (this.hp <= 0) this.drawOverlay('LOST TO THE ABYSS', 'Load your save or begin another expedition')
    else if (this.mode === 'ending') this.drawOverlay(this.endingTitle, this.endingTitle === 'THE HEART WAITS' ? 'Your final choice is shown in the expedition panel' : 'The expedition is complete')
    else this.clearOverlay()
    this.emit()
  }

  private randomVisual(min: number, max: number, salt: number) {
    const r = seededRandom(`${this.seed}:visual:${this.steps}:${salt}`)()
    return min + Math.floor(r * (max - min + 1))
  }

  private drawHallucinations(sanityRatio: number) {
    if (sanityRatio > .42) return
    const seed = seededRandom(`${this.seed}:hallucination:${this.floor}:${this.steps}:${this.player.dir}`)
    if (seed() > (sanityRatio <= .2 ? .72 : .38)) return
    const x = 400 + Math.round((seed() - .5) * 120)
    const y = 218 + Math.round((seed() - .5) * 50)
    const size = sanityRatio <= .2 ? 72 : 48
    this.g.fillStyle(0xcbd9cc, sanityRatio <= .2 ? .22 : .12)
    this.g.fillEllipse(x, y, size, size * 1.5)
    this.g.fillStyle(0x050806, .8).fillCircle(x - 10, y - 10, 4).fillCircle(x + 10, y - 10, 4)
    if (sanityRatio <= .2 && seed() > .52) {
      this.g.lineStyle(2, 0xb9cdbd, .20)
      this.g.strokeRect(320 + Math.round((seed() - .5) * 40), 105, 160, 250)
    }
  }

  private drawSideOpenings(depth: number, inset: number, top: number, bottom: number, nextInset: number) {
    const left = this.relativeCell(-1, depth), right = this.relativeCell(1, depth)
    this.g.lineStyle(2, 0x36523f, .65)
    if (left !== '#') this.g.strokeRect(inset, top + 18, Math.max(15, nextInset - inset), Math.max(20, bottom - top - 36))
    if (right !== '#') this.g.strokeRect(800 - nextInset, top + 18, Math.max(15, nextInset - inset), Math.max(20, bottom - top - 36))
  }

  private relativeCell(side: number, forward: number) {
    const d = DIRS[this.player.dir], r = DIRS[((this.player.dir + 1) % 4) as Dir]
    const x = this.player.x + d.x * forward + r.x * side, y = this.player.y + d.y * forward + r.y * side
    return this.layout.map[y]?.[x] ?? '#'
  }

  private drawExitMarker() {
    const d = DIRS[this.player.dir]
    for (let depth = 1; depth <= 5; depth++) {
      const x = this.player.x + d.x * depth, y = this.player.y + d.y * depth
      if (this.layout.map[y]?.[x] === '#') break
      if (x !== this.layout.exit.x || y !== this.layout.exit.y) continue
      const size = Math.max(18, 80 - depth * 11)
      this.g.lineStyle(3, this.floorObjectiveReady() ? 0xc8d7aa : 0x715e54, .9)
      this.g.strokeRect(400 - size / 2, 250 - size, size, size * 1.7); break
    }
  }

  private drawLocalSpecialMarker() {
    if (this.activeEnemy()) { this.specialText?.setVisible(false); return }
    const here = key(this.player.x, this.player.y)
    let symbol = ''
    if (key(this.layout.sanctuary.x, this.layout.sanctuary.y) === here && !this.sanctuaryUsed.has(this.floor)) symbol = '✦ SURVEY LAMP'
    if (this.layout.npc && key(this.layout.npc.x, this.layout.npc.y) === here && !this.questFlags.has('cartographer-met')) symbol = '◇ MARA VEY'
    const altar = this.layout.altars.findIndex(p => key(p.x, p.y) === here)
    if (altar >= 0 && !this.questFlags.has(`altar-${this.floor}-${altar}`)) symbol = this.floor === 2 ? '◉ HYMN ALTAR' : this.floor === 3 ? '✧ BLACK-STAR MEMORY' : '⌬ ANCHOR SIGIL'
    const sp = this.layout.setpieces?.findIndex(p => key(p.x, p.y) === here) ?? -1
    if (sp >= 0) symbol = this.setpieceTriggered.has(`setpiece-${this.floor}-${sp}`) ? '◈ ANOMALOUS CHAMBER · RECORDED' : '◈ ANOMALOUS CHAMBER'
    if (!symbol) { this.specialText?.setVisible(false); return }
    this.g.fillStyle(0x071009, .82).fillRect(265, 394, 270, 35)
    this.g.lineStyle(1, 0x78927d, .7).strokeRect(265, 394, 270, 35)
    if (!this.specialText) {
      this.specialText = this.add.text(400, 411, symbol, { fontFamily: 'monospace', fontSize: '13px', color: '#b9cdbd' }).setOrigin(.5).setDepth(2)
    } else {
      this.specialText.setText(symbol).setVisible(true)
    }
  }

  private drawSetpieceAura() {
    const here = key(this.player.x, this.player.y)
    const index = this.layout.setpieces?.findIndex(p => key(p.x, p.y) === here) ?? -1
    if (index < 0 || this.activeEnemy()) return
    this.g.lineStyle(1, 0xa8c0ac, .16)
    for (let i = 0; i < 4; i++) this.g.strokeCircle(400, 248, 85 + i * 24)
    this.g.lineStyle(2, 0xa8c0ac, .10)
    this.g.strokeLineShape(new Phaser.Geom.Line(250, 248, 550, 248))
    this.g.strokeLineShape(new Phaser.Geom.Line(400, 95, 400, 400))
  }

  private drawEnemy(kind: EnemyKind, boss: boolean) {
    const cx = 400, cy = 245
    this.g.fillStyle(boss ? 0xd8e2cf : 0xc8d9c8, .92)
    if (kind === 'leech' || kind === 'moth') {
      this.g.fillEllipse(cx, cy, boss ? 175 : 125, kind === 'moth' ? 85 : 48)
      this.g.lineStyle(5, 0xc8d9c8, .8)
      for (let i = -3; i <= 3; i++) this.g.strokeLineShape(new Phaser.Geom.Line(cx + i * 13, cy + 10, cx + i * 18, cy + 58))
    } else if (kind === 'warden' || kind === 'salt_knight' || kind === 'pilgrim') {
      this.g.fillRect(cx - (boss ? 50 : 35), cy - 105, boss ? 100 : 70, boss ? 175 : 150)
      this.g.fillCircle(cx, cy - 115, boss ? 42 : 33)
      this.g.fillStyle(0x070a08).fillRect(cx - 25, cy - 123, 50, 8)
      if (boss) { this.g.lineStyle(8, 0xd8e2cf, .9); this.g.strokeLineShape(new Phaser.Geom.Line(cx + 60, cy - 80, cx + 100, cy + 100)) }
    } else if (kind === 'bent' || kind === 'husk' || kind === 'mirror_stalker') {
      this.g.lineStyle(22, 0xc8d9c8, .9); this.g.strokeLineShape(new Phaser.Geom.Line(cx - 38, cy - 135, cx + 6, cy + 42)); this.g.strokeCircle(cx - 46, cy - 145, 30)
      this.g.lineStyle(9, 0xc8d9c8, .9); this.g.strokeLineShape(new Phaser.Geom.Line(cx, cy + 30, cx - 42, cy + 115)); this.g.strokeLineShape(new Phaser.Geom.Line(cx + 5, cy + 30, cx + 62, cy + 105))
    } else if (kind === 'bell_devourer') {
      this.g.fillEllipse(cx, cy - 15, 130, 180); this.g.fillStyle(0x070a08).fillEllipse(cx, cy + 10, 82, 100)
      this.g.lineStyle(7, 0xc8d9c8, .9); this.g.strokeCircle(cx, cy - 75, 42); this.g.strokeLineShape(new Phaser.Geom.Line(cx, cy - 35, cx, cy + 95))
    } else if (kind === 'choir') {
      this.g.fillEllipse(cx, cy - 10, 180, 210)
      this.g.fillStyle(0x070a08)
      for (let i = 0; i < 9; i++) this.g.fillEllipse(cx - 50 + (i % 3) * 50, cy - 80 + Math.floor(i / 3) * 65, 22, 11)
    } else if (kind === 'abyss_heart' || kind === 'void_saint') {
      this.g.lineStyle(kind === 'void_saint' ? 7 : 10, 0xd8e2cf, .92); this.g.strokeCircle(cx, cy - 5, kind === 'void_saint' ? 125 : 105); this.g.strokeCircle(cx, cy - 5, 58)
      for (let i = 0; i < (kind === 'void_saint' ? 12 : 8); i++) {
        const a = i / (kind === 'void_saint' ? 12 : 8) * Math.PI * 2
        this.g.strokeLineShape(new Phaser.Geom.Line(cx + Math.cos(a) * 55, cy - 5 + Math.sin(a) * 55, cx + Math.cos(a) * 145, cy - 5 + Math.sin(a) * 145))
      }
    } else {
      this.g.fillEllipse(cx, cy - 45, 60, 85); this.g.fillStyle(0x070a08).fillCircle(cx - 11, cy - 52, 5).fillCircle(cx + 11, cy - 52, 5)
      this.g.lineStyle(8, 0xc8d9c8, .9); for (let i = -2; i <= 2; i++) this.g.strokeLineShape(new Phaser.Geom.Line(cx + i * 8, cy - 8, cx + i * 26, cy + 90))
    }
  }

  private drawGlyphs(x: number, y: number, w: number, h: number) {
    this.g.lineStyle(1, 0x6f8d74, .22)
    for (let i = 0; i < 9; i++) {
      const gx = x + 20 + ((i * 47) % Math.max(30, w - 40)), gy = y + 20 + ((i * 71) % Math.max(30, h - 40))
      this.g.strokeCircle(gx, gy, 4 + (i % 3) * 3); this.g.strokeLineShape(new Phaser.Geom.Line(gx - 8, gy + 8, gx + 8, gy - 8))
    }
  }

  private drawCrosshair() {
    this.g.lineStyle(1, 0xb4cdb8, .3); this.g.strokeLineShape(new Phaser.Geom.Line(390, 250, 410, 250)); this.g.strokeLineShape(new Phaser.Geom.Line(400, 240, 400, 260))
  }

  private drawMinimap() {
    const scale = 5, ox = 690, oy = 36
    const ratio = this.sanity / Math.max(1, this.maxSanity())
    const lie = ratio <= .35
    const r = seededRandom(`${this.seed}:map-lie:${this.floor}:${Math.floor(this.steps / 3)}`)
    const shiftX = lie && ratio <= .2 ? (r() > .5 ? 1 : -1) : 0
    const shiftY = lie && ratio <= .2 ? (r() > .5 ? 1 : -1) : 0
    this.g.fillStyle(0x030503, .72).fillRect(ox - 8, oy - 8, 103, 83)
    for (let y = 0; y < this.layout.map.length; y++) for (let x = 0; x < this.layout.map[y].length; x++) {
      if (!this.discovered.has(key(x, y))) continue
      if (this.layout.map[y][x] === '.') this.g.fillStyle(0x45634e, .55).fillRect(ox + x * scale, oy + y * scale, 4, 4)
    }
    if (lie) {
      this.g.fillStyle(0x6d8b72, .18)
      for (let i = 0; i < (ratio <= .2 ? 5 : 2); i++) {
        const fx = 1 + Math.floor(r() * 15), fy = 1 + Math.floor(r() * 11)
        this.g.fillRect(ox + fx * scale, oy + fy * scale, 4, 4)
      }
    }
    const marker = (p: { x: number; y: number } | null, color: number, size = 3) => {
      if (!p || !this.discovered.has(key(p.x, p.y))) return
      this.g.fillStyle(color, .9).fillRect(ox + p.x * scale, oy + p.y * scale, size, size)
    }
    marker(this.layout.exit, this.floorObjectiveReady() ? 0xd7c989 : 0x8f765f, 4)
    if (!this.sanctuaryUsed.has(this.floor)) marker(this.layout.sanctuary, 0x8bb8a2, 3)
    if (this.layout.npc && !this.questFlags.has('cartographer-met')) marker(this.layout.npc, 0x9cb0d2, 3)
    this.layout.altars.forEach((p, i) => { if (!this.questFlags.has(`altar-${this.floor}-${i}`)) marker(p, 0xb295ba, 3) })
    this.g.fillStyle(0xd7e3d8, 1).fillRect(ox + (this.player.x + shiftX) * scale - 1, oy + (this.player.y + shiftY) * scale - 1, 6, 6)
  }

  private surveyBearing() {
    if (this.archetype !== 'surveyor') return ''
    let targets: Array<{ x: number; y: number }> = []
    if (this.questFlags.has(`boss-${this.floor}-defeated`)) targets = [this.layout.exit]
    else if (this.floor === 1 && !this.questFlags.has('salt-seal') && this.layout.miniboss) targets = [this.layout.miniboss]
    else if (this.floor >= 2 && !this.floorObjectiveReady()) targets = this.layout.altars.filter((_, i) => !this.questFlags.has(`altar-${this.floor}-${i}`))
    else targets = [this.layout.exit]
    if (!targets.length) return ''

    const routes = targets.map(target => {
      const distances = bfsDistances(this.layout.map, target)
      return { target, distances, distance: distances.get(key(this.player.x, this.player.y)) ?? Infinity }
    }).filter(route => Number.isFinite(route.distance))
    if (!routes.length) return ''
    const best = routes.reduce((a, b) => b.distance < a.distance ? b : a)
    if (best.distance === 0) return ' · SURVEY HERE'
    const labels = ['N', 'E', 'S', 'W']
    for (let dir = 0; dir < DIRS.length; dir++) {
      const d = DIRS[dir]
      const nextDistance = best.distances.get(key(this.player.x + d.x, this.player.y + d.y))
      if (nextDistance === best.distance - 1) return ` · SURVEY ${labels[dir]} ${best.distance}`
    }
    return ` · SURVEY ? ${best.distance}`
  }

  private drawCompass() {
    const labels = ['N', 'E', 'S', 'W']
    this.compass.setText(`${labels[this.player.dir]} · ${this.player.x},${this.player.y} · ${FLOOR_DATA[this.floor as 1 | 2 | 3 | 4].name}${this.surveyBearing()}`)
  }

  private drawOverlay(title: string, subtitle: string) {
    this.g.fillStyle(0x020302, .79).fillRect(0, 0, 800, 500)
    if (!this.overlayText) {
      this.overlayText = this.add.text(400, 220, title, { fontFamily: 'Georgia, serif', fontSize: '34px', color: '#d3dfd4', align: 'center', wordWrap: { width: 650 } }).setOrigin(.5).setDepth(5)
      this.overlaySubtext = this.add.text(400, 275, subtitle, { fontFamily: 'monospace', fontSize: '14px', color: '#89a18d', align: 'center', wordWrap: { width: 650 } }).setOrigin(.5).setDepth(5)
    } else {
      this.overlayText.setText(title).setVisible(true); this.overlaySubtext?.setText(subtitle).setVisible(true)
    }
  }

  private clearOverlay() { this.overlayText?.setVisible(false); this.overlaySubtext?.setVisible(false) }
}
