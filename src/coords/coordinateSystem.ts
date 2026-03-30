// Coordinate system transforms — single source of truth.
//
// The canvas uses an orthographic projection where:
//   - World X: left = -FRUSTUM*aspect, right = +FRUSTUM*aspect
//   - World Y: top = +FRUSTUM, bottom = -FRUSTUM
//   - Pixel origin: top-left corner
//
// All three previous copies of these formulas (SDFCanvas.tsx worldToPixel,
// SDFCanvas.tsx pixelToWorld, SDFCanvas.tsx p2w closure, engine/scene.ts update())
// now derive from this module.

import { FRUSTUM } from '../engine/scene'

// ── Core transforms ──────────────────────────────────────────────────────────

/**
 * Pixel → world (orthographic).
 * Returns [wx, wy] tuple for direct use in Float32Array spreads.
 */
export function pixelToWorld(
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
): [number, number] {
  const aspect = canvasW / canvasH
  return [
    -FRUSTUM * aspect + (px / canvasW) * 2 * FRUSTUM * aspect,
    FRUSTUM - (py / canvasH) * 2 * FRUSTUM,
  ]
}

/**
 * World → pixel (orthographic).
 * Returns [px, py] tuple.
 */
export function worldToPixel(
  wx: number,
  wy: number,
  canvasW: number,
  canvasH: number,
): [number, number] {
  const aspect = canvasW / canvasH
  return [
    ((wx + FRUSTUM * aspect) / (2 * FRUSTUM * aspect)) * canvasW,
    ((FRUSTUM - wy) / (2 * FRUSTUM)) * canvasH,
  ]
}

/**
 * Convert a pixel width to its world-space equivalent (unsigned).
 * Useful for computing world-space half-sizes for UBO packing.
 */
export function pixelWidthToWorld(pixW: number, canvasW: number, canvasH: number): number {
  const aspect = canvasW / canvasH
  return (pixW / canvasW) * 2 * FRUSTUM * aspect
}

/**
 * Convert a pixel height to its world-space equivalent (unsigned).
 */
export function pixelHeightToWorld(pixH: number, canvasH: number): number {
  return (pixH / canvasH) * 2 * FRUSTUM
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
