import {
  GT_COLUMNS_PER_BEAT,
  GT_LINE_TO_MIDI,
  gtFieldsForInstrument,
  lineToMidi,
  midiToLine,
  snapMidiToLine,
} from '../gtPitch'
import type { Note, Song, Track } from '../types'
import { isRepeatNote, noteLine } from '../sheetRepeats'
import { splitAccidentalLayers } from './accidentals'
import { finishConvertedSheet } from './packSheet'
import { bestGlobalKeyShift, snapInStaff } from './fitKey'
import type { ConvertBakeOptions, ConvertModel, ConvertResult, TileOccupant } from './types'
import {
  AUDIO_RACK_MAX_NOTES,
  AUDIO_RACK_TRACK_NAME,
  createAudioRackNote,
  encodeRackNotes,
  ensureAudioRackTrack,
  findAudioRackAt,
  isAudioRackNote,
  noteToRackToken,
} from '../audioRack'

const GT_LO = GT_LINE_TO_MIDI[GT_LINE_TO_MIDI.length - 1]
const GT_HI = GT_LINE_TO_MIDI[0]

/** GM percussion → Growtopia drum lanes (1 = B top … 14 = c bottom). */
const DRUM_MIDI_TO_LINE: Record<number, number> = {
  35: 14,
  36: 14,
  37: 12,
  38: 11,
  39: 9,
  40: 11,
  41: 13,
  43: 13,
  45: 10,
  47: 10,
  48: 7,
  50: 7,
  42: 5,
  44: 5,
  46: 3,
  49: 2,
  57: 2,
  51: 4,
  59: 4,
  53: 4,
  54: 6,
  56: 6,
}

type TrackRole = 'drums' | 'bass' | 'lead' | 'harmony'

function median(values: number[]): number {
  if (values.length === 0) return 60
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function trackRole(track: Track, index: number): TrackRole {
  if (track.instrument === 'drums') return 'drums'
  if (track.instrument === 'bass') return 'bass'
  if (
    index === 0 ||
    track.instrument === 'flute' ||
    track.instrument === 'sax' ||
    track.instrument === 'violin' ||
    track.instrument === 'trumpet' ||
    track.instrument === 'lyre'
  ) {
    return 'lead'
  }
  return 'harmony'
}

function roleWeight(role: TrackRole, trackIndex: number): number {
  const base =
    role === 'lead' ? 90 : role === 'drums' ? 55 : role === 'harmony' ? 45 : 32
  return base - trackIndex * 2
}

function targetCenter(role: TrackRole): number {
  if (role === 'bass') return 52
  if (role === 'lead') return 67
  return 60
}

function bestOctaveShift(midis: number[], target: number): number {
  let bestK = 0
  let bestScore = Number.NEGATIVE_INFINITY
  for (const k of [-24, -12, 0, 12, 24]) {
    const shifted = midis.map((m) => m + k)
    const inRange = shifted.filter((m) => m >= GT_LO && m <= GT_HI).length
    const dist = Math.abs(median(shifted) - target)
    const score = inRange * 12 - dist
    if (score > bestScore) {
      bestScore = score
      bestK = k
    }
  }
  return bestK
}

function foldPreservingContour(midi: number, prevFolded: number | null): number {
  const candidates = [midi, midi + 12, midi - 12, midi + 24, midi - 24].filter(
    (m) => m >= GT_LO && m <= GT_HI,
  )
  if (candidates.length === 0) return snapMidiToLine(midi)
  const goal = prevFolded ?? midi
  return candidates.reduce((best, cur) =>
    Math.abs(cur - goal) < Math.abs(best - goal) ? cur : best,
  )
}

function mapDrumPitch(midi: number): number {
  const line = DRUM_MIDI_TO_LINE[midi] ?? 11
  return lineToMidi(line)
}

function isOrnament(note: Note): boolean {
  return note.durationBeats < 0.08 && note.velocity < 48
}

function thinChord(notes: Note[]): Note[] {
  if (notes.length <= 4) return notes
  const byPitch = [...notes].sort((a, b) => a.pitch - b.pitch)
  const outer = [byPitch[0], byPitch[byPitch.length - 1]]
  const inner = byPitch.slice(1, -1).sort((a, b) => b.velocity - a.velocity)
  const kept = [...outer]
  for (const note of inner) {
    if (kept.length >= 4) break
    kept.push(note)
  }
  return kept
}

function noteScore(track: Track, trackIndex: number, note: Note): number {
  const role = trackRole(track, trackIndex)
  const line = note.pitchLine ?? midiToLine(note.pitch)
  const midi = note.pitch
  const inLowHalf = midi <= 59
  const register =
    (role === 'bass' && inLowHalf) || (role === 'lead' && !inLowHalf) ? 8 : 0
  return roleWeight(role, trackIndex) + note.velocity / 6 + register + (15 - line) * 0.05
}

export function occupantV15(
  song: Song,
  beat: number,
  pitchLine: number,
): TileOccupant | null {
  const rack = findAudioRackAt(song, beat, pitchLine)
  if (rack) return rack
  const column = Math.round(beat * GT_COLUMNS_PER_BEAT)
  let best: TileOccupant | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  let repeat: TileOccupant | null = null
  song.tracks.forEach((track, trackIndex) => {
    if (track.muted) return
    for (const note of track.notes) {
      if (isAudioRackNote(note)) continue
      const line = noteLine(note)
      if (line !== pitchLine) continue
      if (Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) !== column) continue
      if (isRepeatNote(note)) {
        repeat = { trackId: track.id, noteId: note.id }
        continue
      }
      const score = noteScore(track, trackIndex, note)
      if (score >= bestScore) {
        bestScore = score
        best = { trackId: track.id, noteId: note.id }
      }
    }
  })
  return repeat ?? best
}

