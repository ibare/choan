// Color picker interaction — screen-space hit testing against color wheel cells.
// Uses the same cell center projection as rendering for pixel-perfect accuracy.

import { COLOR_FAMILIES } from '../config/materials'
import { applyToSiblings } from './elementHelpers'
import { useUIStore } from '../store/useUIStore'
import type { ColorWheelTexture } from '../engine/colorWheel'

const SHADE_COUNT = COLOR_FAMILIES[0].shades.length

function findClosestCell(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
  colorWheel: ColorWheelTexture,
): { fi: number; si: number; hex: number } | null {
  const wheelSizePx = colorWheel.size * dpr * 0.9
  const familyCount = COLOR_FAMILIES.length
  let bestDist = Infinity
  let bestResult: { fi: number; si: number; hex: number } | null = null

  for (let fi = 0; fi < familyCount; fi++) {
    for (let si = 0; si < SHADE_COUNT; si++) {
      const cell = colorWheel.getCellCenter(fi, si)
      // cell.x/y are 0~1 in the wheel texture, convert to canvas pixel offset from anchor
      const cx = anchorCanvasPx.x + (cell.x - 0.5) * wheelSizePx
      const cy = anchorCanvasPx.y + (cell.y - 0.5) * wheelSizePx
      const dx = mouseCanvasPx.x - cx
      const dy = mouseCanvasPx.y - cy
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        bestResult = { fi, si, hex: COLOR_FAMILIES[fi].shades[si] }
      }
    }
  }

  // Max hit radius — don't select if too far from any cell
  const maxR = wheelSizePx * 0.08
  if (bestDist > maxR * maxR) return null
  return bestResult
}

/** Returns true if a color swatch was clicked and color was applied. */
export function handleColorPickerClick(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
  elements: import('../store/useChoanStore').ChoanElement[],
  selectedId: string,
  altKey: boolean,
  update: (id: string, patch: Partial<import('../store/useChoanStore').ChoanElement>) => void,
  colorWheel: ColorWheelTexture,
): boolean {
  const hit = findClosestCell(mouseCanvasPx, anchorCanvasPx, dpr, colorWheel)
  if (!hit) return false
  applyToSiblings(update, elements, selectedId, { color: hit.hex }, altKey)
  useUIStore.getState().setDrawColor(hit.hex)
  return true
}

/** Returns hover index (fi*SHADE_COUNT+si), or -1 if none. */
export function computeColorPickerHover(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
  colorWheel: ColorWheelTexture,
): number {
  const hit = findClosestCell(mouseCanvasPx, anchorCanvasPx, dpr, colorWheel)
  if (!hit) return -1
  return hit.fi * SHADE_COUNT + hit.si
}
