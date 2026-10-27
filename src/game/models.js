import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARGO, TILE } from './constants.js'

const materialCache = new Map()
const geometryCache = new Map()

export function material(color, { roughness = 0.78, metalness = 0.02, emissive = '#000000', emissiveIntensity = 0, transparent = false, opacity = 1, flatShading = false } = {}) {
  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}|${transparent}|${opacity}|${flatShading}`
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness, metalness,
      emissive, emissiveIntensity,
      transparent, opacity,
      flatShading,
      side: transparent ? THREE.DoubleSide : THREE.FrontSide
    }))
  }
  return materialCache.get(key)
}

export function glassMaterial(color = '#a9d8e8') {
  return material(color, { roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.55 })
}

function geometry(key, factory) {
  if (!geometryCache.has(key)) geometryCache.set(key, factory())
  return geometryCache.get(key)
}

const boxGeo = () => geometry('box', () => new THREE.BoxGeometry(1, 1, 1))
const cylGeo = (segments = 10) => geometry(`cyl${segments}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, segments))
const coneGeo = (segments = 10) => geometry(`cone${segments}`, () => new THREE.ConeGeometry(0.5, 1, segments))

function mesh(geo, mat, parent, { x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.scale.set(w, h, d)
  m.rotation.set(rx, ry, rz)
  m.castShadow = cast
  m.receiveShadow = receive
  if (parent) parent.add(m)
  return m
}

export function box(parent, color, x, y, z, w, h, d, opts = {}) {
  return mesh(boxGeo(), material(color, opts), parent, { x, y, z, w, h, d, ry: opts.ry || 0, rx: opts.rx || 0, rz: opts.rz || 0, cast: opts.cast !== false, receive: opts.receive !== false })
}

export function cylinder(parent, color, x, y, z, radius, height, opts = {}) {
  const segments = opts.segments || 10
  return mesh(cylGeo(segments), material(color, opts), parent, { x, y, z, w: radius * 2, h: height, d: radius * 2, rx: opts.rx || 0, ry: opts.ry || 0, rz: opts.rz || 0, cast: opts.cast !== false, receive: opts.receive !== false })
}

export function cone(parent, color, x, y, z, radius, height, opts = {}) {
  const segments = opts.segments || 10
  return mesh(coneGeo(segments), material(color, opts), parent, { x, y, z, w: radius * 2, h: height, d: radius * 2, rx: opts.rx || 0, ry: opts.ry || 0, rz: opts.rz || 0, cast: opts.cast !== false, receive: opts.receive !== false })
}

export function wheel(parent, x, y, z, radius, width, color = '#1c2024') {
  return mesh(cylGeo(12), material(color, { roughness: 0.9 }), parent, {
    x, y, z, w: radius * 2, h: width, d: radius * 2, rz: Math.PI / 2
  })
}

export function getGableRoofGeometry() {
  return geometry('gable', () => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array([
      -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5,
      -0.5, 0, 0.5, 0, 1, 0.5, 0.5, 0, 0.5,
      -0.5, 0, -0.5, 0, 1, -0.5, 0, 1, 0.5,
      -0.5, 0, -0.5, 0, 1, 0.5, -0.5, 0, 0.5,
      0.5, 0, -0.5, 0.5, 0, 0.5, 0, 1, 0.5,
      0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5
    ])
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.computeVertexNormals()
    return g
  })
}

export function gableRoof(parent, color, x, y, z, w, h, d, ry = 0) {
  const m = new THREE.Mesh(getGableRoofGeometry(), material(color, { roughness: 0.88 }))
  m.position.set(x, y, z)
  m.scale.set(w, h, d)
  m.rotation.y = ry
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

export function makeSignTexture(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, 128)
  gradient.addColorStop(0, '#183941')
  gradient.addColorStop(1, '#0b1e24')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = '#6fd6b8'
  ctx.lineWidth = 6
  ctx.strokeRect(5, 5, 502, 118)
  ctx.fillStyle = '#f2fbf7'
  ctx.font = 'bold 52px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.length > 28 ? text.slice(0, 27) + '…' : text, 256, 67)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function addStationSign(group, name, x, y, z, ry = 0) {
  const sign = new THREE.Group()
  sign.position.set(x, y, z)
  sign.rotation.y = ry
  const postMat = material('#dfe7e4', { roughness: 0.6, metalness: 0.15 })
  mesh(cylGeo(8), postMat, sign, { x: -0.72, y: 1.1, z: 0, w: 0.1, h: 2.2, d: 0.1 })
  mesh(cylGeo(8), postMat, sign, { x: 0.72, y: 1.1, z: 0, w: 0.1, h: 2.2, d: 0.1 })
  const texture = makeSignTexture(name)
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.1, transparent: true })
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), mat)
  plane.position.set(0, 2.05, 0.045)
  plane.castShadow = true
  sign.add(plane)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.6), material('#16323a', { roughness: 0.7 }))
  back.position.set(0, 2.05, 0)
  back.rotation.y = Math.PI
  sign.add(back)
  group.add(sign)
  return sign
}

// ---------------------------------------------------------------------------
// Town landmarks
// ---------------------------------------------------------------------------

