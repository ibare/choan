// Animation evaluator — pure function, no store imports.
//
// Determines which animation strategy to run for a given frame and
// returns the element array with animated values applied.
// The three strategies are mutually exclusive:
//   1. playing  → keyframe engine tick
//   2. scrubbing (stopped + editingBundleId) → evaluate clips at playheadTime
//   3. editing   → spring physics

import type { ChoanElement } from '../store/useChoanStore'
import type { AnimationBundle } from './types'
import type { KeyframeAnimator } from './keyframeEngine'
import type { LayoutAnimator, SpringParams } from '../layout/animator'
import type { PreviewState } from '../store/usePreviewStore'
import { evaluateTrack } from './interpolate'
import { resolveEasing } from './easing'
import type { AnimatableProperty } from './types'

export interface AnimationEvalInput {
  elements: ChoanElement[]
  previewState: PreviewState
  editingBundleId: string | null
  playheadTime: number
  animationBundles: AnimationBundle[]
  kfAnimator: KeyframeAnimator
  layoutAnimator: LayoutAnimator
  springParams: SpringParams
  manipulatedIds: ReadonlySet<string>
}

/**
 * Evaluate the animation state for the current frame.
 * Returns a new element array with animated values applied.
 * Does not mutate input elements.
 */
export function evaluateAnimation(input: AnimationEvalInput): ChoanElement[] {
  const {
    elements,
    previewState,
    editingBundleId,
    playheadTime,
    animationBundles,
    kfAnimator,
    layoutAnimator,
    springParams,
    manipulatedIds,
  } = input

  // 1. Playback mode — keyframe engine drives all values
  if (previewState === 'playing') {
    return kfAnimator.tick(elements, performance.now())
  }

  // 2. Scrub mode — evaluate bundle clips at playhead time
  //    Then apply layout animator for non-animated elements so spring
  //    physics (e.g. size transitions) keep working during editing.
  if (editingBundleId && previewState === 'stopped') {
    const bundle = animationBundles.find((b) => b.id === editingBundleId)
    if (bundle && bundle.clips.some((c) => c.tracks.length > 0)) {
      const overrides = new Map<string, Partial<ChoanElement>>()
      for (const clip of bundle.clips) {
        if (clip.tracks.length === 0) continue
        const easingFn = resolveEasing(clip.easing)
        const patch: Partial<ChoanElement> = {}
        for (const track of clip.tracks) {
          ;(patch as Record<string, number>)[track.property] = evaluateTrack(
            track.keyframes, playheadTime, easingFn, track.property as AnimatableProperty,
          )
        }
        overrides.set(clip.elementId, { ...overrides.get(clip.elementId), ...patch })
      }
      const scrubbed = elements.map((el) => {
        if (manipulatedIds.has(el.id)) return el
        const patch = overrides.get(el.id)
        return patch ? { ...el, ...patch } : el
      })
      // Skip animated + manipulated elements in layout animator
      const skipIds = new Set([...manipulatedIds, ...overrides.keys()])
      return layoutAnimator.tick(scrubbed, springParams, skipIds.size > 0 ? skipIds : undefined)
    }
    return layoutAnimator.tick(elements, springParams, manipulatedIds.size > 0 ? manipulatedIds : undefined)
  }

  // 3. Editing mode — spring physics
  return layoutAnimator.tick(elements, springParams, manipulatedIds.size > 0 ? manipulatedIds : undefined)
}
