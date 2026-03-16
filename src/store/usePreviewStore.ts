// Preview mode state — transient, not saved to files

import { create } from 'zustand'

export type PreviewState = 'stopped' | 'playing' | 'paused'

interface PreviewStore {
  previewState: PreviewState
  playheadTime: number           // ms, current playhead position
  editingBundleId: string | null // active animation bundle for editing (null = normal mode)
  ghostPreview: boolean          // onion-skin frame preview
  play: () => void
  pause: () => void
  stop: () => void
  setPlayheadTime: (ms: number) => void
  setEditingBundle: (id: string | null) => void
  toggleGhostPreview: () => void
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  previewState: 'stopped',
  playheadTime: 0,
  editingBundleId: null,
  ghostPreview: false,
  play: () => set({ previewState: 'playing' }),
  pause: () => set({ previewState: 'paused' }),
  stop: () => set({ previewState: 'stopped', playheadTime: 0 }),
  setPlayheadTime: (ms) => set({ playheadTime: Math.max(0, ms) }),
  setEditingBundle: (id) => set({ editingBundleId: id, playheadTime: 0 }),
  toggleGhostPreview: () => set((s) => ({ ghostPreview: !s.ghostPreview })),
}))
