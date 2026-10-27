import * as THREE from 'three'
import {
  createIndustry, createStationModel, createLandmark, createVehicleVisual,
  createTreeGeometries, createRockGeometry, getGableRoofGeometry, material
} from './models.js'
import { TILE, WATER_LEVEL, CARGO } from './constants.js'
import { clamp, fbm, mulberry32 } from './utils.js'

const ROAD_COLOR = '#4c5053'
const ROAD_LINE = '#e0c15c'
const BALLAST_COLOR = '#756b5c'
const RAIL_COLOR = '#b5bec2'
const SLEEPER_COLOR = '#5d4530'

class MeshBuilder {
  constructor() {
    this.positions = []
    this.indices = []
  }
  quad(a, b, c, d) {
    const base = this.positions.length / 3
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  build() {
    if (!this.positions.length) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setIndex(this.indices)
    geometry.computeVertexNormals()
    return geometry
  }
}

function upQuad(builder, cx, cz, size, y) {
  const h = size / 2
  builder.quad(
    { x: cx - h, y, z: cz - h },
    { x: cx - h, y, z: cz + h },
    { x: cx + h, y, z: cz + h },
    { x: cx + h, y, z: cz - h }
  )
}

function ribbon(builder, ax, az, bx, bz, width, y1, y2, offset = 0) {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz) || 1
  const px = -dz / len
  const pz = dx / len
  const axx = ax + px * offset
  const azz = az + pz * offset
  const bxx = bx + px * offset
  const bzz = bz + pz * offset
  const hw = width / 2
  builder.quad(
    { x: axx - px * hw, y: y1, z: azz - pz * hw },
    { x: axx + px * hw, y: y1, z: azz + pz * hw },
    { x: bxx + px * hw, y: y2, z: bzz + pz * hw },
    { x: bxx - px * hw, y: y2, z: bzz - pz * hw }
  )
}

function crossQuad(builder, cx, cz, ux, uz, length, width, y) {
  const px = -uz
  const pz = ux
  const hl = length / 2
  const hw = width / 2
  const ax = cx - ux * hl
  const az = cz - uz * hl
  const bx = cx + ux * hl
  const bz = cz + uz * hl
  builder.quad(
    { x: ax - px * hw, y, z: az - pz * hw },
    { x: ax + px * hw, y, z: az + pz * hw },
    { x: bx + px * hw, y, z: bz + pz * hw },
    { x: bx - px * hw, y, z: bz - pz * hw }
  )
}

function makeCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

function facadeTexture() {
  return makeCanvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    for (let i = 0; i < size; i += 6) ctx.fillRect(0, i, size, 1)
    const rows = 2
    const cols = 3
    const w = size / (cols + 1)
    const h = size / (rows + 1)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = w * (c + 0.62)
        const y = h * (r + 0.42)
        ctx.fillStyle = '#5c7482'
        ctx.fillRect(x, y, w * 0.55, h * 0.45)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(x + 1, y + 1, w * 0.2, h * 0.16)
        ctx.strokeStyle = 'rgba(40,35,30,0.65)'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, w * 0.55, h * 0.45)
      }
    }
    ctx.fillStyle = '#7a5c3d'
    ctx.fillRect(size * 0.42, size * 0.74, size * 0.16, size * 0.26)
  })
}

