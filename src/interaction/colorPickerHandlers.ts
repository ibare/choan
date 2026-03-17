// Color picker interaction — pure functions, no React hooks.

import type { ChoanElement } from '../store/useChoanStore'
import { COLOR_FAMILIES } from '../canvas/materials'
import { applyToSiblings } from './elementHelpers'
import {
  COLOR_PICKER_HIT_RADIUS, COLOR_PICKER_RING_BASE, COLOR_PICKER_RING_STEP,
} from '../constants'

function swatch(fi: number, si: number, ax: number, ay: number, zs: number): { sx: number; sy: number } {
  const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
  const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * zs
  return { sx: ax + Math.cos(angle) * ring, sy: ay + Math.sin(angle) * ring }
}

/** Returns true if a color swatch was clicked and color was applied. */
export function handleColorPickerClick(
  pixel: { x: number; y: number },
  elements: ChoanElement[],
  selectedId: string,
  altKey: boolean,
  zoomScale: number,
  update: (id: string, patch: Partial<ChoanElement>) => void,
): boolean {
  const el = elements.find((e) => e.id === selectedId)
  if (!el) return false
  const ax = el.x + el.width, ay = el.y
  const hitR = COLOR_PICKER_HIT_RADIUS * zoomScale
  for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
    for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
      const { sx, sy } = swatch(fi, si, ax, ay, zoomScale)
      const dx = pixel.x - sx, dy = pixel.y - sy
      if (dx * dx + dy * dy <= hitR * hitR) {
        applyToSiblings(update, elements, selectedId, { color: COLOR_FAMILIES[fi].shades[si] }, altKey)
        return true
      }
    }
  }
  return false
}

/** Returns hover index (fi*5+si), or -1 if none. */
export function computeColorPickerHover(
  pixel: { x: number; y: number },
  elements: ChoanElement[],
  selectedId: string,
  zoomScale: number,
): number {
  const el = elements.find((e) => e.id === selectedId)
  if (!el) return -1
  const ax = el.x + el.width, ay = el.y
  const hitR = COLOR_PICKER_HIT_RADIUS * zoomScale
  for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
    for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
      const { sx, sy } = swatch(fi, si, ax, ay, zoomScale)
      const dx = pixel.x - sx, dy = pixel.y - sy
      if (dx * dx + dy * dy <= hitR * hitR) return fi * 5 + si
    }
  }
  return -1
}
