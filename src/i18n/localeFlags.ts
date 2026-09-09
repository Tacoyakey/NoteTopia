/** ISO 3166-1 alpha-2 used for round flag icons. `rat` is the Ratglish easter egg. */
const LOCALE_FLAG_ISO: Record<string, string> = {
  ar: 'sa',
  de: 'de',
  en: 'us',
  es: 'es',
  et: 'ee',
  fil: 'ph',
  fr: 'fr',
  hi: 'in',
  id: 'id',
  it: 'it',
  ja: 'jp',
  ko: 'kr',
  nl: 'nl',
  pl: 'pl',
  pt: 'br',
  rat: 'rat',
  ru: 'ru',
  th: 'th',
  tr: 'tr',
  vi: 'vn',
  zh: 'cn',
}

export function localeFlagIso(code: string): string {
  return LOCALE_FLAG_ISO[code] ?? 'un'
}
