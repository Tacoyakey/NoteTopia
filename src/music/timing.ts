import type { Song, Note, Track } from './types'

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60
}

export function getSongDurationBeats(song: Song): number {
  let max = 16
  for (const track of song.tracks) {
    for (const note of track.notes) {
      max = Math.max(max, note.startBeat + note.durationBeats)
    }
  }
  return Math.ceil(max + 4)
}

/** Musical length used for playback stop / loop wrap (no timeline padding). */
export function getPlaybackDurationBeats(song: Song): number {
  let max = 0
  for (const track of song.tracks) {
    for (const note of track.notes) {
      max = Math.max(max, note.startBeat + note.durationBeats)
    }
  }
  const bar = Math.max(1, song.timeSignature?.numerator || 4)
  if (max <= 0) return bar
  return Math.max(bar, Math.ceil(max / bar - 1e-9) * bar)
}

export function formatBeatTime(beat: number, bpm: number): string {
  const totalSeconds = beatsToSeconds(beat, bpm)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds % 1) * 100)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

/** mm:ss for export / mix length copy. */
export function formatDurationClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export function snapBeat(beat: number, snap: number): number {
  const grid = 4 / snap
  return Math.round(beat / grid) * grid
}

export function getTotalNoteCount(tracks: Track[]): number {
  return tracks.reduce((sum, t) => sum + t.notes.length, 0)
}

export function getNotesInRange(notes: Note[], startBeat: number, endBeat: number): Note[] {
  return notes.filter(
    (n) => n.startBeat + n.durationBeats > startBeat && n.startBeat < endBeat,
  )
}
