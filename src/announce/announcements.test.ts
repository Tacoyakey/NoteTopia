import { describe, expect, it } from 'vitest'
import { currentAnnouncement, shouldShowAnnouncement } from './announcements'

describe('announcements', () => {
  it('treats a new id as unseen', () => {
    expect(shouldShowAnnouncement('old-id', null, 'new-id')).toBe(true)
    expect(shouldShowAnnouncement(null, null, 'new-id')).toBe(true)
  })

  it('hides after don’t-show-again until the id changes', () => {
    expect(shouldShowAnnouncement('new-id', null, 'new-id')).toBe(false)
    expect(shouldShowAnnouncement('new-id', 'new-id', 'newer-id')).toBe(true)
  })

  it('hides for the rest of the session after close', () => {
    expect(shouldShowAnnouncement(null, 'new-id', 'new-id')).toBe(false)
  })

  it('points at a current notice', () => {
    const current = currentAnnouncement()
    expect(current.id.length).toBeGreaterThan(0)
    expect(current.post.length).toBeGreaterThan(0)
  })
})
