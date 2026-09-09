import { useEffect, useState } from 'react'
import { subscribePlayhead } from './playheadBus'

/** Live playhead for small UI chrome. Canvases should read getPlayheadBeat() in rAF instead. */
export function usePlayheadBeat(isPlaying: boolean, committedBeat: number): number {
  const [live, setLive] = useState(committedBeat)

  useEffect(() => {
    if (!isPlaying) return
    let last = 0
    return subscribePlayhead((beat) => {
      const now = performance.now()
      if (now - last < 50) return
      last = now
      setLive(beat)
    })
  }, [isPlaying])

  return isPlaying ? live : committedBeat
}
