import { describe, expect, it, vi } from 'vitest'
import { runMiniaturize } from './miniaturize'

describe('runMiniaturize', () => {
  it('still applies the layout change', () => {
    const mutate = vi.fn()
    runMiniaturize(mutate)
    expect(mutate).toHaveBeenCalledOnce()
  })
})
