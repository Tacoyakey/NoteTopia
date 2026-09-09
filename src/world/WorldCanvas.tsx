import { useRef, useEffect, useCallback, useState } from 'react'
import { useSong, createNoteFromTrack } from '../context/SongContext'
import {
  ensureAccidentalLayer,
  placementFields,
  variantFromModifiers,
} from '../music/accidentalLayer'
import { WorldCamera } from './camera'
import { renderWorld, getPlayheadWorldX } from './WorldRenderer'
import { probeTiles, subscribeTiles } from './tiles'
import { probeWeather, subscribeWeather, getWeather } from './weather'
import { screenToGtCell, getGtCellOccupant, screenXToBeat, getWorldMusicTop, hitWorldPlayhead, WORLD_PLAYHEAD_RAIL, densityFromSlider, GT_BLOCK_SIZE, GT_WORLD_WIDTH } from './worldLayout'
import { GT_COLUMNS_PER_BEAT, lineToMidi, sheetMusicLabel } from '../music/gtPitch'
import { seekPlayback } from '../audio/seekPlayback'
import { getPlayheadBeat } from '../audio/playheadBus'
import { INSTRUMENTS } from '../music/types'
import { APP_CREDIT } from '../branding'
import { useT } from '../i18n/LanguageProvider'
import { ChevronsLeft, ChevronsRight, SlidersHorizontal } from '../components/icons'
import {
  AUDIO_RACK_TRACK_NAME,
  createAudioRackNote,
  createAudioRackTrack,
  isAudioRackNote,
} from '../music/audioRack'
import { AudioRackOverlay, type AudioRackEditTarget } from '../components/AudioRackOverlay'
import { sliceSongAtBeat } from '../music/editTools'
import { noteSelectMode, nextNoteSelection, sameNoteIds } from '../music/noteSelection'
import {
  collectSelectedWorldNotes,
  notesIntersectingScreenRect,
  relocateWorldNotes,
  type WorldNoteOrig,
} from './worldSelection'

type WorldGesture =
  | { kind: 'seek' }
  | { kind: 'pan'; lastX: number }
  | {
      kind: 'pending'
      startX: number
      startY: number
      localX: number
      localY: number
      hit: { trackId: string; noteId: string } | null
      button: number
      shift: boolean
      alt: boolean
      mode: ReturnType<typeof noteSelectMode>
      pointerId: number
    }
  | {
      kind: 'marquee'
      startX: number
      startY: number
      rect: { x: number; y: number; w: number; h: number }
      additive: boolean
    }
  | {
      kind: 'paint'
      lastCol: number
      lastLine: number
      shift: boolean
      alt: boolean
    }
  | {
      kind: 'move'
      origs: WorldNoteOrig[]
      startCol: number
      startLine: number
    }

