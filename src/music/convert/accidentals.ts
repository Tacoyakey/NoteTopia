import { accidentalTrackName } from '../accidentalLayer'
import { cloneSong, createTrack } from '../SongModel'
import {
  gtFieldsForInstrument,
  instrumentHasAccidentals,
  midiToLine,
  type GtVariant,
} from '../gtPitch'
import type { Note, Song, Track } from '../types'

/** Spell black keys onto Growtopia natural lines as sharp or flat. */
export function spellMidiAccidental(midi: number): { written: number; variant: GtVariant } {
  const pc = ((midi % 12) + 12) % 12
  if (pc === 1 || pc === 6 || pc === 8) return { written: midi - 1, variant: 'sharp' }
  if (pc === 3 || pc === 10) return { written: midi + 1, variant: 'flat' }
  return { written: midi, variant: 'natural' }
}

function retargetNote(note: Note, written: number, variant: GtVariant, instrument: string): Note {
  const fields = gtFieldsForInstrument(instrument, variant)
  return {
    ...note,
    pitch: written,
    pitchLine: midiToLine(written),
    gtVariant: variant,
    gtNumType: fields.gtNumType,
  }
}

function applyVariant(track: Track, variant: GtVariant, notes: Note[], rename: boolean): Track {
  const fields = gtFieldsForInstrument(track.instrument, variant)
  const next = rename
    ? {
        ...createTrack(accidentalTrackName(track.name, variant), track.instrument),
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
      }
    : track
  next.notes = notes
  next.gtStem = fields.gtStem
  next.gtNumType = fields.gtNumType
  next.gtVariant = fields.gtVariant
  return next
}

/**
 * Naturals stay on the original track. MIDI sharps/flats become their own
 * Growtopia sheet layer on the written natural line.
 */
export function splitAccidentalLayers(
  song: Song,
  spell: (midi: number) => { written: number; variant: GtVariant } = spellMidiAccidental,
): Song {
  const next = cloneSong(song)
  const tracks: Track[] = []

  for (const track of next.tracks) {
    if (!instrumentHasAccidentals(track.instrument) || track.gtVariant === 'sharp' || track.gtVariant === 'flat') {
      tracks.push(track)
      continue
    }

    const naturals: Note[] = []
    const sharps: Note[] = []
    const flats: Note[] = []
    for (const note of track.notes) {
      if (note.gtVariant === 'sharp' || note.gtVariant === 'flat') {
        const spelled = spell(note.pitch)
        const written = spelled.variant === 'natural' ? note.pitch : spelled.written
        const bucket = note.gtVariant === 'sharp' ? sharps : flats
        bucket.push(retargetNote(note, written, note.gtVariant, track.instrument))
        continue
      }
      const { written, variant } = spell(note.pitch)
      if (variant === 'sharp') sharps.push(retargetNote(note, written, 'sharp', track.instrument))
      else if (variant === 'flat') flats.push(retargetNote(note, written, 'flat', track.instrument))
      else naturals.push(retargetNote(note, written, 'natural', track.instrument))
    }

    const extraCount = (sharps.length > 0 ? 1 : 0) + (flats.length > 0 ? 1 : 0)
    if (naturals.length > 0) {
      track.notes = naturals
      tracks.push(track)
      if (sharps.length) tracks.push(applyVariant(track, 'sharp', sharps, true))
      if (flats.length) tracks.push(applyVariant(track, 'flat', flats, true))
    } else if (extraCount === 1) {
      if (sharps.length) tracks.push(applyVariant(track, 'sharp', sharps, false))
      else tracks.push(applyVariant(track, 'flat', flats, false))
    } else if (extraCount === 2) {
      tracks.push(applyVariant(track, 'sharp', sharps, true))
      tracks.push(applyVariant(track, 'flat', flats, true))
    } else {
      track.notes = naturals
      tracks.push(track)
    }
  }

  next.tracks = tracks
  return next
}
