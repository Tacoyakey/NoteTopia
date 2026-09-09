import { Midi } from '@tonejs/midi'
import { describe, expect, it } from 'vitest'
import { exportSongToMidi } from './midiExport'
import { createEmptySong, createNote, createTrack } from './SongModel'
import { GT_BLANK, GT_REPEAT_BEGIN } from './gtPitch'

describe('MIDI export', () => {
  it('writes note times in seconds, not beats', () => {
    const song = createEmptySong('Clip')
    song.bpm = 120
    const track = createTrack('Lead', 'piano')
    track.notes = [createNote(60, 4, 1)]
    song.tracks = [track]

    const midi = new Midi(exportSongToMidi(song))
    const note = midi.tracks[0]?.notes[0]
    expect(note).toBeDefined()
    expect(note!.time).toBeCloseTo(2, 5)
    expect(note!.duration).toBeCloseTo(0.5, 5)
    expect(note!.midi).toBe(60)
  })

  it('skips repeat markers and blank tiles', () => {
    const song = createEmptySong('Markers')
    const track = createTrack('Lead', 'piano')
    const sounding = createNote(64, 0, 0.25)
    const repeat = { ...createNote(64, 1, 0.25), gtNumType: GT_REPEAT_BEGIN }
    const blank = { ...createNote(64, 2, 0.25), gtNumType: GT_BLANK }
    track.notes = [sounding, repeat, blank]
    song.tracks = [track]

    const midi = new Midi(exportSongToMidi(song))
    expect(midi.tracks[0]?.notes).toHaveLength(1)
    expect(midi.tracks[0]?.notes[0]?.midi).toBe(64)
  })

  it('exports written sharps as the sounding MIDI pitch', () => {
    const song = createEmptySong('Sharp F')
    const track = createTrack('Melody', 'piano')
    track.gtVariant = 'sharp'
    const note = createNote(65, 0, 0.25)
    note.pitchLine = 4
    note.gtVariant = 'sharp'
    track.notes = [note]
    song.tracks = [track]
    const midi = new Midi(exportSongToMidi(song))
    expect(midi.tracks[0]?.notes[0]?.midi).toBe(66)
  })
})
