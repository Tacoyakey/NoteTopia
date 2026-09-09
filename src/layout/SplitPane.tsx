import { useCallback, useRef, type ReactNode } from 'react'
import { GripHorizontal, GripVertical, Maximize2, Minimize2 } from '../components/icons'
import { useT } from '../i18n/LanguageProvider'
import { runMiniaturize } from './miniaturize'

interface SplitPaneProps {
  axis?: 'y' | 'x'
  ratio: number
  onRatio: (ratio: number) => void
  minA?: number
  minB?: number
  collapsedA: boolean
  collapsedB: boolean
  onToggleA: () => void
  onToggleB: () => void
  labelA: string
  labelB: string
  first: ReactNode
  second: ReactNode
}

export function SplitPane({
  axis = 'y',
  ratio,
  onRatio,
  minA = 120,
  minB = 140,
  collapsedA,
  collapsedB,
  onToggleA,
  onToggleB,
  labelA,
  labelB,
  first,
  second,
}: SplitPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const vertical = axis === 'y'
  const { t } = useT()
  const toggleA = () => runMiniaturize(onToggleA)
  const toggleB = () => runMiniaturize(onToggleB)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      e.preventDefault()
      const rect = root.getBoundingClientRect()
      const size = vertical ? rect.height : rect.width
      const start = vertical ? e.clientY : e.clientX
      const startRatio = ratio
      const handle = e.currentTarget as HTMLElement
      handle.setPointerCapture(e.pointerId)

      const move = (ev: PointerEvent) => {
      const pos = vertical ? ev.clientY : ev.clientX
      const next = (startRatio * size + (pos - start)) / size
        const minR = minA / size
        const maxR = 1 - minB / size
        onRatio(Math.max(minR, Math.min(maxR, next)))
      }
      const up = () => {
        handle.releasePointerCapture(e.pointerId)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [minA, minB, onRatio, ratio, vertical],
  )

  if (collapsedA && collapsedB) {
    return (
      <div className={`split-pane ${vertical ? 'split-y' : 'split-x'}`} ref={rootRef}>
        <div className="split-minibar">
          <button type="button" className="split-vt-a" onClick={toggleA}>
            <Maximize2 size={14} /> {labelA}
          </button>
          <button type="button" className="split-vt-b" onClick={toggleB}>
            <Maximize2 size={14} /> {labelB}
          </button>
        </div>
      </div>
    )
  }

  if (collapsedA) {
    return (
      <div className={`split-pane ${vertical ? 'split-y' : 'split-x'}`} ref={rootRef}>
        <div className="split-minibar split-vt-a">
          <span>{labelA}</span>
          <button type="button" title={t('ui.showPanel', { name: labelA })} onClick={toggleA}>
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="split-fill split-vt-b">
          <div className="split-panel-head">
            <span>{labelB}</span>
            <button type="button" title={t('ui.minimizePanel', { name: labelB })} onClick={toggleB}>
              <Minimize2 size={14} />
            </button>
          </div>
          <div className="split-fill-body">{second}</div>
        </div>
      </div>
    )
  }

  if (collapsedB) {
    return (
      <div className={`split-pane ${vertical ? 'split-y' : 'split-x'}`} ref={rootRef}>
        <div className="split-fill split-vt-a">
          <div className="split-panel-head">
            <span>{labelA}</span>
            <button type="button" title={t('ui.minimizePanel', { name: labelA })} onClick={toggleA}>
              <Minimize2 size={14} />
            </button>
          </div>
          <div className="split-fill-body">{first}</div>
        </div>
        <div className="split-minibar split-vt-b">
          <span>{labelB}</span>
          <button type="button" title={t('ui.showPanel', { name: labelB })} onClick={toggleB}>
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  const aStyle = vertical ? { flex: `0 0 ${ratio * 100}%` } : { flex: `0 0 ${ratio * 100}%` }

  return (
    <div className={`split-pane ${vertical ? 'split-y' : 'split-x'}`} ref={rootRef}>
      <div className="split-pane-a" style={aStyle}>
        <div className="split-panel-head">
          <span>{labelA}</span>
          <button type="button" title={t('ui.minimizePanel', { name: labelA })} onClick={toggleA}>
            <Minimize2 size={14} />
          </button>
        </div>
        <div className="split-pane-body">{first}</div>
      </div>
      <button
        type="button"
        className={`split-handle ${vertical ? 'split-handle-y' : 'split-handle-x'}`}
        aria-label={t('ui.resizePanels')}
        onPointerDown={onPointerDown}
      >
        {vertical ? <GripHorizontal size={14} /> : <GripVertical size={14} />}
      </button>
      <div className="split-pane-b">
        <div className="split-panel-head">
          <span>{labelB}</span>
          <button type="button" title={t('ui.minimizePanel', { name: labelB })} onClick={toggleB}>
            <Minimize2 size={14} />
          </button>
        </div>
        <div className="split-pane-body">{second}</div>
      </div>
    </div>
  )
}
