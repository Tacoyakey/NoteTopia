import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasSeenStartTour,
  isAwaitingStartTour,
  launchAnnouncementsReady,
  markAwaitingStartTour,
  markStartTourSeen,
} from './firstRun'

const local = new Map<string, string>()
const session = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => {
    local.set(key, value)
  },
  removeItem: (key: string) => {
    local.delete(key)
  },
})

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => {
    session.set(key, value)
  },
  removeItem: (key: string) => {
    session.delete(key)
  },
})

describe('first-run start tour', () => {
  afterEach(() => {
    local.clear()
    session.clear()
  })

  it('is unseen until marked', () => {
    expect(hasSeenStartTour()).toBe(false)
    markStartTourSeen()
    expect(hasSeenStartTour()).toBe(true)
  })

  it('holds launch announcements until the start tour finishes', () => {
    expect(launchAnnouncementsReady()).toBe(true)
    markAwaitingStartTour()
    expect(isAwaitingStartTour()).toBe(true)
    expect(launchAnnouncementsReady()).toBe(false)
    markStartTourSeen()
    expect(isAwaitingStartTour()).toBe(false)
    expect(launchAnnouncementsReady()).toBe(true)
  })
})
