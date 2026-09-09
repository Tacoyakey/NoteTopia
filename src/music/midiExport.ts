import { Midi } from '@tonejs/midi'
import type { Song } from './types'
import { beatsToSeconds } from './timing'
import { isRepeatNote } from './sheetRepeats'
import { GT_BLANK, soundingMidiForNote } from './gtPitch'
import { expandAudioRack, isAudioRackNote } from './audioRack'

const INSTRUMENT_PROGRAM: Record<string, number> = {
  piano: 0,
  bass: 32,
  guitar: 24,
  'electric-guitar': 27,
  violin: 40,
  lyre: 46,
  trumpet: 56,
  sax: 66,
  flute: 73,
  synth: 80,
  spooky: 90,
  winterfest: 14,
  bell: 112,
  drums: 128,
}

export function exportSongToMidi(song: Song): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(song.bpm)
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [song.timeSignature.numerator, song.timeSignature.denominator],
    measures: 0,
  })

  for (const track of song.tracks) {
    const midiTrack = midi.addTrack()
    midiTrack.name = track.name

    if (track.instrument === 'drums') {
      midiTrack.channel = 9
    } else {
      midiTrack.instrument.number = INSTRUMENT_PROGRAM[track.instrument] ?? 0
    }

    for (const note of track.notes) {
      if (isRepeatNote(note) || note.gtNumType === GT_BLANK) continue
      if (isAudioRackNote(note)) {
        for (const slot of expandAudioRack(track, note)) {
          midiTrack.addNote({
            midi: slot.note.pitch,
            time: beatsToSeconds(note.startBeat, song.bpm),
            duration: Math.max(0.02, beatsToSeconds(slot.note.durationBeats, song.bpm)),
            velocity: Math.max(0, Math.min(1, slot.note.velocity / 127)),
          })
        }
        continue
      }
      midiTrack.addNote({
        midi: soundingMidiForNote(note, track),
        time: beatsToSeconds(note.startBeat, song.bpm),
        duration: Math.max(0.02, beatsToSeconds(note.durationBeats, song.bpm)),
        velocity: Math.max(0, Math.min(1, note.velocity / 127)),
      })
    }
  }

  return midi.toArray()
}

export function downloadMidi(song: Song, filename?: string): void {
  const data = exportSongToMidi(song)
  const blob = new Blob([new Uint8Array(data)], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename ?? song.name}.mid`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadProjectJson(song: Song, worldSettings: unknown): void {
  const data = JSON.stringify({ song, worldSettings }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${song.name}.json`
  a.click()
  URL.revokeObjectURL(url)
}
