import { describe, expect, it } from 'vitest'
import { createEmptySong, createNote, createTrack } from '../music/SongModel'
import { beatToWorldX, getCompressMap, hitWorldPlayhead, GT_BLOCK_SIZE } from './worldLayout'

describe('world compress map', () => {
  it('is a no-op when compress is off', () => {
    const song = createEmptySong('Open')
    const track = createTrack('Lead', 'piano')
    track.notes = [createNote(60, 0, 0.25), createNote(62, 20, 0.25)]
    song.tracks = [track]
    const map = getCompressMap(song, false)
    expect(map.toVisual(80)).toBe(80)
    expect(map.toMusic(80)).toBe(80)
  })

  it('keeps a short empty gap and collapses the rest', () => {
    const song = createEmptySong('Packed')
    const track = createTrack('Lead', 'piano')
    track.notes = [createNote(60, 0, 0.25), createNote(62, 20, 0.25)]
    song.tracks = [track]
    const map = getCompressMap(song, true)
    expect(map.toVisual(0)).toBe(0)
    expect(map.toVisual(80)).toBe(5)
    expect(map.toMusic(5)).toBe(80)
  })
})

describe('world playhead hit', () => {
  it('only grabs the caret above the top row', () => {
    const top = 120
    const x = 200
    expect(hitWorldPlayhead(x, top - 8, x, top)).toBe(true)
    expect(hitWorldPlayhead(x, top - 1, x, top)).toBe(true)
    expect(hitWorldPlayhead(x, top, x, top)).toBe(false)
    expect(hitWorldPlayhead(x, top + 8, x, top)).toBe(false)
  })
})

describe('beatToWorldX', () => {
  it('maps fractional beats continuously', () => {
    const song = createEmptySong('Open')
    const a = beatToWorldX(0, 1, false, song)
    const b = beatToWorldX(0.25, 1, false, song)
    const mid = beatToWorldX(0.125, 1, false, song)
    expect(b - a).toBe(GT_BLOCK_SIZE)
    expect(mid).toBe((a + b) / 2)
  })
})
