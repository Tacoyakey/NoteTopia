import { describe, expect, it } from 'vitest'
import { createEmptySong, createImportedNote, createTrack } from '../../SongModel'
import { analyzeSong } from './analyze'
import { resolveTrackRoles } from './roles'

describe('Smart analyze + roles', () => {
  it('detects a C major triad as C major', () => {
    const song = createEmptySong('Key')
    const piano = createTrack('Piano', 'piano')
    piano.notes = [60, 64, 67].map((pitch, i) => createImportedNote(pitch, i, 1, 90))
    song.tracks = [piano]
    expect(analyzeSong(song).key.name).toBe('C major')
  })

  it('picks bass by register, not track order', () => {
    const low = createTrack('Low piano', 'piano')
    low.notes = [36, 38, 41, 43].map((pitch, i) => createImportedNote(pitch, i, 0.5, 90))
    const lead = createTrack('Air', 'piano')
    lead.notes = [72, 74, 76, 79].map((pitch, i) => createImportedNote(pitch, i * 0.5, 0.25, 90))
    const song = createEmptySong('Roles')
    song.tracks = [low, lead]
    const roles = resolveTrackRoles(song)
    expect(roles.get(low.id)).toBe('bass')
    expect(roles.get(lead.id)).toBe('lead')
  })

  it('picks a piano melody over a sax doubling', () => {
    const piano = createTrack('Piano', 'piano')
    piano.notes = [60, 62, 64, 65, 67, 69, 71, 72].map((pitch, i) =>
      createImportedNote(pitch, i * 0.5, 0.4, 96),
    )
    const sax = createTrack('Sax', 'sax')
    sax.notes = [72, 74].map((pitch, i) => createImportedNote(pitch, i * 2, 1.5, 80))
    const song = createEmptySong('Melody')
    song.tracks = [piano, sax]
    const roles = resolveTrackRoles(song)
    expect(roles.get(piano.id)).toBe('lead')
    expect(roles.get(sax.id)).toBe('harmony')
  })

  it('treats long overlapping chords as a pad', () => {
    const pad = createTrack('Warm', 'piano')
    pad.notes = [48, 52, 55, 60].flatMap((pitch) =>
      [0, 2, 4, 6].map((beat) => createImportedNote(pitch, beat, 1.5, 70)),
    )
    const song = createEmptySong('Pad')
    song.tracks = [pad]
    expect(resolveTrackRoles(song).get(pad.id)).toBe('pad')
  })
})
