import { describe, expect, it } from 'vitest'
import { createEmptySong, createTrack } from '../../SongModel'
import type { Note, Song, Track } from '../../types'
import { analyzeSong } from './analyze'
import { ARRANGE_WEIGHTS, applyArrangement, arrangeForStaff, nearestInStaffSamePc } from './arrange'
import { IMPORTANCE_WEIGHTS, buildMusicalScore, chordToneOf, inStaff } from './ir'
import { resolveTrackRoles } from './roles'
import { GT_HI, GT_LO } from './pitch'

function raw(
  pitch: number,
  startBeat: number,
  extra: Partial<Note> = {},
): Note {
  return {
    id: extra.id ?? `n-${pitch}-${startBeat}`,
    pitch,
    startBeat,
    durationBeats: extra.durationBeats ?? 0.5,
    velocity: extra.velocity ?? 90,
    ...extra,
  }
}

function songOf(tracks: Track[]): Song {
  const song = createEmptySong('Arrange')
  song.tracks = tracks
  return song
}

const ARRANGE_OPTS = {
  fitKey: true,
  preferLow: true,
  keyLock: 'auto' as const,
  chordCap: 4,
  padThin: 'medium' as const,
}

function runArrange(tracks: Track[], opts: Partial<typeof ARRANGE_OPTS> = {}) {
  const song = songOf(tracks)
  const roles = resolveTrackRoles(song)
  const score = buildMusicalScore(song, roles, analyzeSong(song))
  const result = arrangeForStaff(score, { ...ARRANGE_OPTS, ...opts })
  applyArrangement(song, result)
  return { song, score, result }
}

function contour(pitches: number[]): number[] {
  return pitches.slice(1).map((pitch, i) => Math.sign(pitch - pitches[i]))
}

function pitched(song: Song): number[] {
  return song.tracks
    .filter((track) => track.instrument !== 'drums')
    .flatMap((track) => [...track.notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch))
    .map((note) => note.pitch)
}

