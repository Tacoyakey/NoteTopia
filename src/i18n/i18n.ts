import en from '../../locales/en.json'

export type LocaleCatalog = typeof en
export type LocaleVars = Record<string, string | number>

const STORAGE_KEY = 'notetopia-locale'

const modules = import.meta.glob('../../locales/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>

const catalogs = new Map<string, Record<string, unknown>>()

for (const [path, data] of Object.entries(modules)) {
  const fromFile = path.match(/\/([^/]+)\.json$/)?.[1]
  if (!fromFile || fromFile === 'package') continue
  const meta = data.meta as { code?: string } | undefined
  const code = meta?.code || fromFile
  catalogs.set(code, data)
}

if (!catalogs.has('en')) catalogs.set('en', en as unknown as Record<string, unknown>)

let currentCode = 'en'
let current: Record<string, unknown> = catalogs.get('en') ?? (en as unknown as Record<string, unknown>)
const listeners = new Set<() => void>()

function lookup(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, source)
}

function fill(raw: string, vars?: LocaleVars): string {
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  )
}

export function t(path: string, vars?: LocaleVars): string {
  const local = lookup(current, path)
  const fallback = lookup(en as unknown as Record<string, unknown>, path)
  const raw = typeof local === 'string' ? local : typeof fallback === 'string' ? fallback : path
  return fill(raw, vars)
}

export function tf(path: string, fallback: string, vars?: LocaleVars): string {
  const local = lookup(current, path)
  const fromEn = lookup(en as unknown as Record<string, unknown>, path)
  const raw = typeof local === 'string' ? local : typeof fromEn === 'string' ? fromEn : fallback
  return fill(raw, vars)
}

export function tAll(path: string): string[] {
  const local = lookup(current, path)
  const fallback = lookup(en as unknown as Record<string, unknown>, path)
  const src = Array.isArray(local) ? local : Array.isArray(fallback) ? fallback : []
  return src.filter((item): item is string => typeof item === 'string')
}

export function convertText(id: string, field: 'label' | 'description' | 'hint'): string {
  const fromCurrent = (current.convert as { models?: Record<string, Record<string, string>> } | undefined)
    ?.models?.[id]?.[field]
  if (typeof fromCurrent === 'string') return fromCurrent
  const fromEn = (en.convert.models as Record<string, { label?: string; description?: string; hint?: string }>)[id]?.[field]
  return fromEn ?? ''
}

export function listLocales(): { code: string; name: string; nativeName: string }[] {
  return [...catalogs.entries()]
    .map(([code, data]) => {
      const meta = data.meta as { name?: string; nativeName?: string } | undefined
      return {
        code,
        name: meta?.name || code,
        nativeName: meta?.nativeName || meta?.name || code,
      }
    })
    .sort((a, b) => a.nativeName.localeCompare(b.nativeName))
}

const LOCALE_ALIASES: Record<string, string> = {
  tl: 'fil',
  in: 'id',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'es-mx': 'es',
  'es-es': 'es',
  'zh-tw': 'zh',
  'zh-hant': 'zh',
}

function resolveLocaleCode(code: string): string | undefined {
  const lower = code.toLowerCase()
  const aliased = LOCALE_ALIASES[lower] ?? lower
  if (catalogs.has(aliased)) return aliased
  const short = aliased.split('-')[0]
  const shortAliased = LOCALE_ALIASES[short] ?? short
  if (catalogs.has(shortAliased)) return shortAliased
  return undefined
}

export function getLocale(): string {
  return currentCode
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyLocale(code: string): string {
  const next = resolveLocaleCode(code) ?? (catalogs.has(code) ? code : 'en')
  currentCode = next
  current = catalogs.get(next) ?? (en as unknown as Record<string, unknown>)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
  }
  listeners.forEach((fn) => fn())
  return next
}

export function detectLocale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const resolved = resolveLocaleCode(saved)
      if (resolved) return resolved
    }
  } catch {
    /* ignore */
  }
  if (typeof navigator === 'undefined') return 'en'
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const lang of langs) {
    const resolved = resolveLocaleCode(lang)
    if (resolved) return resolved
  }
  return 'en'
}

export function setLocale(code: string): string {
  const next = applyLocale(code)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  return next
}

applyLocale(typeof window === 'undefined' ? 'en' : detectLocale())
