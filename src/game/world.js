import {
  MAP_SIZE, TILE, WATER_LEVEL, STATION_COST, BUILD_COST, STATION_MAINTENANCE
} from './constants.js'
import { INDUSTRY_TYPES, TOWN_NAMES, TOWN_ACCEPTS, TOWN_PRODUCES } from './constants.js'
import { clamp, fbm, lerp, mulberry32, randomChoice, roman, smoothstep, uid } from './utils.js'
import { findPath, DIR_LIST, DIR_BITS, oppositeBit, orthogonalPath } from './pathfinding.js'

const COLORS = {
  walls: ['#e8d8bb', '#d9c4a3', '#e6c9a8', '#cfb59c', '#e9e0cd', '#d7b9a0', '#c7b7a3', '#efd9b4'],
  roofs: ['#9b4b3b', '#7d3d35', '#465a68', '#5d5a52', '#b06745', '#684a3f', '#4f6b5a']
}

export class World {
  constructor(seed = 20260426) {
    this.seed = seed
    this.rng = mulberry32(seed)
    this.size = MAP_SIZE
    this.tileSize = TILE
    this.townNamesUsed = new Set()
    this.vertexHeights = new Float32Array((MAP_SIZE + 1) * (MAP_SIZE + 1))
    this.tileHeights = new Float32Array(MAP_SIZE * MAP_SIZE)
    this.tiles = new Array(MAP_SIZE * MAP_SIZE)
    this.towns = []
    this.industries = []
    this.stations = []
    this.houses = []
    this.trees = []
    this.stationById = new Map()
    this.townById = new Map()
    this.industryById = new Map()
    this.houseSeq = 0
    this.stationSeq = 0
    this.industrySeq = 0
    this.generate()
  }

  idx(x, y) {
    return y * this.size + x
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size
  }

  vertexIndex(x, y) {
    return y * (this.size + 1) + x
  }

  rawVertexHeight(x, y) {
    return this.vertexHeights[this.vertexIndex(x, y)]
  }

  vertexHeight(x, y) {
    const cx = clamp(x, 0, this.size)
    const cy = clamp(y, 0, this.size)
    return this.vertexHeights[this.vertexIndex(cx, cy)]
  }

  tileHeight(x, y) {
    if (!this.inBounds(x, y)) return -2
    return this.tileHeights[this.idx(x, y)]
  }

  rawTileHeight(x, y) {
    const a = this.rawVertexHeight(x, y)
    const b = this.rawVertexHeight(x + 1, y)
    const c = this.rawVertexHeight(x, y + 1)
    const d = this.rawVertexHeight(x + 1, y + 1)
    return (a + b + c + d) / 4
  }

  tileSlope(x, y) {
    const a = this.rawVertexHeight(x, y)
    const b = this.rawVertexHeight(x + 1, y)
    const c = this.rawVertexHeight(x, y + 1)
    const d = this.rawVertexHeight(x + 1, y + 1)
    return Math.max(a, b, c, d) - Math.min(a, b, c, d)
  }

  isWater(x, y) {
    return this.tileHeight(x, y) < WATER_LEVEL + 0.06
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return null
    return this.tiles[this.idx(x, y)]
  }

  worldX(x) {
    return (x - this.size / 2 + 0.5) * this.tileSize
  }

  worldZ(y) {
    return (y - this.size / 2 + 0.5) * this.tileSize
  }

  tileCenter(x, y, lift = 0) {
    return { x: this.worldX(x), y: this.tileHeight(x, y) + lift, z: this.worldZ(y) }
  }

  tileFromWorld(wx, wz) {
    return {
      x: Math.floor(wx / this.tileSize + this.size / 2),
      y: Math.floor(wz / this.tileSize + this.size / 2)
    }
  }

  generate() {
    this.generateTerrain()
    this.pickTownSites()
    this.pickIndustrySites()
    this.flattenSites()
    this.computeTileHeights()
    this.initTiles()
    for (const town of this.towns) this.growTownLayout(town)
    this.placeIndustries()
    this.connectStarterTowns()
    this.placeStarterStops()
    this.scatterTrees()
    for (const station of this.stations) this.refreshStationContext(station)
  }

  generateTerrain() {
    const n = this.size
    for (let gy = 0; gy <= n; gy++) {
      for (let gx = 0; gx <= n; gx++) {
        const nx = gx / n
        const ny = gy / n
        const continent = fbm(nx * 2.35 + 4.2, ny * 2.35 + 9.1, this.seed, 4)
        const detail = fbm(nx * 8.5, ny * 8.5, this.seed + 31, 3) - 0.5
        let h = 1.25 + continent * 4.6 + detail * 1.15
        const edge = Math.min(gx, gy, n - gx, n - gy) / n
        h -= (1 - smoothstep(0.015, 0.15, edge)) * 4.8
        const radial = Math.hypot(nx - 0.5, ny - 0.5) / 0.7071
        h -= Math.max(0, radial - 0.9) * 9
        const lake = 1 - smoothstep(0.29, 0.4, continent)
        h -= lake * 4.4
        const lakeNoise = fbm(nx * 3.4 + 17.2, ny * 3.4 + 3.8, this.seed + 77, 3)
        h -= Math.max(0, lakeNoise - 0.63) * 7
        this.vertexHeights[this.vertexIndex(gx, gy)] = Math.max(-2.4, h)
      }
    }
  }

