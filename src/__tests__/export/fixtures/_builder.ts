/**
 * Fixture builder helpers — thin wrappers to reduce boilerplate.
 * IDs are explicit strings so snapshots remain stable across runs.
 */
import type { ChoanElement } from '../../../store/useElementStore'
import type { AnimationBundle, AnimationClip, KeyframeTrack, AnimatableProperty } from '../../../animation/types'

// ── Element factory ──────────────────────────────────────────────────────────

export function el(
  id: string,
  label: string,
  overrides: Partial<ChoanElement> = {},
): ChoanElement {
  return {
    id,
    type: 'rectangle',
    label,
    x: 0, y: 0, z: 0,
    width: 100, height: 100,
    ...overrides,
  }
}

/** Container (role: 'container') shorthand */
export function ctr(
  id: string,
  label: string,
  overrides: Partial<ChoanElement> = {},
): ChoanElement {
  return el(id, label, { role: 'container', ...overrides })
}

/** Child element — sets parentId automatically */
export function child(
  id: string,
  label: string,
  parentId: string,
  overrides: Partial<ChoanElement> = {},
): ChoanElement {
  return el(id, label, { parentId, ...overrides })
}

// ── Animation factories ───────────────────────────────────────────────────────

export function kf(time: number, value: number) {
  return { time, value }
}

export function tr(
  property: AnimatableProperty,
  keyframes: Array<{ time: number; value: number }>,
): KeyframeTrack {
  return { property, keyframes }
}

export function clip(
  id: string,
  elementId: string,
  tracks: KeyframeTrack[],
  duration = 300,
): AnimationClip {
  const maxTime = Math.max(...tracks.flatMap((t) => t.keyframes.map((k) => k.time)))
  return { id, elementId, duration: maxTime || duration, easing: 'ease-in-out', tracks }
}

export function bundle(id: string, name: string, clips: AnimationClip[]): AnimationBundle {
  return { id, name, clips }
}
