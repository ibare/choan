// useChoanStore — compatibility adapter.
//
// Composes useElementStore + useAnimationStore + useUIStore into a single
// interface identical to the original monolithic store.
// Orchestrates cross-store operations that neither sub-store can do alone.
//
// Consumers can migrate to the individual sub-stores over time.
// This adapter will be removed once all call sites have been migrated.

import type { AnimationClip, AnimationBundle } from '../animation/types'
import { useElementStore, type ChoanElement } from './useElementStore'
import { useAnimationStore } from './useAnimationStore'
import { useUIStore } from './useUIStore'

// Re-export all types so existing import paths keep working.
export type {
  ChoanElement,
  ElementRole,
  ElementType,
  LineStyle,
  LineDirection,
  ElementTrigger,
  Tool,
} from './useElementStore'

// ── Cross-store operations (module-level, stable references) ─────────────────

function removeElement(id: string) {
  useElementStore.getState().removeElement(id)
  useAnimationStore.getState().cleanupForElement(id)
}

function removeAnimationBundle(id: string) {
  useAnimationStore.getState().removeAnimationBundle(id)
  useElementStore.getState().clearBundleTriggers(id)
}

function loadFile(data: {
  elements: ChoanElement[]
  animationClips?: AnimationClip[]
  animationBundles?: AnimationBundle[]
}) {
  useElementStore.getState().loadElements(data.elements)
  useAnimationStore.getState().loadAnimation(data.animationClips, data.animationBundles)
}

function reset() {
  useElementStore.getState().reset()
  useAnimationStore.getState().reset()
  useUIStore.getState().reset()
}

// ── Adapter hook ─────────────────────────────────────────────────────────────

export function useChoanStore() {
  const el = useElementStore()
  const anim = useAnimationStore()
  const ui = useUIStore()

  return {
    // Element store
    elements: el.elements,
    selectedIds: el.selectedIds,
    elementCounters: el.elementCounters,
    addElement: el.addElement,
    updateElement: el.updateElement,
    selectElement: el.selectElement,
    toggleSelectElement: el.toggleSelectElement,
    setSelectedIds: el.setSelectedIds,
    reparentElement: el.reparentElement,
    runLayout: el.runLayout,

    // Animation store
    animationClips: anim.animationClips,
    animationBundles: anim.animationBundles,
    addAnimationClip: anim.addAnimationClip,
    updateAnimationClip: anim.updateAnimationClip,
    removeAnimationClip: anim.removeAnimationClip,
    addAnimationBundle: anim.addAnimationBundle,
    updateAnimationBundle: anim.updateAnimationBundle,
    addClipToBundle: anim.addClipToBundle,
    updateClipInBundle: anim.updateClipInBundle,
    removeClipFromBundle: anim.removeClipFromBundle,

    // UI store
    tool: ui.tool,
    drawColor: ui.drawColor,
    setTool: ui.setTool,
    setDrawColor: ui.setDrawColor,

    // Cross-store operations (stable module-level functions)
    removeElement,
    removeAnimationBundle,
    loadFile,
    reset,
  }
}

// ── Imperative getState shim ─────────────────────────────────────────────────
// Provides useChoanStore.getState() for code that reads state outside React.

useChoanStore.getState = () => ({
  ...useElementStore.getState(),
  ...useAnimationStore.getState(),
  ...useUIStore.getState(),
  removeElement,
  removeAnimationBundle,
  loadFile,
  reset,
})
