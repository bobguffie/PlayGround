import {
  BUILD_COST, CARGO, START_DATE, STATION_COST, TOOL_INFO, VEHICLES
} from '../game/constants.js'
import { dateLabel, formatMoney, formatNumber } from '../game/utils.js'
import { orthogonalPath } from '../game/pathfinding.js'

const STATION_KIND = { train: 'rail', bus: 'bus', truck: 'truck', ship: 'dock', plane: 'airport' }
const VEHICLE_FOR_STATION = { rail: 'train', bus: 'bus', truck: 'truck', dock: 'ship', airport: 'plane' }
const VEHICLE_ORDER = ['train', 'bus', 'truck', 'ship', 'plane']

const ICONS = {
  road: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 9.4 3"></path><path d="M19 21 14.6 3"></path><path d="M9.9 17h4.2"></path><path d="M10.8 12h2.4"></path><path d="M11.6 7h.8"></path></svg>',
  rail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v18M16 3v18"></path><path d="M5 6h14M5 10h14M5 14h14M5 18h14"></path></svg>',
  dock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M8 7h8"></path><path d="M4 14c2.2 0 3.8 1.4 4 3.3"></path><path d="M4 17c2.2 0 3.8 1.4 4 3"></path><path d="M20 14c-2.2 0-3.8 1.4-4 3.3"></path><path d="M20 17c-2.2 0-3.8 1.4-4 3"></path><path d="M8.5 20c1.2-1.4 2.3-2.1 3.5-2.1s2.3.7 3.5 2.1"></path></svg>',
  airport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 3.5c0-1 3-1 3 0v5l7 4v2.2l-7-1.8v3.4l2.2 1.7v1.5L12 18.7l-3.7 1.8v-1.5l2.2-1.7v-3.4l-7 1.8V13l7-4z"></path></svg>',
  vehicles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="13" rx="2.2"></rect><path d="M4 9h16"></path><path d="M7 17v2M17 17v2"></path><path d="M8 6.5h2M14 6.5h2"></path></svg>',
  tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-5"></path><path d="m12 3 6.5 9h-4l3.5 5H6l3.5-5h-4z"></path></svg>',
  bulldoze: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"></path><path d="M5 20v-4h6v4"></path><path d="M7 16V9h5l2 3h5v4"></path><path d="M9 9V6h4"></path><path d="m16 6 4 4"></path></svg>',
  bus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="13" rx="2"></rect><path d="M4 10h16"></path><path d="M7 4v6M17 4v6"></path><circle cx="8" cy="18.5" r="1.4"></circle><circle cx="16" cy="18.5" r="1.4"></circle></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h10v11H3z"></path><path d="M13 10h4l3 3v4h-7"></path><circle cx="7" cy="18.5" r="1.5"></circle><circle cx="17" cy="18.5" r="1.5"></circle></svg>',
  railstation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18v9H3z"></path><path d="M3 10h18"></path><path d="M7 15v4M17 15v4"></path><path d="M9 19h6"></path></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="13" rx="3"></rect><path d="M5 10h14"></path><circle cx="9" cy="13.5" r="1"></circle><circle cx="15" cy="13.5" r="1"></circle><path d="m8 21 2-4M16 21l-2-4"></path></svg>',
  ship: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h16l-2.4 6H6.4z"></path><path d="M7 13V8h10v5"></path><path d="M12 8V4"></path><path d="M12 4 8 6"></path></svg>',
  plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 3.5c0-1 3-1 3 0v5l7 4v2.2l-7-1.8v3.4l2.2 1.7v1.5L12 18.7l-3.7 1.8v-1.5l2.2-1.7v-3.4l-7 1.8V13l7-4z"></path></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"></path></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.4"></circle></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="6" r="2"></circle><path d="M8 18h4a4 4 0 0 0 4-4V8"></path></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h4"></path></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"></circle><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.5c2 .7 3 2.8 3 5.5"></path></svg>',
  factory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l5 3V9l5 3V9l5 3v9z"></path><path d="M6 9V4h3v5"></path><path d="M8 17h2M14 17h2"></path></svg>',
  station: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M4 21V8l8-5 8 5v13"></path><path d="M8 21v-6h8v6"></path><path d="M8 10h2M14 10h2"></path></svg>',
  pickaxe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 8-8"></path><path d="M13 7a9 9 0 0 1 7 4l-3 2a6 6 0 0 0-5-3z"></path><path d="M9 3a9 9 0 0 1 5 2l-2 2.6a6 6 0 0 0-4-1.3z"></path></svg>'
}

const TOOLBAR = [
  { id: 'road', label: 'Roads', icon: 'road', tools: ['road', 'bus', 'truck'] },
  { id: 'rail', label: 'Rail', icon: 'rail', tools: ['rail', 'railstation'] },
  { id: 'water', label: 'Docks', icon: 'dock', tools: ['dock'] },
  { id: 'air', label: 'Air', icon: 'airport', tools: ['airport'] },
  { id: 'vehicles', label: 'Fleet', icon: 'vehicles', tools: [] },
  { separator: true },
  { id: 'tree', label: 'Trees', icon: 'tree', tools: ['tree'] },
  { id: 'bulldoze', label: 'Clear', icon: 'bulldoze', tools: ['bulldoze'], danger: true }
]

const BUILD_DESCRIPTIONS = {
  road: 'Drag to connect towns, stops and industries.',
  bus: 'A drive-through stop on any existing road.',
  truck: 'Freight stop beside an industry road.',
  rail: 'Drag track to connect rail stations.',
  railstation: 'A 2×2 platform for passenger and freight trains.',
  dock: 'A harbour berth that must touch water.',
  airport: 'A 4×4 airport for fast passenger service.',
  tree: 'Plant woodland to soften the landscape.',
  bulldoze: 'Clear roads, track, trees and stations.'
}

const STATION_LABELS = { rail: 'Rail Station', bus: 'Bus Stop', truck: 'Truck Stop', dock: 'Dock', airport: 'Airport' }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function cargoColor(type) {
  return CARGO[type]?.color || '#7fffd4'
}

function cargoName(type) {
  return CARGO[type]?.name || type
}

function pct(value, max = 1) {
  return Math.max(0, Math.min(100, (value / max) * 100))
}

export class UI {
  constructor(game, world, renderer) {
    this.game = game
    this.world = world
    this.renderer = renderer
    this.started = false
    this.mode = 'select'
    this.activeTool = null
    this.activeGroup = null
    this.route = null
    this.selection = null
    this.drag = null
    this.pointerDown = null
    this.modal = null
    this.toastTimers = new Set()
    this.lastHud = 0
    this.lastMinimap = 0
    this.lastPanel = 0
    this.minimapHover = null

    const byId = id => document.getElementById(id)
    this.el = {
      startScreen: byId('start-screen'),
      startButton: byId('start-game'),
      toolbar: byId('toolbar'),
      buildPanel: byId('build-panel'),
      modeBanner: byId('mode-banner'),
      modeIcon: byId('mode-icon'),
      modeTitle: byId('mode-title'),
      modeHint: byId('mode-hint'),
      modeCancel: byId('mode-cancel'),
      sidePanel: byId('side-panel'),
      objectives: byId('objectives'),
      objectiveList: byId('objective-list'),
      objectiveCount: byId('objective-count'),
      newsList: byId('news-list'),
      newsDate: byId('news-date'),
      minimap: byId('minimap'),
      minimapCoords: byId('minimap-coords'),
      cash: byId('hud-cash'),
      loan: byId('hud-loan'),
      value: byId('hud-value'),
      date: byId('hud-date'),
      toastRoot: byId('toasts'),
      modalRoot: byId('modal-root'),
      cursorTip: byId('cursor-tip')
    }
    this.minimapCtx = this.el.minimap.getContext('2d')

    this.renderToolbar()
    this.bindStatic()
    this.bindCanvas()
    this.bindSidePanel()
    this.bindBuildPanel()
    this.bindGame()
    this.bindModal()
    this.renderObjectives()
    this.renderNews()
    this.updateHud(true)
    this.updateSpeed()
    this.drawMinimap()
  }

  icon(name) {
    return ICONS[name] || ICONS.road
  }

  // ------------------------------------------------------------------ setup
  bindStatic() {
    this.el.startButton.addEventListener('click', () => this.startGame())

    for (const button of document.querySelectorAll('.speed-btn')) {
      button.addEventListener('click', () => {
        if (!this.started) return
        const speed = Number(button.dataset.speed)
        if (speed === 0) this.game.togglePause()
        else this.game.setSpeed(speed)
        this.updateSpeed()
      })
    }

    document.getElementById('btn-fleet')?.addEventListener('click', () => this.openModal('fleet'))
    document.getElementById('btn-finance')?.addEventListener('click', () => this.openModal('finance'))
    document.getElementById('btn-help')?.addEventListener('click', () => this.openModal('help'))
    this.el.objectives.addEventListener('click', () => this.openModal('objectives'))
    this.el.modeCancel.addEventListener('click', () => this.cancelCurrent())
    this.el.minimap.addEventListener('click', e => this.onMinimapClick(e))
    this.el.minimap.addEventListener('pointermove', e => this.onMinimapMove(e))
    this.el.minimap.addEventListener('pointerleave', () => {
      this.minimapHover = null
      this.el.minimapCoords.textContent = `${this.world.size} × ${this.world.size}`
    })

    window.addEventListener('keydown', e => this.onKeyDown(e))
  }

