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
import { propagateParentDelta } from './propagateDelta'
import { evaluateMotionPath } from './motionPathEvaluator'
import type { AnimatableProperty } from './types'

export interface ActiveBundleInput {
  bundle: AnimationBundle
  localTime: number
}

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
  scrubHeldIds: ReadonlySet<string>
  /** Director mode: multiple bundles evaluated simultaneously */
  activeBundles?: ActiveBundleInput[]
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
    scrubHeldIds,
    activeBundles,
  } = input

  // 0. Director mode — multiple bundles evaluated simultaneously
  if (activeBundles && activeBundles.length > 0) {
    return evaluateBundles(elements, activeBundles)
  }

  // 1. Playback mode — keyframe engine drives all values
  if (previewState === 'playing') {
    return kfAnimator.tick(elements, performance.now())
  }

  // 2. Scrub mode — evaluate bundle clips at playhead time
  //    Then apply layout animator for non-animated elements so spring
  //    physics (e.g. size transitions) keep working during editing.
  if (editingBundleId && previewState === 'stopped') {
    const bundle = animationBundles.find((b) => b.id === editingBundleId)
    if (bundle && bundle.clips.some((c) => c.tracks.length > 0 || c.motionPath)) {
      const overrides = collectBundleOverrides(elements, [{ bundle, localTime: playheadTime }])

      propagateParentDelta(elements, overrides)

      const scrubbed = elements.map((el) => {
        if (manipulatedIds.has(el.id) || scrubHeldIds.has(el.id)) return el
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

/**
 * Collect property overrides from multiple bundles. Last-write-wins for conflicts.
 *
 * For each clip, tracks are evaluated first into `patch`, then `motionPath`
 * is applied on top: `relative` adds the motion path output to the base
 * value (patch value if present, else the element's current value), while
 * `absolute` replaces x/y/z entirely.
 */
function collectBundleOverrides(
  elements: ChoanElement[],
  bundles: ActiveBundleInput[],
): Map<string, Partial<ChoanElement>> {
  const elById = new Map(elements.map((el) => [el.id, el]))
  const overrides = new Map<string, Partial<ChoanElement>>()
  for (const { bundle, localTime } of bundles) {
    for (const clip of bundle.clips) {
      const hasTracks = clip.tracks.length > 0
      const hasMotionPath = clip.motionPath != null
      if (!hasTracks && !hasMotionPath) continue

      const easingFn = resolveEasing(clip.easing)
      const patch: Partial<ChoanElement> = {}

      if (hasTracks) {
        for (const track of clip.tracks) {
          ;(patch as Record<string, number>)[track.property] = evaluateTrack(
            track.keyframes, localTime, easingFn, track.property as AnimatableProperty,
          )
        }
      }

      if (hasMotionPath && clip.motionPath) {
        const el = elById.get(clip.elementId)
        if (el) {
          const [mx, my, mz] = evaluateMotionPath(clip.motionPath, localTime, clip.duration)
          if (clip.motionPath.originMode === 'absolute') {
            patch.x = mx
            patch.y = my
            patch.z = mz
          } else {
            const baseX = patch.x !== undefined ? patch.x : el.x
            const baseY = patch.y !== undefined ? patch.y : el.y
            const baseZ = patch.z !== undefined ? patch.z : el.z
            patch.x = baseX + mx
            patch.y = baseY + my
            patch.z = baseZ + mz
          }
        }
      }

      overrides.set(clip.elementId, { ...overrides.get(clip.elementId), ...patch })
    }
  }
  return overrides
}

/** Evaluate multiple bundles and apply overrides with parent-child propagation. */
export function evaluateBundles(elements: ChoanElement[], bundles: ActiveBundleInput[]): ChoanElement[] {
  const overrides = collectBundleOverrides(elements, bundles)
  if (overrides.size === 0) return elements

  propagateParentDelta(elements, overrides)

  return elements.map((el) => {
    const patch = overrides.get(el.id)
    return patch ? { ...el, ...patch } : el
  })
}
