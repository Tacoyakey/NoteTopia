import { describe, expect, it } from 'vitest'
import { createEmptySong } from '../music/SongModel'
import { getDefaultWorldSettings } from '../world/worldLayout'
import {
  decodeNotetopiaFile,
  encodeNotetopiaFile,
  looksLikeNotetopia,
  NOTETOPIA_FORMAT_VERSION,
  safeDownloadName,
} from './notetopiaFile'
import { importProjectFile, importProjectFromJson } from './projects'

describe('NoteTopia file', () => {
  it('round-trips a project that generic JSON parsers reject', () => {
    const song = createEmptySong('Harbor')
    song.bpm = 96
    const bytes = encodeNotetopiaFile({
      id: 'proj-1',
      name: 'Harbor',
      song,
      worldSettings: getDefaultWorldSettings(),
    })
    expect(looksLikeNotetopia(bytes)).toBe(true)
    expect(() => JSON.parse(new TextDecoder().decode(bytes))).toThrow()

    const loaded = decodeNotetopiaFile(bytes)
    expect(loaded.id).toBe('proj-1')
    expect(loaded.song.name).toBe('Harbor')
    expect(loaded.song.bpm).toBe(96)
    expect(loaded.song.tracks.length).toBeGreaterThan(0)
    expect(loaded.worldSettings.theme).toBe('sunny')
  })

  it('rejects garbage and newer format versions', () => {
    expect(() => decodeNotetopiaFile(new Uint8Array([1, 2, 3, 4]))).toThrow(/Not a NoteTopia file/)
    const song = createEmptySong('Clip')
    const bytes = encodeNotetopiaFile({
      name: 'Clip',
      song,
      worldSettings: getDefaultWorldSettings(),
    })
    bytes[4] = NOTETOPIA_FORMAT_VERSION + 1
    expect(() => decodeNotetopiaFile(bytes)).toThrow(/newer app/)
  })

  it('opens both NoteTopia files and legacy JSON exports', async () => {
    const song = createEmptySong('Dock')
    const native = encodeNotetopiaFile({
      name: 'Dock',
      song,
      worldSettings: getDefaultWorldSettings(),
    })
    const fromNative = await importProjectFile(
      new File([native], 'dock.notetopia', { type: 'application/x-notetopia' }),
    )
    expect(fromNative.song.name).toBe('Dock')

    const json = JSON.stringify({ song, worldSettings: getDefaultWorldSettings() })
    const fromJson = importProjectFromJson(json)
    expect(fromJson.song.name).toBe('Dock')
    const fromJsonFile = await importProjectFile(new File([json], 'dock.json', { type: 'application/json' }))
    expect(fromJsonFile.song.name).toBe('Dock')
  })

  it('sanitizes download names', () => {
    expect(safeDownloadName('My: Song?')).toBe('My Song')
    expect(safeDownloadName('   ')).toBe('Untitled')
  })
})
