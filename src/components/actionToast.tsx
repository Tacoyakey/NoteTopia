import { useEffect, useState } from 'react'

type Listener = (message: string | null) => void

const listeners = new Set<Listener>()
let hideTimer = 0

export function subscribeActionToast(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function shouldToast(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(hover: none)').matches) return true
  return !!document.querySelector('.app.is-phone')
}

function emit(message: string | null): void {
  for (const fn of listeners) fn(message)
}

/** Short confirmation on touch / phone, where hover names never appear. */
export function showActionToast(message: string): void {
  if (!message || !shouldToast()) return
  emit(message)
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => emit(null), 1500)
}

export function ActionToastHost() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => subscribeActionToast(setMessage), [])
  if (!message) return null
  return (
    <div className="action-toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