describe('musical score + arranger', () => {
  it('ranks melody above bass above chord tones above decoration', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(72, 0, { id: 'mel' })]
    const bass = createTrack('Bass', 'bass')
    bass.notes = [raw(36, 0, { id: 'bass' })]
    const pad = createTrack('Pad', 'spooky')
    pad.notes = [
      raw(60, 0, { id: 'root', durationBeats: 1.5, velocity: 70 }),
      raw(64, 0, { id: 'third', durationBeats: 1.5, velocity: 70 }),
      raw(67, 0, { id: 'fifth', durationBeats: 1.5, velocity: 70 }),
      raw(66, 0, { id: 'ext', durationBeats: 1.5, velocity: 50 }),
    ]
    const { score } = runArrange([lead, bass, pad])
    const mel = score.byId.get('mel')!.importance
    const low = score.byId.get('bass')!.importance
    const root = score.byId.get('root')!.importance
    const ext = score.byId.get('ext')!.importance
    expect(mel).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(root)
    expect(root).toBeGreaterThan(ext)
    expect(IMPORTANCE_WEIGHTS.roleLead).toBeGreaterThan(IMPORTANCE_WEIGHTS.roleBass)
    expect(ARRANGE_WEIGHTS.deletedMelody).toBeGreaterThan(ARRANGE_WEIGHTS.deletedBass)
  })

  it('keeps a rising melody contour when the line crosses the staff top', () => {
    const lead = createTrack('Lead', 'flute')
    const orig = [67, 69, 71, 72, 74, 72, 71, 69]
    lead.notes = orig.map((pitch, i) => raw(pitch, i * 0.25, { id: `m${i}` }))
    const { song, result } = runArrange([lead])
    const pitches = pitched(song)
    expect(pitches).toHaveLength(orig.length)
    expect(contour(pitches)).toEqual(contour(orig))
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(GT_LO)
    expect(Math.max(...pitches)).toBeLessThanOrEqual(GT_HI)
    for (let i = 1; i < pitches.length; i++) {
      expect(Math.abs(pitches[i] - pitches[i - 1])).toBeLessThan(12)
    }
    expect(result.stats.melodicContourChanges).toBe(0)
  })

  it('does not zigzag a G5–D6 scale into a broken octave fold', () => {
    const lead = createTrack('Lead', 'flute')
    const orig = [79, 81, 83, 84, 86, 84, 83, 81]
    lead.notes = orig.map((pitch, i) => raw(pitch, i * 0.25, { id: `g${i}` }))
    const { song } = runArrange([lead], { preferLow: false })
    const pitches = pitched(song)
    expect(contour(pitches)).toEqual(contour(orig))
    expect(pitches).not.toEqual([67, 69, 71, 60, 62, 60, 59, 57])
  })

  it('fits a melody that spans more than two octaves without leaving the staff', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [36, 48, 60, 72, 84].map((pitch, i) => raw(pitch, i * 0.5, { id: `w${i}` }))
    const { song } = runArrange([lead])
    const pitches = pitched(song)
    expect(pitches.every(inStaff)).toBe(true)
    expect(pitches).toHaveLength(5)
  })

  it('simplifies a large chord by keeping root, third, seventh, and fifth', () => {
    const piano = createTrack('Pad', 'spooky')
    piano.notes = [60, 64, 67, 71, 74, 66].map((pitch, i) =>
      raw(pitch, 0, { id: `c${i}`, durationBeats: 1.5, velocity: 80 - i }),
    )
    const { song, result } = runArrange([piano], { chordCap: 4, padThin: 'off' })
    const pcs = new Set(pitched(song).map((p) => ((p % 12) + 12) % 12))
    expect(pitched(song).length).toBeLessThanOrEqual(4)
    expect(pcs.has(0)).toBe(true)
    expect(pcs.has(4)).toBe(true)
    expect(result.stats.chordsSimplified + result.stats.polyphonyReductions + result.stats.notesSimplified).toBeGreaterThan(
      0,
    )
  })

  it('converts a repeated motif with the same interval shape each time', () => {
    const lead = createTrack('Lead', 'flute')
    const motif = [60, 62, 64, 65]
    lead.notes = [0, 4, 8].flatMap((bar, r) =>
      motif.map((pitch, i) => raw(pitch, bar + i * 0.25, { id: `r${r}-${i}` })),
    )
    const { song, result } = runArrange([lead])
    const pitches = pitched(song)
    expect(pitches).toHaveLength(12)
    const a = contour(pitches.slice(0, 4))
    expect(contour(pitches.slice(4, 8))).toEqual(a)
    expect(contour(pitches.slice(8, 12))).toEqual(a)
    expect(result.stats.repeatedMotifsPreserved).toBeGreaterThanOrEqual(1)
  })

  it('keeps bass below melody when they share a pitch class', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(72, 0, { id: 'mel' })]
    const bass = createTrack('Bass', 'bass')
    bass.notes = [raw(36, 0, { id: 'bass' })]
    const { song } = runArrange([lead, bass])
    const mel = song.tracks.find((track) => track.instrument === 'flute')!.notes[0].pitch
    const low = song.tracks.find((track) => track.instrument === 'bass')!.notes[0].pitch
    expect(inStaff(mel)).toBe(true)
    expect(inStaff(low)).toBe(true)
    expect(low).toBeLessThan(mel)
  })

  it('keeps chromatic passing tones in a melody', () => {
    const lead = createTrack('Lead', 'flute')
    const orig = [60, 62, 63, 64, 65]
    lead.notes = orig.map((pitch, i) => raw(pitch, i * 0.25, { id: `ch${i}` }))
    const { song, score } = runArrange([lead])
    expect(score.byId.get('ch2')).toBeDefined()
    const pitches = pitched(song)
    expect(pitches).toHaveLength(5)
    expect(contour(pitches)).toEqual(contour(orig))
    const intervals = pitches.slice(1).map((p, i) => p - pitches[i])
    expect(intervals.every((d) => Math.abs(d) <= 3)).toBe(true)
  })

  it('keeps fast repeated notes as separate attacks', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [0, 0.25, 0.5, 0.75].map((beat, i) => raw(60, beat, { id: `f${i}` }))
    const { song } = runArrange([lead])
    expect(pitched(song)).toEqual([60, 60, 60, 60])
    expect(song.tracks[0].notes.map((note) => note.startBeat)).toEqual([0, 0.25, 0.5, 0.75])
  })

  it('does not move syncopated on-grid attacks', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [0, 0.75, 1.25, 2].map((beat, i) => raw(64, beat, { id: `s${i}` }))
    const { song, result } = runArrange([lead])
    expect(song.tracks[0].notes.map((note) => note.startBeat)).toEqual([0, 0.75, 1.25, 2])
    expect(result.stats.rhythmPreserved).toBe(1)
  })

  it('leaves tempo metadata and beat times alone when BPM changes exist', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(60, 0, { id: 'a' }), raw(64, 1.5, { id: 'b' })]
    const song = songOf([lead])
    song.bpm = 90
    const roles = resolveTrackRoles(song)
    const score = buildMusicalScore(song, roles, analyzeSong(song))
    expect(score.tempo).toBe(90)
    const result = arrangeForStaff(score, ARRANGE_OPTS)
    applyArrangement(song, result)
    expect(song.bpm).toBe(90)
    expect(song.tracks[0].notes.map((note) => note.startBeat)).toEqual([0, 1.5])
  })

  it('arranges multiple instruments without dropping drums', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(76, 0, { id: 'fl' })]
    const bass = createTrack('Bass', 'bass')
    bass.notes = [raw(40, 0, { id: 'ba' })]
    const drums = createTrack('Drums', 'drums')
    drums.notes = [raw(36, 0, { id: 'kick' })]
    const { song } = runArrange([lead, bass, drums])
    expect(song.tracks.some((track) => track.instrument === 'drums')).toBe(true)
    expect(song.tracks.find((track) => track.instrument === 'drums')!.notes[0].pitch).toBe(36)
    expect(pitched(song).every(inStaff)).toBe(true)
  })

  it('passes an empty pitched score through', () => {
    const drums = createTrack('Drums', 'drums')
    drums.notes = [raw(36, 0, { id: 'kick' })]
    const { result } = runArrange([drums])
    expect(result.pitches.size).toBe(0)
    expect(result.globalShift).toBe(0)
  })

  it('keeps a single in-range note', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(60, 0, { id: 'one' })]
    const { song, result } = runArrange([lead])
    expect(pitched(song)).toEqual([60])
    expect(result.globalShift).toBe(0)
  })

  it('thins extremely dense simultaneous notes', () => {
    const piano = createTrack('Wall', 'spooky')
    piano.notes = Array.from({ length: 12 }, (_, i) =>
      raw(48 + i * 2, 0, { id: `d${i}`, durationBeats: 1.5, velocity: 90 - i }),
    )
    const { song } = runArrange([piano], { chordCap: 4 })
    expect(pitched(song).length).toBeLessThanOrEqual(4)
    expect(pitched(song).every(inStaff)).toBe(true)
  })

  it('arranges a long song in linear time and stays in range', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = Array.from({ length: 800 }, (_, i) => raw(55 + (i % 18), i * 0.25, { id: `L${i}` }))
    const started = Date.now()
    const { song, result } = runArrange([lead])
    expect(Date.now() - started).toBeLessThan(2000)
    expect(pitched(song).every(inStaff)).toBe(true)
    expect(result.stats.arrangementScore).toBeTypeOf('number')
  })

  it('keeps notes already on the staff boundaries', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(48, 0, { id: 'lo' }), raw(71, 0.5, { id: 'hi' })]
    const { song } = runArrange([lead], { preferLow: false, fitKey: false })
    expect(pitched(song)).toEqual([48, 71])
  })

  it('folds a note one semitone outside the staff onto the same pitch class', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [raw(72, 0, { id: 'c5' })]
    const { song } = runArrange([lead], { fitKey: false })
    expect(pitched(song)).toHaveLength(1)
    expect(inStaff(pitched(song)[0])).toBe(true)
    expect(pitched(song)[0] % 12).toBe(0)
  })

  it('nearest in-staff pitch class is deterministic', () => {
    expect(nearestInStaffSamePc(72, 60)).toBe(60)
    expect(nearestInStaffSamePc(47, 48)).toBe(59)
    expect(chordToneOf(4, 0)).toBe('third')
    expect(chordToneOf(6, 0)).toBe('extension')
  })

  it('is deterministic for the same score', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [79, 81, 83, 84].map((pitch, i) => raw(pitch, i * 0.25, { id: `t${i}` }))
    const a = runArrange([lead]).song.tracks[0].notes.map((note) => note.pitch)
    const b = runArrange([lead]).song.tracks[0].notes.map((note) => note.pitch)
    expect(a).toEqual(b)
  })

  it('records a reason when a phrase is octave-shifted', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [79, 81, 83, 84, 86].map((pitch, i) => raw(pitch, i * 0.25, { id: `d${i}` }))
    const { result } = runArrange([lead])
    expect(result.decisions.length).toBeGreaterThan(0)
    expect(result.decisions.some((row) => row.reason.length > 8)).toBe(true)
  })
})
