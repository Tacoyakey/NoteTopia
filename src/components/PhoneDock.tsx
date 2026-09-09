import { useSong } from '../context/SongContext'
import { Transport } from './Transport'
import { CircleHelp, Hammer, MousePointer2, Piano } from './icons'
import { useT } from '../i18n/LanguageProvider'
import { useStudioMode } from '../layout/useStudioMode'

export function PhoneDock() {
  const { state, dispatch } = useSong()
  const { t } = useT()
  const { simple } = useStudioMode()
  const composerOpen = !simple && state.mode === 'composer'

  return (
    <nav className="phone-dock" aria-label={t('ui.phoneDock')}>
      <button
        type="button"
        className={`phone-dock-btn ${state.worldTool === 'select' && !composerOpen ? 'active' : ''}`}
        title={t('ui.toolSelectHint')}
        onClick={() => {
          if (composerOpen) dispatch({ type: 'SET_MODE', mode: 'world' })
          dispatch({ type: 'SET_WORLD_TOOL', tool: 'select' })
        }}
      >
        <MousePointer2 size={20} />
        <span>{t('ui.toolSelect')}</span>
      </button>
      <button
        type="button"
        className={`phone-dock-btn ${state.worldTool === 'build' && !composerOpen ? 'active' : ''}`}
        title={t('ui.buildTitle')}
        onClick={() => {
          if (composerOpen) dispatch({ type: 'SET_MODE', mode: 'world' })
          dispatch({ type: 'SET_WORLD_TOOL', tool: 'build' })
        }}
      >
        <Hammer size={20} />
        <span>{t('ui.build')}</span>
      </button>
      <Transport />
      {simple ? null : (
      <button
        type="button"
        className={`phone-dock-btn ${composerOpen ? 'active' : ''}`}
        title={t('ui.composer')}
        data-tour="mode-pills"
        onClick={() =>
          dispatch({ type: 'SET_MODE', mode: composerOpen ? 'world' : 'composer' })
        }
      >
        <Piano size={20} />
        <span>{t('ui.composer')}</span>
      </button>
      )}
      <button
        type="button"
        className="phone-dock-btn"
        title={t('ui.helpTitle')}
        onClick={() => window.dispatchEvent(new Event('music-world-toggle-help'))}
      >
        <CircleHelp size={20} />
        <span>{t('ui.help')}</span>
      </button>
    </nav>
  )
}
