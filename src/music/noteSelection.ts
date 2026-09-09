export type NoteSelectMode = 'replace' | 'add' | 'toggle'

export function noteSelectMode(mods: {
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
}): NoteSelectMode {
  if (mods.metaKey || mods.ctrlKey) return 'toggle'
  if (mods.shiftKey) return 'add'
  return 'replace'
}

export function nextNoteSelection(
  current: Iterable<string>,
  noteIds: string[],
  mode: NoteSelectMode,
): Set<string> {
  if (mode === 'replace') return new Set(noteIds)
  const ids = new Set(current)
  if (mode === 'add') {
    for (const id of noteIds) ids.add(id)
    return ids
  }
  for (const id of noteIds) {
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
  }
  return ids
}

export function sameNoteIds(a: Iterable<string>, b: Iterable<string>): boolean {
  const left = a instanceof Set ? a : new Set(a)
  const right = b instanceof Set ? b : new Set(b)
  if (left.size !== right.size) return false
  for (const id of left) {
    if (!right.has(id)) return false
  }
  return true
}
