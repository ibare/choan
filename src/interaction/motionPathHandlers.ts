// Motion Path gizmo handlers — hit testing + coordinate inversion.
//
// Pure helpers called by usePointerHandlers while editing a bundle: given
// the clip's motionPath and the selected element, figure out whether the
// cursor is on top of a draggable handle (line endpoints or orbit center)
// and convert a world-space drop point back into path-local coordinates.
//
// The world conversion here must stay in lockstep with
// drawMotionPathOverlay's `buildToWorld` — otherwise the visible gizmo
// and the hit target will disagree.

import type { OverlayRenderer } from '../engine/overlay'
import type { ChoanElement } from '../store/useChoanStore'
import type { ElementMotionPath, Vec3 } from '../animation/motionPathTypes'
import { pixelToWorld, worldToPixel } from '../coords/coordinateSystem'

export type MotionPathHandleKind = 'center' | 'p0' | 'p1'

export interface MotionPathHitResult {
  kind: MotionPathHandleKind
}

// Radius of the clickable area around each handle, in reference pixels.
// Matches the visual disc radius (6/5) with generous padding for touch input.
const HIT_RADIUS_PX = 12

// ── Path local → world (mirrors drawMotionPathOverlay.buildToWorld) ──────────

function handleWorldPos(
  motionPath: ElementMotionPath,
  element: ChoanElement,
  extrudeDepth: number,
  local: Vec3,
): [number, number, number] {
  const halfDepth = extrudeDepth / 2
  if (motionPath.originMode === 'absolute') {
    const [wx, wy] = pixelToWorld(local[0], local[1])
    return [wx, wy, local[2] * extrudeDepth + halfDepth]
  }
  const centerPx = element.x + element.width / 2
  const centerPy = element.y + element.height / 2
  const [wx, wy] = pixelToWorld(centerPx + local[0], centerPy + local[1])
  const elWz = element.z * extrudeDepth + halfDepth
  return [wx, wy, elWz + local[2] * extrudeDepth]
}

// ── Hit test ─────────────────────────────────────────────────────────────────

/**
 * Check whether the pointer at (clientX, clientY) is over one of the
 * draggable handles of the given motion path. Returns null if not.
 */
export function hitTestMotionPathHandle(
  clientX: number, clientY: number,
  rect: DOMRect,
  ov: OverlayRenderer,
  motionPath: ElementMotionPath,
  element: ChoanElement,
  extrudeDepth: number,
  dpr: number,
): MotionPathHitResult | null {
  const mx = (clientX - rect.left) * dpr
  const my = (clientY - rect.top) * dpr
  const r = HIT_RADIUS_PX * dpr
  const r2 = r * r

  const testLocal = (local: Vec3, kind: MotionPathHandleKind): MotionPathHitResult | null => {
    const [wx, wy, wz] = handleWorldPos(motionPath, element, extrudeDepth, local)
    const s = ov.projectToScreen(wx, wy, wz)
    const dx = mx - s.px
    const dy = my - s.py
    if (dx * dx + dy * dy <= r2) return { kind }
    return null
  }

  if (motionPath.type === 'line') {
    // p1 first so that visually-on-top endpoints win when they overlap p0.
    return testLocal(motionPath.p1, 'p1') ?? testLocal(motionPath.p0, 'p0')
  }
  return testLocal(motionPath.center, 'center')
}

// ── World → path local (inverse of handleWorldPos for XY drop points) ───────

/**
 * Convert a world-space drop point into the coordinate frame of the
 * given path's handle. Only XY is recovered; callers that need to
 * preserve the handle's Z should pass it in as `originalLocalZ`.
 */
export function worldXYToPathLocal(
  wx: number, wy: number,
  motionPath: ElementMotionPath,
  element: ChoanElement,
  originalLocalZ: number,
): Vec3 {
  const [px, py] = worldToPixel(wx, wy)
  if (motionPath.originMode === 'absolute') {
    return [px, py, originalLocalZ]
  }
  const centerPx = element.x + element.width / 2
  const centerPy = element.y + element.height / 2
  return [px - centerPx, py - centerPy, originalLocalZ]
}
