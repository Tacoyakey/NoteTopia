const WORLD_BASE = `${import.meta.env.BASE_URL}world/`
const STAR_SIZE = 16
const STAR_SCALE = 3.3
const STAR_COLS = 4
const STAR_ROWS = 2
const STAR_VARIANT_SCALE = [1, 0.92, 0.84, 0.8, 0.9, 0.82, 0.86, 0.7]

export const STAR_TINTS = [
  '#ffffff',
  '#fff6c8',
  '#dcefff',
  '#ffe8a0',
  '#f4fbff',
  '#c8dcff',
  '#fff2d0',
  '#ffffff',
] as const

const STAR0_TINTS = [
  '#ffffff',
  '#fff4c4',
  '#e4f0ff',
  '#ffe6a8',
  '#f7fbff',
  '#d0e4ff',
  '#fff0cc',
  '#ffffff',
] as const

export type StarFrame = { canvas: HTMLCanvasElement; body: number }

const listeners = new Set<() => void>()
let warpImg: HTMLImageElement | null = null
let starFrames: StarFrame[] = []
let star0Tints: StarFrame[] = []
let hill1: HTMLCanvasElement | null = null
let hill2: HTMLCanvasElement | null = null
let hill3: HTMLCanvasElement | null = null
let snowyHill: HTMLCanvasElement | null = null
let snowClouds: HTMLCanvasElement | null = null
let snowFlake: HTMLCanvasElement | null = null
let cloudImg: HTMLCanvasElement | null = null
let sunImg: HTMLCanvasElement | null = null
let moonImg: HTMLImageElement | null = null
let nightBackImg: HTMLImageElement | null = null
let sunsetImg: HTMLImageElement | null = null
let sunsetWaterImg: HTMLImageElement | null = null
let whiteStarFrames: StarFrame[] = []
let whiteStar0: StarFrame[] = []
let pphBg: HTMLImageElement | null = null
let pphBt: HTMLImageElement | null = null
let pphRiver1: HTMLImageElement | null = null
let pphRiver2: HTMLImageElement | null = null
let pphFront1: HTMLImageElement | null = null
let pphFront2: HTMLImageElement | null = null
let pphParticle: HTMLImageElement | null = null
let pphCat1: HTMLImageElement | null = null
let pphCat2: HTMLImageElement | null = null
let pphCat3: HTMLImageElement | null = null
let probed = false

function notify(): void {
  listeners.forEach((cb) => cb())
}

export function subscribeWeather(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function hash2(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function keyBlack(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const pix = ctx.getImageData(0, 0, c.width, c.height)
  const d = pix.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 18 && d[i + 1] < 18 && d[i + 2] < 18) d[i + 3] = 0
  }
  ctx.putImageData(pix, 0, 0)
  return c
}

function cropOpaque(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d')
  if (!ctx) return src
  const { width, height } = src
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 12) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return src
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(src, minX, minY, w, h, 0, 0, w, h)
  return out
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function sliceStar(sheet: HTMLImageElement, col: number, row: number, variant: number): HTMLCanvasElement {
  const size = Math.max(8, Math.round(STAR_SIZE * STAR_SCALE * STAR_VARIANT_SCALE[variant]))
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sheet, col * STAR_SIZE, row * STAR_SIZE, STAR_SIZE, STAR_SIZE, 0, 0, size, size)
  const img = ctx.getImageData(0, 0, size, size)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 18 && data[i + 1] < 18 && data[i + 2] < 18) data[i + 3] = 0
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function blurStar(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const pad = Math.ceil(radius * 3) + 2
  const c = document.createElement('canvas')
  c.width = src.width + pad * 2
  c.height = src.height + pad * 2
  const ctx = c.getContext('2d')!
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(src, pad, pad)
  ctx.filter = 'none'
  return c
}

