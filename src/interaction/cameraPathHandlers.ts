// Camera path hit testing and drag computation for 3D keyframe editing.
// Pure functions — no React/Zustand imports.

import type { OverlayRenderer } from '../engine/overlay'
import type { CameraViewKeyframe } from '../animation/directorTypes'
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
export function computeCameraKeyframeDragPosition(
  clientX: number,
  clientY: number,
  canvasW: number,
  canvasH: number,
  originalPosition: [number, number, number],
  shiftKey: boolean,
): [number, number, number] {
  const [wx, wy] = pixelToWorld(clientX, clientY, canvasW, canvasH)

  if (shiftKey) {
    // Shift+drag: keep X/Y, adjust Z based on vertical mouse movement
    return [originalPosition[0], originalPosition[1], originalPosition[2] + (wy - originalPosition[1]) * 0.5]
  }

  // Normal drag: move in XY plane at original Z
  return [wx, wy, originalPosition[2]]
}
