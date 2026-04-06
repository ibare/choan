// Preview mode state — transient, not saved to files

import { create } from 'zustand'

export type PreviewState = 'stopped' | 'playing' | 'paused'

interface PreviewStore {
  previewState: PreviewState
  playheadTime: number           // ms, current playhead position
  editingBundleId: string | null // active animation bundle for editing (null = normal mode)
  ghostPreview: boolean          // onion-skin frame preview
  scrubHeldIds: Set<string>      // elements held from scrub override after manual edit
  play: () => void
  pause: () => void
  stop: () => void
  setPlayheadTime: (ms: number) => void
  setEditingBundle: (id: string | null) => void
  toggleGhostPreview: () => void
  holdScrub: (ids: string[]) => void
  clearScrubHolds: () => void
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  previewState: 'stopped',
  playheadTime: 0,
  editingBundleId: null,
  ghostPreview: false,
  scrubHeldIds: new Set<string>(),
  play: () => set({ previewState: 'playing', scrubHeldIds: new Set() }),
  pause: () => set({ previewState: 'paused' }),
  stop: () => set({ previewState: 'stopped', playheadTime: 0, scrubHeldIds: new Set() }),
  setPlayheadTime: (ms) => set({ playheadTime: Math.max(0, ms), scrubHeldIds: new Set() }),
  setEditingBundle: (id) => set({ editingBundleId: id, playheadTime: 0, scrubHeldIds: new Set() }),
  toggleGhostPreview: () => set((s) => ({ ghostPreview: !s.ghostPreview })),
  holdScrub: (ids) => set((s) => ({ scrubHeldIds: new Set([...s.scrubHeldIds, ...ids]) })),
  clearScrubHolds: () => set({ scrubHeldIds: new Set() }),
}))
