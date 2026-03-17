// Multi-select tint — pure function, no store imports.
//
// When multiple elements are selected, overrides their color and opacity
// to a translucent tint so the selection is visually apparent.

import type { ChoanElement } from '../store/useChoanStore'
import { MULTI_SELECT_TINT, MULTI_SELECT_OPACITY } from '../constants'

/**
 * Apply a tint override to all elements in selectedIds (only when count > 1).
 * Returns either the original array (no mutation) or a new array with tinted copies.
 */
export function applyMultiSelectTint(
  elements: ChoanElement[],
  selectedIds: string[],
): ChoanElement[] {
  if (selectedIds.length <= 1) return elements
  const selected = new Set(selectedIds)
  return elements.map((el) =>
    selected.has(el.id)
      ? { ...el, color: MULTI_SELECT_TINT, opacity: MULTI_SELECT_OPACITY }
      : el,
  )
}
