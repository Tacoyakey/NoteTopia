import { describe, expect, it } from 'vitest'
import { pickToolbarPack } from './toolbarFit'

describe('pickToolbarPack', () => {
  it('stays on one row when left, transport, and far-right tools fit', () => {
    expect(
      pickToolbarPack({
        inner: 1600,
        left: 420,
        center: 320,
        right: 460,
        current: 'comfortable',
      }),
    ).toBe('comfortable')
  })

  it('stacks playback onto its own row when tools no longer fit beside it', () => {
    expect(
      pickToolbarPack({
        inner: 1440,
        left: 490,
        center: 340,
        right: 620,
        current: 'comfortable',
      }),
    ).toBe('stacked')
  })

  it('goes compact when even two rows cannot hold the labeled controls', () => {
    expect(
      pickToolbarPack({
        inner: 720,
        left: 490,
        center: 340,
        right: 620,
        current: 'comfortable',
      }),
    ).toBe('compact')
  })

  it('needs extra room before returning to one row', () => {
    const cramped = {
      inner: 1440,
      left: 490,
      center: 340,
      right: 620,
    }
    expect(pickToolbarPack({ ...cramped, current: 'comfortable' })).toBe('stacked')
    expect(pickToolbarPack({ ...cramped, current: 'stacked' })).toBe('stacked')
    expect(pickToolbarPack({ ...cramped, inner: 1920, current: 'stacked' })).toBe('comfortable')
  })

  it('keeps one row when volume sits in a trailing end column', () => {
    expect(
      pickToolbarPack({
        inner: 1888,
        left: 463,
        center: 351,
        right: 633,
        end: 128,
        current: 'comfortable',
      }),
    ).toBe('comfortable')
  })
})
