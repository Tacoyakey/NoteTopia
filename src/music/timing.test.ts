import { describe, expect, it } from 'vitest'
import { createEmptySong, createNote, createTrack } from './SongModel'
import { getPlaybackDurationBeats, getSongDurationBeats, formatDurationClock } from './timing'

describe('playback duration', () => {
  it('loops at the next bar instead of padding past the last note', () => {
    const song = createEmptySong('Clip')
    const track = createTrack('Melody', 'piano')
    track.notes = [createNote(60, 15.75, 0.25)]
    song.tracks = [track]
    expect(getPlaybackDurationBeats(song)).toBe(16)
    expect(getSongDurationBeats(song)).toBeGreaterThan(16)
  })

  it('keeps going past four bars when notes continue', () => {
    const song = createEmptySong('Long')
    const track = createTrack('Melody', 'piano')
    track.notes = [createNote(60, 20, 0.25)]
    song.tracks = [track]
    expect(getPlaybackDurationBeats(song)).toBe(24)
  })
})

describe('formatDurationClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDurationClock(0)).toBe('0:00')
    expect(formatDurationClock(75)).toBe('1:15')
    expect(formatDurationClock(183.4)).toBe('3:03')
  })
})
