const STORAGE_KEY = 'notetopia-studio-mode'
const OPEN_EVENT = 'notetopia-open-intro'

export type StudioMode = 'simple' | 'studio'

const listeners = new Set<() => void>()

let mode: StudioMode | null = null
let hydrated = false
let picking = false

export function parseStudioMode(raw: string | null | undefined): StudioMode | null {
  if (raw === 'simple' || raw === 'studio') return raw
  return null
}

export function readStudioMode(): StudioMode | null {
  try {
    return parseStudioMode(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeStudioMode(next: StudioMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  mode = readStudioMode()
}

function emit() {
  listeners.forEach((fn) => fn())
}

export function getStudioMode(): StudioMode | null {
  hydrate()
  return mode
}

export function isStudioIntroOpen(): boolean {
  hydrate()
  return picking || mode == null
}

export function subscribeStudioMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setStudioMode(next: StudioMode): void {
  writeStudioMode(next)
  hydrated = true
  mode = next
  picking = false
  emit()
}

export function openStudioIntro(): void {
  hydrate()
  picking = true
  emit()
}

if (typeof window !== 'undefined') {
  const w = window as Window & { __notetopiaIntroBound?: boolean }
  if (!w.__notetopiaIntroBound) {
    w.__notetopiaIntroBound = true
    window.addEventListener(OPEN_EVENT, () => openStudioIntro())
  }
}
