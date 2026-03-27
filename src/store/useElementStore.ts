// Element store — owns: elements, selectedIds.
// Responsible for element CRUD, selection, containment hierarchy, and layout.
// Does NOT know about animation data.

import { create } from 'zustand'
import { computeAutoLayout } from '../layout/autoLayout'
import { DEFAULT_LAYOUT_GAP, DEFAULT_LAYOUT_PADDING, DEFAULT_LAYOUT_COLUMNS } from '../constants'

export type ElementRole = 'container'
export type ElementType = 'rectangle' | 'circle' | 'line'
export type LineStyle = 'solid' | 'dashed'
export type LineDirection = 'horizontal' | 'vertical' | 'diagonal'

export interface ElementTrigger {
  event: 'click' | 'hover'
  animationBundleId: string
}

export interface ChoanElement {
  id: string
  type: ElementType
  label: string
  role?: ElementRole
  color?: number
  radius?: number  // 0–1, rectangle only
  x: number
  y: number
  z: number
  width: number
  height: number
  opacity?: number  // internal rendering hint only (multiSelectTint, ghostPreview)
  lineStyle?: LineStyle
  lineDirection?: LineDirection
  hasArrow?: boolean
  parentId?: string
  layoutDirection?: 'free' | 'row' | 'column' | 'grid'
  layoutGap?: number
  layoutPadding?: number
  layoutColumns?: number
  layoutSizing?: 'equal' | 'fill' | 'fixed-ratio' | 'fixed-px'  // default: 'equal'
  layoutRatio?: number      // 0~1, used when sizing='fixed-ratio'
  triggers?: ElementTrigger[]
  frame?: 'browser' | 'mobile'            // device frame (independent of skin, locked aspect ratio)
  safeInset?: { top: number; bottom: number; left: number; right: number }
  skin?: string                           // visual texture key (e.g. 'switch', 'profile-round')
  skinOnly?: boolean                      // hide SDF body, show only skin texture
  frameless?: boolean                     // hide container background (separate from skinOnly)
  componentState?: Record<string, unknown>
  rotationY?: number                      // Y-axis rotation in radians (Director mode)
}

export type Tool = 'select' | 'rectangle' | 'circle' | 'line'

interface ElementStore {
  elements: ChoanElement[]
  selectedIds: string[]

  addElement: (el: ChoanElement) => void
  updateElement: (id: string, patch: Partial<ChoanElement>) => void
  /** Remove element (element domain only). Caller must also invoke useAnimationStore.cleanupForElement. */
  removeElement: (id: string) => void
  clearBundleTriggers: (bundleId: string) => void

  selectElement: (id: string | null) => void
  toggleSelectElement: (id: string) => void
  setSelectedIds: (ids: string[]) => void

  reparentElement: (childId: string, parentId: string | null) => void
  runLayout: (containerId: string) => void

  /** Load elements from file (applies layout, resets selection). */
  loadElements: (elements: ChoanElement[]) => void
  reset: () => void
}

// ── Private helpers ───────────────────────────────────────────────────────────