export function createLandmark(house) {
  const group = new THREE.Group()
  if (house.landmark === 'church') {
    box(group, house.wall, 0, 0.1, 0, 2.6, 0.2, 4.2)
    box(group, house.wall, 0, 1.6, 0.2, 2.3, 3.0, 3.3)
    gableRoof(group, house.roof, 0, 3.1, 0.2, 2.7, 1.4, 3.8)
    box(group, house.wall, 0, 2.9, -2.15, 1.25, 5.8, 1.25)
    gableRoof(group, house.roof, 0, 5.8, -2.15, 1.55, 1.6, 1.55)
    box(group, '#f2e9d0', 0, 4.3, -2.8, 0.5, 0.85, 0.06, { emissive: '#ffd98a', emissiveIntensity: 0.18 })
    box(group, '#e8dfc8', 0, 7.5, -2.15, 0.08, 1.6, 0.08)
    box(group, '#e8dfc8', 0, 8.1, -2.15, 0.8, 0.08, 0.08)
    box(group, '#7f5a3a', 0, 1.15, 2.05, 0.9, 1.9, 0.12)
  } else {
    box(group, house.wall, 0, 0.12, 0, 3.9, 0.24, 3.3)
    box(group, house.wall, 0, 1.7, 0, 3.5, 3.2, 2.9)
    gableRoof(group, house.roof, 0, 3.3, 0, 3.9, 1.25, 3.3)
    box(group, house.wall, 0.85, 4.4, 0.6, 1.15, 3.6, 1.15, { emissive: '#ffe2a0', emissiveIntensity: 0.04 })
    gableRoof(group, house.roof, 0.85, 6.2, 0.6, 1.45, 1.45, 1.45)
    box(group, '#f4ead2', 0.85, 5.4, 1.18, 0.55, 0.55, 0.04)
    for (let i = -1; i <= 1; i++) {
      box(group, '#8bb1bb', i * 0.95, 2.25, 1.46, 0.5, 0.85, 0.05, { roughness: 0.2, metalness: 0.25 })
    }
    box(group, '#6b4a33', 0, 1.4, 1.48, 1.0, 2.4, 0.1)
    box(group, '#c7d8db', 0, 5.75, 0.6, 0.06, 1.8, 0.06)
    const flag = box(group, '#d8624c', 0.34, 6.45, 0.6, 0.64, 0.38, 0.04)
    flag.castShadow = false
  }
  return group
}

// ---------------------------------------------------------------------------
// Industries
// ---------------------------------------------------------------------------

function addSmoke(emitters, x, y, z, rate = 1, size = 1, color = '#cfd4cf') {
  emitters.push({ x, y, z, rate, size, color })
}

function addPuff(group, x, y, z, color = '#d7d9d2') {
  const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), material(color, { transparent: true, opacity: 0.22, roughness: 1 }))
  p.position.set(x, y, z)
  p.scale.setScalar(1.4)
  group.add(p)
  return p
}

