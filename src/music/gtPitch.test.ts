import { describe, expect, it } from 'vitest'
import { getSampleFilename, GT_PITCH_LINE_LABELS, soundingMidi } from './gtPitch'

/** GTMusicSim createAudioStorCache tables, low-to-high c…B. */
const NORMAL = [1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24]
const FLAT = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23]
const SHARP = [2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 19, 21, 23, 25]

function lineForLowToHigh(k: number): number {
  return 14 - k
}

describe('getSampleFilename', () => {
  it('maps every piano lane to the GTMusicSim WAV index', () => {
    for (let k = 0; k < 14; k++) {
      const line = lineForLowToHigh(k)
      const label = GT_PITCH_LINE_LABELS[line - 1]
      expect(getSampleFilename('piano', 'natural', line), `${label} natural`).toBe(`piano_${NORMAL[k]}.wav`)
      expect(getSampleFilename('piano', 'flat', line), `${label} flat`).toBe(`piano_${FLAT[k]}.wav`)
      expect(getSampleFilename('piano', 'sharp', line), `${label} sharp`).toBe(`piano_${SHARP[k]}.wav`)
    }
  })

  it('plays F♯ from the F♯ sample, not G', () => {
    expect(getSampleFilename('piano', 'sharp', 11)).toBe('piano_7.wav')
    expect(getSampleFilename('piano', 'natural', 11)).toBe('piano_6.wav')
    expect(getSampleFilename('piano', 'natural', 10)).toBe('piano_8.wav')
    expect(getSampleFilename('piano', 'sharp', 4)).toBe('piano_19.wav')
    expect(getSampleFilename('piano', 'natural', 4)).toBe('piano_18.wav')
    expect(soundingMidi(11, 'sharp')).toBe(54)
    expect(soundingMidi(4, 'sharp')).toBe(66)
  })

  it('uses the same chromatic tables for every accidental instrument', () => {
    for (const stem of [
      'bass',
      'sax',
      'flute',
      'spanish_guitar',
      'violin',
      'lyre',
      'electric_guitar',
      'mexican_trumpet',
    ]) {
      expect(getSampleFilename(stem, 'sharp', 11)).toBe(`${stem}_7.wav`)
      expect(getSampleFilename(stem, 'flat', 11)).toBe(`${stem}_5.wav`)
    }
  })

  it('repeats the 7 drum hits across both octaves', () => {
    expect(getSampleFilename('drum', 'natural', 14)).toBe('drum_6.wav')
    expect(getSampleFilename('drum', 'natural', 8)).toBe('drum_0.wav')
    expect(getSampleFilename('drum', 'natural', 7)).toBe('drum_6.wav')
    expect(getSampleFilename('drum', 'natural', 1)).toBe('drum_0.wav')
  })

  it('keeps spooky and festive on the natural table', () => {
    expect(getSampleFilename('spooky', 'natural', 14, 'spooky')).toBe('spooky_1.wav')
    expect(getSampleFilename('festive', 'natural', 1, 'festive')).toBe('festive_24.wav')
  })
})
