// Frustum geometry — single source of truth for camera frustum coordinate calculations.
// Both rendering (drawFrustum) and hit testing share this to prevent coordinate mismatch.

import {
  FRUSTUM_DEPTH,
  FRUSTUM_ASPECT,
  FRUSTUM_TRI_HEIGHT,
  FRUSTUM_TRI_HALF_W,
  FRUSTUM_INNER_TRI_SCALE,
} from '../constants'

type V3 = [number, number, number]

export interface FrustumGeometry {
  /** Camera basis vectors */
  forward: V3
  right: V3
  up: V3
  /** Four corners of the near plane: [topLeft, topRight, bottomRight, bottomLeft] */
  corners: [V3, V3, V3, V3]
  /** Outer triangle vertices */
  triLeft: V3
  triRight: V3
  triApex: V3
  /** Outer triangle centroid */
  centroid: V3
  /** Inner (align marker) triangle vertices */
  innerTriLeft: V3
  innerTriRight: V3
  innerTriApex: V3
}

/**
 * Compute all frustum geometry from camera position, target, and FOV.
 * Returns null if the camera and target are too close.
 */
export function computeFrustumGeometry(
  pos: V3,
  target: V3,
  fov: number,
): FrustumGeometry | null {
  // Forward
  let fx = target[0] - pos[0]
  let fy = target[1] - pos[1]
  let fz = target[2] - pos[2]
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  if (fl < 0.001) return null
  fx /= fl; fy /= fl; fz /= fl

  // Right = forward x [0,1,0]
  let rx = -fz
  let ry = 0
  let rz = fx
  const rl = Math.sqrt(rx * rx + ry * ry + rz * rz)
  if (rl < 0.001) return null
  rx /= rl; ry /= rl; rz /= rl

  // Up = right x forward
  const ux = ry * fz - rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy - ry * fx

  const halfAngle = (fov * Math.PI / 180) / 2
  const tanHalf = Math.tan(halfAngle)
  const hw = FRUSTUM_DEPTH * tanHalf
  const hh = hw * FRUSTUM_ASPECT

  // Near plane center
  const cx = pos[0] + fx * FRUSTUM_DEPTH
  const cy = pos[1] + fy * FRUSTUM_DEPTH
  const cz = pos[2] + fz * FRUSTUM_DEPTH

  // Four corners
  const corners: [V3, V3, V3, V3] = [
    [cx - rx * hw + ux * hh, cy - ry * hw + uy * hh, cz - rz * hw + uz * hh],  // top-left
    [cx + rx * hw + ux * hh, cy + ry * hw + uy * hh, cz + rz * hw + uz * hh],  // top-right
    [cx + rx * hw - ux * hh, cy + ry * hw - uy * hh, cz + rz * hw - uz * hh],  // bottom-right
    [cx - rx * hw - ux * hh, cy - ry * hw - uy * hh, cz - rz * hw - uz * hh],  // bottom-left
  ]

  // Triangle above near plane
  const triHeight = hh * FRUSTUM_TRI_HEIGHT
  const triHalfW = hw * FRUSTUM_TRI_HALF_W
  const topMidX = (corners[0][0] + corners[1][0]) / 2
  const topMidY = (corners[0][1] + corners[1][1]) / 2
  const topMidZ = (corners[0][2] + corners[1][2]) / 2

  const triApex: V3 = [topMidX + ux * triHeight, topMidY + uy * triHeight, topMidZ + uz * triHeight]
  const triLeft: V3 = [topMidX - rx * triHalfW, topMidY - ry * triHalfW, topMidZ - rz * triHalfW]
  const triRight: V3 = [topMidX + rx * triHalfW, topMidY + ry * triHalfW, topMidZ + rz * triHalfW]

  // Centroid
  const centroid: V3 = [
    (triLeft[0] + triRight[0] + triApex[0]) / 3,
    (triLeft[1] + triRight[1] + triApex[1]) / 3,
    (triLeft[2] + triRight[2] + triApex[2]) / 3,
  ]

  // Inner triangle (align marker) — scaled toward centroid, offset toward camera to avoid z-fighting
  const s = FRUSTUM_INNER_TRI_SCALE
  const off = 0.05
  const ox = -fx * off, oy = -fy * off, oz = -fz * off
  const innerTriLeft: V3 = [centroid[0] + (triLeft[0] - centroid[0]) * s + ox, centroid[1] + (triLeft[1] - centroid[1]) * s + oy, centroid[2] + (triLeft[2] - centroid[2]) * s + oz]
  const innerTriRight: V3 = [centroid[0] + (triRight[0] - centroid[0]) * s + ox, centroid[1] + (triRight[1] - centroid[1]) * s + oy, centroid[2] + (triRight[2] - centroid[2]) * s + oz]
  const innerTriApex: V3 = [centroid[0] + (triApex[0] - centroid[0]) * s + ox, centroid[1] + (triApex[1] - centroid[1]) * s + oy, centroid[2] + (triApex[2] - centroid[2]) * s + oz]

  return {
    forward: [fx, fy, fz],
    right: [rx, ry, rz],
    up: [ux, uy, uz],
    corners,
    triLeft,
    triRight,
    triApex,
    centroid,
    innerTriLeft,
    innerTriRight,
    innerTriApex,
  }
}
