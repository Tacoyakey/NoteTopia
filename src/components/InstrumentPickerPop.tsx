import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { INSTRUMENTS, type InstrumentId, type Track } from '../music/types'
import { gtFieldsForInstrument, instrumentHasAccidentals, sheetMusicLabel, sheetMusicName, type GtVariant } from '../music/gtPitch'
import { SheetTileIcon } from './SheetTileIcon'
import { useT } from '../i18n/LanguageProvider'

const GT_VARIANTS: GtVariant[] = ['natural', 'flat', 'sharp']

function spriteOptions(current?: InstrumentId) {
  const list = current && !INSTRUMENTS.some((inst) => inst.id === current)
    ? [...INSTRUMENTS, { id: current, label: current, color: '#888' }]
    : INSTRUMENTS
  return list.flatMap((inst) => {
    const variants = instrumentHasAccidentals(inst.id) ? GT_VARIANTS : (['natural'] as const)
    return variants.map((variant) => {
      const fields = gtFieldsForInstrument(inst.id, variant)
      return {
        instrument: inst.id,
        variant,
        preview: { instrument: inst.id, ...fields },
      }
    })
  })
}

export function InstrumentPickerPop({
  track,
  open,
  anchor,
  onClose,
  onPick,
}: {
  track: Track
  open: boolean
  anchor: HTMLElement | null
  onClose: () => void
  onPick: (instrument: InstrumentId, variant: GtVariant) => void
}) {
  const { t } = useT()
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const options = useMemo(() => spriteOptions(track.instrument), [track.instrument])

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const pop = popRef.current
      const width = pop?.offsetWidth ?? 252
      const height = pop?.offsetHeight ?? 320
      let left = rect.left - width - 8
      if (left < 8) left = Math.min(window.innerWidth - width - 8, rect.right + 8)
      let top = rect.top
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - height - 8)
      }
      setPos({ top, left })
    }
    place()
    const frame = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchor?.contains(target) || popRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open, anchor, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={popRef}
      className="instrument-pop"
      role="listbox"
      aria-label={t('ui.chooseInstrument')}
      style={{ top: pos.top, left: pos.left }}
    >
      {options.map((option) => {
        const selected =
          option.instrument === track.instrument && option.preview.gtNumType === track.gtNumType
        const label = sheetMusicName(
          option.preview.gtNumType,
          INSTRUMENTS.find((inst) => inst.id === option.instrument)?.label,
        )
        return (
          <button
            key={`${option.instrument}-${option.variant}`}
            type="button"
            role="option"
            aria-selected={selected}
            className={`instrument-pop-choice ${selected ? 'selected' : ''}`}
            title={sheetMusicLabel(option.preview.gtNumType, label)}
            onClick={() => onPick(option.instrument, option.variant)}
          >
            <SheetTileIcon track={option.preview} size={24} title={label} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
