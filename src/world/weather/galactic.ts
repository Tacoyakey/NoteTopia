import { hash2, weatherAssets, type StarFrame } from './assets'
import type { WeatherDef } from './types'

export function drawGalacticFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#000000')
  sky.addColorStop(0.1, '#02040e')
  sky.addColorStop(0.32, '#071433')
  sky.addColorStop(0.46, '#1238b8')
  sky.addColorStop(0.54, '#1c55e8')
  sky.addColorStop(0.66, '#0a1c58')
  sky.addColorStop(1, '#030712')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)
}

export function drawWarp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
  opts?: { parallax?: number; drift?: number },
): boolean {
  const warp = weatherAssets.warp
  if (!warp) return false
  const scale = height / warp.height
  const dw = Math.max(width, warp.width * scale)
  const t = performance.now() / 1000
  const par =
    ((cameraX * zoom * (opts?.parallax ?? 0.08) + t * (opts?.drift ?? 0)) % dw + dw) % dw
  ctx.imageSmoothingEnabled = true
  for (let x = -par; x < width + dw; x += dw) {
    ctx.drawImage(warp, 0, 0, warp.width, warp.height, x, 0, dw, height)
  }
  ctx.imageSmoothingEnabled = false
  return true
}

function drawSkyBand(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const band = ctx.createLinearGradient(0, 0, 0, height)
  band.addColorStop(0, 'rgba(0, 0, 0, 0)')
  band.addColorStop(0.36, 'rgba(20, 50, 180, 0)')
  band.addColorStop(0.48, 'rgba(40, 100, 255, 0.18)')
  band.addColorStop(0.55, 'rgba(70, 130, 255, 0.28)')
  band.addColorStop(0.64, 'rgba(30, 70, 210, 0.08)')
  band.addColorStop(0.78, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = band
  ctx.fillRect(0, 0, width, height)
}

function drawSpecks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
  white = false,
  parallaxMul = 1,
): void {
  const par = cameraX * zoom * parallaxMul
  const span = Math.max(width + 80, 720)
  ctx.imageSmoothingEnabled = false
  for (let i = 0; i < 160; i++) {
    const n = hash2(i, 9)
    const layer = 1 + (n % 3)
    const x = (((n % 9973) / 9973) * span - (par * (0.02 + layer * 0.03)) % span + span) % span
    const y = 4 + ((hash2(i, 71) % 10007) / 10007) * Math.max(8, height - 8)
    const warm = !white && n % 11 === 0
    ctx.fillStyle = warm ? 'rgba(255, 236, 170, 0.9)' : 'rgba(255, 255, 255, 0.82)'
    const s = (n % 8 === 0 ? 2 : 1) * 1.1
    ctx.fillRect(x, y, s, s)
    if (n % 13 === 0) {
      const arm = 1 + (n % 2)
      ctx.globalAlpha = 0.7
      ctx.fillRect(x - arm, y, arm * 2 + s, s)
      ctx.fillRect(x, y - arm, s, arm * 2 + s)
      ctx.globalAlpha = 1
    }
  }
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
  frames: StarFrame[],
  opts?: { rotateMul?: number; drift?: number; sparkle0?: StarFrame[]; white?: boolean; parallaxMul?: number },
): void {
  const parallaxMul = opts?.parallaxMul ?? 1
  drawSpecks(ctx, width, height, cameraX, zoom, opts?.white, parallaxMul)
  if (frames.length === 0) return
  const sparkle0 = opts?.sparkle0 ?? weatherAssets.star0
  const par = cameraX * zoom * parallaxMul
  const span = Math.max(width + 160, 960)
  const t = performance.now() / 1000
  const rotateMul = opts?.rotateMul ?? 1
  const drift = opts?.drift ?? 0
  ctx.imageSmoothingEnabled = true
  for (let i = 0; i < 72; i++) {
    const n = hash2(i, 41)
    const useSparkle0 = sparkle0.length > 0 && n % 5 === 0
    const variant = 1 + (n % Math.min(6, Math.max(1, frames.length - 2)))
    const frame = useSparkle0 ? sparkle0[hash2(i, 19) % sparkle0.length] : frames[variant]
    const layer = 1 + (n % 3)
    const fly = drift * (0.72 + layer * 0.28 + (n % 7) * 0.05)
    const base = ((n % 9973) / 9973) * span
    const x = (((base - t * fly - par * (0.03 + layer * 0.04)) % span) + span) % span - 40
    const y = 8 + ((hash2(i, 77) % 10007) / 10007) * Math.max(16, height - 24)
    const body = frame.body * (useSparkle0 ? 0.42 : 0.38 + (n % 4) * 0.08)
    const dw = body * (frame.canvas.width / frame.body)
    const twinkle = 0.72 + 0.28 * Math.sin(t * (0.9 + (n % 6) * 0.25) + (n % 50))
    ctx.save()
    ctx.globalAlpha = (useSparkle0 ? 0.92 : 0.55 + layer * 0.12) * twinkle
    ctx.translate(x + body / 2, y + body / 2)
    if (rotateMul > 0) {
      const dir = n % 2 === 0 ? 1 : -1
      const speed = (0.18 + (n % 11) * 0.05) * dir * rotateMul
      ctx.rotate((n % 628) / 100 + t * speed)
    }
    ctx.drawImage(frame.canvas, -dw / 2, -dw / 2, dw, dw)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.imageSmoothingEnabled = false
}

export const galacticWeather: WeatherDef = {
  id: 'galactic',
  label: 'Stargazing',
  dark: true,
  animated: true,
  draw(ctx, width, height, cameraX, zoom) {
    if (!drawWarp(ctx, width, height, cameraX, zoom, { parallax: 0.06 })) {
      drawGalacticFallback(ctx, width, height)
    }
    drawSkyBand(ctx, width, height)
    drawStars(ctx, width, height, cameraX, zoom, weatherAssets.stars, { rotateMul: 1 })
  },
}
