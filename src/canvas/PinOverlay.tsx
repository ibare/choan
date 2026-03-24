// Sizing mode toggle for layout children — cycles equal → fill → fixed-px.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { pixelToWorld } from '../coords/coordinateSystem'
import { PushPin, ArrowsOutSimple } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { Tooltip } from '../components/ui/Tooltip'

interface PinOverlayProps {
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  rendererRef: MutableRefObject<SDFRenderer | null>
}

type SizingMode = 'equal' | 'fill' | 'fixed-ratio' | 'fixed-px'
const CYCLE: SizingMode[] = ['equal', 'fill', 'fixed-px']

function nextMode(current: SizingMode): SizingMode {
  // fixed-ratio is set by handle drag, not by clicking — treat as fixed-px in cycle
  const mapped = current === 'fixed-ratio' ? 'fixed-px' : current
  const idx = CYCLE.indexOf(mapped)
  return CYCLE[(idx + 1) % CYCLE.length]
}

interface PinPos { id: string; x: number; y: number; sizing: SizingMode }

export default function PinOverlay({ canvasSizeRef, rendererRef }: PinOverlayProps) {
  const [pins, setPins] = useState<PinPos[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const { elements, selectedIds } = useChoanStore.getState()
      if (selectedIds.length !== 1) { setPins([]); return }

      const container = elements.find((e) => e.id === selectedIds[0])
      if (!container || (container.layoutDirection !== 'row' && container.layoutDirection !== 'column')) {
        setPins([]); return
      }

      const renderer = rendererRef.current
      if (!renderer) return

      const children = elements.filter((e) => e.parentId === container.id)
      // Always recalculate — camera zoom changes projectToScreen results

      const { w, h } = canvasSizeRef.current
      const rs = useRenderSettings.getState()
      const dpr = window.devicePixelRatio || 1

      const result: PinPos[] = []
      for (const child of children) {
        const z = child.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.03
        const [wx, wy] = pixelToWorld(child.x + child.width - 8, child.y + 8, w, h)
        const screen = renderer.overlay.projectToScreen(wx, wy, z)
        result.push({ id: child.id, x: screen.px / dpr, y: screen.py / dpr, sizing: child.layoutSizing ?? 'equal' })
      }
      setPins(result)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasSizeRef, rendererRef])

  if (pins.length === 0) return null

  return (
    <>
      {pins.map((p) => {
        const isActive = p.sizing !== 'equal'
        return (
          <Tooltip content={p.sizing}>
            <Button
              key={p.id}
              className="pin-button"
              active={isActive}
              style={{ left: p.x, top: p.y }}
              onClick={() => {
                const store = useChoanStore.getState()
                const next = nextMode(p.sizing)
                store.updateElement(p.id, { layoutSizing: next, layoutRatio: undefined })
                const el = store.elements.find((e) => e.id === p.id)
                if (el?.parentId) store.runLayout(el.parentId)
              }}
            >
              {p.sizing === 'fill' && <ArrowsOutSimple size={12} weight="bold" />}
              {(p.sizing === 'fixed-px' || p.sizing === 'fixed-ratio') && <PushPin size={12} weight="fill" />}
            </Button>
          </Tooltip>
        )
      })}
    </>
  )
}
