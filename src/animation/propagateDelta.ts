// Propagate parent x/y animation delta to descendant elements.
// Shared by animationEvaluator (scrub mode) and keyframeEngine (playback mode).

import type { ChoanElement } from '../store/useChoanStore'

/**
 * Given a set of element overrides (animated values), compute inherited x/y
 * deltas from parents and merge them into the overrides map so that children
 * follow their parents automatically — even without their own keyframes.
 *
 * Mutates `overrides` in place for efficiency (caller owns the map).
 */
export function propagateParentDelta(
  elements: readonly ChoanElement[],
  overrides: Map<string, Partial<ChoanElement>>,
): void {
  const childMap = new Map<string, string[]>()
  const elById = new Map<string, ChoanElement>()
  for (const el of elements) {
    elById.set(el.id, el)
    if (el.parentId) {
      const siblings = childMap.get(el.parentId)
      if (siblings) siblings.push(el.id)
      else childMap.set(el.parentId, [el.id])
    }
  }

  const inheritedDelta = new Map<string, { dx: number; dy: number }>()

  function propagate(parentId: string, dx: number, dy: number) {
    const children = childMap.get(parentId)
    if (!children) return
    for (const childId of children) {
      const prev = inheritedDelta.get(childId)
      const totalDx = (prev?.dx ?? 0) + dx
      const totalDy = (prev?.dy ?? 0) + dy
      inheritedDelta.set(childId, { dx: totalDx, dy: totalDy })
      propagate(childId, dx, dy)
    }
  }

  for (const [elId, patch] of overrides) {
    const orig = elById.get(elId)
    if (!orig) continue
    const dx = patch.x !== undefined ? (patch.x as number) - orig.x : 0
    const dy = patch.y !== undefined ? (patch.y as number) - orig.y : 0
    if (dx !== 0 || dy !== 0) propagate(elId, dx, dy)
  }

  for (const [childId, delta] of inheritedDelta) {
    const orig = elById.get(childId)
    if (!orig) continue
    const existing = overrides.get(childId)
    const baseX = existing?.x !== undefined ? (existing.x as number) : orig.x
    const baseY = existing?.y !== undefined ? (existing.y as number) : orig.y
    overrides.set(childId, { ...existing, x: baseX + delta.dx, y: baseY + delta.dy })
  }
}
