import { useRef, useEffect, useCallback, useState } from 'react'
import { useSong } from '../context/SongContext'
import { INSTRUMENTS } from '../music/types'
import { PITCH_MIN, PITCH_MAX } from '../music/pitchUtils'
import { midiToLine, snapMidiToLine } from '../music/gtPitch'
import { getSongDurationBeats, snapBeat } from '../music/timing'
import { seekPlayback } from '../audio/seekPlayback'
import { drawPlayheadLine } from './playhead'
import { DAW_GUTTER, clampLaneHeight, laneNotePad } from './dawLayout'
import { TrackList } from './TrackList'
import { laneDrawY, type TrackReorder } from './trackReorder'
import type { Note, Track } from '../music/types'
import { useT } from '../i18n/LanguageProvider'
import { getPlayheadBeat, subscribePlayhead } from '../audio/playheadBus'
import { fitCanvas } from '../audio/canvasFit'
import { noteSelectMode } from '../music/noteSelection'
import { Layers } from '../components/icons'

interface ArrangeDrag {
  type: 'move' | 'select'
  startX: number
  startY: number
  trackId?: string
  origNotes?: Map<string, { startBeat: number; pitch: number }>
  selectRect?: { x: number; y: number; w: number; h: number }
  additive?: boolean
}

export function ArrangeView() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const playheadHandleRef = useRef<HTMLDivElement>(null)
  const seeking = useRef(false)
  const dragRef = useRef<ArrangeDrag | null>(null)
  const [size, setSize] = useState({ width: 800, height: 400 })
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [reorder, setReorder] = useState<TrackReorder | null>(null)
  const beatWidth = state.zoom
  const laneHeight = state.laneHeight

  useEffect(() => {
    const el = lanesRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const duration = getSongDurationBeats(state.song)
  const tracks = state.song.tracks
  const contentH = Math.max(size.height, tracks.length * laneHeight)
  const pad = laneNotePad(laneHeight)
  const noteH = laneHeight < 56 ? 4 : 6

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const height = contentH
    const { width, dpr } = fitCanvas(canvas, size.width, height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    const startBeat = state.scrollBeat
    const visibleBeats = Math.ceil(width / beatWidth) + 2
    const endBeat = startBeat + visibleBeats

    for (let i = 0; i < tracks.length; i++) {
      if (reorder && i === reorder.from) continue
      const y = laneDrawY(i, laneHeight, reorder)
      const selected = tracks[i].id === state.selectedTrackId
      ctx.fillStyle = selected ? '#111111' : i % 2 === 0 ? '#0a0a0a' : '#000000'
      ctx.fillRect(0, y, width, laneHeight)
      ctx.strokeStyle = '#1f1f1f'
      ctx.beginPath()
      ctx.moveTo(0, y + laneHeight)
      ctx.lineTo(width, y + laneHeight)
      ctx.stroke()
    }
    if (reorder) {
      const i = reorder.from
      const y = laneDrawY(i, laneHeight, reorder)
      ctx.fillStyle = tracks[i].id === state.selectedTrackId ? '#1a1a1a' : '#141414'
      ctx.fillRect(0, y, width, laneHeight)
      ctx.strokeStyle = '#2a2a2a'
      ctx.beginPath()
      ctx.moveTo(0, y + laneHeight)
      ctx.lineTo(width, y + laneHeight)
      ctx.stroke()
    }

    for (let b = Math.floor(startBeat); b < endBeat; b++) {
      const x = (b - startBeat) * beatWidth
      const isBar = b % 4 === 0
      ctx.strokeStyle = isBar ? '#2a2a2a' : '#161616'
      ctx.lineWidth = isBar ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    const inner = Math.max(8, laneHeight - pad * 2)
    const pitchSpan = PITCH_MAX - PITCH_MIN || 1

    const drawTrackNotes = (track: Track, i: number) => {
      const y0 = laneDrawY(i, laneHeight, reorder)
      const color = INSTRUMENTS.find((inst) => inst.id === track.instrument)?.color ?? '#6c9eff'
      const muted = track.muted || (tracks.some((t) => t.solo) && !track.solo)
      ctx.globalAlpha = muted ? 0.28 : 0.92
      for (const note of track.notes) {
        if (note.startBeat + note.durationBeats < startBeat) continue
        if (note.startBeat > endBeat) continue
        const x = (note.startBeat - startBeat) * beatWidth
        const w = Math.max(3, note.durationBeats * beatWidth - 1)
        const t = (PITCH_MAX - note.pitch) / pitchSpan
        const y = y0 + pad + t * inner
        const selected = state.selectedNoteIds.has(note.id)
        const playheadBeat = getPlayheadBeat()
        const playing =
          state.isPlaying &&
          playheadBeat >= note.startBeat &&
          playheadBeat < note.startBeat + note.durationBeats
        ctx.fillStyle = playing ? '#ffe566' : selected ? '#fff' : color
        ctx.beginPath()
        ctx.roundRect(x, y - noteH / 2, w, noteH, 1.5)
        ctx.fill()
        if (playing) {
          ctx.strokeStyle = 'rgba(255, 255, 200, 0.95)'
          ctx.lineWidth = 1
          ctx.stroke()
        } else if (selected) {
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    tracks.forEach((track, i) => {
      if (reorder && i === reorder.from) return
      drawTrackNotes(track, i)
    })
    if (reorder) drawTrackNotes(tracks[reorder.from], reorder.from)

    const loopStart = state.worldSettings.loopStartBeat ?? 0
    const loopEnd = state.worldSettings.loopEndBeat
    if (loopEnd != null && loopEnd > loopStart) {
      const x = (loopStart - startBeat) * beatWidth
      const w = (loopEnd - loopStart) * beatWidth
      ctx.fillStyle = 'rgba(255, 229, 102, 0.07)'
      ctx.fillRect(x, 0, w, height)
      ctx.strokeStyle = 'rgba(255, 229, 102, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.moveTo(x + w, 0)
      ctx.lineTo(x + w, height)
      ctx.stroke()
    }

    const playheadX = (getPlayheadBeat() - startBeat) * beatWidth
    if (playheadX >= 0 && playheadX <= width) {
      drawPlayheadLine(ctx, playheadX, 0, height)
    }

    if (marquee) {
      ctx.fillStyle = 'rgba(108, 158, 255, 0.15)'
      ctx.strokeStyle = 'rgba(108, 158, 255, 0.6)'
      ctx.lineWidth = 1
      ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h)
      ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h)
    }

    const handle = playheadHandleRef.current
    if (handle) handle.style.left = `${(getPlayheadBeat() - startBeat) * beatWidth}px`
  }, [size, contentH, tracks, state.scrollBeat, state.currentBeat, state.isPlaying, state.selectedTrackId, state.selectedNoteIds, beatWidth, marquee, laneHeight, pad, noteH, reorder, state.worldSettings.loopStartBeat, state.worldSettings.loopEndBeat])

  useEffect(() => {
    render()
    return subscribePlayhead(render)
  }, [render])

  useEffect(() => {
    if (!state.isPlaying) return
    let frame = 0
    const loop = () => {
      render()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [state.isPlaying, render])

  const noteAt = (track: Track, beat: number, pitch: number): Note | null => {
    let best: Note | null = null
    let bestDist = 8
    for (const note of track.notes) {
      if (beat < note.startBeat || beat >= note.startBeat + note.durationBeats) continue
      const dist = Math.abs(note.pitch - pitch)
      if (dist < bestDist) {
        best = note
        bestDist = dist
      }
    }
    return best
  }

  const laneFromY = (y: number) => Math.floor(y / laneHeight)

  const pitchFromLaneY = (y: number, lane: number) => {
    const inner = Math.max(8, laneHeight - pad * 2)
    const localY = y - lane * laneHeight - pad
    return Math.round(PITCH_MAX - (localY / inner) * (PITCH_MAX - PITCH_MIN))
  }

  const beatFromX = (x: number) => state.scrollBeat + x / beatWidth

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointer capture is optional */
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const lane = laneFromY(y)
    const track = tracks[lane]
    if (!track) return
    dispatch({ type: 'SELECT_TRACK', trackId: track.id })
    const beat = beatFromX(x)
    const pitch = pitchFromLaneY(y, lane)
    const hit = noteAt(track, beat, pitch)
    const mode = noteSelectMode(e)

    if (hit) {
      const already = state.selectedNoteIds.has(hit.id)
      if (mode === 'toggle') {
        dispatch({ type: 'SELECT_NOTES', noteIds: [hit.id], toggle: true })
        if (already) return
      } else if (!already) {
        dispatch({ type: 'SELECT_NOTES', noteIds: [hit.id], additive: mode === 'add' })
      }
      const ids =
        already && mode === 'replace'
          ? state.selectedNoteIds
          : mode === 'add' || already
            ? new Set([...state.selectedNoteIds, hit.id])
            : new Set([hit.id])
      pushHistory()
      const origNotes = new Map<string, { startBeat: number; pitch: number }>()
      for (const id of ids) {
        for (const t of tracks) {
          const n = t.notes.find((nn) => nn.id === id)
          if (n) origNotes.set(id, { startBeat: n.startBeat, pitch: n.pitch })
        }
      }
      dragRef.current = {
        type: 'move',
        startX: x,
        startY: y,
        trackId: track.id,
        origNotes,
      }
      return
    }

    if (mode === 'replace') dispatch({ type: 'CLEAR_SELECTION' })
    dragRef.current = {
      type: 'select',
      startX: x,
      startY: y,
      trackId: track.id,
      additive: mode !== 'replace',
      selectRect: { x, y, w: 0, h: 0 },
    }
    setMarquee({ x, y, w: 0, h: 0 })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (drag.type === 'move' && drag.origNotes) {
      const dBeat = snapBeat(beatFromX(x) - beatFromX(drag.startX), state.snap)
      const startLane = laneFromY(drag.startY)
      const dPitch = pitchFromLaneY(y, laneFromY(y)) - pitchFromLaneY(drag.startY, startLane)
      for (const [id, orig] of drag.origNotes) {
        const owner = tracks.find((t) => t.notes.some((n) => n.id === id))
        if (!owner) continue
        const pitch = snapMidiToLine(Math.max(PITCH_MIN, Math.min(PITCH_MAX, orig.pitch + dPitch)))
        dispatch({
          type: 'UPDATE_NOTE',
          trackId: owner.id,
          noteId: id,
          updates: {
            startBeat: Math.max(0, orig.startBeat + dBeat),
            pitch,
            pitchLine: midiToLine(pitch),
          },
        })
      }
      return
    }

    if (drag.type === 'select') {
      const next = {
        x: Math.min(drag.startX, x),
        y: Math.min(drag.startY, y),
        w: Math.abs(x - drag.startX),
        h: Math.abs(y - drag.startY),
      }
      dragRef.current = { ...drag, selectRect: next }
      setMarquee(next)
    }
  }

  const handlePointerUp = () => {
    const drag = dragRef.current
    if (drag?.type === 'select' && drag.selectRect && drag.selectRect.w > 3) {
      const r = drag.selectRect
      const startBeat = beatFromX(r.x)
      const endBeat = beatFromX(r.x + r.w)
      const ids: string[] = []
      const startLane = Math.max(0, laneFromY(r.y))
      const endLane = Math.min(tracks.length - 1, laneFromY(r.y + r.h))
      for (let i = startLane; i <= endLane; i++) {
        const track = tracks[i]
        const topPitch = pitchFromLaneY(r.y, i)
        const bottomPitch = pitchFromLaneY(r.y + r.h, i)
        const hi = Math.max(topPitch, bottomPitch)
        const lo = Math.min(topPitch, bottomPitch)
        for (const n of track.notes) {
          if (
            n.pitch <= hi &&
            n.pitch >= lo &&
            n.startBeat + n.durationBeats > startBeat &&
            n.startBeat < endBeat
          ) {
            ids.push(n.id)
          }
        }
      }
      dispatch({ type: 'SELECT_NOTES', noteIds: ids, additive: drag.additive })
    }
    dragRef.current = null
    setMarquee(null)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.altKey) {
      e.preventDefault()
      const next = clampLaneHeight(state.laneHeight + (e.deltaY > 0 ? -4 : 4))
      dispatch({ type: 'SET_LANE_HEIGHT', laneHeight: next })
      return
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const next = Math.max(24, Math.min(120, state.zoom + (e.deltaY > 0 ? -4 : 4)))
      dispatch({ type: 'SET_ZOOM', zoom: next })
      return
    }
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault()
      const delta = e.shiftKey ? e.deltaY : e.deltaX
      dispatch({
        type: 'SET_SCROLL',
        scrollBeat: Math.max(0, state.scrollBeat + delta / beatWidth),
      })
    }
  }

  const loopDrag = useRef<'start' | 'end' | null>(null)

  const seekFromClientX = (clientX: number) => {
    const el = rulerRef.current
    if (!el) return
    const x = clientX - el.getBoundingClientRect().left
    const beat = snapBeat(state.scrollBeat + x / beatWidth, state.snap)
    seekPlayback(beat, state.song, state.isPlaying, (next) =>
      dispatch({ type: 'SET_CURRENT_BEAT', beat: next }),
    )
  }

  const beatFromClientX = (clientX: number) => {
    const el = rulerRef.current
    if (!el) return 0
    const x = clientX - el.getBoundingClientRect().left
    return snapBeat(Math.max(0, state.scrollBeat + x / beatWidth), state.snap)
  }

  const onRulerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const beat = beatFromClientX(e.clientX)
    if (e.shiftKey) {
      dispatch({ type: 'SET_WORLD_SETTINGS', settings: { loopStartBeat: beat } })
      return
    }
    if (e.altKey) {
      const start = state.worldSettings.loopStartBeat ?? 0
      dispatch({
        type: 'SET_WORLD_SETTINGS',
        settings: beat > start ? { loopEndBeat: beat } : { loopStartBeat: beat, loopEndBeat: start },
      })
      return
    }
    seeking.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointer capture is optional; move/up still seek */
    }
    seekFromClientX(e.clientX)
  }

  const onRulerPointerMove = (e: React.PointerEvent) => {
    if (loopDrag.current) {
      const beat = beatFromClientX(e.clientX)
      if (loopDrag.current === 'start') {
        dispatch({ type: 'SET_WORLD_SETTINGS', settings: { loopStartBeat: beat } })
      } else {
        dispatch({ type: 'SET_WORLD_SETTINGS', settings: { loopEndBeat: beat } })
      }
      return
    }
    if (!seeking.current) return
    seekFromClientX(e.clientX)
  }

  const onRulerPointerUp = () => {
    seeking.current = false
    loopDrag.current = null
  }

  const bars = Array.from({ length: Math.ceil(duration / 4) + 1 }, (_, i) => i * 4)

  return (
    <div className="daw-arrange" style={{ ['--lane-height' as string]: `${laneHeight}px` }}>
      <div className="daw-ruler-row">
        <div className="daw-gutter-label">
          <span>{t('ui.tracks')}</span>
          <span className="track-list-header-actions">
            <button
              type="button"
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
              type="button"
              className="btn-icon"
              title={t('ui.addMidiLayersTitle')}
              onClick={() => window.dispatchEvent(new Event('notetopia-add-midi-layers'))}
            >
              <Layers size={14} />
            </button>
          </span>
        </div>
        <div
          ref={rulerRef}
          className="daw-ruler"
          role="slider"
          aria-label={t('ui.seekPlayhead')}
          aria-valuemin={0}
          aria-valuenow={Math.round(getPlayheadBeat() * 100) / 100}
          aria-valuemax={Math.max(4, duration)}
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
          onPointerUp={onRulerPointerUp}
          onPointerCancel={onRulerPointerUp}
        >
          {bars.map((b) => (
            <span
              key={b}
              className="timeline-label"
              style={{ left: (b - state.scrollBeat) * beatWidth }}
            >
              {b}
            </span>
          ))}
          {state.worldSettings.loopEndBeat != null &&
            state.worldSettings.loopEndBeat > (state.worldSettings.loopStartBeat ?? 0) && (
              <div
                className="loop-region"
                style={{
                  left: ((state.worldSettings.loopStartBeat ?? 0) - state.scrollBeat) * beatWidth,
                  width:
                    (state.worldSettings.loopEndBeat - (state.worldSettings.loopStartBeat ?? 0)) *
                    beatWidth,
                }}
              >
                <button
                  type="button"
                  className="loop-brace loop-brace-start"
                  title={t('ui.loopStartHint')}
                  aria-label={t('ui.loopStart')}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    loopDrag.current = 'start'
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId)
                    } catch {
                      /* optional */
                    }
                  }}
                  onPointerMove={onRulerPointerMove}
                  onPointerUp={onRulerPointerUp}
                  onPointerCancel={onRulerPointerUp}
                />
                <button
                  type="button"
                  className="loop-brace loop-brace-end"
                  title={t('ui.loopEndHint')}
                  aria-label={t('ui.loopEnd')}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    loopDrag.current = 'end'
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId)
                    } catch {
                      /* optional */
                    }
                  }}
                  onPointerMove={onRulerPointerMove}
                  onPointerUp={onRulerPointerUp}
                  onPointerCancel={onRulerPointerUp}
                />
              </div>
            )}
          <div
            ref={playheadHandleRef}
            className="playhead-handle"
            style={{ left: (state.currentBeat - state.scrollBeat) * beatWidth }}
          />
        </div>
      </div>
      <div className="daw-body">
        <div className="daw-headers" style={{ width: DAW_GUTTER }}>
          <TrackList
            embedded
            laneHeight={laneHeight}
            reorder={reorder}
            onReorderChange={setReorder}
          />
        </div>
        <div ref={lanesRef} className="daw-lanes" onWheel={handleWheel}>
          <canvas
            ref={canvasRef}
            className="daw-lanes-canvas"
            style={{ width: size.width, height: contentH }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
      </div>
    </div>
  )
}
