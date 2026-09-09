import type { Song } from '../../types'
import type { ArrangeDecision } from '../types'
import type { KeyLock, PadThin } from './options'
import { GT_HI, GT_LO } from './pitch'
import {
  type ChordTone,
  type MusicalScore,
  type ScoreNote,
  type ScorePhrase,
  chordToneRank,
  inStaff,
  pitchClass,
} from './ir'
import { targetCenter, type DetectedRole } from './roles'

export const ARRANGE_WEIGHTS = {
  playable: 8,
  melodyPlayable: 24,
  bassPlayable: 14,
  harmonicPlayable: 8,
  contourBreak: 45,
  intervalDelta: 2,
  leftoverFold: 6,
  voiceLead: 0.35,
  chromaticAbs: 0.4,
  phraseOctave: 8,
  octaveJump: 18,
  deletedMelody: 80,
  deletedBass: 40,
  deletedOther: 8,
  motifMismatch: 28,
  polyphony: 5,
  preferLowMean: 0.08,
  centerMean: 0.03,
} as const

const PHRASE_OCTAVES = [-24, -12, 0, 12, 24] as const
const DECISION_CAP = 48

export interface ArrangeOptions {
  fitKey: boolean
  preferLow: boolean
  keyLock: KeyLock
  chordCap: number
  padThin: PadThin
}

export interface ArrangementStats {
  notesPreserved: number
  notesOctaveShifted: number
  notesTransposed: number
  notesRemoved: number
  notesSimplified: number
  chordsSimplified: number
  melodicNotesPreserved: number
  melodicContourChanges: number
  averageMelodicIntervalChange: number
  maximumMelodicJump: number
  voiceLeadingMovement: number
  repeatedMotifsPreserved: number
  rhythmPreserved: number
  polyphonyReductions: number
  arrangementScore: number
}

export interface ArrangeResult {
  globalShift: number
  pitches: Map<string, number>
  removed: Set<string>
  importance: Map<string, number>
  decisions: ArrangeDecision[]
  stats: ArrangementStats
}

interface Mapped {
  id: string
  trackId: string
  startBeat: number
  origPitch: number
  pitch: number
  role: DetectedRole
  importance: number
  isMelody: boolean
  isBass: boolean
  isOrnament: boolean
  chordTone: ChordTone
  phraseId: number
  motifId: string | null
  removed: boolean
}

function colOf(beat: number): number {
  return Math.round(beat * 4)
}

function intervalSign(delta: number): number {
  if (delta > 0.5) return 1
  if (delta < -0.5) return -1
  return 0
}

export function nearestInStaffSamePc(midi: number, prefer: number): number {
  const pc = pitchClass(midi)
  let best = GT_LO
  let bestDist = Infinity
  for (let m = GT_LO; m <= GT_HI; m++) {
    if (pitchClass(m) !== pc) continue
    const dist = Math.abs(m - prefer)
    if (dist < bestDist || (dist === bestDist && m < best)) {
      bestDist = dist
      best = m
    }
  }
  return best
}

function candidateKeys(score: MusicalScore, opts: ArrangeOptions): number[] {
  if (opts.keyLock === 'none' || !opts.fitKey) return [0]
  const pitched = score.notes.filter((note) => note.role !== 'drums')
  if (pitched.length === 0) return [0]
  const out = pitched.filter((note) => !inStaff(note.pitch)).length
  const outRatio = out / pitched.length
  // Phrase octaves can place a mostly-in-range part. Chromatic k is for clusters that sit outside the staff.
  if (outRatio < 0.4) return [0]
  const all: number[] = []
  for (let k = -11; k <= 11; k++) all.push(k)
  if (pitched.length <= 2500 && score.phrases.length <= 120) return all

  const crude = all.map((k) => {
    let inRange = 0
    for (const note of pitched) {
      const raw = note.pitch + k
      if (inStaff(raw) || inStaff(raw + 12) || inStaff(raw - 12) || inStaff(raw + 24) || inStaff(raw - 24)) {
        inRange += note.isMelody ? 3 : note.isBass ? 2 : 1
      }
    }
    return { k, score: inRange * 10 - Math.abs(k) }
  })
  crude.sort((a, b) => b.score - a.score || Math.abs(a.k) - Math.abs(b.k) || b.k - a.k)
  const kept = new Set<number>([0])
  for (const row of crude) {
    kept.add(row.k)
    if (kept.size >= 8) break
  }
  return [...kept].sort((a, b) => a - b)
}

