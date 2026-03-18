// Element store — owns: elements, selectedIds, elementCounters.
// Responsible for element CRUD, selection, containment hierarchy, and layout.
// Does NOT know about animation data.

import { create } from 'zustand'
import { computeAutoLayout } from '../layout/autoLayout'

export type ElementRole = 'container' | 'image' | 'button' | 'input' | 'card'
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
  opacity: number
  lineStyle?: LineStyle
  lineDirection?: LineDirection
  hasArrow?: boolean
  parentId?: string
  layoutDirection?: 'free' | 'row' | 'column'
  layoutGap?: number
  layoutPadding?: number
  triggers?: ElementTrigger[]
  skin?: string                           // visual texture key (e.g. 'switch', 'profile-round')
  componentState?: Record<string, unknown>
}

export type Tool = 'select' | 'rectangle' | 'circle' | 'line'

interface ElementStore {
  elements: ChoanElement[]
  selectedIds: string[]
  elementCounters: Record<string, number>

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

  /** Load elements from file (applies layout, resets selection and counters). */
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
    return elements.map((e) => childIds.has(e.id) ? { ...e, z: childZ } : e)
  }
  const positions = computeAutoLayout({
    container: { x: container.x, y: container.y, width: container.width, height: container.height },
    direction,
    gap: container.layoutGap ?? 8,
    padding: container.layoutPadding ?? 8,
    childCount: children.length,
  })
  return elements.map((e) => {
    if (!childIds.has(e.id)) return e
    const idx = children.indexOf(e)
    const pos = positions[idx]
    return { ...e, x: pos.x, y: pos.y, width: pos.width, height: pos.height, z: childZ }
  })
}

const LABEL_MAP: Record<string, string> = {
  rectangle: 'Box',
  circle: 'Circle',
  line: 'Line',
}

const initialState = {
  elements: [] as ChoanElement[],
  selectedIds: [] as string[],
  elementCounters: {} as Record<string, number>,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useElementStore = create<ElementStore>((set) => ({
  ...initialState,

  addElement: (el) =>
    set((s) => {
      const base = LABEL_MAP[el.type] ?? el.type
      if (el.label === base || el.label === 'Box' || el.label === 'Circle' || el.label === 'Line') {
        const next = (s.elementCounters[el.type] ?? 0) + 1
        return {
          elements: [...s.elements, { ...el, label: `${base} ${next}` }],
          elementCounters: { ...s.elementCounters, [el.type]: next },
        }
      }
      return { elements: [...s.elements, el] }
    }),

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
      return { elements: updated }
    }),

  runLayout: (containerId) =>
    set((s) => ({ elements: applyLayout(s.elements, containerId) })),

  loadElements: (elements) => {
    let updated = elements
    for (const c of updated.filter((e) => e.role === 'container')) {
      updated = applyLayout(updated, c.id)
    }
    const counters: Record<string, number> = {}
    for (const el of updated) {
      const match = el.label.match(/^(?:Box|Circle|Line)\s+(\d+)$/)
      if (match) {
        const n = parseInt(match[1], 10)
        counters[el.type] = Math.max(counters[el.type] ?? 0, n)
      }
    }
    set({ elements: updated, selectedIds: [], elementCounters: counters })
  },

  reset: () => set(initialState),
}))
