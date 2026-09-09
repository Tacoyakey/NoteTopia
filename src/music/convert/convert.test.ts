import { describe, expect, it } from 'vitest'
import { createEmptySong, createImportedNote, createNote, createTrack } from '../SongModel'
import { GT_REPEAT_BEGIN, GT_REPEAT_END, midiToLine } from '../gtPitch'
import { importGtmusicText } from '../gtmusicImport'
import { expandSheetPlayback, isRepeatNote, scheduleSheetNotes, sheetBeatFromWalk } from '../sheetRepeats'
import type { Note, Song, Track } from '../types'
import {
  DEFAULT_CONVERT_MODEL_ID,
  EXPERIMENTAL_CONVERT,
  EXPERIMENTAL_CONVERT_ID,
  bakeWithProgress,
  getConvertModel,
  isConvertUnlocked,
  listConvertModels,
} from './index'
import { sheetColumnCount } from './packSheet'
import { isAudioRackNote } from '../audioRack'

function rawNote(
  pitch: number,
  startBeat: number,
  extra: Partial<Note> = {},
): Note {
  return {
    id: `n-${pitch}-${startBeat}-${extra.velocity ?? 90}`,
    pitch,
    startBeat,
    durationBeats: 0.5,
    velocity: 90,
    ...extra,
  }
}

function songWith(tracks: Track[]): Song {
  const song = createEmptySong('Test')
  song.tracks = tracks
  return song
}

describe('convert registry', () => {
  it('defaults new projects to 1.0', () => {
    expect(DEFAULT_CONVERT_MODEL_ID).toBe('v1')
    expect(getConvertModel().id).toBe('v1')
    expect(getConvertModel('nope').id).toBe('v1')
  })

  it('keeps saved ids stable and maps old prefer-louder saves to Smart', () => {
    const ids = listConvertModels().map((model) => model.id)
    expect(ids).toEqual(['v1', 'v1.5-beta', EXPERIMENTAL_CONVERT_ID])
    expect(getConvertModel('v1').id).toBe('v1')
    expect(getConvertModel('v1.5-beta').id).toBe('v1.5-beta')
    expect(getConvertModel(EXPERIMENTAL_CONVERT_ID).id).toBe(EXPERIMENTAL_CONVERT_ID)
    expect(getConvertModel('v2').id).toBe(EXPERIMENTAL_CONVERT_ID)
    expect(getConvertModel('v2').tag).toBe('2.0')
  })

  it('lists Smart convert as recommended and unlocked', () => {
    const smart = getConvertModel(EXPERIMENTAL_CONVERT_ID)
    expect(smart.tag).toBe('2.0')
    expect(smart.recommended).toBe(true)
    expect(smart.experimental).toBeFalsy()
    expect(EXPERIMENTAL_CONVERT).toBe(true)
    expect(isConvertUnlocked(EXPERIMENTAL_CONVERT_ID)).toBe(true)
    expect(isConvertUnlocked('v1')).toBe(true)
    expect(getConvertModel('v1').recommended).toBeFalsy()
  })

  it('bakeWithProgress matches bake and reports rising ratios', async () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [0, 1, 2, 3].map((beat, i) => rawNote(60, beat, { id: `n${i}` }))
    const source = songWith([melody])
    const model = getConvertModel('v1')
    const sync = model.bake(source)
    const ratios: number[] = []
    const asyncResult = await bakeWithProgress(model, source, undefined, (progress) => {
      ratios.push(progress.ratio)
    })
    expect(asyncResult.stats.notesOut).toBe(sync.stats.notesOut)
    expect(scheduleSheetNotes(asyncResult.song).map((hit) => hit.note.pitch)).toEqual(
      scheduleSheetNotes(sync.song).map((hit) => hit.note.pitch),
    )
    expect(ratios[0]).toBeGreaterThan(0)
    expect(ratios[ratios.length - 1]).toBe(1)
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1])
    }
  })
})

describe('imported MIDI pitches', () => {
  it('createNote wraps into Growtopia range, createImportedNote does not', () => {
    expect(createNote(84, 0).pitch).toBeLessThanOrEqual(71)
    expect(createImportedNote(84, 0).pitch).toBe(84)
    expect(createImportedNote(36, 0).pitch).toBe(36)
  })
})

describe('v1 classic', () => {
  it('wraps each note independently so a rising line can jump down at C5', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [67, 69, 71, 72, 74].map((pitch, i) => rawNote(pitch, i * 0.25))
    const { song } = getConvertModel('v1').bake(songWith([melody]))
    const pitches = song.tracks[0].notes.map((note) => note.pitch)
    expect(pitches[2]).toBe(71)
    expect(pitches[3]).toBe(60)
  })

  it('lets the later track keep a crowded tile', () => {
    const a = createTrack('A', 'piano')
    const b = createTrack('B', 'bass')
    a.notes = [rawNote(60, 0, { id: 'a', velocity: 120 })]
    b.notes = [rawNote(60, 0, { id: 'b', velocity: 40 })]
    const baked = getConvertModel('v1').bake(songWith([a, b])).song
    expect(baked.tracks[0].notes).toHaveLength(0)
    expect(baked.tracks[1].notes).toHaveLength(1)
  })
})

