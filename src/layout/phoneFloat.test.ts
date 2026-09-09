import { afterEach, describe, expect, it } from 'vitest'
import { isPhoneFloatOpen, showPhoneFloat, togglePhoneFloat } from './phoneFloat'

afterEach(() => {
  showPhoneFloat()
})

describe('phoneFloat', () => {
  it('starts open and hide/show from the same toggle', () => {
    expect(isPhoneFloatOpen()).toBe(true)
    togglePhoneFloat()
    expect(isPhoneFloatOpen()).toBe(false)
    togglePhoneFloat()
    expect(isPhoneFloatOpen()).toBe(true)
  })

  it('show is a no-op when already open', () => {
    showPhoneFloat()
    expect(isPhoneFloatOpen()).toBe(true)
    togglePhoneFloat()
    showPhoneFloat()
    expect(isPhoneFloatOpen()).toBe(true)
  })
})