function phraseGroups(score: MusicalScore): ScorePhrase[][] {
  const byMotif = new Map<string, ScorePhrase[]>()
  const unique: ScorePhrase[][] = []
  for (const phrase of score.phrases) {
    if (phrase.motifId) {
      const list = byMotif.get(phrase.motifId) ?? []
      list.push(phrase)
      byMotif.set(phrase.motifId, list)
    } else {
      unique.push([phrase])
    }
  }
  const groups = [...byMotif.values(), ...unique]
  const weight = (group: ScorePhrase[]): number => {
    let sum = 0
    for (const phrase of group) {
      for (const id of phrase.noteIds) sum += score.byId.get(id)?.importance ?? 0
    }
    return sum
  }
  groups.sort((a, b) => weight(b) - weight(a) || a[0].startBeat - b[0].startBeat || a[0].id - b[0].id)
  return groups
}

function realizePitches(orig: number[], k: number, o: number): { pitches: number[]; folds: number } {
  const shifted = orig.map((p) => p + k + o)
  let home = 0
  let inCount = 0
  for (const p of shifted) {
    if (inStaff(p)) {
      home += p
      inCount++
    }
  }
  const prefer =
    inCount > 0
      ? home / inCount
      : Math.max(GT_LO, Math.min(GT_HI, shifted.reduce((a, b) => a + b, 0) / Math.max(1, shifted.length)))
  let folds = 0
  const pitches = shifted.map((p) => {
    if (inStaff(p)) return p
    folds++
    return nearestInStaffSamePc(p, prefer)
  })
  return { pitches, folds }
}

function scoreContour(
  orig: number[],
  mapped: number[],
  weights: number[],
): { breaks: number; intervalDelta: number; jumps: number; maxJump: number } {
  let breaks = 0
  let intervalDelta = 0
  let jumps = 0
  let maxJump = 0
  let wSum = 0
  for (let i = 1; i < orig.length; i++) {
    const od = orig[i] - orig[i - 1]
    const nd = mapped[i] - mapped[i - 1]
    const w = (weights[i] + weights[i - 1]) / 2
    wSum += w
    if (intervalSign(od) !== intervalSign(nd)) breaks += w
    intervalDelta += Math.abs(od - nd) * w
    const abs = Math.abs(nd)
    if (abs > maxJump) maxJump = abs
    if (abs >= 12 && Math.abs(od) < 12) jumps += w
  }
  const norm = wSum > 0 ? wSum : 1
  return { breaks: breaks / norm, intervalDelta: intervalDelta / norm, jumps: jumps / norm, maxJump }
}

function registerTarget(role: DetectedRole, preferLow: boolean): number {
  return targetCenter(role, preferLow)
}

function pickPhraseOctave(group: ScorePhrase[], score: MusicalScore, k: number, preferLow: boolean): number {
  let bestO: (typeof PHRASE_OCTAVES)[number] = 0
  let best = Number.NEGATIVE_INFINITY
  for (const o of PHRASE_OCTAVES) {
    let total = 0
    for (const phrase of group) {
      const notes = phrase.noteIds
        .map((id) => score.byId.get(id))
        .filter((note): note is ScoreNote => note != null && note.role !== 'drums')
      if (notes.length === 0) continue
      const orig = notes.map((note) => note.pitch)
      const { pitches, folds } = realizePitches(orig, k, o)
      const contour = scoreContour(
        orig,
        pitches,
        notes.map((note) => Math.max(1, note.importance)),
      )
      let inRange = 0
      let mean = 0
      for (let i = 0; i < notes.length; i++) {
        const w = Math.max(1, notes[i].importance)
        if (inStaff(notes[i].pitch + k + o)) inRange += w
        mean += pitches[i]
      }
      mean /= notes.length
      const target = registerTarget(notes[0].role, preferLow)
      total +=
        inRange * 4 -
        contour.breaks * ARRANGE_WEIGHTS.contourBreak -
        contour.intervalDelta * ARRANGE_WEIGHTS.intervalDelta -
        contour.jumps * ARRANGE_WEIGHTS.octaveJump -
        folds * ARRANGE_WEIGHTS.leftoverFold -
        (Math.abs(o) / 12) * ARRANGE_WEIGHTS.phraseOctave -
        Math.abs(mean - target) * ARRANGE_WEIGHTS.centerMean
    }
    if (
      total > best ||
      (total === best && Math.abs(o) < Math.abs(bestO)) ||
      (total === best && Math.abs(o) === Math.abs(bestO) && o > bestO)
    ) {
      best = total
      bestO = o
    }
  }
  return bestO
}

