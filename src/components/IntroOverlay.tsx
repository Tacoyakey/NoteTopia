import { LayoutGrid, Piano } from './icons'
import { LanguageSelect } from '../i18n/LanguageSelect'
import { useT } from '../i18n/LanguageProvider'
import { APP_NAME } from '../branding'
import type { StudioMode } from '../layout/studioMode'

export function IntroOverlay({
  onChoose,
}: {
  onChoose: (mode: StudioMode) => void
}) {
  const { t } = useT()

  return (
    <div className="help-overlay intro-overlay">
      <div className="help-panel intro-panel" role="dialog" aria-labelledby="intro-title">
        <div className="help-header">
          <h3 id="intro-title">{t('intro.title', { name: APP_NAME })}</h3>
          <LanguageSelect compact />
        </div>
        <p className="help-lead">{t('intro.lead')}</p>
        <div className="intro-choices">
          <button type="button" className="intro-choice" onClick={() => onChoose('simple')}>
            <LayoutGrid size={22} />
            <span className="intro-choice-name">{t('intro.simpleName')}</span>
            <span className="intro-choice-lead">{t('intro.simpleLead')}</span>
            <span className="intro-choice-body">{t('intro.simpleBody')}</span>
          </button>
          <button type="button" className="intro-choice" onClick={() => onChoose('studio')}>
            <Piano size={22} />
            <span className="intro-choice-name">{t('intro.studioName')}</span>
            <span className="intro-choice-lead">{t('intro.studioLead')}</span>
            <span className="intro-choice-body">{t('intro.studioBody')}</span>
          </button>
        </div>
        <p className="intro-foot">{t('intro.later')}</p>
      </div>
    </div>
  )
}
