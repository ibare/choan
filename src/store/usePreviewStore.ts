// Preview mode state — transient, not saved to files

import { create } from 'zustand'

export type PreviewState = 'stopped' | 'playing' | 'paused'

interface PreviewStore {
  previewState: PreviewState
  play: () => void
  pause: () => void
  stop: () => void
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  previewState: 'stopped',
  play: () => set({ previewState: 'playing' }),
  pause: () => set({ previewState: 'paused' }),
  stop: () => set({ previewState: 'stopped' }),
}))
