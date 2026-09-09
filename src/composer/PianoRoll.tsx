import { useRef, useEffect, useCallback, useState } from 'react'
import { useSong, createNoteFromTrack } from '../context/SongContext'
import { ensureAccidentalLayer, variantFromModifiers } from '../music/accidentalLayer'
import { PITCH_MIN, PITCH_MAX, pitchToName, isBlackKey } from '../music/pitchUtils'
import { snapBeat } from '../music/timing'
import { midiToLine, snapMidiToLine } from '../music/gtPitch'
import { noteSelectMode } from '../music/noteSelection'
import { paintNoteBeats, makePaintedNotes, sliceSongAtBeat } from '../music/editTools'
import { INSTRUMENTS } from '../music/types'
import type { Note } from '../music/types'
import { seekPlayback } from '../audio/seekPlayback'
import { audioEngine } from '../audio/AudioEngine'
import { getPlayheadBeat, subscribePlayhead } from '../audio/playheadBus'
import { fitCanvas } from '../audio/canvasFit'
import { drawPlayheadCaret, drawPlayheadLine, hitPlayheadCaret } from './playhead'
import { useT } from '../i18n/LanguageProvider'
import { usePhoneLayout } from '../layout/usePhoneLayout'
import { DAW_GUTTER, PIANO_KEY_WIDTH } from './dawLayout'

const ROW_HEIGHT = 16
const VELOCITY_H = 48
const KEY_LIVE = '#ffe566'
const KEY_LIVE_BLACK = '#e6c63a'
const KEY_GHOST = '#f0e4a8'
const KEY_GHOST_BLACK = '#8a7c42'

function noteSoundsAt(note: Note, beat: number): boolean {
  return beat >= note.startBeat && beat < note.startBeat + note.durationBeats
}

interface DragState {
  type: 'move' | 'resize' | 'create' | 'select' | 'seek' | 'pending' | 'paint' | 'velocity' | 'pan'
  noteId?: string
  startX: number
  startY: number
  origStartBeat?: number
  origDuration?: number
  origPitch?: number
  origNotes?: Map<string, { startBeat: number; pitch: number; trackId: string }>
  selectRect?: { x: number; y: number; w: number; h: number }
  additive?: boolean
  pendingBeat?: number
  pendingPitch?: number
  paintBeats?: number[]
  startScrollBeat?: number
  startScrollPitch?: number
}

