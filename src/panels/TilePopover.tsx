// Tile grid popover — reusable selector with preview tiles.

import { useState, useRef, useEffect } from 'react'
// search removed — kept useState for open state

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
}

export default function TilePopover({ items, value, onChange, columns = 6, placeholder = 'Select...' }: TilePopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const current = items.find((i) => i.value === value)

  return (
    <div ref={ref} className="tile-popover-wrap">
      <button className="tile-popover-trigger" onClick={() => setOpen(!open)}>
        {current?.icon && <span className="tile-popover-preview">{current.icon}</span>}
        <span>{current?.label || placeholder}</span>
      </button>
      {open && (
        <div className="tile-popover">
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
        </div>
      )}
    </div>
  )
}
