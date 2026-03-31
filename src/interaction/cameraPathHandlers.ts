// Camera path hit testing and drag computation for 3D keyframe editing.
// Pure functions — no React/Zustand imports.

import type { OverlayRenderer } from '../engine/overlay'
import type { CameraViewKeyframe, DirectorRails, RailHandleId } from '../animation/directorTypes'
import { RAIL_MIN_STUB, truckCircularParams, boomCircularParams, pointOnTruckCircle, pointOnBoomCircle } from '../animation/directorTypes'
import { pixelToWorld } from '../coords/coordinateSystem'

export interface CameraKeyframeHit {
  keyframeId: string
  type: 'position' | 'target'
}

/**
 * Hit test camera keyframe markers in screen space.
 * Projects each keyframe position/target to screen and checks distance.
 */
export function hitTestCameraKeyframe(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  overlay: OverlayRenderer,
  keyframes: CameraViewKeyframe[],
  hitRadius: number,
  altKey: boolean,
): CameraKeyframeHit | null {
  const dpr = window.devicePixelRatio || 1
  const mx = (clientX - canvasRect.left) * dpr
  const my = (clientY - canvasRect.top) * dpr

  let bestDist = hitRadius * dpr
  let bestHit: CameraKeyframeHit | null = null

  for (const kf of keyframes) {
    // Check target first if Alt is held
    if (altKey) {
      const tgtScreen = overlay.projectToScreen(kf.target[0], kf.target[1], kf.target[2])
      const dtgt = Math.sqrt((mx - tgtScreen.px) ** 2 + (my - tgtScreen.py) ** 2)
      if (dtgt < bestDist) {
        bestDist = dtgt
        bestHit = { keyframeId: kf.id, type: 'target' }
      }
    }

    // Check position
    const posScreen = overlay.projectToScreen(kf.position[0], kf.position[1], kf.position[2])
    const dpos = Math.sqrt((mx - posScreen.px) ** 2 + (my - posScreen.py) ** 2)
    if (dpos < bestDist) {
      bestDist = dpos
      bestHit = { keyframeId: kf.id, type: 'position' }
    }
  }

  return bestHit
}

/**
 * Compute the new world position for a dragged camera keyframe.
 * Drags in the XY plane at the keyframe's original Z by default.
 * With shiftKey, adjusts Z instead (vertical drag = Z change).
 */
// ── Rail UX hit testing ───────────────────────────────────────────────────────

const RAIL_OFFSET = 4.5  // must match cameraPathOverlay.ts RAIL_OFFSET

/** Returns the 3D world positions of all rail handles for a given camera setup. */
function getRailHandlePositions(
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  rails: DirectorRails,
  railWorldAnchor: [number, number, number],
): Array<{ handleId: RailHandleId; wx: number; wy: number; wz: number }> {
  const [cx, cy, cz] = cameraPos
  const [ax, ay, az] = railWorldAnchor
  const [tx, , tz] = targetPos
  const o = RAIL_OFFSET
  // Extended rails use anchor, unextended use camera pos
  function base(axisIdx: number, ext: { neg: number; pos: number }): number {
    const isExt = ext.neg > RAIL_MIN_STUB + 0.01 || ext.pos > RAIL_MIN_STUB + 0.01
    return isExt ? railWorldAnchor[axisIdx] : cameraPos[axisIdx]
  }
  const bx = base(0, rails.truck), by = base(1, rails.boom), bz = base(2, rails.dolly)
  const handles: Array<{ handleId: RailHandleId; wx: number; wy: number; wz: number }> = []

  // Truck (X) handles — linear or circular
  if (rails.truckMode === 'circular') {
    const { center, radius, angle: camAngle } = truckCircularParams(cameraPos)
    const isExt = rails.truck.neg > RAIL_MIN_STUB + 0.01 || rails.truck.pos > RAIL_MIN_STUB + 0.01
    const anchorAngle = isExt ? Math.atan2(railWorldAnchor[0], railWorldAnchor[2]) : camAngle
    if (radius > 0.01) {
      const stubAngle = RAIL_MIN_STUB / radius
      const posA = anchorAngle + (isExt ? rails.truck.pos / radius : stubAngle)
      const negA = anchorAngle - (isExt ? rails.truck.neg / radius : stubAngle)
      const posP = pointOnTruckCircle(center, radius, posA)
      const negP = pointOnTruckCircle(center, radius, negA)
      handles.push({ handleId: { axis: 'truck', dir: 'pos' }, wx: posP[0], wy: posP[1], wz: posP[2] })
      handles.push({ handleId: { axis: 'truck', dir: 'neg' }, wx: negP[0], wy: negP[1], wz: negP[2] })
    }
  } else {
    handles.push({ handleId: { axis: 'truck', dir: 'pos' }, wx: bx + o + rails.truck.pos, wy: cy, wz: cz })
    handles.push({ handleId: { axis: 'truck', dir: 'neg' }, wx: bx - o - rails.truck.neg, wy: cy, wz: cz })
  }

  // Boom (Y) handles — linear or circular
  if (rails.boomMode === 'circular') {
    const { radius, elevAngle: camElev, hAngle } = boomCircularParams(cameraPos)
    const isExt = rails.boom.neg > RAIL_MIN_STUB + 0.01 || rails.boom.pos > RAIL_MIN_STUB + 0.01
    const anchorElev = isExt ? boomCircularParams(railWorldAnchor).elevAngle : camElev
    if (radius > 0.01) {
      const stubAngle = RAIL_MIN_STUB / radius
      const posA = anchorElev + (isExt ? rails.boom.pos / radius : stubAngle)
      const negA = anchorElev - (isExt ? rails.boom.neg / radius : stubAngle)
      const posP = pointOnBoomCircle(radius, posA, hAngle)
      const negP = pointOnBoomCircle(radius, negA, hAngle)
      handles.push({ handleId: { axis: 'boom', dir: 'pos' }, wx: posP[0], wy: posP[1], wz: posP[2] })
      handles.push({ handleId: { axis: 'boom', dir: 'neg' }, wx: negP[0], wy: negP[1], wz: negP[2] })
    }
  } else {
    handles.push({ handleId: { axis: 'boom', dir: 'pos' }, wx: cx, wy: by + o + rails.boom.pos, wz: cz })
    handles.push({ handleId: { axis: 'boom', dir: 'neg' }, wx: cx, wy: by - o - rails.boom.neg, wz: cz })
  }

  // Dolly (Z) handles — always linear
  handles.push({ handleId: { axis: 'dolly', dir: 'pos' }, wx: cx, wy: cy, wz: bz + o + rails.dolly.pos })
  handles.push({ handleId: { axis: 'dolly', dir: 'neg' }, wx: cx, wy: cy, wz: bz - o - rails.dolly.neg })
  // Sphere handle: point on circle toward camera (XZ projection)
  const dx = cx - tx
  const dz = cz - tz
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist > 0.001) {
    handles.push({
      handleId: { axis: 'sphere', dir: 'pos' },
      wx: tx + (dx / dist) * rails.sphere,
      wy: cy,
      wz: tz + (dz / dist) * rails.sphere,
    })
  }
  return handles
}

