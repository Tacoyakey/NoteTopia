import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Song, Note, Track, WorldSettings, SnapValue } from '../music/types'
import { cloneSong, createNote, createNoteFromTrack, createTrack, addTrack, removeTrack, moveTrack, applyTrackUpdates } from '../music/SongModel'
import { saveProject, loadProject } from '../storage/projects'
import { midiToLine, snapMidiToLine } from '../music/gtPitch'
import { createDemoSong } from '../music/demoSong'
import { getDefaultWorldSettings } from '../world/worldLayout'
import { LANE_HEIGHT, clampLaneHeight } from '../composer/dawLayout'
import { v4 as uuidv4 } from 'uuid'
import { dismissBootSplash } from '../boot/splash'
import { setPlayheadBeat } from '../audio/playheadBus'
import { nextNoteSelection } from '../music/noteSelection'

export type AppMode = 'composer' | 'world'
export type WorldTool = 'select' | 'draw' | 'slice' | 'build'
export type WorldPlace = 'sheet' | 'rack'
export type EditTool = 'select' | 'draw' | 'slice'

interface EditorState {
  song: Song
  worldSettings: WorldSettings
  mode: AppMode
  selectedTrackId: string | null
  selectedNoteIds: Set<string>
  clipboard: { items: { trackId: string; note: Note }[] } | null
  snap: SnapValue
  zoom: number
  laneHeight: number
  scrollBeat: number
  scrollPitch: number
  projectId: string
  isPlaying: boolean
  isLooping: boolean
  currentBeat: number
  worldTool: WorldTool
  worldPlace: WorldPlace
  /** Materials list: ghost other sheet-music types in World. */
  focusMaterial: number | null
  editTool: EditTool
  ghostNotes: boolean
  quantizeStrength: number
  /** Bumped to snap World camera to beat 0 without smoothing. */
  viewEpoch: number
}

type Action =
  | { type: 'SET_SONG'; song: Song }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_MODE'; mode: AppMode }
  | { type: 'SELECT_TRACK'; trackId: string }
  | { type: 'SELECT_NOTES'; noteIds: string[]; additive?: boolean; toggle?: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'ADD_NOTE'; trackId: string; note: Note }
  | { type: 'ADD_NOTES'; trackId: string; notes: Note[] }
  | { type: 'REMOVE_NOTE'; trackId: string; noteId: string }
  | { type: 'DELETE_SELECTED_NOTES' }
  | { type: 'UPDATE_NOTE'; trackId: string; noteId: string; updates: Partial<Note> }
  | { type: 'PATCH_NOTES'; patches: { trackId: string; noteId: string; updates: Partial<Note> }[] }
  | { type: 'MOVE_SELECTED_NOTES'; dBeat: number; dPitch: number }
  | { type: 'ADD_TRACK'; track?: Track; afterTrackId?: string }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'MOVE_TRACK'; trackId: string; toIndex: number }
  | { type: 'UPDATE_TRACK'; trackId: string; updates: Partial<Track> }
  | { type: 'COPY' }
  | { type: 'PASTE'; atBeat?: number }
  | { type: 'DUPLICATE' }
  | { type: 'SET_SNAP'; snap: SnapValue }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_LANE_HEIGHT'; laneHeight: number }
  | { type: 'SET_SCROLL'; scrollBeat?: number; scrollPitch?: number }
  | { type: 'SET_WORLD_SETTINGS'; settings: Partial<WorldSettings> }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_LOOPING'; isLooping: boolean }
  | { type: 'SET_CURRENT_BEAT'; beat: number }
  | { type: 'SET_WORLD_TOOL'; tool: WorldTool }
  | { type: 'SET_WORLD_PLACE'; place: WorldPlace }
  | { type: 'SET_FOCUS_MATERIAL'; numType: number | null }
  | { type: 'SET_EDIT_TOOL'; tool: EditTool }
  | { type: 'SET_GHOST_NOTES'; ghostNotes: boolean }
  | { type: 'SET_QUANTIZE_STRENGTH'; strength: number }
  | { type: 'LOAD_PROJECT'; song: Song; worldSettings: WorldSettings; projectId: string }
  | { type: 'GO_TO_START' }

const demoSong = createDemoSong()

const initialState: EditorState = {
  song: demoSong,
  worldSettings: getDefaultWorldSettings(),
  mode: 'world',
  selectedTrackId: demoSong.tracks[0]?.id ?? null,
  selectedNoteIds: new Set(),
  clipboard: null,
  snap: 16,
  zoom: 48,
  laneHeight: LANE_HEIGHT,
  scrollBeat: 0,
  scrollPitch: 24,
  projectId: uuidv4(),
  isPlaying: false,
  isLooping: false,
  currentBeat: 0,
  worldTool: 'select',
  worldPlace: 'sheet',
  focusMaterial: null,
  editTool: 'select',
  ghostNotes: true,
  quantizeStrength: 100,
  viewEpoch: 0,
}

