import { useCallback, useRef } from 'react'

/** Drag a bottom sheet down to close. Cheap: one transform, no layout. */
export function useSwipeToDismiss(onDismiss: () => void, threshold = 96) {
  const startY = useRef(0)
  const dragging = useRef(false)
  const nodeRef = useRef<HTMLDivElement>(null)

  const settle = useCallback((dy: number) => {
    const el = nodeRef.current
    if (!el) return
    const go = dy > threshold
    el.style.transition = `transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)`
    el.style.transform = go ? `translateY(${Math.max(el.offsetHeight, dy + 48)}px)` : ''
    if (go) {
      window.setTimeout(onDismiss, 240)
    } else {
      window.setTimeout(() => {
        if (el) el.style.transition = ''
      }, 320)
    }
  }, [onDismiss, threshold])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const fromHandle = !!target.closest('.phone-sheet-handle')
    const sheetTop = e.currentTarget.getBoundingClientRect().top
    if (!fromHandle && e.clientY - sheetTop > 36) return
    dragging.current = true
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    const el = nodeRef.current
    if (el) el.style.transition = 'none'
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const dy = Math.max(0, e.clientY - startY.current)
    const el = nodeRef.current
    if (el) el.style.transform = `translateY(${dy}px)`
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    settle(Math.max(0, e.clientY - startY.current))
  }, [settle])

  return { nodeRef, onPointerDown, onPointerMove, onPointerUp }
}
