// UI store — owns: tool, drawColor.
// Responsible for canvas tool selection and current draw colour.

import { create } from 'zustand'
import type { Tool } from './useElementStore'

interface UIStore {
  tool: Tool
  drawColor: number
  pendingSkin: string | null
  pendingFrame: string | null
  setTool: (tool: Tool) => void
  setDrawColor: (color: number) => void
  setPendingSkin: (skin: string | null) => void
  setPendingFrame: (frame: string | null) => void
  reset: () => void
}

const initialState = {
  tool: 'select' as Tool,
  drawColor: 0xFFFFFF,
  pendingSkin: null as string | null,
  pendingFrame: null as string | null,
}

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,
  setTool: (tool) => set({ tool }),
  setDrawColor: (color) => set({ drawColor: color }),
  setPendingSkin: (skin) => set({ pendingSkin: skin }),
  setPendingFrame: (frame) => set({ pendingFrame: frame }),
  reset: () => set(initialState),
}))
