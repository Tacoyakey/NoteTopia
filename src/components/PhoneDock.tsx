import { useSong } from '../context/SongContext'
import { Transport } from './Transport'
import { CircleHelp, Hammer, MousePointer2, Piano } from './icons'
import { useT } from '../i18n/LanguageProvider'
import { useStudioMode } from '../layout/useStudioMode'
import { showPhoneFloat, togglePhoneFloat, usePhoneFloatOpen } from '../layout/phoneFloat'

type DockTab = 'select' | 'build' | 'composer'

export function PhoneDock() {
  const { state, dispatch } = useSong()
  const { t } = useT()
  const { simple } = useStudioMode()
  const composerOpen = !simple && state.mode === 'composer'
  const floatOpen = usePhoneFloatOpen()
  const tab: DockTab | null = composerOpen
    ? 'composer'
    : state.worldTool === 'build'
      ? 'build'
      : state.worldTool === 'select'
        ? 'select'
        : null

  const activate = (next: DockTab) => {
    if (tab === next) {
      togglePhoneFloat()
      return
    }
    showPhoneFloat()
    if (next === 'composer') {
      dispatch({ type: 'SET_MODE', mode: 'composer' })
      return
    }
    if (composerOpen) dispatch({ type: 'SET_MODE', mode: 'world' })
    dispatch({ type: 'SET_WORLD_TOOL', tool: next })
  }

  const tabTitle = (id: DockTab, idle: string) => {
    if (tab !== id) return idle
    return floatOpen ? t('ui.hidePhoneFloat') : t('ui.showPhoneFloat')
  }

  return (
    <nav className="phone-dock" aria-label={t('ui.phoneDock')} data-tour="phone-dock">
      <button
        type="button"
        className={`phone-dock-btn ${tab === 'select' ? 'active' : ''}`}
        title={tabTitle('select', t('ui.toolSelectHint'))}
        aria-expanded={tab === 'select' ? floatOpen : undefined}
        aria-controls={tab === 'select' ? 'phone-float-bar' : undefined}
        onClick={() => activate('select')}
      >
        <MousePointer2 size={20} />
        <span>{t('ui.toolSelect')}</span>
      </button>
      <button
        type="button"
        className={`phone-dock-btn ${tab === 'build' ? 'active' : ''}`}
        title={tabTitle('build', t('ui.buildTitle'))}
        aria-expanded={tab === 'build' ? floatOpen : undefined}
        aria-controls={tab === 'build' ? 'phone-float-bar' : undefined}
        onClick={() => activate('build')}
      >
        <Hammer size={20} />
        <span>{t('ui.build')}</span>
      </button>
      <Transport />
      {simple ? null : (
      <button
        type="button"
        className={`phone-dock-btn ${tab === 'composer' ? 'active' : ''}`}
        title={tabTitle('composer', t('ui.composer'))}
        data-tour="mode-pills"
        aria-expanded={tab === 'composer' ? floatOpen : undefined}
        aria-controls={tab === 'composer' ? 'phone-float-bar' : undefined}
        onClick={() => activate('composer')}
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
