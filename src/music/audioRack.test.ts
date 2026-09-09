import { describe, expect, it } from 'vitest'
import {
  encodeRackNotes,
  noteToRackToken,
  parseRackNotes,
  soundingMidi,
} from './audioRack'
import { createNote, createTrack } from './SongModel'

describe('audio rack encoding', () => {
  it('parses spaced and unspaced Growtopia tokens', () => {
    expect(parseRackNotes('PA# DB- BCb')).toEqual([
      { instrument: 'piano', pitchLine: 2, variant: 'sharp' },
      { instrument: 'drums', pitchLine: 1, variant: 'natural' },
      { instrument: 'bass', pitchLine: 7, variant: 'flat' },
    ])
    expect(parseRackNotes('PA#DB-BCb')).toHaveLength(3)
  })

  it('keeps sharp and flat accidentals in tokens', () => {
    const piano = createTrack('Piano', 'piano')
    piano.gtVariant = 'sharp'
    const note = createNote(60, 0, 0.25)
    note.pitchLine = 7
    note.gtVariant = 'sharp'
    expect(noteToRackToken(piano, note)).toBe('PC#')

    note.gtVariant = 'flat'
    expect(noteToRackToken(piano, note)).toBe('PCb')

    note.gtVariant = 'natural'
    expect(noteToRackToken(piano, note)).toBe('PC-')
  })

  it('caps at five notes and encodes back', () => {
    const slots = parseRackNotes('PC- PD- PE- PF- PG- PA-')
    expect(slots).toHaveLength(5)
    expect(encodeRackNotes(['PC-', 'PD-', 'PE-'])).toBe('PC- PD- PE-')
  })

  it('sounds sharps a semitone above the written line', () => {
    expect(soundingMidi(7, 'natural')).toBe(60)
    expect(soundingMidi(7, 'sharp')).toBe(61)
    expect(soundingMidi(7, 'flat')).toBe(59)
  })
})
