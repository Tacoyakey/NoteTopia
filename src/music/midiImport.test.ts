import { Midi } from '@tonejs/midi'
import { describe, expect, it } from 'vitest'
import { importMidiFile } from './midiImport'
import { getConvertModel } from './convert'

function midiFile(build: (midi: Midi) => void): File {
  const midi = new Midi()
  midi.header.setTempo(110)
  build(midi)
  return new File([new Uint8Array(midi.toArray())], 'clip.mid', { type: 'audio/midi' })
}

describe('MIDI import', () => {
  it('keeps original pitches so convert methods can fold octaves', async () => {
    const file = midiFile((midi) => {
      const lead = midi.addTrack()
      lead.channel = 0
      lead.addNote({ midi: 84, ticks: 0, durationTicks: midi.header.ppq / 2, velocity: 0.8 })
      const drums = midi.addTrack()
      drums.channel = 9
      drums.addNote({ midi: 36, ticks: 0, durationTicks: midi.header.ppq / 4, velocity: 0.9 })
    })

    const { song, summary } = await importMidiFile(file)
    expect(summary.noteCount).toBe(2)
    expect(song.tracks.some((track) => track.notes.some((note) => note.pitch === 84))).toBe(true)
    expect(song.tracks.some((track) => track.instrument === 'drums' && track.notes[0]?.pitch === 36)).toBe(
      true,
    )

    const baked = getConvertModel('v1.5-beta').bake(song).song
    const drum = baked.tracks.find((track) => track.instrument === 'drums')
    expect(drum?.notes[0]?.pitchLine).toBe(14)
    const leadPitch = baked.tracks.find((track) => track.instrument !== 'drums')?.notes[0]?.pitch
    expect(leadPitch).toBeGreaterThanOrEqual(48)
    expect(leadPitch).toBeLessThanOrEqual(71)
  })

  it('maps GM program 48 (string ensemble) to piano so pads do not steal violin', async () => {
    const file = midiFile((midi) => {
      const strings = midi.addTrack()
      strings.channel = 0
      strings.instrument.number = 48
      strings.addNote({ midi: 67, ticks: 0, durationTicks: midi.header.ppq, velocity: 0.7 })
    })
    const { song, summary } = await importMidiFile(file)
    expect(song.tracks[0]?.instrument).toBe('piano')
    expect(song.tracks[0]?.gmProgram).toBe(48)
    expect(summary.tempoChanges).toBeGreaterThanOrEqual(1)
  })

  it('maps GM program 40 (violin) to violin', async () => {
    const file = midiFile((midi) => {
      const violin = midi.addTrack()
      violin.channel = 0
      violin.instrument.number = 40
      violin.addNote({ midi: 67, ticks: 0, durationTicks: midi.header.ppq, velocity: 0.7 })
    })
    const { song } = await importMidiFile(file)
    expect(song.tracks[0]?.instrument).toBe('violin')
    expect(song.tracks[0]?.gmProgram).toBe(40)
  })
})
