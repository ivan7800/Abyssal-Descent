export type Dir = 0 | 1 | 2 | 3
export type ArchetypeId = 'surveyor' | 'occultist' | 'veteran'
export type GameMode = 'title' | 'playing' | 'ending'
export type ItemKind = 'weapon' | 'charm' | 'consumable' | 'quest'
export type SanityState = 'Stable' | 'Uneasy' | 'Distorted' | 'Delirious' | 'Beyond'

export type RunStats = {
  kills: number
  bossesDefeated: number
  elitesDefeated: number
  damageDealt: number
  damageTaken: number
  itemsUsed: number
  retreats: number
  rests: number
}

export type InventoryItem = {
  instanceId: string
  defId: string
  name: string
  kind: ItemKind
  description: string
  attackBonus?: number
  defenseBonus?: number
  maxSanityBonus?: number
  critBonus?: number
  sanityResist?: number
  healOnKill?: number
  heal?: number
  restoreSanity?: number
  quantity?: number
  unique?: boolean
}

export type EnemyView = {
  id: string
  name: string
  hp: number
  maxHp: number
  description: string
  boss: boolean
  intent: string
  phase: number
  maxPhase: number
}

export type ChoiceView = {
  id: string
  label: string
  description: string
  disabled?: boolean
}

export type GameSnapshot = {
  mode: GameMode
  hp: number
  maxHp: number
  sanity: number
  maxSanity: number
  sanityState: SanityState
  level: number
  xp: number
  nextXp: number
  archetype: ArchetypeId | null
  archetypeName: string
  abilityName: string
  abilityReady: boolean
  passiveName: string
  passiveDescription: string
  guarded: boolean
  log: string[]
  enemy: EnemyView | null
  dead: boolean
  seed: string
  floor: number
  floorName: string
  objective: string
  steps: number
  position: string
  inventory: InventoryItem[]
  equippedWeaponId: string | null
  equippedCharmId: string | null
  hasSave: boolean
  interaction: { label: string; hint: string } | null
  endingTitle: string
  endingText: string
  choices: ChoiceView[]
  journal: string[]
  discovered: number
  totalWalkable: number
  audioEnabled: boolean
  reducedMotion: boolean
  secretCount: number
  runStats: RunStats
}

export type Point = { x: number; y: number }

export type DungeonLayout = {
  map: string[]
  start: Point
  exit: Point
  enemySpawns: Point[]
  lootSpawns: Point[]
  eventSpawns: Point[]
  sanctuary: Point
  npc: Point | null
  altars: Point[]
  miniboss: Point | null
  setpieces: Point[]
}
