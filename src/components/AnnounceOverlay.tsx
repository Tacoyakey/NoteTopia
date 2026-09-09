import { useCallback, useEffect, useState } from 'react'
import {
  currentAnnouncement,
  dismissAnnouncementForever,
  dismissAnnouncementThisSession,
  readDismissedAnnouncementId,
  readSessionAnnouncementId,
  shouldShowAnnouncement,
} from '../announce/announcements'
import { APP_DISCORD } from '../branding'
import { useT } from '../i18n/LanguageProvider'
import { tAll } from '../i18n/i18n'
import { isTypingTarget } from '../dom/focus'
import { useStudioMode } from '../layout/useStudioMode'
import { launchAnnouncementsReady, START_TOUR_FINISHED } from '../tutorial/firstRun'
import { DiscordIcon } from './icons'

const OPEN_EVENT = 'notetopia-open-announce'

export function AnnounceOverlay() {
  const { t } = useT()
  const current = currentAnnouncement()
  const [open, setOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
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
    const openForced = () => {
      setDontShowAgain(false)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, openForced)
    window.addEventListener(START_TOUR_FINISHED, tryLaunch)
    return () => {
      window.removeEventListener(OPEN_EVENT, openForced)
      window.removeEventListener(START_TOUR_FINISHED, tryLaunch)
    }
  }, [current.id, chosen])

  const close = useCallback(() => {
    if (dontShowAgain) dismissAnnouncementForever(current.id)
    else dismissAnnouncementThisSession(current.id)
    setOpen(false)
    setDontShowAgain(false)
  }, [dontShowAgain, current.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isTypingTarget(e.target)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div className="help-overlay" onClick={close}>
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
          <p className="announce-discord">
            <DiscordIcon size={22} className="announce-discord-icon" />
            <span>
              {t('announce.contact')}{' '}
              <strong className="announce-discord-handle">{APP_DISCORD}</strong>
            </span>
          </p>
          <div className="announce-actions">
            <label className="checkbox-row announce-dont-show">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              {t('announce.dontShow')}
            </label>
            <button type="button" className="btn-tool btn-tool-primary" onClick={close}>
              {t('announce.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
