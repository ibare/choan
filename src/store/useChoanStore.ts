import { create } from 'zustand'
import { computeAutoLayout } from '../layout/autoLayout'

export type ElementRole = 'container' | 'image' | 'button' | 'input' | 'card'
export type ElementType = 'rectangle' | 'circle' | 'line'
export type LineStyle = 'solid' | 'dashed'
export type LineDirection = 'horizontal' | 'vertical' | 'diagonal'
export type AnimationHint =
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'spring'
  | 'scale-in'
  | 'scale-out'

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
}

export interface GlobalState {
  name: string
  type: 'boolean' | 'string' | 'number'
  default: boolean | string | number
}

export interface Trigger {
  elementId: string
  event: 'click' | 'hover' | 'focus'
  stateKey: string
  value: boolean | string | number
}

export interface Reaction {
  elementId: string
  condition: string
  animation: AnimationHint
  easing: 'spring' | 'ease' | 'linear'
}

export interface Interaction {
  id: string
  trigger: Trigger
  reaction: Reaction
}

export type Tool = 'select' | 'rectangle' | 'circle' | 'line'

interface ChoanStore {
  // canvas state
  elements: ChoanElement[]
  selectedId: string | null
  tool: Tool
  drawColor: number

  // state machine data
  globalStates: GlobalState[]
  interactions: Interaction[]

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

  // state/interaction
  addGlobalState: (state: GlobalState) => void
  updateGlobalState: (name: string, patch: Partial<GlobalState>) => void
  removeGlobalState: (name: string) => void
  addInteraction: (interaction: Interaction) => void
  updateInteraction: (id: string, patch: Partial<Interaction>) => void
  removeInteraction: (id: string) => void

  // file operations
  loadFile: (data: { elements: ChoanElement[]; globalStates: GlobalState[]; interactions: Interaction[] }) => void
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

  // Free mode: only update z, keep positions as-is
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

const initialState = {
  elements: [] as ChoanElement[],
  selectedId: null as string | null,
  tool: 'select' as Tool,
  drawColor: 0xE6F8F0,
  globalStates: [] as GlobalState[],
  interactions: [] as Interaction[],
}

export const useChoanStore = create<ChoanStore>((set, get) => ({
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
        // Orphan children
        updated = updated.map((e) =>
          e.parentId === id ? { ...e, parentId: undefined } : e,
        )
      } else if (el?.parentId) {
        // Re-run layout on parent after removing child
        updated = applyLayout(updated, el.parentId)
      }

      return {
        elements: updated,
        selectedId: s.selectedId === id ? null : s.selectedId,
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

  addGlobalState: (state) =>
    set((s) => ({ globalStates: [...s.globalStates, state] })),

  updateGlobalState: (name, patch) =>
    set((s) => ({
      globalStates: s.globalStates.map((gs) =>
        gs.name === name ? { ...gs, ...patch } : gs
      ),
    })),

  removeGlobalState: (name) =>
    set((s) => ({
      globalStates: s.globalStates.filter((gs) => gs.name !== name),
    })),

  addInteraction: (interaction) =>
    set((s) => ({ interactions: [...s.interactions, interaction] })),

  updateInteraction: (id, patch) =>
    set((s) => ({
      interactions: s.interactions.map((i) =>
        i.id === id ? { ...i, ...patch } : i
      ),
    })),

  removeInteraction: (id) =>
    set((s) => ({
      interactions: s.interactions.filter((i) => i.id !== id),
    })),

  loadFile: ({ elements, globalStates, interactions }) => {
    // After loading, run layout on all containers
    let updated = elements
    const containers = updated.filter((e) => e.role === 'container')
    for (const c of containers) {
      updated = applyLayout(updated, c.id)
    }
    set({ elements: updated, globalStates, interactions, selectedId: null })
  },

  reset: () => set(initialState),
}))
