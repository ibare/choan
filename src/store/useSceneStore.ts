// Scene store — owns: scenes, activeSceneId, transitionState.
// Responsible for scene CRUD and active scene management.
// Cross-store sync (loading scene data into element/animation stores) is
// handled by useChoanStore module functions, NOT here (S-store MUST rule).

import { create } from 'zustand'
import { nanoid } from '../utils/nanoid'
import type { Scene, SceneTransition, TransitionState } from './sceneTypes'

// Cross-store callbacks — injected by useChoanStore at init time.
// This avoids importing useElementStore/useAnimationStore here.
let _onLoadScene: ((scene: Scene) => void) | null = null
let _onSyncActive: ((activeId: string, scenes: Scene[]) => void) | null = null

export function injectSceneCallbacks(
  onLoadScene: (scene: Scene) => void,
  onSyncActive: (activeId: string, scenes: Scene[]) => void,
) {
  _onLoadScene = onLoadScene
  _onSyncActive = onSyncActive
}

interface SceneStore {
  scenes: Scene[]
  activeSceneId: string
  transitionState: TransitionState | null

  // CRUD
  addScene: () => string
  removeScene: (id: string) => void
  duplicateScene: (id: string) => string | null
  renameScene: (id: string, name: string) => void
  reorderScene: (id: string, newOrder: number) => void
  updateSceneDuration: (id: string, duration: number) => void
  setTransitionOut: (sceneId: string, transition: SceneTransition | undefined) => void

  // Scene switching
  setActiveScene: (id: string) => void
  beginTransition: (toSceneId: string) => void
  endTransition: () => void

  // Data sync — save active scene's current element/animation state back
  syncActiveSceneData: () => void

  // Project-level
  loadScenes: (scenes: Scene[], activeSceneId: string) => void
  reset: () => void
}

function createDefaultScene(order: number, name?: string): Scene {
  return {
    id: nanoid(),
    name: name ?? `Scene ${order + 1}`,
    elements: [],
    animationBundles: [],
    order,
    duration: 3000,
  }
}

function buildInitialState() {
  const scene = createDefaultScene(0)
  return {
    scenes: [scene],
    activeSceneId: scene.id,
    transitionState: null as TransitionState | null,
  }
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  ...buildInitialState(),

  addScene: () => {
    const state = get()
    _onSyncActive?.(state.activeSceneId, state.scenes)
    const maxOrder = Math.max(...state.scenes.map((s) => s.order), -1)
    const scene = createDefaultScene(maxOrder + 1)
    set({ scenes: [...get().scenes, scene] })
    get().setActiveScene(scene.id)
    return scene.id
  },

  removeScene: (id) => {
    const state = get()
    if (state.scenes.length <= 1) return
    const filtered = state.scenes.filter((s) => s.id !== id)
    const reordered = filtered
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i }))
    const needSwitch = state.activeSceneId === id
    const newActive = needSwitch ? reordered[0].id : state.activeSceneId
    set({ scenes: reordered, activeSceneId: newActive })
    if (needSwitch) {
      _onLoadScene?.(reordered.find((s) => s.id === newActive)!)
    }
  },

  duplicateScene: (id) => {
    const state = get()
    _onSyncActive?.(state.activeSceneId, state.scenes)
    const source = get().scenes.find((s) => s.id === id)
    if (!source) return null
    const maxOrder = Math.max(...state.scenes.map((s) => s.order), -1)
    const dup: Scene = {
      ...source,
      id: nanoid(),
      name: `${source.name} (copy)`,
      order: maxOrder + 1,
      elements: source.elements.map((e) => ({ ...e })),
      animationBundles: source.animationBundles.map((b) => ({
        ...b,
        id: nanoid(),
        clips: b.clips.map((c) => ({ ...c, id: nanoid() })),
      })),
      transitionOut: source.transitionOut ? { ...source.transitionOut } : undefined,
    }
    set({ scenes: [...get().scenes, dup] })
    return dup.id
  },

  renameScene: (id, name) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, name } : sc)),
    })),

  reorderScene: (id, newOrder) =>
    set((s) => {
      const target = s.scenes.find((sc) => sc.id === id)
      if (!target) return s
      const oldOrder = target.order
      return {
        scenes: s.scenes.map((sc) => {
          if (sc.id === id) return { ...sc, order: newOrder }
          if (oldOrder < newOrder && sc.order > oldOrder && sc.order <= newOrder) {
            return { ...sc, order: sc.order - 1 }
          }
          if (oldOrder > newOrder && sc.order >= newOrder && sc.order < oldOrder) {
            return { ...sc, order: sc.order + 1 }
          }
          return sc
        }),
      }
    }),

  updateSceneDuration: (id, duration) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, duration: Math.max(100, duration) } : sc)),
    })),

  setTransitionOut: (sceneId, transition) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, transitionOut: transition } : sc,
      ),
    })),

  setActiveScene: (id) => {
    const state = get()
    if (state.activeSceneId === id) return
    _onSyncActive?.(state.activeSceneId, state.scenes)
    const updatedScenes = get().scenes
    const target = updatedScenes.find((s) => s.id === id)
    if (!target) return
    set({ activeSceneId: id })
    _onLoadScene?.(target)
  },

  beginTransition: (toSceneId) => {
    const state = get()
    const fromScene = state.scenes.find((s) => s.id === state.activeSceneId)
    if (!fromScene?.transitionOut) return
    set({
      transitionState: {
        fromSceneId: state.activeSceneId,
        toSceneId,
        transition: fromScene.transitionOut,
        startTime: performance.now(),
      },
    })
  },

  endTransition: () => {
    const state = get()
    if (!state.transitionState) return
    const toId = state.transitionState.toSceneId
    set({
      transitionState: null,
      activeSceneId: toId,
    })
  },

  syncActiveSceneData: () => {
    const state = get()
    _onSyncActive?.(state.activeSceneId, state.scenes)
  },

  loadScenes: (scenes, activeSceneId) => {
    set({ scenes, activeSceneId, transitionState: null })
    const active = scenes.find((s) => s.id === activeSceneId)
    if (active) _onLoadScene?.(active)
  },

  reset: () => {
    const initial = buildInitialState()
    set(initial)
    _onLoadScene?.(initial.scenes[0])
  },
}))
