import { describe, expect, it } from 'vitest'
import { AUDIO_RACK_TRACK_NAME, isAudioRackNote } from './audioRack'
import { getConvertModel } from './convert'
import { createEmptySong, createImportedNote, createTrack } from './SongModel'
import {
  appendConvertedLayers,
  assignInstrumentLayer,
  convertMidiLayer,
  defaultLayerInstrument,
  layerAccidentalKinds,
  uniqueLayerName,
} from './midiLayers'
import type { Note, Song, Track } from './types'

function rawNote(pitch: number, startBeat: number, extra: Partial<Note> = {}): Note {
  return {
    id: `n-${pitch}-${startBeat}`,
    pitch,
    startBeat,
    durationBeats: 0.5,
    velocity: 90,
    ...extra,
  }
}

function songWith(tracks: Track[], name = 'clip.mid'): Song {
  const song = createEmptySong(name)
  song.tracks = tracks
  return song
}

describe('MIDI layers', () => {
  it('picks the busiest non-drum instrument as the default', () => {
    const piano = createTrack('Lead', 'piano')
    piano.notes = [rawNote(60, 0), rawNote(64, 1)]
    const drums = createTrack('Drums', 'drums')
    drums.notes = [rawNote(36, 0), rawNote(38, 0.5), rawNote(42, 1)]
    const flute = createTrack('Air', 'flute')
    flute.notes = [rawNote(72, 0)]
    expect(defaultLayerInstrument(songWith([drums, piano, flute]))).toBe('piano')
  })

  it('merges MIDI tracks onto one main instrument without sharp/flat variants', () => {
    const a = createTrack('A', 'violin')
    a.notes = [createImportedNote(61, 0, 0.25, 80)]
    const b = createTrack('B', 'drums')
    b.notes = [createImportedNote(36, 0, 0.25, 90)]
    const layered = assignInstrumentLayer(songWith([a, b], 'solo.mid'), 'flute', 'solo', { skipDrums: true })
    expect(layered.tracks).toHaveLength(1)
    expect(layered.tracks[0]?.instrument).toBe('flute')
    expect(layered.tracks[0]?.gtVariant).toBe('natural')
    expect(layered.tracks[0]?.notes).toHaveLength(1)
    expect(layered.tracks[0]?.notes[0]?.pitch).toBe(61)
    expect(layered.tracks[0]?.notes[0]?.gtVariant).toBeUndefined()
  })

  it('flags sharps and flats before convert, unless the instrument has no accidentals', () => {
    const melody = createTrack('Melody', 'piano')
    melody.notes = [rawNote(60, 0), rawNote(61, 0.25), rawNote(70, 0.5)]
    const song = songWith([melody])
    expect(layerAccidentalKinds(song, 'piano')).toEqual({ sharps: true, flats: true })
    expect(layerAccidentalKinds(song, 'drums')).toEqual({ sharps: false, flats: false })
  })

  it('converts a file onto the chosen instrument and splits accidentals onto extra layers', () => {
    const melody = createTrack('Melody', 'violin')
    melody.notes = [rawNote(60, 0, { id: 'c' }), rawNote(61, 0.25, { id: 'cs' })]
    const { song } = convertMidiLayer(
      songWith([melody], 'lead.mid'),
      'flute',
      'Lead',
      getConvertModel('v1'),
    )
    const natural = song.tracks.find((track) => (track.gtVariant ?? 'natural') === 'natural')
    const sharp = song.tracks.find((track) => track.gtVariant === 'sharp')
    expect(natural?.instrument).toBe('flute')
    expect(sharp?.instrument).toBe('flute')
    expect(natural?.gtVariant).toBe('natural')
    expect(sharp?.gtVariant).toBe('sharp')
    expect(natural?.notes.map((note) => note.id)).toEqual(['c'])
    expect(sharp?.notes.map((note) => note.id)).toEqual(['cs'])
    expect(song.tracks.some((track) => track.gtVariant === 'flat')).toBe(false)
  })

  it('does not invent accidental layers for drums', () => {
    const melody = createTrack('Hits', 'piano')
    melody.notes = [rawNote(60, 0), rawNote(61, 0.25)]
    const { song } = convertMidiLayer(songWith([melody]), 'drums', 'Hits', getConvertModel('v1'))
    expect(song.tracks).toHaveLength(1)
    expect(song.tracks[0]?.instrument).toBe('drums')
    expect(song.tracks[0]?.gtVariant).toBe('natural')
  })

  it('appends converted tracks onto the current song and folds Audio Rack hosts', () => {
    const host = createEmptySong('World')
    const rack = createTrack(AUDIO_RACK_TRACK_NAME, 'piano')
    rack.gtNumType = 33
    rack.notes = [
      {
        id: 'old-rack',
        pitch: 60,
        startBeat: 0,
        durationBeats: 0.25,
        velocity: 100,
        gtNumType: 33,
        audioRack: { volume: 100, notes: 'P-C5' },
      },
    ]
    host.tracks = [createTrack('Melody', 'piano'), rack]

    const incoming = createTrack(AUDIO_RACK_TRACK_NAME, 'piano')
    incoming.notes = [
      {
        id: 'new-rack',
        pitch: 64,
        startBeat: 1,
        durationBeats: 0.25,
        velocity: 100,
        gtNumType: 33,
        audioRack: { volume: 80, notes: 'F-E5' },
      },
    ]
    const flute = createTrack('Solo', 'flute')
    flute.notes = [rawNote(67, 0)]

    const next = appendConvertedLayers(host, [flute, incoming])
    expect(next.tracks.filter((track) => track.name === AUDIO_RACK_TRACK_NAME)).toHaveLength(1)
    expect(next.tracks.some((track) => track.name === 'Solo')).toBe(true)
    const merged = next.tracks.find((track) => track.name === AUDIO_RACK_TRACK_NAME)
    expect(merged?.notes.some(isAudioRackNote)).toBe(true)
    expect(merged?.notes.map((note) => note.id)).toEqual(['old-rack', 'new-rack'])
  })

  it('makes unique layer names', () => {
    expect(uniqueLayerName(['Lead'], 'Lead')).toBe('Lead 2')
    expect(uniqueLayerName(['Lead', 'Lead 2'], 'Lead')).toBe('Lead 3')
    expect(uniqueLayerName(['Lead'], 'Solo')).toBe('Solo')
  })
})
