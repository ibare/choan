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

/** Discriminated union of all supported motion path types. */
export type ElementMotionPath = LinePath
