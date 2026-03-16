// Auto-keyframe: when editing an animation bundle, property changes
// automatically create/update keyframes at the current playhead time.

import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import type { AnimatableProperty } from './types'

const SNAP_THRESHOLD = 10 // ms — merge with existing keyframe if within this range

/**
 * Automatically insert or update a keyframe at the current playhead time.
 * Call this whenever an animatable property changes during animation editing.
 *
 * @param elementId - the element whose property changed
 * @param property - which property changed
 * @param value - the new value
 * @param originalValue - the value before the change (used to create t=0 keyframe if track is new)
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

  const clip = bundle.clips.find((c) => c.elementId === elementId)
  if (!clip) return

  const trackIdx = clip.tracks.findIndex((t) => t.property === property)

  if (trackIdx < 0) {
    // No track for this property — create one with t=0 (original) + t=playhead (new)
    const startValue = originalValue ?? value
    const newTrack = {
      property,
      keyframes: playheadTime === 0
        ? [{ time: 0, value }]
        : [{ time: 0, value: startValue }, { time: playheadTime, value }],
    }
    const newTracks = [...clip.tracks, newTrack]
    const dur = Math.max(clip.duration, ...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
    store.updateClipInBundle(editingBundleId, clip.id, { tracks: newTracks, duration: dur })
  } else {
    // Track exists — add or update keyframe at playhead time
    const track = clip.tracks[trackIdx]
    const existingIdx = track.keyframes.findIndex((kf) => Math.abs(kf.time - playheadTime) < SNAP_THRESHOLD)

    let newKfs
    if (existingIdx >= 0) {
      // Update existing keyframe value
      newKfs = track.keyframes.map((kf, i) =>
        i === existingIdx ? { ...kf, value } : kf,
      )
    } else {
      // Insert new keyframe
      newKfs = [...track.keyframes, { time: playheadTime, value }].sort((a, b) => a.time - b.time)
    }

    const newTracks = clip.tracks.map((t, i) =>
      i === trackIdx ? { ...t, keyframes: newKfs } : t,
    )
    const dur = Math.max(clip.duration, ...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
    store.updateClipInBundle(editingBundleId, clip.id, { tracks: newTracks, duration: dur })
  }
}
