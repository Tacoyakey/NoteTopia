import { AUDIO_RACK_TRACK_NAME } from './audioRack'
import { gtFieldsForInstrument, instrumentHasAccidentals, type GtVariant } from './gtPitch'
import { createTrack } from './SongModel'
import type { Song, Track } from './types'

export function variantFromModifiers(e: { shiftKey: boolean; altKey: boolean }): GtVariant | null {
  if (e.shiftKey) return 'sharp'
  if (e.altKey) return 'flat'
  return null
}

export function stripAccidentalSuffix(name: string): string {
  return name.replace(/(?:\s*[♯♭#]|\s+b)$/u, '').trimEnd()
}

export function accidentalTrackName(sourceName: string, variant: GtVariant): string {
  const base = stripAccidentalSuffix(sourceName)
  if (variant === 'sharp') return `${base} ♯`
  if (variant === 'flat') return `${base} ♭`
  return base
}

function isInstrumentLayer(track: Track): boolean {
  return track.name !== AUDIO_RACK_TRACK_NAME
}

export function findAccidentalTrack(song: Song, source: Track, variant: GtVariant): Track | undefined {
  const wantName = accidentalTrackName(source.name, variant)
  const matches = song.tracks.filter(
    (track) =>
      isInstrumentLayer(track) &&
      track.instrument === source.instrument &&
      (track.gtVariant ?? 'natural') === variant,
  )
  return matches.find((track) => track.name === wantName) ?? matches[0]
}

export function createAccidentalTrack(source: Track, variant: GtVariant): Track {
  const fields = gtFieldsForInstrument(source.instrument, variant)
  return {
    ...createTrack(accidentalTrackName(source.name, variant), source.instrument),
    volume: source.volume,
    pan: source.pan,
    ...fields,
  }
}

/** Fields for the tile that would be placed with the given modifier. */
export function placementFields(source: Track, variant: GtVariant | null) {
  if (!variant || !instrumentHasAccidentals(source.instrument)) {
    return {
      gtNumType: source.gtNumType,
      gtVariant: source.gtVariant ?? 'natural',
    }
  }
  return gtFieldsForInstrument(source.instrument, variant)
}

/**
 * Resolve the layer to place on. Creates a new track object when needed;
 * the caller must ADD_TRACK if `created` is true.
 */
export function ensureAccidentalLayer(
  song: Song,
  source: Track,
  variant: GtVariant | null,
): { track: Track; created: boolean } {
  if (!variant || !instrumentHasAccidentals(source.instrument)) {
    return { track: source, created: false }
  }
  if ((source.gtVariant ?? 'natural') === variant) {
    return { track: source, created: false }
  }
  const existing = findAccidentalTrack(song, source, variant)
  if (existing) return { track: existing, created: false }
  return { track: createAccidentalTrack(source, variant), created: true }
}