export function WorldCanvas({
  compactChrome = false,
  panelOpen = false,
  onTogglePanel,
}: {
  compactChrome?: boolean
  panelOpen?: boolean
  onTogglePanel?: () => void
}) {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef(new WorldCamera())
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<WorldGesture | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const isSeeking = useRef(false)
  const didSeek = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const hoverCellRef = useRef<ReturnType<typeof screenToGtCell>>(null)
  const [hoverTip, setHoverTip] = useState<string | null>(null)
  const hoverTipRef = useRef<HTMLDivElement>(null)
  const [placeMods, setPlaceMods] = useState({ shift: false, alt: false })
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [rackEdit, setRackEdit] = useState<AudioRackEditTarget | null>(null)
  const renderRef = useRef<() => void>(() => {})

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const nextW = Math.max(1, Math.floor(rect.width * dpr))
    const nextH = Math.max(1, Math.floor(rect.height * dpr))
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    const camera = cameraRef.current
    camera.setZoom(state.worldSettings.zoom)

    const playheadBeat = getPlayheadBeat()

    renderWorld(ctx, rect.width, rect.height, {
      song: state.song,
      camera,
      currentBeat: playheadBeat,
      densitySlider: state.worldSettings.density,
      autoCompress: false,
      gtGrid: state.worldSettings.gtGrid ?? true,
      isPlaying: state.isPlaying,
      theme: state.worldSettings.theme ?? 'sunny',
      solidColor: state.worldSettings.solidColor,
      hoverCell: hoverCellRef.current,
      convertModel: state.worldSettings.convertModel,
      selectedNoteIds: state.selectedNoteIds,
      worldTool: state.worldTool,
      focusMaterial: state.focusMaterial,
      credit: APP_CREDIT,
      marquee,
      hideStatusBar: compactChrome,
      statusHint:
        state.worldTool === 'build'
          ? state.worldPlace === 'rack'
            ? t('world.statusBuildRack', { bpm: state.song.bpm })
            : t('world.statusBuild', { bpm: state.song.bpm })
          : state.worldTool === 'draw'
            ? t('world.statusDraw', { bpm: state.song.bpm })
            : state.worldTool === 'slice'
              ? t('world.statusSlice', { bpm: state.song.bpm })
              : t('world.statusSelect', { bpm: state.song.bpm }),
    })

    const zoom = camera.zoom
    const viewH = rect.height / zoom
    const px =
      (getPlayheadWorldX(
        playheadBeat,
        state.worldSettings.density,
        false,
        state.song,
      ) -
        camera.x) *
      zoom
    const top = getWorldMusicTop(viewH, zoom) * zoom
    const rail = handleRef.current
    if (rail) {
      const railTop = `${top - WORLD_PLAYHEAD_RAIL}px`
      if (rail.style.top !== railTop) rail.style.top = railTop
    }
    const caret = caretRef.current
    if (caret) caret.style.transform = `translate3d(${px - 8}px, 0px, 0px)`
  }, [state, t, marquee, compactChrome])

  renderRef.current = render

  useEffect(() => {
    render()
  }, [render])

  useEffect(() => {
    cameraRef.current.reset()
    renderRef.current()
  }, [state.viewEpoch])

  useEffect(() => {
    void probeTiles()
    void probeWeather()
    const unsubTiles = subscribeTiles(() => renderRef.current())
    const unsubBg = subscribeWeather(() => renderRef.current())
    return () => {
      unsubTiles()
      unsubBg()
    }
  }, [])

  useEffect(() => {
    const sync = (e: KeyboardEvent) => {
      setPlaceMods((prev) => {
        const next = { shift: e.shiftKey, alt: e.altKey }
        if (prev.shift === next.shift && prev.alt === next.alt) return prev
        return next
      })
    }
    const clear = () => setPlaceMods({ shift: false, alt: false })
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useEffect(() => {
    const onPage = (e: Event) => {
      const dir = (e as CustomEvent<{ dir?: number }>).detail?.dir ?? 1
      const s = stateRef.current
      const density = densityFromSlider(s.worldSettings.density)
      const peek = !!(s.worldSettings.followPlayhead && s.isPlaying)
      cameraRef.current.pan(dir * GT_WORLD_WIDTH * GT_BLOCK_SIZE * density, peek)
      renderRef.current()
    }
    window.addEventListener('notetopia-world-page', onPage)
    return () => window.removeEventListener('notetopia-world-page', onPage)
  }, [])

  useEffect(() => {
    setHoverTip((prev) => {
      const cell = hoverCellRef.current
      if (!prev || !cell || (state.worldTool !== 'build' && state.worldTool !== 'draw')) return prev
      const selected = state.song.tracks.find((item) => item.id === state.selectedTrackId)
      const rack =
        state.worldPlace === 'rack' || selected?.name === AUDIO_RACK_TRACK_NAME
      if (rack) return prev
      const hit = getGtCellOccupant(
        state.song,
        cell.beat,
        cell.pitchLine,
        state.worldSettings.convertModel,
      )
      if (hit || !selected) return prev
      const fields = placementFields(
        selected,
        variantFromModifiers({ shiftKey: placeMods.shift, altKey: placeMods.alt }),
      )
      return t('world.place', {
        name: sheetMusicLabel(
          fields.gtNumType,
          INSTRUMENTS.find((i) => i.id === selected.instrument)?.label,
        ),
      })
    })
  }, [
    placeMods,
    state.worldTool,
    state.worldPlace,
    state.selectedTrackId,
    state.song,
    state.worldSettings.convertModel,
    t,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => renderRef.current())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const newZoom = stateRef.current.worldSettings.zoom + (e.deltaY > 0 ? -0.1 : 0.1)
        dispatch({
          type: 'SET_WORLD_SETTINGS',
          settings: { zoom: Math.max(0.5, Math.min(2, newZoom)) },
        })
        return
      }
      const s = stateRef.current
      const following = !!(s.worldSettings.followPlayhead && s.isPlaying)
      if (following) {
        // Magic Mouse / trackpad deltaY used to yank the camera while the
        // pointer just moved. Peek is drag (or a clear horizontal swipe).
        if (s.worldTool !== 'select') return
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return
        cameraRef.current.pan(e.deltaX / cameraRef.current.zoom, true)
        renderRef.current()
        return
      }
      cameraRef.current.pan(e.deltaY / cameraRef.current.zoom)
      renderRef.current()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [dispatch])

  useEffect(() => {
    const animated = getWeather(state.worldSettings.theme).animated
    if (!state.isPlaying && !animated) return
    let frame = 0
    let live = true
    const loop = () => {
      if (!live) return
      const s = stateRef.current
      if (s.worldSettings.followPlayhead && s.isPlaying) {
        const box = containerRef.current
        const camera = cameraRef.current
        if (box) {
          const rect = box.getBoundingClientRect()
          camera.followPlayhead(
            getPlayheadWorldX(getPlayheadBeat(), s.worldSettings.density, false, s.song),
            rect.width / camera.zoom,
          )
        }
      }
      renderRef.current()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      live = false
      cancelAnimationFrame(frame)
    }
  }, [state.isPlaying, state.worldSettings.theme])

  const DRAG_THRESH = 8

  const followPeek = () => {
    const s = stateRef.current
    return !!(s.worldSettings.followPlayhead && s.isPlaying)
  }

  const mayLook = () => {
    if (stateRef.current.worldTool === 'select') return true
    return !followPeek()
  }
  const placingRack =
    state.worldPlace === 'rack' ||
    state.song.tracks.find((item) => item.id === state.selectedTrackId)?.name === AUDIO_RACK_TRACK_NAME

  const localPoint = (clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top, rect }
  }

  const occupantAt = (
    cell: NonNullable<ReturnType<typeof screenToGtCell>>,
    song = stateRef.current.song,
  ) => getGtCellOccupant(song, cell.beat, cell.pitchLine, stateRef.current.worldSettings.convertModel)

  const noteFromOccupant = (hit: { trackId: string; noteId: string } | null) => {
    if (!hit) return null
    const s = stateRef.current
    const track = s.song.tracks.find((t) => t.id === hit.trackId)
    const note = track?.notes.find((n) => n.id === hit.noteId)
    if (!track || !note) return null
    return { track, note }
  }

  const openRackAt = (cell: NonNullable<ReturnType<typeof screenToGtCell>>) => {
    const found = noteFromOccupant(occupantAt(cell))
    if (!found || !isAudioRackNote(found.note)) return false
    setRackEdit({ trackId: found.track.id, noteId: found.note.id })
    return true
  }

  const seekFromClientX = (clientX: number) => {
    const s = stateRef.current
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const raw = screenXToBeat(
      clientX - rect.left,
      cameraRef.current.x,
      cameraRef.current.zoom,
      s.worldSettings.density,
      s.song,
      false,
    )
    const beat = Math.round(raw * GT_COLUMNS_PER_BEAT) / GT_COLUMNS_PER_BEAT
    seekPlayback(beat, s.song, s.isPlaying, (next) =>
      dispatch({ type: 'SET_CURRENT_BEAT', beat: next }),
    )
  }
  const seekFromClientXRef = useRef(seekFromClientX)
  seekFromClientXRef.current = seekFromClientX

  const playheadHitFromPoint = (x: number, y: number) => {
    const s = stateRef.current
    const container = containerRef.current
    if (!container) return false
    const rect = container.getBoundingClientRect()
    const zoom = cameraRef.current.zoom
    const viewH = rect.height / zoom
    const px =
      (getPlayheadWorldX(getPlayheadBeat(), s.worldSettings.density, false, s.song) -
        cameraRef.current.x) *
      zoom
    const top = getWorldMusicTop(viewH, zoom) * zoom
    return hitWorldPlayhead(x, y, px, top)
  }

  const cellFromPoint = (x: number, y: number) => {
    const s = stateRef.current
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    return screenToGtCell(
      x,
      y,
      cameraRef.current.x,
      cameraRef.current.zoom,
      rect.height / cameraRef.current.zoom,
      s.worldSettings.density,
      s.song,
      false,
    )
  }

  const beginSeek = (clientX: number) => {
    isSeeking.current = true
    didSeek.current = true
    gestureRef.current = { kind: 'seek' }
    seekFromClientXRef.current(clientX)
  }

  const idsInMarquee = (rect: { x: number; y: number; w: number; h: number }) => {
    const s = stateRef.current
    const container = containerRef.current
    if (!container) return []
    const viewH = container.getBoundingClientRect().height / cameraRef.current.zoom
    return notesIntersectingScreenRect(
      s.song,
      rect,
      cameraRef.current.x,
      cameraRef.current.zoom,
      viewH,
      s.worldSettings.density,
      false,
      s.worldSettings.convertModel,
    )
  }

  const applyMarquee = (rect: { x: number; y: number; w: number; h: number }, additive: boolean) => {
    const ids = idsInMarquee(rect)
    const s = stateRef.current
    const next = nextNoteSelection(s.selectedNoteIds, ids, additive ? 'add' : 'replace')
    if (!sameNoteIds(s.selectedNoteIds, next)) {
      dispatch({ type: 'SELECT_NOTES', noteIds: [...next] })
    }
  }

  const placeAt = (
    cell: NonNullable<ReturnType<typeof screenToGtCell>>,
    button: number,
    mods: { shiftKey: boolean; altKey: boolean },
    history = true,
  ) => {
    const s = stateRef.current
    const tool = s.worldTool
    if (button === 2) {
      if (tool !== 'build') return
      const hit = occupantAt(cell)
      if (!hit) return
      if (history) pushHistory()
      if (s.selectedNoteIds.has(hit.noteId) && s.selectedNoteIds.size > 1) {
        dispatch({ type: 'DELETE_SELECTED_NOTES' })
      } else {
        dispatch({ type: 'REMOVE_NOTE', trackId: hit.trackId, noteId: hit.noteId })
      }
      return
    }
    if (tool !== 'build' && tool !== 'draw') return
    const hit = occupantAt(cell)
    if (hit) return
    const rack =
      s.worldPlace === 'rack' ||
      s.song.tracks.find((item) => item.id === s.selectedTrackId)?.name === AUDIO_RACK_TRACK_NAME
    if (rack) {
      let host = s.song.tracks.find((item) => item.name === AUDIO_RACK_TRACK_NAME)
      if (history) pushHistory()
      if (!host) {
        host = createAudioRackTrack()
        dispatch({ type: 'ADD_TRACK', track: host })
      }
      const note = createAudioRackNote(cell.beat, cell.pitchLine)
      dispatch({ type: 'ADD_NOTE', trackId: host.id, note })
      setRackEdit({ trackId: host.id, noteId: note.id })
      return
    }
    const track = s.song.tracks.find((item) => item.id === s.selectedTrackId)
    if (!track) return
    const plan = ensureAccidentalLayer(s.song, track, variantFromModifiers(mods))
    const note = createNoteFromTrack(plan.track, lineToMidi(cell.pitchLine), cell.beat, 0.25)
    note.pitchLine = cell.pitchLine
    if (history) pushHistory()
    if (plan.created) {
      dispatch({ type: 'ADD_TRACK', track: plan.track, afterTrackId: track.id })
    } else if (plan.track.id !== track.id) {
      dispatch({ type: 'SELECT_TRACK', trackId: plan.track.id })
    }
    dispatch({ type: 'ADD_NOTE', trackId: plan.track.id, note })
  }

  useEffect(() => {
    const rail = handleRef.current
    if (!rail) return
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      try {
        rail.setPointerCapture(e.pointerId)
      } catch {
        /* capture is optional */
      }
      isSeeking.current = true
      didSeek.current = true
      gestureRef.current = { kind: 'seek' }
      seekFromClientXRef.current(e.clientX)
    }
    const move = (e: PointerEvent) => {
      if (!isSeeking.current) return
      seekFromClientXRef.current(e.clientX)
    }
    const up = () => {
      isSeeking.current = false
    }
    const click = (e: MouseEvent) => {
      didSeek.current = true
      seekFromClientXRef.current(e.clientX)
    }
    rail.addEventListener('pointerdown', down)
    rail.addEventListener('pointermove', move)
    rail.addEventListener('pointerup', up)
    rail.addEventListener('pointercancel', up)
    rail.addEventListener('click', click)
    return () => {
      rail.removeEventListener('pointerdown', down)
      rail.removeEventListener('pointermove', move)
      rail.removeEventListener('pointerup', up)
      rail.removeEventListener('pointercancel', up)
      rail.removeEventListener('click', click)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
    e.preventDefault()
    const pt = localPoint(e.clientX, e.clientY)
    if (!pt) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is optional */
    }

    if (pointersRef.current.size >= 2 && mayLook()) {
      setMarquee(null)
      if (followPeek()) cameraRef.current.beginLook()
      gestureRef.current = { kind: 'pan', lastX: e.clientX }
      return
    }

    if (e.button === 0 && playheadHitFromPoint(pt.x, pt.y)) {
      beginSeek(e.clientX)
      return
    }

    const s = stateRef.current
    const cell = cellFromPoint(pt.x, pt.y)
    const hit = cell ? occupantAt(cell) : null
    const mode = noteSelectMode(e)
    const tool = s.worldTool
    const build = tool === 'build'

    if (e.button === 2) {
      if (build && cell) placeAt(cell, 2, { shiftKey: e.shiftKey, altKey: e.altKey })
      return
    }

    if (tool === 'slice' && e.button === 0) {
      const beat = cell
        ? cell.beat
        : screenXToBeat(
            pt.x,
            cameraRef.current.x,
            cameraRef.current.zoom,
            s.worldSettings.density,
            s.song,
            false,
          )
      pushHistory()
      dispatch({
        type: 'SET_SONG',
        song: sliceSongAtBeat(
          s.song,
          beat,
          hit ? new Set([hit.noteId]) : s.selectedNoteIds.size > 0 ? s.selectedNoteIds : null,
        ),
      })
      return
    }

    gestureRef.current = {
      kind: 'pending',
      startX: e.clientX,
      startY: e.clientY,
      localX: pt.x,
      localY: pt.y,
      hit,
      button: e.button,
      shift: e.shiftKey,
      alt: e.altKey,
      mode,
      pointerId: e.pointerId,
    }
    if (hit && e.pointerType !== 'touch') {
      const already = s.selectedNoteIds.has(hit.noteId)
      if (mode === 'toggle' || mode === 'add' || !already) {
        dispatch({
          type: 'SELECT_NOTES',
          noteIds: [hit.noteId],
          additive: mode === 'add',
          toggle: mode === 'toggle',
        })
      }
      dispatch({ type: 'SELECT_TRACK', trackId: hit.trackId })
    } else if (!hit && mode === 'replace' && tool === 'select') {
      dispatch({ type: 'CLEAR_SELECTION' })
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pt = localPoint(e.clientX, e.clientY)
    if (!pt) return
    const gesture = gestureRef.current
    const s = stateRef.current
    const build = s.worldTool === 'build'
    const draw = s.worldTool === 'draw'
    const cell = cellFromPoint(pt.x, pt.y)

    if (isSeeking.current || gesture?.kind === 'seek') {
      const container = containerRef.current
      if (container) container.style.cursor = 'ew-resize'
      seekFromClientXRef.current(e.clientX)
      return
    }

    if (pointersRef.current.size >= 2 && mayLook()) {
      if (gesture?.kind !== 'pan') {
        setMarquee(null)
        if (followPeek()) cameraRef.current.beginLook()
        gestureRef.current = { kind: 'pan', lastX: e.clientX }
      }
    }

    if (e.pointerType !== 'touch') {
      setPlaceMods((prev) => {
        const next = { shift: e.shiftKey, alt: e.altKey }
        if (prev.shift === next.shift && prev.alt === next.alt) return prev
        return next
      })
      const hover =
        build || draw ? cell : cell && occupantAt(cell) ? cell : null
      hoverCellRef.current = hover
      const hit = cell ? occupantAt(cell) : null
      const found = noteFromOccupant(hit)
      const selected = s.song.tracks.find((item) => item.id === s.selectedTrackId)
      let tip: string | null = null
      if (found) {
        tip = isAudioRackNote(found.note)
          ? t('rack.title')
          : sheetMusicLabel(
              found.note.gtNumType ?? found.track.gtNumType,
              INSTRUMENTS.find((i) => i.id === found.track.instrument)?.label,
            )
      } else if ((build || draw) && placingRack && cell) {
        tip = t('world.place', { name: t('rack.title') })
      } else if ((build || draw) && selected && cell) {
        const fields = placementFields(
          selected,
          variantFromModifiers({ shiftKey: e.shiftKey, altKey: e.altKey }),
        )
        tip = t('world.place', {
          name: sheetMusicLabel(
            fields.gtNumType,
            INSTRUMENTS.find((i) => i.id === selected.instrument)?.label,
          ),
        })
      }
      setHoverTip((prev) => (prev === tip ? prev : tip))
      const tipEl = hoverTipRef.current
      const box = containerRef.current?.getBoundingClientRect()
      if (tipEl && box) {
        tipEl.style.left = `${e.clientX - box.left + 14}px`
        tipEl.style.top = `${e.clientY - box.top + 12}px`
      }

      const container = containerRef.current
      if (container) {
        if (playheadHitFromPoint(pt.x, pt.y)) container.style.cursor = 'ew-resize'
        else if (gesture?.kind === 'pan' || gesture?.kind === 'move') container.style.cursor = 'grabbing'
        else if (gesture?.kind === 'marquee') container.style.cursor = 'crosshair'
        else if (found && isAudioRackNote(found.note)) container.style.cursor = 'pointer'
        else if (found) container.style.cursor = build || draw ? 'grab' : 'pointer'
        else if (build || draw) container.style.cursor = 'cell'
        else if (s.worldTool === 'slice') container.style.cursor = found ? 'col-resize' : 'default'
        else container.style.cursor = 'grab'
      }
      const live =
        stateRef.current.isPlaying || getWeather(stateRef.current.worldSettings.theme).animated
      if (!gesture && !live) renderRef.current()
    }

    if (gesture?.kind === 'pending' && gesture.pointerId === e.pointerId) {
      const dist = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY)
      if (dist > DRAG_THRESH) {
        if (gesture.hit && s.worldTool !== 'slice') {
          const selected = stateRef.current.selectedNoteIds
          const ids = selected.has(gesture.hit.noteId)
            ? selected
            : nextNoteSelection(selected, [gesture.hit.noteId], gesture.mode)
          if (!sameNoteIds(selected, ids)) {
            dispatch({ type: 'SELECT_NOTES', noteIds: [...ids] })
          }
          dispatch({ type: 'SELECT_TRACK', trackId: gesture.hit.trackId })
          const startCell = cellFromPoint(gesture.localX, gesture.localY)
          pushHistory()
          gestureRef.current = {
            kind: 'move',
            origs: collectSelectedWorldNotes(stateRef.current.song, ids),
            startCol: startCell?.column ?? 0,
            startLine: startCell?.pitchLine ?? 1,
          }
        } else if (draw && !gesture.hit) {
          const start = cellFromPoint(gesture.localX, gesture.localY)
          if (start) {
            pushHistory()
            placeAt(start, 0, { shiftKey: gesture.shift, altKey: gesture.alt }, false)
          }
          gestureRef.current = {
            kind: 'paint',
            lastCol: start?.column ?? 0,
            lastLine: start?.pitchLine ?? 1,
            shift: gesture.shift,
            alt: gesture.alt,
          }
        } else if (build || gesture.mode === 'add') {
          const rect = {
            x: Math.min(gesture.localX, pt.x),
            y: Math.min(gesture.localY, pt.y),
            w: Math.abs(pt.x - gesture.localX),
            h: Math.abs(pt.y - gesture.localY),
          }
          gestureRef.current = {
            kind: 'marquee',
            startX: gesture.localX,
            startY: gesture.localY,
            rect,
            additive: gesture.mode !== 'replace',
          }
          setMarquee(rect)
          applyMarquee(rect, gesture.mode !== 'replace')
        } else if (mayLook()) {
          if (followPeek()) cameraRef.current.beginLook()
          gestureRef.current = { kind: 'pan', lastX: e.clientX }
        }
      }
      return
    }

    if (gesture?.kind === 'move' && cell) {
      const patches = relocateWorldNotes(
        stateRef.current.song,
        gesture.origs,
        cell.column - gesture.startCol,
        cell.pitchLine - gesture.startLine,
        stateRef.current.worldSettings.convertModel,
      )
      if (patches && patches.length > 0) {
        dispatch({
          type: 'PATCH_NOTES',
          patches: patches.map((item) => ({
            trackId: item.trackId,
            noteId: item.noteId,
            updates: {
              startBeat: item.startBeat,
              pitch: item.pitch,
              pitchLine: item.pitchLine,
            },
          })),
        })
      }
      return
    }

    if (gesture?.kind === 'paint' && cell) {
      if (cell.column !== gesture.lastCol || cell.pitchLine !== gesture.lastLine) {
        placeAt(cell, 0, { shiftKey: gesture.shift, altKey: gesture.alt }, false)
        gestureRef.current = {
          kind: 'paint',
          lastCol: cell.column,
          lastLine: cell.pitchLine,
          shift: gesture.shift,
          alt: gesture.alt,
        }
      }
      return
    }

    if (gesture?.kind === 'marquee') {
      const rect = {
        x: Math.min(gesture.startX, pt.x),
        y: Math.min(gesture.startY, pt.y),
        w: Math.abs(pt.x - gesture.startX),
        h: Math.abs(pt.y - gesture.startY),
      }
      gestureRef.current = { ...gesture, rect }
      setMarquee(rect)
      applyMarquee(rect, gesture.additive)
      return
    }

    if (gesture?.kind === 'pan' && mayLook()) {
      const dx = e.clientX - gesture.lastX
      cameraRef.current.pan(-dx / cameraRef.current.zoom, followPeek())
      gestureRef.current = { kind: 'pan', lastX: e.clientX }
      render()
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    const gesture = gestureRef.current
    const pt = localPoint(e.clientX, e.clientY)

    if (isSeeking.current || didSeek.current || gesture?.kind === 'seek') {
      isSeeking.current = false
      didSeek.current = false
      if (pointersRef.current.size === 0) gestureRef.current = null
      return
    }

    if (gesture?.kind === 'pending' && gesture.pointerId === e.pointerId) {
      const cell = pt ? cellFromPoint(pt.x, pt.y) : null
      const s = stateRef.current
      if (gesture.hit) {
        const already = s.selectedNoteIds.has(gesture.hit.noteId)
        if (gesture.mode === 'toggle' || gesture.mode === 'add' || !already) {
          dispatch({
            type: 'SELECT_NOTES',
            noteIds: [gesture.hit.noteId],
            additive: gesture.mode === 'add',
            toggle: gesture.mode === 'toggle',
          })
        }
        dispatch({ type: 'SELECT_TRACK', trackId: gesture.hit.trackId })
        if (cell) openRackAt(cell)
      } else if (cell) {
        if (s.worldTool === 'build' || s.worldTool === 'draw') {
          placeAt(cell, gesture.button, { shiftKey: gesture.shift, altKey: gesture.alt })
        } else if (gesture.mode === 'replace') {
          dispatch({ type: 'CLEAR_SELECTION' })
        }
      }
    }

    if (gesture?.kind === 'marquee') {
      applyMarquee(gesture.rect, gesture.additive)
      setMarquee(null)
    }

    if (pointersRef.current.size === 0) {
      gestureRef.current = null
      setMarquee(null)
      cameraRef.current.endLook()
    }
  }

  return (
    <div
      ref={containerRef}
      className={`world-canvas-container${compactChrome ? ' is-compact-chrome' : ''}${state.worldTool === 'build' ? ' is-build' : state.worldTool === 'draw' ? ' is-draw' : state.worldTool === 'slice' ? ' is-slice' : ' is-select'}`}
      data-tour="world-sheet"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch' && pointersRef.current.size === 0) {
          hoverCellRef.current = null
          setHoverTip(null)
          renderRef.current()
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="world-canvas" />
      <div
        ref={handleRef}
        className="world-playhead-rail"
        role="slider"
        aria-label={t('ui.seekPlayhead')}
        aria-valuemin={0}
        aria-valuenow={Math.round(state.currentBeat * 100) / 100}
        title={t('ui.dragToSeek')}
        onClick={(e) => beginSeek(e.clientX)}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        <div ref={caretRef} className="world-playhead-handle" />
      </div>
      <div
        className="world-page-skip"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="btn-icon-tool"
          title={t('ui.pagePrevHint')}
          aria-label={t('ui.pagePrev')}
          onClick={() => window.dispatchEvent(new CustomEvent('notetopia-world-page', { detail: { dir: -1 } }))}
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          className="btn-icon-tool"
          title={t('ui.pageNextHint')}
          aria-label={t('ui.pageNext')}
          onClick={() => window.dispatchEvent(new CustomEvent('notetopia-world-page', { detail: { dir: 1 } }))}
        >
          <ChevronsRight size={16} />
        </button>
        {compactChrome && onTogglePanel ? (
          <>
            <span className="world-page-skip-rule" aria-hidden />
            <button
              type="button"
              className={`btn-icon-tool${panelOpen ? ' active' : ''}`}
              title={t('ui.worldPanel')}
              aria-label={t('ui.worldPanel')}
              aria-pressed={panelOpen}
              onClick={onTogglePanel}
            >
              <SlidersHorizontal size={16} />
            </button>
          </>
        ) : null}
      </div>
      {hoverTip && (
        <div ref={hoverTipRef} className="world-hover-tip">
          {hoverTip}
        </div>
      )}
      <AudioRackOverlay target={rackEdit} onClose={() => setRackEdit(null)} />
    </div>
  )
}