export function createIndustry(industry) {
  const group = new THREE.Group()
  const def = industry
  const w = industry.w * TILE
  const d = industry.h * TILE
  const smoke = []
  const animations = []
  const color = '#6f756f'

  box(group, '#8d8d80', 0, 0.1, 0, w - 0.7, 0.2, d - 0.7, { roughness: 1 })
  box(group, '#7a7c72', 0, 0.17, 0, w - 1.7, 0.12, 2.0, { roughness: 1 })

  if (industry.type === 'coalMine') {
    box(group, '#3d4147', -w * 0.18, 1.5, -d * 0.1, 3.2, 2.8, 3.0)
    box(group, '#22262b', -w * 0.18, 1.35, 0.48, 2.0, 2.2, 0.2)
    for (const [px, pz] of [[-1.8, -1.4], [1.8, -1.4], [-1.8, 1.4], [1.8, 1.4]]) {
      const leg = cylinder(group, '#515861', px, 3.3, pz, 0.12, 6.2, { segments: 6 })
      leg.rotation.z = px * 0.035
      leg.rotation.x = -pz * 0.02
    }
    box(group, '#5c636c', 0, 6.4, 0, 3.5, 0.25, 0.25)
    const wheelGroup = new THREE.Group()
    wheelGroup.position.set(3.1, 6.4, 0)
    group.add(wheelGroup)
    const wheelMesh = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.17, 8, 18), material('#343a40', { metalness: 0.5, roughness: 0.5 }))
    wheelMesh.rotation.y = Math.PI / 2
    wheelMesh.castShadow = true
    wheelGroup.add(wheelMesh)
    for (let i = 0; i < 4; i++) {
      box(wheelGroup, '#66707a', 0, Math.sin(i * Math.PI / 2) * 0.9, Math.cos(i * Math.PI / 2) * 0.9, 0.12, 0.18, 1.6)
    }
    animations.push(t => { wheelGroup.rotation.x = t * 1.2 })
    box(group, '#5a4c3f', -1.1, 0.5, 3.4, 2.4, 0.8, 3.2)
    cone(group, '#25282c', 2.8, 0.55, 2.6, 1.6, 1.0, { segments: 7 })
    cone(group, '#30343a', 4.0, 0.4, 3.5, 1.1, 0.75, { segments: 7 })
    addSmoke(smoke, 3.1, 6.6, 0, 0.6, 0.9, '#b3aca2')
  } else if (industry.type === 'powerPlant') {
    box(group, '#9aa3a8', 0, 1.8, -1.0, 7.2, 3.6, 4.2)
    box(group, '#6f7c84', 0, 1.2, 2.1, 5.4, 2.4, 2.2)
    for (const sx of [-3.0, 3.0]) {
      cylinder(group, '#aeb7bb', sx, 3.1, 1.9, 2.0, 6.2, { segments: 18, roughness: 0.9 })
      const top = cylinder(group, '#8a9498', sx, 6.2, 1.9, 1.55, 0.5, { segments: 18, roughness: 0.9 })
      top.castShadow = false
      cylinder(group, '#d7d2c4', sx, 6.65, 1.9, 1.35, 0.25, { segments: 18, roughness: 1 })
      addSmoke(smoke, sx, 6.9, 1.9, 1.4, 1.4, '#e5e7e2')
    }
    cylinder(group, '#7d8589', 0.15, 5.6, -2.4, 0.8, 8.0, { segments: 14, roughness: 0.9 })
    cylinder(group, '#5d656a', 0.15, 9.6, -2.4, 0.95, 0.3, { segments: 14 })
    addSmoke(smoke, 0.15, 9.9, -2.4, 1.5, 1.1, '#b7b8b0')
    box(group, '#d9b75e', -1.2, 0.55, -3.8, 2.0, 1.1, 1.3, { emissive: '#ffcf5c', emissiveIntensity: 0.18 })
  } else if (industry.type === 'farm') {
    box(group, '#8b5d38', -w * 0.16, 2.0, -0.4, 5.4, 3.8, 4.2)
    gableRoof(group, '#79402f', -w * 0.16, 3.9, -0.4, 6.0, 2.0, 4.8)
    box(group, '#e8dfcd', -1.4, 1.3, 1.75, 1.2, 2.6, 0.16)
    cylinder(group, '#b9c0b8', 3.2, 2.8, -1.8, 1.05, 5.6, { segments: 14, roughness: 0.85 })
    cone(group, '#8d9791', 3.2, 5.8, -1.8, 1.25, 1.1, { segments: 14 })
    const mill = new THREE.Group()
    mill.position.set(3.6, 3.2, 1.9)
    group.add(mill)
    cylinder(mill, '#7b5c43', 0, 0, 0, 0.18, 3.2, { segments: 8 })
    const blades = new THREE.Group()
    blades.position.y = 1.5
    mill.add(blades)
    for (let i = 0; i < 4; i++) {
      box(blades, '#e9dfc5', Math.sin(i * Math.PI / 2) * 1.1, Math.cos(i * Math.PI / 2) * 1.1, 0, 0.22, 2.2, 0.1, { rz: -i * Math.PI / 2 })
    }
    animations.push(t => { blades.rotation.z = t * 0.6 })
    for (let i = 0; i < 6; i++) {
      box(group, '#b89b55', -3.4 + (i % 3) * 1.1, 0.28, 3.6 + Math.floor(i / 3) * 1.0, 1.0, 0.45, 0.9, { ry: (i % 2) * 0.2 })
    }
    box(group, '#7c9b4a', 0, 0.22, 5.7, w - 1.2, 0.22, 2.9, { roughness: 1 })
    for (let i = 0; i < 9; i++) box(group, '#d8b94e', -4.6 + i * 1.25, 0.38, 5.4 + (i % 2) * 0.6, 0.55, 0.1, 0.55)
  } else if (industry.type === 'factory') {
    box(group, '#a85445', 0, 2.1, -0.8, 7.6, 4.2, 4.7)
    for (let i = 0; i < 4; i++) {
      const roof = box(group, '#6f3b31', -2.7 + i * 1.8, 4.55, -0.8, 1.7, 0.9, 4.7, { rz: 0.35 })
      roof.castShadow = true
    }
    for (const [sx, sh] of [[-2.4, 6.2], [1.6, 7.4]]) {
      cylinder(group, '#777d7d', sx, sh / 2 + 4.1, -2.6, 0.55, sh, { segments: 12, roughness: 0.9 })
      cylinder(group, '#4f5555', sx, sh + 4.1, -2.6, 0.68, 0.25, { segments: 12 })
      addSmoke(smoke, sx, sh + 4.3, -2.6, 1.4, 1.0, '#c4c1b7')
    }
    box(group, '#7e827f', 3.4, 1.2, 1.7, 2.8, 2.4, 2.4)
    box(group, '#5f6562', 3.4, 2.5, 1.7, 3.3, 0.18, 2.9)
    for (let i = 0; i < 5; i++) box(group, '#b58655', -3.0 + i * 1.0, 0.55 + (i % 2) * 0.45, 3.3, 0.9, 0.9, 0.9, { ry: i * 0.3 })
    for (let i = 0; i < 3; i++) addPuff(group, -2.4 + i * 1.6, 8.6 + i * 0.7, -2.6, '#d4d1c8')
  } else if (industry.type === 'forest') {
    box(group, '#3f5e39', 0, 0.14, 0, w - 1, 0.18, d - 1, { roughness: 1 })
    for (let i = 0; i < 7; i++) {
      const x = -3.4 + (i % 4) * 1.8 + (Math.floor(i / 4) * 0.7)
      const z = -2.4 + Math.floor(i / 4) * 3.4
      cylinder(group, '#6f4a2d', x, 0.55, z, 0.45, 1.1, { segments: 8, rz: Math.PI / 2 })
      cylinder(group, '#3f6d3c', x, 2.1, z + 1.0, 0.12, 3.2, { segments: 6 })
      cone(group, '#2f6037', x, 3.4, z + 1.0, 1.5, 3.1, { segments: 8 })
    }
    box(group, '#886844', 3.1, 1.2, 2.8, 2.2, 1.9, 1.8)
    gableRoof(group, '#59432f', 3.1, 2.1, 2.8, 2.5, 0.8, 2.1)
    for (let i = 0; i < 6; i++) cylinder(group, '#8e6038', -3.4 + i * 0.62, 0.55, 3.2, 0.36, 2.8, { segments: 8, rx: Math.PI / 2 })
  } else if (industry.type === 'sawmill') {
    box(group, '#a07b50', 0, 1.8, -1.2, 6.2, 3.6, 3.4)
    gableRoof(group, '#6c5136', 0, 3.4, -1.2, 6.8, 1.4, 4.0)
    box(group, '#6e6f66', -3.4, 0.9, 0.2, 2.6, 1.8, 2.0)
    for (let i = 0; i < 8; i++) cylinder(group, '#8b5c34', 0.4 + (i % 4) * 0.55, 0.5 + Math.floor(i / 4) * 0.55, 3.3, 0.28, 3.0, { segments: 8, rz: Math.PI / 2 })
    const blade = cylinder(group, '#b9b9ad', -3.4, 2.1, 0.2, 1.0, 0.08, { segments: 16, metalness: 0.5, roughness: 0.3 })
    blade.rotation.z = Math.PI / 2
    animations.push(t => { blade.rotation.y = t * 5 })
    cylinder(group, '#7c7c72', 2.9, 3.9, -2.4, 0.5, 4.8, { segments: 10 })
    addSmoke(smoke, 2.9, 6.4, -2.4, 0.9, 0.9, '#c8c2b4')
  } else if (industry.type === 'oilWell') {
    box(group, '#6a604d', 0, 0.14, 0, w - 1, 0.18, d - 1, { roughness: 1 })
    for (let i = 0; i < 3; i++) {
      const px = -3.0 + i * 3.0
      const pz = i % 2 === 0 ? -1.2 : 1.4
      const rig = new THREE.Group()
      rig.position.set(px, 0, pz)
      group.add(rig)
      for (const sx of [-1, 1]) {
        const leg = box(rig, '#4b4f53', sx * 0.9, 1.7, 0, 0.18, 3.4, 0.18)
        leg.rotation.z = -sx * 0.28
      }
      box(rig, '#393d41', 0, 2.9, 0, 1.3, 0.3, 0.8)
      const beam = new THREE.Group()
      beam.position.set(0, 3.2, 0)
      rig.add(beam)
      box(beam, '#6b4f32', 0, 0, 1.8, 0.28, 0.28, 3.6)
      box(beam, '#4b4f53', 0, -0.7, 3.1, 0.5, 1.2, 0.35)
      cylinder(rig, '#7e8488', 0, 1.0, -2.2, 0.6, 1.5, { segments: 12 })
      animations.push(t => { beam.rotation.x = Math.sin(t * 1.1 + i) * 0.22 })
    }
    cylinder(group, '#8f9496', 3.8, 1.4, -3.2, 1.2, 2.5, { segments: 14 })
    cylinder(group, '#6e7476', 3.8, 2.7, -3.2, 1.25, 0.18, { segments: 14 })
    box(group, '#5c5f60', 0, 0.3, 3.6, 5.8, 0.5, 0.5)
  } else if (industry.type === 'refinery') {
    for (const [x, z, r, h] of [[-3.0, -1.8, 1.2, 2.6], [0.0, -2.1, 1.1, 2.4], [3.0, -1.8, 1.2, 2.6]]) {
      cylinder(group, '#c7c9c5', x, 1.3, z, r, h, { segments: 16, metalness: 0.25, roughness: 0.55 })
      cylinder(group, '#858b8a', x, h + 1.3, z, r + 0.08, 0.15, { segments: 16 })
    }
    cylinder(group, '#aeb2b0', 0.5, 4.2, 1.4, 0.8, 8.4, { segments: 14, metalness: 0.2, roughness: 0.55 })
    cylinder(group, '#848c8c', 0.5, 8.5, 1.4, 0.95, 0.25, { segments: 14 })
    cylinder(group, '#9aa0a0', -2.2, 3.2, 2.0, 0.5, 6.4, { segments: 12 })
    for (let i = 0; i < 4; i++) {
      cylinder(group, '#737a79', -3.2 + i * 1.8, 0.65, 3.3, 0.14, 4.4, { segments: 8, rz: Math.PI / 2 })
    }
    box(group, '#767c7b', 3.2, 1.2, 2.0, 2.2, 2.4, 1.8)
    const flame = cone(group, '#ffb347', -2.2, 7.0, 2.0, 0.45, 1.3, { segments: 8, emissive: '#ff7a1a', emissiveIntensity: 1.4 })
    flame.castShadow = false
    addSmoke(smoke, 0.5, 8.7, 1.4, 1.2, 1.2, '#d8d6ce')
    addSmoke(smoke, -2.2, 7.4, 2.0, 0.5, 0.7, '#b9b3a8')
  } else if (industry.type === 'steelMill') {
    box(group, '#5e6468', 0, 2.0, 0, 7.4, 4.0, 6.8)
    cylinder(group, '#7b8184', -2.4, 5.4, -0.8, 1.6, 6.8, { segments: 16, metalness: 0.3, roughness: 0.6 })
    cone(group, '#60666a', -2.4, 9.0, -0.8, 1.8, 1.5, { segments: 16 })
    cylinder(group, '#8c9294', 2.8, 6.2, -2.0, 0.7, 8.8, { segments: 14 })
    addSmoke(smoke, 2.8, 10.7, -2.0, 1.5, 1.1, '#bdb9ad')
    addSmoke(smoke, -2.4, 9.7, -0.8, 0.9, 0.9, '#d0cbc0')
    box(group, '#ff8a3d', -0.4, 1.8, 3.42, 2.4, 1.9, 0.18, { emissive: '#ff5c13', emissiveIntensity: 1.2 })
    box(group, '#363b3e', -0.4, 0.4, 3.55, 2.8, 0.5, 0.5)
    for (let i = 0; i < 4; i++) cylinder(group, '#4c5155', 3.8, 0.7, 1.4 + i * 0.6, 0.25, 3.0, { segments: 8, rz: Math.PI / 2 })
    const glow = box(group, '#ffb35c', 3.7, 1.0, 3.0, 0.5, 0.5, 0.5, { emissive: '#ff7a1b', emissiveIntensity: 1.2 })
    glow.castShadow = false
  }

  group.userData.smoke = smoke
  group.userData.animations = animations
  group.userData.footprint = { w, d }
  return group
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

