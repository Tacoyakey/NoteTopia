const SEEN_KEY = 'notetopia-seen-start-tour'

export function hasSeenStartTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markStartTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* quota / private mode */
  }
}

export function startPrimaryTour(): void {
  window.dispatchEvent(new CustomEvent('notetopia-open-tutorial', { detail: { id: 'start' } }))
}
