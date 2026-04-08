// Motion Path type definitions — 3D paths for element animation.
// Evaluated by motionPathEvaluator and applied additively on top of
// keyframe tracks in animationEvaluator.collectBundleOverrides.

import type { EasingType } from './types'

export type Vec3 = [number, number, number]

export type MotionPathOriginMode = 'relative' | 'absolute'

export interface MotionPathBase {
  /** Path traversal duration in ms. If omitted, falls back to clip.duration. */
  duration?: number
  /** Speed profile along the path. */
  easing: EasingType
  /** Loop the path after completion. */
  loop: boolean
  /** Traverse the path backwards (t → 1 - t). */
  reverse: boolean
  /**
   * - 'relative': path result is added to the element's base position (from
   *   its keyframe tracks or rest value).
   * - 'absolute': path result replaces x/y/z entirely.
   */
  originMode: MotionPathOriginMode
}

/** 3D line segment from p0 to p1. */
export interface LinePath extends MotionPathBase {
  type: 'line'
  p0: Vec3
  p1: Vec3
}

/**
 * 3D orbit path — a unified circle/ellipse/arc shape.
 *
 * The orbit lies on the plane defined by `planeNormal` centered at `center`.
 * `radiusU` === `radiusV` produces a circle; unequal radii produce an ellipse.
 * `sweepAngle` === 2π produces a full revolution; less than 2π produces an arc.
 */
export interface OrbitPath extends MotionPathBase {
  type: 'orbit'
  center: Vec3
  /** Major axis radius (= radiusV → circle). */
  radiusU: number
  /** Minor axis radius. */
  radiusV: number
  /** Normal vector of the orbit plane (need not be unit-length). */
  planeNormal: Vec3
  /** Starting angle along the orbit, in radians. */
  startAngle: number
  /** Sweep in radians. 2π = full circle, values < 2π produce arcs. */
  sweepAngle: number
  /** If true, traverses the orbit in the clockwise direction. */
  clockwise: boolean
}

/** Discriminated union of all supported motion path types. */
export type ElementMotionPath = LinePath | OrbitPath

// ── Axis-aligned orbit plane presets ─────────────────────────────────────────
// Normals of the common world-axis-aligned planes. The normal defines the plane
// on which the orbit lies; UI presets select one of these to constrain the orbit.

/** XY plane (normal = +Z). Used for orbits parallel to the ground/screen plane. */
export const PLANE_XY_NORMAL: Vec3 = [0, 0, 1]
/** XZ plane (normal = +Y). Used for vertical orbits seen from above. */
export const PLANE_XZ_NORMAL: Vec3 = [0, 1, 0]
/** YZ plane (normal = +X). Used for side-profile orbits. */
export const PLANE_YZ_NORMAL: Vec3 = [1, 0, 0]
