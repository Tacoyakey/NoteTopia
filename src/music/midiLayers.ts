import { AUDIO_RACK_TRACK_NAME, isAudioRackNote } from './audioRack'
import { spellMidiAccidental } from './convert/accidentals'
import { bakeWithProgress } from './convert/bakeProgress'
import { prepareImportSong, type PrepareImportOptions } from './convert/prepareImport'
import type {
  ConvertBakeOptions,
  ConvertModel,
  ConvertProgress,
  ConvertResult,
  ConvertStats,
} from './convert/types'
import {
  gtFieldsForInstrument,
  instrumentHasAccidentals,
  type GtVariant,
} from './gtPitch'
import { cloneSong, createTrack } from './SongModel'
import { isRepeatNote } from './sheetRepeats'
import type { InstrumentId, Note, Song, Track } from './types'

export function layerFileBaseName(fileName: string): string {
  return fileName.replace(/\.(mid|midi)$/i, '').trim() || 'Layer'
}

export function uniqueLayerName(existing: Iterable<string>, base: string): string {
  const used = new Set(existing)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

export function defaultLayerInstrument(song: Song): InstrumentId {
  const scored = song.tracks
    .filter((track) => track.notes.length > 0)
    .map((track) => ({ instrument: track.instrument, notes: track.notes.length }))
    .sort((a, b) => b.notes - a.notes)
  const pitched = scored.find((item) => item.instrument !== 'drums')
  return pitched?.instrument ?? scored[0]?.instrument ?? 'piano'
}

export function layerAccidentalKinds(
  song: Song,
  instrument: InstrumentId,
): { sharps: boolean; flats: boolean } {
  if (!instrumentHasAccidentals(instrument)) return { sharps: false, flats: false }
  let sharps = false
  let flats = false
  for (const track of song.tracks) {
    if (track.instrument === 'drums') continue
    for (const note of track.notes) {
      const variant = note.gtVariant === 'sharp' || note.gtVariant === 'flat'
        ? note.gtVariant
        : spellMidiAccidental(note.pitch).variant
      if (variant === 'sharp') sharps = true
      if (variant === 'flat') flats = true
      if (sharps && flats) return { sharps, flats }
    }
  }
  return { sharps, flats }
}

export function assignInstrumentLayer(
  song: Song,
  instrument: InstrumentId,
  name: string,
  options: { skipDrums?: boolean } = {},
): Song {
  const fields = gtFieldsForInstrument(instrument)
  const notes: Note[] = []
  for (const track of song.tracks) {
    if (options.skipDrums && track.instrument === 'drums') continue
    for (const note of track.notes) {
      notes.push({
        ...note,
        gtVariant: undefined,
        gtNumType: undefined,
      })
    }
  }
  const track: Track = {
    ...createTrack(name, instrument),
    ...fields,
    gmProgram: song.tracks.find((item) => item.gmProgram != null)?.gmProgram,
    notes,
  }
  return {
    ...cloneSong(song),
    name,
    tracks: [track],
  }
}

function retargetNote(note: Note, instrument: InstrumentId, variant: GtVariant): Note {
  if (isAudioRackNote(note) || isRepeatNote(note)) return note
  const fields = gtFieldsForInstrument(instrument, note.gtVariant ?? variant)
  return {
    ...note,
    gtNumType: fields.gtNumType,
    gtVariant: fields.gtVariant,
  }
}

export function retargetLayerTracks(tracks: Track[], instrument: InstrumentId): Track[] {
  return tracks.map((track) => {
    if (track.name === AUDIO_RACK_TRACK_NAME) return track
    const variant = track.gtVariant ?? 'natural'
    const fields = gtFieldsForInstrument(instrument, variant)
    return {
      ...track,
      instrument,
      ...fields,
      notes: track.notes.map((note) => retargetNote(note, instrument, variant)),
    }
  })
}

function emptyLayerResult(song: Song): ConvertResult {
  return {
    song: { ...song, tracks: [] },
    stats: { notesIn: 0, notesOut: 0, overlapsResolved: 0, snappedToGrid: 0 },
  }
}

function prepareLayerSong(
  parsed: Song,
  instrument: InstrumentId,
  name: string,
  prepare: PrepareImportOptions,
): Song {
  const prepared = prepareImportSong(parsed, { ...prepare, skipDrums: false })
  return assignInstrumentLayer(prepared, instrument, name, { skipDrums: prepare.skipDrums })
}

function finishLayerResult(result: ConvertResult, instrument: InstrumentId): ConvertResult {
  result.song = {
    ...result.song,
    tracks: retargetLayerTracks(result.song.tracks, instrument),
  }
  result.stats.notesOut = result.song.tracks.reduce((n, track) => n + track.notes.length, 0)
  return result
}

export function convertMidiLayer(
  parsed: Song,
  instrument: InstrumentId,
  name: string,
  model: ConvertModel,
  prepare: PrepareImportOptions = {},
  bakeOptions?: ConvertBakeOptions,
): ConvertResult {
  const layered = prepareLayerSong(parsed, instrument, name, prepare)
  if (!layered.tracks[0]?.notes.length) return emptyLayerResult(layered)
  return finishLayerResult(model.bake(layered, bakeOptions), instrument)
}

export async function convertMidiLayerAsync(
  parsed: Song,
  instrument: InstrumentId,
  name: string,
  model: ConvertModel,
  prepare: PrepareImportOptions = {},
  bakeOptions?: ConvertBakeOptions,
  onProgress?: (progress: ConvertProgress) => void,
): Promise<ConvertResult> {
  const layered = prepareLayerSong(parsed, instrument, name, prepare)
  if (!layered.tracks[0]?.notes.length) return emptyLayerResult(layered)
  const result = await bakeWithProgress(model, layered, bakeOptions, onProgress ?? (() => {}))
  return finishLayerResult(result, instrument)
}

export function appendConvertedLayers(base: Song, added: Track[]): Song {
  if (added.length === 0) return base
  const next = cloneSong(base)
  const existingRack = next.tracks.find((track) => track.name === AUDIO_RACK_TRACK_NAME)
  const incomingRacks = added.filter((track) => track.name === AUDIO_RACK_TRACK_NAME)
  const others = added.filter((track) => track.name !== AUDIO_RACK_TRACK_NAME)
  if (existingRack && incomingRacks.length) {
    existingRack.notes = [...existingRack.notes, ...incomingRacks.flatMap((track) => track.notes)]
    next.tracks = [...next.tracks, ...others]
  } else {
    next.tracks = [...next.tracks, ...added]
  }
  return next
}

export function mergeLayerStats(parts: ConvertStats[]): ConvertStats {
  return parts.reduce<ConvertStats>(
    (acc, part) => ({
      notesIn: acc.notesIn + part.notesIn,
      notesOut: acc.notesOut + part.notesOut,
      overlapsResolved: acc.overlapsResolved + part.overlapsResolved,
      snappedToGrid: acc.snappedToGrid + part.snappedToGrid,
      keyShift: part.keyShift ?? acc.keyShift,
      racksCreated: (acc.racksCreated ?? 0) + (part.racksCreated ?? 0),
      columns: Math.max(acc.columns ?? 0, part.columns ?? 0),
      warnings: [...new Set([...(acc.warnings ?? []), ...(part.warnings ?? [])])],
    }),
    { notesIn: 0, notesOut: 0, overlapsResolved: 0, snappedToGrid: 0 },
  )
}
