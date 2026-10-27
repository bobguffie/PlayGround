import { describe, expect, it } from 'vitest'
import { Game } from '../src/game/game.js'
import { World } from '../src/game/world.js'

function makeGame() {
  const world = new World(20260426)
  const renderer = {
    sceneVehicles: [],
    addVehicle() {},
    removeVehicle() {},
    syncVehicle() {},
    addStation() {},
    removeStation() {},
    buildNetworkMeshes() {},
    rebuildTrees() {},
    rebuildHouses() {},
    setSelection() {},
    clearRoutes() {},
    setStarterView() {}
  }
  return { world, renderer, game: new Game(world, renderer) }
}

describe('economy and vehicles', () => {
  it('buys a bus between the starter stops and loads available passengers', () => {
    const { world, game } = makeGame()
    const stops = world.stations.filter(s => s.kind === 'bus')
    const before = game.money
    const result = game.createVehicle({
      type: 'bus',
      cargo: 'passengers',
      originId: stops[0].id,
      destinationId: stops[1].id
    })
    expect(result.ok).toBe(true)
    expect(game.money).toBe(before - 7600)
    expect(game.vehicles).toHaveLength(1)
    const vehicle = game.vehicles[0]
    expect(vehicle.state).toBe('docked')
    expect(vehicle.load).toBeGreaterThan(0)
    expect(vehicle.load).toBeLessThanOrEqual(vehicle.capacity)
    expect(vehicle.orders).toEqual([stops[0].id, stops[1].id])
  })

  it('pays revenue when passengers are delivered to an accepting station', () => {
    const { world, game } = makeGame()
    const stops = world.stations.filter(s => s.kind === 'bus')
    game.createVehicle({
      type: 'bus',
      cargo: 'passengers',
      originId: stops[0].id,
      destinationId: stops[1].id
    })
    const vehicle = game.vehicles[0]
    vehicle.orderIndex = 0
    vehicle.load = 30
    vehicle.loadDistance = 18
    const moneyBefore = game.money
    const deliveredBefore = game.stats.passengers
    game.serviceStation(vehicle, stops[1], false)
    expect(game.stats.passengers).toBe(deliveredBefore + 30)
    expect(game.stats.deliveredTrips).toBe(1)
    expect(game.money).toBeGreaterThan(moneyBefore)
    expect(vehicle.totalProfit).toBeGreaterThan(0)
  })

  it('rejects a route between incompatible station types', () => {
    const { world, game } = makeGame()
    const stop = world.stations.find(s => s.kind === 'bus')
    const result = game.createVehicle({
      type: 'train',
      cargo: 'passengers',
      originId: stop.id,
      destinationId: stop.id
    })
    expect(result.ok).toBe(false)
    expect(game.vehicles).toHaveLength(0)
  })
})