function cloneMapped(score: MusicalScore): Mapped[] {
  return score.notes
    .filter((note) => note.role !== 'drums')
    .map((note) => ({
      id: note.id,
      trackId: note.trackId,
      startBeat: note.startBeat,
      origPitch: note.pitch,
      pitch: note.pitch,
      role: note.role,
      importance: note.importance,
      isMelody: note.isMelody,
      isBass: note.isBass,
      isOrnament: note.isOrnament,
      chordTone: note.chordTone,
      phraseId: note.phraseId,
      motifId: note.motifId,
      removed: false,
    }))
}

function pushDecision(decisions: ArrangeDecision[], row: ArrangeDecision): void {
  if (decisions.length >= DECISION_CAP) return
  decisions.push(row)
}

function applyShiftAndOctaves(
  mapped: Mapped[],
  k: number,
  octaves: Map<number, number>,
  decisions: ArrangeDecision[],
): void {
  const byPhrase = new Map<number, Mapped[]>()
  for (const note of mapped) {
    const list = byPhrase.get(note.phraseId) ?? []
    list.push(note)
    byPhrase.set(note.phraseId, list)
  }
  for (const [phraseId, group] of byPhrase) {
    const o = octaves.get(phraseId) ?? 0
    group.sort((a, b) => a.startBeat - b.startBeat || a.origPitch - b.origPitch || a.id.localeCompare(b.id))
    const orig = group.map((note) => note.origPitch)
    const { pitches } = realizePitches(orig, k, o)
    let home = 0
    for (const p of pitches) home += p
    home /= Math.max(1, pitches.length)
    let loggedPhrase = false
    for (let i = 0; i < group.length; i++) {
      const note = group[i]
      const unfolder = note.origPitch + k + o
      note.pitch = pitches[i]
      if (!inStaff(unfolder)) {
        pushDecision(decisions, {
          noteId: note.id,
          fromPitch: note.origPitch,
          toPitch: note.pitch,
          reason: `outside playable range; identified as ${note.isMelody ? 'melody' : note.isBass ? 'bass' : 'harmony'}; ${note.pitch} keeps pitch class and phrase contour`,
        })
      } else if (o !== 0 && !loggedPhrase) {
        loggedPhrase = true
        pushDecision(decisions, {
          noteId: note.id,
          fromPitch: note.origPitch,
          toPitch: note.pitch,
          reason: `phrase octave ${o > 0 ? '+' : ''}${o} with key shift ${k} keeps the contour inside the two-octave staff`,
        })
      }
      if (!inStaff(note.pitch)) note.pitch = nearestInStaffSamePc(note.pitch, home)
    }
  }
}

function sortDropOrder(a: Mapped, b: Mapped): number {
  if (a.isMelody !== b.isMelody) return a.isMelody ? 1 : -1
  if (a.isBass !== b.isBass) return a.isBass ? 1 : -1
  const rank = chordToneRank(b.chordTone) - chordToneRank(a.chordTone)
  if (rank !== 0) return rank
  if (b.importance !== a.importance) return a.importance - b.importance
  return a.id.localeCompare(b.id)
}

function notesByColumn(mapped: Mapped[]): Map<number, Mapped[]> {
  const byCol = new Map<number, Mapped[]>()
  for (const note of mapped) {
    if (note.removed) continue
    const col = colOf(note.startBeat)
    const list = byCol.get(col) ?? []
    list.push(note)
    byCol.set(col, list)
  }
  return byCol
}