export function createStationModel(station, world) {
  const group = new THREE.Group()
  const center = world.tileCenter(station.center.x, station.center.y)
  group.position.set(center.x, center.y, center.z)
  const kind = station.kind

  if (kind === 'rail') {
    const span = 2 * TILE
    let alongZ = true
    const t0 = world.getTile(station.center.x, station.center.y)
    if (t0) alongZ = ((t0.rail & 3) === 3 && (t0.rail & 12) !== 12) || (t0.rail & 5) === 5
    const width = span
    const depth = span
    if (alongZ) {
      for (const sx of [-2.75, 2.75]) {
        box(group, '#b6b6a9', sx, 0.25, 0, 1.9, 0.5, depth - 0.9, { roughness: 0.95 })
        box(group, '#d2d2c6', sx, 0.52, 0, 1.55, 0.08, depth - 1.2, { roughness: 0.9 })
        box(group, '#f0e1a2', sx, 0.58, 0, 1.5, 0.04, 0.12, { roughness: 0.9 })
        for (const sz of [-2.6, 2.6]) {
          cylinder(group, '#d9ded9', sx + (sx > 0 ? -0.55 : 0.55), 2.1, sz, 0.1, 2.9, { segments: 8, metalness: 0.4, roughness: 0.3 })
        }
        box(group, '#e3e7e0', sx, 3.55, 0, 1.65, 0.16, depth - 0.6, { roughness: 0.65 })
        box(group, '#3f8f7d', sx, 3.63, 0, 1.65, 0.06, depth - 0.6)
      }
      box(group, '#6e5440', 0, 1.9, -depth / 2 - 0.7, 3.0, 3.0, 2.0, { roughness: 0.8 })
      gableRoof(group, '#7e4c3c', 0, 3.25, -depth / 2 - 0.7, 3.3, 1.0, 2.3)
      for (let i = 0; i < 3; i++) box(group, '#9fd1d9', -0.8 + i * 0.8, 2.05, -depth / 2 + 0.28, 0.55, 0.8, 0.06, { roughness: 0.2, metalness: 0.2 })
      for (let i = 0; i < 4; i++) {
        cylinder(group, '#f3e8b5', -2.75, 3.75, -2.6 + i * 1.73, 0.08, 0.5, { segments: 6, emissive: '#fff3b0', emissiveIntensity: 0.45 })
        cylinder(group, '#f3e8b5', 2.75, 3.75, -2.6 + i * 1.73, 0.08, 0.5, { segments: 6, emissive: '#fff3b0', emissiveIntensity: 0.45 })
      }
      addStationSign(group, station.name, 0, 3.7, -depth / 2 + 2.9, Math.PI)
    } else {
      for (const sz of [-2.75, 2.75]) {
        box(group, '#b6b6a9', 0, 0.25, sz, width - 0.9, 0.5, 1.9, { roughness: 0.95 })
        box(group, '#d2d2c6', 0, 0.52, sz, width - 1.2, 0.08, 1.55, { roughness: 0.9 })
        box(group, '#f0e1a2', 0, 0.58, sz, 0.12, 0.04, 1.5, { roughness: 0.9 })
        for (const sx of [-2.6, 2.6]) {
          cylinder(group, '#d9ded9', sx, 2.1, sz + (sz > 0 ? -0.55 : 0.55), 0.1, 2.9, { segments: 8, metalness: 0.4, roughness: 0.3 })
        }
        box(group, '#e3e7e0', 0, 3.55, sz, width - 0.6, 0.16, 1.65, { roughness: 0.65 })
        box(group, '#3f8f7d', 0, 3.63, sz, width - 0.6, 0.06, 1.65)
      }
      box(group, '#6e5440', -width / 2 - 0.7, 1.9, 0, 2.0, 3.0, 3.0, { roughness: 0.8 })
      gableRoof(group, '#7e4c3c', -width / 2 - 0.7, 3.25, 0, 2.3, 1.0, 3.3)
      for (let i = 0; i < 3; i++) box(group, '#9fd1d9', -width / 2 + 0.28, 2.05, -0.8 + i * 0.8, 0.06, 0.8, 0.55, { roughness: 0.2, metalness: 0.2 })
      for (let i = 0; i < 4; i++) {
        cylinder(group, '#f3e8b5', -2.6 + i * 1.73, 3.75, -2.75, 0.08, 0.5, { segments: 6, emissive: '#fff3b0', emissiveIntensity: 0.45 })
        cylinder(group, '#f3e8b5', -2.6 + i * 1.73, 3.75, 2.75, 0.08, 0.5, { segments: 6, emissive: '#fff3b0', emissiveIntensity: 0.45 })
      }
      addStationSign(group, station.name, -width / 2 + 2.9, 3.7, 0, Math.PI / 2)
    }
  } else if (kind === 'bus' || kind === 'truck') {
    const tile = world.getTile(station.center.x, station.center.y)
    const northSouth = Boolean(tile && (tile.road & 1 || tile.road & 4))
    const sideX = northSouth ? 1 : 0
    const sideZ = northSouth ? 0 : 1
    const offset = 2.05
    const ox = sideX * offset
    const oz = sideZ * offset
    const ry = northSouth ? Math.PI / 2 : 0
    box(group, '#b7b4a8', ox, 0.35, oz, kind === 'bus' ? 1.9 : 2.6, 0.18, kind === 'bus' ? 2.7 : 3.4, { roughness: 1 })
    if (kind === 'bus') {
      box(group, '#2f7d73', ox, 1.85, oz, 2.2, 0.16, 2.9, { roughness: 0.7 })
      for (const [px, pz] of [[ox - 0.95, oz - 1.2], [ox - 0.95, oz + 1.2], [ox + 0.95, oz - 1.2], [ox + 0.95, oz + 1.2]]) {
        cylinder(group, '#c9d2ce', px, 1.05, pz, 0.08, 1.7, { segments: 6, metalness: 0.3 })
      }
      box(group, '#8fd0c4', ox - 0.3, 1.9, oz, 0.06, 1.1, 2.3, { transparent: true, opacity: 0.45, roughness: 0.2 })
      box(group, '#6f4e35', ox + 0.95, 0.75, oz, 0.6, 0.15, 1.8)
      box(group, '#263238', ox, 1.05, oz - 1.35, 1.4, 1.1, 0.1, { emissive: '#9be5d6', emissiveIntensity: 0.25 })
    } else {
      box(group, '#8a6f50', ox + 0.2, 2.4, oz, 2.8, 0.22, 3.8, { roughness: 0.85 })
      for (const [px, pz] of [[ox - 1.1, oz - 1.5], [ox + 1.5, oz - 1.5], [ox - 1.1, oz + 1.5], [ox + 1.5, oz + 1.5]]) {
        cylinder(group, '#5e6060', px, 1.3, pz, 0.1, 2.2, { segments: 6, metalness: 0.4 })
      }
      for (let i = 0; i < 3; i++) box(group, '#b58555', ox - 0.7 + i * 1.0, 0.65, oz + 1.4, 0.8, 0.8, 0.8)
      box(group, '#f0d38e', ox, 2.55, oz + 1.6, 1.8, 0.5, 0.06, { emissive: '#ffd47a', emissiveIntensity: 0.2 })
    }
    addStationSign(group, station.name, ox, 2.4, oz + (northSouth ? 0 : 0.1), ry)
  } else if (kind === 'dock') {
    const access = station.access.find(t => world.isWater(t.x, t.y))
    let dx = 1
    let dz = 0
    if (access) {
      const wp = world.tileCenter(access.x, access.y)
      dx = wp.x - center.x
      dz = wp.z - center.z
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
    }
    const ry = Math.atan2(dx, dz)
    const pier = new THREE.Group()
    pier.position.set(0, 0, 0)
    pier.rotation.y = ry
    group.add(pier)
    for (let i = 0; i < 6; i++) {
      box(pier, i % 2 ? '#9a7953' : '#866844', 0, 0.38, 2.0 + i * 1.35, 3.2, 0.24, 1.28, { roughness: 0.95 })
      if (i % 2 === 0) {
        for (const sx of [-1.4, 1.4]) cylinder(pier, '#6f573a', sx, 0.1, 2.0 + i * 1.35, 0.13, 1.2, { segments: 6 })
      }
    }
    box(pier, '#627273', 0, 1.25, 8.0, 3.4, 2.0, 1.3, { roughness: 0.6, metalness: 0.1 })
    box(group, '#b8ae96', 0, 0.42, 0.1, 5.2, 0.4, 4.2)
    box(group, '#8a6e4e', -1.3, 2.0, -0.4, 2.8, 3.2, 2.6)
    gableRoof(group, '#5d4936', -1.3, 3.7, -0.4, 3.1, 1.0, 2.9)
    const crane = new THREE.Group()
    crane.position.set(1.0, 0.7, 2.8)
    group.add(crane)
    cylinder(crane, '#d5a03c', 0, 2.4, 0, 0.22, 4.8, { segments: 8, metalness: 0.2 })
    const boom = box(crane, '#d5a03c', 0, 4.8, 2.2, 0.3, 0.3, 5.0)
    boom.rotation.x = -0.18
    box(crane, '#e0bb5a', -1.4, 4.4, -1.6, 1.4, 1.2, 1.4)
    const cable = cylinder(crane, '#33363a', 0, 2.6, 4.4, 0.04, 4.0, { segments: 4 })
    box(crane, '#c75c43', 0, 0.6, 4.4, 1.2, 0.9, 1.2)
    for (let i = 0; i < 3; i++) box(group, '#b8864f', 2.2 - i * 0.5, 0.7, 0.8 + i * 0.8, 1.4, 0.7, 1.0)
    addStationSign(group, station.name, 1.8, 1.1, -2.4, -0.4)
  } else if (kind === 'airport') {
    const span = 4 * TILE
    box(group, '#4f5558', 0, 0.28, 0, span - 0.5, 0.24, span - 0.5, { roughness: 0.95 })
    box(group, '#353b3e', 0, 0.42, 0, span - 1.2, 0.06, 5.2, { roughness: 1 })
    for (let i = 0; i < 9; i++) box(group, '#e5d9a6', -span / 2 + 2 + i * 1.7, 0.46, 0, 0.75, 0.03, 0.16, { emissive: '#fff0b8', emissiveIntensity: 0.3 })
    box(group, '#d8d8cd', 0, 0.49, 3.3, span - 2.6, 0.03, 0.12)
    box(group, '#d8d8cd', 0, 0.49, -3.3, span - 2.6, 0.03, 0.12)
    box(group, '#b7b4a8', -span / 2 + 2.2, 1.4, -span / 2 + 2.1, 6.0, 2.6, 4.0, { roughness: 0.8 })
    box(group, '#5c8f93', -span / 2 + 2.2, 2.1, -span / 2 + 4.05, 5.2, 1.0, 0.08, { roughness: 0.2, metalness: 0.2 })
    box(group, '#e1e5df', -span / 2 + 2.2, 2.9, -span / 2 + 2.1, 6.2, 0.22, 4.2)
    box(group, '#8d9694', span / 2 - 3.0, 4.5, -span / 2 + 2.2, 1.7, 7.4, 1.7, { roughness: 0.6 })
    box(group, '#c8d4d0', span / 2 - 3.0, 7.7, -span / 2 + 2.2, 2.3, 1.0, 2.3)
    box(group, '#6fb3bb', span / 2 - 3.0, 7.95, -span / 2 + 2.2, 2.05, 0.35, 2.05, { emissive: '#8fe8f0', emissiveIntensity: 0.5, roughness: 0.2 })
    box(group, '#8f9a98', span / 2 - 3.2, 2.2, span / 2 - 3.4, 4.6, 3.4, 4.6)
    gableRoof(group, '#6f7b79', span / 2 - 3.2, 3.9, span / 2 - 3.4, 5.1, 1.4, 5.1)
    addStationSign(group, station.name, -span / 2 + 2.2, 3.5, -span / 2 + 4.2)
    for (let i = 0; i < 4; i++) {
      cylinder(group, '#d5d9d4', -span / 2 + 1 + i * (span - 2) / 3, 1.1, span / 2 - 0.6, 0.08, 2.2, { segments: 6 })
      cylinder(group, '#f3e8b5', -span / 2 + 1 + i * (span - 2) / 3, 2.25, span / 2 - 0.6, 0.1, 0.2, { segments: 6, emissive: '#fff0b0', emissiveIntensity: 0.5 })
    }
  }

  return group
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

function wheelsFor(parent, length, width, radius, color = '#202428') {
  const xs = [-width / 2 + 0.1, width / 2 - 0.1]
  const zs = [-length * 0.28, length * 0.28]
  for (const x of xs) for (const z of zs) wheel(parent, x, radius, z, radius, 0.24, color)
}

export function createTrainCars(vehicle) {
  const cars = []
  const cargoColor = CARGO[vehicle.cargo]?.color || '#7fa9b8'
  const isPassenger = vehicle.cargo === 'passengers' || vehicle.cargo === 'mail'
  const count = vehicle.type === 'train' ? 1 + (vehicle.cargo === 'passengers' ? 3 : 3) : 1
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group()
    if (i === 0) {
      const bodyColor = '#2f7d73'
      box(group, bodyColor, 0, 1.55, 0, 1.8, 1.55, 3.5, { roughness: 0.55, metalness: 0.1 })
      box(group, '#e8e0c9', 0, 2.15, 0.15, 1.82, 0.34, 2.8, { roughness: 0.6 })
      box(group, '#1c2b33', 0, 1.95, 1.55, 1.35, 0.85, 0.3, { roughness: 0.2, metalness: 0.15 })
      box(group, '#ffe6a8', -0.55, 1.3, 1.79, 0.3, 0.28, 0.06, { emissive: '#ffd166', emissiveIntensity: 1.0 })
      box(group, '#ffe6a8', 0.55, 1.3, 1.79, 0.3, 0.28, 0.06, { emissive: '#ffd166', emissiveIntensity: 1.0 })
      box(group, '#21262a', 0, 1.05, -0.8, 1.4, 0.3, 0.8)
      cylinder(group, '#3a4147', 0, 2.55, -0.6, 0.16, 0.9, { segments: 8 })
      wheelsFor(group, 3.1, 1.5, 0.38)
      box(group, '#c9c2ad', 0, 1.0, 1.5, 2.0, 0.22, 0.55)
    } else if (isPassenger) {
      box(group, '#d7d2c2', 0, 1.62, 0, 1.8, 1.55, 3.1, { roughness: 0.6 })
      box(group, '#2f7d73', 0, 2.0, 0, 1.82, 0.4, 3.12)
      box(group, '#b7b2a3', 0, 2.56, 0, 1.55, 0.14, 2.85)
      for (let w = 0; w < 3; w++) {
        box(group, '#a9d8e8', -0.91, 1.9, -0.9 + w * 0.9, 0.03, 0.55, 0.55, { roughness: 0.2, metalness: 0.2 })
        box(group, '#a9d8e8', 0.91, 1.9, -0.9 + w * 0.9, 0.03, 0.55, 0.55, { roughness: 0.2, metalness: 0.2 })
      }
      wheelsFor(group, 2.8, 1.5, 0.32)
    } else {
      box(group, '#3a3f43', 0, 0.78, 0, 1.8, 0.4, 3.1)
      box(group, cargoColor, 0, 1.55, 0, 1.65, 1.2, 2.9, { roughness: 0.8 })
      for (let s = 0; s < 4; s++) box(group, '#2e3337', -0.9, 1.0 + s * 0.02, -1.35 + s * 0.9, 1.84, 0.12, 0.1)
      wheelsFor(group, 2.8, 1.5, 0.32)
    }
    group.userData.carIndex = i
    cars.push(group)
  }
  return cars
}

