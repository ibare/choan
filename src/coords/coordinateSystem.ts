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
