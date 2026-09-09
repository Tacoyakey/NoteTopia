import { localeFlagIso } from './localeFlags'

export function LangFlag({ code, size = 18 }: { code: string; size?: number }) {
  const iso = localeFlagIso(code)
  return (
    <img
      className="lang-flag"
      src={`/flags/${iso}.svg`}
      width={size}
      height={size}
      alt=""
      draggable={false}
      aria-hidden
    />
  )
}
