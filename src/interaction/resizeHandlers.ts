// Resize and radius drag — pure functions, no React hooks.

import type { ChoanElement } from '../store/useChoanStore'
import type { SnapLine } from '../canvas/snapUtils'
import { computeSnapResize } from '../canvas/snapUtils'
import { applyToSiblings } from './elementHelpers'
import { MIN_ELEMENT_SIZE } from '../constants'

/** Apply resize delta to the selected element with snap. */
export function handleResizeMove(
  pixel: { x: number; y: number },
  resizeStartPixel: { x: number; y: number },
  cornerStart: { x: number; y: number },
  anchor: { x: number; y: number },
  elements: ChoanElement[],
  selectedId: string,
  altKey: boolean,
  update: (id: string, patch: Partial<ChoanElement>) => void,
  setSnapLines: (lines: SnapLine[]) => void,
): void {
  const dx = pixel.x - resizeStartPixel.x
  const dy = pixel.y - resizeStartPixel.y
  const proposed = { x: cornerStart.x + dx, y: cornerStart.y + dy }
  const snap = computeSnapResize(anchor, proposed, elements.filter((e) => e.id !== selectedId))
  setSnapLines(snap.lines)
  applyToSiblings(update, elements, selectedId, {
    x: Math.min(anchor.x, snap.x), y: Math.min(anchor.y, snap.y),
    width: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.x - snap.x)),
    height: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.y - snap.y)),
  }, altKey)
}

/** Apply radius drag delta to the selected element. */
export function handleRadiusDragMove(
  pixel: { x: number; y: number },
  startPixel: { x: number; y: number },
  startRadius: number,
  elements: ChoanElement[],
  selectedId: string,
  altKey: boolean,
  update: (id: string, patch: Partial<ChoanElement>) => void,
): void {
  const el = elements.find((e) => e.id === selectedId)
  if (!el) return
  const dx = pixel.x - startPixel.x
  const dy = pixel.y - startPixel.y
  const delta = (dx + dy) / Math.min(el.width, el.height)
  applyToSiblings(update, elements, selectedId, { radius: Math.max(0, Math.min(1, startRadius + delta)) }, altKey)
}
