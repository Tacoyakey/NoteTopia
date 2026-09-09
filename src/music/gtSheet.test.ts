import { describe, expect, it } from 'vitest'
import { createEmptySong, createNoteFromTrack, createTrack } from './SongModel'
import { createAudioRackNote } from './audioRack'
import { GT_AUDIO_RACK } from './gtPitch'
import { listSheetMaterials, noteMaterialType, countSharedSheetCells } from './gtSheet'

describe('listSheetMaterials', () => {
  it('counts unique cells by sheet-music type', () => {
    const song = createEmptySong('Build')
    const piano = createTrack('Melody', 'piano')
    piano.notes = [
      createNoteFromTrack(piano, 60, 0),
      createNoteFromTrack(piano, 64, 0),
      createNoteFromTrack(piano, 60, 0.25),
    ]
    song.tracks = [piano]
    const list = listSheetMaterials(song)
    expect(list.total).toBe(3)
    expect(list.columns).toBe(2)
    expect(list.items).toEqual([{ numType: 0, count: 3 }])
  })

  it('counts an Audio Rack as one block', () => {
    const song = createEmptySong('Racks')
    const rack = createTrack('Racks', 'piano')
    rack.notes = [createAudioRackNote(0, 7, { notes: 'PC- PE- PG-' })]
    song.tracks = [rack]
    const list = listSheetMaterials(song)
    expect(list.total).toBe(1)
    expect(list.items[0]).toEqual({ numType: GT_AUDIO_RACK, count: 1 })
  })

  it('counts one tile when two instruments share a cell', () => {
    const song = createEmptySong('Stack')
    const piano = createTrack('Melody', 'piano')
    const bass = createTrack('Bass', 'bass')
    piano.notes = [createNoteFromTrack(piano, 60, 0)]
    bass.notes = [createNoteFromTrack(bass, 60, 0)]
    song.tracks = [piano, bass]
    const list = listSheetMaterials(song)
    expect(list.total).toBe(1)
  })

  it('counts extra notes that share a cell without baking a convert', () => {
    const song = createEmptySong('Stack')
    const piano = createTrack('Melody', 'piano')
    const bass = createTrack('Bass', 'bass')
    piano.notes = [createNoteFromTrack(piano, 60, 0)]
    bass.notes = [createNoteFromTrack(bass, 60, 0)]
    song.tracks = [piano, bass]
    expect(countSharedSheetCells(song)).toBe(1)
  })

  it('tags Audio Rack notes separately from the track instrument', () => {
    const rack = createTrack('Racks', 'piano')
    const note = createAudioRackNote(0, 7, { notes: 'PC- PE-' })
    expect(noteMaterialType(rack, note)).toBe(GT_AUDIO_RACK)
    expect(noteMaterialType(rack, createNoteFromTrack(rack, 60, 0))).toBe(0)
  })
})
