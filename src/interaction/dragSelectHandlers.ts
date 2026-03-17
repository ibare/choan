// Drag-select box — pure functions for computing selection box and intersection.

import type { ChoanElement } from '../store/useChoanStore'

export interface DragSelectMoveResult {
  box: { left: number; top: number; width: number; height: number }
  selectedIds: string[]
  hasMoved: boolean
}

/**
 * Compute the updated drag-select box (mount-relative client coords)
 * and the set of intersecting element IDs.
 */
export function handleDragSelectMove(
  clientX: number,
  clientY: number,
  startClientX: number,
  startClientY: number,
  mountRect: DOMRect,
  currPixel: { x: number; y: number },
  startPixel: { x: number; y: number },
  elements: ChoanElement[],
  preSelection: string[],
  addMode: boolean,
): DragSelectMoveResult {
  const startX = startClientX - mountRect.left
  const startY = startClientY - mountRect.top
  const currX = clientX - mountRect.left
  const currY = clientY - mountRect.top
  const boxW = Math.abs(currX - startX)
  const boxH = Math.abs(currY - startY)
  const box = { left: Math.min(startX, currX), top: Math.min(startY, currY), width: boxW, height: boxH }

  const boxL = Math.min(startPixel.x, currPixel.x)
  const boxT = Math.min(startPixel.y, currPixel.y)
  const boxR = Math.max(startPixel.x, currPixel.x)
  const boxB = Math.max(startPixel.y, currPixel.y)
  const intersecting = elements
    .filter((el) => !(el.x + el.width < boxL || el.x > boxR || el.y + el.height < boxT || el.y > boxB))
    .map((el) => el.id)

  const selectedIds = addMode
    ? [...new Set([...preSelection, ...intersecting])]
    : intersecting

  return { box, selectedIds, hasMoved: boxW > 4 || boxH > 4 }
}
