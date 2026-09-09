import type { ReactNode } from 'react'
import { TriangleAlert } from './icons'

export function WarnNote({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={['warn-note', className].filter(Boolean).join(' ')}>
      <TriangleAlert size={14} strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </p>
  )
}