describe('v1.5-beta contour', () => {
  it('shifts a rising phrase by octaves instead of wrapping the top notes down', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [67, 69, 71, 72, 74].map((pitch, i) => rawNote(pitch, i * 0.25))
    const { song } = getConvertModel('v1.5-beta').bake(songWith([melody]))
    const pitches = song.tracks[0].notes.map((note) => note.pitch)
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]).toBeGreaterThan(pitches[i - 1])
    }
    expect(Math.max(...pitches) - Math.min(...pitches)).toBe(74 - 67)
  })

  it('maps GM drums onto Growtopia drum lanes', () => {
    const drums = createTrack('Drums', 'drums')
    drums.notes = [
      rawNote(36, 0, { id: 'kick' }),
      rawNote(38, 0.5, { id: 'snare' }),
    ]
    const { song } = getConvertModel('v1.5-beta').bake(songWith([drums]))
    const byId = Object.fromEntries(song.tracks[0].notes.map((note) => [note.id, note]))
    expect(byId.kick.pitchLine).toBe(14)
    expect(byId.snare.pitchLine).toBe(11)
  })

  it('drops quiet ornaments', () => {
    const melody = createTrack('Melody', 'flute')
    melody.notes = [
      rawNote(72, 0, { id: 'keep', durationBeats: 0.5, velocity: 90 }),
      rawNote(74, 0.25, { id: 'drop', durationBeats: 0.05, velocity: 30 }),
    ]
    const { song, stats } = getConvertModel('v1.5-beta').bake(songWith([melody]))
    expect(song.tracks[0].notes.map((note) => note.id)).toEqual(['keep'])
    expect(stats.notesIn).toBe(2)
    expect(stats.notesOut).toBe(1)
  })

  it('thins a fat chord to four notes', () => {
    const harmony = createTrack('Harmony', 'guitar')
    harmony.notes = [48, 52, 55, 60, 64, 67].map((pitch, i) =>
      rawNote(pitch, 0, { id: `c${i}`, velocity: 70 + i }),
    )
    const { song } = getConvertModel('v1.5-beta').bake(songWith([harmony]))
    expect(song.tracks[0].notes.length).toBeLessThanOrEqual(4)
    const lines = song.tracks[0].notes.map((note) => note.pitchLine ?? midiToLine(note.pitch))
    expect(new Set(lines).size).toBe(lines.length)
  })

  it('lets lead keep a crowded tile over bass', () => {
    const lead = createTrack('Lead', 'flute')
    const bass = createTrack('Bass', 'bass')
    lead.notes = [rawNote(60, 0, { id: 'lead', velocity: 70, pitchLine: 7 })]
    bass.notes = [rawNote(60, 0, { id: 'bass', velocity: 120, pitchLine: 7 })]
    const occ = getConvertModel('v1.5-beta').occupant(songWith([lead, bass]), 0, 7)
    expect(occ?.noteId).toBe('lead')
  })

  it('moves bass and melody into different registers so they do not share a tile', () => {
    const lead = createTrack('Lead', 'flute')
    const bass = createTrack('Bass', 'bass')
    lead.notes = [rawNote(60, 0, { id: 'lead', velocity: 70 })]
    bass.notes = [rawNote(60, 0, { id: 'bass', velocity: 120 })]
    const baked = getConvertModel('v1.5-beta').bake(songWith([lead, bass])).song
    expect(baked.tracks[0].notes).toHaveLength(1)
    expect(baked.tracks[1].notes).toHaveLength(1)
    expect(baked.tracks[0].notes[0].pitch).not.toBe(baked.tracks[1].notes[0].pitch)
  })
})

function copiedPhraseSong(): Song {
  const melody = createTrack('Melody', 'piano')
  melody.notes = [
    rawNote(60, 0, { id: 'a1' }),
    rawNote(64, 1, { id: 'a2' }),
    rawNote(60, 2, { id: 'b1' }),
    rawNote(64, 3, { id: 'b2' }),
  ]
  return songWith([melody])
}

function soundingNotes(song: Song): Note[] {
  return song.tracks.flatMap((track) => track.notes.filter((note) => !isRepeatNote(note)))
}

function repeatNotes(song: Song): Note[] {
  return song.tracks.flatMap((track) => track.notes.filter((note) => isRepeatNote(note)))
}

