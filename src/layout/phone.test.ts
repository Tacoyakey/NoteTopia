import { describe, expect, it } from 'vitest'
import { isPhoneLayout, isPhoneUserAgent } from './phone'

describe('isPhoneUserAgent', () => {
  it('detects iPhone and Android phones', () => {
    expect(isPhoneUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(
      isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36'),
    ).toBe(true)
    expect(isPhoneUserAgent('Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0')).toBe(true)
    expect(isPhoneUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false)
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X810) Safari/537.36')).toBe(false)
  })
})

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

  it('treats iPhone and Android phone UAs as phones even on a wide window', () => {
    expect(
      isPhoneLayout({
        width: 1024,
        height: 768,
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      }),
    ).toBe(true)
    expect(
      isPhoneLayout({
        width: 1024,
        height: 768,
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36',
      }),
    ).toBe(true)
  })
})
