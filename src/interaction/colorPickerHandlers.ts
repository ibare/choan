// Color picker interaction — screen-space hit testing.
// Swatch positions are computed in canvas pixels (DPR-scaled) to match
// the screen-space rendering in overlayCommands.ts.

import type { ChoanElement } from '../store/useChoanStore'
import { COLOR_FAMILIES } from '../canvas/materials'
import { applyToSiblings } from './elementHelpers'
import { useUIStore } from '../store/useUIStore'
import {
  COLOR_PICKER_HIT_RADIUS, COLOR_PICKER_RING_BASE, COLOR_PICKER_RING_STEP,
} from '../constants'

function swatchScreen(fi: number, si: number, anchorPx: number, anchorPy: number, dpr: number): { sx: number; sy: number } {
  const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
  const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * dpr
  return { sx: anchorPx + Math.cos(angle) * ring, sy: anchorPy - Math.sin(angle) * ring }
}

/** Returns true if a color swatch was clicked and color was applied. */
export function handleColorPickerClick(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
  elements: ChoanElement[],
  selectedId: string,
  altKey: boolean,
  update: (id: string, patch: Partial<ChoanElement>) => void,
): boolean {
  const hitR = COLOR_PICKER_HIT_RADIUS * dpr
  for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
    for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
      const { sx, sy } = swatchScreen(fi, si, anchorCanvasPx.x, anchorCanvasPx.y, dpr)
      const dx = mouseCanvasPx.x - sx, dy = mouseCanvasPx.y - sy
      if (dx * dx + dy * dy <= hitR * hitR) {
        const chosenColor = COLOR_FAMILIES[fi].shades[si]
        applyToSiblings(update, elements, selectedId, { color: chosenColor }, altKey)
        useUIStore.getState().setDrawColor(chosenColor)
        return true
      }
    }
  }
  return false
}

/** Returns hover index (fi*5+si), or -1 if none. */
export function computeColorPickerHover(
  mouseCanvasPx: { x: number; y: number },
  anchorCanvasPx: { x: number; y: number },
  dpr: number,
): number {
  const hitR = COLOR_PICKER_HIT_RADIUS * dpr
  for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
    for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
      const { sx, sy } = swatchScreen(fi, si, anchorCanvasPx.x, anchorCanvasPx.y, dpr)
      const dx = mouseCanvasPx.x - sx, dy = mouseCanvasPx.y - sy
      if (dx * dx + dy * dy <= hitR * hitR) return fi * 5 + si
    }
  }
  return -1
}
