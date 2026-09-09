import { describe, expect, it } from 'vitest'
import { nextNoteSelection, noteSelectMode, sameNoteIds } from './noteSelection'

describe('noteSelectMode', () => {
  it('replaces by default, adds with Shift, toggles with Ctrl/Cmd', () => {
    expect(noteSelectMode({})).toBe('replace')
    expect(noteSelectMode({ shiftKey: true })).toBe('add')
    expect(noteSelectMode({ ctrlKey: true })).toBe('toggle')
    expect(noteSelectMode({ metaKey: true, shiftKey: true })).toBe('toggle')
  })
})

describe('nextNoteSelection', () => {
  it('replaces, unions, and toggles ids', () => {
    expect([...nextNoteSelection(['a'], ['b'], 'replace')]).toEqual(['b'])
    expect([...nextNoteSelection(['a'], ['b'], 'add')].sort()).toEqual(['a', 'b'])
    expect([...nextNoteSelection(['a', 'b'], ['b'], 'toggle')]).toEqual(['a'])
    expect([...nextNoteSelection(['a'], ['b'], 'toggle')].sort()).toEqual(['a', 'b'])
  })
})

describe('sameNoteIds', () => {
  it('compares as sets', () => {
    expect(sameNoteIds(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameNoteIds(['a'], ['a', 'b'])).toBe(false)
  })
})
