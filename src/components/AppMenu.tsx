import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from './icons'
import { placePopover } from '../dom/placePopover'

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
      setPos(
        placePopover({
          trigger: rect,
          width: menu?.offsetWidth ?? 248,
          height: menu?.offsetHeight ?? 200,
          align,
          drop: 'down',
        }),
      )
    }
    place()
    const frame = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
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
