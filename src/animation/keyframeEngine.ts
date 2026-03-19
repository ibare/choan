// Keyframe animation engine — tick-based playback with easing and interpolation
// Snapshots element values before animation starts so they can be restored on stop.

import type { ChoanElement } from '../store/useChoanStore'
import type { AnimationClip } from './types'
import { evaluateTrack } from './interpolate'

interface RunningAnimation {
  clip: AnimationClip
  startTime: number
  interactionId: string
}

export type OnAnimationComplete = (elementId: string, finalValues: Partial<ChoanElement>) => void

export interface KeyframeAnimator {
  start(clip: AnimationClip, interactionId: string, now: number): void
  stop(clipId: string): void
  stopAll(): void
  tick(elements: ChoanElement[], now: number): ChoanElement[]
  isAnimating(): boolean
  getProgress(clipId: string): number
  saveSnapshot(elements: ChoanElement[]): void
  getSnapshot(): ChoanElement[] | null
  clearSnapshot(): void
  onComplete: OnAnimationComplete | null
}

export function createKeyframeAnimator(): KeyframeAnimator {
  const running = new Map<string, RunningAnimation>()
  let snapshot: ChoanElement[] | null = null
  let onComplete: OnAnimationComplete | null = null

  function saveSnapshot(elements: ChoanElement[]) {
    // Deep-enough clone: spread each element
    snapshot = elements.map((el) => ({ ...el }))
  }

  function getSnapshot(): ChoanElement[] | null {
    return snapshot
  }

  function clearSnapshot() {
    snapshot = null
  }

  function start(clip: AnimationClip, interactionId: string, now: number) {
    // Stop any existing animation on the same element
    for (const [id, anim] of running) {
      if (anim.clip.elementId === clip.elementId) {
        running.delete(id)
      }
    }

    running.set(clip.id, {
      clip,
      startTime: now,
      interactionId,
    })
  }

  function stop(clipId: string) {
    running.delete(clipId)
  }

  function stopAll() {
    running.clear()
  }

  function tick(elements: ChoanElement[], now: number): ChoanElement[] {
    if (running.size === 0) return elements

    // Collect property overrides per element
    const overrides = new Map<string, Partial<ChoanElement>>()
    const completed: string[] = []

    for (const [clipId, anim] of running) {
      const elapsed = now - anim.startTime
      const { clip } = anim

      if (elapsed >= clip.duration) {
        // Apply final values
        const final: Partial<ChoanElement> = {}
        for (const track of clip.tracks) {
          const lastKf = track.keyframes[track.keyframes.length - 1]
          ;(final as Record<string, number>)[track.property] = lastKf.value
        }
        const existing = overrides.get(clip.elementId) ?? {}
        overrides.set(clip.elementId, { ...existing, ...final })
        completed.push(clipId)
        continue
      }

      // Interpolate each track (per-keyframe easing with clip-level fallback)
      const patch: Partial<ChoanElement> = {}
      for (const track of clip.tracks) {
        const value = evaluateTrack(track.keyframes, elapsed, clip.easing, track.property)
        ;(patch as Record<string, number>)[track.property] = value
      }
      const existing = overrides.get(clip.elementId) ?? {}
      overrides.set(clip.elementId, { ...existing, ...patch })
    }

    // Remove completed animations and persist final values
    for (const id of completed) {
      const anim = running.get(id)
      if (anim && onComplete) {
        const finalValues = overrides.get(anim.clip.elementId)
        if (finalValues) onComplete(anim.clip.elementId, finalValues)
      }
      running.delete(id)
    }

    if (overrides.size === 0) return elements

    // Apply overrides
    return elements.map((el) => {
      const patch = overrides.get(el.id)
      if (!patch) return el
      return { ...el, ...patch }
    })
  }

  function isAnimating(): boolean {
    return running.size > 0
  }

  function getProgress(clipId: string): number {
    const anim = running.get(clipId)
    if (!anim) return 0
    const elapsed = performance.now() - anim.startTime
    return Math.min(1, elapsed / anim.clip.duration)
  }

  return {
    start, stop, stopAll, tick, isAnimating, getProgress,
    saveSnapshot, getSnapshot, clearSnapshot,
    get onComplete() { return onComplete },
    set onComplete(cb: OnAnimationComplete | null) { onComplete = cb },
  }
}
