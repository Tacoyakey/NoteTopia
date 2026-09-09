import { describe, expect, it } from 'vitest'
import { mapGmProgram } from './gmMap'

describe('GM map', () => {
  it('maps string ensemble (48) to piano so it does not steal the melody', () => {
    expect(mapGmProgram(48, false)).toBe('piano')
  })

  it('maps channel 9 to drums', () => {
    expect(mapGmProgram(0, true)).toBe('drums')
  })

  it('maps pads to spooky when asked', () => {
    expect(mapGmProgram(88, false, { padInstrument: 'spooky' })).toBe('spooky')
    expect(mapGmProgram(88, false)).toBe('piano')
  })

  it('maps acoustic guitar and overdrive separately', () => {
    expect(mapGmProgram(24, false)).toBe('guitar')
    expect(mapGmProgram(30, false)).toBe('electric-guitar')
  })

  it('maps clarinet and choirs to piano, actual sax to sax', () => {
    expect(mapGmProgram(71, false)).toBe('piano')
    expect(mapGmProgram(52, false)).toBe('piano')
    expect(mapGmProgram(65, false)).toBe('sax')
    expect(mapGmProgram(68, false)).toBe('flute')
  })
})
