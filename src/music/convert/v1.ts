import { cloneSong } from '../SongModel'
import { GT_COLUMNS_PER_BEAT, midiToLine, snapMidiToLine } from '../gtPitch'
import { isRepeatNote, noteLine } from '../sheetRepeats'
import { splitAccidentalLayers } from './accidentals'
import { finishConvertedSheet } from './packSheet'
import type { Note, Song } from '../types'
import type { ConvertBakeOptions, ConvertModel, ConvertResult, TileOccupant } from './types'

function occupantLaterTrackWins(
  song: Song,
  beat: number,
  pitchLine: number,
): TileOccupant | null {
  const column = Math.round(beat * GT_COLUMNS_PER_BEAT)
  let occupant: TileOccupant | null = null
  let repeat: TileOccupant | null = null
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (noteLine(note) !== pitchLine) continue
      if (Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) !== column) continue
      const hit = { trackId: track.id, noteId: note.id }
      if (isRepeatNote(note)) repeat = hit
      else occupant = hit
    }
  }
  return repeat ?? occupant
}

function snapNote(note: Note): { note: Note; snapped: boolean } {
  const startBeat = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) / GT_COLUMNS_PER_BEAT
  const pitch = snapMidiToLine(note.pitch)
  const pitchLine = midiToLine(pitch)
  return {
    snapped: Math.abs(startBeat - note.startBeat) > 1e-6,
    note: {
      ...note,
      startBeat,
      durationBeats: 0.25,
      pitch,
      pitchLine,
    },
  }
}

function bakeWithOccupant(
  song: Song,
  occupantFn: ConvertModel['occupant'],
): ConvertResult {
  const next = cloneSong(song)
  let notesIn = 0
  let snappedToGrid = 0

  for (const track of next.tracks) {
    const byCell = new Map<string, Note>()
    for (const note of track.notes) {
      notesIn++
      const { note: snapped, snapped: didSnap } = snapNote(note)
      if (didSnap) snappedToGrid++
      const key = `${Math.round(snapped.startBeat * GT_COLUMNS_PER_BEAT)}:${snapped.pitchLine}`
      byCell.set(key, snapped)
    }
    track.notes = [...byCell.values()]
  }

  let overlapsResolved = 0
  const keptByTrack = next.tracks.map((track) => {
    if (track.muted) return track.notes
    const kept: Note[] = []
    for (const note of track.notes) {
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const occ = occupantFn(next, note.startBeat, line)
      if (occ?.trackId === track.id && occ.noteId === note.id) {
        kept.push(note)
      } else {
        overlapsResolved++
      }
    }
    return kept
  })
  next.tracks.forEach((track, i) => {
    track.notes = keptByTrack[i]
  })

  const notesOut = next.tracks.reduce((n, t) => n + t.notes.length, 0)
  return {
    song: next,
    stats: { notesIn, notesOut, overlapsResolved, snappedToGrid },
  }
}

/** 1.0 (internal codename) — Basic: 16th tiles, two-octave wrap, later track keeps the cell. */
export const convertV1: ConvertModel = {
  id: 'v1',
  tag: '1.0',
  label: 'Basic',
  recommended: false,
  description: 'Converts the MIDI to something simple. Other instruments may overlap each other.',
  occupant: occupantLaterTrackWins,
  bake: (song, options?: ConvertBakeOptions) => {
    const result = bakeWithOccupant(splitAccidentalLayers(song), occupantLaterTrackWins)
    if (!options?.skipFinish) {
      result.song = finishConvertedSheet(result.song, options)
      result.stats.notesOut = result.song.tracks.reduce((n, t) => n + t.notes.length, 0)
    }
    return result
  },
}

