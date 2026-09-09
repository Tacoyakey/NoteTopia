import { AppMenu } from '../components/AppMenu'
import { LangFlag } from './LangFlag'
import { useT } from './LanguageProvider'

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, locales, t } = useT()
  return (
    <div className={`lang-select ${compact ? 'lang-select-compact' : ''}`}>
      {compact ? null : <span>{t('ui.language')}</span>}
      <AppMenu
        label={t('ui.language')}
        value={locale}
        items={locales.map((item) => ({
          id: item.code,
          label: item.nativeName,
          leading: <LangFlag code={item.code} />,
        }))}
        onChange={setLocale}
      />
    </div>
  )
}
