// Director animation evaluator — evaluates multiple active bundles at once.
// Collects property overrides from all active events, last-write-wins for conflicts.
// Pure function, no React/Zustand imports.

import type { ChoanElement } from '../store/useElementStore'
import type { AnimatableProperty } from './types'
import type { ActiveBundleEvent } from './directorEventEvaluator'
import { evaluateTrack } from './interpolate'
import { resolveEasing } from './easing'

/**
 * Evaluate all active bundles at their respective local times and produce
 * the final element array with all property overrides applied.
 * Later events in the array take priority (last-write-wins).
 */
export function evaluateDirectorFrame(
  elements: ChoanElement[],
  activeEvents: ActiveBundleEvent[],
): ChoanElement[] {
  if (activeEvents.length === 0) return elements

  // Collect overrides: elementId → property → value
  const overrides = new Map<string, Map<AnimatableProperty, number>>()

  for (const event of activeEvents) {
    const easingFn = resolveEasing('ease-in-out')

    for (const clip of event.bundle.clips) {
      for (const track of clip.tracks) {
        if (track.keyframes.length < 2) continue
        const value = evaluateTrack(
          track.keyframes,
          event.localTime,
          easingFn,
          track.property,
        )

        if (!overrides.has(clip.elementId)) {
          overrides.set(clip.elementId, new Map())
        }
        overrides.get(clip.elementId)!.set(track.property, value)
      }
    }
  }

  // Apply overrides to elements
  if (overrides.size === 0) return elements

  return elements.map((el) => {
    const elOverrides = overrides.get(el.id)
    if (!elOverrides) return el

    const patch: Partial<ChoanElement> = {}
    for (const [prop, value] of elOverrides) {
      (patch as Record<string, number>)[prop] = value
    }
    return { ...el, ...patch }
  })
}
