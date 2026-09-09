const VAR = '--app-height'

/** Visible CSS px, excluding iOS Safari chrome when visualViewport exists. */
export function visibleViewportHeight(win: {
  innerHeight: number
  visualViewport?: { height: number } | null
}): number {
  const visual = win.visualViewport?.height
  return Math.round(visual && visual > 0 ? visual : win.innerHeight)
}

export function applyAppViewportHeight(root: CSSStyleDeclaration, height: number): void {
  root.setProperty(VAR, `${height}px`)
}