export function createRoadVehicle(vehicle) {
  const group = new THREE.Group()
  const cargoColor = CARGO[vehicle.cargo]?.color || '#7fa9b8'
  if (vehicle.type === 'bus') {
    box(group, '#d8a13f', 0, 1.35, 0, 1.8, 1.8, 3.3, { roughness: 0.45, metalness: 0.1 })
    box(group, '#f1e8d4', 0, 2.15, 0, 1.82, 0.55, 3.2, { roughness: 0.5 })
    box(group, '#29343b', 0, 1.85, 1.66, 1.45, 0.95, 0.08, { roughness: 0.15, metalness: 0.2 })
    for (let i = 0; i < 3; i++) {
      box(group, '#a9d8e8', -0.91, 1.85, -0.85 + i * 0.85, 0.04, 0.62, 0.62, { roughness: 0.15, metalness: 0.2 })
      box(group, '#a9d8e8', 0.91, 1.85, -0.85 + i * 0.85, 0.04, 0.62, 0.62, { roughness: 0.15, metalness: 0.2 })
    }
    box(group, '#2f7d73', 0, 1.15, 0, 1.82, 0.28, 3.32)
    box(group, '#ffe6a8', -0.55, 1.05, 1.68, 0.32, 0.22, 0.05, { emissive: '#ffd166', emissiveIntensity: 0.9 })
    box(group, '#ffe6a8', 0.55, 1.05, 1.68, 0.32, 0.22, 0.05, { emissive: '#ffd166', emissiveIntensity: 0.9 })
    wheelsFor(group, 2.8, 1.55, 0.34)
  } else if (vehicle.type === 'truck') {
    box(group, '#c85d45', 0, 1.25, 1.0, 1.75, 1.7, 2.0, { roughness: 0.55 })
    box(group, '#26323a', 0, 1.85, 1.9, 1.35, 0.7, 0.12, { roughness: 0.15, metalness: 0.2 })
    box(group, '#e6dcc6', 0, 2.0, 1.45, 1.78, 0.34, 1.2, { roughness: 0.5 })
    box(group, '#8e9493', 0, 1.15, -1.1, 1.78, 0.35, 3.0)
    box(group, cargoColor, 0, 1.8, -1.1, 1.7, 1.5, 2.9, { roughness: 0.85 })
    for (let i = 0; i < 4; i++) box(group, '#4e5559', -0.86, 1.4, -2.1 + i * 0.7, 0.05, 0.85, 0.08)
    wheelsFor(group, 4.0, 1.55, 0.35)
  } else {
    box(group, cargoColor, 0, 1.2, 0, 1.8, 1.4, 3.6, { roughness: 0.6 })
    wheelsFor(group, 3.2, 1.5, 0.32)
  }
  return group
}

