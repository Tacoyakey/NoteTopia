import type { InstrumentId, Song } from '../../types'
import { isRepeatNote } from '../../sheetRepeats'
import type { SongAnalysis } from './analyze'
import { GT_HI, GT_LO } from './pitch'
import { isOrnament } from './rhythm'
import type { DetectedRole } from './roles'

export type ChordTone = 'root' | 'third' | 'fifth' | 'seventh' | 'extension' | 'chromatic' | 'none'

export interface ScoreNote {
  id: string
  trackId: string
  startBeat: number
  durationBeats: number
  velocity: number
  pitch: number
  instrument: InstrumentId
  role: DetectedRole
  phraseId: number
  motifId: string | null
  chordTone: ChordTone
  isMelody: boolean
  isBass: boolean
  isOrnament: boolean
  importance: number
  melodicImportance: number
  harmonicImportance: number
  bassImportance: number
  rhythmicImportance: number
}

export interface ScorePhrase {
  id: number
  trackId: string
  noteIds: string[]
  motifId: string | null
  startBeat: number
  endBeat: number
}

export interface ScoreChord {
  startBeat: number
  rootPc: number
  noteIds: string[]
}

export interface MusicalScore {
  notes: ScoreNote[]
  phrases: ScorePhrase[]
  chords: ScoreChord[]
  tempo: number
  keyName: string
  tonic: number
  byId: Map<string, ScoreNote>
}

/** Tunable note-importance weights. Tests lock the relative ranking. */
export const IMPORTANCE_WEIGHTS = {
  roleLead: 100,
  roleBass: 72,
  roleHarmony: 38,
  rolePad: 22,
  roleDrums: 40,
  chordRoot: 16,
  chordThird: 14,
  chordSeventh: 10,
  chordFifth: 6,
  velocity: 14,
  duration: 6,
  motifRepeat: 14,
  phraseEdge: 8,
  highestInColumn: 28,
  ornamentScale: 0.25,
  onBeat: 12,
  offBeat: 7,
} as const

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function inStaff(midi: number): boolean {
  return midi >= GT_LO && midi <= GT_HI
}

export function chordToneOf(pc: number, root: number): ChordTone {
  const d = (pc - root + 12) % 12
  if (d === 0) return 'root'
  if (d === 3 || d === 4) return 'third'
  if (d === 7) return 'fifth'
  if (d === 10 || d === 11) return 'seventh'
  if (d === 2 || d === 5 || d === 6 || d === 9) return 'extension'
  return 'chromatic'
}

export function chordToneRank(tone: ChordTone): number {
  if (tone === 'root') return 0
  if (tone === 'third') return 1
  if (tone === 'seventh') return 2
  if (tone === 'fifth') return 3
  if (tone === 'extension') return 4
  if (tone === 'chromatic') return 5
  return 6
}

function roleBase(role: DetectedRole): number {
  if (role === 'lead') return IMPORTANCE_WEIGHTS.roleLead
  if (role === 'bass') return IMPORTANCE_WEIGHTS.roleBass
  if (role === 'drums') return IMPORTANCE_WEIGHTS.roleDrums
  if (role === 'pad') return IMPORTANCE_WEIGHTS.rolePad
  return IMPORTANCE_WEIGHTS.roleHarmony
}

function colOf(beat: number): number {
  return Math.round(beat * 4)
}

interface DraftNote {
  id: string
  trackId: string
  startBeat: number
  durationBeats: number
  velocity: number
  pitch: number
  instrument: InstrumentId
  role: DetectedRole
  isOrnament: boolean
}

function detectPhrases(drafts: DraftNote[]): Map<string, number> {
  const phraseOf = new Map<string, number>()
  let nextId = 1
  const byTrack = new Map<string, DraftNote[]>()
  for (const note of drafts) {
    const list = byTrack.get(note.trackId) ?? []
    list.push(note)
    byTrack.set(note.trackId, list)
  }
  for (const notes of byTrack.values()) {
    notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch || a.id.localeCompare(b.id))
    let phraseId = nextId++
    let prev: DraftNote | null = null
    let count = 0
    for (const note of notes) {
      if (prev) {
        const gap = note.startBeat - prev.startBeat
        const leap = Math.abs(note.pitch - prev.pitch)
        const split = gap > 1.25 || (leap > 9 && gap > 0.4) || count >= 32
        if (split) {
          phraseId = nextId++
          count = 0
        }
      }
      phraseOf.set(note.id, phraseId)
      count++
      prev = note
    }
  }
  return phraseOf
}

