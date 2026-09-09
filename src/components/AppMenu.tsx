import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from './icons'

export type AppMenuItem = { id: string; label: string; leading?: ReactNode }

export function AppMenu({
  label,
  value,
  items,
  onChange,
  align = 'right',
  triggerClassName = 'app-menu-trigger',
  title,
}: {
  label: string
  value: string
  items: AppMenuItem[]
  onChange: (id: string) => void
  align?: 'left' | 'right'
  triggerClassName?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const menuId = useId()
  const current = items.find((item) => item.id === value) ?? items[0]

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const place = () => {
      const trigger = rootRef.current
      const menu = menuRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const mw = menu?.offsetWidth ?? 248
      const mh = menu?.offsetHeight ?? 200
      let left = align === 'right' ? rect.right - mw : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - mw - 8))
      let top = rect.bottom + 6
      if (top + mh > window.innerHeight - 8) {
        top = Math.max(8, rect.top - mh - 6)
      }
      setPos({ top, left })
    }
    place()
    const frame = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align, items.length, value])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (!current) return null

  return (
    <div ref={rootRef} className={`toolbar-menu app-menu${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={triggerClassName}
        title={title}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {current.leading ? <span className="app-menu-leading">{current.leading}</span> : null}
        <span className="app-menu-value">{current.label}</span>
        <ChevronDown size={12} className="app-menu-chevron" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="toolbar-menu-list app-menu-list"
              role="menu"
              aria-label={label}
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((item) => {
                const selected = item.id === value
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={selected ? 'is-selected' : undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                      onChange(item.id)
                      setOpen(false)
                    }}
                  >
                    <span className="tool-dropdown-check" aria-hidden>
                      {selected ? <Check size={12} /> : null}
                    </span>
                    {item.leading ? <span className="app-menu-leading">{item.leading}</span> : null}
                    {item.label}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