export function createShip(vehicle) {
  const group = new THREE.Group()
  const cargoColor = CARGO[vehicle.cargo]?.color || '#9a7a4d'
  box(group, '#7b2f2b', 0, 0.55, 0, 2.5, 0.9, 6.8, { roughness: 0.65 })
  box(group, '#2f3b44', 0, 1.15, 0, 2.35, 0.35, 6.6)
  box(group, '#d9d5c8', 0, 1.55, 2.35, 1.9, 0.6, 1.5)
  box(group, '#f2eee2', 0, 2.05, 2.35, 1.45, 0.75, 1.15, { roughness: 0.5 })
  box(group, '#2d6b75', 0, 2.05, 1.76, 1.46, 0.3, 0.06, { roughness: 0.2, metalness: 0.2 })
  box(group, '#7b2f2b', 0, 1.55, -3.2, 2.4, 0.35, 0.4)
  cylinder(group, '#3a4147', 0, 2.85, 1.4, 0.22, 2.2, { segments: 8 })
  cylinder(group, '#3a4147', 0, 3.9, 1.4, 0.3, 0.2, { segments: 8 })
  for (let i = 0; i < 5; i++) {
    box(group, cargoColor, -0.7 + (i % 3) * 0.7, 1.55, -0.6 - Math.floor(i / 3) * 1.0, 0.62, 0.72, 0.9)
  }
  for (let i = 0; i < 5; i++) box(group, '#2b3136', -1.15, 0.75, -3.0 + i * 0.7, 0.08, 0.6, 0.1)
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 5.0),
    new THREE.MeshBasicMaterial({ color: '#e8f4f4', transparent: true, opacity: 0.18, depthWrite: false })
  )
  wake.rotation.x = -Math.PI / 2
  wake.position.set(0, 0.16, -5.0)
  group.add(wake)
  group.userData.wake = wake
  return group
}

