// Auto-keyframe: when editing an animation bundle, property changes
// automatically create/update keyframes at the current playhead time.
//
// This module is a pure function — it receives all context as parameters
// and returns a bundle patch instead of writing to the store directly.
// The caller is responsible for applying the patch via store.updateClipInBundle().

import type { AnimatableProperty, AnimationBundle } from './types'
import type { AnimationClip, KeyframeTrack } from './types'

const SNAP_THRESHOLD = 10 // ms — merge with existing keyframe if within this range

export interface AutoKeyframePatch {
  bundleId: string
  clipId: string
  patch: Partial<AnimationClip>
}

/**
 * Compute the bundle clip mutation needed to insert/update a keyframe at playheadTime.
 * Returns null when no action is needed (no active bundle, no matching clip, etc.)
 *
 * @param bundle       - the currently-edited animation bundle
 * @param playheadTime - current scrub position in ms
 * @param elementId    - the element whose property changed
 * @param property     - which property changed
 * @param value        - the new value
 * @param originalValue - the value before the change (used to seed t=0 on new tracks)
 */
export function computeAutoKeyframe(
  bundle: AnimationBundle,
  playheadTime: number,
  elementId: string,
  property: AnimatableProperty,
  value: number,
  originalValue?: number,
): AutoKeyframePatch | null {
  const clip = bundle.clips.find((c) => c.elementId === elementId)
  if (!clip) return null

  const trackIdx = clip.tracks.findIndex((t) => t.property === property)

  let newTracks: KeyframeTrack[]

  if (trackIdx < 0) {
    // No track for this property — create one with t=0 (original) + t=playhead (new)
    const startValue = originalValue ?? value
    const newTrack: KeyframeTrack = {
      property,
      keyframes: playheadTime === 0
        ? [{ time: 0, value, easing: 'ease-in-out' as const }]
        : [
            { time: 0, value: startValue, easing: 'ease-in-out' as const },
            { time: playheadTime, value },
          ],
    }
    newTracks = [...clip.tracks, newTrack]
  } else {
    // Track exists — add or update keyframe at playhead time
    const track = clip.tracks[trackIdx]
    const existingIdx = track.keyframes.findIndex(
      (kf) => Math.abs(kf.time - playheadTime) < SNAP_THRESHOLD,
    )
    const newKfs = existingIdx >= 0
      ? track.keyframes.map((kf, i) => i === existingIdx ? { ...kf, value } : kf)
      : [...track.keyframes, { time: playheadTime, value, easing: 'ease-in-out' as const }]
          .sort((a, b) => a.time - b.time)

    newTracks = clip.tracks.map((t, i) => i === trackIdx ? { ...t, keyframes: newKfs } : t)
  }

  const duration = Math.max(clip.duration, ...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))

  return {
    bundleId: bundle.id,
    clipId: clip.id,
    patch: { tracks: newTracks, duration },
  }
}

// ── Convenience wrapper for callers that still use the store directly ─────────
// Keeps backward compatibility without importing stores into this module.

import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'

/**
 * @deprecated Prefer computeAutoKeyframe() + store.updateClipInBundle() for
 * cleaner separation. This wrapper exists for call sites not yet migrated.
 */
export function autoKeyframe(
  elementId: string,
  property: AnimatableProperty,
  value: number,
  originalValue?: number,
): void {
  const { editingBundleId, playheadTime } = usePreviewStore.getState()
  if (!editingBundleId) return

  const store = useChoanStore.getState()
  const bundle = store.animationBundles.find((b) => b.id === editingBundleId)
  if (!bundle) return

  const result = computeAutoKeyframe(bundle, playheadTime, elementId, property, value, originalValue)
  if (result) {
    store.updateClipInBundle(result.bundleId, result.clipId, result.patch)
  }
}
