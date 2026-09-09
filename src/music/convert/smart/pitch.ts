import { GT_LINE_TO_MIDI, snapMidiToLine } from '../../gtPitch'

const GT_LO = GT_LINE_TO_MIDI[GT_LINE_TO_MIDI.length - 1]
const GT_HI = GT_LINE_TO_MIDI[0]

export function median(values: number[]): number {
  if (values.length === 0) return 60
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function bestOctaveShift(midis: number[], target: number): number {
  let bestK = 0
  let bestScore = Number.NEGATIVE_INFINITY
  for (const k of [-24, -12, 0, 12, 24]) {
    const shifted = midis.map((m) => m + k)
    const inRange = shifted.filter((m) => m >= GT_LO && m <= GT_HI).length
    const dist = Math.abs(median(shifted) - target)
    const score = inRange * 12 - dist
    if (score > bestScore) {
      bestScore = score
      bestK = k
    }
  }
  return bestK
}

export function foldPreservingContour(midi: number, prevFolded: number | null): number {
  const candidates = [midi, midi + 12, midi - 12, midi + 24, midi - 24].filter(
    (m) => m >= GT_LO && m <= GT_HI,
  )
  if (candidates.length === 0) return snapMidiToLine(midi)
  const goal = prevFolded ?? midi
  return candidates.reduce((best, cur) =>
    Math.abs(cur - goal) < Math.abs(best - goal) ? cur : best,
  )
}

export { GT_LO, GT_HI }
