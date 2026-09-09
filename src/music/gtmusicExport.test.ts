import { describe, expect, it } from 'vitest'
import { createEmptySong, createNoteFromTrack, createTrack } from './SongModel'
import { createAudioRackNote } from './audioRack'
import { importGmsfBuffer, importGtmusicText } from './gtmusicImport'
import { exportSongToGmsf, exportSongToGtmusic, exportSongToLuaTxt } from './gtmusicExport'
import {
  formatLegacyCell,
  gmsfNoteTypeToNumType,
  lineToMidi,
  numTypeToGmsfNoteType,
  numTypeToLegacyType,
  parseLegacyCell,
} from './gtPitch'
import { isAudioRackNote } from './audioRack'

describe('GMSF / GT Music maps', () => {
  it('inverts GMSF ids both ways, including trumpet', () => {
    for (let gmsfId = 1; gmsfId <= 34; gmsfId++) {
      if (gmsfId === 15) continue
      const numType = gmsfNoteTypeToNumType(gmsfId)
      expect(numType, `gmsf ${gmsfId}`).not.toBeNull()
      expect(numTypeToGmsfNoteType(numType!)).toBe(gmsfId)
    }
    expect(numTypeToGmsfNoteType(30)).toBe(32)
    expect(numTypeToGmsfNoteType(31)).toBe(34)
    expect(numTypeToGmsfNoteType(32)).toBe(33)
  })

  it('round-trips legacy cells', () => {
    for (let numType = 0; numType <= 32; numType++) {
      expect(numTypeToLegacyType(numType), `numType ${numType}`).toBeTruthy()
      const cell = formatLegacyCell(7, numType)
      expect(cell).toBeTruthy()
      expect(parseLegacyCell(cell!)).toEqual({ line: 7, numType })
    }
  })
})

describe('GMSF export', () => {
  it('writes piano on the top B row first, matching kixnoway', () => {
    const song = createEmptySong('Top')
    const piano = createTrack('Melody', 'piano')
    piano.notes = [createNoteFromTrack(piano, lineToMidi(1), 0)]
    song.tracks = [piano]
    song.bpm = 100
    const bytes = exportSongToGmsf(song)
    expect([...bytes.slice(0, 4)]).toEqual([0x47, 0x4d, 0x53, 0x46])
    expect(bytes[4]).toBe(1)
    expect(bytes[5]).toBe(15)
    expect(bytes[6] | (bytes[7] << 8)).toBe(100)
    expect(bytes[8] | (bytes[9] << 8)).toBe(1)
    expect(bytes[10] | (bytes[11] << 8)).toBe(14)
    expect(bytes[12]).toBe(1)
  })

  it('round-trips notes, BPM, and audio racks', () => {
    const song = createEmptySong('Round')
    const piano = createTrack('Melody', 'piano')
    const trumpet = createTrack('Brass', 'trumpet')
    piano.notes = [
      createNoteFromTrack(piano, 60, 0),
      createNoteFromTrack(piano, lineToMidi(1), 0.25),
    ]
    trumpet.notes = [createNoteFromTrack(trumpet, 64, 0.5)]
    const racks = createTrack('Racks', 'piano')
    racks.notes = [createAudioRackNote(1, 7, { volume: 80, notes: 'PC- PE- PG-' })]
    song.tracks = [piano, trumpet, racks]
    song.bpm = 140

    const { song: loaded, summary } = importGmsfBuffer(exportSongToGmsf(song).buffer)
    expect(loaded.bpm).toBe(140)
    expect(summary.noteCount).toBe(4)

    const pitches = loaded.tracks.flatMap((track) =>
      track.notes.filter((note) => !isAudioRackNote(note)).map((note) => note.pitchLine),
    )
    expect(pitches.sort()).toEqual([1, 5, 7].sort())

    const rack = loaded.tracks.flatMap((track) => track.notes).find(isAudioRackNote)
    expect(rack?.audioRack?.volume).toBe(80)
    expect(rack?.audioRack?.notes.replace(/\s+/g, '')).toBe('PC-PE-PG-')
    expect(rack?.pitchLine).toBe(7)

    const trumpetNote = loaded.tracks
      .flatMap((track) => track.notes)
      .find((note) => note.gtNumType === 30)
    expect(trumpetNote).toBeTruthy()
  })

  it('round-trips .gtmusic text used by GT Text → GMSF', () => {
    const song = createEmptySong('Text')
    const piano = createTrack('Melody', 'piano')
    piano.notes = [createNoteFromTrack(piano, 60, 0), createNoteFromTrack(piano, 64, 0.25)]
    song.tracks = [piano]
    song.bpm = 96
    const text = exportSongToGtmusic(song)
    expect(text.startsWith('%cernmusicsim;')).toBe(true)
    const { song: loaded } = importGtmusicText(text)
    expect(loaded.bpm).toBe(96)
    expect(loaded.tracks.flatMap((track) => track.notes).map((note) => note.pitch).sort()).toEqual([60, 64])
  })

  it('pads GMSF to minColumns', () => {
    const song = createEmptySong('Pad')
    const piano = createTrack('Melody', 'piano')
    piano.notes = [createNoteFromTrack(piano, 60, 0)]
    song.tracks = [piano]
    const bytes = exportSongToGmsf(song, undefined, 32)
    expect(bytes[8] | (bytes[9] << 8)).toBe(32)
  })

  it('writes kixnoway META/FSMG and round-trips song name plus high BPM', () => {
    const song = createEmptySong('Harbor Night')
    const piano = createTrack('Melody', 'piano')
    piano.notes = [createNoteFromTrack(piano, 60, 0)]
    song.tracks = [piano]
    song.bpm = 280
    const bytes = exportSongToGmsf(song)
    const text = new TextDecoder().decode(bytes.subarray(bytes.length - 4))
    expect(text).toBe('FSMG')
    const { song: loaded } = importGmsfBuffer(bytes.buffer)
    expect(loaded.bpm).toBe(280)
    expect(loaded.name).toBe('Harbor Night')
  })

  it('writes a Lua TXT blueprint with cells', () => {
    const song = createEmptySong('Lua')
    const piano = createTrack('Melody', 'piano')
    piano.notes = [createNoteFromTrack(piano, 60, 0)]
    song.tracks = [piano]
    const lua = exportSongToLuaTxt(song)
    expect(lua).toContain('return {')
    expect(lua).toContain('column = 0')
    expect(lua).toContain('cell =')
  })
})
