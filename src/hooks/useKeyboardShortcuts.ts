import { useEffect, useCallback, useRef } from 'react'
import { useSong } from '../context/SongContext'
import { audioEngine } from '../audio/AudioEngine'
import { sampleBank } from '../audio/SampleBank'
import { getPlayheadBeat } from '../audio/playheadBus'
import { getPlaybackDurationBeats } from '../music/timing'
import { stopAndSnapToStart } from '../audio/seekPlayback'
import type { SnapValue } from '../music/types'
import { isTypingTarget } from '../dom/focus'
import { quantizeSongNotes } from '../music/quantize'
import { replaceSelectedWithTrack, selectSamePitchIds, sliceSongAtBeat } from '../music/editTools'
import { EDIT_TOOLS, WORLD_TOOLS } from '../components/editToolDefs'
import { showActionToast } from '../components/actionToast'
import { t } from '../i18n/i18n'

export function useKeyboardShortcuts() {
  const { state, dispatch, undo, redo, pushHistory } = useSong()
  const stateRef = useRef(state)
  stateRef.current = state
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo
  const pushHistoryRef = useRef(pushHistory)
  pushHistoryRef.current = pushHistory

  const playFrom = useCallback(async (beat: number) => {
    const s = stateRef.current
    const d = dispatchRef.current
    audioEngine.setLooping(s.isLooping)
    audioEngine.refreshInstruments(s.song)
    d({ type: 'SET_CURRENT_BEAT', beat })
    await audioEngine.play(s.song, beat)
    d({ type: 'SET_PLAYING', isPlaying: true })
  }, [])

  const togglePlay = useCallback(async () => {
    const s = stateRef.current
    const d = dispatchRef.current
    if (s.isPlaying) {
      audioEngine.pause()
      d({ type: 'SET_CURRENT_BEAT', beat: getPlayheadBeat() })
      d({ type: 'SET_PLAYING', isPlaying: false })
    } else {
      await playFrom(getPlayheadBeat())
    }
  }, [playFrom])

  const goToBeat = useCallback((beat: number) => {
    const s = stateRef.current
    const next = Math.max(0, beat)
    dispatchRef.current({ type: 'SET_CURRENT_BEAT', beat: next })
    if (s.isPlaying) audioEngine.seekToBeat(next, s.song.bpm)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      const d = dispatchRef.current
      const push = pushHistoryRef.current

      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (e.code === 'Space') {
        e.preventDefault()
        if (e.shiftKey) {
          void playFrom(0)
        } else {
          void togglePlay()
        }
        return
      }

      if (e.key === 'Escape') {
        d({ type: 'CLEAR_SELECTION' })
        if (s.focusMaterial != null) d({ type: 'SET_FOCUS_MATERIAL', numType: null })
        return
      }

      if (!mod && (e.key === 'Home' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        if (s.isPlaying) {
          goToBeat(0)
        } else {
          stopAndSnapToStart(d)
        }
        return
      }

      if (!mod && e.key === 'End') {
        e.preventDefault()
        goToBeat(getPlaybackDurationBeats(s.song))
        return
      }

      if (!mod && key === 'l') {
        e.preventDefault()
        const next = !s.isLooping
        d({ type: 'SET_LOOPING', isLooping: next })
        audioEngine.setLooping(next)
        return
      }

      if (!mod && key === 'm' && s.selectedTrackId) {
        e.preventDefault()
        const track = s.song.tracks.find((t) => t.id === s.selectedTrackId)
        if (!track) return
        push()
        d({
          type: 'UPDATE_TRACK',
          trackId: track.id,
          updates: { muted: !track.muted },
        })
        return
      }

      if (!mod && key === 's' && s.selectedTrackId) {
        e.preventDefault()
        const track = s.song.tracks.find((t) => t.id === s.selectedTrackId)
        if (!track) return
        push()
        d({
          type: 'UPDATE_TRACK',
          trackId: track.id,
          updates: { solo: !track.solo, muted: false },
        })
        return
      }

      if (s.mode === 'world' && !mod && key === 'b') {
        e.preventDefault()
        d({ type: 'SET_WORLD_TOOL', tool: 'build' })
        return
      }

      if (s.mode === 'world' && !mod && key === 'v') {
        e.preventDefault()
        d({ type: 'SET_WORLD_TOOL', tool: 'select' })
        return
      }

      if (s.mode === 'world' && !mod && !e.shiftKey && key === 'r') {
        e.preventDefault()
        d({ type: 'SET_WORLD_TOOL', tool: 'build' })
        d({ type: 'SET_WORLD_PLACE', place: 'rack' })
        return
      }

      if (s.mode === 'world' && !mod && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const tracks = s.song.tracks
        if (tracks.length === 0) return
        const i = Math.max(0, tracks.findIndex((track) => track.id === s.selectedTrackId))
        const dir = e.key === ']' ? 1 : -1
        const next = tracks[(i + dir + tracks.length) % tracks.length]
        d({ type: 'SELECT_TRACK', trackId: next.id })
        d({ type: 'SET_WORLD_PLACE', place: 'sheet' })
        d({ type: 'SET_WORLD_TOOL', tool: 'build' })
        return
      }

      if (s.mode === 'world' && !mod && (e.key === ',' || e.key === '.')) {
        e.preventDefault()
        window.dispatchEvent(
          new CustomEvent('notetopia-world-page', { detail: { dir: e.key === '.' ? 1 : -1 } }),
        )
        return
      }

      if (s.mode === 'composer' && !mod && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const beat = getPlayheadBeat()
        if (e.key === '[') {
          d({ type: 'SET_WORLD_SETTINGS', settings: { loopStartBeat: beat } })
        } else {
          const start = s.worldSettings.loopStartBeat ?? 0
          d({
            type: 'SET_WORLD_SETTINGS',
            settings: beat > start ? { loopEndBeat: beat } : { loopStartBeat: beat, loopEndBeat: start },
          })
        }
        return
      }

      if (!mod && key === 't') {
        e.preventDefault()
        if (s.mode === 'world') {
          const i = Math.max(0, WORLD_TOOLS.indexOf(s.worldTool))
          d({ type: 'SET_WORLD_TOOL', tool: WORLD_TOOLS[(i + 1) % WORLD_TOOLS.length] })
        } else {
          const i = EDIT_TOOLS.indexOf(s.editTool)
          d({ type: 'SET_EDIT_TOOL', tool: EDIT_TOOLS[(i + 1) % EDIT_TOOLS.length] })
        }
        return
      }

      if (!mod && key === 'q') {
        e.preventDefault()
        const ids = s.selectedNoteIds.size > 0 ? s.selectedNoteIds : null
        const patches = quantizeSongNotes(s.song, ids, s.snap, s.quantizeStrength)
        if (!patches.length) return
        push()
        d({ type: 'PATCH_NOTES', patches })
        return
      }

      if (!mod && key === 'e') {
        e.preventDefault()
        push()
        d({
          type: 'SET_SONG',
          song: sliceSongAtBeat(s.song, getPlayheadBeat(), s.selectedNoteIds.size > 0 ? s.selectedNoteIds : null),
        })
        return
      }

      if (!mod && key === 'p') {
        e.preventDefault()
        if (s.selectedNoteIds.size === 0) return
        d({
          type: 'SELECT_NOTES',
          noteIds: selectSamePitchIds(s.song, s.selectedNoteIds, !e.shiftKey),
        })
        return
      }

      if (!mod && key === 'g') {
        e.preventDefault()
        const next = !s.ghostNotes
        d({ type: 'SET_GHOST_NOTES', ghostNotes: next })
        showActionToast(t(next ? 'ui.ghostNotesOn' : 'ui.ghostNotesOff'))
        return
      }

      if (!mod && key === 'u') {
        e.preventDefault()
        const next = !s.worldSettings.metronome
        d({
          type: 'SET_WORLD_SETTINGS',
          settings: { metronome: next },
        })
        showActionToast(t(next ? 'ui.metronomeOn' : 'ui.metronomeOff'))
        return
      }

      if (!mod && e.shiftKey && key === 'r') {
        e.preventDefault()
        const track = s.song.tracks.find((item) => item.id === s.selectedTrackId)
        if (!track || s.selectedNoteIds.size === 0) return
        const patches = replaceSelectedWithTrack(s.song, s.selectedNoteIds, track)
        if (!patches.length) return
        push()
        d({ type: 'PATCH_NOTES', patches })
        return
      }

      if (!mod && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        const snap: SnapValue = e.key === '1' ? 4 : e.key === '2' ? 8 : e.key === '3' ? 16 : 32
        d({ type: 'SET_SNAP', snap })
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedNoteIds.size > 0) {
          e.preventDefault()
          push()
          d({ type: 'DELETE_SELECTED_NOTES' })
        }
        return
      }

      if (mod && key === 's') {
        e.preventDefault()
        window.dispatchEvent(new Event('music-world-save'))
        return
      }

      if (mod && key === 'o') {
        e.preventDefault()
        window.dispatchEvent(new Event('music-world-open-projects'))
        return
      }

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
        return
      }

      if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
        e.preventDefault()
        redoRef.current()
        return
      }

      if (mod && key === 'c') {
        e.preventDefault()
        d({ type: 'COPY' })
        return
      }

      if (mod && key === 'x') {
        e.preventDefault()
        if (s.selectedNoteIds.size === 0) return
        d({ type: 'COPY' })
        push()
        d({ type: 'DELETE_SELECTED_NOTES' })
        return
      }

      if (mod && key === 'v') {
        e.preventDefault()
        push()
        d({ type: 'PASTE', atBeat: getPlayheadBeat() })
        return
      }

      if (mod && key === 'd') {
        e.preventDefault()
        if (s.selectedNoteIds.size === 0) return
        push()
        d({ type: 'DUPLICATE' })
        return
      }

      if (mod && key === 'a') {
        e.preventDefault()
        if (e.shiftKey) {
          d({
            type: 'SELECT_NOTES',
            noteIds: s.song.tracks.flatMap((t) => t.notes.map((n) => n.id)),
          })
          return
        }
        const track = s.song.tracks.find((t) => t.id === s.selectedTrackId)
        if (track) d({ type: 'SELECT_NOTES', noteIds: track.notes.map((n) => n.id) })
        return
      }

      if (mod && (e.key === '=' || e.key === '+' || e.code === 'Equal')) {
        e.preventDefault()
        d({ type: 'SET_ZOOM', zoom: Math.min(120, s.zoom + 8) })
        return
      }

      if (mod && (e.key === '-' || e.code === 'Minus')) {
        e.preventDefault()
        d({ type: 'SET_ZOOM', zoom: Math.max(24, s.zoom - 8) })
        return
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (s.selectedNoteIds.size === 0) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault()
            const step = e.shiftKey ? 0.25 : 4 / s.snap
            const delta = e.key === 'ArrowRight' ? step : -step
            goToBeat(getPlayheadBeat() + delta)
          }
          return
        }
        e.preventDefault()
        const step = e.shiftKey ? 0.25 : 4 / s.snap
        const dBeat = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
        const dPitch = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
        push()
        d({ type: 'MOVE_SELECTED_NOTES', dBeat, dPitch })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, playFrom, goToBeat])
}

