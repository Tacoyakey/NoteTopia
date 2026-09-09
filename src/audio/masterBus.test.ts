import { describe, expect, it } from 'vitest'
import { clamp01, meterFromAmplitude } from './masterBus'

describe('meterFromAmplitude', () => {
  it('is silent at 0 and full at 1', () => {
    expect(meterFromAmplitude(0)).toBe(0)
    expect(meterFromAmplitude(1)).toBe(1)
  })

  it('puts a modest peak partway up the bar', () => {
    const mid = meterFromAmplitude(0.1)
    expect(mid).toBeGreaterThan(0.4)
    expect(mid).toBeLessThan(0.9)
  })
})

describe('clamp01', () => {
  it('clamps volume', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
  })
})
