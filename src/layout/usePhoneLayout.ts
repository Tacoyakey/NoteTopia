import { useEffect, useState } from 'react'
import { readPhoneLayout } from './phone'

export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window === 'undefined' ? false : readPhoneLayout(window),
  )

  useEffect(() => {
    const sync = () => setPhone(readPhoneLayout(window))
    const coarse = window.matchMedia('(pointer: coarse)')
    const hover = window.matchMedia('(hover: none)')
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    coarse.addEventListener('change', sync)
    hover.addEventListener('change', sync)
    sync()
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      coarse.removeEventListener('change', sync)
      hover.removeEventListener('change', sync)
    }
  }, [])

  return phone
}
