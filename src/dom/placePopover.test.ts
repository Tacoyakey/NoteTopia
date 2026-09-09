import { describe, expect, it } from 'vitest'
import { clampPopover, placePopover } from './placePopover'

const phone = { left: 0, top: 0, width: 390, height: 844 }

describe('placePopover', () => {
  it('keeps a right-aligned menu on screen when the trigger is on the left', () => {
    const pos = placePopover({
      trigger: { left: 12, right: 88, top: 500, bottom: 540 },
      width: 248,
      height: 160,
      align: 'right',
      drop: 'up',
      view: phone,
    })
    expect(pos.left).toBe(8)
    expect(pos.left + 248).toBeLessThanOrEqual(phone.width - 8)
  })

  it('clamps a wide menu inside a narrow viewport', () => {
    const pos = clampPopover(-40, 10, 248, 120, phone)
    expect(pos.left).toBe(8)
    expect(pos.top).toBeGreaterThanOrEqual(8)
  })
})
