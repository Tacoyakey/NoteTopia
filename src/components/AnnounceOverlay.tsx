import { useEffect, useState } from 'react'
import {
  currentAnnouncement,
  dismissAnnouncementForever,
  dismissAnnouncementThisSession,
  readDismissedAnnouncementId,
  readSessionAnnouncementId,
  shouldShowAnnouncement,
} from '../announce/announcements'
import { useT } from '../i18n/LanguageProvider'
import { tAll } from '../i18n/i18n'
import { isTypingTarget } from '../dom/focus'
import { useStudioMode } from '../layout/useStudioMode'
import { launchAnnouncementsReady, START_TOUR_FINISHED } from '../tutorial/firstRun'

const OPEN_EVENT = 'notetopia-open-announce'

export function AnnounceOverlay() {
  const { t } = useT()
  const current = currentAnnouncement()
  const [open, setOpen] = useState(false)
  const heading = t(`announce.post.${current.post}.heading`)
  const items = tAll(`announce.post.${current.post}.items`)
  const wip = tAll(`announce.post.${current.post}.wip`)

  const { chosen } = useStudioMode()

  useEffect(() => {
    const tryLaunch = () => {
      if (!chosen) return
      if (!launchAnnouncementsReady()) return
      if (
        shouldShowAnnouncement(
          readDismissedAnnouncementId(),
          readSessionAnnouncementId(),
          current.id,
        )
      ) {
        setOpen(true)
      }
    }
    tryLaunch()
    const openForced = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, openForced)
    window.addEventListener(START_TOUR_FINISHED, tryLaunch)
    return () => {
      window.removeEventListener(OPEN_EVENT, openForced)
      window.removeEventListener(START_TOUR_FINISHED, tryLaunch)
    }
  }, [current.id, chosen])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isTypingTarget(e.target)) return
      dismissAnnouncementThisSession(current.id)
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, current.id])

  const hideThisSession = () => {
    dismissAnnouncementThisSession(current.id)
    setOpen(false)
  }

  const hideForever = () => {
    dismissAnnouncementForever(current.id)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="help-overlay" onClick={hideThisSession}>
      <div
        className="help-panel announce-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="announce-title"
      >
        <div className="help-header">
          <h3 id="announce-title">{t('announce.title')}</h3>
          <span className="announce-date">{current.date}</span>
        </div>
        <div className="help-body">
        <p className="announce-heading">{heading}</p>
        {items.length > 0 ? (
          <>
            <h4 className="help-section-title">{t('announce.ready')}</h4>
            <ul className="announce-list">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        {wip.length > 0 ? (
          <>
            <h4 className="help-section-title">{t('announce.wip')}</h4>
            <ul className="announce-list">
              {wip.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        </div>
        <div className="help-foot">
        <div className="announce-actions">
          <button type="button" className="btn-tool btn-tool-primary" onClick={hideForever}>
            {t('announce.dontShow')}
          </button>
          <button type="button" className="btn-tool" onClick={hideThisSession}>
            {t('announce.close')}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
