import { useCallback, useState } from 'react'

const KEY = 'music-world-layout'

export interface LayoutPrefs {
  arrangeRatio: number
  arrangeMin: boolean
  pianoMin: boolean
  sidebarWidth: number
  sidebarMin: boolean
  paletteMin: boolean
  settingsMin: boolean
  sheetListMin: boolean
}

const DEFAULTS: LayoutPrefs = {
  arrangeRatio: 0.4,
  arrangeMin: false,
  pianoMin: false,
  sidebarWidth: 268,
  sidebarMin: false,
  paletteMin: true,
  settingsMin: false,
  sheetListMin: true,
}

function load(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return {
      ...DEFAULTS,
      ...(JSON.parse(raw) as Partial<LayoutPrefs>),
      paletteMin: true,
      sheetListMin: true,
    }
  } catch {
    return DEFAULTS
  }
}

export function useLayoutPrefs() {
  const [prefs, setPrefs] = useState<LayoutPrefs>(load)

  const update = useCallback((patch: Partial<LayoutPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore quota */
      }
      return next
    })
  }, [])

  return { prefs, update }
}
