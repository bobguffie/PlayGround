export const MAP_SIZE = 80
export const TILE = 4
export const WORLD_SIZE = MAP_SIZE * TILE
export const WATER_LEVEL = 0
export const START_DATE = { year: 1960, month: 0, day: 1 }

export const CARGO = {
  passengers: { name: 'Passengers', short: 'PSG', color: '#7fd1ff', value: 0.37, unit: 'pax' },
  mail: { name: 'Mail', short: 'MAIL', color: '#ffd166', value: 0.44, unit: 'bags' },
  coal: { name: 'Coal', short: 'COAL', color: '#5d6470', value: 0.52, unit: 't' },
  grain: { name: 'Grain', short: 'GRAIN', color: '#e0b354', value: 0.42, unit: 't' },
  wood: { name: 'Wood', short: 'WOOD', color: '#a9744f', value: 0.42, unit: 't' },
  oil: { name: 'Oil', short: 'OIL', color: '#26262e', value: 0.58, unit: 'kL' },
  goods: { name: 'Goods', short: 'GOODS', color: '#d96b4a', value: 0.62, unit: 'crates' },
  steel: { name: 'Steel', short: 'STEEL', color: '#9aa7b5', value: 0.68, unit: 't' }
}

export const INDUSTRY_TYPES = {
  coalMine: {
    label: 'Coal Mine', output: 'coal', input: null, production: 190, footprint: 3,
    colors: { base: '#545a63', accent: '#2d3138' }
  },
  powerPlant: {
    label: 'Power Plant', output: null, input: 'coal', production: 0, footprint: 3,
    colors: { base: '#8f9aa1', accent: '#4b535b' }
  },
  farm: {
    label: 'Farm', output: 'grain', input: null, production: 150, footprint: 3,
    colors: { base: '#c9a45c', accent: '#8a5c35' }
  },
  factory: {
    label: 'Factory', output: 'goods', input: 'grain', production: 120, footprint: 3,
    colors: { base: '#b45b48', accent: '#6b3a30' }
  },
  forest: {
    label: 'Forest', output: 'wood', input: null, production: 130, footprint: 2,
    colors: { base: '#3f6b42', accent: '#294a2c' }
  },
  sawmill: {
    label: 'Sawmill', output: 'goods', input: 'wood', production: 110, footprint: 3,
    colors: { base: '#a77a4c', accent: '#68472a' }
  },
  oilWell: {
    label: 'Oil Wells', output: 'oil', input: null, production: 120, footprint: 2,
    colors: { base: '#3f4650', accent: '#22262c' }
  },
  refinery: {
    label: 'Refinery', output: 'goods', input: 'oil', production: 140, footprint: 3,
    colors: { base: '#8a8f96', accent: '#4a4f56' }
  },
  steelMill: {
    label: 'Steel Mill', output: 'steel', input: 'coal', production: 100, footprint: 3,
    colors: { base: '#6b7178', accent: '#363b41' }
  }
}

export const TOWN_NAMES = [
  'Havenbrook', 'Greenfield', 'Oakridge', 'Redcliff', 'Mistport', 'Stoneford',
  'Highvale', 'Brookmere', 'Ironhaven', 'Willowdale', 'Cinderby', 'Lakeside',
  'Fairmeadow', 'Northgate', 'Riverton', 'Foxbury'
]

export const STATION_COST = {
  rail: 14000,
  bus: 4200,
  truck: 5200,
  dock: 22000,
  airport: 90000
}

export const BUILD_COST = {
  road: 46,
  rail: 120,
  tree: 18,
  remove: 24
}

export const STATION_MAINTENANCE = {
  rail: 520,
  bus: 110,
  truck: 140,
  dock: 640,
  airport: 2400
}

