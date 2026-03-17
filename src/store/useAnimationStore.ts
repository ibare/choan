// Animation store — owns: animationClips, animationBundles.
// Responsible for clip/bundle CRUD only.
// Does NOT touch element data directly.

import { create } from 'zustand'
import type { AnimationClip, AnimationBundle } from '../animation/types'

interface AnimationStore {
  animationClips: AnimationClip[]
  animationBundles: AnimationBundle[]

  addAnimationClip: (clip: AnimationClip) => void
  updateAnimationClip: (clipId: string, patch: Partial<AnimationClip>) => void
  removeAnimationClip: (clipId: string) => void

  addAnimationBundle: (bundle: AnimationBundle) => void
  updateAnimationBundle: (id: string, patch: Partial<AnimationBundle>) => void
  /** Remove bundle (animation domain only). Caller must also invoke useElementStore.clearBundleTriggers. */
  removeAnimationBundle: (id: string) => void
  addClipToBundle: (bundleId: string, clip: AnimationClip) => void
  updateClipInBundle: (bundleId: string, clipId: string, patch: Partial<AnimationClip>) => void
  removeClipFromBundle: (bundleId: string, clipId: string) => void

  /** Remove all clips referencing a deleted element across all bundles. */
  cleanupForElement: (elementId: string) => void

  loadAnimation: (clips: AnimationClip[] | undefined, bundles: AnimationBundle[] | undefined) => void
  reset: () => void
}

const initialState = {
  animationClips: [] as AnimationClip[],
  animationBundles: [] as AnimationBundle[],
}

export const useAnimationStore = create<AnimationStore>((set) => ({
  ...initialState,

  addAnimationClip: (clip) =>
    set((s) => ({ animationClips: [...s.animationClips, clip] })),

  updateAnimationClip: (clipId, patch) =>
    set((s) => ({
      animationClips: s.animationClips.map((c) => c.id === clipId ? { ...c, ...patch } : c),
    })),

  removeAnimationClip: (clipId) =>
    set((s) => ({ animationClips: s.animationClips.filter((c) => c.id !== clipId) })),

  addAnimationBundle: (bundle) =>
    set((s) => ({ animationBundles: [...s.animationBundles, bundle] })),

  updateAnimationBundle: (id, patch) =>
    set((s) => ({
      animationBundles: s.animationBundles.map((b) => b.id === id ? { ...b, ...patch } : b),
    })),

  removeAnimationBundle: (id) =>
    set((s) => ({
      animationBundles: s.animationBundles.filter((b) => b.id !== id),
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

  cleanupForElement: (elementId) =>
    set((s) => ({
      animationBundles: s.animationBundles.map((b) => ({
        ...b,
        clips: b.clips.filter((c) => c.elementId !== elementId),
      })),
    })),

  loadAnimation: (clips, bundles) =>
    set({ animationClips: clips ?? [], animationBundles: bundles ?? [] }),

  reset: () => set(initialState),
}))
