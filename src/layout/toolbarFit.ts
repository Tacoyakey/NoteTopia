export type ToolbarPack = 'comfortable' | 'stacked' | 'compact'

/** Wrap a bit before the sides actually collide. */
export const TOOLBAR_FIT_SLACK = 96
/** Extra room required before collapsing back to one row (avoids flicker). */
export const TOOLBAR_FIT_HYST = 64

export function pickToolbarPack({
  inner,
  left,
  center,
  right,
  end = 0,
  gap = 12,
  slack = TOOLBAR_FIT_SLACK,
  hyst = TOOLBAR_FIT_HYST,
  current,
}: {
  inner: number
  left: number
  center: number
  right: number
  end?: number
  gap?: number
  slack?: number
  hyst?: number
  current: ToolbarPack
}): ToolbarPack {
  // One row: left | playback | tools. Two rows: left + tools on top, playback below.
  const endGap = end > 0 ? gap : 0
  const oneRow = left + center + right + end + 2 * gap + endGap
  const twoRow = left + right + end + gap + endGap

  const fitsOne = (extra: number) => oneRow + extra <= inner
  const fitsTwo = (extra: number) => twoRow + extra <= inner

  if (current === 'comfortable') {
    if (fitsOne(slack)) return 'comfortable'
    if (fitsTwo(slack)) return 'stacked'
    return 'compact'
  }
  if (current === 'stacked') {
    if (fitsOne(slack + hyst)) return 'comfortable'
    if (fitsTwo(slack)) return 'stacked'
    return 'compact'
  }
  if (fitsOne(slack + hyst)) return 'comfortable'
  if (fitsTwo(slack + hyst)) return 'stacked'
  return 'compact'
}

export function toolbarInnerWidth(toolbar: HTMLElement): { inner: number; gap: number } {
  const styles = getComputedStyle(toolbar)
  const pad = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
  const gap = parseFloat(styles.columnGap || styles.gap) || 12
  return { inner: Math.max(0, toolbar.clientWidth - pad), gap }
}

function showForMeasure(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(
    '.btn-icon-label, .mode-btn span, .app-logo-text, .app-logo-by, .tool-dropdown-label',
  ).forEach((el) => {
    el.style.display = 'inline'
  })
  root.querySelectorAll('.toolbar-menu-list').forEach((el) => el.remove())
  root.querySelectorAll('[hidden]').forEach((el) => el.remove())
}

/** Intrinsic width of a toolbar section as if labels were visible. */
export function naturalSectionWidth(section: HTMLElement): number {
  const clone = section.cloneNode(true) as HTMLElement
  clone.classList.remove('is-stacked', 'is-compact')
  clone.setAttribute('aria-hidden', 'true')
  clone.style.cssText =
    'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;display:flex;align-items:center;width:max-content;height:auto;max-width:none'
  showForMeasure(clone)
  document.body.appendChild(clone)
  const width = clone.scrollWidth
  clone.remove()
  return width
}
