import { describe, expect, it } from 'vitest'
import { addTrack, applyTrackUpdates, createEmptySong, createNoteFromTrack, createTrack, getActiveTracks, moveTrack } from './SongModel'
import { gtFieldsForInstrument } from './gtPitch'

describe('getActiveTracks', () => {
  it('omits muted tracks and keeps only soloed ones when any track is solo', () => {
    const song = createEmptySong('Mix')
    const piano = createTrack('Piano', 'piano')
    const bass = createTrack('Bass', 'bass')
    const drums = createTrack('Drums', 'drums')
    piano.solo = true
    drums.muted = true
    song.tracks = [piano, bass, drums]
    expect(getActiveTracks(song).map((t) => t.name)).toEqual(['Piano'])
  })

  it('does not let a muted solo track sound', () => {
    const song = createEmptySong('Mix')
    const piano = createTrack('Piano', 'piano')
    const bass = createTrack('Bass', 'bass')
    piano.solo = true
    piano.muted = true
    song.tracks = [piano, bass]
    expect(getActiveTracks(song)).toEqual([])
  })
})

describe('addTrack', () => {
  it('inserts after a given track', () => {
    const song = createEmptySong('Insert')
    const extra = createTrack('Sharp', 'piano')
    const next = addTrack(song, extra, song.tracks[0].id)
    expect(next.tracks.map((track) => track.name)).toEqual([
      'Melody',
      'Sharp',
      'Bass',
      'Chords',
      'Drums',
    ])
  })
})

describe('moveTrack', () => {
  it('reorders tracks by index', () => {
    const song = createEmptySong('Order')
    const last = song.tracks[song.tracks.length - 1]
    const next = moveTrack(song, last.id, 0)
    expect(next.tracks[0].id).toBe(last.id)
    expect(next.tracks.map((track) => track.id)).not.toEqual(song.tracks.map((track) => track.id))
    expect(next.tracks).toHaveLength(song.tracks.length)
  })

  it('clamps and no-ops when the index does not change', () => {
    const song = createEmptySong('Order')
    const first = song.tracks[0]
    expect(moveTrack(song, first.id, 0)).toBe(song)
    expect(moveTrack(song, first.id, 99).tracks.at(-1)?.id).toBe(first.id)
  })
})

describe('applyTrackUpdates', () => {
  it('retargets sheet sprites when the instrument changes', () => {
    const track = createTrack('Lead', 'piano')
    track.notes = [
      createNoteFromTrack(track, 60, 0),
      { ...createNoteFromTrack(track, 62, 0.25), gtNumType: 33, audioRack: { volume: 100, notes: 'PA-' } },
    ]
    const next = applyTrackUpdates(track, { instrument: 'flute', ...gtFieldsForInstrument('flute') })
    expect(next.instrument).toBe('flute')
    expect(next.gtNumType).toBe(15)
    expect(next.notes[0]?.gtNumType).toBe(15)
    expect(next.notes[1]?.gtNumType).toBe(33)
  })
})
