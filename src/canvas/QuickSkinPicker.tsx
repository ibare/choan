// Quick Skin Picker — macOS Alt-Tab style overlay for fast skin selection.
// Triggered by S key, renders centered over the canvas.

import { useEffect, useRef } from 'react'
import { SKIN_REGISTRY } from '../config/skins'
import { useChoanStore } from '../store/useChoanStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function QuickSkinPicker({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const { setTool, setPendingSkin, setPendingFrame } = useChoanStore()

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSelect = (skinId: string) => {
    setTool('rectangle')
    setPendingFrame(null)
    setPendingSkin(skinId)
    onClose()
  }

  if (!open) return null

  return (
    <div className="qsp-overlay" ref={overlayRef} onClick={handleBackdropClick}>
      <div className="qsp-panel">
        <div className="qsp-header">Select Skin Component</div>
        <div className="qsp-grid">
          {SKIN_REGISTRY.map(({ id, label, Icon }) => (
            <button key={id} className="qsp-item" onClick={() => handleSelect(id)}>
              <div className="qsp-item__icon">
                <Icon size={28} />
              </div>
              <span className="qsp-item__label">{label}</span>
            </button>
          ))}
        </div>
        <div className="qsp-hint">Press S again or ESC to close</div>
      </div>
    </div>
  )
}
