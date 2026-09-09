/**
 * Growtopia / GTMusicSim pitch-line system.
 * 14 horizontal lanes: B (top) down to c (bottom) — two octaves.
 * Time moves in columns: 4 columns = 1 beat (16th-note steps).
 */

import { t, tf } from '../i18n/i18n'

export type GtVariant = 'natural' | 'flat' | 'sharp'

/** Pitch line 1 = B (top) … 14 = c (bottom) */
export const GT_PITCH_LINE_LABELS = [
  'B', 'A', 'G', 'F', 'E', 'D', 'C', 'b', 'a', 'g', 'f', 'e', 'd', 'c',
] as const

/** MIDI equivalents for each pitch line (Growtopia two-octave range) */
export const GT_LINE_TO_MIDI: readonly number[] = [
  71, 69, 67, 65, 64, 62, 60, 59, 57, 55, 53, 52, 50, 48,
]

export const GT_COLUMNS_PER_BEAT = 4
export const GT_BLOCK_SIZE = 32
export const GT_PITCH_LANES = 14
/** Sheet Music: Repeat Begin (GTMusicSim numType). */
export const GT_REPEAT_BEGIN = 11
/** Sheet Music: Repeat End (GTMusicSim numType). */
export const GT_REPEAT_END = 12
export const GT_BLANK = 13
/** Audio Rack block (not a GTMusicSim numType; stored on the note as well). */
export const GT_AUDIO_RACK = 33

/**
 * WAV index tables from GTMusicSim Constants.js.
 * Chromatic files run 0–25 (c-flat … B-sharp). Naturals skip the black keys;
 * E#/B# reuse the next natural (F/C). Sharps are not “natural index + 1”.
 */
const RANGE_NORMAL = [1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24]
const RANGE_FLAT = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23]
const RANGE_SHARP = [2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 19, 21, 23, 25]
const RANGE_DRUM = [6, 5, 4, 3, 2, 1, 0]

export interface GtInstrumentDef {
  stem: string
  fileStem?: string
  label: string
  hasFlats: boolean
  fullRange: boolean
  color: string
  appInstrument: string
}