function simplifyColumns(
  mapped: Mapped[],
  opts: ArrangeOptions,
  decisions: ArrangeDecision[],
): { chords: number; poly: number; simplified: number } {
  let chords = 0
  let poly = 0
  let simplified = 0
  const byCol = notesByColumn(mapped)
  const cols = [...byCol.keys()].sort((a, b) => a - b)
  for (const col of cols) {
    const byTrack = new Map<string, Mapped[]>()
    for (const note of byCol.get(col) ?? []) {
      const list = byTrack.get(note.trackId) ?? []
      list.push(note)
      byTrack.set(note.trackId, list)
    }
    const all = [...byTrack.values()].flat()
    const hasLead = all.some((note) => note.isMelody || note.role === 'lead')
    let cap = opts.chordCap
    const padCount = all.filter((note) => note.role === 'pad').length
    if (all.length <= 2) cap = Math.max(cap, all.length)
    else if (padCount > 0 && opts.padThin === 'hard') cap = Math.min(cap, hasLead ? Math.max(1, cap - 1) : 1)
    else if (padCount > 0 && opts.padThin === 'medium') cap = Math.min(cap, Math.max(2, Math.min(cap, 3)))
    if (all.length >= 7) cap = Math.max(cap, Math.min(opts.chordCap, 4))

    for (const group of byTrack.values()) {
      if (group.length <= 1) continue
      const seenPc = new Set<number>()
      const ordered = [...group].sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id))
      for (const note of ordered) {
        const pc = pitchClass(note.pitch)
        if (seenPc.has(pc) && !note.isMelody && !note.isBass) {
          note.removed = true
          simplified++
          pushDecision(decisions, {
            noteId: note.id,
            fromPitch: note.origPitch,
            toPitch: null,
            reason: 'octave/unison double of a kept chord tone',
          })
        } else {
          seenPc.add(pc)
        }
      }
      const live = group.filter((note) => !note.removed)
      if (live.length <= cap) continue
      const droppable = live.filter((note) => !note.isMelody && !note.isBass).sort(sortDropOrder)
      let extra = live.length - cap
      for (const note of droppable) {
        if (extra <= 0) break
        note.removed = true
        extra--
        poly++
        if (note.chordTone === 'extension' || note.chordTone === 'chromatic' || note.chordTone === 'fifth') chords++
        pushDecision(decisions, {
          noteId: note.id,
          fromPitch: note.origPitch,
          toPitch: null,
          reason: `low harmonic importance (${note.chordTone}); chord identity kept without it to stay within polyphony`,
        })
      }
    }
  }
  return { chords, poly, simplified }
}

function inStaffSamePcs(pc: number): number[] {
  const out: number[] = []
  for (let m = GT_LO; m <= GT_HI; m++) if (pitchClass(m) === pc) out.push(m)
  return out
}

function voiceLeadHarmony(mapped: Mapped[], preferLow: boolean): number {
  const byCol = notesByColumn(mapped)
  const cols = [...byCol.keys()].sort((a, b) => a - b)
  let prev: number[] = []
  let motion = 0
  let compared = 0
  const large = mapped.length > 4000
  for (const col of cols) {
    const group = (byCol.get(col) ?? [])
      .filter((note) => !note.isMelody && !note.isBass && (note.role === 'harmony' || note.role === 'pad'))
      .sort((a, b) => a.pitch - b.pitch || a.id.localeCompare(b.id))
    if (group.length === 0) {
      prev = []
      continue
    }
    if (group.length === 1) {
      prev = [group[0].pitch]
      continue
    }
    if (!large && group.length <= 5) {
      const options = group.map((note) => inStaffSamePcs(pitchClass(note.pitch)))
      const n = group.length
      const limit = 1 << n
      let bestMask = 0
      let bestScore = Number.POSITIVE_INFINITY
      for (let mask = 0; mask < limit; mask++) {
        const voicing: number[] = []
        let ok = true
        for (let i = 0; i < n; i++) {
          const choices = options[i]
          const pick = choices.length === 0 ? group[i].pitch : choices[(mask >> i) & 1] ?? choices[0]
          if (!inStaff(pick)) {
            ok = false
            break
          }
          voicing.push(pick)
        }
        if (!ok) continue
        const span = Math.max(...voicing) - Math.min(...voicing)
        let move = 0
        if (prev.length > 0) {
          const used = new Array(prev.length).fill(false)
          for (const p of voicing) {
            let best = 99
            let bestJ = -1
            for (let j = 0; j < prev.length; j++) {
              if (used[j]) continue
              const d = Math.abs(p - prev[j])
              if (d < best) {
                best = d
                bestJ = j
              }
            }
            if (bestJ >= 0) {
              used[bestJ] = true
              move += best
            }
          }
        }
        const mean = voicing.reduce((a, b) => a + b, 0) / voicing.length
        const score = span * 2 + move * 3 + (preferLow ? mean * 0.2 : 0)
        if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) < 1e-9 && voicing.join(',') < group.map((note) => note.pitch).join(','))) {
          bestScore = score
          bestMask = mask
        }
      }
      for (let i = 0; i < n; i++) {
        const choices = inStaffSamePcs(pitchClass(group[i].pitch))
        if (choices.length === 0) continue
        group[i].pitch = choices[(bestMask >> i) & 1] ?? choices[0]
      }
    } else {
      for (const note of group) {
        const choices = inStaffSamePcs(pitchClass(note.pitch))
        if (choices.length === 0) continue
        let best = choices[0]
        let bestDist = Infinity
        const target = prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : preferLow ? GT_LO + 6 : (GT_LO + GT_HI) / 2
        for (const c of choices) {
          const d = Math.abs(c - target)
          if (d < bestDist || (d === bestDist && c < best)) {
            bestDist = d
            best = c
          }
        }
        note.pitch = best
      }
    }
    const now = group.map((note) => note.pitch).sort((a, b) => a - b)
    if (prev.length > 0) {
      const n = Math.min(prev.length, now.length)
      for (let i = 0; i < n; i++) motion += Math.abs(now[i] - prev[i])
      compared += n
    }
    prev = now
  }
  return compared > 0 ? motion / compared : 0
}

