import { create } from 'zustand'

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
  isZViewMode: boolean

  // state machine data
  globalStates: GlobalState[]
  interactions: Interaction[]

  // element operations
  addElement: (el: ChoanElement) => void
  updateElement: (id: string, patch: Partial<ChoanElement>) => void
  removeElement: (id: string) => void
  selectElement: (id: string | null) => void

  // tool & view
  setTool: (tool: Tool) => void
  setDrawColor: (color: number) => void
  toggleZView: () => void

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

const initialState = {
  elements: [] as ChoanElement[],
  selectedId: null as string | null,
  tool: 'select' as Tool,
  drawColor: 0x7DDCAC,
  isZViewMode: false,
  globalStates: [] as GlobalState[],
  interactions: [] as Interaction[],
}

export const useChoanStore = create<ChoanStore>((set) => ({
  ...initialState,

  addElement: (el) =>
    set((s) => ({ elements: [...s.elements, el] })),

  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  removeElement: (id) =>
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  selectElement: (id) => set({ selectedId: id }),

  setTool: (tool) => set({ tool }),

  setDrawColor: (color) => set({ drawColor: color }),

  toggleZView: () =>
    set((s) => ({ isZViewMode: !s.isZViewMode })),

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

  loadFile: ({ elements, globalStates, interactions }) =>
    set({ elements, globalStates, interactions, selectedId: null }),

  reset: () => set(initialState),
}))
