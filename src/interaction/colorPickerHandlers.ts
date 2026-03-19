// Color picker interaction — screen-space hit testing against color wheel texture.

import type { ChoanElement } from '../store/useChoanStore'
import { applyToSiblings } from './elementHelpers'
import { useUIStore } from '../store/useUIStore'
import type { ColorWheelTexture } from '../engine/colorWheel'

/** Returns true if a color swatch was clicked and color was applied. */
export function handleColorPickerClick(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
  elements: ChoanElement[],
  selectedId: string,
  altKey: boolean,
  update: (id: string, patch: Partial<ChoanElement>) => void,
  colorWheel: ColorWheelTexture,
): boolean {
  const wheelSizePx = colorWheel.size * dpr * 0.9
  const localX = (mouseCanvasPx.x - anchorCanvasPx.x) / (wheelSizePx * 2) + 0.5
  const localY = (mouseCanvasPx.y - anchorCanvasPx.y) / (wheelSizePx * 2) + 0.5

  const hit = colorWheel.hitTest(localX, localY)
  if (!hit) return false

  applyToSiblings(update, elements, selectedId, { color: hit.hex }, altKey)
  useUIStore.getState().setDrawColor(hit.hex)
  return true
}

/** Returns hover index (fi*ringCount+si), or -1 if none. */
export function computeColorPickerHover(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
  colorWheel: ColorWheelTexture,
): number {
  const wheelSizePx = colorWheel.size * dpr * 0.9
  const localX = (mouseCanvasPx.x - anchorCanvasPx.x) / (wheelSizePx * 2) + 0.5
  const localY = (mouseCanvasPx.y - anchorCanvasPx.y) / (wheelSizePx * 2) + 0.5

  const hit = colorWheel.hitTest(localX, localY)
  if (!hit) return -1
  return hit.fi * colorWheel.ringCount + hit.si
}
