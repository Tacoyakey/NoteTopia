import { describe, expect, it } from 'vitest'
import { createEmptySong, createImportedNote, createTrack } from '../SongModel'
import { prepareImportSong, QUIET_VELOCITY } from './prepareImport'

describe('prepareImportSong', () => {
  it('drops drum tracks', () => {
    const song = createEmptySong('Prep')
    song.tracks = [
      createTrack('Lead', 'piano'),
      createTrack('Kit', 'drums'),
    ]
    song.tracks[0].notes = [createImportedNote(64, 0, 0.5, 90)]
    song.tracks[1].notes = [createImportedNote(36, 0, 0.5, 90)]
    const next = prepareImportSong(song, { skipDrums: true })
    expect(next.tracks.map((t) => t.instrument)).toEqual(['piano'])
  })

  it('trims leading silence', () => {
    const song = createEmptySong('Prep')
    song.tracks = [createTrack('Lead', 'piano')]
    song.tracks[0].notes = [createImportedNote(64, 8, 0.5, 90)]
    const next = prepareImportSong(song, { trimSilence: true })
    expect(next.tracks[0].notes[0].startBeat).toBe(0)
  })

  it('drops quiet notes', () => {
    const song = createEmptySong('Prep')
    song.tracks = [createTrack('Lead', 'piano')]
    song.tracks[0].notes = [
      createImportedNote(64, 0, 0.5, QUIET_VELOCITY),
      createImportedNote(67, 1, 0.5, 90),
    ]
    const next = prepareImportSong(song, { dropQuiet: true })
    expect(next.tracks[0].notes).toHaveLength(1)
    expect(next.tracks[0].notes[0].pitch).toBe(67)
  })
})