describe('repeat begin/end', () => {
  it('collapses a copied phrase in v1 instead of leaving the sheet long', () => {
    const { song } = getConvertModel('v1').bake(copiedPhraseSong())
    expect(soundingNotes(song)).toHaveLength(2)
    const markers = repeatNotes(song)
    expect(markers.filter((note) => note.gtNumType === GT_REPEAT_BEGIN)).toHaveLength(1)
    expect(markers.filter((note) => note.gtNumType === GT_REPEAT_END)).toHaveLength(1)
    expect(markers[0].pitchLine).toBe(markers[1].pitchLine)
    expect(Math.max(...soundingNotes(song).map((note) => note.startBeat))).toBeLessThan(2)
  })

  it('collapses a copied phrase in v1.5', () => {
    const { song } = getConvertModel('v1.5-beta').bake(copiedPhraseSong())
    expect(soundingNotes(song)).toHaveLength(2)
    expect(repeatNotes(song)).toHaveLength(2)
  })

  it('walks the loop twice then ignores the used Repeat End', () => {
    const { song } = getConvertModel('v1').bake(copiedPhraseSong())
    const walk = expandSheetPlayback(song)
    expect(walk).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7])
    const hits = scheduleSheetNotes(song)
    const times = hits.map((hit) => hit.timeBeat)
    expect(times).toEqual([0, 1, 2, 3])
  })

  it('slides the playhead between adjacent walk columns', () => {
    const steps = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7]
    expect(sheetBeatFromWalk(steps, 0)).toBe(0)
    expect(sheetBeatFromWalk(steps, 0.125)).toBeCloseTo(0.125)
    expect(sheetBeatFromWalk(steps, 0.25)).toBe(0.25)
    // Repeat jump: stay on the last column of the loop until the next step.
    expect(sheetBeatFromWalk(steps, 1.875)).toBe(1.75)
    expect(sheetBeatFromWalk(steps, 2)).toBe(0)
  })

  it('loops each copied phrase when the song has two different parts back to back', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [
      rawNote(60, 0, { id: 'a1' }),
      rawNote(64, 1, { id: 'a2' }),
      rawNote(60, 2, { id: 'a3' }),
      rawNote(64, 3, { id: 'a4' }),
      rawNote(67, 4, { id: 'b1' }),
      rawNote(69, 5, { id: 'b2' }),
      rawNote(67, 6, { id: 'b3' }),
      rawNote(69, 7, { id: 'b4' }),
    ]
    const { song } = getConvertModel('v1').bake(songWith([melody]))
    expect(soundingNotes(song)).toHaveLength(4)
    expect(repeatNotes(song).filter((note) => note.gtNumType === GT_REPEAT_BEGIN)).toHaveLength(2)
    expect(Math.max(...soundingNotes(song).map((note) => note.startBeat))).toBeLessThan(4)
    const pitches = scheduleSheetNotes(song).map((hit) => hit.note.pitch)
    expect(pitches).toEqual([60, 64, 60, 64, 67, 69, 67, 69])
  })

  it('collapses three copies into one phrase with stacked repeats', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [0, 1, 2, 3, 4, 5].map((beat, i) =>
      rawNote(beat % 2 === 0 ? 60 : 64, beat, { id: `n${i}` }),
    )
    const { song } = getConvertModel('v1').bake(songWith([melody]))
    expect(soundingNotes(song)).toHaveLength(2)
    expect(repeatNotes(song).filter((note) => note.gtNumType === GT_REPEAT_BEGIN)).toHaveLength(2)
    const pitches = scheduleSheetNotes(song).map((hit) => hit.note.pitch)
    expect(pitches).toEqual([60, 64, 60, 64, 60, 64])
  })

  it('collapses a copied phrase that is not a whole number of beats', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [
      rawNote(60, 0, { id: 'a1' }),
      rawNote(64, 0.5, { id: 'a2' }),
      rawNote(60, 1.5, { id: 'b1' }),
      rawNote(64, 2, { id: 'b2' }),
    ]
    const { song } = getConvertModel('v1').bake(songWith([melody]), { compress: false })
    expect(soundingNotes(song)).toHaveLength(2)
    expect(repeatNotes(song).filter((note) => note.gtNumType === GT_REPEAT_BEGIN).length).toBeGreaterThanOrEqual(1)
    expect(Math.max(...soundingNotes(song).map((note) => note.startBeat))).toBeLessThan(1.5)
  })

  it('imports Repeat Begin/End from .gtmusic onto a Repeat track', () => {
    const { song } = importGtmusicText(
      ['%cernmusicsim;', 'bpm=100', 'rc-,PC-', 'PC-', 'PC-', 'PC-', 'PC-', 'PC-', 'PC-', 'Rc-'].join('\n'),
      'loop.gtmusic',
    )
    const markers = repeatNotes(song)
    expect(markers).toHaveLength(2)
    expect(song.tracks.some((track) => track.name === 'Repeat')).toBe(true)
    expect(expandSheetPlayback(song)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('accidental layers', () => {
  it('splits MIDI sharps onto a sharp sheet track in 1.0', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [rawNote(60, 0, { id: 'c' }), rawNote(61, 0.25, { id: 'cs' })]
    const { song } = getConvertModel('v1').bake(songWith([melody]))
    const natural = song.tracks.find((track) => (track.gtVariant ?? 'natural') === 'natural')
    const sharp = song.tracks.find((track) => track.gtVariant === 'sharp')
    expect(natural?.notes.map((note) => note.id)).toEqual(['c'])
    expect(sharp?.notes.map((note) => note.id)).toEqual(['cs'])
    expect(sharp?.gtNumType).toBe(2)
    expect(sharp?.notes[0].pitch).toBe(60)
    expect(sharp?.notes[0].gtVariant).toBe('sharp')
  })

  it('splits MIDI flats onto a flat sheet track in 1.0', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [rawNote(60, 0, { id: 'c' }), rawNote(70, 0.25, { id: 'bb' })]
    const { song } = getConvertModel('v1').bake(songWith([melody]))
    const flat = song.tracks.find((track) => track.gtVariant === 'flat')
    expect(flat?.notes.map((note) => note.id)).toEqual(['bb'])
    expect(flat?.gtNumType).toBe(1)
    expect(flat?.notes[0].pitch).toBe(71)
  })

  it('splits MIDI sharps in 1.5 too', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [rawNote(60, 0, { id: 'c' }), rawNote(61, 0.25, { id: 'cs' })]
    const { song } = getConvertModel('v1.5-beta').bake(songWith([melody]))
    expect(song.tracks.some((track) => track.gtVariant === 'sharp')).toBe(true)
    const sharp = song.tracks.find((track) => track.gtVariant === 'sharp')
    expect(sharp?.notes.some((note) => note.id === 'cs')).toBe(true)
    expect(sharp?.notes[0]?.gtVariant).toBe('sharp')
    expect(sharp?.notes[0]?.pitch).toBe(60)
  })
})

