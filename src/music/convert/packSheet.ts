import { cloneSong } from '../SongModel'
import { collapseRepeatedSections, compressEmptyGaps, isRepeatNote, noteColumn, noteLine } from '../sheetRepeats'
import type { Note, Song } from '../types'
import type { ConvertBakeOptions } from './types'

/** Growtopia music worlds top out around this many columns. */
export const GT_SHEET_COLUMN_LIMIT = 400
const MIN_PACK_BPM = 40

function lastSoundingColumn(song: Song): number {
  let max = -1
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      max = Math.max(max, noteColumn(note))
    }
  }
  return max
}

function canHalveColumns(song: Song): boolean {
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (noteColumn(note) % 2 !== 0) return false
    }
  }
  return lastSoundingColumn(song) >= 2
}

function mergeCells(song: Song): void {
  for (const track of song.tracks) {
    const byCell = new Map<string, Note>()
    for (const note of track.notes) {
      const key = `${noteColumn(note)}:${noteLine(note)}:${note.gtNumType ?? ''}`
      byCell.set(key, note)
    }
    track.notes = [...byCell.values()]
  }
}

/** Halve start times and BPM while every tile sits on an even column. */
function packByHalvingInPlace(song: Song, limit: number, minBpm: number): void {
  while (
    lastSoundingColumn(song) >= limit &&
    song.bpm >= minBpm &&
    canHalveColumns(song)
  ) {
    song.bpm = Math.max(20, Math.round(song.bpm / 2))
    for (const track of song.tracks) {
      for (const note of track.notes) {
        note.startBeat /= 2
      }
    }
    mergeCells(song)
  }
}

export type SheetPackOpts = { limit?: number; minBpm?: number }

/**
 * For sheets that would run past the ~400-block world limit: close empty gaps
 * when we can, then pack time (half the layout, half the BPM) so it still
 * plays at the same speed. Short MIDIs are left alone.
 */
export function fitConvertedSheet(
  song: Song,
  alwaysLoopGaps: boolean,
  pack?: SheetPackOpts,
): Song {
  const limit = pack?.limit ?? GT_SHEET_COLUMN_LIMIT
  const minBpm = pack?.minBpm ?? MIN_PACK_BPM
  const wasLong = lastSoundingColumn(song) >= limit
  if (!wasLong && !alwaysLoopGaps) return song

  let next = cloneSong(song)
  if (wasLong) packByHalvingInPlace(next, limit, minBpm)
  if (alwaysLoopGaps || wasLong) next = compressEmptyGaps(next)
  if (lastSoundingColumn(next) >= limit) packByHalvingInPlace(next, limit, minBpm)
  return next
}

/**
 * Copied phrases and empty pauses (including slightly long ones) become
 * Repeat Begin/End. `compress` additionally packs very long sheets.
 */
export function finishConvertedSheet(song: Song, options?: ConvertBakeOptions): Song {
  let next = collapseRepeatedSections(song)
  next = compressEmptyGaps(next)
  return fitConvertedSheet(next, options?.compress === true, {
    limit: options?.targetColumns,
    minBpm: options?.minBpm,
  })
}

export function sheetColumnCount(song: Song): number {
  return Math.max(0, lastSoundingColumn(song) + 1)
}
