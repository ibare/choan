// Director event evaluator — determines which bundles are active at a given time.
// Pure function, no React/Zustand imports.

import type { EventMarker } from './directorTypes'
import type { AnimationBundle } from './types'

export interface ActiveBundleEvent {
  bundleId: string
  localTime: number  // time within the bundle (0..duration)
  bundle: AnimationBundle
}

/**
 * Given absolute time, find all active event markers and compute their local time.
 * A marker is active when absoluteTime ∈ [marker.time, marker.time + effectiveDuration).
 */
export function evaluateDirectorEvents(
  markers: EventMarker[],
  absoluteTime: number,
  bundles: AnimationBundle[],
): ActiveBundleEvent[] {
  const result: ActiveBundleEvent[] = []

  for (const marker of markers) {
    const bundle = bundles.find((b) => b.id === marker.bundleId)
    if (!bundle) continue

    const bundleDuration = Math.max(
      1,
      ...bundle.clips.map((c) => c.duration),
    )
    const effectiveDuration = marker.durationOverride ?? bundleDuration

    if (absoluteTime >= marker.time) {
      let localTime = Math.min(absoluteTime - marker.time, effectiveDuration)

      // Scale local time to match original bundle duration
      if (marker.durationOverride && marker.durationOverride !== bundleDuration) {
        localTime = (localTime / marker.durationOverride) * bundleDuration
      } else if (localTime >= effectiveDuration) {
        localTime = bundleDuration  // clamp to end
      }

      result.push({ bundleId: marker.bundleId, localTime, bundle })
    }
  }

  return result
}
