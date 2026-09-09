import { hash2, weatherAssets } from './assets'
import type { WeatherDef } from './types'

const SKY = '#27EBF5'

function drawHillStrip(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
  parallax: number,
  cover: number,
): void {
  const dh = height * cover
  const dw = img.width * (dh / img.height)
  const shift = ((cameraX * zoom * parallax) % dw + dw) % dw
  const y = height - dh
  ctx.imageSmoothingEnabled = true
  for (let x = -shift; x < width + dw; x += dw) {
    ctx.drawImage(img, x, y, dw, dh)
  }
}

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

export const sunnyWeather: WeatherDef = {
  id: 'sunny',
  label: 'Sunny',
  dark: false,
  animated: true,
  draw(ctx, width, height, cameraX, zoom) {
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#14d4e8')
    sky.addColorStop(0.45, SKY)
    sky.addColorStop(1, '#7af3fb')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true

    const sun = weatherAssets.sun
    if (sun) {
      const sunS = Math.min(480, Math.max(280, height * 0.5))
      const sunH = sunS * (sun.height / sun.width)
      ctx.drawImage(sun, width - sunS * 0.82, -sunH * 0.16, sunS, sunH)
    }

    const cloud = weatherAssets.cloud
    const t = performance.now() / 1000
    // High layers sit on top of each hill. Lower dups tuck behind the same hill.
    const cloud3: CloudLayer = {
      count: 5,
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
    const cloud3dup: CloudLayer = {
      count: 4,
      seed: 511,
      scaleMin: 0.56,
      scaleRange: 0.12,
      speedMin: 4,
      speedRange: 3,
      yMin: height * 0.1,
      ySpan: height * 0.14,
      alphaMin: 0.4,
      alphaRange: 0.18,
      pad: 440,
      parallax: 0.07,
    }
    const cloud2: CloudLayer = {
      count: 5,
      seed: 203,
      scaleMin: 0.66,
      scaleRange: 0.14,
      speedMin: 9,
      speedRange: 6,
      yMin: height * 0.2,
      ySpan: height * 0.16,
      alphaMin: 0.62,
      alphaRange: 0.2,
      pad: 360,
      parallax: 0.2,
    }
    const cloud2dup: CloudLayer = {
      count: 4,
      seed: 419,
      scaleMin: 0.6,
      scaleRange: 0.12,
      speedMin: 7,
      speedRange: 5,
      yMin: height * 0.28,
      ySpan: height * 0.16,
      alphaMin: 0.48,
      alphaRange: 0.18,
      pad: 380,
      parallax: 0.16,
    }
    const cloud1: CloudLayer = {
      count: 4,
      seed: 97,
      scaleMin: 0.7,
      scaleRange: 0.14,
      speedMin: 14,
      speedRange: 8,
      yMin: height * 0.5,
      ySpan: height * 0.22,
      alphaMin: 0.82,
      alphaRange: 0.14,
      pad: 280,
      parallax: 0.36,
    }
    const cloud1dup: CloudLayer = {
      count: 4,
      seed: 173,
      scaleMin: 0.64,
      scaleRange: 0.12,
      speedMin: 11,
      speedRange: 6,
      yMin: height * 0.56,
      ySpan: height * 0.18,
      alphaMin: 0.58,
      alphaRange: 0.16,
      pad: 300,
      parallax: 0.3,
    }

    if (cloud) drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, cloud3dup)
    if (weatherAssets.hill3) drawHillStrip(ctx, weatherAssets.hill3, width, height, cameraX, zoom, 0.06, 0.9)
    if (cloud) drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, cloud3)
    if (cloud) drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, cloud2dup)
    if (weatherAssets.hill2) drawHillStrip(ctx, weatherAssets.hill2, width, height, cameraX, zoom, 0.14, 0.72)
    if (cloud) drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, cloud2)
    if (cloud) drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, cloud1dup)
    if (weatherAssets.hill1) drawHillStrip(ctx, weatherAssets.hill1, width, height, cameraX, zoom, 0.26, 0.34)
    if (cloud) drawCloudLayer(ctx, cloud, width, cameraX, zoom, t, cloud1)
    ctx.imageSmoothingEnabled = false
  },
}
