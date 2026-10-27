import {
  BUILD_COST, CARGO, OBJECTIVES, START_DATE, STATION_COST, STATION_MAINTENANCE, TILE, VEHICLES, WATER_LEVEL
} from './constants.js'
import { dateParts, distance, formatMoney, mulberry32, uid } from './utils.js'

const DAY_SECONDS = 1.35
const VEHICLE_KIND = { train: 'rail', bus: 'bus', truck: 'truck', ship: 'dock', plane: 'airport' }
const MODE_LIFT = { train: 0.26, bus: 0.15, truck: 0.15, ship: 0.05, plane: 0.5 }

function smoothPoints(points, iterations = 1) {
  if (points.length < 3) return points.map(p => ({ ...p }))
  let pts = points.map(p => ({ x: p.x, y: p.y, z: p.z }))
  for (let it = 0; it < iterations; it++) {
    const out = [{ ...pts[0] }]
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]
      const p1 = pts[i + 1]
      out.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25, z: p0.z * 0.75 + p1.z * 0.25 })
      out.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75, z: p0.z * 0.25 + p1.z * 0.75 })
    }
    out.push({ ...pts[pts.length - 1] })
    pts = out
  }
  return pts
}

function cumulative(points) {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z))
  }
  return lengths
}

function samplePath(points, lengths, length, at) {
  if (!points || points.length === 0) return null
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, z: points[0].z, yaw: 0, pitch: 0 }
  }
  if (at <= 0) {
    const a = points[0]
    const b = points[1]
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len, uz = dz / len
    return {
      x: a.x + ux * at, y: a.y + (dy / (len || 1)) * at, z: a.z + uz * at,
      yaw: Math.atan2(dx, dz), pitch: -Math.atan2(dy, len)
    }
  }
  if (at >= length) {
    const a = points[points.length - 2]
    const b = points[points.length - 1]
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const extra = at - length
    return {
      x: b.x + (dx / len) * extra, y: b.y + (dy / len) * extra, z: b.z + (dz / len) * extra,
      yaw: Math.atan2(dx, dz), pitch: -Math.atan2(dy, len)
    }
  }
  let lo = 0
  let hi = lengths.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] <= at) lo = mid
    else hi = mid
  }
  const a = points[lo]
  const b = points[hi] || points[lo]
  const seg = (lengths[hi] - lengths[lo]) || 1
  const t = (at - lengths[lo]) / seg
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
  const horizontal = Math.hypot(dx, dz) || 1
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
    z: a.z + dz * t,
    yaw: Math.atan2(dx, dz),
    pitch: -Math.atan2(dy, horizontal)
  }
}

export class Game {
  constructor(world, renderer) {
    this.world = world
    this.renderer = renderer
    this.vehicles = []
    renderer.sceneVehicles = this.vehicles
    this.money = 450000
    this.loan = 0
    this.maxLoan = 500000
    this.speed = 1
    this.paused = true
    this.started = false
    this.totalDays = 0
    this.lastDay = 0
    this.lastMonthKey = -1
    this.vehicleSeq = 0
    this.listeners = new Map()
    this.finance = {
      revenue: 0,
      construction: 0,
      vehicles: 0,
      maintenance: 0,
      interest: 0,
      history: []
    }
    this.stats = {
      passengers: 0,
      freight: 0,
      revenue: 0,
      deliveredTrips: 0,
      servedPopulation: 0
    }
    this.objectives = OBJECTIVES.map(o => ({ ...o, complete: false }))
    this.news = []
    this.victory = false
    this.lastDeliveryToast = -10
    this.rng = mulberry32(424242)
    this.updateServedPopulation()
    this.recordHistory()
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(callback)
    return () => this.listeners.get(event)?.delete(callback)
  }

  emit(event, data) {
    const set = this.listeners.get(event)
    if (set) for (const cb of set) cb(data)
  }

  toast(text, type = 'info') {
    this.emit('toast', { text, type })
  }

  addNews(text, type = 'info') {
    this.news.unshift({ text, type, day: this.totalDays })
    if (this.news.length > 8) this.news.length = 8
    this.emit('news', this.news)
  }

  start() {
    if (this.started) return
    this.started = true
    this.paused = false
    this.renderer.setStarterView()
    this.addNews('Welcome to Transit 3D. Your first two bus stops are ready.')
    this.toast('Your two starter bus stops are glowing. Click the first to plan a route.', 'hint')
  }

