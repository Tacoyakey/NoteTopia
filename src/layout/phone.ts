/** iPhone, iPod, and Android *phones* (not tablets). */
const PHONE_UA =
  /iPhone|iPod|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini|Android.+Mobile|Mobile\/\w+\s+Safari|CriOS|FxiOS/i

export function isPhoneUserAgent(ua: string): boolean {
  return PHONE_UA.test(ua)
}

/** Narrow phones, landscape phones, and coarse pointers on compact widths — iOS and Android. */
export function isPhoneLayout(input: {
  width: number
  height: number
  coarse?: boolean
  hoverNone?: boolean
  maxTouchPoints?: number
  ua?: string
}): boolean {
  const {
    width,
    height,
    coarse = false,
    hoverNone = false,
    maxTouchPoints = 0,
    ua = '',
  } = input
  if (isPhoneUserAgent(ua)) return true
  if (width <= 720) return true
  if (height <= 540 && width > height) return true
  const touchy = coarse || hoverNone || maxTouchPoints > 0
  if (touchy && Math.min(width, height) <= 920) return true
  return false
}

export function readPhoneLayout(win: {
  innerWidth: number
  innerHeight: number
  matchMedia: (query: string) => { matches: boolean }
  navigator?: { userAgent?: string; maxTouchPoints?: number }
}): boolean {
  return isPhoneLayout({
    width: win.innerWidth,
    height: win.innerHeight,
    coarse: win.matchMedia('(pointer: coarse)').matches,
    hoverNone: win.matchMedia('(hover: none)').matches,
    maxTouchPoints: win.navigator?.maxTouchPoints ?? 0,
    ua: win.navigator?.userAgent ?? '',
  })
}
