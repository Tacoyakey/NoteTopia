/** Narrow phones, landscape phones, and coarse pointers on compact widths. */
export function isPhoneLayout(input: {
  width: number
  height: number
  coarse?: boolean
}): boolean {
  const { width, height, coarse = false } = input
  if (width <= 720) return true
  if (coarse && width <= 920) return true
  if (height <= 540 && width > height) return true
  return false
}

export function readPhoneLayout(win: {
  innerWidth: number
  innerHeight: number
  matchMedia: (query: string) => { matches: boolean }
}): boolean {
  return isPhoneLayout({
    width: win.innerWidth,
    height: win.innerHeight,
    coarse: win.matchMedia('(pointer: coarse)').matches,
  })
}
