const DIRS = [
  { dx: 0, dy: -1, bit: 1 },
  { dx: 1, dy: 0, bit: 2 },
  { dx: 0, dy: 1, bit: 4 },
  { dx: -1, dy: 0, bit: 8 }
]

export const DIR_LIST = DIRS
export const DIR_BITS = { N: 1, E: 2, S: 4, W: 8 }

export function oppositeBit(bit) {
  return bit === 1 ? 4 : bit === 4 ? 1 : bit === 2 ? 8 : 2
}

function key(x, y) {
  return `${x},${y}`
}

class MinHeap {
  constructor() { this.items = [] }
  push(item, priority) {
    const node = { item, priority }
    this.items.push(node)
    let i = this.items.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.items[p].priority <= node.priority) break
      this.items[i] = this.items[p]
      i = p
    }
    this.items[i] = node
  }
  pop() {
    if (!this.items.length) return null
    const root = this.items[0]
    const last = this.items.pop()
    if (this.items.length && last) {
      let i = 0
      const len = this.items.length
      while (true) {
        let smallest = i
        const l = i * 2 + 1
        const r = l + 1
        if (l < len && this.items[l].priority < this.items[smallest].priority) smallest = l
        if (r < len && this.items[r].priority < this.items[smallest].priority) smallest = r
        if (smallest === i) break
        this.items[i] = this.items[smallest]
        i = smallest
      }
      this.items[i] = last
      while (i > 0) {
        const p = (i - 1) >> 1
        if (this.items[p].priority <= this.items[i].priority) break
        const tmp = this.items[i]
        this.items[i] = this.items[p]
        this.items[p] = tmp
        i = p
      }
    }
    return root.item
  }
  get size() { return this.items.length }
}

/**
 * A* on a tile grid.
 * `walkable(x, y)` tells whether a tile can be entered.
 * `canStep(fromX, fromY, toX, toY)` optionally validates the actual edge.
 */
export function findPath({
  start,
  goal,
  walkable,
  canStep,
  size = 80,
  diagonal = false,
  maxNodes = 40000,
  heuristic = 'manhattan'
}) {
  if (!start || !goal) return null
  if (start.x === goal.x && start.y === goal.y) return [{ x: start.x, y: goal.y }]
  if (!walkable(goal.x, goal.y)) return null

  const open = new MinHeap()
  const fields = -1 + (diagonal ? Math.SQRT2 - 1 : 0) + 1
  const gScore = new Map()
  const cameFrom = new Map()
  const closed = new Set()
  const startKey = key(start.x, start.y)
  const h = (x, y) => heuristic === 'chebyshev'
    ? Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y)) * fields
    : (Math.abs(x - goal.x) + Math.abs(y - goal.y)) * fields

  gScore.set(startKey, 0)
  open.push({ x: start.x, y: start.y }, h(start.x, start.y))
  let expanded = 0

  const dirs = diagonal
    ? [
        ...DIRS,
        { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
      ]
    : DIRS

  while (open.size) {
    const current = open.pop()
    const currentKey = key(current.x, current.y)
    if (current.x === goal.x && current.y === goal.y) {
      const path = [{ x: current.x, y: current.y }]
      let cursor = currentKey
      while (cameFrom.has(cursor)) {
        const prev = cameFrom.get(cursor)
        path.push({ x: prev.x, y: prev.y })
        cursor = key(prev.x, prev.y)
      }
      path.reverse()
      return path
    }
    if (closed.has(currentKey)) continue
    closed.add(currentKey)
    if (++expanded > maxNodes) break

    const currentG = gScore.get(currentKey) ?? Infinity
    for (const dir of dirs) {
      const nx = current.x + dir.dx
      const ny = current.y + dir.dy
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      if (!walkable(nx, ny)) continue
      if (canStep && !canStep(current.x, current.y, nx, ny)) continue
      if (diagonal && dir.dx && dir.dy) {
        if (!walkable(current.x + dir.dx, current.y) || !walkable(current.x, current.y + dir.dy)) continue
      }
      const nextKey = key(nx, ny)
      if (closed.has(nextKey)) continue
      const stepCost = dir.dx && dir.dy ? Math.SQRT2 : 1
      const tentative = currentG + stepCost
      if (tentative < (gScore.get(nextKey) ?? Infinity)) {
        cameFrom.set(nextKey, current)
        gScore.set(nextKey, tentative)
        open.push({ x: nx, y: ny }, tentative + h(nx, ny))
      }
    }
  }
  return null
}

export function orthogonalPath(x1, y1, x2, y2, horizontalFirst = true) {
  const points = []
  if (horizontalFirst) {
    const stepX = Math.sign(x2 - x1)
    for (let x = x1; x !== x2 + stepX; x += stepX || 1) points.push({ x, y: y1 })
    const stepY = Math.sign(y2 - y1)
    for (let y = y1 + stepY; y !== y2 + stepY; y += stepY || 1) points.push({ x: x2, y })
  } else {
    const stepY = Math.sign(y2 - y1)
    for (let y = y1; y !== y2 + stepY; y += stepY || 1) points.push({ x: x1, y })
    const stepX = Math.sign(x2 - x1)
    for (let x = x1 + stepX; x !== x2 + stepX; x += stepX || 1) points.push({ x, y: y2 })
  }
  return points.filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y)
}

export function pathLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  }
  return total
}

export function cumulativeLengths(points) {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z))
  }
  return lengths
}

export function chaikin(points, iterations = 1, closed = false) {
  if (points.length < 3) return points.map(p => ({ ...p }))
  let pts = points.map(p => ({ x: p.x, z: p.z }))
  for (let it = 0; it < iterations; it++) {
    const out = []
    if (!closed) out.push({ ...pts[0] })
    const count = closed ? pts.length : pts.length - 1
    for (let i = 0; i < count; i++) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % pts.length]
      out.push({ x: p0.x * 0.75 + p1.x * 0.25, z: p0.z * 0.75 + p1.z * 0.25 })
      out.push({ x: p0.x * 0.25 + p1.x * 0.75, z: p0.z * 0.25 + p1.z * 0.75 })
    }
    if (!closed) out.push({ ...pts[pts.length - 1] })
    pts = out
  }
  return pts
}
