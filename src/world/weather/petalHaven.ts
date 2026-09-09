import { weatherAssets } from './assets'
import type { WeatherDef } from './types'

const FRAME = 2048

type Src = { sx: number; sy: number; sw: number; sh: number }
type Space = { x: number; y: number; scale: number }
type Layer = { img: HTMLImageElement; ox: number; oy: number }

const srcCache = new WeakMap<HTMLImageElement, Src>()

function opaqueBox(img: HTMLImageElement): Src | null {
  const cached = srcCache.get(img)
  if (cached) return cached
  if (!img.width || !img.height) return null
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 12) continue
      if (data[i] < 18 && data[i + 1] < 18 && data[i + 2] < 18) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return null
  const src = { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 }
  srcCache.set(img, src)
  return src
}

function layerOrigin(img: HTMLImageElement): { ox: number; oy: number } {
  return { ox: 0, oy: img.height < FRAME ? (FRAME - img.height) / 2 : 0 }
}

function unionBox(layers: Layer[]): Src | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { img, ox, oy } of layers) {
    const src = opaqueBox(img)
    if (!src) continue
    minX = Math.min(minX, ox + src.sx)
    minY = Math.min(minY, oy + src.sy)
    maxX = Math.max(maxX, ox + src.sx + src.sw)
    maxY = Math.max(maxY, oy + src.sy + src.sh)
  }
  if (!Number.isFinite(minX)) return null
  return { sx: minX, sy: minY, sw: maxX - minX, sh: maxY - minY }
}

function fitSpace(width: number, height: number, src: Src): Space {
  const scale = Math.max(width / src.sw, height / src.sh) * 1.08
  return {
    x: (width - src.sw * scale) / 2 - src.sx * scale,
    y: (height - src.sh * scale) / 2 - src.sy * scale,
    scale,
  }
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  space: Space,
  scaleMul = 1,
  lift = 0,
): void {
  const src = opaqueBox(layer.img)
  if (!src) return
  const s = space.scale * scaleMul
  const xShift = ((1 - scaleMul) * FRAME * space.scale) / 2
  ctx.drawImage(
    layer.img,
    src.sx,
    src.sy,
    src.sw,
    src.sh,
    space.x + xShift + (layer.ox + src.sx) * s,
    space.y + (layer.oy + src.sy - lift) * s,
    src.sw * s,
    src.sh * s,
  )
}

export const petalHavenWeather: WeatherDef = {
  id: 'petal-haven',
  label: 'Petal Purrfect Haven',
  dark: false,
  draw(ctx, width, height) {
    ctx.imageSmoothingEnabled = true
    if (weatherAssets.pphBg) {
      ctx.drawImage(weatherAssets.pphBg, 0, 0, width, height)
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#f4f1e4')
      sky.addColorStop(0.45, '#d5dd9a')
      sky.addColorStop(1, '#7aa8a4')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)
    }

    const bt = weatherAssets.pphBt
    const river = weatherAssets.pphRiver1
    const front2 = weatherAssets.pphFront2
    const plate: Layer[] = []
    if (bt) plate.push({ img: bt, ...layerOrigin(bt) })
    if (front2) plate.push({ img: front2, ...layerOrigin(front2) })

    const bounds = unionBox(plate)
    if (bounds) {
      const space = fitSpace(width, height, bounds)
      if (bt) drawLayer(ctx, { img: bt, ...layerOrigin(bt) }, space)
      if (river) drawLayer(ctx, { img: river, ...layerOrigin(river) }, space, 0.86, 160)
      if (front2) drawLayer(ctx, { img: front2, ...layerOrigin(front2) }, space)
    }
    ctx.imageSmoothingEnabled = false
  },
}
