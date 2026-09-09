import { useEffect, useState, type ReactNode } from 'react'
import { useSong } from '../context/SongContext'
import { APP_CREDIT, APP_NAME } from '../branding'
import { useT } from '../i18n/LanguageProvider'
import { LanguageSelect } from '../i18n/LanguageSelect'
import { isTabbableControl, isTypingTarget } from '../dom/focus'
import { useStudioMode } from '../layout/useStudioMode'
import { BookOpen, ChevronDown } from './icons'

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="help-kbd">{children}</kbd>
}

function Keys({
  keys,
  then,
}: {
  keys: string[]
  then?: string
}) {
  return (
    <span className="help-keys">
      {keys.map((key, i) => (
        <span key={`${key}-${i}`} className="help-key-combo">
          {i > 0 ? <span className="help-key-plus">+</span> : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
      {then ? <span className="help-key-rest">{then}</span> : null}
    </span>
  )
}

function Mod({ then, also }: { then: string[]; also?: string[] }) {
  return (
    <span className="help-keys">
      <Kbd>⌘</Kbd>
      <span className="help-key-or">/</span>
      <Kbd>Ctrl</Kbd>
      {then.map((key) => (
        <span key={key} className="help-key-combo">
          <span className="help-key-plus">+</span>
          <Kbd>{key}</Kbd>
        </span>
      ))}
      {also?.map((key) => (
        <span key={key} className="help-key-combo">
          <span className="help-key-or">/</span>
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  )
}

function withEsc(text: string) {
  const parts = text.split('{esc}')
  if (parts.length === 1) return text
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 ? <Kbd>Esc</Kbd> : null}
    </span>
  ))
}

function Row({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt>{keys}</dt>
      <dd>{children}</dd>
    </>
  )
}

function HelpFold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`help-fold${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="help-fold-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h4 className="help-section-title">{title}</h4>
        <ChevronDown size={16} className="help-fold-chevron" />
      </button>
      {open ? <div className="help-fold-body">{children}</div> : null}
    </div>
  )
}

export function HelpOverlay() {
  const { state, dispatch } = useSong()
  const { t } = useT()
  const { simple } = useStudioMode()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const toggle = () => setOpen((v) => !v)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (open || isTabbableControl(e.target) || simple) return
        e.preventDefault()
        dispatch({
          type: 'SET_MODE',
          mode: state.mode === 'world' ? 'composer' : 'world',
        })
        return
      }
      if (isTypingTarget(e.target)) {
        if (e.key === 'Escape') setOpen(false)
        return
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        toggle()
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('music-world-toggle-help', toggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('music-world-toggle-help', toggle)
    }
  }, [dispatch, open, state.mode, simple])

  if (!open) return null

  return (
    <div className="help-overlay help-sheet" onClick={() => setOpen(false)}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <h3>{APP_NAME}</h3>
          <LanguageSelect />
        </div>
        <div className="help-body">
        <p className="help-lead">{simple ? t('intro.simpleLead') : t('help.lead')}</p>
        <h4 className="help-section-title">{t('tour.title')}</h4>
        <div className="tour-picks">
          {(['start', 'midi', 'sheet'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className="tour-pick"
              onClick={() => {
                setOpen(false)
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('notetopia-open-tutorial', { detail: { id } }))
                }, 0)
              }}
            >
              <BookOpen size={16} />
              <span>
                <strong>{t(`tour.${id}.title`)}</strong>
                <em>{t(`tour.${id}.lead`)}</em>
              </span>
            </button>
          ))}
        </div>

        <HelpFold title={t('help.shortcutsTitle')}>
        <dl className="help-dl">
          <Row keys={<Keys keys={['Space']} />}>{t('help.shortcut.space')}</Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>Home</Kbd>
                <span className="help-key-or">/</span>
                <Kbd>End</Kbd>
              </span>
            }
          >
            {t('help.shortcut.jump')}
          </Row>
          <Row keys={<Keys keys={['L']} />}>{t('help.shortcut.loop')}</Row>
          {simple ? null : <Row keys={<Keys keys={['Tab']} />}>{t('help.shortcut.tab')}</Row>}
          <Row keys={<Keys keys={['Esc']} />}>{t('help.shortcut.esc')}</Row>
          <Row keys={<Mod then={['Z']} also={['⇧Z']} />}>{t('help.shortcut.undoRedo')}</Row>
          <Row keys={<Mod then={['C']} also={['X', 'V']} />}>{t('help.shortcut.clipboard')}</Row>
          <Row keys={<Mod then={['D']} />}>{t('help.shortcut.duplicate')}</Row>
          <Row keys={<Mod then={['A']} also={['⇧A']} />}>{t('help.shortcut.selectAll')}</Row>
          <Row keys={<Keys keys={['Delete']} />}>{t('help.shortcut.delete')}</Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>←</Kbd>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <Kbd>→</Kbd>
              </span>
            }
          >
            {t('help.shortcut.nudge')}
          </Row>
          {simple ? null : <Row keys={<Mod then={['+']} also={['−']} />}>{t('help.shortcut.zoom')}</Row>}
          {simple ? null : (
            <Row keys={<Keys keys={['Alt']} then={t('help.scroll')} />}>{t('help.shortcut.lanes')}</Row>
          )}
          <Row
            keys={
              <span className="help-keys">
                <Kbd>1</Kbd>
                <span className="help-key-or">–</span>
                <Kbd>4</Kbd>
              </span>
            }
          >
            {t('help.shortcut.snap')}
          </Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>M</Kbd>
                <span className="help-key-or">/</span>
                <Kbd>S</Kbd>
              </span>
            }
          >
            {t('help.shortcut.muteSolo')}
          </Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>B</Kbd>
                <span className="help-key-or">/</span>
                <Kbd>V</Kbd>
              </span>
            }
          >
            {t('help.shortcut.worldTool')}
          </Row>
          <Row keys={<Keys keys={['T']} />}>{t('help.shortcut.editTool')}</Row>
          <Row keys={<Keys keys={['Q']} />}>{t('help.shortcut.quantize')}</Row>
          <Row keys={<Keys keys={['E']} />}>{t('help.shortcut.slice')}</Row>
          {simple ? null : <Row keys={<Keys keys={['P']} />}>{t('help.shortcut.selectSame')}</Row>}
          {simple ? null : <Row keys={<Keys keys={['G']} />}>{t('help.shortcut.ghost')}</Row>}
          <Row keys={<Keys keys={['U']} />}>{t('help.shortcut.metronome')}</Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>⇧</Kbd>
                <span className="help-key-plus">+</span>
                <Kbd>R</Kbd>
              </span>
            }
          >
            {t('help.shortcut.replace')}
          </Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>[</Kbd>
                <span className="help-key-or">/</span>
                <Kbd>]</Kbd>
              </span>
            }
          >
            {t('help.shortcut.loopBraces')}
          </Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>,</Kbd>
                <span className="help-key-or">/</span>
                <Kbd>.</Kbd>
              </span>
            }
          >
            {t('help.shortcut.worldPage')}
          </Row>
          <Row
            keys={
              <span className="help-keys">
                <Kbd>Shift</Kbd>
                <span className="help-key-or">/</span>
                <Kbd>Alt</Kbd>
              </span>
            }
          >
            {t('help.shortcut.accidentals')}
          </Row>
        </dl>
        </HelpFold>

        <HelpFold title={t('help.featuresTitle')}>
        <dl className="help-dl">
          {simple ? null : (
            <Row keys={t('help.feature.pianoRoll.title')}>{t('help.feature.pianoRoll.body')}</Row>
          )}
          {simple ? null : (
            <Row keys={t('help.feature.arrange.title')}>{t('help.feature.arrange.body')}</Row>
          )}
          <Row keys={t('help.feature.playhead.title')}>{t('help.feature.playhead.body')}</Row>
          <Row keys={t('help.feature.convert.title')}>{withEsc(t('help.feature.convert.body'))}</Row>
          <Row keys={t('help.feature.worldTools.title')}>{t('help.feature.worldTools.body')}</Row>
          <Row keys={t('help.feature.select.title')}>{t('help.feature.select.body')}</Row>
          <Row keys={t('help.feature.phone.title')}>{t('help.feature.phone.body')}</Row>
          <Row keys={t('help.feature.hover.title')}>{t('help.feature.hover.body')}</Row>
          <Row keys={<Keys keys={['Shift']} then={t('help.scroll')} />}>{t('help.feature.shiftScroll.body')}</Row>
          <Row keys={t('help.feature.panels.title')}>{t('help.feature.panels.body')}</Row>
          <Row keys={t('help.feature.export.title')}>{t('help.feature.export.body')}</Row>
        </dl>
        </HelpFold>
        </div>

        <div className="help-foot">
          <p className="help-credit">
            <button
              type="button"
              className="help-credit-btn"
              onClick={() => {
                setOpen(false)
                window.dispatchEvent(new Event('notetopia-open-about'))
              }}
            >
              {APP_CREDIT} · {t('help.about')}
            </button>
            <button
              type="button"
              className="help-credit-btn"
              onClick={() => {
                setOpen(false)
                window.dispatchEvent(new Event('notetopia-open-announce'))
              }}
            >
              {t('announce.open')}
            </button>
          </p>
          <button type="button" className="btn-tool" onClick={() => setOpen(false)}>
            {t('help.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
