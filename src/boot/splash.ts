export function dismissBootSplash(minMs = 480): void {
  const el = document.getElementById('boot-splash')
  if (!el) return
  const started = Number((window as Window & { __notetopiaBoot?: number }).__notetopiaBoot) || 0
  const wait = Math.max(0, minMs - (Date.now() - started))
  window.setTimeout(() => {
    el.classList.add('boot-splash-out')
    window.setTimeout(() => el.remove(), 280)
  }, wait)
}
