/** Resize a canvas backing store only when CSS size or DPR actually changed. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): { width: number; height: number; dpr: number } {
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.floor(cssWidth * dpr))
  const nextH = Math.max(1, Math.floor(cssHeight * dpr))
  if (canvas.width !== nextW) canvas.width = nextW
  if (canvas.height !== nextH) canvas.height = nextH
  return { width: cssWidth, height: cssHeight, dpr }
}