  bindGame() {
    this.game.on('toast', ({ text, type }) => this.showToast(text, type))
    this.game.on('news', () => this.renderNews())
    this.game.on('objectives', () => this.renderObjectives())
    this.game.on('finance', () => this.updateHud(true))
    this.game.on('speed', () => this.updateSpeed())
    this.game.on('vehicles', () => {
      this.lastPanel = 0
      if (this.modal === 'fleet') this.openModal('fleet')
    })
    this.game.on('stations', () => {
      this.drawMinimap()
      this.lastPanel = 0
    })
    this.game.on('network', () => this.drawMinimap())
    this.game.on('month', () => {
      this.updateHud(true)
      this.renderObjectives()
      this.renderNews()
      this.drawMinimap()
    })
    this.game.on('victory', () => this.openModal('victory'))
  }

  bindCanvas() {
    const canvas = this.renderer.canvas
    canvas.addEventListener('pointermove', e => this.onPointerMove(e))
    canvas.addEventListener('pointerdown', e => this.onPointerDown(e))
    canvas.addEventListener('pointerleave', () => {
      this.el.cursorTip.hidden = true
      if (!this.drag) this.renderer.setHover(null)
    })
    window.addEventListener('pointerup', e => this.onPointerUp(e))
    canvas.addEventListener('dblclick', e => {
      if (this.mode !== 'select') return
      const tile = this.renderer.pickTile(e.clientX, e.clientY)
      if (tile) this.renderer.focusTile(tile.x, tile.y, Math.min(80, this.renderer.desiredDistance))
    })
  }

  bindBuildPanel() {
    this.el.buildPanel.addEventListener('click', e => {
      const close = e.target.closest('[data-build-close]')
      if (close) {
        this.closeBuildPanel()
        return
      }
      const toolButton = e.target.closest('[data-tool]')
      if (toolButton) {
        this.chooseTool(toolButton.dataset.tool)
        return
      }
      const vehicleButton = e.target.closest('[data-vehicle-type]')
      if (vehicleButton) {
        this.beginRoute(vehicleButton.dataset.vehicleType)
        return
      }
      const actionButton = e.target.closest('[data-action]')
      if (!actionButton) return
      const action = actionButton.dataset.action
      if (action === 'cargo') this.setRouteCargo(actionButton.dataset.cargo)
      else if (action === 'route-back') this.showVehicleCards()
      else if (action === 'route-reset') this.resetRoute()
      else if (action === 'route-buy') this.buyRoute()
    })
  }

  bindSidePanel() {
    this.el.sidePanel.addEventListener('click', e => {
      const close = e.target.closest('[data-side-close]')
      if (close) {
        this.clearSelection()
        return
      }
      const actionEl = e.target.closest('[data-side-action]')
      if (!actionEl) return
      const action = actionEl.dataset.sideAction
      if (action === 'focus') {
        const [x, y] = (actionEl.dataset.coords || '').split(',').map(Number)
        if (Number.isFinite(x) && Number.isFinite(y)) this.renderer.focusTile(x, y, 70)
      } else if (action === 'plan-route') {
        const station = this.world.stationById.get(actionEl.dataset.station)
        if (station) this.planRouteFromStation(station)
      } else if (action === 'open-station') {
        const station = this.world.stationById.get(actionEl.dataset.station)
        if (station) this.selectStation(station)
      } else if (action === 'open-vehicle') {
        const vehicle = this.game.vehicles.find(v => v.id === actionEl.dataset.vehicle)
        if (vehicle) this.selectVehicle(vehicle)
      } else if (action === 'clone-vehicle') {
        const result = this.game.cloneVehicle(actionEl.dataset.vehicle)
        if (result.ok && result.vehicle) this.selectVehicle(result.vehicle)
      } else if (action === 'sell-vehicle') {
        this.game.sellVehicle(actionEl.dataset.vehicle)
        this.clearSelection()
      } else if (action === 'demolish-station') {
        const station = this.world.stationById.get(actionEl.dataset.station)
        if (station) {
          this.game.bulldoze(station.center.x, station.center.y)
          this.clearSelection()
        }
      } else if (action === 'select-town-route') {
        const town = this.world.townById.get(actionEl.dataset.town)
        const station = town ? [...town.stations].map(id => this.world.stationById.get(id)).find(s => s && s.kind === 'bus') : null
        if (station) this.planRouteFromStation(station)
      }
    })
  }

  bindModal() {
    this.el.modalRoot.addEventListener('click', e => {
      if (e.target.classList.contains('modal')) {
        this.closeModal()
        return
      }
      if (e.target.closest('[data-modal-close]')) {
        this.closeModal()
        return
      }
      const actionEl = e.target.closest('[data-modal-action]')
      if (!actionEl) return
      const action = actionEl.dataset.modalAction
      if (action === 'loan') {
        this.game.takeLoan(100000)
        this.openModal('finance')
      } else if (action === 'repay') {
        this.game.repayLoan(100000)
        this.openModal('finance')
      } else if (action === 'fleet-view') {
        const vehicle = this.game.vehicles.find(v => v.id === actionEl.dataset.vehicle)
        if (vehicle) {
          this.closeModal()
          this.selectVehicle(vehicle)
        }
      } else if (action === 'fleet-clone') {
        this.game.cloneVehicle(actionEl.dataset.vehicle)
        this.openModal('fleet')
      } else if (action === 'close-help') {
        this.closeModal()
      }
    })
  }

  // ----------------------------------------------------------------- start
  startGame() {
    if (this.started) return
    this.started = true
    this.el.startScreen.classList.add('hide')
    window.setTimeout(() => { this.el.startScreen.hidden = true }, 520)
    this.game.start()
    this.updateHud(true)
    this.updateSpeed()
    this.drawMinimap()
    window.setTimeout(() => {
      if (this.game.vehicles.length === 0 && !this.route) {
        this.openGroup('vehicles')
        this.beginRoute('bus')
      }
    }, 900)
  }

  // --------------------------------------------------------------- toolbar
  renderToolbar() {
    this.el.toolbar.innerHTML = TOOLBAR.map(item => {
      if (item.separator) return '<div class="tool-sep"></div>'
      const firstTool = item.tools[0] || ''
      return `<button class="tool${item.danger ? ' danger' : ''}" data-toolbar-group="${item.id}" data-first-tool="${firstTool}" title="${item.label}">
        ${this.icon(item.icon)}<span>${item.label}</span>
      </button>`
    }).join('')

    this.el.toolbar.addEventListener('click', e => {
      const button = e.target.closest('[data-toolbar-group]')
      if (!button) return
      const id = button.dataset.toolbarGroup
      const item = TOOLBAR.find(t => t.id === id)
      if (!item) return
      if (item.tools.length === 1 && item.id !== 'vehicles') this.chooseTool(item.tools[0])
      else this.openGroup(id)
    })
    this.updateToolbar()
  }

  updateToolbar() {
    for (const button of this.el.toolbar.querySelectorAll('[data-toolbar-group]')) {
      const id = button.dataset.toolbarGroup
      const active = this.activeGroup === id || (this.activeTool && TOOLBAR.find(t => t.id === id)?.tools?.includes(this.activeTool))
      button.classList.toggle('active', Boolean(active))
    }
  }

  openGroup(id) {
    if (this.activeGroup === id && !this.el.buildPanel.hidden) {
      this.closeBuildPanel()
      return
    }
    this.resetInteraction()
    this.activeGroup = id
    this.el.buildPanel.hidden = false
    this.renderBuildPanel()
    this.updateToolbar()
  }

  closeBuildPanel() {
    this.el.buildPanel.hidden = true
    this.activeGroup = null
    if (this.mode !== 'select') this.resetInteraction()
    this.updateToolbar()
  }

  showVehicleCards() {
    this.route = null
    this.mode = 'select'
    this.activeTool = null
    this.hideBanner()
    this.clearHighlights()
    this.renderer.clearPreview()
    this.el.buildPanel.hidden = false
    this.activeGroup = 'vehicles'
    this.renderBuildPanel()
    this.updateToolbar()
  }

