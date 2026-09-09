export type ViewBox = { left: number; top: number; width: number; height: number }

export function viewportBox(): ViewBox {
  const view = typeof window === 'undefined' ? undefined : window.visualViewport
  if (view) {
    return { left: view.offsetLeft, top: view.offsetTop, width: view.width, height: view.height }
  }
  if (typeof window === 'undefined') return { left: 0, top: 0, width: 390, height: 844 }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
}

export function clampPopover(
  left: number,
  top: number,
  width: number,
  height: number,
  view: ViewBox,
  pad = 8,
): { left: number; top: number } {
  const maxLeft = view.left + view.width - width - pad
  const maxTop = view.top + view.height - height - pad
  return {
    left: Math.min(Math.max(left, view.left + pad), Math.max(view.left + pad, maxLeft)),
    top: Math.min(Math.max(top, view.top + pad), Math.max(view.top + pad, maxTop)),
  }
}

export function placePopover(opts: {
  trigger: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
  width: number
  height: number
  align?: 'left' | 'right'
  drop?: 'up' | 'down'
  gap?: number
  pad?: number
  view?: ViewBox
}): { left: number; top: number } {
  const gap = opts.gap ?? 6
  const pad = opts.pad ?? 8
  const view = opts.view ?? viewportBox()
  let left = opts.align === 'right' ? opts.trigger.right - opts.width : opts.trigger.left
  let top =
    opts.drop === 'up' ? opts.trigger.top - opts.height - gap : opts.trigger.bottom + gap
  if (opts.drop === 'up' && top < view.top + pad) top = opts.trigger.bottom + gap
  else if (opts.drop !== 'up' && top + opts.height > view.top + view.height - pad) {
    top = opts.trigger.top - opts.height - gap
  }
  return clampPopover(left, top, opts.width, opts.height, view, pad)
}
