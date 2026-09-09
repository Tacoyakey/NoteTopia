import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSong } from '../context/SongContext'
import { useStudioMode } from '../layout/useStudioMode'
import { useT } from '../i18n/LanguageProvider'
import { isTypingTarget } from '../dom/focus'
import { markStartTourSeen } from '../tutorial/firstRun'
import { tourById, visibleTourSteps, type TourDef, type TourId, type TourStep } from '../tutorial/tours'

const OPEN_EVENT = 'notetopia-open-tutorial'
const PAD = 8

type Hole = { top: number; left: number; width: number; height: number }

function targetEl(id: string | undefined): HTMLElement | null {
  if (!id) return null
  const nodes = [...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)]
  return nodes.find((node) => node.getClientRects().length > 0) ?? null
}

function measure(step: TourStep): Hole | null {
  const el = targetEl(step.target)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 && rect.height < 2) return null
  return {
    top: Math.max(4, rect.top - PAD),
    left: Math.max(4, rect.left - PAD),
    width: Math.min(window.innerWidth - 8, rect.width + PAD * 2),
    height: Math.min(window.innerHeight - 8, rect.height + PAD * 2),
  }
}

function cardPoint(hole: Hole | null, card: DOMRect | null): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = card?.width ?? 320
  const h = card?.height ?? 180
  const clampX = (x: number) => Math.max(12, Math.min(vw - w - 12, x))
  const clampY = (y: number) => Math.max(12, Math.min(vh - h - 12, y))
  if (!hole) return { top: clampY((vh - h) / 2), left: clampX((vw - w) / 2) }
  const below = hole.top + hole.height + 14
  if (below + h + 12 < vh) return { top: below, left: clampX(hole.left) }
  const above = hole.top - h - 14
  if (above > 12) return { top: above, left: clampX(hole.left) }
  const right = hole.left + hole.width + 14
  if (right + w + 12 < vw) return { top: clampY(hole.top), left: right }
  return { top: clampY(12), left: clampX(12) }
}

export function TutorialOverlay() {
  const { state, dispatch } = useSong()
  const { simple } = useStudioMode()
  const { t } = useT()
  const [tour, setTour] = useState<TourDef | null>(null)
  const [index, setIndex] = useState(0)
  const [hole, setHole] = useState<Hole | null>(null)
  const [cardPos, setCardPos] = useState({ top: 80, left: 24 })
  const cardRef = useRef<HTMLDivElement>(null)

  const steps = tour ? visibleTourSteps(tour, simple) : []
  const step = steps[index] ?? null

  const close = useCallback(() => {
    window.dispatchEvent(new Event('notetopia-close-export-menu'))
    if (tour?.id === 'start') markStartTourSeen()
    setTour(null)
    setIndex(0)
    setHole(null)
  }, [tour?.id])

  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<{ id?: TourId }>).detail?.id
      const next = tourById(id)
      if (!next) return
      setTour(next)
      setIndex(0)
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])

  useEffect(() => {
    if (!step) return
    if (step.mode && state.mode !== step.mode) {
      if (simple && step.mode === 'composer') return
      dispatch({ type: 'SET_MODE', mode: step.mode })
    }
    if (step.reveal === 'world-panel') {
      window.dispatchEvent(new Event('notetopia-open-world-panel'))
    }
    if (step.reveal === 'export-menu') {
      window.dispatchEvent(new Event('notetopia-open-export-menu'))
    } else {
      window.dispatchEvent(new Event('notetopia-close-export-menu'))
    }
  }, [dispatch, simple, state.mode, step])

  const layout = useCallback(() => {
    if (!step) {
      setHole(null)
      return
    }
    const nextHole = measure(step)
    setHole(nextHole)
    setCardPos(cardPoint(nextHole, cardRef.current?.getBoundingClientRect() ?? null))
  }, [step])

  useLayoutEffect(() => {
    if (!tour || !step) return
    const id = window.requestAnimationFrame(() => {
      layout()
      window.requestAnimationFrame(layout)
    })
    const later = window.setTimeout(layout, 80)
    const afterMenu = window.setTimeout(layout, 240)
    window.addEventListener('resize', layout)
    window.addEventListener('scroll', layout, true)
    return () => {
      window.cancelAnimationFrame(id)
      window.clearTimeout(later)
      window.clearTimeout(afterMenu)
      window.removeEventListener('resize', layout)
      window.removeEventListener('scroll', layout, true)
    }
  }, [layout, step, tour, state.mode])

  useEffect(() => {
    if (!tour) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) && e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (index >= steps.length - 1) close()
        else setIndex((i) => i + 1)
        return
      }
      if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close, index, steps.length, tour])

  if (!tour || !step) return null

  const last = index >= steps.length - 1
  const goNext = () => {
    if (last) close()
    else setIndex((i) => i + 1)
  }

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {hole ? (
        <div
          className="tour-hole"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={cardRef} className="tour-card" style={{ top: cardPos.top, left: cardPos.left }}>
        <p className="tour-kicker">
          {t(tour.titleKey)} · {t('tour.step', { n: index + 1, total: steps.length })}
        </p>
        <h3 id="tour-title">{t(step.titleKey)}</h3>
        <p className="tour-body">{t(step.bodyKey)}</p>
        <div className="tour-actions">
          <button type="button" className="btn-tool" onClick={close}>
            {t('tour.skip')}
          </button>
          <span className="tour-actions-end">
            <button
              type="button"
              className="btn-tool"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              {t('tour.back')}
            </button>
            <button type="button" className="btn-tool btn-tool-primary" onClick={goNext}>
              {last ? t('tour.done') : t('tour.next')}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
