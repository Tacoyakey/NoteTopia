import { GT_COLUMNS_PER_BEAT, lineToMidi, midiToLine } from '../../gtPitch'
import type { Note } from '../../types'

/** GM percussion → Growtopia drum lanes (1 = B top … 14 = c bottom). */
export const DRUM_MIDI_TO_LINE: Record<number, number> = {
  35: 14,
  36: 14,
  37: 12,
  38: 11,
  39: 9,
  40: 11,
  41: 13,
  43: 13,
  45: 10,
  47: 10,
  48: 7,
  50: 7,
  42: 5,
  44: 5,
  46: 3,
  49: 2,
  57: 2,
  51: 4,
  59: 4,
  53: 4,
  54: 6,
  56: 6,
  27: 12,
  28: 12,
  31: 9,
  33: 14,
  34: 14,
}

const HAT = new Set([42, 44, 46])
const TOM = new Set([41, 43, 45, 47, 48, 50])
const CYMBAL = new Set([49, 51, 52, 53, 55, 57, 59])
const KICK = new Set([33, 34, 35, 36])
const SNARE = new Set([38, 40])

export function mapDrumLine(midi: number, compact: boolean): number {
  if (compact) {
    if (HAT.has(midi)) return 5
    if (TOM.has(midi)) return 10
    if (CYMBAL.has(midi)) return 2
  }
  return DRUM_MIDI_TO_LINE[midi] ?? 11
}

export function mapDrumPitch(midi: number, compact: boolean): number {
  return lineToMidi(mapDrumLine(midi, compact))
}

export function isGhostHat(midi: number, velocity: number, threshold: number): boolean {
  return HAT.has(midi) && velocity < threshold
}

export function dropHatsUnderKickSnare(notes: Note[]): Note[] {
  const kicks = new Set<number>()
  for (const note of notes) {
    if (KICK.has(note.pitch) || SNARE.has(note.pitch)) {
      kicks.add(Math.round(note.startBeat * GT_COLUMNS_PER_BEAT))
    }
  }
  return notes.filter((note) => {
    if (!HAT.has(note.pitch)) return true
    return !kicks.has(Math.round(note.startBeat * GT_COLUMNS_PER_BEAT))
  })
}

export function withDrumFields(note: Note, compact: boolean): Note {
  const pitch = mapDrumPitch(note.pitch, compact)
  return {
    ...note,
    pitch,
    pitchLine: midiToLine(pitch),
    durationBeats: 0.25,
  }
}
