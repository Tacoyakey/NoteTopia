import { useEffect } from 'react'
import { applyAppViewportHeight, visibleViewportHeight } from './appViewport'

/** Keep --app-height on :root in sync with the visible viewport (Safari URL bar). */
export function useAppViewportHeight(): void {
  useEffect(() => {
    const apply = () => {
      applyAppViewportHeight(document.documentElement.style, visibleViewportHeight(window))
    }
    apply()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', apply)
    viewport?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      viewport?.removeEventListener('resize', apply)
      viewport?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [])
}
