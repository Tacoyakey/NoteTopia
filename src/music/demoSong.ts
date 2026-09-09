import type { Note, Song, Track } from './types'
import { createEmptySong, createNoteFromTrack, createTrack } from './SongModel'
import { lineToMidi } from './gtPitch'

function tile(track: Track, line: number, beat: number, velocity = 90): Note {
  const note = createNoteFromTrack(track, lineToMidi(line), beat, 0.25, velocity)
  note.pitchLine = line
  return note
}

/** Original 4-bar chorus loop — stacked 16th tiles like a Growtopia music world. */
export function createDemoSong(): Song {
  const song = createEmptySong('Night Chorus')
  song.bpm = 104

  const melody = createTrack('Melody', 'piano')
  const harmony = createTrack('Harmony', 'violin')
  const bass = createTrack('Bass', 'bass')
  const guitar = createTrack('Guitar', 'guitar')
  const sax = createTrack('Sax', 'sax')
  const drums = createTrack('Drums', 'drums')

  const melodyHook = [
    [7, 7, 5, 3, 3, 5, 6, 7],
    [6, 6, 5, 3, 1, 2, 3, 5],
    [9, 9, 7, 5, 5, 6, 7, 9],
    [11, 11, 9, 7, 3, 5, 6, 7],
  ]
  const bassRoots = [14, 10, 9, 11]
  const chordStacks = [
    [7, 5, 3],
    [10, 8, 6],
    [9, 7, 5],
    [11, 9, 7],
  ]

  for (let bar = 0; bar < 4; bar++) {
    const barBeat = bar * 4
    const dense = bar >= 2
    for (let step = 0; step < 16; step++) {
      const beat = barBeat + step * 0.25
      const onBeat = step % 4 === 0
      const onEighth = step % 2 === 0

      melody.notes.push(tile(melody, melodyHook[bar][step % 8], beat, 92))

      if (dense || onEighth) {
        for (const line of chordStacks[bar]) {
          harmony.notes.push(tile(harmony, line, beat, dense ? 68 : 58))
        }
      }

      if (onEighth) {
        bass.notes.push(tile(bass, bassRoots[bar], beat, onBeat ? 110 : 88))
        guitar.notes.push(tile(guitar, chordStacks[bar][step % 3], beat, 75))
      }

      if (dense && (step === 6 || step === 10 || step === 14)) {
        const saxLine = Math.max(1, melodyHook[bar][step % 8] - 1)
        sax.notes.push(tile(sax, saxLine, beat, 86))
      }

      drums.notes.push(tile(drums, 8, beat, 64))
      if (step % 8 === 0) drums.notes.push(tile(drums, 14, beat, 120))
      if (step % 8 === 4) drums.notes.push(tile(drums, 12, beat, 108))
      if (dense && step % 4 === 2) drums.notes.push(tile(drums, 10, beat, 80))
    }
  }

  song.tracks = [melody, harmony, bass, guitar, sax, drums]
  return song
}
