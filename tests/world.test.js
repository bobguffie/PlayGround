import { describe, expect, it } from 'vitest'
import { World } from '../src/game/world.js'

describe('world generation', () => {
  const world = new World(20260426)

  it('creates a deterministic populated map', () => {
    expect(world.size).toBe(80)
    expect(world.tiles).toHaveLength(80 * 80)
    expect(world.towns).toHaveLength(6)
    expect(world.industries).toHaveLength(9)
    expect(world.trees.length).toBeGreaterThan(50)
    expect(world.houses.length).toBeGreaterThan(200)
  })

  it('places two connected starter bus stops', () => {
    const stops = world.stations.filter(s => s.kind === 'bus')
    expect(stops).toHaveLength(2)
    expect(stops[0].name).toContain('Bus Stop')
    expect(stops[0].produces.has('passengers')).toBe(true)
    expect(stops[1].accepts.has('passengers')).toBe(true)
    const path = world.findStationPath('bus', stops[0], stops[1])
    expect(path).not.toBeNull()
    expect(path.length).toBeGreaterThan(2)
    expect(stops[0].cargo.passengers).toBeGreaterThan(0)
  })

  it('generates the same world for the same seed', () => {
    const copy = new World(20260426)
    expect(copy.towns.map(t => [t.name, t.x, t.y])).toEqual(world.towns.map(t => [t.name, t.x, t.y]))
    expect(copy.stations.map(s => s.name)).toEqual(world.stations.map(s => s.name))
  })

  it('validates station placement and road building', () => {
    const stop = world.stations.find(s => s.kind === 'bus')
    expect(world.stationPlacementInfo('bus', stop.center.x, stop.center.y).ok).toBe(false)
    expect(world.stationPlacementInfo('bus', stop.center.x + 1, stop.center.y).reason).toMatch(/road/i)
  })
})
