/**
 * Unlock Smart MIDI convert in the import picker.
 * Keep true while developing. Set false before a public release so the
 * option stays visible but grayed out.
 */
export const EXPERIMENTAL_CONVERT = true

/** Saved on songs when Smart convert is used. */
export const EXPERIMENTAL_CONVERT_ID = 'v3-experimental'

export function usesConvertRacks(id: string | undefined): boolean {
  return id === 'v1.5-beta' || id === EXPERIMENTAL_CONVERT_ID
}

export function isConvertUnlocked(id: string | undefined): boolean {
  if (id !== EXPERIMENTAL_CONVERT_ID) return true
  return EXPERIMENTAL_CONVERT
}
