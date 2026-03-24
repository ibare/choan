// Ghost preview (onion-skin) — pure function, no store imports.
//
// Given a bundle and the current playhead time, generates semi-transparent
// "ghost" copies of animated elements at sampled time points so the user
// can see the full motion arc while scrubbing.

import type { ChoanElement } from '../store/useChoanStore'
import type { AnimationBundle } from '../animation/types'
import type { AnimatableProperty } from '../animation/types'
import { evaluateTrack } from '../animation/interpolate'
import {
  GHOST_OPACITY_INBETWEEN,
  GHOST_KEYFRAME_EPSILON,
  GHOST_FPS_MS,
} from '../constants'
import { MAX_OBJECTS } from '../engine/scene'

/**
 * Generate ghost (onion-skin) element copies for the given animation bundle.
 * Returns the base element array extended with ghost copies.
 * Ghost copies have prefixed IDs (`__ghost_<id>_<time>`) so they are
 * never selected or interacted with.
 */
export function addGhostElements(
  animatedElements: ChoanElement[],
  baseElements: ChoanElement[],
  bundle: AnimationBundle,
  playheadTime: number,
): ChoanElement[] {
  if (!bundle.clips.some((c) => c.tracks.length > 0)) return animatedElements

  const maxDur = Math.max(...bundle.clips.map((c) => c.duration))

  // Collect exact keyframe times
  const kfTimes = new Set<number>()
  for (const clip of bundle.clips) {
    for (const track of clip.tracks) {
      for (const kf of track.keyframes) kfTimes.add(kf.time)
    }
  }

  // Compute how many ghost frames fit within the GPU object budget
  const animatedElCount = bundle.clips.filter((c) => c.tracks.length > 0).length
  const availableSlots = MAX_OBJECTS - baseElements.length
  const maxGhostFrames = animatedElCount > 0 ? Math.floor(availableSlots / animatedElCount) : 0
  const idealSteps = Math.max(2, Math.ceil(maxDur / GHOST_FPS_MS))
  const ghostSteps = Math.min(idealSteps, maxGhostFrames)

  // Build time sample list (uniform + exact keyframe times)
  const allTimes: number[] = []
  for (let step = 0; step <= ghostSteps; step++) {
    allTimes.push(Math.round((step / ghostSteps) * maxDur))
  }
  for (const kt of kfTimes) {
    if (!allTimes.some((t) => Math.abs(t - kt) < GHOST_KEYFRAME_EPSILON)) allTimes.push(kt)
  }
  allTimes.sort((a, b) => a - b)

  const ghostElements: ChoanElement[] = []

  for (const t of allTimes) {
    // Skip the time window around the current playhead (already shown by the live element)
    if (Math.abs(t - playheadTime) < maxDur / (ghostSteps * 2)) continue

    const isKeyframeTime = [...kfTimes].some((kt) => Math.abs(kt - t) < GHOST_KEYFRAME_EPSILON)
    const ghostOverrides = new Map<string, Partial<ChoanElement>>()

    for (const clip of bundle.clips) {
      if (clip.tracks.length === 0) continue
      const patch: Partial<ChoanElement> = {}
      for (const track of clip.tracks) {
        ;(patch as Record<string, number>)[track.property] = evaluateTrack(
          track.keyframes, t, clip.easing, track.property as AnimatableProperty,
        )
      }
      ghostOverrides.set(clip.elementId, { ...ghostOverrides.get(clip.elementId), ...patch })
    }

    for (const el of baseElements) {
      const patch = ghostOverrides.get(el.id)
      if (patch) {
        ghostElements.push({
          ...el, ...patch,
          id: `__ghost_${el.id}_${Math.round(t)}`,
          opacity: isKeyframeTime ? 1 : GHOST_OPACITY_INBETWEEN,
        })
      }
    }
  }

  return [...ghostElements, ...animatedElements]
}