function motifSignature(notes: ScoreNote[]): string | null {
  if (notes.length < 4) return null
  const ordered = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch || a.id.localeCompare(b.id))
  const iv: number[] = []
  const rv: number[] = []
  for (let i = 1; i < ordered.length; i++) {
    const d = ordered[i].pitch - ordered[i - 1].pitch
    iv.push(Math.max(-12, Math.min(12, d)))
    rv.push(Math.round((ordered[i].startBeat - ordered[i - 1].startBeat) * 4))
  }
  return `${iv.join(',')}|${rv.join(',')}`
}

function detectChords(drafts: DraftNote[]): ScoreChord[] {
  const byCol = new Map<number, DraftNote[]>()
  for (const note of drafts) {
    if (note.role === 'drums') continue
    const col = colOf(note.startBeat)
    const list = byCol.get(col) ?? []
    list.push(note)
    byCol.set(col, list)
  }
  const chords: ScoreChord[] = []
  for (const [col, group] of byCol) {
    if (group.length < 2) continue
    const bass = group.filter((note) => note.role === 'bass')
    const rootSrc = bass.length > 0 ? bass.reduce((a, b) => (a.pitch <= b.pitch ? a : b)) : group.reduce((a, b) => (a.pitch <= b.pitch ? a : b))
    chords.push({
      startBeat: col / 4,
      rootPc: pitchClass(rootSrc.pitch),
      noteIds: group.map((note) => note.id),
    })
  }
  return chords
}

function rhythmicImportance(note: DraftNote): number {
  const frac = ((note.startBeat % 1) + 1) % 1
  const toBeat = Math.min(frac, 1 - frac)
  const toOff = Math.abs(frac - 0.5)
  let s = (note.velocity / 127) * 8
  if (toBeat < 0.06) s += IMPORTANCE_WEIGHTS.onBeat
  else if (toOff < 0.06) s += IMPORTANCE_WEIGHTS.offBeat
  return s
}

/**
 * MIDI-agnostic musical score: phrases, motifs, chords, and importance.
 * Independent of Growtopia tile packing / racks / accidental layers.
 */
