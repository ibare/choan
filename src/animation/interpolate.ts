// Property value interpolation

import type { AnimatableProperty, Keyframe } from './types'
import { resolveEasing } from './easing'

// Numeric lerp
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Color interpolation in RGB space
function lerpColor(from: number, to: number, t: number): number {
  const fr = (from >> 16) & 0xFF
  const fg = (from >> 8) & 0xFF
  const fb = from & 0xFF
  const tr = (to >> 16) & 0xFF
  const tg = (to >> 8) & 0xFF
  const tb = to & 0xFF

  const r = Math.round(lerp(fr, tr, t))
  const g = Math.round(lerp(fg, tg, t))
  const b = Math.round(lerp(fb, tb, t))

  return (Math.max(0, Math.min(255, r)) << 16)
       | (Math.max(0, Math.min(255, g)) << 8)
       | Math.max(0, Math.min(255, b))
}

// Interpolate a single property value
export function interpolateValue(
  property: AnimatableProperty,
  from: number,
  to: number,
  t: number,
): number {
  if (property === 'color') return lerpColor(from, to, t)

  const v = lerp(from, to, t)

  // Clamp by property constraints
  if (property === 'opacity' || property === 'radius') return Math.max(0, Math.min(1, v))
  if (property === 'width' || property === 'height') return Math.max(1, v)
  return v
}

// Evaluate a keyframe track at a given time, returning the interpolated value.
// Per-keyframe easing: each keyframe's `easing` field defines the curve to the next keyframe.
// `fallbackEasing` is used when a keyframe has no easing set.
export function evaluateTrack(
  keyframes: Keyframe[],
  time: number,
  fallbackEasing: string | ((t: number) => number),
  property: AnimatableProperty,
): number {
  if (keyframes.length === 0) return 0
  if (keyframes.length === 1) return keyframes[0].value

  // Before first keyframe
  if (time <= keyframes[0].time) return keyframes[0].value

  // After last keyframe
  const last = keyframes[keyframes.length - 1]
  if (time >= last.time) return last.value

  // Find bracketing segment
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]
    const b = keyframes[i + 1]
    if (time >= a.time && time <= b.time) {
      const segDuration = b.time - a.time
      if (segDuration <= 0) return b.value
      const localT = (time - a.time) / segDuration
      // Per-keyframe easing: use this keyframe's easing, fallback to clip-level
      let easingFn: (t: number) => number
      if (a.easing) {
        easingFn = resolveEasing(a.easing)
      } else if (typeof fallbackEasing === 'function') {
        easingFn = fallbackEasing
      } else {
        easingFn = resolveEasing(fallbackEasing)
      }
      const easedT = easingFn(localT)
      return interpolateValue(property, a.value, b.value, easedT)
    }
  }

  return last.value
}
