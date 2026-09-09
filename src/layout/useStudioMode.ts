import { useEffect, useState } from 'react'
import {
  getStudioMode,
  isStudioIntroOpen,
  parseStudioMode,
  setStudioMode,
  subscribeStudioMode,
} from './studioMode'

export function useStudioMode() {
  const [, setTick] = useState(0)

  useEffect(() => subscribeStudioMode(() => setTick((n) => n + 1)), [])

  const mode = getStudioMode()
  return {
    mode,
    simple: mode === 'simple',
    studio: mode === 'studio',
    chosen: mode != null,
    picking: isStudioIntroOpen(),
    setMode: setStudioMode,
  }
}

export { parseStudioMode }