function applyLayout(elements: ChoanElement[], containerId: string): ChoanElement[] {
  const container = elements.find((e) => e.id === containerId)
  if (!container) return elements
  const children = elements.filter((e) => e.parentId === containerId)
  if (children.length === 0) return elements
  const direction = container.layoutDirection ?? 'free'
  const childZ = container.z + 1
  const childIds = new Set(children.map((c) => c.id))
  if (direction === 'free') {
    elements = elements.map((e) => childIds.has(e.id) ? { ...e, z: childZ } : e)
  } else {
    const isRowOrCol = direction === 'row' || direction === 'column'
    const sizings = isRowOrCol ? children.map((c) => c.layoutSizing ?? 'equal') : undefined
    const ratios = isRowOrCol ? children.map((c) => c.layoutRatio) : undefined
    const fixedSizes = isRowOrCol ? children.map((c) => {
      if (c.layoutSizing !== 'fixed-px') return undefined
      return direction === 'row' ? c.width : c.height
    }) : undefined
    const positions = computeAutoLayout({
      container: { x: container.x, y: container.y, width: container.width, height: container.height },
      direction,
      gap: container.layoutGap ?? DEFAULT_LAYOUT_GAP,
      padding: container.layoutPadding ?? DEFAULT_LAYOUT_PADDING,
      safeInset: container.safeInset,
      childCount: children.length,
      columns: container.layoutColumns ?? DEFAULT_LAYOUT_COLUMNS,
      sizings,
      ratios,
      fixedSizes,
    })
    elements = elements.map((e) => {
      if (!childIds.has(e.id)) return e
      const idx = children.indexOf(e)
      const pos = positions[idx]
      return { ...e, x: pos.x, y: pos.y, width: pos.width, height: pos.height, z: childZ }
    })
  }
  // Recurse into child containers whose position/size may have changed
  for (const child of children) {
    if (child.role === 'container') {
      elements = applyLayout(elements, child.id)
    }
  }
  return elements
}

/** Recursively propagate Z values: each child gets parent.z + 1 */
function propagateZ(elements: ChoanElement[]): ChoanElement[] {
  const byParent = new Map<string, ChoanElement[]>()
  for (const el of elements) {
    const key = el.parentId ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(el)
  }
  const zMap = new Map<string, number>()
  function walk(parentKey: string, parentZ: number) {
    for (const child of byParent.get(parentKey) ?? []) {
      const childZ = parentZ + 1
      if (child.z !== childZ) zMap.set(child.id, childZ)
      walk(child.id, childZ)
    }
  }
  // Start from root elements (their z is authoritative)
  for (const root of byParent.get('__root__') ?? []) {
    walk(root.id, root.z)
  }
  if (zMap.size === 0) return elements
  return elements.map((e) => {
    const newZ = zMap.get(e.id)
    return newZ !== undefined ? { ...e, z: newZ } : e
  })
}

const initialState = {
  elements: [] as ChoanElement[],
  selectedIds: [] as string[],
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useElementStore = create<ElementStore>((set) => ({
  ...initialState,

  addElement: (el) =>
    set((s) => ({ elements: [...s.elements, el] })),

  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  removeElement: (id) =>
    set((s) => {
      const el = s.elements.find((e) => e.id === id)
      let updated = s.elements.filter((e) => e.id !== id)
      if (el?.role === 'container') {
        updated = updated.map((e) => e.parentId === id ? { ...e, parentId: undefined } : e)
      } else if (el?.parentId) {
        updated = applyLayout(updated, el.parentId)
      }
      return {
        elements: updated,
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
      }
    }),

  clearBundleTriggers: (bundleId) =>
    set((s) => ({
      elements: s.elements.map((el) =>
        el.triggers?.some((t) => t.animationBundleId === bundleId)
          ? { ...el, triggers: el.triggers.filter((t) => t.animationBundleId !== bundleId) }
          : el,
      ),
    })),

  selectElement: (id) => set({ selectedIds: id ? [id] : [] }),
  toggleSelectElement: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),

  reparentElement: (childId, parentId) =>
    set((s) => {
      let updated = s.elements.map((e) =>
        e.id === childId ? { ...e, parentId: parentId ?? undefined } : e,
      )
      if (parentId) updated = applyLayout(updated, parentId)
      // Propagate Z to all descendants recursively
      updated = propagateZ(updated)
      return { elements: updated }
    }),

  runLayout: (containerId) =>
    set((s) => ({ elements: applyLayout(s.elements, containerId) })),

  loadElements: (elements) => {
    let updated = elements
    for (const c of updated.filter((e) => e.role === 'container')) {
      updated = applyLayout(updated, c.id)
    }
    set({ elements: updated, selectedIds: [] })
  },

  reset: () => set(initialState),
}))
