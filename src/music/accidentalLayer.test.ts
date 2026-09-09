import { describe, expect, it } from 'vitest'
import {
  accidentalTrackName,
  createAccidentalTrack,
  ensureAccidentalLayer,
  findAccidentalTrack,
  placementFields,
  stripAccidentalSuffix,
  variantFromModifiers,
} from './accidentalLayer'
import { createEmptySong, createTrack } from './SongModel'

describe('accidental layer names', () => {
  it('strips sharp and flat suffixes without eating words like Club', () => {
    expect(stripAccidentalSuffix('Melody ♯')).toBe('Melody')
    expect(stripAccidentalSuffix('Melody ♭')).toBe('Melody')
    expect(stripAccidentalSuffix('Melody#')).toBe('Melody')
    expect(stripAccidentalSuffix('Melody b')).toBe('Melody')
    expect(stripAccidentalSuffix('Club')).toBe('Club')
  })

  it('names layers from the natural base', () => {
    expect(accidentalTrackName('Melody ♯', 'flat')).toBe('Melody ♭')
    expect(accidentalTrackName('Chords', 'sharp')).toBe('Chords ♯')
    expect(accidentalTrackName('Bass', 'natural')).toBe('Bass')
  })
})

describe('variantFromModifiers', () => {
  it('prefers sharp when both keys are held', () => {
    expect(variantFromModifiers({ shiftKey: true, altKey: true })).toBe('sharp')
    expect(variantFromModifiers({ shiftKey: false, altKey: true })).toBe('flat')
    expect(variantFromModifiers({ shiftKey: false, altKey: false })).toBe(null)
  })
})

describe('ensureAccidentalLayer', () => {
  it('reuses a same-instrument layer with a matching name', () => {
    const song = createEmptySong('Layers')
    const melody = createTrack('Melody', 'piano')
    const chords = createTrack('Chords', 'piano')
    const melodySharp = createAccidentalTrack(melody, 'sharp')
    song.tracks = [melody, chords, melodySharp]
    expect(findAccidentalTrack(song, melody, 'sharp')?.id).toBe(melodySharp.id)
    expect(ensureAccidentalLayer(song, melody, 'sharp')).toEqual({
      track: melodySharp,
      created: false,
    })
  })

  it('creates a sharp piano layer next to the source name when none exists', () => {
    const song = createEmptySong('Layers')
    const melody = createTrack('Melody', 'piano')
    song.tracks = [melody]
    const plan = ensureAccidentalLayer(song, melody, 'sharp')
    expect(plan.created).toBe(true)
    expect(plan.track.name).toBe('Melody ♯')
    expect(plan.track.instrument).toBe('piano')
    expect(plan.track.gtVariant).toBe('sharp')
    expect(plan.track.gtNumType).toBe(melody.gtNumType! + 2)
  })

  it('falls back to any matching instrument+variant layer', () => {
    const song = createEmptySong('Layers')
    const melody = createTrack('Melody', 'piano')
    const otherSharp = createAccidentalTrack(createTrack('Chords', 'piano'), 'sharp')
    song.tracks = [melody, otherSharp]
    expect(ensureAccidentalLayer(song, melody, 'sharp').track.id).toBe(otherSharp.id)
  })

  it('ignores modifiers on drums', () => {
    const song = createEmptySong('Drums')
    const drums = createTrack('Drums', 'drums')
    song.tracks = [drums]
    expect(ensureAccidentalLayer(song, drums, 'sharp')).toEqual({ track: drums, created: false })
    expect(placementFields(drums, 'sharp').gtVariant).toBe('natural')
  })

  it('stays on the selected track when it already matches', () => {
    const song = createEmptySong('Layers')
    const sharp = createAccidentalTrack(createTrack('Melody', 'piano'), 'sharp')
    song.tracks = [sharp]
    expect(ensureAccidentalLayer(song, sharp, 'sharp')).toEqual({ track: sharp, created: false })
  })
})
