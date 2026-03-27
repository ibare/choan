// Director camera evaluator — interpolates between CameraViewKeyframes.
// Pure function, no React/Zustand imports.

import type { CameraViewKeyframe } from './directorTypes'

export interface DirectorCameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Evaluate camera state at a given absolute time by interpolating between keyframes.
 * Returns null if there are no keyframes (orbit controls remain active).
 */
export function evaluateDirectorCamera(
  keyframes: CameraViewKeyframe[],
  time: number,
): DirectorCameraState | null {
  if (keyframes.length === 0) return null

  // Single keyframe — return its values
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
      const segDuration = b.time - a.time
      if (segDuration <= 0) {
        return { position: [...b.position], target: [...b.target], fov: b.fov }
      }
      const t = (time - a.time) / segDuration

      return {
        position: [
          lerp(a.position[0], b.position[0], t),
          lerp(a.position[1], b.position[1], t),
          lerp(a.position[2], b.position[2], t),
        ],
        target: [
          lerp(a.target[0], b.target[0], t),
          lerp(a.target[1], b.target[1], t),
          lerp(a.target[2], b.target[2], t),
        ],
        fov: lerp(a.fov, b.fov, t),
      }
    }
  }

  return { position: [...last.position], target: [...last.target], fov: last.fov }
}
