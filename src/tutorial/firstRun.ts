import { readPhoneLayout } from '../layout/phone'

const SEEN_KEY = 'notetopia-seen-start-tour'
const AWAIT_KEY = 'notetopia-await-start-tour'
export const START_TOUR_FINISHED = 'notetopia-start-tour-finished'

export function hasSeenStartTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function isAwaitingStartTour(): boolean {
  try {
    return sessionStorage.getItem(AWAIT_KEY) === '1'
  } catch {
    return false
  }
}

export function markAwaitingStartTour(): void {
  try {
    sessionStorage.setItem(AWAIT_KEY, '1')
  } catch {
    /* quota / private mode */
  }
}

export function markStartTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* quota / private mode */
  }
  try {
    sessionStorage.removeItem(AWAIT_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(START_TOUR_FINISHED))
  }
}

export function startPrimaryTour(): void {
  const id =
    typeof window !== 'undefined' && readPhoneLayout(window) ? 'phone' : 'start'
  window.dispatchEvent(new CustomEvent('notetopia-open-tutorial', { detail: { id } }))
}

/** Launch popups wait until the first-run tour is finished or skipped. */
export function launchAnnouncementsReady(): boolean {
  return hasSeenStartTour() || !isAwaitingStartTour()
}
