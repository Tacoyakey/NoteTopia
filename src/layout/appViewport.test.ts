import { describe, expect, it } from 'vitest'
import { applyAppViewportHeight, visibleViewportHeight } from './appViewport'

describe('visibleViewportHeight', () => {
  it('prefers visualViewport when it is smaller than innerHeight', () => {
    expect(visibleViewportHeight({ innerHeight: 844, visualViewport: { height: 668 } })).toBe(668)
  })

  it('falls back to innerHeight', () => {
    expect(visibleViewportHeight({ innerHeight: 844 })).toBe(844)
    expect(visibleViewportHeight({ innerHeight: 844, visualViewport: null })).toBe(844)
  })
})

describe('applyAppViewportHeight', () => {
  it('writes a pixel custom property', () => {
    const style = { setProperty: (name: string, value: string) => { props[name] = value } }
    const props: Record<string, string> = {}
    applyAppViewportHeight(style as CSSStyleDeclaration, 668)
    expect(props['--app-height']).toBe('668px')
  })
})
