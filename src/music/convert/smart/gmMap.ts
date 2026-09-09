import type { InstrumentId } from '../../types'

export interface GmMapOptions {
  padInstrument?: 'piano' | 'spooky'
  bellInstrument?: 'lyre' | 'winterfest'
  fallbackInstrument?: InstrumentId
}

/**
 * Map a General MIDI program (0–127) onto a Growtopia instrument.
 * Channel 9 percussion is handled by `isPercussion`.
 *
 * Backing ensembles and clarinet land on piano so they don't steal the melody
 * as sax/violin. Actual saxophones (64–67) still map to sax.
 */
export function mapGmProgram(
  program: number,
  isPercussion: boolean,
  opts?: GmMapOptions,
): InstrumentId {
  if (isPercussion) return 'drums'
  const pad = opts?.padInstrument ?? 'piano'
  const bell = opts?.bellInstrument ?? 'lyre'
  const fallback = opts?.fallbackInstrument ?? 'piano'
  const n = Number.isFinite(program) ? Math.max(0, Math.min(127, Math.round(program))) : 0

  if (n <= 7) return 'piano'
  if (n <= 15) return bell
  if (n <= 23) return 'piano'
  if (n <= 25) return 'guitar'
  if (n <= 31) return 'electric-guitar'
  if (n <= 39) return 'bass'
  if (n === 43) return 'bass'
  if (n <= 45) return 'violin'
  if (n === 46) return 'lyre'
  if (n === 47) return 'drums'
  if (n <= 54) return pad
  if (n === 55) return 'piano'
  if (n <= 59) return 'trumpet'
  if (n === 60) return 'trumpet'
  if (n <= 63) return pad
  if (n <= 67) return 'sax'
  if (n <= 69) return 'flute'
  if (n === 70) return 'bass'
  if (n === 71) return 'piano'
  if (n <= 79) return 'flute'
  if (n <= 103) return pad
  if (n === 104 || n === 105) return 'guitar'
  if (n === 107 || n === 108) return 'lyre'
  if (n === 110) return 'violin'
  if (n <= 111) return fallback
  if (n <= 119) return bell
  return fallback
}