  pickTownSites() {
    const rng = this.rng
    const chosen = []
    const isGood = (x, y, minTownDist) => {
      if (x < 12 || y < 12 || x > this.size - 12 || y > this.size - 12) return false
      const h = this.rawTileHeight(x, y)
      if (h < WATER_LEVEL + 0.75 || h > 7.2) return false
      if (this.rawSlope(x, y) > 2.1) return false
      for (const t of chosen) {
        if (Math.hypot(t.x - x, t.y - y) < minTownDist) return false
      }
      return true
    }
    const centerCandidates = []
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(this.size / 2 + (rng() - 0.5) * 26)
      const y = Math.floor(this.size / 2 + (rng() - 0.5) * 26)
      if (!isGood(x, y, 0)) continue
      centerCandidates.push({ x, y, score: Math.hypot(x - this.size / 2, y - this.size / 2) + this.rawSlope(x, y) * 4 + rng() * 2 })
    }
    centerCandidates.sort((a, b) => a.score - b.score)
    const first = centerCandidates[0] || { x: Math.floor(this.size / 2), y: Math.floor(this.size / 2) }
    const radii = [10, 8, 9, 7, 8, 9, 7]
    this.addTown(first.x, first.y, radii[0], 'Havenbrook')
    chosen.push(first)

