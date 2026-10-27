import { describe, expect, it } from 'vitest'
import { DIR_BITS, findPath, oppositeBit, orthogonalPath } from '../src/game/pathfinding.js'

describe('pathfinding', () => {
  it('builds an orthogonal path that starts and ends at the requested tiles', () => {
    const path = orthogonalPath(2, 3, 7, 6, true)
    expect(path[0]).toEqual({ x: 2, y: 3 })
    expect(path[path.length - 1]).toEqual({ x: 7, y: 6 })
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].x - path[i - 1].x)
      const dy = Math.abs(path[i].y - path[i - 1].y)
      expect(dx + dy).toBe(1)
    }
    expect(path).toHaveLength(9)
  })

  it('honours the requested first axis', () => {
    const path = orthogonalPath(0, 0, 3, 2, false)
    expect(path.slice(0, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 }
    ])
  })

  it('finds a shortest walkable path around obstacles', () => {
    const blocked = new Set(['1,0', '1,1', '1,2'])
    const path = findPath({
      start: { x: 0, y: 1 },
      goal: { x: 2, y: 1 },
      size: 4,
      walkable: (x, y) => !blocked.has(`${x},${y}`)
    })
    expect(path[0]).toEqual({ x: 0, y: 1 })
    expect(path[path.length - 1]).toEqual({ x: 2, y: 1 })
    expect(path.length).toBeGreaterThan(3)
    for (const step of path) expect(blocked.has(`${step.x},${step.y}`)).toBe(false)
  })

  it('returns null when no path exists', () => {
    const path = findPath({
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 3 },
      size: 4,
      walkable: (x, y) => (x === 0 && y === 0) || (x === 3 && y === 3)
    })
    expect(path).toBeNull()
  })

  it('maps each direction bit to its opposite', () => {
    expect(oppositeBit(DIR_BITS.N)).toBe(DIR_BITS.S)
    expect(oppositeBit(DIR_BITS.S)).toBe(DIR_BITS.N)
    expect(oppositeBit(DIR_BITS.E)).toBe(DIR_BITS.W)
    expect(oppositeBit(DIR_BITS.W)).toBe(DIR_BITS.E)
  })
})
