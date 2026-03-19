// UI store — owns: tool, drawColor.
// Responsible for canvas tool selection and current draw colour.

import { create } from 'zustand'
import type { Tool } from './useElementStore'

interface UIStore {
  tool: Tool
  drawColor: number
  pendingSkin: string | null  // skin to apply on next draw-to-create
  setTool: (tool: Tool) => void
  setDrawColor: (color: number) => void
  setPendingSkin: (skin: string | null) => void
  reset: () => void
}

const initialState = {
  tool: 'select' as Tool,
  drawColor: 0xFFFFFF,
  pendingSkin: null as string | null,
}

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,
  setTool: (tool) => set({ tool }),
  setDrawColor: (color) => set({ drawColor: color }),
  setPendingSkin: (skin) => set({ pendingSkin: skin }),
  reset: () => set(initialState),
}))
