// Tile grid popover — reusable selector with preview tiles.
// Uses React Portal to render outside parent overflow constraints.

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface TileItem {
  value: string
  label: string
  icon?: React.ReactNode
}

interface TilePopoverProps {
  items: TileItem[]
  value: string
  onChange: (value: string) => void
  columns?: number
  placeholder?: string
  layout?: 'dropdown' | 'panel'  // dropdown = below trigger, panel = left side full height
}

export default function TilePopover({ items, value, onChange, columns = 6, placeholder = 'Select...', layout = 'dropdown' }: TilePopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      if (layout === 'panel') {
        const popW = Math.min(rect.left - 8, 380)
        setStyle({ top: 44, left: rect.left - popW - 4, bottom: 8, width: popW })
      } else {
        setStyle({ top: rect.bottom + 4, left: rect.left, maxHeight: 360 })
      }
    }
    setOpen(!open)
  }

  const current = items.find((i) => i.value === value)

  return (
    <div className="tile-popover-wrap">
      <button ref={triggerRef} className="tile-popover-trigger" onClick={handleOpen}>
        {current?.icon && <span className="tile-popover-preview">{current.icon}</span>}
        <span>{current?.label || placeholder}</span>
      </button>
      {open && createPortal(
        <div ref={popoverRef} className="tile-popover" style={style}>
          <div className="tile-popover-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {items.map((item) => (
              <button
                key={item.value}
                className={`tile-popover-item ${item.value === value ? 'active' : ''}`}
                title={item.label}
                onClick={() => { onChange(item.value); setOpen(false) }}
              >
                {item.icon && <span className="tile-popover-icon">{item.icon}</span>}
                <span className="tile-popover-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
