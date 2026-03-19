// Draw-to-create — creates and resizes elements while drawing.

import type { ChoanElement } from '../store/useChoanStore'
import { detectContainment } from '../layout/containment'
import { MIN_ELEMENT_SIZE } from '../constants'
import { DEFAULT_SIZE } from './elementHelpers'
import { FRAME_PRESETS } from '../engine/painters'

/** Resize the in-progress drawn element to fit the current drag position. */
export function handleDrawMove(
  pixel: { x: number; y: number },
  drawStartPixel: { x: number; y: number },
  drawElId: string,
  update: (id: string, patch: Partial<ChoanElement>) => void,
  elements?: ChoanElement[],
): void {
  const sx = drawStartPixel.x, sy = drawStartPixel.y
  let w = Math.max(MIN_ELEMENT_SIZE, Math.abs(pixel.x - sx))
  let h = Math.max(MIN_ELEMENT_SIZE, Math.abs(pixel.y - sy))

  // Frame: lock aspect ratio during draw
  const el = elements?.find((e) => e.id === drawElId)
  if (el?.frame) {
    const preset = FRAME_PRESETS[el.frame]
    if (preset) {
      if (w / h > preset.ratio) w = h * preset.ratio
      else h = w / preset.ratio
    }
  }

  update(drawElId, {
    x: Math.min(sx, sx + (pixel.x > sx ? 0 : -w)),
    y: Math.min(sy, sy + (pixel.y > sy ? 0 : -h)),
    width: w, height: h,
  })
}

/**
 * Finalize the drawn element: apply default size if barely dragged,
 * then check for containment. Returns parentId if containment was detected.
 */
export function finalizeDrawn(
  drawElId: string,
  drawStartPixel: { x: number; y: number },
  getElements: () => ChoanElement[],
  updateElement: (id: string, patch: Partial<ChoanElement>) => void,
  reparentElement: (id: string, parentId: string | null) => void,
): void {
  const els = getElements()
  const el = els.find((e) => e.id === drawElId)
  if (!el) return
  if (el.width <= MIN_ELEMENT_SIZE && el.height <= MIN_ELEMENT_SIZE) {
    const size = DEFAULT_SIZE[el.type] ?? { w: 100, h: 100 }
    const sx = drawStartPixel.x, sy = drawStartPixel.y
    updateElement(drawElId, { x: sx - size.w / 2, y: sy - size.h / 2, width: size.w, height: size.h })
  }
  const freshEls = getElements()
  const freshEl = freshEls.find((e) => e.id === drawElId)
  if (freshEl) {
    const parentId = detectContainment(freshEl, freshEls.filter((e) => e.role === 'container' && e.id !== drawElId))
    if (parentId) reparentElement(drawElId, parentId)
  }
}
