// Coordinate system transforms — single source of truth.
//
// Elements are stored in a fixed reference pixel coordinate system (REF_W × REF_H).
// This ensures world positions are independent of the actual canvas size.
// When the canvas is wider/taller, the camera frustum reveals more area,
// but element positions remain stable — like zooming out, not moving objects.
//
// The mapping uses an orthographic projection where:
//   - World X: left = -FRUSTUM*REF_ASPECT, right = +FRUSTUM*REF_ASPECT
//   - World Y: top = +FRUSTUM, bottom = -FRUSTUM
//   - Pixel origin: top-left corner of the reference frame

import { FRUSTUM } from '../engine/scene'

// ── Fixed reference resolution ───────────────────────────────────────────────
// All pixel↔world conversions use this fixed frame so that element positions
// are independent of the actual canvas size.

export const REF_W = 1920
export const REF_H = 1080
export const REF_ASPECT = REF_W / REF_H

// ── Core transforms ──────────────────────────────────────────────────────────

/**
 * Pixel → world (orthographic, fixed reference frame).
 * The canvasW/canvasH parameters are accepted for API compatibility but ignored.
 * All conversions use the fixed REF_W × REF_H reference resolution.
 */
export function pixelToWorld(
  px: number,
  py: number,
): [number, number] {
  return [
    -FRUSTUM * REF_ASPECT + (px / REF_W) * 2 * FRUSTUM * REF_ASPECT,
    FRUSTUM - (py / REF_H) * 2 * FRUSTUM,
  ]
}

/**
 * World → pixel (orthographic, fixed reference frame).
 * The canvasW/canvasH parameters are accepted for API compatibility but ignored.
 */
export function worldToPixel(
  wx: number,
  wy: number,
): [number, number] {
  return [
    ((wx + FRUSTUM * REF_ASPECT) / (2 * FRUSTUM * REF_ASPECT)) * REF_W,
    ((FRUSTUM - wy) / (2 * FRUSTUM)) * REF_H,
  ]
}

/**
 * Convert a pixel width to its world-space equivalent (unsigned).
 */
export function pixelWidthToWorld(pixW: number): number {
  return (pixW / REF_W) * 2 * FRUSTUM * REF_ASPECT
}

/**
 * Convert a pixel height to its world-space equivalent (unsigned).
 */
export function pixelHeightToWorld(pixH: number): number {
  return (pixH / REF_H) * 2 * FRUSTUM
}

/**
 * Convert actual canvas pixel coordinates to reference-frame pixel coordinates.
 * Use this at mouse input boundaries to map screen clicks to the fixed coordinate system.
 */
export function canvasToRefPixel(
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
): [number, number] {
  return [
    canvasX * (REF_W / canvasW),
    canvasY * (REF_H / canvasH),
  ]
}

// ── Ray intersection utilities (pure math, no camera/engine imports) ─────────

type V3 = [number, number, number]

/**
 * Ray–plane intersection.
 * Returns the 3D world point where the ray hits the plane, or null.
 * planeNormal must be non-zero. The plane is defined by dot(normal, P - planePoint) = 0.
 */
export function rayPlaneIntersect(
  ro: V3, rd: V3,
  planeNormal: V3, planePoint: V3,
): V3 | null {
  const denom = planeNormal[0] * rd[0] + planeNormal[1] * rd[1] + planeNormal[2] * rd[2]
  if (Math.abs(denom) < 1e-10) return null  // parallel
  const wx = planePoint[0] - ro[0]
  const wy = planePoint[1] - ro[1]
  const wz = planePoint[2] - ro[2]
  const t = (planeNormal[0] * wx + planeNormal[1] * wy + planeNormal[2] * wz) / denom
  if (t < 0) return null  // behind camera
  return [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]
}

/**
 * Closest-point-on-axis to a ray.
 * Returns the parameter `t` along the axis: worldPoint = axisOrigin + t * axisDir.
 * axisDir should be a unit vector.
 */
export function rayAxisClosestT(
  ro: V3, rd: V3,
  axisOrigin: V3, axisDir: V3,
): number | null {
  const wx = axisOrigin[0] - ro[0]
  const wy = axisOrigin[1] - ro[1]
  const wz = axisOrigin[2] - ro[2]
  const a = axisDir[0] * axisDir[0] + axisDir[1] * axisDir[1] + axisDir[2] * axisDir[2]
  const b = axisDir[0] * rd[0] + axisDir[1] * rd[1] + axisDir[2] * rd[2]
  const c = rd[0] * rd[0] + rd[1] * rd[1] + rd[2] * rd[2]
  const d = axisDir[0] * wx + axisDir[1] * wy + axisDir[2] * wz
  const e = rd[0] * wx + rd[1] * wy + rd[2] * wz
  const denom = a * c - b * b
  if (Math.abs(denom) < 1e-10) return null  // ray parallel to axis
  return (b * e - c * d) / denom
}
