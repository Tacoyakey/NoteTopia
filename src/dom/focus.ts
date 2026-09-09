export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true
  return target.isContentEditable
}

/** True when Tab should move focus instead of switching Composer/World. */
export function isTabbableControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isTypingTarget(target)) return true
  const tag = target.tagName
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'OPTION') return true
  const role = target.getAttribute('role')
  if (role === 'button' || role === 'slider' || role === 'option' || role === 'listbox' || role === 'tab') {
    return true
  }
  return target.tabIndex >= 0
}
