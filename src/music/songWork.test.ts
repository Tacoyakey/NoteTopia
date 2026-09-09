import { describe, expect, it } from 'vitest'
import { createEmptySong, createNote, createTrack } from './SongModel'
import { songHasWork } from './songWork'

describe('songHasWork', () => {
  it('is false for an empty sheet', () => {
    expect(songHasWork(createEmptySong('Untitled'))).toBe(false)
  })

  it('is true once any track has a note', () => {
    const song = createEmptySong('Jam')
    const track = createTrack('Lead', 'piano')
    track.notes.push(createNote(60, 0, 1))
    song.tracks = [track]
    expect(songHasWork(song)).toBe(true)
  })
})
