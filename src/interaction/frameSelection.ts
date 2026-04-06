// Frame selection to world origin — shared between hotkey (Z) and toolbar button.

import { useChoanStore } from '../store/useChoanStore'
import { resolveGroup } from './elementHelpers'
import { worldToPixel, pixelWidthToWorld, pixelHeightToWorld } from '../coords/coordinateSystem'
import { pushSnapshot } from '../store/history'
import type { OrbitControls } from '../engine/controls'

/**
 * Move the selected element group so its center sits at the world origin,
 * then frame the camera in front (2D) view at 80% coverage.
 * Only works for root elements (no parent). Returns false if skipped.
 */
export function frameSelectionToOrigin(controls: OrbitControls): boolean {
  const { selectedIds, elements, updateElement } = useChoanStore.getState()
  if (selectedIds.length === 0) return false

  // Only root elements (no parent)
  const primary = elements.find((e) => e.id === selectedIds[0])
  if (!primary || primary.parentId) return false

  // Resolve full group (selected + descendants)
  const groupIds = new Set<string>()
  for (const id of selectedIds) {
    for (const gid of resolveGroup(elements, id)) groupIds.add(gid)
  }

  // Compute AABB of the group
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const gid of groupIds) {
    const el = elements.find((e) => e.id === gid)
    if (!el) continue
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + el.width)
    maxY = Math.max(maxY, el.y + el.height)
  }
  if (!isFinite(minX)) return false

  // Move group center to world origin
  const pixCx = (minX + maxX) / 2
  const pixCy = (minY + maxY) / 2
  const [originPx, originPy] = worldToPixel(0, 0)
  const dx = originPx - pixCx
  const dy = originPy - pixCy
  for (const gid of groupIds) {
    const el = elements.find((e) => e.id === gid)
    if (el) updateElement(gid, { x: el.x + dx, y: el.y + dy })
  }
  pushSnapshot()

  // Frame camera at origin with 80% coverage
  const worldHalfW = pixelWidthToWorld((maxX - minX) / 2)
  const worldHalfH = pixelHeightToWorld((maxY - minY) / 2)
  controls.frameTo(0, 0, worldHalfW, worldHalfH)
  return true
}
