import { Midi } from '@tonejs/midi'
import { v4 as uuidv4 } from 'uuid'
import type { Song, Track, MidiImportSummary } from './types'
import { createEmptySong, createImportedNote } from './SongModel'
import { getSongDurationBeats } from './timing'
import { gtFieldsForInstrument } from './gtPitch'
import { assertFileSize, MAX_IMPORT_BYTES } from '../storage/projectSchema'
import { mapGmProgram } from './convert/smart/gmMap'

function mapInstrument(program: number, isPercussion: boolean) {
  return mapGmProgram(program, isPercussion)
}

export async function importMidiFile(file: File): Promise<{
  song: Song
  summary: MidiImportSummary
}> {
  assertFileSize(file, MAX_IMPORT_BYTES)
  const buffer = await file.arrayBuffer()
  const midi = new Midi(buffer)

  const bpm = midi.header.tempos[0]?.bpm ?? 120
  const timeSignature = midi.header.timeSignatures[0]
    ? {
        numerator: midi.header.timeSignatures[0].timeSignature[0],
        denominator: midi.header.timeSignatures[0].timeSignature[1],
      }
    : { numerator: 4, denominator: 4 }

  const ppq = midi.header.ppq
  const song = createEmptySong(file.name.replace(/\.(mid|midi)$/i, ''))
  song.bpm = Math.round(bpm)
  song.timeSignature = timeSignature
  song.tracks = []

  let noteCount = 0

  for (let i = 0; i < midi.tracks.length; i++) {
    const midiTrack = midi.tracks[i]
    if (midiTrack.notes.length === 0) continue

    const isPercussion = midiTrack.channel === 9
    const instrument = mapInstrument(midiTrack.instrument.number, isPercussion)

    const track: Track = {
      id: uuidv4(),
      name: midiTrack.name || `Track ${i + 1}`,
      instrument,
      gmProgram: isPercussion ? undefined : midiTrack.instrument.number,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      ...gtFieldsForInstrument(instrument),
      notes: midiTrack.notes.map((n) => {
        noteCount++
        const startBeat = n.ticks / ppq
        const durationBeats = n.durationTicks / ppq
        return createImportedNote(
          n.midi,
          startBeat,
          durationBeats,
          Math.round(n.velocity * 127),
        )
      }),
    }

    song.tracks.push(track)
  }

  if (song.tracks.length === 0) {
    song.tracks.push({
      id: uuidv4(),
      name: 'Imported',
      instrument: 'piano',
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      ...gtFieldsForInstrument('piano'),
      notes: [],
    })
  }

  const durationBeats = getSongDurationBeats(song)

  return {
    song,
    summary: {
      trackCount: song.tracks.length,
      noteCount,
      bpm: song.bpm,
      durationBeats,
      tempoChanges: Math.max(1, midi.header.tempos.length),
    },
  }
}

export async function importMidiFromBuffer(buffer: ArrayBuffer): Promise<Song> {
  const file = new File([buffer], 'import.mid')
  const { song } = await importMidiFile(file)
  return song
}
