import { weatherAssets } from './assets'
import { drawHillStrip, drawTopStrip, SNOW_CLOUD_COVER } from './landscape'
import type { WeatherDef } from './types'

const SKY = '#27EBF5'

export const snowyWeather: WeatherDef = {
  id: 'snowy',
  label: 'Snowy',
  dark: false,
  draw(ctx, width, height, cameraX, zoom) {
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#14d4e8')
    sky.addColorStop(0.45, SKY)
    sky.addColorStop(1, '#7af3fb')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true

    if (weatherAssets.snowyHill) drawHillStrip(ctx, weatherAssets.snowyHill, width, height, cameraX, zoom, 0.06, 0.9)
    if (weatherAssets.hill2) drawHillStrip(ctx, weatherAssets.hill2, width, height, cameraX, zoom, 0.14, 0.72)
    if (weatherAssets.hill1) drawHillStrip(ctx, weatherAssets.hill1, width, height, cameraX, zoom, 0.26, 0.34)
    ctx.imageSmoothingEnabled = false
  },
  overlay(ctx, width, height, cameraX, zoom) {
    if (!weatherAssets.snowClouds) return
    drawTopStrip(ctx, weatherAssets.snowClouds, width, height, cameraX, zoom, 0.05, SNOW_CLOUD_COVER)
    ctx.imageSmoothingEnabled = false
  },
}
