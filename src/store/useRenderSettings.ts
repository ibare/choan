// Render settings store — runtime-tunable visual parameters

import { create } from 'zustand'

export interface RenderSettings {
  // Toon shading
  lightDir: [number, number, number]
  shadowMul: number
  warmTone: [number, number, number]
  sideDarken: number
  sideSmooth: [number, number]

  // Outline
  outlineWidth: number
  edgeColor: [number, number, number]
  normalEdgeThreshold: [number, number]
  idEdgeThreshold: [number, number]

  // Global
  bgColor: [number, number, number]
  extrudeDepth: number
}

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  lightDir: [0.8, 0.6, 0.35],
  shadowMul: 0.52,
  warmTone: [0.05, 0.02, 0.0],
  sideDarken: 0.72,
  sideSmooth: [0.3, 0.7],

  outlineWidth: 4.0,
  edgeColor: [0.133, 0.133, 0.133],
  normalEdgeThreshold: [0.3, 0.6],
  idEdgeThreshold: [0.1, 0.6],

  bgColor: [0xf7 / 255, 0xf3 / 255, 0xee / 255],
  extrudeDepth: 0.05,
}

interface RenderSettingsStore extends RenderSettings {
  set: (partial: Partial<RenderSettings>) => void
  reset: () => void
}

export const useRenderSettings = create<RenderSettingsStore>((set) => ({
  ...DEFAULT_RENDER_SETTINGS,
  set: (partial) => set(partial),
  reset: () => set(DEFAULT_RENDER_SETTINGS),
}))