function tintStar(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

async function loadNight(): Promise<void> {
  if (moonImg && nightBackImg) return
  const [moon, back] = await Promise.all([
    loadImage(`${WORLD_BASE}moon.png`),
    loadImage(`${WORLD_BASE}night_back.png`),
  ])
  if (moon) moonImg = moon
  if (back) nightBackImg = back
}

async function loadBeach(): Promise<void> {
  if (sunsetImg && sunsetWaterImg) return
  const [sky, water] = await Promise.all([
    loadImage(`${WORLD_BASE}sunset.png`),
    loadImage(`${WORLD_BASE}sunset_water.png`),
  ])
  if (sky) sunsetImg = sky
  if (water) sunsetWaterImg = water
}

function buildWhiteStars(raw: HTMLCanvasElement[]): void {
  if (raw.length === 0) return
  const white = (frame: HTMLCanvasElement, radius: number): StarFrame => {
    const tinted = tintStar(frame, '#ffffff')
    return { canvas: blurStar(tinted, radius), body: tinted.width }
  }
  whiteStar0 = [white(raw[0], 1.35)]
  whiteStarFrames = raw.map((frame, i) => {
    if (i === 0) return whiteStar0[0]
    return white(frame, i === 7 ? 0.95 : 1.2)
  })
}

async function loadPph(): Promise<void> {
  if (pphBg && pphBt && pphRiver1 && pphParticle) return
  const [pBg, pBt, pR1, pR2, pF1, pF2, pPart, pC1, pC2, pC3] = await Promise.all([
    loadImage(`${WORLD_BASE}pph/bg.webp`),
    loadImage(`${WORLD_BASE}pph/BT.webp`),
    loadImage(`${WORLD_BASE}pph/frontRiver01.webp`),
    loadImage(`${WORLD_BASE}pph/frontRiver02.webp`),
    loadImage(`${WORLD_BASE}pph/frontLayer01.webp`),
    loadImage(`${WORLD_BASE}pph/frontLayer02.webp`),
    loadImage(`${WORLD_BASE}pph/particle.webp`),
    loadImage(`${WORLD_BASE}pph/Cat1-Tail.webp`),
    loadImage(`${WORLD_BASE}pph/Cat2-Tail.webp`),
    loadImage(`${WORLD_BASE}pph/Cat3-Tail.webp`),
  ])
  if (pBg) pphBg = pBg
  if (pBt) pphBt = pBt
  if (pR1) pphRiver1 = pR1
  if (pR2) pphRiver2 = pR2
  if (pF1) pphFront1 = pF1
  if (pF2) pphFront2 = pF2
  if (pPart) pphParticle = pPart
  if (pC1) pphCat1 = pC1
  if (pC2) pphCat2 = pC2
  if (pC3) pphCat3 = pC3
}

export async function probeWeather(): Promise<void> {
  if (probed) {
    if (!pphBg) await loadPph()
    if (!moonImg || !nightBackImg) await loadNight()
    if (!sunsetImg || !sunsetWaterImg) await loadBeach()
    notify()
    return
  }
  probed = true

  const [
    warp,
    stars,
    h1,
    h2,
    h3,
    snowHill,
    snowCloud,
    flake,
    cloud,
    sun,
  ] = await Promise.all([
    loadImage(`${WORLD_BASE}warp_back.png`),
    loadImage(`${WORLD_BASE}stars.png`),
    loadImage(`${WORLD_BASE}hills1.png`),
    loadImage(`${WORLD_BASE}hills2.png`),
    loadImage(`${WORLD_BASE}hills3.png`),
    loadImage(`${WORLD_BASE}snowy_hill.webp`),
    loadImage(`${WORLD_BASE}snow_clouds1.webp`),
    loadImage(`${WORLD_BASE}snow_flake.webp`),
    loadImage(`${WORLD_BASE}cloud.png`),
    loadImage(`${WORLD_BASE}sun.png`),
    loadPph(),
    loadNight(),
    loadBeach(),
  ])

  if (warp) warpImg = warp
  if (h1) hill1 = cropOpaque(keyBlack(h1))
  if (h2) hill2 = cropOpaque(keyBlack(h2))
  if (h3) hill3 = cropOpaque(keyBlack(h3))
  if (snowHill) snowyHill = cropOpaque(keyBlack(snowHill))
  if (snowCloud) snowClouds = cropOpaque(keyBlack(snowCloud))
  if (flake) snowFlake = cropOpaque(keyBlack(flake))
  if (cloud) cloudImg = keyBlack(cloud)
  if (sun) sunImg = keyBlack(sun)

  if (stars) {
    const raw: HTMLCanvasElement[] = []
    for (let row = 0; row < STAR_ROWS; row++) {
      for (let col = 0; col < STAR_COLS; col++) {
        raw.push(sliceStar(stars, col, row, raw.length))
      }
    }
    star0Tints = STAR0_TINTS.map((color) => {
      const tinted = tintStar(raw[0], color)
      return { canvas: blurStar(tinted, 1.35), body: tinted.width }
    })
    starFrames = raw.map((frame, i) => {
      if (i === 0) return star0Tints[0]
      const tinted = tintStar(frame, STAR_TINTS[i % STAR_TINTS.length])
      const radius = i === 7 ? 0.95 : 1.2
      return { canvas: blurStar(tinted, radius), body: tinted.width }
    })
    buildWhiteStars(raw)
  }

  notify()
}

export const weatherAssets = {
  get warp() {
    return warpImg
  },
  get stars() {
    return starFrames
  },
  get star0() {
    return star0Tints
  },
  get hill1() {
    return hill1
  },
  get hill2() {
    return hill2
  },
  get hill3() {
    return hill3
  },
  get snowyHill() {
    return snowyHill
  },
  get snowClouds() {
    return snowClouds
  },
  get snowFlake() {
    return snowFlake
  },
  get cloud() {
    return cloudImg
  },
  get sun() {
    return sunImg
  },
  get moon() {
    return moonImg
  },
  get nightBack() {
    return nightBackImg
  },
  get sunset() {
    return sunsetImg
  },
  get sunsetWater() {
    return sunsetWaterImg
  },
  get whiteStars() {
    return whiteStarFrames
  },
  get whiteStar0() {
    return whiteStar0
  },
  get pphBg() {
    return pphBg
  },
  get pphBt() {
    return pphBt
  },
  get pphRiver1() {
    return pphRiver1
  },
  get pphRiver2() {
    return pphRiver2
  },
  get pphFront1() {
    return pphFront1
  },
  get pphFront2() {
    return pphFront2
  },
  get pphParticle() {
    return pphParticle
  },
  get pphCat1() {
    return pphCat1
  },
  get pphCat2() {
    return pphCat2
  },
  get pphCat3() {
    return pphCat3
  },
}
