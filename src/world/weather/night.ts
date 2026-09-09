import { weatherAssets } from './assets'
import { drawStars } from './galactic'
import { drawHillStrip } from './landscape'
import type { WeatherDef } from './types'

function drawNightBack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const bg = weatherAssets.nightBack
  if (!bg) {
    ctx.fillStyle = '#02040e'
    ctx.fillRect(0, 0, width, height)
    return
  }
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(bg, 0, 0, width, height)
}

function drawBlackHills(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
): void {
  ctx.save()
  ctx.filter = 'brightness(0)'
  if (weatherAssets.hill3) drawHillStrip(ctx, weatherAssets.hill3, width, height, cameraX, zoom, 0.06, 0.9)
  if (weatherAssets.hill2) drawHillStrip(ctx, weatherAssets.hill2, width, height, cameraX, zoom, 0.14, 0.72)
  if (weatherAssets.hill1) drawHillStrip(ctx, weatherAssets.hill1, width, height, cameraX, zoom, 0.26, 0.34)
  ctx.restore()
}

export const nightWeather: WeatherDef = {
  id: 'night',
  label: 'Night',
  dark: true,
  animated: true,
  draw(ctx, width, height, cameraX, zoom) {
    drawNightBack(ctx, width, height)

    const starFrames = weatherAssets.whiteStars.length > 0 ? weatherAssets.whiteStars : weatherAssets.stars
    drawStars(ctx, width, height, cameraX, zoom, starFrames, {
      rotateMul: 1,
      sparkle0: weatherAssets.whiteStar0.length > 0 ? weatherAssets.whiteStar0 : undefined,
      white: true,
      parallaxMul: 0.12,
    })

    const moon = weatherAssets.moon
    if (moon) {
      const moonS = Math.min(480, Math.max(280, height * 0.5)) * 0.75
      const moonH = moonS * (moon.height / moon.width)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(moon, -moonS * 0.18, -moonH * 0.16, moonS, moonH)
    }

    drawBlackHills(ctx, width, height, cameraX, zoom)
    ctx.imageSmoothingEnabled = false
  },
}
