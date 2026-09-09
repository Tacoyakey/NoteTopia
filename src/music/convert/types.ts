import type { Note, Song } from '../types'
import type { SmartOptions } from './smart/options'

export type ConvertModelId = string

export interface ArrangeDecision {
  noteId: string
  fromPitch: number
  toPitch: number | null
  reason: string
}

export interface ConvertStats {
  notesIn: number
  notesOut: number
  overlapsResolved: number
  snappedToGrid: number
  racksCreated?: number
  keyShift?: number
  warnings?: string[]
  columns?: number
  bpmIn?: number
  bpmOut?: number
  droppedOrnaments?: number
  thinnedChords?: number
  detectedKey?: string
  notesPreserved?: number
  notesOctaveShifted?: number
  notesTransposed?: number
  notesRemoved?: number
  notesSimplified?: number
  chordsSimplified?: number
  melodicNotesPreserved?: number
  melodicContourChanges?: number
  averageMelodicIntervalChange?: number
  maximumMelodicJump?: number
  voiceLeadingMovement?: number
  repeatedMotifsPreserved?: number
  rhythmPreserved?: number
  polyphonyReductions?: number
  arrangementScore?: number
  decisions?: ArrangeDecision[]
}

export type ConvertStage =
  | 'analyze'
  | 'layers'
  | 'snapping'
  | 'racks'
  | 'repeats'
  | 'gaps'
  | 'packing'

export interface ConvertProgress {
  ratio: number
  stage: ConvertStage
}

export interface ConvertBakeOptions {
  /** Pack overflowing sheets tighter. Empty pauses always become Repeat Begin/End. */
  compress?: boolean
  /** 1.5: transpose so more notes fit the two-octave staff without octave jumps. */
  fitKey?: boolean
  /** 1.5: sit the melody lower on the staff when it still fits. */
  preferLow?: boolean
  /** Skip Repeat Begin/End packing so the UI can run it with progress. */
  skipFinish?: boolean
  /** Adapt (v3) knobs. Ignored by Basic / Preserve. */
  smart?: SmartOptions
  /** Pack until the sheet is at most this many columns. */
  targetColumns?: number
  /** Stop BPM-halving once tempo would drop below this. */
  minBpm?: number
}

export interface ConvertResult {
  song: Song
  stats: ConvertStats
}

export interface TileOccupant {
  trackId: string
  noteId: string
}

/** A named MIDI → Growtopia sheet method. Add new files and register them — old songs keep their saved id. */
export interface ConvertModel {
  id: ConvertModelId
  /** Internal codename, e.g. "1.0" / "1.5" / "2.0". UI uses `label`. */
  tag: string
  label: string
  description: string
  recommended?: boolean
  /** Shown with an Experimental badge; gated by EXPERIMENTAL_CONVERT. */
  experimental?: boolean
  occupant(song: Song, beat: number, pitchLine: number): TileOccupant | null
  bake(song: Song, options?: ConvertBakeOptions): ConvertResult
}

export function noteColumn(note: Note): number {
  return Math.round(note.startBeat * 4)
}