describe('1.5 audio racks', () => {
  it('packs two instruments on the same tile into an Audio Rack', () => {
    const a = createTrack('A', 'piano')
    const b = createTrack('B', 'flute')
    a.notes = [rawNote(60, 0, { id: 'piano', velocity: 90 })]
    b.notes = [rawNote(60, 0, { id: 'flute', velocity: 90 })]
    const { song, stats } = getConvertModel('v1.5-beta').bake(songWith([a, b]))
    const racks = song.tracks.flatMap((track) => track.notes.filter(isAudioRackNote))
    expect(racks.length).toBeGreaterThanOrEqual(1)
    expect(stats.racksCreated).toBeGreaterThanOrEqual(1)
    expect(racks[0]?.audioRack?.notes).toMatch(/P/)
    expect(racks[0]?.audioRack?.notes).toMatch(/F/)
  })

  it('keeps MIDI sharps as # inside a rack instead of flattening them', () => {
    const natural = createTrack('Natural', 'piano')
    const other = createTrack('Other', 'flute')
    natural.notes = [rawNote(60, 0, { id: 'c' })]
    other.notes = [rawNote(61, 0, { id: 'cs' })]
    const { song } = getConvertModel('v1.5-beta').bake(songWith([natural, other]))
    const rack = song.tracks.flatMap((track) => track.notes.filter(isAudioRackNote))[0]
    expect(rack?.audioRack?.notes).toContain('#')
    expect(rack?.audioRack?.notes).toMatch(/C#/)
  })

  it('does not create racks in simple 1.0 convert', () => {
    const a = createTrack('A', 'piano')
    const b = createTrack('B', 'bass')
    a.notes = [rawNote(60, 0, { id: 'a', velocity: 120 })]
    b.notes = [rawNote(60, 0, { id: 'b', velocity: 40 })]
    const { song } = getConvertModel('v1').bake(songWith([a, b]))
    expect(song.tracks.flatMap((track) => track.notes.filter(isAudioRackNote))).toHaveLength(0)
  })

  it('Smart convert packs overlaps into Audio Racks', () => {
    const a = createTrack('A', 'piano')
    const b = createTrack('B', 'flute')
    a.notes = [rawNote(60, 0, { id: 'piano', velocity: 90 })]
    b.notes = [rawNote(60, 0, { id: 'flute', velocity: 90 })]
    const { song, stats } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([a, b]))
    expect(song.tracks.flatMap((track) => track.notes.filter(isAudioRackNote)).length).toBeGreaterThanOrEqual(1)
    expect(stats.racksCreated).toBeGreaterThanOrEqual(1)
  })
})