export const GT_INSTRUMENTS: Record<number, GtInstrumentDef> = {
  0: { stem: 'piano', label: 'Piano', hasFlats: true, fullRange: true, color: '#6c9eff', appInstrument: 'piano' },
  1: { stem: 'piano', label: 'Flat Piano', hasFlats: true, fullRange: true, color: '#5a8eef', appInstrument: 'piano' },
  2: { stem: 'piano', label: 'Sharp Piano', hasFlats: true, fullRange: true, color: '#7eb0ff', appInstrument: 'piano' },
  3: { stem: 'drum', label: 'Drum', hasFlats: false, fullRange: false, color: '#ff6c6c', appInstrument: 'drums' },
  4: { stem: 'bass', label: 'Bass', hasFlats: true, fullRange: true, color: '#ff6c9e', appInstrument: 'bass' },
  5: { stem: 'bass', label: 'Flat Bass', hasFlats: true, fullRange: true, color: '#ef5a8e', appInstrument: 'bass' },
  6: { stem: 'bass', label: 'Sharp Bass', hasFlats: true, fullRange: true, color: '#ff7eae', appInstrument: 'bass' },
  7: { stem: 'spooky', fileStem: 'spooky', label: 'Spooky', hasFlats: false, fullRange: true, color: '#aa66ff', appInstrument: 'spooky' },
  8: { stem: 'sax', label: 'Sax', hasFlats: true, fullRange: true, color: '#ffaa6c', appInstrument: 'sax' },
  9: { stem: 'sax', label: 'Flat Sax', hasFlats: true, fullRange: true, color: '#ef9a5c', appInstrument: 'sax' },
  10: { stem: 'sax', label: 'Sharp Sax', hasFlats: true, fullRange: true, color: '#ffba7c', appInstrument: 'sax' },
  14: { stem: 'festive', fileStem: 'festive', label: 'Winterfest', hasFlats: false, fullRange: true, color: '#e05048', appInstrument: 'winterfest' },
  15: { stem: 'flute', label: 'Flute', hasFlats: true, fullRange: true, color: '#6cffcc', appInstrument: 'flute' },
  16: { stem: 'flute', label: 'Flat Flute', hasFlats: true, fullRange: true, color: '#5cefc0', appInstrument: 'flute' },
  17: { stem: 'flute', label: 'Sharp Flute', hasFlats: true, fullRange: true, color: '#7cffd8', appInstrument: 'flute' },
  18: { stem: 'spanish_guitar', label: 'Spanish Guitar', hasFlats: true, fullRange: true, color: '#6cff9e', appInstrument: 'guitar' },
  19: { stem: 'spanish_guitar', label: 'Flat Guitar', hasFlats: true, fullRange: true, color: '#5cef8e', appInstrument: 'guitar' },
  20: { stem: 'spanish_guitar', label: 'Sharp Guitar', hasFlats: true, fullRange: true, color: '#7cffae', appInstrument: 'guitar' },
  21: { stem: 'violin', label: 'Violin', hasFlats: true, fullRange: true, color: '#c96cff', appInstrument: 'violin' },
  22: { stem: 'violin', label: 'Flat Violin', hasFlats: true, fullRange: true, color: '#b95cef', appInstrument: 'violin' },
  23: { stem: 'violin', label: 'Sharp Violin', hasFlats: true, fullRange: true, color: '#d97cff', appInstrument: 'violin' },
  24: { stem: 'lyre', label: 'Lyre', hasFlats: true, fullRange: true, color: '#ff9e6c', appInstrument: 'lyre' },
  25: { stem: 'lyre', label: 'Flat Lyre', hasFlats: true, fullRange: true, color: '#ef8e5c', appInstrument: 'lyre' },
  26: { stem: 'lyre', label: 'Sharp Lyre', hasFlats: true, fullRange: true, color: '#ffae7c', appInstrument: 'lyre' },
  27: { stem: 'electric_guitar', label: 'Electric Guitar', hasFlats: true, fullRange: true, color: '#ff9e6c', appInstrument: 'electric-guitar' },
  28: { stem: 'electric_guitar', label: 'Flat E-Guitar', hasFlats: true, fullRange: true, color: '#ef8e5c', appInstrument: 'electric-guitar' },
  29: { stem: 'electric_guitar', label: 'Sharp E-Guitar', hasFlats: true, fullRange: true, color: '#ffae7c', appInstrument: 'electric-guitar' },
  30: { stem: 'mexican_trumpet', label: 'Mexican Trumpet', hasFlats: true, fullRange: true, color: '#ffd56c', appInstrument: 'trumpet' },
  31: { stem: 'mexican_trumpet', label: 'Flat Trumpet', hasFlats: true, fullRange: true, color: '#efc55c', appInstrument: 'trumpet' },
  32: { stem: 'mexican_trumpet', label: 'Sharp Trumpet', hasFlats: true, fullRange: true, color: '#ffe57c', appInstrument: 'trumpet' },
}

const INSTRUMENT_GT: Record<
  string,
  { stem: string; natural: number; hasAccidentals: boolean; fileStem?: string }
> = {
  piano: { stem: 'piano', natural: 0, hasAccidentals: true },
  bass: { stem: 'bass', natural: 4, hasAccidentals: true },
  drums: { stem: 'drum', natural: 3, hasAccidentals: false },
  sax: { stem: 'sax', natural: 8, hasAccidentals: true },
  flute: { stem: 'flute', natural: 15, hasAccidentals: true },
  guitar: { stem: 'spanish_guitar', natural: 18, hasAccidentals: true },
  'electric-guitar': { stem: 'electric_guitar', natural: 27, hasAccidentals: true },
  violin: { stem: 'violin', natural: 21, hasAccidentals: true },
  lyre: { stem: 'lyre', natural: 24, hasAccidentals: true },
  trumpet: { stem: 'mexican_trumpet', natural: 30, hasAccidentals: true },
  spooky: { stem: 'spooky', natural: 7, hasAccidentals: false, fileStem: 'spooky' },
  winterfest: { stem: 'festive', natural: 14, hasAccidentals: false, fileStem: 'festive' },
  synth: { stem: 'violin', natural: 21, hasAccidentals: true },
  bell: { stem: 'festive', natural: 14, hasAccidentals: false, fileStem: 'festive' },
}

export function instrumentHasAccidentals(instrument: string): boolean {
  return INSTRUMENT_GT[instrument]?.hasAccidentals ?? false
}