  renderBuildPanel() {
    if (!this.activeGroup || this.el.buildPanel.hidden) return
    if (this.activeGroup === 'vehicles') {
      this.el.buildPanel.innerHTML = this.route ? this.routeBuilderHtml() : this.vehicleCardsHtml()
      return
    }
    const item = TOOLBAR.find(t => t.id === this.activeGroup)
    if (!item) return
    const title = item.id === 'road' ? 'Roads & stops' : item.id === 'rail' ? 'Rail network' : item.label
    const cards = item.tools.map(tool => this.toolCardHtml(tool)).join('')
    this.el.buildPanel.innerHTML = `
      <div class="build-head">
        <div class="title-wrap"><h3>${title}</h3><span class="sub">Choose a tool, then use the map</span></div>
        <button class="build-close" data-build-close title="Close">${this.icon('close')}</button>
      </div>
      <div class="build-items">${cards}</div>`
  }

  toolCardHtml(tool) {
    const info = TOOL_INFO[tool]
    if (!info) return ''
    const selected = this.activeTool === tool
    const iconName = tool === 'railstation' ? 'railstation' : tool
    return `<button class="build-card${selected ? ' selected' : ''}" data-tool="${tool}">
      <div class="card-top">
        <span class="card-icon">${this.icon(iconName)}</span>
        <div><b>${info.label}</b><span class="price">${formatMoney(info.cost)}</span></div>
      </div>
      <small>${BUILD_DESCRIPTIONS[tool] || info.hint}</small>
    </button>`
  }

  vehicleCardsHtml() {
    const cards = VEHICLE_ORDER.map(type => {
      const def = VEHICLES[type]
      const stationKind = STATION_KIND[type]
      const compatible = this.world.stations.filter(s => s.kind === stationKind).length
      const available = compatible >= 2
      return `<button class="build-card" data-vehicle-type="${type}">
        <div class="card-top">
          <span class="card-icon">${this.icon(type)}</span>
          <div><b>${def.label}</b><span class="price">${formatMoney(def.cost)}</span></div>
        </div>
        <small>${def.description}</small>
        <div class="tag-row">
          <span class="tag">${formatNumber(def.capacity)} cap</span>
          <span class="tag">${def.speed} km/h</span>
          <span class="tag" style="color:${available ? '#7fffd4' : '#94b4ae'}">${compatible} ${STATION_LABELS[stationKind]}${compatible === 1 ? '' : 's'}</span>
        </div>
      </button>`
    }).join('')
    return `
      <div class="build-head">
        <div class="title-wrap"><h3>Buy vehicles</h3><span class="sub">Choose a vehicle to plan a route between two stations</span></div>
        <button class="build-close" data-build-close title="Close">${this.icon('close')}</button>
      </div>
      <div class="build-items">${cards}</div>`
  }

  routeBuilderHtml() {
    const def = VEHICLES[this.route.type]
    const origin = this.route.originId ? this.world.stationById.get(this.route.originId) : null
    const destination = this.route.destinationId ? this.world.stationById.get(this.route.destinationId) : null
    const cargos = def.cargos
    const cargoButtons = cargos.map(type => {
      const produced = origin ? origin.produces.has(type) : false
      const active = this.route.cargo === type
      return `<button class="cargo-chip${active ? ' active' : ''}" data-action="cargo" data-cargo="${type}" title="${produced ? 'Produced here' : 'Not produced here'}">
        <i style="background:${cargoColor(type)}"></i>${cargoName(type)}
      </button>`
    }).join('')
    const step1 = origin ? 'done' : 'active'
    const step2 = origin && this.route.cargo ? 'done' : origin ? 'active' : ''
    const step3 = destination ? 'done' : origin && this.route.cargo ? 'active' : ''
    const ready = origin && destination && this.route.cargo
    const hint = this.routeHint()
    return `
      <div class="build-head">
        <div class="title-wrap"><h3>New ${def.label.toLowerCase()} route</h3><span class="sub">Two stations, one cargo, one vehicle</span></div>
        <button class="build-close" data-build-close title="Close">${this.icon('close')}</button>
      </div>
      <div class="route-builder">
        <div class="route-top">
          <span class="route-badge">${this.icon(this.route.type)}</span>
          <div class="route-title">
            <b>${origin ? escapeHtml(origin.name) : `${def.label} route setup`}</b>
            <small>${destination ? `to ${escapeHtml(destination.name)}` : origin ? 'Choose a destination that accepts the cargo' : `Choose a ${STATION_LABELS[STATION_KIND[this.route.type]].toLowerCase()} to start`}</small>
          </div>
          <button class="ghost-btn" data-action="route-back">Back</button>
        </div>
        <div class="route-steps">
          <span class="route-step ${step1}"><span class="num">1</span>${origin ? escapeHtml(origin.name) : 'Origin'}</span>
          <span class="route-arrow">→</span>
          <span class="route-step ${step2}"><span class="num">2</span>${this.route.cargo ? cargoName(this.route.cargo) : 'Cargo'}</span>
          <span class="route-arrow">→</span>
          <span class="route-step ${step3}"><span class="num">3</span>${destination ? escapeHtml(destination.name) : 'Destination'}</span>
        </div>
        ${origin ? `<div class="cargo-row"><span class="label">Cargo</span>${cargoButtons}</div>` : ''}
        <div class="route-hint">${hint}</div>
        <div class="route-actions">
          ${origin ? '<button class="ghost-btn" data-action="route-reset">Reset</button>' : ''}
          ${ready ? `<button class="solid-btn" data-action="route-buy">Purchase ${def.label} · ${formatMoney(def.cost)}</button>` : ''}
        </div>
      </div>`
  }

  routeHint() {
    const def = VEHICLES[this.route.type]
    if (!this.route.originId) {
      return `<strong>Click a ${STATION_LABELS[STATION_KIND[this.route.type]].toLowerCase()}</strong> on the map to set the origin. Pulsing rings mark every compatible station.`
    }
    if (!this.route.cargo) {
      return 'Choose the cargo this route will carry. The destination must accept it.'
    }
    const destinations = this.destinationCandidates()
    if (!destinations.length) {
      return `<strong>No station accepts ${cargoName(this.route.cargo).toLowerCase()} yet.</strong> Try another cargo or build a compatible destination stop.`
    }
    if (!this.route.destinationId) {
      return `<strong>Click a destination</strong> that accepts ${cargoName(this.route.cargo).toLowerCase()}.`
    }
    return `Ready to buy a ${def.label.toLowerCase()} for <strong>${formatMoney(def.cost)}</strong>. It will run both ways automatically.`
  }

  // ---------------------------------------------------------------- modes
  resetInteraction() {
    this.activeTool = null
    this.route = null
    this.mode = 'select'
    this.drag = null
    this.renderer.clearPreview()
    this.renderer.setHover(null)
    this.clearHighlights()
    this.hideBanner()
    this.el.cursorTip.hidden = true
  }

  cancelCurrent() {
    if (this.modal) {
      this.closeModal()
      return
    }
    if (this.route) {
      this.cancelRoute()
      return
    }
    if (this.mode !== 'select') {
      this.resetInteraction()
      if (this.activeGroup) this.renderBuildPanel()
      return
    }
    this.closeBuildPanel()
  }

  cancelRoute() {
    const group = this.activeGroup || 'vehicles'
    this.route = null
    this.mode = 'select'
    this.clearHighlights()
    this.hideBanner()
    this.renderer.clearPreview()
    this.activeGroup = group
    this.el.buildPanel.hidden = false
    this.renderBuildPanel()
    this.updateToolbar()
  }

  chooseTool(tool) {
    if (this.mode === 'build' && this.activeTool === tool) {
      this.cancelCurrent()
      return
    }
    this.resetInteraction()
    this.clearSelection()
    this.activeTool = tool
    this.mode = 'build'
    const item = TOOLBAR.find(t => t.tools?.includes(tool))
    this.activeGroup = item && item.tools.length > 1 ? item.id : null
    if (this.activeGroup) {
      this.el.buildPanel.hidden = false
      this.renderBuildPanel()
    } else {
      this.el.buildPanel.hidden = true
    }
    const info = TOOL_INFO[tool]
    this.showBanner(this.icon(item?.icon || tool), info.label, info.hint)
    this.updateToolbar()
  }

  showBanner(icon, title, hint) {
    this.el.modeIcon.innerHTML = icon
    this.el.modeTitle.textContent = title
    this.el.modeHint.textContent = hint
    this.el.modeBanner.hidden = false
  }

  hideBanner() {
    this.el.modeBanner.hidden = true
  }

  updateBanner() {
    if (!this.route) return
    const def = VEHICLES[this.route.type]
    const stop = STATION_LABELS[STATION_KIND[this.route.type]].toLowerCase()
    let hint = `Click a glowing ${stop} to set the origin.`
    if (this.route.originId && !this.route.cargo) hint = 'Choose a cargo for this route.'
    else if (this.route.originId && this.route.cargo && !this.route.destinationId) {
      hint = this.destinationCandidates().length
        ? `Click a destination that accepts ${cargoName(this.route.cargo).toLowerCase()}.`
        : `No station accepts ${cargoName(this.route.cargo).toLowerCase()} yet.`
    } else if (this.route.destinationId) hint = 'Ready to purchase. Review the route below.'
    this.showBanner(this.icon(this.route.type), `New ${def.label.toLowerCase()} route`, hint)
  }

