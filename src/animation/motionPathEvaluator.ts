// Motion Path evaluator — pure functions, no store/React imports.
//
// Given an ElementMotionPath and the clip-local time, returns the 3D
// offset/position along the path. Duration falls back to clip.duration
// when the path omits it. loop / reverse / easing are handled uniformly
// before dispatching to the per-type shape evaluator.

import type { ElementMotionPath, LinePath, Vec3 } from './motionPathTypes'
import { resolveEasing } from './easing'

/**
 * Evaluate a motion path at the given local time.
 * @param path         Path descriptor (discriminated union by type).
 * @param localTime    Time in ms since the clip started (can exceed duration when looping).
 * @param clipDuration Fallback duration in ms when path.duration is undefined.
 * @returns [x, y, z] in the path's coordinate frame. Interpretation
 *          (relative vs absolute) is the caller's responsibility.
 */
export function evaluateMotionPath(
  path: ElementMotionPath,
  localTime: number,
  clipDuration: number,
): Vec3 {
  const duration = path.duration ?? clipDuration
  if (duration <= 0) return pathStart(path)

  // Normalize time → t in [0, 1]
  let t: number
  if (path.loop) {
    const phase = ((localTime % duration) + duration) % duration
    t = phase / duration
  } else {
    t = Math.max(0, Math.min(1, localTime / duration))
  }
  if (path.reverse) t = 1 - t

  // Apply speed profile along the path
  const easingFn = resolveEasing(path.easing)
  const easedT = easingFn(t)

  switch (path.type) {
    case 'line':
      return evaluateLine(path, easedT)
  }
}

/** Linear interpolation between p0 and p1. */
function evaluateLine(path: LinePath, t: number): Vec3 {
  const [x0, y0, z0] = path.p0
  const [x1, y1, z1] = path.p1
  return [
    x0 + (x1 - x0) * t,
    y0 + (y1 - y0) * t,
    z0 + (z1 - z0) * t,
  ]
}

/** The starting point of the path — used as a safe fallback when duration ≤ 0. */
function pathStart(path: ElementMotionPath): Vec3 {
  switch (path.type) {
    case 'line':
      return [path.p0[0], path.p0[1], path.p0[2]]
  }
}
