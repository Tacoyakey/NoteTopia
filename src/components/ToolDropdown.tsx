import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from './icons'
import { placePopover } from '../dom/placePopover'

export type ToolDropdownItem<T extends string> = {
  id: T
  icon: ComponentType<{ size?: number }>
  label: string
  title?: string
}

export function ToolDropdown<T extends string>({
  items,
  value,
  onChange,
  label,
  drop = 'down',
  align = 'left',
  iconOnly = false,
}: {
  items: readonly ToolDropdownItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  drop?: 'up' | 'down'
  align?: 'left' | 'right'
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const menuId = useId()
  const current = items.find((item) => item.id === value) ?? items[0]
  const Icon = current?.icon

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
          drop,
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
  }, [open, align, drop, items.length, value])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!current || !Icon) return null

  return (
    <div
      ref={rootRef}
      className={`tool-dropdown${open ? ' is-open' : ''}${drop === 'up' ? ' drops-up' : ''}${align === 'right' ? ' align-right' : ''}`}
    >
      <button
        type="button"
        className={`tool-dropdown-trigger${iconOnly ? ' is-icon-only' : ''}`}
        data-tip={current.label}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon size={16} />
        {iconOnly ? null : <span className="tool-dropdown-label">{current.label}</span>}
        <ChevronDown size={12} className="tool-dropdown-chevron" />
      </button>
      {open
        ? createPortal(
            <ul
              ref={menuRef}
              id={menuId}
              className={`tool-dropdown-menu is-portal${drop === 'up' ? ' drops-up' : ''}`}
              role="listbox"
              aria-label={label}
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((item) => {
                const ItemIcon = item.icon
                const selected = item.id === value
                return (
                  <li key={item.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={selected ? 'is-selected' : undefined}
                      title={item.title}
                      onClick={() => {
                        onChange(item.id)
                        setOpen(false)
                      }}
                    >
                      <span className="tool-dropdown-check" aria-hidden>
                        {selected ? <Check size={12} /> : null}
                      </span>
                      <ItemIcon size={15} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
