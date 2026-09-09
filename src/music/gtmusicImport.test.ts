import { describe, expect, it } from 'vitest'
import { importGmsfBuffer, importGtmusicText } from './gtmusicImport'
import { encodeGmsfV1 } from './gmsfFormat'

describe('Growtopia import', () => {
  it('falls back to 120 BPM when the header value is not a number', () => {
    const { song, summary } = importGtmusicText('%cernmusicsim;\nbpm=nope\n')
    expect(song.bpm).toBe(120)
    expect(summary.bpm).toBe(120)
  })

  it('skips blank lines after the magic header', () => {
    const { song } = importGtmusicText('%cernmusicsim;\n\nbpm=140\n')
    expect(song.bpm).toBe(140)
  })

  it('rejects truncated GMSF payloads', () => {
    const buffer = new ArrayBuffer(12)
    const view = new DataView(buffer)
    view.setUint8(0, 0x47)
    view.setUint8(1, 0x4d)
    view.setUint8(2, 0x53)
    view.setUint8(3, 0x46)
    view.setUint8(4, 1)
    view.setUint8(5, 15)
    view.setUint16(6, 100, true)
    view.setUint16(8, 10, true)
    view.setUint16(10, 14, true)
    expect(() => importGmsfBuffer(buffer)).toThrow(/Truncated/)
  })

  it('rejects oversized GMSF row lengths', () => {
    const buffer = new ArrayBuffer(12)
    const view = new DataView(buffer)
    view.setUint8(0, 0x47)
    view.setUint8(1, 0x4d)
    view.setUint8(2, 0x53)
    view.setUint8(3, 0x46)
    view.setUint8(4, 1)
    view.setUint8(5, 15)
    view.setUint16(8, 20_000, true)
    view.setUint16(10, 14, true)
    expect(() => importGmsfBuffer(buffer)).toThrow(/too large/)
  })

  it('reads kixnoway v1 files with uint16 BPM and metadata', () => {
    const grid = Array.from({ length: 14 }, () => Array(2).fill(0))
    grid[0][0] = 1
    const bytes = encodeGmsfV1({
      bpm: 280,
      width: 2,
      height: 14,
      grid,
      metadata: 'Dock\nby test',
    })
    const { song, summary } = importGmsfBuffer(bytes.buffer)
    expect(song.bpm).toBe(280)
    expect(song.name).toBe('Dock')
    expect(summary.columns).toBe(2)
    expect(song.tracks.some((track) => track.notes.length > 0)).toBe(true)
  })
})
