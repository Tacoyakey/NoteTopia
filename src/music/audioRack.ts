import { v4 as uuidv4 } from 'uuid'
import type { AudioRackData, InstrumentId, Note, Song, Track } from './types'
import {
  GT_AUDIO_RACK,
  GT_COLUMNS_PER_BEAT,
  columnToBeat,
  gtFieldsForInstrument,
  labelToLine,
  lineToLabel,
  lineToMidi,
  midiToLine,
  soundingMidi,
  type GtVariant,
} from './gtPitch'
import type { TileOccupant } from './convert/types'

export { soundingMidi }

export const AUDIO_RACK_TRACK_NAME = 'Audio Rack'
export const AUDIO_RACK_MAX_NOTES = 5
export const AUDIO_RACK_VOLUME_MIN = 1
export const AUDIO_RACK_VOLUME_MAX = 100

const INSTRUMENT_TO_CODE: Partial<Record<InstrumentId, string>> = {
  piano: 'P',
  bass: 'B',
  drums: 'D',
  sax: 'S',
  flute: 'F',
  guitar: 'G',
  violin: 'V',
  lyre: 'L',
  'electric-guitar': 'E',
  trumpet: 'T',
}

const CODE_TO_INSTRUMENT: Record<string, InstrumentId> = {
  P: 'piano',
  B: 'bass',
  D: 'drums',
  S: 'sax',
  F: 'flute',
  G: 'guitar',
  V: 'violin',
  L: 'lyre',
  E: 'electric-guitar',
  T: 'trumpet',
}

export interface RackSlot {
  instrument: InstrumentId
  pitchLine: number
  variant: GtVariant
}

export function isAudioRackNote(note: Note): boolean {
  return note.audioRack != null || note.gtNumType === GT_AUDIO_RACK
}

export function clampRackVolume(value: number): number {
  if (!Number.isFinite(value)) return AUDIO_RACK_VOLUME_MAX
  return Math.max(AUDIO_RACK_VOLUME_MIN, Math.min(AUDIO_RACK_VOLUME_MAX, Math.round(value)))
}

export function accidentalChar(variant: GtVariant | undefined): '#' | '-' | 'b' {
  if (variant === 'sharp') return '#'
  if (variant === 'flat') return 'b'
  return '-'
}

export function charToVariant(ch: string): GtVariant | null {
  if (ch === '#') return 'sharp'
  if (ch === 'b') return 'flat'
  if (ch === '-') return 'natural'
  return null
}

export function instrumentRackCode(instrument: InstrumentId): string | null {
  return INSTRUMENT_TO_CODE[instrument] ?? null
}

export function noteToRackToken(track: Track, note: Note): string | null {
  if (isAudioRackNote(note)) return null
  const code = instrumentRackCode(track.instrument)
  if (!code) return null
  const line = note.pitchLine ?? midiToLine(note.pitch)
  const letter = lineToLabel(line)
  if (letter === '?') return null
  const variant = note.gtVariant ?? track.gtVariant ?? 'natural'
  return `${code}${letter}${accidentalChar(variant)}`
}

export function encodeRackNotes(tokens: string[]): string {
  return tokens.slice(0, AUDIO_RACK_MAX_NOTES).join(' ')
}

export function parseRackToken(token: string): RackSlot | null {
  if (token.length !== 3) return null
  const instrument = CODE_TO_INSTRUMENT[token[0]]
  const line = labelToLine(token[1])
  const variant = charToVariant(token[2])
  if (!instrument || line == null || !variant) return null
  return { instrument, pitchLine: line, variant }
}

/** Parse Growtopia Audio Rack notes. Spaces are optional; at most five tokens. */
export function parseRackNotes(text: string): RackSlot[] {
  const compact = text.replace(/\s+/g, '')
  const slots: RackSlot[] = []
  for (let i = 0; i + 3 <= compact.length && slots.length < AUDIO_RACK_MAX_NOTES; i += 3) {
    const slot = parseRackToken(compact.slice(i, i + 3))
    if (slot) slots.push(slot)
  }
  return slots
}

function slotFields(slot: RackSlot) {
  return gtFieldsForInstrument(slot.instrument, slot.variant)
}

export function expandAudioRack(
  host: Track,
  rackNote: Note,
): { track: Track; note: Note }[] {
  const data = rackNote.audioRack
  if (!data) return []
  const volume = clampRackVolume(data.volume)
  const velocity = Math.round(127 * (volume / AUDIO_RACK_VOLUME_MAX))
  return parseRackNotes(data.notes).map((slot, index) => {
    const fields = slotFields(slot)
    const track: Track = {
      ...host,
      id: `${host.id}:rack:${index}`,
      instrument: slot.instrument,
      gtStem: fields.gtStem,
      gtNumType: fields.gtNumType,
      gtVariant: fields.gtVariant,
    }
    const note: Note = {
      id: `${rackNote.id}:${index}`,
      pitch: soundingMidi(slot.pitchLine, slot.variant),
      pitchLine: slot.pitchLine,
      startBeat: rackNote.startBeat,
      durationBeats: rackNote.durationBeats,
      velocity,
      gtVariant: slot.variant,
      gtNumType: fields.gtNumType,
    }
    return { track, note }
  })
}

export function createAudioRackNote(
  beat: number,
  pitchLine: number,
  data?: Partial<AudioRackData>,
): Note {
  const volume = clampRackVolume(data?.volume ?? AUDIO_RACK_VOLUME_MAX)
  const notes = data?.notes ?? ''
  return {
    id: uuidv4(),
    pitch: lineToMidi(pitchLine),
    pitchLine,
    startBeat: beat,
    durationBeats: 1 / GT_COLUMNS_PER_BEAT,
    velocity: Math.round(127 * (volume / AUDIO_RACK_VOLUME_MAX)),
    gtNumType: GT_AUDIO_RACK,
    audioRack: { volume, notes },
  }
}

export function createAudioRackTrack(): Track {
  return {
    id: uuidv4(),
    name: AUDIO_RACK_TRACK_NAME,
    instrument: 'piano',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    notes: [],
    gtNumType: GT_AUDIO_RACK,
  }
}

export function ensureAudioRackTrack(song: Song): Track {
  const existing = song.tracks.find((track) => track.name === AUDIO_RACK_TRACK_NAME)
  if (existing) return existing
  const track = createAudioRackTrack()
  song.tracks.push(track)
  return track
}

export function findAudioRackAt(
  song: Song,
  beat: number,
  pitchLine: number,
): TileOccupant | null {
  const column = Math.round(beat * GT_COLUMNS_PER_BEAT)
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (!isAudioRackNote(note)) continue
      if ((note.pitchLine ?? midiToLine(note.pitch)) !== pitchLine) continue
      if (Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) !== column) continue
      return { trackId: track.id, noteId: note.id }
    }
  }
  return null
}

export function emptyAudioRackData(): AudioRackData {
  return { volume: AUDIO_RACK_VOLUME_MAX, notes: '' }
}

export { columnToBeat }
