import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { getLocale, listLocales, setLocale as commitLocale, subscribeLocale, t as translate } from './i18n'

interface LocaleContextValue {
  locale: string
  t: typeof translate
  setLocale: (code: string) => void
  locales: { code: string; name: string; nativeName: string }[]
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, () => 'en')
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: translate,
      setLocale: commitLocale,
      locales: listLocales(),
    }),
    [locale],
  )
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useT(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useT must be used within LanguageProvider')
  return ctx
}
