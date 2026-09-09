type PlayheadListener = (beat: number) => void

let beat = 0
const listeners = new Set<PlayheadListener>()

export function getPlayheadBeat(): number {
  return beat
}

export function setPlayheadBeat(next: number): void {
  beat = Math.max(0, next)
  for (const fn of listeners) fn(beat)
}

export function subscribePlayhead(fn: PlayheadListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