function separateBassAndMelody(mapped: Mapped[]): void {
  const byCol = notesByColumn(mapped)
  for (const group of byCol.values()) {
    const melodies = group.filter((note) => note.isMelody)
    const basses = group.filter((note) => note.isBass)
    for (const bass of basses) {
      for (const mel of melodies) {
        if (bass.pitch !== mel.pitch) continue
        const low = nearestInStaffSamePc(bass.pitch, GT_LO)
        const high = nearestInStaffSamePc(mel.pitch, GT_HI)
        if (low !== high) {
          bass.pitch = low
          mel.pitch = high
        } else if (inStaff(bass.pitch - 12)) {
          bass.pitch -= 12
        } else if (inStaff(mel.pitch + 12)) {
          mel.pitch += 12
        }
      }
    }
  }
}

function motifMismatch(mapped: Mapped[], score: MusicalScore): { mismatches: number; preserved: number } {
  const byMotif = new Map<string, Mapped[][]>()
  const byPhrase = new Map<number, Mapped[]>()
  for (const note of mapped) {
    if (note.removed) continue
    const list = byPhrase.get(note.phraseId) ?? []
    list.push(note)
    byPhrase.set(note.phraseId, list)
  }
  for (const phrase of score.phrases) {
    if (!phrase.motifId) continue
    const notes = (byPhrase.get(phrase.id) ?? []).sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch || a.id.localeCompare(b.id))
    const list = byMotif.get(phrase.motifId) ?? []
    list.push(notes)
    byMotif.set(phrase.motifId, list)
  }
  let mismatches = 0
  let preserved = 0
  for (const occurrences of byMotif.values()) {
    if (occurrences.length < 2) continue
    const sig = (notes: Mapped[]) => notes.map((note, i) => (i === 0 ? 0 : note.pitch - notes[i - 1].pitch)).join(',')
    const first = sig(occurrences[0])
    let ok = true
    for (let i = 1; i < occurrences.length; i++) {
      if (sig(occurrences[i]) !== first) {
        ok = false
        mismatches++
      }
    }
    if (ok) preserved++
  }
  return { mismatches, preserved }
}