  setSpeed(speed) {
    this.speed = speed
    if (speed > 0) this.paused = false
    this.emit('speed', { speed, paused: this.paused })
  }

  togglePause() {
    this.paused = !this.paused
    this.emit('speed', { speed: this.speed, paused: this.paused })
  }

  getDate() {
    return dateParts(START_DATE, this.totalDays)
  }

  companyValue() {
    let assets = 0
    for (const v of this.vehicles) assets += v.cost * 0.58
    for (const s of this.world.stations) assets += (STATION_COST[s.kind] || 5000) * 0.6
    let road = 0
    let rail = 0
    for (const tile of this.world.tiles) {
      if (tile.road > 0) road++
      if (tile.rail > 0) rail++
    }
    assets += road * BUILD_COST.road * 0.35 + rail * BUILD_COST.rail * 0.4
    return this.money - this.loan + assets
  }

  updateServedPopulation() {
    let pop = 0
    for (const town of this.world.towns) {
      for (const stationId of town.stations) {
        const station = this.world.stationById.get(stationId)
        if (!station) continue
        if (Math.hypot(station.center.x - town.x, station.center.y - town.y) < town.radius + 5) {
          pop += town.population
          break
        }
      }
    }
    this.stats.servedPopulation = pop
  }

  recordHistory() {
    this.finance.history.push({
      day: this.totalDays,
      money: this.money,
      value: this.companyValue()
    })
    if (this.finance.history.length > 24) this.finance.history.shift()
  }

  spend(cost, category = 'construction') {
    if (cost <= 0) return true
    if (this.money < cost) {
      this.toast(`Not enough cash. Need ${formatMoney(cost)}.`, 'error')
      return false
    }
    this.money -= cost
    this.finance[category] = (this.finance[category] || 0) + cost
    return true
  }

  earn(amount) {
    if (amount <= 0) return
    this.money += amount
    this.finance.revenue += amount
    this.stats.revenue += amount
  }

  takeLoan(amount = 100000) {
    if (this.loan + amount > this.maxLoan) {
      this.toast('The bank will not lend any more right now.', 'error')
      return
    }
    this.loan += amount
    this.money += amount
    this.addNews(`Bank loan of ${formatMoney(amount)} taken.`)
    this.emit('finance')
  }

  repayLoan(amount = 100000) {
    const actual = Math.min(amount, this.loan)
    if (actual <= 0) return
    if (this.money < actual) {
      this.toast('Not enough cash to repay the loan.', 'error')
      return
    }
    this.money -= actual
    this.loan -= actual
    this.addNews(`Repaid ${formatMoney(actual)} of the bank loan.`)
    this.emit('finance')
  }

  // -------------------------------------------------------------------------
  // Build actions
  // -------------------------------------------------------------------------

  estimateRoad(path) {
    return this.world.estimateRoadPath(path)
  }

  estimateRail(path) {
    return this.world.estimateRailPath(path)
  }

  buildRoad(path) {
    const estimate = this.world.estimateRoadPath(path)
    if (!estimate.ok) {
      this.toast(estimate.reason || 'Cannot build here.', 'error')
      return { ok: false }
    }
    if (estimate.cost > 0 && !this.spend(estimate.cost, 'construction')) return { ok: false }
    const result = this.world.layRoadPath(path)
    if (!result.ok) {
      if (estimate.cost > 0) this.money += estimate.cost
      this.toast(result.reason || 'Cannot build here.', 'error')
      return result
    }
    this.renderer.buildNetworkMeshes()
    this.emit('network')
    return result
  }

  buildRail(path) {
    const estimate = this.world.estimateRailPath(path)
    if (!estimate.ok) {
      this.toast(estimate.reason || 'Cannot build here.', 'error')
      return { ok: false }
    }
    if (estimate.cost > 0 && !this.spend(estimate.cost, 'construction')) return { ok: false }
    const result = this.world.layRailPath(path)
    if (!result.ok) {
      if (estimate.cost > 0) this.money += estimate.cost
      this.toast(result.reason || 'Cannot build here.', 'error')
      return result
    }
    this.renderer.buildNetworkMeshes()
    this.emit('network')
    return result
  }