export const VEHICLES = {
  train: {
    label: 'Train', cost: 42000, speed: 38, capacity: 190, cars: 4,
    maintenance: 155, kinds: ['rail'], length: 6.4,
    cargos: ['passengers', 'mail', 'coal', 'grain', 'wood', 'oil', 'goods', 'steel'],
    description: 'Heavy hauler. Fast and profitable over long routes.'
  },
  bus: {
    label: 'Bus', cost: 7600, speed: 24, capacity: 34, cars: 1,
    maintenance: 24, kinds: ['bus'], length: 1.7,
    cargos: ['passengers'],
    description: 'Cheap people mover for town-to-town routes.'
  },
  truck: {
    label: 'Truck', cost: 9800, speed: 22, capacity: 48, cars: 1,
    maintenance: 30, kinds: ['truck'], length: 1.9,
    cargos: ['coal', 'grain', 'wood', 'oil', 'goods', 'steel', 'mail'],
    description: 'Flexible freight for short industrial links.'
  },
  ship: {
    label: 'Ship', cost: 29000, speed: 16, capacity: 280, cars: 1,
    maintenance: 82, kinds: ['dock'], length: 3.4,
    cargos: ['coal', 'grain', 'wood', 'oil', 'goods', 'steel'],
    description: 'Huge capacity across lakes and coastal waters.'
  },
  plane: {
    label: 'Aircraft', cost: 98000, speed: 105, capacity: 130, cars: 1,
    maintenance: 310, kinds: ['airport'], length: 3.2,
    cargos: ['passengers', 'mail'],
    description: 'Premium long-distance passenger and mail service.'
  }
}

export const TOWN_ACCEPTS = ['passengers', 'mail', 'goods']
export const TOWN_PRODUCES = ['passengers', 'mail']

export const TOOL_GROUPS = {
  road: { label: 'Roads', items: ['road', 'bus', 'truck'] },
  rail: { label: 'Rail', items: ['rail', 'railstation'] },
  water: { label: 'Docks', items: ['dock'] },
  air: { label: 'Air', items: ['airport'] },
  vehicles: { label: 'Vehicles', items: [] }
}

export const TOOL_INFO = {
  road: { label: 'Road', hint: 'Drag across land to lay a road. Press Esc to cancel.', cost: BUILD_COST.road },
  rail: { label: 'Rail Track', hint: 'Drag across land to lay track. Connect to stations to run trains.', cost: BUILD_COST.rail },
  bus: { label: 'Bus Stop', hint: 'Click an existing road tile to place a drive-through bus stop.', cost: STATION_COST.bus },
  truck: { label: 'Truck Stop', hint: 'Click an existing road tile to place a drive-through truck stop.', cost: STATION_COST.truck },
  railstation: { label: 'Rail Station', hint: 'Click flat land for a 2x2 rail station. Link it with track.', cost: STATION_COST.rail },
  dock: { label: 'Dock', hint: 'Click coastal land for a dock with a water berth.', cost: STATION_COST.dock },
  airport: { label: 'Airport', hint: 'Click flat land for a 4x4 airport. Connect it to another airport.', cost: STATION_COST.airport },
  bulldoze: { label: 'Bulldoze', hint: 'Click or drag to clear track, road, trees and stations.', cost: BUILD_COST.remove },
  tree: { label: 'Plant Trees', hint: 'Click empty land to plant a tree.', cost: BUILD_COST.tree }
}

export const OBJECTIVES = [
  { id: 'passengers', text: 'Carry 100 passengers', goal: 100, stat: 'passengers', reward: 15000 },
  { id: 'freight', text: 'Deliver 250 units of freight', goal: 250, stat: 'freight', reward: 30000 },
  { id: 'value', text: 'Reach a company value of $750,000', goal: 750000, stat: 'value', reward: 60000 },
  { id: 'population', text: 'Grow your served towns to 6,000 people', goal: 6000, stat: 'servedPopulation', reward: 90000 }
]

export const SAVE_KEY = 'transport-tycoon-3d-save-v1'
