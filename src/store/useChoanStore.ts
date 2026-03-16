import { create } from 'zustand'
import { computeAutoLayout } from '../layout/autoLayout'
import type { AnimationClip, AnimationBundle } from '../animation/types'

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
  radius?: number  // 0~1, rectangle only (0=sharp, 1=fully rounded)
  x: number
  y: number
  z: number
  width: number
  height: number
  opacity: number
  // line-specific
  lineStyle?: LineStyle
  lineDirection?: LineDirection
  hasArrow?: boolean
  // container hierarchy
  parentId?: string
  // container layout (only meaningful when role === 'container')
  layoutDirection?: 'free' | 'row' | 'column'
  layoutGap?: number
  layoutPadding?: number
  // triggers: event → animation bundle direct link
  triggers?: ElementTrigger[]
}

export type Tool = 'select' | 'rectangle' | 'circle' | 'line'

interface ChoanStore {
  // canvas state
  elements: ChoanElement[]
  selectedId: string | null
  tool: Tool
  drawColor: number

  // animation data
  animationClips: AnimationClip[]
  animationBundles: AnimationBundle[]

  // element counters for sequential naming
  elementCounters: Record<string, number>

  // element operations
  addElement: (el: ChoanElement) => void
  updateElement: (id: string, patch: Partial<ChoanElement>) => void
  removeElement: (id: string) => void
  selectElement: (id: string | null) => void

  // container operations
  reparentElement: (childId: string, parentId: string | null) => void
  runLayout: (containerId: string) => void

  // tool & view
  setTool: (tool: Tool) => void
  setDrawColor: (color: number) => void

  // animation clips
  addAnimationClip: (clip: AnimationClip) => void
  updateAnimationClip: (clipId: string, patch: Partial<AnimationClip>) => void
  removeAnimationClip: (clipId: string) => void

  // animation bundles
  addAnimationBundle: (bundle: AnimationBundle) => void
  updateAnimationBundle: (id: string, patch: Partial<AnimationBundle>) => void
  removeAnimationBundle: (id: string) => void
  addClipToBundle: (bundleId: string, clip: AnimationClip) => void
  updateClipInBundle: (bundleId: string, clipId: string, patch: Partial<AnimationClip>) => void
  removeClipFromBundle: (bundleId: string, clipId: string) => void

  // file operations
  loadFile: (data: { elements: ChoanElement[]; animationClips?: AnimationClip[]; animationBundles?: AnimationBundle[] }) => void
  reset: () => void
}

// Helper: apply auto-layout to a container's children (pure state transform)
function applyLayout(elements: ChoanElement[], containerId: string): ChoanElement[] {
  const container = elements.find((e) => e.id === containerId)
  if (!container) return elements

  const children = elements.filter((e) => e.parentId === containerId)
  if (children.length === 0) return elements

  const direction = container.layoutDirection ?? 'free'
  const childZ = container.z + 1
  const childIds = new Set(children.map((c) => c.id))

  if (direction === 'free') {
    return elements.map((e) =>
      childIds.has(e.id) ? { ...e, z: childZ } : e,
    )
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
  selectedId: null as string | null,
  tool: 'select' as Tool,
  drawColor: 0xE6F8F0,
  animationClips: [] as AnimationClip[],
  animationBundles: [] as AnimationBundle[],
  elementCounters: {} as Record<string, number>,
}

export const useChoanStore = create<ChoanStore>((set, get) => ({
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
        updated = updated.map((e) =>
          e.parentId === id ? { ...e, parentId: undefined } : e,
        )
      } else if (el?.parentId) {
        updated = applyLayout(updated, el.parentId)
      }

      // Clean up bundle clips referencing this element
      const cleanedBundles = s.animationBundles.map((b) => ({
        ...b,
        clips: b.clips.filter((c) => c.elementId !== id),
      }))

      return {
        elements: updated,
        selectedId: s.selectedId === id ? null : s.selectedId,
        animationBundles: cleanedBundles,
      }
    }),

  selectElement: (id) => set({ selectedId: id }),

  reparentElement: (childId, parentId) =>
    set((s) => {
      let updated = s.elements.map((e) =>
        e.id === childId ? { ...e, parentId: parentId ?? undefined } : e,
      )
      if (parentId) {
        updated = applyLayout(updated, parentId)
      }
      return { elements: updated }
    }),

  runLayout: (containerId) =>
    set((s) => ({ elements: applyLayout(s.elements, containerId) })),

  setTool: (tool) => set({ tool }),
  setDrawColor: (color) => set({ drawColor: color }),

  addAnimationClip: (clip) =>
    set((s) => ({ animationClips: [...s.animationClips, clip] })),

  updateAnimationClip: (clipId, patch) =>
    set((s) => ({
      animationClips: s.animationClips.map((c) =>
        c.id === clipId ? { ...c, ...patch } : c,
      ),
    })),

  removeAnimationClip: (clipId) =>
    set((s) => ({
      animationClips: s.animationClips.filter((c) => c.id !== clipId),
    })),

  addAnimationBundle: (bundle) =>
    set((s) => ({ animationBundles: [...s.animationBundles, bundle] })),

  updateAnimationBundle: (id, patch) =>
    set((s) => ({
      animationBundles: s.animationBundles.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    })),

  removeAnimationBundle: (id) =>
    set((s) => ({
      animationBundles: s.animationBundles.filter((b) => b.id !== id),
      // Clear trigger references in elements
      elements: s.elements.map((el) =>
        el.triggers?.some((t) => t.animationBundleId === id)
          ? { ...el, triggers: el.triggers.filter((t) => t.animationBundleId !== id) }
          : el,
      ),
    })),

  addClipToBundle: (bundleId, clip) =>
    set((s) => ({
      animationBundles: s.animationBundles.map((b) =>
        b.id === bundleId ? { ...b, clips: [...b.clips, clip] } : b,
      ),
    })),

  updateClipInBundle: (bundleId, clipId, patch) =>
    set((s) => ({
      animationBundles: s.animationBundles.map((b) =>
        b.id === bundleId
          ? { ...b, clips: b.clips.map((c) => c.id === clipId ? { ...c, ...patch } : c) }
          : b,
      ),
    })),

  removeClipFromBundle: (bundleId, clipId) =>
    set((s) => ({
      animationBundles: s.animationBundles.map((b) =>
        b.id === bundleId
          ? { ...b, clips: b.clips.filter((c) => c.id !== clipId) }
          : b,
      ),
    })),

  loadFile: ({ elements, animationClips, animationBundles }) => {
    let updated = elements
    const containers = updated.filter((e) => e.role === 'container')
    for (const c of containers) {
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

    set({
      elements: updated,
      animationClips: animationClips ?? [],
      animationBundles: animationBundles ?? [],
      selectedId: null,
      elementCounters: counters,
    })
  },

  reset: () => set(initialState),
}))
