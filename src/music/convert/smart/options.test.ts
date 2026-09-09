import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SMART_OPTIONS,
  mergeConvertPrefs,
  mergeSmartOptions,
  smartPresetValues,
  withPreset,
} from './options'

describe('Smart options', () => {
  it('fills defaults and ignores unknown keys', () => {
    const merged = mergeSmartOptions({ chordCap: 2, notAKnob: true, maxRackVoices: 99 })
    expect(merged.fitKey).toBe(true)
    expect(merged.preferLow).toBe(false)
    expect(merged.chordCap).toBe(2)
    expect(merged.maxRackVoices).toBe(5)
    expect(merged.packRacks).toBe(true)
    expect('notAKnob' in merged).toBe(false)
  })

  it('expands presets from balanced defaults', () => {
    const melody = smartPresetValues('melodyFirst')
    expect(melody.preset).toBe('melodyFirst')
    expect(melody.melodyIsolation).toBe(true)
    expect(melody.fitKey).toBe(true)
    const world = smartPresetValues('worldFit')
    expect(world.compress).toBe(true)
    expect(world.targetColumns).toBe(400)
  })

  it('keeps track overrides when applying a preset', () => {
    const current = {
      ...DEFAULT_SMART_OPTIONS,
      tracks: [{ trackId: 'a', include: false, role: 'lead' as const, octave: 0 as const }],
    }
    const next = withPreset(current, 'cleanSheet')
    expect(next.neverRacks).toBe(true)
    expect(next.tracks).toEqual(current.tracks)
  })

  it('loads v1 prefs without a smart blob', () => {
    const prefs = mergeConvertPrefs({ pickedId: 'v1', compress: true }, 'v1')
    expect(prefs.prefsVersion).toBe(2)
    expect(prefs.compress).toBe(true)
    expect(prefs.smart.fitKey).toBe(true)
    expect(prefs.pickedId).toBe('v1')
  })
})