describe('empty-gap loops', () => {
  it('compresses a long rest with stacked Repeat Begin/End in 1.5', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [rawNote(60, 0, { id: 'a' }), rawNote(64, 10, { id: 'b' })]
    const { song } = getConvertModel('v1.5-beta').bake(songWith([melody]))
    const lastBeat = Math.max(...soundingNotes(song).map((note) => note.startBeat))
    expect(lastBeat).toBeLessThan(6)
    const begins = repeatNotes(song).filter((note) => note.gtNumType === GT_REPEAT_BEGIN)
    const ends = repeatNotes(song).filter((note) => note.gtNumType === GT_REPEAT_END)
    expect(begins.length).toBeGreaterThanOrEqual(2)
    expect(begins.length).toBe(ends.length)
    expect(expandSheetPlayback(song).length).toBeGreaterThanOrEqual(36)
  })

  it('also loops slightly long pauses', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [rawNote(60, 0, { id: 'a' }), rawNote(64, 3, { id: 'b' })]
    const { song } = getConvertModel('v1').bake(songWith([melody]), { compress: false })
    const lastBeat = Math.max(...soundingNotes(song).map((note) => note.startBeat))
    expect(lastBeat).toBeLessThan(3)
    expect(repeatNotes(song).length).toBeGreaterThanOrEqual(2)
  })
})

describe('1.5 fit key', () => {
  it('transposes a low phrase into the staff without octave-wrapping notes', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [43, 45, 47, 48].map((pitch, i) => rawNote(pitch, i * 0.25))
    const { song, stats } = getConvertModel('v1.5-beta').bake(songWith([melody]), {
      compress: false,
      fitKey: true,
    })
    const pitches = soundingNotes(song)
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    expect(stats.keyShift).toBeGreaterThan(0)
    expect(stats.keyShift).toBeLessThan(12)
    expect(pitches).toHaveLength(4)
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i] - pitches[i - 1]).toBe([2, 2, 1][i - 1])
    }
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(48)
    expect(Math.max(...pitches)).toBeLessThanOrEqual(71)
  })

  it('does not transpose when Fit key is off', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [43, 45, 47, 48].map((pitch, i) => rawNote(pitch, i * 0.25))
    const { stats } = getConvertModel('v1.5-beta').bake(songWith([melody]), {
      compress: false,
      fitKey: false,
    })
    expect(stats.keyShift).toBeUndefined()
  })

  it('lowers a high melody when Lower is on', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [67, 69, 71].map((pitch, i) => rawNote(pitch, i * 0.25))
    const off = getConvertModel('v1.5-beta').bake(songWith([melody]), { compress: false })
    const on = getConvertModel('v1.5-beta').bake(songWith([melody]), {
      compress: false,
      preferLow: true,
    })
    const offPitches = soundingNotes(off.song)
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    const onPitches = soundingNotes(on.song)
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    expect(Math.max(...onPitches)).toBeLessThan(Math.max(...offPitches))
    expect(onPitches[1] - onPitches[0]).toBe(offPitches[1] - offPitches[0])
    expect(onPitches[2] - onPitches[1]).toBe(offPitches[2] - offPitches[1])
    expect(on.stats.keyShift).toBeLessThan(0)
  })
})

describe('long MIDI packing', () => {
  it('leaves short songs alone', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [0, 1, 2, 3].map((beat, i) => rawNote(60, beat, { id: `n${i}` }))
    const source = songWith([melody])
    source.bpm = 120
    const { song } = getConvertModel('v1').bake(source)
    expect(song.bpm).toBe(120)
    expect(sheetColumnCount(song)).toBeLessThan(20)
  })

  it('loops a long repeating riff instead of stretching the sheet', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = Array.from({ length: 250 }, (_, i) =>
      rawNote(60 + [0, 2, 4, 5, 7][i % 5], i * 0.5, { id: `n${i}` }),
    )
    const source = songWith([melody])
    source.bpm = 120
    const { song } = getConvertModel('v1').bake(source)
    expect(sheetColumnCount(song)).toBeLessThan(50)
    expect(song.bpm).toBe(120)
    expect(soundingNotes(song).length).toBeLessThanOrEqual(25)
    expect(scheduleSheetNotes(song)).toHaveLength(250)
  })

  it('loops a dense repeating 16th run with Repeat Begin/End', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = Array.from({ length: 480 }, (_, i) => rawNote(60 + (i % 3), i * 0.25, { id: `n${i}` }))
    const source = songWith([melody])
    source.bpm = 120
    const { song } = getConvertModel('v1').bake(source)
    expect(song.bpm).toBe(120)
    expect(sheetColumnCount(song)).toBeLessThan(80)
    expect(scheduleSheetNotes(song)).toHaveLength(480)
  })

  it('halves layout and BPM when a long through-composed sheet is over 400 blocks', () => {
    const melody = createTrack('Melody', 'piano')
    const seq: number[] = []
    const hasSquare = (arr: number[]) => {
      const n = arr.length
      for (let len = 1; 2 * len <= n; len++) {
        let square = true
        for (let k = 0; k < len; k++) {
          if (arr[n - 1 - k] !== arr[n - 1 - len - k]) {
            square = false
            break
          }
        }
        if (square) return true
      }
      return false
    }
    const need = 210
    const dfs = (): boolean => {
      if (seq.length >= need) return true
      for (const sym of [0, 1, 2]) {
        seq.push(sym)
        if (!hasSquare(seq) && dfs()) return true
        seq.pop()
      }
      return false
    }
    expect(dfs()).toBe(true)
    melody.notes = seq.map((sym, i) => rawNote(60 + [0, 4, 7][sym], i * 0.5, { id: `n${i}` }))
    const source = songWith([melody])
    source.bpm = 120
    const { song } = getConvertModel('v1').bake(source)
    expect(sheetColumnCount(song)).toBeLessThanOrEqual(400)
    expect(song.bpm).toBe(60)
    expect(soundingNotes(song).length).toBe(seq.length)
  })
})

