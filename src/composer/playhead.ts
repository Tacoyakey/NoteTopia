export const PLAYHEAD_COLOR = '#ff5a73'

export function drawPlayheadLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number,
  color = PLAYHEAD_COLOR,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.stroke()
}

export function drawPlayheadCaret(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color = PLAYHEAD_COLOR,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x - 7, y)
  ctx.lineTo(x + 7, y)
  ctx.lineTo(x, y + 12)
  ctx.closePath()
  ctx.fill()
}

export function hitPlayheadCaret(px: number, py: number, playheadX: number, caretY = 0): boolean {
  return Math.abs(px - playheadX) <= 10 && py >= caretY - 2 && py <= caretY + 18
}
