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
import { useSceneStore, injectSceneCallbacks } from './useSceneStore'
import type { Scene, SceneTransition } from './sceneTypes'

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
  import('../utils/analytics').then(({ track }) => track('load-file', { elementCount: data.elements.length }))
}

function reset() {
  useElementStore.getState().reset()
  useAnimationStore.getState().reset()
  useUIStore.getState().reset()
  useSceneStore.getState().reset()
}

// ── Scene cross-store operations ──

/** Load a scene's element and animation data into the sub-stores. */
function loadSceneIntoStores(scene: Scene): void {
  useElementStore.getState().loadElements(scene.elements)
  useAnimationStore.getState().loadAnimation(undefined, scene.animationBundles)
}

/** Save the active scene's current element/animation state back into scenes array. */
function syncActiveToScenes(activeId: string, scenes: Scene[]): void {
  const elements = useElementStore.getState().elements
  const bundles = useAnimationStore.getState().animationBundles
  useSceneStore.setState({
    scenes: scenes.map((s) =>
      s.id === activeId
        ? { ...s, elements: [...elements], animationBundles: [...bundles] }
        : s,
    ),
  })
}

// Inject cross-store callbacks into useSceneStore so it can trigger
// scene switching without directly importing element/animation stores.
injectSceneCallbacks(loadSceneIntoStores, syncActiveToScenes)

function switchScene(id: string) {
  useSceneStore.getState().setActiveScene(id)
}

function addScene(): string {
  return useSceneStore.getState().addScene()
}

function removeScene(id: string) {
  useSceneStore.getState().removeScene(id)
}

function setSceneTransition(sceneId: string, transition: SceneTransition | undefined) {
  useSceneStore.getState().setTransitionOut(sceneId, transition)
}

// ── Adapter hook ─────────────────────────────────────────────────────────────

export function useChoanStore() {
  const el = useElementStore()
  const anim = useAnimationStore()
  const ui = useUIStore()
  const scene = useSceneStore()

  return {
    // Element store
    elements: el.elements,
    selectedIds: el.selectedIds,
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
    pendingSkin: ui.pendingSkin,
    pendingFrame: ui.pendingFrame,
    setTool: ui.setTool,
    setDrawColor: ui.setDrawColor,
    setPendingSkin: ui.setPendingSkin,
    setPendingFrame: ui.setPendingFrame,

    // Scene store
    scenes: scene.scenes,
    activeSceneId: scene.activeSceneId,
    transitionState: scene.transitionState,
    renameScene: scene.renameScene,
    updateSceneDuration: scene.updateSceneDuration,
    duplicateScene: scene.duplicateScene,

    // Cross-store operations (stable module-level functions)
    removeElement,
    removeAnimationBundle,
    loadFile,
    reset,
    switchScene,
    addScene,
    removeScene,
    setSceneTransition,
  }
}

// ── Imperative getState shim ─────────────────────────────────────────────────
// Provides useChoanStore.getState() for code that reads state outside React.

useChoanStore.getState = () => ({
  ...useElementStore.getState(),
  ...useAnimationStore.getState(),
  ...useUIStore.getState(),
  ...useSceneStore.getState(),
  removeElement,
  removeAnimationBundle,
  loadFile,
  reset,
  switchScene,
  addScene,
  removeScene,
  setSceneTransition,
})