describe('Smart 2.0', () => {
  it('maps old v2 saves onto Smart', () => {
    expect(getConvertModel('v2').id).toBe(EXPERIMENTAL_CONVERT_ID)
  })

  it('packs mixed-instrument overlaps into a quieter Audio Rack', () => {
    const a = createTrack('A', 'piano')
    const b = createTrack('B', 'flute')
    a.notes = [rawNote(60, 0, { id: 'piano', velocity: 90 })]
    b.notes = [rawNote(60, 0, { id: 'flute', velocity: 90 })]
    const { song, stats } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([a, b]))
    const racks = song.tracks.flatMap((track) => track.notes.filter(isAudioRackNote))
    expect(racks.length).toBeGreaterThanOrEqual(1)
    expect(stats.racksCreated).toBeGreaterThanOrEqual(1)
    expect(racks[0]?.audioRack?.volume).toBeLessThan(100)
  })

  it('collapses unison doubles on one track', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [
      rawNote(60, 0, { id: 'a', velocity: 80 }),
      rawNote(60, 0, { id: 'b', velocity: 110 }),
    ]
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([melody]), {
      smart: { unisonCollapse: true, packRacks: false, neverRacks: true },
    })
    expect(soundingNotes(song).filter((note) => !isAudioRackNote(note))).toHaveLength(1)
  })

  it('fits a low phrase into the staff', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [43, 45, 47, 48].map((pitch, i) => rawNote(pitch, i * 0.25))
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([melody]))
    const pitches = soundingNotes(song).map((note) => note.pitch)
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(48)
    expect(Math.max(...pitches)).toBeLessThanOrEqual(71)
  })

  it('maps a kick to the bottom drum lane', () => {
    const drums = createTrack('Drums', 'drums')
    drums.notes = [rawNote(36, 0, { id: 'kick' })]
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([drums]))
    expect(song.tracks[0].notes[0]?.pitchLine).toBe(14)
  })

  it('skips Audio Racks when neverRacks is on', () => {
    const a = createTrack('A', 'piano')
    const b = createTrack('B', 'flute')
    a.notes = [rawNote(60, 0, { id: 'piano', velocity: 90 })]
    b.notes = [rawNote(60, 0, { id: 'flute', velocity: 90 })]
    const { song, stats } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([a, b]), {
      smart: { neverRacks: true },
    })
    expect(song.tracks.flatMap((track) => track.notes.filter(isAudioRackNote))).toHaveLength(0)
    expect(stats.racksCreated ?? 0).toBe(0)
  })

  it('drops pads when melody isolation is on', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [72, 74, 76, 79].map((pitch, i) => rawNote(pitch, i * 0.5, { id: `l${i}` }))
    const pad = createTrack('Pad', 'piano')
    pad.notes = [48, 52, 55, 60].flatMap((pitch) =>
      [0, 2, 4, 6].map((beat) => rawNote(pitch, beat, { id: `p${pitch}-${beat}`, velocity: 70, durationBeats: 1.5 })),
    )
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([lead, pad]), {
      smart: { melodyIsolation: true },
    })
    expect(song.tracks.some((track) => track.instrument === 'flute')).toBe(true)
    const padNotes = song.tracks
      .filter((track) => track.instrument === 'piano')
      .flatMap((track) => track.notes.filter((note) => !isRepeatNote(note) && !isAudioRackNote(note)))
    expect(padNotes.length).toBe(0)
  })

  it('straightens swung offbeats onto the 16th grid', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = Array.from({ length: 16 }, (_, i) =>
      rawNote(60, i * 0.5 + (i % 2 === 1 ? 1 / 6 : 0), { id: `s${i}` }),
    )
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([melody]), {
      smart: { swing: 'straight', packRacks: false, neverRacks: true, mergeSameInstruments: false },
    })
    for (const note of soundingNotes(song)) {
      const col = Math.round(note.startBeat * 4)
      expect(Math.abs(note.startBeat * 4 - col)).toBeLessThan(1e-6)
    }
  })

  it('packs a long through-composed sheet to 400 columns when World fit is on', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = Array.from({ length: 500 }, (_, i) =>
      rawNote(60 + (i % 11), i * 0.5, { id: `n${i}` }),
    )
    const source = songWith([melody])
    source.bpm = 120
    const { song, stats } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(source, {
      smart: { compress: true, targetColumns: 400, mergeSameInstruments: false },
    })
    expect(sheetColumnCount(song)).toBeLessThanOrEqual(400)
    expect(stats.bpmOut ?? song.bpm).toBeLessThanOrEqual(120)
  }, 15000)

  it('spells F minor with flats when spelling follows the key', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [65, 68, 72, 70].map((pitch, i) => rawNote(pitch, i, { id: `f${i}` }))
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([melody]), {
      smart: { accidentalSpelling: 'key', splitAccidentals: true, packRacks: false, neverRacks: true },
    })
    const variants = song.tracks.map((track) => track.gtVariant)
    expect(variants).toContain('flat')
    expect(variants).not.toContain('sharp')
  })
})

