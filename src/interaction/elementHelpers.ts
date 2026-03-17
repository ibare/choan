// Pure element helpers — no hooks, no store imports.
// All helpers receive their data as parameters and return computed results.

import type { ChoanElement } from '../store/useChoanStore'

export const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  rectangle: { w: 120, h: 90 },
  circle: { w: 100, h: 100 },
  line: { w: 160, h: 6 },
}

// Apply a property patch to an element and (if altKey) to its siblings.
// Position fields (x, y) are always excluded from sibling propagation.
export function applyToSiblings(
  update: (id: string, patch: Partial<ChoanElement>) => void,
  els: ChoanElement[],
  id: string,
  patch: Partial<ChoanElement>,
  altKey: boolean,
): void {
  update(id, patch)
  if (!altKey) return
  const el = els.find((e) => e.id === id)
  if (!el?.parentId) return
  const { x: _x, y: _y, ...siblingPatch } = patch
  if (Object.keys(siblingPatch).length === 0) return
  for (const sib of els) {
    if (sib.parentId === el.parentId && sib.id !== id) update(sib.id, siblingPatch)
  }
}

export function collectDescendants(els: ChoanElement[], parentId: string): string[] {
  const result: string[] = []
  for (const e of els) {
    if (e.parentId === parentId) {
      result.push(e.id)
      result.push(...collectDescendants(els, e.id))
    }
  }
  return result
}

export function findRootAncestor(els: ChoanElement[], elId: string): string {
  const el = els.find((e) => e.id === elId)
  if (!el || !el.parentId) return elId
  return findRootAncestor(els, el.parentId)
}

export function isInFreeLayout(els: ChoanElement[], elId: string): boolean {
  const el = els.find((e) => e.id === elId)
  if (!el?.parentId) return false
  const parent = els.find((e) => e.id === el.parentId)
  return !parent?.layoutDirection || parent.layoutDirection === 'free'
}

export function resolveGroup(els: ChoanElement[], elId: string): string[] {
  const el = els.find((e) => e.id === elId)
  if (!el) return [elId]
  if (el.parentId) {
    if (isInFreeLayout(els, elId)) {
      if (el.role === 'container') return [el.id, ...collectDescendants(els, el.id)]
      return [el.id]
    }
    const rootId = findRootAncestor(els, elId)
    return [rootId, ...collectDescendants(els, rootId)]
  }
  if (el.role === 'container') return [el.id, ...collectDescendants(els, el.id)]
  return [el.id]
}
