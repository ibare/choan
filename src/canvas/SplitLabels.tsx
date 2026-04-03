// Split mode numbered labels — shows 1, 2, 3... in each split section.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import type { ChoanElement } from '../store/useChoanStore'
import { useChoanStore } from '../store/useChoanStore'
import { pixelToWorld } from '../coords/coordinateSystem'
import { useRenderSettings } from '../store/useRenderSettings'

interface SplitLabelsProps {
  splitModeRef: MutableRefObject<{ active: boolean; count: number; elementId: string; direction: 'horizontal' | 'vertical' }>
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  rendererRef: MutableRefObject<SDFRenderer | null>
}

interface LabelPos { x: number; y: number; num: number }

export default function SplitLabels({ splitModeRef, canvasSizeRef, rendererRef }: SplitLabelsProps) {
  const [labels, setLabels] = useState<LabelPos[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    let prevKey = ''
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const { active, count, elementId, direction } = splitModeRef.current
      const key = `${active}:${count}:${elementId}:${direction}`
      if (key === prevKey) return
      prevKey = key

      if (!active || count < 1) { setLabels([]); return }

      const renderer = rendererRef.current
      const el = useChoanStore.getState().elements.find((e: ChoanElement) => e.id === elementId)
      if (!el || !renderer) { setLabels([]); return }

      const rs = useRenderSettings.getState()
      const z = el.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.02
      const dpr = window.devicePixelRatio || 1
      const isH = direction === 'horizontal'

      const result: LabelPos[] = []
      for (let i = 0; i < count; i++) {
        let cx: number, cy: number
        if (isH) {
          const sliceW = el.width / count
          cx = el.x + sliceW * i + sliceW / 2
          cy = el.y + el.height / 2
        } else {
          const sliceH = el.height / count
          cx = el.x + el.width / 2
          cy = el.y + sliceH * i + sliceH / 2
        }
        const [wx, wy] = pixelToWorld(cx, cy)
        const screen = renderer.overlay.projectToScreen(wx, wy, z)
        result.push({ x: screen.px / dpr, y: screen.py / dpr, num: i + 1 })
      }
      setLabels(result)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [splitModeRef, canvasSizeRef, rendererRef])

  if (labels.length === 0) return null

  return (
    <>
      {labels.map((l) => (
        <div key={l.num} className="split-label" style={{ left: l.x, top: l.y }}>
          {l.num}
        </div>
      ))}
    </>
  )
}