describe('Smart arranger bake', () => {
  const smart = getConvertModel(EXPERIMENTAL_CONVERT_ID)
  const quiet = {
    skipFinish: true as const,
    smart: { packRacks: false, neverRacks: true, mergeSameInstruments: false },
  }

  it('preserves a rising melody that crosses C5 instead of folding the peak down', () => {
    const melody = createTrack('Melody', 'flute')
    const orig = [67, 69, 71, 72, 74, 72, 71, 69]
    melody.notes = orig.map((pitch, i) => rawNote(pitch, i * 0.25, { id: `m${i}` }))
    const { song, stats } = smart.bake(songWith([melody]), quiet)
    const pitches = soundingNotes(song)
      .filter((note) => !isAudioRackNote(note))
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    expect(pitches).toHaveLength(orig.length)
    expect(pitches.slice(1).map((p, i) => Math.sign(p - pitches[i]))).toEqual(
      orig.slice(1).map((p, i) => Math.sign(p - orig[i])),
    )
    expect(Math.max(...pitches)).toBeLessThanOrEqual(71)
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(48)
    expect(stats.melodicContourChanges ?? 0).toBe(0)
    expect(stats.arrangementScore).toBeTypeOf('number')
  })

  it('keeps bass lower than melody after a collision', () => {
    const lead = createTrack('Lead', 'flute')
    lead.notes = [rawNote(72, 0, { id: 'mel' })]
    const bass = createTrack('Bass', 'bass')
    bass.notes = [rawNote(36, 0, { id: 'bass' })]
    const { song } = smart.bake(songWith([lead, bass]), quiet)
    const mel = song.tracks.find((track) => track.instrument === 'flute')?.notes[0]?.pitch
    const low = song.tracks.find((track) => track.instrument === 'bass')?.notes[0]?.pitch
    expect(mel).toBeDefined()
    expect(low).toBeDefined()
    expect(low!).toBeLessThan(mel!)
  })

  it('thins a tall chord without deleting every chord tone', () => {
    const pad = createTrack('Pad', 'spooky')
    pad.notes = [60, 64, 67, 71, 74, 66].map((pitch, i) =>
      rawNote(pitch, 0, { id: `c${i}`, durationBeats: 1.5, velocity: 80 - i }),
    )
    const { song } = smart.bake(songWith([pad]), {
      ...quiet,
      smart: { ...quiet.smart, chordCap: 4, padThin: 'off' },
    })
    const pitches = soundingNotes(song).filter((note) => !isAudioRackNote(note)).map((note) => note.pitch)
    expect(pitches.length).toBeGreaterThan(0)
    expect(pitches.length).toBeLessThanOrEqual(4)
    const pcs = new Set(pitches.map((p) => ((p % 12) + 12) % 12))
    expect(pcs.has(0)).toBe(true)
  })

  it('repeats a motif with the same contour', () => {
    const melody = createTrack('Melody', 'flute')
    const motif = [60, 62, 64, 65]
    melody.notes = [0, 4, 8].flatMap((bar, r) =>
      motif.map((pitch, i) => rawNote(pitch, bar + i * 0.25, { id: `r${r}-${i}` })),
    )
    const { song, stats } = smart.bake(songWith([melody]), quiet)
    const pitches = soundingNotes(song)
      .filter((note) => !isAudioRackNote(note))
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    expect(pitches).toHaveLength(12)
    const signs = (xs: number[]) => xs.slice(1).map((p, i) => Math.sign(p - xs[i]))
    expect(signs(pitches.slice(4, 8))).toEqual(signs(pitches.slice(0, 4)))
    expect(signs(pitches.slice(8, 12))).toEqual(signs(pitches.slice(0, 4)))
    expect(stats.repeatedMotifsPreserved).toBeGreaterThanOrEqual(1)
  })

  it('keeps chromatic melody notes and syncopated timing', () => {
    const melody = createTrack('Melody', 'flute')
    melody.notes = [
      rawNote(60, 0, { id: 'a' }),
      rawNote(63, 0.75, { id: 'b' }),
      rawNote(64, 1.25, { id: 'c' }),
    ]
    const { song } = smart.bake(songWith([melody]), quiet)
    const notes = soundingNotes(song)
      .filter((note) => !isAudioRackNote(note))
      .sort((a, b) => a.startBeat - b.startBeat)
    expect(notes).toHaveLength(3)
    expect(notes.map((note) => note.startBeat)).toEqual([0, 0.75, 1.25])
    const contour = notes.slice(1).map((note, i) => Math.sign(note.pitch - notes[i].pitch))
    expect(contour.every((d) => d >= 0)).toBe(true)
  })

  it('maps drums, ignores empty extra tracks, and fits a one-note file', () => {
    const drums = createTrack('Drums', 'drums')
    drums.notes = [rawNote(36, 0, { id: 'kick' })]
    const empty = createTrack('Empty', 'piano')
    empty.notes = []
    const one = createTrack('One', 'flute')
    one.notes = [rawNote(60, 0, { id: 'only' })]
    const { song: drumSong } = smart.bake(songWith([drums]), quiet)
    expect(drumSong.tracks[0].notes[0]?.pitchLine).toBe(14)
    const { song: oneSong } = smart.bake(songWith([one]), quiet)
    expect(soundingNotes(oneSong).map((note) => note.pitch)).toEqual([60])
    const { stats } = smart.bake(songWith([empty]), quiet)
    expect(stats.notesOut).toBe(0)
  })

  it('stays inside the staff for notes on and just outside the edges', () => {
    const melody = createTrack('Melody', 'flute')
    melody.notes = [rawNote(48, 0, { id: 'lo' }), rawNote(71, 0.5, { id: 'hi' }), rawNote(72, 8, { id: 'over' })]
    const { song } = smart.bake(songWith([melody]), quiet)
    const notes = soundingNotes(song)
      .filter((note) => !isAudioRackNote(note))
      .sort((a, b) => a.startBeat - b.startBeat)
    const pitches = notes.map((note) => note.pitch)
    expect(pitches.every((p) => p >= 48 && p <= 71)).toBe(true)
    expect(notes[0]?.pitch).toBe(48)
    expect(notes[1]?.pitch).toBe(71)
  })

  it('keeps an in-range piano melody in the upper staff instead of dropping it an octave', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [60, 62, 64, 65, 67].map((pitch, i) => rawNote(pitch, i * 0.25, { id: `u${i}` }))
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([melody]), {
      skipFinish: true,
      smart: { packRacks: false, neverRacks: true, mergeSameInstruments: false, preferLow: false },
    })
    const pitches = soundingNotes(song)
      .filter((note) => !isAudioRackNote(note))
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((note) => note.pitch)
    expect(pitches).toEqual([60, 62, 64, 65, 67])
  })

  it('keeps a piano melody as piano when a sax track is also present', () => {
    const piano = createTrack('Piano', 'piano')
    piano.notes = [60, 62, 64, 65, 67, 69].map((pitch, i) => rawNote(pitch, i * 0.5, { id: `p${i}` }))
    const sax = createTrack('Sax', 'sax')
    sax.notes = [rawNote(72, 0, { id: 's0', durationBeats: 2, velocity: 70 })]
    const { song } = getConvertModel(EXPERIMENTAL_CONVERT_ID).bake(songWith([piano, sax]), {
      skipFinish: true,
      smart: { packRacks: false, neverRacks: true, mergeSameInstruments: false, melodyIsolation: true },
    })
    expect(song.tracks.some((track) => track.instrument === 'piano')).toBe(true)
    const pianoNotes = song.tracks
      .filter((track) => track.instrument === 'piano')
      .flatMap((track) => track.notes.filter((note) => !isRepeatNote(note) && !isAudioRackNote(note)))
    expect(pianoNotes.length).toBeGreaterThanOrEqual(6)
  })

  it('does not change Basic wrap-at-C5 or Preserve contour shift', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [67, 69, 71, 72, 74].map((pitch, i) => rawNote(pitch, i * 0.25, { id: `v${i}` }))
    const v1 = getConvertModel('v1').bake(songWith([melody]))
    const v15 = getConvertModel('v1.5-beta').bake(songWith([melody]))
    const v1Pitches = soundingNotes(v1.song).sort((a, b) => a.startBeat - b.startBeat).map((note) => note.pitch)
    expect(v1Pitches.some((pitch, i) => i > 0 && pitch < v1Pitches[i - 1])).toBe(true)
    const adv = soundingNotes(v15.song).sort((a, b) => a.startBeat - b.startBeat).map((note) => note.pitch)
    for (let i = 1; i < adv.length; i++) expect(adv[i]).toBeGreaterThan(adv[i - 1])
    expect(Math.max(...adv) - Math.min(...adv)).toBe(74 - 67)
  })
})