function convertTrack(
  track: Track,
  trackIndex: number,
  keyShift: number | null,
): { notes: Note[]; snapped: number } {
  const usable = track.notes.filter((note) => !isOrnament(note))
  const role = trackRole(track, trackIndex)
  let snapped = 0
  let mapped: Note[]

  if (role === 'drums') {
    mapped = usable.map((note) => {
      const startBeat = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) / GT_COLUMNS_PER_BEAT
      if (Math.abs(startBeat - note.startBeat) > 1e-6) snapped++
      const pitch = mapDrumPitch(note.pitch)
      return {
        ...note,
        startBeat,
        durationBeats: 0.25,
        pitch,
        pitchLine: midiToLine(pitch),
      }
    })
  } else {
    const shift =
      keyShift != null
        ? keyShift
        : bestOctaveShift(
            usable.map((note) => note.pitch),
            targetCenter(role),
          )
    const ordered = [...usable].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch)
    let prev: number | null = null
    mapped = ordered.map((note) => {
      const startBeat = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) / GT_COLUMNS_PER_BEAT
      if (Math.abs(startBeat - note.startBeat) > 1e-6) snapped++
      const raw = note.pitch + shift
      const folded = keyShift != null ? snapInStaff(raw) : foldPreservingContour(raw, prev)
      const pitch = keyShift != null ? folded : snapMidiToLine(folded)
      const variant = note.gtVariant ?? track.gtVariant ?? 'natural'
      const fields = gtFieldsForInstrument(track.instrument, variant)
      prev = pitch
      return {
        ...note,
        startBeat,
        durationBeats: 0.25,
        pitch,
        pitchLine: midiToLine(pitch),
        gtVariant: variant,
        gtNumType: note.gtNumType ?? fields.gtNumType,
      }
    })
  }

  const byColumn = new Map<number, Note[]>()
  for (const note of mapped) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    const list = byColumn.get(col) ?? []
    list.push(note)
    byColumn.set(col, list)
  }

  const thinned: Note[] = []
  for (const group of byColumn.values()) {
    const unique = new Map<number, Note>()
    for (const note of thinChord(group)) {
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const prev = unique.get(line)
      if (!prev || note.velocity >= prev.velocity) unique.set(line, note)
    }
    thinned.push(...unique.values())
  }
  for (const note of thinned) {
    note.gtVariant ??= track.gtVariant ?? 'natural'
    note.gtNumType ??= track.gtNumType
  }
  return { notes: thinned, snapped }
}

