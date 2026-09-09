import { describe, expect, it } from 'vitest'
import { quantizeNoteStart, quantizeSongNotes } from './quantize'
import { createEmptySong, createNoteFromTrack, createTrack } from './SongModel'
import { paintNoteBeats, selectSamePitchIds, sliceNoteAtBeat } from './editTools'

describe('quantize', () => {
  it('hard-snaps to 16ths at 100% strength', () => {
    expect(quantizeNoteStart(0.1, 16, 100)).toBeCloseTo(0)
    expect(quantizeNoteStart(0.2, 16, 100)).toBeCloseTo(0.25)
  })

  it('moves halfway at 50% strength', () => {
    expect(quantizeNoteStart(0.1, 16, 50)).toBeCloseTo(0.05)
  })

  it('patches only selected notes', () => {
    const song = createEmptySong('Q')
    const piano = createTrack('Melody', 'piano')
    const a = createNoteFromTrack(piano, 60, 0.1)
    const b = createNoteFromTrack(piano, 64, 0.1)
    piano.notes = [a, b]
    song.tracks = [piano]
    const patches = quantizeSongNotes(song, new Set([a.id]), 16, 100)
    expect(patches).toHaveLength(1)
    expect(patches[0]?.noteId).toBe(a.id)
  })
})

describe('edit tools', () => {
  it('slices a note at the playhead', () => {
    const note = { id: 'n', pitch: 60, startBeat: 0, durationBeats: 1, velocity: 100 }
    const sliced = sliceNoteAtBeat(note, 0.5)
    expect(sliced?.left.durationBeats).toBeCloseTo(0.5)
    expect(sliced?.right.startBeat).toBeCloseTo(0.5)
    expect(sliced?.right.durationBeats).toBeCloseTo(0.5)
    expect(sliced?.right.id).not.toBe('n')
  })

  it('selects every note of the same pitch', () => {
    const song = createEmptySong('P')
    const piano = createTrack('Melody', 'piano')
    const a = createNoteFromTrack(piano, 60, 0)
    const b = createNoteFromTrack(piano, 64, 0.25)
    const c = createNoteFromTrack(piano, 60, 0.5)
    piano.notes = [a, b, c]
    song.tracks = [piano]
    expect(selectSamePitchIds(song, new Set([a.id]), true).sort()).toEqual([a.id, c.id].sort())
  })

  it('paints a run of snapped beats', () => {
    expect(paintNoteBeats(0, 0.5, 16)).toEqual([0, 0.25, 0.5])
  })
})
