const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function pitchToName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1
  const name = NOTE_NAMES[pitch % 12]
  return `${name}${octave}`
}

export function nameToPitch(name: string): number | null {
  const match = name.match(/^([A-G]#?)(\d+)$/)
  if (!match) return null
  const idx = NOTE_NAMES.indexOf(match[1])
  if (idx === -1) return null
  return (parseInt(match[2], 10) + 1) * 12 + idx
}

export const PITCH_MIN = 36
export const PITCH_MAX = 96
export const PITCH_COUNT = PITCH_MAX - PITCH_MIN + 1

export function clampPitch(pitch: number): number {
  return Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch))
}

export function pitchToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12)
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12)
}