function packOverlapsIntoRacks(song: Song): number {
  type Hit = { track: Track; note: Note; token: string; score: number }
  const byCell = new Map<string, Hit[]>()
  song.tracks.forEach((track, trackIndex) => {
    if (track.muted) return
    for (const note of track.notes) {
      if (isRepeatNote(note) || isAudioRackNote(note)) continue
      const token = noteToRackToken(track, note)
      if (!token) continue
      const key = `${Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)}:${noteLine(note)}`
      const list = byCell.get(key) ?? []
      list.push({ track, note, token, score: noteScore(track, trackIndex, note) })
      byCell.set(key, list)
    }
  })

  const packedIds = new Set<string>()
  let packed = 0
  for (const hits of byCell.values()) {
    if (hits.length < 2) continue
    hits.sort((a, b) => b.score - a.score || a.note.id.localeCompare(b.note.id))
    const chosen = hits.slice(0, AUDIO_RACK_MAX_NOTES)
    const first = chosen[0]
    const host = ensureAudioRackTrack(song)
    host.notes.push(
      createAudioRackNote(first.note.startBeat, noteLine(first.note), {
        volume: 100,
        notes: encodeRackNotes(chosen.map((hit) => hit.token)),
      }),
    )
    for (const hit of chosen) packedIds.add(hit.note.id)
    packed++
  }

  if (packedIds.size === 0) return packed
  for (const track of song.tracks) {
    if (track.name === AUDIO_RACK_TRACK_NAME) continue
    track.notes = track.notes.filter((note) => !packedIds.has(note.id))
  }
  return packed
}

function pitchedMidis(song: Song): number[] {
  const midis: number[] = []
  song.tracks.forEach((track, index) => {
    if (track.muted) return
    if (trackRole(track, index) === 'drums') return
    for (const note of track.notes) {
      if (isOrnament(note)) continue
      midis.push(note.pitch)
    }
  })
  return midis
}

function bakeV15(song: Song, options?: ConvertBakeOptions): ConvertResult {
  const next = splitAccidentalLayers(song)
  let notesIn = 0
  let snappedToGrid = 0
  for (const track of next.tracks) notesIn += track.notes.length

  const keyShift =
    options?.fitKey || options?.preferLow
      ? bestGlobalKeyShift(pitchedMidis(next), { preferLow: options?.preferLow })
      : null

  next.tracks.forEach((track, index) => {
    const converted = convertTrack(track, index, keyShift)
    snappedToGrid += converted.snapped
    track.notes = converted.notes
  })

  const racksCreated = packOverlapsIntoRacks(next)

  let overlapsResolved = 0
  const keptByTrack = next.tracks.map((track) => {
    if (track.muted) return track.notes
    const kept: Note[] = []
    for (const note of track.notes) {
      if (isAudioRackNote(note)) {
        kept.push(note)
        continue
      }
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const occ = occupantV15(next, note.startBeat, line)
      if (occ?.trackId === track.id && occ.noteId === note.id) kept.push(note)
      else overlapsResolved++
    }
    return kept
  })
  next.tracks.forEach((track, i) => {
    track.notes = keptByTrack[i]
  })

  const collapsed = options?.skipFinish ? next : finishConvertedSheet(next, options)
  return {
    song: collapsed,
    stats: {
      notesIn,
      notesOut: collapsed.tracks.reduce((n, t) => t.notes.length + n, 0),
      overlapsResolved,
      snappedToGrid,
      racksCreated,
      keyShift: keyShift ?? undefined,
    },
  }
}

/** 1.5 (internal codename) — Preserve: contour, drums, gap loops, Audio Racks for overlaps. */
export const convertV15: ConvertModel = {
  id: 'v1.5-beta',
  tag: '1.5',
  label: 'Preserve',
  description: 'Keeps the original melody shape. Overlaps become Audio Racks.',
  occupant: occupantV15,
  bake: bakeV15,
}
