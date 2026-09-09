import { useEffect, useState } from 'react'
import { APP_AUTHOR, APP_NAME, APP_STAGE, APP_YEARS, ABOUT_LINKS } from '../branding'
import { useT } from '../i18n/LanguageProvider'
import { isTypingTarget } from '../dom/focus'

function Ext({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export function AboutOverlay() {
  const { t } = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openAbout = () => setOpen(true)
    const toggle = () => setOpen((v) => !v)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isTypingTarget(e.target) && !open) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('notetopia-open-about', openAbout)
    window.addEventListener('notetopia-toggle-about', toggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('notetopia-open-about', openAbout)
      window.removeEventListener('notetopia-toggle-about', toggle)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="help-overlay" onClick={() => setOpen(false)}>
      <div className="help-panel about-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="about-title">
        <div className="help-header">
          <h3 id="about-title">{t('about.title')}</h3>
          <span className="about-stage">{APP_STAGE}</span>
        </div>
        <div className="help-body">
        <p className="help-lead">{t('about.lead', { name: APP_NAME, author: APP_AUTHOR })}</p>
        <p className="about-copy">{t('about.unofficial')}</p>

        <h4 className="help-section-title">{t('about.creditsTitle')}</h4>
        <ul className="about-list">
          <li>
            {t('about.creditGrowtopia')}{' '}
            <Ext href={ABOUT_LINKS.growtopia}>Growtopia</Ext>
            {' / '}
            <Ext href={ABOUT_LINKS.ubisoft}>Ubisoft</Ext>
          </li>
          <li>
            {t('about.creditGtMusicSim')}{' '}
            <Ext href={ABOUT_LINKS.gtMusicSim}>GTMusicSim</Ext>
          </li>
          <li>
            {t('about.creditKixnoway')}{' '}
            <Ext href={ABOUT_LINKS.kixnoway}>kixnoway.com</Ext>
            {' / '}
            <Ext href={ABOUT_LINKS.kixnowayGithub}>KixDev</Ext>
          </li>
          <li>
            {t('about.creditGmsf')} MyLegGuy, HonestyCow, D.RS, Bonk
          </li>
          <li>
            {t('about.creditSprites')}{' '}
            <Ext href={ABOUT_LINKS.wiki}>{t('about.wikiName')}</Ext>
          </li>
          <li>{t('about.creditDiscord')}</li>
        </ul>

        <p className="about-copy about-warranty">
          {t('about.warranty', { years: APP_YEARS, author: APP_AUTHOR })}
        </p>
        </div>

        <div className="help-foot">
        <div className="announce-actions">
          <button
            type="button"
            className="btn-tool"
            onClick={() => {
              setOpen(false)
              window.dispatchEvent(new Event('notetopia-open-announce'))
            }}
          >
            {t('announce.open')}
          </button>
          <button type="button" className="btn-tool" onClick={() => setOpen(false)}>
            {t('about.close')}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
