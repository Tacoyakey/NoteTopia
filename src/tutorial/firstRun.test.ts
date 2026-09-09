import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasSeenStartTour, markStartTourSeen } from './firstRun'

const mem = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mem.set(key, value)
  },
  removeItem: (key: string) => {
    mem.delete(key)
  },
})

describe('first-run start tour', () => {
  afterEach(() => {
    mem.clear()
  })

  it('is unseen until marked', () => {
    expect(hasSeenStartTour()).toBe(false)
    markStartTourSeen()
    expect(hasSeenStartTour()).toBe(true)
  })
})
