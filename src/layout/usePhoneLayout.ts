import { useEffect, useState } from 'react'
import { readPhoneLayout } from './phone'

export function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window === 'undefined' ? false : readPhoneLayout(window),
  )

  useEffect(() => {
    const sync = () => setPhone(readPhoneLayout(window))
    const mq = window.matchMedia('(pointer: coarse)')
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    mq.addEventListener('change', sync)
    sync()
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      mq.removeEventListener('change', sync)
    }
  }, [])

  return phone
}
