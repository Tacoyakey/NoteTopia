import type { Song, Track, Note, WorldSettings, InstrumentId, WorldWeather } from '../music/types'
import { INSTRUMENTS } from '../music/types'
import { getDefaultWorldSettings } from '../world/worldLayout'
import { gtFieldsForInstrument } from '../music/gtPitch'

const WEATHER_IDS = new Set<WorldWeather>([
  'sunny',
  'night',
  'beach',
  'snowy',
  'snowy-night',
  'galactic',
  'petal-haven',
  'void',
  'solid',
])

const INSTRUMENT_IDS = new Set<string>(INSTRUMENTS.map((i) => i.id))

export const MAX_PROJECT_JSON_BYTES = 8_000_000
export const MAX_IMPORT_BYTES = 20_000_000

export function assertFileSize(file: File, maxBytes: number): void {
  if (file.size > maxBytes) {
    throw new Error(`File is too large (${Math.ceil(file.size / 1_000_000)} MB)`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseNote(raw: unknown, index: number): Note {
  if (!isRecord(raw)) throw new Error(`Invalid note at ${index}`)
  const pitch = asNumber(raw.pitch, NaN)
  const startBeat = asNumber(raw.startBeat, NaN)
  const durationBeats = asNumber(raw.durationBeats, 0.25)
  const velocity = asNumber(raw.velocity, 100)
  if (!Number.isFinite(pitch) || !Number.isFinite(startBeat)) {
    throw new Error(`Invalid note at ${index}`)
  }
  const note: Note = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `n-${index}`,
    pitch,
    startBeat: Math.max(0, startBeat),
    durationBeats: Math.max(1 / 64, durationBeats),
    velocity: Math.max(0, Math.min(127, velocity)),
  }
  if (typeof raw.pitchLine === 'number') note.pitchLine = raw.pitchLine
  if (raw.gtVariant === 'natural' || raw.gtVariant === 'flat' || raw.gtVariant === 'sharp') {
    note.gtVariant = raw.gtVariant
  }
  if (typeof raw.gtNumType === 'number') note.gtNumType = raw.gtNumType
  if (isRecord(raw.audioRack)) {
    const volumeRaw = asNumber(raw.audioRack.volume, 100)
    const volume = Math.max(1, Math.min(100, Math.round(volumeRaw)))
    const notes = typeof raw.audioRack.notes === 'string' ? raw.audioRack.notes : ''
    note.audioRack = { volume, notes }
    if (note.gtNumType == null) note.gtNumType = 33
  }
  return note
}

function parseTrack(raw: unknown, index: number): Track {
  if (!isRecord(raw)) throw new Error(`Invalid track at ${index}`)
  const instrument = typeof raw.instrument === 'string' && INSTRUMENT_IDS.has(raw.instrument)
    ? (raw.instrument as InstrumentId)
    : 'piano'
  const notesRaw = Array.isArray(raw.notes) ? raw.notes : []
  const track: Track = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `t-${index}`,
    name: typeof raw.name === 'string' ? raw.name : `Track ${index + 1}`,
    instrument,
    volume: Math.max(0, Math.min(1, asNumber(raw.volume, 0.8))),
    pan: Math.max(-1, Math.min(1, asNumber(raw.pan, 0))),
    muted: Boolean(raw.muted),
    solo: Boolean(raw.solo),
    notes: notesRaw.map((note, i) => parseNote(note, i)),
  }
  if (typeof raw.gtStem === 'string') track.gtStem = raw.gtStem
  if (typeof raw.gtNumType === 'number') track.gtNumType = raw.gtNumType
  if (raw.gtVariant === 'natural' || raw.gtVariant === 'flat' || raw.gtVariant === 'sharp') {
    track.gtVariant = raw.gtVariant
  }
  const fields = gtFieldsForInstrument(instrument, track.gtVariant ?? 'natural')
  track.gtNumType ??= fields.gtNumType
  track.gtStem ??= fields.gtStem
  track.gtVariant ??= fields.gtVariant
  track.notes = track.notes.map((note) => {
    if (note.audioRack || note.gtNumType != null) return note
    return { ...note, gtNumType: track.gtNumType, gtVariant: note.gtVariant ?? track.gtVariant }
  })
  if (typeof raw.gmProgram === 'number' && Number.isFinite(raw.gmProgram)) {
    track.gmProgram = Math.max(0, Math.min(127, Math.round(raw.gmProgram)))
  }
  return track
}

export function parseSong(raw: unknown): Song {
  if (!isRecord(raw)) throw new Error('Invalid song')
  if (typeof raw.name !== 'string') throw new Error('Invalid song name')
  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) throw new Error('Song has no tracks')
  const bpm = Math.max(20, Math.min(300, Math.round(asNumber(raw.bpm, 120))))
  const ts = isRecord(raw.timeSignature) ? raw.timeSignature : {}
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    name: raw.name,
    bpm: Number.isFinite(bpm) ? bpm : 120,
    timeSignature: {
      numerator: Math.max(1, Math.round(asNumber(ts.numerator, 4))),
      denominator: Math.max(1, Math.round(asNumber(ts.denominator, 4))),
    },
    tracks: raw.tracks.map((track, i) => parseTrack(track, i)),
  }
}

export function parseWorldSettings(raw: unknown): WorldSettings {
  const defaults = getDefaultWorldSettings()
  if (!isRecord(raw)) return defaults
  return {
    ...defaults,
    density: Math.max(0, Math.min(100, asNumber(raw.density, defaults.density))),
    autoCompress: Boolean(raw.autoCompress),
    followPlayhead: raw.followPlayhead == null ? defaults.followPlayhead : Boolean(raw.followPlayhead),
    zoom: Math.max(0.5, Math.min(2, asNumber(raw.zoom, defaults.zoom))),
    gtGrid: raw.gtGrid == null ? defaults.gtGrid : Boolean(raw.gtGrid),
    useSamples: raw.useSamples == null ? defaults.useSamples : Boolean(raw.useSamples),
    theme: typeof raw.theme === 'string' && WEATHER_IDS.has(raw.theme as WorldWeather)
      ? (raw.theme as WorldWeather)
      : defaults.theme,
    solidColor: typeof raw.solidColor === 'string' ? raw.solidColor : defaults.solidColor,
    convertModel: typeof raw.convertModel === 'string' ? raw.convertModel : defaults.convertModel,
    songLengthColumns:
      raw.songLengthColumns == null
        ? defaults.songLengthColumns
        : Math.max(1, Math.min(16_384, Math.round(asNumber(raw.songLengthColumns, defaults.songLengthColumns ?? 1)))),
    loopStartBeat:
      raw.loopStartBeat == null ? defaults.loopStartBeat : Math.max(0, asNumber(raw.loopStartBeat, 0)),
    loopEndBeat:
      raw.loopEndBeat == null ? defaults.loopEndBeat : Math.max(0, asNumber(raw.loopEndBeat, 0)),
    composerFollowPlayhead:
      raw.composerFollowPlayhead == null
        ? defaults.composerFollowPlayhead
        : Boolean(raw.composerFollowPlayhead),
    metronome: raw.metronome == null ? defaults.metronome : Boolean(raw.metronome),
  }
}
