export interface AudioRackData {
  /** Growtopia wrench volume, 1–100 (100 = standard sheet volume). */
  volume: number
  /** Up to five `P A #` tokens, spaces optional. Example: `PA# DB- BCb`. */
  notes: string
}

export interface Note {
  id: string
  pitch: number
  startBeat: number
  durationBeats: number
  velocity: number
  /** Growtopia pitch lane 1–14 (B top → c bottom) */
  pitchLine?: number
  gtVariant?: 'natural' | 'flat' | 'sharp'
  gtNumType?: number
  /** Present when this tile is an Audio Rack instead of a single sheet block. */
  audioRack?: AudioRackData
}

export interface Track {
  id: string
  name: string
  instrument: InstrumentId
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  notes: Note[]
  /** Original General MIDI program, when this track came from MIDI import. */
  gmProgram?: number
  /** Sample folder stem for WAV lookup (e.g. "piano", "bass") */
  gtStem?: string
  gtNumType?: number
  gtVariant?: 'natural' | 'flat' | 'sharp'
}

export interface TimeSignature {
  numerator: number
  denominator: number
}

export interface Song {
  version: number
  name: string
  bpm: number
  timeSignature: TimeSignature
  tracks: Track[]
}

export type InstrumentId =
  | 'piano'
  | 'bass'
  | 'drums'
  | 'sax'
  | 'flute'
  | 'guitar'
  | 'electric-guitar'
  | 'violin'
  | 'lyre'
  | 'trumpet'
  | 'spooky'
  | 'winterfest'
  | 'synth'
  | 'bell'

export const INSTRUMENTS: { id: InstrumentId; label: string; color: string }[] = [
  { id: 'piano', label: 'Piano', color: '#6c9eff' },
  { id: 'bass', label: 'Bass', color: '#ff6c9e' },
  { id: 'drums', label: 'Drums', color: '#ff6c6c' },
  { id: 'sax', label: 'Sax', color: '#ffaa6c' },
  { id: 'flute', label: 'Flute', color: '#6cffcc' },
  { id: 'guitar', label: 'Spanish Guitar', color: '#6cff9e' },
  { id: 'electric-guitar', label: 'Electric Guitar', color: '#ff9e6c' },
  { id: 'violin', label: 'Violin', color: '#c96cff' },
  { id: 'lyre', label: 'Lyre', color: '#ffae7c' },
  { id: 'trumpet', label: 'Mexican Trumpet', color: '#ffd56c' },
  { id: 'spooky', label: 'Spooky', color: '#aa66ff' },
  { id: 'winterfest', label: 'Winterfest', color: '#e05048' },
  { id: 'synth', label: 'Synth', color: '#9e6cff' },
  { id: 'bell', label: 'Bell', color: '#ffe06c' },
]

export type SnapValue = 4 | 8 | 16 | 32

export type WorldWeather =
  | 'sunny'
  | 'night'
  | 'beach'
  | 'snowy'
  | 'snowy-night'
  | 'galactic'
  | 'petal-haven'
  | 'void'
  | 'solid'
/** @deprecated use WorldWeather */
export type WorldTheme = WorldWeather

export interface WorldSettings {
  density: number
  autoCompress: boolean
  followPlayhead: boolean
  zoom: number
  /** Use 14-lane Growtopia-style grid in World Mode */
  gtGrid: boolean
  /** Prefer WAV samples from /notes/ when available */
  useSamples: boolean
  /** World backdrop. Older saves used `theme`. */
  theme: WorldWeather
  solidColor?: string
  /** MIDI → Growtopia convert method id (`v1`, `v1.5-beta`, …). Missing on old saves. */
  convertModel?: string
  /** Pad GMSF / World empty columns to at least this width. */
  songLengthColumns?: number
  /** Loop range in beats. Ignored when looping is off. */
  loopStartBeat?: number
  loopEndBeat?: number
  /** Composer piano-roll / arrange follow the playhead while playing. */
  composerFollowPlayhead?: boolean
  metronome?: boolean
}

export interface ProjectData {
  id: string
  name: string
  song: Song
  worldSettings: WorldSettings
  createdAt: number
  updatedAt: number
}

export interface PlaybackState {
  isPlaying: boolean
  isLooping: boolean
  currentBeat: number
}

export interface MidiImportSummary {
  trackCount: number
  noteCount: number
  bpm: number
  durationBeats: number
  convertTag?: string
  overlapsResolved?: number
  kind?: 'midi' | 'gt' | 'layers' | 'project'
  /** MIDI tempo events. Growtopia sheets only keep one BPM. */
  tempoChanges?: number
  keyShift?: number
  racksCreated?: number
  columns?: number
  warning?: string
}
