import { GT_LINE_TO_MIDI } from '../gtPitch'

const GT_LO = GT_LINE_TO_MIDI[GT_LINE_TO_MIDI.length - 1]
const GT_HI = GT_LINE_TO_MIDI[0]
const STAFF_CENTER = (GT_LO + GT_HI) / 2
const LOW_CENTER = GT_LO + 7

export type KeyShiftOpts = { preferLow?: boolean }

/**
 * Chromatic shift that keeps intervals (the song still “sounds the same”)
 * while landing as many notes as possible in Growtopia’s two-octave staff.
 * Prefers a key change (|k| < 12) over jumping the whole song by octaves.
 * `preferLow` aims for the lower half of the staff.
 */
export function bestGlobalKeyShift(midis: number[], opts?: KeyShiftOpts): number {
  if (midis.length === 0) return 0
  const preferLow = opts?.preferLow === true
  const target = preferLow ? LOW_CENTER : STAFF_CENTER
  let bestK = 0
  let bestScore = Number.NEGATIVE_INFINITY
  for (let k = -24; k <= 24; k++) {
    let inRange = 0
    let sum = 0
    for (const midi of midis) {
      const shifted = midi + k
      if (shifted >= GT_LO && shifted <= GT_HI) inRange++
      sum += shifted
    }
    const center = sum / midis.length
    const octavePenalty = Math.abs(k) >= 12 ? (preferLow ? 6 : 40) : 0
    const lowBonus = preferLow ? -center * 2 : 0
    const score =
      inRange * 1000 - Math.abs(k) - octavePenalty - Math.abs(center - target) + lowBonus
    if (score > bestScore) {
      bestScore = score
      bestK = k
    }
  }
  return bestK
}

/** Clamp into the staff, then snap to a line. No per-note octave wrap. */
export function snapInStaff(midi: number): number {
  const lo = GT_LO
  const hi = GT_HI
  const clamped = Math.max(lo, Math.min(hi, midi))
  let best = GT_LINE_TO_MIDI[0]
  let bestDist = Infinity
  for (const lineMidi of GT_LINE_TO_MIDI) {
    const dist = Math.abs(lineMidi - clamped)
    if (dist < bestDist) {
      bestDist = dist
      best = lineMidi
    }
  }
  return best
}
