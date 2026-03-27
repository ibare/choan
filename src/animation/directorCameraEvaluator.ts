// Director camera evaluator — Catmull-Rom spline interpolation between view keyframes.
// Pure function, no React/Zustand imports.

import type { CameraViewKeyframe } from './directorTypes'
import { catmullRomPoint } from '../engine/catmullRom'

export interface DirectorCameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Evaluate camera state at a given absolute time using Catmull-Rom spline.
 * Position and target use CR spline for smooth curves.
 * FOV uses linear interpolation (curves on FOV are not intuitive).
 * Returns null if there are no keyframes.
 */
export function evaluateDirectorCamera(
  keyframes: CameraViewKeyframe[],
  time: number,
  tension = 0.5,
): DirectorCameraState | null {
  if (keyframes.length === 0) return null

  if (keyframes.length === 1) {
    const k = keyframes[0]
    return { position: [...k.position], target: [...k.target], fov: k.fov }
  }

  // Before first keyframe
  if (time <= keyframes[0].time) {
    const k = keyframes[0]
    return { position: [...k.position], target: [...k.target], fov: k.fov }
  }

  // After last keyframe
  const last = keyframes[keyframes.length - 1]
  if (time >= last.time) {
    return { position: [...last.position], target: [...last.target], fov: last.fov }
  }

  // Find bracketing segment
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]
    const b = keyframes[i + 1]
    if (time >= a.time && time <= b.time) {
      const segDur = b.time - a.time
      if (segDur <= 0) {
        return { position: [...b.position], target: [...b.target], fov: b.fov }
      }
      const t = (time - a.time) / segDur

      // Build 4-point window, clamping at boundaries
      const k0 = keyframes[Math.max(0, i - 1)]
      const k1 = a
      const k2 = b
      const k3 = keyframes[Math.min(keyframes.length - 1, i + 2)]

      // Catmull-Rom for position
      const position: [number, number, number] = [
        catmullRomPoint(k0.position[0], k1.position[0], k2.position[0], k3.position[0], t, tension),
        catmullRomPoint(k0.position[1], k1.position[1], k2.position[1], k3.position[1], t, tension),
        catmullRomPoint(k0.position[2], k1.position[2], k2.position[2], k3.position[2], t, tension),
      ]

      // Catmull-Rom for target
      const target: [number, number, number] = [
        catmullRomPoint(k0.target[0], k1.target[0], k2.target[0], k3.target[0], t, tension),
        catmullRomPoint(k0.target[1], k1.target[1], k2.target[1], k3.target[1], t, tension),
        catmullRomPoint(k0.target[2], k1.target[2], k2.target[2], k3.target[2], t, tension),
      ]

      // Linear for FOV
      const fov = lerp(a.fov, b.fov, t)

      return { position, target, fov }
    }
  }

  return { position: [...last.position], target: [...last.target], fov: last.fov }
}