function cloudTexture() {
  return makeCanvasTexture(128, (ctx, size) => {
    ctx.clearRect(0, 0, size, size)
    const blobs = [[0.35, 0.55, 0.25], [0.52, 0.45, 0.32], [0.68, 0.58, 0.23], [0.48, 0.62, 0.26]]
    for (const [x, y, r] of blobs) {
      const gradient = ctx.createRadialGradient(x * size, y * size, 2, x * size, y * size, r * size)
      gradient.addColorStop(0, 'rgba(255,255,255,0.92)')
      gradient.addColorStop(0.55, 'rgba(255,255,255,0.5)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }
  })
}

class SmokeSystem {
  constructor(scene, capacity = 520) {
    this.capacity = capacity
    this.particles = []
    this.emitters = []
    this.accumulators = []
    const geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(capacity * 3)
    this.sizes = new Float32Array(capacity)
    this.opacities = new Float32Array(capacity)
    this.colors = new Float32Array(capacity * 3)
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(this.opacities, 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry = geometry
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        attribute vec3 aColor;
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vOpacity = aOpacity;
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.08, d) * vOpacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `
    })
    this.points = new THREE.Points(geometry, mat)
    this.points.frustumCulled = false
    scene.add(this.points)
    this.rng = mulberry32(991)
  }
  addEmitter(position, options = {}) {
    const emitter = {
      position: position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z),
      rate: options.rate ?? 1,
      size: options.size ?? 1,
      color: new THREE.Color(options.color || '#d3d3ca'),
      spread: options.spread ?? 0.5,
      rise: options.rise ?? 1.1,
      accumulator: 0,
      active: options.active !== false
    }
    this.emitters.push(emitter)
    return emitter
  }
  emit(emitter) {
    if (this.particles.length >= this.capacity) this.particles.shift()
    const rng = this.rng
    this.particles.push({
      x: emitter.position.x + (rng() - 0.5) * emitter.spread,
      y: emitter.position.y + (rng() - 0.3) * emitter.spread * 0.5,
      z: emitter.position.z + (rng() - 0.5) * emitter.spread,
      vx: (rng() - 0.5) * 0.28,
      vy: emitter.rise * (0.65 + rng() * 0.6),
      vz: (rng() - 0.5) * 0.28,
      life: 0,
      maxLife: 2.4 + rng() * 3.0,
      size: emitter.size * (0.75 + rng() * 0.9),
      color: emitter.color
    })
  }
  update(dt) {
    for (const emitter of this.emitters) {
      if (!emitter.active) continue
      emitter.accumulator += emitter.rate * dt
      while (emitter.accumulator >= 1) {
        emitter.accumulator -= 1
        this.emit(emitter)
      }
    }
    let write = 0
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.life += dt
      if (p.life >= p.maxLife) continue
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.vy *= 0.997
      p.vx += Math.sin(p.life * 1.7 + p.z) * 0.02 * dt
      const t = p.life / p.maxLife
      this.positions[write * 3] = p.x
      this.positions[write * 3 + 1] = p.y
      this.positions[write * 3 + 2] = p.z
      this.sizes[write] = p.size * (1 + t * 1.8)
      this.opacities[write] = (1 - t) * 0.32 * Math.min(1, p.life * 3)
      this.colors[write * 3] = p.color.r
      this.colors[write * 3 + 1] = p.color.g
      this.colors[write * 3 + 2] = p.color.b
      this.particles[write] = p
      write++
    }
    this.particles.length = write
    this.geometry.setDrawRange(0, write)
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.aSize.needsUpdate = true
    this.geometry.attributes.aOpacity.needsUpdate = true
    this.geometry.attributes.aColor.needsUpdate = true
  }
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas
    this.world = world
    this.started = false
    this.tour = true
    this.clockTime = 0
    this.selected = null
    this.hover = null
    this.vehicleVisuals = new Map()
    this.trackedEmitters = new Map()
    this.rng = mulberry32(777)
    this.keys = new Set()
    this.cameraTarget = new THREE.Vector3(world.worldX(world.towns[0]?.x ?? 40), 0, world.worldZ(world.towns[0]?.y ?? 40))
    this.cameraTarget.y = this.groundHeight(this.cameraTarget.x, this.cameraTarget.z)
    this.desiredTarget = this.cameraTarget.clone()
    this.yaw = Math.PI * 0.74
    this.pitch = 0.72
    this.distance = 108
    this.desiredYaw = this.yaw
    this.desiredPitch = this.pitch
    this.desiredDistance = this.distance
    this.drag = null
    this.cameraDraggedDistance = 0

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0xbcd0cc, 230, 850)
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.5, 2600)
    this.webgl = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    })
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    this.webgl.setSize(window.innerWidth, window.innerHeight, false)
    this.webgl.outputColorSpace = THREE.SRGBColorSpace
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping
    this.webgl.toneMappingExposure = 1.08
    this.webgl.shadowMap.enabled = true
    this.webgl.shadowMap.type = THREE.PCFShadowMap

    this.raycaster = new THREE.Raycaster()
    this.waterUniforms = {}
    this.animatedIndustries = []

    this.buildLights()
    this.buildSky()
    this.buildTerrain()
    this.buildWater()
    this.buildClouds()
    this.buildHouses()
    this.buildTrees()
    this.buildRocks()
    this.buildIndustries()
    this.buildStations()
    this.buildNetworkMeshes()
    this.buildOverlays()
    this.smoke = new SmokeSystem(this.scene)
    this.addIndustrySmoke()
    this.buildSelection()
    this.updateCamera(0, true)
    this.attachInput()
    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    this.webgl.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xc2dcf0, 0x4b4133, 1.05)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.45)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -125
    sun.shadow.camera.right = 125
    sun.shadow.camera.top = 125
    sun.shadow.camera.bottom = -125
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 420
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.035
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun
    const fill = new THREE.DirectionalLight(0x9fc8e0, 0.32)
    fill.position.set(-120, 70, -140)
    this.scene.add(fill)
  }

  buildSky() {
    const uniforms = {
      uHorizon: { value: new THREE.Color('#e6d9c2') },
      uMid: { value: new THREE.Color('#7fb8d4') },
      uZenith: { value: new THREE.Color('#4d86b8') },
      uSunDir: { value: new THREE.Vector3(0.52, 0.64, 0.42).normalize() },
      uSunColor: { value: new THREE.Color('#ffe9bf') }
    }
    this.skyUniforms = uniforms
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uHorizon;
        uniform vec3 uMid;
        uniform vec3 uZenith;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y * 1.15 + 0.08, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.35, h));
          col = mix(col, uZenith, smoothstep(0.3, 0.9, h));
          float sun = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sun, 380.0) * 2.6;
          col += uSunColor * pow(sun, 18.0) * 0.18;
          float haze = smoothstep(0.28, 0.0, abs(dir.y));
          col = mix(col, vec3(0.88, 0.86, 0.78), haze * 0.28);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), skyMat)
    this.sky.frustumCulled = false
    this.scene.add(this.sky)
  }

  buildClouds() {
    const texture = cloudTexture()
    const group = new THREE.Group()
    this.clouds = []
    const rng = mulberry32(452)
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texture, transparent: true, opacity: 0.35 + rng() * 0.3,
        depthWrite: false, fog: false, color: new THREE.Color().setHSL(0.58, 0.1, 0.92 + rng() * 0.06)
      })
      const sprite = new THREE.Sprite(mat)
      const scale = 55 + rng() * 120
      sprite.scale.set(scale, scale * (0.35 + rng() * 0.2), 1)
      sprite.position.set((rng() - 0.5) * 1000, 95 + rng() * 95, (rng() - 0.5) * 1000)
      sprite.userData.speed = 0.6 + rng() * 1.2
      group.add(sprite)
      this.clouds.push(sprite)
    }
    this.scene.add(group)
    this.cloudGroup = group
  }

  groundHeight(wx, wz) {
    const tile = this.world.tileFromWorld(wx, wz)
    if (!this.world.inBounds(tile.x, tile.y)) return 0
    return this.world.tileHeight(tile.x, tile.y)
  }

  buildTerrain() {
    const world = this.world
    const n = world.size
    const positions = []
    const colors = []
    const color = new THREE.Color()
    const grassA = new THREE.Color('#6f9b4f')
    const grassB = new THREE.Color('#4d7b45')
    const grassC = new THREE.Color('#839d55')
    const sand = new THREE.Color('#c9b987')
    const deep = new THREE.Color('#6b7259')
    const rock = new THREE.Color('#7d7b6b')
    const rockDark = new THREE.Color('#66655c')

    const addVertex = (gx, gy, c) => {
      positions.push((gx - n / 2) * TILE, world.vertexHeight(gx, gy), (gy - n / 2) * TILE)
      colors.push(c.r, c.g, c.b)
    }
    const faceColor = (gx, gy, ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const h = (ay + by + cy) / 3
      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = cx - ax, vy = cy - ay, vz = cz - az
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      const nl = Math.hypot(nx, ny, nz) || 1
      const slope = 1 - Math.abs(ny / nl)
      const noise = fbm(gx * 0.11 + 3, gy * 0.11 + 8, world.seed + 51, 2)
      if (h < WATER_LEVEL - 0.02) color.copy(deep).lerp(sand, 0.25 + noise * 0.25)
      else if (h < WATER_LEVEL + 0.5) color.copy(sand)
      else {
        color.copy(grassA).lerp(grassB, noise)
        color.lerp(grassC, Math.max(0, noise - 0.55) * 0.9)
        if (h > 5.6) color.lerp(rock, clamp((h - 5.6) / 3.2, 0, 0.75))
      }
      if (slope > 0.32) color.lerp(rock, clamp((slope - 0.32) * 2.4, 0, 0.8))
      if (slope > 0.62) color.lerp(rockDark, 0.3)
      const shade = 0.92 + noise * 0.16
      color.multiplyScalar(shade)
      return color
    }

    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        const x0 = gx, x1 = gx + 1
        const y0 = gy, y1 = gy + 1
        const ax = (x0 - n / 2) * TILE, az = (y0 - n / 2) * TILE
        const bx = (x1 - n / 2) * TILE, bz = (y0 - n / 2) * TILE
        const cx = (x1 - n / 2) * TILE, cz = (y1 - n / 2) * TILE
        const dx = (x0 - n / 2) * TILE, dz = (y1 - n / 2) * TILE
        const ay = world.vertexHeight(x0, y0)
        const by = world.vertexHeight(x1, y0)
        const cy = world.vertexHeight(x1, y1)
        const dy = world.vertexHeight(x0, y1)
        const c1 = faceColor(gx, gy, ax, ay, az, bx, by, bz, cx, cy, cz).clone()
        const c2 = faceColor(gx, gy, ax, ay, az, cx, cy, cz, dx, dy, dz).clone()
        addVertex(x0, y0, c1)
        addVertex(x1, y1, c1)
        addVertex(x1, y0, c1)
        addVertex(x0, y0, c2)
        addVertex(x0, y1, c2)
        addVertex(x1, y1, c2)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
      flatShading: true
    })
    this.terrain = new THREE.Mesh(geometry, mat)
    this.terrain.receiveShadow = true
    this.terrain.name = 'terrain'
    this.scene.add(this.terrain)
  }

  buildWater() {
    const geometry = new THREE.PlaneGeometry(1600, 1600, 130, 130)
    geometry.rotateX(-Math.PI / 2)
    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#1e5968') },
      uShallow: { value: new THREE.Color('#4ca0a8') },
      uSky: { value: new THREE.Color('#b8dbe4') },
      uSunDir: { value: new THREE.Vector3(0.52, 0.64, 0.42).normalize() },
      uFogColor: { value: new THREE.Color(0xbcd0cc) },
      uFogNear: { value: 230 },
      uFogFar: { value: 850 }
    }
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      uniforms: this.waterUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        void main() {
          vec3 p = position;
          float w1 = sin(p.x * 0.075 + uTime * 1.05) * 0.075;
          float w2 = sin(p.z * 0.11 - uTime * 0.82) * 0.06;
          float w3 = sin((p.x + p.z) * 0.16 + uTime * 1.4) * 0.035;
          p.y += w1 + w2 + w3;
          float dx = cos(p.x * 0.075 + uTime * 1.05) * 0.075 * 0.075;
          float dz = cos(p.z * 0.11 - uTime * 0.82) * 0.11 * 0.06;
          vNormalW = normalize(vec3(-dx, 1.0, -dz));
          vec4 world = modelMatrix * vec4(p, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSky;
        uniform vec3 uSunDir;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorld);
          vec3 n = normalize(vNormalW);
          float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
          vec3 col = mix(uDeep, uShallow, clamp(n.y * 0.5 + 0.35, 0.0, 1.0));
          col = mix(col, uSky, fresnel * 0.55);
          vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
          float spec = pow(max(dot(n, halfVec), 0.0), 90.0);
          col += vec3(1.0, 0.92, 0.72) * spec * 1.8;
          float glint = sin(vWorld.x * 0.55 + uTime * 2.3) * sin(vWorld.z * 0.5 - uTime * 1.7);
          col += vec3(0.12, 0.18, 0.18) * smoothstep(0.86, 1.0, glint) * 0.5;
          float dist = length(cameraPosition - vWorld);
          float fog = smoothstep(uFogNear, uFogFar, dist);
          col = mix(col, uFogColor, fog);
          gl_FragColor = vec4(col, mix(0.93, 1.0, fresnel));
        }
      `
    })
    this.water = new THREE.Mesh(geometry, mat)
    this.water.position.y = WATER_LEVEL + 0.02
    this.water.receiveShadow = false
    this.scene.add(this.water)
  }

  buildHouses() {
    const facade = facadeTexture()
    const wallGeo = new THREE.BoxGeometry(1, 1, 1)
    wallGeo.translate(0, 0.5, 0)
    this.wallMaterial = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.86, metalness: 0.01 })
    this.roofMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 })
    this.chimneyMaterial = new THREE.MeshStandardMaterial({ color: '#7d6b5d', roughness: 0.95 })
    const capacity = 1600
    this.wallInstances = new THREE.InstancedMesh(wallGeo, this.wallMaterial, capacity)
    this.roofInstances = new THREE.InstancedMesh(getGableRoofGeometry(), this.roofMaterial, capacity)
    const chimneyGeo = new THREE.BoxGeometry(1, 1, 1)
    chimneyGeo.translate(0, 0.5, 0)
    this.chimneyInstances = new THREE.InstancedMesh(chimneyGeo, this.chimneyMaterial, capacity)
    for (const inst of [this.wallInstances, this.roofInstances, this.chimneyInstances]) {
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      inst.castShadow = true
      inst.receiveShadow = true
      inst.frustumCulled = false
      this.scene.add(inst)
    }
    this.wallInstances.instanceColor = null
    this.landmarkVisuals = new Map()
    this.rebuildHouses()
  }

  rebuildHouses() {
    const normal = this.world.houses.filter(h => !h.landmark)
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    let ci = 0
    const chimneySlots = []
    for (const house of normal) {
      const pos = this.world.tileCenter(house.x, house.y)
      const roofH = 0.75 + house.w * 0.16
      dummy.position.set(pos.x, pos.y, pos.z)
      dummy.rotation.set(0, house.rot, 0)
      dummy.scale.set(house.w, house.h, house.d)
      dummy.updateMatrix()
      this.wallInstances.setMatrixAt(ci, dummy.matrix)
      this.wallInstances.setColorAt(ci, color.set(house.wall))
      dummy.position.set(pos.x, pos.y + house.h, pos.z)
      dummy.scale.set(house.w * 1.12, roofH, house.d * 1.12)
      dummy.updateMatrix()
      this.roofInstances.setMatrixAt(ci, dummy.matrix)
      this.roofInstances.setColorAt(ci, color.set(house.roof))
      if (ci % 3 !== 1) chimneySlots.push({ house, pos, roofH })
      ci++
    }
    this.wallInstances.count = ci
    this.roofInstances.count = ci
    this.wallInstances.instanceMatrix.needsUpdate = true
    this.roofInstances.instanceMatrix.needsUpdate = true
    if (this.wallInstances.instanceColor) this.wallInstances.instanceColor.needsUpdate = true
    if (this.roofInstances.instanceColor) this.roofInstances.instanceColor.needsUpdate = true

    let ch = 0
    for (const { house, pos, roofH } of chimneySlots) {
      const ox = Math.cos(house.rot) * house.w * 0.26 + Math.sin(house.rot) * house.d * 0.2
      const oz = -Math.sin(house.rot) * house.w * 0.26 + Math.cos(house.rot) * house.d * 0.2
      dummy.position.set(pos.x + ox, pos.y + house.h + roofH * 0.55, pos.z + oz)
      dummy.rotation.set(0, house.rot, 0)
      dummy.scale.set(0.3, 1.0, 0.3)
      dummy.updateMatrix()
      this.chimneyInstances.setMatrixAt(ch, dummy.matrix)
      ch++
    }
    this.chimneyInstances.count = ch
    this.chimneyInstances.instanceMatrix.needsUpdate = true

    const landmarks = this.world.houses.filter(h => h.landmark)
    for (const house of landmarks) {
      if (this.landmarkVisuals.has(house.id)) continue
      const pos = this.world.tileCenter(house.x, house.y)
      const group = createLandmark(house)
      group.position.set(pos.x, pos.y, pos.z)
      group.rotation.y = house.rot
      group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      this.scene.add(group)
      this.landmarkVisuals.set(house.id, group)
    }
  }

  buildTrees() {
    const geometries = createTreeGeometries()
    const capacity = Math.max(80, this.world.trees.length + 80)
    this.treeCapacity = capacity
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6e4d33', roughness: 0.95 })
    this.coniferMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 })
    this.broadleafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 })
    this.trunkInstances = new THREE.InstancedMesh(geometries.trunk, trunkMat, capacity)
    this.coniferInstances = new THREE.InstancedMesh(geometries.conifer, this.coniferMat, capacity)
    this.broadleafInstances = new THREE.InstancedMesh(geometries.broadleaf, this.broadleafMat, capacity)
    for (const inst of [this.trunkInstances, this.coniferInstances, this.broadleafInstances]) {
      inst.castShadow = true
      inst.receiveShadow = true
      inst.frustumCulled = false
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.scene.add(inst)
    }
    this.rebuildTrees()
  }

  rebuildTrees() {
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    let trunkCount = 0
    let coniferCount = 0
    let broadleafCount = 0
    for (const tree of this.world.trees) {
      if (trunkCount >= this.treeCapacity) break
      const pos = this.world.tileCenter(tree.x, tree.y)
      const s = tree.scale
      dummy.position.set(pos.x, pos.y, pos.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.set(s * 0.85, s, s * 0.85)
      dummy.updateMatrix()
      this.trunkInstances.setMatrixAt(trunkCount++, dummy.matrix)
      const tint = 0.82 + tree.hue * 0.35
      if (tree.kind === 'conifer') {
        dummy.scale.set(s * 1.05, s * (1.05 + tree.hue * 0.35), s * 1.05)
        dummy.updateMatrix()
        this.coniferInstances.setMatrixAt(coniferCount, dummy.matrix)
        this.coniferInstances.setColorAt(coniferCount, color.setHSL(0.31 + tree.hue * 0.05, 0.34, 0.24 + tint * 0.08))
        coniferCount++
      } else {
        dummy.scale.set(s * 1.1, s * (1.0 + tree.hue * 0.3), s * 1.1)
        dummy.updateMatrix()
        this.broadleafInstances.setMatrixAt(broadleafCount, dummy.matrix)
        this.broadleafInstances.setColorAt(broadleafCount, color.setHSL(0.25 + tree.hue * 0.1, 0.4, 0.3 + tint * 0.08))
        broadleafCount++
      }
    }
    this.trunkInstances.count = trunkCount
    this.coniferInstances.count = coniferCount
    this.broadleafInstances.count = broadleafCount
    this.trunkInstances.instanceMatrix.needsUpdate = true
    this.coniferInstances.instanceMatrix.needsUpdate = true
    this.broadleafInstances.instanceMatrix.needsUpdate = true
    if (this.coniferInstances.instanceColor) this.coniferInstances.instanceColor.needsUpdate = true
    if (this.broadleafInstances.instanceColor) this.broadleafInstances.instanceColor.needsUpdate = true
  }

  buildRocks() {
    const geo = createRockGeometry()
    const mat = new THREE.MeshStandardMaterial({ color: '#8a887b', roughness: 1, flatShading: true })
    const capacity = 160
    this.rockInstances = new THREE.InstancedMesh(geo, mat, capacity)
    this.rockInstances.castShadow = true
    this.rockInstances.receiveShadow = true
    this.rockInstances.frustumCulled = false
    this.scene.add(this.rockInstances)
    const dummy = new THREE.Object3D()
    const rng = mulberry32(831)
    let count = 0
    let tries = 0
    while (count < capacity && tries++ < 3000) {
      const x = 2 + Math.floor(rng() * (this.world.size - 4))
      const y = 2 + Math.floor(rng() * (this.world.size - 4))
      const tile = this.world.getTile(x, y)
      if (!tile || tile.type !== 'empty' || this.world.isWater(x, y)) continue
      const pos = this.world.tileCenter(x, y)
      dummy.position.set(pos.x + (rng() - 0.5) * 2, pos.y + 0.15, pos.z + (rng() - 0.5) * 2)
      dummy.rotation.set(rng() * 2, rng() * 6, rng() * 2)
      const s = 0.35 + rng() * 0.9
      dummy.scale.set(s, s * (0.6 + rng() * 0.4), s)
      dummy.updateMatrix()
      this.rockInstances.setMatrixAt(count++, dummy.matrix)
    }
    this.rockInstances.count = count
    this.rockInstances.instanceMatrix.needsUpdate = true
  }

  buildIndustries() {
    this.industryVisuals = new Map()
    for (const industry of this.world.industries) {
      const group = createIndustry(industry)
      const p = this.world.tileCenter(industry.cx - 0.5, industry.cy - 0.5)
      group.position.set(p.x, p.y, p.z)
      group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      this.scene.add(group)
      this.industryVisuals.set(industry.id, group)
      if (group.userData.animations) this.animatedIndustries.push(group)
    }
  }

  addIndustrySmoke() {
    for (const industry of this.world.industries) {
      const group = this.industryVisuals.get(industry.id)
      if (!group || !group.userData.smoke) continue
      for (const emitter of group.userData.smoke) {
        const world = new THREE.Vector3(emitter.x, emitter.y, emitter.z).add(group.position)
        this.smoke.addEmitter(world, {
          rate: emitter.rate, size: emitter.size, color: emitter.color, spread: 1.1, rise: 1.1
        })
      }
    }
  }

  buildStations() {
    this.stationVisuals = new Map()
    for (const station of this.world.stations) this.addStation(station)
  }

  addStation(station) {
    if (this.stationVisuals.has(station.id)) return
    const group = createStationModel(station, this.world)
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    this.scene.add(group)
    this.stationVisuals.set(station.id, group)
  }

  removeStation(station) {
    const group = this.stationVisuals.get(station.id)
    if (group) {
      this.scene.remove(group)
      this.stationVisuals.delete(station.id)
    }
  }

  buildNetworkMeshes() {
    if (this.roadMesh) { this.scene.remove(this.roadMesh); this.roadMesh.geometry.dispose() }
    if (this.roadLineMesh) { this.scene.remove(this.roadLineMesh); this.roadLineMesh.geometry.dispose() }
    if (this.ballastMesh) { this.scene.remove(this.ballastMesh); this.ballastMesh.geometry.dispose() }
    if (this.railMesh) { this.scene.remove(this.railMesh); this.railMesh.geometry.dispose() }
    if (this.sleeperMesh) { this.scene.remove(this.sleeperMesh); this.sleeperMesh.geometry.dispose() }

    const road = new MeshBuilder()
    const lines = new MeshBuilder()
    const ballast = new MeshBuilder()
    const rails = new MeshBuilder()
    const sleepers = new MeshBuilder()
    const world = this.world
    const n = world.size
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const tile = world.getTile(x, y)
        if (!tile) continue
        const cx = world.worldX(x)
        const cz = world.worldZ(y)
        const ch = world.tileHeight(x, y)
        if (tile.road > 0) {
          upQuad(road, cx, cz, 2.9, ch + 0.13)
          for (const bit of [2, 4]) {
            if (!(tile.road & bit)) continue
            const nx = x + (bit === 2 ? 1 : 0)
            const ny = y + (bit === 4 ? 1 : 0)
            if (!world.inBounds(nx, ny)) continue
            const neighbor = world.getTile(nx, ny)
            if (!neighbor || neighbor.road === 0) continue
            const wx = world.worldX(nx)
            const wz = world.worldZ(ny)
            const nh = world.tileHeight(nx, ny)
            ribbon(road, cx, cz, wx, wz, 2.15, ch + 0.14, nh + 0.14)
            const dx = wx - cx
            const dz = wz - cz
            const len = Math.hypot(dx, dz) || 1
            const ux = dx / len
            const uz = dz / len
            for (let d = 0; d < 2; d++) {
              const start = 0.7 + d * 1.7
              const px = cx + ux * start
              const pz = cz + uz * start
              const y1 = ch + 0.155 + (nh - ch) * (start / len)
              const y2 = ch + 0.155 + (nh - ch) * ((start + 0.85) / len)
              const axx = px - uz * 0.09
              const azz = pz + ux * 0.09
              const bxx = px + uz * 0.09
              const bzz = pz - ux * 0.09
              const cxx = px + ux * 0.85 - uz * 0.09
              const czz = pz + uz * 0.85 + ux * 0.09
              const dxx = px + ux * 0.85 + uz * 0.09
              const dzz = pz + uz * 0.85 - ux * 0.09
              lines.quad(
                { x: axx, y: y1, z: azz },
                { x: bxx, y: y1, z: bzz },
                { x: cxx, y: y2, z: czz },
                { x: dxx, y: y2, z: dzz }
              )
            }
          }
        }
        if (tile.rail > 0) {
          upQuad(ballast, cx, cz, 3.0, ch + 0.09)
          for (const bit of [2, 4]) {
            if (!(tile.rail & bit)) continue
            const nx = x + (bit === 2 ? 1 : 0)
            const ny = y + (bit === 4 ? 1 : 0)
            if (!world.inBounds(nx, ny)) continue
            const neighbor = world.getTile(nx, ny)
            if (!neighbor || neighbor.rail === 0) continue
            const wx = world.worldX(nx)
            const wz = world.worldZ(ny)
            const nh = world.tileHeight(nx, ny)
            const dx = wx - cx
            const dz = wz - cz
            const len = Math.hypot(dx, dz) || 1
            const ux = dx / len
            const uz = dz / len
            ribbon(ballast, cx, cz, wx, wz, 2.7, ch + 0.1, nh + 0.1)
            for (const offset of [-0.62, 0.62]) {
              ribbon(rails, cx, cz, wx, wz, 0.17, ch + 0.24, nh + 0.24, offset)
            }
            const count = 4
            for (let s = 0; s < count; s++) {
              const t = (s + 0.5) / count
              const px = cx + dx * t
              const pz = cz + dz * t
              const py = ch + (nh - ch) * t
              crossQuad(sleepers, px, pz, ux, uz, 0.36, 2.15, py + 0.19)
            }
          }
        }
      }
    }
    const addMesh = (builder, mat, receive = true, cast = false) => {
      const geo = builder.build()
      if (!geo) return null
      const mesh = new THREE.Mesh(geo, mat)
      mesh.receiveShadow = receive
      mesh.castShadow = cast
      this.scene.add(mesh)
      return mesh
    }
    this.roadMesh = addMesh(road, new THREE.MeshStandardMaterial({ color: ROAD_COLOR, roughness: 0.96 }), true, false)
    this.roadLineMesh = addMesh(lines, new THREE.MeshStandardMaterial({ color: ROAD_LINE, roughness: 0.7, emissive: '#5e4d1a', emissiveIntensity: 0.18 }), false, false)
    this.ballastMesh = addMesh(ballast, new THREE.MeshStandardMaterial({ color: BALLAST_COLOR, roughness: 1 }), true, false)
    this.railMesh = addMesh(rails, new THREE.MeshStandardMaterial({ color: RAIL_COLOR, roughness: 0.32, metalness: 0.65 }), true, true)
    this.sleeperMesh = addMesh(sleepers, new THREE.MeshStandardMaterial({ color: SLEEPER_COLOR, roughness: 0.95 }), true, false)
  }

  buildOverlays() {
    const geo = new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94)
    geo.rotateX(-Math.PI / 2)
    this.overlayMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    this.previewInstances = new THREE.InstancedMesh(geo, this.overlayMaterial, 600)
    this.previewInstances.count = 0
    this.previewInstances.frustumCulled = false
    this.previewInstances.renderOrder = 5
    this.scene.add(this.previewInstances)
    this.hoverInstances = new THREE.InstancedMesh(geo.clone(), new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide
    }), 40)
    this.hoverInstances.count = 0
    this.hoverInstances.frustumCulled = false
    this.hoverInstances.renderOrder = 6
    this.scene.add(this.hoverInstances)
    this.dummy = new THREE.Object3D()
    this.overlayColor = new THREE.Color()
  }

  buildSelection() {
    const ringGeo = new THREE.RingGeometry(0.9, 1.25, 40)
    ringGeo.rotateX(-Math.PI / 2)
    this.selectionRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: '#7fffd4', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide
    }))
    this.selectionRing.visible = false
    this.selectionRing.renderOrder = 7
    this.scene.add(this.selectionRing)
    this.routeGroup = new THREE.Group()
    this.scene.add(this.routeGroup)
    this.highlightGroup = new THREE.Group()
    this.scene.add(this.highlightGroup)
    this.highlightRings = []
  }

  setStationHighlights(stations, color = '#7fd1ff') {
    for (const highlight of this.highlightRings) {
      this.highlightGroup.remove(highlight.group)
      highlight.group.traverse(object => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) object.material.dispose()
      })
    }
    this.highlightRings = []
    if (!stations) return
    for (const station of stations) {
      const p = this.world.tileCenter(station.center.x, station.center.y)
      const group = new THREE.Group()
      group.position.set(p.x, p.y + 0.45, p.z)

      const ringGeometry = new THREE.RingGeometry(1.0, 1.28, 44)
      ringGeometry.rotateX(-Math.PI / 2)
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.86, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending
      }))
      ring.position.y = 0.1
      ring.renderOrder = 9
      group.add(ring)

      const beamGeometry = new THREE.CylinderGeometry(0.1, 0.34, 6.2, 10, 1, true)
      const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      }))
      beam.position.y = 3.2
      beam.renderOrder = 8
      group.add(beam)

      const crystalGeometry = new THREE.OctahedronGeometry(0.52, 0)
      const crystal = new THREE.Mesh(crystalGeometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending
      }))
      crystal.position.y = 6.2
      crystal.renderOrder = 10
      group.add(crystal)

      this.highlightGroup.add(group)
      this.highlightRings.push({ group, ring, beam, crystal })
    }
  }

  setOverlayTiles(instances, tiles, valid = true) {
    const dummy = this.dummy
    const color = this.overlayColor
    if (!tiles || !tiles.length) {
      instances.count = 0
      return
    }
    const limit = Math.min(tiles.length, instances.instanceMatrix.count)
    for (let i = 0; i < limit; i++) {
      const t = tiles[i]
      const p = this.world.tileCenter(t.x, t.y)
      dummy.position.set(p.x, p.y + 0.32, p.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      instances.setMatrixAt(i, dummy.matrix)
      color.set(valid ? '#5ff2b0' : '#ff6b5e')
      instances.setColorAt(i, color)
    }
    instances.count = limit
    instances.instanceMatrix.needsUpdate = true
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true
  }

  setHover(tile, footprint = 1, valid = true) {
    if (!tile) {
      this.hoverInstances.count = 0
      this.hover = null
      return
    }
    const tiles = []
    if (Array.isArray(footprint)) {
      for (const t of footprint) tiles.push(t)
    } else {
      for (let yy = tile.y; yy < tile.y + footprint; yy++) {
        for (let xx = tile.x; xx < tile.x + footprint; xx++) tiles.push({ x: xx, y: yy })
      }
    }
    this.hover = { tile, valid }
    this.setOverlayTiles(this.hoverInstances, tiles, valid)
  }

  setPreview(tiles, valid = true) {
    this.setOverlayTiles(this.previewInstances, tiles, valid)
  }

  clearPreview() {
    this.previewInstances.count = 0
  }

  setSelection(selection) {
    this.selected = selection
    if (!selection) {
      this.selectionRing.visible = false
      this.clearRoutes()
    }
  }

  showRoutes(segments) {
    this.clearRoutes()
    if (!segments || !segments.length) return
    for (const segment of segments) {
      const points = segment.points.map(p => new THREE.Vector3(p.x, p.y + 0.35, p.z))
      if (points.length < 2) continue
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineDashedMaterial({
        color: segment.color || '#7fffd4',
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        dashSize: 2.1,
        gapSize: 1.25
      })
      const line = new THREE.Line(geometry, mat)
      line.computeLineDistances()
      line.renderOrder = 6
      this.routeGroup.add(line)
    }
  }

  clearRoutes() {
    for (const child of [...this.routeGroup.children]) {
      this.routeGroup.remove(child)
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    }
  }

  addVehicle(vehicle) {
    if (this.vehicleVisuals.has(vehicle.id)) return
    const visual = createVehicleVisual(vehicle)
    for (const group of visual.carGroups) this.scene.add(group)
    visual.type = vehicle.type
    visual.vehicleId = vehicle.id
    this.vehicleVisuals.set(vehicle.id, visual)
  }

  removeVehicle(vehicle) {
    const visual = this.vehicleVisuals.get(vehicle.id)
    if (!visual) return
    for (const group of visual.carGroups) this.scene.remove(group)
    this.vehicleVisuals.delete(vehicle.id)
    const emitter = this.trackedEmitters.get(vehicle.id)
    if (emitter) {
      emitter.active = false
      this.trackedEmitters.delete(vehicle.id)
    }
  }

  syncVehicle(vehicle) {
    const visual = this.vehicleVisuals.get(vehicle.id)
    if (!visual) return
    if (vehicle.type === 'train') {
      const poses = vehicle.carPoses || []
      for (let i = 0; i < visual.carGroups.length; i++) {
        const group = visual.carGroups[i]
        const pose = poses[i] || poses[poses.length - 1]
        if (!pose) continue
        group.position.set(pose.x, pose.y, pose.z)
        group.rotation.set(pose.pitch || 0, pose.yaw || 0, 0, 'YXZ')
      }
    } else {
      const pose = vehicle.pose
      const group = visual.carGroups[0]
      if (!pose) return
      group.position.set(pose.x, pose.y + (vehicle.type === 'ship' ? Math.sin(this.clockTime * 1.4 + vehicle.id.length) * 0.08 : 0), pose.z)
      group.rotation.set(pose.pitch || 0, pose.yaw || 0, 0, 'YXZ')
      if (vehicle.type === 'plane' && group.userData.props) {
        for (const prop of group.userData.props) prop.rotation.z += 0.9
      }
      if (vehicle.type === 'ship' && group.userData.wake) {
        group.userData.wake.material.opacity = 0.12 + Math.sin(this.clockTime * 2 + vehicle.id.length) * 0.04
      }
    }
    if (vehicle.type === 'train') {
      let emitter = this.trackedEmitters.get(vehicle.id)
      if (!emitter) {
        emitter = this.smoke.addEmitter(new THREE.Vector3(0, 0, 0), { rate: 2.2, size: 0.55, color: '#d8d5cb', spread: 0.35, rise: 0.8 })
        this.trackedEmitters.set(vehicle.id, emitter)
      }
      const pose = vehicle.carPoses?.[0]
      if (pose) {
        emitter.position.set(pose.x, pose.y + 2.5, pose.z)
        emitter.active = vehicle.state === 'moving' || vehicle.state === 'departing'
      }
    }
  }

  setStarterView() {
    const stops = this.world.stations.filter(s => s.kind === 'bus')
    if (stops.length >= 2) {
      const a = this.world.tileCenter(stops[0].center.x, stops[0].center.y)
      const b = this.world.tileCenter(stops[1].center.x, stops[1].center.y)
      const x = (a.x + b.x) * 0.5
      const z = (a.z + b.z) * 0.5
      this.desiredTarget.set(x, this.groundHeight(x, z), z)
      this.desiredYaw = Math.PI * 0.5 - 0.16
      this.desiredPitch = 0.72
      this.desiredDistance = 138
    } else {
      const town = this.world.towns[0]
      if (town) this.focusTile(town.x, town.y, 104)
    }
    this.started = true
    this.tour = false
  }

  focusTile(x, y, distance = 90) {
    const p = this.world.tileCenter(x, y)
    this.desiredTarget.set(p.x, p.y, p.z)
    this.desiredDistance = distance
  }

  setTour(enabled) {
    this.tour = enabled
  }

  pickTile(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera)
    const hits = this.raycaster.intersectObject(this.terrain, false)
    let point = hits[0]?.point
    if (!point) {
      const ray = this.raycaster.ray
      if (Math.abs(ray.direction.y) > 0.0001) {
        const t = (WATER_LEVEL - ray.origin.y) / ray.direction.y
        if (t > 0) point = ray.origin.clone().addScaledVector(ray.direction, t)
      }
    }
    if (!point) return null
    const tile = this.world.tileFromWorld(point.x, point.z)
    if (!this.world.inBounds(tile.x, tile.y)) return null
    return { x: tile.x, y: tile.y, point }
  }

  attachInput() {
    const canvas = this.canvas
    canvas.addEventListener('contextmenu', e => e.preventDefault())
    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      this.desiredDistance = clamp(this.desiredDistance * Math.exp(e.deltaY * 0.0011), 28, 260)
    }, { passive: false })

    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 1 && e.button !== 2) return
      e.preventDefault()
      this.drag = {
        pointerId: e.pointerId,
        mode: e.button === 1 ? 'rotate' : 'pan',
        x: e.clientX,
        y: e.clientY,
        moved: 0
      }
      this.cameraDraggedDistance = 0
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', e => {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return
      const dx = e.clientX - this.drag.x
      const dy = e.clientY - this.drag.y
      this.drag.x = e.clientX
      this.drag.y = e.clientY
      this.cameraDraggedDistance += Math.abs(dx) + Math.abs(dy)
      if (this.drag.mode === 'rotate') {
        this.desiredYaw -= dx * 0.006
        this.desiredPitch = clamp(this.desiredPitch + dy * 0.0045, 0.3, 1.33)
      } else {
        const scale = (this.desiredDistance * 1.4) / window.innerHeight
        const right = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
        const forward = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw))
        this.desiredTarget.addScaledVector(right, -dx * scale)
        this.desiredTarget.addScaledVector(forward, dy * scale)
        this.clampTarget()
      }
    })
    const endDrag = e => {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return
      this.drag = null
      try { canvas.releasePointerCapture(e.pointerId) } catch {}
    }
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)

    const isTyping = target => target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    window.addEventListener('keydown', e => {
      if (isTyping(e.target)) return
      this.keys.add(e.code)
    })
    window.addEventListener('keyup', e => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
  }

  clampTarget() {
    const limit = this.world.size * TILE * 0.5 - 3
    this.desiredTarget.x = clamp(this.desiredTarget.x, -limit, limit)
    this.desiredTarget.z = clamp(this.desiredTarget.z, -limit, limit)
    this.desiredTarget.y = clamp(this.groundHeight(this.desiredTarget.x, this.desiredTarget.z), -1, 10)
  }

  updateCamera(dt, snap = false) {
    if (this.tour) {
      this.desiredYaw += dt * 0.045
    }
    const keys = this.keys
    const speed = (this.desiredDistance * 0.6 + 12) * dt
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(-Math.sin(this.yaw + Math.PI / 2), 0, -Math.cos(this.yaw + Math.PI / 2))
    if (keys.has('KeyW') || keys.has('ArrowUp')) this.desiredTarget.addScaledVector(forward, speed)
    if (keys.has('KeyS') || keys.has('ArrowDown')) this.desiredTarget.addScaledVector(forward, -speed)
    if (keys.has('KeyA') || keys.has('ArrowLeft')) this.desiredTarget.addScaledVector(right, -speed)
    if (keys.has('KeyD') || keys.has('ArrowRight')) this.desiredTarget.addScaledVector(right, speed)
    if (keys.has('KeyQ')) this.desiredYaw += dt * 1.1
    if (keys.has('KeyE')) this.desiredYaw -= dt * 1.1
    if (keys.has('KeyZ')) this.desiredPitch = clamp(this.desiredPitch + dt * 0.7, 0.3, 1.33)
    if (keys.has('KeyX')) this.desiredPitch = clamp(this.desiredPitch - dt * 0.7, 0.3, 1.33)
    if (keys.has('Equal') || keys.has('NumpadAdd')) this.desiredDistance = clamp(this.desiredDistance * (1 - dt * 1.8), 28, 260)
    if (keys.has('Minus') || keys.has('NumpadSubtract')) this.desiredDistance = clamp(this.desiredDistance * (1 + dt * 1.8), 28, 260)
    this.clampTarget()
    const lerpSpeed = snap ? 1 : Math.min(1, dt * 8)
    this.cameraTarget.lerp(this.desiredTarget, lerpSpeed)
    this.yaw += (this.desiredYaw - this.yaw) * (snap ? 1 : Math.min(1, dt * 8))
    this.pitch += (this.desiredPitch - this.pitch) * (snap ? 1 : Math.min(1, dt * 8))
    this.distance += (this.desiredDistance - this.distance) * (snap ? 1 : Math.min(1, dt * 8))
    const horizontal = Math.cos(this.pitch) * this.distance
    const height = Math.sin(this.pitch) * this.distance
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + height,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal
    )
    this.camera.lookAt(this.cameraTarget)
    if (this.sun) {
      this.sun.position.set(this.cameraTarget.x + 105, this.cameraTarget.y + 165, this.cameraTarget.z + 78)
      this.sun.target.position.copy(this.cameraTarget)
      this.sun.target.updateMatrixWorld()
    }
    if (this.sky) this.sky.position.copy(this.camera.position)
  }

  update(dt, force = false) {
    const step = Math.min(dt, 0.05)
    this.clockTime += step
    this.updateCamera(step)
    this.waterUniforms.uTime.value = this.clockTime
    this.smoke.update(step)
    for (const group of this.animatedIndustries) {
      for (const fn of group.userData.animations || []) fn(this.clockTime)
    }
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * step
      if (cloud.position.x > 620) cloud.position.x = -620
    }
    for (let i = 0; i < this.highlightRings.length; i++) {
      const highlight = this.highlightRings[i]
      const phase = this.clockTime * 3 + i * 0.75
      highlight.ring.scale.setScalar(2.5 + Math.sin(phase) * 0.28)
      highlight.ring.rotation.z = this.clockTime * 0.42
      highlight.ring.material.opacity = 0.7 + Math.sin(phase) * 0.2
      highlight.beam.material.opacity = 0.13 + Math.sin(phase * 0.8) * 0.045
      highlight.crystal.position.y = 6.2 + Math.sin(phase * 0.9) * 0.35
      highlight.crystal.rotation.y = this.clockTime * 1.3
      highlight.crystal.rotation.x = Math.sin(this.clockTime * 0.8) * 0.18
    }
    if (this.selected) {
      if (this.selected.type === 'station') {
        const station = this.world.stationById.get(this.selected.id)
        if (station) {
          const p = this.world.tileCenter(station.center.x, station.center.y)
          const pulse = 3.4 + Math.sin(this.clockTime * 3.2) * 0.35
          this.selectionRing.visible = true
          this.selectionRing.position.set(p.x, p.y + 0.45, p.z)
          this.selectionRing.scale.setScalar(pulse)
        } else {
          this.selectionRing.visible = false
        }
      } else if (this.selected.type === 'vehicle') {
        const visual = this.vehicleVisuals.get(this.selected.id)
        if (visual) {
          const group = visual.carGroups[0]
          const pulse = 2.6 + Math.sin(this.clockTime * 4) * 0.25
          this.selectionRing.visible = true
          this.selectionRing.position.set(group.position.x, group.position.y + 0.7, group.position.z)
          this.selectionRing.scale.setScalar(pulse)
        } else {
          this.selectionRing.visible = false
        }
      } else {
        this.selectionRing.visible = false
      }
    }
    for (const vehicle of this.sceneVehicles || []) this.syncVehicle(vehicle)
    this.webgl.render(this.scene, this.camera)
  }
}