export function gtFieldsForInstrument(
  instrument: string,
  variant: GtVariant = 'natural',
): { gtStem: string; gtNumType: number; gtVariant: GtVariant } {
  const def = INSTRUMENT_GT[instrument] ?? INSTRUMENT_GT.piano
  const resolved: GtVariant = def.hasAccidentals ? variant : 'natural'
  const numType = def.natural + (resolved === 'flat' ? 1 : resolved === 'sharp' ? 2 : 0)
  return {
    gtStem: def.fileStem ?? def.stem,
    gtNumType: numType,
    gtVariant: resolved,
  }
}

export function lineToLabel(line: number): string {
  return GT_PITCH_LINE_LABELS[line - 1] ?? '?'
}

export function labelToLine(label: string): number | null {
  const idx = GT_PITCH_LINE_LABELS.indexOf(label as (typeof GT_PITCH_LINE_LABELS)[number])
  return idx >= 0 ? idx + 1 : null
}

export function lineToMidi(line: number): number {
  return GT_LINE_TO_MIDI[line - 1] ?? 60
}

/** Fold MIDI into Growtopia's two-octave window (C3–B4) by octaves, not by clamping. */
export function wrapMidiToGtRange(midi: number): number {
  const lo = GT_LINE_TO_MIDI[GT_LINE_TO_MIDI.length - 1]
  const hi = GT_LINE_TO_MIDI[0]
  let m = midi
  while (m < lo) m += 12
  while (m > hi) m -= 12
  return m
}

export function midiToLine(midi: number): number {
  const wrapped = wrapMidiToGtRange(midi)
  let best = 1
  let bestDist = Infinity
  for (let i = 0; i < GT_LINE_TO_MIDI.length; i++) {
    const dist = Math.abs(GT_LINE_TO_MIDI[i] - wrapped)
    if (dist < bestDist) {
      bestDist = dist
      best = i + 1
    }
  }
  return best
}

export function snapMidiToLine(midi: number): number {
  return lineToMidi(midiToLine(midi))
}

/** Written staff line plus accidental. F♯ on the F line sounds MIDI 66, not 65. */
export function soundingMidi(pitchLine: number, variant: GtVariant): number {
  const written = lineToMidi(pitchLine)
  if (variant === 'sharp') return written + 1
  if (variant === 'flat') return written - 1
  return written
}

export function soundingMidiForNote(
  note: { pitch: number; pitchLine?: number; gtVariant?: GtVariant },
  track?: { gtVariant?: GtVariant },
): number {
  const variant = note.gtVariant ?? track?.gtVariant ?? 'natural'
  if (variant === 'natural') return note.pitch
  return soundingMidi(note.pitchLine ?? midiToLine(note.pitch), variant)
}

export function beatToColumn(beat: number): number {
  return beat * GT_COLUMNS_PER_BEAT
}

export function columnToBeat(column: number): number {
  return column / GT_COLUMNS_PER_BEAT
}

export function numTypeToVariant(numType: number): GtVariant {
  const flatTypes = [1, 5, 9, 16, 19, 22, 25, 28, 31]
  const sharpTypes = [2, 6, 10, 17, 20, 23, 26, 29, 32]
  if (flatTypes.includes(numType)) return 'flat'
  if (sharpTypes.includes(numType)) return 'sharp'
  return 'natural'
}

/** GMSF note type byte → internal numType (0–32). Id 15 is Audio Rack, not a numType. */
const GMSF_ID_TO_NUM_TYPE: Record<number, number> = {
  1: 0, 2: 2, 3: 1, 4: 4, 5: 6, 6: 5, 7: 3, 8: 13, 9: 8, 10: 10, 11: 9,
  12: 11, 13: 12, 14: 7, 16: 15, 17: 17, 18: 16, 19: 14, 20: 18, 21: 20,
  22: 19, 23: 21, 24: 23, 25: 22, 26: 24, 27: 26, 28: 25, 29: 27, 30: 29,
  31: 28, 32: 30, 33: 32, 34: 31,
}

const NUM_TYPE_TO_GMSF_ID: Record<number, number> = Object.fromEntries(
  Object.entries(GMSF_ID_TO_NUM_TYPE).map(([gmsfId, numType]) => [numType, Number(gmsfId)]),
)

export function gmsfNoteTypeToNumType(gmsfId: number): number | null {
  return GMSF_ID_TO_NUM_TYPE[gmsfId] ?? null
}

/** Internal numType (0–32) → GMSF note type byte. Audio Rack uses 15 separately. */
export function numTypeToGmsfNoteType(numType: number): number | null {
  return NUM_TYPE_TO_GMSF_ID[numType] ?? null
}