export function createPlane(vehicle) {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const fuselage = cylinder(body, '#e9ece8', 0, 1.8, 0, 0.6, 6.0, { segments: 14, roughness: 0.4, metalness: 0.15 })
  fuselage.rotation.x = Math.PI / 2
  cone(body, '#e9ece8', 0, 1.8, 3.2, 0.6, 1.3, { segments: 14, roughness: 0.4, rx: Math.PI / 2 })
  cone(body, '#3f8f7d', 0, 1.8, 3.9, 0.24, 0.5, { segments: 14, rx: Math.PI / 2 })
  box(body, '#d9e0dc', 0, 2.0, -0.4, 0.7, 0.3, 4.6)
  box(body, '#3f8f7d', 0, 1.55, 0, 0.72, 0.18, 4.8)
  box(body, '#a9d8e8', 0, 2.1, 2.1, 0.62, 0.32, 0.7, { roughness: 0.2, metalness: 0.2 })
  box(body, '#3f8f7d', 0, 2.35, -2.2, 1.9, 0.14, 0.8, { roughness: 0.55 })
  box(body, '#3f8f7d', 0, 2.75, -2.55, 0.12, 1.0, 0.7)
  box(body, '#d9e0dc', 0, 2.8, -2.55, 1.1, 0.12, 0.6)
  box(body, '#d9e0dc', 0, 1.8, -0.2, 8.2, 0.16, 1.7, { roughness: 0.5 })
  for (const sx of [-2.3, 2.3]) {
    const nacelle = cylinder(body, '#c9d2ce', sx, 1.55, 0.5, 0.32, 1.7, { segments: 10, roughness: 0.35, metalness: 0.2 })
    nacelle.rotation.x = Math.PI / 2
    const prop = new THREE.Group()
    prop.position.set(sx, 1.55, 1.42)
    body.add(prop)
    for (let i = 0; i < 3; i++) {
      box(prop, '#2b3136', 0, Math.cos(i * Math.PI * 2 / 3) * 0.55, Math.sin(i * Math.PI * 2 / 3) * 0.55, 0.1, 1.1, 0.08)
    }
    if (!group.userData.props) group.userData.props = []
    group.userData.props.push(prop)
  }
  cylinder(body, '#26323a', -0.6, 1.0, 1.5, 0.22, 0.3, { segments: 8 })
  cylinder(body, '#26323a', 0.6, 1.0, 1.5, 0.22, 0.3, { segments: 8 })
  group.userData.body = body
  return group
}

