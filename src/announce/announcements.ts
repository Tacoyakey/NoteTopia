const DISMISS_KEY = 'notetopia-announce-dismissed'
const SESSION_KEY = 'notetopia-announce-session'

export type AnnouncementDef = {
  /** Bump this when you ship a new notice. */
  id: string
  date: string
  /** Leaf under announce.post in locales. */
  post: string
}

/** Newest first. The first entry is what pops on launch. */
export const ANNOUNCEMENTS: AnnouncementDef[] = [
  {
    id: '2026-09-09-welcome-2',
    date: '2026-09-09',
    post: 'welcome',
  },
]

export function currentAnnouncement(): AnnouncementDef {
  return ANNOUNCEMENTS[0]!
}

export function shouldShowAnnouncement(dismissedId: string | null, sessionId: string | null, currentId: string): boolean {
  return dismissedId !== currentId && sessionId !== currentId
}

export function readDismissedAnnouncementId(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

export function readSessionAnnouncementId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function dismissAnnouncementForever(id: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, id)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, id)
  } catch {
    /* ignore */
  }
}

export function dismissAnnouncementThisSession(id: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, id)
  } catch {
    /* ignore */
  }
}
