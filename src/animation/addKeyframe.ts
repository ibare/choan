// Explicit keyframe add/remove/query — Apple Motion 5 style.
// Called from KeyframeButton in the properties panel.
// Auto-creates clip if element is not yet in the bundle.

import type { AnimatableProperty, AnimationClip, KeyframeTrack } from './types'
import { usePreviewStore } from '../store/usePreviewStore'
import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../utils/nanoid'

const SNAP_THRESHOLD = 10 // ms — merge with existing keyframe if within this range

/**
 * Check if a keyframe exists at (or near) the current playhead for a given element+property.
 */
export function hasKeyframeAtPlayhead(
  elementId: string,
  property: AnimatableProperty,
): boolean {
  const { editingBundleId, playheadTime } = usePreviewStore.getState()
  if (!editingBundleId) return false

  const { animationBundles } = useChoanStore.getState()
  const bundle = animationBundles.find((b) => b.id === editingBundleId)
  if (!bundle) return false

  const clip = bundle.clips.find((c) => c.elementId === elementId)
  if (!clip) return false

  const track = clip.tracks.find((t) => t.property === property)
  if (!track) return false

  return track.keyframes.some((kf) => Math.abs(kf.time - playheadTime) < SNAP_THRESHOLD)
}

/**
 * Add a keyframe at the current playhead position.
 * If the element has no clip in the bundle, one is created automatically.
 */
export function addKeyframeAtPlayhead(
  elementId: string,
  property: AnimatableProperty,
  value: number,
): void {
  const { editingBundleId, playheadTime } = usePreviewStore.getState()
  if (!editingBundleId) return

  const store = useChoanStore.getState()
  const bundle = store.animationBundles.find((b) => b.id === editingBundleId)
  if (!bundle) return

  let clip = bundle.clips.find((c) => c.elementId === elementId)

  // Auto-create clip if element not yet in bundle
  if (!clip) {
    const newClip: AnimationClip = {
      id: nanoid(),
      elementId,
      duration: Math.max(300, playheadTime),
      easing: 'ease',
      tracks: [],
    }
    store.addClipToBundle(editingBundleId, newClip)
    clip = newClip
  }

  const trackIdx = clip.tracks.findIndex((t) => t.property === property)

  let newTracks: KeyframeTrack[]

  if (trackIdx < 0) {
    // New track — single keyframe at playhead
    const newTrack: KeyframeTrack = {
      property,
      keyframes: [{ time: playheadTime, value, easing: 'ease-in-out' }],
    }
    newTracks = [...clip.tracks, newTrack]
  } else {
    // Existing track — add or update keyframe
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

  store.updateClipInBundle(editingBundleId, clip.id, { tracks: newTracks, duration })
}

/**
 * Remove the keyframe at the current playhead position.
 * If the track becomes empty, the track is removed.
 * If the clip has no tracks left, the clip is removed from the bundle.
 */
export function removeKeyframeAtPlayhead(
  elementId: string,
  property: AnimatableProperty,
): void {
  const { editingBundleId, playheadTime } = usePreviewStore.getState()
  if (!editingBundleId) return

  const store = useChoanStore.getState()
  const bundle = store.animationBundles.find((b) => b.id === editingBundleId)
  if (!bundle) return

  const clip = bundle.clips.find((c) => c.elementId === elementId)
  if (!clip) return

  const trackIdx = clip.tracks.findIndex((t) => t.property === property)
  if (trackIdx < 0) return

  const track = clip.tracks[trackIdx]
  const filtered = track.keyframes.filter(
    (kf) => Math.abs(kf.time - playheadTime) >= SNAP_THRESHOLD,
  )

  let newTracks: KeyframeTrack[]
  if (filtered.length === 0) {
    // Track empty — remove it
    newTracks = clip.tracks.filter((_, i) => i !== trackIdx)
  } else {
    newTracks = clip.tracks.map((t, i) => i === trackIdx ? { ...t, keyframes: filtered } : t)
  }

  if (newTracks.length === 0) {
    // Clip has no tracks — remove from bundle
    store.removeClipFromBundle(editingBundleId, clip.id)
  } else {
    const duration = Math.max(300, ...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
    store.updateClipInBundle(editingBundleId, clip.id, { tracks: newTracks, duration })
  }
}

/**
 * Toggle keyframe at playhead: add if absent, remove if present.
 */
export function toggleKeyframeAtPlayhead(
  elementId: string,
  property: AnimatableProperty,
  value: number,
): void {
  if (hasKeyframeAtPlayhead(elementId, property)) {
    removeKeyframeAtPlayhead(elementId, property)
  } else {
    addKeyframeAtPlayhead(elementId, property, value)
  }
}
