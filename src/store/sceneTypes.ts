// Scene system type definitions and utilities

import type { ChoanElement } from './useElementStore'
import type { AnimationBundle, EasingType } from '../animation/types'

// ── Types ──

export interface SceneTransition {
  type: 'fade'
  duration: number  // ms
  easing: EasingType
}

export interface Scene {
  id: string
  name: string
  elements: ChoanElement[]
  animationBundles: AnimationBundle[]
  order: number
  duration: number  // ms
  transitionOut?: SceneTransition
}

export interface TransitionState {
  fromSceneId: string
  toSceneId: string
  transition: SceneTransition
  startTime: number   // performance.now()
}

export interface ResolvedTime {
  sceneId: string
  localMs: number
  transitionProgress: number | null  // non-null if in a transition zone
  transitionFromId: string | null
}

// ── Utilities ──

/** Map a global timeline position to the active scene and local time within it. */
export function resolveGlobalTime(
  scenes: Scene[],
  globalMs: number,
): ResolvedTime {
  const sorted = [...scenes].sort((a, b) => a.order - b.order)
  let cursor = 0

  for (let i = 0; i < sorted.length; i++) {
    const scene = sorted[i]
    const sceneEnd = cursor + scene.duration

    if (globalMs < sceneEnd || i === sorted.length - 1) {
      const localMs = Math.max(0, globalMs - cursor)

      // Check if we're in a transition zone at the end of this scene
      const transition = scene.transitionOut
      if (transition && i < sorted.length - 1) {
        const transitionStart = sceneEnd - transition.duration
        if (globalMs >= transitionStart) {
          const elapsed = globalMs - transitionStart
          return {
            sceneId: sorted[i + 1].id,
            localMs: elapsed,
            transitionProgress: Math.min(1, elapsed / transition.duration),
            transitionFromId: scene.id,
          }
        }
      }

      return {
        sceneId: scene.id,
        localMs,
        transitionProgress: null,
        transitionFromId: null,
      }
    }

    cursor = sceneEnd
  }

  // Fallback: return first scene at time 0
  return {
    sceneId: sorted[0]?.id ?? '',
    localMs: 0,
    transitionProgress: null,
    transitionFromId: null,
  }
}

/** Compute the total duration of the global timeline. */
export function computeTotalDuration(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + s.duration, 0)
}
