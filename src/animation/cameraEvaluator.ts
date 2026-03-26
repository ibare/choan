// Camera keyframe evaluator — pure function that evaluates camera animation tracks.

import type { CameraClip, CameraAnimatableProperty } from './types'
import type { Camera } from '../engine/camera'
import { evaluateTrack } from './interpolate'
import { resolveEasing } from './easing'

export interface CameraAnimState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

const PROPERTY_MAP: Record<CameraAnimatableProperty, { target: 'position' | 'target' | 'fov'; index: number }> = {
  'cam.pos.x':    { target: 'position', index: 0 },
  'cam.pos.y':    { target: 'position', index: 1 },
  'cam.pos.z':    { target: 'position', index: 2 },
  'cam.target.x': { target: 'target',   index: 0 },
  'cam.target.y': { target: 'target',   index: 1 },
  'cam.target.z': { target: 'target',   index: 2 },
  'cam.fov':      { target: 'fov',      index: 0 },
}

/**
 * Evaluate camera animation at a given time.
 * Returns null if there are no camera keyframes (orbit controls remain active).
 */
export function evaluateCameraAnimation(
  cameraClip: CameraClip | undefined,
  time: number,
  defaultCamera: Camera,
): CameraAnimState | null {
  if (!cameraClip || cameraClip.tracks.length === 0) return null

  const result: CameraAnimState = {
    position: [...defaultCamera.position] as [number, number, number],
    target: [...defaultCamera.target] as [number, number, number],
    fov: defaultCamera.fov,
  }

  const fallbackEasing = resolveEasing(cameraClip.easing)

  for (const track of cameraClip.tracks) {
    if (track.keyframes.length === 0) continue
    const value = evaluateTrack(track.keyframes, time, fallbackEasing, track.property)
    const mapping = PROPERTY_MAP[track.property]

    if (mapping.target === 'fov') {
      result.fov = value
    } else {
      result[mapping.target][mapping.index] = value
    }
  }

  return result
}