function evaluate(
  mapped: Mapped[],
  score: MusicalScore,
  k: number,
  octaves: Map<number, number>,
  extras: { chords: number; poly: number; simplified: number; voice: number },
): { total: number; stats: ArrangementStats; tie: string } {
  const live = mapped.filter((note) => !note.removed)
  let playable = 0
  let melodyPlayable = 0
  let bassPlayable = 0
  let harmonicPlayable = 0
  let melodyKept = 0
  let deletedMelody = 0
  let deletedBass = 0
  let deletedOther = 0
  let octaveShifted = 0
  for (const note of mapped) {
    if (note.removed) {
      if (note.isMelody) deletedMelody++
      else if (note.isBass) deletedBass++
      else deletedOther++
      continue
    }
    playable += inStaff(note.pitch) ? 1 : 0
    if (note.isMelody && inStaff(note.pitch)) melodyPlayable++
    if (note.isBass && inStaff(note.pitch)) bassPlayable++
    if (!note.isMelody && !note.isBass && inStaff(note.pitch)) harmonicPlayable++
    if (note.isMelody) melodyKept++
    const octaveDelta = note.pitch - (note.origPitch + k)
    if (Math.abs(octaveDelta) >= 12) octaveShifted++
  }

  const melody = live.filter((note) => note.isMelody).sort((a, b) => a.startBeat - b.startBeat || a.id.localeCompare(b.id))
  const origMel = melody.map((note) => note.origPitch)
  const newMel = melody.map((note) => note.pitch)
  const contour = scoreContour(
    origMel,
    newMel,
    melody.map((note) => Math.max(1, note.importance)),
  )
  const motifs = motifMismatch(mapped, score)
  let phraseOctCost = 0
  for (const o of octaves.values()) phraseOctCost += (Math.abs(o) / 12) * ARRANGE_WEIGHTS.phraseOctave

  const origIn = mapped.filter((note) => inStaff(note.origPitch)).length
  const inRatio = origIn / Math.max(1, mapped.length)
  const leftover = live.filter((note) => !inStaff(note.pitch)).length
  const total =
    playable * ARRANGE_WEIGHTS.playable +
    melodyPlayable * ARRANGE_WEIGHTS.melodyPlayable +
    bassPlayable * ARRANGE_WEIGHTS.bassPlayable +
    harmonicPlayable * ARRANGE_WEIGHTS.harmonicPlayable -
    contour.breaks * ARRANGE_WEIGHTS.contourBreak * Math.max(1, melody.length) -
    contour.intervalDelta * ARRANGE_WEIGHTS.intervalDelta -
    leftover * 50 -
    extras.voice * ARRANGE_WEIGHTS.voiceLead * Math.max(1, live.length / 8) -
    Math.abs(k) * ARRANGE_WEIGHTS.chromaticAbs * (1 + 12 * inRatio) -
    phraseOctCost -
    contour.jumps * ARRANGE_WEIGHTS.octaveJump * Math.max(1, melody.length) -
    deletedMelody * ARRANGE_WEIGHTS.deletedMelody -
    deletedBass * ARRANGE_WEIGHTS.deletedBass -
    deletedOther * ARRANGE_WEIGHTS.deletedOther -
    motifs.mismatches * ARRANGE_WEIGHTS.motifMismatch -
    extras.poly * ARRANGE_WEIGHTS.polyphony

  const stats: ArrangementStats = {
    notesPreserved: live.length,
    notesOctaveShifted: octaveShifted,
    notesTransposed: k === 0 ? 0 : live.length,
    notesRemoved: deletedMelody + deletedBass + deletedOther,
    notesSimplified: extras.simplified,
    chordsSimplified: extras.chords,
    melodicNotesPreserved: melodyKept,
    melodicContourChanges: Math.round(contour.breaks * melody.length),
    averageMelodicIntervalChange: Math.round(contour.intervalDelta * 100) / 100,
    maximumMelodicJump: contour.maxJump,
    voiceLeadingMovement: Math.round(extras.voice * 100) / 100,
    repeatedMotifsPreserved: motifs.preserved,
    rhythmPreserved: 1,
    polyphonyReductions: extras.poly,
    arrangementScore: total,
  }
  const tie = live
    .slice()
    .sort((a, b) => a.startBeat - b.startBeat || a.id.localeCompare(b.id))
    .slice(0, 40)
    .map((note) => note.pitch)
    .join(',')
  return { total, stats, tie }
}

function withRegisterBonus(total: number, mapped: Mapped[], preferLow: boolean): number {
  const live = mapped.filter((note) => !note.removed)
  if (live.length === 0) return total
  const groups: { role: DetectedRole; notes: Mapped[] }[] = [
    { role: 'lead', notes: live.filter((note) => note.isMelody || note.role === 'lead') },
    { role: 'bass', notes: live.filter((note) => note.isBass || note.role === 'bass') },
    { role: 'harmony', notes: live.filter((note) => !note.isMelody && !note.isBass && note.role !== 'lead' && note.role !== 'bass') },
  ]
  for (const group of groups) {
    if (group.notes.length === 0) continue
    let mean = 0
    for (const note of group.notes) mean += note.pitch
    mean /= group.notes.length
    const weight = group.role === 'lead' ? 0.18 : group.role === 'bass' ? 0.1 : ARRANGE_WEIGHTS.centerMean
    total -= Math.abs(mean - registerTarget(group.role, preferLow)) * weight
  }
  return total
}

/**
 * Arrange a musical score into Growtopia's two-octave staff without baking tiles.
 * Deterministic: equal scores break by |k|, then octave cost, then pitch string.
 */
