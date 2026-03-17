// Group drag — move + containment re-evaluation after drop.

import type { ChoanElement } from '../store/useChoanStore'
import type { SnapLine } from '../canvas/snapUtils'
import { computeSnapMove } from '../canvas/snapUtils'
import { detectContainment } from '../layout/containment'

/** Apply delta to all group members with snap. Updates store + snapLines. */
export function handleDragMove(
  pixel: { x: number; y: number },
  dragStartPixel: { x: number; y: number },
  groupIds: string[],
  groupStart: Map<string, { x: number; y: number }>,
  containerId: string | null,
  elements: ChoanElement[],
  update: (id: string, patch: Partial<ChoanElement>) => void,
  setSnapLines: (lines: SnapLine[]) => void,
): void {
  const dx = pixel.x - dragStartPixel.x
  const dy = pixel.y - dragStartPixel.y
  const groupSet = new Set(groupIds)
  const refId = containerId ?? groupIds[0]
  const refStart = groupStart.get(refId)
  if (!refStart) return
  const refEl = elements.find((e) => e.id === refId)
  if (!refEl) return
  const snap = computeSnapMove(
    { x: refStart.x + dx, y: refStart.y + dy, width: refEl.width, height: refEl.height },
    elements.filter((e) => !groupSet.has(e.id)),
  )
  setSnapLines(snap.lines)
  const finalDx = dx + snap.dx, finalDy = dy + snap.dy
  for (const gid of groupIds) {
    const start = groupStart.get(gid)
    if (start) update(gid, { x: start.x + finalDx, y: start.y + finalDy })
  }
}

/** Re-evaluate containment after single-element drag drop. */
export function finalizeDrag(
  selId: string,
  selIds: string[],
  elements: ChoanElement[],
  reparentElement: (id: string, parentId: string | null | undefined) => void,
  runLayout: (id: string) => void,
): void {
  if (selIds.length !== 1) return
  const el = elements.find((e) => e.id === selId)
  if (!el || el.role === 'container') return
  const newParentId = detectContainment(el, elements.filter((e) => e.role === 'container' && e.id !== selId))
  if (newParentId !== el.parentId) {
    const oldParentId = el.parentId
    reparentElement(selId, newParentId)
    if (oldParentId) runLayout(oldParentId)
  }
}
