import { hash2, weatherAssets } from './assets'
import type { WeatherDef } from './types'

/** Native sun aspect — only the top half sits above the water. */
const SUN_SQUISH = 1
const SUN_SCALE = 1.1
const HORIZON = 0.5
/** Skip the baked sun sliver at the top of sunset_water.png. */
const WATER_SRC_TOP = 0.06

type CloudLayer = {
  count: number
  seed: number
  scaleMin: number
  scaleRange: number
  speedMin: number
  speedRange: number
  yMin: number
  ySpan: number
  alphaMin: number
  alphaRange: number
  pad: number
  parallax: number
}

const tinted = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

function tintSourceAtop(src: HTMLCanvasElement, color: string, alpha: number): HTMLCanvasElement {
  const cached = tinted.get(src)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  tinted.set(src, c)
  return c
}

let beachSun: HTMLCanvasElement | null = null

function getBeachSun(src: HTMLCanvasElement): HTMLCanvasElement {
  if (beachSun) return beachSun
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  const g = ctx.createLinearGradient(0, 0, 0, c.height)
  g.addColorStop(0, '#ff3d08')
  g.addColorStop(0.38, '#ff8610')
  g.addColorStop(0.7, '#ffd43a')
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  beachSun = c
  return c
}

function drawCloudLayer(
  ctx: CanvasRenderingContext2D,
  cloud: HTMLCanvasElement,
  width: number,
  cameraX: number,
  zoom: number,
  t: number,
  layer: CloudLayer,
): void {
  const ySpan = Math.max(8, layer.ySpan)
  for (let i = 0; i < layer.count; i++) {
    const n = hash2(i, layer.seed)
    const scale = layer.scaleMin + ((n % 7) / 6) * layer.scaleRange
    const cw = cloud.width * scale
    const ch = cloud.height * scale
    const span = Math.max(width + cw + layer.pad, 2200)
    const speed = layer.speedMin + ((n % 8) / 7) * layer.speedRange
    const base = ((n % 7919) / 7919) * span
    const scroll = cameraX * zoom * layer.parallax
    const x = (((base + t * speed - scroll) % span) + span) % span - cw
    const y = layer.yMin + (hash2(i, layer.seed + 17) % ySpan)
    ctx.globalAlpha = layer.alphaMin + ((n % 5) / 4) * layer.alphaRange
    ctx.drawImage(cloud, x, y, cw, ch)
  }
  ctx.globalAlpha = 1
}

function drawSunsetSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const skyH = height * HORIZON
  const bg = weatherAssets.sunset
  if (!bg) {
    const sky = ctx.createLinearGradient(0, 0, 0, skyH)
    sky.addColorStop(0, '#1a1a6a')
    sky.addColorStop(0.35, '#c41e7a')
    sky.addColorStop(0.7, '#e85a20')
    sky.addColorStop(1, '#ffc44a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, skyH)
    return
  }
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(bg, 0, 0, width, skyH)
}

function drawWater(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const water = weatherAssets.sunsetWater
  if (!water) return
  const horizon = height * HORIZON
  const srcY = water.height * WATER_SRC_TOP
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(water, 0, srcY, water.width, water.height - srcY, 0, horizon, width, height - horizon)
}

export const beachWeather: WeatherDef = {
  id: 'beach',
  label: 'Beach',
  dark: false,
  animated: true,
  draw(ctx, width, height, cameraX, zoom) {
    drawSunsetSky(ctx, width, height)

    const cloudSrc = weatherAssets.cloud
    const cloud = cloudSrc ? tintSourceAtop(cloudSrc, '#ffc44a', 0.52) : null
    const t = performance.now() / 1000
    const high: CloudLayer = {
      count: 4,
      seed: 311,
      scaleMin: 0.62,
      scaleRange: 0.14,
      speedMin: 5,
      speedRange: 4,
      yMin: height * 0.04,
      ySpan: height * 0.16,
      alphaMin: 0.55,
      alphaRange: 0.22,
      pad: 420,
      parallax: 0.1,
    }
    const mid: CloudLayer = {
      count: 3,
      seed: 203,
      scaleMin: 0.66,
      scaleRange: 0.14,
      speedMin: 9,
      speedRange: 6,
      yMin: height * 0.18,
      ySpan: height * 0.16,
      alphaMin: 0.58,
      alphaRange: 0.2,
      pad: 360,
      parallax: 0.2,
    }

    if (cloud) {
      ctx.imageSmoothingEnabled = true
      drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, high)
      drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, mid)
    }

    const sunSrc = weatherAssets.sun
    if (sunSrc) {
      const sun = getBeachSun(sunSrc)
      const sunS = Math.min(480, Math.max(280, height * 0.5)) * SUN_SCALE
      const sunH = sunS * (sun.height / sun.width) * SUN_SQUISH
      const horizon = height * HORIZON
      ctx.imageSmoothingEnabled = true
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, width, horizon)
      ctx.clip()
      ctx.drawImage(sun, (width - sunS) / 2, horizon - sunH * 0.5, sunS, sunH)
      ctx.restore()
    }

    drawWater(ctx, width, height)
    ctx.imageSmoothingEnabled = false
  },
}