const LEGACY_TYPE_TO_NUM_TYPE: Record<string, number> = {
  'P-': 0, Pb: 1, 'P#': 2, 'D-': 3, 'B-': 4, Bb: 5, 'B#': 6, 'H-': 7,
  'S-': 8, Sb: 9, 'S#': 10, 'r-': 11, 'R-': 12, 'L-': 13, 'F-': 14,
  'f-': 15, fb: 16, 'f#': 17, 's-': 18, sb: 19, 's#': 20, 'V-': 21,
  Vb: 22, 'V#': 23, 'l-': 24, lb: 25, 'l#': 26, 'E-': 27, Eb: 28,
  'E#': 29, 'T-': 30, Tb: 31, 'T#': 32,
}

const NUM_TYPE_TO_LEGACY_TYPE: Record<number, string> = Object.fromEntries(
  Object.entries(LEGACY_TYPE_TO_NUM_TYPE).map(([code, numType]) => [numType, code]),
)

export function legacyTypeToNumType(code: string): number | null {
  return LEGACY_TYPE_TO_NUM_TYPE[code] ?? null
}

export function numTypeToLegacyType(numType: number): string | null {
  return NUM_TYPE_TO_LEGACY_TYPE[numType] ?? null
}

/** Parse legacy cell like "Pc-" → pitch line + numType */
export function parseLegacyCell(cell: string): { line: number; numType: number } | null {
  if (cell.length < 3) return null
  const line = legacyLineFromChar(cell.charAt(1))
  const numType = legacyTypeToNumType(cell.charAt(0) + cell.charAt(2))
  if (line == null || numType == null) return null
  return { line, numType }
}

export function formatLegacyCell(line: number, numType: number): string | null {
  const letter = GT_PITCH_LINE_LABELS[line - 1]
  const code = numTypeToLegacyType(numType)
  if (!letter || !code) return null
  return `${code.charAt(0)}${letter}${code.charAt(1)}`
}

function legacyLineFromChar(c: string): number | null {
  const map: Record<string, number> = {
    B: 1, A: 2, G: 3, F: 4, E: 5, D: 6, C: 7,
    b: 8, a: 9, g: 10, f: 11, e: 12, d: 13, c: 14,
  }
  return map[c] ?? null
}

/** Resolve WAV filename for a sample (matches GTMusicSim path logic) */
export function getSampleFilename(
  stem: string,
  variant: GtVariant,
  pitchLine: number,
  fileStem?: string,
): string | null {
  const file = fileStem ?? stem
  const lineIndex = pitchLine - 1
  if (lineIndex < 0 || lineIndex >= GT_PITCH_LANES) return null

  // GTMusicSim ranges are low→high (c…B). Our pitch lines are high→low (B top → c bottom).
  const lowToHigh = GT_PITCH_LANES - 1 - lineIndex

  if (stem === 'drum') {
    const k = 6 - (lineIndex % 7)
    return `${file}_${RANGE_DRUM[k]}.wav`
  }

  if (variant === 'flat') {
    if (lowToHigh >= RANGE_FLAT.length) return null
    return `${file}_${RANGE_FLAT[lowToHigh]}.wav`
  }

  if (variant === 'sharp') {
    if (lowToHigh >= RANGE_SHARP.length) return null
    return `${file}_${RANGE_SHARP[lowToHigh]}.wav`
  }

  return `${file}_${RANGE_NORMAL[lowToHigh]}.wav`
}

export function getGtDefForNumType(numType: number): GtInstrumentDef | null {
  return GT_INSTRUMENTS[numType] ?? null
}

export function sheetMusicName(numType?: number | null, fallback = 'Piano'): string {
  if (numType === 11) return t('sheet.repeatBegin')
  if (numType === 12) return t('sheet.repeatEnd')
  if (numType === 13) return t('sheet.blank')
  if (numType === GT_AUDIO_RACK) return t('sheet.audioRack')
  const def = numType != null ? GT_INSTRUMENTS[numType] : null
  if (numType != null) return tf(`sheet.names.${numType}`, def?.label ?? fallback)
  return def?.label ?? fallback
}

export function sheetMusicLabel(numType?: number | null, fallback = 'Piano'): string {
  if (numType === GT_AUDIO_RACK) return sheetMusicName(numType, fallback)
  return t('sheet.label', { name: sheetMusicName(numType, fallback) })
}