export function useAudioSync() {
  const { dispatch, state } = useSong()

  useEffect(() => {
    audioEngine.setBeatCallback(() => {
      /* canvases read getPlayheadBeat(); LCD subscribes separately */
    })
    audioEngine.setEndCallback(() => {
      dispatch({ type: 'SET_CURRENT_BEAT', beat: getPlayheadBeat() })
      dispatch({ type: 'SET_PLAYING', isPlaying: false })
    })
    void sampleBank.probe()
    return () => {
      audioEngine.setBeatCallback(() => {})
      audioEngine.setEndCallback(() => {})
    }
  }, [dispatch])

  useEffect(() => {
    audioEngine.setUseSamples(state.worldSettings.useSamples ?? true)
  }, [state.worldSettings.useSamples])

  useEffect(() => {
    audioEngine.syncLiveSong(state.song)
    audioEngine.setSheetMode(state.mode === 'world')
    audioEngine.setConvertModel(state.worldSettings.convertModel)
  }, [state.song, state.mode, state.worldSettings.convertModel])

  useEffect(() => {
    audioEngine.setLooping(state.isLooping)
    audioEngine.setLoopRange(state.worldSettings.loopStartBeat, state.worldSettings.loopEndBeat)
    audioEngine.setMetronome(!!state.worldSettings.metronome)
  }, [
    state.isLooping,
    state.worldSettings.loopStartBeat,
    state.worldSettings.loopEndBeat,
    state.worldSettings.metronome,
  ])
}
