// UI store — owns: tool, drawColor.
// Responsible for canvas tool selection and current draw colour.

import { create } from 'zustand'
import type { Tool } from './useElementStore'

interface UIStore {
  tool: Tool
  drawColor: number
  setTool: (tool: Tool) => void
  setDrawColor: (color: number) => void
  reset: () => void
}

const initialState = {
  tool: 'select' as Tool,
  drawColor: 0xFFFFFF,
}

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,
  setTool: (tool) => set({ tool }),
  setDrawColor: (color) => set({ drawColor: color }),
  reset: () => set(initialState),
}))