    let attempts = 0
    while (this.towns.length < 6 && attempts++ < 900) {
      const x = 11 + Math.floor(rng() * (this.size - 22))
      const y = 11 + Math.floor(rng() * (this.size - 22))
      if (!isGood(x, y, 17)) continue
      const radius = radii[this.towns.length] || 8
      const name = this.uniqueTownName()
      this.addTown(x, y, radius, name)
      chosen.push({ x, y })
    }
  }

  uniqueTownName() {
    for (let tries = 0; tries < 100; tries++) {
      const name = randomChoice(this.rng, TOWN_NAMES)
      if (!this.townNamesUsed.has(name)) {
        this.townNamesUsed.add(name)
        return name
      }
    }
    return `Town ${this.towns.length + 1}`
  }

  addTown(x, y, radius, name) {
    this.townNamesUsed.add(name)
    const town = {
      id: `town_${this.towns.length}`,
      name,
      x,
      y,
      radius,
      population: Math.round(750 + radius * 150 + this.rng() * 500),
      basePopulation: 0,
      growth: 0,
      houses: [],
      landmarks: [],
      stations: new Set(),
      served: false
    }
    town.basePopulation = town.population
    this.towns.push(town)
    this.townById.set(town.id, town)
    return town
  }

  rawSlope(x, y) {
    const a = this.rawVertexHeight(x, y)
    const b = this.rawVertexHeight(x + 1, y)
    const c = this.rawVertexHeight(x, y + 1)
    const d = this.rawVertexHeight(x + 1, y + 1)
    return Math.max(a, b, c, d) - Math.min(a, b, c, d)
  }

  pickIndustrySites() {
    const rng = this.rng
    const types = ['coalMine', 'powerPlant', 'farm', 'factory', 'forest', 'sawmill', 'oilWell', 'refinery', 'steelMill']
    const chosen = []
    const fits = (x, y, fp) => {
      if (x < 4 || y < 4 || x + fp >= this.size - 4 || y + fp >= this.size - 4) return false
      const h = this.rawTileHeight(x, y)
      if (h < WATER_LEVEL + 0.65 || h > 7.4) return false
      let min = Infinity
      let max = -Infinity
      for (let yy = y; yy < y + fp; yy++) {
        for (let xx = x; xx < x + fp; xx++) {
          const hh = this.rawTileHeight(xx, yy)
          min = Math.min(min, hh)
          max = Math.max(max, hh)
        }
      }
      if (max - min > 1.7) return false
      for (const t of this.towns) {
        if (Math.hypot(t.x - x, t.y - y) < t.radius + 4) return false
      }
      for (const s of chosen) {
        if (Math.hypot(s.x - x, s.y - y) < 11) return false
      }
      return true
    }
    for (const type of types) {
      const fp = INDUSTRY_TYPES[type].footprint
      let tries = 0
      while (tries++ < 600) {
        const x = 4 + Math.floor(rng() * (this.size - 8 - fp))
        const y = 4 + Math.floor(rng() * (this.size - 8 - fp))
        if (!fits(x, y, fp)) continue
        chosen.push({ type, x, y, fp })
        break
      }
    }
    this.industrySites = chosen
  }

  flattenSites() {
    for (const town of this.towns) {
      const target = clamp(this.rawTileHeight(town.x, town.y), 0.9, 5.8)
      this.flattenArea(town.x + 0.5, town.y + 0.5, town.radius * 0.58, town.radius + 3.2, target)
    }
    for (const site of this.industrySites) {
      const target = clamp(this.rawTileHeight(site.x + site.fp / 2, site.y + site.fp / 2), 0.8, 5.6)
      this.flattenArea(site.x + site.fp / 2, site.y + site.fp / 2, site.fp * 0.7, site.fp + 3.5, target)
    }
  }

  flattenArea(cx, cy, inner, outer, target) {
    const x0 = Math.max(0, Math.floor(cx - outer))
    const x1 = Math.min(this.size, Math.ceil(cx + outer))
    const y0 = Math.max(0, Math.floor(cy - outer))
    const y1 = Math.min(this.size, Math.ceil(cy + outer))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > outer) continue
        const weight = 1 - smoothstep(inner, outer, d)
        if (weight <= 0) continue
        const i = this.vertexIndex(x, y)
        this.vertexHeights[i] = lerp(this.vertexHeights[i], target, weight * 0.985)
      }
    }
  }

  computeTileHeights() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.tileHeights[this.idx(x, y)] = this.rawTileHeight(x, y)
      }
    }
  }

  initTiles() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const water = this.tileHeight(x, y) < WATER_LEVEL + 0.06
        this.tiles[this.idx(x, y)] = {
          x, y,
          type: water ? 'water' : 'empty',
          road: 0,
          rail: 0,
          stationId: null,
          townId: null,
          industryId: null,
          houseId: null,
          treeId: null,
          lift: 0
        }
      }
    }
  }

  growTownLayout(town) {
    const { x: cx, y: cy, radius: r } = town
    const offsets = [0, -Math.round(r * 0.48), Math.round(r * 0.48)]
    for (const off of offsets) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.hypot(x - cx, off) <= r + 0.6) this.forceRoad(x, cy + off)
      }
      for (let y = cy - r; y <= cy + r; y++) {
        if (Math.hypot(off, y - cy) <= r + 0.6) this.forceRoad(cx + off, y)
      }
    }

    const hallSpots = [
      { x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 },
      { x: cx + 2, y: cy + 1 }, { x: cx - 2, y: cy - 1 }
    ]
    for (const spot of hallSpots) {
      const t = this.getTile(spot.x, spot.y)
      if (!t || t.type !== 'empty') continue
      this.spawnHouse(town, spot.x, spot.y, { landmark: 'townhall', w: 3.6, d: 3.2, h: 4.0 })
      break
    }
    let churchPlaced = false
    for (const spot of hallSpots.slice().reverse()) {
      if (churchPlaced) break
      const t = this.getTile(spot.x + 3, spot.y - 2)
      if (!t || t.type !== 'empty') continue
      if (Math.hypot(spot.x + 3 - cx, spot.y - 2 - cy) > r - 1) continue
      this.spawnHouse(town, spot.x + 3, spot.y - 2, { landmark: 'church', w: 2.8, d: 3.4, h: 5.0 })
      churchPlaced = true
    }

    const candidates = []
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue
        if (Math.hypot(x - cx, y - cy) > r - 0.4) continue
        const tile = this.getTile(x, y)
        if (!tile || tile.type !== 'empty') continue
        if (!this.hasAdjacentRoad(x, y)) continue
        candidates.push({ x, y })
      }
    }
    for (const c of candidates) {
      const density = 0.82 - (Math.hypot(c.x - cx, c.y - cy) / r) * 0.15
      if (this.rng() > density) continue
      const tile = this.getTile(c.x, c.y)
      if (!tile || tile.type !== 'empty') continue
      this.spawnHouse(town, c.x, c.y, { landmark: this.rng() < 0.04 ? 'church' : null })
    }

    const extra = []
    for (let i = 0; i < 20; i++) {
      const x = cx + Math.floor((this.rng() - 0.5) * r * 1.7)
      const y = cy + Math.floor((this.rng() - 0.5) * r * 1.7)
      const tile = this.getTile(x, y)
      if (!tile || tile.type !== 'empty') continue
      if (Math.hypot(x - cx, y - cy) > r - 1) continue
      if (this.hasAdjacentRoad(x, y)) continue
      extra.push({ x, y })
    }
    for (const c of extra) {
      if (this.rng() < 0.6) this.spawnHouse(town, c.x, c.y, {})
    }
  }

  spawnHouse(town, x, y, options = {}) {
    const tile = this.getTile(x, y)
    if (!tile) return null
    if (!options.force && tile.type !== 'empty') return null
    if (options.force) {
      if (tile.type === 'road') return null
      if (tile.rail > 0 || tile.stationId) return null
    }
    const rng = this.rng
    const landmark = options.landmark || null
    const house = {
      id: `house_${this.houseSeq++}`,
      x, y,
      townId: town.id,
      rot: Math.floor(rng() * 4) * Math.PI / 2,
      w: options.w ?? 2.1 + rng() * 1.1,
      d: options.d ?? 1.9 + rng() * 1.0,
      h: options.h ?? 2.3 + rng() * 1.6,
      wall: randomChoice(rng, COLORS.walls),
      roof: randomChoice(rng, COLORS.roofs),
      landmark
    }
    tile.type = 'house'
    tile.houseId = house.id
    tile.townId = town.id
    town.houses.push(house)
    if (landmark) town.landmarks.push(house)
    this.houses.push(house)
    return house
  }

  forceRoad(x, y) {
    if (!this.inBounds(x, y)) return false
    const tile = this.getTile(x, y)
    if (!tile) return false
    if (tile.type !== 'empty' && tile.type !== 'road') return false
    if (this.isWater(x, y) || this.tileSlope(x, y) > 2.15) return false
    tile.type = 'road'
    tile.road = tile.road || 1
    this.autoConnectRoad(x, y)
    return true
  }

  hasAdjacentRoad(x, y) {
    for (const dir of DIR_LIST) {
      const t = this.getTile(x + dir.dx, y + dir.dy)
      if (t && (t.type === 'road' || t.road > 0)) return true
    }
    return false
  }

  autoConnectRoad(x, y) {
    const tile = this.getTile(x, y)
    if (!tile) return
    for (const dir of DIR_LIST) {
      const neighbor = this.getTile(x + dir.dx, y + dir.dy)
      if (neighbor && neighbor.road > 0) {
        tile.road |= dir.bit
        neighbor.road |= oppositeBit(dir.bit)
      }
    }
  }

  autoConnectRail(x, y) {
    const tile = this.getTile(x, y)
    if (!tile) return
    for (const dir of DIR_LIST) {
      const neighbor = this.getTile(x + dir.dx, y + dir.dy)
      if (neighbor && neighbor.rail > 0) {
        tile.rail |= dir.bit
        neighbor.rail |= oppositeBit(dir.bit)
      }
    }
  }

  placeIndustries() {
    for (const site of this.industrySites) {
      const def = INDUSTRY_TYPES[site.type]
      const industry = {
        id: `industry_${this.industrySeq++}`,
        type: site.type,
        label: def.label,
        x: site.x,
        y: site.y,
        w: site.fp,
        h: site.fp,
        cx: site.x + site.fp / 2,
        cy: site.y + site.fp / 2,
        production: def.production,
        baseProduction: def.production,
        efficiency: 1,
        inputStock: 0,
        lastDelivery: -999,
        output: def.output,
        input: def.input,
        active: true,
        stationId: null
      }
      for (let yy = site.y; yy < site.y + site.fp; yy++) {
        for (let xx = site.x; xx < site.x + site.fp; xx++) {
          const tile = this.getTile(xx, yy)
          if (!tile) continue
          if (tile.type === 'road' || tile.type === 'house' || tile.type === 'tree') continue
          tile.type = 'industry'
          tile.industryId = industry.id
        }
      }
      this.industries.push(industry)
      this.industryById.set(industry.id, industry)
    }
  }

  connectStarterTowns() {
    if (this.towns.length < 2) return
    const a = this.towns[0]
    const b = this.towns[1]
    const path = findPath({
      start: { x: a.x, y: a.y },
      goal: { x: b.x, y: b.y },
      size: this.size,
      walkable: (x, y) => {
        const tile = this.getTile(x, y)
        if (!tile) return false
        if (tile.type === 'water' || tile.type === 'house' || tile.type === 'industry') return false
        if (this.tileSlope(x, y) > 1.85) return false
        return true
      }
    })
    if (!path) return
    this.starterTowns = [a, b]
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (!tile) continue
      if (tile.type === 'empty') tile.type = 'road'
      if (tile.type !== 'road') continue
      tile.road = tile.road || 0
      this.autoConnectRoad(p.x, p.y)
    }
    for (let i = 1; i < path.length; i++) {
      const p = path[i]
      const prev = path[i - 1]
      const tile = this.getTile(p.x, p.y)
      if (!tile) continue
      const dir = DIR_LIST.find(d => d.dx === p.x - prev.x && d.dy === p.y - prev.y)
      if (dir) tile.road |= dir.bit
      const prevTile = this.getTile(prev.x, prev.y)
      if (dir && prevTile && prevTile.road > 0) prevTile.road |= oppositeBit(dir.bit)
    }
    for (const p of path) this.autoConnectRoad(p.x, p.y)
  }

  placeStarterStops() {
    if (!this.starterTowns) return
    for (const town of this.starterTowns) {
      let best = null
      let bestScore = -Infinity
      for (let y = town.y - town.radius; y <= town.y + town.radius; y++) {
        for (let x = town.x - town.radius; x <= town.x + town.radius; x++) {
          const tile = this.getTile(x, y)
          if (!tile || tile.type !== 'road' || tile.road === 0 || tile.stationId) continue
          if (Math.hypot(x - town.x, y - town.y) > town.radius - 1) continue
          const score = -Math.hypot(x - town.x, y - town.y) + (tile.road === 15 ? -2 : 0) + this.rng() * 0.4
          if (score > bestScore) { bestScore = score; best = { x, y } }
        }
      }
      if (best) {
        const station = this.createStation({
          kind: 'bus',
          tiles: [best],
          access: [best],
          free: true
        })
        station.cargo.passengers = 46
        station.cargo.mail = 10
      }
    }
  }

  scatterTrees() {
    const rng = this.rng
    for (let y = 2; y < this.size - 2; y++) {
      for (let x = 2; x < this.size - 2; x++) {
        const tile = this.getTile(x, y)
        if (!tile || tile.type !== 'empty') continue
        const cluster = fbm(x * 0.085 + 7, y * 0.085 + 3, this.seed + 123, 3)
        const nearTown = this.towns.some(t => Math.hypot(t.x - x, t.y - y) < t.radius + 2)
        const nearIndustry = this.industries.some(ind => Math.hypot(ind.cx - x, ind.cy - y) < ind.w + 2.5)
        if (nearTown || nearIndustry) continue
        if (cluster < 0.5) continue
        if (rng() > (cluster - 0.5) * 1.45) continue
        const kind = rng() < 0.55 ? 'conifer' : 'broadleaf'
        tile.type = 'tree'
        tile.treeId = `${x},${y}`
        this.trees.push({
          id: tile.treeId, x, y, kind,
          scale: 0.75 + rng() * 0.75,
          rotation: rng() * Math.PI * 2,
          hue: rng()
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Station and network queries
  // ---------------------------------------------------------------------------

  createStation({ kind, tiles, access, free = false }) {
    const id = `station_${this.stationSeq++}`
    const center = tiles[Math.floor(tiles.length / 2)]
    const station = {
      id,
      kind,
      name: `${kind} stop`,
      tiles,
      access,
      center: { x: center.x, y: center.y },
      townId: null,
      industryId: null,
      produces: new Set(),
      accepts: new Set(),
      cargo: {},
      rating: 0.7,
      maintenance: STATION_MAINTENANCE[kind] || 150,
      vehicles: new Set(),
      free,
      lastDelivery: -999,
      totalDelivered: 0
    }
    for (const t of tiles) {
      const tile = this.getTile(t.x, t.y)
      if (!tile) continue
      tile.stationId = id
      if (kind === 'rail') {
        tile.rail = 15
        tile.type = 'station'
      } else if (kind === 'bus' || kind === 'truck') {
        tile.type = 'road'
        tile.road = tile.road || 0
      } else {
        tile.type = 'station'
      }
    }
    if (kind === 'rail') {
      for (const t of tiles) this.autoConnectRail(t.x, t.y)
    }
    this.stations.push(station)
    this.stationById.set(id, station)
    this.refreshStationContext(station)
    station.name = this.stationName(station)
    return station
  }

  refreshStationContext(station) {
    const center = station.center
    let bestTown = null
    let bestTownDist = Infinity
    for (const town of this.towns) {
      const d = Math.hypot(town.x - center.x, town.y - center.y)
      if (d < town.radius + 5 && d < bestTownDist) {
        bestTownDist = d
        bestTown = town
      }
    }
    let bestIndustry = null
    let bestIndDist = Infinity
    for (const industry of this.industries) {
      const d = Math.hypot(industry.cx - center.x, industry.cy - center.y)
      if (d < industry.w / 2 + 4.5 && d < bestIndDist) {
        bestIndDist = d
        bestIndustry = industry
      }
    }
    if (station.townId && this.townById.has(station.townId)) {
      const prev = this.townById.get(station.townId)
      prev.stations.delete(station.id)
    }
    if (station.industryId && this.industryById.has(station.industryId)) {
      const prev = this.industryById.get(station.industryId)
      if (prev.stationId === station.id) prev.stationId = null
    }
    station.townId = bestTown ? bestTown.id : null
    station.industryId = bestIndustry ? bestIndustry.id : null
    station.produces = new Set()
    station.accepts = new Set()
    if (bestTown) {
      bestTown.stations.add(station.id)
      for (const cargo of TOWN_PRODUCES) station.produces.add(cargo)
      for (const cargo of TOWN_ACCEPTS) station.accepts.add(cargo)
    }
    if (bestIndustry) {
      bestIndustry.stationId = station.id
      if (bestIndustry.output) station.produces.add(bestIndustry.output)
      if (bestIndustry.input) station.accepts.add(bestIndustry.input)
      if (bestIndustry.type === 'powerPlant') station.accepts.add('coal')
    }
    for (const cargo of [...station.produces]) {
      if (!(cargo in station.cargo)) station.cargo[cargo] = 0
    }
  }

  stationName(station) {
    const town = station.townId ? this.townById.get(station.townId) : null
    const industry = station.industryId ? this.industryById.get(station.industryId) : null
    let base = town ? town.name : industry ? industry.label : 'New'
    if (station.kind === 'bus') base += ' Bus Stop'
    else if (station.kind === 'truck') base += industry ? ` ${industry.label} Freight` : ' Freight Stop'
    else if (station.kind === 'rail') base += industry ? ` ${industry.label} Station` : ' Central'
    else if (station.kind === 'dock') base += industry ? ` ${industry.label} Docks` : ' Harbour'
    else if (station.kind === 'airport') base += ' Airport'
    const existing = this.stations.filter(s => s.id !== station.id && s.name.startsWith(base)).length
    return existing ? `${base} ${roman(existing + 1)}` : base
  }

  stationAccessTile(station, mode = 'road') {
    if (!station) return null
    if (mode === 'water') return station.access.find(t => this.isWater(t.x, t.y)) || station.access[0]
    return station.tiles[0]
  }

  findRoadPath(start, goal) {
    return findPath({
      start, goal, size: this.size,
      walkable: (x, y) => {
        const t = this.getTile(x, y)
        return Boolean(t && t.road > 0 && !this.isWater(x, y))
      }
    })
  }

  findRailPath(start, goal) {
    return findPath({
      start, goal, size: this.size,
      walkable: (x, y) => {
        const t = this.getTile(x, y)
        return Boolean(t && t.rail > 0)
      }
    })
  }

  findWaterPath(start, goal) {
    return findPath({
      start, goal, size: this.size,
      walkable: (x, y) => {
        const t = this.getTile(x, y)
        return Boolean(t && t.type === 'water')
      }
    })
  }

  findStationPath(kind, origin, destination) {
    if (kind === 'plane') return null
    if (kind === 'train') {
      return this.findRailPath(this.stationAccessTile(origin), this.stationAccessTile(destination))
    }
    if (kind === 'ship') {
      const a = this.stationAccessTile(origin, 'water')
      const b = this.stationAccessTile(destination, 'water')
      if (!a || !b) return null
      return this.findWaterPath(a, b)
    }
    return this.findRoadPath(this.stationAccessTile(origin), this.stationAccessTile(destination))
  }

  // ---------------------------------------------------------------------------
  // Building actions
  // ---------------------------------------------------------------------------

  canPlaceRoad(x, y) {
    const tile = this.getTile(x, y)
    if (!tile) return false
    if (tile.type === 'water' || this.isWater(x, y)) return false
    if (tile.type === 'house' || tile.type === 'industry' || tile.type === 'station') return false
    if (tile.rail > 0) return false
    if (this.tileSlope(x, y) > 2.0) return false
    return true
  }

  canPlaceRail(x, y) {
    const tile = this.getTile(x, y)
    if (!tile) return false
    if (tile.type === 'water' || this.isWater(x, y)) return false
    if (tile.type === 'house' || tile.type === 'industry' || tile.type === 'station') return false
    if (tile.road > 0) return false
    if (this.tileSlope(x, y) > 2.0) return false
    return true
  }

  estimateRoadPath(path) {
    if (!path || !path.length) return { ok: false, reason: 'No path', cost: 0, tiles: [] }
    let cost = 0
    const changed = []
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (!tile) return { ok: false, reason: 'Out of bounds', cost: 0, tiles: [] }
      if (tile.road > 0) continue
      if (!this.canPlaceRoad(p.x, p.y)) return { ok: false, reason: 'Blocked terrain', cost: 0, tiles: [] }
      cost += BUILD_COST.road
      changed.push(p)
    }
    return { ok: true, cost, tiles: changed }
  }

  estimateRailPath(path) {
    if (!path || !path.length) return { ok: false, reason: 'No path', cost: 0, tiles: [] }
    let cost = 0
    const changed = []
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (!tile) return { ok: false, reason: 'Out of bounds', cost: 0, tiles: [] }
      if (tile.rail > 0) continue
      if (!this.canPlaceRail(p.x, p.y)) return { ok: false, reason: 'Blocked terrain', cost: 0, tiles: [] }
      cost += BUILD_COST.rail
      changed.push(p)
    }
    return { ok: true, cost, tiles: changed }
  }

  stationPlacementInfo(kind, x, y) {
    if (kind === 'bus' || kind === 'truck') {
      const tile = this.getTile(x, y)
      if (!tile) return { ok: false, reason: 'Outside the map', tiles: [], cost: STATION_COST[kind] }
      if (tile.road === 0) return { ok: false, reason: 'Stops must be placed on a road', tiles: [], cost: STATION_COST[kind] }
      if (tile.stationId) return { ok: false, reason: 'A station is already here', tiles: [], cost: STATION_COST[kind] }
      return { ok: true, tiles: [{ x, y }], cost: STATION_COST[kind] }
    }
    const size = kind === 'rail' ? 2 : kind === 'airport' ? 4 : 2
    const check = this.validateStationPlacement(kind, x, y, size)
    const tiles = []
    for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) tiles.push({ x: xx, y: yy })
    return { ...check, tiles, cost: STATION_COST[kind] }
  }

  layRoadPath(path) {
    if (!path || !path.length) return { ok: false, reason: 'No path', cost: 0, tiles: [] }
    let cost = 0
    const changed = []
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (!tile) return { ok: false, reason: 'Out of bounds', cost: 0, tiles: [] }
      if (tile.road > 0) continue
      if (!this.canPlaceRoad(p.x, p.y)) return { ok: false, reason: 'Blocked terrain', cost: 0, tiles: [] }
      cost += BUILD_COST.road
      changed.push(p)
    }
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (!tile) continue
      if (tile.road === 0) tile.type = 'road'
    }
    for (let i = 0; i < path.length; i++) {
      const p = path[i]
      const tile = this.getTile(p.x, p.y)
      if (!tile) continue
      if (i > 0) {
        const prev = path[i - 1]
        const dir = DIR_LIST.find(d => d.dx === p.x - prev.x && d.dy === p.y - prev.y)
        if (dir) tile.road |= dir.bit
      }
      if (i < path.length - 1) {
        const next = path[i + 1]
        const dir = DIR_LIST.find(d => d.dx === next.x - p.x && d.dy === next.y - p.y)
        if (dir) tile.road |= dir.bit
      }
      this.autoConnectRoad(p.x, p.y)
    }
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (tile) tile.road = tile.road || 1
    }
    return { ok: true, cost, tiles: path }
  }

  layRailPath(path) {
    if (!path || !path.length) return { ok: false, reason: 'No path', cost: 0, tiles: [] }
    let cost = 0
    for (const p of path) {
      const tile = this.getTile(p.x, p.y)
      if (!tile) return { ok: false, reason: 'Out of bounds', cost: 0, tiles: [] }
      if (tile.rail > 0) continue
      if (!this.canPlaceRail(p.x, p.y)) return { ok: false, reason: 'Blocked terrain', cost: 0, tiles: [] }
      cost += BUILD_COST.rail
    }
    for (let i = 0; i < path.length; i++) {
      const p = path[i]
      const tile = this.getTile(p.x, p.y)
      if (!tile) continue
      if (i > 0) {
        const prev = path[i - 1]
        const dir = DIR_LIST.find(d => d.dx === p.x - prev.x && d.dy === p.y - prev.y)
        if (dir) tile.rail |= dir.bit
      }
      if (i < path.length - 1) {
        const next = path[i + 1]
        const dir = DIR_LIST.find(d => d.dx === next.x - p.x && d.dy === next.y - p.y)
        if (dir) tile.rail |= dir.bit
      }
      this.autoConnectRail(p.x, p.y)
      if (tile.rail === 0) tile.rail = 1
    }
    return { ok: true, cost, tiles: path }
  }

  validateStationPlacement(kind, x, y, size = 1) {
    for (let yy = y; yy < y + size; yy++) {
      for (let xx = x; xx < x + size; xx++) {
        const tile = this.getTile(xx, yy)
        if (!tile) return { ok: false, reason: 'Outside the map' }
        if (this.isWater(xx, yy)) return { ok: false, reason: 'Cannot build on water' }
        if (tile.stationId) return { ok: false, reason: 'A station is already here' }
        if (kind === 'rail') {
          if (tile.type !== 'empty' && tile.rail === 0) return { ok: false, reason: 'Terrain is occupied' }
        } else if (kind === 'dock') {
          if (tile.type === 'house' || tile.type === 'industry') return { ok: false, reason: 'Terrain is occupied' }
        } else {
          if (tile.type === 'house' || tile.type === 'industry' || tile.type === 'tree') return { ok: false, reason: 'Terrain is occupied' }
        }
      }
    }
    let min = Infinity
    let max = -Infinity
    for (let yy = y; yy <= y + size; yy++) {
      for (let xx = x; xx <= x + size; xx++) {
        const h = this.vertexHeight(xx, yy)
        min = Math.min(min, h)
        max = Math.max(max, h)
      }
    }
    if (max - min > 2.0) return { ok: false, reason: 'Ground is too uneven' }
    if (kind === 'dock') {
      let water = null
      for (let yy = y - 1; yy <= y + size; yy++) {
        for (let xx = x - 1; xx <= x + size; xx++) {
          if (!this.inBounds(xx, yy)) continue
          if (this.isWater(xx, yy)) { water = { x: xx, y: yy }; break }
        }
        if (water) break
      }
      if (!water) return { ok: false, reason: 'Dock must touch water' }
    }
    return { ok: true }
  }

  placeStation(kind, x, y) {
    if (kind === 'bus' || kind === 'truck') {
      const tile = this.getTile(x, y)
      if (!tile) return { ok: false, reason: 'Out of bounds' }
      if (tile.road === 0) return { ok: false, reason: 'Stops must be placed on a road' }
      if (tile.stationId) return { ok: false, reason: 'A station is already here' }
      const station = this.createStation({ kind, tiles: [{ x, y }], access: [{ x, y }] })
      return { ok: true, station, cost: STATION_COST[kind] }
    }

    const size = kind === 'rail' ? 2 : kind === 'airport' ? 4 : 2
    const check = this.validateStationPlacement(kind, x, y, size)
    if (!check.ok) return check
    const tiles = []
    for (let yy = y; yy < y + size; yy++) {
      for (let xx = x; xx < x + size; xx++) tiles.push({ x: xx, y: yy })
    }
    let access = []
    if (kind === 'dock') {
      for (let yy = y - 2; yy <= y + size + 1; yy++) {
        for (let xx = x - 2; xx <= x + size + 1; xx++) {
          if (this.inBounds(xx, yy) && this.isWater(xx, yy)) access.push({ x: xx, y: yy })
        }
      }
      access = access.filter(t => Math.abs(t.x - (x + size / 2)) <= size + 2 && Math.abs(t.y - (y + size / 2)) <= size + 2)
    } else {
      access = tiles.map(t => ({ ...t }))
    }
    const station = this.createStation({ kind, tiles, access })
    return { ok: true, station, cost: STATION_COST[kind] }
  }

  stationAt(x, y) {
    const tile = this.getTile(x, y)
    if (!tile || !tile.stationId) return null
    return this.stationById.get(tile.stationId) || null
  }

  removeStation(station) {
    const clearsRail = station.kind === 'rail'
    const clearsTerrain = station.kind === 'dock' || station.kind === 'airport'
    for (const t of station.tiles) {
      const tile = this.getTile(t.x, t.y)
      if (!tile) continue
      tile.stationId = null
      if (clearsRail) {
        tile.rail = 0
        tile.type = 'empty'
      } else if (clearsTerrain) {
        tile.road = 0
        tile.rail = 0
        tile.type = 'empty'
      } else {
        tile.type = 'road'
      }
    }
    if (clearsRail || clearsTerrain) {
      for (const t of station.tiles) {
        for (const dir of DIR_LIST) {
          const n = this.getTile(t.x + dir.dx, t.y + dir.dy)
          if (!n) continue
          if (clearsRail) n.rail &= ~oppositeBit(dir.bit)
          if (clearsTerrain) n.road &= ~oppositeBit(dir.bit)
        }
      }
    }
    const town = station.townId ? this.townById.get(station.townId) : null
    if (town) town.stations.delete(station.id)
    const industry = station.industryId ? this.industryById.get(station.industryId) : null
    if (industry && industry.stationId === station.id) industry.stationId = null
    this.stations = this.stations.filter(s => s.id !== station.id)
    this.stationById.delete(station.id)
  }

  bulldoze(x, y) {
    if (!this.inBounds(x, y)) return { ok: false, reason: 'Outside the map' }
    const tile = this.getTile(x, y)
    if (!tile) return { ok: false, reason: 'Outside the map' }
    if (tile.stationId) {
      const station = this.stationById.get(tile.stationId)
      if (!station) return { ok: false, reason: 'Nothing to remove' }
      this.removeStation(station)
      return { ok: true, removed: 'station', station, cost: BUILD_COST.remove }
    }
    if (tile.type === 'house' || tile.type === 'industry') return { ok: false, reason: 'You cannot demolish this' }
    if (tile.road > 0) {
      tile.road = 0
      tile.type = 'empty'
      for (const dir of DIR_LIST) {
        const n = this.getTile(x + dir.dx, y + dir.dy)
        if (n && n.road > 0) n.road &= ~oppositeBit(dir.bit)
      }
      return { ok: true, removed: 'road', cost: BUILD_COST.remove }
    }
    if (tile.rail > 0) {
      tile.rail = 0
      tile.type = 'empty'
      for (const dir of DIR_LIST) {
        const n = this.getTile(x + dir.dx, y + dir.dy)
        if (n && n.rail > 0) n.rail &= ~oppositeBit(dir.bit)
      }
      return { ok: true, removed: 'rail', cost: BUILD_COST.remove }
    }
    if (tile.type === 'tree') {
      const id = tile.treeId
      tile.type = 'empty'
      tile.treeId = null
      this.trees = this.trees.filter(t => t.id !== id)
      return { ok: true, removed: 'tree', cost: BUILD_COST.remove }
    }
    return { ok: false, reason: 'Nothing to remove' }
  }

  plantTree(x, y) {
    const tile = this.getTile(x, y)
    if (!tile) return { ok: false, reason: 'Out of bounds' }
    if (tile.type !== 'empty' || this.isWater(x, y) || this.tileSlope(x, y) > 1.8) {
      return { ok: false, reason: 'Needs empty level ground' }
    }
    const tree = {
      id: `${x},${y}`,
      x, y,
      kind: this.rng() < 0.55 ? 'conifer' : 'broadleaf',
      scale: 0.8 + this.rng() * 1.0,
      rotation: this.rng() * Math.PI * 2,
      hue: this.rng()
    }
    tile.type = 'tree'
    tile.treeId = tree.id
    this.trees.push(tree)
    return { ok: true, tree, cost: BUILD_COST.tree }
  }

  // ---------------------------------------------------------------------------
  // Economy helpers
  // ---------------------------------------------------------------------------

  produceDaily(station, multiplier = 1) {
    if (!station) return
    const town = station.townId ? this.townById.get(station.townId) : null
    const industry = station.industryId ? this.industryById.get(station.industryId) : null
    if (town) {
      const bonus = station.rating * 0.7 + 0.3
      station.cargo.passengers = Math.min(900, (station.cargo.passengers || 0) + town.population * 0.018 * bonus * multiplier)
      station.cargo.mail = Math.min(500, (station.cargo.mail || 0) + town.population * 0.0022 * bonus * multiplier)
    }
    if (industry && industry.output) {
      const daily = (industry.production / 8.5) * industry.efficiency * multiplier
      station.cargo[industry.output] = Math.min(900, (station.cargo[industry.output] || 0) + daily)
    }
  }

  takeCargo(station, cargoType, amount) {
    if (!station) return 0
    const available = station.cargo[cargoType] || 0
    const taken = Math.min(available, amount)
    station.cargo[cargoType] = Math.max(0, available - taken)
    return taken
  }

  deliverCargo(station, cargoType, amount) {
    if (!station) return false
    const accepted = station.accepts.has(cargoType)
    if (accepted) {
      station.totalDelivered += amount
      station.lastDelivery = this.currentDay || 0
      const industry = station.industryId ? this.industryById.get(station.industryId) : null
      if (industry && industry.input === cargoType) {
        industry.inputStock += amount
        industry.lastDelivery = this.currentDay || 0
        industry.efficiency = Math.min(1.8, industry.efficiency + amount / 900)
      }
    }
    return accepted
  }

  updateIndustries() {
    for (const industry of this.industries) {
      const idle = (this.currentDay || 0) - industry.lastDelivery > 45
      if (industry.input && idle) industry.efficiency = Math.max(0.55, industry.efficiency - 0.012)
      industry.production = industry.baseProduction * industry.efficiency
    }
  }

  growTowns() {
    const newHouses = []
    let servedPopulation = 0
    for (const town of this.towns) {
      let served = false
      for (const stationId of town.stations) {
        const station = this.stationById.get(stationId)
        if (!station) continue
        const center = station.center
        if (Math.hypot(center.x - town.x, center.y - town.y) < town.radius + 5) served = true
      }
      town.served = served
      const growthRate = served ? 0.012 + Math.min(0.01, town.stations.size * 0.002) : 0.0018
      const growth = Math.round(town.population * growthRate)
      town.population += growth
      town.growth = growth
      if (served) servedPopulation += town.population
      if (growth > 0 && town.houses.length < 140) {
        const candidates = []
        for (let y = town.y - town.radius; y <= town.y + town.radius; y++) {
          for (let x = town.x - town.radius; x <= town.x + town.radius; x++) {
            const tile = this.getTile(x, y)
            if (!tile || tile.type !== 'empty') continue
            if (Math.hypot(x - town.x, y - town.y) > town.radius - 0.2) continue
            if (!this.hasAdjacentRoad(x, y)) continue
            candidates.push({ x, y })
          }
        }
        if (candidates.length) {
          const spot = randomChoice(this.rng, candidates)
          const house = this.spawnHouse(town, spot.x, spot.y, {})
          if (house) newHouses.push(house)
        }
      }
    }
    this.servedPopulation = servedPopulation
    return newHouses
  }

  getIndustryStation(industry) {
    return industry.stationId ? this.stationById.get(industry.stationId) : null
  }

  stationSummary(station) {
    const town = station.townId ? this.townById.get(station.townId) : null
    const industry = station.industryId ? this.industryById.get(station.industryId) : null
    return {
      town: town ? town.name : null,
      industry: industry ? industry.label : null,
      produces: [...station.produces],
      accepts: [...station.accepts]
    }
  }
}

export { DIR_BITS }