export function PianoRoll() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const phone = usePhoneLayout()
  const keyWidth = phone ? PIANO_KEY_WIDTH : DAW_GUTTER
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const velocityRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  const track = state.song.tracks.find((t) => t.id === state.selectedTrackId)
  const beatWidth = state.zoom

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ width, height: Math.max(48, height - VELOCITY_H) })
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const beatFromX = useCallback(
    (x: number) => {
      const gridX = x - keyWidth + state.scrollBeat * beatWidth
      return snapBeat(gridX / beatWidth, state.snap)
    },
    [state.scrollBeat, beatWidth, state.snap, keyWidth],
  )

  const pitchFromY = useCallback(
    (y: number) => {
      const row = Math.floor((y + state.scrollPitch * ROW_HEIGHT) / ROW_HEIGHT)
      const raw = PITCH_MAX - row
      return snapMidiToLine(Math.max(PITCH_MIN, Math.min(PITCH_MAX, raw)))
    },
    [state.scrollPitch],
  )

  const findNoteAt = useCallback(
    (x: number, y: number): Note | null => {
      if (!track) return null
      const beat = beatFromX(x)
      const pitch = pitchFromY(y)
      for (const note of track.notes) {
        if (
          pitch === note.pitch &&
          beat >= note.startBeat &&
          beat < note.startBeat + note.durationBeats
        ) {
          return note
        }
      }
      return null
    },
    [track, beatFromX, pitchFromY],
  )

  const findResizeHandle = useCallback(
    (x: number, y: number): Note | null => {
      if (!track) return null
      const beat = beatFromX(x)
      const pitch = pitchFromY(y)
      for (const note of track.notes) {
        if (pitch === note.pitch) {
          const endBeat = note.startBeat + note.durationBeats
          if (Math.abs(beat - endBeat) < 0.25) return note
        }
      }
      return null
    },
    [track, beatFromX, pitchFromY],
  )

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height, dpr } = fitCanvas(canvas, canvasSize.width, canvasSize.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    const gridStartBeat = Math.floor(state.scrollBeat)
    const visibleBeats = Math.ceil((width - keyWidth) / beatWidth) + 2

    for (let b = gridStartBeat; b < gridStartBeat + visibleBeats; b++) {
      const x = keyWidth + (b - state.scrollBeat) * beatWidth
      const isBar = b % 4 === 0
      ctx.strokeStyle = isBar ? '#2a2a2a' : '#161616'
      ctx.lineWidth = isBar ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    const snapGrid = 4 / state.snap
    for (let b = gridStartBeat; b < gridStartBeat + visibleBeats; b += snapGrid) {
      const x = keyWidth + (b - state.scrollBeat) * beatWidth
      ctx.strokeStyle = '#222230'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
      const row = PITCH_MAX - p
      const y = row * ROW_HEIGHT - state.scrollPitch * ROW_HEIGHT
      if (y < -ROW_HEIGHT || y > height) continue

      ctx.fillStyle = isBlackKey(p) ? '#0a0a0a' : '#111111'
      ctx.fillRect(keyWidth, y, width - keyWidth, ROW_HEIGHT)
    }

    ctx.fillStyle = '#0e0f14'
    ctx.fillRect(0, 0, keyWidth, height)

    const playheadBeat = getPlayheadBeat()
    const anySolo = state.song.tracks.some((item) => item.solo)
    const livePitches = new Set<number>()
    const ghostLivePitches = new Set<number>()
    const trackAudible = !!track && !track.muted && !(anySolo && !track.solo)
    if (state.isPlaying) {
      if (track && trackAudible) {
        for (const note of track.notes) {
          if (noteSoundsAt(note, playheadBeat)) livePitches.add(note.pitch)
        }
      }
      if (state.ghostNotes) {
        for (const other of state.song.tracks) {
          if (other.id === track?.id) continue
          if (other.muted || (anySolo && !other.solo)) continue
          for (const note of other.notes) {
            if (noteSoundsAt(note, playheadBeat)) ghostLivePitches.add(note.pitch)
          }
        }
      }
    }
    const paintPitch = dragRef.current?.pendingPitch
    if (paintPitch != null) livePitches.add(paintPitch)

    for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
      const row = PITCH_MAX - p
      const y = row * ROW_HEIGHT - state.scrollPitch * ROW_HEIGHT
      if (y < -ROW_HEIGHT || y > height) continue
      const black = isBlackKey(p)
      const shown = livePitches.has(p)
      const ghost = !shown && ghostLivePitches.has(p)
      ctx.fillStyle = shown
        ? black
          ? KEY_LIVE_BLACK
          : KEY_LIVE
        : ghost
          ? black
            ? KEY_GHOST_BLACK
            : KEY_GHOST
          : black
            ? '#16171d'
            : '#ece8df'
      ctx.fillRect(0, y, PIANO_KEY_WIDTH, ROW_HEIGHT)
      ctx.strokeStyle = black ? '#0c0d11' : shown || ghost ? '#c4b45a' : '#d4cfc4'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + ROW_HEIGHT)
      ctx.lineTo(PIANO_KEY_WIDTH, y + ROW_HEIGHT)
      ctx.stroke()
      if (p % 12 === 0) {
        ctx.fillStyle = shown || ghost ? '#3a3208' : '#3a3a42'
        ctx.font = '500 9px Inter, system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(pitchToName(p), PIANO_KEY_WIDTH - 4, y + ROW_HEIGHT - 3)
      }
    }

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(PIANO_KEY_WIDTH, 0, keyWidth - PIANO_KEY_WIDTH, height)
    ctx.strokeStyle = '#1f1f1f'
    ctx.beginPath()
    ctx.moveTo(keyWidth, 0)
    ctx.lineTo(keyWidth, height)
    ctx.stroke()

    const loopStart = state.worldSettings.loopStartBeat ?? 0
    const loopEnd = state.worldSettings.loopEndBeat
    if (loopEnd != null && loopEnd > loopStart) {
      const x = keyWidth + (loopStart - state.scrollBeat) * beatWidth
      const w = (loopEnd - loopStart) * beatWidth
      ctx.fillStyle = 'rgba(255, 229, 102, 0.06)'
      ctx.fillRect(x, 0, w, height)
      ctx.strokeStyle = 'rgba(255, 229, 102, 0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.moveTo(x + w, 0)
      ctx.lineTo(x + w, height)
      ctx.stroke()
    }

    const selectedColor =
      INSTRUMENTS.find((i) => i.id === track?.instrument)?.color ?? '#6c9eff'

    if (state.ghostNotes) {
      for (const other of state.song.tracks) {
        if (other.id === track?.id) continue
        if (other.muted || (anySolo && !other.solo)) continue
        const color = INSTRUMENTS.find((i) => i.id === other.instrument)?.color ?? '#888'
        for (const note of other.notes) {
          const x = keyWidth + (note.startBeat - state.scrollBeat) * beatWidth
          const w = note.durationBeats * beatWidth
          const row = PITCH_MAX - note.pitch
          const y = row * ROW_HEIGHT - state.scrollPitch * ROW_HEIGHT + 1
          const h = ROW_HEIGHT - 2
          if (x + w < keyWidth || x > width) continue
          const playing = state.isPlaying && noteSoundsAt(note, playheadBeat)
          ctx.globalAlpha = playing ? 0.72 : 0.22
          ctx.fillStyle = playing ? KEY_GHOST : color
          ctx.beginPath()
          ctx.roundRect(x, y, Math.max(w, 4), h, 2)
          ctx.fill()
          if (playing) {
            ctx.globalAlpha = 0.9
            ctx.strokeStyle = '#e8d98a'
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
      }
    }

    if (track) {
      for (const note of track.notes) {
        const x = keyWidth + (note.startBeat - state.scrollBeat) * beatWidth
        const w = note.durationBeats * beatWidth
        const row = PITCH_MAX - note.pitch
        const y = row * ROW_HEIGHT - state.scrollPitch * ROW_HEIGHT + 1
        const h = ROW_HEIGHT - 2

        if (x + w < keyWidth || x > width) continue

        const selected = state.selectedNoteIds.has(note.id)
        const playing = state.isPlaying && noteSoundsAt(note, playheadBeat)
        ctx.fillStyle = selected ? '#fff' : selectedColor
        ctx.globalAlpha = selected ? 1 : 0.85
        ctx.beginPath()
        ctx.roundRect(x, y, Math.max(w, 4), h, 2)
        ctx.fill()
        ctx.globalAlpha = 1

        if (playing) {
          ctx.fillStyle = 'rgba(255, 229, 80, 0.55)'
          ctx.beginPath()
          ctx.roundRect(x, y, Math.max(w, 4), h, 2)
          ctx.fill()
          ctx.strokeStyle = KEY_LIVE
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else if (selected) {
          ctx.strokeStyle = selectedColor
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }

    const playheadX = keyWidth + (playheadBeat - state.scrollBeat) * beatWidth
    if (playheadX >= keyWidth && playheadX <= width) {
      drawPlayheadLine(ctx, playheadX, 0, height)
      drawPlayheadCaret(ctx, playheadX, 0)
    }

    if (dragRef.current?.type === 'paint' && dragRef.current.paintBeats && dragRef.current.pendingPitch != null) {
      const pitch = dragRef.current.pendingPitch
      const row = PITCH_MAX - pitch
      const y = row * ROW_HEIGHT - state.scrollPitch * ROW_HEIGHT + 1
      const dur = 4 / state.snap
      ctx.fillStyle = selectedColor
      ctx.globalAlpha = 0.45
      for (const beat of dragRef.current.paintBeats) {
        const x = keyWidth + (beat - state.scrollBeat) * beatWidth
        ctx.beginPath()
        ctx.roundRect(x, y, Math.max(dur * beatWidth, 4), ROW_HEIGHT - 2, 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (dragRef.current?.type === 'select' && dragRef.current.selectRect) {
      const r = dragRef.current.selectRect
      ctx.fillStyle = 'rgba(108, 158, 255, 0.15)'
      ctx.strokeStyle = 'rgba(108, 158, 255, 0.6)'
      ctx.lineWidth = 1
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeRect(r.x, r.y, r.w, r.h)
    }
  }, [canvasSize, state.scrollBeat, state.scrollPitch, state.snap, state.isPlaying, state.currentBeat, state.selectedNoteIds, track, beatWidth, state.ghostNotes, state.song.tracks, state.worldSettings.loopStartBeat, state.worldSettings.loopEndBeat, keyWidth])

  useEffect(() => {
    render()
    return subscribePlayhead(render)
  }, [render])

  useEffect(() => {
    if (!state.isPlaying || state.worldSettings.composerFollowPlayhead === false) return
    const { width } = canvasSize
    if (width <= keyWidth) return
    const margin = 72
    const follow = (beat: number) => {
      const playheadX = keyWidth + (beat - state.scrollBeat) * beatWidth
      if (playheadX > width - margin) {
        dispatch({
          type: 'SET_SCROLL',
          scrollBeat: Math.max(0, beat - (width - keyWidth - margin) / beatWidth),
        })
      } else if (playheadX < keyWidth + 8 && state.scrollBeat > 0) {
        dispatch({
          type: 'SET_SCROLL',
          scrollBeat: Math.max(0, beat),
        })
      }
    }
    follow(getPlayheadBeat())
    return subscribePlayhead(follow)
  }, [state.isPlaying, canvasSize, beatWidth, state.scrollBeat, dispatch, state.worldSettings.composerFollowPlayhead, keyWidth])

  useEffect(() => {
    let frame: number
    const animate = () => {
      render()
      frame = requestAnimationFrame(animate)
    }
    if (state.isPlaying) {
      frame = requestAnimationFrame(animate)
    }
    return () => cancelAnimationFrame(frame)
  }, [state.isPlaying, render])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is optional */
    }
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (x < keyWidth) return

    const playheadX = keyWidth + (getPlayheadBeat() - state.scrollBeat) * beatWidth
    if (hitPlayheadCaret(x, y, playheadX)) {
      dragRef.current = { type: 'seek', startX: x, startY: y }
      seekPlayback(beatFromX(x), state.song, state.isPlaying, (beat) =>
        dispatch({ type: 'SET_CURRENT_BEAT', beat }),
      )
      return
    }

    if (!track) return
    const mode = noteSelectMode(e)

    if (state.editTool === 'slice') {
      const beat = beatFromX(x)
      const hit = findNoteAt(x, y)
      pushHistory()
      dispatch({
        type: 'SET_SONG',
        song: sliceSongAtBeat(
          state.song,
          beat,
          hit ? new Set([hit.id]) : state.selectedNoteIds.size > 0 ? state.selectedNoteIds : null,
        ),
      })
      return
    }

    const resizeNote = findResizeHandle(x, y)
    if (resizeNote) {
      pushHistory()
      dragRef.current = {
        type: 'resize',
        noteId: resizeNote.id,
        startX: x,
        startY: y,
        origDuration: resizeNote.durationBeats,
        origStartBeat: resizeNote.startBeat,
      }
      dispatch({ type: 'SELECT_NOTES', noteIds: [resizeNote.id] })
      return
    }

    const note = findNoteAt(x, y)
    if (note) {
      const already = state.selectedNoteIds.has(note.id)
      if (mode === 'toggle') {
        dispatch({ type: 'SELECT_NOTES', noteIds: [note.id], toggle: true })
        if (already) {
          dragRef.current = null
          return
        }
      } else if (!already) {
        dispatch({ type: 'SELECT_NOTES', noteIds: [note.id], additive: mode === 'add' })
      }
      pushHistory()
      const ids = already && mode === 'replace'
        ? state.selectedNoteIds
        : mode === 'add' || already
          ? new Set([...state.selectedNoteIds, note.id])
          : new Set([note.id])
      const origNotes = new Map<string, { startBeat: number; pitch: number; trackId: string }>()
      for (const t of state.song.tracks) {
        for (const n of t.notes) {
          if (ids.has(n.id)) origNotes.set(n.id, { startBeat: n.startBeat, pitch: n.pitch, trackId: t.id })
        }
      }
      dragRef.current = {
        type: 'move',
        noteId: note.id,
        startX: x,
        startY: y,
        origNotes,
      }
      return
    }

    const beat = beatFromX(x)
    const pitch = pitchFromY(y)
    if (pitch >= PITCH_MIN && pitch <= PITCH_MAX) {
      if (mode === 'replace') dispatch({ type: 'CLEAR_SELECTION' })
      dragRef.current = {
        type: 'pending',
        startX: x,
        startY: y,
        pendingBeat: beat,
        pendingPitch: pitch,
        additive: mode !== 'replace',
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (drag.type === 'seek') {
      seekPlayback(beatFromX(x), state.song, state.isPlaying, (beat) =>
        dispatch({ type: 'SET_CURRENT_BEAT', beat }),
      )
      return
    }

    if (drag.type === 'pan') {
      dispatch({
        type: 'SET_SCROLL',
        scrollBeat: Math.max(0, (drag.startScrollBeat ?? 0) - (x - drag.startX) / beatWidth),
        scrollPitch: Math.max(0, (drag.startScrollPitch ?? 0) + (y - drag.startY) / ROW_HEIGHT),
      })
      return
    }

    if (drag.type === 'move' && drag.origNotes) {
      const startBeat = beatFromX(drag.startX)
      const currentBeat = beatFromX(x)
      const dBeat = snapBeat(currentBeat - startBeat, state.snap)
      const dPitch = pitchFromY(y) - pitchFromY(drag.startY)

      for (const [id, orig] of drag.origNotes) {
        const pitch = snapMidiToLine(Math.max(PITCH_MIN, Math.min(PITCH_MAX, orig.pitch + dPitch)))
        dispatch({
          type: 'UPDATE_NOTE',
          trackId: orig.trackId,
          noteId: id,
          updates: {
            startBeat: Math.max(0, orig.startBeat + dBeat),
            pitch,
            pitchLine: midiToLine(pitch),
          },
        })
      }
    } else if (drag.type === 'resize' && drag.noteId && track) {
      const beat = beatFromX(x)
      const note = track.notes.find((n) => n.id === drag.noteId)
      if (note) {
        const newDur = Math.max(4 / state.snap, snapBeat(beat, state.snap) - note.startBeat)
        dispatch({
          type: 'UPDATE_NOTE',
          trackId: track.id,
          noteId: drag.noteId,
          updates: { durationBeats: newDur },
        })
      }
    }

    if (drag.type === 'pending') {
      if (Math.hypot(x - drag.startX, y - drag.startY) > 5) {
        if (state.editTool === 'draw' && drag.pendingPitch != null && drag.pendingBeat != null) {
          dragRef.current = {
            type: 'paint',
            startX: drag.startX,
            startY: drag.startY,
            pendingPitch: drag.pendingPitch,
            pendingBeat: drag.pendingBeat,
            paintBeats: paintNoteBeats(drag.pendingBeat, beatFromX(x), state.snap),
          }
        } else if (phone && state.editTool === 'select') {
          dragRef.current = {
            type: 'pan',
            startX: drag.startX,
            startY: drag.startY,
            startScrollBeat: state.scrollBeat,
            startScrollPitch: state.scrollPitch,
          }
        } else {
          dragRef.current = {
            type: 'select',
            startX: drag.startX,
            startY: drag.startY,
            additive: drag.additive,
            selectRect: {
              x: Math.min(drag.startX, x),
              y: Math.min(drag.startY, y),
              w: Math.abs(x - drag.startX),
              h: Math.abs(y - drag.startY),
            },
          }
        }
        render()
      }
      return
    }

    if (drag.type === 'paint' && drag.pendingBeat != null) {
      dragRef.current = {
        ...drag,
        paintBeats: paintNoteBeats(drag.pendingBeat, beatFromX(x), state.snap),
      }
      render()
      return
    }

    if (drag.type === 'select') {
      dragRef.current = {
        ...drag,
        selectRect: {
          x: Math.min(drag.startX, x),
          y: Math.min(drag.startY, y),
          w: Math.abs(x - drag.startX),
          h: Math.abs(y - drag.startY),
        },
      }
      render()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (drag?.type === 'paint' && track && drag.pendingPitch != null && drag.paintBeats?.length) {
      const occupied = new Set(
        track.notes
          .filter((note) => note.pitch === drag.pendingPitch)
          .map((note) => note.startBeat),
      )
      const beats = drag.paintBeats.filter((beat) => ![...occupied].some((start) => Math.abs(start - beat) < 1e-6))
      const notes = makePaintedNotes(track, beats, drag.pendingPitch, state.snap)
      if (notes.length) {
        pushHistory()
        dispatch({ type: 'ADD_NOTES', trackId: track.id, notes })
        void audioEngine.previewNote(track, notes[0], state.song.bpm)
      }
      dragRef.current = null
      render()
      return
    }
    if (drag?.type === 'pending' && track && drag.pendingPitch != null && drag.pendingBeat != null) {
      const plan = ensureAccidentalLayer(state.song, track, variantFromModifiers(e))
      const newNote = createNoteFromTrack(
        plan.track,
        drag.pendingPitch,
        drag.pendingBeat,
        4 / state.snap,
      )
      pushHistory()
      if (plan.created) {
        dispatch({ type: 'ADD_TRACK', track: plan.track, afterTrackId: track.id })
      } else if (plan.track.id !== track.id) {
        dispatch({ type: 'SELECT_TRACK', trackId: plan.track.id })
      }
      dispatch({ type: 'ADD_NOTE', trackId: plan.track.id, note: newNote })
      void audioEngine.previewNote(plan.track, newNote, state.song.bpm)
      dragRef.current = null
      render()
      return
    }
    if (drag?.type === 'select' && drag.selectRect && track) {
      const r = drag.selectRect
      const startBeat = beatFromX(r.x)
      const endBeat = beatFromX(r.x + r.w)
      const topPitch = pitchFromY(r.y)
      const bottomPitch = pitchFromY(r.y + r.h)
      const ids = track.notes
        .filter(
          (n) =>
            n.pitch <= topPitch &&
            n.pitch >= bottomPitch &&
            n.startBeat + n.durationBeats > startBeat &&
            n.startBeat < endBeat,
        )
        .map((n) => n.id)
      dispatch({ type: 'SELECT_NOTES', noteIds: ids, additive: drag.additive })
    }
    dragRef.current = null
    render()
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const newZoom = Math.max(24, Math.min(120, state.zoom + (e.deltaY > 0 ? -4 : 4)))
      dispatch({ type: 'SET_ZOOM', zoom: newZoom })
    } else if (e.shiftKey) {
      dispatch({
        type: 'SET_SCROLL',
        scrollBeat: Math.max(0, state.scrollBeat + e.deltaY / beatWidth),
      })
    } else {
      dispatch({
        type: 'SET_SCROLL',
        scrollPitch: Math.max(0, state.scrollPitch + e.deltaY / ROW_HEIGHT),
      })
    }
  }

  const renderVelocity = useCallback(() => {
    const canvas = velocityRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, dpr } = fitCanvas(canvas, canvasSize.width, VELOCITY_H)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, width, VELOCITY_H)
    ctx.fillStyle = '#0e0f14'
    ctx.fillRect(0, 0, keyWidth, VELOCITY_H)
    ctx.fillStyle = '#5a5a62'
    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('V', PIANO_KEY_WIDTH - 4, VELOCITY_H - 8)
    if (!track) return
    const color = INSTRUMENTS.find((i) => i.id === track.instrument)?.color ?? '#6c9eff'
    for (const note of track.notes) {
      const x = keyWidth + (note.startBeat - state.scrollBeat) * beatWidth
      const w = Math.max(3, note.durationBeats * beatWidth - 1)
      if (x + w < keyWidth || x > width) continue
      const h = Math.max(3, (note.velocity / 127) * (VELOCITY_H - 8))
      ctx.fillStyle = state.selectedNoteIds.has(note.id) ? '#fff' : color
      ctx.globalAlpha = 0.85
      ctx.fillRect(x, VELOCITY_H - 4 - h, w, h)
      ctx.globalAlpha = 1
    }
  }, [canvasSize.width, track, state.scrollBeat, beatWidth, state.selectedNoteIds])

  useEffect(() => {
    renderVelocity()
    return subscribePlayhead(renderVelocity)
  }, [renderVelocity])

  const handleVelocityPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!track) return
    if (e.pointerType === 'mouse' && e.buttons !== 1 && e.type !== 'pointerdown') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (x < keyWidth) return
    const beat = beatFromX(x)
    let hit: Note | null = null
    for (const note of track.notes) {
      if (beat >= note.startBeat && beat < note.startBeat + note.durationBeats) {
        hit = note
        break
      }
    }
    if (!hit) return
    const velocity = Math.max(1, Math.min(127, Math.round(((VELOCITY_H - 4 - y) / (VELOCITY_H - 8)) * 127)))
    if (e.type === 'pointerdown') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* optional */
      }
      pushHistory()
      dispatch({ type: 'SELECT_NOTES', noteIds: [hit.id] })
    }
    dispatch({
      type: 'UPDATE_NOTE',
      trackId: track.id,
      noteId: hit.id,
      updates: { velocity },
    })
  }

  return (
    <div ref={containerRef} className="piano-roll-container">
      <canvas
        ref={canvasRef}
        className="piano-roll-canvas"
        style={{ width: canvasSize.width, height: canvasSize.height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null
          render()
        }}
        onWheel={handleWheel}
      />
      <canvas
        ref={velocityRef}
        className="velocity-lane"
        style={{ width: canvasSize.width, height: VELOCITY_H }}
        onPointerDown={handleVelocityPointer}
        onPointerMove={handleVelocityPointer}
        title={t('ui.velocityLane')}
      />
    </div>
  )
}