/**
 * Hit test the director camera body (frustum icon).
 * Returns true if the click is within hitRadius px of the projected camera position.
 */
export function hitTestDirectorCameraBody(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  overlay: OverlayRenderer,
  cameraPos: [number, number, number],
  hitRadius: number,
): boolean {
  const dpr = window.devicePixelRatio || 1
  const mx = (clientX - canvasRect.left) * dpr
  const my = (clientY - canvasRect.top)  * dpr
  const s  = overlay.projectToScreen(cameraPos[0], cameraPos[1], cameraPos[2])
  return Math.sqrt((mx - s.px) ** 2 + (my - s.py) ** 2) < hitRadius * dpr
}

export interface RailHandleHit { handleId: RailHandleId }

/**
 * Hit test all rail handles.
 * Returns the closest handle within hitRadius, or null.
 */
export function hitTestRailHandle(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  overlay: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  rails: DirectorRails,
  railWorldAnchor: [number, number, number],
  hitRadius: number,
): RailHandleHit | null {
  const dpr = window.devicePixelRatio || 1
  const mx = (clientX - canvasRect.left) * dpr
  const my = (clientY - canvasRect.top)  * dpr

  let bestDist = hitRadius * dpr
  let bestHit:  RailHandleHit | null = null

  for (const h of getRailHandlePositions(cameraPos, targetPos, rails, railWorldAnchor)) {
    const s = overlay.projectToScreen(h.wx, h.wy, h.wz)
    const d = Math.sqrt((mx - s.px) ** 2 + (my - s.py) ** 2)
    if (d < bestDist) {
      bestDist = d
      bestHit  = { handleId: h.handleId }
    }
  }
  return bestHit
}

/**
 * Compute the new rail extent after dragging a handle.
 * canvasX/canvasY: canvas-local pixels (0~w, 0~h).
 */
export function computeRailHandleDrag(
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  handle: RailHandleId,
  origExtent: number,
  origCanvasY: number,  // for dolly (Y-drag → Z extent)
): number {
  const [cx, cy, cz] = cameraPos
  const [tx, , tz] = targetPos
  const [wx, wy] = pixelToWorld(canvasX, canvasY, canvasW, canvasH)

  const o = RAIL_OFFSET
  switch (handle.axis) {
    case 'truck':
      return Math.max(RAIL_MIN_STUB, handle.dir === 'pos' ? wx - cx - o : cx - o - wx)
    case 'boom':
      return Math.max(RAIL_MIN_STUB, handle.dir === 'pos' ? wy - cy - o : cy - o - wy)
    case 'dolly': {
      // Dolly (Z) — map vertical mouse delta to Z extent change
      const [, origWy] = pixelToWorld(canvasX, origCanvasY, canvasW, canvasH)
      const delta = (wy - origWy) * (handle.dir === 'neg' ? 1 : -1)
      return Math.max(RAIL_MIN_STUB, origExtent + delta)
    }
    case 'sphere': {
      // Distance from target in XZ plane
      const dx = wx - tx
      const dz = wy - tz  // wy used as Z (top-down XZ view)
      return Math.max(RAIL_MIN_STUB, Math.sqrt(dx * dx + dz * dz))
    }
    default:
      return Math.max(RAIL_MIN_STUB, origExtent)
  }
}

/**
 * Compute the new world position for a dragged camera keyframe.
 * canvasX/canvasY must be in canvas-local pixel coordinates (0~w, 0~h),
 * NOT browser clientX/clientY.
 */
export function computeCameraKeyframeDragPosition(
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
  originalPosition: [number, number, number],
  shiftKey: boolean,
): [number, number, number] {
  const [wx, wy] = pixelToWorld(canvasX, canvasY, canvasW, canvasH)

  if (shiftKey) {
    return [originalPosition[0], originalPosition[1], originalPosition[2] + (wy - originalPosition[1]) * 0.5]
  }

  return [wx, wy, originalPosition[2]]
}