  // --------------------------------------------------------------- routes
  beginRoute(type) {
    if (!VEHICLES[type]) return
    this.resetInteraction()
    this.clearSelection()
    this.route = { type, cargo: null, originId: null, destinationId: null }
    this.mode = 'route'
    this.activeGroup = 'vehicles'
    this.el.buildPanel.hidden = false
    this.renderBuildPanel()
    this.updateBanner()
    this.updateToolbar()
    this.refreshRouteHighlights()
    this.el.buildPanel.scrollIntoView({ block: 'nearest' })
  }

  compatibleStations() {
    if (!this.route) return []
    const kind = STATION_KIND[this.route.type]
    return this.world.stations.filter(s => s.kind === kind)
  }

  destinationCandidates() {
    if (!this.route || !this.route.originId || !this.route.cargo) return []
    return this.compatibleStations().filter(s => s.id !== this.route.originId && s.accepts.has(this.route.cargo))
  }

  refreshRouteHighlights() {
    if (!this.route) {
      this.clearHighlights()
      return
    }
    if (!this.route.originId) {
      this.renderer.setStationHighlights(this.compatibleStations(), '#7fd1ff')
    } else if (this.route.cargo && !this.route.destinationId) {
      this.renderer.setStationHighlights(this.destinationCandidates(), '#7fffd4')
    } else if (this.route.destinationId) {
      const a = this.world.stationById.get(this.route.originId)
      const b = this.world.stationById.get(this.route.destinationId)
      this.renderer.setStationHighlights([a, b].filter(Boolean), '#ecc56b')
    }
  }

  clearHighlights() {
    this.renderer.setStationHighlights(null)
  }

  handleRouteClick(tile) {
    const station = this.world.stationAt(tile.x, tile.y)
    if (!station) {
      this.showToast(`Click directly on a ${STATION_LABELS[STATION_KIND[this.route.type]].toLowerCase()}.`, 'hint')
      return
    }
    const expected = STATION_KIND[this.route.type]
    if (station.kind !== expected) {
      this.showToast(`${station.name} is not a ${STATION_LABELS[expected].toLowerCase()}.`, 'error')
      return
    }
    if (!this.route.originId) {
      this.route.originId = station.id
      const produced = VEHICLES[this.route.type].cargos.filter(c => station.produces.has(c))
      this.route.cargo = produced[0] || VEHICLES[this.route.type].cargos[0]
      this.refreshRouteHighlights()
      this.renderBuildPanel()
      this.updateBanner()
      return
    }
    if (station.id === this.route.originId) {
      this.showToast('Choose a different destination station.', 'error')
      return
    }
    if (this.route.cargo && !station.accepts.has(this.route.cargo)) {
      this.showToast(`${station.name} does not accept ${cargoName(this.route.cargo).toLowerCase()}.`, 'error')
      this.refreshRouteHighlights()
      return
    }
    this.route.destinationId = station.id
    this.refreshRouteHighlights()
    this.renderBuildPanel()
    this.updateBanner()
  }

  setRouteCargo(cargo) {
    if (!this.route) return
    const def = VEHICLES[this.route.type]
    if (!def.cargos.includes(cargo)) return
    this.route.cargo = cargo
    this.route.destinationId = null
    this.refreshRouteHighlights()
    this.renderBuildPanel()
    this.updateBanner()
  }

  resetRoute() {
    if (!this.route) return
    this.route.originId = null
    this.route.destinationId = null
    this.route.cargo = null
    this.refreshRouteHighlights()
    this.renderBuildPanel()
    this.updateBanner()
  }

  buyRoute() {
    if (!this.route) return
    const { type, cargo, originId, destinationId } = this.route
    const result = this.game.createVehicle({ type, cargo, originId, destinationId })
    if (!result.ok) return
    this.route = null
    this.mode = 'select'
    this.clearHighlights()
    this.hideBanner()
    this.el.buildPanel.hidden = true
    this.activeGroup = null
    this.updateToolbar()
    this.selectVehicle(result.vehicle)
  }

  planRouteFromStation(station) {
    const type = VEHICLE_FOR_STATION[station.kind]
    if (!type) return
    this.beginRoute(type)
    this.route.originId = station.id
    const def = VEHICLES[type]
    const produced = def.cargos.filter(c => station.produces.has(c))
    this.route.cargo = produced[0] || def.cargos[0]
    this.refreshRouteHighlights()
    this.renderBuildPanel()
    this.updateBanner()
  }

  // ------------------------------------------------------------- interaction
  toolFootprint(tool = this.activeTool) {
    if (tool === 'railstation') return 2
    if (tool === 'dock') return 2
    if (tool === 'airport') return 4
    return 1
  }

  stationKindForTool(tool = this.activeTool) {
    if (tool === 'railstation') return 'rail'
    if (tool === 'bus' || tool === 'truck' || tool === 'dock' || tool === 'airport') return tool
    return null
  }

  onPointerDown(e) {
    if (e.button !== 0) return
    const tile = this.renderer.pickTile(e.clientX, e.clientY)
    if (!tile) return
    this.pointerDown = { x: e.clientX, y: e.clientY, tile, moved: false }
    if (this.mode === 'build' && (this.activeTool === 'road' || this.activeTool === 'rail')) {
      this.drag = { start: tile, end: tile, path: [tile], estimate: null }
      this.updatePathPreview()
    }
  }

