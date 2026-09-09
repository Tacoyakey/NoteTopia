import { describe, expect, it } from 'vitest'
import { getStudioMode, parseStudioMode, setStudioMode } from './studioMode'

describe('studioMode', () => {
  it('accepts simple and studio', () => {
    expect(parseStudioMode('simple')).toBe('simple')
    expect(parseStudioMode('studio')).toBe('studio')
  })

  it('rejects unknown values so intro can run', () => {
    expect(parseStudioMode(null)).toBeNull()
    expect(parseStudioMode('complete')).toBeNull()
    expect(parseStudioMode('')).toBeNull()
  })

  it('keeps the chosen mode in memory', () => {
    setStudioMode('simple')
    expect(getStudioMode()).toBe('simple')
    setStudioMode('studio')
    expect(getStudioMode()).toBe('studio')
  })
})