function snapViewToStart(state: EditorState): EditorState {
  setPlayheadBeat(0)
  return {
    ...state,
    currentBeat: 0,
    scrollBeat: 0,
    isPlaying: false,
    viewEpoch: state.viewEpoch + 1,
  }
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_SONG':
      return { ...state, song: action.song }

    case 'SET_BPM':
      return { ...state, song: { ...state.song, bpm: action.bpm } }

    case 'SET_NAME':
      return { ...state, song: { ...state.song, name: action.name } }

    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'SELECT_TRACK':
      return { ...state, selectedTrackId: action.trackId, worldPlace: 'sheet' }

    case 'SELECT_NOTES': {
      const mode = action.toggle ? 'toggle' : action.additive ? 'add' : 'replace'
      return { ...state, selectedNoteIds: nextNoteSelection(state.selectedNoteIds, action.noteIds, mode) }
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedNoteIds: new Set() }

    case 'ADD_NOTE': {
      const tracks = state.song.tracks.map((t) =>
        t.id === action.trackId ? { ...t, notes: [...t.notes, action.note] } : t,
      )
      return {
        ...state,
        song: { ...state.song, tracks },
        selectedNoteIds: new Set([action.note.id]),
      }
    }

    case 'ADD_NOTES': {
      if (action.notes.length === 0) return state
      const tracks = state.song.tracks.map((t) =>
        t.id === action.trackId ? { ...t, notes: [...t.notes, ...action.notes] } : t,
      )
      return {
        ...state,
        song: { ...state.song, tracks },
        selectedNoteIds: new Set(action.notes.map((note) => note.id)),
      }
    }

    case 'REMOVE_NOTE': {
      const tracks = state.song.tracks.map((t) =>
        t.id === action.trackId
          ? { ...t, notes: t.notes.filter((n) => n.id !== action.noteId) }
          : t,
      )
      const selectedNoteIds = new Set(state.selectedNoteIds)
      selectedNoteIds.delete(action.noteId)
      return { ...state, song: { ...state.song, tracks }, selectedNoteIds }
    }

    case 'DELETE_SELECTED_NOTES': {
      const ids = state.selectedNoteIds
      const tracks = state.song.tracks.map((t) => ({
        ...t,
        notes: t.notes.filter((n) => !ids.has(n.id)),
      }))
      return {
        ...state,
        song: { ...state.song, tracks },
        selectedNoteIds: new Set(),
      }
    }

    case 'UPDATE_NOTE': {
      const tracks = state.song.tracks.map((t) =>
        t.id === action.trackId
          ? {
              ...t,
              notes: t.notes.map((n) =>
                n.id === action.noteId ? { ...n, ...action.updates } : n,
              ),
            }
          : t,
      )
      return { ...state, song: { ...state.song, tracks } }
    }

    case 'PATCH_NOTES': {
      if (action.patches.length === 0) return state
      const byTrack = new Map<string, Map<string, Partial<Note>>>()
      for (const patch of action.patches) {
        let notes = byTrack.get(patch.trackId)
        if (!notes) {
          notes = new Map()
          byTrack.set(patch.trackId, notes)
        }
        notes.set(patch.noteId, patch.updates)
      }
      const tracks = state.song.tracks.map((t) => {
        const notes = byTrack.get(t.id)
        if (!notes) return t
        return {
          ...t,
          notes: t.notes.map((n) => (notes.has(n.id) ? { ...n, ...notes.get(n.id) } : n)),
        }
      })
      return { ...state, song: { ...state.song, tracks } }
    }

    case 'MOVE_SELECTED_NOTES': {
      const ids = state.selectedNoteIds
      const tracks = state.song.tracks.map((t) => ({
        ...t,
        notes: t.notes.map((n) =>
          ids.has(n.id)
            ? (() => {
                const pitch = snapMidiToLine(Math.max(36, Math.min(96, n.pitch + action.dPitch)))
                return {
                  ...n,
                  startBeat: Math.max(0, n.startBeat + action.dBeat),
                  pitch,
                  pitchLine: midiToLine(pitch),
                }
              })()
            : n,
        ),
      }))
      return { ...state, song: { ...state.song, tracks } }
    }

    case 'ADD_TRACK': {
      const track = action.track ?? createTrack(`Track ${state.song.tracks.length + 1}`)
      return {
        ...state,
        song: addTrack(state.song, track, action.afterTrackId),
        selectedTrackId: track.id,
      }
    }

    case 'REMOVE_TRACK': {
      if (state.song.tracks.length <= 1) return state
      const song = removeTrack(state.song, action.trackId)
      return {
        ...state,
        song,
        selectedTrackId: song.tracks[0]?.id ?? null,
        selectedNoteIds: new Set(),
      }
    }

    case 'MOVE_TRACK': {
      const song = moveTrack(state.song, action.trackId, action.toIndex)
      if (song === state.song) return state
      return { ...state, song }
    }

    case 'UPDATE_TRACK':
      return {
        ...state,
        song: {
          ...state.song,
          tracks: state.song.tracks.map((t) =>
            t.id === action.trackId ? applyTrackUpdates(t, action.updates) : t,
          ),
        },
      }

    case 'COPY': {
      const items: { trackId: string; note: Note }[] = []
      for (const track of state.song.tracks) {
        for (const note of track.notes) {
          if (state.selectedNoteIds.has(note.id)) items.push({ trackId: track.id, note: { ...note } })
        }
      }
      if (items.length === 0) return state
      return { ...state, clipboard: { items } }
    }

    case 'PASTE': {
      if (!state.clipboard?.items.length) return state
      const atBeat = action.atBeat ?? state.currentBeat
      const minStart = Math.min(...state.clipboard.items.map((i) => i.note.startBeat))
      const newIds = new Set<string>()
      const added = new Map<string, Note[]>()
      for (const item of state.clipboard.items) {
        const note = {
          ...item.note,
          id: uuidv4(),
          startBeat: atBeat + (item.note.startBeat - minStart),
        }
        newIds.add(note.id)
        const trackId = state.song.tracks.some((t) => t.id === item.trackId)
          ? item.trackId
          : state.song.tracks.some((t) => t.id === state.selectedTrackId)
            ? state.selectedTrackId!
            : state.song.tracks[0]?.id
        if (!trackId) continue
        const list = added.get(trackId) ?? []
        list.push(note)
        added.set(trackId, list)
      }
      const tracks = state.song.tracks.map((t) =>
        added.has(t.id) ? { ...t, notes: [...t.notes, ...(added.get(t.id) ?? [])] } : t,
      )
      return {
        ...state,
        song: { ...state.song, tracks },
        selectedNoteIds: newIds,
      }
    }

    case 'DUPLICATE': {
      if (state.selectedNoteIds.size === 0) return state
      let minStart = Infinity
      let maxEnd = -Infinity
      for (const track of state.song.tracks) {
        for (const note of track.notes) {
          if (!state.selectedNoteIds.has(note.id)) continue
          minStart = Math.min(minStart, note.startBeat)
          maxEnd = Math.max(maxEnd, note.startBeat + note.durationBeats)
        }
      }
      if (!Number.isFinite(minStart)) return state
      const span = Math.max(4 / state.snap, maxEnd - minStart)
      const newIds = new Set<string>()
      const tracks = state.song.tracks.map((t) => ({
        ...t,
        notes: [
          ...t.notes,
          ...t.notes
            .filter((n) => state.selectedNoteIds.has(n.id))
            .map((n) => {
              const copy = { ...n, id: uuidv4(), startBeat: n.startBeat + span }
              newIds.add(copy.id)
              return copy
            }),
        ],
      }))
      return {
        ...state,
        song: { ...state.song, tracks },
        selectedNoteIds: newIds,
      }
    }

    case 'SET_SNAP':
      return { ...state, snap: action.snap }

    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom }

    case 'SET_LANE_HEIGHT':
      return { ...state, laneHeight: clampLaneHeight(action.laneHeight) }

    case 'SET_SCROLL':
      return {
        ...state,
        scrollBeat: action.scrollBeat ?? state.scrollBeat,
        scrollPitch: action.scrollPitch ?? state.scrollPitch,
      }

    case 'SET_WORLD_SETTINGS':
      return { ...state, worldSettings: { ...state.worldSettings, ...action.settings } }

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying }

    case 'SET_LOOPING':
      return { ...state, isLooping: action.isLooping }

    case 'SET_CURRENT_BEAT':
      setPlayheadBeat(action.beat)
      return { ...state, currentBeat: action.beat }

    case 'SET_WORLD_TOOL': {
      const raw = action.tool as string
      const tool: WorldTool =
        raw === 'explore' ? 'select' : raw === 'draw' || raw === 'slice' || raw === 'build' || raw === 'select' ? raw : 'select'
      return {
        ...state,
        worldTool: tool,
        editTool: tool === 'build' ? state.editTool : tool,
      }
    }

    case 'SET_WORLD_PLACE':
      return { ...state, worldPlace: action.place }

    case 'SET_FOCUS_MATERIAL':
      return { ...state, focusMaterial: action.numType }

    case 'SET_EDIT_TOOL':
      return {
        ...state,
        editTool: action.tool,
        worldTool: state.worldTool === 'build' ? 'build' : action.tool,
      }

    case 'SET_GHOST_NOTES':
      return { ...state, ghostNotes: action.ghostNotes }

    case 'SET_QUANTIZE_STRENGTH':
      return { ...state, quantizeStrength: Math.max(0, Math.min(100, Math.round(action.strength))) }

    case 'GO_TO_START':
      return snapViewToStart(state)

    case 'LOAD_PROJECT':
      return {
        ...snapViewToStart(state),
        song: action.song,
        worldSettings: { ...getDefaultWorldSettings(), ...action.worldSettings },
        projectId: action.projectId,
        selectedTrackId: action.song.tracks[0]?.id ?? null,
        selectedNoteIds: new Set(),
        focusMaterial: null,
      }

    default:
      return state
  }
}

