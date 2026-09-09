import { describe, expect, it } from 'vitest'
import { APP_CREDIT, APP_STAGE, APP_VERSION } from './branding'

describe('branding', () => {
  it('shows Alpha instead of a numeric app version', () => {
    expect(APP_STAGE).toBe('Alpha')
    expect(APP_VERSION).toBe('Alpha')
    expect(APP_CREDIT).toContain('Alpha')
    expect(APP_CREDIT).not.toMatch(/v0\.5/)
  })
})