export function buildMusicalScore(
  song: Song,
  roles: Map<string, DetectedRole>,
  analysis: Pick<SongAnalysis, 'key'>,
): MusicalScore {
  const drafts: DraftNote[] = []
  for (const track of song.tracks) {
    if (track.muted) continue
    const role = roles.get(track.id) ?? (track.instrument === 'drums' ? 'drums' : 'harmony')
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      drafts.push({
        id: note.id,
        trackId: track.id,
        startBeat: note.startBeat,
        durationBeats: note.durationBeats,
        velocity: note.velocity,
        pitch: note.pitch,
        instrument: track.instrument,
        role,
        isOrnament: isOrnament(note),
      })
    }
  }

  const phraseOf = detectPhrases(drafts)
  const chords = detectChords(drafts)
  const chordOf = new Map<string, ScoreChord>()
  for (const chord of chords) {
    for (const id of chord.noteIds) chordOf.set(id, chord)
  }

  const highestInCol = new Set<string>()
  const byTrackCol = new Map<string, DraftNote[]>()
  for (const note of drafts) {
    const key = `${note.trackId}:${colOf(note.startBeat)}`
    const list = byTrackCol.get(key) ?? []
    list.push(note)
    byTrackCol.set(key, list)
  }
  for (const group of byTrackCol.values()) {
    const top = group.reduce((a, b) => (a.pitch > b.pitch ? a : b))
    highestInCol.add(top.id)
  }

  const notes: ScoreNote[] = drafts.map((draft) => {
    const chord = chordOf.get(draft.id)
    const tone = chord ? chordToneOf(pitchClass(draft.pitch), chord.rootPc) : 'none'
    const isBass = draft.role === 'bass'
    const colSize = byTrackCol.get(`${draft.trackId}:${colOf(draft.startBeat)}`)?.length ?? 1
    const isMelody =
      !isBass &&
      draft.role === 'lead' &&
      (colSize === 1 || (colSize === 2 && highestInCol.has(draft.id)))
    return {
      ...draft,
      phraseId: phraseOf.get(draft.id) ?? 0,
      motifId: null,
      chordTone: tone,
      isMelody,
      isBass,
      importance: 0,
      melodicImportance: 0,
      harmonicImportance: 0,
      bassImportance: 0,
      rhythmicImportance: rhythmicImportance(draft),
    }
  })

  const phrases: ScorePhrase[] = []
  const phraseNotes = new Map<number, ScoreNote[]>()
  for (const note of notes) {
    const list = phraseNotes.get(note.phraseId) ?? []
    list.push(note)
    phraseNotes.set(note.phraseId, list)
  }
  for (const [id, group] of phraseNotes) {
    group.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch || a.id.localeCompare(b.id))
    phrases.push({
      id,
      trackId: group[0].trackId,
      noteIds: group.map((note) => note.id),
      motifId: null,
      startBeat: group[0].startBeat,
      endBeat: group[group.length - 1].startBeat + group[group.length - 1].durationBeats,
    })
  }
  phrases.sort((a, b) => a.startBeat - b.startBeat || a.id - b.id)

  const byIdEarly = new Map(notes.map((note) => [note.id, note]))
  const sigCount = new Map<string, number>()
  const sigOf = new Map<number, string>()
  for (const phrase of phrases) {
    const group = phrase.noteIds.map((id) => byIdEarly.get(id)).filter((note): note is ScoreNote => note != null)
    const sig = motifSignature(group)
    if (!sig) continue
    sigOf.set(phrase.id, sig)
    sigCount.set(sig, (sigCount.get(sig) ?? 0) + 1)
  }
  for (const phrase of phrases) {
    const sig = sigOf.get(phrase.id)
    if (!sig || (sigCount.get(sig) ?? 0) < 2) continue
    phrase.motifId = sig
    for (const id of phrase.noteIds) {
      const note = byIdEarly.get(id)
      if (note) note.motifId = sig
    }
  }

  const phraseEdge = new Set<string>()
  for (const phrase of phrases) {
    if (phrase.noteIds.length === 0) continue
    phraseEdge.add(phrase.noteIds[0])
    phraseEdge.add(phrase.noteIds[phrase.noteIds.length - 1])
  }

  for (const note of notes) {
    const W = IMPORTANCE_WEIGHTS
    let melodic = note.isMelody ? W.roleLead : 0
    if (note.isMelody && highestInCol.has(note.id)) melodic += W.highestInColumn
    let harmonic = 0
    if (note.chordTone === 'root') harmonic += W.chordRoot
    else if (note.chordTone === 'third') harmonic += W.chordThird
    else if (note.chordTone === 'seventh') harmonic += W.chordSeventh
    else if (note.chordTone === 'fifth') harmonic += W.chordFifth
    const bass = note.isBass ? W.roleBass : 0
    let importance = roleBase(note.role) + harmonic + (note.velocity / 127) * W.velocity + Math.min(note.durationBeats, 2) * W.duration
    if (note.motifId) importance += W.motifRepeat
    if (phraseEdge.has(note.id)) importance += W.phraseEdge
    if (note.isMelody) importance += melodic * 0.35
    if (note.isBass) importance += 12
    const colSize = byTrackCol.get(`${note.trackId}:${colOf(note.startBeat)}`)?.length ?? 1
    if (highestInCol.has(note.id) && !note.isMelody) {
      importance += colSize < 3 ? IMPORTANCE_WEIGHTS.highestInColumn * 0.5 : IMPORTANCE_WEIGHTS.highestInColumn * 0.15
    }
    importance += note.rhythmicImportance * 0.25
    if (note.isOrnament) importance *= W.ornamentScale
    note.melodicImportance = melodic
    note.harmonicImportance = harmonic
    note.bassImportance = bass
    note.importance = importance
  }

  const byId = new Map(notes.map((note) => [note.id, note]))
  return {
    notes,
    phrases,
    chords,
    tempo: song.bpm,
    keyName: analysis.key.name,
    tonic: analysis.key.tonic,
    byId,
  }
}