interface SongContextValue {
  state: EditorState
  dispatch: React.Dispatch<Action>
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

interface HistorySnapshot {
  song: Song
  worldSettings: WorldSettings
}

const SongContext = createContext<SongContextValue | null>(null)

const LAST_PROJECT_KEY = 'music-world-last-project'

export function SongProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const historyRef = useRef<HistorySnapshot[]>([
    { song: cloneSong(initialState.song), worldSettings: { ...initialState.worldSettings } },
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const lastId = localStorage.getItem(LAST_PROJECT_KEY)
        if (lastId) {
          const project = await loadProject(lastId)
          if (!cancelled && project) {
            dispatch({
              type: 'LOAD_PROJECT',
              song: project.song,
              worldSettings: { ...getDefaultWorldSettings(), ...project.worldSettings },
              projectId: project.id,
            })
          }
        }
      } catch {
        /* keep demo song */
      } finally {
        if (!cancelled) {
          setHydrated(true)
          dismissBootSplash()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Reset only when the loaded project changes, not on every song edit.
  useEffect(() => {
    if (!hydrated) return
    historyRef.current = [
      { song: cloneSong(state.song), worldSettings: { ...state.worldSettings } },
    ]
    setHistoryIndex(0)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.projectId])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      void saveProject(state.projectId, state.song.name, state.song, state.worldSettings)
        .then(() => localStorage.setItem(LAST_PROJECT_KEY, state.projectId))
        .catch(() => {})
    }, 800)
    return () => window.clearTimeout(timer)
  }, [hydrated, state.projectId, state.song, state.worldSettings])

  const pushHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      song: cloneSong(state.song),
      worldSettings: { ...state.worldSettings },
    }
    const newHistory = historyRef.current.slice(0, historyIndex + 1)
    newHistory.push(snapshot)
    if (newHistory.length > 100) newHistory.shift()
    historyRef.current = newHistory
    setHistoryIndex(newHistory.length - 1)
  }, [state.song, state.worldSettings, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const snap = historyRef.current[newIndex]
      dispatch({ type: 'SET_SONG', song: cloneSong(snap.song) })
      dispatch({ type: 'SET_WORLD_SETTINGS', settings: { ...getDefaultWorldSettings(), ...snap.worldSettings } })
    }
  }, [historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < historyRef.current.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const snap = historyRef.current[newIndex]
      dispatch({ type: 'SET_SONG', song: cloneSong(snap.song) })
      dispatch({ type: 'SET_WORLD_SETTINGS', settings: { ...getDefaultWorldSettings(), ...snap.worldSettings } })
    }
  }, [historyIndex])

  const value = useMemo<SongContextValue>(
    () => ({
      state,
      dispatch,
      pushHistory,
      undo,
      redo,
      canUndo: historyIndex > 0,
      canRedo: historyIndex < historyRef.current.length - 1,
    }),
    [state, dispatch, pushHistory, undo, redo, historyIndex],
  )

  if (!hydrated) {
    return <SongContext.Provider value={value}>{null}</SongContext.Provider>
  }

  return <SongContext.Provider value={value}>{children}</SongContext.Provider>
}

export function useSong(): SongContextValue {
  const ctx = useContext(SongContext)
  if (!ctx) throw new Error('useSong must be used within SongProvider')
  return ctx
}

export { createNote, createNoteFromTrack }
