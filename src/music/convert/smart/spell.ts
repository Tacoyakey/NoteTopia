import type { GtVariant } from '../../gtPitch'
import { spellMidiAccidental } from '../accidentals'
import type { AccidentalSpelling } from './options'
import type { DetectedKey } from './analyze'
import { prefersFlatSpelling } from './analyze'

export function spellWithPolicy(
  midi: number,
  policy: AccidentalSpelling,
  key?: DetectedKey,
): { written: number; variant: GtVariant } {
  const pc = ((midi % 12) + 12) % 12
  if (pc === 0 || pc === 2 || pc === 4 || pc === 5 || pc === 7 || pc === 9 || pc === 11) {
    return { written: midi, variant: 'natural' }
  }
  const asSharp = { written: midi - 1, variant: 'sharp' as const }
  const asFlat = { written: midi + 1, variant: 'flat' as const }
  if (policy === 'sharps') return asSharp
  if (policy === 'flats') return asFlat
  if (policy === 'key' && key) return prefersFlatSpelling(key) ? asFlat : asSharp
  return spellMidiAccidental(midi)
}