export function arrangeForStaff(score: MusicalScore, opts: ArrangeOptions): ArrangeResult {
  const importance = new Map(score.notes.map((note) => [note.id, note.importance]))
  const pitched = score.notes.filter((note) => note.role !== 'drums')
  if (pitched.length === 0) {
    return {
      globalShift: 0,
      pitches: new Map(),
      removed: new Set(),
      importance,
      decisions: [],
      stats: {
        notesPreserved: 0,
        notesOctaveShifted: 0,
        notesTransposed: 0,
        notesRemoved: 0,
        notesSimplified: 0,
        chordsSimplified: 0,
        melodicNotesPreserved: 0,
        melodicContourChanges: 0,
        averageMelodicIntervalChange: 0,
        maximumMelodicJump: 0,
        voiceLeadingMovement: 0,
        repeatedMotifsPreserved: 0,
        rhythmPreserved: 1,
        polyphonyReductions: 0,
        arrangementScore: 0,
      },
    }
  }

  const keys = candidateKeys(score, opts)
  const groups = phraseGroups(score)
  let best: {
    k: number
    octaves: Map<number, number>
    mapped: Mapped[]
    decisions: ArrangeDecision[]
    stats: ArrangementStats
    total: number
    tie: string
    octCost: number
  } | null = null

  for (const k of keys) {
    const octaves = new Map<number, number>()
    const kFits = pitched.every((note) => inStaff(note.pitch + k))
    if (kFits) {
      for (const phrase of score.phrases) octaves.set(phrase.id, 0)
    } else {
      for (const group of groups) {
        const o = pickPhraseOctave(group, score, k, opts.preferLow)
        for (const phrase of group) octaves.set(phrase.id, o)
      }
    }
    const mapped = cloneMapped(score)
    const decisions: ArrangeDecision[] = []
    applyShiftAndOctaves(mapped, k, octaves, decisions)
    const extras = simplifyColumns(mapped, opts, decisions)
    const voice = voiceLeadHarmony(mapped, opts.preferLow)
    separateBassAndMelody(mapped)
    const ev = evaluate(mapped, score, k, octaves, { ...extras, voice })
    const total = withRegisterBonus(ev.total, mapped, opts.preferLow)
    let octCost = 0
    for (const o of octaves.values()) octCost += Math.abs(o)
    const better =
      !best ||
      total > best.total + 1e-9 ||
      (Math.abs(total - best.total) <= 1e-9 && Math.abs(k) < Math.abs(best.k)) ||
      (Math.abs(total - best.total) <= 1e-9 && Math.abs(k) === Math.abs(best.k) && octCost < best.octCost) ||
      (Math.abs(total - best.total) <= 1e-9 && Math.abs(k) === Math.abs(best.k) && octCost === best.octCost && (k > best.k || (k === best.k && ev.tie < best.tie)))
    if (better) {
      ev.stats.arrangementScore = Math.round(total * 100) / 100
      best = { k, octaves, mapped, decisions, stats: ev.stats, total, tie: ev.tie, octCost }
    }
  }

  const chosen = best!
  const pitches = new Map<string, number>()
  const removed = new Set<string>()
  for (const note of chosen.mapped) {
    if (note.removed) removed.add(note.id)
    else pitches.set(note.id, note.pitch)
  }
  if (chosen.k !== 0) {
    chosen.decisions.unshift({
      noteId: chosen.mapped[0]?.id ?? '',
      fromPitch: chosen.mapped[0]?.origPitch ?? 0,
      toPitch: (chosen.mapped[0]?.origPitch ?? 0) + chosen.k,
      reason: `global chromatic shift ${chosen.k > 0 ? '+' : ''}${chosen.k} is the best-fit transposition for melody, harmony, and range`,
    })
    if (chosen.decisions.length > DECISION_CAP) chosen.decisions.length = DECISION_CAP
  }
  return {
    globalShift: chosen.k,
    pitches,
    removed,
    importance,
    decisions: chosen.decisions,
    stats: chosen.stats,
  }
}

export function applyArrangement(song: Song, result: ArrangeResult): void {
  for (const track of song.tracks) {
    if (track.instrument === 'drums') continue
    track.notes = track.notes.filter((note) => {
      if (result.removed.has(note.id)) return false
      const pitch = result.pitches.get(note.id)
      if (pitch != null) note.pitch = pitch
      return true
    })
  }
}
