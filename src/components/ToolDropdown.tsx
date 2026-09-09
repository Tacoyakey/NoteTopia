import { useEffect, useId, useRef, useState, type ComponentType } from 'react'
import { Check, ChevronDown } from './icons'

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
  const menuId = useId()
  const current = items.find((item) => item.id === value) ?? items[0]
  const Icon = current?.icon

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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
      {open ? (
        <ul id={menuId} className="tool-dropdown-menu" role="listbox" aria-label={label}>
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
        </ul>
      ) : null}
    </div>
  )
}
