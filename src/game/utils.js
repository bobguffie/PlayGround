export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1), 0, 1)
  return t * t * (3 - 2 * t)
}
export const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function valueNoise(x, y, seed = 1) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

export function fbm(x, y, seed = 1, octaves = 4) {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let total = 0
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * frequency, y * frequency, seed + i * 71) * amplitude
    total += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return value / total
}

export function formatMoney(amount, compact = false) {
  const value = Math.round(amount)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (compact && abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(abs >= 10000000 ? 1 : 2)}M`
  if (compact && abs >= 10000) return `${sign}$${Math.round(abs / 1000)}k`
  return `${sign}$${abs.toLocaleString('en-US')}`
}

export function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US')
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dateFromDay(start, totalDays) {
  const base = Date.UTC(start.year, start.month, start.day)
  return new Date(base + Math.floor(totalDays) * 86400000)
}

export function dateLabel(start, totalDays) {
  const d = dateFromDay(start, totalDays)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function dateParts(start, totalDays) {
  const d = dateFromDay(start, totalDays)
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() }
}

export function randomChoice(rng, array) {
  return array[Math.floor(rng() * array.length) % array.length]
}

export function shuffle(rng, array) {
  const copy = array.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function roman(num) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [value, symbol] of table) {
    while (num >= value) { out += symbol; num -= value }
  }
  return out
}
