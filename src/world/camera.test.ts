import { describe, expect, it } from 'vitest'
import { WorldCamera } from './camera'

describe('WorldCamera', () => {
  it('eases toward keeping the playhead in view', () => {
    const cam = new WorldCamera()
    for (let i = 0; i < 80; i++) cam.followPlayhead(400, 200)
    expect(cam.x).toBeCloseTo(340, 0)
  })

  it('lets explore peek ahead while following, then eases back', () => {
    const cam = new WorldCamera()
    for (let i = 0; i < 80; i++) cam.followPlayhead(400, 200)
    cam.beginLook()
    cam.pan(80, true)
    expect(cam.x).toBeCloseTo(420, 0)
    cam.endLook()
    for (let i = 0; i < 80; i++) cam.followPlayhead(400, 200)
    expect(cam.x).toBeCloseTo(340, 0)
  })

  it('one follow sample is one lerp — hover redraws must not double-step', () => {
    const once = new WorldCamera()
    const twice = new WorldCamera()
    once.followPlayhead(400, 200)
    twice.followPlayhead(400, 200)
    twice.followPlayhead(400, 200)
    expect(twice.x).toBeGreaterThan(once.x)
  })
})
