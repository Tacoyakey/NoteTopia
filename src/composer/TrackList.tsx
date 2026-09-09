import { useRef, useState } from 'react'
import { useSong } from '../context/SongContext'
import { INSTRUMENTS, type InstrumentId } from '../music/types'
import { gtFieldsForInstrument, sheetMusicLabel, type GtVariant } from '../music/gtPitch'
import { SheetTileIcon } from '../components/SheetTileIcon'
import { InstrumentPickerPop } from '../components/InstrumentPickerPop'
import { GripVertical, Layers } from '../components/icons'
import { useT } from '../i18n/LanguageProvider'
import { reorderShiftY, type TrackReorder } from './trackReorder'

export function TrackList({
  embedded = false,
  laneHeight = 84,
  reorder = null,
  onReorderChange,
}: {
  embedded?: boolean
  laneHeight?: number
  reorder?: TrackReorder | null
  onReorderChange?: (next: TrackReorder | null) => void
}) {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const [pickerTrackId, setPickerTrackId] = useState<string | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startY: number; from: number; id: string } | null>(null)
  const pickerTrack = state.song.tracks.find((track) => track.id === pickerTrackId) ?? null
  const compact = laneHeight < 64
  const tileSize = compact ? 16 : 22

  const closePicker = () => {
    setPickerTrackId(null)
    setPickerAnchor(null)
  }

  const setInstrument = (trackId: string, instrument: InstrumentId, variant: GtVariant) => {
    pushHistory()
    dispatch({
      type: 'UPDATE_TRACK',
      trackId,
      updates: {
        instrument,
        ...gtFieldsForInstrument(instrument, variant),
      },
    })
    closePicker()
  }

  const onGripPointerDown = (e: React.PointerEvent, index: number, id: string) => {
    if (e.button !== 0 || state.song.tracks.length < 2) return
    e.preventDefault()
    e.stopPropagation()
    closePicker()
    dispatch({ type: 'SELECT_TRACK', trackId: id })
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, from: index, id }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture optional */
    }
    onReorderChange?.({ id, from: index, to: index, dy: 0 })
  }

  const onGripPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const last = state.song.tracks.length - 1
    const minDy = -drag.from * laneHeight - laneHeight
    const maxDy = (last - drag.from) * laneHeight + laneHeight
    const dy = Math.max(minDy, Math.min(maxDy, e.clientY - drag.startY))
    const to = Math.max(0, Math.min(last, drag.from + Math.round(dy / laneHeight)))
    onReorderChange?.({ id: drag.id, from: drag.from, to, dy })
  }

  const onGripPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const last = state.song.tracks.length - 1
    const minDy = -drag.from * laneHeight - laneHeight
    const maxDy = (last - drag.from) * laneHeight + laneHeight
    const dy = Math.max(minDy, Math.min(maxDy, e.clientY - drag.startY))
    const to = Math.max(0, Math.min(last, drag.from + Math.round(dy / laneHeight)))
    dragRef.current = null
    onReorderChange?.(null)
    if (to === drag.from) return
    pushHistory()
    dispatch({ type: 'MOVE_TRACK', trackId: drag.id, toIndex: to })
  }

  return (
    <div
      className={`track-list${embedded ? ' track-list-embedded' : ''}${compact ? ' is-compact' : ''}${reorder ? ' is-reordering' : ''}`}
    >
      {!embedded && (
        <div className="track-list-header">
          <span>{t('ui.tracks')}</span>
          <span className="track-list-header-actions">
            <button
              className="btn-icon"
              title={t('ui.addTrack')}
              onClick={() => {
                pushHistory()
                dispatch({ type: 'ADD_TRACK' })
              }}
            >
              +
            </button>
            <button
              className="btn-icon"
              title={t('ui.addMidiLayersTitle')}
              onClick={() => window.dispatchEvent(new Event('notetopia-add-midi-layers'))}
            >
              <Layers size={14} />
            </button>
          </span>
        </div>
      )}
      <div className="track-list-items">
        {state.song.tracks.map((track, index) => {
          const selected = track.id === state.selectedTrackId
          const dragging = reorder?.id === track.id
          const y = dragging && reorder
            ? reorder.dy
            : reorder
              ? reorderShiftY(index, reorder.from, reorder.to, laneHeight)
              : 0
          return (
            <div
              key={track.id}
              className={`track-item${selected ? ' selected' : ''}${dragging ? ' is-dragging' : ''}`}
              style={y || dragging ? { transform: `translate3d(0, ${y}px, 0)` } : undefined}
              onClick={() => dispatch({ type: 'SELECT_TRACK', trackId: track.id })}
            >
              <div className="track-item-head">
                {embedded && state.song.tracks.length > 1 ? (
                  <button
                    type="button"
                    className="track-grip"
                    title={t('ui.reorderTrack')}
                    aria-label={t('ui.reorderTrack')}
                    onPointerDown={(e) => onGripPointerDown(e, index, track.id)}
                    onPointerMove={onGripPointerMove}
                    onPointerUp={onGripPointerUp}
                    onPointerCancel={onGripPointerUp}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`track-tile-btn ${pickerTrackId === track.id ? 'open' : ''}`}
                  title={t('ui.changeInstrument')}
                  aria-label={t('ui.changeInstrument')}
                  aria-haspopup="listbox"
                  aria-expanded={pickerTrackId === track.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: 'SELECT_TRACK', trackId: track.id })
                    setPickerTrackId((current) => (current === track.id ? null : track.id))
                    setPickerAnchor(e.currentTarget)
                  }}
                >
                  <SheetTileIcon
                    track={track}
                    size={tileSize}
                    title={sheetMusicLabel(track.gtNumType, INSTRUMENTS.find((i) => i.id === track.instrument)?.label)}
                  />
                </button>
                <input
                  className="track-name-input"
                  value={track.name}
                  onChange={(e) => {
                    dispatch({
                      type: 'UPDATE_TRACK',
                      trackId: track.id,
                      updates: { name: e.target.value },
                    })
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className={`btn-mini btn-mute ${track.muted ? 'active' : ''}`}
                  title={t('ui.mute')}
                  aria-pressed={track.muted}
                  onClick={(e) => {
                    e.stopPropagation()
                    pushHistory()
                    dispatch({
                      type: 'UPDATE_TRACK',
                      trackId: track.id,
                      updates: { muted: !track.muted },
                    })
                  }}
                >
                  M
                </button>
                <button
                  type="button"
                  className={`btn-mini btn-solo ${track.solo ? 'active' : ''}`}
                  title={t('ui.solo')}
                  aria-pressed={track.solo}
                  onClick={(e) => {
                    e.stopPropagation()
                    pushHistory()
                    dispatch({
                      type: 'UPDATE_TRACK',
                      trackId: track.id,
                      updates: { solo: !track.solo, muted: false },
                    })
                  }}
                >
                  S
                </button>
              </div>
              <div className="track-controls">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  className="track-volume"
                  title={t('ui.volume')}
                  aria-label={t('ui.volume')}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    dispatch({
                      type: 'UPDATE_TRACK',
                      trackId: track.id,
                      updates: { volume: parseFloat(e.target.value) },
                    })
                  }}
                />
                {state.song.tracks.length > 1 && (
                  <button
                    type="button"
                    className="btn-mini btn-danger"
                    title={t('ui.deleteTrack')}
                    onClick={(e) => {
                      e.stopPropagation()
                      pushHistory()
                      dispatch({ type: 'REMOVE_TRACK', trackId: track.id })
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {pickerTrack ? (
        <InstrumentPickerPop
          track={pickerTrack}
          open
          anchor={pickerAnchor}
          onClose={closePicker}
          onPick={(instrument, variant) => setInstrument(pickerTrack.id, instrument, variant)}
        />
      ) : null}
    </div>
  )
}
