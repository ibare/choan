// Pin toggle icons for layout children — shown when a row/column container is selected.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { pixelToWorld } from '../coords/coordinateSystem'
import { PushPin } from '@phosphor-icons/react'

interface PinOverlayProps {
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  rendererRef: MutableRefObject<SDFRenderer | null>
}

interface PinPos { id: string; x: number; y: number; pinned: boolean }

export default function PinOverlay({ canvasSizeRef, rendererRef }: PinOverlayProps) {
  const [pins, setPins] = useState<PinPos[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    let prevKey = ''
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const { elements, selectedIds } = useChoanStore.getState()
      if (selectedIds.length !== 1) { if (prevKey !== '') { setPins([]); prevKey = '' }; return }

      const container = elements.find((e) => e.id === selectedIds[0])
      if (!container || (container.layoutDirection !== 'row' && container.layoutDirection !== 'column')) {
        if (prevKey !== '') { setPins([]); prevKey = '' }; return
      }

      const renderer = rendererRef.current
      if (!renderer) return

      const children = elements.filter((e) => e.parentId === container.id)
      const key = children.map((c) => `${c.id}:${c.x}:${c.y}:${c.width}:${c.height}:${c.layoutSizing}`).join('|')
      if (key === prevKey) return
      prevKey = key

      const { w, h } = canvasSizeRef.current
      const rs = useRenderSettings.getState()
      const dpr = window.devicePixelRatio || 1

      const result: PinPos[] = []
      for (const child of children) {
        const z = child.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.03
        const [wx, wy] = pixelToWorld(child.x + child.width - 8, child.y + 8, w, h)
        const screen = renderer.overlay.projectToScreen(wx, wy, z)
        result.push({ id: child.id, x: screen.px / dpr, y: screen.py / dpr, pinned: child.layoutSizing === 'fixed-px' })
      }
      setPins(result)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasSizeRef, rendererRef])

  if (pins.length === 0) return null

  return (
    <>
      {pins.map((p) => (
        <button
          key={p.id}
          className={`pin-button ${p.pinned ? 'active' : ''}`}
          style={{ left: p.x, top: p.y }}
          onClick={() => {
            const store = useChoanStore.getState()
            const newSizing = p.pinned ? 'equal' : 'fixed-px'
            store.updateElement(p.id, { layoutSizing: newSizing, layoutRatio: undefined })
            const el = store.elements.find((e) => e.id === p.id)
            if (el?.parentId) store.runLayout(el.parentId)
          }}
        >
          <PushPin size={12} weight={p.pinned ? 'fill' : 'regular'} />
        </button>
      ))}
    </>
  )
}
