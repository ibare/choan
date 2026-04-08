// Motion Path evaluator — pure functions, no store/React imports.
//
// Given an ElementMotionPath and the clip-local time, returns the 3D
// offset/position along the path. Duration falls back to clip.duration
// when the path omits it. loop / reverse / easing are handled uniformly
// before dispatching to the per-type shape evaluator.

import type { ElementMotionPath, LinePath, OrbitPath, Vec3 } from './motionPathTypes'
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
    case 'orbit':
      return evaluateOrbit(path, easedT)
    default: {
      const _exhaustive: never = path
      return _exhaustive
    }
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

/**
 * Evaluate a point on the orbit at parameter t ∈ [0, 1].
 *
 * Builds an orthonormal basis (u, v) in the orbit plane (u · v = 0,
 * both perpendicular to planeNormal), then rotates around the center
 * using the standard parametric circle/ellipse form:
 *
 *     P(θ) = center + u·radiusU·cos(θ) + v·radiusV·sin(θ)
 *
 * Sweep angle and clockwise flag map t into θ; easing is applied before
 * this function, so t here is the already-eased parameter.
 */
function evaluateOrbit(path: OrbitPath, t: number): Vec3 {
  const [u, v] = orthonormalBasisFromNormal(path.planeNormal)
  const direction = path.clockwise ? -1 : 1
  const theta = path.startAngle + path.sweepAngle * direction * t
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const [cx, cy, cz] = path.center
  const ru = path.radiusU
  const rv = path.radiusV
  return [
    cx + u[0] * ru * cosT + v[0] * rv * sinT,
    cy + u[1] * ru * cosT + v[1] * rv * sinT,
    cz + u[2] * ru * cosT + v[2] * rv * sinT,
  ]
}

/**
 * Build an orthonormal basis (u, v) perpendicular to the given normal.
 *
 * Numerically stable: picks the world axis least aligned with the
 * normalized normal, so the first cross product is never near zero.
 * Both returned vectors are unit length and mutually perpendicular to
 * each other and to the normal.
 */
function orthonormalBasisFromNormal(n: Vec3): [Vec3, Vec3] {
  const len = Math.hypot(n[0], n[1], n[2]) || 1
  const nn: Vec3 = [n[0] / len, n[1] / len, n[2] / len]

  // Pick the world axis least parallel to nn for the first cross product.
  const ax = Math.abs(nn[0])
  const ay = Math.abs(nn[1])
  const az = Math.abs(nn[2])
  const axis: Vec3 =
    ax <= ay && ax <= az ? [1, 0, 0]
    : ay <= az ? [0, 1, 0]
    : [0, 0, 1]

  // u = normalize(nn × axis)
  const ux = nn[1] * axis[2] - nn[2] * axis[1]
  const uy = nn[2] * axis[0] - nn[0] * axis[2]
  const uz = nn[0] * axis[1] - nn[1] * axis[0]
  const ulen = Math.hypot(ux, uy, uz) || 1
  const u: Vec3 = [ux / ulen, uy / ulen, uz / ulen]

  // v = nn × u — already unit length since nn ⊥ u and both are unit vectors.
  const v: Vec3 = [
    nn[1] * u[2] - nn[2] * u[1],
    nn[2] * u[0] - nn[0] * u[2],
    nn[0] * u[1] - nn[1] * u[0],
  ]
  return [u, v]
}

/** The starting point of the path — used as a safe fallback when duration ≤ 0. */
function pathStart(path: ElementMotionPath): Vec3 {
  switch (path.type) {
    case 'line':
      return [path.p0[0], path.p0[1], path.p0[2]]
    case 'orbit':
      return evaluateOrbit(path, 0)
    default: {
      const _exhaustive: never = path
      return _exhaustive
    }
  }
}
