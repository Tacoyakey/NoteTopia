import { GT_COLUMNS_PER_BEAT, midiToLine } from '../../gtPitch'
import type { Note } from '../../types'
import type { PadThin } from './options'

export function collapseUnison(notes: Note[]): { notes: Note[]; dropped: number } {
  const byCell = new Map<string, Note>()
  let dropped = 0
  for (const note of notes) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    const key = `${col}:${note.pitch}`
    const prev = byCell.get(key)
    if (!prev) {
      byCell.set(key, note)
      continue
    }
    dropped++
    if (note.velocity >= prev.velocity) byCell.set(key, note)
  }
  return { notes: [...byCell.values()], dropped }
}

export function collapseOctaveDoubles(notes: Note[]): { notes: Note[]; dropped: number } {
  const byCell = new Map<string, Note>()
  let dropped = 0
  for (const note of notes) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    const pc = ((note.pitch % 12) + 12) % 12
    const key = `${col}:${pc}`
    const prev = byCell.get(key)
    if (!prev) {
      byCell.set(key, note)
      continue
    }
    dropped++
    if (note.velocity >= prev.velocity) byCell.set(key, note)
  }
  return { notes: [...byCell.values()], dropped }
}

export function thinChord(notes: Note[], cap: number): Note[] {
  if (notes.length <= cap) return notes
  const byPitch = [...notes].sort((a, b) => a.pitch - b.pitch)
  const outer = [byPitch[0], byPitch[byPitch.length - 1]]
  const inner = byPitch.slice(1, -1).sort((a, b) => b.velocity - a.velocity)
  const kept = [...outer]
  for (const note of inner) {
    if (kept.length >= cap) break
    kept.push(note)
  }
  return kept
}

export function thinByImportance(notes: Note[], cap: number, importance: Map<string, number>): Note[] {
  if (notes.length <= cap) return notes
  return [...notes]
    .sort(
      (a, b) =>
        (importance.get(b.id) ?? b.velocity) - (importance.get(a.id) ?? a.velocity) ||
        b.velocity - a.velocity ||
        a.id.localeCompare(b.id),
    )
    .slice(0, cap)
}

export function thinPadColumn(notes: Note[], padThin: PadThin): Note[] {
  if (padThin === 'off') return notes
  const cap = padThin === 'hard' ? 1 : 2
  if (notes.length <= cap) return notes
  return [...notes].sort((a, b) => b.velocity - a.velocity).slice(0, cap)
}

export function uniqueByLine(notes: Note[]): Note[] {
  const unique = new Map<number, Note>()
  for (const note of notes) {
    const line = note.pitchLine ?? midiToLine(note.pitch)
    const prev = unique.get(line)
    if (!prev || note.velocity >= prev.velocity) unique.set(line, note)
  }
  return [...unique.values()]
}
