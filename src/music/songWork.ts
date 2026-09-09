import type { Song } from './types'

/** Notes on the sheet — used to warn before wiping the current project. */
export function songHasWork(song: Song): boolean {
  return song.tracks.some((track) => track.notes.length > 0)
}
