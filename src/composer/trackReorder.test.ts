import { describe, expect, it } from 'vitest'
import { laneDrawY, reorderShiftY } from './trackReorder'

describe('reorderShiftY', () => {
  it('slides neighbors toward the vacated slot', () => {
    expect(reorderShiftY(1, 0, 2, 80)).toBe(-80)
    expect(reorderShiftY(2, 0, 2, 80)).toBe(-80)
    expect(reorderShiftY(3, 0, 2, 80)).toBe(0)
    expect(reorderShiftY(0, 2, 0, 80)).toBe(80)
  })
})

describe('laneDrawY', () => {
  it('follows the pointer for the dragged lane', () => {
    expect(laneDrawY(1, 80, { id: 'a', from: 1, to: 3, dy: 24 })).toBe(104)
  })
})
