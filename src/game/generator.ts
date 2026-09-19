import type { DungeonLayout, Point } from './types'

export function seededRandom(seedText: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h || 0x9e3779b9
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rnd: () => number) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const key = (p: Point) => `${p.x},${p.y}`

export function generateDungeon(seed: string, width = 19, height = 15, floor = 1): DungeonLayout {
  if (width % 2 === 0 || height % 2 === 0) throw new Error('Dungeon dimensions must be odd.')
  const rnd = seededRandom(seed)
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'))
  const start = { x: 1, y: 1 }
  grid[start.y][start.x] = '.'

  const stack: Point[] = [start]
  const dirs = [{ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }]
  while (stack.length) {
    const current = stack[stack.length - 1]
    const choices = shuffle(dirs, rnd).filter(({ x, y }) => {
      const nx = current.x + x
      const ny = current.y + y
      return nx > 0 && ny > 0 && nx < width - 1 && ny < height - 1 && grid[ny][nx] === '#'
    })
    if (!choices.length) { stack.pop(); continue }
    const d = choices[0]
    const nx = current.x + d.x
    const ny = current.y + d.y
    grid[current.y + d.y / 2][current.x + d.x / 2] = '.'
    grid[ny][nx] = '.'
    stack.push({ x: nx, y: ny })
  }

  const loopChance = floor === 1 ? .09 : floor === 2 ? .12 : floor === 3 ? .14 : .18
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] !== '#' || rnd() > loopChance) continue
      const horizontal = grid[y][x - 1] === '.' && grid[y][x + 1] === '.'
      const vertical = grid[y - 1][x] === '.' && grid[y + 1][x] === '.'
      if (horizontal || vertical) grid[y][x] = '.'
    }
  }

  const distances = bfsDistances(grid, start)
  const points = [...distances.entries()].map(([k, distance]) => {
    const [x, y] = k.split(',').map(Number)
    return { p: { x, y }, distance }
  }).sort((a, b) => a.distance - b.distance)

  const exit = points[points.length - 1]?.p ?? start
  const used = new Set<string>([key(start), key(exit)])
  const takeByBand = (minRatio: number, maxRatio: number, count: number) => {
    const maxDistance = Math.max(...points.map(p => p.distance), 1)
    const candidates = shuffle(points.filter(({ p, distance }) => {
      const ratio = distance / maxDistance
      return ratio >= minRatio && ratio <= maxRatio && !used.has(key(p))
    }).map(v => v.p), rnd)
    const out: Point[] = []
    for (const p of candidates) {
      if (out.length >= count) break
      if (used.has(key(p))) continue
      used.add(key(p)); out.push(p)
    }
    return out
  }

  const sanctuary = takeByBand(.06, .22, 1)[0] ?? start
  const npc = floor === 2 ? (takeByBand(.18, .38, 1)[0] ?? null) : null
  const altars = floor === 2
    ? takeByBand(.40, .78, 2)
    : floor === 3
      ? takeByBand(.35, .82, 2)
      : floor === 4
        ? takeByBand(.25, .88, 3)
        : []
  const miniboss = floor === 1
    ? (takeByBand(.50, .80, 1)[0] ?? null)
    : floor === 3
      ? (takeByBand(.55, .86, 1)[0] ?? null)
      : null
  const setpieces = takeByBand(.18, .90, 2)

  const enemyCount = floor === 1 ? 6 : floor === 2 ? 8 : floor === 3 ? 9 : 10
  const lootCount = floor === 1 ? 7 : floor === 4 ? 9 : 8
  const eventCount = floor === 1 ? 6 : floor === 2 ? 8 : floor === 3 ? 10 : 12

  return {
    map: grid.map(row => row.join('')),
    start,
    exit,
    enemySpawns: takeByBand(.20, .94, enemyCount),
    lootSpawns: takeByBand(.15, .90, lootCount),
    eventSpawns: takeByBand(.16, .92, eventCount),
    sanctuary,
    npc,
    altars,
    miniboss,
    setpieces,
  }
}

export function bfsDistances(grid: string[][] | string[], start: Point) {
  const result = new Map<string, number>()
  const queue: Point[] = [start]
  result.set(key(start), 0)
  const steps = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    const d = result.get(key(p))!
    for (const s of steps) {
      const n = { x: p.x + s.x, y: p.y + s.y }
      const nk = key(n)
      const cell = typeof grid[n.y] === 'string' ? (grid[n.y] as string)?.[n.x] : (grid[n.y] as string[] | undefined)?.[n.x]
      if (cell !== '.' || result.has(nk)) continue
      result.set(nk, d + 1)
      queue.push(n)
    }
  }
  return result
}
