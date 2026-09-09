import { cloneSong } from '../SongModel'
import type { Song } from '../types'

/** MIDI velocities at or below this are dropped when "quiet notes" is on. */
export const QUIET_VELOCITY = 24

export interface PrepareImportOptions {
  skipDrums?: boolean
  trimSilence?: boolean
  dropQuiet?: boolean
  quietThreshold?: number
}

/** Filter / shift a MIDI song before Growtopia convert. */
export function prepareImportSong(song: Song, options: PrepareImportOptions = {}): Song {
  const next = cloneSong(song)
  if (options.skipDrums) {
    next.tracks = next.tracks.filter((track) => track.instrument !== 'drums')
  }
  if (options.dropQuiet) {
    const threshold = options.quietThreshold ?? QUIET_VELOCITY
    for (const track of next.tracks) {
      track.notes = track.notes.filter((note) => note.velocity > threshold)
    }
  }
  next.tracks = next.tracks.filter((track) => track.notes.length > 0)
  if (next.tracks.length === 0) return cloneSong(song)

  if (options.trimSilence) {
    let minBeat = Infinity
    for (const track of next.tracks) {
      for (const note of track.notes) minBeat = Math.min(minBeat, note.startBeat)
    }
    if (Number.isFinite(minBeat) && minBeat > 0.0001) {
      for (const track of next.tracks) {
        for (const note of track.notes) note.startBeat -= minBeat
      }
    }
  }
  return next
}
