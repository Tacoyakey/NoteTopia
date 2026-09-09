import { describe, expect, it } from 'vitest'
import { isPhoneLayout } from './phone'

describe('isPhoneLayout', () => {
  it('treats narrow widths as phones', () => {
    expect(isPhoneLayout({ width: 390, height: 844 })).toBe(true)
    expect(isPhoneLayout({ width: 1280, height: 800 })).toBe(false)
  })

  it('treats coarse pointers on compact tablets as phones', () => {
    expect(isPhoneLayout({ width: 820, height: 1180, coarse: true })).toBe(true)
    expect(isPhoneLayout({ width: 820, height: 1180, coarse: false })).toBe(false)
  })

  it('treats short landscape viewports as phones', () => {
    expect(isPhoneLayout({ width: 844, height: 390 })).toBe(true)
  })
})