  stationInfo(kind, x, y) {
    return this.world.stationPlacementInfo(kind, x, y)
  }

  placeStation(kind, x, y) {
    const info = this.world.stationPlacementInfo(kind, x, y)
    if (!info.ok) {
      this.toast(info.reason || 'Cannot build a station here.', 'error')
      return { ok: false }
    }
    if (!this.spend(info.cost, 'construction')) return { ok: false }
    const result = this.world.placeStation(kind, x, y)
    if (!result.ok) {
      this.money += info.cost
      this.toast(result.reason || 'Cannot build a station here.', 'error')
      return result
    }
    if (kind === 'rail') this.renderer.buildNetworkMeshes()
    this.renderer.addStation(result.station)
    this.addNews(`${result.station.name} opened.`)
    this.updateServedPopulation()
    this.emit('stations')
    return result
  }

  bulldoze(x, y) {
    const tile = this.world.getTile(x, y)
    if (!tile) return { ok: false }
    if (tile.stationId) {
      const station = this.world.stationById.get(tile.stationId)
      if (!station) return { ok: false }
      this.removeStationAndAdjust(station)
      return { ok: true, removed: 'station' }
    }
    const result = this.world.bulldoze(x, y)
    if (!result.ok) {
      this.toast(result.reason || 'Nothing to remove.', 'error')
      return result
    }
    if (!this.spend(result.cost, 'construction')) return { ok: false }
    if (result.removed === 'road' || result.removed === 'rail') this.renderer.buildNetworkMeshes()
    if (result.removed === 'tree') this.renderer.rebuildTrees()
    this.emit('network')
    return result
  }

  plantTree(x, y) {
    const result = this.world.plantTree(x, y)
    if (!result.ok) {
      this.toast(result.reason || 'Cannot plant here.', 'error')
      return result
    }
    if (!this.spend(result.cost, 'construction')) {
      this.world.bulldoze(x, y)
      return { ok: false }
    }
    this.renderer.rebuildTrees()
    return result
  }

  removeStationAndAdjust(station) {
    const affected = this.vehicles.filter(v => v.orders.includes(station.id))
    this.world.removeStation(station)
    this.renderer.removeStation(station)
    if (station.kind === 'rail') this.renderer.buildNetworkMeshes()
    for (const vehicle of affected) {
      vehicle.orders = vehicle.orders.filter(id => id !== station.id)
      this.resyncVehicleStations(vehicle)
      if (vehicle.orders.length < 2) {
        vehicle.state = 'idle'
        vehicle.pathPoints = null
      } else {
        vehicle.orderIndex = 0
        vehicle.state = 'docked'
        vehicle.dwell = 1.2
        vehicle.pathPoints = null
      }
      if (this.renderer.selected?.type === 'vehicle' && this.renderer.selected.id === vehicle.id) {
        this.renderer.clearRoutes()
      }
    }
    if (this.renderer.selected?.type === 'station' && this.renderer.selected.id === station.id) {
      this.renderer.setSelection(null)
    }
    this.updateServedPopulation()
    this.emit('stations')
    this.emit('vehicles')
    this.addNews(`${station.name} was demolished.`)
  }

  // -------------------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------------------

  routePathFor(type, origin, destination) {
    if (type === 'plane') return this.buildPlanePath(origin, destination)
    const pointPath = this.world.findStationPath(type, origin, destination)
    if (!pointPath) return null
    const lift = MODE_LIFT[type] ?? 0.15
    const points = pointPath.map(p => {
      const center = this.world.tileCenter(p.x, p.y)
      const y = type === 'ship' ? WATER_LEVEL + lift : center.y + lift
      return { x: center.x, y, z: center.z }
    })
    const smoothed = smoothPoints(points, type === 'train' ? 1 : 1)
    const lengths = cumulative(smoothed)
    return { points: smoothed, lengths, length: lengths[lengths.length - 1] }
  }

