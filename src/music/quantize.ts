import type { Note, SnapValue, Song } from './types'
import { snapBeat } from './timing'

export function clampQuantizeStrength(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Move note starts toward the snap grid. 100 = hard snap. */
export function quantizeNoteStart(startBeat: number, snap: SnapValue, strength: number): number {
  const target = snapBeat(startBeat, snap)
  const amt = clampQuantizeStrength(strength) / 100
  return startBeat + (target - startBeat) * amt
}

export function quantizeSongNotes(
  song: Song,
  noteIds: ReadonlySet<string> | null,
  snap: SnapValue,
  strength: number,
): { trackId: string; noteId: string; updates: Partial<Note> }[] {
  const patches: { trackId: string; noteId: string; updates: Partial<Note> }[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (noteIds && !noteIds.has(note.id)) continue
      const startBeat = quantizeNoteStart(note.startBeat, snap, strength)
      if (Math.abs(startBeat - note.startBeat) < 1e-9) continue
      patches.push({ trackId: track.id, noteId: note.id, updates: { startBeat: Math.max(0, startBeat) } })
    }
  }
  return patches
}
