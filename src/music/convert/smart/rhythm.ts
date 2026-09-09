import { GT_COLUMNS_PER_BEAT } from '../../gtPitch'
import type { Note, Song } from '../../types'
import { isRepeatNote } from '../../sheetRepeats'
import type { SwingMode } from './options'

export function isOrnament(note: Note): boolean {
  return note.durationBeats < 0.08 && note.velocity < 48
}

export function attachOrnaments(notes: Note[]): Note[] {
  const body = notes.filter((note) => !isOrnament(note)).sort((a, b) => a.startBeat - b.startBeat)
  const graces = notes.filter((note) => isOrnament(note))
  const attached = graces.map((grace) => {
    const next = body.find((note) => note.startBeat >= grace.startBeat - 1e-6)
    if (!next) return grace
    return { ...grace, startBeat: next.startBeat, durationBeats: 0.25 }
  })
  return [...body, ...attached]
}

export function detectSwing(song: Song): boolean {
  let swingish = 0
  let even = 0
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      const frac = ((note.startBeat % 1) + 1) % 1
      const dist12 = Math.min(Math.abs(frac - 1 / 3), Math.abs(frac - 2 / 3))
      const dist16 = Math.min(frac, Math.abs(frac - 0.25), Math.abs(frac - 0.5), Math.abs(frac - 0.75), 1 - frac)
      if (dist12 < 0.06) swingish++
      if (dist16 < 0.04) even++
    }
  }
  return swingish > 8 && swingish > even * 0.35
}

export function straightenSwingNotes(notes: Note[]): Note[] {
  return notes.map((note) => {
    const beat = Math.floor(note.startBeat + 1e-9)
    const frac = note.startBeat - beat
    let next = frac
    if (Math.abs(frac - 1 / 3) < 0.08) next = 0.25
    else if (Math.abs(frac - 2 / 3) < 0.08) next = 0.5
    return next === frac ? note : { ...note, startBeat: beat + next }
  })
}

export function shouldStraighten(song: Song, mode: SwingMode): boolean {
  if (mode === 'keep') return false
  if (mode === 'straight') return true
  return detectSwing(song)
}

export function pickupTrimSong(song: Song): void {
  const bar = Math.max(1, song.timeSignature?.numerator ?? 4)
  let minBeat = Infinity
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      minBeat = Math.min(minBeat, note.startBeat)
    }
  }
  if (!Number.isFinite(minBeat) || minBeat < 1e-6) return
  const downbeat = Math.ceil(minBeat / bar - 1e-9) * bar
  if (downbeat <= minBeat + 1e-6) return
  for (const track of song.tracks) {
    track.notes = track.notes.filter((note) => isRepeatNote(note) || note.startBeat + 1e-6 >= downbeat)
    for (const note of track.notes) note.startBeat -= downbeat
  }
}

export function snapToSixteenth(startBeat: number): number {
  return Math.round(startBeat * GT_COLUMNS_PER_BEAT) / GT_COLUMNS_PER_BEAT
}
