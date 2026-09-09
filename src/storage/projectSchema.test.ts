import { describe, expect, it } from 'vitest'
import { importProjectFromJson } from './projects'
import { parseSong, parseWorldSettings } from './projectSchema'

describe('project JSON', () => {
  it('rejects invalid song payloads', () => {
    expect(() => parseSong(null)).toThrow(/Invalid song/)
    expect(() => parseSong({ name: 'Broken', tracks: [] })).toThrow(/no tracks/)
    expect(() => parseSong({ name: 'Broken', tracks: [{ notes: [1] }] })).toThrow(/Invalid note/)
  })

  it('rejects garbage and oversized JSON imports', () => {
    expect(() => importProjectFromJson('{')).toThrow(/Invalid JSON/)
    expect(() => importProjectFromJson('[]')).toThrow(/Invalid project/)
    expect(() => importProjectFromJson('{"song":null}')).toThrow(/Invalid song/)
  })

  it('parses a valid song and clamps BPM', () => {
    const song = parseSong({
      name: 'Clip',
      bpm: 999,
      tracks: [{ name: 'Lead', instrument: 'piano', notes: [{ pitch: 60, startBeat: 0, durationBeats: 1 }] }],
    })
    expect(song.bpm).toBe(300)
    expect(song.tracks[0]?.notes[0]?.pitch).toBe(60)
    expect(song.tracks[0]?.gtNumType).toBe(0)
    expect(song.tracks[0]?.notes[0]?.gtNumType).toBe(0)
  })

  it('falls back to defaults for unknown weather', () => {
    const settings = parseWorldSettings({ theme: 'not-a-weather', density: 40 })
    expect(settings.theme).toBe('sunny')
    expect(settings.density).toBe(40)
    expect(settings.autoCompress).toBe(false)
  })

  it('parses audio rack notes on a tile', () => {
    const song = parseSong({
      name: 'Rack',
      tracks: [
        {
          name: 'Audio Rack',
          instrument: 'piano',
          notes: [
            {
              pitch: 60,
              startBeat: 0,
              durationBeats: 0.25,
              gtNumType: 33,
              audioRack: { volume: 80, notes: 'PA# DB- BCb' },
            },
          ],
        },
      ],
    })
    expect(song.tracks[0]?.notes[0]?.audioRack).toEqual({ volume: 80, notes: 'PA# DB- BCb' })
  })
})
