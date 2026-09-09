export const SNOW_CLOUD_COVER = 0.14
export const NIGHT_SKY = '#111218'

export function drawHillStrip(
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

export function drawTopStrip(
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
  ctx.imageSmoothingEnabled = true
  for (let x = -shift; x < width + dw; x += dw) {
    ctx.drawImage(img, x, 0, dw, dh)
  }
}

const nightTinted = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

/** Keep hill shape, wash it with the night sky color. Clouds stay untouched. */
export function nightHill(src: HTMLCanvasElement, color = NIGHT_SKY): HTMLCanvasElement {
  const cached = nightTinted.get(src)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.globalAlpha = 0.78
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  nightTinted.set(src, c)
  return c
}