  onPointerMove(e) {
    const tile = this.renderer.pickTile(e.clientX, e.clientY)
    if (!tile) {
      this.el.cursorTip.hidden = true
      this.renderer.setHover(null)
      return
    }
    if (this.pointerDown) {
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y)
      if (moved > 6) this.pointerDown.moved = true
    }
    if (this.drag && (this.activeTool === 'road' || this.activeTool === 'rail')) {
      this.drag.end = tile
      this.drag.path = this.pathBetween(this.drag.start, tile)
      this.updatePathPreview()
      this.showBuildTip(tile, e.clientX, e.clientY)
      return
    }
    if (this.mode === 'build' && this.activeTool) {
      this.updateBuildHover(tile, e.clientX, e.clientY)
      return
    }
    if (this.mode === 'route') {
      const station = this.world.stationAt(tile.x, tile.y)
      this.renderer.setHover(null)
      if (station) {
        this.setTip(e.clientX, e.clientY, `<b>${escapeHtml(station.name)}</b> · ${STATION_LABELS[station.kind]}`, true)
      } else {
        this.el.cursorTip.hidden = true
      }
      return
    }
    this.renderer.setHover(null)
    const feature = this.featureAt(tile)
    if (feature) {
      this.setTip(e.clientX, e.clientY, `<b>${escapeHtml(feature.name)}</b> · ${feature.label}`, true)
    } else {
      this.el.cursorTip.hidden = true
    }
  }

  onPointerUp(e) {
    if (!this.pointerDown || e.button !== 0) return
    const down = this.pointerDown
    this.pointerDown = null
    if (e.target && e.target.closest && e.target.closest('#ui, #start-screen, #modal-root')) {
      if (this.drag) {
        this.drag = null
        this.renderer.clearPreview()
      }
      return
    }
    if (this.drag) {
      const path = this.drag.path
      const tool = this.activeTool
      this.drag = null
      this.renderer.clearPreview()
      if (tool === 'road') this.game.buildRoad(path)
      else if (tool === 'rail') this.game.buildRail(path)
      this.lastPanel = 0
      this.updateHud(true)
      return
    }
    if (down.moved) return
    const tile = this.renderer.pickTile(e.clientX, e.clientY) || down.tile
    if (!tile) return
    if (this.mode === 'route') this.handleRouteClick(tile)
    else if (this.mode === 'build') this.handleBuildClick(tile)
    else this.selectAt(tile)
  }

  pathBetween(a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    return orthogonalPath(a.x, a.y, b.x, b.y, Math.abs(dx) >= Math.abs(dy))
  }

  updatePathPreview() {
    if (!this.drag) return
    const path = this.drag.path
    const estimate = this.activeTool === 'rail' ? this.game.estimateRail(path) : this.game.estimateRoad(path)
    this.drag.estimate = estimate
    this.renderer.setHover(null)
    this.renderer.setPreview(path, estimate.ok)
  }

  updateBuildHover(tile, clientX, clientY) {
    const tool = this.activeTool
    const stationKind = this.stationKindForTool(tool)
    if (stationKind) {
      const info = this.game.stationInfo(stationKind, tile.x, tile.y)
      const tiles = info.tiles && info.tiles.length ? info.tiles : [{ x: tile.x, y: tile.y }]
      this.renderer.setHover(tile, tiles, info.ok)
      this.setTip(clientX, clientY, info.ok
        ? `<b>${STATION_LABELS[stationKind]}</b> · ${formatMoney(info.cost)}`
        : `<b>Cannot build</b> · ${escapeHtml(info.reason || 'Blocked terrain')}`, info.ok)
      return
    }
    if (tool === 'tree') {
      const valid = this.canPlantTree(tile)
      this.renderer.setHover(tile, 1, valid)
      this.setTip(clientX, clientY, valid ? `<b>Plant trees</b> · ${formatMoney(BUILD_COST.tree)}` : '<b>Cannot plant</b> · Needs empty ground', valid)
      return
    }
    if (tool === 'bulldoze') {
      const label = this.bulldozeLabel(tile)
      this.renderer.setHover(tile, 1, Boolean(label))
      this.setTip(clientX, clientY, label ? `<b>Bulldoze</b> · ${label} · ${formatMoney(BUILD_COST.remove)}` : '<b>Nothing to remove</b>', Boolean(label))
    }
  }

  showBuildTip(tile, clientX, clientY) {
    if (!this.drag) return
    const estimate = this.drag.estimate
    const label = this.activeTool === 'rail' ? 'Rail track' : 'Road'
    if (!estimate) return
    if (estimate.ok) {
      const count = estimate.tiles?.length || 0
      this.setTip(clientX, clientY, `<b>${label}</b> · ${count} tiles · ${formatMoney(estimate.cost)}`, true)
    } else {
      this.setTip(clientX, clientY, `<b>Blocked</b> · ${escapeHtml(estimate.reason || 'Cannot build here')}`, false)
    }
  }

  setTip(x, y, html, valid = true) {
    const tip = this.el.cursorTip
    tip.innerHTML = html
    tip.classList.toggle('bad', !valid)
    tip.hidden = false
    const width = tip.offsetWidth || 150
    const height = tip.offsetHeight || 24
    tip.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 22))}px`
    tip.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 22))}px`
  }

  handleBuildClick(tile) {
    const tool = this.activeTool
    const stationKind = this.stationKindForTool(tool)
    if (stationKind) {
      const result = this.game.placeStation(stationKind, tile.x, tile.y)
      if (result.ok && result.station) {
        this.showToast(`${result.station.name} opened for ${formatMoney(result.cost)}.`, 'success')
        this.lastPanel = 0
        this.updateHud(true)
      }
      return
    }
    if (tool === 'tree') {
      const result = this.game.plantTree(tile.x, tile.y)
      if (result.ok) {
        this.showToast('Trees planted.', 'success')
        this.updateHud(true)
      }
      return
    }
    if (tool === 'bulldoze') {
      const result = this.game.bulldoze(tile.x, tile.y)
      if (result.ok) {
        const label = result.removed === 'station' ? 'Station' : result.removed === 'rail' ? 'Rail track' : result.removed === 'road' ? 'Road' : 'Tree'
        this.showToast(`${label} removed.`, 'success')
        this.updateHud(true)
      }
    }
  }

  canPlantTree(tile) {
    const t = this.world.getTile(tile.x, tile.y)
    return Boolean(t && t.type === 'empty' && !this.world.isWater(tile.x, tile.y) && this.world.tileSlope(tile.x, tile.y) <= 1.8)
  }

  bulldozeLabel(tile) {
    const t = this.world.getTile(tile.x, tile.y)
    if (!t) return null
    if (t.stationId) return 'station'
    if (t.road > 0) return 'road'
    if (t.rail > 0) return 'rail'
    if (t.type === 'tree') return 'tree'
    return null
  }

  // --------------------------------------------------------------- selection
  featureAt(tile) {
    const station = this.world.stationAt(tile.x, tile.y)
    if (station) return { type: 'station', id: station.id, name: station.name, label: STATION_LABELS[station.kind] }
    const tileData = this.world.getTile(tile.x, tile.y)
    if (tileData?.industryId) {
      const industry = this.world.industryById.get(tileData.industryId)
      if (industry) return { type: 'industry', id: industry.id, name: industry.label, label: 'Industry' }
    }
    let town = null
    let best = Infinity
    for (const t of this.world.towns) {
      const d = Math.hypot(t.x - tile.x, t.y - tile.y)
      if (d < t.radius && d < best) { best = d; town = t }
    }
    if (town) return { type: 'town', id: town.id, name: town.name, label: 'Town' }
    return null
  }

  selectAt(tile) {
    const feature = this.featureAt(tile)
    if (!feature) {
      this.clearSelection()
      return
    }
    if (feature.type === 'station') this.selectStation(this.world.stationById.get(feature.id))
    else if (feature.type === 'industry') this.selectIndustry(this.world.industryById.get(feature.id))
    else if (feature.type === 'town') this.selectTown(this.world.townById.get(feature.id))
  }

  selectStation(station) {
    if (!station) return
    this.selection = { type: 'station', id: station.id }
    this.renderer.setSelection(this.selection)
    this.renderer.showRoutes(this.game.routeSegmentsForStation(station))
    this.el.sidePanel.hidden = false
    this.renderSidePanel()
  }

  selectVehicle(vehicle) {
    if (!vehicle) return
    this.selection = { type: 'vehicle', id: vehicle.id }
    this.renderer.setSelection(this.selection)
    this.renderer.showRoutes(this.game.routeSegmentsForVehicle(vehicle))
    this.el.sidePanel.hidden = false
    this.renderSidePanel()
  }

  selectTown(town) {
    if (!town) return
    this.selection = { type: 'town', id: town.id }
    this.renderer.setSelection(this.selection)
    this.renderer.clearRoutes()
    this.el.sidePanel.hidden = false
    this.renderSidePanel()
  }

  selectIndustry(industry) {
    if (!industry) return
    this.selection = { type: 'industry', id: industry.id }
    this.renderer.setSelection(this.selection)
    this.renderer.clearRoutes()
    this.el.sidePanel.hidden = false
    this.renderSidePanel()
  }

  clearSelection() {
    this.selection = null
    this.renderer.setSelection(null)
    this.el.sidePanel.hidden = true
    this.el.sidePanel.innerHTML = ''
  }

  // --------------------------------------------------------------- side panel
  renderSidePanel() {
    if (!this.selection) return
    let html = ''
    if (this.selection.type === 'station') {
      const station = this.world.stationById.get(this.selection.id)
      if (!station) { this.clearSelection(); return }
      html = this.stationPanelHtml(station)
    } else if (this.selection.type === 'vehicle') {
      const vehicle = this.game.vehicles.find(v => v.id === this.selection.id)
      if (!vehicle) { this.clearSelection(); return }
      html = this.vehiclePanelHtml(vehicle)
    } else if (this.selection.type === 'town') {
      const town = this.world.townById.get(this.selection.id)
      if (!town) { this.clearSelection(); return }
      html = this.townPanelHtml(town)
    } else if (this.selection.type === 'industry') {
      const industry = this.world.industryById.get(this.selection.id)
      if (!industry) { this.clearSelection(); return }
      html = this.industryPanelHtml(industry)
    }
    const scroll = this.el.sidePanel.scrollTop
    this.el.sidePanel.innerHTML = html
    this.el.sidePanel.scrollTop = scroll
    this.el.sidePanel.hidden = false
  }

  panelHeader(icon, eyebrow, title, subtitle) {
    return `<div class="side-head">
      <span class="side-icon">${this.icon(icon)}</span>
      <div class="side-copy"><span class="eyebrow">${eyebrow}</span><h2>${escapeHtml(title)}</h2><span class="muted">${escapeHtml(subtitle)}</span></div>
      <button class="side-close" data-side-close title="Close">${this.icon('close')}</button>
    </div>`
  }

  stationPanelHtml(station) {
    const town = station.townId ? this.world.townById.get(station.townId) : null
    const industry = station.industryId ? this.world.industryById.get(station.industryId) : null
    const cargoTypes = [...new Set([...station.produces, ...station.accepts, ...Object.keys(station.cargo)])]
    const cargoTotal = Object.values(station.cargo).reduce((a, b) => a + b, 0)
    const cargoRows = cargoTypes.length ? cargoTypes.map(type => {
      const amount = station.cargo[type] || 0
      const tags = [station.produces.has(type) ? 'Produced' : '', station.accepts.has(type) ? 'Accepted' : ''].filter(Boolean).join(' · ')
      return `<div class="cargo-line">
        <i style="background:${cargoColor(type)}"></i>
        <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:8px"><span>${cargoName(type)}</span><b>${formatNumber(amount)}</b></div>
        <div class="cargo-track"><i style="width:${pct(amount, 300)}%;background:${cargoColor(type)}"></i></div>
        <span class="muted-line" style="font-size:8.5px">${tags}</span></div>
      </div>`
    }).join('') : '<div class="muted-line">No cargo activity yet.</div>'
    const vehicles = [...station.vehicles].map(id => this.game.vehicles.find(v => v.id === id)).filter(Boolean)
    const vehicleRows = vehicles.length ? vehicles.map(v => {
      const status = this.vehicleStatus(v)
      return `<div class="vehicle-mini"><i class="dot ${v.state === 'idle' ? 'idle' : v.state === 'blocked' ? 'blocked' : ''}"></i><span>${escapeHtml(v.name)} · ${status}</span><button data-side-action="open-vehicle" data-vehicle="${v.id}">View</button></div>`
    }).join('') : '<div class="muted-line">No vehicles call here yet.</div>'
    return `${this.panelHeader(station.kind === 'rail' ? 'train' : station.kind === 'dock' ? 'ship' : station.kind === 'airport' ? 'plane' : 'bus', STATION_LABELS[station.kind], station.name, town ? `${town.name}${industry ? ' · ' + industry.label : ''}` : industry ? industry.label : 'Standalone stop')}
      <div class="chip-row">
        <span class="badge">${Math.round(station.rating * 100)}% rating</span>
        <span class="badge gold">${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}</span>
        ${town ? `<span class="badge blue">${formatNumber(town.population)} people</span>` : ''}
      </div>
      <div class="stat-grid">
        <div class="mini-stat"><span>Cargo waiting</span><b>${formatNumber(cargoTotal)}</b></div>
        <div class="mini-stat"><span>Delivered</span><b>${formatNumber(station.totalDelivered)}</b></div>
      </div>
      <div class="section-label">Cargo</div>
      <div class="cargo-list">${cargoRows}</div>
      <div class="section-label">Vehicles</div>
      ${vehicleRows}
      <div class="side-actions">
        <button class="solid-btn" data-side-action="plan-route" data-station="${station.id}">Plan route</button>
        <button class="ghost-btn" data-side-action="focus" data-coords="${station.center.x},${station.center.y}">Focus</button>
        <button class="danger-btn" data-side-action="demolish-station" data-station="${station.id}">Demolish</button>
      </div>`
  }

  townPanelHtml(town) {
    const stations = [...town.stations].map(id => this.world.stationById.get(id)).filter(Boolean)
    const stationRows = stations.length ? stations.map(s => `<div class="vehicle-mini"><i class="dot"></i><span>${escapeHtml(s.name)} · ${STATION_LABELS[s.kind]}</span><button data-side-action="open-station" data-station="${s.id}">View</button></div>`).join('') : '<div class="muted-line">No stations in this town yet.</div>'
    const busStation = stations.find(s => s.kind === 'bus')
    return `${this.panelHeader('people', 'Town', town.name, `${formatNumber(town.population)} residents · ${town.served ? 'served by transport' : 'not yet served'}`)}
      <div class="chip-row">
        <span class="badge ${town.served ? '' : 'coral'}">${town.served ? 'Served' : 'Unserved'}</span>
        <span class="badge gold">+${formatNumber(town.growth)} / month</span>
        <span class="badge blue">${stations.length} station${stations.length === 1 ? '' : 's'}</span>
      </div>
      <div class="stat-grid">
        <div class="mini-stat"><span>Population</span><b>${formatNumber(town.population)}</b></div>
        <div class="mini-stat"><span>Houses</span><b>${formatNumber(town.houses.length)}</b></div>
        <div class="mini-stat"><span>Produces</span><b style="font-size:10px">Passengers, mail</b></div>
        <div class="mini-stat"><span>Accepts</span><b style="font-size:10px">Goods</b></div>
      </div>
      <div class="section-label">Stations</div>
      ${stationRows}
      <div class="side-actions">
        <button class="ghost-btn" data-side-action="focus" data-coords="${town.x},${town.y}">Focus town</button>
        ${busStation ? `<button class="solid-btn" data-side-action="select-town-route" data-town="${town.id}">Plan bus route</button>` : ''}
      </div>`
  }

  industryPanelHtml(industry) {
    const station = industry.stationId ? this.world.stationById.get(industry.stationId) : null
    const output = industry.output ? cargoName(industry.output) : 'None'
    const input = industry.input ? cargoName(industry.input) : 'None'
    return `${this.panelHeader('factory', 'Industry', industry.label, `${output} producer${industry.input ? ' · needs ' + input.toLowerCase() : ''}`)}
      <div class="chip-row">
        <span class="badge">${Math.round(industry.efficiency * 100)}% efficiency</span>
        ${output !== 'None' ? `<span class="badge gold">${output}</span>` : ''}
        ${input !== 'None' ? `<span class="badge blue">${input}</span>` : ''}
      </div>
      <div class="stat-grid">
        <div class="mini-stat"><span>Production</span><b>${formatNumber(industry.production)}</b></div>
        <div class="mini-stat"><span>Input stock</span><b>${formatNumber(industry.inputStock)}</b></div>
        <div class="mini-stat"><span>Footprint</span><b>${industry.w} × ${industry.h}</b></div>
        <div class="mini-stat"><span>Station</span><b style="font-size:10px">${station ? 'Connected' : 'None'}</b></div>
      </div>
      ${station ? `<div class="section-label">Linked station</div><div class="vehicle-mini"><i class="dot"></i><span>${escapeHtml(station.name)}</span><button data-side-action="open-station" data-station="${station.id}">View</button></div>` : '<div class="muted-line">Build a truck stop, rail station or dock nearby to move this cargo.</div>'}
      <div class="side-actions">
        <button class="ghost-btn" data-side-action="focus" data-coords="${industry.cx},${industry.cy}">Focus</button>
        ${station ? `<button class="solid-btn" data-side-action="plan-route" data-station="${station.id}">Plan route</button>` : ''}
      </div>`
  }

  vehiclePanelHtml(vehicle) {
    const def = VEHICLES[vehicle.type]
    const orders = vehicle.orders.map((id, index) => {
      const station = this.world.stationById.get(id)
      if (!station) return ''
      return `<div class="order-row ${index === vehicle.orderIndex ? 'active' : ''}"><span class="idx">${index + 1}</span><span>${escapeHtml(station.name)}</span><b style="color:${index === vehicle.orderIndex ? '#7fffd4' : '#94b4ae'};font-size:9px">${index === vehicle.orderIndex ? 'HERE' : ''}</b></div>`
    }).join('')
    const status = this.vehicleStatus(vehicle)
    const loadPct = pct(vehicle.load, vehicle.capacity)
    return `${this.panelHeader(vehicle.type, def.label, vehicle.name, status)}
      <div class="chip-row">
        <span class="badge" style="color:${cargoColor(vehicle.cargo)};border-color:${cargoColor(vehicle.cargo)}44"><i style="width:6px;height:6px;border-radius:50%;display:inline-block;background:${cargoColor(vehicle.cargo)}"></i>${cargoName(vehicle.cargo)}</span>
        <span class="badge gold">${formatMoney(def.cost)}</span>
        <span class="badge ${vehicle.state === 'blocked' ? 'coral' : 'blue'}">${vehicle.state}</span>
      </div>
      <div class="stat-grid">
        <div class="mini-stat"><span>Load</span><b>${formatNumber(vehicle.load)} / ${formatNumber(vehicle.capacity)}</b></div>
        <div class="mini-stat"><span>Profit</span><b class="mint">${formatMoney(vehicle.totalProfit)}</b></div>
        <div class="mini-stat"><span>Delivered</span><b>${formatNumber(vehicle.totalDelivered)}</b></div>
        <div class="mini-stat"><span>Speed</span><b>${def.speed} km/h</b></div>
      </div>
      <div class="section-label">Load</div>
      <div class="cargo-track" style="height:6px"><i style="width:${loadPct}%;background:${cargoColor(vehicle.cargo)}"></i></div>
      <div class="section-label">Orders</div>
      <div class="orders">${orders || '<div class="muted-line">No orders. Add a station to start earning.</div>'}</div>
      <div class="side-actions">
        <button class="ghost-btn" data-side-action="focus" data-coords="${vehicle.pose ? this.world.tileFromWorld(vehicle.pose.x, vehicle.pose.z).x : 0},${vehicle.pose ? this.world.tileFromWorld(vehicle.pose.x, vehicle.pose.z).y : 0}">Focus</button>
        <button class="ghost-btn" data-side-action="clone-vehicle" data-vehicle="${vehicle.id}">Clone</button>
        <button class="danger-btn" data-side-action="sell-vehicle" data-vehicle="${vehicle.id}">Sell</button>
      </div>`
  }

  vehicleStatus(vehicle) {
    const station = this.world.stationById.get(vehicle.orders[vehicle.orderIndex])
    const next = this.world.stationById.get(vehicle.orders[(vehicle.orderIndex + 1) % Math.max(1, vehicle.orders.length)])
    if (vehicle.state === 'moving') return next ? `En route to ${next.name}` : 'En route'
    if (vehicle.state === 'docked') return station ? `Loading at ${station.name}` : 'Docked'
    if (vehicle.state === 'blocked') return next ? `Waiting for route to ${next.name}` : 'Blocked'
    if (vehicle.state === 'idle') return 'Idle · needs orders'
    return vehicle.state
  }

  // --------------------------------------------------------------- HUD/news
  updateHud(force = false) {
    const now = performance.now()
    if (!force && now - this.lastHud < 120) return
    this.lastHud = now
    this.el.cash.textContent = formatMoney(this.game.money)
    this.el.loan.textContent = formatMoney(this.game.loan)
    this.el.value.textContent = formatMoney(this.game.companyValue(), true)
    this.el.date.textContent = dateLabel(START_DATE, this.game.totalDays)
    this.el.newsDate.textContent = dateLabel(START_DATE, this.game.totalDays)
    this.el.cash.style.color = this.game.money < 0 ? '#ff806d' : ''
  }

  updateSpeed() {
    const paused = this.game.paused || !this.started
    for (const button of document.querySelectorAll('.speed-btn')) {
      const speed = Number(button.dataset.speed)
      if (speed === 0) {
        button.classList.toggle('active', paused)
        button.innerHTML = paused
          ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"></path></svg>'
          : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>'
      } else {
        button.classList.toggle('active', !paused && this.game.speed === speed)
      }
    }
  }

  renderObjectives() {
    const values = {
      passengers: this.game.stats.passengers,
      freight: this.game.stats.freight,
      value: this.game.companyValue(),
      servedPopulation: this.game.stats.servedPopulation
    }
    const list = this.game.objectives.map(objective => {
      const value = values[objective.stat] || 0
      const progress = Math.min(1, value / objective.goal)
      const valueLabel = ['value', 'servedPopulation'].includes(objective.stat) ? formatNumber(value) : formatNumber(value)
      return `<div class="objective ${objective.complete ? 'complete' : ''}">
        <span class="check">${this.icon('check')}</span>
        <div class="obj-body">
          <div class="obj-text">${escapeHtml(objective.text)}</div>
          <div class="obj-meta"><span>${valueLabel} / ${formatNumber(objective.goal)}</span><span>+${formatMoney(objective.reward, true)}</span></div>
          <div class="obj-bar"><i style="width:${progress * 100}%"></i></div>
        </div>
      </div>`
    }).join('')
    this.el.objectiveList.innerHTML = list
    const complete = this.game.objectives.filter(o => o.complete).length
    this.el.objectiveCount.textContent = `${complete} / ${this.game.objectives.length}`
  }

  renderNews() {
    const items = this.game.news.length
      ? this.game.news.slice(0, 3)
      : [{ text: 'Your transport company is ready. Connect the two bus stops to open your first route.', type: 'hint' }]
    this.el.newsList.innerHTML = items.map(item => `<div class="news-line ${item.type || ''}"><i></i><span>${escapeHtml(item.text)}</span></div>`).join('')
  }

  showToast(text, type = 'info') {
    if (!text) return
    const toast = document.createElement('div')
    toast.className = `toast ${type || ''}`
    toast.textContent = text
    this.el.toastRoot.appendChild(toast)
    while (this.el.toastRoot.children.length > 4) this.el.toastRoot.firstElementChild.remove()
    const timer = window.setTimeout(() => {
      toast.classList.add('fade')
      this.toastTimers.delete(timer)
      window.setTimeout(() => toast.remove(), 320)
    }, 4600)
    this.toastTimers.add(timer)
  }

  // ----------------------------------------------------------------- minimap
  drawMinimap() {
    const ctx = this.minimapCtx
    const size = this.el.minimap.width
    const world = this.world
    const cell = size / world.size
    ctx.clearRect(0, 0, size, size)
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        const tile = world.getTile(x, y)
        if (!tile) continue
        let color = '#3e6544'
        if (tile.type === 'water') color = '#123c47'
        else if (tile.type === 'road') color = '#7d735f'
        else if (tile.type === 'rail') color = '#675d4e'
        else if (tile.type === 'house') color = '#a67d5c'
        else if (tile.type === 'industry') color = '#817c70'
        else if (tile.type === 'tree') color = '#315b3d'
        else if (tile.type === 'station') color = '#5a8178'
        else {
          const h = world.tileHeight(x, y)
          const shade = Math.max(0, Math.min(1, (h + 1) / 8))
          const variation = ((x * 13 + y * 7) % 5) * 0.012
          color = `hsl(${96 - shade * 20}, ${28 + shade * 12}%, ${27 + shade * 12 + variation * 100}%)`
        }
        if (tile.stationId) color = '#7fffd4'
        ctx.fillStyle = color
        ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell))
      }
    }
    for (const town of world.towns) {
      ctx.beginPath()
      ctx.arc(town.x * cell + cell / 2, town.y * cell + cell / 2, Math.max(2.1, cell * 1.4), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(236,197,107,0.88)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(6,20,24,0.8)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    for (const station of world.stations) {
      ctx.beginPath()
      ctx.arc(station.center.x * cell + cell / 2, station.center.y * cell + cell / 2, Math.max(1.5, cell * 0.8), 0, Math.PI * 2)
      ctx.fillStyle = '#7fffd4'
      ctx.fill()
    }
    for (const vehicle of this.game.vehicles) {
      if (!vehicle.pose) continue
      const tile = world.tileFromWorld(vehicle.pose.x, vehicle.pose.z)
      ctx.fillStyle = '#fff1c4'
      ctx.fillRect(tile.x * cell - 0.5, tile.y * cell - 0.5, Math.max(2, cell), Math.max(2, cell))
    }
    const targetTile = world.tileFromWorld(this.renderer.cameraTarget.x, this.renderer.cameraTarget.z)
    const tx = targetTile.x * cell + cell / 2
    const ty = targetTile.y * cell + cell / 2
    ctx.beginPath()
    ctx.arc(tx, ty, 7, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(tx - 10, ty); ctx.lineTo(tx - 4, ty)
    ctx.moveTo(tx + 4, ty); ctx.lineTo(tx + 10, ty)
    ctx.moveTo(tx, ty - 10); ctx.lineTo(tx, ty - 4)
    ctx.moveTo(tx, ty + 4); ctx.lineTo(tx, ty + 10)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1
    ctx.stroke()
    if (this.minimapHover) {
      ctx.strokeStyle = 'rgba(127,209,255,0.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(this.minimapHover.x * cell, this.minimapHover.y * cell, cell, cell)
    }
  }

  onMinimapClick(e) {
    const rect = this.el.minimap.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.world.size)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.world.size)
    if (!this.world.inBounds(x, y)) return
    this.renderer.focusTile(x, y, Math.min(this.renderer.desiredDistance, 100))
  }

  onMinimapMove(e) {
    const rect = this.el.minimap.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.world.size)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.world.size)
    if (!this.world.inBounds(x, y)) return
    this.minimapHover = { x, y }
    this.el.minimapCoords.textContent = `${x}, ${y}`
  }

  // ------------------------------------------------------------------ modals
  openModal(kind) {
    this.closeModal()
    this.modal = kind
    const modal = document.createElement('div')
    modal.className = 'modal'
    let html = ''
    if (kind === 'finance') html = this.financeModalHtml()
    else if (kind === 'fleet') html = this.fleetModalHtml()
    else if (kind === 'help') html = this.helpModalHtml()
    else if (kind === 'objectives') html = this.objectivesModalHtml()
    else if (kind === 'victory') html = this.victoryModalHtml()
    modal.innerHTML = `<div class="modal-card">${html}</div>`
    this.el.modalRoot.replaceChildren(modal)
  }

  closeModal() {
    this.el.modalRoot.replaceChildren()
    this.modal = null
  }

  modalHead(title, subtitle, escapeLabel = 'Overview') {
    return `<div class="modal-head">
      <div><span class="eyebrow">${escapeHtml(escapeLabel)}</span><h2>${escapeHtml(title)}</h2><span class="muted-line">${escapeHtml(subtitle)}</span></div>
      <button class="modal-close" data-modal-close title="Close">${this.icon('close')}</button>
    </div>`
  }

  financeModalHtml() {
    const f = this.game.finance
    const history = this.game.finance.history
    const net = f.revenue - f.construction - f.vehicles - f.maintenance - f.interest
    const values = history.map(h => h.value)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    const width = 300
    const height = 90
    const points = values.length > 1 ? values.map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / (max - min || 1)) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ') : `0,${height - 8} ${width},${height - 8}`
    return `${this.modalHead('Company finances', 'A live overview of cash, assets and operating costs.', 'Finance')}
      <div class="modal-grid">
        <div class="modal-section">
          <h3>Balance sheet</h3>
          <div class="fin-row"><span>Cash</span><b>${formatMoney(this.game.money)}</b></div>
          <div class="fin-row"><span>Bank loan</span><b>${formatMoney(this.game.loan)}</b></div>
          <div class="fin-row"><span>Company value</span><b>${formatMoney(this.game.companyValue())}</b></div>
          <div class="fin-row total"><span>Credit limit</span><b>${formatMoney(this.game.maxLoan)}</b></div>
          <div class="fin-actions">
            <button class="solid-btn" data-modal-action="loan" ${this.game.loan >= this.game.maxLoan ? 'disabled style="opacity:.45"' : ''}>Borrow $100k</button>
            <button class="ghost-btn" data-modal-action="repay" ${this.game.loan <= 0 ? 'disabled style="opacity:.45"' : ''}>Repay $100k</button>
          </div>
        </div>
        <div class="modal-section">
          <h3>Lifetime cash flow</h3>
          <div class="fin-row positive"><span>Revenue</span><b>${formatMoney(f.revenue)}</b></div>
          <div class="fin-row negative"><span>Construction</span><b>-${formatMoney(f.construction)}</b></div>
          <div class="fin-row negative"><span>Vehicles</span><b>-${formatMoney(f.vehicles)}</b></div>
          <div class="fin-row negative"><span>Maintenance</span><b>-${formatMoney(f.maintenance)}</b></div>
          <div class="fin-row negative"><span>Interest</span><b>-${formatMoney(f.interest)}</b></div>
          <div class="fin-row total ${net >= 0 ? 'positive' : 'negative'}"><span>Net result</span><b>${formatMoney(net)}</b></div>
        </div>
        <div class="modal-section" style="grid-column:1/-1">
          <h3>Company value trend</h3>
          <svg class="sparkline" viewBox="0 0 300 92" preserveAspectRatio="none" aria-label="Company value trend">
            <defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7fffd4" stop-opacity=".32"></stop><stop offset="100%" stop-color="#7fffd4" stop-opacity="0"></stop></linearGradient></defs>
            <polygon points="0,${height} ${points} ${width},${height}" fill="url(#sparkfill)"></polygon>
            <polyline points="${points}" fill="none" stroke="#7fffd4" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
          </svg>
          <div class="fin-row"><span>Tracked months</span><b>${Math.max(0, history.length)}</b></div>
        </div>
      </div>`
  }

  fleetModalHtml() {
    const rows = this.game.vehicles.length ? this.game.vehicles.map(vehicle => `<div class="modal-row">
      <span class="card-icon" style="width:30px;height:30px">${this.icon(vehicle.type)}</span>
      <div class="grow"><span class="name">${escapeHtml(vehicle.name)}</span><span class="sub">${cargoName(vehicle.cargo)} · ${this.vehicleStatus(vehicle)}</span></div>
      <span class="right">${formatMoney(vehicle.totalProfit)}</span>
      <button class="ghost-btn" data-modal-action="fleet-view" data-vehicle="${vehicle.id}">View</button>
      <button class="ghost-btn" data-modal-action="fleet-clone" data-vehicle="${vehicle.id}">Clone</button>
    </div>`).join('') : '<div class="muted-line">No vehicles in service yet. Build two stations and open a route to get started.</div>'
    return `${this.modalHead('Fleet', `${this.game.vehicles.length} vehicle${this.game.vehicles.length === 1 ? '' : 's'} in service`, 'Operations')}
      <div class="modal-list">${rows}</div>`
  }

  objectivesModalHtml() {
    const values = {
      passengers: this.game.stats.passengers,
      freight: this.game.stats.freight,
      value: this.game.companyValue(),
      servedPopulation: this.game.stats.servedPopulation
    }
    const rows = this.game.objectives.map(o => {
      const value = values[o.stat] || 0
      const progress = Math.min(1, value / o.goal)
      return `<div class="objective ${o.complete ? 'complete' : ''}">
        <span class="check">${this.icon('check')}</span>
        <div class="obj-body"><div class="obj-text">${escapeHtml(o.text)}</div>
        <div class="obj-meta"><span>${formatNumber(value)} / ${formatNumber(o.goal)} · bonus ${formatMoney(o.reward)}</span><span>${Math.round(progress * 100)}%</span></div>
        <div class="obj-bar"><i style="width:${progress * 100}%"></i></div></div>
      </div>`
    }).join('')
    return `${this.modalHead('Contracts', 'Complete these goals to earn cash bonuses and grow your company.', 'Objectives')}
      <div class="objective-modal">${rows}</div>`
  }

  victoryModalHtml() {
    return `${this.modalHead('Transport empire complete', 'Every contract is complete. Your network now moves a growing region.', 'Victory')}
      <div class="modal-grid">
        <div class="modal-section"><h3>Company</h3>
          <div class="fin-row"><span>Company value</span><b>${formatMoney(this.game.companyValue())}</b></div>
          <div class="fin-row"><span>Passengers carried</span><b>${formatNumber(this.game.stats.passengers)}</b></div>
          <div class="fin-row"><span>Freight delivered</span><b>${formatNumber(this.game.stats.freight)}</b></div>
        </div>
        <div class="modal-section"><h3>Network</h3>
          <div class="fin-row"><span>Stations</span><b>${this.world.stations.length}</b></div>
          <div class="fin-row"><span>Vehicles</span><b>${this.game.vehicles.length}</b></div>
          <div class="fin-row"><span>Served population</span><b>${formatNumber(this.game.stats.servedPopulation)}</b></div>
        </div>
      </div>
      <div class="fin-actions" style="margin-top:14px"><button class="solid-btn" data-modal-close>Keep building</button></div>`
  }

  helpModalHtml() {
    return `${this.modalHead('How to play', 'A quick guide to moving cargo, growing towns and building a profitable network.', 'Guide')}
      <div class="help-grid">
        <div class="modal-section">
          <h3>Your first route</h3>
          <ol class="help-list">
            <li>Click <strong>Fleet</strong> in the left toolbar and choose <strong>Bus</strong>.</li>
            <li>Click the first pulsing <strong>bus stop</strong>, then the second.</li>
            <li>Pick a cargo and press <strong>Purchase Bus</strong>.</li>
            <li>Watch passengers accumulate at stops and ride between towns.</li>
          </ol>
        </div>
        <div class="modal-section">
          <h3>Buying vehicles</h3>
          <ol class="help-list">
            <li>Every vehicle needs two stations of the matching kind.</li>
            <li>Buses and trucks use road stops; trains need rail stations.</li>
            <li>Ships need docks on water; aircraft need two airports.</li>
            <li>Destinations must accept the cargo for the delivery to pay.</li>
          </ol>
        </div>
        <div class="modal-section">
          <h3>Map controls</h3>
          <div class="help-line"><span>Pan</span><b>W A S D / right-drag</b></div>
          <div class="help-line"><span>Rotate</span><b>Q E / middle-drag</b></div>
          <div class="help-line"><span>Zoom</span><b>Mouse wheel</b></div>
          <div class="help-line"><span>Focus</span><b>Double-click</b></div>
          <div class="help-line"><span>Cancel</span><b>Esc</b></div>
          <div class="help-line"><span>Pause</span><b>Space</b></div>
        </div>
        <div class="modal-section">
          <h3>Growing the company</h3>
          <ul class="help-list">
            <li>Stations accumulate cargo from nearby towns and industries.</li>
            <li>Vehicles load at the origin and deliver to the destination.</li>
            <li>Longer routes with more cargo earn more revenue.</li>
            <li>Complete contracts for large cash bonuses.</li>
            <li>Take a loan from the finance panel when you need capital.</li>
          </ul>
        </div>
      </div>
      <div class="fin-actions" style="margin-top:14px"><button class="solid-btn" data-modal-action="close-help">Got it</button></div>`
  }

  onKeyDown(e) {
    const target = e.target
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
    if (e.code === 'Escape') {
      e.preventDefault()
      if (this.modal) {
        this.closeModal()
        return
      }
      this.cancelCurrent()
      this.closeBuildPanel()
      return
    }
    if (!this.started) return
    if (e.code === 'Space') {
      e.preventDefault()
      this.game.togglePause()
      this.updateSpeed()
    } else if (e.code === 'Digit1') this.game.setSpeed(1)
    else if (e.code === 'Digit2') this.game.setSpeed(2)
    else if (e.code === 'Digit3') this.game.setSpeed(4)
    else if (e.code === 'KeyH') this.openModal('help')
    else if (e.code === 'KeyF') this.openModal('fleet')
    else if (e.code === 'KeyM') this.openModal('finance')
  }

  update() {
    if (!this.started) return
    const now = performance.now()
    if (now - this.lastHud > 180) this.updateHud()
    if (now - this.lastMinimap > 560) {
      this.drawMinimap()
      this.lastMinimap = now
    }
    if (this.selection && now - this.lastPanel > 800) {
      this.lastPanel = now
      this.renderSidePanel()
    }
  }
}