  buildPlanePath(origin, destination) {
    const a = this.world.tileCenter(origin.center.x, origin.center.y)
    const b = this.world.tileCenter(destination.center.x, destination.center.y)
    const groundA = a.y + MODE_LIFT.plane
    const groundB = b.y + MODE_LIFT.plane
    const dist = Math.hypot(b.x - a.x, b.z - a.z)
    const altitude = 32 + dist * 0.05
    const points = []
    const samples = 34
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const arc = Math.sin(Math.PI * t) * altitude
      points.push({
        x: a.x + (b.x - a.x) * t,
        y: groundA + (groundB - groundA) * t + arc,
        z: a.z + (b.z - a.z) * t
      })
    }
    const lengths = cumulative(points)
    return { points, lengths, length: lengths[lengths.length - 1] }
  }

  cargoCanFlow(type, cargo, origin, destination) {
    if (!origin || !destination) return false
    if (!VEHICLES[type]?.cargos.includes(cargo)) return false
    return Boolean(destination.accepts.has(cargo))
  }

  canBuildRoute(type, originId, destinationId) {
    const origin = this.world.stationById.get(originId)
    const destination = this.world.stationById.get(destinationId)
    if (!origin || !destination || origin.id === destination.id) return { ok: false, reason: 'Choose two different stations' }
    const kind = VEHICLE_KIND[type]
    if (origin.kind !== kind || destination.kind !== kind) return { ok: false, reason: `This vehicle needs two ${kind} stations` }
    if (type !== 'plane' && !this.world.findStationPath(type, origin, destination)) {
      return { ok: false, reason: 'No connected route between those stations' }
    }
    return { ok: true }
  }

  createVehicle({ type, cargo, originId, destinationId }) {
    const def = VEHICLES[type]
    if (!def) return { ok: false }
    if (!def.cargos.includes(cargo)) {
      this.toast(`${def.label} cannot carry ${CARGO[cargo]?.name || cargo}.`, 'error')
      return { ok: false }
    }
    const check = this.canBuildRoute(type, originId, destinationId)
    if (!check.ok) {
      this.toast(check.reason, 'error')
      return { ok: false }
    }
    const origin = this.world.stationById.get(originId)
    const destination = this.world.stationById.get(destinationId)
    if (!this.spend(def.cost, 'vehicles')) return { ok: false }
    const id = `vehicle_${this.vehicleSeq++}`
    const vehicle = {
      id,
      type,
      cargo,
      capacity: def.capacity,
      cost: def.cost,
      speed: def.speed,
      maintenance: def.maintenance,
      orders: [originId, destinationId],
      orderIndex: 0,
      travelTo: 1,
      state: 'docked',
      dwell: 1.6,
      progress: 0,
      path: null,
      pathPoints: null,
      pathLengths: null,
      pathLength: 0,
      load: 0,
      loadedFrom: null,
      loadDistance: 0,
      totalProfit: 0,
      totalDelivered: 0,
      name: `${def.label} ${this.vehicles.filter(v => v.type === type).length + 1}`,
      warned: false,
      retry: 0,
      pose: null,
      carPoses: null,
      spacing: type === 'train' ? 3.9 : 0
    }
    this.vehicles.push(vehicle)
    this.resyncVehicleStations(vehicle)
    this.setDockedPose(vehicle, origin)
    this.renderer.addVehicle(vehicle)
    this.renderer.syncVehicle(vehicle)
    this.serviceStation(vehicle, origin, true)
    this.addNews(`${vehicle.name} entered service from ${origin.name}.`)
    this.toast(`${vehicle.name} is carrying ${CARGO[cargo].name.toLowerCase()} to ${destination.name}.`, 'success')
    this.emit('vehicles')
    return { ok: true, vehicle }
  }

  cloneVehicle(vehicleId) {
    const source = this.vehicles.find(v => v.id === vehicleId)
    if (!source) return { ok: false }
    const result = this.createVehicle({
      type: source.type,
      cargo: source.cargo,
      originId: source.orders[0],
      destinationId: source.orders[1]
    })
    if (result.ok && result.vehicle) {
      result.vehicle.name = `${source.name} (copy)`
    }
    return result
  }

  sellVehicle(vehicleId) {
    const vehicle = this.vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return
    const refund = Math.round(vehicle.cost * 0.5)
    this.money += refund
    this.finance.vehicles = Math.max(0, this.finance.vehicles - refund)
    for (const station of this.world.stations) station.vehicles.delete(vehicle.id)
    this.renderer.removeVehicle(vehicle)
    this.vehicles = this.vehicles.filter(v => v.id !== vehicle.id)
    this.renderer.sceneVehicles = this.vehicles
    if (this.renderer.selected?.type === 'vehicle' && this.renderer.selected.id === vehicle.id) {
      this.renderer.setSelection(null)
    }
    this.addNews(`${vehicle.name} sold for ${formatMoney(refund)}.`)
    this.emit('vehicles')
  }

  addOrder(vehicleId, stationId) {
    const vehicle = this.vehicles.find(v => v.id === vehicleId)
    const station = this.world.stationById.get(stationId)
    if (!vehicle || !station) return
    if (station.kind !== VEHICLE_KIND[vehicle.type]) {
      this.toast('That station is not compatible with this vehicle.', 'error')
      return
    }
    if (vehicle.orders.includes(stationId)) {
      this.toast('That station is already on the route.', 'error')
      return
    }
    vehicle.orders.push(stationId)
    this.resyncVehicleStations(vehicle)
    if (vehicle.state === 'idle') {
      vehicle.state = 'docked'
      vehicle.dwell = 0.6
      vehicle.orderIndex = 0
    }
    this.toast(`${station.name} added to ${vehicle.name}'s orders.`, 'success')
    this.emit('vehicles')
  }

  resyncVehicleStations(vehicle) {
    for (const station of this.world.stations) station.vehicles.delete(vehicle.id)
    for (const id of vehicle.orders) {
      const station = this.world.stationById.get(id)
      if (station) station.vehicles.add(vehicle.id)
    }
  }

  stationDistanceTiles(a, b) {
    return distance(a.center.x, a.center.y, b.center.x, b.center.y)
  }

  setDockedPose(vehicle, station) {
    if (!station) return
    const center = this.world.tileCenter(station.center.x, station.center.y)
    const lift = MODE_LIFT[vehicle.type] ?? 0.15
    const y = vehicle.type === 'ship' ? WATER_LEVEL + lift : center.y + lift
    const nextIndex = (vehicle.orderIndex + 1) % Math.max(1, vehicle.orders.length)
    const next = this.world.stationById.get(vehicle.orders[nextIndex]) || station
    const nextPos = this.world.tileCenter(next.center.x, next.center.y)
    const dx = nextPos.x - center.x
    const dz = nextPos.z - center.z
    const yaw = Math.atan2(dx, dz)
    vehicle.pose = { x: center.x, y, z: center.z, yaw, pitch: 0 }
    if (vehicle.type === 'train') {
      const len = Math.hypot(dx, dz) || 1
      const ux = dx / len
      const uz = dz / len
      const poses = []
      for (let i = 0; i < 4; i++) {
        poses.push({
          x: center.x - ux * i * vehicle.spacing,
          y,
          z: center.z - uz * i * vehicle.spacing,
          yaw,
          pitch: 0
        })
      }
      vehicle.carPoses = poses
    }
  }

  serviceStation(vehicle, station, initial = false) {
    if (!station) return
    const nextIndex = (vehicle.orderIndex + 1) % Math.max(1, vehicle.orders.length)
    const nextStation = this.world.stationById.get(vehicle.orders[nextIndex]) || station
    if (vehicle.load > 0) {
      const cargo = CARGO[vehicle.cargo]
      const accepted = this.world.deliverCargo(station, vehicle.cargo, vehicle.load)
      if (accepted) {
        const fare = vehicle.load * (vehicle.loadDistance * 2.4 + 18) * cargo.value
        const revenue = Math.max(1, Math.round(fare))
        this.earn(revenue)
        vehicle.totalProfit += revenue
        vehicle.totalDelivered += vehicle.load
        if (vehicle.cargo === 'passengers') this.stats.passengers += vehicle.load
        else this.stats.freight += vehicle.load
        this.stats.deliveredTrips += 1
        station.rating = Math.min(1, station.rating + 0.018)
        if (revenue >= 900 && this.totalDays - this.lastDeliveryToast > 2.5) {
          this.lastDeliveryToast = this.totalDays
          this.toast(`${vehicle.name} delivered ${Math.round(vehicle.load)} ${cargo.unit} to ${station.name} · +${formatMoney(revenue)}`, 'money')
        }
      } else if (!vehicle.warned) {
        vehicle.warned = true
        this.toast(`${station.name} does not accept ${CARGO[vehicle.cargo].name.toLowerCase()}. Choose a different destination.`, 'error')
      }
      vehicle.load = 0
    }
    if (!initial) station.rating = Math.min(1, station.rating + 0.006)
    if (station.produces.has(vehicle.cargo)) {
      const available = station.cargo[vehicle.cargo] || 0
      const want = Math.min(vehicle.capacity, available)
      const taken = this.world.takeCargo(station, vehicle.cargo, want)
      if (taken > 0) {
        vehicle.load = taken
        vehicle.loadedFrom = station.id
        vehicle.loadDistance = Math.max(6, this.stationDistanceTiles(station, nextStation))
        station.rating = Math.min(1, station.rating + 0.01)
      }
    }
    vehicle.warned = false
  }

  updateVehicle(vehicle, dt) {
    if (vehicle.state === 'idle') return
    if (vehicle.state === 'docked') {
      vehicle.dwell -= dt
      if (vehicle.dwell <= 0) this.departVehicle(vehicle)
      return
    }
    if (vehicle.state === 'blocked') {
      vehicle.retry -= dt
      if (vehicle.retry <= 0) {
        const origin = this.world.stationById.get(vehicle.orders[vehicle.orderIndex])
        if (origin) this.setDockedPose(vehicle, origin)
        this.departVehicle(vehicle)
      }
      return
    }
    if (vehicle.state !== 'moving') return
    if (!vehicle.pathPoints) {
      vehicle.state = 'blocked'
      vehicle.retry = 2
      return
    }
    vehicle.progress += vehicle.speed * dt
    if (vehicle.progress >= vehicle.pathLength) {
      vehicle.progress = vehicle.pathLength
      this.setPoseFromPath(vehicle)
      this.arriveVehicle(vehicle)
      return
    }
    this.setPoseFromPath(vehicle)
  }

  departVehicle(vehicle) {
    if (vehicle.orders.length < 2) {
      vehicle.state = 'idle'
      return
    }
    const origin = this.world.stationById.get(vehicle.orders[vehicle.orderIndex])
    const nextIndex = (vehicle.orderIndex + 1) % vehicle.orders.length
    const destination = this.world.stationById.get(vehicle.orders[nextIndex])
    if (!origin || !destination) {
      vehicle.state = 'blocked'
      vehicle.retry = 3
      return
    }
    const path = this.routePathFor(vehicle.type, origin, destination)
    if (!path) {
      if (!vehicle.warned) {
        vehicle.warned = true
        this.toast(`${vehicle.name} has no connected route to ${destination.name}.`, 'error')
        this.addNews(`${vehicle.name} is waiting for a connection to ${destination.name}.`, 'warning')
      }
      vehicle.state = 'blocked'
      vehicle.retry = 4
      return
    }
    vehicle.pathPoints = path.points
    vehicle.pathLengths = path.lengths
    vehicle.pathLength = path.length
    vehicle.travelTo = nextIndex
    vehicle.progress = 0
    vehicle.state = 'moving'
    vehicle.warned = false
    this.setPoseFromPath(vehicle)
  }

  arriveVehicle(vehicle) {
    vehicle.orderIndex = vehicle.travelTo
    vehicle.state = 'docked'
    vehicle.dwell = 1.5
    const station = this.world.stationById.get(vehicle.orders[vehicle.orderIndex])
    if (station) {
      this.serviceStation(vehicle, station, false)
      this.setDockedPose(vehicle, station)
    }
  }

  setPoseFromPath(vehicle) {
    const pose = samplePath(vehicle.pathPoints, vehicle.pathLengths, vehicle.pathLength, vehicle.progress)
    if (!pose) return
    vehicle.pose = pose
    if (vehicle.type === 'train') {
      if (!vehicle.carPoses) vehicle.carPoses = []
      for (let i = 0; i < 4; i++) {
        const carPose = samplePath(vehicle.pathPoints, vehicle.pathLengths, vehicle.pathLength, vehicle.progress - i * vehicle.spacing)
        vehicle.carPoses[i] = carPose || pose
      }
    }
  }

  routeSegmentsForVehicle(vehicle) {
    if (!vehicle) return []
    const segments = []
    const count = vehicle.orders.length
    if (count < 2) return []
    const pairs = count === 2 ? 1 : count
    for (let i = 0; i < pairs; i++) {
      const origin = this.world.stationById.get(vehicle.orders[i])
      const destination = this.world.stationById.get(vehicle.orders[(i + 1) % count])
      if (!origin || !destination) continue
      const path = this.routePathFor(vehicle.type, origin, destination)
      let points
      if (path && path.points.length >= 2) {
        const lift = vehicle.type === 'plane' ? 0.5 : 1.15
        points = path.points.map(p => ({ x: p.x, y: p.y + lift, z: p.z }))
      } else {
        const a = this.world.tileCenter(origin.center.x, origin.center.y)
        const b = this.world.tileCenter(destination.center.x, destination.center.y)
        points = [
          { x: a.x, y: a.y + 1.15, z: a.z },
          { x: b.x, y: b.y + 1.15, z: b.z }
        ]
      }
      segments.push({ points, color: i % 2 ? '#7fd1ff' : '#7fffd4' })
    }
    return segments
  }

  routeSegmentsForStation(station) {
    if (!station) return []
    const segments = []
    let i = 0
    for (const vehicleId of station.vehicles) {
      const vehicle = this.vehicles.find(v => v.id === vehicleId)
      if (!vehicle) continue
      const a = station
      const b = this.world.stationById.get(vehicle.orders.find(id => id !== station.id))
      if (!b) continue
      const p = this.world.tileCenter(a.center.x, a.center.y)
      const q = this.world.tileCenter(b.center.x, b.center.y)
      segments.push({
        points: [{ x: p.x, y: p.y + 0.8, z: p.z }, { x: q.x, y: q.y + 0.8, z: q.z }],
        color: i % 2 ? '#7fd1ff' : '#7fffd4'
      })
      i++
    }
    return segments
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  update(dtReal) {
    if (!this.started || this.paused) return
    const dt = Math.min(0.08, dtReal)
    const scaled = dt * this.speed
    this.totalDays += scaled / DAY_SECONDS
    while (this.lastDay < Math.floor(this.totalDays)) {
      this.lastDay++
      this.dailyTick()
    }
    const parts = this.getDate()
    const key = parts.year * 12 + parts.month
    if (this.lastMonthKey === -1) this.lastMonthKey = key
    while (this.lastMonthKey < key) {
      this.lastMonthKey++
      this.monthlyTick()
    }
    for (const vehicle of this.vehicles) this.updateVehicle(vehicle, scaled)
  }

  dailyTick() {
    for (const station of this.world.stations) this.world.produceDaily(station)
    let maintenance = 0
    for (const vehicle of this.vehicles) maintenance += vehicle.maintenance
    if (maintenance > 0) {
      this.money -= maintenance
      this.finance.maintenance += maintenance
    }
    if (this.money < 0 && !this.debtWarned) {
      this.debtWarned = true
      this.toast('Your company is in debt. Take a loan or sell a vehicle.', 'error')
    }
    if (this.money > 0) this.debtWarned = false
  }

  monthlyTick() {
    const interest = Math.round(this.loan * 0.045 / 12)
    if (interest > 0) {
      this.money -= interest
      this.finance.interest += interest
    }
    let maintenance = 0
    for (const station of this.world.stations) maintenance += STATION_MAINTENANCE[station.kind] || 120
    this.money -= maintenance
    this.finance.maintenance += maintenance
    const newHouses = this.world.growTowns()
    if (newHouses.length) this.renderer.rebuildHouses()
    this.world.updateIndustries()
    this.updateServedPopulation()
    this.recordHistory()
    this.checkObjectives()
    this.emit('month')
  }

  checkObjectives() {
    const values = {
      passengers: this.stats.passengers,
      freight: this.stats.freight,
      value: this.companyValue(),
      servedPopulation: this.stats.servedPopulation
    }
    for (const objective of this.objectives) {
      if (objective.complete) continue
      if ((values[objective.stat] || 0) >= objective.goal) {
        objective.complete = true
        this.money += objective.reward
        this.addNews(`Contract complete: ${objective.text}. Bonus ${formatMoney(objective.reward)}.`, 'success')
        this.toast(`Contract complete · ${formatMoney(objective.reward)} bonus`, 'success')
        this.emit('objectives')
      }
    }
    if (!this.victory && this.objectives.every(o => o.complete)) {
      this.victory = true
      this.addNews('Your transport empire is complete. Keep building to grow even further!', 'success')
      this.emit('victory')
    }
  }
}