export function createVehicleVisual(vehicle) {
  if (vehicle.type === 'train') {
    const cars = createTrainCars(vehicle)
    return { carGroups: cars, group: null, train: true }
  }
  if (vehicle.type === 'ship') {
    const group = createShip(vehicle)
    return { group, carGroups: [group], train: false }
  }
  if (vehicle.type === 'plane') {
    const group = createPlane(vehicle)
    return { group, carGroups: [group], train: false }
  }
  const group = createRoadVehicle(vehicle)
  return { group, carGroups: [group], train: false }
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

export function createTreeGeometries() {
  const trunk = new THREE.CylinderGeometry(0.13, 0.2, 1.2, 6)
  trunk.translate(0, 0.6, 0)
  const coniferLayers = []
  for (let i = 0; i < 3; i++) {
    const coneGeo = new THREE.ConeGeometry(1.25 - i * 0.27, 1.5, 7)
    coneGeo.translate(0, 1.6 + i * 0.95, 0)
    coniferLayers.push(coneGeo)
  }
  const conifer = mergeGeometries(coniferLayers)
  coniferLayers.forEach(g => g.dispose())
  const broadleafLayers = []
  for (let i = 0; i < 3; i++) {
    const ball = new THREE.IcosahedronGeometry(0.95 - i * 0.15, 0)
    ball.translate(Math.sin(i * 2.2) * 0.45, 2.05 + i * 0.45, Math.cos(i * 1.7) * 0.35)
    broadleafLayers.push(ball)
  }
  const broadleaf = mergeGeometries(broadleafLayers)
  broadleafLayers.forEach(g => g.dispose())
  return { trunk, conifer, broadleaf }
}

export function createRockGeometry() {
  return new THREE.DodecahedronGeometry(0.7, 0)
}
