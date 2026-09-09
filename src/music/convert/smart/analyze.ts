import { GT_COLUMNS_PER_BEAT, GT_LINE_TO_MIDI } from '../../gtPitch'
import type { Song } from '../../types'
import { isRepeatNote } from '../../sheetRepeats'

const GT_LO = GT_LINE_TO_MIDI[GT_LINE_TO_MIDI.length - 1]
const GT_HI = GT_LINE_TO_MIDI[0]

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export interface DetectedKey {
  tonic: number
  mode: 'major' | 'minor'
  name: string
}

export interface SongAnalysis {
  key: DetectedKey
  density: number
  notesOutOfStaff: number
  noteCount: number
  columnCount: number
  duplicatedPhrase: boolean
  meanVelocity: number
  tempoChanges: number
}

function correlate(hist: number[], profile: number[], shift: number): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += hist[i] * profile[(i - shift + 12) % 12]
  return sum
}

export function detectKey(song: Song): DetectedKey {
  const hist = new Array(12).fill(0)
  for (const track of song.tracks) {
    if (track.muted || track.instrument === 'drums') continue
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      hist[((note.pitch % 12) + 12) % 12] += Math.max(1, note.durationBeats)
    }
  }
  let best: DetectedKey = { tonic: 0, mode: 'major', name: 'C major' }
  let bestScore = Number.NEGATIVE_INFINITY
  for (let tonic = 0; tonic < 12; tonic++) {
    const major = correlate(hist, MAJOR, tonic)
    const minor = correlate(hist, MINOR, tonic)
    if (major > bestScore) {
      bestScore = major
      best = { tonic, mode: 'major', name: `${KEY_NAMES[tonic]} major` }
    }
    if (minor > bestScore) {
      bestScore = minor
      best = { tonic, mode: 'minor', name: `${KEY_NAMES[tonic]} minor` }
    }
  }
  return best
}

export function analyzeSong(song: Song, tempoChanges = 1): SongAnalysis {
  const key = detectKey(song)
  let noteCount = 0
  let notesOutOfStaff = 0
  let velSum = 0
  const columns = new Set<number>()
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      noteCount++
      velSum += note.velocity
      columns.add(Math.round(note.startBeat * GT_COLUMNS_PER_BEAT))
      if (track.instrument !== 'drums' && (note.pitch < GT_LO || note.pitch > GT_HI)) {
        notesOutOfStaff++
      }
    }
  }
  const columnCount = columns.size
  const density = columnCount === 0 ? 0 : noteCount / columnCount

  let duplicatedPhrase = false
  for (const track of song.tracks) {
    if (track.instrument === 'drums' || track.notes.length < 8) continue
    const pitches = track.notes
      .filter((note) => !isRepeatNote(note))
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    const mid = Math.floor(pitches.length / 2)
    if (mid < 4) continue
    const a = pitches.slice(0, mid)
    const b = pitches.slice(mid, mid * 2)
    if (a.length === b.length && a.every((p, i) => p === b[i])) {
      duplicatedPhrase = true
      break
    }
  }

  return {
    key,
    density,
    notesOutOfStaff,
    noteCount,
    columnCount: Math.max(
      0,
      Math.round(
        Math.max(
          0,
          ...song.tracks.flatMap((track) => track.notes.map((note) => note.startBeat)),
        ) * GT_COLUMNS_PER_BEAT,
      ) + 1,
    ),
    duplicatedPhrase,
    meanVelocity: noteCount === 0 ? 0 : velSum / noteCount,
    tempoChanges,
  }
}

export function prefersFlatSpelling(key: DetectedKey): boolean {
  if (key.mode === 'major') return [1, 3, 5, 6, 8, 10].includes(key.tonic)
  return [0, 2, 3, 5, 7, 10].includes(key.tonic)
}
