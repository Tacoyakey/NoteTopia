import { hash2, weatherAssets } from './assets'
import { drawHillStrip, drawTopStrip, nightHill, NIGHT_SKY, SNOW_CLOUD_COVER } from './landscape'
import type { WeatherDef } from './types'

function drawSnowFlakes(
  ctx: CanvasRenderingContext2D,
  flake: HTMLCanvasElement,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
): void {
  const cloudH = height * SNOW_CLOUD_COVER
  const startY = cloudH * 0.38
  const fall = Math.max(80, height - startY + 16)
  const count = Math.max(140, Math.round((width * height) / 4000))
  const t = performance.now() / 1000
  const par = cameraX * zoom * 0.05
  const span = width + 40
  ctx.imageSmoothingEnabled = false
  for (let i = 0; i < count; i++) {
    const n = hash2(i, 73)
    const size = 6 + (n % 4)
    const speed = 16 + (n % 17)
    const sway = 10 + (n % 9)
    const phase = (n % 6283) / 1000
    const x0 = ((n % 10007) / 10007) * span
    const y = startY + ((t * speed + (n % 997)) % fall)
    const xRaw = x0 + Math.sin(t * (0.55 + (n % 5) * 0.12) + phase) * sway - par
    const x = ((xRaw % span) + span) % span - 20
    ctx.globalAlpha = 0.72 + ((n % 5) / 4) * 0.22
    ctx.drawImage(flake, x, y, size, size)
  }
  ctx.globalAlpha = 1
  ctx.imageSmoothingEnabled = false
}

export const snowyNightWeather: WeatherDef = {
  id: 'snowy-night',
  label: 'Snowy Night',
  dark: true,
  animated: true,
  draw(ctx, width, height, cameraX, zoom) {
    ctx.fillStyle = NIGHT_SKY
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true

    const back = weatherAssets.snowyHill
    const mid = weatherAssets.hill2
    const front = weatherAssets.hill1
    if (back) drawHillStrip(ctx, nightHill(back), width, height, cameraX, zoom, 0.06, 0.9)
    if (mid) drawHillStrip(ctx, nightHill(mid), width, height, cameraX, zoom, 0.14, 0.72)
    if (front) drawHillStrip(ctx, nightHill(front), width, height, cameraX, zoom, 0.26, 0.34)
    ctx.imageSmoothingEnabled = false
  },
  overlay(ctx, width, height, cameraX, zoom) {
    if (weatherAssets.snowFlake) {
      drawSnowFlakes(ctx, weatherAssets.snowFlake, width, height, cameraX, zoom)
    }
    if (weatherAssets.snowClouds) {
      drawTopStrip(ctx, weatherAssets.snowClouds, width, height, cameraX, zoom, 0.05, SNOW_CLOUD_COVER)
    }
    ctx.imageSmoothingEnabled = false
  },
}
