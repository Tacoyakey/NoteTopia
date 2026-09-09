import { useLayoutEffect, useState, type RefObject } from 'react'
import {
  naturalSectionWidth,
  pickToolbarPack,
  toolbarInnerWidth,
  type ToolbarPack,
} from './toolbarFit'

export function useToolbarFit(toolbarRef: RefObject<HTMLElement | null>, fitKey = ''): ToolbarPack {
  const [pack, setPack] = useState<ToolbarPack>('comfortable')

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    let frame = 0
    const run = () => {
      const left = toolbar.querySelector('.toolbar-left') as HTMLElement | null
      const center = toolbar.querySelector('.toolbar-center') as HTMLElement | null
      const right = toolbar.querySelector('.toolbar-right') as HTMLElement | null
      if (!left || !center || !right) return
      const { inner, gap } = toolbarInnerWidth(toolbar)
      setPack((current) =>
        pickToolbarPack({
          inner,
          left: naturalSectionWidth(left),
          center: naturalSectionWidth(center),
          right: naturalSectionWidth(right),
          gap,
          current,
        }),
      )
    }
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(run)
    }

    run()
    const ro = new ResizeObserver(measure)
    ro.observe(toolbar)
    const mo = new MutationObserver(measure)
    mo.observe(toolbar, { subtree: true, childList: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      mo.disconnect()
    }
  }, [toolbarRef, fitKey])

  return pack
}
